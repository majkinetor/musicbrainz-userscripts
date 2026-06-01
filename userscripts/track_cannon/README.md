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
3. The panel lists **every** track — resolved ones show their current artist as a link (**↗**
   opens the artist page); unresolved ones get a candidate dropdown you can change or uncheck.
4. **Apply confident** links every RG/HIGH match; **Apply checked** links exactly what's ticked.
   **Original** (per row) restores a track's artist to what it was when the page loaded.
5. **+ Create** opens MusicBrainz's add-artist form prefilled (name + guessed sort-name) in a new
   tab; save it there, then re-open the panel to match it.
6. **⚙ → Run automatically**: opt in and Track Cannon matches on load and opens the panel itself
   the next time you open a release add/edit page (it still applies nothing until you click).

## Two modes (⚙ settings) — same table either way

It's the **same Track Cannon table** in both modes — columns laid out like MB's own
(▲▼ reorder · ↺ revert-row · # · Title · Artist · Length · ✕), rows tinted by confidence, the artist
matcher in the Artist column, multi-artist credits stacked with their join phrases, and resizable
columns (drag a header edge; widths are remembered). **`Replace MB track list`** only changes where
it lives:

- **Off — floating window** (default): the table floats beside the editor and can be dragged by its
  header. MB's own tracklist stays untouched until you Apply.
- **On — in place**: the table *replaces* the integrated tracklist.

Either way, every structural action drives MB's real model — **reorder** (`moveTrackUp/Down`),
**remove** (`removeTrack`), **Title/Length** edits — so nothing diverges from the native editor, and
MB's own *Add release* button submits as usual. **Revert all** restores every track to its page-load
state; **↺** does one track. Auto-run (if enabled) fires when you open the **Tracklist** tab, not
before — the release group may not be set earlier.

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
