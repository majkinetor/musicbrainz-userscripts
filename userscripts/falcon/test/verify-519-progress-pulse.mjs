// #519 (majkinetor): "Just like with CH and Apollo (#412) lets have progress
// bar flashing while operation is in process as a visual marker that
// operation is in progress." A plain static bar looks the same whether a
// run is actively grinding through the queue or just idle at its last
// finished percentage — #falcon-progress-bar now gets a pulsing
// `.falcon-running` class for as long as `running` is true.
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
// hold every worker mid-flight — stalled forever — so `running` stays true
// long enough to observe the class instead of racing to completion.
await page.route('**/artist/*/edit*', route => new Promise(() => {}));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

// 1. idle — no pulse class, nothing queued/running yet.
const idle = await page.evaluate(() => document.getElementById('falcon-progress-bar').classList.contains('falcon-running'));
ck(idle === false, `no pulse class before anything starts (got ${idle})`);

// 2. running — the class is present the moment start() fires.
await page.evaluate(() => {
  const t = window.__falconTest;
  t.setQueue([{ id: '1', entityType: 'artist', mbid: 'aaaaaaaa-5190-0000-0000-000000000001', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' }]);
  t.start();
});
const running = await page.evaluate(() => ({
  pulsing: document.getElementById('falcon-progress-bar').classList.contains('falcon-running'),
  isRunning: window.__falconTest.isRunning(),
}));
console.log('while running:', JSON.stringify(running));
ck(running.isRunning === true, 'sanity: the run is actually active');
ck(running.pulsing === true, `the pulse class is present while a run is in progress (got ${running.pulsing})`);

// the keyframes/rule this class relies on actually exist in the injected stylesheet.
const hasKeyframes = await page.evaluate(() => [...document.styleSheets].some(s => {
  try { return [...s.cssRules].some(r => r.name === 'falcon-progress-pulse' || (r.selectorText && r.selectorText.includes('falcon-running'))); }
  catch (e) { return false; }
}));
ck(hasKeyframes, 'the pulse animation rule is actually injected, not just the class name');

// 3. stop() — the class comes back off, even with the item still parked mid-flight.
await page.evaluate(() => window.__falconTest.stop());
const afterStop = await page.evaluate(() => document.getElementById('falcon-progress-bar').classList.contains('falcon-running'));
ck(afterStop === false, `stop() clears the pulse immediately (got ${afterStop})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
