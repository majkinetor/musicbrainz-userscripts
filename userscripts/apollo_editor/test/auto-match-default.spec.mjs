// majkinetor: tracklist and recordings auto-match are on by default. Apollo saves its
// whole settings object, so an existing install has the old `false` stored for both;
// a one-time migration switches them on, and the `autoMatchOnV` marker it saves makes
// turning them off again stick.
// The shipped loadSettings, with GM storage stood in for.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

async function loadWith(stored) {
  const loadSettings = new Function('gmLoad', 'SKEY', `${await functionSource('apollo_editor', ['loadSettings'])}; return loadSettings;`)(
    () => (stored === undefined ? undefined : JSON.stringify(stored)), 'apolloEditor.settings.v1');
  return loadSettings();
}

test('tracklist and recordings auto-match default on, once', { tag: '@unit' }, async () => {
  const fresh = await loadWith(undefined);
  check(fresh.autoMatch === true && fresh.autoMatchRec === true, 'a new install matches tracklist and recordings on load');

  const old = await loadWith({ autoMatch: false, autoMatchRec: false, zenMode: false });
  check(old.autoMatch === true && old.autoMatchRec === true, 'an existing install with the old defaults stored is switched on');
  check(old.zenMode === false, 'the migration leaves the other stored settings alone');
  check(old.autoMatchOnV === 1, 'the marker is in the object, so the next save records the migration as done');

  const off = await loadWith({ autoMatch: false, autoMatchRec: false, autoMatchOnV: 1 });
  check(off.autoMatch === false && off.autoMatchRec === false, 'turned off after the migration: stays off');
});
