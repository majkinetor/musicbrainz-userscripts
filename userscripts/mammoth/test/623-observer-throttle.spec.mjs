// #623 (sweep, M1): Mammoth's page-wide observer (childList + subtree on <html>, on
// every MusicBrainz page) re-ran its whole scan — edit notes, dialogs, autocomplete
// menus with a getComputedStyle each — on EVERY mutation callback. A page that renders
// in bursts ran it hundreds of times. Now a burst runs it once, 60 ms later.
//
// A stub MusicBrainz page, no network: 200 mutations spread over 200 tasks, counting
// the scans through getComputedStyle calls on an open autocomplete menu.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Mammoth' } });

test('a burst of page mutations is scanned once, and new edit notes still get the panel', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><meta charset="utf-8"><body><ul class="ui-autocomplete" style="display:block"><li>x</li></ul><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
  await inject('mammoth');
  await page.waitForTimeout(800);   // let the boot scans settle

  const scans = await page.evaluate(async () => {
    const menu = document.querySelector('ul.ui-autocomplete');
    let n = 0; const real = window.getComputedStyle;
    window.getComputedStyle = function (el) { if (el === menu) n++; return real.apply(this, arguments); };
    for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 0)); document.getElementById('content').appendChild(document.createElement('span')); }
    await new Promise(r => setTimeout(r, 400));
    window.getComputedStyle = real;
    return n;
  });
  console.log('autocomplete-menu style reads during a 200-mutation burst:', scans);
  check(scans > 0, 'the scan still runs after a burst');
  check(scans <= 20, `…but a handful of times, not once per mutation (${scans})`);

  const wrapped = await page.evaluate(async () => {
    const ta = document.createElement('textarea'); ta.className = 'edit-note';
    document.getElementById('content').appendChild(ta);
    await new Promise(r => setTimeout(r, 400));
    return !!ta.closest('.mmth-wrap');
  });
  check(wrapped, 'an edit-note field added later still gets the Mammoth panel');
});
