// #544 follow-up (majkinetor): "When exiting and returning Text parser, any
// freezed patterns are gone. State should be kept completely."
//
// Freezing stamps the current pattern into each matching line's own override —
// that IS the freeze — and it was the one piece of row state saveState never
// carried, so reopening rebuilt every line with override:''. (#798: the paste box
// rolls itself up when you leave it, and there is no maximize, so no window state.)
//
// The test closes and REOPENS the real window rather than inspecting the saved
// object: what matters is what comes back on screen.
//
// Read-only: every POST is aborted and asserted at zero.
import { test, check, requireLogin, SANDBOX, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits, tpSettle } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser comes back as it was left: text, pattern, frozen lines', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
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
      // a line's own pattern, by line number (a line shows once, under its name)
      overrides: [...new Map([...document.querySelectorAll('.gt-tp-line')].map(l => [+l.querySelector('.gt-tp-line-no').textContent, l.querySelector('.gt-tp-ov').value])).entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]),
      scope: (document.querySelector('.gt-tp-scope-sel') || {}).value,
      rows: panel ? window.__groupTherapy.txpCredits().filter(c => c.matched).length : 0,
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
  await tpSettle(page);

  const beforeFreeze = await readUi();
  console.log('before freeze: ' + JSON.stringify(beforeFreeze));
  check(beforeFreeze.rows >= 3, `the three pasted lines are in the table (${beforeFreeze.rows} credits)`);
  check(beforeFreeze.overrides.every(v => v === ''), 'and nothing is frozen yet');

  await page.evaluate(() => document.querySelector('.gt-tp-freeze').click());
  await frames(page);

  const frozen = await readUi();
  console.log('after freeze: ' + JSON.stringify(frozen));
  const frozenCount = frozen.overrides.filter(Boolean).length;
  check(frozenCount > 0, `freezing really stamped the pattern onto lines (${frozenCount} of ${frozen.overrides.length})`);
  check(frozen.overrides.filter(Boolean).every(v => v === 'R: E'), 'with the pattern that was in the box — ' + JSON.stringify(frozen.overrides));

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
  check(back.rows === frozen.rows, `the same credits come back (${back.rows} vs ${frozen.rows})`);
  check(JSON.stringify(back.overrides) === JSON.stringify(frozen.overrides),
    'THE FIX: the frozen patterns come back — ' + JSON.stringify(back.overrides));

  console.log('POSTs: ' + JSON.stringify(posts.length));
  check(posts.length === 0, 'nothing was submitted');
});
