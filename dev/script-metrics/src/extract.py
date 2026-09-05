"""Filter the MusicBrainz edit dump down to the edits our userscripts made.

Two passes over the cached tarball, because tar is sequential and the members we
need arrive in an unhelpful order:

    edit  edit_area  edit_artist  edit_data  edit_event  edit_instrument
    edit_label  edit_note  edit_note_recipient  edit_place  edit_recording
    edit_release  edit_release_group  edit_series  edit_url  edit_work  vote

`edit` comes first but we cannot tell which edits matter until we have read
`edit_note`, which sits behind the enormous `edit_data`. So:

  pass 1  read `edit_note`, keep notes whose text matches a script pattern,
          then stop the decompressor - everything after it is dead weight.
  pass 2  read `edit`, the `edit_<entity>` link tables and `vote`, keeping only
          rows for the edit ids pass 1 found.

`edit_data` (the full JSON body of every edit, and the bulk of the dump) is
never parsed in either pass.

A note on ordering: rows come out in Postgres *heap* order, not primary-key
order — the first row of `edit` in a real dump is id 38125306, not 1, because
edits get rewritten when their status changes. So there is no early-exit by id
range; both passes read their members to the end.
"""
from __future__ import annotations

import re
import sys
from collections.abc import Iterator
from pathlib import Path

import mbdump

EDIT_MEMBER = 'mbdump/edit'
NOTE_MEMBER = 'mbdump/edit_note'
VOTE_MEMBER = 'mbdump/vote'
EDITOR_MEMBER = 'mbdump/editor_sanitized'

# member name -> entity type recorded for the link
ENTITY_MEMBERS = {
    'mbdump/edit_area': 'area',
    'mbdump/edit_artist': 'artist',
    'mbdump/edit_event': 'event',
    'mbdump/edit_instrument': 'instrument',
    'mbdump/edit_label': 'label',
    'mbdump/edit_place': 'place',
    'mbdump/edit_recording': 'recording',
    'mbdump/edit_release': 'release',
    'mbdump/edit_release_group': 'release_group',
    'mbdump/edit_series': 'series',
    'mbdump/edit_url': 'url',
    'mbdump/edit_work': 'work',
}


class ScriptMatcher:
    """Decides which configured scripts a raw edit-note body belongs to.

    A single note can legitimately match several scripts: our own scripts
    deliberately preserve another script's note when they append to it (Harmony's
    seeded note survives a Credit Hoarder import, for instance). So this returns
    *every* match rather than the first, and the caller records them all.
    """

    def __init__(self, scripts: list[dict]):
        self.pattern_owner: dict[bytes, str] = {}
        for script in scripts:
            for pattern in script['patterns']:
                self.pattern_owner[pattern.encode('utf8')] = script['id']
        if not self.pattern_owner:
            raise SystemExit('no patterns configured')
        # Longest first so an overlapping pattern cannot mask a more specific one.
        alternation = b'|'.join(
            re.escape(pattern)
            for pattern in sorted(self.pattern_owner, key=len, reverse=True)
        )
        self.regex = re.compile(alternation)

    def match(self, raw_text: bytes) -> list[tuple[str, str]]:
        """-> [(script_id, matched_pattern), ...], de-duplicated, or []."""
        found = self.regex.findall(raw_text)
        if not found:
            return []
        seen: dict[str, str] = {}
        for pattern in found:
            seen.setdefault(self.pattern_owner[pattern], pattern.decode('utf8'))
        return list(seen.items())


def compile_version_regexes(scripts: list[dict], default: str) -> dict[str, re.Pattern | None]:
    compiled: dict[str, re.Pattern | None] = {}
    for script in scripts:
        raw = script.get('version_regex', default)
        if 'version_regex' in script and script['version_regex'] is None:
            compiled[script['id']] = None
        else:
            compiled[script['id']] = re.compile(raw or default)
    return compiled


