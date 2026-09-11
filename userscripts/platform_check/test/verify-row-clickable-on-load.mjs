// majkinetor, after the first row-click fix: "still can't click first 2 rows in
// PC but only on initial load. If I click refresh, its there."
//
// The earlier fix wired the rows where the search-fallback URLs are seeded, and
// that seeding sits a long way into runScans — after the release-group lookup,
// the cache-upgrade pass and the Wikidata SPARQL, all of them network. So on a
// fresh load the rows were dead for as long as those took, which is exactly the
// window in which you look at a panel that has just appeared. Pressing ↻ felt
// instant only because the rows were already wired from the previous run.
//
// The artist and album are known immediately (parsed from the page DOM, no
// network), so the seeding moves up to right after they are read.
//
// This measures TIME TO CLICKABLE from the moment the panel exists, which is the
// thing he actually reported — the earlier test only proved the rows were wired
// eventually, and would have passed throughout this bug.
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
const MBID = process.env.PC_RELEASE || 'aa6c4473-3528-41c2-b55b-d9e18bdba4ff';
/* Not a performance assertion — a POSITION one: the rows must be wired before the
   slow lookups, not after them. Each slow stub below answers in 2500ms, so a
   budget under that is the whole statement. 3000ms was the first try and it
   passed on the broken build at 2435ms, i.e. it measured "after exactly one slow
   call" and called it fine. */
const SLOW_MS = 2500;
const BUDGET_MS = 1200;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return null; };
  /* Every provider scan is stubbed out — they are irrelevant here and each one
     is a real request. What matters is that the SLOW pre-seeding work still
     happens, so the ordering under test is the real one: the release-group
     lookup and the Wikidata SPARQL answer, slowly, and the rows must already be
     clickable before they do. */
  window.GM_xmlhttpRequest = (o) => {
    const slow = /wikidata|release-group|sambl/i.test(o.url) ? 2500 : 40;   // keep in step with SLOW_MS
    setTimeout(() => { try { (o.onload || (() => {}))({ status: 200, responseText: '{}', finalUrl: o.url, responseHeaders: '', ms: slow }); } catch (e) {} }, slow);
    return { abort() {} };
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });

await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForSelector('#row-discogs', { state: 'attached', timeout: 20000 });
const t0 = Date.now();

// poll from the moment the panel exists
let clickableAt = null, frames = [];
for (let i = 0; i < 200; i++) {
  const s = await page.evaluate(() => {
    const st = p => {
      const r = document.getElementById('row-' + p), a = document.getElementById('mb-online-' + p);
      return { on: typeof (r && r.onclick) === 'function', url: !!(a && a.dataset.searchUrl) };
    };
    return { d: st('discogs'), b: st('bandcamp') };
  });
  const both = s.d.on && s.b.on && s.d.url && s.b.url;
  if (!frames.length || JSON.stringify(s) !== JSON.stringify(frames[frames.length - 1].s)) frames.push({ ms: Date.now() - t0, s });
  if (both) { clickableAt = Date.now() - t0; break; }
  await new Promise(r => setTimeout(r, 50));
}
console.log('\nstate changes after the panel appeared:');
frames.forEach(f => console.log(`  +${String(f.ms).padStart(5)}ms  ${JSON.stringify(f.s)}`));
console.log(`\nclickable after: ${clickableAt === null ? 'never (within 10s)' : clickableAt + 'ms'}`);

ck(clickableAt !== null, 'the first two rows become clickable at all');
ck(clickableAt !== null && clickableAt <= BUDGET_MS,
  `they are clickable before the slow lookups, not after (${clickableAt}ms, budget ${BUDGET_MS}ms)`);

// and a click really goes to the provider search, right then
const opened = await page.evaluate(() => {
  window.__opened.length = 0;
  for (const p of ['discogs', 'bandcamp']) {
    const cell = document.getElementById('val-' + p) || document.getElementById('row-' + p);
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  return window.__opened.slice();
});
console.log('opened:', JSON.stringify(opened, null, 1));
ck(opened.some(u => /discogs\.com\/search/.test(u)), 'clicking the Discogs row opens the Discogs search');
ck(opened.some(u => /bandcamp\.com\/search/.test(u)), 'clicking the Bandcamp row opens the Bandcamp search');

ck(posted.length === 0, `no write endpoint was called (${posted.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
