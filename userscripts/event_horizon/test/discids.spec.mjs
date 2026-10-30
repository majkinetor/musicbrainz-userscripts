import { test, check, until, attachShot, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const RELEASE = '4142b868-6be9-4db7-b43c-585a19ebb7eb', DISC = 'li4hV3CcOryuIga4.2fOPJLktGU-';

// a release's Disc IDs: its media, their disc IDs with MusicBrainz's Remove and Move, and Apollo's rip-log drop above them
test('the Disc IDs page lists the media and holds Apollo\'s drop', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/discids`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await idle(page);
  await inject('event_horizon');
  await inject('apollo_editor');
  check(await until(() => page.locator('#app .dsc-med').count(), n => n > 0) > 0, 'a medium shows');
  check(await page.locator(`#app .dsc-id:text("${DISC}")`).count() === 1, 'its disc ID shows');
  check(await page.locator('#app .dsc-a a').count() >= 2, 'Remove and Move show');
  check(await until(() => page.locator('#app #dsc-slot #apollo-discid-box').count(), n => n === 1) === 1, 'Apollo\'s drop sits in the slot');
  check(await until(() => page.locator('.arthd h1 a').count(), n => n > 0) > 0, 'the release title shows');
  check(await page.locator('.arthd .ab.on[href$="/discids"]').count() === 1, 'Disc IDs is lit in More');
  await attachShot(testInfo, page, 'discids');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});

// one disc ID: its tracks and the releases it is on
test('a disc ID\'s page shows its TOC and releases', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/cdtoc/${DISC}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await idle(page);
  await inject('event_horizon');
  check(await until(() => page.locator('#app .dsc-tbl tbody tr').count(), n => n === 14) === 14, '14 tracks');
  check(await page.locator('#app .dsc-rel a[href*="/release/"]').count() >= 1, 'the release shows');
  await attachShot(testInfo, page, 'cdtoc');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-toc.png'), fullPage: true });
});
