# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Build

`string_theory.user.js` is **generated**, not hand-written; never edit it. The members are listed in [`members.txt`](./members.txt). Every member is a self-contained IIFE. The build ([`build.mjs`](./build.mjs)) unions the metadata blocks and concatenates the bodies, each wrapped in two gates:

- **URL gate**: the script's own `@match` / `@include` / `@exclude` / `@noframes`, tested against the page once at load, as a userscript manager does. A script starts only where its standalone copy would, though the bundle's `@match` covers every script's pages.
- **`@run-at` gate**: `document-start` bodies run immediately; `document-end`/idle bodies wait for `DOMContentLoaded`.

```sh
node userscripts/string_theory/build.mjs
```

The pre-commit hook rebuilds it whenever a member (or this folder's `build.mjs` / `icon.svg`) is committed, so the bundle never ships stale. Its `@version` is a build stamp (`YYYY.M.D.HHMMSS`), so every rebuild ships as a newer version. The build also writes [`DOCS.md`](./DOCS.md) from the members' READMEs.

## Metadata

`@icon`, `@run-at` and single-valued metadata are the bundle's own; multi-valued ones (`@match`, `@grant`, `@connect`, `@require`, `@resource`) are the union of all members.

## Runtime

- The scripts left out of a page by their own `@match` are named in the console at the *debug* level: `String Theory: not for this page (their own @match) — …`.
- The on/off list is the GM value `string_theory.off` (folder names). The build wraps each body in a check against it and adds the menu, which goes only in the top frame.
- The launchers' layout is `mbu.cornerFlow` in MusicBrainz's `localStorage`, read by every script's `mbRestackCorner` ([shared storage](../../DEVELOP.md#shared-storage)).
- All members share **one** userscript-manager storage namespace (one each when installed separately). Each script prefixes its keys, but it's a shared surface.
