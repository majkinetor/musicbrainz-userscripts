// WebDAV (Nextcloud, ownCloud, Synology, Apache mod_dav, …): Basic auth to a folder the user names.
// Writes carry the read ETag (If-Match), a first write If-None-Match: *, so a concurrent writer is a 412.
var ST_WEBDAV_BACKUP = /^string-theory-[\w.-]+\.json$/;
var stWebdavEditing = false;
function stWebdavRoot(url) {
  var u;
  try { u = new URL(String(url || '').trim()); } catch (e) { throw new Error('Enter the WebDAV folder URL'); }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname))) throw new Error('WebDAV needs an https:// URL');
  if (u.username || u.password || u.search || u.hash) throw new Error('Enter the folder URL without a user name, query or fragment');
  if (!/\/$/.test(u.pathname)) u.pathname += '/';
  return u.href;
}
function stSyncWebdav(auth) {
  auth = auth || stSyncAuth('webdav');
  var root = stWebdavRoot(auth.url), folder = root + 'backups/', file = root + ST_SYNC_PATH.slice(1);
  var bytes = new TextEncoder().encode(String(auth.user || '') + ':' + String(auth.password || '')), bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  var basic = 'Basic ' + btoa(bin);
  async function request(url, options, ok) {
    options = options || {};
    var r = await stSyncFetch(url, Object.assign({}, options, { headers: Object.assign({ Authorization: basic }, options.headers || {}), webdav: root }));
    if ((ok || [200, 201, 204]).indexOf(r.status) < 0) throw Object.assign(new Error('WebDAV request failed'), { response: r, status: r.status, conflict: r.status === 412 });
    return r;
  }
  // If-Match compares strongly: a weak or missing ETag falls back to "the file still exists".
  function etag(r) { var t = r.headers.get('ETag') || ''; return /^"[^"]*"$/.test(t) ? t : ''; }
  async function text(r) {
    var body = await r.text();
    if (new Blob([body]).size > 10 * 1024 * 1024) throw new Error('WebDAV file exceeds 10 MB');
    return body;
  }
  function put(url, data, headers) {
    var body = JSON.stringify(stSyncStorage.document(data));
    if (new Blob([body]).size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    return request(url, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: body }).then(function (r) { return { r: r, size: new Blob([body]).size }; });
  }
  function propfind(url, depth) {
    return request(url, { method: 'PROPFIND', headers: { Depth: String(depth), 'Content-Type': 'application/xml; charset=utf-8' },
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>' }, [207]);
  }
  function entry(name, rev, size, modified) {
    if (typeof name !== 'string' || !ST_WEBDAV_BACKUP.test(name) || typeof rev !== 'string' || !Number.isFinite(size) || size < 0) throw new Error('Invalid WebDAV backup');
    return { provider: 'webdav', id: name, name: name, rev: rev, size: size, server_modified: modified };
  }
  async function mkcol(url) {
    // 405: the collection already exists.
    await request(url, { method: 'MKCOL' }, [200, 201, 204, 405]);
  }
  return {
    account: async function () {
      try { await propfind(root, 0); }
      catch (e) { if (e.status !== 404) throw e; await mkcol(root); }
      return { id: String(auth.user) + '@' + root, name: String(auth.user) + ' at ' + new URL(root).host };
    },
    read: async function () {
      var r = await request(file, { headers: { 'Cache-Control': 'no-cache' } }, [200, 404]);
      if (r.status === 404) return { rev: null, data: null };
      var info = {}, data = stSyncStorage.read(await text(r), info);
      return { rev: etag(r) || '*', data: data, filtered: info.filtered };
    },
    write: function (data, rev) { return put(file, data, rev ? { 'If-Match': rev } : { 'If-None-Match': '*' }); },
    backup: async function (data) {
      await mkcol(folder);
      var name = 'string-theory-' + new Date().toISOString().replace(/:/g, '-') + '-' + crypto.randomUUID() + '.json';
      var saved = await put(folder + name, data, { 'If-None-Match': '*' });
      return entry(name, etag(saved.r), saved.size, new Date().toISOString());
    },
    listBackups: async function () {
      var r;
      try { r = await propfind(folder, 1); } catch (e) { if (e.status === 404) return []; throw e; }
      var doc = new DOMParser().parseFromString(await text(r), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid WebDAV backup list');
      var dir = decodeURIComponent(new URL(folder).pathname), entries = [];
      Array.prototype.forEach.call(doc.getElementsByTagNameNS('DAV:', 'response'), function (res) {
        var one = function (tag) { var n = res.getElementsByTagNameNS('DAV:', tag)[0]; return n ? n.textContent.trim() : ''; };
        try {
          if (res.getElementsByTagNameNS('DAV:', 'collection').length) return;
          var path = decodeURIComponent(new URL(one('href'), folder).pathname);
          if (path.indexOf(dir) !== 0) return;
          var name = path.slice(dir.length);
          var modified = new Date(one('getlastmodified')), tag = one('getetag');
          entries.push(entry(name, /^"[^"]*"$/.test(tag) ? tag : '', Number(one('getcontentlength')), isNaN(modified.getTime()) ? '' : modified.toISOString()));
        } catch (e) { /* unrelated files and folders */ }
      });
      return entries.sort(function (a, b) { return String(b.server_modified).localeCompare(String(a.server_modified)) || b.name.localeCompare(a.name); });
    },
    readBackup: async function (selected) {
      entry(selected.name, selected.rev, selected.size, selected.server_modified);
      if (selected.size > 10 * 1024 * 1024) throw new Error('WebDAV backup exceeds 10 MB');
      var r;
      try { r = await request(folder + encodeURIComponent(selected.name), { headers: selected.rev ? { 'If-Match': selected.rev } : {} }); }
      catch (e) { if (e.status === 404 || e.status === 412) throw new Error('Backup changed or is unavailable. Refresh the list.'); throw e; }
      var info = {}, data = stSyncStorage.read(await text(r), info);
      return { rev: selected.rev, data: data, filtered: info.filtered };
    },
    deleteBackup: async function (selected) {
      entry(selected.name, selected.rev, selected.size, selected.server_modified);
      try { await request(folder + encodeURIComponent(selected.name), { method: 'DELETE', headers: selected.rev ? { 'If-Match': selected.rev } : {} }); }
      catch (e) { if (e.status === 404 || e.status === 412) throw new Error('Backup changed or is unavailable. Refresh the list.'); throw e; }
    },
  };
}
async function stSyncConnectWebdav(url, user, password) {
  if (stSyncBusy) return;
  var auth = { url: stWebdavRoot(url), user: String(user || '').trim(), password: String(password || '') };
  if (!auth.user || !auth.password) throw new Error('Enter the WebDAV user name and password');
  stSyncBusy = true; stSyncActivity = 'sync'; stSyncPaint();
  try {
    // Keep the old credentials until the new ones have answered.
    var account = await stSyncWebdav(auth).account();
    stSyncKeepNewAuth('webdav');
    GM_setValue(stSyncKey('auth', 'webdav'), auth);
    var previous = stSyncState(null, 'webdav');
    if (previous.account && previous.account !== account.id) {
      GM_deleteValue(stSyncKey('base', 'webdav')); GM_deleteValue('string_theory.sync.stage');
    }
    stSyncState({ account: account.id, name: account.name, error: '', notice: '', at: 0, next: 0, failures: 0 }, 'webdav');
    stWebdavEditing = false;
  } finally { stSyncBusy = false; stSyncActivity = ''; }
  stSyncSchedule(); stSyncPaint();
  stUI().mbuToast('Connected to WebDAV');
}
