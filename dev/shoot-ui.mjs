#!/usr/bin/env node
// #564 (majkinetor): "Create script that gives us screenshots on all places that
// need to be checked for correctness. We will run it after each theming
// intervention to compare images. Pictures should be categorized and numbered so
// I can refer to elements that need correction easier."
//
// Every shot is written as
//
//     dev/screens/ui/<NN>-<script>-<surface>[-dark].png
//
// so a shot has a stable number to refer to ("12 is wrong") and the light/dark
// pair of the same surface sits next to it in the listing. The number belongs to
// the SURFACE, not to the run, so #12 is the same thing in every future run —
// which is the point of numbering them at all.
//
//   node dev/shoot-ui.mjs                # light + dark
//   node dev/shoot-ui.mjs --light        # light only
//   node dev/shoot-ui.mjs --only art_station
//
// Runs on test.musicbrainz.org and aborts every POST — nothing is submitted.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'dev', 'screens', 'ui');
await mkdir(OUT, { recursive: true });

const argv = process.argv.slice(2);
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const MODES = argv.includes('--light') ? ['light'] : argv.includes('--dark') ? ['dark'] : ['light', 'dark'];

const B = 'https://test.musicbrainz.org';
const REL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const RG = '1279bc2b-8c89-4f68-b233-38fc9f04f8d4';
// A userstyle, exactly as Stylus would inject one.
const DARK = ':root{--background:#1b1820;--text:#e9e5f2;--border:#463d57}';

// n      stable number — never renumber, append instead
// script which userscript
// name   the surface, in the words the UI uses
// page   where it lives
// open   optional: bring the surface on screen (runs in the page)
// sel    what to photograph; null = viewport
const SHOTS = [
    { n: 1, script: 'art_station', name: 'toolbar', page: `/release/${REL}/cover-art`, sel: '.as-bar' },
    { n: 2, script: 'art_station', name: 'gallery', page: `/release/${REL}/cover-art`, sel: '#as-root' },
    { n: 3, script: 'art_station', name: 'setup', page: `/release/${REL}/cover-art`, sel: '#as-setup',
        open: () => document.getElementById('as-setup-btn')?.click() },
    { n: 4, script: 'art_station', name: 'activity-log', page: `/release/${REL}/cover-art`, sel: '#mbu-logpop',
        open: () => { document.getElementById('as-setup-btn')?.click(); setTimeout(() => document.querySelector('.mbu-cfg-log')?.click(), 250); } },
    { n: 5, script: 'art_station', name: 'launcher-pill', page: `/release/${REL}/cover-art`, sel: '#as-switch-wrap' },

    { n: 10, script: 'apollo_editor', name: 'nav-bar', page: `/release/${REL}/edit`, sel: '#tc-nav-bar, .tc-nav-steps', settle: 9000 },
    { n: 11, script: 'apollo_editor', name: 'toolbar', page: `/release/${REL}/edit`, sel: '#tc-bar', settle: 9000 },
    { n: 12, script: 'apollo_editor', name: 'settings', page: `/release/${REL}/edit`, sel: '#tc-settings',
        settle: 9000,
        open: () => [...document.querySelectorAll('button,span,a,div')].find(e => (e.textContent || '').trim() === '⚙' && e.offsetParent)?.click() },

    { n: 20, script: 'group_therapy', name: 'toolbar', page: `/release/${REL}/edit-relationships`, sel: '.gt-toolbar' },
    { n: 21, script: 'group_therapy', name: 'config', page: `/release/${REL}/edit-relationships`, sel: '.gt-cfg-pop',
        open: () => [...document.querySelectorAll('button,span,a')].find(e => (e.textContent || '').trim() === '⚙' && e.offsetParent)?.click() },

    { n: 30, script: 'isrc_scout', name: 'launcher', page: `/release/${REL}`, sel: '#ii-btn' },
    { n: 31, script: 'isrc_scout', name: 'main-window', page: `/release/${REL}`, sel: '#ii-modal',
        open: () => document.getElementById('ii-btn')?.click() },

    { n: 40, script: 'platform_check', name: 'panel', page: `/release/${REL}`, sel: '#mb-pc-panel' },
    { n: 41, script: 'platform_check', name: 'setup', page: `/release/${REL}`, sel: '#mb-provider-modal-card',
        open: () => [...document.querySelectorAll('#mb-pc-panel *')].find(e => /⚙/.test(e.textContent || '') && e.offsetParent)?.click() },

    { n: 50, script: 'fusion', name: 'launcher', page: `/release-group/${RG}`, sel: '.fs-launch' },
    { n: 51, script: 'fusion', name: 'main-window', page: `/release-group/${RG}`, sel: '.fs-cons',
        open: () => document.querySelector('.fs-launch')?.click() },
    { n: 52, script: 'fusion', name: 'settings', page: `/release-group/${RG}`, sel: '#fs-settings',
        open: () => { document.querySelector('.fs-launch')?.click(); setTimeout(() => document.getElementById('fs-cfg')?.click(), 900); } },

    { n: 60, script: 'mammoth', name: 'config', page: `/release/${REL}/edit`, sel: '.mmth-cfg', settle: 9000,
        open: () => [...document.querySelectorAll('button,span,a,div')].find(e => /🦣|mmth/.test(e.className || '') && e.offsetParent)?.click() },

    { n: 70, script: 'shared', name: 'toast', page: `/release/${REL}/cover-art`, sel: '#mbu-toast',
        open: () => window.MBU?.toast('Shared toast — this is what a message looks like', { ms: 60000 }) },
];

