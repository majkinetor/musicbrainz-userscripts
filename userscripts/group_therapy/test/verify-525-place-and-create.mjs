// #525 (majkinetor), the four follow-ups to the text parser:
//   1. the maximized window slid under the vertical scrollbar
//   2. seed the create form (type=Person + sort name, artists only) and adopt
//      the MBID once the create tab lands on the new entity
//   3. Place as a first-class entity — its own roles and a picker tab
//   4. presets: drop the two trailing ones, add "R by E[&]"
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero at the end.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/group_therapy/group_therapy.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const RELEASE_GID = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';

for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE_GID}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);

let posts = 0;
await page.route('**/*', route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
await page.addScriptTag({ content: code });
await page.waitForTimeout(800);

// open the text parser
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.waitForTimeout(400);

// ── 4. presets ──────────────────────────────────────────────────────────────
const presets = await page.locator('.gt-tp-presets .gt-tp-chip').allTextContents();
console.log('presets: ' + JSON.stringify(presets));
ck(!presets.includes('R - E') && !presets.includes('E: R'), 'the two trailing presets are gone');
ck(presets.includes('R by E[&]'), '"R by E[&]" is offered');

// and it must actually parse — [&] splits on " & "
const parsed = await page.evaluate(() => {
  const api = window.__gtTxp || null;
  return api ? null : null;   // engine isn't exported; drive it through the UI instead
});
await page.evaluate(() => {
  const ta = document.querySelector('.gt-tp-src textarea, .gt-tp textarea');
  if (ta) { ta.value = 'Recorded at Abbey Road Studios\nProduced by Alice Smith & Bob Jones'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  const pat = document.querySelector('.gt-tp-pat');
  if (pat) { pat.value = 'R by E[&]'; pat.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.waitForTimeout(700);
const rows = await page.locator('.gt-tp-row, .gt-tp-tbl tbody tr').count();
console.log('rows after "R by E[&]": ' + rows);
ck(rows >= 2, 'the "&" split produces a row per entity (' + rows + ')');

// ── 1. maximize must not slide under the scrollbar ──────────────────────────
const geo = await page.evaluate(() => {
  document.body.style.minHeight = '6000px';   // guarantee a vertical scrollbar to overlap
  const btn = [...document.querySelectorAll('.gt-tp button')].find(b => /^[⛶❐]$/.test((b.textContent || '').trim()));
  if (btn) btn.click();
  const p = document.querySelector('.gt-tp').getBoundingClientRect();
  return { right: Math.round(p.right), docW: document.documentElement.clientWidth, innerW: window.innerWidth, bottom: Math.round(p.bottom), docH: document.documentElement.clientHeight };
});
console.log('maximized: ' + JSON.stringify(geo));
ck(geo.right <= geo.docW && geo.bottom <= geo.docH, 'the maximized panel fits the client box');
// Headless Chromium draws OVERLAY scrollbars, so clientWidth === innerWidth and
// the geometric check above can never fail here — it would pass just as happily
// against the old 98vw rule. Assert the actual mechanism instead: inset-based
// fixed positioning is what stops the overlap on a real classic scrollbar.
const how = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.gt-tp'));
  return { position: cs.position, right: cs.right, bottom: cs.bottom, width: cs.width };
});
console.log('maximize mechanism: ' + JSON.stringify(how));
ck(how.position === 'fixed', 'the maximized panel is fixed-positioned');
ck(how.right !== 'auto' && how.bottom !== 'auto', 'and sized by insets rather than a vw width (which counts the scrollbar)');

// ── 3. Place: roles, tab, search ────────────────────────────────────────────
const placeRoles = await page.evaluate(() => {
  const lts = window.MB?.linkedEntities?.link_type || {};
  return Object.values(lts).filter(t => t.type0 === 'place' && t.type1 === 'release' && !t.deprecated).map(t => t.name);
});
console.log('place↔release roles available: ' + placeRoles.length + ' — ' + placeRoles.slice(0, 4).join(', '));
ck(placeRoles.includes('recorded at'), 'MB really does model "recorded at" as place→release');

// "Recorded at X" should classify as a PLACE row, not artist
await page.evaluate(() => {
  const ta = document.querySelector('.gt-tp-src textarea, .gt-tp textarea');
  if (ta) { ta.value = 'Recorded at: Abbey Road Studios'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  const pat = document.querySelector('.gt-tp-pat');
  if (pat) { pat.value = 'R: E'; pat.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.waitForTimeout(900);
// role classification happens in the Resolve pass, not on keystroke
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gt-tp button')].find(x => /Match|Resolv/i.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll('.gt-tp button')].find(x => /Match|Resolv/i.test(x.textContent || ''));
  return b && !/Resolving/i.test(b.textContent);
}, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const typeCell = await page.evaluate(() => {
  const t = document.querySelector('.gt-tp-tbl');
  return t ? t.textContent.replace(/\s+/g, ' ').slice(0, 400) : '';
});
console.log('table: ' + typeCell);
// The table shows the matched ROLE and ENTITY, not the word "place". Combined
// with the check above — "recorded at" exists as place→release and NOT as
// artist→release — a resolved "recorded at" row can only have come from the
// place candidates, which is the thing #525 asked for.
const artistHasRecordedAt = await page.evaluate(() => Object.values(window.MB?.linkedEntities?.link_type || {})
    .some(t => t.type0 === 'artist' && t.type1 === 'release' && !t.deprecated && t.name.toLowerCase() === 'recorded at'));
ck(!artistHasRecordedAt, '"recorded at" is not an artist→release type, so a match can only be the place one');
ck(/recorded at/i.test(typeCell), 'the role resolved to "recorded at"');
ck(/ready/i.test(typeCell), 'and the row is ready to stage (place entity resolved too)');

ck(posts === 0, 'nothing was ever submitted (' + posts + ' POSTs to /edit)');
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
