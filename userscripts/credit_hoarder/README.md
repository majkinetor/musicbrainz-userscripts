# Credit Hoarder <img src="icon.svg" align="left" width="48" height="48">

Import track and release credits from streaming and database providers into MusicBrainz relationships, with a review phase so you only ever seed  entities that actually exist in MB.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/credit_hoarder/dist/credit_hoarder.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/credit_hoarder/dist/credit_hoarder.user.js)
- [Changelog](./CHANGELOG.md)

> Credit Hoarder is the multi-source successor to the single-source [Discogs Importer](../discogs_credits/README.md). It reuses that engine's resolution/review core but treats every provider as a peer. If you only ever import from Discogs, either works; for Tidal/Qobuz (and future providers), use Credit Hoarder.

The script presents itself on the **Edit relationships** screen of a MusicBrainz release when there's something to import — a linked provider (or one [Platform Check](../platform_check/README.md) found), **or** track titles that name a remixer (the **Titles** source). On a release with neither it stays out of the way. Make sure to read [Style / Relationships](https://musicbrainz.org/doc/Style/Relationships) for the general guidelines.

## Workflow

1. CH fetches the provider's credits and gathers every entity (artists, labels, places), presenting them in the **Credit Review Table**.
    1. Each entity is matched by name and — where the provider exposes one — by its source URL.
    1. Perfect hits are auto-selected; ambiguous or non-existent entities are left for you to resolve or ignore.
1. Once the review table is confirmed, **Instant Fill** runs.
    1. Entities with a resolved MB ID are attached to the release or the track (per the options); the rest are skipped and reported in the log.
    1. Some relationships attach to the **work** rather than the recording; a missing work can be created automatically (per the *Create works* option). If the work doesn't exist and creation is off, the relationship is skipped and logged.
1. After any manual fixes, you confirm the MusicBrainz edit.

## Features

### Import bar

The UI strip at the top of the page with the source picker, the option toggles, log output, a documentation link, and Copy-log buttons. Options are saved in localStorage and persist across sessions.

- **Source picker** — a single split **Import** button. The main button imports from the default source; the **▾** opens a menu of every provider available for the release (each with its brand icon). The chosen source's icon stays visible through *Importing…* and on the review-table *Start import* button.
- **Per-track credits** — import track-level artist credits in addition to release-level credits.
- **Move release credits to tracks** — move appropriate release-level credits down to all recordings (instruments, vocals, producer, mix, …). Pre-existing release-level credits aren't moved.
- **Create works** — mode picker:
    - `when needed` (default) — create a work only when there's a composer/lyricist/writer credit to attach.
    - `when missing` — create a work for every recording without one, regardless of credits.
    - `never` — never create a work, even when there are credits.
- **Dedup**
    - **Equivalence sets** — skip a role when an equivalent role already exists on the target (writer ≡ composer).
    - **Duplicate roles** — skip a role when the target recording already has the same role (regardless of attributes / dates / tasks).
### Credit Review Table

A single-row-per-entity table for confirming source ↔ MusicBrainz matches before dispatch.

**Row state** is conveyed by colour:
- ⚪ auto match
- 🟢 user selected
- 🟡 name differs — resolved via URL but the MB name doesn't match the source (worth verifying)
- 🔴 needs attention — not resolved

**Source-URL link state** (for providers that expose an artist URL — Discogs, Tidal; not Qobuz) appears as a single chip per row:
- ✓ source URL already linked
- 🔗 add the source link — click opens MB's edit page pre-filled
- ⚠ linked to a different MB entity

Efficiency features:

- **Parallel lookup** — all artists, labels and places are checked against MB through a shared throttle.
- **Cache** — resolved source ↔ MB MBID mappings persist across sessions and are checked first; each record shows a badge with how it was originally resolved (`name` / `url` / `name+url` / `user`). Sources that expose a per-credit URL (Discogs, Tidal) cache globally by that URL; **name-only** credits (Qobuz, the title-derived remixers) cache **per release** — keyed by the release and the name — so re-running the same release reuses your picks without a bare name leaking a resolution onto a different release.
- **Inline MB search** — a live search field on every row; type a name or paste an MBID / MB URL.
- **Auto-match** — name search and source-URL lookup run in parallel; auto-resolution only when trustworthy:
    - **Both agree** on the same MB entity → resolved with high confidence.
    - **Only one side** returns a hit → auto-accepted only when strong (unique exact-name match OR a direct source↔MB URL relation).
    - **They disagree** → left unresolved for manual review.
