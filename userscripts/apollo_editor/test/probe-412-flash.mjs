// #412 (Apollo) — pulse the pinned COMPACT-NAV bar while MB is submitting the edit.
// The release editor emits no loading-message, and the button the user clicks is the compact-nav
// "✓ Enter edit" (#tc-nav-wiz .tc-nav-wbtn), not the footer. Clicking it must flag body.tc-saving
// and pulse #tc-nav-bar. We stub the wiz button's native-forwarding by clicking it directly.
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
// ensure compact nav is on so #tc-nav-bar is built
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('apolloEditor.settings.v1') || '{}'); s.apolloEnabled = true; s.compactNav = true; localStorage.setItem('apolloEditor.settings.v1', JSON.stringify(s)); });
await page.addScriptTag({ content: CODE });
await page.waitForSelector('#tc-nav-bar', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
ck(await page.$('#tc-nav-bar') !== null, 'Apollo compact nav bar (#tc-nav-bar) mounted');
ck(await page.$('#tc-nav-wiz .tc-nav-wbtn') !== null, 'compact nav has a wiz submit button (Enter edit)');
ck(!(await page.evaluate(() => document.body.classList.contains('tc-saving'))), 'not saving at rest');

// remove the wiz button's own onclick (which forwards to MB's native submit) so nothing submits;
// Apollo's saving flash is on a document capture-phase listener, so it still fires on the click.
await page.evaluate(() => { document.querySelector('#tc-nav-wiz .tc-nav-wbtn').onclick = null; });
await page.evaluate(() => document.querySelector('#tc-nav-wiz .tc-nav-wbtn').click());
await page.waitForTimeout(300);
const on = await page.evaluate(() => {
  const bar = document.querySelector('#tc-nav-bar');
  return { body: document.body.classList.contains('tc-saving'), anim: getComputedStyle(bar).animationName };
});
ck(on.body, 'body.tc-saving set when the compact-nav Enter edit is clicked');
ck(on.anim === 'tc-saving-pulse', `#tc-nav-bar pulses (animation=${on.anim})`);
await page.screenshot({ path: 'C:/Work/mb-userscripts/userscripts/apollo_editor/test/logs/_412_flash.png', clip: { x: 0, y: 0, width: 1600, height: 110 } }).catch(() => {});

ck(errs.filter(e => !/ResizeObserver/.test(e)).length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
