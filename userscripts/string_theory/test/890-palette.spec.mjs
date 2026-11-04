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
    check((await rows(page))[0] === 'Search Artist: zzqx', 'what matches nothing is a search');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('settings string');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#st-cfg', { timeout: 5000 });
    check(await page.locator('#st-tab-g').getAttribute('aria-selected') === 'true', 'the settings open on General');
  });
  test('pins move by dragging and with Alt+arrows', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    for (const q of ['settings dock', 'settings string', 'theme: dark']) {
      await page.keyboard.press('Control+a');
      await page.keyboard.type(q);
      await page.keyboard.press('Alt+p');
    }
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    const pinned = () => page.$eval('#st-pal-list .st-pal-i[data-pinned] .st-pal-l', ls => ls.map(l => l.textContent));
    check((await pinned()).join() === 'Dock,String Theory,Dark', `pinned in order (${await pinned()})`);
    const box = async i => (await page.$('#st-pal-list .st-pal-i[data-pinned]'))[i].boundingBox();
    const from = await box(2), to = await box(0);
    await page.mouse.move(from.x + 40, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + from.height / 2 - 8, { steps: 3 });
    await page.mouse.move(to.x + 40, to.y + 3, { steps: 6 });
    await page.mouse.up();
    check((await pinned()).join() === 'Dark,Dock,String Theory', `the drop moves it (${await pinned()})`);
    check(await page.$('#st-pal') && await variant(page) === 'light', 'the drop runs nothing');
    const kept = await page.evaluate(() => GM_getValue('string_theory.palette', {}).pins);
    check(kept.length === 3 && /theme/.test(kept[0]), `the order is kept (${kept})`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Alt+ArrowDown');
    check((await pinned()).join() === 'Dock,Dark,String Theory', `Alt+Down moves it (${await pinned()})`);
    check(await page.$eval('#st-pal-list .st-pal-i[aria-selected=true] .st-pal-l', l => l.textContent) === 'Dark', 'and it stays selected');
  });
  test('the last input comes back selected', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await open(page, inject);
    await page.keyboard.type('theme: dark');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+k');
    const sel = await page.$eval('#st-pal-q', i => i.value.slice(i.selectionStart, i.selectionEnd));
    check(sel === 'theme: dark', `selected (${sel})`);
    check((await rows(page))[0] === 'Theme: Dark', 'and filtering');
    check(await variant(page) === 'light', 'previewing nothing');
    await page.keyboard.type('x');
    check(await page.inputValue('#st-pal-q') === 'x', 'typing replaces it');
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
