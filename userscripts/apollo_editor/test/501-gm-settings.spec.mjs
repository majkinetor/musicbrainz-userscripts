// #501 (majkinetor): "some user settings are stored in the script manager while others
// use localStorage... painful in Apollo when restoring backups or moving data to another
// browser." Apollo's settings and its log window's state live in GM storage, which a
// manager backs up and syncs. The one-time adoption of an old localStorage copy is
// retired (#623): localStorage is not read at all.
// The shipped gmLoad, with GM storage and localStorage stood in for.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

const KEY = 'apolloEditor.settings.v1';
async function gmLoadWith(gm, ls) {
  const store = new Map(Object.entries(gm)), local = new Map(Object.entries(ls));
  const gmLoad = new Function('GM_getValue', 'GM_setValue', 'localStorage', `${await functionSource('apollo_editor', ['gmLoad'])}; return gmLoad;`)(
    (k, d) => (store.has(k) ? store.get(k) : d), (k, v) => store.set(k, v), { getItem: k => (local.has(k) ? local.get(k) : null) });
  return { value: gmLoad(KEY), gm: store.get(KEY) };
}

test('settings come from GM storage alone', { tag: '@unit' }, async () => {
  const fresh = await gmLoadWith({}, {});
  check(fresh.value === undefined && fresh.gm === undefined, 'nothing stored: the defaults apply');

  const gm = JSON.stringify({ zenMode: true, applyMode: 'all', recLenTol: 7 });
  check((await gmLoadWith({ [KEY]: gm }, {})).value === gm, 'a GM value is read');

  const old = await gmLoadWith({}, { [KEY]: JSON.stringify({ recLenTol: 999 }) });
  check(old.value === undefined && old.gm === undefined, 'an old localStorage copy is neither read nor copied');
});
