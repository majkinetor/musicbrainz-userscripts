// Discogs API wrappers and URL helpers.
//
// `link_infos` holds the parsed pieces of every Discogs URL the script has
// seen this session, keyed by `${type}/${id}`. It's mutated by
// `getDiscogsLinkKey` and read directly from many call sites — that's why
// it's exported.

/** Map of "<type>/<id>" → { type, id, clean_url }. Populated lazily by `getDiscogsLinkKey`. */
export const link_infos = {};

/**
 * Parse a Discogs URL (api.discogs.com or www.discogs.com) into a key of the
 * form "<type>/<id>" and cache its pieces in `link_infos[key]`.
 *
 * Recognises `master`, `release`, `artist`, `label` URLs in singular and
 * plural ("/labels/123" vs "/label/123") forms. Returns `false` when the URL
 * doesn't match.
 *
 * Side effect: mutates `link_infos`. Idempotent — re-parsing the same URL
 * just returns the cached key.
 */
export function getDiscogsLinkKey(url) {
    const re = /^https?:\/\/(?:www|api)\.discogs\.com\/(?:(?:(?!sell).+|sell.+)\/)?(master|release|artist|label)s?\/(\d+)(?:[^?#]*)(?:\?noanv=1|\?anv=[^=]+)?$/i;
    const m = re.exec(url);
    if (m !== null) {
        const key = `${m[1]}/${m[2]}`;
        if (!link_infos[key]) {
            link_infos[key] = {
                type: m[1],
                id: m[2],
                clean_url: `https://www.discogs.com/${m[1]}/${m[2]}`,
            };
        }
        return key;
    }
    return false;
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
