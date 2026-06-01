// Track Cannon — mirror-table mode: enable "Replace MB track list", verify the mirror
// renders, drives MB's model for reorder/remove/length, and matches artists.
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
const LOG_DIR = resolve(HERE, 'logs', 'mirror-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const log = (...a) => console.log('[mirror]', ...a);

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1680, height: 1150 }, deviceScaleFactor: 2 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const cons = [];
  page.on('console', m => cons.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => cons.push(`pageerror ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
  // pre-enable replace mode so the script renders the mirror on load
  await page.evaluate(() => localStorage.setItem('trackCannon.settings.v1', JSON.stringify({ replace: true, autoRun: false })));
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
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});

  // mirror should auto-render in replace mode; wait for its rows
  await page.waitForSelector('.tc-mirror tbody tr', { timeout: 60000 });
  await page.waitForFunction(() => /confident/.test(document.querySelector('#tc-mstatus')?.textContent || ''), null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const nativeHidden = await page.evaluate(() => [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track')).every(t => t.style.display === 'none'));
  await page.locator('#tc-mirror-wrap').screenshot({ path: resolve(LOG_DIR, 'mirror.png') }).catch(() => page.screenshot({ path: resolve(LOG_DIR, 'mirror.png'), fullPage: true }));

  const titles3 = () => page.evaluate(() => { const u = v => (typeof v === 'function' ? v() : v); return u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks().slice(0, 3).map(t => u(t.name)); });
  const trackCount = () => page.evaluate(() => { const u = v => (typeof v === 'function' ? v() : v); return u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks().length; });

  // Apply confident on the clean model, then verify resolution
  await page.locator('#tc-mconf').click();
  await page.waitForTimeout(900);
  const resolved = await page.evaluate(() => { const tl = window.__trackCannon.readTracklist(); const slots = tl.reduce((n, t) => n + t.names.length, 0); const res = tl.reduce((n, t) => n + t.names.filter(x => x.artistGid).length, 0); return { slots, res }; });

  // exercise model-backed ops via the actual UI buttons (which rebuild the mirror)
  const before = await titles3();
  await page.locator('.tc-mirror tbody tr').first().locator('.dn').click();   // move row 1 down
  await page.waitForSelector('.tc-mirror tbody tr', { timeout: 30000 });
  await page.waitForTimeout(400);
  const afterMove = await titles3();
  const countBefore = await trackCount();
  await page.locator('.tc-mirror tbody tr').last().locator('.rm').click();     // remove last row
  await page.waitForTimeout(600);
  const countAfter = await trackCount();
  const ops = { before, afterMove, countBefore, countAfter };
  await page.locator('#tc-mirror-wrap').screenshot({ path: resolve(LOG_DIR, 'mirror-after-ops.png') }).catch(() => {});

  await writeFile(resolve(LOG_DIR, 'console.log'), cons.join('\n'));
  await writeFile(resolve(LOG_DIR, 'ops.json'), JSON.stringify({ ops, resolved, nativeHidden }, null, 2));
  log('native table hidden:', nativeHidden);
  log('after Apply confident — resolved slots:', resolved.res + '/' + resolved.slots);
  log('move 1↓ (UI ▼) — before:', ops.before.join(' | '), '→ after:', ops.afterMove.join(' | '));
  log('remove last (UI ✕) — count:', ops.countBefore, '→', ops.countAfter);
  log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
