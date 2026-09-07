// #578 live proof. verify-578-picard-port.mjs asserts the parameter, the stored
// port and the options UI, but deliberately stopped short of the one line that
// concatenates them inside sendToFalcon, because that needs a real Harmony
// actions page. majkinetor then reported the feature "not working", so that gap
// is exactly where the doubt lived and guessing at it was not good enough.
//
// This drives the REAL Harmony release-actions page, with GM_openInTab stubbed,
// and reads the URL Falcon would have opened. It is a `live-` test because it
// depends on a third party being up; treat a network failure as inconclusive,
// not as a regression.
//
// Read-only on both sites: every POST is aborted.
//
// Run: node test/live-578-picard-harmony-proof.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
// majkinetor's own release from the issue, so the proof is about the case he reported
const R = '79e909b1-9320-4483-806b-33a899c01193';
const log = (...a) => console.log('[live-578]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  window.__opened = [];
  window.GM_openInTab = (u) => { window.__opened.push(String(u)); return { close() {} }; };
});
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));

try {
  await page.goto(`https://harmony.pulsewidth.org.uk/release/actions?release_mbid=${R}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
} catch (e) {
  console.log('INCONCLUSIVE: Harmony did not load —', e.message.split('\n')[0]);
  await browser.close(); process.exit(2);
}
await page.waitForTimeout(6000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 20000 });
await page.waitForTimeout(4000);

const mbid = await page.evaluate(() => window.__falconTest.harmonyReleaseMbid());
log('release mbid Falcon reads off the page:', mbid);
ck(mbid === R, `Falcon finds the release mbid on the actions page (got ${mbid})`);

const send = enable => page.evaluate(async (on) => {
  const { cfg, sendToFalcon } = window.__falconTest;
  cfg.sendToPicard = on; cfg.picardPort = 8000;
  window.__opened.length = 0;
  await sendToFalcon(false);
  return window.__opened[0] || null;
}, enable);

const off = await send(false);
const on = await send(true);
log('option off →', off);
log('option on  →', on);
ck(off && !/tport/.test(off), `with the option off the URL is untouched (got ${off})`);
ck(on === `https://musicbrainz.org/release/${R}?${on.split('?')[1]}` && /[?&]tport=8000(&|$)/.test(on),
  `with it on the opened URL carries &tport=8000 (got ${on})`);
ck(on && on.startsWith(`https://musicbrainz.org/release/${R}?falcon=`), 'it is still the release page with the queue token, not a different URL');

// …and that URL really does make MusicBrainz render the tagger button. Checked in
// a CLEAN context: a logged-in session remembers a tport from earlier, so testing
// this on a profile that has ever used Picard proves nothing.
const clean = await chromium.launch();
const cp = await clean.newPage();
const seen = {};
for (const [k, u] of [['without', `https://musicbrainz.org/release/${R}`], ['with', on]]) {
  await cp.goto(u, { waitUntil: 'domcontentloaded' });
  await cp.waitForTimeout(2500);
  seen[k] = await cp.evaluate(() => { const a = document.querySelector('a[href*="openalbum"]'); return a ? a.getAttribute('href') : null; });
}
await clean.close();
log('tagger link seen:', JSON.stringify(seen));
ck(seen.without === null, 'the fixture reproduces: no tagger button without the parameter');
ck(seen.with === `http://127.0.0.1:8000/openalbum?id=${R}`,
  `and the exact button majkinetor showed appears with it (got ${seen.with})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
