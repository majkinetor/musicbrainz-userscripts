// #508 follow-up (majkinetor, live): "with option to start immediately from
// Harmony I got only 1 worker although 6 are configured". start()'s worker
// count is Math.min(cfg.workers, queued-at-that-instant) — correct for a
// fully-populated queue, but a Harmony release whose recordings are
// ISRC-only (no plain external-link actions) queues its cover/release item
// SYNCHRONOUSLY and its recordings ASYNCHRONOUSLY (resolveIsrcFallback has
// to fetch the real tracklist first) — auto-start fired in between, seeing
// only 1 queued item. addToQueue() now tops up the worker fleet whenever it
// adds anything while a run is already active, regardless of what triggered
// the addition.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
// intercept edit-page navigations so workers actually stall in a running
// state (loading forever) instead of racing through and going idle before
// we get a chance to observe the worker count.
await page.route('**/recording/*/edit*', route => new Promise(() => {}));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
// spawnWorkerCard() needs the panel's own #falcon-workers strip to exist.
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

const result = await page.evaluate(async () => {
  const t = window.__falconTest;
  t.cfg.workers = 6;
  // reproduce the exact sequence: ONE item queued (the release/cover),
  // then start() runs seeing just that ONE item — same as auto-start firing
  // right after addToQueue() queued only the synchronous part of the batch.
  t.addToQueue([{ entityType: 'release', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', coverCandidates: [{ provider: 'x', url: 'https://x.com/cover.jpg' }] }]);
  t.start();
  const workersAfterStart = t.getWorkerCardCount();
  // now the ISRC fallback's late addToQueue() call fires, adding 11 more
  // recordings — same as resolveIsrcFallback resolving after auto-start.
  const recs = [];
  for (let i = 1; i <= 11; i++) recs.push({ entityType: 'recording', mbid: `aaaaaaaa-5130-0000-0000-00000000001${i}`, isrc: `NLTH${i}` });
  t.addToQueue(recs);
  await new Promise(r => setTimeout(r, 300));
  const workersAfterTopUp = t.getWorkerCardCount();
  return { workersAfterStart, workersAfterTopUp, running: t.isRunning() };
});
console.log('result:', JSON.stringify(result));
ck(result.workersAfterStart === 1, `matches the reported bug: only 1 worker spawned when start() saw just 1 queued item (got ${result.workersAfterStart})`);
ck(result.workersAfterTopUp === 6, `once 11 more items arrive mid-run, the fleet tops up to cfg.workers=6 (got ${result.workersAfterTopUp})`);
ck(result.running, 'the run is still active throughout');

// sanity: topping up never OVER-spawns past cfg.workers even with a huge
// queue — a genuinely FRESH page, since workerCards (and any cards left
// over from a prior start/stop cycle) are a page-lifetime accumulation
// unrelated to this fix, not something to reset mid-test here.
const page3 = await ctx.newPage();
const errs3 = []; page3.on('pageerror', e => errs3.push(e.message));
await page3.route('**/recording/*/edit*', route => new Promise(() => {}));
await page3.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page3.addScriptTag({ content: code });
await page3.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page3.click('#falcon-launcher');
await page3.waitForSelector('#falcon-panel', { timeout: 5000 });
const capResult = await page3.evaluate(async () => {
  const t = window.__falconTest;
  t.cfg.workers = 3;
  t.addToQueue([{ entityType: 'artist', mbid: 'aaaaaaaa-5130-0000-0000-000000000099', url: 'https://x.com/a' }]);
  t.start();
  const many = [];
  for (let i = 0; i < 50; i++) many.push({ entityType: 'recording', mbid: `aaaaaaaa-5130-0000-0000-00000000002${String(i).padStart(2, '0')}`, isrc: `X${i}` });
  t.addToQueue(many);
  await new Promise(r => setTimeout(r, 300));
  return t.getWorkerCardCount();
});
console.log('worker count with a 51-item queue, cfg.workers=3:', capResult);
ck(capResult === 3, `top-up is capped at cfg.workers, never over-spawns (got ${capResult})`);

ck(errs.length === 0 && errs3.length === 0, 'no page errors: ' + JSON.stringify([...errs, ...errs3].slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
