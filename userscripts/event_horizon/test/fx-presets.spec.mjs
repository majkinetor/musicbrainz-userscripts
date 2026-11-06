import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

const openFx = async page => {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  const cfg = page.locator('#eh-cfg');
  await until(() => cfg.locator('[data-tab=effects]').count(), n => n === 1);
  await cfg.locator('[data-tab=effects]').click();
  await until(() => cfg.locator('select[data-fx-pick]').count(), n => n === 1);
  return cfg;
};
const css = (page, p) => page.evaluate(p => document.documentElement.style.getPropertyValue(p), p);

// Effects tab: an effect with its settings saved by name, picked back from the Preset select, deleted; String Theory's names list follows
test('effect presets save, load and delete by name', { tag: ['@prod', '@critical'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  check(await cfg.locator('[data-fx-preset]').count() === 0, 'no Preset select before any preset is saved');
  await cfg.locator('select[data-fx-pick]').selectOption('hexagons');
  await until(() => cfg.locator('[data-g=hexOpacity]').count(), n => n > 0);
  await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
  await cfg.locator('[data-fx-name]').fill('Soft');
  await cfg.locator('[data-fx-save]').click();
  check(await until(() => cfg.locator('[data-fx-preset]').inputValue().catch(() => ''), v => v === 'Soft') === 'Soft', 'the saved preset is selected');
  const pub = await page.evaluate(() => [localStorage.getItem('mbu.ehFxPresets'), Object.keys(localStorage).filter(k => /^mbu/.test(k))]);
  check(JSON.parse(pub[0] || 'null')?.[0] === 'Soft', 'the names go to String Theory: ' + JSON.stringify(pub));

  await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();
  check(await until(() => cfg.locator('[data-fx-preset]').inputValue(), v => v === '') === '', 'changed settings read as Custom');
  await cfg.locator('[data-fx-name]').fill('Strong');
  await cfg.locator('[data-fx-name]').press('Enter');
  check(await until(() => cfg.locator('[data-fx-preset] option').count(), n => n === 2) === 2, 'Enter saves a second preset');

  await cfg.locator('[data-fx-preset]').selectOption('Soft');
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.3') === '0.3', 'picking Soft brings its opacity back');
  await cfg.locator('[data-fx-del]').click();
  check((await until(() => cfg.locator('[data-fx-preset] option').allTextContents(), v => !v.includes('Soft'))).join() === 'Custom,Strong', 'Delete removes it');
  check(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('mbu.ehFxPresets') || 'null'))) === '["Strong"]', 'and from String Theory\'s list');
});

// String Theory's theme names a preset on <html data-st-eh-fx>: applied when the name changes, not again over the user's own changes
test('a theme\'s preset applies when String Theory names it', { tag: ['@prod'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  await cfg.locator('select[data-fx-pick]').selectOption('hexagons');
  await until(() => cfg.locator('[data-g=hexOpacity]').count(), n => n > 0);
  await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
  await cfg.locator('[data-fx-name]').fill('Night');
  await cfg.locator('[data-fx-save]').click();
  await cfg.locator('select[data-fx-pick]').selectOption('none');
  check(await until(() => page.evaluate(() => document.documentElement.dataset.ehHex || ''), v => !v) === '', 'None turns the effect off');
  await page.evaluate(() => document.documentElement.setAttribute('data-st-eh-fx', 'Night'));
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.3') === '0.3', 'the theme\'s preset comes on');
  check(await until(() => cfg.locator('[data-fx-preset]').inputValue(), v => v === 'Night') === 'Night', 'the open window shows it');
  await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();
  await page.evaluate(() => document.documentElement.setAttribute('data-st-eh-fx', 'Night'));
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.6') === '0.6', 'the same name again leaves the user\'s change');
});
