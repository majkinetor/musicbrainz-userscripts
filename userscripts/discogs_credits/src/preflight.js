// Pre-flight: resolve every Discogs artist / company against MusicBrainz
// BEFORE the actual import runs, so the review-table phase can show one
// row per credit with the chosen MBID (or "needs attention") for the user
// to confirm.
//
// Single resolver: `resolveEntity(entity, kind, opts)` + the pool runner
// `resolveAll(entities, opts)`. `opts.kindOf(entity)` decides
// `'artist' | 'label' | 'place'` per entity (`null` = skip).
//
// ── Lookup strategy per entity ─────────────────────────────────────────────
//   1. IDB cache (`entity_cache` store) — instant; populated by prior runs.
//   2. Name search + URL relation run **in parallel**:
//       - `/ws/2/<type>?query=…&fmt=json`              (search by name)
//       - `/ws/2/url?resource=<discogsUrl>&inc=<type>-rels`  (URL relation)
//   3. Decide based on what the two parallel lookups produced:
//       - name **and** URL agree (same MBID) → `resolvedVia: 'both'`
//       - URL-only (direct URL relation, strong) → `resolvedVia: 'url'`
//       - name-only (exact-name single match) → `resolvedVia: 'name'`
//       - they disagree → unresolved (user reviews; caught a latent bug
//         where the old code would silently auto-pick one)
//       - neither hit → unresolved
//
// Result shape per entity is one of:
//   { type: 'resolved',  entity, mbUrl, mbName, mbDisambig, logEntry: {...} }
//   { type: 'attention', entity, nameMatches: [...] }

import { mbThrottle }                       from './api-mb.js';
import { readIdbRecord, writeIdbRecord }    from './storage.js';
import { parseDiscogsUrl }                  from './api-discogs.js';
import { ENTITY_TYPE_MAP }                  from './data/entity-map.js';

// `kind`-specific tweaks. Tiny lookup table so the per-strategy code in
// `resolveEntity` reads as one shared body.
const KIND_TABLE = {
    artist: { searchLimit: 10, resultKey: 'artists', incRels: 'artist-rels' },
    label:  { searchLimit: 8,  resultKey: 'labels',  incRels: 'label-rels'  },
    // Places also accept label-rels because MB editors often file a
    // facility as a label rather than a place (issue we've worked around
    // since the original company resolver).
    place:  { searchLimit: 8,  resultKey: 'places',  incRels: 'place-rels+label-rels' },
};

/**
 * Resolve a single Discogs entity against MB using the 3-strategy chain.
 *
 *   - `kind`: one of `'artist' | 'label' | 'place'`.
 *   - `opts.bypassIdb`: skip step 1 (for forced refreshes).
 *
 * Returns one of the result shapes documented at the top of the file.
 */
