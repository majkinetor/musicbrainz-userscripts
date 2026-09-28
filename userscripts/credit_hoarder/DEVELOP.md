# Developing the Import Discogs Credits userscript

End-users only need to install from GreasyFork — see [README.md](./README.md).
This file is for **contributors** working on the code.

---

## TL;DR

```powershell
# 1. one-time tools (Windows)
winget install OpenJS.NodeJS.LTS          # or use nvm-windows + `nvm install 22 && nvm use 22`
npm install -g pnpm
winget install GitHub.cli                  # for filing issues/discussions/PRs
gh auth login                              # follow prompts

# 2. one-time setup
cd C:\path\to\mb-userscripts
pnpm install                               # the repo's test runner (Playwright Test)
pnpm exec playwright install chromium      # ~150 MB browser binary
node dev/test/login.mjs                    # sign the shared test profile in to MB, once
cd userscripts\credit_hoarder
pnpm install                               # this project's build tools (esbuild, eslint)

# 3. day-to-day
pnpm run dev                               # watches src/, rebuilds dist/, serves it on http://127.0.0.1:8765 for VM/TM live-update
pnpm run watch                             # same watcher, no HTTP server
pnpm run verify                            # lint + build + node --check
pnpm test                                  # Credit Hoarder's specs, headless
pnpm test:headed -- --grep Frontera        # show the browser, one fixture
```

---

## Prerequisites

| Tool        | Version          | Why                                            |
| ----------- | ---------------- | ---------------------------------------------- |
| **Node.js** | 20 LTS or 22 LTS | runs `build.mjs`, `eslint`, the Playwright tests |
| **pnpm**    | 10.x             | dependency manager; `npm`/`yarn` won't read `pnpm-lock.yaml` |
| **gh**      | 2.x              | opening Discussions / Issues / PRs against `majkinetor/musicbrainz-userscripts` |
| **PowerShell 7+** | any 7.x    | the example commands in docs use it; Bash works fine too — Node scripts are shell-agnostic |
| **Git for Windows** | any        | repo clone, commits |

### Installing on Windows

```powershell
winget install OpenJS.NodeJS.LTS          # or  nvm-windows
winget install GitHub.cli
npm install -g pnpm
```

If you use `nvm-windows` and `nvm use X` reports "Now using…" but `node --version` doesn't change: open PowerShell **as administrator** and re-run `nvm use`. nvm-windows needs admin to update the `C:\Program Files\nodejs` symlink — without it the switch silently fails.

### One-time `gh` auth (for humans)

```powershell
gh auth login                              # choose HTTPS, "Login with a web browser"
gh auth status                             # verify
```

After this, the `gh` CLI works against your GitHub identity.

<a id="bot-identity"></a>

### Bot identity for AI-driven work

This repo uses a dedicated GitHub account **`claude-ai-milic`** for any commits, Issues, or PRs that an AI assistant produces. Keeping bot activity separate from the maintainer's identity makes review easier and prevents accidental impersonation.

Setup (one-time, done by the maintainer):

1. Create the `claude-ai-milic` GitHub account.
2. Add it as a **collaborator** on `majkinetor/musicbrainz-userscripts` with write access; accept the invite from the bot account.
3. While logged in as the bot, generate a classic Personal Access Token at <https://github.com/settings/tokens> with scopes `repo` + `write:discussion`.
4. Save the token in `dev/.github-credentials.json` (gitignored — never commit):

   ```jsonc
   {
     "username": "claude-ai-milic",
     "token":    "github_pat_..."
   }
   ```

5. The AI assistant reads this file when it needs to interact with GitHub and uses the token explicitly (env var or `Authorization: Bearer …` header). It does **not** use the human's authenticated `gh` session.

---

## Project layout

```
userscripts/discogs_credits/
├── src/
│   └── discogs_credits.user.js    source (single file for now; multi-file split planned)
├── dist/
│   └── discogs_credits.user.js    build output — Tampermonkey loads this
├── build.mjs                      pass-through build today; esbuild bundle planned
├── eslint.config.mjs              ESLint 9 flat config
├── package.json                   pnpm scripts
├── test/
│   ├── fixtures.json              7 release URLs the test runner exercises
│   ├── login.mjs                  one-time MB sign-in into .pw-profile/
│   ├── run.mjs                    main test runner (per-fixture: open → inject → snapshot → assert)
│   ├── logs/                      gitignored; per-run logs `<ISO8601>_<mbid>.log`
│   └── lib/
│       ├── browser.js             Playwright helpers
│       └── verify.js              property-based assertions vs Discogs + MB metadata
├── dev/                           developer-facing artifacts (not shipped)
│   ├── ANALYSIS.md                living refactor plan
│   ├── DECISIONS.md               append-only design-decisions log
│   ├── align-md-tables.mjs        tool — markdown table aligner
│   └── discussions-to-create.md   transient: pending GitHub Discussions drafts
├── .gitignore                     ignores node_modules/, .pw-profile/, test/logs/, *.log
├── .pw-profile/                   gitignored; Playwright's persistent Chromium profile
│                                  (MB cookies + IDB entity cache)
├── README.md                      user-facing; install + features + screenshots
├── CHANGELOG.md                   user-facing
└── DEVELOP.md                     this file
```

