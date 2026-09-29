# Developing mb-userscripts

How the repo is worked on and released. A script with its own build has a guide beside it: [Credit Hoarder](userscripts/credit_hoarder/DEVELOP.md).

```sh
pnpm install          # once: the test runner, the linter, and the pre-commit hook
pnpm test             # every script's specs (see dev/test)
pnpm lint
```

## Branches and channels

- **`main`** is latest; the *latest* install links point at it. It must always be releasable, because a release ships all of it.
- **`stable`** is the official release; the *stable* install links point at it. Userscript managers update from whichever branch the script was installed from.
- Substantial work goes on a feature branch named after the issue (`<topic>-<issue>`) and is merged when it's ready to ship. Small fixes go straight to `main`.
- Each script has its own `@version`: the date of the change (`2026.9.28`), with the time appended for a second change the same day (`2026.9.28.214729`).

## Checks

- **Pre-commit hook** (`.githooks/`, set up by `pnpm install`): a staged userscript must parse and lint clean; then Credit Hoarder's `dist/` and the String Theory bundle are rebuilt from what's being committed, and the shared blocks re-synced.
- **CI** (`.github/workflows/`): `checks.yml` on every push and pull request runs the syntax check, the linters, the design-token check and the `@unit` specs, then the `@critical` specs on test.musicbrainz.org. `suite.yml` runs the whole suite nightly.
- **Tests** are in [`dev/test`](dev/test/README.md): one Playwright runner for every script, on test.musicbrainz.org, with a guard that refuses any write to production.

## Releasing

Releases are dated (tag `YYYY.M.D`), one GitHub Release per publish.

```sh
node dev/publish.mjs            # dry run: prints the plan, changes nothing
node dev/publish.mjs --yes      # on a clean main
```

A run:

1. collects the closed issues not yet labelled `released` that have an `area | <script>` label and `bug` or `enhancement` (not `skip changelog` or `wontfix`);
2. prepends a dated section to each script's `CHANGELOG.md` (*Features* from `enhancement`, *Fixes* from `bug`);
3. lists the scripts whose `.user.js` changed since `stable`, each with a pinned install link and one that follows `stable`;
4. with `--yes`: commits the changelogs, merges `main` into `stable`, pushes both, creates the release, attaches String Theory's `DOCS.pdf` to it, and labels the issues `released`.

Changelogs are only ever written by this run.

## What's in `dev/`

Nothing here ships. A script belongs in its subsystem's folder, next to that folder's README; only repo-wide operations sit at the root.

| | |
|---|---|
| [`tokens/`](dev/tokens/README.md) | design tokens and themes, the one place the look is set |
| [`ui/`](dev/ui/README.md) | the shared components and platform icons, with their live checks |
| `match/` | the shared artist matcher (Apollo, Group Therapy, Credit Hoarder) |
| [`test/`](dev/test/README.md) | the test runner and harness |
| `screens/ui/` | generated screenshots; numbers are stable, so never renumber, only append |
| `github-notifications/`, `notif-channel/` | GitHub notifications into the assistant's channel |
| [`script-metrics/`](dev/script-metrics/README.md) | edits made with these scripts, counted from the MusicBrainz database dump, in Docker |
| `site-proposals/`, `reports/` | design proposals and measurement reports kept for reference |
| `publish.mjs` | the release |
| `gh-inbox.mjs` | every issue comment newer than the bot's last reply |
| `align-md-tables.mjs` | pads Markdown tables so their columns line up |
| `install-hook.mjs` | points `core.hooksPath` at `.githooks/` |

Screenshots taken while working on an issue go to `dev/_*.png`, which is ignored; they are never committed.

Two rules the checkers are built on:

- **A check that measured nothing fails.** `verify-contrast-live` counts how many of our elements were on screen, after two scripts scored "ok" on empty pages for days.
- **Render CSS, don't reason about it.** MusicBrainz's stylesheet is cross-origin and invisible to `document.styleSheets`, and a `filter` applies after the cascade.

## Conventions

### Shared blocks

Code several scripts need is written once and copied into each between marker comments, which a sync script fills in. The pre-commit hook re-syncs them; never edit inside the markers.

| Marker | Source | |
|---|---|---|
| `// <ST-TOKENS>` | `dev/tokens/design-tokens.mjs` | colours, fonts, radii, shadows, z-indexes as `var(--mbu-…)` |
| `// <ST-UI>` | `dev/ui/ui-components.mjs` | components (`mbu-` classes): help link, toast, log window, corner stacking, … |
| `// <ST-ICONS>` | `dev/ui/platform-icons.mjs` | platform icons and brand colours |
| `// <ST-MATCH>` | `dev/match/artist-match.mjs` | the artist matcher and sort-name guess |

**Tokens**

- Colours and the rest belong in the tokens, not in a script's CSS. Names are semantic: `--mbu-ok`, never `--mbu-green`. Brand colours stay literal, in the platform icons.
- Every `<style>` a script makes starts with `MBU_TOKENS`: an undefined `var()` doesn't fall back, it drops the whole declaration.
- Moving a script onto tokens must not change a pixel: expand the `var()`s and compare with the old sheet, and diff computed styles on the live page. `node dev/tokens/verify-tokens.mjs` (static) and `verify-tokens-live.mjs` (on the sandbox) guard it afterwards.

**Components**

- Behaviour is part of a component (keys, clicks), not only its look.
- Delete the script's own rule when adopting a component; a leftover with higher specificity silently wins.
- If adopting one changes how a script looks, say which one won, and why, in the commit. `node dev/ui/verify-ui-live.mjs` checks every adopting script.

### Settings storage

Settings go in `GM_setValue` / `GM_getValue`, never `localStorage`: the manager backs them up and syncs them, and they're private to the script (#501). `localStorage` is for what isn't a setting: caches with a lifetime, tokens several scripts share on MusicBrainz's origin, and `sessionStorage` for state that belongs to one tab.

A script that also reads the page's own globals uses `@grant unsafeWindow`, not `@grant none` (which can't be combined with GM grants):

```js
const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
```

Specs get a working GM store from the harness (`test.use({ gm: … })`); a no-op mock would swallow every save.

## Bot identity

Assistant commits, comments and releases use the **`claude-ai-milic`** account, so they're told apart from the maintainer's. Its token is in `dev/.github-credentials.json` (ignored by Git) and is used explicitly, never through the maintainer's `gh` login.

One-time setup, by the maintainer:

1. Create the account and add it as a collaborator with write access; accept the invite as the bot.
2. As the bot, create a classic token at <https://github.com/settings/tokens> with `repo` and `write:discussion`.
3. Save it:

   ```jsonc
   { "username": "claude-ai-milic", "token": "github_pat_..." }
   ```
