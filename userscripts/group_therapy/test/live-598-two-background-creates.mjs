// #598 (majkinetor): "When 2 background tabs are open creating artist, one of
// them doesn't close and consequently return MBID to Text Pattern."
//
// The cause was a single-slot store. Every background create wrote
//
//     GM_setValue('gt:pendingCreate', { kind, token, ts })
//
// so starting a second one OVERWROTE the first. Tab A's seeded /artist/create
// page then read back tokenB, concluded "this create page is not the one we
// opened", and never pressed Enter — leaving a tab parked on a filled-in form
// and a row spinning on "creating…" until the ten-minute timeout. Tab B, whose
// token happened to be the surviving one, worked perfectly, which is why this
// only ever showed up as "ONE of them doesn't finish".
//
// This is the test that has to fail on the old build, so it drives the real UI
// end to end: two rows, two right-clicks on +, two real tabs, two real artists
// on the sandbox, two MBIDs really posted back. GM_openInTab is mocked with
// window.open — the single API a userscript manager provides that a browser
// does not — and nothing else in the chain is faked.
//
//   pre-fix : 1 tab left open, 1 row unresolved   -> FAILS
//   post-fix: 0 tabs left open, 2 rows resolved   -> passes
//
// Sandbox only. It deliberately creates TWO artists on test.musicbrainz.org.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.GT_SRC || resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const STAMP = Date.now().toString(36);
const NAMES = ['GT Two A ' + STAMP, 'GT Two B ' + STAMP];
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const T0 = Date.now(); const ms = () => ('+' + String(Date.now() - T0).padStart(6) + 'ms');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  window.GM_getValue = (k, d) => { const v = localStorage.getItem('gmtest:' + k); return v === null ? d : JSON.parse(v); };
  window.GM_setValue = (k, v) => localStorage.setItem('gmtest:' + k, JSON.stringify(v));
  window.GM_deleteValue = k => localStorage.removeItem('gmtest:' + k);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
  window.__gtClosed = 0;
  window.GM_openInTab = (url, opts) => {
    const w = window.open(url, '_blank');
    (window.__gtTabsOpened || (window.__gtTabsOpened = [])).push(url);
    return { close() { window.__gtClosed++; try { w && w.close(); } catch (e) {} }, get closed() { return !w || w.closed; } };
  };
});
// Per-document injection, exactly as live-544 does it: Group Therapy is an
// @run-at document-end script and does not survive evaluation at
// document-start, and the create tab navigates once (create -> entity) so both
// documents need it.
const injected = new WeakMap();
const inject = async (p) => {
  const u = p.url();
  if (injected.get(p) === u) return;
  injected.set(p, u);
  try { await p.addScriptTag({ content: code }); } catch (e) {}
};
const reached = [];        // every /artist/<mbid> any background tab landed on
ctx.on('page', async (p) => {
  const tag = '[tab' + (ctx.pages().length - 1) + ']';
  p.on('console', m => { const t = m.text(); if (/Group Therapy/.test(t)) console.log('   ' + ms() + ' ' + tag + ' ' + t.slice(0, 160)); });
  p.on('pageerror', e => console.log('   ' + tag + ' pageerror: ' + e.message.slice(0, 140)));
  const note = (u) => { if (/\/artist\/[0-9a-f-]{36}/.test(u) && !reached.includes(u)) reached.push(u); };
  p.on('domcontentloaded', () => { note(p.url()); inject(p); });
  p.on('framenavigated', f => { if (f === p.mainFrame()) note(f.url()); });
  try { await p.waitForLoadState('domcontentloaded', { timeout: 30000 }); note(p.url()); await inject(p); } catch (e) {}
});

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
await inject(page);
await page.waitForTimeout(1500);

// Two lines -> two rows, each with an entity nothing can resolve.
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.evaluate((ns) => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(document.querySelector('.gt-tp-ta'), 'Mastering: ' + ns[0] + '\nMixer: ' + ns[1]);
}, NAMES);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const p = document.querySelector('.gt-tp-pat');
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p), 'value').set.call(p, 'R: E');
  p.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(2500);

const rows = await page.evaluate(() => document.querySelectorAll('.gt-tp-tbl tbody tr').length);
console.log('parsed rows: ' + rows);
ck(rows >= 2, `both pasted lines produced a row (${rows})`);
if (rows < 2) { await ctx.close(); console.log('FAILURES: ' + ++fail); process.exit(1); }

