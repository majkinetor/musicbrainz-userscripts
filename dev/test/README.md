# Tests

Every userscript's tests run under one runner, [Playwright Test](https://playwright.dev/docs/intro) (#625). Specs live next to their script in `userscripts/<name>/test/*.spec.mjs` and share [`harness.mjs`](harness.mjs).

## Running

```sh
pnpm install                      # once, at the repo root
node dev/test/login.mjs           # once: log the test profile in (production and sandbox)
node dev/test/login.mjs sandbox --auto   # the sandbox only, headless, as CI does
node dev/test/login.mjs sandbox --firefox   # Firefox's profile, for Falcon's Firefox specs
pnpm test                         # everything
pnpm test --project=fusion        # one script
pnpm test --grep @unit            # only specs that need no network
pnpm test --grep @critical        # the quick run: each script's core
pnpm test:core                    # everything but the purely visual specs (@cosmetic)
pnpm test:env                     # the specs that fail when the sandbox or another service misbehaves (@env)
pnpm test --headed                # watch the browser
TEST_LOG=1 pnpm test              # also print what specs log
pnpm test:report                  # open the last HTML report
```

`node dev/test/suite-by-script.mjs` runs the same suite one script (project) at a time, each with its own JSON report and artifacts in `test-results/suite/`; the [`suite` skill](../../.claude/skills/suite/SKILL.md) uses it to recheck one script's failures while the next one runs. Such a recheck runs on a copy of the profile, `PW_PROFILE=.pw-profile-recheck`, since Chromium lets one browser at a time open a profile.

One test runs at a time by default: all of them share the logged-in profile, and MusicBrainz rate-limits per IP. `PW_WORKERS=<n>` runs n spec files at once. Each worker then opens its own copy of the profile, `.pw-profile-w<i>` and `.pw-profile-ff-w<i>`, because a browser locks the profile it opens. Make the copies after you sign in: `node dev/test/worker-profiles.mjs <n>`.

These variables change a run:

| Variable | What it does |
| --- | --- |
| `PW_WORKERS=<n>` | n workers, each on its own profile copy |
| `PW_FAST=1` | 3 minutes for a spec and 45 s for a page load, not 5 minutes and 90 s, so a dead sandbox fails fast |
| `PW_ENV_STOP=<n>` | after n failures in a row that the environment caused, skip the specs that are left |
| `PW_BLOB=<name>` | also write a blob report, `blob-report/<name>.zip`, that `playwright merge-reports` joins with other runners' |
| `PW_JSON=<file>` | also write the Playwright JSON report |

[`failure-cause.mjs`](failure-cause.mjs) gives each failure a cause. `rate-limit` is a 429 or 503 answer from MusicBrainz, or its "Verification failed" page. `network` is a connection or proxy error. `test` is any other failure. The harness adds the cause to the failed test as a `cause` annotation.

## CI

