# Developing mb-userscripts

Repo-wide development and release procedure. Per-userscript dev guides live next to each script
(e.g. [`userscripts/discogs_credits/DEVELOP.md`](userscripts/discogs_credits/DEVELOP.md)).

## Branching

- **Substantial work goes on a feature branch** (`feat/<name>`). Only **trivial / small** updates go
  straight to `main`.
- **`main` must always be releasable.** The release model is `merge main → stable`, which ships the
  *entire* `main` history at that moment — so anything committed to `main` is implicitly queued for the
  next stable release. Keeping non-trivial work on branches means a release can never leak unfinished work.
- Land a feature branch into `main` only when it's ready to ship; merge `main → stable` (or run the
  publish script below) to release.

## Channels

- **`main`** — latest. The *latest* install links point here.
- **`stable`** — official releases. The *stable* install links point here; userscript managers auto-update
  from whichever branch the user installed from. Each script carries its own `@version`.

## Releasing — `dev/publish.mjs`

Date-based releases (one GitHub Release per publish, tagged `YYYY.M.D`), since each script keeps its own
`@version`.

```bash
node dev/publish.mjs            # DRY RUN — print the plan, write/push nothing
node dev/publish.mjs --yes      # execute
```

What a run does:

1. Collects **closed issues** that are not yet labelled **`released`**, carry an **`area | <script>`**
   label and a **`bug`** or **`enhancement`** label, and are **not** `skip changelog` / `wontfix`.
2. Groups them per script (`enhancement` → *Features*, `bug` → *Fixes*) and prepends a dated section to
   each script's `CHANGELOG.md`.
3. Determines which scripts' `.user.js` changed since `stable` — those get two install links in the
   release: one **pinned** to the merge commit (frozen) and one tracking `stable` (**auto-updates** to
   future releases). Scripts with issues but no code change are still changelogged.
4. With `--yes`: commits the changelogs on `main`, merges `main → stable`, pushes both, creates the dated
   GitHub Release, and labels every included issue **`released`**.

Run the dry run first and read the plan. `--yes` must be run on a clean `main`.

### Labels used

- `area | <script>` — which userscript an issue belongs to (maps to `userscripts/<script>/`).
- `bug` → *Fixes*, `enhancement` → *Features*.
- `skip changelog`, `wontfix` — excluded from the changelog.
- `released` — applied by the publish run so an issue is only ever changelogged once.

## What lives in `dev/`

Shared tooling for the whole repo. Nothing here ships to users — every file is
either a code generator, a checker, or an operational script. **Keep it that
way**: `dev/` is not a scratch directory, and anything that is not one of the
four kinds below does not belong at its root.

### Code generators — run by the pre-commit hook

Each writes into marker blocks (`// <ST-…>` … `// </ST-…>`) inside the scripts.
**Edit the source module, never the generated block**; the hook re-syncs and
re-stages every carrier when the module changes.

| Source | Generator | Marker |
|---|---|---|
| `design-tokens.mjs` | `sync-tokens.mjs` | `// <ST-TOKENS>` |
| `ui-components.mjs` | `sync-ui.mjs` | `// <ST-UI>` |
| `platform-icons.mjs` | `sync-icons.mjs` | `// <ST-ICONS>` |

A new script adopts them by pasting the two marker lines at **module scope**
(not inside a function — the generated helpers are function declarations, and a
nested block makes them invisible everywhere else) and prepending `MBU_TOKENS`
to its stylesheet. `verify-tokens.mjs` checks both.

### Checkers

Static first, live second. The live ones drive real pages on
`test.musicbrainz.org` and abort every POST, so they never write.

| Script | Answers |
|---|---|
| `verify-tokens.mjs` | are the generated blocks present, current, at module scope, and is every referenced token defined? |
| `verify-tokens-live.mjs` | do the tokens actually resolve in a page? |
| `verify-ui-live.mjs` | do the shared components behave as agreed — and did every CSS rule a script wrote survive parsing? |
| `verify-theme-live.mjs` | with a dark userstyle on, is any control in our windows still light? |
| `verify-contrast-live.mjs` | is every label readable? `--light` checks the light theme, `--novars` the case where a dark userstyle paints the page but defines no variables |
| `shoot-ui.mjs` | 46 numbered screenshots into `screens/ui/`, light and dark, with an index |

