# Apollo Editor <img src="icon.svg" align="left" width="48" height="48">

A faster release editor for MusicBrainz: artists and recordings matched in one pass, clean tables for the tracklist and recordings, and tools for everything MusicBrainz's own editor makes slow.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/apollo_editor/apollo_editor.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/apollo_editor/apollo_editor.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=Apollo+Editor)

<img width="1200" src="./screenshots/tracklist.png" />

## Features

- **[Release information](#release-information)**: external links in a right column with a dead-link checker, a cover thumbnail, no help bubbles.
- **[Tracklist](#tracklist)**: an artist table with confidence colours, splitting, reordering and keyboard navigation.
- **[Recordings](#recordings)**: track and recording side by side, with the differing characters highlighted.
- **[Matching](#matching)**: artists, recordings, the release label and the release artist matched automatically.
- **[Tools](#tools)**: a configurable toolbar with the native tools and Apollo's own.
- **[Duplicates](#duplicates)**: a similarity score for each existing release, with a track-by-track comparison.
- **[Annotation editor](#annotation-editor)**: Markdown with a live preview.
- **[Highlighting](#highlighting)**: confusable punctuation, invisible characters and missing spaces made visible.

Each part is optional, and the **Original / Apollo** button switches back to MusicBrainz's own editor at any time.

## Release information

<img width="1200" src="./screenshots/release.png" />

- **External links** sit in a right column, checked for dead links. Right-click a favicon or type to edit it.
- **+** takes several links at once and pulls URLs out of anything pasted, HTML included, dropping duplicates and setting each link's type.
- A **front-cover thumbnail** under the links opens the cover-art page.
- Right-click a date's or label's ✕ to remove all of them.
- The help bubbles are gone.

## Tracklist

<img width="1200" src="./screenshots/tracklist.png" />

**Artists**

- The picker colours each artist by [match confidence](#artist-matching), and shows aliases, disambiguation and a type icon linking to the artist.
- **Change** in the toolbar sets whether an edit applies to one track or to every track with the same credit.
- Ctrl-click a search result to set it on every unresolved track. Paste an MBID or artist URL to resolve it directly.
- **＋** creates an unresolved artist in the background, with sort name, type and Discogs link filled in.
- On hover: **split** an artist (with a join-phrase picker), remove a split artist, or reorder artists within a credit.
- The **N unresolved** badge jumps to the first unresolved artist.

**Tracks**

- On hover: **Split** and **Guess case**; left-click for one track, right-click for all.
- **⠿** drags a track within its medium. **⤓** moves a track and everything below it into the data section; **⤒** moves it back. A medium with a disc ID can't have data tracks.
- Changed tracks get a coloured left border; pending changes, splittable tracks and tracks Guess case would change are highlighted.
- Left-click a collapsed medium to expand it, right-click to expand all.
- Pregap and data tracks and disc IDs are supported.

## Recordings

<img width="1200" src="./screenshots/recordings.png" />

- Each row shows the track and its recording, a [confidence](#recording-matching) circle, and the characters that differ.
- The picker offers MusicBrainz's suggestions, a search, and the releases each candidate appears on. Paste a recording MBID or URL, or an ISRC: one match is linked at once, several are listed.
- **＋** on hover unlinks a recording, so the track gets a new one; **↺** restores the link the page loaded with.
- Videos have a camera marker before their name.
- Right-click a title or artist cell to copy it to the other side:

| Gesture | Copies |
|---|---|
| Right-click | that cell |
| Ctrl + right-click | both fields of the row |
| Alt + right-click | that field in every row |
| Ctrl + Alt + right-click | both fields in every row |

On the recording side the copy is applied when you submit, like MusicBrainz's own checkboxes; the cell shows `→ New` and the old value struck through. On the track side it's applied at once. A copy is offered wherever MusicBrainz would show its checkbox, including case-only differences.

## Matching

**⚡ Match** matches everything still unresolved, or it runs when the page loads (see [Settings](#settings)). The best candidate is applied when it's confident enough; anything uncertain is left for you, as a candidate to confirm.

### Artist matching

Stages, most confident first:

1. **Release group.** The same track on other releases in the group, with its credited artists. This settles most tracks, compilations included.
2. **Discogs link.** When the release links to Discogs, each credited artist (featured ones too) is matched by the Discogs link on the MusicBrainz artist. Badge: **DISC**.
3. **Same position on other editions.** The track at the same position on the release group's other editions and on the [duplicates](#duplicates), when that track passes the [recording](#recording-matching) test (similar title and length within tolerance, or a title in another script on a medium that lines up). Its artist is taken if the name matches loosely (spaces, punctuation, quotes, a leading *The* ignored, or 85% similar): *Juan Formel* → *Juan Formell*, *Cedric Im Brooks* → *Cedric “Im” Brooks*. When the editions agree the artist is linked, keeping the seeded credited name. Badge: **POS**, with the number of editions in its tooltip. When they disagree nothing is linked, and they head the picker under **On other editions at this position**.
4. **Exact name or alias.** Linked only when exactly one artist has the credited name as its name or an alias, among all of MusicBrainz's matches, not only the first page. Badge: **NAME** or **ALIAS**.
5. **Co-credit.** For a shared name, an artist credited with that name next to an artist already on this release. Exactly one such artist is linked; a tie is offered to pick from. Badge: **CRED**.

Green means matched confidently; a white search box means unresolved, counted by **N unresolved**.

**Discogs links.** When the Discogs link is known, the type icon offers what's missing: **🔗** creates the artist with the link, or adds the link to the matched artist. **⚠** warns that the link belongs to a different artist, or that the artist links a different Discogs page (often a wrong match). **🔗 N links** in the toolbar counts them and steps through them.

The release **Label** and release **Artist** are linked on load under the same exact-name rule.

### Recording matching

All the release group's recordings come in one request and are matched by title, artist and length. Tracks the group can't answer are looked up one by one. When a title is worded differently (*Part 1* / *Pt. 1*), the same position on other editions, and then on releases of the same title and artist in other groups, is used if the title is similar and the length agrees. A title in another script (*Kalimba Night* for *カリンバナイト*) can't be compared, so its position is used when that edition's whole medium lines up: as many tracks, and every length within the tolerance.

| Colour | Confidence | |
|:---:|---|---|
| 🔵 | Exact | every field the same |
| 🟢 | Tolerance | within the [tolerances](#settings) |
| 🟡 | Near | one field differs, or lengths 3–15 s apart |
| 🟠 | Low | two fields differ, or lengths over 15 s apart |
| 🔴 | Very low | all three differ, lengths over 10 s apart |

**Cutoff** in the toolbar sets the lowest confidence that's linked. *Credited as* doesn't affect matching.

## Tools

<img width="1200" src="./screenshots/tools.png" />

The toolbar holds the tools you choose; the rest are in **Tools ▾**, with **Customize…** to pick, reorder and show each tool as icon, text or both. A tool with settings picked from the menu joins the bar until the page closes. Right-click a tool's name to fold its settings into a hover flyout.

| Tool | |
|---|---|
| Track parser, Swap, Reset #, Guess feat., Guess case | MusicBrainz's own |
| [Search and Replace](#search-and-replace) | replace text in titles, with saved patterns |
| [Pattern parser](#pattern-parser) | a tracklist from text, by a pattern |
| [Length parser](#length-parser) | track lengths from any text or page |
| [Merge mediums, Split medium](#merge-and-split-mediums) | restructure the mediums, keeping the recordings |
| Resize columns | Fit, Centered or Default widths |
| Guess punctuation | kellnerd's [guess-unicode-punctuation](https://github.com/kellnerd/musicbrainz-scripts#guess-unicode-punctuation), when installed |
| **↺ Revert all**, **✕ Clear all** (under ▾) | back to the loaded page, or empty |

### Search and Replace

<img width="600" src="./screenshots/search.png" />

Replaces text in track titles. **★** saves patterns under a name; the last five are kept as history. **⛓** puts patterns in a **chain** run in order; **◉** marks one pattern or chain as the default, applied when the tracklist first opens. **Import / Export** is the whole set as JSON.

### Pattern parser

<img src="./screenshots/pattern_parser.png" />

Fills a medium from pasted text, by a pattern. It opens with the current tracklist, so it also bulk-edits.

| Token | | Token | |
|---|---|---|---|
| `#` | track number | `M` | medium |
| `T` | title | `-` | separator: any of `- – — / :` |
| `A` | artist | `_` | skip the rest |
| `L` | length | | |

Anything else is literal and whitespace is elastic. A capital is a token only standing alone; `$T` forces one. Fields split at the first separator; **split: last** splits at the last. Examples: `#. T`, `# A - T (L)`, `# A - T (_`.

For fixed-width text a token takes a range: `T[6-]`, `T[6-20]`, `T[-5]`, `T[~3-]` (last 3), or `[from:to]` up to a character, such as `#[1:.]` or `L[(:)]`. `~` before a character means its last occurrence: `L[~(:)]`.

Each line's dot shows whether it matched (amber: by its own pattern). A row can get its own pattern, or you select part of its raw text and bind it to a field. **🔒 Freeze matched** keeps the current pattern on every row it matches, so you can change the pattern for the rest. **Apply** writes only the fields the pattern has; its ▾ applies one field, or adds missing tracks first.

### Length parser

<img width="600" src="./screenshots/len_parser.png" />

Reads every duration (`5:50`, `1′23″`, `1:02:03`) out of text and ignores the rest. The source is typed or pasted text, the clipboard, a page linked on the release (one favicon each), or a link pasted with **Ctrl+V**; a fetched page's URL goes into the edit note.

The lengths line up with the tracks by order: **✕** removes a row, **+** inserts one, click a value to edit it. An invalid time blocks **Apply**; an empty row leaves that track's length alone. On a release with several mediums, pick the medium in the header.

### Merge and split mediums

<img width="900" src="./screenshots/merge_mediums.png" />

- **Merge mediums**: the ticked mediums go into the first of them, in order; the others are removed.
- **Split medium**: the chosen track and the ones after it become a new medium after it, in the same format.

Titles, lengths, credits and recordings are kept and tracks are renumbered. Nothing is submitted until you enter the edit. A medium with a disc ID is refused.

> [!NOTE]
> MusicBrainz records this as an *Edit medium* plus a *Remove medium* per merged-away medium, or an *Add medium* for a split. The moved tracks get new track MBIDs. Without auto-edit rights, *Remove medium* waits for votes, so the old mediums show beside the merged one until then.

### Other scripts' tools

Apollo lists a button another userscript adds to the page like one of its own. A few are recognised by their text; any element with `class="apollo-tool"` is offered too:

```html
<button class="apollo-tool" data-apollo-label="My tool" data-apollo-icon="★">…</button>
```

`data-apollo-icon` is a glyph or an image URL (default 🔧); `data-apollo-id` keeps its place on the bar. Apollo clicks the element and re-reads the tracklist, so this suits tools without inline settings.

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

A tracklist title shows styled until you click it, then becomes the input with the caret where you clicked.

<img src="./screenshots/tracklist-dark.png" />

Apollo follows a dark MusicBrainz theme, such as kellnerd's [userstyle](https://github.com/kellnerd/userstyles#musicbrainz).

## Settings

**⚙** on the **Original / Apollo** button. Column widths, the toolbar layout, **Change**, **Cutoff** and the picker's folded sections are remembered as you use them.

| Setting | Default | |
|---|---|---|
| Modify Release information, Tracklist, Recordings, Duplicates | on | replace that part of the editor |
| Modify annotations with Markdown | on | the [annotation editor](#annotation-editor) |
| Modify header and footer | on | a compact step switcher instead of the tabs and footer |
| Zen editing | on | hide the site header, title and footer; the title moves into Apollo's bar |
| Auto confirm release submissions | on | skip the confirmation page when a site seeds a release (`?skip_confirmation` bypasses it once) |
| Auto-match on start: Tracklist, Recordings | off | match on load |
| Auto-match on start: Label, Artist | on | link a release label or artist with exactly one exact match |
| Discogs artist link matching | on | match by [Discogs link](#artist-matching) and offer missing links |
| Length tolerance | 5 s | `0` for exact |
| Title tolerance | 1 | differing characters allowed |
| Ignore casing | on | case, accents and spacing don't count |
| Ignore punctuation | on | `&`/*and*, brackets, quotes, dashes and dots don't count |
| Enable detailed highlighting | on | see [Highlighting](#highlighting) |
| Row layout | normal | compact, normal or cozy |
| Alternate row colors | off | |
| Show grid | rows | lines between rows and/or columns |
| Enlarge punctuation by | 3 px | `0` stops the enlarging; the markers stay |
| Keep caret position on row navigation | on | off: a cell is selected whole on arrival |
| Highlight all instances of an artist on hover | off | |

## Shortcuts

| Where | Key | |
|---|---|---|
| Tracklist | ↓, Enter | next row |
| Tracklist | ↑, Shift+Enter | previous row |
| Tracklist | Tab, Shift+Tab | next, previous column |
| Join phrase | typing, ↓ ↑, Enter | filter the presets, move, pick |
| Length parser | Ctrl+V | read the lengths from the link on the clipboard |
| Length parser | Ctrl+Enter | apply |
| Annotation | Ctrl+B, Ctrl+I | bold, italic |
| Annotation | Tab, Shift+Tab | make or change a list, remove it |
