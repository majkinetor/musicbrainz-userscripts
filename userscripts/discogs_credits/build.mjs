// Build the userscript.
//
// Commit 1 of the refactor: there is no source split yet, so the build is a
// straight pass-through of src/discogs_credits.user.js → dist/discogs_credits.user.js.
// (Commit 3 will swap this for a real esbuild bundle of multiple src/*.js modules.)
//
// Usage:  node build.mjs                  # one-shot prod build
//         node build.mjs --watch          # rebuild on every save of src/
//         node build.mjs --watch --serve  # also serve dist/ over HTTP for live dev install
//
// Dev-server mode (--serve):
//   - Serves dist/discogs_credits.user.js on http://127.0.0.1:8765/
//   - Rewrites @version / @updateURL / @downloadURL in the served copy so
//     Violentmonkey (or Tampermonkey) detects every rebuild as a new version
//     and re-downloads from localhost instead of GreasyFork.
//   - One-time install: paste http://127.0.0.1:8765/discogs_credits.user.js
//     into the userscript manager (VM: Dashboard → Installed → Install from URL;
//     TM: same idea via the dashboard). After that, set the script's
//     "Check for updates" to "On every page load" (VM) or interval=0 (TM)
//     so each MB page reload picks up the latest rebuild.

import { readFile, writeFile, mkdir, watch as fsWatch } from 'node:fs/promises';
import { dirname }                                       from 'node:path';
import { createServer }                                  from 'node:http';

const SRC  = 'src/discogs_credits.user.js';
const OUT  = 'dist/discogs_credits.user.js';
const HOST = '127.0.0.1';
const PORT = 8765;

const isWatch = process.argv.includes('--watch');
const isServe = process.argv.includes('--serve');

/**
 * Rewrite metadata-block fields so VM/TM auto-update the install from
 * localhost instead of from GreasyFork, and treats every rebuild as new.
 * @param {string} content - the source script
 */
function devifyMetadata(content) {
    const localUrl = `http://${HOST}:${PORT}/discogs_credits.user.js`;
    // Use Unix-seconds-since-epoch as a monotonically increasing 4th version
    // segment. Userscript managers compare via SemVer-ish dotted-numeric
    // ordering and accept >3 segments, so X.Y.Z.<ts> > X.Y.Z always.
    const ts = Math.floor(Date.now() / 1000);
    return content
        .replace(/^(\/\/\s*@version\s+)(\S+)/m,
                 (_m, lead, ver) => `${lead}${ver}.${ts}`)
        .replace(/^(\/\/\s*@updateURL\s+)\S.*$/m,
                 (_m, lead) => `${lead}${localUrl}`)
        .replace(/^(\/\/\s*@downloadURL\s+)\S.*$/m,
                 (_m, lead) => `${lead}${localUrl}`);
}

async function build() {
    const content = await readFile(SRC, 'utf8');
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, content);
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] built ${OUT} (${content.length.toLocaleString()} bytes)`);
}

function serve() {
    const server = createServer(async (req, res) => {
        // Single route — anything under / serves the script. Keeps the URL
        // path stable so the install link is always /discogs_credits.user.js.
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('GET only');
            return;
        }
        try {
            const raw = await readFile(OUT, 'utf8');
            const body = devifyMetadata(raw);
            res.writeHead(200, {
                'Content-Type':  'application/javascript; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma':        'no-cache',
            });
            res.end(body);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('build error: ' + e.message);
        }
    });
    server.listen(PORT, HOST, () => {
        const url = `http://${HOST}:${PORT}/discogs_credits.user.js`;
        console.log(`serving:  ${url}`);
        console.log('install:  paste that URL into VM/TM Dashboard → "Install from URL"');
        console.log('then set: "Check for updates" → "On every page load"\n');
    });
}

await build();

if (isServe) serve();

if (isWatch) {
    console.log(`watching ${SRC} for changes...`);
    for await (const _evt of fsWatch(SRC)) {
        try   { await build(); }
        catch (e) { console.error('build failed:', e.message); }
    }
}
