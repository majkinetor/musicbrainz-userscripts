// #307 — time "Find links" and verify parallel resolution. Loads the userscript
// with the GM shim bridge (shared cookie jar), opens the Links tab, clicks Find
// links, measures wall-clock + resolved counts.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'isrc_scout.user.js');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'c5483783-6e52-4a59-9750-77f44b2ef5db';

const shim = `
  (() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => { store.set(k, v); };
    window.GM_deleteValue = (k) => { store.delete(k); };
    window.GM_xmlhttpRequest = function(opts) {
      window.__gmFetch({ method: opts.method || 'GET', url: opts.url, headers: opts.headers || {}, data: opts.data })
        .then(res => { if (res._networkError) { try { opts.onerror && opts.onerror(res); } catch(e){} } else { try { opts.onload && opts.onload(res); } catch(e){} } })
        .catch(() => { try { opts.onerror && opts.onerror({ status: 0, responseText: '' }); } catch(e){} });
    };
    window.unsafeWindow = window;
    window.GM_info = { script: { name: 'isrc_scout (test)', version: 'test' }, scriptHandler: 'Playwright' };
  })();
`;

const main = async () => {
  const userJs = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1100 } });
  await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
    try {
      const resp = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
      return { status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: await resp.text(), responseHeaders: '' };
    } catch (e) { return { status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, _networkError: true, _error: String(e?.message || e) }; }
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.addInitScript({ content: shim });
  await page.addInitScript({ content: userJs });
  await page.goto(`${ORIGIN}/release/${MBID}`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('#ii-btn', { timeout: 30000 });
  await page.click('#ii-btn');
  await page.waitForSelector('#ii-modal', { timeout: 30000 });
  await page.waitForSelector('#ii-table tbody tr[data-idx]', { timeout: 60000 });
  await page.click('#ii-modal .ii-tab[data-scope="links"]');
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => ({ cands: document.querySelectorAll('#ii-modal .ii-tl.cand').length, byCode: (() => { const m = {}; document.querySelectorAll('#ii-modal .ii-tl.cand').forEach(e => m[e.dataset.code] = (m[e.dataset.code] || 0) + 1); return m; })() }));
  console.log('[307] candidates before:', JSON.stringify(before));
  if (!before.cands) { console.log('[307] no candidates to resolve on this release'); await ctx.close(); return; }

  const t0 = Date.now();
  await page.evaluate(() => document.querySelector('#ii-links-btn')?.click());
  await page.waitForFunction(() => { const b = document.querySelector('#ii-links-btn'); return b && !b.dataset.busy && document.querySelectorAll('#ii-modal .ii-tl.spin').length === 0; }, null, { timeout: 120000 });
  const elapsed = Date.now() - t0;

  const after = await page.evaluate(() => ({ resolved: document.querySelectorAll('#ii-modal .ii-tl.new').length, absent: document.querySelectorAll('#ii-modal .ii-tl.absent').length, spin: document.querySelectorAll('#ii-modal .ii-tl.spin').length }));
  console.log('[307] elapsed ms:', elapsed);
  console.log('[307] after:', JSON.stringify(after));
  console.log('[307] console errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
