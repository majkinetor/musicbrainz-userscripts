// Serves control/ on http://localhost:<port> and keeps the last state each page reported.
// The emulator reaches it as its own localhost after `adb reverse tcp:<port> tcp:<port>`.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'control');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

export function serve(port = 8777) {
  const states = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/state' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      try { states.push({ ...JSON.parse(body), at: Date.now() }); } catch (e) {}
      if (states.length > 5000) states.splice(0, 1000);
      res.end('ok'); return;
    }
    // any page or frame can log a line here; it is printed with the time, for the background runs
    if (url.pathname === '/log' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      console.log(new Date().toISOString().slice(11, 19), body.slice(0, 500));
      res.setHeader('access-control-allow-origin', '*'); res.end('ok'); return;
    }
    if (url.pathname === '/state') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(states.at(-1) || null)); return; }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (file.includes('..')) { res.statusCode = 400; res.end(); return; }
    try {
      const data = await readFile(join(root, file));
      res.setHeader('content-type', types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream');
      res.setHeader('cache-control', 'no-store');   // a changed test script installs as the new one
      res.end(data);
    } catch (e) { res.statusCode = 404; res.end('not found'); }
  });
  return new Promise(ok => server.listen(port, () => ok({ server, states, last: () => states.at(-1) || null, close: () => server.close() })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8777);
  await serve(port);
  console.log(`control page on http://localhost:${port}/`);
}
