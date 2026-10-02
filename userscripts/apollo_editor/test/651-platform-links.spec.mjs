// #651: artist matching by the platform links First Contact hands over. A release seeded by First
// Contact carries every credited artist's platform page (here Deezer's); the MB artist that has
// that link is matched with the platform's badge, the links are resolved in batched /ws/2/url
// lookups, and a link nobody has is offered for create-with-link.
//
// The sandbox has Daft Punk, Pharrell Williams and Nile Rodgers with their Deezer links. Daft
// Punk is credited as "D. Punk", which no name stage can find.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, matchDone } from './ap.mjs';

const DZ = id => `https://www.deezer.com/artist/${id}`;
const NOBODY = DZ(999999999);
const seed = {
  name: 'Apollo 651 platform links', 'artist_credit.names.0.name': 'D. Punk', status: 'official',
  'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'One', 'mediums.0.track.0.length': '200000', 'mediums.0.track.0.artist_credit.names.0.name': 'D. Punk',
  'mediums.0.track.1.name': 'Two', 'mediums.0.track.1.length': '200000',
  'mediums.0.track.1.artist_credit.names.0.name': 'D. Punk', 'mediums.0.track.1.artist_credit.names.0.join_phrase': ' feat. ',
  'mediums.0.track.1.artist_credit.names.1.name': 'Pharrell Williams', 'mediums.0.track.1.artist_credit.names.1.join_phrase': ' & ',
  'mediums.0.track.1.artist_credit.names.2.name': 'Nile Rodgers',
  'mediums.0.track.2.name': 'Three', 'mediums.0.track.2.length': '200000', 'mediums.0.track.2.artist_credit.names.0.name': 'Zzq Nobody 651',
};
const dp = { name: 'D. Punk', join: '', url: DZ(27) };
const handoff = {
  v: 1, token: 't651', created: Date.now(), source: 'deezer', sourceName: 'Deezer', url: 'https://www.deezer.com/album/6575789', title: seed.name,
  credit: [dp],
  mediums: [{ tracks: [
    { title: 'One', credit: [dp] },
    { title: 'Two', credit: [{ ...dp, join: ' feat. ' }, { name: 'Pharrell Williams', join: ' & ', url: DZ(103) }, { name: 'Nile Rodgers', join: '', url: DZ(7207) }] },
    { title: 'Three', credit: [{ name: 'Zzq Nobody 651', join: '', url: NOBODY }] },
  ] }],
};

test('the forms an artist link is looked up under', { tag: ['@unit', '@critical'] }, async () => {
  const { platformUrlForms, platformOf } = await loadFunctions('apollo_editor', ['DISCOGS_ARTIST_LINK_TYPE', 'PLATFORMS', 'APPLE_CCS', 'AMAZON_TLDS', 'platformOf', 'platformUrlForms']);
  check(JSON.stringify(platformUrlForms(DZ(27))) === JSON.stringify([DZ(27)]), 'a Deezer link is looked up as it is');
  const apple = platformUrlForms('https://music.apple.com/us/artist/daft-punk/5468295');
  check(apple.includes('https://music.apple.com/us/artist/5468295') && apple.includes('https://music.apple.com/fr/artist/5468295') && apple.length > 10, `Apple Music: without the slug, in other countries too (${apple.length} forms)`);
  const qz = platformUrlForms('https://www.qobuz.com/fr-fr/interpreter/daft-punk/36819');
  check(qz.includes('https://open.qobuz.com/artist/36819'), 'Qobuz: also as open.qobuz.com');
  const amz = platformUrlForms('https://music.amazon.com/artists/B001E8WS3O');
  check(amz.includes('https://music.amazon.fr/artists/B001E8WS3O'), 'Amazon Music: on its other domains too');
  check(platformOf(DZ(27)).abbr === 'dz' && platformOf('https://open.spotify.com/artist/x').abbr === 'sp' && platformOf('https://example.com/') === null, 'the platform and its badge');
  check(platformOf('https://music.apple.com/us/artist/5468295').type === 978 && platformOf('https://www.qobuz.com/x').type === 176 && !platformOf(DZ(1)).type, 'link types only where MusicBrainz cannot pick one');
});

