// Drive the isrc_import userscript against every release in test/fixtures.json
// and verify it loads cleanly and renders the editor correctly.
//
// The script is injected with page.addInitScript() — i.e. at document-start,
// BEFORE the page's own scripts and before <body> exists — so load-time bugs
// that only bite under `@run-at document-start` (e.g. observing a null
// document.body) reproduce here and fail the run via the pageerror capture.
//
// Each fixture is self-validating: the harness independently fetches the MB
// web service for ground truth (track count, ISRC count, streaming links) and
// asserts the rendered editor matches — so nothing is hard-coded to a DB state
// that drifts over time.
//
// Usage:
//   node test/run.mjs                 # all fixtures, headless
//   node test/run.mjs --headed        # show the browser
//   node test/run.mjs --only=<substr> # filter by MBID / name substring
//   node test/run.mjs --pause         # implies --headed; pause after each fixture
//
// Per-run output:  test/logs/<ISO8601>/
//   README.md                  summary table (one row per fixture)
//   <fixture-slug>/README.md   per-fixture checks + the script's own Log pane
//   <fixture-slug>/page.png    editor screenshot
//
// Exit code: 0 only if every selected fixture passes every check.

import { chromium }                   from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath }              from 'node:url';
import { dirname, resolve }           from 'node:path';
import { createInterface }            from 'node:readline';

// ──── locations ───────────────────────────────────────────────────────────
const HERE         = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH  = resolve(HERE, '..', 'isrc_import.user.js');
const FIXTURE_PATH = resolve(HERE, 'fixtures.json');
const LOG_ROOT     = resolve(HERE, 'logs');
const WS2          = 'https://musicbrainz.org/ws/2/';

// ──── args ────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const headed = args.includes('--headed') || args.includes('--pause');
const pause  = args.includes('--pause');
const arg    = name => { const a = args.find(x => x.startsWith(`${name}=`)); return a ? a.slice(name.length + 1) : null; };
const only   = arg('--only');

