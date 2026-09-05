"""End-to-end run: fetch the dump, filter it, load SQLite, render the reports.

    python src/pipeline.py                 # full run against the latest dump
    python src/pipeline.py --report-only   # re-render from the existing database
    python src/pipeline.py --dump-id 20260905-002519   # pin a specific snapshot

Normally driven through Docker; see run.ps1 / run.sh.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import extract  # noqa: E402
import fetch  # noqa: E402
import load  # noqa: E402
import report  # noqa: E402

ROOT = HERE.parent


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', default='/data', help='dump cache (big, disposable)')
    parser.add_argument('--out', default=str(ROOT / 'out'), help='where reports and the database go')
    parser.add_argument('--config', default=str(ROOT / 'config' / 'sources.json'))
    parser.add_argument('--dump-id', default=None, help='pin a dump instead of LATEST')
    parser.add_argument('--report-only', action='store_true',
                        help='skip ingest, re-render from the existing database')
    parser.add_argument('--db', default=None,
                        help='database path (default <data-dir>/metrics.db)')
    parser.add_argument('--vacuum', action='store_true',
                        help='VACUUM after ingest; rewrites the whole file, needs as much disk again')
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    # The database lives beside the dump cache, not in the bind-mounted output
    # directory. On Docker Desktop that output directory is the Windows
    # filesystem, and putting a multi-gigabyte SQLite file there makes the load
    # I/O-bound on the slowest thing available. Only the small reports cross over.
    database = Path(args.db) if args.db else Path(args.data_dir) / 'metrics.db'

    config = json.loads(Path(args.config).read_text(encoding='utf8'))
    scripts = config['scripts']

    connection = load.open_db(database, ROOT / 'sql' / 'schema.sql')
    load.sync_scripts(connection, scripts)
    load.sync_enums(connection)

    if not args.report_only:
        started = time.time()
        meta = fetch.ensure_dumps(Path(args.data_dir), args.dump_id)

        matcher = extract.ScriptMatcher(scripts)
        versions = extract.compile_version_regexes(scripts, config['default_version_regex'])

        owned_scripts = {s['id'] for s in scripts if s.get('owner') == report.OWNED}
        edit_ids, note_editor_ids, note_count = load.insert_notes(
            connection, extract.iter_notes(Path(meta['edit_dump']), matcher, versions),
            owned_scripts)

        if not edit_ids:
            print('No edit notes matched any configured pattern — nothing to load.', file=sys.stderr)
            return 1

        # Entity links are only kept for our own scripts; see iter_edit_rows.
        owned_edit_ids = {
            row[0] for row in connection.execute(
                'SELECT DISTINCT n.edit FROM note n '
                'JOIN note_script ns ON ns.note = n.id '
                'JOIN script s ON s.id = ns.script WHERE s.owner = ?', (report.OWNED,))
        }
        counts = load.insert_edit_rows(
            connection,
            extract.iter_edit_rows(Path(meta['edit_dump']), edit_ids, owned_edit_ids))

        # Editors we need names for: whoever wrote a matching note, plus whoever
        # made the edit (not always the same person).
        edit_editor_ids = {
            row[0] for row in connection.execute('SELECT DISTINCT editor FROM edit')
        }
        wanted_editors = note_editor_ids | edit_editor_ids
        resolved = load.insert_editors(
            connection, extract.iter_editors(Path(meta['editor_dump']), wanted_editors))
        load.backfill_missing_editors(connection)

        duration = time.time() - started
        load.record_run(connection, meta['dump_id'], note_count,
                        counts['edit'], resolved, duration)
        load.optimise(connection, vacuum=args.vacuum)
        print(f'Ingest finished in {duration / 60:.1f} min', file=sys.stderr)

    report.render(connection, out_dir, config)
    connection.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
