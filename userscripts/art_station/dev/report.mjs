import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';   // Super Disco Pirata (the #239 example)
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3500);
// select first 2 covers by right-clicking them
for (const i of [0,1]) await page.evaluate((idx) => { const c = document.querySelectorAll('#as-root .as-grid .as-card')[idx]; const r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('mousedown', {button:2, bubbles:true})); }, i);
await page.waitForTimeout(200);
console.log('selected:', await page.evaluate(() => document.querySelector('#as-root .as-selcnt')?.textContent));
await page.click('#as-root .as-bk-report'); await page.waitForTimeout(300);
console.log('--- Markdown (inline, 250) ---');
console.log(await page.inputValue('.as-rp-out'));
await page.selectOption('.as-rp-layout', 'captioned'); await page.waitForTimeout(150);
console.log('--- Markdown (captioned) ---');
console.log(await page.inputValue('.as-rp-out'));
await page.selectOption('.as-rp-fmt', 'html'); await page.selectOption('.as-rp-layout', 'inline'); await page.selectOption('.as-rp-size','500'); await page.waitForTimeout(150);
console.log('--- HTML (inline, 500) ---');
console.log(await page.inputValue('.as-rp-out'));
const box = await page.$('#as-report .as-cm-box'); const bb = await box.boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/report.png', clip: { x: bb.x, y: bb.y, width: bb.width, height: bb.height } });
console.log('shot saved');
await ctx.close();
