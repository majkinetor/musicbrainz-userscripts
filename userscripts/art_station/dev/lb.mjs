import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(4000);
await page.click('.as-card:not(.del) .as-thumb img');
// right after open: should be loading (hidden)
await page.waitForTimeout(30);
const justOpened = await page.$eval('.as-lb-img', el => ({ loading: el.classList.contains('loading'), opacity: getComputedStyle(el).opacity }));
// after load: visible
await page.waitForTimeout(2500);
const afterLoad = await page.$eval('.as-lb-img', el => ({ loading: el.classList.contains('loading'), opacity: getComputedStyle(el).opacity, nw: el.naturalWidth }));
console.log('just opened:', JSON.stringify(justOpened));
console.log('after load :', JSON.stringify(afterLoad));
await ctx.close();
