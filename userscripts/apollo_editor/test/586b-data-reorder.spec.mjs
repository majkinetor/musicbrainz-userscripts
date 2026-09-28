// #586 follow-up. chaban-mb, on the boundary buttons: "But is it intentional
// within the data section tracks cannot be reordered?" It wasn't a consequence
// of those buttons — #330 excluded pregap AND data rows from drag-reorder when
// it first added the section — but native does allow it: moveTrackDown falls
// through to swapTracks when both tracks are data, and isn't disc-ID-disabled in
// that case either.
//
// So data rows drag among data rows now, and a drag still cannot cross the
// boundary — that direction is what ⤓/⤒ are for, and MB's moveTrackUp DEMOTES
// the first data track rather than swapping, so a crossing drag would strand a
// track mid-list in a state MB rejects.
//
// The drag is driven through real DragEvents with a DataTransfer, so the
// handlers under test are the ones the browser would call.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

test('data tracks reorder among themselves', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posted = await openApollo(page, inject, { release: MBID });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('tracklist'));
    if (b) b.click();
  });
  await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(1200);

  // open a data section of three: ⤓ on track 11
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
    tr.querySelector('.tc-dtmv.down').click();
  });
  await page.waitForTimeout(1200);

  const state = () => page.evaluate(() => {
    const m = window.MB.releaseEditor.rootField.release().mediums()[0];
    const rows = [...document.querySelectorAll('.tc-mirror tr[data-tk]')];
    return {
      flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
      // full titles: the three video tracks all END the same way ("…karaokė)"),
      // so a tail fingerprint made a real move look like no move at all.
      titles: m.tracks().map(t => (t.name() || '')).join(' | '),
      dataHandles: rows.filter(r => r.classList.contains('tc-row-data')).filter(r => r.querySelector('.tc-drag')).length,
      dataRows: rows.filter(r => r.classList.contains('tc-row-data')).length,
      audioHandles: rows.filter(r => !r.classList.contains('tc-row-data')).filter(r => r.querySelector('.tc-drag')).length,
    };
  });

  // Real drag: dragstart on the source handle, dragover + drop on the target row.
  const drag = (fromTi, toTi, after) => page.evaluate(([f, t, aft]) => {
    const row = ti => [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === String(ti));
    const src = row(f), dst = row(t);
    if (!src || !dst) return 'row missing';
    const h = src.querySelector('.tc-drag');
    if (!h) return 'no drag handle on the source row';
    const dt = new DataTransfer();
    h.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const box = dst.getBoundingClientRect();
    const y = aft ? box.bottom - 2 : box.top + 2;
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y, clientX: box.left + 10 };
    dst.dispatchEvent(new DragEvent('dragover', opts));
    const accepted = dst.classList.contains('tc-drop-before') || dst.classList.contains('tc-drop-after');
    dst.dispatchEvent(new DragEvent('drop', opts));
    h.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return accepted ? 'accepted' : 'refused';
  }, [fromTi, toTi, !!after]);

  const s0 = await state();
  check(s0.flags === '..........DDD', `fixture: three data tracks (${s0.flags})`);
  check(s0.dataHandles === s0.dataRows && s0.dataRows === 3, `every data row has a ⠿ handle (${s0.dataHandles} of ${s0.dataRows})`);
  check(s0.audioHandles === 10, `audio rows keep theirs (${s0.audioHandles})`);

  // move the LAST data track above the first one — inside the section
  const r1 = await drag(12, 10, false);
  await page.waitForTimeout(1200);
  const s1 = await state();
  check(r1 === 'accepted', 'the drop target inside the section accepted the drag');
  check(s1.flags === '..........DDD', `the section is unchanged in size and still trailing (${s1.flags})`);
  check(s1.titles !== s0.titles, `the tracks really moved (${s0.titles} → ${s1.titles})`);

  // a drag from the data section onto an AUDIO row must be refused outright
  const r2 = await drag(12, 5, false);
  await page.waitForTimeout(900);
  const s2 = await state();
  check(r2 === 'refused', 'a drag out of the data section is refused — no drop marker, no drop');
  check(s2.flags === '..........DDD' && s2.titles === s1.titles, `nothing changed (${s2.flags})`);

  // and the reverse: an audio row dragged into the section
  const r3 = await drag(3, 11, false);
  await page.waitForTimeout(900);
  const s3 = await state();
  check(r3 === 'refused', 'a drag into the data section is refused too — ⤓ is the way in');
  check(s3.flags === '..........DDD' && s3.titles === s1.titles, `nothing changed (${s3.flags})`);

  // restore
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tc-mirror tr.tc-row-data')];
    rows[rows.length - 1].querySelector('.tc-dtmv.up').click();
  });
  await page.waitForTimeout(900);
  const s4 = await state();
  check(s4.flags.indexOf('D') < 0, `restored: no data tracks left (${s4.flags})`);

  check(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
});
