// Two defects majkinetor hit on the same release (c5e238d3 "CHROME"), both
// reported with a screenshot and an export:
//
//   1. "there is no cover shown after we added disamb" — #533 added 'release'
//      to DISAMBIGUATABLE, and the expanded row read
//      `canDisambig ? <disambiguation> : release ? <cover>`, so a release's
//      cover-art editor became unreachable the moment it could carry a comment.
//
//   2. "the export shows wrong image (not highest res)" — pickBestCover trusted
//      Harmony's caption metadata when present. On his export Tidal advertised
//      3000x3000 for an image that is really 1280x1280, tied with the genuine
//      3000x3000 iTunes one, and won the lowest-size tie-break. chaban reported
//      the same "added lower res" on 2026.8.17, which this explains.
//
// Nothing is submitted: every POST is aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const RELEASE = 'c5e238d3-c722-402b-8631-20c1a99c3e37';   // majkinetor's own case
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
// ⚠ Falcon measures covers through GM_xmlhttpRequest, which bypasses CORS. A
// page-context fetch cannot — so without a real shim every measurement fails,
// the code silently falls back to the (wrong) caption numbers, and this test
// would "pass" against the very bug it exists to catch. Route the bytes through
// Node instead, which is what the userscript manager effectively does.
await page.exposeFunction('__fetchBytes', async (url) => {
  const r = await fetch(url);
  if (!r.ok) return { ok: false, status: r.status };
  const buf = Buffer.from(await r.arrayBuffer());
  return { ok: true, status: r.status, type: r.headers.get('content-type') || 'image/jpeg', b64: buf.toString('base64') };
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
// MB's own pages POST to Sentry; only a POST at musicbrainz.org counts as
// "Falcon tried to write something".
const posts = [];
await page.route(() => true, route => {
  const req = route.request();
  if (req.method() === 'POST') { posts.push(req.url()); return route.abort(); }
  return route.continue();
});
const mbPosts = () => posts.filter(u => /(^|\.)musicbrainz\.org\//.test(u));
for (let a = 1; ; a++) {
  try { await page.goto(`https://musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
}
await page.waitForTimeout(800);
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });

// ── the exact candidate list from his export ────────────────────────────────
const CANDIDATES = [
  { provider: 'Spotify', url: 'https://i.scdn.co/image/ab67616d0000b2739a5e2d43d34866b89dd11922', width: 2000, height: 2000, size: 790390 },
  { provider: 'Deezer', url: 'https://cdn-images.dzcdn.net/images/cover/4d82f8fedcd72ac3b3bdd5699778ee6f/1000x1000-000000-80-0-0.jpg', width: 1200, height: 1200, size: 726550 },
  { provider: 'iTunes', url: 'https://a1.mzstatic.com/us/r1000/063/Music211/v4/12/44/32/12443250-8925-e891-808d-4df4fef10759/cover.jpg', width: 3000, height: 3000, size: 5580000 },
  { provider: 'Tidal', url: 'https://resources.tidal.com/images/27083100/2879/4034/8084/2e353af1934a/1280x1280.jpg', width: 3000, height: 3000, size: 2560000 },
];
await page.evaluate(({ mbid, cands }) => {
  window.__falconTest.setQueue([{
    id: 'c1', entityType: 'release', mbid, name: 'CHROME', note: '', urls: [], disambiguation: '',
    isrcs: [], video: false, aliases: [], coverExistingCount: null, name2: null, urlResults: null,
    cover: [{ url: cands[3].url, comment: '', type: 'Front', candidates: cands }],
    status: 'queued', error: '',
  }]);
}, { mbid: RELEASE, cands: CANDIDATES });

// ── 1. the cover editor must be reachable on a release that can be disambiguated ──
await page.evaluate(() => {
  const it = window.__falconTest.getQueue()[0];
  it.disambiguation = 'deluxe';                     // the state from his screenshot
  window.__falconTest.setQueue(window.__falconTest.getQueue());
  document.querySelector('.falcon-row-expand').click();
});
await page.waitForTimeout(400);
const ui = await page.evaluate(() => ({
  disambig: !!document.querySelector('.falcon-disambiguation-input'),
  coverUrl: !!document.querySelector('.falcon-cover-input'),
  coverType: !!document.querySelector('.falcon-cover-type'),
  pickers: document.querySelectorAll('.falcon-cover-pick').length,
}));
console.log('expanded release row: ' + JSON.stringify(ui));
ck(ui.disambig, 'the disambiguation box is shown');
ck(ui.coverUrl && ui.coverType, 'AND the cover-art editor is shown on the same row (#533 regression)');
ck(ui.pickers === CANDIDATES.length, `with one provider chip per candidate (${ui.pickers})`);

// ── 2. the pick must be the genuinely largest image ─────────────────────────
await page.evaluate(() => window.__falconTest.pickBestCover(window.__falconTest.getQueue()[0]));
await page.waitForFunction(() => {
  const c = window.__falconTest.getQueue()[0].cover[0];
  return c.candidates.every(x => x.measured !== undefined) || c.url;
}, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const c = window.__falconTest.getQueue()[0].cover[0];
  return { picked: c.url, cands: c.candidates.map(x => `${x.provider} ${x.width}×${x.height} ${(x.size / 1024).toFixed(0)}KB`) };
});
console.log('after measuring:');
after.cands.forEach(c => console.log('   ' + c));
console.log('picked: ' + after.picked);
ck(/mzstatic/.test(after.picked), 'the real 3000×3000 iTunes image wins, not Tidal\'s 1280 one claiming to be 3000');
ck(after.cands.some(c => /Tidal 1280×1280/.test(c)), 'and the Tidal candidate now advertises its true size in the UI');
ck(after.cands.some(c => /Spotify 640×640/.test(c)), 'as does Spotify (caption said 2000×2000)');

ck(mbPosts().length === 0, `nothing was submitted to MusicBrainz (${mbPosts().length} POSTs; ${posts.length - mbPosts().length} unrelated, e.g. Sentry)`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
