import { backupCloud } from './support/dropbox-backups.mjs';
import { readFileSync } from 'node:fs';
import { test, expect } from '../../../dev/test/harness.mjs';

const source = name => readFileSync(name === 'sync.js' && process.env.ST_SYNC_SRC ? process.env.ST_SYNC_SRC : new URL('../' + name, import.meta.url), 'utf8');
const { D, store, allow } = new Function(source('sync-data.js') + source('sync-policy.js') + source('sync-storage.js') + ';return {D:stSyncData,store:stSyncStore,allow:stSyncAllow};')();
const value = x => ({ encoding: 'value', value: x });
function memory(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { keys: () => [...map.keys()], get: k => map.get(k), set: (k, v) => map.set(k, v), del: k => map.delete(k), map };
}
function device(gm = {}, local = {}, origin = 'https://test.musicbrainz.org') {
  const io = { origin, gm: memory(gm), local: memory(local) };
  return { io, s: store(io) };
}
test('portable data includes credentials and preserves device fields through backup and restore', { tag: '@unit' }, () => {
  const a = device({
    view: { stars: [{ key: 'artist/a', title: 'A', img: 'cached-image' }], width: 1200, cols: { isrc: true }, secOrder: ['credits', 'tracks'], colW: { title: 80 }, named: { 'cols-ed': [1], 'flt-dg': [2] } },
    'string_theory.theme': { mode: 'dark', lat: 50, lon: 10 },
    'string_theory.palette': { pins: ['a'], recent: ['b'], last: 'test' },
    'apolloEditor.settings.v1': JSON.stringify({ autoMatch: true, colWidths: { title: 200 }, srTemplates: [{ name: 'Keep', find: 'a' }], srHistory: ['x'] }),
    'mbu.archive': { iaKey: 'key', iaSecret: 'secret' }, 'ii:oauth_refresh_token': 'credential',
    'string_theory.sync.auth': { refreshToken: { token: 'dropbox-credential' } },
    'pc:cache:123': { url: 'cache' }, 'ii:bg_links_cache': { x: 1 }, 'ii:match_cache_days': 30,
    'fusion.winstate': { x: 1 }, 'mc.logwin': {}, 'falcon:pending:123': {}, 'fc.handoff.123': {}, visits: ['x'], profile: { name: 'me' },
  }, { 'mbtools:qobuz': JSON.stringify({ token: 'qobuz-secret' }), 'mbu.isrcFormat': 'false', 'mbu.cornerSize': '1.5', 'MusicBrainz.native': 'leave alone' });
  const backup = a.s.document(a.s.capture()), data = a.s.read(JSON.stringify(backup));
  expect(Object.keys(data.gm).sort()).toEqual(['apolloEditor.settings.v1', 'ii:match_cache_days', 'ii:oauth_refresh_token', 'mbu.archive', 'string_theory.palette', 'string_theory.sync.auth', 'string_theory.theme', 'view'].sort());
  expect(data.gm.view.value).toEqual({ stars: [{ key: 'artist/a', title: 'A' }], secOrder: ['credits', 'tracks'], named: { 'flt-dg': [2] } });
  expect(data.gm['string_theory.theme'].value).toEqual({ mode: 'dark' });
  expect(data.gm['string_theory.palette'].value).toEqual({ pins: ['a'] });
  expect(data.gm['mbu.archive'].value.iaSecret).toBe('secret');
  expect(data.local[a.io.origin]['mbtools:qobuz'].value.token).toBe('qobuz-secret');
  const b = device({ view: { width: 800, cols: { len: false }, stars: [{ key: 'artist/a', title: 'Old', img: 'local-thumbnail' }] }, 'string_theory.theme': { lat: 40, lon: 20 }, 'apolloEditor.settings.v1': JSON.stringify({ colWidths: { title: 75 }, autoMatch: false }) }, { 'MusicBrainz.native': 'untouched' });
  b.s.stage(data); b.s.applyPending();
  expect(b.io.gm.get('view')).toMatchObject({ width: 800, cols: { len: false }, stars: [{ key: 'artist/a' }] });
  expect(b.io.gm.get('view').stars[0]).toEqual({ key: 'artist/a', title: 'A', img: 'local-thumbnail' });
  expect(b.io.gm.get('string_theory.theme')).toEqual({ mode: 'dark', lat: 40, lon: 20 });
  expect(JSON.parse(b.io.gm.get('apolloEditor.settings.v1'))).toMatchObject({ colWidths: { title: 75 }, autoMatch: true });
  expect(b.io.local.get('MusicBrainz.native')).toBe('untouched');
});
test('three-way merge retains independent changes, star removals and chosen conflict winner', { tag: '@unit' }, () => {
  const a = device(), base = { gm: { view: value({ stars: [{ key: 'artist/a' }, { key: 'artist/b' }], secHide: ['x'], facts: ['a'] }) }, local: {} };
  const l = structuredClone(base), r = structuredClone(base);
  l.gm.view.value.stars = [{ key: 'artist/b' }, { key: 'artist/c' }]; l.gm.view.value.secHide = ['y'];
  r.gm.view.value.stars.push({ key: 'artist/d' }); r.gm.view.value.facts = ['b'];
  const merged = a.s.merge(base, l, r, 'remote');
  expect(merged.gm.view.value.stars.map(x => x.key).sort()).toEqual(['artist/b', 'artist/c', 'artist/d']);
  expect(merged.gm.view.value.secHide).toEqual(['y']); expect(merged.gm.view.value.facts).toEqual(['b']);
  l.gm.view.value.facts = ['c'];
  expect(a.s.merge(base, l, r, 'remote').gm.view.value.facts).toEqual(['b']);
  expect(a.s.merge(base, l, r, 'local').gm.view.value.facts).toEqual(['c']);
  expect(a.s.merge(undefined, l, r, 'remote').gm.view.value.stars.map(x => x.key)).toContain('artist/a');
});
test('staging preserves edits made before reload and keeps recovery copy', { tag: '@unit' }, () => {
  const a = device({ view: { stars: [], width: 1000, facts: ['a'] } });
  const incoming = a.s.capture(); incoming.gm.view.value.stars = [{ key: 'artist/a' }];
  a.s.stage(incoming);
  a.io.gm.set('view', { stars: [], width: 600, facts: ['b'] });
  expect(a.s.effective().gm.view.value).toEqual({ stars: [{ key: 'artist/a' }], facts: ['b'] });
  a.s.applyPending();
  expect(a.io.gm.get('view')).toEqual({ stars: [{ key: 'artist/a' }], width: 600, facts: ['b'] });
  expect(a.io.gm.get('string_theory.sync.recovery').data.gm.view.value.stars).toEqual([]);
  expect(a.io.gm.get('string_theory.sync.stage')).toBeUndefined();
});
test('foreign origin data survives merges and is never applied to this origin', { tag: '@unit' }, () => {
  const a = device({}, { 'mbtools:qobuz': '{"token":"test"}' });
  const remote = { gm: {}, local: { 'https://musicbrainz.org': { 'mbtools:qobuz': value('prod') } } };
  const merged = a.s.merge(undefined, a.s.capture(), remote, 'remote');
  expect(merged.local['https://musicbrainz.org']).toEqual(remote.local['https://musicbrainz.org']);
  a.s.apply(merged); expect(a.io.local.get('mbtools:qobuz')).toBe('{"token":"test"}');
  a.s.stage(merged); a.s.applyPending();
  expect(a.s.pending()).toBe(false); expect(a.io.gm.get('string_theory.sync.stage')).toBeDefined();
  const prodLocal = memory({ 'mbtools:qobuz': 'old-prod', 'mbu.cornerSize': '1.2' });
  const prod = store({ origin: 'https://musicbrainz.org', gm: a.io.gm, local: prodLocal });
  prod.applyPending();
  expect(prodLocal.get('mbtools:qobuz')).toBe('prod'); expect(prodLocal.get('mbu.cornerSize')).toBe('1.2');
  expect(a.io.gm.get('string_theory.sync.stage')).toBeUndefined();
});
test('malformed, unsafe and newer backup formats fail before touching storage', { tag: '@unit' }, () => {
  const a = device({ keep: 'yes' });
  for (const txt of ['{}', '{', '{"format":"string-theory-sync","version":2,"data":{"gm":{},"local":{}}}', '{"__proto__":{"polluted":true}}']) expect(() => a.s.read(txt)).toThrow();
  const bad = a.s.document({ gm: {}, local: { 'https://evil.example': {} } });
  expect(() => a.s.read(JSON.stringify(bad))).toThrow();
  for (const stars of [[null], [{ key: 'a' }, { key: 'a' }], 'invalid']) {
    expect(() => a.s.read(JSON.stringify(a.s.document({ gm: { view: value({ stars }) }, local: {} })))).toThrow();
  }
  expect(a.io.gm.get('keep')).toBe('yes'); expect({}.polluted).toBeUndefined();
  expect(allow('gm', 'ii:oauth_access_token', [])).toBe(true);
});

