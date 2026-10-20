---
name: suite
description: Run this repo's whole Playwright suite locally, script by script, and handle every failure as it comes - diagnose it at once, recheck it in a background task while the next script runs, fix what is broken on main, tag what is flaky @flaky, and drop @flaky from specs that have held. With `failures`, only the last recorded run's failures are worked; with `flaky`, only the flaky specs. Use when asked to run the full suite, all tests, every spec, or to triage test failures and flaky specs.
argument-hint: "[failures [N] | flaky]"
---

# Suite

Runs every spec, one script (Playwright project) at a time, and deals with each failure while the next script is still running. Full autonomy, as the maintainer said (2026-10-16): fix, commit and push to `main` without asking, tag and untag `@flaky` without asking. Read [`dev/test/README.md`](../../../dev/test/README.md) first.

## Modes

The argument picks one: $ARGUMENTS

| Argument       | What runs                                                                                     | Steps                         |
| -------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| (none)         | the whole suite                                                                               | all                           |
| `failures [N]` | the specs that failed in the newest recorded run, or in the newest `N` runs                   | [Failures only](#failures-only) |
| `flaky`        | the `@flaky` specs, and the ones the history shows failing now and then                       | [Flaky only](#flaky-only)     |

Neither narrowed mode is a full run, so neither is recorded in the test history (§7 step 2).

## Why script by script

The runner allows one worker: all specs share one logged-in profile, and MusicBrainz rate-limits per IP. Two scripts' specs usually hit different MusicBrainz APIs, so the maintainer allows exactly **two** runs at once: the main run on one script, and a recheck or fix test of an earlier script. Never more, and never two runs of the same script.

- The main run uses `.pw-profile`. Rechecks use a copy, `.pw-profile-recheck`, through `PW_PROFILE` (Chromium locks a profile to one browser).
- Each run has its own output folder, so neither wipes the other's artifacts.
- Falcon's Firefox specs open `.pw-profile-ff` themselves: recheck those only when the main run isn't on Falcon.

## 1. Preflight

1. `git pull` on `main`, and note the starting commit. Leave the working tree clean.
2. Make the recheck profile from the real one while no browser has it open: `rm -rf .pw-profile-recheck && cp -r .pw-profile .pw-profile-recheck`. The copy comes out signed out (seen 2026-10-16: every `@login` spec skipped), so sign it in too: `PW_PROFILE=.pw-profile-recheck node dev/test/login.mjs sandbox --auto`.
3. Check the login of both profiles: run one `@login` spec on each. A signed-out profile skips specs instead of failing them, so the run looks green. When one is signed out, run `login.mjs sandbox --auto` for it (with its `PW_PROFILE`). A recheck that reports only skips is the same thing: sign in and rerun it.
   Sign Firefox's profile in too, for Falcon's Firefox specs: `node dev/test/login.mjs sandbox --firefox --auto`. Signed out, they skip in the main run (seen 2026-10-19).
4. Write down the `@flaky` specs (`grep -rn "@flaky" userscripts dev --include=*.spec.mjs`) and the nightly history (`git fetch origin test-history && node dev/test/flaky-report.mjs`), so a failure can be compared with its past.
5. Start a ledger in the scratchpad (`suite-ledger.md`): one row per spec that fails, with its state, which gets updated as it changes.

## 2. Main run (background)

```sh
node dev/test/suite-by-script.mjs > <scratch>/suite.log 2>&1      # run_in_background
```

- `--from <project>` resumes, `--only a,b` narrows, and anything after `--` goes to Playwright.
- Every spec runs: `@web`, `@timing` and `@cosmetic` too.
- Watch the log with **Monitor** for `✘` lines and `=== … done` lines, so each failure and each finished script wakes you. Don't poll.
- Each script's report is `test-results/suite/<project>.json` (errors, attachments) and its artifacts are in `test-results/suite/<project>/`.

## 3. A failure: diagnose at once

When a `✘` appears, read the error from the log. Once that script is done, read its JSON report and the attachments (`log`, screenshots, trace). Then read the spec and the code it tests. Sort it:

| Kind               | Signs                                                                                       | Do                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Environment**    | "Verification failed. Please try again.", "upstream request failed", 503/429, a login page | recheck; it is **never** grounds for `@flaky`. When the session dropped, log the profiles in again                                                                                                                                         |
| **Fixture drift**  | the sandbox lacks a release, link or ISRC the spec expects                                  | `copy-to-sandbox.mjs` / `sandbox-add-links.mjs`, or fix the data on test by hand, then recheck                                                                                                                             |
| **External site**  | `@web` spec; the other site changed or blocks us                                            | change the script if the site really changed, otherwise treat it as environment                                                                                                                                             |
| **Candidate**      | anything else                                                                               | recheck                                                                                                                                                                                                                     |

## 4. Recheck (background, beside the main run)

Start it as soon as the failing script's main run is done. That script is then free, and the main run has moved to the next one:

```sh
PW_PROFILE=.pw-profile-recheck npx playwright test --project=<p> -g "<spec title>" \
  --repeat-each 3 --reporter=list --output=test-results/recheck/<p> > <scratch>/recheck-<p>.log 2>&1
```

Queue the rechecks one at a time, so there are never more than two runs. The result decides the verdict:

- **3/3 fail: broken.** Fix it (§5).
- **Some pass: flaky.** Look for the cause first: a fixed sleep, a race, a check made before the effect shows, an `until` that's missing (README → *No fixed sleeps*). If you find it, fix it and prove the fix with `--repeat-each 10` (all green). If not, add the `@flaky` tag and say in the commit message that it failed once and passed on rerun.
- **3/3 pass.** If it's an environment kind, or it's rare in the nightly history, record it as **once** and change nothing. If it has failed before in the history (the "flaky" or "once" rows of `flaky-report`), tag it `@flaky`.

## 5. Fix, on `main`

- Fix the real cause: the script's bug, or the spec's wrong assumption. Never loosen a check just to make it pass.
- A script fix gets the regression shown: `<NAME>_SRC=<old build> npx playwright test --project=<p> -g …` fails on the old build and passes on the fix. Use the recheck profile and output folder while the main run is going.
- Bump `@version` per [DEVELOP → Branches and channels](../../../DEVELOP.md#branches-and-channels). Never edit inside the shared-block markers: edit the block's source (`dev/ui/…`, `dev/net/…`); the hook syncs it.
- Commit as the bot ([DEVELOP → Bot identity](../../../DEVELOP.md#bot-identity)) and push to `main`. Use the pre-commit hook, never `--no-verify`. When a fix goes in, the hook may rebuild the String Theory bundle or re-sync shared blocks into scripts the main run hasn't reached yet. That is fine: they're tested with the fix.
- A fix to a shared block or the harness can affect scripts that already passed. Rerun those scripts' `@critical` specs after the main run ends.
- After a fix, rerun the whole spec file once, not only the one test.
- If the fix belongs to an open issue, comment on it as the bot with the usual footer (AGENTS.md → *Report finished work on its issue*). Otherwise the commit message is the record.

## 6. Flaky upkeep

- Drop a spec's `@flaky` tag when it passed in this run, its recheck (if any) passed, and `flaky-report` shows no failure of it in the last 10 nightly runs. To be sure, first run `--repeat-each 10` on it (recheck profile); it must be all green. Commit the drop, giving the evidence in the message.
- A `@flaky` spec that fails every rerun is broken, not flaky: fix it (§5).

## 7. Finish

When `=== all done` shows and the rechecks are drained:

1. Rerun the specs that failed in the main run and haven't run green since, all together. This time it's serial, on the real profile.
2. Record the main run in the test history, beside the nightly runs: `node dev/test/suite-record.mjs --commit <starting commit>`. It reads `test-results/suite/`, so record it before anything else runs there. Only a full run counts: every script (a `--from` resume included), started on a clean `main`. Skip it after `--only`, or a run of a branch. The rerun of step 1 isn't recorded; the main run's failures stand, as the nightly's do.
3. Delete the recheck profile.
4. Report in chat with one table: spec · verdict (fixed / flaky-tagged / flaky-fixed / untagged / environment / once / still broken) · what was done · commit link. Above it, put the counts (`=== all done` line) and the start → end commits. A spec that stays broken gets its error and what was tried.

## Failures only

`failures [N]`: no main run. The work list is the newest recorded run's failures, the nightly's or a local one, or every spec that failed in the newest `N` runs.

1. Preflight steps 1 to 3 and 5 (§1).
2. Make the list: `git fetch origin test-history`, then read `history.json` from that branch (`git show origin/test-history:history.json`). Runs are keyed by time, newest first. Each failure's `name` is `[<project>] <file> › <title>`: that gives the project, the spec file and the test title. With `N`, merge the newest `N` runs' failures and note how many of them each spec failed in. Put each one in the ledger with its recorded error.
3. Run each one once, as it is, before you diagnose it: `npx playwright test --project=<p> <file> -g "<title>" --reporter=list --output=test-results/recheck/<p>`. `-g` is a regex, so escape `( ) [ ] . * + ? | ^ $ \` in the title. A spec that passes goes straight to the §4 recheck. One that fails is diagnosed (§3) from this run's report and artifacts.
4. Recheck (§4), fix (§5) and give verdicts as usual, with the history as the tiebreaker. Two runs at once are still allowed, for two different scripts, one on each profile.
5. Finish with §7 steps 1, 3 and 4. The table covers every spec on the list.

## Flaky only

`flaky`: no main run. It settles each flaky spec: untag it, fix it, or keep it tagged.

1. Preflight steps 1 to 5 (§1).
2. Make the list: every `@flaky` spec, plus every spec with a `flaky` row in `flaky-report --runs 10` that isn't tagged yet.
3. Run each one `--repeat-each 10` on its own (the recheck command of §4 with 10 repeats). Two at once, for two different scripts, one on each profile.
4. Give the verdict:
   - **Tagged, 10/10 green, and no failure in the last 10 history runs**: drop `@flaky` (§6).
   - **Tagged, still fails now and then**: look for the cause (§4, flaky). If you find it, fix it and prove it with another `--repeat-each 10`, then drop the tag. If not, it keeps the tag.
   - **Fails every repeat**: broken. Fix it (§5).
   - **Untagged, red in the history**: one red repeat, or a cause that you find, settles it. Fix the cause, or tag it `@flaky`. 10/10 green with no cause found leaves it as it is, and the table says it was green.
5. Finish with §7 steps 3 and 4.
