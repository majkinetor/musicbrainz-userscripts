// #760 (ernstlx, forum): different tracks with near-identical titles were merged
// at the normal cutoff. Both edits, read on production before changing anything:
//
//   #155512934  "In Volo - Drift" 1:52, "In Volo - Grain" 1:53 into "In Volo - Trace" 1:56
//               ISRCs QZTRX2699407, QZTRX2699409 into QZTRX2699406 (one artist)
//   #155486365  "Dwell IV" 9:20 into "Dwell I" 9:20
//               ISRCs GBSMU9781309 into GBSMU9781306 (one artist)
//
// "In Volo - Drift" / "In Volo - Trace" share 2 of 3 words (the 60% bar), and
// "Dwell I" / "Dwell IV" are 92% alike by characters (the 85% bar), so the title
// signal held and title + artist + length met `normal`. Two guards, either of
// which refuses each case on its own: a word on EACH side that the other lacks
// (not a mix/edit qualifier, not a typo) means different titles; and two
// recordings whose ISRCs share none but come from one registrant and year are
// different tracks of one batch. The refusals matter as much as the blocks: the
// mix/edit spellings majkinetor said are legitimately the same must still match.
//
// Pure functions against a stub page — no network, nothing submitted.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Fusion', xhr: 'none' } });

const ARTIST = '11111111-2222-4333-8444-555555555555';

test('near-identical titles of different tracks do not group', { tag: '@unit' }, async ({ page, context, inject }) => {
  // Fusion returns early on a page it doesn't recognise, so serve a stub at one it does
  await context.route(/musicbrainz\.org/, r =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/0ece1e80-fa3e-4fc8-8aec-c54003084bb3', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });

  // recs: [title, length ms, isrcs]; returns the groups as sorted title lists
  const groups = (recs, cutoff) => page.evaluate(([recs, cutoff, artist]) => {
    const F = window.__fusion;
    const pool = recs.map(([title, length, isrcs], i) => F.mkRecording('aaaaaaaa-0000-4000-8000-' + String(i).padStart(12, '0'), {
      title, length, isrcs, artistCredit: 'Aiuole', artistGid: artist, artistGids: [artist],
      video: false, releases: [{ title: 'R' }], isrcsKnown: true,
    }));
    const byGid = new Map(pool.map(r => [r.gid, r.title]));
    return F.autoMatch(pool, 5000, cutoff).map(g => g.memberGids.map(x => byGid.get(x)).sort());
  }, [recs, cutoff, ARTIST]);
  const similar = (a, b) => page.evaluate(([a, b]) => window.__fusion.titleSimilar(a, b), [a, b]);

  await test.step('edit #155512934: "In Volo - Drift / Grain / Trace"', async () => {
    const withIsrcs = [['In Volo - Drift', 112000, ['QZTRX2699407']], ['In Volo - Grain', 113000, ['QZTRX2699409']], ['In Volo - Trace', 116000, ['QZTRX2699406']]];
    for (const cutoff of ['normal', 'loose']) {
      const g = await groups(withIsrcs, cutoff);
      check(g.length === 0, `not grouped at ${cutoff} (got ${JSON.stringify(g)})`);
    }
    const noIsrcs = withIsrcs.map(([t, l]) => [t, l, []]);
    const g = await groups(noIsrcs, 'loose');
    check(g.length === 0, `not grouped at loose on the titles alone, without ISRCs (got ${JSON.stringify(g)})`);
    check(!(await similar('In Volo - Drift', 'In Volo - Trace')), '"In Volo - Drift" and "In Volo - Trace" are not similar titles');
  });

  await test.step('edit #155486365: "Dwell IV" into "Dwell I"', async () => {
    const recs = [['Dwell IV', 560000, ['GBSMU9781309']], ['Dwell I', 560000, ['GBSMU9781306']]];
    const g = await groups(recs, 'normal');
    check(g.length === 0, `not grouped at normal (got ${JSON.stringify(g)})`);
    const g2 = await groups(recs.map(([t, l]) => [t, l, []]), 'loose');
    check(g2.length === 0, `not grouped at loose on the titles alone (got ${JSON.stringify(g2)})`);
    check(!(await similar('Part 1', 'Part 2')), '"Part 1" and "Part 2" are not similar titles');
  });

  await test.step('ISRCs from one batch keep identical titles apart', async () => {
    const g = await groups([['Interlude', 60000, ['QZTRX2699407']], ['Interlude', 60000, ['QZTRX2699409']]], 'normal');
    check(g.length === 0, `same title, ISRCs from one registrant and year, none shared: not grouped (got ${JSON.stringify(g)})`);
    // a recording with no ISRC must not bridge the two into one group
    const b = await groups([['Interlude', 60000, ['QZTRX2699407']], ['Interlude', 60000, []], ['Interlude', 60000, ['QZTRX2699409']]], 'normal');
    check(!b.some(x => x.length === 3), `a recording without an ISRC does not bridge them (got ${JSON.stringify(b)})`);
  });

  await test.step('what must still match', async () => {
    for (const [a, b] of [
      // the guard only takes matches away; these pass the old bars and must keep passing
      ['Long Song Title (Original Mix)', 'Long Song Title'],
      ['Song - Radio Edit', 'Song (Radio Edit)'],
      ['Song (Extended Mix)', 'Song (Extended Version)'],
      ['Song - Remastered 2011', 'Song (2011 Remaster)'],
      ['Song (Radio Edit)', 'Song (Radio Mix)'],
      ['Oburumankoma', 'Oburumakoma'],
      ['Rock & Roll', 'Rock and Roll'],
    ]) check(await similar(a, b), `"${a}" and "${b}" are still similar`);
    const reissue = await groups([['Song', 200000, ['USUM70000001']], ['Song', 201000, ['GBAYE0000001']]], 'normal');
    check(reissue.length === 1, `different ISRCs from different registrants still group on title (got ${JSON.stringify(reissue)})`);
    const year = await groups([['Song', 200000, ['USUM70000001']], ['Song', 201000, ['USUM71000001']]], 'normal');
    check(year.length === 1, `one registrant, different years still group (got ${JSON.stringify(year)})`);
    const shared = await groups([['In Volo - Drift', 112000, ['QZTRX2699407']], ['In Volo - Trace', 113000, ['QZTRX2699407', 'QZTRX2699406']]], 'strict');
    check(shared.length === 1, `a shared ISRC still groups, whatever the titles (got ${JSON.stringify(shared)})`);
  });
});
