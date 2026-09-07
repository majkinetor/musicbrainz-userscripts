// #575 (majkinetor): "Matching takes too long … it looks like it goes serial and
// very slow at that. Both artist and recording match. Many duplicates messages
// in log too." Six of forty-two tracks matched in ten minutes.
//
// Measured from the session log he attached: 115 /ws/2 requests for 48 distinct
// URLs — 67 of them (58%) exact duplicates — and 25 throttle events. One query,
// arid+"Martha Badibala", went out TEN times.
//
// The cause is a cache stampede, not slow code. Every per-caller cache is checked
// before its await and written after it, so N slots resolving the same artist all
// miss, all enqueue, and the cache only starts working once the first reply lands.
// /ws/2 reads are deliberately serialised with a gap between them, so each
// duplicate costs a whole queue slot, and the extra volume is what trips MB's
// rate limiter — whose backoff then slows everything behind it.
//
// wsJson now coalesces in flight. This drives it directly with a stubbed fetch
// that counts real network calls, so the assertions are about behaviour rather
// than about a wall-clock number that would vary run to run.
//
// Run: node test/verify-575-ws-coalesce.mjs
//      APOLLO_SRC=<path> node test/verify-575-ws-coalesce.mjs   (another build)
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js');
const log = (...a) => console.log('[verify-575]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const code = await readFile(SCRIPT, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 10000 });

// Guarded so a build that predates the export reports it instead of throwing an
// unreadable "not a function" out of page.evaluate.
if (!await page.evaluate(() => typeof (window.__apolloEditor || {}).wsJson === 'function')) {
  ck(false, 'wsJson is exported for testing — this build does not export it');
  console.log('\n1 FAIL'); await browser.close(); process.exit(1);
}

// A fetch stub that records every call and answers on demand, so "did this go to
// the network" is a fact rather than an inference from timing.
await page.evaluate(() => {
  window.__net = [];
  // url -> {status, body}, STICKY until cleared: a planned 503 has to survive
  // every retry inside one wsJson call, or the retry loop turns it into a 200
  // and the test proves nothing about failures.
  window.__plan = {};
  window.fetch = (url) => {
    window.__net.push(String(url));
    const p = window.__plan[String(url)] || { status: 200, body: { artists: [] } };
    return new Promise(res => setTimeout(() => res({
      ok: p.status >= 200 && p.status < 300,
      status: p.status,
      headers: { get: () => null },
      json: async () => p.body,
    }), 60));   // long enough that concurrent callers really do overlap
  };
});
const netFor = u => page.evaluate(u => window.__net.filter(x => x === u).length, u);
const A = 'https://musicbrainz.org/ws/2/artist?query=alias%3A%22Martha%20Badibala%22&fmt=json';
const B = 'https://musicbrainz.org/ws/2/artist?query=alias%3A%22Kalombo%20Albino%22&fmt=json';

// 1. the actual bug: ten concurrent identical lookups must be ONE request
const burst = await page.evaluate(async u => {
  const rs = await Promise.all(Array.from({ length: 10 }, () => window.__apolloEditor.wsJson(u, { label: 'alias search' })));
  return { n: window.__net.filter(x => x === u).length, allSame: rs.every(r => r === rs[0]), allHaveJson: rs.every(r => r && r.json) };
}, A);
log('ten concurrent identical lookups:', JSON.stringify(burst));
ck(burst.n === 1, `ten concurrent identical lookups make ONE request (got ${burst.n})`);
ck(burst.allSame, 'every caller gets the same settled result');
ck(burst.allHaveJson, 'and it is a real answer, not a dropped/stale marker');

// 2. it must not become a cache: once settled, a later call really re-fetches.
// A response that a caller decided not to keep (#555 — a throttled miss must not
// be remembered) has to be retryable.
const later = await page.evaluate(async u => {
  await window.__apolloEditor.wsJson(u, { label: 'alias search' });
  return window.__net.filter(x => x === u).length;
}, A);
log('after the flight settled, one more call:', later);
ck(later === 2, `a call AFTER the flight settled goes to the network again — this is a flight, not a cache (got ${later})`);

// 3. different URLs are not conflated
const two = await page.evaluate(async ([u1, u2]) => {
  const before = window.__net.length;
  await Promise.all([window.__apolloEditor.wsJson(u1, {}), window.__apolloEditor.wsJson(u2, {})]);
  return window.__net.length - before;
}, [A + '&x=1', B]);
ck(two === 2, `two DIFFERENT urls still make two requests (got ${two})`);

// 4. a throttled flight is shared too, and every sharer sees the failure —
// nobody may be handed a false "0 hits", which is the bug #555 fixed
const throttled = await page.evaluate(async u => {
  window.__plan[u] = { status: 503, body: { error: 'rate limited' } };
  const rs = await Promise.all([1, 2, 3].map(() => window.__apolloEditor.wsJson(u, { label: 'alias search' })));
  delete window.__plan[u];
  return { n: window.__net.filter(x => x === u).length, noneClaimJson: rs.every(r => !r.json), same: rs.every(r => r === rs[0]), shape: rs[0] };
}, B + '&t=1');
log('throttled flight:', JSON.stringify(throttled));
ck(throttled.same, 'concurrent callers share a throttled flight as well');
ck(throttled.noneClaimJson, `none of them is handed a fake empty result (got ${JSON.stringify(throttled.shape)})`);
ck(throttled.n === 4, `the retry/backoff loop still runs in full inside that one flight, not once per caller (${throttled.n} attempts for 3 callers)`);

// 5. opted-out shapes stay per-caller. `stale` lets a caller have its request
// dropped when its popup closed; sharing would drop it for someone else too.
const staleOut = await page.evaluate(async u => {
  const before = window.__net.length;
  await Promise.all([
    window.__apolloEditor.wsJson(u, { label: 'linked recording detail', stale: () => false }),
    window.__apolloEditor.wsJson(u, { label: 'linked recording detail', stale: () => false }),
  ]);
  return window.__net.length - before;
}, A + '&s=1');
ck(staleOut === 2, `a caller passing stale() is never coalesced with another (got ${staleOut})`);

// 6. the shape of the win, on his numbers: the log's 115 calls over 48 urls
const replay = await page.evaluate(async () => {
  const urls = [];
  // 48 distinct, requested 115 times, the worst one ten times — the same skew
  for (let i = 0; i < 48; i++) urls.push('https://musicbrainz.org/ws/2/x?u=' + i);
  const plan = [];
  for (let i = 0; i < 48; i++) plan.push(urls[i]);
  for (let i = 0; i < 67; i++) plan.push(urls[i % 12]);   // the repeats cluster on a few names
  const before = window.__net.length;
  await Promise.all(plan.map(u => window.__apolloEditor.wsJson(u, {})));
  return { asked: plan.length, sent: window.__net.length - before };
});
log('replay of the log profile:', JSON.stringify(replay));
ck(replay.asked === 115, 'replayed the same call count as the log');
ck(replay.sent === 48, `115 concurrent asks collapse to the 48 distinct URLs (got ${replay.sent})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
