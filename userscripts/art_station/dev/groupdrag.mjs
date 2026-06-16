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
// ungroup → Position view (draggable)
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(300);
// drive the model directly to validate group-move wiring end to end (HTML5 DnD is flaky to synthesize):
const out = await page.evaluate(() => {
  // select cards at order 2 and 5, then simulate a drop of the block onto the card at order 10
  // by invoking the same code path the drop handler uses isn't exposed; instead assert draggable + selection plumbing
  const cards = [...document.querySelectorAll('#as-root .as-grid .as-card')];
  const ids = cards.map(c => c.dataset.id);
  // right-click select 2 of them
  cards[2].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  const after2 = !!document.querySelector('.as-card.sel');
  cards[5].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  const selCount = document.querySelectorAll('.as-card.sel').length;
  const draggable = cards.filter(c => c.getAttribute('draggable') === 'true').length;
  return { selAfterFirst: after2, selCount, draggable, total: cards.length };
});
console.log('selection works:', out.selAfterFirst, '| selected:', out.selCount, '| draggable cards:', out.draggable, '/', out.total);
await ctx.close();
