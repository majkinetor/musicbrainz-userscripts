// #545 (majkinetor): "Recordings match button isn't grayed out while auto match
// is in progress … Auto match should be visible while working, currently it
// isn't so slow MB response make it look like nothing is happening."
//
// The run already wrote progress into a small status span, but the button
// itself never changed — and on a slow MusicBrainz that reads as nothing
// happening at all. It now shows a spinner, says "Matching…", and is disabled
// while the run is going.
//
// MusicBrainz is deliberately slowed here so the busy window is wide enough to
// observe: on a fast day the whole run finishes between two polls and the test
// would pass without ever having seen the state it exists to check.
//
// Read-only: nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(() => true, async route => {
  const r = route.request();
  if (r.method() === 'POST') { posted.push(r.url()); return route.abort(); }
  // slow the release-group lookup the run starts with, so "busy" is observable
  if (/\/ws\/2\/release\?release-group=/.test(r.url())) {
    await new Promise(z => setTimeout(z, 6000));
  }
  return route.continue();
});

for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(6000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1500);

// open the Recordings tab so the toolbar exists
await page.evaluate(() => {
  const t = [...document.querySelectorAll('a, button')].find(x => /^\s*recordings\s*$/i.test(x.textContent || ''));
  if (t) t.click();
});
await page.waitForSelector('#tc-recwrap .tc-rec-am', { timeout: 20000 });
await page.waitForTimeout(500);

const readBtn = () => page.evaluate(() => {
  const b = document.querySelector('#tc-recwrap .tc-rec-am');
  const st = document.querySelector('#tc-recwrap .tc-rec-amstatus');
  if (!b) return null;
  const spin = b.querySelector('.tc-spin');
  return {
    label: (b.querySelector('.tc-rec-am-lbl') || b).textContent.trim(),
    disabled: !!b.disabled,
    busyClass: b.classList.contains('busy'),
    spinnerShown: spin ? getComputedStyle(spin).display !== 'none' : false,
    status: st ? st.textContent.trim() : null,
    title: b.title,
  };
});

const idle = await readBtn();
console.log('idle : ' + JSON.stringify(idle));
ck(!!idle, 'the Match button exists on the Recordings toolbar');
ck(idle.label === '⚡ Match' && !idle.disabled && !idle.spinnerShown, 'at rest it is the ordinary enabled button');

// Start it and watch WITHOUT waiting for it to finish. page.evaluate awaits a
// returned promise, so returning the async call would block until the run was
// over and the busy state had already been cleared — the poll below would then
// never see it and the test would "pass" having observed nothing.
await page.evaluate(() => { window.__apolloEditor.autoMatchRecordings(); });
let busySeen = null;
for (let i = 0; i < 40 && !busySeen; i++) {
  const st = await readBtn();
  if (st && st.busyClass) busySeen = st;
  else await page.waitForTimeout(150);
}
console.log('busy : ' + JSON.stringify(busySeen));
ck(!!busySeen, 'the button enters a visible busy state while the run is going');
if (busySeen) {
  ck(busySeen.disabled, 'it is disabled, so a second run cannot be stacked on the first');
  ck(busySeen.spinnerShown, 'a spinner is actually rendered (not just a class nobody styled)');
  ck(/matching/i.test(busySeen.label), 'and the label says what it is doing — ' + JSON.stringify(busySeen.label));
  ck(/musicbrainz/i.test(busySeen.title), 'with a tooltip explaining the wait — ' + JSON.stringify(busySeen.title));
}

// and it must come back — including after rerenderRec() replaces the node
await page.waitForFunction(() => {
  const b = document.querySelector('#tc-recwrap .tc-rec-am');
  return b && !b.disabled && !b.classList.contains('busy');
}, null, { timeout: 90000 }).catch(() => {});
const done = await readBtn();
console.log('done : ' + JSON.stringify(done));
ck(done && !done.disabled && !done.busyClass && !done.spinnerShown, 'and it returns to normal when the run ends');
ck(done && done.label === '⚡ Match', 'with its label restored');
ck(done && /linked \d+ of \d+/.test(done.status || ''), 'the outcome is reported in the status — ' + JSON.stringify(done.status));

const mbPosts = posted.filter(u => /\/ws\/js\/edit\/create/.test(u));
console.log('POSTs: ' + JSON.stringify(posted));
ck(mbPosts.length === 0, `no edit was submitted (${mbPosts.length})`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
