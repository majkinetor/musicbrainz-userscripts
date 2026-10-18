// #733: MusicBrainz's "Verifying your browser" check, mid-session.
//
// The release editor never reloads, so when the __meb_verified cookie lapses (24 h, bound
// to the IP) every /ws/js read gets the check's HTML page instead of JSON, and searches,
// matching and the artist picker all failed with "JSON.parse: unexpected character".
// Apollo now passes the check once in a hidden frame and retries.
//
// Real end to end: dropping the cookie brings the real check back on the sandbox. MusicBrainz
// switches the check off at times (on test and production alike); then there is nothing to
// pass, and the spec is skipped rather than failed.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

const COOKIE = '__meb_verified';

test('an expired browser check is passed again and the search returns', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  const ctx = page.context();
  const passed = (await ctx.cookies()).some(c => c.name === COOKIE);

  await ctx.clearCookies({ name: COOKIE });
  const raw = await page.evaluate(() => fetch('/ws/js/artist?q=kassav&limit=3', { headers: { Accept: 'application/json' } }).then(r => r.text()));
  const checking = /Verifying your browser/.test(raw);
  test.skip(!checking, 'MusicBrainz has its browser check off: /ws/js answers without the cookie');
  check(passed, 'the page passed the check once (otherwise nothing below is a test)');

  const frames = [];
  page.on('frameattached', f => frames.push(f));
  const hits = await page.evaluate(() => window.__apolloEditor.searchArtist('kassav', 5));
  check(Array.isArray(hits) && hits.length > 0 && hits.every(h => h.gid), `the search returns artists (${hits && hits.length})`);
  check((await ctx.cookies()).some(c => c.name === COOKIE), 'the check was passed again: the cookie is back');
  check(frames.length >= 1, `in a frame (${frames.length})`);
  check(await page.evaluate(() => ![...document.querySelectorAll('iframe')].some(f => /\/ws\/js\//.test(f.src))), 'and the frame is gone afterwards');

  const ent = await page.evaluate(gid => window.__apolloEditor.fetchEntity(gid), hits[0].gid);
  check(ent && ent.gid === hits[0].gid, 'later reads just work');
});
