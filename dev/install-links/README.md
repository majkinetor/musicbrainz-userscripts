# Install links

Makes the install links for a userscript change and checks them, before and after they're posted. [Standard 10](../../STANDARDS.md#standard-10) says every link shared on GitHub or in chat comes from this tool. Hand-typed links kept arriving with the URL in backticks, which GitHub shows as plain text.

```sh
node dev/install-links/install-links.mjs apollo_editor                    # print the links
node dev/install-links/install-links.mjs apollo_editor --into body.md     # put them in a comment body
node dev/install-links/install-links.mjs --check <comment-url>            # check a posted comment
```

It needs Node, `git`, `curl`, and `gh` for `--check` on a comment URL. It runs the same on Windows and in a cloud session.

## Making links

`node dev/install-links/install-links.mjs <script> [...] [--branch <branch>] [--into <file>]`

- **`<script>`** is a folder under `userscripts/` (`apollo_editor`, `as_picker`) or a path to a `.user.js`. For a built script it links the file in `dist/`.
- **`--branch`** is the branch to link. By default it's `main` when HEAD is on `origin/main` (run `git fetch` first, so `origin/main` is current), else the branch checked out, which must be pushed up to HEAD.
- **Which links:** one per script that follows the branch, its label's `@version` read from the branch's head: *latest* on `main`, *branch <name>* otherwise. **String Theory's** is added when a script is one of its [members](../../userscripts/string_theory/members.txt). Pinned (commit) links are only for releases, which [`dev/publish.mjs`](../publish.mjs) writes.
- **Output:** the links go to stdout, one per line, ready to paste unchanged. With `--into <file>`, they replace the line `<!-- install-links -->` in that file, or are appended when the file has none. Write the comment body with that line where the links belong, and post the file.

Every link is checked before it's printed. When a check fails, nothing is printed and the exit code is 1.

## Checking a posted comment

`node dev/install-links/install-links.mjs --check <comment-url | file.md>`

It reads a GitHub comment (`…/issues/<n>#issuecomment-<id>`, through `gh`) or a local file, and checks every install link in it. Run it after posting: the handoff isn't done until it passes.

## What it checks

| Check | Fails on |
| --- | --- |
| Every install URL is a clickable `[label](url)` | a URL in backticks, a bare URL, a link inside a code span |
| A URL is `raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/<branch>/userscripts/…user.js`, or a release's pinned `github.com/…/raw/<40-char SHA>/…` | a bare `main`, a short SHA, a wrong repo slug |
| The URL answers HTTP 200 | a 404 (unpushed commit, wrong path) |
| The label's `@version` equals the file's | a mismatch on a pinned link (a warning on a branch link) |
| The text has at least one install link | none found |

A `@version` mismatch on a branch link is only a warning: raw.githubusercontent.com caches branch URLs for a few minutes after a push. Code blocks (```` ``` ````) are skipped, so a link template in one isn't flagged.
