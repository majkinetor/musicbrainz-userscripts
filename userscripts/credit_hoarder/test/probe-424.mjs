// #424 — "Use works" master toggle + renamed mode picker:
//   toggle before "works:" select, labels 'create none'/'create needed', default on+none;
//   unchecking disables/greys the select and getOpts must yield mode 'off';
//   checking with 'create needed' selected pops the #421 warning; persistence round-trips.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  // #501: a real (Map-backed) GM store, not a no-op — settings now live there.
  const gmStore = new Map();
  window.GM_getValue = (k, d) => gmStore.has(k) ? gmStore.get(k) : d;
  window.GM_setValue = (k, v) => gmStore.set(k, v);
  window.__gmStore = gmStore;
  window.GM_xmlhttpRequest = () => {};
  window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.localStorage.removeItem('discogs-importer-opts');
});
await page.goto('https://musicbrainz.org/release/3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);

const r = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.discogs-select-wrap select')].find(s => [...s.options].some(o => o.value === 'when-needed'));
  const wrap = sel.closest('.discogs-select-wrap');
  const useLbl = [...document.querySelectorAll('label')].find(l => (l.textContent || '').trim().startsWith('Use') && l.querySelector('input[type="checkbox"]'));
  const useCb = useLbl?.querySelector('input[type="checkbox"]');
  if (!useCb) return { err: 'Use checkbox not found', labels: [...document.querySelectorAll('label')].map(l => l.textContent.trim()).slice(0, 20) };
  const out = {};
  out.selLabel = wrap.textContent.trim().split(':')[0];
  out.optionLabels = [...sel.options].map(o => o.textContent);
  out.defaults = { use: useCb?.checked, mode: sel.value, disabled: sel.disabled };
  // toggle order: the Use checkbox label must come right before the works select wrap
  out.orderOk = !!useLbl && (useLbl.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  // uncheck → (a tick later: the label-click handlers run via setTimeout 0) select
  // disabled + saved useWorks false
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  // NB: click the LABEL (the real-user path) — makeCheckbox preventDefaults the label
  // click and flips `checked` manually, so a programmatic input.click() double-toggles.
  return (async () => {
    useLbl.click();
    await sleep(100);
    out.afterUncheck = { disabled: sel.disabled, opacity: wrap.style.opacity };
    const saved0 = JSON.parse(window.__gmStore.get('discogs-importer-opts') || '{}');
    out.savedOff = saved0.useWorks === false && saved0.createWorksMode === 'never';
    // re-check with 'create needed' selected → warning pops
    sel.disabled = false; sel.value = 'when-needed'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.discogs-cw-warn-ov button')?.click();   // dismiss the change-triggered one
    useLbl.click();
    await sleep(150);
    out.warnOnEnable = !!document.querySelector('.discogs-cw-warn-ov');
    document.querySelector('.discogs-cw-warn-ov button')?.click();
    const saved1 = JSON.parse(window.__gmStore.get('discogs-importer-opts') || '{}');
    out.savedOn = saved1.useWorks === true && saved1.createWorksMode === 'when-needed' && saved1.createWorksReset421 === true;
    out.reDisabled = sel.disabled;
    return out;
  })();
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.selLabel === 'works', 'select is labeled "works:"');
ck(r.optionLabels.join('|') === 'create none|create needed', 'options renamed to create none / create needed');
ck(r.defaults.use === true && r.defaults.mode === 'never' && !r.defaults.disabled, 'defaults: Use on, create none, enabled');
ck(r.orderOk, '"Use" toggle sits before the works select');
ck(r.afterUncheck.disabled && parseFloat(r.afterUncheck.opacity) < 1, 'unchecking disables + greys the mode select');
ck(r.savedOff, 'useWorks:false persisted (mode value untouched)');
ck(r.warnOnEnable, 're-enabling with "create needed" pops the #421 warning');
ck(r.savedOn && !r.reDisabled, 're-enabled state persisted, select active again');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
