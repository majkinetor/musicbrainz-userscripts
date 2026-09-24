"""Stall/resume test for fetch.fetch_with_retries, against a local HTTP server.

    python tools/test_fetch_stall.py

Case 1 - "stall once": the first request sends 1 MiB and then keeps the connection
open without sending anything, which is what hung the 2026-09-23 scheduled run.
Resumed (Range) requests get the rest. The download must give up on the stall,
resume where it stopped, and end byte-identical.

Case 2 - "always stalls": every request stalls. It must give up after the
configured number of attempts with a clear error, not hang.

Stall limits are shrunk through the METRICS_* environment variables, so the
whole test takes a few seconds.
"""
from __future__ import annotations

import http.server
import importlib
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

os.environ.update(METRICS_STALL_SECONDS='2', METRICS_STALL_MIN_BYTES='1024',
                  METRICS_DOWNLOAD_ATTEMPTS='3', METRICS_RETRY_PAUSE_SECONDS='1')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'src'))
fetch = importlib.import_module('fetch')

PAYLOAD = os.urandom(3 * 2**20)
MODE = {'stall_first': True, 'always': False, 'requests': []}
STOP = threading.Event()


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        rng = self.headers.get('Range')
        start = int(rng.split('=')[1].split('-')[0]) if rng else 0
        MODE['requests'].append(start)
        body = PAYLOAD[start:]
        self.send_response(206 if start else 200)
        if start:
            self.send_header('Content-Range', f'bytes {start}-{len(PAYLOAD) - 1}/{len(PAYLOAD)}')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        stall = MODE['always'] or (MODE['stall_first'] and len(MODE['requests']) == 1)
        if stall:
            # 'always' sends only a sliver per request, so resumed attempts can never finish the file
            self.wfile.write(body[:(64 * 2**10) if MODE['always'] else 2**20])
            self.wfile.flush()
            STOP.wait(30)          # hold the connection open, sending nothing
            return
        self.wfile.write(body)


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_address[1]}/dump.bin'
fails = 0


def check(ok: bool, msg: str) -> None:
    global fails
    print(('ok  : ' if ok else 'FAIL: ') + msg)
    fails += not ok


with tempfile.TemporaryDirectory() as tmp:
    # case 1
    target = Path(tmp) / 'dump.bin'
    t0 = time.monotonic()
    fetch.fetch_with_retries(url, target, 'dump.bin')
    took = time.monotonic() - t0
    check(target.read_bytes() == PAYLOAD, f'stall once: file complete and byte-identical ({target.stat().st_size:,} bytes)')
    check(MODE['requests'][:2] == [0, 2**20], f'stall once: second request resumed at 1 MiB (requests {MODE["requests"]})')
    check(took < 20, f'stall once: finished in {took:.1f}s, not hung')

    # case 2
    MODE.update(always=True, requests=[])
    target2 = Path(tmp) / 'dump2.bin'
    t0 = time.monotonic()
    try:
        fetch.fetch_with_retries(url, target2, 'dump2.bin')
        check(False, 'always stalls: should have raised')
    except SystemExit as error:
        check('after 3 attempts' in str(error), f'always stalls: gives up cleanly - "{error}"')
    took = time.monotonic() - t0
    check(len(MODE['requests']) == 3, f'always stalls: exactly 3 attempts ({len(MODE["requests"])})')
    check(took < 30, f'always stalls: gave up in {took:.1f}s')

STOP.set()
server.shutdown()
print(f'\n{fails} FAIL' if fails else '\nALL PASS')
sys.exit(1 if fails else 0)
