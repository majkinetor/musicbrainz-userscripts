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
await page.waitForTimeout(300);

// --- comment display: set a comment, blur, expect centered text (not input) ---
await page.click('#as-root .as-grid .as-card:first-of-type .as-pencil', { force: true }).catch(async () => {
  await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card .as-pencil')?.click());
});
await page.waitForTimeout(200);
await page.fill('#as-root .as-grid .as-card:first-of-type .as-cmt', 'sleeve note');
await page.click('#as-root .as-bar'); // blur
await page.waitForTimeout(300);
const cmt = await page.evaluate(() => {
  const c = document.querySelector('#as-root .as-grid .as-card:first-of-type');
  return { text: c.querySelector('.as-cmt-text')?.textContent, hasInput: !!c.querySelector('.as-cmt'), centered: c.querySelector('.as-cmt-text') ? getComputedStyle(c.querySelector('.as-cmt-text')).textAlign : null };
});
console.log('[comment] text:', JSON.stringify(cmt.text), '| input hidden:', !cmt.hasInput, '| centered:', cmt.centered);
// click text -> becomes input focused
await page.click('#as-root .as-grid .as-card:first-of-type .as-cmt-text');
await page.waitForTimeout(200);
console.log('[comment] click text -> input focused:', await page.evaluate(() => document.activeElement?.classList.contains('as-cmt')));
await page.keyboard.press('Escape'); await page.click('#as-root .as-bar'); await page.waitForTimeout(200);

// --- commit panel: dry-run unchecked + in footer, no hint ---
await page.click('.as-commit'); await page.waitForTimeout(250);
const panel = await page.evaluate(() => ({
  dryChecked: document.querySelector('.as-cm-dryrun')?.checked,
  dryInFooter: !!document.querySelector('.as-cm-f .as-cm-dryrun'),
  goLabel: document.querySelector('.as-cm-go')?.textContent,
  hint: !!document.querySelector('.as-cm-hint'),
}));
console.log('[panel] dry default:', panel.dryChecked, '(expect false) | dry in footer:', panel.dryInFooter, '| button:', JSON.stringify(panel.goLabel), '| hint removed:', !panel.hint);
await page.keyboard.press('Escape'); await page.click('body'); await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('as-commit')?.remove());

// --- wheel zoom in lightbox, page must not scroll ---
await page.click('#as-root .as-card:not(.del) .as-thumb');
await page.waitForTimeout(1500);
const beforeScroll = await page.evaluate(() => window.scrollY);
await page.evaluate(() => { const ov = document.getElementById('as-lb'); const r = ov.getBoundingClientRect(); ov.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: r.width/2, clientY: r.height/2, bubbles: true, cancelable: true })); });
await page.waitForTimeout(150);
const z = await page.evaluate(() => { const i = document.querySelector('.as-lb-img'); return { transform: i.style.transform, scrollY: window.scrollY }; });
console.log('[zoom] transform after wheel:', z.transform || '(none)', '| page scrolled:', z.scrollY !== beforeScroll);
await ctx.close();
