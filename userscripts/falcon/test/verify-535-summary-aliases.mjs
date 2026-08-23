// #535 follow-up (majkinetor, on an alias-only run): "Summary should contain
// alias info on workers (also missing wworker time?)". His summary read:
//
//   w    entity             status      load  settle    fill   submit    total
//        Instrumental Life  done           -       -       -        -        -
//   …
//   total run time: 2.6s wall clock · 0ms of item work
//   worked on: —
//
// Six aliases had just been added and the summary said nothing about them, with
// a blank worker column and dashes throughout — because alias-only items never
// touch the iframe pipeline, which is where item.timing is set.
//
// The alias names are FIXED, not stamped: the first run against a fresh sandbox
// creates them, every later run finds them already present. Both outcomes are
// valid here (the assertions accept either), and it keeps repeated test runs
// from littering the sandbox with aliases.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); process.exit(2); }
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const RECS = ['2bea9225-3cee-4a23-b8f3-cd705bed3d06', '75d74808-3b99-4e23-b3bf-d3e230d055ab'];
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(400);
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });

await page.evaluate((recs) => {
  window.__falconTest.setQueue(recs.map((mbid, i) => ({
    id: 'a' + i, entityType: 'recording', mbid, name: null, note: 'Falcon #535 summary check', source: '', urls: [],
    disambiguation: '', isrcs: [], video: false, cover: [], coverExistingCount: null, urlResults: null,
    aliases: [{ name: `Falcon summary check alias ${i}`, locale: 'de', type: 'Recording name', primary: false, sortName: '', begin: '', end: '', ended: false }],
    status: 'queued', error: '',
  })));
}, RECS);
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 180000 }).catch(() => {});
await page.waitForTimeout(1500);

const summary = await page.evaluate(() => {
  const l = window.__falconTest.getLog().find(x => /run summary/.test(String(x)));
  return l ? String(l) : '';
});
console.log(summary || '(no summary found)');
ck(!!summary, 'the run produced a summary');

// ── the worker column and timings are populated ─────────────────────────────
// Match on the worker tag, not on the status word: "totals: 2 done; …" also
// contains "done" and was being counted as a third row.
const rowLines = summary.split('\n').filter(l => /^\[w\d+\]/.test(l.trim()));
ck(rowLines.length === RECS.length, `one summary row per item (${rowLines.length})`);
ck(rowLines.every(l => /^\[w\d+\]/.test(l.trim())), 'every row names the worker that did it — ' + JSON.stringify(rowLines.map(l => l.trim().split(' ')[0])));
ck(!rowLines.some(l => /\s-\s+-\s+-\s+-\s+-\s*$/.test(l)), 'and no row is a line of dashes');

// ── alias info is in the table ──────────────────────────────────────────────
ck(/\balias\b/.test(summary.split('\n')[1] || ''), 'the table has an alias column');
ck(/aliasMs/.test(summary), 'and an alias timing column');
ck(rowLines.every(l => /\s\d+\/\d+/.test(l)), 'each row reports how many of its aliases landed');
// a real duration: the first run submits (seconds), a repeat run only reads the
// existing aliases (still non-zero, it is an HTTP round trip)
const aliasMsValues = rowLines.map(l => Number((l.match(/(\d+)\s+\d+\s*(?:;|$)/) || [])[1] || 0));
console.log('per-row alias ms: ' + JSON.stringify(aliasMsValues));
ck(aliasMsValues.every(v => v > 0), 'with a real duration against it, not 0/—');

// ── and in the aggregate line ───────────────────────────────────────────────
const worked = (summary.match(/worked on: (.*)$/m) || [])[1] || '';
console.log('worked on: ' + JSON.stringify(worked));
ck(/alias/.test(worked), 'the "worked on" line mentions aliases instead of reading "—"');
const total = (summary.match(/total run time: ([^\n]*)/) || [])[1] || '';
console.log('total line: ' + JSON.stringify(total));
ck(!/·\s*0ms of item work/.test(total), 'and the run no longer claims 0ms of item work');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
