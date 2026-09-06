"""Turn the SQLite slice into the three published artefacts.

    out/metrics.json    dictionary-encoded cubes; the dashboard's data source
    out/METRICS.md      a static summary, readable straight on GitHub
    out/dashboard.html  self-contained interactive dashboard, no network at all

The cubes are deliberately small. The dashboard filters client-side by date,
script owner and "exclude the author", so the data it needs is a handful of
sparse aggregates rather than a row per edit — which keeps the committed JSON in
the tens of KB instead of megabytes.

Only the main cube carries an editor dimension, and only for our own scripts.
The third-party comparison scripts run to millions of edits by thousands of
editors; keeping their editor identities would inflate the committed JSON by
orders of magnitude to build a leaderboard nobody asked for, so they fold into
two synthetic buckets flagged `tracked: false`. Every other cube keys on a
`mine` flag, which is all the "exclude the author" toggle needs.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent

# Categorical slots from the validated reference palette, in fixed order.
# Colour follows the script, never its current rank, so filtering never repaints.
SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

# Owner value in config/sources.json marking "these are mine".
OWNED = 'majkinetor'

# How many distinct scripts each edit is attributed to. An edit counted for two
# scripts is not double-counting: our scripts preserve a previous script's note
# when they append to it, so both signatures really are on that edit. But it does
# change how a per-script total should be read — Scribe's edits are *all* shared,
# while ISRC Scout's are almost all its own — so the reports say so explicitly.
EDIT_SCRIPTS_SQL = """
CREATE TEMP TABLE edit_scripts AS
SELECT n.edit AS edit, COUNT(DISTINCT COALESCE(sm.into_id, ns.script)) AS nscripts
FROM note n
JOIN note_script ns ON ns.note = n.id
LEFT JOIN script_merge sm ON sm.from_id = ns.script
GROUP BY n.edit
"""

# One row per (script, edit), flattened once into a temp table so the half-dozen
# GROUP BYs below do not each re-evaluate the view. On real data this is ~9M
# rows, almost all of them from the third-party comparison scripts.
# Grouped by (merged script, edit): a merge folds two scripts into one, and an
# edit carrying both signatures would otherwise appear twice under the survivor.
# The grouped columns are per-edit facts, identical across the rows being folded.
FACT_SQL = """
CREATE TEMP TABLE fact AS
SELECT  COALESCE(sm.into_id, se.script_id)      AS script_id,
        MIN(se.script_owner)                    AS script_owner,
        se.edit_id                              AS edit_id,
        MIN(se.script_user)                     AS script_user,
        MIN(substr(se.open_time, 1, 7))         AS month,
        MIN(CASE se.edit_status
                 WHEN 2 THEN 'applied'
                 WHEN 1 THEN 'open'
                 ELSE 'failed'
            END)                                AS outcome,
        MIN(se.edit_type)                       AS edit_type,
        MIN(se.version)                         AS version,
        MIN(se.autoedit)                        AS autoedit,
        MAX(CASE WHEN ed.name = ? THEN 1 ELSE 0 END)      AS mine,
        MAX(CASE WHEN es.nscripts > 1 THEN 1 ELSE 0 END)  AS shared
