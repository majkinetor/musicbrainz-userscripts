// #517 (majkinetor, live): "THis actually might be some recently introduced
// bug since I get it almost constantly" — 10/15 items failed with "edit
// page never loaded", "UI thread was blocked for ~3-4s" warnings right at
// the start of the run, and the workers that DID load took 14-15s — right
// at the 15s timeout, not comfortably under it. Root cause: N workers means
// N iframes all get `.src =` set in the SAME synchronous loop — a burst of
// simultaneous navigations competing for the main thread and MB's own
// server capacity at once. Workers now spawn staggered instead.
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
// intercept every edit-page navigation so nothing ever actually completes —
// isolates the SPAWN TIMING itself from real page-load variance.
await page.route('**/*/edit*', route => new Promise(() => {}));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

const timings = await page.evaluate(async () => {
  const t = window.__falconTest;
  t.cfg.workers = 4;
  const items = [];
  for (let i = 1; i <= 4; i++) items.push({ entityType: 'recording', mbid: `aaaaaaaa-5170-0000-0000-00000000010${i}`, url: `https://example.com/${i}` });
  t.addToQueue(items);
  const t0 = performance.now();
  const seenAt = [];
  t.start();
  // sample the iframe count every 50ms for 2s, recording WHEN each new one appears.
  let lastCount = 0;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 50));
    const count = t.getWorkerCardCount();
    if (count > lastCount) { seenAt.push(Math.round(performance.now() - t0)); lastCount = count; }
    if (count >= 4) break;
  }
  return seenAt;
});
console.log('worker spawn timestamps (ms since start()):', JSON.stringify(timings));
ck(timings.length === 4, `all 4 workers eventually spawn (got ${timings.length})`);
// staggered: NOT all within the same handful of ms — later ones should be
// meaningfully delayed relative to the first, not a synchronous burst.
const spread = timings[timings.length - 1] - timings[0];
ck(spread > 500, `spawns are spread out over real time, not a single synchronous burst (spread=${spread}ms across ${timings.length} workers)`);
// but bounded — this shouldn't take forever either.
ck(spread < 3000, `staggering stays modest, doesn't needlessly slow the whole batch down (spread=${spread}ms)`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
