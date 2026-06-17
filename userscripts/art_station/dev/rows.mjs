import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g && g.checked) g.click(); });
await page.evaluate(() => { const s = document.querySelector('.as-size'); if (s) { s.value = 200; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); } });
await page.waitForTimeout(400);
// capture two full rows of the grid
const grid = await page.$('#as-root .as-grid');
const box = await grid.boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/rows.png', clip: { x: box.x - 4, y: box.y - 4, width: Math.min(box.width + 8, 1000), height: 560 } });
console.log('shot saved');
await ctx.close();
