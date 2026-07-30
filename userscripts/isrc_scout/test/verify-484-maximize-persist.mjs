// #484 (chaban-mb): "It seems ISRC Scout attempts to preserve the maximized
// state when closing it because the 'Restore' icon is shown when closing in
// maximized and then re-opening. However the window is not actually restored
// to maximized state."
//
// Root cause: pinModalToViewport()'s desktop path calls clearModalViewportPin(),
// which unconditionally clears left/top/width/height/max-width/max-height/
// transform — the EXACT same inline style properties toggleMaximize() sets.
// Both openModal() and the visualViewport resize/scroll listener call
// pinModalToViewport() every time, silently wiping the maximized size while
// leaving the _maxed flag (and so the "Restore" button label) untouched.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/d39b6cab-6ae6-4de8-b782-528865f4e832', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 10000 });

// open, maximize, confirm
await page.click('#ii-btn');
await page.waitForSelector('#ii-modal.open', { timeout: 10000 });
await page.click('#ii-maximize-toggle');
const afterMax = await page.evaluate(() => {
  const m = document.getElementById('ii-modal');
  return { width: m.style.width, btnTitle: document.getElementById('ii-maximize-toggle').title, rectWidth: m.getBoundingClientRect().width };
});
console.log('after maximize:', JSON.stringify(afterMax));
ck(afterMax.width === '96vw' && afterMax.btnTitle === 'Restore', `maximize applied correctly (got ${JSON.stringify(afterMax)})`);

// close (Escape) then reopen
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.getElementById('ii-modal').classList.contains('open'), { timeout: 5000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-modal.open', { timeout: 10000 });
const afterReopen = await page.evaluate(() => {
  const m = document.getElementById('ii-modal');
  return { width: m.style.width, btnTitle: document.getElementById('ii-maximize-toggle').title, rectWidth: m.getBoundingClientRect().width, viewportWidth: window.innerWidth };
});
console.log('after close + reopen:', JSON.stringify(afterReopen));
ck(afterReopen.btnTitle === 'Restore', `button still says Restore after reopen (got "${afterReopen.btnTitle}") — expected, since _maxed persists`);
ck(afterReopen.width === '96vw', `the modal's inline width is STILL 96vw after reopen — not silently cleared (got "${afterReopen.width}")`);
ck(afterReopen.rectWidth > afterReopen.viewportWidth * 0.9, `the modal is ACTUALLY rendered near full-width after reopen (got ${afterReopen.rectWidth}px of ${afterReopen.viewportWidth}px viewport)`);

// clicking Restore now should genuinely shrink it back down (proves _prevBox + the flag are still in sync)
await page.click('#ii-maximize-toggle');
const afterRestore = await page.evaluate(() => {
  const m = document.getElementById('ii-modal');
  return { btnTitle: document.getElementById('ii-maximize-toggle').title, rectWidth: m.getBoundingClientRect().width };
});
console.log('after clicking Restore:', JSON.stringify(afterRestore));
ck(afterRestore.btnTitle === 'Maximize', `button flips back to Maximize (got "${afterRestore.btnTitle}")`);
ck(afterRestore.rectWidth < afterReopen.rectWidth, `restoring genuinely shrinks the window back down (${afterRestore.rectWidth}px < ${afterReopen.rectWidth}px)`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
