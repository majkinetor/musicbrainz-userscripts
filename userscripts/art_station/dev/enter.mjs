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
await page.waitForTimeout(3000);
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g && g.checked) g.click(); });
await page.evaluate(() => { const s = document.querySelector('.as-size'); if (s) { s.value = 160; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); } });
await page.waitForTimeout(300);

// === GALLERY: pencil on first card, type, Enter advances to next ===
await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card .as-pencil')?.click());
await page.waitForTimeout(150);
await page.keyboard.type('first');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const afterEnter1 = await page.evaluate(() => {
  const ae = document.activeElement;
  const card = ae?.closest?.('.as-card');
  const cards = [...document.querySelectorAll('#as-root .as-grid .as-card')];
  return { focusedIsCmt: ae?.classList?.contains('as-cmt'), focusedCardIdx: card ? cards.indexOf(card) : -1 };
});
await page.keyboard.type('second');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const result = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#as-root .as-grid .as-card')].slice(0, 3);
  return cards.map(c => c.querySelector('.as-cmt-text')?.textContent || c.querySelector('.as-cmt')?.value || '');
});
console.log('[gallery] after 1st Enter -> focused next comment input:', afterEnter1.focusedIsCmt, '| card idx:', afterEnter1.focusedCardIdx, '(expect 1)');
console.log('[gallery] comments after two Enters:', JSON.stringify(result), '(expect first, second, <editing/empty>)');

// === LIGHTBOX: open, add comment, Enter advances to next image keeping edit ===
await page.keyboard.press('Escape');
// open the lightbox on a card WITHOUT a comment (skip the first two we just edited)
await page.evaluate(() => document.querySelectorAll('#as-root .as-grid .as-card:not(.del) .as-thumb')[4]?.click());
await page.waitForTimeout(1200);
const addBtn = await page.$('.as-lb-cmtadd'); if (addBtn) await addBtn.click();
await page.waitForTimeout(150);
await page.click('.as-lb-cmt');
await page.keyboard.type('lb-note');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const lb = await page.evaluate(() => ({
  cmtInputFocused: document.activeElement?.classList?.contains('as-lb-cmt'),
  inputShown: !!document.querySelector('.as-lb-cmt'),
}));
console.log('[lightbox] after Enter -> moved to next image with comment input focused:', lb.cmtInputFocused, '| input shown:', lb.inputShown);
await ctx.close();
