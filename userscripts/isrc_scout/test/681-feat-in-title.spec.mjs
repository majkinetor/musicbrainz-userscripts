// #681: MusicBrainz moves a title's "feat." into the artist credit, so Bandcamp's "Letter From The
// Space Feat. Tinavie (Long Arm Remix)" is MusicBrainz's "Letter From The Space (Long Arm Remix)".
// Find links' position guard turned it away. Apostrophes differ between databases as well.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('#681: a "feat." moved out of the title, and apostrophes, still match', { tag: '@unit' }, async () => {
  const F = await loadFunctions('isrc_scout', ['norm', 'unfeat', 'wordTypo', 'titleClose', '_nrm', '_sameTitle']);
  check(F.unfeat('Letter From The Space Feat. Tinavie (Long Arm Remix)') === 'Letter From The Space (Long Arm Remix)', `a bare feat. ends at the bracket (${F.unfeat('Letter From The Space Feat. Tinavie (Long Arm Remix)')})`);
  check(F.unfeat('Instant Crush (feat. Julian Casablancas)') === 'Instant Crush' && F.unfeat('Song ft. X') === 'Song', 'the bracketed and the trailing forms still go');
  check(F._sameTitle('Letter From The Space Feat. Tinavie (Long Arm Remix)', 'Letter From The Space (Long Arm Remix)'), "Find links' position guard: the same song");
  check(F._sameTitle("Don’t Stop", "Don't Stop") && F._sameTitle('Dont Stop', "Don't Stop"), 'apostrophes join their letters');
  check(F.titleClose('Letter From The Space Feat. Tinavie (Long Arm Remix)', 'Letter From The Space (Long Arm Remix)') === true, 'the import title check agrees');
  check(!F._sameTitle('Letter From The Space (Long Arm Remix)', 'Letter From The Moon (Long Arm Remix)'), 'another title is still another song');
});
