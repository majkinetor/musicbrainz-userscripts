// Build the userscript.
//
// `src/meta.txt`  — the `// ==UserScript==` block, verbatim.
// `src/discogs_credits.user.js`  — entry module for esbuild (eventually one
// of many `src/*.js` modules; the multi-file split lands incrementally per
// issue #32).
//
// Output: meta.txt + esbuild IIFE bundle → `dist/discogs_credits.user.js`.
//
// Usage:  node build.mjs                  # one-shot prod build
//         node build.mjs --watch          # rebuild on every save under src/
//         node build.mjs --watch --serve  # also serve dist/ over HTTP for live dev install
//
// Dev-server mode (--serve):
//   - Serves the built script on http://127.0.0.1:8765/discogs_credits.user.js
//   - Rewrites @version / @updateURL / @downloadURL in the served `meta.txt`
//     so VM/TM detect every rebuild as a new version and re-download from
//     localhost instead of GreasyFork.
//   - One-time install: visit that URL in the browser; the manager intercepts.
//     TM — set "Check for updates" interval = 0 (every page load).
//     VM — bookmark the URL and click after each save (VM has no per-page-load
//     knob; see DEVELOP.md).

import { readFile, writeFile, mkdir, watch as fsWatch } from 'node:fs/promises';
import { createServer }                                  from 'node:http';
import { execSync }                                      from 'node:child_process';
import { build as esBuild, context as esContext }       from 'esbuild';

const META_SRC = 'src/meta.txt';
const ENTRY    = 'src/discogs_credits.user.js';
const OUT      = 'dist/discogs_credits.user.js';
const HOST     = '127.0.0.1';
const PORT     = 8765;

const isWatch = process.argv.includes('--watch');
const isServe = process.argv.includes('--serve');

/**
 * Current git branch, or `null` if detached / no git. Used to brand non-main
 * builds in the userscript manager — the maintainer ends up with several
 * installs (prod GreasyFork copy, plus dev installs from feature branches)
 * and needs to see at a glance which one is which.
 */
function currentBranch() {
    try {
        const b = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        return b === 'HEAD' ? null : b;  // detached → no marker
    } catch {
        return null;
    }
}

/**
 * Append the branch name to `@name` when not on `main`, so the userscript
 * shows up as e.g. `Import Discogs Credits (refactor)` in VM/TM dashboards.
 * Production builds (released from `main`) keep the bare name.
 */
function brandMeta(meta, branch) {
    if (!branch || branch === 'main') return meta;
    return meta.replace(/^(\/\/\s*@name\s+)(.+?)\s*$/m,
                        (_m, lead, name) => `${lead}${name} (${branch})`);
}

const esbuildOptions = {
    entryPoints: [ENTRY],
    bundle:      true,
    format:      'iife',
    target:      'es2020',
    platform:    'browser',
    write:       false,           // build returns bytes; we concat with meta.txt
    legalComments: 'inline',      // preserve inline comments (we wrote them; we want them)
    logLevel:    'silent',        // we print our own status line
};

/**
 * Run esbuild on the entry module, prepend the meta.txt header, write to OUT.
 * Returns the final bytes (for the dev server to optionally rewrite).
 */
async function build() {
    const [meta, result] = await Promise.all([
        readFile(META_SRC, 'utf8'),
        esBuild(esbuildOptions),
    ]);
    const branch = currentBranch();
    const bundle = result.outputFiles[0].text;
    const out = brandMeta(meta, branch).trimEnd() + '\n\n' + bundle;
    await mkdir('dist', { recursive: true });
    await writeFile(OUT, out);
    const ts = new Date().toLocaleTimeString();
    const tag = branch && branch !== 'main' ? ` [${branch}]` : '';
    console.log(`[${ts}] built ${OUT} (${out.length.toLocaleString()} bytes)${tag}`);
    return out;
}

