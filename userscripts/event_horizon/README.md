# Event Horizon <img src="icon.svg" align="left" width="48">

A clean, modern redesign of MusicBrainz's pages, with themes, automatic light and dark, and a place for the other String Theory scripts.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/event_horizon/event_horizon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/event_horizon/event_horizon.user.js)
  - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[The viewer](#the-viewer)** replaces a MusicBrainz page and moves between pages without reloading.
- **[Header menu](#header-menu)**: which actions show, in what order, and which go under More.
- **[Background effects](#background-effects)**: Hexagons, Tron, Stars, Aurora and Rain over the cover, a glow, generated artwork or any picture.
- **Sections**: a page's data in cards you fold, hide and reorder.
- **Starred entities** keeps favourites on the homepage.
- **Collections**: in-place interface to add an entity to your collections or remove it.
- **Recently opened** lists the pages you opened last on the homepage.
- **[Tracklist](#tracklist)**: each track's credits and streaming links.
- **[Player](#player)** plays recordings, releases and collections from their streaming links, and can send your listens to ListenBrainz.
- **[Releases and discography](#releases-and-discography)** as a grid or a table, with columns, filters and saved views.
- **[Edit search](#edit-search)**: every MusicBrainz condition in compact rows, with saved searches.
- **[URL search](#url-search)** finds links by address and by what they link to.
- **[Tags](#tags)** shows an editor's, an entity's or MusicBrainz's most used tags as bars, a cloud, chips, A–Z or a table.
- **[Edit history](#edit-history)** groups edits and votes on a group at once.
- **[Pending changes](#pending-changes)** marks what has edits open.
- **[Keyboard shortcuts](#keyboard-shortcuts)** open an entity's pages and drive the player.
- **[Other scripts](#other-scripts)** put their launchers in the header and reuse what Event Horizon already loaded.

## The viewer

On a page Event Horizon can show, its dock button replaces MusicBrainz's page. Links to other such pages open in place. A page you visited before shows at once and updates in the background while the corner icon spins.

- **Pictures**: an artist's or label's from its linked sites; click it for the next, or its source icon for a gallery. **Retry image** asks again when none was found. An area shows its map and flag, a place its Commons image, an event its Event Art Archive front.
- **Covers**: click a cover to view them all full screen in Art Station's gallery. The cover-art and event-art pages hold the same gallery.
- **History** groups edits into bursts; a single edit opens under the release it touches.
- **Account pages** keep MusicBrainz's controls under your profile header. Revoke an application in its row.
- **Relate**, the relationship editor, takes Event Horizon's look, with folding cards.
- **Search**: a type's letter and a space search that type, e.g. `w yesterday` searches works.
- **Logged out**: the corner logo turns grey with an amber dot; click it to log in and come back.
- **Pinned header**: once the header scrolls away, a bar keeps the cover, title, artist and actions in reach.

## Header menu

In **Settings → Menu**, drag items to reorder them, show or hide them with the eye, and place each in **Main** or **More**. Turn off an item's **Title** to show only its icon. **Responsive** brings items from More into the main menu while they fit. Other scripts' items are in the same table.

## Background effects

In **Settings → Effects**, add a **Background** and any number of **Effects** over it. Select a badge for its settings; its × removes it. Every effect has **Opacity**, **Glow** and **Colour** (**One tone**, **Two-tone**, **All**, or **User** with your own swatches).

| Background | Settings                                                  |
| ---------- | --------------------------------------------------------- |
| Cover aura | Opacity, Blur, Saturation, Height                         |
| Glow       | Strength, Size, Place                                     |
| Artwork    | Scene (Chillwave, Nebula, Low poly, Bokeh), Shuffle       |
| Image      | a picture's address; Blur, Tone, Fit, Vignette and others |

| Effect   | Settings                                                 |
| -------- | -------------------------------------------------------- |
| Hexagons | Motion, Outlines, Effect, Pace, Trail, How often, Depth  |
| Tron     | Outlines, Grid size, Riders, Speed, Trail length         |
| Stars    | Density, Drift, Depth, Twinkle                           |
| Aurora   | Style, Diffuse, Ribbons, Speed, Height, Folds            |
| Rain     | Amount, Drop size, Sliding, Trails, Fog, Lights and more |

**Preset** saves the whole set by name: **Save** updates it, **+** saves a copy. Built-in presets stay as shipped. **Copy as JSON** and **Import from JSON** share one. With [String Theory](../string_theory/README.md#theme), each theme can bring its own preset.

While you tune, the settings window fades when the mouse leaves it, so you see the page.

> [!NOTE]
> Motion pauses in a hidden tab and respects reduced motion.

## Tracklist

Open a track for its recording and work credits. The icons after a title copy its MBID; Ctrl-click opens it. Streaming platforms show as icons, your favourites first and the rest behind **+N**; a dotted icon has several links, right-click it for the list.

The header's **Show** menu picks the columns: **Artist** shows by itself on a Various Artists release, **Tags** adds each recording's genres and tags.

## Player

The player is on unless **Enable player** is turned off in the settings. The play button on a track number plays that recording; **Play** in the tracklist's header plays the release; right-click either to add to the queue. On a recording or release collection, **Play** queues the collection.

It plays from YouTube, YouTube Music, Spotify, Deezer, Apple Music, SoundCloud, Bandcamp and the Internet Archive. A release linked to an Internet Archive item plays each track from the item, in the best quality that your browser plays (FLAC first). Apple Music needs a click on its own play button. On YouTube and Bandcamp the next track loads ahead and **Crossfade** blends them.

Click the track name for the queue. Its head counts the releases and loose recordings: the releases count shows their covers as a grid in place of the tracks, and a cover jumps to its release, right-click removes its tracks; the recordings count jumps to them. While a collection loads, the head shows how many of its entries are loaded. Right-click Play to cycle repeat; **Shuffle** plays each track once in random order; the wheel winds five seconds. The source menu also has:

- **Open in window**: the player moves to a pop-up, so playback survives reloading or closing a tab. **Back to tab** returns it.
- **Load collection** and **Save playlist as collection**.
- **Recent playlists…**: the last five queues.

**Send listens to ListenBrainz** scrobbles what plays, after half a track or four minutes. **Get token** opens ListenBrainz's settings for the token.

## Releases and discography

A release group's releases, and an artist's or label's discography, are grouped by type, as a grid or a sortable table. A label's are grouped by release group; **Releases** lists each release instead.

**Columns** picks, orders and names sets of columns. Drag a heading's edge to resize; double-click it to fit.

The funnel filters by title, or by column with `column:value`:

| Filter                         |                                      |
| ------------------------------ | ------------------------------------ |
| `-live`, `-label:x`            | exclude                              |
| `year:2022-2024`, `year:2022-` | a range                              |
| `label:x OR label:y`           | either; terms side by side all match |
| `(a OR b) AND year:2022-`      | group with brackets                  |

The arrow at the end of the box saves a filter by name.

## Edit search

**Search for edits** sits beside **Advanced search** on the homepage. Every MusicBrainz condition is a compact row; type in a choice list to filter it. Name a search and **Save** it; the name field lists saved ones, and **⋯** has **New search**, **Save a copy** and **Delete**.

## URL search

**Search for URLs**, the link icon beside it, finds links by **URL** (`*` for any text: `*bandcamp.com*`), **Linked entity type**, **Relationship type** or **Linked entity MBID**. ↗ opens the site itself.

## Tags

An editor's tags, an entity's tags and MusicBrainz's most used tags show as **Bars**, **Cloud**, **Chips**, **A–Z** or **Table**, with a filter and the **Genres** and **Other** toggles. **Tags**, the tag icon in the homepage search bar, opens the most used ones.

## Edit history

Group edits by **Bursts**, **Day**, **Editor**, **Type** or **Status**. A group's **Yes**, **No**, **Abstain** and **None** vote on all its loaded edits you can vote on; more than 20 asks first.

## Pending changes

With **Show pending changes** on, titles, tracks, credits and links with open edits are greyed, as on MusicBrainz.

## Keyboard shortcuts

Single keys work on an entity's page, in the viewer or on MusicBrainz's. **Ctrl+/** lists them; click a key there to change it.

| Key             | Does                                                                  |
| --------------- | --------------------------------------------------------------------- |
| O               | the entity's page                                                     |
| E               | Edit                                                                  |
| R               | Edit relationships                                                    |
| C               | Cover art                                                             |
| H               | Editing history                                                       |
| T               | Tags; in the viewer, edits them in place (Enter on an empty box ends) |
| D               | Details                                                               |
| A               | Aliases                                                               |
| V               | toggles Event Horizon                                                 |
| Ctrl+H / Ctrl+L | back / forward                                                        |
| S               | search                                                                |
| P               | play the release, recording or collection                             |
| Space           | play or pause                                                         |
| ← / →           | 5 seconds back or forward                                             |
| Ctrl+← / Ctrl+→ | previous or next track                                                |
| Ctrl+P          | open or close the player                                              |
| Ctrl+Space      | the playlist: arrows pick, Enter plays                                |
| Alt+1 / Alt+2   | the playing release / recording in or out of its default collection   |
| Alt+3           | love the playing track on ListenBrainz                                |
| U               | your profile                                                          |
| .               | MusicBrainz's homepage                                                |
| ,               | settings                                                              |
| Ctrl+/          | this list                                                             |

## Other scripts

Compatible scripts show under **More (⋯)** in the header. Inside Event Horizon, ISRC Scout, Platform Check, Fuzzy Logic and Mission Control read the release from what Event Horizon already loaded, so they open sooner.

> [!NOTE]
> Authors: the [menu-item protocol](DEVELOP.md#external-menu-items), the [shared lookups](DEVELOP.md#shared-lookups) and the [coexistence conventions](../../DEVELOP.md#interoperability).

## Settings

Right-click the corner icon.

| Setting                               | Default                                                   |                                               |
| ------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| Release → Info                        | released, labels, barcode, length, links                  | facts beside the cover                        |
| Release → Under the cover             | Other covers, Rating, Genres                              | what shows under the cover                    |
| Tracklist → Tracks                    | Alternating colors, Artist column by itself               | shading; the Artist column per release        |
| Platforms → Show                      | off                                                       | **Names** beside icons; **Gray icons**        |
| Platforms → Icon size                 | 22px                                                      | platform icon size                            |
| Platforms → Platforms                 | Spotify, Apple Music, Tidal, Qobuz, Deezer, YouTube Music | which show, in what order                     |
| Artist → Artist images                | all sources                                               | which sources, in what order                  |
| Annotation → Show annotation on hover | on                                                        | preview a folded annotation                   |
| General → Page width                  | Wide                                                      | how wide the page grows                       |
| General → Show pending changes        | off                                                       | [mark open edits](#pending-changes)           |
| General → Keyboard shortcuts          | on                                                        | [the keys](#keyboard-shortcuts)               |
| Effects                               | Cover aura                                                | [background and effects](#background-effects) |
| Menu → Show menu titles               | off                                                       | text beside main menu icons                   |
| Menu → Responsive                     | off                                                       | items from More move up when they fit         |
| Player → Enable player                | on                                                        | the [player](#player)                         |
| Player → Player place                 | Bottom bar                                                | **Bottom bar** or **Top bar**                 |
| Player → Show cover                   | on                                                        | the playing track's cover, in the top bar     |
| Player → Show playlist track number   | off                                                       | the playing track's number in the playlist    |
| Player → Left click                   | Replace queue                                             | replace the queue or add to it                |
| Player → Crossfade                    | 5 s                                                       | **Off** for none                              |
| Player → Collection playlist limit    | 1000                                                      | most tracks taken from a collection           |
| Player → Show ListenBrainz menu items | on                                                        | the player's ListenBrainz links               |
| Player → Send listens to ListenBrainz | off                                                       | with the **LB token** beside it               |

## Shortcuts

| Key         | Where                                  |                      |
| ----------- | -------------------------------------- | -------------------- |
| Right-click | corner icon                            | settings             |
| Right-click | home icon                              | your profile         |
| Right-click | alias or tag pencil                    | open its page        |
| Right-click | a card, group or row                   | fold its siblings    |
| Right-click | a platform icon with a dot             | its links            |
| Right-click | a release or recording icon            | send it to Picard    |
| Right-click | a play button                          | add to the queue     |
| Right-click | player Play or Pause                   | cycle repeat         |
| Right-click | a platform in the player's source menu | open the track there |
| Wheel       | player                                 | wind the track       |
| Click       | the entity icon in the header          | copy menu            |

## Notes

- The log of a page where you voted, added a note or hit an error is kept in this browser; the log window lists the last 10.
- How the player works and what it sends to ListenBrainz: [Player](DEVELOP.md#player). How Event Horizon uses the network: [Network usage](DEVELOP.md#network-usage).
