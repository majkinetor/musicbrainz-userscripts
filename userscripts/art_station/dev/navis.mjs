import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 700, height: 700 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
// force NA on the first card's thumb
await page.evaluate(() => { const img = document.querySelector('#as-root .as-card .as-thumb img'); img.src = 'https://coverartarchive.org/release/x/nope.jpg'; });
await page.waitForTimeout(1200);
const card = (await page.$$('#as-root .as-card'))[0];
await card.screenshot({ path: 'userscripts/art_station/poc-na.png' });
console.log('na class:', await page.evaluate(() => document.querySelector('#as-root .as-thumb').classList.contains('na')));
await ctx.close();
