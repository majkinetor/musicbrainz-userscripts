// ==UserScript==
// @name         Mission Control
// @namespace    https://musicbrainz.org/
// @version      2026.10.5
// @description  One window on the release page that asks the other scripts (Platform Check, ISRC Scout, Art Station, Fusion, Credit Hoarder) what is missing, shows it all in one review, and applies the ticked changes in order.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPk1pc3Npb24gQ29udHJvbDwvdGl0bGU+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNWYzZWMwIiBzdHJva2Utd2lkdGg9IjciPgogICAgPGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iNTIiLz4KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjMwIi8+CiAgICA8cGF0aCBkPSJNNjQgNHYyMk02NCAxMDJ2MjJNNCA2NGgyMk0xMDIgNjRoMjIiLz4KICA8L2c+CiAgPGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iMTEiIGZpbGw9IiM4YTVjZjYiLz4KPC9zdmc+Cg==
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mission_control/README.md
// @match        https://*.musicbrainz.org/release/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
'use strict';
// one copy per page: with String Theory and a standalone install both on, the newer one runs (#653)
if (!mbuClaim('mission_control', 'Mission Control')) return;

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '?';
const ICON = '◎';

// Only the release overview: MC reads its tracklist, and the subpages (edit,
// cover-art, edit-relationships, …) belong to other scripts.
const RELEASE = (location.pathname.match(/^\/release\/([0-9a-fA-F-]{36})\/?$/) || [])[1];
if (!RELEASE) return;

const Log = mbuLog({ name: 'Mission Control', version: VERSION, header: 'Mission Control — activity log', key: 'mc.logwin', before: () => mcStyle() });
Log.info(mbuStartupInfo('Mission Control'));

/* ── settings (GM storage, #501) ───────────────────────────────────────────── */

// fusion / ch: 'auto' fetches during Probe, 'ask' waits for the card's Fetch
// button, 'off' drops the step. Both fetches can take minutes (#680).
const DEFAULTS = { fusion: 'ask', ch: 'ask', left: true, right: true };
function loadSettings() {
    let s = {};
    try { s = JSON.parse(GM_getValue('mc.settings', '{}')) || {}; } catch (e) { Log.warn('settings unreadable, using defaults: ' + e.message); }
    return Object.assign({}, DEFAULTS, s);
}
const S = loadSettings();
function saveSettings() {
    try { GM_setValue('mc.settings', JSON.stringify(S)); } catch (e) { Log.warn('settings not saved: ' + e.message); }
    Log.debug('settings ' + JSON.stringify(S));
}

/* ── execution order ───────────────────────────────────────────────────────── */

// Each step is a provider; a step with `lanes` runs them in parallel (they hit
// different APIs with their own rate limits). `mode` names the setting that can
// switch an optional step to auto / ask / off.
const STEPS = [
    { id: 'pc', name: 'Platforms & artists', short: 'PC', provider: 'Platform Check', glyph: '🔗' },
    { id: 'enrich', name: 'Enrich', glyph: '⇶', lanes: [
        { id: 'is', name: 'ISRCs & recording links', short: 'IS', provider: 'ISRC Scout', glyph: '#' },
        { id: 'as', name: 'Cover art', short: 'AS', provider: 'Art Station', glyph: '🖼' },
    ] },
    { id: 'fusion', name: 'Merge suggestions', short: 'Fusion', provider: 'Fusion', glyph: '⚛', mode: 'fusion' },
    { id: 'ch', name: 'Credits', short: 'CH', provider: 'Credit Hoarder', glyph: '✎', mode: 'ch', info: true },
];
const PROVIDERS = STEPS.flatMap(s => s.lanes || [s]);

/* ── provider bus ──────────────────────────────────────────────────────────── */

// MC asks with 'mc:discover'; each member script that has an adapter answers
// with 'mc:provider'. Details are JSON strings, never objects: scripts run in
// separate sandboxes, and Firefox's Xray wrappers hide an object's fields from
// another realm. Contract: DEVELOP.md.
const found = {};   // provider id -> { name, version, capabilities }
document.addEventListener('mc:provider', e => {
    let d;
    try { d = JSON.parse(e.detail); } catch (x) { Log.warn('mc:provider with unreadable detail: ' + x.message); return; }
    if (!d || !d.id) { Log.warn('mc:provider without an id'); return; }
    found[d.id] = d;
    Log.info('provider ' + d.id + ' answered: ' + (d.name || '?') + ' v' + (d.version || '?') + ' · ' + JSON.stringify(d.capabilities || []));
    if (ui) paintBadges();
});
function discover() {
    Log.info('discover: asking providers for release ' + RELEASE);
    document.dispatchEvent(new CustomEvent('mc:discover', { detail: JSON.stringify({ release: RELEASE, mc: VERSION }) }));
    setTimeout(() => {
        const missing = PROVIDERS.filter(p => !found[p.id]).map(p => p.provider);
        if (missing.length) Log.info('no adapter yet: ' + missing.join(', '));
        paintBadges();
    }, 500);
}

/* ── release from the page ─────────────────────────────────────────────────── */

// Read once from the rendered page, no request: the header and the tracklist
// are already there.
function readRelease() {
    const h = document.querySelector('.releaseheader');
    const title = h && h.querySelector('h1') ? h.querySelector('h1').textContent.trim() : document.title;
    const artist = h && h.querySelector('.subheader') ? Array.from(h.querySelectorAll('.subheader a[href*="/artist/"]')).map(a => a.textContent.trim()).join(', ') : '';
    const cover = document.querySelector('.cover-art img');
    const tracks = [];
    let medium = 0;
    document.querySelectorAll('#content table.medium').forEach(tbl => {
        medium++;
        tbl.querySelectorAll('tbody tr').forEach(tr => {
            const rec = tr.querySelector('a[href*="/recording/"]');
            if (!rec) return;
            const pos = tr.querySelector('td.pos') || tr.cells[0];
            const len = Array.from(tr.cells).map(c => c.textContent.trim()).reverse().find(t => /^\d+:\d\d(:\d\d)?$/.test(t)) || '';
            tracks.push({
                medium, pos: pos ? pos.textContent.trim() : '', title: rec.textContent.trim(), len,
                rec: (rec.getAttribute('href').match(/[0-9a-f-]{36}/) || [])[0],
            });
        });
    });
    Log.info('release: "' + title + '" by ' + (artist || '?') + ' · ' + tracks.length + ' tracks on ' + medium + ' medium(s)');
    return { title, artist, cover: cover ? cover.src : '', tracks, media: medium };
}

/* ── UI ────────────────────────────────────────────────────────────────────── */

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = mbuHtml(html); return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ui = null, rel = null, selected = null;

