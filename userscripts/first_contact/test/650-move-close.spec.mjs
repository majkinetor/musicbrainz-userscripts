// #650 (majkinetor): "add option to FC to close the page after import is clicked" and "make FC
// button movable, and it should remember where it is positioned on particular provider".
//
// Fixtures: Bandcamp bullion.bandcamp.com/album/nearly, Deezer album 6575789.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact', persist: 'tabs' }, pageErrors: 'ignore' });   // the platforms' own scripts are not ours

const BC = 'https://bullion.bandcamp.com/album/nearly';
const DZ = 'https://www.deezer.com/en/album/6575789';

test('the button drags anywhere, each platform keeps its own place, Reset puts it back', { tag: ['@web'] }, async ({ page, inject }) => {
  const open = async url => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  };
  const box = () => page.locator('#fc-root').boundingBox();
  const vp = page.viewportSize();

  await open(BC);
  const corner = await box();
  check(vp.width - (corner.x + corner.width) < 40 && vp.height - (corner.y + corner.height) < 80, `starts in the bottom-right corner (${JSON.stringify(corner)})`);
  let pages = 0;
  page.context().on('page', () => pages++);
  const go = page.locator('#fc-root .fc-go');
  const g = await go.boundingBox();
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 20 - 220, g.y + g.height / 2 - 300, { steps: 10 });
  await page.mouse.up();
  const moved = await box();
  check(Math.abs(moved.x - (corner.x - 220)) < 10 && Math.abs(moved.y - (corner.y - 300)) < 10, `follows the drag (${JSON.stringify(corner)} → ${JSON.stringify(moved)})`);
  await page.waitForTimeout(500);
  check(pages === 0, 'the drag is not an import');
  check(await page.locator('#fc-panel').count() === 0, 'nor a settings click');

  await open(BC);
  const again = await box();
  check(Math.abs(again.x - moved.x) < 3 && Math.abs(again.y - moved.y) < 3, `Bandcamp keeps the place after a reload (${JSON.stringify(again)})`);

  await open(DZ);
  const dz = await box();
  check(vp.width - (dz.x + dz.width) < 40 && vp.height - (dz.y + dz.height) < 80, `Deezer still has it in the corner (${JSON.stringify(dz)})`);

  await open(BC);
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-reset-pos').click();
  const reset = await box();
  check(Math.abs(reset.x - corner.x) < 3 && Math.abs(reset.y - corner.y) < 3, `Reset button position: back in the corner (${JSON.stringify(reset)})`);
  await open(BC);
  const after = await box();
  check(Math.abs(after.x - corner.x) < 3 && Math.abs(after.y - corner.y) < 3, 'and it stays there after a reload');
});

test('Close this page after the import: off, the page stays; on, it closes; not when the editor opened here', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(BC, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const run = tab => page.evaluate(async tab => {
    window.open = () => (tab ? {} : null);                          // a tab, or one the browser blocked
    HTMLFormElement.prototype.submit = function () { };             // the seed isn't sent
    window.__fcClosed = false;
    await window.__fcTest.importCurrent();
    return window.__fcClosed;
  }, tab);
  check(await run(true) === false, 'off by default: the page stays');
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-close-after').check();
  await page.keyboard.press('Escape');
  check(await run(true) === true, 'on: the page closes once the editor has the release');
  check(await run(false) === false, 'on, but the editor opened in this tab: nothing to close');
});

// majkinetor: "add option for it to keep its position when scrolling … I put the widget above the
// cover and want to stay there". On, a moved button scrolls with the page; off, it stays on screen.
test('Moved button scrolls with the page: on, it stays over its spot on the page; off, on the screen', { tag: ['@web'] }, async ({ page, inject }) => {
  const open = async () => {
    await page.goto(BC, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  };
  const box = () => page.locator('#fc-root').boundingBox();
  const scrollTo = async y => { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(150); };
  await open();
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-scroll-opt').check();
  await page.keyboard.press('Escape');
  const g = await page.locator('#fc-root .fc-go').boundingBox();
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 20 - 500, 250, { steps: 10 });
  await page.mouse.up();
  const placed = await box();
  check(Math.abs(placed.y + placed.height / 2 - 250) < 10, `dropped where it was let go (${JSON.stringify(placed)})`);
  await scrollTo(400);
  const scrolled = await box();
  const sy = await page.evaluate(() => window.scrollY);
  check(sy > 100 && Math.abs(scrolled.y - (placed.y - sy)) < 3 && Math.abs(scrolled.x - placed.x) < 3, `on: it scrolls with the page (${placed.y} → ${scrolled.y}, scrolled ${sy})`);

  await open();
  await scrollTo(0);
  const reloaded = await box();
  check(Math.abs(reloaded.y - placed.y) < 3 && Math.abs(reloaded.x - placed.x) < 3, `on: the same spot on the page after a reload (${JSON.stringify(reloaded)})`);

  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-scroll-opt').uncheck();
  await page.keyboard.press('Escape');
  await scrollTo(400);
  const fixed = await box();
  check(Math.abs(fixed.y - placed.y) < 3, `off: it stays on the screen while the page scrolls (${placed.y} → ${fixed.y})`);
});

// majkinetor: "make settings more compact and prevent overflow" — with the button dragged near the
// top, the settings ran off the window's left edge and covered the button. Wherever the button
// is, the settings are inside the window and clear of it.
test('the settings stay inside the window and off the button, wherever it was dragged', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(BC, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const vp = page.viewportSize();
  await page.locator('#fc-root .fc-more').click();                      // as in the report: ⚙︎ only on hover,
  await page.locator('#fc-panel .fc-gear-hover-opt').check();           // a tab above the button
  await page.keyboard.press('Escape');
  const spots = { 'top right': [vp.width - 60, 60], 'top left': [60, 60], 'bottom left': [60, vp.height - 30], 'middle': [vp.width / 2, vp.height / 2], 'just below the top': [vp.width - 150, 200] };
  for (const [name, [x, y]] of Object.entries(spots)) {
    const g = await page.locator('#fc-root .fc-go').boundingBox();
    await page.mouse.move(g.x + 10, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
    await page.locator('#fc-root .fc-go').hover();
    await page.locator('#fc-root .fc-more').click();
    const p = await page.locator('#fc-panel').boundingBox(), b = await page.locator('#fc-root').boundingBox();
    const inside = p.x >= 0 && p.y >= 0 && p.x + p.width <= vp.width && p.y + p.height <= vp.height;
    const clear = p.y + p.height <= b.y || p.y >= b.y + b.height || p.x + p.width <= b.x || p.x >= b.x + b.width;
    check(inside, `${name}: inside the window (${JSON.stringify(p)})`);
    check(clear, `${name}: not over the button (panel ${JSON.stringify(p)}, button ${JSON.stringify(b)})`);
    if (process.env.FC_SHOT && name === 'just below the top') await page.screenshot({ path: process.env.FC_SHOT, clip: { x: Math.min(p.x, b.x) - 10, y: Math.min(p.y, b.y) - 10, width: Math.max(p.x + p.width, b.x + b.width) - Math.min(p.x, b.x) + 20, height: Math.max(p.y + p.height, b.y + b.height) - Math.min(p.y, b.y) + 20 } });
    await page.keyboard.press('Escape');
  }
});
