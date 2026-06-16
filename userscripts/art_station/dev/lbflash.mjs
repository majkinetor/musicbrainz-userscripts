import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
await page.click('.as-card:not(.del) .as-thumb img');
await page.waitForTimeout(4000); // let first image load
const first = await page.$eval('.as-lb-img', e => ({ loading: e.classList.contains('loading'), vis: getComputedStyle(e).visibility, complete: e.complete, nw: e.naturalWidth }));
console.log('first image after 4s:', JSON.stringify(first));
const firstSrc = await page.$eval('.as-lb-img', e => e.currentSrc || e.src);
// navigate; immediately sample visibility + which src is showing
await page.keyboard.press('ArrowRight');
const sample = await page.evaluate(() => {
  const i = document.querySelector('.as-lb-img');
  return { loading: i.classList.contains('loading'), visibility: getComputedStyle(i).visibility };
});
await page.waitForTimeout(4000);
const afterSrc = await page.$eval('.as-lb-img', e => e.currentSrc || e.src);
const after = await page.$eval('.as-lb-img', e => ({ loading: e.classList.contains('loading'), vis: getComputedStyle(e).visibility, complete: e.complete, nw: e.naturalWidth }));
console.log('right after nav -> loading:', sample.loading, '| visibility:', sample.visibility);
console.log('src changed:', firstSrc !== afterSrc, '| after 4s:', JSON.stringify(after));
await ctx.close();
