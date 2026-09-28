// #466 (chaban-mb): for a recording with several ISRCs (a reissue gets its own code for
// the same recording), only the FIRST was tried against a provider, so Qobuz missed
// tracks 8 and 10 of the reported release: its catalogue has them under the other one.
//   track 8  "NordBerliner" — DEZC62660402, DEZC62685941
//   track 10 "Mach Platz!"  — DEZC62665288, DEZC62685943
// Qobuz's album is answered with every track's ISRC, tracks 8 and 10 with their SECOND
// one only, as in the real case; resolveProvider('qz') runs through the test hook.
//
// test.musicbrainz.org (a copy of the release), with production's data
// (fixtures/ws-466.json.gz). Only Qobuz is faked.
import { test, check, answerGm, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

const TRACKS = ['Fuck You!', '65Chambers', 'Azz Blown Off', '3x', '6 Fuß Tiefe', 'Für die Ghulz Pt.2', 'Was Du Brauchzt', 'NordBerliner', 'Brain Dead', 'Mach Platz!', 'Who You Think?!', "Wo Wir Häng'", 'EBK'];
const ALBUM = JSON.stringify({
  title: 'Vol.1-6 Kämmern 5 Kugeln der Zirkel',
  tracks: { items: TRACKS.map((title, i) => ({ isrc: 'DEZC626859' + (34 + i), title, performer: { name: 'Test Artist' }, media_number: 1, track_number: i + 1, duration: 180, id: 900000 + i })) },
});
test.use({ gm: { name: 'ISRC Scout' } });

test('a recording is looked up by each of its ISRCs, not only the first', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  let qobuz = 0;
  answerGm(context, ({ url }) => (/qobuz\.com\/api\.json/.test(url) ? (qobuz++, { status: 200, body: ALBUM }) : null));
  const ws = await openScout(page, inject, { release: 'b0a00236-e218-47ae-9d38-ec96f3fe9fff', replay: new URL('./fixtures/ws-466.json.gz', import.meta.url) });
  await page.waitForFunction(() => !!window.__isrcScoutTest466, null, { timeout: 5000 });
  await page.evaluate(async () => { const { PROV, resolveProvider } = window.__isrcScoutTest466; await resolveProvider(PROV.find(p => p.code === 'qz')); });
  const r = await until(() => page.evaluate(() => {
    const get = i => { const el = document.querySelector(`tr[data-idx="${i}"] .ii-tl-add .ii-tl[data-code="qz"]`); return el ? { cls: el.className, href: el.getAttribute('href') } : null; };
    return { t8: get(7), t10: get(9) };
  }), r => r.t8 && r.t10);
  check(qobuz === 1, `one Qobuz album call serves all 13 tracks (${qobuz})`);
  check(r.t8 && r.t8.cls.includes('new') && /open\.qobuz\.com\/track\/900007/.test(r.t8.href || ''), `track 8 resolves through its second ISRC (${JSON.stringify(r.t8)})`);
  check(r.t10 && r.t10.cls.includes('new') && /open\.qobuz\.com\/track\/900009/.test(r.t10.href || ''), `track 10 too (${JSON.stringify(r.t10)})`);
  await ws.done();
});
