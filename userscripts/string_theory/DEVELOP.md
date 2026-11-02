# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Build

`string_theory.user.js` is **generated**, not hand-written; never edit it. The members are listed in [`members.txt`](./members.txt). Every member is a self-contained IIFE. The build ([`build.mjs`](./build.mjs)) unions the metadata blocks and concatenates the bodies, each wrapped in two gates:

- **URL gate**: the script's own `@match` / `@include` / `@exclude` / `@noframes`, tested against the page once at load, as a userscript manager does. A script starts only where its standalone copy would, though the bundle's `@match` covers every script's pages.
- **`@run-at` gate**: `document-start` bodies run immediately; `document-end`/idle bodies wait for `DOMContentLoaded`.

**Shared blocks are written once** ([#786](https://github.com/majkinetor/musicbrainz-userscripts/issues/786)). Every member carries its own copy of the [shared blocks](../../DEVELOP.md#shared-blocks) (`// <ST-UI>` …), which was about 1 MB of repeats. [`share.mjs`](./share.mjs) puts each block once at the top of the bundle, as a function that takes `GM_info` and returns the block's names, and gives each member one line in its place, at the start of the function the block was in:

```js
var { mbuToast, mbuLog, … } = __st_UI(GM_info);
```

Each member still gets its own instance: ST-UI reads the member's `GM_info` (help links, log title, edit-note signature) and keeps per-member state, such as the active log window. The build stops when a block isn't self-contained: when it uses one of the member's own names, when the member assigns one of the block's names, or when a name is declared both in the block and around it. A block that uses another block's names gets them as parameters. The standalone scripts keep their inline copies.

```sh
node userscripts/string_theory/build.mjs
```

The pre-commit hook rebuilds it whenever a member (or this folder's `build.mjs` / `share.mjs` / `icon.svg`) is committed, so the bundle never ships stale. Its `@version` is a build stamp (`YYYY.M.D.HHMMSS`), so every rebuild ships as a newer version. The build also writes [`DOCS.md`](./DOCS.md) from the members' READMEs.

## Metadata

`@icon`, `@run-at` and single-valued metadata are the bundle's own; multi-valued ones (`@match`, `@grant`, `@connect`, `@require`, `@resource`) are the union of all members.

## Runtime

- The scripts left out of a page by their own `@match` are named in the console at the *debug* level: `String Theory: not for this page (their own @match) — …`.
- A page Event Horizon shows inside the tab (`<html data-mbu-page>`, [its DEVELOP.md](../event_horizon/DEVELOP.md#the-page-shown)) can be one a member is for while the page the tab loaded wasn't, so a manager never starts it ([#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)). A member that follows Event Horizon's page and reads nothing off MusicBrainz's (`FOLLOWS_EH` in `build.mjs`: Art Station, Platform Check, ISRC Scout, Mission Control) starts there, once, the first time such a page shows (`__stLater`). Any other member would read the page the tab loaded, so it stays off. Falcon matches every page, so it runs anyway, and it puts up its icon when `data-mbu-page` changes.
- The command palette is [`palette.js`](./palette.js), written into the bundle after [`settings.js`](./settings.js), in the same scope. Its setting, pins and recent commands are the GM value `string_theory.palette` (`{ on, key: { ctrl, alt, shift, meta, key }, pins, recent, last }`, each command by its id, `last` the text left in the box). The hotkey listens on `window` in the capture phase, top frame only; the `mbu-st-palette` event opens it too. A theme command previews with `__stTheme.preview()`, which saves nothing.
- The on/off list is the GM value `string_theory.off` (folder names). The build wraps each body in a check against it and adds the menu, which goes only in the top frame.
- The launchers' layout is `mbu.cornerFlow` (column or row) and `mbu.cornerSide` (right or left) in MusicBrainz's `localStorage`, read by every script's `mbRestackCorner` ([shared storage](../../DEVELOP.md#shared-storage)).
- All members share **one** userscript-manager storage namespace (one each when installed separately). Each script prefixes its keys, but it's a shared surface.

## External storage

[`sync.js`](sync.js) implements Dropbox connection, scheduling and its revision-checked snapshot file, `/string-theory.json`, inside the registered app folder. The app key is public; the flow uses S256 PKCE with an out-of-band authorization code and offline access. No client secret or redirect registration is needed. The app needs `account_info.read`, `files.metadata.read`, `files.content.read` and `files.content.write`. Dropbox's [App Console](https://www.dropbox.com/developers/apps) controls the app's development/production status and user limit.

[`providers.js`](providers.js) is a vendored browser bundle of `@usync/drive` and `@usync/oauth2`, pinned in [`package.json`](package.json), with their licenses. All standard providers are included; the settings currently expose Dropbox. Rebuild after a library update with `pnpm --dir userscripts/string_theory install` and `node userscripts/string_theory/build-providers.mjs`, then rebuild String Theory normally. The ordinary bundle build reads the committed provider file, so it needs no additional dependency installation. The provider code's fetch is scoped to `stSyncFetch`, which uses anonymous GM requests; currently only Dropbox API hosts are allowed. Dropbox's standard provider put overwrites: the adapter instead uses its authenticated request layer with an exact downloaded revision and an upload `update` precondition (`add` for a missing file), retrying conflicts after another read.

[`sync-policy.js`](sync-policy.js) is the exclusion list, applied on export and import, including nested fields in JSON strings. All other GM values in the bundle are included, credentials too. Only suite-owned localStorage namespaces qualify; values stay partitioned by MusicBrainz origin. IndexedDB and sessionStorage contain caches and transient state and are excluded. Add an exclusion here whenever a script gains device state, a cache or temporary workflow data. A cache's settings, such as `ii:match_cache_days`, remain portable.

[`sync-data.js`](sync-data.js) validates version 1 JSON snapshots and merges against the last successful remote baseline. Objects merge by field; ordered arrays remain atomic. EH stars merge by entity key, so removal on one device and addition on another both survive. The chosen conflict policy resolves same-field changes; first sync unions saved items. [`sync-storage.js`](sync-storage.js) preserves excluded local fields when applying portable data. The bundle gives each member a GM read/write guard which merges against the value that member read, preserving independent changes from other tabs.

Downloads are staged, never applied over a running editor. On the next MusicBrainz page load, pending changes merge with edits made since staging and apply before themes and members initialize. Another origin's localStorage remains in the snapshot until a page on that origin handles it. A recovery copy is retained before staging. The local bookkeeping keys are `string_theory.sync.state`, `.base`, `.stage` and `.recovery`; `.auth` and `.settings` are portable. Connection credentials are committed locally only after authorization and account lookup succeed. A different Dropbox account resets the old baseline. Web Locks coordinates tabs on the same origin; Dropbox's revision preconditions protect concurrent origins and devices. Failures retain local data and baseline and retry with backoff; automatic sync is off initially.

The behavioural checks are [`test/885-sync.spec.mjs`](test/885-sync.spec.mjs) and [`test/885-sync-browser.spec.mjs`](test/885-sync-browser.spec.mjs).
