// showcase screenshot: fill a representative annotation, open Preview, capture the toolbar+pane.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
const seed = JSON.parse(await readFile(resolve(HERE, 'seed-saigon.local.json'), 'utf8'));
const scriptCode = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1100, height: 1300 }, deviceScaleFactor: 3 });
ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(({ origin, params }) => { const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none'; const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); }; for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v); document.body.appendChild(f); f.submit(); }, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) { await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click(); await page.waitForLoadState('domcontentloaded'); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 20000 });
// capture the whole "Additional information" section (empty) — Disambiguation above, both full width
{ const fs = await page.$('#annotation'); const b = await page.evaluate(() => { const f = document.querySelector('#information fieldset.information'); const r = f.getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 30), width: Math.min(r.width + 16, 1180), height: Math.min(r.height + 50, 560) }; }); await page.evaluate(y => window.scrollTo(0, y), b.y); const b2 = await page.evaluate(() => { const f = document.querySelector('#information fieldset.information'); const r = f.getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 34), width: Math.min(r.width + 16, 1180), height: Math.min(r.height + 50, 560) }; }); await page.screenshot({ path: resolve(HERE, 'logs', 'shot-annotation-layout.png'), clip: b2 }); }
// the default surface is Markdown — type Markdown (incl. a nested bullet)
await page.fill('#tc-anno-mdinput', [
  '## Release notes',
  '',
  'This is a **special** edition with *bonus* tracks, mastered by [Bob Ludwig](https://musicbrainz.org/artist/x).',
  '',
  '- Disc 1: the original album',
  '- Disc 2: bonus material',
  '  - bonus track A',
  '  - bonus track B',
  '',
  'More info at https://example.com/release-info',
  '',
  '---',
  '',
  'Catalogue number: ABC-123',
].join('\n'));
const clip = async () => { const b = await page.$eval('#tc-anno-wrap', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 30)), b.y); const b2 = await page.$eval('#tc-anno-wrap', e => { const r = e.getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(r.width + 16, 1090), height: r.height + 16 }; }); return b2; };
// edit view (toolbar + bigger textarea holding MB markup)
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(HERE, 'logs', 'shot-annotation-edit.png'), clip: await clip() });
// preview view (swaps in place)
await page.click('#tc-anno-preview-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(HERE, 'logs', 'shot-annotation-preview.png'), clip: await clip() });
console.log('saved edit + preview shots');
await ctx.close();
