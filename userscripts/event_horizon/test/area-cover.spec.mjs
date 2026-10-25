import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

// Wikidata answers Node's requests with 429, so the manager's requests go through the page here
test.use({ gm: { name: 'Event Horizon', xhr: 'fetch' } });

test('an area page shows its Wikidata map with the flag on it, its anthem and what it was the location for', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/area/02b60d8d-7164-339d-868d-22d147d9f74a'); // Colombia
  await inject('event_horizon');
  check(await until(() => page.locator('#app .art .mpic').count(), n => n === 1, 20000) === 1, 'the cover shows a picture');
  check(await page.locator('#app .art .imgflag').count() === 1, 'the flag sits on the map');
  const labels = await page.locator('#app .facts .label').allInnerTexts();
  check(labels.some(l => /^anthem/i.test(l)), 'the anthem row shows');
  check(labels.some(l => /^location for/i.test(l)), 'the location for row shows');
  await page.locator('#app [data-rot]').click();
  check(await until(() => page.locator('#app .art .imgflag').count(), n => n === 0) === 0, 'a click moves on to the flag alone');
  await attachShot(testInfo, page, 'area-cover');
});
