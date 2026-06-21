// Smoke test for #271 — the title-derived "Titles" source.
// Loads the built userscript on a real MB release-edit page (Victor Davies —
// Remixes, whose track titles carry named remixes in several forms) and checks:
//   1. the import bar mounts (unconditionally),
//   2. a "Titles" import source is offered,
//   3. running it derives remixer credits from the titles (logged + review table),
//   4. no page errors.
// Run: node test/probe-271.mjs
import { launchTestContext, openReleasePage, injectUserscript, getCapturedLog } from './lib/browser.js';

const REL = 'https://musicbrainz.org/release/2cf775d5-70e1-445c-bc12-eef89b488ab1';

const ctx = await launchTestContext({ headed: false });
let page;
try {
    page = await openReleasePage(ctx, REL);
    await injectUserscript(page);
    console.log('✓ import bar mounted');

    // Find every import-source label (main button + submenu items).
    const labels = await page.evaluate(() => {
        const out = [];
        const main = document.querySelector('.discogs-import-btn:not(.discogs-import-caret)');
        if (main) out.push('MAIN:' + main.textContent.trim());
        document.querySelectorAll('.discogs-log-menu button').forEach(b => out.push('MENU:' + b.textContent.trim()));
        return out;
    });
    console.log('  sources:', JSON.stringify(labels));
    const hasTitles = labels.some(l => /Titles/i.test(l));
    console.log(hasTitles ? '✓ "Titles" source offered' : '✗ "Titles" source MISSING');

    // Run the Titles source: click its menu item if present, else the main button.
    await page.evaluate(() => {
        const caret = document.querySelector('.discogs-import-caret');
        if (caret) caret.click();
    });
    await page.waitForTimeout(150);
    const ran = await page.evaluate(() => {
        const item = [...document.querySelectorAll('.discogs-log-menu button')].find(b => /Titles/i.test(b.textContent));
        if (item) { item.click(); return 'menu'; }
        const main = document.querySelector('.discogs-import-btn:not(.discogs-import-caret)');
        if (main && /Titles/i.test(main.textContent)) { main.click(); return 'main'; }
        return 'none';
    });
    console.log('  triggered via:', ran);

    // Wait for the derivation log line.
    await page.waitForFunction(() => /Derived\s+\d+\s+remixer/i.test(document.querySelector('.discogs-output')?.textContent || ''), { timeout: 20_000 }).catch(() => {});
    const derivedLine = await page.evaluate(() => {
        const txt = document.querySelector('.discogs-output')?.textContent || '';
        const m = txt.match(/Derived\s+\d+\s+remixer credit\(s\) from \d+ track title\(s\)/i);
        return m ? m[0] : '(derivation line not found)';
    });
    console.log('  log:', derivedLine);

    // Wait for the review table to render (means the derived artists entered preflight).
    const reviewed = await page.waitForSelector('.discogs-review-slot table, .discogs-review-slot .discogs-review', { timeout: 30_000 }).then(() => true).catch(() => false);
    console.log(reviewed ? '✓ review table rendered for derived remixers' : '… review table did not render within timeout');

    const rows = reviewed ? await page.evaluate(() => {
        const names = [];
        document.querySelectorAll('.discogs-review-slot tr').forEach(tr => {
            const n = tr.querySelector('td')?.textContent?.trim();
            if (n) names.push(n);
        });
        return names.slice(0, 20);
    }) : [];
    if (rows.length) console.log('  review rows (first 20):', JSON.stringify(rows));

    await page.screenshot({ path: 'test/logs/probe-271.png', fullPage: true }).catch(() => {});

    const cap = getCapturedLog(page);
    const errs = (page.__captured?.pageErrors || []);
    console.log(errs.length ? `✗ ${errs.length} page error(s):\n` + errs.map(e => '   ' + e.name + ': ' + e.text).join('\n') : '✓ no page errors');
} catch (e) {
    console.error('PROBE FAILED:', e.message);
} finally {
    await ctx.close();
}
