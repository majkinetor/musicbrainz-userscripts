"""Download the MusicBrainz dumps we need, with resume and checksum verification.

Two tarballs:

  mbdump-edit.tar.bz2    ~15 GB - edit, edit_note, vote, edit_<entity>, edit_data
  mbdump-editor.tar.bz2  ~80 MB - editor_sanitized, for editor id -> username

Downloads are cached per dump id under the data directory and verified against
the published SHA256SUMS. A verified file is never re-downloaded, so re-running
on a day when MetaBrainz has not rotated the dump (they publish twice a week)
costs no network at all.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = 'https://data.metabrainz.org/pub/musicbrainz/data/fullexport'

EDIT_DUMP = 'mbdump-edit.tar.bz2'
EDITOR_DUMP = 'mbdump-editor.tar.bz2'


def _get(url: str) -> str:
    request = urllib.request.Request(url, headers={'User-Agent': 'mb-userscripts-script-metrics/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode('utf8')


def latest_dump_id() -> str:
    """e.g. '20260905-002519'."""
    return _get(f'{BASE}/LATEST').strip()


def checksums(dump_id: str) -> dict[str, str]:
    """filename -> sha256, from the dump's published SHA256SUMS."""
    result: dict[str, str] = {}
    for line in _get(f'{BASE}/{dump_id}/SHA256SUMS').splitlines():
        parts = line.split()
        if len(parts) == 2:
            digest, name = parts
            result[name.lstrip('*')] = digest
    return result


def sha256_of(path: Path, label: str) -> str:
    digest = hashlib.sha256()
    size = path.stat().st_size
    read = 0
    with path.open('rb') as handle:
        while chunk := handle.read(1 << 24):
            digest.update(chunk)
            read += len(chunk)
            if size:
                print(f'\r  verifying {label}: {100 * read // size}%', end='', file=sys.stderr, flush=True)
    print('', file=sys.stderr)
    return digest.hexdigest()


def download(dump_id: str, name: str, dest_dir: Path, expected: str | None) -> Path:
    """Fetch `name` into `dest_dir`, resuming a partial file, then verify it.

    A `<file>.verified` marker records the digest we already checked, so repeat
    runs skip both the download and the (not free) rehash of a 15 GB file.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = dest_dir / name
    marker = dest_dir / f'{name}.verified'

    if target.exists() and marker.exists():
        if not expected or marker.read_text(encoding='utf8').strip() == expected:
            print(f'  {name}: already downloaded and verified', file=sys.stderr)
            return target

    url = f'{BASE}/{dump_id}/{name}'
    print(f'  {name}: downloading from {url}', file=sys.stderr)
    # curl handles resume, retries and a progress meter better than urllib does.
    command = [
        'curl', '--fail', '--location', '--retry', '5', '--retry-delay', '5',
        '--continue-at', '-', '--output', str(target), url,
    ]
    completed = subprocess.run(command)
    if completed.returncode != 0:
        raise SystemExit(f'download of {name} failed (curl exit {completed.returncode})')

    if expected:
        actual = sha256_of(target, name)
        if actual != expected:
            raise SystemExit(
                f'checksum mismatch for {name}\n  expected {expected}\n  actual   {actual}\n'
                f'Delete {target} and re-run.'
            )
        marker.write_text(expected, encoding='utf8')
        print(f'  {name}: checksum OK', file=sys.stderr)
    return target


def ensure_dumps(data_dir: Path, dump_id: str | None = None) -> dict:
    """Make sure both tarballs are present and verified. Returns run metadata."""
    dump_id = dump_id or latest_dump_id()
    print(f'Dump: {dump_id}', file=sys.stderr)

    try:
        sums = checksums(dump_id)
    except Exception as error:  # noqa: BLE001 - a missing SHA256SUMS is not fatal
        print(f'  warning: could not read SHA256SUMS ({error}); skipping verification', file=sys.stderr)
        sums = {}

    dump_dir = data_dir / dump_id
    edit_path = download(dump_id, EDIT_DUMP, dump_dir, sums.get(EDIT_DUMP))
    editor_path = download(dump_id, EDITOR_DUMP, dump_dir, sums.get(EDITOR_DUMP))

    meta = {
        'dump_id': dump_id,
        'edit_dump': str(edit_path),
        'editor_dump': str(editor_path),
        'edit_dump_bytes': edit_path.stat().st_size,
    }
    (dump_dir / 'run-meta.json').write_text(json.dumps(meta, indent=2), encoding='utf8')
    return meta


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', default='/data')
    parser.add_argument('--dump-id', default=None, help='pin a specific dump instead of LATEST')
    args = parser.parse_args()
    print(json.dumps(ensure_dumps(Path(args.data_dir), args.dump_id), indent=2))
