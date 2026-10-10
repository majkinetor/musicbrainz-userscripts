# Standards

This repo's numbered conventions. The ones that hold on any project are in [`dev/agents/STANDARDS.general.md`](dev/agents/STANDARDS.general.md) and apply here in full; this file holds the standards of this repo alone and the repo's details for the general ones. Numbers are shared between the two files and never reused (the next is 14); every number keeps its anchor here, so an old `STANDARDS.md#standard-N` link still lands on it. New ones arrive when the maintainer starts a chat message with `standard: …`: one that would hold on any project goes in the general file.

| Category | Standards |
| --- | --- |
| [Userscripts](#userscripts) | [10](#standard-10) pinned install links |
| [This repo's details](#this-repos-details) | [labels](#labels) · [links](#links) · [script READMEs](#script-readmes) · [tables](#tables) |
| [General](#general) | [1](#standard-1) · [2](#standard-2) · [3](#standard-3) · [5](#standard-5) · [6](#standard-6) · [7](#standard-7) · [8](#standard-8) · [9](#standard-9) · [11](#standard-11) · [12](#standard-12) · [13](#standard-13) |
| [Retired](#retired) | [4](#standard-4) per-project decision log |

---

## Userscripts

<a id="standard-10"></a>

### 10. Install links pin to a commit, not a branch

Every userscript install link shared in chat or on GitHub comes with one pinned to an **immutable commit SHA**. A pinned link always resolves to the exact reviewed code, so a later push can't silently change what it installs.

```markdown
[Install @<version> (pinned)](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/<sha>/userscripts/<dir>/<file>.user.js)
[Install @<version> (latest, auto-updates)](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/<dir>/<file>.user.js)
```

- **Pinned**, always: the **full 40-character SHA** of the pushed commit (a short SHA 404s), and the `@version` read from the file at that commit.
- **Latest**, besides the pinned one, only once the work is on `main` (or `stable`, as `refs/heads/stable`); never for a feature branch.
- Clickable `[label](url)` links, never bare URLs, and never with the URL wrapped in backticks, which GitHub shows as plain text.
- **Make the links with [`dev/install-links.mjs`](dev/install-links.mjs), never by hand.** `node dev/install-links.mjs <script> [...] --sha <sha>` prints them: pinned, latest once the commit is on `main`, and String Theory's for a bundled script. Each link is checked before it's printed (full SHA, HTTP 200, the label's `@version` equal to the file's). Paste its output unchanged, or write the body to a file with a `<!-- install-links -->` line and let `--into <file>` fill that line in.
- **Check the posted comment**: `node dev/install-links.mjs --check <comment-url>`. If it fails, edit the comment until the check passes; until then the handoff isn't done.

Tampermonkey/Violentmonkey auto-detect the `.user.js` and offer install. A pinned link installs a **frozen** version: the manager records that same pinned URL for updates, so share a newer pinned link to ship an update (scripts published to Greasy Fork carry their own rolling `@updateURL`).

---

## This repo's details

### Labels

For [Standard 2](#standard-2), the area labels are:

- `area | <script>` — the script the issue is about; one per script it touches. Its changelog gets the line.
- `general` — work that belongs to no single script, or is non-functional: tooling, tests, CI, docs, shared blocks. It gets its own *General* section, listed first in the release notes and in String Theory's changelog; a `general` issue that is neither bug nor enhancement goes under *Changes*.

The release script that copies issue titles into the changelog ([Standard 1](#standard-1)) is `dev/publish.mjs`.

### Links

For [Standard 9](#standard-9), the usual targets:

- **Project docs** — e.g. `[Apollo's matching](userscripts/apollo_editor/README.md#matching)` rather than the bare word `Apollo`.
- **MusicBrainz entities** — the entity page by MBID, e.g. `[SST GmbH](https://musicbrainz.org/place/0c5c44bc-2d8d-4c72-b007-fbc752dfe8dc)` rather than just `SST GmbH (0c5c44bc-…)`.
- **Discogs entities** — the entity page by Discogs ID, e.g. `[SST GmbH](https://www.discogs.com/label/3987)` rather than the bare ID.

### Script READMEs

For [Standard 12](#standard-12), every script's README follows one shape, so a reader who knows one knows them all. [`dev/templates/README.md`](dev/templates/README.md) is the skeleton to start from; [Fusion's README](userscripts/fusion/README.md) is a short worked example and [Apollo's](userscripts/apollo_editor/README.md) a long one.

**Shape**, in this order:

1. **Title and pitch**: the name with its icon, one sentence saying what the script is for, then the install links (stable, latest, the bundle), the changelog, and a screenshot.
2. **Features**: one line per feature, each linking to its section. No detail here.
3. **One section per feature**, in the same order as the list. Lead with what the user does and sees.
4. **Settings**: a table of *Setting* · *Default* · what it does, with each name exactly as the settings window shows it.
5. **Shortcuts**: a table of every key and mouse gesture.
6. **Notes**: only for what is neither a feature nor a setting. Leave the section out otherwise.

Screenshots live in the script's `screenshots/` folder. String Theory's `DOCS.md` is generated from the members' READMEs; never edit it.

**Exceptions**, agreed in the 2026-09 tidy-up: [Bandcamp Player Enhanced](userscripts/bandcamp_player_enhanced/README.md) is mostly keys, so it has no feature sections and puts Shortcuts first; [String Theory's README](userscripts/string_theory/README.md) is about the bundle, not a script.

**A script's `DEVELOP.md`** is for maintainers and other scripts' authors. It opens with *Reference for maintainers and other scripts' authors* and a link to the root [DEVELOP.md](DEVELOP.md), then has one `##` per topic: a handoff, how each source is read, a plugin API, storage. [First Contact's](userscripts/first_contact/DEVELOP.md) is the model.

[`dev/check-readme.mjs`](dev/check-readme.mjs) checks a README against this shape and the rules of Standard 12 that a script can check.

### Tables

For [Standard 5](#standard-5), the enforcer is [`dev/align-md-tables.mjs`](dev/align-md-tables.mjs) (generic, takes any markdown files as args).

---

## General

These live in [`dev/agents/STANDARDS.general.md`](dev/agents/STANDARDS.general.md); the anchors stay here so old links keep working.

<a id="standard-1"></a>

- **1.** Issue titles read as changelog entries → [Standard 1](dev/agents/STANDARDS.general.md#standard-1)

<a id="standard-2"></a>

- **2.** Labels are meaningful → [Standard 2](dev/agents/STANDARDS.general.md#standard-2)

<a id="standard-3"></a>

- **3.** PowerShell, not bash, for scripts and commands → [Standard 3](dev/agents/STANDARDS.general.md#standard-3)

<a id="standard-5"></a>

- **5.** Markdown table alignment → [Standard 5](dev/agents/STANDARDS.general.md#standard-5)

<a id="standard-6"></a>

- **6.** Hard line breaks for stacked metadata → [Standard 6](dev/agents/STANDARDS.general.md#standard-6)

<a id="standard-7"></a>

- **7.** AI-driven git work uses a dedicated bot identity → [Standard 7](dev/agents/STANDARDS.general.md#standard-7)

<a id="standard-8"></a>

- **8.** Headers — blank line before and after, always → [Standard 8](dev/agents/STANDARDS.general.md#standard-8)

<a id="standard-9"></a>

- **9.** Link every referenced entity to the closest anchor → [Standard 9](dev/agents/STANDARDS.general.md#standard-9)

<a id="standard-11"></a>

- **11.** Never hard-wrap prose — let it reflow → [Standard 11](dev/agents/STANDARDS.general.md#standard-11)

<a id="standard-12"></a>

- **12.** User docs are compact: one shape, plain words → [Standard 12](dev/agents/STANDARDS.general.md#standard-12)

<a id="standard-13"></a>

- **13.** Small fixes on `main`, substantial work on a branch → [Standard 13](dev/agents/STANDARDS.general.md#standard-13)

---

## Retired

<a id="standard-4"></a>

### 4. ~~Per-project `dev/DECISIONS.md` log~~ (retired)

Retired 2026-09 (#623): only the frozen Discogs Importer ever kept one. Decisions live on the GitHub issues, where they were made and discussed; that includes what was declined, so it isn't raised again.
