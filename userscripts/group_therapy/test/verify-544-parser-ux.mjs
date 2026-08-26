// #544 (majkinetor), seven text-parser UX items:
//
//   1. right-click (+) creates the entity in the background
//   2. a pasted MBID resolves at once instead of showing one clickable result
//   3. the Pattern cell clipped its own caret once the column was narrower than
//      the input's fixed 110px
//   4. a [freeze pattern] option, as Apollo has
//   5. left click applies to every matching row (it was right click)
//   6. creating an entity seeds no edit note (CH/Apollo both do)
//   7. Up/Down do not work in the role picker
//
// Order matters here: each step is checked against a freshly rendered table.
// An earlier draft measured the Pattern cell after opening and closing the role
// picker and read 0x0 — a detached element, which would have passed every
// "is it inside its column" check while proving nothing.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const NL = String.fromCharCode(10);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
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
  if (await page.locator('.gt-tp').count()) return;   // already open
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await page.waitForTimeout(400);
};
const setText = async (text, pat) => {
  await page.evaluate(({ text, pat }) => {
    const ta = document.querySelector('.gt-tp textarea');
    if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    const p = document.querySelector('.gt-tp-pat');
    if (p) { p.value = pat; p.dispatchEvent(new Event('input', { bubbles: true })); }
  }, { text, pat });
  await page.waitForTimeout(800);
};
// The row's two "search" buttons are, in column order, the RESOLVED ROLE cell
// and then the RESOLVED ENTITY cell.
const clickSearch = async (which) => page.evaluate((which) => {
  const row = document.querySelector('.gt-tp-tbl tbody tr');
  const btns = [...row.querySelectorAll('button.gt-tp-search')];
  const b = which === 'role' ? btns[0] : btns[btns.length - 1];
  if (!b) return false;
  b.click();
  return true;
}, which);

await openParser();
await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');

// ── 2/5/6. the entity picker ────────────────────────────────────────────────
await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');
ck(await clickSearch('entity'), 'an unresolved row offers an entity search button');
await page.waitForSelector('.gt-tp-apop', { timeout: 8000 }).catch(() => {});
const pickerOpen = await page.locator('.gt-tp-apop').count() > 0;
ck(pickerOpen, 'the entity picker opens (otherwise the checks below prove nothing)');
if (pickerOpen) {
  const hint = ((await page.locator('.gt-tp-hint').textContent()) || '').trim();
  console.log('picker hint: ' + JSON.stringify(hint));
  ck(/^click: every row/i.test(hint), '#5: a plain click now applies to every row with this text');
  ck(/right-click: this row only/i.test(hint), 'and right-click is the single-row case');

  const plusTitle = await page.evaluate(() => (document.querySelector('.gt-tp-plus') || {}).title || '');
  console.log('plus title: ' + JSON.stringify(plusTitle));
  ck(/right-click to create in the background/i.test(plusTitle), '#1: the + button advertises background creation');

  // #2: paste an MBID → resolved and applied, no result row to click
  const pasted = await page.evaluate(async (gid) => {
    const q = document.querySelector('.gt-tp-q');
    q.value = gid;
    q.dispatchEvent(new Event('input', { bubbles: true }));
    for (let i = 0; i < 60 && document.querySelector('.gt-tp-apop'); i++) await new Promise(r => setTimeout(r, 100));
    const row = document.querySelector('.gt-tp-tbl tbody tr');   // the row the picker was opened from
    return { stillOpen: !!document.querySelector('.gt-tp-apop'), rowText: (row ? row.innerText : '').replace(/\s+/g, ' ').trim() };
  }, '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7');
  console.log('after pasting an MBID: ' + JSON.stringify(pasted));
  ck(!pasted.stillOpen, '#2: pasting an MBID resolves it immediately — the picker closes itself');
  ck(/もちこまめ/.test(pasted.rowText), 'and the row now carries that entity — ' + JSON.stringify(pasted.rowText.slice(0, 60)));
}

// ── 7. role picker: Up/Down ─────────────────────────────────────────────────
// (No Escape here: it closes the parser window itself, not just the popover.)
await page.waitForTimeout(300);
await openParser();
await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');
ck(await clickSearch('role'), 'an unresolved row offers a role search button');
await page.waitForSelector('.gt-role-pick', { timeout: 8000 }).catch(() => {});
ck(await page.locator('.gt-role-pick').count() > 0, 'the role picker opens');
const keyNav = await page.evaluate(async () => {
  const search = document.querySelector('.gt-role-search');
  // it opens prefilled with the row's role text, which filters to one match —
  // with a single row the arrows legitimately do nothing, so clear it first.
  search.value = '';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  const idx = () => [...document.querySelectorAll('.gt-role-row')].findIndex(r => r.classList.contains('gt-role-active'));
  const press = k => { search.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); return new Promise(r => setTimeout(r, 60)); };
  const start = idx();
  await press('ArrowDown'); const d1 = idx();
  await press('ArrowDown'); const d2 = idx();
  await press('ArrowUp'); const u1 = idx();
  await press('End'); const end = idx();
  await press('ArrowDown'); const wrapped = idx();   // past the end → back to the top
  return { start, d1, d2, u1, end, wrapped, total: document.querySelectorAll('.gt-role-row').length,
           activeName: (document.querySelector('.gt-role-row.gt-role-active .gt-role-name') || {}).textContent };
});
console.log('role picker keys: ' + JSON.stringify(keyNav));
ck(keyNav.total > 5, `the unfiltered list is long enough to navigate (${keyNav.total} roles)`);
ck(keyNav.start === 0, 'the first role starts highlighted');
ck(keyNav.d1 === 1 && keyNav.d2 === 2, '#7: ArrowDown walks the list');
ck(keyNav.u1 === 1, 'ArrowUp walks back');
ck(keyNav.end === keyNav.total - 1, 'End jumps to the last role');
ck(keyNav.wrapped === 0, 'and it wraps rather than sticking at the end');
await page.evaluate(() => { const b = document.querySelector('.gt-role-pick .gt-x'); if (b) b.click(); });
await page.waitForTimeout(300);

