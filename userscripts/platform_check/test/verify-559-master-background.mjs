// #559 (majkinetor): "Discogs master link should be also added in the background
// and tab auto closed when right click is issued on [+] button."
//
// The Discogs master URL goes onto the release GROUP, and the background flow
// (#464) never covered it — a right-click add opened the release-group editor in
// a normal focused tab and logged "Background add doesn't cover the release-group
// master URL". This verifies the plumbing that changed, against real pages:
//
//   1. openRgEditTab(rg, {background:true}) opens via GM_openInTab with the
//      #pc-autocommit hash, and the opener closes that tab when it hears the
//      release-group "committed" message (and NOT the release one — the two
//      buckets can be in flight at the same time from a single right-click)
//   2. openRgEditTab(rg, {background:false}) still honours the new-tab setting
//   3. the clean /release-group/<mbid> landing page — newly @match'd, which is
//      the whole reason the tab can close itself — posts "committed" and clears
//      its marker
//   4. widening the @match must NOT mount the dashboard on release-group pages
//
// Nothing is submitted here; the real submit is covered by
// live-559-master-background.mjs, which reads the edit back off the sandbox.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const RG = '7f1c1c1e-0000-4000-8000-000000000001';   // never navigated to — only used as an identifier
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url(), responseHeaders: '' }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url, responseHeaders: '' }; }
});
await ctx.addInitScript(() => {
  const store = new Map();
  window.__store = store;
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {}, data: o.data }).then(r => {
      o.onload && o.onload({ status: r.status, finalUrl: r.finalUrl, responseText: r.responseText, responseHeaders: r.responseHeaders });
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
  window.__gmOpenInTabCalls = [];
  window.GM_openInTab = (url, opts) => {
    const fake = { closed: false, close() { this.closed = true; } };
    window.__gmOpenInTabCalls.push({ url, opts, fake });
    return fake;
  };
  window.__opened = [];
  const realOpen = window.open.bind(window);
  window.open = (u, t) => { window.__opened.push(u); return { closed: false, close() {} }; };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(800);
await page.addScriptTag({ content: code });
await page.waitForSelector('#mb-inject-btn', { timeout: 15000 });
await page.waitForFunction(() => !!window.__pcTest464, { timeout: 5000 });
ck(await page.evaluate(() => typeof window.__pcTest464.openRgEditTab === 'function'), 'openRgEditTab exists');

// ── 1. background: GM_openInTab + #pc-autocommit, closed on the RG message ──
const bg = await page.evaluate((rg) => {
  window.__gmOpenInTabCalls.length = 0;
  window.__pcTest464.openRgEditTab(rg, { background: true });
  const call = window.__gmOpenInTabCalls[0];
  return { n: window.__gmOpenInTabCalls.length, url: call && call.url, active: call && call.opts && call.opts.active, closed: call && call.fake.closed };
}, RG);
console.log('background open: ' + JSON.stringify(bg));
ck(bg.n === 1, 'a background release-group add goes through GM_openInTab (' + bg.n + ')');
ck(/\/release-group\/[0-9a-f-]{36}\/edit#pc-autocommit$/.test(bg.url || ''), '#559: with the #pc-autocommit hash the edit page needs to auto-submit — ' + JSON.stringify(bg.url));
ck(bg.active === false, 'and stays in the background (active:false)');
ck(bg.closed === false, 'the tab is still open before any commit message');

// the RELEASE message must not close the release-group tab: a single right-click
// can have both in flight, and they finish independently
const wrongMsg = await page.evaluate((rg) => new Promise(res => {
  const ch = new BroadcastChannel('platform-check-inject');
  ch.postMessage({ type: 'pc-edit-committed', mbid: rg });        // release-type message
  setTimeout(() => res(window.__gmOpenInTabCalls[0].fake.closed), 400);
}), RG);
ck(wrongMsg === false, 'a RELEASE "committed" message does not close the release-group tab');

const closedOn = await page.evaluate((rg) => new Promise(res => {
  const ch = new BroadcastChannel('platform-check-inject');
  ch.postMessage({ type: 'pc-rg-edit-committed', mbid: rg });
  setTimeout(() => res(window.__gmOpenInTabCalls[0].fake.closed), 500);
}), RG);
ck(closedOn === true, '#559: the release-group "committed" message closes the background tab');

// ── 2. non-background still honours the new-tab setting ─────────────────────
const fg = await page.evaluate((rg) => {
  window.__opened.length = 0;
  window.GM_setValue('pc:open-new-tab', true);
  window.__pcTest464.openRgEditTab(rg, { background: false, sameTabAllowed: true });
  return { opened: window.__opened.slice() };
}, RG);
console.log('foreground open: ' + JSON.stringify(fg));
ck(fg.opened.length === 1 && /\/release-group\/.*\/edit$/.test(fg.opened[0]), 'a plain click still opens the editor in a new tab, with no autocommit hash');
ck(!/pc-autocommit/.test(fg.opened[0] || ''), 'specifically without #pc-autocommit — a foreground add must not submit itself');

// ── 4. the dashboard must not mount on a release-group page ─────────────────
{
  const p2 = await ctx.newPage();
  const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.goto('https://musicbrainz.org/release-group/f5093c06-23e3-404f-aeaa-40f72885ee3a', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(600);
  await p2.addScriptTag({ content: code });
  await p2.waitForTimeout(1500);
  const mounted = await p2.evaluate(() => ({
    panel: !!document.getElementById('mb-pc-panel'),
    injectBtn: !!document.getElementById('mb-inject-btn'),
    modals: document.querySelectorAll('#mb-log-modal, #mb-provider-modal').length,
  }));
  console.log('on a release-group page: ' + JSON.stringify(mounted));
  ck(!mounted.panel && !mounted.injectBtn, '#559: widening the @match does NOT mount the dashboard on a release-group page');
  ck(mounted.modals === 0, 'and injects none of its modals there either');
  ck(e2.length === 0, 'no page errors there: ' + JSON.stringify(e2.slice(0, 2)));
  await p2.close();
}

// ── 3. the landing page posts "committed" and clears its marker ─────────────
{
  const p3 = await ctx.newPage();
  const e3 = []; p3.on('pageerror', e => e3.push(e.message));
  const RG_REAL = 'f5093c06-23e3-404f-aeaa-40f72885ee3a';
  await p3.addInitScript((rg) => {
    try { sessionStorage.setItem('pc:autocommit-close-rg', rg); } catch (e) {}
    window.__heard = [];
    try {
      const ch = new BroadcastChannel('platform-check-inject');
      ch.onmessage = (e) => window.__heard.push(e.data);
    } catch (e) {}
    window.__closed = false;
    window.close = () => { window.__closed = true; };
  }, RG_REAL);
  await p3.goto(`https://musicbrainz.org/release-group/${RG_REAL}`, { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(500);
  await p3.addScriptTag({ content: code });
  await p3.waitForTimeout(900);
  const landed = await p3.evaluate(() => ({
    heard: window.__heard,
    closed: window.__closed,
    marker: sessionStorage.getItem('pc:autocommit-close-rg'),
    panel: !!document.getElementById('mb-pc-panel'),
  }));
  console.log('landing page: ' + JSON.stringify(landed));
  ck(landed.closed === true, '#559: the release-group landing page closes its own tab');
  ck(landed.marker === null, 'and clears the marker, so a later manual visit does not close itself');
  ck(!landed.panel, 'and does not mount a dashboard on the way past');
  ck(e3.length === 0, 'no page errors: ' + JSON.stringify(e3.slice(0, 2)));
  await p3.close();
}

ck(errs.length === 0, 'no page errors on the release page: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
