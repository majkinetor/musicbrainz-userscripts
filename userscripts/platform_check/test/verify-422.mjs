// Verify #422 (maintainer-revised) — the ↻ refresh button itself is the progress
// indicator: it spins and is unclickable (pointer-events: none) while scans run, and
// once "All scans completed" it stops with the total scan time in its tooltip.
//
//   node test/verify-422.mjs [--headed]
import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed      = process.argv.includes('--headed');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';

const context = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), {
    headless: !headed, viewport: { width: 1400, height: 900 },
});
await context.exposeBinding('__gmFetch', async (_s, opts) => {
    try {
        const resp = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
        return { ok: resp.ok(), status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: await resp.text(), headers: resp.headers(), ms: 0 };
    } catch (e) { return { ok: false, status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, headers: {}, ms: 0, _networkError: true }; }
});
const userJs = await readFile(SCRIPT_PATH, 'utf8');
const shim = `(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => { store.set(k, v); };
    window.GM_xmlhttpRequest = function(o){ window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{},data:o.data}).then(r=>{ r._networkError?(o.onerror&&o.onerror(r)):(o.onload&&o.onload(r)); }).catch(()=>o.onerror&&o.onerror({status:0,responseText:''})); };
    window.unsafeWindow = window;
    window.GM_info = { script: { name: 'platform_check (test)', version: 'test' }, scriptHandler: 'Playwright' };
})();`;

const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#sidebar', { timeout: 30000 });
await page.addScriptTag({ content: shim });
await page.addScriptTag({ content: userJs });

// busy phase: the ↻ button spins and is unclickable
await page.waitForSelector('#mb-refresh-btn.pc-scanning', { timeout: 15000 }).catch(() => {});
const busy = await page.evaluate(() => {
    const btn = document.getElementById('mb-refresh-btn');
    return { spinning: btn.classList.contains('pc-scanning'), title: btn.title, pe: getComputedStyle(btn).pointerEvents, statusEl: !!document.getElementById('mb-scan-status') };
});

// done phase: spin stops, duration lands in the tooltip
await page.waitForFunction(() => !document.getElementById('mb-refresh-btn').classList.contains('pc-scanning'), null, { timeout: 120000 });
const done = await page.evaluate(() => {
    const btn = document.getElementById('mb-refresh-btn');
    const log = document.getElementById('mb-finder-log-panel')?.innerText || '';
    return { title: btn.title, pe: getComputedStyle(btn).pointerEvents, completedLogged: /All scans completed/.test(log) };
});
await context.close();

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log('busy:', JSON.stringify(busy), '\ndone:', JSON.stringify(done));
ck(busy.spinning, 'busy: ↻ button spins');
ck(busy.pe === 'none', 'busy: ↻ button unclickable (pointer-events none)');
ck(/Scanning platforms/.test(busy.title), 'busy: tooltip says scanning');
ck(!busy.statusEl, 'no separate status element anymore');
ck(/Refresh — clear cache and re-scan \(last scan: \d+(\.\d+)?s\)/.test(done.title), `done: duration in the refresh tooltip ("${done.title}")`);
ck(done.pe !== 'none', 'done: ↻ clickable again');
ck(done.completedLogged, 'log confirms "All scans completed"');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
