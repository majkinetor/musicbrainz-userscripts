// #156 — toggling the proxied "Keep uppercased" guess-case checkbox must actually change guessing.
// Drives the real Apollo tools UI on a seeded release/add: picks the Guess case tool, sets a track
// title with all-caps words, then toggles the proxy checkbox and checks the computed guessTitle flips.
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
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
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
await page.waitForTimeout(800);

// show the tracks mirror table, set a caps-y title on track 0, pick the Guess case tool
await page.evaluate(() => {
  const A = window.__apolloEditor;
  const t = window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[0];
  t.name('the QUICK BROWN fox ABC');
  A.showMirror();
});
await page.waitForSelector('#tc-body .tc-row, #tc-panel .tc-row, .tc-tbl .tc-row', { timeout: 20000 }).catch(() => {});

// open the tools menu and pick "Guess case" (drive clicks programmatically — the bar may be off-canvas)
await page.evaluate(() => { const b = document.querySelector('[data-act="menu"]'); if (b) b.click(); });
await page.waitForFunction(() => !!document.querySelector('#tc-menu .tc-mi[data-act="guesscase"]'), null, { timeout: 5000 });
await page.evaluate(() => document.querySelector('#tc-menu .tc-mi[data-act="guesscase"]').click());
await page.waitForFunction(() => !!document.querySelector('.tc-toolopts .tc-gco label input[type=checkbox]'), null, { timeout: 5000 });

const read = () => page.evaluate(() => {
  const A = window.__apolloEditor;
  const t = A.model.tracks.find(x => x.title === 'the QUICK BROWN fox ABC' || /QUICK BROWN/.test(x.title || ''));
  const box = document.querySelector('.tc-toolopts .tc-gco');
  const chk = box ? box.querySelector('label input[type=checkbox]') : null;     // first = Keep uppercased
  const cookie = (() => { const m = document.cookie.match(/guesscase_keepuppercase=([^;]*)/); return m ? m[1] : null; })();
  return { guess: t ? t.guessTitle : null, checked: chk ? chk.checked : null, cookie };
});

const toggle = () => page.evaluate(() => document.querySelector('.tc-toolopts .tc-gco label input[type=checkbox]').click());
const before = await read();
await toggle(); await page.waitForTimeout(300);   // turn Keep uppercased OFF
const afterOff = await read();
await toggle(); await page.waitForTimeout(300);   // back ON
const afterOn = await read();

console.log(JSON.stringify({ before, afterOff, afterOn }, null, 2));
const pass =
  before.checked === true && before.cookie === 'true' && /QUICK BROWN/.test(before.guess) &&
  afterOff.checked === false && afterOff.cookie === 'false' && /Quick Brown/.test(afterOff.guess) &&
  afterOn.checked === true && afterOn.cookie === 'true' && afterOn.guess === before.guess;
console.log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
