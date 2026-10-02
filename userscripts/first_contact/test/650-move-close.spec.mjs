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
