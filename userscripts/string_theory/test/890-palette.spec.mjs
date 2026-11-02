// #890: the command palette. A hotkey (Ctrl+K) opens it, typing filters, the arrows move, Enter runs;
// a theme shows while it is highlighted and goes back on Escape; pins come first.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const variant = page => page.evaluate(() => document.getElementById('st-theme').dataset.variant);
const rows = page => page.$$eval('#st-pal-list .st-pal-i', ls => ls.map(l => l.querySelector('.st-pal-c').textContent + l.querySelector('.st-pal-l').textContent));
const open = async (page, inject) => {
  await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
  await inject('string_theory');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#st-pal-q', { timeout: 10000 });
};

test.describe('palette', () => {
  test.use({ gm: { name: 'String Theory', values: {} } });
  test('filters, previews a theme, runs on Enter, pins', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    await open(page, inject);
    check((await rows(page))[0] === 'Settings: String Theory', 'starts with the settings');
    await page.keyboard.type('theme: dark');
    check((await rows(page))[0] === 'Theme: Dark', `the typed phrase ranks first (${(await rows(page))[0]})`);
    await until(() => variant(page), v => v === 'dark', { timeout: 5000 });
    await page.keyboard.press('Escape');
    check(!(await page.$('#st-pal')), 'Escape closes it');
    await until(() => variant(page), v => v === 'light', { timeout: 5000 });
    await page.keyboard.press('Control+k');
    await page.keyboard.type('theme: dark');
    await page.keyboard.press('Enter');
    await until(() => variant(page), v => v === 'dark', { timeout: 5000 });
    check(await page.evaluate(() => GM_getValue('string_theory.theme', {}).mode) === 'dark', 'Enter keeps it');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('settings dock');
    await page.keyboard.press('Alt+p');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    const first = await page.$$eval('#st-pal-list li', ls => ls.slice(0, 2).map(l => l.textContent));
    check(first[0] === 'Pinned' && /^Settings: Dock/.test(first[1]), `the pin comes first (${first})`);
    await page.keyboard.type('zzqx');
    check((await rows(page))[0] === 'Search: Artist “zzqx”', 'what matches nothing is a search');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('settings string');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#st-cfg', { timeout: 5000 });
    check(await page.locator('#st-tab-g').getAttribute('aria-selected') === 'true', 'the settings open on General');
  });
  test('the hotkey can be changed and turned off', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-pal-key').click();
    await page.keyboard.press('Control+Shift+Space');
    check(await page.locator('#st-pal-key').textContent() === 'Ctrl+Shift+Space', 'recorded');
    await page.keyboard.press('Control+Shift+Space');
    await page.waitForSelector('#st-pal', { timeout: 5000 });
    await page.keyboard.press('Escape');
    check(!!(await page.$('#st-cfg')), 'Escape closes the palette, not the settings under it');
    await page.locator('#st-pal-on [data-v=off]').click();
    await page.keyboard.press('Control+Shift+Space');
    check(!(await page.$('#st-pal')), 'off, the hotkey does nothing');
  });
});
