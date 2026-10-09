# String Theory <img src="./icon.svg" align="left" width="46" height="46">

**String Theory** is a build-time bundle of most of this repo's MusicBrainz userscripts, so you can install a **single userscript** instead of adding each one separately. Each retains its own settings and behaviour.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/string_theory/string_theory.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/string_theory/string_theory.user.js)
- **[Unified documentation](./DOCS.md)** ([PDF](https://github.com/majkinetor/musicbrainz-userscripts/releases/latest/download/DOCS.pdf), attached to each release) 
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=by+majkinetor&conditions.1.field=edit_note_author&conditions.1.operator=%21%3D&conditions.1.name=majkinetor&conditions.1.args.0=1601832&field=Please+choose+a+condition)

> [!IMPORTANT]
> Install String Theory **instead of** the individual scripts it contains. If both are on, only one copy of a script runs on a page: the one with the higher version. When the older copy happens to start first, it keeps that page and the newer one takes over from the next page load. The running copy notes the other one in its log.
>
> Any configuration stored with this script is not visible by the standalone variants and vice versa

## What's included

| Script | What it does |
| --- | --- |
| [Apollo Editor](../apollo_editor) | Per-track artist-credit resolution in the release editor |
| [Art Station](../art_station) | Cover/event-art gallery editor |
| [Credit Hoarder](../credit_hoarder) | Import credits from multiple sources|
| [Fusion](../fusion) | Merge duplicate recordings: review, auto-match, submit |
| [Group Therapy](../group_therapy) | Relationship-editor batch helpers |
| [ISRC Scout](../isrc_scout) | Fill in missing ISRCs and streaming links |
| [Mammoth](../mammoth) | Remember & recall edit notes and field values |
| [Platform Check](../platform_check) | Find/verify/add a release's URLs on online platforms |

- **Turn a script off** in the userscript manager's menu (the Tampermonkey / Violentmonkey popup): each bundled script has an entry, ☑ on or ☐ off. A click flips it, and the change applies from the next page load. A script that is off doesn't run at all, so its standalone copy, if you have one installed, can run in its place.
- **Lay out the corner launchers** from the same menu: the round buttons in the page's corner (Mission Control, Fusion, Falcon, …) stand in a column (**↕ Launchers in a column**, the default) or in a row along the page's bottom edge (**↔ Launchers in a row**). A click switches the layout at once, and it stays that way on every page. All the scripts share it, so a standalone script (Falcon, Scribe, First Contact) follows it too, on any page, String Theory there or not.
- The bundled scripts are listed in [`members.txt`](./members.txt)
- In edit notes, all userscripts are marked with `*` (e.g. `Apollo Editor*`)

Version details are printed in Console:

```
String Theory  v2026.7.3.140303
String Theory bundles:
  · Apollo Editor v2026.7.2.2
  · Art Station v2026.7.2.1
  · Credit Hoarder v2026.7.2
  · Fusion v2026.7.2
  · Group Therapy v2026.7.2.1
  · ISRC Scout v2026.7.2
  · Mammoth v2026.7.2.6
  · Platform Check v2026.7.1.2
```

## Other recommended userscripts

- [Art Station Picker](https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/art_station/as_picker/README.md)
- [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc)
- [Enhanced Cover Art Uploads](https://github.com/ROpdebee/mb-userscripts#mb-enhanced-cover-art-uploads)

## How it's built

`string_theory.user.js` is **generated**, not hand-written — do not edit it directly. It works because every constituent is a self-contained IIFE that guards its own target URL: the build [unions the metadata block](./build.mjs) (`@match` / `@grant` / `@connect` / … deduped) and concatenates each body wrapped in a `@run-at` gate (`document-start` bodies run immediately; `document-end`/idle bodies wait for `DOMContentLoaded`).

```
node userscripts/string_theory/build.mjs
```

The repo **pre-commit hook** rebuilds it automatically whenever a constituent (or this folder's `build.mjs` / `icon.svg`) is committed, so the bundle never ships stale — the same guarantee as the other built scripts. Its `@version` is a build stamp (`YYYY.M.D.HHMMSS`), so every rebuild ships as a newer version.

## Notes

- The on/off list is the GM value `string_theory.off` (folder names). The build wraps each body in a check against it and adds the menu, which goes only in the top frame.
- The launchers' layout is a shared setting, not a GM value: `mbu.cornerFlow` in MusicBrainz's `localStorage`, which every script's `mbRestackCorner` reads ([DEVELOP → Settings storage](../../DEVELOP.md#settings-storage)). Each MusicBrainz server (musicbrainz.org, beta, test) keeps its own. Without String Theory, set it in the browser console (F12) on a MusicBrainz page: `localStorage.setItem('mbu.cornerFlow', '"row"')` for a row, `localStorage.removeItem('mbu.cornerFlow')` for the column; reload to see it.
- All constituents share **one** userscript-manager storage namespace here (vs one each when installed separately). In practice this is fine — each script prefixes its keys — but it's a shared surface.
- `@icon`, `@run-at` and single-valued metadata are the bundle's own; multi-valued ones (`@match`, `@grant`, `@connect`, `@require`, `@resource`) are the union of all members.
