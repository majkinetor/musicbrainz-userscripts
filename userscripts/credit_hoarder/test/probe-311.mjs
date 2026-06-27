// #311 — Qobuz credit lines with spaced role names + instruments parse into clean
// per-person credits (no gluing) and resolve via the shared resolver. Pure node
// test (window stubbed for the browser-only constants.js reference).
globalThis.window = globalThis; globalThis.unsafeWindow = globalThis;
const { parseQobuzCreditLine, qobuzToEngine } = await import('../src/sources/qobuz.js');
const line = "LeAnn Rimes, Associated Performer, Main Artist, Producer - Phil Hanseroth, Composer, Lyricist - Trevor Lawrence Jr., Drums - Darryl Jones, Bass - Chris Stills, Guitar - Mark Batson, Piano, Producer - Darrell Brown, Piano, Producer, Strings - Rob Moose, Strings - NIKO BOLAS, Recording Engineer - David Martinez, Assistant Engineer - Ruadhri Cushnan, Mixing Engineer - Alesandro Di Camillo, Assistant Engineer - Chris Walden - Stuart Hawkes, Mastering Engineer - Cindi Peters";
const parsed = parseQobuzCreditLine(line);
const { tracklistRels, skipped } = qobuzToEngine([{ index: 1, credits: parsed }]);
const has = (name, lt, attr) => tracklistRels.some(r => r.artist.name === name && r.linkType === lt && (attr === undefined || (r.attributes || []).some(a => (typeof a === 'string' ? a : a.value) === attr)));
let ok = true; const fail = m => { ok = false; console.log('FAIL:', m); };
// clean names — nobody glued, no role words leaked into a name
if (tracklistRels.some(r => / - /.test(r.artist.name) || /Engineer|Performer|Artist/.test(r.artist.name))) fail('garbled name(s): ' + JSON.stringify(tracklistRels.map(r => r.artist.name)));
// roles resolved
[['LeAnn Rimes','producer'],['Phil Hanseroth','composer'],['Phil Hanseroth','lyricist'],
 ['Trevor Lawrence Jr.','instrument','drum set'],['Darryl Jones','instrument','bass'],['Chris Stills','instrument','guitar'],
 ['Mark Batson','producer'],['Darrell Brown','instrument','string instruments'],['Rob Moose','instrument','string instruments'],
 ['NIKO BOLAS','recording'],['Ruadhri Cushnan','mix'],['Stuart Hawkes','mastering'],
 ['David Martinez','engineer','assistant'],['Alesandro Di Camillo','engineer','assistant']
].forEach(([n,lt,at]) => { if (!has(n,lt,at)) fail(`missing ${n} ${lt}${at?'['+at+']':''}`); });
// Main Artist / Associated Performer not imported; role-less people reported
if (tracklistRels.some(r => r.artist.name === 'Chris Walden' || r.artist.name === 'Cindi Peters')) fail('role-less person imported');
if (!skipped.some(s => /Chris Walden/.test(s)) || !skipped.some(s => /Cindi Peters/.test(s))) fail('role-less not reported');
console.log(ok ? 'PASS' : 'FAIL', '—', tracklistRels.length, 'rels,', skipped.length, 'skipped,', parsed.length, 'people');
process.exit(ok ? 0 : 1);
