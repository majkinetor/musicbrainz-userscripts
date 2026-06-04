// #119 P1 (in-page comparison): inject Apollo, go to Recordings tab, assert the native table is
// taken over by the Apollo comparison table (track vs recording: title/artist/len + confidence +
// diff highlight), and that the shared Original/Apollo toggle flips between the two views.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'b2b6dc32-77a3-4a89-8af0-99d4b6f1a9ad';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', 'rec-p1b-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(`${e.name}: ${e.message}`));
await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums()[0].tracks().length; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT_PATH, 'utf8') });
await page.waitForFunction(() => !!window.__trackCannon, null, { timeout: 15000 });
await page.locator('a, button, li', { hasText: /^Recordings$/ }).first().click().catch(() => {});
await page.waitForSelector('#tc-recwrap .tc-rectbl tbody tr', { timeout: 15000 });
await page.waitForTimeout(500);

const taken = await page.evaluate(() => {
  const rows = window.__trackCannon.readRecordings();
  const wrap = document.getElementById('tc-recwrap');
  const native = document.getElementById('track-recording-assignation');
  const trs = [...wrap.querySelectorAll('.tc-rectbl tbody tr.tc-recrow')];
  const headers = [...wrap.querySelectorAll('.tc-rectbl thead th')].map(t => t.textContent.trim());
  return {
    apolloShown: !!wrap, nativeHidden: native ? native.style.display === 'none' : 'no-native',
    launcher: (document.getElementById('tc-launch') || {}).textContent,
    headers, domRows: trs.length, modelRows: rows.length,
    hasTrackArtist: rows.every(r => 'trackArtist' in r), hasRecArtist: rows.some(r => r.recArtist),
    confBreakdown: rows.reduce((m, r) => { const k = r.conf ? r.conf.level : (r.recGid ? 'perfect' : 'none'); m[k] = (m[k] || 0) + 1; return m; }, {}),
    diffCells: wrap.querySelectorAll('td.tc-diff').length,
    firstRow: rows[0] ? { n: rows[0].number, t: rows[0].title, ta: rows[0].trackArtist, tl: rows[0].trackLen, rn: rows[0].recName, ra: rows[0].recArtist, rl: rows[0].recLen } : null,
  };
});
await page.locator('#tc-recwrap').screenshot({ path: resolve(LOG_DIR, 'rec-inpage.png') }).catch(() => {});

// toggle to Original → native table back, apollo gone
await page.click('#tc-launch');
await page.waitForTimeout(400);
const toOriginal = await page.evaluate(() => ({
  apolloGone: !document.getElementById('tc-recwrap'),
  nativeVisible: (() => { const n = document.getElementById('track-recording-assignation'); return n ? n.style.display !== 'none' : false; })(),
  launcher: (document.getElementById('tc-launch') || {}).textContent,
}));
// toggle back to Apollo
await page.click('#tc-launch');
await page.waitForTimeout(400);
const backToApollo = await page.evaluate(() => ({
  apolloShown: !!document.getElementById('tc-recwrap'),
  nativeHidden: (() => { const n = document.getElementById('track-recording-assignation'); return n ? n.style.display === 'none' : false; })(),
  launcher: (document.getElementById('tc-launch') || {}).textContent,
}));
await ctx.close();
console.log(JSON.stringify({ taken, toOriginal, backToApollo }, null, 2));
console.log('pageerrors:', errs.length ? errs : 'none');
const pass = taken.apolloShown && taken.nativeHidden === true && taken.domRows === taken.modelRows && taken.hasRecArtist
  && taken.headers.includes('Artist') && taken.launcher === 'Original'
  && toOriginal.apolloGone && toOriginal.nativeVisible && toOriginal.launcher === 'Apollo Editor'
  && backToApollo.apolloShown && backToApollo.nativeHidden && backToApollo.launcher === 'Original'
  && errs.length === 0;
console.log('screenshot:', resolve(LOG_DIR, 'rec-inpage.png'));
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
