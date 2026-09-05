// #569 — the one change in this fix that COULD have broken something.
//
// chaban's suggestion was to "cache resolved --background to avoid appending and
// removing probe <span> elements". That would stop the thrash and break theme
// detection: the first read happens at document-start, Stylus and friends inject
// after us (the comment in mbuTheme says a one-shot read is wrong about half the
// time), and a cached first reading freezes the theme at whatever was true
// before the userstyle arrived. Every dark-theme bug in #564 was a variant of
// exactly that.
//
// So the probe element is made PERSISTENT instead — created once, never removed,
// re-read live on every call. This proves the "re-read live" half, which is the
// half that matters:
//
//   1. bare page          -> theme light, no data-mbu-seed
//   2. userstyle injected -> theme flips to dark and the seed is adopted
//   3. userstyle removed  -> it flips back
//
// and that the probe is a single shared node rather than one per script.
//
//   node dev/ui/verify-569-theme-still-tracks.mjs
//
// Read only. Sandbox.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const B = 'https://test.musicbrainz.org';
const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';
let fail = 0;
const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const bundle = await readFile(resolve(HERE, '..', '..', 'userscripts', 'string_theory', 'string_theory.user.js'), 'utf8');
const styleCss = await (async () => {
    const raw = await (await fetch(STYLE_URL)).text();
    const i = raw.indexOf('@-moz-document');
    if (i < 0) throw new Error('kellnerd userstyle: no @-moz-document wrapper — format changed');
    return raw.slice(raw.indexOf('{', i) + 1, raw.lastIndexOf('}'));
})();

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: true, viewport: { width: 1400, height: 900 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'String Theory', version: 'verify' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    window.GM_addValueChangeListener = () => 0;
    window.GM_removeValueChangeListener = () => {};
    window.GM_setClipboard = () => {};
    window.GM_notification = () => {};
    window.GM_download = () => {};
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
    window.GM_xmlhttpRequest = (o) => { try { o && o.onerror && o.onerror({ error: 'verify: network disabled' }); } catch (e) {} return { abort() {} }; };
    window.GM = { xmlHttpRequest: window.GM_xmlhttpRequest, getValue: async (k, d) => window.GM_getValue(k, d), setValue: async (k, v) => window.GM_setValue(k, v), info: window.GM_info };
});
await ctx.addInitScript({ content: bundle });

const page = await ctx.newPage();
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await page.goto(`${B}/release/add`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);

const state = () => page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-mbu-theme'),
    seed: document.documentElement.getAttribute('data-mbu-seed'),
    probes: document.querySelectorAll('#mbu-theme-probe').length,
    probeParent: document.getElementById('mbu-theme-probe')?.parentElement?.tagName || null,
    bg: getComputedStyle(document.body).backgroundColor,
}));

// 1. bare
const a = await state();
console.log('  bare:      ' + JSON.stringify(a));
ck(a.theme === 'light', `a bare page is detected as light (got ${a.theme})`);
ck(!a.seed, 'and no --background is adopted, because there is none');

// 2. userstyle arrives AFTER everything has settled — the case a cached reading
//    would get wrong, and the reason the probe re-reads live
const tag = await page.evaluate((css) => {
    const s = document.createElement('style');
    s.id = 'verify-569-userstyle';
    s.textContent = css;
    document.head.appendChild(s);
    return true;
}, styleCss);
ck(tag, 'kellnerd\'s stylesheet injected after load');
await page.waitForTimeout(2500);
const b = await state();
console.log('  userstyle: ' + JSON.stringify(b));
ck(b.theme === 'dark', `the theme flips to dark when the userstyle lands (got ${b.theme})`);
ck(b.seed === 'theme', `and its own shades are adopted (data-mbu-seed=${b.seed})`);

// 3. and back again
await page.evaluate(() => document.getElementById('verify-569-userstyle')?.remove());
await page.waitForTimeout(2500);
const c = await state();
console.log('  removed:   ' + JSON.stringify(c));
ck(c.theme === 'light', `and back to light when it goes away (got ${c.theme})`);
ck(!c.seed, 'seed dropped with it');

// 4. --background stays DEFINED but changes value. This is the case a cached
//    reading gets wrong and the "remove the stylesheet" case above does not:
//    with no stylesheet there is no --background at all, so the whole branch is
//    skipped and a stale cache is never consulted. A userstyle that switches
//    palette — Stylus toggling light/dark, or one with a prefers-color-scheme
//    query — keeps the variable and changes the answer. Measured: chaban's
//    "cache resolved --background" fails exactly here and nowhere else.
await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'verify-569-switch';
    s.textContent = ':root{--background:#ffffff}html,body{background:#ffffff !important;color:#111}';
    document.head.appendChild(s);
});
await page.waitForTimeout(2500);
const d1 = await state();
console.log('  own light: ' + JSON.stringify(d1));
ck(d1.theme === 'light' && d1.seed === 'theme', `a userstyle with a LIGHT --background is light and adopted (${d1.theme}/${d1.seed})`);

await page.evaluate(() => {
    const s = document.getElementById('verify-569-switch');
    s.textContent = ':root{--background:#222222}html,body{background:#222222 !important;color:#eee}';
});
await page.waitForTimeout(2500);
const d2 = await state();
console.log('  own dark:  ' + JSON.stringify(d2));
ck(d2.theme === 'dark' && d2.seed === 'theme', `and follows when that SAME userstyle switches to dark (${d2.theme}/${d2.seed})`);
await page.evaluate(() => document.getElementById('verify-569-switch')?.remove());
await page.waitForTimeout(1500);

// 5. the probe itself
ck(b.probes === 1, `exactly ONE probe element for all seven scripts (found ${b.probes})`);
ck(b.probeParent === 'BODY', `and it lives in <body>, not as a stray child of <html> (parent: ${b.probeParent})`);

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
