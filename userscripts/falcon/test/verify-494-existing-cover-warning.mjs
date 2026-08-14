// #494 follow-up (majkinetor): "Harmony always presents cover art even if it
// is already present on MB... adding cover is not idempotent. We could at
// minimum show if release has any covers as a warning." checkExistingCoverArt
// originally called the Cover Art Archive's own API directly, but that's a
// real cross-origin request and it started failing live with "Failed to
// fetch" on majkinetor's actual release (verified: MB's own WS2 response for
// that exact release succeeds fine and already reports
// cover-art-archive.count=1 same-origin) — so it now reads that field off
// MB's own /ws/2/release endpoint instead, no cross-origin call at all.
// renderRowDetail/renderQueue surface the result as a warning.
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
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. checkExistingCoverArt: cover-art-archive.count=0 -> 0, count=2 -> 2, no
//    response at all -> leaves it unknown (null) rather than falsely
//    asserting "none".
{
  const page = await ctx.newPage();
  await page.route('**/ws/2/release/aaaaaaaa-0000-0000-0000-000000000000?fmt=json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'cover-art-archive': { count: 0, front: false } }) }));
  await page.route('**/ws/2/release/bbbbbbbb-0000-0000-0000-000000000000?fmt=json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'cover-art-archive': { count: 2, front: true } }) }));
  // 500, not 503/429 — those two retry with backoff inside mbThrottle, which
  // would just slow this test down for no extra coverage.
  await page.route('**/ws/2/release/cccccccc-0000-0000-0000-000000000000?fmt=json', route => route.fulfill({ status: 500, body: 'error' }));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const results = await page.evaluate(async () => {
    const none = { mbid: 'aaaaaaaa-0000-0000-0000-000000000000', coverExistingCount: null };
    const some = { mbid: 'bbbbbbbb-0000-0000-0000-000000000000', coverExistingCount: null };
    const err = { mbid: 'cccccccc-0000-0000-0000-000000000000', coverExistingCount: null };
    await Promise.all([window.__falconTest.checkExistingCoverArt(none), window.__falconTest.checkExistingCoverArt(some), window.__falconTest.checkExistingCoverArt(err)]);
    return { none: none.coverExistingCount, some: some.coverExistingCount, err: err.coverExistingCount };
  });
  console.log('checkExistingCoverArt results:', JSON.stringify(results));
  ck(results.none === 0, `cover-art-archive.count=0 -> existingCount 0 (got ${results.none})`);
  ck(results.some === 2, `cover-art-archive.count=2 -> existingCount 2 (got ${results.some})`);
  ck(results.err === null, `a failed WS2 lookup leaves existingCount unknown rather than asserting "none" (got ${results.err})`);
  await page.close();
}

// 2. UI: the warning shows in the expanded row detail and as a title/⚠ on the
//    collapsed summary once existingCount is known and > 0; absent when 0.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'dup', entityType: 'release', mbid: 'bbbbbbbb-1111-0000-0000-000000000000', urls: [], note: '', disambiguation: '', isrcs: [], cover: [{ url: 'https://example.invalid/x.jpg', comment: '', type: 'Front', candidates: [{ provider: 'Deezer', url: 'https://example.invalid/x.jpg' }] }], coverExistingCount: 3, name: null, urlResults: null, status: 'queued', error: '' },
    { id: 'clean', entityType: 'release', mbid: 'cccccccc-1111-0000-0000-000000000000', urls: [], note: '', disambiguation: '', isrcs: [], cover: [{ url: 'https://example.invalid/y.jpg', comment: '', type: 'Front', candidates: [{ provider: 'Deezer', url: 'https://example.invalid/y.jpg' }] }], coverExistingCount: 0, name: null, urlResults: null, status: 'queued', error: '' },
  ]));
  await page.click('.falcon-row-expand[data-id="dup"]');
  await page.click('.falcon-row-expand[data-id="clean"]');
  const info = await page.evaluate(() => ({
    dupWarningText: document.querySelector('.falcon-row[data-id="dup"]')?.innerText || '',
    dupSummaryTitle: [...document.querySelectorAll('.falcon-row[data-id="dup"] > div > span[title]')].map(s => s.getAttribute('title')).find(t => /already has/.test(t || '')) || '',
    cleanWarningPresent: (document.querySelector('.falcon-row[data-id="clean"]')?.innerText || '').includes('already has'),
  }));
  console.log('ui check:', JSON.stringify(info));
  ck(info.dupWarningText.includes('already has 3 cover images'), `expanded row shows the "already has N cover images" warning (got: ${JSON.stringify(info.dupWarningText.slice(0, 300))})`);
  ck(/already has 3 cover images/.test(info.dupSummaryTitle), `collapsed row's title attribute also carries the warning for hover discovery (got "${info.dupSummaryTitle}")`);
  ck(!info.cleanWarningPresent, 'a release confirmed to have zero existing covers shows no warning at all');

  // majkinetor: "that requires row to be in view. Lets put the warning
  // bellow the progress bar so its visible all the time" — collapse BOTH
  // rows so neither's own warning is visible, and confirm the standing
  // banner still reports the duplicate regardless.
  const banner = await page.evaluate(() => {
    document.querySelectorAll('.falcon-row-expand').forEach(b => b.click());   // collapse both
    const el = document.getElementById('falcon-cover-warning');
    return { display: getComputedStyle(el).display, text: el.textContent };
  });
  console.log('persistent cover-warning banner:', JSON.stringify(banner));
  ck(banner.display === 'block', `the banner stays visible even with every row collapsed (got display="${banner.display}")`);
  ck(banner.text.includes('1 release already has cover art') && banner.text.includes('(3)'), `banner names the affected release with its count (got "${banner.text}")`);
  ck(!banner.text.includes('cccccccc'.slice(0, 8)), 'the clean (existingCount 0) release is not listed in the banner');

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 3. addToQueue triggers the check automatically for a fresh release-with-cover item.
{
  const page = await ctx.newPage();
  let hit = false;
  await page.route('**/ws/2/release/dddddddd-2222-0000-0000-000000000000?fmt=json', route => { hit = true; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'cover-art-archive': { count: 0, front: false } }) }); });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.evaluate(() => window.__falconTest.addToQueue([
    { entityType: 'release', mbid: 'dddddddd-2222-0000-0000-000000000000', coverCandidates: [{ provider: 'Deezer', url: 'https://example.invalid/z.jpg' }] },
  ]));
  await page.waitForTimeout(500);
  console.log('WS2 release lookup hit during addToQueue:', hit);
  ck(hit, 'queuing a release with cover candidates automatically checks MB\'s own cover-art-archive field');
  await page.close();
}

