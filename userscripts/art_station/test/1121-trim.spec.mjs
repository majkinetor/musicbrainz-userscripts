// #1121: Trim in the full-screen viewer crops a cover's plain margin. A new cover is
// trimmed in place; a cover with no plain margin is left as it is.
//
// test.musicbrainz.org's cover-art page (read-only; the sandbox asks for a login).
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

// drop a 400×300 white image with a 200×180 dark cover in it, plus some noise and a speck of dust
async function dropBordered(page, bordered) {
  await page.evaluate(async bordered => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = bordered ? '#f4f4f2' : '#c33'; x.fillRect(0, 0, 400, 300);
    if (bordered) {
      for (let i = 0; i < 600; i++) { x.fillStyle = `rgb(${225 + (i * 7) % 30},${225 + (i * 13) % 30},230)`; x.fillRect((i * 37) % 400, (i * 53) % 300, 1, 1); }
      x.fillStyle = '#000'; x.fillRect(5, 5, 1, 1);
      x.fillStyle = '#334'; x.fillRect(100, 50, 200, 180);
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'front.jpg', { type: 'image/jpeg' }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, bordered);
  return until(() => page.evaluate(() => (document.querySelector('.as-card.new .as-dim-px') || {}).textContent || ''), t => /\d+ × \d+/.test(t));
}
const px = page => page.evaluate(() => (document.querySelector('.as-card.new .as-dim-px') || {}).textContent || '');
const counts = page => page.evaluate(() => ({ neu: document.querySelectorAll('.as-card.new').length, del: document.querySelectorAll('.as-card.del').length }));
async function trim(page) {
  await page.click('.as-card.new .as-thumb');
  await until(() => page.evaluate(() => !!document.querySelector('.as-lb-trim')), v => v, { timeout: 10000 });
  await page.click('.as-lb-trim');
}

test.describe('trim margins in the viewer (#1121)', () => {
  test.use({ gm: { name: 'Art Station', values: {} } });

  test('a new cover with a white margin is cropped to the cover, in place', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject);
    check(await dropBordered(page, true) === '400 × 300', 'dropped 400×300');
    await trim(page);
    const p = await until(() => px(page), t => t !== '400 × 300', { timeout: 15000 });
    check(p === '200 × 180', `trimmed to the cover (${p})`);
    const c = await counts(page);
    check(c.neu === 1 && c.del === 0, `stays a single new cover (${JSON.stringify(c)})`);
  });

  test('a cover with no plain margin is left as it is', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject);
    check(await dropBordered(page, false) === '400 × 300', 'dropped 400×300');
    await trim(page);
    await until(() => page.evaluate(() => /No plain margin/.test(document.body.innerText)), Boolean, { timeout: 15000 });
    check(await px(page) === '400 × 300', 'the size is unchanged');
  });
});
