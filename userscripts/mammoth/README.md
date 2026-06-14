# Mammoth <img src="icon.svg" align="left" width="48" height="48">

Edit-note memory for MusicBrainz — the elephant that never forgets. Mammoth keeps your reusable edit notes in a compact panel **beside** the edit-note field on every edit form, and remembers the ones you submit. A nicer replacement for [Elephant Editor](https://github.com/jesus2099/konami-command/blob/master/mb_ELEPHANT-EDITOR.user.js).

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mammoth/mammoth.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mammoth/mammoth.user.js)

## What it does

Every MusicBrainz edit form has an **Edit note** field — release/RG/artist/label/work/recording/area/place/series/event/genre/URL *add* and *edit*, the relationship editor, merges, removals, set-values, batch edits. Power editors reuse the same notes constantly ("Source: official site", "Per CSG", a discography URL…). Mammoth makes that painless.

The wide edit-note field is split: the textarea on the left, and a **saved-notes panel on the right**.

```
┌──────────────────────────────┬──────────────────┐
│ (edit-note textarea)         │ ★ Per CSG        │
│                              │ ☆ Source: site   │
│                              │ ☆ …              │
│                              ├──────────────────┤
│                              │ ＋  📌  🕘     ⚙ │
└──────────────────────────────┴──────────────────┘
```

Each note is shown on **one line** (full text on hover). **Left-click** a note to **append** it to the field, **right-click** to **replace** the field — no modifier keys. **Ctrl/⌘ + ↑/↓** cycles through your saved notes, replacing the field as you go.

The footer: **＋** saves the current edit-note text · **📌** shows your Saved notes · **🕘** shows Recent (history) · **⚙** settings.

## Features

- **Auto-history, no checkbox.** Mammoth automatically remembers the last **N edit notes you actually submit** (default 10, up to 50), most-recent-first and de-duplicated. There's no "remember this note" toggle to get stuck on across sessions.
- **Saved notes.** **＋** saves the current field text; in **History**, the **★** on a row pins it to Saved. In **Saved**, **★** marks a favourite (sorts to the top), and **↑ ↓** reorder, **🗑** deletes.
- **Compact, one-line rows** with the full note on hover — fits a lot more than 6-character buttons.
- **Insert without keys.** Left-click appends, right-click replaces; never silently overwrites, so it won't clobber a note another script (Apollo Editor, Credit Hoarder, Platform Check) wrote for its own submission. Ctrl/⌘ + ↑/↓ cycles saved notes.
- **Wider edit note.** The native edit-note field is widened to the full page width to make room for the panel.

## Settings (⚙)

| Setting | Default | Notes |
|---|---|---|
| **Hide edit-note help text** | off | Hides MusicBrainz's "Entering an edit note…" help paragraphs above the field. |
| **History size** | `10` | How many submitted notes to remember (1–50). |

Storage is per-browser (via the userscript manager). Nothing is sent anywhere.

## Why standalone (not part of Apollo Editor)

The edit-note field is on *every* edit form, while [Apollo Editor](../apollo_editor/README.md) is scoped to the release editor. Mammoth is a small, cross-cutting tool that attaches to the native edit-note textarea wherever it appears, and is useful with or without the other scripts.
