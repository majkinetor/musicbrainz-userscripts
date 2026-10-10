# Working on this repo as an AI agent

Entry point for any AI assistant (Claude Code, a cloud agent, a subagent). It's the shared, version-controlled stand-in for an agent's private memory. It doesn't override [`STANDARDS.md`](STANDARDS.md) / [`DEVELOP.md`](DEVELOP.md) — those are authoritative; this routes to them and adds what they lack.

**Read [`dev/agents/AGENTS.general.md`](dev/agents/AGENTS.general.md) first, every session.** It holds the rules that apply on any project — authority, how much to do alone, GitHub work, testing, Playwright landmines — and they all apply here. This file adds only what is specific to userscripts and to this repo, and wins where the two differ.

## Read first

| Doc                                                                  | What                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`dev/agents/AGENTS.general.md`](dev/agents/AGENTS.general.md)       | agent rules for any project                                                 |
| [`dev/agents/STANDARDS.general.md`](dev/agents/STANDARDS.general.md) | numbered conventions for any project (issues, git, docs, markdown)          |
| [`README.md`](README.md)                                             | the scripts                                                                 |
| [`STANDARDS.md`](STANDARDS.md)                                       | this repo's standards and its details for the general ones                  |
| [`DEVELOP.md`](DEVELOP.md)                                           | branches/channels, checks, releasing, shared blocks, settings, bot identity |
| `userscripts/<name>/README.md` · `DEVELOP.md`                        | one script's user doc · its build/test and low-level facts                  |
| [`dev/test/README.md`](dev/test/README.md)                           | the Playwright runner                                                       |


## This repo

