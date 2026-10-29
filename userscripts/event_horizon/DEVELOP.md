# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md); tests are in [`test/`](test/).

## Pages without page loads

Event Horizon moves from page to page with `history.pushState` and draws each page in `#app`; the browser loads nothing. A userscript runs once, when the tab loads, so a script that starts from the page it finds sees only the page the tab loaded, never one reached inside Event Horizon. It runs on the wrong page, or not at all: Platform Check needs a release page with a sidebar, and a release opened on its History (`/release/<mbid>/edits`) has none, so at its Overview inside Event Horizon there was no Platform Check ([#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)).

Never fix that with a reload. The maintainer is already on the page, and a reload throws away what Event Horizon shows. Event Horizon tells the other scripts what it shows instead, and they follow it, as Mission Control drives Platform Check.

## The release shown

While Event Horizon shows a release, `<html>` carries `data-mbu-release="<mbid>"`. Turning Event Horizon off, or showing anything that isn't a release, removes it. `ehRelMark` sets it from `setOn` and from `show`.

Platform Check follows it ([its DEVELOP.md](../platform_check/DEVELOP.md#following-event-horizon)): it watches the attribute and scans each release named there, reading it from the API. ISRC Scout (`isFollow`) and Mission Control (`mcFollow`) do the same while their windows are shut, with no reload. Mission Control reads its tracklist off the page only on the release the tab loaded. A script that wants to follow does the same: a `MutationObserver` on `document.documentElement` with `attributeFilter: ['data-mbu-release']`, plus one read at start, since the attribute may already be there.

## The page shown

While Event Horizon shows, `<html>` carries `data-mbu-page` with the page's path and query; off, it is removed. `ehPageMark` sets it, beside `ehRelMark`.

String Theory reads it ([its DEVELOP.md](../string_theory/DEVELOP.md#runtime)): a tab loaded on a page a script isn't for never starts that script, so a release reached inside Event Horizon from the home page had no Platform Check, ISRC Scout or Mission Control at all, though all three can read the release from the API. String Theory starts them there. Falcon, which runs on every page, watches it to put its icon on a release, release group or series.

## MusicBrainz's page stays in the document

While Event Horizon shows, MusicBrainz's body is hidden after Event Horizon's, not detached ([#853](https://github.com/majkinetor/musicbrainz-userscripts/issues/853)), so the scripts that read the page (Mission Control's tracklist, Platform Check's catalog numbers, Art Station's links) still find it.

That body is always the page the tab loaded. After moving inside Event Horizon, a read of `h1`, `#sidebar` or the label list returns the loaded release, not the one shown. A script that follows `data-mbu-release` reads nothing off the page (Platform Check's `PC_FOLLOW`). A selector meant for Event Horizon's own page is scoped to `#app`.

## The dock

While Event Horizon shows, `<html>` carries `data-mbu-dock`, and the other scripts' corner launchers fold into String Theory's `#mbu-dock` (`mbuDockItem`, a shared block). An entry's `paths` is a regular expression on the path; on a page it doesn't match, the entry is hidden (`data-mbu-docked=off`). Event Horizon calls `mbRestackCorner('br')` on every `show`, so the dock follows the page shown.

A dock entry whose script didn't start on the loaded page isn't there at all. Platform Check now starts everywhere it may be needed and builds its panel in a hidden host (`#mb-pc-eh-host`) until the dock opens it.

## Kept answers

A page loader's requests go through `kept` ([#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)): `wsk` for ws/2, `mbTabK` for a MusicBrainz table, and the Wikipedia extract and cover art. Each answer is kept in IndexedDB (`eh-kept`, the 800 last used), and a page seen before draws from it without asking. Once all of a page's parts are in, `kpCheck` asks again, one at a time, for each kept answer it drew from that is over a minute old or older than the tab's last return to view. If one changed, the page redraws whole (`show(key, { quiet: true })`), unless a box in it is being typed in.

- **MusicBrainz's JSON comes with its keys in a different order every time.** `kpCanon` sorts them before an answer is kept or compared; without it every answer looks changed.
- **A write voids what is kept**: a rating, a tag vote or an alias edit calls `kpWrote`, which sets `eh.kept.drop` in localStorage, and every entry older than it is a miss, in every tab.
- **The release's front cover is kept as an image** (`keptCover`, the 60 newest), keyed by the image's id. CAA's address redirects twice (to archive.org, then to a mirror) and neither redirect carries a cache header, so the browser repeats both on every draw, about a second, even with the image itself in its cache. Keeping the answer listing the images isn't enough.
- **Not kept**: edits, paging, and anything a write reads back. They go through `ws`, uncached.

## Leading the gate

While a page loads, its tab leads the shared request gate (`mbnLead`, [#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)): every other background ws/2 request, in any script or tab, waits until the lead ends, so the page the reader asked for isn't queued behind Platform Check's or ISRC Scout's scans. The page's own requests pass `{ lead }` to `mbnFetch` and renew it; it ends once all the page's parts are in, or when the page fails. A lead not renewed lapses after 8 seconds (the gate caps one at 10), so a tab closed mid-load holds no one for long. A hidden tab doesn't lead, and `kpCheck`'s requests don't carry the lead.

## Declarations setOn can reach

`setOn` runs while the script starts, before the rest of the file has run, so whatever it calls must exist by then. A `let`, `const` or arrow function declared below the call is in its temporal dead zone and throws. Declare such things with `var` and a `function` declaration (as `ehRel` and `ehRelMark` are).

## Keeping the page still

The filter redraws the page on every letter, and every redraw is a chance to move it:

- While typing, the page keeps its tallest height, so a shrinking list doesn't scroll it. Leaving the filter box lets the height go.
- A redraw leaves a shown pinned bar shown, so it doesn't slide out and back in.
- A shown pinned bar takes the new action row at once after a redraw. Left to its observer, the row left the header a frame later, and the page moved 14px on every letter.
- `html{scrollbar-gutter:stable}`: a scrollbar that comes and goes (a section hidden from the contents) would shift the whole page sideways.

## Tests

- The harness's `inject` runs a script the way a userscript manager does, without waiting for the promise its body returns. Platform Check's body is an `async` function that waits for `data-mbu-release` on a page with no sidebar; awaiting it would hang the test.
- A spec that lifts a function out of a script with `functionSource` must define every name the function uses. Platform Check's `pcPageLabels` reads `PC_FOLLOW`.
- [`st-dock.spec.mjs`](test/st-dock.spec.mjs) covers the dock and Platform Check following the release shown: from a release's History to its Overview, and from one release to another through its artist and a release group.
