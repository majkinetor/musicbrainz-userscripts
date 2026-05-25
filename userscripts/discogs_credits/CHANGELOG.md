# Import Discogs Credits Changelog

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
