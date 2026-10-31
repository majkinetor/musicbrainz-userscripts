import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('launcher leaves out cached ISRCs blocked by the editor as duplicates', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['ISRC_RE', 'normalizeIsrc', 'isValidIsrc', 'bgIsrcsNew']);
  const tracks = [
    { recId: 'one', existing: [] },
    { recId: 'two', existing: [] },
    { recId: 'three', existing: ['USAAA0000002'] },
    { recId: 'four', existing: [] },
    { recId: 'five', existing: [] },
  ];
  const isrcs = { one: 'USAAA0000001', two: 'USAAA0000001', four: 'USAAA0000002', five: 'USAAA0000003' };
  const run = new Function('RELEASE', 'bgCache', src + '\nreturn bgIsrcsNew;')({ tracks }, () => ({ isrcs }));
  const found = run();
  check(found.length === 1 && found[0].rec === 'five', 'only the ISRC the editor can submit is counted');
});

test('Match cache can be disabled and its lifetime changed', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['bgCacheDays', 'bgCache', 'bgSave']);
  const data = { match_cache_enabled: false, match_cache_days: 3 };
  const store = { get: (k, d) => k in data ? data[k] : d, set: (k, v) => { data[k] = v; } };
  const api = new Function('store', 'mbid', 'BG_DAYS', src + '\nreturn { bgCache, bgSave };')(store, 'release', 7);
  const value = api.bgCache(); value.links.push({ rec: 'r', code: 'x', url: 'https://x.test' }); api.bgSave(value);
  check(!data.bg_links_cache && api.bgCache().links.length === 1, 'cache off retains the current page result without persisting it');
  data.match_cache_enabled = true;
  data.bg_links_cache = { release: { at: Date.now() - 4 * 864e5, links: [{ rec: 'old' }], done: [] } };
  check(api.bgCache().links.length === 0, 'a result older than the configured duration expires');
});

test('background Match cannot save an old release into the next release', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['bgLinksRun']);
  let finish;
  const saved = [], bg = { running: {} };
  const first = { tracks: [{ recId: 'old', existing: [] }] };
  const build = new Function('initial', 'BG', 'bgCache', 'bgSave', 'bgMarkLive', 'isrcSourcesFastest', 'normalizeIsrc', 'isValidIsrc', 'trackForSource', 'fillCheck', 'TrackLinks', 'Log', 'bgIsrcsNew', 'bgLinksToAdd', 'bgSlowOn', 'BG_SLOW',
    'let mbid = "old", RELEASE = initial;' + src + '\nreturn { run: bgLinksRun, follow: r => { mbid = "new"; RELEASE = r; } };');
  const deps = [first, bg, () => ({ isrcs: {}, links: [], done: [] }), c => saved.push(c), () => {},
    () => [{ source: 'test', id: 'a', fetcher: (id, progress, hit) => new Promise(resolve => { finish = () => { hit({ isrc: 'USAAA0000001' }); resolve(); }; }) }],
    x => x, () => true, () => ({ idx: 0 }), () => ({ suspicious: false }),
    { findHeadless: async () => ({}) }, { info() {}, warn() {} }, () => [], () => [], () => true, []];
  const env = build(...deps);
  const old = env.run(() => {});
  const before = saved.length;
  env.follow({ tracks: [{ recId: 'new', existing: [] }] });
  finish(); await old;
  check(saved.length === before, 'the old result is discarded after the release changes');
});

test('an old release load cannot clear the newer in-flight load', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['fetchRelease']);
  const pending = [];
  const build = new Function('fetchReleaseNow', 'updateBtnStatus', 'let RELEASE = null, _relInFlight = null;\n' + src + '\nreturn { fetchRelease, follow: () => { RELEASE = null; _relInFlight = null; } };');
  const env = build(() => new Promise(resolve => pending.push(resolve)), () => {});
  const first = env.fetchRelease();
  env.follow();
  const second = env.fetchRelease();
  pending[0](); await first; await Promise.resolve();
  const joined = env.fetchRelease();
  check(pending.length === 2 && joined === second, 'another caller joins the newer request');
  pending[1](); await second;
});

test('only a successful ISRC submission invalidates the Match cache', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['submitIsrcs']);
  let invalidations = 0, fail = false;
  const submit = new Function('withRepeat', 'submitIsrcsOnce', 'bgInvalidate', src + '\nreturn submitIsrcs;')(
    async () => { if (fail) throw new Error('failed'); return 'ok'; }, () => {}, () => { invalidations++; });
  await submit({}, '');
  check(invalidations === 1, 'a completed submit invalidates');
  fail = true;
  await submit({}, '').catch(() => {});
  check(invalidations === 1, 'a failed submit does not invalidate');
});

test('a failed provider is not recorded as a completed background check', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['findHeadless']);
  const provider = { code: 'x', name: 'X', conc: 1, resolve: async () => { throw new Error('offline'); } };
  const run = new Function('PROV', 'RELEASE', 'codeOn', 'linkedUrl', 'normalizeIsrc', 'isValidIsrc', 'Log', src + '\nreturn findHeadless;')(
    [provider], { tracks: [{ recId: 'r', existing: [] }] }, () => true, () => false, x => x, x => !!x, { info() {}, debug() {} });
  let complete;
  await run(() => 'USAAA2000001', null, { onDone: (p, ok) => { complete = ok; } });
  check(complete === false, 'the failed lookup is incomplete and must be retried');
});

test('successful edits expire the saved snapshot but retain unfinished page results', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['bgCacheDays', 'bgCache', 'bgSave', 'bgInvalidate']);
  const data = { bg_links_cache: { release: { at: Date.now(), links: [{ rec: 'r', code: 'x', url: 'https://x.test' }], done: [], isrcs: {} } } };
  const store = { get: (k, d) => k in data ? data[k] : d, set: (k, v) => { data[k] = v; } }, bg = { generation: 0, running: { isrc: { done: 0, of: 1 } } };
  const build = new Function('store', 'mbid', 'BG_DAYS', 'BG', 'updateBtnLinks', 'document', 'Event', src + '\nreturn { bgCache, bgInvalidate };');
  const api = build(store, 'release', 7, bg, () => {}, { dispatchEvent() {} }, class {});
  api.bgInvalidate(false);
  check(!data.bg_links_cache.release && bg.stale && bg.generation === 1, 'the persisted result is invalidated and marked unverified');
  check(api.bgCache().links.length === 1, 'other unfinished findings remain available in this page');
  check(Object.keys(bg.running).length === 0, 'the cancelled generation no longer leaves the launcher busy');
});

test('a successful local edit keeps known findings usable while expiring the saved cache', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['bgCacheDays', 'bgCache', 'bgSave', 'bgInvalidate']);
  const data = { bg_links_cache: { release: { at: Date.now(), links: [{ rec: 'r', code: 'x', url: 'https://x.test' }], done: ['x'], isrcs: {}, incomplete: false } } };
  const store = { get: (k, d) => k in data ? data[k] : d, set: (k, v) => { data[k] = v; } }, bg = { generation: 0, running: {} };
  const api = new Function('store', 'mbid', 'BG_DAYS', 'BG', 'updateBtnLinks', 'document', 'Event', src + '\nreturn { bgCache, bgInvalidate };')(
    store, 'release', 7, bg, () => {}, { dispatchEvent() {} }, class {});
  api.bgInvalidate(false, true);
  check(!data.bg_links_cache.release, 'the persistent snapshot is expired');
  check(bg.stale === false, 'the page retains its known count after its own successful edit');
  check(api.bgCache().links.length === 1, 'unsubmitted findings remain available');
});
