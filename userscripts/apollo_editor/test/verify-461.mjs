// #461 — MB's "add a new artist/label" iframe dialog was rendering UNDER Apollo's
// artist-credit editor bubble. Cause: in replace-integrated mode Apollo lifts editor
// bubbles to z-index:50 (to clear its sticky nav), but the add-entity iframe lives inside
// a .modal-backdrop that makes its OWN stacking context at z-index:auto(0) — so the
// iframe's internal z-index can't escape above the bubble. Fix: elevate .modal-backdrop
// (z-index:210) so the whole creation dialog sits above the bubble.
// This loads Apollo on the real release editor and asserts the computed z-indexes.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = '35e0c3ca-1130-4cfb-911d-c275ab31100e';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1745, height: 900 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_registerMenuCommand = () => {}; window.GM_info = { script: { name: 'Apollo', version: 't' } }; window.unsafeWindow = window; });
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3500);
await page.addScriptTag({ content: code });
await page.waitForTimeout(2000);
const r = await page.evaluate(() => {
  const riOn = document.body.classList.contains('tc-ri-on');
  // reproduce MB's structure: a fixed .modal-backdrop wrapping the add-entity iframe, over the bubble
  const bub = document.createElement('div'); bub.className = 'bubble'; bub.style.position = 'absolute'; bub.innerHTML = '<input>';
  document.body.appendChild(bub);
  const back = document.createElement('div'); back.className = 'modal-backdrop'; back.style.position = 'fixed';
  const f = document.createElement('iframe'); f.style.position = 'relative'; f.style.zIndex = '100'; back.appendChild(f);
  document.body.appendChild(back);
  const bubZ = getComputedStyle(bub).zIndex, backZ = getComputedStyle(back).zIndex;
  bub.remove(); back.remove();
  return { riOn, bubZ, backZ };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r));
ck(r.riOn, 'body has tc-ri-on (rule scope active)');
ck(r.bubZ === '50', `artist-credit bubble computes z-index:50 (got ${r.bubZ})`);
ck(r.backZ === '210', `.modal-backdrop computes z-index:210, above the bubble (got ${r.backZ})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
