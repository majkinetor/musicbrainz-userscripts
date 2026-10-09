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
