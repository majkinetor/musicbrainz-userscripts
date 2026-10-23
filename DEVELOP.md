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
- Which work goes straight to `main` and which on a feature branch: [Standard 13](dev/agents/STANDARDS.general.md#standard-13).
- Each script has its own `@version`, bumped with every change: the date of the change (`2026.9.28`), with the time appended for a second change the same day (`2026.9.28.214729`), so read the current value before bumping.

## Checks

- **Pre-commit hook** (`.githooks/`, set up by `pnpm install`): a staged userscript must parse and lint clean; then Credit Hoarder's `dist/` and the String Theory bundle are rebuilt from what's being committed, and the shared blocks re-synced.
- **CI** (`.github/workflows/`):
  - `checks.yml`, on every push and pull request, runs the syntax check, the linters, the design-token check and the `@unit` specs, then the `@critical` specs on test.musicbrainz.org. A pull request must also carry the builds of its sources (`node dev/regen.mjs --check`).
  - `build.yml`, on every push to `main`, rebuilds what the hook builds (`node dev/regen.mjs`) and commits it as `github-actions[bot]` when a commit came without the hook: the web editor, another machine, `--no-verify`, a merge. Where the hook ran, it finds nothing to commit. The hook stays: it builds in the same commit (so a pinned install link works at once, on a feature branch too), and it stops a script that doesn't parse or lint.
  - `suite.yml` runs the whole suite nightly.
- **Tests** are in [`dev/test`](dev/test/README.md): one Playwright runner for every script, on test.musicbrainz.org, with a guard that refuses any write to production.

## Releasing

Releases are dated (tag `YYYY.M.D`), one GitHub Release per publish, made from **Actions → release → Run workflow** (`release.yml`), as `github-actions[bot]`. Its *mode*:

- **dry run**: prints the changelog, the issues and the release notes; changes nothing.
- **release**: checks first (as `checks.yml`, without `@critical`, which already ran on each push to `main`), then everything below, with the PDF manual built on the runner. It fails before anything is pushed if the PDF doesn't build.
- **silent release**: `main` goes to `stable`, so installs update, and nothing else: no changelog, no GitHub release, no labels. Its issues go out with the next full release, and the scripts it shipped get their install links then.

The same by hand, from a clean `main` (the PDF is then best-effort):

```sh
node dev/publish.mjs                  # dry run
node dev/publish.mjs --yes            # release
node dev/publish.mjs --silent --yes   # silent release
```

A run:

1. collects the closed issues not yet labelled `released` that have an `area | <script>` label and `bug` or `enhancement`, plus those labelled `general` (not `skip changelog` or `wontfix`); the labels are in [STANDARDS → Labels](STANDARDS.md#labels);
2. prepends a dated section to each script's `CHANGELOG.md` (*Features* from `enhancement`, *Fixes* from `bug`), with the `general` issues first in String Theory's;
3. lists the scripts whose `.user.js` changed since the last GitHub release, each with a pinned install link and one that follows `stable`;
4. with `--yes`: commits the changelogs, merges `main` into `stable`, pushes both, creates the release, attaches String Theory's `String_Theory.pdf` to it, and labels the issues `released`.

A release made by hand on GitHub gets its PDF from `pdf.yml`, which can also be run for any release tag.

## What's in `dev/`

Nothing here ships. A script belongs in its subsystem's folder, next to that folder's README; only repo-wide operations sit at the root.

|                                                             |                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`tokens/`](dev/tokens/README.md)                           | design tokens and themes, the one place the look is set                                                  |
| [`ui/`](dev/ui/README.md)                                   | the shared components and platform icons, with their live checks                                         |
| `match/`                                                    | the shared artist matcher (Apollo, Group Therapy, Credit Hoarder)                                        |
| `archive/`                                                  | the shared Wayback Machine saving (First Contact, Apollo)                                                |
| [`guesscase/`](dev/guesscase/README.md)                     | the shared guess case (Apollo, Mission Control)                                                          |
| `mbpage/`                                                   | the shared helpers for reading MusicBrainz's pages in any language (Art Station, Falcon, Credit Hoarder) |
| [`test/`](dev/test/README.md)                               | the test runner and harness                                                                              |
| [`all-icons-generator/`](dev/all-icons-generator/README.md) | every script's icon side by side, fitted to one box                                                      |
| `screens/ui/`                                               | generated screenshots; numbers are stable, so never renumber, only append                                |
| [`script-metrics/`](dev/script-metrics/README.md)           | edits made with these scripts, counted from the MusicBrainz database dump, in Docker                     |
| `site-proposals/`, `reports/`                               | design proposals and measurement reports kept for reference                                              |
| `templates/`                                                | starting points: a script's README in the [compact style](STANDARDS.md#script-readmes)                   |
| `publish.mjs`                                               | the release (run by `release.yml`)                                                                       |
| `regen.mjs`                                                 | rebuilds everything the pre-commit hook builds; `--check` fails if that changes anything                 |
| `gh-inbox.mjs`                                              | every issue comment newer than the bot's last reply                                                      |
| `align-md-tables.mjs`                                       | pads Markdown tables so their columns line up                                                            |
| `install-hook.mjs`                                          | points `core.hooksPath` at `.githooks/`                                                                  |

Screenshots taken while working on an issue go to `dev/_*.png`, which is ignored; they are never committed.

Two rules the checkers are built on:

- **A check that measured nothing fails.** `verify-contrast-live` counts how many of our elements were on screen, after two scripts scored "ok" on empty pages for days.
- **Render CSS, don't reason about it.** MusicBrainz's stylesheet is cross-origin and invisible to `document.styleSheets`, and a `filter` applies after the cascade.

## Conventions

### Finding things on MusicBrainz's pages

MusicBrainz translates every label, heading and name into the user's interface language, and changes its layout without notice. A script that finds an element by its English text breaks for every non-English user; one that finds it by its place breaks on the next layout change. In this order of preference:

1. **MusicBrainz's data, not the page**: the JSON a page embeds (`script[type="application/json"]`), `/ws/js`, ws/2, the Cover Art Archive, a form's own fields. A new request in a shipped script needs the maintainer's OK first.
2. **A structural hook**: an id (`#release-rels`), a class (`h2.external-links`, `dd.barcode`), a form field's `name` (`period.ended`), a Knockout `data-click` (`submitEdits`, `nextTab`), a link's address (`/annotation/<id>`).
3. **A name MusicBrainz shows translated** goes through its stable id: a select's option `value`, a checkbox's `value` (cover-art types in [`<ST-MBPAGE>`](#shared-blocks)).
4. **Text or position only as a fallback, and checked**: kept after a hook for older markup, or accepted only if the result passes a check; otherwise the next source, never a guess.

A translation of MusicBrainz's text is the last resort. If one is ever needed, it goes in `dev/mbpage/mb-page.mjs`, keyed by language, not in a script. To see a page in another language, set the `lang` cookie (`de`, `fr`, …), as `art_station/test/721-non-english-types.spec.mjs` does.

### Shared blocks

Code several scripts need is written once and copied into each between marker comments, which a sync script fills in. The pre-commit hook re-syncs them; never edit inside the markers.

| Marker | Source |  |
| --- | --- | --- |
| `// <ST-TOKENS>` | `dev/tokens/design-tokens.mjs` | colours, fonts, radii, shadows, z-indexes as `var(--mbu-…)` |
| `// <ST-UI>` | `dev/ui/ui-components.mjs` | components (`mbu-` classes): help link, toast, log window and its startup line (`mbuStartupInfo`), corner stacking, the tooltip, the settings' drop-downs and steppers (`mbuControls`), … |
| `// <ST-TIP>` | `dev/ui/tooltip.mjs` | the tooltip alone, for a script off the ST-UI block (Scribe, Bandcamp Player Enhanced); never beside ST-UI |
| `// <ST-ICONS>` | `dev/ui/platform-icons.mjs` | platform icons and brand colours |
| `// <ST-MATCH>` | `dev/match/artist-match.mjs` | the artist matcher and sort-name guess |
| `// <ST-IMGMAX>` | `dev/imgmax/image-maximizer.js` | the largest cover behind a store page or image URL ([API](dev/imgmax/README.md)) |
| `// <ST-GUESSCASE>` | `dev/guesscase/guess-case.mjs` | MusicBrainz's guess case without its editors, with more languages ([API](dev/guesscase/README.md)) |
| `// <ST-NET>` | `dev/net/mb-gate.mjs` | the MusicBrainz request gate (`mbnFetch`): ws/2 paced for every script and tab, and MusicBrainz's browser check passed again when it answers a website request |
| `// <ST-MBPAGE>` | `dev/mbpage/mb-page.mjs` | MusicBrainz's page read in any language: cover-art type ids, the release's own external links |
| `// <ST-ARCHIVE>` | `dev/archive/wayback.mjs` | saving pages on the Wayback Machine, and the archive.org keys (GM `mbu.archive`) with their settings fields |

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

The exception is a **shared setting**, one that belongs to all the scripts at once: it goes in [shared storage](#shared-storage).

A script that also reads the page's own globals uses `@grant unsafeWindow`, not `@grant none` (which can't be combined with GM grants):

```js
const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
```

Specs get a working GM store from the harness (`test.use({ gm: … })`); a no-op mock would swallow every save.

### Shared storage

Most settings belong to one script and live in its GM storage, which no other script can read. A few belong to all the scripts at once, like the corner launchers' layout, and those live in **shared storage**: MusicBrainz's own `localStorage`, where every script sees the same value, whether it runs in String Theory or on its own.

- **Read and write** with `mbuShared(key[, value])` from the ST-UI block. One argument reads the value (`undefined` when unset or storage is blocked); two write it; `null` removes it.
- **Keys** are stored as `mbu.<key>`, with the value as JSON.
- **Per origin**: musicbrainz.org, beta and test each keep their own copy.
- **No backup**: the userscript manager doesn't back it up or sync it, so keep shared settings few and cosmetic.
- **A script off the ST-UI block** (Scribe) reads the key itself: `JSON.parse(localStorage.getItem('mbu.<key>'))`.
- **By hand**: in the browser console (F12) on a MusicBrainz page, `localStorage.setItem('mbu.<key>', '<JSON>')` sets a key and `localStorage.removeItem('mbu.<key>')` clears it. Reload to see the change.

| Key | Values | What reads it | Set by |
| --- | --- | --- | --- |
| `cornerFlow` | `"row"`; unset is a column | `mbRestackCorner`: the corner launchers' layout | String Theory's menu |
| `cornerSide` | `"left"`; unset is the right | `mbRestackCorner` and Scribe's window: the corner launchers' side of the screen, every corner mirrored | String Theory's menu |
| `isrcFormat` | `false`; unset is on | ISRC Scout and Mission Control: ISRCs shown as `CC-XXX-YY-NNNNN` | ISRC Scout's *Show ISRCs in parts* |
| `extLinksHeading.<lang>` | the release's "External links" heading in that language | `mbpReleaseLinkList`: tells the release's links from the release group's when the page shows one list | learnt by `mbpReleaseLinkList` on a release page that shows both |

A new shared setting gets a row here.

## Bot identity

Assistant commits, comments and releases use the **`claude-ai-milic`** account ([Standard 7](dev/agents/STANDARDS.general.md#standard-7) says how).

One-time setup, by the maintainer:

1. Create the account and add it as a collaborator with write access; accept the invite as the bot.
2. As the bot, create a classic token at <https://github.com/settings/tokens> with `repo` and `write:discussion`.
3. Save it in the hub's `C:\ai\_hub\.github-credentials.json`, the token's only home on the machine:

   ```jsonc
   { "username": "claude-ai-milic", "token": "github_pat_..." }
   ```
