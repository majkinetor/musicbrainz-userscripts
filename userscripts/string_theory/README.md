# String Theory <img src="./icon.svg" align="left" width="46" height="46">

**String Theory** is a build-time bundle of most of this repo's MusicBrainz userscripts, so you can install a **single userscript** instead of adding each one separately. Each retains its own settings and behaviour.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/string_theory/string_theory.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/string_theory/string_theory.user.js)
- **[Unified documentation](./DOCS.md)** ([PDF](https://github.com/majkinetor/musicbrainz-userscripts/releases/latest/download/String_Theory.pdf), attached to each release) 
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=by+majkinetor&conditions.1.field=edit_note_author&conditions.1.operator=%21%3D&conditions.1.name=majkinetor&conditions.1.args.0=1601832&field=Please+choose+a+condition)

> [!IMPORTANT]
> Install String Theory **instead of** the individual scripts it contains. If both are on, only one copy of a script runs on a page: the one with the higher version. When the older copy happens to start first, it keeps that page and the newer one takes over from the next page load. The running copy notes the other one in its log.
>
> Any configuration stored with this script is not visible by the standalone variants and vice versa

## What's included

| Script                                | What it does                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| [Apollo Editor](../apollo_editor)     | A faster release editor: artists and recordings auto-matched                         |
| [Art Station](../art_station)         | Edit cover art and find it online with parallel edits, retried on errors             |
| [Credit Hoarder](../credit_hoarder)   | Import credits from several providers with a review phase                            |
| [Falcon](../falcon)                   | Batch import entity fields from Harmony or by hand; attach disc IDs from CD rip logs |
| [First Contact](../first_contact)     | Import a release from a platform's album page                                        |
| [Fusion](../fusion)                   | Find and merge duplicate recordings from one window                                  |
| [Group Therapy](../group_therapy)     | Batch operations and various helpers for editing relationships                       |
| [ISRC Scout](../isrc_scout)           | Fill in a release's missing ISRCs and streaming links                                |
| [Mammoth](../mammoth)                 | Reusable edit notes on every edit form, and remembered field values                  |
| [Mission Control](../mission_control) | One dashboard to find and fix all a release lacks, and consolidate new ones          |
| [Platform Check](../platform_check)   | Find and verify a release's links on the online platforms                            |

- **Turn a script off** in the userscript manager's menu (the Tampermonkey / Violentmonkey popup): each bundled script has an entry with its version, ☑ on or ☐ off. A click flips it in place, and the change applies from the next page load. A script that is off doesn't run at all, so its standalone copy, if you have one installed, can run in its place.
- **Lay out the corner launchers** from the same menu: the round buttons in the page's corner (Mission Control, Fusion, Falcon, …) stand in a column (**↕ Launchers in a column**, the default) or in a row along the page's bottom edge (**↔ Launchers in a row**). A click switches the layout at once, and it stays that way on every page. All the scripts share it, so a standalone script (Scribe, or a script installed on its own) follows it too.
- In edit notes, all userscripts are marked with `*` (e.g. `Apollo Editor*`).
- The browser console (F12) lists String Theory's version and each bundled script's.

## Other recommended userscripts

- [Scribe](../scribe/README.md) and [Bandcamp Player Enhanced](../bandcamp_player_enhanced/README.md), from this repo, are not in the bundle
- [Art Station Picker](https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/art_station/as_picker/README.md)
- [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc)
- [Enhanced Cover Art Uploads](https://github.com/ROpdebee/mb-userscripts#mb-enhanced-cover-art-uploads)

## Notes

- **Launchers without String Theory**: each MusicBrainz server (musicbrainz.org, beta, test) keeps its own layout. To set it there, run this in the browser console (F12) on a MusicBrainz page, then reload: `localStorage.setItem('mbu.cornerFlow', '"row"')` for a row, `localStorage.removeItem('mbu.cornerFlow')` for the column.
- How the bundle is built is in [DEVELOP.md](DEVELOP.md).
