// #573 (majkinetor): "When I rename several entities, I want to put an
// additional message on why that is done, visible on all edits. Add edit note
// left of the start button. It will show text box in panel above it (like other
// panels do). Ofc, it should be settable via JSON."
//
// The thing that actually matters here is "visible on ALL edits". Falcon
// composes an edit note in four places — the seeded url, the form's textarea,
// the alias submit and the cover-art upload — and a batch note that only
// reaches some of them is worse than none, because it looks like it worked.
//
// Nothing is submitted: every POST is aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const HOST = 'https://test.musicbrainz.org';
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());

for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(400);

// ── where it sits ───────────────────────────────────────────────────────────
const layout = await page.evaluate(() => {
  const bar = document.getElementById('falcon-queue-bottom');
  const btn = document.getElementById('falcon-note-btn');
  const run = document.getElementById('falcon-run');
  const panel = document.getElementById('falcon-notepanel');
  const kids = bar ? [...bar.children] : [];
  return {
    btnInBar: !!btn && bar.contains(btn),
    leftOfStart: kids.indexOf(btn) >= 0 && kids.indexOf(btn) < kids.indexOf(run),
    panelAboveBar: !!panel && !!(panel.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING),
    panelHidden: panel && panel.style.display === 'none',
  };
});
console.log('layout: ' + JSON.stringify(layout));
ck(layout.btnInBar && layout.leftOfStart, 'the note button sits in the bottom bar, left of Start');
ck(layout.panelAboveBar, 'and its panel is above that bar');
ck(layout.panelHidden, 'closed until asked for');

await page.click('#falcon-note-btn');
await page.waitForTimeout(250);
ck(await page.isVisible('#falcon-notepanel'), 'clicking the button opens the panel');
ck(await page.isVisible('#falcon-note-text'), 'which holds the text box');

// ── typing it sets it ───────────────────────────────────────────────────────
const REASON = 'Conforming titles to the series standard (#573 check)';
await page.fill('#falcon-note-text', REASON);
await page.waitForTimeout(200);
ck(await page.evaluate(() => window.__falconTest.batchNote()) === REASON, 'typing in the box sets the batch note');
const marked = await page.evaluate(() => {
  const b = document.getElementById('falcon-note-btn');
  return b.style.fontWeight === '700' && !!b.title && b.title.includes('#573 check');
});
ck(marked, 'and the button shows that every edit in the run will carry one');

// ── it reaches every note Falcon composes ───────────────────────────────────
const notes = await page.evaluate(() => ({
  formNoUrls: window.__falconTest.editNoteText([]),
  formWithUrls: window.__falconTest.editNoteText([{ ok: true, url: 'https://example.com/x' }]),
  wrapped: window.__falconTest.withBatchNote('some other note'),
  cover: window.__falconTest.coverEditNote(
    { entityType: 'release', mbid: 'x', note: '' },
    { url: 'https://img.example/x.jpg', type: 'Front', comment: '' },
    { width: 1000, height: 1000, bytes: 1234 }),
}));
console.log('--- form note, no urls ---'); console.log(notes.formNoUrls);
ck(notes.formNoUrls.includes(REASON), 'a form edit carries it');
ck(!notes.formNoUrls.includes('Bulk-added via the Falcon queue:'),
   'and a rename-only edit no longer claims to have added links it did not add');
ck(notes.formWithUrls.includes(REASON) && notes.formWithUrls.includes('Bulk-added via the Falcon queue:'),
   'a link edit still lists its links, and carries the note too');
ck(notes.wrapped.includes('some other note') && notes.wrapped.includes(REASON), 'the alias path wraps its own note the same way');
ck(notes.cover.includes(REASON), 'a cover-art upload carries it');

// ── settable from JSON, and written back out ────────────────────────────────
await page.evaluate(() => window.__falconTest.setBatchNote(''));
const fromJson = await page.evaluate(() => {
  window.__falconTest.setQueue([]);
  window.__falconTest.importQueueJson(JSON.stringify({
    note: 'Reason carried in the file',
    items: [{ entityType: 'release_group', mbid: '11111111-1111-1111-1111-111111111111', rename: 'X' }],
  }), 'test');
  return { batch: window.__falconTest.batchNote(), itemNote: window.__falconTest.getQueue()[0].note };
});
console.log('from JSON: ' + JSON.stringify(fromJson));
ck(fromJson.batch === 'Reason carried in the file', 'a root-level `note` in the JSON sets the batch note');
ck(fromJson.itemNote === '', "and does not leak into the item's own per-edit note");
ck(await page.inputValue('#falcon-note-text') === 'Reason carried in the file', 'the panel shows what the import set');

let exported = null;
try {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#falcon-export')]);
  exported = JSON.parse(await readFile(await dl.path(), 'utf8'));
} catch (e) { console.log('  (export download not captured: ' + (e.message || e).split('\n')[0] + ')'); }
if (exported) {
  console.log('exported root keys: ' + JSON.stringify(Object.keys(exported)));
  ck(exported.note === 'Reason carried in the file', 'Export writes the batch note back out at the root');
} else {
  ck(false, 'Export writes the batch note back out at the root (download not captured)');
}

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
