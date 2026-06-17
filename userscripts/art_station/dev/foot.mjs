import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 3,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
// position view (ungroup)
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g && g.checked) g.click(); });
await page.waitForTimeout(300);
// shrink tiles so several cards fit the clip
await page.evaluate(() => { const s = document.querySelector('.as-size'); if (s) { s.value = 210; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); } });
await page.waitForTimeout(300);
// put a comment on the first card to show row 2
await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card .as-pencil')?.click());
await page.waitForTimeout(200);
await page.fill('#as-root .as-grid .as-card:first-of-type .as-cmt', 'gatefold inner sleeve');
await page.click('#as-root .as-bar'); // blur
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#as-root .as-grid .as-card')].slice(0, 4);
  return cards.map(c => ({
    type: c.querySelector('.as-type')?.textContent || '(none)',
    dim: c.querySelector('.as-dim')?.textContent,
    cmt: c.querySelector('.as-cmt-text')?.textContent || '',
    dimOverImage: !!c.querySelector('.as-thumb .as-dim'),
  }));
});
console.log(JSON.stringify(info, null, 1));
const grid = await page.$('#as-root .as-grid');
const box = await grid.boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/foot.png', clip: { x: box.x, y: box.y, width: Math.min(box.width, 820), height: 430 } });
console.log('shot saved');
await ctx.close();
