// #223 — verify "Electronic Drums [Rhythm Box]" and friends map to a real MB
// instrument (drum machine) instead of a bare "instrument" rel, while known
// bases keep their mapping (no bracket override).
globalThis.window = globalThis.window || globalThis;
globalThis.document = globalThis.document || {};
const { getArtistRoles } = await import('../src/mappers.js');

const cases = [
    { name: 'Eric Van Wonterghem', role: 'Synthesizer, Electronic Drums [Rhythm Box]' },
    { name: 'B. Ghola', role: 'Organ [String], Synthesizer, Electronic Drums [Rhythm Box, Electronic Percussion], Cymbal, Guitar' },
    { name: 'Dirk Ivens', role: 'Vocals, Synthesizer, Electronic Drums [Rhythm Box]' },
    { name: 'Ed van Hoven', role: 'Bass [Guitar]' },          // base "Bass" known → must stay bass (NOT guitar)
    { name: 'Le Biquo', role: 'Synthesizer [Juno 106], Trumpet [Flares], Vocals [Yells]' },
    { name: 'Plain', role: 'Electronic Drums' },               // no bracket → stays generic
];

const instr = a => (a.attributes || []).filter(x => x && x._type === 'instrument').map(x => x.value);
let fail = 0;
for (const c of cases) {
    const roles = getArtistRoles({ name: c.name, anv: '', role: c.role });
    const out = roles.map(r => `${r.linkType}${instr(r).length ? '(' + instr(r).join('+') + ')' : (r.linkType === 'instrument' ? '(BARE!)' : '')}`);
    console.log(`${c.name.padEnd(22)} | ${c.role}\n  -> ${out.join(' ; ')}`);
}

// assertions
const ed = getArtistRoles({ name: 'Ed', anv: '', role: 'Bass [Guitar]' })[0];
if (instr(ed)[0] !== 'bass') { console.log('FAIL: Bass [Guitar] should stay "bass", got', instr(ed)); fail++; }
const evw = getArtistRoles({ name: 'E', anv: '', role: 'Electronic Drums [Rhythm Box]' })[0];
if (instr(evw)[0] !== 'drum machine') { console.log('FAIL: Electronic Drums [Rhythm Box] should be "drum machine", got', instr(evw)); fail++; }
const bg = getArtistRoles({ name: 'B', anv: '', role: 'Electronic Drums [Rhythm Box, Electronic Percussion]' })[0];
if (instr(bg)[0] !== 'drum machine') { console.log('FAIL: multi-bracket should be "drum machine", got', instr(bg)); fail++; }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
process.exit(fail ? 1 : 0);
