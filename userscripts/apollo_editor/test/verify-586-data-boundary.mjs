// #586 (majkinetor): "The original tracklist editor allows moving tracks between
// normal and data track section. In Apollo there are no move buttons but
// drag-n-drop which doesn't allow the same." His example is this release, whose
// last three tracks are video karaoke and belong in the data section.
//
// Apollo now puts ⤓ / ⤒ in the move column and moves the whole boundary in one
// click, because a data section is by definition a trailing block (see the long
// comment on setDataBoundary for what MB's own handlers do and why one-at-a-time
// is all they can offer).
//
// This drives the RENDERED BUTTON, not the function behind it, so a button that
// never got wired would fail here. Nothing is submitted — every write endpoint
// is blocked, and the flags are restored at the end.
//
// Pre-fix build: `.tc-dtmv` does not exist, so the first check fails.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  /* The move column is user-resizable and defaults to 32px, which is NARROWER
     than its own contents — the row overflows and every handle lands at the same
     x no matter how many children the cell has, so the misalignment chaban-mb
     screenshotted cannot appear at the default width. Widen it, which is the
     state his screenshot is in. Without this the alignment check below passes on
     the broken build too, guarding nothing. */
  const store = new Map([['apolloEditor.settings.v1', JSON.stringify({ colWidths: { mv: 80 } })]]);
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
  const all = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')];
  const t = all.find(x => x.textContent.trim().toLowerCase().startsWith('tracklist')); if (t) t.click();
});
await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => {
  const ed = window.MB.releaseEditor;
  const m = ed.rootField.release().mediums()[0];
  return {
    flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
    audio: m.audioTracks().length, data: m.dataTracks().length,
    hasDataTracks: !!m.hasDataTracks(),
    toc: m.toc() == null ? null : 'set',
    dividers: document.querySelectorAll('.tc-mirror tr.tc-datadiv').length,
    dataRows: document.querySelectorAll('.tc-mirror tr.tc-row-data').length,
    downBtns: document.querySelectorAll('.tc-mirror .tc-dtmv.down:not(.void)').length,
    upBtns: document.querySelectorAll('.tc-mirror .tc-dtmv.up').length,
    /* chaban-mb: "Last track is not preserving space for move track down arrow."
       ⤓ is inert on the last track of a medium, but the SLOT still has to be
       there or that row's ⠿ handle sits at a different x than every other's.
       One distinct x across all handles is the check. */
    handleX: [...new Set([...document.querySelectorAll('.tc-mirror tr[data-tk] .tc-drag')]
      .map(h => Math.round(h.getBoundingClientRect().left)))],
    voidSlots: document.querySelectorAll('.tc-mirror .tc-dtmv.void').length,
  };
});

const before = await state();
console.log('before:', JSON.stringify(before));
ck(before.downBtns > 0, `the tracklist renders ⤓ boundary buttons (${before.downBtns})`);
ck(before.data === 0 && before.flags.indexOf('D') < 0, 'fixture starts with no data tracks');
// ⤓ is only offered where it can act — never on the last track of a medium
ck(before.downBtns === before.flags.length - 1, `⤓ is offered on every track but the last (${before.downBtns} of ${before.flags.length})`);
ck(before.voidSlots === 1, `the last track still holds an inert ⤓ slot (${before.voidSlots})`);
ck(before.handleX.length === 1, `every ⠿ handle is at the same x — the last row reserves the ⤓ space (${JSON.stringify(before.handleX)})`);

// click ⤓ on track 11 — the first of his three video karaoke tracks
const clicked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
  const b = tr && tr.querySelector('.tc-dtmv.down');
  if (!b) return 'no button on track 11';
  b.click(); return 'clicked';
});
console.log('click ⤓ on #11:', clicked);
await page.waitForTimeout(900);
const after = await state();
console.log('after ⤓:', JSON.stringify(after));
ck(after.flags === '..........DDD', `#11–13 became data tracks in one click (${after.flags})`);
ck(after.audio === 10 && after.data === 3, `medium reports 10 audio / 3 data (${after.audio}/${after.data})`);
ck(after.hasDataTracks === true, 'the medium now reports hasDataTracks');
ck(after.toc === null, 'the disc TOC was cleared, as native does on every boundary move');
ck(after.dataRows === 3 && after.dividers === 1, `the mirror redrew them under one "⤓ Data tracks" divider (${after.dataRows} rows, ${after.dividers} divider)`);
ck(after.upBtns === 3, `each data row offers ⤒ back (${after.upBtns})`);

// ⤒ on the FIRST data row must bring back exactly that one
const up1 = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.tc-mirror tr.tc-row-data')][0];
  const b = tr && tr.querySelector('.tc-dtmv.up'); if (!b) return 'no ⤒';
  b.click(); return 'clicked';
});
await page.waitForTimeout(900);
const afterUp = await state();
console.log('after ⤒ on the first data row:', up1, JSON.stringify(afterUp));
ck(afterUp.flags === '...........DD', `only #11 came back (${afterUp.flags})`);

// ⤒ on the LAST data row must bring back the whole block — otherwise the data
// section would stop being trailing, which MB does not allow.
const up2 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tc-mirror tr.tc-row-data')];
  const b = rows[rows.length - 1] && rows[rows.length - 1].querySelector('.tc-dtmv.up'); if (!b) return 'no ⤒';
  b.click(); return 'clicked';
});
await page.waitForTimeout(900);
const afterUp2 = await state();
console.log('after ⤒ on the last data row:', up2, JSON.stringify(afterUp2));
ck(afterUp2.flags === '.............', `the section closed cleanly, nothing stranded (${afterUp2.flags})`);
ck(afterUp2.data === 0 && afterUp2.hasDataTracks === false, 'medium is back to no data tracks');

await page.screenshot({ path: resolve(HERE, 'logs', 'i586-data-boundary.png') }).catch(() => {});
/* Changing the model makes MB fetch an edit PREVIEW on its own (/ws/js/edit/preview);
   that is not a submission, and it is blocked here anyway. What must never appear
   is /ws/js/edit/create. */
console.log('\nblocked requests:', JSON.stringify(posted, null, 1));
ck(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
