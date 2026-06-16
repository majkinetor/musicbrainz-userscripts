import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);

// add a new image
await page.click('.as-add');
await page.waitForTimeout(150);
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.as-dropzone')]);
await chooser.setFiles('userscripts/art_station/poc-select.png');
await page.waitForTimeout(600);
// set its type (＋) to Back and a comment via pencil
await page.click('.as-card.new .as-addtype');
await page.waitForTimeout(150);
await page.click('.as-pop input[value="Booklet"]');
await page.waitForTimeout(250);
await page.mouse.click(5, 5); // dismiss type popover
await page.waitForTimeout(200);
await page.click('.as-card.new .as-pencil');
await page.waitForTimeout(150);
await page.fill('.as-card.new .as-cmt', 'scanned insert');
await page.click('#as-root .as-bar'); // blur
await page.waitForTimeout(250);

// Enter edit → dry run
await page.click('.as-commit');
await page.waitForTimeout(200);
console.log('ops:', await page.$$eval('.as-cm-op .as-cm-lb', e => e.map(x => x.textContent)));
await page.click('.as-cm-go');
await page.waitForTimeout(2500);
const out = await page.$$eval('.as-cm-op', els => els.map(e => ({ st: e.querySelector('.as-cm-st').textContent, lb: e.querySelector('.as-cm-lb').textContent, pay: e.querySelector('.as-cm-payload').textContent })));
for (const o of out) console.log(`\n=== ${o.st} ${o.lb} ===\n${o.pay}`);
await ctx.close();
