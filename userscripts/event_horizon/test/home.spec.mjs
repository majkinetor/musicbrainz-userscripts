import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('the home page shows search, Add, You and the tab icon', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  const secs = await until(() => page.evaluate(() => [...document.querySelectorAll('#app>section.sec')].map(x => x.id)), v => v.length >= 3);
  check(['s-hadd', 's-hme', 's-hrec'].every(x => secs.includes(x)), 'the three home sections: ' + secs.join(', '));
  check(await page.locator('.hm-srch input[name=query]').count() === 1, 'the search box shows');
  check(await page.locator('.hm-chip[href$="/release/add"]').count() === 1, 'Add release links to the release editor');
  check(await page.evaluate(() => !!document.getElementById('eh-icon')), 'the tab shows Event Horizon\'s icon');
  await attachShot(testInfo, page, 'home');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});
