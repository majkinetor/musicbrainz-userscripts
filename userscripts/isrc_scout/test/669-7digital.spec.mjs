// 7digital (#669), as an ISRC source. Its catalogue API (the key its web store ships, no
// login) can't list a release's tracks, so each track is searched by artist and title, and
// the hits on the linked release are kept, with their ISRC, disc and position on the disc.
//
//   - a release linking a 7digital album shows the 7digital import button;
//   - KIWANUKA (release 10569454): all 14 tracks come back, each with its ISRC, in order,
//     including "Hero (Intro)" and "Hero", which a looser title match would take as one;
//   - NOW That's What I Call Music! 118 (release 50739681): a track on disc 2 has its
//     position on that disc (`number`), not its running number (`trackNumber`, 216…);
//   - a stale key is refused and replaced by the one in the store's app.js.
//
// test.musicbrainz.org (a copy of a release, with production's data from
// fixtures/ws-439.json.gz; any release will do, the link is what's read). 7digital is live.
// Nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

const KAWAII = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const KIWANUKA = 'https://uk.7digital.com/artist/michael-kiwanuka/release/kiwanuka-10569454';
const withAlbum = j => { (j.relations = j.relations || []).push({ url: { resource: KIWANUKA } }); };
const KIWANUKA_TRACKS = ['You Ain\'t The Problem', 'Rolling', 'I\'ve Been Dazed', 'Piano Joint (This Kind Of Love) (Intro)', 'Piano Joint (This Kind Of Love)', 'Another Human Being', 'Living In Denial', 'Hero (Intro)', 'Hero', 'Hard To Say Goodbye', 'Final Days', 'Interlude (Loving The People)', 'Solid Ground', 'Light'];
test.use({ gm: { name: 'ISRC Scout' } });

test('a 7digital release gives every track\'s ISRC, disc and position; a refused key is replaced', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: KAWAII, replay: new URL('./fixtures/ws-439.json.gz', import.meta.url), edit: withAlbum });
  check(await until(() => page.evaluate(() => getComputedStyle(document.getElementById('ii-sd-all')).display !== 'none')), 'the 7digital import button shows');

  const r = await page.evaluate(async ({ url, titles }) => {
    const S = window.__isrcScoutTest669;
    S.setSdKey('refused0key');
    const kiw = await S.sevendigitalRelease(url, titles.map(title => ({ title, artist: 'Michael Kiwanuka' })));
    const now = await S.sevendigitalRelease('https://www.7digital.com/artist/various-artists/release/now-thats-what-i-call-music-118-50739681',
      [{ title: 'Espresso', artist: 'Sabrina Carpenter' }, { title: 'The Beginning', artist: 'Snow Patrol' }]);
    return { kiw: kiw.tracks, now: now.tracks, key: await S.sdKey() };
  }, { url: KIWANUKA, titles: KIWANUKA_TRACKS });
  console.log(JSON.stringify(r, null, 1));
  check(r.kiw.length === 14 && r.kiw.every((t, i) => t.disc === 1 && t.pos === i + 1 && /^GBUM719\d{5}$/.test(t.isrc)), `KIWANUKA: 14 tracks in order, each with its ISRC (${r.kiw.length})`);
  check(r.kiw[7] && r.kiw[7].title === 'Hero (Intro)' && r.kiw[8] && r.kiw[8].title === 'Hero', `"Hero (Intro)" and "Hero" are both found (${r.kiw.slice(7, 9).map(t => t.title).join(' | ')})`);
  check(r.key !== 'refused0key', `the refused key was replaced (${r.key})`);
  const espresso = r.now.find(t => t.title === 'Espresso'), beginning = r.now.find(t => t.title === 'The Beginning');
  check(espresso && espresso.disc === 1 && espresso.pos === 1 && espresso.isrc === 'USUM72404979', `Espresso is 1.1 (${JSON.stringify(espresso)})`);
  check(beginning && beginning.disc === 2 && beginning.pos === 18, `The Beginning is 2.18, not 2.218 (${JSON.stringify(beginning)})`);
  await ws.done();
});
