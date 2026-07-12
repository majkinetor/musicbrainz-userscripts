// #408 — consolidated import: merge every linked source's engine output into ONE set,
// dedup credits that agree on (entity, role, track), and record which source(s) each
// credit came from — so a single review table can show one row per credit with a
// Source column, and dispatch runs once. Pure (no DOM / GM) → unit-testable.
//
// A "harvest" is what a source's `run(..., collect=true)` returns:
//   { companies, artistRoles, tracklistRels, tracklist, sourceUrl, processTracklist, sourceName }

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Entity key EXACTLY as ui-bar's rolesMap keys artists (`resource_url` or `_nourl_<name-or-id>`),
// so the review table can look up a row's sources with the same key it already builds.
export const entityKeyOf = a => (a && a.resource_url) ? a.resource_url : `_nourl_${(a && (a.name || a.id)) || ''}`;

// Attribute signature — order-independent, tolerant of both the {_type,value} objects
// (instrument/vocal) and bare-string attributes.
const attrsSig = rel => JSON.stringify(
    (rel.attributes || []).map(x => (x && typeof x === 'object' && x._type) ? `${x._type}:${x.value}` : String(x)).sort()
);

// Two credits are "the same" when they agree on entity + role + attributes + track position.
// Different roles for the same person on the same track therefore stay SEPARATE (issue #408 —
// majkinetor: keep both), each carrying its own source badge.
export const relKeyOf = rel => [
    entityKeyOf(rel.artist), rel.linkType || '', attrsSig(rel), rel.track ? String(rel.track.position != null ? rel.track.position : '') : '',
].join('');

/**
 * Merge an array of per-source harvests. Returns the same engine shape the pipeline
 * consumes, plus:
 *   relSrc         Map<relKey, [sourceName…]>     — sources per exact credit
 *   entitySources  Map<entityKey, [sourceName…]>  — union of sources per entity (for the review row)
 * Dedup preserves first-seen order. Companies dedup by resource_url; tracklist unions by position.
 */
export function mergeHarvests(harvests) {
    const mkDedup = () => {
        const seen = new Map(), order = [];
        return {
            add(rel, source) { const k = relKeyOf(rel); if (!seen.has(k)) { seen.set(k, { rel, sources: new Set() }); order.push(k); } seen.get(k).sources.add(source); },
            drain(relSrc, entitySrc) {
                const arr = [];
                for (const k of order) {
                    const e = seen.get(k); arr.push(e.rel); relSrc.set(k, [...e.sources]);
                    const ek = entityKeyOf(e.rel.artist);
                    if (!entitySrc.has(ek)) entitySrc.set(ek, new Set());
                    e.sources.forEach(s => entitySrc.get(ek).add(s));
                }
                return arr;
            },
        };
    };
    const relSrc = new Map(), entitySrc = new Map();
    const arD = mkDedup(), trD = mkDedup();
    const companies = [], seenCo = new Set();
    const tracklist = [], seenPos = new Set();
    let processTracklist = false;

    for (const h of (harvests || [])) {
        if (!h) continue;
        const src = h.sourceName || 'Source';
        if (h.processTracklist) processTracklist = true;
        (h.artistRoles || []).forEach(r => arD.add(r, src));
        (h.tracklistRels || []).forEach(r => trD.add(r, src));
        (h.companies || []).forEach(c => { const ck = c.resource_url || `co:${fold(c.entity_type_name)}|${fold(c.name)}`; if (ck && !seenCo.has(ck)) { seenCo.add(ck); companies.push(c); } });
        (h.tracklist || []).forEach(t => { const pos = String(t && t.position != null ? t.position : ''); const key = pos || `#${tracklist.length}`; if (!seenPos.has(key)) { seenPos.add(key); tracklist.push(t); } });
    }

    const artistRoles = arD.drain(relSrc, entitySrc);
    const tracklistRels = trD.drain(relSrc, entitySrc);
    const entitySources = new Map(); entitySrc.forEach((set, k) => entitySources.set(k, [...set]));
    return { companies, artistRoles, tracklistRels, tracklist, processTracklist, relSrc, entitySources };
}

// #408: two sources give DIFFERENT source URLs for the same person, so they can't be merged before
// resolution — but once preflight resolves both to the SAME MB entity (mbUrl), collapse them into
// one review row: combine each source's roles, union the source badges (mutates `entitySources`).
// Returns { results, mergeMap } where mergeMap maps a kept row's entity key to EVERY member's key —
// the caller points all those source URLs at the MBID so dispatch applies every source's roles
// (identical (artist, role, track) edits dedupe at dispatch).
const _resultKey = r => (r && r.entity && (r.entity.resource_url || r.entity._syntheticKey)) || `_nourl_${(r && ((r.entity && r.entity.name) || r.displayName)) || ''}`;
const _roleKey = ro => [ro.linkType, ro.displayLabel, ro.trackPos, ro.trackTitle].join('');
export function mergeResolvedResults(allResults, entitySources) {
    const byMbid = new Map(), mergeMap = new Map(), out = [];
    for (const r of (allResults || [])) {
        if (!r) continue;
        const mb = r.type === 'resolved' ? r.mbUrl : null;
        const rk = _resultKey(r);
        if (!mb || !byMbid.has(mb)) { if (mb) { byMbid.set(mb, r); mergeMap.set(rk, [rk]); } out.push(r); continue; }
        const rep = byMbid.get(mb), repKey = _resultKey(rep);
        const seen = new Set((rep._roles || []).map(_roleKey));
        rep._roles = (rep._roles || []).concat((r._roles || []).filter(ro => { const k = _roleKey(ro); if (seen.has(k)) return false; seen.add(k); return true; }));
        if (entitySources) { const u = new Set(entitySources.get(repKey) || []); (entitySources.get(rk) || []).forEach(s => u.add(s)); entitySources.set(repKey, [...u]); }
        mergeMap.get(repKey).push(rk);
    }
    return { results: out, mergeMap };
}
