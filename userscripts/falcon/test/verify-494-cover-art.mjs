// #494 (majkinetor) — release cover art from Harmony. Harmony's own resolution/size
// caption ("1200×1200, 703.99 kB, JPEG") is present in the issue's own example HTML
// but was NOT reproducible live this session (confirmed against the real page, both a
// clean fetch and majkinetor's own logged-out browser — only "Type: front Source: X"
// ever rendered) — so parseCoverCaptionMeta is exercised against the issue's exact
// snippet (must still parse it when present), and pickBestCover's fetch+measure
// fallback is exercised for the common case where it's absent.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

// Verbatim from the #494 issue body's <details> block.
const ISSUE_FIGURE_HTML = `<figure class="cover-image" data-provider="Deezer"><a href="https://cdn-images.dzcdn.net/images/cover/14e314dec66d473bebcc17ccaf9c43d6/1000x1000-000000-80-0-0.jpg"><img src="https://cdn-images.dzcdn.net/images/cover/14e314dec66d473bebcc17ccaf9c43d6/250x250-000000-80-0-0.jpg" alt="front" title="front"></a><figcaption><span class="label" data-fresh-key="front">Type: front</span><span class="label">Source: <span class="deezer" title="Deezer"><svg class="icon" width="24" height="24" stroke-width="1.25"><use xlink:href="/icon-sprite.svg#brand-deezer"></use></svg></span>Deezer</span><span class="label">1200×1200, 703.99 kB, JPEG</span><a class="label" href="https://musicbrainz.org/release/3b60d941-e4c7-4dca-9b4d-7a11d0268383/add-cover-art?x_seed.image.0.url=https%3A%2F%2Fwww.deezer.com%2Falbum%2F373923127&amp;x_seed.origin=https%3A%2F%2Fharmony.pulsewidth.org.uk%2Frelease%2Factions">+ Add Cover Art</a></figcaption></figure>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  // Test-only shim: plain fetch() instead of a real GM_xmlhttpRequest. Fine here
  // since every candidate URL used below is intercepted via page.route with
  // permissive CORS headers — this is verifying gmFetch's/pickBestCover's LOGIC,
  // not real cross-origin privilege (which only a real userscript manager grants).
  window.GM_xmlhttpRequest = (opts) => {
    fetch(opts.url).then(async r => {
      if (!r.ok) return opts.onerror && opts.onerror();
      const blob = await r.blob();
      opts.onload({ status: r.status, response: blob });
    }).catch(() => opts.onerror && opts.onerror());
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. parseCoverCaptionMeta on the issue's own verbatim figure HTML — must parse
//    "1200×1200, 703.99 kB, JPEG" into {width:1200,height:1200,size:703990}.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const meta = await page.evaluate((html) => {
    const div = document.createElement('div'); div.innerHTML = html;
    return window.__falconTest.parseCoverCaptionMeta(div.querySelector('figure'));
  }, ISSUE_FIGURE_HTML);
  console.log('parsed caption meta:', JSON.stringify(meta));
  ck(meta && meta.width === 1200 && meta.height === 1200, `caption WxH parsed (got ${JSON.stringify(meta)})`);
  ck(meta && meta.size === 703990, `caption size parsed as bytes, "703.99 kB" -> 703990 (got ${meta?.size})`);
}

// 2. scrapeHarmonyCover against a synthetic page assembled from the issue's own
//    figure + a MusicBrainz release link, plus a Discogs figure that must be
//    excluded.
{
  const page = ctx.pages()[0];
  await page.setContent(`<a href="https://musicbrainz.org/release/3b60d941-e4c7-4dca-9b4d-7a11d0268383">Open in MusicBrainz</a>
    ${ISSUE_FIGURE_HTML}
    <figure class="cover-image" data-provider="Discogs"><a href="https://discogs.example/big.jpg"><img src="https://discogs.example/small.jpg"></a><figcaption><span class="label">Type: front</span></figcaption></figure>`);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const cover = await page.evaluate(() => window.__falconTest.scrapeHarmonyCover());
  console.log('scrapeHarmonyCover:', JSON.stringify(cover));
  ck(cover && cover.mbid === '3b60d941-e4c7-4dca-9b4d-7a11d0268383', `release mbid found (got ${cover?.mbid})`);
  ck(cover && cover.coverCandidates.length === 1, `Discogs excluded, only Deezer kept (got ${cover?.coverCandidates.length})`);
  ck(cover && cover.coverCandidates[0].url === 'https://cdn-images.dzcdn.net/images/cover/14e314dec66d473bebcc17ccaf9c43d6/1000x1000-000000-80-0-0.jpg', 'direct <a href> captured, not the thumbnail <img src>');
  ck(cover && cover.coverCandidates[0].width === 1200, 'caption metadata carried through onto the candidate');
}

// 3. Live Harmony page from the issue itself: the button should now report the
//    recording count PLUS one for the release cover row, and the stored payload
//    must carry a 'release' tuple with coverCandidates (Discogs-free, direct URLs).
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://harmony.pulsewidth.org.uk/release/actions?deezer=373923127&spotify=13fYK0LOJBzdfLw5DLCGSg&qobuz=kh245e77ftrlb&gtin=4018939599782&itunes=&tidal=&region=GB&release_mbid=3b60d941-e4c7-4dca-9b4d-7a11d0268383', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const items = window.__falconTest.scrapeHarmonyActions();
    const cover = window.__falconTest.scrapeHarmonyCover();
    const btn = document.getElementById('falcon-harmony-btn');
    return { count: items.length, cover, btnText: document.getElementById('falcon-harmony-lbl')?.textContent };
  });
  console.log('live harmony scrape:', JSON.stringify(info));
  ck(!!info.cover, 'scrapeHarmonyCover finds candidates on the real page');
  ck(info.cover && info.cover.coverCandidates.length >= 4, `several provider candidates found, Discogs never appears here anyway (got ${info.cover?.coverCandidates.length})`);
  ck(new RegExp(`Send ${info.count + 1} to Falcon`).test(info.btnText || ''), `button count includes +1 for the cover row (label="${info.btnText}")`);

  const clicked = await page.evaluate(() => new Promise(resolveClick => {
    const origOpen = window.open;
    window.open = url => { window.open = origOpen; resolveClick(url); return { closed: false }; };
    document.getElementById('falcon-harmony-btn').click();
  }));
  const token = new URL(clicked).searchParams.get('falcon');
  const storedArr = await page.evaluate(tok => JSON.parse(window.GM_getValue('falcon:pending:' + tok)), token);
  const relTuple = storedArr.find(t => t.entityType === 'release');
  console.log('stored release tuple:', JSON.stringify(relTuple));
  ck(!!relTuple, 'a release tuple is present in the stored Harmony payload');
  ck(relTuple && relTuple.mbid === '3b60d941-e4c7-4dca-9b4d-7a11d0268383', 'release mbid correct');
  ck(relTuple && relTuple.coverCandidates.length === info.cover.coverCandidates.length, 'all scraped candidates carried into the payload');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 4. pickBestCover: (a) zero-fetch when every candidate already carries caption
//    metadata — picks highest area, ties broken by lowest size; (b) falls back to
//    fetch+measure for candidates missing it, via the GM_xmlhttpRequest shim above
//    and page.route-served fake images with real, DIFFERING pixel dimensions.
{
  const page = ctx.pages()[0];
  await page.route('**/fake-small.jpg', route => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: onePxPngBuffer(10, 10) }));
  await page.route('**/fake-big.jpg', route => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: onePxPngBuffer(50, 50) }));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

  // (a) caption metadata present on both -> no network call needed at all.
  const zeroFetch = await page.evaluate(async () => {
    const item = { mbid: 'aaaaaaaa-0000-0000-0000-000000000000', cover: { url: '', candidates: [
      { provider: 'A', url: 'https://example.invalid/should-not-be-fetched-a.jpg', width: 500, height: 500, size: 900000 },
      { provider: 'B', url: 'https://example.invalid/should-not-be-fetched-b.jpg', width: 500, height: 500, size: 100000 },   // same area, smaller size -> wins
    ] } };
    await window.__falconTest.pickBestCover(item);
    return item.cover.url;
  });
  ck(zeroFetch === 'https://example.invalid/should-not-be-fetched-b.jpg', `equal resolution -> lowest size wins, with zero fetches needed (got ${zeroFetch})`);

  // (b) no caption metadata -> measures via gmFetch against the routed fakes.
  const measured = await page.evaluate(async (origin) => {
    const item = { mbid: 'bbbbbbbb-0000-0000-0000-000000000000', cover: { url: '', candidates: [
      { provider: 'Small', url: origin + '/fake-small.jpg' },
      { provider: 'Big', url: origin + '/fake-big.jpg' },
    ] } };
    await window.__falconTest.pickBestCover(item);
    return item.cover.url;
  }, 'https://musicbrainz.org');
  ck(measured.includes('fake-big'), `fetch+measure fallback correctly picks the actually-larger image (got ${measured})`);
}

// 5. runCoverItem's request shape — sign/upload/register endpoints and field
//    names, all intercepted+faked (no real production write, per the #493
//    interception-verification lesson: assert on what was actually POSTed).
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const calls = [];
  await page.route('**/ws/js/cover-art-upload/**', route => {
    calls.push({ kind: 'sign', url: route.request().url() });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ action: 'https://fake-archive.invalid/upload', image_id: 999, nonce: 'noncevalue', formdata: { key: 'abc', policy: 'xyz' } }) });
  });
  await page.route('https://fake-archive.invalid/upload', route => { calls.push({ kind: 'upload', method: route.request().method() }); route.fulfill({ status: 200, body: 'ok' }); });
  await page.route('**/release/*/add-cover-art', route => {
    const req = route.request();
    if (req.method() === 'GET') {
      calls.push({ kind: 'form-get' });
      route.fulfill({ status: 200, contentType: 'text/html', body: `<form method="POST" action="/release/x/add-cover-art"><input type="hidden" name="csrf_token" value="tok123"><label><input type="checkbox" name="add-cover-art.type_id" value="2">Front</label></form>` });
    } else {
      calls.push({ kind: 'form-post', body: req.postData() });
      route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' });
    }
  });
  await page.route('**/fake-cover-src.jpg', route => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: onePxPngBuffer(20, 20) }));

  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const result = await page.evaluate(async () => {
    const item = { mbid: 'cccccccc-0000-0000-0000-000000000000', comment: 'my comment', note: 'my edit note', cover: { url: 'https://musicbrainz.org/fake-cover-src.jpg', candidates: [] }, status: 'active' };
    await window.__falconTest.runCoverItem(item, '[test]', { querySelector: () => null, dataset: {} });
    return { status: item.status, error: item.error };
  });
  console.log('runCoverItem result:', JSON.stringify(result));
  console.log('calls:', JSON.stringify(calls.map(c => c.kind)));
  ck(result.status === 'done', `item finishes as done (got ${JSON.stringify(result)})`);
  ck(calls.some(c => c.kind === 'sign'), 'hit the sign endpoint (/ws/js/cover-art-upload/<mbid>)');
  ck(calls.some(c => c.kind === 'upload'), 'uploaded the file to the signed action URL');
  ck(calls.some(c => c.kind === 'form-get') && calls.some(c => c.kind === 'form-post'), 'GET the add-cover-art form then POST it');
  const postCall = calls.find(c => c.kind === 'form-post');
  const body = new URLSearchParams(postCall.body);
  ck(body.get('add-cover-art.id') === '999', `image_id from the sign response is submitted (got ${body.get('add-cover-art.id')})`);
  ck(body.get('add-cover-art.nonce') === 'noncevalue', 'nonce from the sign response is submitted');
  ck(body.get('add-cover-art.type_id') === '2', `front type_id resolved from the scraped form's checkbox label (got ${body.get('add-cover-art.type_id')})`);
  ck(body.get('add-cover-art.comment') === 'my comment', 'item.comment submitted as the image comment');
  ck(body.get('add-cover-art.edit_note') === 'my edit note', 'item.note submitted as the edit note');
  ck(body.get('csrf_token') === 'tok123', 'hidden CSRF field carried through from the scraped form');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);

// Minimal valid PNG at an arbitrary size, built once per call — good enough for
// createImageBitmap() to report real, DIFFERING width/height in test 4.
function onePxPngBuffer(w, h) {
  const zlib = require('zlib');
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeData), 0);
    return Buffer.concat([len, typeData, crc]);
  }
  function crc32(buf) {
    let c, crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = (crc ^ buf[i]) & 0xFF;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGB, no interlace
  const rowBytes = w * 3 + 1;
  const raw = Buffer.alloc(rowBytes * h, 0);
  for (let y = 0; y < h; y++) raw[y * rowBytes] = 0;   // filter type 0 per row
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
