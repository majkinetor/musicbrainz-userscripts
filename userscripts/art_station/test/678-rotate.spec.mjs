// #678: rotate a cover in the full-screen viewer and submit it, all in the browser.
// A newly-added (not-yet-submitted) cover rotates IN PLACE — its staged blob is
// swapped for the rotated one, dimensions transpose, and it stays a single new
// cover (no replace). An existing published cover can't be changed on the archive,
// so rotating it stages the rotated copy as a NEW cover and marks the original for
// removal (an add + a remove on Enter edit).
//
// test.musicbrainz.org's cover-art page (read-only; the sandbox asks for a login).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

// a real, decodable PNG (the script's own icon) to stand in for the archive original
const ICON_PNG = readFileSync(fileURLToPath(new URL('../icon.png', import.meta.url)));

// drop one real, decodable non-square image and wait until it's staged + measured
async function dropOne(page) {
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 200;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#c33'; ctx.fillRect(0, 0, 300, 200);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'front.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  return until(() => page.evaluate(() => (document.querySelector('.as-card.new .as-dim-px') || {}).textContent || ''), t => /\d+ × \d+/.test(t));
}
const newPx = () => '.as-card.new .as-dim-px';
const counts = page => page.evaluate(() => ({
  neu: document.querySelectorAll('.as-card.new').length,
  del: document.querySelectorAll('.as-card.del').length,
}));

test.describe('rotate in the viewer (#678)', () => {
  test.use({ gm: { name: 'Art Station', values: {} } });

  test('a new cover rotates in place — dimensions transpose, still one new cover', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject);
    const px0 = await dropOne(page);
    check(px0 === '300 × 200', `dropped 300×200 (${px0})`);

    // open it full-screen and rotate 90° clockwise
    await page.click('.as-card.new .as-thumb');
    await until(() => page.evaluate(() => !!document.querySelector('.as-lb-rot[data-deg="90"]')), v => v, { timeout: 10000 });
    await page.click('.as-lb-rot[data-deg="90"]');

    const px1 = await until(() => page.evaluate(() => (document.querySelector('.as-card.new .as-dim-px') || {}).textContent || ''), t => /\d+ × \d+/.test(t) && t !== '300 × 200', { timeout: 15000 });
    check(px1 === '200 × 300', `after rotate CW the dimensions transpose (${px1})`);
    // in place: exactly one new cover, nothing marked for removal
    const c = await counts(page);
    check(c.neu === 1 && c.del === 0, `stays a single new cover, no removal (${JSON.stringify(c)})`);
    // rotating back restores the original orientation
    await page.click('.as-lb-rot[data-deg="-90"]');
    const px2 = await until(() => page.evaluate(() => (document.querySelector('.as-card.new .as-dim-px') || {}).textContent || ''), t => t === '300 × 200', { timeout: 15000 });
    check(px2 === '300 × 200', `rotate left returns to 300×200 (${px2})`);
  });

  test('an existing cover is replaced — rotated copy staged, original marked for removal', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject);
    const before = await counts(page);
    // the release must have at least one published cover to rotate
    const hasExisting = await page.evaluate(() => !!document.querySelector('.as-card:not(.new) .as-thumb'));
    check(hasExisting, 'the sandbox release has an existing cover to rotate');

    // On production, CoverArtArchive serves the original with CORS (what Download already
    // relies on); the sandbox's beta archive doesn't, so serve the rotate's fetch a real
    // image. This keeps the test about the staging/replace logic, not the archive's CORS.
    await page.route(u => /coverartarchive\.org$/.test(u.hostname) && /\.(jpg|jpeg|png|gif)(\?|$)/i.test(u.pathname),
      r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: ICON_PNG }));

    await page.click('.as-card:not(.new) .as-thumb');
    await until(() => page.evaluate(() => !!document.querySelector('.as-lb-rot[data-deg="90"]')), v => v, { timeout: 10000 });
    await page.click('.as-lb-rot[data-deg="90"]');

    // the rotated copy is staged as a NEW cover and the original is marked removed
    const after = await until(() => counts(page), c => c.neu >= before.neu + 1 && c.del >= 1, { timeout: 30000 });
    check(after.neu === before.neu + 1, `one rotated copy staged (${JSON.stringify(after)})`);
    check(after.del >= 1, `the original is marked for removal (${JSON.stringify(after)})`);
  });
});
