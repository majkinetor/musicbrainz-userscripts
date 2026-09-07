// #579 (majkinetor): "moving Falcon window around while importing barely works",
// with nine "UI thread was blocked for ~3–5s" warnings in a 12-item, 5-worker run.
//
// spawnWorkersStaggered has never staggered: it spawned every worker in one
// synchronous loop, so N same-origin MusicBrainz edit pages began loading at the
// same instant, and same-origin iframes share this thread — their parsing and
// Knockout binding all landed on it together.
//
// What is asserted here is the SPAWN SPACING, not a stall count. Blocking depends
// on the machine, the browser and how heavy the real edit pages are, and it did
// not reproduce at all on a headless sandbox run — so a test that watched for
// stalls would pass everywhere and mean nothing. The spacing is the thing that
// changed and the thing that can be checked deterministically.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const log = (...a) => console.log('[verify-579]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// The logged-in sandbox profile, because start() refuses to run when it cannot
// see a MusicBrainz session — and rightly so: an unauthenticated run could not
// submit anything.
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
// The workers load real edit pages, which POST to MusicBrainz on their own
// (analytics, form machinery). Everything is aborted; what must be zero is a
// POST to the EDIT endpoint, which is the only kind that could change anything.
const posted = [];
await page.route(() => true, r => {
  if (r.request().method() === 'POST') { posted.push(r.request().url()); return r.abort(); }
  return r.fallback();
});
await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });
// Worker cards live inside the panel, which is built lazily — without opening it
// first, start() logs "starting 5 worker(s)" and spawns none, and the test would
// be measuring an empty room.
await page.evaluate(() => { const l = document.getElementById('falcon-launcher'); if (l) l.click(); });
await page.waitForSelector('#falcon-panel', { timeout: 15000, state: 'attached' });
await page.waitForTimeout(600);

// Workers are counted by the cards they create, and each card builds an iframe
// pointing at a real edit page. The queue is seeded with entities that do not
// exist, so nothing loads and nothing can be submitted — this measures WHEN a
// worker starts, which is all that changed.
const spawnTimes = await page.evaluate(async () => {
  const T = window.__falconTest;
  T.cfg.workers = 5;
  const q = Array.from({ length: 8 }, (_, i) => ({
    id: 'x' + i, entityType: 'recording',
    mbid: '00000000-0000-0000-0000-0000000000' + String(i).padStart(2, '0'),
    urls: [{ url: 'https://example.invalid/' + i }], status: 'queued',
  }));
  T.setQueue(q);
  const seen = [];
  const host = document.getElementById('falcon-workers') || document.body;
  const t0 = performance.now();
  // every worker builds itself an iframe; that is the moment it starts costing
  // this thread, so that is what is timed
  // Count the IFRAME itself and nothing else: a card is inserted with its frame
  // inside it, so matching the wrapper too would time every worker twice.
  // Keyed on the iframe ELEMENT: a card arrives with its frame inside it and the
  // frame is also seen on its own, so counting mutations would time every worker
  // twice and report a gap of 0 between the halves of one worker.
  const counted = new Set();
  const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    const frames = n.tagName === 'IFRAME' ? [n] : (n.querySelectorAll ? [...n.querySelectorAll('iframe')] : []);
    for (const f of frames) { if (counted.has(f)) continue; counted.add(f); seen.push(Math.round(performance.now() - t0)); }
  })));
  obs.observe(document.body, { childList: true, subtree: true });
  T.start();
  await new Promise(r => setTimeout(r, 6000));
  T.stop();
  obs.disconnect();
  return seen;
});
log('worker start offsets (ms):', JSON.stringify(spawnTimes));
ck(spawnTimes.length >= 3, `several workers were spawned to measure (${spawnTimes.length})`);

const gaps = spawnTimes.slice(1).map((t, i) => t - spawnTimes[i]);
log('gaps:', JSON.stringify(gaps));
ck(spawnTimes[0] < 300, `the first worker starts immediately — a run must look like it began (${spawnTimes[0]}ms)`);
// the fixture: on the old build every one of these was ~0
ck(gaps.every(g => g > 400), `every later worker waits its turn instead of piling on (gaps ${JSON.stringify(gaps)})`);
ck(gaps.every(g => g < 2500), `…and not so long that the run crawls to a start (gaps ${JSON.stringify(gaps)})`);
const ramp = spawnTimes[spawnTimes.length - 1] - spawnTimes[0];
ck(ramp < 5000, `the whole ramp is a one-off cost of ${ramp}ms, against runs measured in tens of seconds`);

// Stop during the ramp must not leave timers that spawn workers into a dead run
const afterStop = await page.evaluate(async () => {
  const T = window.__falconTest;
  T.cfg.workers = 5;
  T.setQueue(Array.from({ length: 8 }, (_, i) => ({
    id: 'y' + i, entityType: 'recording',
    mbid: '00000000-0000-0000-0000-0000000001' + String(i).padStart(2, '0'),
    urls: [{ url: 'https://example.invalid/y' + i }], status: 'queued',
  })));
  T.start();
  await new Promise(r => setTimeout(r, 300));   // stop mid-ramp, before the timers fire
  T.stop();
  const during = document.querySelectorAll('#falcon-workers iframe, .falcon-worker iframe').length;
  await new Promise(r => setTimeout(r, 4000));  // let every pending timer come due
  return { during, after: document.querySelectorAll('#falcon-workers iframe, .falcon-worker iframe').length };
});
log('stop mid-ramp:', JSON.stringify(afterStop));
ck(afterStop.after <= afterStop.during, `Stop during the ramp spawns nothing further (${afterStop.during} → ${afterStop.after})`);

const edits = posted.filter(u => /\/ws\/js\/edit\/|\/edit(\?|$)/.test(u));
if (posted.length) log('POSTs intercepted (all aborted):', JSON.stringify([...new Set(posted.map(u => { try { return new URL(u).pathname; } catch (e) { return u; } }))].slice(0, 4)));
ck(edits.length === 0, `no edit was submitted (${edits.length}: ${JSON.stringify(edits.slice(0, 2))})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
