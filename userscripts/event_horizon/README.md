# Event Horizon <img src="icon.svg" align="left" width="48">

MusicBrainz, past the point of no return: release, release group, artist, label, recording, work, area, instrument and place pages redesigned around what you came for.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/event_horizon/event_horizon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/event_horizon/event_horizon.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[The viewer](#the-viewer)** takes over a release, release group, artist, label, recording, work, area, instrument or place page, and moves between them without reloading.
- **[Sections](#sections)**: a rail at the side jumps to, folds, reorders or hides each part of the page.
- **[Tracks and platforms](#tracks-and-platforms)**: each track's credits and its streaming links, by icon.
- **[Releases and discography](#releases-and-discography)** as a grid or a table, grouped by type, with a filter.

## The viewer

Open a release, release group, artist, label, recording, work, area, instrument or place on MusicBrainz and Event Horizon shows its own page instead. Its subpages (edit, relationships, …) stay MusicBrainz's.

The round icon in the corner switches between Event Horizon's page and MusicBrainz's; right-click it for the settings. A link to another of these pages opens in place.

An artist's picture or a label's logo comes from its Discogs, Wikipedia (its Commons image, Wikidata item or article), Deezer, Spotify, Tidal, Apple Music or SoundCloud link. Click it to see the next one; the badge on its edge opens the page it came from.

An area shows its codes, its parts, its anthem and instruments, what it was the location for, and the artists, labels and places in it. An instrument shows what it is tied to and the artists, releases and recordings that use it. A place shows its area, address and coordinates (with a link to the map), the places, artists and labels tied to it, its events, and the recordings made there.

An area's cover is its map from Wikidata, with its flag in the corner. Click it for the flag, the coat of arms and any other image its Wikidata item has. An area with no Wikidata images keeps the globe. A place's picture is its Wikimedia Commons image, else its Wikidata image or logo.

If a page can't load, **Retry** tries again and **Show MusicBrainz's page** falls back to the original.

## Sections

Point at the rail beside the page to open it. Click a section to jump to it; the last row folds every section, or opens them all again. The order and what is hidden are remembered.

## Tracks and platforms

Open a track to see its recording and work credits. The platforms it is on (Spotify, Apple Music, Tidal, …) show as icons; point at one for its URL. A site without an icon of its own shows two letters of its domain.

Which platforms show, in which order, and how big, are in the settings' **Platforms** tab.

## Releases and discography

A release group lists its releases, and an artist or label its discography, grouped by type, albums first. Switch between a grid of covers and a table; click a table's column to sort it.

A recording shows its length, ISRCs and credits, its works beside them with their writers, and the releases it appears on. A work shows its writers, ISWCs and other codes, related works, and its recordings in a table by first release.

The funnel icon opens a filter: type part of a title, or add a filter by artist, year and so on. Esc clears it.

## Settings

Right-click the corner icon. Changes apply at once; **Reset to defaults** undoes them all.

| Setting                   | Default                                                    |                                                                            |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Release → Info            | released, labels, barcode, length, links                   | the facts shown beside the cover                                           |
| Release → Under the cover | Other covers, Rating, Genres                               | what shows under the cover                                                 |
| Platforms → Show          | off                                                        | **Names** beside the icons; **Gray icons** until pointed at                |
| Platforms → Icon size     | 22px                                                       | the size of a platform icon                                                |
| Platforms → Platforms     | Spotify, Apple Music, Tidal, Qobuz, Deezer, YouTube Music  | click to show or hide, drag to reorder; the rest go behind +N              |
| Artist → Images from      | Discogs, Wikipedia, Deezer, Spotify, Tidal, Apple Music, SoundCloud | click to turn one off or on, drag to reorder; the first one found is shown |
| General → Page width      | Medium                                                     | how wide the page grows on a big screen                                    |

## Shortcuts

| Key         | Where       |                   |
| ----------- | ----------- | ----------------- |
| Esc         | filter      | clear it          |
| Esc         | a menu      | close it          |
| Right-click | corner icon | open the settings |
