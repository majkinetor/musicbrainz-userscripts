// #569 (chaban-mb) — measure the idle DOM thrash, and attribute it.
//
// "~75.6 DOM mutations per second on an idle tab […] 100% of all idle mutations
// originate from an interaction loop between Apollo Editor, mbuTheme and
// Mammoth."
//
// This reproduces that measurement so the fixes can be judged against numbers
// rather than against the plausibility of the diff. It loads the release editor
// with String Theory on it, lets everything settle, then watches a fixed idle
// window and reports:
//
//   * total mutations, by type and by target, from a MutationObserver — the same
//     thing DevTools is reacting to;
//   * every call that PRODUCED one, with its stack, by wrapping the mutating DOM
//     APIs before any script runs;
//   * how many of those calls were REDUNDANT — classList.add of a token already
//     present, toggle to the state it is already in, setAttribute with the value
//     it already has. That number is exactly what the proposed guards remove, so
//     it is the honest ceiling on what they can buy.
//
//   node dev/ui/measure-569-idle-mutations.mjs [--secs 5] [--settle 9]
//                                              [--url /release/add] [--none]
//
// --none loads no userscripts at all: the floor, i.e. what MusicBrainz's own
// page does while idle. Without that number "75/sec" has nothing to be 75 times
// worse than.
//
// Read only — every POST is aborted. Sandbox by default.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'reports'); await mkdir(OUT, { recursive: true });

const argv = process.argv.slice(2);
const num = (flag, dflt) => { const i = argv.indexOf(flag); const v = i < 0 ? NaN : Number(argv[i + 1]); return Number.isFinite(v) ? v : dflt; };
const str = (flag, dflt) => { const i = argv.indexOf(flag); return i < 0 ? dflt : argv[i + 1]; };
const SECS = num('--secs', 5);
const SETTLE = num('--settle', 9);
const PATH = str('--url', '/release/add');
const NONE = argv.includes('--none');
// --userstyle loads kellnerd's real dark theme. It matters: mbuTheme only builds
// its probe element when a --background variable EXISTS, so without a userstyle
// the whole probe/<html> childList half of #569 never fires and the measurement
// misses the loop chaban actually reported.
const USERSTYLE = argv.includes('--userstyle');
const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';
const B = str('--base', 'https://test.musicbrainz.org');
const say = (...a) => console.log(...a);

const bundle = NONE ? '' : await readFile(resolve(HERE, '..', '..', 'userscripts', 'string_theory', 'string_theory.user.js'), 'utf8');

// ── the instrumentation, installed before any page script ───────────────────
// Chromium, deliberately: chaban's report is a Blink one, and the key premise —
// `classList.add(token)` dispatching an attributes record even when the token is
// already there — is what makes the redundant-call count meaningful.
const probeInit = () => {
    const W = window;
    W.__m = { calls: [], records: [], redundant: 0, on: false };
    const note = (api, target, detail, redundant) => {
        if (!W.__m.on) return;
        if (redundant) W.__m.redundant++;
        let stack = '';
        try { stack = (new Error().stack || '').split('\n').slice(2, 6).join(' | '); } catch (e) {}
        W.__m.calls.push({ t: Math.round(performance.now()), api, target, detail, redundant: !!stack && !!redundant, stack });
    };
    const name = (el) => {
        try {
            if (!el || !el.tagName) return String(el);
            const id = el.id ? '#' + el.id : '';
            const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
            return el.tagName + id + cls;
        } catch (e) { return '?'; }
    };

    const tl = DOMTokenList.prototype;
    const add = tl.add, rem = tl.remove, tog = tl.toggle;
    tl.add = function (...t) {
        const el = this._el_ || null;
        const redundant = t.every(x => this.contains(x));
        note('classList.add', name(this.ownerElementGuess), t.join(' '), redundant);
        return add.apply(this, t);
    };
    tl.remove = function (...t) {
        const redundant = t.every(x => !this.contains(x));
        note('classList.remove', name(this.ownerElementGuess), t.join(' '), redundant);
        return rem.apply(this, t);
    };
    tl.toggle = function (t, force) {
        const redundant = force !== undefined && this.contains(t) === !!force;
        note('classList.toggle', name(this.ownerElementGuess), t + '=' + force, redundant);
        return tog.call(this, t, force);
    };
    // DOMTokenList has no public back-reference to its element, so give it one.
    const cl = Object.getOwnPropertyDescriptor(Element.prototype, 'classList');
    Object.defineProperty(Element.prototype, 'classList', {
        configurable: true,
        get() { const l = cl.get.call(this); try { l.ownerElementGuess = this; } catch (e) {} return l; },
    });

    const setA = Element.prototype.setAttribute, remA = Element.prototype.removeAttribute;
    Element.prototype.setAttribute = function (n, v) {
        note('setAttribute', name(this), n + '=' + v, this.getAttribute(n) === String(v));
        return setA.call(this, n, v);
    };
    Element.prototype.removeAttribute = function (n) {
        note('removeAttribute', name(this), n, !this.hasAttribute(n));
        return remA.call(this, n);
    };
    const app = Node.prototype.appendChild, ins = Node.prototype.insertBefore, del = Node.prototype.removeChild, rm = Element.prototype.remove;
    Node.prototype.appendChild = function (c) { note('appendChild', name(this), name(c), false); return app.call(this, c); };
    Node.prototype.insertBefore = function (c, r) { note('insertBefore', name(this), name(c), false); return ins.call(this, c, r); };
    Node.prototype.removeChild = function (c) { note('removeChild', name(this), name(c), false); return del.call(this, c); };
    Element.prototype.remove = function () { note('remove', name(this.parentElement), name(this), false); return rm.call(this); };
    const tc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(Node.prototype, 'textContent', {
        configurable: true,
        get() { return tc.get.call(this); },
        set(v) { note('textContent', name(this), String(v).slice(0, 30), tc.get.call(this) === String(v)); return tc.set.call(this, v); },
    });

    // and the ground truth: what the browser actually dispatched
    W.__mo = new MutationObserver(recs => {
        if (!W.__m.on) return;
        for (const r of recs) {
            W.__m.records.push({
                type: r.type,
                target: name(r.target),
                attr: r.attributeName || null,
                added: r.addedNodes.length,
                removed: r.removedNodes.length,
            });
        }
    });
    W.__mstart = () => {
        W.__m.calls.length = 0; W.__m.records.length = 0; W.__m.redundant = 0;
        W.__mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
        W.__m.on = true;
    };
    W.__mstop = () => { W.__m.on = false; W.__mo.disconnect(); return W.__m; };
};

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: false, viewport: { width: 1500, height: 950 },
});
await ctx.addInitScript(probeInit);
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'String Theory', version: 'measure' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    window.GM_addValueChangeListener = () => 0;
    window.GM_removeValueChangeListener = () => {};
    window.GM_setClipboard = () => {};
    window.GM_notification = () => {};
    window.GM_download = () => {};
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
    window.GM_xmlhttpRequest = (o) => { try { o && o.onerror && o.onerror({ error: 'measure: network disabled' }); } catch (e) {} return { abort() {} }; };
    window.GM = { xmlHttpRequest: window.GM_xmlhttpRequest, getValue: async (k, d) => window.GM_getValue(k, d), setValue: async (k, v) => window.GM_setValue(k, v), info: window.GM_info };
});
if (!NONE) await ctx.addInitScript({ content: bundle });

