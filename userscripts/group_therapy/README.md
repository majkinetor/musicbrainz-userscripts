# Group Therapy <img src="./icon.svg" align="left" width="40" height="40">

Batch operations and helpers for the MusicBrainz *Edit relationships* page.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/group_therapy/group_therapy.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/group_therapy/group_therapy.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Group+Therapy)

> [!TIP]
> [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc) is a good companion.

## Features

- **[Batch delete](#batch-delete)** by role, by entity, or both.
- **[Copy and move](#copy-and-move)** credits between recordings, works, releases, and a release and its recordings.
- **[Set dates](#set-dates)** on many credits at once.
- **[Release group consolidation](#release-group-consolidation)**: one matrix of release credits across the whole group.
- **[Work matching](#work-matching)** links recordings to existing works, a medley to each of its works.
- **[Text parser](#text-parser)** turns liner notes into relationships.
- **[Replace role](#replace-role)** on many credits at once.
- **[Highlight](#highlight)** a role or an entity everywhere, with counts.
- **[Edit note](#edit-note)**: a line per action, under Group Therapy's signature.

Everything works on new relationships too, and, except consolidation, only stages changes for you to save.

## Batch delete

Right-click a relationship's **×**:

- *Remove this one*
- *Remove "‹role›" — all tracks*
- *Remove "‹target›" — everywhere*
- *Remove "‹role›" + "‹target›"*

Each option shows what it touches (*guitar — all tracks (14) · tracks 1–12*) and keeps to the ticked recordings or works, if any. It works on works too.

<img width="500" src="./screenshots/remove.png" />

## Copy and move

The destinations are the ticked recordings, or every other track when none are ticked.

**From a recording or work**: right-click its checkbox and choose *Copy* or *Move* (copy, then remove from the source). The menu lists the credits, all ticked:

- right-click a credit to keep only its role; Shift + right-click adds a role;
- hover a credit for **[A]**, which ticks every track crediting that artist, and **[R]**, the same artist in the same role.

<img width="650" src="./screenshots/copy.png" />

**From another release** in the group: **⧉ Copy from release…** lists its release credits (artists and labels) to pick from. Roles that don't suit this release's format (vinyl-only on a digital edition) start unticked.

**Between the release and its recordings** (the toolbar's *Vertical* section):

- **⬆ Release → recordings** copies or moves the release credits to the recordings. A work role (lyricist, composer, librettist, translator) goes on the tracks' works, only when every chosen track has one; add works first with **◎ Match works…**. **Move** removes from the release only what it placed. Release-only roles (liner notes, mastering, artwork, ℗, ©…) start unticked.
- **⬇ Recordings → release** collects the recordings' credits onto the release, with the track range each covers.

Both take a [track selector](#track-selector) and map each role to the destination's link type by name; a role with no equivalent is skipped and counted.

### Set dates

Right-clicking a dated relationship (a *recorded at* with a date) offers **Set dates from…**, listing every datable credit on the selected tracks, by track:

- the begin and end date (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`) are prefilled from that relationship and editable;
- credits whose role is on your remembered **roles** list start ticked (right-click a role to add it, click its chip to drop it);
- **Apply** sets the date on every ticked credit that has none.

> [!NOTE]
> MusicBrainz's editor keeps an existing date when a relationship is updated, so dated credits are shown but left as they are.

## Release group consolidation

**▦ Consolidate RG…** shows every release credit across the group as a role × release matrix: one row per credit, one column per release (A, B, C…, with a format badge), green where the credit exists.

- Click a cell to add that credit to that release, a column letter to add everything addable to it, or **Auto select** for all. A credit that doesn't suit a release's format shows `·`; click to force it.
- **Apply** submits the additions, one batch per release.
- A release whose credits couldn't be read (MusicBrainz throttling) shows `?` and gets nothing until **Retry** reads it.
- With more than 10 releases, you pick which ones to consolidate.

<img width="800" src="./screenshots/consolidation.png" />

## Work matching

**◎ Match works…** links each recording to an existing work, so a compilation of standards reuses the works instead of creating duplicates. Candidates come from ISRCs (a recording sharing an ISRC usually shares the work) and from MusicBrainz's work search, ranked by exact title, then by how many recordings use each work: *Beat It* resolves to Michael Jackson's work, not a same-named cover.

<img width="800" src="./screenshots/match-works.png" />

| Dot |                                                                       |
| --- | --------------------------------------------------------------------- |
| 🔵   | confirmed by a shared ISRC                                            |
| 🟢   | the only work with this title                                         |
| 🟡   | exact title and clearly the most recorded, but others share the title |
| 🔴   | ambiguous; check it                                                   |

**⚡ Match** selects the rows at or above the **Cutoff**. ✎ on a row searches, takes a pasted work MBID or URL, or creates a work. **＋ New work for unresolved** creates one for every unmatched recording. **Apply** stages the performance relationships.

**Medleys**: a title of several works [split by " / "](https://musicbrainz.org/doc/Style/Titles#Extra_title_information_(ETI)), like `Land of Hope and Dreams / People Get Ready`, gets a row per work, and **Apply** links the recording to all of them. `AC/DC`, without spaces, stays whole. **Split on /** (on) turns this off.

## Text parser

**✎ Text parser…** turns credit text (liner notes, a credits block, or the release's annotation via **Load annotation**) into relationships, reading each line with a [pattern](#patterns). It opens under the toolbar, in the page, so the release's tracks and credits stay in reach as you scroll. Its two top rows stay on top:

- the settings, what is left and **Apply**. What is left shows as one pill each (`5 names`, `2 roles`, `2 lines` not parsed), and a click on one takes you to the next: its row is marked, and what is missing in it flashes. `✓ all picked` shows when nothing is. The row you work in is marked too.
- the [pattern](#patterns) (its ▾ has the usual ones), 🔒 Freeze, the pasted text (one line until you click it, then numbered as the rows are), **Cutoff**, **Load annotation** and **Apply & clear annotation**.

<img src="./screenshots/text-parser.png" />

Each name gets one row: the credit on the left, MusicBrainz on the right.

- **Left**: the name as credited, its roles, the tracks a credit names, and under them the line each came from. **+** creates the artist, label or place (right-click: in the background).
  - A role in red has no match; the roles beside it, when there are some, are the closest, and a click picks one. Click the role itself to pick from all of them: the credit's kind (artist, label or place) is in the picker's header, its roles come first and the other kinds' last, each tagged with its kind. The pick applies to every credit with the same role text and the same kind of entity, so *produced at* picked for a studio leaves its line's producer an artist's *producer*, and it is remembered: that role text resolves by itself on the next release.
  - A line's text and its own pattern can be edited there, and **✕** removes the line. A line that gives no credit stays in its place as a *not parsed* row, to fix there.
  - A credit keeps the text's spelling as its credited name when it differs from MusicBrainz's; its tooltip shows both. Right-click the name to use MusicBrainz's instead, in the text too, or tick **Use MB name as credit** for every credit.
- **Right**: the pick, or the [candidates](#matching). **✓** picks one for every credit with that name; right-click **✓**: for one credit only. **✕** on a pick brings the candidates back.
  - The box under them searches, or takes a pasted MBID or URL. Where the role allows more than one kind, choose artist, label or place beside it.
- Row colours: green is ready, amber needs a pick or a role, red has no candidates.
- **Copyright lines** (©, ℗, *licensed to/from*, *distributed by*, *marketed by*) are recognised without a pattern. One year becomes both the begin and end date, as [MusicBrainz asks](https://musicbrainz.org/relationship/2ed5a497-4f85-4b3f-831e-d341ad28c544). Several holders on one line (`℗ 2012 Shady/Aftermath/Interscope`) become one credit each, and a line with two markers is split in two when pasted.
- Matching runs by itself after each change: it resolves roles and finds each name's candidates. A role is matched by MusicBrainz's own wording, word by word, only among the roles the credit's kind can have: *Lyrics by* → *lyricist*, *All music written by* → *composer*, *Production by* → *production*, *Mastered by* → *mastering*. A role that exists only for labels picks a label; an ambiguous one defaults to a label, or an artist when the name is one of the release's artists.
- Instruments and vocal types resolve to the *instrument* or *vocal* role plus that attribute: *Flute*, *Lead Vocals*, *Backing Vocals* → *background vocals*. A leading *Guest*, *Additional*, *Solo*, *Co-*, *Executive*, *Assistant* or *Associate* is added as an attribute when the role allows it: *Guest Vocals*, *Co-Producer*, *Executive Producer*.
- **Scope** sends the credits to the release (default) or to recordings chosen with a [track selector](#track-selector); the roles offered follow the scope.
- **Works**: a work role going to tracks goes on their works. *create none* (default) skips a track without one; *create needed* creates it, named after the recording, so match existing works first with **◎ Match works…** or it makes duplicates.
- **Apply** stages the credits. After **Load annotation**, **Apply & clear annotation** also clears the release's annotation, with its own edit note.

The text and the picks last until the page reloads.

> [!NOTE]
> Only single-line credits are parsed; grouped multi-line blocks are not.

### Matching

Each candidate shows its type, life span and area, and why it ranks where it does (`+ on release`, `+ related`, `− born 1990`); its tooltip has the detail (*Already lyricist on this release*, *member of band · Toto*).

| Dot | Confidence  | Why                                                                               |
| :-: | ----------- | --------------------------------------------------------------------------------- |
|  🟢  | Strong      | credited on this release, a release artist's member or collaborator, or your pick |
|  🟡  | Unique name | the only artist or label in MusicBrainz with this name or alias                   |
|  🔴  | Weak        | the best guess                                                                    |
|  ⚪  | You         | picked by you                                                                     |

**Cutoff** (default *Unique name*) is the lowest confidence picked for you, and only when the candidate clearly leads the next one. A match below it waits on its row, marked *below cutoff*. Your picks are remembered for the release artist, so the next release of that artist starts from them.

The candidates also rank on the role and the release: a person for an instrument or a vocal, a group for an orchestra or a choir; someone born after the release or gone long before it ranks lower, and one from the release's country higher.

### Patterns

A pattern works like [Apollo's track parser](../apollo_editor/README.md#pattern-parser): `R` is the role, `E` the entity (an artist, label or place, decided per row), and everything else is text the line must contain. Case doesn't matter, so `R by E` reads `PRODUCED BY JERRY ROSS`.

| Pattern       | Line                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `R: E`        | `Mastering: Nick Robbins`                                                 |
| `E - R`       | `Nick Robbins - Mastering`                                                |
| `R by E`      | `Produced by Jerry Ross`                                                  |
| `E[,] - R[,]` | `Cameron Allen - Flute, Tenor Saxophone` → one row per role               |
| `R: E[&]`     | `Graphic Design: Ricardo H Fernandes & Yacine Blaeich` → one row per name |

A bracket after `R` or `E` splits it into rows: `[,]` on commas, `[&]` on " & ", `[and]` on the word "and", `[, and /]` on all three. A word splits only with spaces around it, so `AC/DC` stays whole. A `;` separates several credits on one line.

**Where the pattern comes from**, strongest first:

| Source                               | Applies to         |
| ------------------------------------ | ------------------ |
| a line's own pattern box             | that line          |
| `Nick Robbins - Mastering {{E - R}}` | that line          |
| a line of only `{{E - R[,]}}`        | the lines below it |
| the pattern box at the top           | every other line   |

`{{}}` alone on a line ends a block. `{{…}}` can sit anywhere in a line and is cut out of its text, so credits printed in several shapes go in as one paste, each line kept as printed. Art Station's [AI scan](../art_station/README.md#ai-scan) writes them. **🔒 Freeze matched** pins the top pattern on the lines it matches, like in Apollo, and leaves lines with their own pattern alone.

**Tracks**: with **Tracks named in credits** on (the default), a clause after the role or the name, like `(1)`, `(A1 B2)`, `(tracks 2 6 9)`, `[tracks 1-3]` or `on tracks 2 and 6`, sends that credit to those tracks; every other credit follows Scope. A split never cuts inside brackets, so `Lyricist: Mimmo Epifani (tracks 1-3, 5-11)` read with `R: E[,]` stays one name.

A clause counts only when every number is a track on this release, so `(2003)` stays a year. A line with two track lists is marked **⚠ split line** and stays release-level.

### Track selector

| You type       | You get                               |
| -------------- | ------------------------------------- |
| `3`, `A1`      | that track, as numbered in the editor |
| `5-7`, `1,3`   | a range, a list                       |
| `2:4`, `2:4-6` | track 4 (4–6) on medium 2             |
| `2:*`          | every track on medium 2               |
| `all`          | every track                           |
| *(empty)*      | the ticked tracks                     |

A number that matches no track position counts as the Nth track, so on a vinyl `1, 2, 4` finds A1, A2, B1.

## Replace role

Right-click a credit's pencil for **Replace role "writer"…** (every credit with that role) or **Replace "writer" for "X"…** (only that artist's), limited to the ticked recordings or works if any. Pick the new role from the types MusicBrainz accepts for that pair. Typical use: turn every *writer* on an instrumental release into *composer*.

> [!NOTE]
> MusicBrainz can't change a relationship's type, so this removes and re-adds it. Attributes belong to the old type and are dropped; the toast counts the credits that had some.

## Highlight

Hover an entity or a role to light up every occurrence, with a count and where it appears: *48× · tracks 1–12*.

<img width="500" src="./screenshots/highlight.png" />

## Edit note

Group Therapy adds its signature and a line per action to the edit note (*Copied 2 credits from track 1 to tracks 2–5*, *Removed guitar (14)*), keeping your text.

## Settings

| Setting                   | Default |                                                 |
| ------------------------- | ------- | ----------------------------------------------- |
| Hide help text            | on      | hide MusicBrainz's help above the relationships |
| Hide native batch tools   | off     | hide MusicBrainz's own batch-tools table        |
| Auto-match on start       | off     | open the work matcher and match on page load    |
| Auto-match on open        | on      | match when the work matcher opens               |
| Uncollapse media on start | on      | expand every medium on load                     |

## Shortcuts

| Gesture                                      |                                           |
| -------------------------------------------- | ----------------------------------------- |
| right-click a relationship's **×**           | [batch delete](#batch-delete)             |
| right-click a recording's or work's checkbox | [copy / move](#copy-and-move) its credits |
| right-click an entity name                   | open that relationship's edit dialog      |
| right-click a credit's pencil                | replace role, or set dates                |
| right-click a credit in the copy list        | keep only that role (Shift adds it)       |
| hover an entity or role                      | highlight it                              |
