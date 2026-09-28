// #623 (sweep, X10): Fusion's normName kept only [a-z0-9] after NFKD, so a non-Latin
// title or artist (CJK, Cyrillic, Greek…) normalised to "" — and two identical
// "夜に駆ける" by the same artist, same length, formed no group at the normal
// cutoff; non-Latin recordings only ever matched by ISRC or AcoustID.
//
// Pure functions on a stub page — no network.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Fusion', xhr: 'none' } });

test('non-Latin titles and artists match like Latin ones', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/0ece1e80-fa3e-4fc8-8aec-c54003084bb3', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });

  const r = await page.evaluate(() => {
    const F = window.__fusion;
    const mk = (gid, o) => F.mkRecording(gid, Object.assign({ artistGids: [], length: 245000, isrcs: [], acoustids: [], video: false, releases: [{}], isrcsKnown: true }, o));
    return {
      jp: F.normName('夜に駆ける'), ru: F.normName('Кино'), gr: F.normName('Χάρις'), kana: F.normName('ザ・ブック'), latin: F.normName('Café Tacvba!'),
      jpTitle: F.titleSimilar('夜に駆ける', '夜に駆ける'), jpDiff: F.titleSimilar('夜に駆ける', '朝に駆ける'),
      ruArtist: F.artistSimilar('Кино', 'Кино'),
      groups: F.autoMatch([mk('a', { title: '夜に駆ける', artistCredit: 'YOASOBI' }), mk('b', { title: '夜に駆ける', artistCredit: 'YOASOBI' })], 5000, 'normal').length,
      groupsRu: F.autoMatch([mk('a', { title: 'Группа крови', artistCredit: 'Кино' }), mk('b', { title: 'Группа крови', artistCredit: 'Кино' })], 5000, 'normal').length,
      apart: F.autoMatch([mk('a', { title: 'Группа крови', artistCredit: 'Кино' }), mk('b', { title: 'Кукушка', artistCredit: 'Кино' })], 5000, 'normal').length,
    };
  });
  console.log(JSON.stringify(r));
  check(r.jp === '夜に駆ける' && r.ru === 'кино' && r.gr === 'χαρις', `non-Latin text survives normalisation (${r.jp} · ${r.ru} · ${r.gr})`);
  check(r.kana === 'ザ ブック', `…with its own marks intact: voiced kana stay voiced (${r.kana})`);
  check(r.latin === 'cafe tacvba', `Latin diacritics and punctuation still fold away (${r.latin})`);
  check(r.jpTitle === true && r.jpDiff === false, 'identical Japanese titles match; different ones do not');
  check(r.ruArtist === true, 'identical Cyrillic artists match');
  check(r.groups === 1 && r.groupsRu === 1, `identical non-Latin recordings group at normal (${r.groups}, ${r.groupsRu})`);
  check(r.apart === 0, 'different non-Latin titles still stay apart');
});
