// #781 the Cover Art Archive takes only JPEG / PNG / GIF / PDF, so a WebP is converted
// while it's staged: lossy WebP → JPEG, lossless or transparent WebP → PNG.
//   1. @unit  webpIsLossy reads the RIFF chunks right (VP8, VP8L, VP8X alpha flag, ALPH)
//   2. sandbox: dropped WebPs (opaque lossy, transparent) are staged as JPEG / PNG, and a
//      non-image or undecodable file is skipped
//
// test.musicbrainz.org's cover-art page: nothing is uploaded or submitted (writes are counted).
import { test, check, until, loadFunctions } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

const withSettings = stored => ({ gm: { name: 'Art Station', values: { 'artstation:settings': JSON.stringify(stored) } } });

// a RIFF/WEBP header followed by the given chunks ([fourcc, payload bytes])
function webp(chunks) {
  const body = [];
  for (const [t, data] of chunks) {
    const n = data.length;
    body.push(...[...t].map(c => c.charCodeAt(0)), n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24, ...data);
    if (n & 1) body.push(0);
  }
  const size = body.length + 4;
  return new Uint8Array([...'RIFF'].map(c => c.charCodeAt(0)).concat([size & 255, (size >> 8) & 255, (size >> 16) & 255, size >>> 24], [...'WEBP'].map(c => c.charCodeAt(0)), body));
}

test('WebP header: lossy vs lossless / transparent', { tag: ['@unit'] }, async () => {
  const { webpIsLossy } = await loadFunctions('art_station', ['webpIsLossy']);
  const z = n => new Array(n).fill(0);
  check(webpIsLossy(webp([['VP8 ', z(10)]])) === true, 'simple lossy (VP8) → lossy');
  check(webpIsLossy(webp([['VP8L', z(5)]])) === false, 'simple lossless (VP8L) → not lossy');
  check(webpIsLossy(webp([['VP8X', [0x00, ...z(9)]], ['ICCP', z(7)], ['VP8 ', z(10)]])) === true, 'extended, no alpha, ICC profile (odd size, padded) then VP8 → lossy');
  check(webpIsLossy(webp([['VP8X', [0x10, ...z(9)]], ['ALPH', z(4)], ['VP8 ', z(10)]])) === false, 'extended with alpha → not lossy (keep alpha as PNG)');
  check(webpIsLossy(webp([['VP8X', [0x00, ...z(9)]], ['VP8L', z(5)]])) === false, 'extended lossless (VP8L inside VP8X) → not lossy');
  check(webpIsLossy(new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...z(20)])) === false, 'not a WebP → not lossy (PNG)');
});

test.describe('dropped WebP', () => {
  test.use(withSettings({ showFileType: true }));
  test('is staged as JPEG / PNG', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    const writes = [];
    page.on('request', r => {
      if (r.method() !== 'POST' && r.method() !== 'PUT') return;
      if (/\/ws\/2\/|archive\.org|\/edit\/|\/ws\/js\/|add-cover-art/i.test(r.url())) writes.push(r.method() + ' ' + r.url());
    });
    await openArtStation(page, inject);
    const made = await page.evaluate(async () => {
      const draw = (w, h, opaque, q) => new Promise(r => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (opaque) { g.fillStyle = '#c33'; g.fillRect(0, 0, w, h); }
        g.fillStyle = '#36c'; g.fillRect(w / 4, h / 4, w / 2, h / 2);
        c.toBlob(r, 'image/webp', q);
      });
      const tag = async b => String.fromCharCode(...new Uint8Array(await b.slice(12, 16).arrayBuffer()));
      const lossy = await draw(320, 300, true, 0.8), clear = await draw(200, 240, false, 0.8);
      const dt = new DataTransfer();
      dt.items.add(new File([lossy], 'front.webp', { type: 'image/webp' }));
      dt.items.add(new File([clear], 'back.webp', { type: 'image/webp' }));
      dt.items.add(new File([new Uint8Array([1, 2, 3, 4])], 'broken.webp', { type: 'image/webp' }));
      window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      return { lossy: await tag(lossy), clear: await tag(clear) };
    });
    console.log('encoded first chunks:', JSON.stringify(made));
    const cards = await until(() => page.evaluate(() => [...document.querySelectorAll('.as-card.new')].map(c => ({
      size: (c.querySelector('.as-dim-sz') || {}).textContent || '', px: (c.querySelector('.as-dim-px') || {}).textContent || '',
      tip: (c.querySelector('.as-thumb') || {}).getAttribute?.('data-tip') || '',   // #793: our own tooltip (data-tip), not title
    }))), cs => cs.length >= 2 && cs.every(c => c.px));
    console.log('staged:', JSON.stringify(cards));
    check(cards.length === 2, `the two decodable WebPs are staged, the broken one skipped (got ${cards.length})`);
    const front = cards.find(c => c.px === '320 × 300'), back = cards.find(c => c.px === '200 × 240');
    check(front && /WEBP→JPEG/.test(front.size) && front.tip === 'front.jpg', `opaque lossy WebP → JPEG front.jpg (${front && front.size} ${front && front.tip})`);
    check(back && /WEBP→PNG/.test(back.size) && back.tip === 'back.png', `transparent WebP → PNG back.png (${back && back.size} ${back && back.tip})`);
    check(writes.length === 0, 'nothing uploaded or submitted: ' + writes.join(', '));
  });
});
