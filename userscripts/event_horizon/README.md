# Event Horizon <img src="icon.svg" align="left" width="48">

MusicBrainz, past the point of no return: release, release group, artist, label, recording, work, area, instrument, place, series and event pages redesigned around what you came for.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/event_horizon/event_horizon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/event_horizon/event_horizon.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[The viewer](#the-viewer)** takes over a release, release group, artist, label, recording, work, area, instrument, place, series or event page, and moves between them without reloading.
- **[Pinned header](#pinned-header)** keeps the page's identity and actions in reach while scrolling.
- **[Sections](#sections)**: a button in the page's action row jumps to, folds, reorders or hides each part of the page.
- **[Details](#details)** shows an entity's identifiers, update date and data links.
- **[Tracks and platforms](#tracks-and-platforms)**: each track's credits and its streaming links, by icon.
- **[Releases and discography](#releases-and-discography)** as a grid or a table, grouped by type, with a filter.

## The viewer

Event Horizon shows its own page for each of these, and for search results. A link to another such page opens in place. The round corner icon switches back to MusicBrainz's page; right-click it for the settings.

- **Pictures**: an artist's or label's comes from its linked sites (click for the next, the badge opens its source); an area's is its Wikidata map with the flag; a place's its Commons or Wikidata image; an event's its front from the Event Art Archive.
- **Areas, instruments and places** list what is in, uses or happened at them.
- **Series** list their parts in the columns their type needs (release groups, releases, recordings, works, artists or events); **events** show their date, time, who played, and their setlist.
- **Search results** keep MusicBrainz's columns, with the score as a bar.
- **History** groups a release's edits, and MusicBrainz's other edit lists, into bursts; **a single edit** opens with its changes under the release it touches.
- **Art**, the cover-art page and the add-cover-art page alike, holds Art Station's gallery under the release's title; an event's event-art and add-event-art pages hold it under the event's.
- **Relate**, the release's relationship editor, stays MusicBrainz's but takes Event Horizon's look; its regions and tracks fold like cards.
- **Annotation** opens from **More**; a release group's **Cover art** opens from Edit's menu (point at Edit), and its cover also offers **Set cover art** when you point at it. Both forms stay MusicBrainz's, in Event Horizon's look.
- **A page seen before** shows at once from what Event Horizon kept of it, then is checked with MusicBrainz in the background, and redrawn if anything changed. Back and Forward return to where you were on the page.
- While a page loads, the other scripts' background requests to MusicBrainz wait, so the page you asked for comes first.
- If a page can't load, **Retry**, or **Show MusicBrainz's page**.

## Pinned header

Once the page's header scrolls away, a single bar keeps its cover, title and artist in reach. On a release, the release-group icon and edition count follow the artist, then the format, type and status. The action icons keep their horizontal position when the bar appears. Click the title to go back up.

## Sections

Click **Sections** (the list icon beside Search, top right) to open the list. Click a section to jump to it; the last row folds every section, or opens them all again. The order and what is hidden are remembered.

## Details

Open **More** (the three dots in the header) → **Details** for all of an entity's detail fields, including its MBID, last update and data links. More also holds **Annotation** and **Tags** where available. The page uses Event Horizon's header and a card for MusicBrainz's details. The back arrow returns to the overview.

## Tracks and platforms

Open a track to see its recording and work credits. The platforms it is on (Spotify, Apple Music, Tidal, …) show as icons; point at one for its URL. A site without an icon of its own shows two letters of its domain.

Click a card header, group or row to open or fold it. Right-click it, or its contents, to open or fold its siblings together. In the tracklist, tracks are siblings within a disc; right-click a card header to fold all cards into a contents list.

**Credits** include artists and labels, with track credits alongside. The **Release group** section shows its external links as provider icons too; click a provider's dot or right-click its icon to see multiple links.

The gear beside the tracklist's **Show** toggles sets alternating track colors and which platforms show, in which order, and how big. Click a platform to show or hide it, drag it to reorder.

Which facts the header shows (rating, aliases and tags among them), and whether other covers show, are set with the gear at the right end of the header's divider line. On an artist's or label's page that gear sets which facts show and where the picture comes from.

## Releases and discography

A release group lists its releases, and an artist or label its discography, grouped by type, albums first. Switch between a grid of covers and a table; click a table's column to sort it.

Click **Releases** in the header (the disc in its case) on an artist, country/area, label, recording, instrument or place. These tabs use the same release cards, format buttons, filter and view controls as other release lists: grid, horizontal row, by format, or sortable table. The funnel filters the releases on the current page; MusicBrainz's filters and pagination stay available. The view is remembered. The back arrow returns to the overview.

A recording shows its length, ISRCs and credits, its works beside them with their writers, and the releases it appears on. A work shows its writers, ISWCs and other codes, related works, and its recordings in a table by first release.

The funnel icon opens a filter: type part of a title, or add a filter by artist, year and so on. Esc clears it.

Every table's filter (the discography, the releases, an instrument's releases, a work's recordings and so on) also takes `column:value`, such as `artist:elvis`; put the value in quotes when it has spaces. The funnel next to a column's heading starts one for that column.

## Settings

Right-click the corner icon. Changes apply at once; **Reset to defaults** undoes them all.

| Setting                   | Default                                                             |                                                                            |
| ------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Release → Info            | released, labels, barcode, length, links                            | the facts shown beside the cover                                           |
| Release → Under the cover | Other covers, Rating, Genres                                        | what shows under the cover                                                 |
| Tracklist → Tracks        | Alternating colors                                                  | shade every other track                                                    |
| Platforms → Show          | off                                                                 | **Names** beside the icons; **Gray icons** until pointed at                |
| Platforms → Icon size     | 22px                                                                | the size of a platform icon                                                |
| Platforms → Platforms     | Spotify, Apple Music, Tidal, Qobuz, Deezer, YouTube Music           | click to show or hide, drag to reorder; the rest go behind +N              |
| Artist → Artist images    | Discogs, Wikipedia, Deezer, Spotify, Tidal, Apple Music, SoundCloud | click to turn one off or on, drag to reorder; the first one found is shown |
| General → Page width      | Wide                                                                | how wide the page grows on a big screen                                    |
| General → Menu titles     | off                                                                 | text beside menu icons in page headers and pinned bars                     |

## Shortcuts

| Key         | Where                           |                     |
| ----------- | ------------------------------- | ------------------- |
| Esc         | filter                          | clear it            |
| Esc         | a menu                          | close it            |
| Right-click | corner icon                     | open the settings   |
| Right-click | a card, group or row            | toggle its siblings |
| Right-click | a platform icon with more links | open its links      |
