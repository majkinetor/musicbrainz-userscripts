# Import Discogs Credits Changelog

## [2026.5.27](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/2026.5.27)

### Features

1. Source code split into modules and bundled with esbuild ([#32](https://github.com/majkinetor/musicbrainz-userscripts/issues/32))
1. Log wrapping within the *details* section and option to copy without Discogs JSON ([#46](https://github.com/majkinetor/musicbrainz-userscripts/issues/46))
1. Statistics in edit note ([#56](https://github.com/majkinetor/musicbrainz-userscripts/issues/56))
1. Import options to prevent duplication ([#62](https://github.com/majkinetor/musicbrainz-userscripts/issues/62))
1. Highlight entity on different roles ([#63](https://github.com/majkinetor/musicbrainz-userscripts/issues/63))
1. Batch remove of relationships with confirmation popup ([#68](https://github.com/majkinetor/musicbrainz-userscripts/issues/68))
1. Improvement of button layout ([#77](https://github.com/majkinetor/musicbrainz-userscripts/issues/77))
1. Improvement of Discogs artist warnings ([#81](https://github.com/majkinetor/musicbrainz-userscripts/issues/81))
1. Improvement of the progress bar ([#82](https://github.com/majkinetor/musicbrainz-userscripts/issues/82))
1. Documentation link in the header ([#90](https://github.com/majkinetor/musicbrainz-userscripts/issues/90))
1. Option to create works only when needed, with `never` as a third opt-out ([#94](https://github.com/majkinetor/musicbrainz-userscripts/issues/94), [#103](https://github.com/majkinetor/musicbrainz-userscripts/pull/103))

### Fixes

1. Already existed count is not correct ([#34](https://github.com/majkinetor/musicbrainz-userscripts/issues/34))
1. Entity used after unselecting ([#35](https://github.com/majkinetor/musicbrainz-userscripts/issues/35))
1. Button to add Discogs link present immediately after creating artist ([#78](https://github.com/majkinetor/musicbrainz-userscripts/issues/78))
1. Slow entity fetch ([#87](https://github.com/majkinetor/musicbrainz-userscripts/issues/87))

## [2026.5.25](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/discogs_credits%2F2026.5.25)

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
