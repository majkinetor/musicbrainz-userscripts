// #157 verification:
//  (a) SoundExchange 202 {"searchCaptcha":true} is recognised → toolbar shows a
//      captcha helper + link, not a stuck "not found".
//  (b) SX is no longer auto-called on fills/keystrokes — only on blur of a manual
//      entry or the new per-row [SX] button.
//
// The SX endpoint is mocked (202 captcha) via the GM fetch bridge, and every SX
// POST is counted so we can prove no auto-spam.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'isrc_scout.user.js');
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'aa6c4473-3528-4cd2-a3ce-d83f0e62b0d4'; // Menahan (has spotify)

let sxCalls = 0;
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !process.argv.includes('--headed'), viewport: { width: 1400, height: 1000 } });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  if (/isrc-api\.soundexchange\.com/.test(opts.url)) { sxCalls++; return { status: 202, statusText: 'Accepted', finalUrl: opts.url, responseText: '{"searchCaptcha":true}', responseHeaders: '' }; }
  try { const r = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 }); return { status: r.status(), statusText: r.statusText(), finalUrl: r.url(), responseText: await r.text(), responseHeaders: '' }; }
  catch (e) { return { status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, _networkError: true }; }
});

const shim = `(() => { const s=new Map(); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v)}; window.GM_deleteValue=k=>{s.delete(k)};
  window.GM_xmlhttpRequest=function(o){ window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{},data:o.data}).then(r=>{ r._networkError?(o.onerror&&o.onerror(r)):(o.onload&&o.onload(r)); }).catch(()=>{o.onerror&&o.onerror({status:0,responseText:''})}); };
  window.unsafeWindow=window; window.GM_info={script:{name:'isrc_scout(test)',version:'test'},scriptHandler:'Playwright'}; })();`;
const userJs = await readFile(SCRIPT, 'utf8');

const page = await ctx.newPage();
const perr = []; page.on('pageerror', e => perr.push(e.message));
await page.addInitScript({ content: shim });
await page.addInitScript({ content: userJs });
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { const s = document.getElementById('ii-btn-status'); return s && s.textContent.trim() !== '⏳'; }, null, { timeout: 45000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-modal.open', { timeout: 10000 });
await page.waitForFunction(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length > 0, null, { timeout: 30000 });

// (A) [SX] button present per row, and DISABLED when the field is empty
const sxBtns = await page.evaluate(() => document.querySelectorAll('#ii-tbody tr[data-idx] button.ii-sx').length);
const rows   = await page.evaluate(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length);
const sxDisabledWhenEmpty = await page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx] button.ii-sx').disabled);

// (B) Typing a valid ISRC WITHOUT blur must NOT call SX, but ENABLES [SX]
await page.evaluate(() => { const inp = document.querySelector('#ii-tbody tr[data-idx] input.ii-input'); inp.focus(); inp.value = 'USRC17607830'; inp.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(600);
const callsAfterType = sxCalls;
const sxEnabledWhenValid = await page.evaluate(() => !document.querySelector('#ii-tbody tr[data-idx] button.ii-sx').disabled);

// (C) Blur → fires exactly one SX call → captcha recognised in the row bullet
await page.evaluate(() => { document.querySelector('#ii-tbody tr[data-idx] input.ii-input').dispatchEvent(new Event('blur', { bubbles: true })); });
await page.waitForTimeout(900);
const callsAfterBlur = sxCalls;
const state = await page.evaluate(() => ({
  bullet: (document.querySelector('#ii-tbody tr[data-idx] .ii-lookup')?.textContent || '').trim(),
  prog:   (document.getElementById('ii-prog')?.textContent || '').trim(),
  progHasLink: !!document.querySelector('#ii-prog a'),
}));

// (D) The [SX] button does a SINGLE by-ISRC fetch and does NOT open the refine panel
const beforeBtn = sxCalls;
await page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx] button.ii-sx').click());
await page.waitForTimeout(800);
const sxBtnDelta = sxCalls - beforeBtn;
const refinePanelOpen = await page.evaluate(() => { const p = document.getElementById('ii-sxpanel'); return !!(p && p.offsetParent !== null); });

console.log(JSON.stringify({ rows, sxBtns, sxDisabledWhenEmpty, callsAfterType, sxEnabledWhenValid, callsAfterBlur, sxBtnDelta, refinePanelOpen, state, pageErrors: perr }, null, 2));
const pass = sxBtns === rows && sxDisabledWhenEmpty === true && callsAfterType === 0 && sxEnabledWhenValid === true &&
             callsAfterBlur === 1 && /captcha/i.test(state.bullet) && /captcha/i.test(state.prog) && state.progHasLink &&
             sxBtnDelta === 1 && refinePanelOpen === false && perr.length === 0;
console.log(pass ? 'PASS' : 'FAIL');
await ctx.close();
process.exit(pass ? 0 : 1);
