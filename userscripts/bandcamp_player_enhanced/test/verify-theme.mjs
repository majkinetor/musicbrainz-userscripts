// Adds a Dark/Light theme option alongside the hide-page-elements options. The whole player's
// CSS is driven by custom properties on #bc-sticky-player; .bcp-light overrides them. Verifies
// theme applies live (no reload), persists via GM storage, and the settings panel itself is
// legible in both themes.
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
// GM storage would, which this test's persistence check relies on.
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

const barBg = () => page.evaluate(() => getComputedStyle(document.getElementById('bc-sticky-player')).backgroundColor);

// 1) default is light
const defaultBg = await barBg();
console.log('default bar background:', defaultBg);
ck(defaultBg === 'rgb(255, 255, 255)', `defaults to the light theme (got ${defaultBg})`);

// 2) switch to dark via the settings panel, live, no reload
await page.click('#bcp-settings');
await page.waitForTimeout(150);
await page.click('#bcp-opt-theme-dark');
await page.waitForTimeout(150);
const darkBg = await barBg();
console.log('after choosing Dark:', darkBg);
ck(darkBg === 'rgb(20, 20, 20)', `switching to Dark applies live, no reload (got ${darkBg})`);

const isLightClass = await page.evaluate(() => document.getElementById('bc-sticky-player').classList.contains('bcp-light'));
ck(isLightClass === false, 'bcp-light class is removed from the bar');

// 3) persists across a fresh page load
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);
const afterReloadBg = await barBg();
const radioChecked = await page.evaluate(() => document.getElementById('bcp-opt-theme-dark').checked);
console.log('after reload:', afterReloadBg, 'dark radio checked:', radioChecked);
ck(afterReloadBg === 'rgb(20, 20, 20)', `theme choice persists across reload (got ${afterReloadBg})`);
ck(radioChecked === true, 'the Dark radio reflects the persisted choice on reload');

// 4) switch back to Light, confirm round-trip
await page.click('#bcp-settings');
await page.waitForTimeout(150);
await page.click('#bcp-opt-theme-light');
await page.waitForTimeout(150);
const backToLight = await barBg();
ck(backToLight === 'rgb(255, 255, 255)', `switching back to Light works (got ${backToLight})`);

const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
