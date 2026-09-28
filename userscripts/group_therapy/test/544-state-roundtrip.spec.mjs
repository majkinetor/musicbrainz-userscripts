// #544 follow-up (majkinetor): "When exiting and returning Text parser, any
// freezed patterns are gone. State should be kept completely."
//
// Freezing stamps the current pattern into each matching line's own override —
// that IS the freeze — and it was the one piece of row state saveState never
// carried, so reopening rebuilt every line with override:''. Two window states
// reset too: maximized (checked by 544-round5), and whether the paste box was rolled up.
//
// The test closes and REOPENS the real window rather than inspecting the saved
// object: what matters is what comes back on screen.
//
// Read-only: every POST is aborted and asserted at zero.
import { test, check, requireLogin, SANDBOX, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser comes back as it was left: text, pattern, frozen lines, rolled-up box', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const TEXT = 'Mastering: Nick Robbins\nProducer: Alice Example\nRecorded by - Bob Sample';

  const posts = await blockEdits(page);

  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
  }
  await requireLogin(page);
  await settled(page);
  await inject('group_therapy');
  await idle(page);

  const openParser = () => page.evaluate(() => window.__groupTherapy.openTextParser());
  const closeParser = () => page.evaluate(() => window.__groupTherapy.closeTextParser());
  const readUi = () => page.evaluate(() => {
    const panel = document.querySelector('.gt-tp');
    const ta = document.querySelector('.gt-tp-ta');
    return {
      open: !!panel,
      text: ta ? ta.value : null,
      pattern: (document.querySelector('.gt-tp-pat') || {}).value,
      overrides: [...document.querySelectorAll('.gt-tp-ov')].map(i => i.value),
      scope: (document.querySelector('.gt-tp-scope, select.gt-tp-scopekind') || {}).value,
      srcOpen: !!ta && getComputedStyle(ta).display !== 'none',
      rows: document.querySelectorAll('.gt-tp-tbl tbody tr').length,
    };
  });

  await openParser();
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await frames(page);

  // paste text, set a pattern, freeze what matches (all three lines here)
  await page.evaluate((t) => {
    const ta = document.querySelector('.gt-tp-ta');
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set;
    set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, TEXT);
  await frames(page);
  await page.evaluate(() => {
    const p = document.querySelector('.gt-tp-pat');
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p), 'value').set;
    set.call(p, 'R: E'); p.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await frames(page);

  const beforeFreeze = await readUi();
  console.log('before freeze: ' + JSON.stringify(beforeFreeze));
  check(beforeFreeze.rows >= 3, `the three pasted lines are in the table (${beforeFreeze.rows} rows)`);
  check(beforeFreeze.overrides.every(v => v === ''), 'and nothing is frozen yet');

  await page.evaluate(() => document.querySelector('.gt-tp-freeze').click());
  await frames(page);
  // and roll the paste box up (the maximized state is 544-round5's)
  await page.evaluate(() => document.querySelector('.gt-tp-srctgl').click());
  await frames(page);

  const frozen = await readUi();
  console.log('after freeze: ' + JSON.stringify(frozen));
  const frozenCount = frozen.overrides.filter(Boolean).length;
  check(frozenCount > 0, `freezing really stamped the pattern onto lines (${frozenCount} of ${frozen.overrides.length})`);
  check(frozen.overrides.filter(Boolean).every(v => v === 'R: E'), 'with the pattern that was in the box — ' + JSON.stringify(frozen.overrides));
  check(!frozen.srcOpen, 'the paste box is rolled up');

  /* ── close and reopen — the point of the whole test ───────────────────────── */
  await closeParser();
  await frames(page);
  check(!(await readUi()).open, 'the window really closed (otherwise nothing below is a test)');

  await openParser();
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await frames(page);
  const back = await readUi();
  console.log('after reopen : ' + JSON.stringify(back));

  check(back.text === frozen.text, 'the pasted text comes back');
  check(back.pattern === frozen.pattern, 'the pattern comes back');
  check(back.rows === frozen.rows, `the same rows come back (${back.rows} vs ${frozen.rows})`);
  check(JSON.stringify(back.overrides) === JSON.stringify(frozen.overrides),
    'THE FIX: the frozen patterns come back — ' + JSON.stringify(back.overrides));
  check(back.srcOpen === frozen.srcOpen, 'the paste box is still rolled up');

  console.log('POSTs: ' + JSON.stringify(posts.length));
  check(posts.length === 0, 'nothing was submitted');
});
