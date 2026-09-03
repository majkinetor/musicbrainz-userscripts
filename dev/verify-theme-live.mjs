#!/usr/bin/env node
// #564: does the theme actually REACH every control in our windows?
//
// The shared token layer only covers what a rule points at. A control nobody
// styled takes the browser default — white — and a control in a container that
// is not in the shared ROOTS list never gets the default either. Both were real:
// with a dark userstyle applied, Art Station's setup panel and Fusion's settings
// showed white rectangles, which is what majkinetor reported.
//
// This is not something you can check by reading the CSS. MusicBrainz's own
// stylesheet is cross-origin — invisible to `document.styleSheets` — and it
// carries `input{background:#fff}`, which outranks a zero-specificity default
// and repaints the field white after all our work. The only reliable question is
// the rendered one: with a dark theme on, is anything in our windows still light?
//
//   node dev/verify-theme-live.mjs             all scripts
//   node dev/verify-theme-live.mjs --only fusion
//
// Runs against test.musicbrainz.org and aborts every POST.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const B = 'https://test.musicbrainz.org';
const REL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const RG = '1279bc2b-8c89-4f68-b233-38fc9f04f8d4';
// A dark userstyle, as a real one behaves: it sets the variables AND paints the
// page. Setting only the variables was a bad model of the thing being tested —
// MusicBrainz stayed white underneath, so our windows inherited black text and
// the theme detector correctly concluded the page was light. Every check that
// depends on knowing which theme is on was therefore measuring the wrong world.
const DARK = ':root{--background:#1b1820;--text:#e9e5f2;--border:#463d57}'
    + 'html,body{background:#1b1820;color:#e9e5f2}'
    + 'a{color:#b9a7f0}';

// name, page, how to bring the settings/config surface on screen, settle ms
const CASES = [
    ['art_station', `/release/${REL}/cover-art`, () => document.getElementById('as-setup-btn')?.click(), 3500],
    ['apollo_editor', `/release/${REL}/edit`, () => [...document.querySelectorAll('button,span,a,div')].find(e => (e.textContent || '').trim() === '⚙' && e.offsetParent)?.click(), 9000],
    ['group_therapy', `/release/${REL}/edit-relationships`, () => [...document.querySelectorAll('button,span,a')].find(e => (e.textContent || '').trim() === '⚙' && e.offsetParent)?.click(), 3500],
    ['isrc_scout', `/release/${REL}`, () => document.getElementById('ii-btn')?.click(), 3500],
    ['platform_check', `/release/${REL}`, () => [...document.querySelectorAll('#mb-pc-panel *')].find(e => /⚙/.test(e.textContent || '') && e.offsetParent)?.click(), 3500],
    ['fusion', `/release-group/${RG}`, () => { document.querySelector('.fs-launch')?.click(); setTimeout(() => document.getElementById('fs-cfg')?.click(), 900); }, 3500],
    ['mammoth', `/release/${REL}/edit`, null, 9000],
];

// Known and intended exceptions, by the class/id nearest the control:
//
//  · a range slider paints its own track and thumb from the UA theme; a
//    background here squares it off, so it gets accent-color instead;
//  · `tc-nav-on` is a class Apollo puts on MUSICBRAINZ's own release-editor
//    fields to mark them for its navigation. Those are MB's inputs on MB's page
//    and repainting them is not ours to do.
const ALLOWED = [/^\.as-size$/, /^\.tc-nav-on$/];

const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
let fail = 0;
const ck = (c, m) => { console.log((c ? '  ok  : ' : '  FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: true, viewport: { width: 1600, height: 1000 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'x', version: 'theme-check' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
});

for (const [name, path, open, settle] of CASES.filter(c => !ONLY || c[0] === ONLY)) {
    console.log('\n=== ' + name);
    const src = await readFile(`C:/Work/mb-userscripts/userscripts/${name}/${name}.user.js`, 'utf8');
    const page = await ctx.newPage();
    await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());
    await page.goto(B + path, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) { console.log('  NOT LOGGED IN — skipped'); await page.close(); continue; }
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: DARK });
    await page.addScriptTag({ content: src });
    await page.waitForTimeout(settle);
    if (open) { await page.evaluate(open); await page.waitForTimeout(1800); }

    const found = await page.evaluate(() => {
        // "ours" = the nearest ancestor carrying one of our own name prefixes.
        const PFX = /^(as|tc|gt|ii|fs|mmth|pc|mbu|mb-pc|mb-provider|discogs)-/;
        const owner = (el) => {
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                if (n.id && PFX.test(n.id)) return '#' + n.id;
                for (const c of n.classList || []) if (PFX.test(c)) return '.' + c;
            }
            return null;
        };
        const light = (bg) => {
            const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(bg);
            return m ? (+m[1] + +m[2] + +m[3]) / 3 > 170 : false;
        };
        const out = {};
        for (const el of document.querySelectorAll('input,select,textarea,button')) {
            const t = (el.type || '').toLowerCase();
            if (t === 'checkbox' || t === 'radio' || t === 'hidden') continue;
            if (!el.offsetParent) continue;
            // Clipped to 1x1 is the standard visually-hidden trick, and it is
            // usually applied to a CONTAINER — Apollo does exactly that to
            // MusicBrainz's own step nav, whose buttons keep their normal size
            // inside a 1px box. So check the ancestors, not just the control:
            // nobody can see the colour of a control nobody can see.
            let hidden = false;
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const r = n.getBoundingClientRect();
                if (r.width < 4 || r.height < 4) { hidden = true; break; }
            }
            if (hidden) continue;
            const o = owner(el);
            if (!o) continue;
            if (!light(getComputedStyle(el).backgroundColor)) continue;
            out[o] = (out[o] || 0) + 1;
        }
        return out;
    });

    const bad = Object.entries(found).filter(([k]) => !ALLOWED.some(re => re.test(k)));
    const seen = Object.keys(found).length;
    ck(!bad.length, `${name}: every control in its windows follows the dark theme` +
        (bad.length ? ` — STILL LIGHT: ${JSON.stringify(bad)} (add the container to ROOTS in dev/ui-components.mjs)` : ` (${seen} allowed exception(s))`));
    await page.close();
}

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
