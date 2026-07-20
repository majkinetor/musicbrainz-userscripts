// #436 — legacy iTunes URLs recognized as Apple Music.
// Release 1a82cf5b ("The Romantic Egotist") links an iTunes URL:
//   https://itunes.apple.com/us/album/id1057026871
// (a) the release scan must surface the Apple import button (iTunes rel recognized);
// (b) pasting the iTunes URL must import via fetchApple, NOT fail "fetcher is not a function".
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = '1a82cf5b-74fe-4515-bb28-b4e1c0e2ef84';
const ITUNES_URL = 'https://itunes.apple.com/us/album/id1057026871';

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
await page.waitForSelector('#ii-am-all', { timeout: 20000 });
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
await page.waitForTimeout(600);

const appleBtnVisible = await page.evaluate(() => getComputedStyle(document.getElementById('ii-am-all')).display !== 'none');

// (b) paste the iTunes URL into the URL-add control and import it
await page.click('#ii-url-btn').catch(() => {});
await page.waitForTimeout(200);
await page.fill('#ii-url-input', ITUNES_URL).catch(() => {});
await page.press('#ii-url-input', 'Enter').catch(() => {});
await page.waitForFunction(() => /Apple done|Apple \d+\/|Apple failed|fetcher is not a function/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);

const r = await page.evaluate(() => {
  const log = document.getElementById('ii-log-out')?.textContent || '';
  return {
    importingLine: (log.match(/importing pasted album[^\n]*/) || [''])[0],
    albumLine:     (log.match(/Apple album[^\n]*/) || [''])[0],
    doneLine:      (log.match(/Apple done[^\n]*/) || [''])[0],
    fetcherErr:    /fetcher is not a function/.test(log),
    filled: [...document.querySelectorAll('#ii-modal tbody input')].filter(i => i.dataset.autofill === '1' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length,
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(appleBtnVisible, 'Apple import button shown — iTunes rel recognized as Apple Music by the release scan');
ck(/importing pasted album us\/1057026871/.test(r.importingLine), `iTunes URL parsed to us/1057026871 ("${r.importingLine}")`);
ck(!r.fetcherErr, 'no "fetcher is not a function" error on paste import');
ck(/Apple done/.test(r.doneLine), `Apple paste import completed ("${r.doneLine}")`);
ck(r.filled >= 1, `ISRCs filled from the pasted iTunes album (${r.filled})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
