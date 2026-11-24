import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('the narrow search tier takes its hits from a suggestion search that was not cut', { tag: '@unit' }, async () => {
  const source = await functionSource('apollo_editor', ['recNarrowFromSuggest']);
  const run = new Function(`
    const u = v => typeof v === 'function' ? v() : v;
    const acArtistGids = ac => (ac.names || []).map(n => n.gid).filter(Boolean);
    ${source}
    const linked = { name: 'Blue Moon', length: 200000, artistCredit: { names: [{ gid: 'A' }, { gid: 'B' }] } };
    const typed = { name: 'Blue Moon', length: 200000, artistCredit: { names: [{ gid: 'A' }, { name: 'Typed' }] } };
    const raw = [
      { gid: '1', artistGids: ['A', 'B'], length: 205000 },
      { gid: '2', artistGids: ['A'], length: 200000 },
      { gid: '3', artistGids: ['A', 'B'], length: 210400 },
      { gid: '4', artistGids: ['B', 'A', 'C'], length: 190000 },
      { gid: '5', artistGids: ['A', 'B'], length: null },
    ];
    return {
      got: recNarrowFromSuggest(linked, raw).map(d => d.gid).join(),
      cut: recNarrowFromSuggest(linked, new Array(25).fill(raw[0])),
      typed: recNarrowFromSuggest(typed, raw),
      none: recNarrowFromSuggest(linked, null),
    };
  `);
  const out = await run();
  check(out.got === '1,4', 'kept the hits with every artist and a length within 10 s: ' + out.got);
  check(out.cut === null, 'a search cut at its limit of 25 is not used');
  check(out.typed === null, 'a credit with a typed artist sends the search');
  check(out.none === null, 'no suggestion search sends the search');
});
