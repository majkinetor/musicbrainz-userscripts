import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// Settings' Hexagons row holds Show, the opacity stepper and the animation select on one line
test('the Hexagons row steps the opacity and holds the animation', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  const row = page.locator('#eh-cfg .hex-controls');
  check(await until(() => row.count(), n => n === 1) === 1, 'Settings has the Hexagons controls');
  check(await row.locator('.mbu-step input[data-hex-opacity]').count() === 1, 'the opacity is a stepper');
  check(await row.locator('select[data-hex-motion]').count() === 1, 'the animation select sits on the same row');
  await row.locator('[data-g=hex]').click();
  const field = page.locator('#eh-cfg input[data-hex-opacity]');
  await page.locator('#eh-cfg .hex-controls .mbu-step button[aria-label=More]').click();
  check(await until(() => field.inputValue(), v => v === '25') === '25', '+ steps 20 to 25');
  check(await until(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--eh-hex-opacity')), v => v === '0.25') === '0.25', 'the step applies');
  const tops = await row.locator(':scope > *').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  check(Math.max(...tops) - Math.min(...tops) <= 4, 'all on one line: ' + tops);
  await page.locator('#eh-cfg .mbu-ov-panel').screenshot({ path: 'test-results/eh-hex-row.png' });
});
