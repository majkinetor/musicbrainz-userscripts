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
// scroll a bit so a mid-page card is in view, hover it to reveal pencil, click it
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(200);
const before = await page.evaluate(() => window.scrollY);
const card = (await page.$$('.as-card:not(.del)'))[5];
await card.hover();
await page.waitForTimeout(150);
await page.click('.as-card:not(.del):nth-of-type(6) .as-pencil', { force: true }).catch(async () => {
  // fallback: dispatch click on the 6th card's pencil
  await page.evaluate(() => document.querySelectorAll('.as-card:not(.del)')[5].querySelector('.as-pencil')?.click());
});
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.scrollY);
const inputFocused = await page.evaluate(() => document.activeElement?.classList.contains('as-cmt'));
console.log('scrollY before:', before, '| after:', after, '| delta:', after - before, '| input focused:', inputFocused);
await ctx.close();