- **[checks](../../.github/workflows/checks.yml)**, on every push to main or stable and every pull request: parse, lint, design tokens, Credit Hoarder's build matching its source, and the `@unit` specs. For main and pull requests it then runs the `@critical` specs on the sandbox with 3 workers, signed in by `login.mjs sandbox --auto` (the sandbox account is public, so there is no secret). `@env` and `@quarantine` specs stay out.
- **[suite](../../.github/workflows/suite.yml)** runs on 3 runners (GitHub machines) at once, with 3 workers each ([#1109](https://github.com/majkinetor/musicbrainz-userscripts/issues/1109)). [`shards.mjs`](shards.mjs) gives each runner a share of the scripts of about the same length. First, [`preflight.mjs`](preflight.mjs) makes sure that the sandbox answers. If it does not, no runner starts. The `report` job joins the runners' reports into one HTML report. The set of specs depends on the night:

  | Set | When | Specs |
  | --- | --- | --- |
  | `nightly` | Monday to Saturday, 02:00 UTC | the specs that guard behavior: not `@unit`, `@cosmetic`, `@fixture`, `@debug`, `@env` or `@quarantine` |
  | `full` | Sunday, 02:00 UTC | every spec but `@unit`, `@env` and `@quarantine` |
  | `env` | by hand | the `@env` specs, before a release or after the sandbox changes |
  | `quarantine` | by hand | the `@quarantine` specs |

  No set has `@web` (other live sites often block cloud machines) or `@timing`. Actions → suite → Run workflow starts any set, and with 3, 2 or 1 workers. The `nightly` and `full` sets run with `PW_FAST=1` and `PW_ENV_STOP=5`.

  The README badge shows how many specs passed and failed on the last `nightly` or `full` run on main. Every such run is also kept in [`history.json`](https://github.com/majkinetor/musicbrainz-userscripts/blob/test-history/history.json) on the `test-history` branch, newest first: the counts, how long it took (`duration`, H:MM:SS, the specs without the setup), the layout (`3x3` is 3 runners with 3 workers), each failed spec with its error and cause, the commit and the run's link (#647). A full local run through the [`suite` skill](../../.claude/skills/suite/SKILL.md) goes in too, marked `"source": "local"` ([`suite-record.mjs`](suite-record.mjs)): the only runs with the `@web` specs. The badge stays the nightly's.

  The suite does not retry a failed spec, so flakiness shows across runs. `node dev/test/flaky-report.mjs` (after `git fetch github test-history`) lists the specs that failed in the last 30 runs, most often first. It gives how many of the failures were nightly and how many local, and marks one red in every run as BROKEN and one red more than once as flaky. `--runs N` looks further back. `--causes` counts each run's failures by cause, with its layout. If the `rate-limit` count grows, run fewer workers: change `PW_WORKERS` in `suite.yml` and `checks.yml`.

Both keep the HTML report as a download on the run page, for 14 days, and only one of them uses the sandbox at a time (the concurrency group `sandbox`).

## Writing a spec

```js
import { test, check, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion' } });

test('what the spec proves', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/recording/…');
  await requireLogin(page);                      // skipped, not failed, when signed out
  await inject('fusion', { waitFor: '__fusion' });
  check(await page.evaluate(() => …), 'a readable reason');
});
```

- **`inject(name)`** loads `userscripts/<name>/<name>.user.js`. `<NAME>_SRC=<file>` runs the spec against another build, which is how a regression test is shown to fail on the broken one: `FUSION_SRC=old.user.js pnpm test --project=fusion`.
- **`console.log`** in a spec goes to the test's report (a `log` attachment), not the terminal, so a run shows only pass and fail lines. `TEST_LOG=1` prints it as well. Code run in the page logs to the page, as before.
- **`check(cond, message)`** is a soft assertion: a failed check is reported and the test continues.
- **No fixed sleeps.** A spec waits for what it checks, never for a length of time: a wait long enough here is too short on a slower machine (CI). Instead:
  - **`until(read, ok)`** polls the value a check is about until `ok(value)` holds (20 s at most), and returns it either way, so a failing check still reports what was there: `check(await until(() => page.evaluate(…), v => v === 'flex'), …)`.
  - **`idle(page)`**: the page has loaded and its main thread is idle, where a script goes in once MusicBrainz has started. **`settled(page)`** waits for the network to go quiet first (MusicBrainz's release editor loads tracks as its tabs open).
  - **`frames(page, n)`**: `n` drawn frames, for what is laid out a frame later (a ResizeObserver, then requestAnimationFrame), where the state before the change would pass the check too.
  - **`page.clock`**, Playwright's fake clock, for a script's own timers (debounces, countdowns, polls): `page.clock.install()` before the page loads, then `page.clock.runFor(ms)` jumps ahead at once.
  - A "nothing happened" check is read once the same action's other effect shows, or once the code has handled it (the answer in, the frame drawn): not after a pause.
- **`mbJson(url)`** reads the web service from Node, waiting out throttling.
- **`attachShot(testInfo, pageOrLocator, name)`** attaches a screenshot to the report.
- **`loadFunctions(name, [names])`** evaluates a script's pure helpers in Node, for `@unit` specs. **`functionSource(name, [names])`** returns their source instead, to run in the page (`new Function(src + '; return fn;')()`) or to read.
- **`onSandbox(mbid)`** is the sandbox copy of a production release (itself when it has none); **`sandboxAs(mbid)`** maps that copy and its release group back to production, for `replayWs(…, { as })`.
- **`answerGm(context, handler)`** answers `GM_xmlhttpRequest` calls in place of the network, as `page.route()` does for the page's own requests: `answerGm(context, ({ url }) => /soundexchange/.test(url) ? { status: 202, body: '…' } : null)`.
- **`replayWs(page, fixture)`** answers the page's `/ws/2/` reads from answers recorded on production, so a spec that depends on who is called what gets the same data every run and is never throttled. `RECORD_WS=1` records what the recording lacks (`RECORD_WS=fresh` starts it over); `await ws.done()` saves, or fails on a read the fixture lacks. `web: true` (or a RegExp of hosts) also replays the other sites the script asks through `GM_xmlhttpRequest`; tokens are redacted and HTML pages stripped of styles, SVG and comments before they are stored, and `trim: (key, body) => body` cuts what else a spec doesn't need. **Bandcamp** answers the harness's requests (live and recording) with its "Client Challenge" page, though a plain Node `fetch` gets the album: write such a fixture from Node (`680-is-pc-links`'s holds only the page's `data-tralbum`).
- **MusicBrainz noise:** its own React #418 (hydration, recovered on the client) never fails a test. A spec that collects page errors itself filters with `mbNoise` from the harness.
- **Tags:** `@unit` needs no network, `@prod` reads musicbrainz.org, `@sandbox` uses test.musicbrainz.org (writes allowed), `@web` reads another live site (Bandcamp, Discogs…), `@login` needs the logged-in profile. `@critical` marks the few specs per script that cover its core, for a quick run. `@cosmetic` marks a spec that checks only how something looks (colours, themes, icons, layout, alignment); a broken one leaves every feature working, so `pnpm test:core` leaves them out. Tag a new spec `@cosmetic` when that is all it checks. `@timing` marks a spec that asserts a time budget ("shows within 3 s"), which CI leaves out. `@env` marks a spec that often fails because of the environment, not the script: the sandbox's empty search index, a slow sandbox, or a service that the sandbox does not have. CI runs it only in the `env` set, by hand. Remove the tag when the cause is gone. `@quarantine` marks a spec that failed every night for a reason that is still unknown. It stays out of CI until someone fixes or deletes it. `@flaky` marks a spec that has failed intermittently, so it can be run alone many times: `pnpm test:flaky` repeats every one 10 times (`pnpm test --grep @flaky --repeat-each 20` for more). Drop the tag once a fix has held through several full runs; add it with a note in the commit when a spec fails once and passes on rerun.

### Options (`test.use`)

| Option | Default | |
|---|---|---|
| `profile` | `'logged-in'` | `'fresh'` for a throwaway profile |
| `gm` | `{}` | GM shim: `{ name, version, values, persist, xhr }`, or `false` for none. `persist: true` keeps the values across a reload; `'tabs'` also shares them between the test's tabs. `xhr: 'node'` (the default) makes `GM_xmlhttpRequest` from Node, as a manager does (no CORS, the context's cookies; page routes don't see it); `'fetch'` uses the page's fetch; `'none'` never answers |
| `prodWrites` | `'fail'` | `'block'`: refused writes don't fail the test; read them from `blockedWrites` |
| `prodPostAllow` | `[]` | extra production paths (regex sources) a POST may reach |
| `pageErrors` | `'fail'` | `'ignore'` to tolerate page errors, or a list of regex sources to let only those through |
| `isMobile`, `hasTouch` | `false` | a phone (with `viewport` and `deviceScaleFactor`): the page's viewport meta tag counts, as it does on a phone |

## Sandbox fixtures

Specs run on test.musicbrainz.org. Its data is an older copy of production, so a fixture can be missing there, or be missing a link added since.

- **A spec that changes something works on a pristine entity** (maintainer, 2026-10-20): `pristine(page, kind, fields)` makes a new, minimal one for the run and returns its MBID. Never an entity another spec, or a person, also works on: what one run leaves there (a cover, a link, a barcode) breaks the next spec that reads it. Live-536's cover uploads, one a run on Art Station's fixture release, made Art Station's specs there time out. Every field has a safe default; pass only the ones the spec needs a given value of. A recording or release group comes with a release of its own; `tracks: n` gives a release more than one; a `standalone-recording` has none. `pristineCover(page, mbid, { types, comment })` puts one cover on a pristine release through MusicBrainz's own form (one only: after a release's first upload, signing the next answers 500 for a long while). A release or standalone recording credits an artist the run made, so nothing it stands on is another spec's or exists only on the sandbox. Read-only specs can keep using a shared fixture.
- **`SANDBOX_WRITES=<file>`** logs every request but a read that reaches the sandbox (or the Internet Archive, for cover art) to `<file>`, one JSON line each, with the spec that made it. A full run with it shows which specs write, and to what: `SANDBOX_WRITES=writes.jsonl pnpm test --grep @sandbox`. A request a page route answered is marked `faked`. Specs that launch their own browser (Falcon's Firefox specs) aren't covered.

- `node dev/test/copy-to-sandbox.mjs <mbid>` copies a production release to the sandbox: title, credits, tracklist, links. Artists the sandbox lacks are created first. The new MBID is recorded in [`sandbox-copies.json`](sandbox-copies.json).
- `node dev/test/sandbox-add-links.mjs <mbid>` adds the links production has and the sandbox's copy lacks, keeping the release's other relationships.

## The production write guard

No test can write to production MusicBrainz. The guard is always on:

1. **In the page**, `fetch`, `XMLHttpRequest`, form submits, `sendBeacon` and the GM shim refuse any non-GET request to musicbrainz.org.
2. **On the network**, the write-only endpoints (`/ws/js/edit/`, `/edit/create`, `/relationship-editor`) are aborted.
3. **A monitor** fails the test if a production write still got through.

A refused write fails the test. Seeding the release editor (`POST /release/add`) is allowed, since it only renders a form.

> [!WARNING]
> Never route a production URL that a page navigates to. Even `route.fallback()` makes production load as `chrome-error://`, and the spec then tests an empty page. The guard routes only the write-only endpoints for this reason.

[`harness.spec.mjs`](harness.spec.mjs) proves the guard: `pnpm test --project=harness`.
