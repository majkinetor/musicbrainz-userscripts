// #616 (majkinetor): "Tracks not visible 10s after expanding medium" — on a release
// with many collapsed media (his: 14), expanding one showed its tracks only ~10s
// later. The recording auto-match waited (up to 15s) for EVERY medium to load, and
// collapsed media never load on their own; meanwhile the tracklist resync was held
// back for it.
//
// Opens his release's editor on production MusicBrainz — READ-ONLY: nothing is
// submitted, no request routing (a catch-all route breaks prod MB) — enters the
// Tracklist tab, expands collapsed media the way Apollo's expand arrow does
// (medium.loadTracks), and times how long each takes to show up in Apollo's table.
// APOLLO_SRC=<old build> for the before number.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = 'ade2956c-8d7e-4ab3-b359-b55b5ef603e9';   // Fever 109 — Broken City: 14 one-track media
const BUDGET = 3000;   // ms from expand to rows on screen
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
// majkinetor runs with "auto-match recordings" ON — that pass is what held the resync (default is off)
await ctx.addInitScript(() => { const s = new Map([['apolloEditor.settings.v1', JSON.stringify({ autoMatchRec: true })]]); window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_info = { script: { name: 'Apollo Editor', version: 't' } }; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: code });
await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Tracklist'); if (a) a.click(); });
await page.waitForSelector('.tc-mirror', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(1200);   // the recording auto-match has started its wait by now
const state = () => page.evaluate(() => ({ rows: document.querySelectorAll('.tc-mirror tbody tr').length, loaded: MB.releaseEditor.rootField.release().mediums().filter(m => m.loaded()).length, total: MB.releaseEditor.rootField.release().mediums().length }));
const s0 = await state();
console.log('before expanding:', JSON.stringify(s0));
ck(s0.total > 3 && s0.loaded < s0.total, `release has collapsed media (${s0.loaded}/${s0.total} loaded)`);

async function expandAndTime(indexes, label) {
  const before = (await state()).rows;
  const t0 = Date.now();
  await page.evaluate(ix => { const ms = MB.releaseEditor.rootField.release().mediums(); ix.forEach(i => ms[i] && !ms[i].loaded() && ms[i].loadTracks()); }, indexes);
  let loadedAt = null, shownAt = null, firstShownAt = null, firstLoadedAt = null;
  for (let i = 0; i < 250 && shownAt == null; i++) {
    const s = await state();
    if (loadedAt == null && await page.evaluate(ix => ix.every(i => MB.releaseEditor.rootField.release().mediums()[i].loaded()), indexes)) loadedAt = Date.now() - t0;
    if (firstLoadedAt == null && s.loaded > (await Promise.resolve(0)) && await page.evaluate(ix => ix.some(i => MB.releaseEditor.rootField.release().mediums()[i].loaded()), indexes)) firstLoadedAt = Date.now() - t0;
    if (firstShownAt == null && s.rows > before) firstShownAt = Date.now() - t0;
    if (s.rows >= before + indexes.length) shownAt = Date.now() - t0;
    else await page.waitForTimeout(100);
  }
  console.log(`${label}: MB had the first after ${firstLoadedAt}ms / all after ${loadedAt}ms; Apollo showed the first after ${firstShownAt}ms / all after ${shownAt}ms`);
  return { loadedAt, shownAt, firstShownAt, firstLoadedAt };
}
const one = await expandAndTime([1], 'expand medium 2');
ck(one.shownAt != null && one.shownAt < BUDGET, `one medium: tracks on screen within ${BUDGET}ms of expanding (${one.shownAt}ms)`);
const rest = await page.evaluate(() => MB.releaseEditor.rootField.release().mediums().map((m, i) => m.loaded() ? -1 : i).filter(i => i >= 0));
const all = await expandAndTime(rest, `expand all ${rest.length} remaining`);
ck(all.firstShownAt != null && all.firstShownAt - (all.firstLoadedAt || 0) < BUDGET, `expand all: the first medium shows within ${BUDGET}ms of MB loading it, not after all of them (${all.firstShownAt}ms vs ${all.firstLoadedAt}ms)`);
ck(all.shownAt != null && all.shownAt - (all.loadedAt || 0) < BUDGET, `expand all: tracks on screen within ${BUDGET}ms of MB loading them (${all.shownAt}ms total, ${all.loadedAt}ms to load)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
