import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('withheld artist links do not inflate the withheld platform count', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcDockStatus']);
  const seen = [];
  const run = new Function('seen', 'const pcDockFound = 2, pcDockHeld = 3, pcDockArtists = 3, pcDockArtistsHeld = 2; const pcDockItem = { status: s => seen.push(s) };\n' + src + '\nreturn pcDockStatus;')(seen);
  run(); check(seen[0] === '2,3/3', `the count matches the panel (${seen[0]})`);
});

test('a late artist lookup cannot replace a newer release count', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcLinkedFresh', 'pcCountLinks']);
  const pending = [], displayed = [];
  const api = new Function('pending', 'displayed', 'GM_getValue', 'mbDataGet', 'pcLinkRows', 'pcMbCredits', 'pcConfirmedCredits', 'pcLinkedTo', 'pcNewCount', 'appendLog',
    'let mbid = "first", _pcLinked = null; const document = {}; const pcLinkedKey = urls => urls.join(); function pcShowLinksCount(n) { displayed.push(n); }\n' + src + '\nreturn { count: pcCountLinks, follow: id => { mbid = id; } };')(
    pending, displayed, (_k, d) => d, () => ({}), () => ({ rows: [{ cells: { x: [{ url: 'https://example.com/x' }] } }] }), () => ({}), () => ({ byProvider: {} }), () => new Promise(resolve => pending.push(resolve)), (_rows, linked) => linked, () => {});
  const first = api.count(); api.follow('second'); const second = api.count();
  pending[1](2); await second; pending[0](9); await first;
  check(displayed.join() === '2', `the new release keeps its result (${displayed})`);
});