async function resolveEntity(entity, kind, opts) {
    const { bypassIdb } = opts;
    const { searchLimit, resultKey, incRels } = KIND_TABLE[kind];

    const parsed     = parseDiscogsUrl(entity.resource_url);
    const key        = parsed?.key;
    const searchName = entity.name;
    const displayName = kind === 'artist'
        ? (entity.anv && entity.anv.trim()) || entity.name
        : entity.name;
    // API URLs ("api.discogs.com/artists/123") → website form ("www.discogs.com/artist/123").
    // Same `(\w+?)s/(\d+)` pattern works for artist/label/master.
    const discogsHref = entity.resource_url
        .replace(/https:\/\/api\.discogs\.com\/(\w+?)s\/(\d+)/, 'https://www.discogs.com/$1/$2');

    function buildResolved(mbUrl, mbName, mbDisambig, via, actualKind = kind, fromCache = false) {
        return {
            type: 'resolved', entityType: actualKind, entity,
            displayName, discogsHref, mbUrl, mbName, mbDisambig,
            // `via`      — the resolution mechanism (`name` / `url` / `both` / `user`,
            //              or `cache` only when a legacy IDB record predates the
            //              `resolvedVia` field and we genuinely can't recover it).
            // `fromCache`— whether THIS resolution came from IDB rather than a fresh
            //              MB lookup. The two are orthogonal: a name-resolved entity
            //              loaded from cache is `via='name'` + `fromCache=true`, and
            //              the UI surfaces both as `name (cache)`.
            logEntry: { displayName, discogsHref, mbUrl, mbName, mbDisambig, via, fromCache },
        };
    }

    function buildAttention(nameMatches, nameSearchFailed, ambiguityReason) {
        return {
            type: 'attention', entityType: kind, entity,
            displayName, discogsHref, nameMatches: nameMatches || [],
            // Only artists track this — used by the review table to badge
            // entries that failed because of a rate-limited name search vs
            // entries that genuinely don't exist in MB.
            rateLimited: kind === 'artist' && nameSearchFailed && !(nameMatches?.length),
            ambiguityReason: ambiguityReason || null,
        };
    }

    /** Fetch MB entity name/disambiguation for a known MB type+MBID (display only). */
    async function fetchMbEntityInfo(et, mbid) {
        const json = await mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${et}/${mbid}?fmt=json`);
        return json
            ? { name: json.name || null, disambiguation: json.disambiguation || '' }
            : { name: null, disambiguation: '' };
    }

    // ── 1. IDB cache ─────────────────────────────────────────────────────────
    if (!bypassIdb && key) {
        const cachedRec = await readIdbRecord(key);
        if (cachedRec?.mbid && cachedRec?.entityType) {
            // Cache has an MBID. Preserve the ORIGINAL `resolvedVia` (how this
            // record first got resolved — `name` / `url` / `both` / `user`) and
            // set `fromCache: true` separately. The UI composes both into a
            // label like `name (cache)`. Records written before `resolvedVia`
            // existed fall back to the literal `cache` (still flagged
            // `fromCache: true` for symmetry, but the label is just `cache`).
            const via = cachedRec.resolvedVia || 'cache';
            if (cachedRec.name) {
                return buildResolved(cachedRec.mbUrl, cachedRec.name,
                                     cachedRec.disambiguation || '', via,
                                     cachedRec.entityType, true);
            }
            // Name missing — fetch it once, write back, return.
            const info = await fetchMbEntityInfo(cachedRec.entityType, cachedRec.mbid);
            if (info.name) {
                await writeIdbRecord(key, {
                    name: info.name,
                    disambiguation: info.disambiguation,
                });
            }
            return buildResolved(cachedRec.mbUrl, info.name, info.disambiguation,
                                 via, cachedRec.entityType, true);
        }
    }

    // ── 2 + 3. Name search AND URL relation, in parallel ────────────────────
    const [nameJson, urlJson] = await Promise.all([
        mbThrottle.fetchJson(
            `//musicbrainz.org/ws/2/${kind}?query=${encodeURIComponent(searchName)}&fmt=json&limit=${searchLimit}`
        ),
        parsed ? mbThrottle.fetchJson(
            `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(parsed.cleanUrl)}&inc=${incRels}&fmt=json`
        ) : Promise.resolve(null),
    ]);

    // Name search — collect everything for the review table; pick a single
    // exact-match (case-insensitive) as the auto-resolve candidate.
    const nameSearchFailed = nameJson === null;
    const normalized = searchName.toLowerCase().trim();
    const nameMatches = !(nameJson?.[resultKey]) ? [] : nameJson[resultKey]
        .filter(a => a.name.toLowerCase().trim() === normalized || (a.score != null && a.score >= 70))
        .map(a => ({
            id: a.id,
            name: a.name,
            disambiguation: a.disambiguation || a['disambiguation-comment'] || '',
            score: a.score || 0,
        }));
    const exactNameMatches = nameMatches.filter(a => a.name.toLowerCase().trim() === normalized);
    const nameHit = exactNameMatches.length === 1 ? {
        kind,
        mbid:           exactNameMatches[0].id,
        name:           exactNameMatches[0].name,
        disambiguation: exactNameMatches[0].disambiguation || '',
    } : null;

    // URL relation — extract the first matching rel (kind-specific; places
    // also accept label rels because MB editors often file a facility as a
    // label rather than a place).
    let urlHit = null;
    if (urlJson?.relations?.length > 0) {
        const rel = kind === 'place'
            ? urlJson.relations.find(r => r.place || r.label)
            : urlJson.relations.find(r => r[kind]);
        if (rel) {
            const actualKind = rel[kind] ? kind : (rel.label ? 'label' : 'place');
            const a = rel[actualKind];
            urlHit = {
                kind:           actualKind,
                mbid:           a.id,
                name:           a.name || null,
                disambiguation: a.disambiguation || '',
            };
        }
    }

    // ── 4. Decide ───────────────────────────────────────────────────────────
    let resolved = null;
    let via      = null;
    if (nameHit && urlHit) {
        if (nameHit.mbid === urlHit.mbid && nameHit.kind === urlHit.kind) {
            // Both lookups returned the same MBID — highest confidence.
            // Prefer the URL hit's `kind` (it's authoritative for the
            // place-resolved-as-label case).
            resolved = urlHit;
            via      = 'both';
        } else {
            // Disagreement — needs user review. The old code silently picked
            // whichever came first (always name, because the URL lookup was
            // a fall-through); this is the latent bug that issue #32
            // proposal E fixes.
            return buildAttention(
                nameMatches, false,
                `name → ${nameHit.kind}/${nameHit.mbid}, URL → ${urlHit.kind}/${urlHit.mbid}`
            );
        }
    } else if (urlHit) {
        resolved = urlHit;
        via      = 'url';
    } else if (nameHit) {
        resolved = nameHit;
        via      = 'name';
    }

    if (resolved) {
        const mbUrl = `//musicbrainz.org/${resolved.kind}/${resolved.mbid}`;
        let finalName  = resolved.name;
        let finalDisam = resolved.disambiguation;
        if (!finalName) {
            // URL-only hit may lack name/disambiguation — fetch them.
            const info = await fetchMbEntityInfo(resolved.kind, resolved.mbid);
            finalName  = info.name || null;
            finalDisam = info.disambiguation || '';
        }
        // Persist to IDB cache for future sessions.
        if (key) {
            await writeIdbRecord(key, {
                mbid:           resolved.mbid,
                entityType:     resolved.kind,
                name:           finalName,
                disambiguation: finalDisam || '',
                resolvedVia:    via,
            });
        }
        return buildResolved(mbUrl, finalName, finalDisam || '', via, resolved.kind);
    }

    // Nothing resolved.
    return buildAttention(nameMatches, nameSearchFailed);
}

