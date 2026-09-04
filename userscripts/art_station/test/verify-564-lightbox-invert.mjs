// #564 (majkinetor: "AS dark gallery mode buttons top right not visible … image
// type (front) hardly visible … and download btn").
//
// The lightbox is an always-dark overlay whose chrome is nothing but <button>s
// authored light-on-dark: Play, ✕, the type chip, Download and its caret.
// kellnerd's dark userstyle applies `filter: var(--invert-value)` to every
// button on the page, so all of them came out near-black on a near-black
// backdrop. Nothing in a computed-style contrast check can see that — the
// filter is applied at PAINT time, so getComputedStyle happily reports the
// light colour we asked for. What it can see is the filter itself.
//
// So this asserts exactly that: with kellnerd's real stylesheet loaded, no
// control in the lightbox is being inverted.
//
//   node userscripts/art_station/test/verify-564-lightbox-invert.mjs [--headed]
//
// Read only: every POST is aborted before it leaves the browser.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const B = 'https://musicbrainz.org';
const REL = '63cc0372-6a7b-4d0e-9da5-9efaf419cd8e';   // has cover art
const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';

let fail = 0;
const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const src = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');
// The raw file is a UserCSS: everything lives inside an `@-moz-document` block
// that Chromium drops wholesale, so injecting it verbatim applies NOTHING and
// the check passes having tested nothing. Unwrap it, exactly as
// dev/ui/verify-contrast-live.mjs does.
const styleCss = await (async () => {
    const raw = await (await fetch(STYLE_URL)).text();
    const i = raw.indexOf('@-moz-document');
    if (i < 0) throw new Error('kellnerd userstyle: no @-moz-document wrapper — format changed');
    return raw.slice(raw.indexOf('{', i) + 1, raw.lastIndexOf('}'));
})();

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 950 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'Art Station', version: 'verify' } };
    window.unsafeWindow = window;
    window.GM_registerMenuCommand = () => {};
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
    window.GM_xmlhttpRequest = (o) => {
        const done = (r) => { try { (o.onload || (() => {}))(r); } catch (e) {} };
        fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
            .then(async (r) => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
            .catch((e) => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
        return { abort() {} };
    };
});

const page = await ctx.newPage();
// fallback(), never continue() — continue() re-issues the request and production
// MusicBrainz answers with an empty document.
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await page.goto(`${B}/release/${REL}/cover-art`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addStyleTag({ content: styleCss });
await page.addScriptTag({ content: src });
await page.waitForTimeout(4000);

// the fixture: the userstyle must actually be inverting buttons, or "nothing is
// inverted" is true for the wrong reason
const pageBtnFilter = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.closest('#as-root, #as-lb, #as-setup'));
    return b ? getComputedStyle(b).filter : null;
});
ck(pageBtnFilter && pageBtnFilter !== 'none',
    `kellnerd's stylesheet is inverting MusicBrainz's own buttons (${pageBtnFilter}) — the fixture reproduces`);

const opened = await page.evaluate(() => {
    const th = document.querySelector('.as-thumb');
    if (!th) return false;
    th.click();
    return !!document.getElementById('as-lb');
});
ck(opened, 'the lightbox opens from a cover thumbnail');
await page.waitForTimeout(1200);

const controls = await page.evaluate(() => {
    const lb = document.getElementById('as-lb');
    if (!lb) return null;
    const one = (sel) => {
        const el = lb.querySelector(sel);
        if (!el) return { sel, missing: true };
        const cs = getComputedStyle(el);
        return { sel, filter: cs.filter, color: cs.color, background: cs.backgroundColor };
    };
    return {
        visible: getComputedStyle(lb).display,
        items: ['.as-lb-play', '.as-lb-x', '.as-lb-type', '.as-lb-dl', '.as-lb-dlcaret', '.as-lb-nav'].map(one),
    };
});
ck(!!controls, 'the lightbox is in the DOM');
const present = (controls?.items || []).filter(i => !i.missing);
ck(present.length >= 4, `measured ${present.length} lightbox control(s) — a check that measures nothing must not pass`);
for (const it of present) ck(it.filter === 'none', `${it.sel} is not inverted (filter: ${it.filter}, color: ${it.color})`);

await mkdir(resolve(HERE, 'shots'), { recursive: true }).catch(() => {});
const shot = resolve(HERE, 'shots', 'verify-564-lightbox.png');
await page.screenshot({ path: shot });
await writeFile(resolve(HERE, 'shots', 'verify-564-lightbox.json'), JSON.stringify(controls, null, 1));
console.log(`\nscreenshot: ${shot}`);

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
