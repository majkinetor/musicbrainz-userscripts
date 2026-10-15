// "Above & Beyond" and "Samba With JC" on Spotify are MusicBrainz's "Above and Beyond" and "Samba
// With J.C." (LTJ Bukem's "Earth, Volume One"): Find links added no Spotify link to either, and the
// Spotify fills were flagged implausible. "&" is "and", and dotted initials are one word.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('"&" and dotted initials are the same title', { tag: ['@unit', '@critical'] }, async () => {
  const { _sameTitle, isGoodMatch } = await loadFunctions('isrc_scout',
    ['sameWriting', 'norm', 'unfeat', 'mainArtist', 'wordsMatch', 'wordTypo', 'titleClose', 'artistClose', 'isGoodMatch', '_nrm', '_sameTitle']);
  check(_sameTitle('Above & Beyond', 'Above and Beyond'), 'Find links: Above & Beyond is Above and Beyond');
  check(_sameTitle('Samba With JC', 'Samba With J.C.'), 'Find links: Samba With JC is Samba With J.C.');
  check(isGoodMatch('Above & Beyond', 'X', 'Above and Beyond', 'X'), 'a fill: Above & Beyond is Above and Beyond');
  check(isGoodMatch('Samba With JC', 'X', 'Samba With J.C.', 'X'), 'a fill: Samba With JC is Samba With J.C.');
  check(!_sameTitle('Samba With J.C.', 'Samba With Jo'), 'initials are not another word');
});
