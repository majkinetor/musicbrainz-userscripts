// #635 (majkinetor): "Implement mouse friendly variant with right click drag. Whatever is
// touched during dragging gets marked for copy or is copied immediately depending on side."
//
// A real right-button drag on the Recordings tab, on the sandbox (nothing submitted):
//   recording side: a drag over rows A and B's title cells marks both copies; a second
//                   drag starting on a marked cell unmarks both (the first cell decides);
//   track side:     a drag over rows A and B's title cells sets both tracks' titles from
//                   their recordings, at once;
//   and the release's contextmenu never undoes the first cell (it is swallowed after a drag).
// Differences come from flipping the casing of the track titles, as in #146 (a bigger rename
// and MusicBrainz drops the recording link).
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, toTab } from './ap.mjs';

test.use({ gm: apolloGm() });
const REL = '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';

test('a right-button drag copies every cell it touches', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { release: REL });
  const setup = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const ts = u(u(MB.releaseEditor.rootField.release).mediums)[0].tracks();
    if (ts.length < 3 || !ts.slice(0, 2).every(t => u(t.recording) && u(u(t.recording).gid))) return { error: 'rows A and B need linked recordings' };
    const flip = s => [...String(s)].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
    ts[0].name(flip(u(ts[0].name))); ts[1].name(flip(u(ts[1].name)));
    return { differ: !!ts[0].titleDiffersFromRecording() && !!ts[1].titleDiffersFromRecording() };
  });
  check(!setup.error && setup.differ, setup.error || 'rows A and B differ from their recordings');
  if (setup.error) return;
  await toTab(page, 'recordings');
  await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow td.tc-recname', { timeout: 30000 });

  const flags = () => page.evaluate(() => MB.releaseEditor.rootField.release().mediums()[0].tracks().slice(0, 2).map(t => !!t.updateRecordingTitle()));
  const titles = () => page.evaluate(() => MB.releaseEditor.rootField.release().mediums()[0].tracks().slice(0, 2).map(t => ({ track: t.name(), rec: t.recording().name })));
  const centre = async (row, sel) => {
    const b = await page.locator('#tc-recwrap tbody tr.tc-recrow').nth(row).locator(sel).boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const rightDrag = async (sel, rows) => {
    const [x0, y0] = await centre(rows[0], sel);
    await page.mouse.move(x0, y0);
    await page.mouse.down({ button: 'right' });
    for (const r of rows.slice(1)) { const [x, y] = await centre(r, sel); await page.mouse.move(x, y, { steps: 6 }); }
    await page.mouse.up({ button: 'right' });
  };

  // recording side: mark both
  check(JSON.stringify(await flags()) === '[false,false]', 'no copy marked before the drag');
  await rightDrag('td.tc-recname', [0, 1]);
  const on = await until(flags, f => f[0] && f[1], { timeout: 5000 });
  check(on[0] && on[1], `a right-drag over A and B's recording titles marks both copies (${JSON.stringify(on)})`);
  check(await page.evaluate(() => !document.querySelector('#tc-recwrap .tc-rdrag')), 'the drag highlight is gone once released');

  // …and a drag starting on a marked cell unmarks
  await rightDrag('td.tc-recname', [0, 1]);
  const off = await until(flags, f => !f[0] && !f[1], { timeout: 5000 });
  check(!off[0] && !off[1], `a drag that starts on a marked cell unmarks both (${JSON.stringify(off)})`);

  // a plain right-click is still a toggle of the one cell
  await page.locator('#tc-recwrap tbody tr.tc-recrow').nth(1).locator('td.tc-recname').click({ button: 'right' });
  const single = await until(flags, f => f[1], { timeout: 5000 });
  check(!single[0] && single[1], `a right-click without a drag toggles only its own cell (${JSON.stringify(single)})`);

  // track side: both tracks take their recordings' titles at once
  await rightDrag('td.tc-tkt', [0, 1]);
  const t = await until(titles, ts => ts.every(x => x.track === x.rec), { timeout: 10000 });
  check(t.every(x => x.track === x.rec), `a right-drag over A and B's track titles copies both from their recordings (${JSON.stringify(t)})`);

  check(submitted.length === 0, 'nothing submitted');
});
