// #566 (majkinetor): "Automatically repeat failures up to [N] minutes or [M]
// times […] Current minutes/times should be visible in the footer of the commit
// window when it happens. By default option is not enabled and N=M=20."
//
// Driven through the real commit path: a file is staged, the Internet Archive
// upload is made to fail at the network layer, and the dialog is left to do
// whatever it does. What is asserted is behaviour, not the presence of settings:
//
//   · off by default, and a failed run then just waits for a manual Repeat;
//   · on, it retries BY ITSELF, and the footer says which attempt and how much
//     of the allowance is gone;
//   · it stops at the attempt limit, and says why;
//   · closing the dialog kills the countdown — a background timer that outlives
//     its window would keep hammering the Archive with nothing on screen.
//
// Nothing is uploaded and no edit is created: every POST is aborted at the
// network layer and asserted zero. Runs on test.musicbrainz.org.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Art Station', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let posts = 0; const postUrls = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posts++; postUrls.push(r.url()); return route.abort(); }
  return route.continue();
});
await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(600);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 20000 });
await page.waitForTimeout(600);

// ── the setting exists, with the defaults the issue specifies ───────────────
await page.click('#as-setup-btn');
await page.waitForSelector('#as-setup', { timeout: 5000 });
const ui = await page.evaluate(() => {
  const cb = document.querySelector('.as-setup-autorepeat');
  const mn = document.querySelector('.as-setup-ar-min');
  const tm = document.querySelector('.as-setup-ar-times');
  if (!cb || !mn || !tm) return { missing: true };
  return { missing: false, checked: cb.checked, min: mn.value, times: tm.value, label: (cb.closest('.as-setup-opt') || {}).textContent.replace(/\s+/g, ' ').trim() };
});
console.log('setup: ' + JSON.stringify(ui));
ck(!ui.missing, '#566: the setup panel has the auto-repeat option');
ck(!ui.missing && ui.checked === false, 'off by default');
ck(!ui.missing && ui.min === '20' && ui.times === '20', `N=M=20 by default (got ${ui.min}/${ui.times})`);
// the two numbers live in <input value=…>, which textContent does not include —
// so assert the wording around them and the inputs separately
ck(!ui.missing && /repeat failures up to\s+minutes or\s+times/i.test(ui.label), 'worded as the issue asks — ' + JSON.stringify(ui.label));

// clamping, so a 0 cannot turn this into a hot loop against a struggling server
const clamped = await page.evaluate(() => {
  const set = (sel, v) => { const i = document.querySelector(sel); i.value = String(v); i.dispatchEvent(new Event('change', { bubbles: true })); return i.value; };
  return { zeroMin: set('.as-setup-ar-min', 0), emptyTimes: set('.as-setup-ar-times', ''), hugeMin: set('.as-setup-ar-min', 9999) };
});
console.log('clamping: ' + JSON.stringify(clamped));
ck(clamped.zeroMin === '20' && clamped.emptyTimes === '20', 'a zero/empty box falls back to the default rather than persisting a hot loop');
ck(clamped.hugeMin === '240', 'and an absurd window is capped (' + clamped.hugeMin + ')');

// ── drive a real commit whose upload fails ──────────────────────────────────
const arm = async (on, minutes, times) => page.evaluate(async ([on2, m, t]) => {
  document.getElementById('as-setup')?.remove();
  document.getElementById('as-setup-btn').click();
  await new Promise(r => setTimeout(r, 300));
  const set = (sel, v, isCheck) => {
    const i = document.querySelector(sel);
    if (isCheck) { i.checked = v; } else { i.value = String(v); }
    i.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set('.as-setup-ar-min', m); set('.as-setup-ar-times', t); set('.as-setup-autorepeat', on2, true);
  document.getElementById('as-setup')?.remove();
}, [on, minutes, times]);

const stageAndCommit = async () => page.evaluate(async () => {
  document.querySelectorAll('.as-cm-ov, #as-commit').forEach(e => e.remove());
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const dt = new DataTransfer(); dt.items.add(new File([png], 'ar-probe.png', { type: 'image/png' }));
  window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('.as-commit')?.disabled) break; }
  document.querySelector('.as-commit').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  // wait for the run to finish and the button to offer a Repeat
  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 100));
    const b = document.querySelector('.as-cm-go');
    if (b && /Repeat/.test(b.textContent)) return true;
  }
  return false;
});

