// #685 majkinetor: "Also happens when artist is created in background with right
// click and during the process I scroll down." · "Also happens when using [Aa]
// button on track, seem the problem appears on various places." Every re-fill of
// the rows put the view back at the top, as a drop did: a tracklist change from
// outside the table (MusicBrainz's guess case behind [Aa], a bookmarklet) resyncs
// and re-mounts every section, and [Aa] also re-renders the rows itself.
import { test, check, idle, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';   // 13 tracks, as in 685

test('#685: a resync and [Aa] leave the tracklist scrolled where it was', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1400, height: 500 });   // short, so the tracklist scrolls
  const posted = await openApollo(page, inject, { release: MBID });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('tracklist'));
    if (b) b.click();
  });
  await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
  await idle(page);

  const row = '.tc-mirror tr[data-tk="0:11"]';
  const name = () => page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[11].name());
  await page.locator(row).scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  check(before > 200, `fixture: the page is scrolled down to the last tracks (${before}px)`);

  // a title changed on the model directly, not through the table: lower case, so [Aa] has work
  const lower = await page.evaluate(() => { const t = window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[11]; t.name(t.name().toLowerCase() + ' of the 685'); return t.name(); });
  await page.waitForFunction(([r, v]) => [...document.querySelectorAll(r + ' input')].some(i => i.value === v), [row, lower], { timeout: 15000 });
  await frames(page); await idle(page);
  const afterSync = await page.evaluate(() => window.scrollY);
  check(Math.abs(afterSync - before) < 5, `a resync left the view where it was (${before}px → ${afterSync}px)`);

  await page.locator(row).scrollIntoViewIfNeeded();   // (back down, should the resync have lost it)
  await page.locator(row + ' .t-wrap').hover();
  const beforeGc = await page.evaluate(() => window.scrollY);
  await page.locator(row + ' .t-gc').click();
  await page.waitForFunction(v => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[11].name() !== v, lower, { timeout: 15000 });
  await frames(page); await idle(page);
  check((await name()) !== lower, `[Aa] changed the title (${await name()})`);
  const afterGc = await page.evaluate(() => window.scrollY);
  check(beforeGc > 200 && Math.abs(afterGc - beforeGc) < 5, `[Aa] left the view where it was (${beforeGc}px → ${afterGc}px)`);
  check(!posted.some(u => /\/edit\/create/.test(u)), 'nothing was submitted');
});
