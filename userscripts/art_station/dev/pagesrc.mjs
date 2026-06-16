import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = process.argv[2] || '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
const info = await page.evaluate(() => ({
  nativeBlocks: document.querySelectorAll('.artwork-cont').length,
  cards: document.querySelectorAll('#as-root .as-card').length,
  fit: getComputedStyle(document.querySelector('#as-root .as-thumb img')).objectFit,
}));
console.log('native artwork blocks:', info.nativeBlocks, '| Art Station cards:', info.cards, '| match:', info.nativeBlocks === info.cards);
console.log('thumb object-fit:', info.fit);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: 'userscripts/art_station/poc-pagesrc.png' });
await ctx.close();
