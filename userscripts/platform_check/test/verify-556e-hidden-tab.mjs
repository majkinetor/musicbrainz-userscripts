// #556 (majkinetor) — "It never happens when not invoked as background task […]
// when it fails, the links are NEVER added. I will try latest but very sceptical."
//
// He was right to be. My previous explanation (a 10s budget too short for a slow
// editor boot) does not survive either observation: a slow boot would hit the
// foreground path too, and it would fail partially, not all-or-nothing.
//
// pcWaitFor polled with requestAnimationFrame:
//
//   if (Date.now() - start >= timeoutMs) return finish(null);
//   requestAnimationFrame(poll);
//
// A background-add tab is opened with GM_openInTab(..., { active:false }) — HIDDEN.
// Browsers suspend rAF in hidden tabs (measured: 14x throttling even for a merely
// unfocused tab, and full suspension for a background one), while the deadline,
// being wall-clock, keeps advancing. So the wait either never progresses at all,
// or resumes when the tab is finally looked at, sees the elapsed time already past
// the timeout, and gives up on its FIRST tick — regardless of the DOM. That is
// all-or-nothing, and it cannot happen in the foreground. Both of his points.
//
// This drives pcWaitFor directly with rAF suspended and document.hidden forced,
// which is what a background tab does, and asserts the wait survives it.
// No MusicBrainz page and no network: the defect is in the helper, so that is
// where it is measured.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// Lift pcWaitFor out of the userscript rather than reimplementing it, so the
// thing under test is the shipped source.
const src = code.slice(code.indexOf('function pcWaitFor'));
const fnSrc = src.slice(0, src.indexOf('\n}\n') + 3);
if (!/function pcWaitFor/.test(fnSrc)) { console.log('could not extract pcWaitFor'); process.exit(2); }

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('about:blank');

const run = async (source) => page.evaluate(async (fn) => {
    // A hidden background tab: document.hidden true, rAF never fires.
    const realRaf = window.requestAnimationFrame;
    let rafCalls = 0;
    window.requestAnimationFrame = () => { rafCalls++; return 0; };   // registered, never invoked
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });

    // eslint-disable-next-line no-new-func
    const pcWaitFor = new Function(fn + '; return pcWaitFor;')();

    // The element the wait is looking for turns up 1.2s in — comfortably inside a
    // 3s budget for a tab that is actually running.
    let ready = false;
    setTimeout(() => { ready = true; document.body.appendChild(document.createElement('hr')); }, 1200);

    const t0 = Date.now();
    const got = await pcWaitFor(() => (ready ? 'FOUND' : null), 3000);
    const ms = Date.now() - t0;

    delete document.hidden; delete document.visibilityState;
    window.requestAnimationFrame = realRaf;
    return { got, ms, rafCalls };
}, fnSrc);

const r = await run();
console.log('hidden-tab wait: ' + JSON.stringify(r));
ck(r.got === 'FOUND', `#556: the wait still resolves in a hidden tab (got ${JSON.stringify(r.got)})`);
ck(r.ms < 3000, `and resolves when the element appears, not at the deadline (${r.ms}ms)`);
ck(r.rafCalls === 0, 'and does not depend on requestAnimationFrame at all — it never fires while hidden');

// ── the deadline must not be charged for time the tab was hidden ────────────
const budget = await page.evaluate(async (fn) => {
    const realRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    let hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    // eslint-disable-next-line no-new-func
    const pcWaitFor = new Function(fn + '; return pcWaitFor;')();
    // Hidden for 2.5s with a 1s budget — under a wall-clock deadline this is
    // already spent. Then the tab is shown and the element turns up 400ms later.
    let ready = false;
    setTimeout(() => { hidden = false; }, 2500);
    setTimeout(() => { ready = true; document.body.appendChild(document.createElement('hr')); }, 2900);
    const t0 = Date.now();
    const got = await pcWaitFor(() => (ready ? 'FOUND' : null), 1000);
    const ms = Date.now() - t0;
    delete document.hidden;
    window.requestAnimationFrame = realRaf;
    return { got, ms };
}, fnSrc);
console.log('hidden-then-shown: ' + JSON.stringify(budget));
ck(budget.got === 'FOUND', `#556: hidden time is not charged against the budget — the wait survives being backgrounded (got ${JSON.stringify(budget.got)})`);
ck(budget.ms > 2500, `and it really did wait through the hidden period (${budget.ms}ms)`);

