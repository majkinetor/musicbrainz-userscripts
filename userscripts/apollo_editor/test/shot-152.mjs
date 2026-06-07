// #152 — screenshot the S&R RE/Templates buttons and the Templates popup (with _Last + a saved entry).
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const OUT = resolve(HERE, 'logs', 'shots'); await mkdir(OUT, { recursive: true });

if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
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
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(700);
// seed a couple of templates so the popup has content
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('apolloEditor.settings.v1') || '{}');
  s.srTemplates = [
    { name: '_Last', find: '\\s+\\(live\\)$', replace: '', re: true },
    { name: 'Spotify ETI', find: '(?<title>.+?)(?:\\s+?[\\u2010-\\u2014~/-])(?![^(]*\\)) (?<dash>.*)', replace: '$1 ($2)', re: true },
    { name: 'strip brackets', find: '[\\[\\]]', replace: '', re: true },
  ];
  s.srRegex = true;
  localStorage.setItem('apolloEditor.settings.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(700);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__apolloEditor.showMirror());
await page.waitForFunction(() => !!document.querySelector('[data-act="menu"]'), null, { timeout: 20000 });
await page.evaluate(() => { document.querySelector('[data-act="menu"]').click(); });
await page.waitForFunction(() => !!document.querySelector('#tc-menu .tc-mi[data-act="sr"]'), null, { timeout: 5000 });
await page.evaluate(() => document.querySelector('#tc-menu .tc-mi[data-act="sr"]').click());
await page.waitForFunction(() => !!document.querySelector('.tc-sr-find'), null, { timeout: 5000 });
await page.evaluate(() => { const f = document.querySelector('.tc-sr-find'); f.value = '\\s+\\(live\\)$'; f.dispatchEvent(new Event('input', { bubbles: true })); });

// shot 1: the toolbar with find/replace + RE (on) + Templates
await page.locator('#tc-bar').screenshot({ path: resolve(OUT, 'i152-bar.png') }).catch(() => {});
// open the templates popup and shot it
await page.evaluate(() => document.querySelector('.tc-sr-tpl').click());
await page.waitForSelector('.tc-srtpl', { timeout: 5000 });
await page.waitForTimeout(200);
await page.locator('.tc-srtpl').screenshot({ path: resolve(OUT, 'i152-templates.png') }).catch(() => {});
console.log('shots ->', OUT);
await ctx.close();
