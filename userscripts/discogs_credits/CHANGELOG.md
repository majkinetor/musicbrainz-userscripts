# Import Discogs Credits Changelog

## 2026.5.27

### Features

1. Source code split into per-module files and bundled with esbuild ([#32](https://github.com/majkinetor/musicbrainz-userscripts/issues/32))
1. Statistics line in the edit note — added / existed-in-MB / deduped-this-session / skipped / failed counts ([#56](https://github.com/majkinetor/musicbrainz-userscripts/issues/56))
1. Deduplication options: equivalence sets (writer ≡ composer), duplicate-role skip, and per-entity "Credited as" override ([#62](https://github.com/majkinetor/musicbrainz-userscripts/issues/62))
1. Hover-highlight: hovering an entity in the rel editor highlights all relationships referencing it (and vice versa) ([#63](https://github.com/majkinetor/musicbrainz-userscripts/issues/63))
1. Batch-remove popup on modifier-click of any MB `×` button, with scoped removal — by entity, by link type, by track range, only-this-session ([#68](https://github.com/majkinetor/musicbrainz-userscripts/issues/68))
1. Inline action chips on review-table rows; Import button moved to the left; refresh button repositioned ([#77](https://github.com/majkinetor/musicbrainz-userscripts/issues/77))
1. Distinct warning badges on review-table entries — red "no profile" and amber "name differs" instead of a generic ⚠ icon ([#81](https://github.com/majkinetor/musicbrainz-userscripts/issues/81))
1. Progress bar switches from indeterminate marquee to determinate fill across preflight and dispatch phases ([#82](https://github.com/majkinetor/musicbrainz-userscripts/issues/82))
1. 📖 Documentation link in the bar header ([#90](https://github.com/majkinetor/musicbrainz-userscripts/issues/90))
1. *Create works* mode picker — `when needed` (default) creates a work only when there is a composer/lyricist/writer credit to attach; `when missing` preserves the old always-create behaviour. Options are also re-read at dispatch time so flipping them during the review phase takes effect ([#94](https://github.com/majkinetor/musicbrainz-userscripts/issues/94))
1. Copy-log buttons: full log wrapped in `<details>` for issue-tracker pastes, plus a "Copy log (no JSON)" variant for size-constrained contexts. Mid-review copies substitute the static markdown table for the interactive review panel ([#46](https://github.com/majkinetor/musicbrainz-userscripts/issues/46))
1. "Searching…" placeholder on review-table row search so the click button isn't visually dead while MB responds ([#98](https://github.com/majkinetor/musicbrainz-userscripts/issues/98))

### Fixes

1. *Already existed* count was inflated by intra-session duplicates; split into separate `existedInMb` and `dedupedThisSession` counters ([#34](https://github.com/majkinetor/musicbrainz-userscripts/issues/34))
1. Unresolved entities no longer leak through via IDB fallback after the user un-selects them in the review table ([#35](https://github.com/majkinetor/musicbrainz-userscripts/issues/35))
1. Discogs-link chip on newly-created entities now jumps to ✓ instead of briefly showing the 🔗 button — session cache now wins over the stale preflight `urlLinkedIds` snapshot ([#78](https://github.com/majkinetor/musicbrainz-userscripts/issues/78))
1. Preflight pacing rebuilt around cooperative `Retry-After` backoff (single shared pause across the throttle), per-request 10s `AbortController` timeout, serialized artist/company passes, and refresh-from-MB now deletes the IDB record up-front so a failed refresh can't downgrade a previously-good MBID to "attention". Includes a collapsed *Preflight diagnostics* log section ([#87](https://github.com/majkinetor/musicbrainz-userscripts/issues/87))
1. Toggle tooltips now render outside `.discogs-bar`'s `overflow:hidden` — `position: fixed` with JS-positioned top/left, edge-clamped horizontally, flips below the toggle when no room above ([#89](https://github.com/majkinetor/musicbrainz-userscripts/issues/89))
1. New-entity tab close caps the name-fetch wait at 1s and drops the 800ms artificial delay — worst case ~1.1s instead of 10s+ when MB's `/ws/2/<type>/<mbid>` stalls ([#97](https://github.com/majkinetor/musicbrainz-userscripts/issues/97))

## 2026.5.25

### Features

1. Per-line timestamps in the import log ([#9](https://github.com/majkinetor/musicbrainz-userscripts/issues/9))
1. Persistence of entity cache incrementally, not only after confirming ([#23](https://github.com/majkinetor/musicbrainz-userscripts/issues/23))

### Fixes

1. Mastering relationship is deprecated for recordings ([#2](https://github.com/majkinetor/musicbrainz-userscripts/issues/2))
1. Instrument with 'co' attribute blocks the commit - attribute unsupported ([#3](https://github.com/majkinetor/musicbrainz-userscripts/issues/3))
1. Collapsing relationships with multiple media ([#4](https://github.com/majkinetor/musicbrainz-userscripts/issues/4))
1. homepageURL in edit note is undefined ([#7](https://github.com/majkinetor/musicbrainz-userscripts/issues/7), thanks @chaban-mb)
1. Background fetches during relationship filling phase for all unresolved artists ([#8](https://github.com/majkinetor/musicbrainz-userscripts/issues/8))
1. Some instruments silently dropped due to duplicate keys in the map ([#22](https://github.com/majkinetor/musicbrainz-userscripts/issues/22))
1. Discogs role 'Accompanied By' mapped to 'instrument' link type instead of 'performer' ([#26](https://github.com/majkinetor/musicbrainz-userscripts/issues/26))
1. Slow speed of entity lookup ([#30](https://github.com/majkinetor/musicbrainz-userscripts/issues/30))
1. Rattle instrument mapped to shaken idiophone instead of ankle rattlers ([#1](https://github.com/majkinetor/musicbrainz-userscripts/pull/1), thanks @musoke)

## 2026.5.22

### Features

1. Artists without Discogs page are now included
1. *Copy log* feature now uses markdown format
1. Added full Discogs API JSON response to the log
1. Discogs link check is added to cache
1. Musicbrainz beta server added
1. All *arrange* roles moved from work to recording relationship

### Fixes

1. Instant fill now works with releases with multiple media
1. Cached review table still firing background requests and loosing state
1. Object error when finally submitting data - labels/places specified with incorrect role

## 2026.5.21

Initial version
