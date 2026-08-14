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

## Conventions

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
