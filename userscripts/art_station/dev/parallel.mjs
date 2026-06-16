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
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(200);
// stage type changes on two non-PDF cards
for (const n of [1, 2]) {
  await page.click(`#as-root .as-grid .as-card:nth-of-type(${n}) .as-addtype`);
  await page.waitForTimeout(150);
  await page.click('.as-pop input[value="Tray"]');
  await page.waitForTimeout(150);
  await page.mouse.click(5,5); await page.waitForTimeout(150);
}
await page.click('.as-commit'); await page.waitForTimeout(200);
const t0 = Date.now();
await page.click('.as-cm-go');
await page.waitForFunction(() => [...document.querySelectorAll('.as-cm-st')].every(s => !/[⏳○]/.test(s.textContent)), { timeout: 15000 });
const dt = Date.now() - t0;
const sts = await page.$$eval('.as-cm-op', els => els.map(e => ({ lb: e.querySelector('.as-cm-lb').textContent, st: e.querySelector('.as-cm-st').textContent.trim() })));
console.log('ops:', JSON.stringify(sts));
console.log('all viewed (👁):', sts.every(s => s.st === '👁'), '| elapsed ms:', dt);
await ctx.close();
