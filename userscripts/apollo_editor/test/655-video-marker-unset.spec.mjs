// #655 (chaban-mb): "When unsetting a wrongly matched video recording the video
// indicator is not removed from the tracklist."
//
// The Tracklist is built once and refreshed once per visit, so a recording unset on
// the Recordings tab after the Tracklist was shown left the old marker in its row.
// The order matters: Tracklist first (twice, which spends its one refresh, as in
// his log), then the unset, then back.
//
// The click is a real click on the rendered ＋ of a video row. Nothing is submitted.
//
// Pre-fix build: the tracklist still marks the unset track (3 markers, not 2).
import { test, check, settled, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';   // three video karaoke tracks (#584)

test('unsetting a video recording drops its video marker, in both tables', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: MBID });
  const tab = async n => {
    await page.evaluate(x => { const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(e => e.textContent.trim().toLowerCase().startsWith(x)); if (b) b.click(); }, n);
    await settled(page);
    await frames(page);
    await page.waitForTimeout(700);   // Apollo's tab watcher ticks every 500 ms: let it see each visit
  };
  const recMarks = () => page.evaluate(() => document.querySelectorAll('#tc-recwrap tr.tc-recrow .tc-rec-video').length);
  const tlMarks = () => page.evaluate(() => document.querySelectorAll('.tc-mirror tr[data-tk] .tc-rec-video').length);

  // two visits: the first shows the table, the second spends its one refresh
  await tab('tracklist');
  await tab('recording');
  await tab('tracklist');
  await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 30000 });
  check(await tlMarks() === 3, `the tracklist marks the three videos before the unset (${await tlMarks()})`);

  await tab('recording');
  await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 30000 });
  const videos = await page.evaluate(() => window.__apolloEditor.readRecordings().filter(r => r.recVideo).length);
  check(videos === 3, `fixture: ${videos} video recordings`);
  check(await recMarks() === videos, 'the recordings table marks them before the unset');

  // ＋ on the first video row
  const row = page.locator('#tc-recwrap tr.tc-recrow', { has: page.locator('.tc-rec-video') }).first();
  await row.hover();
  await row.locator('.tc-rec-new-btn').click();
  await settled(page);
  await frames(page);
  const st = await page.evaluate(() => window.__apolloEditor.readRecordings().filter(r => r.isNew).length);
  check(st === 1, `one track is now a new recording (${st})`);
  check(await recMarks() === videos - 1, `the recordings table drops the unset track's marker (${await recMarks()} of ${videos - 1})`);

  await tab('tracklist');
  check(await tlMarks() === videos - 1, `the tracklist drops it too (${await tlMarks()} of ${videos - 1})`);
});
