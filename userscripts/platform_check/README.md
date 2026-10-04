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
- **[Pasting a barcode](#pasting-a-barcode)** on a release that has none, or picking one the platforms report: the platforms are checked against it, and an added link adds it too.
- **[Artists and labels](#artists-and-labels)**: the artist and label pages the matched albums name, added to the release's MusicBrainz artists and labels through [Falcon](../falcon/README.md).
- A **log** with a filter per platform.

## Dashboard

A link already in the release's relationships is used as is. Otherwise each platform is searched: by barcode first, then the platform's own search, Wikidata, and a web search. The platform's details are fetched and shown next to MusicBrainz's, and the result is cached until you press ↻.

| Icon and name |                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| coloured      | found                                                                                                                              |
| grey          | found, but the details don't match                                                                                                 |
| faded         | not found                                                                                                                          |
| marked        | already linked in MusicBrainz: a ring by default; *Settings › Appearance* offers a bold ring, a ✓ badge, a dot or a rounded square |
| amber bar     | found, with a different barcode                                                                                                    |
| violet bar    | found, in a format this release isn't                                                                                              |

| Track count |                                        |
| ----------- | -------------------------------------- |
| green       | matches MusicBrainz, fetched this scan |
| blue        | matches MusicBrainz, from the cache    |
| amber       | differs from MusicBrainz               |
| ?           | link found, track count unreadable     |
| red —       | not found                              |

Hover a track count for what its colour means.

A release's format is a four-quadrant circle: vinyl, cassette, CD, digital (DVD, SACD and Blu-ray count as CD).

> [!TIP]
> *Compact unmatched providers* shrinks a provider that found nothing (or is still searching) to a dimmed icon at the bottom; it rises into a row once it finds something. *Compact low-confidence providers* does the same for a found release that isn't a clean match (different barcode or format, or withheld), shown with an amber ring; with it off, that row stays, with its tracks, year and label. Discogs and Bandcamp always keep their rows.

## Link confidence

MusicBrainz treats a different barcode or a different format as a different release, so such a link [belongs elsewhere](https://musicbrainz.org/doc/Style/Relationships/URLs#Which_entity_to_link_to). Both checks can run *if they exist* (withhold a link only when its barcode or format is known and differs) or *strictly* (also withhold a link that can't be checked). A withheld link is greyed out and left out of adding and *Open all*.

- **Barcodes** are looked up with every zero-padding (UPC-A, EAN-13, 14 digits). Deezer's answer is checked against the barcode asked for, since it sometimes returns an unrelated album.
- **Formats**: only Bandcamp and Discogs report a format; the other platforms are digital. A Bandcamp or Discogs edition that includes this release's medium ("Digital, CD" on a CD release) passes.
- The **Discogs master** is exempt from both: it goes on the release group, which spans every edition.

## Adding links

| Click                                      | on the name                                            | on the icon                                                                                |
| ------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| left                                       | open the page (or the platform's search, if not found) | open the release editor with the link added, for you to review                             |
| right                                      | open the platform's search                             | add the link in the background                                                             |
| middle, or Alt+left                        |                                                        | add the link even when [link confidence](#link-confidence) withholds it, in the foreground |
| Ctrl+middle, or Ctrl+Alt+left (⌘ on a Mac) |                                                        | the same, in the background                                                                |

A middle click (or Alt+click) on a link that passes link confidence is a plain add. One it overrides is marked in the edit note, with the reason: *(added by hand over link confidence: barcode not confirmed)*.

The footer's **+** adds every confirmed link (middle-click or Alt+click: the withheld ones too; with Ctrl, in the background) and **↗** opens them all. A background add opens an inactive tab that submits the edit and closes itself; the Discogs master goes onto the release group the same way.

> [!NOTE]
> Firefox throttles background tabs hard, slowing a background add down. *Keep background-add tabs awake* plays an inaudible tone, which exempts the tab. It needs **Allow Audio** for musicbrainz.org (padlock → *Autoplay*); without it, the log reports the tone as blocked.

## Pasting a barcode

A release without a barcode can borrow one: copy it (from the cover, a store page, Harmony) and press Ctrl+V anywhere on the release page, outside a text field. The platforms are scanned again as if the release had it, so a barcode lookup finds what a text search misses, and [link confidence](#link-confidence) checks the matches against it.

- The barcode shows next to ↻ in the header; click it to remove it and scan without it.
- A link added from the panel (icon or **+**, in the foreground or the background) puts the barcode on the release too, in the same edit, and the edit note says so.
- It stays with the release, across reloads, until it's removed or the release has a barcode of its own.
- A release that already has a barcode refuses the paste, with an error.

The matched platforms often show a barcode the release lacks. On a release without one, a dashed barcode button next to ↻ counts the barcodes they report. Click it for the list: each barcode with the platforms that report it, the ones in this release's format (physical or digital) first. A barcode from another format, or with a wrong check digit, is marked ⚠. Click one to use it as if you pasted it; right-click to copy it.
- Accepted: 8, 12, 13 or 14 digits, spaces and dashes allowed. A wrong check digit is used anyway, with a warning; MusicBrainz then asks you to confirm it in the editor.

## Artists and labels

A matched album usually names its artists' pages on that platform, and sometimes its label's. **Artists & labels**, in the footer next to **+** and **↗**, lists them against this release's MusicBrainz artists and labels: one row per artist or label, one column per platform. Once the scans finish, the button shows how many links would be added as a purple badge beside its name, like an unread count.

| Mark |                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✓    | already linked in MusicBrainz                                                                                                                         |
| +    | found, not linked yet: will be added                                                                                                                  |
| ⚠    | linked to a different MusicBrainz artist or label: not added; hover shows which, click opens it to compare or merge (middle-click: the platform page) |
| +?   | an account that may be the artist or the label (Bandcamp, SoundCloud, Audiomack): left out until you take it in                                       |
| ·    | no page, or the platform didn't find the release                                                                                                      |

Click a mark to open the page (a ⚠ opens the MusicBrainz artist or label that has it); right-click to take it in or leave it out. **Run N in Falcon** closes the table, queues every row with its new links in Falcon on this page and starts it (with *Close Falcon after a successful import* on, Falcon closes once every link is added, and stays open when one fails); **▾ › Send only** queues them and Falcon waits for you to press Start. Where Falcon doesn't run, it opens in a new tab with the links queued, not started; the edit note names the release. Without Falcon, a row's **✎** opens that artist's or label's edit page with its new links filled in, for you to submit.

- **Which artists**: the release's artist credit (not Various Artists) and each track's, which a compilation needs. Tracks are paired by position, so a platform with another track count gives no track artists.
- **Matching**: by name, ignoring case, accents and *&* / *and*. When no name matches, by position, but only when both credits have as many artists; otherwise the artist is left out, and the log says why.
- **Which platforms**: Discogs, Deezer, Apple Music, Qobuz, Beatport (signed in), YouTube Music, Bandcamp, SoundCloud and Audiomack. Label pages come from Discogs, Qobuz, Beatport and the accounts.
- **Link types**: MusicBrainz types most links itself. Where it offers several and picks none, the link is sent typed: Qobuz as *purchase for download*, Apple Music as *streaming*, Audiomack as *stream for free*.
- **Other locales**: MusicBrainz keeps a Qobuz or Apple Music link in whatever locale it was entered. A page already linked as `gb-en`, `fr-fr`, `de-de` or `/gb/` (or open.qobuz.com, itunes.apple.com) shows ✓, not +. Falcon catches any other locale when it runs and doesn't add the page again.
- Only a [confirmed](#link-confidence) match counts: a link withheld by link confidence gives no artists or labels either.

> [!NOTE]
> The pages come from the album answers the scan already read, so they cost no extra platform requests. MusicBrainz is asked once which of the links it already has, and on whom (one request per 100 links): when the scans finish, for the count, and the table reuses that answer. With *Count the links to add* off, it is asked only when you open the table. A match cached before this feature is read again once, on the next scan of the release.

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
| HDtracks      | looked up and read                                                         |          |
| 7digital      | looked up and read                                                         |          |
| SoundCloud    | read from the linked set                                                   |          |
| Audiomack     | read                                                                       |          |

*Looked up*: the barcode finds the album. *Read*: the found album's barcode is checked against the release's.

- **Qobuz**: signed in, matches are verified through its API (track count and barcode); otherwise its store page is scraped, which is slower and throttled. The login is shared with ISRC Scout and Credit Hoarder. Only the token is stored, never the password.
- **Beatport** is behind Cloudflare: without a login, a match found by web search can't be verified, shows `?`, and isn't added. Signed in, it is verified, and ISRC Scout can import its ISRCs.
- **Bandcamp**: bonus tracks that are download-only are counted and marked ⁿ. A Bandcamp barcode that is really a physical package's is ignored.
- **Apple Music** is read from the catalogue its web player uses, anonymously. Of the albums a barcode brings up, only the one with that barcode counts, and the track count is songs only, without music videos. Apple's catalogue differs by country, so a release is looked for in several storefronts at once (the release's own link's, the US, UK, Germany, France, Japan, Brazil and Australia), and when none has it, in all of Apple's storefronts at once, about a second. The log says which storefront a match came from, and the link keeps it. If that catalogue can't be reached, the older iTunes search is used, which gives no barcode.
- **Discogs**: on a CD release, a CD edition is searched first. The release group's Discogs master is checked too.
- **YouTube Music** is read anonymously, through the catalogue its web player uses. Its search finds most albums by their barcode, and the rest by artist and title. It shows no barcode and can return another edition of the album, so every hit must also match on track count and title. A barcode search can also bring up another edition from the same group of versions, with a different barcode. So a match is never taken as barcode-confirmed, and strict barcode mode withholds it. When YouTube Music lists *other versions* of the album, the link's tooltip and the log name them, for you to check. The album page names no label, so the label comes from a song's credits (*Music metadata provided by*, usually the label, sometimes a distributor). Some labels send no credits, and those rows have no label. Links are added as *stream for free*.
- **Amazon Music** is read as a guest (no Amazon account), through the catalogue its web player uses. It has no barcode search and shows no barcode, so an album is found by artist and title only, and taken only when its title and track count both match; when two editions match, the one from the release's year wins. A match is never barcode-confirmed, so strict barcode mode withholds it. The guest catalogue is amazon.com's (US), so an album sold only elsewhere may not be found. The year comes from the album page's date, and the label from its ℗ line. MusicBrainz makes the link a *streaming page* by itself.
- **SoundCloud** can't be searched by barcode; it's read from the linked set, and trusted only when the whole set agrees on it.
- **Audiomack** is read through the API its web player uses, with no login. Its search finds albums by artist and title only, never by barcode, and fans re-upload albums there, so every hit is opened and its barcode read: the one with the release's barcode wins; otherwise one whose track count matches and that has a barcode at all. A song link counts as a one-track release. The label comes from the ℗ line. Links are added as *stream for free*.
- **7digital** is read through the catalogue its web store uses, with no login. It finds an album by its barcode, in the UK store and then the US one, and has the track count, year and label. Without a barcode match, artist and title are searched. The link is to the store the album was found in; MusicBrainz makes it *purchase for download* by itself.
- **Volumo** and **HDtracks** are added as *purchase for download*, since MusicBrainz has no type of their own.

## Settings

<img width="400" src="./screenshots/config.png" />

| Section |  |
| --- | --- |
| Platforms | order them, or leave some out; the button shows how many are on |
| Logins | Beatport and Qobuz; the button shows how many you are signed in to |
| Link confidence | *Use barcodes* and *Use formats* (off, if they exist, strictly) |
| Adding links | *Open the editor in a new tab* (on; off navigates this tab); *Keep background tabs awake* |
| Artists & labels | *Count the links to add* (on); *Close Falcon after a successful import* (off) |
| Appearance | icon and name, each shown or not and sized; *Compact* unmatched and low-confidence platforms; the *In MusicBrainz* marker (ring, bold ring, ✓ badge, dot or rounded square); the *Format* marker (circle or text); one or two rows; row and column spacing |

## Shortcuts

| Key                                            |                                                                                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Esc                                            | close the open dialog                                                                                                                  |
| Ctrl+V                                         | on a release without a barcode, [use the pasted barcode](#pasting-a-barcode)                                                           |
| Alt+click                                      | the same as a middle click: add a link even when [link confidence](#link-confidence) withholds it; on **+**, add the withheld ones too |
| Ctrl+middle-click, Ctrl+Alt+click (⌘ on a Mac) | the same, in the background                                                                                                            |
