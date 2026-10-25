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

test('an area page shows its hero and its artists, labels and places', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/area/02b60d8d-7164-339d-868d-22d147d9f74a');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/country/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names a country');
  check(await until(() => page.locator('#s-aa tbody tr').count(), n => n > 0) > 0, 'the artists table fills in');
  await attachShot(testInfo, page, 'area');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-area.png'), fullPage: true });
});

test('an instrument page shows its Commons picture, what it is a subtype of, and its tabs as tables', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/instrument/46ec6044-6c57-4ebe-8c1e-762f19b66340');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/percussion/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names its type');
  check(await until(() => page.locator('#app img.ipic').evaluate(i => i.complete && i.naturalWidth).catch(() => 0), n => n > 0) > 0, 'the Commons picture loads');
  check(/barrel drum/i.test(await page.locator('#app .facts').innerText()), 'it is a subtype of barrel drum');
  check(await until(() => page.locator('#app .sec.pend').count(), n => n === 0) === 0, 'every section has loaded');
  await attachShot(testInfo, page, 'instrument');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-instrument.png'), fullPage: true });
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
