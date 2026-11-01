// The docked panel's pin: open with no click, against a side of the screen, moved over by its title, and back there after a reload.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check', persist: true } });

test('a pinned dock panel stays open where it was dragged', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const release = 'b84ee12a-09ef-421b-82de-0441a926375b';
  await openPc(page, inject, { release, settle: false, storage: { 'pc:interface': 'dock' } });
  await page.evaluate(() => { GM_setValue('pc:interface', 'dock'); GM_setValue('pc:dock-pin', true); GM_setValue('pc:dock-h', { edge: 'left', gap: 0 }); GM_setValue('pc:dock-v', { edge: 'top', gap: 0 }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
  await inject('platform_check');
  const win = page.locator('.mbu-dock-win.pc-pinned');
  await win.waitFor({ state: 'visible', timeout: 30000 });
  check(await win.boundingBox().then(b => b.x === 0 && b.y === 0), 'it opens by itself on the saved side');

  await page.keyboard.press('Escape');
  await page.mouse.click(5, 300);
  check(await win.isVisible(), 'Escape and a click outside leave it open');

  const box = () => page.evaluate(() => { const b = document.querySelector('.mbu-dock-win').getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
  const grow = () => page.evaluate(() => { const d = document.createElement('div'); d.style.height = '100px'; document.querySelector('.mbu-dock-win').firstElementChild.append(d); });

  const h = await page.locator('#pc-head h3').boundingBox(), vw = page.viewportSize().width, vh = page.viewportSize().height;
  await page.mouse.move(h.x + 5, h.y + 5); await page.mouse.down();
  await page.mouse.move(vw - 100, h.y + 45); await page.mouse.up();
  check(await win.boundingBox().then(b => Math.round(b.x + b.width) === vw && b.y === 40), 'the title drags it to the other side and down');
  check(await page.evaluate(() => GM_getValue('pc:dock-h').edge) === 'right', 'the nearer side is saved');
  const near = await box();
  await grow(); await page.waitForTimeout(100);
  const grown = await box();
  check(grown.top === near.top && grown.bottom > near.bottom, 'near the top, it keeps its top and grows down');

  const h2 = await page.locator('#pc-head h3').boundingBox();
  await page.mouse.move(h2.x + 5, h2.y + 5); await page.mouse.down();
  await page.mouse.move(h2.x + 5, vh - 200); await page.mouse.up();
  check(await page.evaluate(() => GM_getValue('pc:dock-v').edge) === 'bottom', 'near the bottom, it holds its bottom');
  const low = await box();
  await grow(); await page.waitForTimeout(100);
  const up = await box();
  check(up.bottom === low.bottom && up.top < low.top, 'and grows up');
  const h3 = await page.locator('#pc-head h3').boundingBox();
  await page.mouse.move(h3.x + 5, h3.y + 5); await page.mouse.down();
  await page.mouse.move(h3.x - 55, h3.y + 5); await page.mouse.up();
  check(await win.boundingBox().then(b => Math.round(b.x + b.width) === vw - 60), 'it stops anywhere, not only at a side');
  await page.screenshot({ path: process.env.PIN_SHOT || 'test-results/pin.png' });

  await page.evaluate(() => document.documentElement.setAttribute('data-mbu-dock', ''));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.mbu-dock-win')).visibility === 'hidden');
  check(await page.locator('.mbu-dock-win').evaluate(w => !w.hidden), 'on a page of Event Horizon that is no release, it hides, still pinned');
  await page.evaluate(r => document.documentElement.setAttribute('data-mbu-release', r), release);
  await win.waitFor({ state: 'visible' });
  await page.evaluate(() => { document.documentElement.removeAttribute('data-mbu-dock'); document.documentElement.removeAttribute('data-mbu-release'); });
  await page.waitForTimeout(300);
  check(await win.isVisible(), 'it is back on a release, and stays there with Event Horizon off');

  const pick = async mode => { await page.locator('#mb-pin-btn').click(); await page.locator(`#pc-pos-menu [data-mode="${mode}"]`).click(); };
  check(await page.locator('.mbu-dock-win').getAttribute('data-pc-mode') === 'ghost', 'an old pin comes back as Pin transparent');
  await pick('pin');
  check(await page.locator('.mbu-dock-win').getAttribute('data-pc-mode') === 'pin', 'the menu switches to a plain pin');
  await pick('pin');
  check(await page.evaluate(() => GM_getValue('pc:dock-mode')) === '', 'picking the ticked one turns it off');
  await page.mouse.click(5, 300);
  check(!await page.locator('.mbu-dock-win').isVisible(), 'unpinned, a click outside closes it again');

  await page.evaluate(() => GM_setValue('pc:dock-mode', 'hover'));
  const dock = page.locator('#mb-pc-dock'), panel = page.locator('.mbu-dock-win');
  await dock.hover();
  await panel.waitFor({ state: 'visible' });
  check(!await page.locator('#mbu-tip.mbu-tip-card').isVisible(), 'dock hover opens the panel in place of the tooltip');
  await panel.locator('#pc-head h3').hover();
  await page.waitForTimeout(500);
  check(await panel.isVisible(), 'it stays while the mouse is on it');
  const p = await panel.boundingBox();
  await page.mouse.move(p.x - 25, p.y + p.height / 2);
  await page.waitForTimeout(500);
  check(await panel.isVisible(), 'and just outside its border');
  await page.mouse.move(5, 300);
  await page.waitForTimeout(2000);
  check(await panel.isVisible() && !await panel.evaluate(w => w.classList.contains('pc-fading')), 'away from it, it waits');
  await panel.locator('#pc-head h3').hover();
  await page.waitForTimeout(2000);
  check(await panel.isVisible() && !await panel.evaluate(w => w.classList.contains('pc-fading')), 'coming back starts the wait over');
  await page.mouse.move(5, 300);
  await page.waitForFunction(() => document.querySelector('.mbu-dock-win').classList.contains('pc-fading'));
  check(await panel.isVisible(), 'then it fades, still there');
  await panel.waitFor({ state: 'hidden' });
});
