// #583 (majkinetor). The first cut of this was a selection model — checkboxes in
// the # column, shift-ranges, Delete. He reverted it:
//
//   "Revert all that. Add [+] icon next next to 'revert' hover action (first
//    position on the right so it doesn't move around) (for any item not already
//    new)."
//
// and, earlier: "[+] is now available when you open recording search, for
// quicker access without opening search popup, make it available as row hover
// action." So: the picker's "add a new recording" action, on the row.
//
// What that has to get right, and what is checked here:
//   · ＋ on every row that isn't already a new recording, and on no other
//   · it unsets THAT row and nothing else
//   · it is the FIRST position on the right, and stays at the same x whether or
//     not the row also shows ↺ — that is the whole point of "so it doesn't move
//     around", and it is measured, not assumed
//   · ↺ still reverts the row afterwards
//
// The click is a real click on the rendered button. Nothing is submitted.
//
// Pre-fix build: `.tc-rec-new-btn` does not exist, so the first check fails.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';   // 13 tracks, all linked
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('recording'));
  if (b) b.click();
});
await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(1500);

const state = () => page.evaluate(() => {
  const r = window.__apolloEditor.readRecordings();
  const rows = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')];
  return {
    linked: r.map(x => (x.isNew ? 'N' : x.recGid ? 'L' : '-')).join(''),
    rows: rows.length,
    plus: rows.filter(x => x.querySelector('.tc-rec-new-btn')).length,
    revs: rows.filter(x => x.querySelector('.tc-rec-rev')).length,
    // ＋ on exactly the rows that aren't already new
    plusMatchesNotNew: rows.every((x, i) => !!x.querySelector('.tc-rec-new-btn') === (r[i] && !r[i].isNew)),
    // x of ＋ on every row that has one — one distinct value means it never shifts
    plusX: [...new Set(rows.map(x => x.querySelector('.tc-rec-new-btn')).filter(Boolean)
      .map(b => Math.round(b.getBoundingClientRect().right)))],
    // ＋ must be to the RIGHT of ↺ wherever both are shown
    plusRightOfRev: rows.filter(x => x.querySelector('.tc-rec-new-btn') && x.querySelector('.tc-rec-rev'))
      .map(x => Math.round(x.querySelector('.tc-rec-new-btn').getBoundingClientRect().left)
              - Math.round(x.querySelector('.tc-rec-rev').getBoundingClientRect().right)),
  };
});

const s0 = await state();
console.log('start:', JSON.stringify(s0));
ck(s0.plus > 0, `rows carry a ＋ action (${s0.plus} of ${s0.rows})`);
ck(/^L+$/.test(s0.linked), `fixture: every track starts linked (${s0.linked})`);
ck(s0.plusMatchesNotNew, '＋ appears on exactly the rows that are not already a new recording');
ck(s0.revs === 0, `no ↺ yet — nothing has changed (${s0.revs})`);
ck(s0.plusX.length === 1, `every ＋ is at the same x (${JSON.stringify(s0.plusX)})`);

// click ＋ on track 11
const before = s0.plusX[0];
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')].find(r => r.dataset.ti === '10');
  tr.querySelector('.tc-rec-new-btn').click();
});
await page.waitForTimeout(800);
const s1 = await state();
console.log('after ＋ on track 11:', JSON.stringify(s1));
const want = s0.linked.split('').map((c, i) => (i === 10 ? 'N' : c)).join('');
ck(s1.linked === want, `only that row was unset (${s1.linked}, wanted ${want})`);
ck(s1.revs === 1, `the unset row now offers ↺ (${s1.revs})`);
ck(s1.plus === s0.plus - 1, `the unset row no longer offers ＋ — it is already new (${s1.plus})`);
ck(s1.plusX.length === 1 && s1.plusX[0] === before,
  `＋ did not move when ↺ appeared beside it (${JSON.stringify(s1.plusX)} vs ${before})`);

/* The case his "so it doesn't move around" is actually about: a row showing
   BOTH buttons. An unset row can't be it — unsetting makes the row new, which
   drops its ＋ — so it takes a row that CHANGED without becoming new, i.e. one
   pointing at a different recording. Swap track 1's link for track 2's to
   produce exactly that; without this step the both-shown check has no row to
   look at and passes vacuously. */
await page.evaluate(() => {
  const m = window.MB.releaseEditor.rootField.release().mediums()[0];
  const t = m.tracks();
  t[0].setRecordingValue(t[1].recording());
});
await page.waitForTimeout(2500);
const s2 = await state();
console.log('after pointing track 1 at another recording:', JSON.stringify(s2));
ck(s2.plusRightOfRev.length > 0, `there is now a row showing BOTH ＋ and ↺ (${s2.plusRightOfRev.length}) — the case the fixed position is for`);
ck(s2.plusRightOfRev.every(gap => gap >= 1), `on those rows ＋ holds the first position on the right, clear of ↺ (gaps ${JSON.stringify(s2.plusRightOfRev)})`);
ck(s2.plusX.length === 1 && s2.plusX[0] === before, `＋ still at the same x with ↺ beside it (${JSON.stringify(s2.plusX)} vs ${before})`);

// ↺ puts the original back
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')].find(r => r.dataset.ti === '10');
  tr.querySelector('.tc-rec-rev').click();
});
await page.waitForTimeout(800);
const s3 = await state();
console.log('after ↺ on track 11:', JSON.stringify({ linked: s3.linked }));
ck(s3.linked[10] === 'L', `↺ restored the original link on that row (${s3.linked})`);

// and the selection machinery is gone
const gone = await page.evaluate(() => ({
  cells: document.querySelectorAll('.tc-recselcell').length,
  unsetBtn: document.querySelectorAll('.tc-rec-unset').length,
  api: !!(window.__apolloEditor.recSelToggleRow || window.__apolloEditor.unsetRecordings),
}));
console.log('reverted selection UI:', JSON.stringify(gone));
ck(gone.cells === 0 && gone.unsetBtn === 0 && !gone.api, 'the checkbox/Delete selection model is gone, as asked');

await page.screenshot({ path: resolve(HERE, 'logs', 'i583-plus-row-action.png') }).catch(() => {});
ck(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
