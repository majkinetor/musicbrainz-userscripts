// #559 end-to-end on test.musicbrainz.org — the half a stubbed test cannot prove.
//
// verify-559-master-background.mjs covers the plumbing with GM_openInTab faked.
// That only shows the right URL was asked for. This one opens a REAL second tab
// on the sandbox, lets Platform Check's own inject helper fill the release-group
// editor and press "Enter edit" unattended, and then reads the release group back
// through /ws/2 to confirm the Discogs master URL is actually on it — and that
// the tab closed itself.
//
// ⚠ This WRITES to test.musicbrainz.org (the sanctioned sandbox), never to
// production. The origin is asserted before anything is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');

const ORIGIN = 'https://test.musicbrainz.org';
const RG = 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e';
// a unique master URL per run, so a pass can never be a leftover from a previous one
const MASTER = `https://www.discogs.com/master/${900000 + Math.floor(Math.random() * 99999)}`;
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

if (!/^https:\/\/test\.musicbrainz\.org$/.test(ORIGIN)) { console.log('refusing to run outside the sandbox'); process.exit(2); }

const rgRels = async () => {
  const r = await fetch(`${ORIGIN}/ws/2/release-group/${RG}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json', 'User-Agent': 'pc-559-probe/1.0 ( miodrag.milic@gmail.com )' } });
  const j = await r.json();
  return (j.relations || []).map(x => x.url && x.url.resource).filter(Boolean);
};

const before = await rgRels();
console.log('release-group url rels before: ' + JSON.stringify(before));
ck(!before.includes(MASTER), 'fixture: the master URL under test is not already there');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = (k) => store.delete(k);
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  // GM_openInTab is not available to an injected script, so the opener uses
  // window.open — a REAL second tab, which is the point: it must submit on its
  // own and be closed by the opener through the returned handle.
  window.__closedByOpener = false;
  window.GM_openInTab = (url, opts) => {
    const w = window.open(url, '_blank');
    return { get closed() { return !w || w.closed; }, close() { window.__closedByOpener = true; try { w && w.close(); } catch (e) {} } };
  };
});
// A real userscript manager runs the script in EVERY matching tab; addScriptTag
// only covers the page it is called on. Without this the background tab loads the
// editor and then just sits there, which looks exactly like the feature failing.
ctx.on('page', async p => {
  try {
    await p.waitForLoadState('domcontentloaded');
    p.on('pageerror', e => console.log('BG PAGEERROR ' + e.message));
    p.on('framenavigated', async f => {
      if (f !== p.mainFrame()) return;
      try { await p.waitForLoadState('domcontentloaded'); await p.addScriptTag({ content: code }); } catch (e) {}
    });
    await p.addScriptTag({ content: code });
  } catch (e) {}
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => { console.log('PAGEERROR ' + e.message); });
// the opener must be a RELEASE page — that is where the dashboard (and its test
// hook) lives; the guard added in #559 keeps the script off release-group pages
await page.goto(`${ORIGIN}/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }

// Seed exactly what the + button's release-group bucket writes, then take the
// same code path it takes. (Driving the dashboard's + would need a live ✓ Discogs
// match on this sandbox release; the queue payload is the real interface.)
await page.evaluate(({ rg, master }) => {
  localStorage.setItem(`pc:pending:rg:${rg}`, JSON.stringify({ 'discogs-master': master }));
}, { rg: RG, master: MASTER });
await page.addScriptTag({ content: code });
await page.waitForSelector('#mb-inject-btn', { timeout: 20000 });
await page.waitForFunction(() => !!window.__pcTest464, { timeout: 10000 });

const opened = ctx.pages().length;
const newTabPromise = ctx.waitForEvent('page', { timeout: 30000 });
await page.evaluate(({ rg }) => {
  // the opener side of a right-click add, for the release-group bucket
  window.__pcTest464.openRgEditTab(rg, { background: true });
}, { rg: RG });
const bgPage = await newTabPromise.catch(() => null);
ck(!!bgPage, 'a real background tab opened');
if (!bgPage) { await ctx.close(); process.exit(1); }
await bgPage.waitForLoadState('domcontentloaded').catch(() => {});
console.log('background tab opened at: ' + bgPage.url());
ck(/#pc-autocommit/.test(bgPage.url()), 'it carries the autocommit marker');

// let it fill the form and press "Enter edit" on its own
let navigated = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 1000));
  let u = null; try { u = bgPage.url(); } catch (e) { u = null; }
  if (u && /\/release-group\/[0-9a-f-]{36}\/?($|[?#])/.test(u) && !/\/edit/.test(u)) { navigated = u; break; }
  if (bgPage.isClosed()) { navigated = 'closed'; break; }
}
console.log('background tab ended at: ' + navigated);
ck(!!navigated, 'the background tab submitted itself through to the release-group page');

// give the landing page a moment to post back + be closed by the opener
for (let i = 0; i < 20 && !bgPage.isClosed(); i++) await new Promise(r => setTimeout(r, 500));
ck(bgPage.isClosed(), '#559: THE FIX — the background tab is closed once the master edit commits');
const byOpener = await page.evaluate(() => window.__closedByOpener).catch(() => false);
ck(byOpener === true, 'and it was closed through the GM_openInTab handle, not left to the tab itself');

// the part only a read-back can prove
const after = await rgRels();
console.log('release-group url rels after: ' + JSON.stringify(after));
ck(after.includes(MASTER), `#559: the Discogs master really is on the release group now (${MASTER})`);

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
