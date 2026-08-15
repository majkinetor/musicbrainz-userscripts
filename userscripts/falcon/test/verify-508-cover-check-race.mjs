// #508 follow-up (majkinetor, live): "Cover option got ignored when queue is
// started prior cover check finishing" — checkExistingCoverArt() fires
// fire-and-forget when an item is queued; if a worker reaches it before that
// async MB fetch resolves, item.coverExistingCount is still null/falsy, so
// runCoverItem's skip check silently evaluates to false and uploads a
// duplicate anyway. Now the item is stamped with the in-flight promise
// (_coverCheckPromise) and runCoverItem awaits it before deciding, but only
// when the option is actually on.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

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
// slow down the MB cover-art-archive check so the worker would normally
// reach the item well before it resolves — reproduces the race directly.
await page.route('**/ws/2/release/**', async route => {
  await new Promise(r => setTimeout(r, 600));
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'cover-art-archive': { count: 2 } }) });
});
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

const result = await page.evaluate(async () => {
  const t = window.__falconTest;
  t.cfg.coverOnlyIfNone = true;
  // simulate what addToQueue does: create the item and immediately stamp it
  // with the in-flight check promise, same as the real call sites.
  const item = { mbid: 'aaaaaaaa-5140-0000-0000-000000000001', note: '', coverExistingCount: null, cover: [{ url: 'https://musicbrainz.org/should-not-be-fetched.jpg', comment: '', type: 'Front', candidates: [] }] };
  item._coverCheckPromise = window.__falconTest.mbThrottle.fetchJson(`https://musicbrainz.org/ws/2/release/${item.mbid}?fmt=json`, undefined, true).then(j => {
    item.coverExistingCount = (j && j['cover-art-archive'] && j['cover-art-archive'].count) || 0;
  });
  // a worker reaching this item IMMEDIATELY — before the 600ms fetch above resolves
  await t.runCoverItem(item, '[test]', { querySelector: () => null, dataset: {} });
  return { status: item.status, error: item.error, coverExistingCount: item.coverExistingCount };
});
console.log('race result:', JSON.stringify(result));
ck(result.coverExistingCount === 2, `the cover check DID resolve before runCoverItem decided (got ${result.coverExistingCount})`);
ck(result.status === 'skipped', `the item is correctly skipped once the check resolves, even though the worker reached it first (got "${result.status}")`);
ck(result.error === '', 'no error — this is an intentional skip');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
