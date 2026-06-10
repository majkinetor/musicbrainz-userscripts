// Focused verification for #181 (track-ISRC-provider menu). The [SX] buttons +
// bulk button become a menu of every ISRC provider available for the release;
// picking one re-skins all per-track buttons and routes each per-track lookup to
// that provider.
//
// Controlled setup: the Daft Punk — Random Access Memories release (which has all
// 13 ISRCs) plus an injected Platform-Check anchor for HDtracks (the same path a
// real Platform Check install provides). That makes HDtracks an available track
// provider via the PC fallback, and exercises the #176 HDtracks API for the fill.
//
//   node test/verify-181.mjs            # headless
//   node test/verify-181.mjs --headed   # show the browser

import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'isrc_scout.user.js');
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const headed      = process.argv.includes('--headed');

const MBID    = 'ec116461-5b0d-4c98-bb44-a4de5de63076';                 // RAM
const HD_HREF = 'https://www.hdtracks.com/#/album/5e182300c10cf717bb0315f2';

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !headed,
    viewport: { width: 1400, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
await context.exposeBinding('__gmFetch', async (_s, opts) => {
    try {
        const resp = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
        return { status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: await resp.text(), responseHeaders: '' };
    } catch (e) {
        return { status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, _networkError: true, _error: String(e?.message || e) };
    }
});

const userJs = await readFile(SCRIPT_PATH, 'utf8');
const shim = `
    (() => {
        const store = new Map();
        window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
        window.GM_setValue = (k, v) => { store.set(k, v); };
        window.GM_deleteValue = (k) => { store.delete(k); };
        window.GM_xmlhttpRequest = function(opts) {
            window.__gmFetch({ method: opts.method || 'GET', url: opts.url, headers: opts.headers || {}, data: opts.data })
                .then(res => { if (res._networkError) { opts.onerror && opts.onerror(res); } else { opts.onload && opts.onload(res); } })
                .catch(() => { opts.onerror && opts.onerror({ status: 0, responseText: '' }); });
        };
        window.unsafeWindow = window;
        window.GM_info = { script: { name: 'isrc_scout (test)', version: 'test' }, scriptHandler: 'Playwright' };
    })();
`;

const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(`${e.name}: ${e.message}`));

await page.addInitScript({ content: shim });
await page.addInitScript({ content: userJs });
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

// Inject a Platform-Check-style confident HDtracks match (anchor + matched row),
// exactly what the platform_check userscript would expose for ISRC Scout to read.
await page.evaluate(href => {
    const a = document.createElement('a'); a.id = 'mb-online-hdtracks'; a.href = href; a.style.display = 'none';
    const row = document.createElement('div'); row.id = 'row-hdtracks'; row.className = 'pc-st-match'; row.style.display = 'none';
    document.body.append(a, row);
}, HD_HREF);

await page.waitForSelector('#ii-btn', { timeout: 30_000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-modal.open', { timeout: 10_000 });
await page.waitForFunction(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length > 0, null, { timeout: 30_000 });

// 1) open the provider menu, read the offered providers
await page.evaluate(() => document.getElementById('ii-prov-toggle').click());
await page.waitForSelector('#ii-sx-group.prov-open', { timeout: 5_000 });
const providers = await page.evaluate(() =>
    [...document.querySelectorAll('#ii-prov-menu .ii-prov-item .ii-prov-name')].map(n => n.textContent.trim()));

// 2) pick HDtracks → per-track buttons should re-skin
const hasHd = providers.includes('HDtracks');
if (hasHd) await page.evaluate(() => {
    const it = [...document.querySelectorAll('#ii-prov-menu .ii-prov-item')].find(b => /HDtracks/.test(b.textContent));
    it && it.click();
});
const afterSelect = await page.evaluate(() => ({
    cur:        document.getElementById('ii-prov-cur')?.textContent?.trim(),
    bulk:       document.getElementById('ii-sx-all')?.textContent?.trim(),
    btnHasIcon: !!document.querySelector('#ii-tbody tr[data-idx] .ii-sx svg'),
    btnProv:    document.querySelector('#ii-tbody tr[data-idx] .ii-sx')?.dataset?.prov,
    anyEnabled: [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].some(b => !b.disabled),
    exactHidden: getComputedStyle(document.getElementById('ii-exact-toggle')).display === 'none',
}));

// 3) click the first per-track button → resolve that track's ISRC from HDtracks
let bullet = '(skipped)';
if (hasHd) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].find(x => !x.disabled); b && b.click(); });
    bullet = await page.waitForFunction(() => {
        const el = document.querySelector('#ii-tbody tr[data-idx] .ii-lookup');
        const t = el?.textContent?.trim();
        return (t && /✓|✗/.test(t)) ? t : false;
    }, null, { timeout: 30_000 }).then(h => h.jsonValue()).catch(() => '(timeout)');
}

const scriptLog = await page.evaluate(() => document.getElementById('ii-log-out')?.textContent || '');
await context.close();

const hdLines = scriptLog.split('\n').filter(l => /HDtracks/i.test(l));
const perTrack = hdLines.find(l => /HDtracks #\d+/.test(l)) || '';
const isrcInLog = /\b[A-Z]{2}[A-Z0-9]{3}\d{7}\b/.test(perTrack);

console.log('\n── Provider menu ─────────────────────────────');
console.log('  offered :', providers.join(', '));
console.log('\n── After selecting HDtracks ──────────────────');
console.log('  cur label       :', afterSelect.cur);
console.log('  bulk button     :', afterSelect.bulk);
console.log('  per-row icon     :', afterSelect.btnHasIcon, '(dataset.prov=' + afterSelect.btnProv + ')');
console.log('  exact controls hidden:', afterSelect.exactHidden);
console.log('  some btn enabled :', afterSelect.anyEnabled);
console.log('\n── Per-track lookup from HDtracks ────────────');
console.log('  bullet  :', bullet);
console.log('  log line:', perTrack || '(none)');
if (pageErrors.length) console.log('\n  PAGE ERRORS:', pageErrors.join(' | '));

console.log('\n── Verdict ───────────────────────────────────');
const menuOk   = providers.includes('SoundExchange') && providers.includes('HDtracks');
const reskinOk = afterSelect.cur === 'HDtracks' && /HDtracks/.test(afterSelect.bulk || '') && afterSelect.btnProv === 'hdtracks' && afterSelect.btnHasIcon && afterSelect.exactHidden;
const lookupOk = /✓/.test(bullet) && isrcInLog;
console.log('  menu offers SoundExchange + HDtracks :', menuOk);
console.log('  selecting HDtracks re-skins buttons  :', reskinOk);
console.log('  per-track HDtracks lookup matched    :', lookupOk, '·', perTrack.trim().slice(-40));
console.log('  no page errors                       :', pageErrors.length === 0);
const pass = menuOk && reskinOk && lookupOk && pageErrors.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
