import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', values: { view: { secHide: ['ed', 'rg-ed'] } } } });

test('a hidden releases section can be restored', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release-group/ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e', { waitUntil: 'domcontentloaded' });
  await inject('event_horizon');
  check(await until(() => page.locator('#s-ed .tile').count(), n => n > 0) > 0, 'releases loaded');
  check(await page.locator('#s-ed').isHidden(), 'the saved section setting hides releases');
  await page.locator('[data-ehsec]').first().click({ timeout: 5000 });
  check((await page.locator('#eh-rail [data-sec="ed"] .nm').innerText()).includes('Releases'), 'the rail names the section Releases');
  await page.locator('#eh-rail [data-sec="ed"] .eye').click();
  check(await page.locator('#s-ed').isVisible(), 'releases can be shown again');
});
