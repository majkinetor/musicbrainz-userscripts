// #467 (majkinetor: "it blocks and has huge delay at the end", "Last version is
// worst") — the long-running Firefox freeze, pinned so it cannot come back.
//
// Symptom, from his own logs: item 1 fine (~3.2s), then submits of 32.8s /
// 47.7s / 34.0s, each matching a heartbeat warning of ~31.5s / ~46.0s / ~31.5s.
// Not slow I/O — the UI thread was genuinely blocked that whole time.
//
// How it was cornered, since every Chromium test passed throughout:
//   1. Firefox + sandbox MB: no stalls. Firefox + production: reproduced.
//   2. A BARE control — 6 production edit pages loaded sequentially into one
//      off-screen scaled iframe, no Falcon at all — ran 3.1-3.9s each with zero
//      stalls. So neither Firefox nor MB's page weight was the cause.
//   3. Falcon, 6 items, ONE link type each: 13.3s total, zero stalls.
//      Falcon, the same 6 items, TWO link types on the same url: 297s, frozen
//      so hard that page.evaluate() itself stopped returning, 1 of 6 submitted.
//
// That isolated it to the dual-type path: Falcon used to seed one row and then
// bolt the second type on by clicking MB's "Add another relationship" and
// poking the new <select>. A same-origin iframe shares its parent's main
// thread, so MB's re-render storm over an already-rendered row froze the whole
// tab. Seeding both (url, type) pairs up front lets MB build both rows during
// its normal first render — the thing the bare control proved is cheap.
//
// Result on the identical batch: 297s and frozen -> ~12s, 6/6 committed, zero
// stalls; and 14 items across 3 workers in ~9s.
//
// Runs in FIREFOX deliberately (majkinetor's browser) — Chromium never showed
// this. Submits are intercepted and faked, so nothing is committed for real.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
// ⚠ the trailing * matters: without it this stops matching the moment the url
// carries seed params, and real POSTs leak through to production MusicBrainz.
let posts = 0;
await page.route('**/recording/*/edit*', async route => {
  const r = route.request();
  if (r.method() === 'POST') {
    posts++;
    const m = r.url().match(/\/recording\/([0-9a-f-]{36})\/edit/);
    return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/recording/${m[1]}` } });
  }
  return route.continue();
});

await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN (firefox profile)'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(800);

// heartbeat in the HOST page: the freeze is a main-thread block, so a plain
// interval that fails to fire on time is the most direct evidence there is.
await page.evaluate(() => {
  window.__stalls = [];
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const late = Math.round(now - last - 200);
    last = now;
    if (late > 400) window.__stalls.push(late);
  }, 200);
});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });
await page.evaluate(() => document.getElementById('falcon-launcher').click());
await page.waitForTimeout(600);

const RECS = [
  'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', '297fc936-e8da-455f-b3cf-64e56a38a7d2',
  '3dd4f370-dbf5-44c9-81d1-9f8bf26234ec', '8a3dbbba-80aa-4dc3-986b-e5c92ebedd24',
  '58a26807-6d02-4b79-bbba-f4c191b49f81', 'c47203ab-3901-4239-91ef-8f2c7e065902',
];
// a fresh url per run, so MB never short-circuits these as already present —
// an "already up to date" skip would submit nothing and prove nothing.
const rnd = Math.floor(Math.random() * 1e6);
await page.evaluate(({ recs, rnd }) => {
  window.__falconTest.setQueue(recs.map((mbid, i) => ({
    id: 'f' + i, entityType: 'recording', mbid,
    // the shape that froze: the SAME url under two different link types
    urls: [
      { url: `https://music.apple.com/sg/song/88${rnd}${i}`, linkTypeId: '254' },
      { url: `https://music.apple.com/sg/song/88${rnd}${i}`, linkTypeId: '979' },
    ],
    name: null, urlResults: null, status: 'queued', error: '',
  })));
  window.__falconTest.cfg.workers = 1;
}, { recs: RECS, rnd });

const t0 = Date.now();
await page.evaluate(() => window.__falconTest.start());
const finished = await page.waitForFunction(
  () => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'),
  null, { timeout: 120000 },
).then(() => true).catch(() => false);
const elapsed = Date.now() - t0;

// When it froze, the page was unresponsive enough that evaluate() itself hung
// and these came back null — so treat "cannot even read the queue" as a failure
// rather than letting it look like a pass with no data.
const statuses = await page.evaluate(() => window.__falconTest.getQueue().map(i => i.status)).catch(() => null);
const stalls = await page.evaluate(() => window.__stalls).catch(() => null);
console.log('elapsed', elapsed, 'ms; posts', posts, '; statuses', JSON.stringify(statuses), '; stalls', JSON.stringify(stalls));

ck(finished, `all ${RECS.length} dual-type items finish (they used to hang past the 120s mark)`);
ck(statuses !== null && stalls !== null, 'the page stayed responsive enough to be queried at all');
ck(Array.isArray(statuses) && statuses.every(s => s === 'done'), `every item committed (got ${JSON.stringify(statuses)})`);
ck(posts === RECS.length, `one real submit per item left the browser (got ${posts} of ${RECS.length})`);
ck(Array.isArray(stalls) && stalls.length === 0, `the UI thread was never blocked (stalls over 400ms: ${JSON.stringify(stalls)})`);
// generous ceiling: measured runs land near 12s, the broken one took 297s.
ck(elapsed < 60000, `the batch runs in seconds, not minutes (${elapsed}ms)`);

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
