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
  const values = { 'pc:cache-days': 7, 'pc:cache-enabled': false }, cleared = [], saved = new Map();
  const storage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const env = new Function('GM_getValue', 'cacheClear', 'mbid', 'PC_SCAN', 'runScans', 'localStorage',
    'const pcDirty = new Set(), pcSources = new Set(), document = { getElementById: () => null }; let _pcLinked = null, pcDockStale = false, pcDockFailed = false; function pcDockStatus() {} function pcCountLinks() {} function pcLinkedFresh() {}\n' + src + '\nreturn { pcTtlOf, pcScan };')(
    (k, d) => k in values ? values[k] : d, id => cleared.push(id), 'release', { errors: new Map() }, () => Promise.resolve(), storage);
  check(env.pcTtlOf('pc:cache:v2:deezer:release', { url: 'x' }) === 7 * 864e5, 'the configured duration applies to a found link');
  values['pc:cache-days'] = 'default';
  check(env.pcTtlOf('pc:cache:v2:deezer:release', { url: null }) === 90 * 864e5 && env.pcTtlOf('pc:mbdata:release', {}) === 90 * 864e5, 'the former default migrates to 90 days for misses and MusicBrainz data');
  values['pc:cache-days'] = 7;
  await env.pcScan();
  check(cleared.join() === 'release', 'disabling the cache discards earlier results before scanning');
  check(saved.has('pc:incomplete:release'), 'an in-progress scan is marked incomplete');
  storage.removeItem('pc:incomplete:release');
  values['pc:cache-enabled'] = true;
  await env.pcScan();
  check(cleared.length === 1, 'an enabled cache remains available to the next scan');
  await env.pcScan();
  check(cleared.length === 2, 'an interrupted scan is discarded on the next scan');
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

test('failed scan requests stay incomplete until a successful retry', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcGmRequest']);
  const scan = { live: new Set(), errors: new Map() };
  let fail = true;
  const send = new Function('PC_SCAN', 'pcStale', 'GM_xmlhttpRequest', src + '\nreturn pcGmRequest;')(
    scan, () => false, opts => { queueMicrotask(() => fail ? opts.onerror({}) : opts.onload({})); return {}; });
  const request = () => new Promise(resolve => send({ url: 'https://provider.test/', onload: () => ({ status: 200 }), onerror: () => ({ status: 0 }), ontimeout: () => ({ status: 0 }) }, resolve, 1));
  await request();
  check(scan.errors.has('https://provider.test/'), 'a network failure marks the scan incomplete');
  fail = false; await request();
  check(scan.errors.size === 0, 'a successful retry clears that failure');
});

test('cancelling a scan releases callers waiting for it', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcCancelScan']);
  let signalled = 0;
  const state = { n: 0, live: new Set(), cancel: () => { signalled++; } };
  const cancel = new Function('PC_SCAN', 'let _appleTokP, _sdKeyP, _amzSession, searchChain;\n' + src + '\nreturn pcCancelScan;')(state);
  cancel();
  check(signalled === 1, 'a waiting scan promise is released on cancellation');
});

test('the launcher marks failures but not an invalidated or uncounted result with a question mark', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcDockStatus']);
  const statuses = [];
  const env = new Function('statuses', 'GM_getValue',
    'let pcDockFound = 2, pcDockHeld = 0, pcDockArtists = null, pcDockArtistsHeld = 0, pcDockStale = false, pcDockFailed = false; const pcDockItem = { status: s => statuses.push(s) };\n' + src + '\nreturn { show: pcDockStatus, stale: v => { pcDockStale = v; }, failed: v => { pcDockFailed = v; } };')(statuses, (_key, fallback) => fallback);
  env.show();
  check(statuses.at(-1) === '2', 'a pending artist count does not mark known platform results as failed');
  env.stale(true); env.show();
  check(statuses.at(-1) !== '?', 'an invalidated count is not a failure');
  env.failed(true); env.show();
  check(statuses.at(-1) === '?', 'a failed scan is marked with a question mark');
});

test('the launcher withheld count excludes withheld artist links', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcDockStatus']);
  const statuses = [];
  const show = new Function('statuses', 'GM_getValue',
    'const pcDockFound = 2, pcDockHeld = 3, pcDockArtists = 3, pcDockArtistsHeld = 2, pcDockStale = false, pcDockFailed = false; const pcDockItem = { status: s => statuses.push(s) };\n' + src + '\nreturn pcDockStatus;')(statuses, (_key, fallback) => fallback);
  show();
  check(statuses.at(-1) === '2,3/3', `platforms to add, withheld platforms and artist links should be separate (${statuses.at(-1)})`);
});

test('an artist edit keeps the existing platform count while invalidating the artist count', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcShowUnverified', 'pcDockStatus']);
  const statuses = [];
  const api = new Function('statuses', 'GM_getValue',
    'let pcDockFound = 2, pcDockHeld = 3, pcDockArtists = 3, pcDockArtistsHeld = 2, pcDockStale = false, pcDockFailed = false; const pcDockItem = { status: s => statuses.push(s) }; function pcShowLinksCount(n) { pcDockArtists = n; pcDockStatus(); }\n' + src + '\nreturn { invalidate: pcShowUnverified };')(statuses, (_key, fallback) => fallback);
  api.invalidate(true);
  check(statuses.at(-1) === '2,3', `release counts remain visible after artist edits (${statuses.at(-1)})`);
  api.invalidate(false);
  check(statuses.at(-1) === '', 'release edits still hide stale platform counts');
});

test('Falcon artist completions invalidate artist counts without discarding platform counts', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcFalconStatus']);
  const pending = new Map([['pc:links:run', { release: 'release', seen: new Set() }]]), scopes = [];
  const handler = new Function('pcMcPending', 'pcMarkDirty', src + '\nreturn pcFalconStatus;')(pending, (...args) => scopes.push(args[4]));
  handler({ detail: JSON.stringify({ tag: 'pc:links:run', running: false, items: [{ entityType: 'artist', mbid: 'a', status: 'done' }] }) });
  check(scopes[0] === true, 'artist-only completion preserves platform results');
});

test('PC explicitly tells the minimized dock which results are actionable', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcDockStatus']);
  const seen = [];
  const api = new Function('seen', 'GM_getValue',
    'let pcDockFound = 0, pcDockHeld = 3, pcDockArtists = 0, pcDockArtistsHeld = 0, pcDockStale = false, pcDockFailed = false; const pcDockItem = { status: (text, state) => seen.push({ text, ...state }) };\n' + src + '\nreturn { show: pcDockStatus, artists: n => { pcDockArtists = n; }, platforms: n => { pcDockFound = n; } };')(seen, (_key, fallback) => fallback);
  api.show();
  check(seen.at(-1).text === '0,3' && seen.at(-1).actionable === false && seen.at(-1).withheldOnly === true, 'withheld platforms alone are not actionable');
  api.artists(3); api.show();
  check(seen.at(-1).text === '0,3/3' && seen.at(-1).actionable === true && seen.at(-1).withheldOnly === false, 'new artist links are actionable even with no platform links');
  api.artists(0); api.platforms(2); api.show();
  check(seen.at(-1).text === '2,3' && seen.at(-1).actionable === true, 'new platform links are actionable');
});
