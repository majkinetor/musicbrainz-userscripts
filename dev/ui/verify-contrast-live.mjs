#!/usr/bin/env node
// #564: is the TEXT readable once a dark theme is on?
//
// dev/ui/verify-theme-live.mjs answers "did the theme reach the backgrounds"; this
// answers the question majkinetor actually keeps having to ask — "I cannot read
// this". Backgrounds went dark while plenty of foregrounds stayed dark too, and
// the failure is invisible in the source: the colour is usually inherited, or
// comes from a per-script variable that predates the shared tokens.
//
// So measure the rendered thing. For every element with its own text inside one
// of our windows, compute the WCAG contrast ratio against its effective
// background (walking up until something is actually painted) and report
// anything under the AA threshold for its size.
//
//   node dev/ui/verify-contrast-live.mjs                 all scripts, dark
//   node dev/ui/verify-contrast-live.mjs --only fusion
//   node dev/ui/verify-contrast-live.mjs --light         sanity-check the light theme too
//   node dev/ui/verify-contrast-live.mjs --novars       a dark userstyle that defines no variables
//   node dev/ui/verify-contrast-live.mjs --userstyle    kellnerd's real "Dark Side of MusicBrainz"
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

// …and the case the harness never covered: a dark userstyle that paints the page
// but exposes NO variables at all. Most themes are written that way — kellnerd's
// `--background`/`--text` are a convention, not a requirement — and then every
// token derived from them stays at its LIGHT fallback while the page around it is
// dark. That is the "whitish gray backgrounds and invisible text" report:
// half-light windows on a dark page, which is exactly what deriving from someone
// else's variables buys you when they are not there.
const DARK_NOVARS = 'html,body{background:#1b1820;color:#e9e5f2}a{color:#b9a7f0}';
const NOVARS = process.argv.includes('--novars');

// …and the environment majkinetor actually runs: kellnerd's "Dark Side of
// MusicBrainz". Neither invented userstyle above modelled it, and it does
// something neither of them does — it applies
// `filter: invert(.9) hue-rotate(180deg)` to every button, select and non-text
// input on the page, ours included, which happens AFTER the cascade and so is
// invisible to every computed-style check ever written here.
//
// Fetched rather than vendored: a stale copy in the repo would test a userstyle
// nobody is running. Cached in the temp dir so a run is not hostage to GitHub.
const USERSTYLE = process.argv.includes('--userstyle');
const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';
async function kellnerdCss() {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
    const cache = join(tmpdir(), 'mbu-kellnerd-dark.css');
    let raw = null;
    try { raw = await rf(cache, 'utf8'); } catch (_) {}
    if (!raw) {
        raw = await (await fetch(STYLE_URL)).text();
        await wf(cache, raw);
    }
    // strip the ==UserStyle== metadata block and the @-moz-document wrapper
    const i = raw.indexOf('@-moz-document');
    if (i < 0) throw new Error('kellnerd userstyle: no @-moz-document wrapper — format changed');
    return raw.slice(raw.indexOf('{', i) + 1, raw.lastIndexOf('}'));
}