// Fire the create on a given row: open ITS entity picker (the entity cell's
// search button is the last in the row; the first one opens the role picker,
// which has no + at all) and right-click the +.
// ⚠ No settling pause anywhere in here. The overlap IS the test: the second
// create has to be started while the first tab is still sitting on its
// /artist/create page, which is the only window in which the old single-slot
// store could be overwritten under it. A first attempt at this test waited
// 1.5s between the two and added a 1.2s settle inside the picker — by then tab
// A had already pressed Enter, landed, posted back and closed, the two creates
// never overlapped at all, and the whole thing passed against the BROKEN build.
// The popover is built synchronously, so + exists the moment it is opened;
// waiting for the entity search to come back is not needed and is exactly the
// delay that hid the bug.
const fire = async (idx) => {
  const opened = await page.evaluate((i) => {
    const row = document.querySelectorAll('.gt-tp-tbl tbody tr')[i];
    const btns = row ? [...row.querySelectorAll('.gt-tp-search')] : [];
    if (!btns.length) return false;
    btns[btns.length - 1].click();
    return true;
  }, idx);
  if (!opened) return false;
  await page.waitForSelector('.gt-tp-apop .gt-tp-plus', { timeout: 15000 }).catch(() => {});
  const ok = await page.evaluate(() => {
    const plus = document.querySelector('.gt-tp-plus');
    if (!plus) return false;
    plus.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    return true;
  });
  console.log(ms() + '  fired create on row ' + (idx + 1));
  return ok;
};

ck(await fire(0), 'right-clicking + on row 1 starts a background create');
ck(await fire(1), 'and row 2 starts a second one while the first is still in its tab');

const opened = await page.evaluate(() => (window.__gtTabsOpened || []).length);
console.log('tabs opened: ' + opened);
ck(opened === 2, `two background tabs really opened (${opened})`);

// Both tabs must submit themselves, land on their artist, and be closed by the
// opener. Poll for the END state rather than for either tab individually — a
// tab that works closes too fast to catch reliably.
for (let i = 0; i < 100; i++) {
  const extra = ctx.pages().filter(p => p !== page).length;
  if (reached.length >= 2 && extra === 0) break;
  await page.waitForTimeout(1000);
}
const left = ctx.pages().filter(p => p !== page);
console.log('artist pages reached: ' + JSON.stringify(reached));
console.log('background tabs still open: ' + left.length);
for (const p of left) {
  try {
    console.log('   stuck tab: ' + JSON.stringify(await p.evaluate(() => ({
      path: location.pathname, token: new URLSearchParams(location.search).get('x_gtcreate'),
      pending: (() => { try { return JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { return 'THREW'; } })(),
      tabMark: (() => { try { return sessionStorage.getItem('gt:createTab'); } catch (e) { return 'THREW'; } })(),
      name: (document.querySelector('[name="edit-artist.name"]') || {}).value,
    }))));
  } catch (e) { console.log('   stuck tab: unreadable'); }
}

ck(reached.length === 2, `BOTH creates submitted themselves through to a new artist (${reached.length} of 2)`);
ck(left.length === 0, `THE FIX: neither background tab is left open (${left.length} still open)`);
const closedCalls = await page.evaluate(() => window.__gtClosed || 0);
ck(closedCalls === 2, `and both were closed through the GM_openInTab handle (${closedCalls} close calls)`);

// And both rows really resolved — read the entity cell's link, which only
// exists once a real MBID is bound. Asserting on row TEXT would pass on the
// pasted line alone, since it already contains the name.
const bound = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-tbl tbody tr')].slice(0, 2).map(row => {
  const a = [...row.querySelectorAll('a[href*="/artist/"]')].pop();
  return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null;
}));
console.log('resolved cells: ' + JSON.stringify(bound, null, 1));
ck(bound.every(b => b && /\/artist\/[0-9a-f-]{36}/.test(b.href)), 'both rows are bound to a real MBID, not just showing the pasted text');
ck(bound[0] && bound[1] && bound[0].href !== bound[1].href, 'the two rows got DIFFERENT MBIDs — neither create overwrote the other');
ck(bound[0] && bound[0].text.includes(NAMES[0]), 'row 1 holds the artist row 1 asked for — ' + JSON.stringify(bound[0] && bound[0].text));
ck(bound[1] && bound[1].text.includes(NAMES[1]), 'row 2 holds the artist row 2 asked for — ' + JSON.stringify(bound[1] && bound[1].text));

// Nothing may be left behind: a pending record that outlives its create makes
// the NEXT create's entity page match the wrong token.
const leftover = await page.evaluate(() => { try { return JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { return 'THREW'; } });
console.log('pending store afterwards: ' + JSON.stringify(leftover));
ck(!leftover || (Array.isArray(leftover) && leftover.length === 0), 'the pending-create store is empty again');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
