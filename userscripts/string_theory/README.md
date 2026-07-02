# String Theory <img src="./icon.svg" align="left" width="46" height="46">

**String Theory** is a build-time bundle of most of this repo's MusicBrainz userscripts, so you can install a **single userscript** instead of adding each one separately. Each retains its own settings and behaviour.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/string_theory/string_theory.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/string_theory/string_theory.user.js)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=by+majkinetor&conditions.1.field=edit_note_author&conditions.1.operator=%21%3D&conditions.1.name=majkinetor&conditions.1.args.0=1601832&field=Please+choose+a+condition)


> [!IMPORTANT]
> Install String Theory **instead of** the individual scripts it contains — never both, or each would run twice on the pages they share.
>
> Any configuration stored with this script is not visible by the standalone variants and vice versa

## What's included

| Script | What it does |
| --- | --- |
| [Apollo Editor](../apollo_editor) | Per-track artist-credit resolution in the release editor |
| [Art Station](../art_station) | Cover/event-art gallery editor |
| [Credit Hoarder](../credit_hoarder) | Import per-track credits from Discogs / Tidal / Qobuz |
| [Group Therapy](../group_therapy) | Relationship-editor batch/copy helpers |
| [ISRC Scout](../isrc_scout) | Fill in missing ISRCs and streaming links |
| [Mammoth](../mammoth) | Remember & recall edit notes and field values |
| [Platform Check](../platform_check) | Find/verify a release's URLs on online platforms |


The bundled scripts are listed in [`members.txt`](./members.txt).

## How it's built

`string_theory.user.js` is **generated**, not hand-written — do not edit it directly. It works because every constituent is a self-contained IIFE that guards its own target URL: the build [unions the metadata block](./build.mjs) (`@match` / `@grant` / `@connect` / … deduped) and concatenates each body wrapped in a `@run-at` gate (`document-start` bodies run immediately; `document-end`/idle bodies wait for `DOMContentLoaded`).

```
node userscripts/string_theory/build.mjs
```

The repo **pre-commit hook** rebuilds it automatically whenever a constituent (or this folder's `build.mjs` / `icon.svg`) is committed, so the bundle never ships stale — the same guarantee as the other built scripts. Its `@version` is a build stamp (`YYYY.M.D.HHMMSS`), so every rebuild ships as a newer version.

## Notes

- All constituents share **one** userscript-manager storage namespace here (vs one each when installed separately). In practice this is fine — each script prefixes its keys — but it's a shared surface.
- `@icon`, `@run-at` and single-valued metadata are the bundle's own; multi-valued ones (`@match`, `@grant`, `@connect`, `@require`, `@resource`) are the union of all members.
