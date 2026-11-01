// The docked panel's pin: open with no click, moved by its title, and back there after a reload.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check', persist: true } });

test('a pinned dock panel stays open where it was dragged', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const release = 'b84ee12a-09ef-421b-82de-0441a926375b';
  await openPc(page, inject, { release, settle: false, storage: { 'pc:interface': 'dock' } });
  await page.evaluate(() => { GM_setValue('pc:interface', 'dock'); GM_setValue('pc:dock-pin', true); GM_setValue('pc:dock-pos', { x: 100, y: 120 }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
  await inject('platform_check');
  const win = page.locator('.mbu-dock-win.pc-pinned');
  await win.waitFor({ state: 'visible', timeout: 30000 });
  check(await win.boundingBox().then(b => b.x === 100 && b.y === 120), 'it opens by itself at the saved spot');

  await page.keyboard.press('Escape');
  await page.mouse.click(5, 300);
  check(await win.isVisible(), 'Escape and a click outside leave it open');

  const h = await page.locator('#pc-head h3').boundingBox();
  await page.mouse.move(h.x + 5, h.y + 5); await page.mouse.down();
  await page.mouse.move(h.x + 65, h.y + 45); await page.mouse.up();
  check(await win.boundingBox().then(b => b.x === 160 && b.y === 160), 'the title drags it');
  check(await page.evaluate(() => GM_getValue('pc:dock-pos').x === 160), 'the new spot is saved');
  await page.screenshot({ path: process.env.PIN_SHOT || 'test-results/pin.png' });

  await page.evaluate(() => { GM_setValue('pc:dock-pos', { x: 160, y: 5000 }); window.dispatchEvent(new Event('resize')); });
  check(await page.evaluate(() => { const w = document.querySelector('.mbu-dock-win'), b = w.getBoundingClientRect(); return w.scrollHeight <= w.clientHeight && b.bottom <= innerHeight; }), 'near the bottom it moves up, with no scrollbars');

  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'pc-grow'; d.style.height = '150px'; document.querySelector('.mbu-dock-win').firstElementChild.append(d); });
  await page.waitForTimeout(200);
  check(await page.evaluate(() => { const w = document.querySelector('.mbu-dock-win'), b = w.getBoundingClientRect(); return w.scrollHeight <= w.clientHeight && b.bottom <= innerHeight; }), 'when it grows it moves up, with no scrollbars');
  await page.evaluate(() => document.getElementById('pc-grow').remove());

  await page.locator('#mb-pin-btn').click();
  check(await page.evaluate(() => GM_getValue('pc:dock-pin')) === false, 'the pin button unpins it');
  await page.mouse.click(5, 300);
  check(!await page.locator('.mbu-dock-win').isVisible(), 'unpinned, a click outside closes it again');
});
