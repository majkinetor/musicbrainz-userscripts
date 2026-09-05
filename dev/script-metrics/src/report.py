"""Turn the SQLite slice into the three published artefacts.

    out/metrics.json    dictionary-encoded cubes; the dashboard's data source
    out/METRICS.md      a static summary, readable straight on GitHub
    out/dashboard.html  self-contained interactive dashboard, no network at all

The cubes are deliberately small. The dashboard filters client-side by date,
script owner and "exclude the author", so the data it needs is a handful of
sparse aggregates rather than a row per edit — which keeps the committed JSON in
the tens of KB instead of megabytes.

Only the main cube carries a full editor dimension (the leaderboard needs it).
The rest key on a `mine` flag, which is all the "exclude the author" toggle
requires and avoids multiplying every cube by the editor count.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Categorical slots from the validated reference palette, in fixed order.
# Colour follows the script, never its current rank, so filtering never repaints.
SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

FACT_SQL = """
SELECT  se.script_id,
        se.script_owner,
        se.edit_id,
        se.script_user,
        substr(se.open_time, 1, 7)              AS month,
        CASE se.edit_status
             WHEN 2 THEN 'applied'
             WHEN 1 THEN 'open'
             ELSE 'failed'
        END                                     AS outcome,
        se.edit_type,
        se.version,
        se.autoedit,
        ed.name                                 AS user_name