const page = await ctx.newPage();
// fallback(), never continue() — continue() re-issues the request and MusicBrainz
// answers navigations with an empty document.
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await page.goto(B + PATH, { waitUntil: 'domcontentloaded' });
if (USERSTYLE) {
    // unwrapped: Chromium drops the @-moz-document block whole, and the check
    // then measures a page with no userstyle on it while believing otherwise
    const raw = await (await fetch(STYLE_URL)).text();
    const i = raw.indexOf('@-moz-document');
    if (i < 0) throw new Error('kellnerd userstyle: no @-moz-document wrapper — format changed');
    await page.addStyleTag({ content: raw.slice(raw.indexOf('{', i) + 1, raw.lastIndexOf('}')) });
}
if (page.url().includes('/login')) { say('NOT LOGGED IN'); await ctx.close(); process.exit(3); }

say(`${B}${PATH}   scripts: ${NONE ? 'none' : 'String Theory'}   userstyle: ${USERSTYLE}   settle ${SETTLE}s, then ${SECS}s idle\n`);
await page.waitForTimeout(SETTLE * 1000);
await page.evaluate(() => window.__mstart());
await page.waitForTimeout(SECS * 1000);
const m = await page.evaluate(() => {
    const s = window.__mstop();
    return { calls: s.calls, records: s.records, redundant: s.redundant };
});

// ── report ──────────────────────────────────────────────────────────────────
const tally = (arr, key) => {
    const t = new Map();
    for (const x of arr) { const k = key(x); t.set(k, (t.get(k) || 0) + 1); }
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
};
const rate = (n) => (n / SECS).toFixed(1);

say(`MUTATION RECORDS (what the browser dispatched): ${m.records.length}  =  ${rate(m.records.length)}/sec  (${Math.round(m.records.length / SECS * 60)}/min)`);
for (const [k, v] of tally(m.records, r => `${r.type}${r.attr ? '[' + r.attr + ']' : ''}  on  ${r.target}`).slice(0, 14)) say(`   ${String(v).padStart(4)}  ${k}`);

const rootRecs = m.records.filter(r => /^HTML/.test(r.target));
const bodyRecs = m.records.filter(r => /^BODY/.test(r.target));
say(`\n   root <html> records: ${rootRecs.length}   <body> records: ${bodyRecs.length}`);

say(`\nMUTATING CALLS: ${m.calls.length}   of which REDUNDANT (what the proposed guards remove): ${m.redundant}`);
for (const [k, v] of tally(m.calls, c => `${c.api}(${c.detail})  on  ${c.target}`).slice(0, 14)) say(`   ${String(v).padStart(4)}  ${k}`);

// The first frame is always this file's own wrapper, so report the first one
// that is not — otherwise every call site reads "at tl.toggle", which is true
// and useless.
const MINE = /\b(tl\.(add|remove|toggle)|Element\.(set|remove)Attribute|Node\.(appendChild|insertBefore|removeChild)|Element\.remove|set \[as textContent\])\b/;
const site = (c) => ((c.stack || '').split(' | ').map(s => s.trim()).find(s => s && !MINE.test(s)) || '(no stack)');
say('\nBY CALL SITE');
for (const [k, v] of tally(m.calls, site).slice(0, 16)) say(`   ${String(v).padStart(4)}  ${k}`);

const stamp = (NONE ? 'none' : 'bundle') + (USERSTYLE ? '-userstyle' : '');
const file = resolve(OUT, `569-idle-${stamp}.json`);
await writeFile(file, JSON.stringify({ base: B, path: PATH, secs: SECS, scripts: stamp, ...m }, null, 1));
say(`\nreport: ${file}`);
await ctx.close();
