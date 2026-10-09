---
name: branch-cleanup
description: List this repo's remote branches that are already merged (into main, stable or a long-lived feature branch) and delete them on GitHub. Use when asked to list merged branches, clean up branches, or delete merged/stale branches.
allowed-tools: Bash(gh api -X DELETE repos/majkinetor/musicbrainz-userscripts/git/refs/heads/*)
---

# Branch cleanup

Finds remote branches whose work is already in a target branch and deletes them. The `allowed-tools` line above lets the delete call run without a permission prompt while this skill is active.

## Never delete

- `main` and `stable` ([DEVELOP → Branches](../../../DEVELOP.md#branches-and-channels)).
- `badges`: `suite.yml` force-pushes the test badge numbers there; it never merges.
- A branch someone is still working on, even if one target already holds it, unless the user names it.

## 1. Get full history

Cloud clones are shallow, and a shallow clone misses merges. Fetch everything first:

```sh
git fetch --unshallow -q origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null || git fetch -q --prune origin
```

## 2. Find merged branches

Check each target: `main`, plus any target the user names, such as a long-lived feature branch.

```sh
git branch -r --merged origin/<target> | grep -v -e "origin/<target>$" -e HEAD
```

That only catches real merges. A branch can also be in a target by content: its commits were cherry-picked, squashed or rebased in. For each branch that isn't listed, check:

```sh
git cherry origin/<target> origin/<branch>    # every line "-" → its patches are in <target>
```

If a commit shows `+` but its subject matches a commit on the target, compare the scripts' own changes (`git show <sha> -- userscripts/<dir>`). The generated String Theory bundle and `DOCS.md` change the patch id even when the fix itself is the same.

Report each branch with its target and how it's in there: real merge, identical patch, or the same change under another hash.

## 3. Delete

Write down each branch's tip SHA first, so the user can restore it with `git push origin <sha>:refs/heads/<branch>`:

```sh
git rev-parse origin/<branch>
```

Delete **one branch per command**, with the name spelled out. The allow rule matches the literal command, so a shell loop or variable won't match it.

```sh
gh api -X DELETE repos/majkinetor/musicbrainz-userscripts/git/refs/heads/<branch>
```

`gh auth status` can say `GH_TOKEN` is invalid in a cloud session while API calls still go through the proxy. Trust a real call, such as `gh api repos/majkinetor/musicbrainz-userscripts/branches --jq '.[].name'`. Locally, set the bot token first ([AGENTS.general → GitHub work](../../../dev/agents/AGENTS.general.md#github-work)).

Then `git fetch --prune -q origin` and list what's left.
