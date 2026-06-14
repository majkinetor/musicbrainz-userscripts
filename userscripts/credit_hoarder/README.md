# Credit Hoarder <img src="icon.svg" align="left" width="48" height="48">

Import per-track release **credits** from streaming and database providers into MusicBrainz relationships — with a review phase so you only ever seed relationships to artists that actually exist in MB.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/credit_hoarder/dist/credit_hoarder.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/credit_hoarder/dist/credit_hoarder.user.js)

> Credit Hoarder is the multi-source successor to the single-source [Discogs Importer](../discogs_credits/README.md). It reuses that engine's resolution/review core but treats every provider as a peer. If you only ever import from Discogs, either works; for Tidal/Qobuz (and future providers), use Credit Hoarder.

The script presents itself on the **Edit relationships** screen of a MusicBrainz release that has a linked (or [Platform Check](../platform_check/README.md)–found) provider. Make sure to read [Style / Relationships](https://musicbrainz.org/doc/Style/Relationships) for the general guidelines.

## Workflow

1. CH fetches the provider's per-track credits and gathers every entity (artists, labels, places), presenting them in the **Credit Review Table**.
    1. Each entity is matched by name and — where the provider exposes one — by its source URL.
    1. Perfect hits are auto-selected; ambiguous or non-existent entities are left for you to resolve or ignore.
1. Once the review table is confirmed, **Instant Fill** runs.
    1. Entities with a resolved MB ID are attached to the release or the track (per the options); the rest are skipped and reported in the log.
    1. Some relationships attach to the **work** rather than the recording; a missing work can be created automatically (per the *Create works* option). If the work doesn't exist and creation is off, the relationship is skipped and logged.
1. After any manual fixes, you confirm the MusicBrainz edit.

## Providers

Providers differ in how rich their credits are and — crucially — whether they expose a stable **artist identity** that resolves to MB exactly, or only a **name** that has to be searched and confirmed.

| Provider | Credits exposed | Artist identity | How it's fetched | Auth |
|---|---|---|---|---|
| **Discogs** | Fullest — performers + instruments, engineering, production, artwork, mastering, … | Discogs **artist IDs** → exact MB resolution via URL relationships | Discogs API | none |
| **Tidal** | Producer, Mixing/Recording/Sound Engineer, Composer, Lyricist, Writer, Orchestrator, (Music) Publisher | **Tidal artist IDs** on ~99% of credits → exact MB resolution via URL relationships | companion harvest in an anonymously-opened `tidal.com/album/<id>/credits` tab, relayed back cross-tab | none |
| **Qobuz** | Composer, Lyricist, Producer, Publisher, performers | **names only** — Qobuz exposes no artist/profile links on credits, so each name is resolved by MB **name search + your review** | direct page fetch (credits are server-rendered into the store page) | none |

Notes & limitations:

- **Artist identity is the dividing line.** Discogs and Tidal carry per-credit artist IDs, so most credits resolve to the exact MB artist automatically. **Qobuz gives names only** — there's no Qobuz artist-page link on a credit — so its credits land in the review table for you to confirm, and ambiguous names need a manual pick. Provider-specific helpers that depend on a source profile (e.g. pulling a real name / disambiguation from a Discogs profile) only apply to that provider.
- **Coverage varies by release and region.** A provider only appears when the release is linked to it (or Platform Check found it); Tidal/Qobuz catalogues are licensing- and region-dependent.
- **Qobuz position anchoring.** Qobuz's page repeats empty credit blocks, so credits are matched to tracks by the page's real track-number markers, not element order — otherwise credits would seed onto the wrong tracks.

### Role mapping (streaming providers)

| Provider role | MusicBrainz relationship |
|---|---|
| Composer, Lyricist, Writer, Orchestrator | **work** rel (works are created on demand, as in the Discogs flow) |
| Producer, Mixing Engineer (→ *mix*), Recording Engineer (→ *recording*), Sound Engineer (→ *sound*) | **recording** rel |
| Music Publisher | **work** publisher (`Copyright Control` placeholder is dropped) |

Tidal roles that are surfaced in the log but **not** imported (no clean MB target): *Mastering Engineer* (artist→recording mastering is deprecated in MB — mastering belongs at release level), *Sound Editor*, *Studio Personnel*, and the *Assistant … Engineer* variants (these need an MB "assistant" attribute that isn't modelled here yet). They appear in the skipped list so nothing is silently dropped.
| Main Artist, Featured Artist | skipped — already the release's artist credit |

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
- **Cache** — resolved source ↔ MB MBID mappings persist across sessions and are checked first; each record shows a badge with how it was originally resolved (`name` / `url` / `name+url` / `user`).
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

## Diagnostics

The log panel records every step. The log menu offers **Copy log** (includes the raw source data), **Copy without JSON**, and per-provider raw/parsed copies (**Copy Discogs / Tidal / Qobuz**) for filing issues — each labelled by the source it came from.

## Notes

1. **IndexedDB cache** — resolved source URL → MB MBID mappings persist across sessions.
1. **Rate-limit handling** — all MB WS2 requests share one throttle; on 429/503 every in-flight worker idles until the `Retry-After` window elapses (cooperative backoff).
1. **unsafeWindow** — uses `@grant unsafeWindow` to reach MB's real page `window`, where `MB.relationshipEditor` lives.
1. **BroadcastChannel** — same-origin cross-tab messaging for the entity-creation → review-table feedback loop, and for the Tidal credits-tab harvest.
1. **Provider sources** — Discogs via `api.discogs.com` (token from MB's stored Discogs URL); Tidal via an anonymously-opened credits tab harvested cross-tab; Qobuz via the server-rendered store page.
1. Resolution/review engine initially based on the Discogs Importer, itself based on the userscripts of *mattgoldspink*, *vzell*, *kellnerd*.

## Roadmap

See the [Credit Hoarder issue (#193)](https://github.com/majkinetor/musicbrainz-userscripts/issues/193) for the plan, including additional auth-free providers and applying imported credits across a whole release group with format-aware rules (e.g. lacquer-cut credits never propagate to a digital release).

## Development

See [DEVELOP.md](./DEVELOP.md) for prerequisites, install steps, the dev loop, testing, and contributor workflow.
