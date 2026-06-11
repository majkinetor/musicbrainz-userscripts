// Verify #182 barcode-accuracy work on Daft Punk — Random Access Memories
// (barcode 886443984059). The bug: Platform Check linked wrong-barcode editions.
// After the fix, Tidal should resolve to the EXACT-barcode album 211822890 (not
// the Wikidata 20115556), SAMBL should run, and no page errors.
//
//   node test/verify-182.mjs [--headed]

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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
await context.exposeBinding('__gmFetch', async (_s, opts) => {
    try {
        const resp = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
        return { ok: resp.ok(), status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: await resp.text(), headers: resp.headers() };
    } catch (e) { return { ok: false, status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, headers: {}, _networkError: true, _error: String(e?.message || e) }; }
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

await page.waitForFunction(() => {
    const t = document.getElementById('ico-tidal')?.textContent?.trim();
    return t && t !== '⚪';
}, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
    const read = p => ({
        url:  document.getElementById(`mb-online-${p}`)?.href || null,
        icon: document.getElementById(`ico-${p}`)?.textContent?.trim() || null,
        bcDiff: document.getElementById(`row-${p}`)?.classList.contains('pc-barcode-diff') || false,
    });
    return {
        tidal: read('tidal'), spotify: read('spotify'), deezer: read('deezer'), hdtracks: read('hdtracks'),
        log: document.getElementById('mb-finder-log-panel')?.innerText || '',
    };
});
await context.close();

const log = out.log;
const tidalExact = /Barcode 886443984059 → album 211822890/.test(log) && /album\/211822890/.test(out.tidal.url || '');
const samblRan   = /SAMBL.*barcode lookup 886443984059/i.test(log);
const samblFound = /exact-barcode albums:.*tidal/i.test(log);

console.log('── Tidal ──');
console.log('  url  :', out.tidal.url, '  icon:', out.tidal.icon, '  bcDiff:', out.tidal.bcDiff);
console.log('── SAMBL log ──');
console.log('  ' + log.split('\n').filter(l => /SAMBL/.test(l)).join('\n  '));
console.log('── Tidal log ──');
console.log('  ' + log.split('\n').filter(l => /\[Tidal\]/.test(l)).slice(0, 4).join('\n  '));
if (errs.length) console.log('PAGE ERRORS:', errs.join(' | '));

console.log('\n── Verdict ──');
console.log('  Tidal resolves to EXACT-barcode album 211822890 :', tidalExact);
console.log('  SAMBL barcode lookup ran                        :', samblRan);
console.log('  SAMBL returned exact-barcode providers (tidal)  :', samblFound);
console.log('  no page errors                                  :', errs.length === 0);
const pass = tidalExact && samblRan && errs.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
