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
// ungroup → Position view
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(300);
const draggable = await page.$$eval('#as-root .as-card[draggable="true"]', e => e.length);
console.log('draggable cards:', draggable);

// synthetic HTML5 DnD: dragstart on card 0, dragover+drop on card 4
const res = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#as-root .as-grid .as-card')];
  const orderBefore = cards.map(c => c.dataset.id);
  const src = cards[0], tgt = cards[4];
  const dt = new DataTransfer();
  const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  fire(src, 'dragstart');
  fire(tgt, 'dragover');
  fire(tgt, 'drop');
  fire(src, 'dragend');
  const orderAfter = [...document.querySelectorAll('#as-root .as-grid .as-card')].map(c => c.dataset.id);
  return { changed: orderBefore.join() !== orderAfter.join(), beforeHead: orderBefore.slice(0,5), afterHead: orderAfter.slice(0,5) };
});
console.log('order changed by drag:', res.changed);
console.log('before:', res.beforeHead.join(','));
console.log('after :', res.afterHead.join(','));
await ctx.close();
