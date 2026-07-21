// MusicBrainz API helpers — the throttled fetch, small wrappers that go
// through it, and `MB.linkedEntities` lookups. The throttle is the single
// chokepoint for everything that hits musicbrainz.org/ws/2 (and /ws/js), so
// rate-limit handling lives in one place.

import { pageWindow }    from './constants.js';
import { log, logDebug } from './log.js';

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
    // 4 concurrent in-flight requests. Briefly bumped to 8 per #87 in
    // an attempt to use MB's headroom, but a real-world test (Tricky -
    // Back To Mine, 46+38 entities) showed MB returning a stream of
    // 503s with `Retry-After: 9` once we sustained 8 in-flight + the
    // two-parallel-`resolveAll` burst (artists + companies). The 9-second
    // shared pause cascaded across every worker — the run ended up
    // SLOWER than the previous shape. Reverted: original sizing was right.
    const MAX_CONCURRENT = 4;       // simultaneous in-flight requests
    let _running         = 0;
    let _pauseUntil      = 0;        // unix-ms; workers idle until this time
    const _queue         = [];        // pending { url, retries, wantJson, resolve }
    let _totalRequests   = 0;
    let _rateLimited     = 0;

    async function _waitForPause() {
        let wait = _pauseUntil - Date.now();
        if (wait <= 0) return;
        // #87 diagnostic: announce every wait so we can see in the log
        // "worker X paused 1500ms" pile up under a 503 storm.
        logDebug(`throttle: waiting ${wait}ms for shared pause`);
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

    // Per-logical-request diagnostic id (independent of `_totalRequests`,
    // which counts HTTP attempts incl. retries for stats). One `req#N`
    // covers all retries of the same call, so the user can read the
    // story end-to-end in the diagnostic log.
    let _diagReqSeq = 0;

    // Per-request hard timeout. The browser will happily wait many tens of
    // seconds on a stuck connection (#87 follow-up: observed a `/ws/2/url`
    // fetch that hung for 40 213ms before the network layer gave up). One
    // hung request blocks a throttle slot for that whole time. 10s is well
    // beyond MB's normal response time (<500ms typical) but short enough
    // that a stuck connection retries promptly. Lowered from 15s after a
    // log from majkinetor showed ~30 stuck requests each burning 15s.
    const REQUEST_TIMEOUT_MS = 10000;

    async function _run(item) {
        const tag = `req#${++_diagReqSeq}`;
        const shortUrl = item.url.replace('//musicbrainz.org', '').replace(/^https:/, '');
        for (let attempt = 0; attempt <= item.retries; attempt++) {
            await _waitForPause();
            _totalRequests++;
            const attemptTag = attempt === 0 ? '' : ` (retry ${attempt})`;
            // #87 diagnostic: log request start with in-flight + queued
            // snapshot so the user can see contention in the log:
            //   req#7 [running=8 queued=3] GET /ws/2/artist?query=...
            logDebug(`${tag} [running=${_running} queued=${_queue.length}] GET ${shortUrl}${attemptTag}`);
            const t0 = Date.now();
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
            try {
                const res = await fetch(item.url, { signal: ctrl.signal });
                const elapsed = Date.now() - t0;
                if (res.status === 429 || res.status === 503) {
                    _rateLimited++;
                    const ra = parseInt(res.headers.get('Retry-After'), 10);
                    const waitMs = (ra > 0) ? ra * 1000
                                            : Math.min(1000 * Math.pow(2, attempt), 30000);
                    // Push forward only — never backward — so concurrent 503s
                    // from sibling workers don't shorten an already-pending pause.
                    _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
                    logDebug(`${tag} <- ${res.status} in ${elapsed}ms; shared pause pushed to +${waitMs}ms`);
                    continue;
                }
                if (!res.ok) {
                    logDebug(`${tag} <- ${res.status} (give up) in ${elapsed}ms`);
                    // 404 is an ANSWER (entity not in MB), not a failure. Callers
                    // that need to tell the two apart (preflight's URL lookup —
                    // "no relations" vs "lookup failed", #193 chip bug) opt in
                    // via `fetchJson404` and get a `{ notFound: true }` sentinel.
                    item.resolve(item.nf && res.status === 404 ? { notFound: true } : null);
                    return;
                }
                const data = item.wantJson ? await res.json() : res;
                logDebug(`${tag} <- ${res.status} in ${elapsed}ms`);
                item.resolve(data);
                return;
            } catch (e) {
                const elapsed = Date.now() - t0;
                const isTimeout = e?.name === 'AbortError';
                const reason = isTimeout
                    ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
                    : `${e?.message || e}`;
                // Treat AbortError (network-layer timeout) as cooperative
                // backpressure. In the #87 logs, timeouts came in clusters of
                // 3-5 within a few hundred ms — that pattern is MB-side
                // overload (silently dropping requests instead of returning
                // 503), not random socket stalls. Bump the shared pause so
                // the rest of the pool pauses before piling on again.
                if (isTimeout) {
                    _rateLimited++;
                    const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
                    _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
                    logDebug(`${tag} threw in ${elapsed}ms: ${reason}; shared pause pushed to +${waitMs}ms`);
                } else {
                    logDebug(`${tag} threw in ${elapsed}ms: ${reason}`);
                }
                if (attempt === item.retries) { item.resolve(null); return; }
                await new Promise(r => setTimeout(r, 500));
            } finally {
                clearTimeout(timer);
            }
        }
        item.resolve(null);
    }

    function _enqueue(url, retries, wantJson, nf = false) {
        return new Promise(resolve => {
            _queue.push({ url, retries, wantJson, nf, resolve });
            _drain();
        });
    }

    return {
        fetchJson:    (url, retries = 3) => _enqueue(url, retries, true),
        // Like fetchJson, but a 404 resolves `{ notFound: true }` instead of
        // null — so null unambiguously means "lookup FAILED" (#193 chip bug).
        fetchJson404: (url, retries = 3) => _enqueue(url, retries, true, true),
        fetchRaw:     (url, retries = 3) => _enqueue(url, retries, false),
        stats: () => ({ total: _totalRequests, rateLimited: _rateLimited,
                         inFlight: _running, queued: _queue.length }),
    };
})();