test('cache namespaces are excluded from export and from older imported backups', { tag: '@unit' }, () => {
  const cached = {
    'pc:mbdata:44e85631-d6b2-44a9-bd72-e270b80b578d': '{"title":"cached"}',
    'pc:cache:v2:spotify:release': '{"url":"cached"}',
    'apollo:discogs-link-cache-v1': '{"resolve":{}}',
    'ch:ls-pruned': '2026-11-02', 'eh.relhd': '{}', 'mbu:artimg': '{}',
  };
  const a = device({ 'ii:match_cache_days': 30, 'ii:oauth_refresh_token': 'keep-credential' }, cached);
  expect(a.s.capture().local[a.io.origin]).toEqual({});
  expect(a.s.capture().gm['ii:match_cache_days'].value).toBe(30);
  const old = a.s.document({ gm: {}, local: { [a.io.origin]: Object.fromEntries(Object.entries(cached).map(([k, v]) => [k, value(v)])) } });
  const filtered = a.s.read(JSON.stringify(old));
  expect(filtered.local[a.io.origin]).toEqual({});
  a.s.apply(filtered);
  for (const [k, v] of Object.entries(cached)) expect(a.io.local.get(k)).toBe(v);
});

function runtime(gmSeed, backend) {
  const gm = memory({ 'string_theory.sync.auth': { accessToken: { token: 'test-access', expiresAt: Date.now() + 3600000 }, refreshToken: { token: 'test-refresh' } }, ...gmSeed });
  const ls = memory(), messages = [];
  const locals = { getItem: k => ls.get(k) ?? null, setItem: ls.set, removeItem: ls.del };
  const xhr = opts => { Promise.resolve().then(async () => {
    const reply = await backend(opts);
    opts.onload({ status: reply.status, response: new TextEncoder().encode(reply.text).buffer, responseHeaders: 'content-type: application/json' });
  }).catch(() => opts.onerror({})); };
  let opened;
  const names = ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues', 'GM_xmlhttpRequest', 'location', 'localStorage', 'document', 'navigator', 'stUI', 'ST_ON_MB', 'window'];
  const body = ['sync-data.js', 'sync-policy.js', 'sync-storage.js', 'providers.js', 'sync.js'].map(source).join('\n')
    + ';stSyncStorageInit(); return {run:stSyncRun,store:stSyncStorage,guard:__stSyncGuard,state:stSyncState,finish:stSyncFinish,connect:stSyncConnect,disconnect:stSyncDisconnect,backups:typeof stBackupRun === "undefined" ? undefined : stBackupRun,drive:()=>stSyncDropbox(stSyncAuthorizer())};';
  const api = new Function(...names, body)(
    (k, d) => gm.get(k) ?? d, gm.set, gm.del, gm.keys, xhr,
    { origin: 'https://test.musicbrainz.org' }, locals, { getElementById: () => null },
    { locks: { request: async (key, options, fn) => fn({}) } }, () => ({ mbuToast: msg => messages.push(msg) }), true, { open: url => { opened = url; } },
  );
  return { ...api, gm, messages, opened: () => opened };
}
function cloud(data) {
  const state = { data, rev: 1, uploads: 0, race: null, fail: false, reads: [] };
  state.request = async opts => {
    if (state.fail) throw new Error('offline');
    expect(opts.headers.authorization).toBe('Bearer test-access');
    const url = new URL(opts.url), arg = opts.headers['dropbox-api-arg'] && JSON.parse(opts.headers['dropbox-api-arg']);
    if (url.pathname.endsWith('/get_metadata')) return { status: state.data ? 200 : 409, text: JSON.stringify(state.data ? { rev: String(state.rev), size: 100 } : { error_summary: 'path/not_found/' }) };
    if (url.pathname.endsWith('/download')) {
      state.reads.push(arg.rev); expect(arg.rev).toBe(String(state.rev));
      return { status: 200, text: JSON.stringify({ format: 'string-theory-sync', version: 1, data: state.data }) };
    }
    if (url.pathname.endsWith('/upload')) {
      state.uploads++;
      if (state.race) { state.race(); state.race = null; }
      const expected = arg.mode['.tag'] === 'update' ? arg.mode.update : null;
      if (expected !== (state.data ? String(state.rev) : null)) return { status: 409, text: '{"error_summary":"path/conflict/file/"}' };
      expect(arg.autorename).toBe(false); expect(arg.strict_conflict).toBe(true);
      state.data = JSON.parse(new TextDecoder().decode(opts.data)).data; state.rev++;
      return { status: 200, text: JSON.stringify({ rev: String(state.rev) }) };
    }
    throw new Error('Unexpected request');
  };
  return state;
}
test('Dropbox transport retries a revision race and stages both devices’ changes', { tag: '@unit' }, async () => {
  const b = device({ view: { stars: [{ key: 'artist/b' }], facts: ['b'] } });
  const server = cloud(b.s.capture());
  server.race = () => { server.data.gm.view.value.stars.push({ key: 'artist/c' }); server.rev++; };
  const a = runtime({ view: { stars: [{ key: 'artist/a' }], width: 800 } }, server.request);
  await a.run(true);
  expect(server.uploads).toBe(2); expect(server.reads).toEqual(['1', '2']);
  expect(server.data.gm.view.value.stars.map(x => x.key).sort()).toEqual(['artist/a', 'artist/b', 'artist/c']);
  expect(a.gm.get('view')).toEqual({ stars: [{ key: 'artist/a' }], width: 800 });
  expect(a.store.effective().gm.view.value.stars).toHaveLength(3);
  a.store.applyPending();
  expect(a.gm.get('view').width).toBe(800); expect(a.gm.get('view').stars).toHaveLength(3);
  expect(a.state().error).toBe('');
  // A second unchanged sync reads but does not upload or restage anything.
  await a.run(true); expect(server.uploads).toBe(2); expect(a.gm.get('string_theory.sync.stage')).toBeUndefined();
});
test('failed sync keeps the baseline and user data, then recovers without losing deletions', { tag: '@unit' }, async () => {
  const server = cloud(null), a = runtime({ view: { stars: [{ key: 'artist/a' }] } }, server.request);
  await a.run(true); const base = structuredClone(a.gm.get('string_theory.sync.base'));
  a.gm.set('view', { stars: [] }); server.fail = true;
  await a.run(true); expect(a.gm.get('string_theory.sync.base')).toEqual(base); expect(a.state().error).toContain('connection failed');
  server.fail = false; await a.run(true);
  expect(server.data.gm.view.value.stars).toEqual([]); expect(a.state().failures).toBe(0);
});
test('an older tab changes one field without overwriting synced fields or resurrecting stars', { tag: '@unit' }, () => {
  const a = runtime({ view: { stars: [{ key: 'artist/a' }], facts: ['old'], secHide: [] } }, async () => { throw new Error('No network expected'); });
  const oldTab = a.guard(), held = structuredClone(oldTab.get('view'));
  a.gm.set('view', { stars: [], facts: ['remote'], secHide: [] });
  held.secHide = ['credits']; oldTab.set('view', held);
  expect(a.gm.get('view')).toEqual({ stars: [], facts: ['remote'], secHide: ['credits'] });
});
test('OAuth uses PKCE and never replaces working credentials after a failed reconnect', { tag: '@unit' }, async () => {
  const a = runtime({}, async opts => {
    const form = new URLSearchParams(opts.data);
    expect(opts.url).toBe('https://api.dropbox.com/oauth2/token');
    expect(form.get('client_id')).toBe('g73mzw3yp0xqgtd');
    expect(form.get('code')).toBe('test-code'); expect(form.get('code_verifier').length).toBeGreaterThanOrEqual(43);
    expect(form.has('client_secret')).toBe(false); expect(form.get('redirect_uri')).toBe('https://musicbrainz.org/?st-dropbox=callback');
    return { status: 400, text: '{"error":"invalid_grant"}' };
  });
  const before = structuredClone(a.gm.get('string_theory.sync.auth'));
  await a.connect();
  const url = new URL(a.opened());
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
  expect(url.searchParams.get('token_access_type')).toBe('offline');
  expect(url.searchParams.get('redirect_uri')).toBe('https://musicbrainz.org/?st-dropbox=callback');
  const callback = new URL(url.searchParams.get('redirect_uri'));
  callback.searchParams.set('state', url.searchParams.get('state')); callback.searchParams.set('code', 'test-code');
  const backup = a.store.capture();
  expect(backup.gm['string_theory.sync.oauth']).toBeUndefined();
  await expect(a.finish(callback.href)).rejects.toMatchObject({ status: 400 });
  expect(a.gm.get('string_theory.sync.auth')).toEqual(before);
});

