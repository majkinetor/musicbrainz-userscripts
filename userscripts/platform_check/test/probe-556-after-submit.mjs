// #556 follow-through — the link now lands in the FORM with String Theory on the
// page and the tab suspended ("inject: 1/1 link(s) landed", 3s), but the e2e's
// read-back says it is not on the release. So: what does the page look like
// after Platform Check presses Enter edit?
//
// Same setup as the e2e, minus the closing of the tab: it stops right after the
// submit and reports the URL it ended on, any error MusicBrainz rendered, and
// whether the relationship is on the release.
//
//   node userscripts/platform_check/test/probe-556-after-submit.mjs
//
// Sandbox only. It DOES submit — that is the point.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const B = 'https://test.musicbrainz.org';
if (!/^https:\/\/test\.musicbrainz\.org$/.test(B)) { console.error('sandbox only'); process.exit(2); }
const say = (...a) => console.log(...a);
// --pc-only loads Platform Check alone instead of the bundle. The difference
// between the two runs is what the other six scripts cost a background add.
const PC_ONLY = process.argv.includes('--pc-only');
const bundle = await readFile(PC_ONLY
    ? resolve(HERE, '..', 'platform_check.user.js')
    : resolve(HERE, '..', '..', 'string_theory', 'string_theory.user.js'), 'utf8');

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: false, viewport: { width: 1400, height: 900 },
});
await ctx.addInitScript(([bgAudio]) => {
    window.__pcBgAudio = bgAudio;
    const store = new Map();
    // --bg-audio turns on the keep-awake experiment (#556). It cannot prove the
    // throttling exemption — Playwright has no genuinely backgrounded tab — but
    // it does prove the code path runs and reports whether the AudioContext is
    // allowed to start at all, which is the half that can be measured.
    if (window.__pcBgAudio) store.set('pc:bg-audio', true);
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
    if (/\/edit(\?|#|$)/.test(location.href)) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
        window.setTimeout = (fn, d, ...a) => st(fn, Math.max(Number(d) || 0, 1000), ...a);
        window.setInterval = (fn, d, ...a) => si(fn, Math.max(Number(d) || 0, 1000), ...a);
    }
}, [process.argv.includes('--bg-audio')]);
// A real userscript manager runs the bundle on EVERY matching document, the
// post-submit landing page included. addScriptTag only reaches the document
// that is loaded when it is called, so the tab-closing leg — where "it takes
// around 30s" is actually measured — was never exercised at all.
await ctx.addInitScript({ content: bundle });

const front = ctx.pages()[0] || await ctx.newPage();
await front.goto(B, { waitUntil: 'domcontentloaded' });
// --mbid picks the release. Without it, the HEAVIEST one a search can find:
// majkinetor's "it takes around 30s" is on a big editor with seven scripts on
// it, and a three-track sandbox release finishes in four seconds no matter what
// is wrong.
const argMbid = (() => { const i = process.argv.indexOf('--mbid'); return i > 0 ? process.argv[i + 1] : null; })();
const mbid = argMbid || await front.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=tracks:%5B40%20TO%20*%5D&limit=25&fmt=json', { headers: { Accept: 'application/json' } })).json();
    const rs = (j.releases || []).filter(r => (r['track-count'] || 0) > 0);
    rs.sort((a, b) => (b['track-count'] || 0) - (a['track-count'] || 0));
    return (rs[0] || (j.releases || [])[0])?.id;
});
const url = `https://www.deezer.com/album/${Date.now() % 100000000}`;
say(`release ${B}/release/${mbid}\nurl     ${url}`);

const seeder = await ctx.newPage();
await seeder.goto(`${B}/release/${mbid}`, { waitUntil: 'domcontentloaded' });
await seeder.evaluate(([id, u]) => localStorage.setItem('pc:pending:' + id, JSON.stringify({ deezer: u })), [mbid, url]);
await seeder.close();

const tab = await ctx.newPage();
const posts = [];
// Timestamps, not just a list: the question "where do the 30 seconds go" is
// answered by the GAPS between the submit POST, its response, and the landing
// page's own request — server time, client sequencing and page load are three
// different problems with three different answers.
const T0 = Date.now();
const at = () => `+${((Date.now() - T0) / 1000).toFixed(1)}s`;
const short = (u) => u.replace(/^https?:\/\/[^/]+/, '').slice(0, 60);
tab.on('request', r => {
    if (/sentry/.test(r.url())) return;
    if (r.method() === 'POST') { posts.push(r.url()); say(`  net ${at()}  POST  ${short(r.url())}`); }
    else if (r.isNavigationRequest()) say(`  net ${at()}  NAV   ${short(r.url())}`);
});
tab.on('response', r => { if (!/sentry/.test(r.url()) && (r.request().method() === 'POST' || r.request().isNavigationRequest())) say(`  net ${at()}  ${r.status()}   ${short(r.url())}`); });
tab.on('console', m => { const t = m.text(); if (/Platform Check|Apollo/.test(t)) say('  console: ' + t.slice(0, 200)); });
tab.on('pageerror', e => say('  PAGEERROR: ' + (e && e.message || e)));
await tab.goto(`${B}/release/${mbid}/edit#pc-autocommit`, { waitUntil: 'domcontentloaded' });
await front.bringToFront();
await tab.waitForTimeout(1200);
// 75s: the point is to watch a SLOW run to its end, so the window has to be
// wider than the 30s being investigated. The bundle is installed via
// addInitScript (see above), not addScriptTag, so it also runs on the page
// MusicBrainz redirects to after the submit — the leg that closes the tab, and
// the only leg no earlier harness ever exercised.
await tab.waitForTimeout(75000);

// The tab closes itself on success, so every read from here on may legitimately
// fail — that IS the pass condition, not an error.
say(`\ntab closed itself: ${tab.isClosed()}`);
if (tab.isClosed()) { say('POSTs: ' + JSON.stringify(posts)); }
say(`landed on: ${tab.isClosed() ? '(closed)' : tab.url()}`);
say(`POSTs: ${JSON.stringify(posts)}`);
const page = tab.isClosed() ? null : await tab.evaluate(() => ({
    title: document.title,
    errors: [...document.querySelectorAll('.error, .field-error, .warning, span.error')].map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 8),
    editNote: (document.querySelector('textarea.edit-note, textarea[name*="edit_note"], #id-edit-note')?.value || '').slice(0, 300),
    submitDisabled: (() => { const b = document.querySelector('#enter-edit'); return b ? b.disabled : null; })(),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
}));
say(JSON.stringify(page, null, 1));

const after = await front.evaluate(async ([id]) => {
    const r = await fetch(`/ws/2/release/${id}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return { err: r.status };
    const j = await r.json();
    return { urls: (j.relations || []).map(x => x.url && x.url.resource) };
}, [mbid]);
say(`\non the release now: ${JSON.stringify(after)}`);
say(after.urls && after.urls.includes(url) ? 'RESULT: LANDED' : 'RESULT: not on the release');
await ctx.close();
