import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('stars survive navigation and reload and can be removed', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/89ad4ac3-39f7-470e-963a-56509c546377');
  await inject('event_horizon');
  const star = page.locator('[data-star]');
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.kicker a.eh-home').click();
  await expect(page.locator('#s-hstar a[href$="/artist/89ad4ac3-39f7-470e-963a-56509c546377"]')).toHaveCount(1);
  for (const view of ['row', 'grid', 'table', 'group']) {
    await page.locator(`[data-star-view="${view}"]`).click();
    await expect(page.locator(`[data-star-view="${view}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#s-hstar a[href$="/artist/89ad4ac3-39f7-470e-963a-56509c546377"]')).toHaveCount(1);
  }
  await page.locator('[data-star-view="table"]').click();
  await page.reload();
  await inject('event_horizon');
  await expect(page.locator('[data-star-view="table"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#s-hstar a').click();
  await expect(page.locator('[data-star]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-star]').click();
  await page.locator('.kicker a.eh-home').click();
  await expect(page.locator('#s-hstar a')).toHaveCount(0);
});

test('star export and import merge without duplicates', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  await page.locator('[data-pop="star-transfer"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-star-export]').click()]);
  expect(download.suggestedFilename()).toBe('event-horizon-stars.json');
  const imported = { version: 1, stars: [{ key: 'artist/89ad4ac3-39f7-470e-963a-56509c546377', title: 'Various Artists', by: 'Alpha' }, { key: 'label/6e0e2d94-4d49-4e98-a917-b7b8f2087348', title: 'Alpha Label', by: 'Zulu', img: 'https://example.com/picture.png' }] };
  await page.locator('[data-star-file]').setInputFiles({ name: 'stars.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(page.locator('#s-hstar a[href$="/artist/89ad4ac3-39f7-470e-963a-56509c546377"]')).toHaveCount(1);
  await page.locator('[data-star-view="table"]').click();
  for (const key of ['title', 'type', 'artist']) {
    const heading = page.locator(`[data-star-sort="${key}"]`);
    await heading.click();
    await expect(heading.locator('..')).toHaveAttribute('aria-sort', 'ascending');
    const first = await page.locator('#s-hstar tbody tr').first().innerText();
    await heading.click();
    await expect(heading.locator('..')).toHaveAttribute('aria-sort', 'descending');
    expect(await page.locator('#s-hstar tbody tr').first().innerText()).not.toBe(first);
  }
  await page.locator('[data-star-file]').setInputFiles({ name: 'stars.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(page.locator('#s-hstar a[href$="/artist/89ad4ac3-39f7-470e-963a-56509c546377"]')).toHaveCount(1);
  await page.reload();
  await inject('event_horizon');
  await expect(page.locator('#s-hstar a[href$="/artist/89ad4ac3-39f7-470e-963a-56509c546377"]')).toHaveCount(1);
});
