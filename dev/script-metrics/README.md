# Script metrics

Counts the MusicBrainz edits made with this repo's userscripts, straight from
the **MusicBrainz database snapshot**, and builds a dashboard from it.

Everything runs in Docker. The host needs nothing but Docker itself — no
Postgres, no Python packages, no MusicBrainz account, no browser.

```powershell
.\run.ps1                  # full run against the latest dump
.\run.ps1 -ReportOnly      # re-render the reports from the existing database
.\run.ps1 -Clean           # drop the cached dump (frees ~15 GB)
```

```bash
./run.sh                   # same, on a POSIX shell
```

Outputs land in `out/`:

| File | What | Committed |
|------|------|-----------|
| `dashboard.html` | standalone interactive dashboard — open it directly, no server, no network | yes |
| `METRICS.md` | static summary, readable on GitHub | yes |
| `metrics.json` | the aggregated cubes the dashboard reads | yes |

The SQLite store itself stays in the Docker volume beside the dump cache, not in
`out/`. On Docker Desktop `out/` is the Windows filesystem, and a multi-gigabyte
SQLite file there makes the load I/O-bound on the slowest thing available — the
first real run spent longer writing the database than it did downloading 15 GB.
Only the small reports cross back to the host. To inspect it:

```powershell
docker compose run --rm --entrypoint sqlite3 metrics /data/metrics.db
```

## How an edit is attributed to a script

Every script in this repo stamps its MusicBrainz edit notes with a header:

```
Apollo Editor v2026.6.22 by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
```

so `userscripts/<slug>` is a unique, stable discriminator — it appears in every
note that script writes and never collides between scripts. Attribution is
nothing more than searching edit-note text for the patterns in
[`config/sources.json`](config/sources.json).

Two consequences worth knowing:

- **The note author, not the edit author, is the script user.** Anyone can
  comment on someone else's edit, so those differ. The person who wrote the note
  is the one who ran the script, and that is who "distinct editors" counts.
- **One edit can count for two scripts.** Our scripts deliberately preserve a
  previous script's note when they append to theirs, so a note can legitimately
  carry both a Harmony signature and a Credit Hoarder one. Both are recorded.

Adding a script — including third-party ones like Harmony or ECAU, which are
configured here for comparison — is a config entry, not code.

## How it works

### Where the data comes from

MetaBrainz publishes `mbdump-edit.tar.bz2` in every full export, containing the
tables the website's edit history is built from:

```
edit  edit_area  edit_artist  edit_data  edit_event  edit_instrument  edit_label
edit_note  edit_note_recipient  edit_place  edit_recording  edit_release
edit_release_group  edit_series  edit_url  edit_work  vote
```

plus `editor_sanitized` in `mbdump-editor.tar.bz2` for editor id → username.
Both are plain Postgres `COPY` output inside a tar: one row per line,
tab-separated, `\N` for null, backslashes escaping any tab or newline inside a
value.

### Why it is not just "import the database"

`mbdump-edit.tar.bz2` is ~15 GB compressed. `mbdump/edit` alone is 15.9 GiB
expanded, and `edit_data` — the full JSON body of every edit — is far larger
again. A straight import is a 200 GB+ proposition, for a result where
99.999% of the rows are edits nobody here made.

So the pipeline **streams and filters**, and only what survives reaches a
database. What survives is a few hundred thousand rows, which is why the store
is SQLite: window functions and CTEs both work, the whole thing is one
inspectable file, and there is no server lifecycle to babysit.

### The two passes

Tar is sequential, and the members arrive in an unhelpful order: `edit` comes
first, but we cannot know which edits matter until we have read `edit_note`,
which sits behind the enormous `edit_data`. Hence:

1. **Pass 1** reads `edit_note`, keeps the notes matching a configured pattern,
   then kills the decompressor — everything after `edit_note` is dead weight.
2. **Pass 2** reads `edit`, the `edit_<entity>` link tables and `vote`, keeping
   only rows for the edit ids pass 1 found.

`edit_data` is never parsed in either pass.

The dump is cached (a Docker named volume) and verified against the published
`SHA256SUMS`, so the two passes cost no extra network, and re-running on a day
when MetaBrainz has not rotated the dump costs no network at all.

> **Rows come out in Postgres heap order, not primary-key order.** The first row
> of `edit` in a real dump is id 38125306, not 1, because edits get rewritten
> when their status changes. So there is no early exit by id range, and anything
> assuming the dump is sorted will silently drop edits.

### Cost of a run

