# Fusion <img src="icon.svg" align="left" width="48">

A merge assistant for MusicBrainz recordings: gather candidates, let Match group the duplicates, adjust by hand, and submit every merge from one window.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/fusion/fusion.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/fusion/fusion.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Fusion)

<img src="./screenshots/pool-groups.png" />

## Features

- **[Pool and groups](#pool-and-groups)**: candidates on the left, merge groups on the right.
- **[Seeding](#seeding)** from a release, a release group, a recording, or an artist's whole catalogue.
- **[Match](#match)** groups likely duplicates by ISRC, AcoustID, title, artist and length.
- **[Merging](#merging)** submits the merges in the background, each with an itemised edit note.

## Pool and groups

Every candidate starts in the **Pool**. A live recording has a **live** tag; the place a recording was made shows after **@**, the date in its tooltip. Drag a candidate into a group, double-click it for the *current* group (whose header you clicked last), or select it and click a group.

**Sort** the pool by **Added**, **Title** (ignoring a bracketed part such as *(remastered)*) or **Artist** then title. A repeated title is tinted, each run in its own colour. Match doesn't depend on the sort.

In a group:

- the **target**, the recording that survives, is on top with a gold ★; another row's ☆ makes it the target;
- ↩ returns a recording to the pool, ✕ drops it altogether;
- 🗑 deletes the group and returns its members to the pool; **Clear board** does it for every group;
- a shared ISRC or AcoustID is tinted, one colour per value; past three, the unshared rest folds behind *+N more*;
- an AcoustID opens acoustid.org, where a wrong link can be fixed; ↻ then reloads the group's AcoustIDs, keeping its members;
- a length outside the tolerance is flagged amber, with the spread next to the title;
- a warning next to the title says when the members can't be one recording, or may not be: *live + studio*, *N places* (recorded at different places, or at one place on different dates), or *disamb.* (their disambiguations differ);
- a recording without a disambiguation shows its release's, tagged *album*, when another member's release is in the same release group; the *disamb.* warning compares it too.

## Seeding

Fusion opens with a pool already filled from the page you launched it on:

| Page                | Pool                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| Release             | its recordings; *Load recordings from RG edition* adds another edition |
| Release group       | the recordings of every release in the group                           |
| Recording           | that recording                                                         |
| Artist → Recordings | the artist's entire catalogue, not just the visible page (up to 2000)  |

Paste a recording, release or release-group MBID or URL into the input to add it.

## Match

Match groups the recordings still in the pool, so a group you built by hand is never undone. The **Cutoff** sets how much evidence it needs:

| Cutoff             | Groups two recordings when they share…                                     |
| ------------------ | -------------------------------------------------------------------------- |
| strict *(default)* | an ISRC or an AcoustID                                                     |
| normal             | …or a similar title and artist, with lengths within tolerance (or unknown) |
| loose              | …or a similar title with either the length or the artist                   |

Each level has a colour, shown in the Cutoff's dot and its tooltip: a group card is tinted with the strictest level it still holds at.

Titles tolerate small typos, and a mix or edit written another way (*Song (Radio Edit)* and *Song - Radio Edit*), but not a word on each side that the other lacks: *Dwell I* and *Dwell IV*, or *In Volo - Drift* and *In Volo - Trace*, are different titles. Artists are compared by MBID when both recordings have them, so *Radium* and *DJ Radium* credited to the same artist match.

Match never groups:

- a video with an audio recording (not even with a shared ISRC; manual grouping refuses it too);
- a recording that has an open edit;
- a live recording with a studio one, or two recordings made at different places, or at one place on different dates (not even with a shared ISRC or AcoustID);
- lengths further apart than the setting (30 s);
- two recordings with ISRCs from one batch (the same registrant and year) but none in common, such as *QZTRX2699407* and *QZTRX2699409*: those are different tracks;
- two recordings that share only an AcoustID when their titles differ, such as *Feel What You Feel* and *Suspended Space*: AcoustIDs are submitted by users and sometimes land on the wrong recording.

A group's chips show the signals that hold for **every** member; one that holds for some is partial.

### Match by position

**Match by position**, in the menu beside Match, ignores titles. It groups recordings that sit at the same track number on two different releases, with the same track count where both are known. It is meant for localised or translated titles, such as a Japanese edition beside its English one, where titles can't agree. The artists must still agree and the lengths must be within tolerance. Everything in the list above still holds. It runs only when you choose it, never on its own: on releases with different track lists it would pair the wrong tracks.

> [!NOTE]
> This follows MusicBrainz's [How To Merge Recordings](https://musicbrainz.org/doc/How_To_Merge_Recordings): match the acoustic content, not incidental metadata. The signals are a heuristic, so glance at each group before merging.

## Merging

**Merge ↗** on a group, or **Merge All** for each group in turn, submits without opening MusicBrainz's merge page.

Each merge gets an edit note listing what matched ("Same ISRC …", "Length difference 5s (3:59 – 4:04)"). ✎ in a group's title replaces it with your own text; Fusion's attribution line is always appended.

A merge always goes to a vote, even an auto-editor's, as a [destructive edit](https://musicbrainz.org/doc/Destructive_Edit). A refused merge is marked failed.

## Settings

The ⚙ window (or right-click Fusion's corner icon), which also holds the activity **Log**:

| Setting                                           | Default |                                                            |
| ------------------------------------------------- | ------- | ---------------------------------------------------------- |
| Look up AcoustIDs                                 | on      | fetch the pool's AcoustIDs from acoustid.org               |
| Match on open                                     | off     | run Match once the pool has loaded                         |
| Preload group release details                     | off     | fetch every grouped recording's releases in the background |
| Length tolerance                                  | 5 s     | lengths this close count as the same                       |
| Match never groups if lengths differ by more than | 30 s    | whatever else matches; grouping by hand still can          |
