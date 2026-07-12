// #406 — inspect the Links-scope columns: what shows in ADD vs LINKED before and
// after Find links, to pin down "existing links passing over to add column".
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'isrc_scout.user.js');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '13d6362c-33b1-4085-b896-66e736c98980';

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

const dumpRows = () => document.evaluate ? null : null; // placeholder

const main = async () => {
  const userJs = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1600, height: 1100 } });
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
  await page.waitForTimeout(600);

  const snap = () => page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('#ii-modal #ii-tbody tr[data-idx]').forEach(tr => {
      const desc = a => `${a.className.replace('ii-tl ', '').trim()}:${a.dataset.code || a.dataset.name || '?'}${a.offsetParent === null ? '(hidden)' : ''}`;
      const linked = [...tr.querySelectorAll('.ii-tl-linked .ii-tl')].map(desc);
      const add    = [...tr.querySelectorAll('.ii-tl-add .ii-tl')].map(desc);
      rows.push({ i: tr.dataset.idx, linked, add });
    });
    const foot = document.querySelector('#ii-summary-links')?.textContent.trim() || '';
    return { rows: rows.slice(0, 6), foot,
      newCount: document.querySelectorAll('#ii-modal .ii-tl-add .ii-tl.new').length,
      candVisible: [...document.querySelectorAll('#ii-modal .ii-tl-add .ii-tl.cand')].filter(e => e.offsetParent !== null).length };
  });

  console.log('=== BEFORE Find links ===');
  const before = await snap();
  before.rows.forEach(r => console.log(`row ${r.i}  LINKED[${r.linked.join(', ')}]  ADD[${r.add.join(', ')}]`));
  console.log('foot:', before.foot, '| newCount:', before.newCount, '| candVisible:', before.candVisible);

  await page.evaluate(() => document.querySelector('#ii-links-btn')?.click());
  await page.waitForFunction(() => { const b = document.querySelector('#ii-links-btn'); return b && !b.dataset.busy && document.querySelectorAll('#ii-modal .ii-tl.spin').length === 0; }, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(500);

  console.log('\n=== AFTER Find links ===');
  const after = await snap();
  after.rows.forEach(r => console.log(`row ${r.i}  LINKED[${r.linked.join(', ')}]  ADD[${r.add.join(', ')}]`));
  console.log('foot:', after.foot, '| newCount:', after.newCount, '| candVisible:', after.candVisible);

  console.log('\nconsole errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
