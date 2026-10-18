// One copy of each shared block in the bundle (#786).
//
// Every member carries its own copy of the shared blocks (// <ST-UI> … // </ST-UI>, see DEVELOP.md →
// Shared blocks): ten copies of ST-UI alone were 800 KB of the bundle. Here each block is written once,
// at the top, as a function that takes GM_info and returns the block's names, and each member gets one
// line instead of its copy:
//
//   var { mbuToast, mbuLog, … } = __st_UI(GM_info);
//
// Each member still gets its OWN instance, as before: ST-UI reads the member's GM_info (its help links,
// log title and edit-note signature) and keeps state of its own (the active log window). The line goes
// at the start of the function the block was in, so the names are set before any of that function's
// code runs, as the block's hoisted function declarations were.
//
// The build stops when a block is not self-contained, since moving it out of the member would then
// change what it does: a block that reads one of the member's own names, a member that assigns one of
// the block's, or a name declared both in the block and by the member around it.

import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';

const PARSE = { ecmaVersion: 'latest', sourceType: 'script', range: true };
const analyze = ast => eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });

// Every block in a member's code: its name, its indentation and where it starts and ends.
export function findBlocks(body) {
  const out = [];
  const open = /^([ \t]*)\/\/ <(ST-[A-Z0-9-]+)>[^\n]*$/gm;
  let m;
  while ((m = open.exec(body))) {
    const name = m[2];
    const closeAt = body.indexOf(`// </${name}>`, open.lastIndex);
    if (closeAt < 0) throw new Error(`${name}: no closing marker`);
    let end = body.indexOf('\n', closeAt);
    if (end < 0) end = body.length;
    out.push({ name, ind: m[1], start: m.index, end });
    open.lastIndex = end;
  }
  return out;
}

// The sync indents every line of a block by the indentation of its marker; taking it off gives the
// block as its source has it, template literals included.
const dedent = (text, ind) => ind ? text.split('\n').map(l => (l.startsWith(ind) ? l.slice(ind.length) : l)).join('\n') : text;

// A block's own names (every variable its scope declares, var-hoisted ones included) and the names
// it uses without declaring them.
function blockNames(text) {
  const src = `(function (GM_info) {\n${text}\n})`;
  const ast = espree.parse(src, PARSE);
  const sm = analyze(ast);
  const fn = ast.body[0].expression;
  const scope = sm.acquire(fn);
  const own = scope.variables.map(v => v.name).filter(n => n !== 'arguments' && n !== 'GM_info');
  const free = [...new Set(scope.through.map(r => r.identifier.name))];
  return { own, free };
}

function innermostFunction(ast, s, e) {
  let best = null;
  (function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    const isFn = /Function/.test(node.type) && node.body && node.body.type === 'BlockStatement';
    if (isFn && node.body.range[0] < s && node.body.range[1] > e) best = node;
    for (const k of Object.keys(node)) {
      if (k === 'parent') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v.type === 'string') walk(v);
    }
  })(ast);
  return best;
}

// Rewrites every member's code; returns the members' new code and the functions that hold the blocks.
export function shareBlocks(parts) {
  const factories = new Map();   // key (text + strictness) → { fname, text, own, strict }
  const used = new Map();        // block name → how many factories of that name so far
  const rewritten = new Map();
  const errors = [];

  for (const p of parts) {
    const blocks = findBlocks(p.body);
    if (!blocks.length) { rewritten.set(p.n, p.body); continue; }
    const PRE = '(function(){\n';
    const wrapped = `${PRE}${p.body}\n})`;
    const ast = espree.parse(wrapped, PARSE);
    const sm = analyze(ast);
    const refs = sm.scopes.flatMap(sc => sc.references);
    const edits = [];
    const inAny = r => blocks.some(o => r[0] >= o.start + PRE.length && r[1] <= o.end + PRE.length);

    for (const b of blocks) {
      const s = b.start + PRE.length, e = b.end + PRE.length;
      const inside = r => r[0] >= s && r[1] <= e;
      const text = dedent(p.body.slice(b.start, b.end), b.ind);
      const { own } = blockNames(text);
      const ownSet = new Set(own);
      const deps = new Set();   // names this block takes from another block in the same member

      // self-contained?
      for (const r of refs) {
        const v = r.resolved;
        const inBlock = inside(r.identifier.range);
        if (inBlock && v && v.defs.length && v.defs.every(d => !inside(d.name.range)) && !ownSet.has(v.name)) {
          if (v.defs.every(d => inAny(d.name.range))) deps.add(v.name);
          else errors.push(`${p.n}: ${b.name} uses the member's own "${v.name}"`);
        }
        if (!inBlock && v && ownSet.has(v.name) && v.defs.some(d => inside(d.name.range))) {
          if (r.isWrite()) errors.push(`${p.n}: the member assigns ${b.name}'s "${v.name}"`);
          if (v.defs.some(d => !inside(d.name.range))) errors.push(`${p.n}: "${v.name}" is declared both in ${b.name} and by the member`);
        }
      }

      const fn = innermostFunction(ast, s, e);
      if (!fn) { errors.push(`${p.n}: ${b.name} is not inside a function`); continue; }
      const strict = !!sm.acquire(fn).isStrict;
      const params = ['GM_info', ...[...deps].sort()];
      const key = `${strict}\n${params.join(',')}\n${text}`;
      if (!factories.has(key)) {
        const base = '__st_' + b.name.slice(3).replace(/-/g, '_');
        const k = (used.get(b.name) || 0) + 1;
        used.set(b.name, k);
        factories.set(key, { fname: k > 1 ? `${base}_${k}` : base, text, own, strict, params, members: [] });
      }
      const f = factories.get(key);
      f.members.push(p.n);

      // the line at the start of the function the block was in, after its 'use strict'
      const stmts = fn.body.body;
      let at = fn.body.range[0] + 1;
      for (const st of stmts) { if (st.directive) at = st.range[1]; else break; }
      edits.push({ at: at - PRE.length, del: 0, seq: edits.length, ins: `\nvar { ${own.join(', ')} } = ${f.fname}(${params.join(', ')});   // ${b.name}, written once at the top of the bundle (#786)` });
      edits.push({ at: b.start, del: b.end - b.start, seq: edits.length, ins: `${b.ind}// <${b.name}> is ${f.fname}, at the top of the bundle (#786)` });
    }

    let body = p.body;
    // from the end, so earlier offsets stay right; lines inserted at one spot keep the blocks' order
    edits.sort((a, b) => b.at - a.at || b.del - a.del || b.seq - a.seq).forEach(ed => {
      const at = Math.max(0, ed.at);
      body = body.slice(0, at) + ed.ins + body.slice(at + ed.del);
    });
    rewritten.set(p.n, body);
  }
  if (errors.length) throw new Error('shared blocks that are not self-contained (#786):\n  ' + [...new Set(errors)].join('\n  '));

  const code = [...factories.values()].map(f =>
    `// ${f.text.split('\n')[0].replace(/^\/\/\s*/, '')}\n// used by ${f.members.join(', ')}\n`
    + `function ${f.fname}(${f.params.join(', ')}) {\n${f.strict ? "'use strict';\n" : ''}${f.text}\nreturn { ${f.own.join(', ')} };\n}`).join('\n\n');
  return { bodies: rewritten, code, factories: [...factories.values()] };
}
