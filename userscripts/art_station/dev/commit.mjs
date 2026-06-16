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

// stage a REMOVE on card 0 (right-click select → bulk delete)
const c0 = (await page.$$('.as-card:not(.del)'))[0];
const box = await c0.boundingBox();
await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
await page.waitForTimeout(150);
await page.click('.as-bk-rm');
await page.waitForTimeout(200);

// stage a RETYPE on a card: open its + chip, check "Back"
await page.click('.as-card:not(.del) .as-addtype');
await page.waitForTimeout(150);
await page.click('.as-pop input[value="Back"]');
await page.waitForTimeout(300);

// open Enter edit, run dry-run
await page.click('.as-commit');
await page.waitForTimeout(200);
console.log('panel ops:', await page.$$eval('.as-cm-op .as-cm-lb', els => els.map(e => e.textContent)));
await page.click('.as-cm-go'); // dry run (default checked)
await page.waitForTimeout(2500);
const payloads = await page.$$eval('.as-cm-op', els => els.map(e => ({
  label: e.querySelector('.as-cm-lb').textContent,
  status: e.querySelector('.as-cm-st').textContent,
  payload: e.querySelector('.as-cm-payload').textContent,
})));
for (const p of payloads) { console.log(`\n=== ${p.status} ${p.label} ===\n${p.payload}`); }
await ctx.close();
