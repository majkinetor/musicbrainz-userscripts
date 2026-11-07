// #930: a long drop-down opens a list filtered as you type; a pick sets MusicBrainz's own select.
import { test, expect } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the language drop-down filters as you type and Enter picks', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: {} });
  const lang = page.locator('select#language');
  await lang.waitFor({ timeout: 15000 });
  await lang.click();
  const pop = page.locator('.tc-sf');
  await expect(pop).toBeVisible();
  await page.keyboard.type('fren');
  await expect(pop.locator('li[role=option]').first()).toHaveText('French');
  await page.keyboard.press('Enter');
  await expect(pop).toHaveCount(0);
  expect(await lang.evaluate(s => s.options[s.selectedIndex].textContent.trim())).toBe('French');
  // typing on the focused select opens the list seeded with the key
  await lang.focus();
  await page.keyboard.press('g');
  await expect(page.locator('.tc-sf input')).toHaveValue('g');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tc-sf')).toHaveCount(0);
});
