// Drive the platform_check userscript against an MB release fixture and
// capture its sidebar diagnostic log so we can troubleshoot the web scraping.
//
// Usage:
//   node test/run.mjs                # headless
//   node test/run.mjs --headed       # show browser
//   node test/run.mjs --mbid=<uuid>  # override fixture release

import { chromium }                  from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath }             from 'node:url';
import { dirname, resolve }          from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const LOG_ROOT    = resolve(HERE, 'logs');

// CLI args
const args = process.argv.slice(2);
const headed = args.includes('--headed');
const arg = name => { const a = args.find(x => x.startsWith(`${name}=`)); return a ? a.slice(name.length + 1) : null; };

// US digital release of "The Exciting Sounds of Menahan Street Band" — already
// has a Discogs URL in its url-rels (https://www.discogs.com/release/17601142)
// and no Spotify/Bandcamp links, which exercises both "use existing" and
// "search & scrape" paths.
const DEFAULT_MBID = 'aa6c4473-3528-41c2-b55b-d9e18bdba4ff';
const mbid = arg('--mbid') || DEFAULT_MBID;

const runStamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const RUN_DIR  = resolve(LOG_ROOT, runStamp);
await mkdir(RUN_DIR, { recursive: true });

const c = {
    grey:  s => `\x1b[90m${s}\x1b[0m`,
    red:   s => `\x1b[31m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
    amber: s => `\x1b[33m${s}\x1b[0m`,
    bold:  s => `\x1b[1m${s}\x1b[0m`,
};
function ts() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(...a) { console.log(c.grey(`[${ts()}]`), ...a); }

// ──── browser ─────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
const page = await context.newPage();

// Capture console + pageerror to a buffer.
const captured = { console: [], pageErrors: [], gmCalls: [] };
page.on('console', msg => captured.console.push({ ts: ts(), type: msg.type(), text: msg.text() }));
page.on('pageerror', err => captured.pageErrors.push({ ts: ts(), name: err.name, text: err.message }));

// ──── GM_xmlhttpRequest shim (Node-side fetch via exposeBinding) ───────────
// The userscript fires GM_xmlhttpRequest for cross-origin reads (Spotify,
// Discogs, Bandcamp). Tampermonkey would normally allow that via @connect *,
// but a plain page.addScriptTag injection has no such bridge and runs into
// CORS / cross-origin same-origin-policy. We expose a Node binding the shim
// can call to do the fetch outside the page sandbox.
await page.exposeBinding('__gmFetch', async (_source, opts) => {
    const t0 = Date.now();
    const entry = { ts: ts(), method: opts.method || 'GET', url: opts.url, status: null, ms: null, error: null };
    captured.gmCalls.push(entry);
    try {
        const resp = await fetch(opts.url, {
            method:  opts.method || 'GET',
            headers: opts.headers || {},
            redirect: 'follow',
        });
        const body = await resp.text();
        entry.status = resp.status;
        entry.ms = Date.now() - t0;
        return {
            ok:           resp.ok,
            status:       resp.status,
            statusText:   resp.statusText,
            finalUrl:     resp.url,
            responseText: body,
            headers:      Object.fromEntries([...resp.headers.entries()]),
        };
    } catch (e) {
        entry.error = String(e?.message || e);
        entry.ms = Date.now() - t0;
        return { ok: false, status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, headers: {}, _networkError: true, _error: entry.error };
    }
});

// ──── navigate to MB release page ─────────────────────────────────────────
const releaseUrl = `https://musicbrainz.org/release/${mbid}`;
log(c.bold(`Opening ${releaseUrl}`));
await page.goto(releaseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#sidebar', { timeout: 30_000 });

// ──── inject GM_* shim, then the userscript ───────────────────────────────
// The shim translates GM_xmlhttpRequest({method,url,headers,onload,onerror})
// into a Promise that calls back into Node via window.__gmFetch. GM_setValue /
// GM_getValue persist to an in-memory map (the script only uses them for
// provider toggles, which we leave at defaults = all enabled).
// Optional cache pre-seed — `--cache=spotify=<url>,bandcamp=<url>,…` lets the
// userscript skip web-search calls when search engines are rate-limiting us.
// Used to verify the metadata-fetch + UI-render path independently from the
// flaky search-engine path.
const cacheArg = arg('--cache');
const seedPairs = {};
if (cacheArg) {
    for (const p of cacheArg.split(',')) {
        const [k, v] = p.split('=');
        if (k && v) seedPairs[`urlcache:${k}:${mbid}`] = v;
    }
    log(c.amber(`  seeding GM_setValue cache: ${Object.keys(seedPairs).join(', ')}`));
}
const seedJson = JSON.stringify(seedPairs);

const shim = `
    (() => {
        const store = new Map(Object.entries(${seedJson}));
        window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
        window.GM_setValue = (k, v) => { store.set(k, v); };
        window.GM_xmlhttpRequest = function(opts) {
            window.__gmFetch({
                method: opts.method || 'GET',
                url: opts.url,
                headers: opts.headers || {},
            }).then(res => {
                // Real Tampermonkey: onload fires for ANY HTTP response (incl. 4xx/5xx);
                // onerror only fires on connection failure. Mirror that here so the
                // userscript sees real status codes instead of opaque "error".
                if (res._networkError) {
                    try { opts.onerror && opts.onerror(res); } catch (e) { console.error('GM onerror threw:', e); }
                } else {
                    try { opts.onload && opts.onload(res); } catch (e) { console.error('GM onload threw:', e); }
                }
            }).catch(e => {
                console.error('GM fetch rejected:', e);
                try { opts.onerror && opts.onerror({ status: 0, statusText: String(e), responseText: '' }); } catch (_) {}
            });
        };
        // Also expose unsafeWindow / GM_info for parity with Tampermonkey.
        window.unsafeWindow = window;
        window.GM_info = { script: { name: 'platform_check (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };
    })();
`;
await page.addScriptTag({ content: shim });

const userJs = await readFile(SCRIPT_PATH, 'utf8');
await page.addScriptTag({ content: userJs });

// ──── wait for the script to populate its panel ───────────────────────────
// The script kicks off three async GM_xmlhttpRequest scans. Each scan calls
// updateLink() at the end, which writes the per-platform icon/value text. We
// wait until all three platforms have settled (icon is no longer the initial
// "⚪") or a generous timeout elapses.
log(c.grey('  waiting for all three platform scans to settle…'));

const settled = await page.waitForFunction(() => {
    const icons = ['spotify', 'discogs', 'bandcamp'].map(p => document.getElementById(`ico-${p}`)?.textContent?.trim());
    return icons.every(t => t && t !== '⚪');
}, null, { timeout: 90_000 }).then(() => true).catch(() => false);

if (!settled) {
    log(c.amber('  ! some platforms did not settle within 90s — capturing partial state'));
}

// ──── snapshot results ────────────────────────────────────────────────────
const results = await page.evaluate(() => {
    function read(p) {
        const a   = document.getElementById(`mb-online-${p}`);
        const ico = document.getElementById(`ico-${p}`);
        const val = document.getElementById(`val-${p}`);
        return {
            url:    a?.href || null,
            icon:   ico?.textContent?.trim() || null,
            value:  val?.textContent?.trim() || null,
        };
    }
    return {
        spotify:  read('spotify'),
        discogs:  read('discogs'),
        bandcamp: read('bandcamp'),
        diagnosticLogHtml: document.getElementById('mb-finder-log-panel')?.innerHTML || '',
        diagnosticLogText: document.getElementById('mb-finder-log-panel')?.innerText || '',
    };
});

// ──── print + save ────────────────────────────────────────────────────────
function fmt(p, r) {
    const ok = r.icon === '✓';
    const colour = ok ? c.green : (r.icon === '~' ? c.amber : c.red);
    return `  ${colour(p.padEnd(10) + (r.icon || '?'))}  ${r.value || '(no info)'}  →  ${r.url || '(no url)'}`;
}
console.log();
console.log(c.bold('Results:'));
console.log(fmt('spotify',  results.spotify));
console.log(fmt('discogs',  results.discogs));
console.log(fmt('bandcamp', results.bandcamp));

const EXPECT = {
    spotify:  '41aeU2fQpLCNn3n1AVqCIF',
    bandcamp: 'menahanstreetband.bandcamp.com/album/the-exciting-sounds-of-menahan-street-band',
    discogs:  '17601142',
};
console.log();
console.log(c.bold('Expected:'));
console.log(`  spotify    ${EXPECT.spotify}     ${results.spotify.url?.includes(EXPECT.spotify)   ? c.green('FOUND')  : c.red('MISS')}`);
console.log(`  bandcamp   ${EXPECT.bandcamp}    ${results.bandcamp.url?.includes(EXPECT.bandcamp) ? c.green('FOUND')  : c.red('MISS')}`);
console.log(`  discogs    /release/${EXPECT.discogs}                                      ${results.discogs.url?.includes(EXPECT.discogs) ? c.green('FOUND')  : c.red('MISS')}`);

// Persist run artefacts.
const screenshotPath = resolve(RUN_DIR, 'page.png');
await page.screenshot({ path: screenshotPath, fullPage: true });

const summary = [
    `# Platform check test run ${runStamp}`,
    ``,
    `**MB release:** [${mbid}](${releaseUrl})  `,
    `**Headed:** ${headed}  `,
    ``,
    `## Results`,
    ``,
    `| Platform | Icon | URL | Tracks |`,
    `| --- | --- | --- | --- |`,
    `| Spotify  | ${results.spotify.icon}  | ${results.spotify.url}  | ${results.spotify.value}  |`,
    `| Discogs  | ${results.discogs.icon}  | ${results.discogs.url}  | ${results.discogs.value}  |`,
    `| Bandcamp | ${results.bandcamp.icon} | ${results.bandcamp.url} | ${results.bandcamp.value} |`,
    ``,
    `## Diagnostic log (from sidebar)`,
    ``,
    '```',
    results.diagnosticLogText,
    '```',
    ``,
    `## GM_xmlhttpRequest calls (${captured.gmCalls.length})`,
    ``,
    '```',
    captured.gmCalls.map(g => `[${g.ts}] ${String(g.method).padEnd(4)} ${String(g.status ?? '---').padEnd(3)} ${g.ms ?? '?'}ms ${g.url}${g.error ? ' ERR='+g.error : ''}`).join('\n'),
    '```',
    ``,
    `## Browser console (${captured.console.length})`,
    ``,
    '```',
    captured.console.map(m => `[${m.ts}] ${m.type.padEnd(7)} ${m.text}`).join('\n'),
    '```',
    ``,
    `## Page errors (${captured.pageErrors.length})`,
    ``,
    '```',
    captured.pageErrors.map(e => `[${e.ts}] ${e.name}: ${e.text}`).join('\n'),
    '```',
].join('\n');

await writeFile(resolve(RUN_DIR, 'README.md'), summary);
log(c.grey(`run dir: test/logs/${runStamp}/  (screenshot: page.png, log: README.md)`));

await browser.close();

// Exit non-zero if any expected URL is missing.
const okAll =
    results.spotify.url?.includes(EXPECT.spotify) &&
    results.bandcamp.url?.includes(EXPECT.bandcamp) &&
    results.discogs.url?.includes(EXPECT.discogs);
process.exit(okAll ? 0 : 1);
