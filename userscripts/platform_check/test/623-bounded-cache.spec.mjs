// #623 (sweep, X11): Platform Check's per-release caches in musicbrainz.org's
// localStorage (pc:cache:v2:<platform>:<mbid>, pc:mbdata:<mbid>) grew forever: a
// cached "no match" was permanent — a release that reached a platform later was never
// searched again — and a full localStorage made every write fail silently, the
// platform logins included. Entries now expire (a miss after 14 days, a hit after 90,
// MB data after 30) and a daily prune keeps the newest 500 releases.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

function fakeStorage() {
  const m = new Map();
  return { m, get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

test('the platform cache expires and stays bounded', { tag: '@unit' }, async () => {
  const ls = fakeStorage(), logs = [];
  globalThis.localStorage = ls; globalThis.appendLog = (p, msg) => logs.push(msg);
  try {
    const F = await loadFunctions('platform_check', ['ALL_PROVIDERS', 'pcTtlOf', 'pcMaxReleases', 'pcLsGet', 'pcLsSet', 'pcPruneCache', 'cacheKey', 'cacheGet', 'cacheSet', 'cacheClear', 'mbDataKey', 'mbDataGet', 'mbDataSet']);
    const day = 864e5, put = (k, v) => ls.setItem(k, JSON.stringify(v));

    F.cacheSet('m1', 'spotify', { url: 'https://open.spotify.com/album/x', tracks: 10 });
    const got = F.cacheGet('m1', 'spotify');
    check(got && got.url && got._t > 0, 'a cached entry comes back, dated');

    put('pc:cache:v2:deezer:m2', { url: null, _t: Date.now() - 15 * day });
    check(F.cacheGet('m2', 'deezer') === null && !ls.m.has('pc:cache:v2:deezer:m2'), 'a "not found" older than 14 days is gone — the release gets searched again');
    put('pc:cache:v2:deezer:m3', { url: null, _t: Date.now() - 13 * day });
    check(F.cacheGet('m3', 'deezer') !== null, '…a 13-day-old one is still used');
    put('pc:cache:v2:deezer:m4', { url: 'https://deezer.com/album/1', _t: Date.now() - 60 * day });
    check(F.cacheGet('m4', 'deezer') !== null, 'a found link lasts longer (60 days: kept)');
    put('pc:cache:v2:deezer:m5', { url: 'https://deezer.com/album/1', _t: Date.now() - 91 * day });
    check(F.cacheGet('m5', 'deezer') === null, '…but not past 90 days');

    // the prune: legacy (undated) entries, and more releases than the cap
    ls.m.clear();
    put('pc:cache:v2:spotify:legacy', { url: null });
    for (let i = 0; i < 520; i++) put('pc:cache:v2:tidal:r' + i, { url: 'https://tidal.com/album/' + i, _t: Date.now() - (600 - i) * 60_000 });
    put('pc:mbdata:old', { album: 'x', _t: Date.now() - 31 * day });
    F.pcPruneCache();
    const releases = new Set([...ls.m.keys()].filter(k => k.startsWith('pc:')).map(k => k.slice(k.lastIndexOf(':') + 1)).filter(k => k !== 'pruned'));
    check(releases.size === 500, `at most 500 releases kept (${releases.size})`);
    check(!ls.m.has('pc:cache:v2:tidal:r0') && ls.m.has('pc:cache:v2:tidal:r519'), 'the oldest went, the newest stayed');
    check(!ls.m.has('pc:mbdata:old'), 'expired MB data was pruned');
    check(JSON.parse(ls.getItem('pc:cache:v2:spotify:legacy') || 'null')?._t > 0 || !ls.m.has('pc:cache:v2:spotify:legacy'), 'an undated entry from before is dated now (or evicted as oldest), not left undated');
    const before = ls.m.size; put('pc:cache:v2:tidal:extra', { url: null, _t: 1 });
    F.pcPruneCache();
    check(ls.m.size === before + 1, 'the prune runs once a day, not on every load');
    console.log(logs.join('\n'));
  } finally { delete globalThis.localStorage; delete globalThis.appendLog; }
});
