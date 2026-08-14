// #501 (majkinetor): Art Station's whole settings blob (artstation:settings) and
// log-window UI state (artstation:logwin) move from localStorage to GM storage —
// covered by a script manager's own backup/restore and cross-browser sync,
// unlike localStorage. One-time migration on load: an old localStorage value is
// adopted into GM storage if GM storage is empty, and left in place (unused)
// rather than deleted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/art_station/art_station.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });

// pre-existing localStorage settings (the pre-#501 world), no GM value yet: the
// script migrates it into GM storage on load; localStorage's copy is untouched.
{
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.__gmStore = store;
    window.GM_info = { script: { name: 'Art Station', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/release/bafa58c1-e9b3-4ed3-b42d-70a387e411f4/add-cover-art', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.evaluate(() => {
    // (deliberately not showOrig:true — that legitimately hides #as-root in favor
    // of MB's native page, which would fight this test's own assertions below)
    localStorage.setItem('artstation:settings', JSON.stringify({ tile: 333, hideMbFooter: false, sort: 'name' }));
    localStorage.setItem('artstation:logwin', JSON.stringify({ open: true, x: 55 }));
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#as-root', { timeout: 15000 });
  await page.waitForTimeout(300);

  const migrated = await page.evaluate(() => {
    const gmSettings = JSON.parse(window.__gmStore.get('artstation:settings') || 'null');
    const lsStillThere = localStorage.getItem('artstation:settings') !== null;
    return { gmSettings, lsStillThere };
  });
  console.log('migration result:', JSON.stringify(migrated));
  ck(migrated.gmSettings && migrated.gmSettings.tile === 333 && migrated.gmSettings.hideMbFooter === false && migrated.gmSettings.sort === 'name', `the old localStorage settings were adopted into GM storage on load, incl. the document-start early-read path (got ${JSON.stringify(migrated.gmSettings)})`);
  ck(migrated.lsStillThere, 'the old localStorage key is left in place (non-destructive), just no longer read from');
  ck(errs.length === 0, 'no page errors during migration: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// GM storage already has a value: it wins outright over a differing localStorage
// value, exercised through the actual settings UI (not just the raw functions).
{
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    store.set('artstation:settings', JSON.stringify({ tile: 250, sort: 'type' }));
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.__gmStore = store;
    window.GM_info = { script: { name: 'Art Station', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/release/bafa58c1-e9b3-4ed3-b42d-70a387e411f4/add-cover-art', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('artstation:settings', JSON.stringify({ tile: 999, sort: 'name' })));
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#as-root', { timeout: 15000 });
  await page.waitForTimeout(300);
  const stillGm = await page.evaluate(() => JSON.parse(window.__gmStore.get('artstation:settings')));
  console.log('GM-wins state:', JSON.stringify(stillGm));
  ck(stillGm.tile === 250, `an existing GM value wins outright over a differing localStorage value (got tile=${stillGm.tile}, expected 250 not 999)`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
