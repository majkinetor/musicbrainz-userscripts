// #584 (majkinetor): "In recordings editor the video icons are displayed after
// the titles. While in the original editor they shown before titles. The latter
// makes it easier to scan and notice videos in the list (because titles rarely
// have same lengths)." Follow-up: "also show in recording table."
//
// So two things: the marker LEADS the title, and it appears in the tracklist
// too — which is where you actually need it (#586 on this same release is about
// pushing exactly these three video tracks into the data section, and the
// tracklist showed no sign of which ones they were).
//
// Both checks are positional, not just "the element exists": DOM order AND
// geometry, since a leading element that CSS floats to the right would satisfy
// the first alone.
//
// Pre-fix build: the tracklist has zero markers, and the recordings table's sit
// after the title — both halves fail.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';   // tracks 11-13 are video recordings
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
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => r.abort());
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });
const tab = async n => {
  await page.evaluate(x => { const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(e => e.textContent.trim().toLowerCase().startsWith(x)); if (b) b.click(); }, n);
  await page.waitForTimeout(3000);
};

// how many of this release's recordings really are videos — the number to expect
const videos = await page.evaluate(() => window.__apolloEditor.readRecordings().filter(r => r.recVideo).length);
console.log('video recordings on this release:', videos);
ck(videos === 3, `fixture: ${videos} video recordings (his three video karaoke tracks)`);

await tab('tracklist');
const tl = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tc-mirror tr[data-tk]')];
  const marked = rows.filter(r => r.querySelector('.tc-rec-video'));
  return {
    rows: rows.length, marked: marked.length,
    leads: marked.length > 0 && marked.every(r => {
      const mk = r.querySelector('.tc-rec-video'), inp = r.querySelector('.t-title');
      if (!mk || !inp) return false;
      if (!(mk.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      /* When title enlargement is on the input rests behind a .t-title-disp span
         and can measure as an empty box, so compare against whichever of the two
         is actually painted. */
      const disp = r.querySelector('.t-title-disp');
      const shown = [disp, inp].filter(e => e && e.getBoundingClientRect().width > 1)[0];
      return !!shown && mk.getBoundingClientRect().right <= shown.getBoundingClientRect().left + 1;
    }),
    geom: marked.map(r => {
      const mk = r.querySelector('.tc-rec-video'), inp = r.querySelector('.t-title'), disp = r.querySelector('.t-title-disp');
      const rr = e => (e ? [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().right)] : null);
      return { mk: rr(mk), disp: rr(disp), inp: rr(inp) };
    }),
    numbers: marked.map(r => r.querySelector('.t-num') && r.querySelector('.t-num').value),
  };
});
console.log('TRACKLIST:', JSON.stringify(tl));
ck(tl.rows > 0, `the tracklist mirror rendered (${tl.rows} rows)`);
ck(tl.marked === videos, `the tracklist marks all ${videos} video tracks (${tl.marked}) — "also show in recording table"`);
ck(tl.leads, 'in the tracklist the marker is before the title, in DOM order and on screen');

await tab('recording');
const rec = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')];
  const marked = rows.filter(r => r.querySelector('.tc-rec-video'));
  return {
    rows: rows.length, marked: marked.length,
    lead: marked.filter(r => r.querySelector('.tc-rec-video.lead')).length,
    leads: marked.length > 0 && marked.every(r => {
      const cell = r.querySelector('.tc-recname'), mk = cell && cell.querySelector('.tc-rec-video');
      if (!cell || !mk) return false;
      /* Measure against the title's PAINTED extent, text nodes included. An
         earlier version compared only element children and the recording title
         is often a bare text node, so it had nothing to compare against and
         passed on the broken build with the marker sitting after the title. */
      const rest = [...cell.childNodes].filter(n => n !== mk && !(n.nodeType === 1 && n.classList.contains('tc-rec-rev')));
      let left = Infinity;
      for (const n of rest) {
        let box;
        if (n.nodeType === 1) box = n.getBoundingClientRect();
        else { const rg = document.createRange(); rg.selectNodeContents(n); box = rg.getBoundingClientRect(); }
        if (box.width > 0) left = Math.min(left, box.left);
      }
      if (left === Infinity) return false;   // nothing painted to be in front of — not a real check
      return mk.getBoundingClientRect().right <= left + 1;
    }),
  };
});
console.log('RECORDINGS:', JSON.stringify(rec));
ck(rec.marked === videos, `the recordings table marks all ${videos} (${rec.marked})`);
ck(rec.lead === videos, `each carries the leading-spacing class (${rec.lead})`);
ck(rec.leads, 'in the recordings table the marker is before the title, in DOM order and on screen');
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

await page.screenshot({ path: resolve(HERE, 'logs', 'i584-recordings.png') }).catch(() => {});
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
