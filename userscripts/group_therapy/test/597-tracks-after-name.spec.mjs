// #597 follow-up (majkinetor): "Lyricist: Mimmo Epifani (tracks 1-3, 5-11)" went on the
// whole release, credited as "Mimmo Epifani (tracks 1-3, 5-11)": the track clause was
// only looked for in the role, and here it follows the name. The entity is read too now,
// but only for clauses that say "track" — Discogs numbers namesakes "John Smith (2)",
// and that 2 is not a track.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

const eleven = Array.from({ length: 11 }, (_, i) => ({ num: String(i + 1), medium: 1, ordinal: i + 1 }));

test('a track clause after the name is read, a bare number after it is not', { tag: ['@unit'] }, async () => {
  const { txpDetectTracks } = await loadFunctions('group_therapy', ['txpMatchTrackToken', 'txpDetectTracks']);
  const nums = d => d && d.targets ? d.targets.map(r => r.num).join(',') : null;

  const a = txpDetectTracks('Mimmo Epifani (tracks 1-3, 5-11)', eleven, true);
  check(nums(a) === '1,2,3,5,6,7,8,9,10,11', 'tracks 1-3, 5-11 name ten tracks — ' + nums(a));
  check(a && a.clean === 'Mimmo Epifani', 'and the name is left clean — ' + JSON.stringify(a && a.clean));

  const b = txpDetectTracks('Patrizio Trampetti (track 4)', eleven, true);
  check(nums(b) === '4' && b.clean === 'Patrizio Trampetti', 'track 4 — ' + JSON.stringify(b));

  check(txpDetectTracks('John Smith (2)', eleven, true) === null, 'a Discogs-style "(2)" after a name is not a track');
  check(nums(txpDetectTracks('Guitar (2)', eleven)) === '2', 'while in the role a bare "(2)" still is');
});
