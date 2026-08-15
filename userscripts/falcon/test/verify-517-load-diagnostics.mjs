// #517 follow-up (majkinetor, live, with an animated gif as proof): "I
// clearly see worker finishing seeding in 2-3s and waiting 13s to
// incorrectly show 'edit page never loaded'" — a genuine detection bug, not
// timing/contention (staggering was tried and reverted, confirmed it
// couldn't explain this). The "is the edit page loaded" check now logs the
// actual state of each sub-condition periodically while it polls, so the
// NEXT occurrence's log says which check kept failing instead of needing
// another live repro.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const RECORDING = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';

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
// serve a response that STAYS on /edit but never renders the rows Falcon
// looks for — a controlled way to force the "still waiting" diagnostic path
// without needing a real 3+ second wait against a live MB page.
await page.route(`**/recording/${RECORDING}/edit*`, route => route.fulfill({
  status: 200, contentType: 'text/html',
  body: `<html><body><p>rendering...</p></body></html>`,
}));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.evaluate(() => document.getElementById('falcon-log-debug').checked = true);
await page.evaluate(() => { window.__falconTest.cfg.workers = 1; });

await page.evaluate((RECORDING) => {
  const t = window.__falconTest;
  t.addToQueue([{ entityType: 'recording', mbid: RECORDING, url: 'https://example.com/1' }]);
  t.start();
}, RECORDING);
// the diagnostic logs every ~20 polls (~3s) — wait long enough for at least one.
await page.waitForTimeout(3500);
const log = await page.evaluate(() => window.__falconTest.getLog());
const diagLines = log.filter(l => /still waiting for edit page/.test(l));
console.log('diagnostic lines seen:', JSON.stringify(diagLines));
ck(diagLines.length >= 1, `at least one diagnostic line appears while still polling (got ${diagLines.length})`);
ck(diagLines.some(l => /readyState=/.test(l) && /path=/.test(l) && /hasExternalLinkRow=/.test(l) && /hasAddLinkInput=/.test(l)), `the diagnostic line reports every sub-condition's actual state (got: ${diagLines[0]})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
