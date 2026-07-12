import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1650, height: 1050 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue=(k,d)=>d; window.GM_setValue=()=>{}; window.GM_info={script:{name:'Apollo',version:'test'}}; localStorage.removeItem('apolloEditor.settings.v1'); });
await page.goto('https://musicbrainz.org/release/43794b9b-ac76-4591-807f-c192d6258ba0/edit', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1000);
await page.evaluate(() => { const t=document.querySelector('a[href="#tracklist"]'); if(t)t.click(); });
await page.waitForTimeout(3500);
let fail=0; const ck=(c,m)=>{console.log((c?'ok  : ':'FAIL: ')+m);if(!c)fail++;};

// A) seeding: All Quotes chain in settings
const seed = await page.evaluate(() => { try { const s=JSON.parse(localStorage.getItem('apolloEditor.settings.v1')||'{}'); const c=(s.srTemplates||[]).find(t=>Array.isArray(t.members)&&t.name==='All Quotes'); return { seedV:s.srSeedV, chain:c||null, count:(s.srTemplates||[]).length }; } catch(e){ return {err:String(e)}; } });
console.log('seed:', JSON.stringify(seed));
ck(seed.chain && JSON.stringify(seed.chain.members)===JSON.stringify(['Quotes','Single quote']), 'All Quotes chain seeded with both members');

// B) activate the S&R tool box. If not on bar, open Tools menu and click S&R.
let hasBox = await page.evaluate(()=>!!document.querySelector('.tc-sr-star'));
if (!hasBox) {
  await page.evaluate(()=>{ const lbl=document.querySelector('.tc-toolslabel'); if(lbl)lbl.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ const it=[...document.querySelectorAll('#tc-menu .tc-mi')].find(x=>/replace|S&R|search/i.test(x.textContent)); if(it)it.click(); });
  await page.waitForTimeout(500);
  hasBox = await page.evaluate(()=>!!document.querySelector('.tc-sr-star'));
}
ck(hasBox, 'S&R tool box present');

// C) open the popup via ★, verify structure
await page.evaluate(()=>{ const s=document.querySelector('.tc-sr-star'); if(s)s.click(); });
await page.waitForTimeout(400);
const pop = await page.evaluate(() => {
  const p=document.querySelector('.tc-srtpl'); if(!p) return {open:false};
  const secs=[...p.querySelectorAll('.tc-srtpl-sec')].map(s=>s.textContent);
  const chainRow=[...p.querySelectorAll('.tc-srtpl-chnm')].map(e=>e.textContent);
  const chainMembers=[...p.querySelectorAll('.tc-srtpl-chm')].map(e=>e.textContent);
  const addChainBtn=!!p.querySelector('.tc-srtpl-chainbtn');
  const chainAddOnRows=p.querySelectorAll('.tc-srtpl-chainadd').length;
  return { open:true, secs, chainRow, chainMembers, addChainBtn, chainAddOnRows };
});
console.log('popup:', JSON.stringify(pop));
ck(pop.open && pop.addChainBtn, 'popup open with "＋ Add chain" button');
ck(pop.secs.includes('Chains') && pop.secs.includes('Saved'), 'Chains + Saved sections present');
ck(pop.chainRow.some(t=>/All Quotes/.test(t)) && pop.chainMembers.some(t=>/Quotes → Single quote/.test(t)), 'All Quotes chain row shows members');
ck(pop.chainAddOnRows>=2, 'saved pattern rows have the ⛓ add-to-chain action');

// D) apply the chain → chain chip appears in the box
await page.evaluate(() => { const r=[...document.querySelectorAll('.tc-srtpl-row')].find(row=>/All Quotes/.test(row.textContent)); if(r)r.click(); });
await page.waitForTimeout(600);
const applied = await page.evaluate(() => { const box=document.querySelector('.tc-sro'); const chip=document.querySelector('.tc-sr-chainlbl'); return { chainMode:!!(box&&box.classList.contains('tc-sro-chain')), chipText:chip?chip.textContent:null, popClosed:!document.querySelector('.tc-srtpl') }; });
console.log('applied:', JSON.stringify(applied));
ck(applied.chainMode && /All Quotes/.test(applied.chipText||''), 'chain applied → read-only chip shows "⛓ All Quotes"');
ck(applied.popClosed, 'popup closed on apply');

// E) exit chain via ✕ → back to search/replace inputs
await page.evaluate(()=>{ const x=document.querySelector('.tc-sr-chainx'); if(x)x.click(); });
await page.waitForTimeout(300);
const exited = await page.evaluate(()=>{ const box=document.querySelector('.tc-sro'); const f=document.querySelector('.tc-sr-find'); return { chainMode:!!(box&&box.classList.contains('tc-sro-chain')), findVisible:!!(f&&f.offsetParent!==null) }; });
ck(!exited.chainMode && exited.findVisible, 'exit chain restores the search/replace inputs');

ck(errs.filter(e=>!/ResizeObserver/.test(e)).length===0, 'no page errors: '+JSON.stringify(errs.slice(0,3)));
console.log(fail?`\n${fail} FAIL`:'\nALL PASS');
await ctx.close(); process.exit(fail?1:0);
