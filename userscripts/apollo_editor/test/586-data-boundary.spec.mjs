// #586 (majkinetor): "The original tracklist editor allows moving tracks between
// normal and data track section. In Apollo there are no move buttons but
// drag-n-drop which doesn't allow the same." His example is this release, whose
// last three tracks are video karaoke and belong in the data section.
//
// Apollo now puts ⤓ / ⤒ in the move column and moves the whole boundary in one
// click, because a data section is by definition a trailing block (see the long
// comment on setDataBoundary for what MB's own handlers do and why one-at-a-time
// is all they can offer).
//
// This drives the RENDERED BUTTON, not the function behind it, so a button that
// never got wired would fail here. Nothing is submitted — every write endpoint
// is blocked, and the flags are restored at the end.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ colWidths: { mv: 80 } }) });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

test('one click moves the data-track boundary', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posted = await openApollo(page, inject, { release: MBID });
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')];
    const t = all.find(x => x.textContent.trim().toLowerCase().startsWith('tracklist')); if (t) t.click();
  });
  await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(1200);

  const state = () => page.evaluate(() => {
    const ed = window.MB.releaseEditor;
    const m = ed.rootField.release().mediums()[0];
    return {
      flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
      audio: m.audioTracks().length, data: m.dataTracks().length,
      hasDataTracks: !!m.hasDataTracks(),
      toc: m.toc() == null ? null : 'set',
      dividers: document.querySelectorAll('.tc-mirror tr.tc-datadiv').length,
      dataRows: document.querySelectorAll('.tc-mirror tr.tc-row-data').length,
      downBtns: document.querySelectorAll('.tc-mirror .tc-dtmv.down:not(.void)').length,
      upBtns: document.querySelectorAll('.tc-mirror .tc-dtmv.up').length,
      /* chaban-mb: "Last track is not preserving space for move track down arrow."
         ⤓ is inert on the last track of a medium, but the SLOT still has to be
         there or that row's ⠿ handle sits at a different x than every other's.
         One distinct x across all handles is the check. */
      handleX: [...new Set([...document.querySelectorAll('.tc-mirror tr[data-tk] .tc-drag')]
        .map(h => Math.round(h.getBoundingClientRect().left)))],
      voidSlots: document.querySelectorAll('.tc-mirror .tc-dtmv.void').length,
    };
  });

  const before = await state();
  check(before.downBtns > 0, `the tracklist renders ⤓ boundary buttons (${before.downBtns})`);
  check(before.data === 0 && before.flags.indexOf('D') < 0, 'fixture starts with no data tracks');
  // ⤓ is only offered where it can act — never on the last track of a medium
  check(before.downBtns === before.flags.length - 1, `⤓ is offered on every track but the last (${before.downBtns} of ${before.flags.length})`);
  check(before.voidSlots === 1, `the last track still holds an inert ⤓ slot (${before.voidSlots})`);
  check(before.handleX.length === 1, `every ⠿ handle is at the same x — the last row reserves the ⤓ space (${JSON.stringify(before.handleX)})`);

  // click ⤓ on track 11 — the first of his three video karaoke tracks
  const clicked = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
    const b = tr && tr.querySelector('.tc-dtmv.down');
    if (!b) return 'no button on track 11';
    b.click(); return 'clicked';
  });
  await page.waitForTimeout(900);
  const after = await state();
  check(after.flags === '..........DDD', `#11–13 became data tracks in one click (${after.flags})`);
  check(after.audio === 10 && after.data === 3, `medium reports 10 audio / 3 data (${after.audio}/${after.data})`);
  check(after.hasDataTracks === true, 'the medium now reports hasDataTracks');
  check(after.toc === null, 'the disc TOC was cleared, as native does on every boundary move');
  check(after.dataRows === 3 && after.dividers === 1, `the mirror redrew them under one "⤓ Data tracks" divider (${after.dataRows} rows, ${after.dividers} divider)`);
  check(after.upBtns === 3, `each data row offers ⤒ back (${after.upBtns})`);

  // ⤒ on the FIRST data row must bring back exactly that one
  const up1 = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.tc-mirror tr.tc-row-data')][0];
    const b = tr && tr.querySelector('.tc-dtmv.up'); if (!b) return 'no ⤒';
    b.click(); return 'clicked';
  });
  await page.waitForTimeout(900);
  const afterUp = await state();
  check(afterUp.flags === '...........DD', `only #11 came back (${afterUp.flags})`);

  // ⤒ on the LAST data row must bring back the whole block — otherwise the data
  // section would stop being trailing, which MB does not allow.
  const up2 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tc-mirror tr.tc-row-data')];
    const b = rows[rows.length - 1] && rows[rows.length - 1].querySelector('.tc-dtmv.up'); if (!b) return 'no ⤒';
    b.click(); return 'clicked';
  });
  await page.waitForTimeout(900);
  const afterUp2 = await state();
  check(afterUp2.flags === '.............', `the section closed cleanly, nothing stranded (${afterUp2.flags})`);
  check(afterUp2.data === 0 && afterUp2.hasDataTracks === false, 'medium is back to no data tracks');

  /* Changing the model makes MB fetch an edit PREVIEW on its own (/ws/js/edit/preview);
     that is not a submission, and it is blocked here anyway. What must never appear
     is /ws/js/edit/create. */
  check(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
});
