# discogs_credits — analysis & refactor plan (v2)

Author: Claude (Opus 4.7)  •  Date: 2026-05-23  •  Supersedes v1 of this doc.

Reflects your answers in `ANALYSIS-answers.md`. Nothing has been changed in the code yet.

---

## 0. TL;DR

- **Source layout:** split into ~16 small `.js` modules under `src/`. `esbuild` bundles to one `dist/discogs_credits.user.js` which is what Tampermonkey loads. One `pnpm run build` per change; `pnpm run dev` watches.
- **Static gate (must pass):** ESLint + `node --check` on the bundle. Catches the typo/dangling-expression/dead-code class of bugs in <1s.
- **Headless gate (must pass):** Playwright drives a real Chromium with your stored MB cookies, runs the import on a list of release URLs, and checks the staged relationships against the Discogs JSON. **Never commits.** The three open GitHub bugs (#2, #3, #4) are checks the test will perform automatically.
- **No fixtures with hand-curated expectations.** Just a list of release URLs. The test compares post-import state vs Discogs source-of-truth + MB's own validity rules.
- **Tests handle "entity not in MB"** by routing the relationship to MB's real special-purpose entities `[no artist]` / `[no label]` / `[no place]`, setting `credited_as` = real Discogs name and `begin_date.year` = 0001/0002/... as the disambiguator. Same dispatch path as a resolved entity; nothing fake is registered. See §3.4.
- **Free to touch IDB schema, localStorage keys, BroadcastChannel name** — you confirmed.
- **Will fix bugs #2, #3, #4** as part of refactor pass 3. The test gate is what makes that safe.

---

## 1. State of the code today (unchanged from v1)

Recap:

- **4842 lines**, single file. Three functions = ~1400 lines: `instantFillRelationships` (907–1488), `showReviewTable` (2151–2850), `addRelationship` + helpers (3258–3365).
- **~600 dead lines:** the legacy DOM-automation dispatch path (3000–3365) bypassed in normal use.
- **~400 duplicated lines:** two parallel lookup functions (`getMbidForEntity`, `getMbId`) chained as fallbacks in 5 places; near-identical `checkMissingArtists` / `checkMissingCompanies`; compat shims (`progressBar`, `progressFill`, `progressStatus`, `recentLogsEl`, `lastUiItem`, `lastRequest`) read by nothing that ships.
- **Real syntax bug at line 991:** dangling expression statement `+ tracklistRels.length + 1;` — does nothing, residue from a prior edit. `node --check` catches this class of mistake.
- **Two big data tables embedded:** `ENTITY_TYPE_MAP` (~450 lines), `INSTRUMENTS` (~740 lines).
- **200-line CSS-in-JS blob** at 157–341.
- **No tests, no lint.** This is the core pain point.

What's good (preserved): `mbThrottle`, IDB cache, BroadcastChannel cross-tab flow, the direct `MB.relationshipEditor.dispatch()` path, the review table concept.

---

## 2. New file layout (multi-file source, single-file output)

```
discogs_credits/
├── src/
│   ├── meta.txt                  # the // ==UserScript== block (verbatim; build prepends)
│   ├── main.js                   # entry: bootstrap, document.ready, route entity-page vs release-page
│   ├── constants.js              # REL_TEMPLATE, RECORDING_LINK_TYPES, OPTS_KEY, IDB_NAME, etc.
│   ├── util.js                   # sleep, eventHelpers, escapeHtml, htmlToMarkdown
│   ├── log.js                    # Logger {line, warn, error, raw} → renders into <ul>, feeds progress bar
│   ├── progress-bar.js           # ProgressBar.show/hide/setPct/setStatus
│   ├── styles.css                # real CSS, bundled as text by esbuild
│   ├── storage.js                # IdbCache (open/get/put) + Opts (load/save)
│   ├── api-mb.js                 # throttled fetch + searchEntity + lookupByUrl + fetchEntity
│   ├── api-discogs.js            # fetchRelease + parseDiscogsUrl
│   ├── mappers.js                # rolesFromArtist, attrsForRole, guessSortName, resolveLinkTypeId, buildAttributesTree
│   ├── preflight.js              # resolveEntity (single function for artist/label/place) + resolveAll (parallel pool)
│   ├── review-table.js           # class ReviewTable (DOM + state + onConfirm)
│   ├── editor-state.js           # waitForMBEditor, buildRecordingIndex (state + WS2 augmentation)
│   ├── dispatch.js               # dispatchRelationship + 4-part orchestrator (companies, releaseArtists, tracklist, works)
│   ├── ui-bar.js                 # insertImportBar + wire toggles
│   ├── entity-return.js          # BroadcastChannel listener on artist/label/place pages
│   └── data/
│       ├── entity-map.js         # ENTITY_TYPE_MAP
│       ├── instruments.js        # INSTRUMENTS
│       └── work-only-rels.js     # WORK_ONLY_ARTIST_RELS
├── dist/
│   └── discogs_credits.user.js   # generated, this is what Tampermonkey loads
├── test/
│   ├── login.mjs                 # one-time MB login → saves storageState/IDB profile
│   ├── run.mjs                   # main test runner
│   ├── fixtures.json             # just a list of release URLs
│   └── lib/
│       ├── verify.js             # compare staged rels vs Discogs JSON + MB validity rules
│       └── browser.js            # Playwright helpers (inject script, read state, etc.)
├── build.mjs                     # ~40-line esbuild driver
├── package.json
├── .eslintrc.cjs
├── .gitignore
├── README.md, CHANGELOG.md, screenshots   # user-facing only
└── dev/                          # developer-facing only (not shipped)
    ├── ANALYSIS.md               # this doc — living plan
    ├── DECISIONS.md              # append-only resolved-decisions log
    └── ANALYSIS-answers.md       # transient: your per-round answers (deleted after merge)
```

### 2.1 Why esbuild over plain concat

You already have `pnpm`. esbuild is one dev dependency (~9 MB), one config, runs in ~30 ms. The win: **source files use real `import` / `export`**, so refactors across files Just Work and ESLint understands the graph. Plain concat would force every module to be aware of every other module's globals — exactly the spaghetti we're escaping.

Build command:
```bash
pnpm run build      # esbuild src/main.js --bundle --format=iife --outfile=dist/discogs_credits.user.js + prepend meta.txt
pnpm run dev        # esbuild --watch (rebuilds on every save in ~30ms)
```

The `// ==UserScript==` banner stays as a verbatim file (`src/meta.txt`) so `@downloadURL` / `@updateURL` / `@version` are easy to bump and stay valid metadata.

### 2.2 Modules: how they're split (concrete responsibilities)

| Module             | Responsibility                                                                                                                                          | Approx LOC |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `main.js`          | Detect page type → wire bootstrap. Nothing else.                                                                                                        | ~30        |
| `constants.js`     | Static literals only. No logic.                                                                                                                         | ~50        |
| `util.js`          | Pure helpers, zero dependencies.                                                                                                                        | ~80        |
| `log.js`           | `Logger` class. `log.line/warn/error/raw/copy()`.                                                                                                       | ~120       |
| `progress-bar.js`  | `ProgressBar` class. Animation, position.                                                                                                               | ~80        |
| `storage.js`       | IDB get/put; localStorage opts; URL-check session cache.                                                                                                | ~120       |
| `api-mb.js`        | Throttle + `fetchJson`, `searchEntity(type, name)`, `lookupByUrl(url, type)`, `fetchEntity(mbid)`, `fetchReleaseRecordings(mbid)`.                      | ~180       |
| `api-discogs.js`   | `fetchRelease(url)`, `parseDiscogsUrl(url)`.                                                                                                            | ~60        |
| `mappers.js`       | All pure transforms — Discogs JSON → roles, attrs → tree, link type resolution. Easiest to unit-test.                                                   | ~250       |
| `preflight.js`     | **One** `resolveEntity(discogsEntity, type, {bypassCache})` used for artist, label, place. Wrapped by `resolveAll(entities, opts)` which runs the pool. | ~200       |
| `review-table.js`  | The review-table UI. One class, one render. State map lives inside.                                                                                     | ~400       |
| `editor-state.js`  | `waitForMBEditor`, `buildRecordingIndex(re)` (the gnarly recording/medium/position logic).                                                              | ~150       |
| `dispatch.js`      | `dispatchRelationship` + 4 small functions called by `runImport`: `dispatchCompanies`, `dispatchReleaseArtists`, `dispatchTracklist`, `dispatchWorks`.  | ~350       |
| `ui-bar.js`        | `insertImportBar`, toggle wiring, "Import" button handler.                                                                                              | ~200       |
| `entity-return.js` | BroadcastChannel listener on entity pages.                                                                                                              | ~50        |
| `data/*`           | Data tables, unchanged in content, just moved.                                                                                                          | ~1200      |

**Estimated total: ~3500 lines** including data tables (~2300 of actual logic) versus 4842 today. About a **~30% reduction in non-data code**, mostly from deleting the legacy path and collapsing duplicate lookups.

### 2.3 Renames (final list, after your `resolveEntity` feedback)

| Now                                                | After                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `startImportRels`                                  | `runImport`                                                                           |
| `instantFillRelationships`                         | `dispatchAllRelationships` (split into 4 named children)                              |
| `hasDiscogsLinkDefined`                            | `getDiscogsUrlForRelease`                                                             |
| `checkMissingArtists` + `checkMissingCompanies`    | **single** `resolveEntity(entity, type)` + `resolveAll(entities)`                     |
| `getMbidForEntity` + `getMbId` + `scheduleRequest` | single `resolveMbid(entity, type, {bypassCache})` in `api-mb.js`                      |
| `convertDiscogsArtistsToRolesRelationships`        | `rolesFromDiscogsArtists`                                                             |
| `_releaseDataCache` / `_urlCheckSessionCache`      | one `sessionCache` exported by `storage.js`                                           |
| `addLogLine`                                       | `log.line` / `log.warn` / `log.error` — severity at the call site, no HTML in strings |
| `getDiscogsLinkKey` + `link_infos` global          | `parseDiscogsUrl(url) → {type, id, cleanUrl, key}` (pure, no global side effect)      |

---

## 3. Testing setup

### 3.1 Layer A — Static (free, ~1 second, you set up once)

What it catches: syntax errors, undefined references, unreachable code, the dangling `+ tracklistRels.length + 1;` at line 991, unused exports, missing `await`s, broken regexes.

**One-time you do (`pnpm install` is the only thing):**
```bash
cd C:\Work\mb-userscripts\userscripts\discogs_credits
pnpm install        # I provide package.json
```

**Scripts (in `package.json`):**
```jsonc
{
  "scripts": {
    "build": "node build.mjs",
    "dev":   "node build.mjs --watch",
    "lint":  "eslint src/ test/",
    "check": "node --check dist/discogs_credits.user.js",
    "verify": "pnpm run lint && pnpm run build && pnpm run check"
  }
}
```

**My rule:** every change ends with `pnpm run verify`. If red, I fix it without bothering you. If green, the build is parse-clean and lint-clean.

### 3.2 Layer B — Headless Playwright (catches behavior, ~30s per fixture)

Your two key insights drive the design:

> "we don't need to commit anything" → never click *Submit*; read `MB.relationshipEditor.state` instead.

> "use [no artist/label/place] with credit set to the real name" → placeholders for unknowns let us test the full dispatch path without entity creation.

> "just a list of release URLs, you check against Discogs data" → property-based, not example-based. New rels must be supported by Discogs; Discogs credits must be present in final state (new or pre-existing); track-level rels must land on the correct recording.

**`test/fixtures.json` — just URLs:**
```json
[
  "https://musicbrainz.org/release/18cae3db-fa2c-493e-8e53-803bed92b8a5",
  "https://musicbrainz.org/release/fd4c7ae2-39b7-4849-a021-856d67fb1e7b",
  "https://musicbrainz.org/release/24f4c94a-c51b-4f9b-b727-a09562c6e4b4",
  "https://musicbrainz.org/release/ba55d980-c3da-438a-bb13-16f4121d5f7a",
  "https://musicbrainz.org/release/62a764a8-cf05-459c-a358-2c65dbf0b729",
  "https://musicbrainz.org/release/d3cb8510-d914-4a8d-8a2e-0b088d6a5827",
  "https://musicbrainz.org/release/5deefe9a-ea67-4d1d-a389-72d17fcd17a2"
]
```

(I'll add the 7 URLs you sent on first commit.)

**`test/run.mjs` — per release:**
1. Launch Playwright with `launchPersistentContext('./.pw-profile')`. **Persistent profile = IDB cache + cookies survive between runs**, so the slow first-time entity lookups happen once.
2. Navigate to the release's `/edit-relationships` page.
3. Snapshot existing relationships (`existingRels`) from `MB.relationshipEditor.state`.
4. Inject the script with `window.__DC_TEST_MODE = true` set first.
5. In test mode the script:
   - Auto-confirms the review table (single exact name match → accept; otherwise → route to MB's `[no artist]` / `[no label]` / `[no place]` special-purpose entity, see §3.4).
   - Does **not** open new tabs for entity creation.
   - Sets `window.__DC_TEST_DONE = {added, skipped, failed}` when finished.
6. Wait for `__DC_TEST_DONE` (timeout 120s).
7. Snapshot final relationships (`finalRels`).
8. `newRels = finalRels − existingRels` (compare by stable signature: linkTypeID + entity0.gid + entity1.gid + entity1_credit + begin_date.year + attrs). The credit + year disambiguate multiple rels to the same `[no artist]` target.
9. Fetch the Discogs JSON for the release.
10. Run assertions (see §3.3). Report per release. Close browser.

**Why a persistent profile is essential:** for releases with ~50 unique credits, fresh IDB means ~50 throttled MB API hits = several minutes per fixture. With persistent profile, second run = <10 seconds.

### 3.3 Assertions (the property-based checks)

For each release fixture, after the import:

| # | Check | What it catches |
| --- | --- | --- |
| 1 | Every `newRel.linkTypeID` exists in `MB.linkedEntities.link_type` | Stale link type IDs |
| 2 | For every `newRel`, the `(linkTypeID, entity0.entityType, entity1.entityType)` triple is valid (`type0`/`type1` match) | **Bug #2** — mastering on recording |
| 3 | For every attribute on every `newRel`, `attrId` exists in `MB.linkedEntities.link_attribute_type` | **Bug #3** — the `[co]` attribute |
| 4 | Every `newRel` corresponds to a Discogs credit (artist name + linkType present in Discogs JSON, optionally on the same track for track-level rels) | Spurious additions |
| 5 | Every Discogs `extraartist` / company / track credit either appears in `newRels` OR `existingRels` OR is a known-skipped type (`ENTITY_TYPE_MAP[...] === null`) | Missed credits |
| 6 | For every track-level `newRel`, the target `recording.gid` matches a recording whose track position equals the Discogs track position (compound `medium-pos` for multi-medium) | **Bug #4** — multi-medium collapse |
| 7 | For every rel whose target is `[no artist]`/`[no label]`/`[no place]`, the `credited_as` equals the original Discogs name and `begin_date.year` is a unique 4-digit ordinal (0001+) within that source entity's rels | Placeholder routing sanity; bug-detection sentinel for missed entity resolution |
| 8 | No `newRel` has both entities equal to the release entity (self-loop check) | Old defensive — cheap |
| 9 | `__DC_TEST_DONE.failed === 0` | Script's own error count |
| 10 | For every auto-resolved entity (not user-confirmed), when both name search AND URL lookup return data, both must agree on the MBID | Auto-match ambiguity — false-positive resolutions where MB has a wrongly-linked Discogs URL |

Assertions fail loudly with the offending Discogs name + the staged rel as JSON. Easy to diagnose.

### 3.4 Routing unknowns to MB's special-purpose `[no artist]` / `[no label]` / `[no place]`

MusicBrainz **already** ships dedicated "Special Purpose" entities for unresolved credits (MBIDs confirmed by user):
- `[no artist]` — [`eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61`](https://musicbrainz.org/artist/eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61)
- `[no label]`  — [`157afde4-4bf5-4039-8ad2-5a15acc85176`](https://musicbrainz.org/label/157afde4-4bf5-4039-8ad2-5a15acc85176)
- `[no place]`  — [`f14d8916-edfd-4e55-97b0-9b996e01d87e`](https://musicbrainz.org/place/f14d8916-edfd-4e55-97b0-9b996e01d87e)

These live as constants in `src/constants.js` so test mode and any future production opt-in share one source of truth (no round-trips needed at startup).

They're real entities with real GIDs, so the dispatch path is exactly the same as for any resolved entity — **no fake-entity registration, no negative IDs, no `MB.mergeLinkedEntities` trick**. Just:

```
entity1        = NO_ARTIST | NO_LABEL | NO_PLACE         // from constants.js
entity1_credit = "Some fake artist"                       // the real Discogs name
begin_date     = { year: 0001, month: null, day: null }   // ordinal disambiguator per source entity
```

The `begin_date.year` is incremented per (source-entity, link-type) pair so multiple unknown credits on the same recording end up distinguishable in the dialog list (matches your screenshot's `0001`). Without it, MB would treat them as duplicates and collapse to one.

**Where it's used:**
- **Test mode (commit 2):** any review-table row that doesn't auto-resolve → route to `[no artist]` etc. Lets the test exercise the full dispatch path without ever touching entity creation.
- **Production (deferred, possibly never):** could expose as opt-in toggle later — "Stage unknowns as `[no artist]` and I'll fix post-import". Not in scope for this refactor; mentioning so we keep the implementation general enough to enable it cheaply later.

**Implementation footprint:** ~30 lines in `dispatch.js` + ~10 in `preflight.js`. MBIDs are constants (`NO_ARTIST`, `NO_LABEL`, `NO_PLACE` in `src/constants.js`), so no startup lookup needed.

### 3.5 Why we can skip `test.musicbrainz.org` for now

You're right that commit-time validation catches some errors not visible in the staged state. But the two specific commit-time errors you've hit (#2 mastering, #3 co-attribute) are **both** detectable pre-commit because MB's own metadata (`link_type.type0/type1` constraints, `link_attribute_type` whitelist) is loaded on the page. Assertions 2 and 3 above catch them without ever submitting.

We'd only need `test.musicbrainz.org` for catching **server-side** validation that isn't reflected in `MB.linkedEntities` — none that I currently know about. Defer until we hit one.

---

## 4. Bugs to fix (during refactor)

| # | Bug | Fix sketch |
| --- | --- | --- |
| #2 | Mastering / orchestra link type wrong for recordings | Two related symptoms confirmed visually:<br>**mastering**: dispatched at recording level but MB has no `mastering` artist↔recording link type (deprecated).<br>**orchestra**: dispatched as `linkTypeID=807` which is "orchestra at" (artist↔event), not the recording-level "orchestra" link type.<br><br>Root cause: `resolveLinkTypeId` (lines 648-687) matches only against `link_type.name`. MB's recording-level "orchestra" link type appears in the dropdown but its internal `name` is **not** literally `"orchestra"` (probably something like `"orchestra performance"`). Step 1 (exact name + types) misses; step 2 (exact name, any types) returns the first iteration hit — "orchestra at" — silently.<br><br>**Fix** (in `mappers.js` after the commit 3 split):<br>1. Match against `name`, `link_phrase`, AND `reverse_link_phrase` — not just `name`.<br>2. ALWAYS require `(type0, type1)` to match the dispatch's `(sourceType, targetType)` — never fall through to a wrong-type link type silently (delete step 2 of the current logic entirely).<br>3. If no valid match, log `WARN no MB link type for "<role>" on (<src>, <tgt>), skipping` and drop the rel.<br><br>Diagnostic to run before fixing: a one-shot probe in `test/run.mjs` that dumps every link type whose `name`/`link_phrase`/`reverse_link_phrase` contains "orchestra" or "mastering", with its `(type0, type1)`. Lock down what MB actually ships before writing the fix. |
| #3 | `[co]` attribute unsupported | Root cause is **not** Discogs data — the string `co` is fabricated by our code at line 3177–3179 (regex `/Co /` on role text → pushes `'co'`) and line 3819–3823 (`'Co-producer'` entry in `ENTITY_TYPE_MAP` has `attributes: ['co']`). MB has no `co` attribute; the MB convention for "Co-X" is the existing `additional` attribute on the base role. Two-layer fix: (a) replace both `'co'` literals with `'additional'`; (b) general guard in `mappers.js`: filter every attribute against `MB.linkedEntities.link_attribute_type` whitelist before building the attribute tree — unknown attrs log warn and are dropped (keeps the rel). The general guard also catches any other fabrications hiding nearby (`assistant`, `executive`, `associate` in the surrounding lines) without us having to audit each by hand. |
| #4 | Multi-medium relations collapsed | The `getRecordingEntity()` heuristic at lines 1036–1071 tries multiple key shapes (`A1`, `1-A1`, `2-A1`, ..., `10-A1`). For multi-medium releases this can pick the wrong medium. Fix: when a release has >1 medium, **require** the compound `medium-position` form and reject plain `A1` lookups. The Discogs `position` field carries enough info to disambiguate (e.g. "1-A1" vs "2-A1") in most multi-medium releases; for cases where Discogs gives only `A1`, fall back to medium order from track index. |
| #5 | **NEW — found by commit 1's ESLint pass.** 51 instruments silently dropped at import time. | The `INSTRUMENTS` table has ~51 duplicate keys (banjo, cello, harp, sitar, piano, organ, saxophone, trumpet, …) where an early mapped entry like `Banjo: 'banjo'` is followed lower in the file by `Banjo: null` from the catch-all "unmapped" block (lines ~4575–4818). Per JS spec, the later `null` wins, so for every release that credits one of these 51 instruments, the script currently sets the attribute to nothing and the instrument tag is dropped. Lint is disabled around the block with a TODO marker; fix in commit 4 by deleting the later `null` duplicates (preserves the intended mapping). This bug has been latent since the data table was assembled; the test gate from commit 2 will measure how much it affected the 7 fixture releases. |
| #6 | **NEW — user-reported during commit-2 testing.** "Done: X added, Y already existed, Z failed" line in the import log only counts pre-existing **works**, not pre-existing relationships. | In `instantFillRelationships` the `skipped` counter increments only on a few specific paths (`dispatchedThisSession` dedup, work-already-linked branch, etc.), but pre-existing relationships dispatched a second time are counted as `added` because MB internally no-ops the redundant dispatch and the script never asks. Fix in commit 4: in `processOne`, before `dispatchRelationship`, scan `sourceEntity.relationships` for an existing rel with matching `(linkTypeID, target.gid, attrs)` — if found, increment a separate `alreadyExistedRels` counter and skip. Report layout: `Done: N added (M rels, K works), L already existed (P rels, Q works), R failed`. Does **not** affect test assertions — the runner diffs `MB.relationshipEditor.state` snapshots directly and ignores the script's own counters. |
| #7 | **NEW — user-reported during commit-2 testing.** Entity-resolution cache (`mblinks` IDB store) only flushes the full confirmed-map after the user clicks "Start import" on the review table. If preflight is interrupted before that (tab close, runner timeout, JS error in the review table) ALL the work the preflight just did is lost — next run starts from scratch. With 230-entity releases at rate-limited pacing this means a full ~10-min preflight thrown away. | Two-part fix: (a) in `checkMissingArtists`/`checkMissingCompanies` (or the unified `resolveEntity` after the commit-3 collapse), write **every** resolved entity to IDB as soon as it resolves, not just on review-table confirm — the inline `db.transaction(...).put(...)` calls in `checkOne()` partially do this for name+URL hits but the bulk `confirmedMap.forEach` write at the end of `startImportRels` is what most rels rely on; (b) the bulk write at the end becomes redundant once (a) is solid, but keep as a final-correctness sweep. Estimated impact: cold-cache restarts become idempotent (re-run resumes from where it crashed). Fix in commit 4. |

All three are covered by the assertions above, so the test will tell us if the fix actually works and won't regress.

---

## 5. Plan of attack — 4 commits, each independently verifiable

| # | Commit | Verify gate | Touches |
| --- | --- | --- | --- |
| 1 | **Tooling.** Add `package.json`, esbuild build, ESLint config, `.gitignore`. The build is a no-op concat of the existing single file (no source split yet) — verifies the toolchain works end-to-end without touching behavior. You confirm `pnpm run verify` is green. | `pnpm run verify` | new files only; `discogs_credits.user.js` becomes `dist/discogs_credits.user.js` (Tampermonkey URL updates) |
| 2 | **Headless harness.** Add Playwright, `login.mjs`, `run.mjs`, `verify.js`, the 7 URLs. You run `node test/login.mjs` once. Confirm `pnpm test` is green on the unchanged script (any red here = an existing bug; we'll catalog and either fix or whitelist before proceeding). | `pnpm run verify && pnpm test` | new `test/` files only |
| 3 | **Source split + dead-code removal.** Move code into `src/` modules. Delete legacy DOM dispatch, compat shims, duplicate lookups. **No behavior change intended.** Tests catch regressions. | `pnpm run verify && pnpm test` per module moved | replaces `discogs_credits.user.js` with `src/` tree |
| 4 | **Bug fixes #2 #3 #4 + renames.** Apply the fixes from §4, do the renames from §2.3, polish. | `pnpm run verify && pnpm test` | mostly `dispatch.js`, `mappers.js`, `editor-state.js` |

You can pause/reject after any commit. I will not start commit N+1 until commit N is green and you approve.

---

## 6. What I need from you (one-time)

1. ✅ Node + pnpm — you have nvm and pnpm, done.
2. **After commit 1:** `pnpm install` in `C:\Work\mb-userscripts\userscripts\discogs_credits`. ~50 MB without Playwright; ~250 MB after commit 2.
3. **After commit 2:** `node test/login.mjs` once. A Chromium window opens; log into musicbrainz.org; close it. Saves auth into `.pw-profile/` (gitignored).
4. **Update Tampermonkey** to load `dist/discogs_credits.user.js` instead of the old path. Either re-paste the dist file once, or point Tampermonkey at the local file URL — your call. I'll document both in the new README section.
5. **Nothing else.** Discogs anonymous API is enough. No MB beta needed. No tokens needed.

---

## 7. Things I explicitly will NOT do (unless you ask)

- Add new user-facing features.
- Run any test against `test.musicbrainz.org` (defer until we hit a server-only validation error).
- Auto-publish to GreasyFork (you publish manually — confirmed).
- Touch the sibling userscripts (`isrc_check`, `magicisrc_soundexchange`).
- Change the script's network/throttle behavior — `mbThrottle` stays as-is.

---

## 8. Open questions — RESOLVED

All three questions answered 2026-05-23; resolutions captured in `DECISIONS.md` and applied below.

1. **Playwright profile location** → per-script: `userscripts/discogs_credits/.pw-profile/` (gitignored). See §3.2.
2. **IDB schema** → no migration concerns (user is on Firefox with no existing cache to preserve). Free to **simplify** the schema: rename store to `entity_cache`, key by Discogs `type/id`, store `{mbid, name, disambiguation, resolvedVia: 'cache'|'name'|'url'|'both', resolvedAt: ISO8601}`. The `resolvedVia` field lets us implement the §3.4 stricter auto-match below. Old code's hardcoded URL strings disappear — we store MBIDs and rebuild URLs on read.
3. **Test mode policy for ambiguous matches** → not particularly important; a wrong pick is just a wrong credit, not a bug. Going with default (b): treat ambiguous as unknown → route to `[no artist|label|place]` placeholder. The real concern is **auto-match correctness** when the script *thinks* it has a unique resolution — addressed below.

<a id="auto-match"></a>

### 8.1 New scope: tighter auto-match (added per Q3 follow-up)

Today's auto-match accepts a single hit from name search OR URL lookup independently. The user noted: **ideally both name and Discogs URL should check out** before we trust the auto-resolution.

**Production logic change** (in `preflight.js`, `resolveEntity`):
- Run name search AND URL lookup in parallel (both already happen today, just sequentially).
- If both return the **same MBID** → resolve confidently (`resolvedVia: 'both'`).
- If only one returns a hit → resolve with lower confidence (`resolvedVia: 'name'` or `'url'`), but **only auto-accept** if it's an exact name match or a direct URL relationship; otherwise → unresolved (user reviews).
- If they return **different MBIDs** → unresolved (user reviews). Currently we silently accept whichever comes first; this is a latent bug source.

**Cache implication:** store `resolvedVia` on the IDB record so we can re-validate weak resolutions later (e.g. promote `'name'`-only to `'both'` if a Discogs link is added in MB).

**Test assertion (added to §3.3):** for every auto-resolved entity in `existingRels` or the resolver output, when both name and URL lookups return data, they must agree on the MBID. Disagreement → test failure with "auto-match ambiguity at <Discogs URL>: name=<mbid1> url=<mbid2>".

---

**Say "go" and I start with commit 1 (tooling only, no behavior change).** Or amend any part of this plan.
