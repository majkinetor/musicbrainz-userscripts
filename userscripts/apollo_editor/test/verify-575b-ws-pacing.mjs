// #575 round 2 (majkinetor): "A bit faster now, but still very slow (almost 15
// minutes here… and still ongoing)".
//
// The coalescing from round 1 worked — his second log shows 290 asks collapsing
// to 70 actual requests, and throttle events down from 25 to 2. What it exposed
// is that the pacing was the wrong shape. Requests were CHAINED: each waited for
// the previous one to come back and then waited out the gap, so our request rate
// was a function of MusicBrainz's latency rather than of us. 70 requests took
// 843 seconds — 0.08/s, more than ten times UNDER the limit being paced for —
// because a single alias search on that data takes ~12s and stalled everything
// behind it.
//
// Pacing now applies to STARTS: one start per WS_MIN_GAP, at most
// WS_MAX_INFLIGHT outstanding. This checks both halves of that — that the rate
// really is bounded (or we would earn 503s) and that a slow response no longer
// blocks the queue (which was the whole complaint).
//
// Run: node test/verify-575b-ws-pacing.mjs
//      APOLLO_SRC=<path> node test/verify-575b-ws-pacing.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js');
const log = (...a) => console.log('[verify-575b]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const code = await readFile(SCRIPT, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 10000 });
if (!await page.evaluate(() => typeof (window.__apolloEditor || {}).wsJson === 'function')) {
  ck(false, 'wsJson is exported for testing — this build does not export it');
  console.log('\n1 FAIL'); await browser.close(); process.exit(1);
}

// A fetch stub that records start and finish times, so pacing and concurrency are
// measured rather than inferred. LATENCY is the point of the exercise: every
// response is deliberately slower than the gap, which is the situation his log
// showed and the one the old chain handled worst.
const install = (latency) => page.evaluate(l => {
  window.__calls = [];
  window.__peak = 0; window.__live = 0;
  window.fetch = (url) => {
    const rec = { url: String(url), start: performance.now(), end: 0 };
    window.__calls.push(rec);
    window.__live++; window.__peak = Math.max(window.__peak, window.__live);
    return new Promise(res => setTimeout(() => {
      rec.end = performance.now(); window.__live--;
      res({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ artists: [] }) });
    }, l));
  };
}, latency);

const LATENCY = 3000;   // a slow MusicBrainz search, scaled down from his ~12s
const N = 8;
await install(LATENCY);

const run = await page.evaluate(async n => {
  const t0 = performance.now();
  // distinct urls, or the round-1 coalescing would merge them and there would be
  // nothing to pace
  await Promise.all(Array.from({ length: n }, (_, i) =>
    window.__apolloEditor.wsJson('https://musicbrainz.org/ws/2/artist?q=' + i, {})));
  const calls = window.__calls.map(c => ({ start: Math.round(c.start - t0), end: Math.round(c.end - t0) }));
  return { total: Math.round(performance.now() - t0), calls, peak: window.__peak };
}, N);

const starts = run.calls.map(c => c.start).sort((a, b) => a - b);
const gaps = starts.slice(1).map((s, i) => s - starts[i]);
log('total:', run.total + 'ms', 'peak concurrency:', run.peak);
log('start offsets:', JSON.stringify(starts));
log('gaps between starts:', JSON.stringify(gaps));

ck(run.calls.length === N, `all ${N} requests were made (got ${run.calls.length})`);

// 1. the fix: a slow response must not hold up the ones behind it. Chained, this
// is N * (latency + gap); paced by starts it is about N * gap + one latency.
const chained = N * (LATENCY + 1000);
ck(run.total < chained / 2, `a slow server no longer serialises the whole run: ${run.total}ms vs ~${chained}ms if each waited for the last (${(chained / run.total).toFixed(1)}x)`);
ck(run.peak > 1, `requests really do overlap (peak concurrency ${run.peak})`);

// 2. …but the rate stays inside MusicBrainz's ~1/s. Starts, not completions, are
// what the server sees, so that is what is measured.
const tooTight = gaps.filter(g => g < 900).length;   // 1000ms nominal, 100ms slack for timer jitter
ck(tooTight === 0, `every start is at least ~1s after the previous one (${tooTight} too tight: ${JSON.stringify(gaps.filter(g => g < 900))})`);
const window1s = Math.max(...starts.map(s => starts.filter(x => x >= s && x < s + 1000).length));
ck(window1s <= 2, `never more than a couple of starts inside any one-second window (worst ${window1s})`);

// 3. the burst ceiling holds
ck(run.peak <= 4, `at most 4 requests are outstanding at once (peak ${run.peak})`);

// 4. a stale request costs neither a slot nor a call — #555's guarantee, which
// the rewrite had to preserve
const staleCheck = await page.evaluate(async () => {
  const before = window.__calls.length;
  const r = await window.__apolloEditor.wsJson('https://musicbrainz.org/ws/2/artist?q=stale', { stale: () => true });
  return { made: window.__calls.length - before, r };
});
log('stale request:', JSON.stringify(staleCheck));
ck(staleCheck.made === 0, `a request that went stale is never sent (made ${staleCheck.made})`);
ck(staleCheck.r && staleCheck.r.stale === true, `and the caller is told it was dropped (got ${JSON.stringify(staleCheck.r)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
