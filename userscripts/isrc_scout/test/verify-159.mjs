// #159 — rows still missing an ISRC (no existing + nothing entered) get highlighted (.ii-row-missing).
// The highlight tracks the SAME condition as the footer's "still missing" count, so entering a pending
// ISRC clears it and clearing the field brings it back.
//
// Release: 94cc33be-… (安東ウメ子 — ウポポ サンケ, 14 tracks, exactly one track with no existing ISRC).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'isrc_scout.user.js');
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '94cc33be-6d7c-495b-9e6d-cd6e40786fcc';
const HEADED = process.argv.includes('--headed');

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1400, height: 1000 } });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  // pass everything through to the real network (no SX mock needed here)
  try { const r = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 }); return { status: r.status(), statusText: r.statusText(), finalUrl: r.url(), responseText: await r.text(), responseHeaders: '' }; }
  catch (e) { return { status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, _networkError: true }; }
});
const shim = `(() => { const s=new Map(); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v)}; window.GM_deleteValue=k=>{s.delete(k)};
  window.GM_xmlhttpRequest=function(o){ window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{},data:o.data}).then(r=>{ r._networkError?(o.onerror&&o.onerror(r)):(o.onload&&o.onload(r)); }).catch(()=>{o.onerror&&o.onerror({status:0,responseText:''})}); };
  window.unsafeWindow=window; window.GM_info={script:{name:'isrc_scout(test)',version:'test'},scriptHandler:'Playwright'}; })();`;
const userJs = await readFile(SCRIPT, 'utf8');

const page = await ctx.newPage();
await page.addInitScript({ content: shim });
await page.addInitScript({ content: userJs });
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { const s = document.getElementById('ii-btn-status'); return s && s.textContent.trim() !== '⏳'; }, null, { timeout: 45000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-modal.open', { timeout: 10000 });
await page.waitForFunction(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length > 0, null, { timeout: 30000 });

// Static rule: a row is highlighted iff its EXISTING cell shows "none" AND its input is empty.
const audit = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#ii-tbody tr[data-idx]')];
  let mismatches = 0, missing = 0, highlighted = 0;
  for (const r of rows) {
    const noneShown = !!r.querySelector('.ii-existing .none');
    const inputEmpty = !(r.querySelector('.ii-input')?.value || '').trim();
    const want = noneShown && inputEmpty;
    const has = r.classList.contains('ii-row-missing');
    if (want) missing++; if (has) highlighted++;
    if (want !== has) mismatches++;
  }
  return { rows: rows.length, missing, highlighted, mismatches };
});

const a0 = await audit();
await page.screenshot({ path: resolve(HERE, 'logs', 'i159-highlight.png'), fullPage: false }).catch(() => {});

// Dynamic: type a valid ISRC into the missing row → highlight clears; clear → returns.
const missIdx = await page.evaluate(() => {
  const r = [...document.querySelectorAll('#ii-tbody tr[data-idx]')].find(x => x.querySelector('.ii-existing .none') && !(x.querySelector('.ii-input')?.value || '').trim());
  return r ? r.dataset.idx : null;
});
let dyn = { skipped: true };
if (missIdx != null) {
  const sel = `#ii-tbody tr[data-idx="${missIdx}"] .ii-input`;
  await page.fill(sel, 'USABC1234567');
  await page.waitForTimeout(150);
  const afterType = await page.evaluate(i => document.querySelector(`#ii-tbody tr[data-idx="${i}"]`).classList.contains('ii-row-missing'), missIdx);
  await page.fill(sel, '');
  await page.dispatchEvent(sel, 'input');
  await page.waitForTimeout(150);
  const afterClear = await page.evaluate(i => document.querySelector(`#ii-tbody tr[data-idx="${i}"]`).classList.contains('ii-row-missing'), missIdx);
  dyn = { skipped: false, missIdx, highlightedAfterType: afterType, highlightedAfterClear: afterClear };
}

console.log('audit:', JSON.stringify(a0));
console.log('dynamic:', JSON.stringify(dyn));
const pass = a0.mismatches === 0 && a0.missing >= 1 &&
  (dyn.skipped || (dyn.highlightedAfterType === false && dyn.highlightedAfterClear === true));
console.log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
