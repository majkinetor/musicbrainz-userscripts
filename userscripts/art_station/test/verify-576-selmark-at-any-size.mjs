// #576 (majkinetor): "Selection icon lost when sizing cards" — two screenshots of
// the same five selected covers, one step apart on the size slider. In the first
// each card carries the purple ✓; in the second every tick is gone while the
// toolbar still reads "5 selected".
//
// It was deliberate once: an `as-zoomed` class went on the root at tile >= 280
// and hid the per-card badge, on the theory that at big sizes the selection
// outline alone is obvious enough. It isn't — losing the tick mid-drag of the
// slider reads as the selection itself having been lost.
//
// This measures the badge's COMPUTED style across the old threshold, through
// both paths that resize: `input` (live drag, CSS variable only) and `change`
// (drop, full re-render). A test that only did one of them would have missed
// half the old bug, since the class was applied in both.
//
// Read-only: a public cover-art page is loaded and nothing is submitted; every
// POST is aborted and asserted zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js');
const code = await readFile(SRC, 'utf8');

const REL = '63cc0372-6a7b-4d0e-9da5-9efaf419cd8e';   // has cover art
const OLD_THRESHOLD = 280;                            // where the badge used to vanish
const SIZES = [120, 220, 279, 280, 300, 340];         // slider is min=120 max=340
const log = (...a) => console.log('[verify-576]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Art Station', version: 't' } };
  window.GM_xmlhttpRequest = (o) => {
    const done = (r) => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
      .then(async (r) => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch((e) => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// This test only selects cards and drags a slider — nothing here submits — but
// it runs against PRODUCTION MusicBrainz (the sandbox has no cover art at all,
// so there is nowhere else for Art Station to have cards). Every POST is aborted
// and recorded, so a write can neither land nor pass unnoticed.
const posted = [];
await page.route(() => true, r => {
  if (r.request().method() === 'POST') { posted.push(r.request().url()); return r.abort(); }
  return r.fallback();
});

await page.goto(`https://musicbrainz.org/release/${REL}/cover-art`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root .as-card', { timeout: 25000 });
await page.waitForTimeout(1200);

// select everything, so "is the tick showing" has cards to be true of
await page.click('.as-selall');
await page.waitForTimeout(300);
const selected = await page.evaluate(() => document.querySelectorAll('#as-root .as-card.sel').length);
log('selected cards:', selected);
ck(selected >= 2, `at least two cards are selected to check (got ${selected})`);

// Reads the badge as the browser resolves it — not the class list, not the
// stylesheet text. A rule hiding it any other way would be caught too.
const probe = () => page.evaluate(() => {
  const cards = [...document.querySelectorAll('#as-root .as-card.sel')];
  const marks = cards.map(c => {
    const m = c.querySelector('.as-selmark');
    if (!m) return { missing: true };
    const cs = getComputedStyle(m), r = m.getBoundingClientRect();
    return { display: cs.display, visibility: cs.visibility, opacity: +cs.opacity, w: Math.round(r.width), h: Math.round(r.height) };
  });
  return {
    tile: getComputedStyle(document.documentElement).getPropertyValue('--as-tile').trim(),
    zoomed: document.getElementById('as-root').classList.contains('as-zoomed'),
    cards: cards.length,
    hidden: marks.filter(m => m.missing || m.display === 'none' || m.visibility === 'hidden' || m.opacity === 0 || m.w === 0).length,
    sample: marks[0],
  };
});

// A real slider fires input while dragging and change on release, and the script
// splits the work the same way: input updates --as-tile live, change saves and
// re-renders. Dispatching change ALONE would leave the tile size untouched and
// silently test the previous size six times over, so the drop path sends both.
const setSize = async (px, evt) => {
  await page.evaluate(([v, e]) => {
    const el = document.querySelector('#as-root .as-size');
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (e === 'change') el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [px, evt]);
  await page.waitForTimeout(evt === 'change' ? 900 : 250);   // change() re-renders
};

for (const evt of ['input', 'change']) {
  for (const px of SIZES) {
    await setSize(px, evt);
    if (evt === 'change') { await page.click('.as-selall'); await page.waitForTimeout(250); }   // a re-render clears selection
    const r = await probe();
    const big = px >= OLD_THRESHOLD ? ' (past the old cut-off)' : '';
    log(`${evt} ${px}px${big}:`, JSON.stringify(r));
    ck(r.cards >= 2, `${evt} @${px}px: cards are still selected (${r.cards})`);
    ck(r.hidden === 0, `${evt} @${px}px${big}: every selected card still shows its ✓ (${r.hidden} hidden of ${r.cards})`);
    ck(!r.zoomed, `${evt} @${px}px: no as-zoomed class is applied`);
    ck(r.tile === px + 'px', `${evt} @${px}px: the tile size really changed (--as-tile=${r.tile})`);
  }
}

// MusicBrainz's own pages POST to Sentry on their own, which is neither ours nor
// a write — asserting "zero POSTs of any kind" would fail on their telemetry and
// teach us to ignore the assertion. What must be zero is a POST to somewhere a
// cover or an edit could actually land.
const WRITE_HOST = /(^|\.)(musicbrainz\.org|coverartarchive\.org|archive\.org)$/;
const writes = posted.filter(u => { try { return WRITE_HOST.test(new URL(u).hostname); } catch (e) { return true; } });
if (posted.length) log('POSTs intercepted (all aborted):', JSON.stringify(posted.map(u => { try { return new URL(u).hostname; } catch (e) { return u; } })));
ck(writes.length === 0, `nothing was submitted to MusicBrainz or the archives (${writes.length}: ${JSON.stringify(writes.slice(0, 3))})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