test('OAuth rejects wrong state and expired callbacks before making a request', { tag: '@unit' }, async () => {
  let requests = 0;
  const a = runtime({}, async () => { requests++; throw new Error('No network expected'); });
  await a.connect();
  const pending = a.gm.get('string_theory.sync.oauth');
  const callback = new URL('https://musicbrainz.org/?st-dropbox=callback&code=bad&state=wrong');
  await expect(a.finish(callback.href)).rejects.toThrow('did not match');
  expect(a.gm.get('string_theory.sync.oauth')).toEqual(pending);
  callback.searchParams.set('state', pending.state); pending.at = Date.now() - 11 * 60e3;
  await expect(a.finish(callback.href)).rejects.toThrow('expired'); expect(requests).toBe(0);
});

test('first sync on an empty Dropbox creates the initial backup without deleting local data', { tag: '@unit' }, async () => {
  const server = cloud(null), a = runtime({ saved: { local: true }, view: { stars: [{ key: 'artist/a' }], width: 700 } }, server.request);
  await a.run(true);
  expect(server.uploads).toBe(1); expect(server.data.gm.saved.value).toEqual({ local: true });
  expect(a.gm.get('view').stars).toHaveLength(1); expect(a.store.pending()).toBe(false);
  expect(a.messages).toContain('Created the first Dropbox backup');
});

