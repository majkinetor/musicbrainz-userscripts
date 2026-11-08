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
- Each script has its own `@version`, bumped with every change by `node dev/bump-version.mjs [<script>…]` (no names: every script with uncommitted changes), never typed by hand: it writes the local date and time (`2026.09.28.214729`), or one second past the version already in the file or on `origin/main` when that is higher, so a guessed time can't push versions into the next day. Built files (`dist/`, the String Theory bundle) are stamped by their build.

## Checks

- **Pre-commit hook** (`.githooks/`, set up by `pnpm install`): a staged userscript must parse and lint clean; then Credit Hoarder's `dist/` and the String Theory bundle are rebuilt from what's being committed, and the shared blocks re-synced.
- **CI** (`.github/workflows/`):
  - `checks.yml`, on every push and pull request, runs the syntax check, the linters, the design-token check and the `@unit` specs, then the `@critical` specs on test.musicbrainz.org. A pull request must also carry the builds of its sources (`node dev/regen.mjs --check`).
  - `build.yml`, on every push to `main`, rebuilds what the hook builds (`node dev/regen.mjs`) and commits it as `github-actions[bot]` when a commit came without the hook: the web editor, another machine, `--no-verify`, a merge. Where the hook ran, it finds nothing to commit. The hook stays: it builds in the same commit (so a pinned install link works at once, on a feature branch too), and it stops a script that doesn't parse or lint.
  - `suite.yml` runs the whole suite nightly.
  - `issue-label.yml`, on every opened issue, adds the `area | …` label of each script its title names and takes a leading `<Script>: ` off the title ([`dev/issue-label`](dev/issue-label/README.md)).
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
| `bump-version.mjs`                                          | raises a script's `@version` from the clock, never below what's out                                      |
| `regen.mjs`                                                 | rebuilds everything the pre-commit hook builds; `--check` fails if that changes anything                 |
| [`issue-label/`](dev/issue-label/README.md)                 | labels a new issue by the scripts its title names (the `issue-label` workflow)                           |
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
| `// <ST-UI>` | `dev/ui/ui-components.mjs` | components (`mbu-` classes): help link, toast, log window and its startup line (`mbuStartupInfo`), automated mode (`mbuAutomated`, [#936](https://github.com/majkinetor/musicbrainz-userscripts/issues/936)), corner stacking, the tooltip, the settings' drop-downs and steppers (`mbuControls`), … |
| `// <ST-TIP>` | `dev/ui/tooltip.mjs` | the tooltip alone, for a script off the ST-UI block (Scribe, Bandcamp Player Enhanced); never beside ST-UI |
| `// <ST-ICONS>` | `dev/ui/platform-icons.mjs` | platform icons and brand colours |
| `// <ST-MATCH>` | `dev/match/artist-match.mjs` | the artist matcher and sort-name guess |
| `// <ST-IMGMAX>` | `dev/imgmax/image-maximizer.js` | the largest cover behind a store page or image URL ([API](dev/imgmax/README.md)) |
| `// <ST-ARTIMG>` | `dev/artimg/artist-image.js` | an artist's picture or a label's logo from its URL relationships, the answer cached by MBID ([API](dev/artimg/README.md)) |
| `// <ST-GUESSCASE>` | `dev/guesscase/guess-case.mjs` | MusicBrainz's guess case without its editors, with more languages ([API](dev/guesscase/README.md)) |
| `// <ST-ALIASES>` | `dev/aliases/alias-editor.mjs` | the bulk alias editor: an entity's aliases as rows to edit, remove and add, each sent as its own edit |
| `// <ST-NET>` | `dev/net/mb-gate.mjs` | the MusicBrainz request gate (`mbnFetch`): ws/2 paced for every script and tab, a page being drawn (Event Horizon) let ahead of background work, and MusicBrainz's browser check passed again when it answers a website request |
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
| `cornerFlow` | `"row"`; unset is a column | `mbRestackCorner`: the corner launchers' layout | String Theory's settings |
| `cornerSide` | `"left"`; unset is the right | `mbRestackCorner` and Scribe's window: the corner launchers' side of the screen, every corner mirrored | String Theory's settings |
| `cornerSize` | a scale, `0.6` to `1.6`; unset is `1` | `mbRestackCorner` and `mbuDock`: the corner launchers' size (not Scribe's) | String Theory's settings |
| `dockOrder` | `["Mission Control", "Fusion"]`: launcher names, the first nearest the corner; unset is each script's own order | `mbRestackCorner`: the bottom-right launchers' order | String Theory's settings |
| `dockKnown` | `{"Fusion": "<svg…>"}`: each launcher's icon by name | String Theory's settings: lists every launcher, also those not on the page | `mbuDock`, from the launchers it folds |
| `dockOpen` | `true`; unset is folded | `mbuDock`: String Theory's dock unrolled | a click on the dock |
| `dockCount` | `"seg"` or `"bare"`; unset is the pill | `mbuDockCount`: how a dock icon shows its count (`data-mb-corner-status`) | String Theory's settings |
| `dockCountPos` | `"side"`; unset is on the icon | `mbuDockCount`: the count beside the icon, on the side away from the screen's edge (above it in a row) | String Theory's settings |
| `isrcFormat` | `false`; unset is on | ISRC Scout and Mission Control: ISRCs shown as `CC-XXX-YY-NNNNN` | ISRC Scout's *Show ISRCs in parts* |
| `logHistory` | `{"Platform Check": "pc:session:"}`: each log that keeps a history, by its script's name, and where its sessions are stored | `mbuLogHistory`: String Theory's *New issue with log* lists every kept session, on any page | `mbuLog`, when made with a history |
| `ehFxPresets` | `["Night", "Calm"]`: Event Horizon's effect preset names | String Theory's settings: *Light effect* and *Dark effect* | Event Horizon, at start and when a preset is saved or deleted |
| `extLinksHeading.<lang>` | the release's "External links" heading in that language | `mbpReleaseLinkList`: tells the release's links from the release group's when the page shows one list | learnt by `mbpReleaseLinkList` on a release page that shows both |

A new shared setting gets a row here.

## Interoperability

Other userscripts can opt into these conventions. No marker means the usual behaviour. These are DOM signals, not saved settings; keep page-wide markers on `document.documentElement`, which survives Event Horizon's body swaps.

| Signal                        | Scope                     | Effect                                                                                                                                         |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-mbu-foreign="<owner>"`  | rendered section or table | ISRC Scout leaves its columns and colspans alone; the shared tooltip handler ignores the region, including copied `data-tip` attributes        |
| `data-mbu-keys-off="<owner>"` | `<html>`                  | suspends Event Horizon's command shortcuts, bare keys and modified keys alike, including V and Ctrl+L; ordinary controls and Escape still work |
| `data-mbu-quiet="<owner>"`    | `<html>`                  | temporarily hides corner launchers, the dock and its shelf; scans, counts and the saved dock state continue                                    |

The foreign marker protects a rendered copy, not its native source. Keep ISRC Scout's original rows outside it. A script can listen for `is:counts-changed` and update its own copy; ISRC Scout does not push changes into a foreign region. This is a contract for the consumers named above, not a promise that every script ignores the region.

Set the page-wide flags only while your interface needs them, and remove them on close or navigation. Use your script's name as the value and remove a flag only if its value is still yours; each flag has one owner at a time. They do not open or close Event Horizon. When keys and dock are suppressed, your interface must provide its own way to close and restore them.

Event Horizon accepts [external menu launchers](userscripts/event_horizon/DEVELOP.md#external-menu-items). ISRC Scout exposes [platform metadata](userscripts/isrc_scout/DEVELOP.md#track-link-metadata) separately from tooltip text.

### Shared request-gate protocol

[`dev/net/mb-gate.mjs`](dev/net/mb-gate.mjs) is the reference implementation. Other scripts should bundle its `mbnFetch`, or inline `MBN_INLINE` as our sync tool does, rather than maintain a second scheduler. It books ws/2 starts, reports 429/503 answers and retries through the same budget. Call `mbnSlot` and `mbnAnswer` around a custom transport if `fetch` cannot be used; report every answer. Bulk reads use the default background mode and respect an active lead; reserve `background: false` for an immediate user action.

Version **1** uses origin-local `localStorage['mbu:mb-gate']`, changed under the Web Lock **`mbu-mb-gate`**. The lock covers only synchronous read/modify/write, never the wait or the request. Production and test origins have separate schedules; this is not a coordinator across origins or all clients sharing an IP.

| Field       | Meaning                                                         |
| ----------- | --------------------------------------------------------------- |
| `version`   | protocol version, `1`; absent means legacy version 1            |
| `tat`       | next theoretical arrival time, Unix milliseconds                |
| `cool`      | no request starts before this Unix millisecond timestamp        |
| `hot`       | throttle level, 0–6                                             |
| `lead`      | opaque token for the page currently drawing; empty when idle    |
| `leadUntil` | lease expiry, Unix milliseconds; at most 10 seconds per renewal |

The sustained gap is 1,000 ms, with a burst of three after idle. Default background booking uses `at = max(now, tat - 2000, cool)` and advances `tat = max(tat, at) + 1000`. Existing bookings still check a newer `cool` before starting. A background caller waits out another caller's lead before booking. Throttling and lease renewal should use the reference functions so every participant follows the same rules.

Readers accept an absent version as version 1; writers stamp `version: 1`, preserve unknown fields and never reset the schedule merely because a version was absent. Old installed copies can remove the version field on their next write, so its absence must remain supported. An explicit unknown version is rejected without changing the stored schedule. Incompatible changes require a new protocol version; these field meanings, storage key and lock name are the version-1 contract. When storage or Web Locks are unavailable, the reference code's fallback cannot guarantee cross-tab coordination.

## Bot identity

Assistant commits, comments and releases use the **`milic-bot`** account ([Standard 7](dev/agents/STANDARDS.general.md#standard-7) says how). Its commit identity: `-c user.name=milic-bot -c user.email=bot@milic.info`.

One-time setup, by the maintainer:

1. Create the account and add it as a collaborator with write access; accept the invite as the bot.
2. As the bot, create a classic token at <https://github.com/settings/tokens> with `repo` and `write:discussion`.
3. Save it in the hub's `C:\ai\_hub\.github-credentials.json`, the token's only home on the machine:

   ```jsonc
   { "username": "milic-bot", "token": "github_pat_..." }
   ```
