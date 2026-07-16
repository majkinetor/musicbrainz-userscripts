// #419 — join-phrase presets: typing filters the dropdown live, ArrowDown/Up navigate,
// Enter picks the highlighted row, Esc closes. Uses RAM (has "feat." track credits).
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, bypassCSP: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor', { timeout: 40000 });
await page.waitForTimeout(4000);
await page.addScriptTag({ content: script });
await page.waitForSelector('input.tc-join', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(5000);   // let Apollo's initial sync/rebuild passes settle — they replace the row's inputs

const r = await page.evaluate(async () => {
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const inp = document.querySelector('input.tc-join');
  const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const popState = () => {
    const pop = document.querySelector('.tc-joinpop');
    if (!pop) return null;
    const rows = [...pop.querySelectorAll('.tc-acrow')];
    return { labels: rows.map(x => x.querySelector('.nm')?.textContent), hi: rows.findIndex(x => x.classList.contains('hi')) };
  };
  const out = {};
  inp.focus();
  // 1. type "fe" → filtered popup, first row pre-highlighted
  inp.value = 'fe'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(100);
  out.typed = popState();
  // 2. ArrowDown moves the highlight
  key(inp, 'ArrowDown'); await sleep(50);
  out.afterDown = popState();
  // 3. Enter picks the highlighted preset
  key(inp, 'Enter'); await sleep(100);
  out.picked = { value: inp.value, popGone: !document.querySelector('.tc-joinpop') };
  // 4. ArrowDown on the (now non-empty) field opens filtered again; Esc closes
  key(inp, 'ArrowDown'); await sleep(50);
  out.reopened = !!document.querySelector('.tc-joinpop');
  key(inp, 'Escape'); await sleep(50);
  out.escClosed = !document.querySelector('.tc-joinpop');
  // 5. the ▾ arrow still opens the full list
  document.querySelector('.tc-joinarrow').click(); await sleep(50);
  out.arrowAll = popState();
  document.querySelector('.tc-joinarrow').click(); await sleep(50);
  return out;
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.typed && r.typed.labels.join(',') === 'feat.,featuring' && r.typed.hi === 0, 'typing "fe" filters to feat./featuring, top hit pre-highlighted');
ck(r.afterDown && r.afterDown.hi === 1, 'ArrowDown moves the highlight');
ck(r.picked.value === ' featuring ' && r.picked.popGone, 'Enter picks the highlighted preset and closes');
ck(r.reopened, 'ArrowDown reopens the list');
ck(r.escClosed, 'Escape closes it');
ck(r.arrowAll && r.arrowAll.labels.length === 12, 'the ▾ button still lists all presets');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
