# Fusion <img src="icon.svg" align="left" width="48">

A merge assistant for MusicBrainz recordings: gather candidates, let Auto-match group the duplicates, adjust by hand, and submit every merge from one window.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/fusion/fusion.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/fusion/fusion.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Fusion)

<img src="./screenshots/pool-groups.png" />

## Features

- **[Pool and groups](#pool-and-groups)**: candidates on the left, merge groups on the right.
- **[Seeding](#seeding)** from a release, a release group, a recording, or an artist's whole catalogue.
- **[Auto-match](#auto-match)** groups likely duplicates by ISRC, AcoustID, title, artist and length.
- **[Merging](#merging)** submits the merges in the background, each with an itemised edit note.

## Pool and groups

Every candidate starts in the **Pool**. Put it in a group by dragging it, by double-clicking it (it joins the *current* group, the one whose header you clicked last), or by selecting it and clicking a group.

In a group:

- the **target**, the recording that survives, sits on top with a gold ★; click another row's ☆ to change it;
- ↩ returns a recording to the pool, ✕ drops it altogether;
- 🗑 deletes the group and returns its members to the pool; **Clear board** does it for every group;
- an ISRC or AcoustID that two or more members share is tinted, one colour per shared value, so you can see which rows agree;
- a length outside the tolerance is flagged amber, with the spread next to the title.

## Seeding

Fusion opens with a pool already filled from the page you launched it on:

| Page | Pool |
|---|---|
| Release | its recordings; *Load recordings from RG edition* adds another edition |
| Release group | the recordings of every release in the group |
| Recording | that recording |
| Artist → Recordings | the artist's entire catalogue, not just the visible page (up to 2000) |

On any page, pasting a recording, release or release-group MBID or URL into the input adds it (a release adds all of its recordings).

## Auto-match

Auto-match groups the recordings still in the pool, so a group you built by hand is never undone. The **Cutoff** sets how much evidence it needs:

| Cutoff | Groups two recordings when they share… |
|---|---|
| strict | an ISRC or an AcoustID |
| normal *(default)* | …or a similar title and artist, with lengths within tolerance (or unknown) |
| loose | …or a similar title with either the length or the artist |

Titles tolerate small typos. Artists are compared by MBID when both recordings have them, so *Radium* and *DJ Radium* credited to the same artist match.

Auto-match never groups:

- a video with an audio recording (not even with a shared ISRC; manual grouping refuses it too);
- a recording that has an open edit;
- lengths more than 30 s apart.

A group's chips show which signals hold for **every** member; one that holds for only some of them is shown as partial.

> [!NOTE]
> This follows MusicBrainz's [How To Merge Recordings](https://musicbrainz.org/doc/How_To_Merge_Recordings): match the acoustic content, not incidental metadata. The signals are a heuristic, so glance at each group before merging.

## Merging

**Merge ↗** on a group, or **Merge All** in the footer, submits the merge without opening MusicBrainz's merge page. Merge All prepares several groups in parallel and submits them one at a time, because MusicBrainz keeps one merge queue per session.

Each merge gets an edit note listing what matched ("Same ISRC …", "Length difference 5s (3:59 – 4:04)"). ✎ in a group's title replaces it with your own text; Fusion's attribution line is always appended.

It is an ordinary edit on your account: unless you're an auto-editor, it goes to a vote (see [Settings](#settings) to always ask for one).

> [!NOTE]
> Under the hood, Fusion queues the group with `GET /recording/merge_queue?add-to-merge=…` and posts MusicBrainz's own `/recording/merge` form with the target and the note. If MusicBrainz bounces the form instead of creating the edit, the group is marked failed, not done.

## Settings

The ⚙ window, which also holds the activity **Log**:

| Setting | Default | |
|---|---|---|
| Always require a vote | off | send even your auto-edits to a vote |
| Look up AcoustIDs | on | fetch the pool's AcoustIDs from acoustid.org |
| Auto-match on open | off | run Auto-match once the pool has loaded |
| Preload group release details | off | fetch every grouped recording's releases in the background |
| Length tolerance | 5 s | lengths this close count as the same |
| Never auto-group if lengths differ by more than | 30 s | |
