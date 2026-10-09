# Mammoth <img src="icon.svg" align="left" width="48" height="48">

Reusable edit notes in a panel beside the edit-note field of every edit form, and remembered values for any other field.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/mammoth/mammoth.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/mammoth/mammoth.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

<img src="./screenshots/main.png" width=600 />

## Features

- **[Saved notes](#saved-notes)**: save, pin as buttons, search, sort and reorder edit notes.
- **[History](#saved-notes)** of the notes you submitted.
- **[Mammoth babies](#mammoth-babies)**: the same for other fields (catalogue number, label, artist…), and **[any field you choose](#custom-fields)**.
- **[Import and export](#settings)** of notes.
- **[Other scripts' edit-note fields](#notes)** get the same panel.

## Saved notes

- **＋** saves the current text. In **History**, ★ moves a note to the saved ones.
- ★ on a saved note pins it as a **button** under the field.
- Sort **manually** (drag ⠿), by **most used** or by **recent**. A search box narrows long lists.
- Click applies a note with your default action (replace or append); right-click does the other. Appending skips a line that's already there.

The field is widened and centred; drag the separator to resize the panel. The panel can be minimized to an icon: hover to peek, click to pin.

> [!TIP]
> With *Scope per resource* on, each kind of edit note (release, artist, recording…) keeps its own saved notes and history.

## Mammoth babies

A 🦣 pin in a field recalls the values saved for it, shared across releases. The built-in ones cover catalogue number, label, artist, status, language, script, country, type and the task fields.

<img src="./screenshots/babies.png" width=600 />

In the pin's panel, **＋** saves the current value and **✕** clears the field. On a saved value:

|     |                                                        |
| --- | ------------------------------------------------------ |
| ★   | pin it as a button under the field                     |
| ◉   | make it the default, filled in when the field is empty |
| 🗑   | delete                                                 |
| ⠿   | drag to reorder                                        |

Label and Artist save the selected entity's MBID, so a recalled value is the real entity, not a new search.

<img src="./screenshots/big-buttons.png" width=600 />

### Custom fields

Put a 🦣 on any field of any MusicBrainz page: **⚙ → Babies → ＋ Add field**. The built-in fields are listed there too, so you can edit, disable or restore them (**↺ Defaults**).

<img src="./screenshots/custom-fields.png" width=600 />

| Column       |                                                                                        |
| ------------ | -------------------------------------------------------------------------------------- |
| **Selector** | its selector (Inspect → *Copy selector*); commas for several; *matches N* checks it    |
| **Label**    | the panel's title, and the field's identity: fields with the same label share one list |
| **px**       | nudge the pin sideways, clear of the field's own icon                                  |
| **lvl**      | where the bar attaches: `0` floats under the field, `N` goes after its Nth ancestor    |
| **↵**        | submit the field's form after a recall, like pressing Enter (tags, header search)      |

Changes apply live. Works on `<input>`, `<select>` and `<textarea>`.

> [!TIP]
> On an entity autocomplete (instrument, artist…), save the value with its MBID appended, e.g. `handclaps b8d84cec-…`. Recalling it then selects that entity directly.

**`{ } JSON`** switches the list to editable JSON, which is also the export (copy) and import (paste + **Apply**):

```json
[
  { "selector": "div.instrument div.autocomplete2 input", "label": "Instrument", "deltax": 16 },
  { "selector": "input.tag-input", "label": "Tags", "submit": true },
  { "selector": "#some-field", "label": "Off for now", "enable": false }
]
```

Keys: `selector` (required), `label`, `deltax` (px), `deltav` (lvl), `submit`, `enable`, and `mbid`, which only means something on the built-in Label and Artist fields.

## Settings

**⚙** opens three tabs: **Settings**, **[Babies](#custom-fields)**, and **Import / Export** (paste many notes, or *Export all*, one note per line or separated by empty lines).

<img src="screenshots/options.png" width=350/>

| Setting                        | Default |                                                       |
| ------------------------------ | ------- | ----------------------------------------------------- |
| Scope per resource             | off     | separate notes per edit-note type                     |
| Hide help text                 | off     | hide MusicBrainz's help above the field               |
| Default click action           | replace | or append; right-click does the other                 |
| Insert new line when appending | on      | an appended note starts on a new line                 |
| Show note search               | off     | a search box over the saved notes                     |
| Sort saved notes               | Manual  | or Most used, Recent                                  |
| Button label length            | 24      | characters on pinned buttons (4–80)                   |
| Items shown                    | 6       | rows before the list scrolls                          |
| History size                   | 10      | submitted notes to remember (1–50)                    |
| Show mammoth babies            | on      | the [Mammoth babies](#mammoth-babies) on other fields |

## Shortcuts

In the edit-note field:

| Key          |                                                             |
| ------------ | ----------------------------------------------------------- |
| Ctrl + Enter | submit the edit                                             |
| Ctrl + ↑ / ↓ | cycle through saved notes                                   |
| Ctrl + B / I | bold / italic around the selection or the word at the caret |
| Ctrl + ,     | focus the note search                                       |

On a saved note or a pinned button:

|              |                                       |
| ------------ | ------------------------------------- |
| click        | apply with the default action         |
| right-click  | apply the other way                   |
| Ctrl + click | replace the field and submit the edit |

In a baby field, **Ctrl + ,** opens its panel with the filter focused; ↑ / ↓ and Enter pick a value. (Ctrl is ⌘ on a Mac.)

## Notes

Mammoth adds its panel to every edit-note field on the page, including the ones other userscripts add, such as their own edit windows. How another script hosts it, and adds a baby to its own fields, is in [DEVELOP.md](DEVELOP.md).
