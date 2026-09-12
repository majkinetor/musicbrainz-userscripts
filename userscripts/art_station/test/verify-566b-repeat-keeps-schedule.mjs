// #566 reopened (majkinetor), two reports:
//
//   "it kept counting while next attempt in 0s, and also progress bar was glitchy"
//   "There was also a case when I manually repeated before ticking was completed
//    and it just stopped after that retry (no repeats were done or counting)."
//
// The second is provable from the code and is the one this file is mostly about:
// the Repeat button called arStop, which marks the schedule ABANDONED, and
// arSchedule returns immediately on that flag — so one manual press ended
// auto-repeat for the rest of the window. His log bears it out: every gap after
// the first attempt is shorter than arDelayMs' 10s floor (2.9s, 7.0s), so those
// were his clicks, and no second "auto-repeat attempt" line was ever logged.
//
// His gif gave the rest:
//
//   Auto-repeat: attempt 2/61 in 0s · 3m17s of 60m used · 3 failing
//                       Repeat (1 failed)        ← button says 1, label says 3
//                       2 / 2 · 100%             ← bar, above five listed rows
//
// so: a countdown frozen at "in 0s", an error count captured at schedule time
// instead of read live, and an overall bar counting the retried subset rather
// than the commit.
//
// Driving real archive.org 500s is not possible here, so the state machine is
// driven directly through its test hook, with Date.now under the test's control
// so time can be advanced without waiting for it.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

/* Source-level, and deliberately first: the old build has no test hook, so every
   behavioural check below can only report "no hook" there — which aborts honestly
   but demonstrates nothing. This one encodes the bug itself and fails on the old
   build, where the handler read `arStop(ov); again();` and arStop sets the
   abandoned flag that arSchedule returns on. */
/* Matched on the call pair rather than on `b.onclick`: the first attempt grabbed
   the FIRST b.onclick in the file — an unrelated source-popup handler — and so
   failed on the fixed build too, for the wrong reason. */
const cancels = /arCancelPending\(ov\);\s*again\(\);/.test(code);
const abandons = /arStop\(ov\);\s*again\(\);/.test(code);
console.log(`Repeat handler — cancelPending+again: ${cancels} · stop+again: ${abandons}`);
ck(cancels && !abandons, 'the Repeat button cancels the pending wait, it does not abandon the schedule');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map([['artstation:settings', JSON.stringify({ autoRepeat: true, autoRepeatMin: 60, autoRepeatTimes: 61, arV: 1 })]]);
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Art Station', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
  /* A clock the test can push forward. The script reads Date.now() for the
     countdown, the budget and the give-up decision, so this is what makes a
     60-second wait testable in a second. */
  const realNow = Date.now.bind(Date);
  window.__clock = { skew: 0 };
  Date.now = () => realNow() + window.__clock.skew;
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
/* POSTs only. A first version routed every archive.org URL and counted 22 "uploads"
   — they were the cover-art thumbnails the page itself loads, and blocking them
   also risks breaking the page under test. */
page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org|archive\.org/i.test(r.url())) posted.push(r.url()); });
// Art Station boots on a release's cover-art page.
await page.goto('https://musicbrainz.org/release/55530bc0-97ec-4256-97fc-e6058958c251/cover-art', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
const hooked = await page.waitForFunction(() => !!window.__asAutoRepeat, null, { timeout: 20000 }).then(() => true).catch(() => false);
ck(hooked, 'the auto-repeat hook is available');
if (!hooked) { console.log('no hook on this build — nothing further to measure'); await ctx.close(); console.log(fail + ' FAILED'); process.exit(1); }

// A stand-in commit overlay: the note row plus five op rows, one of them failing.
await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'fake-ov';
  ov.innerHTML = '<div class="as-cm-ar"></div>'
    + [0, 1, 2, 3, 4].map(i => `<div class="as-cm-op${i === 4 ? ' err' : ''}" data-i="${i}"><span class="as-cm-st">${i === 4 ? '❌' : '✅'}</span></div>`).join('');
  document.body.appendChild(ov);
  window.__ov = ov;
  window.__again = 0;
  window.__go = () => { window.__again++; };
});
const label = () => page.evaluate(() => (document.querySelector('#fake-ov .as-cm-ar') || {}).textContent || '');
const state = () => page.evaluate(() => { const st = window.__asAutoRepeat.state(window.__ov); return st ? { n: st.n, abandoned: st.abandoned, gen: st.gen, running: st.running, hasTimer: !!st.timer, hasTick: !!st.tick } : null; });
const advance = ms => page.evaluate(m => { window.__clock.skew += m; }, ms);

