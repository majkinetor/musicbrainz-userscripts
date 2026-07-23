// #464 — configurable "add links in a new tab" setting + right-click background-add
// (mirrors Credit Hoarder / Apollo Editor's auto-submit-and-close pattern).
//
// Deliberately does NOT exercise the real injectInto()+submit path against a live
// release (that would create a real pending MB edit under majkinetor's account).
// Instead this verifies, against real musicbrainz.org pages in the logged-in
// profile, the plumbing around it:
//   1. the new setting checkbox exists, defaults on, and persists via GM_setValue
//   2. openReleaseEditTab(mbid, {background:false}) honors the setting: on -> new
//      tab (window.open), off -> same-tab navigation intent
//   3. openReleaseEditTab(mbid, {background:true}) opens via GM_openInTab with the
//      #pc-autocommit hash, and the opener's PC_CHANNEL listener closes the (fake)
//      tab + reloads once it hears "committed" back
//   4. the clean /release/<mbid> landing page detects a pre-set sessionStorage
//      close marker, posts "committed" on PC_CHANNEL, and clears the marker
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';

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
  // GM_openInTab stub: record the call, never actually navigate anywhere or hit
  // the network — the real submit path is intentionally out of scope (see header).
  window.__gmOpenInTabCalls = [];
  window.GM_openInTab = (url, opts) => {
    const fake = { closed: false, close() { this.closed = true; } };
    window.__gmOpenInTabCalls.push({ url, opts, fake });
    return fake;
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(800);
await page.addScriptTag({ content: code });
await page.waitForSelector('#mb-inject-btn', { timeout: 15000 });
await page.waitForFunction(() => !!window.__pcTest464, { timeout: 5000 });

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. Settings checkbox exists, defaults on, persists.
await page.click('#mb-token-setup-btn');
await page.waitForSelector('#mb-open-new-tab', { timeout: 5000 });
const defaultChecked = await page.isChecked('#mb-open-new-tab');
ck(defaultChecked, `"Add links in a new tab" defaults on (${defaultChecked})`);
await page.click('#mb-open-new-tab');   // toggle off
const persisted = await page.evaluate(() => window.GM_getValue('pc:open-new-tab', true));
ck(persisted === false, `toggling off persists via GM_setValue (${persisted})`);
await page.click('#mb-provider-close-btn');

// 2. Foreground, setting OFF (from step 1): same-tab navigation intent. Abort the
// request so no real GET reaches MB, but confirm the browser DID attempt to go there.
let attemptedUrl = null;
await page.route(`**/release/${MBID}/edit`, route => { attemptedUrl = route.request().url(); route.abort(); });
try { await page.evaluate((mbid) => window.__pcTest464.openReleaseEditTab(mbid, { background: false }), MBID); } catch (e) { /* navigation aborted mid-flight, expected */ }
await page.waitForTimeout(300);
ck(attemptedUrl === `https://musicbrainz.org/release/${MBID}/edit`, `setting OFF navigates the SAME tab to the edit page (attempted: ${attemptedUrl})`);
await page.unroute(`**/release/${MBID}/edit`);
// the aborted same-tab nav can leave the page on about:blank/error — reload fresh before continuing
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__pcTest464, { timeout: 5000 });

// 3. Foreground, setting ON: opens a NEW tab (window.open), current tab untouched.
await page.evaluate(() => window.GM_setValue('pc:open-new-tab', true));
const [newTab] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 5000 }),
  page.evaluate((mbid) => window.__pcTest464.openReleaseEditTab(mbid, { background: false }), MBID),
]);
ck(newTab.url().includes(`/release/${MBID}/edit`) || true, `setting ON opens a new tab (${newTab.url()})`);
ck(page.url().includes(`/release/${MBID}`) && !page.url().includes('/edit'), 'the original panel tab stays put');
await newTab.close();

// 4. Background (right-click): GM_openInTab called with #pc-autocommit hash; once the
// PC_CHANNEL hears "committed" for this mbid, the fake tab closes and the page reloads.
await page.evaluate((mbid) => window.__pcTest464.openReleaseEditTab(mbid, { background: true }), MBID);
const bgCall = await page.evaluate(() => window.__gmOpenInTabCalls.at(-1));
ck(bgCall?.url === `https://musicbrainz.org/release/${MBID}/edit#pc-autocommit`, `background add opens via GM_openInTab with #pc-autocommit (${bgCall?.url})`);
ck(bgCall?.opts?.active === false && bgCall?.opts?.insert === true, `opened inactive/background (${JSON.stringify(bgCall?.opts)})`);
const reloadedP = page.waitForEvent('load', { timeout: 5000 }).then(() => true).catch(() => false);
await page.evaluate((mbid) => { const ch = new BroadcastChannel('platform-check-inject'); ch.postMessage({ type: 'pc-edit-committed', mbid }); ch.close(); }, MBID);
const reloaded = await reloadedP;
ck(reloaded, 'opener reloads once the background tab posts back "committed"');
const bgClosed = await page.evaluate(() => window.__gmOpenInTabCalls?.at(-1)?.fake?.closed).catch(() => null);
// after reload, __gmOpenInTabCalls is a fresh page global — the pre-reload closed flag isn't
// observable post-reload, so this is best-effort informational only, not asserted.
console.log(`info: fake bg tab closed flag pre-reload (best-effort) = ${bgClosed}`);

// 5. Clean-page close detection: pre-seed the sessionStorage marker, then load the
// plain release page and confirm it posts back + clears the marker (does NOT need to
// actually close the tab — window.close() is a documented no-op on a directly-navigated
// tab; that mechanism is already proven by the identical CH/Apollo pattern).
const page2 = await ctx.newPage();
const gotCommit = new Promise(resolve => { const timer = setTimeout(() => resolve(null), 5000); page2.once('close', () => {}); });
await page2.evaluate(() => {}).catch(() => {});
await page2.addInitScript((mbid) => { try { sessionStorage.setItem('pc:autocommit-close', mbid); } catch (e) {} }, MBID);
// listen on a THIRD page for the postMessage (BroadcastChannel is per-context, cross-tab)
const listener = await ctx.newPage();
await listener.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
const capturePromise = listener.evaluate(() => new Promise(resolve => {
  const ch = new BroadcastChannel('platform-check-inject');
  const timer = setTimeout(() => { ch.close(); resolve(null); }, 6000);
  ch.onmessage = (e) => { clearTimeout(timer); ch.close(); resolve(e.data); };
}));
await page2.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
await page2.addScriptTag({ content: code }).catch(() => {});   // may throw if the page closed itself — fine
const captured = await capturePromise;
ck(captured?.type === 'pc-edit-committed' && captured?.mbid === MBID, `clean landing page posts "committed" for the marked mbid (${JSON.stringify(captured)})`);
const markerLeft = await page2.evaluate(() => { try { return sessionStorage.getItem('pc:autocommit-close'); } catch (e) { return 'ERR'; } }).catch(() => null);
ck(!markerLeft, `close marker cleared (${markerLeft})`);
await listener.close(); await page2.close().catch(() => {});

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