FROM v_script_edit se
LEFT JOIN editor ed ON ed.id = se.script_user
LEFT JOIN edit_scripts es ON es.edit = se.edit_id
LEFT JOIN script_merge sm ON sm.from_id = se.script_id
WHERE se.open_time IS NOT NULL
GROUP BY 1, 3
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

    merges = {s['id']: s['merge_into'] for s in config['scripts'] if s.get('merge_into')}
    connection.execute('DROP TABLE IF EXISTS temp.script_merge')
    connection.execute('CREATE TEMP TABLE script_merge (from_id TEXT PRIMARY KEY, into_id TEXT)')
    if merges:
        connection.executemany('INSERT INTO script_merge VALUES (?, ?)', list(merges.items()))
        print(f'  merging {", ".join(f"{a} -> {b}" for a, b in merges.items())}',
              file=sys.stderr, flush=True)

    scripts = [
        {'id': r[0], 'name': r[1], 'owner': r[2], 'note': r[3]}
        for r in connection.execute(
            'SELECT id, name, owner, note FROM script ORDER BY owner, name')
        if r[0] not in merges
    ]

    print('  flattening fact table', file=sys.stderr, flush=True)
    connection.execute('DROP TABLE IF EXISTS temp.edit_scripts')
    connection.execute(EDIT_SCRIPTS_SQL)
    connection.execute('CREATE INDEX temp.ix_edit_scripts ON edit_scripts (edit)')
    connection.execute('DROP TABLE IF EXISTS temp.fact')
    connection.execute(FACT_SQL, (owner_name,))
    connection.execute('CREATE INDEX temp.ix_fact ON fact (script_id, month)')

    months = Encoder()
    editors = Encoder()
    types = Encoder()
    versions = Encoder()
    script_index = {s['id']: i for i, s in enumerate(scripts)}
    outcomes = ['applied', 'open', 'failed']

    main: dict[tuple, int] = {}
    by_type: dict[tuple, int] = {}
    by_version: dict[tuple, int] = {}
    autoedits: dict[tuple, int] = {}

    # Editor identity is kept per-editor for our own scripts, where "who is
    # actually using this" is the whole question. The third-party comparison
    # scripts are here for volume: they carry thousands of editors across a
    # decade, and keeping that dimension would bloat the committed JSON by
    # orders of magnitude to build a leaderboard nobody asked for. Their editors
    # fold into two synthetic buckets - the author, and everyone else - both
    # flagged untracked so no distinct-editor count ever counts them.
    untracked_author = editors.index(('untracked', 1))
    untracked_others = editors.index(('untracked', 0))
    # (mb editor id, display name, tracked, is_author)
    editor_meta: dict[int, tuple] = {
        untracked_author: (None, owner_name + ' (comparison scripts)', False, True),
        untracked_others: (None, 'other editors (comparison scripts)', False, False),
    }

    print('  aggregating', file=sys.stderr, flush=True)

    for script_id, month, user_id, user_name, outcome, count in connection.execute(
        'SELECT f.script_id, f.month, f.script_user, ed.name, f.outcome, COUNT(*) '
        'FROM fact f LEFT JOIN editor ed ON ed.id = f.script_user '
        'WHERE f.script_owner = ? AND f.month IS NOT NULL '
        'GROUP BY 1, 2, 3, 5', (OWNED,)
    ):
        ei = editors.index(('editor', user_id))
        editor_meta[ei] = (user_id, user_name or f'editor #{user_id}', True,
                           user_name == owner_name)
        key = (script_index[script_id], months.index(month), ei, outcomes.index(outcome))
        main[key] = main.get(key, 0) + count

    for script_id, month, mine, outcome, count in connection.execute(
        'SELECT script_id, month, mine, outcome, COUNT(*) FROM fact '
        'WHERE script_owner <> ? AND month IS NOT NULL GROUP BY 1, 2, 3, 4', (OWNED,)
    ):
        ei = untracked_author if mine else untracked_others
        key = (script_index[script_id], months.index(month), ei, outcomes.index(outcome))
        main[key] = main.get(key, 0) + count

    for script_id, month, mine, edit_type, count in connection.execute(
        'SELECT script_id, month, mine, edit_type, COUNT(*) FROM fact '
        'WHERE month IS NOT NULL GROUP BY 1, 2, 3, 4'
    ):
        key = (script_index[script_id], months.index(month), mine, types.index(edit_type))
        by_type[key] = by_type.get(key, 0) + count

    # Versions only for our own scripts: a third party's release cadence is not
    # something this dashboard has any business reporting on.
    for script_id, month, mine, version, count in connection.execute(
        'SELECT script_id, month, mine, version, COUNT(*) FROM fact '
        'WHERE script_owner = ? AND month IS NOT NULL GROUP BY 1, 2, 3, 4', (OWNED,)
    ):
        key = (script_index[script_id], months.index(month), mine,
               versions.index(version or ''))
        by_version[key] = by_version.get(key, 0) + count

    for script_id, month, mine, count in connection.execute(
        'SELECT script_id, month, mine, COUNT(*) FROM fact '
        'WHERE autoedit = 1 AND month IS NOT NULL GROUP BY 1, 2, 3'
    ):
        key = (script_index[script_id], months.index(month), mine)
        autoedits[key] = autoedits.get(key, 0) + count

    shared_counts: dict[tuple, int] = {}
    for script_id, month, mine, shared, count in connection.execute(
        'SELECT script_id, month, mine, shared, COUNT(*) FROM fact '
        'WHERE month IS NOT NULL GROUP BY 1, 2, 3, 4'
    ):
        key = (script_index[script_id], months.index(month), mine, shared)
        shared_counts[key] = shared_counts.get(key, 0) + count

    # Which entity types the edits actually touch. This is the only consumer of
    # edit_entity, which is otherwise ~37M rows of dead weight. An edit can touch
    # several entities (a merge, a relationship), so these count touches, not
    # edits, and legitimately sum to more than the edit total.
    print('  entity touches', file=sys.stderr, flush=True)
    entities = Encoder()
    by_entity: dict[tuple, int] = {}
    for script_id, month, mine, entity_type, count in connection.execute(
        'SELECT f.script_id, f.month, f.mine, ee.entity_type, COUNT(*) '
        'FROM fact f JOIN edit_entity ee ON ee.edit = f.edit_id '
        'WHERE f.month IS NOT NULL GROUP BY 1, 2, 3, 4'
    ):
        key = (script_index[script_id], months.index(month), mine,
               entities.index(entity_type))
        by_entity[key] = by_entity.get(key, 0) + count

    total_edits = _one(connection, 'SELECT COUNT(*) FROM fact') or 0

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
        # `tracked` false marks the two synthetic buckets the comparison
        # scripts' editors fold into; nothing that counts distinct people may
        # include them.
        'editors': [
            {'id': editor_meta[i][0], 'name': editor_meta[i][1],
             'tracked': editor_meta[i][2], 'is_author': editor_meta[i][3]}
            for i in range(len(editors.values))
        ],
        'types': [{'id': v, 'label': type_labels.get(v, f'type {v}'),
                   'entity': entity_of_type.get(v, '')} for v in types.values],
        'versions': versions.values,
        'entities': entities.values,
        'cubes': {
            # [script, month, editor, outcome, count]
            'main': remapped(main, 1),
            # [script, month, mine, type, count]
            'type': remapped(by_type, 1),
            # [script, month, mine, version, count]
            'version': remapped(by_version, 1),
            # [script, month, mine, count]
            'autoedit': remapped(autoedits, 1),
            # [script, month, mine, entity, count] - entity *touches*, not edits
            'entity': remapped(by_entity, 1),
            # [script, month, mine, shared, count] - shared=1 means the edit is
            # also attributed to another script
            'shared': remapped(shared_counts, 1),
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
    shared_by_script: dict[str, int] = {}
    for si, mi, _mine, is_shared, count in payload['cubes']['shared']:
        if months[mi] < cutoff_month or not is_shared:
            continue
        sid = payload['scripts'][si]['id']
        shared_by_script[sid] = shared_by_script.get(sid, 0) + count
    for si, mi, ei, oi, count in payload['cubes']['main']:
        if months[mi] < cutoff_month:
            continue
        script_id = payload['scripts'][si]['id']
        outcome = payload['outcomes'][oi]
        bucket = per_script.setdefault(
            script_id, {'edits': 0, 'applied': 0, 'open': 0, 'failed': 0, 'users': set()})
        bucket['edits'] += count
        bucket[outcome] += count

        editor = editors[ei]
        if not editor['tracked']:
            # A comparison script's folded bucket: real edits, but not a person.
            continue
        bucket['users'].add(ei)
        person = per_editor.setdefault(
            editor['id'], {'name': editor['name'], 'edits': 0, 'scripts': {}})
        person['edits'] += count
        person['scripts'][script_id] = person['scripts'].get(script_id, 0) + count

    lines: list[str] = []
    add = lines.append
    add('# Script metrics')
    add('')
    add(f'MusicBrainz edits made with these userscripts, counted from the '
        f'`{payload["dump_id"]}` database snapshot.')
    add('')
    # majkinetor added this by hand on 2026-09-05; it lives here now because
    # METRICS.md is generated and the next report build would have wiped it.
    add('[Download HTML Dashboard](./dashboard.html)')
    add('')
    add(f'- **Window:** {cutoff} onwards')
    add(f'- **Generated:** {payload["generated_at"]}')
    add(f'- **Attributed edits (all time):** {payload["quality"]["total_attributed_edits"]:,}')
    add('')
    add('Attribution is by edit-note text — see `config/sources.json`. Counts are '
        'per *script*, and one edit can count for two scripts when a note carries '
        'both signatures. **Shared** counts exactly those, so a per-script total '
        'reads for what it is: Scribe\'s edits are all shared, while ISRC Scout\'s '
        'are almost entirely its own.')
    add('')

    total_edits = sum(b['edits'] for b in per_script.values())
    all_users = set()
    for bucket in per_script.values():
        all_users |= bucket['users']
    add('## Totals')
    add('')
    add('| Metric | Value |')
    add('|---|---:|')
    add(f'| Edits | {total_edits:,} |')
    add(f'| Distinct editors | {len(all_users):,} |')
    add(f'| Scripts with at least one edit | {len(per_script):,} |')
    add('')

    add('## Per script')
    add('')
    add('| Script | Owner | Edits | Shared | Editors | Applied |')
    add('|---|---|---:|---:|---:|---:|')
    for script_id, bucket in sorted(per_script.items(), key=lambda kv: -kv[1]['edits']):
        meta = scripts.get(script_id, {'name': script_id, 'owner': '?'})
        # Editor identity is not tracked for the comparison scripts, so an
        # honest dash beats a 0 that would read as "nobody uses it".
        users = f'{len(bucket["users"]):,}' if meta['owner'] == OWNED else '—'
        shared = shared_by_script.get(script_id, 0)
        add(f'| {meta["name"]} | {meta["owner"]} | {bucket["edits"]:,} | {shared:,} | '
            f'{users} | {bucket["applied"]:,} |')
    silent = [s for s in payload['scripts'] if s['id'] not in per_script]
    if silent:
        add('')
        add('Scripts with no attributed edits in this window: '
            + ', '.join(f'{s["name"]}' + (f' ({s["note"]})' if s.get('note') else '')
                        for s in silent))
    add('')

    add('## Editors')
    add('')
    add('| Editor | Edits | Usage per script |')
    add('|---|---:|---|')
    ranked = sorted(per_editor.values(), key=lambda p: -p['edits'])[:50]
    for person in ranked:
        used = ', '.join(
            f'{scripts.get(sid, {}).get("name", sid)} {n:,}'
            for sid, n in sorted(person['scripts'].items(), key=lambda kv: -kv[1]))
        # MusicBrainz usernames may contain spaces and other URL-unsafe
        # characters, which silently break the markdown link target.
        profile = 'https://musicbrainz.org/user/' + quote(person['name'], safe='')
        add(f'| [{person["name"]}]({profile}) | {person["edits"]:,} | {used} |')
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

    # The GitHub Pages site links straight at the dashboard, so it has to be
    # served from docs/ as well. Written from here rather than copied by hand,
    # because a hand-copied one goes stale the first time this is re-run and
    # nobody notices — the page still loads, it just quietly shows old numbers.
    #
    # In the container the repo is not visible: only ./out is bind-mounted, so
    # the ROOT-relative path below resolves to a /docs that isn't there. The
    # compose file mounts the real docs/ at /site and sets SITE_DIR to match;
    # the ROOT-relative fallback is for running this straight off a checkout.
    # Skipped, not failed, if neither exists — the pipeline must still work
    # somewhere that has no site.
    site_dir = Path(os.environ.get('SITE_DIR') or (ROOT.parent.parent / 'docs'))
    if site_dir.is_dir():
        site_path = site_dir / 'stats.html'
        site_path.write_text(html, encoding='utf8')
        print(f'  docs/{site_path.name}: {site_path.stat().st_size / 1024:.0f} KB (Pages)', file=sys.stderr)
    else:
        print(f'  docs/ not found at {site_dir} — skipping the Pages copy', file=sys.stderr)
