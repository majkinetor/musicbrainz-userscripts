# String Theory <img src="./icon.svg" align="left" width="46" height="46">

**String Theory** bundles most of this repo's MusicBrainz userscripts into **one userscript**. Each keeps its own settings and behaviour.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/string_theory/string_theory.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/string_theory/string_theory.user.js)
- **[Unified documentation](./DOCS.md)** ([PDF](https://github.com/majkinetor/musicbrainz-userscripts/releases/latest/download/String_Theory.pdf), attached to each release)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=by+majkinetor&conditions.1.field=edit_note_author&conditions.1.operator=%21%3D&conditions.1.name=majkinetor&conditions.1.args.0=1601832&field=Please+choose+a+condition)

> [!IMPORTANT]
> Install String Theory **instead of** the scripts it contains. With both on, one copy runs per page, the higher version; an older copy that starts first keeps that page until the next load. The copies don't share settings.

## What's included

| Script                                | What it does                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Apollo Editor](../apollo_editor)     | A faster release editor: artists and recordings auto-matched; attach disc IDs from CD rip logs |
| [Art Station](../art_station)         | Edit cover art and find it online with parallel edits, retried on errors                       |
| [Credit Hoarder](../credit_hoarder)   | Import credits from several providers with a review phase                                      |
| [Falcon](../falcon)                   | Batch import entity fields from Harmony or by hand                                             |
| [First Contact](../first_contact)     | Import a release from a platform's album page                                                  |
| [Fusion](../fusion)                   | Find and merge duplicate recordings from one window                                            |
| [Group Therapy](../group_therapy)     | Batch operations and various helpers for editing relationships                                 |
| [ISRC Scout](../isrc_scout)           | Fill in a release's missing ISRCs and streaming links                                          |
| [Mammoth](../mammoth)                 | Reusable edit notes on every edit form, and remembered field values                            |
| [Mission Control](../mission_control) | One dashboard to find and fix all a release lacks, and consolidate new ones                    |
| [Platform Check](../platform_check)   | Find and verify a release's links on the online platforms                                      |

- **One icon for all the launchers**: on MusicBrainz, String Theory's icon sits in the corner, and the round buttons of Mission Control, Fusion, Falcon and the rest fold behind it. Click it to unfold them.
- **Settings**: open them from **⚙ Settings** in the userscript manager's menu, or by right-clicking String Theory's icon.
- In edit notes, all userscripts are marked with `*` (e.g. `Apollo Editor*`).

## Settings

| Setting                             | Default | What it does                                                                                               |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| Side                                | Right   | The launchers' side of the page                                                                            |
| Layout                              | Column  | A column, or a row along the bottom edge                                                                   |
| Size                                | 100 %   | The launchers' size, 60 to 160 %                                                                           |
| Fold them into String Theory's icon | On      | Off shows every launcher on its own; they always fold while [Event Horizon](../event_horizon)'s view shows |
| Reset position and size             |         | Puts the launchers back in the corner at their normal size                                                 |
| Check for updates                   |         | Whether a newer String Theory is out on your channel: stable, latest or a branch                           |
| Scripts                             | All on  | Turns each bundled script on or off, from the next page load                                               |
| Copy versions                       |         | Copies String Theory's version and each bundled script's, for a bug report                                 |

- **Move the launchers** by dragging any of them; they move together. **Reset position and size** brings them back.
- **A script that is off** doesn't run, so its standalone copy can run instead.
- Every script follows the launcher settings, standalone ones too. [Scribe](../scribe/README.md) follows only the side.
- The settings window shows which channel String Theory was installed from and links to its GitHub page.
- The browser console (F12) lists String Theory's version and each bundled script's.

## Other recommended userscripts

- [Scribe](../scribe/README.md) and [Bandcamp Player Enhanced](../bandcamp_player_enhanced/README.md), from this repo, are not in the bundle
- [Art Station Picker](https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/art_station/as_picker/README.md)
- [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc)


## Notes

- **Each MusicBrainz server keeps its own launcher settings**: musicbrainz.org, beta and test are set apart.
- **Launchers without String Theory**: in the browser console (F12) on a MusicBrainz page, run `localStorage.setItem('mbu.cornerFlow', '"row"')` for a row or `localStorage.removeItem('mbu.cornerFlow')` for the column, `localStorage.setItem('mbu.cornerSide', '"left"')` for the left side or `localStorage.removeItem('mbu.cornerSide')` for the right, then reload.
- How the bundle is built is in [DEVELOP.md](DEVELOP.md).