const list = SHOTS.filter(s => !ONLY || s.script === ONLY);
const src = {};
for (const s of new Set(list.map(x => x.script))) {
    if (s === 'shared') { src[s] = await readFile(resolve(ROOT, 'userscripts/art_station/art_station.user.js'), 'utf8'); continue; }
    src[s] = await readFile(resolve(ROOT, `userscripts/${s}/${s}.user.js`), 'utf8');
}

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: true, viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2,
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'x', version: 'shot' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
});

const index = [];
for (const mode of MODES) {
    for (const shot of list) {
        const tag = `${String(shot.n).padStart(2, '0')}-${shot.script}-${shot.name}${mode === 'dark' ? '-dark' : ''}`;
        const page = await ctx.newPage();
        await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());
        let note = '';
        try {
            await page.goto(B + shot.page, { waitUntil: 'domcontentloaded' });
            if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); process.exit(3); }
            await page.waitForTimeout(1200);
            if (mode === 'dark') await page.addStyleTag({ content: DARK });
            await page.addScriptTag({ content: src[shot.script] });
            await page.waitForTimeout(shot.settle || 3000);
            if (shot.open) { await page.evaluate(shot.open); await page.waitForTimeout(1600); }
            const el = shot.sel ? await page.$(shot.sel) : null;
            if (shot.sel && !el) note = 'surface did not appear';
            const file = resolve(OUT, `${tag}.png`);
            let shot_ok = false;
            if (el) {
                // an element can exist and still be unshootable (zero-size, clipped,
                // display:none ancestor) — fall back rather than lose the frame
                try { await el.screenshot({ path: file, timeout: 8000 }); shot_ok = true; }
                catch (e) { note = 'element not shootable, viewport instead'; }
            }
            if (!shot_ok) await page.screenshot({ path: file });
            console.log(`${note ? 'MISS' : ' ok '}  ${tag}${note ? '  (' + note + ')' : ''}`);
        } catch (e) {
            note = String(e.message || e).slice(0, 80);
            console.log(`FAIL  ${tag}  ${note}`);
        }
        index.push({ n: shot.n, mode, script: shot.script, surface: shot.name, file: `${tag}.png`, note });
        await page.close();
    }
}

// A readable index, so a number can be looked up without opening every file.
const rows = index.filter(r => r.mode === 'light').sort((a, b) => a.n - b.n).map(r => {
    const dark = index.find(d => d.n === r.n && d.mode === 'dark');
    const cell = (x) => x ? (x.note ? `⚠ ${x.file}` : `[${x.file}](./${x.file})`) : '—';
    return `| ${r.n} | ${r.script} | ${r.surface} | ${cell(r)} | ${cell(dark)} |`;
});
await writeFile(resolve(OUT, 'README.md'), [
    '# UI screenshots (#564)',
    '',
    'Generated by `node dev/shoot-ui.mjs`. Numbers are stable and belong to the',
    'SURFACE, not the run — #12 is the same thing in every future run, so it can be',
    'referred to across comments. Add new surfaces with new numbers; never renumber.',
    '',
    'Dark shots are taken with a userstyle setting `--background/--text/--border`,',
    'which is what a Stylus theme does.',
    '',
    '| # | script | surface | light | dark |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `_${index.length} shot(s), generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC._`,
].join('\n'));

const missed = index.filter(r => r.note);
console.log(`\n${index.length} shot(s) -> dev/screens/ui/  (${missed.length} problem(s))`);
for (const m of missed) console.log(`  ${m.file}: ${m.note}`);
await ctx.close();
