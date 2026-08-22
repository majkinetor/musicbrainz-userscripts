// #291: feed every Discogs role on the release through CH's real mappers and
// report which produce an MB relationship vs which are IGNORED.
globalThis.window = globalThis.window || globalThis;
if (typeof globalThis.BroadcastChannel === 'undefined') globalThis.BroadcastChannel = class { postMessage(){} addEventListener(){} removeEventListener(){} close(){} };
const { getArtistRoles } = await import('../src/mappers.js');
const { ENTITY_TYPE_MAP } = await import('../src/data/entity-map.js');
const { INSTRUMENTS } = await import('../src/data/instruments.js');

// every distinct Discogs ARTIST role on the release (extraartists + tracklist)
const artistRoles = ['Artwork', 'Bass Guitar', 'Cello', 'Drums', 'Guitar', 'Keyboards',
  'Mastered By', 'Percussion', 'Photography By', 'Producer', 'Recorded By', 'Research',
  'Composed By', 'Arranged By'];
// every distinct Discogs COMPANY role (entity_type_name)
const companyRoles = ['Mastered At', 'Phonographic Copyright (p)', 'Copyright (c)', 'Recorded At'];

const INSTR_CI = Object.fromEntries(Object.entries(INSTRUMENTS).map(([k, v]) => [k.toLowerCase(), v]));

console.log('=== ARTIST roles ===');
for (const role of artistRoles) {
  const out = getArtistRoles({ role, name: 'x', anv: '' });
  const r = out && out[0];
  let verdict;
  if (r && r.linkType) verdict = `→ ${r.linkType}` + (r.attributes ? ` ${JSON.stringify(r.attributes)}` : '');
  else if (Object.prototype.hasOwnProperty.call(INSTR_CI, role.toLowerCase())) verdict = INSTR_CI[role.toLowerCase()] === null ? '→ instrument (bare, no specific instrument)' : `→ instrument "${INSTR_CI[role.toLowerCase()]}"`;
  else verdict = '✗ IGNORED (no mapping)';
  console.log(`  ${role.padEnd(16)} ${verdict}`);
}

console.log('\n=== COMPANY roles (entity_type_name) ===');
for (const role of companyRoles) {
  const m = ENTITY_TYPE_MAP[role];
  console.log(`  ${role.padEnd(28)} ${m && m.linkType ? '→ ' + m.linkType : (m === null ? '(explicitly skipped)' : '✗ IGNORED (no mapping)')}`);
}