- **Entity creation**
    - `+` opens MB's create page pre-filled (name, sort name, type, source URL); after save the tab closes itself and the row auto-selects the new entity.
    - `▾` opens advanced creation options (where the provider supports it, e.g. Discogs): set disambiguation by the role or from text selected in the source profile, take the real name from the source profile.
- **Refresh from MB** — 🔄 deletes the existing cache and re-resolves every entity against fresh MB data.
- **Credited as** — a per-entity override that sets `entity1_credit` on every dispatched rel for that entity (if the entity already exists in relationships, the most common *credited as* value is used). Helper buttons **[MB]** and **[source]** set the value to the MB or source name quickly.
- **MB roles** — each artist's header carries an **MB roles** toggle; clicking it fetches that artist's existing MB relationship categories (`producer`, `mix`, `mastering`, `instrument`, …) as tags, so you can sanity-check the source role against the artist's known roles. On request only (one extra request per artist), cached for the session.
- **Preflight diagnostics** — a collapsed `<details>` block below the main log with a per-worker / per-request trace, for when something feels slow.

### Instant Fill

The dispatch-based, zero-dialog import. Idempotent — skips relationships that already exist on the target or were dispatched earlier in the same session.

- Release-level: labels, places, company credits, release artists, …
- Tracklist: instruments, vocals, task attributes, …
- Work-level: lyrics, composer, writer (with work auto-creation per the chosen *Create works* option), …
- Detailed statistics in the edit note.

### Page-wide helpers

These run on every `/edit-relationships` page regardless of which provider (if any) is present:

- **Hover-highlight** — hovering an entity in the relationship editor highlights every relationship that references it (and vice versa). Also runs against the review table while it's open.
- **Batch-remove** — modifier-click (SHIFT, CTRL, SHIFT+CTRL) on any `(×)` button opens a popup to remove all relationships matching a chosen scope (by entity, by link type, by track range, only-this-session).

## Shortcuts

**Batch-remove** — hold a modifier and click any relationship's `(×)` remove button to open the batch-remove popup, seeded by scope:

| Click | Scope |
|---|---|
| `Shift` + click | same **role** |
| `Ctrl`/`⌘` + click | same **target** entity |
| `Ctrl`/`⌘` + `Shift` + click | same **role and target** |

In the review table's create-artist popup and the batch-remove dialog: `Enter` confirms, `Esc` closes. In a search box, `Enter` runs the search.

## Diagnostics

The log panel records every step. The log menu offers **Copy log** (includes the raw source data), **Copy without JSON**, and per-provider raw/parsed copies (**Copy Discogs / Tidal / Qobuz**) for filing issues — each labelled by the source it came from.

## Providers

Providers differ in how rich their credits are and — crucially — whether they expose a stable **artist identity** that resolves to MB exactly, or only a **name** that has to be searched and confirmed.

