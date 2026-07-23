// #456 — pattern Track parser engine, unit tests (no browser).
// The engine here is authored to be pasted verbatim into apollo_editor.user.js.
// Grammar (v1): tokens # T A L M (+ _ skip), $X explicit, X[slice] positional,
// separators match any-of a configurable list, literals are literal, ws is elastic,
// text fields lazy (split-on-first) except the last which is greedy.

// ───────────────────────── engine (copy into Apollo) ─────────────────────────
const TP_FIELDS = { '#': 'pos', 'T': 'title', 'A': 'artist', 'L': 'length', 'M': 'medium' };
const TP_DUR = '\\d{1,2}:\\d{2}(?::\\d{2})?';
const TP_DEFAULT_SEPS = ['-', '–', '—', '/', ':'];   // - – — / :
const tpEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parse a pattern string into segments.
function tpTokenize(pattern, seps) {
  const segs = [];
  const sepSet = new Set(seps);
  const isFieldLetter = c => c === '#' || c === 'M' || c === 'T' || c === 'A' || c === 'L';
  const readSlice = (str, i) => {
    // [a-b] | [a-] | [-b] | [~a-] numeric (1-based, inclusive; ~ = from end), or [a:X] = from a to
    // (excluding) the first literal X. returns {slice, next} or null.
    if (str[i] !== '[') return null;
    const close = str.indexOf(']', i); if (close < 0) return null;
    const inner = str.slice(i + 1, close); let m;
    if ((m = /^(~?)(\d*):([\s\S]*)$/.exec(inner))) return { slice: { a: m[2] === '' ? null : parseInt(m[2], 10), fromEnd: m[1] === '~', toDelim: m[3] }, next: close + 1 };
    if ((m = /^(~?)(\d*)(-?)(\d*)$/.exec(inner))) { const a = m[2] === '' ? null : parseInt(m[2], 10), b = m[4] === '' ? null : parseInt(m[4], 10); return { slice: m[3] === '-' ? { a, b, fromEnd: m[1] === '~' } : { a, b: a, fromEnd: m[1] === '~' }, next: close + 1 }; }
    return null;
  };
  for (let i = 0; i < pattern.length;) {
    const c = pattern[i];
    if (c === '$') {                                   // explicit field token
      const letter = pattern[i + 1];
      if (isFieldLetter(letter)) {
        const sl = readSlice(pattern, i + 2);
        segs.push({ kind: 'field', field: TP_FIELDS[letter], slice: sl ? sl.slice : null });
        i = sl ? sl.next : i + 2; continue;
      }
      segs.push({ kind: 'lit', text: '$' }); i++; continue;
    }
    if (c === '_') { segs.push({ kind: 'skip' }); i++; continue; }
    if (isFieldLetter(c)) {
      // a bare field letter is a token only when standalone (not part of a longer word)
      const prev = pattern[i - 1], next = pattern[i + 1];
      const letterish = ch => ch && /[A-Za-z]/.test(ch);
      if (!(letterish(prev) || (c !== '#' && letterish(next)))) {
        const sl = readSlice(pattern, i + 1);
        segs.push({ kind: 'field', field: TP_FIELDS[c], slice: sl ? sl.slice : null });
        i = sl ? sl.next : i + 1; continue;
      }
    }
    if (sepSet.has(c)) { segs.push({ kind: 'sep' }); i++; continue; }
    if (/\s/.test(c)) { let j = i; while (j < pattern.length && /\s/.test(pattern[j])) j++; segs.push({ kind: 'ws' }); i = j; continue; }
    segs.push({ kind: 'lit', text: c }); i++;
  }
  return segs;
}

function tpCompile(pattern, opts = {}) {
  const seps = opts.separators || TP_DEFAULT_SEPS;
  const segs = tpTokenize(pattern, seps);
  const fieldSegs = segs.filter(s => s.kind === 'field');
  const fields = new Set(fieldSegs.map(s => s.field));
  const sliced = fieldSegs.filter(s => s.slice);
  const allSliced = fieldSegs.length > 0 && sliced.length === fieldSegs.length;
  const sepClass = '(?:' + seps.map(tpEsc).join('|') + ')';

  // slice-mode: every field is positional → extract by char index off the raw line
  if (allSliced) {
    return {
      fields,
      exec(line) {
        const s = String(line);
        const out = {};
        for (const seg of fieldSegs) {
          const { a, b, fromEnd, toDelim } = seg.slice;
          let start, end;
          if (toDelim != null) {
            start = fromEnd ? s.length - (a == null ? 0 : a) : (a == null ? 1 : a) - 1;
            start = Math.max(0, start);
            const idx = toDelim === '' ? -1 : s.indexOf(toDelim, start);
            end = idx < 0 ? s.length : idx;
          } else if (fromEnd) { const n = s.length; start = a == null ? 0 : n - a; end = b == null ? n : n - b + 1; }
          else { start = (a == null ? 1 : a) - 1; end = b == null ? s.length : b; }
          out[seg.field] = s.slice(Math.max(0, start), Math.max(0, end)).trim();
        }
        return normalize(out) ? out : null;
      },
    };
  }

  // flow-mode: build an anchored regex; one text field is greedy (first sep by default, last when splitLast)
  const textSegs = fieldSegs.filter(s => s.field === 'title' || s.field === 'artist');
  const greedyText = opts.splitLast ? textSegs[0] : textSegs[textSegs.length - 1];
  let re = '^\\s*';
  for (const seg of segs) {
    if (seg.kind === 'ws') re += '\\s+';
    else if (seg.kind === 'lit') re += tpEsc(seg.text).replace(/\\?\s/g, '\\s+');
    else if (seg.kind === 'sep') re += '\\s*' + sepClass + '\\s*';
    else if (seg.kind === 'skip') re += '.*?';
    else if (seg.kind === 'field') {
      const f = seg.field;
      if (seg.slice && seg.slice.toDelim != null) re += '(.+?)' + tpEsc(seg.slice.toDelim);   // X[a:delim] in flow: capture up to the delim
      else if (f === 'pos') re += '([A-Za-z]?\\d+(?:[-.]\\d+)?)';
      else if (f === 'medium') re += '(\\d+)';
      else if (f === 'length') re += '(' + TP_DUR + ')';
      else re += seg === greedyText ? '(.+)' : '(.+?)';   // title/artist
    }
  }
  re += '\\s*$';
  const rx = new RegExp(re);
  const order = fieldSegs.map(s => s.field);
  return {
    fields, regex: re,
    exec(line) {
      const m = rx.exec(String(line).trim());
      if (!m) return null;
      const out = {};
      order.forEach((f, i) => { out[f] = (m[i + 1] || '').trim(); });
      return out;
    },
  };
}
// a row is usable if it captured at least one non-empty field
function normalize(out) { return Object.values(out).some(v => v && String(v).trim()); }
// ─────────────────────────────── end engine ───────────────────────────────

let fail = 0;
const eq = (got, exp, msg) => { const g = JSON.stringify(got), e = JSON.stringify(exp); const ok = g === e; console.log((ok ? 'ok  : ' : 'FAIL: ') + msg + (ok ? '' : `\n   got ${g}\n   exp ${e}`)); if (!ok) fail++; };
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

// h:mm:ss length
eq(P('# T (L)', '1 Long One (1:02:33)'), { pos: '1', title: 'Long One', length: '1:02:33' }, 'h:mm:ss length');

// non-matching line → null
eq(P('# A - T (L)', 'no numbers or dashes here'), null, 'unmatched line → null');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
