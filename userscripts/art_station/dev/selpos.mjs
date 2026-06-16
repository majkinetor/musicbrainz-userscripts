import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
const c = (await page.$$('.as-card:not(.del)'))[0];
const b = await c.boundingBox();
await page.mouse.move(b.x + b.width/2, b.y + b.height/2);
await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
await page.waitForTimeout(200);
const pos = await page.evaluate(() => {
  const card = document.querySelector('.as-card.sel');
  const m = card.querySelector('.as-selmark'), th = card.querySelector('.as-thumb'), meta = card.querySelector('.as-meta');
  const mr = m.getBoundingClientRect(), tr = th.getBoundingClientRect(), me = meta.getBoundingClientRect();
  return { belowThumb: mr.top >= tr.bottom - 2, inMetaBand: mr.bottom <= me.bottom + 2 && mr.top >= me.top - 2, rightSide: (me.right - mr.right) < 12 };
});
console.log('selmark below image:', pos.belowThumb, '| in comment row:', pos.inMetaBand, '| right side:', pos.rightSide);
await c.screenshot({ path: 'userscripts/art_station/poc-selpos.png' });
await ctx.close();
