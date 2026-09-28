// #522: the text parser's pattern engine — tokens R (role) and E (entity), _ to skip,
// $X explicit, X[slice] positional, X[,] / X[, and …] to split into rows, a configurable
// list of separators. Text fields are lazy (split on the first) except the last, which
// is greedy, unless a literal follows it. One line at a time.
//
// The engine is Apollo's pattern engine, copied and re-keyed to credit fields. This
// spec runs Group Therapy's own copy (it used to test a third copy of its own).
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('the text parser splits credit lines into roles and entities', { tag: ['@unit', '@critical'] }, async () => {
  const { txpCompile, txpExpand } = await loadFunctions('group_therapy', ['TXP_FIELDS', 'TXP_SEPS', 'txpEsc', 'txpUsable', 'txpTokenize', 'txpCompile', 'txpSplitRegex', 'txpExpand']);
  const eq = (got, exp, msg) => { const g = JSON.stringify(got), e = JSON.stringify(exp); check(g === e, g === e ? msg : `${msg} — got ${g}, expected ${e}`); };
  const P = (pat, line, opts) => txpCompile(pat, opts).exec(line);
  const X = (pat, line, opts) => txpExpand(txpCompile(pat, opts), line);

  // majkinetor's own examples (issue #522)
  eq(P('R: E', 'Graphic Design: Ricardo "Magrão" Fernandes'), { role: 'Graphic Design', entity: 'Ricardo "Magrão" Fernandes' }, 'R: E — basic role:entity with an embedded quote in the name');
  eq(P('R: E', 'Mastering: Michael Graves (Osiris Studio)'), { role: 'Mastering', entity: 'Michael Graves (Osiris Studio)' }, 'R: E — parenthetical stays part of the entity text');
  eq(P('R: E', 'Liner Notes: Banning Eyre'), { role: 'Liner Notes', entity: 'Banning Eyre' }, 'R: E — two-word role');
  eq(P('R: E', 'Text Editing: Jesse Simon'), { role: 'Text Editing', entity: 'Jesse Simon' }, 'R: E — another two-word role');
  // a line with TWO colons (title containing one) must still stop the role at
  // the FIRST colon, not the last — the #522 field-followed-by-literal fix.
  eq(P('R: E', 'Special Thanks to: Gilbert Zvamaida'), { role: 'Special Thanks to', entity: 'Gilbert Zvamaida' }, 'R: E — role text itself can contain other words freely, stops at first colon');

  eq(P('E - R', 'Cameron Allen - Flute'), { entity: 'Cameron Allen', role: 'Flute' }, 'E - R — basic entity-dash-role');

  // #522: E - R[,] splits one line's role text into multiple rows, one entity.
  eq(X('E - R[,]', 'Cameron Allen - Flute, Tenor Saxophone'), [
    { entity: 'Cameron Allen', role: 'Flute' },
    { entity: 'Cameron Allen', role: 'Tenor Saxophone' },
  ], 'E - R[,] — comma-split role expands to 2 rows, both with the same entity');

  eq(X('E - R[,]', 'Ben Abarbanel-Wolff - Saxophone, Flute'), [
    { entity: 'Ben Abarbanel-Wolff', role: 'Saxophone' },
    { entity: 'Ben Abarbanel-Wolff', role: 'Flute' },
  ], 'E - R[,] — entity name containing a hyphen doesn\'t confuse the entity/role split');

  // [, and] also splits on the literal word "and" — the wiki's
  // "Role, Role and Role" shape.
  eq(X('E - R[, and]', 'Kenny Sterling - Additional Percussion, Synthesizer, Choir Direction and Lyrics'), [
    { entity: 'Kenny Sterling', role: 'Additional Percussion' },
    { entity: 'Kenny Sterling', role: 'Synthesizer' },
    { entity: 'Kenny Sterling', role: 'Choir Direction' },
    { entity: 'Kenny Sterling', role: 'Lyrics' },
  ], 'E - R[, and] — comma AND the word "and" both split');

  eq(X('E - R[, and]', "Jong-Yun (J.Y.) Lee - Flute Alto, Tenor, Baritone and Soprano Saxophones"), [
    { entity: 'Jong-Yun (J.Y.) Lee', role: 'Flute Alto' },
    { entity: 'Jong-Yun (J.Y.) Lee', role: 'Tenor' },
    { entity: 'Jong-Yun (J.Y.) Lee', role: 'Baritone' },
    { entity: 'Jong-Yun (J.Y.) Lee', role: 'Soprano Saxophones' },
  ], 'E - R[, and] — messy real-world multi-role line, best-effort split (4 pieces)');

  // no split modifier at all → the field is captured whole, exactly one row.
  eq(X('E - R', 'Cameron Allen - Flute, Tenor Saxophone'), [
    { entity: 'Cameron Allen', role: 'Flute, Tenor Saxophone' },
  ], 'E - R (no [,]) — role captured whole as one row, no expansion');

  // #525: R: E[,] — the same split modifier, but on the OTHER side of the
  // colon form (a role: name, name, name shape — e.g. "Published by: Warner
  // Chappell, Sony Music Publishing").
  eq(X('R: E[,]', 'Published by: Warner Chappell, Sony Music Publishing'), [
    { role: 'Published by', entity: 'Warner Chappell' },
    { role: 'Published by', entity: 'Sony Music Publishing' },
  ], 'R: E[,] — comma-split entity expands to 2 rows, both with the same role');

  // #525 (majkinetor): "R: E[&]" didn't work for "Graphic Design: Ricardo H
  // Fernandes & Yacine Blaeich" — [&] splits the same way [,] does, but on
  // " & " (with required surrounding whitespace, so "AT&T"-style names
  // aren't split mid-word).
  eq(X('R: E[&]', 'Graphic Design: Ricardo H Fernandes & Yacine Blaeich'), [
    { role: 'Graphic Design', entity: 'Ricardo H Fernandes' },
    { role: 'Graphic Design', entity: 'Yacine Blaeich' },
  ], 'R: E[&] — ampersand-split entity expands to 2 rows, both with the same role');
  eq(X('R: E[&]', 'Label: AT&T Records'), [
    { role: 'Label', entity: 'AT&T Records' },
  ], 'R: E[&] — an un-spaced "&" inside a real name is not split (needs surrounding whitespace)');

  // dangling edge ws/sep tokens (re-ported #522 fix) — a trailing space or
  // separator with nothing real past it must not make the pattern unmatchable.
  eq(P('R: E ', 'Mastering: Nick Robbins'), { role: 'Mastering', entity: 'Nick Robbins' }, 'trailing space after the last field still matches');
  eq(P('R - E - ', 'Mastering - Nick Robbins'), { role: 'Mastering', entity: 'Nick Robbins' }, 'trailing " - " (sep+ws) after the last field still matches');

  // unmatched lines (section headers, blank-ish lines) → null, not a throw —
  // this is how "single line only" degrades gracefully for out-of-grammar text.
  eq(P('R: E', 'SPECIAL GUESTS'), null, 'a section header with no colon/dash → unmatched, null');
  eq(X('R: E', 'SPECIAL GUESTS'), null, 'txpExpand also returns null for an unmatched line, not []');
  eq(P('R: E', ''), null, 'a blank line → unmatched, null');

  // slice syntax still works, re-keyed through TXP_FIELDS.
  eq(P('R[1-9] E', 'Mastering  Nick Robbins'), { role: 'Mastering', entity: 'Nick Robbins' }, 'slice: R[1-9] positional role');

  // #525 (majkinetor): "Add R[,] - E[,] and E[,] - R[,] instead variants on
  // single side. It is more general." — both fields split-flagged, so a
  // comma on EITHER side works: two commas on both sides is a cartesian
  // product, and one side with no comma degrades to a plain single-side
  // split for free — no separate "which side has the comma" preset needed.
  eq(X('E[,] - R[,]', 'Alice, Bob - Guitar, Bass'), [
    { entity: 'Alice', role: 'Guitar' },
    { entity: 'Alice', role: 'Bass' },
    { entity: 'Bob', role: 'Guitar' },
    { entity: 'Bob', role: 'Bass' },
  ], 'E[,] - R[,] — both fields split → cartesian product (4 rows from 2x2)');
  eq(X('R[,] - E[,]', 'Guitar, Bass - Alice'), [
    { role: 'Guitar', entity: 'Alice' },
    { role: 'Bass', entity: 'Alice' },
  ], 'R[,] - E[,] — only the role side has a comma, degrades to a plain single-side split');
  eq(X('E[,] - R[,]', 'Cameron Allen - Flute, Tenor Saxophone'), [
    { entity: 'Cameron Allen', role: 'Flute' },
    { entity: 'Cameron Allen', role: 'Tenor Saxophone' },
  ], 'E[,] - R[,] — only the role side has a comma (entity side is a no-op split)');
});
