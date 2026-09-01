// #556 A/B probe — runs the cached-reload scenario against ANY build, using only
// production selectors (no test hook), so old and new builds can be compared.
// Read-only: all POSTs aborted.   node test/probe-556.mjs [script.user.js]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SCRIPT = process.argv[2] || 'C:/Work/mb-userscripts/userscripts/platform_check/platform_check.user.js';
const code = await readFile(SCRIPT, 'utf8');
const REL = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url(), responseHeaders: '' }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url, responseHeaders: '' }; }
});
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {}, data: o.data }).then(r => {
      o.onload && o.onload({ status: r.status, finalUrl: r.finalUrl, responseText: r.responseText, responseHeaders: r.responseHeaders });
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
  window.__opened = [];
  window.GM_openInTab = (u) => { window.__opened.push(u); return { closed: false, close() {} }; };
});
const page = await ctx.newPage();
await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());
await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(800);
const seed = await page.evaluate((rel) => {
  const hrefs = [...document.querySelectorAll('#sidebar a[href]')].map(a => a.href);
  const pick = hrefs.find(u => /soundcloud\.com\//i.test(u));
  if (!pick) return { none: true };
  const variant = pick.replace(/\/$/, '') + '/';
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('pc:')) localStorage.removeItem(k); }
  localStorage.setItem(`pc:cache:v2:soundcloud:${rel}`, JSON.stringify({ url: variant, tracks: 10, source: 'search', year: 2020 }));
  return { none: false, mbHas: pick, cached: variant };
}, REL);
console.log('MB has :', seed.mbHas);
console.log('cached :', seed.cached, '(source: search)');
await page.addScriptTag({ content: code });
await page.waitForSelector('#mb-inject-btn', { timeout: 20000 });
await page.waitForTimeout(9000);
const out = await page.evaluate((rel) => {
  const c = JSON.parse(localStorage.getItem(`pc:cache:v2:soundcloud:${rel}`) || '{}');
  window.__opened.length = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('pc:pending')) localStorage.removeItem(k); }
  document.getElementById('mb-inject-btn').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const pending = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('pc:pending')) pending[k] = localStorage.getItem(k); }
  return { source: c.source, pending, opened: window.__opened.slice() };
}, REL);
console.log('---');
console.log('cache source after load :', out.source, out.source === 'MB rels' ? '(upgraded — correct)' : '(STALE — the bug)');
console.log('right-click + queued    :', JSON.stringify(out.pending));
console.log('tabs it would open      :', out.opened.length);
console.log(out.opened.length === 0 && !Object.keys(out.pending).length
  ? '=> CORRECT: nothing re-queued, no pointless tab'
  : '=> BUG REPRODUCED: re-queues a link the release already has, opening a tab that does nothing');
await ctx.close();
