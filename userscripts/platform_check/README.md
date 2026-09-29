# Platform Check <img src="icon.svg" align="left" width="48">

Finds a MusicBrainz release on the streaming and store platforms, checks each match against the release's barcode, format and track count, and adds the good ones to the release.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/platform_check/platform_check.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/platform_check/platform_check.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Platform+Check)

<img width="200" src="./screenshots/dashboard-2-rows.png" /><img width="200" src="./screenshots/dashboard-1-row-no-names.png" /><img width="200" src="./screenshots/dashboard-1-row-compact.png" />

## Features

- **[Dashboard](#dashboard)** on every release page: each [platform](#platforms), with its track count, year, label and format beside MusicBrainz's.
- **[Link confidence](#link-confidence)**: a match with a different barcode or format is a different release, and is not added.
- **[Adding links](#adding-links)** to the release, one or all, in the foreground or in the background.
- **Open all found**: every confirmed platform page not yet in MusicBrainz, each in a tab (plus the Discogs master). Mind the pop-up blocker.
- A **log** with a filter per platform.

## Dashboard

A link already in the release's relationships is used as is. Otherwise each platform is searched: by barcode first, then the platform's own search, Wikidata, and a web search. The platform's details are fetched and shown next to MusicBrainz's, and the result is cached until you press ↻.

| Icon and name | |
|---|---|
| coloured | found |
| grey | found, but the details don't match |
| faded | not found |
| circled | already linked in MusicBrainz |
| amber bar | found, with a different barcode |
| violet bar | found, in a format this release isn't |

A release's format is a four-quadrant circle: vinyl, cassette, CD, digital (DVD, SACD and Blu-ray count as CD).

> [!TIP]
> *Compact unmatched providers* keeps only clean matches as rows; the rest shrink to dimmed icons at the bottom, a mismatch with an amber ring. Discogs and Bandcamp always keep their rows.

## Link confidence

MusicBrainz treats a different barcode or a different format as a different release, so such a link [belongs elsewhere](https://musicbrainz.org/doc/Style/Relationships/URLs#Which_entity_to_link_to). Both checks can run *if they exist* (withhold a link only when its barcode or format is known and differs) or *strictly* (also withhold a link that can't be checked). A withheld link is greyed out and left out of adding and *Open all*.

- **Barcodes** are looked up with every zero-padding (UPC-A, EAN-13, 14 digits). Deezer's answer is checked against the barcode asked for, since it sometimes returns an unrelated album.
- **Formats**: only Bandcamp and Discogs report a format; the other platforms are digital. A Bandcamp or Discogs edition that includes this release's medium ("Digital, CD" on a CD release) passes.
- The **Discogs master** is exempt from both: it goes on the release group, which spans every edition.

## Adding links

| Click | on the name | on the icon |
|---|---|---|
| left | open the page (or the platform's search, if not found) | open the release editor with the link added, for you to review |
| right | open the platform's search | add the link in the background |

The footer's **+** adds every confirmed link and **↗** opens them all. A background add opens an inactive tab that submits the edit and closes itself; the Discogs master goes onto the release group the same way.

> [!NOTE]
> Firefox throttles background tabs hard, slowing a background add down. *Keep background-add tabs awake* plays an inaudible tone, which exempts the tab. It needs **Allow Audio** for musicbrainz.org (padlock → *Autoplay*); without it, the log reports the tone as blocked.

## Platforms

| Platform | Barcode | Login |
|---|---|---|
| Discogs | read | |
| Bandcamp | read | |
| Spotify | looked up (through [Wallstream](https://tools.wallstream.com/isrc-lookup)) | |
| Apple Music | looked up and read | |
| Deezer | looked up | |
| Tidal | looked up and read | |
| Qobuz | looked up and read | optional |
| Beatport | | optional |
| Volumo | looked up and read | |
| HDtracks | looked up and read | |
| SoundCloud | read from the linked set | |

*Looked up*: the barcode finds the album. *Read*: the found album's barcode is checked against the release's.

- **Qobuz**: signed in, matches are verified through its API (track count and barcode); otherwise its store page is scraped, which is slower and throttled. The login is shared with ISRC Scout and Credit Hoarder. Only the token is stored, never the password.
- **Beatport** is behind Cloudflare: without a login, a match found by web search can't be verified, shows `?`, and isn't added. Signed in, it is verified, and ISRC Scout can import its ISRCs.
- **Bandcamp**: bonus tracks that are download-only are counted and marked ⁿ. A Bandcamp barcode that is really a physical package's is ignored.
- **Apple Music** is read from the catalogue its web player uses, anonymously. Of the albums a barcode brings up, only the one with that barcode counts, and the track count is songs only, without music videos. If that catalogue can't be reached, the older iTunes search is used, which gives no barcode.
- **Discogs**: on a CD release, a CD edition is searched first. The release group's Discogs master is checked too.
- **SoundCloud** can't be searched by barcode; it's read from the linked set, and trusted only when the whole set agrees on it.
- **Volumo** and **HDtracks** are added as *purchase for download*, since MusicBrainz has no type of their own.

## Settings

<img width="400" src="./screenshots/config.png" />

| Section | |
|---|---|
| Platforms | order them, or leave some out |
| Authentication | Beatport and Qobuz logins |
| Link confidence | *Use barcodes* and *Use formats* (off, if they exist, strictly); *Add links in a new tab* (on; off navigates this tab); *Keep background-add tabs awake* |
| Appearance | icon and name size, *Compact unmatched providers*, the MusicBrainz marker (circle or glow), the format marker (circle or text), one or two rows |

## Shortcuts

| Key | |
|---|---|
| Esc | close the open dialog |
