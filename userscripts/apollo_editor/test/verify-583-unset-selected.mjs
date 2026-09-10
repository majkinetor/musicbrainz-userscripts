// #583 (majkinetor): "Apollo currently only allows unsetting all links or
// one-by-one via recording search dialog. The former can be too broad while the
// latter can take many clicks. I'd suggest a shortcut to immediately unset
// selected recording link. Better yet, for whole medium or ranges (checkboxes 😛)."
//
// Rows now select from the # cell (shift extends, the medium header takes the
// whole medium, Ctrl+A all, Esc clears) and Delete unsets the selection — each
// unset track is flagged to create a NEW recording on submit, which is what he
// needs the unset FOR and what Clear all already meant by it.
//
// Everything here goes through the real UI: a click on the cell, a real
// shift-click, a real keydown on the document. Nothing is submitted, and the
// page is discarded afterwards without saving.
//
// Pre-fix build: there is no `.tc-recselcell` at all, so the first check fails.
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
/* A multi-medium release opens with its media collapsed; Apollo loads them on
   tab entry, which is a round-trip per medium — so wait generously, and fall
   back to the expand-all control if they are still folded. */
await page.waitForSelector('#tc-recwrap', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(1500);
if (!(await page.$('#tc-recwrap tbody tr.tc-recrow'))) {
  await page.evaluate(() => { const b = document.querySelector('#tc-recwrap .tc-recmed-exp'); if (b) b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
}
await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 60000 });
await page.waitForTimeout(2500);

const state = () => page.evaluate(() => {
  const r = window.__apolloEditor.readRecordings();
  const btn = document.querySelector('#tc-recwrap .tc-rec-unset');
  return {
    linked: r.map(x => (x.isNew ? 'N' : x.recGid ? 'L' : '-')).join(''),
    sel: window.__apolloEditor.recSelection.slice().sort().join(' '),
    selRows: document.querySelectorAll('#tc-recwrap tr.tc-recsel').length,
    cells: document.querySelectorAll('#tc-recwrap .tc-recselcell').length,
    btn: btn ? { shown: btn.style.display !== 'none', text: btn.textContent } : null,
  };
});
const clickCell = (ti, shift) => page.evaluate(([t, s]) => {
  const tr = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')].find(r => r.dataset.ti === String(t));
  const cell = tr && tr.querySelector('.tc-recselcell');
  if (!cell) return false;
  cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!s }));
  return true;
}, [ti, shift]);

const s0 = await state();
console.log('start:', JSON.stringify(s0));
ck(s0.cells > 0 && s0.cells === s0.linked.length, `every row has a selection cell in the # column (${s0.cells} of ${s0.linked.length})`);
ck(/^L+$/.test(s0.linked), `fixture: every track starts linked, so an unset is visible (${s0.linked})`);
ck(s0.btn && !s0.btn.shown, 'the Unset button is hidden while nothing is selected');

// the last three rows of the first medium — a range, anywhere in the table
const tis = await page.evaluate(() => [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')]
  .filter(r => r.dataset.mi === '0').map(r => +r.dataset.ti).slice(-3));
console.log('range target (medium 1, last three):', JSON.stringify(tis));
ck(tis.length === 3, 'the first medium has at least three rows to range over');
ck(await clickCell(tis[0], false), `clicked the # cell on row ${tis[0] + 1}`);
ck(await clickCell(tis[2], true), `shift-clicked the # cell on row ${tis[2] + 1}`);
const s1 = await state();
console.log('after range:', JSON.stringify(s1));
ck(s1.selRows === 3, `shift-click selected the RANGE, not just the two ends (${s1.selRows} rows)`);
ck(s1.sel === tis.map(t => '0:' + t).join(' '), `the range is exactly those three (${s1.sel})`);
ck(s1.btn.shown && /Unset 3/.test(s1.btn.text), `the Unset button appears and counts them ("${s1.btn.text}")`);
const expected = s0.linked.split('').map((c, i) => (tis.includes(i) ? 'N' : c)).join('');

// Delete unsets them
await page.evaluate(() => document.body.focus());
await page.keyboard.press('Delete');
await page.waitForTimeout(700);
const s2 = await state();
console.log('after Delete:', JSON.stringify(s2));
ck(s2.linked === expected, `only the selected three were unset, every other row untouched (${s2.linked}, wanted ${expected})`);
ck(s2.selRows === 3, 'the rows stay selected afterwards, so a mis-aimed unset is easy to walk back');

// Esc clears, Ctrl+A takes everything
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const s3 = await state();
ck(s3.selRows === 0, `Escape cleared the selection (${s3.selRows})`);
await page.keyboard.press('Control+a');
await page.waitForTimeout(500);
const s4 = await state();
ck(s4.selRows === s0.cells, `Ctrl+A selected every row (${s4.selRows} of ${s0.cells})`);

/* The medium header takes the whole medium. A single-medium release renders no
   header at all (renderRecBody only emits one when there are several), so this
   part is exercised by running the same file against a multi-medium release:
     MBID=38c59562-b421-44f9-a527-a0c2dbe0bb94 node verify-583-unset-selected.mjs
   It is asserted when present and reported as not-covered when absent, rather
   than quietly passing either way. */
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const med = await page.evaluate(() => {
  const s = document.querySelector('#tc-recwrap tr.tc-recmed .tc-recmed-sel');
  if (!s) return null;
  const mi = s.closest('tr').dataset.mi;
  s.click();
  const rows = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')];
  return { mi, inMedium: rows.filter(r => r.dataset.mi === mi).length,
           selected: rows.filter(r => r.classList.contains('tc-recsel')).length,
           selectedElsewhere: rows.filter(r => r.dataset.mi !== mi && r.classList.contains('tc-recsel')).length };
});
if (!med) console.log('note: single-medium release — the medium-header path is not covered by THIS run (see the comment above)');
else {
  console.log('medium header:', JSON.stringify(med));
  ck(med.selected === med.inMedium && med.selectedElsewhere === 0,
    `clicking "Medium ${+med.mi + 1}" selected exactly its ${med.inMedium} rows and nothing else`);
  const again = await page.evaluate(() => { document.querySelector('#tc-recwrap tr.tc-recmed .tc-recmed-sel').click(); return document.querySelectorAll('#tc-recwrap tr.tc-recsel').length; });
  ck(again === 0, `clicking it again cleared them (${again} left)`);
}

// Delete with nothing selected must do nothing at all
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.keyboard.press('Delete');
await page.waitForTimeout(600);
const s5 = await state();
ck(s5.linked === expected, `Delete with an empty selection changes nothing (${s5.linked})`);

await page.screenshot({ path: resolve(HERE, 'logs', 'i583-select-unset.png') }).catch(() => {});
ck(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
