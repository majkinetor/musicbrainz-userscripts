---
name: docs
description: Write or change a userscript's user docs (its README.md) or its DEVELOP.md the way this repo agreed, and audit them for drift. Use whenever a change touches a script's README, a feature needs documenting, a new script gets its first README, or the docs need a consistency check.
allowed-tools: Bash(node dev/check-readme.mjs*), Bash(node dev/align-md-tables.mjs*)
---

# Script docs

This skill is the procedure. The rules are elsewhere, and only there:

- [Standard 12](../../../dev/agents/STANDARDS.general.md#standard-12): the shape, the writing, where things go.
- [Script READMEs](../../../STANDARDS.md#script-readmes) in this repo's `STANDARDS.md`: the shape in detail, the exceptions, a script's `DEVELOP.md`.
- The Markdown standards [5](../../../dev/agents/STANDARDS.general.md#standard-5), [8](../../../dev/agents/STANDARDS.general.md#standard-8), [9](../../../dev/agents/STANDARDS.general.md#standard-9) and [11](../../../dev/agents/STANDARDS.general.md#standard-11).

Read them before writing. A rule you find missing goes into the standard, not here.

**Models**: [Fusion's README](../../../userscripts/fusion/README.md) (short), [First Contact's](../../../userscripts/first_contact/README.md) (long; its *Platforms* table with a heading per platform is how a table whose rows need sentences is done), [First Contact's DEVELOP.md](../../../userscripts/first_contact/DEVELOP.md). A new README starts from [`dev/templates/README.md`](../../../dev/templates/README.md).

## Writing or changing a README

1. **Read the whole README**, not only the part you change: what went stale anywhere in it is fixed in the same change.
2. **Check names in the source or the running script** (buttons, settings, menu entries), never from memory.
3. **Write it**: a new feature gets its line in Features and its own section in the same change; a new setting gets its row with what it does.
4. **Detail that doesn't belong in a README moves to the script's `DEVELOP.md`**, with a line in Notes linking it when a user might need it. Create the `DEVELOP.md` if there is none.
5. **Check**: `node dev/check-readme.mjs userscripts/<dir>/README.md`. Fix every ✗, and every ⚠ in what you wrote or touched. Don't add a ⚠; an older one elsewhere is fixed when you can.
6. **Align tables**: `node dev/align-md-tables.mjs userscripts/<dir>/README.md`. Pass only the files you changed: the aligner rewrites every table in what it is given.
7. String Theory's `DOCS.md` is rebuilt by the pre-commit hook; never edit it.

## A new script

No README while its design is still forming (root [AGENTS.md](../../../AGENTS.md)); its notes go in `DEVELOP.md`. Once the maintainer settles the design: the README from the template, the script in the root README's list, then confirm String Theory's next build puts it in `DOCS.md` (the build warns about a member without a README).

## Auditing

1. `node dev/check-readme.mjs` with no arguments checks every script.
2. To see what drifted since a known-good point, run it on each README as it was then (`git show <commit>:<path>` into a scratch folder) and compare with today's output. What is new is drift; an old ⚠ is a backlog.
3. Read the READMEs changed since that point too: the checker can't tell plain words from jargon, or the user's view from the code's.
4. Fix the drift. Report the backlog and ask before working through it, since that rewrites every README at once.