/**
 * Run the 3-strategy resolver over every entity in parallel (concurrency
 * pool of 5). Updates a progress `<li>` as workers churn through the queue.
 *
 *   - `opts.kindOf(entity)`: returns `'artist'|'label'|'place'` or `null`.
 *     `null` ⇒ skip this entity (e.g. an unmapped Discogs `entity_type_name`).
 *   - `opts.progressLi`: DOM element to update with "M/N done — checking …".
 *   - `opts.progressLabel`: leading text for the progress line.
 *   - `opts.bypassIdb`: pass through to `resolveEntity`.
 *
 * Returns `{ allResults: [...] }` with skipped entities filtered out.
 */
export async function resolveAll(entities, opts) {
    const { kindOf, progressLi, bypassIdb, progressLabel } = opts;
    const CONCURRENCY = 5;
    const MIN_GAP_MS  = 50;
    let done = 0;
    const inFlightNames = new Set();

    function setProgress() {
        if (!progressLi) return;
        const remaining = entities.length - done;
        const checking = inFlightNames.size
            ? ` — checking <em>${[...inFlightNames].join(', ')}</em>` : '';
        progressLi.innerHTML =
            `${progressLabel}… ` +
            `<strong>${done}/${entities.length}</strong> done${checking}` +
            (remaining === 0 ? ' ✔' : ` (${remaining} remaining)`);
    }

    const delay = ms => new Promise(r => setTimeout(r, ms));
    const queue = entities.map((e, i) => ({ entity: e, index: i }));
    const results = new Array(entities.length);
    setProgress();

    async function worker(slotIndex) {
        await delay(slotIndex * MIN_GAP_MS);  // stagger slot starts
        while (queue.length > 0) {
            const { entity, index } = queue.shift();
            const kind = kindOf(entity);
            if (!kind) { done++; setProgress(); continue; }
            const displayName = kind === 'artist'
                ? (entity.anv && entity.anv.trim()) || entity.name
                : entity.name;
            inFlightNames.add(displayName);
            setProgress();
            results[index] = await resolveEntity(entity, kind, { bypassIdb });
            inFlightNames.delete(displayName);
            done++;
            setProgress();
        }
    }

    const slots = Math.min(CONCURRENCY, entities.length);
    if (slots > 0) await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));

    return { allResults: results.filter(Boolean) };
}

/** `kindOf` helper for artists — always `'artist'`. */
export const ARTIST_KIND = () => 'artist';

/** `kindOf` helper for Discogs companies — maps via ENTITY_TYPE_MAP. */
export const COMPANY_KIND = c => ENTITY_TYPE_MAP[c.entity_type_name]?.entityType ?? null;
