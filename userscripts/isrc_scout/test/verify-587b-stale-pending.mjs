// #587 follow-up (majkinetor): "I removed some isrcs, and it showed ASAP and on
// reload. Then I canceled edits … However, it still shows as pending so something
// is wrong here. How did you determine the pending state on recording?"
//
// It was determined from what the script itself remembered submitting, with one
// heuristic: if the ISRC had vanished from the recording the edit must have been
// applied, so forget it. That covers applied edits and nothing else — a
// CANCELLED edit leaves the ISRC exactly where it was, so ⏳ stuck for good.
//
// The marker is now reconciled against /recording/<gid>/open_edits, which lists
// only OPEN edits. Two cases, and the test needs both, because a check that only
// ever clears is as wrong as one that never does:
//
//   · remembered + no open edit  → the ⏳ must go   (his cancelled edit)
//   · remembered + open edit     → the ⏳ must stay (a real pending removal)
//
// The open_edits response is served from the stub so the outcome is decided by
// the test, not by whatever MusicBrainz happens to have open today. Every other
// GET is real, and POSTs can't be sent at all.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.II_SRC || resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const REL = process.env.REL || 'bef3dc66-8cfc-4ff1-9053-0d0a5f30f2b3';   // 10 tracks, 10 ISRCs

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => (s.has(k) ? s.get(k) : d);
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
  /* Clear leftovers from a previous run, but ONLY on the first load — the test
     seeds this key and then reloads, and wiping it again would erase the very
     state under test. */
  try { if (!sessionStorage.getItem('ii-test-cleared')) { Object.keys(localStorage).filter(k => /pending_removals_/.test(k)).forEach(k => localStorage.removeItem(k)); sessionStorage.setItem('ii-test-cleared', '1'); } } catch (e) {}
  // recordings whose open_edits page should come back still listing the ISRC
  window.__openFor = {};        // { recId: isrc }
  window.__openEditsHits = [];
  window.GM_xmlhttpRequest = (o) => {
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    if ((o.method || 'GET').toUpperCase() === 'POST') {
      setTimeout(() => done({ status: 200, responseText: '', finalUrl: String(o.url).replace(/\/edit$/, ''), responseHeaders: '' }), 50);
      return { abort() {} };
    }
    const m = String(o.url).match(/\/recording\/([0-9a-f-]{36})\/open_edits/i);
    if (m) {
      const rec = m[1];
      window.__openEditsHits.push(rec);
      const isrc = window.__openFor[rec];
      /* Deliberately slow: the optimistic ⏳ must be on screen BEFORE the check
         comes back, and with an instant stub there is no window in which to
         observe that. A real open_edits round-trip is ~1s anyway. */
      setTimeout(() => done({
        status: 200,
        responseText: isrc
          ? '<div class="edit-header open edit-remove remove-isrc">Edit #1 - Remove ISRC</div><table><tr><td>' + isrc + '</td></tr></table>'
          : '<div id="content"><p>No open edits.</p></div>',
        finalUrl: o.url, responseHeaders: '',
      }), 1500);
      return { abort() {} };
    }
    fetch(o.url, { method: 'GET', headers: o.headers || {}, credentials: 'include' })
      .then(async r => done({ status: r.status, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const escaped = [];
page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org/i.test(r.url())) escaped.push(r.url()); });

await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { state: 'attached', timeout: 25000 });

/* Seed the remembered state BEFORE the modal is ever opened, which is what a
   previous session would have left behind. An earlier version of this test
   opened the modal, seeded, and reloaded — two full page loads of a busy
   MusicBrainz, and the second one timed out often enough to be useless. The
   recordings come straight from the web service instead. */
const picks = await page.evaluate(async (rel) => {
  // MusicBrainz rate-limits; one bare fetch came back non-JSON and silently
  // produced an empty pick list, which then failed as a confusing TypeError.
  let j = null;
  for (let a = 0; a < 4 && !j; a++) {
    try {
      const r = await fetch(`/ws/2/release/${rel}?inc=recordings+isrcs&fmt=json`);
      if (r.status === 200) j = await r.json();
      else await new Promise(z => setTimeout(z, 1500));
    } catch (e) { await new Promise(z => setTimeout(z, 1500)); }
  }
  if (!j) return [];
  const out = [];
  for (const m of (j.media || [])) for (const t of (m.tracks || [])) {
    const rec = t.recording || {}; const isrc = (rec.isrcs || [])[0];
    if (!rec.id || !isrc || out.some(o => o.rec === rec.id)) continue;
    out.push({ rec: rec.id, isrc });
    if (out.length === 2) return out;
  }
  return out;
}, REL);
console.log('picks:', JSON.stringify(picks));
ck(picks.length === 2, `two recordings with an ISRC to work with (${picks.length})`);
if (picks.length < 2) { console.log('fixture unavailable (web service did not answer) — aborting rather than reporting a pass'); await ctx.close(); process.exit(1); }
const [gone, open] = picks;

