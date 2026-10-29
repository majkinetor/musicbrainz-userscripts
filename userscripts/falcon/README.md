# Falcon <img src="./icon.svg" align="left" width="40" height="40">

A MusicBrainz batch editor: queue many entities, then let a pool of workers add their links, ISRCs, names, aliases, disambiguations and cover art, through MusicBrainz's own forms or its API.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/falcon/falcon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/falcon/falcon.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=Falcon)

<img src="./screenshots/queue.png" width="600">

An importer like [Harmony] hands you 20–50 artists, recordings and labels that each need links, ISRCs and a cover. MusicBrainz has no write API for most of that, so tools open a tab per entity for you to handle one by one. Falcon does them as one batch.

## Features

- **[Queue from anywhere](#filling-the-queue)**: a [Harmony](#from-harmony) import, [the page you're on](#from-the-current-page), [a series](#from-a-series), a [JSON file](#json-model) or [another script](#from-another-script).
- **[Editing the queue](#editing-the-queue)** as a list of forms or a spreadsheet-like grid.
- **[Failures you can inspect](#the-run)**: MusicBrainz's own error on the row, the worker left where it stopped, retry in place.
- **[Attributes](#attributes)**: links, names, disambiguations, aliases, ISRCs, the video flag, cover art.
- **[Batch edit note](#batch-edit-note)** on every edit of a run.
- **[Hands-free Harmony import](#hands-free-import)**, including retries when MusicBrainz errors, and a hand-off to Picard once the run finishes.
- **[Export and import](#json-model)** a run as JSON, with each item's outcome, so a partial batch can be rerun without repeating what went through.

Untouched rows, and aliases and links the entity already has, are skipped. A link in another locale counts as had (a Qobuz page linked as `gb-en` isn't added as `us-en`), and the row says which.

## Filling the queue

Open Falcon with **Ctrl+Alt+F** on any page, or with its corner icon (right-click: **Options**). The icon shows on release, release group and series pages, and on other pages while a run goes.

### From Harmony

On a Harmony *Release Actions* page ([harmony.pulsewidth.org.uk][Harmony] or [harmony.mybrainz.dev](https://harmony.mybrainz.dev/)), **Send N to Falcon** (bottom-right; right-click: **Options**) opens MusicBrainz with the batch queued: links for every entity, the recordings' ISRCs, and the front cover.

<img src="./screenshots/harmony.png" width="400">

- **ISRCs** go by tracklist position: ISRC *N* to track *N* as MusicBrainz has it. If the counts differ, the extras are dropped and logged. (A recording linked to the wrong provider track still gets that track's ISRC; Falcon can't tell.)
- **Cover art**: Falcon takes each candidate's largest version from its store, measures it, and picks the largest, then the smallest file; expand the row to change the pick, type or comment. The edit note names the source, its size and what it was chosen over.

> [!WARNING]
> A release that already has cover art gets none. Turn off *Add covers only when there aren't any* to add one anyway; the row then warns when the release has art. If you upload covers with [Art Station](../art_station) instead, turn on *Ignore cover art* under *Harmony*.

### From the current page

On a release or release group page, **+ Add from** fills the queue with its entities, with empty fields. Fill in the rows you want and press **Start**. **Export** turns it into a JSON worksheet to fill in later.

<img src="./screenshots/add-from-release.png" width="520">

Ticking the *Video* camera on a selected recording ticks it on every selected recording.

### From a series

On a series page, **+ Add from series** queues its release groups (optionally every release in them), or its releases (optionally their release groups), in the series' own order. Together with [renaming](#attributes), this is how a series gets its titles conformed.

## Editing the queue

**List** / **Grid** switches the view.

- **List**: expand a row to edit it as a form. Each link shows its types; the mark before it (✓ done, ✗ failed, ↗ not run yet) opens it.
- Edit a URL in its box (empty drops it). A type badge picks another type or **✕** drops it; **+** after the types adds one, **+** by *Links* adds a link, the link's **✕** removes it. A link without a type shows *auto*, left for MusicBrainz to guess.
- **Grid**: one line per row, with its name, disambiguation and ISRCs editable in place. **▸** opens the row's links and aliases (and a release's cover art) beneath it, lined up under *Name*; aliases are added and edited only there.

The [keyboard](#shortcuts) moves between fields like a spreadsheet; in the list, rows open and close as you go.

## The run

Review the queue, then press **Start**. Right-click a row's type to select every item of that type; the header chips (`art`, `lbl`, `rec`, `rel`, `rg`) exclude a type without removing it.

| Status      |                                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| queued      | not processed yet                                                              |
| in progress | being processed                                                                |
| done        | everything went through                                                        |
| partial     | some of it failed                                                              |
| failed      | nothing went through                                                           |
| manual      | finished by you in a tab                                                       |
| skipped     | nothing to submit, MusicBrainz reported no change, or a special-purpose entity |
| excluded    | its type's chip is off                                                         |

- A special-purpose artist or label, such as *Various Artists*, *[unknown]* or *[no label]*, is skipped without opening its edit page: MusicBrainz lets only a few editors change those.
- A failed row shows MusicBrainz's own error on hover. **FAILED** / **PARTIAL** / **MANUAL** chips at the top filter the queue to those rows.
- A worker that can't commit stays where it stopped, dimmed but live, and a fresh one takes over. Click a red status to jump to it in the **Workers** tab; **⛶** enlarges it.
- **⇗** opens the entity's edit page in a tab, prefilled, for you to finish.
- **Retry failed**, in Start's **▾** menu, reruns the failed and partial rows in place.

<img src="./screenshots/workers.png">

A link MusicBrainz can't classify on its own (a Bandcamp track: purchase or streaming?) fails with that reason instead of blocking its row; use **⇗** to pick the type.

> [!NOTE]
> Workers are MusicBrainz's own edit pages, filled in and submitted out of sight; how is in [DEVELOP.md](DEVELOP.md#workers). *Workers* in [Settings](#settings) sets how many run at once.

### The log

The **Log** tab filters by level or worker (`w1`, `w2`, …) and searches; a worker's first line on an item names everything it adds (links with their types, ISRCs, barcode, …). **⧉ Copy** gives Markdown for an issue, and **debug** records each worker's every step.

The last 10 runs' logs are kept in this browser, so a run whose tab crashed can still be read: pick it beside the filter. **Clear history** deletes Falcon's. A long run keeps its start and end.

## Attributes

|                                      | artist | label | recording | release | release group |
| ------------------------------------ | :----: | :---: | :-------: | :-----: | :-----------: |
| links, name, aliases, disambiguation |   ✓    |   ✓   |     ✓     |    ✓    |       ✓       |
| ISRCs, video, length                 |        |       |     ✓     |         |               |
| cover art, barcode, event, tracks    |        |       |           |    ✓    |               |

- **Name**: the ✎ box starts with the current name. A rename shows once its edit passes the vote.
- **Aliases**: one row per alias, with its name, its language and **✕**; the **+** by the *Aliases* label adds one, or use [JSON](./examples/aliases.json) for many. A new alias takes the language last typed; `name@locale` typed in the name box sets the language too. Enter on a filled alias opens the next one, on an empty one moves on to the next row's aliases; Esc drops a new, still empty row.
- **Video** is only ever set, never cleared.
- **Barcode** fills a release that has none and unticks *This release does not have a barcode*. A different barcode is kept, and the row says so.
- **Event** gives a release that has no release event one: the date (`2014`, `2014-02` or `2014-02-20`), then the country's code, `2014-02-20 XW`. Only `XW` ([Worldwide]) is known so far; another code leaves the country empty. An existing event is kept, and the row says so.
- **Tracks** changes a release's track titles and lengths, each as medium.track, a quoted title, a length, separated by `;`: `1.2 "New title" 5:02; 1.3 6:58`. `+rec` after the title gives the recording that title too. A track that has changed since, or a length on a medium with a disc ID, is kept, and the row says so. In the grid, barcode, event and tracks are in the row's opened part.
- **Length** sets a recording's own length (`m:ss`). MusicBrainz takes it only for a recording without tracks; any other's comes from its tracks, and the row says so.

> [!WARNING]
> MusicBrainz silently drops the locale of a *Search hint* alias; Falcon warns in the log. Use the `<entity> name` type for a localised title.

## Batch edit note

**✎ Note**, left of Start, adds its text to every edit of the run: forms, aliases and covers. It isn't kept across reloads, so an old reason can't slip into a new batch.

## Hands-free import

Two settings, both on by default, carry a finished Harmony import to a finished run:

|                           | Runs on     | Does                     |
| ------------------------- | ----------- | ------------------------ |
| *Auto send*               | Harmony     | presses *Send to Falcon* |
| *Auto start import after* | MusicBrainz | presses *Start*          |

*Auto send* waits for Harmony to finish, counts down on the button (a click cancels, a right-click cancels and opens the options), and stands down when there's nothing to send. *Auto start import after* counts down on **Start** for its seconds (10 by default); a click on Start cancels.

**When Harmony errors**, the page loads short of actions:

- **a MusicBrainz error**: Falcon reloads the page, a few times, waiting longer each time;
- **a provider error**, or retries exhausted: Falcon sends what it has, as *Send 43 to Falcon (partial)*, with the reason as the batch's edit note (reloading can't fix a provider).

A partial run can be topped up later; what went through isn't repeated. *Reload release page after import without errors* shows the result on the release page, the corner icon green; a run with failures isn't reloaded, so its queue survives.

## JSON model

What **Import** reads, **Export** writes, and Harmony and other scripts produce: a bare array of items, or `{ "items": [...] }` with an optional root `note` (the [batch edit note](#batch-edit-note)) and `name` (the run's name in the log history, for a queue with no release in it to be named after).

```json
{
  "note": "Links and covers from the label's site",
  "items": [
    { "entityType": "artist", "mbid": "d31f76d2-1d8e-4271-8027-148f375979d7", "urls": [{ "url": "https://myspace.com/x", "linkTypeId": null }], "status": "done" },
    { "entityType": "recording", "mbid": "e42f8e08-3150-4c6c-be5b-4030c29b1bf7", "disambiguation": "live version", "isrcs": ["NLTH62000001"] },
    { "entityType": "release", "mbid": "8ad416ad-f3a1-43bb-9e85-786efefd5173",
      "urls": [{ "url": "https://www.discogs.com/release/1", "linkTypeId": "75" }],
      "cover": [{ "url": "https://e-cdns-images.dzcdn.net/images/cover/x/1000x1000.jpg", "type": "Booklet", "comment": "page 1" }] }
  ]
}
```

| Key                             |                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entityType`                    | `artist`, `label`, `recording`, `release`, `release_group`                                                                                                                  |
| `mbid`                          | the entity                                                                                                                                                                  |
| `urls[]`                        | `{ url, linkTypeId }`; without a type, MusicBrainz classifies the link                                                                                                      |
| `rename`                        | a new name (`name` is the current one, read only)                                                                                                                           |
| `disambiguation`                | the disambiguation comment                                                                                                                                                  |
| `aliases[]`                     | `{ name, locale, type, primary, sortName, begin, end, ended }`, or `"name@locale"`; each is its own edit. `type` as MusicBrainz names it (`Recording name`, `Search hint`…) |
| `isrcs[]`                       | recordings                                                                                                                                                                  |
| `video`                         | recordings; only `true` does anything                                                                                                                                       |
| `length`                        | recordings: the length in ms, for a recording without tracks                                                                                                                |
| `cover[]`                       | releases: `{ url, type, comment, candidates }`, type defaulting to Front                                                                                                    |
| `barcode`                       | releases: a barcode for a release that has none                                                                                                                             |
| `labels[]`                      | releases: `{ mbid, name, catno, add }`: an empty catalog number to fill, or a label to add                                                                                  |
| `event`                         | releases: `{ date: { year, month, day }, country }` for a release without an event                                                                                          |
| `tracks[]`                      | releases: track titles and lengths, `{ medium, position, title, recording, ms, was }` ([below](#track-changes))                                                             |
| `note`                          | that item's own edit note                                                                                                                                                   |
| `status`, `error`, `urlResults` | written by Export: the outcome of the last run                                                                                                                              |

### Track changes

A release's `tracks[]` changes its tracks, each by `medium` and `position` (from 1): `title` gives the track a new title, and the recording too with `recording: true`; `ms` a new length. `was: { title, ms }` is what the track had when the change was made: a track that holds something else by now is left alone (`ms: null` means a track without a length). Without `was` the change is made whatever the track holds. The older `lengths[]` (`{ medium, position, ms }`) fills tracks without a length.

### From another script

Another script can hand Falcon a queue in the [JSON model](#json-model), by a `?falcon=` link or by an event on the page; a link never starts the queue. Sending the same batch twice doesn't run it twice. [Mission Control](../mission_control/README.md#execute) and [Platform Check](../platform_check/README.md#artists-and-labels) send their links, barcodes, catalog numbers, release events and track titles and lengths this way. How is in [DEVELOP.md](DEVELOP.md#handoff).

## Settings

| Setting                                                  | Default   |                                                                                                             |
| -------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| Hide Falcon icon                                         | off       | Ctrl+Alt+F still opens it                                                                                   |
| Add covers only when there aren't any                    | on        | a release that already has cover art gets none from the queue                                               |
| Harmony: Ignore cover art                                | off       | a Harmony import queues no cover art                                                                        |
| Harmony: Auto send                                       | on        | see [Hands-free import](#hands-free-import)                                                                 |
| Harmony: Auto start import after … seconds               | on, 10    | see [Hands-free import](#hands-free-import)                                                                 |
| Harmony: Reload release page after import without errors | on        | see [Hands-free import](#hands-free-import)                                                                 |
| Harmony: Open in new tab                                 | on        | off navigates the Harmony tab                                                                               |
| Harmony: Automatically send to Picard using port         | off, 8000 | hand the release to [Picard](https://picard.musicbrainz.org/) after a run (needs its *Browser integration*) |
| Workers                                                  | 5         | entities processed at once                                                                                  |

The Picard port also sets MusicBrainz's own tagger button, whether *Automatically send to Picard* is ticked or not.

> [!TIP]
> To report a problem: turn **debug** on in the **Log** tab, reproduce it, then **⧉ Copy** the log into the issue.

## Shortcuts

| Key              |                                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| Ctrl+Alt+F       | open or close Falcon                                                         |
| Esc              | hide Falcon (an item popup over it first); a run goes on                     |
| Enter / Down     | the same field on the next row                                               |
| Shift+Enter / Up | the same field on the previous row                                           |
| Tab / Shift+Tab  | the next / previous field, on to the next / previous row                     |
| Right / Left     | the next / previous field, once the cursor is at the end / start of the text |

In an alias box with text in it, Enter adds the alias first; press it again to move on.

[Harmony]: https://harmony.pulsewidth.org.uk
