# Mammoth <img src="icon.svg" align="left" width="48" height="48">

Mammoth keeps your reusable edit notes in a compact panel **beside** the edit-note field on every edit form, and remembers the ones you submit.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mammoth/mammoth.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mammoth/mammoth.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

<img src=./screenshots/main.png width=600 />

<details><summary>More screenshots</summary>
<img src=./screenshots/babies.png width=600 /><br>
<img src=./screenshots/big-buttons.png width=600 /><br>
<img src=screenshots/options.png width=350/>
</details>

Every MusicBrainz edit form has an **Edit note** field. Power editors reuse the same notes constantly. Mammoth makes that painless.

## Features

- **Per-type notes** — keep saved notes and history separate per edit-note type (release / artist / recording…); off by default (see [Settings](#settings)).
- **History** — remembers the last N submitted edit notes (default 10, up to 50), newest-first and de-duplicated.
- **[Saved notes](#saved-notes)** — save, pin as quick-buttons, search, sort and reorder your reusable notes.
- **Import / export** — batch load/export notes per input type; entity fields (Artist/Label) keep their MBID so a re-import resolves the real entity (see [Settings](#settings)).
- **Compact, one-line rows** — full note on hover; choose how many show before the list scrolls.
- **Replace or Insert** — left-click does your default, right-click the other; append skips a line already present (see [Shortcuts](#shortcuts)).
- **Resizable** — the edit-note field is widened and centered; drag the separator to resize field vs. panel (and the field's height); remembered.
- **Minimized mode** — collapse the panel to a small icon; hover to peek, click to pin; remembered across pages.
- **[Mammoth babies](#mammoth-babies)** — the same save/reuse on other controls (catalogue №, label, artist, status, language, script, country, type, and the relationship dialog's **Task** field), plus **[your own custom fields](#custom-fields)** by CSS selector.

## Saved notes

- **＋** saves the current text; in **History**, `★` on a row moves it to saved notes. Reorder by **drag** (the `⠿` handle on the right, shown on hover) and delete with `🗑`.
- **Note search** — narrows the list to notes containing the typed phrase (see [Shortcuts](#shortcuts) for keys).
- **Quick buttons** — click `★` on a saved note to pin it as a button below the input field.
- **Sort** — **Manual** (drag & drop, default), **Most used** or **Recent**.

## Mammoth babies

A small 🦣 pin sits in each field; click it to recall values you've saved for that field (stored per field, shared across releases). Built-in fields: catalogue №, label, artist, status, language, script, country, type — plus the **Task** field in the *Add/Edit relationship* dialog (#397), so you can save and one-click your standardized task names instead of retyping them (one shared list across every relationship type). The pin opens a compact panel with a toolbar:

- `＋` - save the current value; entity fields (Label, Artist) save the selected MBID, so a recalled value resolves the real entity
- `✕` - clear the field

Note actions:

 - `★` pins a value as an always-visible **button under the field** (rounded "tag" buttons that wrap to new rows, labelled with the value truncated to the configured length — see **`⚙` "Button label length"**)
 - `◉` marks one entry as the **default** (auto-fills the field when it's empty)
 - `🗑` delete note
 - `⠿` drag to reorder

### Custom fields

The built-in babies cover the release editor's own controls, but you can put a 🦣 on **any** field on **any** MusicBrainz page — open **`⚙` → Fields** tab and **＋ Add field**:

| Column | Meaning |
|---|---|
| **Selector** | The field's CSS selector (Inspect the element → *Copy selector*). **Comma-separate** several selectors to cover more than one field with a single row. A live *matches N* / *bad selector* readout tells you if it's right. |
| **Label** | The popover title (optional — derived from the field's own label if left blank). |
| **Key** | Storage key (optional). Fields sharing a key share their saved values — so a row with several comma-separated selectors and one Key becomes **one baby across all of them**; omit it and Mammoth derives a separate key per field. |
| **px** | Nudge the pin left/right by N pixels, to clear a field's own icon or arrow (optional). |
| **↵** | Press **Enter** after a value is set — lets an autocomplete accept its highlighted match. The wait is the **Enter delay** setting (default 150 ms; raise it for a slow autocomplete). |

Changes apply live (the page is re-scanned), and your list is remembered across sessions. Works on `<input>`, `<select>`, and `<textarea>`.

## Shortcuts

In the edit-note field (and Mammoth's panel):

| Key | Action |
|---|---|
| `Ctrl`/`⌘` + `Enter` | Submit the edit (clicks the page's *Enter edit* / submit button) |
| `Ctrl`/`⌘` + `↑` / `↓` | Cycle through your saved notes, replacing the field |
| `Ctrl`/`⌘` + `B` | Wrap the selection — or the word at the caret — in **bold** markup |
| `Ctrl`/`⌘` + `I` | Wrap the selection — or the word at the caret — in *italic* markup |
| `Ctrl`/`⌘` + `,` | Focus the note search box |

On a saved-note row or a pinned quick-button:

| Action | Result |
|---|---|
| click | apply with your default (replace / append) |
| right-click | apply the other way |
| `Ctrl`/`⌘` + click | replace the field **and submit** the edit (parity with `Ctrl`/`⌘` + `Enter`) |

In the note search box:

| Key | Action |
|---|---|
| `↑` / `↓` | Move the highlighted match |
| `Enter` | Apply the highlighted match (or the first if none) |
| `Esc` | Clear the search |

## Settings 

Accessed using the `⚙` button. 

| Setting | Default | Notes |
|---|---|---|
| **Scope per resource** | off | Keep notes separate per edit-note type (release / artist / …). |
| **Hide help text** | off | Hides MusicBrainz's help paragraphs above the field. |
| **Default click action** | `replace` | What a left-click does (`replace`, or `append`). Right-click does the other. |
| **Insert new line when appending** | on | Append a blank line before note. |
| **Show note search** | off | Show the search box above the note list (for big lists). |
| **Sort saved notes** | `Manual` | `Manual` (drag order), `Most used`, or `Recent`. |
| **Button label length** | `24` | Character length of the pinned quick-buttons' labels (4–80), for both the main and baby pins. |
| **Items shown** | `6` | How many list rows to render before the list scrolls. |
| **History size** | `10` | How many submitted notes to remember (1–50). |
| **Show mammoth babies** | on | Field memory on other controls (catalog №, label, artist, status…). Toggles on/off live. |
| **Enter delay** | `150` ms | For a custom field's **↵** flag — how long after the value is set before Enter is pressed (0–5000). Raise it if a slow autocomplete misses the match. |

The `⚙` window has three tabs: **Settings** (above), **[Fields](#custom-fields)** (define your own custom baby fields), and **Import / Export** (paste to import many notes, or **Export all** — with a *1 note per line* / *empty line separates notes* toggle that applies both ways).

## Using Mammoth from another userscript

Integration is done by convention:

- Panel: any `textarea.edit-note` on the page gets the full Mammoth panel automatically.
- Baby: use `class="mmth-pin"`

Mammoth enhances **any `textarea.edit-note` on the page**, not just MusicBrainz's own — a `MutationObserver` picks up fields added dynamically too. So another userscript that has its own edit-note field (e.g. [Art Station](../art_station)'s "Enter edit" dialog) can host the full Mammoth panel **with no API and no changes to Mammoth**:

1. **Give your edit-note field `class="edit-note"`.** Mammoth wraps it (`.mmth-wrap`) and attaches the saved-notes / history panel.

   ```html
   <textarea class="edit-note"></textarea>
   ```

2. **History capture is automatic** if your submit button matches Mammoth's heuristic — a document-wide click on a button whose text starts with `enter edit` / `submit` / `add edit` / `save`, or that has class `submit`, records the field into history.

3. **You own the layout.** Mammoth lays the field out beside a ~300px panel (`.mmth-side`) with a drag splitter (`.mmth-vsep`); scope your own CSS to fit it into your container — e.g. hide the splitter and give the wrap a bottom margin inside a modal:

   ```css
   #your-dialog .mmth-wrap { margin: 0 0 12px; max-width: none; gap: 10px; }
   #your-dialog .mmth-vsep { display: none; }
   ```

To get Mammoth baby on edit utilize `mmth-pin` class:

```html
<input class="mmth-pin" data-mmth-key="my-cat-no" data-mmth-label="Catalogue №">
```

- `data-mmth-key` (optional) — storage key; fields sharing a key share their saved values. Omit it and Mammoth derives one from the element's id/name/label (keyFor, :996).
- `data-mmth-label` (optional) — the popover title.
- `data-mmth-dx="<px>"` (optional) — nudge the pin (e.g. past a custom affordance).

The popover always carries a filter box for the saved values. `Ctrl`/`Cmd`+`,` while the field is focused opens the popover at the field, with the filter focused; `↑`/`↓` move and `Enter` picks.

Works on `<input>`, `<select>`, `<textarea>`. Stored under its own key mammoth-fields:data (separate from edit-note history).

