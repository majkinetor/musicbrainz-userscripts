# Script usage metrics

Counts the MusicBrainz edits made with **this repo's userscripts** and builds a
standalone, interactive HTML dashboard.

Every script stamps its MB edit notes with a header like

```
Apollo Editor v2026.6.22 by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
```

so an edit is attributed to a script by searching MB's edit notes for the unique
substring `userscripts/<slug>` (MB field `edit_note_content`, operator
`includes`). The editor who made each edit is captured too — that's the
"individual MB users" list, i.e. **who is actually using the scripts**, not just
the author.

## Setup (once)

```
cd dev/script-metrics
npm install
npm run login        # opens a browser — log in to MusicBrainz
```

The edit-search results are only served to a logged-in session, so the collector
drives a logged-in browser. It reuses the repo's shared `.pw-profile/`, so if the
userscript test harnesses are already logged in you can skip `npm run login`.

## Run

```
npm run collect
```

- **Incremental by default.** It stores a snapshot (`script-usage.json`) of every
  edit ever seen plus the newest edit time per script, and on each run only asks
  MB for `[newest-we-have − few days … now]`, then appends. Day-to-day that's a
  couple of page fetches.
- **First run backfills** from a cutoff (`--since`, default ~2 months ago). MB
  caps any single edit search at 500 results and times out on wide date ranges,
  so the collector uses **keyset pagination** — `open_time < UPPER` ordered
  newest-first, 500 at a time, moving `UPPER` to the oldest edit it got — which
  stays fast at any depth and self-terminates at each script's earliest edit
  (so the cutoff is really just a floor). It checkpoints after each script.

Both outputs are rewritten in place each run (each is fully self-contained):

| File | What |
|------|------|
| `script-usage.json` | the full dataset + per-script cursors (the snapshot) |
| `script-usage.html` | the standalone dashboard (open it directly in a browser) |

### Options

| Flag | Effect |
|------|--------|
| `--full` | ignore cursors and re-scan every script from the cutoff |
| `--since YYYY-MM-DD` | first-run cutoff (or with `--full`) |
| `--script <slug>` | limit to one script (e.g. `apollo_editor`) |
| `--overlap <days>` | re-scan window to refresh recent statuses (default 3) |
| `--dump` | also save the raw HTML of each page-1 (debugging) |

## Dashboard

Open `script-usage.html` in any browser — no server, no network. It computes
everything client-side from the embedded data, so the filters are instant:

- **Cards:** total edits, distinct MB users, accepted / rejected / open, active scripts.
- **Edits over time:** stacked bars per month or per day, by script (hover for a breakdown).
- **Per script:** edits, distinct users, accepted vs rejected vs open, first/last seen.
- **Individual MB users:** every editor who used a script, with counts, which
  scripts they used, and last-active date — sortable, linked to their MB profile.
- **Edit types, outcomes/status, and script versions in the wild.**
- Toggle **exclude `majkinetor`** to see adoption by *other* editors only.

## Notes / limitations

- Attribution is by edit-note content, so an edit only counts once its note is
  present (all these scripts write one). Manual edits without the note aren't
  counted (correct).
- Vote tallies are captured when MB shows them; most script edits auto-apply, so
  the meaningful "ups/downs" signal is the **outcome** (accepted vs rejected/failed).
- Open edits that later change status are refreshed within the `--overlap` window
  on subsequent runs; older ones are not re-polled.
