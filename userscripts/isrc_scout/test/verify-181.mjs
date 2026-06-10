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

// 1) open the provider menu from the FIRST per-track button's ▾ caret
const bulkBefore = await page.evaluate(() => document.getElementById('ii-sx-all')?.textContent?.trim());
await page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx] .ii-sxprov').click());
await page.waitForSelector('#ii-prov-menu.open', { timeout: 5_000 });
const providers = await page.evaluate(() =>
    [...document.querySelectorAll('#ii-prov-menu .ii-prov-item .ii-prov-name')].map(n => n.textContent.trim()));

// 2) pick HDtracks → ALL per-track buttons re-skin; the bulk button must NOT change
const hasHd = providers.includes('HDtracks');
if (hasHd) await page.evaluate(() => {
    const it = [...document.querySelectorAll('#ii-prov-menu .ii-prov-item')].find(b => /HDtracks/.test(b.textContent));
    it && it.click();
});
const afterSelect = await page.evaluate(() => ({
    bulk:       document.getElementById('ii-sx-all')?.textContent?.trim(),
    allIcons:   [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].every(b => !!b.querySelector('svg')),
    btnProv:    document.querySelector('#ii-tbody tr[data-idx] .ii-sx')?.dataset?.prov,
    anyEnabled: [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].some(b => !b.disabled),
    exactShown: getComputedStyle(document.getElementById('ii-exact-toggle')).display !== 'none',
}));

// snapshot the New-ISRC fields before any lookup, to prove nothing gets filled
const fieldsBefore = await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-input')].map(i => i.value));

// 3) click the first per-track button → look up that track's ISRC on HDtracks
let bullet = '(skipped)';
if (hasHd) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].find(x => !x.disabled); b && b.click(); });
    bullet = await page.waitForFunction(() => {
        const el = document.querySelector('#ii-tbody tr[data-idx] .ii-lookup');
        const t = el?.textContent?.trim();
        return (t && /✓|⚠|✗/.test(t)) ? t : false;
    }, null, { timeout: 30_000 }).then(h => h.jsonValue()).catch(() => '(timeout)');
}

// 4) RIGHT-CLICK a per-track button → look up ALL tracks on HDtracks
let resolvedRows = 0;
if (hasHd) {
    await page.evaluate(() => {
        const b = document.querySelector('#ii-tbody tr[data-idx] .ii-sx');
        b && b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    resolvedRows = await page.waitForFunction(() => {
        const n = [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-lookup')].filter(el => /✓|⚠/.test(el.textContent || '')).length;
        return n >= 13 ? n : false;
    }, null, { timeout: 45_000 }).then(h => h.jsonValue()).catch(() =>
        page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-lookup')].filter(el => /✓|⚠/.test(el.textContent || '')).length));
}

// fields must be UNCHANGED — the per-track button only searches, never fills
const fieldsAfter = await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-input')].map(i => i.value));
const noFill = JSON.stringify(fieldsBefore) === JSON.stringify(fieldsAfter);

const scriptLog = await page.evaluate(() => document.getElementById('ii-log-out')?.textContent || '');
await context.close();

const hdLines = scriptLog.split('\n').filter(l => /HDtracks/i.test(l));
const perTrack = hdLines.find(l => /HDtracks [A-Z0-9]+ \(#\d+\)/.test(l)) || '';
const isrcInLog = /HDtracks [A-Z]{2}[A-Z0-9]{3}\d{7} \(#\d+\)/.test(perTrack) && /— Daft Punk/.test(perTrack);
const perTrackLines = hdLines.filter(l => /HDtracks [A-Z0-9]+ \(#\d+\)/.test(l)).length;

console.log('\n── Provider menu (from a per-track ▾) ─────────');
console.log('  offered :', providers.join(', '));
console.log('\n── After selecting HDtracks ──────────────────');
console.log('  bulk button (unchanged):', afterSelect.bulk, '   [was:', bulkBefore + ']');
console.log('  ALL per-row icons       :', afterSelect.allIcons, '(dataset.prov=' + afterSelect.btnProv + ')');
console.log('  exact controls shown    :', afterSelect.exactShown);
console.log('  some btn enabled        :', afterSelect.anyEnabled);
console.log('\n── Per-track lookup from HDtracks ────────────');
console.log('  bullet  :', bullet);
console.log('  log line:', perTrack || '(none)');
console.log('  fields unchanged (NO fill):', noFill);
console.log('\n── Right-click → all tracks ──────────────────');
console.log('  rows resolved (✓/⚠):', resolvedRows, '/ 13');
console.log('  per-track log lines:', perTrackLines);
if (pageErrors.length) console.log('\n  PAGE ERRORS:', pageErrors.join(' | '));

console.log('\n── Verdict ───────────────────────────────────');
const menuOk     = providers.includes('SoundExchange') && providers.includes('HDtracks');
const reskinOk   = afterSelect.btnProv === 'hdtracks' && afterSelect.allIcons;
const bulkKept   = afterSelect.bulk === bulkBefore && /SoundExchange/.test(afterSelect.bulk || '');
const exactKept  = afterSelect.exactShown;
const bulletMeta = /✓|⚠/.test(bullet) && /Daft Punk/.test(bullet) && !/already in MB/i.test(bullet);
const lookupOk   = bulletMeta && isrcInLog;
const allOk      = resolvedRows >= 13 && perTrackLines >= 13;
console.log('  menu offers SoundExchange + HDtracks :', menuOk);
console.log('  ALL per-track buttons re-skinned     :', reskinOk);
console.log('  bulk ⟳ SoundExchange button UNCHANGED :', bulkKept);
console.log('  exact controls still shown           :', exactKept);
console.log('  lookup shows full meta (incl. artist):', lookupOk, '·', bullet);
console.log('  per-track button NEVER fills field   :', noFill);
console.log('  right-click looked up ALL 13 tracks  :', allOk, '(' + resolvedRows + ' rows, ' + perTrackLines + ' log lines)');
console.log('  no page errors                       :', pageErrors.length === 0);
const pass = menuOk && reskinOk && bulkKept && exactKept && lookupOk && noFill && allOk && pageErrors.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
