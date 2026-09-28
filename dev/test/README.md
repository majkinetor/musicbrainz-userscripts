# Tests

Every userscript's tests run under one runner, [Playwright Test](https://playwright.dev/docs/intro) (#625). Specs live next to their script in `userscripts/<name>/test/*.spec.mjs` and share [`harness.mjs`](harness.mjs).

## Running

```sh
pnpm install                      # once, at the repo root
node dev/test/login.mjs           # once: log the test profile in (production and sandbox)
node dev/test/login.mjs sandbox --auto   # the sandbox only, headless, as CI does
pnpm test                         # everything
pnpm test --project=fusion        # one script
pnpm test --grep @unit            # only specs that need no network
pnpm test --grep @critical        # the quick run: each script's core
pnpm test --headed                # watch the browser
TEST_LOG=1 pnpm test              # also print what specs log
pnpm test:report                  # open the last HTML report
```

One test runs at a time: all of them share the logged-in profile, and MusicBrainz rate-limits per IP.

## CI

- **[checks](../../.github/workflows/checks.yml)**, on every push to main or stable and every pull request: parse, lint, design tokens, and the `@unit` specs. For main and pull requests it then runs the `@critical` specs on the sandbox, signed in by `login.mjs sandbox --auto` (the sandbox account is public, so there is no secret).
- **[suite](../../.github/workflows/suite.yml)**, nightly and from Actions → suite → Run workflow: every spec but `@web`, since other live sites often block cloud machines.

Both keep the HTML report as a download on the run page, for 14 days, and only one of them uses the sandbox at a time.

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
- **`replayWs(page, fixture)`** answers the page's `/ws/2/` reads from answers recorded on production, so a spec that depends on who is called what gets the same data every run and is never throttled. `RECORD_WS=1` records what the recording lacks (`RECORD_WS=fresh` starts it over); `await ws.done()` saves, or fails on a read the fixture lacks. `web: true` (or a RegExp of hosts) also replays the other sites the script asks through `GM_xmlhttpRequest`; tokens are redacted and HTML pages stripped of styles, SVG and comments before they are stored, and `trim: (key, body) => body` cuts what else a spec doesn't need.
- **Tags:** `@unit` needs no network, `@prod` reads musicbrainz.org, `@sandbox` uses test.musicbrainz.org (writes allowed), `@web` reads another live site (Bandcamp, Discogs…), `@login` needs the logged-in profile. `@critical` marks the few specs per script that cover its core, for a quick run. `@timing` marks a spec that asserts a time budget ("shows within 3 s"), which CI leaves out. `@flaky` marks a spec that has failed intermittently, so it can be run alone many times: `pnpm test:flaky` repeats every one 10 times (`pnpm test --grep @flaky --repeat-each 20` for more). Drop the tag once a fix has held through several full runs; add it with a note in the commit when a spec fails once and passes on rerun.

### Options (`test.use`)

| Option | Default | |
|---|---|---|
| `profile` | `'logged-in'` | `'fresh'` for a throwaway profile |
| `gm` | `{}` | GM shim: `{ name, version, values, persist, xhr }`, or `false` for none. `persist: true` keeps the values across a reload; `'tabs'` also shares them between the test's tabs. `xhr: 'node'` (the default) makes `GM_xmlhttpRequest` from Node, as a manager does (no CORS, the context's cookies; page routes don't see it); `'fetch'` uses the page's fetch; `'none'` never answers |
| `prodWrites` | `'fail'` | `'block'`: refused writes don't fail the test; read them from `blockedWrites` |
| `prodPostAllow` | `[]` | extra production paths (regex sources) a POST may reach |
| `pageErrors` | `'fail'` | `'ignore'` to tolerate page errors, or a list of regex sources to let only those through |

## Sandbox fixtures

Specs run on test.musicbrainz.org. Its data is an older copy of production, so a fixture can be missing there, or be missing a link added since.

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
