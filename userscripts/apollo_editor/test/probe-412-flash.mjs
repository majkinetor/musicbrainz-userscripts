// #412 (Apollo) — pulse the Apollo toolbar while MB is submitting the edit.
// Loads a real /edit page, lets Apollo mount its #tc-bar, then simulates MB's submit by
// injecting `<span class="loading-message">Submitting edits...</span>`; asserts body.tc-saving
// toggles and #tc-bar carries the tc-saving-pulse animation, and clears when the message goes.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const CODE = await readFile('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const REL = '43794b9b-ac76-4591-807f-c192d6258ba0';   // Ko Sira

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1050 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'Apollo', version: 'test' } }; });
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; } }, null, { timeout: 120000 }).catch(() => {});
await page.addScriptTag({ content: CODE });
await page.waitForSelector('#tc-bar', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
ck(await page.$('#tc-bar') !== null, 'Apollo #tc-bar toolbar mounted');
ck(!(await page.evaluate(() => document.body.classList.contains('tc-saving'))), 'not saving at rest');

// simulate MB submit
await page.evaluate(() => {
  const s = document.createElement('span');
  s.className = 'loading-message'; s.textContent = 'Submitting edits...'; s.id = 'fake-submit';
  (document.querySelector('#page') || document.body).appendChild(s);
});
await page.waitForTimeout(300);
const on = await page.evaluate(() => {
  const bar = document.querySelector('#tc-bar');
  return { body: document.body.classList.contains('tc-saving'), anim: getComputedStyle(bar).animationName };
});
ck(on.body, 'body.tc-saving set when MB starts submitting');
ck(on.anim === 'tc-saving-pulse', `#tc-bar pulses (animation=${on.anim})`);
await page.screenshot({ path: 'C:/Work/mb-userscripts/userscripts/apollo_editor/test/logs/_412_flash.png', clip: { x: 0, y: 0, width: 1600, height: 120 } }).catch(() => {});

await page.evaluate(() => document.getElementById('fake-submit')?.remove());
await page.waitForTimeout(300);
ck(!(await page.evaluate(() => document.body.classList.contains('tc-saving'))), 'flag clears when the submit message goes');

ck(errs.filter(e => !/ResizeObserver/.test(e)).length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
