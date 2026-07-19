// #435 — Apple Music as a Credit Hoarder source. Live end-to-end on the test release
// "Distances" (Apple album 1715825602): the Apple icon appears, importing yields
// per-track composer/producer credits in the review table, name-only.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1700, height: 1100 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// GM_xmlhttpRequest shim → real cross-origin fetch via the browser context (bypassCSP)
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  try { const r = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text() }; }
  catch (e) { return { status: 0, responseText: '' }; }
});
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} })
      .then(r => o.onload && o.onload(r)).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
});
await page.goto('https://musicbrainz.org/release/e78fb896-05d9-403d-aca1-6e79ab6c4219/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(async () => { const dbs = await indexedDB.databases(); for (const d of dbs) indexedDB.deleteDatabase(d.name); });
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1500);
const hasApple = await page.evaluate(() => [...document.querySelectorAll('.discogs-src-ico')].some(b => b.dataset.src === 'Apple'));
if (hasApple) {
  await page.click('.discogs-src-ico[data-src="Apple"]');
  await page.waitForFunction(() => /Apple credits:|No Apple credits|Preflight done/.test(document.body.innerText), null, { timeout: 120000 });
  await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2000);
}
const r = await page.evaluate(() => {
  const log = document.body.innerText;
  const names = [...document.querySelectorAll('tr')].map(tr => tr.textContent).filter(t => /Pablo Bolivar|Nacho Sanchez/.test(t)).length;
  const credLine = (log.match(/Apple credits: \d+ per-track[^\n]*/) || [''])[0];
  return { credLine, resolvedRows: names, sawApple: /Fetching Apple Music credits/.test(log) };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(hasApple, 'Apple source icon present on a release with an Apple album link');
ck(r.sawApple, 'clicking Apple starts the anonymous credits fetch');
ck(/Apple credits: [1-9]\d* per-track/.test(r.credLine), `per-track Apple credits harvested ("${r.credLine}")`);
ck(r.resolvedRows >= 1, `composer rows (Pablo Bolivar / Nacho Sanchez) in the review table (${r.resolvedRows})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
