# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Using Mammoth from another userscript

Mammoth enhances **any** `textarea.edit-note` on the page, including fields another script adds later, so another script can host the panel with no API:

1. Give your edit-note field `class="edit-note"`.
2. History is recorded when a button whose text starts with *Enter edit*, *Submit*, *Add edit* or *Save* (or with class `submit`) is clicked.
3. Fit the layout with CSS scoped to your container, for example:

   ```css
   #your-dialog .mmth-wrap { margin: 0 0 12px; max-width: none; gap: 10px; }
   #your-dialog .mmth-vsep { display: none; }
   ```

For a baby on your own field, add `class="mmth-pin"`:

```html
<input class="mmth-pin" data-mmth-key="my-cat-no" data-mmth-label="Catalogue №">
```

`data-mmth-key` (fields sharing a key share values), `data-mmth-label` (the panel title) and `data-mmth-dx` (pin nudge, px) are optional.

## What History records

History saves a note only from a field the user wrote in, so a note another script fills in by itself stays out, whether it comes from the suite (Falcon's links, Art Station's cover upload) or a third-party script ([#1082](https://github.com/majkinetor/musicbrainz-userscripts/issues/1082)).

- A capturing `input` listener adds a `textarea.edit-note` to a `WeakSet` (`touchedNotes`) when the event's `isTrusted` is true, which the browser sets only for the user's own typing, pasting, dropping or deleting. A script that sets `.value` and dispatches its own `input` sends `isTrusted: false`, and a page can't fake it.
- Mammoth's own `setValue` adds the field too, so a note applied from Mammoth counts as the user's.
- On submit, `captureNote` records only the fields in the set. The set lasts as long as the page.
- So a note the user edited is saved whole, automatic text included; a browser extension that types (autofill, text expanders) counts as the user; a note pre-filled from a seed (Harmony) is skipped unless edited.
