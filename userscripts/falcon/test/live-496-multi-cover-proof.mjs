// #496 (majkinetor): "Try adding more than 1 cover to the release on test.musicbrainz
// (arbitrary release and covers) and post link to release and log here as proof."
//
// A REAL, unmocked run against test.musicbrainz.org (sanctioned sandbox — see
// reference_test_musicbrainz_instance): only the two arbitrary test-image URLs
// are intercepted (there's nothing to fake there, they're synthetic pixels
// standing in for "some image"); every MB endpoint (sign, upload, add-cover-art
// GET+POST) is hit for real, unintercepted. Falcon's own runCoverItem/
// uploadOneCover is called directly — not wrapped, not stubbed.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const TEST_RELEASE = '3d2edcfc-d823-4e04-abc6-1dca9702af94';   // same test.musicbrainz.org release #495 already submitted real edits to
const TEST_ORIGIN = 'https://test.musicbrainz.org';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const logLines = [];
page.on('console', m => { if (/^\[.*\]/.test(m.text())) logLines.push(m.text()); });

// two small, distinct synthetic PNGs standing in for "some front image" /
// "some booklet image" — intercepted only because there's no real-world image
// to point at for a throwaway sandbox test; nothing MB-side is faked.
function onePxPngBuffer(w, h, r, g, b) {
  const zlib = require('zlib');
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeData), 0);
    return Buffer.concat([len, typeData, crc]);
  }
  function crc32(buf) {
    let c, crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crc = (crc >>> 8) ^ c; }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rowBytes = w * 3 + 1;
  const raw = Buffer.alloc(rowBytes * h);
  for (let y = 0; y < h; y++) { raw[y * rowBytes] = 0; for (let x = 0; x < w; x++) { const o = y * rowBytes + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
await page.route('**/falcon-test-front.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: onePxPngBuffer(300, 300, 200, 40, 40) }));   // red-ish "front"
await page.route('**/falcon-test-booklet.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: onePxPngBuffer(300, 300, 40, 60, 200) })); // blue-ish "booklet"

await page.goto(`${TEST_ORIGIN}/release/${TEST_RELEASE}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN on test.musicbrainz.org'); await ctx.close(); process.exit(3); }
// GM_xmlhttpRequest is undefined in a bare Playwright page — shim it with a
// plain fetch (the two image URLs are same-origin test.musicbrainz.org URLs
// intercepted above; every MB endpoint Falcon itself calls — sign, upload,
// add-cover-art GET/POST — is real, unintercepted, hit over plain fetch()
// from inside the page exactly like the real userscript's own fetch() calls).
await page.evaluate(() => {
  window.GM_xmlhttpRequest = (opts) => {
    fetch(opts.url, { credentials: 'same-origin' }).then(async r => {
      if (!r.ok) return opts.onerror && opts.onerror({ status: r.status });
      const blob = await r.blob();
      opts.onload && opts.onload({ status: r.status, response: blob });
    }).catch(e => opts.onerror && opts.onerror({ status: 0, error: String(e) }));
  };
});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });

console.log('Release under test:', `${TEST_ORIGIN}/release/${TEST_RELEASE}`);
console.log('Starting real 2-cover upload run…\n');

const result = await page.evaluate(async ({ origin, mbid }) => {
  // real item, real cover[] array with 2 entries — the exact thing #496 asked for.
  const item = {
    mbid,
    note: '#496 live proof: multi-cover array + type field',
    cover: [
      { url: origin + '/falcon-test-front.png', comment: 'proof — entry 1', type: 'Front', candidates: [] },
      { url: origin + '/falcon-test-booklet.png', comment: 'proof — entry 2', type: 'Booklet', candidates: [] },
    ],
  };
  await window.__falconTest.runCoverItem(item, '[live-proof]', { querySelector: () => null, dataset: {} });
  return { status: item.status, error: item.error, cover: item.cover };
}, { origin: TEST_ORIGIN, mbid: TEST_RELEASE });

console.log('runCoverItem result:', JSON.stringify(result, null, 1));
console.log('\n── Falcon debug log (this run only) ──');
logLines.forEach(l => console.log(' ', l));

// read the entity BACK via MB's own API — per "faked submits prove nothing",
// this is what actually proves the covers landed, not just that a request left the browser.
await page.waitForTimeout(1500);
const caa = await page.evaluate(async (mbid) => {
  const r = await fetch(`https://coverartarchive.org/release/${mbid}`, { headers: { Accept: 'application/json' } }).catch(() => null);
  if (!r || !r.ok) return null;
  return r.json();
}, TEST_RELEASE);
console.log('\n── Cover Art Archive read-back (proof) ──');
console.log(JSON.stringify(caa, null, 1));

const images = (caa && caa.images) || [];
console.log(`\n${images.length} cover image(s) now on the release (${TEST_ORIGIN}/release/${TEST_RELEASE}):`);
images.forEach(im => console.log(`  - types=${JSON.stringify(im.types)} comment="${im.comment}" front=${im.front}`));

await ctx.close();
process.exit(0);
