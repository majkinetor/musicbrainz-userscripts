// #575 round 3. majkinetor's 2026-09-08 log on the pooled build: 90 of 121
// responses were HTTP 503 — throttled from the very first request, 57 warnings,
// four give-ups.
//
// The reason retries dominated is that backoff was PRIVATE. Each request slept
// out its own penalty while the other lanes kept firing into the same tripped
// limiter, so the bucket never got a chance to refill and every lane's backoff
// grew together. Concurrency made it worse, not better.
//
// A throttle is now a shared signal: one 503 holds every lane behind one
// deadline, and concurrency drops to a single probing request until something
// comes back clean. What this checks is exactly that — after the first 503, no
// two requests are ever in flight at once, and nothing is fired during the hold.
//
// Pure stub, no network.
//
// Run: node test/verify-575c-shared-throttle.mjs
//      APOLLO_SRC=<path> node test/verify-575c-shared-throttle.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const code = await readFile(SCRIPT, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 10000 });

const out = await page.evaluate(async () => {
  const t0 = performance.now();
  const events = [];        // {t, kind, i}
  let live = 0, throttleSeenAt = null, n = 0;
  // The server is unwell for a WINDOW, not for a count. A stub that heals after
  // four responses never has a sustained throttled phase to measure — the lanes
  // reopen the moment the first 200 lands, which is correct behaviour and makes
  // the fixture untestable. MusicBrainz stays unhappy for a while; so does this.
  const SICK_UNTIL = 12000;
  window.fetch = (url) => {
    const i = n++;
    const throttled = (performance.now() - t0) < SICK_UNTIL;
    live++;
    events.push({ t: performance.now() - t0, kind: 'start', i, throttled, live });
    return new Promise(res => setTimeout(() => {
      live--;
      if (throttled && throttleSeenAt === null) throttleSeenAt = performance.now() - t0;
      events.push({ t: performance.now() - t0, kind: 'end', i, throttled });
      res({
        ok: !throttled, status: throttled ? 503 : 200,
        headers: { get: () => null },
        json: async () => ({ artists: [] }),
      });
    // Latency deliberately longer than the pacer's gap, so several requests are
    // genuinely in flight together — his alias searches take seconds, and that
    // overlap is the whole point. With a fast stub nothing ever overlaps and the
    // fixture proves nothing (it passed on the broken build until this was
    // raised).
    }, 2500));
  };
  const ws = window.__apolloEditor.wsJson;
  // Six distinct URLs so nothing is coalesced away — this is about pacing, not
  // about the round-1 de-duplication.
  await Promise.all([0, 1, 2, 3, 4, 5].map(k => ws('https://musicbrainz.org/ws/2/artist?query=q' + k, { label: 'probe' })));
  return { events, throttleSeenAt, sickUntil: SICK_UNTIL, total: n, elapsed: performance.now() - t0 };
});

// Requests already in flight when the first 503 lands cannot be recalled, so the
// steady state is what is being asserted: everything started at least a second
// after MusicBrainz pushed back. Measuring from the instant of the 503 would
// assert something physically impossible and pass on any build.
const SETTLE = 1200;
const steady = out.events.filter(e => e.kind === 'start' && e.t > out.throttleSeenAt + SETTLE && e.t < out.sickUntil);
const peakSteady = steady.reduce((m, e) => Math.max(m, e.live), 0);
const gaps = [];
for (let i = 1; i < steady.length; i++) gaps.push(steady[i].t - steady[i - 1].t);
const tooFast = gaps.filter(g => g < 900).length;
console.log(`[verify-575c] ${out.total} requests in ${(out.elapsed / 1000).toFixed(1)}s · ` +
  `${steady.length} started once throttling had settled · peak concurrency there: ${peakSteady}`);

ck(out.throttleSeenAt !== null, 'the stub really did throttle (sanity check on the fixture)');
ck(steady.length >= 2, `the fixture reaches a steady throttled state to measure (${steady.length} requests started in it)`);
ck(peakSteady <= 1,
  `once MusicBrainz is saying 503, requests stop overlapping — one probe at a time (peak was ${peakSteady})`);
ck(tooFast === 0, `and none is fired inside the shared hold (${tooFast} of ${gaps.length} gaps under 900ms)`);
ck(out.total <= 16, `retries stay bounded — ${out.total} requests for 6 calls across a 12s outage`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));

await browser.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
