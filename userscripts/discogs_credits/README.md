# Import Discogs Credits (DEPRECATED) <img src="icon.png" align="left" width="48">

UI for importing Discogs credits as MusicBrainz release relationships and a few general import helpers.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/discogs_credits/dist/discogs_credits.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/discogs_credits/dist/discogs_credits.user.js)
- [View changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Import+Discogs+Credits)

> [!WARNING]
> **DEPRECATED** - [**Credit Hoarder**](../credit_hoarder/README.md) is the multi-source successor — same review-and-resolve workflow, but also pulls credits from several providers.

This userscript presents itself on *Edit relationships* screen of the MusicBrainz release for those releases having associated Discogs release link.

The workflow is as follows:

1. Script first gets all entities (artists, places, labels) and present them in the *Entity Review Table*.
    1. Each Discogs entity is matched by name and Discogs URL
    1. Perfect hits are automatically selected, while ambiguous or non-existent entities are left for the user to resolve or ignore
1. After the data in the review table is confirmed, *Instant Fill* is initiated
    1. Entities that have their MB ID resolved will be associated to release or track depending on options, others are skipped but reported in log
    1. Some relationships are added to the work instead of the track. Non-existent work can automatically be created depending on option. If the work doesn't exist, relationship will not be added and will be reported in log
1. At the end and after potential manual interventions, user confirms the edit

<img width="800" src="./screenshot.png" />

