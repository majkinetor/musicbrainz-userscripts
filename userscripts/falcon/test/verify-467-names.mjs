// #467 (majkinetor) — show entity names instead of truncated mbids in the queue
// list / worker labels. fetchEntityName() is a same-origin fetch to MB's own
// public API (no GM_xmlhttpRequest needed since Falcon's panel only ever renders
// on musicbrainz.org itself); entityLabel() falls back to entityType/mbid-prefix
// while the name is still resolving or if the lookup fails.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. fetchEntityName resolves real names for artist/label/recording.
const names = await page.evaluate(async () => {
  const { fetchEntityName } = window.__falconTest;
  return {
    artist: await fetchEntityName('artist', 'd31f76d2-1d8e-4271-8027-148f375979d7'),      // Der Zirkel
    recording: await fetchEntityName('recording', 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7'),  // "Dusk"
    bogus: await fetchEntityName('artist', '00000000-0000-0000-0000-000000000000'),         // doesn't exist
  };
});
console.log('resolved names:', JSON.stringify(names));
ck(names.artist === 'Der Zirkel', `resolves a real artist name (got "${names.artist}")`);
ck(!!names.recording, `resolves a real recording title (got "${names.recording}")`);
ck(names.bogus === null, `a non-existent mbid resolves to null, not a crash (got ${JSON.stringify(names.bogus)})`);

// 1b. Concurrency (majkinetor, #467: "fetch them in paralel with rate limit
// protection as usual"): lookups for different entities must run IN PARALLEL (up
// to mbThrottle's concurrency cap), not one after another with an artificial gap
// — a strict serial 1.1s-apart approach was tried first and was too slow for a
// big batch. Mocks fetch with a fixed artificial delay so this is deterministic
// (a live-network timing assertion here was flaky — real request latency varies
// run to run) — 4 requests through a 4-wide throttle should all finish around
// ONE delay period, not four sequential ones.
const timing = await page.evaluate(async () => {
  const DELAY = 400;
  const origFetch = window.fetch;
  window.fetch = async () => { await new Promise(r => setTimeout(r, DELAY)); return new Response(JSON.stringify({ name: 'x' }), { status: 200 }); };
  const t0 = performance.now();
  await Promise.all([1, 2, 3, 4].map(n => window.__falconTest.mbThrottle.fetchJson(`https://musicbrainz.org/ws/2/artist/mock-${n}?fmt=json`)));
  const elapsed = performance.now() - t0;
  window.fetch = origFetch;
  return elapsed;
});
console.log('4 mocked concurrent lookups (400ms each) took (ms):', timing);
ck(timing < 800, `4 requests through the throttle run concurrently — ~1 delay period, not 4 sequential ones (took ${Math.round(timing)}ms with a 400ms mock delay, expect well under 1600ms)`);

// 1c. Retry-After backoff (mirrors Credit Hoarder's api-mb.js throttle): a
// 429/503 with a Retry-After header must be honored — retried after that delay
// — not treated as an immediate hard failure.
const backoff = await page.evaluate(async () => {
  let hits = 0;
  const origFetch = window.fetch;
  const TARGET = '/ws/2/artist/00000000-0000-0000-0000-0000000000aa';
  window.fetch = async (url, opts) => {
    if (String(url).includes(TARGET)) {
      hits++;
      if (hits === 1) return new Response('', { status: 503, headers: { 'Retry-After': '1' } });
      return new Response(JSON.stringify({ name: 'Retried OK' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return origFetch(url, opts);
  };
  const t0 = performance.now();
  const result = await window.__falconTest.mbThrottle.fetchJson(`https://musicbrainz.org${TARGET}?fmt=json`, 2);
  const elapsed = performance.now() - t0;
  window.fetch = origFetch;
  return { hits, elapsed, result };
});
console.log('retry-after backoff:', JSON.stringify(backoff));
ck(backoff.hits === 2, `a 503 with Retry-After is retried, not given up on immediately (got ${backoff.hits} attempt(s))`);
ck(backoff.elapsed >= 900, `the retry actually waits out the Retry-After duration before trying again (${Math.round(backoff.elapsed)}ms, expect >=~1000ms)`);
ck(backoff.result?.name === 'Retried OK', `the retried attempt's result is returned once it succeeds (got ${JSON.stringify(backoff.result)})`);

// 2. entityLabel() falls back to entityType/mbid-prefix when no name is set yet.
const fallback = await page.evaluate(() => window.__falconTest.entityLabel({ entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', name: null }));
ck(fallback === 'artist/d31f76d2', `falls back to entityType/mbid-prefix before the name resolves (got "${fallback}")`);
const withName = await page.evaluate(() => window.__falconTest.entityLabel({ entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', name: 'Der Zirkel' }));
ck(withName === 'Der Zirkel', `uses the real name once resolved (got "${withName}")`);

// 3. Live in the panel: adding an item shows the mbid-prefix first, then the real
// name once the async lookup resolves.
await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
// the (+) paste box is gone — a queue arrives as JSON now (or via ?falcon= /
// Harmony), so add the row the same way an import does.
await page.evaluate(() => window.__falconTest.importQueueJson(JSON.stringify({
  items: [{ entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/nametest' }] }],
}), 'names-test'));
const resolved = await page.waitForFunction(() => {
  const row = document.querySelector('#falcon-queue-list a');
  return row && row.textContent === 'Der Zirkel' ? row.textContent : null;
}, null, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => null);
console.log('queue row text after resolution:', resolved);
ck(resolved === 'Der Zirkel', `the queue row shows the real artist name once resolved (got "${resolved}")`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
