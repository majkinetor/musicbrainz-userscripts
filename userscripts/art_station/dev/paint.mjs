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

// gather centers of the first 4 cards
const pts = await page.$$eval('#as-root .as-grid .as-card', els => els.slice(0, 4).map(c => {
  const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}));

// right-button paint across cards 0..3
await page.mouse.move(pts[0].x, pts[0].y);
await page.mouse.down({ button: 'right' });
for (const p of pts.slice(1)) { await page.mouse.move(p.x, p.y, { steps: 4 }); }
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(200);

const sel = await page.$$eval('.as-card.sel', els => els.length);
const bulk = await page.$('.as-bulk');
const menuShown = await page.evaluate(() => !!document.querySelector('.context-menu')); // native menu won't be in DOM anyway
console.log('painted selection count:', sel, '(expected ~4) | bulk bar:', !!bulk);

// paint again starting on a selected card -> should DEselect those hovered
await page.mouse.move(pts[0].x, pts[0].y);
await page.mouse.down({ button: 'right' });
await page.mouse.move(pts[1].x, pts[1].y, { steps: 4 });
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(200);
const sel2 = await page.$$eval('.as-card.sel', els => els.length);
console.log('after deselect-paint over 2:', sel2, '(expected ~2)');
await ctx.close();
