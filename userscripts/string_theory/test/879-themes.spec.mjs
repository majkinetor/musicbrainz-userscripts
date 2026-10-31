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
    await pick(page, 'auto');
    check(await picked(page) === 'auto', 'then the system');
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
