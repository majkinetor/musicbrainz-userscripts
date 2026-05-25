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
// `@version` is auto-stamped on every build (`YYYY.M.D.HHMMSS`). VM/TM
// detect each rebuild as a new version → users on the GreasyFork copy
// auto-update on every merge to main without anyone manually bumping
// `meta.txt`. The version stamp lives only in `dist/`; `meta.txt`'s
// `@version` is the placeholder that gets overwritten.
//
// Dev-server mode (--serve):
//   - Serves the built script on http://127.0.0.1:8765/discogs_credits.user.js
//   - Brands the served `@name` with the current branch (e.g. "Import Discogs
//     Credits (refactor)") and rewrites `@updateURL` / `@downloadURL` to
//     localhost — VM/TM detect every rebuild as a new version and re-download
//     from the local server instead of GreasyFork.
//   - The on-disk `dist/` is always clean (no branch suffix) so committing it
//     doesn't leak a branch name into `main` — the brand is purely a
//     served-time decoration so the maintainer can tell branch dev installs
//     from the production GreasyFork install in their VM/TM dashboard.
//   - One-time install: visit the URL in the browser; the manager intercepts.
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
 * Current git branch, or `null` if detached / no git. Used in `--serve`
 * mode to brand the served `@name` with the branch — the maintainer ends
 * up with several installs (prod GreasyFork copy + dev installs from
 * feature branches) and needs to see at a glance which is which.
 * NOT applied to the on-disk `dist/` (would leak into `main` post-merge).
 */
function currentBranch() {
    try {
        const b = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        return b === 'HEAD' ? null : b;  // detached → no marker
    } catch {
        return null;
    }
}

/** `YYYY.M.D.HHMMSS` — monotonic, parses as a date for humans. */
function timestampVersion() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Replace `@version` in the meta block with the current build timestamp. */
function stampVersion(meta) {
    const ver = timestampVersion();
    return meta.replace(/^(\/\/\s*@version\s+)\S+/m, (_m, lead) => `${lead}${ver}`);
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
 * Run esbuild on the entry module, prepend the meta.txt header (with a
 * fresh `@version` stamp), write to OUT. Returns the final bytes.
 */
async function build() {
    const [meta, result] = await Promise.all([
        readFile(META_SRC, 'utf8'),
        esBuild(esbuildOptions),
    ]);
    const bundle = result.outputFiles[0].text;
    const out = stampVersion(meta).trimEnd() + '\n\n' + bundle;
    await mkdir('dist', { recursive: true });
    await writeFile(OUT, out);
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] built ${OUT} (${out.length.toLocaleString()} bytes)`);
    return out;
}

/**
 * Decorate the meta block for the dev server: brand `@name` with the
 * current branch (so VM/TM dashboards distinguish branch installs from
 * the GreasyFork prod install), and point `@updateURL` / `@downloadURL`
 * at the local server so the manager pulls the live rebuild.
 * `@version` is already stamped at build time, no need to redo it here.
 */
function devifyMetadata(meta) {
    const localUrl = `http://${HOST}:${PORT}/discogs_credits.user.js`;
    const branch = currentBranch();
    let out = meta;
    if (branch && branch !== 'main') {
        out = out.replace(/^(\/\/\s*@name\s+)(.+?)\s*$/m,
                          (_m, lead, name) => `${lead}${name} (${branch})`);
    }
    return out
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
            // Read the built file and decorate its metadata block on the fly
            // (brand + localhost URLs). Re-reading is cheap; keeps the
            // rewrite logic in one place.
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
                        const bundle = result.outputFiles[0].text;
                        const out = stampVersion(meta).trimEnd() + '\n\n' + bundle;
                        await mkdir('dist', { recursive: true });
                        await writeFile(OUT, out);
                        const ts = new Date().toLocaleTimeString();
                        console.log(`[${ts}] rebuilt ${OUT} (${out.length.toLocaleString()} bytes)`);
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
