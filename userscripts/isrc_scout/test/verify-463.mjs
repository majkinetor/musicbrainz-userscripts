// #463 — a non-Latin (Cyrillic) track title collapsed to '' in the position title-guard's
// _nrm, so track 10 ("слезы завтра") of Flos et Error got no link even though every provider
// lists the identical title at that position. Fix: _nrm keeps all Unicode letters/numbers.
// This loads ISRC Scout on the real release, Find links, and asserts track 10 (data-idx 9)
// now resolves at least one addable link. Read-only — never submits.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = '311818ee-cbfd-4ab7-a6c2-bf2873234c02';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url() }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} })
      .then(r => o.onload && o.onload(r)).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
});
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
await page.click('.ii-tab[data-scope="links"]');
await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand').length > 0, null, { timeout: 20000 });
await page.click('#ii-links-btn');
// wait until resolution settled (row 9 gets a new/absent marker, or a general timeout)
await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.new, #ii-modal .ii-tl.absent').length > 0, null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const row = document.querySelector('#ii-modal tr[data-idx="9"]');   // track 10 (0-based idx 9)
  const newLinks = row ? [...row.querySelectorAll('.ii-tl.new')].map(a => ({ code: a.dataset.code, href: a.href })) : [];
  const title = row ? (row.querySelector('.ii-track-title, .ii-title, td')?.textContent || '').slice(0, 40) : '';
  const totalNew = document.querySelectorAll('#ii-modal .ii-tl.new').length;
  return { newLinks, title, totalNew };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.newLinks.length >= 1, `track 10 (Cyrillic title) now resolves ≥1 link (${r.newLinks.map(l => l.code).join(',') || 'none'})`);
ck(r.totalNew >= 10, `most tracks resolve links (${r.totalNew} total new candidates)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
