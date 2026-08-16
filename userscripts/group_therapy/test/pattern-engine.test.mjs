// #522 — Text parser engine, unit tests (no browser).
// The engine here is authored to be pasted verbatim into group_therapy.user.js.
// Grammar (v1): tokens R A (+ _ skip), $X explicit, X[slice] positional,
// X[,] / X[, and ...] split-into-multiple-rows, separators match any-of a
// configurable list, literals are literal, ws is elastic, text fields lazy
// (split-on-first) except the last which is greedy — UNLESS immediately
// followed by a literal, which is always lazy (stops at the first
// occurrence) regardless of that heuristic. Single-line only — a line that
// doesn't match anything is simply unmatched, no multi-line grammar.
// This is a deliberately duplicated copy of apollo_editor.user.js's
// tpTokenize/tpCompile (its own test mirror: test/pattern-engine.test.mjs),
// re-keyed to credit fields (role/artist) with a new split modifier —
// keep the two engines in sync when either gets a grammar-level fix.

// ───────────────────────── engine (copy into Group Therapy) ─────────────────────────
const TXP_FIELDS = { 'R': 'role', 'A': 'artist' };
const TXP_DEFAULT_SEPS = ['-', '‐', '–', '—', '/', ':'];
const txpEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const txpUsable = out => !!out && Object.values(out).some(v => v && String(v).trim());

function txpTokenize(pattern, seps) {
  const segs = [];
  const sepSet = new Set(seps);
  const isFieldLetter = c => c === 'R' || c === 'A';
  const readSlice = (str, i) => {
    if (str[i] !== '[') return null;
    const close = str.indexOf(']', i); if (close < 0) return null;
    const inner = str.slice(i + 1, close); let m;
    if (inner[0] === ',') {
      const rest = inner.slice(1).trim();
      return { slice: { split: [',', ...(rest ? rest.split(/\s+/) : [])] }, next: close + 1 };
    }
    const colon = inner.indexOf(':');
    if (colon >= 0) {
      let left = inner.slice(0, colon); const hadTilde = left[0] === '~'; if (hadTilde) left = left.slice(1);
      let toDelim = inner.slice(colon + 1); const toLast = toDelim[0] === '~'; if (toLast) toDelim = toDelim.slice(1);
      const slice = /^\d*$/.test(left)
        ? { a: left === '' ? null : parseInt(left, 10), fromEnd: hadTilde, toDelim, toLast }
        : { fromDelim: left, fromLast: hadTilde, toDelim, toLast };
      return { slice, next: close + 1 };
    }
    if ((m = /^(~?)(\d*)(-?)(\d*)$/.exec(inner))) { const a = m[2] === '' ? null : parseInt(m[2], 10), b = m[4] === '' ? null : parseInt(m[4], 10); return { slice: m[3] === '-' ? { a, b, fromEnd: m[1] === '~' } : { a, b: a, fromEnd: m[1] === '~' }, next: close + 1 }; }
    return null;
  };
  for (let i = 0; i < pattern.length;) {
    const c = pattern[i];
    if (c === '$') {
      const letter = pattern[i + 1];
      if (isFieldLetter(letter)) { const sl = readSlice(pattern, i + 2); segs.push({ kind: 'field', field: TXP_FIELDS[letter], slice: sl ? sl.slice : null }); i = sl ? sl.next : i + 2; continue; }
      segs.push({ kind: 'lit', text: '$' }); i++; continue;
    }
    if (c === '_') { segs.push({ kind: 'skip' }); i++; continue; }
    if (isFieldLetter(c)) {
      const letterish = ch => ch && /[A-Za-z]/.test(ch);
      if (!(letterish(pattern[i - 1]) || letterish(pattern[i + 1]))) {
        const sl = readSlice(pattern, i + 1); segs.push({ kind: 'field', field: TXP_FIELDS[c], slice: sl ? sl.slice : null }); i = sl ? sl.next : i + 1; continue;
      }
    }
    if (sepSet.has(c)) { segs.push({ kind: 'sep' }); i++; continue; }
    if (/\s/.test(c)) { let j = i; while (j < pattern.length && /\s/.test(pattern[j])) j++; segs.push({ kind: 'ws' }); i = j; continue; }
    segs.push({ kind: 'lit', text: c }); i++;
  }
  return segs;
}

