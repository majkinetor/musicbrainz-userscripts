// Verify #416 — the Discogs MASTER must be queued by [+] even when the Discogs
// RELEASE link is withheld by barcode/format confidence (a master is the whole
// release group and spans every edition's barcode/format).
//
// Approach: let the panel scans settle on a real release (so MB_BARCODE is set
// from the page), then overwrite the GM store with a controlled state — Discogs
// ✓ match carrying a MISMATCHING barcode + a master URL, a fake release-group
// with no existing master — and click [+]. Expect: release URL skipped
// (barcode-blocked), master still queued for the release-group.
//
//   node test/verify-416.mjs [--headed]

import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed      = process.argv.includes('--headed');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // Daft Punk — RAM (has a barcode)

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
    window.__gmStore = store;
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => { store.set(k, v); };
    window.GM_xmlhttpRequest = function(o){ window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{},data:o.data}).then(r=>{ r._networkError?(o.onerror&&o.onerror(r)):(o.onload&&o.onload(r)); }).catch(()=>o.onerror&&o.onerror({status:0,responseText:''})); };
    window.unsafeWindow = window;
    window.__opened = [];
    const _open = window.open.bind(window);
    window.open = (u) => { window.__opened.push(String(u)); return { closed: false }; };
    window.GM_info = { script: { name: 'platform_check (test)', version: 'test' }, scriptHandler: 'Playwright' };
})();`;

const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#sidebar', { timeout: 30000 });
await page.addScriptTag({ content: shim });
await page.addScriptTag({ content: userJs });

// let the scans settle (discogs icon leaves the pending state)
await page.waitForFunction(() => {
    const t = document.getElementById('ico-discogs')?.textContent?.trim();
    return t && t !== '⚪';
}, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);

const out = await page.evaluate((mbid) => {
    const RG = '00000000-dead-beef-0000-000000000001';
    // controlled state: Discogs ✓ match, barcode DIFFERS from MB's, master known,
    // release-group has no master yet; barcode confidence ON (default mode).
    // #501 follow-up: cache/pending state now lives in real localStorage, not
    // the mocked GM store — pc:respect-barcode/pc:barcode-mode are genuine
    // settings and stay on the GM mock.
    localStorage.setItem(`pc:cache:v2:discogs:${mbid}`, JSON.stringify({
        url: 'https://www.discogs.com/release/4570366', tracks: 13, source: 'search',
        barcode: '111111111111', format: 'Vinyl', masterUrl: 'https://www.discogs.com/master/556257',
    }));
    localStorage.setItem(`pc:mbdata:${mbid}`, JSON.stringify({ releaseGroupMbid: RG, existing: {} }));
    window.__gmStore.set('pc:respect-barcode', true);
    window.__gmStore.set('pc:barcode-mode', 'exists');
    // wipe every other provider's cache so only discogs is considered
    for (const p of ['spotify','bandcamp','deezer','apple','tidal','qobuz','beatport','volumo','hdtracks']) localStorage.removeItem(`pc:cache:v2:${p}:${mbid}`);
    localStorage.removeItem(`pc:pending:${mbid}`);
    localStorage.removeItem(`pc:pending:rg:${RG}`);
    const ico = document.getElementById('ico-discogs');
    ico.textContent = '✓';
    window.__opened.length = 0;
    document.getElementById('mb-inject-btn').click();
    return {
        pendingRelease: localStorage.getItem(`pc:pending:${mbid}`) || null,
        pendingRG:      localStorage.getItem(`pc:pending:rg:${RG}`) || null,
        opened:         [...window.__opened],
        log:            (document.getElementById('mb-finder-log-panel')?.innerText || '').split('\n').filter(l => /Inject/.test(l)).join('\n'),
    };
}, MBID);
await context.close();

console.log('pendingRelease :', out.pendingRelease);
console.log('pendingRG      :', out.pendingRG);
console.log('opened         :', out.opened.join(' , '));
console.log('inject log     :\n  ' + out.log.replace(/\n/g, '\n  '));
if (errs.length) console.log('PAGE ERRORS:', errs.join(' | '));

const rgQueued      = !!(out.pendingRG && /discogs-master/.test(out.pendingRG) && /master\/556257/.test(out.pendingRG));
const releaseBlocked = !out.pendingRelease || !/discogs/.test(out.pendingRelease);
const openedRgEdit  = out.opened.some(u => /release-group\/00000000-dead-beef/.test(u));

console.log('\n── Verdict ──');
console.log('  master queued for the RG despite barcode block :', rgQueued);
console.log('  blocked Discogs RELEASE url not queued         :', releaseBlocked);
console.log('  release-group edit page opened                 :', openedRgEdit);
console.log('  no page errors                                 :', errs.length === 0);
const pass = rgQueued && releaseBlocked && openedRgEdit && errs.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
