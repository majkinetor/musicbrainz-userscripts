// Focused verification for #176 (HDtracks provider). The general run.mjs harness
// only reads spotify/discogs/bandcamp rows, so this drives the userscript against
// a release that IS on HDtracks (Daft Punk — Random Access Memories, barcode
// 886443984059) and reads the hdtracks row + the HDtracks diagnostic-log lines.
//
//   node test/verify-176.mjs            # headless
//   node test/verify-176.mjs --headed   # show the browser

import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed      = process.argv.includes('--headed');

// RAM is on HDtracks at UPC 886443984059 → ObjectId 5e182300c10cf717bb0315f2,
// 13 tracks. The MB release carries no HDtracks rel, so resolution must go via
// the barcode-search path (the most important code path to exercise).
const MBID     = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const EXPECT_ID = '5e182300c10cf717bb0315f2';
const EXPECT_TRACKS = 13;

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});

await context.exposeBinding('__gmFetch', async (_source, opts) => {
    try {
        const resp = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 20 });
        const body = await resp.text();
        return { ok: resp.ok(), status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: body, headers: resp.headers() };
    } catch (e) {
        return { ok: false, status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, headers: {}, _networkError: true, _error: String(e?.message || e) };
    }
});

const userJs = await readFile(SCRIPT_PATH, 'utf8');
const shim = `
    (() => {
        const store = new Map();
        window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
        window.GM_setValue = (k, v) => { store.set(k, v); };
        window.GM_xmlhttpRequest = function(opts) {
            window.__gmFetch({ method: opts.method || 'GET', url: opts.url, headers: opts.headers || {} })
                .then(res => { if (res._networkError) { opts.onerror && opts.onerror(res); } else { opts.onload && opts.onload(res); } })
                .catch(e => { opts.onerror && opts.onerror({ status: 0, statusText: String(e), responseText: '' }); });
        };
        window.unsafeWindow = window;
        window.GM_info = { script: { name: 'platform_check (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };
    })();
`;

const page = await context.newPage();
page.on('console', m => { if (/error/i.test(m.type())) console.log('  console.' + m.type() + ':', m.text()); });
page.on('pageerror', e => console.log('  PAGEERROR:', e.message));

await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('#sidebar', { timeout: 30_000 });
await page.addScriptTag({ content: shim });
await page.addScriptTag({ content: userJs });

// Wait for the HDtracks row to settle (icon leaves the ⚪ pending state).
const settled = await page.waitForFunction(() => {
    const t = document.getElementById('ico-hdtracks')?.textContent?.trim();
    return t && t !== '⚪';
}, null, { timeout: 90_000 }).then(() => true).catch(() => false);

const out = await page.evaluate(() => ({
    url:   document.getElementById('mb-online-hdtracks')?.href || null,
    icon:  document.getElementById('ico-hdtracks')?.textContent?.trim() || null,
    value: document.getElementById('val-hdtracks')?.textContent?.trim() || null,
    rowClass: document.getElementById('row-hdtracks')?.className || null,
    log:   document.getElementById('mb-finder-log-panel')?.innerText || '',
}));

await browser.close();

const hdLog = out.log.split('\n').filter(l => /HDtracks/i.test(l)).join('\n');
console.log('\n── HDtracks row ──────────────────────────────');
console.log('  settled :', settled);
console.log('  icon    :', out.icon);
console.log('  value   :', out.value, `(expect ${EXPECT_TRACKS})`);
console.log('  url     :', out.url);
console.log('  rowClass:', out.rowClass);
console.log('\n── HDtracks diagnostic log ───────────────────');
console.log(hdLog || '  (no HDtracks log lines)');

const urlOk    = !!out.url && out.url.includes(EXPECT_ID);
const tracksOk = String(out.value) === String(EXPECT_TRACKS);
const matchOk  = /pc-st-match/.test(out.rowClass || '');
console.log('\n── Verdict ───────────────────────────────────');
console.log('  url contains expected ObjectId :', urlOk);
console.log('  track count == ' + EXPECT_TRACKS + '             :', tracksOk);
console.log('  row marked pc-st-match          :', matchOk);
const pass = urlOk && tracksOk && matchOk;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
