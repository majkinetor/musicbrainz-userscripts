# Apollo Editor <img src="icon.svg" align="left" width="48" height="48">

UI and tools for advanced adding and editing of a MusicBrainz release.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/apollo_editor/apollo_editor.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/apollo_editor/apollo_editor.user.js)

<img width="500" src="./screenshot.png" /> <img width="500" src="./screenshot2.png" />

https://github.com/user-attachments/assets/b668f472-c3cc-4487-913c-50ff1d950c5b

When you add a release, each track's artist may be set as **plain text with no MBID**, and the recordings are unset. Linking them one by one — searching, picking, occasionally splitting *A feat. B* into two credits — is the slowest part of adding a release. Apollo Editor does the whole tracklist and recording set in one pass and lets you apply the confident matches with one click.

It replaces the native **Tracklist** and **Recordings** editors with two clean, consistent tables. Each takeover is optional and you can flip back to the native editor at any time with the **Original / Apollo** button.

## Features

- **Tracklist editor**
    - Artist picker with confidence highlight
        - Option to change all appearances of selected artist (or its *Credited as* field) with highlight
    - Split artist with join-phrase selector
    - Artist aliases in search results and in selection
    - Icon representing artist type and direct link
    - Track actions: create, split, guess case
        - Right click to execute action on all tracks
    - Reorder tracks within a medium with the ⠿ handle
    - Keyboard navigation
    - Highlighting of changed rows and split artists
- **Recordings editor**
    - Side-by-side _Track ↔ Recording_ comparison with a confidence circle per row and inline highlighting of the fields that differ.
    - Recording picker with MusicBrainz suggestions, free-form search, linked "appears on" releases, confidence highlights
- **[Matching](#matching)**
    - Auto-match artists and recordings in one click
    - Release group consideration for quick and precise matching
    - Configurable match tolerance — length (seconds), title (edit distance), ignore casing and punctuation
- **[Toolbar](#toolbar)**
    - Tools relocated to always-visible **Tool** button, with some new tools
    - Revert/Clear for a single track or the whole table
- **[Customization](#settings)** — resizable columns, alternate row colors, grid, multiple layouts

## Matching

Apollo can automatically match unresolved **artists** and **recordings**. Both work the same way: a *Match* button, a per-row **confidence**, and the single best candidate applied automatically while anything uncertain is left out. If _Auto-match on start_ is enabled in the [settings](#matching-1), matching will be automatically started on entering add/edit release page.

### Artist matching

Apollo resolves each unmatched track artist in two stages, in order:

1. Sibling releases (same release group) — it pulls the per-track credits (with MBIDs) from other versions of the album and matches by track title. Other editions usually credit the same songs to the same artists, so this resolves most cases at the highest confidence — especially various-artists compilations.
2. Name search — for anything siblings don't cover, it searches the MusicBrainz artist index by the credited name. An exact name is taken as high-confidence only when it's unambiguous; artists that share exact name are left out.

Each resolved artist is tagged by how it matched (release-group, name, pre-existing, or manual).

**Confidence levels**:

1. 🟢 Green colored artist box means the artist was matched confidently (release-group or unambiguous exact name).
1. ⚪ White search box — unresolved or low-confidence, left for user to pick; these are what the "N unresolved" counter counts and what clicking that badge jumps to.

### Recording matching

Apollo fetches **every recording in the release group in one request**, indexes them by title, and matches each track **locally** — choosing the highest-confidence candidate (title + artist + length). It only falls back to a per-track MusicBrainz lookup for the few tracks the release group can't satisfy. A full release therefore matches in roughly one fetch rather than one request per track.

A *Credited as* values on track and recording don't influence matching.

**Confidence levels**:

| Color |     Meaning      |                               Description                               |
| :---: | ---------------- | ----------------------------------------------------------------------- |
|   🔵   | Exact            | All fields are the same                                                 |
|   🟢   | Within tolerance | Matches within tolerance defined in Options                             |
|   🟡   | Low              | A single field differs, or the length gap is 3–15s (a near-miss)        |
|   🟠   | Very low         | Two fields differ or the length gap alone is >15s (substantially wrong) |
|   🔴   | Extremely low    | All three differ and the length gap is >10s (almost certainly wrong)    |

The *Ignore at* option in the recording toolbar sets the confidence at which auto-match will stop linking recordings.

### Matching options

Setup matching options in ⚙ → Matching:

- **Length tolerance** (seconds) — a length gap within N seconds counts as a match. Use `0` for exact.
- **Title tolerance** (characters) — allow up to N differing characters in the title (edit distance) and still call it a match. Use `0` for exact.
- **Ignore casing** — case / accent / spacing-only differences don't count.
- **Ignore punctuation** — `&` → `and`, brackets, quotes, dashes and dots are stripped before comparing.

## Tools

Native tools are hidden and moved to the single **Tool** button at the top of the table that stays always visible. All tools are reachable from the button's menu and the last one used becomes the default. Tools with parameters show them next to the button; parameterless tools fire on pick.

Besides the integrated tools, there are a few new ones:

- **Search & Replace** — search a string within track titles and replace it. Clicking the button starts a fresh session with any existing parameters applied and cleared.
- **Resize Columns** — set column sizes to predefined variants (auto-fit, centered, default).

## Toolbar

| Control | Default | What it does |
|---|---|---|
| **Change** | all matching tracks | Apply edit/selection to just the edited track or propagate to every track with the same credit |
| **⚡ Match** | — | Match all still-unresolved track artists or recordings (used when *Auto-match on start* is off). |
| **▾** | — | **↺ Revert all** — every track back to page-load state<br>**✕ Clear all** — empty artist of every track|
| **Tool** | last used | A single always-visible button holding all the tools. The last tool used becomes the default; tools with parameters show them inline. |
| **Cutoff** | 🟠 very low | Matches only records at or above the chosen confidence level and leave other unmatched |

## Settings

Opened using the **⚙** button on the [toolbar](#toolbar).

Settings are saved in the browser (localStorage) and persist across releases.

### Replace … on start

On page load, swaps the native table editor for the Apollo table. The **Original / Apollo** button still toggles it anytime — this only sets the *initial* state.

### Matching

| Option | Default | What it does |
|---|---|---|
| **Auto-match on start**| On<br>Off | **Tracklist** - Matches artists automatically when the page loads<br>**Recordings** - Matches recordings automatically when the page loads|

### Appearance

Applied to **both** tables (Tracklist and Recordings).

| Option | Default | What it does |
|---|---|---|
| **Row layout** | normal | Row density: `compact` (tight) · `normal` · `cozy` (airy). |
| **Alternate row colors** | Off | Tints every other row (and deepens the matched-box green on alternate rows). |
| **Show grid → columns** | Off | Vertical separators between columns. |
| **Show grid → rows** | On | Horizontal lines between tracks. |

## Persistence

These are remembered automatically as you use the UI:

- **Column widths** — drag a column border to resize; reset/auto-fit via the **Resize Columns** tool.
- **Suggestions collapsed** — the picker remembers whether its *suggestions* section is collapsed.
- **Last tool used** — becomes the default action of the **Tool** button.
- **Apply mode**, **Ignore at**, and all dialog options above — saved on change.