/**
 * Rewrite metadata-block fields in `meta.txt` content so VM/TM auto-update
 * the install from localhost instead of from GreasyFork, and treat every
 * rebuild as new.
 */
function devifyMetadata(meta) {
    const localUrl = `http://${HOST}:${PORT}/discogs_credits.user.js`;
    // Date-style 4-segment version `YYYY.M.D.HHMMSS` matches the script's own
    // release scheme; monotonic within a day (HHMMSS) and across days (date).
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ver = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return meta
        .replace(/^(\/\/\s*@version\s+)\S+/m,
                 (_m, lead) => `${lead}${ver}`)
        .replace(/^(\/\/\s*@updateURL\s+)\S.*$/m,
                 (_m, lead) => `${lead}${localUrl}`)
        .replace(/^(\/\/\s*@downloadURL\s+)\S.*$/m,
                 (_m, lead) => `${lead}${localUrl}`);
}

function serve() {
    const server = createServer(async (req, res) => {
        const ts = new Date().toLocaleTimeString();
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('GET only');
            console.log(`[${ts}] ${req.method} ${req.url} → 405`);
            return;
        }
        try {
            // Read the built file and swap its metadata block on the fly.
            // (Re-reading is cheap; keeps the rewrite logic in one place.)
            const built = await readFile(OUT, 'utf8');
            const splitIdx = built.indexOf('// ==/UserScript==');
            const endIdx = built.indexOf('\n', splitIdx) + 1;
            const meta = built.slice(0, endIdx);
            const code = built.slice(endIdx);
            const body = devifyMetadata(meta) + code;
            res.writeHead(200, {
                'Content-Type':  'application/javascript; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma':        'no-cache',
            });
            res.end(body);
            console.log(`[${ts}] GET ${req.url} → ${body.length.toLocaleString()} bytes`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('build error: ' + e.message);
            console.log(`[${ts}] GET ${req.url} → 500 (${e.message})`);
        }
    });
    server.listen(PORT, HOST, () => {
        const url = `http://${HOST}:${PORT}/discogs_credits.user.js`;
        console.log(`serving:  ${url}`);
        console.log('install:  visit that URL in the browser (VM/TM intercept .user.js)');
        console.log('update:   TM — set "Check for updates" interval = 0 (every page load)');
        console.log('          VM — bookmark the URL and click it after each save');
        console.log('          (VM has no per-page-load knob; see DEVELOP.md).\n');
    });
}

await build();

if (isServe) serve();

if (isWatch) {
    // Use esbuild's own watcher — it tracks the module graph automatically as
    // more src/*.js modules land. On each rebuild we re-prepend meta.txt.
    const ctx = await esContext({
        ...esbuildOptions,
        plugins: [{
            name: 'rebuild-with-meta',
            setup(b) {
                b.onEnd(async (result) => {
                    if (result.errors.length) {
                        console.error('build failed:', result.errors[0].text);
                        return;
                    }
                    try {
                        const meta = await readFile(META_SRC, 'utf8');
                        const branch = currentBranch();
                        const bundle = result.outputFiles[0].text;
                        const out = brandMeta(meta, branch).trimEnd() + '\n\n' + bundle;
                        await mkdir('dist', { recursive: true });
                        await writeFile(OUT, out);
                        const ts = new Date().toLocaleTimeString();
                        const tag = branch && branch !== 'main' ? ` [${branch}]` : '';
                        console.log(`[${ts}] rebuilt ${OUT} (${out.length.toLocaleString()} bytes)${tag}`);
                    } catch (e) {
                        console.error('rebuild failed:', e.message);
                    }
                });
            },
        }],
    });
    await ctx.watch();
    console.log(`watching src/ for changes...`);
    // Also watch meta.txt — esbuild won't see it (not in the JS graph).
    (async () => {
        for await (const _evt of fsWatch(META_SRC)) {
            try   { await build(); }
            catch (e) { console.error('meta rebuild failed:', e.message); }
        }
    })();
}
