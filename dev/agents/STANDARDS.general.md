# Standards — general

The maintainer's numbered conventions that hold on **any** project. A repo's root `STANDARDS.md` adds its own standards and the repo-specific details of these. Numbers are shared between the two files and never reused; each standard keeps its anchor (`#standard-N`) wherever it lives. New ones arrive when the maintainer starts a chat message with `standard: …`: a standard that would hold on any project goes here, anything else in the repo's `STANDARDS.md`.

| Category                                      | Standards                                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Issues and changelog](#issues-and-changelog) | [1](#standard-1) titles as changelog lines · [2](#standard-2) labels                                                                                     |
| [Git and GitHub](#git-and-github)             | [7](#standard-7) bot identity · [9](#standard-9) link everything · [13](#standard-13) branches                                                           |
| [Documentation](#documentation)               | [12](#standard-12) the compact style                                                                                                                     |
| [Markdown](#markdown)                         | [5](#standard-5) table alignment · [6](#standard-6) hard line breaks · [8](#standard-8) blank lines around headers · [11](#standard-11) no hard wrapping |
| [Environment](#environment)                   | [3](#standard-3) PowerShell                                                                                                                              |

---

## Issues and changelog

<a id="standard-1"></a>

### 1. Issue titles read as changelog entries

Issue titles describe the user-visible symptom (for bugs) or the feature name (for enhancements). They become **changelog lines verbatim**: the release script copies the issue title across as the bullet text, untouched. The labels decide where the bullet lands ([Standard 2](#standard-2)). Only the release run writes a changelog; never hand-edit a `CHANGELOG.md` during feature work.

Format per bullet:

```markdown
1. <issue title verbatim> ([#N](https://github.com/<org>/<repo>/issues/N))
```

Rules for the title itself (so the verbatim copy reads well):

- No leading verb (`Fix`, `Add`, `Persist`, `Refactor`, …).
- Telegraphic English: drop articles, auxiliaries and filler (`Release title lost on reload`, not `The release title is lost when the page is reloaded`).
- No component prefix (`Apollo Editor: …`) — the area label says which component it is ([Standard 2](#standard-2)).
- No internal implementation details — no line numbers, exact counts, internal variable names, file paths.
- Describe what the user observes (for bugs) or what the feature is (for enhancements), not how it's implemented.

| Bad                                                                      | Good                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Fix 51 instruments silently dropped due to duplicate keys in INSTRUMENTS | Some instruments silently dropped due to duplicate keys in map |
| Persist entity-resolution cache incrementally instead of only on confirm | Incremental cache persistence                                  |

If the title doesn't read well in the changelog, **fix the title first** (then update the changelog from the new title) — don't paraphrase in the changelog. The single source of truth is the issue tracker.

<a id="standard-2"></a>

### 2. Labels are meaningful

- `bug` — something is broken; the user sees incorrect behaviour. Lands under *Fixes*.
- `enhancement` — a new feature, refactor, or improvement that wasn't broken before. Lands under *Features*.
- An **area** label per component, where a repo has several, saying whose changelog gets the line; the repo's `STANDARDS.md` names them.

If an issue filed as a bug turns out to be an enhancement after investigation, relabel.

---

## Git and GitHub

<a id="standard-7"></a>

### 7. AI-driven git work uses a dedicated bot identity

Commits, branches, Issues, PRs, and Discussions created by an AI assistant go through a separate GitHub account, never via the maintainer's authenticated session. The bot's PAT lives at the repo-root path **`dev/.github-credentials.json`** (gitignored — see the root `.gitignore`). Push-with-token URLs are one-shot — never `git push -u` the URL form, which would write the token into `.git/config`.

**This applies to `gh` CLI calls too.** The local `gh` is logged in as the maintainer (for human use); every `gh` write (`gh pr create`, `gh issue comment`, `gh pr close`, …) made by the AI assistant **must** explicitly override the auth with the bot's PAT:

```powershell
$env:GH_TOKEN = (Get-Content dev/.github-credentials.json | ConvertFrom-Json).token
gh pr create --title …      # now authenticated as the bot
```

Without `GH_TOKEN`, `gh` silently posts as the maintainer, which only shows afterwards in the author field.

**Commits too**: commit with `git -c user.name=… -c user.email=… commit` (a `git merge` needs the same `-c` flags), then verify the author.

This keeps human and bot activity attributable, makes rotating a token easy, and a bot's mistake easy to revert.

<a id="standard-9"></a>

### 9. Link every referenced entity to the closest anchor

When referencing docs, code artifacts, or external entities in chat or on GitHub, **always provide a link** — and aim for the most specific anchor available, not the project's front page. The reader should be able to click straight to the thing being discussed without doing their own search.

Apply to:

- **Project docs in the repo** — link with a relative path *and a header anchor* when the relevant section is known: `[the matching rules](docs/README.md#matching)` rather than a bare name.
- **External entities** (records in a database, a site's pages) — link to the entity's own page by its ID, rather than quoting the bare ID. The repo's `STANDARDS.md` gives its usual sites.
- **Issues, PRs, commits** — use `#N` (GitHub auto-links inside the repo) or full URLs when posting elsewhere.

**Make documents anchorable.** When you need to reference a doc section that has no good link target, *fix the doc first*: add a header (preferred — it shows in the GitHub TOC), or drop an explicit anchor where a header would feel out of place:

```markdown
<a id="auto-match-disagreement"></a>

A paragraph that other commits / PRs / chat messages can now link
to via `…/README.md#auto-match-disagreement`.
```

Both header anchors (`## My Section` → `#my-section`) and explicit `<a id="…"></a>` work on GitHub. Prefer headers; use explicit anchors only when no header fits.

The goal is *zero-friction verification*: every claim that names a thing carries its own evidence trail.

<a id="standard-13"></a>

### 13. Small fixes on `main`, substantial work on a branch

- **Small fixes** go straight to `main`.
- **Substantial work** goes on a feature branch named after its issue, `<topic>-<issue>`, and is merged when it's ready to ship.
- After a verified merge, **delete the branch**, remote and local.

---

## Documentation

<a id="standard-12"></a>

### 12. User docs are compact: one shape, plain words

Every user doc of one kind (a component's README, say) follows **one shape**, so a reader who knows one knows them all. The repo's `STANDARDS.md` gives the shape and a template; the order is always: title and pitch → a one-line-per-feature list → a section per feature → settings → shortcuts → notes (only if needed).

- The feature list links every feature section, in the sections' order; a reference section (a list of sources, say) may be linked from inside a feature's line instead. One short paragraph after the list may say how the features fit together.
- Settings, shortcuts and notes aren't features and aren't in the list.
- Every setting says what it does, under its name exactly as the settings window shows it.

**Writing**

- Short sentences, plain words. Say what the user sees and does, not how the code does it.
- No low-level technical detail (APIs, tokens, storage keys, events, selectors, timings) in the README. A user who might need it gets a short line in **Notes** that links the component's `DEVELOP.md`, where the detail lives.
- A list of alike things is a table: sources, cutoffs, confidence levels, settings, gestures. Keep its cells short (a word, a value, a ✓). When many cells would hold sentences, keep the table to the short facts and give each item its own heading below it, so the text reads as prose and each item can be linked.
- Background, reasons and "how it works" go in a `> [!NOTE]` at the end of their section, so they don't break the flow of the instructions.
- Leave out everyday UI behaviour: Esc closes a window, a button shows on hover, there's no button to press.
- Say each thing once. A feature's behaviour is in its section; the Features list only names it.
- No history in the prose: no "used to", no "is now", no "since #123", no "(#456)" or bare issue number. Describe a changed feature as it is. The changelog and the issues keep the history.
- When a doc is touched, what went stale is corrected in the same change; code examples a spec reads must stay valid.

**Where things go**

- The README is for users. How to build, test or change a component goes in its `DEVELOP.md`, and the repo-wide procedure in the root `DEVELOP.md`.
- How other programs use a component (its API, a handoff, a plugin interface, a protocol) goes in its `DEVELOP.md`, unless it is something a user types.
- Screenshots are real captures, not mockups.
- Generated docs are never edited by hand.

The Markdown standards ([5](#standard-5), [6](#standard-6), [8](#standard-8), [11](#standard-11)) apply as everywhere.

---

## Markdown

<a id="standard-5"></a>

### 5. Markdown table alignment

Column-align tables by padding cells with spaces so columns line up. Fall back to **compact** form (`| cell | cell |` with a minimal `| --- | --- |` separator) when any row's cumulative cell content exceeds **200 characters** — past that, alignment makes the line so long it hurts readability more than it helps.

A repo may ship an enforcer; its `STANDARDS.md` names it.

<a id="standard-6"></a>

### 6. Hard line breaks for stacked metadata

When several consecutive `**Key:** value` lines should render as separate lines (e.g. start time / command / fixtures / finished / result), append two trailing spaces to each — without them GitHub's renderer collapses them into a single paragraph.

<a id="standard-8"></a>

### 8. Headers — blank line before and after, always

Every `#`, `##`, `###`, … gets a blank line *before* and a blank line *after*. No exceptions for the level-1 at the top of a file (still needs the blank line below) or for adjacent subsections (the gap is just one blank line between them).

```markdown
preceding paragraph.

## Section

First line of the section.

### Subsection

Content.

### Next subsection

…
```

Common renderers will *sometimes* parse `## Heading` without the surrounding blanks, but the result is fragile — list items, inline HTML, and `<details>` blocks all break the heuristic. Always include the blanks.

<a id="standard-11"></a>

### 11. Never hard-wrap prose — let it reflow

Write each paragraph, list item and table cell as one physical line; never break a line to fit a width. Hard wraps churn unrelated lines in diffs and fight the renderer, which reflows anyway. Break only where the grammar requires: between paragraphs, list items and table rows, and inside code blocks.

---

## Environment

<a id="standard-3"></a>

### 3. PowerShell, not bash, for scripts and commands

Windows-native environment. Shell scripts in the repo are `.ps1`. Command examples in documentation use PowerShell syntax. Node/.mjs scripts are shell-agnostic and unaffected.
