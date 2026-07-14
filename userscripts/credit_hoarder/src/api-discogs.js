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

// #393 Discogs disambiguates same-named entities with a trailing " (N)" (e.g. "Odeon (4)",
// "Audiolab (3)"). MB doesn't use that number, so strip it from companies/labels right at the
// source — search, review table and dispatch all see the clean name. Artists are covered
// separately in `getArtistRoles` (which also cleans their anv).
function stripCompanyNums(json) {
    for (const list of [json.companies, json.labels]) {
        if (!Array.isArray(list)) continue;
        for (const c of list) {
            if (c && typeof c.name === 'string') c.name = c.name.replace(/\s+\(\d+\)$/, '');
        }
    }
    return json;
}

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
            _releaseDataCache.set(url, stripCompanyNums(json));
            return json;
        });
}

/** Evict a single release from the session cache. Used by the review
 *  table's "Refresh" button to force a re-fetch from Discogs. */
export function clearReleaseDataCache(url) {
    _releaseDataCache.delete(url);
}

// Session cache for individual entity JSON (artist / label). Only the
// fields the "Create (Dis)" popup needs are kept; nothing else fetches
// these so a separate cache from `_releaseDataCache` is fine.
const _entityDataCache = new Map();

/**
 * Fetch a Discogs entity's JSON (artist or label) and return the slim
 * subset the create-with-disambiguation flow needs.
 *
 *   @param {string} resourceUrl — the Discogs entity's `resource_url`
 *     (`https://api.discogs.com/<type>s/<id>`) — same shape that the
 *     release JSON carries on every credited entity.
 *
 *   Returns `{ profile, name, namevariations, realname }` (each string
 *   or `null`/absent), or `null` on fetch / parse failure.
 *
 * `profile` is Discogs's free-form biography blurb. The popup surfaces
 * it so the user can pick a phrase for the MB disambiguation field —
 * MB-side disambiguation should be short (a few words), while Discogs
 * profiles can be paragraphs, so the popup shows the text + a default
 * suggestion (first ~3 roles) and lets the user select / edit before
 * submitting.
 */
export function getDiscogsEntityData(resourceUrl) {
    if (!resourceUrl) return Promise.resolve(null);
    if (_entityDataCache.has(resourceUrl)) return Promise.resolve(_entityDataCache.get(resourceUrl));
    return fetch(`${resourceUrl}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
            if (!json) { _entityDataCache.set(resourceUrl, null); return null; }
            const slim = {
                profile:        json.profile        || '',
                name:           json.name           || '',
                namevariations: json.namevariations || [],
                realname:       json.realname       || '',
            };
            _entityDataCache.set(resourceUrl, slim);
            return slim;
        })
        .catch(() => null);
}
