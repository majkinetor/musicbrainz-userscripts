# Event Horizon <img src="icon.svg" align="left" width="48">

MusicBrainz, past the point of no return: release, release group, artist, label, recording, work, area, instrument, place, series and event pages redesigned around what you came for.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/event_horizon/event_horizon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/event_horizon/event_horizon.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[The viewer](#the-viewer)** takes over a release, release group, artist, label, recording, work, area, instrument, place, series or event page, and moves between them without reloading.
- **Pinned header**: once the page's header scrolls away, a slim bar at the top keeps its cover, title, artist and action row in reach; click the title to go back up.
- **[Sections](#sections)**: a button in the page's action row jumps to, folds, reorders or hides each part of the page.
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
- **Annotation** and, for a release group, **Cover art** open from Edit's menu (point at Edit); a release group's cover also offers **Set cover art** when you point at it. Both forms stay MusicBrainz's, in Event Horizon's look.
- **A page seen before** shows at once from what Event Horizon kept of it, then is checked with MusicBrainz in the background, and redrawn if anything changed. Back and Forward return to where you were on the page.
- While a page loads, the other scripts' background requests to MusicBrainz wait, so the page you asked for comes first.
- If a page can't load, **Retry**, or **Show MusicBrainz's page**.

## Sections

Click **Sections** (the list icon beside Search, top right) to open the list. Click a section to jump to it; the last row folds every section, or opens them all again. The order and what is hidden are remembered.

## Tracks and platforms

Open a track to see its recording and work credits. The platforms it is on (Spotify, Apple Music, Tidal, …) show as icons; point at one for its URL. A site without an icon of its own shows two letters of its domain.

**Release credits** include artists and labels, with track credits alongside. The **Release group** section shows its external links as provider icons too; click a provider's dot or right-click its icon to see multiple links.

Which platforms show, in which order, and how big, are in the settings' **Platforms** tab.

## Releases and discography

A release group lists its releases, and an artist or label its discography, grouped by type, albums first. Switch between a grid of covers and a table; click a table's column to sort it.

A recording shows its length, ISRCs and credits, its works beside them with their writers, and the releases it appears on. A work shows its writers, ISWCs and other codes, related works, and its recordings in a table by first release.

The funnel icon opens a filter: type part of a title, or add a filter by artist, year and so on. Esc clears it.

Every table's filter (the discography, the releases, an instrument's releases, a work's recordings and so on) also takes `column:value`, such as `artist:elvis`; put the value in quotes when it has spaces. The funnel next to a column's heading starts one for that column.

## Settings

Right-click the corner icon. Changes apply at once; **Reset to defaults** undoes them all.

| Setting                   | Default                                                             |                                                                            |
| ------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Release → Info            | released, labels, barcode, length, links                            | the facts shown beside the cover                                           |
| Release → Under the cover | Other covers, Rating, Genres                                        | what shows under the cover                                                 |
| Platforms → Show          | off                                                                 | **Names** beside the icons; **Gray icons** until pointed at                |
| Platforms → Icon size     | 22px                                                                | the size of a platform icon                                                |
| Platforms → Platforms     | Spotify, Apple Music, Tidal, Qobuz, Deezer, YouTube Music           | click to show or hide, drag to reorder; the rest go behind +N              |
| Artist → Images from      | Discogs, Wikipedia, Deezer, Spotify, Tidal, Apple Music, SoundCloud | click to turn one off or on, drag to reorder; the first one found is shown |
| General → Page width      | Medium                                                              | how wide the page grows on a big screen                                    |

## Shortcuts

| Key         | Where                           |                   |
| ----------- | ------------------------------- | ----------------- |
| Esc         | filter                          | clear it          |
| Esc         | a menu                          | close it          |
| Right-click | corner icon                     | open the settings |
| Right-click | a track                         | fold its disc     |
| Right-click | a section                       | fold the section  |
| Right-click | a platform icon with more links | open its links    |
