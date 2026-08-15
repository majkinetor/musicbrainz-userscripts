// #512 follow-up (majkinetor, live): "those 2 errors appear in all logs and
// are not actually any errors, so we should skip them" — every plain tab
// close/reload logs a "THIS TAB IS BEING UNLOADED" line at ERROR, even when
// the run had already finished cleanly (the overwhelmingly common case).
// ERROR is still correct for the genuinely rare case this was built to catch
// — a navigation stealing the tab MID-run — so the level now follows `busy`,
// same signal noteUnload() already computes for the message's own wording.
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
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

// 1. queue is empty/settled — an unload here is the ordinary "closed the tab
// after everything finished" case. Should log at INFO, no "Report this line".
await page.evaluate(() => { window.__falconTest.setQueue([]); window.__falconTest.noteUnload(); });
const idleLine = await page.evaluate(() => window.__falconTest.getLog().find(l => l.includes('THIS TAB IS BEING UNLOADED')));
console.log('idle unload line:', idleLine);
ck(/^\[\d\d:\d\d:\d\d\] INFO /.test(idleLine), `logs at INFO when nothing was in flight (got "${idleLine}")`);
ck(idleLine.includes('after the run finished'), 'still says which case it was');
ck(!idleLine.includes('Report this line'), 'does not ask him to report an expected, benign unload');

// 2. a genuinely mid-run unload (work still queued/active) stays ERROR.
await page.evaluate(() => {
  window.__falconTest.setQueue([{ id: 'x1', entityType: 'artist', mbid: 'aaaaaaaa-5120-0000-0000-000000000099', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' }]);
  window.__falconTest.noteUnload();
});
const log2 = await page.evaluate(() => window.__falconTest.getLog());
const busyLine = log2.slice().reverse().find(l => l.includes('THIS TAB IS BEING UNLOADED'));
console.log('mid-run unload line:', busyLine);
ck(/^\[\d\d:\d\d:\d\d\] ERROR /.test(busyLine), `stays ERROR when work was still in flight (got "${busyLine}")`);
ck(busyLine.includes('MID-RUN') && busyLine.includes('Report this line'), 'keeps the MID-RUN wording and the report ask — this IS the real symptom to catch');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
