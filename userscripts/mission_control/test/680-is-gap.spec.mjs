// ISRC Scout: a source that numbers around tracks it doesn't carry (Apple, Artist's Choice: The
// Eddie Harris Anthology: 1.8 then 1.10, when 1.9 isn't sold in the storefront) shifts each later
// position onto the next song. Such an ISRC goes to the one track with its title and a length that
// fits; a retitle at the right position stays by position; a position fill that is another song
// with no title to go by stays, and Mission Control reads it as unsure.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';   // sandbox copy of Mocky's "Music Will Explain"

test('ISRC Scout: a gap in the source\'s numbering goes by title', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('isrc_scout', { waitFor: '__isTest680' });
  await page.waitForFunction(() => (window.__isTest680.release()?.tracks || []).length >= 3, null, { timeout: 30_000 });

  const r = await page.evaluate(() => {
    const h = window.__isTest680, ts = h.release().tracks;
    const sec = d => { const m = String(d).split(':'); return m[0] * 60 + +m[1]; };
    // a track whose next one differs in length by more than the tolerance
    const i = ts.findIndex((t, k) => ts[k + 1] && +ts[k + 1].mediumPos === +t.mediumPos && Math.abs(sec(t.dur) - sec(ts[k + 1].dur)) > 15);
    if (i < 0) return null;
    const t = ts[i], src = (o) => Object.assign({ disc: t.mediumPos, artist: t.artist, isrc: 'XX0000000001' }, o);
    return {
      i,
      shifted: h.trackForSource(src({ pos: +t.trackPos + 1, title: t.title, dur: t.dur })),
      retitled: h.trackForSource(src({ pos: +t.trackPos, title: t.title + ' (Album Version)', dur: t.dur })),
      other: h.trackForSource(src({ pos: +t.trackPos + 1, title: 'Nothing Like It At All', dur: t.dur })),
      mcOther: h.mcTrackOf(src({ pos: +t.trackPos + 1, title: 'Nothing Like It At All', dur: t.dur })),
      mcRight: h.mcTrackOf(src({ pos: +t.trackPos, title: t.title, dur: t.dur })),
    };
  });
  console.log(JSON.stringify(r));
  test.skip(!r, 'no two neighbouring tracks of different lengths on this fixture');
  check(r.shifted.idx === r.i && !r.shifted.byPos, `a song one position late goes to its own track by title (${JSON.stringify(r.shifted)})`);
  check(r.retitled.idx === r.i && r.retitled.byPos, 'a retitle at its own position stays by position');
  check(r.other.idx === r.i + 1 && r.other.byPos, 'another song with no title to go by stays at its position');
  check(r.mcOther.idx === r.i + 1 && /length differs/.test(r.mcOther.why || ''), `and Mission Control reads it as unsure (${r.mcOther.why})`);
  check(r.mcRight.idx === r.i && !r.mcRight.why, 'a fitting position fill is sure');
});