// ── 4. Freeze matched ───────────────────────────────────────────────────────
await setText(`Producer: もちこまめ${NL}Mixer: もちこまめ${NL}nonsense line with no pattern at all`, 'R: E');
const froze = await page.evaluate(async () => {
  const btn = [...document.querySelectorAll('.gt-tp button, .gt-cons-foot button')].find(b => /freeze/i.test(b.textContent || ''));
  if (!btn) return { missing: true };
  btn.click();
  await new Promise(r => setTimeout(r, 500));
  return { missing: false, overrides: [...document.querySelectorAll('.gt-tp-ov')].map(i => i.value) };
});
console.log('after freeze: ' + JSON.stringify(froze));
ck(!froze.missing, '#4: the parser offers a Freeze matched button');
ck(!froze.missing && froze.overrides.filter(v => v === 'R: E').length === 2, 'the two matching lines are pinned to the current pattern');
ck(!froze.missing && froze.overrides.some(v => !v), 'and the line that did not match is left alone');

// ── 6. the created entity's edit note ───────────────────────────────────────
const note = await page.evaluate(() => window.__groupTherapy.txpCreateNote('artist'));
console.log('create note: ' + JSON.stringify(note));
ck(/Group Therapy/.test(note), '#6: a created entity carries the script signature');
ck(/Created this artist/.test(note), 'says what it was doing');
ck(/musicbrainz\.org\/release\//.test(note) && !/edit-relationships/.test(note),
  'and names the release being edited, without the /edit-relationships suffix');

// ── 3. the Pattern cell keeps its caret inside a narrow column ──────────────
// Last, because typing into an override re-renders the table and that override
// then survives into whatever runs next.
// ⚠ Dispatching 'input' rebuilds the table, so the element measured must be
// re-queried afterwards — measuring the one captured before the rebuild gives
// 0x0 (a detached node), which silently satisfies "is it inside its column".
await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');
const cellGeo = await page.evaluate(async () => {
  let ov = document.querySelector('.gt-tp-ov');
  if (!ov) return { missing: true };
  ov.value = 'R[,] - E[,] a very long pattern';
  ov.dispatchEvent(new Event('input', { bubbles: true }));      // rebuilds the table
  await new Promise(r => setTimeout(r, 400));
  ov = document.querySelector('.gt-tp-ov');                      // the NEW input
  if (!ov) return { missing: true, why: 'gone after re-render' };
  const td = ov.closest('td');
  // Narrow the PATTERN column the way dragging its header does — the table is
  // table-layout:fixed with a <colgroup>, so a td's own style.width is ignored
  // (an earlier version set it and measured a 120px cell, never exercising the
  // narrow case at all). Column 1 is "pattern".
  const col = document.querySelector('.gt-tp-tbl colgroup').children[1];
  col.style.width = '60px';
  await new Promise(r => setTimeout(r, 150));
  ov.focus();
  const o = ov.getBoundingClientRect(), t = td.getBoundingClientRect();
  return {
    inputRight: Math.round(o.right), cellRight: Math.round(t.right),
    inputW: Math.round(o.width), cellW: Math.round(t.width),
    value: ov.value, scrolls: ov.scrollWidth > ov.clientWidth,
  };
});
console.log('pattern cell: ' + JSON.stringify(cellGeo));
ck(!cellGeo.missing && cellGeo.cellW > 0 && cellGeo.inputW > 0,
  'the pattern cell is laid out (a detached 0x0 element would satisfy every geometry check below)');
ck(!cellGeo.missing && cellGeo.cellW < 110,
  `the column really is narrower than the old fixed 110px input (${cellGeo.cellW}px) — otherwise this proves nothing`);
ck(!cellGeo.missing && cellGeo.value === 'R[,] - E[,] a very long pattern', 'and the long pattern really is in it');
ck(!cellGeo.missing && cellGeo.inputRight <= cellGeo.cellRight + 1, '#3: the input stays inside its column, however narrow');
ck(!cellGeo.missing && cellGeo.scrolls, 'and scrolls its own text, so the caret stays visible while typing');

ck(posts === 0, `nothing was submitted (${posts} POSTs to /edit)`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