// Each case opens as many surfaces as it can reach, because a window nobody
// opened is a window nobody measured. `open` may click several things in turn.
const CASES = [
    ['art_station', `/release/${REL}/cover-art`, 3500, () => {
        document.getElementById('as-setup-btn')?.click();
    }],
    // the surfaces the screenshots complained about, which no earlier check opened
    ['apollo_editor', `/release/${REL}/edit`, 9000, () => {
        [...document.querySelectorAll('a,li,button')].find(e => /^Tracklist$/.test((e.textContent || '').trim()))?.click();
    }],
    ['credit_hoarder', '/release/63cc0372-6a7b-4d0e-9da5-9efaf419cd8e/edit-relationships', 7000, null, 'https://musicbrainz.org'],
    ['isrc_scout', `/release/${REL}`, 3500, () => {
        document.getElementById('ii-btn')?.click();
        setTimeout(() => [...document.querySelectorAll('#ii-modal button,#ii-modal a')]
            .find(e => /look\s*up|lookup|fetch/i.test(e.textContent || ''))?.click(), 900);
    }],
    ['fusion', `/release-group/${RG}`, 3500, () => document.querySelector('.fs-launch')?.click()],
    // Falcon — never adopted the tokens until now, so nothing here had ever been
    // measured. Panel, then the "Add to queue" dialog majkinetor photographed.
    ['falcon', `/release/${REL}`, 4000, () => document.getElementById('falcon-launcher')?.click()],
    ['falcon', `/release/${REL}`, 4000, () => {
        document.getElementById('falcon-launcher')?.click();
        setTimeout(() => [...document.querySelectorAll('#falcon-panel button')]
            .find(e => /add from release/i.test(e.textContent || ''))?.click(), 900);
    }],
    // The menus from the second round of screenshots: Scout's two dropdowns and
    // Platform Check's provider list, none of which any opener reached before.
    ['isrc_scout', `/release/${REL}`, 3500, () => {
        document.getElementById('ii-btn')?.click();
        setTimeout(() => document.querySelector('.ii-clear-toggle')?.click(), 900);
    }],
    ['isrc_scout', `/release/${REL}`, 3500, () => {
        document.getElementById('ii-btn')?.click();
        setTimeout(() => document.querySelector('.ii-sxprov, .ii-prov-toggle')?.click(), 900);
    }],
    ['platform_check', `/release/${REL}`, 3500, () => {
        [...document.querySelectorAll('#mb-pc-panel *')].find(e => /⚙/.test(e.textContent || '') && e.offsetParent)?.click();
        setTimeout(() => [...document.querySelectorAll('#mb-provider-modal-card button,#mb-provider-modal-card a')]
            .find(e => /platform/i.test(e.textContent || ''))?.click(), 900);
    }],
    ['art_station', `/release/${REL}/cover-art`, 3500, () => {
        document.getElementById('as-setup-btn')?.click();
        setTimeout(() => document.querySelector('.mbu-cfg-log')?.click(), 300);
    }],
    ['apollo_editor', `/release/${REL}/edit`, 9000, () => {
        [...document.querySelectorAll('button,span,a,div')].find(e => (e.textContent || '').trim() === '⚙' && e.offsetParent)?.click();
    }],
    ['apollo_editor', `/release/${REL}/edit`, 9000, null],
    ['group_therapy', `/release/${REL}/edit-relationships`, 3500, () => {
        [...document.querySelectorAll('button,span,a')].find(e => (e.textContent || '').trim() === '⚙' && e.offsetParent)?.click();
    }],
    ['isrc_scout', `/release/${REL}`, 3500, () => document.getElementById('ii-btn')?.click()],
    ['platform_check', `/release/${REL}`, 3500, () => {
        [...document.querySelectorAll('#mb-pc-panel *')].find(e => /⚙/.test(e.textContent || '') && e.offsetParent)?.click();
    }],
    ['fusion', `/release-group/${RG}`, 3500, () => {
        document.querySelector('.fs-launch')?.click();
        setTimeout(() => document.getElementById('fs-cfg')?.click(), 900);
    }],
    ['mammoth', `/release/${REL}/edit-relationships`, 6000, null],
];

// Marker classes Apollo puts on MUSICBRAINZ's own form fields so it can find
// them again. Those elements belong to the page, not to us; a dark userstyle is
// responsible for them, and repainting someone else's release editor is not.
const NOT_OURS = [/^\.tc-nav-on$/, /^\.tc-nav-vh$/];
// …and by the FULL selector, for MusicBrainz controls that one of our own
// wrappers happens to contain: Mammoth puts .mmth-fieldcol around MusicBrainz's
// edit-note textarea, which is still MusicBrainz's textarea.
// The same goes for MusicBrainz's own "Edit note" legend: Mammoth marks the
// fieldset with .mmth-on so it can find it, but the heading, its orange, and the
// 2.96:1 it scores on white are all MusicBrainz's.
const NOT_OURS_FULL = [/textarea\.edit-note$/, /^\.mmth-on legend$/];

