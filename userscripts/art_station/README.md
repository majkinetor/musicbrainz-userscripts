# Art Station <img src="icon.png" align="left" width="48">

A cover and event art editor for MusicBrainz: one gallery to view, sort, reorder, retype, comment, remove, download and source a release's art, all staged and applied on **Enter edit**.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/art_station/art_station.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/art_station/art_station.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
    - [Picker](./as_picker/README.md) companion: [install](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/art_station/as_picker/as_picker.user.js)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Art+Station)

![](./screenshots/main-pc.png)

## Features

- **[Gallery](#gallery)** on a release's *Cover art* and an event's *Event art* tab: views, grouping, sorting and reordering by drag.
- **[Actions](#actions)** on one cover or the selection: type, comment, remove, download, report.
- **[Add images](#add-images)**: files, folders, zips, URLs, MH Covers, reverse-image search.
- **[Full-screen viewer](#full-screen-viewer)** with zoom, pan and slideshow.
- **[File names ⇄ types](#file-names--types)**: a downloaded archive re-adds with its types and comments.
- **[AI scan](#ai-scan)** reads a cover's printed credits for Group Therapy's Text parser.
- **[Applying changes](#applying-changes)** as parallel edits, with automatic retries.

## Gallery

Thumbnail size, a grid or a detailed view, grouping by [type](https://musicbrainz.org/doc/Cover_Art/Types), and sorting by position, type, dimensions or date. Drag one cover, or a whole selection, to reorder; select with right-click or right-drag.

Art Station's corner icon switches to MusicBrainz's own page and back; right-click it for the settings (⚙).

| Grouped by type                    | Detailed view                      |
| ---------------------------------- | ---------------------------------- |
| ![](./screenshots/screenshot2.png) | ![](./screenshots/screenshot3.png) |

Each cover shows its size and resolution, and with *Show each cover's file type next to its size* (⚙) its format: `3.2Mb PNG`.

## Actions

- **Set type**: tick one or more types; right-click a type to set only that one.
- **Set comment**: Enter moves to the next cover's comment. With [Mammoth](../mammoth) installed, the comment field gets its 🦣 memory.
- **Remove**, or the trash can on a cover's hover: the cover moves under the gallery to *Marked for removal*, with a **REMOVE** ribbon, until **Enter edit** removes it. **↺ keep** on one, or **↺ Keep** on a selection, brings it back. A cover whose removal is open for votes stays in the gallery, dashed red, with a **removal open · 6 days** chip that opens the edit, on its card and in the full-screen viewer.
- **✓ only this** on a new cover marks every other new cover for removal; the release's own covers stay.
- **Download** as a zip, [named by type](#file-names--types).
- **Report** in HTML or Markdown: inline, captioned, or a table (position, file, resolution, size) that also serves as the archive's `README.md`.

## Add images

| Source                                        |                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Files                                         | drop or pick; the type is [guessed from the name](#file-names--types)            |
| Folder                                        | drop one, or Shift-click the drop zone; one level of subfolders, up to 100 files |
| Zip                                           | drop or pick one; unpacked in the browser like a folder                          |
| URL                                           | **Ctrl+V** a URL anywhere on the gallery, or the **URL (N)** panel               |
| [MH Covers](https://covers.musichoarders.xyz) | pick a cover; it's staged as a new one                                           |
| Reverse-image search                          | 🔍 on a cover searches Yandex, Google Lens, TinEye or Bing for a bigger copy      |

An Art Station download, added back as a zip, restores each cover's types and comment.

The Cover Art Archive takes JPEG, PNG, GIF and PDF, so a WebP, AVIF, BMP or TIFF is converted as it's added: to JPEG when lossy, to PNG when lossless or transparent (`WEBP→JPEG` with the file type shown). TIFF converts only where the browser shows it (Safari); elsewhere it's skipped.

The **URL (N)** panel has an import for each source the release links, plus any [registered providers](DEVELOP.md#plugin-api). A middle-click imports from all and keeps the best cover: the largest front (each source's first image), then the smallest file.

A URL can be a store's release page or an image. Art Station takes the store's largest version; the edit note names the page, the image and the smaller one offered:

| Store pages                                |                                                           |
| ------------------------------------------ | --------------------------------------------------------- |
| Apple Music, Deezer, Spotify, Tidal, Qobuz | the cover; Qobuz adds its digital booklet when it has one |
| Bandcamp, Beatport, 7digital, Juno         | the cover                                                 |
| Discogs, Amazon                            | every image                                               |
| VGMdb                                      | every scan, typed by its caption                          |
| any other page                             | its preview image                                         |

Links that open the add page with images, as Harmony's do, import with their types and comment.

With the [Picker](./as_picker/README.md), clicking a copy in the search results sends it back to the gallery.

## Full-screen viewer

Its keys are in [Shortcuts](#shortcuts). A zoomed image follows the mouse, or drags with that off in ⚙.

**↶ ↷** by **Download** turn the cover 90°. A new cover rotates in place; an existing one is staged as a rotated new copy with its type, comment and position, and the original is marked for removal. PNGs rotate losslessly, JPEGs are re-saved at high quality.

## File names ⇄ types

When an added image has no type, it's guessed from its file name (switch it off in ⚙):

| Type | Name contains |
| --- | --- |
| Front | `front`, `folder`, `cover`, `frontal`, `recto` |
| Back | `back`, `rear`, `verso` |
| Booklet | `booklet`, `inlay`, `insert` |
| Medium | `cd`, `disc`, `disk`, `vinyl`, `medium`, `label`, `side a/b/…` |
| *by name* | `tray`, `obi`, `spine`, `sticker`, `liner`, `poster`, `matrix`, `runout`, `track`, `top`, `bottom`, `raw`, `unedited`, `watermark`; for events `flyer`, `ticket`, `setlist`, `banner`, `program`, `schedule`, `map`, `logo`, `merch` |

Matching is by whole word and order-aware: `back cover` is **Back**, and *Super Disco Pirata* is no type at all.

Downloads are named `<NN> <types> <comment>.<ext>`, with `none` for no type, e.g. `09 front,sticker Front cover with the sticker.jpg`.

## AI scan

**✦** on a cover sends it to an AI chat to read its printed credits: ChatGPT, Claude, Gemini, Perplexity, Grok or Copilot. The chat opens with the instructions, the release and its tracklist, and the image is on the clipboard: press **Ctrl+V**, then **Enter**. Right-click **✦** for the last AI used; **Copy prompt** copies only the instructions, for any other AI.

The answer is the credits as printed, each line with its [pattern](../group_therapy/README.md#patterns): paste it into [Group Therapy's Text parser](../group_therapy/README.md#text-parser) on the release's relationship editor and compare it with the cover there.

> [!NOTE]
> Gemini takes no instructions in its address, so they go on the clipboard with the image. Event art and PDFs have no **✦**.

## Applying changes

**Enter edit** lists the staged operations and submits them as MusicBrainz edits, with one edit note and *make votable* for all.

- Each operation shows its cover and progress; the top bar counts the batch, with the upload rate while images upload.
- The edit note starts folded to its first line; click it to edit.
- **Dry run** is in the menu on **Submit edits** (▾): it shows what each edit would send, and submits nothing.
- Uploads go first, then removes and edits, in parallel; one reorder edit runs last and sets the final order.
- A removed cover that a new one replaces (its rotated copy, or the larger front [Mission Control](../mission_control/README.md) brings) says so in its edit note: the new image's address, size and source, and the removed one's size.
- **Repeat** re-runs only the failed operations, and the reorder after them.
- *Automatically repeat failures* (⚙, on) repeats them up to 10 times or 10 minutes, counting down in the footer; **Close** stops it.

> [!NOTE]
> *Upload timeout* (⚙, default 10 minutes, at most 120) is how long one file may take to reach the Internet Archive. Raise it for large PDF booklets when the Archive is slow; the failure message says when this limit was hit.

## Shortcuts

| Key       | Where           |                                 |
| --------- | --------------- | ------------------------------- |
| Ctrl+V    | gallery         | import the URL on the clipboard |
| ← → ↑ ↓   | gallery         | move between covers             |
| Enter     | gallery         | open the cover full-screen      |
| Space     | gallery         | select or deselect the cover    |
| Delete    | gallery, viewer | mark for removal                |
| ← → / ↑ ↓ | viewer          | previous, next / zoom           |
| Enter     | viewer          | edit the comment                |
| D         | viewer          | download the original           |
| P         | viewer          | slideshow                       |

| Mouse                                                  |                                                    |
| ------------------------------------------------------ | -------------------------------------------------- |
| right-click / right-drag                               | select / paint-select covers                       |
| right-click **URL (N)**                                | import from every source                           |
| middle-click **URL (N)**                               | import from every source, keep only the best cover |
| wheel on the size slider, or right button held + wheel | resize thumbnails                                  |
| viewer: wheel                                          | zoom toward the cursor                             |

## Notes

Another userscript can add its own image source, shown as **Import from &lt;name&gt;** in the URL panel; how is in [DEVELOP.md](DEVELOP.md#plugin-api).

Discogs' full-size images, Amazon, VGMdb, Juno and 7digital check for bots: when an import asks, open the store page once in the same browser and import again. How each store is read is in [DEVELOP.md](DEVELOP.md#sourcing-art-from-a-store).
