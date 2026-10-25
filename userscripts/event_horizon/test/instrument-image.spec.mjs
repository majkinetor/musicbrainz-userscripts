import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('an instrument whose image link is not on Commons still shows its picture', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/instrument/fa174c32-b348-4939-89b2-bde85af4ee02'); // cuíca, IROMBook image
  await inject('event_horizon');
  check(await until(() => page.locator('#app .art img.ipic').count(), n => n === 1, 20000) === 1, 'the picture shows');
  check(/\/irombook\//.test(await page.locator('#app .art img.ipic').getAttribute('src')), 'it is the IROMBook image');
  check(await until(() => page.locator('#app .art img.ipic').evaluate(i => i.complete && i.naturalWidth), w => w > 0) > 0, 'it loads');
  await attachShot(testInfo, page, 'instrument-image');
});
