# First Contact <img src="icon.svg" align="left" width="48">

Import a release into MusicBrainz from the platform's album page with one click: the release editor opens with everything the platform knows filled in.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/first_contact/first_contact.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/first_contact/first_contact.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=First+Contact)

> [!IMPORTANT]
> By default every album page you import is sent to the Internet Archive to be saved, so anyone can later check what it showed. See [Archive](#archive); turn it off in [Settings](#settings).

## Features

- **[Import](#import)** a release from the album page into the MusicBrainz release editor.
- **[Already in MusicBrainz?](#already-in-musicbrainz)**: before the editor opens, the album is looked up in MusicBrainz, so one it has gets its missing parts instead of a second copy.
- **[Consolidate](#consolidate)**: compare the album with the other platforms in Mission Control, and take the best of each.
- **[Send to Harmony](#send-to-harmony)**: look the album up on Harmony instead, with every platform that has its barcode.
- **[Platforms](#platforms)**: what is read from each one.
- **[Artist matching](#artist-matching)** is left to Apollo Editor, which gets every artist's platform link.
- **[Archive](#archive)**: the album page is saved on the Internet Archive.
- **[Moving the button](#moving-the-button)**: drag it anywhere; each platform remembers its place.

## Import

On a platform's album page, click **Import to MusicBrainz**: once the release is read, the release editor opens in a new tab, filled in:

| Field                | From                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Title, artist credit | the album, with any _feat._ artists split off the title into the credit                           |
| Type                 | the platform's album / EP / single / compilation, or a [guess](#release-type) when it doesn't say |
| Status, packaging    | Official, None                                                                                    |
| Release event        | the platform's release date and country; usually Worldwide                                        |
| Label                | the platform's label; _A / B_ becomes two labels, _AC/DC Records_ stays one                       |
| Barcode              | the platform's UPC                                                                                |
| Script               | Latin, when every title is in Latin letters; otherwise left for you                               |
| Tracklist            | one Digital Media medium per disc, with titles, track artists and lengths                         |
| External link        | the album page                                                                                    |
| Annotation           | the platform's [notes](#platforms), with their source; off per platform in [Settings](#settings)  |
| Edit note            | the album page, the script and its version                                                        |

A compilation the platform credits to one of its artists becomes Various Artists and a Compilation, when the credited artists are on fewer than half the tracks and the tracks have five or more artists.

DistroKid and its numbered _Records DK_ placeholders are omitted when a label is listed; otherwise they become MusicBrainz's [no label](https://musicbrainz.org/label/157afde4-4bf5-4039-8ad2-5a15acc85176).

### Release type

When the platform gives no type, or only a plain _album_ while the title says otherwise, it is guessed, the most certain sign first:

| Sign                                                                          | Type   |
| ----------------------------------------------------------------------------- | ------ |
| _EP_ or _E.P._ in the title                                                   | EP     |
| the title ends in _Single_, or says _single_ on up to 8 tracks and 50 minutes | Single |
| every track is one song in other versions (_Remix_, _Instrumental_, _VIP_…)   | Single |
| 7 tracks or more, or over 30 minutes                                          | Album  |
| up to 7 minutes                                                               | Single |
| 2 tracks or more, up to 30 minutes                                            | EP     |

Without every track's length: 1 track is a Single, 3 to 6 an EP, 7 or more an Album, and 2 are left for you. The log says which sign decided.

## Already in MusicBrainz?

Before the release editor opens, First Contact looks the album up in MusicBrainz. A light on **Import to MusicBrainz** says what it found:

| Light         | MusicBrainz has                                                 |
| ------------- | --------------------------------------------------------------- |
| green         | a release with this album's link                                |
| yellow        | a release with its barcode                                      |
| orange        | a release with a similar title, the same artist and track count |
| empty circle  | none of these                                                   |
| dashed circle | the check failed; the import goes on without it                 |

A release counts as this album unless its barcode, format (digital, CD, vinyl…) or track count differs. Other editions are listed too, greyed. Icons under each release say what agrees with the album, marked ✓ (the link, barcode, title, track count, format and date), and what differs, marked ≠ in amber; hover one to compare the two.

When MusicBrainz may have the album, a panel lists those releases before the editor opens. For each:

- **Update this release** opens it with [Mission Control](../mission_control/README.md), which compares it with the platforms, this album included, and offers what it lacks: the barcode, labels and catalog numbers, release event, track lengths, ISRCs and links.
- **Add link only** opens its edit page with this album's links and an edit note. It shows only when the release lacks a link.

**Import anyway** opens the release editor as usual. Mission Control adds links only for the platforms Platform Check knows: for Presto Music, Ototoy, mora, Melon and Bugs, use **Add link only**.

The _Check MusicBrainz_ [setting](#settings) says when the album is looked up:

| Check MusicBrainz |                                                                          |
| ----------------- | ------------------------------------------------------------------------ |
| On import         | when you click **Import to MusicBrainz**                                 |
| On page load      | as the page opens, so the light shows at once; the import uses that read |
| Off               | never                                                                    |

## Consolidate

The button with [Mission Control](../mission_control/README.md)'s icon opens the release editor with Mission Control over it, which finds the album on the other platforms so you can take the best title, date, label, tracklist and ISRCs of all of them ([Consolidate a new release](../mission_control/README.md#consolidate-a-new-release)).

It needs Mission Control and Platform Check, both in [String Theory](../string_theory/README.md). Presto Music has no Consolidate button: Mission Control doesn't compare it.

First Contact reads the platforms for Mission Control on a release MusicBrainz already has too, when Mission Control [compares it with the platforms](../mission_control/README.md#compare-with-the-platforms).

## Send to Harmony

The button with [Harmony](https://harmony.pulsewidth.org.uk/)'s icon opens the album in Harmony's lookup instead, which finds it by barcode on the platforms ticked in [Harmony's settings](https://harmony.pulsewidth.org.uk/settings); [Falcon](../falcon/README.md) works there as usual. Open those settings once: until then Harmony looks an album link up only on its own platform, and a barcode nowhere.

The _Harmony_ setting picks which Harmony opens: [harmony.pulsewidth.org.uk](https://harmony.pulsewidth.org.uk/) or [harmony.mybrainz.dev](https://harmony.mybrainz.dev/). Each keeps its own settings.

| Platform                                                                                                     | Sent                                |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Deezer, Bandcamp, Discogs, Apple Music, Tidal, Qobuz, Beatport, Spotify, Ototoy, mora, Melon, Bugs, AllMusic | the album link, at once             |
| Volumo, HDtracks, SoundCloud, Audiomack, 7digital, Presto Music                                              | the barcode, once the album is read |
| YouTube Music, Amazon Music, RateYourMusic, Album of the Year                                                | nothing; the button is greyed out   |

Harmony can't read the last two rows' platforms, so for the middle row First Contact sends the barcode; an album without one (a SoundCloud set that isn't a label's) sends nothing. YouTube Music and Amazon Music show no barcode.

## Platforms

| Platform                                |      ISRCs      |  Barcode   | Label                           | Notes                      |
| --------------------------------------- | :-------------: | :--------: | ------------------------------- | -------------------------- |
| [Deezer](#deezer)                       |        ✓        |     ✓      | ✓                               |                            |
| [Bandcamp](#bandcamp)                   |                 |     ✓      | on a label's page               | about, credits             |
| [Discogs](#discogs)                     |                 |     ✓      | ✓ with catalog number           | notes                      |
| [Apple Music](#apple-music)             |        ✓        |     ✓      | ✓                               | review                     |
| [Tidal](#tidal)                         |        ✓        |     ✓      | from the ℗ line                 |                            |
| [Qobuz](#qobuz)                         |                 |     ✓      | ✓                               | review                     |
| [Beatport](#beatport)                   |        ✓        |     ✓      | ✓ with catalog number           | description                |
| [Spotify](#spotify)                     |                 |     ✓      | ✓                               |                            |
| [YouTube Music](#youtube-music)         |                 |            |                                 | description                |
| [Volumo](#volumo)                       |        ✓        |     ✓      | ✓ with catalog number           | description                |
| [HDtracks](#hdtracks)                   |        ✓        |     ✓      | ✓                               | description                |
| [SoundCloud](#soundcloud)               |   label sets    | label sets | ✓                               | description, ℗ and © lines |
| [Amazon Music](#amazon-music)           |                 |            | from the ℗ line                 | ℗ line                     |
| [Audiomack](#audiomack)                 |        ✓        |     ✓      | from the ℗ line                 | description                |
| [7digital](#7digital)                   |        ✓        |     ✓      | ✓                               | ℗ and © lines              |
| [Ototoy](#ototoy)                       |                 |            | ✓                               | album info                 |
| [mora](#mora)                           |                 |    some    | ✓                               |                            |
| [Melon](#melon)                         |                 |            | ✓                               |                            |
| [Bugs](#bugs)                           |                 |            | ✓                               |                            |
| [AllMusic](#allmusic)                   |        ✓        |     ✓      | ✓ with catalog number           |                            |
| [Presto Music](#presto-music)           | streamed albums |     ✓      | ✓ with catalog number           | about                      |
| [RateYourMusic](#rateyourmusic)         |                 |            | an issue's, with catalog number |                            |
| [Album of the Year](#album-of-the-year) |                 |            | ✓                               |                            |

### Deezer

Pages: `deezer.com/…/album/<id>`

Featured artists come from the title's _feat._ clause: Deezer lists them as main artists. A trailing _(Original Mix)_ is dropped from track titles.

### Bandcamp

Pages: `<name>.bandcamp.com/album/<slug>` or `/track/<slug>`

- A comma list of artists (_Future Funk Squad, Omega Sparx, Stu Brootal, The Crystal Method_) is split into separate artists, except the account's own name.
- A standalone track is imported as a one-track release. A track that belongs to an album is refused; import the album instead.
- On a label's page the label is filled in; on an artist's own page it is left empty.
- A compilation's _Artist - Title_ track titles are split into artist and title.
- The album link gets both _purchase for download_ and, when it streams, _stream for free_.
- A Creative Commons album (_some rights reserved_) gets its licence link as the release's _license_.
- Only the artist the page belongs to has a Bandcamp link to hand off.
- An album that isn't out yet hides its unreleased tracks' lengths; First Contact takes them anyway, with a warning and a line in the edit note, as they can still change.

### Discogs

Pages: `discogs.com/release/<id>`

- Format per medium (LP is 12" Vinyl), and sides A/B, C/D… become one medium each, numbered A1, B2…; _CD 1 …_ style headings become medium titles.
- A work listed over its movements becomes one track per movement, _Concerto…, RV 531: I. Allegro_, when each movement has its own track number; movements that share one (_3a_, _3b_) stay one track, _Concerto…: I. Allegro / II. Largo_.
- Status _Promotion_ or _Bootleg_ and the _Compilation_ type come from the format's descriptions, packaging from its free text.
- Artists keep their credited name (_DJ Fresh_ for _Fresh_) and lose Discogs's _(2)_ numbering; _Featuring_ track credits go after _feat._
- Digital releases get Worldwide by default; otherwise the country when it is one country (not _UK, Europe & US_).
- A label listed twice with its catalog number written two ways is kept once; _Not On Label_ becomes _[no label]_.
- Every artist and label carries its Discogs link for Apollo.

### Apple Music

Pages: `music.apple.com/<country>/album/…`

- Read from the page's country store.
- Every track has its ISRC; every artist its Apple link.
- _- Single_ / _- EP_ at the end of the title is the type, not part of the title.
- Music videos are left out.
- The link gets _streaming page_ and, when the iTunes Store sells the album, _purchase for download_.
- An album can list tracks Apple doesn't offer, so 1.8 is followed by 1.10. First Contact names them and asks first; _Import anyway_ adds each as an empty track at its position, for you to title or remove, and the edit note lists them.

### Tidal

Pages: `tidal.com/album/<id>`, `tidal.com/browse/album/<id>`, `listen.tidal.com/album/<id>`

- Read from the US store, else the British or German one.
- Every track has its ISRC; every artist its Tidal link.
- The _feat._ Tidal puts in a track's version goes into the credit, any other version (_Radio Edit_) stays in the title.
- Tidal has no label field, so the label is read from its copyright line: _℗ 2020 Outpost Recordings_ gives Outpost Recordings, _… under exclusive license to Columbia Records, a Division of …_ gives Columbia Records. A line that doesn't read as one name leaves the label for you.

### Qobuz

Pages: `qobuz.com/<country-lang>/album/<slug>/<id>`

- Qobuz's per-track artist is unreliable (it can name a band member), so an album by one artist credits its main artists on every track, with the title's _feat._; a Various Artists album takes each track's artist.
- The type isn't given, so it is guessed.
- A page that lists only part of a long album says so in the log.

### Beatport

Pages: `beatport.com/release/<slug>/<id>`

- Every track has its ISRC and Beatport link; every artist and the label their Beatport link.
- A mix name other than _Original Mix_ goes into the track title: _Leg Pulling (Dub)_.
- Beatport credits every track artist to the release, so more than four of them make it Various Artists.
- Beatport's own type is mostly just _Release_, so the type is usually guessed.
- The link gets _purchase for download_ and, when it streams, _streaming page_.
- When [Mission Control](../mission_control/README.md#consolidate-a-new-release) compares a Beatport album it isn't open on, Beatport's bot check can refuse the page. It is then read through [Platform Check](../platform_check/README.md)'s Beatport login; without one, open any Beatport page in this browser first.

### Spotify

Pages: `open.spotify.com/album/<id>`

- If the log says nothing was heard from the player, reload the page.
- Every artist and every track has its Spotify link.
- The date is as precise as Spotify has it.

### YouTube Music

Pages: `music.youtube.com/browse/MPREb_…`, `music.youtube.com/playlist?list=OLAK5uy_…`

- Every artist has its YouTube Music channel.
- Featured artists come from the title's _feat._: YouTube Music lists them as main artists.
- The type (Album, EP, Single) is YouTube Music's; the date is the year only.
- The link is the album playlist.

### Volumo

Pages: `volumo.com/album/<barcode>-<slug>`, `volumo.com/album/<id>`

- Every track has its ISRC; every artist its Volumo link.
- A mix name other than _Original Mix_ goes into the track title.
- More than four release artists make it Various Artists.

### HDtracks

Pages: `hdtracks.com/#/album/<id>`

- HDtracks has no artist pages, so artists have no link to hand off.

### SoundCloud

Pages: `soundcloud.com/<user>/sets/<slug>`

- A set the label distributed (a _label set_ above) has each track's ISRC and the barcode; the set's type (album, EP, single, compilation) is used.
- The label is the set's; a set without one takes the label its tracks name.
- Only the uploading account has a SoundCloud link to hand off.

### Amazon Music

Pages: `music.amazon.com/albums/<id>`, and the other countries' `music.amazon.*`

- No Amazon account is needed. The catalogue read is amazon.com's (US).
- The tracklist is one medium: Amazon Music doesn't mark discs, so split them in the editor.
- A track's artists come from its artist line (_A, B & C_), and only the first has an Amazon Music link; an _&_ inside one name (_Simon & Garfunkel_) stays one artist.
- The date is the one the album page shows, which for a reissue can be the original's.
- The label is read from the ℗ line, as for [Tidal](#tidal); the whole line also goes to the annotation (see [Settings](#settings)), since it may or may not name the label.

### Audiomack

Pages: `audiomack.com/<artist>/album/<slug>`, `audiomack.com/<artist>/song/<slug>`

- No Audiomack account is needed.
- A song page is imported as a one-track single.
- A track's artists come from its artist line (_A, B & C_), and the featured ones from its title or Audiomack's _featuring_. Only the uploading account has an Audiomack link to hand off.
- The tracklist is one medium.

### 7digital

Pages: `<store>.7digital.com/artist/<artist>/release/<slug>`

- No 7digital account is needed. If the page asks you to prove you're human, do it first, then import.
- The barcode, type, date, discs and ISRCs come from 7digital's catalogue, which can't list an album's tracks: each track is searched for, a few at a time.
- A track's artists come from its artist line (_A, B & C_, _A x B_, _A feat. B_). The release artist has a 7digital link to hand off, and so does a track artist who is the whole line.
- When [Mission Control](../mission_control/README.md#consolidate-a-new-release) compares a 7digital album and the page asks to verify you're human, the album is read from 7digital's catalogue search instead: the same data, without the page's ℗ and © lines.

### Ototoy

Pages: `ototoy.jp/_/default/p/<id>`

- No Ototoy account is needed.
- Ototoy shows no barcode, ISRCs or type, so the type is guessed and the country is Japan.
- The date is the original release date when the page has one.
- A track's artists are all the artists Ototoy links for it, and the featured ones come from its title's _(feat. …)_. On some compilations those links include the arranger or the label, so check the track artists there.
- The hi-res and CD-quality editions are separate pages; the format some titles carry (_Disc2(24bit/44.1kHz)_) is left out of the title.
- The catalog number isn't filled in: Ototoy often shows the CD's or a distributor's code instead.

### mora

Pages: `mora.jp/package/<label>/<id>/`

- No mora account is needed.
- mora shows no ISRCs or type, so the type is guessed and the country is Japan. The barcode is filled in only when mora's product code is one; otherwise that code goes in as the catalog number, so check it.
- The tracklist is one medium: mora doesn't mark discs, so split them in the editor.
- Every artist has their mora link.

### Melon

Pages: `melon.com/album/detail.htm?albumId=<id>`

- No Melon account is needed.
- Melon shows no ISRCs or barcode. The type comes from Melon's album type (정규, 싱글, EP, OST…), and the country is South Korea.
- The label is the album's planning company (기획사), not its distributor.
- Every artist and every track has its Melon link.

### Bugs

Pages: `music.bugs.co.kr/album/<id>`

- No Bugs account is needed.
- Bugs shows no ISRCs or barcode. The type comes from Bugs' album type (정규, 싱글, EP, OST…), and the country is South Korea.
- The label is the album's planning company (기획사), or its distributor (유통사) when there is none.
- Each track's length is a request to Bugs, so a long album takes a moment.
- Every artist and every track has its Bugs link.

### AllMusic

Pages: `www.allmusic.com/album/release/<slug>-mr<id>`

- The data comes from TiVo's music API, which AllMusic is built on. A first call can take 20 seconds, and when the API is down the import stops with an error.
- The type is Compilation or Live when AllMusic flags it so; the country is left empty.
- Every artist has its AllMusic link.

### RateYourMusic

Pages: `rateyourmusic.com/release/<type>/<artist>/<album>/`

- RYM is behind a browser check, so First Contact reads the page you have open and never fetches it; it stays out of Mission Control.
- An album's main page is all its issues together: it gives the title, artists, type, date and tracklist, but no label. An issue's page also gives its label and catalog number.
- No link is added: MusicBrainz takes these sites only on release groups and artists (the edit note names the page). No barcode, no ISRCs, no country.

### Album of the Year

Pages: `www.albumoftheyear.org/album/<id>-<slug>.php`

- Like RYM, it's behind a browser check: the open page is read, never fetched, and it stays out of Mission Control.
- Title, artists, date, label and the tracklist (with lengths when AOTY has them); the type comes from AOTY's format (LP, EP, Single, Compilation, Mixtape, Live, Remix, Soundtrack).
- No link is added: MusicBrainz takes these sites only on release groups and artists (the edit note names the page). No barcode, no catalog number, no ISRCs.

### Presto Music

Pages: `prestomusic.com/classical/products/<id>`, `prestomusic.com/jazz/products/<id>`, `streaming.prestomusic.com/album/<id>`

- No Presto account is needed.
- The shop and the streaming app share their product numbers, so an album imports the same from either. ISRCs come from the streaming app, so only an album that streams has them.
- From the streaming app the release is _Digital Media_, with the streaming link and the shop link. Its barcode comes from the booklet, so an album without a booklet has none.
- From the shop, a download also gets the streaming link, when the album streams. A CD, SACD or vinyl doesn't: on MusicBrainz the download is a separate release.
- Presto sells CDs, SACDs, vinyl and downloads, so the medium's format is the one on the page: _CD_, _Hybrid SACD_, _Vinyl_, or _Digital Media_ for a download. A physical one gets the _purchase for mail-order_ link and no packaging; the country is left for you.
- A set of several discs (_5 CDs_) comes as one medium: Presto doesn't say where each disc starts. A message says so; split it at each disc's first track with Apollo Editor's [Split medium](../apollo_editor/README.md#merge-and-split-mediums).
- A classical work's movements are its tracks, titled _Work: Movement_; a work without movements is one track. The composer Presto puts before a title (_Beethoven: …_, _Ida Sand: Salt & Sugar_) is left out.
- Track artists are the names Presto lists for each work without an instrument or role. The musicians listed with one (_Ida Sand (piano)_, _Ola Gustafsson (guitar)_) are left out; when every name has one, as on most classical pages (_Chiaroscuro Quartet (stringquartet)_), all of them are the artists. Artists have no Presto link to hand off.
- Some lengths are missing; those tracks get none.
- When the shop page lists no tracks (a new vinyl, say), the tracklist is taken from another format of the same album, the CD first. A message and the edit note say where it came from: check it, as the vinyl can differ. When no format lists tracks, nothing is imported.

## Artist matching

First Contact hands every credited artist's platform link, the release's and each track's, to [Apollo Editor](../apollo_editor/README.md#artist-matching), which matches them, the link first: on start with _Auto-match on start: Label, Artist_ (the default), or with its **Match**. Apollo offers to add the link to an artist that lacks it, or to create the artist with it. Other scripts can read the same [handoff](#handoff).

## Archive

On every import, First Contact has the Internet Archive's [Wayback Machine](https://web.archive.org/) save the album page, so anyone can later check what it showed; the snapshot is found by the page's address.

- The import doesn't wait for the save; the [log](#settings) says how it went.
- Deezer and Apple Music build their pages in the browser, so a saved page shows little. For these, the album data First Contact read is saved too.
- Discogs refuses the Internet Archive, so its release data is saved instead.
- Spotify, Tidal and YouTube Music also build their pages in the browser, and their data can't be saved. For these, add your archive.org keys: the save then also takes a screenshot of the page.

### archive.org keys

Anonymous saves are limited per connection, so after many imports some are refused. With your own keys:

- the limit is much higher;
- each save also takes a screenshot of the page;
- a page saved in the last 30 days isn't saved again.

To get them, make a free account on [archive.org](https://archive.org), log in, and open [archive.org/account/s3.php](https://archive.org/account/s3.php). Copy the _access key_ and the _secret_ into **⚙︎ → archive.org keys**.

[Apollo Editor](../apollo_editor/README.md#archive) archives a release's links with the same keys, shared in [String Theory](../string_theory/README.md).

> [!NOTE]
> Archiving sends the address of every album you import to archive.org, and with keys, under your account. Turn **Archive the album page on the Internet Archive** off in [Settings](#settings) if you don't want that.

## Moving the button

Drag the buttons anywhere; each platform remembers its place, and **⚙︎ → Reset** puts them back. They stay put on the screen, or, with _Moved button scrolls with the page on_ platform, scroll with that platform's page.

## Settings

**⚙︎**, or a right-click on any of the buttons.

### Import

| Setting                                       | Default                   |                                                                                                                     |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| MusicBrainz server                            | musicbrainz.org           | where the release editor opens and the album is [looked up](#already-in-musicbrainz): musicbrainz.org, beta or test |
| Check MusicBrainz                             | On import                 | when the album is [looked up](#already-in-musicbrainz) in MusicBrainz                                               |
| Annotation from _platform_'s notes            | on                        | the album's [notes](#platforms) go into the annotation, with _From <platform>: <album page>_                        |
| Set Country as Worldwide for digital releases | on                        | on Discogs, use Worldwide for digital releases instead of its country                                               |
| Close this page after the import              | off                       | the tab closes once the album is sent on; not on a failure                                                          |
| Consolidate button                            | on                        | the [Consolidate button](#consolidate) beside **Import to MusicBrainz**                                             |
| Send to Harmony button                        | on                        | the [Harmony button](#send-to-harmony) before **⚙︎**                                                                 |
| Harmony                                       | harmony.pulsewidth.org.uk | which Harmony the [Harmony button](#send-to-harmony) opens: this one or harmony.mybrainz.dev                        |

A review in the notes is the critic's text (Qobuz's and Apple's are usually AllMusic's): check you may copy it before you submit.

### Archive

| Setting                                        | Default |                                                                                  |
| ---------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| Archive the album page on the Internet Archive | on      | each import saves the album page; see [Archive](#archive)                        |
| archive.org keys                               | none    | higher limits and a screenshot; shared with Apollo; see [keys](#archiveorg-keys) |

### Button

| Setting                                          | Default |                                                                                                               |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------- |
| Icon only                                        | off     | the button shows only its icon; its tooltip and progress stay                                                 |
| Hide settings button, use right click instead    | off     | no **⚙︎**; right-click any of the buttons for the settings                                                     |
| Moved button scrolls with the page on _platform_ | off     | on this platform only, a [moved](#moving-the-button) button stays on its spot on the page and scrolls with it |
| Position: Reset                                  |         | **this one**: back to the bottom-right corner on this platform; **all**: on every platform                    |

## Notes

### Log history

The log of a page where a release was imported, or where something went wrong, is kept in this browser, so it can still be read after the page reloads: the log window lists the last 10, by date and page. **Clear history** deletes First Contact's.

### Handoff

Other scripts on the release editor page can read what First Contact sent: the release and every track with each artist's name and platform link. [DEVELOP.md](DEVELOP.md#handoff) says how, and how each platform is read.

### Archiving requests

[DEVELOP.md](DEVELOP.md#archive) lists the requests sent to the Internet Archive, with and without keys.
