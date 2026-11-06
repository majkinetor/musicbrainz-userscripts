import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

const openFx = async page => {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  const cfg = page.locator('#eh-cfg');
  await until(() => cfg.locator('[data-tab=effects]').count(), n => n === 1);
  await cfg.locator('[data-tab=effects]').click();
  await until(() => cfg.locator('[data-fx-name]').count(), n => n === 1);
  return cfg;
};
// the hexagons on: the effect badge added when missing, then Hexagons picked
const hexOn = async cfg => {
  if (await cfg.locator('[data-fx-sel=hexagons]').count()) await cfg.locator('[data-fx-sel=hexagons]').click();
  else { await cfg.locator('[data-g=fxAdd][data-k=fx]').click(); await cfg.locator('[data-g=fxKind][data-k=hexagons]').click(); }
  await until(() => cfg.locator('[data-g=hexOpacity]').count(), n => n > 0);
};
const css = (page, p) => page.evaluate(p => document.documentElement.style.getPropertyValue(p), p);
const names = page => page.evaluate(() => JSON.parse(localStorage.getItem('mbu.ehFxPresets') || 'null'));
const items = async cfg => { await cfg.locator('[data-fx-dd]').click(); const v = await cfg.locator('[data-fx-item]').evaluateAll(a => a.map(x => x.dataset.fxItem)); await cfg.locator('[data-fx-dd]').click(); return v; };

// Effects tab: a preset made with +, named and saved, its changes kept on their own, + a copy, Delete; String Theory's names follow
test('effect presets save, load and delete by name', { tag: ['@prod', '@critical'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  check(await cfg.locator('[data-fx-del][aria-disabled=true]').count() === 1, 'nothing saved to delete yet');
  await hexOn(cfg);
  await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
  await cfg.locator('[data-fx-name]').fill('Soft');
  await cfg.locator('[data-fx-save]').click();
  check(await until(() => names(page), v => v?.[0] === 'Soft'), 'saved, and the name goes to String Theory');

  await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();
  await cfg.locator('[data-fx-name]').fill('Strong');
  await cfg.locator('[data-fx-new]').click();
  check((await until(() => names(page), v => v?.length === 2)).join() === 'Soft,Strong', '+ keeps a copy');
  await cfg.locator('[data-g=hexOpacity][data-k="40"]').click();

  await cfg.locator('[data-fx-dd]').click();
  await cfg.locator('[data-fx-item="Soft"]').click();
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.6') === '0.6', 'Soft kept the change made while it was current');
  await cfg.locator('[data-fx-dd]').click();
  await cfg.locator('[data-fx-item="Strong"]').click();
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === "0.4") === "0.4", 'and Strong its own');

  await cfg.locator('[data-fx-del]').click();
  check(JSON.stringify(await until(() => names(page), v => v?.length === 1)) === '["Soft"]', 'Delete removes it, from String Theory\'s list too');
  check(JSON.stringify(await items(cfg)) === '["Soft"]', 'and from the list');
  check(await cfg.locator('[data-fx-name]').inputValue() === '', 'the effect stays, unsaved');

  await cfg.locator('.chip[data-fx-new]').click();
  check(await until(() => cfg.locator('[data-fx-name]').inputValue(), v => v === 'Unnamed effect') === 'Unnamed effect', '+ copies the effect into a new preset');
  check(await until(() => names(page), v => v?.length === 2), 'saved at once');
});

// Copy as JSON gives a preset to share; Import from JSON adds it under a free name and applies it
test('an effect preset goes out and back as JSON', { tag: ['@prod'] }, async ({ page, inject, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  await hexOn(cfg);
  await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
  await cfg.locator('[data-fx-name]').fill('Share');
  await cfg.locator('[data-fx-save]').click();
  await cfg.locator('[data-fx-dd]').click();
  await cfg.locator('[data-fx-copy]').click();
  const json = await until(() => page.evaluate(() => navigator.clipboard.readText()), v => /ehFxPreset/.test(v));
  check(JSON.parse(json).v.hexOpacity != null, 'the JSON has the opacity: ' + json);
  await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();

  await cfg.locator('[data-fx-dd]').click();
  await cfg.locator('[data-fx-paste]').click();
  await cfg.locator('[data-fx-json]').fill('nope');
  await cfg.locator('[data-fx-import]').click();
  check(await until(() => cfg.locator('.fx-err').count(), n => n === 1), 'not JSON reads as an error');
  await cfg.locator('[data-fx-json]').fill(json);
  await cfg.locator('[data-fx-import]').click();
  check(await until(() => cfg.locator('[data-fx-name]').inputValue(), v => v === 'Share 2') === 'Share 2', 'imported under a free name');
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.3') === '0.3', 'and applied');
});

// String Theory's theme names a preset on <html data-st-eh-fx>: applied when the name changes, not again over the user's own changes
test('a theme\'s preset applies when String Theory names it', { tag: ['@prod'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  await hexOn(cfg);
  await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
  await cfg.locator('[data-fx-name]').fill('Night');
  await cfg.locator('[data-fx-save]').click();
  await cfg.locator('[data-fx-name]').fill('Day');
  await cfg.locator('.chip[data-fx-new]').click();
  await cfg.locator('[data-g=fxRm][data-k=hexagons]').click();
  check(await until(() => page.evaluate(() => document.documentElement.dataset.ehHex || ''), v => !v) === '', 'the effect removed');
  await page.evaluate(() => document.documentElement.setAttribute('data-st-eh-fx', 'Night'));
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.3') === '0.3', 'the theme\'s preset comes on');
  check(await until(() => cfg.locator('[data-fx-name]').inputValue(), v => v === 'Night') === 'Night', 'the open window shows it');
  await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();
  await page.evaluate(() => document.documentElement.setAttribute('data-st-eh-fx', 'Night'));
  check(await until(() => css(page, '--eh-hex-opacity'), v => v === '0.6') === '0.6', 'the same name again leaves the user\'s change');
});

// several effects at once: each added one gets its badge and its own layer, and goes on its own
test('effects stack', { tag: ['@prod'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  await hexOn(cfg);
  await cfg.locator('[data-g=fxAdd][data-k=fx]').click();
  await cfg.locator('[data-g=fxKind][data-k=stars]').click();
  await cfg.locator('[data-g=fxAdd][data-k=fx]').click();
  await cfg.locator('[data-g=fxKind][data-k=aurora]').click();
  check(await until(() => cfg.locator('.fx-b [data-fx-sel]:not([data-fx-sel=bg])').count(), n => n === 3) === 3, 'three effect badges');
  check(await until(() => page.locator('.eh-amb').count(), n => n === 2) === 2 && await page.locator('#eh-hex').count() === 1, 'hexagons and two more layers');
  await cfg.locator('[data-g=fxRm][data-k=stars]').click();
  check(await until(() => page.locator('.eh-amb').count(), n => n === 1) === 1 && await page.locator('#eh-hex').count() === 1, 'one removed, the others stay');
});
