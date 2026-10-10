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
- **[Cover art](#cover-art)**: the best cover found, beside the current front.
- **[Release credits](#release-credits)**: what the credit sources have, with a way into Credit Hoarder.
- **[Inspector](#inspector)**: everything found for one track.
- **[Execute](#execute)**: applies what you selected, script by script, in a fixed order.

Open Mission Control with its icon in the bottom-right corner of a release page. Right-click the icon for the settings.

## Probe

**↻** in the header asks every script at once. The header and the **Execution order** on the left show each step as it works: what it is doing, and how long since it last reported. A step silent for 20 s turns amber.

| Step                     | Script                                        | Finds                                                  |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| Release and entity links | [Platform Check](../platform_check/README.md) | platform pages for the release, its artists and labels |
| ISRCs & recording links  | [ISRC Scout](../isrc_scout/README.md)         | ISRCs and track links                                  |
| Cover art                | [Art Station](../art_station/README.md)       | a better front cover                                   |
| Merge suggestions        | [Fusion](../fusion/README.md)                 | duplicate recordings in the release group              |
| Credits                  | [Credit Hoarder](../credit_hoarder/README.md) | per-track credits                                      |

Fusion and Credit Hoarder are slow, so each has a switch under its step: **Auto** fetches during the probe, **Ask** (the default) waits for its **Fetch** button in the Tracks header, **Off** leaves it out.

The album links you select in the Release and entity links card are passed on to ISRC Scout before they are added, so the tracks get their links from those albums too.

## Tracks

One row per track, a column per script: the ISRCs and recording links ISRC Scout found, the duplicates Fusion grouped with the recording, and how many credits Credit Hoarder has.

Click a finding to take it in, and again to leave it out; what is taken in is tinted and ticked. New findings start taken in. A link inside a row only opens it. A click anywhere in a track's row also shows it in the [Inspector](#inspector).

Fusion's count opens what Fusion compared under the row: each recording's artist, release, length, ISRCs, AcoustIDs and open edits, with what differs marked. Once Fusion answers, it looks up the ISRCs and AcoustIDs of each group by itself, one group at a time, and the comparisons fill in as they come. Fusion's icon beside it (*Open in Fusion*) shows the group on Fusion's board. **Expand all** in the Tracks header opens every track's comparison, and **Collapse all** folds them.

## Release and entity links

The platform pages Platform Check found, grouped by the barcode each platform gives: the release's own barcode first, in green, then the others, then the platforms that gave none.

| Mark     | Means                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| new      | found and not on the release; taken in                                                                         |
| linked   | the release already has it                                                                                     |
| withheld | held back by [link confidence](../platform_check/README.md#link-confidence); take it in by hand if it is right |
| unsure   | may be another artist or label; take it in by hand if it is right                                              |

A link whose track count or format is not the release's is most likely another release: its icon gets an amber dot, and its row says what differs in amber (*10 tracks, the release has 13*). **take all in** leaves those links out; click one to take it in anyway.

A release without a barcode gets a **Barcode** row at the top of *Release* for each barcode the platforms report, each saying where it came from. The one Platform Check is sure of starts taken in: a barcode you pasted, or one reported by a link the release already has, whose track count and medium match the release. A release has one barcode, so taking another in leaves the first out. Execute adds it with the links, in the same edit.

**Artists** and **Labels** list the pages the matched albums name for them. The platforms that found nothing fold into one line of icons. A heading's ✓ count opens the links it already has into rows.

The links are added through [Falcon](../falcon/README.md), out of sight. The card lists each one with its status as it goes; when one fails, **Open Falcon** shows why and lets you retry.

## Cover art

Art Station looks through the platforms the release links for the largest cover, and shows it beside the current front with each one's size. What Execute will do is written under it: enter it as the front and remove the current one, add it beside the current fronts, or nothing when the front already is that cover.

A release without a front cover starts with the cover taken in. Click either image to see both full screen, with **←** **→** between them.

## Release credits

Credit Hoarder's count of credits for each track, from every credit source the release links (Discogs, Qobuz, Deezer, Apple Music). Mission Control only shows them: **Import credits** opens Credit Hoarder on the release's relationship editor with that source, or with all of them, to review and add them there.

## Inspector

Click a track to see, on the right, everything found for it: its ISRCs and where they came from, its recording links (and which are already in MusicBrainz), Fusion's matches and its credits.

## Execute

**Execute** in the header applies what is taken in, step by step in the Execution order; the steps on one line run together. The count on the button is what will be sent. Each card shows its progress, and a step that fails doesn't stop the next one.

Every edit note ends with *Via Mission Control v&lt;version&gt;* and the release.

Click a card's icon or title to switch the card off: it folds to its header, and Execute leaves out what is taken in there. Your selection stays for when you switch it on again.

## Settings

| Setting                                                 | Default |                                                                   |
| ------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Probe as soon as Mission Control opens                  | off     | no need to click ↻                                                |
| Reload the release page after an Execute without errors | off     | shows the result at once; waits until every added link is through |

## Shortcuts

| Key         | Where               |                                                   |
| ----------- | ------------------- | ------------------------------------------------- |
| right-click | a link in a row     | take it in or leave it out, instead of opening it |
| ← →         | a cover full screen | the other cover                                   |
| right-click | the corner icon     | settings                                          |
