// #followup: the player felt "too big" and the font hard to read. Added a Scale slider
// (70-130%) in the settings panel, applied via CSS zoom on #bc-sticky-player, with the page's
// top-padding and the dropdown/settings-panel top offset re-measured live so nothing
// overlaps/gaps when the rendered bar height changes. Also swapped the Courier New font stack
// for a more legible modern-monospace stack (Consolas/Menlo first).
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

const metrics = () => page.evaluate(() => {
  const bar = document.getElementById('bc-sticky-player');
  const dd = document.getElementById('bcp-dropdown'), sp = document.getElementById('bcp-settings-panel');
  return {
    barHeight: Math.round(bar.getBoundingClientRect().height),
    bodyPadding: parseInt(getComputedStyle(document.body).paddingTop, 10),
    ddTop: parseInt(getComputedStyle(dd).top, 10),
    spTop: parseInt(getComputedStyle(sp).top, 10),
    zoom: getComputedStyle(bar).zoom,
    fontFamily: getComputedStyle(bar).fontFamily,
  };
});

// 1) default: 100% scale, legible font stack (not Courier New first)
const before = await metrics();
console.log('at 100%:', JSON.stringify(before));
ck(before.bodyPadding === before.barHeight, `page top-padding matches the bar's real height at 100% (${before.bodyPadding} vs ${before.barHeight})`);
ck(!/^courier/i.test(before.fontFamily), `font stack no longer leads with Courier New (got "${before.fontFamily}")`);

// 2) shrink to 70% via the slider — bar should visibly shrink, and paddingTop/overlay tops
// must track the new (smaller) rendered height, not stay pinned to the 100% value
await page.click('#bcp-settings');
await page.waitForTimeout(150);
await page.fill('#bcp-opt-scale', '70');
await page.dispatchEvent('#bcp-opt-scale', 'input');
await page.waitForTimeout(200);
const shrunk = await metrics();
console.log('at 70%:', JSON.stringify(shrunk));
ck(shrunk.barHeight < before.barHeight, `bar visibly shrinks at 70% scale (${shrunk.barHeight}px < ${before.barHeight}px)`);
ck(shrunk.bodyPadding === shrunk.barHeight, `page top-padding tracks the SHRUNK bar height, no gap left behind (${shrunk.bodyPadding} vs ${shrunk.barHeight})`);
ck(Math.abs(shrunk.ddTop - (shrunk.barHeight + 2)) <= 1, `dropdown offset tracks the shrunk bar too (${shrunk.ddTop} vs ~${shrunk.barHeight + 2})`);
ck(Math.abs(shrunk.spTop - (shrunk.barHeight + 2)) <= 1, `settings panel offset tracks the shrunk bar too (${shrunk.spTop} vs ~${shrunk.barHeight + 2})`);

// 3) the settings panel itself must stay usable/on-screen while shrunk (still open, still clickable)
const panelStillOpenAndUsable = await page.evaluate(() => {
  const sp = document.getElementById('bcp-settings-panel');
  return sp.classList.contains('open') && sp.getBoundingClientRect().width > 0;
});
ck(panelStillOpenAndUsable, 'settings panel stays open and visible through a live scale change');

// 4) persists across reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
await page.waitForTimeout(500);
const afterReload = await metrics();
const sliderVal = await page.evaluate(() => document.getElementById('bcp-opt-scale').value);
console.log('after reload:', JSON.stringify(afterReload), 'slider:', sliderVal);
ck(sliderVal === '70', `scale choice persists across reload (slider shows ${sliderVal})`);
ck(afterReload.bodyPadding === afterReload.barHeight, 'padding still tracks the (persisted, shrunk) bar height after reload');

const realErrs = errs.filter(e => !/play\(\) request was interrupted by a call to pause\(\)/.test(e));
ck(realErrs.length === 0, 'no unexpected page errors: ' + JSON.stringify(realErrs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