test('Push replaces remote portable values and retains other origins; Pull never uploads', { tag: '@unit' }, async () => {
  const remote = device({ saved: { remoteOnly: true }, remoteOnly: 'remove', view: { stars: [{ key: 'artist/b' }] } }).s.capture();
  remote.local['https://musicbrainz.org'] = { 'mbtools:qobuz': value('other-origin') };
  const server = cloud(remote), a = runtime({ saved: { local: true }, localOnly: 'push', view: { stars: [{ key: 'artist/a' }], width: 700 } }, server.request);
  await a.run(true, 'push');
  expect(server.data.gm.saved.value).toEqual({ local: true }); expect(server.data.gm.remoteOnly).toBeUndefined();
  expect(server.data.gm.view.value.stars).toEqual([{ key: 'artist/a' }]);
  expect(server.data.local['https://musicbrainz.org']).toEqual(remote.local['https://musicbrainz.org']);
  expect(a.gm.get('remoteOnly')).toBeUndefined();
  server.data.gm.saved = value({ fromDropbox: true }); delete server.data.gm.localOnly;
  server.data.gm.view.value.stars = [{ key: 'artist/c' }]; server.rev++;
  const uploads = server.uploads;
  await a.run(true, 'pull'); expect(server.uploads).toBe(uploads);
  expect(a.gm.get('localOnly')).toBe('push'); // staged until reload
  a.store.applyPending();
  expect(a.gm.get('saved')).toEqual({ fromDropbox: true }); expect(a.gm.get('localOnly')).toBeUndefined();
  expect(a.gm.get('view')).toEqual({ stars: [{ key: 'artist/c' }], width: 700 });
});

