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
| [7digital](#7digital)           |      ✓      |             | the album: each track searched by title                                               |
| SoundExchange                   |      ✓      |             | a title and artist search                                                             |

An album-based provider needs the release's album link: already in MusicBrainz, found by Platform Check, or pasted with **(+)**. No login is needed anywhere except Qobuz outside the countries it serves (see [Qobuz](#qobuz)).

> [!WARNING]
> Album imports map tracks by position and trust the link: provider titles legitimately differ (*feat.*, *remaster*). A fill whose length is more than 10 s off is kept but marked amber, and counted as *⚠ N implausible*. An album with more tracks than the release is flagged as a likely wrong edition. Check the amber rows before submitting.

## ISRC editor

Click the **ISRC** badge (`✓ 12/12`, or `⚠ 9/12` pulsing when some are missing). Each track shows its ISRCs and an input for a new one: red is invalid, orange a duplicate, green good.

ISRCs are shown in their parts, `US-AM1-85-74817`: country, registrant, year and number. A copy is still the plain code, and what you type stays plain. *Show ISRCs in parts* turns it off.

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
- The **lookup** button looks the row's ISRC up on the selected provider and shows its title, artist and length next to the row, mismatches in red. Guests don't count as a mismatch: a *feat.* clause is left out of both titles, and when the credits differ only the main artist has to match, since databases list guests differently. Nor does a typo: a word one letter off (*Les Ecrocs* for *Les Escrocs*), in words of five letters or more, reads as the same song: the lookup marks it ⚠, and **All** counts it with the note *its title is spelled differently*. Its menu switches every row to another provider; right-click runs it on all tracks.
- **All** (top of the menu) checks the row's ISRCs on [every provider](#checking-every-provider) at once.
- **⚙** opens a SoundExchange search you can tune (title, artist, release, exact), with a link to run it on their site.

| Check         | Mismatch when                                                             |
| ------------- | ------------------------------------------------------------------------- |
| Title, artist | the words don't match (a couple of extra words, like a version, are fine) |
| Year          | recorded after the release year (+1)                                      |
| Length        | more than 10 s off; MusicBrainz's length is shown alongside               |

A result passing every check fills an empty field (blue); a length mismatch only warns (yellow). Lookups don't run while you type: only when you leave a field you typed into, press the button, or run the SoundExchange search. A SoundExchange captcha or rate limit shows in the toolbar; solve it there and continue.

### Checking every provider

**All** checks the row's ISRCs on every provider available for the release (not SoundExchange, which serves a captcha on nearly every run): the entered one and every ISRC the recording already has. **All** at the end of the toolbar, or a right-click on a row's **All**, checks every track.

The row shows a verdict: **✓ 4/4** when every provider that knows the ISRC agrees, **⚠ 1/4** when some don't, **– 0/4** when none knows it. Hover the verdict for the comparison, and click it to pin it. Each line starts with the provider's verdict:

- Deezer and Tidal look the ISRC up: ✓ their song for it is this track, ⚠ it is another song.
- An album provider (Qobuz, Apple, Beatport…) reads the release's album there: ✓ it has this ISRC at the same position as this track (📍), or at another position (↪ track 3: the album orders its tracks differently). When the album hasn't the ISRC at all, ✗ it has **another** ISRC at this track's position, offered with **use**. An ISRC that belongs to another track of the release, or that the row already has, is never offered.

The header lists the row's ISRCs first, then any other ISRC a provider named, each with how many providers have it for this track. Click one to see what the providers say about it. **copy** puts the comparison on the clipboard as a Markdown table.

### Paste, export, delete

- **Paste** one ISRC per line in track order (an empty line skips a track), or address tracks: `3=USABC1234567`, `USABC1234567 | 1.3`, `1.3 USABC1234567`. Then *Apply to empty fields* or *Apply (overwrite)*.
- **Export** as text or JSON (`{ recordingMBID: "ISRC" }`), to the clipboard.
- Tick existing ISRCs and **🗑 Delete checked**: one *Remove ISRC* edit each, through your logged-in session.

### Submitting

Submitting ISRCs needs OAuth once: **⚙ Setup → Authorize**, approve in the tab that opens. Then **Submit to MusicBrainz**. *Sign out* forgets the token. test.musicbrainz.org has its own accounts, so it is authorized separately; musicbrainz.org and beta share one authorization. A token MusicBrainz no longer accepts is forgotten, and Setup asks you to authorize again.

## Links

The **Links** tab shows, per track, what each recording already links to (**Linked**) and what was found but isn't linked yet (**Add**). Linked shows every provider, including ones ISRC Scout can't add (YouTube, Amazon Music, any host).

<img width="1000" src="./screenshots/links.png" />

**Find links** resolves every track on every available provider, in parallel. A provider matched by position (Apple Music, Bandcamp, SoundCloud, Audiomack, Spotify, YouTube Music, Amazon Music) must have the track's title there; a typo in it, as above, still counts, and so do a "feat." the platform keeps in the title where MusicBrainz moved it to the artist credit, and an apostrophe written differently. A Deezer track that no longer plays anywhere is not offered. **➕ Add links** adds everything found; adding goes through your logged-in session (no OAuth), with ISRC Scout's edit note.

### Match

**⚡ Match**, at the right of the toolbar after **Find links**, does both steps in one click. It imports ISRCs from the fastest source the release links: one-request sources (Qobuz, Audiomack, Apple Music, Tidal, …) before per-track ones (Deezer, 7digital) and Spotify. If a source fails or gives nothing, it tries the next. Then it runs **Find links** with the ISRCs it found. A link pulled from the release group is skipped, since whether it fits this release needs you to look.

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

The release page's tracklist gets two columns before *Rating*: **ISRC**, each track's ISRCs, and **Links**, its recording's links. An ISRC opens its MusicBrainz page, an icon the provider's track. Each platform shows one icon; when the recording has several links there, a number beside it says how many, its tooltip lists them, and it opens the first one that hasn't ended. An ended link is faded. They follow what you submit and change in the editor. **ISRC** and **Links** above the tracklist, beside MusicBrainz's own *Display credits at bottom*, show or hide each column (struck through when hidden). In the settings, *ISRC column on the tracklist* and *Links column on the tracklist* do the same, and *Column toggles above the tracklist* hides the toggles.

## Settings

**⚙** in the editor's header opens the settings window; a click outside it, or Esc, closes it.

<img width="420" src="./screenshots/options.png" />

| Setting                                    | Default                    |                                                                                |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------ |
| Platforms                                  | all on                     | the platforms ISRC Scout uses ([Platforms](#platforms))                        |
| Authorize                                  |                            | OAuth for submitting ISRCs                                                     |
| Import buttons                             | icons                      | icons, text, or both                                                           |
| ISRC column on the tracklist               | on                         | the ISRC column on the release page ([Tracklist](#tracklist))                  |
| Links column on the tracklist              | on                         | the Links column on the release page                                           |
| Column toggles above the tracklist         | on                         | **ISRC** · **Links** above the tracklist                                       |
| Show ISRCs in parts                        | on                         | `CC-XXX-YY-NNNNN`, here and in [Mission Control](../mission_control/README.md) |
| Use providers from the whole release group | off                        | take missing providers from sibling releases (one more lookup)                 |
| Ignore Platform Check link confidence      | off                        | use links Platform Check withheld for a barcode or format mismatch             |
| Repeat failed submits                      | on, 10 minutes or 10 times | try a submit again when MusicBrainz is busy (503) or the connection drops      |
| Spotify ISRC source                        | molla                      | or ISRC Hunt                                                                   |

### Platforms

**Platforms**, at the top of the settings window, has a switch for each platform ISRC Scout uses, SoundExchange included. A platform switched off loses its import button and its per-track lookup, and Match, Find links and All skip it; links already found on it are dropped. Platform Check keeps its own list, so a platform can be on in one and off in the other.

## Shortcuts

| Key   |                                                               |
| ----- | ------------------------------------------------------------- |
| Esc   | close the open panel, else the editor                         |
| Enter | submit the focused URL input, or run the SoundExchange search |

The mouse gestures on links are in the [Links](#links) table.

## Notes

### YouTube Music

YouTube Music shows no ISRCs. When the release links its YouTube Music album (Platform Check finds it), each track is taken from that album's tracklist by position and title, as official audio, never a music video. A song a free listener can't play (YouTube Premium only, or not available at all) is left out, since the links are added as *free streaming*. Without a linked album, the track's ISRC is searched, and a result counts only when it is official audio (not a user upload), has the track's title, is within 3 s of its length, and comes from this release's album. The log names every result it skipped, and why. A link added on its own names its YouTube Music album in the edit note.

### Amazon Music

Amazon Music shows no ISRCs, so its track links come only from the release's Amazon Music album, when the release links it (Platform Check finds it by name). Each track is taken by position, or by title when the album orders it differently, and only when the title matches and the length is within 3 seconds. No Amazon account is needed, and the links are added as *streaming page*.

### 7digital

No login is needed. Each track of the release is searched for by its title, and the results from the linked 7digital album are kept, which takes some seconds on a long album. A 7digital track has no page of its own, so there are no track links.

### Spotify

Spotify's ISRCs come through a lookup service. Pick it in **⚙ Setup**; switch if one is down or throttled:

- **[molla](https://isrc.mollamusicgroup.com)** maps the album's ISRCs by position when its track count matches the release, otherwise by title and artist. Its quota is shared by all its users, so a burst may need a retry a minute later.
- **[ISRC Hunt](https://isrchunt.com)** gives them by disc and position.

### Beatport

An import opens the Beatport release in a background tab, reads the ISRCs there and closes it. A Beatport release page you open yourself is read too.

### Qobuz

Outside the countries Qobuz serves, its ISRCs need a Qobuz login: sign in under [Platform Check](../platform_check/README.md) (*⚙ Setup → Auth → Qobuz account*). The login works from anywhere, and ISRC Scout and Credit Hoarder share it; only its token is kept, never the password.

How each provider is read is in [DEVELOP.md](DEVELOP.md).
