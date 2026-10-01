# ISRC Scout <img src="icon.svg" align="left" width="48">

Shows a release's ISRCs, fills in the missing ones from several providers, and finds and manages its recordings' streaming and store links.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/isrc_scout/isrc_scout.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/isrc_scout/isrc_scout.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=76&conditions.0.args=78&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=ISRC+Scout)

![screenshot](./screenshots/isrc.png)

## Features

- **[ISRC badge](#isrc-editor)** by the release title, showing how many tracks lack an ISRC.
- **[ISRC editor](#isrc-editor)**: every track's ISRCs, with validation, provider [imports](#importing-isrcs), [per-track lookups](#per-track-lookup), bulk paste, export and deletion.
- **[Links](#links)**: find and add the recordings' streaming and store links, and end or remove existing ones.
- **[Providers](#providers)** found through the release group and [Platform Check](../platform_check/README.md), not just the release's own links.

## Providers

| Provider | ISRC import | Track links | Resolved by |
|---|:---:|:---:|---|
| Deezer | ✓ | ✓ | ISRC, on any release |
| Tidal | ✓ | ✓ | ISRC, on any release |
| Beatport | ✓ | ✓ | the album, matched by ISRC |
| Volumo | ✓ | ✓ | the album, matched by ISRC |
| Qobuz | ✓ | ✓ | the album; ISRCs by position, links by ISRC |
| Apple Music | ✓ | ✓ | the album; by position (+ title for links) |
| SoundCloud | ✓ | ✓ | the set (a track URL counts as a one-track release); by position (+ title for links) |
| Spotify | ✓ | ✓ | ISRCs through [a lookup service](#spotify); links from the album, by position + title |
| Bandcamp | | ✓ | the album page, by position + title |
| YouTube Music | | ✓ | the album, when linked (by position + title); else ISRC, on any release |
| Amazon Music | | ✓ | the album, when linked (by position + title) |
| HDtracks | ✓ | | the album |
| SoundExchange | ✓ | | a title and artist search |

**YouTube Music** shows no ISRCs. When the release links its YouTube Music album (Platform Check finds it), each track is taken from that album's tracklist, by position and title. Otherwise its ISRC is searched. An ISRC it doesn't know brings up unrelated songs instead of nothing, and labels sometimes reuse an ISRC for another version of a song with the same title and length: [JP92Q2400507](https://musicbrainz.org/isrc/JP92Q2400507) is both *メズマライザー* and its *Critical Damage ver.* So a search result counts only when it is official audio (not a user upload), has the track's title, is within 3 s of its length, and comes from this release's album. The log names every result it skipped, and why. The edit note names each link's YouTube Music album, since a song's URL no longer says which album it was once it is delisted. Links are added as *free streaming*.

**Amazon Music** shows no ISRCs either, and has no ISRC search, so its track links come only from the release's Amazon Music album, when the release links it (Platform Check finds it by name). Each track is taken from the album's tracklist by position, or by title when the album orders it differently, and only when the title matches and the length is within 3 seconds. It is read as a guest, with no Amazon account, and the links are added as *streaming page*.

An album-based provider needs the release's album link: already in MusicBrainz, found by Platform Check, or pasted with **(+)**. No login is needed anywhere except Qobuz outside the countries it serves (see [Qobuz](#qobuz)).

> [!WARNING]
> Album imports map tracks by position and trust the link: provider titles legitimately differ (*feat.*, *remaster*). A fill whose length is more than 10 s off is kept but marked amber, and counted as *⚠ N implausible*. An album with more tracks than the release is flagged as a likely wrong edition. Check the amber rows before submitting.

## ISRC editor

Click the **ISRC** badge (`✓ 12/12`, or `⚠ 9/12` pulsing when some are missing). Each track shows its ISRCs and an input for a new one: red is invalid, orange a duplicate, green good.

### Importing ISRCs

The toolbar shows the providers available for this release:

<img width="800" src="./screenshots/toolbar.png" />

| Icon | Comes from |
|---|---|
| circled | the release's own links |
| plain | [Platform Check](../platform_check/README.md) |
| blue dot | another release in the group (option *Use providers from the whole release group*) |

**(+)** imports from any album URL you paste. **⟳ SoundExchange** searches every track by title and artist, fills the confident matches, and shows the other candidates per row; it searches 30 tracks at a time, so click a *Not searched* row to continue. Deezer, which needs a request per track, fetches 50 at a time the same way.

> [!NOTE]
> A Platform Check link withheld for a barcode or format mismatch isn't used, because the mismatch may mean it's a different release altogether. *Ignore Platform Check link confidence* uses it anyway; a wrong track count always excludes it.

### Per-track lookup

<img width="1000" src="./screenshots/isrc-tracks.png" />

- **+1** fills the previous track's ISRC plus one.
- The **lookup** button looks the row's ISRC up on the selected provider and shows its title, artist and length next to the row, mismatches in red. Guests don't count as a mismatch: a *feat.* clause is left out of both titles, and when the credits differ only the main artist has to match, since databases list guests differently. Its menu switches every row to another provider; right-click runs it on all tracks.
- **All** (top of the menu) checks the row's ISRCs on every provider available for the release at once (not SoundExchange, which serves a captcha on nearly every run): the entered one and every ISRC the recording already has. The row shows a verdict: **✓ 4/4** when every provider that knows the ISRC agrees, **⚠ 1/4** when some don't, **– 0/4** when none knows it. Hover the verdict (or the row's **All** button) to see the comparison next to it (right of the verdict, or above the row when there's no room there, so the rows below stay free); move down either column to walk the tracks, click the verdict to pin it so you can select text. Clicking one of its ISRCs pins it too, and the comparison stays where it is. Each line starts with the provider's verdict:
  - Deezer and Tidal look the ISRC up: ✓ their song for it is this track, ⚠ it is another song.
  - An album provider (Qobuz, Apple, Beatport…) reads the release's album there: ✓ it has this ISRC at the same position as this track (📍), or at another position (↪ track 3: the album orders its tracks differently). Deezer and Tidal can't say where: they only look the ISRC up. When the album hasn't the ISRC at all, ✗ it has **another** ISRC at this track's position, offered with **use**. An ISRC that belongs to another track of the release, or that the row already has, is never offered.
  - The header lists the row's ISRCs first, then any other ISRC a provider named, each with how many providers have it for this track. The comparison shows the row's first ISRC; click another of the row's to see what the providers say about that one, or an ISRC a provider named to see only the providers that name it. **copy** puts the comparison on the clipboard as a Markdown table (provider, track, length, note; the ISRC is in its heading, and in the note where an album has another one).
  - **All** is also the last button in the toolbar, when the release has more than one provider: it checks every track, as a right-click on a row's **All** does.
- **⚙** opens a SoundExchange search you can tune (title, artist, release, exact), with a link to run it on their site.

| Check | Mismatch when |
|---|---|
| Title, artist | the words don't match (a couple of extra words, like a version, are fine) |
| Year | recorded after the release year (+1) |
| Length | more than 10 s off; MusicBrainz's length is shown alongside |

A result passing every check fills an empty field (blue); a length mismatch only warns (yellow). Lookups don't run while you type: only when you leave a field you typed into, press the button, or run the SoundExchange search. A SoundExchange captcha or rate limit shows in the toolbar; solve it there and continue.

### Paste, export, delete

- **Paste** one ISRC per line in track order (an empty line skips a track), or address tracks: `3=USABC1234567`, `USABC1234567 | 1.3`, `1.3 USABC1234567`. Then *Apply to empty fields* or *Apply (overwrite)*.
- **Export** as text or JSON (`{ recordingMBID: "ISRC" }`), to the clipboard.
- Tick existing ISRCs and **🗑 Delete checked**: one *Remove ISRC* edit each, through your logged-in session.

### Submitting

Submitting ISRCs needs OAuth once: **⚙ Setup → Authorize**, approve in the tab that opens. Then **Submit to MusicBrainz**. *Sign out* forgets the token.

## Links

The **Links** tab shows, per track, what each recording already links to (**Linked**) and what was found but isn't linked yet (**Add**). Linked shows every provider, including ones ISRC Scout can't add (YouTube, Amazon Music, any host).

<img width="1000" src="./screenshots/links.png" />

**🔗 Find links** resolves every track on every available provider, in parallel. A Deezer track that no longer plays anywhere is not offered. **➕ Add links** adds everything found; adding goes through your logged-in session (no OAuth), with ISRC Scout's edit note.

| Click | on an **Add** icon | on a **Linked** icon |
|---|---|---|
| left | open the provider's track | open the provider's track |
| right | add this link | toggle *ended* (shown faded) |
| Ctrl + right | add every link on the track | end every link on the track |
| Alt + right | add this provider on every track | end this provider on every track |
| middle | | remove this link |
| Ctrl / Alt + middle | | remove on the track / this provider everywhere |

End a link when the release is taken down and it no longer resolves ([MusicBrainz style](https://musicbrainz.org/doc/Style/Relationships/URLs#When_to_remove)). Ending and removing work on any linked provider.

> [!TIP]
> Editions are often split by platform: one carries Deezer, another Spotify. With *Use providers from the whole release group* on, a provider missing here is taken from a sibling release (it shares the recordings) and marked with a purple dot.

## Settings

<img width="1000" src="./screenshots/options.png" />

| Setting | Default | |
|---|---|---|
| Authorize | | OAuth for submitting ISRCs |
| Import buttons | icons | icons, text, or both |
| Use providers from the whole release group | off | take missing providers from sibling releases (one more lookup) |
| Ignore Platform Check link confidence | off | use links Platform Check withheld for a barcode or format mismatch |
| Spotify ISRC source | molla | or ISRC Hunt |

## Shortcuts

| Key | |
|---|---|
| Esc | close the open panel, else the editor |
| Enter | submit the focused URL input, or run the SoundExchange search |

The mouse gestures on links are in the [Links](#links) table.

## Notes

### Spotify

Spotify's own ISRC API needs a paid developer account, so ISRCs come through a service that looks them up with its own credentials. Pick it in **⚙ Setup**; switch if one is down or throttled:

- **[molla](https://isrc.mollamusicgroup.com)** returns the album's ISRCs in album order. When its track count matches the release they're mapped by position, otherwise by title and artist, and unmatched tracks stay empty. Its quota is shared by all its users, so a burst may need a retry a minute later.
- **[ISRC Hunt](https://isrchunt.com)** returns them by disc and position.

### Beatport

Beatport is behind Cloudflare, so ISRC Scout can't fetch it from MusicBrainz. It also runs on `beatport.com/release/*`: an import opens the release in a background tab, reads the ISRCs there and closes it. A Beatport release page you open yourself is read too, and results are cached.

### Qobuz

Qobuz's `album/get`, the only endpoint with per-track ISRCs, answers anonymously only from countries Qobuz serves; from anywhere else it answers *404* for every album. Signing in under [Platform Check](../platform_check/README.md) (*⚙ Setup → Auth → Qobuz account*) works from anywhere: the login lends its account's region. Platform Check keeps the token (the password is never stored), and ISRC Scout and Credit Hoarder read it. Qobuz rate-limits hard, and a barcode search needs the 13-digit, zero-padded EAN.
