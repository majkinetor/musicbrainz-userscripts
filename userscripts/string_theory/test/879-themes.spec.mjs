// #879: String Theory's own themes. The mode and each variant's theme are in the GM value
// 'string_theory.theme'; the theme is a <style id="st-theme"> and needs no userstyle.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

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
  test('light by default, and the Theme tab sets the mode with the page following at once', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-t').click();
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
    await page.locator('#st-tab-t').click();
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
    await page.locator('#st-tab-t').click();
    await pick(page, 'time');
    await page.locator('#st-th-from').fill('0:00');
    await page.locator('#st-th-to').fill('23:59');
    await page.locator('#st-th-to').blur();
    await until(() => variant(page), v => v === 'dark', { timeout: 5000 });
    check(await page.locator('#st-th-from').inputValue() === '00:00', 'tidied to 24h');
    await until(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-theme')), v => v === 'dark', { timeout: 5000 });
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
