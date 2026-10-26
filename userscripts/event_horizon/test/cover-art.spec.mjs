import { test, check, until, attachShot, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// the release page's Art opens the cover-art page: Event Horizon shows the title and artist, Art Station's gallery under them
for (const add of [false, true]) for (const asFirst of [true, false]) test(`the ${add ? 'add-' : ''}cover-art page holds Art Station's gallery (${asFirst ? 'Art Station' : 'Event Horizon'} first)`, { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/${add ? 'add-' : ''}cover-art`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await idle(page);
  if (asFirst) { await inject('art_station'); await page.waitForSelector('#as-root', { timeout: 20000 }); }
  await inject('event_horizon');
  if (!asFirst) await inject('art_station');
  check(await until(() => page.locator('#app #as-slot #as-root').count(), n => n === 1) === 1, 'the gallery sits in the slot');
  check(await until(() => page.locator('.arthd h1 a').count(), n => n === 1) === 1, 'the title links back to the release');
  check(await page.locator('.arthd .by a').count() > 0, 'the artist shows');
  check(await page.locator('.as-none:not([hidden])').count() === 0, 'no "install Art Station" note');
  check(await until(() => page.locator('#as-root .as-card').count(), n => n > 0) > 0, 'the gallery shows its covers');
  await page.mouse.move(0, 0);
  check(await until(() => page.evaluate(() => getComputedStyle(document.querySelector('#as-root .as-pencil')).opacity), v => v === '0') === '0', 'a card\'s hover buttons stay hidden until hovered');
  await attachShot(testInfo, page, 'cover-art');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', asFirst ? '-as.png' : '-eh.png') });
});