// ──── small util ──────────────────────────────────────────────────────────
const c = {
    grey:  s => `\x1b[90m${s}\x1b[0m`,
    red:   s => `\x1b[31m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
    amber: s => `\x1b[33m${s}\x1b[0m`,
    bold:  s => `\x1b[1m${s}\x1b[0m`,
};
function ts() {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
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
if (selected.length === 0) { console.error(`No fixture matches --only=${only}`); process.exit(2); }

// ──── run dir ──────────────────────────────────────────────────────────────
const runStart = new Date();
const runStamp = runStart.toISOString().slice(0, 19).replace(/:/g, '-');
const RUN_DIR  = resolve(LOG_ROOT, runStamp);
await mkdir(RUN_DIR, { recursive: true });
log(c.grey(`run dir: test/logs/${runStamp}/  (${selected.length} fixture${selected.length === 1 ? '' : 's'})`));

// ──── browser ──────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});

// ──── GM_xmlhttpRequest bridge (shares the context cookie jar, no CORS) ─────
await context.exposeBinding('__gmFetch', async (_source, opts) => {
    try {
        const resp = await context.request.fetch(opts.url, {
            method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20,
        });
        return { status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: await resp.text(), responseHeaders: '' };
    } catch (e) {
        return { status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, _networkError: true, _error: String(e?.message || e) };
    }
});

const userJs = await readFile(SCRIPT_PATH, 'utf8');
// GM_* shim. Runs at document-start (addInitScript) so the userscript sees a
// real document-start environment, exactly like Tampermonkey @run-at document-start.
const shim = `
    (() => {
        const store = new Map();
        window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
        window.GM_setValue = (k, v) => { store.set(k, v); };
        window.GM_deleteValue = (k) => { store.delete(k); };
        window.GM_xmlhttpRequest = function(opts) {
            window.__gmFetch({ method: opts.method || 'GET', url: opts.url, headers: opts.headers || {}, data: opts.data })
                .then(res => {
                    if (res._networkError) { try { opts.onerror && opts.onerror(res); } catch (e) {} }
                    else                   { try { opts.onload  && opts.onload (res); } catch (e) {} }
                })
                .catch(() => { try { opts.onerror && opts.onerror({ status: 0, responseText: '' }); } catch (e) {} });
        };
        window.unsafeWindow = window;
        window.GM_info = { script: { name: 'isrc_import (test)', version: 'test' }, scriptHandler: 'Playwright' };
    })();
`;

// ──── ground truth straight from the MB web service ─────────────────────────
async function groundTruth(mbid) {
    const resp = await context.request.get(`${WS2}release/${mbid}?inc=recordings+isrcs+url-rels&fmt=json`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'isrc_import-test/1.0 (CI)' } });
    if (!resp.ok()) throw new Error(`WS2 ${resp.status()} for ${mbid}`);
    const data = await resp.json();
    let tracks = 0, isrcs = 0;
    for (const m of data.media || []) for (const t of m.tracks || []) {
        tracks++; isrcs += ((t.recording && t.recording.isrcs) || []).length;
    }
    let deezer = false, spotify = false;
    for (const r of data.relations || []) {
        const u = (r.url && r.url.resource) || '';
        if (/deezer\.com\/(?:[a-z]{2}\/)?album\//.test(u)) deezer = true;
        if (/open\.spotify\.com\/album\//.test(u))         spotify = true;
    }
    const missing = tracks - data.media.flatMap(m => m.tracks || []).filter(t => ((t.recording && t.recording.isrcs) || []).length).length;
    const status = missing === 0 ? `✓ ${tracks}/${tracks}` : `⚠ ${tracks - missing}/${tracks}`;
    return { title: data.title, tracks, isrcs, deezer, spotify, status };
}

// ──── per-fixture loop ──────────────────────────────────────────────────────
const results = [];
for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    const fxSlug = slug(f.name || f.mbid);
    const fxDir  = resolve(RUN_DIR, fxSlug);
    await mkdir(fxDir, { recursive: true });
    log(c.bold(`\n[${i + 1}/${selected.length}] ${f.name}`));
    log(c.grey(`  mbid=${f.mbid}  tags=${f.tags || ''}`));

    const checks = [];               // { name, ok, detail }
    const pageErrors = [], consoleErrs = [];
    let gt = null, observed = null, scriptLog = '';

    const page = await context.newPage();
    page.on('pageerror', e => pageErrors.push(`${e.name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });

    try {
        gt = await groundTruth(f.mbid);
        log(c.grey(`  ground truth: ${gt.tracks} tracks, ${gt.isrcs} ISRC(s), ${gt.deezer ? 'Deezer' : 'no-Deezer'}, ${gt.spotify ? 'Spotify' : 'no-Spotify'} → "${gt.status}"`));

        // document-start injection
        await page.addInitScript({ content: shim });
        await page.addInitScript({ content: userJs });

        await page.goto(`https://musicbrainz.org/release/${f.mbid}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

        // button injects + status resolves (not the ⏳ placeholder)
        await page.waitForFunction(() => {
            const s = document.getElementById('ii-btn-status');
            return s && s.textContent && s.textContent.trim() !== '⏳';
        }, null, { timeout: 45_000 });

        // open the editor and wait for the track rows
        await page.click('#ii-btn');
        await page.waitForSelector('#ii-modal.open', { timeout: 10_000 });
        await page.waitForFunction(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length > 0, null, { timeout: 30_000 });

        observed = await page.evaluate(() => ({
            btnStatus:  document.getElementById('ii-btn-status')?.textContent?.trim() || '',
            rows:       document.querySelectorAll('#ii-tbody tr[data-idx]').length,
            samps:      document.querySelectorAll('#ii-tbody .ii-existing samp').length,
            dzDisabled: !!document.getElementById('ii-dz-all')?.disabled,
            spDisabled: !!document.getElementById('ii-sp-all')?.disabled,
            relSub:     document.getElementById('ii-rel-sub')?.textContent || '',
            logText:    document.getElementById('ii-log-out')?.textContent || '',
        }));
        scriptLog = observed.logText;

        const add = (name, ok, detail) => { checks.push({ name, ok, detail }); log(ok ? c.green(`  ✓ ${name}`) : c.red(`  ✗ ${name} — ${detail}`)); };
        add('no page errors',        pageErrors.length === 0, pageErrors.join(' | '));
        add('button status matches', observed.btnStatus === gt.status, `got "${observed.btnStatus}" want "${gt.status}"`);
        add('track rows match',      observed.rows === gt.tracks, `got ${observed.rows} want ${gt.tracks}`);
        add('existing ISRCs match',  observed.samps === gt.isrcs, `got ${observed.samps} want ${gt.isrcs}`);
        add('Deezer button state',   observed.dzDisabled === !gt.deezer, `disabled=${observed.dzDisabled}, link=${gt.deezer}`);
        add('Spotify button state',  observed.spDisabled === !gt.spotify, `disabled=${observed.spDisabled}, link=${gt.spotify}`);
        add('log pane populated',    scriptLog.trim().length > 0, 'Log pane is empty');

        await page.screenshot({ path: resolve(fxDir, 'page.png'), fullPage: false });
    } catch (e) {
        checks.push({ name: 'runner', ok: false, detail: e.message });
        log(c.red(`  runner error: ${e.message}`));
        try { await page.screenshot({ path: resolve(fxDir, 'page.png'), fullPage: false }); } catch (_) {}
    } finally {
        await page.close().catch(() => {});
    }

    const fxOk = checks.length > 0 && checks.every(x => x.ok);
    const fxReadme = [
        `# ${f.name}`, ``,
        `**MB release:** [${f.mbid}](https://musicbrainz.org/release/${f.mbid})  `,
        `**Tags:** \`${f.tags || ''}\`  `,
        `**Result:** ${fxOk ? '✅ pass' : '❌ FAIL'}  `, ``,
        `## Ground truth (MB web service)`, ``,
        '```',
        gt ? `tracks=${gt.tracks}  isrcs=${gt.isrcs}  deezer=${gt.deezer}  spotify=${gt.spotify}  status="${gt.status}"` : '(failed to fetch)',
        '```', ``,
        `## Checks`, ``,
        `| Check | Result | Detail |`, `| --- | --- | --- |`,
        ...checks.map(x => `| ${x.name} | ${x.ok ? '✓' : '✗ FAIL'} | ${(x.detail || '').replace(/\|/g, '\\|')} |`),
        ``,
        `## Page errors (${pageErrors.length})`, ``, '```', pageErrors.join('\n'), '```', ``,
        `## Console errors (${consoleErrs.length})`, ``, '```', consoleErrs.join('\n'), '```', ``,
        `## Script Log pane`, ``, '```', scriptLog, '```',
    ].join('\n');
    await writeFile(resolve(fxDir, 'README.md'), fxReadme);

    results.push({ fixture: f, slug: fxSlug, ok: fxOk, checks });
    if (pause) await waitForEnter('  -- paused. press Enter to continue, Ctrl-C to abort -- ');
}

await browser.close();

// ──── top-level summary ─────────────────────────────────────────────────────
const summary = [
    `# ISRC Import test run ${runStamp}`, ``,
    `**Started:** \`${runStart.toISOString()}\`  `,
    `**Fixtures:** ${selected.length} / ${fixtures.length}  `,
    `**Finished:** \`${new Date().toISOString()}\`  `,
    `**Result:** ${results.every(r => r.ok) ? '✅ all pass' : '❌ ' + results.filter(r => !r.ok).length + ' failed'}  `, ``,
    `| # | Fixture | Result | Checks | Log |`, `| --- | --- | --- | --- | --- |`,
    ...results.map((r, i) => {
        const passed = r.checks.filter(x => x.ok).length;
        return `| ${i + 1} | [${r.fixture.name}](https://musicbrainz.org/release/${r.fixture.mbid}) | ${r.ok ? '✅' : '❌'} | ${passed}/${r.checks.length} | [\`${r.slug}/\`](./${r.slug}/) |`;
    }),
].join('\n') + '\n';
await writeFile(resolve(RUN_DIR, 'README.md'), summary);

const failed = results.filter(r => !r.ok).length;
log(failed === 0 ? c.green(`\nOK all ${results.length} fixture(s) pass.`) : c.red(`\n${failed}/${results.length} fixture(s) failed.`));
log(c.grey(`Run dir: test/logs/${runStamp}/`));
process.exit(failed === 0 ? 0 : 1);
