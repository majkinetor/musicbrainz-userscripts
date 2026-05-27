# Import Discogs Credits

Import Discogs credits as MusicBrainz release relationships.

- [Install from Greasy Fork](https://greasyfork.org/en/scripts/578977-musicbrainz-import-discogs-credits)
- [Install latest from GitHub](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/discogs_credits/dist/discogs_credits.user.js)
- [Users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Import+Discogs+Credits)

This userscript presents itself on *Edit relationships* screen of the MusicBrainz release for those releases having associated Discogs release link.

The workflow is as follows:

1. Script first gets all entities (artists, places, labels) and present them in the *Entity Review Table*.
    1. Each Discogs entity is matched by name and Discogs URL
    1. Perfect hits are automatically selected, while ambiguous or non existent entities are left for the user to resolve or ignore
1. After the data in the review table is confirmed, *Instant Fill* is initiated
    1. Entities that have their MB ID resolved will be associated to release or track depending on options, others are skipped but reported in log
    1. Some relationship are added to the work instead of the track. Non existent work can automatically be created depending on option. If the work doesn't exist, relationship will not be added and will be reported in log
1. At the end and after potential manual interventions, user confirms the edit

![](./screenshot.png)

See also [animated gifs](#animated-gifs).

Make sure to read [Style / Relationships](https://musicbrainz.org/doc/Style/Relationships) for general guidelines.

Based on the userscripts of *mattgoldspink*, *vzell*, *kellnerd*.

## Features

### Import Bar

The UI strip at the top of the page with options, an Import button, log output, a 📖 Documentation link, and Copy-log buttons.

Options are saved in localStorage and persist across sessions.

1. **Per-track credits**<br>
Import track-level artist credits in addition to release-level credits. 
1. **Move release credits to tracks**<br>
Move appropriate release-level credits down to all recordings (instruments, vocals, producer, mix, etc.). Doesn't move any pre-existing release-level credits.
1. **Create works** — mode picker:
    - `when needed` (default) — create a work only when there's a composer/lyricist/writer credit to attach to the recording. 
    - `when missing` — create a work for every recording without one, regardless of credits.
    - `never` — never create any work, even when there are credits
1. **Dedup**
    - **Equivalence sets**<br>
    Skip a role when an equivalent role already exists on the target (writer ≡ composer).
    - **Duplicate roles**<br>
    Skip a role when the target recording already has the same role (regardless of attributes / dates / tasks).

Options 2–5 are re-read at dispatch time, so they can be flipped during the review phase and the import will follow the latest pick.

### Entity Review Table

Single-row-per-entity table for confirming Discogs ↔ MusicBrainz matches before dispatch.

**Row state** is conveyed by color and badges:
- 🟢 confirmed (auto-resolved or user-selected)
- 🟡 name differs (resolved via URL but the MB name doesn't match Discogs — verify)
- 🔴 needs attention (not resolved)
- "no profile" red badge when the Discogs entity has no profile page

**Discogs URL link state** appears as a single chip per row:
- ✓ Discogs URL already linked
- 🔗 Add Discogs link (one click opens MB's edit page pre-filled; the chip flips to ✓ when the user returns to the tab after submitting)
- ⚠ linked to a different MB entity

- **Parallel lookup**<br>
All artists, labels and places are checked against MB through a shared throttle (4 concurrent in-flight requests + cooperative `Retry-After` backoff on 429/503). Preflight runs artists then companies sequentially to avoid bursting MB's rate limiter.
- **IDB cache**<br>
Resolved Discogs ↔ MB MBID mappings persist across sessions and are checked first. Each record tracks how it was originally resolved (`name` / `url` / `both` / `user`) — surfaced in the table's "Resolved via" column.
- **Inline MB search**<br>
Live search field on every row; type a name or paste an MBID / MB URL.
- **Auto-match**<br>
Name search and Discogs URL lookup run in parallel. Auto-resolution happens only when the result is trustworthy:
  - **Both agree** on the same MB entity → resolved with high confidence.
  - **Only one side** returns a hit → auto-accepted only when strong (unique exact-name match OR direct Discogs↔MB URL relation).
  - **They disagree** → left unresolved for manual review.
- **Entity creation**<br>
`+` button opens MB's create page pre-filled (name, sort name, type, Discogs URL). After save the tab closes itself and the row auto-selects the new entity.
- **Refresh from MB**<br>
🔄 button re-resolves every entity against fresh MB data. Deletes the existing IDB record up-front, so a failed refresh leaves the entity un-cached rather than downgrading a previously-good MBID.
- **Credited as**<br>
Per-entity override input — sets `entity1_credit` on every dispatched rel for that entity.
- **Preflight diagnostics**<br>
Collapsed `<details>` block below the main log with per-worker / per-request trace. Useful when something feels slow.

### Instant Fill

The dispatch-based zero-dialog import. Idempotent — skips relationships that already exist on the target or were dispatched earlier in the same session.

- Release-level: labels, places, company credits, release artists.
- Tracklist: instruments, vocals, task attributes.
- Work-level: lyrics, composer, writer (with work auto-creation per the chosen mode).
- Statistics in the edit note: input size, unresolved count, added / existed-in-MB / deduped-this-session / skipped / failed.

### Page-wide helpers

These run on every `/edit-relationships` page regardless of whether a Discogs link is present:

- **Hover-highlight** — Hovering an entity in the rel editor highlights all relationships that reference it (and vice versa). Also runs against the review table while it's open.
- **Batch-remove** — Modifier-click (SHIFT, CTRL, SHIFT+CTRL) on any `(×)` button opens a popup to remove all relationships matching a chosen scope (by entity, by link type, by track range, only-this-session).

## Notes

1. **IndexedDB cache** — Resolved Discogs URL → MB MBID mappings persist across sessions.
1. **Rate-limit handling** — All MB WS2 requests share one throttle. On 429/503 every in-flight worker idles until the `Retry-After` window elapses (cooperative backoff).
1. **unsafeWindow** — Uses `@grant unsafeWindow` to access MB's real page `window` where `MB.relationshipEditor` lives.
1. **BroadcastChannel** — Same-origin cross-tab messaging for the entity-creation → review-table feedback loop.
1. **Discogs API** — Fetches release data from `api.discogs.com` using the token from MB's stored Discogs URL.

## Animated gifs

For [Funk D’Void - Technoir](https://musicbrainz.org/release/63b2e0e6-5857-43cf-be6b-c98397f5d817), just one work exists, everything else is added by the import script

![usage1](./usage1.gif)

For [Mocky - Music Will Explain (Choir Music Vol. 01)](https://musicbrainz.org/release/3e5946b6-d275-4664-a8e9-1b15f0c55d68), many credits are already in place. Script skips those already created and adds those that do not exist. No works are created because existing ones are found. Existing release level credits that would be added to recordings by the script if they didn't exist, are not removed.

![usage2](./usage2.gif)

## Development

See [DEVELOP.md](./DEVELOP.md) for prerequisites, install steps, the dev loop, testing, and contributor workflow.