function mcStyle() {
    if (document.getElementById('mc-style')) return;
    const s = document.createElement('style'); s.id = 'mc-style';
    s.textContent = MBU_TOKENS + MBU_UI_CSS
        + '.mc-launch{position:fixed;z-index:2147483000;width:40px;height:40px;border-radius:50%;border:none;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;'
        + 'background:color-mix(in srgb, var(--mbu-bg) 55%, transparent);color:var(--mbu-accent-text);box-shadow:0 2px 8px rgba(0,0,0,.18);opacity:.85;font-size:22px;line-height:1;transition:opacity .15s,transform .1s}'
        + '.mc-launch:hover{opacity:1;transform:scale(1.08)}'
        + '#mc-root{position:fixed;inset:0;z-index:var(--mbu-z-modal);display:flex;flex-direction:column;background:var(--mbu-bg-sunken);color:var(--mbu-text);font:13px/1.4 var(--mbu-font)}'
        + '#mc-root *{box-sizing:border-box}'
        + '#mc-root .mono{font-family:var(--mbu-font-mono)}#mc-root .weak{color:var(--mbu-text-weak)}'
        // header: actions | album (center) | actions — Apollo's layout
        + '.mc-hdr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:6px 12px;background:var(--mbu-bg);border-bottom:1px solid var(--mbu-border);box-shadow:var(--mbu-shadow)}'
        + '.mc-hdr .l,.mc-hdr .r{display:flex;align-items:center;gap:6px;min-width:0}.mc-hdr .r{justify-content:flex-end}'
        + '.mc-hdr .c{display:flex;align-items:center;gap:10px;min-width:0}'
        + '.mc-cover{width:30px;height:30px;border-radius:4px;object-fit:cover;flex:none;background:var(--mbu-accent-soft)}'
        + '.mc-ttl{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:36vw}.mc-sub{font-size:11px;color:var(--mbu-text-weak);white-space:nowrap}'
        + '.mc-logo{display:flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap;color:var(--mbu-accent-text)}'
        + '.mc-ver{font-size:10px;font-weight:600;color:var(--mbu-accent-text);background:var(--mbu-accent-soft);padding:1px 6px;border-radius:20px}'
        + '.mc-src{display:flex;align-items:center;gap:4px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken);padding:2px 2px 2px 8px;min-width:0;flex:1;max-width:380px}'
        + '#mc-root .mc-src input{border:0;background:transparent;font:11px var(--mbu-font-mono);color:var(--mbu-text-dim);flex:1;min-width:0;outline:none;padding:0}'
        + '.mc-sep{width:1px;height:20px;background:var(--mbu-border);margin:0 4px}'
        + '#mc-root .mc-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--mbu-border);background:var(--mbu-bg);color:var(--mbu-text);padding:4px 10px;border-radius:var(--mbu-radius);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}'
        + '#mc-root .mc-btn:hover:not(:disabled){background:var(--mbu-bg-hover);border-color:var(--mbu-border-strong)}'
        + '#mc-root .mc-btn:disabled{opacity:.5;cursor:default}'
        + '#mc-root .mc-btn.ghost{background:transparent;border-color:transparent;color:var(--mbu-text-dim)}'
        + '#mc-root .mc-btn.primary{background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-accent-fg);font-weight:600}'
        + '#mc-root .mc-btn.primary:hover:not(:disabled){background:var(--mbu-accent-hover)}'
        + '#mc-root .mc-btn.tog{color:var(--mbu-text-weak)}#mc-root .mc-btn.tog.on{background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong);color:var(--mbu-accent-text)}'
        + '#mc-root .mc-btn.lg{padding:7px 16px;font-size:13px}'
        + '.mc-badges{display:flex;gap:4px;flex-wrap:nowrap}'
        + '.mc-bdg{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:1px 7px;border-radius:20px;border:1px solid var(--mbu-border);background:var(--mbu-bg-sunken);color:var(--mbu-text-dim);white-space:nowrap}'
        + '.mc-bdg.idle{color:var(--mbu-text-weak);border-style:dashed}.mc-bdg.ready{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong)}.mc-bdg.off{opacity:.45;text-decoration:line-through}'
        // E's horizontal pipeline, shown while the Order sidebar is hidden.
        // It never wraps: chips drop their labels (mbu-compact) when they would.
        + '.mc-strip{display:none;align-items:center;gap:6px;padding:5px 12px;background:var(--mbu-bg);border-bottom:1px solid var(--mbu-border);overflow:hidden;white-space:nowrap}'
        + '#mc-root.no-left .mc-strip{display:flex}'
        + '.mc-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:2px 9px;border:1px solid var(--mbu-border);border-radius:20px;background:var(--mbu-bg-raised);flex:none}'
        + '.mc-chip.opt{border-style:dashed}.mc-chip.par{background:var(--mbu-bg-sunken)}.mc-arrow{color:var(--mbu-text-weak);flex:none}'
        + '.mc-strip.mbu-compact .mbu-bt{display:none}'
        // three panes
        + '.mc-main{flex:1;display:grid;grid-template-columns:220px 1fr 300px;min-height:0}'
        + '#mc-root.no-left .mc-main{grid-template-columns:1fr 300px}#mc-root.no-right .mc-main{grid-template-columns:220px 1fr}#mc-root.no-left.no-right .mc-main{grid-template-columns:1fr}'
        + '#mc-root.no-left .mc-side.left,#mc-root.no-right .mc-side.right{display:none}'
        + '.mc-side{background:var(--mbu-bg);border-right:1px solid var(--mbu-border);padding:12px;overflow:auto;min-width:0}.mc-side.right{border-right:0;border-left:1px solid var(--mbu-border)}'
        + '.mc-center{overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-width:0}'
        + '.mc-sec{font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--mbu-text-weak);margin:0 0 8px;font-weight:700;display:flex;align-items:center;gap:6px}'
        + '.mc-x{margin-left:auto;cursor:pointer;font-size:14px;letter-spacing:0;color:var(--mbu-text-weak);background:none;border:0;padding:0 4px}'
        // B's vertical execution order
        + '.mc-stage{position:relative;padding-left:26px;padding-bottom:12px}'
        + '.mc-stage::before{content:"";position:absolute;left:8px;top:20px;bottom:-2px;width:2px;background:var(--mbu-border)}.mc-stage:last-child::before{display:none}'
        + '.mc-node{position:absolute;left:0;top:2px;width:18px;height:18px;border-radius:50%;border:2px solid var(--mbu-border-strong);background:var(--mbu-bg)}.mc-node.opt{border-style:dashed}'
        + '.mc-stage .nm{font-weight:600;font-size:12.5px;display:flex;align-items:center;gap:6px}.mc-stage .meta{font-size:11px;color:var(--mbu-text-dim)}'
        + '.mc-stage.off .nm,.mc-stage.off .meta{opacity:.45}'
        + '.mc-par{margin-top:6px;padding:6px 8px;border:1px dashed var(--mbu-border-strong);border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken)}'
        + '.mc-par .lbl{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--mbu-accent-text);font-weight:700;margin-bottom:3px}'
        + '.mc-lane{display:flex;align-items:center;gap:7px;font-size:12px;padding:2px 0}'
        + '.mc-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none;background:var(--mbu-border-strong)}.mc-dot.ready{background:var(--mbu-accent)}'
        + '.mc-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:20px;overflow:hidden;margin-top:4px}'
        + '#mc-root .mc-seg button{font:600 10px var(--mbu-font);padding:2px 9px;color:var(--mbu-text-weak);cursor:pointer;background:none;border:0;border-radius:0}'
        + '#mc-root .mc-seg button.on{background:var(--mbu-accent);color:var(--mbu-accent-fg)}'
        // sections and the track matrix
        + '.mc-sect{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius-lg);background:var(--mbu-bg);box-shadow:var(--mbu-shadow);overflow:hidden}'
        + '.mc-sect-h{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-border-soft)}'
        + '.mc-sect-h .ic{width:22px;height:22px;border-radius:6px;background:var(--mbu-accent-soft);display:grid;place-items:center;font-size:12px;flex:none}'
        + '.mc-sect-h .t{font-weight:700;font-size:12.5px}.mc-sect-h .p{font-size:10.5px;color:var(--mbu-text-weak)}'
        + '.mc-empty{padding:10px;color:var(--mbu-text-weak);font-size:12px}'
        + '.mc-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
        + '.mc-tbl{width:100%;border-collapse:collapse;font-size:12px}'
        + '.mc-tbl th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--mbu-text-weak);text-align:left;padding:6px 8px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-border);position:sticky;top:0;white-space:nowrap}'
        + '.mc-tbl td{padding:4px 8px;border-bottom:1px solid var(--mbu-divider);white-space:nowrap}'
        + '.mc-tbl td.n{color:var(--mbu-text-weak);font-family:var(--mbu-font-mono);width:32px}'
        + '.mc-tbl td.ttl{white-space:normal}'
        + '.mc-tbl td.pend{color:var(--mbu-border-strong)}'
        + '.mc-tbl tbody tr{cursor:pointer}.mc-tbl tbody tr:hover td{background:var(--mbu-bg-hover)}.mc-tbl tbody tr.sel td{background:var(--mbu-accent-soft)}'
        + '.mc-tbl tr.med td{background:var(--mbu-bg-raised);font-size:10.5px;font-weight:700;color:var(--mbu-text-weak);cursor:default}'
        + '.mc-mode{font-size:9.5px;font-weight:700;padding:0 6px;border-radius:20px;border:1px dashed var(--mbu-border-strong);color:var(--mbu-text-weak);margin-left:4px;text-transform:none;letter-spacing:0}'
        + '.mc-mini{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 0;border-bottom:1px solid var(--mbu-divider)}.mc-mini:last-child{border-bottom:0}'
        + '.mc-mini .n{margin-left:auto;font-family:var(--mbu-font-mono);font-size:10.5px;color:var(--mbu-text-dim)}'
        + '.mc-insp-block{margin-bottom:12px}'
        + '.mc-foot{display:flex;align-items:center;gap:12px;padding:8px 14px;background:var(--mbu-bg);border-top:1px solid var(--mbu-border)}'
        + '.mc-foot .big{font-weight:700;font-size:13.5px}.mc-foot .sp{flex:1}'
        + '.mc-cfg label{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:13px}.mc-cfg label span{min-width:150px}';
    document.head.appendChild(s);
}

