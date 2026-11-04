import { readFileSync } from 'node:fs';
import { test, expect } from '../../../dev/test/harness.mjs';
import { googleCloud } from './support/google-drive.mjs';
const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const TOKEN = 'https://oauth2.googleapis.com/token';
// Google Drive connects by a redirect code flow with a refresh token (#885), as Dropbox does.
// `server.token(form)` answers the token endpoint; the default is a working exchange.
function runtime(server, seed = {}) {
  const gm = new Map(Object.entries({ 'string_theory.sync.settings': { provider: 'google' },
    'string_theory.sync.google.auth': { accessToken: { token: 'google-token', expiresAt: Date.now() + 3600000 }, refreshToken: { token: 'google-refresh' } },
    'string_theory.sync.auth': { refreshToken: { token: 'dropbox-token' } }, ...seed }));
  const messages = [], ls = new Map(), tokenCalls = [];
  let opened;
  server.token = server.token || (() => ({ status: 200, text: JSON.stringify({ access_token: 'google-token', refresh_token: 'google-refresh-new', expires_in: 3600, token_type: 'Bearer', scope: 'https://www.googleapis.com/auth/drive.file' }), headers: 'content-type: application/json' }));
  const answer = opts => {
    if (opts.url === TOKEN) { const form = new URLSearchParams(opts.data); tokenCalls.push(form); return server.token(form); }
    return server.request(opts);
  };
  const xhr = opts => Promise.resolve().then(() => answer(opts)).then(reply => opts.onload({ status: reply.status, response: new TextEncoder().encode(reply.text).buffer, responseHeaders: reply.headers }), () => opts.onerror({}));
  const args = ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues', 'GM_xmlhttpRequest', 'location', 'localStorage', 'document', 'navigator', 'stUI', 'ST_ON_MB', 'window'];
  const code = ['sync-data.js', 'sync-policy.js', 'sync-storage.js', 'providers.js', 'sync.js', 'sync-google.js'].map(source).join('\n')
    + ';stSyncStorageInit(); return {run:stSyncRun,store:stSyncStorage,drive:stSyncGoogle,backups:stBackupRun,disconnect:stSyncDisconnect,connect:stSyncConnect,finish:stSyncFinish,state:stSyncState,key:stSyncKey,connected:stSyncConnected};';
  const api = new Function(...args, code)(
    (k, d) => gm.get(k) ?? d, (k, v) => gm.set(k, v), k => gm.delete(k), () => [...gm.keys()], xhr,
    { origin: 'https://test.musicbrainz.org' }, { getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v), removeItem: k => ls.delete(k) },
    { getElementById: () => null }, { locks: { request: async (key, options, fn) => fn({}) } },
    () => ({ mbuToast: msg => messages.push(msg) }), true, { open: url => { opened = url; } },
  );
  return { ...api, gm, messages, tokenCalls, opened: () => opened };
}
const value = x => ({ encoding: 'value', value: x });

