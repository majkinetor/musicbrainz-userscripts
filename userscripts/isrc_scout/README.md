# ISRC Scout <img src="icon.svg" align="left" width="48">

Shows a release's ISRCs, fills in the missing ones from several providers, and finds and manages its recordings' streaming and store links.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/isrc_scout/isrc_scout.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/isrc_scout/isrc_scout.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=76&conditions.0.args=78&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=ISRC+Scout)

![screenshot](./screenshots/isrc.png)

## Features

- **[Providers](#providers)** found through the release group and [Platform Check](../platform_check/README.md), not just the release's own links.
- **[ISRC badge](#isrc-editor)** by the release title, showing how many tracks lack an ISRC.
- **[ISRC editor](#isrc-editor)**: every track's ISRCs, with validation, provider [imports](#importing-isrcs), [per-track lookups](#per-track-lookup), bulk paste, export and deletion.
- **[Links](#links)**: find and add the recordings' streaming and store links, and end or remove existing ones.
- **[Tracklist](#tracklist)**: ISRC and Links columns on the release page's own tracklist.

## Providers

| Provider                        | ISRC import | Track links | Resolved by                                                                           |
| ------------------------------- | :---------: | :---------: | ------------------------------------------------------------------------------------- |
| Deezer                          |      ✓      |      ✓      | ISRC, on any release                                                                  |
| Tidal                           |      ✓      |      ✓      | ISRC, on any release                                                                  |
| Beatport                        |      ✓      |      ✓      | the album, matched by ISRC                                                            |
| Volumo                          |      ✓      |      ✓      | the album, matched by ISRC                                                            |
| Qobuz                           |      ✓      |      ✓      | the album; ISRCs by position, links by ISRC                                           |
| Apple Music                     |      ✓      |      ✓      | the album; by position (+ title for links)                                            |
| SoundCloud                      |      ✓      |      ✓      | the set (a track URL counts as a one-track release); by position (+ title for links)  |
| Audiomack                       |      ✓      |      ✓      | the album (a song URL counts as a one-track release); by position (+ title for links) |
| Spotify                         |      ✓      |      ✓      | ISRCs through [a lookup service](#spotify); links from the album, by position + title |
| Bandcamp                        |             |      ✓      | the album page, by position + title                                                   |
| [YouTube Music](#youtube-music) |             |      ✓      | the album, when linked (by position + title); else ISRC, on any release               |
| [Amazon Music](#amazon-music)   |             |      ✓      | the album, when linked (by position + title)                                          |
| HDtracks                        |      ✓      |             | the album                                                                             |
| [Presto Music](#presto-music)   |      ✓      |             | the album, shop or streaming link; by position                                        |
| [7digital](#7digital)           |      ✓      |             | the album: each track searched by title                                               |
| SoundExchange                   |      ✓      |             | a title and artist search                                                             |

An album-based provider needs the release's album link: already in MusicBrainz, found by Platform Check, or pasted with **(+)**. No login is needed anywhere except Qobuz outside the countries it serves (see [Qobuz](#qobuz)).

> [!WARNING]
> Album imports map tracks by position and trust the link: provider titles legitimately differ (*feat.*, *remaster*). A fill whose length is more than 10 s off is kept but marked amber, and counted as *⚠ N implausible*. An album with more tracks than the release is flagged as a likely wrong edition. Check the amber rows before submitting, or [remove them all](#submitting).

## ISRC editor

Click the **ISRC** badge (`✓ 12/12`, or `⚠ 9/12` pulsing when some are missing). Each track shows its ISRCs and an input for a new one: red is invalid, orange a duplicate, green good.

ISRCs show in their parts, `US-AM1-85-74817` (country, registrant, year, number); a copy is the plain code. *Show ISRCs in parts* turns it off.

### Importing ISRCs

The toolbar shows the providers available for this release:

<img width="800" src="./screenshots/toolbar.png" />

| Icon     | Comes from                                                                         |
| -------- | ---------------------------------------------------------------------------------- |
| circled  | the release's own links                                                            |
| plain    | [Platform Check](../platform_check/README.md)                                      |
| blue dot | another release in the group (option *Use providers from the whole release group*) |

**(+)** imports from any album URL you paste. **⟳ SoundExchange** searches every track by title and artist, fills the confident matches, and shows the other candidates per row; on a long release, click a *Not searched* row to search the next tracks. Deezer continues the same way.

> [!NOTE]
> A Platform Check link withheld for a barcode or format mismatch isn't used, because the mismatch may mean it's a different release altogether. *Ignore Platform Check link confidence* uses it anyway; a wrong track count always excludes it.

### Per-track lookup

<img width="1000" src="./screenshots/isrc-tracks.png" />

- **+1** fills the previous track's ISRC plus one.
- **lookup** looks the row's ISRC up on the selected provider and shows its title, artist and length, mismatches in red. Guests (*feat.*, extra artists) aren't a mismatch, and a word of five letters or more one letter off (*Les Ecrocs*) is marked ⚠ as *spelled differently*. Its menu switches every row to another provider; a right-click runs it on all tracks.
- **All** (top of the menu) checks the row's ISRCs on [every provider](#checking-every-provider) at once.
- **⚙** opens a SoundExchange search you can tune (title, artist, release, exact), with a link to run it on their site.

| Check         | Mismatch when                                                             |
| ------------- | ------------------------------------------------------------------------- |
| Title, artist | the words don't match (a couple of extra words, like a version, are fine) |
| Year          | recorded after the release year (+1)                                      |
| Length        | more than 10 s off; MusicBrainz's length is shown alongside               |

A result passing every check fills an empty field (blue); a length mismatch only warns (yellow). Lookups run when you leave a field you typed into, press the button, or search SoundExchange, whose captcha or rate limit shows in the toolbar to solve.

### Checking every provider

**All** checks the row's ISRCs on every provider available for the release (not SoundExchange, which serves a captcha on nearly every run): the entered one and every ISRC the recording already has. **All** at the end of the toolbar, or a right-click on a row's **All**, checks every track.

The row shows a verdict: **✓ 4/4** when every provider that knows the ISRC agrees, **⚠ 1/4** when some don't, **– 0/4** when none knows it. Hover the verdict for the comparison; a click pins it. Each line starts with the provider's verdict:

- Deezer and Tidal look the ISRC up: ✓ their song for it is this track, ⚠ it is another song.
- An album provider (Qobuz, Apple, Beatport…) reads the release's album there: ✓ it has this ISRC at the same position as this track (📍), or at another position (↪ track 3: the album orders its tracks differently). When the album hasn't the ISRC at all, ✗ it has **another** ISRC at this track's position, offered with **use**. An ISRC that belongs to another track of the release, or that the row already has, is never offered.

The header lists the row's ISRCs first, then any other ISRC a provider named, each with how many providers have it for this track. Click one to see what the providers say about it. **copy** puts the comparison on the clipboard as a Markdown table.

### Paste, export, delete

- **Paste** one ISRC per line in track order (an empty line skips a track), or address tracks: `3=USABC1234567`, `USABC1234567 | 1.3`, `1.3 USABC1234567`. Then *Apply to empty fields* or *Apply (overwrite)*.
- **Export** as text or JSON (`{ recordingMBID: "ISRC" }`), to the clipboard.
- Tick existing ISRCs and **🗑 Delete checked**: one *Remove ISRC* edit each, through your logged-in session.

### Submitting

Submitting ISRCs needs authorizing once: **⚙ Setup → Authorize**, then approve in the tab that opens. musicbrainz.org and beta share it; test.musicbrainz.org needs its own. When MusicBrainz stops accepting it, Setup asks again; *Sign out* forgets it.

Amber fills (see the warning under [Providers](#providers)) are counted in the footer's *⚠ N implausible fills — verify*: click it to go to the first one, or **✕ Remove** to empty them all (**Undo** puts them back until the next change). Submitting with amber fills asks first: *Review first*, *Remove them, submit the rest*, or *Submit anyway*.

## Links

The **Links** tab shows, per track, what each recording already links to (**Linked**) and what was found but isn't linked yet (**Add**). Linked shows every site, ones ISRC Scout can't add too, with MusicBrainz's icon (or a globe) where ISRC Scout has none.

<img width="1000" src="./screenshots/links.png" />

**Find links** resolves every track on every available provider, in parallel. A provider matched by position (Apple Music, Bandcamp, SoundCloud, Audiomack, Spotify, YouTube Music, Amazon Music) must also have the track's title, allowing a typo, a *feat.* or another apostrophe. A Deezer track that no longer plays anywhere isn't offered. **➕ Add links** adds everything found, with no authorizing needed.

### Match

**⚡ Match** does both: it imports ISRCs from the fastest source the release links (Qobuz, Audiomack, Apple Music, Tidal… before Deezer, 7digital and Spotify), moving on when one fails or gives nothing, then runs **Find links**. It skips the release group's links, which need you to look. *Auto match* runs it on opening the window or in the background. The launcher shows new ISRCs and links to add as two counts, for example `0,7`; its card says whether results are cached or live.

| Click               | on an **Add** icon               | on a **Linked** icon                           |
| ------------------- | -------------------------------- | ---------------------------------------------- |
| left                | open the provider's track        | open the provider's track                      |
| right               | add this link                    | toggle *ended* (shown faded)                   |
| Ctrl + right        | add every link on the track      | end every link on the track                    |
| Alt + right         | add this provider on every track | end this provider on every track               |
| middle              |                                  | remove this link                               |
| Ctrl / Alt + middle |                                  | remove on the track / this provider everywhere |

End a link when the release is taken down and it no longer resolves ([MusicBrainz style](https://musicbrainz.org/doc/Style/Relationships/URLs#When_to_remove)). Ending and removing work on any linked provider.

> [!TIP]
> Editions are often split by platform: one carries Deezer, another Spotify. With *Use providers from the whole release group* on, a provider missing here is taken from a sibling release (it shares the recordings) and marked with a purple dot.

## Tracklist

The release page's tracklist gets **ISRC** and **Links** columns. An ISRC opens its MusicBrainz page, an icon the provider's track; a platform with several links shows how many, and opens the first that hasn't ended. An ended link is faded. **ISRC** and **Links** above the tracklist show or hide each column.

## Settings

**⚙** in the editor's header:

<img width="420" src="./screenshots/options.png" />

| Setting | Default |  |
| --- | --- | --- |
| Platforms | all on | the platforms ISRC Scout uses ([Platforms](#platforms)) |
| Authorize |  | OAuth for submitting ISRCs |
| Import buttons | icons | icons, text, or both |
| Add ISRC/Links columns to tracklist | on | columns and their controls on the release page ([Tracklist](#tracklist)) |
| Show ISRCs in parts | on | `CC-XXX-YY-NNNNN`, here and in [Mission Control](../mission_control/README.md) |
| Use providers from the whole release group | off | take missing providers from sibling releases (one more lookup) |
| Auto match | off (in the background) | run [Match](#match) on opening or in the background |
| Cache Match results | on, 7 days | reuse Match results for the chosen time; off keeps them only for this page |
| Include slow platforms | on | in the background, Tidal too (about 1 s a track) |
| Ignore Platform Check link confidence | off | use links Platform Check withheld for a barcode or format mismatch |
| Repeat failed submits | on, 10 minutes or 10 times | try a submit again when MusicBrainz is busy (503) or the connection drops |
| Spotify ISRC source | Harmony | or molla, or ISRC Hunt |

### Platforms

A platform switched off loses its import button and lookup, Match, Find links and All skip it, and its found links are dropped. Platform Check keeps its own list.

## Shortcuts

| Key   |                                                               |
| ----- | ------------------------------------------------------------- |
| Esc   | close the open panel, else the editor                         |
| Enter | submit the focused URL input, or run the SoundExchange search |

The mouse gestures on links are in the [Links](#links) table.

## Notes

### YouTube Music

YouTube Music shows no ISRCs. With the release's album linked, each track comes from its tracklist by position and title, as official audio. A song a free listener can't play is left out, as the links are *free streaming*. Without the album, the ISRC is searched; a result counts only as official audio with the track's title, within 3 s of its length, from this release's album. The log says what it skipped and why.

### Amazon Music

Amazon Music shows no ISRCs; its links come from the release's linked album, by position or title, when the title matches and the length is within 3 s. They are added as *streaming page*; no account is needed.

### 7digital

Each track is searched by its title, keeping the linked album's results; a long album takes some seconds. 7digital tracks have no pages, so there are no links. No login is needed.

### Presto Music

The ISRCs come from Presto's streaming app, which shares the shop's product numbers, so a shop link works too, on a CD as on a download. An album Presto doesn't stream has none; the log says so. Presto doesn't say where each disc starts, so a set takes this release's discs in order when it has as many tracks.

### Spotify

Spotify's ISRCs come through a lookup service. Pick it in **⚙ Setup**; switch if one is down or throttled:

- **[Harmony](https://harmony.pulsewidth.org.uk)**, the default, gives them by disc and position, with each track's length.
- **[molla](https://isrc.mollamusicgroup.com)** maps the album's ISRCs by position when its track count matches the release, otherwise by title and artist. Its shared quota often runs out.
- **[ISRC Hunt](https://isrchunt.com)** gives them by disc and position.

### Beatport

An import reads the Beatport release in a background tab. A Beatport release page you open is read too.

### Qobuz

Outside the countries Qobuz serves, its ISRCs need a Qobuz login: sign in under [Platform Check](../platform_check/README.md) (*⚙ Setup → Auth → Qobuz account*). The login works from anywhere, and ISRC Scout and Credit Hoarder share it; only its token is kept, never the password.

How each provider is read is in [DEVELOP.md](DEVELOP.md).
