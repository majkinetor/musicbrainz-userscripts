// #512 follow-up (majkinetor): "Lets add an option in the log view to clear
// all historic logs (next to the combo)." A new button beside
// #falcon-log-history deletes every OTHER persisted session — the live one
// keeps its own pre-existing "Clear" button, untouched here.
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
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

// seed a live session plus a couple of historic ones directly in storage.
await page.evaluate(() => {
  const sid = window.__falconTest.getSessionId();
  localStorage.setItem('falcon:session:' + sid, JSON.stringify(['[10:00:00] INFO  === session ' + sid + ' started (live) ===', '[10:00:05] INFO  starting 1 worker(s) for 1 queued item(s)']));
  localStorage.setItem('falcon:session:20260101100000-1', JSON.stringify(['[10:00:00] INFO  === session 20260101100000-1 started ===', '[10:00:05] INFO  starting 2 worker(s) for 3 queued item(s)']));
  localStorage.setItem('falcon:session:20260102110000-1', JSON.stringify(['[11:00:00] INFO  === session 20260102110000-1 started ===', '[11:00:05] INFO  starting 4 worker(s) for 5 queued item(s)']));
});

// open the Log tab so populateLogHistory() runs and the button/select render.
await page.click('#falcon-tab-log');
await page.waitForTimeout(100);

const before = await page.evaluate(() => ({
  options: [...document.getElementById('falcon-log-history').options].map(o => o.value),
  btnDisabled: document.getElementById('falcon-log-clear-history').disabled,
}));
console.log('before clear:', JSON.stringify(before));
ck(before.options.filter(Boolean).length === 2, `both historic sessions show up in the combo (got ${JSON.stringify(before.options)})`);
ck(before.btnDisabled === false, 'the clear-history button is enabled when there IS history');

// view one of the historic sessions first, to confirm clearing snaps back to "live".
await page.evaluate(() => window.__falconTest.setViewingSession('20260101100000-1'));
await page.click('#falcon-log-clear-history');
await page.waitForTimeout(100);

const after = await page.evaluate((sid) => ({
  options: [...document.getElementById('falcon-log-history').options].map(o => o.value),
  btnDisabled: document.getElementById('falcon-log-clear-history').disabled,
  viewing: window.__falconTest.getViewingSession(),
  liveStillThere: localStorage.getItem('falcon:session:' + sid) !== null,
  histA: localStorage.getItem('falcon:session:20260101100000-1'),
  histB: localStorage.getItem('falcon:session:20260102110000-1'),
}), await page.evaluate(() => window.__falconTest.getSessionId()));
console.log('after clear:', JSON.stringify(after));
ck(after.options.length === 1 && after.options[0] === '', `only "Current session" remains in the combo (got ${JSON.stringify(after.options)})`);
ck(after.btnDisabled === true, 'the button disables itself once there is nothing left to clear');
ck(after.viewing === null, 'viewing snaps back to the live session, not a now-deleted one');
ck(after.liveStillThere, 'the LIVE session survives — this only clears history');
ck(after.histA === null && after.histB === null, 'both historic sessions were deleted');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
