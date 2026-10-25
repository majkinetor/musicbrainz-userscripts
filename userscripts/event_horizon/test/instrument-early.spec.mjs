import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('an instrument page shows its lists while the instrument itself is still loading, then fills in', { tag: '@sandbox' }, async ({ page, inject }) => {
  // the instrument's ws/2 answer is held back 5 s, as when the shared MusicBrainz gate holds it
  await page.route('**/ws/2/instrument/**', async r => { await new Promise(res => setTimeout(res, 5000)); await r.fallback(); });
  await page.goto('https://test.musicbrainz.org/instrument/fa174c32-b348-4939-89b2-bde85af4ee02'); // cuíca
  await inject('event_horizon');
  check(await until(() => page.locator('#app h1').count(), n => n > 0, 4000) > 0, 'the page shows before the instrument arrives');
  check(/cu[ií]ca/i.test(await page.locator('#app h1').innerText()), 'named from MusicBrainz\'s subpage');
  check(await page.locator('#app .facts .label').filter({ hasText: /subtype of/i }).count() === 0, 'the facts are not in yet');
  check(await until(() => page.locator('#app .facts .label').filter({ hasText: /subtype of/i }).count(), n => n > 0, 15000) > 0, 'the facts fill in when it arrives');
});
