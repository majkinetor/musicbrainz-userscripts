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
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
// give all covers 3 types via bulk Type → Add (Front already on some; force a known set)
await page.click('#as-root .as-selall'); await page.waitForTimeout(120);
await page.click('#as-root .as-bk-type'); await page.waitForTimeout(150);
for (const t of ['Front','Back','Booklet']) await page.click(`.as-pop label:has(input[value="${t}"])`).catch(()=>{});
await page.click('.as-pop .as-pop-apply'); await page.waitForTimeout(400);
const setSize = async v => { await page.evaluate(val => { const s=document.querySelector('.as-size'); s.value=val; s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); }, v); await page.waitForTimeout(300); };
const pill = async () => page.evaluate(() => document.querySelector('#as-root .as-card .as-type')?.textContent);
const selmarkShown = async () => page.evaluate(() => { const m = document.querySelector('#as-root .as-card.sel .as-selmark'); return m ? getComputedStyle(m).display !== 'none' : null; });
await setSize(140);
console.log('[small 140] pill:', JSON.stringify(await pill()), '| selmark shown:', await selmarkShown());
await setSize(340);
console.log('[large 340] pill:', JSON.stringify(await pill()), '| selmark shown:', await selmarkShown(), '(want selmark false)');
await setSize(220);
console.log('[mid 220]   pill:', JSON.stringify(await pill()));
await setSize(300);
const grid = await page.evaluate(() => { const g = document.querySelector('#as-root .as-grid'); const r = g.getBoundingClientRect(); return { x:r.x, y:r.y }; });
await page.screenshot({ path: 'userscripts/art_station/dev/typefit.png', clip: { x: grid.x, y: Math.max(0,grid.y), width: 760, height: 720 } });
console.log('shot saved');
await ctx.close();
