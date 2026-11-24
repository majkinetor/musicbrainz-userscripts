import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('a booking counts the requests waiting, and a moved slot is said', { tag: '@unit' }, async () => {
  const source = await functionSource('string_theory', ['stGateEvents', 'stGateSec', 'stGateWhat']);
  const run = new Function(`
    var ST_GATE_PRE = 'mbu:mb-gate-trace:';
    var store = {};
    var localStorage = { get length() { return Object.keys(store).length; }, key: i => Object.keys(store)[i], getItem: k => store[k] ?? null };
    const ev = (t, e, l, x) => Object.assign({ t, s: 'Apollo Editor', e, l, b: 1 }, x);
    store[ST_GATE_PRE + 'aaaa'] = JSON.stringify([
      ev(1000, 'book', 'one', { w: 500 }),
      ev(1010, 'book', 'two', { w: 600 }),
      ev(1500, 'start', 'one'),
    ]);
    store[ST_GATE_PRE + 'bbbb'] = JSON.stringify([
      { t: 1020, s: 'Event Horizon', e: 'book', l: 'three', b: 0, w: 1300, q: 13 },
      { t: 1100, s: 'Event Horizon', e: 'moved', l: 'three', b: 0, w: 1200, to: 2400 },
      { t: 1600, s: 'Event Horizon', e: 'book', l: 'four', b: 0, w: 900 },
    ]);
    ${source}
    return stGateEvents().map(e => e.l + ' ' + e.e + ': ' + stGateWhat(e));
  `);
  const out = run();
  const line = (l, e) => out.find(x => x.startsWith(l + ' ' + e + ':')) || '';
  check(/no other request waits/.test(line('one', 'book')), 'the first booking waits alone: ' + line('one', 'book'));
  check(/1 other request waits/.test(line('two', 'book')), 'the second sees one: ' + line('two', 'book'));
  check(/2 other requests wait/.test(line('three', 'book')) && !/queued/.test(line('three', 'book')), 'another tab counts, and no slot count: ' + line('three', 'book'));
  check(/2 other requests wait/.test(line('four', 'book')), 'a started request no longer waits: ' + line('four', 'book'));
  check(/moved it 1.2s later, now waits 2.4s/.test(line('three', 'moved')), 'the moved slot is said: ' + line('three', 'moved'));
});
