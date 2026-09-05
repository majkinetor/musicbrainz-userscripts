#!/usr/bin/env python3
"""Regenerate src/mbmeta.py from the MusicBrainz server's Constants.pm.

`edit.type`, `edit.status` and `vote.vote` are stored in the data dump as bare
integers, and the id-to-name mapping exists *only* in the server source. So we
lift it from there rather than hand-maintaining 170-odd magic numbers.

    python tools/gen_mbmeta.py [--source <path-or-url>]

Run this after a MusicBrainz schema change adds new edit types; the generated
file is committed so the container never needs the network for it.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
import urllib.request
from pathlib import Path

CONSTANTS_URL = (
    'https://raw.githubusercontent.com/metabrainz/musicbrainz-server/master/'
    'lib/MusicBrainz/Server/Constants.pm'
)

# Longest-first so RELEASE_GROUP wins over RELEASE.
ENTITIES = [
    'RELEASE_GROUP', 'RELEASE', 'RECORDING', 'ARTIST', 'LABEL', 'WORK', 'AREA',
    'PLACE', 'EVENT', 'INSTRUMENT', 'SERIES', 'URL', 'MEDIUM', 'TRACK',
    'RELATIONSHIP', 'GENRE', 'HISTORIC', 'WIKIDATA',
]

STATUS_LABEL = {
    'OPEN': 'Open',
    'APPLIED': 'Applied',
    'FAILEDVOTE': 'Failed (voted down)',
    'FAILEDDEP': 'Failed (dependency)',
    'ERROR': 'Error',
    'FAILEDPREREQ': 'Failed (prerequisite)',
    'NOVOTES': 'Cancelled (no votes)',
    'DELETED': 'Deleted',
}

VOTE_LABEL = {
    'ABSTAIN': 'Abstain', 'NO': 'No', 'YES': 'Yes',
    'APPROVE': 'Approve', 'ADMIN_APPROVE': 'Admin approve',
    'ADMIN_REJECT': 'Admin reject',
}


def split_entity(name: str) -> tuple[str, str]:
    """`RELEASE_ADD_ANNOTATION` -> ('release', 'ADD_ANNOTATION')."""
    for entity in sorted(ENTITIES, key=len, reverse=True):
        if name == entity or name.startswith(entity + '_'):
            return entity.lower().replace('_', ' '), name[len(entity):].lstrip('_')
    return '', name


def pretty(name: str) -> str:
    """`RELEASE_ADD_ANNOTATION` -> 'Add release annotation'.

    The verb leads, the entity sits in the middle, the rest trails — which reads
    the way MusicBrainz itself names these edits.
    """
    entity, action = split_entity(name)
    words = [w for w in action.split('_') if w]
    if not entity:
        return name.replace('_', ' ').capitalize()
    if not words:
        return entity.capitalize()
    verb, rest = words[0].lower(), ' '.join(w.lower() for w in words[1:])
    return ' '.join(filter(None, [verb.capitalize(), entity, rest]))


def build(source: str) -> str:
    if source.startswith(('http://', 'https://')):
        with urllib.request.urlopen(source, timeout=60) as response:
            text = response.read().decode('utf8')
    else:
        text = Path(source).read_text(encoding='utf8')

    types = re.findall(r'\$EDIT_([A-Z0-9_]+)\s*=>\s*(\d+)', text)
    statuses = re.findall(r'\$STATUS_([A-Z0-9_]+)\s*=>\s*(\d+)', text)
    votes = re.findall(r'\$VOTE_([A-Z0-9_]+)\s*=>\s*(-?\d+)', text)
    if not types or not statuses:
        raise SystemExit(f'no constants matched in {source} — did the file format change?')

    out = io.StringIO()
    out.write(
        '"""MusicBrainz enum lookups: edit type / status / vote id to human name.\n\n'
        'GENERATED FILE - do not hand-edit. Regenerate with:\n\n'
        '    python tools/gen_mbmeta.py\n\n'
        "Values come from the MusicBrainz server's Constants.pm, the only\n"
        'authoritative source for these ids (the data dump stores bare integers).\n'
        '"""\n\n'
        '# edit.type -> (constant, human label, entity the edit is about)\n'
        'EDIT_TYPES = {\n'
    )
    seen: set[int] = set()
    for name, value in types:
        number = int(value)
        if number in seen:
            continue
        seen.add(number)
        entity, _ = split_entity(name)
        out.write(f'    {number}: ({name!r}, {pretty(name)!r}, {entity!r}),\n')

    out.write('}\n\n# edit.status -> (constant, human label)\nEDIT_STATUS = {\n')
    for name, value in statuses:
        out.write(f'    {int(value)}: ({name!r}, {STATUS_LABEL.get(name, name)!r}),\n')

    out.write('}\n\n# vote.vote -> (constant, human label)\nVOTES = {\n')
    for name, value in votes:
        out.write(f'    {int(value)}: ({name!r}, {VOTE_LABEL.get(name, name)!r}),\n')

    out.write(
        '}\n\n'
        '# The edit is live in the database.\n'
        'APPLIED_STATUS = 2\n'
        '# The edit never took effect.\n'
        'FAILED_STATUSES = (3, 4, 5, 6, 7, 9)\n'
        '# Still awaiting votes.\n'
        'OPEN_STATUS = 1\n'
    )
    return out.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default=CONSTANTS_URL,
                        help='Constants.pm URL or local path')
    parser.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'src' / 'mbmeta.py'))
    args = parser.parse_args()

    generated = build(args.source)
    Path(args.out).write_text(generated, encoding='utf8')
    print(f'wrote {args.out} ({len(generated):,} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
