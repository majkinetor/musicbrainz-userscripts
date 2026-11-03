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
| [Event Horizon](../event_horizon)     | A redesigned, modern MusicBrainz interface with light and dark themes                          |
| [Falcon](../falcon)                   | Batch import entity fields from Harmony or by hand                                             |
| [First Contact](../first_contact)     | Import a release from a platform's album page                                                  |
| [Fusion](../fusion)                   | Find and merge duplicate recordings from one window                                            |
| [Group Therapy](../group_therapy)     | Batch operations and various helpers for editing relationships                                 |
| [ISRC Scout](../isrc_scout)           | Fill in a release's missing ISRCs and streaming links                                          |
| [Mammoth](../mammoth)                 | Reusable edit notes on every edit form, and remembered field values                            |
| [Mission Control](../mission_control) | One dashboard to find and fix all a release lacks, and consolidate new ones                    |
| [Platform Check](../platform_check)   | Find and verify a release's links on the online platforms                                      |

In edit notes, a script running inside the bundle (not standalone) is marked with `*` (e.g. `Apollo Editor*`).

## Interface

String Theory adds dock and setting management for all included scripts:

- **One icon for all the launchers**: on MusicBrainz, String Theory's icon sits in the corner, and the round buttons of Mission Control, Fusion, Falcon and the rest fold behind it. Click it to unfold them; they stay unfolded until you click it again. Folded, the dock shows only actionable items (the script needs background fetch on for this).
- **[Command palette](#command-palette)**: Ctrl+K lists every command, filtered as you type.
- **[What's new](#whats-new)**: String Theory's icon turns golden when there is news.
- **[Sync and backup](#sync-and-backup)**: sync devices with Dropbox, save Dropbox or Google Drive backups, or export a file.
- **Settings**: open them by right-clicking String Theory's icon. Right-click any dock icon for its own settings. Every icon is shown in About. Tabs sit in the title bar and become a menu when space is tight; Website and Issues links sit in the footer.
- **Update**: in the About tab, toggle individual scripts, see their versions and check for updates.

## Theme

String Theory themes MusicBrainz and every bundled script, light or dark, with no other userscript or browser extension.

In String Theory's settings, on the **General** tab, **Mode** picks one of:

- **Light** (default) or **Dark**
- **System**: follows your system's setting
- **Sun**: dark between sunset and sunrise where you are. The browser asks for your location once; if you refuse, your system setting is used.
- **Time**: dark between the hours you enter in **Dark from** and **to**

**Light theme** and **Dark theme** pick which theme each one uses. To add or tweak a theme, see [themes](themes/README.md).

## What's new

String Theory checks the project's [announcements](https://github.com/majkinetor/musicbrainz-userscripts/discussions/categories/announcements) once a day. While some are unread, its icon is golden, with rings of light widening from it, and clicking it opens **What's new** instead of the dock. The command palette and the link at the top of String Theory's settings open it at any time. The button beside *Mark all read* makes it full screen, and short names such as RG are underlined: hover one to see what it means. Opening it checks for news too, at most every 5 minutes, and *Refresh* in the footer checks right away.

The window lists the latest 20 posts, each with its script's name and icon. A post shows **stable** when its change is released and **latest** when it isn't yet. Opening a post marks it read; **Mark all read** does them all. The first check flags only the last 14 days.

## Command palette

Press **Ctrl+K** on any page String Theory runs on and type to filter the commands:

| Category | Commands |
| --- | --- |
| Settings | String Theory's tabs and every script's settings |
| Theme | the mode, and each light and dark theme |
| Open | the window of each launcher on the page |
| This release, This artist | the open entity's pages: edit, relationships, cover art, aliases, edit history and others |
| Go to | the entities the page links to, your own pages, the edit queues and String Theory's website |
| Add | a new release, artist, label, work and the rest |
| Starred, Recent | Event Horizon's starred entities and the pages you visited last |
| Dock | fold, side, orientation |
| Scripts | turn a script on or off |
| Search | MusicBrainz searched for what you typed: `search work blue` or `work blue` is *Search Work: blue*; `search` alone lists the types |
| New issue, New issue with log | a new issue about String Theory or one script, its name in the title and the versions in the report; *with log* adds that script's log of this page, or one of its last 10 kept logs |
| String Theory | copy versions, docs, reload |

- **Your last input comes back** selected when you open the palette again: type to replace it.
- **Theme commands show as you move over them** with the arrows; **Enter** keeps one, **Esc** goes back to yours.
- **Pin** a command with **Alt+P** or its ☆: pinned commands come first, then the ones you used last.
- The words you type can be in any order and abbreviated: `rel cov` finds *This release: Cover art*.

## Sync and backup

Open String Theory's settings → **Sync**, choose **Provider**, and connect. Use the same provider and account on each device. Switching providers keeps their connections and sync history separate.

**Dropbox** returns to MusicBrainz and finishes the connection automatically. **Google Drive** opens Google's sign-in popup. Its session expires after about one hour; **Reconnect** renews access for backups. The Google app is currently limited to registered test users.

Sync actions and automatic sync are available for Dropbox only. Google Drive supports manual backups and imports; reconnect when its session expires. Its Sync area shows this limitation instead of the controls. Dropbox's Sync options remain visible beside the actions, stacking below them on narrow screens.

| Action   | What it does                                                                 |
| -------- | ---------------------------------------------------------------------------- |
| Sync now | Merges this device with the provider                                         |
| Push     | Replaces the provider's portable data with this device's                     |
| Pull     | Replaces this device's portable data from the provider on the next page load |

Under **Sync options**, **Automatic sync** runs **Sync now** while MusicBrainz is open. Independent changes are combined; when both devices change the same value, **On conflict** chooses which one wins. Star additions and removals are merged separately.

With no remote data yet, **Sync now** and **Push** create it; **Pull** leaves local data unchanged. On the first sync with existing data, stars from both sides are combined and conflicting settings use **On conflict**. An absent star only counts as a removal after a previous sync. **Push** keeps the provider's saved data for other MusicBrainz servers.

Credentials, stars, saved notes, remembered field values, named filters and normal preferences are included. Caches, logs, recent activity, temporary work, local paths and device layout stay local, including page width, columns, window state and location coordinates.

Downloaded changes apply on the next page load; **Reload** applies them immediately. Under **Backups**, the provider row saves and browses remote backups. **This device** holds local files: **Export** downloads a backup; **Import** merges one into your settings. Backups and remote sync data contain credentials.

**Save backup** saves a separate, dated snapshot at the selected provider. **Browse** opens a compact list inside the window, newest first, with dates and sizes. The list uses multiple columns when space allows. Select a backup, then use **Apply** or **Delete** in its header. **Apply** merges it into your settings, keeping a recovery copy and applying on reload, just like **Import**. Backup values win shared settings; stars are combined. **Delete** immediately removes the selected snapshot; Google Drive moves it to Trash. Reopening **Browse** reloads the list; Escape or **< Back** returns to Sync. Browsing keeps the window the same size. Remote backups stay separate from Sync, Push and Pull.

**Disconnect** stops automatic sync and removes this device's selected connection; remote data remains. Google Drive saves files in a **String Theory** folder, including sync history. Keep its sync files so changes from other devices can be merged.

## Settings

The **General** tab holds the theme, the dock and the command palette; **Sync** holds providers and backups; **About** holds the scripts and updates.

General uses two columns for related controls when space allows. About lists scripts in two columns on wider windows, with Latest and Stable above the installed version.

| Setting             | Default             | What it does                                                                                                                    |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Side                | Right               | The launchers' side of the page                                                                                                 |
| Orientation         | Column              | A column, or a row along the bottom edge                                                                                        |
| Size                | 100 %               | The launchers' size, 60 to 160 %                                                                                                |
| Hover               | None                | While the pointer is over the dock, None, or Shelf: a frosted shelf behind its icons                                            |
| Launcher order      | Each script's own   | Drag the icons to reorder the launchers; the first sits nearest the corner                                                      |
| Palette             | On                  | The command palette's hotkey works                                                                                              |
| Hotkey              | Ctrl+K              | The key that opens the command palette: click it, then press the new one                                                        |
| Provider            | Dropbox             | Where sync and remote backups are stored                                                                                        |
| Automatic sync      | Off                 | Syncs with the selected provider while MusicBrainz is open                                                                      |
| Every               | 30 minutes          | Time between automatic syncs, from 5 minutes to 1 day                                                                           |
| Conflicting changes | Use Dropbox’s value | Which value wins when both devices change the same setting                                                                      |
| Scripts             | All on              | Turns each bundled script on or off, from the next page load                                                                    |
| Copy as Markdown    |                     | Copies the channel, versions, which scripts are on and environment details as a collapsed section, ready to paste into an issue |

- **Right-click a script's icon** in the settings, in the launcher order or in About, to open that script's settings, on any page and even when the script is off. String Theory's settings stay open behind them.
- **A script that is off** doesn't run, so its standalone copy can run instead.
- Every script follows the launcher settings, standalone ones too. [Scribe](../scribe/README.md) follows only the side.
- About checks for updates each time you open it.
- The browser console (F12) lists String Theory's version and each bundled script's.

## Other recommended userscripts

- [Scribe](../scribe/README.md) and [Bandcamp Player Enhanced](../bandcamp_player_enhanced/README.md), from this repo, are not in the bundle
- [Art Station Picker](https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/art_station/as_picker/README.md)
- [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc)


## Notes

- **Each MusicBrainz server keeps its own launcher settings**: musicbrainz.org, beta and test are set apart.
- **Launchers without String Theory**: in the browser console (F12) on a MusicBrainz page, run `localStorage.setItem('mbu.cornerFlow', '"row"')` for a row or `localStorage.removeItem('mbu.cornerFlow')` for the column, `localStorage.setItem('mbu.cornerSide', '"left"')` for the left side or `localStorage.removeItem('mbu.cornerSide')` for the right, then reload.
- How the bundle is built is in [DEVELOP.md](DEVELOP.md).
- Provider setup and storage rules are in [DEVELOP → External storage](DEVELOP.md#external-storage).
