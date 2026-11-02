// External storage (#885). Providers are bundled locally; no remotely loaded code.
var ST_DROPBOX_KEY = 'g73mzw3yp0xqgtd';
var ST_SYNC_PATH = '/string-theory.json';
var stSyncBusy = false, stSyncTimer = null;
function stSyncFetch(url, options) {
  options = options || {};
  var target = new URL(String(url));
  if (target.protocol !== 'https:' || !/^(?:api\.dropbox\.com|api\.dropboxapi\.com|content\.dropboxapi\.com)$/.test(target.hostname)) return Promise.reject(new Error('Unexpected sync destination'));
  var headers = new Headers(options.headers || {}), body = options.body;
  if (body instanceof URLSearchParams) { headers.set('Content-Type', 'application/x-www-form-urlencoded'); body = body.toString(); }
  return Promise.resolve(body instanceof Blob ? body.arrayBuffer() : body).then(function (data) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({ method: options.method || 'GET', url: target.href, headers: Object.fromEntries(headers.entries()), data: data,
        anonymous: true, responseType: 'arraybuffer', timeout: 30000,
        onload: function (r) {
          if (!r.status) { reject(new Error('Dropbox connection failed')); return; }
          var h = new Headers();
          String(r.responseHeaders || '').split(/\r?\n/).forEach(function (line) { var i = line.indexOf(':'); if (i > 0) try { h.append(line.slice(0, i).trim(), line.slice(i + 1).trim()); } catch (e) {} });
          resolve(new Response(r.response || r.responseText || '', { status: r.status, headers: h }));
        },
        onerror: function () { reject(new Error('Dropbox connection failed')); },
        ontimeout: function () { reject(new Error('Dropbox connection timed out')); },
        onabort: function () { reject(new Error('Dropbox request cancelled')); },
      });
    });
  });
}
function stSyncSettings() {
  var v = GM_getValue('string_theory.sync.settings', {}) || {};
  return { automatic: v.automatic === true, minutes: Math.max(5, Math.min(1440, Number(v.minutes) || 30)), conflict: v.conflict === 'local' ? 'local' : 'remote' };
}
function stSyncSaveSettings(patch) {
  GM_setValue('string_theory.sync.settings', Object.assign(stSyncSettings(), patch));
  stSyncSchedule(); stSyncPaint();
}
function stSyncState(patch) {
  var s = GM_getValue('string_theory.sync.state', {}) || {};
  if (patch) { s = Object.assign(s, patch); GM_setValue('string_theory.sync.state', s); }
  return s;
}
function stSyncAuthorizer(persist) {
  var auth = GM_getValue('string_theory.sync.auth', {}) || {};
  var tokens = Object.assign({}, auth);
  function save(k, v) { if (v) tokens[k] = v; else delete tokens[k]; if (persist !== false) GM_setValue('string_theory.sync.auth', Object.assign({}, tokens)); }
  var a = new stSyncProviders.DropboxAuthorizer({ clientId: ST_DROPBOX_KEY, redirectUrl: undefined,
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
  return {
    account: function () { return drive.getAccount(); },
    read: async function () {
      var meta;
      try { meta = await request('https://api.dropboxapi.com/2/files/get_metadata', { method: 'POST', json: { path: ST_SYNC_PATH }, responseType: 'json' }); }
      catch (e) { if (e.response && e.response.status === 409 && /^path\/not_found(?:\/|$)/.test(e.cause && e.cause.error_summary || '')) return { rev: null, data: null }; throw e; }
      if (typeof meta.rev !== 'string' || !meta.rev) throw new Error('Dropbox returned no file revision');
      if (meta.size > 10 * 1024 * 1024) throw new Error('Dropbox backup exceeds 10 MB');
      var blob = await request('https://content.dropboxapi.com/2/files/download', {
        method: 'POST', headers: { 'Dropbox-API-Arg': JSON.stringify({ path: ST_SYNC_PATH, rev: meta.rev }) }, responseType: 'blob',
      });
      return { rev: meta.rev, data: stSyncStorage.read(await blob.text()) };
    },
    write: async function (data, rev) {
      var text = JSON.stringify(stSyncStorage.document(data));
      if (new Blob([text]).size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
      return request('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: ST_SYNC_PATH, mode: rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' }, autorename: false, strict_conflict: true, mute: true }) },
        body: new Blob([text], { type: 'application/octet-stream' }), responseType: 'json',
      });
    },
  };
}
function stSyncError(e) {
  var status = e && (e.status || e.response && e.response.status);
  if (status === 400 || status === 401 || e instanceof stSyncProviders.OAuth2Error) return 'Dropbox authorization failed. Connect again.';
  if (status === 403) return 'Dropbox denied access. Check the app permissions.';
  if (status === 429) return 'Dropbox is busy. Sync will retry later.';
  // Never show a provider response body: it may contain tokens or copied credentials.
  return status ? 'Dropbox request failed (HTTP ' + status + ')' : e && e.message || 'Sync failed';
}
async function stSyncConnect() {
  if (stSyncBusy) return;
  var authorizer = stSyncAuthorizer(false);
  var url = await authorizer.buildAuthUrl();
  // No redirect: Dropbox displays a code. The verifier remains in this tab and is never exported.
  stSyncAuthPending = { authorizer: authorizer, at: Date.now() };
  window.open(url, '_blank', 'noopener');
  stSyncPaint();
}
var stSyncAuthPending = null;
async function stSyncFinish(code) {
  if (!stSyncAuthPending || Date.now() - stSyncAuthPending.at > 10 * 60e3) throw new Error('Authorization expired. Connect again.');
  var a = stSyncAuthPending.authorizer;
  var callback = new URL('https://musicbrainz.org/');
  callback.searchParams.set('code', code.trim()); callback.searchParams.set('state', a.session.state);
  // Keep the old credentials until the replacement has completed successfully.
  await a.finishAuth(callback);
  var account = await stSyncDropbox(a).account();
  GM_setValue('string_theory.sync.auth', a.stSyncTokens);
  var previous = stSyncState();
  if (previous.account && previous.account !== account.id) {
    GM_deleteValue('string_theory.sync.base'); GM_deleteValue('string_theory.sync.stage');
  }
  stSyncState({ account: account.id, name: account.name, error: '', at: 0, next: 0, failures: 0 });
  stSyncAuthPending = null; stSyncSchedule(); stSyncPaint();
}
function stSyncDisconnect() {
  var old = stSyncState(), stage = GM_getValue('string_theory.sync.stage');
  if (stage) {
    ['before', 'after'].forEach(function (side) { delete stage[side].gm['string_theory.sync.auth']; delete stage[side].gm['string_theory.sync.settings']; });
    GM_setValue('string_theory.sync.stage', stage);
  }
  GM_deleteValue('string_theory.sync.auth'); GM_deleteValue('string_theory.sync.base');
  stSyncAuthPending = null;
  GM_setValue('string_theory.sync.settings', Object.assign(stSyncSettings(), { automatic: false }));
  GM_setValue('string_theory.sync.state', old.account ? { account: old.account } : {});
  stSyncSchedule(); stSyncPaint();
}
async function stSyncRun(manual) {
  if (stSyncBusy) return;
  async function run() {
    var state = stSyncState(), settings = stSyncSettings();
    if (!GM_getValue('string_theory.sync.auth', {}).refreshToken) return;
    if (!manual && (!settings.automatic || Date.now() < (state.next || 0))) return;
    stSyncBusy = true; stSyncPaint();
    try {
      var drive = stSyncDropbox(stSyncAuthorizer());
      for (var attempt = 0; attempt < 4; attempt++) {
        var remote = await drive.read(), local = stSyncStorage.effective();
        var base = GM_getValue('string_theory.sync.base');
        var conflicts = [], merged = remote.data ? stSyncStorage.merge(base, local, remote.data, settings.conflict, conflicts) : local;
        try {
          if (stSyncData.stable(merged) !== stSyncData.stable(remote.data)) await drive.write(merged, remote.rev);
        } catch (e) {
          if (e.response && e.response.status === 409 && /conflict/.test(e.cause && e.cause.error_summary || '') && attempt < 3) continue;
          throw e;
        }
        // A user may have changed settings during the request; keep those edits for the next run.
        var after = stSyncStorage.effective();
        var pending = stSyncStorage.merge(local, after, merged, 'local');
        if (stSyncData.stable(pending) !== stSyncData.stable(after)) stSyncStorage.stage(pending);
        GM_setValue('string_theory.sync.base', merged);
        stSyncState({ at: Date.now(), next: Date.now() + settings.minutes * 60e3, error: '', failures: 0, conflicts: conflicts.length });
        if (manual) stUI().mbuToast(stSyncStorage.pending() ? 'Synced. Reload to apply downloaded changes.' : 'Synced with Dropbox');
        return;
      }
    } catch (e) {
      var failures = (stSyncState().failures || 0) + 1;
      stSyncState({ error: stSyncError(e), failures: failures, next: Date.now() + Math.min(60, Math.pow(2, Math.min(6, failures))) * 60e3 });
      if (manual) stUI().mbuToast(stSyncError(e), { kind: 'error' });
    } finally { stSyncBusy = false; stSyncPaint(); }
  }
  // Web Locks serializes tabs on this origin. Revision-checked writes also protect other origins
  // and other devices, which cannot share that lock.
  if (navigator.locks) await navigator.locks.request('string-theory-dropbox', { ifAvailable: true }, function (lock) {
    if (lock) return run();
    if (manual) stUI().mbuToast('Another tab is syncing with Dropbox');
  });
  else {
    var lease = GM_getValue('string_theory.sync.lease', {}), owner = crypto.randomUUID();
    if (lease.until > Date.now()) { if (manual) stUI().mbuToast('Another tab is syncing with Dropbox'); return; }
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
  if (!ST_ON_MB || !stSyncSettings().automatic || !GM_getValue('string_theory.sync.auth', {}).refreshToken) return;
  stSyncTimer = setInterval(function () { stSyncRun(false).catch(function () {}); }, 60000);
  stSyncRun(false).catch(function () {});
}
function stSyncDownload(doc, name) {
  var url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
  var a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function stSyncMarkup() {
  return '<p class="st-cap">Settings, saved data and credentials travel between devices. Caches, logs, recent activity, temporary work and device layout stay here.</p>'
    + '<div class="st-row"><span class="st-lbl">Provider</span><span>Dropbox</span><button class="st-b" type="button" id="st-sync-connect">Connect Dropbox</button><button class="st-b" type="button" id="st-sync-disconnect" hidden>Disconnect</button></div>'
    + '<div class="st-row" id="st-sync-auth" hidden><label for="st-sync-code">Authorization code</label><input id="st-sync-code" type="password" autocomplete="off"><button class="st-b" type="button" id="st-sync-finish">Connect</button></div>'
    + '<div class="st-row"><label><input id="st-sync-auto" type="checkbox"> Automatic sync</label><label for="st-sync-minutes">Every</label><select id="st-sync-minutes"><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">1 day</option></select></div>'
    + '<div class="st-row"><label for="st-sync-conflict">Conflicting changes</label><select id="st-sync-conflict"><option value="remote">Use Dropbox’s value</option><option value="local">Use this device’s value</option></select></div>'
    + '<div class="st-row"><button class="st-b" type="button" id="st-sync-now">Sync now</button><button class="st-b" type="button" id="st-sync-reload" hidden>Reload</button><span id="st-sync-status" role="status"></span></div>'
    + '<h3 class="st-h">Backup</h3><div class="st-row"><button class="st-b" type="button" id="st-sync-export">Export</button><button class="st-b" type="button" id="st-sync-import">Import</button><input id="st-sync-file" type="file" accept=".json,application/json" hidden><button class="st-b" type="button" id="st-sync-recovery" hidden>Export recovery copy</button></div>'
    + '<p class="st-cap">Backups include credentials. Downloaded changes apply on the next page load. Automatic sync runs while MusicBrainz is open.</p>';
}
function stSyncPaint() {
  var panel = document.getElementById('st-p-s'); if (!panel) return;
  var q = function (id) { return panel.querySelector('#st-sync-' + id); };
  var auth = GM_getValue('string_theory.sync.auth', {}) || {}, state = stSyncState(), settings = stSyncSettings(), connected = !!auth.refreshToken;
  q('connect').textContent = connected ? 'Reconnect Dropbox' : 'Connect Dropbox';
  q('disconnect').hidden = !connected; q('auth').hidden = !stSyncAuthPending;
  q('auto').checked = settings.automatic; q('minutes').value = String(settings.minutes); q('conflict').value = settings.conflict;
  q('now').disabled = stSyncBusy || !connected; q('connect').disabled = stSyncBusy; q('disconnect').disabled = stSyncBusy;
  q('reload').hidden = !stSyncStorage.pending(); q('recovery').hidden = !GM_getValue('string_theory.sync.recovery');
  q('status').textContent = stSyncBusy ? 'Syncing…' : state.error || (state.at ? 'Last sync: ' + new Date(state.at).toLocaleString() : connected ? 'Connected' + (state.name ? ': ' + state.name : '') : 'Not connected');
}
function stSyncBind(panel) {
  var q = function (id) { return panel.querySelector('#st-sync-' + id); };
  var action = function (fn) { return function () { Promise.resolve().then(fn).catch(function (e) { stUI().mbuToast(stSyncError(e), { kind: 'error' }); }).finally(stSyncPaint); }; };
  q('connect').onclick = action(stSyncConnect);
  q('finish').onclick = action(async function () { q('finish').disabled = true; try { await stSyncFinish(q('code').value); q('code').value = ''; } finally { q('finish').disabled = false; } });
  q('disconnect').onclick = stSyncDisconnect;
  q('auto').onchange = function () { stSyncSaveSettings({ automatic: q('auto').checked }); };
  q('minutes').onchange = function () { stSyncSaveSettings({ minutes: +q('minutes').value }); };
  q('conflict').onchange = function () { stSyncSaveSettings({ conflict: q('conflict').value }); };
  q('now').onclick = action(function () { return stSyncRun(true); });
  q('reload').onclick = function () { location.reload(); };
  q('export').onclick = action(function () { stSyncDownload(stSyncStorage.document(stSyncStorage.effective()), 'string-theory-backup.json'); });
  q('recovery').onclick = action(function () { stSyncDownload(GM_getValue('string_theory.sync.recovery'), 'string-theory-recovery.json'); });
  q('import').onclick = function () { q('file').click(); };
  q('file').onchange = action(async function () {
    var file = q('file').files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    var incoming = stSyncStorage.read(await file.text());
    // An import is a merge with remote winning shared fields, so importing a partial backup
    // never deletes another script's data merely because it wasn't in that file.
    stSyncStorage.stage(stSyncStorage.merge(undefined, stSyncStorage.effective(), incoming, 'remote'));
    q('file').value = ''; stUI().mbuToast('Imported. Reload to apply the changes.');
  });
  stSyncPaint();
}
