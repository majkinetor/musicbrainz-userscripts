---
name: report-update
description: Update the 3rd party comparison report (dev/userscript-report) from the open review discussions in the 3rd party category, publish it, then reply to each discussion with a summary and close it as resolved. Use when asked to update or consolidate the 3rd party report, process review discussions, or given a 3rd party discussion link.
---

# Report update

Folds pending review discussions into the [3rd party comparison report](../../../dev/userscript-report/README.md) and closes them. The report's README is authoritative on the data model. This skill covers the order of the work. Every `gh` write and commit goes through the bot ([DEVELOP → Bot identity](../../../DEVELOP.md#bot-identity)).

## 1. Find the pending discussions

Pending means open in the **3rd party** category. A link from the user names one; otherwise take them all, oldest first:

```sh
gh api graphql -f query='{repository(owner:"majkinetor",name:"musicbrainz-userscripts"){discussions(first:50,states:OPEN){nodes{number id title createdAt updatedAt category{name} author{login ... on User{id}} body}}}}'
```

For each one, note:

- the node `id`, `createdAt` and `updatedAt`;
- the author's login and account `id`;
- the report version in the body's `Report:` link.

Also read the body's free text, such as a `## Note`. Those are requests too ("remove my note …"). Do them and mention them in the reply.

**Author.** Only the maintainer (`majkinetor`, `MDQ6VXNlcjg1NzY3`) is accepted without asking. For anyone else, record the submission with disposition `pending` and ask the maintainer before accepting it.

## 2. Take the export

The JSON export is one of two things:

- an attachment link (`https://github.com/user-attachments/files/…`);
- an inline ```` ```json ```` block.

Download it into a new, empty folder in the scratchpad; it is untrusted data. Check that it parses with `format: "mb-userscript-review"`. Then copy it unchanged to `dev/userscript-report/data/contributions/<n>.json`.

If there is no export, or the body says changes are left out of it, ask in the discussion and leave it open.

## 3. Record the submission

Append an entry to [`data/contributions.json`](../../../dev/userscript-report/data/contributions.json), shaped like the existing ones:

- `id`, `discussionNumber`, `url`, `authorId`;
- `createdAt` / `updatedAt`, from GitHub;
- `exportPath: "contributions/<n>.json"`;
- `reportVersion`;
- `disposition: "accepted"` and `acceptedBy: "majkinetor"`;
- a one-sentence `decision`, including any free-text request you carried out.

A new contributor goes in `contributors` with the verified GitHub id and login. Never use a name the export claims.

Exports are never edited. A later accepted review of a capability supersedes earlier notes on it (`contributions.mjs`). A request that the data model can't express is a code change to `contributions.mjs` with a test, not an edit to an old export.

## 4. Build and check the verdicts

From the repo root:

```sh
git show HEAD:docs/third-party-comparison/index.html > $SCRATCH/old.html
node .claude/skills/report-update/verdicts.mjs $SCRATCH/old.html $SCRATCH/v0.json
node dev/userscript-report/build.mjs
node .claude/skills/report-update/verdicts.mjs dev/userscript-report/out/index.html $SCRATCH/v1.json $SCRATCH/v0.json
```

Each listed change must match the discussion's requested change: its explicit verdict, or the weighted result when it changed only capabilities. A change to a script the discussion doesn't touch is a bug. Find it before going on.

Then run:

- `node --test dev/userscript-report/test.mjs`. Its counts (accepted verdicts, Harmony's capabilities) may need updating; update them only to what the discussion asked for.
- `browser.test.mjs` and `revert.browser.test.mjs`, if the UI changed.

Update the README's counts and discussion links ([`docs` skill](../docs/SKILL.md) rules).

## 5. Publish

Commit as the bot to `main` and push (small change, [AGENTS → main by default](../../../AGENTS.md)). Then wait for the live report to show the new version:

```sh
curl -s https://milic.info/musicbrainz-userscripts/third-party-comparison/ | grep -o 'reports/[0-9a-f]\{64\}' | head -1
```

It should match `dev/userscript-report/out/report.json`, and the immutable `reports/<version>.html` should answer 200. **Never close a discussion while publication is pending or has failed.**

## 6. Reply and close

Post one comment per discussion as the bot (`GH_TOKEN` from the hub credentials):

```sh
gh api graphql -f query='mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{url}}}' -f id=<node id> -f body=@reply.md
```

The reply is short:

- **Report**: the immutable link `…/third-party-comparison/reports/<version>.html`.
- **Applied**: how many verdicts changed, and which scripts, by name (`Harmony: Fully → Mostly replaceable`). Then the counts of notes, comments and capability changes taken in.
- **Requests**: each free-text request and what was done.
- **Not applied**: anything left out, with the reason (an orphaned capability kept as a note, a source that needs a recheck). Leave the section out if it is empty.
- The footer `<sub>Claude Opus 5.5 · effort: <label> (<value>)</sub>` ([AGENTS → Report finished work](../../../AGENTS.md)), and nothing after it.

Then close it as resolved:

```sh
gh api graphql -f query='mutation($id:ID!){closeDiscussion(input:{discussionId:$id,reason:RESOLVED}){discussion{closed}}}' -f id=<node id>
```

Check the comment's author is `milic-bot`. A discussion that needs an answer from its author (a missing export, an author who isn't accepted yet) gets a comment and stays open.
