#!/usr/bin/env python3
"""Self-test: run the whole pipeline against a synthetic dump.

The real dump is 15 GB and a full run takes tens of minutes, which is far too
slow a feedback loop to develop against and far too slow to use as a check. So
this builds a tiny tarball with the *same* structure the real one has — same
member names, same order, same Postgres COPY text format, including the
escaping and `\\N` nulls — and asserts on the numbers that come out the end.

    python tools/selftest.py

It exercises the parts most likely to break silently:

  - member ordering (edit before edit_note, so two passes are required)
  - COPY escaping: a note containing tabs and newlines must stay one row
  - multi-script attribution: one note carrying two scripts' signatures
  - a note on an edit made by a *different* editor than the note's author
  - a note whose edit row is missing entirely (deleted edit)
  - version parsing, including a script configured with no version
"""
from __future__ import annotations

import bz2
import io
import json
import sqlite3
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'src'))

import extract  # noqa: E402
import load  # noqa: E402
import report  # noqa: E402

APOLLO = 'Apollo Editor v2026.6.22 by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md'
HOARDER = 'Credit Hoarder v2026.7.1 by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md'
HARMONY = 'Imported with Harmony (https://harmony.pulsewidth.org.uk/release/actions?release_mbid=abc), using data from:'


def copy_escape(value: str) -> str:
    """Mirror Postgres COPY text output: escape backslash, tab, newline, CR."""
    return (value.replace('\\', '\\\\')
                 .replace('\t', '\\t')
                 .replace('\n', '\\n')
                 .replace('\r', '\\r'))


def row(*fields) -> bytes:
    out = []
    for field in fields:
        out.append('\\N' if field is None else copy_escape(str(field)))
    return ('\t'.join(out) + '\n').encode('utf8')


def build_fixture(path: Path) -> None:
    """Write a dump tarball whose members mirror the real EDIT_TABLE_LIST order."""
    OPEN = '2026-03-04 10:00:00+00'
    members: dict[str, bytes] = {}

    # edit: id, editor, type, status, autoedit, open, close, expire, language, quality
    members['mbdump/edit'] = b''.join([
        row(1001, 501, 90, 2, 1, OPEN, OPEN, OPEN, None, 1),        # apollo, applied
        row(1002, 502, 90, 1, 0, OPEN, None, OPEN, None, 1),        # apollo, open
        row(1003, 502, 33, 3, 0, OPEN, OPEN, OPEN, None, 1),        # hoarder, failed
        # Note author (503) deliberately differs from the edit author (777):
        # anyone can comment on someone else's edit, and the person who ran the
        # script is the one who wrote the note.
        row(1004, 777, 90, 2, 1, '2026-01-09 08:00:00+00', OPEN, OPEN, None, 1),
        row(9999, 999, 90, 2, 1, OPEN, OPEN, OPEN, None, 1),        # unrelated edit
    ])
    members['mbdump/edit_area'] = b''
    members['mbdump/edit_artist'] = row(1001, 7001, 2)
    # The giant member the pipeline must skip without parsing.
    members['mbdump/edit_data'] = row(1001, '{"big":"payload"}')
    members['mbdump/edit_event'] = b''
    members['mbdump/edit_instrument'] = b''
    members['mbdump/edit_label'] = b''

    # edit_note: id, editor, edit, text, post_time
    tricky = APOLLO + '\n\nRelease URL: https://musicbrainz.org/release/x\nOptions:\tApply to tracks'
    members['mbdump/edit_note'] = b''.join([
        row(1, 501, 1001, tricky, OPEN),                       # tabs + newlines inside
        row(2, 502, 1002, APOLLO, OPEN),
        row(3, 502, 1003, HOARDER, OPEN),
        row(4, 503, 1004, HARMONY + '\n\n' + HOARDER, OPEN),   # two scripts, one note
        row(5, 504, 9999, 'a manual note with no script signature', OPEN),
        row(6, 505, 7777, APOLLO, OPEN),                       # edit row does not exist
    ])
    members['mbdump/edit_note_recipient'] = b''
    members['mbdump/edit_place'] = b''
    members['mbdump/edit_recording'] = b''
    members['mbdump/edit_release'] = row(1001, 4001) + row(1004, 4002)
    members['mbdump/edit_release_group'] = b''
    members['mbdump/edit_series'] = b''
    members['mbdump/edit_url'] = b''
    members['mbdump/edit_work'] = b''
    # vote: id, editor, edit, vote, vote_time, superseded
    members['mbdump/vote'] = row(1, 601, 1003, 0, OPEN, 'f')

    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w') as archive:
        for name, payload in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
    path.write_bytes(bz2.compress(raw.getvalue()))


