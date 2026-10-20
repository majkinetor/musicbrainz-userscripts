// #597 follow-up (majkinetor): "Lyricist: Mimmo Epifani (tracks 1-3, 5-11)" went on the
// whole release, credited as "Mimmo Epifani (tracks 1-3, 5-11)": the track clause was
// only looked for in the role, and here it follows the name. The entity is read too now,
// a bare "(2)" included: the text parser takes it as a track, and a Discogs namesake
// "John Smith (2)" is fixed by hand. explicitOnly (Copy's credited-as names) still
// takes only clauses that say "track".
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

const eleven = Array.from({ length: 11 }, (_, i) => ({ num: String(i + 1), medium: 1, ordinal: i + 1 }));

test('a track clause after the name is read, a bare number too', { tag: ['@unit'] }, async () => {
  const { txpDetectTracks } = await loadFunctions('group_therapy', ['txpMatchTrackToken', 'txpDetectTracks']);
  const nums = d => d && d.targets ? d.targets.map(r => r.num).join(',') : null;

  const a = txpDetectTracks('Mimmo Epifani (tracks 1-3, 5-11)', eleven);
  check(nums(a) === '1,2,3,5,6,7,8,9,10,11', 'tracks 1-3, 5-11 name ten tracks — ' + nums(a));
  check(a && a.clean === 'Mimmo Epifani', 'and the name is left clean — ' + JSON.stringify(a && a.clean));

  const b = txpDetectTracks('Patrizio Trampetti (track 4)', eleven);
  check(nums(b) === '4' && b.clean === 'Patrizio Trampetti', 'track 4 — ' + JSON.stringify(b));

  const c = txpDetectTracks('Jerry Ross (1)', eleven);
  check(nums(c) === '1' && c.clean === 'Jerry Ross', 'a bare "(1)" after a name is track 1 — ' + JSON.stringify(c));
  check(txpDetectTracks('Jerry Ross (2003)', eleven) === null, 'a number that is no track stays in the name');
  check(txpDetectTracks('John Smith (2)', eleven, true) === null, 'explicitOnly still refuses a bare "(2)"');
});
