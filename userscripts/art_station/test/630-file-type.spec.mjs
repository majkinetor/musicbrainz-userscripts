// #630 (chaban-mb): "When I was upgrading cover art from JPEG to PNG versions I was
// missing the file type in Art Station which native uploader shows."
// majkinetor: "add it like this: `3.2Mb PNG 3000 x 3000` … Put it behind an option and
// make it off by default as people typically do not care."
//
// test.musicbrainz.org's cover-art page (read-only; the sandbox now asks for a login): the release's covers,
// plus a PNG and a JPEG dropped in (staged, never uploaded).
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

const withSettings = stored => ({ gm: { name: 'Art Station', values: stored ? { 'artstation:settings': JSON.stringify(stored) } : {} } });

// real, decodable images drawn in the page, dropped onto the gallery
async function dropImages(page) {
  await page.evaluate(async () => {
    const draw = (w, h, type) => new Promise(r => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').fillRect(0, 0, w, h); c.toBlob(r, type, 0.9); });
    const dt = new DataTransfer();
    dt.items.add(new File([await draw(300, 200, 'image/png')], 'back.png', { type: 'image/png' }));
    dt.items.add(new File([await draw(400, 400, 'image/jpeg')], 'front.jpg', { type: 'image/jpeg' }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  // until both are in and measured (their resolution shows)
  return until(() => page.evaluate(() => [...document.querySelectorAll('.as-card.new')].map(c => ({
    size: (c.querySelector('.as-dim-sz') || {}).textContent || '', px: (c.querySelector('.as-dim-px') || {}).textContent || '',
  }))), cards => cards.length >= 2 && cards.every(c => c.px));
}
const existing = page => page.evaluate(() => [...document.querySelectorAll('.as-card:not(.new)')].map(c => (c.querySelector('.as-dim-sz') || {}).textContent || ''));

test.describe('off by default', () => {
  test.use(withSettings(null));
  test('the size shows without a file type', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject);
    const cards = await dropImages(page);
    check(cards.every(c => /^\d+(\.\d)?[KM]b$/.test(c.size)), `new covers: the size alone (${JSON.stringify(cards)})`);
    const old = await until(() => existing(page), s => s.length && s.every(Boolean), { timeout: 30000 });
    check(old.every(s => !/\b(JPEG|PNG|GIF|WEBP|PDF)\b/.test(s)), `existing covers: no file type (${JSON.stringify(old)})`);
    await page.click('#as-setup-btn');
    check(await page.evaluate(() => document.querySelector('.as-setup-filetype').checked === false), 'the option is there, and off');
  });
});

test.describe('turned on', () => {
  test.use(withSettings({ showFileType: true }));
  test('"3.2Mb PNG", then the resolution', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject);
    const cards = await dropImages(page);
    const png = cards.find(c => / PNG$/.test(c.size)), jpg = cards.find(c => / JPEG$/.test(c.size));
    check(png && /^\d+(\.\d)?[KM]b PNG$/.test(png.size) && png.px === '300 × 200', `a dropped PNG: "${png && png.size}" then "${png && png.px}"`);
    check(jpg && /^\d+(\.\d)?[KM]b JPEG$/.test(jpg.size) && jpg.px === '400 × 400', `a dropped JPEG: "${jpg && jpg.size}" then "${jpg && jpg.px}"`);
    // the release's own covers: from the originals' names on archive.org, or the CAA image URL
    const old = await until(() => existing(page), s => s.length && s.every(t => /[KM]b (JPEG|PNG|GIF|WEBP|PDF)$/.test(t)), { timeout: 30000 });
    check(old.length && old.every(t => /[KM]b (JPEG|PNG|GIF|WEBP|PDF)$/.test(t)), `existing covers show theirs (${JSON.stringify(old)})`);

    // turning it off in the setup panel takes it away at once
    await page.click('#as-setup-btn');
    await page.click('.as-setup-filetype');
    const off = await until(() => page.evaluate(() => [...document.querySelectorAll('.as-card .as-dim-sz')].map(e => e.textContent)), t => t.every(x => !/ (JPEG|PNG|GIF|WEBP|PDF)$/.test(x)));
    check(off.every(x => !/ (JPEG|PNG|GIF|WEBP|PDF)$/.test(x)), `unticked: sizes only (${JSON.stringify(off)})`);
    check(await page.evaluate(() => JSON.parse(GM_getValue('artstation:settings')).showFileType === false), 'and it is remembered');
  });
});
