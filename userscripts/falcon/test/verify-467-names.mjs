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

// 1b. Rate-limit safety (majkinetor): a burst of lookups for DIFFERENT entities must
// be spaced out, not fired concurrently — MB's /ws/2/ webservice enforces a real
// per-IP rate limit, and a big batch (recordings are back, up to ~80 at once, #467)
// must never hammer it. Firing 4 fresh (uncached) lookups at once should take
// noticeably longer than one lookup alone, proving they're serialized with a gap.
const timing = await page.evaluate(async () => {
  const { fetchEntityName } = window.__falconTest;
  const mbids = [
    '5441c29d-3602-4898-b1a1-b77fa23b8e50', 'b31113ab-205d-461b-b431-5d5c52635117',
    '04201e6d-c430-4a53-a9a0-56170825fbde', '20b03c7d-9e8a-42b9-8a96-bcc9564de034',
  ];
  const t0 = performance.now();
  await Promise.all(mbids.map(m => fetchEntityName('artist', m)));
  return performance.now() - t0;
});
console.log('4 concurrent fresh lookups took (ms):', timing);
ck(timing > 3000, `4 fresh lookups fired at once are still spaced ~1.1s apart, not concurrent (took ${Math.round(timing)}ms, expect >3000ms for 3 gaps)`);

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
await page.click('#falcon-paste-toggle');   // paste box starts collapsed to a + button (#467 review UX)
await page.fill('#falcon-paste', 'd31f76d2-1d8e-4271-8027-148f375979d7,https://myspace.com/nametest');
await page.click('#falcon-add');
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
