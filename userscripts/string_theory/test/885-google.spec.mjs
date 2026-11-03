import { readFileSync } from 'node:fs';
import { test, expect } from '../../../dev/test/harness.mjs';
import { googleCloud } from './support/google-drive.mjs';
const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
function runtime(server, seed = {}, googleApi) {
  const gm = new Map(Object.entries({ 'string_theory.sync.settings': { provider: 'google' },
    'string_theory.sync.google.auth': { accessToken: { token: 'google-token', expiresAt: Date.now() + 3600000 } },
    'string_theory.sync.auth': { refreshToken: { token: 'dropbox-token' } }, ...seed }));
  const messages = [], ls = new Map();
  const xhr = opts => Promise.resolve().then(() => server.request(opts)).then(reply => opts.onload({ status: reply.status, response: new TextEncoder().encode(reply.text).buffer, responseHeaders: reply.headers }), () => opts.onerror({}));
  const args = ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues', 'GM_xmlhttpRequest', 'location', 'localStorage', 'document', 'navigator', 'stUI', 'ST_ON_MB', 'window'];
  const code = ['sync-data.js', 'sync-policy.js', 'sync-storage.js', 'providers.js', 'sync.js', 'sync-google.js'].map(source).join('\n')
    + ';stSyncStorageInit(); stGoogleReady=true; return {run:stSyncRun,store:stSyncStorage,drive:stSyncGoogle,backups:stBackupRun,disconnect:stSyncDisconnect,connect:stGoogleConnect,state:stSyncState,key:stSyncKey,connected:stSyncConnected};';
  const api = new Function(...args, code)(
    (k, d) => gm.get(k) ?? d, (k, v) => gm.set(k, v), k => gm.delete(k), () => [...gm.keys()], xhr,
    { origin: 'https://test.musicbrainz.org' }, { getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v), removeItem: k => ls.delete(k) },
    { getElementById: () => null }, { locks: { request: async (key, options, fn) => fn({}) } },
    () => ({ mbuToast: msg => messages.push(msg) }), true, { google: { accounts: { oauth2: googleApi } } },
  );
  return { ...api, gm, messages };
}
const value = x => ({ encoding: 'value', value: x });

