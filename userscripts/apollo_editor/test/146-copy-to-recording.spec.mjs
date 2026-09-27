// #146: right-click on a recording's title cell toggles "copy the track title to the
// recording", proxying MusicBrainz's own update checkbox (so a casing-only difference,
// which Apollo's ignore-casing view hides, can still be copied); the cell previews the
// struck-through original; Alt+right-click toggles the whole column; the picker proxies
// the same checkbox. On a cell with nothing to copy, right-click does nothing.
//
// Differences are made on linked recordings by flipping the casing of their tracks' titles
// (rows A and B): a bigger rename, and MusicBrainz drops the link a moment later.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, toTab } from './ap.mjs';

test.use({ gm: apolloGm() });
const REL = '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';

test('right-click copies the title to the recording', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { release: REL });
  const setup = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const linked = [];
    u(u(MB.releaseEditor.rootField.release).mediums).forEach(m => u(m.tracks).forEach(t => { const r = u(t.recording); if (r && u(r.gid)) linked.push(t); }));
    if (linked.length < 3) return { error: `${linked.length} linked recordings` };
    const flip = s => [...String(s)].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
    linked[0].name(flip(u(linked[0].name)));
    linked[1].name(flip(u(linked[1].name)));   // a bigger rename and MusicBrainz drops the link, a moment later
    return { aDiffers: !!linked[0].titleDiffersFromRecording(), bDiffers: !!linked[1].titleDiffersFromRecording(), stillLinked: !!u(linked[0].recording).gid };
  });
  check(!setup.error, setup.error || 'the release has linked recordings');
  if (setup.error) return;
  check(setup.aDiffers && setup.bDiffers && setup.stillLinked, `MusicBrainz sees both differences, and keeps the links (${JSON.stringify(setup)})`);
  await toTab(page, 'recordings');
  await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow td.tc-recname', { timeout: 30000 });

  const a = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const tc = () => document.querySelector('#tc-recwrap tbody tr.tc-recrow td.tc-recname');
    const t = u(u(MB.releaseEditor.rootField.release).mediums)[0].tracks()[0];
    const before = !!u(t.updateRecordingTitle);
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const notCancelled = tc().dispatchEvent(ev);
    return { before, after: !!u(t.updateRecordingTitle), menuSuppressed: !notCancelled, struck: /tc-rec-orig/.test(tc().innerHTML), arrow: tc().textContent.includes('→') };
  });
  check(!a.before && a.after, `row A (casing only): right-click ticks MusicBrainz's checkbox (${a.before} → ${a.after})`);
  check(a.menuSuppressed, "the browser's menu is not shown");
  check(a.struck && a.arrow, 'the cell previews the struck-through original → the new title');

  const none = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v), tracks = [];
    u(u(MB.releaseEditor.rootField.release).mediums).forEach(m => u(m.tracks).forEach(t => tracks.push(t)));
    const i = tracks.findIndex(t => { try { return u(t.recording) && u(u(t.recording).gid) && !t.titleDiffersFromRecording(); } catch (e) { return false; } });
    const tc = i >= 0 && document.querySelectorAll('#tc-recwrap tbody tr.tc-recrow')[i]?.querySelector('td.tc-recname');
    if (!tc) return { skipped: true };
    const before = !!u(tracks[i].updateRecordingTitle);
    const notCancelled = tc.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    return { menuSuppressed: !notCancelled, unchanged: !!u(tracks[i].updateRecordingTitle) === before };
  });
  check(!none.skipped, 'a row with nothing to copy');
  check(none.menuSuppressed && none.unchanged, `nothing to copy: right-click does nothing (${JSON.stringify(none)})`);

  const col = await page.evaluate(() => {
    const cellB = document.querySelectorAll('#tc-recwrap tbody tr.tc-recrow')[1].querySelector('td.tc-recname');
    cellB.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, altKey: true }));
    const ts = MB.releaseEditor.rootField.release().mediums()[0].tracks();
    return { a: !!ts[0].updateRecordingTitle(), b: !!ts[1].updateRecordingTitle() };
  });
  check(col.a === true && col.b === true, `Alt+right-click on row B ticks the whole column (${JSON.stringify(col)})`);

  const pick = await page.evaluate(() => {
    document.querySelector('#tc-recwrap tbody tr.tc-recrow td.tc-recname').click();
    const ct = document.querySelector('.tc-rpk-ct');
    return { open: !!document.querySelector('.tc-rpk-hd'), box: !!ct };
  });
  check(pick.open && pick.box, "the picker offers the same checkbox for row A's casing difference");
  check(submitted.length === 0, 'nothing submitted');
});
