// #439 (Platform Check) — SoundCloud as a link-derived barcode provider.
// Injects a SoundCloud SET anchor (Reincarnate, which carries upc_or_ean) into a
// release page so PC's DOM parse sees it as the existing SoundCloud link, then
// asserts the SoundCloud row fetches the set and surfaces its barcode + tracks
// from the anonymous api-v2. Read-only.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const SC_SET = 'https://soundcloud.com/cltxx/sets/reincarnate-4';   // set with upc_or_ean 8058365652237
const WANT_UPC = '8058365652237';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url(), responseHeaders: '' }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url, responseHeaders: '' }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  const store = new Map();
  window.__store = store;
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  const SC = 'https://soundcloud.com/cltxx/sets/reincarnate-4';
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {}, data: o.data }).then(r => {
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try { const j = JSON.parse(r.responseText); j.relations = (j.relations || []).filter(x => !/soundcloud\.com/.test(x.url?.resource || '')); j.relations.push({ 'target-type': 'url', url: { resource: SC } }); r.responseText = JSON.stringify(j); } catch (e) {}
      }
      o.onload && o.onload({ status: r.status, finalUrl: r.finalUrl, responseText: r.responseText, responseHeaders: r.responseHeaders });
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
});
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
// #527 follow-up: this MBID is also used by verify-527-sc-track-on-multitrack.mjs
// (same "Reincarnate" fixture). The persistent .pw-profile means localStorage
// survives across separate test-file runs — clear this MBID's own cache first
// so a prior run's entry (possibly source="search" from the other test)
// can't short-circuit this one via the cache-hit path.
await page.evaluate((mbid) => {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.includes(mbid)) localStorage.removeItem(k);
  }
}, MBID);
// inject a SoundCloud set link into the page so PC's DOM parse treats it as the existing link
await page.evaluate((href) => {
  // strip the release's own SoundCloud anchors (this release links a UPC-less set) so our injected set is the only one
  document.querySelectorAll('a[href*="soundcloud.com"]').forEach(a => a.remove());
  for (const sel of ['#content', '#sidebar', 'body']) { const c = document.querySelector(sel); if (c) { const a = document.createElement('a'); a.href = href; a.textContent = 'SoundCloud'; a.className = 'pc-test-sc'; c.appendChild(a); } }
}, SC_SET);
await page.addScriptTag({ content: code });
// wait for PC's SoundCloud scan to write its cache entry
await page.waitForFunction((mbid) => {
  const raw = localStorage.getItem('pc:cache:v2:soundcloud:' + mbid);
  try { return !!(raw && JSON.parse(raw).url); } catch { return false; }
}, MBID, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(500);

const r = await page.evaluate((mbid) => {
  let cache = null; try { cache = JSON.parse(localStorage.getItem('pc:cache:v2:soundcloud:' + mbid) || 'null'); } catch {}
  const row = document.getElementById('row-soundcloud');
  return { rowExists: !!row, cache, barcodeDiff: !!(row && (row.hasAttribute('data-barcode-diff') || row.className.includes('barcode'))) };
}, MBID);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.rowExists, 'SoundCloud provider row rendered in the PC panel');
ck(r.cache && r.cache.url && /soundcloud\.com\/[^/]+\/sets\//.test(r.cache.url), 'resolved the SoundCloud set link');
ck(r.cache && r.cache.barcode === WANT_UPC, `barcode read from api-v2 upc_or_ean (${r.cache && r.cache.barcode})`);
ck(r.cache && r.cache.tracks === 3, `track count read from the set (${r.cache && r.cache.tracks})`);
ck(r.cache && r.cache.label === 'Blacklapse Records', `label parsed from publisher_metadata (${r.cache && r.cache.label})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
