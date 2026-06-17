import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
const st = () => page.evaluate(() => {
  const sw = document.getElementById('as-switch');
  const root = document.getElementById('as-root');
  const aw = document.querySelector('.artwork-cont');
  return { switchText: sw?.textContent, rootHidden: getComputedStyle(root).display==='none', nativeShown: aw && getComputedStyle(aw).display!=='none', inMenu: [...document.querySelectorAll('input[name="as-vmode"]')].map(r=>r.value) };
});
console.log('[default]   ', JSON.stringify(await st()));
await page.click('#as-switch'); await page.waitForTimeout(300);
console.log('[orig]      ', JSON.stringify(await st()), '(want switchText:Art Station rootHidden:true nativeShown:true)');
await page.click('#as-switch'); await page.waitForTimeout(300);
console.log('[back]      ', JSON.stringify(await st()), '(want switchText:Original rootHidden:false nativeShown:false)');
// dragwarn click -> grid + position
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop input[value="detailed"]'); await page.waitForTimeout(300);
const dwBefore = await page.$('#as-root .as-dragwarn') ? 'shown' : 'absent';
await page.click('#as-root .as-dragwarn'); await page.waitForTimeout(300);
const after = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('artstation:settings')); return { detailed:s.detailed, group:s.group, sort:s.sort, warnGone: !document.querySelector('#as-root .as-dragwarn') }; });
console.log('dragwarn before(detailed):', dwBefore, '| after click:', JSON.stringify(after), '(want detailed:false group:false sort:type warnGone:true)');
// screenshot the switch
await page.screenshot({ path: 'userscripts/art_station/dev/switch.png', clip: { x: 1100-260, y: 900-90, width: 250, height: 80 } });
console.log('shot saved');
await ctx.close();
