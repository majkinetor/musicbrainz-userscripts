import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = process.argv[2] || '6bf7a85c-330b-4d8d-bd0d-a33759a5cfb9';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
const cards = await page.$$eval('#as-root .as-card', els => els.map(c => ({
  types: [...c.querySelectorAll('.as-types .as-chip:not(.as-addtype)')].map(x => x.textContent.replace('▾','').trim()),
  pending: c.classList.contains('pending'),
  pendBadge: !!c.querySelector('.as-pendban'),
  comment: c.querySelector('.as-cmt')?.value ?? (c.querySelector('.as-pencil') ? '(none)' : '(?)'),
})));
console.log('cards:', JSON.stringify(cards, null, 2));
console.log('any bogus "-..." type chip:', cards.some(c => c.types.some(t => t.startsWith('-'))));
await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(200);
await page.screenshot({ path: 'userscripts/art_station/poc-parsefix.png' });
await ctx.close();
