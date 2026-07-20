import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/isrc_scout/isrc_scout.user.js','utf8');
const MBID='6e569b63-124b-47a6-ba2f-e8af96d2d1bc';
const ctx=await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',{headless:true,viewport:{width:1500,height:1000},bypassCSP:true});
await ctx.exposeBinding('__gmFetch',async(_s,o)=>{try{const r=await ctx.request.fetch(o.url,{method:o.method||'GET',headers:o.headers||{},maxRedirects:10});return{status:r.status(),responseText:await r.text(),finalUrl:r.url()};}catch(e){return{status:0,responseText:'',finalUrl:o.url};}});
const page=ctx.pages()[0]||await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{window.GM_getValue=(k,d)=>d;window.GM_setValue=()=>{};window.GM_info={script:{name:'ISRC Scout',version:'t',homepageURL:'x'}};window.unsafeWindow=window;
  window.GM_xmlhttpRequest=(o)=>{window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{}}).then(r=>o.onload&&o.onload(r)).catch(()=>o.onerror&&o.onerror({status:0}));};});
await page.goto(`https://musicbrainz.org/release/${MBID}`,{waitUntil:'domcontentloaded'});
if(page.url().includes('/login')){console.log('NOT LOGGED IN');await ctx.close();process.exit(3);}
await page.waitForTimeout(1200); await page.addScriptTag({content:code});
await page.waitForSelector('#ii-btn',{timeout:20000}); await page.click('#ii-btn');
await page.waitForSelector('#ii-sc-all',{timeout:20000});
await page.waitForFunction(()=>/Release "/.test(document.getElementById('ii-log-out')?.textContent||''),null,{timeout:30000});
await page.waitForTimeout(400);
const scVisible=await page.evaluate(()=>getComputedStyle(document.getElementById('ii-sc-all')).display!=='none');
if(scVisible){await page.click('#ii-sc-all');await page.waitForFunction(()=>/SoundCloud done|SoundCloud .*failed/.test(document.getElementById('ii-log-out')?.textContent||''),null,{timeout:60000}).catch(()=>{});await page.waitForTimeout(500);}
const r=await page.evaluate(()=>{const log=document.getElementById('ii-log-out')?.textContent||'';return{line:(log.match(/SoundCloud track[^\n]*|SoundCloud done[^\n]*/g)||[]).join(' | '),filled:[...document.querySelectorAll('#ii-modal tbody input')].filter(i=>i.dataset.autofill==='1'&&/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length};});
let fail=0;const ck=(c,m)=>{console.log((c?'ok  : ':'FAIL: ')+m);if(!c)fail++;};
console.log(JSON.stringify(r));
ck(scVisible,'SoundCloud button shown on a 1-track release with a track URL');
ck(/SoundCloud track/.test(r.line),'recognized the track URL as a single-track release');
ck(r.filled>=1,`ISRC filled from the track (${r.filled})`);
ck(errs.length===0,'no errors: '+JSON.stringify(errs.slice(0,2)));
console.log(fail?`\n${fail} FAIL`:'\nALL PASS');
await ctx.close();process.exit(fail?1:0);
