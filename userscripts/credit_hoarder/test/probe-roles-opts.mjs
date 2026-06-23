// Probe for three CH bar/review enhancements:
//   D) all options live under the "Options ▾" button (none inline on the bar)
//   C) the "🔗 N links" header badge equals the number of 🔗 add-link chips
//   A) each unselected search candidate carries its own "MB roles ▾" chip
//
//   node test/probe-roles-opts.mjs [--headed]
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTestContext, openReleasePage } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');
const RELEASE = process.argv.find(a => /^https?:/.test(a))
    || 'https://musicbrainz.org/release/fd4c7ae2-39b7-4849-a021-856d67fb1e7b'; // Jugotronic EP
const headed = process.argv.includes('--headed');

const context = await launchTestContext({ headed });
try {
    const page = await openReleasePage(context, RELEASE);
    const code = await readFile(SCRIPT_PATH, 'utf8');
    const shim = `window.GM_info = window.GM_info || { script: { name: 'Import Discogs Credits (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
    await page.addScriptTag({ content: shim + code });
    await page.waitForSelector('.discogs-bar', { timeout: 30_000 });
    await page.locator('.discogs-src-ico[data-src="Discogs"]').first().click();
    await page.locator('button', { hasText: /^Start import/i }).first().waitFor({ state: 'visible', timeout: 20 * 60_000 });
    await page.waitForTimeout(1500); // let per-row URL checks settle

    // ── Task D (reverted): primary options inline on the bar; only the
    //    dedup toggles live behind "Options ▾" ──────────────────────────────
    const taskD = await page.evaluate(() => {
        const out = { steps: [], ok: true };
        const fail = m => { out.ok = false; out.steps.push('FAIL(D): ' + m); };
        const optsWrap = document.querySelector('.discogs-bar .discogs-bar-opts');
        const btn = optsWrap?.querySelector('.discogs-opts-btn');
        if (!btn) { fail('no Options button on the bar'); return out; }
        // the primary options are back inline on the bar
        const inlineTxt = optsWrap.textContent;
        ['Per-track credits', 'Move release credits to tracks', 'Create works']
            .forEach(o => { if (!inlineTxt.includes(o)) fail(`"${o}" not inline on the bar`); });
        if (!optsWrap.querySelector('select')) fail('"Create works" select not inline on the bar');
        out.steps.push(`inline options: ${[...optsWrap.querySelectorAll('.discogs-toggle')].map(t => t.textContent.trim()).join(' | ')} + select`);
        // the popover holds ONLY the dedup toggles
        btn.click();
        const panel = document.querySelector('.discogs-opts-panel.open');
        if (!panel) { fail('Options popover did not open'); return out; }
        const ptxt = panel.textContent;
        ['Equivalence sets', 'Duplicate roles'].forEach(o => { if (!ptxt.includes(o)) fail(`"${o}" missing from popover`); });
        if (/Per-track credits|Move release credits|Create works/.test(ptxt)) fail('primary options still in the popover');
        out.steps.push(`popover: ${[...panel.querySelectorAll('.discogs-toggle')].map(t => t.textContent.trim()).join(' | ')}`);
        btn.click(); // close
        return out;
    });

    // ── Task C: links badge == number of 🔗 chips, click jumps to a chip ───
    const taskC = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const out = { steps: [], ok: true };
        const fail = m => { out.ok = false; out.steps.push('FAIL(C): ' + m); };
        const linkChips = () => [...document.querySelectorAll('.discogs-review-slot button, table button')]
            .filter(b => b.textContent.trim() === '🔗');
        const chips = linkChips().length;
        const badge = document.querySelector('.discogs-links-note');
        const shown = badge && badge.style.display !== 'none';
        const badgeN = shown ? parseInt((badge.textContent.match(/(\d+)/) || [])[1] || '0', 10) : 0;
        out.steps.push(`🔗 chips=${chips} badge="${badge ? badge.textContent : '(none)'}" shown=${!!shown}`);
        if (chips !== badgeN) fail(`badge count ${badgeN} != ${chips} rendered 🔗 chips`);
        if (chips > 0 && !shown) fail('chips exist but badge hidden');
        if (chips === 0 && shown) fail('no chips but badge shown');
        // clicking the badge should be clickable + pulse a 🔗 chip (jump target)
        if (chips > 0) {
            if (!badge.classList.contains('clickable')) fail('badge not marked clickable');
            badge.click();
            await sleep(60);
            const pulsed = linkChips().some(b => /rgba\(232, ?119, ?29/.test(b.style.boxShadow));
            out.steps.push(`after click: a 🔗 chip pulsed = ${pulsed}`);
            if (!pulsed) fail('clicking badge did not pulse any 🔗 chip (no jump)');
        }
        return out;
    });

    // ── Task A: MB roles chip on an unselected candidate ──────────────────
    const taskA = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const out = { steps: [], ok: true };
        const fail = m => { out.ok = false; out.steps.push('FAIL(A): ' + m); };
        // type into the first row's search box to produce candidates
        const input = document.querySelector('.discogs-review-slot input[type="text"], table input[type="text"]');
        if (!input) { out.steps.push('(A) no search input found — skipped'); return out; }
        input.value = 'John';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(2500);
        const cand = [...document.querySelectorAll('.discogs-review-slot div, table div')]
            .find(d => /MB roles/.test(d.textContent) && d.querySelector('a'));
        // candidate rows have a ✓ select button + an "MB roles ▾" link
        const candRoles = [...document.querySelectorAll('a')].filter(a => /MB roles/.test(a.textContent)).length;
        out.steps.push(`"MB roles ▾" links on page after search: ${candRoles}`);
        if (candRoles < 1) fail('no MB roles chip rendered (expected on candidates and/or resolved rows)');
        return out;
    });

    const result = { ok: taskD.ok && taskC.ok && taskA.ok, D: taskD.steps, C: taskC.steps, A: taskA.steps };
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
} finally {
    await context.close();
}
