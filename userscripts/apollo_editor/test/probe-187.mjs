// Probe #187 — duplicate similarity column.
// The native duplicate detection won't populate synthetically, so this injects
// rows matching MB's real `foreach: similarReleases` template into #duplicates-tab,
// sets the entered release name/artist in the model, enables "Modify Duplicates",
// and verifies Apollo adds a Similarity header + a scored, colour-graded cell per
// row (red→green) without errors. Captures a screenshot.

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const HEADED = process.argv.includes('--headed');
const ORIGIN = 'https://musicbrainz.org';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '187-' + stamp);
const log = (...a) => console.log('[probe-187]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 900 }, deviceScaleFactor: 3 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = [];
  page.on('console', m => consoleLines.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in.'); await ctx.close(); process.exit(3); }
  await page.evaluate(() => {
    const KEY = 'apolloEditor.settings.v1';
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    s.apolloEnabled = true; s.modifyDuplicates = true;
    localStorage.setItem(KEY, JSON.stringify(s));
  });

  await page.goto(`${ORIGIN}/release/add`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; } }, null, { timeout: 120000 }).catch(() => log('editor not ready'));
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1500);

  // set the entered release's name + artist in the model
  const entered = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const rel = u(window.MB.releaseEditor.rootField.release);
    try { if (typeof rel.name === 'function') rel.name('Random Access Memories'); } catch {}
    let namesLen = -1;
    try {
      const ac = u(rel.artistCredit); const names = u(ac.names) || [];
      namesLen = names.length;
      if (names[0] && typeof names[0].name === 'function') names[0].name('Daft Punk');
      else if (names[0]) names[0].name = 'Daft Punk';
    } catch {}
    // read back the way acText() does
    const acText = ac => { if (!ac) return ''; try { if (typeof ac.text === 'function') { const t = ac.text(); if (t) return t; } } catch {} const ns = u(ac.names) || []; return ns.map(n => (u(n.name) || '')).join(''); };
    return { name: u(rel.name), namesLen, artist: acText(u(rel.artistCredit)) };
  });
  log('entered release:', JSON.stringify(entered));

  // open the Duplicates tab + inject synthetic similarReleases rows (MB's real template shape)
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('#release-editor ul.ui-tabs-nav a')].find(x => /duplicate/i.test(x.getAttribute('href') || ''));
    if (a) a.click();
    const tbody = document.querySelector('#duplicates-tab tbody'); if (!tbody) return;
    const rows = [
      ['g1', 'Random Access Memories', 'Daft Punk', 'CD', '13', '2013', 'XW', 'Columbia', '88883716862', '888837168625'],
      ['g2', 'Random Access Memories (Deluxe)', 'Daft Punk', 'Digital Media', '15', '2013', 'XW', 'Columbia', '', ''],
      ['g3', 'Random Access Memories', 'Various Artists', 'CD', '13', '2014', 'US', 'Sony', '', ''],
      ['g4', 'Discovery', 'Daft Punk', 'CD', '14', '2001', 'XE', 'Virgin', '', ''],
    ];
    tbody.innerHTML = rows.map(r =>
      '<tr>' +
      '<td><input type="radio" name="base-release" value="' + r[0] + '"></td>' +
      '<td><a href="/release/' + r[0] + '" target="_blank">' + r[1] + '</a></td>' +
      '<td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td>' +
      '<td>' + r[5] + '</td><td>' + r[6] + '</td><td>' + r[7] + '</td><td>' + r[8] + '</td><td>' + r[9] + '</td>' +
      '</tr>').join('');
  });
  await page.waitForTimeout(1200);   // let the 500ms tick + observer augment

  const found = await page.evaluate(() => {
    const th = document.querySelector('#duplicates-tab .tc-dup-th');
    const cells = [...document.querySelectorAll('#duplicates-tab .tc-dup-sim')];
    return {
      hasTh: !!th, thText: th ? th.textContent : null,
      simCells: cells.map(c => ({ pct: c.textContent, bg: c.style.background })),
      // verify column alignment: header order
      headers: [...document.querySelectorAll('#duplicates-tab thead th')].map(h => h.textContent.trim()),
    };
  });
  log('Similarity th:', found.hasTh, JSON.stringify(found.thText));
  log('headers:', JSON.stringify(found.headers));
  log('similarity cells:', JSON.stringify(found.simCells));

  // ensure the duplicates panel is visible for the screenshot (jQuery-UI hides inactive panels)
  await page.evaluate(() => { const p = document.getElementById('duplicates-tab'); if (p) { p.style.display = 'block'; p.style.visibility = 'visible'; p.removeAttribute('aria-hidden'); } });
  await page.waitForTimeout(300);
  const tbl = await page.$('#duplicates-tab fieldset');
  if (tbl) await tbl.screenshot({ path: resolve(LOG_DIR, 'duplicates-similarity.png') }).catch(e => log('shot failed:', e.message));
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));

  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length); fatal.slice(0, 5).forEach(l => console.log('   ', l));

  const pcts = found.simCells.map(c => parseInt(c.pct, 10));
  const pass = found.hasTh && found.simCells.length === 4 && pcts[0] === 100 && pcts[3] < 40 && fatal.length === 0;
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close(); else log('headed — leaving open');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
