// #661 (majkinetor): "typo in track name prevents links to be added". MusicBrainz has "Les Escrocs",
// Tidal, Apple and Qobuz "Les Ecrocs": All called Tidal's song another song, and Find links added
// no Apple, Spotify or YouTube Music link, whose position match checks the title.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('a typo in a title is the same song, but only as a warning', { tag: ['@unit', '@critical'] }, async () => {
  const { wordTypo, titleClose, isGoodMatch, classifyLike } = await loadFunctions('isrc_scout',
    ['norm', 'unfeat', 'mainArtist', 'wordsMatch', 'wordTypo', 'titleClose', 'artistClose', 'isGoodMatch', 'durToSec']).then(f => Object.assign(f, {
    // SX.classify's title steps (it lives inside the SX module): another song, or best/warn
    classifyLike: (a, b) => !f.isGoodMatch(a, 'X', b, 'X') ? 'other' : f.titleClose(a, b, true) !== true ? 'warn' : 'best',
  }));
  check(titleClose('Les Ecrocs', 'Les Escrocs') === true, 'Les Ecrocs reads as Les Escrocs');
  check(titleClose('Les Ecrocs', 'Les Escrocs', true) === false, 'but not when spelled exactly');
  check(classifyLike('Les Ecrocs', 'Les Escrocs') === 'warn', 'All: the same song, noted, not a sure match');
  check(classifyLike('Les Escrocs', 'Les Escrocs') === 'best', 'the exact title is still a sure match');
  check(isGoodMatch('Sunset Comign On', 'X', 'Sunset Coming On', 'X'), 'two letters swapped');
  check(wordTypo('colour', 'color') && wordTypo('recieve', 'receive'), 'a dropped letter, a swap');
  for (const [a, b] of [['Love', 'Live'], ['Heart', 'Start'], ['Motherhood', 'Brotherhood']])
    check(titleClose(a, b) === false, `"${a}" is still another song than "${b}"`);
  check(titleClose('Sunset Coming', 'Sunsat Comong') === true, 'a typo in each word');
  check(titleClose('Sunset Coming', 'Sunsaat Coming') === false, 'two letters off in one word is too many');
});

test('Find links: a position match agrees with a typo in the title', { tag: ['@unit', '@critical'] }, async () => {
  const { _sameTitle } = await loadFunctions('isrc_scout', ['wordTypo', 'unfeat', '_nrm', '_sameTitle']);
  check(_sameTitle('Les Ecrocs', 'Les Escrocs'), 'Apple\'s Les Ecrocs is track 16, Les Escrocs');
  check(_sameTitle('Les Escrocs (Remastered)', 'Les Escrocs'), 'a version tag still fits');
  check(!_sameTitle('Live Forever', 'Love Forever'), 'a short word one letter off is another title');
  check(!_sameTitle('Les Escrocs', 'Ko Kan Ko Sata Doumbia on River'), 'another track is not');
});
