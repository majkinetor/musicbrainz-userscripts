// #544 follow-up (majkinetor): "It doesn't close the tab after commit, like
// CH/Apollo."
//
// The created entity's page does call window.close() on itself, but that is a
// no-op for a tab opened by GM_openInTab unless the script grants window.close.
// So the OPENER closes it, using the handle GM_openInTab hands back — exactly
// what Credit Hoarder does, and for the same reason (#273: "a GM-opened tab
// can't always self-close via window.close()").
//
// GM_openInTab is mocked with window.open here, so a REAL second tab opens, the
// script really auto-submits in it, the entity is really created, the MBID is
// really posted back over BroadcastChannel, and the opener really closes the
// tab. Nothing about that chain is faked except the one API a userscript
// manager would provide.
//
// Sandbox only. It creates one artist on test.musicbrainz.org, deliberately.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const NAME = 'GT TabClose ' + Date.now().toString(36);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  window.GM_getValue = (k, d) => { const v = localStorage.getItem('gmtest:' + k); return v === null ? d : JSON.parse(v); };
  window.GM_setValue = (k, v) => localStorage.setItem('gmtest:' + k, JSON.stringify(v));
  window.GM_deleteValue = k => localStorage.removeItem('gmtest:' + k);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
  // The one thing a userscript manager provides that a browser does not. It
  // must hand back a handle with .close(), which is the whole point here.
  window.GM_openInTab = (url, opts) => {
    const w = window.open(url, '_blank');
    window.__gtTabOpened = url;
    return { close() { window.__gtTabCloseCalled = true; try { w && w.close(); } catch (e) {} }, get closed() { return !w || w.closed; } };
  };
});
// The script is injected per DOCUMENT, not via addInitScript: Group Therapy is
// an @run-at document-end script and does not survive being evaluated at
// document-start — measured, the created tab produced not one of its own log
// lines that way, while the same page injected after DOMContentLoaded submits
// itself immediately. waitForLoadState covers the tab's FIRST document (it
// resolves at once if that already fired) and the listener covers every
// navigation after it; doing only one of the two is what made this look like
// the bug under test twice over.
const injected = new WeakMap();
const inject = async (p) => {
  const u = p.url();
  if (injected.get(p) === u) return;      // one instance per document, like a real manager
  injected.set(p, u);
  try { await p.addScriptTag({ content: code }); } catch (e) {}
};
ctx.on('page', async (p) => {
  p.on('console', m => { const t = m.text(); if (!/Mixed Content|favicon|sentry/i.test(t)) console.log('   [tab] ' + t.slice(0, 140)); });
  p.on('pageerror', e => console.log('   [tab pageerror] ' + e.message.slice(0, 140)));
  p.on('domcontentloaded', () => { const u = p.url(); if (/\/artist\/[0-9a-f-]{36}/.test(u)) tabReached = u; inject(p); });
  p.on('framenavigated', f => { if (f === p.mainFrame() && /\/artist\/[0-9a-f-]{36}/.test(f.url())) tabReached = f.url(); });
  try { await p.waitForLoadState('domcontentloaded', { timeout: 30000 }); await inject(p); } catch (e) {}
});
let tabReached = null;   // where the background tab ended up (it closes too fast to poll)
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

// Drive the real background-create path: open the parser, paste a line whose
// entity is our unique new name, open its entity picker, right-click the +.
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.evaluate((n) => {
  const ta = document.querySelector('.gt-tp-ta');
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set;
  set.call(ta, 'Mastering: ' + n); ta.dispatchEvent(new Event('input', { bubbles: true }));
}, NAME);
await page.waitForTimeout(600);
// a pattern, so the pasted line actually produces a row
await page.evaluate(() => {
  const p = document.querySelector('.gt-tp-pat');
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p), 'value').set;
  set.call(p, 'R: E'); p.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(2500);

const rows = await page.evaluate(() => document.querySelectorAll('.gt-tp-tbl tbody tr').length);
console.log('parsed rows: ' + rows);
ck(rows >= 1, `the pasted line produced a row (${rows})`);

