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
const total = (await page.$$('.as-card:not(.del)')).length;
console.log('label before:', (await page.$eval('.as-selall', e => e.textContent)).trim());
await page.click('.as-selall');
await page.waitForTimeout(300);
const selCount = (await page.$$('.as-card.sel')).length;
const bulk = await page.$('.as-bulk');
console.log('after Select all → selected:', selCount, '/', total, '| bulk bar:', !!bulk, '| label:', (await page.$eval('.as-selall', e => e.textContent)).trim());
await page.click('.as-selall');
await page.waitForTimeout(300);
console.log('after toggle → selected:', (await page.$$('.as-card.sel')).length, '| label:', (await page.$eval('.as-selall', e => e.textContent)).trim());
await ctx.close();
