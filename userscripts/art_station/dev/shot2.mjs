import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 940, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
await page.click('#as-root .as-selall'); await page.waitForTimeout(300);
const shotBar = async (name) => { const r = await page.evaluate(() => { const b = document.querySelector('#as-root .as-bar').getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}; }); await page.screenshot({ path: `userscripts/art_station/dev/${name}.png`, clip: { x:r.x, y:r.y, width:r.w, height:r.h+6 } }); };
await shotBar('compact940');
console.log('compact940 one row:', await page.evaluate(() => { const btns=[...document.querySelectorAll('#as-root .as-bar .as-btn')]; const t0=btns[0].offsetTop; return btns.every(b=>Math.abs(b.offsetTop-t0)<4); }));
// orig mode
await page.click('#as-root .as-selclr'); await page.waitForTimeout(150);
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop input[value="orig"]'); await page.waitForTimeout(400);
const r = await page.evaluate(() => { const c = document.querySelector('#content'); const b = c.getBoundingClientRect(); return {x:Math.max(0,b.x), y:Math.max(0,b.y)}; });
await page.screenshot({ path: 'userscripts/art_station/dev/origmode.png', clip: { x:r.x, y:r.y, width:920, height:380 } });
console.log('shots saved');
await ctx.close();
