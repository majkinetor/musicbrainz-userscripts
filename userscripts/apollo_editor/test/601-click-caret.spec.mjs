// #601 (majkinetor): "When clicking on a track, cursor should always be on the
// place that is clicked. Current behavior is that it rarely does that and mostly
// moves to start/end… requires one to need 2 clicks to position the cursor
// instead 1."
//
// Cause: with title enlargement on (#203, and it is on by default at 3px) the
// visible title is a <span class="t-title-disp">; the real input rests at 1x1
// with pointer-events:none, so a click can only ever land on the span. Its
// handler was
//
//     disp.addEventListener('mousedown', e => { e.preventDefault(); tin.focus(); });
//
// and preventDefault is precisely what stops the browser placing a caret, so
// focus() left it wherever the input had it last — 0, or the end.
//
// The assertion here does NOT reuse the implementation's own caret mapping.
// It measures, with a Range, the pixel box of one specific character, clicks
// inside that box, and requires the caret to land on that character's index.
// So the test would still catch a mapping that is self-consistently wrong.
//
// Read-only: every MusicBrainz write endpoint is aborted, and the only thing
// this does to the page is click in a text field.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

test('a click puts the caret where it lands', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posted = await openApollo(page, inject, { release: MBID });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(e => e.textContent.trim().toLowerCase().startsWith('tracklist')); if (b) b.click(); });
  await page.waitForTimeout(3000);

  // The overlay only exists while enlargement is on. Assert the EFFECTIVE state
  // rather than trusting the default — a stored 0 would silently make every
  // check below vacuous (there would be no span to click).
  const setup = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tc-mirror tr[data-tk]')];
    const withDisp = rows.filter(r => r.querySelector('.t-title-disp'));
    // the longest title gives the most room to aim inside
    let best = null;
    for (const r of withDisp) {
      const inp = r.querySelector('.t-title');
      if (inp && (!best || (inp.value || '').length > (best.v || '').length)) best = { r, v: inp.value };
    }
    if (best) best.r.dataset.t601 = '1';
    return { rows: rows.length, withDisp: withDisp.length, title: best && best.v };
  });
  check(setup.withDisp > 0, 'title enlargement is on, so the rich display span is what gets clicked');
  check(!!setup.title && setup.title.length >= 8, `the chosen title is long enough to aim inside (${setup.title ? setup.title.length : 0} chars)`);
  if (!setup.withDisp || !setup.title) { return; }

  // Pixel box of character k, measured with a Range over the span's own text —
  // independent of how the script maps a point to an index.
  const charBox = (k) => page.evaluate((i) => {
    const disp = document.querySelector('tr[data-t601] .t-title-disp');
    const walkText = [];
    (function w(n) { for (const c of n.childNodes) { if (c.nodeType === 3) walkText.push(c); else w(c); } })(disp);
    let seen = 0;
    for (const tn of walkText) {
      const len = tn.nodeValue.length;
      if (seen + len > i) {
        const r = document.createRange();
        r.setStart(tn, i - seen); r.setEnd(tn, i - seen + 1);
        const b = r.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      }
      seen += len;
    }
    return null;
  }, k);
  // ⚠ MUST run before charBox(). Once a click has succeeded the input is focused
  // and the span is display:none, so measuring it returns a zero-size rect and the
  // next click lands at garbage coordinates — hitting nothing, leaving the caret
  // where the PREVIOUS click put it. That looked exactly like a product failure in
  // two of these checks until the rects were printed.
  const rest = async () => {
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await page.waitForTimeout(200);
  };
  const caretAfterClick = async (x, y) => {
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    return page.evaluate(() => {
      const inp = document.querySelector('tr[data-t601] .t-title');
      return { start: inp.selectionStart, end: inp.selectionEnd, focused: document.activeElement === inp, value: inp.value };
    });
  };

  const title = setup.title;
  const targets = [3, Math.floor(title.length / 2), title.length - 2].filter((v, i, a) => v > 0 && v < title.length && a.indexOf(v) === i);
  for (const k of targets) {
    await rest();
    const b = await charBox(k);
    if (!b || !(b.w > 0)) { check(false, `could not measure character ${k} (${JSON.stringify(b)})`); continue; }
    // the left quarter of the glyph — unambiguously nearer the boundary BEFORE it,
    // so the expected caret index is exactly k
    const got = await caretAfterClick(b.x + Math.max(1, b.w * 0.25), b.y + b.h / 2);
    console.log(`  char ${String(k).padStart(2)} (${JSON.stringify(title[k])}) -> caret ${got.start}${got.start === got.end ? '' : '-' + got.end}   focused=${got.focused}`);
    check(got.focused, `clicking character ${k} focuses the real input`);
    check(got.start === k, `THE FIX: ONE click puts the caret at the character clicked — expected ${k}, got ${got.start}`);
  }

  // clicking past the end of the text means the end, as in any text field
  await rest();
  const last = await charBox(title.length - 1);
  const past = await caretAfterClick(last.x + last.w + 60, last.y + last.h / 2);
  check(past.focused && past.start === title.length, 'a click past the end of the text lands at the end');

  // and the resting/editing swap still works
  const swapped = await page.evaluate(() => {
    const row = document.querySelector('tr[data-t601]');
    return { editing: row.querySelector('.t-title').classList.contains('tc-editing'), dispHidden: row.querySelector('.t-title-disp').classList.contains('tc-hidden') };
  });
  check(swapped.editing && swapped.dispHidden, 'the input takes over and the display span hides, as before');

  check(posted.length === 0, `nothing was submitted (${posted.length})`);
});
