// #623 (sweep): Group Therapy's hover highlight matched substrings, so hovering "Bob"
// lit up every "Bobby" (and counted them in the tooltip). Matches are whole words now.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('the hover highlight matches whole words only', { tag: '@unit' }, async () => {
  const { wordHits } = await loadFunctions('group_therapy', ['wordHits']);
  const h = (t, n) => JSON.stringify(wordHits(t.toLowerCase(), n.toLowerCase()));
  check(h('Bob and Bobby', 'Bob') === '[0]', `"Bob" is not found inside "Bobby" (${h('Bob and Bobby', 'Bob')})`);
  check(h('Bob, Bob; bob', 'Bob') === '[0,5,10]', `…but every "Bob" is (${h('Bob, Bob; bob', 'Bob')})`);
  check(h('guitar (electric), guitar', 'guitar') === '[0,19]', 'a role label next to punctuation still matches');
  check(h('(bass) and (bass guitar)', '(bass)') === '[0]', 'a needle with punctuation at its edges needs no boundary there');
  check(h('Sigur Rós and Rósa', 'Rós') === '[6]', `letters outside ASCII count as letters (${h('Sigur Rós and Rósa', 'Rós')})`);
  check(h('track 12', '1') === '[]', 'a digit inside a number is not a hit');
});