test.describe('First Contact handoff', () => {
  test.use({ gm: apolloGm({ autoMatch: true }) });

  test('artists are matched by their Deezer links, in batched lookups', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    const lookups = [];
    page.on('request', r => { const u = r.url(); if (/\/ws\/2\/url\?/.test(u)) lookups.push(new URL(u).searchParams.getAll('resource')); });
    await openApollo(page, inject, {
      seed, tab: 'tracklist',
      // Apollo keeps link lookups for a day in the page's storage, which the test profile keeps between runs
      before: () => page.evaluate(h => { localStorage.removeItem('apollo:discogs-link-cache-v1'); document.documentElement.dataset.firstContact = JSON.stringify(h); }, handoff),
    });
    await matchDone(page);
    await page.waitForFunction(() => { const s = window.__apolloEditor.model.tracks[2].slots[0]; return s._platUrl !== undefined; }, null, { timeout: 30000 }).catch(() => {});
    const slots = await page.evaluate(() => window.__apolloEditor.model.tracks.map(t => t.slots.map(s => ({ c: s.creditedAs, status: s.status, name: s.name, committed: !!s.committed, gid: s.gid, plat: s._platUrl || null, add: !!s._platAddable, conf: s._platConflict ? s._platConflict.name : null }))));
    console.log(JSON.stringify(slots));
    if (process.env.LOGOUT) (await import('node:fs')).writeFileSync(process.env.LOGOUT, await page.evaluate(() => window.__apolloEditor.logMarkdown()));
    const flat = slots.flat();
    const dpSlots = flat.filter(s => s.c === 'D. Punk');
    check(dpSlots.length === 2 && dpSlots.every(s => s.status === 'plat' && s.committed && s.name === 'Daft Punk'), `"D. Punk" → Daft Punk by its Deezer link, on both tracks: ${JSON.stringify(dpSlots)}`);
    const pw = flat.find(s => s.c === 'Pharrell Williams'), nr = flat.find(s => s.c === 'Nile Rodgers');
    check(pw && pw.status === 'plat' && pw.name === 'Pharrell Williams' && nr && nr.status === 'plat' && nr.name === 'Nile Rodgers', `the featured artists too: ${JSON.stringify([pw, nr])}`);
    check(flat.filter(s => s.status === 'plat').every(s => !s.add), 'a matched artist that has the link is offered nothing');
    const nobody = flat.find(s => s.c === 'Zzq Nobody 651');
    check(nobody && !nobody.committed && nobody.plat === NOBODY && nobody.add && !nobody.conf, `a link nobody has: the artist can be created with it: ${JSON.stringify(nobody)}`);

    const badges = await page.evaluate(() => [...document.querySelectorAll('.tc-mirror .tc-badge.plat')].map(b => b.textContent.trim()));
    check(badges.length >= 4 && badges.every(t => t === 'dz'), `the badge says dz (${JSON.stringify(badges)})`);
    const offer = await page.evaluate(() => { const a = document.querySelector('.tc-mirror .tc-tic.plat-offer'); return a ? a.title : null; });
    check(offer && /Create this artist with its Deezer link/.test(offer), `the 🔗 offer on the unmatched row: ${offer}`);

    const platLookups = lookups.filter(rs => rs.some(r => /deezer\.com\/artist/.test(r)));
    console.log('lookups', JSON.stringify(platLookups));
    check(platLookups.length >= 1 && platLookups[0].length === 4, `one batched lookup for the four distinct links first (${JSON.stringify(platLookups.map(r => r.length))})`);
    check(platLookups.every(rs => rs.length > 1), `no lookups of single links one by one (${JSON.stringify(platLookups.map(r => r.length))})`);

    const card = await page.evaluate(() => { const A = window.__apolloEditor; const s = A.model.tracks[0].slots[0]; return A.matchCardHtml(s); });
    check(/Platform link/.test(card) && /Deezer/.test(card) && /deezer\.com\/artist\/27/.test(card), 'the match card says it was the Deezer link');
  });

  test('🔗 adds the link to the artist, or creates the artist with it', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, {
      seed, tab: 'tracklist',
      before: () => page.evaluate(h => { document.documentElement.dataset.firstContact = JSON.stringify(h); }, handoff),
    });
    await matchDone(page);
    const r = await page.evaluate(async ({ NOBODY }) => {
      const A = window.__apolloEditor, opened = [];
      window.open = u => { opened.push(String(u)); return null; };   // nothing is really opened
      const dp = A.model.tracks[0].slots[0];   // Daft Punk, matched by the link
      // the same artist, now with a link it lacks (an Apple Music one: MB can't type it by itself)
      await A.tagPlatformAddable(dp, 'https://music.apple.com/us/artist/x/1');
      const addable = dp._platAddable;
      A.addOrCreatePlatformLink(dp);
      const nobody = A.model.tracks[2].slots[0];
      await A.tagPlatformAddable(nobody, NOBODY);
      A.addOrCreatePlatformLink(nobody);
      return { addable, opened };
    }, { NOBODY });
    const [edit, create] = r.opened.map(u => new URL(u));
    check(r.addable, 'a matched artist without the link is offered it');
    check(edit && /\/artist\/[0-9a-f-]{36}\/edit$/.test(edit.pathname) && edit.searchParams.get('edit-artist.url.0.text') === 'https://music.apple.com/us/artist/x/1' && edit.searchParams.get('edit-artist.url.0.link_type_id') === '978', `the artist's edit, with the link as a streaming page: ${edit && edit.href}`);
    check(/Added Apple Music link/.test(edit ? edit.searchParams.get('edit-artist.edit_note') || '' : ''), 'with an edit note');
    check(create && /\/artist\/create$/.test(create.pathname) && create.searchParams.get('edit-artist.name') === 'Zzq Nobody 651' && create.searchParams.get('edit-artist.url.0.text') === NOBODY && !create.searchParams.get('edit-artist.url.0.link_type_id'), `create, with the Deezer link (MB types it): ${create && create.href}`);
  });

  test('without a handoff nothing changes', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    let plat = 0;
    page.on('request', r => { if (/\/ws\/2\/url\?.*deezer/.test(decodeURIComponent(r.url()))) plat++; });
    await openApollo(page, inject, { seed, tab: 'tracklist' });
    await matchDone(page);
    const st = await page.evaluate(() => window.__apolloEditor.model.tracks.flatMap(t => t.slots.map(s => s.status)));
    check(!st.includes('plat') && plat === 0, `no platform stage, no platform lookups (${JSON.stringify(st)}, ${plat})`);
  });
});
