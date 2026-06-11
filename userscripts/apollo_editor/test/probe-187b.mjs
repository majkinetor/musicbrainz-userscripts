// Probe #187b — duplicate similarity, click-to-expand track comparison.
// Replays the maintainer's exact test release (seed extracted from his
// "Confirm form submission" HTML), opens the Duplicates tab, clicks a similarity
// score, and verifies the per-track comparison table expands. Screenshots it.

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
// seed params extracted from the maintainer's "Confirm form submission" page
// (just release metadata — the raw HTML is NOT committed: MB embeds a Mapbox token).
const SEED_JSON = resolve(HERE, 'dupes-ref', 'seed-params.json');
const HEADED = process.argv.includes('--headed');
const ORIGIN = 'https://musicbrainz.org';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '187b-' + stamp);
const log = (...a) => console.log('[probe-187b]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const params = JSON.parse(await readFile(SEED_JSON, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  log('loaded', params.length, 'seed params; name:', (params.find(p => p[0] === 'name') || [, '(name not in params)'])[1]);

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = []; page.on('console', m => consoleLines.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in.'); await ctx.close(); process.exit(3); }
  await page.evaluate(() => { const KEY = 'apolloEditor.settings.v1'; const s = JSON.parse(localStorage.getItem(KEY) || '{}'); s.apolloEnabled = true; s.modifyDuplicates = true; localStorage.setItem(KEY, JSON.stringify(s)); });

  // POST-seed /release/add
  await page.evaluate(({ origin, params }) => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
    for (const [k, v] of params) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
    document.body.appendChild(f); f.submit();
  }, { origin: ORIGIN, params });
  await page.waitForLoadState('domcontentloaded');
  if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
    await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  log('landed on:', page.url());
  await page.waitForFunction(() => { try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; } }, null, { timeout: 120000 }).catch(() => log('editor not ready'));
  await page.waitForTimeout(4000);   // let the duplicate WS query populate similarReleases

  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1500);

  // open Duplicates tab
  await page.evaluate(() => { const a = [...document.querySelectorAll('#release-editor ul.ui-tabs-nav a')].find(x => /duplicate/i.test(x.getAttribute('href') || '')); if (a) a.click(); });
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => ({
    rows: document.querySelectorAll('#duplicates-tab tbody tr:not(.tc-dup-detail)').length,
    simCells: [...document.querySelectorAll('#duplicates-tab .tc-dup-sim')].map(c => c.textContent),
  }));
  log('duplicate rows:', before.rows, '| similarity cells:', JSON.stringify(before.simCells));

  // click the highest-scoring similarity cell to expand its comparison
  const clicked = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#duplicates-tab .tc-dup-sim')].filter(c => /\d/.test(c.textContent));
    if (!cells.length) return null;
    cells.sort((a, b) => parseInt(b.textContent) - parseInt(a.textContent));
    cells[0].click(); return cells[0].textContent;
  });
  log('clicked similarity cell:', clicked);
  // poll up to ~10s for the comparison rows (WS lookup can lag behind the editor's own calls)
  await page.waitForFunction(() => {
    const dr = document.querySelector('#duplicates-tab tr.tc-dup-detail');
    if (!dr) return false;
    const wrap = dr.querySelector('.tc-dd-wrap');
    return dr.querySelector('.tc-dd-row') || (wrap && !/loading/i.test(wrap.textContent));
  }, null, { timeout: 12000 }).catch(() => log('detail did not finish in time'));

  const detail = await page.evaluate(() => {
    const dr = document.querySelector('#duplicates-tab tr.tc-dup-detail');
    return {
      present: !!dr,
      compRows: dr ? dr.querySelectorAll('.tc-dd-row').length : 0,
      medHdrs: dr ? dr.querySelectorAll('.tc-dd-medhdr').length : 0,
      diffSpans: dr ? dr.querySelectorAll('.tc-dh').length : 0,
      wrapHtml: dr ? (dr.querySelector('td')?.innerHTML || '').slice(0, 200) : null,
      sample: dr ? dr.querySelector('.tc-dd-row')?.innerText?.replace(/\s+/g, ' ').slice(0, 140) : null,
    };
  });
  log('expanded detail:', JSON.stringify(detail));

  await page.evaluate(() => { const p = document.getElementById('duplicates-tab'); if (p) { p.style.display = 'block'; p.removeAttribute('aria-hidden'); } });
  await page.waitForTimeout(300);
  const fs = await page.$('#duplicates-tab fieldset');
  if (fs) await fs.screenshot({ path: resolve(LOG_DIR, 'dup-comparison.png') }).catch(e => log('shot failed', e.message));
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));

  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length); fatal.slice(0, 4).forEach(l => console.log('   ', l));
  const pass = before.rows > 0 && before.simCells.length > 0 && detail.present && detail.compRows > 0 && fatal.length === 0;
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close(); else log('headed — leaving open');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
