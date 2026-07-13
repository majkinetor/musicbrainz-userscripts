// #412 — toolbar "saving" indicator while MB submits edits.
// Mounts the CH bar on a release with a Discogs link, then simulates MB's submit by
// injecting `<span class="loading-message">Submitting edits...</span>`; asserts the bar
// gains .is-saving + a "Submitting…" status, and drops it again when the message goes.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_xmlhttpRequest = () => {}; window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } }; window.unsafeWindow = window; });
await page.goto('https://musicbrainz.org/release/3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
ck(await page.$('.discogs-bar') !== null, 'CH bar mounted');

// idle: not saving
ck(!(await page.evaluate(() => document.querySelector('.discogs-bar').classList.contains('is-saving'))), 'bar not saving at rest');

// simulate MB submit — inject the loading message MB shows by the Enter-edit button
await page.evaluate(() => {
    const s = document.createElement('span');
    s.className = 'loading-message'; s.textContent = 'Submitting edits...';
    s.id = 'fake-submit';
    document.querySelector('#content')?.appendChild(s);
});
await page.waitForTimeout(300);
const saving = await page.evaluate(() => {
    const bar = document.querySelector('.discogs-bar');
    const row1 = bar.querySelector('.discogs-bar-row1');
    const st = bar.querySelector('.discogs-bar-status-final');
    return {
        cls: bar.classList.contains('is-saving'),
        pinned: bar.classList.contains('is-pinned'),
        row1Fixed: getComputedStyle(row1).position === 'fixed',
        row1Animated: getComputedStyle(row1).animationName === 'discogs-bar-saving',
        status: st && st.textContent, statusShown: st && st.style.display !== 'none',
    };
});
ck(saving.cls, 'bar gains .is-saving when MB starts submitting');
ck(saving.pinned && saving.row1Fixed, 'bar is pinned — row1 fixed at the top of the viewport');
ck(saving.row1Animated, 'the PINNED row1 (not the scrolled-away container) is the one pulsing');
ck(/submitting/i.test(saving.status || ''), `status shows submitting ("${saving.status}")`);
await page.screenshot({ path: 'C:/Work/mb-userscripts/userscripts/credit_hoarder/test/logs/_412_saving.png', clip: { x: 0, y: 0, width: 1600, height: 90 } }).catch(() => {});

// remove the message (failure path / navigation-less end) → saving clears
await page.evaluate(() => document.getElementById('fake-submit')?.remove());
await page.waitForTimeout(300);
ck(!(await page.evaluate(() => document.querySelector('.discogs-bar').classList.contains('is-saving'))), 'bar drops .is-saving when the submit message goes');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
