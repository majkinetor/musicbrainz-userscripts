# Platform check <img src="icon.svg" align="left" width="48">

Find URLs for a particular MusicBrainz release on online platforms, verify track counts, surface label / year / format alongside.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/platform_check/platform_check.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/platform_check/platform_check.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Platform+Check)

<img width="200" src="./screenshots/dashboard-2-rows.png" /><img width="200" src="./screenshots/dashboard-1-row-no-names.png" /><img width="200" src="./screenshots/dashboard-1-row-compact.png" />

## Features

- **Multiple [platforms](#platforms)** supported with customizable position and visibility
- **Header info** — MB's release year, format, label and track count in the dashboard header
- **Insert links to release** — open the release's edit page and insert one or all confirmed platform links
- **Open all found** — open each confirmed platform page not yet in MB in its own tab (plus the Discogs master) Mismatches and unverifiable links are skipped. *(Watch for pop-up blocking.)*
- **Options** — detailed appearance, authentication, link confidence settings etc.
- **Diagnostic log** — per-source filter chips to isolate a single platform's chain

## Overview

The userscript runs on `musicbrainz.org/release/*` and tries to locate each release on a supported set of [platforms](#platforms). When the release already has a platform URL in MB's URL relationships it is used directly. Otherwise, it falls back to a chain of sources — platform APIs, Wikidata, then generic web search.

Once a URL is settled, the script fetches the platform's metadata (track count, year, label, format where available) and shows it alongside the MB-side numbers so you can see at a glance whether a candidate looks right. Results are cached per release so revisiting a page does no outbound traffic until you click ↻. 

Link availability is determined by the icon and text color:

| Color   | Meaning                             |
| ------- | ----------------------------------- |
| Colored | link found                          |
| Gray    | link found but details do not match |
| Faded   | link not found                      |
| Circled | link exists in MB relationships     |

Matched links that are not already associated (colored & not circled) can be **inserted to the release** (or release group with Discogs) by opening its *edit* page and populating one or more links:

1. **Left click**<br>
    1. Title - Open link if found, open search for provider if not found (use [↗] button in the footer to open all)
    2. Icon - Add link to the MB relationships (use [+] button in the footer to add all)
2. **Right click**<br>
    1. Title - Open search for provider

Setup option **Compact unmatched providers** keeps the panel tidy, every provider **starts compact** — a strip of dimmed brand icons at the bottom — and **rises into a full row only when it's a clean match**. Everything else stays in the strip: not-found *and* found-but-mismatched providers (a different barcode/format — a *different release*), the latter keeping a subtle **amber ring** so that "found but wrong" signal isn't lost. Click a strip icon to run that platform's search, exactly like clicking its row. Rows rise with a subtle fade so the panel doesn't jump as results stream in. **Discogs and Bandcamp always keep their full rows** (matched or not), since they carry the format/reference detail.

### Barcode matching

When the MB release has a barcode (read from the release page, with the MB API as a fallback), providers that support a barcode lookup try it **first** for an exact match before any text search.

This avoids the ambiguity of title/artist search when a barcode is available, and prefers the *exact* edition over a Wikidata/search match that may be a different barcode. Platforms index the same GTIN under different zero-paddings (a 12-digit UPC-A, a 13-digit EAN with a leading `0`, a 14-digit form), so when the exact-barcode lookup misses, it is retried with the other paddings (by adding leading zeros which do not change GTIN) before falling back to search (#354). A returned album's own barcode is verified against the query where the API exposes it, since Deezer occasionally hands back an unrelated album for a barcode it doesn't have (#356).

MusicBrainz treats a different barcode as a different release, so a found link with a mismatching barcode is the wrong entity per the [URL style guidelines](https://musicbrainz.org/doc/Style/Relationships/URLs#Which_entity_to_link_to).

Platform Check now (#182):

- Captures the found item's barcode where the provider exposes it and, when it differs from MB's, marks the row with a **subtle amber bar on the left edge** — the barcode itself is shown only in the row tooltip + the diagnostic log.
- Runs **[SAMBL](https://sambl.lioncat6.com)** (`/api/find?query=<UPC>&type=upc`) as a parallel barcode resolver. Its unique contribution here is the exact-barcode **Spotify** album (which has no other unauthenticated UPC route).
- Has a setup option **"Check barcodes for link confidence"**
  - **if they exist** — withhold from `+`/`↗` only links whose barcode is *known and differs*.
  - **strictly** — only add *barcode-confirmed* links, i.e. also withhold links whose barcode can't be checked (Apple/Spotify, which don't expose a UPC).
  - The left-bar indicator shows known mismatches regardless of this setting.
  - A **withheld** link (by either the barcode or format check) is shown **grayed out and non-clickable** — like any other mismatch.

### Format matching

MusicBrainz treats a different format as a different release, so a digital-store link doesn't belong on a CD/Vinyl release per the same [URL guidelines](https://musicbrainz.org/doc/Style/Relationships/URLs#Which_entity_to_link_to). Only **Bandcamp** and **Discogs** expose a real format; every other provider is a digital-only storefront, so an absent format counts as **Digital**. 

Platform Check has a setup option **"Use format for link confidence"** (on by default, in *if they exist* mode) with two modes (#182):

- **if they exist** — withhold from `+`/`↗` only links whose format is *known and incompatible* with the MB release (e.g. a Spotify/Apple/Tidal link on a CD release)
- **strictly** — also withhold links whose format can't be determined
- A **violet bar on the left edge** marks incompatible rows while the option is on (digital-on-physical is common enough to be noise otherwise). Bandcamp/Discogs editions that *include* MB's medium (e.g. Bandcamp "Digital, CD" on a CD release) are compatible and pass.

Each release's format is shown as a compact **4-quadrant circle**: Vinyl (top-right), Cassette (top-left), CD (bottom-left), Digital (bottom-right). The present family/families are coloured and the full format is in the tooltip. Any format collapses to those four (optical discs — DVD/SACD/Blu-ray — fold into CD), and a multi-format Discogs/Bandcamp match becomes one glyph instead of a long text list. Switch to text using **Setup → Appearance → Format marker: Text**.

## Platforms

| Provider                    |  Barcode  | Track count | Wikidata |     Login      |
| --------------------------- | :-------: | :---------: | :------: | :------------: |
| [Discogs](#discogs)         |  capture  |     ✓      |    –     |       –        |
| [Bandcamp](#bandcamp)       |  capture  |     ✓      |    –     |       –        |
| [Spotify](#spotify)         | via SAMBL |     ✓      |  P2205   |       –        |
| [Apple Music](#apple-music) |  lookup   |     ✓      |  P5121   |       –        |
| [Deezer](#deezer)           |  lookup   |     ✓      |    –     |       –        |
| [Tidal](#tidal)             |    ✓     |     ✓      |  P4577   | baked-in token |
| [Qobuz](#qobuz)             |    ✓     |     ✓      |    –     |   optional¹    |
| [Beatport](#beatport)       |     –     |     ✗      |  P11312  |   optional²    |
| [Volumo](#volumo)           |    ✓     |     ✓      |    –     |       –        |
| [HDtracks](#hdtracks)       |    ✓     |     ✓      |    –     |       –        |

**Barcode** legend: `✓` = barcode-first lookup **and** the found item's barcode captured for confidence · `lookup` = barcode-first lookup only (found barcode not exposed) · `capture` = no barcode search, but the found barcode is captured · `via SAMBL` = the barcode-exact album comes from the SAMBL resolver · `–` = neither.

¹ **Qobuz login** (⚙ Setup → Auth) makes verification use `album/get` — reliable track count + **barcode** — instead of the geo-flaky, 429-throttled store-page scrape. The same token is shared with **ISRC Scout** (ISRC import) and **Credit Hoarder** (roled credits). Only the token is stored, never your password. Qobuz is **the one provider that geo-blocks anonymous access** (in some regions even account registration needs a VPN) — but that's *anonymous*-only: once registered and signed in, the token works from your normal connection, region regardless.

² **Beatport login** (⚙ Setup → Auth) enables verified Beatport matching (and the `+` insert), and lets ISRC Scout import Beatport ISRCs.

## Provider details

Each provider is resolved by a **method** chain, tried in order: the existing **MB** URL relationship → an exact **barcode** lookup → the provider's **local search** (LS — its API/site search) → a generic **global search** (GS — DuckDuckGo / Brave with a `site:` query).

### Discogs

- **API** — `api.discogs.com`
    - Search: `/database/search?q=`
    - Album: `/releases/<id>` (track count)
    - Barcode: `/database/search?barcode=<UPC>` (barcode-first); found barcode captured from the release's `identifiers`
- **Local search:** Discogs API search
- **Global search:** —
- **Track verify:** Discogs API release detail
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → barcode → LS
- **Notes:**
    - **Format-aware** — when MB's format is CD, the first attempt looks for a CD release so a vinyl entry can't shadow an existing CD one; if that returns nothing it retries without the format filter.
    - Checks whether any Discogs **master** is already linked on MB's **release group**.
    - Exposes a real **format** and always keeps its full row.

### Bandcamp

- **API** — none (page-scraped)
    - Search: — (uses site search / GS)
    - Album: JSON-LD + `og:description`
    - Barcode: capture-only via `TralbumData.current.upc` (in the `data-tralbum` attribute, not the JSON-LD); no barcode search
- **Local search:** `bandcamp.com/search?q=`
- **Global search:** DuckDuckGo / Brave
- **Track verify:** JSON-LD + `og:description` ("N track album") — see hidden-tracks note
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** LS → GS
- **Notes:**
    - **Hidden tracks (#183)** — bonus tracks can be *download-only* (not in the streaming player). JSON-LD `numTracks` counts only the streamable ones; the `og:description` "N track album" carries the real total. PC reports that true total, logs how many are hidden, and marks the count with a small superscript **ⁿ** (hover for "N download-only track(s) hidden from streaming").
    - **Barcode (#194)** — hand-entered and **often absent** (withheld only in *strict* mode). Per [Harmony](https://github.com/kellnerd/harmony/issues/42) the digital `current.upc` can coincide with a **physical package's** barcode — when it does it's **ignored** (logged), not used.
    - Exposes a real **format** and always keeps its full row.

### Spotify

- **API** — none for catalog (GS + embed)
    - Search: — (no unauthenticated catalog search)
    - Album: `/embed/album/<id>` HTML parse
    - Barcode: no unauthenticated UPC route of its own — the barcode-exact album comes from **SAMBL**
- **Local search:** —
- **Global search:** DuckDuckGo / Brave (`site:open.spotify.com/album/`)
- **Track verify:** `/embed/album/<id>` HTML parse
- **Wikidata cross-ref:** P2205
- **Login:** —
- **Method:** GS (+ SAMBL barcode resolver)
- **Notes:**
    - [SAMBL](https://sambl.lioncat6.com) (`/api/find?query=<UPC>&type=upc`) runs in parallel; its unique contribution is the exact-barcode Spotify album (Spotify has no other unauthenticated UPC route).

### Apple Music

- **API** — iTunes
    - Search: `itunes.apple.com/search?term=`
    - Album: `itunes.apple.com/lookup?id=<ID>`
    - Barcode: `itunes.apple.com/lookup?upc=<UPC>` (barcode-first; retried with other zero-paddings, #354). The found barcode is **not** exposed, so no capture for confidence.
- **Local search:** iTunes Search API
- **Global search:** —
- **Track verify:** iTunes Lookup API
- **Wikidata cross-ref:** P5121
- **Login:** —
- **Method:** barcode → LS
- **Notes:**
    - Digital-only storefront (format counts as Digital).

### Deezer

- **API** — `api.deezer.com`
    - Search: `/search/album?q=`
    - Album: `/album/<id>`
    - Barcode: `/album/upc:<UPC>` (barcode-first; retried with other zero-paddings, #354). The returned album's barcode is verified against the query, since `album/upc:` occasionally hands back an unrelated album (#356).
- **Local search:** Deezer API search
- **Global search:** —
- **Track verify:** Deezer API album detail
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** barcode → LS
- **Notes:**
    - Barcode used for lookup + sanity-check, but the found value isn't surfaced as a dashboard capture.

### Tidal

- **API** — `openapi.tidal.com/v2` (baked-in client-credentials app token — catalog access, **no user login**)
    - Search: `/searchResults`
    - Album: `/albums/<id>` (count / year / label)
    - Barcode: `/albums?filter[barcodeId]=<UPC>` (barcode-first; found barcode captured)
- **Local search:** Tidal API search
- **Global search:** —
- **Track verify:** Tidal API album detail
- **Wikidata cross-ref:** P4577
- **Login:** baked-in app token (no user login)
- **Method:** barcode → LS

### Qobuz

- **API** — catalogue API `api.json/0.2` with the web player's `app_id` (`712109809`)
    - Search: `album/search` (works **anonymously**)
    - Album: `album/get` — track count, year, label, **UPC** — **session-gated** (401/404 anonymously, #353), so login-only
    - Barcode: `album/search?query=<UPC>` (barcode-first, exact; zero-padded too, #354); UPC captured from `album/get`
- **Local search:** Qobuz API search
- **Global search:** DuckDuckGo / Brave (last resort)
- **Track verify:** `album/get` **(login)** → store-page scrape fallback (track count from per-track add-to-cart markers — the page duplicates every track row, so `track__info` blocks can't be counted directly — plus JSON-LD name/year, label link, `og:title` artist). The log names the source: *Verified via API album/get* vs *store page*.
- **Wikidata cross-ref:** —
- **Login:** **optional** — signed in, verification uses `album/get` (reliable count + UPC); the shared token also powers ISRC Scout's Qobuz ISRC import and Credit Hoarder's roled Qobuz credits. Qobuz geo-blocks *anonymous* access only (footnote ¹).
- **Method:** MB → barcode → LS → GS
- **Notes:**
    - Throttles aggressively — the scraper does one `Retry-After` retry and leaves a row retryable rather than caching a false miss.
    - **Format** is absent (digital-only).

### Beatport

- **API** — official **v4** (`api.beatport.com/v4`), login-gated
    - Search: — (site is **Cloudflare-walled**, so pages can't be fetched to verify)
    - Album: — (unverifiable without login)
    - Barcode: –
- **Local search:** —
- **Global search:** DuckDuckGo / Brave (`site:beatport.com/release/`, best slug-vs-title match)
- **Track verify:** **unverifiable** (Cloudflare-walled) — a search-found link is surfaced as an **unverified** match (`?`) and excluded from the `+` insert and `↗` open-all.
- **Wikidata cross-ref:** P11312
- **Login:** **optional** — enables verified matching + the `+` insert, and lets ISRC Scout import Beatport ISRCs.
- **Method:** MB → Wikidata (P11312) → GS
- **Notes:**
    - The one provider that can't self-verify without a login.

### Volumo

- **API** — `volumo.com/api/v1` (clean, unauthenticated JSON — no Cloudflare/token)
    - Search: `/search?query=`
    - Album: `/albums/<id>` (track count)
    - Barcode: `/album_by_icpn/<UPC>` (barcode-first, exact; found barcode captured)
- **Local search:** Volumo API search
- **Global search:** —
- **Track verify:** Volumo API album detail
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → barcode → LS
- **Notes:**
    - MB doesn't auto-classify `volumo.com`, so the `+` insert force-sets the **purchase for download** type.
    - ISRC Scout can import a Volumo release's ISRCs from the link this finds.

### HDtracks

- **API** — high-resolution store API (clean, unauthenticated, CORS-open — no Cloudflare/token)
    - Search: `/albums/search?q=`
    - Album: `/albums/search?q=` (track count from the search result)
    - Barcode: `/albums/search?q=<UPC>` (barcode-first, exact; found barcode captured)
- **Local search:** HDtracks API search
- **Global search:** —
- **Track verify:** HDtracks API album detail
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → barcode → LS
- **Notes:**
    - Canonical URL is `https://www.hdtracks.com/#/album/<id>`; the thousands of legacy MB rels (`valbum_code=<UPC>`, slug-id, artist page) are recoverable by barcode.
    - No dedicated HDtracks link type ([MBS-9023](https://tickets.metabrainz.org/browse/MBS-9023)), so the `+` insert force-sets **purchase for download** (id 74).
    - ISRC Scout can import an HDtracks release's ISRCs from the link this finds.

## Settings

<img width="400" src="./screenshots/config.png" />

## Shortcuts

| Key   | Action                      |
| ----- | --------------------------- |
| `Esc` | Close the open modal/dialog |
