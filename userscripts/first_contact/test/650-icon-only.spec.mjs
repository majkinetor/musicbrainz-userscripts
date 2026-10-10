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

// majkinetor: "change FC option to show settings on hover and make it to show settings on right
// click of any button". A right-click on any button opens the settings; Hide settings button, use
// right click instead takes ⚙︎ away, and holds across a reload.
test('right-click any button for the settings; ⚙︎ can be hidden', { tag: ['@web'] }, async ({ page, inject }) => {
  const open = async () => {
    await page.goto('https://bullion.bandcamp.com/album/nearly', { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  };
  const gear = page.locator('#fc-root .fc-more'), go = page.locator('#fc-root .fc-go'), panel = page.locator('#fc-panel');
  await open();
  check(await gear.isVisible(), 'by default ⚙︎ shows');
  await go.click({ button: 'right' });
  check(await panel.isVisible(), 'a right-click on Import opens the settings');
  await go.click({ button: 'right' });
  check(!(await panel.isVisible()), 'a second right-click closes them');
  await page.locator('#fc-root .fc-harmony').click({ button: 'right' });
  check(await panel.isVisible(), 'a right-click on Send to Harmony opens them too');
  await page.locator('#fc-panel .fc-gear-hidden-opt').check();
  check(!(await gear.isVisible()), 'Hide settings button: ⚙︎ goes at once');
  await page.keyboard.press('Escape');
  await open();
  check(!(await gear.isVisible()), 'it holds after a reload');
  const r = await page.locator('#fc-root').evaluate(el => [...el.querySelectorAll('button')].filter(b => b.offsetParent).map(b => getComputedStyle(b).borderTopRightRadius));
  check(r[r.length - 1] === '8px', `the last button left takes the round corner (${r})`);
  if (process.env.FC_SHOT) {
    const b = await page.locator('#fc-root').boundingBox();
    await page.screenshot({ path: process.env.FC_SHOT, clip: { x: b.x - 20, y: b.y - 20, width: b.width + 40, height: b.height + 40 } });
  }
  await go.click({ button: 'right' });
  check(await panel.isVisible(), 'with ⚙︎ hidden a right-click still opens the settings');
  await page.locator('#fc-panel .fc-gear-hidden-opt').uncheck();
  check(await gear.isVisible(), 'unticked, ⚙︎ is back');
});
