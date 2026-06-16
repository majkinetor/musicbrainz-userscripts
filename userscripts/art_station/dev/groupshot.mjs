import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = process.argv[2] || '6bf7a85c-330b-4d8d-bd0d-a33759a5cfb9';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1100, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
// ensure grouped
const g0 = await page.evaluate(() => ({ checked: document.querySelector('.as-group')?.checked, cards: document.querySelectorAll('.as-card').length }));
console.log('group checkbox initially:', g0.checked, '| cards:', g0.cards);
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (!g.checked) g.click(); });
await page.waitForTimeout(500);
console.log('group rows:', await page.$$eval('.as-grow', e => e.length), '| sections:', await page.$$eval('.as-sec', e => e.length), '| now checked:', await page.evaluate(() => document.querySelector('.as-group').checked));
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
await page.screenshot({ path: 'userscripts/art_station/poc-group.png', fullPage: true });
await ctx.close();
