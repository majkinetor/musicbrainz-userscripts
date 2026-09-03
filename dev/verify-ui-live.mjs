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

// `--only <script>` narrows a run to one script — seven live pages is a slow
// loop when you are iterating on one of them.
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

for (const [name, path, url, hasToast] of CASES.filter(c => !ONLY || c[0] === ONLY)) {
    console.log('\n=== ' + name);
    const code = await readFile('C:/Work/mb-userscripts/' + path, 'utf8');
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    // Abort POSTs, hand everything else back to the browser untouched.
    // route.continue() RE-ISSUES the request from Playwright, which production
    // MusicBrainz does not survive — every navigation landed on "/" with an empty
    // document, so credit_hoarder "mounted nothing" on a page that had never
    // loaded. fallback() lets the default handling do the work.
    await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
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

    // ── the stylesheet parsed as written ────────────────────────────────────
    // #564: Group Therapy's toolbar buttons rendered as bare UA buttons because a
    // stale two-line fragment (the tail of a rule whose selector I had deleted)
    // sat at top level. CSS error recovery swallows the garbage AND the rule that
    // follows it, silently — the script runs, the sheet loads, and one rule has
    // simply ceased to exist. No assertion in this suite could see that, because
    // every one of them asks about a component that was still fine.
    //
    // So: read back what the browser parsed and compare it with what the script
    // wrote. Anything the parser dropped is named.
    const css = await page.evaluate(() => {
        const out = [];
        for (const sheet of document.styleSheets) {
            // ours are inline <style> nodes; MB's are cross-origin and unreadable
            if (sheet.href || !sheet.ownerNode || !sheet.ownerNode.textContent) continue;
            let rules; try { rules = [...(sheet.cssRules || [])]; } catch (_) { continue; }
            const text = sheet.ownerNode.textContent;

            // Walk the source at brace depth, skipping comments and strings, and
            // collect every top-level prelude. A `;` at depth 0 that is not part
            // of an at-rule is an orphaned declaration — the exact bug above.
            const preludes = [], orphans = [];
            let depth = 0, buf = '', i = 0;
            while (i < text.length) {
                const c = text[i];
                if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? text.length : e + 2; continue; }
                if (c === '"' || c === "'") {
                    const q = c; buf += c; i++;
                    while (i < text.length && text[i] !== q) { if (text[i] === '\\') { buf += text[i++]; } buf += text[i++]; }
                    buf += text[i++] || ''; continue;
                }
                if (c === '{') { if (depth === 0) preludes.push(buf.trim()); depth++; buf = ''; i++; continue; }
                if (c === '}') { depth = Math.max(0, depth - 1); if (!depth) buf = ''; i++; continue; }
                if (c === ';' && depth === 0) {
                    const frag = buf.trim();
                    if (frag && !frag.startsWith('@')) orphans.push(frag.slice(0, 60));
                    buf = ''; i++; continue;
                }
                buf += c; i++;
            }
            // Chromium re-prints selectorText in its own canonical form: spaces
            // around combinators, quotes added inside attribute selectors,
            // nth-child(even) rewritten as 2n. None of that means anything here,
            // so normalise it away before comparing — otherwise ordinary
            // selectors look "dropped" and a real one hides in the noise.
            const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1')
                .replace(/(\[[^\]]*?=)["']([^"'\]]*)["']/g, '$1$2')
                .replace(/\(\s*even\s*\)/g, '(2n)').replace(/\(\s*odd\s*\)/g, '(2n+1)')
                .trim();
            const parsed = rules.map(r => norm(r.selectorText || ('@' + (r.name || r.conditionText || r.cssText.slice(0, 24)))));
            const missing = [];
            const pool = parsed.slice();
            for (const p of preludes.map(norm)) {
                if (!p) continue;
                const at = pool.findIndex(x => x === p || (p.startsWith('@') && x.startsWith('@')));
                if (at >= 0) pool.splice(at, 1); else missing.push(p.slice(0, 70));
            }
            out.push({ blocks: preludes.length, rules: rules.length, missing, orphans });
        }
        return out;
    });
    for (const s of css) {
        ck(!s.orphans.length, `${name}: no orphaned declarations at top level of the stylesheet${s.orphans.length ? ' — ' + JSON.stringify(s.orphans) : ''}`);
        // The COUNT is the assertion: a rule the parser threw away cannot be in
        // cssRules, so blocks-written must equal rules-parsed. The name list is
        // only a diagnostic printed when that fails — matching selector text
        // across two spellings is best-effort, and it must never be the thing
        // that decides whether this passes.
        const lost = s.missing.filter(m => !/-moz-|-ms-|-webkit-/.test(m));
        ck(s.rules === s.blocks,
            `${name}: every rule the script wrote survived parsing (${s.rules}/${s.blocks})${s.rules !== s.blocks && lost.length ? ' — DROPPED: ' + JSON.stringify(lost) : ''}`);
    }

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
            logBorderColor: logBtn && getComputedStyle(logBtn).borderTopColor,
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
        ck(cfg.logText === 'Log' && cfg.logBorderColor === 'rgba(0, 0, 0, 0)', `${name}: Log is a plain text link at rest — the border is a hover affordance, not chrome (${cfg.logBorderColor})`);
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

    // ── placeholders must not read as typed text (#563) ────────────────────
    const ph = await page.evaluate(() => {
      const host = document.createElement('div');
      host.className = 'mbu-ui';                       // the opt-in container hook
      host.innerHTML = '<input class="p" placeholder="hint"><input class="v" value="typed">';
      document.body.appendChild(host);
      const pe = getComputedStyle(host.querySelector('.p'), '::placeholder');
      const ve = getComputedStyle(host.querySelector('.v'));
      const out = { phColor: pe.color, phStyle: pe.fontStyle, phOpacity: pe.opacity, valColor: ve.color, valStyle: ve.fontStyle };
      host.remove();
      const mb = document.querySelector('input[placeholder]:not([class*=mbu-])');
      out.mbStyle = mb ? getComputedStyle(mb, '::placeholder').fontStyle : null;
      return out;
    });
    ck(ph.phStyle === 'italic' && ph.valStyle !== 'italic', `${name}: a placeholder is italic where typed text is not (${ph.phStyle} vs ${ph.valStyle})`);
    ck(ph.phColor !== ph.valColor, `${name}: and a different colour (${ph.phColor} vs ${ph.valColor})`);
    ck(ph.phOpacity === '1', `${name}: opacity pinned, so Firefox cannot dim it further (${ph.phOpacity})`);
    ck(ph.mbStyle === null || ph.mbStyle !== 'italic', `${name}: MusicBrainz's own inputs are left alone (${ph.mbStyle})`);

    // ── open the SETTINGS window ────────────────────────────────────────────
    // The suite opened every script's log window and never its settings, so a
    // throw while building the settings window was invisible here. Mammoth's
    // shipped like that: openSettings dragged the window by its <h4>, which #563
    // had replaced with the shared .mbu-cfg-h. querySelector returned null,
    // makeDraggable threw on handle.classList, and every line after it — tab
    // wiring, option handlers, close button — never ran. The window opened and
    // did nothing, and majkinetor found it, not this file.
    //
    // Opening it is enough: the "no page errors" assertion below does the rest.
    const openOnce = async () => await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        // offsetParent is null for position:fixed, and every floating launcher in
        // this repo is fixed — requiring it meant Fusion's launcher was never
        // clicked and its settings reported "no way in found".
        const hit = (el) => {
            if (!el) return false;
            if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
            el.click();
            return true;
        };
        // Already open from an earlier step in this run? Then it was already
        // built, and any throw while building it has already been captured —
        // which is the whole point. Clicking the toggle again would only close it.
        const OPEN = '#as-setup,.mmth-cfg,#tc-settings,.gt-cfg-pop,#fs-settings,#mb-provider-modal-card,#ii-setup-pane.open';
        if (document.querySelector(OPEN)) return 'already open';
        // a baby-mammoth pin has to be opened before its gear exists
        if (hit(document.querySelector('.mmthf-pin'))) {
            await sleep(600);
            if (hit(document.querySelector('.mmthf-cfg'))) { await sleep(700); return 'mmthf-cfg'; }
        }
        // Direct first. Fusion's launcher TOGGLES its window, and an earlier check
        // in this run has usually already opened it — clicking the launcher again
        // closed it and took #fs-cfg with it, which read as "no way in found".
        const direct = ['#as-setup-btn', '#fs-cfg', '.gt-cfg-btn', '#ii-setup-toggle'];
        for (const sel of direct) if (hit(document.querySelector(sel))) { await sleep(700); return sel; }
        // Otherwise the ⚙ lives INSIDE the main window, so open that first.
        for (const [outer, inner] of [['.fs-launch', '#fs-cfg'], ['#ii-btn', '#ii-setup-toggle']]) {
            if (!hit(document.querySelector(outer))) continue;
            await sleep(900);
            if (hit(document.querySelector(inner))) { await sleep(700); return inner; }
        }
        const gear = [...document.querySelectorAll('button,span,a,div')]
            .find(e => /^[⚙⚙︎]︎?$/.test((e.textContent || '').trim()) && e.offsetParent);
        if (hit(gear)) { await sleep(700); return 'gear'; }
        return null;
    });
    // Poll rather than look once: Art Station's toolbar mounts after its covers
    // load, so a single look found nothing and reported "no way in found" on a
    // perfectly healthy build. A flaky check is a check nobody trusts.
    let opened = null;
    for (let i = 0; i < 6 && !opened; i++) {
        opened = await openOnce();
        if (!opened) await page.waitForTimeout(1000);
    }
    ck(!!opened, `${name}: its settings window could be opened at all (${opened || 'no way in found'})`);
    // pageerror arrives over CDP, asynchronously. Asserting immediately after the
    // click read errs[] before the throw had been delivered and passed on a build
    // that was demonstrably broken — the failure mode this whole block exists to
    // catch, reproduced inside the catcher.
    await page.waitForTimeout(600);

    ck(errs.length === 0, `${name}: no page errors${errs.length ? ' — ' + JSON.stringify(errs.slice(0, 2)) : ''}`);
    await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
