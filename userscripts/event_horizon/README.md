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
- **[Player](#player)** plays a release in the page from its streaming links, and can send your listens to ListenBrainz.
- **[Releases and discography](#releases-and-discography)** as a grid or a table whose columns you choose, order and resize, grouped by type (a label's by release group), with a filter, and with filters and columns saved by name.
- **[Edit search](#edit-search)**: every MusicBrainz condition in compact rows, filterable choices and named saved searches.
- **[URL search](#url-search)** finds MusicBrainz's links by address and by what they link to.
- **[Edit history](#edit-history)** groups edits and votes on a whole group at once.
- **[Pending changes](#pending-changes)** marks what has edits open.
- **[Keyboard shortcuts](#keyboard-shortcuts)**: single keys open an entity's edit, relationships, history and other pages, on MusicBrainz's page and in the viewer; **Ctrl+/** lists them and changes them.
- **[Other scripts](#other-scripts)** can put their launchers in the header's **More (⋯)** menu, and read what Event Horizon already got from MusicBrainz instead of asking again.

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
- **Logged out**: the Event Horizon logo at the top right turns grey with an amber dot; click it to log in and come back to the same page.
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

An empty Locale shows the alias's recognized language in grey. Press **文** beside it to take it; right-click it to fill all empty locales. Existing choices are kept and uncertain names show nothing.

**×** beside a set locale clears it and its primary mark. Alias work is kept in Apollo's latest log.

Long aliases and sort names wrap within their columns. For an artist with a Discogs external link, **Fetch from Discogs** fills new rows with its name variations and aliases, removing Discogs' trailing numbers such as `(3)`, skipping names already present and adding the source to the edit note. Each imported row has a Discogs icon that opens its source. Review or remove the rows before **Enter edit**: Discogs aliases can represent separate MusicBrainz artists.

## Starred entities

Select the star in an entity's header to keep it on the homepage; select it again to remove it. On the homepage, point at an entry and select its star to remove it. Show stars grouped by entity type, as a list, a grid or a table; click a table heading to sort it. The table shows when each star was added, when known. Stars and the chosen view travel with your userscript manager's settings. Use the header's export/import button to save stars to a file or add stars from one.

## Collections

Click the entity-type label above its title to open **Collections**. The menu shows your own and collaborative collections for that type, including private collections. Select an entry to add or remove the entity in the background. **My collections** opens your collections page. **Add to a new collection** opens MusicBrainz's collection form with the entity selected.

The list is kept for your next visit. **Refresh collections** checks for changes made elsewhere. You must be signed in to MusicBrainz.

## Recently opened

The homepage lists the pages you opened last, as a list by default. The buttons in the section's header offer the same views as starred entities, and its table shows when you last opened each entry. The settings button beside them chooses how many entries to keep and which entity types to keep; a type you turn off stops being recorded and its entries leave the section. Your choices travel with your userscript manager's settings.

## Tracklist

Open a track to see its recording and work credits. The recording and work icons after a track's title copy its MBID; Ctrl-click or middle-click opens it. The platforms it is on (Spotify, Apple Music, Tidal, …) show as icons. Icons in collapsed track follow tracklist section configuration - select favorite platforms to show and let others be hidden in a submenu (all are shown in expanded track). Multiple links from the same platform are deduplicated to reduce noise; such platform icons contain a dot and can be right clicked to show the link list for that platform.

The tracklist has convenient options in header to toggle visibility of its columns. The **Artist** column, each track's artist, shows by itself on a Various Artists release and where most tracks have guests, and Show › Artist changes it for that release; with **Artist column by itself** off in the tracklist's settings, Show › Artist is one choice for every release. **Credits display** can be configured in expanded track regarding disambiguation and role/name grouping (choice is remembered).

Show › **Tags** (off at first) puts each recording's genres (filled) and tags (outlined) after its title; it shows only on a release with tagged recordings. An opened track lists them all with their vote counts.

Expanded track contains info about associated recording and works.

## Player

Point at a track's number and click its play button: the release plays from that track, one track after another. **Play** in the tracklist's header plays the whole release. Right-click a track's play button to choose the streaming site it plays from; the next tracks keep that choice when they have it.

The player plays from YouTube, YouTube Music, Spotify, Deezer, Apple Music, SoundCloud and Bandcamp, in the page, and goes on to the next track when one ends. Apple Music's player can't be started for you: click its play button, and the next track follows when the track's length has played. **Hide the video** is remembered. A track with no such link has no play button; with **Show ListenBrainz menu items** on, it gets a ListenBrainz icon instead.

The player shows at the bottom of the page, or as a chip under the header's actions. It has the track, previous and next, the streaming site, and links to the track and the release in ListenBrainz. On the first track, previous restarts it when the source supports seeking. Right-click Play or Pause to cycle through playing once, repeating the release and repeating the track. The mouse wheel winds the track by five seconds. In the source menu, right-click a platform to open the track there in a new tab. Close the player with ×.

**Play in a separate window** keeps playback going when a MusicBrainz tab reloads or closes. Open another MusicBrainz tab to control the same player there; allow pop-ups if your browser blocks the player window. Only one player plays at a time: starting another stops the previous tab player. In tab mode, the queue is restored after navigating to another MusicBrainz page.

While the player is open, editing a release opens the editor in another tab so playback continues. Successful updates from Mission Control, Platform Check and ISRC Scout refresh the release in place when Event Horizon is showing it.

**Send listens to ListenBrainz** adds what the player plays to your listens. Use **Get token** to open [ListenBrainz's settings](https://listenbrainz.org/settings/) and paste your user token into **LB token**; Event Horizon checks it with ListenBrainz. A track shows as playing now when it starts and counts as a listen after half of it or four minutes, whichever comes first. The ListenBrainz icon in the player turns to the accent colour once the listen is sent.

## Releases and discography

A release group lists its releases, and an artist or label its discography, grouped by type, albums first. Switch between a grid of covers and a table; click a table's column to sort it.

A label's releases show by release group, one cover or row per group, grouped by type; **Releases** beside **Groups** lists every release instead, and the choice is remembered. *N releases* counts a group's releases on this label: click it to list them, below the row in a table or in a popup in the grid.

**Columns**, beside the view buttons of a table, chooses what the table shows and in what order, and is remembered for all releases or all discographies. Tick a column to show it, drag its handle or press the arrow keys on it to move it, and Esc during a drag takes the move back. A label's or a recording's releases also have **Type**, their release group's type, such as *Album + Compilation*. Releases also offer Status, Packaging, Language / script and Comment; +N on the button counts the columns left out. A hidden column still sorts and filters. Links is a column like the others. Drag the edge of a column's heading to resize it: the room comes from the columns beside it, and none goes narrower than its content. Double-click the edge to fit that column to its content; the fit button beside **Columns** lets the table size itself again. **Saved**, at the bottom of the menu, keeps the current columns and their widths under a name; pick the name to bring them back, or **Default** for the usual columns.

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

## Edit search

Open **Search for edits** beside **Advanced search** in the homepage search bar, or visit [Search for edits](https://musicbrainz.org/search/edits). Conditions sit above the results in compact rows. Every MusicBrainz field, operator, sort order and value is available, including date ranges, entity lookups and multiple values. Type in a choice list to filter it; checked values stay selected while filtering. **No vote** means no vote was cast; **No** means a vote against the edit.

The single top row chooses edit kind, sort order and matching: **All match**, **Any match**, **None match** or **Not all match**. Icons replace the labels and Save text; on narrow screens the icons also stand in for the selected values, which remain in their tooltips.

The saved-search controls sit to the right of the search options. Type a **Search name** and choose **Save** to keep the current conditions, matching rules and order, even before searching. Focusing the name field lists saved searches; typing filters them, and selecting one runs it. Edit the same name field and choose **Save** to rename the selected search and update its filters. **⋯** offers **New search**, which clears the form without reloading, **Save a copy** and **Delete**. Saved searches stay in your userscript manager's storage.

**Search** runs the form and shows the edits in Event Horizon's history view.

## URL search

Open **Search for URLs**, the link icon beside **Search for edits** in the homepage search bar. Fill in any of the fields and search:

- **URL**: the link's address. A whole address finds that link; `*` stands for any text, so `*bandcamp.com*` finds every Bandcamp link.
- **Linked entity type**: only links to artists, releases, works and so on.
- **Relationship type**: only links of that kind, such as `free streaming` or `discogs`.
- **Linked entity MBID**: only the links of one entity.

Each row shows a link, the entity it is linked to and the kind of link. A link opens its MusicBrainz page, and ↗ opens the site itself. More results load as in every list, with **Load more** or **Auto**.

## Edit history

The grouping, status and Load more toolbar stays pinned while scrolling.

Choose **Bursts**, **Day**, **Editor**, **Type** or **Status** to group edits. Each group’s **Yes**, **No**, **Abstain** and **None** buttons apply to its loaded edits you can vote on; **None** withdraws your votes. The number beside **Vote** counts eligible edits. A status filter limits the group vote to the edits shown. Changing votes on more than 20 edits asks for confirmation. You can still vote on individual edits. An edit's date opens the edit on MusicBrainz.

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

Inside Event Horizon, ISRC Scout, Platform Check, Fuzzy Logic and Mission Control read the release and its release group from what Event Horizon already got from MusicBrainz. They ask MusicBrainz nothing for it, so they show sooner and don't slow your other tabs. Without Event Horizon, each asks MusicBrainz itself.

> [!NOTE]
> Authors can use the [menu-item protocol](DEVELOP.md#external-menu-items), the [shared lookups](DEVELOP.md#shared-lookups) and [coexistence conventions](../../DEVELOP.md#interoperability).

## Settings

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
| Player → Enable player                | on                                                        | the play buttons and the [player](#player)                                                  |
| Player → Play in a separate window    | off                                                       | keeps the player running when the MusicBrainz tab closes                                    |
| Player → Player place                 | Bottom bar                                                | **Bottom bar** or **Top bar**                                                               |
| Player → Show ListenBrainz menu items | on                                                        | the player's links to ListenBrainz                                                          |
| Player → Send listens to ListenBrainz | off                                                       | your listens, with the **ListenBrainz token** beside it                                     |
| General → Pending changes             | off                                                       | mark what has edits open; takes one extra MusicBrainz request per page, sent last           |
| General → Keyboard shortcuts          | on                                                        | the keys below; [keyboard shortcuts](#keyboard-shortcuts); **Change keys** opens their list |

Motions: Static, Drift, Tide, Twinkle, Ripple, Lantern (follows the pointer), Electricity and Neural. Pick Hexagons in the Effects tab and its settings follow; the ones the motion doesn't take (Pace, Trail, How often, Glow, a two-tone Colour) are greyed out. **Depth** scrolls the hexagons slower than the page. All respect reduced motion.

To keep an effect you like, type a name beside **Preset** and click **Save** (or press Enter). Later changes go into it only when you click **Save** again; **+** keeps them as a new preset instead. **Preset** then picks it back, and **Delete** removes the one shown. With [String Theory](../string_theory/README.md#theme), each theme can bring its own preset.

## Shortcuts

| Key         | Where                           |                            |
| ----------- | ------------------------------- | -------------------------- |
| Esc         | filter                          | clear it                   |
| Esc         | a menu                          | close it                   |
| Right-click | alias or tag pencil             | open its page              |
| Right-click | corner icon                     | open the settings          |
| Right-click | a card, group or row            | toggle its siblings        |
| Right-click | a platform icon with more links | open its links             |
| Click       | the entity icon in the header   | open its copy menu         |
| Right-click | a release or recording's icon   | send it to Picard          |
| Right-click | a track's play button           | choose where it plays from |
| Right-click | player Play or Pause            | cycle the repeat mode      |
| Wheel       | player                          | rewind or fast-forward     |
| Right-click | player source menu              | open the platform page     |

## Notes

- The log of a page where you voted or added an edit note, or where something went wrong, is kept in this browser, so it can still be read after the page reloads: the log window lists the last 10, by date and page. **Clear history** deletes Event Horizon's.
- How the player plays, and what it sends to ListenBrainz: [Player](DEVELOP.md#player).
- How Event Horizon uses the network, and how it shares MusicBrainz with the other scripts: [Network usage](DEVELOP.md#network-usage).
