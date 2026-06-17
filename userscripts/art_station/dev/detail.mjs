import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1200 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
// make sure group/detailed defaults clean, then enable Detailed via View
await page.evaluate(() => { localStorage.removeItem('artstation:settings'); });
await page.reload({ waitUntil: 'networkidle' }); await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop .as-vdetail'); await page.waitForTimeout(400);
const rows = await page.$$('#as-root .as-drow');
console.log('detail rows:', rows.length);
// edit: check a type + set a comment on row 1, confirm model updates via staged count
await page.evaluate(() => { const r = document.querySelector('#as-root .as-drow'); r.querySelector('.as-dtypes input[value="Booklet"]').click(); const c = r.querySelector('.as-dcmt'); c.value = 'detail note'; c.dispatchEvent(new Event('input',{bubbles:true})); });
await page.waitForTimeout(200);
console.log('enter-edit label after edits:', await page.textContent('#as-root .as-commit'));
console.log('presets datalist present:', await page.$('#as-cmt-presets') ? 'yes' : 'no');
await page.mouse.click(6, 400); await page.waitForTimeout(200);   // close the View popover
const box = await page.evaluate(() => { const l = document.querySelector('#as-root .as-dlist'); const r = l.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width }; });
await page.screenshot({ path: 'userscripts/art_station/dev/detail.png', clip: { x: box.x, y: Math.max(0,box.y-44), width: Math.min(box.w,1180), height: 470 } });
console.log('shot saved');
await ctx.close();
