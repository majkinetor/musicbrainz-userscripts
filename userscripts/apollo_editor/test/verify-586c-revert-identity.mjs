// chaban-mb on #586, two reports:
//
//   1. "Revert all function seems to not affect data tracks"
//   2. footnote: "…it also affects the pregap track feature. The latter can lead
//      to data loss when first checking pregap, then 'revert all', then
//      unchecking pregap -> first track deleted"
//
// The second one is the serious one and it is NOT about data tracks at all. The
// page-load snapshot was keyed by "medium:INDEX". Ticking Pregap makes MB insert
// a track at index 0, so every later track shifts down one; "Revert all" then
// writes each snapshot onto the track BELOW the one it came from, and unticking
// Pregap deletes what is now index 0. The tracklist comes back shifted by one,
// the first track gone and the last duplicated — silently.
//
// Measured before it was asserted (probe-586f-pregap-revert.mjs), on the exact
// sequence he described. The snapshot is now keyed by MB's per-track `uniqueID`,
// which survives inserts and exists on new tracks too.
//
// Nothing is submitted; the model is restored at the end and the page discarded.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

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
page.on('dialog', d => d.accept());          // Revert all confirms first
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });
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

const snap = () => page.evaluate(() => {
  const m = window.MB.releaseEditor.rootField.release().mediums()[0];
  return {
    n: m.tracks().length,
    titles: m.tracks().map(t => t.name() || '(blank)'),
    flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
  };
});
const pregap = on => page.evaluate(v => {
  const cb = [...document.querySelectorAll('.tc-medopt')].find(l => /Pregap/.test(l.textContent)).querySelector('input');
  cb.checked = v; cb.dispatchEvent(new Event('change', { bubbles: true }));
}, on);
const revertAll = () => page.evaluate(() => window.__apolloEditor.revertAll());

const base = await snap();
console.log('baseline:', JSON.stringify(base));
ck(base.n > 3, `fixture loaded (${base.n} tracks)`);

/* ── his footnote: pregap → revert all → pregap off ─────────────────────── */
await pregap(true);   await page.waitForTimeout(2000);
const withPregap = await snap();
ck(withPregap.n === base.n + 1 && withPregap.titles[0] === '(blank)', `Pregap inserted a blank track at index 0 (${withPregap.n} tracks)`);
await revertAll();    await page.waitForTimeout(2500);
const reverted = await snap();
console.log('after Revert all:', JSON.stringify(reverted.titles));
ck(reverted.titles[0] === '(blank)', 'Revert all left the pregap track blank instead of writing track 1 onto it');
ck(JSON.stringify(reverted.titles.slice(1)) === JSON.stringify(base.titles),
  'Revert all wrote every snapshot back onto the track it came from, not the one below it');
await pregap(false);  await page.waitForTimeout(2000);
const back = await snap();
console.log('after Pregap off:', JSON.stringify(back.titles));
ck(JSON.stringify(back.titles) === JSON.stringify(base.titles),
  `the round trip is lossless — no track deleted, none duplicated (${back.n} tracks)`);

/* ── his first report: Revert all and the data-track boundary ───────────── */
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
  tr.querySelector('.tc-dtmv.down').click();
});
await page.waitForTimeout(1200);
const opened = await snap();
ck(opened.flags.includes('D'), `a data section was opened for the test (${opened.flags})`);
await revertAll();  await page.waitForTimeout(2500);
const closed = await snap();
console.log('after Revert all with a data section open:', JSON.stringify(closed.flags));
ck(closed.flags === base.flags, `Revert all put the data-track boundary back too (${closed.flags} vs ${base.flags})`);
ck(JSON.stringify(closed.titles) === JSON.stringify(base.titles), 'and the titles are still intact');

ck(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
