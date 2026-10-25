import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('a recording page shows its hero, credits and releases', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/recording/2460a241-6ff4-49f1-80f9-36051534e9ae');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/recording|video/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names a recording');
  check(await until(() => page.locator('#s-ed').count(), n => n === 1) === 1, 'the releases section shows');
  check(await page.locator('#s-cr').count() === 1, 'the credits section shows');
  await attachShot(testInfo, page, 'recording');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-recording.png'), fullPage: true });
});

test('a work page shows its hero, credits and recordings', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/work/afec4a5d-5ac6-309a-be7c-ee4f919730c3');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(await until(() => page.locator('#s-rc tbody tr').count(), n => n > 0) > 0, 'the recordings table fills in');
  check(await page.locator('#s-cr').count() === 1, 'the credits section shows');
  await attachShot(testInfo, page, 'work');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-work.png'), fullPage: true });
});
