// #556 — which script makes the "Add another link" field disappear?
//
// The e2e reproduced a clean failure with String Theory loaded … and then the
// VISIBLE control failed identically. So the trigger is not visibility at all:
// with the bundle on the page, MusicBrainz's External links field never turns
// up. This probe finds out which member script does it, by loading the editor
// with one script at a time and reporting what the External links area contains.
//
//   node userscripts/platform_check/test/probe-556-who-eats-the-field.mjs
//
// Read-only: nothing is seeded, nothing is submitted. Sandbox only.
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
const say = (...a) => console.log(...a);

const U = resolve(HERE, '..', '..');
const CASES = [
    ['(none)', null],
    ['platform_check', resolve(U, 'platform_check', 'platform_check.user.js')],
    ['apollo_editor', resolve(U, 'apollo_editor', 'apollo_editor.user.js')],
    ['art_station', resolve(U, 'art_station', 'art_station.user.js')],
    ['credit_hoarder', resolve(U, 'credit_hoarder', 'dist', 'credit_hoarder.user.js')],
    ['group_therapy', resolve(U, 'group_therapy', 'group_therapy.user.js')],
    ['isrc_scout', resolve(U, 'isrc_scout', 'isrc_scout.user.js')],
    ['mammoth', resolve(U, 'mammoth', 'mammoth.user.js')],
    ['string_theory', resolve(U, 'string_theory', 'string_theory.user.js')],
];

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: false, viewport: { width: 1400, height: 900 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'probe', version: '0' } };
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
});

const front = ctx.pages()[0] || await ctx.newPage();
await front.goto(B, { waitUntil: 'domcontentloaded' });
const mbid = await front.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=*&limit=5&fmt=json', { headers: { Accept: 'application/json' } })).json();
    return (j.releases || [])[0]?.id;
});
say(`release: ${B}/release/${mbid}/edit\n`);

// The same look each time: is the field there, and if not, what IS in the
// External links area? "Not found" on its own says nothing about why.
const inspect = () => ({
    field: (() => {
        const all = [...document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
        const RE = /^(?:add (?:another )?link|add another url)$/i;
        return !!(all.find(i => RE.test((i.placeholder || '').trim())));
    })(),
    placeholders: [...new Set([...document.querySelectorAll('input')].map(i => (i.placeholder || '').trim()).filter(Boolean))].slice(0, 24),
    extLinkRows: document.querySelectorAll('tr.external-link-item').length,
    extLinksTable: !!document.querySelector('#external-links-editor, .external-links-editor, table.external-links'),
    legends: [...document.querySelectorAll('legend, h2, h3')].map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 16),
    inputs: document.querySelectorAll('input').length,
    bodyH: Math.round(document.body?.getBoundingClientRect().height || 0),
});

const out = [];
for (const [name, path] of CASES) {
    const code = path ? await readFile(path, 'utf8').catch(() => null) : '';
    if (code === null) { say(`${name.padEnd(16)} SKIP (no file)`); continue; }
    const tab = await ctx.newPage();
    const errs = [];
    tab.on('pageerror', e => errs.push(String(e && e.message || e)));
    await tab.goto(`${B}/release/${mbid}/edit`, { waitUntil: 'domcontentloaded' });
    if (code) await tab.addScriptTag({ content: code }).catch(e => errs.push('addScriptTag: ' + e.message));
    // 20s is generous: the passing runs found the field in about 3.
    let r = null;
    for (let i = 0; i < 20; i++) {
        r = await tab.evaluate(inspect);
        if (r.field) break;
        await tab.waitForTimeout(1000);
    }
    r.errors = errs.slice(0, 4);
    r.script = name;
    out.push(r);
    say(`${name.padEnd(16)} field=${r.field ? 'YES' : 'no '}  extLinkRows=${r.extLinkRows}  inputs=${r.inputs}  bodyH=${r.bodyH}${r.errors.length ? '  ERR: ' + r.errors[0].slice(0, 90) : ''}`);
    if (!r.field) say(`                 placeholders: ${JSON.stringify(r.placeholders)}`);
    await tab.close();
}

await writeFile(resolve(LOGS, 'probe-556-who-eats-the-field.json'), JSON.stringify({ mbid, out }, null, 1));
say(`\nreport: ${resolve(LOGS, 'probe-556-who-eats-the-field.json')}`);
await ctx.close();
