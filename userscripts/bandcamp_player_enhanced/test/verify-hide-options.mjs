// Adds a settings panel to Bandcamp Player Enhanced so each of hidePageElements()'s three
// hide-groups (native player, track list, tags) can be toggled independently via UI instead
// of being unconditionally hardcoded. Native player is hidden by default (the script's own
// bar replaces it); track list and tags default to visible. Verifies checking/unchecking an
// option live (no reload), and that the choice persists across a fresh page load.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'bandcamp_player_enhanced.user.js'), 'utf8');

const ALBUM_URL = 'https://phoebebridgers.bandcamp.com/album/punisher';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// #501: GM_getValue/GM_setValue mock backed by real (namespaced) localStorage —
// unlike an in-page Map, this survives a real page.reload() the same way actual
// GM storage would, which this test's persistence check relies on.
await page.addInitScript(() => {
    window.GM_getValue = (k, d) => { const v = localStorage.getItem('__gm__' + k); return v === null ? d : v; };
    window.GM_setValue = (k, v) => { localStorage.setItem('__gm__' + k, v); };
    window.GM_deleteValue = k => localStorage.removeItem('__gm__' + k);
});

await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);

// 1) default: native player hidden, track list + tags visible
const visibility = async () => page.evaluate(() => {
    const vis = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };
    return { player: vis('#player, .inline_player'), tracklist: vis('.track_list, ol.track_list, table.track_list'), tags: vis('.tralbum-tags, .tags') };
});
const before = await visibility();
console.log('visibility (defaults):', JSON.stringify(before));
ck(before.player === false, `native player is hidden by default (got ${before.player})`);
ck(before.tracklist === true, `track list is visible by default (got ${before.tracklist})`);

// 2) open settings panel, check "Track list" to hide it
await page.click('#bcp-settings');
await page.waitForTimeout(150);
const panelOpen = await page.evaluate(() => document.getElementById('bcp-settings-panel').classList.contains('open'));
ck(panelOpen === true, `settings panel opens on gear click (got ${panelOpen})`);

const playerCbChecked = await page.evaluate(() => document.getElementById('bcp-opt-player').checked);
ck(playerCbChecked === true, `"Native player" checkbox is checked by default (got ${playerCbChecked})`);

await page.click('#bcp-opt-tracklist');
await page.waitForTimeout(150);
const afterCheck = await visibility();
console.log('visibility (tracklist checked):', JSON.stringify(afterCheck));
ck(afterCheck.tracklist === false, `checking "Track list" hides it live, no reload (got ${afterCheck.tracklist})`);
ck(afterCheck.player === false && afterCheck.tags === true, `the untouched options are unaffected (player stays hidden, tags stays visible) — got player=${afterCheck.player}, tags=${afterCheck.tags}`);

// 3) outside click closes the panel (not #bcp-info/#bcp-title — those stopPropagation their
// own clicks for the track dropdown, which would mask a real "outside click" bug here)
await page.click('#bcp-time');
await page.waitForTimeout(150);
const panelClosedAfterOutsideClick = await page.evaluate(() => !document.getElementById('bcp-settings-panel').classList.contains('open'));
ck(panelClosedAfterOutsideClick === true, 'clicking outside the panel closes it');

// 4) persistence: reload the page fresh, confirm the choice survived via GM storage
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);
const afterReload = await visibility();
const checkboxState = await page.evaluate(() => document.getElementById('bcp-opt-tracklist').checked);
console.log('visibility (after reload):', JSON.stringify(afterReload), 'checkbox checked:', checkboxState);
ck(afterReload.tracklist === false, `the hidden choice persists across a page reload (got ${afterReload.tracklist})`);
ck(checkboxState === true, `the settings panel checkbox reflects the persisted (checked) state on reload (got ${checkboxState})`);
ck(afterReload.player === false && afterReload.tags === true, 'the untouched options keep their defaults after reload (player hidden, tags visible)');

// preloadFirstTrack() deliberately plays-then-pauses a muted track to prime the buffer without
// audible playback — Chrome surfaces the resulting AbortError as a page error even on the
// unmodified script (confirmed against the pre-fix code), so it's filtered out here as known-benign.
const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