function modeOf(p) { return p.mode ? S[p.mode] : 'auto'; }
function stateOf(p) {
    if (modeOf(p) === 'off') return 'off';
    return found[p.id] ? 'ready' : 'idle';
}
function stateText(p) {
    const st = stateOf(p);
    return st === 'off' ? 'off' : st === 'ready' ? 'connected' : 'no adapter yet';
}

function header() {
    const h = el('header', 'mc-hdr');
    h.innerHTML = mbuHtml(
        '<div class="l"><span class="mc-logo"><span>' + ICON + '</span>MC</span><span class="mc-ver" title="installed script version">' + esc(VERSION) + '</span>'
        + '<span class="mc-sep"></span>'
        + '<label class="mc-src" title="Source link (or one handed over from First Contact)"><input placeholder="Source link (optional)" spellcheck="false">'
        + '<button type="button" class="mc-btn primary" data-act="probe" title="Ask every provider what is missing">Probe</button></label></div>'
        + '<div class="c">' + (rel.cover ? '<img class="mc-cover" alt="" src="' + esc(rel.cover) + '">' : '<span class="mc-cover"></span>')
        + '<div style="min-width:0"><div class="mc-ttl" title="' + esc(rel.title) + '">' + esc((rel.artist ? rel.artist + ' — ' : '') + rel.title) + '</div>'
        + '<div class="mc-sub">existing · <span class="mono">' + RELEASE.slice(0, 4) + '…' + RELEASE.slice(-4) + '</span> · ' + rel.tracks.length + ' tr · ' + rel.media + ' medium' + (rel.media === 1 ? '' : 's') + '</div></div>'
        + '<div class="mc-badges"></div></div>'
        + '<div class="r"><button type="button" class="mc-btn tog" data-side="left" title="Execution order sidebar">⫷ Order</button>'
        + '<button type="button" class="mc-btn tog" data-side="right" title="Track inspector sidebar">Inspector ⫸</button><span class="mc-sep"></span>'
        + '<button type="button" class="mc-btn ghost" data-act="log" title="Open the activity log">Log</button>' + mbuHelpHtml('mission_control')
        + '<button type="button" class="mc-btn ghost" data-act="cfg" title="Settings">' + MBU_CFG_ICON + '</button>'
        + '<button type="button" class="mc-btn ghost" data-act="close" title="Close (Esc)">✕</button></div>');
    return h;
}

function seg(p) {
    return '<div class="mc-seg" data-mode="' + p.mode + '" title="Auto: fetch during Probe · Ask: fetch on a button · Off: skip">'
        + ['auto', 'ask', 'off'].map(m => '<button type="button" data-v="' + m + '"' + (S[p.mode] === m ? ' class="on"' : '') + '>' + m[0].toUpperCase() + m.slice(1) + '</button>').join('') + '</div>';
}

function orderSidebar() {
    const a = el('aside', 'mc-side left');
    let html = '<h2 class="mc-sec">Execution order <button type="button" class="mc-x" data-close="left" title="Hide">×</button></h2>';
    for (const s of STEPS) {
        if (s.lanes) {
            html += '<div class="mc-stage"><span class="mc-node"></span><div class="nm">' + esc(s.name) + '</div><div class="mc-par"><div class="lbl">⇶ parallel</div>'
                + s.lanes.map(l => '<div class="mc-lane" data-p="' + l.id + '"><span class="mc-dot"></span>' + esc(l.provider) + '</div>').join('') + '</div></div>';
        } else {
            html += '<div class="mc-stage' + (modeOf(s) === 'off' ? ' off' : '') + '" data-p="' + s.id + '"><span class="mc-node' + (s.mode ? ' opt' : '') + '"></span>'
                + '<div class="nm">' + esc(s.name) + (s.info ? ' <span class="mc-mode">info</span>' : '') + '</div>'
                + '<div class="meta">' + esc(s.provider) + ' · <span class="st"></span></div>' + (s.mode ? seg(s) : '') + '</div>';
        }
    }
    a.innerHTML = mbuHtml(html);
    return a;
}

function strip() {
    const d = el('div', 'mc-strip');
    const chip = p => '<span class="mc-chip' + (p.mode ? ' opt' : '') + '" data-p="' + p.id + '" title="' + esc(p.provider + ': ' + p.name) + '"><span class="mc-dot"></span>' + esc(p.glyph) + '<span class="mbu-bt">' + esc(p.short) + '</span></span>';
    d.innerHTML = mbuHtml(STEPS.map(s => s.lanes ? '<span class="mc-chip par" title="run in parallel">' + s.lanes.map(chip).join(' ∥ ') + '</span>' : chip(s)).join('<span class="mc-arrow">→</span>'));
    return d;
}

// One row per track, a column per track-level provider. Values arrive with
// the providers' probe; until then a cell says why it is empty.
const COLS = [
    { p: 'is', head: 'ISRC · IS' },
    { p: 'is', head: 'Rec links · IS' },
    { p: 'fusion', head: 'RG duplicates · Fusion' },
    { p: 'ch', head: 'Credits · CH' },
];
function matrix() {
    const sec = el('section', 'mc-sect');
    const cols = COLS.filter(c => modeOf(PROVIDERS.find(p => p.id === c.p)) !== 'off');
    let html = '<div class="mc-sect-h"><span class="ic">≡</span><span class="t">Tracks</span><span class="p">one row per track · a column per provider</span></div>'
        + '<table class="mc-tbl"><thead><tr><th>#</th><th>Title</th><th>Len</th>'
        + cols.map(c => { const p = PROVIDERS.find(x => x.id === c.p); return '<th>' + esc(c.head) + (p.mode ? '<span class="mc-mode">' + S[p.mode] + '</span>' : '') + '</th>'; }).join('')
        + '</tr></thead><tbody>';
    let lastMed = 0;
    rel.tracks.forEach((t, i) => {
        if (rel.media > 1 && t.medium !== lastMed) { lastMed = t.medium; html += '<tr class="med"><td colspan="' + (3 + cols.length) + '">Medium ' + t.medium + '</td></tr>'; }
        html += '<tr data-i="' + i + '"' + (selected === i ? ' class="sel"' : '') + '><td class="n">' + esc(t.pos) + '</td><td class="ttl">' + esc(t.title) + '</td><td class="mono">' + esc(t.len) + '</td>'
            + cols.map(c => '<td class="pend">—</td>').join('') + '</tr>';
    });
    if (!rel.tracks.length) html += '<tr><td colspan="' + (3 + cols.length) + '" class="weak">No tracklist on this page.</td></tr>';
    sec.innerHTML = mbuHtml(html + '</tbody></table>');
    return sec;
}

