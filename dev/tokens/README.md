# Design tokens

**The single place the look is configured** (#562). Colour, font, radius, shadow
and z-index values belong here, not in a script's CSS; everything else consumes
them as `var(--mbu-…)`.

| File | What it is |
|---|---|
| `design-tokens.mjs` | the token set and the theme variants — **the only file you edit** |
| `sync-tokens.mjs` | inlines the tokens into every script carrying `// <ST-TOKENS>` |
| `verify-tokens.mjs` | static checks: block present, current, at module scope, no unknown token |
| `verify-tokens-live.mjs` | do the tokens actually resolve in a real page? |

```bash
node dev/tokens/sync-tokens.mjs     # the pre-commit hook runs this for you
node dev/tokens/verify-tokens.mjs
```

## Adding a script

Paste the two marker lines at **module scope** — not inside a function, because
the generated block declares functions and a nested copy is invisible to every
other call site — then prepend `MBU_TOKENS` to the script's stylesheet:

```js
// <ST-TOKENS>
// </ST-TOKENS>
…
style.textContent = MBU_TOKENS + MBU_UI_CSS + '…the script's own rules…';
```

`verify-tokens.mjs` checks all of that, including that a bundled script
(`src/*.js` compiled into one `dist/`) carries the block **once** rather than
once per module.

## Rules

- **Semantic names only.** `ok`, never `green`. A name that says what a colour is
  *for* can be re-themed; one that says what it *looks like* cannot.
- **Brand colours do not live here.** Spotify green, Discogs black and the rest
  are data about the outside world — they belong in `../ui/platform-icons.mjs`
  and stay literal.
- **An array value emits two declarations**: a literal first, then a derived
  form (`color-mix(...)`). Browsers that cannot parse the second keep the first.

## Themes

A variant is a name and the tokens it overrides, selected by `data-mbu-theme` on
`<html>` — which `../ui/ui-components.mjs` sets by measuring the rendered page.
Adding "high-contrast" later is one more entry in `VARIANTS`.

Two things learned the hard way, both in the comments there:

- **the dark variant states its own values.** Seeding from `var(--background)`
  looks tidy and breaks in two directions: most dark userstyles define no
  variables at all, and some define a *light* `--background` while painting the
  page dark. Adopting the userstyle's shades is opt-in, gated on
  `data-mbu-seed="theme"`, which is set only after the value has been measured
  and found to agree with the detected theme.
- **a token used as both a fill and text needs to be two tokens.** `--mbu-accent`
  is the button fill; `--mbu-accent-text` is the same purple as text. Dark wants
  opposite things from them, and one token cannot do both jobs.
