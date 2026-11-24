import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('recording suggestions keep and order what MusicBrainz keeps', { tag: '@unit' }, async () => {
  const source = await functionSource('apollo_editor', ['mbSimilarity', 'mbMatchRecordings', 'recLev']);
  const run = new Function(`
    const u = v => typeof v === 'function' ? v() : v;
    const MB_PUNCT = /[!"#$%&'()*+,\\-.>/:;<=>?¿@[\\\\\\]^_\`{|}~⁓〜\\u2000-\\u206F\\s]/g;
    ${source}
    const ko = { name: 'Blue Moon', length: 200000 };
    const recs = [
      { gid: 'a', name: 'Blue Moon', length: 260000, releases: [] },
      { gid: 'b', name: 'Blue Moon (live)', length: 201000, releases: [{ rgGid: 'x' }, { rgGid: 'x' }] },
      { gid: 'c', name: 'Blue moon!', length: 200000, releases: [{ rgGid: 'x' }, { rgGid: 'y' }] },
      { gid: 'd', name: 'Red Sun', length: 150000, releases: [] },
    ];
    return { got: (mbMatchRecordings(ko, recs) || []).map(d => d.gid), none: mbMatchRecordings(ko, [recs[3]]) };
  `);
  const out = await run();
  check(out.got.join() === 'c,b,a', 'kept a, b, c and sorted them by score with the release-group bonus: ' + out.got.join());
  check(out.none === null, 'a recording with another title is dropped');
});
