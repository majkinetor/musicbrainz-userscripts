# Credit Hoarder <img src="icon.png" align="left" width="48">

Import release credits from **Discogs**, **Tidal** and **Qobuz** into MusicBrainz relationships — with a review phase.

- Install: [latest (credit-hoarder branch)](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/credit-hoarder/userscripts/credit_hoarder/dist/credit_hoarder.user.js)

> **Status: experimental.** Credit Hoarder lives on the long-lived `credit-hoarder` branch while the multi-source idea proves itself. It is seeded from the [Discogs Importer](../discogs_credits/README.md) engine; the Discogs Importer itself remains a separate, stable script.

## Overview

The userscript runs on the release **relationship editor** (`/release/<mbid>/edit-relationships`). For every supported provider linked to the release (or found via [Platform Check](../platform_check/README.md)) it can fetch the provider's per-track credits, resolve each credited name to a real MB artist, present everything in a **review table**, and only then seed relationships into the editor — unlike blind importers that create relationships to artists that don't exist in MB.

## Sources

| Source | Credits | Artist identity | Fetch | Auth |
|---|---|---|---|---|
| **Discogs** | full (instruments, engineering, artwork, …) | Discogs artist IDs → exact MB resolution via URL rels | Discogs API | none |
| **Tidal** | Producer, Composer, Lyricist, Music Publisher | **Tidal artist IDs** (~99% of credits) → exact MB resolution via URL rels | companion harvest on an anonymously-opened `tidal.com/album/<id>/credits` tab, relayed back cross-tab | none |
| **Qobuz** | Composer, Lyricist, Producer, Publisher, performers | names only → name search + review | direct page fetch (credits are server-rendered) | none |

Role mapping for the streaming sources: Composer/Lyricist → **work** rels (works are created on demand, as in the Discogs flow), Producer/Mixer/Engineer → **recording** rels, MusicPublisher → work publisher (the `Copyright Control` placeholder is dropped), MainArtist/FeaturedArtist → skipped (already the artist credit).

## Diagnostics

The log panel records every step; the log menu offers *Copy log* (includes the raw source data), *Copy without JSON*, and per-source raw/parsed data copies (*Copy Discogs*, *Copy Tidal*, *Copy Qobuz*) for filing issues.

## Roadmap

See the [Credit Hoarder issue](https://github.com/majkinetor/musicbrainz-userscripts/issues) for the full plan, including the exploration of applying imported credits across all releases in a release group with format-aware rules (e.g. lacquer-cut credits never propagate to digital releases).
