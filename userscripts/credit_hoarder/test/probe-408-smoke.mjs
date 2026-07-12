import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js','utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue=(k,d)=>d; window.GM_setValue=()=>{}; window.GM_xmlhttpRequest=()=>{}; window.GM_info={script:{name:'CH',version:'t',homepageURL:'x'}}; window.unsafeWindow=window; });
await page.goto('https://musicbrainz.org/release/3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(1500);
const s = await page.evaluate(() => {
  const bar=document.querySelector('.discogs-bar');
  return { bar:!!bar, srcIcons:[...document.querySelectorAll('.discogs-src-ico')].map(b=>b.dataset.src), hasAll:!!document.querySelector('.discogs-src-all'), copyAll:[...document.querySelectorAll('.discogs-log-menu button')].some(b=>/Copy all/.test(b.textContent)) };
});
console.log('state:', JSON.stringify(s));
let fail=0; const ck=(c,m)=>{console.log((c?'ok  : ':'FAIL: ')+m);if(!c)fail++;};
ck(s.bar, 'CH bar mounted');
ck(s.srcIcons.includes('Discogs'), 'Discogs source icon present');
ck(!s.hasAll, 'no "Import all" button on a single-source release');
ck(errs.length===0, 'no page errors: '+JSON.stringify(errs.slice(0,3)));
console.log(fail?`\n${fail} FAIL`:'\nALL PASS');
await ctx.close(); process.exit(fail?1:0);
