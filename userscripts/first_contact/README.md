# First Contact <img src="icon.svg" align="left" width="48">

Import a release into MusicBrainz from the platform's album page with one click: the release editor opens with everything the platform knows filled in. Install one userscript instead of hudreeds. 

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/first_contact/first_contact.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/first_contact/first_contact.user.js)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=First+Contact)

> [!NOTE] First Contact doesn't match entities but hands data to [Apollo](../apollo_editor/README.md) which then proceedes to automatically match entities. NOTE that its best to have auto match enabled in Apollo options, otherwise, you might need to manually click a Match button at this moment.


## Features

- **[Import](#import)** a release from the album page into the MusicBrainz release editor.
- **[Platforms](#platforms)**: what is read from each one.
- **[Artist matching](#artist-matching)** is left to Apollo Editor, which gets every artist's platform link.

## Import

On a platform's album page, click **Import to MusicBrainz** in the bottom-right corner. A new tab opens with MusicBrainz's release editor, filled in:

| Field | From |
|---|---|
| Title, artist credit | the album, with any *feat.* artists split off the title into the credit. A compilation the platform credits to one of its artists becomes Various Artists + Compilation: when the credited artists are on fewer than half the tracks and the tracks have five or more artists |
| Type | the platform's album / EP / single / compilation, or a [guess](#release-type) when it doesn't say |
| Status, packaging | Official, None |
| Release event | the platform's release date, Worldwide |
| Label | the platform's label text; two labels written as one (*Crystal Method / Geffen*) become two. A slash without spaces (*AC/DC Records*) stays one name |
| Barcode | the platform's UPC |
| Script | Latin, when every title is in Latin letters; otherwise left for you |
| Tracklist | one Digital Media medium per disc, with titles, track artists and lengths |
| External link | the album page |
| Annotation | optional, off by default: the platform's notes, and where they come from (see [Settings](#settings)) |
| Edit note | the album page, and the script's name and version |

Artists are seeded by name only. Check everything, then submit as usual.

MusicBrainz first asks you to **Confirm form submission**, as for every import from another site. Click **Continue**.

While the album is read, the button counts the tracks: *Reading Deezer… 7/13*. If something fails, a message says why and offers **Copy log**.

> [!NOTE]
> The tab opens at once, while the platform is still being read, so the browser doesn't block it as a popup. The data reaches it a moment later.

### Release type

When the platform gives no type, or only a plain *album* while the title says otherwise, it is guessed, the most certain sign first:

| Sign | Type |
|---|---|
| *EP* or *E.P.* in the title | EP |
| the title ends in *Single*, or says *single* on up to 8 tracks and 50 minutes | Single |
| every track is the same song in another version (*Remix*, *Instrumental*, *Extended Mix*, *VIP*…) | Single |
| 7 tracks or more, or over 30 minutes | Album |
| up to 7 minutes | Single |
| 2 tracks or more, up to 30 minutes | EP |

Without every track's length: 1 track is a Single, 3 to 6 an EP, 7 or more an Album, and 2 are left for you. The log says which sign decided.

> [!NOTE]
> The rules are those of murdos's importers (`fnGuessReleaseType`), with the title's *EP* or *Single* also outranking a platform's plain *album*.

## Platforms

| Platform | Pages | Notes |
|---|---|---|
| Deezer | `deezer.com/…/album/<id>` | Featured artists come from the title's *feat.* clause: Deezer lists them as main artists. A trailing *(Original Mix)* is dropped from track titles. |
| Bandcamp | `<name>.bandcamp.com/album/<slug>` | Read from the page itself. A comma list of artists (*Future Funk Squad, Omega Sparx, Stu Brootal, The Crystal Method*) is split into separate artists, except the account's own name. On a label's page the label is filled in; on an artist's own page it is left empty. A compilation's *Artist - Title* track titles are split into artist and title. The album link gets both *purchase for download* and, when it streams, *stream for free*. Only the artist the page belongs to has a Bandcamp link to hand off. |
| Discogs | `discogs.com/release/<id>` | Read from Discogs's API. Format per medium (LP is 12" Vinyl), and sides A/B, C/D… become one medium each, numbered A1, B2…; *CD 1 …* style headings become medium titles. Status *Promotion* or *Bootleg* and the *Compilation* type come from the format's descriptions, packaging from its free text. Artists keep their credited name (*DJ Fresh* for *Fresh*) and lose Discogs's *(2)* numbering; *Featuring* track credits go after *feat.* Country when it is one country (not *UK, Europe & US*). A label listed twice with its catalog number written two ways is kept once; *Not On Label* becomes *[no label]*. Every artist and label carries its Discogs link for Apollo. |
| Apple Music | `music.apple.com/<country>/album/…` | Read from Apple's catalogue, in the page's country store. Every track has its ISRC; every artist its Apple link. *- Single* / *- EP* at the end of the title is the type, not part of the title. Music videos are left out. |
| Tidal | `tidal.com/album/<id>`, `tidal.com/browse/album/<id>`, `listen.tidal.com/album/<id>` | Read from Tidal's catalogue (US store, then GB, DE). Every track has its ISRC; every artist its Tidal link. The *feat.* Tidal puts in a track's version goes into the credit, any other version (*Radio Edit*) stays in the title. Tidal has no label field, so the label is read from its copyright line: *℗ 2020 Outpost Recordings* gives Outpost Recordings, *… under exclusive license to Columbia Records, a Division of …* gives Columbia Records. A line that doesn't read as one name leaves the label for you. |
| Qobuz | `qobuz.com/<country-lang>/album/<slug>/<id>` | Read from the store page itself. Qobuz's per-track artist is unreliable (it can name a band member), so an album by one artist credits its main artists on every track, with the title's *feat.*; a Various Artists album takes each track's artist. The type isn't given, so it is guessed. A page that lists only part of a long album says so in the log. |
| Beatport | `beatport.com/release/<slug>/<id>` | Read from the release page's own data, as Harmony does. Every track has its ISRC and Beatport link; every artist and the label their Beatport link. A mix name other than *Original Mix* goes into the track title: *Leg Pulling (Dub)*. Beatport credits every track artist to the release, so more than four of them make it Various Artists. Beatport's own type is mostly just *Release*, so the type is usually guessed. The link gets *purchase for download* and, when it streams, *streaming page*. |
| Spotify | `open.spotify.com/album/<id>` | Read with the web player's own album query. First Contact listens to the player's requests (fetch and XHR) for its token, and asks the album query itself. When it started too late to hear the album query, it uses the query's known id. If it heard nothing at all, the log says so; reload the page. Every artist has its Spotify link and every track its Spotify link. The date is as precise as Spotify has it. Spotify's player has no barcode or ISRCs. |
| YouTube Music | `music.youtube.com/browse/MPREb_…`, `music.youtube.com/playlist?list=OLAK5uy_…` | Read from the web player's own API. Every artist has its YouTube Music channel. Featured artists come from the title's *feat.*: YouTube Music lists them as main artists. The type (Album, EP, Single) is YouTube Music's; the date is the year only, and there is no label, barcode or ISRCs. The link is the album playlist. |
| Volumo | `volumo.com/album/<barcode>-<slug>`, `volumo.com/album/<id>` | Read from Volumo's API. Every track has its ISRC; every artist its Volumo link. Label and catalog number, barcode, release date. A mix name other than *Original Mix* goes into the track title. More than four release artists make it Various Artists. |
| HDtracks | `hdtracks.com/#/album/<id>` | Read from HDtracks's API. Every track has its ISRC; label, barcode and release date are filled in. HDtracks has no artist pages, so artists have no link to hand off. |
| SoundCloud | `soundcloud.com/<user>/sets/<slug>` | Read from SoundCloud's API, with the web player's public client id. A set the label distributed has each track's ISRC, the barcode and the label; the set's type (album, EP, single, compilation) is used. Only the uploading account has a SoundCloud link to hand off. |

More platforms follow, one at a time ([#650](https://github.com/majkinetor/musicbrainz-userscripts/issues/650)).

## Artist matching

First Contact doesn't pick MusicBrainz artists itself. It hands every credited artist's platform link (the release's and each track's) to [Apollo Editor](../apollo_editor/README.md#artist-matching) on the release editor page, and Apollo matches them.

> [!NOTE]
> The handoff is on the release editor page for any script to read: `document.documentElement.dataset.firstContact` holds it as JSON, the `first-contact:seed` event on `document` carries the same JSON as its `detail`, and a `first-contact:request` event on `document` sends it again. It lists the release and every track with each artist's name, join phrase and platform link, in tracklist order.

## Settings

The **⚙︎** button next to **Import to MusicBrainz**.

| Setting | Default | |
|---|---|---|
| MusicBrainz server | musicbrainz.org | where the release editor opens: musicbrainz.org, beta.musicbrainz.org or test.musicbrainz.org |
| Annotation from the platform's notes | off | the album's notes on the platform go into the annotation, followed by *From <platform>: <album page>*: Bandcamp's about and credits, Discogs's notes, Qobuz's and Apple's reviews, the description on Beatport, Volumo, HDtracks, SoundCloud and YouTube Music. Deezer, Tidal and Spotify have none. A review is the critic's text (Qobuz's and Apple's are usually AllMusic's): check you may copy it before you submit. |

<img src="./screenshots/button.png" width="420" />
