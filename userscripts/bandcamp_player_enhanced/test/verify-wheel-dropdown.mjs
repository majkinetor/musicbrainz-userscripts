// The bar's own wheel handler hijacks scroll anywhere over it for seek (deliberately, so you
// can scrub without touching the seek bar) — but that included the track dropdown once it was
// open, since it's a DOM child of the bar even though position:fixed renders it elsewhere.
// Scrolling the (potentially long) track list was impossible; every wheel tick seeked instead.
// Fix: the wheel handler now checks whether the event target is inside an OPEN #bcp-dropdown
// and, if so, lets the browser scroll it natively instead of seeking.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'bandcamp_player_enhanced.user.js'), 'utf8');

const ALBUM_URL = 'https://phoebebridgers.bandcamp.com/album/punisher';   // 11 tracks — dropdown is scrollable
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// #501: GM_getValue/GM_setValue mock backed by real (namespaced) localStorage.
await page.addInitScript(() => {
    window.GM_getValue = (k, d) => { const v = localStorage.getItem('__gm__' + k); return v === null ? d : v; };
    window.GM_setValue = (k, v) => { localStorage.setItem('__gm__' + k, v); };
    window.GM_deleteValue = k => localStorage.removeItem('__gm__' + k);
});

await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);

// 1) wheel over the BAR itself (dropdown closed) still seeks, as before
const timeBefore = await page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);
const barBox = await page.locator('#bcp-time').boundingBox();
await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
await page.mouse.wheel(0, -100);   // scroll up = forward 5s
await page.waitForTimeout(200);
const timeAfterBarWheel = await page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);
console.log('audio time before/after wheel over bar:', timeBefore, timeAfterBarWheel);
ck(timeAfterBarWheel - timeBefore >= 3, `wheel over the bar (dropdown closed) still seeks forward ~5s (${timeBefore} -> ${timeAfterBarWheel})`);

// 2) open the track dropdown, wheel directly over it — must scroll the list, not seek
await page.click('#bcp-info');
await page.waitForTimeout(200);
const ddOpen = await page.evaluate(() => document.getElementById('bcp-dropdown').classList.contains('open'));
ck(ddOpen === true, 'track dropdown opens');

const ddBox = await page.locator('#bcp-dropdown').boundingBox();
await page.mouse.move(ddBox.x + ddBox.width / 2, ddBox.y + Math.min(40, ddBox.height / 2));
const scrollBefore = await page.evaluate(() => document.getElementById('bcp-dropdown').scrollTop);
const timeBeforeDropdownWheel = await page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(200);
const scrollAfter = await page.evaluate(() => document.getElementById('bcp-dropdown').scrollTop);
const timeAfterDropdownWheel = await page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);
console.log('dropdown scrollTop before/after wheel over it:', scrollBefore, scrollAfter);
console.log('audio time before/after wheel over dropdown:', timeBeforeDropdownWheel, timeAfterDropdownWheel);
ck(scrollAfter > scrollBefore, `wheel over the OPEN dropdown scrolls its list (${scrollBefore} -> ${scrollAfter})`);
ck(Math.abs(timeAfterDropdownWheel - timeBeforeDropdownWheel) < 1, `wheel over the dropdown does NOT also seek the track (${timeBeforeDropdownWheel} -> ${timeAfterDropdownWheel})`);

const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
