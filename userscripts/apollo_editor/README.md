# Apollo Editor <img src="icon.svg" align="left" width="48" height="48">

UI and tools for advanced adding and editing of a MusicBrainz release — both its **tracklist** (track titles, artists, lengths) and its **recordings**.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/apollo_editor/apollo_editor.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/apollo_editor/apollo_editor.user.js)

<img width="1000" src="./screenshot.png" />

https://github.com/user-attachments/assets/b668f472-c3cc-4487-913c-50ff1d950c5b

When you add a release (especially via an import), each track's artist usually arrives as plain **text with no MBID**, and the recordings are unset. Linking them one by one — searching, picking, occasionally splitting `A feat. B` into two credits — is the slowest part of adding a release. Apollo Editor does the whole tracklist and the whole recording set in one pass and lets you apply the confident matches with one click.

It replaces the native **Tracklist** and **Recordings** editors with two clean, consistent tables. Each takeover is optional and you can flip back to the native editor at any time with the **Original / Apollo** button — see _Replace … on start_ in the settings.

## Features

- **Auto-match artists and recordings** in one click. The whole release group is pulled in a **single request**, so a full release matches near-instantly.
- **Recordings tab**: side-by-side _Track ↔ Recording_ comparison with a confidence dot per row and inline highlighting of the fields that differ.
- **Recording picker** (click any recording): MusicBrainz suggestions, free-form search (`show all` for a relaxed title-only search), `＋ new recording`, linkable "appears on" releases — draggable and dockable.
- **Configurable match tolerance** — length (seconds), title (edit distance), ignore casing, ignore punctuation. A _credited-as_ name is never treated as a different artist.
- Aliases shown in search results and on resolved artists, a direct **artist link**, and a quick **create-artist** button.
- **Split artist** on a join phrase; **join-phrase selector**; apply an artist / credited-as change to a single track or **all matching tracks**.
- **Table customization** — resizable columns, alternate row colors, grid (columns / rows), and `compact / normal / cozy` layouts, applied to both tables.
- Reorder tracks within a medium with the ⠿ handle, keyboard navigation, highlighting of changed rows.
- **Revert** or **Clear all** for a single track or the whole table (recordings or tracklist).
- Tools relocated to one always-visible **Tool** button, plus new tools.

## Matching

Apollo matches in two places — track **artists** (Tracklist tab) and track **recordings** (Recordings tab). Both work the same way: a **Match** button (or _Auto-match on start_ in the settings), a per-row **confidence dot**, and the single best candidate applied automatically while anything uncertain is left for you.

**Confidence** is shown by the dot colour: 🟢 matches → 🟡 low → 🟠 very low → 🔴 extremely low, graded by how many fields differ (title, artist, length) and how far off the length is. The **ignore below** selector sets the worst confidence auto-match will still link (e.g. _very low_ links anything better, _nothing_ links everything). All the differences are softened by the matching options below, so a cosmetic difference doesn't drop the confidence.

### Track artists (Tracklist)

For every unresolved artist it tries, in order:

1. **Sibling releases in the same release group** — other versions of the album usually credit the same songs to the same artists. Apollo pulls their per-track credits (with MBIDs) and matches by title. Highest confidence; resolves most various-artists compilations outright.
2. **Name search** — the MusicBrainz artist index for anything siblings don't cover. An exact name is taken as high-confidence only when it's **unambiguous**; when several artists share that exact name, one has to be picked manually.

Each resolved artist is tagged by how it was matched (release-group, name, pre-existing, or manual).

### Recordings

Apollo fetches **every recording in the release group in one request**, indexes them by title, and matches each track **locally** — choosing the highest-confidence candidate (title + artist + length). It only falls back to a per-track MusicBrainz lookup for the few tracks the release group can't satisfy. A full release therefore matches in roughly one fetch rather than one request per track.

Anything auto-match can't resolve confidently you set by hand: click a recording cell to open the picker, which offers MusicBrainz's own suggestions, a free-form search, and `＋ new recording`. The same colour code and the field highlights tell you exactly how a candidate differs from the track.

### Matching options (⚙ → Matching)

- **Length tolerance** (seconds) — a length gap within N seconds counts as a match (MB lengths jitter; sub-second/off-by-one differences are not real mismatches).
- **Title tolerance** (characters) — allow up to N differing characters in the title (edit distance) and still call it a match. `0` = exact.
- **Ignore casing** — case / accent / spacing-only differences don't count.
- **Ignore punctuation** — `&` → `and` and brackets, quotes, dashes and dots are stripped before comparing.

A **credited-as** name (the same artist entity credited under a different name) is always treated as a match, never an artist mismatch.

## Tools

Native tools are hidden and moved to the single **Tool** button at the top of the table that stays always visible. All tools are reachable from the button's menu and the last one used becomes the default. Tools with parameters show them next to the button; parameterless tools fire on pick.

Besides the integrated tools, there are a few new ones:

- **Search & Replace** — search a string within track titles and replace it. Clicking the button starts a fresh session with any existing parameters applied and cleared.
- **Resize Columns** — set column sizes to predefined variants (auto-fit, centered, default).
