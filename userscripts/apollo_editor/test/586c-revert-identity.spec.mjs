// chaban-mb on #586, two reports:
//
//   1. "Revert all function seems to not affect data tracks"
//   2. footnote: "…it also affects the pregap track feature. The latter can lead
//      to data loss when first checking pregap, then 'revert all', then
//      unchecking pregap -> first track deleted"
//
// The second one is the serious one and it is NOT about data tracks at all. The
// page-load snapshot was keyed by "medium:INDEX". Ticking Pregap makes MB insert
// a track at index 0, so every later track shifts down one; "Revert all" then
// writes each snapshot onto the track BELOW the one it came from, and unticking
// Pregap deletes what is now index 0. The tracklist comes back shifted by one,
// the first track gone and the last duplicated — silently.
//
// Measured before it was asserted (probe-586f-pregap-revert.mjs), on the exact
// sequence he described. The snapshot is now keyed by MB's per-track `uniqueID`,
// which survives inserts and exists on new tracks too.
//
// Nothing is submitted; the model is restored at the end and the page discarded.
import { test, check, until, idle, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

test('Revert all restores data tracks and the pregap', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  page.on('dialog', d => d.accept());   // Revert all confirms first
  const posted = await openApollo(page, inject, { release: MBID });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('tracklist'));
    if (b) b.click();
  });
  await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
  await idle(page);

  const snap = () => page.evaluate(() => {
    const m = window.MB.releaseEditor.rootField.release().mediums()[0];
    return {
      n: m.tracks().length,
      titles: m.tracks().map(t => t.name() || '(blank)'),
      flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
    };
  });
  const pregap = on => page.evaluate(v => {
    const cb = [...document.querySelectorAll('.tc-medopt')].find(l => /Pregap/.test(l.textContent)).querySelector('input');
    cb.checked = v; cb.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);
  // Revert all runs (and confirms) inside this call, so it has finished when the call returns
  const revertAll = async () => { await page.evaluate(() => window.__apolloEditor.revertAll()); await frames(page); };

  const base = await snap();
  check(base.n > 3, `fixture loaded (${base.n} tracks)`);

  /* ── his footnote: pregap → revert all → pregap off ─────────────────────── */
  await pregap(true);
  const withPregap = await until(snap, s => s.n === base.n + 1);
  check(withPregap.n === base.n + 1 && withPregap.titles[0] === '(blank)', `Pregap inserted a blank track at index 0 (${withPregap.n} tracks)`);
  await revertAll();
  const reverted = await snap();
  check(reverted.titles[0] === '(blank)', 'Revert all left the pregap track blank instead of writing track 1 onto it');
  check(JSON.stringify(reverted.titles.slice(1)) === JSON.stringify(base.titles),
    'Revert all wrote every snapshot back onto the track it came from, not the one below it');
  await pregap(false);
  const back = await until(snap, s => s.n === base.n);
  check(JSON.stringify(back.titles) === JSON.stringify(base.titles),
    `the round trip is lossless — no track deleted, none duplicated (${back.n} tracks)`);

  /* ── his first report: Revert all and the data-track boundary ───────────── */
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
    tr.querySelector('.tc-dtmv.down').click();
  });
  const opened = await until(snap, s => s.flags.includes('D'));
  check(opened.flags.includes('D'), `a data section was opened for the test (${opened.flags})`);
  await revertAll();
  const closed = await snap();
  check(closed.flags === base.flags, `Revert all put the data-track boundary back too (${closed.flags} vs ${base.flags})`);
  check(JSON.stringify(closed.titles) === JSON.stringify(base.titles), 'and the titles are still intact');

  check(!posted.some(u => /\/edit\/create/.test(u)), `nothing was submitted (${posted.length} blocked, none of them create)`);
});
