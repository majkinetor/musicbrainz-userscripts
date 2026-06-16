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
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);

console.log('Sort dropdown present:', !!(await page.$('.as-sort')));

// ungroup for Position view
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(300);

// Add → drop zone shows
await page.click('.as-add');
await page.waitForTimeout(200);
console.log('drop zone shown on Add:', !!(await page.$('.as-dropzone')));

// drop a file via the hidden picker path: use addFiles by setting input through click? use chooser on dropzone click
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.as-dropzone')]);
await chooser.setFiles('userscripts/art_station/poc-select.png');
await page.waitForTimeout(700);

// new cover should be FIRST card in Position view
const firstIsNew = await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card')?.classList.contains('new'));
console.log('new cover is first card:', firstIsNew);

// staged changes button + pending ops popover
const stagedTxt = await page.$eval('.as-staged', e => e.textContent.trim());
await page.click('.as-staged');
await page.waitForTimeout(200);
const ops = await page.$$eval('.as-op', els => els.map(e => e.textContent));
console.log('staged button:', JSON.stringify(stagedTxt));
console.log('pending ops:', JSON.stringify(ops));
await page.screenshot({ path: 'userscripts/art_station/poc-staged.png' });
await ctx.close();
