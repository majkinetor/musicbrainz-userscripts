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
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
const state = async () => page.evaluate(() => {
  const aw = document.querySelector('.artwork-cont');
  const grid = document.querySelector('#as-root .as-grid');
  const bar = document.querySelector('#as-root .as-bar');
  const vis = el => el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
  return { nativeVisible: vis(aw), galleryVisible: vis(grid), toolbarVisible: vis(bar) };
});
console.log('[default]    ', JSON.stringify(await state()), '(want native:false gallery:true toolbar:true)');
// toggle Show original ON
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop .as-vorig'); await page.waitForTimeout(250);
console.log('[show orig]  ', JSON.stringify(await state()), '(want native:true gallery:false toolbar:true)');
const box = await page.evaluate(() => { const r = document.querySelector('#content')?.getBoundingClientRect(); return r ? {x:r.x,y:Math.max(0,r.y),w:r.width} : null; });
if (box) await page.screenshot({ path: 'userscripts/art_station/dev/showorig.png', clip: { x: box.x, y: box.y, width: Math.min(box.w, 1100), height: 700 } });
// toggle OFF
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop .as-vorig'); await page.waitForTimeout(250);
console.log('[back]       ', JSON.stringify(await state()), '(want native:false gallery:true toolbar:true)');
console.log('shot saved');
await ctx.close();
