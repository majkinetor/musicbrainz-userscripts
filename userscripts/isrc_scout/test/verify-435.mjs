// #435 — Apple Music as an ISRC Scout ISRC provider. Live on "Distances" (Apple
// album 1715825602): the Apple import button appears, clicking it fills per-track
// ISRCs from the anonymous amp-api (all 16 tracks carry an ISRC there).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = 'e78fb896-05d9-403d-aca1-6e79ab6c4219';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  try { const r = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url() }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: opts.url }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    // MB release payload: ensure the Apple album link is present as a URL rel
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => {
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try { const j = JSON.parse(r.responseText); if (!(j.relations || []).some(x => /music\.apple\.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: 'https://music.apple.com/us/album/distances/1715825602' } }); r.responseText = JSON.stringify(j); } catch (e) {}
      }
      o.onload && o.onload(r);
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
});
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-am-all', { timeout: 20000 });
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
await page.waitForTimeout(600);
const appleVisible = await page.evaluate(() => getComputedStyle(document.getElementById('ii-am-all')).display !== 'none');
if (appleVisible) {
  await page.click('#ii-am-all');
  await page.waitForFunction(() => /Apple done|Apple \d+\//.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
}
const r = await page.evaluate(() => {
  const log = document.getElementById('ii-log-out')?.textContent || '';
  const albumLine = (log.match(/Apple album[^\n]*/) || [''])[0];
  const doneLine = (log.match(/Apple done[^\n]*/) || [''])[0];
  const filled = [...document.querySelectorAll('#ii-modal tbody input')].filter(i => i.dataset.autofill === '1' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length;
  return { albumLine, doneLine, filled };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(appleVisible, 'Apple import button shown on a release with an Apple album link');
ck(/Apple album ".*": 16 track/.test(r.albumLine), `Apple album fetched via amp-api ("${r.albumLine}")`);
ck(/Apple done/.test(r.doneLine), 'Apple import completed');
ck(r.filled >= 1, `ISRCs filled from Apple (${r.filled})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
