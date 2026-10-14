# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Provider details

Each provider is resolved by a **method** chain, tried in order: the existing **MB** URL relationship → an exact **barcode** lookup → the provider's **local search** (LS — its API/site search) → a generic **global search** (GS — DuckDuckGo / Brave with a `site:` query).

### Discogs

- **API** — `api.discogs.com`
    - Search: `/database/search?q=`
    - Album: `/releases/<id>` (track count)
    - Barcode: `/database/search?barcode=<UPC>` (barcode-first); found barcode captured from the release's `identifiers`
    - Catalog numbers: each label's `catno` from the release detail (`labels[]`); Discogs's `none` and a label's `(2)` suffix dropped
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
    - Barcode: no unauthenticated UPC route of its own — the barcode-exact album comes from **Wallstream**
- **Local search:** —
- **Global search:** DuckDuckGo / Brave (`site:open.spotify.com/album/`)
- **Track verify:** `/embed/album/<id>` HTML parse
- **Wikidata cross-ref:** P2205
- **Login:** —
- **Method:** Wallstream barcode lookup, then Wikidata, then GS
- **Notes:**
    - [Wallstream](https://tools.wallstream.com/isrc-lookup) (`/api/spotify/isrc?q=upc:<barcode>`) proxies Spotify's catalog search. Spotify matches only the barcode exactly as it stored it, leading zeros included, so the MB barcode is tried as-is and then zero-padded to 12, 13 and 14 digits, first hit wins (#602). A miss or error falls through to Wikidata and web search.

### Apple Music

- **API** — Apple Music's own catalogue, `amp-api.music.apple.com/v1`, with the bearer token from the web player's public JS bundle (`music.apple.com/us/browse` → `/assets/index~….js`); the token is kept 12 h in `localStorage` (`mbtools:apple-token`, shared with ISRC Scout and Credit Hoarder), and a 401 fetches a new one, once
    - Search: `catalog/<sf>/search?term=&types=albums`
    - Album: `catalog/<sf>/albums/<id>` (track count is songs only: amp's own `trackCount` counts music videos too)
    - Barcode: `catalog/<sf>/albums?filter[upc]=<UPC>,<other paddings>` (one request per storefront; the album whose UPC it is wins, since amp lists others first too); found barcode captured
    - Fallback, when the token or amp-api fails: iTunes (`itunes.apple.com/search`, `/lookup?id=`, `/lookup?upc=`), which gives no barcode
- **Storefronts:** an album is only in the storefronts it's licensed to. The release's own link's storefront and `us`, `gb`, `de`, `fr`, `jp`, `br`, `au` are read at once; when none has it, every storefront (`storefronts?limit=200`, cached a week as `pc:apple-storefronts`) at once, about a second. The log names the storefront a match came from, and the link keeps it.
- **Local search:** amp-api search
- **Global search:** —
- **Track verify:** amp-api album detail
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

- **API** — catalogue API `www.qobuz.com/api.json/0.2` with the web player's `app_id` (`712109809`)
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
    - Catalog number: `catalog_number` of the release detail, for its `label` (logged in)
    - For First Contact (#745): `pc:beatport-release` `{ id, req }` reads a release and its tracks through the API with the login and answers `pc:beatport-release-result`, when Beatport's page refuses First Contact's headless read (see [First Contact's DEVELOP](../first_contact/DEVELOP.md))
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

- **API** — `hdtracks.azurewebsites.net/api/v1` high-resolution store API (clean, unauthenticated, CORS-open — no Cloudflare/token)
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

### SoundCloud

- **API** — the anonymous `api-v2.soundcloud.com` (public `client_id` lifted from the web-player JS — no login)
    - Resolve: `/resolve?url=<set|track>` → the playlist (track count + track ids) or a single track
    - Tracks: `/tracks?ids=` → each track's `publisher_metadata` (barcode, `p_line` label)
    - Barcode: **link-derived** — read from the linked set/track, not searched (see note)
- **Local search:** `/search/playlists?q=` (title + track-count verified before trusting a set)
- **Global search:** —
- **Track verify:** set/track count vs MB
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → LS
- **Notes:**
    - Unlike every other provider, SoundCloud **can't be searched by barcode** — the release UPC lives per-track inside the set (`publisher_metadata.upc_or_ean`, the same value across the set on distributed releases; self-uploads omit it). So it's link-derived, like Bandcamp's capture: when the release links a SoundCloud set/track, its barcode is read and fed to the barcode-confidence check. Only a barcode the **whole set agrees on** is trusted (a mixed-UPC compilation yields none).
    - Both a **set** (playlist → the album) and a bare **track** URL (a *single-track release*) are recognized; a track resolves to a 1-track release.
    - ISRC Scout imports a SoundCloud set's per-track ISRCs and links from the same set (and the single ISRC/link for a track release).

### YouTube Music

- **API** — `music.youtube.com/youtubei/v1/`, the web player's internal API, anonymous (`client: WEB_REMIX`)
    - Search: `search` with the barcode as plain text, then artist + album with the *Albums* filter
    - Album: `browse` of the album's `MPREb_…` id
    - Barcode: — (the album page shows none; a barcode search can land on a sibling edition)
- **Local search:** `search`, as above
- **Global search:** —
- **Track verify:** `browse` album: every candidate, the barcode's too, must pass track count, title and artist
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → LS
- **Notes:**
    - Never barcode-confirmed, so strict barcode mode withholds it. Its *other versions* are named in the link's tooltip and the log.
    - The label comes from a song's credits (*Music metadata provided by*).
    - An internal API: when it changes, the log says so and the row isn't found.

### Amazon Music

- **API** — `na.mesk.skill.music.a2z.com/api/`, the web player's internal API, as a guest: `music.amazon.com/config.json` hands out a session (CSRF token, device and session id, no login), sent in each request's body as a JSON `headers` string
    - Search: `showSearch`, artist + album
    - Album: `showCatalogAlbum` (song count, title, artist, date, the ℗ line)
    - Barcode: — (no barcode search, none shown)
- **Local search:** `showSearch`
- **Global search:** —
- **Track verify:** `showCatalogAlbum`: song count, title, artist; the release year breaks a tie between editions
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → LS
- **Notes:**
    - The guest catalogue is amazon.com's (US). Never barcode-confirmed. The label is read from the ℗ line.
    - An internal API: when it changes, the log says so and the row isn't found.

### Audiomack

- **API** — `api.audiomack.com/v1`, every call OAuth 1.0a-signed with the web player's public consumer key and secret (`audiomack-web`), no login
    - Search: `search` (text only, no barcode index; hits carry no barcode)
    - Album: `music/<album|song>/<artist>/<slug>` (barcode `upc`, track count, release date, ℗ line)
    - Barcode: read from each plausible hit's album
- **Local search:** `search`, artist + title
- **Global search:** —
- **Track verify:** the album endpoint
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → LS
- **Notes:**
    - Fans re-upload albums, so the hit with the release's barcode wins; otherwise one whose track count matches, and one with no barcode at all never beats one that has it.
    - A song URL is a one-track release. The label comes from the ℗ line.

### 7digital

- **API** — `api.7digital.com/1.2`, with the key the web store ships in its `app.js` (`mbtools:7digital-key` in `localStorage`, shared with ISRC Scout; a refused key, HTTP 401 / error 4001, is replaced from the store's current JS, once)
    - Search: `release/search` — the key may search but not read a release's details; a hit carries barcode, track count, year and label
    - Album: — (the search hit)
    - Barcode: `release/search` with the barcode as text, in every GTIN form (12, 13, 14 digits), since it matches only as 7digital stores it; found barcode captured
- **Local search:** `release/search`, artist + title
- **Global search:** —
- **Track verify:** the search hit's track count
- **Wikidata cross-ref:** —
- **Login:** —
- **Method:** MB → barcode → LS
- **Notes:**
    - The catalogue is per country: GB, then US. The link is to the store the album was found in.

## Artists and labels

MusicBrainz is asked once which of the found links it already has, and on whom, one request per 100 links: when the scans finish, for the count on **Artists & labels**, and the table reuses that answer. With *Count the links to add* off, it is asked only when the table opens. A match cached before the feature existed is read again once, on the next scan of the release.

## Keep background tabs awake

Firefox throttles timers in a background tab to one step per second, and to as much as fifteen once the tab has spent its execution budget; MusicBrainz's submit is a chain of them. A tab that is playing audio is exempt, so the setting plays an inaudible tone: 30 Hz at gain 0.0008. Without *Allow Audio* the log's `keep-awake audio` line reads `state=suspended — BLOCKED by the autoplay policy`; with it, `state=running`.
