# Credit Hoarder <img src="icon.svg" align="left" width="48" height="48">

Import per-track release **credits** from streaming and database providers into MusicBrainz relationships — with a review phase so you only ever seed relationships to artists that actually exist in MB.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/credit_hoarder/dist/credit_hoarder.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/credit_hoarder/dist/credit_hoarder.user.js)

> Credit Hoarder is the multi-source successor to the single-source [Discogs Importer](../discogs_credits/README.md). It reuses that engine's resolution/review core but treats every provider as a peer. If you only ever import from Discogs, either works; for Tidal/Qobuz (and future providers), use Credit Hoarder.

## Overview

The script runs on the release **relationship editor** (`/release/<mbid>/edit-relationships`). For every supported provider linked to the release — or found for it by [Platform Check](../platform_check/README.md) — it can:

1. **Fetch** the provider's per-track credits,
2. **Resolve** each credited name to a real MusicBrainz artist (by the provider's artist ID where one exists, otherwise by name search),
3. present everything in a **review table** where you confirm / adjust the matches, and
4. only then **seed** the relationships into the editor.

Nothing is written blindly: an unresolved name is surfaced for you to pick, never linked to a guess.

## Providers

Providers differ in how rich their credits are and — crucially — whether they expose a stable **artist identity** that resolves to MB exactly, or only a **name** that has to be searched and confirmed.

| Provider | Credits exposed | Artist identity | How it's fetched | Auth |
|---|---|---|---|---|
| **Discogs** | Fullest — performers + instruments, engineering, production, artwork, mastering, … | Discogs **artist IDs** → exact MB resolution via URL relationships | Discogs API | none |
| **Tidal** | Producer, Composer, Lyricist, (Music) Publisher | **Tidal artist IDs** on ~99% of credits → exact MB resolution via URL relationships | companion harvest in an anonymously-opened `tidal.com/album/<id>/credits` tab, relayed back cross-tab | none |
| **Qobuz** | Composer, Lyricist, Producer, Publisher, performers | **names only** — Qobuz exposes no artist/profile links on credits, so each name is resolved by MB **name search + your review** | direct page fetch (credits are server-rendered into the store page) | none |

Notes & limitations:

- **Artist identity is the dividing line.** Discogs and Tidal carry per-credit artist IDs, so most credits resolve to the exact MB artist automatically. **Qobuz gives names only** — there's no Qobuz artist-page link on a credit — so its credits land in the review table for you to confirm, and ambiguous names need a manual pick.
- **Coverage varies by release and region.** A provider only appears when the release is linked to it (or Platform Check found it); Tidal/Qobuz catalogues are licensing- and region-dependent.
- **Qobuz position anchoring.** Qobuz's page repeats empty credit blocks, so credits are matched to tracks by the page's real track-number markers, not element order — otherwise credits would seed onto the wrong tracks.

### Role mapping (streaming providers)

| Provider role | MusicBrainz relationship |
|---|---|
| Composer, Lyricist | **work** rel (works are created on demand, as in the Discogs flow) |
| Producer, Mixer, Engineer | **recording** rel |
| Music Publisher | **work** publisher (`Copyright Control` placeholder is dropped) |
| Main Artist, Featured Artist | skipped — already the release's artist credit |

## Diagnostics

The log panel records every step. The log menu offers **Copy log** (includes the raw source data), **Copy without JSON**, and per-provider raw/parsed copies (**Copy Discogs / Tidal / Qobuz**) for filing issues — each labelled by the source it came from.

## Roadmap

See the [Credit Hoarder issue (#193)](https://github.com/majkinetor/musicbrainz-userscripts/issues/193) for the plan, including additional auth-free providers and applying imported credits across a whole release group with format-aware rules (e.g. lacquer-cut credits never propagate to a digital release).
