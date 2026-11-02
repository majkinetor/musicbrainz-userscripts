import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

const ARTIST = 'a74b1b7f-71a5-4011-9441-d0b5e4122711'; // Radiohead: linked sites with pictures
test.use({ gm: { name: 'Event Horizon', values: { 'mbu:artimg': { [ARTIST]: { all: [], t: Date.now() } } } } });

test('an artist with a cached miss can ask for its image again', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${ARTIST}`);
  await inject('event_horizon');
  const retry = page.locator('#app .nocover .imgretry');
  check(await until(() => retry.count(), n => n === 1, 20000) === 1, 'the empty image offers a retry');
  await attachShot(testInfo, page, 'image-retry');
  await retry.click();
  check(await until(() => page.locator('#app .art img.apic').count(), n => n === 1, 30000) === 1, 'the retry finds the picture');
  check(await retry.count() === 0, 'and the button goes');
});
