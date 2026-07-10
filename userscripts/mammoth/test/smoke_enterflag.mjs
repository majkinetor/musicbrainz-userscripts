import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/mammoth/mammoth.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d/edit', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: script });
await page.waitForTimeout(1500);

// target the disambiguation input; instrument it to record Enter keydowns with timestamps
const target = await page.evaluate(() => {
  const el = document.querySelector('#id-edit-artist\\.comment') || [...document.querySelectorAll('input[type="text"]')].find(i => i.id && !i.closest('.mmth-side'));
  window.__enter = []; window.__setAt = 0;
  el.addEventListener('keydown', e => { if (e.key === 'Enter') window.__enter.push(performance.now()); });
  return '#' + CSS.escape(el.id);
});

// add a custom field with the ↵ (enter) flag on the target
await page.evaluate(() => document.querySelector('button[title="Settings"]').click());
await page.waitForTimeout(150);
await page.evaluate(() => document.querySelector('.mmth-cfgtab[data-tab="fields"]').click());
await page.waitForTimeout(150);
const hasRetCb = await page.evaluate(sel => {
  document.querySelector('.mmth-cf-add').click();
  const row = document.querySelector('.mmth-cf-row');
  const set = (cls, v) => { const inp = row.querySelector(cls); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); };   // config inputs are plain DOM
  set('.mmth-cf-match', sel);
  set('.mmth-cf-label', 'Test');
  const boxes = row.querySelectorAll('.mmth-cf-ent input');   // [entity, ↵]
  const ret = boxes[1]; ret.checked = true; ret.dispatchEvent(new Event('change', { bubbles: true }));
  return boxes.length === 2;
}, target);
await page.waitForTimeout(900); // debounced refresh

// seed a saved value for this field directly in storage-independent memory: type a value, open pin pop, click ＋
await page.evaluate(sel => { const el = document.querySelector(sel); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, 'Hello Value'); el.dispatchEvent(new Event('input', { bubbles: true })); }, target);
await page.evaluate(sel => { const el = document.querySelector(sel); const er = el.getBoundingClientRect(); const pin = [...document.querySelectorAll('.mmthf-pin')].find(p => { const pr = p.getBoundingClientRect(); return Math.abs(pr.top - er.top) < 30; }); pin.click(); }, target);
await page.waitForTimeout(200);
const saved = await page.evaluate(() => { const save = document.querySelector('.mmthf-save'); if (!save || save.getAttribute('aria-disabled') === 'true') return false; save.click(); return true; });
await page.waitForTimeout(200);
// close the pop, clear the field, then reopen (fresh list) and recall the saved value
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await page.waitForTimeout(150);
await page.evaluate(sel => { const el = document.querySelector(sel); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); }, target);
await page.evaluate(sel => { const el = document.querySelector(sel); const er = el.getBoundingClientRect(); const pin = [...document.querySelectorAll('.mmthf-pin')].find(p => { const pr = p.getBoundingClientRect(); return Math.abs(pr.top - er.top) < 30; }); pin.click(); }, target);
await page.waitForTimeout(200);
console.log('saved value ok:', saved, '| saved rows in pop:', await page.evaluate(() => document.querySelectorAll('.mmthf-row').length));
const recalled = await page.evaluate(() => { const row = document.querySelector('.mmthf-row'); if (!row) return false; window.__setAt = performance.now(); row.click(); return true; });
await page.waitForTimeout(500);

const out = await page.evaluate(sel => ({ value: document.querySelector(sel).value, enters: window.__enter.map(t => Math.round(t - window.__setAt)) }), target);
console.log('↵ checkbox present:', hasRetCb, '| recalled row clicked:', recalled);
console.log('field value after recall:', JSON.stringify(out.value));
console.log('Enter keydowns (ms after set):', JSON.stringify(out.enters), '→', out.enters.length ? 'FIRED' : 'none');
console.log('pageerrors:', errs.length ? errs.slice(0, 4) : 'none');
await ctx.close();
