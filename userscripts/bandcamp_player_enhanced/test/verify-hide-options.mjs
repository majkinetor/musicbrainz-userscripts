// Adds a settings panel to Bandcamp Player Enhanced so each of hidePageElements()'s three
// hide-groups (native player, track list, tags) can be toggled independently via UI instead
// of being unconditionally hardcoded. Verifies: default state hides all three, unchecking one
// via the settings panel un-hides it live (no reload), and the choice persists across a fresh
// page load via localStorage.
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

await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);

// 1) default: all three groups hidden
const visibility = async () => page.evaluate(() => {
    const vis = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };
    return { player: vis('#player, .inline_player'), tracklist: vis('.track_list, ol.track_list, table.track_list'), tags: vis('.tralbum-tags, .tags') };
});
const before = await visibility();
console.log('visibility (defaults):', JSON.stringify(before));
ck(before.tracklist === false, `track list is hidden by default (got ${before.tracklist})`);

// 2) open settings panel, uncheck "Track list"
await page.click('#bcp-settings');
await page.waitForTimeout(150);
const panelOpen = await page.evaluate(() => document.getElementById('bcp-settings-panel').classList.contains('open'));
ck(panelOpen === true, `settings panel opens on gear click (got ${panelOpen})`);

await page.click('#bcp-opt-tracklist');
await page.waitForTimeout(150);
const afterUncheck = await visibility();
console.log('visibility (tracklist unchecked):', JSON.stringify(afterUncheck));
ck(afterUncheck.tracklist === true, `unchecking "Track list" un-hides it live, no reload (got ${afterUncheck.tracklist})`);
ck(afterUncheck.player === false && afterUncheck.tags === false, `the other two groups stay hidden — this option is independent (got player=${afterUncheck.player}, tags=${afterUncheck.tags})`);

// 3) outside click closes the panel (not #bcp-info/#bcp-title — those stopPropagation their
// own clicks for the track dropdown, which would mask a real "outside click" bug here)
await page.click('#bcp-time');
await page.waitForTimeout(150);
const panelClosedAfterOutsideClick = await page.evaluate(() => !document.getElementById('bcp-settings-panel').classList.contains('open'));
ck(panelClosedAfterOutsideClick === true, 'clicking outside the panel closes it');

// 4) persistence: reload the page fresh, confirm the choice survived via localStorage
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);
const afterReload = await visibility();
const checkboxState = await page.evaluate(() => document.getElementById('bcp-opt-tracklist').checked);
console.log('visibility (after reload):', JSON.stringify(afterReload), 'checkbox checked:', checkboxState);
ck(afterReload.tracklist === true, `the un-hidden choice persists across a page reload (got ${afterReload.tracklist})`);
ck(checkboxState === false, `the settings panel checkbox reflects the persisted (unchecked) state on reload (got ${checkboxState})`);
ck(afterReload.player === false && afterReload.tags === false, 'the untouched options still default to hidden after reload');

// preloadFirstTrack() deliberately plays-then-pauses a muted track to prime the buffer without
// audible playback — Chrome surfaces the resulting AbortError as a page error even on the
// unmodified script (confirmed against the pre-fix code), so it's filtered out here as known-benign.
const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
