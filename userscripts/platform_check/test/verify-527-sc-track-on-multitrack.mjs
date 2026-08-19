// #527 (majkinetor, live): "For some reason Platform Check picks a random
// Soundcloud URL from the recordings of a release with 11 tracks." A
// track-level SoundCloud relationship (or anything the DOM/API scrape
// mistook for the release's own SoundCloud link) got trusted as-is even
// though its own SET fetch reports tracks=1 on an 11-track release.
//
// This test injects a BARE-TRACK SoundCloud URL (tracks=1, verified via
// #439's verify-439-sc-track.mjs fixture) as the "existing" relation on the
// known 3-track "Reincarnate" release (ec2449a8-3dc5-461c-80a1-e43d96345613,
// used by verify-439-sc.mjs) — a clean mbTracks=3 > 1 mismatch. Asserts PC
// does NOT trust the mismatched single-track URL as "MB rels": it must fall
// through to a native search instead, landing back on the release's real
// SET link (sets/reincarnate-4, tracks=3) via source=search.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const SC_BARE_TRACK = 'https://soundcloud.com/ace-uzumakii/ice-punch-w-lil-pokedexxx-prod-gyptxvn-honk';   // verified tracks=1 (#439)

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url(), responseHeaders: '' }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url, responseHeaders: '' }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript((SC) => {
  const store = new Map();
  window.__store = store;
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {}, data: o.data }).then(r => {
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try { const j = JSON.parse(r.responseText); j.relations = (j.relations || []).filter(x => !/soundcloud\.com/.test(x.url?.resource || '')); j.relations.push({ 'target-type': 'url', url: { resource: SC } }); r.responseText = JSON.stringify(j); } catch (e) {}
      }
      o.onload && o.onload({ status: r.status, finalUrl: r.finalUrl, responseText: r.responseText, responseHeaders: r.responseHeaders });
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
}, SC_BARE_TRACK);
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
// inject the bare-track anchor so PC's DOM parse also treats it as the existing link
await page.evaluate((href) => {
  document.querySelectorAll('a[href*="soundcloud.com"]').forEach(a => a.remove());
  for (const sel of ['#content', '#sidebar', 'body']) { const c = document.querySelector(sel); if (c) { const a = document.createElement('a'); a.href = href; a.textContent = 'SoundCloud'; a.className = 'pc-test-sc'; c.appendChild(a); } }
}, SC_BARE_TRACK);
await page.addScriptTag({ content: code });
await page.waitForFunction((mbid) => {
  const raw = localStorage.getItem('pc:cache:v2:soundcloud:' + mbid);
  try { return !!(raw && JSON.parse(raw).url); } catch { return false; }
}, MBID, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(500);

const r = await page.evaluate((mbid) => {
  let cache = null; try { cache = JSON.parse(localStorage.getItem('pc:cache:v2:soundcloud:' + mbid) || 'null'); } catch {}
  return { rowExists: !!document.getElementById('row-soundcloud'), cache };
}, MBID);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.rowExists, 'SoundCloud provider row rendered in the PC panel');
ck(r.cache && r.cache.url !== SC_BARE_TRACK, `the mismatched bare-track URL was NOT trusted as the release's own (got "${r.cache && r.cache.url}")`);
ck(r.cache && r.cache.source === 'search', `fell through to a native search instead of "MB rels" (got source="${r.cache && r.cache.source}")`);
ck(r.cache && /\/sets\//.test(r.cache.url || ''), `landed on a real SET link, not a bare track (got "${r.cache && r.cache.url}")`);
ck(r.cache && r.cache.tracks === 3, `track count matches the release (${r.cache && r.cache.tracks})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
