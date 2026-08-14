// #501 (majkinetor): Bandcamp Player Enhanced's settings (bcp_hide_opts, bcp_theme,
// bcp_scale, bcp_preload, and the localStorage side of bcp_volume/bcp_muted — the
// sessionStorage side stays, it's genuinely tab-scoped) move from localStorage to
// GM storage. This also took the script out of `@grant none` (it now declares
// unsafeWindow + GM_getValue/GM_setValue), so `window.TralbumData` — a page global
// Bandcamp's own inline script attaches — had to move to `pageWindow.TralbumData`
// (via unsafeWindow) to keep working once the script is no longer running in the
// page's own unwrapped context. This test proves both: the migration shim, and
// that TralbumData is still readable.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/bandcamp_player_enhanced/bandcamp_player_enhanced.user.js', 'utf8');

const ALBUM_URL = 'https://phoebebridgers.bandcamp.com/album/punisher';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: true });

// --- 1. old-world localStorage settings, no GM value yet: migrated into GM
//        storage on load, old key left in place. ---
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.__gmStore = store;
    window.GM_info = { script: { name: 'Bandcamp Player Enhanced', version: 't' } };
  });
  await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('bcp_theme', 'dark');
    localStorage.setItem('bcp_scale', '85');
    localStorage.setItem('bcp_hide_opts', JSON.stringify({ player: true, tracklist: true, tags: false }));
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  await page.waitForTimeout(500);

  const migrated = await page.evaluate(() => ({
    theme: window.__gmStore.get('bcp_theme'),
    scale: window.__gmStore.get('bcp_scale'),
    hideOpts: JSON.parse(window.__gmStore.get('bcp_hide_opts') || 'null'),
    lsThemeStillThere: localStorage.getItem('bcp_theme') !== null,
  }));
  console.log('migration result:', JSON.stringify(migrated));
  ck(migrated.theme === 'dark', `bcp_theme migrated into GM storage (got "${migrated.theme}")`);
  ck(migrated.scale === '85', `bcp_scale migrated into GM storage (got "${migrated.scale}")`);
  ck(migrated.hideOpts && migrated.hideOpts.tracklist === true, `bcp_hide_opts migrated into GM storage (got ${JSON.stringify(migrated.hideOpts)})`);
  ck(migrated.lsThemeStillThere, 'the old localStorage key is left in place (non-destructive)');
  const realErrs1 = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
  ck(realErrs1.length === 0, 'no unexpected page errors during migration: ' + JSON.stringify(realErrs1.slice(0, 3)));

  const barBg = await page.evaluate(() => getComputedStyle(document.getElementById('bc-sticky-player')).backgroundColor);
  ck(barBg === 'rgb(20, 20, 20)', `the migrated theme actually applied (dark bar background, got ${barBg})`);

  await ctx.close();
}

// --- 2. TralbumData is still readable via pageWindow/unsafeWindow now that the
//        script carries real @grant entries (no longer @grant none). ---
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Bandcamp Player Enhanced', version: 't' } };
  });
  await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => document.getElementById('bcp-title')?.textContent || '');
  console.log('artist/album title:', info);
  ck(info.length > 0 && info !== '—' && !/undefined/i.test(info), `artist/album title (read from TralbumData via pageWindow) rendered, not the "—" placeholder (got "${info}")`);
  const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
  ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));

  await ctx.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
