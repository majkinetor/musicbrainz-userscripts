import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/mammoth/mammoth.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d/edit', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: script });
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('button[title="Settings"]').click());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('.mmth-cfgtab[data-tab="fields"]').click());
await page.waitForTimeout(200);
// one row with TWO comma-separated selectors + a shared key
await page.evaluate(() => {
  document.querySelector('.mmth-cf-add').click();
  const row = document.querySelector('.mmth-cf-row');
  const set = (cls, v) => { const inp = row.querySelector(cls); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); };
  set('.mmth-cf-match', '#id-edit-artist\\.sort_name, #id-edit-artist\\.name');
  set('.mmth-cf-label', 'Name/Sort');
  set('.mmth-cf-key', 'names');
});
await page.waitForTimeout(1000);
const wide = await page.evaluate(() => {
  const p = document.querySelector('.mmth-cfg'), row = document.querySelector('.mmth-cf-row');
  return { hasWideClass: p.classList.contains('mmth-cfg-wide'), width: Math.round(p.getBoundingClientRect().width), rowHeight: Math.round(row.getBoundingClientRect().height), matchCount: document.querySelector('.mmth-cf-cnt')?.textContent, pins: document.querySelectorAll('.mmthf-pin').length };
});
console.log('fields tab:', JSON.stringify(wide));

// outside-click on Fields tab must NOT close the config
await page.mouse.click(1200, 600);
await page.waitForTimeout(300);
console.log('config still open after outside click (Fields):', await page.evaluate(() => !!document.querySelector('.mmth-cfg')));

const clip = await page.evaluate(() => { window.scrollTo(0,0); const p = document.querySelector('.mmth-cfg'); p.style.position='fixed'; p.style.left='12px'; p.style.top='12px'; p.style.right='auto'; const r=p.getBoundingClientRect(); return { x:0, y:0, width: Math.ceil(r.right+12), height: Math.ceil(r.bottom+12) }; });
await page.waitForTimeout(120);
await page.screenshot({ path: 'userscripts/mammoth/test/_shot_fields.png', clip });

// switching to Settings should close on outside click again
await page.evaluate(() => document.querySelector('.mmth-cfgtab[data-tab="settings"]').click());
await page.waitForTimeout(150);
await page.mouse.click(1200, 600);
await page.waitForTimeout(250);
console.log('config closes on outside click (Settings tab):', await page.evaluate(() => !document.querySelector('.mmth-cfg')));
console.log('pageerrors:', errs.length ? errs.slice(0,4) : 'none');
await ctx.close();