---

## The dev loop

`src/` → `pnpm run dev` (watch + serve) → `dist/discogs_credits.user.js` → Violentmonkey / Tampermonkey.

### Live-install via `pnpm run dev` (recommended)

`pnpm run dev` rebuilds `dist/` on every save **and** serves it at `http://127.0.0.1:8765/discogs_credits.user.js` with the metadata block rewritten on the fly so the userscript manager treats every rebuild as a new release:

- `@version` is overridden with `YYYY.M.D.HHMMSS` — recognizable, always-newer.
- `@updateURL` and `@downloadURL` are rewritten to the localhost URL above.

Every request the dev server serves is logged to the terminal (e.g. `[19:42:11] GET / → 219.775 bytes`), so you can see when the manager polls.

The "how to update" step depends on which manager you're using.

#### Tampermonkey (lowest friction)

1. Run `pnpm run dev`.
2. Visit `http://127.0.0.1:8765/discogs_credits.user.js` in the browser — TM's `.user.js` handler intercepts and offers Install.
3. After install, open the script in TM → **Settings** tab → set **Check for updates** to `0` days (interval = "every page load").
4. Reload MB. TM re-fetches from localhost on each load; the script updates because `@version` always bumps.

#### Violentmonkey

VM does **not** have a per-script "check on every page load" knob. Auto-update runs on the global interval (Dashboard → Settings → Updates, minimum 1 day) — too slow for a tight dev cycle. Two workable patterns:

**Recommended — bookmark the dev URL.** After installing once via `http://127.0.0.1:8765/discogs_credits.user.js`, save that URL as a browser bookmark. After each `src/` save:

1. Click the bookmark.
2. VM detects the matching `@name`+`@namespace` already installed, sees a newer `@version`, and shows the install/update prompt inline → one click to update.
3. Reload the MB tab to use the new copy.

Two clicks per dev cycle, no manual paste, no manager polling needed.

**Or — use TM as your dev manager.** TM and VM ship the same script identically; nothing stops you installing TM alongside VM just for the dev install and keeping VM for everything else.

#### Stopping the dev server

Ctrl-C in the terminal. While the server is down, the installed copy keeps working — it just won't update until you start the server again.

### Alternatives

- **`pnpm run watch`** — same watcher, no HTTP server. Use when you don't want a listening port (you can still paste `dist/` contents manually).
- **`pnpm run build`** — one-shot build with no watch, no server.

For headless tests, none of the above matters — `test/run.mjs` reads `dist/discogs_credits.user.js` directly and injects it into the page.

### Static gate — `pnpm run verify`

Lints, builds, and parses the bundle. Always run this before considering a change done.

```powershell
pnpm run verify
```

What it catches:
- Syntax errors (`node --check`)
- Dangling expressions, unreachable code, duplicate keys (ESLint)
- The dataset bug class: ESLint's `no-dupe-keys` caught 51 silently-dropped instruments on the first run

### Browser gate — `pnpm test`

Credit Hoarder's specs run in the repo's one test runner, beside every other script's; [`dev/test/README.md`](../../dev/test/README.md) covers the runner, the tags and the production write guard. `pnpm test` here is `pnpm test --project=credit_hoarder` at the repo root.

`test/fixtures.spec.mjs` drives a real Chromium on test.musicbrainz.org: it runs the import on each release in `test/fixtures.json`, snapshots `MB.relationshipEditor.state` directly, and asserts the staged relationships against the Discogs JSON and MusicBrainz's own validity rules (`test/lib/verify.js`). **Never submits.**

```powershell
pnpm test                                  # every spec, headless
pnpm test:headed                           # show the browser
pnpm test -- --grep Frontera               # one fixture, by name
pnpm test -- --grep "@fixture.*@small"     # fixtures with a tag
```

Each fixture in `test/fixtures.json` is an object with `name`, `url` (a release on the sandbox; `node dev/test/copy-to-sandbox.mjs <mbid>` copies one from production) and `tags`, which become the test's `@tags`. Fixtures tagged `debug` reproduce bug reports and run only with `CH_DEBUG=1`.

### Per-run output

The run's HTML report (`pnpm test:report` at the repo root) keeps, for each fixture, the userscript's import log, the browser console and a screenshot of the editor.

**Persistent profile.** The shared `.pw-profile/` at the repo root holds the MB login cookies and the IDB entity cache the userscript builds up. **Don't delete it casually**: its loss means signing in again (`node dev/test/login.mjs`) *and* re-paying the cold-cache preflight cost (a few minutes per release for many-entity ones).

**First-run cost.** Cold-cache fixtures with many entities (e.g. Midwest Funk has 230) can take ~10 min — the userscript serially looks them up against MB under rate limits. The `confirmReviewTable` Playwright timeout in `test/lib/browser.js` is 20 min for this reason. Subsequent runs reuse the cache and are <30s per fixture.

---

## Filing bugs, issues, PRs

Pull requests, issues, and discussions live at <https://github.com/majkinetor/musicbrainz-userscripts>.

