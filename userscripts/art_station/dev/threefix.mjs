import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1150, height: 1000 }, deviceScaleFactor: 1,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

// --- toolbar single row + no pending badge (16-cover release, has pending edits) ---
await page.goto('https://musicbrainz.org/release/51431e0c-fdae-41a9-b8ff-65364c600eb4/cover-art', { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
// stage a change so the "staged" button shows (the thing that caused the 2nd row)
await page.click('#as-root .as-card:not(.del) .as-addtype'); await page.waitForTimeout(150);
await page.click('.as-pop input[value="Tray"]'); await page.waitForTimeout(150);
await page.mouse.click(5,5); await page.waitForTimeout(250);
const bar = await page.evaluate(() => {
  const b = document.querySelector('.as-bar');
  const tops = [...b.children].map(c => c.offsetTop);
  return { oneRow: new Set(tops).size === 1, barHeight: b.offsetHeight, pendBadges: document.querySelectorAll('.as-pendban').length, pendingCards: document.querySelectorAll('.as-card.pending').length };
});
console.log('[toolbar] single row:', bar.oneRow, '| height:', bar.barHeight);
console.log('[pending] badges:', bar.pendBadges, '(expect 0) | tinted cards:', bar.pendingCards);

// --- pending cover opens original in lightbox (Wanted Reggae) ---
await page.goto('https://musicbrainz.org/release/01f17c95-b4d4-430a-b1af-bd6ba0b602fe/cover-art', { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
const naCard = await page.$('#as-root .as-thumb.na');
console.log('[pending] cover not on CAA yet:', !!naCard);
if (naCard) {
  await naCard.click(); // click the NA thumb container (img is display:none)
  await page.waitForTimeout(6000); // let the original (large) load
  const lb = await page.evaluate(() => { const ov = document.getElementById('as-lb'); const i = document.querySelector('.as-lb-img'); return { display: ov ? getComputedStyle(ov).display : 'none', na: ov?.classList.contains('na'), nw: i?.naturalWidth || 0, src: (i?.currentSrc||i?.src||'').slice(-40) }; });
  console.log('[pending click] lightbox display:', lb.display, '| na:', lb.na, '| original loaded nw:', lb.nw, '| src:', lb.src);
} else {
  console.log('[pending click] cover already propagated — cannot test original fallback here');
}
await ctx.close();
