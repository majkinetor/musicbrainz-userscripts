# Art Station

A cover-art editor for MusicBrainz: one gallery to view, group, sort, reorder, retype, comment, remove, download and add a release's cover art — all staged, then applied on **Enter edit**.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/art_station/art_station.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/art_station/art_station.user.js)
- Status: proof of concept ([discussion #230](https://github.com/majkinetor/musicbrainz-userscripts/discussions/230))

It runs on a release's **Cover art** tab (`/release/<mbid>/cover-art`), replacing the native list with a gallery. The principle is *you get what you see* — the gallery is the staged state, and **Enter edit** makes MusicBrainz match it.

## Features

- **Gallery** with an adjustable thumbnail size; images shown uncropped.
- **Group by type** (compact label + cards) or a flat **Position** view (the order that gets committed).
- **Sort** by position, type (Front, Back, Booklet, …), dimensions or newest.
- **Reorder** by dragging covers (Position view); drag a whole selection together.
- **Set type** and **comment** per cover, or in bulk on a selection.
- **Remove** (staged, moved to a "marked for removal" section) and **Download** (a selection, or every cover).
- **Add** images by file drop — new covers upload to the Cover Art Archive, in parallel.
- **Select** with right-click or right-drag; **Select all** from the toolbar.
- **Full-screen viewer** on click: arrow-key navigation, a slideshow, and an editable comment. PDF covers open in a new tab; covers still propagating show a placeholder.
- Covers with a **pending MusicBrainz edit** are tinted and badged, like the native page.

## Applying changes

Every change is staged. **Enter edit** opens a panel that lists the pending operations and submits them as real MusicBrainz edits — remove, retype/comment, reorder and new-image uploads — each crediting *Art Station* in the edit note.

- A **dry run** (on by default) shows the exact requests without sending anything.
- A shared **edit note** and **make votable** apply to every edit.
- Edits and removes run in parallel; uploads run in parallel and register in order so positions stay correct; reorder runs last.

Provider/URL imports (Discogs, Apple Music, …) are intentionally left to [Enhanced Cover Art Uploads](https://github.com/ROpdebee/mb-userscripts), whose import button sits in the native button row below the gallery.
