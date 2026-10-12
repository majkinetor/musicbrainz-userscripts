# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Merging

Fusion queues a group with `GET /recording/merge_queue?add-to-merge=…` and posts MusicBrainz's own `/recording/merge` form with the target and the note. MusicBrainz keeps one merge queue per session, so **Merge All** prepares several groups in parallel but submits them one at a time. If MusicBrainz bounces the form instead of creating the edit, the group is marked failed, not done.
