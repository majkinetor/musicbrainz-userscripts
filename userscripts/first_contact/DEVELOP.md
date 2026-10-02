# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md); tests are in [`test/`](test/).

## Handoff

The handoff is on the release editor page for any script to read:

- `document.documentElement.dataset.firstContact` holds it as JSON.
- The `first-contact:seed` event on `document` carries the same JSON as its `detail`.
- A `first-contact:request` event on `document` sends it again.

It lists the release and every track with each artist's name, join phrase and platform link, in tracklist order. [Apollo Editor](../apollo_editor/README.md#artist-matching) reads it to match artists.

It travels in the script's storage under `fc.handoff.<token>`, the token in the editor URL's `first_contact` parameter. The editor tab copies it to its `sessionStorage` (so a reload still finds it) and deletes it from the storage. MusicBrainz's *Continue* confirmation page loads at the same URL first, so it is taken only once `#release-editor` is there. One that is never picked up is pruned after an hour.

## How each platform is read

| Platform      | Source                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Deezer        | Deezer's public API                                                                                                                 |
| Bandcamp      | the album page's own data (`data-tralbum` and the ld+json); nothing is fetched                                                      |
| Discogs       | Discogs's public API                                                                                                                |
| Apple Music   | Apple's catalogue API (`amp-api.music.apple.com`), with the bearer token in the web player's public JS, in the page's country store |
| Tidal         | the official catalogue API (`openapi.tidal.com/v2`) with an app token from the client-credentials grant; US store, then GB, DE      |
| Qobuz         | the store page's HTML (its API needs a login)                                                                                       |
| Beatport      | the release page's `__NEXT_DATA__`, as Harmony does                                                                                 |
| Spotify       | the web player's album query, plus `spclient`'s album metadata for the barcode                                                      |
| YouTube Music | the web player's API (`youtubei/v1`), anonymously                                                                                   |
| Volumo        | Volumo's API                                                                                                                        |
| HDtracks      | HDtracks's API                                                                                                                      |
| SoundCloud    | `api-v2.soundcloud.com`, with the web player's public client id                                                                     |
| Amazon Music  | the web player's API (`na.mesk.skill.music.a2z.com`), as a guest                                                                    |

### Spotify

First Contact listens to the web player's requests (fetch and XHR) for its token and headers, then asks the album query itself. When it started too late to hear the album query, it uses the query's known hash. The barcode is the `upc` external id from `spclient.wg.spotify.com/metadata/4/album/<gid>`, where the gid is the album's base62 id as hex, with the same headers.

### Amazon Music

`music.amazon.com/config.json` hands out a guest session (CSRF token, device and session id), sent as a JSON `headers` string in each request's body. `showCatalogAlbum` gives the album's template: `headerText` (title), `headerPrimaryText` and its link (artist), `headerTertiaryText` (*13 SONGS • … • MAY 17 2013*), `headerLabel` (type), `footer` (the ℗ line), and one row per track with its artist line (`secondaryText2`, linked to its first artist only) and length. Platform Check and ISRC Scout read Amazon Music the same way.

## Release type

The guess follows murdos's importers (`fnGuessReleaseType`), with the title's *EP* or *Single* also outranking a platform's plain *album*.

## The button's place

Positions are kept per platform in `fc.pos`, and which platforms scroll it with the page in `fc.scroll` (`{ platformName: true }`). The one-for-all `scrollWithPage` setting of older versions is moved there once: on for every platform the button had been moved on. A button in its corner keeps its distance from the window's right and bottom edges. With *Moved button scrolls with the page*, the spot is measured across from the horizontal centre of what scrolls and down from the top of its content, since the platforms centre their layout. Where the platform scrolls a panel instead of the window (Spotify, Apple Music), the scroller is the one under the window's centre; the button is `position: fixed`, follows its scroll and is clipped to it. On load it waits for the page to be quiet for 300 ms (1.5 s at most) and for that panel, then fades in.
