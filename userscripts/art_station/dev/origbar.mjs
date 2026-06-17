import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 820, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
// compact one-row check at 820 with selection
await page.click('#as-root .as-selall'); await page.waitForTimeout(200);
const oneRow = await page.evaluate(() => { const btns=[...document.querySelectorAll('#as-root .as-bar .as-btn')]; const t0=btns[0].offsetTop; return { compact: document.querySelector('#as-root .as-bar').classList.contains('as-compact'), sameRow: btns.every(b=>Math.abs(b.offsetTop-t0)<4) }; });
console.log('compact at 820:', oneRow.compact, '| all buttons one row:', oneRow.sameRow);
await page.click('#as-root .as-selclr'); await page.waitForTimeout(150);
// set Detailed view, then Show original, then click Art Station -> should return to Detailed
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop input[value="detailed"]'); await page.waitForTimeout(300);
console.log('detailed active:', await page.$('#as-root .as-drow') ? 'yes' : 'no');
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop input[value="orig"]'); await page.waitForTimeout(300);
const orig = await page.evaluate(() => ({ barOnlyBack: document.querySelectorAll('#as-root .as-bar .as-btn').length===1 && !!document.querySelector('.as-asback'), nativeShown: !!document.querySelector('.artwork-cont') && getComputedStyle(document.querySelector('.artwork-cont')).display!=='none', detailedStillSet: JSON.parse(localStorage.getItem('artstation:settings')).detailed }));
console.log('orig mode: toolbar only Art Station btn:', orig.barOnlyBack, '| native shown:', orig.nativeShown, '| detailed kept:', orig.detailedStillSet);
await page.click('.as-asback'); await page.waitForTimeout(300);
const back = await page.evaluate(() => ({ detailedRows: document.querySelectorAll('#as-root .as-drow').length, nativeHidden: getComputedStyle(document.querySelector('.artwork-cont')).display==='none' }));
console.log('after Art Station btn: returned to detailed (rows>0):', back.detailedRows>0, '| native hidden again:', back.nativeHidden);
await ctx.close();
