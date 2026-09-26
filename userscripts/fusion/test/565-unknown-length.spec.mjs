// #565 (majkinetor) — "Recordings with identical titles except the capitalization
// are not pooled and matched in normal mode. Had to downgrade to loose mode to get
// any auto-match results at all."
//
// Capitalisation was never the problem: normName() lower-cases, so "Ich bleibe /
// Ihr bleibt" and "ICH BLEIBE / IHR BLEIBT" are already an exact title match, and
// so is "23" vs "23" — which also formed no group, and no amount of case-folding
// explains that.
//
// The actual cause: pairSignals had two length states where it needed three.
// `sig.length` was false both when the lengths DISAGREE and when there is no
// length to compare, and the normal cutoff required `sig.length` to be true. One
// of his two releases carries no lengths at all (`length=—` for all 18), so
// "we can't tell" behaved exactly like "they disagree" and normal formed zero
// groups. The pairSignals comment already said unknown "just means we can't
// tell" — shouldUnion was the half that disagreed.
//
// Pure functions only, driven through window.__fusion. No network, no merges.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', xhr: 'none' } });

test('an unknown length is its own state, so normal matches a release that has no lengths', { tag: '@sandbox' }, async ({ page, inject }) => {
  const postUrls = [];
  await page.route(() => true, r => { const q = r.request(); if (q.method() === 'POST') { postUrls.push(q.url()); return r.abort(); } return r.continue(); });
  await page.goto('https://test.musicbrainz.org/release-group/1279bc2b-8c89-4f68-b233-38fc9f04f8d4', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await inject('fusion', { waitFor: '__fusion' });
  const run = (source) => page.evaluate(() => {
    const F = window.__fusion;
    const rec = (o) => Object.assign({ gid: o.gid, title: o.title, artistCredit: 'Katakomben', length: null, isrcs: [], acoustids: [], video: false, editsPending: false, releases: [] }, o);

    // his pool, reduced to the pairs that matter: one release with no lengths at
    // all, one with lengths, titles differing only in case (and one identical)
    const noLen = [
      rec({ gid: 'a1', title: 'Ich bleibe / Ihr bleibt' }),
      rec({ gid: 'a2', title: '23' }),
      rec({ gid: 'a3', title: 'Laborratte' }),
    ];
    const withLen = [
      rec({ gid: 'b1', title: 'ICH BLEIBE / IHR BLEIBT', length: 139000, acoustids: ['57e4975e-89d7-4ad9-827d-c1657c1cbfb3'] }),
      rec({ gid: 'b2', title: '23', length: 188000, acoustids: ['cdc020f6-dd5d-405a-9cf3-3c0670c90980'] }),
      rec({ gid: 'b3', title: 'LABORRATTE', length: 175000, acoustids: ['784d3062-0e87-4d1b-9243-8725d679c0a6'] }),
    ];
    const pool = [...noLen, ...withLen];
    const out = {};

    // titles: case alone is not, and never was, the obstacle
    out.caseIsExactTitleMatch = F.titleSimilar('Ich bleibe / Ihr bleibt', 'ICH BLEIBE / IHR BLEIBT');
    out.identicalTitleMatches = F.titleSimilar('23', '23');

    const sigUnknown = F.pairSignals(noLen[0], withLen[0], 5000);
    out.sigLengthUnknown = sigUnknown.lengthUnknown;
    out.sigLengthFalse = sigUnknown.length;
    out.sigNotConflict = sigUnknown.lengthConflict;
    out.sigTitle = sigUnknown.title;
    out.sigArtist = sigUnknown.artist;

    out.normalGroups = F.autoMatch(pool, 5000, 'normal').length;
    out.looseGroups = F.autoMatch(pool, 5000, 'loose').length;
    out.strictGroups = F.autoMatch(pool, 5000, 'strict').length;
    out.normalSignals = (F.autoMatch(pool, 5000, 'normal')[0] || {}).signals || [];

    // ── the guard rails must survive ──────────────────────────────────────────
    // both lengths KNOWN and not close: still refused at normal
    const k1 = rec({ gid: 'k1', title: 'Same Title', length: 180000 });
    const k2 = rec({ gid: 'k2', title: 'Same Title', length: 195000 });
    out.knownDifferentStillBlocked = F.autoMatch([k1, k2], 5000, 'normal').length === 0;
    // grossly different, one unknown -> can't be a conflict, but also not gross
    const g1 = rec({ gid: 'g1', title: 'Same Title', length: 60000 });
    const g2 = rec({ gid: 'g2', title: 'Same Title', length: 300000 });
    out.grossStillBlocked = F.autoMatch([g1, g2], 5000, 'normal').length === 0;
    // a different ARTIST is still required at normal, unknown length or not
    const d1 = rec({ gid: 'd1', title: 'Same Title', artistCredit: 'Alpha' });
    const d2 = rec({ gid: 'd2', title: 'Same Title', artistCredit: 'Completely Other Band' });
    out.artistStillRequired = F.autoMatch([d1, d2], 5000, 'normal').length === 0;
    // and a video/audio pair is still refused outright
    const v1 = rec({ gid: 'v1', title: 'Same Title', video: false });
    const v2 = rec({ gid: 'v2', title: 'Same Title', video: true });
    out.videoStillBlocked = F.autoMatch([v1, v2], 5000, 'normal').length === 0;
    // title+length with NO artist must still be a loose-only match (#529's rule)
    const t1 = rec({ gid: 't1', title: 'Shared Title', artistCredit: 'Alpha', length: 180000 });
    const t2 = rec({ gid: 't2', title: 'Shared Title', artistCredit: 'Zeta Different', length: 180000 });
    out.titleLenOnlyStillNormalReject = F.autoMatch([t1, t2], 5000, 'normal').length === 0;
    out.titleLenOnlyStillLooseAccept = F.autoMatch([t1, t2], 5000, 'loose').length === 1;
    return out;
  });

  const r = await run();
  console.log(JSON.stringify(r, null, 1));

  check(r.caseIsExactTitleMatch, 'capitalisation was never the obstacle — normName lower-cases, so the titles already matched exactly');
  check(r.identicalTitleMatches, 'and "23" vs "23" matched too, which no case rule could explain');
  check(r.sigTitle && r.sigArtist, 'the pair has both title and artist signals');
  check(r.sigLengthUnknown === true, '#565: an absent length is reported as lengthUnknown');
  check(r.sigLengthFalse === false, 'and NOT as a length match');
  check(r.sigNotConflict === false, 'and not as a conflict either — "we cannot tell" is its own state');
  check(r.normalGroups === 3, `#565: normal now forms all 3 groups from his pool (${r.normalGroups}) — it formed 0 before`);
  check(r.looseGroups === 3, `loose still forms them too (${r.looseGroups})`);
  check(r.strictGroups === 0, `strict still forms none — no shared identifier (${r.strictGroups})`);
  check(!r.normalSignals.includes('length'), 'and the group does NOT claim a length signal it never had — ' + JSON.stringify(r.normalSignals));

  console.log('\n── guard rails ──');
  check(r.knownDifferentStillBlocked, 'two KNOWN lengths that disagree are still refused at normal');
  check(r.grossStillBlocked, 'a gross length difference is still refused');
  check(r.artistStillRequired, 'a different artist is still refused at normal, unknown length or not');
  check(r.videoStillBlocked, 'a video/audio pair is still refused outright');
  check(r.titleLenOnlyStillNormalReject, 'title+length without a matching artist is still normal-rejected (#529)');
  check(r.titleLenOnlyStillLooseAccept, '…and still loose-accepted');

  // MusicBrainz's own page posts Sentry telemetry; only a merge would be ours.
  console.log('POSTs (all aborted): ' + JSON.stringify(postUrls));
  check(!postUrls.some(u => /musicbrainz\.org\/(recording\/merge|merge)/.test(u)), `no merge was submitted (${postUrls.length} POST(s), all aborted)`);
});
