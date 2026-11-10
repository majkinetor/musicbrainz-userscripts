# Event Horizon <img src="icon.svg" align="left" width="48">

MusicBrainz web pages redesigned to produce clean modern interface with theming support, automatic light/dark theme switch and String Theory members seamless integration.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/event_horizon/event_horizon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/event_horizon/event_horizon.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[The viewer](#the-viewer)** takes over a page, moves between pages without reloading, and keeps the page's identity and actions in reach while scrolling.
- **[Header menu](#header-menu)**: choose the actions, their order and which belong in More.
- **[Background effects](#background-effects)**: Hexagons, Tron, Stars, Aurora and Rain, each with its own controls, over a background: the cover, a glow, generated artwork or any picture from the web.
- **[Sections](#sections)**: all data, an entity's facts and external links included, in cards that can be reordered, hidden and configured.
- **[Aliases](#aliases)**: edit aliases together and fetch an artist's names from Discogs.
- **[Starred entities](#starred-entities)** keeps favorite entities on the homepage.
- **[Collections](#collections)** adds or removes an entity from your MusicBrainz collections.
- **[Recently opened](#recently-opened)** lists the pages you opened last on the homepage, with your choice of view, number and entity types.
- **[Tracklist](#tracklist)**: each track's credits and its streaming links, with platforms deduplicated.
- **[Releases and discography](#releases-and-discography)** as a grid or a table whose columns you choose, order and resize, grouped by type, with a filter, and with filters and columns saved by name.
- **[Edit history](#edit-history)** groups edits and votes on a whole group at once.
- **[Pending changes](#pending-changes)** marks what has edits open.
- **[Keyboard shortcuts](#keyboard-shortcuts)**: single keys open an entity's edit, relationships, history and other pages, on MusicBrainz's page and in the viewer; **Ctrl+/** lists them and changes them.
- **[Other scripts](#other-scripts)** can put their launchers in the header's **More (⋯)** menu.

Also on board: artist, label, release, release group and area images, a configurable homepage, inline tag and alias editing, an Aliases page with an artist's credits, infinite scroll, advanced filtering and grouped edit history.

## The viewer

When MB page has Event Horizon redesign available, EH dock button shows on the native page and clicking it replaces native interface. A link to another EH page opens in place without native navigation. **Already visited page** shows at once with the last data Event Horizon kept of it, then is checked with MusicBrainz in the background, and redrawn if anything changed (while this happens EH icon at top,right is animated). While a page loads, the other scripts' background requests to MusicBrainz wait, so the page comes first.

- **Pictures**: an artist's or label's comes from its linked sites, including Bandcamp and YouTube Music (click for the next, the source icon opens a thumbnail gallery to choose an image, grouping matching photos into one thumbnail with clickable source icons beneath it; cycling uses the same distinct photos), and when none was found, Retry image asks them again; an area's is its Wikidata map with the flag; a place's its Commons or Wikidata image; an event's its front from the Event Art Archive.
- **History** groups a release's edits, and MusicBrainz's other edit lists, into bursts; **a single edit** opens with its changes under the release it touches.
- **Art**, the cover-art page and the add-cover-art page alike, holds Art Station's gallery under the release's title; an event's event-art and add-event-art pages hold it under the event's.
- **Covers**: click a release's cover, thumbnail or Artwork image to view all its covers full screen in Art Station gallery.
- **Relate**, the release's relationship editor, stays MusicBrainz's but takes Event Horizon's look; its regions and tracks fold like cards.
- **Long titles**: a subtitle after a colon or dash sits smaller on its own line, long titles shrink, and very long ones stop at four lines with **Show full title**. Every page header follows this, and titles in grids, tables and track lists stop at three lines.
- **Search**: start a search with a type's letter and a space to search that type: `w yesterday` searches works for "yesterday". On the homepage the type switches as soon as you type the space, and the letter leaves the box. The letters are **a** artist, **g** release group, **r** release, **w** work, **s** series, **p** place and **e** editor; the homepage's type list shows them beside the types. An empty search shows them in a tip instead of searching. Recent searches in the search field's list show only the chosen type's.
- **Pinned headers**: once the page's header scrolls away, a single bar keeps its cover, title and artist in reach; section headers are pinned to as you scroll.

## Header menu

Open **Settings → Menu**. Drag an item's handle to reorder it, use its eye icon to show or hide it, and choose **Main** or **More**. Both lists follow that order, including items brought out of More. Only actions available on the current page appear; Search, Star and Home stay in the header.

**Show menu titles** displays text beside the main menu icons. Turn off an item’s **Title** toggle to keep only its icon there. More always shows titles, including in pinned headers. **Responsive** brings items from More into the main menu when they fit. Items that no longer fit return to More; narrow pinned bars keep the actions there too. Compatible scripts registered on the page appear in the same settings table.

**Restore defaults** resets the menu order, visibility, placement, titles and Responsive setting.

## Background effects

Under **Settings → Effects**, add a **Background** and as many **Effects** as you like, stacked over it; each is a badge you select to show its settings, and its × removes it alone. Each effect keeps its own parameters when you switch effects. **Preset** saves the whole configuration by name: **Save** keeps a change in the preset (and a new name typed over it), **+** saves it as a new preset and leaves the old one as it was, and a built-in preset is kept as shipped (**+** copies it). A preset with unsaved changes lights up **Save** (**+** for a built-in one). **Copy as JSON** and **Import from JSON** in the preset list share a preset. Every effect has its own **Opacity**, which sets its strength, **Glow**, which sets how far the soft light spreads, and **Colour**: **One tone** uses the theme's accent, **Two-tone** adds its second accent, **All** gives each light its own colour, and **User** uses colours you pick. With User, a **Colours** row lists them: click a swatch to change it, its × to remove it, and **Add** for another, as many as you like.

| Effect   | Controls                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tron     | Outlines, Grid size, Riders, Speed, Trail length                                                                                 |
| Stars    | Density, Drift, Depth, Twinkle                                                                                                   |
| Aurora   | Style, Diffuse, Ribbons, Speed, Height, Folds                                                                                    |
| Rain     | Amount, Drop size, Sliding, Trails, Merging, Fog, Refraction, Lights, Lights opacity, Falling rain, Lightning (flashes a minute) |
| Hexagons | Motion, Outlines, Effect, Pace, Trail, How often, Glow, Colour, Depth                                                            |

**Background** is **Cover aura** (the page's cover, blurred behind its head), **Glow** (the accent colour), **Artwork** or **Image**:

- **Cover aura** sets its **Opacity**, **Blur** (less shows the cover's shapes, more only its colours), **Saturation** and **Height**, how far down the page it reaches before it fades.
- **Glow** sets its **Strength**, **Size** and **Place** (Left, Centre or Right along the top).
- **Artwork** is drawn by Event Horizon. **Scene** picks Chillwave (a city at sunset over a neon grid), Nebula, Low poly or Bokeh, and **Shuffle** draws the same scene anew.
- **Image** shows a picture from the web: paste its address (right-click a picture, _Copy image address_) and press Enter or the tick. An address that doesn't load says so.

Both take the same image effects: **Opacity**, **Blur**, **Brightness**, **Saturation**, **Tone** (Natural, Mono, Sepia, or Accent in the theme's accent colour), **Fit** (Fill crops it to the page, Whole shows all of it, Tile repeats it) and **Vignette**, which fades the edges into the page. A preset saves the background with its effects.

**Tron**: Outlines sets the grid strength (0% hides it), Grid size the circuit spacing, Riders their count, Speed their pace and Trail length how far the light follows. Riders choose new turns at junctions. Hitting another rider’s trail destroys the rider in a small burst of sparks; a replacement appears elsewhere after a short pause.

**Stars**: Density sets the star count, Drift their movement, Depth the difference in size and pace, and Twinkle their shimmer.

**Aurora**: Style chooses Rays, Velvet curtains, Polar haze or Wide veil. Diffuse softens any style, with 0% leaving its natural edges. Ribbons sets the curtain count, Speed their movement, Height their reach and Folds their ripples.

**Rain**: rain on a window behind the page, with blurred city lights in the theme's colours beyond it. Each drop shows the lights behind it upside down, as real drops do. Amount sets how many drops land on the glass and Drop size how big they are. Sliding sets how soon and how fast heavy drops run down; Trails the small drops they leave behind (Off, Sparse or Beaded); Merging lets a sliding drop swallow the drops it touches. Fog mists the glass, and sliding drops wipe clear lines through it that slowly fog over again. Refraction sets how strongly drops bend the light, Lights how many lights shine beyond the glass (Off leaves only the dark), Falling rain adds rain beyond the window, and Lightning flashes now and then. Rain has no Glow.

Motion pauses in a hidden tab and respects reduced motion.

While you tune an effect, move the mouse off the settings window to see the whole page: the window fades out and comes back when the mouse returns to it. **Fade this window when the mouse leaves it**, at the bottom of the Effects tab, turns this off.

## Sections

All data is arranged in sections that can be collapsed, hidden or reordered using main menu item. Card state is remembered for given entity. Specific cards have additional options at the right side.

Click a card header, group or row to open or fold it. Right-click it, or its contents, to open or fold its siblings together. In the tracklist, tracks are siblings within a disc; right-click a card header to fold all cards into a contents list.

## Aliases

The pencil beside an entity's aliases opens the [bulk alias editor](../apollo_editor/README.md#aliases). The **Aliases** page offers the same editor.

The heading shows the alias count as a badge and pulses while edits are being submitted.

Use **文** beside Locale to recognize one alias's language; right-click it to fill all empty locales. **Auto-detect locale** fills them while you type or import names. Existing choices are kept and uncertain names stay empty. Review the guesses before **Enter edit**.

**×** beside a set locale clears it and its primary mark. It stays empty until you change the alias name or explicitly recognize locales again. Alias work is kept in Apollo's latest log.

Long aliases and sort names wrap within their columns. For an artist with a Discogs external link, **Fetch from Discogs** fills new rows with its name variations and aliases, removing Discogs' trailing numbers such as `(3)`, skipping names already present and adding the source to the edit note. Each imported row has a Discogs icon that opens its source. Review or remove the rows before **Enter edit**: Discogs aliases can represent separate MusicBrainz artists.

## Starred entities

Select the star in an entity's header to keep it on the homepage; select it again to remove it. On the homepage, point at an entry and select its star to remove it. Show stars grouped by entity type, as a list, a grid or a table; click a table heading to sort it. The table shows when each star was added, when known. Stars and the chosen view travel with your userscript manager's settings. Use the header's export/import button to save stars to a file or add stars from one.

## Collections

Click the entity-type label above its title to open **Collections**. The menu shows your own and collaborative collections for that type, including private collections. Select an entry to add or remove the entity in the background. **Add to a new collection** opens MusicBrainz's collection form with the entity selected.

The list is kept for your next visit. **Refresh collections** checks for changes made elsewhere. You must be signed in to MusicBrainz.

## Recently opened

The homepage lists the pages you opened last, as a list by default. The buttons in the section's header offer the same views as starred entities, and its table shows when you last opened each entry. The settings button beside them chooses how many entries to keep and which entity types to keep; a type you turn off stops being recorded and its entries leave the section. Your choices travel with your userscript manager's settings.

## Tracklist

Open a track to see its recording and work credits. The recording and work icons after a track's title copy its MBID; Ctrl-click or middle-click opens it. The platforms it is on (Spotify, Apple Music, Tidal, …) show as icons. Icons in collapsed track follow tracklist section configuration - select favorite platforms to show and let others be hidden in a submenu (all are shown in expanded track). Multiple links from the same platform are deduplicated to reduce noise; such platform icons contain a dot and can be right clicked to show the link list for that platform.

The tracklist has convenient options in header to toggle visibility of its columns. The **Artist** column, each track's artist, shows by itself on a Various Artists release and where most tracks have guests, and Show › Artist changes it for that release; with **Artist column by itself** off in the tracklist's settings, Show › Artist is one choice for every release. **Credits display** can be configured in expanded track regarding disambiguation and role/name grouping (choice is remembered).

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

## Edit history

Choose **Bursts**, **Day**, **Editor**, **Type** or **Status** to group edits. Each group’s **Yes**, **No**, **Abstain** and **None** buttons apply to its loaded edits you can vote on; **None** withdraws your votes. The number beside **Vote** counts eligible edits. A status filter limits the group vote to the edits shown. Changing votes on more than 20 edits asks for confirmation. You can still vote on individual edits.

A collection’s edit list starts with other editors’ edits. **All edits for this collection** includes your own; **Others’ edits for this collection** hides them.

## Pending changes

With _Show pending changes_ on in settings, titles, tracks, credits and links with edits open are marked in grey, as on MusicBrainz. A person with two credits, one of them pending, has both marked.

## Keyboard shortcuts

On an entity's page, in the viewer or on MusicBrainz's own page, a key opens one of its pages; a few work on any page. **Ctrl+/** lists the commands: type to find one, **Enter** runs it, and clicking a command's key and pressing another changes it (**Backspace** leaves it without one, **Default keys** puts them all back). Keys do nothing while you type in a field.

| Key    | Opens                                        |
| ------ | -------------------------------------------- |
| O      | the entity's page                            |
| E      | Edit                                         |
| R      | Edit relationships                           |
| C      | Cover art (a release)                        |
| H      | Editing history                              |
| T      | Tags                                         |
| D      | Details                                      |
| A      | Aliases                                      |
| V      | toggles Event Horizon                        |
| Ctrl+H | back                                         |
| Ctrl+L | forward                                      |
| S      | search: the viewer's box, else MusicBrainz's |
| P      | your profile                                 |
| .      | MusicBrainz's home page                      |
| ,      | the settings (String Theory's, with it)      |
| Ctrl+/ | this list                                    |

## Other scripts

Compatible scripts appear under **More (⋯)** in the page header and pinned bar. Select an item to launch its script. A script working on its own table can temporarily suspend Event Horizon's shortcuts and hide the corner launchers until its window closes.

> [!NOTE]
> Authors can use the [menu-item protocol](DEVELOP.md#external-menu-items) and [coexistence conventions](../../DEVELOP.md#interoperability).

## Settings

**Auto-detect locale** in the [alias editor](#aliases) defaults off and remembers whether empty locales should be recognized automatically.

Right-click the corner icon. Changes apply at once.

| Setting                               | Default                                                   |                                                                                             |
| ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Release → Info                        | released, labels, barcode, length, links                  | the facts shown beside the cover                                                            |
| Release → Under the cover             | Other covers, Rating, Genres                              | what shows under the cover                                                                  |
| Tracklist → Tracks                    | Alternating colors, Artist column by itself               | shade every other track; the [Artist column](#tracklist) per release                        |
| Platforms → Show                      | off                                                       | **Names** beside the icons; **Gray icons** until pointed at                                 |
| Platforms → Icon size                 | 22px                                                      | the size of a platform icon                                                                 |
| Platforms → Platforms                 | Spotify, Apple Music, Tidal, Qobuz, Deezer, YouTube Music | click to show or hide, drag to reorder; the rest go behind +N                               |
| Artist → Artist images                | all sources                                               | click to turn one off or on, drag to reorder; the first one found is shown                  |
| Annotation → Show annotation on hover | on                                                        | preview a folded annotation                                                                 |
| General → Page width                  | Wide                                                      | how wide the page grows on a big screen                                                     |
| Effects → Preset                      | none                                                      | an effect with its settings, saved by name; shared as JSON from its list                    |
| Effects → Effects                     | Background: Cover aura                                    | a **Background** (none is flat) and an **Effect** over it; select one for its settings      |
| Effects → Effect                      | None                                                      | [background effects](#background-effects), each with its own settings                       |
| Effects → Fade this window            | on                                                        | the window fades while the mouse is away from it                                            |
| Menu → Show menu titles               | off                                                       | text beside icons in the main menu                                                          |
| Menu → Responsive                     | off                                                       | brings items from More into the main menu when space allows                                 |
| Menu → Items                          | all visible                                               | drag to order, use the eye to show or hide, toggle Title, choose Main or More               |
| General → Pending changes             | off                                                       | mark what has edits open; takes one extra MusicBrainz request per page, sent last           |
| General → Keyboard shortcuts          | on                                                        | the keys below; [keyboard shortcuts](#keyboard-shortcuts); **Change keys** opens their list |

Motions: Static, Drift, Tide, Twinkle, Ripple, Lantern (follows the pointer), Electricity and Neural. Pick Hexagons in the Effects tab and its settings follow; the ones the motion doesn't take (Pace, Trail, How often, Glow, a two-tone Colour) are greyed out. **Depth** scrolls the hexagons slower than the page. All respect reduced motion.

To keep an effect you like, type a name beside **Preset** and click **Save** (or press Enter). Later changes go into it only when you click **Save** again; **+** keeps them as a new preset instead. **Preset** then picks it back, and **Delete** removes the one shown. With [String Theory](../string_theory/README.md#theme), each theme can bring its own preset.

## Shortcuts

| Key         | Where                           |                     |
| ----------- | ------------------------------- | ------------------- |
| Esc         | filter                          | clear it            |
| Esc         | a menu                          | close it            |
| Right-click | alias or tag pencil             | open its page       |
| Right-click | corner icon                     | open the settings   |
| Right-click | a card, group or row            | toggle its siblings |
| Right-click | a platform icon with more links | open its links      |
| Click       | the entity icon in the header   | copy the MBID       |
| Right-click | a release or recording's icon   | send it to Picard   |

## Notes

- The log of a page where you voted or added an edit note, or where something went wrong, is kept in this browser, so it can still be read after the page reloads: the log window lists the last 10, by date and page. **Clear history** deletes Event Horizon's.
- How Event Horizon uses the network, and how it shares MusicBrainz with the other scripts: [Network usage](DEVELOP.md#network-usage).
