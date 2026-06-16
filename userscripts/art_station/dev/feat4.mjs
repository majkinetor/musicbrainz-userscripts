import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
// ungroup + sort by type
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(200);
await page.selectOption('.as-sort', 'bytype');
await page.waitForTimeout(300);
const typeOrder = await page.$$eval('#as-root .as-grid .as-card', els => els.map(c => c.querySelector('.as-chip:not(.as-addtype)')?.textContent.trim() || '-'));
console.log('[#4 sort by type] order:', JSON.stringify(typeOrder));

// open lightbox on a non-PDF card; check play button + comment field
await page.click('#as-root .as-card:not(:has(.as-pdfban)) .as-thumb img');
await page.waitForTimeout(800);
const lb = await page.evaluate(() => ({
  open: getComputedStyle(document.getElementById('as-lb')).display,
  play: !!document.querySelector('.as-lb-play'),
  cmt: !!document.querySelector('.as-lb-cmt'),
}));
console.log('[#2/#3] lightbox open:', lb.open, '| play btn:', lb.play, '| comment field:', lb.cmt);
// edit comment in lightbox
await page.fill('.as-lb-cmt', 'edited in fullscreen');
await page.waitForTimeout(150);
// play toggle
await page.click('.as-lb-play');
const playing = await page.$eval('.as-lb-play', e => e.textContent.trim());
console.log('[#3 play] after click label:', playing);
await page.click('.as-lb-play'); // stop
// close -> comment should reflect in grid
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const gridCmt = await page.$$eval('#as-root .as-cmt', els => els.map(i => i.value).filter(v => v.includes('fullscreen')));
console.log('[#2 comment] reflected in grid:', JSON.stringify(gridCmt));
await ctx.close();
