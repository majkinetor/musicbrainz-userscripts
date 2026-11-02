# Event Horizon <img src="icon.svg" align="left" width="48">

MusicBrainz web pages redesigned to produce clean modern interface with theming support, automatic light/dark theme switch and String Theory members seamless integration.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/event_horizon/event_horizon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/event_horizon/event_horizon.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[The viewer](#the-viewer)** takes over a page, moves between pages without reloading, and keeps the page's identity and actions in reach while scrolling.
- **[Sections](#sections)**: all data, an entity's facts and external links included, in cards that can be reordered, hidden and configured.
- **[Starred entities](#starred-entities)** keeps favorite entities on the homepage.
- **[Collections](#collections)** adds or removes an entity from your MusicBrainz collections.
- **[Recently opened](#recently-opened)** lists the pages you opened last on the homepage, with your choice of view, number and entity types.
- **[Tracklist](#tracklist)**: each track's credits and its streaming links, with platforms deduplicated.
- **[Releases and discography](#releases-and-discography)** as a grid or a table whose columns you choose, order and resize, grouped by type, with a filter, and with filters and columns saved by name.
- **[Pending changes](#pending-changes)** marks what has edits open.

Also on board: artist, label, release, release group and area images, a configurable homepage, inline tag and alias editing, an Aliases page with an artist's credits, infinite scroll, advanced filtering and grouped edit history.

## The viewer

When MB page has Event Horizon redesign available, EH dock button shows on the native page and clicking it replaces native interface. A link to another EH page opens in place without native navigation. **Already visited page** shows at once with the last data Event Horizon kept of it, then is checked with MusicBrainz in the background, and redrawn if anything changed (while this happens EH icon at top,right is animated). While a page loads, the other scripts' background requests to MusicBrainz wait, so the page comes first.

- **Pictures**: an artist's or label's comes from its linked sites (click for the next, the badge opens its source), and when none was found, Retry image asks them again; an area's is its Wikidata map with the flag; a place's its Commons or Wikidata image; an event's its front from the Event Art Archive.
- **History** groups a release's edits, and MusicBrainz's other edit lists, into bursts; **a single edit** opens with its changes under the release it touches.
- **Art**, the cover-art page and the add-cover-art page alike, holds Art Station's gallery under the release's title; an event's event-art and add-event-art pages hold it under the event's.
- **Covers**: click a release's cover, thumbnail or Artwork image to view all its covers full screen in Art Station gallery.
- **Relate**, the release's relationship editor, stays MusicBrainz's but takes Event Horizon's look; its regions and tracks fold like cards.
- **Pinned headers**: once the page's header scrolls away, a single bar keeps its cover, title and artist in reach; section headers are pinned to as you scroll.

## Sections

All data is arranged in sections that can be collapsed, hidden or reordered using main menu item. Card state is remembered for given entity. Specific cards have additional options at the right side.

Click a card header, group or row to open or fold it. Right-click it, or its contents, to open or fold its siblings together. In the tracklist, tracks are siblings within a disc; right-click a card header to fold all cards into a contents list.

## Starred entities

Select the star in an entity's header to keep it on the homepage; select it again to remove it. On the homepage, point at an entry and select its star to remove it. Show stars grouped by entity type, as a list, a grid or a table; click a table heading to sort it. The table shows when each star was added, when known. Stars and the chosen view travel with your userscript manager's settings. Use the header's export/import button to save stars to a file or add stars from one.

## Collections

Click the entity-type label above its title to open **Collections**. The menu shows your own and collaborative collections for that type, including private collections. Select an entry to add or remove the entity in the background. **Add to a new collection** opens MusicBrainz's collection form with the entity selected.

The list is kept for your next visit. **Refresh collections** checks for changes made elsewhere. You must be signed in to MusicBrainz.

## Recently opened

The homepage lists the pages you opened last, as a list by default. The buttons in the section's header offer the same views as starred entities, and its table shows when you last opened each entry. The settings button beside them chooses how many entries to keep and which entity types to keep; a type you turn off stops being recorded and its entries leave the section. Your choices travel with your userscript manager's settings.

## Tracklist

Open a track to see its recording and work credits. The recording and work icons after a track's title copy its MBID; Ctrl-click or middle-click opens it. The platforms it is on (Spotify, Apple Music, Tidal, …) show as icons. Icons in collapsed track follow tracklist section configuration - select favorite platforms to show and let others be hidden in a submenu (all are shown in expanded track). Multiple links from the same platform are deduplicated to reduce noise; such platform icons contain a dot and can be right clicked to show the link list for that platform.

The tracklist has convenient options in header to toggle visibility of its columns. **Credits display** can be configured in expanded track regarding disambiguation and role/name grouping (choice is remembered).

Expanded track contains info about associated recording and works.

## Releases and discography

A release group lists its releases, and an artist or label its discography, grouped by type, albums first. Switch between a grid of covers and a table; click a table's column to sort it.

**Columns**, beside the view buttons of a table, chooses what the table shows and in what order, and is remembered for all releases or all discographies. Tick a column to show it, drag its handle or press the arrow keys on it to move it, and Esc during a drag takes the move back. Releases also offer Status, Packaging, Language / script and Comment; +N on the button counts the columns left out. A hidden column still sorts and filters. Links is a column like the others. Drag the edge of a column's heading to resize it: the room comes from the columns beside it, and none goes narrower than its content. Double-click the edge to fit that column to its content; the fit button beside **Columns** lets the table size itself again. **Saved**, at the bottom of the menu, keeps the current columns and their widths under a name; pick the name to bring them back, or **Default** for the usual columns.

The funnel icon opens a filter: type part of a title, or add a filter by artist, year and so on. Esc clears it.

Every table's filter also takes `column:value`, such as `artist:elvis` (put the value in quotes when it has spaces). The funnel next to a column's heading starts filtering for that column. A filter can combine terms:

| Filter                                       |                                                |
| -------------------------------------------- | ---------------------------------------------- |
| `-label:x -label:y`, `-live`                 | exclude what matches                           |
| `year:2022-2024`, `year:2022-`, `year:-2024` | a range of years, or of dates in a date column |
| `label:x OR label:y`                         | either; side by side, terms must all match     |
| `(label:x OR label:y) AND year:2022-2024`    | group with brackets; AND is optional           |
| `-(label:x OR label:y)`                      | exclude a group                                |

Write AND and OR in capitals: lowercase they are ordinary words. The **?** at the end of the box shows all this, with the section's columns.

The arrow at the end of the filter box does the same for a filter: name it and save it, then pick it on any artist or release group. Saving under a name already there replaces it, and × deletes one. Releases and discographies keep their own lists.

## Pending changes

With *Show pending changes* on in settings, titles, tracks, credits and links with edits open are marked in grey, as on MusicBrainz. A person with two credits, one of them pending, has both marked.

## Settings

Right-click the corner icon. Changes apply at once; **Reset to defaults** undoes them all.

| Setting                               | Default                                                             |                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Release → Info                        | released, labels, barcode, length, links                            | the facts shown beside the cover                                                  |
| Release → Under the cover             | Other covers, Rating, Genres                                        | what shows under the cover                                                        |
| Tracklist → Tracks                    | Alternating colors                                                  | shade every other track                                                           |
| Platforms → Show                      | off                                                                 | **Names** beside the icons; **Gray icons** until pointed at                       |
| Platforms → Icon size                 | 22px                                                                | the size of a platform icon                                                       |
| Platforms → Platforms                 | Spotify, Apple Music, Tidal, Qobuz, Deezer, YouTube Music           | click to show or hide, drag to reorder; the rest go behind +N                     |
| Artist → Artist images                | Discogs, Wikipedia, Deezer, Spotify, Tidal, Apple Music, SoundCloud | click to turn one off or on, drag to reorder; the first one found is shown        |
| Annotation → Show annotation on hover | on                                                                  | preview a folded annotation                                                       |
| General → Page width                  | Wide                                                                | how wide the page grows on a big screen                                           |
| General → Menu titles                 | off                                                                 | text beside menu icons in page headers and pinned bars                            |
| General → Pending changes             | off                                                                 | mark what has edits open; takes one extra MusicBrainz request per page, sent last |

## Shortcuts

| Key         | Where                           |                     |
| ----------- | ------------------------------- | ------------------- |
| Esc         | filter                          | clear it            |
| Esc         | a menu                          | close it            |
| Right-click | corner icon                     | open the settings   |
| Right-click | a card, group or row            | toggle its siblings |
| Right-click | a platform icon with more links | open its links      |
| Click       | the entity icon in the header   | copy the MBID       |
| Right-click | a release or recording's icon   | send it to Picard   |

## Notes

- The log of a page where you voted or added an edit note, or where something went wrong, is kept in this browser, so it can still be read after the page reloads: the log window lists the last 10, by date and page. **Clear history** deletes Event Horizon's.
- How Event Horizon uses the network, and how it shares MusicBrainz with the other scripts: [Network usage](DEVELOP.md#network-usage).
