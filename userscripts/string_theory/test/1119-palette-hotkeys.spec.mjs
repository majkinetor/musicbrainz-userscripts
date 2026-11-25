// #1119: a hotkey of your own for a palette command. Alt+K records it, it runs the command
// without the palette, a key another command holds moves only on a second press, Backspace removes it.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const variant = page => page.evaluate(() => document.getElementById('st-theme').dataset.variant);
const keys = page => page.evaluate(() => GM_getValue('string_theory.palette', {}).keys || {});
const pick = async (page, q) => {
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#st-pal-q', { timeout: 10000 });
  await page.keyboard.press('Control+a');
  await page.keyboard.type(q);
};

test.describe('palette hotkeys', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'] } } });
  test('set, run, move and remove', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await pick(page, 'theme: dark');
    await page.keyboard.press('Alt+k');
    check(/Press keys/.test(await page.locator('#st-pal-list .st-pal-i[aria-selected=true] .st-pal-k').textContent()), 'the row waits for the keys');
    await page.keyboard.press('Shift+F2');
    check(/needs Ctrl, Alt or Meta/.test(await page.locator('#st-pal-foot').textContent()), 'a key without Ctrl, Alt or Meta is refused');
    await page.keyboard.press('Control+k');
    check(/opens/.test(await page.locator('#st-pal-foot').textContent()), 'the palette key is refused');
    await page.keyboard.press('Control+Alt+F2');
    const set = await keys(page);
    const dark = Object.keys(set)[0];
    check(Object.keys(set).length === 1 && /theme/.test(dark) && set[dark].key === 'f2', `kept (${JSON.stringify(set)})`);
    check(await page.locator('#st-pal-list .st-pal-i[aria-selected=true] .st-pal-k').textContent() === 'Ctrl+Alt+F2', 'shown on its row');
    await page.keyboard.press('Escape');
    check(!(await page.$('#st-pal')), 'Escape closes the palette');

    await page.keyboard.press('Control+Alt+F2');
    await until(() => variant(page), v => v === 'dark', { timeout: 5000 });
    check(!(await page.$('#st-pal')), 'the hotkey runs it without the palette');

    await pick(page, 'theme: light');
    await page.keyboard.press('Alt+k');
    await page.keyboard.press('Control+Alt+F2');
    check(/press it again/.test(await page.locator('#st-pal-foot').textContent()), 'a key in use asks first');
    check(Object.keys(await keys(page))[0] === dark, 'and moves nothing yet');
    await page.keyboard.press('Control+Alt+F2');
    const moved = await keys(page);
    check(Object.keys(moved).length === 1 && !moved[dark], `the second press moves it (${JSON.stringify(moved)})`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+Alt+F2');
    await until(() => variant(page), v => v === 'light', { timeout: 5000 });

    await pick(page, 'theme: light');
    await page.keyboard.press('Alt+k');
    await page.keyboard.press('Backspace');
    check(Object.keys(await keys(page)).length === 0, 'Backspace removes it');
    check(await page.inputValue('#st-pal-q') === 'theme: light', 'and leaves the box as it was');
  });
});
