// #420 — right-clicking the TRACK title in the recordings table (copy title from
// recording) must clear a pending rename-recording flag (green tc-copy indicator):
// the titles are now equal, so the rename is moot.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const MBID = 'df1ef70d-6a4d-479d-b952-c04a643199aa';   // the release from the issue
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, bypassCSP: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor', { timeout: 40000 });
await page.waitForTimeout(4000);
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);

// 1. Change track 1's title so it differs from its recording (the tracklist wizard
// page may be hidden — drive the KO binding with raw events, visibility-independent)
await page.waitForSelector('input.track-name', { state: 'attached', timeout: 30000 });
await page.evaluate(() => {
  const inp = document.querySelector('input.track-name');
  inp.value = inp.value + ' XX420';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(800);

// 2. Recordings page (Apollo's compact-nav wizard button, falling back to MB's tab link)
const nav = await page.$$('#tc-nav-wiz .tc-nav-wbtn, .tc-nav-wbtn');
let clicked = false;
for (const b of nav) { if (/recordings/i.test(await b.textContent() || '')) { await b.click(); clicked = true; break; } }
if (!clicked) { for (const a of await page.$$('a, button')) { if (/^recordings$/i.test((await a.textContent() || '').trim())) { await a.click(); break; } } }
await page.waitForSelector('tr.tc-recrow td.tc-recname', { timeout: 30000 });
await page.waitForTimeout(1500);

const row = 'tr.tc-recrow:first-child';
const state = async () => page.evaluate(sel => {
  const tr = document.querySelector(sel);
  return {
    track: tr.querySelector('td.tc-tkt')?.textContent.trim(),
    recCls: tr.querySelector('td.tc-recname')?.className || '',
  };
}, row);

const s0 = await state();
// 3. right-click the RECORDING title → toggles the rename flag ON (green tc-copy)
await page.click(`${row} td.tc-recname`, { button: 'right' });
await page.waitForTimeout(600);
const s1 = await state();
// 4. right-click the TRACK title → copy title back from the recording; flag must CLEAR (#420)
await page.click(`${row} td.tc-tkt`, { button: 'right' });
await page.waitForTimeout(600);
const s2 = await state();

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify({ s0, s1, s2 }, null, 1));
ck(/XX420/.test(s0.track), 'track title modified (differs from recording)');
ck(!/tc-copy/.test(s0.recCls), 'rename flag initially off');
ck(/tc-copy/.test(s1.recCls), 'right-click recording title → rename flag ON (green)');
ck(!/XX420/.test(s2.track), 'right-click track title → title copied back from recording');
ck(!/tc-copy/.test(s2.recCls), 'rename flag CLEARED after the copy (#420 fix)');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
