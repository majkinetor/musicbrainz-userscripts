"""Load the filtered dump rows into SQLite.

Everything is INSERT OR REPLACE, so a run over a newer dump updates in place:
an edit that was Open in last week's snapshot and Applied in today's simply
changes status, and no state has to be reconciled by hand.
"""
from __future__ import annotations

import sqlite3
import sys
from collections.abc import Iterable, Iterator
from datetime import datetime, timezone
from pathlib import Path

import mbmeta

BATCH = 10_000


def open_db(path: Path, schema: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    # This is a rebuildable derived store, so durability buys nothing and costs
    # a lot: the loader writes hundreds of thousands of rows per run.
    connection.execute('PRAGMA journal_mode = WAL')
    connection.execute('PRAGMA synchronous = OFF')
    connection.execute('PRAGMA temp_store = MEMORY')
    connection.executescript(schema.read_text(encoding='utf8'))
    return connection


def sync_scripts(connection: sqlite3.Connection, scripts: list[dict]) -> None:
    connection.executemany(
        'INSERT OR REPLACE INTO script (id, name, owner, note) VALUES (?, ?, ?, ?)',
        [(s['id'], s['name'], s.get('owner', 'external'), s.get('note')) for s in scripts],
    )
    connection.commit()


def sync_enums(connection: sqlite3.Connection) -> None:
    connection.executemany(
        'INSERT OR REPLACE INTO edit_type (id, constant, label, entity) VALUES (?, ?, ?, ?)',
        [(k, v[0], v[1], v[2]) for k, v in mbmeta.EDIT_TYPES.items()],
    )
    connection.executemany(
        'INSERT OR REPLACE INTO edit_status (id, constant, label) VALUES (?, ?, ?)',
        [(k, v[0], v[1]) for k, v in mbmeta.EDIT_STATUS.items()],
    )
    connection.executemany(
        'INSERT OR REPLACE INTO vote_type (id, constant, label) VALUES (?, ?, ?)',
        [(k, v[0], v[1]) for k, v in mbmeta.VOTES.items()],
    )
    connection.commit()


def insert_notes(connection: sqlite3.Connection, notes: Iterator) -> tuple[set[int], set[int], int]:
    """Consume pass 1. Returns `(edit_ids, editor_ids, note_count)`.

    The edit id set is what pass 2 filters on, so it has to be complete before
    the second pass starts — which is the whole reason this is two passes.
    """
    edit_ids: set[int] = set()
    editor_ids: set[int] = set()
    note_batch: list[tuple] = []
    link_batch: list[tuple] = []
    count = 0

    def flush() -> None:
        if note_batch:
            connection.executemany(
                'INSERT OR REPLACE INTO note (id, editor, edit, text, post_time) '
                'VALUES (?, ?, ?, ?, ?)', note_batch)
            note_batch.clear()
        if link_batch:
            connection.executemany(
                'INSERT OR REPLACE INTO note_script (note, script, pattern, version) '
                'VALUES (?, ?, ?, ?)', link_batch)
            link_batch.clear()

    for row, attributions in notes:
        count += 1
        edit_ids.add(row['edit'])
        editor_ids.add(row['editor'])
        note_batch.append((row['id'], row['editor'], row['edit'], row['text'], row['post_time']))
        for script_id, pattern, version in attributions:
            link_batch.append((row['id'], script_id, pattern, version))
        if len(note_batch) >= BATCH:
            flush()

    flush()
    connection.commit()
    return edit_ids, editor_ids, count


def insert_edit_rows(connection: sqlite3.Connection, rows: Iterator[tuple[str, tuple]]) -> dict[str, int]:
    """Consume pass 2, dispatching each row to its table."""
    statements = {
        'edit': 'INSERT OR REPLACE INTO edit '
                '(id, editor, type, status, autoedit, open_time, close_time, expire_time, quality) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'entity': 'INSERT OR REPLACE INTO edit_entity (edit, entity_type, entity_id) VALUES (?, ?, ?)',
        'vote': 'INSERT OR REPLACE INTO vote (id, editor, edit, vote, vote_time, superseded) '
                'VALUES (?, ?, ?, ?, ?, ?)',
    }
    batches: dict[str, list[tuple]] = {kind: [] for kind in statements}
    counts: dict[str, int] = {kind: 0 for kind in statements}

    def flush(kind: str) -> None:
        if batches[kind]:
            connection.executemany(statements[kind], batches[kind])
            batches[kind].clear()

    for kind, row in rows:
        batches[kind].append(row)
        counts[kind] += 1
        if len(batches[kind]) >= BATCH:
            flush(kind)

    for kind in statements:
        flush(kind)
    connection.commit()
    return counts


def insert_editors(connection: sqlite3.Connection, editors: Iterable[tuple[int, str]]) -> int:
    batch = list(editors)
    connection.executemany('INSERT OR REPLACE INTO editor (id, name) VALUES (?, ?)', batch)
    connection.commit()
    return len(batch)


def backfill_missing_editors(connection: sqlite3.Connection) -> int:
    """Make sure every editor we reference has a row, even if unnamed.

    An editor can be missing from `editor_sanitized` (deleted accounts, mostly).
    Leaving the row absent would silently drop their edits from any join, which
    is worse than showing them as an unnamed id.
    """
    cursor = connection.execute(
        'INSERT OR IGNORE INTO editor (id, name) '
        'SELECT editor, NULL FROM note '
        'UNION SELECT editor, NULL FROM edit'
    )
    connection.commit()
    return cursor.rowcount or 0


def record_run(connection: sqlite3.Connection, dump_id: str, notes: int,
               edits: int, editors: int, duration_s: float) -> None:
    connection.execute(
        'INSERT INTO run (dump_id, ran_at, notes_matched, edits, editors, duration_s) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        (dump_id, datetime.now(timezone.utc).isoformat(timespec='seconds'),
         notes, edits, editors, round(duration_s, 1)),
    )
    connection.commit()


def optimise(connection: sqlite3.Connection) -> None:
    print('Optimising database', file=sys.stderr, flush=True)
    connection.execute('ANALYZE')
    connection.commit()
    connection.execute('VACUUM')
