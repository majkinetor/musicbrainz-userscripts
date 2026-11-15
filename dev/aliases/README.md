# Alias editor

The shared bulk alias editor used by Apollo and Event Horizon. Edit `alias-editor.mjs`, then run:

```powershell
node dev/aliases/sync-aliases.mjs
```

The sync fills each script's `ST-ALIASES` and `ST-LANDE` marker blocks. String Theory writes each block once. The pre-commit hook runs the sync automatically.

`lande-vendor.js` contains Apollo's existing lande 1.0.10 model (MIT). It is built lazily when the first suggestion is computed. To update the pinned model, install Apollo's dependencies and rebuild from its folder:

```powershell
pnpm install
pnpm vendor:lande
```

An empty locale shows its recognized one as a placeholder; the editor applies it for one row or every empty row on request. Only supported base locales with at least 80% detector confidence are accepted; aliases with fewer than four letters and uncertain results stay empty. No network request is made. Import providers can return names as strings or `{ name, source }` objects; Discogs rows retain source links until the editor reloads.
