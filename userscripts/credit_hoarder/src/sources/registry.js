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

import { parseDiscogsUrl }      from '../api-discogs.js';
import { parseTidalArtistUrl }  from './tidal.js';
import { parseQobuzArtistUrl }  from './qobuz.js';
import { parseMetalArchivesArtistUrl } from './metal_archives.js';

/** Parse a credited entity's external URL into `{ key, cleanUrl, … }` via
 *  whichever source recognises it, or `null`. Drop-in superset of
 *  `parseDiscogsUrl` (Discogs URLs return the exact same shape). */
export function parseSourceEntityUrl(url) {
    if (!url) return null;
    return parseDiscogsUrl(url) || parseTidalArtistUrl(url) || parseQobuzArtistUrl(url) || parseMetalArchivesArtistUrl(url);
}

/** The IDB `entity_cache` key for an entity. Normally derived from its source
 *  URL, but name-only entities (Qobuz credits, #271 title-derived remixers)
 *  carry no URL — they instead set an explicit `_cacheKey` (release-scoped, so
 *  a bare name like "Friends" can't leak a resolution across releases). Returns
 *  null when neither is present (→ no caching, the prior name-only behaviour). */
export function idbKeyForEntity(entity) {
    if (!entity) return null;
    return parseSourceEntityUrl(entity.resource_url)?.key || entity._cacheKey || null;
}

/** Which source a credited entity's external URL belongs to — drives UI
 *  labels ("Add Tidal link") and the link-type choice below. */
export function sourceNameForUrl(url) {
    if (/tidal\.com\//i.test(url || '')) return 'Tidal';
    if (/qobuz\.com\//i.test(url || '')) return 'Qobuz';
    if (/deezer\.com\//i.test(url || '')) return 'Deezer';
    if (/(?:music|itunes)\.apple\.com\//i.test(url || '')) return 'Apple';   // #435; iTunes URLs #436
    if (/metal-archives\.com\//i.test(url || '')) return 'Metal Archives';   // #453
    return 'Discogs';
}

/** #428: synthesized per-credit resource_urls — resolution/cache KEYS with no real page
 *  behind them (Tidal exposes no label/publisher URLs, so tidalCompany/tidalPublisherRole
 *  mint `tidal.com/_company/…` / `tidal.com/_publisher/…`). Never link-UI material:
 *  no add-link chip, no link count, no clickable badge, never seeded into MB. */
export const isSyntheticProviderUrl = url => /tidal\.com\/_(?:publisher|company)\//i.test(String(url || ''));

/** MB URL-relationship link-type id to seed when adding this external URL
 *  to an MB entity. Discogs pages have dedicated types per entity; a Tidal
 *  artist page is a "streaming page" (978). Returns null when there is no
 *  sensible type (e.g. Tidal URL on a label) — callers then omit the URL. */
export function sourceUrlLinkTypeId(url, entityType) {
    if (isSyntheticProviderUrl(url)) return null;   // #428 — not a real page
    const src = sourceNameForUrl(url);
    if (src === 'Tidal') return entityType === 'artist' ? '978' : null;
    if (src === 'Qobuz') return entityType === 'artist' ? '978' : null;   // #353 Qobuz artist page = "streaming" (978), same as Tidal
    if (src === 'Metal Archives') return entityType === 'artist' ? '188' : null;   // #453 artist → "has a page in a database at" (other databases); seeds the MA URL on create
    return entityType === 'label' ? '217' : entityType === 'place' ? '705' : '180';
}
