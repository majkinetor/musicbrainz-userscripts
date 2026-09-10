// chaban-mb's footnote on #586: "This might have been preexisting… it also
// affects the pregap track feature. The latter can lead to data loss when first
// checking pregap, then 'revert all', then unchecking pregap -> first track
// deleted."
//
// The mechanism to test: ORIGINALS is keyed by "medium:index". Adding a pregap
// inserts a track at index 0, so every later track shifts down one — and a
// revert then writes each snapshot onto the WRONG track. Verify before asserting
// anything to majkinetor.
//
// Model-only; write endpoints are blocked and nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('dialog', d => d.accept());          // revertAll asks for confirmation
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => r.abort());
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('tracklist'));
  if (b) b.click();
});
await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(1500);

const titles = tag => page.evaluate(t => {
  const m = window.MB.releaseEditor.rootField.release().mediums()[0];
  return { tag: t, n: m.tracks().length, titles: m.tracks().map(x => (x.name() || '(blank)')) };
}, tag);

const show = o => console.log(`\n══ ${o.tag} (${o.n} tracks)\n` + o.titles.map((t, i) => `   [${i}] ${t}`).join('\n'));

const a = await titles('baseline');
show(a);

// 1 · turn on the pregap (MB inserts a blank track at position 0)
await page.evaluate(() => {
  const cb = [...document.querySelectorAll('.tc-medopt')].find(l => /Pregap/.test(l.textContent)).querySelector('input');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(2000);
const b = await titles('after Pregap on');
show(b);

// 2 · Revert all
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#tc-bar [data-act], .tc-mini-item')].find(x => /Revert all/i.test(x.textContent || ''));
  if (btn) { btn.click(); return 'clicked menu item'; }
  return 'menu item not found — calling revertAll directly';
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  // the menu route is fiddly to drive; go straight at the exported behaviour
  const A = window.__apolloEditor;
  if (A.revertAll) A.revertAll();
});
await page.waitForTimeout(2500);
const c = await titles('after Revert all');
show(c);

// 3 · turn the pregap back off (MB removes the position-0 track)
await page.evaluate(() => {
  const cb = [...document.querySelectorAll('.tc-medopt')].find(l => /Pregap/.test(l.textContent)).querySelector('input');
  cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(2000);
const d = await titles('after Pregap off');
show(d);

console.log('\n══ VERDICT');
const same = JSON.stringify(a.titles) === JSON.stringify(d.titles);
console.log(same ? 'round-trip is CLEAN — titles match the baseline'
                 : 'ROUND-TRIP LOST DATA — titles differ from the baseline');
if (!same) a.titles.forEach((t, i) => { if (t !== d.titles[i]) console.log(`   [${i}] "${t}"  →  "${d.titles[i]}"`); });
console.log('page errors:', errs.slice(0, 3));
await ctx.close();
