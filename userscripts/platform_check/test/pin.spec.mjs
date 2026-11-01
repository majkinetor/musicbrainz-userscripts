// The docked panel's pin: open with no click, against a side of the screen, moved over by its title, and back there after a reload.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check', persist: true } });

test('a pinned dock panel stays open on the side it was dragged to', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const release = 'b84ee12a-09ef-421b-82de-0441a926375b';
  await openPc(page, inject, { release, settle: false, storage: { 'pc:interface': 'dock' } });
  await page.evaluate(() => { GM_setValue('pc:interface', 'dock'); GM_setValue('pc:dock-pin', true); GM_setValue('pc:dock-side', 'left'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
  await inject('platform_check');
  const win = page.locator('.mbu-dock-win.pc-pinned');
  await win.waitFor({ state: 'visible', timeout: 30000 });
  check(await win.boundingBox().then(b => b.x === 0 && b.y === 0), 'it opens by itself on the saved side');

  await page.keyboard.press('Escape');
  await page.mouse.click(5, 300);
  check(await win.isVisible(), 'Escape and a click outside leave it open');

  const full = () => page.evaluate(() => { const b = document.querySelector('.mbu-dock-win').getBoundingClientRect(); return b.top === 0 && b.bottom <= innerHeight; });
  check(await full(), 'it sits at the top of that side');

  const h = await page.locator('#pc-head h3').boundingBox(), vw = page.viewportSize().width;
  await page.mouse.move(h.x + 5, h.y + 5); await page.mouse.down();
  await page.mouse.move(vw - 100, h.y + 45); await page.mouse.up();
  check(await win.boundingBox().then(b => Math.round(b.x + b.width) === vw && b.y === 0), 'the title drags it to the other side');
  check(await page.evaluate(() => GM_getValue('pc:dock-side')) === 'right', 'the new side is saved');
  check(await full(), 'it stays at the top');
  await page.screenshot({ path: process.env.PIN_SHOT || 'test-results/pin.png' });

  await page.locator('#mb-pin-btn').click();
  check(await page.evaluate(() => GM_getValue('pc:dock-pin')) === false, 'the pin button unpins it');
  await page.mouse.click(5, 300);
  check(!await page.locator('.mbu-dock-win').isVisible(), 'unpinned, a click outside closes it again');
});
