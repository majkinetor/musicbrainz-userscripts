# Issue label

Labels a new issue by the scripts its title names, so an issue opened from String Theory's command palette (*New issue: Platform Check*, titled `Platform Check: …`) lands with its area label.

[`.github/workflows/issue-label.yml`](../../.github/workflows/issue-label.yml) runs it on every opened issue.

## What it does

- **Every script named in the title** adds its `area | <script>` label: its name, in any case, with spaces, `_` or `-` (`Platform Check`, `platform_check`), or the maintainer's short name in capitals (`PC`, `IS`, `Apollo`; the list is in [`AGENTS.md`](../../AGENTS.md)). `String Theory` or `ST` adds `general`.
- **Only labels the repo has** are applied, so a new script needs its `area | …` label first; a short name for it goes in `ALIASES`.
- **A leading prefix of script names** (`Platform Check: `, `Apollo, PC: `) is taken off the title once it is a label, since titles carry no script name ([Standard 1](../agents/STANDARDS.general.md#standard-1)). A name anywhere else in the title stays.

## Running it

In the workflow it reads the issue from `GITHUB_EVENT_PATH` and writes with `GITHUB_TOKEN`. To see what a title would get, from the repo root:

```sh
node -e "import('./dev/issue-label/issue-label.mjs').then(m => console.log(m.classify('PC: links missing', ['area | platform check', 'general'])))"
```
