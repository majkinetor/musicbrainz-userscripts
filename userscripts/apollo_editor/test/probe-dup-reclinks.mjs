// Probe — left-side ("Release title") recording links in the duplicate comparison view.
// Injects a duplicates row pointing at a REAL Smith & Mudd release, lets Apollo add the
// Similarity cell, clicks it to expand buildDupDetail, then asserts the existing (left)
// titles are anchored to /recording/<gid> while the seeded (right) titles are not.

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const HEADED = process.argv.includes('--headed');
const ORIGIN = 'https://musicbrainz.org';
const REAL_GID = 'b902d82e-4623-4cbd-99f8-0b951b77cd92';   // Smith & Mudd — "24/7"
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', 'dup-reclinks-' + stamp);
const log = (...a) => console.log('[probe-reclinks]', ...a);

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

  // seed a couple of entered tracks so the comparison has a right-hand side
  await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const rel = u(window.MB.releaseEditor.rootField.release);
    try { rel.name('24/7'); } catch {}
  });

  // inject a duplicates row pointing at the real release
  await page.evaluate(gid => {
    const a = [...document.querySelectorAll('#release-editor ul.ui-tabs-nav a')].find(x => /duplicate/i.test(x.getAttribute('href') || ''));
    if (a) a.click();
    const tbody = document.querySelector('#duplicates-tab tbody'); if (!tbody) return;
    tbody.innerHTML =
      '<tr>' +
      '<td><input type="radio" name="base-release" value="' + gid + '"></td>' +
      '<td><a href="/release/' + gid + '" target="_blank">24/7</a></td>' +
      '<td>Smith &amp; Mudd</td><td>Digital Media</td><td>10</td>' +
      '<td>2019</td><td>XW</td><td>Claremont 56</td><td></td><td></td>' +
      '</tr>';
  }, REAL_GID);
  await page.waitForTimeout(1500);   // let the observer add the Similarity cell

  // click the Similarity cell to expand the comparison, then wait for the fetch
  const clicked = await page.evaluate(() => {
    const cell = document.querySelector('#duplicates-tab .tc-dup-sim');
    if (!cell) return false; cell.click(); return true;
  });
  log('similarity cell clicked:', clicked);
  await page.waitForFunction(() => !!document.querySelector('#duplicates-tab .tc-dd-tbl'), null, { timeout: 20000 }).catch(() => log('comparison table did not render'));
  await page.waitForTimeout(400);

  const res = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#duplicates-tab .tc-dd-row')];
    const leftLinks = [], leftPlain = [];
    rows.forEach(r => {
      const left = r.children[1];   // Release title (existing/left)
      const seeded = r.children[4]; // Seeded title (right)
      const a = left && left.querySelector('a[href*="/recording/"]');
      if (a) leftLinks.push({ text: left.textContent.trim(), href: a.getAttribute('href') });
      else if (left && left.textContent.trim()) leftPlain.push(left.textContent.trim());
      // seeded side should NOT be a recording link
      const sa = seeded && seeded.querySelector('a[href*="/recording/"]');
      if (sa) leftPlain.push('SEEDED-LINKED:' + seeded.textContent.trim());
    });
    return { rowCount: rows.length, leftLinks, leftPlain };
  });
  log('rows:', res.rowCount);
  log('left recording links:', JSON.stringify(res.leftLinks.slice(0, 12), null, 0));
  log('left plain / anomalies:', JSON.stringify(res.leftPlain.slice(0, 12)));

  const tbl = await page.$('#duplicates-tab .tc-dd-tbl');
  if (tbl) await tbl.screenshot({ path: resolve(LOG_DIR, 'comparison.png') }).catch(e => log('shot failed:', e.message));
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));

  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length); fatal.slice(0, 5).forEach(l => console.log('   ', l));

  const seededLinked = res.leftPlain.some(x => x.startsWith('SEEDED-LINKED:'));
  const pass = res.rowCount > 0 && res.leftLinks.length > 0 && res.leftLinks.every(l => /\/recording\/[0-9a-f-]{36}$/.test(l.href)) && !seededLinked && fatal.length === 0;
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close(); else log('headed — leaving open');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
