// majkinetor, with a screenshot of a scan in progress: "While PC search is
// ongoing, discogs and bandcamp are unclickable rows, while bottom icons are
// clickable. We should be able to click those 2 too (goes to search)."
//
// The row-click handler (#173) was wired inside updateRow, i.e. only once a
// provider's scan had REPORTED. Every other provider folds into the compact
// strip while pending (#355) and those icons get their handler at build time —
// which is why they worked. Discogs and Bandcamp never fold, so they sat there
// as full-width rows with `row.onclick === null` for the whole scan.
//
// The wiring now lives in wireRowOpen(p) and is called as soon as the search
// fallback URLs are seeded, before any provider scan runs.
//
// The scan is held open deliberately: the GM_xmlhttpRequest stub answers the
// pre-scan lookups (Wikidata/SAMBL, so seeding is reached) and then never calls
// back for anything else — so the rows are measured in exactly the state his
// screenshot shows, mid-scan and unresolved.
//
// Run against the pre-fix build to see it fail:
//   git stash && node verify-row-clickable-while-scanning.mjs   → both rows FAIL
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.PC_SRC || resolve(HERE, '..', 'platform_check.user.js');
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const MBID = process.env.PC_RELEASE || 'aa6c4473-3528-41c2-b55b-d9e18bdba4ff';  // fixtures.json #1

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  // Hold the scan open. Wikidata/SAMBL answer (empty) so runScans gets past them
  // to the search-URL seeding; every provider request is swallowed, leaving each
  // row pending forever — the state in his screenshot.
  window.__gmCalls = [];
  window.GM_xmlhttpRequest = (o) => {
    window.__gmCalls.push(o.url);
    if (/wikidata|sambl|musicbrainz\.org\/ws\//i.test(o.url)) {
      setTimeout(() => o.onload && o.onload({ status: 200, responseText: '{}', finalUrl: o.url, responseHeaders: '' }), 0);
    }
    return { abort() {} };
  };
  // The row handler calls window.open; capture instead of spawning tabs.
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return null; };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// Never a catch-all route on production MB — it loads the page as chrome-error
// and the script never installs. Only the write endpoints, which nothing here
// should touch anyway.
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });

await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForSelector('#row-discogs', { state: 'attached', timeout: 20000 });
// Wait until the search fallbacks have been seeded (that is the moment the rows
// should become live) — but no further; the scans themselves never finish.
await page.waitForFunction(
  () => !!document.getElementById('mb-online-discogs')?.dataset.searchUrl,
  null, { timeout: 30000 });

const state = await page.evaluate(() => {
  const out = {};
  for (const p of ['discogs', 'bandcamp']) {
    const row = document.getElementById(`row-${p}`);
    const a = document.getElementById(`mb-online-${p}`);
    out[p] = {
      exists: !!row,
      compacted: !!row?.classList.contains('pc-compacted'),
      resolved: !!row?.classList.contains('pc-st-match'),
      hasHandler: typeof row?.onclick === 'function',
      hasContext: typeof row?.oncontextmenu === 'function',
      cursor: row?.style.cursor || '',
      searchUrl: a?.dataset.searchUrl || null,
    };
  }
  return out;
});

for (const p of ['discogs', 'bandcamp']) {
  const s = state[p];
  console.log(`\n[${p}] ${JSON.stringify(s)}`);
  ck(s.exists, `${p}: the row exists`);
  // If the scan had resolved, updateRow would have wired it and the test would
  // prove nothing — assert we are really measuring a mid-scan row.
  ck(!s.resolved && !s.compacted, `${p}: measured mid-scan — still a full, unresolved row`);
  ck(!!s.searchUrl, `${p}: has a search fallback URL`);
  ck(s.hasHandler, `${p}: the row is clickable while the scan is still running`);
  ck(s.hasContext, `${p}: right-click is wired too`);
  ck(s.cursor === 'pointer', `${p}: the cursor says so (${s.cursor || 'none'})`);
}

// And it actually goes somewhere: a click on an empty part of the row (the
// track-count cell, not the icon and not the name <a>) opens the search page.
const opened = await page.evaluate(() => {
  window.__opened.length = 0;
  for (const p of ['discogs', 'bandcamp']) {
    const cell = document.getElementById(`val-${p}`) || document.getElementById(`row-${p}`);
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  return window.__opened.slice();
});
console.log('\nopened:', JSON.stringify(opened, null, 1));
ck(opened.length === 2, `both clicks opened something (${opened.length})`);
ck(opened.some(u => /discogs\.com\/search/.test(u)), 'the Discogs click went to the Discogs search page');
ck(opened.some(u => /bandcamp\.com\/search/.test(u)), 'the Bandcamp click went to the Bandcamp search page');

ck(posted.length === 0, `no write endpoint was called (${posted.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