function releaseCards() {
    const row = el('div', 'mc-row2');
    const card = (id, ic, t) => {
        const p = PROVIDERS.find(x => x.id === id);
        return '<section class="mc-sect"><div class="mc-sect-h"><span class="ic">' + ic + '</span><span class="t">' + t + '</span><span class="p">' + p.short + '</span></div>'
            + '<div class="mc-empty" data-p="' + id + '">' + esc(p.provider) + ': <span class="st"></span>. Probe fills this in.</div></section>';
    };
    row.innerHTML = mbuHtml(card('pc', '🔗', 'Platforms &amp; artists') + card('as', '🖼', 'Cover art'));
    return row;
}

function inspector() {
    const a = el('aside', 'mc-side right');
    a.innerHTML = mbuHtml('<h2 class="mc-sec"><span class="mc-insp-t">Inspector</span> <button type="button" class="mc-x" data-close="right" title="Hide">×</button></h2><div class="mc-insp"></div>');
    return a;
}
function paintInspector() {
    if (!ui) return;
    const t = rel.tracks[selected];
    const box = ui.querySelector('.mc-insp'), ttl = ui.querySelector('.mc-insp-t');
    if (!t) { ttl.textContent = 'Inspector'; box.innerHTML = mbuHtml('<div class="weak" style="font-size:12px">Select a track to see what each provider found for it.</div>'); return; }
    ttl.textContent = 'Track ' + t.pos + ' · ' + t.title;
    const blk = (h, p) => '<div class="mc-insp-block"><h2 class="mc-sec">' + h + '</h2><div class="weak" style="font-size:11.5px">' + esc(stateText(PROVIDERS.find(x => x.id === p))) + ' · not probed</div></div>';
    box.innerHTML = mbuHtml('<div class="mc-mini">Recording<a class="n" target="_blank" href="/recording/' + esc(t.rec) + '">' + esc((t.rec || '').slice(0, 8)) + '</a></div>'
        + '<div class="mc-mini">Length<span class="n">' + esc(t.len || '?') + '</span></div><div style="height:10px"></div>'
        + blk('ISRCs', 'is') + blk('Recording links', 'is')
        + (S.fusion !== 'off' ? blk('Fusion matches', 'fusion') : '') + (S.ch !== 'off' ? blk('Credits', 'ch') : ''));
}

function footer() {
    const f = el('div', 'mc-foot');
    f.innerHTML = mbuHtml('<div><div class="big">0 changes</div><div class="weak" style="font-size:11px">' + esc(orderText()) + '</div></div><span class="sp"></span>'
        + '<button type="button" class="mc-btn" disabled title="Nothing to run until the providers are connected (#680)">Dry run</button>'
        + '<button type="button" class="mc-btn primary lg" disabled title="Nothing to run until the providers are connected (#680)">Execute →</button>');
    return f;
}
function orderText() {
    return STEPS.map(s => s.lanes ? s.lanes.map(l => l.short).join(' ∥ ') : (modeOf(s) === 'off' ? null : s.short + (s.info ? ' (info)' : ''))).filter(Boolean).join(' → ');
}

function paintBadges() {
    if (!ui) return;
    ui.querySelector('.mc-badges').innerHTML = mbuHtml(PROVIDERS.map(p => '<span class="mc-bdg ' + stateOf(p) + '" title="' + esc(p.provider + ' — ' + stateText(p)) + '">' + esc(p.glyph + ' ' + p.short) + '</span>').join(''));
    ui.querySelectorAll('[data-p]').forEach(n => {
        const p = PROVIDERS.find(x => x.id === n.dataset.p); if (!p) return;
        const dot = n.querySelector('.mc-dot'); if (dot) dot.className = 'mc-dot ' + stateOf(p);
        const st = n.querySelector('.st'); if (st) st.textContent = stateText(p);
    });
}

function paintSides() {
    ui.classList.toggle('no-left', !S.left);
    ui.classList.toggle('no-right', !S.right);
    ui.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('on', !!S[b.dataset.side]));
    fitStrip();
}
function fitStrip() { if (ui && !S.left) mbuFitToolbar(ui.querySelector('.mc-strip'), { gap: 6 }); }

// Rebuild the body when a setting changes what's on screen (a step turned off
// drops its column); the header and the open/closed state stay.
function rebuildBody() {
    const main = ui.querySelector('.mc-main');
    main.replaceWith(body());
    ui.querySelector('.mc-foot').replaceWith(footer());
    paintBadges(); paintInspector();
}
function body() {
    const m = el('div', 'mc-main');
    const c = el('main', 'mc-center');
    c.append(matrix(), releaseCards());
    m.append(orderSidebar(), c, inspector());
    return m;
}

function open() {
    if (ui) return;
    mcStyle();
    rel = rel || readRelease();
    ui = el('div', 'mbu-ui'); ui.id = 'mc-root';
    ui.append(header(), strip(), body(), footer());
    document.body.appendChild(ui);
    document.documentElement.style.overflow = 'hidden';
    paintSides(); paintBadges(); paintInspector();
    ui.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', fitStrip);
    Log.info('opened · sidebars ' + (S.left ? 'order ' : '') + (S.right ? 'inspector' : '') + ' · fusion ' + S.fusion + ' · ch ' + S.ch);
    discover();
}
function close() {
    if (!ui) return;
    ui.remove(); ui = null;
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fitStrip);
    Log.info('closed');
}
function onKey(e) {
    if (e.key !== 'Escape' || document.querySelector('.mbu-ov') || document.getElementById('mbu-logpop')) return;
    close();
}

function onClick(e) {
    const t = e.target;
    const side = t.closest('[data-side]');
    if (side) { S[side.dataset.side] = !S[side.dataset.side]; saveSettings(); paintSides(); return; }
    const x = t.closest('[data-close]');
    if (x) { S[x.dataset.close] = false; saveSettings(); paintSides(); return; }
    const m = t.closest('.mc-seg button');
    if (m) { setMode(m.closest('.mc-seg').dataset.mode, m.dataset.v); return; }
    const row = t.closest('.mc-tbl tbody tr[data-i]');
    if (row) {
        selected = Number(row.dataset.i);
        ui.querySelectorAll('.mc-tbl tr.sel').forEach(r => r.classList.remove('sel'));
        row.classList.add('sel');
        if (!S.right) { S.right = true; saveSettings(); paintSides(); }
        paintInspector();
        Log.debug('selected track ' + rel.tracks[selected].pos + ' (' + rel.tracks[selected].rec + ')');
        return;
    }
    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
        case 'probe': {
            const src = ui.querySelector('.mc-src input').value.trim();
            Log.info('probe' + (src ? ' with source ' + src : '') + ' · fusion ' + S.fusion + ' · ch ' + S.ch);
            discover();
            mbuToast('Providers are not connected yet: Probe only checks which are installed (#680).');
            break;
        }
        case 'log': Log.open(); break;
        case 'cfg': settingsWindow(); break;
        case 'close': close(); break;
    }
}

function setMode(key, v) {
    if (S[key] === v) return;
    Log.info(key + ' mode ' + S[key] + ' → ' + v);
    S[key] = v; saveSettings();
    if (ui) { rebuildBody(); const f = ui.querySelector('.mc-foot .weak'); if (f) f.textContent = orderText(); }
}

