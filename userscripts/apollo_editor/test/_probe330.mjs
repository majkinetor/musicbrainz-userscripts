import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE,'..','..','..','.pw-profile');
const ORIGIN = 'https://beta.musicbrainz.org';
const seed = JSON.parse(await readFile(resolve(HERE,'seed-saigon.local.json'),'utf8'));
const ctx = await chromium.launchPersistentContext(PROFILE,{headless:true,viewport:{width:1680,height:1150}});
const page = ctx.pages()[0]||await ctx.newPage();
await page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});
if (/\/login/.test(page.url())) { console.log('NOT_LOGGED_IN'); await ctx.close(); process.exit(0); }
await page.evaluate(({origin,params})=>{const f=document.createElement('form');f.method='POST';f.action=origin+'/release/add';f.style.display='none';const add=(n,v)=>{const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.appendChild(i)};for(const[k,v]of Object.entries(params))Array.isArray(v)?v.forEach(x=>add(k,x)):add(k,v);document.body.appendChild(f);f.submit();},{origin:ORIGIN,params:seed});
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1',{hasText:/Confirm form submission/i}).count().catch(()=>0)) { await page.locator('button[type=submit]',{hasText:/Continue/i}).first().click(); await page.waitForLoadState('domcontentloaded'); }
await page.waitForFunction(()=>{try{return window.MB.releaseEditor.rootField.release().mediums().length}catch{return false}},null,{timeout:120000});
await page.locator('a, button',{hasText:/^Tracklist$/}).first().click().catch(()=>{});
await page.waitForTimeout(1500);
const dump = await page.evaluate(()=>{
  const out = {pregapEls:[], dataEls:[], addMedium:[], modelHasPregap:null, modelHasData:null};
  // model methods
  try { const m = window.MB.releaseEditor.rootField.release().mediums()[0];
    out.modelHasPregap = typeof m.hasPregap; out.modelHasData = typeof m.hasDataTracks;
    out.mediumMethods = Object.keys(m).filter(k=>/pregap|data/i.test(k)).slice(0,20);
  } catch(e){ out.err = e.message; }
  const scan = (re) => [...document.querySelectorAll('a,button,input,label,span')].filter(el=>re.test((el.textContent||'')+' '+(el.getAttribute('data-bind')||'')+' '+(el.className||''))).slice(0,6).map(el=>({tag:el.tagName, txt:(el.textContent||'').trim().slice(0,40), bind:el.getAttribute('data-bind')||'', cls:(el.className||'').slice(0,40)}));
  out.pregapEls = scan(/pregap/i);
  out.dataEls = scan(/data track|datatrack|isDataTrack|add data/i);
  out.addMedium = scan(/add medium/i);
  return out;
});
console.log(JSON.stringify(dump,null,1));
await ctx.close();
