// The theme chooser: a bar at the bottom that steps through every theme, Enter keeps one, Escape goes back.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const variant = page => page.evaluate(() => document.getElementById('st-theme').dataset.variant);
const open = async page => {
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#st-pal-q', { timeout: 10000 });
  await page.keyboard.type('theme chooser');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#st-tc', { timeout: 5000 });
};

test.describe('theme chooser', () => {
  test.use({ gm: { name: 'String Theory', values: {} } });
  test('steps, goes back on Escape, keeps on Enter', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await open(page);
    check(!(await page.$('#st-pal')), 'the palette is gone');
    const box = await page.locator('#st-tc').boundingBox(), vh = page.viewportSize().height;
    check(box.height < 60 && box.y > vh - 100, `a slim bar at the bottom (${JSON.stringify(box)})`);
    const first = await page.textContent('#st-tc .st-tc-n');
    await page.keyboard.press('ArrowRight');
    check(await page.textContent('#st-tc .st-tc-n') !== first, 'the arrow steps');
    for (let i = 0; i < 12 && await variant(page) === 'light'; i++) await page.keyboard.press('ArrowRight');
    check(await variant(page) === 'dark', 'reaches a dark theme');
    await page.click('#st-tc-f'); await page.click('#st-tc-f');
    check(await page.textContent('#st-tc-f') === 'Dark', 'the switch reads Dark');
    for (let i = 0; i < 12; i++) { await page.click('#st-tc-nx'); check(await variant(page) === 'dark', 'Dark steps through dark themes only'); }
    await page.screenshot({ path: 'test-results/theme-chooser-bar.png' });
    await page.click('#st-tc-f');
    await page.keyboard.press('Escape');
    check(!(await page.$('#st-tc')), 'Escape closes it');
    await until(() => variant(page), v => v === 'light', { timeout: 5000 });
    await open(page);
    for (let i = 0; i < 12 && await variant(page) === 'light'; i++) await page.keyboard.press('ArrowLeft');
    const name = (await page.textContent('#st-tc .st-tc-n')).replace(/ dark$/, '');
    await page.keyboard.press('Enter');
    const saved = await page.evaluate(() => GM_getValue('string_theory.theme', {}));
    check(saved.mode === 'dark' && saved.dark === name, `Enter keeps it (${JSON.stringify(saved)})`);
    await page.screenshot({ path: 'test-results/theme-chooser.png' });
  });
  test('the settings header opens it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.click('#mbu-dock', { button: 'right' });
    await page.waitForSelector('#st-cfg #st-tc-open', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/theme-chooser-settings.png' });
    await page.click('#st-tc-open');
    await page.waitForSelector('#st-tc', { timeout: 5000 });
    check(!(await page.$('#st-cfg')), 'settings step aside for the chooser');
  });
});
