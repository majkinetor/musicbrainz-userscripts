# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Providers

ISRC Scout has two independent provider systems, and a provider can support one without the other: **ISRC import** fills the release's missing ISRCs, and **track links** resolve a per-track URL for the Links tab's **Add** column.

### ISRC import

| Provider | Endpoint | Auth | How |
| --- | --- | --- | --- |
| SoundExchange | `isrc.soundexchange.com` | none | each track searched by title and artist; candidates per row, confident ones filled; 30 searches at a time, so it doesn't block us |
| Deezer | `api.deezer.com` | none | a request per track, so 50 tracks per batch; mapped by disc and position, title as the fallback |
| Spotify | `harmony.pulsewidth.org.uk`, `isrc.mollamusicgroup.com` or `isrchunt.com` | none | a service does the lookup server-side; see [Spotify](#spotify) |
| Beatport | `beatport.com` release page | none | behind Cloudflare, read in a background tab; see [Beatport](#beatport) |
| Tidal | `openapi.tidal.com` | app token, baked in | a client-credentials catalogue token, no user login; see [Tidal](#tidal) |
| Volumo | `volumo.com/api/v1` | none | one call returns every track's ISRC |
| Presto Music | `ajax-www.prestomusic.com/api/app/6/tracks/<code>` | none | CORS-open, no bot check; the code is the shop's product number (`/<section>/products/<code>`) or the streaming album's. Works hold the tracks, numbered across the set (`absTrack`, no discs); `singleFieldTrackTitle` is *Composer: Work: Movement*. A product that doesn't stream answers HTTP 404 with `{status:"error", code:54, message}` |
| HDtracks | `hdtracks.azurewebsites.net/api/v1` | none | CORS-open; one album call returns every ISRC inline. The album id is a 24-character ObjectId; a barcode (from a legacy `valbum_code` link) is resolved to it by search first |
| Apple Music | `amp-api.music.apple.com/v1/catalog` | the web player's token | the album's tracklist, read anonymously with the bearer token from the web player's JS, mapped by position. A legacy `itunes.apple.com/…/album/id…` link is the same album |
| SoundCloud | `api-v2.soundcloud.com` | public `client_id` | each track's `publisher_metadata.isrc`, by position; the `client_id` is lifted from the web player's JS. A track URL is a one-track release. A distributed set's barcode (`upc_or_ean`) is only logged |
| Qobuz | `www.qobuz.com/api.json/0.2` | a login, or a Qobuz country | one `album/get` returns every ISRC, by position; a barcode is resolved to the album with `album/search`, zero-padded. See [Qobuz](#qobuz) |

Audiomack, 7digital, YouTube Music and Amazon Music are read as in Platform Check's [Provider details](../platform_check/DEVELOP.md#provider-details); what ISRC Scout adds is below.

A Platform Check link withheld for a barcode or format mismatch isn't used by default (#314). An ISRC identifies a recording, not a release, but a barcode mismatch can equally mean Platform Check matched the wrong release (a one-track Beatport single by a same-prefixed artist, say), whose ISRCs would be wrong. *Ignore Platform Check link confidence* reads them anyway; a wrong track count is always skipped, and a link already in MusicBrainz or a pasted URL is unaffected.

### Track links

| Provider              | Resolved by                                                                                                                        | MusicBrainz link type      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Deezer, Tidal         | ISRC: a global by-ISRC lookup, on any release whose tracks have ISRCs                                                              | free streaming / streaming |
| Beatport, Volumo      | album: it carries every track's ISRC and id, so the track URL is matched by ISRC                                                   | purchase for download      |
| Qobuz                 | album: `album/get` carries every track's ISRC and id; the link is the id-only `open.qobuz.com/track/<id>`, matched by ISRC         | purchase for download      |
| Bandcamp, Apple Music | album page: every track URL (Apple's from the page's `ld+json`), by position and title; a title mismatch is skipped, never guessed | free streaming / streaming |
| SoundCloud            | set: every track's permalink, by position and title                                                                                | free streaming             |

A provider is offered for a track only when it can be resolved (Deezer and Tidal need the track's ISRC, the others the release's album link) or the recording already links it.

**Dead links aren't offered.** Deezer keeps an ISRC → track mapping after it pulls the audio, so a by-ISRC lookup can return a track that streams nowhere (unreadable, available in no country). Find links treats it as not found.

Providers resolve in parallel, each with its own light rate limit, and an album page is fetched once per release. Links are added through MusicBrainz's internal edit API over the logged-in session, so they need no OAuth. Ending and removing act on the existing relationship by its URL, which is why they work on any linked provider, including ones ISRC Scout can't add.

### Spotify

Spotify's own ISRC API needs a paid developer account, so the lookup goes through a service that does it server-side with its own credentials (#603):

- **Harmony** (default, #775): its release page `harmony.pulsewidth.org.uk/release?url=<album url>&spotify=` has a `table.tracklist` per medium, columns found by their headings (Track, Title, Artists, Length, ISRC). Mapped by disc and position; a track whose position holds another song goes by title. A failed lookup is HTTP 200 with the reason in `.message.error`. Harmony caches what it looked up, so a repeat is fast. An install left on molla, the old default, moves to Harmony once (`spotify_source_775`).

- **molla**: one `POST /api/spotify` with the album link returns every track's ISRC as JSON, in album order, with no track or disc numbers. When its track count matches the release, the ISRCs are mapped by position across all media; otherwise by title and artist, and unmatched tracks stay empty. Its Spotify quota is shared by every molla user, so a burst can hit a rate limit; since 2026-10 it is out of quota most of the time.
- **ISRC Hunt**: `isrchunt.com/spotify/importisrc?releaseId=<album url>` returns an HTML table of ISRCs, scraped and mapped by disc and position.

Track links come from the token-free `open.spotify.com/embed/album/<id>` page, which ships the ordered tracklist in `__NEXT_DATA__`, matched by position and title.

### Beatport

A release page embeds its tracklist, each track's ISRC included, in its `__NEXT_DATA__` JSON, but the site is behind Cloudflare, so a `GM_xmlhttpRequest` from MusicBrainz is always challenged. The script also runs on `beatport.com/release/*`: an import opens the release in a background tab, the copy there reads the ISRCs and stashes them in shared storage for the MusicBrainz tab, and the tab closes itself. A tab you or Platform Check open is read too but left open. The ISRCs are cached per release.

### Tidal

`openapi.tidal.com` with a baked-in client-credentials app token: catalogue access, no Tidal login. It reads `/albums/{id}/relationships/items`: each track's ISRC from the included track resources, its disc and track number from the relationship's metadata.

### Qobuz

Qobuz's catalogue API (`www.qobuz.com/api.json/0.2/…`) has two endpoints that matter (#201, #353, #418):

- **`album/search`** (album level: `upc`, `label`, `year`, `tracks_count`) works anonymously with the web player's app_id `712109809`. That is all Platform Check needs to find and verify a release.
- **`album/get`** is the only endpoint with per-track `isrc` (and roled `performers`). It is **geo-gated, not session-gated** (#418 corrected #353):
  - from a country Qobuz serves, app_id `712109809` answers `200` with `tracks.items[]` anonymously, with no cookies or token;
  - from anywhere else, the same request answers `404` "No result matching given argument" for every album id, even ids `album/search` just returned. The anonymous API decides by the request's IP; #353 ran from outside Qobuz's countries, which made it look session-gated;
  - the other web app_id, `798273057`, answers `401` "User authentication is required" regardless;
  - with a login's `user_auth_token` (header `X-User-Auth-Token`) it answers `200` from anywhere: the login lends its account's region.
- The store page's HTML has no ISRCs, so there is no anonymous scrape to fall back on.

ISRC Scout uses the session when there is one, and the anonymous call otherwise or when the session has gone stale. Platform Check owns the login (email and password → `user_auth_token`; the password is sent as an MD5 digest and never stored) and shares the token as `mbtools:qobuz` in MusicBrainz's `localStorage`, as it does Beatport's. ISRC Scout reads it for ISRCs, Credit Hoarder for roled credits.

- Qobuz rate-limits hard: after a few requests it answers `429`; honour `Retry-After`.
- It stores the UPC as the 13-digit EAN with a leading zero (`0199257198605`), so a barcode search must try the zero-padded form (#354).
- The slug-less `open.qobuz.com/album/<id>` that a MusicBrainz link often carries is an empty app shell; the album id is the last path segment either way.

### YouTube Music

A search for an ISRC YouTube Music doesn't know brings up unrelated songs instead of nothing, and labels sometimes reuse an ISRC for another version of a song with the same title and length: [JP92Q2400507](https://musicbrainz.org/isrc/JP92Q2400507) is both *メズマライザー* and its *Critical Damage ver.* Hence the strict search. The album's tracklist is read from its own playlist, because its album page, seen without logging in, shows a track's music video in its place. The edit note names the album because a song's URL stops saying which album it was on once it is delisted.

### Amazon Music

Amazon Music has no ISRC search, so only a linked album gives links. It is read as a guest, through the catalogue its web player uses.

### 7digital

Read through the catalogue its web store uses. It can't list an album's tracks, so each track is searched by its title, with the album's title and then with its artist, and the hits from the linked album are kept, each with its ISRC, disc and position. One search often brings up the whole album; when it doesn't, there is a search per track, a few at a time.