def build_editor_fixture(path: Path) -> None:
    payload = b''.join([
        row(501, 'majkinetor', 0),
        row(502, 'alice', 0),
        row(503, 'bob', 0),
        row(999, 'someone_else', 0),
    ])
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w') as archive:
        info = tarfile.TarInfo('mbdump/editor_sanitized')
        info.size = len(payload)
        archive.addfile(info, io.BytesIO(payload))
    path.write_bytes(bz2.compress(raw.getvalue()))


FAILURES: list[str] = []


def check(label: str, actual, expected) -> None:
    if actual == expected:
        print(f'  ok    {label}: {actual}')
    else:
        print(f'  FAIL  {label}: got {actual!r}, expected {expected!r}')
        FAILURES.append(label)


def main() -> int:
    config = json.loads((ROOT / 'config' / 'sources.json').read_text(encoding='utf8'))
    scripts = config['scripts']

    # ignore_cleanup_errors: on Windows SQLite keeps a handle on the WAL files
    # a moment longer than the close() call, and a failed rmtree must not mask
    # a genuine test result.
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        tmpdir = Path(tmp)
        edit_dump = tmpdir / 'mbdump-edit.tar.bz2'
        editor_dump = tmpdir / 'mbdump-editor.tar.bz2'
        build_fixture(edit_dump)
        build_editor_fixture(editor_dump)

        connection = load.open_db(tmpdir / 'metrics.db', ROOT / 'sql' / 'schema.sql')
        load.sync_scripts(connection, scripts)
        load.sync_enums(connection)

        matcher = extract.ScriptMatcher(scripts)
        versions = extract.compile_version_regexes(scripts, config['default_version_regex'])

        edit_ids, editor_ids, note_count = load.insert_notes(
            connection, extract.iter_notes(edit_dump, matcher, versions))
        counts = load.insert_edit_rows(
            connection, extract.iter_edit_rows(edit_dump, edit_ids))
        edit_editors = {r[0] for r in connection.execute('SELECT DISTINCT editor FROM edit')}
        load.insert_editors(connection, extract.iter_editors(editor_dump, editor_ids | edit_editors))
        load.backfill_missing_editors(connection)
        load.record_run(connection, 'selftest', note_count, counts['edit'], len(editor_ids), 0.0)

        print('\nAssertions:')
        check('matched notes', note_count, 5)
        check('distinct edit ids from notes', len(edit_ids), 5)
        check('edit rows kept (note 6 points at a deleted edit)', counts['edit'], 4)
        check('unrelated edit 9999 excluded',
              connection.execute('SELECT COUNT(*) FROM edit WHERE id = 9999').fetchone()[0], 0)
        check('votes kept', counts['vote'], 1)
        check('entity links kept', counts['entity'], 3)

        # COPY escaping: the tab/newline note must survive as one row, decoded.
        text = connection.execute('SELECT text FROM note WHERE id = 1').fetchone()[0]
        check('escaped note is one row', text.count('\n'), 3)
        check('escaped tab decoded', '\t' in text, True)

        check('note 4 attributed to two scripts',
              connection.execute('SELECT COUNT(*) FROM note_script WHERE note = 4').fetchone()[0], 2)
        check('apollo version parsed',
              connection.execute("SELECT version FROM note_script WHERE note = 2").fetchone()[0],
              '2026.6.22')
        check('harmony has no version',
              connection.execute("SELECT version FROM note_script WHERE note = 4 AND script = 'harmony'").fetchone()[0],
              None)
        check('note without signature ignored',
              connection.execute('SELECT COUNT(*) FROM note WHERE id = 5').fetchone()[0], 0)
        check('note on deleted edit still stored',
              connection.execute('SELECT COUNT(*) FROM note WHERE id = 6').fetchone()[0], 1)

        # v_script_edit is one row per (script, edit), attributed to the note author.
        check('apollo edits via view',
              connection.execute("SELECT COUNT(*) FROM v_script_edit WHERE script_id = 'apollo_editor'").fetchone()[0], 3)
        check('script_user is the note author, not the edit author',
              connection.execute('SELECT DISTINCT script_user, edit_editor FROM v_script_edit '
                                 'WHERE edit_id = 1004').fetchone(),
              (503, 777))
        check('editor names resolved',
              connection.execute('SELECT name FROM editor WHERE id = 502').fetchone()[0], 'alice')

        out_dir = tmpdir / 'out'
        out_dir.mkdir()
        report.render(connection, out_dir, config)
        payload = json.loads((out_dir / 'metrics.json').read_text(encoding='utf8'))
        check('report counts attributed edits', payload['quality']['total_attributed_edits'], 5)
        check('report flags the orphan note', payload['quality']['notes_without_edit_row'], 1)
        check('dashboard has data injected',
              '/*__DATA__*/null' not in (out_dir / 'dashboard.html').read_text(encoding='utf8'), True)
        check('markdown produced', (out_dir / 'METRICS.md').stat().st_size > 200, True)
        connection.close()

    print()
    if FAILURES:
        print(f'{len(FAILURES)} FAILED: {", ".join(FAILURES)}')
        return 1
    print('all checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
