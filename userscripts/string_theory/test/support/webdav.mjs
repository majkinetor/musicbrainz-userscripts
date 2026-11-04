// A WebDAV folder at https://dav.example.test/files/me/ (Basic me:secret), enough for
// String Theory's sync: PROPFIND, MKCOL, GET, PUT and DELETE, with strong ETags.
export const DAV_ROOT = 'https://dav.example.test/files/me/';
export function davCloud() {
  const files = new Map(), dirs = new Set(['/files/me/']), calls = [];
  let serial = 0;
  const server = { files, dirs, calls, race: false };
  const reply = (status, text = '', headers = {}) => ({ status, text, headers: Object.entries(headers).map(([k, v]) => k + ': ' + v).join('\r\n') });
  const store = (path, text) => files.set(path, { text, etag: '"e' + ++serial + '"', modified: new Date(Date.now() + serial * 1000).toUTCString() });
  server.request = async opts => {
    const url = new URL(opts.url), method = opts.method || 'GET', path = decodeURIComponent(url.pathname);
    const h = Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    if (url.origin !== 'https://dav.example.test') throw Error('Wrong host');
    if (h.authorization !== 'Basic ' + Buffer.from('me:secret').toString('base64')) { calls.push({ method, path, status: 401 }); return reply(401, '', { 'www-authenticate': 'Basic realm="dav"' }); }
    const done = (status, ...rest) => { calls.push({ method, path, status }); return reply(status, ...rest); };
    const parent = path.replace(/[^/]+\/?$/, '');
    if (method === 'PROPFIND') {
      if (!dirs.has(path)) return done(404);
      const item = (href, f) => '<d:response><d:href>' + encodeURI(href) + '</d:href><d:propstat><d:prop>'
        + (f ? '<d:resourcetype/><d:getetag>' + f.etag + '</d:getetag><d:getcontentlength>' + Buffer.byteLength(f.text) + '</d:getcontentlength><d:getlastmodified>' + f.modified + '</d:getlastmodified>' : '<d:resourcetype><d:collection/></d:resourcetype>')
        + '</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
      let body = item(path);
      if (h.depth === '1') {
        for (const d of dirs) if (d !== path && d.startsWith(path) && !d.slice(path.length, -1).includes('/')) body += item(d);
        for (const [p, f] of files) if (p.startsWith(path) && !p.slice(path.length).includes('/')) body += item(p, f);
      }
      return done(207, '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">' + body + '</d:multistatus>', { 'content-type': 'application/xml; charset=utf-8' });
    }
    if (method === 'MKCOL') {
      if (dirs.has(path)) return done(405);
      if (!dirs.has(parent)) return done(409);
      dirs.add(path); return done(201);
    }
    const f = files.get(path);
    if (method === 'GET') return f ? done(200, f.text, { etag: f.etag, 'content-type': 'application/json' }) : done(404);
    if (method === 'PUT' || method === 'DELETE') {
      if (method === 'PUT' && server.race && f) { server.race = false; store(path, f.text); }
      const now = files.get(path);
      if (h['if-none-match'] === '*' && now) return done(412);
      if (h['if-match'] && (!now || (h['if-match'] !== '*' && h['if-match'] !== now.etag))) return done(412);
      if (method === 'DELETE') { if (!now) return done(404); files.delete(path); return done(204); }
      if (!dirs.has(parent)) return done(409);
      store(path, typeof opts.data === 'string' ? opts.data : new TextDecoder().decode(opts.data));
      return done(now ? 204 : 201, '', { etag: files.get(path).etag });
    }
    return done(405);
  };
  return server;
}