[screen.webm](https://github.com/user-attachments/assets/6f4acf05-a518-4068-844c-7546d9b3d638)

Make sure to read [Style / Relationships](https://musicbrainz.org/doc/Style/Relationships) for general guidelines.

## Features

- **[Import Bar](#import-bar)** — the import options (per-track credits, move-to-tracks, create-works, dedup) and the Import button.
- **[Entity Review Table](#entity-review-table)** — confirm each Discogs ↔ MusicBrainz match before dispatch: parallel lookup, inline search, auto-match, entity creation.
- **[Instant Fill](#instant-fill)** — write the confirmed relationships into the MB relationship editor in one pass.
- **[Page-wide helpers](#page-wide-helpers)** — hover-highlight and batch-remove for existing relationships.

### Import Bar

The UI strip at the top of the page with options, an Import button, log output, a documentation link, and Copy-log buttons.

Options are saved in localStorage and persist across sessions.

1. **Per-track credits**<br>
Import track-level artist credits in addition to release-level credits.
1. **Move release credits to tracks**<br>
Move appropriate release-level credits down to all recordings (instruments, vocals, producer, mix, etc.). Doesn't move any pre-existing release-level credits.
1. **Use works** — a master toggle plus a mode picker (#424):
    - **toggle off** — no work relationship is touched at all: nothing is created *and* nothing is attached to pre-existing works; skipped work-level credits are logged.
    - `create none` (default) — use only works that already exist; never create one. Work-only credits with no existing work are logged and skipped.
    - `create needed` — also create a work when a composer/lyricist/writer credit needs one. Selecting it shows a **duplicate-works warning** (#421): match recordings to *existing* works first — [Group Therapy](../group_therapy/README.md) makes that fast — or you will create duplicates. The `when missing` mode (a work for *every* recording) was removed for the same reason, and this option was reset to `create none` for everyone once.
1. **Dedup**
    - **Equivalence sets**<br>
    Skip a role when an equivalent role already exists on the target (writer ≡ composer).
    - **Duplicate roles**<br>
    Skip a role when the target recording already has the same role (regardless of attributes / dates / tasks).


### Entity Review Table

Single-row-per-entity table for confirming Discogs ↔ MusicBrainz matches before dispatch.

**Row state** is conveyed by colors:
- ⚪ auto match
- 🟢 user selected
- 🟡 name differs - resolved via URL but the MB name doesn't match Discogs (user should verify)
- 🔴 needs attention - not resolved

**Discogs URL link state** appears as a single chip per row:
- ✓ Discogs URL already linked
- 🔗 Add Discogs link, click opens MB's edit page pre-filled
- ⚠ linked to a different MB entity

There are number of features in review table to make editing efficient:

- **Parallel lookup**<br>
All artists, labels and places are checked against MB through a shared throttle.
- **Cache**<br>
Resolved Discogs ↔ MB MBID mappings persist across sessions and are checked first. Each record shows badge with info on how it was originally resolved (`name` / `url` / `name+url` / `user`).
- **Inline MB search**<br>
Live search field on every row; type a name or paste an MBID / MB URL.
- **Auto-match**<br>
Name search and Discogs URL lookup run in parallel. Auto-resolution happens only when the result is trustworthy:
  - **Both agree** on the same MB entity → resolved with high confidence.
  - **Only one side** returns a hit → auto-accepted only when strong (unique exact-name match OR direct Discogs↔MB URL relation).
  - **They disagree** → left unresolved for manual review.
- **Entity creation**<br>
    - `+` button opens MB's create page pre-filled (name, sort name, type, Discogs URL). After save the tab closes itself and the row auto-selects the new entity.
    - `▾` button opens pop-up with advanced creation options: sets disambiguation by the role or by selecting text from the Discogs profile, takes real name from the Discogs profile
- **Refresh from MB**<br>
🔄 button deletes the existing cache and resolves every entity against fresh MB data.
- **Credited as**<br>
Per-entity override input — sets `entity1_credit` on every dispatched rel for that entity. If entity already exists in relationships, the most common *credited as* value will be used. Contains two helper buttons [MB] and [D], used to set the value to MB or Discogs name quickly.
- **MB roles**<br>
Each artist's MB header carries an **MB roles** toggle. Clicking it fetches that artist's existing MusicBrainz relationship categories (e.g. `producer`, `mix`, `mastering`, `instrument`, …) and shows them as tags, so you can sanity-check the Discogs role on that row against the artist's known roles. On request only — nothing is fetched during preflight (one extra request per artist), and results are cached for the session.
- **Preflight diagnostics**<br>
Collapsed `<details>` block below the main log with per-worker / per-request trace. Useful when something feels slow.

### Instant Fill

The dispatch-based zero-dialog import. Idempotent — skips relationships that already exist on the target or were dispatched earlier in the same session.

- Release-level: labels, places, company credits, release artists...
- Tracklist: instruments, vocals, task attributes...
- Work-level: lyrics, composer, writer (with work auto-creation per the chosen import option)...
- Detailed statistics in the edit note

### Page-wide helpers

These run on every `/edit-relationships` page regardless of whether a Discogs link is present:

- **Hover-highlight** — Hovering an entity in the rel editor highlights all relationships that reference it (and vice versa). Also runs against the review table while it's open.
- **Batch-remove** — Modifier-click (SHIFT, CTRL, SHIFT+CTRL) on any `(×)` button opens a popup to remove all relationships matching a chosen scope (by entity, by link type, by track range, only-this-session).

## Shortcuts

**Batch-remove** — hold a modifier and click any relationship's `(×)` remove button to open the batch-remove popup, seeded by scope:

| Click | Scope |
|---|---|
| `Shift` + click | same **role** |
| `Ctrl`/`⌘` + click | same **target** entity |
| `Ctrl`/`⌘` + `Shift` + click | same **role and target** |

In the review table's create-artist popup and the batch-remove dialog: `Enter` confirms, `Esc` closes. In a search box, `Enter` runs the search.

## Notes

1. **IndexedDB cache** — Resolved Discogs URL → MB MBID mappings persist across sessions.
1. **Rate-limit handling** — All MB WS2 requests share one throttle. On 429/503 every in-flight worker idles until the `Retry-After` window elapses (cooperative backoff).
1. **unsafeWindow** — Uses `@grant unsafeWindow` to access MB's real page `window` where `MB.relationshipEditor` lives.
1. **BroadcastChannel** — Same-origin cross-tab messaging for the entity-creation → review-table feedback loop.
1. **Discogs API** — Fetches release data from `api.discogs.com` using the token from MB's stored Discogs URL.
1. Initially based on the userscripts of *mattgoldspink*, *vzell*, *kellnerd*.

## Development

See [DEVELOP.md](./DEVELOP.md) for prerequisites, install steps, the dev loop, testing, and contributor workflow.
