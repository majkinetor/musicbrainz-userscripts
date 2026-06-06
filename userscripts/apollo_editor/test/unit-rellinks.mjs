// Unit test for the SHIPPED relLinksHtml (#136): extract it from the userscript by balanced braces
// and run it with stubbed esc/ORIGIN. Asserts same-RG releases collapse to "RG ×N".
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const src = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');

function extract(name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const ORIGIN = 'https://musicbrainz.org';
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const relLinksHtml = new Function('ORIGIN', 'esc', `${extract('relLinksHtml')}; return relLinksHtml;`)(ORIGIN, esc);

let pass = 0, fail = 0;
const check = (label, got, mustInclude, mustExclude = []) => {
  const okIn = mustInclude.every(s => got.includes(s));
  const okOut = mustExclude.every(s => !got.includes(s));
  if (okIn && okOut) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, '\n        got:', got, '\n        want all:', mustInclude, mustExclude.length ? '\n        want none:' : '', mustExclude); }
};

// 1. three releases of ONE release group → single "RG ×3" link to the release-group
check('same-RG collapse',
  relLinksHtml([
    { name: 'Album (CD)',    gid: 'r1', rgGid: 'RG1', rgName: 'The Album' },
    { name: 'Album (Vinyl)', gid: 'r2', rgGid: 'RG1', rgName: 'The Album' },
    { name: 'Album (Promo)', gid: 'r3', rgGid: 'RG1', rgName: 'The Album' },
  ], 6),
  ['/release-group/RG1', '>The Album</a>', '×3'],
  ['/release/r2', '/release/r3']);

// 2. single release in its RG → plain release link, no ×N
check('lone release stays a release link',
  relLinksHtml([{ name: 'Solo', gid: 'r9', rgGid: 'RGX', rgName: 'Solo RG' }], 6),
  ['/release/r9', '>Solo</a>'],
  ['×', '/release-group/']);

// 3. two distinct RGs + one duplicated RG → 2 entries, the duplicated one collapsed
check('mixed: two RGs, one collapsed',
  relLinksHtml([
    { name: 'A1', gid: 'a1', rgGid: 'RGA', rgName: 'A' },
    { name: 'A2', gid: 'a2', rgGid: 'RGA', rgName: 'A' },
    { name: 'B1', gid: 'b1', rgGid: 'RGB', rgName: 'B' },
  ], 6),
  ['/release-group/RGA', '×2', '/release/b1', '>B1</a>'],
  ['×2,', '/release/a2']);

// 4. cap counts GROUPS, not raw releases → 4 releases in 1 RG with cap 6 = no "+N more"
check('cap counts groups',
  relLinksHtml([
    { name: 'x1', gid: 'x1', rgGid: 'RG', rgName: 'X' },
    { name: 'x2', gid: 'x2', rgGid: 'RG', rgName: 'X' },
    { name: 'x3', gid: 'x3', rgGid: 'RG', rgName: 'X' },
    { name: 'x4', gid: 'x4', rgGid: 'RG', rgName: 'X' },
  ], 3),
  ['×4'],
  ['more']);

// 5. cap tail still works across groups
check('+N more across groups',
  relLinksHtml([
    { name: 'g1', gid: 'g1', rgGid: 'R1', rgName: 'G1' },
    { name: 'g2', gid: 'g2', rgGid: 'R2', rgName: 'G2' },
    { name: 'g3', gid: 'g3', rgGid: 'R3', rgName: 'G3' },
  ], 2),
  ['+1 more'],
  []);

// 6. no RG info (legacy / WS without release-group) → each release its own link, none collapsed
check('no-RG fallback lists each release',
  relLinksHtml([
    { name: 'P', gid: 'p1' },
    { name: 'Q', gid: 'q1' },
  ], 6),
  ['/release/p1', '/release/q1'],
  ['×', '/release-group/']);

// 7. RG grouping by name when gid missing (defensive)
check('group by rgName when rgGid absent',
  relLinksHtml([
    { name: 'n1', gid: 'n1', rgName: 'Same Name' },
    { name: 'n2', gid: 'n2', rgName: 'Same Name' },
  ], 6),
  ['×2', 'Same Name <span'],   // no rgGid → label not linked, just text + count
  ['/release-group/', '<a ']);

// 8. html-escaping of RG name
check('escapes RG name',
  relLinksHtml([
    { name: 'a', gid: 'a', rgGid: 'RG', rgName: 'Rock & <Roll>' },
    { name: 'b', gid: 'b', rgGid: 'RG', rgName: 'Rock & <Roll>' },
  ], 6),
  ['Rock &amp; &lt;Roll&gt;', '×2'],
  ['<Roll>']);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