| Provider | Credits exposed | Artist identity | How it's fetched | Auth |
|---|---|---|---|---|
| **Discogs** | Fullest — performers + instruments, engineering, production, artwork, mastering, … | Discogs **artist IDs** → exact MB resolution via URL relationships | Discogs API | none |
| **Tidal** | Per-track: Producer, Mixing/Recording/Sound Engineer, Composer, Lyricist, Writer, Orchestrator, (Music) Publisher. **Plus release-level credits** from the Info tab — instruments, vocals, conductor, artwork, etc. (album-wide credits Tidal only lists once) | **Tidal artist IDs** on ~99% of credits → exact MB resolution via URL relationships | companion harvest in an anonymously-opened `tidal.com/album/<id>/credits` tab (per-track **and** the Info tab's "Additional Credits"), relayed back cross-tab | none |
| **Qobuz** | Composer, Lyricist, Producer, Publisher, performers | **names only** — Qobuz exposes no artist/profile links on credits, so each name is resolved by MB **name search + your review** | direct page fetch (credits are server-rendered into the store page) | none |
| **Titles** | **Remixers only**, derived from the release's own track titles — no external provider | **names only** — resolved by MB **name search + your review** | reads the track titles already on the MB release | none |

The **Titles** source parses remixer credits straight from the track-title disambiguation convention, for releases where the remix is named in the title but no provider lists it. A track titled *Song (Artist Remix)*, *Track (KiNK Dub)*, *Tune (Tom Moulton Mix)* or *Cut (Remixed by Someone)* contributes a **remixer** relationship for that recording. Only the reliable *named-remix* convention fires — anonymous descriptors like *(Extended Mix)*, *(Radio Edit)*, *(Original Mix)* or a bare *(Remix)* (edits/versions of the original, not a remix by a named artist) are ignored, and *(Mixed by …)* is left alone (that's an engineer). It's offered only when the titles actually contain a named remix (probed when the page loads): in the **▾** submenu when a provider is linked, and as the sole import action when none is. Everything still goes through the review table before it's committed. Because these remixers carry no source URL, your review picks for them are cached **per release** (keyed by the release and the parsed name) — so re-running the Titles source on the same release reuses your matches instead of re-asking, while a bare name like *Friends* never leaks a resolution onto a different release.

Notes & limitations:

- **Artist identity is the dividing line.** Discogs and Tidal carry per-credit artist IDs, so most credits resolve to the exact MB artist automatically. **Qobuz gives names only** — there's no Qobuz artist-page link on a credit — so its credits land in the review table for you to confirm, and ambiguous names need a manual pick. Provider-specific helpers that depend on a source profile (e.g. pulling a real name / disambiguation from a Discogs profile) only apply to that provider.
- **Coverage varies by release and region.** A provider only appears when the release is linked to it (or Platform Check found it); Tidal/Qobuz catalogues are licensing- and region-dependent.
- **Tidal release-level credits (Info tab).** Many Tidal releases list their credits once for the whole album (on the Info tab → "Additional Credits") rather than per track — some have *no* per-track credits at all. The harvest reads both, so these albums import too. Release-level recording credits (producer, instruments, vocals, …) are pushed to every track when **Move release credits to tracks** is on; artwork/mastering stay at release level.
- **Qobuz position anchoring.** Qobuz's page repeats empty credit blocks, so credits are matched to tracks by the page's real track-number markers, not element order — otherwise credits would seed onto the wrong tracks.

### Role mapping (streaming providers)

| Provider role | MusicBrainz relationship |
|---|---|
| Composer, Lyricist, Writer, Orchestrator | **work** rel (works are created on demand, as in the Discogs flow) |
| Producer, Mixing Engineer (→ *mix*), Recording Engineer (→ *recording*), Sound Engineer (→ *sound*) | **recording** rel |
| Assistant Mixing / Recording / Sound Engineer | same **recording** rel as above, with the MB **assistant** attribute ticked (MB has no separate "assistant engineer" relationship) |
| Instruments, Vocals, Background Vocals, Conductor (release-level) | **recording** rel (resolved through the shared instrument/role tables, same as Discogs) |
| Artwork (release-level) | **release** rel (artwork) |
| Music Publisher | **label → work** *publishing* rel — the publisher is resolved as an MB **label** (by name) and linked to each track's work. `Copyright Control` placeholder is dropped |
| Current Distributor | **label → release** *distributed* rel — the distributor is resolved as an MB **label** (by name) |

Tidal roles surfaced in the log but **not** imported: *Primary/Main/Featured Artist* and *Record Label* (the release's own artist credit / label, set elsewhere, not a relationship); and *Mastering Engineer* (artist→recording mastering is deprecated in MB — mastering belongs at release level), *Sound Editor*, *Studio Personnel* (no clean MB target). All appear in the skipped list so nothing is silently dropped.

## Notes

1. **IndexedDB cache** — resolved source URL → MB MBID mappings persist across sessions.
1. **Rate-limit handling** — all MB WS2 requests share one throttle; on 429/503 every in-flight worker idles until the `Retry-After` window elapses (cooperative backoff).
1. **unsafeWindow** — uses `@grant unsafeWindow` to reach MB's real page `window`, where `MB.relationshipEditor` lives.
1. **BroadcastChannel** — same-origin cross-tab messaging for the entity-creation → review-table feedback loop, and for the Tidal credits-tab harvest.
1. **Provider sources** — Discogs via `api.discogs.com` (token from MB's stored Discogs URL); Tidal via an anonymously-opened credits tab harvested cross-tab; Qobuz via the server-rendered store page.
1. Resolution/review engine initially based on the Discogs Importer, itself based on the userscripts of *mattgoldspink*, *vzell*, *kellnerd*.


## Development

See [DEVELOP.md](./DEVELOP.md) for prerequisites, install steps, the dev loop, testing, and contributor workflow.
