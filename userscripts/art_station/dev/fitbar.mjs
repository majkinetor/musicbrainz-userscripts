import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
await page.click('#as-root .as-selall'); await page.waitForTimeout(200);
const state = async () => page.evaluate(() => {
  const bar = document.querySelector('#as-root .as-bar');
  const items = [...bar.children];
  const top0 = items[0].offsetTop;
  return { compact: bar.classList.contains('as-compact'), rows: new Set(items.map(i=>i.offsetTop)).size, dlLabelVisible: getComputedStyle(document.querySelector('.as-bk-dl .as-bt')).display !== 'none' };
});
console.log('[wide 1300]  ', JSON.stringify(await state()), '(want compact:false rows:1 labelVisible:true)');
await page.setViewportSize({ width: 760, height: 900 }); await page.waitForTimeout(300);
console.log('[narrow 760] ', JSON.stringify(await state()), '(want compact:true rows:1 labelVisible:false)');
const bb = await page.evaluate(() => { const r = document.querySelector('#as-root .as-bar').getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; });
await page.screenshot({ path: 'userscripts/art_station/dev/fitbar.png', clip: { x: bb.x, y: bb.y, width: bb.w, height: bb.h + 6 } });
await page.setViewportSize({ width: 520, height: 900 }); await page.waitForTimeout(300);
console.log('[tiny 520]   ', JSON.stringify(await state()));
console.log('shot saved');
await ctx.close();
