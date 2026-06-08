# Platform Check Changelog

## [2026.6.8](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/2026.6.8)

- New provider **Tidal** — resolved via existing MB rels, Wikidata (P4577), or the official Tidal search API (no user login)
- New provider **Beatport** — resolved via existing MB rels, Wikidata (P11312), or web search (DDG/Brave). Beatport is Cloudflare-walled so the track count can't be verified — a search hit is surfaced as an unverified match
- Fixed: the log (ⓘ) and provider/setup (⚙) modals could collapse to a corner / appear broken after the mobile-viewport changes — the unpin step was deleting the modal's base layout
- Fixed: the Tidal row wasn't circled when its link was already in MB but the API token grant failed — an existing/Wikidata link is now shown (and circled) regardless of the token
- Fixed: "open all" (↗) opened unconfirmed rows (track-count mismatches and unverifiable links); it now opens only confirmed ✓ matches, matching the + inject button

## [2026.6.7](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/2026.6.7)

- Small improvements
