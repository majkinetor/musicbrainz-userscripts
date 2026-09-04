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
const bundle = await readFile(resolve(HERE, '..', '..', 'string_theory', 'string_theory.user.js'), 'utf8');

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: false, viewport: { width: 1400, height: 900 },
});
await ctx.addInitScript(() => {
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
    if (/\/edit(\?|#|$)/.test(location.href)) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
        window.setTimeout = (fn, d, ...a) => st(fn, Math.max(Number(d) || 0, 1000), ...a);
        window.setInterval = (fn, d, ...a) => si(fn, Math.max(Number(d) || 0, 1000), ...a);
    }
});

const front = ctx.pages()[0] || await ctx.newPage();
await front.goto(B, { waitUntil: 'domcontentloaded' });
const mbid = await front.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=*&limit=30&fmt=json', { headers: { Accept: 'application/json' } })).json();
    return (j.releases || [])[7]?.id;
});
const url = `https://www.deezer.com/album/${Date.now() % 100000000}`;
say(`release ${B}/release/${mbid}\nurl     ${url}`);

const seeder = await ctx.newPage();
await seeder.goto(`${B}/release/${mbid}`, { waitUntil: 'domcontentloaded' });
await seeder.evaluate(([id, u]) => localStorage.setItem('pc:pending:' + id, JSON.stringify({ deezer: u })), [mbid, url]);
await seeder.close();

const tab = await ctx.newPage();
const posts = [];
tab.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
tab.on('console', m => { const t = m.text(); if (/Platform Check|Apollo/.test(t)) say('  console: ' + t.slice(0, 200)); });
tab.on('pageerror', e => say('  PAGEERROR: ' + (e && e.message || e)));
await tab.goto(`${B}/release/${mbid}/edit#pc-autocommit`, { waitUntil: 'domcontentloaded' });
await front.bringToFront();
await tab.waitForTimeout(1200);
await tab.addScriptTag({ content: bundle });
await tab.waitForTimeout(25000);

say(`\nlanded on: ${tab.url()}`);
say(`POSTs: ${JSON.stringify(posts)}`);
const page = await tab.evaluate(() => ({
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