test('automatic Google sync runs when due and on its own only when turned on', { tag: '@unit' }, async () => {
  const off = googleCloud(), a = runtime(off, { saved: 'keep' });
  await a.run(false);
  expect(off.calls).toEqual([]);
  const on = googleCloud(), b = runtime(on, { saved: 'keep', 'string_theory.sync.settings': { provider: 'google', automatic: true, minutes: 5 } });
  await b.run(false);
  expect(b.state().error).toBe('');
  expect((await b.drive().read()).data.gm.saved.value).toBe('keep');
  expect(b.gm.get('string_theory.sync.google.base')).toBeDefined();
  const count = on.calls.length; await b.run(false);
  expect(on.calls.length).toBe(count);   // not due again for five minutes
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
test('a popup-era Google token (no refresh token) never sends a request; disconnect preserves Dropbox', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'keep', 'string_theory.sync.google.auth': { accessToken: { token: 'old', expiresAt: 1 } } });
  expect(a.connected()).toBe(false);
  await a.run(true); expect(server.calls).toEqual([]); expect(a.tokenCalls).toEqual([]); expect(a.state().error).toContain('Reconnect Google Drive');
  expect(a.gm.get('saved')).toBe('keep');
  a.disconnect(); expect(a.gm.get('string_theory.sync.google.auth')).toBeUndefined(); expect(a.gm.get('string_theory.sync.auth').refreshToken.token).toBe('dropbox-token');
});
test('an expired Google access token is refreshed with the refresh token, not a prompt', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'keep', 'string_theory.sync.google.auth': { accessToken: { token: 'old', expiresAt: 1 }, refreshToken: { token: 'google-refresh' } } });
  await a.run(true);
  expect(a.state().error).toBe('');
  expect(a.opened()).toBeUndefined();
  expect(a.tokenCalls.map(f => f.get('grant_type'))).toEqual(['refresh_token']);
  expect(a.tokenCalls[0].get('refresh_token')).toBe('google-refresh');
  expect(a.gm.get('string_theory.sync.google.auth').accessToken.token).toBe('google-token');
});
test('metadata-only Drive version changes do not block deleting unchanged backup content', { tag: '@unit' }, async () => {
  const server = googleCloud(), a = runtime(server, { saved: 'snapshot' });
  await a.backups('save'); const selected = (await a.drive().listBackups())[0];
  const file = server.files.get(selected.id);
  file.version = '9'; // Drive version includes changes beyond content revisions.
  await a.backups('delete', selected);
  expect(file.trashed).toBe(true);
});
test('Google connects by redirect with PKCE; cancellation and a failed exchange keep working credentials; a reconnect survives staged imports', { tag: '@unit' }, async () => {
  const server = googleCloud();
  const a = runtime(server, { 'string_theory.sync.google.base': { old: true }, 'string_theory.sync.google.state': { account: 'google-account' } }), before = structuredClone(a.gm.get('string_theory.sync.google.auth'));
  const callback = (extra) => {
    const url = new URL(a.opened()), back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('state', url.searchParams.get('state'));
    Object.entries(extra).forEach(([k, v]) => back.searchParams.set(k, v));
    return back.href;
  };
  await a.connect();
  const url = new URL(a.opened());
  expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  expect(url.searchParams.get('client_id')).toContain('762250056217-');
  expect(url.searchParams.get('redirect_uri')).toBe('https://musicbrainz.org/?st-google=callback');
  expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  await expect(a.finish(callback({ error: 'access_denied' }))).rejects.toThrow('cancelled');
  expect(a.gm.get('string_theory.sync.google.auth')).toEqual(before); expect(a.tokenCalls).toEqual([]);
  server.token = () => ({ status: 400, text: '{"error":"invalid_grant"}', headers: 'content-type: application/json' });
  await a.connect();
  await expect(a.finish(callback({ code: 'bad-code' }))).rejects.toBeTruthy();
  expect(a.gm.get('string_theory.sync.google.auth')).toEqual(before);
  server.token = () => ({ status: 200, text: JSON.stringify({ access_token: 'google-token', expires_in: 3600, token_type: 'Bearer', scope: 'https://www.googleapis.com/auth/drive.file' }), headers: 'content-type: application/json' });
  await a.connect();
  await a.finish(callback({ code: 'no-refresh' }));   // Google may leave the refresh token out of a reconnect: the one held stays
  expect(a.gm.get('string_theory.sync.google.auth').refreshToken).toEqual(before.refreshToken);
  server.token = undefined;
  const b = runtime(server, { 'string_theory.sync.google.base': { old: true }, 'string_theory.sync.google.state': { account: 'google-account' } });
  b.store.stage(b.store.capture()); await b.connect();
  const back = new URL(new URL(b.opened()).searchParams.get('redirect_uri'));
  back.searchParams.set('state', new URL(b.opened()).searchParams.get('state')); back.searchParams.set('code', 'good-code');
  await b.finish(back.href);
  const form = b.tokenCalls.at(-1);
  expect(form.get('grant_type')).toBe('authorization_code'); expect(form.get('code')).toBe('good-code'); expect(form.get('code_verifier').length).toBeGreaterThanOrEqual(43);
  b.store.applyPending();
  expect(b.gm.get('string_theory.sync.google.auth').refreshToken.token).toBe('google-refresh-new');
  expect(b.gm.get('string_theory.sync.google.base')).toEqual({ old: true });   // same account: the baseline stays
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
