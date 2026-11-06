// The CSS a userscript ships, read from its source: every string literal, those joined by `+` run together (a rule
// split across pieces rejoins), a template literal's ${…} left as an empty value. From that text, the rules whose
// selector matches a test, so a demo can carry the script's own styling and nothing else.

import * as espree from 'espree';

const unescape = s => s.replace(/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2})|\r?\n|(.))/gis, (m, a, b, c, d) =>
  a || b || c ? String.fromCodePoint(parseInt(a || b || c, 16)) : d === undefined ? '' : ({ n: '\n', t: '\t', r: '\r' })[d] ?? d);

/** The string literals of a JS source, each chain of `'a' + 'b'` run into one text. */
export function strings(src) {
  const out = [], open = []; let cur = null, plus = false;
  const flush = () => { if (cur !== null) out.push(cur); cur = null; };
  const piece = s => { if (plus && cur !== null) cur += s; else { flush(); cur = s; } plus = false; };
  for (const t of espree.tokenize(src, { ecmaVersion: 'latest', sourceType: 'script' })) {
    if (t.type === 'Template') {
      // a template comes in pieces: `a${ … }b${ … }c` — the expressions between are left as \u0001
      const v = t.value, start = v[0] === '`', more = v.endsWith('${');
      const text = unescape(v.slice(1, more ? -2 : -1));
      const built = start ? text : open.pop() + '\u0001' + text;
      if (more) open.push(built); else if (!open.length) piece(built);
      continue;
    }
    if (open.length) continue;
    if (t.type === 'String') piece(unescape(t.value.slice(1, -1)));
    else if (t.type === 'Punctuator' && t.value === '+' && cur !== null && !plus) plus = true;
    else { plus = false; flush(); }
  }
  flush();
  return out;
}

/** Top-level rules of a CSS text (@media and @supports blocks kept whole), as { sel, text }. */
function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = []; let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    const sel = css.slice(i, open).replace(/^[\s;}]+/, '').trim();
    let d = 1, j = open + 1; while (j < css.length && d) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
    out.push({ sel, text: `${sel}{${css.slice(open + 1, j - 1)}}` }); i = j;
  }
  return out;
}

const looksCss = s => /[.#\[:][\w-]+[^{}]*\{[^{}]*[\w-]+\s*:[^{}]+\}/.test(s) || /@(?:-webkit-)?keyframes\s+[\w-]+\s*\{/.test(s);

/** Every CSS rule the source ships whose selector passes `want`; @keyframes by the names in `frames`. */
export function cssOf(src, want, frames = []) {
  const seen = new Set(), out = [];
  for (const s of strings(src)) {
    if (!looksCss(s)) continue;
    for (const r of rules(s.replace(/\u0001/g, ''))) {
      if (r.sel.includes('\u0001') || /[;=()]\s*$/.test(r.sel) && !/^@/.test(r.sel)) continue;
      const kf = r.sel.match(/^@(?:-webkit-)?keyframes\s+([\w-]+)/);
      const ok = kf ? frames.includes(kf[1]) : /^@(media|supports)/.test(r.sel) ? want(r.text) : !r.sel.startsWith('@') && want(r.sel);
      if (ok && !seen.has(r.text)) { seen.add(r.text); out.push(r.text); }
    }
  }
  return out.join('\n');
}
