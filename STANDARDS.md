# Standards

Reusable conventions for this repository (and similar future work). Each
entry has a short title and a 1–3 sentence description with an example
when useful.

New standards arrive when the maintainer prefixes a chat message with
`standard: ...`. Add them here at that moment, numbered consecutively;
existing numbers never get reused.

For project-specific decisions (e.g. "MB's `[no artist]` MBID is
`eec63d3c-…`"), use the per-project `dev/DECISIONS.md` log, not this file.

---

## 1. Issue titles read as changelog entries

Issue titles describe the user-visible symptom (for bugs) or the feature
name (for enhancements). They become changelog lines verbatim, with
`Fixed: ` / `Added: ` prefixed from the label.

Rules:
- No leading verb (`Fix`, `Add`, `Persist`, `Refactor`, …).
- No internal implementation details — no line numbers, exact counts,
  internal variable names, file paths.
- Describe what the user observes (for bugs) or what the feature is (for
  enhancements), not how it's implemented.

| Bad                                                                       | Good                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Fix 51 instruments silently dropped due to duplicate keys in INSTRUMENTS  | Some instruments silently dropped due to duplicate keys in the map |
| Persist entity-resolution cache incrementally instead of only on confirm  | Incremental cache persistence                              |

## 2. `bug` vs `enhancement` labels are meaningful

- `bug` — something is broken; the user sees incorrect behaviour.
- `enhancement` — a new feature, refactor, or improvement that wasn't
  broken before.

If an issue filed as a bug turns out to be an enhancement after
investigation, relabel.

## 3. PowerShell, not bash, for scripts and commands

Windows-native environment. Shell scripts in the repo are `.ps1`.
Command examples in documentation use PowerShell syntax. Node/.mjs
scripts are shell-agnostic and unaffected.

## 4. Per-project `dev/DECISIONS.md` log

Each project keeps an append-only one-line-per-entry decision log at
`dev/DECISIONS.md`:

```
- YYYY-MM-DD HH:MM — topic → decision. (short rationale)
```

Newest entries at the bottom. Grep-friendly. Future contributors (human
or AI) read this to understand *why* the code looks the way it does
without diffing every commit.

## 5. Markdown table alignment

Column-align tables by padding cells with spaces so columns line up.
Fall back to **compact** form (`| cell | cell |` with a minimal
`| --- | --- |` separator) when any row's cumulative cell content
exceeds **200 characters** — past that, alignment makes the line so long
it hurts readability more than it helps.

A small enforcer lives at `userscripts/discogs_credits/dev/align-md-tables.mjs`
(generic, takes any markdown files as args).

## 6. Markdown — hard line breaks for stacked metadata

When several consecutive `**Key:** value` lines should render as separate
lines (e.g. start time / command / fixtures / finished / result), append
two trailing spaces to each — without them GitHub's renderer collapses
them into a single paragraph.

## 7. AI-driven git work uses a dedicated bot identity

Commits, branches, Issues, PRs, and Discussions created by an AI
assistant go through a separate GitHub account, never via the
maintainer's authenticated session. The bot's PAT lives in a gitignored
local credentials file (see the per-project DEVELOP.md for path
conventions). Push-with-token URLs are one-shot — never `git push -u`
the URL form, which would write the token into `.git/config`.

Keeps human and bot activity clearly attributable in commit / PR
authors, makes a token-rotation easy (only the bot's PAT, never the
maintainer's session), and means a bot-misstep is easily revertable.
