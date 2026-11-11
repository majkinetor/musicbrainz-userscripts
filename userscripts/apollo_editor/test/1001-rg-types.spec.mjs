import { test, expect } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ autoMatchRG: false }) });

test('release-group name edits keep the type controls usable', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.clock.install();
  await openApollo(page, inject, { seed: { name: 'Bad Boys!', release_group: '5668a267-dda2-4181-a095-80b5d10eb75f' } });
  await expect(page.locator('#primary-type')).toBeDisabled();
  await expect(page.locator('#primary-type + .tc-rg-seg button[data-v="1"]')).toBeDisabled();
  await expect(page.locator('#secondary-types + .tc-rg-seg button[data-v="1"]')).toBeDisabled();
  await page.clock.pauseAt(new Date());
  const group = page.locator('input#release-group');
  await group.press('End');
  await group.press('Backspace');
  await expect(page.locator('#primary-type')).toBeEnabled();
  await group.press('Escape');
  await page.locator('#name').click();
  await expect(page.locator('#primary-type + .tc-rg-seg button').first()).toBeVisible();
  await page.locator('#primary-type + .tc-rg-seg button[data-v="2"]').click();
  await expect(page.locator('#primary-type')).toHaveValue('2');
  await page.locator('#secondary-types + .tc-rg-seg button[data-v="1"]').click();
  await expect(page.locator('#secondary-types option[value="1"]')).toHaveJSProperty('selected', true);
  await page.screenshot({ path: 'dev/_1001-fixed.png', fullPage: true });
});
