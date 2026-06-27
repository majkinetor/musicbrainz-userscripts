// #304 — verify the redesigned big-note-list features:
//  - pinned quick-buttons BELOW the field (not in the panel)
//  - note search is OPT-IN ("Show note search", default off); Enter uses 1st result
//  - sort lives in config (Manual/Most used/Recent)
//  - Import/Export is a tab inside the config window; line/blank-line mode both ways
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'mammoth.user.js');
const ORIGIN = 'https://musicbrainz.org';
const GID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '056e4f3e-d505-4dad-8ec1-d04f521cbb56';

const seed = { saved: [], history: [] };
for (let i = 1; i <= 30; i++) seed.saved.push({ id: 'seed' + i, text: (i === 7 || i === 19 ? 'ZZZUNIQUE marker ' : 'Sample edit note ') + String(i).padStart(3, '0'), ts: 1000 + i });
seed.saved[0].pinned = true; seed.saved[1].pinned = true;     // two pinned → pinbar
seed.saved[4].uses = 9; seed.saved[4].lastUsed = 99999;        // "...005" most used

// #309: scoping is opt-in (off by default → shared 'all' pool), so seed the 'all' scope
const shim = `(() => { const s = new Map(); s.set('mammoth:data', ${JSON.stringify(JSON.stringify({ all: seed }))}); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v);}; window.unsafeWindow=window; })();`;

const main = async () => {
  const userJs = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1100 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(`${ORIGIN}/artist/${GID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('textarea.edit-note', { timeout: 60000 });
  await page.evaluate(shim);
  await page.addScriptTag({ content: userJs });
  await page.waitForSelector('.mmth-side', { timeout: 30000 });
  await page.waitForTimeout(600);

  const out = {};
  // 1) pinned quick-buttons render BELOW the field (outside .mmth-side)
  out.pinbarButtons = await page.evaluate(() => document.querySelectorAll('.mmth-pinbar .mmth-segb').length);
  out.pinbarBelowField = await page.evaluate(() => { const b = document.querySelector('.mmth-pinbar'); return !!b && !b.closest('.mmth-side'); });
  await page.evaluate(() => { document.querySelector('textarea.edit-note').value = ''; });
  await page.evaluate(() => document.querySelector('.mmth-pinbar .mmth-segb').click());
  await page.waitForTimeout(120);
  out.taAfterPinClick = await page.evaluate(() => (document.querySelector('textarea.edit-note').value || '').slice(0, 30));

  // 2) search is OFF by default → no filter row
  out.searchHiddenByDefault = await page.evaluate(() => { const r = document.querySelector('.mmth-filterrow'); return getComputedStyle(r).display === 'none'; });

  // 3) open config, enable "Show note search", set sort to Most used, then use the I/O tab
  await page.evaluate(() => { const b = [...document.querySelectorAll('.mmth-ft .mmth-fb')].find(x => x.title === 'Settings'); b.click(); });
  await page.waitForSelector('.mmth-cfg', { timeout: 5000 });
  out.cfgHasTabs = await page.evaluate(() => document.querySelectorAll('.mmth-cfgtab').length);
  await page.evaluate(() => { const c = document.querySelector('.mmth-s-search'); if (!c.checked) c.click(); });
  await page.evaluate(() => { const s = document.querySelector('.mmth-s-sort'); s.value = 'uses'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  // switch to Import / Export tab
  await page.evaluate(() => { const t = [...document.querySelectorAll('.mmth-cfgtab')].find(x => x.dataset.tab === 'io'); t.click(); });
  await page.waitForTimeout(150);
  out.ioPaneShown = await page.evaluate(() => { const p = document.querySelector('.mmth-cfgpane[data-pane="io"]'); return getComputedStyle(p).display !== 'none'; });
  await page.fill('.mmth-io-ta', 'Imported one\nImported two\nSample edit note 001');   // 3rd dup
  await page.evaluate(() => document.querySelector('.mmth-io-import').click());
  await page.waitForTimeout(120);
  out.importMsg = await page.evaluate(() => document.querySelector('.mmth-io-msg')?.textContent);
  await page.evaluate(() => document.querySelector('.mmth-io-export').click());
  await page.waitForTimeout(120);
  out.exportLen = await page.evaluate(() => (document.querySelector('.mmth-io-ta').value || '').length);
  // close config (mousedown outside)
  await page.mouse.click(5, 400).catch(() => {});
  await page.waitForTimeout(150);

  // 4) search row now visible; filter + count; Enter uses first result
  out.searchVisibleAfter = await page.evaluate(() => { const r = document.querySelector('.mmth-filterrow'); return getComputedStyle(r).display !== 'none'; });
  await page.fill('.mmth-filter', 'zzzunique');
  await page.waitForTimeout(120);
  out.countFiltered = await page.evaluate(() => document.querySelector('.mmth-count')?.textContent);
  await page.evaluate(() => { document.querySelector('textarea.edit-note').value = ''; });
  await page.focus('.mmth-filter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  out.enterUsesFirst = await page.evaluate(() => (document.querySelector('textarea.edit-note').value || '').slice(0, 20));
  await page.fill('.mmth-filter', '');
  await page.waitForTimeout(120);

  // 5) sort=uses → first list row is the high-use note
  out.firstRowMostUsed = await page.evaluate(() => document.querySelector('.mmth-list .mmth-row .mmth-txt')?.textContent);

  console.log(JSON.stringify(out, null, 2));
  console.log('console errors:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