/* ── 1. the reported bug: a manual Repeat must not end auto-repeat ────────── */
await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
const s1 = await state();
console.log('scheduled:', JSON.stringify(s1), '\n  label:', await label());
ck(s1 && s1.n === 1, `first attempt is scheduled (n=${s1 && s1.n})`);
ck(/attempt 1\/61 in /.test(await label()), 'a countdown is shown');

// the manual press: cancel the wait, then run
await page.evaluate(() => { window.__asAutoRepeat.cancelPending(window.__ov); window.__go(); });
const s2 = await state();
ck(s2.abandoned === false, 'a manual Repeat does NOT abandon the schedule');
ck(!s2.hasTimer && !s2.hasTick, 'but it does drop the pending wait');
// …and the run that follows schedules the next attempt, which is what stopped happening
await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
const s3 = await state();
console.log('after a manual repeat + the next finish:', JSON.stringify(s3), '\n  label:', await label());
ck(s3.n === 2, `auto-repeat carries on and counts up (attempt ${s3.n})`);
ck(/attempt 2\/61 in /.test(await label()), 'and the countdown is back');

/* ── 2. Cancel/Close still ends it for good ──────────────────────────────── */
await page.evaluate(() => window.__asAutoRepeat.stop(window.__ov));
const s4 = await state();
ck(s4.abandoned === true && !s4.hasTimer && !s4.hasTick, 'Cancel/Close abandons it, timers gone');
ck((await label()) === '', 'and clears the note');
await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
ck((await state()).n === 2, 'a later finish cannot revive an abandoned schedule');

/* ── 3. never "in 0s": past due it says so, and it starts itself ─────────── */
await page.evaluate(() => { window.__ov._ar = null; window.__again = 0; });
await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
/* Nine seconds short of the ~59s delay. 59000 was the first try: it left 16ms,
   which renders as "due", so the check was aimed at the wrong state. */
await advance(50000);
await page.waitForTimeout(1200);           // let a tick render
const nearly = await label();
console.log('\nnear due:', nearly);
ck(/in \d+s/.test(nearly) && !/in 0s/.test(nearly), `still counting down, not stuck on 0 (${nearly})`);
await advance(20000);                      // now past due — the timer is late, as in a throttled tab
await page.waitForTimeout(1400);
const due = await label();
const fired = await page.evaluate(() => window.__again);
console.log('past due:', due, '· again() calls:', fired);
ck(!/in 0s/.test(due), `past due never reads "in 0s" (${due})`);
ck(/due/.test(due) || fired >= 1, 'it says it is due, or has already started');
ck(fired >= 1, `the attempt started itself rather than waiting on a late timer (${fired})`);

/* ── 4. the failing count is read live, not captured ─────────────────────── */
await page.evaluate(() => { window.__ov._ar = null; });
await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
const before = await label();
await page.evaluate(() => {   // three more rows start failing after the schedule
  [1, 2, 3].forEach(i => document.querySelector(`#fake-ov .as-cm-op[data-i="${i}"]`).classList.add('err'));
});
await page.waitForTimeout(1200);
const after = await label();
console.log('\nerr count — before:', before, '\n              after:', after);
ck(/1 failing/.test(before), `starts from the real count (${before})`);
ck(/4 failing/.test(after), `follows it live rather than showing the count from schedule time (${after})`);

/* ── 5. the overall bar counts the whole commit ──────────────────────────── */
const bar = code.includes('for (const op of plan) { const r = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`)')
  && /const total = plan\.length, pct/.test(code);
ck(bar, 'the overall progress bar counts the whole plan, not the retried subset');

ck(posted.length === 0, `nothing was uploaded or submitted (${posted.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
