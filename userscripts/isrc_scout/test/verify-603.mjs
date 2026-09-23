// Verify #603 — Spotify ISRCs via molla. On release 5000a285 (Daft Punk — Random
// Access Memories, 13 tracks, links a Spotify album) click the Spotify import with the
// default source (molla) and check every filled ISRC against the one MB already holds.
// The shim strips the recordings' ISRCs from the WS2 response so the rows read as empty
// (otherwise every fill is "already present"), keeping the originals as ground truth.
// Scenarios, each on a fresh page:
//   match     — as-is: molla's 13 tracks = MB's 13 → mapped by position
//   split     — WS2 reshaped into two media (7 + 6): flattened position must land
//               molla #8..13 on medium 2 tracks 1..6
//   mismatch  — WS2 loses its last track (12 vs 13): no positions, title match only;
//               the 12 remaining rows still get their own ISRC, nothing lands wrong
//   ratelimit — molla answers HTTP 500 with a 429 inside: the rate-limit message shows
// Read-only — never submits.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
let scenario = 'match';
const truth = [];   // original MB ISRCs, in flattened track order
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  if (scenario === 'ratelimit' && /mollamusicgroup/.test(o.url))
    return { status: 500, responseText: JSON.stringify({ error: 'Spotify API error: 429 Too Many Requests' }), finalUrl: o.url };
  try {
    const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, data: o.data, maxRedirects: 10 });
    let text = await r.text();
    if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
      const j = JSON.parse(text); truth.length = 0;
      (j.media || []).forEach(md => (md.tracks || []).forEach(tk => {
        if (tk.recording) { truth.push(tk.recording.isrcs || []); tk.recording.isrcs = []; }
      }));
      if (scenario === 'split') {
        const all = j.media[0].tracks;
        const m1 = { ...j.media[0], position: 1, tracks: all.slice(0, 7) };
        const m2 = { ...j.media[0], position: 2, tracks: all.slice(7).map((t, i) => ({ ...t, position: i + 1, number: String(i + 1) })) };
        j.media = [m1, m2];
      }
      if (scenario === 'mismatch') j.media[j.media.length - 1].tracks.pop();
      text = JSON.stringify(j);
    }
    return { status: r.status(), responseText: text, finalUrl: r.url() };
  } catch (e) { return { status: 0, responseText: '', finalUrl: o.url }; }
});

async function run(name) {
  scenario = name;
  console.log('\n── ' + name);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
    window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
    window.unsafeWindow = window;
    window.GM_xmlhttpRequest = (o) => {
      window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {}, data: o.data }).then(r => {
        if (r.status === 0) { o.onerror && o.onerror({ status: 0 }); return; }
        o.onload && o.onload(r);
      }).catch(() => o.onerror && o.onerror({ status: 0 }));
      return { abort() {} };
    };
  });
  await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#ii-btn', { timeout: 20000 });
  await page.click('#ii-btn');
  await page.waitForSelector('#ii-sp-all:not([style*="none"])', { timeout: 30000 });
  await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
  await page.click('#ii-sp-all');
  await page.waitForFunction(() => /Spotify (done|failed)|Spotify failed/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#ii-tbody tr[data-idx]')].map(tr => ({
      val: (tr.querySelector('.ii-input') || {}).value || '',
      suspect: !!tr.querySelector('.ii-input.ii-in-suspect'),
    })),
    prog: document.getElementById('ii-prog')?.textContent || '',
    log: document.getElementById('ii-log-out')?.textContent || '',
  }));
  const mollaLines = r.log.split(/\n|(?=\d\d:\d\d:\d\d)/).filter(l => /molla|Spotify/.test(l));
  console.log(mollaLines.slice(0, 40).map(l => '   | ' + l.trim().slice(0, 170)).join('\n'));
  await page.close();
  return { ...r, errs };
}

// Row i must hold the ISRC MB has for flattened track i (reshaping keeps the order).
const wrongFills = res => res.rows.map((x, i) => ({ i, val: x.val, want: truth[i] })).filter(x => x.val && !(x.want || []).includes(x.val));
const filled = res => res.rows.filter(x => x.val).length;

for (const name of ['match', 'split', 'mismatch', 'ratelimit']) {
  if (only && name !== only) continue;
  const res = await run(name);
  ck(res.errs.length === 0, `${name}: no page errors ${JSON.stringify(res.errs.slice(0, 2))}`);
  if (name === 'ratelimit') {
    ck(/rate-limited/.test(res.log), `${name}: log names the rate limit`);
    ck(filled(res) === 0, `${name}: nothing filled`);
    continue;
  }
  const want = name === 'mismatch' ? 12 : 13;
  ck(res.rows.length === want, `${name}: ${want} rows (got ${res.rows.length})`);
  ck(filled(res) === want, `${name}: every row filled (${filled(res)}/${want})`);
  const wrong = wrongFills(res);
  ck(wrong.length === 0, `${name}: every fill is the ISRC MB has for that track` + (wrong.length ? ' — wrong: ' + JSON.stringify(wrong.slice(0, 3)) : ''));
  ck(!res.rows.some(x => x.suspect), `${name}: no fill flagged implausible`);
  ck(name === 'mismatch' ? /by title\/artist match only/.test(res.log) : /mapping by position/.test(res.log), `${name}: log states the mapping mode`);
}
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
