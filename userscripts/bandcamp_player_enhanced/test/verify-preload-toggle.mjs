// #511 (majkinetor, live): the old preloadFirstTrack() clicked the first track
// row to warm the buffer, which Bandcamp's own JS treats as "this tab started
// playing" — even muted, that paused a DIFFERENT Bandcamp tab that was
// genuinely playing, and fought with fast track-switching. Fixed by calling
// Bandcamp's own window.gplaylist.set_initial_track(index) — the same global
// TralbumData lives on, live-verified to update which track a later real Play
// press starts from WITHOUT ever touching the <audio> element or calling
// play(). The "Start from track 1" checkbox (default ON) still opts out.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'bandcamp_player_enhanced.user.js'), 'utf8');

const ALBUM_URL = 'https://phoebebridgers.bandcamp.com/album/stranger-in-the-alps';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: true });

async function loadWithPreload(enabled) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    window.GM_getValue = (k, d) => { const v = localStorage.getItem('__gm__' + k); return v === null ? d : v; };
    window.GM_setValue = (k, v) => { localStorage.setItem('__gm__' + k, v); };
    window.GM_deleteValue = k => localStorage.removeItem('__gm__' + k);
  });
  await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // capture Bandcamp's own DEFAULT track selection before our script touches anything
  const rawTrack = await page.evaluate(() => window.gplaylist?._track);
  if (!enabled) await page.evaluate(() => localStorage.setItem('bcp_preload', '0'));
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const a = document.querySelector('audio');
    return {
      track: window.gplaylist?._track,
      playlistState: window.gplaylist?._state,
      audioExists: !!a,
      audioHasSrc: !!(a && a.src),
      audioPaused: a ? a.paused : null,
    };
  });
  const checkboxChecked = await page.evaluate(() => document.getElementById('bcp-opt-preload')?.checked);
  await ctx.close();
  return { rawTrack, state, checkboxChecked, errs };
}

// 1) default (preload ON): gplaylist._track is forced to the first playable
// track — but audio playback is never touched (no click, no play()).
const on = await loadWithPreload(true);
console.log('preload ON — bandcamp default track:', on.rawTrack, 'after script:', JSON.stringify(on.state), 'checkbox:', on.checkboxChecked);
ck(on.checkboxChecked === true, `checkbox reflects enabled-by-default (got ${on.checkboxChecked})`);
ck(on.state.track === 0, `gplaylist._track forced to 0 (first playable track), regardless of Bandcamp's own default (was ${on.rawTrack}, got ${on.state.track})`);
ck(on.state.playlistState === 'IDLE', `player stays IDLE — never started playing (got "${on.state.playlistState}")`);
ck(!on.state.audioHasSrc, `no <audio> src was ever set — positioning happened without loading/playing anything (got audioHasSrc=${on.state.audioHasSrc})`);

// 2) disabled via the persisted setting: Bandcamp's own default track is left alone
const off = await loadWithPreload(false);
console.log('preload OFF — bandcamp default track:', off.rawTrack, 'after script:', JSON.stringify(off.state), 'checkbox:', off.checkboxChecked);
ck(off.checkboxChecked === false, `checkbox reflects the persisted disabled state (got ${off.checkboxChecked})`);
ck(off.state.track === off.rawTrack, `preload disabled — Bandcamp's own track selection is untouched (was ${off.rawTrack}, still ${off.state.track})`);

const allErrs = [...on.errs, ...off.errs];
ck(allErrs.length === 0, 'no page errors: ' + JSON.stringify(allErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
