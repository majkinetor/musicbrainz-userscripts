# MagicISRC SoundExchange Search

Scripts adds batch lookup on the [MagicISRC](https://magicisrc.kepstin.ca/) using the [SoundExchange](https://isrc.soundexchange.com/) ISRC database.

- [Install at Greasy Fork](https://greasyfork.org/en/scripts/577713-magicisrc-soundexchange-quick-search)

![screenshot](./screenshot.png)

## Features

### Header

- Search on SoundExchange button (header):
- Searches all rows, shows chips with title/artist/release info
- Options: auto-fill / exact title / exact artist options (persisted in localStorage)

### Per row (on load)

- MB duration badge + "appears on" releases list
- Blue-grey highlight on rows missing ISRC on MB
- Clickable "Search on SoundExchange" placeholder
- +1 button (uses input value or ISRC shown above if input is empty)
- On losing focus on ISRC input field, queries SX and shows result inline with mismatch highlights
- Highlights: 🟠 = wrong song, 🟡 = duration mismatch, 🔵= no ISRC present
- Shows all MB releases that are associated with the recording along with the release year and length of tracks

### Search Panel

- Release (combo with all page releases), Title, Artist fields
- Exact release / exact title / exact artist checkboxes
- 🟢 = currently selected, 🔵 = best match, 🟡 = duration warn
- "Open full search on SoundExchange ↗" link
- Escape to clos

### Inline chip

- Format
    - ISRC · Title — Artist · Year with orange highlights on mismatches
    - Release name, Label
- "+N more" button opens search panel with results
