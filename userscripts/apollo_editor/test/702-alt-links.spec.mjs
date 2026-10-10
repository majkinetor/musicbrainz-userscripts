// #702: a release seeded by Mission Control's consolidation carries, for each credited artist, its
// link on the source platform (url) and its links on the other platforms read (alt). Apollo tries
// the others when the source's link matches no one, or when the source has none, and badges the
// match with the platform whose link did it.
//
// The sandbox has Daft Punk and Pharrell Williams with their Deezer links (as in 651-platform-links).
import { test, check, functionSource } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, matchDone } from './ap.mjs';

const DZ = id => `https://www.deezer.com/artist/${id}`;
const DEEZER = { abbr: 'dz', name: 'Deezer' };
const BC = 'https://zzq-nobody-702.bandcamp.com';
const seed = {
  name: 'Apollo 702 alt links', 'artist_credit.names.0.name': 'D. Punk', status: 'official',
  'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'One', 'mediums.0.track.0.length': '200000', 'mediums.0.track.0.artist_credit.names.0.name': 'D. Punk',
  'mediums.0.track.1.name': 'Two', 'mediums.0.track.1.length': '200000', 'mediums.0.track.1.artist_credit.names.0.name': 'P. Williams',
};
// the source (Bandcamp) has no link for D. Punk, and one nobody has for P. Williams
const dp = { name: 'D. Punk', join: '', url: null, alt: [{ url: DZ(27), platform: DEEZER }] };
const pw = { name: 'P. Williams', join: '', url: BC, alt: [{ url: DZ(103), platform: DEEZER }] };
const handoff = {
  v: 2, mc: true, token: 't702', created: Date.now(), source: 'bandcamp', sourceName: 'Bandcamp', platform: { abbr: 'bc', name: 'Bandcamp' },
  url: 'https://zzq.bandcamp.com/album/x', title: seed.name, credit: [dp],
  mediums: [{ tracks: [{ title: 'One', credit: [dp] }, { title: 'Two', credit: [pw] }] }],
};

test('an alt link carries its own platform; the source\'s stays the handoff\'s', { tag: ['@unit', '@critical'] }, async () => {
  const src = await functionSource('apollo_editor', ['DISCOGS_ARTIST_LINK_TYPE', 'DISCOGS_PLATFORM', '_fcPlat', '_fcSame', 'handoffUrlIndex', 'platformOf']);
  const idx = new Function(src + '\nreturn handoffUrlIndex;')()(handoff);
  const fns = new Function('fcHandoff', 'fcUrlForms', src + '\nhandoffUrlIndex(fcHandoff());\nreturn { platformOf, same: u => _fcSame.get(u) };')(() => handoff, url => idx.get(url));
  check(fns.platformOf(DZ(27)).abbr === 'dz' && fns.platformOf(DZ(27)).name === 'Deezer', 'an alt link is Deezer\'s');
  check(fns.platformOf(BC).abbr === 'bc', 'the source\'s own link is the source\'s');
  check(JSON.stringify(fns.same(BC)) === JSON.stringify([DZ(103)]), `the artist's other links (${JSON.stringify(fns.same(BC))})`);
});

test.describe('Mission Control handoff', () => {
  test.use({ gm: apolloGm({ autoMatch: true }) });

  test('artists are matched by their links on the other platforms', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, {
      seed, tab: 'tracklist',
      before: () => page.evaluate(h => { localStorage.removeItem('apollo:discogs-link-cache-v1'); document.documentElement.dataset.firstContact = JSON.stringify(h); }, handoff),
    });
    await matchDone(page);
    const slots = await page.evaluate(() => window.__apolloEditor.model.tracks.map(t => t.slots.map(s => ({ c: s.creditedAs, status: s.status, name: s.name, why: s._why && s._why.plat || null }))));
    console.log(JSON.stringify(slots));
    const [one, two] = slots.map(s => s[0]);
    check(one.status === 'plat' && one.name === 'Daft Punk' && one.why && one.why.abbr === 'dz', `"D. Punk" (no Bandcamp link) → Daft Punk by its Deezer link: ${JSON.stringify(one)}`);
    check(two.status === 'plat' && two.name === 'Pharrell Williams' && two.why && two.why.abbr === 'dz', `"P. Williams" (a Bandcamp link nobody has) → Pharrell Williams by its Deezer link: ${JSON.stringify(two)}`);
  });
});
