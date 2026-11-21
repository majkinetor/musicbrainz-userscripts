import { test, check, until } from '../../../dev/test/harness.mjs';

// Koen Park, Nowhere Home: the release links its Internet Archive item, the recordings link nothing to play (#1086)
const REL = 'https://musicbrainz.org/release/9638bdc3-b1fa-4bd1-8ebd-720b12a1bee5';

test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } } });

test('a release linked to an Internet Archive item plays its tracks from the item', { tag: ['@prod', '@web'] }, async ({ page, inject }) => {
  await page.goto(REL);
  await inject('event_horizon');
  await page.locator('.tr[data-row]').first().waitFor();
  check(await page.locator('button[data-playall]').count() === 1, 'the release has a Play button');
  await page.locator('button[data-playall]').click();
  const src = await until(() => page.evaluate(() => document.querySelector('#eh-ply .ply-dock iframe')?.contentDocument?.querySelector('audio')?.src || ''), v => !!v, 20000);
  check(/archive\.org\/download\/headphonica\.hpcd033\/Koen_Park__Nowhere_Home__01\.mp3$/.test(src), 'the first track plays the item\'s first file: ' + src);
  const t = await until(() => page.evaluate(() => document.querySelector('#eh-ply .ply-dock iframe')?.contentDocument?.querySelector('audio')?.currentTime || 0), v => v > 0.5, 20000);
  check(t > 0.5, 'the audio plays');
});
