// #544 round 5 (majkinetor), three follow-ups to round 4:
//
//   1. "Maximized state is still not remembered."
//   2. 'Button "load and remove annotation" is lost when exiting / returning'
//   3. "The new `creating ...` placeholder stays forever if there is error/tab
//      closed. I should be able to cancel it like in CH"
//
// (1) is a re-test of something round 3 claimed to fix and verify-544-state-
// roundtrip still passes. That test maximizes and then FREEZES, and the freeze
// saves — so the maximize was never the thing being carried. This one closes
// immediately after maximizing, with nothing else touched in between, which is
// what majkinetor actually does. It asserts the no-save-in-between explicitly so
// it cannot silently become vacuous again.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // has an annotation — needed by check 2
const NL = String.fromCharCode(10);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_openInTab = (u, o) => {
    window.__gtOpened = { u, o };
    // a handle that never reports itself closed, so the CANCEL path under test is
    // the click and not the tab watcher
    return { close() { window.__gtClosed = true; }, closed: false };
  };
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4500);
let posts = 0;
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
await page.addScriptTag({ content: code });
await page.waitForTimeout(800);

const openParser = async () => {
  if (await page.locator('.gt-tp').count()) return;
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await page.waitForTimeout(500);
};
const closeParser = async () => {
  await page.evaluate(() => { const x = [...document.querySelectorAll('.gt-tp .gt-cons-x')].find(b => b.textContent.includes('✕')); if (x) x.click(); });
  await page.waitForTimeout(400);
};
const setText = async (text, pat) => {
  await page.evaluate(({ text, pat }) => {
    const ta = document.querySelector('.gt-tp textarea');
    if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    const p = document.querySelector('.gt-tp-pat');
    if (p) { p.value = pat; p.dispatchEvent(new Event('input', { bubbles: true })); }
  }, { text, pat });
  await page.waitForTimeout(700);
};
const isMax = () => page.evaluate(() => !!document.querySelector('.gt-tp.gt-tp-max') || !!document.querySelector('.gt-tp .gt-tp-max') || !!(document.querySelector('.gt-cons.gt-tp') || {}).classList?.contains('gt-tp-max'));

// ── 1. maximize, close, reopen — with NOTHING else touched in between ───────
await openParser();
await setText(`Producer: Someone Unresolvable Xyzzy${NL}Mixer: Another Unresolvable Xyzzy`, 'R: E');
ck(!await isMax(), 'the parser starts restored, not maximized');
// From here to closeParser, the ONLY thing touched is the maximize button — which
// is the whole point: round 3's version of this test froze a pattern in between,
// and the freeze is what did the saving.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gt-tp .gt-cons-x')].find(x => x.textContent.includes('⛶') || x.textContent.includes('❐'));
  if (b) b.click();
});
await page.waitForTimeout(300);
ck(await isMax(), 'clicking ⛶ maximizes the window');
await page.locator('.gt-tp').screenshot({ path: resolve(SHOTS, 'i544r5-maximized.png') }).catch(() => {});
await closeParser();
ck(await page.locator('.gt-tp').count() === 0, 'the window really closed (otherwise nothing below is a test)');
await openParser();
const backMax = await isMax();
console.log('after maximize → close → reopen: maximized=' + backMax);
ck(backMax, '#544.1: THE FIX — the maximized state comes back with no other action in between');

// ── 2. "Apply & clear annotation" survives a close ──────────────────────────
const annoLoaded = await page.evaluate(async () => {
  const b = [...document.querySelectorAll('.gt-tp button')].find(x => /load annotation/i.test(x.textContent || ''));
  if (!b) return { missing: true };
  b.click();
  for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 100)); if (!/loading/i.test(b.textContent)) break; }
  await new Promise(r => setTimeout(r, 500));
  const clr = document.querySelector('.gt-cons-btn');
  const btn = [...document.querySelectorAll('.gt-tp .gt-cons-btn')].find(x => /apply & clear annotation/i.test(x.textContent || ''));
  return { missing: false, text: (document.querySelector('.gt-tp textarea') || {}).value || '', shown: !!(btn && btn.style.display !== 'none') };
});
console.log('after Load annotation: ' + JSON.stringify(annoLoaded));
ck(!annoLoaded.missing, 'the parser offers "Load annotation"');
ck(/\S/.test(annoLoaded.text), 'fixture: this release really has an annotation to load (otherwise the check below is vacuous)');
ck(annoLoaded.shown, '"Apply & clear annotation" appears once the text came from the annotation');
await closeParser();
await openParser();
const afterReopen = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.gt-tp .gt-cons-btn')].find(x => /apply & clear annotation/i.test(x.textContent || ''));
  return { shown: !!(btn && btn.style.display !== 'none'), text: (document.querySelector('.gt-tp textarea') || {}).value || '' };
});
console.log('after close → reopen: ' + JSON.stringify(afterReopen));
ck(/\S/.test(afterReopen.text), 'the annotation text came back');
ck(afterReopen.shown, '#544.2: THE FIX — and "Apply & clear annotation" came back with it');
await page.locator('.gt-tp').screenshot({ path: resolve(SHOTS, 'i544r5-anno.png') }).catch(() => {});

