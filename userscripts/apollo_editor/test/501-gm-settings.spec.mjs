// #501 (majkinetor): "some user settings are stored in the script manager while others
// use localStorage... painful in Apollo when restoring backups or moving data to another
// browser." Apollo's settings and its log window's state live in GM storage, which a
// manager backs up and syncs. Once, on the first load after the change, an old
// localStorage value is adopted into GM storage; the old key is left in place, unused.
// The shipped gmLoad, with GM storage and localStorage stood in for.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

const KEY = 'apolloEditor.settings.v1';
async function gmLoadWith(gm, ls) {
  const store = new Map(Object.entries(gm)), local = new Map(Object.entries(ls));
  const gmLoad = new Function('GM_getValue', 'GM_setValue', 'localStorage', `${await functionSource('apollo_editor', ['gmLoad'])}; return gmLoad;`)(
    (k, d) => (store.has(k) ? store.get(k) : d), (k, v) => store.set(k, v), { getItem: k => (local.has(k) ? local.get(k) : null) });
  return { value: gmLoad(KEY), gm: store.get(KEY), ls: local.get(KEY) };
}

test('settings come from GM storage, adopting an old localStorage copy once', { tag: '@unit' }, async () => {
  const fresh = await gmLoadWith({}, {});
  check(fresh.value === undefined && fresh.gm === undefined, 'nothing stored: the defaults apply');

  const old = JSON.stringify({ zenMode: false, applyMode: 'selected', recLenTol: 42 });
  const adopted = await gmLoadWith({}, { [KEY]: old });
  check(adopted.value === old, 'an old localStorage copy is read');
  check(adopted.gm === old, '…and written into GM storage');
  check(adopted.ls === old, '…and left where it was');

  const gm = JSON.stringify({ zenMode: true, applyMode: 'all', recLenTol: 7 });
  const both = await gmLoadWith({ [KEY]: gm }, { [KEY]: JSON.stringify({ recLenTol: 999 }) });
  check(both.value === gm && both.gm === gm, 'GM storage, when it has a value, wins');
});
