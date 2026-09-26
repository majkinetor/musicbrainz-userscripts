# Tests

Every userscript's tests run under one runner, [Playwright Test](https://playwright.dev/docs/intro) (#625). Specs live next to their script in `userscripts/<name>/test/*.spec.mjs` and share [`harness.mjs`](harness.mjs).

## Running

```sh
pnpm install                      # once, at the repo root
node dev/test/login.mjs           # once: log the test profile in (production and sandbox)
pnpm test                         # everything
pnpm test --project=fusion        # one script
pnpm test --grep @unit            # only specs that need no network
pnpm test --headed                # watch the browser
pnpm test:report                  # open the last HTML report
```

One test runs at a time: all of them share the logged-in profile, and MusicBrainz rate-limits per IP.

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
- **`check(cond, message)`** is a soft assertion: a failed check is reported and the test continues.
- **`mbJson(url)`** reads the web service from Node, waiting out throttling.
- **Tags:** `@unit` needs no network, `@prod` reads musicbrainz.org, `@sandbox` uses test.musicbrainz.org (writes allowed), `@login` needs the logged-in profile.

### Options (`test.use`)

| Option | Default | |
|---|---|---|
| `profile` | `'logged-in'` | `'fresh'` for a throwaway profile |
| `gm` | `{}` | GM shim: `{ name, version, values, xhr: 'fetch' \| 'none' }`, or `false` for none |
| `prodWrites` | `'fail'` | `'block'`: refused writes don't fail the test; read them from `blockedWrites` |
| `prodPostAllow` | `[]` | extra production paths (regex sources) a POST may reach |
| `pageErrors` | `'fail'` | `'ignore'` to tolerate page errors |

## The production write guard

No test can write to production MusicBrainz. The guard is always on:

1. **In the page**, `fetch`, `XMLHttpRequest`, form submits, `sendBeacon` and the GM shim refuse any non-GET request to musicbrainz.org.
2. **On the network**, the write-only endpoints (`/ws/js/edit/`, `/edit/create`, `/relationship-editor`) are aborted.
3. **A monitor** fails the test if a production write still got through.

A refused write fails the test. Seeding the release editor (`POST /release/add`) is allowed, since it only renders a form.

> [!WARNING]
> Never route a production URL that a page navigates to. Even `route.fallback()` makes production load as `chrome-error://`, and the spec then tests an empty page. The guard routes only the write-only endpoints for this reason.

[`harness.spec.mjs`](harness.spec.mjs) proves the guard: `pnpm test --project=harness`.
