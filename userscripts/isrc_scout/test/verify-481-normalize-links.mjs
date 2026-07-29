// #481 (majkinetor) — the same recording got two cosmetically different links
// for the SAME track depending on whether Harmony or ISRC Scout added it:
//   https://tidal.com/track/23959722            (Harmony)
//   https://tidal.com/browse/track/23959722     (ISRC Scout, before this fix)
//   https://music.apple.com/us/song/767643144                       (Harmony)
//   https://music.apple.com/us/song/distant-horizon/767643144       (ISRC Scout, before this fix)
// MB's own URLCleanup.js (metabrainz/musicbrainz-server, root/static/scripts/
// edit/URLCleanup.js) is the authority: it strips Tidal's browse/store/locale
// prefix, and strips Apple's descriptive slug — Harmony already produces that
// canonical shape. normalizeProviderUrl() mirrors those two rules so ISRC
// Scout's own "add" candidates match, instead of reading as a different link.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';   // any real release page — the script only activates there

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 }, bypassCSP: true });
await ctx.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__isrcScoutTest466?.normalizeProviderUrl, { timeout: 20000 });

const cases = [
  // [providerCode, input, expected]
  ['td', 'https://tidal.com/browse/track/23959722', 'https://tidal.com/track/23959722'],
  ['td', 'https://tidal.com/track/23959722', 'https://tidal.com/track/23959722'],          // already canonical — idempotent
  ['td', 'https://listen.tidal.com/browse/track/23959722', 'https://tidal.com/track/23959722'],
  ['td', 'https://tidal.com/gb/browse/track/23959722', 'https://tidal.com/track/23959722'],
  ['am', 'https://music.apple.com/us/song/distant-horizon/767643144', 'https://music.apple.com/us/song/767643144'],
  ['am', 'https://music.apple.com/us/song/767643144', 'https://music.apple.com/us/song/767643144'],   // idempotent
  ['am', 'https://music.apple.com/gb/album/some-album/123456?i=767643144', 'https://music.apple.com/gb/song/767643144'],
  ['dz', 'https://www.deezer.com/track/3702424332', 'https://www.deezer.com/track/3702424332'],   // untouched — not td/am
];

const results = await page.evaluate((cases) => cases.map(([code, input]) => window.__isrcScoutTest466.normalizeProviderUrl(code, input)), cases);
cases.forEach(([code, input, expected], i) => {
  ck(results[i] === expected, `${code}: "${input}" -> "${results[i]}" (expected "${expected}")`);
});

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