| What | When | How |
| ---- | ---- | ---- |
| **Discussion** | Findings, root-cause notes, open design questions, things worth promoting later | `gh discussion create --repo majkinetor/musicbrainz-userscripts --category Bugs --title "..." --body-file <(...)` |
| **Issue**      | Confirmed bugs ready to be fixed; tasks to track | `gh issue create --repo majkinetor/musicbrainz-userscripts --label bug --label discogs_credits --title "..." --body-file ...` |
| **PR**         | Code changes against a feature branch | `gh pr create --title "..." --body-file ...` |

Default flow used in this repo: when an AI assistant or contributor discovers a new bug, file a **Discussion** first. The maintainer reviews and promotes to a tracked Issue when ready.

---

## Where everything is tracked (for AI assistants and new contributors)

- **`dev/ANALYSIS.md`** — the living refactor plan. Section §4 lists every known bug with line refs + fix sketch.
- **`dev/DECISIONS.md`** — append-only, `YYYY-MM-DD HH:MM — topic → decision. (rationale)`. Read this to understand *why* the code looks the way it does.
- **`dev/discussions-to-create.md`** — transient drafts for Discussions not yet filed.

Read those three files before making non-trivial changes.

---

## Common tasks

### "I edited `src/`, rebuild and lint"

```powershell
pnpm run verify
```

### "I want to see what the script does on a specific MB release"

```powershell
pnpm test:headed -- --grep "<fixture name>"
```

The Chromium window opens, the script's import bar appears at the top, you watch.

### "I want to test against a release that isn't in the fixtures"

Copy it to the sandbox (`node dev/test/copy-to-sandbox.mjs <mbid>` at the repo root), add the copy's URL to `test/fixtures.json`, and run `pnpm test -- --grep "<its name>"`.

### "I want to clear the entity cache"

```powershell
Remove-Item -Recurse -Force ..\..\.pw-profile
node ..\..\dev\test\login.mjs
```

### "Auto-react to GH notifs via a channel into a running Claude session"

Documented in [`/dev/github-notifications/README.md`](../../dev/github-notifications/README.md). The pipeline is repo-wide infrastructure (not discogs_credits-specific), so the operating notes live with the scripts at repo root rather than in this userscript's developer guide.

---

## Troubleshooting

### `pnpm` command not found after install

Open a new PowerShell window. `npm install -g pnpm` puts pnpm in the user PATH but only new shells see it.

### `nvm use X` claims success but `node --version` doesn't change

You need to be in an elevated terminal — nvm-windows requires admin to update the `C:\Program Files\nodejs` symlink. If you have a second nvm install (`C:\nvm4w` is a common one) on PATH, remove its PATH entry first.

### `pnpm exec playwright install` downloads but `pnpm test` reports browser missing

Run `pnpm exec playwright install chromium` again. The first install can be flaky on slow connections.

### `node dev/test/login.mjs` opens a browser but never closes

It waits (up to 5 minutes per site) for MB's "Log out" link to appear, first on musicbrainz.org, then on test.musicbrainz.org; the two have separate accounts. If you signed in but are still on the sign-in page, click anywhere on MB to navigate.

### Tests pass on some fixtures and time out on others

First-run on a many-entity release legitimately takes minutes (rate-limited preflight). Subsequent runs reuse `.pw-profile/`'s IDB cache. If you wiped `.pw-profile/`, expect a slow first pass.

### A fixture stalls forever in headed mode

Open the fixture's "import log" in the run's HTML report (`pnpm test:report` at the repo root). Its last line is the last thing the script did before stalling; the "browser log" beside it has the console and page errors.

## Implementation details

1. **IndexedDB cache** — resolved source URL → MB MBID mappings persist across sessions.
1. **Rate-limit handling** — all MB WS2 requests share one throttle; on 429/503 every in-flight worker idles until the `Retry-After` window elapses (cooperative backoff).
1. **unsafeWindow** — uses `@grant unsafeWindow` to reach MB's real page `window`, where `MB.relationshipEditor` lives.
1. **BroadcastChannel** — same-origin cross-tab messaging for the entity-creation → review-table feedback loop, and for the Tidal credits-tab harvest.
1. **Provider sources** — Discogs via `api.discogs.com` (token from MB's stored Discogs URL); Tidal via an anonymously-opened credits tab harvested cross-tab; Qobuz via the authenticated `album/get` when signed in through Platform Check, else the server-rendered store page.
1. **Role resolution is shared across sources** — `src/data/entity-map.js` (`ENTITY_TYPE_MAP`, keyed by Discogs role names) + `src/data/instruments.js` are the single vocabulary: Discogs roles go straight into `getArtistRoles`, while Tidal and Qobuz first bridge their role names into the Discogs-style keys and then call the same function — so one map entry fixes every source (#427). Company credits from any source resolve their `entity_type_name` against the same map. Deezer (Main/Featured only) is the lone source that bypasses it. Role keys match exact-case; an unmapped artist role silently drops the whole credit before preflight.
1. Resolution/review engine initially based on the Discogs Importer, itself based on the userscripts of *mattgoldspink*, *vzell*, *kellnerd*.
