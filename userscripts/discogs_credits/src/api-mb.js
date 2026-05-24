// MusicBrainz API helpers — the throttled fetch and small wrappers that go
// through it. The throttle is the single chokepoint for everything that hits
// musicbrainz.org/ws/2 (and /ws/js), so rate-limit handling lives in one place.

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
