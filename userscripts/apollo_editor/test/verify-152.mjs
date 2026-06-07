// #152 — Search & Replace: RE (regex + $N) toggle and named Templates (save/load/remove, _Last).
// Drives the real S&R tool UI on a seeded release.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');

if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
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
// start from a clean template store
await page.addInitScript(() => { try { const k = Object.keys(localStorage).find(x => /apollo|track-?cannon|tc-/i.test(x)); } catch {} });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(700);
await page.evaluate(() => { localStorage.removeItem('apolloEditor.settings.v1'); });
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__apolloEditor.showMirror());
await page.waitForFunction(() => { const r = document.querySelector('.tc-mirror tbody tr .t-title'); return r && r.offsetParent !== null; }, null, { timeout: 20000 });

// set a deterministic title on the first track, then open the S&R tool (snapshots current titles)
await page.evaluate(() => {
  const inp = document.querySelector('.tc-mirror tbody tr .t-title');
  inp.value = 'Artist - Song'; inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.evaluate(() => { const b = document.querySelector('[data-act="menu"]'); if (b) b.click(); });
await page.waitForFunction(() => !!document.querySelector('#tc-menu .tc-mi[data-act="sr"]'), null, { timeout: 5000 });
await page.evaluate(() => document.querySelector('#tc-menu .tc-mi[data-act="sr"]').click());
await page.waitForFunction(() => !!document.querySelector('.tc-toolopts .tc-sr-find'), null, { timeout: 5000 });

const t0 = () => page.evaluate(() => window.__apolloEditor.model.tracks[0].title);
const setFR = (f, r) => page.evaluate(({ f, r }) => {
  const fi = document.querySelector('.tc-sr-find'), re = document.querySelector('.tc-sr-rep');
  fi.value = f; fi.dispatchEvent(new Event('input', { bubbles: true }));
  re.value = r; re.dispatchEvent(new Event('input', { bubbles: true }));
}, { f, r });
const reOn = () => page.evaluate(() => document.querySelector('.tc-sr-re').classList.contains('on'));
const toggleRE = () => page.evaluate(() => document.querySelector('.tc-sr-re').click());

const R = {};

// (1) literal mode: "$1" in replace is literal, not a backref
await setFR('Song', '$1'); await page.waitForTimeout(120);
R.literalDollar = await t0();           // expect "Artist - $1"

// (2) regex mode with $N
if (!await reOn()) await toggleRE(); await page.waitForTimeout(80);
await setFR('^(.+?) - (.+)$', '$2 ($1)'); await page.waitForTimeout(150);
R.regexBackref = await t0();            // expect "Song (Artist)"

// (3) invalid regex → field flagged, no throw, title unchanged from prior valid state
await setFR('(', 'x'); await page.waitForTimeout(150);
R.invalidFlagged = await page.evaluate(() => document.querySelector('.tc-sr-find').classList.contains('tc-sr-bad'));
R.invalidTitle = await t0();

// (4) Templates: save the current (regex) pattern as "Spotify ETI"
await setFR('^(.+?) - (.+)$', '$2 ($1)'); await page.waitForTimeout(120);
await page.evaluate(() => document.querySelector('.tc-sr-tpl').click());
await page.waitForSelector('.tc-srtpl', { timeout: 5000 });
await page.evaluate(() => { const n = document.querySelector('.tc-srtpl-name'); n.value = 'Spotify ETI'; n.dispatchEvent(new Event('input', { bubbles: true })); });
await page.evaluate(() => { const n = document.querySelector('.tc-srtpl-name'); n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
await page.waitForTimeout(150);
R.savedTemplates = await page.evaluate(() => (window.__apolloEditor.settings.srTemplates || []).map(t => ({ name: t.name, find: t.find, replace: t.replace, re: t.re })));

// (5) load: clear fields, click the saved row, expect fields + RE restored and applied
await setFR('', ''); await toggleRE(); await page.waitForTimeout(100);   // RE off + empty
await page.evaluate(() => { const r = [...document.querySelectorAll('.tc-srtpl-row')].find(x => x.querySelector('.tc-srtpl-nm') && x.querySelector('.tc-srtpl-nm').textContent === 'Spotify ETI'); if (r) r.click(); });
await page.waitForTimeout(200);
R.afterLoad = { find: await page.evaluate(() => document.querySelector('.tc-sr-find').value), rep: await page.evaluate(() => document.querySelector('.tc-sr-rep').value), re: await reOn(), title: await t0() };

// (6) _Last exists and sorts first; remove "Spotify ETI"
await page.evaluate(() => document.querySelector('.tc-sr-tpl').click());
await page.waitForSelector('.tc-srtpl', { timeout: 5000 });
R.namesSorted = await page.evaluate(() => [...document.querySelectorAll('.tc-srtpl-row:not(.tc-srtpl-cap) .tc-srtpl-nm')].map(s => s.textContent));
await page.evaluate(() => { const r = [...document.querySelectorAll('.tc-srtpl-row')].find(x => { const n = x.querySelector('.tc-srtpl-nm'); return n && n.textContent === 'Spotify ETI'; }); if (r) r.querySelector('.tc-srtpl-x').click(); });
await page.waitForTimeout(120);
R.afterRemove = await page.evaluate(() => (window.__apolloEditor.settings.srTemplates || []).map(t => t.name));

console.log(JSON.stringify(R, null, 2));
const pass =
  R.literalDollar === 'Artist - $1' &&
  R.regexBackref === 'Song (Artist)' &&
  R.invalidFlagged === true && R.invalidTitle === 'Song (Artist)' &&
  R.savedTemplates.some(t => t.name === 'Spotify ETI' && t.re === true && t.find === '^(.+?) - (.+)$') &&
  R.savedTemplates.some(t => t.name === '_Last') &&
  R.afterLoad.find === '^(.+?) - (.+)$' && R.afterLoad.re === true && R.afterLoad.title === 'Song (Artist)' &&
  R.namesSorted[0] === '_Last' &&
  !R.afterRemove.includes('Spotify ETI');
console.log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
