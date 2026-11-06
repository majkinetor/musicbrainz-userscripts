// #879: String Theory's own themes. The mode and each variant's theme are in the GM value
// 'string_theory.theme'; the theme is a <style id="st-theme"> and needs no userstyle.
import { test, check, requireLogin, until, SANDBOX } from '../../../dev/test/harness.mjs';

const bg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const variant = page => page.evaluate(() => document.getElementById('st-theme').dataset.variant);
const open = async (page, inject) => {
  await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
  await inject('string_theory');
};
const pick = (page, v) => page.locator(`#st-th-mode [data-v=${v}]`).click();
const picked = page => page.locator('#st-th-mode [aria-checked=true]').getAttribute('data-v');

test.describe('settings', () => {
  test.use({ gm: { name: 'String Theory', values: {} } });
  test('light by default, and the General tab sets the mode with the page following at once', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-g').click();
    check(await picked(page) === 'light', 'starts on light');
    check(await variant(page) === 'light', 'the light variant');
    await pick(page, 'dark');
    check(await picked(page) === 'dark', 'then dark');
    check(await bg(page) === 'rgb(51, 51, 51)', 'the page turns dark');
    const hs = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('headerid-type')); return [c.backgroundColor, c.color]; });
    check(hs[0] !== 'rgb(255, 255, 255)' && hs[0] !== hs[1], 'the header search select is dark too');
    await pick(page, 'time');
    check(await page.locator('#st-th-from').isVisible(), 'time asks for the hours');
    for (const id of ['#st-th-dark', '#st-th-light']) {
      const l = await page.locator(`label[for=${id.slice(1)}]`).boundingBox();
      check(l.height < 24, 'its label stays on one line');
    }
    await page.locator('#st-th-from').fill('00:00');
    await page.locator('#st-th-to').fill('23:59');
    await until(() => variant(page), v => v === 'dark', { timeout: 5000 });
    await pick(page, 'auto');
    check(await picked(page) === 'auto', 'then the system');
  });
});

test.describe('Event Horizon', () => {
  test.use({ gm: { name: 'String Theory', values: {} } });
  test('its release view follows the switch both ways without a reload', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(SANDBOX + '/release/54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    const eh = () => page.evaluate(() => document.documentElement.getAttribute('data-eh-theme'));
    await until(eh, v => v === 'light', { timeout: 15000 });
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-g').click();
    await pick(page, 'dark');
    await until(eh, v => v === 'dark', { timeout: 5000 });
    await pick(page, 'light');
    await until(eh, v => v === 'light', { timeout: 5000 });
  });
});

test.describe('Time', () => {
  test.use({ gm: { name: 'String Theory', values: {} } });
  test('Event Horizon front page turns dark inside the hours, entered in 24h', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(SANDBOX + '/', { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-g').click();
    await pick(page, 'time');
    await page.locator('#st-th-from').fill('0:00');
    await page.locator('#st-th-to').fill('23:59');
    await page.locator('#st-th-to').blur();
    await until(() => variant(page), v => v === 'dark', { timeout: 5000 });
    check(await page.locator('#st-th-from').inputValue() === '00:00', 'tidied to 24h');
    await until(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-theme')), v => v === 'dark', { timeout: 5000 });
  });
});

test.describe('dialog', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.theme': { mode: 'dark' } } } });
  test('Add relationship has dark controls', { tag: ['@sandbox', '@login', '@cosmetic'] }, async ({ page, inject }) => {
    await page.goto(SANDBOX + '/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce/edit-relationships', { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await inject('string_theory');
    await page.getByRole('button', { name: 'Add relationship' }).first().click();
    await page.locator('#add-relationship-dialog button.positive').waitFor();
    const bg = await page.evaluate(() => {
      const d = document.querySelector('#add-relationship-dialog');
      const n = d.appendChild(document.createElement('input')); n.type = 'number';
      const of = e => getComputedStyle(e).backgroundColor;
      return [of(n), of(d.querySelector('button.positive')), of(d.querySelector('button.negative'))];
    });
    const dark = c => { const [r, g, b] = c.match(/[0-9]+/g).map(Number); return r + g + b < 300; };
    check(bg.every(dark), 'number, Done and Cancel are dark: ' + bg);
  });
});

test.describe('auto', () => {
  test.use({ colorScheme: 'dark', gm: { name: 'String Theory', values: { 'string_theory.theme': { mode: 'auto' } } } });
  test('follows the system', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    check(await variant(page) === 'dark', 'dark with a dark system');
    await page.emulateMedia({ colorScheme: 'light' });
    await until(() => variant(page), v => v === 'light', { timeout: 5000 });
  });
});

test.describe('Event Horizon effect', () => {
  test.use({ gm: { name: 'String Theory', values: {} }, profile: 'fresh' });
  test('each theme can name an Event Horizon effect preset, applied when that theme comes on', { tag: ['@prod'] }, async ({ page, inject }) => {
    await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e', { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    const op = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--eh-hex-opacity'));
    const fx = () => page.evaluate(() => document.documentElement.getAttribute('data-st-eh-fx'));
    // a preset saved in Event Horizon's Effects tab
    await until(() => page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })) || document.getElementById('eh-cfg') !== null), v => v);
    const cfg = page.locator('#eh-cfg');
    await cfg.locator('[data-tab=effects]').click();
    await cfg.locator('select[data-fx-pick]').selectOption('hexagons');
    await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
    await cfg.locator('[data-fx-name]').fill('Dim');
    await cfg.locator('[data-fx-save]').click();
    await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-g').click();
    const sel = page.locator('#st-th-eh-dark');
    check(await sel.count() === 1, 'a Dark effect select');
    check((await sel.locator('option').allTextContents()).join() === 'No preset,Dim', 'it lists Event Horizon\'s presets');
    await sel.selectOption('Dim');
    check(await fx(page) === null, 'the light theme has none');
    await pick(page, 'dark');
    check(await until(fx, v => v === 'Dim') === 'Dim', 'dark names it');
    check(await until(op, v => v === '0.3') === '0.3', 'and Event Horizon applies it');
    await pick(page, 'light');
    check(await until(fx, v => v === null) === null, 'back to light drops the name');
  });
});
