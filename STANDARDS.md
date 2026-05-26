# Standards

Reusable conventions for this repository (and similar future work). Each entry has a short title and a 1–3 sentence description with an example when useful.

New standards arrive when the maintainer prefixes a chat message with `standard: ...`. Add them here at that moment, numbered consecutively; existing numbers never get reused.

For project-specific decisions (e.g. "MB's `[no artist]` MBID is `eec63d3c-…`"), use the per-project `dev/DECISIONS.md` log, not this file.

Each numbered section also carries a stable short anchor (`#standard-1` … `#standard-9`) so links like `STANDARDS.md#standard-9` keep working even when the section title is reworded.

---

<a id="standard-1"></a>

## 1. Issue titles read as changelog entries

Issue titles describe the user-visible symptom (for bugs) or the feature name (for enhancements). They become **changelog lines verbatim** — when cutting a release, copy the issue title across as the bullet text, untouched. The `bug` / `enhancement` label decides which section the bullet lands under (Fixes / Features respectively).

Format per bullet:

```markdown
1. <issue title verbatim> ([#N](https://github.com/<org>/<repo>/issues/N))
```

Rules for the title itself (so the verbatim copy reads well):

- No leading verb (`Fix`, `Add`, `Persist`, `Refactor`, …).
- No internal implementation details — no line numbers, exact counts, internal variable names, file paths.
- Describe what the user observes (for bugs) or what the feature is (for enhancements), not how it's implemented.

| Bad                                                                       | Good                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Fix 51 instruments silently dropped due to duplicate keys in INSTRUMENTS  | Some instruments silently dropped due to duplicate keys in the map |
| Persist entity-resolution cache incrementally instead of only on confirm  | Incremental cache persistence                              |

If the title doesn't read well in the changelog, **fix the title first** (then update the changelog from the new title) — don't paraphrase in the changelog. The single source of truth is the issue tracker.

<a id="standard-2"></a>

## 2. `bug` vs `enhancement` labels are meaningful

- `bug` — something is broken; the user sees incorrect behaviour.
- `enhancement` — a new feature, refactor, or improvement that wasn't broken before.

If an issue filed as a bug turns out to be an enhancement after investigation, relabel.

<a id="standard-3"></a>

## 3. PowerShell, not bash, for scripts and commands

Windows-native environment. Shell scripts in the repo are `.ps1`. Command examples in documentation use PowerShell syntax. Node/.mjs scripts are shell-agnostic and unaffected.

<a id="standard-4"></a>

## 4. Per-project `dev/DECISIONS.md` log

Each project keeps an append-only one-line-per-entry decision log at `dev/DECISIONS.md`:

```
- YYYY-MM-DD HH:MM — topic → decision. (short rationale)
```

Newest entries at the bottom. Grep-friendly. Future contributors (human or AI) read this to understand *why* the code looks the way it does without diffing every commit.

<a id="standard-5"></a>

## 5. Markdown table alignment

Column-align tables by padding cells with spaces so columns line up. Fall back to **compact** form (`| cell | cell |` with a minimal `| --- | --- |` separator) when any row's cumulative cell content exceeds **200 characters** — past that, alignment makes the line so long it hurts readability more than it helps.

A small enforcer lives at `userscripts/discogs_credits/dev/align-md-tables.mjs` (generic, takes any markdown files as args).

<a id="standard-6"></a>

## 6. Markdown — hard line breaks for stacked metadata

When several consecutive `**Key:** value` lines should render as separate lines (e.g. start time / command / fixtures / finished / result), append two trailing spaces to each — without them GitHub's renderer collapses them into a single paragraph.

<a id="standard-7"></a>

## 7. AI-driven git work uses a dedicated bot identity

Commits, branches, Issues, PRs, and Discussions created by an AI assistant go through a separate GitHub account, never via the maintainer's authenticated session. The bot's PAT lives in a gitignored local credentials file (see the per-project DEVELOP.md for path conventions). Push-with-token URLs are one-shot — never `git push -u` the URL form, which would write the token into `.git/config`.

**This applies to `gh` CLI calls too.** The local `gh` is logged in as the maintainer (for human use); every `gh` write (`gh pr create`, `gh issue comment`, `gh pr close`, …) made by the AI assistant **must** explicitly override the auth with the bot's PAT:

```powershell
$env:GH_TOKEN = (Get-Content userscripts/discogs_credits/dev/.github-credentials.json | ConvertFrom-Json).token
gh pr create --title …      # now authenticated as the bot
```

Plain `gh pr create` / `gh issue comment` without `GH_TOKEN` set will silently post under the maintainer's name — a Standard #7 violation that's only visible after the fact in the comment's author field.

Keeps human and bot activity clearly attributable in commit / PR authors, makes a token-rotation easy (only the bot's PAT, never the maintainer's session), and means a bot-misstep is easily revertable.

<a id="standard-8"></a>

## 8. Markdown headers — blank line before and after, always

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

<a id="standard-9"></a>

## 9. Link every referenced entity to the closest anchor

When referencing docs, code artifacts, or external entities in chat or on GitHub, **always provide a link** — and aim for the most specific anchor available, not the project's front page. The reader should be able to click straight to the thing being discussed without doing their own search.

Apply to:

- **Project docs in this repo** — link with a relative path *and a header anchor* when the relevant section is known. Example: `[ANALYSIS#auto-match](userscripts/discogs_credits/dev/ANALYSIS.md#auto-match)` rather than the bare word `ANALYSIS`.
- **MusicBrainz entities** — link to the entity page using the MBID, e.g. `[SST GmbH](https://musicbrainz.org/place/0c5c44bc-2d8d-4c72-b007-fbc752dfe8dc)` rather than just `SST GmbH (0c5c44bc-…)`.
- **Discogs entities** — link to the entity page using the Discogs ID, e.g. `[SST GmbH](https://www.discogs.com/label/3987)` rather than the bare ID.
- **Issues, PRs, commits** — use `#N` (GitHub auto-links inside the repo) or full URLs when posting elsewhere.

**Make documents anchorable.** When you need to reference a doc section that has no good link target, *fix the doc first*: add a header (preferred — it shows in the GitHub TOC), or drop an explicit anchor where a header would feel out of place:

```markdown
<a id="auto-match-disagreement"></a>

A paragraph that other commits / PRs / chat messages can now link
to via `…/ANALYSIS.md#auto-match-disagreement`.
```

Both header anchors (`## My Section` → `#my-section`) and explicit `<a id="…"></a>` work on GitHub. Prefer headers; use explicit anchors only when no header fits.

**Don't hard-wrap the prose** in long-form markdown blocks like this one — let the renderer reflow naturally. Hard wraps look like manual line breaks in raw view and are a maintenance burden when the text edits in place. (Code blocks, tables, and lists still wrap where the grammar requires.)

The goal is *zero-friction verification*: every claim that names a thing carries its own evidence trail.
