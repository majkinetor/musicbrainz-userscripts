// Unit: Discogs "Ensemble" role now maps to MB `performer` (was dropped).
// mappers.js → constants.js touches `window` / BroadcastChannel at load; stub
// the bare minimum so the pure mapping logic can run under node.
import { test, check as hcheck } from '../../../dev/test/harness.mjs';

test('the Discogs Ensemble role maps to performer', { tag: '@unit' }, async () => {
  globalThis.window = globalThis.window || globalThis;
  if (typeof globalThis.BroadcastChannel === 'undefined') {
      globalThis.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
  }
  const { getArtistRoles } = await import('../src/mappers.js');
  const check = (label, cond) => hcheck(cond, label);

  const roles = getArtistRoles({ role: 'Ensemble', name: 'Heikki Sarmanto Ensemble', anv: '' });
  console.log('getArtistRoles(Ensemble) =>', JSON.stringify(roles.map(r => ({ linkType: r.linkType, entityType: r.entityType }))));
  check('Ensemble yields exactly one role', roles.length === 1);
  check('Ensemble → linkType "performer"', roles[0] && roles[0].linkType === 'performer');
  check('Ensemble → entityType "artist"', roles[0] && roles[0].entityType === 'artist');
  check('Ensemble role carries the artist', roles[0] && roles[0].artist && roles[0].artist.name === 'Heikki Sarmanto Ensemble');

  // sanity: a multi-role string still splits and maps each
  const multi = getArtistRoles({ role: 'Ensemble, Conductor', name: 'X', anv: '' });
  check('"Ensemble, Conductor" → 2 roles', multi.length === 2);
  check('  first is performer', multi[0]?.linkType === 'performer');
  check('  second is conductor', multi[1]?.linkType === 'conductor');
});
