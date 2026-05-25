// Discogs API wrappers and URL helpers.

const DISCOGS_URL_RE = /^https?:\/\/(?:www|api)\.discogs\.com\/(?:(?:(?!sell).+|sell.+)\/)?(master|release|artist|label)s?\/(\d+)(?:[^?#]*)(?:\?noanv=1|\?anv=[^=]+)?$/i;

/**
 * Parse a Discogs URL (api.discogs.com or www.discogs.com) into its pieces.
 *
 * Recognises `master`, `release`, `artist`, `label` URLs in singular and
 * plural ("/labels/123" vs "/label/123") forms.
 *
 * Returns `{type, id, key, cleanUrl}` on match, or `null` otherwise.
 *
 *   - `type`     — `'master' | 'release' | 'artist' | 'label'`
 *   - `id`       — the numeric Discogs id, as a string
 *   - `key`      — `"<type>/<id>"`, the IDB / localStorage key used elsewhere
 *   - `cleanUrl` — canonical `https://www.discogs.com/<type>/<id>` form
 *
 * Pure: no side effects, no module state.
 */
export function parseDiscogsUrl(url) {
    const m = DISCOGS_URL_RE.exec(url);
    if (!m) return null;
    const type = m[1];
    const id   = m[2];
    return {
        type,
        id,
        key:      `${type}/${id}`,
        cleanUrl: `https://www.discogs.com/${type}/${id}`,
    };
}

// In-memory session cache for Discogs release JSON. Avoids localStorage
// quota issues (releases with many credits can be large) and re-fetches
// across a single Import session.
const _releaseDataCache = new Map();

/**
 * Fetch a Discogs release's JSON. Returns the cached copy if seen this
 * session, otherwise hits `api.discogs.com/releases/<id>` and memoises.
 */
export function getDiscogsReleaseData(url) {
    if (_releaseDataCache.has(url)) return Promise.resolve(_releaseDataCache.get(url));
    return fetch(
        `${url.replace(
            'https://www.discogs.com/release/',
            'https://api.discogs.com/releases/'
        )}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`
    )
        .then(body => body.json())
        .then(json => {
            _releaseDataCache.set(url, json);
            return json;
        });
}

/** Evict a single release from the session cache. Used by the review
 *  table's "Refresh" button to force a re-fetch from Discogs. */
export function clearReleaseDataCache(url) {
    _releaseDataCache.delete(url);
}
