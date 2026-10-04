# Developing Credit Hoarder

For contributors. Users install from the [README](./README.md). Repo-wide setup (tools, branching, releases, the bot account) is in the root [DEVELOP.md](../../DEVELOP.md).

Credit Hoarder is the one script here built from modules: `src/` is bundled by esbuild into `dist/credit_hoarder.user.js`, the file people install.

```sh
cd userscripts/credit_hoarder
pnpm install          # once
pnpm run dev          # rebuild on every save and serve it for a live install
pnpm run verify       # lint + build + syntax check, before calling a change done
```

## Layout

```
src/
  meta.txt                 the ==UserScript== block (its @version is stamped by the build)
  credit_hoarder.user.js   the entry module
  ui-bar.js                the import bar, the source picker, the log
  preflight.js             resolving credited entities to MusicBrainz
  review-table.js          the review table
  dispatch.js              Instant Fill: writing relationships through MB's editor state
  consolidate.js           ⚛ All: merging several sources' credits
  sources/                 one module per provider, plus registry.js (source URL → cache key)
  data/                    role and instrument maps, special-purpose artists
  derive/                  credits read from the release itself (remix.js: the Titles source)
dist/credit_hoarder.user.js   the build — committed; the pre-commit hook rebuilds it
build.mjs                  esbuild, with --watch and --serve
test/                      tests (see below)
```

## The dev loop

`pnpm run dev` rebuilds on every save and serves the script at `http://127.0.0.1:8765/credit_hoarder.user.js`, with `@version` stamped to the build time and the update URLs pointing at localhost:

- **Tampermonkey**: open that URL once to install, then set the script's *Check for updates* to 0 days; every page load picks up the latest build.
- **Violentmonkey** has no per-page-load update, so bookmark the URL and click it after a save: it offers the update in one click.

`pnpm run watch` rebuilds without serving; `pnpm run build` builds once. Ctrl-C stops the server; the installed copy keeps working.

## Gates

- **`pnpm run verify`**: ESLint (`eslint.config.mjs`), the build, and `node --check` on the bundle. The pre-commit hook runs the lint on any commit touching `src/`.
- **Tests** run under the repo's shared runner: `pnpm test --project=credit_hoarder` from the root ([dev/test](../../dev/test/README.md)). They drive a real browser with the logged-in profile and never submit. `test/fixtures.spec.mjs` imports each release in `test/fixtures.json` on test.musicbrainz.org and checks the staged relationships against the source and MusicBrainz's own rules (`test/lib/verify.js`). `node dev/test/copy-to-sandbox.mjs <mbid>` copies a production release to the sandbox for a new fixture; fixtures tagged `debug` reproduce bug reports and run only with `CH_DEBUG=1`.

## How it works

- **Sources** are interchangeable: each module in `sources/` harvests credits into one shape, and `sources/registry.js` turns a credited entity's URL into a cache key and the URL to look up in MusicBrainz. An entity without a URL is matched by name and reviewed.
- **Roles** have one vocabulary: `data/entity-map.js` and `data/instruments.js`, keyed by Discogs role names. Tidal, Qobuz and Apple translate their role names into those keys first, so one map entry fixes every source. An unmapped role drops the credit before preflight.
- **Tidal and Metal Archives** are read in a background tab (a real browser gets past their front doors). The credits come back through the userscript manager's storage (`GM_setValue` plus a value-change listener), which crosses origins; a `BroadcastChannel` wouldn't. On MusicBrainz itself, a `BroadcastChannel` tells the review table when an entity created in another tab is saved.
- **Matching** is shared with Apollo and Group Therapy through `dev/match/artist-match.mjs`, which esbuild imports directly.
- **The cache** (IndexedDB) maps a source URL, or a release plus a name for name-only credits, to an MBID, with how it was matched.
- **Requests** to MusicBrainz share one throttle; on a 429 or 503 every worker waits out the `Retry-After`.
- **Writing** goes through `MB.relationshipEditor` on the page's real `window` (`unsafeWindow`), the same state the editor's own dialogs use, so nothing is submitted until you enter the edit.

Credit Hoarder began as the [Discogs Importer](../discogs_credits/README.md), itself built on userscripts by *mattgoldspink*, *vzell* and *kellnerd*.

## Source APIs

Per-track credit providers, researched live. Credits are names-only unless an artist id is noted; `Copyright Control` is a placeholder publisher — drop it. Each `sources/` module translates its role names into Discogs keys before `data/entity-map.js`. A userscript fetches in-browser where it runs, so Cloudflare- or bot-blocked sources (AllMusic, Genius, Apple) work there even when a server IP is blocked.

**Which sources expose roled credits** (performer + instrument, producer, writer, engineer) without a login:

| Source      | Credits                                                                                                              | State                      |         |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------- |
| Tidal       | full, **with stable artist ids**                                                                                     | wired                      |         |
| Qobuz       | store page, names only (API needs login)                                                                             | wired                      |         |
| Deezer      | `track/<id>.contributors` → only `{name, role: Main\                                                                 | Featured}`                 | useless |
| Apple Music | public catalog API exposes only `composerName`; full Credits panel is a private endpoint                             | —                          |         |
| Spotify     | only via the unofficial rotating-bearer `spclient` endpoint                                                          | fragile                    |         |
| Bandcamp    | free-text `credits` blob, unstructured                                                                               | note only                  |         |
| AllMusic    | richest open credits on public HTML; no API, no ISRC index (match by artist+album); Cloudflare-walled                | recommended next           |         |
| Genius      | `producer_artists` / `writer_artists` / `custom_performances` in page state, song-keyed; best for modern pop/hip-hop | recommended after AllMusic |         |

**Tidal** — `https://tidal.com/album/<albumId>/credits` is a SPA (empty raw HTML); it fires `GET https://tidal.com/v1/albums/<albumId>/items/credits?replace=true&includeContributors=true&offset=0&limit=100&countryCode=…` same-origin with the page's anon web token — no login wall for logged-out visitors. Not `openapi.tidal.com` (its catalog token returns empty / 401 for credits). Each credit carries a stable Tidal artist id via `href="/artist/<id>"` → exact MB resolution against the artist's Tidal URL rel (the Discogs-Importer advantage). Roles seen: Producer, Composer, Lyricist, Music Publisher; `Copyright Control` = artist `15780` (drop). DOM fallback: `[data-test="album-info-item"]` per track, `[class*="_creditsCell"]` → `[data-uppercase]` role + `[data-test="grid-item-detail-text-title-artist"]` anchors. Read in a background tab and relayed to MB via a GM-storage cross-tab handshake — `GM_xmlhttpRequest` from MB can't (raw HTML empty, cross-origin token).

**Qobuz** — the store page `www.qobuz.com/<locale>/album/<slug>/<id>` server-renders per-track credits in `<p class="track__info">` (`Name, Role[, Role] - Name, Role`), names only. **Index by the `id="popinAddToCartBtnPlayerTrack<N>"` marker, never element order** — the page emits empty duplicate `track__info` elements (32 for a 16-track album), which seeded credits onto the wrong tracks. A wrong-slug `/album/x/<id>` 301s to canonical; **`open.qobuz.com` is a ~717-byte SPA shell — never fetch it**. Qobuz 429s hard — honour `Retry-After`; it stores barcodes as the 13-digit EAN with a leading zero (zero-pad for `album/search`). The API's search is anon (`album/search`, `catalog/search`, `getFeatured`; app_id `712109809`) but `album/get` needs a login. Platform Check owns that login (⚙ Setup → Auth; email + MD5(pass) + app_id → `user_auth_token`, stored as the token only in shared `mbtools:qobuz` localStorage); Credit Hoarder, ISRC Scout and PC read the token. Authenticated `album/get` per-track fields: `isrc`, `track_number`, `media_number`, `duration` (**seconds**), a flat `performers` string, plus structured `composer:{name,id}` and `performer:{name,id}` — the only credits with an artist id.

**YouTube Music** — ⋮ → Credits is anonymous (no key): `POST music.youtube.com/youtubei/v1/browse` with `{context:{client:{clientName:'WEB_REMIX',clientVersion:'1.20250101.01.00',hl:'en',gl:'US'}}, browseId:'MPTC'+videoId}`. Sections: Performed by / Written by / Produced by / Music metadata provided by (≈ label); names only. Only `MUSIC_VIDEO_TYPE_ATV` (song) ids have credits — album pages (`MPREb_`) often link OMV videos (empty dialog); get the ATV ids from the album playlist page (`browse VL<OLAK5uy_…>`). Some labels send none. Platform Check holds the helpers: `ytmCall`, `ytmSongIds`, `ytmCreditSections`, `ytmAlbumLabel`.

**Canonical MB Qobuz URL forms** (verified against ~48K live links — the release is the odd one out): **release** `https://www.qobuz.com/<locale>/album/<slug>/<id>` (www + slug **required**; `open.qobuz.com/album` is rejected); **recording** `https://open.qobuz.com/track/<id>` (id-only, 98% of live links); **artist** `https://open.qobuz.com/artist/<id>`. MB's URLCleanup source lists only album/interpreter/label yet accepts the open track/artist forms as generic rels en masse — trust live data over it. MB rel hrefs are **protocol-relative** (`//tidal.com/…`), so parsers must accept `(?:https?:)?//` and absolutize.