function settingsWindow() {
    const ov = el('div', 'mbu-ov');
    const panel = el('div', 'mbu-ov-panel mc-cfg');
    panel.style.width = 'min(460px, 94vw)';
    const opt = (key, label) => '<label><span>' + label + '</span><select data-k="' + key + '">'
        + ['auto', 'ask', 'off'].map(m => '<option value="' + m + '"' + (S[key] === m ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></label>';
    panel.innerHTML = mbuHtml('<div class="mbu-ov-body">' + mbuCfgHeader({ script: 'mission_control', name: 'Mission Control', version: VERSION, icon: '<span style="font-size:20px;color:var(--mbu-accent-text)">' + ICON + '</span>', log: true })
        + '<div class="weak" style="font-size:12px;margin-bottom:6px">Both fetches can take minutes on a big release group or tracklist. Auto runs them during Probe, Ask waits for a button, Off skips the step.</div>'
        + opt('fusion', 'Fusion: RG duplicates') + opt('ch', 'Credit Hoarder: credits')
        + '<label><input type="checkbox" data-k="left"' + (S.left ? ' checked' : '') + '>Show the execution order</label>'
        + '<label><input type="checkbox" data-k="right"' + (S.right ? ' checked' : '') + '>Show the track inspector</label></div>');
    ov.appendChild(panel);
    document.body.appendChild(ov);
    const done = () => { ov.remove(); };
    mbuDismissOn(panel, done);
    panel.querySelector('.mbu-cfg-log').onclick = () => Log.open();
    panel.addEventListener('change', e => {
        const k = e.target.dataset.k; if (!k) return;
        if (e.target.type === 'checkbox') { S[k] = e.target.checked; saveSettings(); if (ui) paintSides(); }
        else setMode(k, e.target.value);
    });
}

/* ── launcher ──────────────────────────────────────────────────────────────── */

function launcher() {
    if (document.getElementById('mc-launch')) return;
    mcStyle();
    const b = el('button', 'mc-launch'); b.id = 'mc-launch'; b.type = 'button';
    b.textContent = ICON; b.title = 'Mission Control';
    b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = '40';   // above Fusion
    b.onclick = () => open();
    document.body.appendChild(b);
    mbRestackCorner('br');
}

if (mbuTestHooks()) window.__mcTest = { open, close, settings: () => Object.assign({}, S), found: () => Object.assign({}, found), release: () => rel };

// <ST-TOKENS> — generated by dev/tokens/sync-tokens.mjs from dev/tokens/design-tokens.mjs — DO NOT EDIT
const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
// </ST-TOKENS>

// <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
const MBU_UI_CSS = '.mbu-help{font-size:12px;color:var(--mbu-accent-text);text-decoration:none;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:1px 8px;white-space:nowrap;line-height:1.6;background:none}.mbu-help:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent);text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(720px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min{font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x{display:none}#mbu-logpop.min{max-height:none;width:auto}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}#mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}';
// Help link markup. Every script's help link is this, pointing at its own README.
// `name` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener"'
        + ' title="open the README in a new tab">' + (label || '? Help') + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'open the README in a new tab';
    a.textContent = label || '? Help';
    return a;
}

// The config (settings) icon every script's settings button shows: the gear in text
// presentation (U+FE0E), so it takes the button's colour instead of an emoji's. #650
var MBU_CFG_ICON = '\u2699\uFE0E';

// HTML for an innerHTML on a page that enforces Trusted Types (YouTube Music, #650): there a
// plain string is refused ("This document requires 'TrustedHTML' assignment"). The policy
// passes the string through; the markup is the script's own. Elsewhere it is the string.
var _mbuTT;
function mbuHtml(s) {
    if (_mbuTT === undefined) {
        _mbuTT = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) _mbuTT = tt.createPolicy('mbu-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings, as before */ }
    }
    return _mbuTT ? _mbuTT.createHTML(String(s)) : String(s);
}

// The first line of every script's log: the script, its version, and what runs it, so a
// pasted log says which manager and browser it came from (#282 started it in Art Station):
//   Log.info(mbuStartupInfo('Fusion'));
//   -> Fusion v2026.10.1 · Violentmonkey 2.31.0 · firefox 143.0 (win)
// Inside String Theory GM_info describes the bundle, so the line names it:
//   -> Fusion (String Theory v2026.10.1) · Tampermonkey 5.3.3 · chrome 140.0 (win)
function mbuStartupInfo(name) {
    var g = null;
    try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
    var s = (g && g.script) || {}, p = (g && g.platform) || {};
    var host = String(s.name || '').replace(/\*$/, ''), ver = s.version || '?';
    var line = !name ? (host || 'Script') + ' v' + ver
        : (host && host !== name) ? name + ' (' + host + ' v' + ver + ')'
        : name + ' v' + ver;
    if (g) line += ' · ' + (g.scriptHandler || 'unknown manager') + (g.version ? ' ' + g.version : '');
    if (p.browserName) line += ' · ' + p.browserName + (p.browserVersion ? ' ' + p.browserVersion : '') + (p.os ? ' (' + p.os + ')' : '');
    else { try { line += ' · ' + navigator.userAgent; } catch (e) { /* no navigator */ } }
    return line;
}

// One copy per page (#653). With String Theory and a standalone install of the same script
// both on, two copies build the same element ids and fight over them: each settings window
// fills in the other's checkboxes, rows flip between two rule sets. So one copy runs, the
// one with the higher version, and the other stays off without a word; only the running
// copy notes it in its log (majkinetor: "disable copy that has lower version without any
// info (except in log of active copy)"):
//   if (!mbuClaim('platform_check', 'Platform Check')) return;   // first line of the script
// The claim is a data- attribute on <html>, which every copy sees whatever its sandbox.
// It is decided at once, so no script starts late. The copy that starts first takes the
// page. When it is the older one, the newer copy stays off for this page and leaves a note
// in localStorage, and from the next page load the older copy finds the note and steps
// aside. A note whose copy has gone (uninstalled) is cleared by the older copy after the
// page loads, so it runs again from the load after.
function mbuClaimVer(v) {
    return String(v || '').split('.').map(function (n) { return parseInt(n, 10) || 0; });
}
function mbuClaimCmp(a, b) {
    var x = mbuClaimVer(a), y = mbuClaimVer(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}
function mbuClaim(key, label) {
    var info = (typeof GM_info !== 'undefined' && GM_info && GM_info.script) || {};
    var name = String(info.name || label || key), ver = String(info.version || '0');
    var mine = (name.slice(-1) === '*' ? 'String Theory' : 'standalone') + ' v' + ver;
    var root = document.documentElement, attr = 'data-mbu-run-' + key, ev = 'mbu-claim-' + key, noteKey = 'mbu-newer-' + key;
    var log = function (msg) { try { if (typeof mbuLog !== 'undefined' && mbuLog.active) mbuLog.active.info(msg); else if (typeof mbuToast !== 'undefined' && typeof mbuToast.log === 'function') mbuToast.log('info', msg); else console.info('[' + (label || key) + '] ' + msg); } catch (e) { /* no log */ } };
    var note = null;
    try { note = JSON.parse(localStorage.getItem(noteKey) || 'null'); } catch (e) { /* storage blocked */ }
    // A note older than this copy is spent. This copy's own note stays: it is what keeps the
    // older copy aside on every later load, not only the next one (#671).
    var noteCmp = note ? mbuClaimCmp(note.ver, ver) : 1;
    if (noteCmp < 0) { try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ } }
    if (noteCmp <= 0) note = null;
    var held = root && root.getAttribute(attr);
    var off = function (why) {
        // tell the running copy (any sandbox hears a DOM event), or the copy that runs after
        // this one (it reads the attribute), and stay quiet
        try { if (root) root.setAttribute(attr + '-off', JSON.stringify({ mine: mine, why: why })); } catch (e) { /* no attribute */ }
        try { document.dispatchEvent(new CustomEvent(ev, { detail: JSON.stringify({ mine: mine, ver: ver, why: why }) })); } catch (e) { /* no event */ }
        return false;
    };
    if (held) {
        var heldVer = (root.getAttribute(attr + '-ver') || '0');
        if (mbuClaimCmp(ver, heldVer) > 0) {
            try { localStorage.setItem(noteKey, JSON.stringify({ ver: ver, mine: mine, at: Date.now() })); } catch (e) { /* storage blocked */ }
            return off('newer, from the next page load');
        }
        return off('older or the same');
    }
    if (note) {
        // a newer copy said it is installed: leave the page to it, unless it never shows up
        var watch = function () {
            setTimeout(function () {
                if (root.getAttribute(attr)) return;
                try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ }
                try { console.info('[' + (label || key) + '] the newer copy (' + note.mine + ') did not start: this copy runs again from the next page load'); } catch (e) { /* no console */ }
            }, 3000);
        };
        if (document.readyState === 'complete') watch(); else window.addEventListener('load', watch, { once: true });
        return off('older: a newer copy runs');
    }
    if (root) { root.setAttribute(attr, mine); root.setAttribute(attr + '-ver', ver); }
    var told = function (o) {
        log((label || key) + ' is installed twice: ' + mine + ' runs, ' + (o.mine || 'another copy') + ' is switched off'
            + (o.why === 'newer, from the next page load' ? ' for this page (it is newer and runs from the next page load)' : '') + '.');
    };
    document.addEventListener(ev, function (e) { var o = {}; try { o = JSON.parse(e.detail); } catch (x) { /* not ours */ } told(o); });
    // a copy that stepped aside before this one started (it found a note): log it once the script's log is up
    var before = root && root.getAttribute(attr + '-off');
    if (before) setTimeout(function () { var o = {}; try { o = JSON.parse(before); } catch (x) { /* not ours */ } told(o); }, 0);
    return true;
}

