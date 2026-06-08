# ISRC Scout Changelog

## [2026.6.8](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/2026.6.8)

### Features

1. New ISRC source **Tidal** — imports from a linked Tidal album via the official API (no user login)
1. New ISRC source **Beatport** — harvests ISRCs from the release page in a brief background tab (Beatport is Cloudflare-walled, so a direct fetch isn't possible)
1. Beatport / Tidal ▾ menus can import from a custom URL or the URL Platform Check found when the link isn't on the release yet
1. SoundExchange "exact" match options are now collapsible (state remembered) to make room on the toolbar
1. ⚙ Setup options to show the import-source buttons as brand icons and/or text labels (independent; default icons only)

### Fixes

1. A Beatport release tab opened by you or by Platform Check no longer closes itself — the harvester only auto-closes the tab the editor opened for its own background import

## [2026.6.7](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/2026.6.7)

### Features

1. Highlighting missing ISRC rows ([#159](https://github.com/majkinetor/musicbrainz-userscripts/issues/159))
1. SoundExchange anti-bot improvements ([#157](https://github.com/majkinetor/musicbrainz-userscripts/issues/157))

## [2026.6.5](https://github.com/majkinetor/musicbrainz-userscripts/releases/tag/2026.6.5)

### Features

1. Cancel queued requests on certain actions ([#127](https://github.com/majkinetor/musicbrainz-userscripts/issues/127))

### Fixes

1. SX rate limited issues are not properly shown ([#126](https://github.com/majkinetor/musicbrainz-userscripts/issues/126))
