// #310 — per-track Tidal roles route through the shared resolver, so instruments,
// vocals, arranger, editor, etc. import instead of being dropped. Pure node test
// (window stubbed because constants.js references it for the browser build).
globalThis.window = globalThis; globalThis.unsafeWindow = globalThis;
const { tidalToEngine } = await import('../src/sources/tidal.js');
const N = id => ({ name: 'X' + id, tidalId: String(id) });
const tracks = [{ num: '1', title: 'T1', credits: [
  { role: 'Producer', names: [N(1)] }, { role: 'Assistant Producer', names: [N(2)] },
  { role: 'Composer', names: [N(3)] }, { role: 'Lyricist', names: [N(4)] },
  { role: 'Mixing Engineer', names: [N(5)] }, { role: 'Recording Engineer', names: [N(6)] },
  { role: 'Assistant Engineer', names: [N(7)] }, { role: 'Mastering Engineer', names: [N(8)] },
  { role: 'Associated Performer', names: [N(9)] }, { role: 'Bass', names: [N(10)] },
  { role: 'Bass guitar', names: [N(11)] }, { role: 'Drums', names: [N(12)] },
  { role: 'Guitar', names: [N(13)] }, { role: 'Piano', names: [N(14)] },
  { role: 'Keyboards', names: [N(15)] }, { role: 'Strings', names: [N(16)] },
  { role: 'Vocal', names: [N(17)] }, { role: 'Background Vocal', names: [N(18)] },
  { role: 'Performance Arranger', names: [N(19)] }, { role: 'Editor', names: [N(20)] },
  { role: 'Coordinator', names: [N(21)] },
] }];
const { tracklistRels, skipped } = tidalToEngine(tracks);
const m = {}; for (const r of tracklistRels) m[r.artist.name] = { lt: r.linkType, at: (r.attributes || []).map(a => typeof a === 'string' ? a : a.value) };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const checks = [
  ['X1', { lt: 'producer', at: [] }], ['X2', { lt: 'producer', at: ['assistant'] }],
  ['X3', { lt: 'composer', at: [] }], ['X4', { lt: 'lyricist', at: [] }],
  ['X5', { lt: 'mix', at: [] }], ['X6', { lt: 'recording', at: [] }],
  ['X7', { lt: 'engineer', at: ['assistant'] }],
  ['X10', { lt: 'instrument', at: ['bass'] }], ['X11', { lt: 'instrument', at: ['bass guitar'] }],
  ['X12', { lt: 'instrument', at: ['drum set'] }], ['X13', { lt: 'instrument', at: ['guitar'] }],
  ['X14', { lt: 'instrument', at: ['piano'] }], ['X15', { lt: 'instrument', at: ['keyboard'] }],
  ['X16', { lt: 'instrument', at: ['string instruments'] }],
  ['X17', { lt: 'vocal', at: [] }], ['X18', { lt: 'vocal', at: ['background vocals'] }],
  ['X19', { lt: 'arranger', at: [] }], ['X20', { lt: 'editor', at: [] }],
];
let ok = true;
for (const [k, want] of checks) { const got = m[k]; const pass = eq(got, want); if (!pass) ok = false; if (!pass) console.log('FAIL', k, 'want', JSON.stringify(want), 'got', JSON.stringify(got)); }
// Mastering Engineer (release-level) + Associated Performer (redundant) are skipped, not imported
if (m.X8 || m.X9) { ok = false; console.log('FAIL: X8/X9 should be skipped'); }
if (skipped.length !== 2) { ok = false; console.log('FAIL: expected 2 skipped, got', skipped.length); }
console.log(ok ? 'PASS' : 'FAIL', '—', tracklistRels.length, 'rels,', skipped.length, 'skipped');
process.exit(ok ? 0 : 1);
