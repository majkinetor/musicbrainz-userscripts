import { readFileSync } from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const off = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(x => x && x !== 'event_horizon');
test.use({ gm: { name: 'String Theory', values: {
  'string_theory.off': off,
  'string_theory.theme': { mode: 'light', eh: { 'light:Default': 'Night' }, idle: { on: true, minutes: 1, theme: 'dark:Orchid', effect: 'Night' } },
  view: { on: false, fx: ['hexagons'], hexMotion: 'static', hexOpacity: 60, fxCur: 'Night', fxTheme: 'Night', named: { fx: [{ name: 'Night', v: { fx: ['hexagons'], hexMotion: 'static', hexOpacity: 20 } }] } },
} } });

for (const path of ['/', '/doc/About']) test('idle appearance and exact effect restoration on ' + path, { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(SANDBOX + path);
  await page.clock.install();
  await inject('string_theory');
  await page.waitForFunction(() => !!localStorage.getItem('mbu.ehFxPresets'));
  await page.evaluate(() => window.dispatchEvent(new Event('pointermove')));
  await page.clock.runFor(60001);
  check(await page.locator('#st-theme').getAttribute('data-variant') === 'light', 'idle theme obeys the normal variant, including older saved choices');
  check(await until(() => page.locator('#eh-hex').count(), n => n === 1) === 1, 'idle effect appears even outside the viewer');
  check(await page.evaluate(() => document.documentElement.style.getPropertyValue('--eh-hex-opacity')) === '0.2', 'idle preset is applied');
  check(await page.evaluate(() => GM_getValue('view').hexOpacity) === 60, 'idle effect is not persisted');
  await page.screenshot({ path: 'dev/_953-idle' + (path === '/' ? '-home' : '-doc') + '.png' });
  await page.evaluate(() => window.dispatchEvent(new Event('keydown')));
  check(await until(() => page.locator('#eh-hex').count(), n => n === 0) === 0, 'normal page has its effects off again');
  check(await page.locator('#st-theme').getAttribute('data-variant') === 'light', 'normal theme returns');
  // The idle preset and normal theme mapping have the same name; unsaved normal settings still return.
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  await page.locator('#eh-cfg [data-tab=effects]').click();
  check(await page.locator('#eh-cfg [data-g=hexOpacity][data-k="60"][aria-pressed=true]').count() === 1, 'exact prior effect settings restored');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
  await page.locator('#st-idle-minutes').fill('2');
  await page.locator('#st-idle-minutes').dispatchEvent('change');
  await page.locator('#st-idle-theme').selectOption('*');
  await page.locator('#st-idle-effect').selectOption('*');
  check(await page.evaluate(() => GM_getValue('string_theory.theme').idle.minutes) === 2, 'timeout setting persists');
  await page.screenshot({ path: 'dev/_953-settings.png' });
  await page.clock.runFor(120001);
  check(await page.locator('#st-theme').getAttribute('data-variant') === 'light', 'random theme stays light');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('mbu.ehFxPresets')).includes(document.documentElement.dataset.stEhFxIdle)), 'random effect resolves to an available preset');
  // Wake the page before locating a control: the idle theme can change its position and font.
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-st-idle'));
  await page.locator('#st-th-mode [data-v=dark]').click();
  await page.clock.runFor(120001);
  check(await page.locator('#st-theme').getAttribute('data-variant') === 'dark', 'random theme follows dark mode too');
  check(await page.evaluate(() => GM_getValue('string_theory.theme').idle.theme === '*' && GM_getValue('string_theory.theme').idle.effect === '*'), 'Random stays saved for both choices');
});
