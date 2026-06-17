import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
// put a comment on the first cover so the lightbox shows a comment
await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card .as-pencil')?.click());
await page.waitForTimeout(120); await page.keyboard.type('liner notes'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.click('#as-root .as-card:not(.del) .as-thumb'); await page.waitForTimeout(1200);
const scale = () => page.evaluate(() => { const t = document.querySelector('.as-lb-img')?.style.transform||''; const m=t.match(/scale\(([^)]+)\)/); return m?+m[1]:1; });
// comment shown as plain text (no input box) when not editing
const cmt0 = await page.evaluate(() => ({ text: document.querySelector('.as-lb-cmt-text')?.textContent, hasInput: !!document.querySelector('.as-lb-cmt'), bg: document.querySelector('.as-lb-cmt-text') ? getComputedStyle(document.querySelector('.as-lb-cmt-text')).backgroundColor : null }));
console.log('comment plain text:', JSON.stringify(cmt0.text), '| no input box:', !cmt0.hasInput, '| bg transparent:', cmt0.bg);
// zoom in, then navigate right — zoom should persist
await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(100);
const before = await scale();
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
const after = await scale();
console.log('zoom before nav:', before.toFixed(3), '| after nav (right):', after.toFixed(3), '| remembered:', Math.abs(before-after) < 0.001);
// fresh open resets
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.click('#as-root .as-card:not(.del) .as-thumb'); await page.waitForTimeout(800);
console.log('fresh open scale:', (await scale()).toFixed(3), '(want 1.000)');
await ctx.close();
