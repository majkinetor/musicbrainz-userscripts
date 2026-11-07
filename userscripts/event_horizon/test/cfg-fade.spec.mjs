import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

const opacity = cfg => cfg.locator('.mbu-ov-panel').evaluate(p => +getComputedStyle(p).opacity);

// Effects tab: the settings window fades while the mouse is away, comes back when it returns, and stays with the option off
test('settings window fades on the Effects tab while the mouse is away', { tag: ['@prod'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  const cfg = page.locator('#eh-cfg'), panel = cfg.locator('.mbu-ov-panel');
  await until(() => cfg.locator('[data-tab=effects]').count(), n => n === 1);
  const box = async () => { const b = await panel.boundingBox(); return [b.x + b.width / 2, b.y + 20]; };
  const away = async () => { const b = await panel.boundingBox(); await page.mouse.move(b.x > 200 ? 20 : b.x + b.width + 60, 300); };

  // General tab: no fade
  await page.mouse.move(...await box()); await away();
  await page.waitForTimeout(500);
  check(await opacity(cfg) === 1, 'the General tab never fades');

  await page.mouse.move(...await box());
  await cfg.locator('[data-tab=effects]').click();
  await until(() => cfg.locator('[data-g=cfgFade]').count(), n => n === 1);
  check(await cfg.locator('[data-g=cfgFade]').getAttribute('aria-checked') === 'true', 'on by default');
  await away();
  check(await until(() => opacity(cfg), o => o < 0.2), 'faded with the mouse away');
  await page.mouse.move(...await box());
  check(await until(() => opacity(cfg), o => o === 1), 'back when the mouse returns');

  await cfg.locator('[data-g=cfgFade]').click();
  check(await until(() => cfg.locator('[data-g=cfgFade]').getAttribute('aria-checked'), v => v === 'false'), 'turned off');
  await away();
  await page.waitForTimeout(600);
  check(await opacity(cfg) === 1, 'off: the window stays');
});
