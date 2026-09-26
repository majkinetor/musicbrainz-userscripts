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
- **Tests** run under the repo's shared runner: `pnpm test --project=credit_hoarder` from the root ([dev/test](../../dev/test/README.md)). They drive a real browser with the logged-in profile and never submit.

## How it works

- **Sources** are interchangeable: each module in `sources/` harvests credits into one shape, and `sources/registry.js` turns a credited entity's URL into a cache key and the URL to look up in MusicBrainz. An entity without a URL is matched by name and reviewed.
- **Roles** have one vocabulary: `data/entity-map.js` and `data/instruments.js`, keyed by Discogs role names. Tidal, Qobuz and Apple translate their role names into those keys first, so one map entry fixes every source. An unmapped role drops the credit before preflight.
- **Tidal and Metal Archives** are read in a background tab (a real browser gets past their front doors). The credits come back through the userscript manager's storage (`GM_setValue` plus a value-change listener), which crosses origins; a `BroadcastChannel` wouldn't. On MusicBrainz itself, a `BroadcastChannel` tells the review table when an entity created in another tab is saved.
- **Matching** is shared with Apollo and Group Therapy through `dev/match/artist-match.mjs`, which esbuild imports directly.
- **The cache** (IndexedDB) maps a source URL, or a release plus a name for name-only credits, to an MBID, with how it was matched.
- **Requests** to MusicBrainz share one throttle; on a 429 or 503 every worker waits out the `Retry-After`.
- **Writing** goes through `MB.relationshipEditor` on the page's real `window` (`unsafeWindow`), the same state the editor's own dialogs use, so nothing is submitted until you enter the edit.

Credit Hoarder began as the [Discogs Importer](../discogs_credits/README.md), itself built on userscripts by *mattgoldspink*, *vzell* and *kellnerd*.
