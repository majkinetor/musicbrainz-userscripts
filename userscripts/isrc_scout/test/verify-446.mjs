// Verify #446 — ISRC Hunt restarts the track number per Spotify disc with no disc column,
// so a multi-disc album read as 1..13,1..12 all on "disc 1" and the disc-2 rows collided
// with medium 1. Runs the REAL parseIsrchunt (sliced from source) in a browser DOM against
// the live ISRC Hunt page for the reported album (Stan Getz — 13+12), asserting the disc
// reset is detected so rows 14-25 land on disc 2 at pos 1-12.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'isrc_scout.user.js');
const ALBUM = '2KnY7wRhELHc5s3Yq0T7gk';
const log = (...a) => console.log('[verify-446]', ...a);

const src = await readFile(SRC, 'utf8');
// slice the real parseIsrchunt out of the source (verbatim)
const a = src.indexOf('function parseIsrchunt');
const b = src.indexOf('async function fetchSpotify', a);
if (a < 0 || b < 0) { log('could not locate parseIsrchunt'); process.exit(2); }
const parseFn = src.slice(a, b).trim().replace(/\}\s*$/, '}');

// fetch the live ISRC Hunt HTML
const html = await fetch('https://isrchunt.com/spotify/importisrc?releaseId=' + encodeURIComponent('https://open.spotify.com/album/' + ALBUM), {
  headers: { 'User-Agent': 'mb-tools/1.0 (miodrag.milic@gmail.com)', 'Accept': 'text/html' },
}).then(r => r.text());

const ctx = await chromium.launchPersistentContext('', { headless: true });
const page = ctx.pages()[0] || await ctx.newPage();
const rows = await page.evaluate(({ parseFn, html }) => {
  // faithful shims for parseIsrchunt's deps (copied from source)
  const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
  const normalizeIsrc = raw => String(raw || '').toUpperCase().replace(/[\s\-]/g, '');
  const isValidIsrc = s => ISRC_RE.test(normalizeIsrc(s));
  const msToMmSs = ms => { if (!ms) return null; const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const parseIsrchunt = new Function('html', 'DOMParser', 'normalizeIsrc', 'isValidIsrc', 'msToMmSs',
    parseFn.replace(/^function parseIsrchunt\s*\(html\)\s*\{/, '').replace(/\}$/, ''));
  return parseIsrchunt(html, DOMParser, normalizeIsrc, isValidIsrc, msToMmSs);
}, { parseFn, html });
await ctx.close();

const discs = rows.map(r => r.disc);
const d1 = rows.filter(r => r.disc === 1), d2 = rows.filter(r => r.disc === 2);
log('rows:', rows.length, '| disc1:', d1.length, '| disc2:', d2.length);
log('disc1 pos:', d1.map(r => r.pos).join(','));
log('disc2 pos:', d2.map(r => r.pos).join(','));

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(rows.length === 25, `parsed all 25 ISRC rows (got ${rows.length})`);
check(d1.length === 13 && d2.length === 12, `split 13 (disc 1) + 12 (disc 2) — matches the MB mediums (got ${d1.length}+${d2.length})`);
check(d1.every((r, i) => r.pos === i + 1), 'disc 1 positions are 1..13');
check(d2.every((r, i) => r.pos === i + 1), 'disc 2 positions restart 1..12 (so they map to medium 2, not medium 1)');
check(rows[13].disc === 2 && rows[13].pos === 1, `row 14 is disc 2 pos 1 (got disc ${rows[13].disc} pos ${rows[13].pos})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
process.exit(fail ? 1 : 0);
