// majkinetor: "Fusion doesnt remember its size and position in non maximized state".
// Closing removed the window and its ResizeObserver then saved 0×0, and a window opened
// maximized never took its saved normal geometry, so Restore fell back to the default.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', viewport: { width: 1400, height: 900 }, gm: { name: 'Fusion', xhr: 'none' } });

test('size and position survive close, reopen and maximize', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/a07cbaff-aa79-35a9-9932-af7335f306eb', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });

  const box = () => page.evaluate(() => {
    const c = document.getElementById('fs-cons'), r = c.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), max: c.classList.contains('fs-maximized') };
  });
  const tick = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  await page.evaluate(() => window.__fusion.openFusion());
  await page.waitForSelector('#fs-hdr');
  await page.evaluate(() => { const c = document.getElementById('fs-cons'); c.style.width = '900px'; c.style.height = '500px'; });
  await tick();
  // drag the title bar to (120, 80)
  const h = await page.locator('#fs-title, .fs-title').first().boundingBox();
  const b0 = await box();
  await page.mouse.move(h.x + 5, h.y + 5); await page.mouse.down();
  await page.mouse.move(h.x + 5 + (120 - b0.x), h.y + 5 + (80 - b0.y), { steps: 4 }); await page.mouse.up();
  const set = await box();
  console.log('set', JSON.stringify(set));

  await page.evaluate(() => window.__fusion.closeFusion()); await tick();
  await page.evaluate(() => window.__fusion.openFusion()); await page.waitForSelector('#fs-hdr'); await tick();
  const reopened = await box();
  console.log('reopened', JSON.stringify(reopened));
  check(JSON.stringify(reopened) === JSON.stringify(set), 'a closed and reopened window keeps its size and position');

  await page.click('#fs-max'); await tick();
  check((await box()).max, 'maximized');
  await page.evaluate(() => window.__fusion.closeFusion()); await tick();
  await page.evaluate(() => window.__fusion.openFusion()); await page.waitForSelector('#fs-hdr'); await tick();
  check((await box()).max, 'reopens maximized');
  await page.click('#fs-max'); await tick();
  const restored = await box();
  console.log('restored', JSON.stringify(restored));
  check(JSON.stringify(restored) === JSON.stringify(set), 'Restore after reopening maximized returns to the saved size and position');
});
