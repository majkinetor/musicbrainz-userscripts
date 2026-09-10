// #587 (chaban-mb): "when batch removing ISRCs there is no indicator apart from
// logs that (network) actions are in progress. Only once all submissions are
// done is the hourglass pending edit indicator inserted. It should probably be
// immediately be inserted for each ISRC whose removal edit was successfully
// submitted and/or a global activity indicator so one doesn't accidentally close
// the tab before everything is done."
//
// The defect is a TIMING one, so the test has to watch the run rather than look
// at the end state: the ⏳ markers must appear one at a time WHILE the batch is
// still going. A snapshot is taken every 100ms and the assertion is that the
// count climbed through intermediate values. On the old build it stays 0 for the
// whole run and jumps to N at the end, which is precisely his report.
//
// SAFETY — this flow POSTs to /recording/<mbid>/edit, a normal page form, NOT
// /ws/js/edit/create. A route glob aimed at the usual write endpoints would let
// every one of these through onto PRODUCTION MusicBrainz. Instead the block is
// at the only transport the script has: GM_xmlhttpRequest is stubbed to perform
// real GETs (so the release load and the edit forms are genuine) and to NEVER
// send a POST — it records it and fabricates the response.
//
// The escape check is PASSIVE (page.on('request')), not a route. Intercepting on
// production musicbrainz.org breaks navigation outright — the first version of
// this test routed /release/ and /recording/ with continue() and the modal never
// rendered, because the page had already failed to load.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.II_SRC || resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
/* His own release no longer works as a fixture — he is an auto-editor, so the 12
   removals in his log were applied on the spot and it now has no ISRCs left to
   remove. This one does (10 tracks, 10 ISRCs). */
const REL = process.env.REL || 'bef3dc66-8cfc-4ff1-9053-0d0a5f30f2b3';
const PICK = 4;   // how many ISRCs to remove in the batch

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => (s.has(k) ? s.get(k) : d);
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
  /* Pending removals are remembered in localStorage so they survive a reload,
     which means a previous run of THIS test leaves ⏳ markers behind and the
     next run starts dirty (it counted 6 of 3 the first time). Clear the key for
     the fixture release before the script reads it. */
  try { Object.keys(localStorage).filter(k => /pending_removals_/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  window.__posts = [];
  window.__failRec = null;          // set from the test: this recording's POST returns 500
  window.GM_xmlhttpRequest = (o) => {
    const method = (o.method || 'GET').toUpperCase();
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    if (method === 'POST') {
      window.__posts.push({ url: o.url, at: Date.now() });
      const failing = window.__failRec && o.url.indexOf(window.__failRec) !== -1;
      // Long enough that the run is observable, short enough to finish. A created
      // edit redirects AWAY from /edit — the script treats a response still on
      // /edit as a validation error, so the fake has to land elsewhere.
      setTimeout(() => done(failing
        ? { status: 500, responseText: 'nope', finalUrl: o.url, responseHeaders: '' }
        : { status: 200, responseText: '<html><body>ok</body></html>', finalUrl: o.url.replace(/\/edit$/, ''), responseHeaders: '' }), 350);
      return { abort() {} };
    }
    fetch(o.url, { method: 'GET', headers: o.headers || {}, credentials: 'include' })
      .then(async r => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());   // the "Submit Remove ISRC edits?" confirm
const escaped = [];
page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org/i.test(r.url())) escaped.push(r.url()); });

await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { state: 'attached', timeout: 25000 });
await page.evaluate(() => document.getElementById('ii-btn').click());
await page.waitForSelector('.ii-ex-del', { state: 'attached', timeout: 60000 });
await page.waitForTimeout(1500);

// check the first PICK existing ISRCs, each on a different row where possible
const picked = await page.evaluate(n => {
  const seen = new Set(); const out = [];
  for (const cb of document.querySelectorAll('.ii-ex-del')) {
    const tr = cb.closest('tr[data-idx]'); if (!tr || seen.has(tr.dataset.idx)) continue;
    seen.add(tr.dataset.idx);
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    out.push({ idx: tr.dataset.idx, isrc: cb.dataset.isrc });
    if (out.length >= n) break;
  }
  return out;
}, PICK);
console.log('picked:', JSON.stringify(picked));
ck(picked.length === PICK, `checked ${picked.length} ISRCs on ${picked.length} different rows`);

// make the LAST one fail, so the failed-state path is exercised too
const failIdx = picked[picked.length - 1].idx;
await page.evaluate(i => {
  const tr = document.querySelector('tr[data-idx="' + i + '"]');
  const a = tr.querySelector('.ii-track-title a');
  window.__failRec = a ? a.href.split('/recording/')[1] : null;
  return window.__failRec;
}, failIdx);
console.log('recording rigged to fail:', await page.evaluate(() => window.__failRec));

const snapshot = () => page.evaluate(() => ({
  pending: document.querySelectorAll('.ii-ex-pending').length,
  failed: document.querySelectorAll('.ii-ex-failed').length,
  btn: (document.querySelector('#ii-delete') || {}).textContent || '',
  busyCls: !!document.querySelector('#ii-delete.ii-busy'),
  prog: (document.querySelector('#ii-prog') || {}).textContent || '',
  posts: window.__posts.length,
}));

const before = await snapshot();
console.log('before:', JSON.stringify(before));
ck(before.pending === 0, `no ⏳ markers before the run (${before.pending})`);

await page.evaluate(() => document.querySelector('#ii-delete').click());

// watch it happen
const frames = [];
for (let i = 0; i < 200; i++) {
  const s = await snapshot();
  if (!frames.length || JSON.stringify(s) !== JSON.stringify(frames[frames.length - 1])) frames.push(s);
  if (s.posts >= PICK && !s.busyCls) break;
  await new Promise(r => setTimeout(r, 100));
}
console.log('\nframes:'); frames.forEach(f => console.log('   ' + JSON.stringify(f)));

const mid = frames.filter(f => f.pending > 0 && f.pending < PICK - 1);   // -1: the rigged one never goes pending
ck(mid.length > 0, `⏳ markers appeared DURING the run, not all at the end (${mid.length} intermediate states seen)`);
ck(frames.some(f => f.busyCls), 'the Delete button carried a busy state while the batch ran');
ck(frames.some(f => /\d+\s*\/\s*\d+/.test(f.btn)), `the button showed a live count (${JSON.stringify([...new Set(frames.map(f => f.btn))])})`);
ck(frames.some(f => /Submitting removals/.test(f.prog)), 'the progress line named what was happening');

const end = await snapshot();
console.log('\nafter:', JSON.stringify(end));
ck(end.pending === PICK - 1, `every successful removal is marked ⏳ pending (${end.pending} of ${PICK - 1})`);
ck(end.failed >= 1, `the rigged failure is marked as failed, not pending (${end.failed})`);
ck(!end.busyCls, 'the busy state cleared when the batch finished');

// nothing left the browser
const posts = await page.evaluate(() => window.__posts.map(p => p.url));
console.log('\nPOSTs intercepted in-page (never sent):', posts.length);
ck(posts.length === PICK, `all ${PICK} POSTs were intercepted before the network (${posts.length})`);
ck(escaped.length === 0, `no POST reached MusicBrainz (${escaped.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

await page.screenshot({ path: resolve(HERE, 'logs', 'i587-removal-progress.png') }).catch(() => {});
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
