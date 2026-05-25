// Pre-flight: resolve every Discogs artist / company against MusicBrainz
// BEFORE the actual import runs, so the review-table phase can show one
// row per credit with the chosen MBID (or "needs attention") for the user
// to confirm.
//
// Single resolver. The two earlier near-duplicates (`checkMissingArtists`
// and `checkMissingCompanies`) collapse into one
// `resolveEntity(entity, kind, opts)` + `resolveAll(entities, opts)`
// where `opts.kindOf(entity)` decides 'artist' | 'label' | 'place' per
// entity (null = skip).
//
// Lookup strategy per entity (unchanged from the old code):
//   1. IDB cache (mblinks store)             — instant; populated by prior runs.
//   2. Name search (`/ws/2/<type>?query=…`)   — single exact match wins.
//   3. URL relation (`/ws/2/url?resource=…&inc=<entity>-rels`) — fallback
//      when name search is ambiguous or empty.
//
// Result shape per entity is one of:
//   { type: 'resolved',  entity, mbUrl, mbName, mbDisambig, logEntry: {...} }
//   { type: 'attention', entity, nameMatches: [...]                      }

import { mbThrottle }                       from './api-mb.js';
import { db, readIdbRecord }                 from './storage.js';
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
 * Resolve a single Discogs entity against MB using the 3-strategy chain
 * (IDB → name search → URL relation).
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

    function buildResolved(mbUrl, mbName, mbDisambig, via, actualKind = kind) {
        return {
            type: 'resolved', entityType: actualKind, entity,
            displayName, discogsHref, mbUrl, mbName, mbDisambig,
            logEntry: { displayName, discogsHref, mbUrl, mbName, mbDisambig, via },
        };
    }

    /** Fetch MB entity name/disambiguation for a known MB URL (display only). */
    async function fetchMbEntityInfo(mbUrl) {
        const m = mbUrl.match(/\/(artist|label|place)\/([a-f0-9-]+)/);
        if (!m) return { name: null, disambiguation: '' };
        const json = await mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${m[1]}/${m[2]}?fmt=json`);
        return json
            ? { name: json.name || null, disambiguation: json.disambiguation || '' }
            : { name: null, disambiguation: '' };
    }

    // ── 1. IDB cache ─────────────────────────────────────────────────────────
    if (!bypassIdb && key) {
        const cachedRec = await readIdbRecord(key);
        if (cachedRec?.mb_links?.[0]) {
            const cached = cachedRec.mb_links[0];
            if (cachedRec.mb_name) {
                return buildResolved(cached, cachedRec.mb_name, cachedRec.mb_disambiguation || '', 'cache');
            }
            const info = await fetchMbEntityInfo(cached);
            if (info.name && db) {
                try {
                    db.transaction(['mblinks'], 'readwrite')
                      .objectStore('mblinks')
                      .put({ ...cachedRec, mb_name: info.name, mb_disambiguation: info.disambiguation });
                } catch(e) { /* ignore — best-effort cache populate */ }
            }
            return buildResolved(cached, info.name, info.disambiguation, 'cache');
        }
    }

    // ── 2. Name search ──────────────────────────────────────────────────────
    const nameJson = await mbThrottle.fetchJson(
        `//musicbrainz.org/ws/2/${kind}?query=${encodeURIComponent(searchName)}&fmt=json&limit=${searchLimit}`
    );
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
    const exactMatches = nameMatches.filter(a => a.name.toLowerCase().trim() === normalized);
    if (exactMatches.length === 1) {
        const a = exactMatches[0];
        const mbUrl = `//musicbrainz.org/${kind}/${a.id}`;
        if (key && db) {
            try {
                db.transaction(['mblinks'], 'readwrite')
                  .objectStore('mblinks')
                  .put({ discogs_id: key, mb_links: [mbUrl], mb_name: a.name, mb_disambiguation: a.disambiguation || '' });
            } catch(e) { /* ignore duplicate */ }
        }
        return buildResolved(mbUrl, a.name, a.disambiguation || '', 'name');
    }

    // ── 3. URL relation ─────────────────────────────────────────────────────
    const urlJson = parsed ? await mbThrottle.fetchJson(
        `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(parsed.cleanUrl)}&inc=${incRels}&fmt=json`
    ) : null;
    if (urlJson?.relations?.length > 0) {
        // For places, accept either place or label rels (facility-as-label edge case).
        const rel = kind === 'place'
            ? urlJson.relations.find(r => r.place || r.label)
            : urlJson.relations.find(r => r[kind]);
        if (rel) {
            const actualKind = rel[kind] ? kind : (rel.label ? 'label' : 'place');
            const a = rel[actualKind];
            const mbUrl = `//musicbrainz.org/${actualKind}/${a.id}`;
            const info = a.name ? a : await fetchMbEntityInfo(mbUrl);
            const resolvedName = info.name || a.name;
            const resolvedDisam = info.disambiguation || a.disambiguation || '';
            if (key && resolvedName && db) {
                try {
                    db.transaction(['mblinks'], 'readwrite')
                      .objectStore('mblinks')
                      .put({ discogs_id: key, mb_links: [mbUrl], mb_name: resolvedName, mb_disambiguation: resolvedDisam });
                } catch(e) { /* ignore */ }
            }
            return buildResolved(mbUrl, resolvedName, resolvedDisam, 'url', actualKind);
        }
    }

    return {
        type: 'attention', entityType: kind, entity,
        displayName, discogsHref, nameMatches,
        // Only artists track this — used by the review table to badge
        // entries that failed because of a rate-limited name search vs
        // entries that genuinely don't exist in MB.
        rateLimited: kind === 'artist' && nameSearchFailed && !nameMatches.length,
    };
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
