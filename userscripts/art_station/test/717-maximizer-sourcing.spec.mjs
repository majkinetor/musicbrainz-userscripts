// #717 (majkinetor): "I don't like the fact that AS depends on third party url maximizer" ·
// "Drop ECAU. Make Image maximizer as single self contained class". Sourcing from a store
// page or an image URL goes through the shared ImageMaximizer, with no hidden uploader
// iframe and no other script: the largest version is staged, and the edit note says
// what the store offered. Seeding links (x_seed, from Harmony and others) on the add page
// are read by Art Station itself.
//
// test.musicbrainz.org; the stores are answered by answerGm (the script's requests go
// through GM_xmlhttpRequest), so no store is asked and nothing is uploaded.
import { test, check, until, answerGm } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const PAGE = 'https://maximizer-test.bandcamp.com/album/x';
const SMALL = 'https://f4.bcbits.com/img/a4242_5.jpg', BIG = 'https://f4.bcbits.com/img/a4242_0.jpg';

// real JPEGs (the gallery decodes and measures them), drawn in the browser
async function jpegs(page, sizes) {
  const out = {};
  for (const n of sizes) {
    const b64 = await page.evaluate(n => new Promise(ok => {
      const c = document.createElement('canvas'); c.width = c.height = n;
      const g = c.getContext('2d'); g.fillStyle = '#4e329f'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff'; g.fillRect(n / 4, n / 4, n / 2, n / 2);
      c.toBlob(b => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(b); }, 'image/jpeg', 0.8);
    }), n);
    out[n] = Buffer.from(b64, 'base64');
  }
  return out;
}

function store(context, img, asked) {
  answerGm(context, ({ url }) => {
    if (!/bandcamp\.com|bcbits\.com|deezer\.com|example\.org/.test(url)) return null;
    asked.push(url);
    if (url === PAGE) return { status: 200, headers: 'content-type: text/html', body: `<html><head><meta property="og:image" content="${SMALL}"></head></html>` };
    if (url === BIG) return { status: 200, headers: 'content-type: image/jpeg', body: img[1400] };
    if (url === 'https://example.org/back.jpg') return { status: 200, headers: 'content-type: image/jpeg', body: img[900] };
    if (url === 'https://api.deezer.com/album/999') return { status: 200, headers: 'content-type: application/json', body: '{"error":{"type":"DataException","message":"no data"}}' };
    return { status: 404, headers: 'content-type: text/plain', body: 'not here' };
  });
}

test('#717 a store page is sourced through the maximizer: its largest image, with provenance', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, context, inject }) => {
  await page.goto('about:blank');
  const img = await jpegs(page, [1400, 900]);
  const asked = [];
  store(context, img, asked);
  await openArtStation(page, inject);

  await page.evaluate(url => window.ArtStation.addImageUrl(url), PAGE);
  const st = await until(() => page.evaluate(() => window.__asTest.staged()), s => s.length === 1 && s[0].w > 0);
  const c = st[0] || {};
  check(c.provImageUrl === BIG, `the original (_0) is staged, not the page's _5 (${c.provImageUrl})`);
  check(c.w === 1400 && c.h === 1400, `at its full size (${c.w}×${c.h})`);
  check(c.provUrl === PAGE && c.provMaxFrom === SMALL, `the page and the image it offered are kept (${c.provUrl}, ${c.provMaxFrom})`);
  check(c.provider === 'Bandcamp' && JSON.stringify(c.types) === '["Front"]', `named Bandcamp, typed Front (${c.provider}, ${JSON.stringify(c.types)})`);
  check(/^Cover art sourced from Bandcamp — https:\/\/maximizer-test\.bandcamp\.com\/album\/x\nImage: https:\/\/f4\.bcbits\.com\/img\/a4242_0\.jpg\nMaximised from: https:\/\/f4\.bcbits\.com\/img\/a4242_5\.jpg$/.test(c.note), `the edit note says where it came from and what it was maximised from: ${JSON.stringify(c.note)}`);
  check(asked[0] === PAGE && asked.includes(BIG), `the store was asked for the page, then the original (${asked.join(', ')})`);
  check(await page.evaluate(() => !document.querySelector('iframe[src*="x_seed"], iframe[src*="add-cover-art"]')), 'no hidden uploader page was loaded');

  // a store that answers with an error says so, and stages nothing
  await page.evaluate(() => window.ArtStation.addImageUrl('https://www.deezer.com/album/999'));
  const toast = await until(() => page.evaluate(() => [...document.querySelectorAll('#mbu-toast')].map(t => t.textContent).join(' | ')), t => /no data/.test(t));
  check(/Deezer: no data/.test(toast), `the store's own message shows (${JSON.stringify(toast)})`);
  check(await until(() => page.evaluate(() => !document.querySelector('.as-srcing-lbl'))), 'and its sourcing slot is gone');
  check((await page.evaluate(() => window.__asTest.staged())).length === 1, 'nothing more was staged');
});

test('#717 seeding links on the add page are sourced by Art Station, with their types and comment', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  await page.goto('about:blank');
  const img = await jpegs(page, [1400, 900]);
  const asked = [];
  store(context, img, asked);
  const q = new URLSearchParams({
    'x_seed.image.0.url': PAGE,
    'x_seed.image.1.url': 'https://example.org/back.jpg', 'x_seed.image.1.types': '2', 'x_seed.image.1.comment': 'from the seed',
    'x_seed.origin': 'https://harmony.pulsewidth.org.uk/release?x=1',
  });
  await openArtStation(page, inject, { path: 'add-cover-art?' + q });
  const st = await until(() => page.evaluate(() => window.__asTest.staged()), s => s.length === 2);
  const front = st.find(x => x.provImageUrl === BIG), back = st.find(x => x.provImageUrl === 'https://example.org/back.jpg');
  check(!!front && JSON.stringify(front.types) === '["Front"]', `the store page's cover is staged, maximised, typed by the store (${front && front.provImageUrl})`);
  check(!!back && JSON.stringify(back.types) === '["Back"]' && back.comment === 'from the seed', `the image URL keeps the seed's type (id 2 = Back) and comment (${back && JSON.stringify(back.types)}, ${back && back.comment})`);
  check(st[0].seedNote === 'Seeded from https://harmony.pulsewidth.org.uk/release?x=1', `the commit note names where the link came from (${JSON.stringify(st[0].seedNote)})`);
});