test('Pull from a missing Dropbox backup changes neither side nor the previous baseline', { tag: '@unit' }, async () => {
  const server = cloud(null), a = runtime({ saved: 'keep', 'string_theory.sync.base': { sentinel: true } }, server.request);
  await a.run(true, 'pull');
  expect(server.uploads).toBe(0); expect(server.data).toBeNull(); expect(a.gm.get('saved')).toBe('keep');
  expect(a.gm.get('string_theory.sync.base')).toEqual({ sentinel: true }); expect(a.store.pending()).toBe(false);
  expect(a.messages).toContain('No Dropbox backup yet. Local data unchanged.');
});

test('Sync cleans excluded cache entries out of an older remote snapshot', { tag: '@unit' }, async () => {
  const server = cloud(null), a = runtime({ saved: 'keep' }, server.request);
  await a.run(true);
  server.data.local['https://test.musicbrainz.org']['pc:mbdata:fixture'] = value('old cache'); server.rev++;
  const before = server.uploads;
  await a.run(true);
  expect(server.uploads).toBe(before + 1);
  expect(server.data.local['https://test.musicbrainz.org']['pc:mbdata:fixture']).toBeUndefined();
  expect(server.data.gm.saved.value).toBe('keep');
});
test('disconnect cannot be undone by a previously staged credential download', { tag: '@unit' }, () => {
  const a = runtime({ view: { stars: [] } }, async () => { throw new Error('No network expected'); });
  const incoming = a.store.capture(); incoming.gm.view.value.stars = [{ key: 'artist/a' }];
  incoming.gm['string_theory.sync.settings'] = value({ automatic: true });
  a.store.stage(incoming); a.disconnect(); a.store.applyPending();
  expect(a.gm.get('string_theory.sync.auth')).toBeUndefined();
  expect(a.gm.get('string_theory.sync.settings').automatic).toBe(false);
  expect(a.gm.get('view').stars).toHaveLength(1);
});

