// #421 — create-works picker: 'when missing' removed, one-time reset to 'never',
// duplicate-works warning popup when selecting 'when needed', and the reset flag
// survives a later option save (no re-reset loop).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_xmlhttpRequest = () => {};
  window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  // a veteran user with the dangerous mode saved (pre-#421 state)
  window.localStorage.setItem('discogs-importer-opts', JSON.stringify({ tracklist: true, createWorksMode: 'when-missing' }));
});
await page.goto('https://musicbrainz.org/release/3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);

const r = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.discogs-select-wrap select')].find(s => [...s.options].some(o => o.value === 'when-needed'));
  const opts0 = JSON.parse(localStorage.getItem('discogs-importer-opts'));
  const out = { options: [...sel.options].map(o => o.value), initial: sel.value, resetTo: opts0.createWorksMode, flag: opts0.createWorksReset421 === true };
  // select 'when needed' → popup must appear
  sel.value = 'when-needed'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  const ov = document.querySelector('.discogs-cw-warn-ov');
  out.popupShown = !!ov;
  out.popupText = ov ? ov.textContent : '';
  out.gtLink = !!ov?.querySelector('a[href*="group_therapy"]');
  ov?.querySelector('button')?.click();
  out.popupClosed = !document.querySelector('.discogs-cw-warn-ov');
  // the change handler also saved — the reset flag must survive that save
  const opts1 = JSON.parse(localStorage.getItem('discogs-importer-opts'));
  out.afterSave = { mode: opts1.createWorksMode, flag: opts1.createWorksReset421 === true };
  // selecting 'never' must NOT pop the warning
  sel.value = 'never'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  out.noPopupOnNever = !document.querySelector('.discogs-cw-warn-ov');
  return out;
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify({ ...r, popupText: r.popupText.slice(0, 80) + '…' }, null, 1));
ck(!r.options.includes('when-missing'), '"when missing" removed from the picker');
ck(r.options[0] === 'never', '"never" listed first (default)');
ck(r.initial === 'never' && r.resetTo === 'never', 'saved when-missing force-reset to never (#421 one-time)');
ck(r.flag, 'reset flag written');
ck(r.popupShown && /Avoid creating work duplicates/.test(r.popupText) && /matched works/.test(r.popupText), 'warning popup shows on selecting "when needed"');
ck(r.gtLink, 'popup links Group Therapy');
ck(r.popupClosed, 'popup dismisses');
ck(r.afterSave.mode === 'when-needed' && r.afterSave.flag, 'choice saved WITH the reset flag (no re-reset next load)');
ck(r.noPopupOnNever, 'no popup when selecting never');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
