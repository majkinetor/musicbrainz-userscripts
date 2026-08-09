// #490 (majkinetor): the "⚙ search SoundExchange…" entry point was a permanently-visible
// text link under EVERY row (spammy on a long tracklist), and clearing entered ISRCs made
// it vanish "for some reason" (clearPending() wipes .ii-cands, which is where that link
// used to live, appended once at initial render and never re-added).
//
// Fix: replace it with a row-hover-only search icon to the LEFT of the ISRC input (not
// inside .ii-cands, so clearing entered ISRCs can't make it disappear), and drop the "—"
// placeholder on the empty ISRC input.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 }, bypassCSP: true });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.GM_xmlhttpRequest = (opts) => {
    fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, credentials: 'include' })
      .then(async r => { const text = await r.text(); opts.onload && opts.onload({ status: r.status, responseText: text }); })
      .catch(e => { opts.onerror && opts.onerror(e); });
    return { abort() {} };
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/1bfa31f9-b196-4eb1-a805-e747a610372d', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 10000 });
await page.click('#ii-btn');
await page.waitForSelector('tr[data-idx]', { timeout: 15000 });

// 1) no permanently-visible ".ii-cand-refine" text link on initial render
const refineCount = await page.evaluate(() => document.querySelectorAll('.ii-cand-refine').length);
ck(refineCount === 0, `no permanently-visible refine link on initial render (found ${refineCount})`);

// 2) the ISRC input has no "—" placeholder
const placeholder = await page.evaluate(() => document.querySelector('tr[data-idx="0"] .ii-input').getAttribute('placeholder'));
ck(!placeholder, `ISRC input has no "—" placeholder (got ${JSON.stringify(placeholder)})`);

// 3) the hover-search icon exists, is present but visually hidden (opacity 0) before hover...
const before = await page.evaluate(() => {
  const btn = document.querySelector('tr[data-idx="0"] .ii-sx-hover');
  return btn ? getComputedStyle(btn).opacity : null;
});
ck(before === '0', `hover-search icon starts at opacity 0 before hovering the row (got ${before})`);

// ...and becomes visible (and clickable) once the row is hovered
await page.hover('tr[data-idx="0"] .ii-input');
await page.waitForTimeout(150);
const after = await page.evaluate(() => {
  const btn = document.querySelector('tr[data-idx="0"] .ii-sx-hover');
  return btn ? getComputedStyle(btn).opacity : null;
});
ck(after !== '0', `hover-search icon becomes visible on row hover (got ${after})`);

// 4) clicking it opens the SoundExchange refine panel for the right track
await page.click('tr[data-idx="0"] .ii-sx-hover');
await page.waitForTimeout(300);
const panelTrack = await page.evaluate(() => { const el = document.getElementById('ii-sxp-track'); return el ? el.textContent : null; });
ck(!!panelTrack, `clicking the hover icon opens the SoundExchange refine panel (track label: ${JSON.stringify(panelTrack)})`);

// 5) the #490 "for some reason" bug: after "Clear ISRCs" (clearPending(), the exact action
// from the report's second screenshot — toast "Cleared entered ISRCs"), the hover icon must
// STILL be there and still work, since it no longer lives inside .ii-cands (which
// clearPending() wipes).
await page.evaluate(() => document.body.click());   // dismiss any open panel first
await page.waitForTimeout(200);
await page.click('#ii-clear-toggle');
await page.waitForTimeout(150);
await page.click('#ii-clear-isrcs');
await page.waitForTimeout(200);
const stillThereAfterClear = await page.evaluate(() => !!document.querySelector('tr[data-idx="0"] .ii-sx-hover'));
ck(stillThereAfterClear === true, `hover-search icon survives "Clear ISRCs" — the #490 "for some reason" bug (got ${stillThereAfterClear})`);
await page.hover('tr[data-idx="0"] .ii-input');
await page.waitForTimeout(150);
const clickableAfterClear = await page.evaluate(() => getComputedStyle(document.querySelector('tr[data-idx="0"] .ii-sx-hover')).opacity !== '0');
ck(clickableAfterClear === true, `hover-search icon is still hoverable/clickable after "Clear ISRCs" (got ${clickableAfterClear})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
