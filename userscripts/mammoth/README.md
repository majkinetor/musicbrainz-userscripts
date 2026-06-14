# Mammoth <img src="icon.svg" align="left" width="48" height="48">

Edit-note memory for MusicBrainz — the elephant that never forgets. Mammoth remembers the edit notes you submit and lets you save reusable ones, recalling any of them **by their full text** from a clean panel on every edit form. A nicer replacement for [Elephant Editor](https://github.com/jesus2099/konami-command/blob/master/mb_ELEPHANT-EDITOR.user.js).

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mammoth/mammoth.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mammoth/mammoth.user.js)

## What it does

Every MusicBrainz edit form has an **Edit note** field — release/RG/artist/label/work/recording/area/place/series/event/genre/URL *add* and *edit*, the relationship editor, merges, removals, set-values, batch edits. Power editors reuse the same notes constantly ("Source: official site", "Per CSG", a discography URL…). Mammoth makes that painless.

A small bar appears above the native Edit note field:

> **🗒 Notes ▾**  **★ Save current**

- **🗒 Notes** opens a searchable panel of your notes, each shown as its **whole message** (not a cryptic 6-character button). Two sections: **📌 Saved** (notes you keep) and **🕘 Recent** (auto-history).
- **★ Save current** stores whatever is in the edit-note field right now as a reusable Saved note.

## Features

- **Auto-history, no checkbox.** Mammoth automatically remembers the last **N edit notes you actually submit** (default 10, configurable up to 50), most-recent-first and de-duplicated. There's no "remember this note" toggle to get stuck on across sessions.
- **Saved notes.** Pin any recent note to **Saved** (the ★ on its row), or save the current field text directly. Saved notes persist and survive history rollover.
- **Full-text recall + search.** The panel shows each note in full and filters as you type.
- **Smart, safe insert.** Click a note to insert it: into an **empty** field it sets the text; into a **non-empty** field it **appends on a new line** (hold Ctrl/⌘/Alt to do the opposite). It **never silently overwrites**, so it won't clobber a note another script (Apollo Editor, Credit Hoarder, Platform Check) wrote for its own submission.
- **Manage.** Copy or delete any note; switch the default insert mode (append/replace) and history size from the panel footer.
- **Export / import.** Copy your whole note set as JSON, or paste JSON to merge Saved notes in — so a list built up over time is never lost, and is easy to share.

## Settings

In the panel footer:

| Setting | Default | Notes |
|---|---|---|
| **Insert** | `append` | What a click does into a non-empty field (`append` on a new line, or `replace`). Modifier-click inverts it. |
| **History** | `10` | How many submitted notes to remember (1–50). |
| **Export / Import** | — | Export copies all notes as JSON; Import merges Saved notes from pasted JSON. |

Storage is per-browser (via the userscript manager). Nothing is sent anywhere.

## Why standalone (not part of Apollo Editor)

The edit-note field is on *every* edit form, while [Apollo Editor](../apollo_editor/README.md) is scoped to the release editor. Mammoth is a small, cross-cutting tool that attaches to the native edit-note textarea wherever it appears, and is useful with or without the other scripts.