- **Bot identity**: before any GitHub write or commit from a local session, read [DEVELOP → Bot identity](DEVELOP.md#bot-identity).
- **Short names** (the maintainer's, in chat, issues and commits): **AS** Art Station · **BP** Bandcamp Player Enhanced · **CH** Credit Hoarder · **DC** Discogs Credits · **FC** First Contact · **GT** Group Therapy · **IS** ISRC Scout · **MC** Mission Control · **MM** Mammoth · **PC** Platform Check · **ST** String Theory. Apollo Editor, Falcon, Fusion and Scribe go by their names (Apollo for the first).
- **Notifications** arrive via `notif-channel` (`dev/notif-channel`); treat them per the general rules.
- **Confirm first** a **new MusicBrainz request inside a shipped userscript** (server load). Your own research/test reads of MusicBrainz are fine.
- **test.musicbrainz.org is yours to change without asking** (maintainer): edits, ISRCs, registering OAuth apps, account settings, whatever a test or a fix needs. Production stays read-only.
- **Tests run on `test.musicbrainz.org`**; before writing or running one, read [`dev/test/README.md`](dev/test/README.md). The sandbox login is a **separate account DB** (test.metabrainz.org SSO), not prod credentials. The harness is **Chromium-only**.
- **Sandbox MB login**: `majkinetor` / `mb`. test.musicbrainz.org's *Log in* redirects to the test.metabrainz.org SSO page; enter it there. Logged out, test redirects *every* page (edit pages too) to that login.
- **Test edit IDs are test's own**, not copies of production: the same `/edit/<n>` is a different edit on each server. Read a test edit logged in on test, never by looking the number up on prod.
- **OAuth on test** is a separate app registry ([#683](https://github.com/majkinetor/musicbrainz-userscripts/issues/683)): ISRC Scout carries a second app, registered on test under the sandbox account (`OAUTH_APPS` in the script), and keeps test's tokens apart from production's. An app test doesn't know answers `/oauth2/authorize` with **401 + `WWW-Authenticate: Basic`** (Chrome shows its password box; it wants client credentials, no login works) and `/oauth2/token` with `invalid_client`. If test loses the app, re-register it on test's *Applications* page (Installed application, `submit_isrc`) and update the ID/secret.
- **"Verification failed. Please try again."** instead of a test page is the sandbox throttling a burst of page loads, not a script failure; it clears on its own, so rerun. So does the proxy's "upstream request failed".
- **Before changing a script's code**, read [DEVELOP → Branches and channels](DEVELOP.md#branches-and-channels) (incl. `@version`) and [DEVELOP → Conventions](DEVELOP.md#conventions) (shared blocks, tokens, settings).

## Userscripts

- **Before sharing an install link**, read [Standard 10](STANDARDS.md#standard-10).
- **Report finished work on its issue, not only in chat** (cloud agents included): when work on an issue is pushed, comment on that issue with a few lines on what changed and the install links, made with [`dev/install-links`](dev/install-links/README.md) and checked after posting with its `--check` ([Standard 10](STANDARDS.md#standard-10)). That comment is the handoff: open no PR, and don't wait for the maintainer to test; move on to the next task. He confirms on the issue, and then the work is merged.
  - **No pinned (commit) links** (maintainer): only releases pin, and the release script does it. A cloud session's proxy also wraps some pinned `github.com/<repo>/raw/<sha>/…` links in backticks on every post (Mission Control's, on 2026-10-10), which breaks them.
  - End the comment with the footer `<sub>Claude Opus 5.5 · effort: <label> (<value>)</sub>`. Use the model actually running and the effort value of the current message. The label comes from the value: 5 is low, 10 medium, 15 high, 40 extra, max is max; any other value goes in alone. Never take it from `$CLAUDE_EFFORT`. The footer goes on every GitHub post: comments, issue bodies, PR bodies.
- **Give a String Theory link too for a bundled script** (maintainer): when the changed script is a String Theory member (listed in [`members.txt`](userscripts/string_theory/members.txt)), include String Theory's link, on the same branch; the maintainer runs the bundle. Scribe, Bandcamp Player Enhanced and the other unbundled scripts get their own link only.
- **Docs**: any change to a script's README or DEVELOP.md follows the [`docs` skill](.claude/skills/docs/SKILL.md).
- **No README while a script's design is still forming.** A new script in its design or scaffolding phase gets no README (not its own, and no entry in the root list), because the design changes too much. Write it once majkinetor settles the design. This is the one exception to "document every feature".
- `node --check` plus a real-browser load before sharing an install link.
- **Never rename a script's `@name`** casually: a manager identifies a script by `@namespace` + `@name`, so installing a renamed script from a link makes a *second* copy beside the old one. Copies don't share GM storage, and `mbuClaim` picks the running copy per site, so a cross-site GM handoff (Falcon's Harmony token) can land in the wrong copy. Whether an *auto-update* that brings a new `@name` replaces the script in place is untested (likely in Violentmonkey, unknown in Tampermonkey).
- **No `@updateURL` / `@downloadURL`, on purpose**: without them a manager checks the URL the script was installed from, which is what makes the channels work — a `stable` link follows releases, a `main` link follows latest, a branch link follows its branch, and a release's commit-pinned link stays frozen ([Standard 10](STANDARDS.md#standard-10)). A fixed `@updateURL` would send every install to that one URL: pinned links would start updating, and `main` installs would stall on (then drop to) stable. It wouldn't help renames either — updates already come from a fixed URL; the second copy comes from a manual install.

## MusicBrainz facts that bite

Per-script low-level detail → that script's `DEVELOP.md`. Cross-cutting:

- **`/release/<mbid>/edit` is a Knockout app**: it ignores seeded params (except URLs), binds late and wipes early DOM writes, and submits via `/ws/js/edit/create`.
- **In-session new entities have a negative `id`, no `gid`, a null fiber** — read selection from `state.selectedWorks` / `selectedRecordings`, dedup by id-or-gid.
- **A track `artistCredit` needs the full fetched artist** (`/ws/js/entity/<gid>`, which has `id`); lean/stub artists and `MB.entity(gid, name)` get dropped on re-derive.
- **A relationship's specific instrument is in its *attributes*** (the link-type name is the generic "instrument") — resolve via `linkedEntities.link_attribute_type[typeID].name`.
- **A release page renders two `ul.external_links`** (the release's and the release group's) — scope by the nearest heading or you misattribute RG links.
- **ws/2 artist search doesn't rank exact name/alias holders first** for short names — trust "exactly one exact holder" only when the count ≤ what you fetched.
- **Theming**: MB's stylesheet is cross-origin (invisible to `document.styleSheets`) and ships zero-specificity `input{background:#fff}` that loses to anything; render CSS, don't reason about it; JS-set and SVG-attribute colours evade CSS sweeps.
- Per-track **credit-source** APIs (Tidal / Qobuz / YouTube Music / …) are in [Credit Hoarder's DEVELOP.md](userscripts/credit_hoarder/DEVELOP.md#source-apis).
