// Probe: clicking the active source icon mid-run cancels the preflight/review and
// restores the full source picker (no reload needed). Covers both phases + re-entry.
import { launchTestContext, openReleasePage, injectUserscript, clickImport, snapshotRelationships, getCapturedLog } from './lib/browser.js';

const REL = 'https://musicbrainz.org/release/3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4'; // The Lost Tapes (Discogs)
const log = (...a) => console.log('[cancel]', ...a);

let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// Read the toolbar's cancel-relevant state.
const barState = (page) => page.evaluate(() => {
    const bar = document.querySelector('.discogs-bar');
    if (!bar) return null;
    const icons = [...bar.querySelectorAll('.discogs-src-ico')];
    return {
        importing:  bar.classList.contains('is-importing'),
        reviewing:  bar.classList.contains('is-reviewing'),
        pinned:     bar.classList.contains('is-pinned'),
        iconCount:  icons.length,
        visible:    icons.filter(b => b.style.display !== 'none').length,
        activeMark: icons.filter(b => b.classList.contains('importing')).length,
        status:     document.querySelector('.discogs-bar-status')?.textContent.trim() || '',
        startBtn:   [...bar.querySelectorAll('button')].some(b => /Start import/i.test(b.textContent)),
    };
});
const clickActive = (page) => page.evaluate(() => {
    const b = document.querySelector('.discogs-bar .discogs-src-ico.importing');
    if (b) b.click();
    return !!b;
});
const waitFor = (page, fn) => page.waitForFunction(fn, null, { timeout: 4 * 60_000, polling: 200 });

const ctx = await launchTestContext({ headed: false });
try {
    const page = await openReleasePage(ctx, REL);
    await injectUserscript(page);
    const initial = await barState(page);
    log('initial:', JSON.stringify(initial));
    check(initial.iconCount >= 1 && initial.visible === initial.iconCount, 'all source icons visible before any run');
    const N = initial.iconCount;

    // ── Phase 1: cancel during PREFLIGHT ─────────────────────────────────────
    // is-importing is set synchronously in startImport; the Discogs fetch + preflight
    // run async after, so clicking the active icon right away cancels the preflight.
    await clickImport(page);
    await waitFor(page, () => document.querySelector('.discogs-bar')?.classList.contains('is-importing'));
    const during1 = await barState(page);
    log('during preflight:', JSON.stringify(during1));
    check(during1.importing && during1.visible === 1 && during1.activeMark === 1, 'preflight: only the active source icon shows');
    check(await clickActive(page), 'preflight: clicked the active source icon (cancel)');
    await waitFor(page, () => !document.querySelector('.discogs-bar')?.classList.contains('is-importing'));
    const after1 = await barState(page);
    log('after preflight-cancel:', JSON.stringify(after1));
    check(!after1.importing && !after1.reviewing && !after1.pinned, 'preflight-cancel: run chrome cleared');
    check(after1.visible === N && after1.activeMark === 0, 'preflight-cancel: full source picker restored');
    check(/cancel/i.test(after1.status), 'preflight-cancel: status says cancelled');

    // ── Phase 2: cancel during REVIEW ────────────────────────────────────────
    await clickImport(page);
    await waitFor(page, () => document.querySelector('.discogs-bar')?.classList.contains('is-reviewing'));
    const during2 = await barState(page);
    log('during review:', JSON.stringify(during2));
    check(during2.reviewing && during2.startBtn, 'review: Start-import button is mounted');
    const before = (await snapshotRelationships(page)).staged.length;
    check(await clickActive(page), 'review: clicked the active source icon (cancel)');
    await waitFor(page, () => !document.querySelector('.discogs-bar')?.classList.contains('is-reviewing'));
    const after2 = await barState(page);
    log('after review-cancel:', JSON.stringify(after2));
    check(!after2.importing && !after2.reviewing && !after2.pinned, 'review-cancel: run chrome cleared');
    check(after2.visible === N && after2.activeMark === 0 && !after2.startBtn, 'review-cancel: full source picker restored, Start button gone');
    const afterStaged = (await snapshotRelationships(page)).staged.length;
    check(afterStaged === before, `review-cancel: nothing dispatched (staged ${before} → ${afterStaged})`);

    // ── Phase 3: re-entry after cancel ───────────────────────────────────────
    await clickImport(page);
    const reEntered = await waitFor(page, () => document.querySelector('.discogs-bar')?.classList.contains('is-importing')).then(() => true).catch(() => false);
    check(reEntered, 're-entry: a fresh run starts after a cancel');
    await clickActive(page).catch(() => {});   // tidy up

    const errs = getCapturedLog(page);
    const pageErrs = (page.__captured?.pageErrors || []).length;
    check(pageErrs === 0, 'no page errors');
    if (pageErrs) console.log(errs);
} finally {
    await ctx.close();
}
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
process.exit(fail ? 1 : 0);
