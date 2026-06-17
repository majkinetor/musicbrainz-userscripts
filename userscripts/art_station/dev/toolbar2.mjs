import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 760, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
// View radios
await page.click('#as-root .as-view'); await page.waitForTimeout(200);
const vp = await page.$('.as-view-pop'); const vb = await vp.boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/viewradios.png', clip: { x: vb.x-2, y: vb.y-2, width: vb.width+4, height: vb.height+4 } });
const radios = await page.evaluate(() => ({ vmode: [...document.querySelectorAll('input[name="as-vmode"]')].map(r => r.value), sortType: document.querySelector('input[name="as-vsort"]')?.type }));
console.log('view modes are radios:', radios.vmode, '| count:', radios.vmode.length);
// exclusivity: pick Detailed, then Group → detailed should turn off
await page.click('.as-view-pop input[value="detailed"]'); await page.waitForTimeout(300);
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop input[value="group"]'); await page.waitForTimeout(300);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('artstation:settings')));
console.log('after picking group: detailed=', after.detailed, 'group=', after.group, '(want detailed:false group:true)');
// narrow toolbar with selection — buttons must not wrap internally; bar wraps to rows
await page.click('#as-root .as-view'); await page.waitForTimeout(150); await page.click('.as-view-pop input[value="grid"]'); await page.waitForTimeout(200);
await page.click('#as-root .as-selall'); await page.waitForTimeout(200);
const bar = await page.evaluate(() => { const b = document.querySelector('#as-root .as-bar'); const r = b.getBoundingClientRect(); const btns = [...b.querySelectorAll('.as-btn')]; const tall = btns.filter(x => x.getBoundingClientRect().height > 40).map(x => x.textContent.trim()); return { h: Math.round(r.height), scrollX: b.scrollWidth > b.clientWidth + 1, wrappedButtons: tall }; });
console.log('toolbar height:', bar.h, '| has h-scroll:', bar.scrollX, '(want false) | internally-wrapped buttons:', JSON.stringify(bar.wrappedButtons), '(want [])');
const bb = await page.evaluate(() => { const r = document.querySelector('#as-root .as-bar').getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; });
await page.screenshot({ path: 'userscripts/art_station/dev/toolbar2.png', clip: { x: bb.x, y: bb.y, width: bb.w, height: bb.h + 6 } });
console.log('shots saved');
await ctx.close();
