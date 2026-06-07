// #160 — with tc-tl-on forced on <body> (the leak condition), the Release-information remove buttons must
// show MB's NATIVE X, not the themed ✕. Screenshot the RELEASE EVENT section to confirm.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '501d0be3-ec5b-46e6-b60e-fbf1913a1a95';
const OUT = resolve(HERE, 'logs', 'shots'); await mkdir(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext(resolve(HERE,'..','..','..','.pw-profile'), { headless: true, viewport:{width:1500,height:1100}, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil:'domcontentloaded', timeout:60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(()=>{try{return window.MB.releaseEditor.rootField.release().mediums().length>=0}catch{return false}}, null, {timeout:60000});
await page.addScriptTag({ content: await readFile(SCRIPT,'utf8') });
await page.waitForTimeout(1200);
// force the leak condition: tc-tl-on on body while viewing Release information (RI takeover OFF)
await page.evaluate(()=>{ document.body.classList.add('tc-tl-on'); const a=document.querySelector('#release-editor ul.ui-tabs-nav a[href="#information"]'); if(a)a.click(); });
await page.waitForTimeout(600);
const r = await page.evaluate(()=>{
  const rm = [...document.querySelectorAll('#information button.icon.remove-item')].filter(e=>e.offsetParent!==null);
  return { count: rm.length, glyphs: rm.map(e=>getComputedStyle(e,'::before').content) };
});
console.log('RI remove-item ::before =', JSON.stringify(r));
const box = await page.evaluate(()=>{
  const lab=[...document.querySelectorAll('#information legend, #information h2, #information label')].find(e=>/release event/i.test(e.textContent));
  const host=lab?.closest('fieldset')||document.querySelector('#information');
  const b=host.getBoundingClientRect();
  return {x:Math.max(0,b.left-6),y:Math.max(0,b.top-6),width:Math.min(1480,b.width+12),height:Math.min(700,b.height+12)};
});
await page.screenshot({ path: resolve(OUT,'i160-release-event-x.png'), clip: box });
console.log('shot -> i160-release-event-x.png');
await ctx.close();
