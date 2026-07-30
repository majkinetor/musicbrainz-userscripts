// Bug report (majkinetor, chat): "Spotify links were not found before I first
// submitted ISRCs also obtained via Spotify. Why can't I add both at once -
// first click to get isrcs then click find links." Release used:
// https://musicbrainz.org/release/1bfa31f9-b196-4eb1-a805-e747a610372d
//
// Root cause: spAlbum() (and its bcAlbum/amAlbum/scAlbum siblings) fetch their
// provider's album/embed page ONCE per page load and cache the result in a
// module-level `_spList` variable — but ANY failure (non-200, network error,
// or open.spotify.com's anti-bot serving something other than the real embed)
// resolves to `[]`, and `_spList = []` is truthy in JS, so the very next
// `if (_spList) return _spList;` check treats that permanent empty miss as a
// valid cached result for the rest of the page session. There is no retry —
// only a full page reload resets the module state, which is why it "started
// working" only after the user did something (like reload the page after
// submitting) that reset the script.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 }, bypassCSP: true });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = (k) => store.delete(k);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.__spQueue = [];
  // Minimal GM_xmlhttpRequest shim: real fetch for everything (same-origin WS2, credentials
  // included), except the Spotify embed page, which is served from a controllable queue so
  // the test can simulate a failed first attempt and a successful retry.
  window.GM_xmlhttpRequest = (opts) => {
    const isSpotifyEmbed = /open\.spotify\.com\/embed\/album\//.test(opts.url || '');
    if (isSpotifyEmbed) {
      const resp = window.__spQueue.length ? window.__spQueue.shift() : { status: 500, responseText: '' };
      setTimeout(() => { try { opts.onload && opts.onload(resp); } catch (e) {} }, 0);
      return { abort() {} };
    }
    fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, credentials: 'include' })
      .then(async r => { const text = await r.text(); opts.onload && opts.onload({ status: r.status, responseText: text }); })
      .catch(e => { opts.onerror && opts.onerror(e); });
    return { abort() {} };
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/1bfa31f9-b196-4eb1-a805-e747a610372d', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 10000 });
await page.click('#ii-btn');
await page.waitForSelector('tr[data-idx]', { timeout: 15000 });   // RELEASE loaded + rendered

console.log('modal opened, tracks rendered');

const NEXT_DATA_HTML = (tracks) => '<html><body><script id="__NEXT_DATA__" type="application/json">' +
  JSON.stringify({ props: { pageProps: { state: { data: { entity: { trackList: tracks } } } } } }) +
  '</script></body></html>';

// 1) simulate a failed embed fetch (anti-bot / transient) — resolve() must come back empty, not throw
await page.evaluate(() => { window.__spQueue = [{ status: 503, responseText: 'blocked' }]; });
const first = await page.evaluate(async () => {
  const sp = window.__isrcScoutTest466.PROV.find(p => p.code === 'sp');
  return await sp.resolve(null, { title: 'Test Track One' }, 0);
});
console.log('first attempt (simulated anti-bot failure):', first);
ck(first === null, 'a failed embed fetch resolves to null (no candidate), not a thrown error');

// 2) retry immediately after — with the bug, _spList is already permanently cached to [] and this
//    would ALSO return null even though the embed page is now available; with the fix, it retries.
await page.evaluate((html) => { window.__spQueue = [{ status: 200, responseText: html }]; },
  NEXT_DATA_HTML([{ uri: 'spotify:track:abc111', title: 'Test Track One' }, { uri: 'spotify:track:def222', title: 'Test Track Two' }]));
const second = await page.evaluate(async () => {
  const sp = window.__isrcScoutTest466.PROV.find(p => p.code === 'sp');
  return await sp.resolve(null, { title: 'Test Track One' }, 0);
});
console.log('second attempt (embed now available):', second);
ck(second === 'https://open.spotify.com/track/abc111', `retrying after a transient failure finds the real Spotify link (got ${JSON.stringify(second)})`);

// 3) a third call for a DIFFERENT track position must reuse the (now-successful) cache, not refetch —
//    prove the fix doesn't regress the whole point of caching (avoid hammering Spotify per track).
await page.evaluate(() => { window.__spQueue = [{ status: 500, responseText: 'should not be used' }]; });
const third = await page.evaluate(async () => {
  const sp = window.__isrcScoutTest466.PROV.find(p => p.code === 'sp');
  return await sp.resolve(null, { title: 'Test Track Two' }, 1);
});
console.log('third attempt (should reuse the successful cache, not the poisoned queue):', third);
ck(third === 'https://open.spotify.com/track/def222', `a successful embed fetch IS still cached across calls (got ${JSON.stringify(third)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
