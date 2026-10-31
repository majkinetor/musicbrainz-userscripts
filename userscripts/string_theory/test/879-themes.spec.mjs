// #879: String Theory's own themes. The mode and each variant's theme are in the GM value
// 'string_theory.theme'; the theme is a <style id="st-theme"> and needs no userstyle.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const bg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const variant = page => page.evaluate(() => document.getElementById('st-theme').dataset.variant);
const open = async (page, inject) => {
  await page.goto(`${SANDBOX}/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    const menu = window.__menu = new Map();
    window.GM_registerMenuCommand = (caption, fn, o) => { menu.set(o.id, { caption, fn }); return o.id; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
  });
  await inject('string_theory');
};
const click = (page, id) => page.evaluate(i => window.__menu.get(i).fn(), id);
const caption = (page, id) => page.evaluate(i => window.__menu.get(i).caption, id);

test.describe('menu', () => {
  test.use({ gm: { name: 'String Theory', values: {} } });
  test('light by default, and the menu walks the modes with the page following at once', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    check(/Theme: light/.test(await caption(page, 'st-theme')), 'starts on light');
    check(await variant(page) === 'light', 'the light variant');
    await click(page, 'st-theme');
    check(/Theme: dark/.test(await caption(page, 'st-theme')), 'then dark');
    check(await bg(page) === 'rgb(51, 51, 51)', 'the page turns dark');
    await click(page, 'st-theme');
    check(/auto \(system\)/.test(await caption(page, 'st-theme')), 'then auto');
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
