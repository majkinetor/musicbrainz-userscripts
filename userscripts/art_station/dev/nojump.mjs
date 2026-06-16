import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(4000);

// 1) no-jump on select — right-click a card that is ALREADY in view (no Playwright auto-scroll)
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(200);
const cards = await page.$$('.as-card:not(.del)');
// find a card fully within the current viewport
let target = null;
for (const c of cards) { const b = await c.boundingBox(); if (b && b.y >= 0 && b.y + b.height <= 800) { target = c; break; } }
const before = await page.evaluate(() => window.scrollY);
await target.click({ button: 'right' });
await page.waitForTimeout(300);
const afterSel = await page.evaluate(() => window.scrollY);
console.log('[select] scroll delta (in-view card):', afterSel - before, '| bulk:', await page.$eval('.as-bulk', el => getComputedStyle(el).position));

// 2) new image goes to "New uploads" section at top + has .new class
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.as-add')]);
await chooser.setFiles('userscripts/art_station/poc-select.png');
await page.waitForTimeout(800);
const newInfo = await page.evaluate(() => {
  const secs = [...document.querySelectorAll('#as-root .as-sec h3')].map(h => h.textContent);
  const firstSec = secs[0];
  const newCard = document.querySelector('.as-card.new');
  return { firstSection: firstSec, newCardExists: !!newCard, newClass: newCard?.className.includes('new') };
});
console.log('[new] first section:', newInfo.firstSection, '| new card:', newInfo.newCardExists);

// 3) NA placeholder: point a card image at a bad url and fire error
const naShown = await page.evaluate(async () => {
  const img = document.querySelector('.as-card:not(.new) .as-thumb img');
  img.src = 'https://coverartarchive.org/release/zzz/doesnotexist.jpg';
  await new Promise(r => setTimeout(r, 1500));
  return img.closest('.as-thumb').classList.contains('na');
});
console.log('[na] placeholder shown on load error:', naShown);

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: 'userscripts/art_station/poc-final.png', fullPage: true });
await ctx.close();
