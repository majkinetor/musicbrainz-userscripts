// #586 follow-up. chaban-mb, on the boundary buttons: "But is it intentional
// within the data section tracks cannot be reordered?" It wasn't a consequence
// of those buttons — #330 excluded pregap AND data rows from drag-reorder when
// it first added the section — but native does allow it: moveTrackDown falls
// through to swapTracks when both tracks are data, and isn't disc-ID-disabled in
// that case either.
//
// So data rows drag among data rows now, and a drag still cannot cross the
// boundary — that direction is what ⤓/⤒ are for, and MB's moveTrackUp DEMOTES
// the first data track rather than swapping, so a crossing drag would strand a
// track mid-list in a state MB rejects.
//
// The drag is driven through real DragEvents with a DataTransfer, so the
// handlers under test are the ones the browser would call.
//
// Pre-fix build: data rows have no ⠿ handle at all, so the first check fails.
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
  const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('tracklist'));
  if (b) b.click();
});
await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(1200);

// open a data section of three: ⤓ on track 11
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
  tr.querySelector('.tc-dtmv.down').click();
});
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => {
  const m = window.MB.releaseEditor.rootField.release().mediums()[0];
  const rows = [...document.querySelectorAll('.tc-mirror tr[data-tk]')];
  return {
    flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
    // full titles: the three video tracks all END the same way ("…karaokė)"),
    // so a tail fingerprint made a real move look like no move at all.
    titles: m.tracks().map(t => (t.name() || '')).join(' | '),
    dataHandles: rows.filter(r => r.classList.contains('tc-row-data')).filter(r => r.querySelector('.tc-drag')).length,
    dataRows: rows.filter(r => r.classList.contains('tc-row-data')).length,
    audioHandles: rows.filter(r => !r.classList.contains('tc-row-data')).filter(r => r.querySelector('.tc-drag')).length,
  };
});

// Real drag: dragstart on the source handle, dragover + drop on the target row.
const drag = (fromTi, toTi, after) => page.evaluate(([f, t, aft]) => {
  const row = ti => [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === String(ti));
  const src = row(f), dst = row(t);
  if (!src || !dst) return 'row missing';
  const h = src.querySelector('.tc-drag');
  if (!h) return 'no drag handle on the source row';
  const dt = new DataTransfer();
  h.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  const box = dst.getBoundingClientRect();
  const y = aft ? box.bottom - 2 : box.top + 2;
  const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y, clientX: box.left + 10 };
  dst.dispatchEvent(new DragEvent('dragover', opts));
  const accepted = dst.classList.contains('tc-drop-before') || dst.classList.contains('tc-drop-after');
  dst.dispatchEvent(new DragEvent('drop', opts));
  h.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
  return accepted ? 'accepted' : 'refused';
}, [fromTi, toTi, !!after]);

const s0 = await state();
console.log('with a data section of three:', JSON.stringify(s0));
ck(s0.flags === '..........DDD', `fixture: three data tracks (${s0.flags})`);
ck(s0.dataHandles === s0.dataRows && s0.dataRows === 3, `every data row has a ⠿ handle (${s0.dataHandles} of ${s0.dataRows})`);
ck(s0.audioHandles === 10, `audio rows keep theirs (${s0.audioHandles})`);

// move the LAST data track above the first one — inside the section
const r1 = await drag(12, 10, false);
await page.waitForTimeout(1200);
const s1 = await state();
console.log('drag data #13 above data #11:', r1, JSON.stringify(s1));
ck(r1 === 'accepted', 'the drop target inside the section accepted the drag');
ck(s1.flags === '..........DDD', `the section is unchanged in size and still trailing (${s1.flags})`);
ck(s1.titles !== s0.titles, `the tracks really moved (${s0.titles} → ${s1.titles})`);

// a drag from the data section onto an AUDIO row must be refused outright
const r2 = await drag(12, 5, false);
await page.waitForTimeout(900);
const s2 = await state();
console.log('drag a data track onto an audio row:', r2, JSON.stringify(s2));
ck(r2 === 'refused', 'a drag out of the data section is refused — no drop marker, no drop');
ck(s2.flags === '..........DDD' && s2.titles === s1.titles, `nothing changed (${s2.flags})`);

// and the reverse: an audio row dragged into the section
const r3 = await drag(3, 11, false);
await page.waitForTimeout(900);
const s3 = await state();
console.log('drag an audio track into the data section:', r3, JSON.stringify(s3));
ck(r3 === 'refused', 'a drag into the data section is refused too — ⤓ is the way in');
ck(s3.flags === '..........DDD' && s3.titles === s1.titles, `nothing changed (${s3.flags})`);

// restore
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tc-mirror tr.tc-row-data')];
  rows[rows.length - 1].querySelector('.tc-dtmv.up').click();
});
await page.waitForTimeout(900);
const s4 = await state();
ck(s4.flags.indexOf('D') < 0, `restored: no data tracks left (${s4.flags})`);

await page.screenshot({ path: resolve(HERE, 'logs', 'i586b-data-reorder.png') }).catch(() => {});
ck(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
