# Fusion <img src="icon.svg" align="left" width="48">

A review-and-merge assistant for MusicBrainz recordings: gather a pool of candidates, let auto-match group the likely duplicates, adjust by hand, then submit every merge directly in the background — no trip through MB's own merge page.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/fusion/fusion.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/fusion/fusion.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

<img width="640" src="./screenshots/pool-groups.png" />

## Features

- **Pool / Groups review UI** — every candidate recording starts in the left-hand **Pool**; drag one into the right-hand **Groups** column (or select it, then click a group) to propose a merge. A recording only ever lives in one place at a time.
- **Auto-match** — scans the pool and groups likely duplicates automatically using multiple signals: shared ISRC, shared AcoustID (read from MB's own recording→URL relationships — no external API key needed), length within a configurable tolerance, and title/artist similarity. High-confidence groups (ISRC or AcoustID) are marked `HIGH`; title+artist+length-only groups are marked `MEDIUM`. Re-running Auto-match only touches whatever is still in the pool, so it never undoes a group you built by hand.
- **Full manual control** — return a recording from a group back to the pool (↩), remove it from the group *and* the pool entirely (✕, for a recording you're sure isn't a match and don't want cluttering the view again), or build a brand-new group yourself. Pick which recording in a group is the merge **target** (the one that survives) with a simple radio.
- **Flexible seeding** — opens with a pool already populated from wherever you launched it:
    - **Release page** — that release's own recordings, plus a *"Load recordings from RG edition"* dropdown to pull in another edition from the same release group.
    - **Release group page** — every recording across every release in the group in one go.
    - **Recording page** — just that one recording, to start building a merge from scratch.
    - Any page: paste an MBID or a `musicbrainz.org/recording/…` URL into **Add** to pull in a recording from anywhere.
- **Direct background merges** — a group's **Merge ↗** button (or the footer's **Merge All**) submits the merge itself, the same two real MusicBrainz endpoints MB's own merge page uses (`/recording/merge_queue` → `/recording/merge`), with an edit note auto-composed from whichever signals matched. No tab opens, no MB UI is shown.
- **Standard options / log** — the ⚙ menu holds settings (length tolerance, AcoustID enrichment on/off, always-request-a-vote, extra edit-note text) plus a **Log** button opening the full session activity log, copyable as a Markdown block for bug reports.

## How matching works

Auto-match treats two recordings as the same group when either:
- they share an **ISRC**, or
- they share an **AcoustID** (via MB's existing recording→`acoustid.org` URL relationships — recordings never submitted through Picard simply won't have this signal, which is why it's a bonus, not a requirement), or
- their **title** and **artist credit** are both similar *and* their **length** is within tolerance (5 seconds by default).

Length alone is never enough to group two recordings — it's supporting evidence only, combined with title+artist. A group formed from ISRC or AcoustID is marked `HIGH` confidence; a group formed only from the title+artist+length combination is marked `MEDIUM`. Groups you build by hand (drag/select, not Auto-match) are marked `MANUAL` and still show their signal chips for reference, since a merge you intend deliberately doesn't need to justify itself the same way an automatic one does.

This mirrors MB's own [How To Merge Recordings](https://musicbrainz.org/doc/How_To_Merge_Recordings) guidance — matching "acoustic content", not incidental metadata — while staying honest that Fusion's signals are a heuristic, not a guarantee: always glance at the group before merging.

## Submitting merges

Fusion never uses MB's own merge review page. Clicking **Merge** on a group (or **Merge All** for every ready group) drives the same two endpoints MB's own "select recordings → merge" flow uses, directly:

1. `GET /recording/merge_queue?add-to-merge=<id>&add-to-merge=<id>…` — queues the group's recordings server-side.
2. `POST` back to the resulting `/recording/merge` form with the chosen target and an edit note.

This is a normal MusicBrainz edit like any other — it goes through your account exactly as if you'd used MB's own merge page, and if your account isn't an auto-editor (or **"Always require a vote"** is on in Fusion's options) it enters the voting queue rather than applying immediately. Fusion doesn't change that; it only removes the "click through several MB pages to get there" part.

## Scope

**In:** recording merges seeded from a release, release group, or recording page (plus manual add-by-MBID from anywhere); the ISRC/AcoustID/length/title-artist signal set; full pool/groups review and manual override; direct background submission.

**Not yet:** an artist-page or work-page entry point (the release/RG/recording trio covers the common cases; MB's own recording-listing pages there aren't a single clean API query the way a release group is); merging entity types other than recordings (works, release groups, artists are a different, less mechanical problem — a possible future direction, not assumed).
