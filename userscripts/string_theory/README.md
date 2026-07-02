# String Theory <img src="./icon.svg" align="left" width="46" height="46">

One userscript to install them all. **String Theory** is a build-time bundle of most of this repo's MusicBrainz userscripts, so you can install a **single file** and get them together instead of adding each one separately.

- Install: [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/string_theory/string_theory.user.js) or [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/string_theory/string_theory.user.js)

> [!IMPORTANT]
> Install String Theory **instead of** the individual scripts it contains — never both, or each would run twice on the pages they share.

## What's included

The bundled scripts are listed in [`members.txt`](./members.txt), one folder per line — edit that file to add or remove one, then rebuild. Currently everything in the repo **except** the [Art Station picker](../art_station/as_picker) helper, [Scribe](../scribe), and `discogs_credits` (the parallel twin of Credit Hoarder, which would double-run):

| Script | What it does |
| --- | --- |
| [Apollo Editor](../apollo_editor) | Per-track artist-credit resolution in the release editor |
| [Art Station](../art_station) | Cover/event-art gallery editor |
| [Credit Hoarder](../credit_hoarder) | Import per-track credits from Discogs / Tidal / Qobuz |
| [Group Therapy](../group_therapy) | Relationship-editor batch/copy helpers |
| [ISRC Scout](../isrc_scout) | Fill in missing ISRCs and streaming links |
| [Mammoth](../mammoth) | Remember & recall edit notes and field values |
| [Platform Check](../platform_check) | Find/verify a release's URLs on online platforms |

Each retains its own settings and behaviour — String Theory just ships them in one file.

## How it's built

`string_theory.user.js` is **generated**, not hand-written — do not edit it directly. It works because every constituent is a self-contained IIFE that guards its own target URL: the build [unions the metadata block](./build.mjs) (`@match` / `@grant` / `@connect` / … deduped) and concatenates each body wrapped in a `@run-at` gate (`document-start` bodies run immediately; `document-end`/idle bodies wait for `DOMContentLoaded`).

```
node userscripts/string_theory/build.mjs
```

The repo **pre-commit hook** rebuilds it automatically whenever a constituent (or this folder's `build.mjs` / `icon.svg`) is committed, so the bundle never ships stale — the same guarantee as the other built scripts. Its `@version` is a build stamp (`YYYY.M.D.HHMMSS`), so every rebuild ships as a newer version.

## Notes

- All constituents share **one** userscript-manager storage namespace here (vs one each when installed separately). In practice this is fine — each script prefixes its keys — but it's a shared surface.
- `@icon`, `@run-at` and single-valued metadata are the bundle's own; multi-valued ones (`@match`, `@grant`, `@connect`, `@require`, `@resource`) are the union of all members.
