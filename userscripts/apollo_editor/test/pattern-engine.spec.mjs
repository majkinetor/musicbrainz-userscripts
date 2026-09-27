// #456, #520, #522: the Track parser's pattern engine, on the shipped code.
// Grammar: tokens # T A L M (+ _ skip), $X explicit, X[slice] positional; separators
// match any of a list, literals are literal, whitespace is elastic, text fields split on
// the first separator except the last, which is greedy.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('the pattern engine', { tag: ['@unit', '@critical'] }, async () => {
  const { tpCompile } = await loadFunctions('apollo_editor', ['TP_FIELDS', 'TP_DUR', 'TP_SEPS', 'tpEsc', 'tpUsable', 'tpTokenize', 'tpCompile']);
  const eq = (got, exp, msg) => check(JSON.stringify(got) === JSON.stringify(exp), `${msg} (got ${JSON.stringify(got)})`);
  const P = (pat, line, opts) => tpCompile(pat, opts).exec(line);

  // majkinetor's examples
  eq(P('#. T', '1. So What'), { pos: '1', title: 'So What' }, 'ex1  #. T');
  eq(P('$#. $T', '1. So What'), { pos: '1', title: 'So What' }, 'ex2  $#. $T (explicit ≡ bare)');
  eq(P('# A - T (L)', '1 Miles Davis - So What (9:22)'), { pos: '1', artist: 'Miles Davis', title: 'So What', length: '9:22' }, 'ex3  # A - T (L)');
  eq(P('# A - T (_', '1 Miles Davis - So What (original edit)'), { pos: '1', artist: 'Miles Davis', title: 'So What' }, 'ex4  trailing (_  skips the paren tail');

  // split-on-first: artist ends at the first separator, title takes the rest
  eq(P('# A - T', '1 Miles Davis - So What - Take 1'), { pos: '1', artist: 'Miles Davis', title: 'So What - Take 1' }, 'split on first separator');
  // split-on-last (#456 v2 ‹first|last›): artist takes up to the LAST separator
  eq(P('# A - T', '1 Miles Davis - So What - Take 1', { splitLast: true }), { pos: '1', artist: 'Miles Davis - So What', title: 'Take 1' }, 'split on last separator (splitLast)');

  // separator list: one pattern, dash/slash/colon/en-dash variants
  eq(P('# A - T', '1 Miles Davis – So What'), { pos: '1', artist: 'Miles Davis', title: 'So What' }, 'sep: en-dash matches the literal -');
  eq(P('# A - T', '1 Miles Davis / So What'), { pos: '1', artist: 'Miles Davis', title: 'So What' }, 'sep: slash matches');
  eq(P('# A - T', '1 Miles Davis : So What'), { pos: '1', artist: 'Miles Davis', title: 'So What' }, 'sep: colon matches');
  // #520 (majkinetor, live): his source used U+2010 HYPHEN (‐) as the artist/
  // title separator, distinct from plain ASCII `-` (U+002D). Typing the exact
  // ‐ character in the pattern happened to match by literal coincidence, but
  // the natural, easiest-to-type `-` didn't — U+2010 wasn't in the separator
  // class it expands to.
  eq(P('#. A - T - _ (L)', '2. Caleb Sweetback ‐ Zion Here I Come - Various Artists (4:18)'), { pos: '2', artist: 'Caleb Sweetback', title: 'Zion Here I Come', length: '4:18' }, 'sep: U+2010 HYPHEN matches a plain - in the pattern (#520)');

  // elastic whitespace + zero-padded pos
  eq(P('#. T', '01.   So What'), { pos: '01', title: 'So What' }, 'elastic ws + padded #');

  // title-only / length-only patterns (only capture declared fields)
  eq(P('T L', 'Blue in Green   5:37'), { title: 'Blue in Green', length: '5:37' }, 'T L  title + trailing length');

  // $-glued token + literal word that starts with a token letter stays literal
  eq(P('Track: $T', 'Track: So What'), { title: 'So What' }, '$T after literal "Track:"');
  eq(P('Disc$M. #. T', 'Disc2. 5. So What'), { medium: '2', pos: '5', title: 'So What' }, 'Disc$M glued medium token');

  // vinyl-side position
  eq(P('# T', 'A1  So What'), { pos: 'A1', title: 'So What' }, 'vinyl side position A1');

  // slice-mode: fixed-width, no delimiters
  eq(P('#[1-2] T[4-]', '01 So What'), { pos: '01', title: 'So What' }, 'slices: pos 1-2, title 4-end');
  eq(P('T[9-]', '[bonus] So What'), { title: 'So What' }, 'slice: title from 9th char');
  eq(P('T[~5-]', 'So What Blue'), { title: 'Blue' }, 'slice: last 5 chars from end (trimmed)');
  // slice-to-delimiter [a:X] — from position a up to (excluding) the first X
  eq(P('#[1:.] T', '12. So What'), { pos: '12', title: 'So What' }, 'slice-to-delim: #[1:.] up to the first dot');
  eq(P('#[1:-]T', '007-So What'), { pos: '007', title: 'So What' }, 'slice-to-delim: #[1:-] up to the first dash');
  eq(P('#[1: ]T', '42 So What'), { pos: '42', title: 'So What' }, 'slice-to-delim: #[1: ] up to the first space');
  eq(P('A[1:(]', 'Miles Davis (feat. X)'), { artist: 'Miles Davis' }, 'slice-to-delim: A[1:(] up to the first paren');
  // char-START slice [X:Y] — from the first X to the first Y, excluding both
  eq(P('L[(:)]', 'So What (9:22)'), { length: '9:22' }, 'char-start slice: L[(:)] between parens');
  eq(P('# T L[(:)]', '1 So What (9:22)'), { pos: '1', title: 'So What', length: '9:22' }, 'char-start slice mixed in a flow pattern');
  eq(P('A[-:(]', 'Foo - Bar (x)'), { artist: 'Bar' }, 'char-start slice: A[-:(] from the dash to the paren');
  // ~ as "last occurrence" on a char delimiter (#456 round 5) — a title with its OWN "(...)" before the
  // real "(length)" needs the LAST "(" ; without ~ the first "(" wrongly grabs the title's parenthetical.
  eq(P('L[(:)]', 'Hide Me (Bop remix) - Stillhead (4:20)'), { length: 'Bop remix' }, 'plain [(:)] grabs the FIRST paren (wrong here) — the bug majkinetor hit');
  eq(P('L[~(:)]', 'Hide Me (Bop remix) - Stillhead (4:20)'), { length: '4:20' }, '~( fixes it: last "(" to its ")"');
  eq(P('L[~(:)]', 'So What (9:22)'), { length: '9:22' }, '~( still works with only one paren pair');
  eq(P('# T L[~(:)]', '1 Hide Me (Bop remix) - Stillhead (4:20)'), { pos: '1', title: 'Hide Me (Bop remix) - Stillhead', length: '4:20' }, '~( mixed into a flow pattern');

  // h:mm:ss length
  eq(P('# T (L)', '1 Long One (1:02:33)'), { pos: '1', title: 'Long One', length: '1:02:33' }, 'h:mm:ss length');

  // non-matching line → null
  eq(P('# A - T (L)', 'no numbers or dashes here'), null, 'unmatched line → null');

  // #522 (majkinetor, live): "In pattern tracker, `#. A ` doesn't work (space
  // at the end)" / "also `#. A - `" — a dangling ws/sep token at the pattern's
  // edge used to compile to a hard boundary requirement that a trimmed input
  // line can never satisfy. Middle whitespace ("many spaces" between two real
  // fields) already worked — majkinetor: "that is inconsistant behavior".
  eq(P('#. A ', '1. Star Band'), { pos: '1', artist: 'Star Band' }, 'trailing space after the last field (#522)');
  eq(P('#. A - ', '1. Star Band'), { pos: '1', artist: 'Star Band' }, 'trailing " - " (sep+ws) after the last field (#522)');
  eq(P(' #. A', '1. Star Band'), { pos: '1', artist: 'Star Band' }, 'leading space before the pattern (symmetric case)');
  eq(P('#. A - T      (L)', '1. Star Band - Misterioso      (4:34)'), { pos: '1', artist: 'Star Band', title: 'Misterioso', length: '4:34' }, 'many spaces BETWEEN two real fields still works — never was the bug');

  // #522 follow-up (majkinetor, live): "#. T (_" on "1. Ndzirombi (Conflict
  // Monger) - Zig Zag Band (5:21)" gave "Ndzirombi (Conflict Monger) - Zig Zag
  // Band" as the title — expected just "Ndzirombi". T was the only text
  // field, so it compiled greedy; greedy backtracks from the END, and with an
  // unconstrained "(_" skip after it (matches ANY "("), it found the LAST "("
  // in the source (the length's own paren) rather than the title's own first
  // one. A literal directly after a field now always makes that field lazy
  // (stop at the FIRST occurrence), regardless of the greedy/last-field
  // heuristic that governs plain field-to-field splits.
  eq(P('#. T (_', '1. Ndzirombi (Conflict Monger) - Zig Zag Band (5:21)'), { pos: '1', title: 'Ndzirombi' }, 'title stops at the FIRST "(" when followed by an unconstrained skip (#522)');
  // sanity: the T (L) case (a REAL field, not a skip, after the literal)
  // still works whether the source title has its own embedded paren or not —
  // L's own specific shape (a duration) already disambiguates correctly,
  // lazy-vs-greedy doesn't change that.
  eq(P('# T (L)', '1 Song (Live) (1:02:33)'), { pos: '1', title: 'Song (Live)', length: '1:02:33' }, 'T (L) still finds the REAL length paren, not the title\'s own');
  // sanity: nothing after the last field at all still takes the rest greedily
  // (the "split on first separator, title takes the rest" case) — this new
  // rule only kicks in when a literal actually follows.
  eq(P('# A - T', '1 Miles Davis - So What - Take 1'), { pos: '1', artist: 'Miles Davis', title: 'So What - Take 1' }, 'no trailing literal → still greedy to end of line (unaffected)');
});