// Toast. mbuToast(msg) or mbuToast(msg, { ms, kind, at:{x,y}, action:{ label, onClick } }).
//
// An action adds one button to the toast (e.g. "Copy log"): the toast is then clickable,
// stays up longer (12 s unless ms says otherwise), and closes when the button is used.
//
// Severity is inferred from a leading warning/tick glyph when not given — Art
// Station already did that and it is why its toasts reached its log with the
// right level. Set mbuToast.log = function (level, message) {...} once at
// startup and every toast mirrors into that script's own log; leave it unset
// and the toast still shows.
var _mbuToastT = null;
function mbuToast(msg, opts) {
    opts = opts || {};
    var s = String(msg);
    var kind = opts.kind || (/^\s*[⚠✗×]/.test(s) ? 'warn' : /[✓✅]/.test(s) ? 'ok' : 'info');
    try {
        if (typeof mbuToast.log === 'function') mbuToast.log(kind, s.replace(/^\s*[⚠✗×✓✅]\s*/, ''));
    } catch (e) { /* a broken log sink must never swallow the toast */ }
    var el = document.getElementById('mbu-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mbu-toast';
        (document.body || document.documentElement).appendChild(el);
    }
    el.className = 'mbu-toast-on' + (kind !== 'info' ? ' mbu-toast-' + kind : '') + (opts.action ? ' mbu-toast-act' : '');
    el.textContent = s;
    if (opts.action) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mbu-toast-btn'; b.textContent = opts.action.label || 'OK';
        b.onclick = function () {
            try { if (opts.action.onClick) opts.action.onClick(b); } catch (e) { /* the toast still closes */ }
            clearTimeout(_mbuToastT); _mbuToastT = setTimeout(function () { el.className = ''; }, 900);
        };
        el.appendChild(b);
    }
    // Anchor above a click point when asked, clamped into the viewport; otherwise
    // fall back to the centred default by clearing the inline placement.
    if (opts.at) {
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, opts.at.x - w / 2)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, opts.at.y - h - 10)) + 'px';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
    } else {
        el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
    }
    clearTimeout(_mbuToastT);
    _mbuToastT = setTimeout(function () { el.className = ''; }, opts.ms || (opts.action ? 12000 : 2600));
    return el;
}

// Config-window title bar.
//
//   mbuCfgHeader({ script:'art_station', name:'Art Station', version:'2026.9.2',
//                  icon:'<svg…>' | '<img…>', log:true, logClass:'as-setup-logbtn' })
//
// Returns the markup for the whole bar. 'log' adds the Log button; a script with
// no log window leaves it out rather than shipping a dead control. logClass /
// logId are carried through IN ADDITION to the shared class so a script's
// existing click handler keeps working — adopting the component must not mean
// rewiring every listener at the same time.
function mbuCfgHeader(o) {
    o = o || {};
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    };
    var html = '<div class="mbu-cfg-h">';
    if (o.icon) html += '<span class="mbu-cfg-ic">' + o.icon + '</span>';
    html += '<span class="mbu-cfg-name">' + esc(o.name) + '</span>';
    if (o.version) html += '<span class="mbu-cfg-ver" title="installed script version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' title="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use: Apollo and Art Station 10 (never on the same page), Falcon 20,
// Fusion above Falcon. Scribe is not on the shared block and keeps a copy of this.
function mbRestackCorner(corner) {
    var bottom = corner[0] === 'b', right = corner[1] === 'r';
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return getComputedStyle(el).display !== 'none'; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = pos + 'px';
        el.style[right ? 'right' : 'left'] = '14px';
        pos += el.getBoundingClientRect().height + 8;
    });
}

