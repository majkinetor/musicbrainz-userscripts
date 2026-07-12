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
// resolution. Collapse them into one review row:
//   - same resolved MB entity (mbUrl) → merge (the safe, primary case);
//   - an UNRESOLVED row whose name matches a UNIQUELY-resolved row of that name → merge into it
//     (adopting the MBID) — e.g. "Alan Morrallee" resolved from Tidal but not Qobuz;
//   - same-name rows that never resolved → merge together.
// Combining a group: roles are unioned, source badges unioned (mutates `entitySources`), and the
// rep adopts a resolution if any member had one. mergeMap maps the kept row's key → EVERY member's
// key, so the caller points every source URL at the MBID for dispatch.
const _resultKey = r => (r && r.entity && (r.entity.resource_url || r.entity._syntheticKey)) || `_nourl_${(r && ((r.entity && r.entity.name) || r.displayName)) || ''}`;
const _resultName = r => (r && ((r.entity && r.entity.name) || r.displayName)) || '';
const _roleKey = ro => [ro.linkType, ro.displayLabel, ro.trackPos, ro.trackTitle].join('');

// Levenshtein distance, bounded: returns -1 as soon as the minimum possible distance exceeds `max`
// (so long non-matches bail cheap). Used to catch typo'd credits ("Mark Barott" vs "Mark Barrott").
const boundedLev = (a, b, max) => {
    if (Math.abs(a.length - b.length) > max) return -1;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        let prev = dp[0]; dp[0] = j; let rowMin = dp[0];
        for (let i = 1; i <= a.length; i++) {
            const tmp = dp[i];
            dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp; if (dp[i] < rowMin) rowMin = dp[i];
        }
        if (rowMin > max) return -1;
    }
    return dp[a.length] <= max ? dp[a.length] : -1;
};
// Tight, length-guarded tolerance: no fuzz for short names (too collision-prone), 1 edit for
// mid-length, 2 for long. "mark barrott" (12) → 1, so a single-char typo merges; "john"/"joan" (4) → 0.
const fuzzyMax = len => len <= 6 ? 0 : len <= 12 ? 1 : 2;
export function mergeResolvedResults(allResults, entitySources) {
    const rows = (allResults || []).filter(Boolean);
    // name → set of resolved mbUrls, so an unresolved row can be routed to its resolved twin — but
    // only when that name resolves to exactly ONE MBID (ambiguous names are left alone).
    const nameMbids = new Map();
    for (const r of rows) {
        if (r.type !== 'resolved' || !r.mbUrl) continue;
        const fn = fold(_resultName(r)); if (!fn) continue;
        if (!nameMbids.has(fn)) nameMbids.set(fn, new Set());
        nameMbids.get(fn).add(r.mbUrl);
    }
    // Names that resolve to exactly ONE MBID — the only safe fuzzy-merge targets.
    const uniqResolved = [];
    nameMbids.forEach((set, nm) => { if (set.size === 1) uniqResolved.push([nm, [...set][0]]); });
    // An unresolved name that is a tight typo of exactly ONE uniquely-resolved name → route to its
    // MBID (#408). Returns null if zero, or if two DIFFERENT resolved names are both within tolerance
    // (ambiguous — leave it alone rather than guess).
    const fuzzyResolvedMatch = fn => {
        let hit = null;
        for (const [nm, url] of uniqResolved) {
            if (boundedLev(fn, nm, fuzzyMax(Math.max(fn.length, nm.length))) < 0) continue;
            if (hit && hit !== url) return null;
            hit = url;
        }
        return hit;
    };
    const keyFor = r => {
        if (r.type === 'resolved' && r.mbUrl) return 'mb:' + r.mbUrl;
        const fn = fold(_resultName(r)); if (!fn) return null;   // no name → never group
        const set = nameMbids.get(fn);
        if (set && set.size === 1) return 'mb:' + [...set][0];   // unresolved → its unique resolved twin
        const fuzzy = fuzzyResolvedMatch(fn);                    // unresolved → typo of a unique resolved twin
        if (fuzzy) return 'mb:' + fuzzy;
        return 'nm:' + fn;                                        // same-name, none resolved → group together
    };
    const byKey = new Map(), mergeMap = new Map(), out = [];
    for (const r of rows) {
        const gk = keyFor(r), rk = _resultKey(r);
        if (!gk || !byKey.has(gk)) { if (gk) { byKey.set(gk, r); mergeMap.set(rk, [rk]); } out.push(r); continue; }
        const rep = byKey.get(gk), repKey = _resultKey(rep);
        // rep was unresolved but this member is resolved → adopt the resolution onto the kept row.
        if ((rep.type !== 'resolved' || !rep.mbUrl) && r.type === 'resolved' && r.mbUrl) {
            rep.type = 'resolved'; rep.mbUrl = r.mbUrl; rep.mbName = r.mbName; rep.mbDisambig = r.mbDisambig;
            rep.entityType = r.entityType || rep.entityType; rep.logEntry = r.logEntry || rep.logEntry;
        }
        const seen = new Set((rep._roles || []).map(_roleKey));
        rep._roles = (rep._roles || []).concat((r._roles || []).filter(ro => { const k = _roleKey(ro); if (seen.has(k)) return false; seen.add(k); return true; }));
        if (entitySources) { const u = new Set(entitySources.get(repKey) || []); (entitySources.get(rk) || []).forEach(s => u.add(s)); entitySources.set(repKey, [...u]); }
        mergeMap.get(repKey).push(rk);
    }
    // #408: attach every real source URL of a row (one artist may carry a Tidal URL, a Qobuz URL,
    // …). Drives "add link" / "create artist" adding them all AND the Source column colouring a
    // badge (has URL) vs greying it (name-only credit) + opening the provider page on click.
    for (const rep of out) {
        const keys = mergeMap.get(_resultKey(rep));
        rep._mergeUrls = (keys || []).filter(k => /^https?:\/\//i.test(k));
    }
    return { results: out, mergeMap };
}