function txpCompile(pattern, opts = {}) {
  const seps = opts.separators || TXP_DEFAULT_SEPS;
  const segs = txpTokenize(pattern, seps);
  while (segs.length && (segs[0].kind === 'ws' || segs[0].kind === 'sep')) segs.shift();
  while (segs.length && (segs[segs.length - 1].kind === 'ws' || segs[segs.length - 1].kind === 'sep')) segs.pop();
  const fieldSegs = segs.filter(s => s.kind === 'field');
  const fields = new Set(fieldSegs.map(s => s.field));
  const sliced = fieldSegs.filter(s => s.slice && !s.slice.split);
  const splitSpecs = new Map(fieldSegs.filter(s => s.slice && s.slice.split).map(s => [s.field, s.slice.split]));
  const sepClass = '(?:' + seps.map(txpEsc).join('|') + ')';
  if (fieldSegs.length > 0 && sliced.length === fieldSegs.length) {
    return { fields, splitSpecs, exec(line) {
      const s = String(line), out = {};
      for (const seg of fieldSegs) {
        const { a, b, fromEnd, fromDelim, fromLast, toDelim, toLast } = seg.slice; let start, end;
        if (fromDelim != null) { const fi = fromDelim === '' ? 0 : (fromLast ? s.lastIndexOf(fromDelim) : s.indexOf(fromDelim)); if (fi < 0) { out[seg.field] = ''; continue; } start = fi + fromDelim.length; }
        else if (fromEnd) start = a == null ? 0 : s.length - a;
        else start = (a == null ? 1 : a) - 1;
        start = Math.max(0, start);
        if (toDelim != null) { let ti; if (toDelim === '') ti = -1; else if (toLast) { ti = s.lastIndexOf(toDelim); if (ti < start) ti = -1; } else ti = s.indexOf(toDelim, start); end = ti < 0 ? s.length : ti; }
        else if (fromEnd) end = b == null ? s.length : s.length - b + 1;
        else end = b == null ? s.length : b;
        out[seg.field] = s.slice(start, Math.max(start, end)).trim();
      }
      return txpUsable(out) ? out : null;
    } };
  }
  const textSegs = fieldSegs.filter(s => s.field === 'role' || s.field === 'artist');
  const greedyText = textSegs[textSegs.length - 1];
  let re = '^\\s*';
  for (let idx = 0; idx < segs.length; idx++) {
    const seg = segs[idx];
    if (seg.kind === 'ws') re += '\\s+';
    else if (seg.kind === 'lit') re += /\s/.test(seg.text) ? '\\s+' : txpEsc(seg.text);
    else if (seg.kind === 'sep') re += '\\s*' + sepClass + '\\s*';
    else if (seg.kind === 'skip') re += '.*?';
    else if (seg.kind === 'field') {
      if (seg.slice && (seg.slice.toDelim != null || seg.slice.fromDelim != null)) {
        const sl = seg.slice;
        re += (sl.fromDelim ? (sl.fromLast ? '.*' : '.*?') + txpEsc(sl.fromDelim) : '') + (sl.toDelim ? (sl.toLast ? '(.+)' : '(.+?)') + txpEsc(sl.toDelim) : '(.+)');
      }
      else {
        let j = idx + 1; while (j < segs.length && segs[j].kind === 'ws') j++;
        const followedByLiteral = j < segs.length && segs[j].kind === 'lit';
        re += (seg === greedyText && !followedByLiteral) ? '(.+)' : '(.+?)';
      }
    }
  }
  re += '\\s*$';
  const rx = new RegExp(re);
  const order = fieldSegs.map(s => s.field);
  return { fields, splitSpecs, regex: re, exec(line) {
    const m = rx.exec(String(line).trim()); if (!m) return null;
    const out = {}; order.forEach((f, i) => { out[f] = (m[i + 1] || '').trim(); });
    return txpUsable(out) ? out : null;
  } };
}

function txpSplitRegex(alts) {
  return new RegExp(alts.map(a => a === ',' ? '\\s*,\\s*' : '\\s+' + txpEsc(a) + '\\s+').join('|'), 'i');
}

function txpExpand(compiled, line) {
  const out = compiled && compiled.exec(line);
  if (!out) return null;
  if (!compiled.splitSpecs || !compiled.splitSpecs.size) return [out];
  let rows = [out];
  for (const [field, alts] of compiled.splitSpecs) {
    const rx = txpSplitRegex(alts);
    rows = rows.flatMap(r => {
      const vals = (r[field] || '').split(rx).map(s => s.trim()).filter(Boolean);
      return vals.length ? vals.map(v => ({ ...r, [field]: v })) : [r];
    });
  }
  return rows;
}
// ─────────────────────────────── end engine ───────────────────────────────

let fail = 0;
const eq = (got, exp, msg) => { const g = JSON.stringify(got), e = JSON.stringify(exp); const ok = g === e; console.log((ok ? 'ok  : ' : 'FAIL: ') + msg + (ok ? '' : `\n   got ${g}\n   exp ${e}`)); if (!ok) fail++; };
const P = (pat, line, opts) => txpCompile(pat, opts).exec(line);
const X = (pat, line, opts) => txpExpand(txpCompile(pat, opts), line);

