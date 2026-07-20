// #439 — SoundCloud as an ISRC Scout ISRC provider. Live on the example release
// ec2449a8 (links a SoundCloud SET). The SoundCloud import button appears, and
// clicking it fills per-track ISRCs from publisher_metadata.isrc (anonymous api-v2,
// client_id lifted from the web-player JS — no login).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const SET_URL = 'https://soundcloud.com/ace-uzumakii/sets/ace-uzumakii-kawaiitrap';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  try { const r = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url() }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: opts.url }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript((SET_URL) => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => {
      // ensure the SoundCloud set link is present as a URL rel on the release payload
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try { const j = JSON.parse(r.responseText); if (!(j.relations || []).some(x => /soundcloud\.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: SET_URL } }); r.responseText = JSON.stringify(j); } catch (e) {}
      }
      o.onload && o.onload(r);
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
}, SET_URL);
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-sc-all', { timeout: 20000 });
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
await page.waitForTimeout(600);
const scVisible = await page.evaluate(() => getComputedStyle(document.getElementById('ii-sc-all')).display !== 'none');
if (scVisible) {
  await page.click('#ii-sc-all');
  await page.waitForFunction(() => /SoundCloud done|SoundCloud \d+\/|SoundCloud .*failed/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);
}
// also exercise the URL-paste path (the shape of the #436 "fetcher is not a function" bug)
await page.click('#ii-url-btn').catch(() => {});
await page.waitForTimeout(200);
await page.fill('#ii-url-input', SET_URL).catch(() => {});
await page.press('#ii-url-input', 'Enter').catch(() => {});
await page.waitForFunction(() => /importing pasted album/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const log = document.getElementById('ii-log-out')?.textContent || '';
  return {
    setLine:  (log.match(/SoundCloud set[^\n]*/) || [''])[0],
    doneLine: (log.match(/SoundCloud done[^\n]*/) || [''])[0],
    pasteLine: (log.match(/importing pasted album[^\n]*/) || [''])[0],
    fetcherErr: /fetcher is not a function/.test(log),
    filled: [...document.querySelectorAll('#ii-modal tbody input')].filter(i => i.dataset.autofill === '1' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length,
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(scVisible, 'SoundCloud import button shown on a release with a SoundCloud set link');
ck(/SoundCloud set ".*": \d+ track/.test(r.setLine), `SoundCloud set fetched via api-v2 ("${r.setLine}")`);
ck(/SoundCloud done/.test(r.doneLine), `SoundCloud import completed ("${r.doneLine}")`);
ck(r.filled >= 1, `ISRCs filled from SoundCloud (${r.filled})`);
ck(/importing pasted album/.test(r.pasteLine), `paste path recognizes the SoundCloud set URL ("${r.pasteLine}")`);
ck(!r.fetcherErr, 'no "fetcher is not a function" on paste (SoundCloud wired into fetcherFor)');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
