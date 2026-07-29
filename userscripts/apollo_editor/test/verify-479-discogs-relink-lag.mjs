// #479 (majkinetor): "Once a missing Discogs link has been added to an artist it
// probably makes sense to change the button to the normal MB one." Follow-up:
// "It does change them, although probably due to rate limit it fails to always
// do so."
//
// Root cause isn't actually a 429 — /ws/js/entity (what reTagAfterDiscogsLink
// checks right after an add) is the internal editor endpoint, and the request
// itself already retries on 429/503. The real failure is read-after-write lag:
// right after the edit commits, that endpoint can still answer with the OLD
// (link-less) relationship list for a moment. artistDiscogsUrls() caches ANY
// successful response — including that stale empty one — so the button stays
// wrong until something unrelated happens to drop the cache.
//
// This mocks exactly that: the first two /ws/js/entity reads for the test
// artist come back with NO Discogs relationship, then a third (and every one
// after) includes it — simulating the write catching up. Verifies
// reTagAfterDiscogsLink() retries past the stale reads instead of accepting
// the first (wrong) answer.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const GID = '18b7a9f8-ece2-44fb-bcc6-c8747c4f0f41';   // Eric Van Wonterghem — real gid, just reused as a stand-in
const URL_ADDED = 'https://www.discogs.com/artist/205719';
const log = (...a) => console.log('[verify-479]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
// The homepage (not gated behind login, unlike a real /edit page) is enough —
// __apolloEditor is exposed unconditionally once the script is injected, and
// this test only exercises reTagAfterDiscogsLink()/artistDiscogsUrls() against
// a fully mocked fetch, no real release data needed.
await page.goto(`${O}/`, { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!(await page.evaluate(() => !!window.__apolloEditor))) { log('no API'); await ctx.close(); process.exit(2); }

const r = await page.evaluate(async ({ GID, URL_ADDED }) => {
  const A = window.__apolloEditor;
  let calls = 0;
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, opts) => {
    const url = String(u);
    if (url.includes(`/ws/js/entity/${GID}`)) {
      calls++;
      const relationships = calls <= 2
        ? []   // stale read-after-write: the edit hasn't shown up here yet
        : [{ linkTypeID: 180, target_type: 'url', target: { name: URL_ADDED } }];
      return Promise.resolve(new Response(JSON.stringify({ relationships }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(u, opts);
  };
  const t0 = Date.now();
  await A.reTagAfterDiscogsLink(GID, URL_ADDED, 'Test Artist');
  const elapsedMs = Date.now() - t0;
  const finalCached = await A.artistDiscogsUrls(GID);   // uncached (no force) — must reflect the settled, correct answer
  return { calls, elapsedMs, finalCached };
}, { GID, URL_ADDED });

log('internal /ws/js/entity calls made:', r.calls);
log('elapsed ms:', r.elapsedMs);
log('final cached relationship list:', JSON.stringify(r.finalCached));

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
ck(r.calls >= 3, `retried past the stale empty reads (${r.calls} internal calls, needed >= 3)`);
ck(Array.isArray(r.finalCached) && r.finalCached.some(u => u.includes('205719')), `the newly-added link is reflected once the retry catches up (got ${JSON.stringify(r.finalCached)})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
