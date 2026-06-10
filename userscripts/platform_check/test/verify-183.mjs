// Verify #183 — Bandcamp hidden download-only track detection. On Jam2go —
// "Crash Test" (MB 3be1b732…), Bandcamp streams 11 tracks but the download has
// 15 (og:description "15 track album"), so 4 are hidden. Platform Check should
// report the true total (15), flag 4 hidden, and mark the count with ⁿ.
//
//   node test/verify-183.mjs [--headed]

import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed      = process.argv.includes('--headed');
const MBID = '3be1b732-9331-477d-9878-734c31a4704b';   // Jam2go — Crash Test

const context = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), {
    headless: !headed, viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
await context.exposeBinding('__gmFetch', async (_s, opts) => {
    try { const resp = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
        return { ok: resp.ok(), status: resp.status(), responseText: await resp.text(), headers: resp.headers() }; }
    catch (e) { return { ok: false, status: 0, responseText: '', _networkError: true }; }
});
// Pre-warm bandcamp.com so the context picks up Cloudflare's clearance cookie —
// the native album search needs it (a real user has it after any prior visit).
{
    const warm = await context.newPage();
    try { await warm.goto('https://bandcamp.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await warm.waitForTimeout(3000); }
    catch {} finally { await warm.close().catch(() => {}); }
}

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
// Inject a Bandcamp rel so the scan resolves deterministically via the existing
// URL (the search path is Cloudflare/rate-limit-flaky headless) and parses the
// real album page — which is what exercises the hidden-track detection.
await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://jam2go.bandcamp.com/album/crash-test';
    a.textContent = 'Bandcamp';
    document.getElementById('sidebar').appendChild(a);
});
await page.addScriptTag({ content: shim });
await page.addScriptTag({ content: userJs });
await page.waitForFunction(() => {
    const t = document.getElementById('ico-bandcamp')?.textContent?.trim();
    return t && t !== '⚪';
}, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2000);

const out = await page.evaluate(() => ({
    url:  document.getElementById('mb-online-bandcamp')?.href || null,
    val:  document.getElementById('val-bandcamp')?.textContent?.trim() || null,
    valTitle: document.getElementById('val-bandcamp')?.title || '',
    log:  document.getElementById('mb-finder-log-panel')?.innerText || '',
}));
await context.close();

const log = out.log;
const detectsHidden = /4 download-only track\(s\) hidden/.test(log) || /11 streaming \+ 4 download-only hidden/.test(log);
const total15  = /tracks=15/.test(log);
const marked   = /15ⁿ/.test(out.val || '') && /hidden from streaming/i.test(out.valTitle);

console.log('── Bandcamp ──');
console.log('  url      :', out.url);
console.log('  count    :', out.val, ' tooltip:', out.valTitle);
console.log('  log (bandcamp hidden lines):');
console.log('    ' + log.split('\n').filter(l => /Bandcamp.*(hidden|streaming|tracks=15)/i.test(l)).join('\n    '));
if (errs.length) console.log('PAGE ERRORS:', errs.join(' | '));

console.log('\n── Verdict ──');
console.log('  reports true total of 15      :', total15);
console.log('  detects 4 hidden tracks       :', detectsHidden);
console.log('  count marked 15ⁿ + tooltip    :', marked);
console.log('  no page errors                :', errs.length === 0);
const pass = total15 && detectsHidden && marked && errs.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