const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const LIGHT = process.argv.includes('--light');
let fail = 0;
const ck = (c, m) => { console.log((c ? '  ok  : ' : '  FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: true, viewport: { width: 1600, height: 1100 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'x', version: 'contrast' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    // A real (fetch-backed) GM_xmlhttpRequest, not a no-op: scripts that probe
    // external sources bail out early without it, and a script that never
    // mounted is a script whose colours were never measured. credit_hoarder was
    // silently doing exactly that.
    window.GM_xmlhttpRequest = (o) => {
        const done = (r) => { try { (o.onload || (() => {}))(r); } catch (e) {} };
        fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
            .then(async (r) => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
            .catch((e) => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
        return { abort() {} };
    };
});

const STYLE_CSS = USERSTYLE ? await kellnerdCss() : null;

const worst = new Map();   // script -> [{sel, ratio, fg, bg, text}]
const seenOurs = new Map();   // script -> how many of our elements were ever on screen
for (const [name, path, settle, open, base] of CASES.filter(c => !ONLY || c[0] === ONLY)) {
    // credit_hoarder is a bundle: the installable file is dist/, not src/
    const src = await readFile(name === 'credit_hoarder'
        ? 'C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js'
        : `C:/Work/mb-userscripts/userscripts/${name}/${name}.user.js`, 'utf8');
    const page = await ctx.newPage();
    // Abort POSTs, hand everything else back to the browser untouched.
    // route.continue() RE-ISSUES the request from Playwright, which production
    // MusicBrainz does not survive — every navigation landed on "/" with an empty
    // document, so credit_hoarder "mounted nothing" on a page that had never
    // loaded. fallback() lets the default handling do the work.
    await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
    await page.goto((base || B) + path, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); process.exit(3); }
    await page.waitForTimeout(1200);
    if (!LIGHT) await page.addStyleTag({ content: USERSTYLE ? STYLE_CSS : NOVARS ? DARK_NOVARS : DARK });
    await page.addScriptTag({ content: src });
    await page.waitForTimeout(settle);
    if (open) { await page.evaluate(open); await page.waitForTimeout(1800); }

    const rows = await page.evaluate((LIGHT) => {
        const PFX = /^(as|tc|gt|ii|fs|mmth|pc|mbu|mb-pc|mb-provider|discogs|falcon)-/;
        const ourKey = (el) => {
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                if (n.id && PFX.test(n.id)) return '#' + n.id;
                for (const c of n.classList || []) if (PFX.test(c)) return '.' + c;
            }
            return null;
        };
        const rgb = (s) => {
            const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s || '');
            return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
        };
        const lum = ([r, g, b]) => {
            const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        // The painted background behind an element: walk up past transparent
        // ones. A background-IMAGE (our primary buttons are gradients) makes the
        // answer unknowable from computed style — backgroundColor reads
        // transparent while the pixels are purple — so say so rather than
        // reporting the panel underneath and calling white-on-purple 1:1.
        const behind = (el) => {
            for (let n = el; n; n = n.parentElement) {
                const cs = getComputedStyle(n);
                if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
                const c = rgb(cs.backgroundColor);
                if (c && c[3] > 0.5) return c;
            }
            return [255, 255, 255, 1];
        };
        const out = [];
        for (const el of document.querySelectorAll('*')) {
            const key = ourKey(el);
            if (!key) continue;
            if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
            // a container clipped to 1x1 is the visually-hidden idiom; its
            // children keep their size, so check the chain (Apollo does this to
            // MusicBrainz's own step nav)
            let clipped = false;
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const b = n.getBoundingClientRect();
                if (b.width < 4 || b.height < 4) { clipped = true; break; }
            }
            if (clipped) continue;
            // A LIGHT PATCH is its own failure, separate from contrast: a pale
            // tab, badge or button on a dark panel reads as broken even when the
            // text on it happens to be legible. That is items 4 and 6 in #564.
            if (!LIGHT) {
                // …except for the widgets the UA paints itself. A checkbox
                // reports backgroundColor:white whatever the theme — the value is
                // the initial one, not the pixels — so reading it here produces a
                // permanent false positive. What matters for those is
                // color-scheme, asserted separately below.
                const t0 = (el.type || '').toLowerCase();
                const own = /^(checkbox|radio|range|color)$/.test(t0) ? null : rgb(getComputedStyle(el).backgroundColor);
                if (own && own[3] > 0.5 && (own[0] + own[1] + own[2]) / 3 > 170) {
                    const r0 = el.getBoundingClientRect();
                    if (r0.width >= 8 && r0.height >= 8) out.push({
                        kind: 'surface',
                        sel: key + ' ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
                        ratio: 0, fg: '-', bg: `rgb(${own[0]}, ${own[1]}, ${own[2]})`,
                        text: (el.textContent || '').trim().slice(0, 30),
                    });
                }
            }
            // only elements holding their OWN text — otherwise a wrapper is
            // reported for the colour of its child, and the list fills with noise
            const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
            if (!own) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || +cs.opacity < 0.15) continue;
            // WCAG 1.4.3 exempts INACTIVE components, and dimming is how a
            // disabled control says it is disabled. Falcon's "Retry failed" is
            // greyed until something has failed; holding it to 4.5:1 would mean
            // it could not look disabled at all.
            if (el.closest('[disabled],[aria-disabled="true"],.disabled')) continue;
            let fg = rgb(cs.color);
            if (!fg || fg[3] < 0.5) continue;
            const bg = behind(el);
            if (!bg) continue;                       // painted by a gradient — unknowable here
            // OPACITY IS PART OF THE COLOUR. Falcon's header buttons are #fff at
            // opacity .7 on navy; reading `color` alone scores them as pure white
            // and calls them readable, which is why this file passed something
            // majkinetor could not read. Composite the whole opacity chain (and
            // the colour's own alpha) over the background first.
            let alpha = fg[3];
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const o = parseFloat(getComputedStyle(n).opacity);
                if (!isNaN(o) && o < 1) alpha *= o;
            }
            if (alpha < 0.999) fg = [0, 1, 2].map(i => fg[i] * alpha + bg[i] * (1 - alpha));
            const cr = ratio(fg, bg);
            // AA: 4.5 for body text, 3.0 once it is large (>=24px, or >=18.66px bold)
            const size = parseFloat(cs.fontSize) || 13;
            const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
            const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
            if (cr >= need) continue;
            out.push({
                kind: 'text',
                sel: key + ' ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
                ratio: Math.round(cr * 100) / 100,
                fg: cs.color, bg: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
                text: own.slice(0, 42),
            });
        }
        // A FILTER APPLIED TO OUR OWN CONTROLS. This is the one thing every
        // other assertion in this file is structurally blind to: `filter` is
        // applied when the element is painted, long after the cascade, so
        // getComputedStyle reports the colour we asked for while the screen
        // shows its inverse. kellnerd's userstyle inverts every button, select
        // and non-text input on the page — right for MusicBrainz's own light
        // controls, wrong for ours, which are already dark. That is how "all
        // still have gray background" survived a green board.
        for (const el of document.querySelectorAll('button,select,input,textarea')) {
            const key = ourKey(el);
            if (!key || !el.offsetParent) continue;
            const f = getComputedStyle(el).filter || '';
            if (!/invert\(/.test(f)) continue;
            out.push({ kind: 'filter', sel: key + ' ' + el.tagName.toLowerCase(), ratio: 0, fg: '-', bg: f, text: '' });
        }

        // The UA-painted widgets, asked the only question that means anything:
        // has the browser been told which way round the world is? Without
        // color-scheme a checkbox is a white box in Chrome and a black one in
        // Firefox, whatever accent-color says (#564).
        for (const el of (LIGHT ? [] : document.querySelectorAll('input[type=checkbox],input[type=radio]'))) {
            const key = ourKey(el);
            if (!key || !el.offsetParent) continue;
            if (getComputedStyle(el).colorScheme.includes('dark')) continue;
            out.push({
                kind: 'scheme',
                sel: key + ' ' + (el.type || 'input'),
                ratio: 0, fg: '-', bg: 'color-scheme: ' + getComputedStyle(el).colorScheme, text: '',
            });
        }
        // How much of OUR UI was actually on screen. A case whose opener silently
        // failed measures nothing and reports "ok", which is the most dangerous
        // result this file can produce — it says a window is fine when the window
        // was never opened. Reported as a count so an empty case is visible.
        let ours = 0;
        for (const el of document.querySelectorAll('*')) {
            if (!ourKey(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width >= 8 && r.height >= 8) ours++;
        }
        out.push({ kind: 'census', sel: '', ratio: 0, fg: '', bg: '', text: '', ours });
        return out;
    }, LIGHT);

    const seen = worst.get(name) || [];
    const census = rows.find(r => r.kind === 'census');
    seenOurs.set(name, Math.max(seenOurs.get(name) || 0, census ? census.ours : 0));
    for (const r of rows) {
        if (r.kind === 'census') continue;
        if (NOT_OURS.some(re => re.test(r.sel.split(' ')[0]))) continue;
        if (NOT_OURS_FULL.some(re => re.test(r.sel))) continue;
        if (!seen.some(s => s.sel === r.sel && s.kind === r.kind)) seen.push(r);
    }
    worst.set(name, seen);
    await page.close();
}

