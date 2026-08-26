# Group Therapy <img src="./icon.svg" align="left" width="40" height="40">

Batch operations and various helpers on the MusicBrainz *Edit relationships* page.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/group_therapy/group_therapy.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/group_therapy/group_therapy.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View Users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Group+Therapy)

**Note**: [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc) is a valuable companion script.

## Features

- Batch delete role, entity, both
- Copy/move credits from recording to recordings, work to works, release to release, release from/to recordings 
- Consolidate release-level credits across an entire release group (matrix + one-click apply)
- Match recordings to existing works (ISRC + ranked title search) and stage the *performance* relationships
- Parse unstructured credit text ("Mastering: Nick Robbins") into release relationships, with a small pattern DSL
- Set a date across a release's credits — a picker to choose the date + exactly which credits get it
- Highlight role or entity everywhere and show tooltip with overall counts
- Works on existing and newly-added relationships
- Right-click entity to open its editor

## Batch delete

Right-click a relationship's **(x)** button for a menu that removes a whole group in one go, each option showing how many it will remove:

- *Remove this one*
- *Remove “\<role\>” — all tracks*
- *Remove “\<target\>” — everywhere*
- *Remove “\<role\>” + “\<target\>”*

Each option shows its **blast radius** — the count and which tracks (or the release) it touches, e.g. *guitar — all tracks (14) · tracks 1–12*.

If you've **selected recordings/works** (ticked their checkboxes), the group options are **scoped to just those** — so *Remove “guitar”* removes it only from the selected recordings, and the menu notes the scope.

<img width="500" src="./screenshots/remove.png" />

It works exactly the same on works:

<img width="500" src="./screenshots/remove-work.png" />

### Copy / Move

Select the destination recordings (MB's own recording checkboxes) — **or none, which means every other track** — then

#### From recording/work

Right-click the source recording's checkbox for a menu (its header shows which tracks you're copying to):
- *Copy* — duplicate this recording's credits onto every destination recording, updating any it already has
- *Move* — the same, then remove them from the source. 

**Right-click a work's checkbox** to copy/move that work's own credits (writer, composer, lyricist, …) onto the selected works.

The menu lists each credit with a **checkbox** (all on by default) — untick any you don't want to copy. To pick roles fast:
- **Right-click a credit** selects only that role (e.g. just the composers); **Shift-right-click** *adds* a role to the current selection.
- Hover a credit for two buttons that **select destination tracks by that credit**: **[A]** ticks every track crediting that **artist** (in any role), **[R]** every track crediting that artist **in the same role** — so you can, say, copy a credit onto exactly the tracks that already feature that performer.

Copy/Move act on the ticked credits and the currently-ticked destinations (recomputed live), and the count updates as you go.

<img width="650" src="./screenshots/copy.png" /> 

#### Set dates

If the relationship you right-click carries a **date period** (e.g. a *recorded at “<place>”* with a date), the copy menu also offers **Set dates from (D1 → D2)…**. That date only **seeds** a picker — the tool no longer depends on the rel you invoked it from, so you're free to change it.

