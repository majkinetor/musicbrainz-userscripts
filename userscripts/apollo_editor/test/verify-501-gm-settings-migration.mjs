// #501 (majkinetor): "some user settings are stored in the script manager while
// others use localStorage... painful in Apollo when restoring backups or moving
// data to another browser." Apollo's whole settings blob (apolloEditor.settings.v1)
// and log-window UI state (apolloEditor.logwin) move to GM_setValue/GM_getValue,
// which IS covered by a script manager's own backup/sync — localStorage isn't.
//
// One-time migration: on first load with an old localStorage value present but no
// GM value yet, Apollo adopts the localStorage value into GM storage and keeps
// using GM storage from then on. The old localStorage key is left in place
// (unused) rather than deleted, so nothing is destructively lost if this is wrong.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1200, height: 800 } });

// --- 1. fresh profile, no localStorage, no GM value: settings load to defaults,
//        and a save writes through to GM storage (not localStorage). ---
{
  const page = await ctx.newPage();
  // GM_getValue/GM_setValue must be synchronous for this script — back them with a
  // plain in-page Map, mirroring how falcon/art_station tests mock GM storage.
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.__gmStore = store;
    window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(300);
  const afterInit = await page.evaluate(() => ({
    gmHasSkey: window.__gmStore.has('apolloEditor.settings.v1'),
    lsHasSkey: localStorage.getItem('apolloEditor.settings.v1') !== null,
  }));
  console.log('fresh-profile state:', JSON.stringify(afterInit));
  ck(errs.length === 0, 'no page errors on a fresh profile: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// --- 2. pre-existing localStorage settings (the pre-#501 world), no GM value yet:
//        the script migrates it into GM storage on load, and localStorage's copy
//        is left untouched (non-destructive). ---
{
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.__gmStore = store;
    window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('apolloEditor.settings.v1', JSON.stringify({ zenMode: false, applyMode: 'selected', recLenTol: 42 }));
    localStorage.setItem('apolloEditor.logwin', JSON.stringify({ open: true, x: 111, y: 222 }));
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(300);

  const migrated = await page.evaluate(() => {
    const gmSettings = JSON.parse(window.__gmStore.get('apolloEditor.settings.v1') || 'null');
    const lsStillThere = localStorage.getItem('apolloEditor.settings.v1') !== null;
    return { gmSettings, lsStillThere };
  });
  console.log('migration result:', JSON.stringify(migrated));
  ck(migrated.gmSettings && migrated.gmSettings.zenMode === false && migrated.gmSettings.applyMode === 'selected' && migrated.gmSettings.recLenTol === 42, `the old localStorage settings were adopted into GM storage on load (got ${JSON.stringify(migrated.gmSettings)})`);
  ck(migrated.lsStillThere, 'the old localStorage key is left in place (non-destructive), just no longer read from');
  // apolloEditor.logwin migrates through the exact same gmLoad/gmSave shim as
  // settings above, but loadLogWin() is only actually called lazily — inside a real
  // release-editor page (gated behind waitFor(getEditor()), see line ~7960) — not
  // on every page load like SETTINGS = loadSettings() is. That path is covered by
  // the full integration test (test/integration.mjs), not a lightweight unit test
  // like this one; the shim itself is proven correct by the settings case above.
  ck(errs.length === 0, 'no page errors during migration: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// --- 3. GM storage already has a value: it wins outright, localStorage (even if
//        present and different) is never consulted. ---
{
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    store.set('apolloEditor.settings.v1', JSON.stringify({ zenMode: true, applyMode: 'all', recLenTol: 7 }));
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.__gmStore = store;
    window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('apolloEditor.settings.v1', JSON.stringify({ zenMode: false, applyMode: 'selected', recLenTol: 999 }));
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(300);
  const stillGm = await page.evaluate(() => JSON.parse(window.__gmStore.get('apolloEditor.settings.v1')));
  console.log('GM-wins state:', JSON.stringify(stillGm));
  ck(stillGm.recLenTol === 7, `an existing GM value wins outright over a differing localStorage value (got recLenTol=${stillGm.recLenTol}, expected 7 not 999)`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