FROM v_script_edit se
LEFT JOIN editor ed ON ed.id = se.script_user
WHERE se.open_time IS NOT NULL
"""


class Encoder:
    """Dictionary encoder: turns repeated labels into small integer indices."""

    def __init__(self) -> None:
        self.values: list = []
        self._index: dict = {}

    def index(self, value):
        found = self._index.get(value)
        if found is None:
            found = len(self.values)
            self._index[value] = found
            self.values.append(value)
        return found


def _one(connection: sqlite3.Connection, sql: str, params: Sequence = ()):
    row = connection.execute(sql, params).fetchone()
    return row[0] if row else None


def build_payload(connection: sqlite3.Connection, config: dict) -> dict:
    owner_name = config.get('owner_mb_username', '')

    scripts = [
        {'id': r[0], 'name': r[1], 'owner': r[2], 'note': r[3]}
        for r in connection.execute(
            'SELECT id, name, owner, note FROM script ORDER BY owner, name')
    ]

    months = Encoder()
    editors = Encoder()
    types = Encoder()
    versions = Encoder()
    script_index = {s['id']: i for i, s in enumerate(scripts)}
    outcomes = ['applied', 'open', 'failed']

    # (script, month, editor, outcome) -> distinct edits
    main: dict[tuple, int] = {}
    # (script, month, mine, type) and (script, month, mine, version)
    by_type: dict[tuple, int] = {}
    by_version: dict[tuple, int] = {}
    autoedits: dict[tuple, int] = {}

    editor_names: dict[int, str] = {}
    total_edits = 0

    for row in connection.execute(FACT_SQL):
        (script_id, _owner, _edit_id, user_id, month,
         outcome, edit_type, version, autoedit, user_name) = row
        if script_id not in script_index or not month:
            continue
        total_edits += 1

        si = script_index[script_id]
        mi = months.index(month)
        ei = editors.index(user_id)
        editor_names[user_id] = user_name or f'editor #{user_id}'
        mine = 1 if (user_name or '') == owner_name else 0
        oi = outcomes.index(outcome)

        main[(si, mi, ei, oi)] = main.get((si, mi, ei, oi), 0) + 1
        ti = types.index(edit_type)
        by_type[(si, mi, mine, ti)] = by_type.get((si, mi, mine, ti), 0) + 1
        vi = versions.index(version or '')
        by_version[(si, mi, mine, vi)] = by_version.get((si, mi, mine, vi), 0) + 1
        if autoedit:
            autoedits[(si, mi, mine)] = autoedits.get((si, mi, mine), 0) + 1

    type_labels = {
        r[0]: r[1] for r in connection.execute('SELECT id, label FROM edit_type')
    }
    entity_of_type = {
        r[0]: r[1] for r in connection.execute('SELECT id, entity FROM edit_type')
    }

    month_order = sorted(range(len(months.values)), key=lambda i: months.values[i])
    # Re-map month indices to chronological order so the client can just sort by index.
    remap = {old: new for new, old in enumerate(month_order)}
    sorted_months = [months.values[i] for i in month_order]

    def remapped(cube: dict, month_pos: int) -> list[list[int]]:
        out = []
        for key, count in cube.items():
            key = list(key)
            key[month_pos] = remap[key[month_pos]]
            out.append([*key, count])
        out.sort()
        return out

    runs = [
        {'dump_id': r[0], 'ran_at': r[1], 'notes': r[2], 'edits': r[3],
         'editors': r[4], 'duration_s': r[5]}
        for r in connection.execute(
            'SELECT dump_id, ran_at, notes_matched, edits, editors, duration_s '
            'FROM run ORDER BY id')
    ]

    orphan_notes = _one(connection,
                        'SELECT COUNT(*) FROM note n LEFT JOIN edit e ON e.id = n.edit '
                        'WHERE e.id IS NULL') or 0

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'dump_id': runs[-1]['dump_id'] if runs else None,
        'default_cutoff': config.get('default_cutoff', '2026-01-01'),
        'owner_mb_username': owner_name,
        'palette': {'light': SERIES_LIGHT, 'dark': SERIES_DARK},
        'scripts': scripts,
        'months': sorted_months,
        'outcomes': outcomes,
        'editors': [{'id': v, 'name': editor_names.get(v, str(v))} for v in editors.values],
        'types': [{'id': v, 'label': type_labels.get(v, f'type {v}'),
                   'entity': entity_of_type.get(v, '')} for v in types.values],
        'versions': versions.values,
        'cubes': {
            # [script, month, editor, outcome, count]
            'main': remapped(main, 1),
            # [script, month, mine, type, count]
            'type': remapped(by_type, 1),
            # [script, month, mine, version, count]
            'version': remapped(by_version, 1),
            # [script, month, mine, count]
            'autoedit': remapped(autoedits, 1),
        },
        'quality': {
            'total_attributed_edits': total_edits,
            'notes_without_edit_row': orphan_notes,
        },
        'runs': runs,
    }


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def _markdown(payload: dict, connection: sqlite3.Connection) -> str:
    cutoff = payload['default_cutoff']
    cutoff_month = cutoff[:7]
    scripts = {s['id']: s for s in payload['scripts']}
    months = payload['months']
    editors = payload['editors']
    owner = payload['owner_mb_username']

    per_script: dict[str, dict] = {}
    per_editor: dict[int, dict] = {}
    for si, mi, ei, oi, count in payload['cubes']['main']:
        if months[mi] < cutoff_month:
            continue
        script_id = payload['scripts'][si]['id']
        outcome = payload['outcomes'][oi]
        bucket = per_script.setdefault(
            script_id, {'edits': 0, 'applied': 0, 'open': 0, 'failed': 0, 'users': set()})
        bucket['edits'] += count
        bucket[outcome] += count
        bucket['users'].add(ei)

        editor = editors[ei]
        person = per_editor.setdefault(
            editor['id'], {'name': editor['name'], 'edits': 0, 'scripts': set()})
        person['edits'] += count
        person['scripts'].add(script_id)

    lines: list[str] = []
    add = lines.append
    add('# Script metrics')
    add('')
    add(f'MusicBrainz edits made with these userscripts, counted from the '
        f'`{payload["dump_id"]}` database snapshot.')
    add('')
    add(f'- **Window:** {cutoff} onwards')
    add(f'- **Generated:** {payload["generated_at"]}')
    add(f'- **Attributed edits (all time):** {payload["quality"]["total_attributed_edits"]:,}')
    add('')
    add('Attribution is by edit-note text — see `config/sources.json`. Counts are '
        'per *script*, and one edit can count for two scripts when a note carries '
        'both signatures (our scripts preserve a previous script\'s note).')
    add('')

    total_edits = sum(b['edits'] for b in per_script.values())
    all_users = set()
    for bucket in per_script.values():
        all_users |= bucket['users']
    others = {e for e in all_users if editors[e]['name'] != owner}

    add('## Totals')
    add('')
    add('| Metric | Value |')
    add('|---|---:|')
    add(f'| Edits | {total_edits:,} |')
    add(f'| Distinct editors | {len(all_users):,} |')
    add(f'| Editors other than `{owner}` | {len(others):,} |')
    add(f'| Scripts with at least one edit | {len(per_script):,} |')
    add('')

    add('## Per script')
    add('')
    add('| Script | Owner | Edits | Editors | Applied | Open | Failed |')
    add('|---|---|---:|---:|---:|---:|---:|')
    for script_id, bucket in sorted(per_script.items(), key=lambda kv: -kv[1]['edits']):
        meta = scripts.get(script_id, {'name': script_id, 'owner': '?'})
        add(f'| {meta["name"]} | {meta["owner"]} | {bucket["edits"]:,} | '
            f'{len(bucket["users"]):,} | {bucket["applied"]:,} | {bucket["open"]:,} | '
            f'{bucket["failed"]:,} |')
    silent = [s for s in payload['scripts'] if s['id'] not in per_script]
    if silent:
        add('')
        add('Scripts with no attributed edits in this window: '
            + ', '.join(f'{s["name"]}' + (f' ({s["note"]})' if s.get('note') else '')
                        for s in silent))
    add('')

    add('## Editors')
    add('')
    add('| Editor | Edits | Scripts used |')
    add('|---|---:|---|')
    ranked = sorted(per_editor.values(), key=lambda p: -p['edits'])[:50]
    for person in ranked:
        used = ', '.join(sorted(scripts.get(s, {}).get('name', s) for s in person['scripts']))
        add(f'| [{person["name"]}](https://musicbrainz.org/user/{person["name"]}) '
            f'| {person["edits"]:,} | {used} |')
    if len(per_editor) > 50:
        add('')
        add(f'_Showing the top 50 of {len(per_editor):,} editors._')
    add('')

    add('## Runs')
    add('')
    add('| Dump | Ran at | Notes matched | Edits | Minutes |')
    add('|---|---|---:|---:|---:|')
    for run in payload['runs'][-10:]:
        minutes = f'{run["duration_s"] / 60:.1f}' if run['duration_s'] else ''
        add(f'| {run["dump_id"]} | {run["ran_at"]} | {run["notes"]:,} | '
            f'{run["edits"]:,} | {minutes} |')
    add('')
    add('_Generated by `dev/script-metrics`. Do not edit by hand._')
    return '\n'.join(lines) + '\n'


# ---------------------------------------------------------------------------

def render(connection: sqlite3.Connection, out_dir: Path, config: dict) -> None:
    print('Building reports', file=sys.stderr, flush=True)
    payload = build_payload(connection, config)

    json_path = out_dir / 'metrics.json'
    json_path.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding='utf8')

    md_path = out_dir / 'METRICS.md'
    md_path.write_text(_markdown(payload, connection), encoding='utf8')

    template = (ROOT / 'templates' / 'dashboard.html').read_text(encoding='utf8')
    html = template.replace(
        '/*__DATA__*/null',
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')),
    )
    html_path = out_dir / 'dashboard.html'
    html_path.write_text(html, encoding='utf8')

    print(f'  {json_path.name}: {json_path.stat().st_size / 1024:.0f} KB', file=sys.stderr)
    print(f'  {md_path.name}: {md_path.stat().st_size / 1024:.0f} KB', file=sys.stderr)
    print(f'  {html_path.name}: {html_path.stat().st_size / 1024:.0f} KB', file=sys.stderr)
