// The shared image maximizer (#717), in Node with the network stubbed: every URL rule on
// real sample URLs, every resolver on the answers its store gives (trimmed to what it reads),
// and the download loop (a candidate that fails falls through to the next).
//
// The rules and resolvers were measured on the live stores on 2026-10-11; IMGMAX_LIVE=1
// runs the last spec against them again, to catch a store that changed.
import { test, check } from '../test/harness.mjs';
import ImageMaximizer from './image-maximizer.js';

test.use({ gm: false });

// a tiny JPEG header carrying its size (enough for ImageMaximizer.dimensions)
function jpeg(w, h) {
  const b = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xFF, 0xD9]);
  return new Blob([b], { type: 'image/jpeg' });
}
// a stub request: answers[url] = { status?, text? | json? | image: [w, h] }, the rest 404
function stub(answers, seen = []) {
  return async (url, o) => {
    seen.push(url);
    const a = answers[url];
    if (!a) return { status: 404, url, contentType: 'text/plain', text: 'nope', blob: new Blob(['nope']) };
    if (a.image) return { status: 200, url, contentType: 'image/jpeg', blob: jpeg(...a.image), text: '' };
    const text = a.json !== undefined ? JSON.stringify(a.json) : (a.text || '');
    return { status: a.status || 200, url, contentType: a.json !== undefined ? 'application/json' : 'text/html', text, blob: new Blob([text]) };
  };
}

test('URL rules: each CDN gives its bigger versions, largest first, the URL itself last', { tag: ['@unit'] }, async () => {
  const m = new ImageMaximizer();
  const cases = [
    ['https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/100x100bb.jpg',
      'https://a1.mzstatic.com/us/r1000/0/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg'],
    ['https://cdn-images.dzcdn.net/images/cover/311bba0fc112d15f72c8b5a65f0456c1/1000x1000-000000-80-0-0.jpg',
      'https://cdn-images.dzcdn.net/images/cover/311bba0fc112d15f72c8b5a65f0456c1/4000x0-000000-100-0-0.jpg'],
    ['https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e029b9b36b0e22870b9f542d937', 'https://i.scdn.co/image/ab67616d000082c19b9b36b0e22870b9f542d937'],
    ['https://f4.bcbits.com/img/a3185643660_5.jpg', 'https://f4.bcbits.com/img/a3185643660_0.jpg'],
    ['https://resources.tidal.com/images/b66a5c40/c34d/4507/a0dc/5f98e46fdd20/640x640.jpg', 'https://resources.tidal.com/images/b66a5c40/c34d/4507/a0dc/5f98e46fdd20/origin.jpg'],
    ['https://static.qobuz.com/images/covers/87/70/0886443927087_600.jpg', 'https://static.qobuz.com/images/covers/87/70/0886443927087_org.jpg'],
    ['https://geo-media.beatport.com/image_size/1400x1400/2d4f0a8c-f99a-4d0b-a41a-8c18a07c0511.jpg', 'https://geo-media.beatport.com/image_size/0x0/2d4f0a8c-f99a-4d0b-a41a-8c18a07c0511.jpg'],
    ['https://m.media-amazon.com/images/I/61hdaAw2s5L._SL1500_.jpg', 'https://m.media-amazon.com/images/I/61hdaAw2s5L.jpg'],
    ['https://artwork-cdn.7static.com/static/img/sleeveart/00/123/456/0012345678_350.jpg', 'https://artwork-cdn.7static.com/static/img/sleeveart/00/123/456/0012345678_800.jpg'],
    ['https://imagescdn.juno.co.uk/300/CS1234567-01A-MED.jpg', 'https://imagescdn.juno.co.uk/full/CS1234567-01A-BIG.jpg'],
    ['https://thumb-media.vgm.io/albums/97/79/79-1264618929.jpg', 'https://media.vgm.io/albums/97/79/79-1264618929.jpg'],
    ['https://lh3.googleusercontent.com/abc123=w544-h544-l90-rj', 'https://lh3.googleusercontent.com/abc123=s0'],
    ['https://i1.sndcdn.com/artworks-000123-abcdef-t500x500.jpg', 'https://i1.sndcdn.com/artworks-000123-abcdef-original.jpg'],
    ['https://coverartarchive.org/release/00000000-0000-0000-0000-000000000000/123456-500.jpg', 'https://coverartarchive.org/release/00000000-0000-0000-0000-000000000000/123456.jpg'],
  ];
  for (const [small, big] of cases) {
    const c = m.candidates(small);
    check(c[0] === big, `${new URL(small).hostname}: first candidate is ${big} (got ${c[0]})`);
    check(c[c.length - 1] === small, `${new URL(small).hostname}: the URL itself is the last resort`);
    check(new Set(c).size === c.length, `${new URL(small).hostname}: no candidate twice`);
  }
  check(JSON.stringify(m.candidates('https://example.com/x.jpg')) === '["https://example.com/x.jpg"]', 'an unknown host keeps the URL as it is');
  check(JSON.stringify(m.candidates('not a url')) === '["not a url"]', 'a non-URL comes back unchanged, no throw');
});

