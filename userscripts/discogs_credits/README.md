# Import Discogs Credits

Import Discogs credits as MusicBrainz release relationships.

- [Install at Greasy Fork](https://greasyfork.org/en/scripts/578977-musicbrainz-import-discogs-credits)

This userscript presents itself on *Edit relationships* screen of the MusicBrainz release for those releases having associated Discogs release link.

The workflow is as follows:

1. Script first gets all entities (artists, places, labels) and present them in the *Entity Review Table*.
    1. Each Discogs entity is matched by name and Discogs URL
    1. Perfect hits are automatically selected, while ambiguous or non existent entities are left for the user to resolve or ignore
1. After the data in the review table is confirmed, *Instant Fill* is initiated
    1. Entities that have their MB ID resolved will be associated to release or track depending on options, others are skipped but reported in log
    1. Some relationship are added to the work instead of the track. Non existent work can automatically be created depending on option. If the work doesn't exist, relationship will not be added and will be reported in log
1. At the end and after potential manual interventions, user confirms the edit

![](./screenshot.png)

See also [animated gifs](#animated-gifs).

Based on the userscripts of *mattgoldspink*, *vzell*, *kellnerd*.

## Features

### Import Bar

The UI strip at the top of the page with several options.

Options modify how import works. User selection is saved in local storage. All options are ON by default.

1. **Per-track credits**<br>
Import track-level artist credits in addition to release-level credits.
1. **Move release credits to tracks**<br>
Move appropriate release-level credits to track-level. Instruments, vocals, producer, mix, etc. are dispatched to all recordings instead of the release. This option doesn't move any pre-existing release-level credits.
1. **Create missing works**<br>
For every recording without a linked work, create a new inline work (title = recording title) as part of the edit; also applies to recordings with no work-only artist credits.

### Entity Review Table

Entity lookup, matching, search, create and Discogs link association. Requests visit MB and Discogs trough queue to avoid rate limit (5 concurrent workers, 200ms stager).

**Row colors** are used to signify that attention is needed: 🟢 confirmed, 🟡 name mismatch (verify), 🔴 needs attention (not resolved)

**Discogs links** are checked after entity is selected and appropriate info is shown: ✓ Discogs URL already linked,  "Add Discogs link",  "Linked to a different entity"

- **Parallel lookup**<br>
Checks all artists, labels and places against MB simultaneously. MB lookup - using IDB cache → name search → Discogs URL lookup
- **Inline MB search**<br>
Live search field on every row; results appear as selectable candidates. MBID can be used directly in search to select specific entity. Rows with no suggestions auto-trigger a search so candidates appear immediately. *Select* option appears near all results, use it to mark entity resolved
- **Auto-match**<br>
Name search and Discogs URL lookup run in parallel. Auto-resolution happens only when the result is trustworthy:
  - **Both agree** on the same MB entity → resolved with high confidence (cached as `resolvedVia: 'both'`).
  - **Only one side** returns a hit → auto-accepted only when strong (exact-name unique match OR a direct Discogs↔MB URL relationship).
  - **They disagree** on the MBID → left unresolved for manual review (prevents false positives from a wrongly-linked Discogs URL in MB).
- **Entity Creation**<br>
New-tab creation with auto-select on return - opens creation page pre-filled with name, sort name (guessed), *Person* type, Discogs* URL and link-type ID; after creation the new tab signals back via BroadcastChannel and the row auto-selects the created entity.
- **Cache**<br>
MB results are saved for a day so repeated lookups are instant

### Instant Fill

The dispatch-based zero-dialog import mechanism, skipping existing relationships (idempotent).

- Release-level Relationships — labels, places, company credits, release artists ...
- Tracklist Relationships — instrument, vocal, task attributes ...
- Work-level relationships — lyrics, composition, writer ...
- Automatic creation of non-existent work
- Verbose logging

## Notes

1. **IndexedDB cache**<br>
Stores resolved Discogs URL → MB entity MBID mappings across sessions; checked first before any network requests
1. **Rate-limit handling**<br>
All MB WS2 requests use exponential backoff on 503/429 (1s → 2s → 4s → 8s, up to 4 retries)
1. **Burst concurrency**<br>
Pre-flight checks use 5-slot worker pools with 200ms stagger; Discogs URL checks use a separate 5-slot pool
1. **unsafeWindow**<br>
Uses `@grant unsafeWindow` to access MB's real page `window` (where `MB.relationshipEditor` lives) from the userscript sandbox
1. **BroadcastChannel**<br>
Same-origin cross-tab messaging for the entity-creation → review-table feedback loop
1. **Discogs API**
<br>Fetches release data (artists, companies, tracklist) from `api.discogs.com` using the token from MB's stored Discogs URL

## Animated gifs

For [Funk D’Void - Technoir](https://musicbrainz.org/release/63b2e0e6-5857-43cf-be6b-c98397f5d817), just one work exists, everything else is added by the import script

![usage1](./usage1.gif)

For [Mocky - Music Will Explain (Choir Music Vol. 01)](https://musicbrainz.org/release/3e5946b6-d275-4664-a8e9-1b15f0c55d68), many credits are already in place. Script skips those already created and adds those that do not exist. No works are created because existing ones are found. Existing release level credits that would be added to recordings by the script if they didn't exist, are not removed.

![usage2](./usage2.gif)

## Development

Source lives in `src/`, built artifact in `dist/`. Tampermonkey loads `dist/discogs_credits.user.js`.

### One-time setup

```powershell
pnpm install
pnpm exec playwright install chromium    # ~150 MB, only needed for tests
pnpm run login                           # opens MB, log in once, browser auto-closes
```

`pnpm run login` stores cookies + IDB cache under `.pw-profile/` (gitignored). Subsequent tests reuse the session.

### Iteration loop

```powershell
pnpm run dev        # watches src/, rebuilds dist/ on every save (~30 ms)
pnpm run verify     # lint + build + node --check  (static gate)
pnpm test           # headless run on every fixture in test/fixtures.json
pnpm test -- --headed --only=fd4c7ae2    # show the browser, run one fixture
```

The test gate **never submits any edit to MusicBrainz** — it stages the relationships and reads `MB.relationshipEditor.state` directly to assert against Discogs JSON + MB's own validity rules.

### Layout

```
src/discogs_credits.user.js     source
dist/discogs_credits.user.js    build output (what Tampermonkey loads)
build.mjs                       build driver (pass-through for now; esbuild bundle from commit 3 onwards)
eslint.config.mjs               ESLint 9 flat config
test/
├── fixtures.json               release URLs the tests run against
├── login.mjs                   one-time MB sign-in
├── run.mjs                     main test runner
└── lib/                        Playwright helpers + property-based assertions
dev/
├── ANALYSIS.md                 living refactor plan
├── DECISIONS.md                append-only design-decisions log
└── align-md-tables.mjs         markdown table aligner (dev tool)
```