Two habits these encode, both learned the hard way:

- **a check that measured nothing must fail, not pass.** `verify-contrast-live`
  takes a census of how many of our elements were on screen; two scripts were
  scoring "ok" on empty pages for days.
- **don't reason about CSS, render it.** MusicBrainz's stylesheet is
  cross-origin and invisible to `document.styleSheets`, so reading our own CSS
  proves nothing about what wins.

### Operational scripts

| Script | Purpose |
|---|---|
| `publish.mjs` | the release — changelog, `main → stable`, dated GH release (see above) |
| `gh-inbox.mjs` | every issue comment newer than my last reply, printed in full |
| `install-hook.mjs` | points `core.hooksPath` at `.githooks/` |
| `github-notifications/`, `notif-channel/` | the GH notification → channel pipeline |
| `script-metrics/` | standalone dashboard of edits made with these scripts; own `npm install` |

### Screenshots

`dev/screens/ui/` is generated and tracked — its numbers are stable, so "31 dark
is wrong" means the same picture in every future run. **Never renumber**; append.

Working screenshots taken while iterating on an issue go to `dev/_*.png`, which
is gitignored and disposable. They are not documentation and must not be
committed; 29 of them had accumulated in the repo before #561.

## Conventions

### Design tokens — `dev/design-tokens.mjs`

**Colour, font, radius, shadow and z-index values belong in `dev/design-tokens.mjs`, not in a
script's CSS.** That file is the single place the look is configured (#562); everything else
consumes it as `var(--mbu-…)`.

A script opts in by carrying a marker pair once, which `dev/sync-tokens.mjs` fills in:

```js
// <ST-TOKENS> — generated by dev/sync-tokens.mjs from dev/design-tokens.mjs — DO NOT EDIT
const MBU_TOKENS = ':root{--mbu-bg:#fff;…}';
// </ST-TOKENS>

const css = MBU_TOKENS + `
  .x-panel{background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border)}
`;
```

