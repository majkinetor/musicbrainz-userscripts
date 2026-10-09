---
name: docs
description: Write or change a userscript's user docs (its README.md) or its DEVELOP.md the way this repo agreed, and audit them for drift. Use whenever a change touches a script's README, a feature needs documenting, a new script gets its first README, or the docs need a consistency check.
allowed-tools: Bash(node dev/check-readme.mjs*), Bash(node dev/align-md-tables.mjs*)
---

# Script docs

The rules are [Standard 12](../../../dev/agents/STANDARDS.general.md#standard-12) and this repo's [Script READMEs](../../../STANDARDS.md#script-readmes); this skill is how to apply them so every README reads the same. Read both before writing. When this file and they disagree, they win: fix this file.

The reference READMEs are [Fusion's](../../../userscripts/fusion/README.md) (short) and [First Contact's](../../../userscripts/first_contact/README.md) (long, and the one the last rules were worked out on). A new README starts from [`dev/templates/README.md`](../../../dev/templates/README.md).

## Steps

1. **Read the whole README first**, not only the part you're changing. Standard 12 says a touched doc is left whole: what went stale anywhere in it is fixed in the same change.
2. **Read the code or use the feature** for what you describe. Names (buttons, settings, menu entries) are written exactly as the script shows them; check them in the source, not from memory.
3. **Write it** (below).
4. **Run the checker**: `node dev/check-readme.mjs userscripts/<dir>/README.md`. Fix every ✗. Fix each ⚠ your change caused or that sits in what you touched; an old ⚠ elsewhere is fixed when you can, never made worse.
5. **Align tables**: `node dev/align-md-tables.mjs userscripts/<dir>/README.md`.
6. **Low-level detail you removed goes to the script's `DEVELOP.md`**, not away (create one if it has none; see [DEVELOP.md](#developmd)).
7. String Theory's `DOCS.md` is rebuilt by the pre-commit hook; never edit it.

## The shape

In this order, nothing else at the top level:

| Part | What it holds |
|---|---|
| `# Name` + icon | one sentence on what the script is for |
| links | install (stable, latest), the bundle, changelog, view users |
| screenshot | a real capture from `screenshots/` |
| `## Features` | one line per feature, each linking its section |
| a section per feature | in the Features list's order |
| `## Settings` | *Setting* · *Default* · what it does |
| `## Shortcuts` | *Key* · *Where* · what it does |
| `## Notes` | only what is neither a feature nor a setting; else left out |

- **Features** names, it doesn't explain: `- **[Name](#name)**: one line.` After the list, at most one short paragraph on how the features fit together (Apollo's and Credit Hoarder's are the model). Settings, Shortcuts and Notes are not features and aren't listed.
- **Every section is in the list**: a new feature gets its line in the same change. A reference section (*Platforms*, *Providers*) may instead be linked from inside a feature's line.
- **Settings**: every row says what the setting does, the name exactly as the ⚙ window shows it. An empty last column is a gap, not a style.
- **Exceptions agreed in the 2026-09 tidy-up**: Bandcamp Player Enhanced is shortcuts-first (it is mostly keys), and String Theory's README is about the bundle. Don't "fix" them into the shape.

## Writing

- **The user's view**: what they do and what they see, in short sentences and plain words. Not how the code does it.
- **Each thing once**, in its section. Don't repeat a section in Features, in a table and again in a note.
- **Present tense, no history**: no "now", "no longer", "used to", "since #123", "(#456)". A feature that changed is described as it is. The changelog and the issues keep history.
- **Leave out what every UI does**: Esc closes, hover shows a button, a click selects.
- **Background and reasons** go in a `> [!NOTE]` at the *end* of their section, so the instructions read straight through. An `> [!IMPORTANT]` above Features is for the one thing a user must know before installing (First Contact's archiving).
- **Link** every script, section, MusicBrainz entity and external site you name ([Standard 9](../../../dev/agents/STANDARDS.general.md#standard-9)).
- One paragraph, list item or table cell is one line ([Standard 11](../../../dev/agents/STANDARDS.general.md#standard-11)); a blank line around every heading ([Standard 8](../../../dev/agents/STANDARDS.general.md#standard-8)).

## Tables

A list of alike things is a table: providers, platforms, settings, keys, statuses, confidence levels.

- **Cells are short facts**: a word, a value, a ✓. The checker warns past ~90 characters.
- **When a row needs sentences**, keep the table to the facts and give each row its own `###` heading below it, with the sentences there, the table's name cell linking to it. First Contact's *Platforms* table and its per-platform sections are the model, and ISRC Scout's providers link their own headings under Notes the same way.
- **A list of more than three or four bulleted sentences under one button is the same smell**: split it into a short table plus prose, or headings.

## What doesn't go in a README

Moved to the script's `DEVELOP.md`, with one line in **Notes** linking it when a user might need it:

- APIs, endpoints, tokens, keys, storage (`GM_*`, `localStorage`, `mbuShared`), events, selectors, timings in ms, request counts.
- How another script talks to this one (handoffs, plugin APIs, `?param=` seeds), unless a *user* types it.
- How to build, test or change the script.

## DEVELOP.md

For maintainers and other scripts' authors. Opens with `*Reference for maintainers and other scripts' authors*` and a link to the root [DEVELOP.md](../../../DEVELOP.md); then one `##` per topic (a handoff, how each source is read, a plugin API, storage keys). [First Contact's](../../../userscripts/first_contact/DEVELOP.md) is the model. Plain words still apply; history still goes to the issues.

## A new script

No README while its design is still forming (root [AGENTS.md](../../../AGENTS.md)); its notes live in `DEVELOP.md`. When the maintainer settles the design, write the README from the template, add the script to the root README's list, and check that String Theory's `DOCS.md` picks it up on the next build.

## Auditing

`node dev/check-readme.mjs` with no arguments checks every script. To see drift since a known-good point, run it on the README as it was then (`git show <commit>:userscripts/<dir>/README.md > tmp.md`) and on the current one, and compare. Report what is new; don't mass-rewrite old ⚠ without the maintainer's go, since that changes every README at once.
