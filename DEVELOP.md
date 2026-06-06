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

## Bot identity

AI-driven commits/issues use the **`claude-ai-milic`** account; the token lives in
`dev/.github-credentials.json` (gitignored). See a per-script DEVELOP for the full setup.
