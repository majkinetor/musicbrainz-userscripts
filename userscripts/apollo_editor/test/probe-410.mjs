import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js','utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport:{width:1650,height:1050} });
const page = ctx.pages()[0] || await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
// preset a default = the seeded "All Quotes" chain, before Apollo loads
await page.addInitScript(() => { window.GM_getValue=(k,d)=>d; window.GM_setValue=()=>{}; window.GM_info={script:{name:'Apollo',version:'test'}}; localStorage.setItem('apolloEditor.settings.v1', JSON.stringify({ srDefault:'All Quotes' })); });
await page.goto('https://musicbrainz.org/release/43794b9b-ac76-4591-807f-c192d6258ba0/edit', { waitUntil:'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1000);
await page.evaluate(()=>{ const t=document.querySelector('a[href="#tracklist"]'); if(t)t.click(); });
await page.waitForTimeout(4500);
let fail=0; const ck=(c,m)=>{console.log((c?'ok  : ':'FAIL: ')+m);if(!c)fail++;};
// ensure sr tool box (so a chain chip can render)
let has = await page.evaluate(()=>!!document.querySelector('.tc-sro'));
if(!has){ await page.evaluate(()=>{const l=document.querySelector('.tc-toolslabel'); if(l)l.click();}); await page.waitForTimeout(300); await page.evaluate(()=>{const it=[...document.querySelectorAll('#tc-menu .tc-mi')].find(x=>/replace|S&R|search/i.test(x.textContent)); if(it)it.click();}); await page.waitForTimeout(400); }
// #410 (2)(3): default chain applied on tracklist open → chain mode active
const applied = await page.evaluate(()=>{ const box=document.querySelector('.tc-sro'); const chip=document.querySelector('.tc-sr-chainlbl'); return { chainMode:!!(box&&box.classList.contains('tc-sro-chain')), chip:chip?chip.textContent:null }; });
console.log('applied on start:', JSON.stringify(applied));
ck(applied.chainMode && /All Quotes/.test(applied.chip||''), 'default chain applied on Tracklist open (chain mode, chip shows)');
// #410 (1): default shown differently in the popup
await page.evaluate(()=>{ const s=document.querySelector('.tc-sr-star'); if(s)s.click(); });
await page.waitForTimeout(300);
const ui = await page.evaluate(()=>{ const rows=[...document.querySelectorAll('.tc-srtpl-row')]; const defRow=rows.find(r=>r.classList.contains('tc-srtpl-defrow')); const defBtn=defRow&&defRow.querySelector('.tc-srtpl-def.on'); return { defRowName: defRow?defRow.querySelector('.tc-srtpl-nm').textContent:null, hasFilled:!!defBtn }; });
console.log('popup default marker:', JSON.stringify(ui));
ck(/All Quotes/.test(ui.defRowName||'') && ui.hasFilled, 'default row shown differently (tinted + filled ◉)');
// toggle default off via clicking the filled ◉, then set "Single quote" as default
const toggled = await page.evaluate(async ()=>{
  const row=[...document.querySelectorAll('.tc-srtpl-row')].find(r=>/Single quote/.test(r.querySelector('.tc-srtpl-nm')?.textContent||''));
  const btn=row.querySelector('.tc-srtpl-def'); btn.click(); await new Promise(r=>setTimeout(r,200));
  const st=JSON.parse(localStorage.getItem('apolloEditor.settings.v1')||'{}'); return st.srDefault;
});
console.log('new default:', toggled);
ck(toggled==='Single quote', 'clicking ◉ sets a new default (only one), persisted');
ck(errs.filter(e=>!/ResizeObserver/.test(e)).length===0, 'no page errors: '+JSON.stringify(errs.slice(0,3)));
console.log(fail?`\n${fail} FAIL`:'\nALL PASS');
await ctx.close(); process.exit(fail?1:0);