test('remote backups are distinct snapshots, list all pages and leave sync state untouched', { tag: '@unit' }, async () => {
  const server = backupCloud(), a = runtime({ saved: 'first', view: { width: 800, stars: [] }, 'pc:cache:fixture': 'omit', 'string_theory.sync.base': { untouched: true } }, server.request);
  expect(await a.drive().listBackups()).toEqual([]);
  await a.backups('save'); a.gm.set('saved', 'second'); await a.backups('save');
  expect(server.files.size).toBe(2);
  const snapshots = [...server.files.values()].map(f => JSON.parse(f.text));
  expect(snapshots.map(d => d.data.gm.saved.value)).toEqual(['first', 'second']);
  for (const snapshot of snapshots) {
    expect(snapshot.data.gm['pc:cache:fixture']).toBeUndefined(); expect(snapshot.data.gm.view.value.width).toBeUndefined();
    expect(snapshot.data.gm['string_theory.sync.auth'].value.refreshToken.token).toBe('test-refresh');
  }
  const entries = await a.drive().listBackups();
  expect(entries).toHaveLength(2); expect(entries[0].id).toBe('id:2');
  expect(server.calls.some(c => c.endpoint.endsWith('/list_folder/continue'))).toBe(true);
  expect(a.gm.get('string_theory.sync.base')).toEqual({ untouched: true }); expect(a.store.pending()).toBe(false);
  expect(server.calls.every(c => c.args.path !== '/string-theory.json')).toBe(true);
});