// ── it must still time out when the tab IS visible and nothing turns up ─────
const times = await page.evaluate(async (fn) => {
    // eslint-disable-next-line no-new-func
    const pcWaitFor = new Function(fn + '; return pcWaitFor;')();
    const t0 = Date.now();
    const got = await pcWaitFor(() => null, 800);
    return { got, ms: Date.now() - t0 };
}, fnSrc);
console.log('visible timeout: ' + JSON.stringify(times));
ck(times.got === null, 'a visible tab that finds nothing still times out — the guard is not simply disabled');
ck(times.ms >= 800 && times.ms < 4000, `and times out on schedule (${times.ms}ms for an 800ms budget)`);

// ── A/B: the same fixture against the shipped build ────────────────────────
const PREV = process.env.PC_PREV;
if (PREV) {
    const prevCode = await readFile(PREV, 'utf8');
    const psrc = prevCode.slice(prevCode.indexOf('function pcWaitFor'));
    const pfn = psrc.slice(0, psrc.indexOf('\n}\n') + 3);
    // The discriminating case is hidden-THEN-SHOWN, which is majkinetor's
    // "returning a bit later". While hidden, the old loop's rAF poll is frozen
    // but its wall-clock deadline is not. The moment the tab is looked at, rAF
    // resumes, the first poll finds the element still absent (the editor is only
    // now getting cycles), sees the deadline long past, and gives up instantly.
    //
    // Note the two builds agree when the element simply appears while hidden —
    // pcWaitFor's MutationObserver catches that, and it is why background add
    // works most of the time. This case is the gap it does not cover.
    const before = await page.evaluate(async (fn) => {
        const realRaf = window.requestAnimationFrame;
        let rafCalls = 0, hidden = true;
        // hidden: rAF is registered and never delivered, exactly as a background
        // tab does. Visible: it runs again.
        // A hidden tab does not DROP the pending animation frame, it DEFERS it and
        // delivers it when the tab is shown again. Modelling that faithfully is the
        // whole point: dropping it would make the old loop simply never resume,
        // which is a different (and, as it turns out, non-discriminating) bug.
        let queued = [];
        window.requestAnimationFrame = (cb) => {
            if (hidden) { rafCalls++; queued.push(cb); return 0; }
            return realRaf(cb);
        };
        const flush = () => {
            if (hidden) return;
            const q = queued; queued = [];
            for (const cb of q) realRaf(cb);
        };
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        // eslint-disable-next-line no-new-func
        const pcWaitFor = new Function(fn + '; return pcWaitFor;')();
        let ready = false;
        setTimeout(() => { hidden = false; flush(); }, 2500);
        setTimeout(() => { ready = true; document.body.appendChild(document.createElement('hr')); }, 2900);
        const t0 = Date.now();
        const got = await Promise.race([
            pcWaitFor(() => (ready ? 'FOUND' : null), 1000),
            new Promise(r => setTimeout(() => r('NEVER SETTLED'), 8000)),
        ]);
        delete document.hidden;
        window.requestAnimationFrame = realRaf;
        return { got, ms: Date.now() - t0, rafCalls };
    }, pfn);
    console.log('\n########## PREVIOUS BUILD ##########');
    console.log('hidden-then-shown: ' + JSON.stringify(before));
    ck(before.got !== 'FOUND', `the fixture reproduces on the shipped build (got ${JSON.stringify(before.got)} where this build gets FOUND)`);
    ck(before.rafCalls > 0, `and for the reason claimed — ${before.rafCalls} animation frame(s) requested that a hidden tab never delivers`);
} else {
    console.log('\n(set PC_PREV=<path to previous platform_check.user.js> for the A/B)');
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
