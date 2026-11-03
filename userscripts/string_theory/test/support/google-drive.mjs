export function googleCloud() {
  const files = new Map(), uploads = new Map(), calls = [];
  let serial = 0;
  const reply = (data, status = 200, headers = 'content-type: application/json') => ({ status, text: typeof data === 'string' ? data : JSON.stringify(data), headers });
  const server = { files, calls, denied: false, pageSize: 2 };
  server.request = async opts => {
    const url = new URL(opts.url), method = opts.method || 'GET';
    if (url.hostname !== 'www.googleapis.com') throw Error('Wrong provider');
    if (opts.headers.authorization !== 'Bearer google-token') throw Error('Wrong token');
    calls.push({ path: url.pathname, method, query: url.searchParams.toString() });
    if (server.denied) return reply({ error: { message: 'denied' } }, 403);
    const text = typeof opts.data === 'string' ? opts.data : opts.data ? new TextDecoder().decode(opts.data) : '';
    if (url.pathname.endsWith('/about')) return reply({ user: { permissionId: 'google-account', displayName: 'Google fixture' } });
    if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const id = 'file' + ++serial; uploads.set(id, JSON.parse(text));
      return reply('', 200, 'location: https://www.googleapis.com/upload/drive/v3/files?upload_id=' + id);
    }
    if (url.pathname === '/upload/drive/v3/files' && method === 'PUT') {
      const id = url.searchParams.get('upload_id'), meta = uploads.get(id);
      if (!meta) return reply({}, 404);
      const file = { ...meta, id, headRevisionId: 'revision1', version: '1', size: String(new Blob([text]).size), modifiedTime: new Date(Date.now() + serial * 1000).toISOString(), revisions: new Map([['revision1', text]]) };
      files.set(id, file); uploads.delete(id); return reply(file);
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const id = 'folder' + ++serial, file = { ...JSON.parse(text), id, createdTime: new Date().toISOString() };
      files.set(id, file); return reply(file);
    }
    if (url.pathname === '/drive/v3/files') {
      const kind = /key='stKind' and value='(\w+)'/.exec(url.searchParams.get('q'))?.[1];
      const all = [...files.values()].filter(f => !f.trashed && f.appProperties.stKind === kind);
      const offset = Number(url.searchParams.get('pageToken') || 0), end = offset + server.pageSize;
      return reply({ files: all.slice(offset, end), nextPageToken: end < all.length ? String(end) : undefined });
    }
    const match = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)(?:\/revisions\/([^/]+))?$/), file = match && files.get(match[1]);
    if (!file || file.trashed) return reply({}, 404);
    if (match[2]) return file.revisions.has(match[2]) ? reply(file.revisions.get(match[2])) : reply({}, 404);
    if (method === 'PATCH') { Object.assign(file, JSON.parse(text)); return reply({ id: file.id }); }
    return reply(file);
  };
  return server;
}
