# Userscript comparison plan

Planning baseline for [#926](https://github.com/majkinetor/musicbrainz-userscripts/issues/926). The deliverable is a searchable HTML report comparing significant workflows in the [MusicBrainz userscript listing](https://musicbrainz.org/doc/Guides/Userscripts) with this toolset. This change records the plan and starting sources; it makes no replacement verdicts and implements no report or scheduled job.

## Scope and decision rule

Compare important editing outcomes: release importing, artist and recording matching, cover-art acquisition and editing, credits and relationships, ISRCs and track links, duplicate merging, bulk entity editing, and reusable form data. Include a niche function whenever losing it would block a real workflow. Ignore cosmetic variations, button placement, shortcuts and small convenience features unless they materially affect accessibility or completing the work.

Inventory the whole listing. Keep trivial or unrelated entries visible as excluded with a reason; do not spend detailed review effort on them. Separate tools that are not userscripts, such as Harmony, from replacement candidates. Include our own wiki entries as self-references, not scripts we have superseded. Recognize aliases and redirects without conflating forks or scripts with the same name.

Use these coverage verdicts:

| Verdict | Meaning |
| --- | --- |
| Replaceable | Every important workflow is covered under stated conditions |
| Mostly replaceable | Main workflow covered; an explicit important limitation remains |
| Partial overlap | Some important workflows covered; substantial reasons to keep both |
| Complementary | Useful alongside the toolset; no replacement claim |
| No equivalent | No toolset route for the important workflow |
| Unassessed / excluded | Not reviewed, unavailable, or outside scope; reason required |

"Obsolete" can be explained as replaceable for the assessed workflow and versions, but should not be a blanket judgment about another project's value. Broken, abandoned and old are separate observations, never proof of replacement. Do not infer functionality from a name, a dead download link or a wiki status label.

## AI review and evidence

Automation collects sources, detects changes, validates records and renders the report. AI reads documentation and code, identifies important capabilities, compares workflows and explains the verdict. Maintainer corrections remain explicit records with their rationale; a later AI run must surface conflicting evidence instead of silently overwriting them. No claim of fully automatic correctness or constant live accuracy.

For each material capability, record its stable ID, purpose, supported entities/platforms, entry point, output, prerequisites and important limitations. Compare actual capabilities rather than counting features. A specialty importer may cover metadata or release structures that a general importer misses. An equivalent result reached through several suite tools must list the complete route and extra steps.

Each assessment stores the external script ID and source fingerprint, required capability IDs, covering toolset scripts and their fingerprints, coverage per capability, remaining gaps, reason, evidence links, reviewer/model and review date. Record evidence strength separately: documentation, code inspection, or live verification. A replacement verdict requires checking both implementations against every important capability; conflicting or missing evidence remains unresolved. Live checks target consequential uncertainty and use the sandbox for edits.

Pilot review candidates, not conclusions: Bandcamp importing against First Contact; Elephant Editor against Mammoth; recording merge helpers against Fusion; cover-art workflows against Art Station; relationship operations against Group Therapy and Credit Hoarder. Include at least one specialist importer and one unrelated workflow as counterexamples. Confirm the candidate's actual source before assessing it.

## Reusable artifacts

Keep machine-readable data independent of presentation. Suggested layout for the implementation:

```text
dev/userscript-report/
  README.md
  collect.mjs
  validate.mjs
  render.mjs
  data/catalog.json
  data/capabilities.json
  data/assessments.json
  data/overrides.json
  data/review-queue.json
  snapshots/<sha256>.*
  out/index.html
```

Stable script IDs use upstream identity (repository and path, or host script ID); titles are display names. Source records preserve canonical and resolved URLs, author, wiki category and row hash, download/source/docs URLs, declared version, upstream commit where available, raw-content SHA-256, fetch status, last successful check and snapshot reference. Versions alone are insufficient: scripts change without a bump, and URLs move. Hash documentation and relevant dependencies too. Retain both raw hashes and optional normalized hashes; normalized equality is only a triage hint.

Store raw wiki content and revision metadata, including transcluded templates when present. Keep the MusicBrainz mirror and the wiki as separate observations because the mirror can lag. Preserve icon-only download/source links; text extraction loses them. Use parsers that handle rowspans and repeated names. Reject login, verification and error HTML even when HTTP status is 200. Retrieval failure preserves the last good snapshot and marks it stale; it must not erase entries or declare them broken.

Store external source/docs snapshots by content hash for incremental comparison. Check licensing before publishing third-party source copies; keep restricted snapshots in a local cache and commit provenance, hashes, URLs and derived assessments. Reviewers must be able to recover the exact inputs or see that an input is unavailable. Never store cookies or tokens. Our own script source is already recoverable through its pinned Git commit.

## Incremental refresh

1. Fetch wiki metadata and diff normalized rows; collect newly listed scripts and changed URLs. Retain removed entries as historical records, hidden from the current listing by default.
2. Check known upstream versions and content with conditional requests where supported. Use bounded, cached collection and per-host pacing. Record each successful check separately from each successful review.
3. Diff our code, docs and relevant shared sources against the assessed commit. Version-only or generated bundle changes trigger triage; a semantic decision that they are irrelevant is recorded with evidence.
4. Build a review queue through assessment dependencies. One external change affects its comparisons; one toolset capability change affects every comparison using it. Shared behavior changes fan out to dependent tools. A changed policy, schema or capability taxonomy can require a wider review.
5. Give the AI the prior assessment, exact old/new sources, diffs and capability dependencies. It updates affected conclusions and records why; it can broaden scope when a diff is ambiguous. Retain unaffected assessments and their original review dates.
6. Validate and regenerate HTML deterministically. Changed dependencies mark the old verdict as needing review immediately. New entries stay unassessed until reviewed. Preserve the historical conclusion and its assessed versions, visibly distinguished from current advice.

Also run occasional full reconciliation: dependencies can be missed, sites can break without script changes, and stronger new toolset features can turn old "no equivalent" findings into candidates. Add an evidence-age review threshold independent of version changes. A new capability queues plausible prior gaps as well as existing positive mappings.

## Report and freshness

The matrix exposes script, author, workflow, verdict, covering tools, important gaps, evidence strength, assessed versions and review date. Search and filters cover workflow, platform, tool, verdict and freshness. Expand a row for capability comparisons, exact evidence and a short migration recipe. Keep author and original source links visible.

Show generated time, collection time, review time and pending-review count separately. An unchanged source checked today does not mean its functionality was tested today. Include a "what changed since the last reviewed report" view and a gap list of important functions the suite does not cover. Avoid numeric obsolescence scores: one missing essential function can outweigh many conveniences.

Start with a standalone static HTML artifact. Decide hosting after the pilot; a GitHub Action can eventually collect and build, while AI review remains an explicit separate step. Proposed cadence: collection weekly and on demand, plus toolset-change detection; no scheduled infrastructure is part of this planning change.

## Delivery sequence and acceptance

1. **Pilot:** review six to ten varied candidates, including full, partial and no-equivalent cases. Produce structured records and a first HTML matrix; use the pilot to settle the capability vocabulary and evidence requirements before classifying the entire list.
2. **Collector and incremental review:** implement source inventory, snapshots, validation and dependency-based review queue. Prove a no-change collection queues nothing, one changed external source queues only its dependents, and shared toolset changes queue all affected comparisons. Prove verification HTML cannot replace a valid snapshot.
3. **First full report:** inventory every listed entry, deeply assess significant overlap candidates, mark every other entry unassessed or excluded with a reason, and show all important gaps. Verify links and consequential replacement claims. Do not label unreviewed rows as covered.
4. **Maintenance:** document the collection → AI review → validation → rendering procedure, agree the publishing location and refresh cadence, and retain assessment history. A data-only change must be sufficient to rebuild the report.

Interesting follow-ons inside the report: a "can I uninstall this?" answer with exact conditions; a multi-tool migration recipe; and a ranked list of missing workflows based on importance and evidence, rather than a feature-count contest. These are proposals, not authorization to implement new userscript features.

## Captured starting point

[baseline.json](baseline.json) records wiki revision **79510** and the toolset's exact `origin/main` commit with versions and SHA-256 hashes for 15 userscript files and adjacent docs. [wiki-79510.wikitext](wiki-79510.wikitext) preserves the wiki source and its embedded source/download links. External script retrieval and capability assessment have not begun. The rejected MusicBrainz mirror response and uncaptured template dependencies are explicitly noted in the manifest.

This baseline is for reproducibility, not a current report: future collection must refresh it before issuing judgments.
