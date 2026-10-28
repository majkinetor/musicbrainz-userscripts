# Mission Control <img src="icon.svg" align="left" width="48">

One window on a release page that asks the other scripts what the release is missing, lets you review everything they found in one place, and applies it in one go.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mission_control/mission_control.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mission_control/mission_control.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Via+Mission+Control)

<img src="./screenshots/main.png" />

> [!IMPORTANT]
> Mission Control finds and applies nothing on its own: each step is done by another script, which has to be installed. [String Theory](../string_theory/README.md) has them all.

## Features

- **[Probe](#probe)**: one click asks every script what is missing, and each card fills in as its answer comes.
- **[Tracks](#tracks)**: a row per track with its ISRCs, recording links, duplicate recordings and credits.
- **[Release and entity links](#release-and-entity-links)**: the platform pages found for the release, its artists and its labels.
- **[Compare with the platforms](#compare-with-the-platforms)**: read the release on its platforms and add what it lacks: a barcode, labels and catalog numbers, a release event, track lengths.
- **[Cover art](#cover-art)**: the best cover found, beside the current front, and Art Station's gallery, to add, order and type the other images Discogs and Amazon have.
- **[Release credits](#release-credits)**: what the credit sources have, with a way into Credit Hoarder.
- **[Inspector](#inspector)**: everything found for one track.
- **[Execute](#execute)**: applies what you selected, script by script, in a fixed order.
- **[Consolidate a new release](#consolidate-a-new-release)**: compare an album across the platforms and take the best of each into the release editor, or into the release MusicBrainz already has.

Open Mission Control with its corner icon on a release page. On a phone it fills the screen in one column.

## Probe

**↻** in the header asks every script at once. The header and the **Execution order** on the left show each step as it works: what it is doing, and how long since it last reported. A step that stays silent turns amber.

| Step                     | Script                                        | Finds                                                  |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| Release and entity links | [Platform Check](../platform_check/README.md) | platform pages for the release, its artists and labels |
| Platforms                | [First Contact](../first_contact/README.md)   | what the release lacks, from the platforms' own pages  |
| ISRCs & recording links  | [ISRC Scout](../isrc_scout/README.md)         | ISRCs and track links                                  |
| Cover art                | [Art Station](../art_station/README.md)       | a better front cover, and the stores' other images     |
| Merge suggestions        | [Fusion](../fusion/README.md)                 | duplicate recordings in the release group              |
| Credits                  | [Credit Hoarder](../credit_hoarder/README.md) | per-track credits                                      |

Platforms, Fusion and Credit Hoarder are slow, so each has a switch under its step: **Auto** fetches during the probe, **Ask** waits for its button in the Tracks header (**Compare**, **Fetch RG**, **Fetch credits**), **Off** leaves it out. Platforms starts on Auto, Fusion and Credit Hoarder on Ask.

Click a step in the header to switch it off for this page, right-click to switch it off for good; click it again to switch it back on. The format icon left of the release title shows or hides the Execution order.

The album links you select in the Release and entity links card are passed on to ISRC Scout before they are added, so the tracks get their links from those albums too.

## Tracks

One row per track, a column per script: the ISRCs and recording links ISRC Scout found, what the platforms give for the track ([Compare with the platforms](#compare-with-the-platforms)), the duplicates Fusion grouped with the recording, and how many credits Credit Hoarder has. ISRCs are shown in parts, `US-AM1-85-74817`, unless ISRC Scout's *Show ISRCs in parts* is off.

The Tracks header counts the changes taken in and on how many tracks; each track with one has a bar on its left.

Click a finding to take it in or leave it out; new findings start taken in. A click elsewhere in a row shows the track in the [Inspector](#inspector).

To take in or leave out many at once, hold a key while you click: the others follow the one you click.

| Click with | Takes                                                    |
| ---------- | -------------------------------------------------------- |
| Ctrl       | the whole track                                          |
| Alt        | the whole column; on a found link, that platform's links |
| Ctrl+Alt   | everything in the table                                  |

Found links take the same keys with a right-click. Press on an ISRC or a duplicate and drag up or down the column to do the same to every one you pass.

Fusion's count opens its group card under the row, as on Fusion's board: the star picks the recording the others merge into, ✎ writes the edit note, and Fusion's icon opens the group in Fusion. **Execute** merges the groups taken in. **Expand all** / **Collapse all** in the header open or fold every track's comparison and [platform versions](#compare-with-the-platforms).

## Release and entity links

The platform pages Platform Check found, grouped by the barcode each platform gives: the release's own barcode first, in green, then the others, then the platforms that gave none.

| Mark     | Means                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| new      | found and not on the release; taken in                                                                         |
| linked   | the release already has it                                                                                     |
| withheld | held back by [link confidence](../platform_check/README.md#link-confidence); take it in by hand if it is right |
| unsure   | may be another artist or label; take it in by hand if it is right                                              |

A link whose track count or format is not the release's is most likely another release: its icon gets an amber dot, and its row says what differs in amber (*10 tracks, the release has 13*). **take all in** leaves those links out; click one to take it in anyway.

A new link found without the release's barcode matched on its track count alone, so it starts left out and [First Contact](../first_contact/README.md) reads it on every probe. It is then taken in, unless fewer than half its track lengths match (*another tracklist*, even with the same titles) or, without lengths, no title does. A platform First Contact can't read (Spotify) stays left out.

A release without a barcode gets a **Barcode** row for each barcode the platforms report. The one Platform Check is sure of starts taken in: one you pasted, one a consolidation brings ([Update this release](#update-this-release)), or one from a link the release already has, with its track count and medium. Taking another in leaves the first out.

Catalog numbers the platforms give, for a label the release has without one, sit beside their group's barcode: one per label in a group with a barcode, maybe several in the group without. Only the one in the release's own group, from a platform with its track count and medium, starts taken in; **take all in** never takes one, and a label takes one at a time.

**Artists** and **Labels** list the pages the matched albums name for them. A page MusicBrainz has on another artist or label is withheld, its row naming both with their disambiguations, so you can tell a wrong one from a duplicate. A heading's ✓ count lists the links it already has.

After [Compare with the platforms](#compare-with-the-platforms), *Release* also has a row for the **Release event** and one for the **Track lengths**, when the release lacks them.

Execute adds the links through [Falcon](../falcon/README.md), listing each with its status; **Open Falcon** shows why one failed, to retry.

## Compare with the platforms

**Compare**, in the Platforms column of Tracks, reads the release on its platforms with [First Contact](../first_contact/README.md#consolidate), on every probe while its step is **Auto**.

1. It reads the release's links, and the ones found with its barcode or, without one, with as many tracks. Another barcode, track count, format or [tracklist](#release-and-entity-links) is another release, left out. Spotify's data isn't compared.
2. For each field, the value most platforms give wins, as in a consolidation.
3. What the release lacks is offered where it is added, taken in:

| What                | Offered when                                                 | Shown in                                    |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Barcode             | the release has none                                         | Release and entity links                    |
| Label, cat. no.     | as in [Update this release](#update-this-release)            | Release and entity links                    |
| Platform links      | the release hasn't them, even ones Platform Check holds back | Release and entity links                    |
| Release event       | the release has none: the date and country most give         | Release and entity links                    |
| Track lengths       | a track has none                                             | Release and entity links, and the track row |
| ISRCs               | a track has none                                             | ISRCs                                       |
| Track title, length | you take a platform's, or type your own                      | the row under the track                     |
| Title               | the platforms give another                                   | shown only, never changed                   |

Nothing the release has changes unless you take it. Tracks are compared only when the platforms have as many as the release. The Platforms column shows a length to add (*+ 4:01*) *≠ title* when the platforms call the track something else, *≠ case* when only its capitals differ (*✓* when they agree); either opens its versions under the row, the differing part marked. Click a title or length to take it, or type your own on the track's line (Enter keeps it, Esc reverts). **Aa** takes the title as [Guess case](../apollo_editor/README.md#guess-case) writes it; *the recording too* renames the recording as well; **↺** reverts the track. The column then shows what the track gets (*→ Title · → 5:02*).

Execute adds the release event, the track lengths and the titles and lengths you took with the barcode, labels and links, in one edit of the release, through [Falcon](../falcon/README.md). A track that changed on MusicBrainz since you compared keeps what it has.

## Cover art

Art Station looks for the largest cover on the release's platforms, the album links taken in included, and looks again when those change. The best cover shows beside the current front, each with its size, and what Execute will do with it underneath.

Each platform searched shows its cover's size (click to open it) or *no cover*. A release without a front starts with the cover taken in.

### Gallery

Under the front is [Art Station's gallery](../art_station/README.md#gallery) for the release, doing all it does there.

Discogs and Amazon have every image of a release. The gallery ends with **More images**, a row per store, larger images first; stores with one image each share a row. **＋ take in** on an image, or **＋ take all in** on a row, adds them after the covers, untyped. An image the release already has says *in archive*, and one equal to the best front or a larger image says which (*= Amazon 1*); such duplicates can't be taken in.

Taking the best front's platform in or out puts the best cover, and the removal of the front it replaces, in the gallery or out; your own changes there win. **Execute:** under the gallery lists what Execute will do there.

Execute enters what the gallery holds; an image MusicBrainz refused shows its error, with **Retry**.

An upload that fails is repeated as Art Station's [auto-repeat](../art_station/README.md#applying-changes) setting says, and the card shows each attempt.

## Release credits

Credit Hoarder's count of credits for each track, from every credit source the release links (Discogs, Qobuz, Deezer, Apple Music). Mission Control only shows them: **Import credits** opens Credit Hoarder on the release's relationship editor with that source, or with all of them, to review and add them there.

## Inspector

Click a track to see, on the right, everything found for it: its ISRCs and where they came from, its recording links (and which are already in MusicBrainz), Fusion's matches, its credits, and its versions on the platforms, with what differs from its title highlighted.

## Execute

**Execute** applies what is taken in, in the Execution order (steps on one line together), counting it on the button. A failed step doesn't stop the next.

First it lists what it will send, under each step. ISRC Scout's changes are a grid: a row per track, in the tracklist's order, and a column for the ISRCs and one per platform. **All tracks** selects or unselects the whole grid, a track's box its row, a column's platform icon that platform on every track (dimmed when off); each cell shows the ISRC, or the link's id with the whole address on hover. Art Station lists only the cover it enters. Unselect a line to leave it out, then **Execute**, or **Cancel**. **Copy as Markdown** copies the selected changes, grouped the same way. A right-click on **Execute** skips the list, and so does the Execute that runs itself [after a consolidation](#consolidate-a-new-release). *Review the changes before Execute* in the settings turns the list off. The list fills the screen.

Every edit note ends with *Via Mission Control v&lt;version&gt;* and the release.

A failed step that can be tried again shows **Retry** beside its error; what got through before shows as done.

Click a card's icon or title to switch it off: Execute leaves it out, and your selection waits for it.

The log of a page with an Execute in it is kept in this browser, so it can still be read after the page reloads: the log window lists the last 10, by date and release. **Clear history** deletes Mission Control's.

## Consolidate a new release

For an album MusicBrainz doesn't have yet. On its page on a platform, **Consolidate** in [First Contact](../first_contact/README.md#consolidate) reads it and opens Mission Control over MusicBrainz's empty release editor:

1. [Platform Check](../platform_check/README.md) finds the album on the other platforms. **Sources** groups them by barcode: the album's own lane first and taken in, with those without a barcode that have as many tracks; another lane is another release, left out until you select it. If MusicBrainz already has the album (same barcode, format and track count), a banner lists it, compared with this album: date, format, tracks and barcode in columns, with the platforms linked to it. Its title opens it in a new tab; [Update](#update-this-release) updates it. **Other editions** under it, closed until clicked, highlight what sets each apart.
2. First Contact reads each platform taken in. One without a barcode whose track lengths mostly differ is unselected as *another tracklist*, unless you selected it. Spotify's link is added but its data isn't compared.
3. **Release** shows each field's values with the platforms giving them; the most given is taken (a tie goes by Platform Check's order). Click another to take it. Where another value differs from the one taken, the differing part is highlighted.
4. **Tracks** lines the tracklists up. A track whose platforms differ in title, ISRC or length (by over a second) says how many versions it has; click it to see them and take one. **N differ** opens or closes them all. A track only one platform has is left out; click it to take it in, at the end.
5. **Add release** opens the release editor in this tab with what is taken: the fields, the tracklist and ISRCs, every taken platform's link, and each artist's pages for [Apollo Editor](../apollo_editor/README.md#artist-matching) to match by.

<img src="./screenshots/consolidate.png" />

Once saved, Mission Control opens on the release and probes for what the editor can't take: the ISRCs and recording links (ISRC Scout), the best cover (Art Station), and the artist and label links (Platform Check). **After saving** chooses which start taken in. With *…and Execute once the probe has finished*, Execute runs itself after a countdown on the button, 10 seconds unless set otherwise; a click stops it.

A click on a section's heading opens or closes it; a right-click opens every section when one is closed, and closes them all otherwise.

A track's versions show on the right too. **▾ → Copy as Markdown** beside **Add release** copies the comparison as tables. **✕** shows the editor under it; the corner icon brings Mission Control back.

### Update this release

**Update**, in the banner, opens that release here; Mission Control probes and [compares it with the platforms](#compare-with-the-platforms) at once, offering what it lacks as after saving a new release, but Execute never runs by itself. What you picked by hand isn't carried over.

[First Contact](../first_contact/README.md#already-in-musicbrainz) offers it too, when MusicBrainz already has the album you are about to import: the release opens in a new tab, compared with the platforms and with that album, though the release has neither its link nor its barcode.

A label with another catalog number keeps it. A new label is added with its catalog number when Mission Control can tell which MusicBrainz label it is: by its page on the platform, or, marked unsure, by a name only one label has. The edit note names the platforms read.

## Settings

| Setting                                                         | Default |                                                                                 |
| --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| Probe as soon as Mission Control opens                          | on      | no need to click ↻                                                              |
| Review the changes before Execute                               | on      | lists what Execute will send first; a right-click on Execute skips it           |
| Reload the release page after an Execute without errors         | on      | shows the result at once; waits until every added link is through               |
| After saving a consolidated release, open Mission Control on it | on      | [probes the new release](#consolidate-a-new-release) for what it lacks          |
| …and Execute once the probe has finished                        | off     | then applies what is taken in, after a countdown (10 s by default) you can stop |
| Show track differences by default                               | off     | a consolidation opens every track that differs into its versions                |

## Shortcuts

| Key         | Where               |                                                        |
| ----------- | ------------------- | ------------------------------------------------------ |
| right-click | a link in a row     | take it in or leave it out, instead of opening it      |
| Ctrl / Alt  | a click in Tracks   | the whole track / the whole column ([Tracks](#tracks)) |
| drag        | ISRCs or duplicates | take in or leave out every one you pass                |
| ← →         | a cover full screen | the other cover                                        |
| right-click | Execute             | execute without the review                             |
| right-click | the corner icon     | settings                                               |