test('Google backup-only mode never performs automatic sync', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { 'string_theory.sync.settings': { provider: 'google', automatic: true, minutes: 5 } });
  await a.run(false);
  expect(server.calls).toEqual([]);
  expect(a.gm.get('string_theory.sync.google.base')).toBeUndefined();
});
test('Google sync creates once, uses a separate baseline and excludes bookkeeping', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'keep', 'string_theory.sync.base': { dropbox: true }, 'pc:cache:fixture': 'omit' });
  await a.run(true);
  expect(a.state().error).toBe('');
  const remote = await a.drive().read();
  expect(remote.data.gm.saved.value).toBe('keep');
  expect(remote.data.gm['pc:cache:fixture']).toBeUndefined();
  expect(remote.data.gm['string_theory.sync.google.base']).toBeUndefined();
  expect(remote.data.gm['string_theory.sync.google.state']).toBeUndefined();
  expect(a.gm.get('string_theory.sync.base')).toEqual({ dropbox: true });
  const count = server.files.size; await a.run(true); expect(server.files.size).toBe(count);
  expect(a.messages).toContain('Created the first Google Drive backup');
});
test('concurrent Google writers retain independent fields and star deletions across journal heads', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: { a: 0, b: 0 }, view: { stars: [{ key: 'artist/old' }] } });
  await a.run(true);
  const observed = await a.drive().read(), left = structuredClone(observed.data), right = structuredClone(observed.data);
  left.gm.saved.value.a = 1; left.gm.view.value.stars = [];
  right.gm.saved.value.b = 2; right.gm.view.value.stars.push({ key: 'artist/new' });
  await Promise.all([a.drive().write(left, observed.rev), a.drive().write(right, observed.rev)]);
  const merged = await a.drive().read();
  expect(merged.rev).toHaveLength(2); expect(merged.filtered).toBe(true);
  expect(merged.data.gm.saved.value).toEqual({ a: 1, b: 2 });
  expect(merged.data.gm.view.value.stars).toEqual([{ key: 'artist/new' }]);
  await a.run(true); const consolidated = await a.drive().read();
  expect(consolidated.rev).toHaveLength(1); expect(consolidated.data.gm.saved.value).toEqual({ a: 1, b: 2 });
  expect(server.calls.some(c => c.query.includes('pageToken'))).toBe(true);
});
test('Google Push and Pull preserve their one-way behavior and a missing remote is harmless', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'local', localOnly: 'keep', view: { stars: [], width: 800 } });
  await a.run(true, 'pull'); expect(server.files.size).toBe(0);
  const remote = { gm: { saved: value('remote'), remoteOnly: value('remove') }, local: { 'https://musicbrainz.org': { 'mbtools:qobuz': value('other-origin') } } };
  await a.drive().write(remote, []); await a.run(true, 'push');
  let read = await a.drive().read(); expect(read.data.gm.saved.value).toBe('local'); expect(read.data.gm.remoteOnly).toBeUndefined();
  expect(read.data.local['https://musicbrainz.org']['mbtools:qobuz'].value).toBe('other-origin');
  read.data.gm.saved.value = 'downloaded'; delete read.data.gm.localOnly;
  await a.drive().write(read.data, read.rev); const count = server.files.size;
  await a.run(true, 'pull'); expect(server.files.size).toBe(count); expect(a.gm.get('saved')).toBe('local');
  a.store.applyPending(); expect(a.gm.get('saved')).toBe('downloaded'); expect(a.gm.get('localOnly')).toBeUndefined(); expect(a.gm.get('view').width).toBe(800);
});
test('repeated concurrent merges use all shared ancestors so removals are not resurrected', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { view: { stars: [] } });
  await a.run(true); const root = await a.drive().read();
  const left = structuredClone(root.data), right = structuredClone(root.data);
  left.gm.view.value.stars = [{ key: 'artist/a' }]; right.gm.view.value.stars = [{ key: 'artist/b' }];
  await a.drive().write(left, root.rev); await a.drive().write(right, root.rev);
  const shared = await a.drive().read(), removed = structuredClone(shared.data), unchanged = structuredClone(shared.data);
  removed.gm.view.value.stars = [{ key: 'artist/a' }]; unchanged.gm.saved = value('independent');
  await a.drive().write(removed, shared.rev); await a.drive().write(unchanged, shared.rev);
  const merged = await a.drive().read();
  expect(merged.data.gm.view.value.stars).toEqual([{ key: 'artist/a' }]);
  expect(merged.data.gm.saved.value).toBe('independent');
});
test('Google backups read the selected revision, filter imports and use recoverable deletion', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'snapshot', view: { width: 800, stars: [] } });
  for (let i = 0; i < 3; i++) await a.backups('save');
  const entries = await a.drive().listBackups(); expect(entries).toHaveLength(3);
  a.gm.set('saved', 'changed'); await a.backups('apply', entries[0]);
  expect(a.gm.get('string_theory.sync.recovery').data.gm.saved.value).toBe('changed');
  a.store.applyPending(); expect(a.gm.get('saved')).toBe('snapshot');
  const file = server.files.get(entries[0].id); file.version = '2'; file.headRevisionId = 'revision2'; file.revisions.set('revision2', '{}');
  await expect(a.backups('delete', entries[0])).rejects.toThrow('Refresh');
  // The selected revision remains readable even if Drive's current content changed.
  expect((await a.drive().readBackup(entries[0])).data.gm.saved.value).toBe('snapshot');
  await a.backups('delete', entries[1]); expect(server.files.get(entries[1].id).trashed).toBe(true);
  expect(await a.drive().listBackups()).toHaveLength(2);
  expect(server.calls.some(c => c.method === 'DELETE')).toBe(false);
  const sync = await a.drive().write(a.store.capture(), []);
  await expect(a.drive().deleteBackup({ id: sync.id })).rejects.toThrow('Invalid Google Drive backup');
});
test('expired Google access never prompts or sends a request; disconnect preserves Dropbox', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'keep', 'string_theory.sync.google.auth': { accessToken: { token: 'old', expiresAt: 1 } } });
  await a.run(true); expect(server.calls).toEqual([]); expect(a.state().error).toContain('Reconnect Google Drive');
  expect(a.gm.get('saved')).toBe('keep');
  a.disconnect(); expect(a.gm.get('string_theory.sync.google.auth')).toBeUndefined(); expect(a.gm.get('string_theory.sync.auth').refreshToken.token).toBe('dropbox-token');
});
test('metadata-only Drive version changes do not block deleting unchanged backup content', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'snapshot' });
  await a.backups('save'); const selected = (await a.drive().listBackups())[0];
  const file = server.files.get(selected.id);
  file.version = '9'; // Drive version includes changes beyond content revisions.
  await a.backups('delete', selected);
  expect(file.trashed).toBe(true);
});
test('Google cancellation and denied scopes keep working credentials; successful reconnect survives staged imports', { tag: '@unit' }, async () => {
  const server = googleCloud(); let config;
  const googleApi = { initTokenClient: options => { config = options; return { requestAccessToken: () => {} }; }, hasGrantedAllScopes: r => r.scope === 'https://www.googleapis.com/auth/drive.file' };
  const a = runtime(server, { 'string_theory.sync.google.base': { old: true } }, googleApi), before = structuredClone(a.gm.get('string_theory.sync.google.auth'));
  a.connect(); expect(config.client_id).toContain('762250056217-'); expect(config.include_granted_scopes).toBe(false);
  config.error_callback({ type: 'popup_closed' }); expect(a.gm.get('string_theory.sync.google.auth')).toEqual(before);
  a.connect(); config.callback({ access_token: 'wrong-scope', token_type: 'Bearer', expires_in: 3600, scope: '' });
  await expect.poll(() => a.messages.at(-1)).toContain('permission was not granted');
  expect(a.gm.get('string_theory.sync.google.auth')).toEqual(before);
  a.store.stage(a.store.capture()); a.connect();
  config.callback({ access_token: 'google-token', token_type: 'Bearer', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file' });
  await expect.poll(() => a.messages.at(-1)).toBe('Connected to Google Drive');
  a.store.applyPending(); expect(a.gm.get('string_theory.sync.google.auth').accessToken.expiresAt).toBeGreaterThan(before.accessToken.expiresAt - 1000);
  expect(a.gm.get('string_theory.sync.google.base')).toEqual({ old: true });
});
test('denied uploads, corrupt snapshots and incomplete Drive history preserve baseline and local data', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'keep' });
  await a.run(true); const before = structuredClone(a.gm.get('string_theory.sync.google.base'));
  server.denied = true; a.gm.set('saved', 'edit'); await a.run(true);
  expect(a.gm.get('string_theory.sync.google.base')).toEqual(before); expect(a.gm.get('saved')).toBe('edit');
  server.denied = false; const sync = [...server.files.values()].find(f => f.appProperties.stKind === 'sync');
  const original = sync.revisions.get(sync.headRevisionId); sync.revisions.set(sync.headRevisionId, '{}');
  await a.run(true); expect(a.gm.get('string_theory.sync.google.base')).toEqual(before);
  sync.revisions.set(sync.headRevisionId, original); sync.description = '{"parents":["missing"]}';
  await expect(a.drive().read()).rejects.toThrow('history is incomplete'); expect(a.gm.get('saved')).toBe('edit');
});