const MODE = LIGHT ? 'LIGHT' : USERSTYLE ? "kellnerd's userstyle" : NOVARS ? 'DARK (userstyle defines no variables)' : 'DARK';
console.log(`\n=== ${MODE} — text below the WCAG AA threshold\n`);
for (const [name, rows] of worst) {
    rows.sort((a, b) => (a.kind === b.kind ? a.ratio - b.ratio : a.kind < b.kind ? -1 : 1));
    ck((seenOurs.get(name) || 0) >= 5, `${name}: its UI was actually on screen to be measured (${seenOurs.get(name) || 0} element(s))`);
    ck(!rows.length, `${name}: every label readable and every surface dark${rows.length ? ` — ${rows.filter(r=>r.kind==='text').length} below AA, ${rows.filter(r=>r.kind==='surface').length} light patch(es), ${rows.filter(r=>r.kind==='scheme').length} unthemed widget(s), ${rows.filter(r=>r.kind==='filter').length} inverted control(s)` : ''}`);
    for (const r of rows.slice(0, 24)) {
        console.log(r.kind
            === 'filter'
            ? `        INVERTED     ${r.sel.padEnd(38)} ${r.bg}`
            : r.kind === 'scheme'
            ? `        UA WIDGET    ${r.sel.padEnd(38)} ${r.bg}`
            : r.kind === 'surface'
            ? `        LIGHT PATCH  ${r.sel.padEnd(38)} ${r.bg}   ${JSON.stringify(r.text)}`
            : `        ${String(r.ratio).padStart(5)}:1  ${r.sel.padEnd(38)} ${r.fg} on ${r.bg}   ${JSON.stringify(r.text)}`);
    }
    if (rows.length > 24) console.log(`        …and ${rows.length - 24} more`);
}
await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
