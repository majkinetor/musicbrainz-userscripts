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
- **[Adding links](#adding-links)** to the release, one or all, in the foreground or in the background, or opening all the pages found.
- **[Pasting a barcode](#pasting-a-barcode)**, or picking one the platforms report, for a release without one.
- **[Catalog numbers](#catalog-numbers)** the platforms give, for a label the release has without one.
- **[Artists and labels](#artists-and-labels)**: the artist and label pages the matched albums name, added to the release's MusicBrainz artists and labels through [Falcon](../falcon/README.md).

## Dashboard

A platform the release already links is used as is; the others are searched by barcode, then the platform's own search, Wikidata and a web search. Results are kept until **↻**, which also stops a search.

| Icon and name |                                                                                     |
| ------------- | ----------------------------------------------------------------------------------- |
| coloured      | found                                                                               |
| grey          | found, but the details don't match                                                  |
| faded         | not found                                                                           |
| marked        | already linked in MusicBrainz: a ring, or another mark from *Settings › Appearance* |
| amber bar     | found, with a different barcode                                                     |
| violet bar    | found, in a format this release isn't                                               |

| Track count |                                        |
| ----------- | -------------------------------------- |
| green       | matches MusicBrainz, fetched this scan |
| blue        | matches MusicBrainz, from the cache    |
| amber       | differs from MusicBrainz               |
| ?           | link found, track count unreadable     |
| red —       | not found                              |

A release's format is a four-quadrant circle: vinyl, cassette, CD, digital (DVD, SACD and Blu-ray count as CD). The panel and the launcher card say whether platform results are cached, live, or mixed. Cached results last 90 days by default; the cache setting changes the duration. A question mark means the scan or artist-link count failed.

> [!TIP]
> *Compact › Unmatched* shrinks a platform that found nothing (yet) to a dimmed icon at the bottom; *Compact › Low-confidence* does the same, with an amber ring, for a match that isn't clean. Discogs and Bandcamp always keep their rows.

## Link confidence

MusicBrainz treats a different barcode or a different format as a different release, so such a link [belongs elsewhere](https://musicbrainz.org/doc/Style/Relationships/URLs#Which_entity_to_link_to). Both checks can run *if they exist* (withhold a link only when its barcode or format is known and differs) or *strictly* (also withhold a link that can't be checked). A withheld link is greyed out and left out of adding and *Open all*.

- **Barcodes** are looked up with every zero-padding (UPC-A, EAN-13, 14 digits).
- **Formats**: only Bandcamp and Discogs report one; the others are digital. The medium is compared (DVD and Blu-ray count as CD), so vinyl on a CD release is withheld, but an edition that includes this release's medium ("Digital, CD" on a CD release) passes.
- **Discogs by barcode** takes only an edition that carries the barcode itself (not one sharing a label code or matrix number), in this release's medium; when the barcode finds only other media, Discogs is searched by title in this release's format instead.
- The **Discogs master** is exempt from both: it goes on the release group, which spans every edition.

## Adding links

| Click                                      | on the name                                            | on the icon                                                                                |
| ------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| left                                       | open the page (or the platform's search, if not found) | open the release editor with the link added, for you to review                             |
| right                                      | open the platform's search                             | add the link in the background                                                             |
| middle, or Alt+left                        |                                                        | add the link even when [link confidence](#link-confidence) withholds it, in the foreground |
| Ctrl+middle, or Ctrl+Alt+left (⌘ on a Mac) |                                                        | the same, in the background                                                                |

An override is marked in the edit note with its reason: *(added by hand over link confidence: barcode not confirmed)*.

The footer's **+** adds every confirmed link (middle-click or Alt+click: the withheld ones too; with Ctrl, in the background), the Discogs master onto the release group; **↗** opens them all. A background add submits from an inactive tab that closes itself. The master's own ✓ adds just the master: click for the editor, right-click in the background.

> [!NOTE]
> Firefox slows background tabs down. *Keep background tabs awake* plays an inaudible tone, which exempts the tab. It needs **Allow Audio** for musicbrainz.org (padlock → *Autoplay*); without it, the log reports the tone as blocked.

## Pasting a barcode

On a release without a barcode, copy one and press **Ctrl+V** outside a text field: the platforms are scanned again as if the release had it, and [link confidence](#link-confidence) checks against it.

- The barcode shows on the line under the title; click it to remove it and scan without it.
- A link added from the panel puts the barcode on the release too, in the same edit.
- It stays with the release, across reloads, until it's removed or the release has a barcode of its own.
- Accepted: 8, 12, 13 or 14 digits, spaces and dashes allowed. A wrong check digit is used anyway, with a warning; MusicBrainz then asks you to confirm it in the editor.

On a release without one, a dashed barcode button under the title counts the barcodes the platforms report. Its list gives each with the platforms reporting it, this release's medium first; one from another format, with a wrong check digit, or already on another MusicBrainz release (linked) is marked ⚠. A click uses it as if pasted, restarting a running search; a right-click adds it alone, in the background, after asking for a ⚠ one; Ctrl+click copies it. [Mission Control](../mission_control/README.md#release-and-entity-links) offers the same barcodes.

## Catalog numbers

Beatport and Discogs give the album's catalog number, shown after the platform's label (*Artoffact AOF 146*; *+1* when there are more, all in the tooltip). The MusicBrainz row shows the release's own the same way. When a release's label has none, a dashed tag button beside the barcode's counts the ones the platforms give.

- Click it for the list: each catalog number with its label and the platforms that give it. ✓ marks one from a link like this release (with the release's barcode, or one it already has, and the same track count and medium); ⚠ one from another barcode, another format, or platforms that give no barcode.
- The platform's label name is matched to the release's loosely (*Artoffact* is *Artoffact Records*), and the same number written differently (*AOF146*) is one.
- Click one to use it: a link added from the panel fills it in, in the same edit; its chip removes it. A right-click copies it.
- A label with a catalog number of its own keeps it.

[Mission Control](../mission_control/README.md#release-and-entity-links) offers the same catalog numbers.

## Artists and labels

A matched album usually names its artists' pages, sometimes its label's. **Artists & labels** in the footer lists them against this release's artists and labels, a row each and a column per platform; its purple badge counts the links to add.

| Mark |                                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| ✓    | already linked in MusicBrainz                                                                                         |
| +    | found, not linked yet: will be added                                                                                  |
| ⚠    | on another MusicBrainz artist or label: not added; hover shows which, click opens it                                  |
| +?   | may be the artist or the label (Bandcamp, SoundCloud, Audiomack), or a label of another name: left out until taken in |
| ·    | no page, or the platform didn't find the release                                                                      |

Click a mark to open its page; right-click to take it in or leave it out. **Run N in Falcon** queues the new links in Falcon and starts it; **▾ › Send only** queues them for you to start. Where Falcon doesn't run, it opens in a new tab, not started. Without Falcon, a row's **✎** opens the edit page with its new links filled in.

- **Which artists**: the release's artist credit (not Various Artists) and each track's, which a compilation needs. Tracks are paired by position, so a platform with another track count gives no track artists.
- **Matching**: by name, ignoring case, accents and *&* / *and*; else by position, when both credits have as many artists and the platform's name isn't several in one (*Samrai & SCAPA & Vindya*). A mark paired by position shows the platform's name on hover.
- **Labels**: by name, also ignoring company forms such as *Inc.*, *Ltd*, *Records* or *Productions* (*Arts & Crafts Productions Inc.* is *Arts & Crafts*). A label of another name is paired by position only when each side has as many labels, and shows **+?**: it is often another label (an imprint where MusicBrainz has the distributor), so it waits for you to take it in.
- **Which platforms**: Discogs, Deezer, Apple Music, Qobuz, Beatport (signed in), YouTube Music, Bandcamp, SoundCloud and Audiomack. Track artists come from Discogs, Deezer, Apple Music, Qobuz and YouTube Music; Beatport and the accounts give only the release's. Label pages come from Discogs, Qobuz, Beatport and the accounts.
- **Link types**: MusicBrainz types most links itself. Where it offers several and picks none, the link is sent typed: Qobuz as *purchase for download*, Apple Music as *streaming page* (and *purchase for download* when the iTunes Store sells it), Audiomack as *stream for free*.
- **Other locales**: a Qobuz or Apple Music page linked in another locale (`gb-en`, `/gb/`…) shows ✓; Falcon catches the rest.
- Every matched platform counts (a ✓), including one that [link confidence](#link-confidence) withholds for its barcode or format: another edition still has the same artists and labels.

> [!NOTE]
> The pages come from the albums the scan already read, so they cost no extra platform requests. With *Count the links to add* off, MusicBrainz is asked which links it already has only when you open the table.

## Platforms

| Platform      | Barcode                                                                    | Login    |
| ------------- | -------------------------------------------------------------------------- | -------- |
| Discogs       | read                                                                       |          |
| Bandcamp      | read                                                                       |          |
| Spotify       | looked up (through [Wallstream](https://tools.wallstream.com/isrc-lookup)) |          |
| Apple Music   | looked up and read                                                         |          |
| Deezer        | looked up                                                                  |          |
| Tidal         | looked up and read                                                         |          |
| YouTube Music | looked up                                                                  |          |
| Amazon Music  |                                                                            |          |
| Qobuz         | looked up and read                                                         | optional |
| Beatport      |                                                                            | optional |
| Volumo        | looked up and read                                                         |          |
| AllMusic      | looked up and read                                                         |          |
| HDtracks      | looked up and read                                                         |          |
| 7digital      | looked up and read                                                         |          |
| SoundCloud    | read from the linked set                                                   |          |
| Audiomack     | read                                                                       |          |

*Looked up*: the barcode finds the album. *Read*: the found album's barcode is checked against the release's. Each platform's API, credentials and search order are in [Provider details](DEVELOP.md#provider-details).

- **Qobuz**: signed in, matches are verified (track count and barcode); otherwise its store page is read, slower and throttled. ISRC Scout and Credit Hoarder share the login; only its token is kept.
- **Beatport** is behind Cloudflare: without a login, a match found by web search can't be verified, shows `?`, and isn't added. Signed in, it is verified, and ISRC Scout can import its ISRCs.
- **Bandcamp**: bonus tracks that are download-only are counted and marked ⁿ. A Bandcamp barcode that is really a physical package's is ignored.
- **Apple Music** needs no login. The track count leaves out music videos. A release is looked for in several countries' stores, and the link keeps the one it was found in.
- **Discogs**: on a CD release, a CD edition is searched first. The release group's Discogs master is checked too.
- **YouTube Music** needs no login. It finds most albums by barcode, the rest by artist and title, but shows no barcode and may return another edition: every hit must match on track count and title, and strict barcode mode withholds it. The *other versions* it lists are named in the tooltip, for you to check. The label comes from a song's credits, when the label sends them. Links are added as *stream for free*.
- **Amazon Music** needs no account. It is searched by artist and title only, taken when title and track count match (of two editions, the release's year wins), and strict barcode mode withholds it. Its catalogue is amazon.com's, so an album sold only elsewhere may be missed. The label comes from the ℗ line.
- **SoundCloud** can't be searched by barcode; it's read from the linked set, and trusted only when the whole set agrees on it.
- **Audiomack** needs no login. It is searched by artist and title, and fans re-upload albums, so every hit's barcode is read: the release's barcode wins, else a hit with a barcode and the track count. A song link is a one-track release. The label comes from the ℗ line; links are *stream for free*.
- **7digital** needs no login. It is searched by barcode in the UK store, then the US one, then by artist and title; the link is to the store it was found in.
- **Volumo** and **HDtracks** are added as *purchase for download*, since MusicBrainz has no type of their own.

## Settings

<img width="400" src="./screenshots/config.png" />

| Setting                                | Default      |                                                                                      |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Platforms                              | all          | order them, or leave some out                                                        |
| Logins                                 | none         | Beatport and Qobuz; see [Platforms](#platforms)                                      |
| Use barcodes                           | on, strictly | [link confidence](#link-confidence); *if they exist* withholds only a known mismatch |
| Use formats                            | on, strictly | the same, for the format                                                             |
| Open the editor in a new tab           | on           | off navigates this tab                                                               |
| Keep background tabs awake             | off          | see [Adding links](#adding-links)                                                    |
| Count the links to add                 | on           | the badge on [Artists & labels](#artists-and-labels)                                 |
| Cache scan results                     | on, 90 days  | reuse scan results; choose how long to keep them                                     |
| Close Falcon after a successful import | on           | see [Artists and labels](#artists-and-labels)                                        |
| Icon, Name                             | icon only    | what each row shows, and its size                                                    |
| Compact: Unmatched, Low-confidence     | on, off      | see [Dashboard](#dashboard)                                                          |
| In MusicBrainz                         | Ring         | how a platform already linked is marked                                              |
| Format                                 | Circle       | the release's format as a circle or as text                                          |
| Layout                                 | 1 row        | or 2 rows per platform                                                               |
| Spacing                                | 5 px         | between rows, and between columns in the 1-row layout                                |

## Shortcuts

| Key                                            |                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Esc                                            | close the open dialog                                                                              |
| Ctrl+V                                         | on a release without a barcode, [use the pasted barcode](#pasting-a-barcode)                       |
| Alt+click                                      | as a middle click: add a link [link confidence](#link-confidence) withholds; on **+**, all of them |
| Ctrl+middle-click, Ctrl+Alt+click (⌘ on a Mac) | the same, in the background                                                                        |
| right-click                                    | in the [platforms' barcodes](#pasting-a-barcode), add the barcode alone, in the background         |
| Ctrl+click                                     | in the platforms' barcodes, copy the barcode                                                       |

## Notes

The **Log** keeps every lookup, with a filter per platform. The log of a page where links were added is kept in this browser, so it can still be read after the page reloads: the log window lists the last 10, by date and release. **Clear history** deletes Platform Check's.
