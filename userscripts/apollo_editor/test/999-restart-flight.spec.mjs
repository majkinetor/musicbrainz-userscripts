import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('a restarted match does not rejoin a stopped alias search', { tag: '@unit' }, async () => {
  const source = await functionSource('apollo_editor', ['wsJson', 'matchWait', 'stopMatching']);
  const run = new Function(`
    let _stopGen = 0, _matchStop = false, _matching = true, _autoMatching = false;
    const _wsInFlight = 0, _webInFlight = 0, _wsFlight = new Map(), _matchWaits = new Set(), MATCH_STOPPED = {};
    const document = { querySelector: () => null };
    const Log = { cat: () => ({ info() {}, debug() {}, warn() {} }) };
    let calls = 0, late;
    const wsJsonOnce = () => ++calls === 1 ? new Promise(r => { late = r; }) : Promise.resolve({ json: { artists: [] } });
    ${source}
    return (async () => {
      const first = wsJson('alias');
      stopMatching();
      const stopped = await Promise.race([first, new Promise(r => setTimeout(() => r({ hung: true }), 300))]);
      _matchStop = false;
      const second = await Promise.race([wsJson('alias'), new Promise(r => setTimeout(() => r({ hung: true }), 300))]);
      late({ json: { artists: ['obsolete'] } });
      return { stopped, second, calls };
    })();
  `);
  const out = await run();
  check(out.stopped.stale, 'Stop settles the shared search as superseded');
  check(out.calls === 2 && Array.isArray(out.second.json?.artists), 'Match makes a fresh lookup instead of joining the stopped flight');
});
