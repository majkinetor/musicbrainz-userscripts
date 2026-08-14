// #509 follow-up (majkinetor, live): "It seems that when name is null, it
// blocks from fetching it" — a real Harmony batch left several items
// permanently nameless. Root cause: suspendNameLookups()'s cancelPending()
// resolves every not-yet-started cosmetic name lookup with null so it
// doesn't compete with the workers' rate-limit budget — correct while a run
// is active, but nothing ever gave a cancelled item a second try once the
// budget was free again, so it stayed null forever. resolveMissingNames()
// now sweeps still-nameless queued items whenever the suspension actually
// lifts (start()'s natural-completion path, and stop()).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const MBID = 'aaaaaaaa-5090-0000-0000-000000000001';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
// intercept the name-lookup so it's slow enough to still be queued (not yet
// started) when suspendNameLookups() cancels it — reproduces the real race.
await page.route('**/ws/2/recording/**', async route => {
  await new Promise(r => setTimeout(r, 800));
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Real Recording Name' }) });
});
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

const result = await page.evaluate(async (MBID) => {
  const t = window.__falconTest;
  // a nameless tuple (as if Harmony's own name pill hadn't rendered yet) —
  // addToQueue's fallback fires fetchEntityName, which our route delays.
  t.addToQueue([{ entityType: 'recording', mbid: MBID, url: 'https://example.com/a' }]);
  const nameRightAfterQueue = t.getQueue()[0].name;
  // simulate a run starting immediately — before the 800ms lookup resolves —
  // and immediately stopping (same suspend/cancel/resume path a real short
  // run takes).
  t.suspendNameLookups();
  await new Promise(r => setTimeout(r, 50));
  const nameWhileSuspended = t.getQueue()[0].name;
  t.resumeNameLookups();
  // without a retry sweep this would stay null forever — call the fix.
  t.resolveMissingNames();
  await new Promise(r => setTimeout(r, 1200));
  return { nameRightAfterQueue, nameWhileSuspended, nameAfterRetry: t.getQueue()[0].name };
}, MBID);
console.log(JSON.stringify(result));
ck(result.nameRightAfterQueue === null, 'name starts null (no Harmony-scraped name given)');
ck(result.nameWhileSuspended === null, 'still null while the lookup was cancelled mid-flight');
ck(result.nameAfterRetry === 'Real Recording Name', `resolveMissingNames() gives the cancelled lookup a second try and it resolves (got "${result.nameAfterRetry}")`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
