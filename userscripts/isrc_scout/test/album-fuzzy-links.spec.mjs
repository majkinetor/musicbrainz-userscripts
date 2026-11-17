import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('album link fallback requires position, title, length and an unambiguous match', { tag: '@unit' }, async () => {
  const { albumFuzzyAt } = await loadFunctions('isrc_scout', ['sameWriting', 'wordTypo', 'unfeat', '_nrm', '_sameTitle', 'durToSec', 'albumFuzzyTitle', 'albumFuzzyAt']);
  const track = { title: 'Nounignon Ma Kpon Midji', dur: '5:54' };
  const song = { title: 'Nounignon Ma Klon Midji', len: 353 };
  check(albumFuzzyAt([song], track, 0, [track]), 'Kpon and Klon at the same position and length match');
  check(albumFuzzyAt([{ ...song, title: 'Antoine Dougbé - Nounignon Ma Klon Midji' }], track, 0, [track]), 'Bandcamp compilation artist prefix is accepted');
  check(!albumFuzzyAt([song], track, 1, [track]), 'a shifted track is not guessed');
  check(!albumFuzzyAt([{ ...song, len: 340 }], track, 0, [track]), 'different length is rejected');
  check(!albumFuzzyAt([{ ...song, len: null }], track, 0, [track]), 'missing length is rejected');
  check(!albumFuzzyAt([song, song], track, 0, [track]), 'duplicate provider candidates are rejected');
  check(!albumFuzzyAt([song], track, 0, [track, { ...track }]), 'duplicate MusicBrainz candidates are rejected');
  check(!albumFuzzyAt([{ title: 'Nounignon Ma Klon Other', len: 353 }], track, 0, [track]), 'two changed words are rejected');
  check(!albumFuzzyAt([{ title: 'Live Forever', len: 353 }], { title: 'Love Forever', dur: '5:54' }, 0, [{ title: 'Love Forever' }]), 'short ambiguous titles are rejected');
});
