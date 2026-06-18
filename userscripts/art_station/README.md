# Art Station <img src="icon.png" align="left" width="48">

A cover/event-art editor for MusicBrainz: one gallery to view, group, sort, reorder, retype, comment, remove, download, add and source a release's cover and event art — all staged, then applied on **Enter edit**.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/art_station/art_station.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/art_station/art_station.user.js)

![](./screens/screenshot.png)

<details><summary>More Screenshots</summary>
  
![](./screens/screenshot2.png)
![](./screens/screenshot3.png)
</details>

It runs on a release's **Cover art** tab (`/release/<mbid>/cover-art`) and an event's **Event art** tab (`/event/<gid>/event-art`), replacing the native list with a gallery. The gallery is the staged state, and **Enter edit** makes MusicBrainz match it.

## Features

- **Gallery**
  - Adjustable thumbnail size 
  - **Grid and Detailed view** 
  - **Group by type**
  - **Sort** by position, type, dimensions or newest.
- **Reorder** by dragging single cover or a whole selection together.
- **Select** with right-click or right-drag
- **Single or bulk mode**
    - **Set type**
    - **Set comment** with auto focusing next comment field on `<ENTER>`
    - **Remove** and **Download** zip archive
    - **Reports** in HTML and Markdown with configurable parameters  
- **Add images**
  - **File drop** — new covers upload to the Cover Art Archive, in parallel
  - **[MH Covers](https://covers.musichoarders.xyz)** — pick a cover and it drops into the gallery as a staged new cover, via the sanctioned integration.
  - Fresh covers shown faster than native UI
- **Full-screen viewer**
  - Arrow keys for navigation (left/right) and zoom (up/down) with zoom level remembered
  - Slideshow
  - Set comment and type
  - `<Delete>` key to remove image 

## Applying changes

Every change is staged. **Enter edit** opens a panel that lists the pending operations and submits them as real MusicBrainz edits — remove, retype/comment, reorder and new-image uploads — each crediting *Art Station* in the edit note.

- Edits and removes run in parallel; uploads run in parallel and register in order so positions stay correct; reorder runs last.
- A shared **edit note** and **make votable** apply to every edit.

