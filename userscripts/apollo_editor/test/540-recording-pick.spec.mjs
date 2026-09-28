// #540 (majkinetor): "Apollo auto match seems to get tripped by two releases in this group
// on which tracks 7 and 10 switch places (and also passed visual confirmation)." His
// release group holds two distinct recordings called "Toubaka", of the same length, and
// its editions disagree about where they sit; the old chooser linked whichever came
// first. A recording is auto-linked only when it is the unique winner.
// #541: a position counts as evidence only when the candidate stays at it on every
// edition; a tie prefers a recording no other slot has taken; a real repeat still links.
//
// recPickBest, with the group's real MBIDs; a blank page, nothing fetched.
import { test, check } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const A = { gid: '53cb0616-cde0-4e32-b83a-f686de50577e', name: 'Toubaka', length: 251000 };   // track 7 on the edited release
const B = { gid: 'f8df5b35-ecf5-4e5d-93e2-3032219d33f6', name: 'Toubaka', length: 251000 };   // track 7 on one edition, 10 on another

test('a recording is linked only when it is the unique winner', { tag: ['@unit', '@critical'] }, async ({ page, inject }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const r = await page.evaluate(({ A, B }) => {
    const pick = window.__apolloEditor.recPickBest;
    const track = { title: 'Toubaka', artist: '', length: 251000, artistGids: [] };
    return {
      // the reported case: two same-named, same-length recordings, no position help
      ambiguous: pick([A, B], track, []),
      // the group agrees this slot holds B → that is evidence, so link it
      posBreaksTie: pick([A, B], track, [B.gid]),
      // editions disagree about the slot → still ambiguous, must not link
      posDisagrees: pick([A, B], track, [A.gid, B.gid]),
      // a genuinely different length is evidence too
      lenBreaksTie: pick([A, Object.assign({}, B, { length: 190000 })], track, []),
      // the same recording arriving from several tiers is not a tie
      sameTwice: pick([A, Object.assign({}, A)], track, []),
      // one candidate is the ordinary case and must still link
      single: pick([A], track, []),
  
      // ── #541: a position only counts when the candidate STAYS there ─────────
      // The real index for this group: f8df5b35 sits at 1.7 on one edition and
      // at 1.10 on another. If only the first edition covers slot 1.7, the old
      // rule saw "the group agrees" and picked confidently — and wrongly.
      wanderingPos: (() => {
        const posIndex = new Map([
          ['1.7', [{ gid: B.gid, name: 'Toubaka' }]],
          ['1.10', [{ gid: B.gid, name: 'Toubaka' }]],
        ]);
        return pick([A, B], track, [B.gid], { posIndex });
      })(),
      // …whereas a candidate that sits at one position on every edition is
      // evidence, and still breaks the tie.
      stablePos: (() => {
        const posIndex = new Map([['1.7', [{ gid: B.gid, name: 'Toubaka' }]]]);
        return pick([A, B], track, [B.gid], { posIndex });
      })(),
      // ── #541: don't spend one recording on two slots when there is a choice ──
      avoidsReuse: pick([A, B], track, [], { taken: new Set([A.gid]) }),
      // but a release CAN repeat a recording — one candidate, already used: link it, flagged
      allowsRealRepeat: pick([A], track, [], { taken: new Set([A.gid]) }),
    };
  }, { A, B });

  check(r.ambiguous.ambiguous === true && r.ambiguous.tied.length === 2, 'two same-named, same-length candidates: ambiguous, both named');
  check(r.posBreaksTie.ambiguous === false && r.posBreaksTie.best.gid === B.gid, 'a slot the release group agrees on breaks the tie');
  check(r.posDisagrees.ambiguous === true, 'editions that disagree leave it ambiguous (the #540 case)');
  check(r.lenBreaksTie.ambiguous === false && r.lenBreaksTie.best.gid === A.gid, 'an exactly matching length breaks the tie');
  check(r.sameTwice.ambiguous === false, 'the same recording offered twice is no tie');
  check(r.single.ambiguous === false && r.single.best.gid === A.gid, 'a lone candidate links');
  check(r.wanderingPos.ambiguous === true, '#541: a slot is no evidence when the candidate sits elsewhere on another edition');
  check(r.stablePos.ambiguous === false && r.stablePos.best.gid === B.gid, '#541: a stable position is');
  check(r.avoidsReuse.best.gid === B.gid && r.avoidsReuse.ambiguous === false, '#541: a tie prefers the recording no other slot took');
  check(r.allowsRealRepeat.best.gid === A.gid && r.allowsRealRepeat.reused === true, '#541: a real repeat links, flagged as a reuse');
});
