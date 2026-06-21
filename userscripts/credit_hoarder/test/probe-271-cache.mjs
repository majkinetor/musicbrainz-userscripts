// #271 cache verification: a derived remixer resolved in one session is reused
// (from IDB) on the next, instead of forcing a re-match. Runs the Titles source
// on Victor Davies — Remixes twice in the same profile (shared IndexedDB):
//   pass 1 — resolve, then read entity_cache for `titles-remix/<mbid>/…` rows;
//   pass 2 — reload and confirm those entities come back resolved "via cache".
// Run: node test/probe-271-cache.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launchTestContext, openReleasePage } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');
const REL = 'https://musicbrainz.org/release/2cf775d5-70e1-445c-bc12-eef89b488ab1';

async function inject(page) {
    const code = await readFile(SCRIPT, 'utf8');
    const shim = `window.GM_info = window.GM_info || { script: { name: 'CH (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
    await page.addScriptTag({ content: shim + code });
    await page.waitForSelector('.discogs-bar .discogs-import-btn', { timeout: 15_000 });
}
async function runTitles(page) {
    await page.evaluate(() => { document.querySelector('.discogs-import-caret')?.click(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
        const item = [...document.querySelectorAll('.discogs-log-menu button')].find(b => /Titles/i.test(b.textContent));
        if (item) item.click();
    });
    // wait for preflight to finish ("Preflight done")
    await page.waitForFunction(() => /Preflight done/i.test(document.querySelector('.discogs-output')?.textContent || ''), { timeout: 60_000 }).catch(() => {});
}
const readCacheKeys = page => page.evaluate(() => new Promise(res => {
    const req = indexedDB.open('mblink', 2);
    req.onsuccess = () => {
        const db = req.result;
        const all = db.transaction(['entity_cache'], 'readonly').objectStore('entity_cache').getAll();
        all.onsuccess = () => res(all.result.filter(r => String(r.discogs_id).startsWith('titles-remix/')).map(r => ({ k: r.discogs_id, mbid: r.mbid, via: r.resolvedVia })));
        all.onerror = () => res([]);
    };
    req.onerror = () => res([]);
}));

const ctx = await launchTestContext({ headed: false });
try {
    // ── Pass 1 ──────────────────────────────────────────────────────────────
    let page = await openReleasePage(ctx, REL);
    await inject(page);
    await runTitles(page);
    await page.waitForTimeout(500);
    const after1 = await readCacheKeys(page);
    const resolved1 = after1.filter(r => r.mbid);
    console.log(`pass 1 — titles-remix cache rows: ${after1.length} (with MBID: ${resolved1.length})`);
    console.log('  sample:', JSON.stringify(after1.slice(0, 4)));
    await page.close();

    // ── Pass 2 (reload, same profile → same IndexedDB) ──────────────────────
    page = await openReleasePage(ctx, REL);
    await inject(page);
    await runTitles(page);
    await page.waitForTimeout(500);
    const viaCache = await page.evaluate(() => {
        // Count review rows whose resolution badge says it came from cache.
        const txt = document.querySelector('.discogs-output')?.textContent || '';
        return (txt.match(/\(cache\)/gi) || []).length;
    });
    console.log(`pass 2 — resolutions surfaced "(cache)": ${viaCache}`);
    console.log(viaCache > 0 ? '  ✓ derived remixers reused from cache across sessions' : '  … no cache hits surfaced (check log wording)');
    await page.close();
} catch (e) {
    console.error('CACHE PROBE FAILED:', e.message);
} finally {
    await ctx.close();
}
