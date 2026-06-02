# Track Cannon

Speed up per-track **artist-credit resolution** in the MusicBrainz release editor.

When you add a release (especially via an import tool), each track's artist often arrives as
plain **text with no MBID**. Linking them one by one — searching, picking, occasionally
splitting `A feat. B` into two credits — is the slowest part of adding a release. Track Cannon
does the whole tracklist in one pass and lets you apply the confident matches with one click.

## How it resolves an artist

For every unresolved track it tries, in order:

1. **Sibling releases in the same release group.** Other versions of the same album usually
   contain the same songs already credited to real artists. Track Cannon pulls their per-track
   credits (with MBIDs) and matches by title — so it doesn't just *search*, it knows the
   *correct* artist. This is the highest-confidence source and resolves most VA compilations
   outright.
2. **Name search** against MusicBrainz's artist index for anything siblings don't cover.

Each suggestion is tagged and the whole row is tinted by confidence: **RG** (from a sibling
release) and **SET** (already linked) are green, **HIGH** (exact diacritic-folded name match) blue,
**LOW** (best guess — review it) yellow, **USER** (you changed it) purple, **NONE** (nothing found)
red. Multi-artist credits are matched slot-by-slot and the original **join phrases**
(`&`, `feat.`, `and`, …) and **credited-as** text are preserved.

## Usage

1. Open `…/release/add` or `…/release/<mbid>/edit`, go to the **Tracklist** tab.
2. Click **🎯 Track Cannon** (next to *Guess feat. artists from track titles*; a floating launcher
   also appears so it works from any tab).
3. The table mirrors MB's tracklist on a **white background**; **#**, **Title** and **Length** are
   editable (`#` takes vinyl-style `A1`/`B2`). There is **no apply phase** — confident matches
   (RG / exact-name) are written to the editor the moment matching finishes, and every later edit
   writes through immediately. Each artist line reads left-to-right:
   - **credited-as override** — shown blank when it's the same as the artist name (the name is a
     faint placeholder); type here only when the credit differs from the artist's name,
   - **person/group icon** (links to the artist page),
   - the **search bar** (same width on every line) — type to search MB live (shows *Searching…*
     while it works, highlights an exact-name match, and the popup follows the field as you scroll);
     it's **green when resolved** and **white when unmatched** (with a **＋** at the right to create
     the typed name on MB). Typing a new phrase un-links the artist (bar goes white) and keeps your
     text. The **join phrase** to the next artist (editable, right-aligned, `▾` opens presets) sits
     inside the box,
   - on hover, **↵** adds another artist to the credit and **✕** removes that artist.
   The **last column** holds a centered **confidence badge** (`rg` / `name` / `user` / `set`).
4. Multi-artist credits stack as lines within the same track row. On row hover, the track actions
   **↺** (revert the whole track — artists, title, #, length) and **✕** (remove the track) appear
   over the badge column. **Revert all** resets the whole release to its page-load state. The
   toolbar — *When I pick an artist → apply to **all matching tracks** / **this track only*** —
   controls whether a pick also copies to every track credited to the same text; when it does, the
   changed boxes **flash**, and (when more than one track changed) stay **outlined** until your next
   pick, so you can review every place it landed.
5. Title tools (toolbar, using MusicBrainz's own functions): a title that differs from its
   **Guess Case** form is highlighted amber with an **Aa** button to fix that one; **Guess case**
   fixes all titles; **Guess feat.** pulls `feat. X` out of titles into artist credits (then
   re-matches).
7. **+ Create** opens MusicBrainz's add-artist form prefilled (name + guessed sort-name) in a new
   tab; save it there, then re-open the field to match it.

## The table

Track Cannon **takes over the tracklist** as soon as a release add/edit page loads (no flash),
laid out like MB's own (▲▼ reorder · # · Title · Artist · Length · badge). MB's native tracklist —
the table, its tools row **and** the Guess-case fieldset — is hidden while Canon is on; the floating
**🎯 Track Cannon** button toggles Canon off/on (which reveals them). The unresolved count shows in
the **Artist** header. Columns are resizable by dragging near a column border **in the header or any
row** (widths remembered). **⚙** holds settings — **Auto-match artists on load**, **Alternate row
colors** and **Show grid**.

The table appears **instantly** (no wait): the tracklist renders right away and the artist matches
fill in row-by-row as MusicBrainz responds. With **Auto-match** off, the table loads unmatched and
you resolve on demand — click **Match** (toolbar) for the whole list, or just search a field.

Every structural action drives MB's real model — **reorder** (`moveTrackUp/Down`), **remove**
(`removeTrack`), **Title/#/Length** edits — so nothing diverges from the native editor, and MB's own
*Add release* button submits as usual. **Revert all** restores every track to its page-load state;
per-track **↺** (on hover) does one.

The toolbar is a **Match ▾** split-button: click **Match** to search MB for the unmatched artists;
the **▾** opens a tools menu — **Track parser** · **Swap** (titles ↔ artists) · **Reset #** — and —
**Guess feat.** · **Guess case** · **Search and Replace** (find/replace in titles; changed titles
flash). Track parser's changes are picked up automatically (the table watches the live tracklist).

Track Cannon only fills the in-page editor. **You** review and press MusicBrainz's own
*Add release* / *Enter edit* button — nothing is submitted on your behalf.

## Install

Install a userscript manager (Tampermonkey / Violentmonkey), then install the raw
`track_cannon.user.js`. Matches `musicbrainz.org` and `beta.musicbrainz.org` release add/edit pages.

## Development

```
cd userscripts/track_cannon
npm install
node test/integration.mjs          # headless end-to-end: seed → match → apply → verify
node test/integration.mjs --headed # watch it run
```

The tests drive a real logged-in MusicBrainz session via Playwright (shared `.pw-profile` at the
repo root) and seed the editor exactly the way import tools do (a flat form POST). Fixtures with
real captured release data are git-ignored (`*.local.json`) and never committed.
