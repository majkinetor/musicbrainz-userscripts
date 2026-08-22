// #533 follow-up (majkinetor): "Release also has disambiguation attribute."
//
// This guards the bug that made the first cut of that feature look like it
// worked: a release with no urls was treated as COVER-ONLY and skipped the form
// pipeline entirely. runCoverItem with an empty cover list finds nothing to fail
// on, so the item went green — 'done', no error — having never opened an edit
// page. The live proof passed too, because the stamp it searched for turned up
// on a related recording's edit.
//
// So the property under test is not "the edit succeeds" (the live proof covers
// that against real MusicBrainz); it is that a release carrying only a
// disambiguation is ROUTED THROUGH THE FORM AT ALL and really tries to submit.
//
// Nothing is submitted: every POST is aborted, and counted.
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

// ⚠ Match on the METHOD, not a url glob. A glob that stops matching once the
// url grows a query string is how six real edits once escaped onto production
// MusicBrainz — every POST dies here, whatever its url.
let posts = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posts.push(r.url()); return route.abort(); }
  return route.continue();
});
// MB's pages also POST to Sentry; that is not evidence of anything here. The
// release editor does not post the form back either — it calls MB's internal
// JSON edit API, so /ws/js/edit/create IS the submit.
const editPosts = () => posts.filter(u => /test\.musicbrainz\.org\/(ws\/js\/edit\/|.*\/edit)/.test(u));
const createPosts = () => posts.filter(u => /\/ws\/js\/edit\/create/.test(u));

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

const run = async (item) => {
  await page.evaluate(i => window.__falconTest.setQueue([i]), item);
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 180000 }).catch(() => {});
  return await page.evaluate(() => {
    const i = window.__falconTest.getQueue()[0];
    return { status: i.status, error: i.error, urlResults: i.urlResults };
  });
};
const base = {
  id: 'r1', entityType: 'release', mbid: RELEASE, urls: [], note: 'Falcon #533 routing check',
  isrcs: [], cover: [], coverExistingCount: null, name: null, urlResults: null, status: 'queued', error: '',
};

// ── a release with ONLY a disambiguation must reach the form ────────────────
posts = [];
const withComment = await run({ ...base, disambiguation: 'falcon routing check ' + Date.now() });
console.log('with disambiguation: status=' + withComment.status);
console.log('  edit POSTs attempted: ' + JSON.stringify(editPosts()));
// The evidence that it was routed through the form is a POST at the release's
// own edit endpoint. (Don't look at urlResults: on the throw path — which is
// what aborting the submit produces — the worker sets status/error and never
// gets to assign it.)
ck(editPosts().length >= 1, `it reached the release edit form and tried to submit (${editPosts().length} attempt(s), all aborted here)`);
ck(createPosts().length >= 1, `and it got as far as asking MusicBrainz to CREATE an edit (${createPosts().length} call(s) to /ws/js/edit/create)`);
// With every POST aborted the submit cannot land, so 'failed' is this harness
// blocking it. What must NOT happen is a green row: that was the bug.
ck(withComment.status !== 'done', `it does not report success when the submit never landed (status: ${withComment.status})`);
// The wall of "a release title is required" in the error is MB's own client
// validation going haywire once its XHRs are blocked (the #495 known bug, same
// shape); it is this harness's doing, not the feature's. The live proof
// (live-533-disambiguation-proof.mjs) is what shows the real submit landing.

// ── control: nothing filled in at all is still skipped, not submitted ───────
posts = [];
const blank = await run({ ...base, id: 'r2', disambiguation: '' });
console.log('blank row          : ' + JSON.stringify({ status: blank.status, error: blank.error }) + `  (edit POSTs: ${editPosts().length})`);
ck(blank.status === 'skipped', 'an untouched release row is still skipped');
ck(editPosts().length === 0, 'and never touches MusicBrainz');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