await page.evaluate(([g, o, rel]) => {
  window.__openFor[o.rec] = o.isrc;                  // this one's edit is genuinely still open
  const map = {}; map[g.rec] = [g.isrc]; map[o.rec] = [o.isrc];
  localStorage.setItem('ii:pending_removals_' + rel, JSON.stringify(map));
}, [gone, open, REL]);

await page.evaluate(() => document.getElementById('ii-btn').click());
/* MusicBrainz throttles hard under repeated automated use and the script's own
   release fetch can simply never come back, so be patient — and if it still
   doesn't, dump what IS on screen rather than leaving a bare TimeoutError that
   can't be told apart from the bug under test. */
try { await page.waitForSelector('.ii-ex-pending', { state: 'attached', timeout: 120000 }); }
catch (e) {
  console.log('DIAG:', JSON.stringify(await page.evaluate(() => ({
    rows: document.querySelectorAll('tr[data-idx]').length,
    exItems: document.querySelectorAll('.ii-ex-item').length,
    pend: document.querySelectorAll('.ii-ex-pending').length,
    tbody: (document.querySelector('#ii-modal tbody, .ii-modal tbody') || {}).innerHTML?.slice(0, 160),
    stored: localStorage.getItem('ii:pending_removals_' + location.pathname.split('/')[2]),
    firstCell: (document.querySelector('.ii-existing') || {}).innerHTML?.slice(0, 200),
  }))));
  throw e;
}

const shot = () => page.evaluate(() => ({
  pending: [...document.querySelectorAll('.ii-ex-pending')].map(e => e.textContent.replace(/\s+/g, '')),
  links: [...document.querySelectorAll('a.ii-ex-pending')].length,
  hits: window.__openEditsHits.slice(),
}));

const first = await shot();
console.log('on load (before the check finishes):', JSON.stringify(first));
ck(first.pending.length === 2, `both remembered removals are shown ⏳ straight away (${first.pending.length}) — the optimistic marker still works`);

// let the reconciliation run (one request per remembered recording, paced)
for (let i = 0; i < 60; i++) {
  const s = await shot();
  if (s.hits.length >= 2 && s.pending.length < 2) break;
  await new Promise(r => setTimeout(r, 250));
}
const after = await shot();
console.log('after the check:', JSON.stringify(after));

ck(after.hits.length === 2, `open_edits was consulted once per remembered recording, not per track (${after.hits.length})`);
ck(after.pending.length === 1, `the cancelled one's ⏳ was cleared (${after.pending.length} left)`);
ck(after.pending.some(t => t.includes(open.isrc)), `the one with a real open edit KEPT its ⏳ (${JSON.stringify(after.pending)})`);
ck(!after.pending.some(t => t.includes(gone.isrc)), `the cancelled one is gone from the table (${gone.isrc})`);
ck(after.links >= 1, `the ⏳ links out to the recording's open edits, so the state is checkable (${after.links})`);

/* The hit is recorded when the request goes OUT, so the loop above can finish
   while the last check is still in flight and the storage write hasn't happened
   yet — reading it immediately showed the stale entry still there and looked
   like a bug in the fix. Wait for the write itself. */
let stored = null;
for (let i = 0; i < 40; i++) {
  stored = await page.evaluate(rel => localStorage.getItem('ii:pending_removals_' + rel), REL);
  if (stored && stored.indexOf(gone.isrc) === -1) break;
  await new Promise(r => setTimeout(r, 250));
}
console.log('storage after:', stored);
ck(stored && stored.indexOf(gone.isrc) === -1, 'the stale entry was dropped from storage too, so it cannot come back on the next reload');
ck(stored && stored.indexOf(open.isrc) !== -1, 'the live one is still remembered');

ck(escaped.length === 0, `no POST reached MusicBrainz (${escaped.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
