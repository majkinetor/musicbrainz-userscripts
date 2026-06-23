// #273 probe — background-create placeholder.
// Drives a release through preflight to the review table (does NOT click Start
// import, so no real edits), then for one row:
//   1. stubs GM_openInTab (so the bg-create branch runs without opening a tab),
//   2. right-clicks the "+" create chip,
//   3. asserts the ".ch-creating" placeholder appears + candidates hidden +
//      the row collapsed to ~the resolved height,
//   4. posts a fake `artist-created` back over a sibling BroadcastChannel,
//   5. asserts the placeholder is gone, the resolved "✓ name" row is in, and
//      the row height DIDN'T jump between creating and resolved.
//
// NB: the shared `injectUserscript`/`clickImport` helpers still look for the
// pre-#272 `.discogs-import-btn`; the bar is now "Import credits:" + per-source
// icon buttons, so we inject + drive the Discogs source icon ourselves.
//
//   node test/probe-273.mjs            # headless
//   node test/probe-273.mjs --headed
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTestContext, openReleasePage } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');

// Jugotronic EP (state-empty small) — fresh credits, unresolved rows with "+".
const RELEASE = process.argv.find(a => /^https?:/.test(a))
    || 'https://musicbrainz.org/release/fd4c7ae2-39b7-4849-a021-856d67fb1e7b';
const headed = process.argv.includes('--headed');

const context = await launchTestContext({ headed });
try {
    const page = await openReleasePage(context, RELEASE);

    // inject (replicates injectUserscript's shim, minus the stale-selector wait)
    const code = await readFile(SCRIPT_PATH, 'utf8');
    const shim = `window.GM_info = window.GM_info || { script: { name: 'Import Discogs Credits (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
    await page.addScriptTag({ content: shim + code });
    await page.waitForSelector('.discogs-bar', { timeout: 30_000 });

    // start the Discogs import via the source icon
    await page.locator('.discogs-src-ico[data-src="Discogs"]').first().click();

    // review table is up when the "Start import" button appears
    await page.locator('button', { hasText: /^Start import/i }).first()
        .waitFor({ state: 'visible', timeout: 20 * 60_000 });

    const result = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const out = { steps: [], ok: true };
        const fail = m => { out.ok = false; out.steps.push('FAIL: ' + m); };
        const note = m => out.steps.push(m);

        // 1. stub GM_openInTab (capture url; closeable handle)
        window.__bgUrls = [];
        window.GM_openInTab = (url) => { window.__bgUrls.push(url); return { close() { window.__closed = true; } }; };

        const createBtn = [...document.querySelectorAll('table tr button')]
            .find(b => b.textContent.trim() === '+');
        if (!createBtn) { fail('no "+" create chip found'); return out; }
        const tr = createBtn.closest('tr');
        const hBefore = tr.getBoundingClientRect().height;
        note('height before:   ' + hBefore.toFixed(1));

        // 2. right-click → background create
        createBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await sleep(60);

        // 3. placeholder + candidates hidden + collapsed height
        const ph = tr.querySelector('.ch-creating');
        if (!ph) { fail('.ch-creating placeholder not shown'); return out; }
        if (!/Creating .* in the background/i.test(ph.textContent)) fail('placeholder text: ' + ph.textContent);
        const anyHidden = [...tr.querySelectorAll('div')].some(d => d.style.display === 'none');
        if (!anyHidden) fail('candidate list not hidden during create');
        const hCreating = tr.getBoundingClientRect().height;
        note('height creating: ' + hCreating.toFixed(1));
        if (!window.__bgUrls.length) { fail('GM_openInTab not called'); return out; }
        const bgUrl = window.__bgUrls[0] || '';
        const m = bgUrl.match(/ch-autocommit=([^&]+)/);
        const pendingKey = m ? decodeURIComponent(m[1]) : '';
        note('pendingKey:      ' + (pendingKey || '(none)'));
        if (!pendingKey) { fail('no ch-autocommit pendingKey in bg url'); return out; }

        // 4. post a fake artist-created back (sibling BroadcastChannel delivers to the module's)
        const ch = new BroadcastChannel('discogs-importer-artist');
        ch.postMessage({ type: 'artist-created', id: '11111111-2222-3333-4444-555555555555',
                         name: 'Probe Artist', disambiguation: '', resourceUrl: pendingKey });
        await sleep(300);

        // 5. placeholder gone, resolved row in, no height jump
        if (tr.querySelector('.ch-creating')) fail('placeholder still present after postback');
        const resolved = [...tr.querySelectorAll('a')].some(a => /Probe Artist/.test(a.textContent));
        if (!resolved) fail('resolved "Probe Artist" row not found after postback');
        const hResolved = tr.getBoundingClientRect().height;
        note('height resolved: ' + hResolved.toFixed(1));
        const jump = Math.abs(hResolved - hCreating);
        note('creating→resolved jump: ' + jump.toFixed(1) + 'px');
        if (jump > 8) fail('row reflowed by ' + jump.toFixed(1) + 'px between creating and resolved (expected ~0)');

        return out;
    }).catch(e => ({ ok: false, steps: ['evaluate threw: ' + e.message] }));

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
} finally {
    await context.close();
}
