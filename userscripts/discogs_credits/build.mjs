// Build the userscript.
//
// Commit 1 of the refactor: there is no source split yet, so the build is a
// straight pass-through of src/discogs_credits.user.js → dist/discogs_credits.user.js.
// (Commit 3 will swap this for a real esbuild bundle of multiple src/*.js modules.)
//
// Usage:  node build.mjs            # one-shot build
//         node build.mjs --watch    # rebuild on every save of src/

import { readFile, writeFile, mkdir, watch as fsWatch } from 'node:fs/promises';
import { dirname }                                       from 'node:path';

const SRC = 'src/discogs_credits.user.js';
const OUT = 'dist/discogs_credits.user.js';

async function build() {
    const content = await readFile(SRC, 'utf8');
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, content);
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] built ${OUT} (${content.length.toLocaleString()} bytes)`);
}

await build();

if (process.argv.includes('--watch')) {
    console.log(`watching ${SRC} for changes...`);
    for await (const _evt of fsWatch(SRC)) {
        try   { await build(); }
        catch (e) { console.error('build failed:', e.message); }
    }
}