test('remote import validates and stages a filtered merge with recovery before reload', { tag: '@unit' }, async () => {
  const server = backupCloud(), a = runtime({ saved: 'old', localOnly: 'keep', view: { width: 800, stars: [{ key: 'artist/a' }] } }, server.request);
  await a.backups('save');
  const file = [...server.files.values()][0], doc = JSON.parse(file.text);
  doc.data.gm.saved.value = 'restored'; doc.data.gm.view.value.width = 1600;
  doc.data.gm.view.value.stars = [{ key: 'artist/b' }]; doc.data.gm['pc:cache:fixture'] = value('excluded');
  file.text = JSON.stringify(doc);
  const entry = (await a.drive().listBackups())[0];
  await a.backups('apply', entry);
  expect(a.gm.get('saved')).toBe('old');
  expect(a.gm.get('string_theory.sync.recovery').data.gm.saved.value).toBe('old');
  a.gm.set('editedAfterImport', 'keep'); a.store.applyPending();
  expect(a.gm.get('saved')).toBe('restored'); expect(a.gm.get('localOnly')).toBe('keep'); expect(a.gm.get('editedAfterImport')).toBe('keep');
  expect(a.gm.get('view').width).toBe(800); expect(a.gm.get('view').stars.map(s => s.key).sort()).toEqual(['artist/a', 'artist/b']);
  expect(a.gm.get('pc:cache:fixture')).toBeUndefined();
  expect(server.files.size).toBe(1); expect(a.gm.get('string_theory.sync.base')).toBeUndefined();
});

test('remote deletion rejects stale revisions and cannot target the live sync file', { tag: '@unit' }, async () => {
  const server = backupCloud(), a = runtime({ saved: 'keep' }, server.request);
  await a.backups('save');
  const entry = (await a.drive().listBackups())[0], file = [...server.files.values()][0];
  file.metadata.rev = 'changed';
  await expect(a.backups('delete', entry)).rejects.toThrow('Refresh the list');
  expect(server.files.size).toBe(1); expect(a.gm.get('saved')).toBe('keep');
  const before = server.calls.length;
  await expect(a.drive().deleteBackup({ ...entry, path_lower: '/string-theory.json' })).rejects.toThrow('Invalid remote backup');
  expect(server.calls).toHaveLength(before);
  await a.backups('delete', (await a.drive().listBackups())[0]); expect(server.files.size).toBe(0);
});

test('invalid and failed remote imports never change local data or recovery', { tag: '@unit' }, async () => {
  const server = backupCloud(), a = runtime({ saved: 'keep' }, server.request);
  await a.backups('save');
  const file = [...server.files.values()][0], entry = (await a.drive().listBackups())[0];
  for (const text of ['{', '{"format":"string-theory-sync","version":99,"data":{"gm":{},"local":{}}}']) {
    file.text = text;
    await expect(a.backups('apply', entry)).rejects.toThrow();
    expect(a.gm.get('saved')).toBe('keep'); expect(a.gm.get('string_theory.sync.stage')).toBeUndefined(); expect(a.gm.get('string_theory.sync.recovery')).toBeUndefined();
  }
  const before = server.calls.length;
  await expect(a.backups('apply', { ...entry, size: 11 * 1024 * 1024 })).rejects.toThrow('10 MB');
  expect(server.calls).toHaveLength(before);
  server.denied = true; await expect(a.backups('list')).rejects.toMatchObject({ response: { status: 403 } });
  expect(a.gm.get('saved')).toBe('keep');
});
