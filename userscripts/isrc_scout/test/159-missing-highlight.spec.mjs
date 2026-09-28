// #159: a row still missing an ISRC (none on the recording, nothing entered) is
// highlighted, on the same condition as the footer's "still missing" count: entering an
// ISRC clears the highlight, clearing the field brings it back.
//
// test.musicbrainz.org, with production's data for 安東ウメ子 — ウポポ サンケ (14 tracks,
// one without an ISRC), from fixtures/ws-159.json.gz (RECORD_WS=1 to refresh).
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('rows missing an ISRC are highlighted, and follow what is typed', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: '94cc33be-6d7c-495b-9e6d-cd6e40786fcc', replay: new URL('./fixtures/ws-159.json.gz', import.meta.url) });
  const audit = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('#ii-tbody tr[data-idx]')];
    let mismatches = 0, missing = 0;
    for (const r of rows) {
      const want = !!r.querySelector('.ii-existing .none') && !(r.querySelector('.ii-input')?.value || '').trim();
      if (want) missing++;
      if (want !== r.classList.contains('ii-row-missing')) mismatches++;
    }
    return { rows: rows.length, missing, mismatches };
  });
  const a = await audit();
  check(a.rows === 14 && a.missing === 1, `14 rows, one missing its ISRC (${JSON.stringify(a)})`);
  check(a.mismatches === 0, `exactly the rows missing an ISRC are highlighted (${a.mismatches} wrong)`);

  const idx = await page.evaluate(() => { const r = [...document.querySelectorAll('#ii-tbody tr[data-idx]')].find(x => x.querySelector('.ii-existing .none')); return r ? r.dataset.idx : null; });
  const sel = `#ii-tbody tr[data-idx="${idx}"]`;
  await page.fill(sel + ' .ii-input', 'USABC1234567');
  check(!(await until(() => page.evaluate(s => document.querySelector(s).classList.contains('ii-row-missing'), sel), v => !v)), 'entering an ISRC clears the highlight');
  await page.fill(sel + ' .ii-input', '');
  await page.dispatchEvent(sel + ' .ii-input', 'input');
  check(await until(() => page.evaluate(s => document.querySelector(s).classList.contains('ii-row-missing'), sel)), 'clearing it brings the highlight back');
  await ws.done();
});
