// Verify #188 setup redesign: the settings panel opens on a compact main view
// (Link confidence + Appearance with icon/name size sliders), with "Order &
// visibility" and "Auth" as sub-views that replace the content (‹ Back returns).
// Screenshots all three views and checks the icon-size slider drives --pc-icon-size.
//
//   node test/verify-188.mjs [--headed]

import { chromium }      from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed      = process.argv.includes('--headed');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '188-' + stamp);
const log = (...a) => console.log('[verify-188]', ...a);

const context = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), {
    headless: !headed, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
await mkdir(LOG_DIR, { recursive: true });
await context.exposeBinding('__gmFetch', async (_s, opts) => {
    try { const resp = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
        return { ok: resp.ok(), status: resp.status(), statusText: resp.statusText(), finalUrl: resp.url(), responseText: await resp.text(), headers: resp.headers() };
    } catch (e) { return { ok: false, status: 0, statusText: 'NETWORK', responseText: '', finalUrl: opts.url, headers: {}, _networkError: true, _error: String(e?.message || e) }; }
});
const userJs = await readFile(SCRIPT_PATH, 'utf8');
const shim = `(() => { const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => { store.set(k, v); };
    window.GM_xmlhttpRequest = function(o){ window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{},data:o.data}).then(r=>{ r._networkError?(o.onerror&&o.onerror(r)):(o.onload&&o.onload(r)); }).catch(()=>o.onerror&&o.onerror({status:0,responseText:''})); };
    window.unsafeWindow = window; window.GM_info = { script: { name: 'platform_check (test)', version: '2026.6.11.4' }, scriptHandler: 'Playwright' };
})();`;

const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#sidebar', { timeout: 30000 });
await page.addScriptTag({ content: shim });
await page.addScriptTag({ content: userJs });
await page.waitForSelector('#mb-token-setup-btn', { timeout: 30000 });

const shot = async (name) => { const c = await page.$('#mb-provider-modal-card'); if (c) await c.screenshot({ path: resolve(LOG_DIR, name) }).catch(e => log('shot failed', e.message)); };

// open settings
await page.click('#mb-token-setup-btn');
await page.waitForSelector('#mb-setup-main', { timeout: 5000 });
await page.waitForTimeout(300);
const mainVisible = await page.evaluate(() => {
    const v = id => { const e = document.getElementById(id); return e && e.offsetParent !== null; };
    return { main: v('mb-setup-main'), order: v('mb-setup-order'), auth: v('mb-setup-auth'),
        hasIconSize: !!document.getElementById('mb-icon-size'), hasNameSize: !!document.getElementById('mb-name-size') };
});
log('on open →', JSON.stringify(mainVisible));
await shot('1-main.png');

// drive the icon-size slider and confirm the CSS var follows
const iconVar = await page.evaluate(() => {
    const el = document.getElementById('mb-icon-size'); el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true }));
    return getComputedStyle(document.getElementById('mb-pc-panel')).getPropertyValue('--pc-icon-size').trim();
});
log('--pc-icon-size after slider→30:', iconVar);

// Order & visibility sub-view
await page.click('#mb-view-order');
await page.waitForTimeout(300);
const orderView = await page.evaluate(() => {
    const v = id => { const e = document.getElementById(id); return e && e.offsetParent !== null; };
    return { main: v('mb-setup-main'), order: v('mb-setup-order'), provRows: document.querySelectorAll('#mb-setup-order .pc-prov-row').length };
});
log('after Order click →', JSON.stringify(orderView));
await shot('2-order.png');

// back, then Auth sub-view
await page.click('#mb-setup-order .pc-setup-back');
await page.waitForTimeout(200);
await page.click('#mb-view-auth');
await page.waitForTimeout(300);
const authView = await page.evaluate(() => {
    const v = id => { const e = document.getElementById(id); return e && e.offsetParent !== null; };
    return { auth: v('mb-setup-auth'), hasBpForm: !!document.getElementById('mb-bp-form') };
});
log('after Auth click →', JSON.stringify(authView));
await shot('3-auth.png');

const pass = mainVisible.main && !mainVisible.order && !mainVisible.auth && mainVisible.hasIconSize
    && iconVar === '30px' && orderView.order && !orderView.main && orderView.provRows > 0
    && authView.auth && authView.hasBpForm && errs.length === 0;
if (errs.length) log('PAGE ERRORS:', errs.join(' | '));
log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);
await context.close();
process.exit(pass ? 0 : 1);
