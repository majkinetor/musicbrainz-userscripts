// #623 (sweep): when an import couldn't place an ISRC by position, it fell back to the
// FIRST track whose title passed titleClose — which tolerates two trailing words. So
// "Song (Live)"'s ISRC landed on "Song", and a second "Intro" on the first one, with
// nothing on the row saying it was only a title guess.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('the title fallback prefers an exact title and never guesses between equals', { tag: '@unit' }, async () => {
  const F = await loadFunctions('isrc_scout', ['norm', 'wordsMatch', 'unfeat', 'mainArtist', 'titleClose', 'artistClose', 'isGoodMatch', 'pickTrackByTitle']);
  const tracks = [{ title: 'Song', artist: 'A' }, { title: 'Song (Live)', artist: 'A' }, { title: 'Intro', artist: 'A' }, { title: 'Other', artist: 'A' }, { title: 'Intro', artist: 'A' }];
  const pick = title => F.pickTrackByTitle({ title, artist: 'A' }, tracks);
  // what the old rule did: the first track passing isGoodMatch
  const old = title => tracks.findIndex(t => F.isGoodMatch(title, 'A', t.title, t.artist));

  check(old('Song (Live)') === 0, 'the old rule put "Song (Live)" on "Song" (reproduces)');
  check(pick('Song (Live)').idx === 1 && !pick('Song (Live)').loose, `now it goes to "Song (Live)" itself (${JSON.stringify(pick('Song (Live)'))})`);
  check(pick('Song').idx === 0, 'and "Song" still to "Song"');
  check(pick('Intro').idx === -1 && pick('Intro').ambiguous === 2, `two tracks called "Intro": no guess (${JSON.stringify(pick('Intro'))})`);
  const onlyLoose = F.pickTrackByTitle({ title: 'Other (Remastered)', artist: 'A' }, tracks);
  check(onlyLoose.idx === 3 && onlyLoose.loose === true, `a match on a looser title only is taken, flagged as loose (${JSON.stringify(onlyLoose)})`);
  check(pick('Nothing Alike').idx === -1 && !pick('Nothing Alike').ambiguous, 'no match is no match');
});
