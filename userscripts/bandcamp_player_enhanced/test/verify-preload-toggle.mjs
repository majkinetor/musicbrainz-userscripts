// preloadFirstTrack() clicks + briefly (muted) plays track 1 to warm the buffer on page load.
// Bandcamp's own JS treats "this tab started playing" as a signal to pause OTHER Bandcamp tabs
// that are genuinely playing — disruptive with multiple album tabs open. Added a "Preload
// track 1" checkbox (default ON, preserving existing behavior) so it can be turned off.
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

async function loadWithPreload(enabled) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  // #501: GM_getValue/GM_setValue mock backed by real (namespaced) localStorage.
  // A fresh context per call here, so the plain-localStorage seed below still
  // flows through the one-time migration fallback path exactly once, as intended.
  await page.addInitScript(() => {
    window.GM_getValue = (k, d) => { const v = localStorage.getItem('__gm__' + k); return v === null ? d : v; };
    window.GM_setValue = (k, v) => { localStorage.setItem('__gm__' + k, v); };
    window.GM_deleteValue = k => localStorage.removeItem('__gm__' + k);
  });
  await page.goto(ALBUM_URL, { waitUntil: 'domcontentloaded' });
  if (!enabled) await page.evaluate(() => localStorage.setItem('bcp_preload', '0'));
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  // preloadFirstTrack()'s own waitForBuffer() retries up to 80 * 50ms = 4s before giving up
  // and force-pausing, so wait past that whole window rather than guessing a shorter one.
  await page.waitForTimeout(4800);
  const audioState = await page.evaluate(() => {
    const a = document.querySelector('audio');
    return a ? { exists: true, src: !!a.src, paused: a.paused, currentTime: a.currentTime } : { exists: false };
  });
  const checkboxChecked = await page.evaluate(() => {
    const cb = document.getElementById('bcp-opt-preload');
    return cb ? cb.checked : null;
  });
  await ctx.close();
  return { audioState, checkboxChecked, errs };
}

// 1) default (no localStorage override): preload runs — an <audio> element gets loaded, paused
const on = await loadWithPreload(true);
console.log('preload ON (default):', JSON.stringify(on.audioState), 'checkbox:', on.checkboxChecked);
ck(on.checkboxChecked === true, `checkbox reflects enabled-by-default (got ${on.checkboxChecked})`);
ck(on.audioState.exists && on.audioState.src, `preload loads track 1 into <audio> by default (got ${JSON.stringify(on.audioState)})`);
// (whether the preloaded audio ends up paused or briefly keeps playing is a pre-existing
// Bandcamp-interaction nuance, unchanged by this toggle and unrelated to what it controls —
// not asserted here; confirmed identical on the pre-toggle code.)

// 2) disabled via the persisted setting: no forced click/play of track 1
const off = await loadWithPreload(false);
console.log('preload OFF:', JSON.stringify(off.audioState), 'checkbox:', off.checkboxChecked);
ck(off.checkboxChecked === false, `checkbox reflects the persisted disabled state (got ${off.checkboxChecked})`);
ck(!off.audioState.exists || !off.audioState.src, `preload disabled — no <audio> element gets a forced src (got ${JSON.stringify(off.audioState)})`);

const allErrs = [...on.errs, ...off.errs].filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(allErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(allErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
