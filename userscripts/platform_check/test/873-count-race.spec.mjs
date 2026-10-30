import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('an older artist-link count cannot replace the newer release count', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcUrlKey', 'pcMarkCell', 'pcLinkedKey', 'pcLinkedFresh', 'pcNewCount', 'pcShowLinksCount', 'pcCountLinks']);
  const pending = [];
  const button = { innerHTML: '', classList: { toggle() {} } };
  const create = new Function('document', 'GM_getValue', 'mbDataGet', 'pcLinkRows', 'pcMbCredits', 'pcConfirmedCredits', 'pcLinkedTo', 'appendLog',
    'let mbid = "first", _pcLinked = null, pcDockArtists = null, pcDockArtistsHeld = 0; function pcDockStatus() {}\n' + src + '\nreturn { count: pcCountLinks, key: pcUrlKey, follow: id => { mbid = id; } };');
  const env = create({ getElementById: () => button }, (key, value) => value, () => ({}),
    () => ({ rows: [{ type: 'artist', mbid: 'a', cells: { p: [{ url: 'https://example.com/a' }] } }] }),
    () => ({}), () => ({ byProvider: {} }), () => new Promise(resolve => pending.push(resolve)), () => {});
  const first = env.count();
  env.follow('second');
  const second = env.count();
  pending[1](new Map());
  await second;
  pending[0](new Map([[env.key('https://example.com/a'), [{ type: 'artist', mbid: 'a' }]]]));
  await first;
  check(button.innerHTML.includes('pc-links-n">1</span>'), 'the second release keeps its count when the older lookup finishes last');
});

test('cache duration and disabling reuse affect the next scan', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcTtlOf', 'pcScan']);
  const values = { 'pc:cache-days': 7, 'pc:cache-enabled': false }, cleared = [];
  const env = new Function('GM_getValue', 'cacheClear', 'mbid', 'PC_SCAN', 'runScans', 'localStorage',
    'const pcDirty = new Set(), pcSources = new Set(), document = { getElementById: () => null }; let _pcLinked = null; function pcCountLinks() {} function pcLinkedFresh() {}\n' + src + '\nreturn { pcTtlOf, pcScan };')(
    (k, d) => k in values ? values[k] : d, id => cleared.push(id), 'release', {}, () => Promise.resolve(), { getItem: () => null, removeItem() {} });
  check(env.pcTtlOf('pc:cache:v2:deezer:release', { url: 'x' }) === 7 * 864e5, 'the configured duration applies to a found link');
  await env.pcScan();
  check(cleared.join() === 'release', 'disabling the cache discards earlier results before scanning');
  values['pc:cache-enabled'] = true;
  await env.pcScan();
  check(cleared.length === 1, 'an enabled cache remains available to the next scan');
});

test('only completed Falcon items invalidate the release', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcFalconStatus']);
  const pending = new Map([['mc:pc:run', { release: 'release', seen: new Set() }]]), invalidated = [];
  const handler = new Function('pcMcPending', 'pcMarkDirty', src + '\nreturn pcFalconStatus;')(pending, r => invalidated.push(r));
  const send = (status, running = true) => handler({ detail: JSON.stringify({ tag: 'mc:pc:run', running, items: [{ entityType: 'release', mbid: 'release', status }] }) });
  send('queued'); send('active'); send('failed', false);
  check(invalidated.length === 0, 'queued and failed work do not invalidate');
  pending.set('mc:pc:run', { release: 'release', seen: new Set() });
  send('done'); send('done', false);
  check(invalidated.join() === 'release', 'a completed item invalidates once');
});
