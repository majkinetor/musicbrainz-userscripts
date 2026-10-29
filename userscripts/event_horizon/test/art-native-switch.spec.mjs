import { test, expect, idle, attachShot } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

for (const add of [false, true]) for (const asFirst of [true, false]) {
  test(`Art Station survives native switching on ${add ? 'add-' : ''}cover-art (${asFirst ? 'AS' : 'EH'} first)`, { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
    await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/${add ? 'add-' : ''}cover-art`, { waitUntil: 'domcontentloaded' });
    await idle(page);
    if (asFirst) { await inject('art_station'); await page.waitForSelector('#as-root'); }
    await inject('event_horizon');
    if (!asFirst) await inject('art_station');
    await expect(page.locator('#as-slot #as-root')).toBeVisible();
    await page.evaluate(() => { window.savedArtGallery = document.querySelector('#as-root'); });
    for (let i = 0; i < 2; i++) {
      await page.locator('#eh-launch').click();
      await expect(page.locator('#content #as-root')).toBeVisible();
      expect(await page.evaluate(() => document.querySelector('#as-root') === window.savedArtGallery)).toBe(true);
      await expect(page.locator('#as-switch')).toBeVisible();
      await attachShot(testInfo, page, `native-${i}`);
      await page.locator('#eh-launch').click();
      await expect(page.locator('#as-slot #as-root')).toBeVisible();
      expect(await page.evaluate(() => document.querySelector('#as-root') === window.savedArtGallery)).toBe(true);
    }
  });
}
