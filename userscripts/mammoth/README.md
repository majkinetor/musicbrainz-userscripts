# Mammoth <img src="icon.svg" align="left" width="48" height="48">

Mammoth keeps your reusable edit notes in a compact panel **beside** the edit-note field on every edit form, and remembers the ones you submit.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mammoth/mammoth.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mammoth/mammoth.user.js)

![](./screenshot.png)

Every MusicBrainz edit form has an **Edit note** field. Power editors reuse the same notes constantly. Mammoth makes that painless.

## Features

- **History**<br>
Remembers the last **N edit notes you submit** (default 10, up to 50), most-recent-first and de-duplicated. 
- **Saved notes**<br>
**＋** saves the current text; in **History**, **★** on a row moves it to saved notes. Reorder by **drag** (the **⠿** handle on the right, shown on hover) and delete with **🗑**.
- **Compact, one-line rows**<br>
With the full note on hover; choose how many show before scrolling (the list hides its scrollbar — the mouse wheel scrolls it).
- **Insert**<br>
Click does your default (replace/append); right-click does the other. Append skips a line already present in the field. Ctrl/⌘ + ↑/↓ cycles saved notes; **Ctrl/⌘ + B / I** wrap the selection — or the word at the caret — in bold / italic markup.
- **Resizable**<br>
The native edit-note field is widened and centered (it spans the full form width on the release editor). **Drag the separator** to resize the field vs. the panel, and the field's own height; both are remembered.

## Keyboard shortcuts

In the edit-note field (and Mammoth's panel):

| Key | Action |
|---|---|
| `Ctrl`/`⌘` + `Enter` | Submit the edit (clicks the page's *Enter edit* / submit button) |
| `Ctrl`/`⌘` + `↑` / `↓` | Cycle through your saved notes, replacing the field |
| `Ctrl`/`⌘` + `B` | Wrap the selection — or the word at the caret — in **bold** markup |
| `Ctrl`/`⌘` + `I` | Wrap the selection — or the word at the caret — in *italic* markup |

## Settings 

Accessesd using ⚙ button:

| Setting | Default | Notes |
|---|---|---|
| **Hide edit-note help text** | off | Hides MusicBrainz's help paragraphs above the field. |
| **Default click action** | `replace` | What a left-click does (`replace`, or `append`). Right-click does the other. |
| **Insert new line when appending** | on | Append a blank line before note. |
| **Items shown** | `6` | How many list rows to render before the list scrolls. |
| **History size** | `10` | How many submitted notes to remember (1–50). |

##  Notes

- Inspired by [Elephant Editor](https://github.com/jesus2099/konami-command/blob/master/mb_ELEPHANT-EDITOR.user.js).
