import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', values: { view: { secHide: ['ed'] } } } });

test('hiding Editions does not hide a release group’s Releases', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release-group/ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e', { waitUntil: 'domcontentloaded' });
  await inject('event_horizon');
  check(await until(() => page.locator('#s-ed .tile').count(), n => n > 0) > 0, 'releases loaded');
  check(await page.locator('#s-ed').isVisible(), 'Releases remains visible');
});
