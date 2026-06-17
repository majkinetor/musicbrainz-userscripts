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
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
await page.click('#as-root .as-view'); await page.waitForTimeout(150);
await page.click('.as-view-pop .as-vdetail'); await page.waitForTimeout(300);
await page.mouse.click(6, 400); await page.waitForTimeout(150);
// no "Comment" label text in rows
const hasCommentLabel = await page.evaluate(() => [...document.querySelectorAll('#as-root .as-dlbl')].some(e => e.textContent.trim() === 'Comment'));
// id on its own line (separate from dims) and not overflowing the 128px column
const idInfo = await page.evaluate(() => {
  const left = document.querySelector('#as-root .as-dleft');
  const did = document.querySelector('#as-root .as-did');
  return { hasDid: !!did, idText: did?.textContent, leftW: Math.round(left.getBoundingClientRect().width), idRight: did ? Math.round(did.getBoundingClientRect().right) : null, leftRight: Math.round(left.getBoundingClientRect().right) };
});
console.log('Comment label present:', hasCommentLabel, '(want false) | id own line:', idInfo.hasDid, idInfo.idText, '| id stays within left col:', idInfo.idRight <= idInfo.leftRight + 1);
// selection: right-click row 1
await page.mouse.move(60, 0);
const r1 = await page.evaluate(() => { const r = document.querySelector('#as-root .as-drow'); const b = r.getBoundingClientRect(); return { x: b.x+50, y: b.y+12 }; });
await page.mouse.click(r1.x, r1.y, { button: 'right' }); await page.waitForTimeout(200);
const afterRightClick = await page.evaluate(() => ({ sel: document.querySelector('#as-root .as-drow')?.classList.contains('sel'), cnt: document.querySelector('#as-root .as-selcnt')?.textContent }));
console.log('right-click row -> selected:', afterRightClick.sel, '| count:', JSON.stringify(afterRightClick.cnt));
// select all
await page.click('#as-root .as-selall'); await page.waitForTimeout(200);
const allSel = await page.evaluate(() => { const rows = [...document.querySelectorAll('#as-root .as-drow')]; return { total: rows.length, sel: rows.filter(r => r.classList.contains('sel')).length, cnt: document.querySelector('#as-root .as-selcnt')?.textContent }; });
console.log('select-all -> rows selected:', allSel.sel + '/' + allSel.total, '| count:', JSON.stringify(allSel.cnt));
await page.click('#as-root .as-selclr'); await page.waitForTimeout(200);
const cleared = await page.evaluate(() => [...document.querySelectorAll('#as-root .as-drow')].filter(r => r.classList.contains('sel')).length);
console.log('clear -> rows selected:', cleared, '(want 0)');
// select row 1 via its checkbox for the screenshot (row1 selected, row2 not)
await page.click('#as-root .as-drow:first-of-type .as-dsel'); await page.waitForTimeout(200);
const cbState = await page.evaluate(() => ({ checked: document.querySelector('#as-root .as-drow .as-dsel')?.checked, selClass: document.querySelector('#as-root .as-drow')?.classList.contains('sel') }));
console.log('checkbox-select row1 -> checked:', cbState.checked, 'row.sel:', cbState.selClass);
const box = await page.evaluate(() => { const l = document.querySelector('#as-root .as-dlist'); const r = l.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width }; });
await page.screenshot({ path: 'userscripts/art_station/dev/detailsel.png', clip: { x: box.x, y: Math.max(0,box.y), width: Math.min(box.w,720), height: 320 } });
console.log('shot saved');
await ctx.close();
