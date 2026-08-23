// majkinetor, live log (Falcon 2026.8.23.132707) on a Harmony import:
//
//   14:19:57  starting 1 worker(s) for 1 queued item(s)
//   14:19:57  [w1] release 03c06cdb — skipped, nothing filled in
//   14:19:57  === run finished ===
//   14:19:58  resolved 10 ISRC-only recording(s) …
//   14:19:59  cover: picked iTunes — 3000×3000 …
//
// "It didnt auto start and skipped covers while there arent any on release."
//
// Two races, both opened wider by measuring every cover candidate:
//   1. the release item was judged with `cover.some(c => c.url)` while the pick
//      was still measuring, so it read as "nothing filled in" and was skipped;
//   2. auto-start fired on the synchronous half of the Harmony payload, so the
//      ISRC-only recordings — resolved a second later — arrived after the run
//      had already finished.
//
// This pins (1), which is the part that silently drops a cover. Nothing is
// submitted: every POST is aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

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
const posts = [];
await page.route(() => true, route => {
  const req = route.request();
  if (req.method() === 'POST') { posts.push(req.url()); return route.abort(); }
  return route.continue();
});
// Cover measuring goes through GM_xmlhttpRequest (cross-origin). Route it via
// Node — AND make it slow, so the race this test is about is guaranteed to be
// open when the worker looks at the item, instead of depending on the network
// being unlucky.
await page.exposeFunction('__fetchBytes', async (url) => {
  await new Promise(r => setTimeout(r, 1500));
  const r = await fetch(url);
  if (!r.ok) return { ok: false, status: r.status };
  const buf = Buffer.from(await r.arrayBuffer());
  return { ok: true, type: r.headers.get('content-type') || 'image/jpeg', b64: buf.toString('base64') };
});
await page.addInitScript(() => {
  window.GM_xmlhttpRequest = ({ url, onload, onerror }) => {
    window.__fetchBytes(url).then(res => {
      if (!res.ok) return onload && onload({ status: res.status, response: null });
      const bin = atob(res.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      onload && onload({ status: 200, response: new Blob([bytes], { type: res.type }) });
    }).catch(e => onerror && onerror(e));
  };
});

for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });

// A release exactly as a Harmony import leaves it a beat after arriving:
// candidates present, no url chosen yet.
const CANDIDATES = [
  { provider: 'Deezer', url: 'https://cdn-images.dzcdn.net/images/cover/4d82f8fedcd72ac3b3bdd5699778ee6f/1000x1000-000000-80-0-0.jpg' },
  { provider: 'iTunes', url: 'https://a1.mzstatic.com/us/r1000/063/Music211/v4/12/44/32/12443250-8925-e891-808d-4df4fef10759/cover.jpg' },
];
await page.evaluate(({ mbid, cands }) => {
  window.__falconTest.setQueue([{
    id: 'r1', entityType: 'release', mbid, name: 'race case', note: '', source: '', urls: [],
    disambiguation: '', isrcs: [], video: false, aliases: [], coverExistingCount: null, urlResults: null,
    cover: [{ url: '', comment: '', type: 'Front', candidates: cands }],
    status: 'queued', error: '',
  }]);
  // start the pick, exactly as the Harmony path does, and start the run
  // IMMEDIATELY — the whole point is that the pick has not finished yet.
  const it = window.__falconTest.getQueue()[0];
  it._coverPickPromise = window.__falconTest.pickBestCover(it);
}, { mbid: RELEASE, cands: CANDIDATES });

const urlAtStart = await page.evaluate(() => window.__falconTest.getQueue()[0].cover[0].url);
console.log('cover url at the moment the run starts: ' + JSON.stringify(urlAtStart));
ck(urlAtStart === '', 'the pick really is still in flight when the run begins (otherwise this test proves nothing)');

await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 180000 }).catch(() => {});
const out = await page.evaluate(() => {
  const i = window.__falconTest.getQueue()[0];
  return { status: i.status, error: i.error, picked: i.cover[0].url, log: window.__falconTest.getLog().filter(l => /cover|upload|sign/i.test(String(l))) };
});
console.log('outcome: ' + JSON.stringify({ status: out.status, error: out.error, picked: out.picked }));
out.log.forEach(l => console.log('   ' + l));
ck(!/nothing filled in/.test(out.error || ''), 'the release is NOT dismissed as "nothing filled in" while its cover pick is running');
ck(out.status !== 'skipped', `and it is not skipped (status: ${out.status})`);
ck(/mzstatic/.test(out.picked), 'the pick completed and chose the largest image');
// The item can only end up failed here: this harness routes every request, and
// MB's upload-signing call does not survive that (it succeeds in
// live-536-cover-edit-note.mjs, which does no interception and really uploads).
// So the property to assert is that the worker WENT DOWN THE UPLOAD PATH —
// fetched the image and asked MB to sign it — instead of writing the cover off
// as "nothing filled in", which is the bug.
const reached = out.log.filter(l => /fetching cover image|signing upload/i.test(String(l)));
ck(reached.length >= 2, 'the worker went on to fetch the image and ask MusicBrainz to sign the upload');
console.log('error after the harness blocked the signing call: ' + JSON.stringify(out.error));
const mbPosts = posts.filter(u => /(^|\.)musicbrainz\.org\//.test(u));
console.log(`POSTs seen: ${posts.length} (${mbPosts.length} at MusicBrainz — ${JSON.stringify(mbPosts[0] || '')})`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
