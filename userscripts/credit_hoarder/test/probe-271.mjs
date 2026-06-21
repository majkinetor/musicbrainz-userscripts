// Smoke test for #271 — the title-derived "Titles" source and its load-time
// gating. Loads the built userscript on real MB release-edit pages and checks:
//   A) a release whose titles name remixers → bar mounts, "Titles" source
//      offered, running it derives the remixers (no page errors);
//   B) a release whose titles name NO remixer → the "Titles" source is NOT
//      offered (and, with no provider, the bar stays unmounted).
// Run: node test/probe-271.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launchTestContext, openReleasePage } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');

// Soft inject: don't hard-fail if the bar never mounts (that's a valid outcome).
async function softInject(page) {
    const code = await readFile(SCRIPT, 'utf8');
    const shim = `window.GM_info = window.GM_info || { script: { name: 'CH (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
    await page.addScriptTag({ content: shim + code });
    return page.waitForSelector('.discogs-bar .discogs-import-btn', { timeout: 12_000 }).then(() => true).catch(() => false);
}

async function sources(page) {
    return page.evaluate(() => {
        const out = [];
        const main = document.querySelector('.discogs-import-btn:not(.discogs-import-caret)');
        if (main) out.push('MAIN:' + main.textContent.trim());
        document.querySelectorAll('.discogs-log-menu button').forEach(b => out.push('MENU:' + b.textContent.trim()));
        return out;
    });
}

const ctx = await launchTestContext({ headed: false });
try {
    // ── Case A: Victor Davies — Remixes (named remixes, several forms) ──────
    {
        const page = await openReleasePage(ctx, 'https://musicbrainz.org/release/2cf775d5-70e1-445c-bc12-eef89b488ab1');
        const mounted = await softInject(page);
        const srcs = mounted ? await sources(page) : [];
        const hasTitles = srcs.some(l => /Titles/i.test(l));
        console.log(`A) remix release — bar mounted: ${mounted}, Titles offered: ${hasTitles}`);
        console.log('   sources:', JSON.stringify(srcs));
        if (mounted && hasTitles) {
            await page.evaluate(() => { document.querySelector('.discogs-import-caret')?.click(); });
            await page.waitForTimeout(150);
            await page.evaluate(() => {
                const item = [...document.querySelectorAll('.discogs-log-menu button')].find(b => /Titles/i.test(b.textContent));
                if (item) item.click();
                else { const main = document.querySelector('.discogs-import-btn:not(.discogs-import-caret)'); if (main && /Titles/i.test(main.textContent)) main.click(); }
            });
            await page.waitForFunction(() => /Derived\s+\d+\s+remixer/i.test(document.querySelector('.discogs-output')?.textContent || ''), { timeout: 20_000 }).catch(() => {});
            const line = await page.evaluate(() => (document.querySelector('.discogs-output')?.textContent || '').match(/Derived\s+\d+\s+remixer credit\(s\) from \d+ track title\(s\)/i)?.[0] || '(none)');
            console.log('   log:', line);
            const reviewed = await page.waitForSelector('.discogs-review-slot table', { timeout: 30_000 }).then(() => true).catch(() => false);
            console.log('   review table rendered:', reviewed);
            const errs = page.__captured?.pageErrors || [];
            console.log(errs.length ? `   ✗ ${errs.length} page error(s)` : '   ✓ no page errors');
        }
        await page.close();
    }

    // ── Case B: a release whose titles name NO remixer ──────────────────────
    // SONIC THE HEDGEHOG REMIXED — titles are "(From Sonic …)", no remix keyword.
    {
        const page = await openReleasePage(ctx, 'https://musicbrainz.org/release/a68cc31d-34c2-414c-81c7-9e2c4b47c86b');
        const mounted = await softInject(page);
        const srcs = mounted ? await sources(page) : [];
        const hasTitles = srcs.some(l => /Titles/i.test(l));
        console.log(`B) no-remix release — bar mounted: ${mounted} (provider may still mount it), Titles offered: ${hasTitles}`);
        console.log('   sources:', JSON.stringify(srcs));
        console.log(hasTitles ? '   ✗ Titles offered when it should NOT be' : '   ✓ Titles correctly NOT offered');
        await page.close();
    }
} catch (e) {
    console.error('PROBE FAILED:', e.message);
} finally {
    await ctx.close();
}
