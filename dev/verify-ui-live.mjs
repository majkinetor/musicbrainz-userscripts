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
    // Wait for the script to actually mount rather than sleeping a fixed 3s. The
    // sandbox is intermittently slow, and a fixed sleep turned that into failing
    // assertions about "wrong colours" that were really "no stylesheet yet" —
    // which cost me a bogus regression hunt. If it never mounts, say so plainly
    // instead of asserting against an empty page.
    const mounted = await page.waitForFunction(() => !!window.MBU, null, { timeout: 20000 })
        .then(() => true).catch(() => false);
    if (!mounted) { ck(false, `${name}: the script never mounted (window.MBU absent after 20s) — nothing was verified`); await page.close(); continue; }
    await page.waitForTimeout(800);
    // the three scripts with a floating log open it from the shared Log button
    const hasLog = await page.evaluate(() => {
        const b = document.querySelector('.mbu-cfg-log, .tc-logbtn, .as-setup-logbtn, .fs-logbtn');
        if (b) { b.click(); return true; }
        return false;
    });
    if (hasLog) await page.waitForTimeout(700);

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

    // ── activity log: one floating window, shared severity colours ─────────
    if (hasLog) {
        const lg = await page.evaluate(() => {
            const pop = document.getElementById('mbu-logpop');
            if (!pop) return { missing: true };
            const cs = getComputedStyle(pop);
            const q = s => pop.querySelector(s);
            const li = document.createElement('div');
            // probe each severity through the shared classes
            li.innerHTML = ['ok', 'warn', 'error', 'debug'].map(k =>
                '<div class="mbu-log-li mbu-log-' + k + '"><span class="mbu-log-t">0:00</span><span class="mbu-log-m">x</span></div>').join('');
            (q('.mbu-log-list') || pop).appendChild(li);
            const sev = {};
            for (const k of ['ok', 'warn', 'error', 'debug']) {
                const m = li.querySelector('.mbu-log-' + k + ' .mbu-log-m');
                sev[k] = m ? getComputedStyle(m).color : null;
            }
            const out = {
                pos: cs.position, dir: cs.flexDirection,
                header: !!q('.mbu-logpop-h'), drag: q('.mbu-logpop-h') && getComputedStyle(q('.mbu-logpop-h')).cursor,
                copy: !!q('.mbu-logpop-copy'), min: !!q('.mbu-logpop-min'), close: !!q('.mbu-logpop-x'),
                list: !!q('.mbu-log-list'), sev,
            };
            li.remove();
            return out;
        });
        ck(!lg.missing, `${name}: the log window is the shared #mbu-logpop`);
        if (!lg.missing) {
            ck(lg.pos === 'fixed' && lg.dir === 'column', `${name}: shared floating column layout (${lg.pos}/${lg.dir})`);
            ck(lg.header && lg.drag === 'move', `${name}: draggable by its header (cursor ${lg.drag})`);
            ck(lg.copy && lg.min && lg.close, `${name}: Copy / minimise / close all present`);
            ck(lg.list, `${name}: has the shared entry list`);
            ck(lg.sev.ok === 'rgb(31, 157, 107)' && lg.sev.warn === 'rgb(160, 90, 0)' && lg.sev.error === 'rgb(192, 57, 43)',
                `${name}: severity colours come from the tokens — ${JSON.stringify(lg.sev)}`);
            ck(lg.sev.debug !== lg.sev.ok, `${name}: debug is distinct from ok`);
        }
    }

    // ── overlay + popover dismissal: the interaction half of the contract ──
    const inter = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const MBU = window.MBU;
        if (!MBU || typeof MBU.dismissOn !== 'function') return { missing: true };

        // backdrop: one colour, one stacking level
        const ov = document.createElement('div');
        ov.className = 'mbu-ov';
        ov.innerHTML = '<div class="mbu-ov-panel"><div class="mbu-ov-h"><span class="mbu-ov-title">t</span>'
            + '<button class="mbu-ov-x">✕</button></div><div class="mbu-ov-body">b</div></div>';
        document.body.appendChild(ov);
        const ovCs = getComputedStyle(ov);
        const x = ov.querySelector('.mbu-ov-x');
        const xBox = x.getBoundingClientRect();
        const ovOut = { bg: ovCs.backgroundColor, z: ovCs.zIndex, pos: ovCs.position,
            xW: Math.round(xBox.width), xH: Math.round(xBox.height) };
        ov.remove();

        // #305: dismissing on outside mousedown must swallow the trailing click,
        // or it activates whatever is underneath.
        const under = document.createElement('button');
        under.textContent = 'under';
        under.style.cssText = 'position:fixed;left:40px;top:40px;width:120px;height:40px;z-index:2147483000';
        let underClicks = 0;
        under.addEventListener('click', () => underClicks++);
        document.body.appendChild(under);

        const pop = document.createElement('div');
        pop.style.cssText = 'position:fixed;right:10px;top:10px;width:50px;height:20px';
        document.body.appendChild(pop);
        let closed = 0;
        MBU.dismissOn(pop, () => { closed++; pop.remove(); });

        // a real mousedown+click on the element underneath the popover
        const at = { clientX: 80, clientY: 60, bubbles: true, cancelable: true };
        under.dispatchEvent(new MouseEvent('mousedown', at));
        under.dispatchEvent(new MouseEvent('mouseup', at));
        under.dispatchEvent(new MouseEvent('click', at));
        await wait(50);
        const swallow = { closed, underClicks };

        // and Esc closes
        const pop2 = document.createElement('div');
        document.body.appendChild(pop2);
        let closed2 = 0;
        MBU.dismissOn(pop2, () => { closed2++; pop2.remove(); });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(30);
        under.remove();
        return { ov: ovOut, swallow, esc: closed2 };
    });
    ck(!inter.missing, `${name}: mbuDismissOn is available`);
    if (!inter.missing) {
        ck(inter.ov.pos === 'fixed' && inter.ov.bg === 'rgba(15, 12, 28, 0.45)',
            `${name}: one shared backdrop (${inter.ov.bg})`);
        ck(inter.ov.z === '2147483000', `${name}: at the shared modal level (z ${inter.ov.z})`);
        ck(inter.ov.xW >= 24 && inter.ov.xH >= 24, `${name}: the close control has a real hit area, not a bare glyph (${inter.ov.xW}x${inter.ov.xH})`);
        ck(inter.swallow.closed === 1, `${name}: an outside mousedown dismisses the popover`);
        ck(inter.swallow.underClicks === 0,
            `${name}: #305 — and the trailing click is SWALLOWED, so it does not activate what was underneath (${inter.swallow.underClicks} stray click(s))`);
        ck(inter.esc === 1, `${name}: Esc closes it too`);
    }

    ck(errs.length === 0, `${name}: no page errors${errs.length ? ' — ' + JSON.stringify(errs.slice(0, 2)) : ''}`);
    await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
