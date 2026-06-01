// Track Cannon — end-to-end: seed the editor, inject the script, run matchAll(),
// apply the confident matches, and verify the model + the rendered fields resolved.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'track_cannon.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', 'int-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const log = (...a) => console.log('[integration]', ...a);

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const cons = [];
  page.on('console', m => cons.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => cons.push(`pageerror ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
  await page.evaluate(({ origin, params }) => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
    const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
    for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
    document.body.appendChild(f); f.submit();
  }, { origin: ORIGIN, params: seed });
  await page.waitForLoadState('domcontentloaded');
  if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
    await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });
  log('editor ready');
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__trackCannon, null, { timeout: 15000 });

  // switch to the Tracklist tab so the artist fields are visible
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const greenCount = () => page.evaluate(() => [...document.querySelectorAll('.artist-credit-editor input')].filter(i => /177, 235, 176/.test(getComputedStyle(i).backgroundColor)).length);
  const beforeGreen = await greenCount();

  // ── drive the real UI: click the button, let the panel match, screenshot, Apply confident ──
  log('opening Track Cannon panel via button…');
  await page.locator('#tc-btn').click();
  await page.waitForSelector('#tc-panel .tc-row', { timeout: 60000 });
  await page.waitForFunction(() => /to resolve/.test(document.querySelector('#tc-status')?.textContent || ''), null, { timeout: 60000 });
  await page.screenshot({ path: resolve(LOG_DIR, 'panel.png') });
  await page.locator('#tc-apply-conf').click();
  await page.waitForTimeout(1000);

  const report = await page.evaluate(() => {
    const tc = window.__trackCannon;
    const after = tc.readTracklist();
    const slots = after.reduce((n, t) => n + t.names.length, 0);
    const resolvedSlots = after.reduce((n, t) => n + t.names.filter(x => x.artistGid).length, 0);
    const summary = after.filter(t => t.names.length).map(t => ({ n: t.number, title: t.title.slice(0, 28), artists: t.names.map(x => (x.artistGid ? '✓' : '·') + x.artistName).join(' | ') }));
    return { totalSlots: slots, resolvedSlots, summary };
  });
  const afterGreen = await greenCount();

  await page.screenshot({ path: resolve(LOG_DIR, 'after.png') });
  // close the panel and capture the clean tracklist (the artist column, resolved/green)
  await page.locator('#tc-close').click().catch(() => {});
  await page.waitForTimeout(300);
  const tbl = page.locator('table.tbl').first();
  await (tbl.count().then(n => n ? tbl.screenshot({ path: resolve(LOG_DIR, 'tracklist.png') }) : page.screenshot({ path: resolve(LOG_DIR, 'tracklist.png') }))).catch(() => page.screenshot({ path: resolve(LOG_DIR, 'tracklist.png') }));
  await writeFile(resolve(LOG_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(LOG_DIR, 'console.log'), cons.join('\n'));

  log('── tracklist after Apply ──');
  report.summary.forEach(r => console.log('   ', String(r.n).padStart(2), r.title.padEnd(30), '→', r.artists));
  log(`resolved slots: ${report.resolvedSlots}/${report.totalSlots}`);
  log(`green fields: ${beforeGreen} → ${afterGreen}`);
  log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