// ── 3. the "creating…" placeholder can be cancelled ─────────────────────────
await setText(`Producer: Zzq Cancel Me Xyzzy${NL}Mixer: Zzq Cancel Me Xyzzy${NL}Guitar: Someone Else Entirely`, 'R: E');
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.gt-tp-tbl tbody tr')];
  const btns = [...rows[0].querySelectorAll('button.gt-tp-search')];
  btns[btns.length - 1].click();
});
await page.waitForSelector('.gt-tp-apop', { timeout: 8000 });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('.gt-tp-plus').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
await page.waitForTimeout(500);
const creating = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.gt-tp-creating')];
  return { n: els.length, tag: els[0] && els[0].tagName, text: els[0] && els[0].textContent.trim(), title: els[0] && els[0].title };
});
console.log('creating placeholders: ' + JSON.stringify(creating));
ck(creating.n === 2, 'both rows with that name show "creating…" (' + creating.n + ')');
ck(creating.tag === 'BUTTON', '#544.3: the placeholder is a button, not inert text');
ck(/✕/.test(creating.text || ''), 'it shows a ✕ affordance — ' + JSON.stringify(creating.text));
ck(/click to stop waiting/i.test(creating.title || ''), 'and its tooltip says clicking cancels');
await page.locator('.gt-tp').screenshot({ path: resolve(SHOTS, 'i544r5-creating-cancel.png') }).catch(() => {});

await page.evaluate(() => document.querySelector('.gt-tp-creating').click());
await page.waitForTimeout(600);
const cancelled = await page.evaluate(() => ({
  creating: document.querySelectorAll('.gt-tp-creating').length,
  searchBtns: [...document.querySelectorAll('.gt-tp-tbl tbody tr')].map(r => [...r.querySelectorAll('button.gt-tp-search')].length),
}));
console.log('after clicking the placeholder: ' + JSON.stringify(cancelled));
ck(cancelled.creating === 0, '#544.3: THE FIX — clicking clears it, on BOTH rows (they share the name)');
// two buttons per unresolved row = role search + ENTITY search. Asserting ">=1"
// would pass on the broken build too, where the stuck rows kept only the role one.
ck(cancelled.searchBtns.every(n => n === 2), 'and the entity search is back on every row — ' + JSON.stringify(cancelled.searchBtns));
// A cancelled create must stay cancelled: if the tab commits anyway later, that
// post-back must not silently rewrite rows the user has stopped waiting on.
await page.evaluate(() => {
  const u = new URL(window.__gtOpened.u, location.origin);
  const ch = new BroadcastChannel('gt-entity-created');
  ch.postMessage({ token: u.searchParams.get('x_gtcreate'), kind: 'artist', gid: '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7' });
});
await page.waitForTimeout(2000);
const afterLate = await page.evaluate(() => ({
  creating: document.querySelectorAll('.gt-tp-creating').length,
  rows: [...document.querySelectorAll('.gt-tp-tbl tbody tr')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim()),
}));
console.log('after a late post-back: ' + JSON.stringify(afterLate));
ck(afterLate.creating === 0, 'a late post-back does not bring the placeholder back (' + afterLate.creating + ')');
ck(!afterLate.rows.some(t => /もちこまめ/.test(t)), 'and does not resolve the rows either — the cancel really unsubscribed');

ck(posts === 0, 'nothing was submitted (' + posts + ' POSTs to /edit)');
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
console.log(fail ? `FAIL (${fail})` : 'PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
