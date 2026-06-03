# Apollo Editor <img src="icon.svg" align="left" width="48" height="48">

UI and tools for advanced adding and editing of MusicBrainz release tracklist.

- [Install latest from Github](./apollo_editor.user.js)

<img width="1000" src="./screenshot.png" />

https://github.com/user-attachments/assets/b668f472-c3cc-4487-913c-50ff1d950c5b

When you add a release (especially via an import), each track's artist often arrives as plain **text with no MBID**. Linking them one by one — searching, picking, occasionally splitting `A feat. B` into two credits — is the slowest part of adding a release. Apollo Editor does the whole tracklist in one pass and lets you apply the confident matches with one click.

## Features

1. Auto match artists based on name or release group affiliation
1. Replace integrated table
1. Revert edits of single track or all tracks
2. Shows aliases in search results and selected artists, icon with direct URL link and quick create artist button
1. Split artist on join phrase
1. Join phrase selector
1. New tools and tool UI redesign
2. Table customization - resizable columns, alternate row colors, different layouts
1. Reorder tracks within media using the ⠿ handle
1. Keyboard navigation
1. Highlighting of rows that are changed, need attention (tool output, artist split)
1. Apply artist/credited as changes to single track or all matching tracks
1. Switch at any time to original table or apollo editor
1. Clean look & feel

### Matching

**Match** button can be used to auto-match unresolved track artists. Use it manually as needed or enable option _Auto-match artists on load_ which will automatically start the matching process any time Tracklist is initially open or split artist is used.

For every unresolved track it tries, in order:

1. **Sibling releases in the same release group.**<br>
Other versions of the same album usually contain the same songs already credited to similar or same artists. Apollo Editor pulls their per-track credits (with MBIDs) and matches by title. This is the highest-confidence source and resolves most VA compilations outright.
2. **Name search**<br>
Search MusicBrainz's artist index for anything siblings don't cover. An exact name match is only taken as high-confidence when it's **unambiguous** — when several artists share that exact name, there's no way to know which is right so one must be picked manually.

Each match is tagged:
- **rg** - matched using sibling release
- **set** - pre-existing setting
- **name** - matched using name
- **user** - manually selected

## Tools

Native tools are hidden and moved to the single Tool button at the top of the table that stays always visible. All tools can be accessed via button's menu and the last one used becomes default one. If the tool has parameters, they are shown next to the button. Parameterless tools fire on pick.

Besides integrated tools, there are few new tools:

1. **Search & Replace**<br>
Search a string within track title and replace it. Clicking the button starts a fresh session with any existing parameters applied and cleared.
1. **Resize Columns**<br>
Options to set column sizes to several predefined variants - auto fit, centered, default
