// #467 (majkinetor: "Workers are still empty boxes") — MB's own pages aren't
// responsive down to a worker card's small width (260px). Confirmed live: the
// DOM had real, visible (display:block, visibility:visible) content, but it was
// laid out for a much wider viewport and simply never became visible inside the
// tiny card — appeared as a blank white box. Fix: render each worker iframe at
// MB's normal desktop width (980px) and CSS-scale the whole thing down to fill
// the card, so MB always lays out the page correctly and the card just shows a
// shrunk, legible thumbnail.
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

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
async function fakeSubmit(route, request, type) {
  if (request.method() === 'POST') {
    const m = request.url().match(new RegExp(`/${type}/([0-9a-f-]{36})/edit`));
    return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/${type}/${m[1]}` } });
  }
  return route.continue();
}
await page.route('**/artist/*/edit', (route, request) => fakeSubmit(route, request, 'artist'));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.click('#falcon-tab-workers');
await page.evaluate(() => {
  window.__falconTest.setQueue([
    { id: 'w1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/scaletest', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  ]);
  window.__falconTest.cfg.workers = 1;
});
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => document.querySelector('.falcon-worker-card iframe'), null, { timeout: 10000 });
await page.waitForTimeout(2000);

// 1. The iframe renders at MB's natural desktop width and is scaled down visually
// to exactly fill its small card — not stretched to the card's own narrow width.
const sizing = await page.evaluate(() => {
  const card = document.querySelector('.falcon-worker-card');
  const iframe = card.querySelector('iframe');
  const cardRect = card.getBoundingClientRect();
  const iframeRect = iframe.getBoundingClientRect();
  return {
    iframeCssWidth: iframe.style.width,
    transform: iframe.style.transform,
    renderedWidth: Math.round(iframeRect.width), renderedHeight: Math.round(iframeRect.height),
    cardWidth: Math.round(cardRect.width),
  };
});
console.log('iframe sizing:', JSON.stringify(sizing));
ck(parseInt(sizing.iframeCssWidth) >= 900, `the iframe's OWN width is set to MB's natural desktop size, not the tiny card width (got "${sizing.iframeCssWidth}")`);
ck(/scale\(/.test(sizing.transform), `a CSS scale transform shrinks it back down (got "${sizing.transform}")`);
ck(Math.abs(sizing.renderedWidth - sizing.cardWidth) <= 2, `after scaling, the iframe's RENDERED (visual) size still matches the card (rendered=${sizing.renderedWidth}, card=${sizing.cardWidth})`);

// 2. The actual rendered pixels show real, non-blank MB page content — the bug
// this fixes: previously the DOM had content but it rendered entirely off-screen.
const visualCheck = await page.evaluate(() => {
  const iframe = document.querySelector('.falcon-worker-card iframe');
  const doc = iframe.contentDocument;
  // sample what's actually at the visual center of the SCALED-DOWN card, in the
  // iframe's OWN (unscaled) coordinate space — i.e. divide by the same scale
  // CSS applied, matching how the browser paints it.
  const scale = parseFloat((iframe.style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || '1');
  const cardRect = iframe.getBoundingClientRect();
  const cx = (cardRect.width / 2) / scale, cy = (cardRect.height / 2) / scale;
  const el = doc.elementFromPoint(cx, cy);
  return { hasElementAtCenter: !!el, elTag: el?.tagName, nearbyText: (el?.closest('body')?.innerText || '').slice(0, 60) };
});
console.log('visual check at card center:', JSON.stringify(visualCheck));
ck(visualCheck.hasElementAtCenter, 'the scaled card actually has a real element at its visual center (not empty space)');
ck(visualCheck.nearbyText.trim().length > 0, `real page text is present near the visible area (got "${visualCheck.nearbyText.replace(/\n/g, ' ')}")`);

// 3. Zooming a worker card (bigger view) rescales the iframe to match the new size.
await page.click('.falcon-worker-zoom');
await page.waitForTimeout(300);
const zoomedSizing = await page.evaluate(() => {
  const card = document.querySelector('.falcon-worker-card');
  const iframe = card.querySelector('iframe');
  const cardRect = card.getBoundingClientRect();
  const iframeRect = iframe.getBoundingClientRect();
  return { renderedWidth: Math.round(iframeRect.width), cardWidth: Math.round(cardRect.width) };
});
console.log('zoomed sizing:', JSON.stringify(zoomedSizing));
ck(Math.abs(zoomedSizing.renderedWidth - zoomedSizing.cardWidth) <= 2, `zooming the card rescales the iframe to fill the new (larger) size too (rendered=${zoomedSizing.renderedWidth}, card=${zoomedSizing.cardWidth})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
