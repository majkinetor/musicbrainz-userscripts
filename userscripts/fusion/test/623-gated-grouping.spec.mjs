// #623 (sweep, U3): Auto-match grouped recordings that must never merge, through a
// third one with unknown data. The hard gates — video vs audio, lengths more than
// 30 s apart — were checked only per PAIR, and an unknown value never blocks a
// pair (we can't tell), so union-find joined them transitively:
//
//   A video, B video unknown, C audio  (same title and artist) → one group A+B+C
//   A 3:00,  B length unknown,  C 4:30                         → one group A+B+C
//
// and Merge All then submitted it. groupTier had the same shape, so a hand-built
// group holding such a pair was still described as holding together at a cutoff.
//
// Pure functions on a stub page — no network.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Fusion', xhr: 'none' } });

test('the hard gates hold for the whole group, not just the linking pair', { tag: ['@unit', '@critical'] }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/0ece1e80-fa3e-4fc8-8aec-c54003084bb3', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });

  const r = await page.evaluate(() => {
    const F = window.__fusion;
    const mk = (gid, o) => F.mkRecording(gid, Object.assign({ title: 'Same Song', artistCredit: 'Same Artist', artistGids: [], length: 200000, isrcs: [], acoustids: [], video: false, releases: [{}], isrcsKnown: true }, o));
    const ids = g => g.map(x => x.memberGids.slice().sort().join('+')).sort();
    const out = {};
    // video / audio through an unknown
    out.video = ids(F.autoMatch([mk('a', { video: true }), mk('b', { video: null }), mk('c', { video: false })], 5000, 'normal'));
    // 3:00 / 4:30 through an unknown length (normal cutoff: unknown length doesn't veto, #565)
    out.length = ids(F.autoMatch([mk('a', { length: 180000 }), mk('b', { length: null }), mk('c', { length: 270000 })], 5000, 'normal'));
    // control: the direct pair never grouped
    out.direct = ids(F.autoMatch([mk('a', { length: 180000 }), mk('c', { length: 270000 })], 5000, 'normal'));
    // and a plain group still forms
    out.plain = ids(F.autoMatch([mk('a', {}), mk('b', { length: null }), mk('c', {})], 5000, 'normal'));
    // groupTier on a hand-built group that holds a conflicting pair
    out.tierConflict = F.groupTier([mk('a', { video: true }), mk('b', { video: null }), mk('c', { video: false })]);
    out.tierPlain = F.groupTier([mk('a', {}), mk('b', {})]);
    return out;
  });
  console.log(JSON.stringify(r));

  check(!r.video.some(g => g.includes('a') && g.includes('c')), `a video and an audio recording never share a group, even through an unknown (${JSON.stringify(r.video)})`);
  check(r.video.length === 1, `…the unknown still groups with one of them (${JSON.stringify(r.video)})`);
  check(!r.length.some(g => g.includes('a') && g.includes('c')), `3:00 and 4:30 never share a group, even through an unknown length (${JSON.stringify(r.length)})`);
  check(r.direct.length === 0, 'control: the pair alone never grouped');
  check(r.plain.length === 1 && r.plain[0] === 'a+b+c', `a group with nothing in conflict still forms (${JSON.stringify(r.plain)})`);
  check(r.tierConflict === 'manual', `a group holding a video/audio pair doesn't "hold together" at any cutoff (${r.tierConflict})`);
  check(r.tierPlain === 'normal', `a clean pair still reports its cutoff (${r.tierPlain})`);
});
