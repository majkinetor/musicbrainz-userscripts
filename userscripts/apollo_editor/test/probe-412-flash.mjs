// #412 (Apollo) — pulse the compact-nav bar strictly while MB's own "Submitting edits…" node is up.
// The release editor inserts that node (KO if-binding) only when submission actually starts, so:
//  - editing / changes must NOT flash (the node isn't in the DOM),
//  - inserting a "Submitting edits…" node → body.tc-saving + #tc-nav-bar pulses,
//  - removing it (validation failure) → clears.
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
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('apolloEditor.settings.v1') || '{}'); s.apolloEnabled = true; s.compactNav = true; localStorage.setItem('apolloEditor.settings.v1', JSON.stringify(s)); });
await page.addScriptTag({ content: CODE });
await page.waitForSelector('#tc-nav-bar', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
ck(await page.$('#tc-nav-bar') !== null, 'Apollo compact nav bar mounted');
ck(!(await page.evaluate(() => document.body.classList.contains('tc-saving'))), 'not saving at rest');

// making changes and switching tabs must NOT flash (the submit node is only inserted on a real
// submit — never while merely editing). Deliberately avoid clicking the submit button here.
await page.evaluate(() => { try { const r = window.MB.releaseEditor.rootField.release(); r.name(r.name() + ' x'); r.name(r.name().slice(0, -2)); } catch (e) {} });
await page.evaluate(() => { document.querySelector('#tc-nav-steps .tc-nav-step')?.click(); });   // switch tab, not submit
await page.waitForTimeout(400);
ck(!(await page.evaluate(() => document.body.classList.contains('tc-saving'))), 'editing + tab switches do NOT flash (no submit node in the DOM)');

// MB inserts the "Submitting edits…" node on real submit → flash
await page.evaluate(() => { const d = document.createElement('div'); d.className = 'loading-message'; d.id = 'fake-lm'; d.textContent = 'Submitting edits...'; (document.querySelector('.buttons') || document.body).appendChild(d); });
await page.waitForTimeout(300);
const on = await page.evaluate(() => ({ body: document.body.classList.contains('tc-saving'), anim: getComputedStyle(document.querySelector('#tc-nav-bar')).animationName }));
ck(on.body, 'flash on when MB inserts the Submitting-edits node');
ck(on.anim === 'tc-saving-pulse', `#tc-nav-bar pulses (animation=${on.anim})`);
await page.screenshot({ path: 'C:/Work/mb-userscripts/userscripts/apollo_editor/test/logs/_412_flash.png', clip: { x: 0, y: 0, width: 1600, height: 110 } }).catch(() => {});

// node removed (failed submit) → clears
await page.evaluate(() => document.getElementById('fake-lm')?.remove());
await page.waitForTimeout(300);
ck(!(await page.evaluate(() => document.body.classList.contains('tc-saving'))), 'flash clears when the Submitting-edits node goes');

ck(errs.filter(e => !/ResizeObserver/.test(e)).length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
