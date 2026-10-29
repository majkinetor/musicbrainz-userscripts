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
- A page Event Horizon shows inside the tab (`<html data-mbu-page>`, [its DEVELOP.md](../event_horizon/DEVELOP.md#the-page-shown)) can be one a member is for while the page the tab loaded wasn't, so a manager never starts it ([#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)). A member that follows Event Horizon's page and reads nothing off MusicBrainz's (`FOLLOWS_EH` in `build.mjs`: Platform Check, ISRC Scout) starts there, once, the first time such a page shows (`__stLater`). Any other member would read the page the tab loaded, so it stays off. Mission Control reads its tracklist off that page. Falcon matches every page, so it runs anyway, and it puts up its icon when `data-mbu-page` changes.
- The on/off list is the GM value `string_theory.off` (folder names). The build wraps each body in a check against it and adds the menu, which goes only in the top frame.
- The launchers' layout is `mbu.cornerFlow` (column or row) and `mbu.cornerSide` (right or left) in MusicBrainz's `localStorage`, read by every script's `mbRestackCorner` ([shared storage](../../DEVELOP.md#shared-storage)).
- All members share **one** userscript-manager storage namespace (one each when installed separately). Each script prefixes its keys, but it's a shared surface.
