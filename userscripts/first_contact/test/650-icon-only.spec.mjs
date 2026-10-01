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
