# First Contact <img src="icon.svg" align="left" width="48">

Import a release into MusicBrainz from the platform's album page with one click: the release editor opens with everything the platform knows filled in.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/first_contact/first_contact.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/first_contact/first_contact.user.js)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=First+Contact)

> [!NOTE]
> First Contact doesn't match entities: it hands them to [Apollo Editor](../apollo_editor/README.md#artist-matching), which does. Keep Apollo's *Auto-match on start: Label, Artist* on (the default), or click its **Match** button yourself.

> [!IMPORTANT]
> By default every album page you import is sent to the Internet Archive to be saved, so the edit note can link a snapshot of it. See [Archive](#archive); turn it off in [Settings](#settings).

## Features

- **[Import](#import)** a release from the album page into the MusicBrainz release editor.
- **[Platforms](#platforms)**: what is read from each one.
- **[Artist matching](#artist-matching)** is left to Apollo Editor, which gets every artist's platform link.
- **[Archive](#archive)**: the album page is saved on the Internet Archive, and the edit note links the snapshot.
- **[Moving the button](#moving-the-button)**: drag it anywhere; each platform remembers its place.
- **[Settings](#settings)**: the MusicBrainz server, an icon-only button, a settings button only on hover, the annotation, closing the page after the import, and archiving.

## Import

On a platform's album page, click **Import to MusicBrainz** in the bottom-right corner. A new tab opens with MusicBrainz's release editor, filled in:

| Field                | From                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title, artist credit | the album, with any *feat.* artists split off the title into the credit                                                                              |
| Type                 | the platform's album / EP / single / compilation, or a [guess](#release-type) when it doesn't say                                                    |
| Status, packaging    | Official, None                                                                                                                                       |
| Release event        | the platform's release date, Worldwide                                                                                                               |
| Label                | the platform's label text; two labels written as one (*Crystal Method / Geffen*) become two. A slash without spaces (*AC/DC Records*) stays one name |
| Barcode              | the platform's UPC                                                                                                                                   |
| Script               | Latin, when every title is in Latin letters; otherwise left for you                                                                                  |
| Tracklist            | one Digital Media medium per disc, with titles, track artists and lengths                                                                            |
| External link        | the album page                                                                                                                                       |
| Annotation           | the platform's [notes](#platforms), and where they come from; can be turned off per platform (see [Settings](#settings))                             |
| Edit note            | the album page, links to its [Internet Archive snapshots](#archive), and the script's name and version                                               |

A compilation the platform credits to one of its artists becomes Various Artists and a Compilation, when the credited artists are on fewer than half the tracks and the tracks have five or more artists.

### Release type

When the platform gives no type, or only a plain *album* while the title says otherwise, it is guessed, the most certain sign first:

| Sign                                                                                              | Type   |
| ------------------------------------------------------------------------------------------------- | ------ |
| *EP* or *E.P.* in the title                                                                       | EP     |
| the title ends in *Single*, or says *single* on up to 8 tracks and 50 minutes                     | Single |
| every track is the same song in another version (*Remix*, *Instrumental*, *Extended Mix*, *VIP*…) | Single |
| 7 tracks or more, or over 30 minutes                                                              | Album  |
| up to 7 minutes                                                                                   | Single |
| 2 tracks or more, up to 30 minutes                                                                | EP     |

Without every track's length: 1 track is a Single, 3 to 6 an EP, 7 or more an Album, and 2 are left for you. The log says which sign decided.

## Platforms

| Platform                        |   ISRCs    |  Barcode   | Label                 | Notes          |
| ------------------------------- | :--------: | :--------: | --------------------- | -------------- |
| [Deezer](#deezer)               |     ✓      |     ✓      | ✓                     |                |
| [Bandcamp](#bandcamp)           |            |     ✓      | on a label's page     | about, credits |
| [Discogs](#discogs)             |            |     ✓      | ✓ with catalog number | notes          |
| [Apple Music](#apple-music)     |     ✓      |     ✓      | ✓                     | review         |
| [Tidal](#tidal)                 |     ✓      |     ✓      | from the ℗ line       |                |
| [Qobuz](#qobuz)                 |            |     ✓      | ✓                     | review         |
| [Beatport](#beatport)           |     ✓      |     ✓      | ✓ with catalog number | description    |
| [Spotify](#spotify)             |            |     ✓      | ✓                     |                |
| [YouTube Music](#youtube-music) |            |            |                       | description    |
| [Volumo](#volumo)               |     ✓      |     ✓      | ✓ with catalog number | description    |
| [HDtracks](#hdtracks)           |     ✓      |     ✓      | ✓                     | description    |
| [SoundCloud](#soundcloud)       | label sets | label sets | ✓                     | description    |
| [Amazon Music](#amazon-music)   |            |            | from the ℗ line       | ℗ line         |
| [Audiomack](#audiomack)         |     ✓      |     ✓      | from the ℗ line       | description    |

### Deezer

Pages: `deezer.com/…/album/<id>`

Featured artists come from the title's *feat.* clause: Deezer lists them as main artists. A trailing *(Original Mix)* is dropped from track titles.

### Bandcamp

Pages: `<name>.bandcamp.com/album/<slug>`

- A comma list of artists (*Future Funk Squad, Omega Sparx, Stu Brootal, The Crystal Method*) is split into separate artists, except the account's own name.
- On a label's page the label is filled in; on an artist's own page it is left empty.
- A compilation's *Artist - Title* track titles are split into artist and title.
- The album link gets both *purchase for download* and, when it streams, *stream for free*.
- Only the artist the page belongs to has a Bandcamp link to hand off.

### Discogs

Pages: `discogs.com/release/<id>`

- Format per medium (LP is 12" Vinyl), and sides A/B, C/D… become one medium each, numbered A1, B2…; *CD 1 …* style headings become medium titles.
- Status *Promotion* or *Bootleg* and the *Compilation* type come from the format's descriptions, packaging from its free text.
- Artists keep their credited name (*DJ Fresh* for *Fresh*) and lose Discogs's *(2)* numbering; *Featuring* track credits go after *feat.*
- Country when it is one country (not *UK, Europe & US*).
- A label listed twice with its catalog number written two ways is kept once; *Not On Label* becomes *[no label]*.
- Every artist and label carries its Discogs link for Apollo.

### Apple Music

Pages: `music.apple.com/<country>/album/…`

- Read from the page's country store.
- Every track has its ISRC; every artist its Apple link.
- *- Single* / *- EP* at the end of the title is the type, not part of the title.
- Music videos are left out.

### Tidal

Pages: `tidal.com/album/<id>`, `tidal.com/browse/album/<id>`, `listen.tidal.com/album/<id>`

- Read from the US store, else the British or German one.
- Every track has its ISRC; every artist its Tidal link.
- The *feat.* Tidal puts in a track's version goes into the credit, any other version (*Radio Edit*) stays in the title.
- Tidal has no label field, so the label is read from its copyright line: *℗ 2020 Outpost Recordings* gives Outpost Recordings, *… under exclusive license to Columbia Records, a Division of …* gives Columbia Records. A line that doesn't read as one name leaves the label for you.

### Qobuz

Pages: `qobuz.com/<country-lang>/album/<slug>/<id>`

- Qobuz's per-track artist is unreliable (it can name a band member), so an album by one artist credits its main artists on every track, with the title's *feat.*; a Various Artists album takes each track's artist.
- The type isn't given, so it is guessed.
- A page that lists only part of a long album says so in the log.

### Beatport

Pages: `beatport.com/release/<slug>/<id>`

- Every track has its ISRC and Beatport link; every artist and the label their Beatport link.
- A mix name other than *Original Mix* goes into the track title: *Leg Pulling (Dub)*.
- Beatport credits every track artist to the release, so more than four of them make it Various Artists.
- Beatport's own type is mostly just *Release*, so the type is usually guessed.
- The link gets *purchase for download* and, when it streams, *streaming page*.

### Spotify

Pages: `open.spotify.com/album/<id>`

- If the log says nothing was heard from the player, reload the page.
- Every artist and every track has its Spotify link.
- The date is as precise as Spotify has it.

### YouTube Music

Pages: `music.youtube.com/browse/MPREb_…`, `music.youtube.com/playlist?list=OLAK5uy_…`

- Every artist has its YouTube Music channel.
- Featured artists come from the title's *feat.*: YouTube Music lists them as main artists.
- The type (Album, EP, Single) is YouTube Music's; the date is the year only.
- The link is the album playlist.

### Volumo

Pages: `volumo.com/album/<barcode>-<slug>`, `volumo.com/album/<id>`

- Every track has its ISRC; every artist its Volumo link.
- A mix name other than *Original Mix* goes into the track title.
- More than four release artists make it Various Artists.

### HDtracks

Pages: `hdtracks.com/#/album/<id>`

- HDtracks has no artist pages, so artists have no link to hand off.

### SoundCloud

Pages: `soundcloud.com/<user>/sets/<slug>`

- A set the label distributed (a *label set* above) has each track's ISRC and the barcode; the set's type (album, EP, single, compilation) is used.
- Only the uploading account has a SoundCloud link to hand off.

### Amazon Music

Pages: `music.amazon.com/albums/<id>`, and the other countries' `music.amazon.*`

- No Amazon account is needed. The catalogue read is amazon.com's (US).
- The tracklist is one medium: Amazon Music doesn't mark discs, so split them in the editor.
- A track's artists come from its artist line (*A, B & C*), and only the first has an Amazon Music link; an *&* inside one name (*Simon & Garfunkel*) stays one artist.
- The date is the one the album page shows, which for a reissue can be the original's.
- The label is read from the ℗ line, as for [Tidal](#tidal); the whole line also goes to the annotation (see [Settings](#settings)), since it may or may not name the label.

### Audiomack

Pages: `audiomack.com/<artist>/album/<slug>`, `audiomack.com/<artist>/song/<slug>`

- No Audiomack account is needed.
- A song page is imported as a one-track single.
- A track's artists come from its artist line (*A, B & C*), and the featured ones from its title or Audiomack's *featuring*. Only the uploading account has an Audiomack link to hand off.
- The tracklist is one medium.

## Artist matching

First Contact doesn't pick MusicBrainz artists itself. It hands every credited artist's platform link (the release's and each track's) to [Apollo Editor](../apollo_editor/README.md#artist-matching) on the release editor page, and Apollo matches them. Other scripts can read the same [handoff](#handoff).

Apollo links an artist only when the evidence is strong, trying the most certain source first:

1. **Platform link.** The MusicBrainz artist already links the artist's page on the platform you imported from (or the release's Discogs artist). This is the most reliable match, and why First Contact passes the links on.
2. **Other releases.** The same track on another release of the release group, or at the same position on its other editions, credits this artist.
3. **Unique name.** Exactly one MusicBrainz artist has the credited name as its name or alias, or exactly one artist of that name is usually credited next to an artist already on this release.

Anything less certain is left unlinked and offered as a candidate for you to confirm. A badge on each artist shows which stage linked it. When the artist exists but lacks the platform link, Apollo offers to add it, so the next import of that artist matches at once; when it doesn't exist, Apollo offers to create it with the link.

## Archive

On every import, First Contact asks the Internet Archive's Wayback Machine to save the album page, so anyone can later check what the platform showed, even after the page changes or is gone. The edit note links the snapshot:

```text
Imported from Deezer: https://www.deezer.com/album/6575789
Archived page: https://web.archive.org/web/20261002121804/https://www.deezer.com/en/album/6575789
Archived API data: https://web.archive.org/web/20261002121804/https://api.deezer.com/album/6575789
```

- The save starts once the release editor opens and runs in its tab, so the import never waits for it. It takes from a few seconds to a minute; the [log](#settings) says when it's done or why it failed.
- The link carries the time of the import, and the Wayback Machine opens the snapshot nearest to it, which is the one just made.
- Deezer and Apple Music build their pages in the browser, so a saved page shows little. For these, the album data First Contact read is saved too, and linked as *Archived API data*.
- Spotify, Tidal and YouTube Music also build their pages in the browser, and their data can't be saved. For these, add your archive.org keys: the save then also takes a screenshot of the page, and the edit note links it as *Archived screenshot*.

### archive.org keys

Without keys the save is anonymous. The Internet Archive limits how many anonymous saves one connection may make, so after many imports in a row some are refused (the log says so). With your own keys:

- the limit is much higher;
- each save also takes a screenshot of the page;
- a page saved in the last 30 days isn't saved again.

To get them, make a free account on [archive.org](https://archive.org), log in, and open [archive.org/account/s3.php](https://archive.org/account/s3.php). Copy the *access key* and the *secret* into **⚙︎ → archive.org keys**.

> [!NOTE]
> Archiving sends the address of every album you import to archive.org, and with keys, under your account. Turn **Archive the album page on the Internet Archive** off in [Settings](#settings) if you don't want that.

## Moving the button

Drag **Import to MusicBrainz** (or its **⚙︎**) to wherever it is out of the way. Each platform remembers its own place. **⚙︎ → Reset:** **this one** puts it back in the bottom-right corner on that platform and stops it scrolling with the page; **all** does so on every platform.

By default the button stays put on the screen. With **Moved button scrolls with the page on** *platform* on (see [Settings](#settings)), a moved button stays on its spot on that platform's page instead, above the cover, say, and scrolls with it. Each platform has its own, so the button can scroll with the page on Bandcamp and stay on the screen on Spotify:

## Settings

The **⚙︎** button next to **Import to MusicBrainz** opens them, in three sections.

### Import

| Setting | Default |  |
| --- | --- | --- |
| MusicBrainz server | musicbrainz.org | where the release editor opens: musicbrainz.org, beta.musicbrainz.org or test.musicbrainz.org |
| Annotation from *platform*'s notes | on | on this platform only, the album's [notes on the platform](#platforms) go into the annotation, followed by *From <platform>: <album page>*. A review is the critic's text (Qobuz's and Apple's are usually AllMusic's): check you may copy it before you submit. |
| Close this page after the import | off | the platform's tab closes once the release editor has the release; it stays open when the import fails |

### Archive

| Setting                                        | Default |                                                                                                                               |
| ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Archive the album page on the Internet Archive | on      | each import saves the album page on the Internet Archive and links the snapshot in the edit note; see [Archive](#archive)     |
| archive.org keys                               | none    | your archive.org access key and secret: higher limits and a screenshot of each page; see [archive.org keys](#archiveorg-keys) |

### Button

| Setting                                          | Default |                                                                                                                                                                          |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Icon only                                        | off     | the button shows only its icon; the tooltip still says *Import to MusicBrainz*, and the progress still shows while it reads the platform                                 |
| Settings button only on hover                    | off     | the **⚙︎** button shows only once the pointer has rested on **Import to MusicBrainz** for a second, as a small tab on its edge, so a click to import doesn't bring it up |
| Moved button scrolls with the page on *platform* | off     | on this platform only, a [moved](#moving-the-button) button stays on its spot on the page and scrolls with it                                                            |
| Position: Reset                                  |         | **this one** puts the button back in the bottom-right corner on this platform, **all** on every platform; see [Moving the button](#moving-the-button)                    |

## Notes

### Handoff

Other scripts on the release editor page can read what First Contact sent: the release and every track with each artist's name and platform link. [DEVELOP.md](DEVELOP.md#handoff) says how, and how each platform is read.

### Archiving requests

[DEVELOP.md](DEVELOP.md#archive) lists the requests sent to the Internet Archive, with and without keys.
