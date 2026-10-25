# Apollo Editor <img src="icon.svg" align="left" width="48" height="48">

A faster release editor for MusicBrainz: artists and recordings auto-matched, clean tables for the tracklist and recordings, and tools for everything MusicBrainz's own editor makes slow.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/apollo_editor/apollo_editor.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/apollo_editor/apollo_editor.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=Apollo+Editor)

<img width="1200" src="./screenshots/tracklist.png" />

## Features

- **[Release information](#release-information)**: external links in a right column with a dead-link checker, a cover thumbnail, no help bubbles.
- **[Tracklist](#tracklist)**: an artist table with confidence colours, splitting, reordering and keyboard navigation.
- **[Pinned and recent](#pinned-and-recent)** artists and labels at the top of their pickers.
- **[Recordings](#recordings)**: track and recording side by side, with the differing characters highlighted.
- **[Matching](#matching)**: artists, recordings, the release label, artist and release group matched automatically, and a missing language and script detected.
- **[Tools](#tools)**: a configurable toolbar with the native tools and Apollo's own.
- **[Duplicates](#duplicates)**: a similarity score for each existing release, with a track-by-track comparison.
- **[Annotation editor](#annotation-editor)**: Markdown with a live preview.
- **[Highlighting](#highlighting)**: confusable punctuation, invisible characters and missing spaces made visible.
- **[Archive](#archive)**: the release's links saved on the Internet Archive, and a menu by each external link to its copies there.
- **[Disc IDs from a rip log](#disc-ids-from-a-rip-log)**, computed in the browser.

Each part is optional, and Apollo's corner icon switches to MusicBrainz's own editor and back.

## Release information

<img width="1200" src="./screenshots/release.png" />

- **External links** sit in a right column, checked for dead links. Right-click a favicon or type to edit it. A link that can be a video has a camera glyph to mark it as one.
- **+** takes several links at once and pulls URLs out of anything pasted, HTML included, dropping duplicates and setting each link's type.
- A **front-cover thumbnail** under the links opens the cover-art page.
- Right-click a date's or label's ✕ to remove all of them.
- The help bubbles are gone; the badges say what is linked.
- The release **Artist** field is the Tracklist's artist cell, in place of MusicBrainz's box and its Edit popup. One line per artist, with its credited-as name, search, join phrase and match badge. **↵** adds an artist, **⋔** splits a combined name, **⠿** reorders, **✕** removes, and **＋** / **🔗** / **⚠** offer to create the artist or add its link.
- The release **Artist** is [matched](#artist-matching) on load like a track artist, and a confident match is linked. Click an uncertain **LOW** badge to link its candidate.
- The release **Label** is linked on load by its Discogs or platform link when exactly one label has it, else when exactly one label has its name or alias, else when the similar releases on the **Duplicates** tab credit exactly one label of that name. A badge by the field says how (**set**: already on the release, **user**: picked by you); click it to open the label.
- The **Release group** of a new release is selected from MusicBrainz's suggestions under the field when exactly one of them has the release's title (punctuation, spaces and case aside) and artist, and marked **auto**. Pick **Add a new release group** to undo it.
- The **Label** field searches with Apollo's picker, as the artist does: each label shows its aliases, disambiguation, type, label code and years, and an icon that opens it. A pasted MBID or label URL is set at once. **＋** in place of the search icon creates the typed label, with its Discogs or platform link when no label has it yet, and sets it once saved; right-click to create it in a background tab.

## Tracklist

<img width="1200" src="./screenshots/tracklist.png" />

**Artists**

- The picker colours each artist by [match confidence](#artist-matching), and shows aliases, disambiguation and a type icon linking to the artist.
- **Change** in the toolbar sets whether an edit applies to one track or to every track with the same credit.
- Ctrl-click a search result to set it on every unresolved track. Paste an MBID or artist URL to resolve it directly.
- **＋** creates an unresolved artist in the background, with sort name, type and its Discogs or platform link filled in.
- On hover: **split** an artist (with a join-phrase picker), remove a split artist, or reorder artists within a credit.
- A credited-as name's hover **×** clears it; right-click to clear every credited-as on the tracklist.
- The **N unresolved** badge jumps to the first unresolved artist.

**Tracks**

- On hover: **Split** and **Aa** (Guess case); left-click for one track, right-click for all.
- **⠿** drags a track within its medium. **⤓** moves a track and everything below it into the data section; **⤒** moves it back. A medium with a disc ID can't have data tracks.
- On hover, the last column has the track's **↺** (revert, when it has changed) and **✕** (remove).
- Changed tracks get a coloured left border; pending changes, splittable tracks and tracks Guess case would change are highlighted.
- Left-click a collapsed medium to expand it, right-click to expand all.
- Pregap and data tracks and disc IDs are supported.

## Pinned and recent

The artist and label pickers remember what you set, so an artist or label you use often is one click away.

- The list starts with a **Recent** header, collapsed; click it to open. It holds your pinned artists (or labels) first, then the last 30 you picked.
- Typing filters Recent, and the search's results follow below it.
- A row's pin icon pins or unpins it without setting it. Pinned ones stay until you unpin them.
- Artists and labels each have one list, shared by every field and release.

## Recordings

<img width="1200" src="./screenshots/recordings.png" />

- Each row shows the track and its recording, a [confidence](#recording-matching) circle, and the characters that differ.
- The picker offers MusicBrainz's suggestions, a search, and the releases each candidate appears on. Paste a recording MBID or URL, or an ISRC: one match is linked at once, several are listed.
- **＋** on hover unlinks a recording, so the track gets a new one; **↺** restores the link the page loaded with.
- Videos have a camera marker before their name.
- Right-click a title or artist cell to copy it to the other side:

| Gesture                  | Copies                                               |
| ------------------------ | ---------------------------------------------------- |
| Right-click              | that cell                                            |
| Ctrl + right-click       | both fields of the row                               |
| Alt + right-click        | that field in every row                              |
| Ctrl + Alt + right-click | both fields in every row                             |
| Right-drag               | every cell it passes over, on the side it started on |

A copy to the recording applies on submit, shown as `→ New` beside the old value struck through; a copy to the track applies at once.

## Matching

**⚡ Match** matches everything still unresolved, or it runs when the page loads (see [Settings](#settings)). The best candidate is applied when it's confident enough; anything uncertain is left for you, as a candidate to confirm.

### Artist matching

Stages, most confident first:

1. **Discogs or platform link.** Each credited artist, featured ones too, is matched by the release's Discogs link on the MusicBrainz artist (**DISC**), or, imported with [First Contact](../first_contact/README.md), by its page on the platform (**DZ** for Deezer…). A [consolidated](../mission_control/README.md#consolidate-a-new-release) release tries the other platforms' pages in turn.
2. **Release group.** The same track on other releases in the group, with its credited artists. This settles most tracks, compilations included. Badge: **RG**.
3. **Same position on other editions.** The track at the same position on the release group's other editions and on the [duplicates](#duplicates), when that track passes the [recording](#recording-matching) test (similar title and length within tolerance, or a title in another script on a medium that lines up). Its artist is taken if the name matches loosely (spaces, punctuation, quotes, a leading *The* ignored, or 85% similar): *Juan Formel* → *Juan Formell*, *Cedric Im Brooks* → *Cedric “Im” Brooks*. When the editions agree the artist is linked, keeping the seeded credited name. Badge: **POS**. When they disagree nothing is linked, and they head the picker under **On other editions at this position**.
4. **Exact name or alias.** Linked only when exactly one artist has the credited name as its name or an alias, among all of MusicBrainz's matches, not only the first page. Badge: **NAME** or **ALIAS**.
5. **Co-credit.** For a shared name, an artist credited with that name next to an artist already on this release. Exactly one such artist is linked; a tie is offered to pick from. Badge: **CRED**.

Green means matched confidently; a white search box means unresolved, counted by **N unresolved**.

**Match card.** Hover a badge for a card that shows:
- the stage, and whether Apollo linked the artist or you picked it;
- the linked artist, with its disambiguation, type, area and dates;
- the evidence: the Discogs artist or platform page, the release-group track, each other edition and whom it credits (✓ / ✗; one from the duplicate search may be this very release), the alias, the co-credit counts;
- the other candidates;
- when it matched.

| Badge                     | Meaning                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| **DISC**                  | the Discogs artist credited on the release is linked from this MusicBrainz artist     |
| **DZ**, **SP**, **TD**, … | its page on the platform the release came from is linked from this MusicBrainz artist |
| **RG**                    | another release in the release group credits this artist on the same track            |
| **POS**                   | other editions credit this artist on the track at this position                       |
| **NAME**                  | the only MusicBrainz artist with this name (aliases checked too)                      |
| **ALIAS**                 | the only MusicBrainz artist with this credit as an alias                              |
| **CRED**                  | credited beside an artist already on this release, more often than any namesake       |
| **USER**                  | picked by you                                                                         |
| **SET**                   | linked before Apollo matched: by the release, the seed or the page                    |
| **LOW**                   | uncertain; the card lists what each stage found                                       |

The platform badges: **DZ** Deezer, **SP** Spotify, **TD** Tidal, **AM** Apple Music, **YTM** YouTube Music, **BC** Bandcamp, **BP** Beatport, **QZ** Qobuz, **SC** SoundCloud, **AMZ** Amazon Music, **VO** Volumo, **HD** HDtracks, **AMK** Audiomack, **7D** 7digital, **OTO** Ototoy, **PM** Presto Music.

**Discogs links.** When the Discogs link is known, the type icon offers what's missing: **🔗** creates the artist with the link, or adds the link to the matched artist. **⚠** warns that the link belongs to a different artist, or that the artist links a different Discogs page (often a wrong match). **🔗 N links** in the toolbar counts them and steps through them.

**Platform links.** A release imported with First Contact gets the same offers for each artist's platform page.

> [!NOTE]
> If a badge is ever lost when Apollo rebuilds its table (the artist stays linked, shown as *set*), a toast offers **Copy log** for a bug report.

### Recording matching

**ISRC first.** On a release imported with [First Contact](../first_contact/README.md) from a platform that gives ISRCs (Deezer, Apple Music, Tidal, Beatport, …), the release's ISRCs are looked up first. A recording that is the only one with that ISRC, and agrees with the track on title and artist, is linked ahead of every other candidate. When several recordings share the ISRC, or the one that has it differs from the track, they are only offered: the picker lists them on top with an **ISRC** badge.

Then the release group's recordings are matched by title, artist and length, and the other tracks looked up one by one. When a title is worded differently (*Part 1* / *Pt. 1*), the same position on other editions, and then on releases of the same title and artist in other groups, is used if the title is similar and the length agrees. A title in another script (*Kalimba Night* for *カリンバナイト*) can't be compared, so its position is used when that edition's whole medium lines up: as many tracks, and every length within the tolerance.

| Colour | Confidence |                                               |
| :----: | ---------- | --------------------------------------------- |
|   🔵    | Exact      | every field the same                          |
|   🟢    | Tolerance  | within the [tolerances](#settings)            |
|   🟡    | Near       | one field differs, or lengths 3–15 s apart    |
|   🟠    | Low        | two fields differ, or lengths over 15 s apart |
|   🔴    | Very low   | all three differ, lengths over 10 s apart     |

**Cutoff** in the toolbar sets the lowest confidence that's linked. *Credited as* doesn't affect matching.

### Language and script

When the release has no **Language** or **Script**, Apollo fills them in from the release and track titles, and marks the field **auto**. Bracketed parts such as *(Live)* or *[Remastered]* and anything after *feat.* are left out.

- **Script**: the one that more than 70% of the letters are written in. Kana makes it *Japanese* and Hangul *Korean*. When no script reaches 70%, as with parallel titles like *Laula Mulle Laulu = Обійми*, it's *[Multiple scripts]*.
- **Language**: [lande](https://github.com/fabiospampinato/lande), the detector Harmony uses, reads each script's words on their own and needs three titles or more and 80% confidence. When the titles mix Latin with another script, that script's language is used, since the Latin is usually its translation or transliteration. When lande isn't sure, a script that implies its language names one: Japanese, Korean, Greek, Hebrew, Thai, Armenian or Georgian.

Every language and script found is listed at the top of the field's list under **Detected by Apollo**, most likely first, with *[Multiple languages]* or *[Multiple scripts]* to pick them all.

A field that a seed or you already set is never touched. Apollo keeps updating its guess while you type titles, until you change the field yourself. Hover **auto** to see how the guess was made.

## Tools

<img width="1200" src="./screenshots/tools.png" />

The toolbar holds the tools you choose; the rest are in **Tools ▾**, with **Customize…** to pick, reorder and show each tool as icon, text or both. Right-click a tool's name to fold its settings into a hover flyout.

| Tool                                                    |                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Track parser, Swap, Reset #, Guess feat.                | MusicBrainz's own                                                                                                                 |
| [Guess case](#guess-case)                               | MusicBrainz's capitalisation, with more languages                                                                                 |
| [Search and Replace](#search-and-replace)               | replace text in titles, with saved patterns                                                                                       |
| [Pattern parser](#pattern-parser)                       | a tracklist from text, by a pattern                                                                                               |
| [Length parser](#length-parser)                         | track lengths from any text or page                                                                                               |
| [Merge mediums, Split medium](#merge-and-split-mediums) | restructure the mediums, keeping the recordings                                                                                   |
| Resize columns                                          | Fit, Centered or Default widths                                                                                                   |
| Guess punctuation                                       | kellnerd's [guess-unicode-punctuation](https://github.com/kellnerd/musicbrainz-scripts#guess-unicode-punctuation), when installed |
| **↺ Revert all**, **✕ Clear all** (under ▾)             | back to the loaded page, or empty                                                                                                 |

### Guess case

MusicBrainz's capitalisation, with more languages and rules. MusicBrainz's own guess-case buttons give the same guess.

- **Guess case** in the toolbar does every track.
- A track's **Aa** on hover shows its guess; a click applies it, a right-click does every track.
- The options sit beside **Guess case**, or open with a right-click on the release title's **Aa**.

The mode list has three groups. **○** by a Guess or Language mode makes it the **default** (**◉**): it runs on every track when the tracklist first opens, before the default [Search and Replace](#search-and-replace).

| Guess    | Capitals                                                                      |
| -------- | ----------------------------------------------------------------------------- |
| Auto     | the release language's mode; English with no language, Sentence for any other |
| Sentence | only the first word                                                           |

Auto also looks at each title:

- A title mostly in Cyrillic, Greek or Armenian gets Sentence.
- A title of three words or more gets its own language's mode when Apollo is sure of it, so a French title on an English release gets French. A shorter one keeps the release's mode: one or two words are too few to tell a language by.
- A title split by the **Separator** has its parts guessed apart: *love story / история любви* → *Love Story / История любви*.

| Language                     | Capitals                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| English                      | every word but small ones: *The Sound of Silence*; keys as *in C-sharp minor* |
| Turkish                      | as English, with Turkish small words and *İ*/*ı*                              |
| French                       | Sentence, with French spacing: *Où es-tu ?*                                   |
| Spanish, Italian, Portuguese | Sentence                                                                      |
| Dutch                        | Sentence, *IJ* as one capital: *IJsland*                                      |

| Casing    | Capitals     |
| --------- | ------------ |
| lowercase | none         |
| UPPERCASE | every letter |

A casing changes the letters without guessing, takes none of the options, and can't be the default.

| Option    | Default | What it does                                                         |
| --------- | ------- | -------------------------------------------------------------------- |
| ABC       | on      | keeps capitals: *ABBA*, *KoRn*                                       |
| IV        | off     | *part ii* → *Part II*                                                |
| Separator | `/`     | in Auto, splits a title into parts guessed apart; empty never splits |

Every Guess and Language mode also lowercases version words in brackets: *official music video*, *slowed + reverb*, *sped up*, *bootleg*, *mashup*.

### Search and Replace

<img width="600" src="./screenshots/search.png" />

Replaces text in track titles. **★** saves patterns under a name; the last five are kept as history. **⛓** puts patterns in a **chain** run in order; **◉** marks one pattern or chain as the default, applied when the tracklist first opens. **Import / Export** is the whole set as JSON.

### Pattern parser

<img src="./screenshots/pattern_parser.png" />

Fills a medium from pasted text, by a pattern. It opens with the current tracklist, so it also bulk-edits.

| Token |              | Token |                               |
| ----- | ------------ | ----- | ----------------------------- |
| `#`   | track number | `M`   | medium                        |
| `T`   | title        | `-`   | separator: any of `- – — / :` |
| `A`   | artist       | `_`   | skip the rest                 |
| `L`   | length       |       |                               |

Anything else is literal and whitespace is elastic. A capital is a token only standing alone; `$T` forces one. Fields split at the first separator; **split: last** splits at the last. Examples: `#. T`, `# A - T (L)`, `# A - T (_`.

For fixed-width text a token takes a range: `T[6-]`, `T[6-20]`, `T[-5]`, `T[~3-]` (last 3), or `[from:to]` up to a character, such as `#[1:.]` or `L[(:)]`. `~` before a character means its last occurrence: `L[~(:)]`.

Each line's dot shows whether it matched (amber: by its own pattern). Edit a row's raw text in place, give it its own pattern, or bind a selected part of it to a field. **🔒 Freeze matched** keeps the current pattern on the rows it matches, so you can change it for the rest. **Apply** writes the pattern's fields and sizes the medium to the non-empty lines; its ▾ applies one field and keeps the track count.

### Length parser

<img width="600" src="./screenshots/len_parser.png" />

Reads every duration (`5:50`, `1′23″`, `1:02:03`) out of text and ignores the rest. The source is typed or pasted text, the clipboard, a page linked on the release (one favicon each), or a link pasted with **Ctrl+V**; a fetched page's URL goes into the edit note.

The lengths line up with the tracks by order: **✕** removes a row, **+** inserts one, click a value to edit it. An invalid time blocks **Apply**; an empty row leaves that track's length alone. On a release with several mediums, pick the medium in the header.

### Merge and split mediums

<img width="900" src="./screenshots/merge_mediums.png" />

- **Merge mediums**: the ticked mediums go into the first of them, in order; the others are removed.
- **Split medium**: the chosen track and the ones after it become a new medium after it, in the same format.

Titles, lengths, credits and recordings are kept and tracks are renumbered. A medium with a disc ID is refused.

> [!NOTE]
> MusicBrainz records this as an *Edit medium* plus a *Remove medium* per merged-away medium, or an *Add medium* for a split. The moved tracks get new track MBIDs. Without auto-edit rights, *Remove medium* waits for votes, so the old mediums show beside the merged one until then.

### Other scripts' tools

Apollo lists a button another userscript adds to the page like one of its own, on the bar or in **Tools ▾**. How a script offers its button is in [DEVELOP.md](DEVELOP.md#other-scripts-tools).

## Duplicates

<img width="1200" src="./screenshots/duplicates.png" />

On the Add release *Duplicates* tab, a **Similarity** score for each existing release, from the titles, the artist and the track count. Click a score for a track-by-track comparison. Once artists are matched, the *Seeded* artists there are links, and the unmatched ones are underlined in amber.

## Annotation editor

<img width="1200" src="./screenshots/annotation.png" />

Edits the annotation as Markdown, in the release editor and on every entity's *Edit annotation* page. The toolbar has **Preview** (side by side, live), **Clear**, **Markup** (Markdown or MusicBrainz's own), **Help**, **Maximize** and **History**, which shows earlier versions and loads one back.

- An unnamed MusicBrainz link gets the entity's name.
- Enter continues a list; Tab on a selection makes a list and cycles bullets and numbers; Shift+Tab removes it.
- Links, emphasis, headings, nested lists, code blocks and rules convert both ways.

## Highlighting

With *Enable detailed highlighting* on:

- the differing characters of a title or artist are marked, and a length gap is shaded by its size. A different artist is boxed whole; a *credited as* difference on the same artist marks only its characters;
- confusable characters (`'` `’` `"` `-` `–` `—`) are enlarged, and invisible ones (no-break, zero-width, tab) are drawn, with their Unicode name in the tooltip;
- a join phrase missing a space shows `␣`, and a missing join phrase `␣?␣`.

<img src="./screenshots/tracklist-dark.png" />

Apollo follows a dark MusicBrainz theme, such as kellnerd's [userstyle](https://github.com/kellnerd/userstyles#musicbrainz).

## Archive

At **Enter edit**, Apollo has the Internet Archive's Wayback Machine save every external link of the release, so anyone can later check what the pages showed; the [archive menu](#archive-menu) by each link opens its copies.

- Only the release's own links are saved, not the links an edit note mentions.
- Some sites refuse the Internet Archive; for Discogs, its release data is saved instead.
- Every edit saves them again. A page the Internet Archive saved a moment ago isn't saved twice.
- The edit doesn't wait for the saves.
- Links on MusicBrainz and the Internet Archive aren't saved, nor what [First Contact](../first_contact/README.md#archive) already archives for its import.
- Anonymous saves are limited, so some are refused on a release with many links. With your [archive.org keys](../first_contact/README.md#archiveorg-keys), shared with First Contact, the limit is much higher and each save takes a screenshot.

### Archive menu

On release, release group, artist and label pages, a clock after each sidebar link lists its copies on the Wayback Machine:

| Menu item                  |                                                |
| -------------------------- | ---------------------------------------------- |
| Open the latest snapshot   | the page as last saved                         |
| Open the latest screenshot | its screenshot, when one was taken             |
| All snapshots (calendar)   | every saved copy, by date                      |
| Save it now                | saves the page now, in Save Page Now's own tab |

A Discogs link offers its saved release data. Nothing is sent to archive.org until you pick an item.

> [!NOTE]
> Archiving sends the address of every link on the releases you edit to archive.org, and with keys, under your account. Turn **Archive links on the Internet Archive** off in [Settings](#settings) if you don't want that.

## Disc IDs from a rip log

On a release's **Disc IDs** tab, each medium gets a drop zone for a rip log. Apollo computes its disc ID and opens MusicBrainz's attach page, edit note signed, for you to **Enter edit**.

| Program          | Reads                             |
| ---------------- | --------------------------------- |
| EAC, XLD, fre:ac | the TOC table (localised EAC too) |
| whipper          | the `TOC:` block                  |
| dBpoweramp       | `Track N: Ripped LBA x to y`      |
| cyanrip          | `Start LSN` / `End LSN`           |

Like Picard, whose parsers these are, it refuses a partial rip, a non-standard track sequence or an unknown file, and drops a trailing data track. A log whose track count doesn't match the medium asks before continuing.

## Settings

Right-click Apollo's corner icon.

| Setting                                                       | Default |                                                                                         |
| ------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| Modify Release information, Tracklist, Recordings, Duplicates | on      | replace that part of the editor                                                         |
| Modify annotations with Markdown                              | on      | the [annotation editor](#annotation-editor)                                             |
| Modify header and footer                                      | on      | a compact step switcher instead of the tabs and footer                                  |
| Zen editing                                                   | on      | hide the site header, title and footer; the title moves into Apollo's bar               |
| Auto confirm release submissions                              | on      | skip the confirmation page when a site seeds a release                                  |
| Archive links on the Internet Archive                         | on      | save the release's links at **Enter edit**; see [Archive](#archive)                     |
| Archive menu on external links                                | on      | the [archive menu](#archive-menu) by each link on entity pages                          |
| archive.org keys                                              | none    | your access key and secret, shared with First Contact: higher limits, plus a screenshot |
| Auto-match on start: Tracklist, Recordings                    | on      | match on load                                                                           |
| Auto-match on start: Label, Artist, Release group             | on      | match the release [artist, label and release group](#release-information) on load       |
| Discogs artist link matching                                  | on      | match by [Discogs link](#artist-matching) and offer missing links                       |
| Detect language and script                                    | on      | fill in a missing [language and script](#language-and-script)                           |
| Length tolerance                                              | 5 s     | `0` for exact                                                                           |
| Title tolerance                                               | 1       | differing characters allowed                                                            |
| Ignore casing                                                 | on      | case, accents and spacing don't count                                                   |
| Ignore punctuation                                            | on      | `&`/*and*, brackets, quotes, dashes and dots don't count                                |
| Enable detailed highlighting                                  | on      | see [Highlighting](#highlighting)                                                       |
| Row layout                                                    | normal  | compact, normal or cozy                                                                 |
| Alternate row colors                                          | off     | every other track tinted                                                                |
| Show grid                                                     | rows    | lines between rows and/or columns                                                       |
| Enlarge punctuation by                                        | 3 px    | `0` stops the enlarging; the markers stay                                               |
| Keep caret position on row navigation                         | on      | off: a cell is selected whole on arrival                                                |
| Highlight all instances of an artist on hover                 | off     | hovering an artist highlights it on every track                                         |

## Shortcuts

| Where         | Key                                    |                                                 |
| ------------- | -------------------------------------- | ----------------------------------------------- |
| Tracklist     | ↓, Enter                               | next row                                        |
| Tracklist     | ↑, Shift+Enter                         | previous row                                    |
| Tracklist     | Tab, Shift+Tab                         | next, previous column                           |
| Join phrase   | typing, ↓ ↑, Enter                     | filter the presets, move, pick                  |
| Length parser | Ctrl+V                                 | read the lengths from the link on the clipboard |
| Length parser | Ctrl+Enter                             | apply                                           |
| Annotation    | Ctrl+B, Ctrl+I                         | bold, italic                                    |
| Annotation    | Tab, Shift+Tab                         | make or change a list, remove it                |
| Guess case    | right-click a track's **Aa**           | every track                                     |
| Guess case    | right-click the release title's **Aa** | the options                                     |

## Notes

### Archiving requests

[DEVELOP.md](DEVELOP.md#archive) lists the requests sent to the Internet Archive, and which links are left out.
