// #623 (sweep, X10): Platform Check's normName and searchTerms kept only [a-z0-9],
// so a non-Latin release searched for an empty query, and scoring never got a title
// or artist signal (the artist-mismatch penalty always fired) — non-Latin releases
// were never found by search.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('non-Latin titles survive normalisation and search terms', { tag: '@unit' }, async () => {
  const { normName, searchTerms } = await loadFunctions('platform_check', ['normName', 'searchTerms']);
  check(normName('夜に駆ける') === '夜に駆ける', `normName keeps Japanese (${JSON.stringify(normName('夜に駆ける'))})`);
  check(normName('Кино') === 'кино', `…and Cyrillic, lower-cased (${JSON.stringify(normName('Кино'))})`);
  check(normName('ザ・ブック') === 'ザ ブック', `…with voiced kana intact (${JSON.stringify(normName('ザ・ブック'))})`);
  check(normName('Café Tacvba!') === 'cafe tacvba', `Latin still folds as before (${JSON.stringify(normName('Café Tacvba!'))})`);
  check(searchTerms('ザ・ブック') === 'ザ ブック', `a Japanese search query isn't empty (${JSON.stringify(searchTerms('ザ・ブック'))})`);
  check(searchTerms('Кино: Группа крови') === 'Кино Группа крови', `a Cyrillic one keeps its words and case (${JSON.stringify(searchTerms('Кино: Группа крови'))})`);
  check(searchTerms('Space Echo: The Mystery…!') === 'Space Echo The Mystery', `Latin punctuation still goes (${JSON.stringify(searchTerms('Space Echo: The Mystery…!'))})`);
});
