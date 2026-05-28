// Drive the platform_check userscript against every release in
// test/fixtures.json and verify the resolved URLs match what we expect.
//
// Usage:
//   node test/run.mjs                          # all fixtures, headless
//   node test/run.mjs --headed                 # show the browser
//   node test/run.mjs --only=<substr>          # filter by MBID / name substring
//   node test/run.mjs --cache=<plat>=<url>,…   # pre-seed userscript GM cache for ALL fixtures
//                                              # (testing the cache-hit path without hitting search engines)
//   node test/run.mjs --pause                  # implies --headed; pause after each fixture
//
// Per-run output:  test/logs/<ISO8601>/
//   README.md                summary table (one row per fixture)
//   <fixture-slug>/          one sub-directory per fixture
//     README.md              fixture's results table + full diagnostic log
//     page.png               full-page sidebar screenshot
//
// Exit code: 0 only if every selected fixture's resolved URLs satisfy every
// `expect.<platform>` substring assertion in fixtures.json.

import { chromium }                  from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath }             from 'node:url';
import { dirname, resolve }          from 'node:path';
import { createInterface }           from 'node:readline';

// ──── locations ───────────────────────────────────────────────────────────
const HERE         = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH  = resolve(HERE, '..', 'platform_check.user.js');
const FIXTURE_PATH = resolve(HERE, 'fixtures.json');
const LOG_ROOT     = resolve(HERE, 'logs');

// ──── args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headed = args.includes('--headed') || args.includes('--pause');
const pause  = args.includes('--pause');
const arg    = name => { const a = args.find(x => x.startsWith(`${name}=`)); return a ? a.slice(name.length + 1) : null; };
const only   = arg('--only');
const cacheArg = arg('--cache');

// ──── small util ──────────────────────────────────────────────────────────
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
function slug(s) { return (s || 'unnamed').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'unnamed'; }
function waitForEnter(prompt) {
    return new Promise(r => { const rl = createInterface({ input: process.stdin, output: process.stdout }); rl.question(prompt, () => { rl.close(); r(); }); });
}

// ──── fixture loading + filtering ─────────────────────────────────────────
const fixtures = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
const selected = only
    ? fixtures.filter(f => f.mbid.includes(only) || (f.name || '').toLowerCase().includes(only.toLowerCase()))
    : fixtures;

if (selected.length === 0) {
    console.error(`No fixture matches --only=${only}`);
    process.exit(2);
}

// ──── run dir + summary ──────────────────────────────────────────────────
const runStart = new Date();
const runStamp = runStart.toISOString().slice(0, 19).replace(/:/g, '-');
const RUN_DIR  = resolve(LOG_ROOT, runStamp);
await mkdir(RUN_DIR, { recursive: true });
log(c.grey(`run dir: test/logs/${runStamp}/  (${selected.length} fixture${selected.length === 1 ? '' : 's'})`));

const seedPairs = {};
if (cacheArg) {
    // --cache supports either "platform=url" pairs (applied to every fixture's
    // MBID) or "mbid:platform=url" pairs (applied only to that MBID).
    for (const p of cacheArg.split(',')) {
        const [k, v] = p.split('=');
        if (!k || !v) continue;
        if (k.includes(':')) seedPairs[`urlcache:${k.replace(':', ':')}`] = v;
        else for (const f of selected) seedPairs[`urlcache:${k}:${f.mbid}`] = v;
    }
}
const seedJson = JSON.stringify(seedPairs);

const results = [];

// ──── browser ─────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});

