// MusicBrainz API helpers — the throttled fetch, small wrappers that go
// through it, and `MB.linkedEntities` lookups. The throttle is the single
// chokepoint for everything that hits musicbrainz.org/ws/2 (and /ws/js), so
// rate-limit handling lives in one place.

import { pageWindow } from './constants.js';
import { log }        from './log.js';

/**
 * Fetch a full MB entity from the internal `/ws/js/entity/{mbid}` endpoint.
 * Throws on non-2xx (the only place we want a hard failure — every other
 * MB hit goes through `mbThrottle` which resolves to `null` on failure so
 * the caller can decide).
 */
export async function fetchMBEntity(mbid) {
    const res = await fetch(`/ws/js/entity/${mbid}`);
    if (!res.ok) throw new Error(`/ws/js/entity/${mbid} → ${res.status}`);
    return res.json();
}

// ── Centralized MB API throttle ──────────────────────────────────────────
// All MB API requests go through this throttle. Up to MAX_CONCURRENT
// requests can be in flight at any time (no artificial gap between
// successive requests — MB's own backpressure paces sustained throughput).
//
// On 429/503 the worker that received the rate-limit pushes a shared
// `_pauseUntil` timestamp forward by Retry-After (or an exponential backoff
// if the header is absent). Every other worker checks `_pauseUntil` before
// its next request and idles until it elapses — i.e. all in-flight workers
// cooperatively back off together. This eliminates the thundering-herd
// retry storms that the previous "5 immediate parallel threads" approach
// produced (issue #30) while keeping the burst throughput that gave that
// approach its speed advantage over the strict serial chain it replaced.
export const mbThrottle = (() => {
    const MAX_CONCURRENT = 4;       // simultaneous in-flight requests
    let _running         = 0;
    let _pauseUntil      = 0;        // unix-ms; workers idle until this time
    const _queue         = [];        // pending { url, retries, wantJson, resolve }
    let _totalRequests   = 0;
    let _rateLimited     = 0;

    async function _waitForPause() {
        let wait;
        while ((wait = _pauseUntil - Date.now()) > 0) {
            await new Promise(r => setTimeout(r, wait));
        }
    }

    function _drain() {
        while (_running < MAX_CONCURRENT && _queue.length > 0) {
            _running++;
            const item = _queue.shift();
            _run(item).finally(() => { _running--; _drain(); });
        }
    }

    async function _run(item) {
        for (let attempt = 0; attempt <= item.retries; attempt++) {
            await _waitForPause();
            _totalRequests++;
            try {
                const res = await fetch(item.url);
                if (res.status === 429 || res.status === 503) {
                    _rateLimited++;
                    const ra = parseInt(res.headers.get('Retry-After'), 10);
                    const waitMs = (ra > 0) ? ra * 1000
                                            : Math.min(1000 * Math.pow(2, attempt), 30000);
                    // Push forward only — never backward — so concurrent 503s
                    // from sibling workers don't shorten an already-pending pause.
                    _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
                    continue;
                }
                if (!res.ok) { item.resolve(null); return; }
                const data = item.wantJson ? await res.json() : res;
                item.resolve(data);
                return;
            } catch (e) {
                if (attempt === item.retries) { item.resolve(null); return; }
                await new Promise(r => setTimeout(r, 500));
            }
        }
        item.resolve(null);
    }

    function _enqueue(url, retries, wantJson) {
        return new Promise(resolve => {
            _queue.push({ url, retries, wantJson, resolve });
            _drain();
        });
    }

    return {
        fetchJson: (url, retries = 3) => _enqueue(url, retries, true),
        fetchRaw:  (url, retries = 3) => _enqueue(url, retries, false),
        stats: () => ({ total: _totalRequests, rateLimited: _rateLimited,
                         inFlight: _running, queued: _queue.length }),
    };
})();

/** Thin wrapper around `mbThrottle.fetchJson` with a slightly higher retry default. */
export async function fetchWithRetry(url, retries = 4) {
    return mbThrottle.fetchJson(url, retries);
}

/**
 * Probe `/ws/js/release/<mbid>?fmt=json&inc=rels` and return the Discogs URL
 * linked to the release (if any), else `null`. Used at import start to decide
 * which Discogs release to fetch.
 *
 * Skips `mbThrottle` deliberately — it's a one-shot at session start, not in
 * the hot preflight loop. If MB rate-limits it the worst case is the import
 * never starts (and the user sees no progress, which is the same UX as the
 * throttle pausing it).
 */
export function getDiscogsUrlForRelease(mbid) {
    const url = `/ws/js/release/${mbid}?fmt=json&inc=rels`;
    return fetch(url)
        .then(body => body.json())
        .then(json => {
            const matchingRel = (json.relationships || []).find(rel => {
                return rel.target?.sidebar_name === 'Discogs';
            });
            return matchingRel?.target?.href_url || null;
        });
}