// Activity log: the session's log lines plus the floating window that shows them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// window appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, win = null;
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3); };
    var str = function (v) {
        if (typeof v === 'string') return v;
        if (v instanceof Error) return v.message || String(v);
        if (v && v.nodeType) return '<' + (v.tagName || 'node').toLowerCase() + '>';
        try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
    };
    var esc = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    };
    // escape, then make http(s) URLs clickable, keeping trailing punctuation out of them
    var linkify = function (s) {
        return esc(s).replace(/(https?:\/\/[^\s<]+)/g, function (m) {
            var t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];
            var url = m.slice(0, m.length - t.length);
            return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + t;
        });
    };
    var load = o.load || function (k) { try { return GM_getValue(k, undefined); } catch (e) { return undefined; } };
    var save = o.save || function (k, v) { try { GM_setValue(k, v); } catch (e) { /* no storage: the window just forgets */ } };
    var state = function () { try { return JSON.parse(load(o.key) || '{}') || {}; } catch (e) { return {}; } };
    var remember = function (patch) { try { save(o.key, JSON.stringify(Object.assign(state(), patch))); } catch (e) { /* see save */ } };
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + e.msg; };

    function add(sev, args) {
        var msg = Array.prototype.map.call(args, str).join(' ').replace(/\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        if (win) win.append(e);
    }
    function title() {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    function markdown() {
        var body = buf.length ? buf.map(line).join('\n') : '(no activity logged)';
        if (dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
        var n = (warn || error) ? ' (' + warn + ' warning' + (warn === 1 ? '' : 's') + ', ' + error + ' error' + (error === 1 ? '' : 's') + ')' : '';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title() + ' — session log' + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
    }
    function copy(btn) {
        var md = markdown();
        var done = function (ok) {
            if (!btn) return;
            var was = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = was;
            btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
            setTimeout(function () { btn.textContent = was; }, 1500);
        };
        var fallback = function () {
            var ok = false;
            try {
                var ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
            } catch (x) { /* nothing left to try */ }
            done(ok);
        };
        try { navigator.clipboard.writeText(md).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
    }
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop'; pop.className = 'mbu-logpop';
        pop.innerHTML = mbuHtml('<div class="mbu-logpop-h"><b>' + esc(o.header || 'Activity log') + '</b> <span class="mbu-log-badge"></span><span class="mbu-logpop-sp"></span>'
            + '<button class="mbu-logpop-clear" type="button" title="Clear the log (the lines so far are gone)">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>'
            + '<button class="mbu-logpop-min" type="button" title="Minimize">–</button>'
            + '<button class="mbu-logpop-x" type="button" title="Close">✕</button></div>'
            + '<div class="mbu-log-list"></div>');
        document.body.appendChild(pop);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        var list = pop.querySelector('.mbu-log-list'), badge = pop.querySelector('.mbu-log-badge');
        var row = function (e) {
            var d = document.createElement('div');
            d.className = 'mbu-log-li mbu-log-' + e.sev;
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span><span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        var showBadge = function () { badge.textContent = '(' + buf.length + ')' + (warn || error ? ' · ' + warn + '⚠ ' + error + '✖' : ''); };
        // the rows, once; later lines are appended one by one
        var frag = document.createDocumentFragment();
        buf.forEach(function (e) { frag.appendChild(row(e)); });
        if (buf.length) list.appendChild(frag);
        else list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>');
        showBadge();
        list.scrollTop = list.scrollHeight;
        // badge and scroll once per frame, however many lines arrive in it
        var queued = false, follow = true;
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        var onKey = function (e) { if (e.key === 'Escape') close(); };
        win = {
            el: pop,
            append: function (e) {
                var empty = list.querySelector('.mbu-log-empty'); if (empty) empty.remove();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            off: function () { document.removeEventListener('keydown', onKey); },
            cleared: function () { list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>'); showBadge(); },
        };
        pop.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        pop.querySelector('.mbu-logpop-copy').onclick = function () { copy(pop.querySelector('.mbu-logpop-copy')); };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        minBtn.onclick = function () { var m = pop.classList.toggle('min'); setMin(m); remember({ min: m }); };
        if (st.min) { pop.classList.add('min'); setMin(true); }
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button')) return;
            e.preventDefault();
            var r = pop.getBoundingClientRect();
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
            var ox = e.clientX - r.left, oy = e.clientY - r.top;
            var mv = function (ev) {
                pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
                pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                if (!pop.classList.contains('min')) {
                    restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                    remember({ left: pop.style.left, top: pop.style.top });
                }
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        document.addEventListener('keydown', onKey);
        return pop;
    }
    // empty the log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (win) win.cleared();
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) { win.off(); win.el.remove(); win = null; if (!quiet) remember({ open: false }); }
        if (stray) stray.remove();   // another script's window: one log window at a time
    }
    var api = {
        info: function () { add('info', arguments); },
        warn: function () { add('warn', arguments); },
        err: function () { add('error', arguments); },
        error: function () { add('error', arguments); },
        ok: function () { add('ok', arguments); },
        debug: function () { add('debug', arguments); },
        add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1)); },
        open: open,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: markdown,
        copy: copy,
        clear: clear,
        lines: function () { return buf.map(line); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
    };
    mbuLog.active = api;   // the script's own log, for helpers that note things in it (mbuClaim)
    return api;
}

// Dismiss-on-outside-click, with the trailing click SWALLOWED.
//
//   var off = mbuDismissOn(popoverEl, close);   // off() to detach early
//
// #305: a popover torn down on mousedown removes what was under the cursor, so
// the click that follows lands on whatever the page reflowed into that spot and
// activates it. Tearing down on click instead just moves the problem. So: close
// on outside mousedown, then eat exactly one click in the capture phase. This is
// the single most repeated interaction bug in these scripts and it belongs in
// one place — it is why #563 says interaction is part of the contract.
//
// Esc closes too, innermost first: the handler is registered in capture and stops
// propagation, so a popover inside a modal does not close the modal as well.
function mbuDismissOn(el, close, opts) {
    opts = opts || {};
    var closed = false;
    var onDown = function (e) {
        if (closed || !el || el.contains(e.target)) return;
        if (opts.ignore && e.target.closest && e.target.closest(opts.ignore)) return;
        finish();
        // swallow the click this mousedown will produce, once
        var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', eat, true); };
        document.addEventListener('click', eat, true);
        setTimeout(function () { document.removeEventListener('click', eat, true); }, 400);
    };
    var onKey = function (e) {
        if (closed || e.key !== 'Escape') return;
        e.stopPropagation();
        finish();
    };
    function finish() {
        if (closed) return;
        closed = true;
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        try { close(); } catch (err) { /* a throwing closer must not leave listeners behind */ }
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return finish;
}

// Collapse a toolbar to icon-only when its buttons would wrap.
//
//   mbuFitToolbar(barEl)            // call on build, and on resize
//
// Measured by SUMMING child widths rather than reading scrollWidth or comparing
// offsetTop: a bar with flex:1 spacers never overflows its own scroll box, so
// both of those report "fits" right up until it visibly wraps. Art Station
// learned that the hard way (#234) and it is the only reason this is a helper
// rather than one CSS rule.
//
// opts.gap    inter-item gap in px (default 11)
// opts.pad    horizontal padding to leave (default 24)
// opts.spacer selector for flexible spacers, which must not count (default .mbu-sp)
function mbuFitToolbar(bar, opts) {
    if (!bar) return false;
    opts = opts || {};
    var gap = opts.gap == null ? 11 : opts.gap;
    var pad = opts.pad == null ? 24 : opts.pad;
    var spacer = opts.spacer || '.mbu-sp';
    bar.classList.remove('mbu-compact');            // measure at full labels
    var kids = [].slice.call(bar.children);
    var need = gap * Math.max(0, kids.length - 1);
    for (var i = 0; i < kids.length; i++) {
        if (kids[i].matches && kids[i].matches(spacer)) continue;
        need += kids[i].offsetWidth;
    }
    var compact = need > bar.clientWidth - pad;
    bar.classList.toggle('mbu-compact', compact);
    return compact;
}

// Publish the components on a shared namespace. Three reasons, in order:
//
//  1. it is the cross-userscript contract #563 is about — another script (or a
//     future one) gets the standard widgets without copying them, the same way
//     Mammoth already exposes its field-memory through a documented convention;
//  2. it makes the components testable from outside, which is the only way to
//     assert the *behaviour* half of the contract rather than just the markup;
//  3. it costs nothing when several scripts do it — the definitions are
//     byte-identical, so first writer wins and the rest are no-ops.
//
// Guarded per key, never clobbering: a script that loaded first keeps its copy,
// and a page that defines an unrelated window.MBU is left alone.
// Theme recognition. #564: "we don't have to conform to Stylus vars, we could
// probably use them as a recognition signal to enable our own dark theme."
//
// That is the right way round. Reading --background/--text and hoping every
// derived colour lands somewhere readable is guesswork that fails one token at a
// time; knowing WHICH theme we are in lets the token set say so outright, and
// lets us hand the browser the one thing CSS variables cannot express —
// color-scheme, which is what actually paints a checkbox dark instead of leaving
// a white (Firefox: black) box on a dark panel.
//
// The signal is the rendered page, not a particular userstyle's variable names:
// whatever painted the body, we measure its luminance. So this works for Stylus,
// for a browser extension, for MusicBrainz shipping its own dark mode one day,
// and for a user who just set --background by hand.
//
//   · an explicit --mbu-theme (light|dark) always wins — the escape hatch;
//   · otherwise the page background decides;
//   · re-checked when stylesheets arrive, because Stylus often lands after us.
function mbuThemeOf(bg) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || '');
    if (!m) return null;
    if (m[4] !== undefined && +m[4] < 0.5) return null;      // transparent tells us nothing
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
    return L < 0.35 ? 'dark' : 'light';
}
// #569 (chaban-mb) — write only when the value actually changes.
//
// The DOM does not do this for you. classList.add of a token already present,
// classList.toggle to the state it is already in, setAttribute with the value it
// already has: each one re-sets the attribute and dispatches a mutation record.
// Harmless once; these run from 2Hz heartbeats and from observers that react to
// each other, and the measured idle cost on the release editor was 66 records a
// second, of which 93% came from writes that changed nothing (see
// dev/ui/measure-569-idle-mutations.mjs).
//
// Semantically these are exact no-ops: they skip a write ONLY when the value is
// already the one being written, so nothing that reads the DOM afterwards can
// tell the difference. That is the whole reason they are safe to sprinkle around
// a 2Hz loop.
function mbuCls(el, token, on) {
    if (!el || !el.classList) return;
    if (el.classList.contains(token) !== !!on) el.classList.toggle(token, !!on);
}
function mbuAttr(el, name, value) {
    if (!el) return;
    if (value === null || value === undefined || value === false) {
        if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
    }
}
// For IDL properties (disabled, title, textContent, style.display …). Reading
// them is cheap; writing them is not, and textContent in particular replaces
// every child node.
//
// ⚠ textContent is the one to think twice about: its getter concatenates the
// text of ALL descendants, so on an element with child ELEMENTS the comparison
// can match while the DOM shape is wrong, and the guard then skips a write that
// would have flattened it. Only use it where the target holds text and nothing
// else.
function mbuProp(obj, prop, value) {
    if (!obj) return;
    if (obj[prop] !== value) obj[prop] = value;
}

// #569: the one element mbuTheme resolves --background through. Looked up by id
// rather than kept in a variable, so the seven scripts of a bundle share ONE
// probe instead of adding seven, and so it heals itself if anything removes it.
// It lives in <body>: a permanent stray node under <html>, outside head and
// body, is the sort of thing another script's document scan trips over.
function mbuProbe() {
    var p = document.getElementById('mbu-theme-probe');
    if (p) return p;
    if (!document.body) return null;
    p = document.createElement('span');
    p.id = 'mbu-theme-probe';
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background:var(--background)';
    document.body.appendChild(p);
    return p;
}
function mbuTheme() {
    var root = document.documentElement;
    try {
        var cs = getComputedStyle(root);
        var forced = (cs.getPropertyValue('--mbu-theme') || '').trim();
        var t = (forced === 'dark' || forced === 'light') ? forced
            : (mbuThemeOf(getComputedStyle(document.body).backgroundColor)
                || mbuThemeOf(cs.backgroundColor)
                || mbuThemeOf(cs.getPropertyValue('--mbu-bg'))
                || 'light');
        if (root.getAttribute('data-mbu-theme') !== t) root.setAttribute('data-mbu-theme', t);

        // Should we adopt the userstyle's OWN shades, or use our own palette?
        // Only if its --background actually agrees with the theme we detected.
        // A userstyle can paint the page dark with ordinary rules and still leave
        // --background at a light value for its own purposes; taking that on
        // trust hands us a light surface under a correct dark theme, which is
        // indistinguishable from the bug it looks like. Measured, not assumed.
        var seed = null;
        var raw = (cs.getPropertyValue('--background') || '').trim();
        if (raw) {
            // Resolved through a real element, because --background may itself be
            // a var(), a named colour, or anything else CSS accepts.
            //
            // #569 (chaban-mb): this used to CREATE and REMOVE that element on
            // every call, as a direct child of <html>. mbuTheme re-runs whenever
            // the root or body class changes, Mammoth watches the whole document
            // for childList changes and reacts by toggling classes on <html>, and
            // those class changes wake mbuTheme again — a self-feeding loop,
            // measured at 12 root-node mutations a second on an idle page, which
            // is what makes DevTools blink.
            //
            // One element, created once and left in place, breaks it: the value
            // is still resolved LIVE on every call (a cached reading would freeze
            // the theme at whatever it was before Stylus injected, which is the
            // bug this whole function exists to avoid) but nothing is added to or
            // removed from the DOM to read it.
            var probe = mbuProbe();
            var got = null;
            if (probe) {
                got = mbuThemeOf(getComputedStyle(probe).backgroundColor);
            } else {
                // No <body> yet — document-start. Fall back to the transient
                // element for these first one or two calls; the idle loop this
                // avoids cannot exist before the page has a body anyway.
                var tmp = document.createElement('span');
                tmp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--background)';
                document.documentElement.appendChild(tmp);
                got = mbuThemeOf(getComputedStyle(tmp).backgroundColor);
                tmp.remove();
            }
            if (got === t) seed = 'theme';
        }
        // guarded: setAttribute dispatches a mutation record even when the value
        // is unchanged, and this runs several times a second
        if (seed) { if (root.getAttribute('data-mbu-seed') !== seed) root.setAttribute('data-mbu-seed', seed); }
        else if (root.hasAttribute('data-mbu-seed')) root.removeAttribute('data-mbu-seed');
        return t;
    } catch (e) { return 'light'; }
}
// A document-start script runs before the document is parsed: documentElement can
// still be null, and <head> and <body> don't exist. Observing a null root threw, the
// catch below swallowed it, and nothing (the watches, the re-checks) was ever set up,
// so such a script never read the theme at all (#625). It starts on the parsed page.
function mbuThemeStart() { try {
    mbuTheme();
    // Stylus and friends inject after us often enough that a one-shot read is
    // wrong about half the time. Watch for stylesheets ARRIVING — head childList
    // plus the root's own attributes — and never the whole subtree: this runs on
    // the release editor, where a subtree observer calling getComputedStyle is a
    // layout thrash on every keystroke.
    var _mbuThemeT = 0;
    var _mbuThemeSoon = function () {
        clearTimeout(_mbuThemeT);
        _mbuThemeT = setTimeout(mbuTheme, 150);
    };
    var _mbuThemeObs = new MutationObserver(_mbuThemeSoon);
    _mbuThemeObs.observe(document.documentElement, { attributeFilter: ['style', 'class'] });
    // ⚠ #569: characterData, not just childList. Until the idle thrash was fixed
    // this function ran several times a second whether or not anything had
    // changed — Apollo re-added a body class at 2Hz, which woke this observer,
    // which is how a theme change was ever noticed. That accidental polling was
    // LOAD-BEARING: with the thrash gone and only head-childList watched, a
    // userstyle that REWRITES ITSELF (Stylus editing it live, or one switching
    // palette) adds and removes no nodes, so nothing woke us and the theme went
    // stale. Caught by verify-569-theme-still-tracks.mjs, which passes on the
    // pre-fix build and failed on the first version of this one.
    if (document.head) _mbuThemeObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    if (document.body) _mbuThemeObs.observe(document.body, { attributeFilter: ['style', 'class'] });
    // …and the case that produces no DOM mutation at all: the OS flipping to dark
    // under a userstyle with a prefers-color-scheme query. Nothing above can see
    // that, and nothing did before either — it was simply never noticed while the
    // page was re-checking itself several times a second.
    try {
        var _mbuMq = matchMedia('(prefers-color-scheme: dark)');
        if (_mbuMq.addEventListener) _mbuMq.addEventListener('change', _mbuThemeSoon);
        else if (_mbuMq.addListener) _mbuMq.addListener(_mbuThemeSoon);
    } catch (e) {}
    setTimeout(mbuTheme, 400);
    setTimeout(mbuTheme, 2000);
} catch (e) { /* no observer, no theme switching — the light defaults still apply */ } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbuThemeStart, { once: true });
else mbuThemeStart();

try {
    var _mbuNs = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    if (!_mbuNs.MBU) _mbuNs.MBU = {};
    if (!_mbuNs.MBU.theme) _mbuNs.MBU.theme = mbuTheme;
    if (!_mbuNs.MBU.helpHref) _mbuNs.MBU.helpHref = mbuHelpHref;
    if (!_mbuNs.MBU.helpHtml) _mbuNs.MBU.helpHtml = mbuHelpHtml;
    if (!_mbuNs.MBU.helpEl) _mbuNs.MBU.helpEl = mbuHelpEl;
    if (!_mbuNs.MBU.toast) _mbuNs.MBU.toast = mbuToast;
    if (!_mbuNs.MBU.cfgHeader) _mbuNs.MBU.cfgHeader = mbuCfgHeader;
    if (!_mbuNs.MBU.dismissOn) _mbuNs.MBU.dismissOn = mbuDismissOn;
    if (!_mbuNs.MBU.fitToolbar) _mbuNs.MBU.fitToolbar = mbuFitToolbar;
} catch (e) { /* a locked-down page must not stop the script loading */ }
// </ST-UI>

launcher();
})();
