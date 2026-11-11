import { test, check, functionSource } from '../../../dev/test/harness.mjs';

// Drive the shipped pass with each setup dependency held indefinitely. No network.
for (const stage of ['siblings', 'discogs', 'platform']) {
  test('Stop releases a stalled ' + stage + ' setup wait', { tag: '@unit' }, async () => {
    const source = await functionSource('apollo_editor', ['matchModelPass', 'stopMatching']);
    const waiter = await functionSource('apollo_editor', ['matchWait']).catch(() => '');
    const run = new Function('stage', `
      let _stopGen = 0, _matchStop = false, _matching = false, _autoMatching = false;
      let _wsInFlight = 0, _webInFlight = 0, _stopNote = null;
      const _matchWaits = new Set(), MATCH_STOPPED = {}, messages = [];
      const Log = { cat: () => ({ info: (...x) => messages.push(x.join(' ')), warn() {}, debug() {} }) };
      const document = { querySelector: () => null };
      const MODEL = { tracks: [{ slots: [{ _pending: true }] }] };
      const isEditingNow = () => false, setMatching = v => { _matching = v; };
      const startMatchLog = () => {}, endMatchLog = () => {}, refreshStatus = () => {};
      const unresolvedIn = () => 1, updateStatus = () => {};
      const tagDiscogsForAll = () => {}, tagPlatformForAll = () => {};
      let entered, release;
      const reached = new Promise(r => { entered = r; });
      const hold = () => { entered(); return new Promise(r => { release = r; }); };
      const loadSiblingMap = () => stage === 'siblings' ? hold() : Promise.resolve(new Map());
      const loadDiscogsMap = () => stage === 'discogs' ? hold() : Promise.resolve(null);
      const prewarmPlatformLinks = () => hold();
      ${waiter}
      ${source}
      return (async () => {
        const pass = matchModelPass();
        await reached;
        stopMatching();
        const ended = await Promise.race([pass.then(() => true), new Promise(r => setTimeout(() => r(false), 300))]);
        const out = { ended, matching: _matching, pending: MODEL.tracks[0].slots[0]._pending, note: _stopNote };
        if (ended) release(new Map());
        await Promise.resolve();
        return out;
      })();
    `);
    const out = await run(stage);
    check(out.ended && !out.matching, 'the pass ends without its setup request returning');
    check(out.pending && /stopped/.test(out.note?.msg || ''), 'unmatched work is kept for retry and the stop is reported');
  });
}