// majkinetor's own examples (issue #522)
eq(P('R: A', 'Graphic Design: Ricardo "Magrão" Fernandes'), { role: 'Graphic Design', artist: 'Ricardo "Magrão" Fernandes' }, 'R: A — basic role:artist with an embedded quote in the name');
eq(P('R: A', 'Mastering: Michael Graves (Osiris Studio)'), { role: 'Mastering', artist: 'Michael Graves (Osiris Studio)' }, 'R: A — parenthetical stays part of the artist text');
eq(P('R: A', 'Liner Notes: Banning Eyre'), { role: 'Liner Notes', artist: 'Banning Eyre' }, 'R: A — two-word role');
eq(P('R: A', 'Text Editing: Jesse Simon'), { role: 'Text Editing', artist: 'Jesse Simon' }, 'R: A — another two-word role');
// a line with TWO colons (title containing one) must still stop the role at
// the FIRST colon, not the last — the #522 field-followed-by-literal fix.
eq(P('R: A', 'Special Thanks to: Gilbert Zvamaida'), { role: 'Special Thanks to', artist: 'Gilbert Zvamaida' }, 'R: A — role text itself can contain other words freely, stops at first colon');

eq(P('A - R', 'Cameron Allen - Flute'), { artist: 'Cameron Allen', role: 'Flute' }, 'A - R — basic artist-dash-role');

// #522: A - R[,] splits one line's role text into multiple rows, one artist.
eq(X('A - R[,]', 'Cameron Allen - Flute, Tenor Saxophone'), [
  { artist: 'Cameron Allen', role: 'Flute' },
  { artist: 'Cameron Allen', role: 'Tenor Saxophone' },
], 'A - R[,] — comma-split role expands to 2 rows, both with the same artist');

eq(X('A - R[,]', 'Ben Abarbanel-Wolff - Saxophone, Flute'), [
  { artist: 'Ben Abarbanel-Wolff', role: 'Saxophone' },
  { artist: 'Ben Abarbanel-Wolff', role: 'Flute' },
], 'A - R[,] — artist name containing a hyphen doesn\'t confuse the artist/role split');

// [, and] also splits on the literal word "and" — the wiki's
// "Role, Role and Role" shape.
eq(X('A - R[, and]', 'Kenny Sterling - Additional Percussion, Synthesizer, Choir Direction and Lyrics'), [
  { artist: 'Kenny Sterling', role: 'Additional Percussion' },
  { artist: 'Kenny Sterling', role: 'Synthesizer' },
  { artist: 'Kenny Sterling', role: 'Choir Direction' },
  { artist: 'Kenny Sterling', role: 'Lyrics' },
], 'A - R[, and] — comma AND the word "and" both split');

eq(X('A - R[, and]', "Jong-Yun (J.Y.) Lee - Flute Alto, Tenor, Baritone and Soprano Saxophones"), [
  { artist: 'Jong-Yun (J.Y.) Lee', role: 'Flute Alto' },
  { artist: 'Jong-Yun (J.Y.) Lee', role: 'Tenor' },
  { artist: 'Jong-Yun (J.Y.) Lee', role: 'Baritone' },
  { artist: 'Jong-Yun (J.Y.) Lee', role: 'Soprano Saxophones' },
], 'A - R[, and] — messy real-world multi-role line, best-effort split (4 pieces)');

// no split modifier at all → the field is captured whole, exactly one row.
eq(X('A - R', 'Cameron Allen - Flute, Tenor Saxophone'), [
  { artist: 'Cameron Allen', role: 'Flute, Tenor Saxophone' },
], 'A - R (no [,]) — role captured whole as one row, no expansion');

// dangling edge ws/sep tokens (re-ported #522 fix) — a trailing space or
// separator with nothing real past it must not make the pattern unmatchable.
eq(P('R: A ', 'Mastering: Nick Robbins'), { role: 'Mastering', artist: 'Nick Robbins' }, 'trailing space after the last field still matches');
eq(P('R - A - ', 'Mastering - Nick Robbins'), { role: 'Mastering', artist: 'Nick Robbins' }, 'trailing " - " (sep+ws) after the last field still matches');

// unmatched lines (section headers, blank-ish lines) → null, not a throw —
// this is how "single line only" degrades gracefully for out-of-grammar text.
eq(P('R: A', 'SPECIAL GUESTS'), null, 'a section header with no colon/dash → unmatched, null');
eq(X('R: A', 'SPECIAL GUESTS'), null, 'txpExpand also returns null for an unmatched line, not []');
eq(P('R: A', ''), null, 'a blank line → unmatched, null');

// slice syntax still works, re-keyed through TXP_FIELDS.
eq(P('R[1-9] A', 'Mastering  Nick Robbins'), { role: 'Mastering', artist: 'Nick Robbins' }, 'slice: R[1-9] positional role');

// both fields split (cartesian) — not a documented v1 shape, but the code
// gets it for free; confirm it doesn't crash and the product count is right.
eq(X('A[,] - R[,]', 'Alice, Bob - Guitar, Bass'), [
  { artist: 'Alice', role: 'Guitar' },
  { artist: 'Alice', role: 'Bass' },
  { artist: 'Bob', role: 'Guitar' },
  { artist: 'Bob', role: 'Bass' },
], 'both fields split → cartesian product (4 rows from 2x2), free correctness check');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
