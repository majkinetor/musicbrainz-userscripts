---
name: suite
description: Run this repo's whole Playwright suite locally, script by script, and handle every failure as it comes - diagnose it at once, recheck it in a background task while the next script runs, fix what is broken on main, tag what is flaky @flaky, and drop @flaky from specs that have held. Use when asked to run the full suite, all tests, every spec, or to triage test failures and flaky specs.
---

# Suite

Runs every spec, one script (Playwright project) at a time, and deals with each failure while the next script is still running. Full autonomy, as the maintainer said (2026-10-16): fix, commit and push to `main` without asking, tag and untag `@flaky` without asking. Read [`dev/test/README.md`](../../../dev/test/README.md) first.

## Why script by script

The runner allows one worker: all specs share one logged-in profile, and MusicBrainz rate-limits per IP. Two scripts' specs usually hit different MusicBrainz APIs, so the maintainer allows exactly **two** runs at once: the main run on one script, and a recheck or fix test of an earlier script. Never more, and never two runs of the same script.

- The main run uses `.pw-profile`. Rechecks use a copy, `.pw-profile-recheck`, through `PW_PROFILE` (Chromium locks a profile to one browser).
- Each run has its own output folder, so neither wipes the other's artifacts.
- Falcon's Firefox specs open `.pw-profile-ff` themselves: recheck those only when the main run isn't on Falcon.

## 1. Preflight

1. `git pull` on `main`, and note the starting commit. Leave the working tree clean.
2. Make the recheck profile from the real one while no browser has it open: `rm -rf .pw-profile-recheck && cp -r .pw-profile .pw-profile-recheck`.
3. Check the login: run one `@login` spec. A signed-out profile skips specs instead of failing them, so the run looks green. When it's signed out, run `node dev/test/login.mjs sandbox --auto` and copy the profile again.
4. Write down the `@flaky` specs (`grep -rn "@flaky" userscripts dev --include=*.spec.mjs`) and the nightly history (`git fetch origin badges && node dev/test/flaky-report.mjs`), so a failure can be compared with its past.
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
2. Delete the recheck profile.
3. Report in chat with one table: spec · verdict (fixed / flaky-tagged / flaky-fixed / untagged / environment / once / still broken) · what was done · commit link. Above it, put the counts (`=== all done` line) and the start → end commits. A spec that stays broken gets its error and what was tried.