// Pre-warm bandcamp.com so the context picks up Cloudflare's clearance
// cookie. The userscript's Bandcamp-native search path requires it; without
// this warm-up CF returns a "Client Challenge" interstitial to every
// GM_xmlhttpRequest. Real users hit this naturally after any prior Bandcamp
// visit; the test harness has to do it explicitly.
{
    const warm = await context.newPage();
    try {
        log(c.grey('pre-warming bandcamp.com for Cloudflare clearance…'));
        await warm.goto('https://bandcamp.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
        // Give CF's auto-challenge time to resolve and write the cookie.
        await warm.waitForTimeout(3000);
        const cookies = await context.cookies('https://bandcamp.com/');
        log(c.grey(`  bandcamp cookies in context: ${cookies.map(c => c.name).join(', ') || '(none)'}`));
    } catch (e) {
        log(c.amber(`  warm-up failed: ${e.message} — Bandcamp native search will likely fall through`));
    } finally {
        await warm.close().catch(() => {});
    }
}

// ──── GM_xmlhttpRequest bridge ────────────────────────────────────────────
// Each new page gets the same binding installed. The binding forwards fetches
// to Node (no CORS) and returns the response. Network errors are surfaced via
// `_networkError: true` so the in-page shim can dispatch to onerror vs onload
// the same way real Tampermonkey does.
// Use the playwright BrowserContext's `request` (an APIRequestContext) instead
// of a raw Node fetch. That way the binding shares the context's cookie jar —
// when we pre-warm bandcamp.com to pass Cloudflare's challenge, the resulting
// cf_clearance cookie is automatically attached to subsequent GM_xhr calls
// (Tampermonkey behaves the same way in real browsers).
await context.exposeBinding('__gmFetch', async (_source, opts) => {
    const t0 = Date.now();
    try {
        const resp = await context.request.fetch(opts.url, {
            method:  opts.method || 'GET',
            headers: opts.headers || {},
            maxRedirects: 20,
        });
        const body = await resp.text();
        return {
            ok:           resp.ok(),
            status:       resp.status(),
            statusText:   resp.statusText(),
            finalUrl:     resp.url(),
            responseText: body,
            headers:      resp.headers(),
            ms:           Date.now() - t0,
        };
    } catch (e) {
        return { ok: false, status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, headers: {}, _networkError: true, _error: String(e?.message || e), ms: Date.now() - t0 };
    }
});

const userJs = await readFile(SCRIPT_PATH, 'utf8');
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
                if (res._networkError) { try { opts.onerror && opts.onerror(res); } catch (e) { console.error('GM onerror threw:', e); } }
                else                   { try { opts.onload  && opts.onload (res); } catch (e) { console.error('GM onload threw:',  e); } }
            }).catch(e => {
                try { opts.onerror && opts.onerror({ status: 0, statusText: String(e), responseText: '' }); } catch (_) {}
            });
        };
        window.unsafeWindow = window;
        window.GM_info = { script: { name: 'platform_check (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };
    })();
