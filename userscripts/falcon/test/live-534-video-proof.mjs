// #534 (majkinetor): "Recordings video attribute … its just a checkbox on
// recording form. Right now you have to use a script to mass flag as video …
// As usual, provide a proof edit on test.musicbrainz."
//
// A REAL run: Falcon commits actual edits on test.musicbrainz and the result is
// read back. Nothing is intercepted — an aborted POST would only prove that a
// request left the browser.
//
// Two things are proved, and the second one matters more than the first:
//   1. a queued recording with video:true really gets MB's Video flag set;
//   2. a recording that is ALREADY video keeps it when Falcon edits something
//      else. MB's form renders the checkbox from the database and Falcon only
//      seeds `video` when asked, so an unrelated disambiguation edit must never
//      silently clear the flag. That is the data-loss case.
//
// Sandbox only: refuses to run against any host but test.musicbrainz.org.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const HOST = 'https://test.musicbrainz.org';
if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); process.exit(2); }
const UA = { 'User-Agent': 'Falcon-verify-534/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

async function ws2(path) {
  for (let a = 1; a <= 6; a++) {
    try { const r = await fetch(`${HOST}/ws/2/${path}`, { headers: UA }); if (r.ok) return await r.json(); }
    catch (e) { /* the sandbox drops connections under load */ }
    await sleep(2500 * a);
  }
  return null;
}

// A recording with no video flag, to set one on. Picked from the sandbox
// release the other Falcon tests use.
const TARGET = '2bea9225-3cee-4a23-b8f3-cd705bed3d06';
// And one that already IS a video, for the preservation half.
const already = await ws2('recording?query=video:true&limit=5&fmt=json');
const VIDEO_REC = (already && (already.recordings || []).find(r => r.video)) || null;
if (!VIDEO_REC) { console.log('could not find an already-video recording on the sandbox'); process.exit(3); }
console.log(`target      : ${TARGET}`);
console.log(`already-video: ${VIDEO_REC.id}  "${VIDEO_REC.title}"`);

const STAMP = 'falcon video proof ' + new Date().toISOString().slice(11, 19);
const before = { target: (await ws2(`recording/${TARGET}?fmt=json`) || {}).video, other: VIDEO_REC.video };
console.log('video BEFORE: ' + JSON.stringify(before));

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
for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/recording/${TARGET}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);

// the seed url carries it, and ONLY when asked for
const seeds = await page.evaluate(() => ({
  on: window.__falconTest.buildSeedEditUrl({ entityType: 'recording', mbid: '00000000-0000-0000-0000-000000000000', urls: [], isrcs: [], video: true }),
  off: window.__falconTest.buildSeedEditUrl({ entityType: 'recording', mbid: '00000000-0000-0000-0000-000000000000', urls: [], isrcs: [], video: false, disambiguation: 'x' }),
  artist: window.__falconTest.buildSeedEditUrl({ entityType: 'artist', mbid: '00000000-0000-0000-0000-000000000000', urls: [], isrcs: [], video: true }),
}));
ck(seeds.on.includes('edit-recording.video=1'), 'video:true seeds MB\'s Video checkbox');
ck(!seeds.off.includes('video'), 'video:false seeds NOTHING — an unseeded checkbox keeps whatever MB already has, so Falcon can never clear the flag');
ck(!seeds.artist.includes('video'), 'and video is recording-only');

// The workers live in the panel, so it has to be open.
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(500);

await page.evaluate(({ target, videoRec, stamp }) => {
  const mk = (mbid, extra) => Object.assign({
    id: 'v' + mbid.slice(0, 4), entityType: 'recording', mbid, urls: [], note: 'Falcon #534 video proof',
    disambiguation: '', isrcs: [], video: false, cover: [], coverExistingCount: null,
    name: null, urlResults: null, status: 'queued', error: '',
  }, extra);
  window.__falconTest.setQueue([
    mk(target, { video: true }),                       // set the flag
    mk(videoRec, { disambiguation: stamp }),           // edit something ELSE on an already-video recording
  ]);
}, { target: TARGET, videoRec: VIDEO_REC.id, stamp: STAMP });
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
console.log('run outcome: ' + JSON.stringify(await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ m: i.mbid.slice(0, 8), v: i.video, s: i.status, e: i.error })))));
await ctx.close();

// ── read it back ────────────────────────────────────────────────────────────
// A video change is NOT an auto-edit: MB queues it for a vote even when the
// flag was previously unset (checked live). So accept either the flag being on
// or a pending edit that says "Video: No → Yes", the same way the #533 proof
// handles added-vs-changed disambiguation.
const ectx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1300, height: 900 } });
const epage = ectx.pages()[0] || await ectx.newPage();
const openEditSaysVideo = async (mbid) => {
  for (let a = 1; ; a++) {
    try { await epage.goto(`${HOST}/recording/${mbid}/open_edits`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) return false; await epage.waitForTimeout(5000); }
  }
  await epage.waitForTimeout(1200);
  return await epage.evaluate(() => [...document.querySelectorAll('.edit-header')]
    .filter(h => h.classList.contains('edit-recording'))
    .some(h => {
      let text = h.innerText || '';
      for (let n = h.nextElementSibling; n && !n.classList.contains('edit-header'); n = n.nextElementSibling) text += String.fromCharCode(10) + (n.innerText || '');
      return /Video:/i.test(text) && /\bYes\b/.test(text);
    }));
};
const afterTarget = (await ws2(`recording/${TARGET}?fmt=json`) || {}).video;
const queued = afterTarget === true ? false : await openEditSaysVideo(TARGET);
console.log(`target video AFTER : ${JSON.stringify(afterTarget)}` + (afterTarget === true ? '  [applied]' : queued ? '  [submitted, pending a vote]' : '  [NOT FOUND]'));
ck(afterTarget === true || queued, 'Falcon set the Video flag on MusicBrainz' + (queued ? ' (queued for voting — a video change is not an auto-edit)' : ''));

// The half that guards against data loss. ⚠ "the flag is still set" is only
// worth anything if Falcon actually EDITED that recording — otherwise the
// assertion passes on an item that quietly did nothing. So check the edit
// exists first: the disambiguation change is queued for a vote (MB does not
// auto-apply a replacement), so look for it among the open edits.
const afterOther = await ws2(`recording/${VIDEO_REC.id}?fmt=json`);
const otherEdited = (afterOther && afterOther.disambiguation === STAMP) || await (async () => {
  for (let a = 1; ; a++) {
    try { await epage.goto(`${HOST}/recording/${VIDEO_REC.id}/open_edits`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) return false; await epage.waitForTimeout(5000); }
  }
  await epage.waitForTimeout(1200);
  return await epage.evaluate(s => (document.body.innerText || '').includes(s), STAMP);
})();
console.log(`already-video AFTER: video=${JSON.stringify(afterOther && afterOther.video)}  disambiguation=${JSON.stringify(afterOther && afterOther.disambiguation)}  falcon-edited=${otherEdited}`);
ck(otherEdited, 'Falcon really did edit the already-video recording (otherwise the next check proves nothing)');
ck(afterOther && afterOther.video === true, 'and doing so did NOT clear its Video flag');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ectx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
