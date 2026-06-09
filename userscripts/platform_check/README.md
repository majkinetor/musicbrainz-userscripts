# Platform check <img src="icon.svg" align="left" width="48">

Find URLs for a particular MusicBrainz release on online platforms, verify track counts, surface label / year / format alongside.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/platform_check/platform_check.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/platform_check/platform_check.user.js)

<img width="200" src="./screenshots/dashboard-2-rows.png" /><img width="200" src="./screenshots/dashboard-1-row-no-names.png" />

## Overview

The userscript runs on `musicbrainz.org/release/*` and tries to locate each release on a supported set of platforms. When the release already has a platform URL in MB's URL relationships it is used directly. Otherwise, it falls back to a chain of sources — platform APIs, Wikidata, then generic web search — and verifies each candidate by track-count and title-similarity match against MB's data.

Once a URL is settled, the script fetches the platform's metadata (track count, year, label, format where available) and shows it alongside the MB-side numbers so you can see at a glance whether a candidate looks right. Results are cached per release so revisiting a page does no outbound traffic until you click ↻.

**Barcode (UPC) matching.** When the MB release has a barcode (read from the release page, with the MB API as a fallback), providers that support a barcode lookup try it **first** for an exact match before any text search — currently **Deezer** (`api.deezer.com/album/upc:`), **Apple** (`itunes.apple.com/lookup?upc=`) and **Volumo** (`/album_by_icpn`). This avoids the ambiguity of title/artist search when a barcode is available.

Link availability is determined by the icon and text color:

1. Color - link is found
1. Gray - link is found but details do not match
1. Faded - link is not found
1. Circled - link exists in MB relationships

Mouse click works as follows:

1. **Left click**<br>
    1. Title - Open link if found, open search for provider if not found (use [↗] button in the footer to open all)
    1. Icon - Add link to the MB relationships (use [+] button in the footer to add all)
1. **Right click**<br>
    1. Title - Open search for provider

## Supported platforms

|  Platform   |                    Search source                    |          Track verify          | Wikidata cross-ref |
| ----------- | --------------------------------------------------- | ------------------------------ | ------------------ |
| Discogs     | Discogs API (`api.discogs.com/database/search`)     | Discogs API release detail     | —                  |
| Bandcamp    | Bandcamp's own search → DDG / Brave fallback        | JSON-LD on the album page      | —                  |
| Spotify     | DuckDuckGo / Brave (`site:open.spotify.com/album/`) | `/embed/album/<id>` HTML parse | P2205              |
| Apple Music | iTunes Search API (`itunes.apple.com/search`)       | iTunes Lookup API              | P5121              |
| Deezer      | Deezer API (`api.deezer.com/search/album`)          | Deezer API album detail        | —                  |
| Tidal       | Tidal API (`openapi.tidal.com` searchResults)       | Tidal API album detail         | P4577              |
| Beatport    | Wikidata → DDG / Brave (`site:beatport.com/release/`) | — (unverifiable, see below)  | P11312             |
| Volumo      | **barcode** (`/album_by_icpn`) → Volumo API search  | Volumo API album detail        | —                  |

Discogs has few specifics:

1. It is **format-aware** — for example, when MB release format has type CD, the first attempt tries to find CD release on Discogs, so a vinyl Discogs entry doesn't shadow an existing CD one; if that returns nothing, the script retries without the format filter.
1. It checks if any master release on Discogs is present as link on MB's release group.

Tidal and Beatport specifics:

1. **Tidal** uses the official API with a baked-in client-credentials app token (catalog access, **no user login**). Track count, year and label are verified like the other API providers.
1. **Beatport** is **Cloudflare-walled**, so its pages can't be fetched to verify a track count. It resolves via an existing MB relationship, Wikidata (P11312), or a web-search hit (best slug-vs-title match) — but a search-found link is surfaced as an **unverified** match (`?`), and unverified rows are excluded from the `+` insert and `↗` open-all actions.
1. **Volumo** has a clean, unauthenticated JSON API (no Cloudflare/token). It resolves by the MB rel, then the release **barcode** (exact), then artist+album search, with the track count verified from the album. (ISRC Scout can import a Volumo release's ISRCs from the link this finds.)



## Features

- Info about MB's release year, format and label and track number in the header
- **Insert links to release**: opens *edit* page of the release and inserts one or more links:
    - `+` click - batch insert all links that have `✓` marker
    - `✓`click - insert only particular link next to the marker
    - On the edit page it fills the **edit note** (script name/version + the links added) and shows a small confirmation next to the *External links* heading — then you review and click **Enter edit**.
- **Open all found** (`↗`): opens each **confirmed** (`✓`) platform page that isn't already in MB in its own new tab (plus the Discogs master if not yet added). Track-count mismatches (`~`) and unverifiable links (`?`, e.g. Beatport) are skipped — same bar as the `+` insert. **NOTE**: Watch for browser blocking multiple pop-ups!
- **Options**:
    - Toggle usage of each supported platform independently
    - Reorder providers
- **Refresh** (`↻`): clears the cache for the current release and re-runs every enabled scanner.
- **Diagnostic log (`ⓘ`)**: every step of every scanner is logged with per-source filter chips so you can isolate a single platform's chain.
