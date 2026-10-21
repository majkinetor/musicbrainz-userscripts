# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md); tests are in [`test/`](test/).

## Handoff

The handoff is on the release editor page for any script to read:

- `document.documentElement.dataset.firstContact` holds it as JSON.
- The `first-contact:seed` event on `document` carries the same JSON as its `detail`.
- A `first-contact:request` event on `document` sends it again.

It lists the release and every track with each artist's name, join phrase and platform link, in tracklist order. [Apollo Editor](../apollo_editor/README.md#artist-matching) reads it to match artists.

Apollo knows nothing about any platform: the handoff (`v: 2`) tells it what it needs. A new provider therefore needs no change in Apollo.

- `platform: { abbr, name, artistLinkType }` comes from the provider's own fields. `abbr` is the match badge (**DZ**), `name` is used in Apollo's log and edit notes, and `artistLinkType` is the artist link type Apollo seeds when it adds the link to an artist. Set `artistLinkType` only where MusicBrainz can't pick the type itself: it offers several types for Apple Music, Qobuz and Audiomack, and doesn't recognise Volumo or HDtracks.
- `urlForms` is set on a link MusicBrainz may store in other forms, and lists all of them, the link itself first. It comes from the provider's `urlForms(url)`. Apple Music artists are stored under any storefront and without the slug, Amazon Music artists under any of its domains, and Qobuz artists also as `open.qobuz.com`. A provider without `urlForms` sends none, and Apollo looks the link up as it is.

An older `v: 1` handoff has neither. Apollo still matches by the plain link, but shows a generic **link** badge and seeds no link type.

