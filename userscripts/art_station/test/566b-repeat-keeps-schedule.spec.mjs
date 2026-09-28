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
//
// test.musicbrainz.org, read-only: the state machine runs on a stand-in commit window.
import { readFile } from 'node:fs/promises';
import { test, check, expect, sourceOf } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station', xhr: 'none', values: { 'artstation:settings': JSON.stringify({ autoRepeat: true, autoRepeatMin: 60, autoRepeatTimes: 61, arV: 1 }) } } });

test('a manual Repeat keeps auto-repeat going; the countdown never sticks at 0; counts are live', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const code = await readFile(sourceOf('art_station'), 'utf8');

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
  check(cancels && !abandons, 'the Repeat button cancels the pending wait, it does not abandon the schedule');

  /* A clock the test can push forward. The script reads Date.now() for the
     countdown, the budget and the give-up decision, and ticks it every second, so
     this is what makes a 60-second wait testable at once. */
  await page.clock.install();
  const posted = [];
  /* POSTs only. A first version routed every archive.org URL and counted 22 "uploads"
     — they were the cover-art thumbnails the page itself loads, and blocking them
     also risks breaking the page under test. */
  page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org|archive\.org/i.test(r.url())) posted.push(r.url()); });
  await openArtStation(page, inject);
  expect(await page.evaluate(() => !!window.__asAutoRepeat), 'the auto-repeat test hook is there').toBe(true);

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
  // a jump fires each due timer once, late, as in a throttled tab
  const advance = ms => page.clock.fastForward(ms);

  /* ── 1. the reported bug: a manual Repeat must not end auto-repeat ────────── */
  await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
  const s1 = await state();
  console.log('scheduled:', JSON.stringify(s1), '\n  label:', await label());
  check(s1 && s1.n === 1, `first attempt is scheduled (n=${s1 && s1.n})`);
  check(/attempt 1\/61 in /.test(await label()), 'a countdown is shown');

  // the manual press: cancel the wait, then run
  await page.evaluate(() => { window.__asAutoRepeat.cancelPending(window.__ov); window.__go(); });
  const s2 = await state();
  check(s2.abandoned === false, 'a manual Repeat does NOT abandon the schedule');
  check(!s2.hasTimer && !s2.hasTick, 'but it does drop the pending wait');
  // …and the run that follows schedules the next attempt, which is what stopped happening
  await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
  const s3 = await state();
  console.log('after a manual repeat + the next finish:', JSON.stringify(s3), '\n  label:', await label());
  check(s3.n === 2, `auto-repeat carries on and counts up (attempt ${s3.n})`);
  check(/attempt 2\/61 in /.test(await label()), 'and the countdown is back');

  /* ── 2. Cancel/Close still ends it for good ──────────────────────────────── */
  await page.evaluate(() => window.__asAutoRepeat.stop(window.__ov));
  const s4 = await state();
  check(s4.abandoned === true && !s4.hasTimer && !s4.hasTick, 'Cancel/Close abandons it, timers gone');
  check((await label()) === '', 'and clears the note');
  await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
  check((await state()).n === 2, 'a later finish cannot revive an abandoned schedule');

  /* ── 3. never "in 0s": past due it says so, and it starts itself ─────────── */
  await page.evaluate(() => { window.__ov._ar = null; window.__again = 0; });
  await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
  /* Nine seconds short of the ~59s delay. 59000 was the first try: it left 16ms,
     which renders as "due", so the check was aimed at the wrong state. */
  await advance(50000);
  await page.clock.runFor(1100);             // one tick renders
  const nearly = await label();
  console.log('\nnear due:', nearly);
  check(/in \d+s/.test(nearly) && !/in 0s/.test(nearly), `still counting down, not stuck on 0 (${nearly})`);
  await advance(20000);                      // now past due — the timer is late, as in a throttled tab
  await page.clock.runFor(1100);
  const due = await label();
  const fired = await page.evaluate(() => window.__again);
  console.log('past due:', due, '· again() calls:', fired);
  check(!/in 0s/.test(due), `past due never reads "in 0s" (${due})`);
  check(/due/.test(due) || fired >= 1, 'it says it is due, or has already started');
  check(fired >= 1, `the attempt started itself rather than waiting on a late timer (${fired})`);

  /* ── 4. the failing count is read live, not captured ─────────────────────── */
  await page.evaluate(() => { window.__ov._ar = null; });
  await page.evaluate(() => window.__asAutoRepeat.schedule(window.__ov, window.__go));
  const before = await label();
  await page.evaluate(() => {   // three more rows start failing after the schedule
    [1, 2, 3].forEach(i => document.querySelector(`#fake-ov .as-cm-op[data-i="${i}"]`).classList.add('err'));
  });
  await page.clock.runFor(1100);             // the next tick reads the count
  const after = await label();
  console.log('\nerr count — before:', before, '\n              after:', after);
  check(/1 failing/.test(before), `starts from the real count (${before})`);
  check(/4 failing/.test(after), `follows it live rather than showing the count from schedule time (${after})`);

  /* ── 5. the overall bar counts the whole commit ──────────────────────────── */
  const bar = code.includes('for (const op of plan) { const r = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`)')
    && /const total = plan\.length, pct/.test(code);
  check(bar, 'the overall progress bar counts the whole plan, not the retried subset');

  check(posted.length === 0, `nothing was uploaded or submitted (${posted.length})`);
});
