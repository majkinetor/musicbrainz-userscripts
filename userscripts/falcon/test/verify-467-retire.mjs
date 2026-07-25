// #467 (majkinetor) — "leave open those that have issues and create new ones to
// continue worker duties": a worker whose item never reached a real submit (the
// dirty/beforeunload-risk case) must be RETIRED in place — frozen, visibly showing
// its last state — rather than silently discarded, with a fresh replacement card
// taking over the remaining queue. A worker whose item DID submit (even partially)
// keeps its same iframe/card for the next item, so a normal run still shows one
// worker flowing through several items instead of a new card every time.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. A genuinely-rejected item (never submitted) retires its card; the replacement
// picks up the next item and the retired card stays visible with its label intact.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let dialogs = 0; page.on('dialog', async d => { dialogs++; await d.dismiss(); });
  let posts = 0;
  await page.route('**/artist/*/edit*', async (route, request) => {
    if (request.method() === 'POST') { posts++; const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${mbid}` } }); }
    return route.continue();
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.click('#falcon-tab-workers');
  await page.evaluate(() => {
    window.__falconTest.setQueue([
      // 1 worker, 2 items: item 1 is a REAL existing relationship (genuinely rejected,
      // never submitted -> should retire its card); item 2 is fresh (should complete
      // on a NEW, replacement card).
      { id: 'rej', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://derzirkel.bandcamp.com/', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
      { id: 'ok', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/retiretest1', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 1;
  });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const finalQueue = await page.evaluate(() => window.__falconTest.getQueue());
  const cardInfo = await page.evaluate(() => [...document.querySelectorAll('.falcon-worker-card')].map(c => ({ retired: c.dataset.retired === '1', label: c.querySelector('.falcon-worker-lbl')?.textContent, opacity: getComputedStyle(c).opacity })));
  console.log('final queue:', JSON.stringify(finalQueue.map(i => ({ id: i.id, status: i.status })), null, 1));
  console.log('cards:', JSON.stringify(cardInfo, null, 1));
  ck(finalQueue[0]?.status === 'failed' && finalQueue[1]?.status === 'done', `item 1 fails cleanly, item 2 completes (statuses: ${finalQueue.map(i => i.status).join(', ')})`);
  ck(cardInfo.length === 2, `2 worker cards exist — the retired one AND its replacement, not just 1 reused (got ${cardInfo.length})`);
  ck(cardInfo.some(c => c.retired), `at least one card is marked retired (${JSON.stringify(cardInfo.map(c => c.retired))})`);
  const retired = cardInfo.find(c => c.retired);
  ck(retired && /stopped/.test(retired.label || ''), `the retired card's label says so, and is preserved (not blanked back to "idle") ("${retired?.label}")`);
  ck(retired && parseFloat(retired.opacity) < 1, `the retired card is visually dimmed (opacity=${retired?.opacity})`);
  const notRetired = cardInfo.find(c => !c.retired);
  ck(notRetired && notRetired.label === 'idle', `the replacement card finished normally and went idle ("${notRetired?.label}")`);
  ck(dialogs === 0, `no beforeunload dialog during the whole run (${dialogs})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 2. A worker whose items all commit cleanly keeps its SAME card/iframe across
// several items — no card explosion for a normal successful run.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/artist/*/edit*', async (route, request) => {
    if (request.method() === 'POST') { const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${mbid}` } }); }
    return route.continue();
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.click('#falcon-tab-workers');
  await page.evaluate(() => {
    window.__falconTest.setQueue([
      { id: 'c1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/cleanrun1', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
      { id: 'c2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/cleanrun2', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 1;   // same single worker handles BOTH items
  });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status === 'done'), null, { timeout: 20000 }).catch(() => {});
  const cardCount = await page.evaluate(() => document.querySelectorAll('.falcon-worker-card').length);
  console.log('cards after a clean 2-item/1-worker run:', cardCount);
  ck(cardCount === 1, `both items complete on the SAME single card — no unnecessary replacement (got ${cardCount})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