A handoff from [Mission Control's consolidation](../mission_control/DEVELOP.md#consolidation) (`mc: true`) also gives each artist its links on the other platforms read: `alt: [{ url, urlForms, platform: { abbr, name, artistLinkType } }]`. Its `url` is the source platform's link, or null when the source has none. Apollo tries the `alt` links when `url` matches no one, and badges a match with the alt's platform.

It travels in the script's storage under `fc.handoff.<token>`, the token in the editor URL's `first_contact` parameter. The editor tab copies it to its `sessionStorage` (so a reload still finds it) and deletes it from the storage. MusicBrainz's *Continue* confirmation page loads at the same URL first, so it is taken only once `#release-editor` is there. One that is never picked up is pruned after an hour.

## Consolidate

[#702](https://github.com/majkinetor/musicbrainz-userscripts/issues/702). The album is read and finished (`finishRelease`, the steps Import takes) and stored under `fc.handoff.cons.<token>` (pruned with the handoffs after an hour), then `https://<server>/release/add#mc=<token>` opens. There FC copies it to the tab's `sessionStorage` and publishes it for Mission Control, answers its `mc:read` and `fc:seed`; the events are in [Mission Control's DEVELOP.md](../mission_control/DEVELOP.md#consolidation).

On a release page (`/release/<mbid>`) First Contact runs as a reader only (`mbReader`, [#782](https://github.com/majkinetor/musicbrainz-userscripts/issues/782)), for Mission Control's [comparison with the platforms](../mission_control/DEVELOP.md#comparison-with-the-platforms): it answers `mc:discover` as provider `fc` (`capabilities: ['read']`) and `mc:read`, and does nothing else there.

`mc:read` reads an album page headless with the same provider code as an import. The readers that parse the album page (Bandcamp, Qobuz, Beatport, 7digital, Ototoy) get it fetched with `GM_xmlhttpRequest`, parsed, and marked with its origin (`doc.fcOrigin`, which `originOf(doc)` gives them in place of `location.origin`); The album page is fetched with the browser's cookies (a bot check's clearance). A page refused all the same (403, a *Just a moment…* or *Human Verification* page) ends the read, unless the reader can do without it (`withoutPage`: Beatport, and 7digital, whose `fromApi` finds the release and its tracks in the API's search by the words of the address and the release's id, [#747](https://github.com/majkinetor/musicbrainz-userscripts/issues/747)): it then gets an empty page marked `fcRefused`. Beatport fetches a release page it needs the same way, with the browser's cookies, since Cloudflare refuses a request without its clearance cookie (403, *Just a moment…*). When it refuses all the same, the release comes from Platform Check ([#745](https://github.com/majkinetor/musicbrainz-userscripts/issues/745)): `pc:beatport-release` `{ id, req }`, answered by `pc:beatport-release-result` `{ req, release, tracks }` (Beatport's API, `/catalog/releases/<id>/` and its `tracks/`, with PC's login) or `{ req, error }`. The API's objects are the page data's, so the reader takes them as `__NEXT_DATA__`. Spotify isn't read: its token comes from its web player.

## Already in MusicBrainz?

[#801](https://github.com/majkinetor/musicbrainz-userscripts/issues/801). `checkAlbum`, through the manager to the *MusicBrainz server* setting's ws/2, one request a second (`mbWs`, 503 asked again twice):

1. `/ws/2/url?resource=…&inc=release-rels`, every form of the album's links in one request (`albumLinks`): the read's `url` and `urls`, Harmony's form of the page, the page itself; Apple Music under every storefront, Amazon Music under every domain, Tidal with and without `/browse`.
2. With a barcode, `/ws/2/release?query=barcode:(…)` with and without leading zeros (12, 13, 14 digits).
3. `/ws/2/release?query=release:"<title>" AND artistname:"<first artist>"` (the title alone for Various Artists), kept when the title is 85% the same (`titleClose`).
4. `/ws/2/release/<id>?inc=media+url-rels` for up to six releases that are this album or have its link: their formats and track counts, and their links. A link that is the album's in another form (`linkKey`: the platform and its album id, a storefront, locale, `www` or slug aside) counts as found by link, and *Add link only* offers only the album's links the release lacks in any form.

`sameAlbum` is Mission Control's `ccSameRelease`: the barcode (leading zeros aside), the format in kind (`fmtKind`, a copy of `ccFmtKind`) and the track count, each where both give one. A release found by its title only must also have the album's track count. The light: `linked` (any release has a link), `barcode` (one that is this album has the barcode), `similar` (one that is this album), else `none`. A title-only hit that isn't this album is dropped. The results and the album read are kept per album for the page's life (`checks`); *On page load* reads 2 s after the button shows and the import takes that read. Consolidate and `mc:read` never check.

**Update this release** stores `{ v: 1, token, created, mbid, source, sourceName, platform, url, rel }` (the finished read, with `relWithForms`) under `fc.handoff.upd.<token>` (pruned with the handoffs) and opens `/release/<mbid>#fc-update=<token>`. There First Contact copies it to the tab's `sessionStorage`, deletes it from the storage, and publishes it as `document.documentElement.dataset.fcUpdate` and the `fc:update` event (again on `fc:update-request`); `{ token, error }` when it isn't stored. Mission Control's side is in [its DEVELOP.md](../mission_control/DEVELOP.md#an-update-from-first-contact).

**Add link only** opens `/release/<mbid>/edit?urls.N.url=…&urls.N.link_type=…&edit_note=…` with the read's links the release lacks.

## How each platform is read

| Platform | Source |
| --- | --- |
| Deezer | Deezer's public API |
| Bandcamp | the album page's own data (`data-tralbum` and the ld+json); the lengths an album not out yet hides (`duration` 0 on an `unreleased_track`) from the app API, `bandcamp.com/api/mobile/24/tralbum_details?band_id&tralbum_id&tralbum_type=a` |
| Discogs | Discogs's public API |
| Apple Music | Apple's catalogue API (`amp-api.music.apple.com`), with the bearer token in the web player's public JS, in the page's country store |
| Tidal | the official catalogue API (`openapi.tidal.com/v2`) with an app token from the client-credentials grant; US store, then GB, DE |
| Qobuz | the store page's HTML (its API needs a login) |
| Beatport | the release page's `__NEXT_DATA__`, as Harmony does |
| Spotify | the web player's album query, plus `spclient`'s album metadata for the barcode |
| YouTube Music | the web player's API (`youtubei/v1`), anonymously |
| Volumo | Volumo's API |
| HDtracks | HDtracks's API |
| SoundCloud | `api-v2.soundcloud.com`, with the web player's public client id |
| Amazon Music | the web player's API (`na.mesk.skill.music.a2z.com`), as a guest |
| Presto Music | the shop's product page HTML (behind Cloudflare, so only on the page): the tracklist's works (`.c-tracklist__work`), the barcode from the ld+json (`gtin13`), the format from the purchase block. Plus the streaming app's API (`ajax-www.prestomusic.com/api/app/6/{album,about,tracks}/<code>`: anonymous, open CORS, no bot check; code 54 for a product that doesn't stream), by the same product number: the ISRCs, matched to the page's tracks one for one, and whether to add the streaming link. A product without a tracklist reads its other formats (`a.c-product__variant`) from the API, else their pages with the page's cookies. On `streaming.prestomusic.com` everything is from the API; the barcode is the booklet PDF's file name (`0827568019622_W.pdf`), check digit checked, and the shop link is a work's `productLink` |

### Spotify

First Contact listens to the web player's requests (fetch and XHR) for its token and headers, then asks the album query itself. When it started too late to hear the album query, it uses the query's known hash. The barcode is the `upc` external id from `spclient.wg.spotify.com/metadata/4/album/<gid>`, where the gid is the album's base62 id as hex, with the same headers.

### Amazon Music

`music.amazon.com/config.json` hands out a guest session (CSRF token, device and session id), sent as a JSON `headers` string in each request's body. `showCatalogAlbum` gives the album's template: `headerText` (title), `headerPrimaryText` and its link (artist), `headerTertiaryText` (*13 SONGS • … • MAY 17 2013*), `headerLabel` (type), `footer` (the ℗ line), and one row per track with its artist line (`secondaryText2`, linked to its first artist only) and length. Platform Check and ISRC Scout read Amazon Music the same way.

## Release type

The guess follows murdos's importers (`fnGuessReleaseType`), with the title's *EP* or *Single* also outranking a platform's plain *album*.

## The button's place

Positions are kept per platform in `fc.pos`, and which platforms scroll it with the page in `fc.scroll` (`{ platformName: true }`). The one-for-all `scrollWithPage` setting of older versions is moved there once: on for every platform the button had been moved on. A button in its corner keeps its distance from the window's right and bottom edges. With *Moved button scrolls with the page*, the spot is measured across from the horizontal centre of what scrolls and down from the top of its content, since the platforms centre their layout. Where the platform scrolls a panel instead of the window (Spotify, Apple Music), the scroller is the one under the window's centre; the button is `position: fixed`, follows its scroll and is clipped to it. On load it waits for the page to be quiet for 300 ms (1.5 s at most) and for that panel, then fades in.

## Archive

The handoff carries the archive plan (`archive: { ts, keys, urls: [{ url, what: 'page' | 'api' }] }`, or `null` when archiving is off). The release editor's tab sends it, once per token: a `fc.archived.<token>` flag in its `sessionStorage` stops a reload from sending it again. The platform tab may close straight after the import, which would cut a request off.

- **Page URL**: `location.href` without the fragment and share/tracking parameters (`si`, `utm_*`, `fbclid`, `feature`, …), not the canonical `rel.url`. The canonical URL often redirects (Deezer's `/album/<id>` → `/<country>/album/<id>`), Wayback stores the snapshot under the target, and `/web/<ts>/<canonical>` then finds an older snapshot.
- **API URL**: a provider's `archiveApi(id)`. Deezer: `api.deezer.com/album/<id>`. Apple Music: `itunes.apple.com/lookup?id=<id>&entity=song&country=<cc>` (amp-api needs a bearer token Wayback can't send). Spotify, Tidal and YouTube Music have none: their APIs need a token, or POST.
- **Edit note**: no archive lines (#739).
- **Anonymous**: `GET https://web.archive.org/save/<url>`. It answers with a 302 to `/web/<ts>/<url>` once the capture is done (about 5–20 s); the manager follows it, and `finalUrl` is the snapshot. 429 is the per-IP rate limit.
- **With keys** (Save Page Now 2): `POST https://web.archive.org/save` with `Authorization: LOW <key>:<secret>`, `Accept: application/json`, form body `url`, `capture_screenshot=1`, `if_not_archived_within=30d`. It answers `{ url, job_id }`; `GET /save/status/<job_id>` (same header) is polled every 6 s for up to 3 minutes, for the log only.

URLs are sent one at a time. Every step is logged: the plan on the platform side, then each request, its status, the job and its result on the editor side.

The requests and the keys are the shared [`<ST-ARCHIVE>`](../../DEVELOP.md#shared-blocks) block, with Apollo Editor ([its use](../apollo_editor/DEVELOP.md#archive)). The keys are the GM value `mbu.archive` = `{ iaKey, iaSecret }`, not in `fc.settings`, where versions before #736 kept them: `settings()` moves them over once, and keys already in `mbu.archive` win. Inside String Theory the members share one GM store, so keys set in either script show in the other; standalone, each script keeps its own copy. Whether FC archives (`fc.settings.archive`) stays its own.
