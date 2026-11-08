import { test, check, functionSource, loadFunctions } from '../../../dev/test/harness.mjs';
import { openPc, cached } from './pc.mjs';

test.use({ profile: 'fresh', gm: false });

const urls = [
  'https://www.youtube.com/playlist?list=PL2qyUFMZzeYHLzuuzmVBm4eBXoItgqw81',
  'https://www.youtube.com/playlist?list=PL2qyUFMZzeYG-1dJcknJ4VxaJuwEsNfG1',
];

test('existing YouTube playlists: distinct identities and linked API relationships', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['parseMbData']);
  const parse = new Function(`const VA_MBID = '', VA_NAME_RE = /^various$/i; ${src}; return parseMbData;`)();
  const { pcSameUrl, ytmAlbumIdOf } = await loadFunctions('platform_check', ['pcUrlKey', 'pcSameUrl', 'ytmAlbumIdOf']);
  for (const url of urls) {
    const data = parse({ title: 'Album', 'artist-credit': [{ name: 'Artist' }], relations: [{ 'target-type': 'url', url: { resource: url } }] });
    check(data.existing.ytmusic === url, 'an existing PL playlist is retained as linked');
    check(pcSameUrl(url, url.replace('www.', 'music.')), 'the playlist identity survives a host change');
    check(await ytmAlbumIdOf(url) === null, 'a user playlist is not fetched as an auto-generated album');
  }
  check(!pcSameUrl(urls[0], urls[1]), 'different PL lists are different links');
});

test.describe('release-page scan', () => {
  const providers = ['discogs', 'bandcamp', 'spotify', 'apple', 'deezer', 'tidal', 'amazonmusic', 'qobuz', 'beatport', 'volumo', 'hdtracks', 'sevendigital', 'soundcloud', 'audiomack', 'allmusic'];
  test.use({ profile: 'logged-in', gm: { name: 'Platform Check', values: Object.fromEntries(providers.map(p => [`pc:prov_${p}`, false])) } });

  test('a linked playlist overrides a cached miss and reaches Mission Control as linked', { tag: '@sandbox' }, async ({ page, inject }) => {
    const release = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
    await openPc(page, inject, {
      release, links: { drop: /youtube\.com/, add: [urls[0]] },
      storage: { [`pc:cache:v2:ytmusic:${release}`]: { url: null, source: 'search', _t: Date.now() } },
    });
    const result = await cached(page, 'ytmusic');
    check(result?.url === urls[0] && result?.source === 'MB rels', 'the existing playlist replaces the cached search miss');
    check(result?.tracks === null, 'the playlist stays unverified');
    const finding = await page.evaluate(() => window.__pcTest680.pcMcFinding('ytmusic'));
    check(finding?.state === 'linked' && finding?.url === urls[0], 'Mission Control receives the original URL as linked');
  });
});

test('existing YouTube playlists are read from the release DOM', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('platform_check', ['parseMbFromDom', 'pcPageLabels']);
  await page.setContent(`<div id="content"><div class="releaseheader"><h1><bdi>Album</bdi></h1><p><a href="/artist/11111111-1111-1111-1111-111111111111">Artist</a></p></div><table class="tbl medium"><tbody><tr><td class="pos">1</td></tr></tbody></table></div><div id="sidebar"><a href="${urls[0]}">YouTube</a></div>`);
  const data = await page.evaluate(src => new Function(`const VA_MBID = '', VA_NAME_RE = /^various$/i, PC_FOLLOW = false; const appendLog = () => {}; ${src}; return parseMbFromDom();`)(), src);
  check(data?.existing.ytmusic === urls[0], 'the DOM path retains the linked PL playlist');
});
