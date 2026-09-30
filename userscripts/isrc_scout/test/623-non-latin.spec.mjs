// #623 (sweep, X10): ISRC Scout's norm kept only [a-z0-9 ], reducing a mixed-script
// title to its Latin fragments — "Love ~夜~" and "Love ~朝~" compared equal, so a
// title-matched ISRC could land on the wrong track.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('titles that differ only in non-Latin text are different titles', { tag: '@unit' }, async () => {
  const { norm, titleClose } = await loadFunctions('isrc_scout', ['norm', 'unfeat', 'titleClose']);
  check(norm('Love ~夜~') === 'love 夜', `norm keeps the non-Latin part (${JSON.stringify(norm('Love ~夜~'))})`);
  check(titleClose('Love ~夜~', 'Love ~朝~') === false, 'Love ~夜~ is not Love ~朝~');
  check(titleClose('夜に駆ける', '夜に駆ける') === true, 'identical Japanese titles are close');
  check(titleClose('Кино', 'Кино') === true, 'identical Cyrillic titles are close');
  check(titleClose('Café', 'Cafe') === true, 'Latin diacritics still fold');
});
