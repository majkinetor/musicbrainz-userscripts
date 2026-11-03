// Google Identity Services owns the popup flow; no client secret or refresh token ships.
var ST_GOOGLE_KEY = '762250056217-8uip1j2fusc9npm4fievee31btjqf02o.apps.googleusercontent.com';
var ST_GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
var stGoogleLoading = null, stGoogleReady = false, stGoogleError = '';
function stGoogleApi() {
  var page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  return page.google && page.google.accounts && page.google.accounts.oauth2;
}
function stGooglePageObject(value) {
  return typeof cloneInto === 'function' && typeof unsafeWindow !== 'undefined' ? cloneInto(value, unsafeWindow, { cloneFunctions: true }) : value;
}
function stGoogleLoad() {
  if (stGoogleApi()) { stGoogleReady = true; return Promise.resolve(); }
  if (stGoogleLoading) return stGoogleLoading;
  stGoogleError = '';
  stGoogleLoading = new Promise(function (resolve, reject) {
    var script = document.createElement('script'), timer;
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    function finish(error) {
      clearTimeout(timer); script.onload = script.onerror = null;
      if (error) { script.remove(); stGoogleError = 'Google sign-in could not load. Try again.'; reject(new Error(stGoogleError)); }
      else { stGoogleReady = true; resolve(); }
    }
    script.onload = function () { finish(!stGoogleApi()); };
    script.onerror = function () { finish(true); };
    timer = setTimeout(function () { finish(true); }, 30000);
    (document.head || document.documentElement).appendChild(script);
  }).finally(function () { stGoogleLoading = null; stSyncPaint(); });
  return stGoogleLoading;
}
function stGoogleConnect() {
  // Called synchronously by the Connect button, after GIS has loaded, to retain user activation.
  if (stSyncBusy) return;
  if (!stGoogleReady || !stGoogleApi()) return stGoogleLoad();
  var api = stGoogleApi(), pending = crypto.randomUUID(), client;
  GM_setValue('string_theory.sync.google.oauth', pending);
  stSyncBusy = true; stSyncPaint();
  function finish(error) {
    if (GM_getValue('string_theory.sync.google.oauth') === pending) GM_deleteValue('string_theory.sync.google.oauth');
    stSyncBusy = false;
    if (error) stUI().mbuToast(error.message || 'Google Drive authorization failed', { kind: 'error' });
    stSyncSchedule(); stSyncPaint();
  }
  try {
    client = api.initTokenClient(stGooglePageObject({ client_id: ST_GOOGLE_KEY, scope: ST_GOOGLE_SCOPE, include_granted_scopes: false,
      callback: function (result) {
        Promise.resolve().then(async function () {
          if (GM_getValue('string_theory.sync.google.oauth') !== pending) throw new Error('A newer Google Drive connection was started');
          if (!result || result.error || !/^Bearer$/i.test(result.token_type || '') || !result.access_token || !Number.isFinite(Number(result.expires_in)) || Number(result.expires_in) <= 0
            || !api.hasGrantedAllScopes(result, ST_GOOGLE_SCOPE)) throw new Error('Google Drive permission was not granted');
          var auth = { accessToken: { token: result.access_token, expiresAt: Date.now() + Math.min(86400, Number(result.expires_in)) * 1000 } };
          var account = await stSyncGoogle(auth).account();
          if (GM_getValue('string_theory.sync.google.oauth') !== pending) throw new Error('A newer Google Drive connection was started');
          if (stSyncState(null, 'google').account && stSyncState(null, 'google').account !== account.id) GM_deleteValue(stSyncKey('base', 'google'));
          stSyncKeepNewAuth('google');
          GM_setValue(stSyncKey('auth', 'google'), auth);
          stSyncState({ account: account.id, name: account.name, error: '', notice: '', at: 0, next: 0, failures: 0 }, 'google');
          stUI().mbuToast('Connected to Google Drive');
        }).then(function () { finish(); }, function (e) { finish(new Error(stSyncError(e, 'google'))); });
      },
      error_callback: function () { finish(new Error('Google sign-in was closed or blocked. Connect again.')); },
    }));
    client.requestAccessToken(stGooglePageObject({ prompt: '' }));
  } catch (e) { finish(new Error('Google sign-in could not start. Connect again.')); }
}
function stSyncGoogle(auth) {
  auth = auth || stSyncAuth('google');
  var authorizer = new stSyncProviders.GoogleAuthorizer({ clientId: ST_GOOGLE_KEY }, auth);
  authorizer.refreshToken = async function () { throw new Error('Google Drive session expired. Reconnect Google Drive.'); };
  var drive = new stSyncProviders.GoogleDrive({ authProvider: 'google', user: '' }, { authorizer: authorizer, fetch: stSyncFetch });
  var API = 'https://www.googleapis.com/drive/v3/', fields = 'id,name,mimeType,size,version,headRevisionId,modifiedTime,createdTime,appProperties,description,parents,trashed';
  function request(path, options) { return drive.request(path.indexOf('https:') === 0 ? path : API + path, Object.assign({ responseType: 'json' }, options)); }
  function ours(file, kind) { return file && !file.trashed && file.appProperties && file.appProperties.stSuite === 'string-theory' && file.appProperties.stKind === kind; }
  async function list(kind) {
    var items = [], token = '', seen = Object.create(null);
    do {
      var query = new URLSearchParams({ q: "trashed = false and appProperties has { key='stSuite' and value='string-theory' } and appProperties has { key='stKind' and value='" + kind + "' }", spaces: 'drive', pageSize: '1000', fields: 'nextPageToken,files(' + fields + ')' });
      if (token) query.set('pageToken', token);
      var page = await request('files?' + query);
      if (!page || !Array.isArray(page.files)) throw new Error('Invalid Google Drive file list');
      page.files.forEach(function (f) { if (ours(f, kind)) items.push(f); });
      token = page.nextPageToken || '';
      if (token && seen[token]) throw new Error('Invalid Google Drive page token');
      seen[token] = true;
    } while (token);
    return items;
  }
  async function folder() {
    var folders = await list('folder');
    folders.sort(function (a, b) { return String(a.createdTime).localeCompare(String(b.createdTime)) || a.id.localeCompare(b.id); });
    if (folders.length) return folders[0].id;
    return (await request('files?fields=id', { method: 'POST', json: { name: 'String Theory', mimeType: 'application/vnd.google-apps.folder', appProperties: { stSuite: 'string-theory', stKind: 'folder' } } })).id;
  }
  function entry(file) {
    if (!ours(file, 'backup') || file.mimeType !== 'application/json' || !file.id || !file.headRevisionId || !Number.isFinite(Number(file.size))) throw new Error('Invalid Google Drive backup');
    return { provider: 'google', id: file.id, name: file.name, rev: file.headRevisionId, version: file.version, size: Number(file.size), server_modified: file.modifiedTime };
  }
  async function readFile(file) {
    if (!file || file.mimeType !== 'application/json' || !file.id || !file.headRevisionId || !Number.isFinite(Number(file.size)) || Number(file.size) > 10 * 1024 * 1024) throw new Error('Invalid or oversized Google Drive snapshot');
    var blob = await request('files/' + encodeURIComponent(file.id) + '/revisions/' + encodeURIComponent(file.headRevisionId) + '?alt=media', { responseType: 'blob' });
    var info = {}, data = stSyncStorage.read(await blob.text(), info);
    return { data: data, filtered: info.filtered };
  }
  async function create(data, kind, parents) {
    var text = JSON.stringify(stSyncStorage.document(data)), body = new Blob([text], { type: 'application/json' });
    if (body.size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    var meta = { name: 'string-theory-' + kind + '-' + new Date().toISOString().replace(/:/g, '-') + '-' + crypto.randomUUID() + '.json', mimeType: 'application/json',
      parents: [await folder()], appProperties: { stSuite: 'string-theory', stKind: kind }, description: JSON.stringify({ parents: parents || [] }) };
    // Resumable upload also covers snapshots between 5 and 10 MB. Only Google receives the token.
    var response = await stSyncFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=' + encodeURIComponent(fields), {
      method: 'POST', headers: { Authorization: 'Bearer ' + authorizer.getAccessToken(), 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'application/json' }, body: JSON.stringify(meta),
    });
    if (!response.ok) throw Object.assign(new Error('Google Drive upload failed'), { response: response });
    var destination = new URL(response.headers.get('Location'));
    if (destination.origin !== 'https://www.googleapis.com' || destination.pathname.indexOf('/upload/drive/v3/files') !== 0) throw new Error('Unexpected Google Drive upload destination');
    return request(destination.href, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body });
  }
  return {
    account: async function () {
      // Drive's own about endpoint needs no extra email/profile scope.
      var user = (await request('about?fields=user')).user;
      if (!user || !user.permissionId) throw new Error('Google Drive returned no account');
      return { id: user.permissionId, name: user.displayName || '' };
    },
    read: async function () {
      // Immutable revisions form a DAG. Concurrent writers add separate heads; neither can
      // overwrite the other. Read and merge their nearest shared ancestor on the next sync.
      var files = await list('sync'), byId = Object.create(null), ancestors = Object.create(null), used = new Set(), documents = Object.create(null), filtered = false;
      files.forEach(function (file) {
        if (byId[file.id]) throw new Error('Duplicate Google Drive revision');
        var parents;
        try { parents = JSON.parse(file.description).parents; } catch (e) { throw new Error('Invalid Google Drive sync history'); }
        if (!Array.isArray(parents) || parents.some(function (id) { return typeof id !== 'string' || !/^[\w-]{1,200}$/.test(id) || id === file.id; })) throw new Error('Invalid Google Drive sync history');
        byId[file.id] = { file: file, parents: parents }; parents.forEach(function (id) { used.add(id); });
      });
      used.forEach(function (id) { if (!byId[id]) throw new Error('Google Drive sync history is incomplete. Restore its trashed sync files.'); });
      var degree = Object.create(null), children = Object.create(null), roots = [];
      files.forEach(function (f) {
        degree[f.id] = byId[f.id].parents.length;
        if (!degree[f.id]) roots.push(f.id);
        byId[f.id].parents.forEach(function (id) { (children[id] || (children[id] = [])).push(f.id); });
      });
      for (var r = 0; r < roots.length; r++) (children[roots[r]] || []).forEach(function (id) { if (!--degree[id]) roots.push(id); });
      if (roots.length !== files.length) throw new Error('Invalid Google Drive sync history');
      var heads = files.filter(function (f) { return !used.has(f.id); }).sort(function (a, b) { return String(a.modifiedTime).localeCompare(String(b.modifiedTime)) || a.id.localeCompare(b.id); });
      if (!heads.length) { if (files.length) throw new Error('Invalid Google Drive sync history'); return { rev: null, data: null }; }
      function depths(id) {
        var out = Object.create(null), queue = [[id, 0]];
        for (var i = 0; i < queue.length; i++) {
          var item = queue[i]; if (out[item[0]] !== undefined) continue;
          out[item[0]] = item[1]; byId[item[0]].parents.forEach(function (p) { queue.push([p, item[1] + 1]); });
        }
        return out;
      }
      async function document(file) {
        if (!documents[file.id]) documents[file.id] = readFile(file);
        var doc = await documents[file.id]; filtered = filtered || doc.filtered; return doc.data;
      }
      async function combine(selected) {
        if (selected.length === 1) return document(selected[0]);
        selected.forEach(function (f) { if (!ancestors[f.id]) ancestors[f.id] = depths(f.id); });
        var common = files.filter(function (f) { return selected.every(function (h) { return ancestors[h.id][f.id] !== undefined; }); }), commonParents = new Set();
        common.forEach(function (f) { byId[f.id].parents.forEach(function (id) { commonParents.add(id); }); });
        // Criss-cross merges can have multiple maximal common ancestors. Merge those too,
        // rather than choosing one and treating the other's saved items as new additions.
        var frontier = common.filter(function (f) { return !commonParents.has(f.id); }).sort(order);
        var base = frontier.length ? await combine(frontier) : undefined, merged;
        for (var i = 0; i < selected.length; i++) {
          var data = await document(selected[i]);
          merged = i ? stSyncStorage.merge(base, merged, data, 'remote') : data;
        }
        return merged;
      }
      function order(a, b) { return String(a.modifiedTime).localeCompare(String(b.modifiedTime)) || a.id.localeCompare(b.id); }
      var merged = await combine(heads);
      return { rev: heads.map(function (f) { return f.id; }), data: merged, filtered: filtered || heads.length > 1 };
    },
    write: function (data, rev) { return create(data, 'sync', rev || []); },
    backup: async function (data) { return entry(await create(data, 'backup')); },
    listBackups: async function () { return (await list('backup')).map(entry).sort(function (a, b) { return b.server_modified.localeCompare(a.server_modified) || b.id.localeCompare(a.id); }); },
    readBackup: async function (selected) {
      var file = await request('files/' + encodeURIComponent(selected.id) + '?fields=' + fields);
      entry(file);
      // Read the selected immutable content revision even if a user edited it in Drive meanwhile.
      return readFile(Object.assign({}, file, { headRevisionId: selected.rev, size: selected.size }));
    },
    deleteBackup: async function (selected) {
      var file = await request('files/' + encodeURIComponent(selected.id) + '?fields=' + fields);
      entry(file);
      if (file.version !== selected.version || file.headRevisionId !== selected.rev) throw new Error('Backup changed. Refresh the list.');
      // Drive deletion is recoverable. Never permanently delete a file or touch sync revisions.
      return request('files/' + encodeURIComponent(file.id) + '?fields=id', { method: 'PATCH', json: { trashed: true } });
    },
  };
}