- Run `node dev/sync-tokens.mjs` after editing values — the pre-commit hook does it for you when
  `dev/design-tokens.mjs` changes. Never hand-edit a generated block. Same mechanism as the shared
  platform icons (`// <ST-ICONS>`, #404).
- **Semantic names only.** `--mbu-ok`, never `--mbu-green`; a name that describes the appearance
  can't be re-themed without lying about what it is.
- **Brand colours are exempt** and stay literal — Spotify green and the rest are facts about the
  outside world, in `dev/platform-icons.mjs`. Someone will eventually "fix" them otherwise.
- **Adopting tokens is a refactor: nothing may render differently.** Prove it rather than eyeball
  it — expand every `var(--mbu-*)` in the new stylesheet back to its literal and compare to the old
  one, and diff computed style over the live UI. See `userscripts/art_station/test/verify-562-tokens.mjs`,
  which does both. Deliberate exceptions (two scripts disagreeing, one having to give) get called
  out in the commit, with a screenshot.
- **A script with more than one `<style>` element must prepend `MBU_TOKENS` to every one of them.**
  Apollo has three and Platform Check two; either can mount without the other, and only the sheet
  carrying the `:root` rule would resolve. An undefined `var()` does **not** fall back to the old
  colour — the whole declaration is discarded — and that is invisible to the textual proof above,
  because the substitution itself is faithful. Two checks guard it:
  - `node dev/verify-tokens.mjs` — static: every referenced token exists, every carrier's block is
    in sync, every style sink is wired.
  - `node dev/verify-tokens-live.mjs` — loads each script on a real sandbox page and asserts that
    every token referenced by a live rule actually resolves.
- Several scripts on one page — or all of them, via String Theory — each emit the same `:root`
  rule. The duplicates are byte-identical, so the last one wins harmlessly.

### Shared UI components — `dev/ui-components.mjs`

**The standard widgets — help link, toast, and the rest as they land — are defined once in
`dev/ui-components.mjs`, not per script** (#563). Companion to the design tokens: tokens say what
things look like, this says what they *are*.

A script opts in with a `// <ST-UI>` marker pair, which `dev/sync-ui.mjs` fills in with
`MBU_UI_CSS` plus the component helpers. Concatenate `MBU_UI_CSS` into the same sheets as
`MBU_TOKENS`, and reach the helpers directly (`mbuHelpEl`, `mbuToast`) or via `window.MBU`.

- **One class prefix — `mbu-`.** A userstyle targets a component once instead of once per script.
- **Interaction is part of the contract**, not just appearance. "Looks the same but `Esc` doesn't
  work" is the drift this exists to stop, so keyboard/mouse behaviour lives in the component too.
- **Delete the per-script rule you're replacing.** A leftover with higher specificity silently wins
  and the script never actually adopts the component.
- **Adopting a component may change how a script looks** — that's the point when it was the odd one
  out (Fusion's help link was Spotify green). Say which one won, and why, in the commit.
- `node dev/verify-ui-live.mjs` drives each component in every adopting script on a real page and
  asserts the contract — markup, computed style, and behaviour.

### Settings storage

**User-facing settings/preferences use `GM_setValue`/`GM_getValue`, never `localStorage`.**
GM storage is covered by the userscript manager's own backup/restore and cross-browser sync;
`localStorage` is scoped to the browser profile and isn't — a user restoring a manager backup or
moving to a new browser silently loses every localStorage-based setting (#501). It's also
per-script, unlike `localStorage` which every script on the same origin shares — two scripts using
the same literal key string will otherwise leak state into each other by accident, not by design.

- Declare `// @grant GM_getValue` and `// @grant GM_setValue` in the userscript header.
- `localStorage`/`sessionStorage` are still the right tool for things that are genuinely NOT a
  setting: TTL caches (e.g. a resolved-link cache), shared auth/session tokens read by more than
  one script off the same MB origin, and tab-scoped ephemeral state (`sessionStorage` only — a
  volume level mid-playback, not a durable preference).
- When migrating an existing script off `localStorage`, use a one-time, non-destructive shim —
  adopt the old localStorage value into GM storage if GM storage is empty, then write through to
  GM storage from then on; leave the old localStorage key in place (unused) rather than deleting
  it, so a bug in the migration never loses data:
  ```js
  const gmLoad = (key) => {
    try { const v = GM_getValue(key, undefined); if (v !== undefined) return v; } catch (e) {}
    try { const raw = localStorage.getItem(key); if (raw != null) { GM_setValue(key, raw); return raw; } } catch (e) {}
    return undefined;
  };
  const gmSave = (key, raw) => { try { GM_setValue(key, raw); } catch (e) {} };
  ```
- A script that needs page-context globals (e.g. reading a variable another page script attached
  to `window`) can't combine that with `@grant none` once it also needs `GM_setValue`/`GM_getValue`
  — `@grant none` runs the script unsandboxed in the page's own context, which is mutually
  exclusive with declaring real grants. Use `@grant unsafeWindow` instead and read page globals off
  a `pageWindow` that falls through to plain `window` when `unsafeWindow` isn't defined (Playwright
  / test mode):
  ```js
  const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow
      : (typeof window !== 'undefined') ? window : globalThis;
  ```
- Playwright tests must mock `GM_getValue`/`GM_setValue` with something that actually stores a
  value (a `Map`, or — if the test does a real `page.reload()` and needs the value to survive it —
  namespaced `localStorage` keys via `page.addInitScript`), not a no-op (`() => {}` / `() => d`).
  A no-op silently swallows every save, which reads as "it works" right up until a persistence
  test's assertions quietly stop meaning anything.

## Bot identity

AI-driven commits/issues use the **`claude-ai-milic`** account; the token lives in
`dev/.github-credentials.json` (gitignored). See a per-script DEVELOP for the full setup.
