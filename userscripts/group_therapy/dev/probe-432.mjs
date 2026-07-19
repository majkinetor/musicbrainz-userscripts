// #432 — recording-of options (attributes/dates/ended) picked in the ⋯ popover must
// stay visible as chips next to the button after it closes; × removes; ⋯ highlights.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/group_therapy/group_therapy.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1700, height: 1100 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'GT', version: 't' } }; window.unsafeWindow = window; });
await page.goto('https://musicbrainz.org/release/ec116461-5b0d-4c98-bb44-a4de5de63076/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Match works/.test(b.textContent)), null, { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /Match works/.test(b.textContent)).click());
await page.waitForSelector('.gt-wm-nwp-more', { timeout: 30000 });
await page.waitForTimeout(800);

const r = await page.evaluate(async () => {
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const out = {};
  const more = document.querySelector('.gt-wm-nwp-more');
  more.click(); await sleep(200);
  const pop = document.querySelector('.gt-wm-relopts');
  out.popOpened = !!pop;
  const liveCb = [...pop.querySelectorAll('label')].find(l => /^live$/i.test(l.textContent.trim()))?.querySelector('input');
  liveCb.click(); await sleep(100);
  out.chipWhileOpen = [...document.querySelectorAll('.gt-wm-ro-sum .gt-wm-nwp-chip')].map(c => c.textContent.replace('×', '').trim());
  // set a begin year too
  const yInp = pop.querySelector('.gt-wm-ro-y'); yInp.value = '2001'; yInp.dispatchEvent(new Event('input', { bubbles: true })); await sleep(100);
  // close the popover by clicking elsewhere
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(200);
  out.popClosed = !document.querySelector('.gt-wm-relopts');
  out.chipsAfterClose = [...document.querySelectorAll('.gt-wm-ro-sum .gt-wm-nwp-chip')].map(c => c.textContent.replace('×', '').trim());
  out.moreHighlighted = more.classList.contains('on');
  // × removes the live attribute
  const liveChip = [...document.querySelectorAll('.gt-wm-ro-sum .gt-wm-nwp-chip')].find(c => /live/.test(c.textContent));
  liveChip.querySelector('.gt-wm-nwp-x').click(); await sleep(100);
  out.chipsAfterRemove = [...document.querySelectorAll('.gt-wm-ro-sum .gt-wm-nwp-chip')].map(c => c.textContent.replace('×', '').trim());
  out.stillHighlighted = more.classList.contains('on');   // date still set → stays on
  return out;
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.popOpened, '⋯ opens the rel-options popover');
ck(r.chipWhileOpen.includes('live'), 'ticking "live" shows a chip immediately');
ck(r.popClosed && r.chipsAfterClose.includes('live') && r.chipsAfterClose.some(c => /2001/.test(c)), 'chips persist after the popover closes (live + date)');
ck(r.moreHighlighted, '⋯ button highlighted while options are set');
ck(!r.chipsAfterRemove.includes('live') && r.chipsAfterRemove.some(c => /2001/.test(c)), 'chip × removes the attribute, date chip stays');
ck(r.stillHighlighted, 'highlight persists while the date remains');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
