"""Streaming reader for MusicBrainz data dumps.

A dump is a bzip2'd tar whose members are Postgres `COPY` output: one row per
line, tab-separated, `\\N` for NULL, and backslash escapes for any tab, newline
or backslash inside a value. There is no header row; column order is whatever
`CreateTables.sql` says for that table.

The edit dump is ~15 GB compressed and well over 100 GB expanded, so nothing
here ever materialises a member. We pipe the file through a decompressor and
walk the tar as a stream, handing back a line iterator per member and letting
the caller throw away the ~99.9% of rows it does not want.

bzip2 decompression is the wall-clock floor for a run, so we use `lbzip2` when
it is available: unlike `pbzip2` it parallelises decompression of *any* bzip2
stream, not just ones it compressed itself. Plain `bzip2` is the fallback.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tarfile
from collections.abc import Iterable, Iterator
from pathlib import Path

# Big reads matter here: at ~130M lines a small buffer costs real minutes.
READ_BUFFER = 1 << 22  # 4 MiB


def decompressor_cmd(path: Path) -> list[str]:
    """Prefer parallel bzip2 decompression; fall back to the serial one."""
    if shutil.which('lbzip2'):
        return ['lbzip2', '-dc', str(path)]
    if shutil.which('bzip2'):
        return ['bzip2', '-dc', str(path)]
    raise RuntimeError('neither lbzip2 nor bzip2 found on PATH')


def iter_members(
    path: Path,
    wanted: Iterable[str],
    stop_after: str | None = None,
) -> Iterator[tuple[str, Iterator[bytes]]]:
    """Walk a dump tarball, yielding `(member_name, line_iterator)` for `wanted`.

    Members arrive in the order the dump was written, and a tar stream cannot be
    rewound, so callers must be happy with that order. `stop_after` names the
    last member of interest: once it has been consumed we tear the pipe down
    instead of decompressing the remaining gigabytes for nothing.

    The yielded iterator is only valid until the next member is yielded — tar
    stream mode reuses the underlying file position.
    """
    wanted = set(wanted)
    command = decompressor_cmd(path)
    process = subprocess.Popen(command, stdout=subprocess.PIPE, bufsize=READ_BUFFER)
    assert process.stdout is not None

    try:
        # 'r|' is the non-seekable streaming mode; it never seeks backwards.
        with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
            for member in archive:
                if not member.isfile() or member.name not in wanted:
                    continue
                extracted = archive.extractfile(member)
                if extracted is None:
                    continue
                yield member.name, _iter_lines(extracted)
                if stop_after and member.name == stop_after:
                    break
    finally:
        # Killing the decompressor is the point of `stop_after`; a broken pipe
        # on its side is expected and not an error.
        if process.poll() is None:
            process.kill()
        try:
            if process.stdout:
                process.stdout.close()
        except BrokenPipeError:
            pass
        process.wait()


def _iter_lines(fileobj) -> Iterator[bytes]:
    """Yield newline-stripped lines. Buffered iteration is C-level and fast."""
    import io

    buffered = io.BufferedReader(fileobj, buffer_size=READ_BUFFER)
    for line in buffered:
        yield line.rstrip(b'\n')


# ---------------------------------------------------------------------------
# COPY text-format decoding
# ---------------------------------------------------------------------------

_UNESCAPE = {
    ord('n'): '\n', ord('t'): '\t', ord('r'): '\r',
    ord('\\'): '\\', ord('b'): '\b', ord('f'): '\f', ord('v'): '\v',
}


def unescape(value: bytes) -> str:
    """Decode one COPY text-format field.

    Real tabs and newlines never appear raw inside a value — Postgres escapes
    them — which is exactly why splitting a member on `\\t` and `\\n` is safe.
    """
    text = value.decode('utf8', 'replace')
    if '\\' not in text:
        return text

    out: list[str] = []
    index = 0
    length = len(text)
    while index < length:
        char = text[index]
        if char != '\\' or index + 1 >= length:
            out.append(char)
            index += 1
            continue
        nxt = text[index + 1]
        replacement = _UNESCAPE.get(ord(nxt))
        if replacement is not None:
            out.append(replacement)
            index += 2
        else:
            out.append(char)
            index += 1
    return ''.join(out)


def null_or(value: bytes) -> str | None:
    return None if value == b'\\N' else unescape(value)


def progress(label: str, count: int, every: int = 5_000_000) -> None:
    """Heartbeat for the long passes, so a 20-minute run does not look hung."""
    if count and count % every == 0:
        print(f'  {label}: {count:,} rows', file=sys.stderr, flush=True)
