# Userscript comparison pilot

Seven AI-reviewed workflow comparisons for [#926](https://github.com/majkinetor/musicbrainz-userscripts/issues/926), rendered as a standalone [searchable HTML matrix](out/index.html). The original [plan and baseline](../reports/926-userscript-comparison/PLAN.md#delivery-sequence-and-acceptance) remain available. The pilot makes code-level coverage judgments, with important limitations beside each finding; no live submission or provider-success comparison was run.

## View or rebuild

Open `dev/userscript-report/out/index.html` in a browser. It works offline; search and filters need JavaScript. Evidence links open pinned GitHub sources. The seven rows are the reviewed pilot, not a complete inventory of the wiki.

Requires Node.js 22+; rebuilding has no network or package dependencies:

```powershell
node dev/userscript-report/build.mjs
node --test dev/userscript-report/test.mjs
```

The output comes entirely from [sources.json](data/sources.json) and [reviews.json](data/reviews.json). Do not edit generated HTML or [review-queue.json](data/review-queue.json). Rebuilding identical inputs produces identical output. The browser also marks evidence older than 90 days as needing review.

## Collect changed sources

Requires Git, authenticated GitHub CLI and Windows `curl.exe`. Fetch the intended `origin/main` before collection. Agent-run Git subprocesses must use the editor environment required by [the agent rules](../agents/AGENTS.general.md#github-work).

```powershell
$env:GIT_EDITOR = 'true'
$env:GIT_SEQUENCE_EDITOR = 'true'
$env:GIT_MERGE_AUTOEDIT = 'no'
git fetch origin main
node dev/userscript-report/capture.mjs
node dev/userscript-report/build.mjs
```

Collection is read-only against upstream services. It checks the seven [configured targets](data/targets.json), pins each repository branch to a commit, captures the entry script, records versions/licenses/requirements and SHA-256 hashes, checks the wiki revision, and fingerprints toolset scripts and their adjacent docs at `origin/main`. It caches public source bytes locally in `.cache/` by hash; third-party source copies are not published. No token is written to data files. Requests run sequentially and identical repository-branch lookups are reused within a run.

A failed request or invalid response stops collection before replacing the previous successful source manifest. The HTML remains an explicitly dated snapshot; a failed check is reported by the command, not silently treated as a successful fresh collection. This pilot collector does not crawl external shared dependencies, follow all wiki rows, or compare the transcluded MusicBrainz mirror. Those limits are shown in the report.

## AI review procedure

1. Preserve the previous successful source manifest before collecting. Read the generated queue, then compare the old and new cached source hashes. If the cache is missing, retrieve the exact pinned commit from the evidence link; never substitute a moving branch.
2. Read the important source and documentation changes on both sides. Compare capabilities, prerequisites, outputs, source coverage and material gaps. Cosmetic changes need no feature-by-feature analysis. Investigate uncertain provider behavior separately; sandbox any editing checks.
3. Edit only the affected assessments in `data/reviews.json`. Keep capability IDs stable. Update reasons, gaps, evidence locators, confidence and migration route. Record the actual reviewer, review date, assessed external record, assessed toolset commit, relevant version records and the input-hash map. A version-only triage still needs a recorded reason; collection never approves a verdict.
4. Rebuild and inspect the HTML. Validate the change queue before publishing; keep unchanged assessment dates. A changed dependency leaves the historical verdict visible under **Needs review**, with links to the exact assessed versions.

Positive findings depend on the compared suite tools' scripts/docs; no-equivalent findings depend on the whole captured suite inventory. Alias findings also depend on the shared alias source. The wiki fingerprint is conservative: a changed revision queues every pilot review. Newly introduced files are detected by dependency-set comparison. The collector's entry-script hashes include inlined shared blocks, but external `@require` code is listed rather than independently fingerprinted or reviewed.

Preserve each published Git commit for history. Git tracks source manifests, judgments, rationale and the generated artifact together. Do not regenerate `reviewedInputs` merely to clear the queue; it records completed AI review. Maintainer corrections belong in the assessment's rationale and the issue, and must be carried forward explicitly. A dedicated override layer and a full inventory collector remain later milestones.

## Review policy

**Replaceable** means every important assessed function is covered under the row's stated conditions. **Mostly replaceable** leaves an important limitation. **Partial overlap** preserves substantial reasons to keep both. **No equivalent** is a scoped inventory finding. Unreachable, old or wiki-marked broken never implies replaceable.

Confidence and freshness are independent of coverage. All pilot findings have medium confidence: entry implementations and suite code/docs were inspected, external shared requirements were not fully reviewed, and no end-to-end comparisons were run. The evidence panel makes this explicit before anyone relies on an uninstall recommendation.

Periodic reconciliation must revisit prior gaps when the suite adds capabilities and when websites change without source updates. New candidate discovery, scheduling, hosting and a maintainer-override file are not implemented by this pilot.
