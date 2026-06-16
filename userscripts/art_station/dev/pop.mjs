import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
// select a couple
await (await page.$$('.as-card:not(.del)'))[0].click({ button: 'right' });
await page.waitForTimeout(150);
await (await page.$$('.as-card:not(.del)'))[1].click({ button: 'right' });
await page.waitForTimeout(200);
// selection mark position relative to thumb
const mark = await page.evaluate(() => {
  const c = document.querySelector('.as-card.sel');
  const m = c.querySelector('.as-selmark'), th = c.querySelector('.as-thumb');
  const mr = m.getBoundingClientRect(), tr = th.getBoundingClientRect();
  return { display: getComputedStyle(m).display, nearBottom: (tr.bottom - mr.bottom) < 12, nearRight: (tr.right - mr.right) < 12 };
});
console.log('[selmark] shown:', mark.display !== 'none', '| bottom-right:', mark.nearBottom && mark.nearRight);
// open bulk Set type and check it fits on screen
await page.click('.as-bk-type');
await page.waitForTimeout(200);
const pop = await page.evaluate(() => {
  const p = document.querySelector('.as-pop'); if (!p) return null;
  const r = p.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, onScreen: r.top >= 0 && r.bottom <= innerHeight };
});
console.log('[bulk pop]', JSON.stringify(pop));
await page.screenshot({ path: 'userscripts/art_station/poc-pop.png' });
await ctx.close();
