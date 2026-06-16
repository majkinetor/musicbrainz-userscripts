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
const pdfCards = await page.$$eval('#as-root .as-card', els => els.filter(c => c.querySelector('.as-pdfban')).map(c => c.dataset.id));
console.log('cards with PDF badge:', pdfCards.length, pdfCards);
// click the PDF card image -> should open a new tab to the .pdf
await page.evaluate(() => { window.__open = []; const o = window.open; window.open = (u, ...r) => { window.__open.push(u); return null; }; });
await page.click(`#as-root .as-card[data-id="${pdfCards[0]}"] .as-thumb img`);
await page.waitForTimeout(300);
const opened = await page.evaluate(() => window.__open);
console.log('window.open called with:', JSON.stringify(opened), '| ends .pdf:', opened[0] ? /\.pdf/i.test(opened[0]) : false);
await ctx.close();
