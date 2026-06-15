// #225 — different instruments are not duplicate roles. Unit-tests the
// instrument/vocal attribute classifier and the duplicate-role decision it
// drives (same instrument + modifier diff = duplicate; different instrument =
// distinct performance).
globalThis.window = globalThis.window || globalThis;
globalThis.document = globalThis.document || { createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, append() {}, appendChild() {} }), querySelector: () => null, getElementById: () => null };
globalThis.GM_info = globalThis.GM_info || { script: { name: 't', version: 't', homepageURL: 'x' } };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };

const { makeIdentifyingClassifier } = await import('../src/dispatch.js');

// Minimal stub of MB.linkedEntities.link_attribute_type
const lat = {
    14:   { id: 14,   name: 'instrument',   parent_id: null },   // root
    3:    { id: 3,    name: 'vocal',        parent_id: null },   // root
    1:    { id: 1,    name: 'additional',   parent_id: null },   // modifier root
    596:  { id: 596,  name: 'solo',         parent_id: null },   // modifier root
    229:  { id: 229,  name: 'synthesizer',  parent_id: 14 },     // instrument
    1213: { id: 1213, name: 'drum machine', parent_id: 14 },     // instrument
    302:  { id: 302,  name: 'guitar',       parent_id: 14 },     // instrument
    9001: { id: 9001, name: 'fancy synth',  parent_id: 229 },    // nested under synthesizer
    4:    { id: 4,    name: 'lead vocals',  parent_id: 3 },      // vocal
};
const isId = makeIdentifyingClassifier(lat);

let fail = 0;
const check = (cond, msg) => { if (!cond) { console.log('FAIL:', msg); fail++; } else { console.log('ok  :', msg); } };

// classifier
check(isId(229),  'synthesizer is identifying');
check(isId(1213), 'drum machine is identifying');
check(isId(4),    'lead vocals is identifying');
check(isId(9001), 'nested instrument (root=instrument) is identifying');
check(!isId(1),   'additional is NOT identifying');
check(!isId(596), 'solo is NOT identifying');
check(!isId(99999), 'unknown attr is NOT identifying (safe default)');

// duplicate-role decision = (idSig of existing === idSig of candidate)
const idSig = attrs => attrs.filter(a => isId(a.typeID)).map(a => `${a.typeID}:`).sort().join(',');
const dupRole = (existing, cand) => idSig(existing) === idSig(cand);

// synthesizer (existing) vs drum machine (candidate): DIFFERENT instrument → not a duplicate
check(!dupRole([{ typeID: 229 }], [{ typeID: 1213 }]), 'synth vs drum machine → NOT duplicate (both added)');
// same instrument, modifier differs → duplicate role
check(dupRole([{ typeID: 302, text_value: '' }, { typeID: 1 }], [{ typeID: 302 }, { typeID: 596 }]),
    'guitar+additional vs guitar+solo → duplicate role (suppressed)');
// non-instrument rel (no identifying attrs both sides) → still duplicate (unchanged behaviour)
check(dupRole([{ typeID: 1 }], [{ typeID: 596 }]), 'modifier-only rels → duplicate role (unchanged)');

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
process.exit(fail ? 1 : 0);
