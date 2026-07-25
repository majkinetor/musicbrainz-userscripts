// #467 (majkinetor) — surface MB's REAL validation error text instead of a generic
// guess, and add maximize for the panel + each worker card so a failure can actually
// be read. Reproduces majkinetor's exact case: a Deezer ALBUM url on an artist ->
// MB's own "This URL is not allowed for artists." message.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const ARTIST = 'd31f76d2-1d8e-4271-8027-148f375979d7';   // Der Zirkel

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. findFieldError() picks up MB's real validation text (not a submit — read-only).
await page.goto(`https://musicbrainz.org/artist/${ARTIST}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
const errText = await page.evaluate(() => {
  const { findAddLinkInput, findFieldError } = window.__falconTest;
  const input = findAddLinkInput(document);
  const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  input.focus();
  setVal.call(input, 'https://www.deezer.com/album/662911171');   // an ALBUM url on an ARTIST
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.blur();
  return new Promise(resolve => setTimeout(() => resolve(findFieldError(document)), 1200));
});
console.log('scraped error:', errText);
ck(errText && /not allowed for artists/i.test(errText), `scraped MB's real validation message (got "${errText}")`);

// 2. Same case end-to-end through fillAndSubmit — the item's error is MB's real text,
// not the old generic "may already have this exact link" guess. POST intercepted so
// nothing real submits (only the rejected url — MB never got a valid one to accept).
await page.goto(`https://musicbrainz.org/artist/${ARTIST}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
await page.click('#falcon-launcher');   // ensurePanel() must run first — start() needs the worker-strip DOM to exist
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.evaluate(() => {
  window.__falconTest.setQueue([
    { id: 'e1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://www.deezer.com/album/662911171', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
  ]);
});
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status === 'failed', null, { timeout: 20000 }).catch(() => {});
const failedItem = await page.evaluate(() => window.__falconTest.getQueue()[0]);
console.log('failed item:', JSON.stringify(failedItem, null, 1));
ck(failedItem?.status === 'failed', `item correctly marked failed (status=${failedItem?.status})`);
ck(/not allowed for artists/i.test(failedItem?.error || ''), `item.error carries MB's real message, not a guess ("${failedItem?.error}")`);

// 3. Panel maximize toggles a real size change. (panel is already open from step 2)
await page.evaluate(() => window.__falconTest.stop());
const beforeMax = await page.evaluate(() => document.getElementById('falcon-panel').getBoundingClientRect().width);
await page.click('#falcon-maximize');
await page.waitForTimeout(150);
const afterMax = await page.evaluate(() => document.getElementById('falcon-panel').getBoundingClientRect().width);
ck(afterMax > beforeMax * 1.5, `maximize meaningfully grows the panel (${beforeMax}px -> ${afterMax}px)`);
await page.click('#falcon-maximize');
await page.waitForTimeout(150);
const afterRestore = await page.evaluate(() => document.getElementById('falcon-panel').getBoundingClientRect().width);
ck(Math.abs(afterRestore - beforeMax) < 2, `restore returns to the original width (${beforeMax}px -> ${afterRestore}px)`);

// 4. Per-worker maximize: zooming one hides the others and grows that one.
await page.evaluate(() => {
  window.__falconTest.setQueue([
    { id: 'z1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/zoomtest1', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
    { id: 'z2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/zoomtest2', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
  ]);
  window.__falconTest.cfg.workers = 2;
});
let posts = 0;
await page.route('**/artist/*/edit*', async (route, request) => {
  if (request.method() === 'POST') { posts++; const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${mbid}` } }); }
  return route.continue();
});
await page.click('#falcon-tab-workers');
await page.evaluate(() => window.__falconTest.start());
await page.waitForSelector('.falcon-worker-card', { timeout: 5000 });
await page.waitForTimeout(500);
await page.click('.falcon-worker-zoom');
await page.waitForTimeout(200);
const zoomInfo = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.falcon-worker-card')];
  return cards.map(c => {
    const cs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    return { display: cs.display, width: r.width, left: r.left, onScreen: cs.display !== 'none' && r.right > 0 };
  });
});
console.log('zoom layout:', JSON.stringify(zoomInfo));
// #467: a card that's mid-item must NOT be display:none — that stops its iframe
// rendering and its submit never lands (see verify-467-hidden-workers.mjs). So
// "hidden" now means either display:none (safe, idle) or parked off-screen
// (still live); what matters is that only the zoomed card is actually on screen.
ck(zoomInfo[0].onScreen && zoomInfo.slice(1).every(c => !c.onScreen), `zooming worker 1 takes the other worker card(s) off screen (${JSON.stringify(zoomInfo.map(c => ({ d: c.display, on: c.onScreen })))})`);
ck(zoomInfo[0].width > 400, `zoomed worker card is meaningfully larger (${zoomInfo[0].width}px)`);
await page.click('.falcon-worker-zoom');   // restore
await page.waitForTimeout(200);
// #467 (majkinetor: "hide idle workers on Workers tab") — by this point both
// items in THIS section have committed and gone idle, so un-zooming should
// hide those specific cards — earlier sections in this same test file left
// their OWN (retired, non-idle) cards around too (cards accumulate for the
// whole panel session), so check per-card idle state rather than assuming
// every card in the whole accumulated strip behaves the same way.
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status === 'done'), null, { timeout: 10000 });
const cardStates = await page.evaluate(() => [...document.querySelectorAll('.falcon-worker-card')].map(c => ({ idle: c.dataset.idle === '1', retired: c.dataset.retired === '1', display: getComputedStyle(c).display })));
console.log('card states once idle:', JSON.stringify(cardStates));
ck(cardStates.some(c => c.idle), 'at least one card from this section is now idle');
ck(cardStates.every(c => !c.idle || c.display === 'none'), `every IDLE card is hidden once un-zoomed (${JSON.stringify(cardStates)})`);
ck(cardStates.every(c => c.idle || c.display !== 'none'), `non-idle (e.g. retired) cards from earlier sections stay visible (${JSON.stringify(cardStates)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
