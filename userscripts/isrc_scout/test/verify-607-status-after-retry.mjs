// #607 (chaban-mb): "The ISRC count status button continues to show the question
// after the dialog has been opened and release data loaded". The page-load
// release fetch hit MB's rate limit (503) → button "?"; opening the dialog loaded
// the release fine, but nothing told the button.
//
// The FIRST /ws/2/release request is answered 503 (as in his log); later ones go
// to MB for real. Asserts "?" after load, then a real count once the dialog has
// loaded the release. Read-only: opens the dialog, submits nothing.
// II_SRC=<old build> to watch it stay "?".
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.II_SRC || resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const REL = '603bf0b9-df73-431c-8047-f2d8a1d108ee';   // the release from the issue
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
  let releaseCalls = 0;
  window.GM_xmlhttpRequest = (o) => {
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    if (/\/ws\/2\/release\/[0-9a-f-]{36}\?/.test(o.url) && ++releaseCalls === 1) {
      setTimeout(() => done({ status: 503, statusText: 'Service Unavailable', finalUrl: o.url, responseHeaders: '',
        responseText: '{"error": "Your requests are exceeding the allowable rate limit."}' }), 50);
      return { abort() {} };
    }
    fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
      .then(async r => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 25000, state: 'attached' });
await page.waitForFunction(() => document.getElementById('ii-btn-status')?.textContent !== '⏳', null, { timeout: 20000 });
const before = await page.evaluate(() => ({ status: document.getElementById('ii-btn-status').textContent, title: document.getElementById('ii-btn').title }));
console.log('after the 503 page load:', JSON.stringify(before));
ck(before.status === '?', 'page-load 503 → button shows "?"');

await page.evaluate(() => document.getElementById('ii-btn').click());
await page.waitForFunction(() => !/Loading release/.test(document.getElementById('ii-modal')?.innerText || 'Loading release'), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);
const after = await page.evaluate(() => ({ status: document.getElementById('ii-btn-status').textContent, title: document.getElementById('ii-btn').title, rows: document.querySelectorAll('#ii-modal tbody tr').length }));
console.log('after opening the dialog:', JSON.stringify(after));
ck(after.rows > 1, `the dialog loaded the release (${after.rows} rows)`);
ck(/^[✓⚠] \d+\/\d+$/.test(after.status), `button now shows the real count ("${after.status}"), not "?"`);
ck(!/Could not load/.test(after.title), 'the "could not load" tooltip is gone');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
