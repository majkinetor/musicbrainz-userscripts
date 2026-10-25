import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('an editor\'s profile shows its hero and statistics', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor');
  await inject('event_horizon');
  check(await until(() => page.locator('.u-hero h1').textContent(), t => t === 'majkinetor') === 'majkinetor', 'the hero names the editor');
  const secs = await until(() => page.evaluate(() => [...document.querySelectorAll('#app>section.sec')].map(x => x.id)), v => v.length >= 3);
  check(['s-ued', 's-uvo', 's-uad'].every(x => secs.includes(x)), 'the statistics sections: ' + secs.join(', '));
  check(await page.locator('#s-ued .u-st').count() >= 8, 'the edits show as tiles');
  check(await page.locator('.u-tabs a.u-tab').count() >= 3, 'the profile\'s tabs link on');
  await attachShot(testInfo, page, 'user');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});
