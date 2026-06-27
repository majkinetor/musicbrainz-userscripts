// #304 — verify the big-note-list features: type-ahead filter + count, pinned
// quick-buttons, usage-based sort, bulk import/export. Pre-seeds ~30 notes via
// the GM store shim, then drives the panel.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'mammoth.user.js');
const ORIGIN = 'https://musicbrainz.org';
// an artist /edit page shows the edit note inline (visible), unlike the release
// editor where it's on a non-active tab. Daft Punk by default.
const GID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '056e4f3e-d505-4dad-8ec1-d04f521cbb56';
const EDIT_URL = `${ORIGIN}/artist/${GID}/edit`;

// 30 seeded saved notes; two contain "ZZZUNIQUE" for the filter test.
const seed = { saved: [], history: [] };
for (let i = 1; i <= 30; i++) seed.saved.push({ id: 'seed' + i, text: (i === 7 || i === 19 ? 'ZZZUNIQUE marker ' : 'Sample edit note ') + String(i).padStart(3, '0'), ts: 1000 + i });
// give a couple usage so "Most used" has a defined order
seed.saved[4].uses = 9; seed.saved[4].lastUsed = 99999;   // "...005"
seed.saved[2].uses = 5; seed.saved[2].lastUsed = 88888;   // "...003"

const shim = `(() => { const s = new Map(); s.set('mammoth:data', ${JSON.stringify(JSON.stringify(seed))}); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v);}; window.unsafeWindow=window; })();`;

const main = async () => {
  const userJs = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1100 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('textarea.edit-note', { timeout: 60000 });
  await page.evaluate(shim);
  await page.addScriptTag({ content: userJs });
  await page.waitForSelector('.mmth-side', { timeout: 30000 });
  await page.waitForTimeout(600);

  const out = {};
  const sel = s => document.querySelector(s);

  // 1) count shows total
  out.count0 = await page.evaluate(() => document.querySelector('.mmth-count')?.textContent);
  out.rows0 = await page.evaluate(() => document.querySelectorAll('.mmth-list .mmth-row').length);

  // 2) type-ahead filter
  await page.fill('.mmth-filter', 'zzzunique');
  await page.waitForTimeout(150);
  out.countFiltered = await page.evaluate(() => document.querySelector('.mmth-count')?.textContent);
  out.rowsFiltered = await page.evaluate(() => document.querySelectorAll('.mmth-list .mmth-row').length);
  await page.fill('.mmth-filter', '');
  await page.waitForTimeout(120);

  // 3) pin the first row -> pinbar gains a button
  await page.evaluate(() => { const r = document.querySelector('.mmth-list .mmth-row'); r.querySelector('.mmth-ra').click(); });
  await page.waitForTimeout(150);
  out.pinbarButtons = await page.evaluate(() => document.querySelectorAll('.mmth-pinbar .mmth-segb').length);
  out.pinbarVisible = await page.evaluate(() => getComputedStyle(document.querySelector('.mmth-pinbar')).display !== 'none');

  // 4) click a pinned quick-button -> textarea filled
  await page.evaluate(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = ''; });
  await page.evaluate(() => document.querySelector('.mmth-pinbar .mmth-segb').click());
  await page.waitForTimeout(150);
  out.taAfterPinClick = await page.evaluate(() => (document.querySelector('textarea.edit-note').value || '').slice(0, 30));

  // 5) usage sort: switch to "Most used" -> first row should be the high-uses note (...005)
  await page.selectOption('.mmth-sort', 'uses');
  await page.waitForTimeout(150);
  out.firstRowMostUsed = await page.evaluate(() => document.querySelector('.mmth-list .mmth-row .mmth-txt')?.textContent);
  out.grabHiddenWhenSorted = await page.evaluate(() => !document.querySelector('.mmth-list .mmth-row .mmth-grab'));
  await page.selectOption('.mmth-sort', 'manual');
  await page.waitForTimeout(120);
  out.grabShownManual = await page.evaluate(() => !!document.querySelector('.mmth-list .mmth-row .mmth-grab'));

  // 6) bulk import via the dedicated ⇅ popover (not Settings) #304
  await page.evaluate(() => { const b = [...document.querySelectorAll('.mmth-ft .mmth-fb')].find(x => x.title === 'Import / export saved notes'); b.click(); });
  await page.waitForSelector('.mmth-io-ta', { timeout: 5000 });
  await page.fill('.mmth-io-ta', 'Imported one\nImported two\nSample edit note 001');   // 3rd is a dup
  await page.evaluate(() => document.querySelector('.mmth-io-import').click());
  await page.waitForTimeout(150);
  out.importMsg = await page.evaluate(() => document.querySelector('.mmth-io-msg')?.textContent);

  // 7) export fills the textarea
  await page.evaluate(() => document.querySelector('.mmth-io-export').click());
  await page.waitForTimeout(150);
  out.exportLen = await page.evaluate(() => (document.querySelector('.mmth-io-ta').value || '').length);
  out.exportMsg = await page.evaluate(() => document.querySelector('.mmth-io-msg')?.textContent);

  console.log(JSON.stringify(out, null, 2));
  console.log('console errors:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
