// Verify #182 follow-ups on Random Access Memories (barcode 886443984059):
//  1. Withheld links (strict barcode) are presented as grayed + NON-clickable
//     (class pc-blocked, ico.onclick null) instead of a clickable ✓ that does nothing.
//  2. Discogs barcode is captured from the API `identifiers` (detail log shows barcode=…).
//  3. flashInfo anchor (rowAnchor) resolves to a visible element, not the page corner.
//  4. No page errors.
//
//   node test/verify-182b.mjs [--headed]

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
// seed strict barcode-confidence ON so links that can't be confirmed are withheld
const shim = `(() => {
    const store = new Map([['pc:respect-barcode', true], ['pc:barcode-mode', 'strict']]);
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

await page.waitForFunction(() => /All scans completed/.test(document.getElementById('mb-finder-log-panel')?.innerText || ''), null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(1500);

const out = await page.evaluate(() => {
    const row = p => {
        const r = document.getElementById(`row-${p}`); const ico = document.getElementById(`ico-${p}`);
        return { blocked: !!r?.classList.contains('pc-blocked'), clickable: !!(ico && ico.onclick), icon: ico?.textContent?.trim() || null, url: document.getElementById(`mb-online-${p}`)?.href || null };
    };
    // rowAnchor sanity: toggle icon mode on and confirm the anchor is a visible element
    const panel = document.getElementById('mb-pc-panel');
    panel?.classList.add('pc-icons-mode');
    const plat = document.getElementById('plat-spotify');
    const anchorRect = plat ? plat.getBoundingClientRect() : { width: 0, height: 0 };
    panel?.classList.remove('pc-icons-mode');
    return {
        spotify: row('spotify'), beatport: row('beatport'), tidal: row('tidal'), discogs: row('discogs'),
        iconModeAnchorVisible: anchorRect.width > 0 && anchorRect.height > 0,
        log: document.getElementById('mb-finder-log-panel')?.innerText || '',
    };
});
await context.close();

const discogsDetail = out.log.split('\n').find(l => /\[Discogs\] API detail parsed/.test(l)) || '(no discogs detail line)';
const discogsBarcodeCaptured = /API detail parsed:.*barcode=/.test(discogsDetail);

console.log('── strict barcode presentation ──');
console.log('  spotify :', JSON.stringify(out.spotify));
console.log('  beatport:', JSON.stringify(out.beatport));
console.log('  tidal   :', JSON.stringify(out.tidal), '(exact-UPC → should NOT be blocked)');
console.log('── Discogs barcode capture ──');
console.log('  ' + discogsDetail.trim());
console.log('── flashInfo anchor (icon mode) visible:', out.iconModeAnchorVisible);
if (errs.length) console.log('PAGE ERRORS:', errs.join(' | '));

// Spotify has no exposable UPC → under strict it must be withheld + non-clickable.
const spotifyWithheld = out.spotify.blocked && !out.spotify.clickable;
console.log('\n── Verdict ──');
console.log('  Spotify withheld (grayed + non-clickable) :', spotifyWithheld);
console.log('  Discogs detail line carries barcode=       :', discogsBarcodeCaptured);
console.log('  icon-mode flashInfo anchor is visible      :', out.iconModeAnchorVisible);
console.log('  no page errors                             :', errs.length === 0);
const pass = spotifyWithheld && discogsBarcodeCaptured && out.iconModeAnchorVisible && errs.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