The **date picker** ([#398](https://github.com/majkinetor/musicbrainz-userscripts/issues/398)) lists every datable credit on the **selected tracks** (ticked recordings, or all tracks if none are ticked) as a **track → credits** tree, so you pick exactly what gets the date:

- **Header** — an editable **begin / end date** (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`) and **ended** checkbox, seeded from the rel you clicked.
- **Roles** — a remembered list (persisted across sessions) that drives the **default tick**: any credit whose role is on the list starts checked. **Right-click a credit's role** to add it to the list; **click a chip** to drop it.
- **Credits** — tick any credit by hand (the roles list is only the starting point); a **track checkbox** toggles all of its credits. Already-dated credits are shown greyed with their existing date.
- **Apply** stamps the header date onto every ticked, still-undated credit. Nothing is submitted — the edits land in the editor for you to review and save.

> [!NOTE] 
> **Fills blanks only — it can't overwrite or remove a date.** MusicBrainz's editor reducer merges a relationship update and keeps any existing non-empty date, so a date sent through it is only applied where there was none (which is why already-dated credits are shown but left unchanged). Overwriting or clearing a date would require driving MB's own edit dialog (which we deliberately don't do). See [#385](https://github.com/majkinetor/musicbrainz-userscripts/issues/385) for the details.

#### From release 

The **⧉ Copy from release…** opens a picker to choose one of **release group's** other releases. It then shows a **checklist** of that release's release-level credits (artists + labels, with credited-as, attributes and dates); pick which to copy onto this release (MB merges any it already has).

**Format-aware cleansing** — since the source may be a different edition, credits whose role doesn't suit **this** release's format start **unseleced**, so you don't carry a vinyl-only production credit onto a digital edition.

<img width="500" src="./screenshots/copy-release.png" /><br>

#### Release ↔ recordings (Vertical)

The **Vertical:** section in the toolbar copies credits between the release and its own recordings, with two icon buttons:

- **⬆ Release → recordings** — copy (or **Move**) the selected release-level credits onto its recordings, or all if none are selected. Release/packaging roles that don't belong on a recording (liner notes, compiler, mastering, artwork, design, photography, manufactured, pressed/printed, publishing, ℗/©, …) start **unselected**
- **⬇ Recordings → release** — collect the recordings' credits onto the release as a **union** across all tracks (deduped by role + artist), each row showing the **track range** it covers.

Each credit's link type is mapped to the **destination's entity type by name** (e.g. artist-recording *producer* ↔ artist-release *producer*); a role with no equivalent for that entity is skipped and counted. **Move** also removes the source rels. As always, nothing is submitted — the changes land in the editor for you to review and save.

#### Release Group Consolidation

The **▦ Consolidate RG…** button (next to *Copy from release…*) can spread release-level credits across **every** release in the group at once. It reads all the releases in parallel and builds a **role × release matrix**: one row per distinct credit, one column per release — labelled A, B, C… with a compact **format badge** (Digital / Vinyl / CD / Cassette) — and a green cell wherever the credit already exists.

- **Select** what to add: click a **cell** to toggle it, a **column-header letter** to select every addable credit for that release, or **Auto select** for the whole matrix (**Clear** resets). Credits that are format-specific for a release (e.g. *lacquer cut* on a CD) are held back and shown as `·` — click to force one in.
- The footer shows the plan (*N additions across M releases*). **Apply** creates them as real relationship edits — one batched submission per target release (auto-applied if you're an auto-editor, else queued), each carrying a **detailed edit note** that lists every added credit under the Group Therapy signature.

This is **release-level only** (recordings are already shared across a group). It uses MB's internal edit API, so the additions are submitted directly rather than staged in the editor.

<img width="800" src="./screenshots/consolidation.png" />

With more than 10 releases in a group you must pick releases to be consolidated manually.

<img width="1000" src="./screenshots/consolidation2.png" />

### Work matching

The **◎ Match works…** button links each recording on the release to an existing MusicBrainz work, so a release of standards or a hits compilation **reuses** the works that already exist instead of creating duplicates. It opens a review table — one row per recording, track on the left, matched work on the right.

<img width="800" src="./screenshots/match-works.png" />

The hard part is disambiguation — a bare title like *Beat It* matches many works. Two signals drive it:

- **ISRC** — recordings that share an ISRC almost always share a work; an `/isrc` lookup returns those works (an MB text *search* can't), the strongest signal when ISRCs are present.
- **Work autocomplete** — MB's own `/ws/js/work` endpoint (the one the native *Add relationship → Work* field uses). It returns the writers, work type, disambiguation, and **how many recordings already use each work**. Candidates are ranked by **exact-title match**, then by **popularity** — so *Beat It* resolves to Michael Jackson's work (100+ recordings) over the same-named covers. Exactness ignores a descriptive trailing parenthetical, so *Take My Breath Away (love theme from "Top Gun")* still matches the work *Take My Breath Away*.

Each row gets a **confidence dot**:

| Dot | Meaning |
| --- | --- |
| 🔵 blue | **ISRC-confirmed** — a sibling recording with the same ISRC links this work |
| 🟢 green | **unique title** — the only work with exactly this title |
| 🟡 yellow | **dominant** — exact title and clearly the most-recorded work, but other same-titled works exist |
| 🔴 red | **ambiguous** — several plausible works, often wrong; check it |

Available options:

- **Cutoff** — confidence level (persisted)
- **⚡ Match** — selects every row at and above the current cutoff (disabled while matching runs)
- **✎** (per row) — opens a picker to **search** works (writers + type shown per candidate), **paste a work MBID/URL**, or **＋ create a new work**.
- **＋ New work for unresolved** — creates a new work (named after the track) for every recording still unmatched
- **Clear all** — removes all work associations in the review table (in the ▾ menu next to Match)

**Apply** dispatches all associated works into the relationship editor, where they show up in MB's **pending edits** — the script never submits; you review and **save** yourself.

### Text parser

The **✎ Text parser…** button ([#522](https://github.com/majkinetor/musicbrainz-userscripts/issues/522)) turns unstructured credit text — liner notes, a Bandcamp/Discogs credits block, or a release's own annotation — into release-level relationships. Same idea as [Apollo](../apollo_editor/README.md)'s pattern-based track parser, adapted for credits.

![Text parser example — a wiki-style credits block, mostly auto-resolved, with one line given a per-line pattern override](https://github.com/user-attachments/assets/443f6ae0-ea8d-4f62-805d-4bb1d2ebdfcf)

Paste text (or click **Load annotation** to pull the release's latest annotation straight into the box) and type a **pattern**:

- `R: E` — `Mastering: Nick Robbins`
- `E - R` — `Nick Robbins - Mastering`
- `E[,] - R[,]` / `R[,] - E[,]` — `Cameron Allen - Flute, Tenor Saxophone` splits the role text on commas (and `[, and]` also splits on the word "and"), turning one line into several rows — one per role, same entity. Splitting *both* sides is more general than picking just one: a side with no comma is simply a no-op split, and a comma on both sides produces every (role, entity) combination — `Producer, Mixer - Alice, Bob` becomes 4 rows. `R: E[,]` does the same split on a colon-separated line — `Published by: Warner Chappell, Sony Music Publishing` becomes two rows, same role. `[&]` splits on `&` instead of a comma — `R: E[&]` for `Graphic Design: Ricardo H Fernandes & Yacine Blaeich` (needs surrounding whitespace, so a real name like "AT&T" isn't split mid-word).
- A line can also hold **several credits at once**, separated by `;` — `Guitar: Alice; Bass: Bob` becomes two rows.

`E` stands for **entity** — the credited name can resolve to either an artist, label or place, decided per row (see below), not fixed by the pattern.

A **legal/copyright notice line** is recognized automatically by its marker — no pattern is used — and produces one row per notice found. Recognized markers: **©/(C)/copyright**, **℗/(P)/phonographic copyright**, **licensed to / licensed from / under exclusive licen[cs]e to/from**, **distributed by**, **marketed by** (and **marketed and distributed by**, which fires both). A year right after the marker is optional and, if there are several ("1994, 1996"), it's dropped rather than guessed at which one applies. Multiple holders on one line — `℗ 2012 Shady Records/Aftermath Records/Interscope Records` — split into one row per holder (on `/` or `|`; a piece has to look substantial enough on its own to count, so real names like "SA/NV" aren't chopped in two). Ordinary credits and notice lines can be pasted together in the same block.

A line that packs **two different holders under two different markers** — `Copyright: Albarika Stores BV under exclusive license to Acid Jazz Acquisitions` — is auto-split into two separate lines (one marker each) the moment you paste it or load an annotation, so each holder ends up correctly separated instead of both rows sharing the same undifferentiated text. This only runs once, right after the paste/load — it won't fight you while you're editing by hand afterward.

Every entity resolves as an **artist**, **label**, or **place** decided per row: a role that only exists for one entity  (e.g. *published* is label-only, there's no artist-release equivalent at all) forces the picker to use that entity automatically, with no toggle offered. A role that exists for multiple entities (e.g. _copyright_ which exists for both artist and label), or doesn't resolve at all yet, defaults to a **label** but auto-detects as an **artist** when the name matches one of the release's own credited artists (the usual reason the ambiguity comes up — a self-released artist crediting themselves).

Every parsed line gets its own preview row, tinted by status (amber = matched but not fully resolved, red = the pattern didn't match at all, plain = ready). Role/entity auto-resolve where unambiguous — including a fuzzy fallback ("mastered by" finds "mastering", "compiled" finds "compiler"), a specific-instrument fallback, and a score-based tie-break when MB returns more than one exact name match but one is a clearly better result (e.g. a distinctly higher search-relevance score than a same-named duplicate/bootleg entry). Use **⚡ Match** at the top of the window to run auto-resolution.

Where a role/entity isn't resolved, a **search** link opens a picker (search, paste an MBID/URL, or "+" to create a new artist/label right from the search box). For an already-resolved entity specifically, a left click reopens the picker while a **right click opens the entity itself** in a new tab. When the same name appears on several rows (e.g. one person credited with four different instruments), a normal click on a search result resolves **every row sharing that text** — right-click a result to resolve only the row you clicked ([#544](https://github.com/majkinetor/musicbrainz-userscripts/issues/544)).

**Pasting an MBID or URL resolves it immediately** — there is nothing to choose between, so no result row appears to click. The **+** button creates the missing artist/label with its name, sort name and type pre-filled and an edit note attributing the creation; **right-click +** does the same without the new tab taking focus, so a run of unresolved names can be fired off and picked up as each one lands.

The role picker is keyboard-navigable: type to filter, **↑/↓** to move (**PgUp/PgDn**, **Home/End** to jump), **Enter** to take the highlighted role, **Esc** to cancel.

Each line can be fixed up without leaving the table: a **pattern override** applies just to that line, its **raw text is directly editable** (writes back into the pasted text above), and **✕** removes the line entirely (from both the table and the source text). The window has a **maximize** button and **drag-resizable columns**.

**Scope** at the bottom-left of the window decides where the credits land: the **Release** (default), or specific **Recordings**. Choosing Recordings reveals a track selector taking any mix of:

| you type | you get |
|---|---|
| `3` or `A1` | the track with that number, as shown in the editor |
| `5-7` | tracks 5 through 7 |
| `1,3` | just those |
| `2:4` / `2:4-6` | track 4 (or 4–6) **on medium 2** — a colon, so `2-4` can only ever mean a range |
| `2:*` | every track on medium 2 |
| `all` | every track |
| *(empty)* | the tracks **ticked** in the editor |

The roles offered follow the scope too: artist→recording and artist→release are different link-type vocabularies in MusicBrainz (a recording has no "booklet editor", a release has no "video appearance"), so switching scope re-matches the roles. The edit note records where the credits went — *Parsed 2 credits from text to 2 recordings (tracks 1, 3)* — so a reviewer can tell which tracks a batched edit touched.

**Apply** stages the resolved rows as real relationships in the editor and closes the tool — nothing is submitted; you review and save yourself. If the text came from **Load annotation**, an **Apply & clear annotation** button also appears: it applies, then opens the release's own annotation editor pre-cleared so you can review and submit removing the now-redundant free text in one more click. 

The pasted text and every resolution made so far are remembered for as long as the page stays open — closing and reopening the tool picks up where you left off, but a real page reload starts fresh.

**🔒 Freeze matched** pins the current pattern onto every line that still uses the default pattern *and* already matches it, so you can then try a different pattern on what is left without disturbing them — the same idea as Apollo's own freeze.

Deliberately single-line-only: multi-line/grouped-block credit formats aren't parsed, and a track reference *inside* the text (`… (A2, B3)`) is not read — scope is chosen for the whole batch, not per line.

### Replace role

Right-click a credit's **pencil** to get **Replace role …** ([#470](https://github.com/majkinetor/musicbrainz-userscripts/issues/470)). Two scopes, mirroring the ×-menu's:

- **Replace role “writer”…** — every credit with that role
- **Replace “writer” for “X”…** — that role only where the far end is that one artist

Both narrow to the **ticked recordings/works** when you have a selection, and act on everything when you don't. Pick the new role from a searchable list of the link types MusicBrainz actually accepts for that entity pair; roles you've used recently float to the top.

The motivating case ([community request](https://community.metabrainz.org/t/request-for-a-user-script/778086/18)): an all-instrumental jazz release whose works are all credited *writer* when they should be *composer* — tick the works, right-click one writer credit, replace, done.

MusicBrainz has no bulk "change relationship type", so this is a remove + re-add of the same pair under the new type. Like everything else here it only stages the change in the relationship editor — you review and **save** yourself.

> [!NOTE]
> **Attributes don't carry over.** They belong to a specific link type (a *drums (drum set)* attribute means nothing on *composer*), so MusicBrainz would reject or silently drop them. Credits that had attributes are counted in the confirmation toast so you know which ones to look at, rather than being quietly mangled.

### Highlight

Hover any entity name or role label to light up every matching occurrence on the page (existing rels blue/white, newly-added blue/yellow), with a tooltip showing the count and which  tracks / the release it appears on, e.g. *48× · tracks 1–12*.

<img width="500" src="./screenshots/highlight.png" />

## Edit note

When (and only when) you actually **use** Group Therapy on a page, it stamps MB's edit-note field with a signature line and, under it, an accumulating list of what it did — e.g. *Copied 2 credits from track 1 to tracks 2–5*, *Removed guitar (14)*. Any note already in the field is preserved, the signature is written once, and identical action lines aren't repeated. 

<img width="650" src="./screenshots/edit-note.png" />

## Settings

Open the **⚙ settings** popover from the toolbar. Every option is remembered per-browser (via the userscript manager).

| Option | Default | What it does |
| --- | --- | --- |
| **Hide help text** | on | Hides MusicBrainz's two help paragraphs at the top of the edit-relationships page. |
| **Hide native batch tools** | off | Hides MusicBrainz's own batch-tools table (`#batch-tools`). |
| **Auto-match on start** | off | Opens the work matcher and runs matching automatically when the page loads. |
| **Auto-match on open** | off | When you open the work matcher, runs matching automatically (otherwise it opens unresolved and you click **⚡ Match**). |
| **Uncollapse media on start** | off | On load, clicks MusicBrainz's **Expand all mediums** so every medium's tracks are reachable during the fill phase (MB collapses mediums past the first few). Expanding a large release takes a moment. |

## Shortcuts

| Where | Action |
| --- | --- |
| right-click a relationship's **×** | open the group-delete menu |
| right-click a recording's **checkbox** | copy / move its credits to the ticked recordings (or all tracks if none ticked) |
| right-click a work's **checkbox** | copy / move that work's credits (writer/composer/…) to the ticked works |
| **right-click an entity name** (artist / work / label / place / …) | open that relationship's **edit dialog** (invokes its pencil) — a bigger target than the small edit icon |
| right-click a credit's **＋ / pencil** | copy scoped to that role / that one credit |
| right-click a **dated** rel's pencil → *Set dates from…* | open the [date picker](#set-dates) — pick date + credits across the selected tracks |
| right-click a credit in the copy list | select only that role · **Shift** adds a role to the selection |
| **[A] / [R]** on a credit (hover) | select all tracks crediting that artist · in the same role |
| hover an entity name / role label | highlight all matches + show a count tooltip |

## Under the hood

Group Therapy drives MusicBrainz's own relationship editor: it reads each relationship straight off the rendered rows (via their React state) and writes changes through MB's reducer — the same mechanism [Credit Hoarder](../credit_hoarder/README.md) uses to dispatch credits.

The small MB-editor dispatch helper is **bundled directly into this single file** rather than shared as a separate module, so Group Therapy stays a one-file, dependency-free userscript. If that helper is ever extracted into a standalone library for both scripts to import, it will live **outside** either userscript and be documented on its own.
