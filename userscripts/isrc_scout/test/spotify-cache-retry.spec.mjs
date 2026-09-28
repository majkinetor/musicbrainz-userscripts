// majkinetor: "Spotify links were not found before I first submitted ISRCs also
// obtained via Spotify. Why can't I add both at once." spAlbum() (and its Bandcamp,
// Apple and SoundCloud siblings) cached its album page once per page load, and ANY
// failure resolved to [], which is truthy: the miss was served from the cache for the
// rest of the session. A failure is not cached now, and a success still is.
//
// test.musicbrainz.org; Spotify's embed page is answered from a queue the test fills.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('a failed Spotify album fetch is retried, and a successful one cached', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const queue = [];
  answerGm(context, ({ url }) => (/open\.spotify\.com\/embed\/album\//.test(url) ? (queue.shift() || { status: 500, body: '' }) : null));
  // the release needs a Spotify album link for the resolver to fetch anything
  await openScout(page, inject, { edit: j => (j.relations = j.relations || []).push({ url: { resource: 'https://open.spotify.com/album/5ItlYlh8iSUBaTNe7hmJdq' } }) });
  const nextData = tracks => '<html><body><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { state: { data: { entity: { trackList: tracks } } } } } }) + '</script></body></html>';
  const resolve = (title, pos) => page.evaluate(([title, pos]) => window.__isrcScoutTest466.PROV.find(p => p.code === 'sp').resolve(null, { title }, pos), [title, pos]);

  queue.push({ status: 503, body: 'blocked' });   // the anti-bot page, or a blip
  check(await resolve('Test Track One', 0) === null, 'a failed fetch gives no candidate, and no error');
  queue.push({ status: 200, body: nextData([{ uri: 'spotify:track:abc111', title: 'Test Track One' }, { uri: 'spotify:track:def222', title: 'Test Track Two' }]) });
  const second = await resolve('Test Track One', 0);
  check(second === 'https://open.spotify.com/track/abc111', `the next call fetches again and finds it (${second})`);
  queue.push({ status: 500, body: 'must not be used' });
  const third = await resolve('Test Track Two', 1);
  check(third === 'https://open.spotify.com/track/def222', `a later track comes from the cached success, not a new fetch (${third})`);
  check(queue.length === 1, 'the queued failure was never asked for');
});