The download dominates: ~15 GB, published twice a week. Decompression happens
twice and is why the image ships `lbzip2` — unlike `pbzip2` it parallelises
decompression of *any* bzip2 stream, which on a multi-core machine is the
difference between minutes and most of an hour.

Re-running is safe and idempotent: every table is written with
`INSERT OR REPLACE`, so a newer dump updates rows in place (an edit that was
Open last week and Applied today simply changes status) while the `run` table
keeps one row per ingest for provenance.

### Why the whole note body is stored

Re-attributing a script, fixing a pattern, or parsing versions differently is
then a local SQL exercise instead of another 15 GB pass.

Full note bodies are kept for **our own** scripts only. The comparison scripts
matched 8.9 million notes on the first real run — millions of rows of somebody
else's text — so theirs are truncated to a 400-character prefix, which is still
enough to identify the note.

### What scale actually forced

The first real run is the reason several things look the way they do. It matched
**8,870,019 notes out of 103,065,908** scanned, essentially all of it ECAU and
Harmony, and produced a 7.6 GB database with a 7.7 GB write-ahead log.

- **Editor identity** is kept per-editor for our own scripts only. The
  comparison scripts' editors fold into two buckets flagged `tracked: false`, so
  no distinct-editor count can include them. Their volume and timeline are
  unaffected — that is what they are here for. The per-script table shows a dash
  rather than `0`, because `0` would read as "nobody uses it".
- **Entity links** are kept for our own scripts only. Keeping them for
  everything meant 37 million rows to serve one small per-entity-type
  breakdown.
- **The loader commits periodically.** SQLite cannot checkpoint the WAL while a
  write transaction is open, so loading nine million rows in one transaction
  grew the WAL to the size of the database itself.
- **`VACUUM` is opt-in** (`--vacuum`). It rewrites the whole file and wants as
  much free disk again, which is a bad default for a store that gets rebuilt on
  the next run.

## Layout

```
config/sources.json     which scripts, and the note patterns that identify them
src/mbdump.py           streaming bz2 + tar + COPY reader
src/fetch.py            download, resume, checksum-verify
src/extract.py          the two-pass filter
src/load.py             SQLite loading
src/report.py           cubes -> metrics.json / METRICS.md / dashboard.html
src/mbmeta.py           GENERATED enum lookups (edit type / status / vote names)
sql/schema.sql          the schema, and the two attribution views
templates/dashboard.html
tools/gen_mbmeta.py     regenerate mbmeta.py from MusicBrainz Constants.pm
tools/selftest.py       full pipeline against a synthetic dump
```

### Self-test

A real run takes tens of minutes, which is a useless feedback loop. `selftest.py`
builds a tiny tarball with the same structure as the real one — same member
names, same order, same COPY escaping — and asserts on what comes out:

```bash
python tools/selftest.py
```

It covers the things that break silently: member ordering, an edit note
containing tabs and newlines staying one row, a note carrying two scripts'
signatures, a note whose author differs from the edit's author, a note whose
edit row no longer exists, and version parsing.

### Edit type / status names

`edit.type` is a bare integer in the dump and the id → name mapping exists only
in the MusicBrainz server source. `tools/gen_mbmeta.py` lifts it from
`Constants.pm`; the result is committed so the container never needs it at
runtime. Re-run it after a MusicBrainz schema change adds edit types.

## Prior art

The first version of this directory counted the same thing by driving a
logged-in browser against MusicBrainz's edit search with Playwright, paginating
`edit_note_content` searches per script. It worked, but it was awkward in ways
the snapshot approach simply does not have: it needed a logged-in MusicBrainz
session, MB caps any edit search at 500 results and times out on wide date
ranges (so it needed keyset pagination and per-script cursors), incremental
state had to be reconciled by hand, and it could only ever see what the search
UI exposes. It was replaced wholesale by this in
[#570](https://github.com/majkinetor/musicbrainz-userscripts/issues/570).

## Limitations

- An edit only counts once its note is present. Manual edits without a script
  note are not counted, which is correct.
- Notes on edits that were later deleted have no `edit` row; they are stored and
  reported as a data-quality number rather than silently dropped.
- Harmony's note carries no version, so version stats stay empty for it. ECAU's
  footer uses the shared `ROpdebee/mb-userscripts` namespace, so that pattern
  also catches ROpdebee's other userscripts — the stored note text is what lets
  those be split apart later without a re-run.
- The dashboard's "exclude the author" toggle filters on the MusicBrainz
  username in `config/sources.json` (`owner_mb_username`).