`;

// ──── per-fixture loop ────────────────────────────────────────────────────
for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    const fxSlug = slug(f.name || f.mbid);
    const fxDir  = resolve(RUN_DIR, fxSlug);
    await mkdir(fxDir, { recursive: true });

    log(c.bold(`\n[${i + 1}/${selected.length}] ${f.name}`));
    log(c.grey(`  mbid=${f.mbid}  tags=${f.tags || ''}`));

    const captured = { console: [], pageErrors: [], gmCalls: [] };
    const page = await context.newPage();
    page.on('console',  m => captured.console.push({ ts: ts(), type: m.type(), text: m.text() }));
    page.on('pageerror', e => captured.pageErrors.push({ ts: ts(), name: e.name, text: e.message }));
    // Buffer the gmCalls trace by re-wrapping the binding's payload. We do it
    // via a per-page hook: intercept the binding call result through a thin
    // proxy script that pings back into a buffer.
    await page.exposeBinding('__gmTrace', async (_s, entry) => { captured.gmCalls.push(entry); });

    try {
        const releaseUrl = `https://musicbrainz.org/release/${f.mbid}`;
        log(c.grey(`  opening ${releaseUrl}`));
        await page.goto(releaseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForSelector('#sidebar', { timeout: 30_000 });

        // Inject a tiny shim that logs every GM_xhr call back to Node before
        // calling __gmFetch. Lets us record the trace independently of the
        // userscript's diagnostic panel.
        await page.addScriptTag({ content: `
            (() => {
                const orig = window.__gmFetch;
                window.__gmFetch = async function(opts) {
                    const t0 = Date.now();
                    const res = await orig(opts);
                    try { window.__gmTrace({ ts: new Date().toTimeString().slice(0,8), method: opts.method || 'GET', url: opts.url, status: res.status, ms: Date.now() - t0, error: res._error || null }); } catch (_) {}
                    return res;
                };
            })();
        ` });
        await page.addScriptTag({ content: shim });
        await page.addScriptTag({ content: userJs });

        // Wait for all three platforms to settle (icon !== ⚪) or timeout.
        const settled = await page.waitForFunction(() => {
            const icons = ['spotify', 'discogs', 'bandcamp'].map(p => document.getElementById(`ico-${p}`)?.textContent?.trim());
            return icons.every(t => t && t !== '⚪');
        }, null, { timeout: 120_000 }).then(() => true).catch(() => false);

        if (!settled) log(c.amber(`  ! not all platforms settled within 120s`));

        const res = await page.evaluate(() => {
            const read = p => ({
                url:   document.getElementById(`mb-online-${p}`)?.href || null,
                icon:  document.getElementById(`ico-${p}`)?.textContent?.trim() || null,
                value: document.getElementById(`val-${p}`)?.textContent?.trim() || null,
                meta:  document.getElementById(`meta-${p}`)?.textContent?.trim() || null,
            });
            return {
                spotify:  read('spotify'),
                discogs:  read('discogs'),
                bandcamp: read('bandcamp'),
                diagnosticLog: document.getElementById('mb-finder-log-panel')?.innerText || '',
            };
        });

        // Per-platform pass/fail vs fixture.expect. Substring match by default;
        // use `<plat>OneOf: [substr, …]` when several URLs are equally valid
        // (e.g. Spotify's US vs worldwide editions of the same album).
        const expect = f.expect || {};
        const perPlatform = {};
        for (const p of ['spotify', 'discogs', 'bandcamp']) {
            const want    = expect[p];
            const wantAny = expect[`${p}OneOf`];
            if (!want && !wantAny) { perPlatform[p] = { ok: true, skipped: true }; continue; }
            const got = res[p].url || '';
            const ok = want ? got.includes(want) : wantAny.some(w => got.includes(w));
            perPlatform[p] = { ok, want: want || wantAny.join(' | '), got };
        }
        const fxOk = Object.values(perPlatform).every(x => x.ok);

        for (const p of ['spotify', 'discogs', 'bandcamp']) {
            const r = res[p];
            const v = perPlatform[p];
            const colour = v.skipped ? c.grey : v.ok ? c.green : c.red;
            const status = v.skipped ? 'skip' : v.ok ? 'OK  ' : 'FAIL';
            log(colour(`  ${p.padEnd(8)} ${status} ${r.icon || '?'} ${r.value || ''}  ${r.meta ? '· ' + r.meta : ''}`));
            log(c.grey(`           url:  ${r.url || '-'}`));
            if (!v.ok && !v.skipped) log(c.amber(`           want: ${v.want}`));
        }

        // Persist per-fixture log + screenshot
        await page.screenshot({ path: resolve(fxDir, 'page.png'), fullPage: true });
        const fxReadme = [
            `# ${f.name}`,
            ``,
            `**MB release:** [${f.mbid}](${releaseUrl})  `,
            `**Tags:** \`${f.tags || ''}\`  `,
            ``,
            `## Results`,
            ``,
            `| Platform | Status | Icon | URL | Tracks | Meta |`,
            `| --- | --- | --- | --- | --- | --- |`,
            ...['spotify', 'discogs', 'bandcamp'].map(p => {
                const r = res[p], v = perPlatform[p];
                const st = v.skipped ? 'skip' : v.ok ? '✓ pass' : '✗ FAIL';
                return `| ${p} | ${st} | ${r.icon || ''} | ${r.url || ''} | ${r.value || ''} | ${r.meta || ''} |`;
            }),
            ``,
            `## Diagnostic log`,
            ``,
            '```',
            res.diagnosticLog,
            '```',
            ``,
            `## GM_xmlhttpRequest calls (${captured.gmCalls.length})`,
            ``,
            '```',
            captured.gmCalls.map(g => `[${g.ts}] ${String(g.method).padEnd(4)} ${String(g.status ?? '---').padEnd(3)} ${g.ms ?? '?'}ms ${g.url}${g.error ? '  ERR=' + g.error : ''}`).join('\n'),
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
        await writeFile(resolve(fxDir, 'README.md'), fxReadme);

        results.push({ fixture: f, slug: fxSlug, ok: fxOk, perPlatform, resolved: res });

        if (pause) await waitForEnter('  -- paused. press Enter to continue, Ctrl-C to abort -- ');
    } catch (e) {
        log(c.red(`  runner error: ${e.message}`));
        results.push({ fixture: f, slug: fxSlug, ok: false, error: e.message });
    } finally {
        await page.close().catch(() => {});
    }
}

await browser.close();

// ──── top-level summary ───────────────────────────────────────────────────
const summary = [
    `# Platform check test run ${runStamp}`,
    ``,
    `**Started:** \`${runStart.toISOString()}\`  `,
    `**Fixtures:** ${selected.length} / ${fixtures.length}  `,
    `**Finished:** \`${new Date().toISOString()}\`  `,
    `**Result:** ${results.every(r => r.ok) ? '✅ all pass' : '❌ ' + results.filter(r => !r.ok).length + ' failed'}  `,
    ``,
    `## Fixtures`,
    ``,
    `| # | Fixture | Spotify | Discogs | Bandcamp | Log |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...results.map((r, i) => {
        const cell = p => {
            const v = r.perPlatform?.[p];
            if (!v) return '?';
            if (v.skipped) return '–';
            return v.ok ? '✓' : '✗';
        };
        return `| ${i + 1} | [${r.fixture.name}](https://musicbrainz.org/release/${r.fixture.mbid}) | ${cell('spotify')} | ${cell('discogs')} | ${cell('bandcamp')} | [\`${r.slug}/\`](./${r.slug}/) |`;
    }),
].join('\n') + '\n';
await writeFile(resolve(RUN_DIR, 'README.md'), summary);

const failed = results.filter(r => !r.ok).length;
log(failed === 0 ? c.green(`\nOK all ${results.length} fixture(s) pass.`) : c.red(`\n${failed}/${results.length} fixture(s) failed.`));
log(c.grey(`Run dir: test/logs/${runStamp}/`));
process.exit(failed === 0 ? 0 : 1);
