// #511 (majkinetor): "preloading track 1 ... starts/stops song one. What is
// unfortunate is that it does that by starting/stopping song one. 1. opening
// another tab will stop the playback on previous one. 2. it interferes with
// fast playing." Root cause (live-verified): Bandcamp pauses a DIFFERENT tab
// the instant a NEW tab's <audio> element enters the playing state at all —
// even muted, even volume=0. The only real fix is to never call play() during
// preload. Bandcamp's own window.gplaylist (a plain page global right beside
// TralbumData) exposes set_initial_track(index) — live-verified to update
// which track a later real Play press starts from, without ever touching the
// <audio> element or calling play(). This test proves both halves: (1) the
// preload no longer starts playback at all, and (2) a tab that's genuinely
// playing stays playing when a second tab loads the same album and preloads.
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  window.GM_getValue = (k, d) => d;
  window.GM_setValue = () => {};
  window.GM_deleteValue = () => {};
});

// Tab A: real playback, unmuted.
const pageA = await ctx.newPage();
await pageA.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
await pageA.waitForTimeout(1500);
await pageA.evaluate(() => { const btn = document.querySelector('.playbutton'); if (btn) btn.click(); });
await pageA.waitForTimeout(1200);
const aPlayingBefore = await pageA.evaluate(() => !document.querySelector('audio')?.paused);
ck(aPlayingBefore, 'tab A is genuinely playing before tab B does anything');

// Tab B: loads the same album fresh, our script's preloadFirstTrack() runs.
const pageB = await ctx.newPage();
const errsB = []; pageB.on('pageerror', e => errsB.push(e.message));
await pageB.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
await pageB.waitForTimeout(500);
const bTrackBefore = await pageB.evaluate(() => window.gplaylist?._track);
await pageB.addScriptTag({ content: code });
await pageB.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await pageB.waitForTimeout(800);

const bState = await pageB.evaluate(() => {
  const a = document.querySelector('audio');
  return { track: window.gplaylist?._track, playlistState: window.gplaylist?._state, audioHasSrc: !!(a && a.src), audioPaused: a ? a.paused : null };
});
console.log('tab B track before script:', bTrackBefore, 'after preload:', JSON.stringify(bState));
ck(bState.track === 0, `tab B's preload correctly selected the first track (got ${bState.track})`);
ck(bState.playlistState === 'IDLE', `tab B's player never started playing (state="${bState.playlistState}")`);
ck(!bState.audioHasSrc, 'tab B never loaded any audio (no src set)');

// The actual point of #511: tab A must STILL be playing after tab B preloaded.
const aStillPlaying = await pageA.evaluate(() => !document.querySelector('audio')?.paused);
ck(aStillPlaying, 'tab A is STILL playing after tab B preloaded track 1 — no cross-tab pause');

// Sanity: tab B's own display shows the right "current track" despite never loading audio.
const bTitle = await pageB.evaluate(() => document.getElementById('bcp-title')?.textContent);
const track1Title = await pageB.evaluate(() => window.TralbumData?.trackinfo?.[0]?.title);
console.log('tab B displayed title:', bTitle, '(expected:', track1Title, ')');
ck(bTitle === track1Title, `tab B's UI shows track 1's title even though nothing has played yet (got "${bTitle}", expected "${track1Title}")`);

ck(errsB.length === 0, 'no page errors on tab B: ' + JSON.stringify(errsB.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