/** Thin wrapper around `mbThrottle.fetchJson` with a slightly higher retry default. */
export async function fetchWithRetry(url, retries = 4) {
    return mbThrottle.fetchJson(url, retries);
}

// On-request (#132): the distinct relationship-type categories an artist already
// has in MB (e.g. producer / mix / mastering / misc), so a reviewer can sanity-
// check a credit against the artist's known roles. This is NOT free — it's an
// extra throttled request per artist — so the review table calls it lazily, only
// when the user clicks to check a row. One `limit=100` page surfaces the
// categories for all but the most prolific artists (we don't paginate, to keep
// the on-request cost to a single request). Session-cached per MBID; failures
// are not cached. Returns `string[]` (possibly empty) or `null` on failure.
const _relTypeCache = new Map();
export async function fetchArtistRelTypes(mbid) {
    if (!mbid) return null;
    if (_relTypeCache.has(mbid)) return _relTypeCache.get(mbid);
    const json = await mbThrottle.fetchJson(
        `//musicbrainz.org/ws/2/artist/${mbid}?inc=recording-rels+release-rels+release-group-rels+work-rels&fmt=json&limit=100`
    );
    if (!json) return null;
    const types = relRoleLabels(json.relations);
    _relTypeCache.set(mbid, types);
    return types;
}

/**
 * Collapse an artist's MB relations to a sorted, de-duped set of role labels.
 *
 * For instrument/vocal relationships the useful detail is the SPECIFIC
 * instrument / vocal — which MB carries as the relation's `attributes` (e.g.
 * `instrument` + `["koto"]`). Surface those instead of the generic
 * "instrument"/"vocal" type so the roles chip reads "koto", "lead vocals", … .
 * Pure performance modifiers ("additional", "guest", …) are dropped so they
 * don't masquerade as instruments. Every other relationship keeps its plain
 * type name. Exported for unit testing.
 */
const MODIFIER_ATTRS = new Set(['additional', 'guest', 'solo', 'minor', 'bonus']);
export function relRoleLabels(relations) {
    const labels = new Set();
    for (const r of (relations || [])) {
        if (!r.type) continue;
        const attrs = (Array.isArray(r.attributes) ? r.attributes : [])
            .filter(a => a && !MODIFIER_ATTRS.has(String(a).toLowerCase()));
        if ((r.type === 'instrument' || r.type === 'vocal') && attrs.length) {
            attrs.forEach(a => labels.add(a));
        } else {
            labels.add(r.type);
        }
    }
    return [...labels].sort();
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
    return getSourceUrlsForRelease(mbid).then(s => s.discogs);
}

/**
 * One probe, every source: return `{ discogs, tidal }` URLs linked to the
 * release (each `null` when absent). Same `/ws/js/release/<mbid>?inc=rels`
 * call `getDiscogsUrlForRelease` always made — just harvested for all
 * import sources at once.
 */
export function getSourceUrlsForRelease(mbid) {
    const url = `/ws/js/release/${mbid}?fmt=json&inc=rels`;
    return fetch(url)
        .then(body => body.json())
        .then(json => {
            const rels = json.relationships || [];
            // MB's rel hrefs are protocol-relative (`//tidal.com/…`) —
            // absolutize so logs / edit notes / tab-opens get a real URL.
            const abs  = u => u && u.startsWith('//') ? 'https:' + u : u;
            const href = pred => abs(rels.find(pred)?.target?.href_url || null);
            return {
                discogs: href(rel => rel.target?.sidebar_name === 'Discogs'),
                tidal:   href(rel => /(^|\/\/)(www\.|listen\.)?tidal\.com\/(browse\/)?album\/\d+/i.test(rel.target?.href_url || '')),
                qobuz:   href(rel => /(^|\/\/)(www\.|play\.|open\.)?qobuz\.com\/([a-z]{2}-[a-z]{2}\/)?album\//i.test(rel.target?.href_url || '')),
                deezer:  href(rel => /(^|\/\/)(www\.)?deezer\.com\/([a-z]{2}\/)?album\/\d+/i.test(rel.target?.href_url || '')),
                apple:   href(rel => /(^|\/\/)(?:music|itunes)\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/?#]+\/)?(?:id)?\d+/i.test(rel.target?.href_url || '')),   // #435; iTunes URLs #436
                metalArchives: href(rel => /(^|\/\/)(www\.)?metal-archives\.com\/albums\/[^/]+\/[^/]+\/\d+/i.test(rel.target?.href_url || '')),   // #453
            };
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
