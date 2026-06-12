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
