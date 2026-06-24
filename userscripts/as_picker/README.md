# Art Station Picker

A small companion to **[Art Station](../art_station/README.md)** that makes the
reverse-image **Search** action round-trip: after you click *Search* on a cover in
Art Station and pick a higher-resolution copy somewhere, it's sent straight back to
the gallery — no download-and-drop.

## Why it's a separate script

Art Station runs only on MusicBrainz cover-art pages. To grab the *full-resolution*
image you usually have to follow a search result to the source website, so the
picker has to be able to run **anywhere**. Keeping it as a tiny, mostly-dormant
companion means the (large) Art Station script stays MusicBrainz-only and isn't
loaded on every page you visit.

## How it works

1. In Art Station, select a cover → **🔍 Search** → choose Yandex / Google Lens /
   TinEye / Bing. Art Station opens that engine pre-loaded with the cover's URL and
   tags the tab with `#mb-as-pick`.
2. Seeing that tag, this companion opens a 30-minute **picking** window (stored in
   its own GM storage, which is shared across every site it runs on, so it survives
   following a result to the source site).
3. While picking, hover any reasonably-sized image — a **＋ Art Station** badge
   appears; click it to queue that image. A small bar (with a **Stop** button) shows
   you're picking.
4. Back on the MusicBrainz cover-art page, the companion hands each queued image to
   Art Station via the `artstation:add-image` document event — Art Station fetches and
   stages it like any other source. A GM value-change listener makes that happen
   instantly, even while the MusicBrainz tab is in the background.

## Install

Install **both** Art Station and this companion. Single file, no build — just the
`.user.js`.

## Grants

`GM_setValue` / `GM_getValue` / `GM_addValueChangeListener` — for the cross-site
picking session and queue. It matches `*://*/*` but does nothing on a page unless a
picking session is active (or you're on a MusicBrainz cover-art page).
