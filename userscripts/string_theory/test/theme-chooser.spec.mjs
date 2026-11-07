// The theme chooser: a bar at the bottom that steps through every theme, Enter keeps one, Escape goes back.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const variant = page => page.evaluate(() => document.getElementById('st-theme').dataset.variant);
const open = async page => {
  await page.locator('body:not([hidden])').click({ position: { x: 5, y: 5 } });
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
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowRight'); check(await variant(page) === 'dark', 'Dark steps through dark themes only'); }
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

test.describe('theme chooser effect', () => {
  test.use({ gm: { name: 'String Theory', values: {} }, profile: 'fresh' });
  test('picks the Event Horizon effect a theme brings: tried as picked, put back on Escape, kept on Enter', { tag: ['@prod'] }, async ({ page, inject }) => {
    await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e', { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    const op = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--eh-hex-opacity'));
    const attr = n => page.evaluate(k => document.documentElement.getAttribute(k), n);
    // Dim saved in Event Horizon's Effects tab, then Bright, which follows the effect to 0.6
    await until(() => page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })) || document.getElementById('eh-cfg') !== null), v => v);
    const cfg = page.locator('#eh-cfg');
    await cfg.locator('[data-tab=effects]').click();
    await cfg.locator('[data-g=fxAdd][data-k=fx]').click();
    await cfg.locator('[data-g=fxKind][data-k=hexagons]').click();
    await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
    await cfg.locator('[data-fx-name]').fill('Dim');
    await cfg.locator('[data-fx-save]').click();
    await cfg.locator('[data-fx-name]').fill('Bright');
    await cfg.locator('[data-fx-new]').click();
    await cfg.locator('[data-g=hexOpacity][data-k="60"]').click();
    await cfg.locator('[data-fx-save]').click();
    await page.keyboard.press('Escape');
    check(await until(op, v => v === '0.6') === '0.6', 'the effect starts at 0.6');
    await open(page);
    const sel = page.locator('#st-tc-e');
    const opts = (await sel.locator('option').allTextContents()).join();
    check(opts === 'Current effect,No effect,Bright,Dim', `the chooser lists Event Horizon's presets, by name (${opts})`);
    check(await sel.inputValue() === 'Bright' && await op() === '0.6', `it opens on the preset on show, and nothing changes (${await sel.inputValue()})`);
    await sel.selectOption('Dim');
    check(await until(op, v => v === '0.3') === '0.3', 'the picked effect shows at once');
    check(await attr('data-st-eh-fx-try') === 'Dim' && await attr('data-st-eh-fx') === null, 'tried, not saved');
    await page.keyboard.press('ArrowRight');
    check(await sel.inputValue() === 'Dim' && await until(op, v => v === '0.3') === '0.3', 'the next theme keeps the picked effect');
    await page.keyboard.press('ArrowUp');
    check(await sel.inputValue() === 'Bright', 'up picks the effect before');
    await page.keyboard.press('ArrowUp');
    check(await sel.inputValue() === '-' && await until(() => attr('data-eh-hex'), v => v === null) === null, 'No effect shows none');
    await page.keyboard.press('ArrowUp');
    check(await sel.inputValue() === '' && await until(op, v => v === '0.6') === '0.6', 'up the one before');
    await page.keyboard.press('ArrowLeft');
    check(await sel.inputValue() === '', 'and the themes stepped to bring that');
    // the counts: a click steps on, a right-click back
    const fxI = page.locator('#st-tc [data-fx-i]'), thI = page.locator('#st-tc [data-th-i]');
    check(await fxI.textContent() === '1/4', `the effect shows its place (${await fxI.textContent()})`);
    await fxI.click();
    check(await sel.inputValue() === '-' && await fxI.textContent() === '2/4', 'a click on its count picks the next effect');
    await fxI.click({ button: 'right' });
    check(await sel.inputValue() === '' && await fxI.textContent() === '1/4', 'a right-click the one before');
    const n = await thI.textContent();
    await thI.click();
    const m = await thI.textContent();
    check(parseInt(m) === parseInt(n) % parseInt(n.split('/')[1]) + 1, `a click on the theme's count steps to the next (${n} → ${m})`);
    await thI.click({ button: 'right' });
    check(await thI.textContent() === n, 'a right-click back');
    await page.screenshot({ path: 'test-results/theme-chooser-effect.png' });
    await page.keyboard.press('Escape');
    check(await until(op, v => v === '0.6') === '0.6', 'Escape puts the effect back');
    const none = await page.evaluate(() => GM_getValue('string_theory.theme', {}).eh || {});
    check(!Object.keys(none).length, `and saves no effect (${JSON.stringify(none)})`);
    await open(page);
    await sel.selectOption('Dim');
    await page.keyboard.press('Enter');
    const saved = await page.evaluate(() => GM_getValue('string_theory.theme', {}));
    check(saved.eh && saved.eh['light:' + saved.light] === 'Dim', `Enter keeps the theme's effect (${JSON.stringify(saved)})`);
    check(await until(() => attr('data-st-eh-fx'), v => v === 'Dim') === 'Dim' && await attr('data-st-eh-fx-try') === null, 'the theme names it now');
    check(await until(op, v => v === '0.3') === '0.3', 'and Event Horizon keeps it');
    await open(page);
    await sel.selectOption('Bright');
    await page.click('#st-tc-ed');
    await page.waitForSelector('#eh-cfg [data-tab=effects][aria-selected=true]', { timeout: 5000 });
    check(!!(await page.$('#st-tc')), 'the pencil opens Event Horizon on Effects, and the chooser stays');
    check(await until(() => page.locator('#eh-cfg [data-fx-name]').inputValue(), v => v === 'Bright') === 'Bright' && await until(op, v => v === '0.6') === '0.6', 'on the effect that was on show');
    await page.screenshot({ path: 'test-results/theme-chooser-edit.png' });
  });
});
