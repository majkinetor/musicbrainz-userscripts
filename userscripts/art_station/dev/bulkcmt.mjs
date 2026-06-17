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
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
await page.click('#as-root .as-selall');                 // select all
await page.waitForTimeout(150);
await page.click('#as-root .as-bk-cmt');                  // open the bulk comment popover
await page.waitForTimeout(150);
const popOpen = await page.$('.as-cmt-pop') ? 'yes' : 'no';
await page.fill('.as-bulk-cmt', 'from a tape rip');
await page.click('.as-cmt-pop .as-pop-apply');
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#as-root .as-grid .as-card:not(.del)')];
  const comments = cards.map(c => c.querySelector('.as-cmt-text')?.textContent || '');
  return { n: cards.length, allSet: comments.every(t => t === 'from a tape rip'), sample: comments.slice(0, 3) };
});
console.log('[bulkcmt] popover opened:', popOpen, '| covers:', res.n, '| all got comment:', res.allSet, '| sample:', JSON.stringify(res.sample));
// take a screenshot of the toolbar with the popover (re-open)
await page.click('#as-root .as-bk-cmt'); await page.waitForTimeout(200);
const pop = await page.$('.as-cmt-pop'); const pb = await pop.boundingBox();
const bar = await (await page.$('#as-root .as-bar')).boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/bulkcmt.png', clip: { x: bar.x, y: bar.y, width: bar.width, height: (pb.y + pb.height) - bar.y + 8 } });
console.log('shot saved');
await ctx.close();
