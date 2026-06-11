// Visual check: MB circle marker gap + left mismatch-bar gutter (#188 follow-up).
// Forces marker / barcode-diff / format-diff classes on several rows and screenshots.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed = process.argv.includes('--headed');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', 'marker-' + stamp);
const log = (...a) => console.log('[verify-marker]', ...a);

const context = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), {
    headless: !headed, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
await mkdir(LOG_DIR, { recursive: true });
await context.exposeBinding('__gmFetch', async (_s, opts) => {
    try { const r = await context.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, data: opts.data, maxRedirects: 20 });
        return { ok: r.ok(), status: r.status(), statusText: r.statusText(), finalUrl: r.url(), responseText: await r.text(), headers: r.headers() };
    } catch (e) { return { ok: false, status: 0, responseText: '', finalUrl: opts.url, headers: {}, _networkError: true }; }
});
const userJs = await readFile(SCRIPT_PATH, 'utf8');
const shim = `(() => { const store = new Map([['pc:show-icons',true],['pc:mb-marker','circle']]);
  window.GM_getValue=(k,d)=>store.has(k)?store.get(k):d; window.GM_setValue=(k,v)=>{store.set(k,v);};
  window.GM_xmlhttpRequest=function(o){window.__gmFetch({method:o.method||'GET',url:o.url,headers:o.headers||{},data:o.data}).then(r=>{r._networkError?(o.onerror&&o.onerror(r)):(o.onload&&o.onload(r));}).catch(()=>o.onerror&&o.onerror({status:0,responseText:''}));};
  window.unsafeWindow=window; window.GM_info={script:{name:'pc',version:'test'},scriptHandler:'Playwright'};})();`;

const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#sidebar', { timeout: 30000 });
await page.addScriptTag({ content: shim });
await page.addScriptTag({ content: userJs });
await page.waitForSelector('#mb-pc-panel', { timeout: 30000 });
await page.waitForFunction(() => /All scans completed/.test(document.getElementById('mb-finder-log-panel')?.innerText || ''), null, { timeout: 90000 }).catch(() => log('scans did not finish'));
await page.waitForTimeout(800);

// force representative states so the marker + bars are visible together
await page.evaluate(() => {
  const set = (p, cls) => { const r = document.getElementById('row-' + p); if (r) cls.forEach(c => r.classList.add(c)); };
  set('spotify', ['pc-inmb']);                       // marker only
  set('apple',   ['pc-inmb', 'pc-barcode-diff']);    // marker + amber bar
  set('tidal',   ['pc-format-diff']);                // violet bar
  set('deezer',  ['pc-barcode-diff', 'pc-format-diff']); // both bars
  set('discogs', ['pc-inmb', 'pc-format-diff']);     // marker + violet bar
});
await page.waitForTimeout(300);

// measure the gap: icon left vs row left, and outline offset present
const geom = await page.evaluate(() => {
  const r = document.getElementById('row-apple'); const ico = r.querySelector('.pc-plat-ico');
  const rb = r.getBoundingClientRect(), ib = ico.getBoundingClientRect();
  return { iconLeftMinusRowLeft: Math.round(ib.left - rb.left), outline: getComputedStyle(ico).outlineWidth + ' @ ' + getComputedStyle(ico).outlineOffset };
});
log('apple: icon.left - row.left =', geom.iconLeftMinusRowLeft, 'px | marker outline', geom.outline);

const panel = await page.$('#mb-pc-panel');
if (panel) await panel.screenshot({ path: resolve(LOG_DIR, 'panel.png') }).catch(e => log('shot failed', e.message));
log('pageerrors:', errs.length, '— artifacts in', LOG_DIR);
await context.close();
