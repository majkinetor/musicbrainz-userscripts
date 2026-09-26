// #462: Mammoth's field pins (z-index 9998) floated over MusicBrainz's autocomplete
// menu (z-index 100). jQuery UI opens the menu by toggling `display`, which the page
// observer never sees, so each menu is watched directly: while one is open,
// html.mmthf-acopen hides the pins.
//
// test.musicbrainz.org, nothing submitted: the release editor, typing into the label
// lookup (itself a pinned field).
import { test, check, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
test.use({ gm: { name: 'Mammoth' } });

test('the pins hide while an autocomplete menu is open', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForTimeout(3000);
  await inject('mammoth');
  await page.waitForTimeout(1500);

  const state = () => page.evaluate(() => ({
    acopen: document.documentElement.classList.contains('mmthf-acopen'),
    menu: [...document.querySelectorAll('ul.ui-autocomplete')].some(u => u.offsetParent !== null && getComputedStyle(u).display !== 'none'),
    visible: [...document.querySelectorAll('.mmthf-pin')].filter(el => getComputedStyle(el).opacity !== '0' && getComputedStyle(el).pointerEvents !== 'none').length,
    total: document.querySelectorAll('.mmthf-pin').length,
  }));
  const before = await state();
  check(before.visible > 0, `pins show before (${before.visible}/${before.total})`);

  await page.click('input#label-0');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Strut', { delay: 30 });
  await page.waitForFunction(() => [...document.querySelectorAll('ul.ui-autocomplete')].some(u => u.offsetParent !== null && getComputedStyle(u).display !== 'none'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const during = await state();
  check(during.menu, 'the label lookup menu is open');
  check(during.acopen && during.visible === 0 && during.total > 0, `every pin is hidden while it is (${during.visible}/${during.total} visible)`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const after = await state();
  check(!after.acopen && after.visible > 0, `the pins come back when it closes (${after.visible} visible)`);
});
