// Thumbnail size is four preset buttons (S/M/L/XL); a click jumps to a preset, the wheel
// over any of them still resizes in fine 25px notches (majkinetor, 2026-10-25).
//
// test.musicbrainz.org, read-only.
import { test, check, attachShot, frames } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('thumbnail size: presets on click, fine steps on the wheel', { tag: ['@sandbox', '@web'] }, async ({ page, inject }, testInfo) => {
  await openArtStation(page, inject);
  const state = () => page.evaluate(() => ({
    tile: getComputedStyle(document.documentElement).getPropertyValue('--as-tile').trim(),
    on: [...document.querySelectorAll('#as-root .as-size button')].findIndex(b => b.classList.contains('on')),
    n: document.querySelectorAll('#as-root .as-size button').length,
  }));
  check((await state()).n === 4, 'four size buttons');

  await page.locator('#as-root .as-size button').nth(3).click(); await frames(page);
  let s = await state();
  check(s.tile === '330px' && s.on === 3, `XL click → 330px, XL on (${JSON.stringify(s)})`);

  await page.locator('#as-root .as-size button').nth(0).hover();
  await page.mouse.wheel(0, 100); await frames(page);
  s = await state();
  check(s.tile === '305px' && s.on === 3, `wheel down → 305px, XL still nearest (${JSON.stringify(s)})`);

  await page.locator('#as-root .as-size button').nth(1).click(); await frames(page);
  s = await state();
  check(s.tile === '200px' && s.on === 1, `M click → 200px (${JSON.stringify(s)})`);
  await attachShot(testInfo, page.locator('#as-root .as-size'), 'size buttons');
});
