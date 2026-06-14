// Probe #212 — Mammoth edit-note sidebar.
// Stubs GM storage, injects Mammoth on an artist edit page, and verifies (via
// in-page event dispatch, deterministic in headless): sidebar injects + widens
// the field, ＋ saves, click=append, right-click=replace, Ctrl+↓ cycles, ★
// favourite sorts to top, hide-help, and submit-capture.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const O = 'https://musicbrainz.org';
const LOG = resolve(HERE, 'logs', '212');
const log = (...a) => console.log('[probe-212]', ...a);

await mkdir(LOG, { recursive: true });
const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.__gm = {};
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
});
await page.goto(O + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.goto(`${O}/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea.edit-note', { timeout: 20000 });
await page.addScriptTag({ content: code });
await page.waitForTimeout(700);

const ev = fn => page.evaluate(fn);
const taVal = () => ev(() => document.querySelector('textarea.edit-note').value);
const setVal = v => page.evaluate(v => { document.querySelector('textarea.edit-note').value = v; }, v);
const clickSel = sel => page.evaluate(s => document.querySelector(s)?.click(), sel);

log('sidebars:', await ev(() => document.querySelectorAll('.mmth-side').length));
log('field width:', await ev(() => Math.round(document.querySelector('textarea.edit-note').getBoundingClientRect().width) + 'px'));

for (const note of ['Source: official website', 'Per CSG guidelines']) { await setVal(note); await clickSel('button.mmth-fb[title="Save current edit note"]'); await page.waitForTimeout(60); }
log('saved count:', await ev(() => (JSON.parse(window.__gm['mammoth:data'] || '{}').saved || []).length));
log('rows:', await ev(() => document.querySelectorAll('.mmth-side .mmth-row').length));

// default action is now REPLACE: click replaces, right-click appends
await setVal('Base'); await clickSel('.mmth-side .mmth-row'); await page.waitForTimeout(60);
log('click (default replace):', JSON.stringify(await taVal()));
await setVal('Base'); await ev(() => document.querySelector('.mmth-side .mmth-row').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))); await page.waitForTimeout(60);
log('rclick (append):', JSON.stringify(await taVal()));

// Clear button empties the field
await setVal('to be cleared'); await clickSel('button.mmth-fb[title="Clear the edit note"]'); await page.waitForTimeout(60);
log('after clear:', JSON.stringify(await taVal()));

// Ctrl+B / Ctrl+I wrap the selection
await ev(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = 'hello'; ta.focus(); ta.setSelectionRange(0, 5); ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true })); });
await page.waitForTimeout(40); log('Ctrl+B:', JSON.stringify(await taVal()));
await ev(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = 'hi'; ta.focus(); ta.setSelectionRange(0, 2); ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true, bubbles: true, cancelable: true })); });
await page.waitForTimeout(40); log('Ctrl+I:', JSON.stringify(await taVal()));

await ev(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = ''; ta.focus(); ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, cancelable: true })); });
await page.waitForTimeout(60);
log('Ctrl+Down (cycle):', JSON.stringify(await taVal()), '| focused?', await ev(()=>document.activeElement===document.querySelector('textarea.edit-note')));

log('in-list star removed?', await ev(()=>document.querySelectorAll('.mmth-side .mmth-row .mmth-star').length===0));
log('grab handles:', await ev(()=>document.querySelectorAll('.mmth-side .mmth-row .mmth-grab').length), '| vsep?', await ev(()=>!!document.querySelector('.mmth-vsep')), '| clear btn?', await ev(()=>!!document.querySelector('button.mmth-fb[title="Clear the edit note"]')));

await ev(() => { window.GM_setValue('mammoth:settings', JSON.stringify({ historySize: 10, hideHelp: true })); });
await clickSel('button.mmth-fb[title="Settings"]'); await page.waitForTimeout(120);
await clickSel('.mmth-pop .mmth-s-help');  // toggles → set true via UI
await page.waitForTimeout(80);
log('help hidden?', await ev(() => { const p = document.querySelector('.editnote p'); return p ? getComputedStyle(p).display === 'none' : 'no-help-el'; }));
await ev(() => document.querySelector('.mmth-pop') && document.body.click());

await ev(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = 'Imported from Discogs'; ta.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await page.waitForTimeout(80);
log('history:', await ev(() => (JSON.parse(window.__gm['mammoth:data'] || '{}').history || []).map(h => h.text)));

// re-show help for the screenshot, set sample text
await ev(() => { window.GM_setValue('mammoth:settings', JSON.stringify({ historySize: 10, hideHelp: false })); document.querySelectorAll('.editnote').forEach(e => e.classList.remove('mmth-hidehelp')); document.querySelector('textarea.edit-note').value = 'Base text in the note'; });
const clip = await ev(() => { const w = document.querySelector('.mmth-wrap').getBoundingClientRect(); return { x: Math.max(0, w.x - 80), y: Math.max(0, w.y - 70), width: Math.min(1400, w.width + 100), height: w.height + 90 }; });
await page.screenshot({ path: resolve(LOG, 'sidebar.png'), clip });
log('artifacts in', LOG);
await ctx.close();
