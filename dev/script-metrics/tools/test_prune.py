"""Test for fetch.prune_old_dumps (#628): only the current dump stays cached.

    python tools/test_prune.py
"""
from __future__ import annotations

import importlib
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'src'))
fetch = importlib.import_module('fetch')


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        data = Path(tmp)
        for name in ('20260905-002519', '20260923-002121', '20260926-002121'):
            (data / name).mkdir()
            (data / name / fetch.EDIT_DUMP).write_bytes(b'x' * 1024)
        (data / 'metrics.db').write_bytes(b'db')
        (data / 'notes').mkdir()   # not a dump id: left alone

        fetch.prune_old_dumps(data, keep='20260926-002121')

        left = sorted(p.name for p in data.iterdir())
        expected = ['20260926-002121', 'metrics.db', 'notes']
        if left != expected:
            print(f'FAIL: left {left}, expected {expected}')
            return 1
        if not (data / '20260926-002121' / fetch.EDIT_DUMP).exists():
            print('FAIL: the kept dump lost its tarball')
            return 1
        fetch.prune_old_dumps(data / 'missing', keep='x')   # no data dir yet: no error
    print('OK: old dumps removed; the current dump, the database and other files kept')
    return 0


if __name__ == '__main__':
    sys.exit(main())
