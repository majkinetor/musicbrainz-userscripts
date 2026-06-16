import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');

const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(4000);
console.log('card count:', (await page.$$('.as-card:not(.del)')).length);

// right-click two cards → selection + bulk bar (re-query: render() rebuilds DOM)
await (await page.$$('.as-card:not(.del)'))[2].click({ button: 'right' });
await page.waitForTimeout(200);
await (await page.$$('.as-card:not(.del)'))[4].click({ button: 'right' });
await page.waitForTimeout(300);
const bulk = await page.$('.as-bulk');
const selCount = await page.$$eval('.as-card.sel', els => els.length);
console.log('bulk bar present:', !!bulk, '| selected cards:', selCount);

await page.screenshot({ path: 'userscripts/art_station/poc-select.png' });

// open bulk type pop
await page.click('.as-bk-type');
await page.waitForTimeout(200);
console.log('bulk type pop:', !!(await page.$('.as-pop')));
await page.mouse.click(5, 5); // dismiss pop via outside mousedown
await page.waitForTimeout(200);

// click an image → lightbox
await page.click('.as-card:not(.del):not(.sel) .as-thumb img');
await page.waitForTimeout(500);
const lbVisible = await page.$eval('#as-lb', el => getComputedStyle(el).display);
console.log('lightbox display:', lbVisible);
await page.screenshot({ path: 'userscripts/art_station/poc-lightbox.png' });

// arrow nav within lightbox
const before = await page.$eval('.as-lb-img', el => el.src);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const after = await page.$eval('.as-lb-img', el => el.src);
console.log('lightbox arrow changed image:', before !== after);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
console.log('lightbox closed:', (await page.$eval('#as-lb', el => getComputedStyle(el).display)) === 'none');

await ctx.close();
