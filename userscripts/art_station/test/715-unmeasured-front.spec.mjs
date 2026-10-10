// #715: a front the Cover Art Archive hasn't processed yet doesn't load, so it measured 0×0 and every
// cover found counted as larger: Mission Control offered to replace it (Falcon had just entered the
// same 3000×3000 cover). No cover is 0×0, so a 0×0 front is unmeasured: nothing is compared, nothing
// replaced. The shipped vsFronts, which the probe and the apply both use.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('a 0×0 front is unmeasured: never smaller, never replaced', { tag: '@unit' }, async () => {
  const vsFronts = new Function(`${await functionSource('art_station', ['vsFronts'])}; return vsFronts;`)();
  const best = { w: 3000, h: 3000 };

  const u = vsFronts(best, [{ id: 1, w: 0, h: 0 }]);
  check(u.unknown && !u.larger && !u.replace, `one unprocessed front: unknown, not larger, not replaced (${JSON.stringify(u)})`);

  const m = vsFronts(best, [{ id: 1, w: 500, h: 500 }, { id: 2, w: 0, h: 0 }]);
  check(m.unknown && !m.larger && !m.replace, 'one of several fronts unprocessed: still nothing compared');

  const s = vsFronts(best, [{ id: 1, w: 500, h: 500 }]);
  check(!s.unknown && s.larger && s.replace, 'a measured smaller front is still replaced');

  const b = vsFronts(best, [{ id: 1, w: 3000, h: 3000 }]);
  check(!b.unknown && !b.larger && !b.replace, 'a measured front as large is kept');

  const n = vsFronts(best, []);
  check(!n.unknown && n.larger && !n.replace && !n.top, 'no front: the best is entered');
});
