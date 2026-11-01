import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('Bandcamp standalone tracks are releases; album tracks and unreadable tracks are not', { tag: '@unit' }, async () => {
  const source = await functionSource('platform_check', ['fetchBandcampMeta']);
  const html = albumId => `<script data-tralbum="${JSON.stringify({ current: { type: 'track', title: 'Song', album_id: albumId }, trackinfo: [{ title: 'Song' }] }).replace(/"/g, '&quot;')}"></script><script type="application/ld+json">{"numTracks":1,"byArtist":{"name":"Artist"},"musicReleaseFormat":"DigitalFormat"}</script>`;
  let body = html(null);
  const read = new Function('gmGet', 'normBarcode', 'pcCreditsBandcamp', `${source}; return fetchBandcampMeta;`)(async () => ({ ok: true, responseText: body }), x => x, () => []);
  const url = 'https://artist.bandcamp.com/track/song';
  const single = await read(url);
  check(single?.tracks === 1 && single.title === 'Song' && single.format === 'Digital', `standalone track: ${JSON.stringify(single)}`);
  body = html(123);
  check(await read(url) === null, 'an album track is rejected');
  body = '<html>no track data</html>';
  check(await read(url) === null, 'unreadable track data is rejected');
});

test('single-track searches include track pages without changing album searches', { tag: '@unit' }, async () => {
  const source = await functionSource('platform_check', ['searchBandcampNative']);
  const urls = ['https://artist.bandcamp.com/album/record', 'https://artist.bandcamp.com/track/song'];
  const body = urls.map(url => `<a href="${url}?from=search">result</a>`).join('') + ' '.repeat(5000);
  let requested = '';
  const search = new Function('gmGet', 'appendLog', `${source}; return searchBandcampNative;`)(async url => { requested = url; return { ok: true, status: 200, responseText: body, ms: 1 }; }, () => {});
  const one = await search('Artist Song', 'Bandcamp', true);
  check(one.includes(urls[0]) && one.includes(urls[1]) && !requested.includes('item_type=a'), `single-track search: ${JSON.stringify(one)}`);
  const many = await search('Artist Record', 'Bandcamp', false);
  check(many.length === 1 && many[0] === urls[0] && requested.includes('item_type=a'), `album search: ${JSON.stringify(many)}`);
});
