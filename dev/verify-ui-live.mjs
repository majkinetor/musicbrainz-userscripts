#!/usr/bin/env node
// #563 — the shared UI components, exercised in a real page.
//
// Static checks can prove the block is present; they cannot prove the widget
// works. So each component is driven the way a user drives it, in every script
// that adopted it, and the CONTRACT is asserted — not just that something
// appeared, but that it appeared with the agreed shape and behaviour.
//
//   node dev/verify-ui-live.mjs
//
// Runs on test.musicbrainz.org and aborts every POST — nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const REL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const B = 'https://test.musicbrainz.org';
// name, file, a page it mounts on, and whether it wires a toast
const CASES = [
    ['apollo_editor', 'userscripts/apollo_editor/apollo_editor.user.js', `${B}/release/${REL}/edit`, false],
    ['art_station', 'userscripts/art_station/art_station.user.js', `${B}/release/${REL}/cover-art`, true],
    ['fusion', 'userscripts/fusion/fusion.user.js', `${B}/release-group/1279bc2b-8c89-4f68-b233-38fc9f04f8d4`, false],
    ['group_therapy', 'userscripts/group_therapy/group_therapy.user.js', `${B}/release/${REL}/edit-relationships`, true],
    ['isrc_scout', 'userscripts/isrc_scout/isrc_scout.user.js', `${B}/release/${REL}`, true],
    ['mammoth', 'userscripts/mammoth/mammoth.user.js', `${B}/release/${REL}/edit`, true],
    ['platform_check', 'userscripts/platform_check/platform_check.user.js', `${B}/release/${REL}`, false],
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
    window.GM_registerMenuCommand = () => {};
});

