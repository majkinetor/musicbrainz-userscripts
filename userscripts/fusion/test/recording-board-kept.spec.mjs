// majkinetor: "I opened 2 tabs to add 2 recordings, after the first one there wasn't any on the
// 2nd tab … i reloaded there was 0 now". The recording board is kept in GM storage like every
// other type's: a reload keeps it, and another page (tab) of the script sees what one added.
// Also: the add menu starts with the page's own entity ticked.
import { test, check, until, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', persist: 'tabs' } });

test('recordings added from the menu survive a reload and show on other pages', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const r = await pristine(page, 'release', { tracks: 2 });
  const recCount = () => page.locator('#fs-launch-ctrs .fs-ctr[data-type="recording"] b').textContent().catch(() => '');
  const open = async path => {
    await page.goto('https://test.musicbrainz.org' + path, { waitUntil: 'domcontentloaded' });
    await inject('fusion', { waitFor: '__fusion' });
    await until(() => page.locator('#fs-launch').count(), n => n === 1);
  };
  const addThis = async () => {
    await page.click('#fs-launch', { modifiers: ['Control'] });
    await page.waitForSelector('#fs-addmenu');
    check(await page.locator('#fs-addmenu input[data-i="0"]').isChecked(), 'the page’s own entity starts ticked');
    check(await page.locator('#fs-addmenu input:checked').count() === 1, 'and only that');
    await page.click('#fs-addmenu [data-a="add"]');
  };

  await open('/recording/' + r.recordings[0]);
  await addThis();
  check(await until(recCount, t => t === '1', { timeout: 30000 }) === '1', 'one recording in the pool');

  await open('/recording/' + r.recordings[0]);
  check(await until(recCount, t => t === '1', { timeout: 10000 }) === '1', 'a reload keeps it');

  await open('/recording/' + r.recordings[1]);
  check(await until(recCount, t => t === '1', { timeout: 10000 }) === '1', 'another recording’s page shows it');
  await addThis();
  check(await until(recCount, t => t === '2', { timeout: 30000 }) === '2', 'the second joins the first');

  await open('/release/' + r.mbid);
  check(await until(recCount, t => t === '2', { timeout: 10000 }) === '2', 'the release page shows both');
});
