import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'First Contact', values: { 'fc.settings': { mbCheck: 'off' } } }, pageErrors: 'ignore' });

test('standalone Bandcamp tracks import; tracks on albums are refused', { tag: '@unit' }, async ({ page, inject }) => {
  const makePage = albumId => {
    const data = { url: 'https://fixture.bandcamp.com/track/song', artist: 'Artist', current: { type: 'track', album_id: albumId, title: 'Song', release_date: '12 May 2024 00:00:00 GMT' }, trackinfo: [{ title: 'Song', title_link: '/track/song', duration: 136, streaming: 1 }], hasAudio: true };
    return `<html><head><script data-tralbum="${JSON.stringify(data).replace(/"/g, '&quot;')}"></script></head><body></body></html>`;
  };
  await page.route('https://fixture.bandcamp.com/track/song', route => route.fulfill({ contentType: 'text/html', body: makePage(null) }));
  await page.goto('https://fixture.bandcamp.com/track/song');
  await inject('first_contact', { waitFor: '__fcTest' });
  const result = await page.evaluate(async () => {
    const bc = window.__fcTest.providers.find(p => p.id === 'bandcamp');
    const path = bc.albumId(location);
    const rel = await bc.fetchRelease(path);
    const doc = document.implementation.createHTMLDocument('');
    const data = JSON.parse(document.querySelector('script[data-tralbum]').dataset.tralbum);
    data.current.album_id = 123;
    const script = doc.createElement('script');
    script.dataset.tralbum = JSON.stringify(data);
    doc.head.appendChild(script);
    let error = '';
    try { await bc.fetchRelease(path, null, doc); } catch (e) { error = e.message; }
    return { path, rel, error };
  });
  check(result.path === '/track/song', `track page recognized (${result.path})`);
  check(result.rel.title === 'Song' && result.rel.mediums[0].tracks.length === 1 && result.rel.mediums[0].tracks[0].lengthMs === 136000, 'single imported with its track and length');
  check(result.rel.url === 'https://fixture.bandcamp.com/track/song', 'track URL is the release URL');
  check(/belongs to an album/.test(result.error), `album track refused (${result.error})`);
});

