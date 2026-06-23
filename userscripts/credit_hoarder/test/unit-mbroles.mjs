// Unit: relRoleLabels collapses instrument/vocal rels to the SPECIFIC
// instrument/vocal (the attribute), keeps other types, drops modifiers.
globalThis.window = globalThis.window || globalThis;
if (typeof globalThis.BroadcastChannel === 'undefined') globalThis.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
const { relRoleLabels } = await import('../src/api-mb.js');

let ok = true;
const eq = (label, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); console.log((g === w ? 'PASS' : 'FAIL') + ' — ' + label + (g === w ? '' : `  got ${g} want ${w}`)); if (g !== w) ok = false; };

// real shape from 野坂操壽 (Keiko Nosaka): many instrument rels, attribute koto
eq('koto player → ["koto"]', relRoleLabels([
  { type: 'instrument', attributes: ['koto'] },
  { type: 'instrument', attributes: ['koto'], 'attribute-credits': { koto: '20-string koto' } },
]), ['koto']);

eq('mixed types + instruments', relRoleLabels([
  { type: 'instrument', attributes: ['piano'] },
  { type: 'instrument', attributes: ['flamenco guitar'] },
  { type: 'producer', attributes: [] },
  { type: 'vocal', attributes: ['lead vocals'] },
]), ['flamenco guitar', 'lead vocals', 'piano', 'producer']);

eq('modifiers dropped, instrument kept', relRoleLabels([
  { type: 'instrument', attributes: ['additional', 'guitar'] },
]), ['guitar']);

eq('bare additional instrument → "instrument"', relRoleLabels([
  { type: 'instrument', attributes: ['additional'] },
]), ['instrument']);

eq('non-performance type unchanged', relRoleLabels([
  { type: 'writer', attributes: [] }, { type: 'arranger', attributes: [] },
]), ['arranger', 'writer']);

eq('empty / null safe', relRoleLabels(null), []);

process.exit(ok ? 0 : 1);
