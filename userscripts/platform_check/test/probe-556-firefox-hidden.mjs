// #556 — what actually differs in a genuinely HIDDEN tab, measured in Firefox.
//
// majkinetor: "This is something related to tab being visible or not. Every time
// I rclick and switch to tab and watch it, it works. When I don't switch to tab,
// it doesn't work, it doesnt add link too."
//
// Every previous harness for this ran in Chromium, and backgrounded the tab only
// AFTER it had loaded. Neither matches him: he runs Firefox, and GM_openInTab
// with active:false means the editor boots hidden from its very first byte.
//
// So this probe strips the userscript out of the picture and asks the prior
// question — in a hidden Firefox tab, does MUSICBRAINZ itself get as far as
// rendering the External links field at all? — and only then re-adds us.
//
//   node userscripts/platform_check/test/probe-556-firefox-hidden.mjs [--suspend]
//
// The default run is the control, with the tab in front. `--suspend` is the
// case under test.
//
// ⚠ Playwright will NOT give you a hidden tab. Both browsers are launched with
// backgrounding disabled so that tests are not throttled, and `bringToFront()`
// on another page leaves this one reporting `visibilityState: "visible"` —
// measured, not assumed (the first run of this probe). So a fixture that merely
// unfocuses the tab proves nothing about #556, which is what every earlier
// harness did.
//
// `--suspend` instead reproduces the CONSTRAINTS of a hidden tab, applied to
// MusicBrainz's own code as much as to ours, before any script runs:
//
//   document.hidden        -> true
//   requestAnimationFrame  -> never calls back   (browsers suspend it outright)
//   setTimeout/setInterval -> clamped to >= 1s   (Firefox's background clamp)
//
// Sandbox only.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const LOGS = resolve(HERE, 'logs'); await mkdir(LOGS, { recursive: true });

const B = 'https://test.musicbrainz.org';
if (!/^https:\/\/test\.musicbrainz\.org$/.test(B)) { console.error('sandbox only'); process.exit(2); }

const SUSPEND = process.argv.includes('--suspend');
const BUNDLE = process.argv.includes('--bundle');
const VISIBLE = !SUSPEND;
const say = (...a) => console.log(...a);
const bundleCode = BUNDLE ? await readFile(resolve(HERE, '..', '..', 'string_theory', 'string_theory.user.js'), 'utf8') : '';

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: false, viewport: { width: 1400, height: 900 },
});

// Only the editor tab is suspended; the front tab still needs working timers to
// drive the probe itself.
await ctx.addInitScript(([suspend, bundle]) => {
    if (!/\/edit(\?|#|$)/.test(location.href)) return;
    if (bundle) {
        const store = new Map();
        window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
        window.GM_setValue = (k, v) => store.set(k, v);
        window.GM_deleteValue = k => store.delete(k);
        window.GM_listValues = () => [...store.keys()];
        window.GM_info = { script: { name: 'String Theory', version: 'probe' } };
        window.unsafeWindow = window;
        window.GM_openInTab = () => ({ closed: false, close() {} });
        window.GM_registerMenuCommand = () => {};
        window.GM_addValueChangeListener = () => 0;
        window.GM_removeValueChangeListener = () => {};
        window.GM_setClipboard = () => {};
        window.GM_notification = () => {};
        window.GM_download = () => {};
        window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
        window.GM_xmlhttpRequest = (o) => { try { o && o.onerror && o.onerror({ error: 'probe: network disabled' }); } catch (e) {} return { abort() {} }; };
        window.GM = { xmlHttpRequest: window.GM_xmlhttpRequest, getValue: async (k, d) => window.GM_getValue(k, d), setValue: async (k, v) => window.GM_setValue(k, v), info: window.GM_info };
    }
    if (!suspend) return;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    // Suspended: never fires. The stack of every caller is kept — "who is waiting
    // for a frame that will never come" is the whole question in a hidden tab.
    window.__rafCalls = 0;
    window.__rafStacks = [];
    window.requestAnimationFrame = () => {
        window.__rafCalls++;
        try { if (window.__rafStacks.length < 20) window.__rafStacks.push(new Error('rAF').stack); } catch (e) {}
        return 0;
    };
    window.cancelAnimationFrame = () => {};
    const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
    window.setTimeout = (fn, d, ...a) => st(fn, Math.max(Number(d) || 0, 1000), ...a);
    window.setInterval = (fn, d, ...a) => si(fn, Math.max(Number(d) || 0, 1000), ...a);
}, [SUSPEND, BUNDLE]);

// ── the front tab, and a login if the profile has none ───────────────────────
const front = ctx.pages()[0] || await ctx.newPage();
await front.goto(B, { waitUntil: 'domcontentloaded' });
if (!(await front.locator('a[href*="/logout"], .account').count())) {
    say('profile is not logged in — logging into the sandbox');
    await front.goto(`${B}/login`, { waitUntil: 'domcontentloaded' });
    await front.fill('#id-username', 'majkinetor').catch(() => {});
    await front.fill('#id-password', 'mb').catch(() => {});
    await front.click('button[type=submit]').catch(() => {});
    await front.waitForLoadState('domcontentloaded');
}
const logged = await front.evaluate(() => !!document.querySelector('a[href*="/logout"]'));
say(`logged in: ${logged}`);
if (!logged) { say('cannot continue without a sandbox login'); await ctx.close(); process.exit(3); }

const mbid = await front.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=*&limit=5&fmt=json', { headers: { Accept: 'application/json' } })).json();
    return (j.releases || [])[0]?.id;
});
say(`release: ${B}/release/${mbid}/edit`);

