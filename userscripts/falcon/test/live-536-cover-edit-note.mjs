// #536 (majkinetor): "Unlike Art Station or native MB cover art uploader with
// ECAU Falcon doesn't add detailed edit note indicating source".
//
// A REAL cover upload on test.musicbrainz, whose edit note is then read back off
// the edit page. Nothing is intercepted or faked — an edit note can only be
// checked by looking at the edit MusicBrainz actually created.
//
// Sandbox only: refuses to run against any host but test.musicbrainz.org.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); process.exit(2); }
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const NL = String.fromCharCode(10);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// Two real images of different sizes, so the note has a genuine choice to
// describe — and the smaller one is listed first, so "it named the winner"
// cannot pass by accident.
const CANDIDATES = [
  { provider: 'Deezer', url: 'https://cdn-images.dzcdn.net/images/cover/4d82f8fedcd72ac3b3bdd5699778ee6f/1000x1000-000000-80-0-0.jpg' },
  { provider: 'iTunes', url: 'https://a1.mzstatic.com/us/r1000/063/Music211/v4/12/44/32/12443250-8925-e891-808d-4df4fef10759/cover.jpg' },
];

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
// Falcon fetches images through GM_xmlhttpRequest, which crosses origins. Route
// those bytes via Node — that is what a userscript manager does for real, and
// without it every fetch fails and this test proves nothing.
await page.exposeFunction('__fetchBytes', async (url) => {
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

const NOTE = 'Falcon #536 edit-note proof';
await page.evaluate(({ mbid, cands, note }) => {
  window.__falconTest.setQueue([{
    id: 'n1', entityType: 'release', mbid, name: null, note, urls: [], disambiguation: '',
    isrcs: [], video: false, aliases: [], coverExistingCount: null, urlResults: null,
    cover: [{ url: '', comment: 'Falcon proof image', type: 'Front', candidates: cands }],
    status: 'queued', error: '',
  }]);
}, { mbid: RELEASE, cands: CANDIDATES, note: NOTE });

// let it measure and pick, then inspect the note it WOULD send
await page.evaluate(() => window.__falconTest.pickBestCover(window.__falconTest.getQueue()[0]));
await page.waitForFunction(() => !!window.__falconTest.getQueue()[0].cover[0].url, null, { timeout: 120000 }).catch(() => {});
const preview = await page.evaluate(() => {
  const it = window.__falconTest.getQueue()[0];
  return { picked: it.cover[0].url, note: window.__falconTest.coverEditNote(it, it.cover[0], null) };
});
console.log('--- note Falcon will send ---');
console.log(preview.note);
console.log('---');
ck(/mzstatic/.test(preview.picked), 'the larger iTunes image was picked');
ck(preview.note.startsWith(NOTE), "the item's own note is kept as the first line");
ck(preview.note.includes(preview.picked), 'the note states the exact image URL being uploaded');
ck(/from iTunes/.test(preview.note), 'and which provider it came from');
ck(/also offered: Deezer 1000×1000/.test(preview.note), 'and what it beat, so a voter can judge the choice');
ck(/Falcon v/.test(preview.note), 'with the script signature still there');

// ── now really upload it, and read the note back off MusicBrainz ────────────
const t0 = Date.now();
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
const outcome = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error })));
console.log('run outcome: ' + JSON.stringify(outcome) + ` (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
ck(outcome[0].s === 'done', 'the cover upload succeeded');
await page.waitForTimeout(3000);

await page.goto(`${HOST}/release/${RELEASE}/edits`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(1500);
const landed = await page.evaluate((nl) => {
  const heads = [...document.querySelectorAll('.edit-header')].filter(h => /Add cover art/i.test(h.innerText || ''));
  if (!heads.length) return null;
  const h = heads[0];
  let text = h.innerText || '';
  for (let n = h.nextElementSibling; n && !n.classList.contains('edit-header'); n = n.nextElementSibling) text += nl + (n.innerText || '');
  return text;
}, NL);
console.log('--- newest Add-cover-art edit on MusicBrainz ---');
console.log((landed || '(none found)').slice(0, 900));
console.log('---');
ck(!!landed && landed.includes(NOTE), "MusicBrainz stored the note (found on the release's newest Add cover art edit)");
ck(!!landed && /mzstatic/.test(landed), 'including the source image URL');
ck(!!landed && /also offered/.test(landed), 'and the candidates it was chosen over');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
