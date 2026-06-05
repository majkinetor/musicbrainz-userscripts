// Screenshot proof: Apollo Editor (Canon mode) with MB medium warnings VISIBLE above the table.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
const OUT = resolve(HERE, 'logs', 'apollo-warning.png');

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(resolve(HERE, 'logs'), { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
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
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
  // also trigger the Digital-Media / packaging warning for a second, distinct warning box
  await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const rel = window.MB.releaseEditor.rootField.release();
    try { rel.packaging(1); } catch (e) {}
    const med = u(rel.mediums)[0];
    [['formatID', 12], ['format', 12]].forEach(([k, v]) => { try { if (typeof med[k] === 'function') med[k](v); } catch (e) {} });
  });
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForSelector('.tc-medsec .tc-mirror tbody tr', { timeout: 60000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const ws = [...document.querySelectorAll('fieldset.advanced-medium .warning')].filter(w => getComputedStyle(w).display !== 'none' && (w.textContent || '').trim());
    return { visible: ws.length, texts: ws.map(w => (w.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)) };
  });
  console.log('[shot] visible medium warnings:', info.visible);
  info.texts.forEach(t => console.log('   •', t));

  const fs = page.locator('fieldset.advanced-medium').first();
  await fs.screenshot({ path: OUT }).catch(async () => { await page.screenshot({ path: OUT }); });
  console.log('[shot] saved', OUT);
  await ctx.close();
  if (!info.visible) process.exit(4);
}
main().catch(e => { console.error(e); process.exit(1); });
