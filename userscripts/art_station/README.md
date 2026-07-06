# Art Station <img src="icon.png" align="left" width="48">

A cover/event-art editor for MusicBrainz: one gallery to view, group, sort, reorder, retype, comment, remove, download, add and source a release's cover and event art — all staged, then applied on **Enter edit**.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/art_station/art_station.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/art_station/art_station.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
    - [picker](./as_picker/README.md) helper script: [install](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/art_station/as_picker/as_picker.user.js)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Art+Station)

![](./screens/screenshot.png)

<details><summary>More Screenshots</summary>
  
![](./screens/screenshot2.png)
![](./screens/screenshot3.png)
</details>

It runs on a release's **Cover art** tab (`/release/<mbid>/cover-art`) and an event's **Event art** tab (`/event/<gid>/event-art`), replacing the native list with a gallery. The gallery is the staged state, and **Enter edit** makes MusicBrainz match it.

## Features

- **Gallery** — adjustable thumbnail size, grid or detailed view, group by type, and sort by position / type / dimensions / newest.
- **Reorder** by dragging a single cover or a whole selection together.
- **Select** with right-click or right-drag.
- **[Single or bulk actions](#single-or-bulk-actions)** — set type, set comment, remove, download (zip) and reports, on one cover or the whole selection.
- **[Add images](#add-images)** — file drop, URL (Enhanced Cover Art Uploads), MH Covers, and reverse-image search.
- **[Full-screen viewer](#full-screen-viewer)** — navigate, zoom, mouse-follow pan, slideshow, set type/comment, delete.
- **[File names ⇄ types](#file-names--types)** — cover types and file names round-trip, so a downloaded archive re-adds with types intact.

## Single or bulk actions

Works on one cover or the whole selection:

- **Set type** — tick checkboxes for one or more types, or **right-click a type to set *only* that one and close**.
- **Set comment** — auto-focuses the next comment field on `<ENTER>`.
- **Remove** and **Download** as a zip archive — files named by type so they round-trip (see [File names ⇄ types](#file-names--types)), plus a `README.md` manifest.
- **Reports** in HTML or Markdown — inline, captioned, or a **Detailed table** (position · type-named file · resolution · size) that doubles as the archive `README.md`.

## Add images

- **File drop** — choose local files and upload to the Cover Art Archive in parallel; the **type is guessed from the file name** (see [File names ⇄ types](#file-names--types)).
- **Folder upload** (#359) — drop a **folder** on the gallery, or **Shift-click** the drop zone to browse one. It stages the folder's image/PDF files recursively, but bounded: **one level of subfolders deep** and up to **100 files** (a stray huge tree can't flood the gallery).
- **URL link** — uses [Enhanced Cover Art Uploads](https://raw.github.com/ROpdebee/mb-userscripts/dist/mb_enhanced_cover_art_uploads.user.js) (must be installed) to fetch covers from Discogs, Apple, Spotify, Bandcamp…
- **[MH Covers](https://covers.musichoarders.xyz)** — pick a cover and it drops into the gallery as a staged new cover.
- **Reverse-image search** (the 🔍 on each cover) — look for a higher-resolution copy on Yandex / Google Lens / TinEye / Bing. With the optional [Art Station Picker](./as_picker/README.md) companion installed, click the better copy on the results (or any site reachable from there) and it's sent straight back into the gallery.
- Fresh covers shown faster than the native UI.

## Full-screen viewer

- Arrow keys for navigation (left/right) and zoom (up/down), with zoom level remembered.
- **Mouse-follow pan** — when zoomed, just move the mouse to pan across the image (no click-and-drag). On by default; toggle in **Setup**.
- Slideshow.
- Set comment and type.
- `<Delete>` key to remove the image.

See [Keyboard shortcuts](#keyboard-shortcuts) for the full key/mouse list.

## File names ⇄ types

Cover types and file names round-trip, so a downloaded archive can be re-added later with types intact.

**On add** (drop / pick / source) — when an image has no type, it's guessed from the file name (toggle in ⚙ setup):

|  Type   |                         Name contains                          |
| ------- | -------------------------------------------------------------- |
| Front   | `front`, `folder`, `cover`, `frontal`, `recto`                 |
| Back    | `back`, `rear`, `verso`                                        |
| Booklet | `booklet`, `inlay`, `insert`                                   |
| Medium  | `cd`, `disc`, `disk`, `vinyl`, `medium`, `label`, `side a/b/…` |

The following types are matched by their name:

- Release: `tray`, `obi`, `spine`, `sticker`, `liner`, `poster`, `matrix`, `runout`, `track`, `top`, `bottom`, `raw`, `unedited`, `watermark`
- Event: `flyer`, `ticket`, `setlist`, `banner`, `program`, `schedule`, `map`, `logo`, `merch`                                            |

Matching is word-boundaried and order-aware, so `back cover` → **Back** (not Front) and an album titled *Super Disco Pirata* → no type.

### File names in download archive

Each file is named 
* `<NN> <type1>,<type2>,..<typeN> <comment>.<ext>`

where `none` is used where no type is given 

**Example**: `09 front,sticker Front cover with the sticker.jpg`.

## Keyboard shortcuts

**Gallery** (when a cover is focused — arrow to it first):

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` | move the cursor between covers |
| `Enter` | open the focused cover full-screen |
| `Space` | select / deselect the focused cover |
| `Delete` | mark the focused cover for removal (undo in the grid) |

**Full-screen viewer:**

| Key | Action |
|---|---|
| `←` `→` | previous / next cover |
| `↑` `↓` | zoom in / out |
| `Enter` | edit the comment |
| `D` | download the original |
| `Delete` | mark the cover for removal |
| `P` | play / pause the slideshow |
| `Esc` | close (dismisses an open popover or comment edit first) |

**Mouse:**

| Gesture | Action |
|---|---|
| right-click / right-drag | select / paint-select covers |
| scroll wheel over the size slider | resize thumbnails |
| **hold right-click + scroll wheel** (anywhere in the gallery) | resize thumbnails |
| full-screen, zoomed: **move the mouse** | pan the image (follow-pan; on by default — see Setup). Off → click-and-drag to pan |
| full-screen: **scroll wheel** | zoom toward the cursor |

## Comment memory (Mammoth)

The comment field in the **detailed view** carries the `mmth-pin` class, so if you also run [Mammoth](../mammoth), its **baby field-memory** attaches to it automatically — a small 🦣 pin lets you save and recall past comments (key `art-station-comment`). No configuration; it's Mammoth's [documented cross-userscript convention](../mammoth/README.md#using-mammoth-from-another-userscript). Art Station's own `comment…` preset list still works independently when Mammoth isn't installed.

## Applying changes

Every change is staged. **Enter edit** opens a panel that lists the pending operations and submits them as real MusicBrainz edits — remove, retype/comment, reorder and new-image uploads — each crediting *Art Station* in the edit note.

- Edits, removes and uploads all run in **parallel** (upload + register per image); a single **reorder** edit runs **last** and sets the final order, so register order doesn't matter. If a run has failures, **Repeat** re-runs just the failed ops — and re-runs the reorder too, so a retried upload still lands in place.
- A shared **edit note** and **make votable** apply to every edit.
- While a run is in progress the dialog can't be dismissed by clicking outside, and leaving the page warns first — so edits are never silently cut off. Use **Cancel** to abort.

## Plugin API

Another userscript can register its own cover/event-art **provider** — it appears as an `⬇ Import from <name>` button in the **Source** popover, alongside the built-in ECAU platforms, and its images stage into the gallery like any other. This lets a site-specific script (e.g. one that's already logged in to a fan site) do the fetch with its own session and hand the bytes to Art Station.

```js
window.ArtStation?.registerProvider({
  name: 'SpringsteenLyrics',          // required — the button label
  id:   'springsteen',                // optional — de-dupe key (defaults to name)
  icon: 'https://example.com/favicon.ico',  // optional — badge favicon (a missing/404 one is fine)
  match: 'springsteenlyrics.com',     // optional — string | string[] | RegExp | (url)=>boolean
  async run(ctx) {
    // ctx = { mbid, entity:'release'|'event', artist, title, url, link, links }
    //   link  = the first release/event external link your `match` hit (links = all of them)
    const html = await fetchWithYourSession(ctx.link);
    return [
      { url: 'https://…/front.jpg', types: ['Front'], comment: '' },
      // or { dataUrl }, or { blob, source } — see below
    ];
  }
});
```

- **`match`** gates the button: it only shows when the release/event actually links a matching URL, and those link(s) are passed to `run()` as `ctx.link` / `ctx.links`. Omit `match` and the button always shows.
- **`run(ctx)`** returns one item or an array of items. Each item is `{ types?, comment? }` plus **one** image source:
  - **`url`** or **`dataUrl`** — Art Station fetches/decodes it in its own realm (most robust; prefer this).
  - **`blob`** (or `file`) — bytes your script fetched itself (e.g. behind an authenticated session). Also include **`source`** (the image URL) so Art Station can re-fetch if a cross-sandbox blob can't be used directly.
- Works on both **release cover art** and **event event art** — the button, matching and `ctx.entity` are entity-aware.
- If a manager isolates `window` between userscripts, register via the event fallback instead: `document.dispatchEvent(new CustomEvent('artstation:register-provider', { detail: provider }))`.
- When Art Station isn't installed, `window.ArtStation` is simply absent, so the `?.` call is a no-op.

## Server communication (internals)

*Reference for maintainers — the low-level MusicBrainz / archive.org traffic behind **Enter edit**. Below, `<art>` is `cover-art` on releases and `event-art` on events, and `<mbid>` is the release/event MBID.*

Art Station never screen-drives MB's edit UI. For each edit it reads the relevant edit **form once** for its hidden fields (CSRF token, the type-id vocabulary) and POSTs the same fields the form itself would, with `credentials: same-origin`. `getPostForm(url)` GETs the page and returns the parsed `<form>` (action + hidden inputs); `copyHidden()` copies those into the request body.

### Sourcing art from a provider

The **Source** popover doesn't touch MB directly. It seeds ROpdebee's *Enhanced Cover Art Uploads* by setting its `x_seed.image.0.url` params on a **hidden `/release/<mbid>/add-cover-art` iframe**, then polls the ECAU-restructured page for the resulting preview blob (giving up after 45 s) and harvests it into the gallery as a staged new cover. ECAU performs the actual fetch; nothing is submitted at this stage.

### Uploading a new cover — 3-step pipeline per image

`uploadStep` → `registerStep`:

1. **Sign** — `GET /ws/js/<art>-upload/<mbid>?mime_type=<mime>` → `{ action, image_id, formdata, nonce }`. Reserves an id and fetches an Internet Archive S3 policy. Concurrent sign calls for the same release **race and 500**, so signing is **serialised through a gate** (`_signGate`) and retries transient 5xx/429 with backoff + jitter.
2. **Upload** — `POST <action>` (an archive.org S3 URL) as **multipart**: the returned `formdata` policy fields + the file. Uses `XMLHttpRequest` (for upload progress + a 5-min timeout); the live XHR is registered on the run's `AbortController` so **Cancel** aborts it mid-upload. Runs in **parallel** (concurrency 4).
3. **Register** — `POST /release/<mbid>/add-<art>` with `add-<art>.id` (= `image_id`), `.nonce`, `.mime_type`, `.position`, `.type_id` (repeated per type), `.comment`, `.edit_note`. Creates the *add artwork* edit. Also runs in **parallel** (#362).

### Ordering — the reorder edit

`add-<art>.position` only places the whole upload as **one group**, so it does *not* reliably interleave several new covers (or a new cover slotted among existing ones). A single **reorder** edit fixes it:

> `POST /release/<mbid>/reorder-<art>` — the full artwork list: `reorder-<art>.artwork.<n>.id` + `.artwork.<n>.position` for every non-deleted cover, new ones referenced by their post-upload `image_id`.

It runs **last**, after every register, and is **re-run whenever a failed upload is retried** (it re-reads `MODEL` live, so a late success lands in the right slot). Because the reorder is authoritative for order, the register step doesn't need to be sequential.

### Other edits

- **Retype / comment** — `POST /release/<mbid>/edit-<art>/<id>` with `edit-<art>.type_id` / `.comment`.
- **Remove** — `POST /release/<mbid>/remove-<art>/<id>` (a 404 is treated as *already removed*, not an error).

Every edit body also carries `.edit_note` (crediting Art Station and the image's source, if any) and `.make_votable=1` when that box is ticked. **Dry run** prints each request's method / URL / body instead of POSTing.