def iter_notes(
    edit_dump: Path,
    matcher: ScriptMatcher,
    version_regexes: dict[str, re.Pattern | None],
) -> Iterator[tuple[dict, list[tuple[str, str, str | None]]]]:
    """Pass 1. Yield `(note_row, [(script_id, pattern, version), ...])`.

    `edit_note` is `id, editor, edit, text, post_time`. Tabs and newlines inside
    the note body are backslash-escaped by COPY, so a raw split on tab always
    gives exactly five fields and one row never spans two lines.
    """
    print('Pass 1/2: scanning edit_note for script signatures', file=sys.stderr, flush=True)
    scanned = 0
    matched = 0

    for _name, lines in mbdump.iter_members(edit_dump, {NOTE_MEMBER}, stop_after=NOTE_MEMBER):
        for line in lines:
            scanned += 1
            mbdump.progress('edit_note scanned', scanned)

            # Cheap reject first: the regex runs on raw bytes and rejects
            # ~99.9% of notes without any decoding or splitting.
            hits = matcher.match(line)
            if not hits:
                continue

            fields = line.split(b'\t')
            if len(fields) != 5:
                continue
            note_id, editor, edit_id, raw_text, post_time = fields
            text = mbdump.unescape(raw_text)

            attributions = []
            for script_id, pattern in hits:
                regex = version_regexes.get(script_id)
                version = None
                if regex is not None:
                    found = regex.search(text)
                    if found:
                        version = found.group(1)
                attributions.append((script_id, pattern, version))

            matched += 1
            yield (
                {
                    'id': int(note_id),
                    'editor': int(editor),
                    'edit': int(edit_id),
                    'text': text,
                    'post_time': mbdump.null_or(post_time),
                },
                attributions,
            )

    print(f'  scanned {scanned:,} notes, matched {matched:,}', file=sys.stderr, flush=True)


def iter_edit_rows(edit_dump: Path, edit_ids: set[int]) -> Iterator[tuple[str, tuple]]:
    """Pass 2. Yield `('edit'|'entity'|'vote', row)` for the matched edit ids."""
    print(f'Pass 2/2: pulling edit rows for {len(edit_ids):,} edits', file=sys.stderr, flush=True)
    wanted = {EDIT_MEMBER, VOTE_MEMBER, *ENTITY_MEMBERS}
    counts = {'edit': 0, 'entity': 0, 'vote': 0}

    for name, lines in mbdump.iter_members(edit_dump, wanted, stop_after=VOTE_MEMBER):
        if name == EDIT_MEMBER:
            scanned = 0
            for line in lines:
                scanned += 1
                mbdump.progress('edit scanned', scanned)
                head, _, _ = line.partition(b'\t')
                try:
                    edit_id = int(head)
                except ValueError:
                    continue
                if edit_id not in edit_ids:
                    continue
                fields = line.split(b'\t')
                if len(fields) != 10:
                    continue
                counts['edit'] += 1
                yield 'edit', (
                    edit_id,
                    int(fields[1]),                     # editor
                    int(fields[2]),                     # type
                    int(fields[3]),                     # status
                    int(fields[4]),                     # autoedit
                    mbdump.null_or(fields[5]),          # open_time
                    mbdump.null_or(fields[6]),          # close_time
                    mbdump.null_or(fields[7]),          # expire_time
                    int(fields[9]) if fields[9] != b'\\N' else None,   # quality
                )

        elif name == VOTE_MEMBER:
            for line in lines:
                fields = line.split(b'\t')
                if len(fields) < 6:
                    continue
                try:
                    edit_id = int(fields[2])
                except ValueError:
                    continue
                if edit_id not in edit_ids:
                    continue
                counts['vote'] += 1
                yield 'vote', (
                    int(fields[0]), int(fields[1]), edit_id, int(fields[3]),
                    mbdump.null_or(fields[4]),
                    fields[5] == b't',
                )

        else:
            entity_type = ENTITY_MEMBERS[name]
            for line in lines:
                head, _, rest = line.partition(b'\t')
                try:
                    edit_id = int(head)
                except ValueError:
                    continue
                if edit_id not in edit_ids:
                    continue
                entity_id, _, _ = rest.partition(b'\t')
                try:
                    counts['entity'] += 1
                    yield 'entity', (edit_id, entity_type, int(entity_id))
                except ValueError:
                    continue

    print(
        f'  kept {counts["edit"]:,} edits, {counts["entity"]:,} entity links, '
        f'{counts["vote"]:,} votes',
        file=sys.stderr, flush=True,
    )


def iter_editors(editor_dump: Path, editor_ids: set[int]) -> Iterator[tuple[int, str]]:
    """Map editor id -> username from the (small) editor dump.

    `editor_sanitized` mirrors the `editor` table with the private columns
    blanked; we only ever touch the first two, id and name.
    """
    print(f'Resolving {len(editor_ids):,} editor names', file=sys.stderr, flush=True)
    found = 0
    for _name, lines in mbdump.iter_members(editor_dump, {EDITOR_MEMBER}, stop_after=EDITOR_MEMBER):
        for line in lines:
            head, _, rest = line.partition(b'\t')
            try:
                editor_id = int(head)
            except ValueError:
                continue
            if editor_id not in editor_ids:
                continue
            name, _, _ = rest.partition(b'\t')
            found += 1
            yield editor_id, mbdump.unescape(name)
    print(f'  resolved {found:,} of {len(editor_ids):,}', file=sys.stderr, flush=True)
