# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Merging

Fusion queues a group with `GET /recording/merge_queue?add-to-merge=…` and posts MusicBrainz's own `/recording/merge` form with the target and the note. MusicBrainz keeps one merge queue per session, so **Merge All** prepares several groups in parallel but submits them one at a time. If MusicBrainz bounces the form instead of creating the edit, the group is marked failed, not done.

## Merging other entities

- The store is the GM key `fusion.merge`: `{types:{<type>:{pool, groups, current}}}`. Every write re-reads it first (`emEdit`) and `GM_addValueChangeListener` repaints other tabs; only the in-flight state (`EM_BUSY`) stays in memory.
- Each entry keeps `info`, the detail columns (`EM_COLS`), read from ws/2 with `EM_INC` when added; an entry without it (an Event Horizon add) is filled the first time its type is shown (`emFillMissing`).
- A merge loads `/<type>/merge_queue?add-to-merge=<ids>`, keeps the fields of MB's merge form, and replaces `merge.merging.N`, `merge.target`, `merge.edit_note` and, for a release, `merge.merge_strategy`. With *append* every release's mediums come at position 1 and MB's page renumbers them in JS, so Fusion numbers `merge.medium_positions.map.N.position` in form order. A POST that lands back on a page of the type is success; otherwise the form's errors are the message.
- Event Horizon's button dispatches `mbu-fusion-add` (cancelable, `detail` a JSON string `{type, gid, name, dis}`); Fusion cancels it to say it took it. Fusion sets `html[data-mbu-fusion]` and fires `mbu-fusion-ready` at boot, so EH shows the button only when Fusion runs.
