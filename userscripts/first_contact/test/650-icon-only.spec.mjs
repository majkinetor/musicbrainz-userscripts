// #650 (majkinetor): "Add option to FC to hide text 'Import to MB'". ⚙︎ → Icon only: the button
// keeps its ship, the text goes, the tooltip says what it does; it holds across a reload.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact', persist: 'tabs' }, pageErrors: 'ignore' });   // bandcamp.com's own scripts are not ours

test('Icon only: the button loses its text, keeps its tooltip, and stays that way', { tag: ['@web'] }, async ({ page, inject }) => {
  const url = 'https://bullion.bandcamp.com/album/nearly';
  const open = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  };
  const look = () => page.evaluate(() => {
    const go = document.querySelector('#fc-root .fc-go'), span = go.querySelector('span');
    return { text: getComputedStyle(span).display !== 'none', width: Math.round(go.getBoundingClientRect().width), title: go.title, icon: !!go.querySelector('svg') };
  });
  await open();
  const before = await look();
  check(before.text && before.icon, `by default: icon and text (${JSON.stringify(before)})`);
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-iconly-opt').check();
  const after = await look();
  check(!after.text && after.icon && after.width < before.width / 2, `Icon only: the text goes at once, the button narrows (${before.width} → ${after.width})`);
  check(/^Import to MusicBrainz/.test(after.title), `the tooltip says what it does (${after.title})`);
  await open();
  const again = await look();
  check(!again.text, 'it holds after a reload');
});

// majkinetor: "add option to show config button only on hover". ⚙︎ hides; hovering the button
// shows it as a tab on the edge, without moving Import; it holds across a reload.
test('Settings button only on hover: ⚙︎ hides until hover, Import stays put', { tag: ['@web'] }, async ({ page, inject }) => {
  const open = async () => {
    await page.goto('https://bullion.bandcamp.com/album/nearly', { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  };
  const gear = page.locator('#fc-root .fc-more'), go = page.locator('#fc-root .fc-go');
  await open();
  check(await gear.isVisible(), 'by default ⚙︎ shows');
  await gear.click();
  await page.locator('#fc-panel .fc-gear-hover-opt').check();
  check(await gear.isVisible(), 'it stays while the settings are open');
  await page.keyboard.press('Escape');
  await page.mouse.move(10, 10);
  check(!(await gear.isVisible()), 'hidden once the pointer leaves');
  const before = await go.boundingBox();
  await go.hover();
  check(await gear.isVisible(), 'shown on hover');
  const after = await go.boundingBox();
  check(Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, 'Import does not move when ⚙︎ shows');
  if (process.env.FC_SHOT) {
    const r = await page.locator('#fc-root').boundingBox();
    await page.screenshot({ path: process.env.FC_SHOT, clip: { x: r.x - 20, y: r.y - 40, width: r.width + 40, height: r.height + 60 } });
  }
  const g = await gear.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 5 });
  await gear.click();
  check(await page.locator('#fc-panel').isVisible(), 'the pointer reaches ⚙︎ and it opens the settings');
  await page.keyboard.press('Escape');
  await open();
  await page.mouse.move(10, 10);
  check(!(await gear.isVisible()), 'it holds after a reload');
});
