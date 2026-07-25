// #467 (majkinetor: "the UI was unresponsive... full session", after a run where
// EVERY item committed successfully) — a real multi-item session went fully
// unresponsive over time even with zero failures, pointing at leftover background
// activity (MB's own client JS: polling/retry timers) from each earlier document
// not being fully torn down by a plain `.src` reassignment on a REUSED iframe,
// compounding across a long session. The fix: workerLoop now creates a genuinely
// FRESH iframe element for every item (removing the old one outright), even when
// the previous item committed cleanly — no more reusing the same iframe/
// reassigning its .src, so nothing compounds across a run. A single RETIRED
// card's one remaining iframe is bounded (that card processes nothing further)
// so it's kept alive rather than discarded — majkinetor: "I want to have worker
// visible there, in its active state" (verify-467-item-popup.mjs covers reusing
// that live iframe from the queue tab's failed-item popup).
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
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. A clean multi-item run on ONE worker card: each item gets a DIFFERENT
// (fresh) iframe DOM element — never the literal same node reused/renavigated.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/artist/*/edit', async (route, request) => {
    if (request.method() === 'POST') { const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${mbid}` } }); }
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

  const iframeIds = [];
  await page.exposeFunction('__reportIframe', id => iframeIds.push(id));
  await page.evaluate(() => {
    window.__falconTest.setQueue([
      { id: 'a', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/lifecycle1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
      { id: 'b', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/lifecycle2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 1;
    // tag every iframe the instant it's created with a unique id, and report it,
    // so we can tell whether the SAME element got reused across items.
    const strip = document.getElementById('falcon-workers');
    new MutationObserver(muts => {
      for (const m of muts) for (const node of m.addedNodes) {
        if (node.tagName === 'IFRAME') { node.dataset.probeId = 'if' + Math.random().toString(36).slice(2, 8); window.__reportIframe(node.dataset.probeId); }
      }
    }).observe(strip, { childList: true, subtree: true });
  });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status === 'done'), null, { timeout: 20000 });
  await page.waitForTimeout(300);
  console.log('iframe ids created over the run:', JSON.stringify(iframeIds));
  ck(iframeIds.length === 2, `TWO distinct iframe elements were created — one per item, none reused (got ${iframeIds.length})`);
  ck(new Set(iframeIds).size === iframeIds.length, 'all created iframe ids are unique (no accidental duplicate reporting)');
  const cardCount = await page.evaluate(() => document.querySelectorAll('.falcon-worker-card').length);
  ck(cardCount === 1, `both items still ran on the SAME card (visual continuity preserved) despite fresh iframes underneath (got ${cardCount} card(s))`);
  const finalIframeCount = await page.evaluate(() => document.querySelectorAll('.falcon-worker-card iframe').length);
  ck(finalIframeCount === 1, `only the LAST item's iframe remains in the DOM — earlier ones were actually removed, not just hidden (got ${finalIframeCount})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 2. A retired card KEEPS its iframe alive (majkinetor: "I want to have worker
// visible there, in its active state") — bounded to just this one card since it
// processes nothing further, so it's not the compounding risk fix #1 addresses.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/artist/*/edit', async (route, request) => {
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
      // a genuinely-rejected item (existing relationship) — never submits, retires its card.
      { id: 'rej', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://derzirkel.bandcamp.com/', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 1;
  });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status === 'failed', null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const retiredCardState = await page.evaluate(() => {
    const card = document.querySelector('.falcon-worker-card[data-retired="1"]');
    return {
      cardExists: !!card,
      hasIframe: !!card?.querySelector('iframe'),
      label: card?.querySelector('.falcon-worker-lbl')?.textContent,
      opacity: card ? getComputedStyle(card).opacity : null,
    };
  });
  console.log('retired card state:', JSON.stringify(retiredCardState));
  ck(retiredCardState.cardExists, 'the retired card exists and stays visible');
  ck(retiredCardState.hasIframe, 'the retired card KEEPS its live iframe — inspectable in its exact failure state');
  ck(/stopped/.test(retiredCardState.label || ''), `the label still marks it as stopped/retired ("${retiredCardState.label}")`);
  ck(parseFloat(retiredCardState.opacity) < 1, `the card is still visually dimmed to signal it's retired (opacity=${retiredCardState.opacity})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
