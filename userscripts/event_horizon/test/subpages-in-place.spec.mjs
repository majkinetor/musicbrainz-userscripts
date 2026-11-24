import { test, expect, pristine, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('an entity\'s Releases and Details open in place, without a page load', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const { mbid: id } = await pristine(page, 'artist');
  await page.goto(`${mb}/artist/${id}`);
  await inject('event_horizon');
  await page.evaluate(() => { window.__ehStay = 1; });
  for (const [sub, text] of [['releases', 'Releases'], ['details', 'Details']]) {
    await page.locator(`#app a[href$="/artist/${id}/${sub}"]`).first().dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`/artist/${id}/${sub}$`));
    await expect(page.locator('#app .arthd .kicker')).toContainText(text);
    // Releases is drawn from ws/2 in the tab (since 2026-11-21), Details in #eh-upg: either way #app stops loading
    await expect(page.locator('#app')).not.toContainText('Loading');
    expect(await page.evaluate(() => window.__ehStay)).toBe(1);
  }
});
