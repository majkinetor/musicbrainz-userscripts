// #466 (chaban-mb) — a recording with MULTIPLE ISRCs (a reissue/relabel gets its own
// code for the same recording) only ever had its FIRST isrc tried against a provider,
// so Qobuz missed tracks 8 and 10 on the reported release: Qobuz's catalogue has them
// under the recording's OTHER isrc.
//   https://musicbrainz.org/release/b0a00236-e218-47ae-9d38-ec96f3fe9fff
//   track 8  "NordBerliner" — isrcs ["DEZC62660402","DEZC62685941"]
//   track 10 "Mach Platz!"  — isrcs ["DEZC62665288","DEZC62685943"]
//
// This reproduces exactly that: Qobuz's mocked album/get carries every real track's
// ISRC EXCEPT tracks 8/10, where only their SECOND (not first) isrc is used — mirroring
// the real-world mismatch — then calls resolveProvider('qz') directly (via a test-only
// hook) and confirms both tracks resolve. Real MB data throughout (only Qobuz is mocked).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = 'b0a00236-e218-47ae-9d38-ec96f3fe9fff';

// Real per-track data (title, MB recording ISRCs) — tracks 8/10 use ONLY their 2nd ISRC below.
const TRACKS = [
  ['Fuck You!', ['DEZC62685934']], ['65Chambers', ['DEZC62685935']], ['Azz Blown Off', ['DEZC62685936']],
  ['3x', ['DEZC62685937']], ['6 Fuß Tiefe', ['DEZC62685938']], ['Für die Ghulz Pt.2', ['DEZC62685939']],
  ['Was Du Brauchzt', ['DEZC62685940']], ['NordBerliner', ['DEZC62685941']], ['Brain Dead', ['DEZC62685942']],
  ['Mach Platz!', ['DEZC62685943']], ['Who You Think?!', ['DEZC62685944']], ["Wo Wir Häng'", ['DEZC62685945']],
  ['EBK', ['DEZC62685946']],
];
const qobuzFixture = JSON.stringify({
  title: 'Vol.1-6 Kämmern 5 Kugeln der Zirkel',
  tracks: { items: TRACKS.map(([title, isrcs], i) => ({
    isrc: isrcs[0], title, performer: { name: 'Test Artist' }, media_number: 1, track_number: i + 1, duration: 180, id: 900000 + i,
  })) },
});

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  try {
    const resp = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 20 });
    return { status: resp.status(), responseText: await resp.text(), finalUrl: resp.url() };
  } catch (e) { return { status: 0, responseText: '', finalUrl: opts.url }; }
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript((fixture) => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.__qbCalls = [];
  window.GM_xmlhttpRequest = (o) => {
    const done = (status, text) => setTimeout(() => o.onload && o.onload({ status, responseText: text, finalUrl: o.url }), 20);
    if (/qobuz\.com\/api\.json/.test(o.url)) {
      window.__qbCalls.push(o.url);
      return done(200, fixture);
    }
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => o.onload && o.onload(r)).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
}, qobuzFixture);
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.waitForFunction(() => !!window.__isrcScoutTest466, { timeout: 5000 });

// Call resolveProvider directly for JUST Qobuz — no need to also mock Deezer/Tidal/Apple/Spotify.
await page.evaluate(async () => {
  const { PROV, resolveProvider } = window.__isrcScoutTest466;
  const qz = PROV.find(p => p.code === 'qz');
  await resolveProvider(qz);
});
await page.waitForTimeout(500);

const r = await page.evaluate(() => {
  const get = idx => {
    const el = document.querySelector(`tr[data-idx="${idx}"] .ii-tl-add .ii-tl[data-code="qz"]`);
    return el ? { cls: el.className, href: el.getAttribute('href') } : null;
  };
  return { t8: get(7), t10: get(9), qbCalls: window.__qbCalls.length };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.qbCalls === 1, `exactly one Qobuz album/get call (cached across all 13 tracks) — got ${r.qbCalls}`);
ck(r.t8 && r.t8.cls.includes('new') && /open\.qobuz\.com\/track\/900007/.test(r.t8.href || ''), `track 8 "NordBerliner" resolves via its 2nd ISRC (${JSON.stringify(r.t8)})`);
ck(r.t10 && r.t10.cls.includes('new') && /open\.qobuz\.com\/track\/900009/.test(r.t10.href || ''), `track 10 "Mach Platz!" resolves via its 2nd ISRC (${JSON.stringify(r.t10)})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