// Both the role cell and the entity cell render a "search" button; the ENTITY
// one is the last in the row. Clicking the first opened the role picker, which
// has no + at all — the create never started and every later assertion failed.
const opened = await page.evaluate(() => {
  const row = document.querySelector('.gt-tp-tbl tbody tr');
  const btns = row ? [...row.querySelectorAll('.gt-tp-search')] : [];
  if (!btns.length) return 0;
  btns[btns.length - 1].click();
  return btns.length;
});
console.log('search buttons in the row: ' + opened);
ck(opened >= 1, 'the row offers an entity picker (the last "search" button in the row)');
await page.waitForSelector('.gt-tp-apop .gt-tp-plus', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);

const before = ctx.pages().length;
console.log('pages before the create: ' + before);
const fired = await page.evaluate(() => {
  const plus = document.querySelector('.gt-tp-plus');
  if (!plus) return false;
  plus.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  return true;
});
ck(fired, 'right-clicking + starts a background create');

// the tab really opens, really submits, and the artist really gets created
let tabUrl = null;
for (let i = 0; i < 60; i++) {
  const extra = ctx.pages().filter(p => p !== page);
  if (extra.length) { tabUrl = extra[0].url(); if (/\/artist\/[0-9a-f-]{36}/.test(tabUrl)) break; }
  await page.waitForTimeout(1000);
}
const extra = ctx.pages().filter(p => p !== page)[0];
if (extra) {
  try {
    console.log('tab state: ' + JSON.stringify(await extra.evaluate(() => {
      let pending = null;
      try { pending = JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { pending = 'THREW'; }
      const form = document.querySelector('form.edit-artist');
      return { path: location.pathname, ready: document.readyState, hook: !!window.__groupTherapy,
               pending, urlToken: new URLSearchParams(location.search).get('x_gtcreate'),
               form: !!form, submit: !!(form && form.querySelector('button[type=submit]')),
               name: form && (form.querySelector('[name="edit-artist.name"]') || {}).value };
    })));
  } catch (e) { console.log('tab state: unreadable (' + e.message.slice(0, 60) + ')'); }
}
console.log('background tab reached: ' + tabUrl);
ck(!!tabUrl, 'a background tab really opened');
// Polling the tab's URL is unreliable here BY DESIGN: once the fix works the
// opener closes the tab within a moment of it landing, so a 1s poll can miss
// the artist page entirely. Recorded from its navigation events instead.
console.log('tab navigated to: ' + tabReached);
ck(!!tabReached, 'and it submitted itself through to the created artist — ' + tabReached);

// ── the point: the opener closes it ─────────────────────────────────────────
let closed = false;
if (tabUrl || tabReached) {
  for (let i = 0; i < 40; i++) {
    if (ctx.pages().filter(p => p !== page).length === 0) { closed = true; break; }
    await page.waitForTimeout(500);
  }
}
console.log('pages after: ' + ctx.pages().length + ' (started at ' + before + ')');
// guarded on the tab having opened at all — otherwise "no extra pages" is
// trivially true and this assertion would pass having observed nothing
ck(!!tabReached && closed, 'THE FIX: the background tab is closed once the create commits');
const viaHandle = await page.evaluate(() => !!window.__gtTabCloseCalled);
ck(viaHandle, 'and it was closed through the GM_openInTab handle, not left to the tab itself');

// And the row really resolved. Asserting on the row's TEXT would pass on the
// raw pasted line alone (it contains the name already) — so read the resolved
// entity cell's link, which only exists once a real MBID is bound to the row.
const resolved = await page.evaluate(() => {
  const row = document.querySelector('.gt-tp-tbl tbody tr');
  const a = row && [...row.querySelectorAll('a[href*="/artist/"]')].pop();
  return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null;
});
console.log('resolved entity cell: ' + JSON.stringify(resolved));
ck(!!resolved && /\/artist\/[0-9a-f-]{36}/.test(resolved.href), 'the row is bound to a real MBID, not just showing the pasted text');
ck(!!resolved && resolved.text.includes(NAME), 'and it is the entity that was just created — ' + JSON.stringify(resolved && resolved.text));

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