// 4. majkinetor, live: "It shows but only after 20 or so seconds... It
//    should be prioritized" — on a big batch, checkExistingCoverArt's fetch
//    was sitting behind every other item's cosmetic name lookup in
//    mbThrottle's shared FIFO queue. Its priority=true call now jumps to the
//    FRONT of the still-WAITING queue (can't preempt the MAX_CONCURRENT=4
//    already in flight, but skips everything else waiting behind them).
{
  const page = await ctx.newPage();
  await page.route('**/ws/2/artist/**', async route => { await new Promise(r => setTimeout(r, 3000)); route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"slow"}' }); });
  await page.route('**/ws/2/release/eeeeeeee-3333-0000-0000-000000000000?fmt=json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'cover-art-archive': { count: 1 } }) }));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const order = await page.evaluate(async () => {
    const seen = [];
    // fill every concurrent slot (4) plus a backlog behind them with slow,
    // low-priority "name lookup" style fetches, matching a big batch queued
    // ahead of the cover item.
    const slow = Array.from({ length: 8 }, (_, i) =>
      window.__falconTest.mbThrottle.fetchJson(`/ws/2/artist/slow-${i}?fmt=json`).then(() => seen.push(`slow-${i}`)));
    await new Promise(r => setTimeout(r, 50));   // let the first 4 actually start (become in-flight)
    const priorityDone = window.__falconTest.checkExistingCoverArt({ mbid: 'eeeeeeee-3333-0000-0000-000000000000', coverExistingCount: null }).then(() => seen.push('priority-cover'));
    await Promise.all([...slow, priorityDone]);
    return seen;
  });
  console.log('resolution order:', JSON.stringify(order));
  const priorityIdx = order.indexOf('priority-cover');
  ck(priorityIdx >= 0 && priorityIdx < 5, `the priority cover check resolves near the front, not after all 8 slow lookups (resolved at position ${priorityIdx} of ${order.length})`);
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
