import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/mammoth/mammoth.user.js', 'utf8');
const GID = process.argv[2] || 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'; // The Beatles
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/artist/${GID}/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const loggedIn = await page.evaluate(() => !document.querySelector('a[href="/login"]'));
await page.addScriptTag({ content: script });
await page.waitForTimeout(1500);

// pick a real text input on the page to target (prefer one with a stable id)
const target = await page.evaluate(() => {
  const inp = [...document.querySelectorAll('input[type="text"]')].find(i => i.id && i.offsetParent && !i.closest('.mmth-side') && !i.closest('.mmth-pop'));
  return inp ? { sel: '#' + CSS.escape(inp.id), id: inp.id } : null;
});
console.log('logged in:', loggedIn, '| target field:', target && target.sel);

// open the Mammoth settings (⚙ in the panel), switch to Fields tab
const panelReady = await page.evaluate(() => !!document.querySelector('button[title="Settings"]'));
console.log('mammoth panel + ⚙ present:', panelReady);
await page.evaluate(() => document.querySelector('button[title="Settings"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('.mmth-cfgtab[data-tab="fields"]').click());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('.mmth-cf-add').click());
await page.waitForTimeout(150);

// type the target selector + a label into the new row
await page.evaluate(sel => {
  const row = document.querySelector('.mmth-cf-row');
  const set = (cls, v) => { const inp = row.querySelector(cls); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); };
  set('.mmth-cf-match', sel);
  set('.mmth-cf-label', 'My field');
}, target.sel);
await page.waitForTimeout(200);
const cnt = await page.evaluate(() => document.querySelector('.mmth-cf-cnt')?.textContent);
console.log('match count shown:', JSON.stringify(cnt));
await page.waitForTimeout(900); // debounced refresh (400ms) + settle

// verify a baby pin attached to the target field
const res = await page.evaluate(sel => {
  const el = document.querySelector(sel);
  const pins = [...document.querySelectorAll('.mmthf-pin')];
  const er = el.getBoundingClientRect();
  const near = pins.find(p => { const pr = p.getBoundingClientRect(); return Math.abs(pr.top - er.top) < 30 && pr.left > er.left && pr.left < er.right + 40; });
  return { pinCount: pins.length, attachedToTarget: !!near, targetHasDataAttr: el.dataset.mmthf === '1' };
}, target.sel);
console.log('result:', JSON.stringify(res));

// also test a BAD selector shows "bad selector"
await page.evaluate(() => { const inp = document.querySelector('.mmth-cf-match'); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, 'input[['); inp.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(150);
const bad = await page.evaluate(() => document.querySelector('.mmth-cf-cnt')?.textContent);
console.log('bad-selector feedback:', JSON.stringify(bad));

await page.screenshot({ path: 'userscripts/mammoth/test/_smoke_customfields.png' });
console.log('pageerrors:', errs.length ? errs.slice(0, 5) : 'none');
await ctx.close();
