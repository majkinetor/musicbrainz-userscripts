// External storage (#885). Provider IO is bundled; Google sign-in uses the official GIS client on demand.
var ST_DROPBOX_KEY = 'g73mzw3yp0xqgtd';
var ST_DROPBOX_REDIRECT = 'https://musicbrainz.org/?st-dropbox=callback';
var ST_SYNC_PATH = '/string-theory.json';
var ST_BACKUP_FOLDER = '/backups';
var stSyncBusy = false, stSyncTimer = null, stSyncActivity = '';
var stBackupSelected = null;
var stBackupEntries = null, stBackupNotice = '', stBackupDelete = null, stBackupAccount = null;
function stSyncFetch(url, options) {
  options = options || {};
  var target = new URL(String(url));
  if (target.protocol !== 'https:' || !/^(?:api\.dropbox\.com|api\.dropboxapi\.com|content\.dropboxapi\.com|www\.googleapis\.com)$/.test(target.hostname)) return Promise.reject(new Error('Unexpected sync destination'));
  var headers = new Headers(options.headers || {}), body = options.body;
  if (body instanceof URLSearchParams) { headers.set('Content-Type', 'application/x-www-form-urlencoded'); body = body.toString(); }
  return Promise.resolve(body instanceof Blob ? body.arrayBuffer() : body).then(function (data) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({ method: options.method || 'GET', url: target.href, headers: Object.fromEntries(headers.entries()), data: data,
        anonymous: true, responseType: 'arraybuffer', timeout: 30000,
        onload: function (r) {
          if (!r.status) { reject(new Error('Storage connection failed')); return; }
          var h = new Headers();
          String(r.responseHeaders || '').split(/\r?\n/).forEach(function (line) { var i = line.indexOf(':'); if (i > 0) try { h.append(line.slice(0, i).trim(), line.slice(i + 1).trim()); } catch (e) {} });
          resolve(new Response(r.response || r.responseText || '', { status: r.status, headers: h }));
        },
        onerror: function () { reject(new Error('Storage connection failed')); },
        ontimeout: function () { reject(new Error('Storage connection timed out')); },
        onabort: function () { reject(new Error('Storage request cancelled')); },
      });
    });
  });
}
function stSyncSettings() {
  var v = GM_getValue('string_theory.sync.settings', {}) || {};
  return { provider: v.provider === 'google' ? 'google' : 'dropbox', automatic: v.automatic === true, minutes: Math.max(5, Math.min(1440, Number(v.minutes) || 30)), conflict: v.conflict === 'local' ? 'local' : 'remote' };
}
function stSyncSaveSettings(patch) {
  GM_setValue('string_theory.sync.settings', Object.assign(stSyncSettings(), patch));
  stSyncSchedule(); stSyncPaint();
}
function stSyncProvider() { return stSyncSettings().provider; }
function stSyncName(provider) { return (provider || stSyncProvider()) === 'google' ? 'Google Drive' : 'Dropbox'; }
function stSyncKey(part, provider) { return 'string_theory.sync.' + ((provider || stSyncProvider()) === 'google' ? 'google.' : '') + part; }
function stSyncAuth(provider) { return GM_getValue(stSyncKey('auth', provider), {}) || {}; }
function stSyncKeepNewAuth(provider) {
  var stage = GM_getValue('string_theory.sync.stage'); if (!stage) return;
  ['before', 'after'].forEach(function (side) { delete stage[side].gm[stSyncKey('auth', provider)]; });
  GM_setValue('string_theory.sync.stage', stage);
}
function stSyncConnected(provider) {
  provider = provider || stSyncProvider(); var auth = stSyncAuth(provider);
  return provider === 'google' ? !!(auth.accessToken && auth.accessToken.token && auth.accessToken.expiresAt > Date.now() + 15000) : !!auth.refreshToken;
}
function stSyncDrive(provider) { return (provider || stSyncProvider()) === 'google' ? stSyncGoogle() : stSyncDropbox(stSyncAuthorizer()); }
function stSyncState(patch, provider) {
  var s = GM_getValue(stSyncKey('state', provider), {}) || {};
  if (patch) { s = Object.assign(s, patch); GM_setValue(stSyncKey('state', provider), s); }
  return s;
}
function stSyncAuthorizer(persist) {
  var auth = GM_getValue('string_theory.sync.auth', {}) || {};
  var tokens = Object.assign({}, auth);
  function save(k, v) { if (v) tokens[k] = v; else delete tokens[k]; if (persist !== false) GM_setValue('string_theory.sync.auth', Object.assign({}, tokens)); }
  var a = new stSyncProviders.DropboxAuthorizer({ clientId: ST_DROPBOX_KEY, redirectUrl: ST_DROPBOX_REDIRECT,
    scope: 'account_info.read files.metadata.read files.content.read files.content.write',
    onSetAccessToken: function (v) { save('accessToken', v); }, onSetRefreshToken: function (v) { save('refreshToken', v); },
  }, auth);
  a.stSyncTokens = tokens;
  return a;
}
// The provider's standard put() overwrites. Use its authenticated request layer with Dropbox's
// revision precondition, and download the exact revision read from metadata, for a safe retry.
function stSyncDropbox(authorizer) {
  var drive = new stSyncProviders.Dropbox({ authProvider: 'dropbox', user: '' }, { authorizer: authorizer, fetch: stSyncFetch });
  async function request(url, options) {
    try { return await drive.request(url, options); } catch (e) {
      if (!e.response || e.response.status !== 401 || !GM_getValue('string_theory.sync.auth', {}).refreshToken) throw e;
      authorizer.setAccessToken({ token: 'expired', expiresAt: 1 });
      return drive.request(url, options);
    }
  }
  function missing(e) { return e.response && e.response.status === 409 && /^path\/not_found(?:\/|$)/.test(e.cause && e.cause.error_summary || ''); }
  function backupEntry(entry) {
    if (!entry || entry['.tag'] !== 'file' || typeof entry.name !== 'string' || typeof entry.id !== 'string' || !entry.id || typeof entry.rev !== 'string' || !entry.rev
      || !/^\/backups\/string-theory-[\w.-]+\.json$/.test(entry.path_lower || '') || !Number.isFinite(entry.size) || entry.size < 0) throw new Error('Invalid remote backup');
    return entry;
  }
  async function download(path, rev, size) {
    if (size > 10 * 1024 * 1024) throw new Error('Dropbox backup exceeds 10 MB');
    var blob = await request('https://content.dropboxapi.com/2/files/download', {
      method: 'POST', headers: { 'Dropbox-API-Arg': JSON.stringify({ path: path, rev: rev }) }, responseType: 'blob',
    });
    var info = {}, data = stSyncStorage.read(await blob.text(), info);
    return { rev: rev, data: data, filtered: info.filtered };
  }
  function upload(data, path, rev) {
    var text = JSON.stringify(stSyncStorage.document(data));
    if (new Blob([text]).size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    return request('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: path, mode: rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' }, autorename: false, strict_conflict: true, mute: true }) },
      body: new Blob([text], { type: 'application/octet-stream' }), responseType: 'json',
    });
  }
  return {
    account: function () { return drive.getAccount(); },
    read: async function () {
      var meta;
      try { meta = await request('https://api.dropboxapi.com/2/files/get_metadata', { method: 'POST', json: { path: ST_SYNC_PATH }, responseType: 'json' }); }
      catch (e) { if (missing(e)) return { rev: null, data: null }; throw e; }
      if (typeof meta.rev !== 'string' || !meta.rev) throw new Error('Dropbox returned no file revision');
      return download(ST_SYNC_PATH, meta.rev, meta.size);
    },
    write: function (data, rev) { return upload(data, ST_SYNC_PATH, rev); },
    backup: async function (data) {
      try { await request('https://api.dropboxapi.com/2/files/create_folder_v2', { method: 'POST', json: { path: ST_BACKUP_FOLDER, autorename: false }, responseType: 'json' }); }
      catch (e) {
        if (!(e.response && e.response.status === 409 && /^path\/conflict\/folder(?:\/|$)/.test(e.cause && e.cause.error_summary || ''))) throw e;
      }
      // Each save is a new immutable snapshot, independent of the live sync file.
      var path = ST_BACKUP_FOLDER + '/string-theory-' + new Date().toISOString().replace(/:/g, '-') + '-' + crypto.randomUUID() + '.json';
      return backupEntry(Object.assign({ '.tag': 'file' }, await upload(data, path, null)));
    },
    listBackups: async function () {
      var page;
      try { page = await request('https://api.dropboxapi.com/2/files/list_folder', { method: 'POST', json: { path: ST_BACKUP_FOLDER, recursive: false, include_deleted: false, limit: 1000 }, responseType: 'json' }); }
      catch (e) { if (missing(e)) return []; throw e; }
      var entries = [], cursors = Object.create(null);
      for (;;) {
        if (!page || !Array.isArray(page.entries)) throw new Error('Invalid Dropbox backup list');
        page.entries.forEach(function (entry) { try { entries.push(backupEntry(entry)); } catch (e) { /* unrelated files and folders */ } });
        if (!page.has_more) break;
        if (!page.cursor || cursors[page.cursor]) throw new Error('Invalid Dropbox backup cursor');
        cursors[page.cursor] = true;
        page = await request('https://api.dropboxapi.com/2/files/list_folder/continue', { method: 'POST', json: { cursor: page.cursor }, responseType: 'json' });
      }
      return entries.sort(function (a, b) { return String(b.server_modified).localeCompare(String(a.server_modified)) || b.name.localeCompare(a.name); });
    },
    readBackup: async function (entry) {
      backupEntry(entry);
      try { return await download(entry.id, entry.rev, entry.size); }
      catch (e) { if (e.response && e.response.status === 409) throw new Error('Backup is unavailable. Refresh the list.'); throw e; }
    },
    deleteBackup: async function (entry) {
      backupEntry(entry);
      try { return await request('https://api.dropboxapi.com/2/files/delete_v2', { method: 'POST', json: { path: entry.id, parent_rev: entry.rev }, responseType: 'json' }); }
      catch (e) { if (e.response && e.response.status === 409) throw new Error('Backup changed or is unavailable. Refresh the list.'); throw e; }
    },
  };
}
async function stBackupRun(mode, entry) {
  if (stSyncBusy) return;
  var provider = stSyncProvider(), name = stSyncName(provider);
  if (!stSyncConnected(provider)) throw new Error('Connect ' + name + ' first');
  if (entry && (entry.provider || 'dropbox') !== provider) throw new Error('Provider changed. Refresh the backup list.');
  stSyncBusy = true; stSyncActivity = 'backup'; stBackupNotice = ''; stBackupDelete = null; stSyncPaint();
  try {
    var drive = stSyncDrive(provider);
    if (mode === 'save') {
      var saved = await drive.backup(stSyncStorage.effective());
      if (stBackupEntries !== null) stBackupEntries.unshift(saved);
      stBackupNotice = 'Backup saved to ' + name + '.';
    } else if (mode === 'list') {
      stBackupEntries = await drive.listBackups();
    } else if (mode === 'apply') {
      var incoming = (await drive.readBackup(entry)).data;
      stSyncImport(incoming); stBackupBrowse(document.getElementById('st-p-s'), false);
      stBackupNotice = 'Imported. Reload to apply the changes.';
    } else if (mode === 'delete') {
      await drive.deleteBackup(entry);
      stBackupEntries = (stBackupEntries || []).filter(function (item) { return item.id !== entry.id; });
      stBackupNotice = 'Backup deleted from ' + name + '.';
    } else throw new Error('Unknown backup action');
    if (mode !== 'list') stUI().mbuToast(stBackupNotice);
  } catch (e) {
    stBackupNotice = stSyncError(e);
    throw e;
  } finally { stSyncBusy = false; stSyncActivity = ''; stSyncPaint(); }
}
function stSyncImport(incoming) {
  // Partial imports preserve data absent from the file; incoming values win shared fields.
  stSyncStorage.stage(stSyncStorage.merge(undefined, stSyncStorage.effective(), incoming, 'remote'));
}
function stBackupBrowse(panel, open) {
  if (!panel) return;
  var remote = panel.querySelector('#st-sync-remote'); remote.hidden = !open;
  Array.prototype.forEach.call(panel.children, function (child) { if (child !== remote) child.inert = open; });
  if (!open) stBackupDelete = null;
}
function stBackupPaint(panel, connected) {
  var list = panel.querySelector('#st-sync-backups'); if (!list) return;
  list.hidden = stBackupEntries === null;
  panel.querySelector('#st-sync-backup-status').textContent = stBackupNotice;
  list.replaceChildren();
  if (stBackupEntries === null) return;
  if (!stBackupEntries.length) { list.textContent = 'No remote backups yet.'; stBackupSelected = null; return; }
  var selected = stBackupEntries.findIndex(function (entry) { return entry.id === stBackupSelected; });
  if (selected < 0) selected = 0;
  stBackupSelected = stBackupEntries[selected].id;
  var choices = document.createElement('div'); choices.className = 'st-backup-choices'; choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Saved backups');
  stBackupEntries.forEach(function (entry, i) {
    var row = document.createElement('button'); row.type = 'button'; row.className = 'st-backup-choice';
    row.dataset.backupSelect = String(i); row.setAttribute('aria-pressed', String(i === selected)); row.disabled = stSyncBusy || !connected;
    var date = new Date(entry.server_modified), label = document.createElement('span'), size = document.createElement('small');
    label.textContent = isNaN(date.getTime()) ? entry.name : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    size.textContent = Math.max(1, Math.ceil(entry.size / 1024)) + ' KB';
    row.append(label, size); choices.appendChild(row);
  });
  list.appendChild(choices);
  var actions = document.createElement('div'); actions.className = 'st-backup-actions';
  var entry = stBackupEntries[selected];
  [['apply', 'Apply'], ['delete', stBackupDelete === entry.id ? 'Confirm delete' : 'Delete']].concat(stBackupDelete === entry.id ? [['cancel', 'Cancel']] : []).forEach(function (pair) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'st-b'; button.textContent = pair[1];
    button.dataset.backupAction = pair[0]; button.dataset.backupIndex = String(selected); button.disabled = stSyncBusy || !connected;
    if (pair[0] === 'apply') button.dataset.tip = 'Merge this backup into your settings&#10;Applies on the next page load'.replace('&#10;', '\n');
    actions.appendChild(button);
  });
  list.appendChild(actions);
}
function stSyncError(e, provider) {
  var name = stSyncName(provider);
  var status = e && (e.status || e.response && e.response.status);
  if (status === 400 || status === 401 || e instanceof stSyncProviders.OAuth2Error) return name + ' authorization failed. Connect again.';
  if (status === 403) return name + ' denied access. Check the app permissions.';
  if (status === 429) return name + ' is busy. Try again later.';
  // Never show a provider response body: it may contain tokens or copied credentials.
  return status ? name + ' request failed (HTTP ' + status + ')' : e && e.message || 'Sync failed';
}
async function stSyncConnect() {
  if (stSyncBusy) return;
  var authorizer = stSyncAuthorizer(false);
  var url = await authorizer.buildAuthUrl();
  // The callback runs in the same userscript namespace, including when this tab was reloaded.
  var pending = { state: authorizer.session.state, codeVerifier: authorizer.session.codeVerifier, at: Date.now() };
  GM_setValue('string_theory.sync.oauth', pending);
  stSyncAuthPending = { state: pending.state, at: pending.at };
  if (typeof GM_openInTab === 'function') GM_openInTab(url, { active: true, insert: true });
  else window.open(url, '_blank', 'noopener');
  stSyncPaint();
}
var stSyncAuthPending = null;
async function stSyncFinish(callback) {
  callback = new URL(String(callback));
  var pending = GM_getValue('string_theory.sync.oauth');
  if (!pending || Date.now() - pending.at > 10 * 60e3) throw new Error('Authorization expired. Connect again.');
  if (callback.origin !== 'https://musicbrainz.org' || callback.pathname !== '/' || callback.searchParams.get('st-dropbox') !== 'callback' || callback.searchParams.get('state') !== pending.state) throw new Error('Authorization callback did not match this connection');
  if (callback.searchParams.has('error')) throw new Error(callback.searchParams.get('error') === 'access_denied' ? 'Dropbox authorization cancelled' : 'Dropbox authorization failed');
  var a = stSyncAuthorizer(false);
  a.session = { state: pending.state, codeVerifier: pending.codeVerifier };
  // Keep the old credentials until the replacement has completed successfully.
  await a.finishAuth(callback);
  var account = await stSyncDropbox(a).account();
  if ((GM_getValue('string_theory.sync.oauth') || {}).state !== pending.state) throw new Error('A newer Dropbox connection was started');
  stSyncKeepNewAuth('dropbox');
  GM_setValue('string_theory.sync.auth', a.stSyncTokens);
  var previous = stSyncState(null, 'dropbox');
  if (previous.account && previous.account !== account.id) {
    GM_deleteValue('string_theory.sync.base'); GM_deleteValue('string_theory.sync.stage');
  }
  stSyncState({ account: account.id, name: account.name, error: '', notice: '', at: 0, next: 0, failures: 0 }, 'dropbox');
  GM_deleteValue('string_theory.sync.oauth');
  GM_setValue('string_theory.sync.oauth.result', { state: pending.state, ok: true, at: Date.now() });
  stSyncAuthPending = null; stSyncSchedule(); stSyncPaint();
}
function stSyncListenAuth() {
  var pending = GM_getValue('string_theory.sync.oauth');
  if (pending && Date.now() - pending.at <= 10 * 60e3) stSyncAuthPending = { state: pending.state, at: pending.at };
  if (typeof GM_addValueChangeListener !== 'function') return;
  GM_addValueChangeListener('string_theory.sync.oauth.result', function (key, old, result) {
    if (!result || !stSyncAuthPending || result.state !== stSyncAuthPending.state) return;
    stSyncAuthPending = null;
    stSyncSchedule(); stSyncPaint();
    stUI().mbuToast(result.ok ? 'Connected to Dropbox' : result.error || 'Dropbox authorization failed', result.ok ? {} : { kind: 'error' });
  });
}
async function stSyncCallback() {
  // Scrub the single-use authorization code before the rest of MusicBrainz draws its links.
  var url = location.href, state = new URL(url).searchParams.get('state');
  history.replaceState(null, '', ST_DROPBOX_REDIRECT);
  var message;
  try { await stSyncFinish(url); message = 'Connected to Dropbox. You can close this tab.'; }
  catch (e) {
    message = stSyncError(e);
    var pending = GM_getValue('string_theory.sync.oauth');
    if (pending && pending.state === state) {
      GM_deleteValue('string_theory.sync.oauth');
      GM_setValue('string_theory.sync.oauth.result', { state: state, ok: false, error: message, at: Date.now() });
    }
  }
  function show() {
    var box = document.createElement('div');
    box.style.cssText = 'max-width:560px;margin:48px auto;padding:20px;font:16px/1.5 system-ui,sans-serif';
    var h = document.createElement('h1'); h.textContent = 'String Theory';
    var p = document.createElement('p'); p.textContent = message;
    box.append(h, p); document.body.replaceChildren(box);
    if (message.indexOf('Connected') === 0) window.close();
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true });
}
function stSyncDisconnect() {
  var provider = stSyncProvider(), old = stSyncState(), stage = GM_getValue('string_theory.sync.stage');
  if (stage) {
    ['before', 'after'].forEach(function (side) { delete stage[side].gm[stSyncKey('auth', provider)]; delete stage[side].gm['string_theory.sync.settings']; });
    GM_setValue('string_theory.sync.stage', stage);
  }
  GM_deleteValue(stSyncKey('auth', provider)); GM_deleteValue(stSyncKey('base', provider));
  stSyncAuthPending = null;
  GM_deleteValue('string_theory.sync.oauth');
  GM_deleteValue('string_theory.sync.oauth.result');
  GM_setValue('string_theory.sync.settings', Object.assign(stSyncSettings(), { automatic: false }));
  GM_setValue(stSyncKey('state', provider), old.account ? { account: old.account } : {});
  GM_deleteValue('string_theory.sync.google.oauth');
  stSyncSchedule(); stSyncPaint();
}
async function stSyncRun(manual, mode) {
  mode = mode || 'sync';
  var provider = stSyncProvider(), name = stSyncName(provider);
  if (!manual && provider === 'google') return;
  if (['sync', 'push', 'pull'].indexOf(mode) < 0) throw new Error('Unknown sync action');
  if (stSyncBusy) return;
  async function run() {
    var state = stSyncState(null, provider), settings = stSyncSettings();
    if (!stSyncConnected(provider)) {
      if (provider === 'google' && stSyncAuth(provider).accessToken) stSyncState({ error: 'Google Drive session expired. Reconnect Google Drive.' }, provider);
      stSyncPaint(); return;
    }
    if (!manual && (!settings.automatic || Date.now() < (state.next || 0))) return;
    stSyncBusy = true; stSyncActivity = 'sync'; stSyncPaint();
    try {
      var drive = stSyncDrive(provider);
      for (var attempt = 0; attempt < 4; attempt++) {
        var remote = await drive.read(), local = stSyncStorage.effective();
        var base = GM_getValue(stSyncKey('base', provider));
        if (mode === 'pull' && !remote.data) {
          stSyncState({ notice: 'No ' + name + ' backup yet. Local data unchanged.', error: '' }, provider);
          if (manual) stUI().mbuToast('No ' + name + ' backup yet. Local data unchanged.');
          return;
        }
        var conflicts = [], merged;
        if (mode === 'pull') merged = remote.data;
        else if (mode === 'push') merged = { gm: local.gm, local: Object.assign({}, remote.data && remote.data.local || {}, local.local) };
        else merged = remote.data ? stSyncStorage.merge(base, local, remote.data, settings.conflict, conflicts) : local;
        try {
          if (mode !== 'pull' && (remote.filtered || stSyncData.stable(merged) !== stSyncData.stable(remote.data))) await drive.write(merged, remote.rev);
        } catch (e) {
          if (e.response && e.response.status === 409 && /conflict/.test(e.cause && e.cause.error_summary || '') && attempt < 3) continue;
          throw e;
        }
        // A user may have changed settings during the request; keep those edits for the next run.
        var after = stSyncStorage.effective();
        var pending = stSyncStorage.merge(local, after, merged, 'local');
        if (mode !== 'push' && stSyncData.stable(pending) !== stSyncData.stable(after)) stSyncStorage.stage(pending);
        GM_setValue(stSyncKey('base', provider), merged);
        stSyncState({ at: Date.now(), next: Date.now() + settings.minutes * 60e3, error: '', notice: '', failures: 0, conflicts: conflicts.length }, provider);
        if (manual) stUI().mbuToast(stSyncStorage.pending() ? (mode === 'pull' ? 'Pulled from ' + name + '.' : 'Synced.') + ' Reload to apply downloaded changes.' : mode === 'push' ? 'Pushed to ' + name : mode === 'pull' ? 'Pulled from ' + name : remote.data ? 'Synced with ' + name : 'Created the first ' + name + ' backup');
        return;
      }
    } catch (e) {
      var failures = (stSyncState(null, provider).failures || 0) + 1;
      stSyncState({ error: stSyncError(e, provider), failures: failures, next: Date.now() + Math.min(60, Math.pow(2, Math.min(6, failures))) * 60e3 }, provider);
      if (manual) stUI().mbuToast(stSyncError(e, provider), { kind: 'error' });
    } finally { stSyncBusy = false; stSyncActivity = ''; stSyncPaint(); }
  }
  // Web Locks serializes tabs on this origin. Revision-checked writes also protect other origins
  // and other devices, which cannot share that lock.
  if (navigator.locks) await navigator.locks.request('string-theory-' + provider, { ifAvailable: true }, function (lock) {
    if (lock) return run();
    if (manual) stUI().mbuToast('Another tab is syncing with ' + name);
  });
  else {
    var lease = GM_getValue('string_theory.sync.lease', {}), owner = crypto.randomUUID();
    if (lease.until > Date.now()) { if (manual) stUI().mbuToast('Another tab is syncing with ' + name); return; }
    GM_setValue('string_theory.sync.lease', { owner: owner, until: Date.now() + 45000 });
    if (GM_getValue('string_theory.sync.lease', {}).owner !== owner) return;
    var heartbeat = setInterval(function () {
      if (GM_getValue('string_theory.sync.lease', {}).owner === owner) GM_setValue('string_theory.sync.lease', { owner: owner, until: Date.now() + 45000 });
    }, 10000);
    try { await run(); } finally {
      clearInterval(heartbeat);
      if (GM_getValue('string_theory.sync.lease', {}).owner === owner) GM_deleteValue('string_theory.sync.lease');
    }
  }
}
function stSyncSchedule() {
  if (stSyncTimer) clearInterval(stSyncTimer);
  stSyncTimer = null;
  if ((typeof __stSyncCallbackOnly !== 'undefined' && __stSyncCallbackOnly) || !ST_ON_MB || stSyncProvider() === 'google' || !stSyncSettings().automatic || !stSyncConnected()) return;
  stSyncTimer = setInterval(function () { stSyncRun(false).catch(function () {}); }, 60000);
  stSyncRun(false).catch(function () {});
}
function stSyncDownload(doc, name) {
  var url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
  var a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function stSyncMarkup() {
  return '<div class="st-row st-sync-between"><select id="st-sync-provider" aria-label="Provider"><option value="dropbox">Dropbox</option><option value="google">Google Drive</option></select><button class="st-b st-sync-link" type="button" id="st-sync-connect">Connect</button><button class="st-b st-sync-link" type="button" id="st-sync-disconnect" hidden>Disconnect</button></div>'
    + '<p class="st-cap" id="st-sync-status" role="status"></p>'
    + '<p class="st-cap st-sync-group" id="st-sync-google-message" hidden>Google Drive supports backups and imports only. Sync is disabled because Google access expires after about one hour.</p>'
    + '<section class="st-sync-group st-sync-columns" id="st-sync-controls"><div><div class="st-row st-sync-between"><h3>Sync<span class="st-sync-spinner" id="st-sync-progress" role="status" aria-label="In progress" hidden></span></h3><span class="st-cap" id="st-sync-last"></span></div>'
    + '<div class="st-row"><button class="st-b st-sync-primary" type="button" id="st-sync-now" data-tip="Merge this device with Dropbox">Sync now</button><button class="st-b" type="button" id="st-sync-push" data-tip="Replace Dropbox’s portable data with this device’s">Push</button><button class="st-b" type="button" id="st-sync-pull" data-tip="Replace this device’s portable data with Dropbox’s\nKeeps device settings; applies on the next page load">Pull</button></div>'
    + '</div><div class="st-sync-options"><h3>Sync options</h3>'
    + '<div class="st-row"><label data-tip="Automatic sync&#10;Runs while MusicBrainz is open"><input id="st-sync-auto" type="checkbox"> Automatic sync</label><label for="st-sync-minutes">every</label><select id="st-sync-minutes"><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">1 day</option></select></div>'
    + '<div class="st-row"><label for="st-sync-conflict">On conflict</label><select id="st-sync-conflict"><option value="remote">Use remote value</option><option value="local">Use local value</option></select></div></div></section>'
    + '<section class="st-sync-group"><h3>Backups<span class="st-sync-spinner" id="st-sync-backup-progress" role="status" aria-label="In progress" hidden></span></h3><div class="st-backup-columns"><div class="st-row st-sync-backup-row"><span id="st-sync-backup-name">Dropbox</span><button class="st-b" type="button" id="st-sync-remote-backup">Save backup</button><button class="st-b" type="button" id="st-sync-remote-import">Browse</button></div>'
    + '<div class="st-row st-sync-backup-row"><span>This device</span><button class="st-b" type="button" id="st-sync-export">Export</button><button class="st-b" type="button" id="st-sync-import">Import</button><input id="st-sync-file" type="file" accept=".json,application/json" hidden></div></div><div class="st-row"><button class="st-b" type="button" id="st-sync-reload" hidden>Reload</button><span id="st-sync-backup-status" role="status"></span></div>'
    + '</section><div id="st-sync-remote" role="region" aria-labelledby="st-sync-backup-provider" hidden><div class="st-backup-head"><h3 id="st-sync-backup-provider">Backups</h3><span class="st-sync-spinner" id="st-sync-browse-progress" role="status" aria-label="In progress" hidden></span><button class="st-b st-sync-link" type="button" id="st-sync-backup-refresh">Refresh</button><button class="mbu-ov-x" type="button" id="st-sync-backup-close" aria-label="Close backups">×</button></div><div id="st-sync-backups" aria-label="Saved backups" hidden></div></div>';
}
function stSyncPaint() {
  var panel = document.getElementById('st-p-s'); if (!panel) return;
  var q = function (id) { return panel.querySelector('#st-sync-' + id); };
  var provider = stSyncProvider(), name = stSyncName(provider), auth = stSyncAuth(provider), state = stSyncState(), settings = stSyncSettings(), connected = stSyncConnected(provider);
  var backupAccount = provider + ':' + (state.account || '');
  q('provider').value = provider; q('provider').disabled = stSyncBusy;
  q('controls').hidden = provider === 'google'; q('google-message').hidden = provider !== 'google';
  q('backup-provider').textContent = name + ' backups';
  q('backup-name').textContent = name;
  q('backups').setAttribute('aria-label', name + ' backups');
  q('now').dataset.tip = 'Merge this device with ' + name;
  q('push').dataset.tip = 'Replace ' + name + '’s portable data with this device’s';
  q('pull').dataset.tip = 'Replace this device’s portable data with ' + name + '’s\nKeeps device settings; applies on the next page load';
  if (stBackupAccount !== backupAccount || !connected) {
    stBackupAccount = backupAccount; stBackupEntries = null; stBackupDelete = null; stBackupNotice = '';
    stBackupSelected = null; stBackupBrowse(panel, false);
  }
  q('connect').textContent = connected || auth.accessToken ? 'Reconnect' : 'Connect';
  if (provider === 'google' && !stGoogleReady) q('connect').textContent = stGoogleLoading ? 'Loading Google sign-in…' : 'Load Google sign-in';
  q('disconnect').hidden = !auth.refreshToken && !auth.accessToken;
  q('auto').checked = settings.automatic; q('minutes').value = String(settings.minutes); q('conflict').value = settings.conflict;
  q('now').disabled = stSyncBusy || !connected || provider === 'google'; q('connect').disabled = stSyncBusy || provider === 'google' && !!stGoogleLoading; q('disconnect').disabled = stSyncBusy;
  q('push').disabled = stSyncBusy || !connected || provider === 'google'; q('pull').disabled = stSyncBusy || !connected || provider === 'google';
  ['auto', 'minutes', 'conflict'].forEach(function (id) { q(id).disabled = provider === 'google'; });
  ['remote-backup', 'remote-import', 'backup-refresh'].forEach(function (id) { q(id).disabled = stSyncBusy || !connected; });
  q('import').disabled = stSyncBusy;
  stBackupPaint(panel, connected);
  q('reload').hidden = !stSyncStorage.pending();
  q('status').textContent = stSyncBusy ? '' : (provider === 'google' && auth.accessToken && !connected ? 'Google Drive session expired. Reconnect to continue.' : provider === 'google' && stGoogleError ? stGoogleError : state.error) || (stSyncAuthPending ? 'Waiting for Dropbox authorization…' : state.notice || (connected ? '' : 'Not connected'));
  q('status').hidden = !q('status').textContent;
  q('progress').hidden = !stSyncBusy || stSyncActivity !== 'sync';
  q('backup-progress').hidden = !stSyncBusy || stSyncActivity !== 'backup';
  q('browse-progress').hidden = !stSyncBusy || stSyncActivity !== 'backup';
  var last = state.at && new Date(state.at), today = new Date();
  q('last').textContent = last ? 'Last sync: ' + new Intl.DateTimeFormat(undefined, last.toDateString() === today.toDateString() ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'short', timeStyle: 'short' }).format(last) : '';
  q('last').dataset.tip = last ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(last) : '';
}
function stSyncBind(panel) {
  var q = function (id) { return panel.querySelector('#st-sync-' + id); };
  var action = function (fn) { return function () { Promise.resolve().then(fn).catch(function (e) { stUI().mbuToast(stSyncError(e), { kind: 'error' }); }).finally(stSyncPaint); }; };
  q('provider').onchange = function () { stSyncSaveSettings({ provider: q('provider').value }); if (stSyncProvider() === 'google') stGoogleLoad().catch(function () {}); };
  q('connect').onclick = function () {
    if (stSyncProvider() === 'google') { var loaded = stGoogleConnect(); if (loaded && loaded.catch) loaded.catch(function () {}); }
    else action(stSyncConnect)();
  };
  q('disconnect').onclick = stSyncDisconnect;
  q('auto').onchange = function () { stSyncSaveSettings({ automatic: q('auto').checked }); };
  q('minutes').onchange = function () { stSyncSaveSettings({ minutes: +q('minutes').value }); };
  q('conflict').onchange = function () { stSyncSaveSettings({ conflict: q('conflict').value }); };
  q('now').onclick = action(function () { return stSyncRun(true); });
  q('push').onclick = action(function () { return stSyncRun(true, 'push'); });
  q('pull').onclick = action(function () { return stSyncRun(true, 'pull'); });
  q('remote-backup').onclick = action(function () { return stBackupRun('save'); });
  q('remote-import').onclick = action(function () { stBackupBrowse(panel, true); q('backup-close').focus(); return stBackupRun('list'); });
  q('backup-refresh').onclick = action(function () { return stBackupRun('list'); });
  q('backup-close').onclick = function () { stBackupBrowse(panel, false); q('remote-import').focus(); };
  q('backups').onclick = function (event) {
    var choice = event.target.closest('button[data-backup-select]');
    if (choice && !stSyncBusy) {
      var index = choice.dataset.backupSelect;
      stBackupSelected = stBackupEntries[Number(index)].id; stBackupDelete = null; stSyncPaint();
      q('backups').querySelector('[data-backup-select="' + index + '"]').focus(); return;
    }
    var button = event.target.closest('button[data-backup-action]'); if (!button || stSyncBusy) return;
    var entry = stBackupEntries && stBackupEntries[Number(button.dataset.backupIndex)]; if (!entry) return;
    var mode = button.dataset.backupAction;
    if (mode === 'cancel') { stBackupDelete = null; stSyncPaint(); return; }
    if (mode === 'delete' && stBackupDelete !== entry.id) { stBackupDelete = entry.id; stSyncPaint(); return; }
    action(function () { return stBackupRun(mode, entry); })();
  };
  q('reload').onclick = function () { location.reload(); };
  q('export').onclick = action(function () { stSyncDownload(stSyncStorage.document(stSyncStorage.effective()), 'string-theory-backup.json'); });
  q('import').onclick = function () { q('file').click(); };
  q('file').onchange = action(async function () {
    var file = q('file').files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    var incoming = stSyncStorage.read(await file.text());
    stSyncImport(incoming);
    q('file').value = ''; stUI().mbuToast('Imported. Reload to apply the changes.');
  });
  if (stSyncProvider() === 'google') stGoogleLoad().catch(function () {});
  stSyncPaint();
}
