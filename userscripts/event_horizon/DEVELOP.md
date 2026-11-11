# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md); tests are in [`test/`](test/).

## Alias editor

The alias popup and Aliases page use the same shared editor as Apollo. Its Discogs importer is described in [Apollo's Discogs artist links](../apollo_editor/DEVELOP.md#discogs-artist-links); it uses the already-loaded native aliases page, without relying on Event Horizon's rendered sidebar.

## Pages without page loads

Event Horizon moves from page to page with `history.pushState` and draws each page in `#app`; the browser loads nothing. A userscript runs once, when the tab loads, so a script that starts from the page it finds sees only the page the tab loaded, never one reached inside Event Horizon. It runs on the wrong page, or not at all: Platform Check needs a release page with a sidebar, and a release opened on its History (`/release/<mbid>/edits`) has none, so at its Overview inside Event Horizon there was no Platform Check ([#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)).

Never fix that with a reload. The maintainer is already on the page, and a reload throws away what Event Horizon shows. Event Horizon tells the other scripts what it shows instead, and they follow it, as Mission Control drives Platform Check.

## Edit search

Both empty and populated `/search/edits` pages use the history viewer. `esMount` moves the live native `#edit-search` form, preserving MusicBrainz's delegated condition handlers, hidden `#fields` templates and entity autocomplete. `esPark` puts it back at its original marker before a redraw or navigation; `esMoving` prevents this temporary move from closing a focused picker. Drafts and picker state survive history regrouping. Turning EH off restores the native controls. The empty page does not request results. Search results retain the server's order instead of the history viewer's default descending ID order. The history toolbar sticks below the pinned header using `--eh-pin-h`.

Every native select gets a filterable sibling picker; never wrap or replace the select, since MusicBrainz's handlers depend on its immediate parent. Pickers retain original values, including comma-separated edit-type groups, repeated arguments and distinct `no` (no vote) and `0` (No) values. Changes bubble from the original select. The observer rebuilds controls for native row changes and removes presentation nodes cloned with the trailing condition row. Native autocomplete menus follow their inputs into the visible body.

`esTop` compacts the native sentence into three icon menus. Edit kind and sort retain their original selects and every native option; only trigger labels are shortened. A nameless matching select projects All/Any/None/Not all onto the original `negation`/`combinator` pair: `0/and`, `0/or`, `1/or`, `1/and`. Only the native pair is serialized. Native controls and text nodes are retained and restored when EH is switched off. [`search-options.spec.mjs`](test/search-options.spec.mjs) checks all four saved-query combinations and the native/EH round trip.

Arrow keys change the active option without moving focus from the filter; `aria-activedescendant` identifies it, and Enter selects or toggles it. Every editable form input, including native dates and lookups, saved-search names and picker filters, uses `type=search`, autocomplete off and password-manager ignore attributes. Originally numeric fields keep a numeric input mode; original types are restored when EH is switched off.

Edit-search links and submissions load the destination normally so MusicBrainz initializes its own form and autocomplete there. This is a new search navigation, not a reload of the entity already showing. New search removes the live condition rows, restores the top controls' defaults and pushes the empty search URL through EH without loading a page; MusicBrainz's condition counter can keep increasing, as it does when native rows are removed. The homepage entry sits immediately after Advanced search.

`editSearches` in GM storage holds `{name, query}` entries. Queries serialize the live form, without pagination or the unprefixed trailing `field`; repeated arguments and draft values are preserved. Loading uses the current MusicBrainz origin. The saved-search toolbar uses one name input for editing and library filtering, with Save and a More menu. Save updates the selected entry, including a renamed name; a case-insensitive collision with another entry is rejected. Save a copy clears the selected identity and proposes an unused name. A transient `eh.editSearch` sessionStorage entry carries the selected name and query across navigation, distinguishing entries with identical filters; query comparison ignores pair order, pagination and the empty trailing field. Existing entries are recognized by their query without migrating GM storage. [`edit-search.spec.mjs`](test/edit-search.spec.mjs) covers every native predicate and option, ranges, native lookup selection, saved-search round trips and the homepage entry; [`saved-search-toolbar.spec.mjs`](test/saved-search-toolbar.spec.mjs) covers renaming, copying, collisions, filtered loading, deletion and New search.

## The release shown

While Event Horizon shows a release, `<html>` carries `data-mbu-release="<mbid>"`. Turning Event Horizon off, or showing anything that isn't a release, removes it. `ehRelMark` sets it from `setOn` and from `show`.

Platform Check follows it ([its DEVELOP.md](../platform_check/DEVELOP.md#following-event-horizon)): it watches the attribute and scans each release named there, reading it from the API. ISRC Scout (`isFollow`) and Mission Control (`mcFollow`) do the same while their windows are shut, with no reload. Mission Control reads its tracklist off the page only on the release the tab loaded. A script that wants to follow does the same: a `MutationObserver` on `document.documentElement` with `attributeFilter: ['data-mbu-release']`, plus one read at start, since the attribute may already be there.

## The page shown

While Event Horizon shows, `<html>` carries `data-mbu-page` with the page's path and query; off, it is removed. `ehPageMark` sets it, beside `ehRelMark`.

String Theory reads it ([its DEVELOP.md](../string_theory/DEVELOP.md#runtime)): a tab loaded on a page a script isn't for never starts that script, so a release reached inside Event Horizon from the home page had no Platform Check, ISRC Scout or Mission Control at all, though all three can read the release from the API. String Theory starts them there. Falcon, which runs on every page, watches it to put its icon on a release, release group or series.

## Header menu configuration

The Menu settings live in the manager's `view` value: `menuTitles`, `menuResponsive`, `menuOrder` (action IDs), `menuOff` (hidden IDs), and `menuPlaces` (ID to `main` or `more`). Empty collections retain the shipped defaults. `menuKey` unifies Art, Relationships and collection Edit across entity types; page renderers still decide which actions and URLs are available. External launchers use `external:<registration ID>` and default to More.

`actionRow` marks links with `data-menu-key`; `menuLayout` moves the existing nodes between the row and More without recreating handlers or URLs. It hides configured actions, fits Main first, then promotes More items when Responsive is enabled. Both destinations are sorted by the configured order after fitting. Narrow pinned bars put all actions in More. Search, Star, Home and page-specific utility controls stay outside this configuration. Settings changes refit every live header; redraws, launcher updates, fonts and resizing refit again. Dragging and keyboard operation on the row handles persist order without redrawing the page.

## External menu items

Any userscript can add an item to **More (⋯)** in the page header and pinned header. Registration is a hidden, connected `button`, owned by the launching script. Event Horizon projects its title and optional icon into its menus and calls the original button's `.click()` when selected. No function crosses a userscript sandbox and no JavaScript string is evaluated.

| Attribute or property | Contract                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `data-mbu-menu-item`  | required, nonempty unique ID, namespaced by the registering script; first eligible registration in document order wins |
| `data-mbu-menu-title` | required, nonempty plain text; never HTML or a browser tooltip                                                         |
| `data-mbu-menu-icon`  | optional image URL: HTTP(S), relative URL, or PNG/GIF/JPEG/WebP/SVG image data URL; invalid schemes are ignored        |
| `disabled`            | hides the item until enabled again                                                                                     |
| `hidden`              | keeps the source button out of the page; it does not hide the projected menu item                                      |
| click handler         | the launcher's code, installed by its own userscript; called once per selection, with the menu closed first            |

```js
const launcher = document.createElement('button');
launcher.type = 'button';
launcher.hidden = true;
launcher.dataset.mbuMenuItem = 'my-script:analyse';
launcher.dataset.mbuMenuTitle = 'Analyse this page';
launcher.dataset.mbuMenuIcon = 'https://example.org/my-script.png'; // optional
launcher.addEventListener('click', () => {
    // Your script launches here. Read the current path, not a captured page ID.
    analysePage(location.pathname + location.search);
});
document.documentElement.append(launcher);

// Change the label or availability in place; remove to unregister.
launcher.dataset.mbuMenuTitle = 'Analyse tracks';
launcher.disabled = false;
// launcher.remove();
```

Registration works before or after Event Horizon starts. Attribute changes, disable/enable, removal, redraws and pinned-header moves are observed. Add the source button directly under `<html>` so it survives body swaps. It stays the same element and keeps its listener; do not bind a handler to the projected copy. The launcher receives a synthetic click, so code requiring a trusted browser event must use its own interaction.

Each registration is available in every header with an action row until disabled or removed. The registering script owns page support: observe `data-mbu-page` ([the page shown](#the-page-shown)) and enable, disable or replace its registration when the current page changes. Do not scrape the hidden native body after EH navigation. A menu item runs the launcher only; it does not implicitly toggle EH, reload a page, or appear in the command palette. A native-page tool such as SAED owns its handoff and any restart after a reload. The protocol has no SAED-specific detection.

For temporary keyboard and corner suppression, see [interoperability](../../DEVELOP.md#interoperability).

## The header's tag editor

While the pencil's editor is open, every redraw fires `mbu-tags-edit` on `document` with `{path, box}`: the entity's path and the editor's element. Closing fires it with `box: null`. An `mbu-tags-add` event with `{names}` upvotes those tags through the editor; names sent before its tags load wait, as typed ones do. Fuzzy Logic uses both: a button under the box opens its window, whose votes go through the editor. Anything placed there must sit outside the box, since each redraw replaces the box's contents.

## MusicBrainz's page stays in the document

While Event Horizon shows, MusicBrainz's body is hidden after Event Horizon's, not detached ([#853](https://github.com/majkinetor/musicbrainz-userscripts/issues/853)), so the scripts that read the page (Mission Control's tracklist, Platform Check's catalog numbers, Art Station's links) still find it.

That body is always the page the tab loaded. After moving inside Event Horizon, a read of `h1`, `#sidebar` or the label list returns the loaded release, not the one shown. A script that follows `data-mbu-release` reads nothing off the page (Platform Check's `PC_FOLLOW`). A selector meant for Event Horizon's own page is scoped to `#app`.

## The dock

While Event Horizon shows, `<html>` carries `data-mbu-dock`, and the other scripts' corner launchers fold into String Theory's `#mbu-dock` (`mbuDockItem`, a shared block). An entry's `paths` is a regular expression on the path; on a page it doesn't match, the entry is hidden (`data-mbu-docked=off`). Event Horizon calls `mbRestackCorner('br')` on every `show`, so the dock follows the page shown.

### Actionable entries in the minimized dock

Each script owns its findings and its badge text. `mbuDockItem` returns the entry button: call `item.status(text)` for the badge, `item.busy(on)` for loading, and `item.card(fn)` for its hover card. For a composite count, set `item.toggleAttribute('data-mbu-actionable', hasAction)` **before** `item.status(text)`; the status call restacks the dock. Clear the attribute when no action remains, and call `status` or `mbRestackCorner('br')` to update visibility.

With the dock minimized, `mbuDock` shows an eligible entry as `data-mbu-docked="peek"` when that attribute is present. It also peeks at a badge beginning with a nonzero digit (optionally prefixed by `+`) for existing scripts that do not set the flag. An absent or false flag therefore does not override a positive-leading badge. The dock does not parse composite counts to decide what their parts mean: the script must set the flag when a later part is actionable.

ISRC Scout sets the flag for either new ISRCs or links, so `0,7` peeks. Platform Check sets it for platforms to link or artist and label links, so `0/1` and `0,3/2` peek; withheld platforms alone (`0,3`) do not. A script must update its flag and badge together as its results change. These dock signals do not define Mission Control's findings, which Mission Control handles separately.

A dock entry whose script didn't start on the loaded page isn't there at all. Platform Check now starts everywhere it may be needed and builds its panel in a hidden host (`#mb-pc-eh-host`) until the dock opens it.

## Network usage

All scripts share one gate for MusicBrainz, across tabs: about one ws/2 request a second, and everyone holds when MusicBrainz asks for a wait. Event Horizon adds these rules:

| Request                          | Place                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| The page being opened            | first: its tab leads, and every other background request waits       |
| Other scripts' scans (PC, IS, …) | wait for a lead to end, then first come, first served                |
| Rechecking a kept answer         | after the page, one at a time, no lead                               |
| Pending edits                    | last: joins the queue after a pause, and only in a visible, idle tab |

For example, open a release while Platform Check is scanning. Requests it has booked still go; the rest wait. The release's parts load, and the lead ends. Platform Check carries on, kept answers are rechecked in between, and the pending edits request joins about 2 seconds later. Move to another page and whatever hasn't started is dropped.

What saves requests:

- **Kept answers**: a page seen before draws from IndexedDB, and only answers over a minute old are asked again ([Kept answers](#kept-answers)). A write voids them.
- **Cover images**: the newest 60 are kept, so CAA's two redirects aren't repeated.
- **Pending edits**: an answer is reused for 5 minutes, and the option turns the request off ([Pending edits](#pending-edits)).
- **A hidden tab** takes no lead and sends no pending edits request.

## Kept answers

A page loader's requests go through `kept` ([#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)): `wsk` for ws/2, `mbTabK` for a MusicBrainz table, and the Wikipedia extract and cover art. Each answer is kept in IndexedDB (`eh-kept`, the 800 last used), and a page seen before draws from it without asking. Once all of a page's parts are in, `kpCheck` asks again, one at a time, for each kept answer it drew from that is over a minute old or older than the tab's last return to view. If one changed, the page redraws whole (`show(key, { quiet: true })`), unless a box in it is being typed in.

- **MusicBrainz's JSON comes with its keys in a different order every time.** `kpCanon` sorts them before an answer is kept or compared; without it every answer looks changed.
- **A write voids what is kept**: a rating, a tag vote or an alias edit calls `kpWrote`, which sets `eh.kept.drop` in localStorage, and every entry older than it is a miss, in every tab.
- **The release's front cover is kept as an image** (`keptCover`, the 60 newest), keyed by the image's id. CAA's address redirects twice (to archive.org, then to a mirror) and neither redirect carries a cache header, so the browser repeats both on every draw, about a second, even with the image itself in its cache. Keeping the answer listing the images isn't enough.
- **Not kept**: edits, paging, and anything a write reads back. They go through `ws`, uncached.

## Collections

The entity-type label opens the collection menu. `collectionParse` reads `#sidebar h2.collections` and the following lists up to the next h2: MusicBrainz supplies the translated action labels, collection IDs, numeric entity IDs and type-filtered own/private/collaborative collections. It accepts only same-origin collection add/remove links and the creation link with this entity type's query parameter (`release_group`, not `release-group`).

The native body supplies the initial page's list without a request. Navigation inside Event Horizon reads the entity's native page through `mbnFetch`; a cached list paints first and is refreshed after a minute. GM `collections` keeps the last 80 lists, keyed by origin, signed-in editor and entity path. It never reuses the hidden native body's sidebar for another entity.

Changes POST the native collaborator action with its numeric entity ID and a return path to the entity. The redirected page must show the opposite action before success is reported or the cache is changed. Writes are serialized per entity; navigation does not cancel an in-flight write. Refresh remains available after an error. [`902-collections.spec.mjs`](test/902-collections.spec.mjs) creates private collections on the sandbox and reads their actual contents after adding and removing artists, including one reached without reloading.

## Leading the gate

While a page loads, its tab leads the shared request gate (`mbnLead`, [#847](https://github.com/majkinetor/musicbrainz-userscripts/issues/847)): every other background ws/2 request, in any script or tab, waits until the lead ends, so the page the reader asked for isn't queued behind Platform Check's or ISRC Scout's scans. The page's own requests pass `{ lead }` to `mbnFetch` and renew it; it ends once all the page's parts are in, or when the page fails. A lead not renewed lapses after 8 seconds (the gate caps one at 10), so a tab closed mid-load holds no one for long. A hidden tab doesn't lead, and `kpCheck`'s requests don't carry the lead.

## Pending edits

ws/2 says nothing about open edits, so *Show pending changes* reads `editsPending` from `/ws/js/release/<id>?inc=rels+recordings` or `/ws/js/entity/<gid>?inc=rels`: one request per page, repeated after `PD_TTL`. An artist, label or release group takes a second: `/ws/js` has no list of its releases, so `pdAsk` reads the `.mp` links off MusicBrainz's own page for it. `pdPaint` repaints the marks on every `render`, since a render rebuilds the page.

The gate has no priority levels, so `pdAsk` gets last place by waiting. It starts once the page's parts are in, waits 2 seconds, for the tab to be in view and for an idle moment, then takes a background slot with `mbnSlot`, which waits out any lead. Leaving the page cancels it. Later requests can pass it during these waits; a booked slot isn't given up.

Credit marks match by person, so someone with two credits, one pending, has both marked.

## Hexagon animation cost

Ambient layers (`ambientApply`: Tron, Stars, Aurora and Rain) keep their canvas, simulation and elapsed time across page navigation and redraws. A key of effect kind, layer size, pixel ratio and reduced-motion mode guards recreation; parameters and theme colours update in place through `_ehPattern.P`. Removing an effect or disabling EH disposes its loop.

Drift, Tide, Ripple and Lantern are radial or linear masks over the stationary SVG lattice (`.hex-drift`, `.hex-drift2` for two-tone); Twinkle, Ripple, Electricity and Neural draw on a canvas from `HEX_FX`, built on the cached `hexLattice` topology, one rAF loop per layer (`layer._ehPattern`). `--eh-hex-opacity` sets the outlines, `--eh-hex-fx` the effect, `--eh-hex-pace` the CSS durations; `HEX_USES` picks which settings rows a motion takes; the rest are dimmed (`.cr.dim`). The Effects tab's select lists `EFFECTS`, where a new effect gets its entry and its rows. Depth moves the layer by `translateY` and calls `_ehPattern.shift`. Wide drift, Soft tension and Micro tilt are retired and saved values migrate to Drift; a missing `hexFx` is derived from `hexOpacity`. Hidden tabs and reduced motion stop drawing; mode changes and disabling EH dispose the loop before the body is detached.


Effect presets are `{ name, v }` with `v` holding the `FX_KEYS` settings: the user's in `S.named.fx`, shipped ones in `FX_PRESETS` (a key a preset leaves out takes its default), a user's shadowing a shipped one of the same name. `fxPublish` writes their names to the shared key `ehFxPresets` for String Theory's settings. String Theory names a theme's preset on `<html data-st-eh-fx>`; `fxTheme` applies it only when the name differs from `S.fxTheme`, so changes made after it stay until the theme changes.

Keep effects out of animated SVG patterns: changing dash offsets and blur filters inside a repeated pattern repaints and rasterizes large areas continuously.

## Independent background effects

Tron, Stars, Aurora and Rain use `ambientDraw`, a canvas renderer independent of the hexagonal lattice. `AMBIENT` declares each effect's rows, supported values and defaults; `AMBIENT_KEYS` joins both view storage and `FX_KEYS`, so saved presets and String Theory theme presets restore all effect parameters. Older presets default to Hexagons. Each effect has its own `<kind>Opacity`, `<kind>Glow`, `<kind>Colour` and `<kind>Colours` (`FX_OWN`, part of `AMBIENT_KEYS`); Hexagons keeps `hexTwo` and `hexGlow`, and `hexColours`. Settings and presets saved when they shared `ambientOpacity`, `hexGlow` and `hexTwo` are filled in from those by `fxMigrate`, at load and in `fxFull` and `fxImport`. Colour 3 is User: the painters cycle through `p.user`, the stored colours filtered by `ucolOk` (`#rrggbb` only, at most 64); an empty list falls back to the accent, and choosing User seeds it with the theme's two accents. In Hexagons' CSS-only motions User looks like Two-tone. `ambientApply` passes the validated values into the renderer. All colours use stable per-object seeds, avoiding frame-by-frame hue changes. Glow is an extra broad, faint stroke or star halo rather than a canvas blur filter. Speed, counts and Tron trails remain specific to each geometry; hexagonal Depth relies on a repeating lattice and is not offered for these backgrounds. `S.hex` remains the overlay's on/off switch for compatibility; `S.effect` selects its geometry.

Tron keeps its simulation on the canvas context: `tronCreate` and `tronStep` choose random turns at junctions and retain a distance-limited trail per rider. `tronHit` sweeps each movement segment against foreign trails (perpendicular, collinear and endpoint crossings), so a fast rider cannot jump over a trail. A collision stops the rider at the first hit, emits a bounded spark burst, fades the dead trail and respawns away from occupied paths. Hidden tabs advance no simulation time; new canvases release the old state. `tronOutlines` is separate from effect opacity. [tron-collisions.spec.mjs](test/tron-collisions.spec.mjs) covers crossings, death, respawning, varied paths and memory bounds.

Aurora adds `auroraStyle` (0: Rays, 1: Velvet curtains, 2: Polar haze, 3: Wide veil) and `auroraDiffuse` (0–100); both join view storage and presets through `AMBIENT`. Missing fields default to Rays and 0%, preserving existing installs and older presets. Diffuse styles use feathered radial volumes; Rays at 0% preserves its unblurred appearance. `auroraLayer` builds two curtain keyframe textures on the live context, capped at 480 × 320 pixels, applying Diffuse only when building them. Each animation frame blends those textures in 24 gently displaced strips and sweeps a brightness mask across them; it does not repaint fog or blur. A change to size, style, palette or geometry rebuilds the textures. The live Aurora canvas uses the same resolution cap and is upscaled by CSS, independently of device pixel ratio. Cached 64 × 64 fog sprites and 8 × 128 ray sprites replace per-frame gradient creation; a maximum of 12 colour/shape entries is kept per context. Aurora paints at most 20 fps while motion time follows the clock; hidden tabs paint nothing. Removing the live canvas releases the cache. Rebuilding hundreds of gradients and blurring/upscaling into a full-resolution canvas every display frame made the page unresponsive, so keep Aurora on the capped surfaces and cached sprites. All styles retain Ribbons, Speed, Height, Folds, Colour and Glow.

Rain (`rainDraw`) keeps its state on the context in `ctx._ehRain`, keyed by size, canvas pixels, theme colours, Colour, the user's colours and Lights; a change rebuilds it, and parameters update in place. `rainLights` paints the scene behind the glass once, a sharp and a fogged blur of soft discs in the theme's tones; Lights (`rainLights`, 0–1) scales their count. `RainGlass` simulates the drops: small beads, and drops that grow, slide once heavy enough, leave trails, merge and wipe the fog. Each drop is the sharp scene drawn flipped and magnified through a circle, under a cached shading sprite (`rainSprite`). The fog is one canvas at the page's pixels: sliding drops erase lines from it and regrowing paints the clean fog faintly over it, so a frame only copies it (a wipe mask composited every frame, or a half-size fog scaled up, cost most of a frame). Still drops live in a cached layer, repainted at most twice a second as they grow; a frame draws only the sliding ones. Beads too small to show the lights skip refraction. `RainFall` draws falling streaks in two depth layers and the lightning. Rain renders at a pixel ratio of at most 1.5 and caps drops at 500 and streaks at 2500; a full-HD frame takes about 2 ms with the GPU (about 11 ms in headless software rendering, down from 28). Rain hides the Glow row; its rows carry their own option labels (`AMBIENT` rows take an optional labels array and tip).

`ambientApply` owns one canvas and one animation loop, cleans up on switching or disabling, and pauses while hidden. Reduced motion draws once (the existing reduced-motion CSS hides the canvas). Theme changes and viewport resizing rebuild it with resolved accent colours and a pixel ratio capped at two. The comparison sampler in [dev/mockups/event_horizon/effects](../../dev/mockups/event_horizon/effects/) embeds the same renderer; update it with renderer changes.

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
