// Source registry — the seam that makes the resolve/review/dispatch engine
// source-agnostic. Preflight (and the confirmed-IDB sweep in ui-bar) parse
// every credited entity's `resource_url` through here instead of assuming
// Discogs; whichever source recognises the URL supplies:
//   - `key`      — the IDB entity-cache key ("artist/123" for Discogs,
//                  "tidal-artist/123" for Tidal — prefixed so numeric ids
//                  from different sources never collide)
//   - `cleanUrl` — the canonical URL `/ws/2/url?resource=` is queried with
//                  to find an MB entity already linked to it
// A `null` return means "no URL identity" → name search + review only.

import { parseDiscogsUrl }     from '../api-discogs.js';
import { parseTidalArtistUrl } from './tidal.js';

/** Parse a credited entity's external URL into `{ key, cleanUrl, … }` via
 *  whichever source recognises it, or `null`. Drop-in superset of
 *  `parseDiscogsUrl` (Discogs URLs return the exact same shape). */
export function parseSourceEntityUrl(url) {
    if (!url) return null;
    return parseDiscogsUrl(url) || parseTidalArtistUrl(url);
}

/** Which source a credited entity's external URL belongs to — drives UI
 *  labels ("Add Tidal link") and the link-type choice below. */
export function sourceNameForUrl(url) {
    if (/tidal\.com\//i.test(url || '')) return 'Tidal';
    if (/qobuz\.com\//i.test(url || '')) return 'Qobuz';
    return 'Discogs';
}

/** MB URL-relationship link-type id to seed when adding this external URL
 *  to an MB entity. Discogs pages have dedicated types per entity; a Tidal
 *  artist page is a "streaming page" (978). Returns null when there is no
 *  sensible type (e.g. Tidal URL on a label) — callers then omit the URL. */
export function sourceUrlLinkTypeId(url, entityType) {
    const src = sourceNameForUrl(url);
    if (src === 'Tidal') return entityType === 'artist' ? '978' : null;
    if (src === 'Qobuz') return null;   // Qobuz credits carry no artist URLs
    return entityType === 'label' ? '217' : entityType === 'place' ? '705' : '180';
}