// ── the editor tab: created, backgrounded, and only THEN navigated ───────────
// The order matters. A tab that loads in the foreground and is pushed back
// afterwards has already done its first render; the real one never does.
const tab = await ctx.newPage();
if (!VISIBLE) await front.bringToFront();
await tab.goto(`${B}/release/${mbid}/edit`, { waitUntil: 'domcontentloaded' }).catch(e => say('goto: ' + e.message));

const hidden = await tab.evaluate(() => ({ hidden: document.hidden, state: document.visibilityState }));
say(`tab visibility: ${JSON.stringify(hidden)}   (expected hidden=${SUSPEND})`);
if (hidden.hidden !== SUSPEND) { say('!! the fixture does not reproduce the condition under test'); await ctx.close(); process.exit(4); }
if (BUNDLE) { await tab.addScriptTag({ content: bundleCode }); say(`String Theory loaded (${bundleCode.length} bytes)`); }

// ── watch the editor boot, from inside the tab ───────────────────────────────
// Everything is read with getBoundingClientRect / offsetParent as well as mere
// presence, because a hidden tab can have the node in the DOM and no layout.
const trace = await tab.evaluate(async () => {
    const t0 = Date.now();
    const rows = [];
    // EXACTLY the shipped findAddLinkInput. An earlier version of this probe
    // matched any input whose name contained "url", which the release editor has
    // several of — so it reported "the field appeared" 1s in while the External
    // links section had not rendered at all. A probe that measures the wrong
    // element is worse than no probe.
    const findInput = () => {
        const all = [...document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
        const RE = /^(?:add (?:another )?link|add another url)$/i;
        return all.find(i => RE.test((i.placeholder || '').trim()) && !i.value)
            || all.find(i => RE.test((i.placeholder || '').trim())) || null;
    };
    const snap = () => {
        const step = [...document.querySelectorAll('a, button, li')]
            .find(e => /external links/i.test(e.textContent || '') && (e.offsetParent !== null || e.getClientRects().length));
        const input = findInput();
        return {
            t: Date.now() - t0,
            hidden: document.hidden,
            ready: document.readyState,
            // has Knockout finished binding? MB exposes the editor on the window
            editor: typeof window.MB !== 'undefined' && !!(window.MB.releaseEditor || window.MB.sourceRelease),
            steps: document.querySelectorAll('.tabs li, ul.tabs li').length,
            extStep: !!step,
            extStepRects: step ? step.getClientRects().length : 0,
            input: !!input,
            inputRects: input ? input.getClientRects().length : 0,
            bodyH: document.body ? document.body.getBoundingClientRect().height : 0,
            raf: window.__rafCalls,
        };
    };
    // 120 x 1s: the question is not only "does the field appear" but "how late".
    // Platform Check gives up at 25s, so anything slower than that is the bug
    // even though the page is perfectly functional.
    for (let i = 0; i < 120; i++) {
        rows.push(snap());
        if (rows.at(-1).input) break;
        await new Promise(r => setTimeout(r, 500));
    }
    // now click the External links step the way Platform Check does, and watch
    const step = [...document.querySelectorAll('a, button, li')].find(e => /external links/i.test(e.textContent || ''));
    rows.push({ note: 'clicking External links step', found: !!step, t: Date.now() - t0 });
    step?.click();
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        rows.push(snap());
        if (rows.at(-1).input) break;
    }
    return rows;
});

// print transitions only — 120 identical rows say nothing
let prev = null;
for (const r of trace) {
    const shape = JSON.stringify({ ...r, t: 0, raf: 0, bodyH: 0 });
    if (shape !== prev || r.note) say(JSON.stringify(r));
    prev = shape;
}
say(JSON.stringify(trace.at(-1)));

const name = `probe-556-firefox-${VISIBLE ? 'visible' : 'hidden'}.json`;
await writeFile(resolve(LOGS, name), JSON.stringify({ visible: VISIBLE, mbid, hidden, trace }, null, 1));
const rafStacks = await tab.evaluate(() => window.__rafStacks || []).catch(() => []);
if (rafStacks.length) {
    say(`\n${rafStacks.length} requestAnimationFrame caller(s) left waiting for a frame that never comes:`);
    rafStacks.forEach((s, i) => say(`  [${i}] ${String(s).split('\n').slice(0, 4).join(' | ')}`));
}
say(`\nreport: ${resolve(LOGS, name)}`);
say(trace.some(r => r.input) ? 'RESULT: the External links input DID appear' : 'RESULT: the input never appeared');
await ctx.close();