test('resolvers: each store page gives its cover, maximised and downloaded', { tag: ['@unit'] }, async () => {
  const A = 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/bb/cc/aabbccdd-0000-0000-0000-000000000000/cover.jpg/100x100bb.jpg';
  const answers = {
    // Apple: the lookup API
    'https://itunes.apple.com/lookup?id=617154241&country=gb&entity=album': { json: { results: [{ artworkUrl100: A }] } },
    'https://a1.mzstatic.com/us/r1000/0/Music/v4/aa/bb/cc/aabbccdd-0000-0000-0000-000000000000/cover.jpg': { image: [3000, 3000] },
    // Deezer: the public API
    'https://api.deezer.com/album/6575789': { json: { cover_xl: 'https://cdn-images.dzcdn.net/images/cover/311bba0fc112d15f72c8b5a65f0456c1/1000x1000-000000-80-0-0.jpg' } },
    'https://cdn-images.dzcdn.net/images/cover/311bba0fc112d15f72c8b5a65f0456c1/4000x0-000000-100-0-0.jpg': { image: [1200, 1200] },
    // Spotify: oEmbed
    'https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Falbum%2F4m2880jivSbbyEGAKfITCa': { json: { thumbnail_url: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e029b9b36b0e22870b9f542d937' } },
    'https://i.scdn.co/image/ab67616d000082c19b9b36b0e22870b9f542d937': { image: [1500, 1500] },
    // Bandcamp: the page's og:image (this page has no data-tralbum)
    'https://radiohead.bandcamp.com/album/kid-a-mnesia': { text: '<html><head><meta property="og:image" content="https://f4.bcbits.com/img/a3185643660_5.jpg"></head></html>' },
    'https://f4.bcbits.com/img/a3185643660_0.jpg': { image: [1400, 1400] },
    // Tidal: country context, then the album in a country that has it
    'https://listen.tidal.com/v1/country/context?countryCode=WW&locale=en_US&deviceType=BROWSER': { json: { countryCode: 'RS' } },
    'https://api.tidal.com/v1/albums/20115556?countryCode=US': { json: { id: 20115556, cover: 'b66a5c40-c34d-4507-a0dc-5f98e46fdd20' } },
    'https://resources.tidal.com/images/b66a5c40/c34d/4507/a0dc/5f98e46fdd20/origin.jpg': { image: [1417, 1417] },
    // Qobuz: the API (with a booklet) for one album; another falls back to the cover's address
    'https://www.qobuz.com/api.json/0.2/album/get?album_id=abc123xyz&offset=0&limit=20': { json: { image: { large: 'https://static.qobuz.com/images/covers/yz/3x/abc123xyz_600.jpg' }, goodies: [{ name: 'Livret Numérique', original_url: 'https://static.qobuz.com/goodies/1/000123.pdf' }] } },
    'https://static.qobuz.com/images/covers/yz/3x/abc123xyz_org.jpg': { image: [1425, 1425] },
    'https://static.qobuz.com/goodies/1/000123.pdf': { image: [1, 1] },
    'https://static.qobuz.com/images/covers/87/70/0886443927087_org.jpg': { image: [1417, 1417] },
    // Beatport: __NEXT_DATA__
    'https://www.beatport.com/release/rue-de-paris/20267': { text: '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"release":{"id":20267,"image":{"uri":"https://geo-media.beatport.com/image_size/1400x1400/2d4f0a8c.jpg"}}}}}</script>' },
    'https://geo-media.beatport.com/image_size/0x0/2d4f0a8c.jpg': { image: [1400, 1400] },
    // Discogs: the full-size GraphQL refused (Cloudflare), the public API used instead
    'https://api.discogs.com/releases/1': { json: { images: [{ type: 'primary', uri: 'https://i.discogs.com/sig/rs:fit/g:sm/q:90/h:600/w:597/czM6.jpeg' }] } },
    'https://i.discogs.com/sig/rs:fit/g:sm/q:90/h:600/w:597/czM6.jpeg': { image: [597, 600] },
    // VGMdb: the scan gallery, with captions → types
    'https://vgmdb.net/album/79': { text: '<div id="coverart" style="background-image: url(\'https://medium-media.vgm.io/albums/97/79/79-1.jpg\')"></div><div id="cover_gallery"><a id="thumb_1" href="https://media.vgm.io/albums/97/79/79-1.jpg"><div class="label">Front</div></a><a id="thumb_2" href="https://media.vgm.io/albums/97/79/79-2.jpg"><div class="label">Back</div></a><a id="thumb_3" href="https://media.vgm.io/albums/97/79/79-3.jpg"><div class="label">Disc 2</div></a></div></table>' },
    'https://media.vgm.io/albums/97/79/79-1.jpg': { image: [1000, 1000] },
    'https://media.vgm.io/albums/97/79/79-2.jpg': { image: [1000, 1000] },
    'https://media.vgm.io/albums/97/79/79-3.jpg': { image: [800, 800] },
    // any other page: its og:image
    'https://label.example/releases/42': { text: '<meta content="/img/42-front.jpg" property="og:image">' },
    'https://label.example/img/42-front.jpg': { image: [900, 900] },
  };
  const m = new ImageMaximizer({ request: stub(answers) });
  const one = async (url, wantUrl, wantW, wantTypes) => {
    let r; try { r = await m.fetchImages(url); } catch (e) { check(false, `${url}: ${e.message}`); return null; }
    check(r[0].url === wantUrl, `${url} → ${wantUrl} (got ${r[0].url})`);
    check(r[0].width === wantW, `${url}: ${wantW} px wide (got ${r[0].width})`);
    check(r[0].page === url && !!r[0].original, `${url}: the page and the unmaximised URL are kept`);
    if (wantTypes) check(JSON.stringify(r[0].types) === JSON.stringify(wantTypes), `${url}: types ${wantTypes} (got ${r[0].types})`);
    return r;
  };
  await one('https://music.apple.com/gb/album/random-access-memories/617154241', 'https://a1.mzstatic.com/us/r1000/0/Music/v4/aa/bb/cc/aabbccdd-0000-0000-0000-000000000000/cover.jpg', 3000, ['Front']);
  await one('https://www.deezer.com/en/album/6575789', 'https://cdn-images.dzcdn.net/images/cover/311bba0fc112d15f72c8b5a65f0456c1/4000x0-000000-100-0-0.jpg', 1200);
  await one('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', 'https://i.scdn.co/image/ab67616d000082c19b9b36b0e22870b9f542d937', 1500);
  await one('https://radiohead.bandcamp.com/album/kid-a-mnesia', 'https://f4.bcbits.com/img/a3185643660_0.jpg', 1400);
  await one('https://tidal.com/browse/album/20115556', 'https://resources.tidal.com/images/b66a5c40/c34d/4507/a0dc/5f98e46fdd20/origin.jpg', 1417);
  const q = await one('https://open.qobuz.com/album/abc123xyz', 'https://static.qobuz.com/images/covers/yz/3x/abc123xyz_org.jpg', 1425, ['Front']);
  check(q && q.length === 2 && q[1].types[0] === 'Booklet', 'Qobuz: the API\'s digital booklet comes along, typed Booklet');
  await one('https://www.qobuz.com/us-en/album/random-access-memories-daft-punk/0886443927087', 'https://static.qobuz.com/images/covers/87/70/0886443927087_org.jpg', 1417);
  await one('https://www.beatport.com/release/rue-de-paris/20267', 'https://geo-media.beatport.com/image_size/0x0/2d4f0a8c.jpg', 1400, ['Front']);
  await one('https://www.discogs.com/release/1-The-Persuader-Stockholm', 'https://i.discogs.com/sig/rs:fit/g:sm/q:90/h:600/w:597/czM6.jpeg', 597);
  const v = await one('https://vgmdb.net/album/79', 'https://media.vgm.io/albums/97/79/79-1.jpg', 1000, ['Front']);
  check(v && v.length === 3, `VGMdb: the gallery's three scans, the main cover not repeated (got ${v && v.length})`);
  check(v && v[1].types[0] === 'Back' && v[2].types[0] === 'Medium' && v[2].comment === 'Disc 2', 'VGMdb: captions become types, the caption stays as the comment where it says more');
  await one('https://label.example/releases/42', 'https://label.example/img/42-front.jpg', 900);
});

test('downloads: a failing candidate falls through; nothing found is an error; small images can be skipped', { tag: ['@unit'] }, async () => {
  const seen = [];
  const m = new ImageMaximizer({ request: stub({
    'https://f4.bcbits.com/img/a1_10.jpg': { image: [1200, 1200] },   // _0 is missing → _10
    'https://shop.example/logo.png': { image: [64, 64] },
    'https://shop.example/empty': { text: '<html><head><title>no image</title></head></html>' },
    'https://api.deezer.com/album/1': { json: { cover_xl: 'https://cdn-images.dzcdn.net/images/cover/d41d8cd98f00b204e9800998ecf8427e/1000x1000-000000-80-0-0.jpg' } },
  }, seen), log: () => {} });
  const r = await m.fetchImages('https://f4.bcbits.com/img/a1_5.jpg');
  check(r[0].url === 'https://f4.bcbits.com/img/a1_10.jpg' && seen.includes('https://f4.bcbits.com/img/a1_0.jpg'), 'the original (_0) was tried first, then the next size answered');
  const err = async (p, re, what) => { try { await p; check(false, what + ': no error'); } catch (e) { check(re.test(e.message), `${what}: "${e.message}"`); } };
  await err(m.fetchImages('https://shop.example/empty'), /no image found/, 'a page without an image');
  await err(m.fetchImages('https://shop.example/logo.png', { minSize: 200 }), /no image could be downloaded/, 'only a logo under minSize');
  await err(m.fetchImages('https://www.deezer.com/album/1'), /no image found/, 'Deezer\'s empty placeholder cover');
  check((await m.fetchImages('https://shop.example/logo.png'))[0].width === 64, 'without minSize the small image is kept');
});

test('helpers: platform names, og:image reading, image sizes', { tag: ['@unit'] }, async () => {
  const m = new ImageMaximizer();
  const names = { 'https://music.apple.com/us/album/x/1': 'Apple Music', 'https://analogafrica.bandcamp.com/album/x': 'Bandcamp', 'https://listen.tidal.com/album/1': 'Tidal',
    'https://www.amazon.co.uk/dp/B000000000': 'Amazon', 'https://www.discogs.com/master/1': 'Discogs', 'https://us.7digital.com/artist/a/release/b-1': '7digital', 'https://example.com/': null };
  for (const [u, n] of Object.entries(names)) check(((m.platform(u) || {}).name || null) === n, `${u} → ${n}`);
  check(ImageMaximizer.metaImage('<meta name="twitter:image" content="https://x/t.jpg"><meta property="og:image" content="https://x/o.jpg?a=1&amp;b=2">', 'https://x/') === 'https://x/o.jpg?a=1&b=2', 'og:image wins over twitter:image, entities decoded');
  const png = new Uint8Array(32); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); png.set([0, 0, 0x05, 0xDC, 0, 0, 0x03, 0xE8], 16);
  check(JSON.stringify(ImageMaximizer.dimensions(png.buffer)) === '{"type":"png","width":1500,"height":1000}', 'PNG size read from its header');
  check(ImageMaximizer.dimensions(await jpeg(1417, 1400).arrayBuffer()).width === 1417, 'JPEG size read from its SOF marker');
  check(ImageMaximizer.dimensions(new Uint8Array([1, 2, 3, 4, 5, 6]).buffer) === null, 'unknown bytes → null');
  check(JSON.stringify(ImageMaximizer.captionType('Booklet p. 3-4')) === '{"types":["Booklet"],"comment":"Booklet p. 3-4"}', 'a caption keeps its detail as the comment');
});

test('live: the stores still answer as the rules expect', { tag: ['@web'] }, async () => {
  test.skip(!process.env.IMGMAX_LIVE, 'set IMGMAX_LIVE=1 to check the live stores');
  const m = new ImageMaximizer({ log: (l, s) => console.log(l, s) });
  // the stores that answer a plain request; Discogs' full size, Amazon, VGMdb, Juno and 7digital
  // need a browser that has passed their bot checks, as a userscript's requests have
  for (const [url, minW] of [
    ['https://music.apple.com/us/album/random-access-memories/617154241', 1500],
    ['https://www.deezer.com/en/album/6575789', 1200],
    ['https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', 1500],
    ['https://radiohead.bandcamp.com/album/kid-a-mnesia', 1400],
    ['https://tidal.com/browse/album/20115556', 1400],
    ['https://www.qobuz.com/us-en/album/random-access-memories-daft-punk/0886443927087', 1400],
    ['https://www.discogs.com/release/1-The-Persuader-Stockholm', 590],
  ]) {
    try { const r = await m.fetchImages(url); check(r[0].width >= minW, `${url}: ${r[0].width} px from ${r[0].url}`); }
    catch (e) { check(false, `${url}: ${e.message}`); }
  }
});
