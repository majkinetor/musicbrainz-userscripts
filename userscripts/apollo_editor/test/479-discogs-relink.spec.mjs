// #479 (majkinetor): once a missing Discogs link is added to an artist, its button should
// turn into the normal MusicBrainz one — "It does change them, although probably due to
// rate limit it fails to always do so." Not a rate limit: right after the edit commits,
// /ws/js/entity can still answer with the old, link-less relationships, and that answer
// was cached. The re-check now retries past stale reads.
//
// /ws/js/entity is answered in the page: the first two reads without the link, then with it.
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const GID = '18b7a9f8-ece2-44fb-bcc6-c8747c4f0f41', ADDED = 'https://www.discogs.com/artist/205719';

test('the re-check after adding a link waits out stale reads', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const r = await page.evaluate(async ({ GID, ADDED }) => {
    const A = window.__apolloEditor, real = window.fetch.bind(window);
    let calls = 0;
    window.fetch = (u, o) => {
      if (!String(u).includes(`/ws/js/entity/${GID}`)) return real(u, o);
      const relationships = ++calls <= 2 ? [] : [{ linkTypeID: 180, target_type: 'url', target: { name: ADDED } }];
      return Promise.resolve(new Response(JSON.stringify({ relationships }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    await A.reTagAfterDiscogsLink(GID, ADDED, 'Test Artist');
    return { calls, cached: await A.artistDiscogsUrls(GID) };
  }, { GID, ADDED });
  check(r.calls >= 3, `read again past the two stale answers (${r.calls} reads)`);
  check(Array.isArray(r.cached) && r.cached.some(u => u.includes('205719')), `what is kept has the new link (${JSON.stringify(r.cached)})`);
});