/**
 * Resolve a link type name to its numeric ID from MB.linkedEntities.link_type.
 *
 * Strictness invariant (post bug #2 fix): the returned link type's
 * `(type0, type1)` MUST equal the requested `(type0, type1)`. If no link
 * type satisfies the entity-type pair, return null — never silently fall
 * back to a same-named link type with the wrong entity types (that's how
 * we used to send `orchestra` to the "orchestra at" event link type,
 * issue #2 + the orchestra variant caught by the test gate).
 *
 * Match strategy, constrained to `(type0, type1)`:
 *   1. Exact match on `name` (canonical identifier)
 *   2. Exact match on `link_phrase` (forward UI phrase) or
 *      `reverse_link_phrase` (backward UI phrase)
 *   3. Contains-match on any of those three fields — pick the shortest
 *      (most specific) candidate
 *
 * MB's internal `name` field often differs from what the user sees in the
 * relationship dropdown. For example, MB's recording-orchestra link type
 * has `name = "performing orchestra"` but its `link_phrase = "{additional}
 * orchestra"`. A name-only matcher misses it; phrase matching catches it.
 *
 * Returns: numeric link-type id, or null with a WARN logged.
 */
export function resolveLinkTypeId(name, type0, type1) {
    const lt = pageWindow.MB?.linkedEntities?.link_type;
    if (!lt) { log.error('MB.linkedEntities.link_type not available'); return null; }
    const needle = name.toLowerCase().trim();
    // Strip MB's curly-brace attribute placeholders, e.g. "{additional} orchestra"
    // → "orchestra" so a Discogs role "orchestra" matches.
    const stripAttrs = s => (s || '').toLowerCase().replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();

    // Only consider link types with the exact (type0, type1) pair we need
    // AND that are NOT deprecated. MB ships deprecated link types in
    // `link_type` so existing rels still render — but the server rejects
    // any new submission using them. Picking one would block the commit
    // (issue #2: "mastering on recording is deprecated"). Skip them.
    const candidates = Object.values(lt).filter(v =>
        v.type0 === type0 && v.type1 === type1 && !v.deprecated
    );

    // 1. Exact match on `name`
    for (const v of candidates) {
        if ((v.name || '').toLowerCase() === needle) return v.id;
    }
    // 2. Exact match on `link_phrase` or `reverse_link_phrase` (with placeholders stripped)
    for (const v of candidates) {
        if (stripAttrs(v.link_phrase)         === needle) return v.id;
        if (stripAttrs(v.reverse_link_phrase) === needle) return v.id;
    }
    // 3. Contains-match on any of the three fields — pick the shortest (most specific).
    const contains = candidates.filter(v => {
        const blobs = [v.name, stripAttrs(v.link_phrase), stripAttrs(v.reverse_link_phrase)].filter(Boolean);
        return blobs.some(b => b.includes(needle) || needle.includes(b));
    });
    if (contains.length > 0) {
        contains.sort((a, b) => ((a.name || '').length || 999) - ((b.name || '').length || 999));
        const best = contains[0];
        if ((best.name || '').toLowerCase() !== needle) {
            log.info(`Fuzzy match: "${name}" → "${best.name}" (${type0}→${type1})`);
        }
        return best.id;
    }

    // Nothing found for this entity-type pair. Show what IS available so the
    // user can manually pick a better Discogs→MB role mapping later.
    const availableNames = candidates.map(v => v.name).filter(Boolean).sort().join(', ');
    const allByName = Object.values(lt).filter(v =>
        (v.name || '').toLowerCase() === needle ||
        stripAttrs(v.link_phrase)        === needle ||
        stripAttrs(v.reverse_link_phrase) === needle
    );
    const deprecatedHit = allByName.find(v => v.type0 === type0 && v.type1 === type1 && v.deprecated);
    const wrongPairHits  = allByName.filter(v => !(v.type0 === type0 && v.type1 === type1));
    if (deprecatedHit) {
        // MB deprecates link types but keeps them in `link_type` so existing
        // rels still render. New submissions are rejected — picking one would
        // block the commit. Log as ERR (red) since this is a hard refusal,
        // not a warning the user might safely override.
        const altPairs = [...new Set(allByName.filter(v => !v.deprecated).map(v => `${v.type0}→${v.type1}`))].join(', ');
        log.error(`"${name}" (${type0}→${type1}) is deprecated by MB and would block the commit — skipping${altPairs ? `. Valid alternative(s): ${altPairs}` : ''}.`);
    } else if (wrongPairHits.length > 0) {
        const hitDesc = wrongPairHits.map(v => `${v.name}(${v.type0}→${v.type1})`).join(', ');
        log.warn(`No "${name}" link type for (${type0}→${type1}) — exists for other entity pairs: ${hitDesc} — skipping`);
    } else {
        log.warn(`Unknown link type "${name}" (${type0}→${type1}). Available for this pair: ${availableNames || 'none'}`);
    }
    return null;
}
