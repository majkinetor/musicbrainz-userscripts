// The bar-wide wheel-to-seek handler used to hijack scrolling over the volume slider too,
// making it impossible to adjust volume with the wheel while hovering it (you'd seek the
// track instead). Wheel over .bcp-vol-wrap now adjusts volume by VOL_STEP per tick instead.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'bandcamp_player_enhanced.user.js'), 'utf8');

const ALBUM_URL = 'https://phoebebridgers.bandcamp.com/album/punisher';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// #501: GM_getValue/GM_setValue mock backed by real (namespaced) localStorage —
// unlike an in-page Map, this survives a real page.reload() the same way actual
// GM storage would.
await page.addInitScript(() => {
    window.GM_getValue = (k, d) => { const v = localStorage.getItem('__gm__' + k); return v === null ? d : v; };
    window.GM_setValue = (k, v) => { localStorage.setItem('__gm__' + k, v); };
    window.GM_deleteValue = k => localStorage.removeItem('__gm__' + k);
});

// Pin a known starting volume BEFORE the script ever runs — matching a real
// user who already has a saved preference on their first visit this tab.
// #511: loadVol() deliberately prefers sessionStorage (same-tab, most recent)
// over the GM-stored default — injecting the (unseeded) script once, THEN
// seeding GM and reloading to inject a second time, has the first injection's
// own volume-restore write a default into sessionStorage that then survives
// the reload and shadows the freshly-seeded GM value — a double-injection
// test artifact, not something a real single page visit would ever hit.
await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.evaluate(() => { localStorage.setItem('__gm__bcp_volume', '0.5'); localStorage.setItem('__gm__bcp_muted', '0'); });
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);

const volValue = () => page.evaluate(() => parseFloat(document.getElementById('bcp-vol').value));
const audioTime = () => page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);

const volBefore = await volValue();
const timeBefore = await audioTime();
console.log('before: vol =', volBefore, 'time =', timeBefore);

// wheel UP over the volume control (deltaY < 0) — should INCREASE volume, not seek
const volBox = await page.locator('.bcp-vol-wrap').boundingBox();
await page.mouse.move(volBox.x + volBox.width / 2, volBox.y + volBox.height / 2);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(200);
const volAfterUp = await volValue();
const timeAfterUp = await audioTime();
console.log('after wheel-up over volume: vol =', volAfterUp, 'time =', timeAfterUp);
ck(volAfterUp > volBefore, `wheel up over the volume control increases volume (${volBefore} -> ${volAfterUp})`);
ck(Math.abs(timeAfterUp - timeBefore) < 1, `wheel over the volume control does NOT also seek (${timeBefore} -> ${timeAfterUp})`);

// wheel DOWN over the volume control — should decrease it back down
await page.mouse.wheel(0, 100);
await page.mouse.wheel(0, 100);
await page.waitForTimeout(200);
const volAfterDown = await volValue();
console.log('after 2x wheel-down over volume:', volAfterDown);
ck(volAfterDown < volAfterUp, `wheel down over the volume control decreases volume (${volAfterUp} -> ${volAfterDown})`);

// sanity: wheel over the REST of the bar (not the volume control) still seeks, unaffected
const timeBeforeBarWheel = await audioTime();
const timeBox = await page.locator('#bcp-time').boundingBox();
await page.mouse.move(timeBox.x + timeBox.width / 2, timeBox.y + timeBox.height / 2);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(200);
const timeAfterBarWheel = await audioTime();
console.log('wheel over #bcp-time (not volume):', timeBeforeBarWheel, '->', timeAfterBarWheel);
ck(timeAfterBarWheel - timeBeforeBarWheel >= 3, `wheel elsewhere on the bar still seeks, unaffected by this change (${timeBeforeBarWheel} -> ${timeAfterBarWheel})`);

const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
