// #279: ↓ in the tracklist moves to the next row's title. With "Keep caret position" on
// (the default) the caret keeps its column; off, the whole field is selected, so the
// next keystroke overwrites it.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const COL = 3;
for (const keep of [true, false]) {
  test.describe(`keep caret ${keep ? 'on' : 'off'}`, () => {
    test.use({ gm: apolloGm({ keepCaretColumn: keep }) });
    test(`↓ ${keep ? 'keeps the caret column' : 'selects the next title'}`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
      await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
      await page.evaluate(col => { const t = document.querySelectorAll('.t-title')[0]; t.focus(); t.setSelectionRange(col, col); }, COL);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const el = document.activeElement;
        return { idx: [...document.querySelectorAll('.t-title')].indexOf(el), len: (el.value || '').length, s: el.selectionStart, e: el.selectionEnd };
      });
      check(r.idx === 1, `the next row's title has the focus (${r.idx})`);
      if (keep) check(r.s === r.e && r.s === Math.min(COL, r.len), `a caret, in column ${COL} (${r.s}/${r.e})`);
      else check(r.s === 0 && r.e === r.len && r.len > 0, `the whole title selected (${r.s}/${r.e} of ${r.len})`);
    });
  });
}
