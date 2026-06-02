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
     text. You can also **paste an MBID or a MusicBrainz `/artist/<mbid>` URL** to link that artist
     directly, and the dropdown shows each artist's **alias** — the English one if present, else the
     first — (handy when the name is in another script; the alias is also shown on the resolved bar).
     The **join phrase** to the next artist (editable, right-aligned, `▾` opens
     presets) sits inside the box,
   - on hover, **↵** adds another artist to the credit and **✕** removes that artist.
   The **last column** holds a centered **confidence badge** (`rg` / `name` / `user` / `set`).
   **↑/↓** jump to the same field in the previous/next row (in the search box this works once the
   artist is resolved — while you're searching, ↑/↓ still browse the results popup).
4. Multi-artist credits stack as lines within the same track row. On row hover, the track actions
   **↺** (revert the whole track — artists, title, #, length) and **✕** (remove the track) appear
   over the badge column. **Revert all** resets the whole release to its page-load state. The
   **Artist** column header holds an *apply-to* dropdown — **all matching tracks** / **single
   track** — controlling whether a pick also copies to every track credited to the same text; when it
   does, the changed boxes **flash**, and (when more than one track changed) stay **outlined** until
   your next pick, so you can review every place it landed. Editing a **Credited as** override
   propagates the same way (in *all matching tracks* mode).
5. Title tools live in the **Tools** menu (using MusicBrainz's own functions): a title that differs
   from its **Guess Case** form is highlighted amber with an **Aa** button (shown on row hover) to fix that one — like
   MB's integrated guess case, **hovering the title** previews the guessed form (green) in place,
   **leaving** restores it, and **clicking Aa** applies it; **Guess case** fixes all titles (with
   language / *Keep uppercased* / *Uppercase Roman numerals* options inline); **Guess feat.** pulls
   `feat. X` out of titles into artist credits (then re-matches).
7. **+ Create** opens MusicBrainz's add-artist form prefilled (name + guessed sort-name) in a new
   tab; **save it and the tab closes and the new artist drops into the field automatically**
   (a `BroadcastChannel` handshake, like the Discogs importer — needs the script's `/artist/*` match).

## The table

Track Cannon **takes over the tracklist** as soon as a release add/edit page loads (no flash),
laid out like MB's own (▲▼ reorder · # · Title · Artist · Length · badge). MB's native tracklist —
the table, its tools row **and** the Guess-case fieldset — is hidden while Canon is on; the floating
**Original / Track Cannon** button (bottom-right) toggles Canon off/on (which reveals them). MB's **medium-format header**
stays in place above each medium's table and is tidied: once a format is chosen it collapses to just
the format name as text (click it to re-open the dropdown), keeping the medium move/remove buttons;
with **no** format selected the full native header stays so you're still prompted to pick one. The
capitalization warnings are hidden.

Canon renders **one table per medium** (mirroring MB's layout): the global toolbar sits once at the
top, then each medium shows its native **format header**, its **Canon table**, and an **Add _N_
track(s) ＋** footer that drives MB's add-tracks for that medium. MB's **▼ collapse** toggle collapses
that medium's Canon table too. **Adding or removing a whole medium** re-renders automatically, and the
script works on a fresh `…/release/add` with **no tracks yet**. The unresolved count shows in
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

The toolbar splits left/right. On the **left** is a **Tools** split-button: the **▾** picks a tool —
**Track parser** · **Swap** (titles ↔ artists) · **Reset #** · **Guess feat.** · **Guess case** ·
**Search and Replace** — and the *last tool you used* becomes the button's label and its default
action (click it to run that tool again). Option-less tools fire on pick; tools with options
(**Guess case**, **Search and Replace**) reveal their controls **inline to the right** of the button.
The medium-scoped tools (**Track parser**, **Reset #**, **Swap**) act on one medium: with a single
medium they just apply, and with several an inline **Medium** combo appears to pick the target (then
click the Tools button to run).
Search & Replace runs in **real time** — type in *search* / *replace* and titles update live (cleared
*search* restores them); no apply step. Clicking **Search and Replace** again starts a fresh session
(the fields clear and re-snapshot — earlier replacements stay applied). On the **right** sit **Match** (search MB for the unmatched
artists), **Revert all** and **⚙**. Track parser's changes are picked up automatically (the table
watches the live tracklist).

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