// 1. OFF — a failed run must sit there waiting for a human
await arm(false, 20, 20);
ck(await stageAndCommit(), 'fixture: the commit ran and failed, offering Repeat');
await page.waitForTimeout(2500);
const offState = await page.evaluate(() => {
  const el = document.querySelector('.as-cm-ar');
  return { hidden: !el || el.hidden, text: el ? el.textContent : null };
});
console.log('with the option OFF: ' + JSON.stringify(offState));
ck(offState.hidden, '#566: with the option off there is no auto-repeat and no footer note');

// 2. ON — it retries by itself and reports progress in the footer
await page.evaluate(() => document.querySelector('.as-cm-cancel')?.click());
await arm(true, 1, 3);          // 1 minute / 3 tries -> a 20s gap
ck(await stageAndCommit(), 'fixture: second commit ran and failed');
const note = await page.waitForFunction(
  () => { const e = document.querySelector('.as-cm-ar'); return e && !e.hidden && /Auto-repeat: attempt/.test(e.textContent) ? e.textContent : null; },
  null, { timeout: 15000 }).then(h => h.jsonValue()).catch(() => null);
console.log('footer: ' + JSON.stringify(note));
ck(!!note, '#566: the footer of the commit window announces the auto-repeat');
ck(!!note && /attempt 1\/3/.test(note), 'naming the attempt and the limit — ' + JSON.stringify(note));
ck(!!note && /of 1m used/.test(note), 'and how much of the minute allowance is gone');
ck(!!note && /\d+ failing/.test(note), 'and how many operations are still failing');
await page.locator('.as-cm-f').screenshot({ path: resolve(SHOTS, 'i566-footer.png') }).catch(() => {});

// the countdown must actually tick, not just render once
const ticked = await page.evaluate(async () => {
  const read = () => (document.querySelector('.as-cm-ar') || {}).textContent || '';
  const a = read(); await new Promise(r => setTimeout(r, 2200)); return { a, b: read() };
});
ck(ticked.a !== ticked.b, `the countdown updates (${JSON.stringify(ticked.a)} -> ${JSON.stringify(ticked.b)})`);

// 3. it gives up at the limit, and says why
const gaveUp = await page.waitForFunction(
  () => { const e = document.querySelector('.as-cm-ar'); return e && /gave up/.test(e.textContent) ? e.textContent : null; },
  null, { timeout: 120000 }).then(h => h.jsonValue()).catch(() => null);
console.log('gave up: ' + JSON.stringify(gaveUp));
ck(!!gaveUp, '#566: it stops at the limit instead of retrying forever');
ck(!!gaveUp && /Press Repeat/.test(gaveUp || ''), 'and tells you the manual Repeat is still there');

// 4. closing the window must kill the timer
await page.evaluate(() => document.querySelector('.as-cm-cancel')?.click());
await arm(true, 1, 3);
ck(await stageAndCommit(), 'fixture: third commit ran and failed');
await page.waitForFunction(() => { const e = document.querySelector('.as-cm-ar'); return e && !e.hidden; }, null, { timeout: 15000 }).catch(() => {});
const beforeClose = posts;
await page.evaluate(() => document.querySelector('.as-cm-cancel')?.click());
await page.waitForTimeout(26000);          // past the 20s gap the countdown was on
const afterClose = posts;
const stray = await page.evaluate(() => !!document.querySelector('.as-cm-ar'));
console.log(`POSTs before close ${beforeClose}, after ${afterClose}`);
ck(!stray, 'closing the dialog removes the footer note');
ck(afterClose === beforeClose, `#566: and kills the countdown — no retry fired after the window was closed (${afterClose - beforeClose} extra POST)`);

console.log('POST endpoints seen: ' + JSON.stringify([...new Set(postUrls.map(u => u.replace(/\?.*/, '')))].slice(0, 4)));
ck(!postUrls.some(u => /ws\/js\/edit\/create/.test(u)), `no MusicBrainz edit was submitted (${posts} POST(s), all aborted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
