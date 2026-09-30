// #632 (NicolasPL64): "When opening the cover art, the top player gets in the way." Bandcamp's
// image viewer (.imageviewer_top) stacks at z-index 201 and the bar is fixed at the top far above
// it, so the bar covered the top of the opened cover. The viewer now shows over the bar.
import { test, check, until, idle } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://phoebebridgers.bandcamp.com/album/punisher';
// Bandcamp's own viewer throws this when it closes, with or without the script
test.use({ profile: 'fresh', gm: { name: 'Bandcamp Player Enhanced' }, pageErrors: ["Cannot read properties of undefined \\(reading 'style'\\)"] });

test('an opened cover shows over the bar', { tag: ['@cosmetic', '@web'] }, async ({ page, inject }) => {
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('bandcamp_player_enhanced');
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });

  // the cover's link, clicked as a script would: Bandcamp's footer overlays it in a small window
  await page.evaluate(() => document.querySelector('#tralbumArt a.popupImage').click());
  const img = await until(() => page.evaluate(() => {
    const i = document.querySelector('.imageviewer_top img.imageviewer_image');
    return i && i.complete && i.naturalWidth ? true : null;
  }), Boolean, { timeout: 15000 });
  check(img, 'the viewer opened with the cover loaded');

  // what is on top at the middle of the bar, where the cover's top edge used to hide
  const hit = await page.evaluate(() => {
    const bar = document.getElementById('bc-sticky-player').getBoundingClientRect();
    const el = document.elementFromPoint(innerWidth / 2, bar.top + bar.height / 2);
    return { inViewer: !!(el && el.closest('.imageviewer_top')), inBar: !!(el && el.closest('#bc-sticky-player')), el: el && (el.tagName + '.' + el.className) };
  });
  check(hit.inViewer && !hit.inBar, `the viewer, not the bar, is on top where the bar is (${hit.el})`);

  // closed again, the bar is back on top
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 900);
  await until(() => page.evaluate(() => !document.querySelector('.imageviewer_top') || getComputedStyle(document.querySelector('.imageviewer_top')).display === 'none'), Boolean, { timeout: 5000 }).catch(() => {});
  const back = await page.evaluate(() => {
    const bar = document.getElementById('bc-sticky-player').getBoundingClientRect();
    const el = document.elementFromPoint(innerWidth / 2, bar.top + bar.height / 2);
    return !!(el && el.closest('#bc-sticky-player'));
  });
  check(back, 'once the viewer is closed, the bar is on top again');
});
