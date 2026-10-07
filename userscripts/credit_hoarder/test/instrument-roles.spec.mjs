// Unit (#686): instrument roles from Discogs release 34839779 (Saimaa ja Yona, Solovey). Each band
// member's "Band [Saimaa And Yona], Bass" gave a bare "instrument" credit beside the bass, so
// MB listed every member again under a plain "instruments:"; "Soloist [Trumpet Solo]" lost both
// the trumpet and the solo; "Voice [Humming]" was dropped; and a bracket naming a more specific
// instrument (Electric Organ [B3], Electric Piano [Rhodes], Guitar [12-String Guitar], …) was
// ignored.
import { test, check as hcheck } from '../../../dev/test/harness.mjs';

test('instrument roles: band membership, soloist, voice, specific brackets', { tag: '@unit' }, async () => {
  globalThis.window = globalThis.window || globalThis;
  if (typeof globalThis.BroadcastChannel === 'undefined') {
      globalThis.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
  }
  const { getArtistRoles } = await import('../src/mappers.js');
  const check = (label, cond) => hcheck(cond, label);
  const show = role => getArtistRoles({ role, name: 'X', anv: '' }).map(r => r.linkType + (r.attributes || []).map(a => typeof a === 'object' ? ':' + a.value : '+' + a).join(''));
  const is = (role, want) => { const got = show(role); console.log(role, '=>', JSON.stringify(got)); check(`${role} → ${want.join(', ')} (got ${got.join(', ')})`, got.join('|') === want.join('|')); };

  // band membership adds nothing beside what the member played or sang
  is('Band [Saimaa And Yona], Bass', ['instrument:bass']);
  is('Band [Saimaa And Yona], Vocals', ['vocal']);
  is('Band [Saimaa And Yona], Electric Organ [B3], Electric Piano [Rhodes]', ['instrument:hammond organ', 'instrument:rhodes piano']);
  // alone, it is still the one thing known
  is('Band [Saimaa And Yona]', ['instrument']);
  is('Orchestra [Saku Mandoliinid], Musician', ['orchestra', 'instrument']);
  // soloist: the instrument from the bracket, with solo
  is('Soloist [Trumpet Solo], Trumpet, Flugelhorn', ['instrument:trumpet+solo', 'instrument:trumpet', 'instrument:flugelhorn']);
  is('Soloist [Moog Solo], Synthesizer [Moog], Synthesizer [Other Synthesizers]', ['instrument:moog+solo', 'instrument:moog', 'instrument:synthesizer']);
  // voice
  is('Voice [Humming]', ['vocal']);
  // a bracket that names the instrument more exactly
  is('Piano [In The Beginning], Guitar [12-String Guitar]', ['instrument:piano', 'instrument:12 string guitar']);
  is('Acoustic Guitar [Nylon Guitar Melody], Baritone Guitar', ['instrument:classical guitar', 'instrument:baritone guitar']);
  is('Acoustic Guitar, Lute [Electric Tanpura]', ['instrument:acoustic guitar', 'instrument:tambura']);
  // …but never overrides a base on its own (#223)
  is('Bass [Guitar]', ['instrument:bass']);
  is('Guitar [Other Guitars]', ['instrument:guitar']);
});
