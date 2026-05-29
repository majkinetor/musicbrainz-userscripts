# Platform check

Find URLs for a particular MusicBrainz release on online platforms, verify track counts, surface label / year / format alongside.

## Overview

The userscript runs on `musicbrainz.org/release/*` and tries to locate each release on a fixed set of platforms. When the release already has a platform URL in MB's url-relationships, that URL is used directly. Otherwise the script falls back to a chain of sources — platform APIs, Wikidata, then generic web search — and verifies each candidate by track-count and title-similarity match against MB's data.

Once a URL is settled, the script fetches the platform's metadata (track count, year, label, format where available) and shows it alongside the MB-side numbers so you can see at a glance whether a candidate looks right. Results are cached per release so revisiting a page does no outbound traffic until you click ↻.

## Supported platforms

| Platform | Search source | Track verify | Wikidata cross-ref |
| --- | --- | --- | --- |
| Spotify     | DuckDuckGo / Brave (`site:open.spotify.com/album/`) | `/embed/album/<id>` HTML parse | P2205 |
| Apple Music | iTunes Search API (`itunes.apple.com/search`)       | iTunes Lookup API              | P5121 |
| Discogs     | Discogs API (`api.discogs.com/database/search`)     | Discogs API release detail     | —     |
| Bandcamp    | Bandcamp's own search → DDG / Brave fallback        | JSON-LD on the album page      | —     |
| Deezer      | Deezer API (`api.deezer.com/search/album`)          | Deezer API album detail        | —     |

Discogs search is **format-aware** — when MB says CD, the first attempt narrows to `&format=CD` so a vinyl Discogs entry doesn't shadow an existing CD one; if that returns nothing, the script retries without the format filter.

For Various-Artists compilations the artist term is dropped from the search query (Spotify / Apple / Bandcamp / Deezer / Discogs don't credit compilations to a literal "Various Artists" string — they go under the label).

## Options

- **Toggle providers**: each platform can be turned off independently.
- **Reorder providers**: ↑ / ↓ in the providers panel persists a custom order.
- **Refresh** (`↻`): clears the cache for the current release and re-runs every enabled scanner.
- **Inject (`+`)**: queues every verified URL not already in MB rels and opens `/release/<mbid>/edit`. The companion handler on the edit page types each URL into the "Add another link" field; MB auto-detects the link type from the URL pattern.
- **Diagnostic log (`ⓘ`)**: every step of every scanner is logged with per-source filter chips so you can isolate a single platform's chain.
