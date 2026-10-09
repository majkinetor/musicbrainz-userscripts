// #566 (majkinetor): "Automatically repeat failures up to [N] minutes or [M]
// times […] Current minutes/times should be visible in the footer of the commit
// window when it happens." His follow-up moved the note to its own footer row
// and changed the defaults: on, N=M=10. The layout half of that lives in
// verify-566b; this one still owns the behaviour.
//
// Driven through the real commit path: a file is staged, the Internet Archive
// upload is made to fail at the network layer, and the dialog is left to do
// whatever it does. What is asserted is behaviour, not the presence of settings:
//
//   · turned off, a failed run just waits for a manual Repeat;
//   · on, it retries BY ITSELF, and the footer says which attempt and how much
//     of the allowance is gone;
//   · it stops at the attempt limit, and says why;
//   · closing the dialog kills the countdown — a background timer that outlives
//     its window would keep hammering the Archive with nothing on screen.
//
// Nothing is uploaded and no edit is created: every POST is aborted at the
// network layer and asserted zero. Runs on test.musicbrainz.org.
import { test, check, attachShot, until, frames } from '../../../dev/test/harness.mjs';
import { openArtStation, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('failed uploads repeat by themselves, say so in the footer, stop at the limit, and stop when closed', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const posts = await blockPosts(page);
  // a fake clock: the countdowns, the gaps between attempts and "past the 20 s gap"
  // are jumped over exactly, rather than waited out
  await page.clock.install();
  await openArtStation(page, inject, { path: 'add-cover-art' });

  // ── the setting (its defaults and their migration are 566b's) ─────────────────
  await page.click('#as-switch', { button: 'right' });
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  const ui = await page.evaluate(() => {
    const cb = document.querySelector('.as-setup-autorepeat');
    const mn = document.querySelector('.as-setup-ar-min');
    const tm = document.querySelector('.as-setup-ar-times');
    if (!cb || !mn || !tm) return { missing: true };
    return { missing: false, checked: cb.checked, min: mn.value, times: tm.value, label: (cb.closest('.as-setup-opt') || {}).textContent.replace(/\s+/g, ' ').trim() };
  });
  console.log('setup: ' + JSON.stringify(ui));
  check(!ui.missing, '#566: the setup panel has the auto-repeat option');
  // the two numbers live in <input value=…>, which textContent does not include —
  // so assert the wording around them and the inputs separately
  check(!ui.missing && /repeat failures up to\s+minutes or\s+times/i.test(ui.label), 'worded as the issue asks — ' + JSON.stringify(ui.label));

  // clamping, so a 0 cannot turn this into a hot loop against a struggling server
  const clamped = await page.evaluate(() => {
    const set = (sel, v) => { const i = document.querySelector(sel); i.value = String(v); i.dispatchEvent(new Event('change', { bubbles: true })); return i.value; };
    return { zeroMin: set('.as-setup-ar-min', 0), emptyTimes: set('.as-setup-ar-times', ''), hugeMin: set('.as-setup-ar-min', 9999) };
  });
  console.log('clamping: ' + JSON.stringify(clamped));
  check(clamped.zeroMin === '10' && clamped.emptyTimes === '10', 'a zero/empty box falls back to the default rather than persisting a hot loop');
  check(clamped.hugeMin === '240', 'and an absurd window is capped (' + clamped.hugeMin + ')');

  // ── drive a real commit whose upload fails ──────────────────────────────────
  const arm = async (on, minutes, times) => page.evaluate(async ([on2, m, t]) => {
    document.getElementById('as-setup')?.remove();
    document.getElementById('as-switch').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 200 && !document.querySelector('.as-setup-autorepeat'); i++) await new Promise(r => setTimeout(r, 25));
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
  check(await stageAndCommit(), 'fixture: the commit ran and failed, offering Repeat');
  await page.clock.runFor(30000);   // longer than any gap an auto-repeat would wait
  await frames(page);
  const offState = await page.evaluate(() => {
    // The row is always present now - it reserves its space so the buttons cannot
    // move - so "not showing" means invisible and empty, not absent.
    const el = document.querySelector('.as-cm-ar');
    return { hidden: !el || (!el.classList.contains('on') && !el.textContent), text: el ? el.textContent : null };
  });
  console.log('with the option OFF: ' + JSON.stringify(offState));
  check(offState.hidden, '#566: with the option off there is no auto-repeat and no footer note');

  // 2. ON — it retries by itself and reports progress in the footer
  await page.evaluate(() => document.querySelector('.as-cm-cancel')?.click());
  await arm(true, 1, 3);          // 1 minute / 3 tries -> a 20s gap
  check(await stageAndCommit(), 'fixture: second commit ran and failed');
  const note = await page.waitForFunction(
    () => { const e = document.querySelector('.as-cm-ar'); return e && e.classList.contains('on') && /Auto-repeat: attempt/.test(e.textContent) ? e.textContent : null; },
    null, { timeout: 15000 }).then(h => h.jsonValue()).catch(() => null);
  console.log('footer: ' + JSON.stringify(note));
  check(!!note, '#566: the footer of the commit window announces the auto-repeat');
  check(!!note && /attempt 1\/3/.test(note), 'naming the attempt and the limit — ' + JSON.stringify(note));
  check(!!note && /of 1m used/.test(note), 'and how much of the minute allowance is gone');
  check(!!note && /\d+ failing/.test(note), 'and how many operations are still failing');
  await attachShot(testInfo, page.locator('.as-cm-box'), 'i566-footer');

  // the countdown must actually tick, not just render once
  const read = () => page.evaluate(() => (document.querySelector('.as-cm-ar') || {}).textContent || '');
  const a = await read();
  await page.clock.runFor(2200);
  const ticked = { a, b: await read() };
  check(ticked.a !== ticked.b, `the countdown updates (${JSON.stringify(ticked.a)} -> ${JSON.stringify(ticked.b)})`);

  // 3. it gives up at the limit, and says why
  // each gap is jumped over; the failed upload in between runs as it would
  const gaveUp = await until(async () => {
    const t = await page.evaluate(() => { const e = document.querySelector('.as-cm-ar'); return e && /gave up/.test(e.textContent) ? e.textContent : null; });
    if (!t) await page.clock.runFor(5000);
    return t;
  }, Boolean, { timeout: 60000 });
  console.log('gave up: ' + JSON.stringify(gaveUp));
  check(!!gaveUp, '#566: it stops at the limit instead of retrying forever');
  check(!!gaveUp && /Press Repeat/.test(gaveUp || ''), 'and tells you the manual Repeat is still there');

  // 4. closing the window must kill the timer
  await page.evaluate(() => document.querySelector('.as-cm-cancel')?.click());
  await arm(true, 1, 3);
  check(await stageAndCommit(), 'fixture: third commit ran and failed');
  await page.waitForFunction(() => { const e = document.querySelector('.as-cm-ar'); return e && e.classList.contains('on'); }, null, { timeout: 15000 }).catch(() => {});
  const beforeClose = posts.length;
  await page.evaluate(() => document.querySelector('.as-cm-cancel')?.click());
  await page.clock.runFor(26000);          // past the 20s gap the countdown was on
  await frames(page);                      // a retry would have gone out by now
  const afterClose = posts.length;
  const stray = await page.evaluate(() => !!document.querySelector('.as-cm-ar'));
  console.log(`POSTs before close ${beforeClose}, after ${afterClose}`);
  check(!stray, 'closing the dialog takes the whole window, footer row included');
  check(afterClose === beforeClose, `#566: and kills the countdown — no retry fired after the window was closed (${afterClose - beforeClose} extra POST)`);

  console.log('POST endpoints seen: ' + JSON.stringify([...new Set(posts.map(u => u.replace(/\?.*/, '')))].slice(0, 4)));
  check(!posts.some(u => /ws\/js\/edit\/create/.test(u)), `no MusicBrainz edit was submitted (${posts.length} POST(s), all aborted)`);
});
