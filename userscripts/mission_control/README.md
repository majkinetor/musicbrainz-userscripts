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

Open Mission Control with its icon in the bottom-right corner of a release page. Right-click the icon for the settings.

On a phone it fills the screen in one column: the steps scroll sideways under the release, the execution order and the inspector come after the cards, and a wide table scrolls inside its card.

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

Platforms, Fusion and Credit Hoarder are slow, so each has a switch under its step: **Auto** fetches during the probe, **Ask** (the default) waits for its button in the Tracks header (**Compare**, **Fetch RG**, **Fetch credits**), **Off** leaves it out.

Click a step in the header to switch its script off: it isn't asked, its card and column go, and Execute leaves it out. Click it again to switch it back on; Fusion and Credit Hoarder get back the switch they had. This is remembered for the next release. The format icon left of the release title shows or hides the Execution order.

The album links you select in the Release and entity links card are passed on to ISRC Scout before they are added, so the tracks get their links from those albums too.

## Tracks

One row per track, a column per script: the ISRCs and recording links ISRC Scout found, what the platforms give for the track ([Compare with the platforms](#compare-with-the-platforms)), the duplicates Fusion grouped with the recording, and how many credits Credit Hoarder has. ISRCs are shown in parts, `US-AM1-85-74817`, unless ISRC Scout's *Show ISRCs in parts* is off.

The Tracks header counts the changes taken in and on how many tracks; each track with one has a bar on its left.

Click a finding to take it in, and again to leave it out; what is taken in is tinted and ticked. New findings start taken in. A click anywhere else in a track's row also shows it in the [Inspector](#inspector); a click on a finding or a badge only shows it there when the Inspector is already open.

To take in or leave out many at once, hold a key while you click: the others follow the one you click.

| Click with | Takes                                                    |
| ---------- | -------------------------------------------------------- |
| Ctrl       | the whole track                                          |
| Alt        | the whole column; on a found link, that platform's links |
| Ctrl+Alt   | everything in the table                                  |

Found links take the same keys with a right-click. Press on an ISRC or a duplicate and drag up or down the column to do the same to every one you pass.

Fusion's count opens what Fusion compared under the row: each recording's artist, release, length, ISRCs, AcoustIDs and open edits, with what differs marked. The comparisons fill in as their ISRCs and AcoustIDs come. Fusion's icon beside it (*Open in Fusion*) shows the group on Fusion's board. **Expand all** in the Tracks header opens every track's comparison (and the platforms' titles, [below](#compare-with-the-platforms)), and **Collapse all** folds them.

## Release and entity links

The platform pages Platform Check found, grouped by the barcode each platform gives: the release's own barcode first, in green, then the others, then the platforms that gave none.

| Mark     | Means                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| new      | found and not on the release; taken in                                                                         |
| linked   | the release already has it                                                                                     |
| withheld | held back by [link confidence](../platform_check/README.md#link-confidence); take it in by hand if it is right |
| unsure   | may be another artist or label; take it in by hand if it is right                                              |

A link whose track count or format is not the release's is most likely another release: its icon gets an amber dot, and its row says what differs in amber (*10 tracks, the release has 13*). **take all in** leaves those links out; click one to take it in anyway.

A release without a barcode gets a **Barcode** row at the top of *Release* for each barcode the platforms report, each saying where it came from. The one Platform Check is sure of starts taken in: a barcode you pasted, the one a consolidation brings ([Update this release](#update-this-release)), or one reported by a link the release already has, whose track count and medium match the release. A release has one barcode, so taking another in leaves the first out. Execute adds it with the links, in the same edit.

The catalog numbers the platforms give, for a label the release has without one, sit beside the barcode of their group. A group with a barcode is one release, so it shows one per label; a platform in it that gives none just didn't say. The group without a barcode can show several, since its platforms may be different releases. Click one to take it in or leave it out; **take all in** never takes a catalog number. Only the one in the release's own group starts taken in, and only from a platform with the release's track count and medium (a CD with the digital release's barcode doesn't count), and a label takes one, so taking another in leaves the first out.

**Artists** and **Labels** list the pages the matched albums name for them. The platforms that found nothing fold into one line of icons. A heading's ✓ count opens the links it already has into rows.

After [Compare with the platforms](#compare-with-the-platforms), *Release* also has a row for the **Release event** and one for the **Track lengths**, when the release lacks them.

The links are added through [Falcon](../falcon/README.md), out of sight. The card lists each one with its status as it goes; when one fails, **Open Falcon** shows why and lets you retry.

## Compare with the platforms

**Compare**, in the Platforms column of Tracks, reads the release on its platforms with [First Contact](../first_contact/README.md#consolidate), as [Consolidate](#consolidate-a-new-release) does for an album MusicBrainz doesn't have yet. Set its step to **Auto** to compare on every probe.

1. It reads the platforms Platform Check has for the release: the links it already has and the ones found with its barcode, and those without a barcode that have as many tracks. A link with another barcode, track count or format is another release, and is left out. Spotify can be read on its own page only, so its link counts but its data isn't compared.
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

Nothing the release has is changed unless you take it. The tracks are compared one by one only when the platforms have as many as the release. The Platforms column shows each track's length to add (*+ 4:01*), and *≠ title* when the platforms call it something else (*✓* when they agree). Either opens, under the row, what the platforms give for the track: a line per version (title, with the part that differs marked, length and ISRC), the platforms that give it on the right. A click on a title or length there takes it in, and the track's own line above them holds what the track gets: type there for a title or length of your own (Enter keeps it, Escape puts it back). **Aa** beside the title shows, on hover, the title as Guess case writes it in the release's language, and a click takes that in; it's the same Guess case as [Apollo's](../apollo_editor/README.md#guess-case). *the recording too* gives the recording the new title as well; **↺** reverts the track. The column then shows what the track gets (*→ Title · → 5:02*), and Execute counts it. **Expand all** opens these rows, where a title or a length differs, with Fusion's comparisons. The [Inspector](#inspector) shows the track's versions too. Platform Check's card names the platforms read, and the release's title if the platforms give another.

Execute adds the release event, the track lengths and the titles and lengths you took with the barcode, labels and links, in one edit of the release, through [Falcon](../falcon/README.md). A track that changed on MusicBrainz since you compared keeps what it has.

## Cover art

Art Station looks for the largest cover on the platforms the release links, and on the album links taken in under *Release and entity links*, which Execute adds first: take one in or leave it out and it looks again. It shows the best cover beside the current front, with each one's size. What Execute will do is written under it: enter it as the front and remove the current one, add it beside the current fronts, or nothing when the front already is that cover.

Each platform searched shows how large its own cover is on the right, or *no cover*; click the size to open that cover. A release without a front cover starts with the cover taken in. Click either image to see both full screen, with **←** **→** between them.

### Gallery

Under the front, the card shows [Art Station's gallery](../art_station/README.md#gallery) for the release, with everything it does there: drag covers into order, set types and comments, remove, rotate, view full screen. When the gallery would take more than two rows, the card is two columns wide.

Discogs and Amazon have every image of a release: the back, the medium, the booklet. The gallery puts the others at its end under **More images**, a row for each store (the one with the larger images first); the stores that give one image each, like every store of a digital release with its front, share one row, the largest first, to pick one from. Hover an image and click **＋ take in**, or click **＋ take all in** beside a store with several, to add them after the covers, then drag them where they go. Full screen on one goes through its own row. The stores don't say what an image is, so nothing starts typed. An image that is the same picture as a cover the release already has says *in archive*, even one just entered; one that is the same as the best front or as a larger image says which (*= Amazon 1*). Such a duplicate can't be taken in: it has no **＋ take in** and no type, and **＋ take all in** leaves it out, saying how many it takes when it leaves some, *＋ take all in (3)*. Taking in waits until the comparison is done.

Taking the best front's platform in or out on the card puts the best cover in the gallery or leaves it out (waiting in *More images*), and with it the removal of the smaller front it replaces. What you change in the gallery wins over that. Under the gallery, **Execute:** lists what Execute will do there, and Execute counts it.

Execute enters what the gallery holds: Art Station's own **Enter edit** isn't shown. An image MusicBrainz didn't take shows its error on the card, with **Retry**.

An upload that fails is repeated as Art Station's [auto-repeat](../art_station/README.md#applying-changes) setting says, and the card shows each attempt.

## Release credits

Credit Hoarder's count of credits for each track, from every credit source the release links (Discogs, Qobuz, Deezer, Apple Music). Mission Control only shows them: **Import credits** opens Credit Hoarder on the release's relationship editor with that source, or with all of them, to review and add them there.

## Inspector

Click a track to see, on the right, everything found for it: its ISRCs and where they came from, its recording links (and which are already in MusicBrainz), Fusion's matches, its credits, and its versions on the platforms, with what differs from its title highlighted.

## Execute

**Execute** in the header applies what is taken in, step by step in the Execution order; the steps on one line run together. The count on the button is what will be sent. Each card shows its progress, and a step that fails doesn't stop the next one.

Every edit note ends with *Via Mission Control v&lt;version&gt;* and the release.

A step that failed and can be tried again (a cover upload or ISRC submit that kept failing, say) shows **Retry** beside its error: it applies that step alone again, with what is still taken in. What a step got through before it failed shows as done, and leaves the count.

Click a card's icon or title to switch the card off: it folds to its header, and Execute leaves out what is taken in there. Your selection stays for when you switch it on again.

## Consolidate a new release

For an album MusicBrainz doesn't have yet. On its page on a platform, **Consolidate** in [First Contact](../first_contact/README.md#consolidate) reads it and opens Mission Control over MusicBrainz's empty release editor:

1. [Platform Check](../platform_check/README.md) finds the album on the other platforms. **Sources** on the left groups them by barcode, the album's own first. The platforms in its lane are taken in, and so are those without a barcode that have as many tracks. A platform in another lane is another release, so it is left out until you tick it. If MusicBrainz already has this album (a release one of these links belongs to, with the same barcode, format and track count), a banner at the top names it, with [Update this release](#update-this-release), so you add what it lacks instead of adding the album again. Releases the links belong to that differ in one of those are listed under it as other editions.
2. First Contact reads each platform taken in; the header counts them. Spotify can be read on its own page only, so its link is added but its data isn't compared.
3. **Release** shows each field with the platforms that give each value; those that give none follow on the value's line, greyed. The value most of them give is taken, and a tie goes to Platform Check's platform order. Click another value to take it instead; the other dates are listed earliest first, in two columns.
4. **Tracks** lines the tracklists up. A track the platforms agree on shows their icons. One where they differ in title, ISRC or length (by more than a second) says how many versions it has: click it to see them, and click a version to take it. **N differ** in the header opens or closes them all. A track only one platform has is struck through and left out; click it to take it in, at the end.
5. **Add release** opens MusicBrainz's release editor in this tab with what is taken: the fields, the tracklist with its ISRCs, every taken platform's link, and each artist's pages on all the platforms read, which [Apollo Editor](../apollo_editor/README.md#artist-matching) tries when it matches the artists. A link of a platform that wasn't read (Spotify, or one whose read failed) gets the type Platform Check adds it with.

<img src="./screenshots/consolidate.png" />

Once you save the release, Mission Control opens on it and probes, for what the editor can't take: the ISRCs taken here and the recording links (added by ISRC Scout), the best cover (Art Station), and the artist and label links (Platform Check). **After saving**, on the right, chooses which of them start taken in; **Execute** then applies them as on any release. With *…and Execute once the probe has finished* on in the settings, Mission Control presses Execute itself once every script has answered, after a 5-second countdown on the button: click the button to stop it. With nothing taken in there is no countdown.

Click a track to see its versions on the right, with what sets each apart from the taken one highlighted and the platforms that give it; click a version there to take it. **Copy as Markdown**, in the **▾** menu beside **Add release**, copies the whole comparison as tables, for an issue or an edit note. **✕** shows the empty editor under it; the corner icon brings Mission Control back.

### Update this release

**Update this release**, beside a release in the banner, opens that release in this tab. Mission Control opens on it, probes, and [compares it with the platforms](#compare-with-the-platforms) at once, whatever its step's switch says. The release reads the platforms itself, so what was picked by hand here isn't carried over. It offers what the release lacks, and the cover and artist links as after saving a new release; **After saving** chooses which scripts' findings start taken in.

A label with another catalog number keeps it. A label the release hasn't is added with its catalog number once Mission Control knows which MusicBrainz label it is: by the label's page on the platform, or, marked unsure, by a name only one MusicBrainz label has. A label it can't tell is left out. The edit note names the platforms read.

## Settings

| Setting                                                         | Default |                                                                        |
| --------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Probe as soon as Mission Control opens                          | on      | no need to click ↻                                                     |
| Reload the release page after an Execute without errors         | on      | shows the result at once; waits until every added link is through      |
| After saving a consolidated release, open Mission Control on it | on      | [probes the new release](#consolidate-a-new-release) for what it lacks |
| …and Execute once the probe has finished                        | off     | then applies what is taken in, after a countdown you can stop          |

## Shortcuts

| Key         | Where               |                                                        |
| ----------- | ------------------- | ------------------------------------------------------ |
| right-click | a link in a row     | take it in or leave it out, instead of opening it      |
| Ctrl / Alt  | a click in Tracks   | the whole track / the whole column ([Tracks](#tracks)) |
| drag        | ISRCs or duplicates | take in or leave out every one you pass                |
| ← →         | a cover full screen | the other cover                                        |
| right-click | the corner icon     | settings                                               |