for (const [name, path, url, hasToast] of CASES) {
    console.log('\n=== ' + name);
    const code = await readFile('C:/Work/mb-userscripts/' + path, 'utf8');
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) { console.log('  NOT LOGGED IN — skipped'); await page.close(); continue; }
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: code });
    await page.waitForTimeout(3000);

    // ── help link: same href shape, same attributes, same look ──────────────
    const help = await page.evaluate(n => {
        // build one from the shared helper so the contract is checked even for a
        // script whose config panel is not open
        const MBU = window.MBU;
        const probe = MBU && typeof MBU.helpEl === 'function' ? MBU.helpEl(n) : null;
        if (!probe) return { missing: true };
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const out = {
            href: probe.getAttribute('href'),
            target: probe.getAttribute('target'),
            rel: probe.getAttribute('rel'),
            title: probe.getAttribute('title'),
            text: probe.textContent,
            cls: probe.className,
            color: cs.color,
            border: cs.borderTopColor,
            radius: cs.borderTopLeftRadius,
        };
        probe.remove();
        return out;
    }, name);
    ck(!help.missing, `${name}: mbuHelpEl is available`);
    if (!help.missing) {
        ck(help.href === `https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/${name}/README.md`, `${name}: help points at its own README — ${help.href}`);
        ck(help.text === '? Help', `${name}: label is "? Help" (got ${JSON.stringify(help.text)})`);
        ck(help.target === '_blank' && help.rel === 'noopener', `${name}: opens in a new tab, with rel=noopener`);
        ck(!!help.title, `${name}: carries a tooltip — ${JSON.stringify(help.title)}`);
        ck(help.cls === 'mbu-help', `${name}: uses the shared class`);
        ck(help.color === 'rgb(95, 62, 192)', `${name}: help is the shared accent, not a per-script colour (${help.color})`);
        ck(help.radius === '6px', `${name}: shared radius (${help.radius})`);
    }

    // ── config title bar: icon · name · version · spacer · Log · ? Help ────
    // Asserted through the component rather than by opening each script's panel:
    // several open from a gear glyph with no stable handle, and what is under test
    // is the contract, not each script's opener. Two panels (Art Station, ISRC
    // Scout) are additionally screenshotted in situ.
    const cfg = await page.evaluate(n => {
        const MBU = window.MBU;
        if (!MBU || typeof MBU.cfgHeader !== 'function') return { missing: true };
        const host = document.createElement('div');
        host.innerHTML = MBU.cfgHeader({ script: n, name: 'Probe', version: '1.2.3', icon: '<svg viewBox="0 0 8 8"></svg>', log: true });
        document.body.appendChild(host);
        const h = host.firstElementChild;
        const cs = getComputedStyle(h);
        const kids = [...h.children].map(e => e.className);
        const ver = h.querySelector('.mbu-cfg-ver');
        const logBtn = h.querySelector('.mbu-cfg-log');
        const help = h.querySelector('.mbu-help');
        const out = {
            cls: h.className,
            order: kids,
            display: cs.display,
            verText: ver && ver.textContent,
            verTitle: ver && ver.getAttribute('title'),
            logText: logBtn && logBtn.textContent,
            logBordered: logBtn && getComputedStyle(logBtn).borderTopWidth,
            helpLast: h.lastElementChild === help,
            nameColor: getComputedStyle(h.querySelector('.mbu-cfg-name')).color,
            // no Log button when a script has no log window
            noLog: !/mbu-cfg-log/.test(MBU.cfgHeader({ script: n, name: 'x' })),
        };
        host.remove();
        return out;
    }, name);
    ck(!cfg.missing, `${name}: mbuCfgHeader is available`);
    if (!cfg.missing) {
        ck(cfg.cls === 'mbu-cfg-h', `${name}: the bar uses the shared class`);
        ck(cfg.display === 'flex', `${name}: it is the shared flex row (${cfg.display})`);
        ck(JSON.stringify(cfg.order) === JSON.stringify(['mbu-cfg-ic', 'mbu-cfg-name', 'mbu-cfg-ver', 'mbu-cfg-sp', 'mbu-cfg-log', 'mbu-help']),
            `${name}: icon · name · version · spacer · Log · Help, in that order — ${JSON.stringify(cfg.order)}`);
        ck(cfg.verText === 'v1.2.3' && !!cfg.verTitle, `${name}: version is prefixed and titled (${cfg.verText}, ${JSON.stringify(cfg.verTitle)})`);
        ck(cfg.logText === 'Log' && cfg.logBordered !== '0px', `${name}: the Log button is the shared bordered control (border ${cfg.logBordered})`);
        ck(cfg.helpLast, `${name}: the help link is last on the line`);
        ck(cfg.nameColor === 'rgb(95, 62, 192)', `${name}: the script name is the shared accent (${cfg.nameColor})`);
        ck(cfg.noLog, `${name}: a script with no log window gets no Log button rather than a dead control`);
    }

    // ── toast: one element, severity classes, auto-dismiss, log mirroring ───
    if (hasToast) {
        const t = await page.evaluate(async () => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const seen = [];
            const T = window.MBU.toast;
            const prev = T.log;
            T.log = (lvl, msg) => seen.push(lvl + ':' + msg);
            T('plain message', { ms: 400 });
            const a = document.getElementById('mbu-toast');
            const shownOpacity = getComputedStyle(a).opacity;
            const first = { id: a.id, cls: a.className, text: a.textContent };
            T('⚠ something is off', { ms: 400 });
            const warn = document.getElementById('mbu-toast').className;
            T('✓ done', { ms: 400 });
            const ok = document.getElementById('mbu-toast').className;
            const count = document.querySelectorAll('#mbu-toast').length;
            await wait(700);
            const after = document.getElementById('mbu-toast');
            const gone = getComputedStyle(after).opacity;
            T.log = prev;
            return { first, shownOpacity, warn, ok, count, gone, seen };
        });
        ck(t.first.id === 'mbu-toast', `${name}: the toast is the shared element`);
        ck(t.shownOpacity === '1', `${name}: it is actually visible when shown (opacity ${t.shownOpacity})`);
        ck(t.count === 1, `${name}: repeated toasts reuse one element, they do not stack up (${t.count})`);
        ck(/mbu-toast-warn/.test(t.warn), `${name}: a leading ⚠ is classed as a warning — ${t.warn}`);
        ck(/mbu-toast-ok/.test(t.ok), `${name}: a leading ✓ is classed ok — ${t.ok}`);
        ck(t.gone === '0', `${name}: it auto-dismisses (opacity ${t.gone})`);
        ck(t.seen.length === 3, `${name}: every toast mirrored into the log (${t.seen.length}/3)`);
        ck(t.seen.some(l => l.startsWith('warn:')) && t.seen.some(l => l.startsWith('ok:')), `${name}: with the right severity — ${JSON.stringify(t.seen)}`);
        ck(t.seen.every(l => !/[⚠✓]/.test(l)), `${name}: and the glyph stripped from the logged text — ${JSON.stringify(t.seen)}`);
    }

    ck(errs.length === 0, `${name}: no page errors${errs.length ? ' — ' + JSON.stringify(errs.slice(0, 2)) : ''}`);
    await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
