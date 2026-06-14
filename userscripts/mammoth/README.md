# Mammoth <img src="icon.svg" align="left" width="48" height="48">

Edit-note memory for MusicBrainz — the elephant that never forgets. Mammoth keeps your reusable edit notes in a compact panel **beside** the edit-note field on every edit form, and remembers the ones you submit. A nicer replacement for [Elephant Editor](https://github.com/jesus2099/konami-command/blob/master/mb_ELEPHANT-EDITOR.user.js).

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mammoth/mammoth.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mammoth/mammoth.user.js)

## What it does

Every MusicBrainz edit form has an **Edit note** field — release/RG/artist/label/work/recording/area/place/series/event/genre/URL *add* and *edit*, the relationship editor, merges, removals, set-values, batch edits. Power editors reuse the same notes constantly ("Source: official site", "Per CSG", a discography URL…). Mammoth makes that painless.

The wide edit-note field is split (and centered): the textarea on the left, and a **saved-notes panel on the right**.

```
┌──────────────────────────────┬─────────────────────────┐
│ (edit-note textarea)         │ ＋  ★  🕘        ?  ⚙   │  ← toolbar
│                              ├─────────────────────────┤
│                              │ Per CSG guidelines    ⠿ │
│                              │ Source: official site ⠿ │  ⠿ = drag handle
│                              │ …                       │      (on hover)
└──────────────────────────────┴─────────────────────────┘
```

Each note is one line (full text on hover). **Click** applies your default action (append or replace, set in ⚙); **right-click** does the other. **Ctrl/⌘ + ↑/↓** cycles through your saved notes, replacing the field (and keeping focus on the editor).

Toolbar: **＋** save the current edit-note text · **★** Saved notes · **🕘** Recent (history) · **?** edit-note syntax · **⚙** settings.

## Features

- **Auto-history, no checkbox.** Remembers the last **N edit notes you submit** (default 10, up to 50), most-recent-first and de-duplicated. No "remember this note" toggle to get stuck on across sessions.
- **Saved notes.** **＋** saves the current text; in **History**, **📌** on a row pins it to Saved. In **Saved**, reorder by **drag** (the **⠿** handle on the right, shown on hover) and **🗑** deletes.
- **Compact, one-line rows** with the full note on hover.
- **Insert without keys.** Click does your default (append/replace); right-click does the other. **Append skips a line already present** in the field, and it never blindly overwrites — so it won't clobber a note another script (Apollo Editor, Credit Hoarder, Platform Check) wrote for its own submission. Ctrl/⌘ + ↑/↓ cycles saved notes.
- **Edit-note syntax help (?).** A quick reference for MusicBrainz's edit-note markup (`''italic''`, `'''bold'''`, `edit #123`, `doc:Page`, auto-linked URLs).
- **Tidied field.** The native edit-note field is widened and centered, and its redundant "Edit note" label/heading is hidden.

## Settings (⚙)

The ⚙ popover shows the script name, version and a help link, plus:

| Setting | Default | Notes |
|---|---|---|
| **Hide edit-note help text** | off | Hides MusicBrainz's "Entering an edit note…" help paragraphs above the field. |
| **Default click action** | `append` | What a left-click does (`append` on a new line, or `replace`). Right-click does the other. |
| **History size** | `10` | How many submitted notes to remember (1–50). |

Storage is per-browser (via the userscript manager). Nothing is sent anywhere.

## Why standalone (not part of Apollo Editor)

The edit-note field is on *every* edit form, while [Apollo Editor](../apollo_editor/README.md) is scoped to the release editor. Mammoth is a small, cross-cutting tool that attaches to the native edit-note textarea wherever it appears, and is useful with or without the other scripts.
