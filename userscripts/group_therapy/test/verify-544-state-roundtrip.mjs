// #544 follow-up (majkinetor): "When exiting and returning Text parser, any
// freezed patterns are gone. State should be kept completely."
//
// Freezing stamps the current pattern into each matching line's own override —
// that IS the freeze — and it was the one piece of row state saveState never
// carried, so reopening rebuilt every line with override:''. Two window states
// reset too: maximized, and whether the paste box was rolled up.
//
// The test closes and REOPENS the real window rather than inspecting the saved
// object: what matters is what comes back on screen.
//
// Read-only: every POST is aborted and asserted at zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const TEXT = 'Mastering: Nick Robbins\nProducer: Alice Example\nRecorded by - Bob Sample';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posts = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST' && /musicbrainz/.test(r.url())) { posts.push(r.url()); return route.abort(); }
  return route.continue();
});

for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1500);

const openParser = () => page.evaluate(() => window.__groupTherapy.openTextParser());
const closeParser = () => page.evaluate(() => window.__groupTherapy.closeTextParser());
const readUi = () => page.evaluate(() => {
  const panel = document.querySelector('.gt-tp');
  const ta = document.querySelector('.gt-tp-ta');
  return {
    open: !!panel,
    text: ta ? ta.value : null,
    pattern: (document.querySelector('.gt-tp-pat') || {}).value,
    overrides: [...document.querySelectorAll('.gt-tp-ov')].map(i => i.value),
    scope: (document.querySelector('.gt-tp-scope, select.gt-tp-scopekind') || {}).value,
    maximized: !!panel && panel.classList.contains('gt-tp-max'),
    srcOpen: !!ta && getComputedStyle(ta).display !== 'none',
    rows: document.querySelectorAll('.gt-tp-tbl tbody tr').length,
  };
});

await openParser();
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.waitForTimeout(500);

// paste text, set a pattern, freeze what matches (all three lines here)
await page.evaluate((t) => {
  const ta = document.querySelector('.gt-tp-ta');
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set;
  set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true }));
}, TEXT);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const p = document.querySelector('.gt-tp-pat');
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p), 'value').set;
  set.call(p, 'R: E'); p.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(800);

const beforeFreeze = await readUi();
console.log('before freeze: ' + JSON.stringify(beforeFreeze));
ck(beforeFreeze.rows >= 3, `the three pasted lines are in the table (${beforeFreeze.rows} rows)`);
ck(beforeFreeze.overrides.every(v => v === ''), 'and nothing is frozen yet');

await page.evaluate(() => document.querySelector('.gt-tp-freeze').click());
await page.waitForTimeout(700);
// also maximize, and roll the paste box up
await page.evaluate(() => {
  document.querySelector('.gt-tp .gt-cons-x').click();          // ⛶ is the first .gt-cons-x
  document.querySelector('.gt-tp-srctgl').click();
});
await page.waitForTimeout(500);

const frozen = await readUi();
console.log('after freeze: ' + JSON.stringify(frozen));
const frozenCount = frozen.overrides.filter(Boolean).length;
ck(frozenCount > 0, `freezing really stamped the pattern onto lines (${frozenCount} of ${frozen.overrides.length})`);
ck(frozen.overrides.filter(Boolean).every(v => v === 'R: E'), 'with the pattern that was in the box — ' + JSON.stringify(frozen.overrides));
ck(frozen.maximized, 'the window is maximized');
ck(!frozen.srcOpen, 'and the paste box is rolled up');

/* ── close and reopen — the point of the whole test ───────────────────────── */
await closeParser();
await page.waitForTimeout(400);
ck(!(await readUi()).open, 'the window really closed (otherwise nothing below is a test)');

await openParser();
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.waitForTimeout(900);
const back = await readUi();
console.log('after reopen : ' + JSON.stringify(back));

ck(back.text === frozen.text, 'the pasted text comes back');
ck(back.pattern === frozen.pattern, 'the pattern comes back');
ck(back.rows === frozen.rows, `the same rows come back (${back.rows} vs ${frozen.rows})`);
ck(JSON.stringify(back.overrides) === JSON.stringify(frozen.overrides),
  'THE FIX: the frozen patterns come back — ' + JSON.stringify(back.overrides));
ck(back.maximized === frozen.maximized, 'the window is still maximized');
ck(back.srcOpen === frozen.srcOpen, 'and the paste box is still rolled up');

console.log('POSTs: ' + JSON.stringify(posts));
ck(posts.length === 0, 'nothing was submitted');
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
