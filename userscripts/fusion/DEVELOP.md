# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Merging

Fusion queues a group with `GET /recording/merge_queue?add-to-merge=…` and posts MusicBrainz's own `/recording/merge` form with the target and the note. MusicBrainz keeps one merge queue per session, so **Merge All** prepares several groups in parallel but submits them one at a time. If MusicBrainz bounces the form instead of creating the edit, the group is marked failed, not done.

## Merging other entities

- The store is the GM key `fusion.merge`: `{types:{<type>:{pool, groups, current}}}`. Every write re-reads it first (`emEdit`) and `GM_addValueChangeListener` repaints other tabs; only the in-flight state (`EM_BUSY`) stays in memory.
- Each entry keeps `info`, the detail columns (`EM_COLS`), read from ws/2 with `EM_INC` when added; an entry without it (an album artist from the add menu) is filled the first time its type is shown (`emFillMissing`).
- A merge loads `/<type>/merge_queue?add-to-merge=<ids>`, keeps the fields of MB's merge form, and replaces `merge.merging.N`, `merge.target`, `merge.edit_note` and, for a release, `merge.merge_strategy`. With *append* every release's mediums come at position 1 and MB's page renumbers them in JS, so Fusion numbers `merge.medium_positions.map.N.position` in form order. A POST that lands back on a page of the type is success; otherwise the form's errors are the message.
- The add menu (`openAddMenu`, Ctrl+click or middle-click on `#fs-launch`) reads the page's entity from ws/2 with what it needs for the related ones (a release's `release-groups` and `artist-credits`, a release group's releases by `?release-group=`, an artist's works, releases and release groups by `?artist=`; every artist tab is the `artist-recordings` scope), adds them in one write (`emAddMany`), and loads recordings onto the recording board (`seedFromScope`). Opening a board loads nothing.
- The counters (`emCounters`, `.fs-ctr`) count a type's pool and its open groups; `refreshCounters` repaints them in `#fs-launch-ctrs` and each window's title. The title (`fsTitle`) lists every type, the recording type only on a page with recordings; in the corner's row flow the counters stack vertically (`.fs-lv`), and they pass the pointer through their gaps (`pointer-events:none`) so the icon's tooltip doesn't show between them. The pool's add field is `wireAddField`, the Clear menu `openClearMenu`.
- String Theory's palette asks `fsPaletteCommands` (registered in `window.__mbuPalette.Fusion`) each time it opens: a board per type, the add menu's options (`addMenuOptions`, run by `addFromPage`), and the open window's visible, enabled buttons, each run as a click on that button.
- A maximized window sets `html[data-fs-max]`, which hides the String Theory dock and the corner icons, as Platform Check does.
