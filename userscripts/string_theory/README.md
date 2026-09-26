# String Theory <img src="./icon.svg" align="left" width="46" height="46">

Most of this repo's MusicBrainz userscripts in one install. Each keeps its own settings and behaviour.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/string_theory/string_theory.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/string_theory/string_theory.user.js)
- **[Unified documentation](./DOCS.md)** ([PDF](./DOCS.pdf))
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=by+majkinetor&conditions.1.field=edit_note_author&conditions.1.operator=%21%3D&conditions.1.name=majkinetor&conditions.1.args.0=1601832&field=Please+choose+a+condition)

> [!IMPORTANT]
> Install String Theory **instead of** the scripts it contains, never both: each would run twice. Settings saved in the bundle aren't seen by the standalone scripts, and vice versa.

## What's included

| Script | |
|---|---|
| [Apollo Editor](../apollo_editor) | the release editor's tracklist, recordings and tools |
| [Art Station](../art_station) | cover and event art gallery editor |
| [Credit Hoarder](../credit_hoarder) | import credits from several sources |
| [Fusion](../fusion) | merge duplicate recordings |
| [Group Therapy](../group_therapy) | relationship editor batch helpers |
| [ISRC Scout](../isrc_scout) | missing ISRCs and streaming links |
| [Mammoth](../mammoth) | saved edit notes and field values |
| [Platform Check](../platform_check) | find, verify and add a release's platform links |

The list lives in [`members.txt`](./members.txt). In edit notes, a bundled script is marked with `*` (`Apollo Editor*`). The browser console prints the versions:

```
String Theory  v2026.7.3.140303
String Theory bundles:
  · Apollo Editor v2026.7.2.2
  · Art Station v2026.7.2.1
  …
```

## Other recommended userscripts

- [Art Station Picker](../art_station/as_picker/README.md)
- [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc)
- [Enhanced Cover Art Uploads](https://github.com/ROpdebee/mb-userscripts#mb-enhanced-cover-art-uploads)

## How it's built

`string_theory.user.js` is **generated**; don't edit it. Each member is a self-contained function that checks its own pages, so [the build](./build.mjs) merges the metadata (`@match`, `@grant`, `@connect`… deduplicated) and concatenates the members, each started at its own `@run-at` moment.

```
node userscripts/string_theory/build.mjs
```

The pre-commit hook rebuilds it whenever a member, its README, `build.mjs` or `icon.svg` is committed. Its `@version` is the build time (`YYYY.M.D.HHMMSS`).

> [!NOTE]
> The members share one userscript-manager storage here, instead of one each. Every script prefixes its keys, so they don't collide.
