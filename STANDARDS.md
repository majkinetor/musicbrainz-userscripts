# Standards

This repo's numbered conventions. The ones that hold on any project are in [`dev/agents/STANDARDS.general.md`](dev/agents/STANDARDS.general.md) and apply here in full; this file holds the standards of this repo alone and the repo's details for the general ones. Numbers are shared between the two files and never reused (the next is 13); every number keeps its anchor here, so an old `STANDARDS.md#standard-N` link still lands on it. New ones arrive when the maintainer starts a chat message with `standard: …`: one that would hold on any project goes in the general file.

| Category | Standards |
| --- | --- |
| [Userscripts](#userscripts) | [10](#standard-10) pinned install links |
| [This repo's details](#this-repos-details) | [labels](#labels) · [links](#links) · [script READMEs](#script-readmes) · [tables](#tables) |
| [General](#general) | [1](#standard-1) · [2](#standard-2) · [3](#standard-3) · [5](#standard-5) · [6](#standard-6) · [7](#standard-7) · [8](#standard-8) · [9](#standard-9) · [11](#standard-11) · [12](#standard-12) |
| [Retired](#retired) | [4](#standard-4) per-project decision log |

---

## Userscripts

<a id="standard-10"></a>

### 10. Install links pin to a commit, not a branch

Userscript install / raw URLs shared in chat or on GitHub must reference an **immutable commit SHA**, never a moving branch like `main`. A pinned link always resolves to the exact reviewed code, so a later push can't silently change what a shared link installs.

Format (combines with the `@version` install-link convention — the version is parsed from that pinned file):

```markdown
[Install @<version>](https://github.com/<org>/<repo>/raw/<full-commit-sha>/<path>.user.js)
```

Get the SHA from the commit that last touched the file: `git log -1 --format=%H -- <path>`. Tampermonkey/Violentmonkey still auto-detect the `.user.js` and offer install. Note a pinned link installs a **frozen** version — the manager records that same pinned URL for updates, so share a newer commit-pinned link to ship an update (scripts published to Greasy Fork carry their own rolling `@updateURL`).

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

---

## Retired

<a id="standard-4"></a>

### 4. ~~Per-project `dev/DECISIONS.md` log~~ (retired)

Retired 2026-09 (#623): only the frozen Discogs Importer ever kept one. Decisions live on the GitHub issues, where they were made and discussed; that includes what was declined, so it isn't raised again.
