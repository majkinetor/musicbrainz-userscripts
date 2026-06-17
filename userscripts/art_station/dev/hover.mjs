import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
// make a change so Enter edit is enabled
await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card .as-pencil')?.click());
await page.waitForTimeout(120); await page.keyboard.type('x'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
const rgb = s => { const m = s.match(/\d+/g); return m ? m.slice(0,3).join(',') : s; };
await page.hover('#as-root .as-commit');
await page.waitForTimeout(120);
const commit = await page.evaluate(() => { const b = document.querySelector('#as-root .as-commit'); const c = getComputedStyle(b); return { bg: c.backgroundColor, color: c.color }; });
console.log('[Enter edit hover] bg:', rgb(commit.bg), 'color:', rgb(commit.color), '(want dark bg ~78,50,159 + white text 255,255,255)');
// type pop apply hover
await page.click('#as-root .as-selall'); await page.waitForTimeout(120);
await page.click('#as-root .as-bk-type'); await page.waitForTimeout(150);
// check at least one type so Apply is enabled-looking; hover it
await page.hover('.as-pop-apply');
await page.waitForTimeout(120);
const apply = await page.evaluate(() => { const b = document.querySelector('.as-pop-apply'); const c = getComputedStyle(b); return { bg: c.backgroundColor, color: c.color }; });
console.log('[Apply hover] bg:', rgb(apply.bg), 'color:', rgb(apply.color));
await ctx.close();
