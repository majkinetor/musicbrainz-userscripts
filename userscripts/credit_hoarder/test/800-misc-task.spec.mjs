// Unit (#800): a misc role's task is MB's free-text "credited task", so it must read as the whole
// job. "Coordinator [Album]" gave task "album" (the bracket replaced the role name). The cases are
// real bracketed roles from Discogs releases, one per bracket shape. Each mapped role also keeps
// the Discogs role it came from, for the review table's tooltip.
import { test, check as hcheck } from '../../../dev/test/harness.mjs';

test('misc task keeps the role name; mapped roles keep their source role', { tag: '@unit' }, async () => {
  globalThis.window = globalThis.window || globalThis;
  if (typeof globalThis.BroadcastChannel === 'undefined') {
      globalThis.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
  }
  const { getArtistRoles } = await import('../src/mappers.js');
  const check = (label, cond) => hcheck(cond, label);
  const show = role => getArtistRoles({ role, name: 'X', anv: '' }).map(r => r.linkType + (r.attributes || []).map(a => typeof a === 'object' ? ':' + a.value : '+' + a).join(''));
  const is = (role, want) => { const got = show(role); console.log(role, '=>', JSON.stringify(got)); check(`${role} → ${want.join(', ')} (got ${got.join(', ')})`, got.join('|') === want.join('|')); };

  // no bracket: the role itself
  is('Coordinator', ['misc:coordinator']);
  // scope: bracket before the role
  is('Coordinator [Album]', ['misc:album coordinator']);
  is('Management [Media]', ['misc:media management']);
  is('Research [Discographical Data]', ['misc:discographical data research']);
  is('Concept By [Album]', ['misc:album concept']);
  // the bracket already names the job
  is('A&R [A&R Coordination By]', ['misc:a&r coordination by']);
  is('Supervised By [Mixing Supervised By]', ['misc:mixing supervised by']);
  is('Management [Tour Manager]', ['misc:tour manager']);
  // a preposition: after the role
  is('Management [For Gold Mountain Entertainment]', ['misc:management for gold mountain entertainment']);
  // a catch-all base: the bracket is the job
  is('Other [Hair]', ['misc:hair']);
  is('Crew [Lighting]', ['misc:lighting']);
  // a modifier word stays in the task (misc takes no assistant attribute, #295)
  is('Coordinator [Assistant]', ['misc+assistant:assistant coordinator']);
  // production: MB's own production coordinator type (release only; misc on a track)
  is('Coordinator [Production]', ['production coordinator']);
  is('Coordinator [Production Coordinator]', ['production coordinator']);
  is('Coordinator [Production Coordination]', ['production coordinator']);
  is('Coordinator [Post-Production]', ['misc:post-production coordinator']);
  const pc = getArtistRoles({ role: 'Coordinator [Production]', name: 'X', anv: '' })[0];
  check('production coordinator goes on a track as misc with its task', pc.onRecording?.linkType === 'misc' && pc.onRecording.attributes[0].value === 'production coordinator');
  // the other task roles are unchanged: their type already names the role
  is('Engineer [Technical]', ['engineer:technical']);
  is('Mixed By [Concerts]', ['mix:concerts']);
  is('Photography By [Cover Photo]', ['photography:cover photo']);

  const src = getArtistRoles({ role: 'Coordinator [Album], Bass', name: 'X', anv: '' }).map(r => r.sourceRole);
  check(`source roles kept (got ${JSON.stringify(src)})`, JSON.stringify(src) === JSON.stringify(['Coordinator [Album]', 'Bass']));
});
