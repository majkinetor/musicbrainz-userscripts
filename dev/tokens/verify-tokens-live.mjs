#!/usr/bin/env node
// #562 runtime companion to dev/tokens/verify-tokens.mjs (which is static).
//
// Load each converted script on a real MusicBrainz page and confirm
// (a) it mounts without errors, (b) --mbu-* actually resolves, and (c) NO rule
// it emits references a token that resolves to nothing — the one failure the
// textual no-op proof is blind to: a `var(--mbu-x)` with no definition in scope
// does not fall back to the old colour, it drops the declaration entirely.
//
//   node dev/tokens/verify-tokens-live.mjs
//
// Runs on test.musicbrainz.org and aborts every POST — nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const REL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const RG = '1279bc2b-8c89-4f68-b233-38fc9f04f8d4';
const B = 'https://test.musicbrainz.org';
const CASES = [
    ['art_station', 'userscripts/art_station/art_station.user.js', `${B}/release/${REL}/cover-art`],
    ['platform_check', 'userscripts/platform_check/platform_check.user.js', `${B}/release/${REL}`],
    ['isrc_scout', 'userscripts/isrc_scout/isrc_scout.user.js', `${B}/release/${REL}`],
    ['mammoth', 'userscripts/mammoth/mammoth.user.js', `${B}/release/${REL}/edit`],
    ['apollo_editor', 'userscripts/apollo_editor/apollo_editor.user.js', `${B}/release/${REL}/edit`],
    ['group_therapy', 'userscripts/group_therapy/group_therapy.user.js', `${B}/release/${REL}/edit-relationships`],
    ['fusion', 'userscripts/fusion/fusion.user.js', `${B}/release-group/${RG}`],
    // credit_hoarder mounts its bar on the relationship editor, and only when the
    // release has a linked provider — which the sandbox fixture does not. Its #531
    // path mounts anyway when the source probe FAILS, so the ws lookup is blocked
    // to force the bar up; what is under test is the token block, not the probe.
    ['credit_hoarder', 'userscripts/credit_hoarder/dist/credit_hoarder.user.js', `${B}/release/${REL}/edit-relationships`, /\/ws\//],
];

let fail = 0;
const ck = (c, m) => { console.log((c ? '  ok  : ' : '  FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'x', version: 't' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_xmlhttpRequest = (o) => { try { o.onerror && o.onerror({ status: 0 }); } catch (e) {} };
    window.GM_registerMenuCommand = () => {};
});

for (const [name, path, url, blockRe] of CASES) {
    console.log('\n=== ' + name);
    const code = await readFile('C:/Work/mb-userscripts/' + path, 'utf8');
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route(() => true, r => (r.request().method() === 'POST' || (blockRe && blockRe.test(r.request().url()))) ? r.abort() : r.continue());
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        if (page.url().includes('/login')) { console.log('  NOT LOGGED IN — skipped'); await page.close(); continue; }
        await page.waitForTimeout(1500);
        await page.addScriptTag({ content: code });
        await page.waitForTimeout(3500);

        const r = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            const accent = cs.getPropertyValue('--mbu-accent').trim();
            // every --mbu-* token referenced by any stylesheet on the page must resolve
            const referenced = new Set();
            let sheets = 0;
            for (const sheet of document.styleSheets) {
                let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
                sheets++;
                for (const rule of rules) {
                    const t = rule.cssText || '';
                    for (const m of t.matchAll(/var\(--mbu-([a-z-]+)\)/g)) referenced.add(m[1]);
                }
            }
            const unresolved = [...referenced].filter(n => !cs.getPropertyValue('--mbu-' + n).trim());
            return { accent, sheets, referenced: [...referenced].length, unresolved };
        });
        console.log(`  --mbu-accent = ${JSON.stringify(r.accent)}  ·  ${r.referenced} token(s) referenced across ${r.sheets} readable sheet(s)`);
        ck(!!r.accent, `${name}: the token block reached the page`);
        ck(r.unresolved.length === 0, `${name}: every token referenced by a live rule resolves${r.unresolved.length ? ' (UNRESOLVED: ' + r.unresolved.join(', ') + ')' : ''}`);
        ck(errs.length === 0, `${name}: no page errors${errs.length ? ' — ' + JSON.stringify(errs.slice(0, 2)) : ''}`);
    } catch (e) {
        ck(false, `${name}: threw — ${e.message.slice(0, 120)}`);
    }
    await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
