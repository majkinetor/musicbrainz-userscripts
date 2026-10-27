// ==UserScript==
// @name         Fusion
// @namespace    https://musicbrainz.org/
// @version      2026.10.27.151500
// @description  Merge-recordings assistant for MusicBrainz: gather a pool of candidate recordings from a release / release group / recording page (or paste any MBID/URL), auto-match them into merge groups by ISRC / AcoustID / length / title+artist, review and adjust the groups, then submit the merges directly in the background — no MB merge page involved.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPkZ1c2lvbjwvdGl0bGU+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYTE4NGY4IiBzdHJva2Utd2lkdGg9IjUuNSI+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiLz4KICAgIDxlbGxpcHNlIGN4PSI2NCIgY3k9IjY0IiByeD0iNTIiIHJ5PSIyMiIgdHJhbnNmb3JtPSJyb3RhdGUoNjAgNjQgNjQpIi8+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiIHRyYW5zZm9ybT0icm90YXRlKDEyMCA2NCA2NCkiLz4KICA8L2c+CiAgPGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iMTEiIGZpbGw9IiM3YzRkZmYiLz4KPC9zdmc+Cg==
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/fusion/README.md
// @match        https://*.musicbrainz.org/release/*
// @match        https://*.musicbrainz.org/release-group/*
// @match        https://*.musicbrainz.org/recording/*
// @match        https://*.musicbrainz.org/artist/*/recordings
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// @connect      api.acoustid.org
// ==/UserScript==

(function () {
'use strict';
// one copy per page: with String Theory and a standalone install both on, the newer one runs (#653)
if (!mbuClaim('fusion', 'Fusion')) return;

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '?';   // GM_info carries the real one; every script manager provides it (a hard-coded copy only ever went stale)
const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/fusion/README.md';
const ICON = '⚛';
// the corner launcher wears the script's own icon (the same picture as @icon)
const ICON_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPkZ1c2lvbjwvdGl0bGU+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYTE4NGY4IiBzdHJva2Utd2lkdGg9IjUuNSI+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiLz4KICAgIDxlbGxpcHNlIGN4PSI2NCIgY3k9IjY0IiByeD0iNTIiIHJ5PSIyMiIgdHJhbnNmb3JtPSJyb3RhdGUoNjAgNjQgNjQpIi8+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiIHRyYW5zZm9ybT0icm90YXRlKDEyMCA2NCA2NCkiLz4KICA8L2c+CiAgPGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iMTEiIGZpbGw9IiM3YzRkZmYiLz4KPC9zdmc+Cg==';
const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

// Only mount on the exact entity pages Fusion knows how to seed from — never on
// action subpages (edit, edit-relationships, merge, tags, …), so it never collides
// with MB's own /recording/merge page or Group Therapy's edit-relationships tools.
function detectScope() {
    const p = location.pathname;
    let m = p.match(/^\/release\/([0-9a-fA-F-]{36})\/?$/); if (m) return { type: 'release', mbid: m[1].toLowerCase() };
    m = p.match(/^\/release-group\/([0-9a-fA-F-]{36})\/?$/); if (m) return { type: 'release-group', mbid: m[1].toLowerCase() };
    m = p.match(/^\/recording\/([0-9a-fA-F-]{36})\/?$/); if (m) return { type: 'recording', mbid: m[1].toLowerCase() };
    m = p.match(/^\/artist\/([0-9a-fA-F-]{36})\/recordings\/?$/); if (m) return { type: 'artist-recordings', mbid: m[1].toLowerCase() };
    return null;
}
const SCOPE = detectScope();
if (!SCOPE) return;

// ── tiny DOM helpers ─────────────────────────────────────────────────────
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── activity log: the shared window and buffer (mbuLog, in the ST-UI block below;
   #283 / #529, shared since X12 of #623). Every Log.* line lands there, and the
   Log button opens it, copy/pastable as a Markdown <details> block. ── */
const Log = mbuLog({ name: 'Fusion', version: VERSION, header: 'Fusion — activity log', key: 'fusion.logwin', before: () => fsStyle() });
Log.info(mbuStartupInfo('Fusion'));
const openLog = () => Log.open();

/* ── GM_xmlhttpRequest promisified (ported from isrc_scout's http/gmGet/gmPost) —
   used only for the merge_queue/merge GET+POST sequence; everything else (read-only
   same-origin WS2/ws-js calls) uses plain fetch(), same as group_therapy's txp* helpers. ── */
function http(opts) {
    const t0 = Date.now();
    const tag = (opts.method || 'GET') + ' ' + String(opts.url).replace(location.origin, '');
    Log.info('→ ' + tag);
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest(Object.assign({
            timeout: 20000,
            onload: r => {
                const ms = Date.now() - t0;
                if (r.status >= 200 && r.status < 300) Log.info('← ' + r.status + ' ' + tag + ' (' + ms + 'ms)');
                else Log.warn('← ' + r.status + ' ' + tag + ' (' + ms + 'ms)');
                resolve(r);
            },
            onerror: () => { Log.error('✗ network ' + tag); reject(new Error('network error')); },
            ontimeout: () => { Log.error('✗ timeout ' + tag); reject(new Error('timeout')); },
        }, opts));
    });
}
const gmGet = (url, headers) => http({ method: 'GET', url, headers: headers || {} });
const gmPost = (url, data, headers) => http({ method: 'POST', url, data, headers: headers || {} });

// MusicBrainz's /ws/2 goes through the shared request gate (#633): one budget for every
// script and tab on the origin, and one 503 holds them all. (#529 had Fusion's own global
// gate for the same reasons: its enrichment workers kept knocking while the server asked
// everyone to wait. The shared gate keeps that, across scripts.)
// <ST-NET> — generated by dev/net/sync-gate.mjs from dev/net/mb-gate.mjs — DO NOT EDIT
const MBN_GAP = 1000;
const MBN_BURST = 3;
const MBN_KEY = "mbu:mb-gate";
const MBN_LOCK = "mbu-mb-gate";
const MBN_MAX_HOLD = 60000;
function mbnGated(url) {
    const s = String(url || '');
    return /^\/ws\/2\//.test(s) || /^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org\/ws\/2\//i.test(s);
}
async function mbnState(fn) {
    const rw = () => {
        let s = null, stored = true;
        try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { stored = false; }
        const g = globalThis.__mbnGate || (globalThis.__mbnGate = { tat: 0, cool: 0, hot: 0 });
        if (!stored) s = g;                                                        // no storage: this page's copy only
        else if (!s || typeof s !== 'object') s = { tat: 0, cool: 0, hot: 0 };   // none yet (or cleared): a fresh schedule
        const out = fn(s);
        Object.assign(g, s);
        try { localStorage.setItem(MBN_KEY, JSON.stringify({ tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0 })); } catch (e) {}
        return out;
    };
    // The lock is held only for rw()'s synchronous moment, so a wait of seconds means it is
    // stuck (a frozen or sandboxed holder): give up on it and go unlocked rather than hang
    // every request behind it.
    let timer = 0;
    try {
        if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
            const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
            if (ctrl) timer = setTimeout(() => ctrl.abort(), 3000);
            return await navigator.locks.request(MBN_LOCK, ctrl ? { signal: ctrl.signal } : {}, rw);
        }
    } catch (e) { /* no Web Locks here (an insecure or sandboxed context), or stuck: unlocked, like a lone script */ } finally { clearTimeout(timer); }
    return rw();
}
async function mbnSlot(o) {
    o = o || {};
    const t0 = Date.now(), background = o.background !== false;
    const booked = await mbnState(s => {
        const now = Date.now(), cool = s.cool || 0, tat = s.tat || 0;
        let at = background ? Math.max(now, tat - (MBN_BURST - 1) * MBN_GAP) : now;
        at = Math.max(at, cool);
        s.tat = Math.max(tat, at) + MBN_GAP;
        return { at, why: cool > now && cool >= at ? 'MusicBrainz asked everyone to wait' : 'pacing, one request a second' };
    });
    let told = false;
    for (;;) {
        if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
        let cool = 0;
        try { cool = (JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}).cool || 0; } catch (e) { cool = (globalThis.__mbnGate || {}).cool || 0; }
        const until = Math.max(booked.at, cool), left = until - Date.now();   // a hold that appeared while we queued
        if (left <= 0) break;
        if (!told && until - t0 > 1000 && o.log) { told = true; o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + ' waits ' + Math.round((until - t0) / 100) / 10 + 's (' + (cool > booked.at ? 'MusicBrainz asked everyone to wait' : booked.why) + ')'); }
        await new Promise(r => setTimeout(r, Math.min(left, 250)));   // in slices, so a cancel lands promptly
    }
    return { ok: true, waited: Date.now() - t0 };
}
async function mbnAnswer(status, header, o) {
    o = o || {};
    if (status === 429 || status === 503) {
        const raw = header ? header('Retry-After') : null;
        const secs = Number(raw), date = raw ? Date.parse(raw) : NaN;
        const ra = Number.isFinite(secs) ? secs * 1000 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
        const hold = await mbnState(s => {
            const now = Date.now();
            // One throttle, one step: the requests already in flight when it began all answer
            // 503 too, and each must not stretch the hold again. A throttle long gone doesn't
            // count at all: `hot` is shared and persists, and would otherwise slow every later
            // page for good.
            if (now > (s.cool || 0) + 30000) s.hot = 0;
            if (now >= (s.cool || 0)) s.hot = Math.min((s.hot || 0) + 1, 6);
            const ms = Math.min(Math.max(1000, ra) * Math.max(1, s.hot), MBN_MAX_HOLD);
            s.cool = Math.max(s.cool || 0, Date.now() + ms);
            return s.cool - Date.now();
        });
        if (o.log) o.log('warn', 'MusicBrainz gate: HTTP ' + status + (raw != null ? ' (Retry-After: ' + raw + ')' : '') + ' — every script holds ' + Math.round(hold / 100) / 10 + 's');
        return { throttled: true, hold };
    }
    if (status >= 200 && status < 500) await mbnState(s => { if (s.hot) s.hot = Date.now() > (s.cool || 0) + 30000 ? 0 : s.hot - 1; });
    return { throttled: false, hold: 0 };
}
async function mbnFetch(url, init, o) {
    o = o || {};
    if (!mbnGated(url)) {
        const r = await fetch(url, init);
        if (!mbnWebsite(url) || !(await mbnIsCheck(r))) return r;
        // #733: MusicBrainz's browser check answered instead: nothing was done (a POST is safe
        // to repeat), so pass the check and ask again
        return (await mbnReverify(url, init, o)) ? fetch(url, init) : r;
    }
    const tries = o.tries || 4;
    for (let attempt = 1; ; attempt++) {
        const slot = await mbnSlot(o);
        if (!slot.ok) return null;
        const r = await fetch(url, init);
        const a = await mbnAnswer(r.status, n => r.headers.get(n), o);
        if (!a.throttled || attempt >= tries) return r;
    }
}
function mbnHot() {
    let s;
    try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}; } catch (e) { s = globalThis.__mbnGate || {}; }
    return Date.now() > (s.cool || 0) + 30000 ? 0 : (s.hot || 0);   // a throttle long gone is over
}
function mbnRawHeader(raw, name) {
    const want = String(name).toLowerCase();
    for (const line of String(raw || '').split(/\r?\n/)) {
        const i = line.indexOf(':');
        if (i > 0 && line.slice(0, i).trim().toLowerCase() === want) return line.slice(i + 1).trim();
    }
    return null;
}
function mbnWebsite(url) {
    const s = String(url || '');
    if (mbnGated(s)) return false;
    if (/^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org(\/|$)/i.test(s)) return true;
    return /^\/(?!\/)/.test(s) && typeof location !== 'undefined' && /(^|\.)musicbrainz\.org$/i.test(location.hostname);
}
async function mbnIsCheck(r) {
    try {
        if (!r || !/text\/html/i.test((r.headers && r.headers.get('content-type')) || '')) return false;
        const head = (await r.clone().text()).slice(0, 3000);
        return /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(head);
    } catch (e) { return false; }
}
function mbnReverify(url, init, o) {
    o = o || {};
    const log = (lvl, m) => { try { if (o.log) o.log(lvl, m); else (lvl === 'warn' ? console.warn : console.info)('[MusicBrainz gate] ' + m); } catch (e) {} };
    const g = globalThis.__mbnCheck || (globalThis.__mbnCheck = { busy: null, failedAt: 0 });
    if (g.busy) return g.busy;
    let target;
    try { target = new URL(String(url), location.href); } catch (e) { return Promise.resolve(false); }
    if (target.host !== location.host || typeof document === 'undefined') { log('warn', 'MusicBrainz asked to verify the browser — open any MusicBrainz page, then retry'); return Promise.resolve(false); }
    if (Date.now() - g.failedAt < 60000) return Promise.resolve(false);   // just failed: don't loop
    // a POST's URL can't be loaded: the check is per browser, so any light GET passes it
    const method = String((init && init.method) || 'GET').toUpperCase();
    const src = method === 'GET' ? target.href : location.origin + '/ws/js/entity/89ad4ac3-39f7-470e-963a-56509c546377';
    const t0 = Date.now();
    log('warn', 'MusicBrainz asked to verify the browser again ("Verifying your browser") — passing it in a hidden frame');
    g.busy = new Promise(resolve => {
        const fr = document.createElement('iframe');   // fresh each time, never re-navigated
        fr.setAttribute('aria-hidden', 'true'); fr.setAttribute('data-mbn-check', ''); fr.tabIndex = -1;
        fr.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;pointer-events:none';
        let loads = 0, done = false, timer = 0;
        const finish = ok => {
            if (done) return; done = true; clearTimeout(timer); fr.remove(); g.busy = null;
            if (ok) log('info', 'browser check passed in ' + (Date.now() - t0) + ' ms — retrying');
            else {
                g.failedAt = Date.now();
                const m = 'MusicBrainz wants to verify your browser — open any MusicBrainz page in another tab, then retry';
                log('warn', m + ' (the hidden frame did not clear it in 20 s)');
                try { if (o.notify) o.notify(m); } catch (e) {}
            }
            resolve(ok);
        };
        // the first load is the check; it posts its answer and is redirected to the real URL
        fr.onload = () => {
            loads++;
            let still;
            try { const d = fr.contentDocument; still = !d || /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(d.documentElement ? d.documentElement.outerHTML.slice(0, 3000) : ''); }
            catch (e) { still = loads < 2; }
            if (!still) finish(true);
        };
        timer = setTimeout(() => finish(false), 20000);
        fr.src = src;
        (document.body || document.documentElement).appendChild(fr);
    });
    return g.busy;
}
// </ST-NET>
let _netTrouble = null;   // { kind, detail, at } — surfaced in the title bar, not just logged
function setNetTrouble(kind, detail) {
    _netTrouble = { kind, detail, at: Date.now() };
    renderNetBanner();
}
function clearNetTrouble() { if (_netTrouble) { _netTrouble = null; renderNetBanner(); } }
// #529 (majkinetor): "that yellowish network error appears and disappears now as
// needed which is intrusive as it moves entire window up down. Let it just show
// in the title instead where loading message is". It used to be a block in the
// flow, so every throttle blip reflowed the pool and groups beneath it — on a
// run with repeated 503s the whole window jittered. It now lives in the header
// alongside the loading text, where appearing and vanishing costs no layout.
function renderNetBanner() {
    const el = document.getElementById('fs-netbanner'); if (!el) return;
    if (!_netTrouble) { el.style.display = 'none'; el.textContent = ''; el.dataset.tip = ''; return; }
    el.style.display = '';
    const long = _netTrouble.kind === 'offline'
        ? 'No connection to MusicBrainz — ' + _netTrouble.detail
        : 'MusicBrainz is throttling requests — ' + _netTrouble.detail;
    // short in the bar, the detail in the tooltip: the header is a single line
    // and a long message would push the scope label out of it.
    el.textContent = '⚠ ' + (_netTrouble.kind === 'offline' ? 'no connection' : 'throttled');
    el.dataset.tip = '⚠ ' + long + '\nClick: the log';
    el.className = 'fs-netbanner' + (_netTrouble.kind === 'offline' ? ' fs-netbanner-err' : '');
}
const gateLog = (lv, m) => (lv === 'warn' ? Log.warn : Log.info)(m);
async function wsGet(path, retries) {
    retries = retries == null ? 4 : retries;
    for (let attempt = 0; attempt <= retries; attempt++) {
        await mbnSlot({ label: 'GET ' + path, log: gateLog });   // the shared pace, and any hold MusicBrainz asked for
        const t0 = Date.now();
        try {
            Log.info('GET ' + path + (attempt ? ' (retry ' + attempt + '/' + retries + ')' : ''));
            // no-store: MB's WS2 sends NO cache headers, so browsers cache these
            // heuristically and can serve a stale response — which silently fed
            // Fusion out-of-date ISRC data. #529
            const r = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
            const ms = Date.now() - t0;
            const a = await mbnAnswer(r.status, n => r.headers.get(n), { log: gateLog });
            if (a.throttled) {
                // the retry waits out the shared hold in mbnSlot: no private backoff on top (#633)
                Log.warn('GET ' + path + ' → ' + r.status + ' (' + ms + 'ms) — MB busy');
                if (attempt < retries) { setNetTrouble('throttled', 'paused ' + Math.round(a.hold / 1000) + 's as MusicBrainz asked'); continue; }
                Log.error('GET ' + path + ' gave up after ' + (retries + 1) + ' attempts (still ' + r.status + ')');
                setNetTrouble('throttled', 'gave up on a request after ' + (retries + 1) + ' attempts (HTTP ' + r.status + ')');
                return null;
            }
            if (!r.ok) { Log.warn('GET ' + path + ' → ' + r.status + ' (' + ms + 'ms)'); return null; }
            Log.info('← ' + r.status + ' ' + path + ' (' + ms + 'ms)');
            clearNetTrouble();          // something got through — stop warning
            return await r.json();
        } catch (e) {
            Log.error('GET ' + path + ' failed: ' + e.message + (attempt < retries ? ' — retrying' : ' — giving up'));
            if (attempt < retries) { await new Promise(res => setTimeout(res, 800 * Math.pow(2, attempt))); continue; }
            setNetTrouble('offline', e.message);
            return null;
        }
    }
    return null;
}

// ── settings (GM-persisted) ──────────────────────────────────────────────
const SETTINGS_KEY = 'fusion.settings';
const SETTINGS_DEFAULTS = { lengthToleranceMs: 5000, grossLengthMs: 30000, acoustidEnrich: true, acoustidPoolCap: 2000, autoMatchOnOpen: false, prefetchGroupReleases: false, releasePrefetchCap: 200, poolCollapsed: false, matchCutoff: 'strict', poolSort: 'added' };
function loadSettings() {
    // (#623: the one-time #529 migrations of the old AcoustID cap and prefetch default are retired)
    try { return Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(GM_getValue(SETTINGS_KEY, '{}'))); }
    catch (e) { return Object.assign({}, SETTINGS_DEFAULTS); }
}
function saveSettings() { try { GM_setValue(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {} }
let SETTINGS = loadSettings();

// mbRestackCorner, the #468 corner slots, is in the ST-UI block (dev/ui/ui-components.mjs).

/* ── matching / normalization (ported from platform_check's tokenMatch/scoreCandidate
   normalization stack — same token-overlap approach, reused rather than reinvented) ── */
// #623 (sweep, X10): any script. It kept only [a-z0-9], so a non-Latin title or artist
// normalised to "" and matched nothing. Diacritics still fold on Latin, Greek and
// Cyrillic letters (é → e); other scripts keep their marks (voiced kana, Indic vowels).
function normName(s) { return (s || '').toLowerCase().normalize('NFKD').replace(/(?<=[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu, '').normalize('NFC').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim(); }
function tokenMatch(a, b, mode, threshold) {
    mode = mode || 'max'; threshold = threshold == null ? 0.6 : threshold;
    const na = normName(a), nb = normName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const tokensOf = s => new Set(s.split(' ').filter(t => t.length >= 2));
    const ta = tokensOf(na), tb = tokensOf(nb);
    if (!ta.size || !tb.size) return false;
    let common = 0;
    for (const t of ta) if (tb.has(t)) common++;
    const denom = mode === 'min' ? Math.min(ta.size, tb.size) : Math.max(ta.size, tb.size);
    return common / denom >= threshold;
}
// #529 follow-up (majkinetor, live, with a screenshot): "Oburumankoma" vs
// "Oburumakoma" — a single-word title with a one-letter typo shares ZERO
// tokens (tokenMatch is all-or-nothing per word), so it never matched even
// though it's obviously the same recording. A small Levenshtein-ratio fallback
// catches near-identical spellings that token overlap structurally can't.
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
        }
        prev = cur;
    }
    return prev[n];
}
function fuzzyRatio(a, b) {
    const na = normName(a).replace(/ /g, ''), nb = normName(b).replace(/ /g, '');
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    return 1 - levenshtein(na, nb) / maxLen;
}
const titleAlike = (a, b) => tokenMatch(a, b, 'max', 0.6) || fuzzyRatio(a, b) >= 0.85;
/* #760 (ernstlx, forum): "In Volo - Drift" / "In Volo - Trace" share 2 of 3
   words and "Dwell I" / "Dwell IV" are 92% alike by characters, so both passed
   as similar and, with the artist and lengths agreeing, were merged at normal.
   Parts and series name their tracks by the one word that differs. So when EACH
   title has a word the other lacks, they are different titles, unless those
   words only spell a mix or edit (majkinetor: "various ways to denote mixes and
   edits, but are the same"), a year, or a typo of each other ("Oburumankoma").
   Words on one side only still match. Returns the two sides' distinct words,
   or null when there is no such difference. */
const TITLE_QUALIFIERS = new Set(['mix', 'mixed', 'edit', 'edited', 'version', 'ver', 'radio', 'album', 'single', 'lp', 'ep', 'extended',
    'original', 'remaster', 'remastered', 'mastered', 'mono', 'stereo', 'explicit', 'clean', 'dirty', 'censored', 'uncensored',
    'feat', 'ft', 'featuring', 'with', 'and', 'n', 'the', 'part', 'pt']);
const isNumberWord = t => /^\d+$/.test(t) || /^[ivxlcdm]{1,4}$/.test(t);
function titleDistinctWords(a, b) {
    const wa = new Set(normName(a).split(' ').filter(Boolean)), wb = new Set(normName(b).split(' ').filter(Boolean));
    const own = (w, other) => [...w].filter(t => !other.has(t) && !TITLE_QUALIFIERS.has(t) && !/^(19|20)\d\d$/.test(t));
    const da = own(wa, wb), db = own(wb, wa);
    // pair off a typo on one side with its spelling on the other; never numbers (I / IV)
    const typo = (t, u) => t.length >= 4 && u.length >= 4 && !isNumberWord(t) && !isNumberWord(u) && fuzzyRatio(t, u) >= 0.75;
    const left = da.filter(t => { const k = db.findIndex(u => typo(t, u)); if (k < 0) return true; db.splice(k, 1); return false; });
    return left.length && db.length ? { a: left, b: db } : null;
}
const titleSimilar = (a, b) => titleAlike(a, b) && !titleDistinctWords(a, b);
/* #760: two recordings whose ISRCs share none, but where one from each comes
   from the same registrant and year (the first 7 characters), are different
   tracks of one batch: QZTRX2699407 / QZTRX2699409. A reissue usually gets its
   ISRCs under another registrant or year, so it is not caught. */
const isrcStem = x => String(x).toUpperCase().slice(0, 7);
function isrcConflict(a, b) {
    const ia = a.isrcs || [], ib = b.isrcs || [];
    if (!ia.length || !ib.length || ia.some(x => ib.includes(x))) return null;
    for (const x of ia) for (const y of ib) if (isrcStem(x) === isrcStem(y)) return x + ' / ' + y;
    return null;
}
/* #789 (phw): a studio recording and a live one of the same song were grouped, on a shared
   AcoustID, and nothing on the card said which was live. A recording's relationships say it:
   a performance of a work marked live, and where it was recorded ("recorded at" a place,
   "recorded in" an area, with the date). live is null when unknown: relationships not fetched,
   or no performance relationship to read. places is null when not fetched, [] when none. */
function recordingSetting(rels) {
    if (!Array.isArray(rels)) return { live: null, places: null };
    const perf = rels.filter(r => r['target-type'] === 'work' && r.type === 'performance');
    const places = rels.filter(r => (r['target-type'] === 'place' && r.type === 'recorded at') || (r['target-type'] === 'area' && r.type === 'recorded in'))
        .map(r => { const e = r.place || r.area || {}; return { gid: e.id, name: e.name || '', kind: r['target-type'], date: r.begin || null }; })
        .filter(p => p.gid);
    return { live: perf.length ? perf.some(r => (r.attributes || []).includes('live')) : null, places };
}
const REL_INC = 'work-rels+place-rels+area-rels';
const placeText = p => p.name + (p.date ? ' ' + p.date : '');
/* Two recordings made at different places, or at one place on different dates, are different
   recordings. Places are compared with places and areas with areas: "recorded in London" and
   "recorded at KOKO" don't contradict. An unknown date doesn't either. Returns the two sides'
   locations, or null when there is no such difference. */
function placeConflict(a, b) {
    if (!a.places || !b.places) return null;
    for (const kind of ['place', 'area']) {
        const pa = a.places.filter(p => p.kind === kind), pb = b.places.filter(p => p.kind === kind);
        if (!pa.length || !pb.length) continue;
        const same = pa.some(x => pb.some(y => x.gid === y.gid && (!x.date || !y.date || x.date === y.date)));
        if (!same) return pa.map(placeText).join(', ') + ' / ' + pb.map(placeText).join(', ');
    }
    return null;
}
const artistTokenCount = s => normName(s).split(' ').filter(t => t.length >= 2).length;
const artistSimilar = (a, b) => tokenMatch(a, b, artistTokenCount(b) <= artistTokenCount(a) ? 'min' : 'max', 0.8);
function lengthClose(a, b, tolMs) { if (a == null || b == null) return false; return Math.abs(a - b) <= tolMs; }
// #529 follow-up: "We should be able to select confidence level for match" —
// strict (default) = only hard identifiers; normal = identifiers, or
// title+artist+length together; loose = identifiers, or title+length alone
// (artist not required — useful for various-artist / remixer-credit noise).
const MATCH_CUTOFFS = ['strict', 'normal', 'loose'];
function shouldUnion(sig, cutoff) {
    // #529 follow-up (majkinetor): "Video recordings should never be added to
    // groups with audio recordings." A hard gate — no cutoff level, no signal
    // strength (not even a shared ISRC) overrides it.
    if (sig.videoMismatch) return false;
    if (sig.pendingEdit) return false;   // never auto-group a recording with an open edit (#529)
    // #529 (majkinetor): "we should never have such a big difference in length
    // in auto merge" — a 0:42 reprise was auto-grouped with 4:11/4:17 takes,
    // because the loose cutoff's title+artist path checks no length at all.
    // A grossly different KNOWN length now blocks auto-grouping outright, ahead
    // of even ISRC/AcoustID: those identify a work, not necessarily the same
    // take, and four minutes apart is never the same recording. Manual grouping
    // is still allowed — that's a deliberate human decision, not a guess.
    if (sig.lengthConflict) return false;
    // #789: live and studio, or two places or dates, are never the same recording; ahead of
    // ISRC and AcoustID, which a live take can wrongly carry from its studio original
    if (sig.liveMismatch || sig.placeConflict) return false;
    // #760: different tracks of one ISRC batch. Ahead of AcoustID, which can
    // collide on short or quiet tracks; a shared ISRC never sets this.
    if (sig.isrcConflict) return false;
    if (sig.isrc) return true;
    // #760 follow-up (majkinetor): "Feel What You Feel" and "Suspended Space"
    // share AcoustIDs, which are user-submitted and land on the wrong recording,
    // so an AcoustID alone grouped two different tracks. It no longer carries a
    // pair whose titles each have a word the other lacks; a shared ISRC does.
    if (sig.acoustid && !sig.titleDiffers) return true;
    if (cutoff === 'strict') return false;
    if (cutoff === 'loose') return (sig.title && sig.length) || (sig.title && sig.artist);
    // 'normal' — identifiers, or title AND artist corroborated by length.
    // #565 (majkinetor): an UNKNOWN length must not veto. pairSignals already
    // documents that a missing length "just means we can't tell", but requiring
    // sig.length here made "can't tell" behave exactly like "they disagree": on a
    // release-group where one release carries no lengths at all, normal formed
    // zero groups even for titles that were identical bar their capitalisation,
    // and the only way to get any match was to drop to loose — which weakens
    // every OTHER pair in the pool at the same time.
    //
    // Two lengths that are both KNOWN and not close still block, which is the
    // case worth blocking; grossly different ones are already out above.
    return sig.title && sig.artist && (sig.length || sig.lengthUnknown);
}

function acName(ac) {
    if (!Array.isArray(ac)) return '';
    return ac.map(x => (x.name || (x.artist && x.artist.name) || '') + (x.joinphrase || '')).join('');
}
function acPrimaryGid(ac) { return (Array.isArray(ac) && ac[0] && ac[0].artist && ac[0].artist.id) || null; }
/* #594 (chaban-mb): every artist MBID in the credit, in order.
   acPrimaryGid deliberately stays — it is what the artist LINK in the table
   points at — but matching needs the whole credit. Comparing only the primary
   would call "Radium" and "Radium feat. Someone" the same artist, which is the
   opposite mistake to the one being fixed. */
function acGids(ac) { return Array.isArray(ac) ? ac.map(x => x.artist && x.artist.id).filter(Boolean) : []; }
function dur(ms) {
    if (ms == null) return '—';
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
}
function parseMbidFromInput(s) {
    const m = String(s || '').match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return m ? m[0].toLowerCase() : null;
}

// ── recording model + fetchers ───────────────────────────────────────────
function mkRecording(gid, opts) {
    // video: null = unknown yet (e.g. artist-page scrape, backfilled lazily by
    // enrichAllReleases); true/false once known. #529: "Video recordings should
    // never be added to groups with audio recordings" — null is deliberately
    // treated as "don't block" everywhere, only a known true/false mismatch does.
    return Object.assign({ gid, title: '', disambiguation: '', length: null, isrcs: [], artistCredit: '', artistGid: null, artistGids: [], releases: [], allReleases: null, acoustids: null, video: null, editsPending: null, isrcsKnown: false, isrcSource: null, live: null, places: null }, opts || {});
}

async function fetchReleaseRecordings(releaseMbid) {
    const j = await wsGet('/ws/2/release/' + releaseMbid + '?inc=recordings+isrcs+artist-credits+release-groups+recording-level-rels+' + REL_INC + '&fmt=json');
    if (!j) return { release: null, recordings: [] };
    const recs = [];
    for (const m of j.media || []) {
        for (const t of m.tracks || []) {
            const r = t.recording || {};
            const ac = r['artist-credit'] || j['artist-credit'];
            recs.push(mkRecording(r.id, {
                title: r.title || t.title, disambiguation: r.disambiguation || '',
                length: r.length != null ? r.length : t.length,
                isrcs: r.isrcs || [], ...recordingSetting(r.relations),
                artistCredit: acName(ac), artistGid: acPrimaryGid(ac), artistGids: acGids(ac), video: !!r.video, isrcsKnown: true, isrcSource: 'index',
                releases: [{ gid: j.id, title: j.title, disambiguation: j.disambiguation || '', rgGid: (j['release-group'] || {}).id || null, trackNumber: t.number || null, trackCount: m['track-count'] || null }],
            }));
        }
    }
    Log.info('Release seed: ' + recs.length + ' recording(s) from "' + j.title + '"');
    return { release: { gid: j.id, title: j.title, artistCredit: acName(j['artist-credit']) }, recordings: recs };
}

// Enumerating an artist's recordings via the INDEXED SEARCH is unsound: paging
// it with offsets returns the same recording on several pages while never
// returning others at all. Measured on Mocky (310 recordings), same minute:
//
//     browse  ?artist=      310 returned, 310 distinct,  0 duplicates
//     search  query=arid:   310 returned, 224 distinct, 86 duplicates
//                           …and 86 recordings browse found that search never
//                           returned once.
//
// That is why majkinetor's pool size wandered between runs (210, 185, 224) and
// why AcoustIDs "disappeared": the RECORDINGS were absent, not their data. The
// browse endpoint reads the database directly and pages deterministically, so
// membership comes from there now. Its ISRCs are DB-backed too, hence
// isrcSource 'entity' rather than the search index's 'index'. (#529)
async function fetchRecordingsByBrowse(browseQuery, label, onPage) {
    const recordings = [];
    let offset = 0, total = Infinity, pages = 0, truncatedBy = null;
    while (offset < total && pages < SEARCH_MAX_PAGES) {
        if (onPage) onPage(pages + 1, Number.isFinite(total) ? Math.ceil(total / SEARCH_PAGE_LIMIT) : null, recordings.length, Number.isFinite(total) ? total : null);
        const j = await wsGet('/ws/2/recording?' + browseQuery + '&inc=isrcs+artist-credits+' + REL_INC + '&fmt=json&limit=' + SEARCH_PAGE_LIMIT + '&offset=' + offset);
        if (!j) { truncatedBy = 'a failed request'; break; }
        total = j['recording-count'] != null ? j['recording-count'] : 0;
        for (const r of j.recordings || []) {
            const ac = r['artist-credit'];
            // No releases here: browse does not accept inc=releases ("releases is
            // not a valid inc parameter"). They are filled in afterwards, best
            // effort, and stay unknown rather than empty when they cannot be.
            recordings.push(mkRecording(r.id, {
                title: r.title, disambiguation: r.disambiguation || '', length: r.length, isrcs: r.isrcs || [], isrcsKnown: true, isrcSource: 'entity', ...recordingSetting(r.relations),
                artistCredit: acName(ac), artistGid: acPrimaryGid(ac), artistGids: acGids(ac), video: !!r.video,
                releases: [], allReleases: null,
            }));
        }
        offset += SEARCH_PAGE_LIMIT; pages++;
        if (pages >= SEARCH_MAX_PAGES && offset < total) truncatedBy = 'the ' + SEARCH_MAX_PAGES + '-page cap';
    }
    const known = Number.isFinite(total);
    if (known && total > recordings.length) Log.warn(label + ': loaded ' + recordings.length + ' of ' + total + ' — stopped by ' + (truncatedBy || 'an incomplete response'));
    if (!known) Log.error(label + ': could not load anything — MusicBrainz did not answer');
    else Log.info(label + ': ' + recordings.length + ' recording(s) of ' + total + ' total');
    return { recordings, total };
}
// The search index is still the cheapest source of "every release this recording
// appears on", including compilations by other artists — it is only its PAGING
// that cannot be trusted. So it runs as a best-effort enricher over a membership
// list that came from browse: whatever it returns gets used, whatever it misses
// keeps allReleases null and is fetched on demand later.
// Whatever the search index did not cover is fetched per recording afterwards,
// in the background. Without this the pool column would sit on "—" forever for
// those recordings (#529: the browse seed cannot ask for releases, and the
// index missed 86 of 310 on the artist that surfaced this). Non-blocking, and
// it goes through the same rate-limit gate as everything else.
async function backfillMissingReleases(recordings) {
    if (_bgStopped) return;
    const missing = recordings.filter(r => r.allReleases == null);
    if (!missing.length) return;
    Log.info('Filling in release lists for ' + missing.length + ' recording(s) the search index did not return');
    await enrichAllReleases(missing, 3, (done, total) => {
        setBgTask('Loading release lists ' + done + '/' + total + '…');
        scheduleBackgroundRender();
    });
    setBgTask('');
    const left = recordings.filter(r => r.allReleases == null).length;
    Log.info('Release lists: backfill finished' + (left ? ' — ' + left + ' still unknown' : ''));
}
async function enrichReleasesFromSearch(luceneQuery, recordings) {
    const byGid = new Map(recordings.map(r => [r.gid, r]));
    let offset = 0, total = Infinity, pages = 0, matched = 0;
    while (offset < total && pages < SEARCH_MAX_PAGES) {
        const j = await wsGet('/ws/2/recording?query=' + encodeURIComponent(luceneQuery) + '&fmt=json&limit=' + SEARCH_PAGE_LIMIT + '&offset=' + offset);
        if (!j) break;
        total = j.count || 0;
        for (const r of j.recordings || []) {
            const rec = byGid.get(r.id);
            if (!rec || rec.allReleases != null) continue;
            const releases = (r.releases || []).map(rel => {
                let trackNumber = null;
                for (const med of rel.media || []) { if (med.track && med.track[0]) { trackNumber = med.track[0].number || null; break; } }
                return { gid: rel.id, title: rel.title, disambiguation: rel.disambiguation || '', rgGid: (rel['release-group'] || {}).id || null, trackNumber, trackCount: rel['track-count'] || null, date: rel.date || null };
            });
            rec.releases = releases; rec.allReleases = releases;
            matched++;
        }
        offset += SEARCH_PAGE_LIMIT; pages++;
    }
    const without = recordings.filter(r => r.allReleases == null).length;
    Log.info('Release lists: ' + matched + ' of ' + recordings.length + ' recording(s) covered by the search index'
        + (without ? ' — ' + without + ' left to load on demand (the index did not return them)' : ''));
}

// Shared paginated recording search. The indexed search returns each
// recording's releases, artist credit, ISRCs and video flag inline, so one
// query per 100 recordings covers everything the pool needs — no per-recording
// follow-ups. Used for both release-group (rgid:) and artist (arid:) seeding.
const SEARCH_PAGE_LIMIT = 100;
const SEARCH_MAX_PAGES = 20;   // 2000 recordings; guards a huge artist
async function fetchRecordingsBySearch(luceneQuery, label, onPage) {
    const recordings = [];
    let offset = 0, total = Infinity, pages = 0, truncatedBy = null;
    while (offset < total && pages < SEARCH_MAX_PAGES) {
        // #529: "it would be cool to have some progress in 'Loading ..' (page 1,
        // 2...)" — a big artist is several sequential requests with nothing on
        // screen changing, so report before each one rather than after.
        if (onPage) onPage(pages + 1, Number.isFinite(total) ? Math.ceil(total / SEARCH_PAGE_LIMIT) : null, recordings.length, Number.isFinite(total) ? total : null);
        const j = await wsGet('/ws/2/recording?query=' + encodeURIComponent(luceneQuery) + '&fmt=json&limit=' + SEARCH_PAGE_LIMIT + '&offset=' + offset);
        if (!j) { truncatedBy = 'a failed request'; break; }
        total = j.count || 0;
        for (const r of j.recordings || []) {
            const releases = (r.releases || []).map(rel => {
                let trackNumber = null;
                for (const med of rel.media || []) { if (med.track && med.track[0]) { trackNumber = med.track[0].number || null; break; } }
                return { gid: rel.id, title: rel.title, disambiguation: rel.disambiguation || '', rgGid: (rel['release-group'] || {}).id || null, trackNumber, trackCount: rel['track-count'] || null, date: rel.date || null };
            });
            const ac = r['artist-credit'];
            // the search already returns every release a recording appears on,
            // across every release group — so it doubles as the deduped
            // "all releases" list, with no extra per-recording fetch.
            recordings.push(mkRecording(r.id, { title: r.title, disambiguation: r.disambiguation || '', length: r.length, isrcs: r.isrcs || [], artistCredit: acName(ac), artistGid: acPrimaryGid(ac), artistGids: acGids(ac), video: !!r.video, isrcsKnown: true, isrcSource: 'index', releases, allReleases: releases }));
        }
        offset += SEARCH_PAGE_LIMIT; pages++;
        if (pages >= SEARCH_MAX_PAGES && offset < total) truncatedBy = 'the ' + SEARCH_MAX_PAGES + '-page cap';
    }
    // total stays Infinity when the FIRST page never came back — reporting
    // "0 of Infinity" is worse than admitting we don't know (#529).
    const known = Number.isFinite(total);
    // Don't blame the page cap for every shortfall: a 503'd page stops the loop
    // after 3 pages and reporting that as "the 20-page cap" sends you looking in
    // entirely the wrong place (#529 — it read "stopped at the 20-page cap"
    // immediately under a give-up-after-5-attempts error).
    if (known && total > recordings.length) Log.warn(label + ': loaded ' + recordings.length + ' of ' + total + ' — stopped by ' + (truncatedBy || 'an incomplete response'));
    if (!known) Log.error(label + ': could not load anything — MusicBrainz did not answer');
    else Log.info(label + ': ' + recordings.length + ' recording(s) of ' + total + ' total (' + luceneQuery + ')');
    return { recordings, total: known ? total : recordings.length };
}
// Same unsound-search problem as the artist seed (#529), and here the fix is
// strictly better than a workaround: browsing RELEASES in the release group with
// inc=recordings walks the actual tracklists, so it is deterministic AND already
// knows which release each recording sits on — no search enrichment needed, and
// the ISRCs come from the database rather than the index.
async function fetchRGRecordings(rgMbid, onPage) {
    const rgMeta = await wsGet('/ws/2/release-group/' + rgMbid + '?inc=artist-credits&fmt=json');
    const rg = rgMeta ? { gid: rgMeta.id, title: rgMeta.title, artistCredit: acName(rgMeta['artist-credit']) } : null;
    const byGid = new Map();
    let offset = 0, total = Infinity, pages = 0;
    while (offset < total && pages < SEARCH_MAX_PAGES) {
        if (onPage) onPage(pages + 1, Number.isFinite(total) ? Math.ceil(total / SEARCH_PAGE_LIMIT) : null, byGid.size, null);
        const j = await wsGet('/ws/2/release?release-group=' + rgMbid + '&inc=recordings+artist-credits+isrcs+recording-level-rels+' + REL_INC + '&fmt=json&limit=' + SEARCH_PAGE_LIMIT + '&offset=' + offset);
        if (!j) { Log.warn('RG seed: a request failed — the list may be incomplete'); break; }
        total = j['release-count'] != null ? j['release-count'] : 0;
        for (const rel of j.releases || []) {
            const media = rel.media || [];
            for (const med of media) {
                for (const t of med.tracks || []) {
                    const r = t.recording; if (!r || !r.id) continue;
                    const relRef = { gid: rel.id, title: rel.title, disambiguation: rel.disambiguation || '', rgGid: rgMbid, trackNumber: t.number || null, trackCount: med['track-count'] || null, date: rel.date || null };
                    const existing = byGid.get(r.id);
                    if (existing) {
                        if (!existing.releases.some(x => x.gid === rel.id)) existing.releases.push(relRef);
                        continue;
                    }
                    const ac = r['artist-credit'] || t['artist-credit'];
                    byGid.set(r.id, mkRecording(r.id, {
                        title: r.title, disambiguation: r.disambiguation || '', length: r.length != null ? r.length : t.length,
                        isrcs: r.isrcs || [], isrcsKnown: true, isrcSource: 'entity', ...recordingSetting(r.relations),
                        artistCredit: acName(ac), artistGid: acPrimaryGid(ac), artistGids: acGids(ac), video: !!r.video,
                        releases: [relRef], allReleases: null,
                    }));
                }
            }
        }
        offset += SEARCH_PAGE_LIMIT; pages++;
    }
    const recordings = [...byGid.values()];
    // releases here are the ones INSIDE this release group; a recording may also
    // appear elsewhere, so allReleases stays null until asked for.
    recordings.forEach(r => { r.releases = r.releases.slice(); });
    Log.info('RG seed: ' + recordings.length + ' distinct recording(s) across ' + (Number.isFinite(total) ? total : '?') + ' release(s)');
    return { rg, recordings };
}
// #529 (majkinetor): "scraping the page is not going to cut it, we need to use
// an API here" — the artist page is paginated at 100 rows and its DOM layout
// shifts with login state, so the whole artist catalogue now comes from the
// indexed search instead (297 vs 100 for the artist that surfaced this).
async function fetchArtistRecordings(artistMbid, onPage) {
    const meta = await wsGet('/ws/2/artist/' + artistMbid + '?fmt=json');
    const artist = meta ? { gid: meta.id, name: meta.name } : null;
    const { recordings, total } = await fetchRecordingsByBrowse('artist=' + artistMbid, 'Artist seed', onPage);
    await enrichReleasesFromSearch('arid:' + artistMbid, recordings);
    backfillMissingReleases(recordings).catch(e => Log.warn('Release backfill failed: ' + e.message));
    return { artist, recordings, total };
}
// MB's own merge checkboxes on an artist-recordings page carry the internal
// numeric id Fusion would otherwise fetch one /ws/js/entity call at a time.
// Purely additive: costs nothing, and merging from that page skips those calls.
function harvestInternalIdsFromPage() {
    let n = 0;
    for (const tr of document.querySelectorAll('table.tbl tbody > tr')) {
        const a = tr.querySelector('a[href^="/recording/"]');
        const cb = tr.querySelector('input[name="add-to-merge"]');
        if (!a || !cb || !/^\d+$/.test(cb.value)) continue;
        const gid = (a.getAttribute('href').match(/[0-9a-fA-F-]{36}/) || [])[0];
        if (gid) { _idCache.set(gid, Number(cb.value)); n++; }
    }
    if (n) Log.info('Harvested ' + n + ' internal recording id(s) from the page — those merges skip a lookup');
    return n;
}

async function fetchRecordingByGid(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=releases+release-groups+isrcs+artist-credits+' + REL_INC + '&fmt=json');
    if (!j) return null;
    const releases = (j.releases || []).map(rel => ({ gid: rel.id, title: rel.title, disambiguation: rel.disambiguation || '', rgGid: (rel['release-group'] || {}).id || null, trackNumber: null, trackCount: null, date: rel.date || null }));
    const ac = j['artist-credit'];
    return mkRecording(j.id, { title: j.title, disambiguation: j.disambiguation || '', length: j.length, isrcs: j.isrcs || [], artistCredit: acName(ac), artistGid: acPrimaryGid(ac), artistGids: acGids(ac), video: !!j.video, isrcsKnown: true, isrcSource: 'entity', ...recordingSetting(j.relations), releases, allReleases: releases });
}
// #529 follow-up (majkinetor, with a screenshot of jesus2099's reference
// script): "We should have a list of recording releases too (deduped)" — the
// full set of releases a recording appears on, not just the one it was seeded
// from. Release/recording-page seeding only knows about ONE release per
// recording at fetch time, so this backfills the rest lazily.
async function fetchAllReleases(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=releases+release-groups+' + REL_INC + '&fmt=json');
    // null, not an empty list: a failed lookup is not "this recording is on no
    // release". Returning [] here made enrichAllReleases record the absence as
    // fact — the same overclaim the AcoustID and ISRC paths already had to lose.
    if (!j) return null;
    const seen = new Set(); const out = [];
    for (const rel of j.releases || []) {
        if (seen.has(rel.id)) continue;
        seen.add(rel.id);
        out.push({ gid: rel.id, title: rel.title, disambiguation: rel.disambiguation || '', rgGid: (rel['release-group'] || {}).id || null, trackNumber: null, trackCount: null, date: rel.date || null });
    }
    return { releases: out, video: !!j.video, ...recordingSetting(j.relations) };
}
// #529 (majkinetor, with a screenshot of MB's own merge-page release table):
// "We need all details when merging. Lets have all releases expandable for a
// recording." Browsing releases BY recording is the only single request that
// carries every column that table shows — label and catalogue number are not
// valid inc parameters on the recording resource at all ("labels is not a valid
// inc parameter for the recording resource"), and inc=recordings is what turns
// the media summary into real tracks, giving the track's own number, length and
// artist as they appear on that particular release.
// Fetched on demand, per recording, only when a row is actually expanded.
async function fetchReleaseDetails(gid) {
    const j = await wsGet('/ws/2/release?recording=' + gid + '&inc=labels+media+release-groups+artist-credits+recordings&limit=100&fmt=json');
    if (!j) return null;
    const out = [];
    for (const rel of j.releases || []) {
        const li = (rel['label-info'] || [])[0] || {};
        const rg = rel['release-group'] || {};
        const ev = (rel['release-events'] || [])[0] || {};
        const area = ev.area || {};
        // Find the track for THIS recording; a release can list it more than once.
        let track = null, medium = null;
        for (const med of rel.media || []) {
            for (const t of med.tracks || []) {
                if (t.recording && t.recording.id === gid) { track = t; medium = med; break; }
            }
            if (track) break;
        }
        const secondary = (rg['secondary-types'] || []).join(' + ');
        out.push({
            gid: rel.id,
            status: rel.status || null,
            title: rel.title || '',
            disambiguation: rel.disambiguation || '',
            rgGid: rg.id || null,
            artist: acName(rel['artist-credit']),
            rgType: [rg['primary-type'] || '', secondary].filter(Boolean).join(' + ') || null,
            country: rel.country || (area['iso-3166-1-codes'] || [])[0] || null,
            date: rel.date || ev.date || null,
            label: li.label ? li.label.name : null,
            catalog: li['catalog-number'] || null,
            format: medium ? medium.format || null : null,
            trackNumber: track ? track.number : null,
            trackTitle: track ? track.title : null,
            trackLength: track ? (track.length || (track.recording && track.recording.length) || null) : null,
            trackArtist: track ? acName(track['artist-credit']) : null,
            discNumber: medium && (rel.media || []).length > 1 ? medium.position : null,
        });
    }
    // Group the way MB's own table does: Official first, then the rest.
    const rank = s => (s === 'Official' ? 0 : s ? 1 : 2);
    out.sort((a, b) => rank(a.status) - rank(b.status) || String(a.date || '').localeCompare(String(b.date || '')));
    return out;
}
// also backfills `video` for recordings whose seed source didn't carry it
// (the artist-recordings DOM scrape has no video indicator in the table).
async function enrichAllReleases(recs, concurrency, onProgress) {
    concurrency = concurrency || 3;
    let i = 0, done = 0;
    const epoch = _bgEpoch;
    async function worker() {
        while (i < recs.length) {
            if (!bgAlive(epoch)) return;
            const rec = recs[i++];
            if (rec.allReleases == null) {
                const r = await fetchAllReleases(rec.gid);
                if (r) {
                    rec.allReleases = r.releases;
                    /* #581 (chaban-mb): "Fusion claims (no release) for some
                       recordings in the table yet when hovering it shows the
                       release." The cell reads rec.releases[0]; the tooltip reads
                       rec.allReleases. This backfill filled only the second, so a
                       recording the search index had missed ended up with a full
                       tooltip above a cell that flatly denied it.
                       storeReleaseDetails — the expand-on-demand path — already
                       seeds both, for this exact reason (#529); this one was
                       written later and did not. Only when empty: a row seeded
                       from a release page carries that release as its primary and
                       must keep it. */
                    if (!rec.releases || !rec.releases.length) rec.releases = r.releases;
                    if (rec.video == null) rec.video = r.video;
                    if (rec.places == null) { rec.live = r.live; rec.places = r.places; }   // #789
                }
            }
            done++; if (onProgress) onProgress(done, recs.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, recs.length) }, worker));
}

// #529 (majkinetor): "we should also have recordings with pending edits
// highlighted … Probably shouldn't include them in auto merging too."
// WS2 doesn't expose pending edits at all; MB's internal /ws/js/entity does
// (editsPending), and Fusion already calls it for internal ids — so one fetch
// yields both. Merging an entity with an open edit risks compounding or
// conflicting with whatever is already in the queue.
const _pendingCache = new Map();
async function fetchEntityMeta(gid) {
    if (_pendingCache.has(gid)) return _pendingCache.get(gid);
    let meta = null;
    try {
        const j = await mbnFetch('/ws/js/entity/' + gid, { headers: { Accept: 'application/json' } }).then(r => r.json());
        if (j && j.gid) meta = { id: j.id || null, editsPending: !!j.editsPending };
    } catch (e) { Log.error('fetchEntityMeta(' + gid + ') failed: ' + e.message); }
    _pendingCache.set(gid, meta);
    if (meta && meta.id) _idCache.set(gid, meta.id);
    return meta;
}
async function enrichPendingEdits(recs, concurrency, onProgress) {
    const todo = recs.filter(r => r.editsPending == null);
    if (!todo.length) return;
    concurrency = concurrency || 2;   // one MB request per recording — go easy (#529)
    let i = 0, done = 0, flagged = 0;
    async function worker() {
        while (i < todo.length) {
            const rec = todo[i++];
            const meta = await fetchEntityMeta(rec.gid);
            rec.editsPending = meta ? meta.editsPending : false;
            if (rec.editsPending) flagged++;
            done++; if (onProgress) onProgress(done, todo.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
    if (flagged) Log.warn(flagged + ' recording(s) have pending edits — excluded from matching and blocked from merging');
}
const _idCache = new Map();
async function resolveInternalId(gid) {
    if (_idCache.has(gid)) return _idCache.get(gid);
    let id = null;
    try {
        const j = await mbnFetch('/ws/js/entity/' + gid, { headers: { Accept: 'application/json' } }).then(r => r.json());
        id = j && j.id ? j.id : null;
    } catch (e) { Log.error('resolveInternalId(' + gid + ') failed: ' + e.message); }
    _idCache.set(gid, id);
    return id;
}

// AcoustID matches are read from MB's own recording→URL relationships (rels Picard
// already creates on submit) rather than calling the AcoustID API directly — no API
// key, no rate limit, same-origin only. Trades "misses recordings never Picard-tagged"
// for "zero external dependency"; ISRC/title/artist/length still catch those.
// Also pulls isrcs: this is an authoritative per-recording lookup, unlike the
// rgid: SEARCH used for RG seeding, whose index can lag or omit fields. #529 —
// a recording that demonstrably had an ISRC showed isrc=none after RG seeding,
// so anything derived from search results gets reconciled against this.
async function fetchRecordingDetail(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=isrcs+' + REL_INC + '&fmt=json');
    if (!j) return null;
    return { isrcs: j.isrcs || [], video: !!j.video, ...recordingSetting(j.relations) };
}
// #529 (majkinetor): "I didn't see a single AcoustID, although all should have
// it basically" — correct, and the original approach was simply wrong: MB does
// NOT store AcoustIDs as recording→URL relationships (verified: a recording
// with two AcoustIDs has zero url-rels). They live on AcoustID's own service.
// list_by_mbid needs no API key and supports batching, so one request covers
// up to ACOUSTID_BATCH recordings.
const ACOUSTID_BATCH = 50;
// Returns a Map on success, or NULL when the lookup itself failed. The
// distinction matters: this used to return an empty Map for a transport error
// exactly as it does for "asked, found nothing", and the caller then wrote []
// onto all 50 recordings in the batch — recording a FAILURE as the confident
// claim "this recording has no AcoustID" (#529: "in previous run I didn't get
// all acoustIDs, in repeated run they showed"). A fresh run got fresh state and
// a working request, which is exactly why a repeat looked like a fix.
async function fetchAcoustIdsBatch(gids) {
    if (!gids.length) return new Map();
    const qs = gids.map(g => 'mbid=' + encodeURIComponent(g)).join('&');
    const url = 'https://api.acoustid.org/v2/track/list_by_mbid?' + qs + '&batch=1&format=json';
    const out = new Map();
    try {
        const r = await gmGet(url, { Accept: 'application/json' });
        if (r.status < 200 || r.status >= 300) { Log.warn('AcoustID lookup failed: HTTP ' + r.status + ' for ' + gids.length + ' recording(s) — left unknown, not recorded as "none"'); return null; }
        const j = JSON.parse(r.responseText || '{}');
        if (j.status !== 'ok') { Log.warn('AcoustID lookup returned status=' + j.status + ' for ' + gids.length + ' recording(s) — left unknown'); return null; }
        for (const entry of j.mbids || []) out.set(entry.mbid, (entry.tracks || []).map(t => t.id));
    } catch (e) { Log.error('AcoustID lookup error: ' + e.message + ' — ' + gids.length + ' recording(s) left unknown'); return null; }
    return out;
}
async function fetchAcoustIds(gid) {
    const map = await fetchAcoustIdsBatch([gid]);
    return map ? (map.get(gid) || []) : null;
}

// ── pool / groups state ──────────────────────────────────────────────────
const STATE = { recordings: new Map(), poolOrder: [], groups: [], poolFilter: '', selected: null, activeGroupId: null, _dragSrc: null, releaseInfo: null, rgInfo: null,
    // #529: per-recording release tables, expanded on demand. The Map doubles as
    // the cache — a missing key means "never asked" (renders "loading…"), null
    // means the lookup failed, so a failed fetch doesn't retry on every render.
    expandedReleases: new Set(), releaseDetails: new Map(), collapsedGroups: new Set(),
    expandedIds: new Set() };   // "<gid>:isrc" / "<gid>:acoustid" whose long id list is unfolded
// A row shows this many identifiers of a kind before folding the unshared rest.
const ID_FOLD = 3;

function addToPool(rec) {
    if (STATE.recordings.has(rec.gid)) return false;
    STATE.recordings.set(rec.gid, rec);
    STATE.poolOrder.push(rec.gid);
    return true;
}
function findGroup(id) { return STATE.groups.find(g => g.id === id); }
function removeFromPoolPermanently(gid) {
    const i = STATE.poolOrder.indexOf(gid); if (i !== -1) STATE.poolOrder.splice(i, 1);
    STATE.recordings.delete(gid);
    Log.info('Removed ' + gid + ' from the pool');
}
// Two different notions, deliberately kept apart (#529: "chips shine even if
// not entire group has them all, isrc here is not shared by 1 member"):
//   signals    — holds for at least ONE pair. Explains why the group formed
//                (groups are built transitively, so A~B by ISRC and B~C by
//                title is a legitimate group) and drives the confidence badge.
//   signalsAll — holds for EVERY pair, i.e. the whole group genuinely agrees.
//                This is what lights a chip, so a lit chip never overstates.
const SIGNAL_KEYS = ['isrc', 'acoustid', 'length', 'title', 'artist'];
// #529 (majkinetor): the card badge names the CUTOFF TIER instead of a
// high/medium confidence. "strict" means the group still holds together with
// Auto-match set to strict; "loose" means it would fall apart if you tightened
// the setting. That is connectivity, not "some pair matched": a group is built
// transitively, so it survives a tier only if every member is still reachable
// from every other under that tier's rules.
const TIER_COLORS = { strict: '#1c9b63', normal: '#2f7fbf', loose: '#a8702a', manual: '#9a9aab' };
/* #623 (sweep, U3): union-find whose unions respect the hard gates for the WHOLE
   group, not just the pair that links two sets. An unknown value never blocks a
   pair (we can't tell), so checking the gates per pair let a recording with an
   unknown video flag or length bridge a video to an audio recording, or takes
   minutes apart, into one group — which Merge All then submitted. Each set keeps
   what its members know (any video, any audio, the shortest and longest known
   length), and two sets join only if no member of one conflicts with a member of
   the other: the same rule as pairSignals' videoMismatch and lengthConflict. */
function gatedUnionFind(recs) {
    const parent = new Map(), info = new Map();
    for (const r of recs) {
        parent.set(r.gid, r.gid);
        const known = r.length != null;
        info.set(r.gid, { video: r.video === true, audio: r.video === false, min: known ? r.length : Infinity, max: known ? r.length : -Infinity, withIsrcs: r.isrcs && r.isrcs.length ? [r] : [],
            live: r.live === true, studio: r.live === false, withPlaces: r.places && r.places.length ? [r] : [] });
    }
    // #789: nor a recording of unknown setting bridge a live and a studio one, or two places
    const placeClash = (a, b) => { for (const x of a.withPlaces) for (const y of b.withPlaces) { const c = placeConflict(x, y); if (c) return c; } return null; };
    // #760: an ISRC-less recording must not bridge two tracks of one ISRC batch
    const isrcClash = (a, b) => { for (const x of a.withIsrcs) for (const y of b.withIsrcs) { const c = isrcConflict(x, y); if (c) return c; } return null; };
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const gross = SETTINGS.grossLengthMs || 30000;
    // why sets A and B may not join ('' when they may)
    const conflict = (a, b) => ((a.video && b.audio) || (a.audio && b.video)) ? 'video and audio'
        : ((a.live && b.studio) || (a.studio && b.live)) ? 'live and studio'
        : (Math.max(a.max, b.max) - Math.min(a.min, b.min) > gross) ? 'lengths ' + Math.round((Math.max(a.max, b.max) - Math.min(a.min, b.min)) / 1000) + 's apart'
        : (() => { const c = isrcClash(a, b); if (c) return 'ISRCs ' + c + ' from one batch'; const p = placeClash(a, b); return p ? 'recorded at ' + p : ''; })();
    // true when joined (or already one set); a string saying why when refused
    const union = (x, y) => {
        const ra = find(x), rb = find(y);
        if (ra === rb) return true;
        const a = info.get(ra), b = info.get(rb), why = conflict(a, b);
        if (why) return why;
        parent.set(ra, rb);
        info.set(rb, { video: a.video || b.video, audio: a.audio || b.audio, min: Math.min(a.min, b.min), max: Math.max(a.max, b.max), withIsrcs: a.withIsrcs.concat(b.withIsrcs),
            live: a.live || b.live, studio: a.studio || b.studio, withPlaces: a.withPlaces.concat(b.withPlaces) });
        return true;
    };
    return { find, union };
}
function groupTier(members) {
    if (members.length < 2) return 'manual';
    for (const cutoff of MATCH_CUTOFFS) {
        const uf = gatedUnionFind(members);
        for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
            const sig = pairSignals(members[i], members[j], SETTINGS.lengthToleranceMs);
            if (shouldUnion(sig, cutoff)) uf.union(members[i].gid, members[j].gid);
        }
        const root = uf.find(members[0].gid);
        if (members.every(m => uf.find(m.gid) === root)) return cutoff;
    }
    return 'manual';   // only hand-built grouping explains it (including a group no cutoff could form, U3)
}
function computeGroupConfidence(members) {
    let confidence = null;
    const signals = new Set();
    const all = new Set(members.length > 1 ? SIGNAL_KEYS : []);   // intersection seed
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
        const sig = pairSignals(members[i], members[j], SETTINGS.lengthToleranceMs);
        if (sig.isrc) { signals.add('isrc'); confidence = 'high'; }
        if (sig.acoustid) { signals.add('acoustid'); confidence = 'high'; }
        if (sig.length) signals.add('length');
        if (sig.title) signals.add('title');
        if (sig.artist) signals.add('artist');
        SIGNAL_KEYS.forEach(k => { if (!sig[k]) all.delete(k); });   // drop any pair disagrees on
    }
    // Without a shared identifier, a group is medium when some cutoff would form it, whatever the
    // cutoff picked now: judged by SETTINGS.matchCutoff, a group Match formed at "normal" read as
    // manual once the default became "strict", and changed label with the setting.
    const tier = groupTier(members);
    if (!confidence && tier !== 'manual') confidence = 'medium';
    return { confidence: confidence || 'manual', tier, signals: [...signals], signalsAll: [...all] };
}
function refreshGroupMeta(g) {
    const members = g.memberGids.map(x => STATE.recordings.get(x)).filter(Boolean);
    const meta = computeGroupConfidence(members);
    g.confidence = meta.confidence; g.tier = meta.tier; g.signals = meta.signals; g.signalsAll = meta.signalsAll;
    if (!g.memberGids.includes(g.target)) g.target = g.memberGids[0];
}
// #529 follow-up (majkinetor, live): "'Return to pool' returns the entire
// group back instead single recording." Root cause: any group left with
// fewer than 2 members used to be dissolved entirely, pushing its LAST
// remaining member back to the pool too — so returning one of a *pair*
// silently evicted the other one as well. A group only truly stops making
// sense at 0 members; a 1-member group is a normal (if not-yet-mergeable)
// state and should just sit there until the user adds to it or clears it too.
function dissolveOrRefresh(g) {
    if (g.memberGids.length === 0) {
        STATE.groups = STATE.groups.filter(x => x.id !== g.id);
        if (STATE.activeGroupId === g.id) STATE.activeGroupId = null;
        return;
    }
    refreshGroupMeta(g);
}
function returnToPool(gid, groupId) {
    const g = findGroup(groupId); if (!g) return;
    const i = g.memberGids.indexOf(gid); if (i === -1) return;
    g.memberGids.splice(i, 1);
    STATE.poolOrder.push(gid);
    dissolveOrRefresh(g);
    Log.info('Returned ' + gid + ' to the pool (group ' + groupId + ' now has ' + g.memberGids.length + ' member(s))');
}
function removeFromGroupAndPool(gid, groupId) {
    const g = findGroup(groupId); if (!g) return;
    const i = g.memberGids.indexOf(gid); if (i === -1) return;
    g.memberGids.splice(i, 1);
    STATE.recordings.delete(gid);
    dissolveOrRefresh(g);
    Log.info('Removed ' + gid + ' from group and pool (group ' + groupId + ' now has ' + g.memberGids.length + ' member(s))');
}
// #529 follow-up: the video/audio separation has to hold for MANUAL grouping
// too (drag, double-click, select+click), not just Auto-match's shouldUnion.
function videoConflict(group, rec) {
    if (!rec || rec.video == null) return false;
    for (const memberGid of group.memberGids) {
        const m = STATE.recordings.get(memberGid);
        if (m && m.video != null && m.video !== rec.video) return true;
    }
    return false;
}
function addToGroup(gid, groupId) {
    const g = findGroup(groupId); if (!g) return false;
    const i = STATE.poolOrder.indexOf(gid); if (i === -1) return false;
    const rec = STATE.recordings.get(gid);
    if (videoConflict(g, rec)) {
        Log.warn('Refused to add ' + gid + ' to group ' + groupId + ' — ' + (rec.video ? 'video' : 'audio') + ' recording, group already has the opposite (video and audio are never merged together)');
        return false;
    }
    STATE.poolOrder.splice(i, 1);
    g.memberGids.push(gid);
    refreshGroupMeta(g);
    Log.info('Added ' + gid + ' to group ' + groupId);
    return true;   // callers branch on this to set the current group — the
                   // success path used to fall through as undefined, so a
                   // double-click add never made its group current and the next
                   // one silently targeted the LAST group instead.
}
function createGroupWithMember(gid) {
    const i = STATE.poolOrder.indexOf(gid); if (i === -1) return null;
    STATE.poolOrder.splice(i, 1);
    const g = { id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: [gid], confidence: 'manual', tier: 'manual', signals: [], signalsAll: [], target: gid, state: 'pending', error: null, editNote: null, editing: false };
    STATE.groups.push(g);
    Log.info('Created new group with ' + gid);
    return g;
}
// #529 follow-up (majkinetor): "Make me able to kill entire group and also
// clear entire board (all items are returned to pool)." A killed/cleared
// group's members go back to the pool — nothing here permanently drops a
// recording, that's still only the pool's own ✕/group-row ✕.
function deleteGroup(groupId) {
    const g = findGroup(groupId); if (!g) return;
    if (g.state === 'busy') { Log.warn('Cannot delete group ' + groupId + ' while it is merging'); return; }
    g.memberGids.forEach(gid => { if (!STATE.poolOrder.includes(gid)) STATE.poolOrder.push(gid); });
    STATE.groups = STATE.groups.filter(x => x.id !== groupId);
    if (STATE.activeGroupId === groupId) STATE.activeGroupId = null;
    Log.info('Deleted group ' + groupId + ' — ' + g.memberGids.length + ' member(s) returned to pool');
}
// #529 (majkinetor): "change the Clear board button so it can also clear
// merged: Clear: [all] [merged]". Merged groups are NOT dissolved back into the
// pool the way deleteGroup does it — the non-target recordings no longer exist
// in MusicBrainz, and the surviving target is stale (its releases and ISRCs just
// changed). Putting either back in the pool would invite re-merging something
// that is already gone, so a merged group leaves the board entirely.
function clearMerged() {
    const done = STATE.groups.filter(g => g.state === 'done');
    if (!done.length) { Log.info('Clear merged: nothing merged yet'); return 0; }
    let dropped = 0;
    for (const g of done) {
        for (const gid of g.memberGids) {
            STATE.recordings.delete(gid);
            const i = STATE.poolOrder.indexOf(gid); if (i !== -1) STATE.poolOrder.splice(i, 1);
            STATE.expandedReleases.delete(gid);
            STATE.releaseDetails.delete(gid);
            dropped++;
        }
        STATE.collapsedGroups.delete(g.id);
        if (STATE.activeGroupId === g.id) STATE.activeGroupId = null;
    }
    const ids = new Set(done.map(g => g.id));
    STATE.groups = STATE.groups.filter(g => !ids.has(g.id));
    Log.info('Clear merged: removed ' + done.length + ' merged group(s) and ' + dropped + ' recording(s) from the board');
    return done.length;
}
function clearBoard() {
    const n = STATE.groups.length;
    STATE.groups.slice().forEach(g => deleteGroup(g.id));
    // Per-card view state belongs to groups that no longer exist; leaving it
    // behind makes a re-grouped recording come back mysteriously pre-expanded.
    // releaseDetails is a CACHE keyed by gid, so that one deliberately survives.
    STATE.expandedReleases.clear();
    STATE.expandedIds.clear();
    STATE.collapsedGroups.clear();
    Log.info('Cleared board — ' + n + ' group(s) dissolved, every member returned to the pool');
}

function pairSignals(a, b, tolMs) {
    const sig = { isrc: false, acoustid: false, length: false, title: false, artist: false, artistByMbid: false, videoMismatch: false, pendingEdit: false, lengthConflict: false, lengthUnknown: false, isrcConflict: null, titleDistinct: null, titleDiffers: null, liveMismatch: false, placeConflict: null };
    // #565: three states, not two. `length` false meant BOTH "the lengths differ"
    // and "we have no length to compare", and the normal cutoff required it — so a
    // release whose recordings carry no length at all could never form a group,
    // however exactly the titles agreed. Keep them apart.
    if (a.length == null || b.length == null) sig.lengthUnknown = true;
    if (a.editsPending || b.editsPending) sig.pendingEdit = true;
    // both lengths known and far apart — see shouldUnion. Unknown length never
    // counts as a conflict; it just means we can't tell.
    if (a.length != null && b.length != null && Math.abs(a.length - b.length) > (SETTINGS.grossLengthMs || 30000)) sig.lengthConflict = true;
    // null (unknown) video status never blocks — only a KNOWN true vs. false mismatch does.
    if (a.video != null && b.video != null && a.video !== b.video) sig.videoMismatch = true;
    // #789: unknown never blocks here either
    if (a.live != null && b.live != null && a.live !== b.live) sig.liveMismatch = true;
    sig.placeConflict = placeConflict(a, b);
    if (a.isrcs.length && b.isrcs.length && a.isrcs.some(x => b.isrcs.includes(x))) sig.isrc = true;
    if (a.acoustids && b.acoustids && a.acoustids.length && b.acoustids.length && a.acoustids.some(x => b.acoustids.includes(x))) sig.acoustid = true;
    if (lengthClose(a.length, b.length, tolMs)) sig.length = true;
    sig.isrcConflict = isrcConflict(a, b);
    // #760: keep the words that refused an otherwise alike title, for the log;
    // titleDiffers holds them for any two titles, and refuses an AcoustID match
    if (a.title && b.title) {
        const d = titleDistinctWords(a.title, b.title);
        sig.titleDiffers = d;
        if (titleAlike(a.title, b.title)) { if (d) sig.titleDistinct = d; else sig.title = true; }
    }
    /* #594 (chaban-mb): "auto-matching with normal cutoff fails due to differing
       artists credits even though the artist themselves are identical."
       Measured on his release group: both releases credit artist
       5b44eac2-b29e-42ba-bd99-213a270149d6, one as "Radium" and the other as
       "DJ Radium". artistSimilar scores that 1 token of 2 = 0.5, under its 0.8
       threshold, so sig.artist was false and `normal` — which needs
       title && artist && length — could not group even the pair whose titles and
       5:05 lengths were identical. Dropping to `loose` was the only way through,
       and that weakens every other pair in the pool at the same time.
       A credit string is a display form; the MBID is the artist. When both sides
       carry MBIDs, compare those and let the string disagree. Sets, not sequence:
       "A & B" and "B & A" are the same two artists. The string comparison stays
       as the fallback for recordings fetched without artist credits. */
    if (a.artistGids && a.artistGids.length && b.artistGids && b.artistGids.length) {
        const ka = a.artistGids.slice().sort().join(','), kb = b.artistGids.slice().sort().join(',');
        if (ka === kb) { sig.artist = true; sig.artistByMbid = true; }
    } else if (a.artistCredit && b.artistCredit && artistSimilar(a.artistCredit, b.artistCredit)) {
        sig.artist = true;
    }
    return sig;
}
/* #823 (majkinetor): Match by position, an explicit action only, for localised
   or translated titles. Two recordings group when they sit at the same track
   number (and track count, where both are known) on two different releases,
   their artists agree and their lengths are close; every gate that is not about
   the title (video, pending edits, gross length, live/place, ISRC batch) holds. */
function samePosition(a, b) {
    for (const ra of a.releases || []) {
        if (ra.trackNumber == null) continue;
        for (const rb of b.releases || []) {
            if (rb.gid === ra.gid || rb.trackNumber == null) continue;
            if (String(ra.trackNumber) !== String(rb.trackNumber)) continue;
            if (ra.trackCount != null && rb.trackCount != null && ra.trackCount !== rb.trackCount) continue;
            return ra.trackNumber;
        }
    }
    return null;
}
function positionUnion(sig, a, b) {
    if (sig.videoMismatch || sig.pendingEdit || sig.lengthConflict || sig.liveMismatch || sig.placeConflict || sig.isrcConflict) return false;
    if (!sig.artist || !sig.length) return false;
    return samePosition(a, b) != null;
}
function autoMatch(pool, tolMs, cutoff) {
    cutoff = cutoff || 'normal';
    const byPos = cutoff === 'position';
    if (pool.length < 2) return [];
    const uf = gatedUnionFind(pool), find = uf.find;   // #623 U3: the gates hold for the whole group
    let lengthBlocked = 0, bridgeBlocked = 0, guardBlocked = 0, settingBlocked = 0;
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const sig = pairSignals(pool[i], pool[j], tolMs);
            /* #594: say so when the MBID path is what carried the artist signal
               and the credit strings would have refused it. This is the whole
               behaviour change, and without a line for it the only evidence is a
               group appearing that did not before. */
            if (byPos) {
                if (positionUnion(sig, pool[i], pool[j])) {
                    const joined = uf.union(pool[i].gid, pool[j].gid);
                    Log.info('  ' + (joined === true ? 'grouped' : 'not grouped (' + joined + ' in the group it would join)') + ' by position ' + samePosition(pool[i], pool[j]) + ': "' + pool[i].title + '" ' + dur(pool[i].length) + ' ↔ "' + pool[j].title + '" ' + dur(pool[j].length));
                }
                continue;
            }
            if (sig.artistByMbid && !artistSimilar(pool[i].artistCredit || '', pool[j].artistCredit || '')) {
                Log.info('  same artist by MBID despite differing credits: "' + pool[i].artistCredit
                    + '" vs "' + pool[j].artistCredit + '" (' + pool[i].artistGids.join(', ') + ')');
            }
            // a pair that would otherwise have grouped, held back purely by the
            // gross-length guard — worth reporting rather than silently dropping
            if (sig.lengthConflict && (sig.isrc || sig.acoustid || (sig.title && sig.artist) || (sig.title && sig.length))) {
                lengthBlocked++;
                Log.info('  not grouped (length differs by ' + Math.round(Math.abs(pool[i].length - pool[j].length) / 1000) + 's): "'
                    + pool[i].title + '" ' + dur(pool[i].length) + ' vs "' + pool[j].title + '" ' + dur(pool[j].length));
            }
            // #789: a pair that would have grouped but for live/studio or the place
            if ((sig.liveMismatch || sig.placeConflict) && shouldUnion(Object.assign({}, sig, { liveMismatch: false, placeConflict: null }), cutoff)) {
                settingBlocked++;
                Log.info('  not grouped (' + (sig.liveMismatch ? 'live and studio' : 'recorded at ' + sig.placeConflict) + '): "'
                    + pool[i].title + '"' + (pool[i].live ? ' (live)' : '') + ' vs "' + pool[j].title + '"' + (pool[j].live ? ' (live)' : ''));
            }
            // #760: a pair that would have grouped but for the title or ISRC-batch guard
            if ((sig.titleDiffers || sig.isrcConflict) && !shouldUnion(sig, cutoff)
                && shouldUnion(Object.assign({}, sig, { title: sig.title || !!sig.titleDistinct, isrcConflict: null, titleDiffers: null }), cutoff)) {
                guardBlocked++;
                Log.info('  not grouped (' + (sig.isrcConflict ? 'ISRCs ' + sig.isrcConflict + ' from one batch'
                    : (sig.acoustid ? 'shared AcoustID, but ' : '') + 'titles differ in "' + sig.titleDiffers.a.join(' ') + '" / "' + sig.titleDiffers.b.join(' ') + '"')
                    + '): "' + pool[i].title + '" ' + dur(pool[i].length) + ' vs "' + pool[j].title + '" ' + dur(pool[j].length));
            }
            if (shouldUnion(sig, cutoff)) {
                const joined = uf.union(pool[i].gid, pool[j].gid);
                // the pair matches, but joining would put a conflicting pair into one group
                if (joined !== true) {
                    bridgeBlocked++;
                    Log.info('  not grouped (' + joined + ' in the group it would join): "' + pool[i].title + '" ' + dur(pool[i].length)
                        + (pool[i].video ? ' (video)' : '') + ' ↔ "' + pool[j].title + '" ' + dur(pool[j].length) + (pool[j].video ? ' (video)' : ''));
                }
            }
        }
    }
    if (bridgeBlocked) Log.warn(bridgeBlocked + ' matching pair(s) kept apart: joining them would have grouped a video with an audio recording, a live with a studio one, different places, lengths more than ' + Math.round((SETTINGS.grossLengthMs || 30000) / 1000) + 's apart, or two ISRCs of one batch, through a recording whose value is unknown');
    if (guardBlocked) Log.warn(guardBlocked + ' pair(s) held back as different tracks (titles that differ in a word on each side, even with a shared AcoustID, or ISRCs of one batch) — group them by hand if they really are the same');
    if (settingBlocked) Log.warn(settingBlocked + ' pair(s) held back as different recordings (a live and a studio one, or recorded at different places or dates) — group them by hand if they really are the same');
    if (lengthBlocked) Log.warn(lengthBlocked + ' pair(s) held back by the gross-length guard (>' + Math.round((SETTINGS.grossLengthMs || 30000) / 1000) + 's apart) — group them by hand if they really are the same take');
    const byRoot = new Map();
    for (const r of pool) { const root = find(r.gid); if (!byRoot.has(root)) byRoot.set(root, []); byRoot.get(root).push(r); }
    const groups = [];
    for (const members of byRoot.values()) {
        if (members.length < 2) continue;
        const meta = computeGroupConfidence(members);
        const target = members.slice().sort((a, b) => b.releases.length - a.releases.length)[0].gid;
        groups.push({ id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: members.map(m => m.gid), confidence: meta.confidence, tier: meta.tier, signals: meta.signals, signalsAll: meta.signalsAll, target, state: 'pending', error: null, editNote: null, editing: false });
    }
    return groups;
}
// #529 follow-up (majkinetor, live): "Match should show some progress (not
// sure why it took so long in my test)" — AcoustID enrichment is one network
// round-trip per pool recording; on anything bigger than a handful of tracks
// that dominates Auto-match's wall time with nothing visible happening. Report
// live N/M counts back to the caller so the button (and the log) can show it.
// Serialized on purpose. The seed fires enrichment as a floating promise while
// auto-match-on-open starts its own, and each snapshots "which recordings still
// have acoustids == null" BEFORE the other writes its results back — so both
// asked AcoustID for an overlapping set. In majkinetor's log four batches of 50
// covered far fewer than 200 distinct MBIDs, some queried twice and others
// never. Queueing makes the second caller's filter run after the first has
// stored its answers, so it only asks for what is genuinely still missing.
let _acoustidQueue = Promise.resolve();
function enrichAcoustIds(recs, concurrency, onProgress) {
    const run = () => enrichAcoustIdsNow(recs, concurrency, onProgress);
    _acoustidQueue = _acoustidQueue.then(run, run);
    return _acoustidQueue;
}
async function enrichAcoustIdsNow(recs, concurrency, onProgress) {
    const pending = recs.filter(r => r.acoustids == null);
    if (!pending.length) { if (onProgress) onProgress(recs.length, recs.length); return; }
    let done = recs.length - pending.length;
    let found = 0;
    const failed = [];
    const runBatch = async (slice) => {
        const map = await fetchAcoustIdsBatch(slice.map(r => r.gid));
        if (!map) return false;                       // leave them null = "not looked up"
        slice.forEach(rec => {
            rec.acoustids = map.get(rec.gid) || [];   // only NOW does empty mean "none"
            if (rec.acoustids.length) found++;
        });
        return true;
    };
    const epoch = _bgEpoch;
    for (let i = 0; i < pending.length; i += ACOUSTID_BATCH) {
        if (!bgAlive(epoch)) { Log.warn('AcoustID lookup stopped after ' + done + ' of ' + pending.length + ' recording(s)'); break; }
        const slice = pending.slice(i, i + ACOUSTID_BATCH);
        if (!await runBatch(slice)) failed.push(slice);
        done += slice.length;
        if (onProgress) onProgress(done, recs.length);
    }
    // One retry for whole batches that failed, so a single blip doesn't leave a
    // chunk of the pool unresolved for the rest of the session.
    if (failed.length) {
        const n = failed.reduce((a, s) => a + s.length, 0);
        Log.warn('AcoustID: ' + failed.length + ' batch(es) failed (' + n + ' recording(s)) — retrying once');
        const stillFailed = [];
        for (const slice of failed) if (!await runBatch(slice)) stillFailed.push(slice);
        const left = stillFailed.reduce((a, s) => a + s.length, 0);
        if (left) {
            Log.error('AcoustID: ' + left + ' recording(s) could not be checked — shown as unknown, NOT as "no AcoustID"');
            setNetTrouble('offline', left + ' recording(s) could not be checked against AcoustID');
        }
    }
    const checked = pending.length - failed.reduce((a, s) => a + s.length, 0);
    Log.info('AcoustID lookup: ' + found + ' of ' + checked + ' checked recording(s) have an AcoustID'
        + (checked < pending.length ? ' (' + (pending.length - checked) + ' could not be checked)' : ''));
}
// #762 (chaban-mb): "once I got to AcoustID page and remove bad links there I'd like to get
// fresh AcoustID data in current Fusion session without having to reload whole page. Then it
// can reevaluate matches." Asks acoustid.org again for one group's members and recomputes the
// group's signals. A member's AcoustIDs are replaced only when its answer arrives: a failed
// lookup keeps what was known rather than claiming "none". Membership is left alone; the
// chips and tints show what no longer holds, and the user decides.
async function refreshGroupAcoustIds(g) {
    if (!g || g.acRefreshing) return;
    const members = g.memberGids.map(x => STATE.recordings.get(x)).filter(Boolean);
    if (!members.length) return;
    g.acRefreshing = true; renderGroups();
    const before = members.map(m => m.acoustids == null ? null : m.acoustids.slice());
    const sigBefore = (g.signalsAll || []).join(',') || 'none';
    Log.info('AcoustID refresh: checking ' + members.length + ' recording(s) of group "' + (members[0].title || g.id) + '" again');
    let failed = 0;
    try {
        for (let i = 0; i < members.length; i += ACOUSTID_BATCH) {
            const slice = members.slice(i, i + ACOUSTID_BATCH);
            const map = await fetchAcoustIdsBatch(slice.map(r => r.gid));
            if (!map) { failed += slice.length; continue; }
            slice.forEach(rec => { rec.acoustids = map.get(rec.gid) || []; });
        }
    } finally { g.acRefreshing = false; }
    let changed = 0;
    members.forEach((m, i) => {
        const was = before[i] == null ? 'not checked' : (before[i].join(',') || 'none');
        const now = m.acoustids == null ? 'not checked' : (m.acoustids.join(',') || 'none');
        if (was !== now) { changed++; Log.info('  ' + (m.title || m.gid) + ' (' + m.gid + '): AcoustID ' + was + ' → ' + now); }
        else Log.debug('  ' + (m.title || m.gid) + ' (' + m.gid + '): AcoustID unchanged (' + now + ')');
    });
    refreshGroupMeta(g);
    const sigAfter = (g.signalsAll || []).join(',') || 'none';
    Log.info('AcoustID refresh: ' + changed + ' of ' + members.length + ' recording(s) changed'
        + (failed ? ', ' + failed + ' could not be checked (kept as before)' : '')
        + '; signals every member shares: ' + sigBefore + (sigAfter !== sigBefore ? ' → ' + sigAfter : ' (unchanged)')
        + '; ' + g.confidence + ' confidence, ' + g.tier + ' tier');
    if (failed) setNetTrouble('offline', failed + ' recording(s) could not be checked against AcoustID');
    renderAll();
}
// ISRC/video reconciliation against MB's authoritative per-recording lookup —
// the rgid:/arid: search index can lag and report none where MB actually has
// them (#529). Separate from AcoustID now that they come from different services.
// #529 (majkinetor): "Why are we getting ISRCs on matching when we already
// have them in the pool?" - we shouldn't have been. This used to refetch every
// recording whose isrcs array was EMPTY, conflating "MB says it has none" with
// "we never looked". Most of a pool genuinely has no ISRC, so Auto-match
// re-requested hundreds of recordings on every single run - which is what
// provoked the 503 storm. Seeding already returns ISRCs authoritatively (the
// search and the per-recording lookup both include the field), so those are
// marked known and never refetched.
async function enrichIsrcs(recs, concurrency, onProgress) {
    concurrency = concurrency || 2;   // one MB request per recording — go easy (#529)
    const pending = recs.filter(r => !r.isrcsKnown || r.video == null);
    if (!pending.length) { Log.info('ISRCs already known for all ' + recs.length + ' recording(s) — no lookups needed'); if (onProgress) onProgress(0, 0); return; }
    Log.info('Fetching ISRCs for ' + pending.length + ' of ' + recs.length + ' recording(s) (the rest are already known)');
    let i = 0, done = 0;
    async function worker() {
        while (i < pending.length) {
            const rec = pending[i++];
            const d = await fetchRecordingDetail(rec.gid);
            if (d) {
                if (d.isrcs.length && d.isrcs.join(',') !== (rec.isrcs || []).join(',')) {
                    Log.info('  ISRC backfill for ' + rec.title + ': search said [' + ((rec.isrcs || []).join(',') || 'none') + '], MB has [' + d.isrcs.join(',') + ']');
                    rec.isrcs = d.isrcs;
                }
                if (rec.video == null) rec.video = d.video;
                if (rec.places == null) { rec.live = d.live; rec.places = d.places; }   // #789
                rec.isrcsKnown = true;
                rec.isrcSource = 'entity';   // now confirmed against the entity, not the index
            }
            done++; if (onProgress) onProgress(done, pending.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
}

// ── merge submission (verified live against test.musicbrainz.org — GET
// /recording/merge_queue?add-to-merge=<id>×N redirects to /recording/merge, whose
// self-posting form has merge.merging.N / merge.target / merge.edit_note /
// merge.make_votable and no CSRF token, session cookie authorises; a merge always goes to a
// vote, being destructive, so make_votable is never sent: #763) ──────────
// #529 (majkinetor): "we should also have more precise log message … says
// similar title while title is the same. Check also how other userscript does
// it." Modelled on jesus2099's MASS MERGE RECORDINGS note: itemised evidence
// carrying the ACTUAL values, and distinguishing an exact match from a close
// one, so a reviewer can judge the merge without opening anything.
// #608 (chaban-mb): MB keeps the merge queue in ONE per-user session slot
// ($c->session->{merger}) and wipes it when any merge submits. Two merges in
// flight at once clobber each other: the loser's POST finds no queue and MB
// redirects it to "/" without creating an edit. So the merge_queue GET + merge
// POST pair runs strictly one at a time, whoever starts it (Merge All workers
// or separate per-group clicks). The lookups before it still run in parallel.
let _mergeLock = Promise.resolve();
function withMergeLock(fn) {
    const run = _mergeLock.then(fn, fn);
    _mergeLock = run.catch(() => {});
    return run;
}
const uniq = arr => [...new Set(arr)];
function fmtList(vals, max) {
    max = max || 4;
    const shown = vals.slice(0, max).map(v => '"' + v + '"').join(', ');
    return vals.length > max ? shown + ' (+' + (vals.length - max) + ' more)' : shown;
}
function evidenceLines(group, members) {
    const all = group.signalsAll || [];
    const lines = [];
    if (all.includes('title')) {
        const titles = uniq(members.map(m => m.title).filter(Boolean));
        if (titles.length === 1) lines.push('Same title ' + fmtList(titles));
        else if (uniq(titles.map(t => t.toLowerCase())).length === 1) lines.push('Same title, differing case: ' + fmtList(titles));
        else lines.push('Similar titles: ' + fmtList(titles));
    }
    if (all.includes('artist')) {
        const acs = uniq(members.map(m => m.artistCredit).filter(Boolean));
        lines.push((acs.length === 1 ? 'Same artist credit ' : 'Similar artist credits: ') + fmtList(acs));
    }
    if (all.includes('length')) {
        const lens = members.map(m => m.length).filter(l => l != null);
        const lo = Math.min(...lens), hi = Math.max(...lens);
        // #529 (majkinetor): "length in this case could be stated as Max Length
        // Difference: 5s" — name the gap explicitly rather than leaving the
        // reader to subtract the range themselves.
        lines.push(lo === hi
            ? 'Same length ' + dur(lo)
            : lengthDiffLabel(members) + ' ' + Math.round((hi - lo) / 1000) + 's (' + dur(lo) + ' – ' + dur(hi) + ')');
    }
    if (all.includes('isrc')) {
        const shared = uniq(members[0].isrcs.filter(i => members.every(m => (m.isrcs || []).includes(i))));
        if (shared.length) lines.push('Same ISRC ' + shared.join(', '));
    }
    if (all.includes('acoustid')) {
        const shared = uniq((members[0].acoustids || []).filter(a => members.every(m => (m.acoustids || []).includes(a))));
        if (shared.length) lines.push('Same AcoustID ' + shared.join(', '));
    }
    return lines;
}
// Widest gap between any two known lengths in the group — the number that
// actually matters when lengths only "sort of" agree.
// #529 (majkinetor): "When there is only 1 to merge edit message should omit
// 'Max' from 'Max length difference'." With two recordings there is exactly one
// pairwise difference, so "Max" claims a comparison that was never made.
function lengthDiffLabel(members) {
    const known = members.filter(m => typeof m.length === 'number' && m.length > 0).length;
    return known > 2 ? 'Max length difference' : 'Length difference';
}
function lengthSpread(members) {
    const lens = members.map(m => m.length).filter(l => typeof l === 'number' && l > 0);
    if (lens.length < 2) return null;
    return Math.max(...lens) - Math.min(...lens);
}
function autoEditNote(group) {
    const members = group.memberGids.map(g => STATE.recordings.get(g)).filter(Boolean);
    const target = STATE.recordings.get(group.target) || members[0];
    const lines = evidenceLines(group, members);
    // #529 (majkinetor): "Move 'Keeping ...' to the first line and name it
    // 'Merge 3 recordings into "Sweet music": <URL>'." The kept recording is the
    // single most important fact in the note, so it leads instead of trailing
    // after the evidence.
    const keptUrl = target && target.gid ? location.origin + '/recording/' + target.gid : '';
    const out = ['Merge ' + members.length + ' recordings into ' + (target ? '"' + target.title + '"' : 'one') + (keptUrl ? ': ' + keptUrl : '.'), ''];
    // #529 (majkinetor): "len is sometimes reported outside bullet list along
    // some other lines, make this consistent." Everything below the first line
    // is a bullet now — the length and partial-signal notes used to sit as loose
    // paragraphs between the bullets, which read like separate sections.
    const bullets = lines.slice();
    if (!bullets.length) bullets.push('Grouped manually; no automatic signal matched across every recording.');
    // Partial signals are stated as partial rather than silently omitted — and
    // length gets a concrete number instead of a bare "matching only some of
    // them: length", which said nothing about how far apart they actually were.
    const partial = (group.signals || []).filter(x => !(group.signalsAll || []).includes(x));
    const rest = partial.filter(x => x !== 'length');
    if (partial.includes('length')) {
        const spread = lengthSpread(members);
        if (spread != null) bullets.push(lengthDiffLabel(members) + ' ' + Math.round(spread / 1000) + 's');
        else rest.push('length');
    }
    if (rest.length) bullets.push('Matching only some of them: ' + rest.join(', ') + '.');
    // #529 (majkinetor): "Add confidence level in the edit note" — the tier the
    // card is tinted by, so a reviewer sees the same judgement the UI showed.
    const tier = group.tier || 'manual';
    bullets.push('Confidence: ' + tier);
    bullets.forEach(b => out.push('- ' + b));
    return out.join('\n');
}
// #529 (majkinetor): a per-group edit note, editable from the card. A custom
// note REPLACES the auto-generated reason line; the attribution footer is
// always appended so the edit stays traceable either way.
function buildEditNote(group) {
    const body = (group.editNote && group.editNote.trim()) ? group.editNote.trim() : autoEditNote(group);
    return body + '\n\n' + ((typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.name) || 'Fusion') + ' v' + VERSION + ' by majkinetor - ' + HELP_URL + (group.via ? '\n' + group.via : '');
}
async function ensureInternalIds(gids) {
    const ids = [];
    for (const gid of gids) {
        const id = await resolveInternalId(gid);
        if (!id) throw new Error('could not resolve an internal id for ' + gid);
        ids.push(id);
    }
    return ids;
}
// #529 follow-up (majkinetor): "In logging I want to see merge all event and
// what is going on" + "we can see the data of the recordings" — dump every
// member's actual data (title/isrc/acoustid/length/video/releases) into the
// log at the moment a merge is attempted, not just ids, so a merge can be
// diagnosed from the Log panel alone without a screenshot round-trip.
function describeRecordingForLog(rec) {
    if (!rec) return '(missing from STATE.recordings)';
    return rec.title
        + ' [isrc=' + ((rec.isrcs && rec.isrcs.join(',')) || 'none')
        + ' acoustid=' + ((rec.acoustids && rec.acoustids.join(',')) || (rec.acoustids == null ? 'not checked' : 'none'))
        + ' length=' + dur(rec.length)
        + ' video=' + (rec.video == null ? 'unknown' : rec.video)
        + ' live=' + (rec.live == null ? 'unknown' : rec.live)
        + ' recorded=' + (rec.places == null ? 'unknown' : rec.places.map(placeText).join('; ') || 'none')
        + ' releases=' + (rec.releases || []).map(r => r.title).join('; ') + ']';
}
async function mergeGroup(group) {
    if (!group) { Log.warn('mergeGroup called with no group'); return; }
    if (group.state === 'busy') { Log.warn('merge skipped: group ' + group.id + ' is already merging'); return; }
    if (group.state === 'done') { Log.warn('merge skipped: group ' + group.id + ' is already merged'); return; }
    if (group.memberGids.length < 2) { Log.warn('merge skipped: group ' + group.id + ' has fewer than 2 members (' + group.memberGids.length + ')'); return; }
    // establish it for this group if we never looked (grouped by hand, say)
    const members = group.memberGids.map(g => STATE.recordings.get(g)).filter(Boolean);
    if (members.some(r => r.editsPending == null)) await enrichPendingEdits(members, 2);
    const pending = members.filter(r => r.editsPending);
    if (pending.length) {
        group.state = 'error';
        group.error = 'Has pending edit(s): ' + pending.map(r => r.title).join(', ') + ' — resolve them in MB first';
        Log.warn('merge blocked for group ' + group.id + ' — ' + pending.length + ' member(s) have pending edits');
        renderGroups(); renderFooter(); return;
    }
    Log.info('▶ Merge group ' + group.id + ' — confidence=' + group.confidence + ' signals=[' + group.signals.join(',') + ']');
    group.memberGids.forEach(gid => Log.info('  member ' + gid + (gid === group.target ? ' (TARGET/kept)' : '') + ': ' + describeRecordingForLog(STATE.recordings.get(gid))));
    group.state = 'busy'; group.error = null; renderGroups();
    busyStart('merging…');
    try {
        const ids = await ensureInternalIds(group.memberGids);
        Log.info('  resolved internal ids: ' + group.memberGids.map((gid, i) => gid.slice(0, 8) + '…→' + ids[i]).join(', '));
        const targetIdx = group.memberGids.indexOf(group.target);
        const targetId = ids[targetIdx === -1 ? 0 : targetIdx];
        Log.info('  merging [' + ids.join(', ') + '] → keeping target ' + targetId);
        const addQs = ids.map(id => 'add-to-merge=' + id).join('&');
        const finalUrl = await withMergeLock(async () => {
          // #822: a POST MB bounces elsewhere (its browser check, a queue taken from another tab) created
          // nothing: unless the kept recording now shows the merge pending, pass the check and try once more
          for (let attempt = 1; ; attempt++) {
            Log.info('  merge session free — submitting group ' + group.id + (attempt > 1 ? ' (attempt ' + attempt + ')' : ''));
            const gr = await gmGet(location.origin + '/recording/merge_queue?' + addQs, { Accept: 'text/html' });
            if (gr.status < 200 || gr.status >= 400) throw new Error('merge_queue GET failed: HTTP ' + gr.status);
            const mergeUrl = gr.finalUrl || (location.origin + '/recording/merge');
            Log.info('  merge_queue redirected to ' + mergeUrl);
            const body = new URLSearchParams();
            ids.forEach((id, i) => body.append('merge.merging.' + i, String(id)));
            body.append('merge.target', String(targetId));
            const note = buildEditNote(group);
            body.append('merge.edit_note', note);
            Log.info('  edit note: ' + note.replace(/\n/g, ' ¶ '));
            const pr = await gmPost(mergeUrl, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Referer: mergeUrl, Origin: location.origin });
            if (pr.status >= 400) throw new Error('merge POST failed: HTTP ' + pr.status);
            const landed = pr.finalUrl || '';
            const reRendered = /\/recording\/merge(\?|$)/.test(landed) || /name="merge\.target"/.test(pr.responseText || '');
            // #608: a real merge redirects to the kept recording's page. Landing
            // anywhere else (MB sends a POST whose session queue was gone to "/")
            // means nothing was submitted — it used to count as success.
            const landedGid = (landed.match(/\/recording\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1] || null;
            Log.info('  POST landed at ' + landed + (reRendered ? ' (still the merge form — treating as failure)' : landedGid ? ' (recording page — success)' : ' (NOT a recording page — nothing was merged)'));
            if (reRendered) throw new Error('merge form returned an error (nothing submitted) — check you are logged in with merge privileges');
            if (!landedGid) {
                _pendingCache.delete(group.target);   // read it fresh: the cached answer is from before the POST
                const meta = await fetchEntityMeta(group.target);
                Log.info('  kept recording ' + group.target + ' edits pending: ' + (meta ? meta.editsPending : 'unknown'));
                if (meta && meta.editsPending) { Log.warn('  MB opened the merge but did not land on the recording — counted as merged'); return location.origin + '/recording/' + group.target; }
                if (attempt < 2) {
                    Log.warn('  MB did not create the merge (landed on ' + (landed || 'an unknown page') + ') — passing the browser check and trying again');
                    await mbnReverify(location.origin + '/ws/js/entity/' + group.target, { method: 'GET' }, { log: gateLog });
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }
                throw new Error('MB did not create the merge (landed on ' + (landed || 'an unknown page') + ', not the kept recording) — its merge queue was empty or taken; try again');
            }
            if (landedGid !== group.target) Log.warn('  landed on recording ' + landedGid + ', expected the target ' + group.target + ' — check the merge in MB');
            return landed;
          }
        });
        group.state = 'done';
        group.mergedUrl = finalUrl || null;
        Log.ok('✓ Merged group ' + group.id + ' → ' + finalUrl);
    } catch (e) {
        group.state = 'error'; group.error = e.message;
        Log.error('✗ Merge failed for group ' + group.id + ': ' + e.message);
    }
    busyEnd();
    renderGroups(); renderFooter();
}
// #529 follow-up (majkinetor): "Merge all should be parallel if possible" —
// a small worker pool prepares several groups at once (pending-edit check,
// internal ids). The submission itself is NOT independent per group: MB's merge
// queue is one per session, so withMergeLock serialises the GET+POST (#608).
// #529 (majkinetor): "Merge all should have summary at the end, basically show
// text that is collapsed". A run's outcome otherwise only existed in the log,
// which meant opening a separate window to find out whether anything failed.
// Collapsed to one line by default; <details> gives the toggle for free.
// #529 (majkinetor): "When auto match finds nothing, its not obvious that it
// fired at all. We should have a message shown. The only thing is visible in
// the Logs." A run that changes nothing looked identical to a button that did
// nothing, so the outcome now lands in the window, not only the log.
let _notice = null;
function showNotice(kind, text, short) { _notice = text ? { kind, text, short } : null; renderNotice(); }
function renderNotice() {
    const host = document.getElementById('fs-matchmsg'); if (!host) return;
    if (!_notice) { host.textContent = ''; host.style.display = 'none'; host.dataset.tip = ''; return; }
    host.style.display = '';
    host.className = 'fs-matchmsg fs-matchmsg-' + _notice.kind;
    host.textContent = _notice.short || _notice.text;
    host.dataset.tip = _notice.text;
}
let _lastRun = null;
function renderRunSummary(run) {
    if (run !== undefined) _lastRun = run;
    const host = document.getElementById('fs-runsum'); if (!host) return;
    if (!_lastRun) { host.innerHTML = ''; host.style.display = 'none'; return; }
    const r = _lastRun;
    const head = (r.failed ? '⚠ ' : '✓ ') + 'Merge All finished - ' + r.merged + ' merged'
        + (r.failed ? ', ' + r.failed + ' failed' : '') + ' (' + r.recordings + ' recordings) at ' + r.at;
    const rows = r.items.map(it => '<li class="' + (it.ok ? 'fs-runok' : 'fs-runbad') + '">'
        + (it.ok ? '✓ ' : '✗ ') + escapeHtml(it.title) + ' <span class="fs-runn">(' + it.n + ')</span>'
        + (it.ok
            ? (it.url ? ' <a href="' + escapeHtml(it.url) + '" target="_blank" rel="noopener">view</a>' : '')
            : ' <span class="fs-runerr">' + escapeHtml(it.error || 'failed') + '</span>')
        + '</li>').join('');
    host.style.display = '';
    host.innerHTML = '<details class="fs-runsum-d"' + (r.failed ? ' open' : '') + '>'
        + '<summary>' + escapeHtml(head) + '</summary>'
        + '<ul class="fs-runlist">' + rows + '</ul></details>'
        + '<span class="fs-runclose" data-tip="Dismiss this summary">✕</span>';
}
async function mergeAll(concurrency) {
    // Coerce defensively: a stray click Event (or anything non-numeric) landing
    // here used to poison Math.min into NaN, which made Array.from({length:NaN})
    // spawn ZERO workers — Merge All logged "queued" then instantly "finished:
    // 0 merged, 0 failed" without touching a single group. Never trust this arg.
    const n = Number(concurrency);
    concurrency = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
    const pending = STATE.groups.filter(g => g.state === 'pending' || g.state === 'error');
    const workers = Math.max(1, Math.min(concurrency, pending.length));
    busyStart('merging ' + pending.length + ' group(s)…');
    try {
    Log.info('══ Merge All: ' + pending.length + ' group(s) queued, up to ' + workers + ' prepared in parallel, submitted one at a time (#608) ══');
    if (!pending.length) { Log.warn('Merge All: nothing to do — no group is in pending/error state (already merged, or none formed yet)'); return; }
    let doneCount = 0, failCount = 0;
    let i = 0;
    async function worker() {
        while (i < pending.length) {
            const g = pending[i++];
            await mergeGroup(g);
            if (g.state === 'done') doneCount++; else failCount++;
            Log.info('── Merge All progress: ' + (doneCount + failCount) + '/' + pending.length + ' (' + doneCount + ' ok, ' + failCount + ' failed) ──');
        }
    }
    await Promise.all(Array.from({ length: workers }, worker));
    _lastRun = {
        merged: doneCount, failed: failCount,
        recordings: pending.reduce((a, g) => a + (g.state === 'done' ? g.memberGids.length : 0), 0),
        at: new Date().toLocaleTimeString(),
        items: pending.map(g => {
            const head = STATE.recordings.get(g.target) || STATE.recordings.get(g.memberGids[0]);
            return { ok: g.state === 'done', title: head ? head.title : g.id, n: g.memberGids.length, url: g.mergedUrl || null, error: g.error || null };
        }),
    };
    renderRunSummary();
    Log.info('══ Merge All finished: ' + doneCount + ' merged, ' + failCount + ' failed (of ' + pending.length + ') ══');
    } finally { busyEnd(); }
}

/* ════════════════════════════════ UI ════════════════════════════════ */
// The shared design tokens (#562). Values live in dev/tokens/design-tokens.mjs and
// are inlined here by dev/tokens/sync-tokens.mjs — edit them THERE, never here.
// <ST-TOKENS> — generated by dev/tokens/sync-tokens.mjs from dev/tokens/design-tokens.mjs — DO NOT EDIT
const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001;--mbu-z-tip:2147483647}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
// </ST-TOKENS>

// The shared UI components (#563). Definitions live in dev/ui/ui-components.mjs
// and are inlined here by dev/ui/sync-ui.mjs — edit them THERE, never here.
// <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
const MBU_UI_CSS = '.mbu-help{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--mbu-text-weak);text-decoration:none;line-height:1}.mbu-help svg{width:18px;height:18px;display:block}.mbu-help:hover{color:var(--mbu-accent-text,var(--mbu-accent));background:none;text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{width:auto;margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;width:auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(860px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-hclear,.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min,.mbu-logpop-full{width:auto;font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-hclear:hover,.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover,.mbu-logpop-full:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-log-f,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x,#mbu-logpop.min .mbu-logpop-full{display:none}#mbu-logpop.min{max-height:none;width:auto!important;height:auto!important}#mbu-logpop.sized{max-height:none}.mbu-logpop-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;opacity:.6;background:linear-gradient(135deg,transparent 55%,var(--mbu-border-strong) 55%,var(--mbu-border-strong) 62%,transparent 62%,transparent 75%,var(--mbu-border-strong) 75%,var(--mbu-border-strong) 82%,transparent 82%)}.mbu-logpop-grip:hover{opacity:1}#mbu-logpop.min .mbu-logpop-grip,#mbu-logpop.full .mbu-logpop-grip{display:none}#mbu-logpop.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;width:auto!important;height:auto!important;max-height:none;transform:none!important}#mbu-logpop.full .mbu-logpop-h{cursor:default}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-logemb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--mbu-bg);font:13px var(--mbu-font);color:var(--mbu-text)}.mbu-logemb .mbu-logpop-h{cursor:default;padding:7px 10px}.mbu-logemb .mbu-logpop-h>.mbu-log-q{flex-basis:160px;margin-left:0}.mbu-logemb .mbu-logpop-h>.mbu-log-ses{flex-basis:240px}.mbu-logpop-h{flex-wrap:nowrap}.mbu-logpop-h>*{flex-shrink:0;white-space:nowrap}.mbu-logpop-h>.mbu-log-q{flex-shrink:1;min-width:60px}.mbu-logpop-h>.mbu-log-ses{flex-shrink:1;min-width:90px}.mbu-logpop-h>.mbu-logpop-sp{flex:1 1 0;min-width:0}.mbu-logpop .mbu-log-ses{flex:0 1 260px;min-width:120px;max-width:100%}.mbu-logpop-hclear:disabled{opacity:.5;cursor:default}.mbu-log-dbg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--mbu-text);cursor:pointer;white-space:nowrap}.mbu-log-dbg input{margin:0}#mbu-logpop.min .mbu-log-dbg{display:none}.mbu-log-past .mbu-logpop-clear{display:none}#mbu-logpop.min .mbu-log-ses,#mbu-logpop.min .mbu-logpop-hclear{display:none}.mbu-logpop .mbu-log-q{flex:0 1 200px;min-width:80px;margin-left:6px;font:12px var(--mbu-font);padding:2px 8px;border:1px solid var(--mbu-border);border-radius:5px;cursor:text}#mbu-logpop.min .mbu-log-q{display:none}.mbu-logpop .mbu-log-li.mbu-log-nq{display:none}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-pre .mbu-log-m{white-space:pre;font:12px/1.35 ui-monospace,Consolas,monospace;word-break:normal}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-c{color:var(--mbu-text-weak);flex:0 0 auto}.mbu-log-list:not(.mbu-log-cats) .mbu-log-c{display:none}.mbu-log-list.mbu-log-cats{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:3px 9px;align-content:start}.mbu-log-cats .mbu-log-li{display:contents}.mbu-log-cats .mbu-log-empty{grid-column:1/-1}.mbu-log-f{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;padding:5px 13px;border-bottom:1px solid var(--mbu-border-soft);font-size:11px}.mbu-log-f[hidden]{display:none}.mbu-log-fg{display:contents}.mbu-log-fs{width:1px;height:12px;background:var(--mbu-border);margin:0 6px}.mbu-logpop .mbu-log-fb{width:auto;font:inherit;color:var(--mbu-text-weak);background:none;border:1px solid transparent;border-radius:5px;padding:0 6px;line-height:1.6;cursor:pointer}.mbu-logpop .mbu-log-fb:hover{color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb.on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb[data-sev=error]{color:var(--mbu-error)}.mbu-logpop .mbu-log-fb[data-sev=warn]{color:var(--mbu-warn)}.mbu-logpop .mbu-log-fb[data-sev=info]{color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-fb[data-sev].on{background:var(--mbu-bg-hover);border-color:currentColor;font-weight:600}.mbu-logpop .mbu-log-fb[data-cat]{border-color:var(--mbu-border-soft);background:var(--mbu-bg-raised);border-radius:999px;padding:0 8px}.mbu-logpop .mbu-log-fb[data-cat].on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-accent)}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug>*{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}select.mbu-select:not(#mbu-0):not(#mbu-1){-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box;height:22px;max-width:100%;margin:0 2px;padding:0 26px 0 12px;border:1px solid var(--mbu-border);border-radius:20px;outline-offset:1px;background-color:transparent;background-image:linear-gradient(45deg,transparent 50%,var(--mbu-text-weak) 50%),linear-gradient(135deg,var(--mbu-text-weak) 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat;color:var(--mbu-text);font:600 12px var(--mbu-font);line-height:20px;cursor:pointer;vertical-align:middle}select.mbu-select:not(#mbu-0):not(#mbu-1):hover{border-color:var(--mbu-accent)}select.mbu-select:not(#mbu-0):not(#mbu-1):disabled{opacity:.45;cursor:default;border-color:var(--mbu-border)}select.mbu-select:not(#mbu-0):not(#mbu-1) option{background:var(--mbu-bg);color:var(--mbu-text);font-weight:400}.mbu-step:not(#mbu-0):not(#mbu-1){display:inline-flex;align-items:center;box-sizing:border-box;height:22px;margin:0 2px;padding:0;border:1px solid var(--mbu-border);border-radius:20px;background:transparent;vertical-align:middle;white-space:nowrap;flex:0 0 auto}.mbu-step:not(#mbu-0):not(#mbu-1):hover,.mbu-step:not(#mbu-0):not(#mbu-1):focus-within{border-color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>button{all:unset;box-sizing:border-box;width:20px;height:20px;text-align:center;font:600 13px/20px var(--mbu-font);color:var(--mbu-text-weak);cursor:pointer;user-select:none}.mbu-step:not(#mbu-0):not(#mbu-1)>button:hover{color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>input{all:unset;box-sizing:content-box;min-width:2ch;height:20px;padding:0 1px;font:600 12px/20px var(--mbu-font);color:var(--mbu-text);text-align:center;-moz-appearance:textfield;appearance:textfield;cursor:text}.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-inner-spin-button,.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled){opacity:.45;border-color:var(--mbu-border)}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled)>button{cursor:default;color:var(--mbu-text-weak)}';
// Help link markup. Every script's help link is this, pointing at its own README.
// `name` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
var MBU_HELP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/></svg>';
// the sort-name guess, A over Z with a down arrow, for every button that guesses a sort name
var MBU_SORT_ICON = '<svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18M1 17l4 4 4-4"/><path d="M13 11l3-8 3 8M14.1 8h3.8M13 14h6l-6 7h6"/></svg>';
// the edit pencil, for every button that opens an editor (#849)
var MBU_EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener" aria-label="Help"'
        + ' data-tip="Help: open the README in a new tab">' + (label || MBU_HELP_ICON) + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Help');
    a.dataset.tip = 'Help: open the README in a new tab';
    if (label) a.textContent = label; else a.innerHTML = MBU_HELP_ICON;
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
// On MusicBrainz it ends with the interface language, which changes what a script reads
// off the page: "· MusicBrainz in de".
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
    try {
        if (/(^|\.)musicbrainz\.(org|eu)$/i.test(location.hostname)) {
            // <html lang>, or MB's lang cookie when the page isn't parsed yet (document-start)
            var lang = (document.documentElement && document.documentElement.lang) || ((document.cookie.match(/(?:^|;\s*)lang=([^;]+)/) || [])[1]) || 'en';
            line += ' · MusicBrainz in ' + lang;
        }
    } catch (e) { /* no document */ }
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
    if (o.version) html += '<span class="mbu-cfg-ver" data-tip="The installed version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' data-tip="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Settings controls: in root, every <select> becomes the pill drop-down and every number field the
// − n + stepper. The field stays the script's own (its value, min, max, step and listeners): − and +
// step it within them and fire input and change, as typing would. Call it once a window's markup is in;
// again after a re-render does no harm. Returns root.
function mbuControls(root) {
    if (!root || !root.querySelectorAll) return root;
    Array.prototype.forEach.call(root.querySelectorAll('select'), function (s) { s.classList.add('mbu-select'); });
    Array.prototype.forEach.call(root.querySelectorAll('input[type=number]'), function (inp) {
        var p = inp.parentNode;
        if (!p || (p.classList && p.classList.contains('mbu-step'))) return;
        var wrap = document.createElement('span');
        wrap.className = 'mbu-step';
        p.insertBefore(wrap, inp);
        var btn = function (down) {
            var b = document.createElement('button');
            b.type = 'button';
            b.tabIndex = -1;
            b.textContent = down ? '−' : '+';
            b.setAttribute('aria-label', down ? 'Less' : 'More');
            b.addEventListener('click', function (e) {
                e.preventDefault();
                if (inp.disabled || inp.readOnly) return;
                var was = inp.value;
                try { if (down) inp.stepDown(); else inp.stepUp(); } catch (x) { return; }
                if (inp.value === was) return;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return b;
        };
        wrap.appendChild(btn(true));
        wrap.appendChild(inp);
        wrap.appendChild(btn(false));
        // as wide as its longest value; a width the script set for the old field would cut it
        inp.style.width = Math.max(2, String(inp.max || inp.value || '').length) + 0.5 + 'ch';
    });
    return root;
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Shared settings: the few that belong to all the scripts at once, not to one (the corner
// launchers' layout). GM storage is private to each script, so these live in the page's
// localStorage on MusicBrainz's origin, as JSON under 'mbu.<key>'; every script, bundled or
// standalone, reads the same value. One argument reads (undefined when unset or blocked), two
// write, and null removes. Per-origin: musicbrainz.org, beta and test each keep their own.
// Every key is listed in DEVELOP.md → Shared storage.
function mbuShared(key, value) {
    var k = 'mbu.' + key;
    try {
        if (arguments.length < 2) { var v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); }
        if (value == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { /* storage blocked */ }
    return value;
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use, all bottom-right: Apollo and Art Station 10 (never on the same page), Scribe 15
// (above Apollo on the edit page), Falcon 20, Fusion 30, Mission Control 40. Scribe is not on the shared block and keeps a copy of this.
// The stack is a column; the shared setting cornerFlow = 'row' (mbuShared, set from String
// Theory's menu) lines it up along the bottom/top edge instead, the lowest order still nearest the corner.
// The shared setting cornerSide = 'left' (also from the menu) mirrors every corner across the screen: a
// launcher tagged 'br' sits bottom-left. Its other side is set to auto, so a CSS left/right can't stretch it.
// On a phone MusicBrainz's page is wider than the screen, so the browser widens the layout
// viewport, which position:fixed measures from, to the page: the corner was off screen, a scroll
// right and down away. Each edge is offset by the gap between it and the visual viewport (what is
// on screen), kept up as that scrolls and resizes; on a desktop the gap is 0.
function mbRestackCorner(corner) {
    var bottom = corner[0] === 'b', right = (corner[1] === 'r') !== (mbuShared('cornerSide') === 'left');
    var row = mbuShared('cornerFlow') === 'row';
    var vv = window.visualViewport, gapX = 0, gapY = 0;
    if (vv) {
        gapX = Math.max(0, right ? window.innerWidth - vv.offsetLeft - vv.width : vv.offsetLeft);
        gapY = Math.max(0, bottom ? window.innerHeight - vv.offsetTop - vv.height : vv.offsetTop);
        var root = document.documentElement;
        if (!root.hasAttribute('data-mb-corner-vv')) {   // one listener for every script's copy
            root.setAttribute('data-mb-corner-vv', '');
            var queued = false;
            var again = function () {
                if (queued) return;
                queued = true;
                requestAnimationFrame(function () { queued = false; ['br', 'bl', 'tr', 'tl'].forEach(function (c) { if (document.querySelector('[data-mb-corner="' + c + '"]')) mbRestackCorner(c); }); });
            };
            vv.addEventListener('resize', again);
            vv.addEventListener('scroll', again);
            // the layout viewport can change alone, with no event: a full-screen view pins the page's body
            // (780px → the screen's width); the body's size is what moves then
            window.addEventListener('resize', again);
            if (window.ResizeObserver && document.body) new window.ResizeObserver(again).observe(document.body);
        }
    }
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return getComputedStyle(el).display !== 'none'; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? 14 : pos)) + 'px';
        el.style[right ? 'right' : 'left'] = (gapX + (row ? pos : 14)) + 'px';
        el.style[right ? 'left' : 'right'] = 'auto';
        pos += (row ? r.width : r.height) + 8;
    });
}

// Activity log: the session's log lines plus the viewers that show them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//   LOG.cat('Spotify').info(…)        // the same calls, each line tagged with a category
//   LOG.pre(text)                     // a block kept as written: line breaks, spacing, monospace (#705)
//   LOG.mount(el, { tools })          // the viewer inside the script's own panel (#705)
//
// Categories (#697) are optional. A tagged line shows its category before the
// message and in the Markdown ("WARN [Spotify] …"). The viewer grows a row of
// filters only when there is a choice: the levels once two of them have lines
// (ok counts as info), the categories once there are two. Click one to see only
// those lines, click it again to see all; Copy always takes everything.
//
// The floating window (open) and a mounted viewer (mount) are the same viewer;
// mount draws it into an element of the script's, without the title bar's
// window buttons, and o.tools (an element) sits in its toolbar before Clear.
// Every viewer has a debug switch: off, LOG.debug() lines are not recorded at all
// (remembered per script under o.key; LOG.debugOn(), LOG.setDebug(v)).
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
// o.history           opt-in history of past sessions (#705), below
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// viewer appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
//
// History (#705, Falcon's run logs of #512 made shared). Off unless o.history is given:
//
//   o.history = { prefix: 'falcon:session:', lines: 400, head: 140,
//                 parse: s => entry, nameOf: entries => name, store }
//
// A session starts with the page, or with LOG.session(reason) (Falcon: each run).
// Only a session the script marks with LOG.keep() is stored, so a page that did
// nothing worth reading back leaves nothing behind; LOG.name(text) names it (the
// first name stays). It is stored in the page's localStorage under prefix + id,
// within 100 ms of each line and at once on LOG.flush(), so a crashed tab keeps
// its log; a session longer than `lines` keeps its first `head` lines and its
// end, and says how many went between. The newest 10 sessions are kept, not configurable
// (#811); each script's prefix is its own, and Clear history clears only that script's.
// Leaving the page (a script's reload after its operation, #811) flushes at once.
// prefix + 'current' holds the last kept session's id (LOG.last()), so LOG.resume(id)
// can carry on a session across a navigation. The viewer gets a session list and Clear history.
//   LOG.sessionId(); LOG.last(); LOG.isKept(); LOG.refresh(); LOG.sessions(); LOG.load(id); LOG.forget(id); LOG.clearHistory(); LOG.flush()
// parse reads a stored line that is a string (an older format); nameOf names a
// session stored without a name; store ({ get, set, del, keys }) replaces localStorage.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, views = [], bound = {};
    var LEVELS = ['error', 'warn', 'info', 'debug'];
    var group = function (sev) { return sev === 'ok' ? 'info' : sev; };
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3) : '--:--:--.---'; };
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
    // debug lines are recorded only while the viewer's debug switch is on (default off: majkinetor, #705), per script
    var dbgOn = null;
    var debugOn = function () { if (dbgOn === null) dbgOn = state().debug === true; return dbgOn; };
    var setDebug = function (v) { dbgOn = !!v; remember({ debug: dbgOn }); views.forEach(function (w) { if (w.dbg) w.dbg.checked = dbgOn; }); };
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + (e.cat ? '[' + e.cat + '] ' : '') + (e.pre ? '\n' : '') + e.msg; };
    var countOf = function (list) {
        var c = { warn: 0, error: 0 };
        list.forEach(function (e) { if (e.sev === 'warn') c.warn++; else if (e.sev === 'error') c.error++; });
        return c;
    };

    // ── history (#705) ──
    var H = o.history || null, hp = H && (H.prefix || ((o.key || 'mbu') + ':session:'));
    var ID_RE = /^\d{14}-\d+$/, sid = '', kept = false, sname = '', savedName = '', seq = 0, pTimer = 0, lastSaved = '';
    var store = H && (H.store || {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* full or blocked: the session just isn't kept */ } },
        del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
        // one call for all the keys: a userscript reaches localStorage through Firefox's
        // Xray wrapper, where each call costs, and the page may hold hundreds of keys
        keys: function () {
            try { var all = Object.keys(localStorage); if (all.length === localStorage.length) return all; } catch (e) { /* the loop below */ }
            var out = []; try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { /* none */ } return out;
        },
    });
    var keepN = function () { return 10; };   // #811: the last 10 sessions, not configurable
    var newId = function () { return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + (++seq); };
    // the id is the session's start in UTC: YYYYMMDDHHMMSS-n
    var idDate = function (id) {
        var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/.exec(id || '');
        return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
    };
    function ids() {
        if (!H) return [];
        return store.keys().filter(function (k) { return k && k.indexOf(hp) === 0 && ID_RE.test(k.slice(hp.length)); })
            .map(function (k) { return k.slice(hp.length); }).sort();   // the id's own timestamp sorts as a string
    }
    // a stored line: [time ms | null, sev, cat | 0, msg, pre 1/0]; a string is an older format, read by H.parse
    function fromStored(x, id) {
        if (typeof x === 'string') {
            var p = null;
            try { p = H.parse ? H.parse(x, idDate(id)) : null; } catch (e) { /* unreadable: kept as text */ }
            return p ? { t: p.t || null, sev: p.sev || 'info', cat: p.cat || '', msg: String(p.msg == null ? x : p.msg), pre: !!p.pre } : { t: null, sev: 'info', msg: x };
        }
        if (!Array.isArray(x)) return null;
        var e = { t: x[0] != null ? new Date(x[0]) : null, sev: x[1] || 'info', msg: String(x[3] == null ? '' : x[3]) };
        if (x[2]) e.cat = String(x[2]);
        if (x[4]) e.pre = true;
        return e;
    }
    function loadSession(id) {
        if (!H || !id) return null;
        var raw = store.get(hp + id);
        if (raw == null) return null;
        try { return (JSON.parse(raw) || []).map(function (x) { return fromStored(x, id); }).filter(Boolean); } catch (e) { return null; }
    }
    // a past session's name doesn't change, so it is read (or mined from its lines) once
    var names = {};
    function nameOf(id, entries) {
        if (id in names) return names[id];
        var n = store.get(hp + id + ':name');
        if (!n) { try { n = H.nameOf ? H.nameOf(entries || loadSession(id) || []) || '' : ''; } catch (e) { n = ''; } }
        return (names[id] = n || '');
    }
    // the first `head` lines and the end, and a line saying how many went between
    function storedWindow() {
        var cap = H.lines || 400, head = Math.min(H.head || 140, cap - 2);
        var pack = function (e) { return [e.t ? e.t.getTime() : null, e.sev, e.cat || 0, e.msg, e.pre ? 1 : 0]; };
        if (buf.length <= cap) return buf.map(pack);
        var tail = cap - head - 1, cut = buf.length - head - tail;
        return buf.slice(0, head).map(pack)
            .concat([[null, 'info', 0, '——— ' + cut + ' line(s) from the middle of this session were dropped to fit the stored-log budget; its start and end are kept in full ———', 0]])
            .concat(buf.slice(-tail).map(pack));
    }
    function flush() {
        clearTimeout(pTimer); pTimer = 0;
        if (!H || !sid || !kept) return;
        try {
            var payload = JSON.stringify(storedWindow());
            if (payload === lastSaved) return;
            lastSaved = payload;
            store.set(hp + sid, payload);
            if (sname && savedName !== sname) { store.set(hp + sid + ':name', sname); savedName = sname; }
        } catch (e) { /* not stored */ }
    }
    var persist = function () { if (H && kept && !pTimer) pTimer = setTimeout(flush, 100); };
    function forget(id) { if (H && id) { store.del(hp + id); store.del(hp + id + ':name'); delete names[id]; } }
    function prune() {
        var all = ids().filter(function (id) { return id !== sid; });
        var excess = all.length + (kept ? 1 : 0) - keepN();
        if (excess > 0) all.slice(0, excess).forEach(forget);
    }
    // past sessions, newest first, without the current one
    function sessions() {
        return ids().filter(function (id) { return id !== sid; }).reverse()
            .map(function (id) { return { id: id, date: idDate(id), name: nameOf(id) }; });
    }
    var sessionLabel = function (s) {
        var d = s.date, when = d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : s.id;
        return when + (s.name ? ' — ' + s.name : '');
    };
    function startSession() {
        flush();
        sid = newId(); kept = false; sname = ''; savedName = ''; lastSaved = '';
        reset();
    }
    function resume(id) {
        var entries = loadSession(id);
        if (!entries) return false;
        flush();
        reset();
        sid = id; kept = true; sname = savedName = store.get(hp + id + ':name') || '';
        lastSaved = store.get(hp + id) || '';
        store.set(hp + 'current', sid);
        entries.forEach(function (e) { push(e); });
        return true;
    }

    // ── the live lines ──
    function reset() {
        buf = []; dropped = 0; warn = 0; error = 0;
        views.forEach(function (v) { if (!v.past) v.show(null); v.sessions(); });
    }
    function push(e) {
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        views = views.filter(function (v) { return v.el.isConnected; });
        views.forEach(function (v) { if (!v.past) v.append(e); });
    }
    function add(sev, args, cat, pre) {
        var msg = Array.prototype.map.call(args, str).join(' ');
        msg = pre ? msg.replace(/\s+$/, '') : msg.replace(/\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        if (e.sev === 'debug' && !debugOn()) return;
        if (cat) e.cat = String(cat);
        if (pre) e.pre = true;
        push(e);
        persist();
    }
    function title(bare) {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = !bare && o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    // past: { id, entries } to copy a stored session instead of this one
    function markdown(past) {
        var list = past ? past.entries : buf, c = past ? countOf(list) : { warn: warn, error: error };
        var body = list.length ? list.map(line).join('\n') : '(no activity logged)';
        if (!past && dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
        var n = (c.warn || c.error) ? ' (' + c.warn + ' warning' + (c.warn === 1 ? '' : 's') + ', ' + c.error + ' error' + (c.error === 1 ? '' : 's') + ')' : '';
        var what = past ? 'log of ' + sessionLabel({ id: past.id, date: idDate(past.id), name: nameOf(past.id, list) }) : 'session log';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title(!!past) + ' — ' + what + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
    }
    function copy(btn, past) {
        var md = markdown(past);
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

    // ── a viewer: the floating window or one mounted in the script's panel ──
    var vseq = 0;
    function view(root, floating, tools) {
        var vid = String(++vseq);
        root.classList.add('mbu-logpop');
        root.dataset.mbuLv = vid;
        root.innerHTML = mbuHtml('<div class="mbu-logpop-h">' + (floating ? '<b>' + esc(o.header || 'Activity log') + '</b> ' : '') + '<span class="mbu-log-badge"></span>'
            + '<input class="mbu-log-q" type="search" placeholder="Filter" data-tip="Show only the lines with this text\nEsc: empty the box" autocomplete="off">'
            + (H ? '<select class="mbu-log-ses mbu-select" data-tip="The session shown\nThis one, or a past one kept in this browser"></select>' : '')
            + '<span class="mbu-logpop-sp"></span>'
            + (H ? '<button class="mbu-logpop-hclear" type="button" data-tip="Delete every past session\nThis one stays">Clear history</button>' : '')
            + '<label class="mbu-log-dbg" data-tip="Record each step in detail\nLeave it on when reporting a problem"><input type="checkbox"> debug</label>'
            + '<button class="mbu-logpop-clear" type="button" data-tip="Clear the log\nThe lines so far are gone">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" data-tip="Copy the whole log as Markdown\nReady to paste into a GitHub issue">⧉ Copy</button>'
            + (floating ? '<button class="mbu-logpop-full" type="button" data-tip="Full screen\nDouble-click: the title bar does the same">⛶</button>'
                + '<button class="mbu-logpop-min" type="button" data-tip="Minimize">–</button>'
                + '<button class="mbu-logpop-x" type="button" data-tip="Close">✕</button>' : '') + '</div>'
            + '<div class="mbu-log-f" hidden></div><style class="mbu-log-fcss"></style>'
            + '<div class="mbu-log-list"></div>' + (floating ? '<div class="mbu-logpop-grip" data-tip="Resize"></div>' : ''));
        if (tools) root.querySelector('.mbu-logpop-clear').before(tools);
        var list = root.querySelector('.mbu-log-list'), badge = root.querySelector('.mbu-log-badge');
        var qEl = root.querySelector('.mbu-log-q'), q = '', sel = root.querySelector('.mbu-log-ses');
        var fRow = root.querySelector('.mbu-log-f'), fCss = root.querySelector('.mbu-log-fcss');
        // what this viewer shows: the live lines, or a past session (read-only)
        var past = null, src = buf, cats = [], catIx = {}, sevs = {}, fSev = null, fCat = null;
        var scope = '.mbu-logpop[data-mbu-lv="' + vid + '"] ';
        var miss = function (e) { return !!q && ((e.cat || '') + ' ' + e.msg).toLowerCase().indexOf(q) < 0; };
        // note a line's level and category; true when the filter row must change
        var note = function (e) {
            var grew = false;
            if (e.cat && !(e.cat in catIx)) { catIx[e.cat] = cats.length; cats.push(e.cat); grew = true; }
            if (!sevs[group(e.sev)]) { sevs[group(e.sev)] = true; grew = true; }
            return grew;
        };
        var row = function (e) {
            var d = document.createElement('div');
            d._e = e;
            d.className = 'mbu-log-li mbu-log-' + e.sev + (e.pre ? ' mbu-log-pre' : '');
            if (miss(e)) d.classList.add('mbu-log-nq');
            d.dataset.s = group(e.sev);
            if (e.cat) d.dataset.c = catIx[e.cat];
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span>'
                + '<span class="mbu-log-c">' + esc(e.cat || '') + '</span>'
                + '<span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        // the filter row, redrawn when a level or category first appears; hiding is one
        // rule in the viewer's own <style>, not a walk over the rows
        var filters = function () {
            var lv = LEVELS.filter(function (l) { return sevs[l]; });
            var showL = lv.length > 1, showC = cats.length > 1;
            if (fSev && !sevs[fSev]) fSev = null;
            if (fCat != null && !(fCat in catIx)) fCat = null;
            var b = function (kind, v, on) {
                return '<button type="button" class="mbu-log-fb' + (on ? ' on' : '') + '" data-' + kind + '="' + esc(v) + '">' + esc(v) + '</button>';
            };
            fRow.innerHTML = mbuHtml((showL ? '<span class="mbu-log-fg">' + lv.map(function (l) { return b('sev', l, fSev === l); }).join('') + '</span>' : '')
                + (showL && showC ? '<span class="mbu-log-fs"></span>' : '')
                + (showC ? '<span class="mbu-log-fg">' + cats.map(function (c) { return b('cat', c, fCat === c); }).join('') + '</span>' : ''));
            fRow.hidden = !showL && !showC;
            list.classList.toggle('mbu-log-cats', cats.length > 0);
            fCss.textContent = (fSev ? scope + '.mbu-log-li:not([data-s="' + fSev + '"]){display:none}' : '')
                + (fCat != null ? scope + '.mbu-log-li:not([data-c="' + catIx[fCat] + '"]){display:none}' : '');
        };
        var showBadge = function () {
            var c = past ? countOf(src) : { warn: warn, error: error };
            badge.textContent = '(' + src.length + ')' + (c.warn || c.error ? ' · ' + c.warn + '⚠ ' + c.error + '✖' : '');
        };
        var empty = function () { return '<div class="mbu-log-empty">' + (past ? 'Nothing was kept of this session.' : 'No activity yet.') + '</div>'; };
        var queued = false, follow = true;
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        // all rows at once: on opening, and when the session shown changes
        var draw = function () {
            cats = []; catIx = {}; sevs = {};
            src.forEach(note);
            var frag = document.createDocumentFragment();
            src.forEach(function (e) { frag.appendChild(row(e)); });
            list.innerHTML = mbuHtml(src.length ? '' : empty());
            if (src.length) list.appendChild(frag);
            filters(); showBadge();
            follow = true; list.scrollTop = list.scrollHeight;
            root.classList.toggle('mbu-log-past', !!past);
        };
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var qTimer = 0;
        var refilter = function () {
            q = qEl.value.trim().toLowerCase();
            for (var d = list.firstElementChild; d; d = d.nextElementSibling) if (d._e) d.classList.toggle('mbu-log-nq', miss(d._e));
            follow = true; list.scrollTop = list.scrollHeight;
        };
        qEl.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(refilter, 120); });
        fRow.addEventListener('click', function (ev) {
            var t = ev.target.closest('.mbu-log-fb'); if (!t) return;
            if (t.dataset.sev) fSev = fSev === t.dataset.sev ? null : t.dataset.sev;
            else fCat = fCat === t.dataset.cat ? null : t.dataset.cat;
            filters();
            follow = true; list.scrollTop = list.scrollHeight;
        });
        var v = {
            el: root, floating: floating, past: null, q: qEl,
            append: function (e) {
                var em = list.querySelector('.mbu-log-empty'); if (em) em.remove();
                if (note(e)) filters();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            // null: the live lines; an id: that past session
            show: function (id) {
                var entries = id ? loadSession(id) : null;
                if (id && !entries) entries = [{ t: null, sev: 'warn', msg: 'This session could not be read (it may have been deleted in another tab).' }];
                past = id && entries ? id : null; v.past = past;
                src = past ? entries : buf;
                if (sel && sel.value !== (past || '')) sel.value = past || '';
                draw();
            },
            // the session list, refreshed when it is opened and when a session starts
            sessions: function () {
                if (!sel) return;
                var all = sessions(), sig = all.map(function (x) { return x.id + '=' + x.name; }).join('|');
                if (sig === v.sig && !(past && !all.some(function (x) { return x.id === past; }))) return;
                v.sig = sig;
                if (past && !all.some(function (s) { return s.id === past; })) { past = null; v.past = null; src = buf; draw(); }
                sel.innerHTML = mbuHtml('<option value="">Current session</option>' + all.map(function (s) {
                    return '<option value="' + esc(s.id) + '">' + esc(sessionLabel(s)) + '</option>';
                }).join(''));
                sel.value = past || '';
                var hc = root.querySelector('.mbu-logpop-hclear'); if (hc) hc.disabled = !all.length;
            },
            filters: filters,
        };
        if (sel) {
            sel.addEventListener('change', function () { v.show(sel.value || null); });
            root.querySelector('.mbu-logpop-hclear').onclick = function () { clearHistory(); };
        }
        root.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        v.dbg = root.querySelector('.mbu-log-dbg input');
        v.dbg.checked = debugOn();
        v.dbg.onchange = function () { setDebug(v.dbg.checked); };
        root.querySelector('.mbu-logpop-copy').onclick = function () {
            copy(root.querySelector('.mbu-logpop-copy'), past ? { id: past, entries: src } : null);
        };
        v.sessions();
        draw();
        views.push(v);
        return v;
    }

    var win = null;
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop';
        document.body.appendChild(pop);
        var v = view(pop, true);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        // Escape in a filled filter empties it; anywhere else it closes the window. Only the log:
        // it listens first (capture, on window) and keeps the key, so the script's own window under
        // it (ISRC Scout's closes on Escape too) stays open
        var onKey = function (e) {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            if (e.target === v.q && v.q.value) { v.q.value = ''; v.q.dispatchEvent(new Event('input')); return; }
            close();
        };
        win = { el: pop, v: v, off: function () { window.removeEventListener('keydown', onKey, true); } };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.dataset.tip = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        var fullBtn = pop.querySelector('.mbu-logpop-full');
        var setFull = function (f) {
            pop.classList.toggle('full', f);
            fullBtn.textContent = f ? '❐' : '⛶'; fullBtn.dataset.tip = (f ? 'Restore the size' : 'Full screen') + '\nDouble-click: the title bar does the same';
        };
        minBtn.onclick = function () {
            var m = pop.classList.toggle('min');
            if (m && pop.classList.contains('full')) { setFull(false); remember({ full: false }); }   // minimising leaves full screen
            setMin(m); remember({ min: m });
        };
        fullBtn.onclick = function () { var f = !pop.classList.contains('full'); setFull(f); remember({ full: f }); };
        pop.querySelector('.mbu-logpop-h').addEventListener('dblclick', function (e) {
            if (!e.target.closest('button, input, select') && !pop.classList.contains('min')) fullBtn.click();
        });
        // a size the user gave it, from the corner grip
        if (st.w && st.h) { pop.style.width = st.w; pop.style.height = st.h; pop.classList.add('sized'); }
        if (st.min) { pop.classList.add('min'); setMin(true); }
        else if (st.full) setFull(true);
        pop.querySelector('.mbu-logpop-grip').addEventListener('mousedown', function (e) {
            e.preventDefault(); e.stopPropagation();
            var r = pop.getBoundingClientRect();
            // pin the top-left corner, so only the right and bottom edges move
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.bottom = ''; pop.style.transform = 'none';
            pop.classList.add('sized');
            var x0 = e.clientX, y0 = e.clientY;
            var mv = function (ev) {
                pop.style.width = Math.max(320, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + 'px';
                pop.style.height = Math.max(120, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                remember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button, input, select') || pop.classList.contains('full')) return;
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
        window.addEventListener('keydown', onKey, true);
        return pop;
    }
    // the viewer inside an element of the script's; a second mount there replaces the first
    function mount(host, opts) {
        if (!host) return null;
        views = views.filter(function (v) { if (v.el.parentNode === host) { v.el.remove(); return false; } return true; });
        var el = document.createElement('div'); el.className = 'mbu-logemb';
        host.appendChild(el);
        return view(el, false, opts && opts.tools).el;
    }
    // empty the live log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (H && sid) { store.del(hp + sid); lastSaved = ''; }
        views.forEach(function (v) { if (!v.past) v.show(null); });
    }
    function clearHistory() {
        if (!H) return;
        ids().forEach(function (id) { if (id !== sid) forget(id); });
        views.forEach(function (v) { v.sessions(); });
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) {
            win.off(); win.el.remove();
            views = views.filter(function (v) { return v !== win.v; });
            win = null; if (!quiet) remember({ open: false });
        }
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
        // the debug switch: are debug lines recorded?
        debugOn: function () { return debugOn(); },
        setDebug: setDebug,
        pre: function () { add('info', arguments, null, true); },
        // a logger whose lines carry this category; the same object for the same name
        cat: function (name) {
            if (!name) return api;
            if (!bound[name]) bound[name] = {
                info: function () { add('info', arguments, name); },
                warn: function () { add('warn', arguments, name); },
                err: function () { add('error', arguments, name); },
                error: function () { add('error', arguments, name); },
                ok: function () { add('ok', arguments, name); },
                debug: function () { add('debug', arguments, name); },
                add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1), name); },
                pre: function () { add('info', arguments, name, true); },
            };
            return bound[name];
        },
        open: open,
        mount: mount,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: function () { return markdown(); },
        copy: function (btn) { copy(btn); },
        clear: clear,
        lines: function () { return buf.map(line); },
        entries: function () { return buf.slice(); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
        // history (#705); harmless without o.history
        session: function () { if (H) startSession(); return sid; },
        resume: function (id) { return H ? resume(id) : false; },
        keep: function () { if (H && sid && !kept) { kept = true; store.set(hp + 'current', sid); flush(); prune(); views.forEach(function (v) { v.sessions(); }); } },
        name: function (text) { if (H && text && !sname) { sname = String(text); if (kept) store.set(hp + sid + ':name', sname); } },
        sessionId: function () { return sid; },
        last: function () { return H ? store.get(hp + 'current') : null; },
        isKept: function () { return kept; },
        sessions: function () { return H ? sessions() : []; },
        load: function (id) { return loadSession(id); },
        forget: function (id) { forget(id); views.forEach(function (v) { v.sessions(); }); },
        clearHistory: clearHistory,
        // redraw the session lists (a script showing its mounted viewer again); only a changed list is redrawn
        refresh: function () { views.forEach(function (v) { v.sessions(); }); },
        flush: flush,
    };
    if (H) {
        sid = newId();
        // #811: a script reloads the page right after its operation; write the kept session
        // now rather than trusting the 100 ms timer to beat the unload
        try { window.addEventListener('pagehide', flush); } catch (e) { /* no window */ }
    }
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
    if (!_mbuNs.MBU.tip) _mbuNs.MBU.tip = mbuTip;
} catch (e) { /* a locked-down page must not stop the script loading */ }

// Tooltips: our own, never the browser's title (dev/ui/tooltip.mjs, STANDARDS → Standard 14).
function mbuTipV() { return 13; }
function mbuTipCssText() { return "#mbu-tip{position:fixed;left:0;top:0;z-index:var(--mbu-z-tip,2147483647);box-sizing:border-box;max-width:min(330px,calc(100vw - 16px));padding:7px 11px 8px;background:var(--mbu-bg,#fff);color:var(--mbu-text,#222);border:1px solid var(--mbu-border,#cfc6e6);border-radius:9px;box-shadow:0 6px 24px rgba(40,20,80,.2),0 1px 3px rgba(40,20,80,.12);font:12.5px/1.45 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);text-align:left;white-space:normal;overflow-wrap:break-word;letter-spacing:normal;text-transform:none;pointer-events:none;visibility:hidden;opacity:0;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}#mbu-tip.mbu-tip-up{transform:translateY(3px)}#mbu-tip.mbu-tip-on{visibility:visible;opacity:1;transform:none;transition:opacity .12s ease,transform .12s ease}#mbu-tip.mbu-tip-act.mbu-tip-on{pointer-events:auto}#mbu-tip.mbu-tip-wide{max-width:min(460px,calc(100vw - 16px))}#mbu-tip:has(.mbu-tip-dl){max-width:min(480px,calc(100vw - 16px))}#mbu-tip::before{content:\"\";position:absolute;left:calc(var(--mbu-tip-ax,50%) - 5px);top:-5px;width:8px;height:8px;background:inherit;border:1px solid var(--mbu-border,#cfc6e6);border-right:0;border-bottom:0;transform:rotate(45deg)}#mbu-tip.mbu-tip-up::before{top:auto;bottom:-5px;border:1px solid var(--mbu-border,#cfc6e6);border-left:0;border-top:0}#mbu-tip.mbu-tip-card:not(.mbu-tip-up)::before{background:var(--mbu-bg-raised,#faf9fe)}#mbu-tip .mbu-tip-lead{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-p{margin:0;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-lead+*,#mbu-tip .mbu-tip-p+*,#mbu-tip .mbu-tip-ul+*,#mbu-tip .mbu-tip-rows+*{margin-top:5px}#mbu-tip>.mbu-tip-p:first-child:last-child{color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-warn{color:var(--mbu-warn,#a05a00)}#mbu-tip .mbu-tip-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:start;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-rows>.mbu-tip-kk,#mbu-tip .mbu-tip-rows>.mbu-tip-dl{min-height:18px}#mbu-tip .mbu-tip-rows>.mbu-tip-k{line-height:18px}#mbu-tip .mbu-tip-rows>:nth-child(odd){justify-self:start}#mbu-tip .mbu-tip-rows>.mbu-tip-span{grid-column:2;justify-self:stretch;margin:-2px 0 0}#mbu-tip .mbu-tip-k{display:inline-block;padding:0;border:0;background:none;color:var(--mbu-text-weak,#888);font:600 11.5px/1.5 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-kk{display:inline-flex;align-items:center;gap:3px;color:var(--mbu-accent-text,#5f3ec0);white-space:nowrap}#mbu-tip .mbu-tip-dl{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--mbu-text,#222);white-space:nowrap}#mbu-tip .mbu-tip-dl i{flex:none;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}#mbu-tip .mbu-tip-on{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip .mbu-tip-dl.mbu-tip-on::after{content:\"◂\";margin-left:-2px;font-size:11px}#mbu-tip .mbu-tip-off{opacity:.45}#mbu-tip .mbu-tip-sym{letter-spacing:.2px}#mbu-tip .mbu-tip-mouse{display:block;flex:none;position:relative}#mbu-tip .mbu-tip-mouse rect[fill=none],#mbu-tip .mbu-tip-mouse path[stroke]{stroke:var(--mbu-text-weak,#888);stroke-width:1}#mbu-tip .mbu-tip-kx{font:600 10px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}#mbu-tip .mbu-tip-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}#mbu-tip .mbu-tip-o{display:inline-block;padding:0 7px;border-radius:999px;background:var(--mbu-accent-soft,#ece4ff);color:var(--mbu-accent-text,#5f3ec0);font:600 11px/1.6 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-ul{margin:0;padding:0 0 0 15px;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-ul li{margin:1px 0;padding:0}#mbu-tip code{font:11.5px var(--mbu-font-mono,ui-monospace,Consolas,monospace);padding:0 4px;border-radius:4px;background:var(--mbu-bg-sunken,#f4f2f9)}#mbu-tip b{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip a{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip.mbu-tip-card{padding:0;width:380px;max-width:min(380px,calc(100vw - 16px));overflow:visible}#mbu-tip .mbu-tip-ch{display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid var(--mbu-border-soft,#e2dcef);background:var(--mbu-bg-raised,#faf9fe);border-radius:9px 9px 0 0}#mbu-tip .mbu-tip-ca{margin-left:auto;font-size:11px;color:var(--mbu-text-weak,#999);white-space:nowrap}#mbu-tip .mbu-tip-cb{padding:8px 11px;display:flex;flex-direction:column;gap:6px}#mbu-tip .mbu-tip-cf{display:flex;gap:10px;padding:6px 11px;border-top:1px solid var(--mbu-border-soft,#e2dcef);font-size:11px;color:var(--mbu-text-weak,#999)}#mbu-tip .mbu-tip-cf>:last-child:not(:first-child){margin-left:auto}@media (prefers-reduced-motion:reduce){#mbu-tip,#mbu-tip.mbu-tip-on{transition:none;transform:none}}"; }
function mbuTipRoots() { return ".mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu"; }
function mbuTipEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}
function mbuTipLabel(line) {
    var m = /^([^\s:.,;!?()][^:.,;!?()]{0,40}?): (\S[\s\S]*)$/.exec(line);
    if (!m || m[1].split(/\s+/).length > 3 || /https?$/i.test(m[1])) return null;
    return { label: m[1], text: m[2], key: mbuTipIsKey(m[1]) };
}
function mbuTipIsKey(label) {
    return /click|drag|wheel|scroll|hover|double|press|paste|\bkey\b|^(esc|escape|enter|return|tab|space|ctrl|shift|alt|cmd|meta|del|delete|backspace|f\d{1,2})\b|\+|^[↑↓←→]/i.test(label);
}
function mbuTipInline(s) {
    return mbuTipEsc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\(((?:(?:Ctrl|Alt|Shift|Cmd|Meta)\+)+[^\s()]+)\)/g, function (m, k) { return mbuTipKbd(k); })
        .replace(/\s\((Esc|Enter|Space|Tab|[A-Z0-9]|[↑↓←→])\)(?=$|[\s.,;])/g, ' <kbd class="mbu-tip-k">$1</kbd>');
}
function mbuTipCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function mbuTipMod(k) { return { ctrl: 'C', alt: 'A', shift: '⇧', cmd: '⌘', meta: '⌘' }[String(k).toLowerCase()] || k; }
function mbuTipKbd(combo) {
    var parts = String(combo).split(/\s*\+\s*/);
    var key = parts.pop();
    return '<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">' + mbuTipEsc(combo) + '</span><span aria-hidden="true">'
        + parts.concat('').map(mbuTipMod).join('+') + mbuTipEsc(key.length === 1 ? key.toUpperCase() : mbuTipCap(key)) + '</span></kbd>';
}
function mbuTipKey(label) {
    // two ways to do the same, "Middle-click / Alt+click": each drawn, a grey slash between
    var alts = String(label).split(/\s+\/\s+/);
    if (alts.length > 1) return '<span class="mbu-tip-kk">' + alts.map(mbuTipKey).join('<span class="mbu-tip-kx">/</span>') + '</span>';
    // two mouse actions at once, "Right-click + wheel": each drawn, a grey plus between
    var both = /^(.*?(?:click|drag|wheel|scroll))\s+\+\s+(.+)$/i.exec(String(label).trim());
    if (both) return '<span class="mbu-tip-kk">' + mbuTipKey(both[1]) + '<span class="mbu-tip-kx">+</span>' + mbuTipKey(both[2]) + '</span>';
    var m = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*)(left|right|middle|double)?[- ]?(click|drag|wheel|scroll)$/i.exec(String(label).trim());
    if (!m) return /^(?:(?:ctrl|alt|shift|cmd|meta)\s*\+\s*)+\S/i.test(label) ? mbuTipKbd(label) : '<span class="mbu-tip-k">' + mbuTipEsc(mbuTipCap(label)) + '</span>';
    var mods = m[1] ? m[1].split(/\s*[+-]\s*/).filter(Boolean) : [];
    var btn = (m[2] || '').toLowerCase(), act = m[3].toLowerCase();
    var wheel = btn === 'middle' || act === 'wheel' || act === 'scroll';
    // the wheel a filled strip down the middle, as bold as a filled button (a thin wheel vanished at 10px)
    var fill = wheel ? 'M4 1.4h4V7H4z' : btn === 'right' ? 'M6 1C8.8 1 11 3.2 11 6v1H6z' : 'M6 1C3.2 1 1 3.2 1 6v1h5z';
    var svg = '<svg class="mbu-tip-mouse" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">'
        + '<path d="' + fill + '" fill="currentColor"/>'
        + '<rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/>'
        + '<path d="M1 7h10' + (wheel ? '' : 'M6 1v6') + '" stroke="currentColor" stroke-width="1.1"/>'        + '</svg>';
    var extra = btn === 'double' ? '×2' : act === 'drag' ? 'drag' : (act === 'wheel' || act === 'scroll') ? '↕' : '';
    return '<span class="mbu-tip-kk"><span class="mbu-tip-sr">' + mbuTipEsc(mbuTipCap(label)) + '</span>'
        + (mods.length ? '<kbd class="mbu-tip-k mbu-tip-sym" aria-hidden="true">' + mods.map(mbuTipMod).join('+') + '</kbd>' : '')
        + svg + (extra ? '<span class="mbu-tip-kx" aria-hidden="true">' + extra + '</span>' : '') + '</span>';
}
function mbuTipText(src) {
    var raw = String(src == null ? '' : src).replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
    if (!raw) return '';
    var lines = [];
    // the shapes the old title texts took, read as the rows they mean:
    //   "… — click to open it"              → "…" + "Click: open it"
    //   "… (right-click: guess case all)"   → "…" + "Right-click: guess case all"
    //   "Ctrl-click", "Alt-click"           → "Ctrl+click", "Alt+click"
    raw = raw.replace(/\b(Ctrl|Alt|Shift|Cmd)-(click|drag)/gi, '$1+$2')
        .replace(/\s*\(((?:(?:right|middle|double|ctrl|alt|shift|cmd)[-+ ]?)+click|(?:ctrl|alt|shift|cmd)\+\w+):\s*([^()\n]+)\)(?=\s*(?:$|\n))/gim, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/\s+[—–-]\s+((?:(?:right|middle|double|ctrl|alt|shift)[-+ ]?)?click) to ([^\n·]+)/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/[.;]\s+((?:right|middle|double|ctrl|alt|shift)[-+ ]?click|click) to ([^\n·.]+)\.?(?=\s*(?:$|\n))/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; });
    raw.split('\n').forEach(function (line) {
        line = line.replace(/\s+$/, '');
        // ' · Label: ' starts a new line; so does '. Label: ' once the line itself opened with a label
        var parts = line.split(/\s+·\s+/), out = [parts[0]];
        for (var i = 1; i < parts.length; i++) {
            if (mbuTipLabel(parts[i])) out.push(parts[i]); else out[out.length - 1] += ' · ' + parts[i];
        }
        out.forEach(function (seg) {
            if (!mbuTipLabel(seg)) { lines.push(seg); return; }
            var bits = seg.split(/(?<=\.)\s+(?=[A-Z][\w+-]*(?:\s[\w+-]+)?:\s)/);
            bits.forEach(function (b) { lines.push(b); });
        });
    });
    // blocks: lead / paragraph / rows / bullets
    var blocks = [], rowRun = [];
    var flushRows = function () {
        if (!rowRun.length) return;
        var keyed = rowRun.filter(function (r) { return r.key; }).length;
        if (rowRun.length >= 2 || keyed) blocks.push({ t: 'rows', rows: rowRun });
        else blocks.push({ t: 'p', s: rowRun[0].line });
        rowRun = [];
    };
    lines.forEach(function (line, n) {
        if (!line.trim()) { flushRows(); return; }
        var b = /^\s*[-•]\s+(.*)$/.exec(line);
        if (b) {
            flushRows();
            var last = blocks[blocks.length - 1];
            if (last && last.t === 'ul') last.items.push(b[1]); else blocks.push({ t: 'ul', items: [b[1]] });
            return;
        }
        // a level row, "{#2f6fd6} Exact: …": a dot in the colour before the label; "{#… on}" marks the
        // chosen level, "{#… off}" dims one past it (a cutoff's table)
        var lv = /^\{(#[0-9a-f]{3,8})(?: (on|off))?\}\s*(\S[\s\S]*)$/i.exec(line);
        if (lv) {
            var ll = mbuTipLabel(lv[3]) || { label: lv[3], text: '' };
            rowRun.push({ label: ll.label, text: ll.text, dot: lv[1], st: lv[2] ? lv[2].toLowerCase() : '', line: line });
            return;
        }
        var l = mbuTipLabel(line);
        // the first line is a row only as a key or when a label follows: alone, "Release group: when…" is a sentence
        if (l && (l.key || blocks.length || rowRun.length || (lines[n + 1] && mbuTipLabel(lines[n + 1])))) { l.line = line; rowRun.push(l); return; }
        flushRows();
        blocks.push({ t: 'p', s: line });
    });
    flushRows();
    // one long paragraph: its first sentence becomes the lead
    if (blocks.length === 1 && blocks[0].t === 'p' && blocks[0].s.length > 110) {
        var m = /^(.{12,110}?[.!?])\s+(?=[A-Z(“"'])([\s\S]+)$/.exec(blocks[0].s);
        if (m) blocks = [{ t: 'p', s: m[1].replace(/\.$/, '') }, { t: 'p', s: m[2] }];
    }
    var lead = blocks.length > 1 && blocks[0].t === 'p';
    var rowsHtml = function (bl) {
        return bl.rows.map(function (r) {
            if (r.dot) {
                var c = r.st ? ' mbu-tip-' + r.st : '';
                return '<span class="mbu-tip-dl' + c + '"><i style="background:' + r.dot + '"></i>' + mbuTipEsc(mbuTipCap(r.label)) + '</span>'
                    + '<span class="mbu-tip-dt' + c + '">' + mbuTipInline(r.text) + '</span>';
            }
            return (r.key ? mbuTipKey(r.label) : '<span class="mbu-tip-o">' + mbuTipEsc(mbuTipCap(r.label)) + '</span>') + '<span>' + mbuTipInline(r.text) + '</span>';
        }).join('');
    };
    var html = function (bl, i, span) {
        var sp = span ? ' mbu-tip-span' : '';
        if (bl.t === 'ul') return '<ul class="mbu-tip-ul' + sp + '">' + bl.items.map(function (x) { return '<li>' + mbuTipInline(x) + '</li>'; }).join('') + '</ul>';
        if (bl.t === 'rows') return span ? rowsHtml(bl) : '<div class="mbu-tip-rows">' + rowsHtml(bl) + '</div>';
        var warn = /^⚠/.test(bl.s);
        return '<div class="' + (lead && i === 0 ? 'mbu-tip-lead' : 'mbu-tip-p') + (warn ? ' mbu-tip-warn' : '') + sp + '">' + mbuTipInline(bl.s) + '</div>';
    };
    // rows with a note between them stay one grid, the note under the row before it, so their labels line up
    var first = -1, last = -1;
    blocks.forEach(function (bl, i) { if (bl.t === 'rows') { if (first < 0) first = i; last = i; } });
    var out = '';
    for (var i = 0; i < blocks.length; i++) {
        if (i === first && last > first) {
            out += '<div class="mbu-tip-rows">';
            for (; i <= last; i++) out += html(blocks[i], i, true);
            out += '</div>';
            i = last;
        } else out += html(blocks[i], i, false);
    }
    return out;
}
function mbuTipCard(o) {
    o = o || {};
    var h = '';
    if (o.head || o.title || o.aside) {
        h += '<div class="mbu-tip-ch">' + (o.head || '') + (o.title ? '<b>' + mbuTipEsc(o.title) + '</b>' : '')
            + (o.aside ? '<span class="mbu-tip-ca">' + mbuTipEsc(o.aside) + '</span>' : '') + '</div>';
    }
    if (o.body) h += '<div class="mbu-tip-cb">' + o.body + '</div>';
    if (o.foot || o.footAside) h += '<div class="mbu-tip-cf"><span>' + (o.foot || '') + '</span>' + (o.footAside ? '<span>' + o.footAside + '</span>' : '') + '</div>';
    return h;
}
function mbuTipS() {
    return mbuTipS.s || (mbuTipS.s = {
        me: Math.random().toString(36).slice(2, 10), lead: false, els: typeof WeakMap === 'function' ? new WeakMap() : null, prov: [],
        cur: null, curOpts: null, pend: null, showT: 0, hideT: 0, liveT: 0, warm: 0, quiet: null, tab: false, mx: -1, my: -1, obs: null,
    });
}
function mbuTip(el, content, opts) {
    if (!el) return el;
    var _mbuTip = mbuTipS();
    mbuTipStart();
    opts = opts || {};
    if (typeof content === 'function') {
        if (_mbuTip.els) _mbuTip.els.set(el, { fn: content, opts: opts });
        el.setAttribute('data-mbu-tip-own', '');
        el.removeAttribute('title');
        return el;
    }
    if (content == null || content === '') el.removeAttribute('data-tip'); else el.setAttribute('data-tip', String(content));
    if (opts.place) el.setAttribute('data-tip-place', opts.place);
    if (opts.wide) el.setAttribute('data-tip-wide', '');
    el.removeAttribute('title');
    if (_mbuTip.cur === el) mbuTipRender();
    return el;
}
function mbuTipOn(selector, fn, opts) {
    mbuTipS().prov.push({ sel: selector, fn: fn, opts: opts || {} });
    mbuTipStart();
}
function mbuTipShowFor(el, content, opts) {
    if (!el || content == null || content === '') { mbuTipHide(true); return; }
    mbuTipStart();
    var o = opts || {};
    var fn = typeof content === 'function' ? content : function () { return content; };
    var S = mbuTipS();
    if (S.cur === el) { S.curOpts.fn = fn; if (!mbuTipRender()) mbuTipHide(true); return; }
    mbuTipShow({ el: el, fn: fn, opts: o });
}
function mbuTipHtml(s) {
    if (mbuTipHtml.tt === undefined) {
        mbuTipHtml.tt = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) mbuTipHtml.tt = tt.createPolicy('mbu-tip-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings */ }
    }
    return mbuTipHtml.tt ? mbuTipHtml.tt.createHTML(String(s)) : String(s);
}
function mbuTipCss() {
    var s = document.getElementById('mbu-tip-css');
    if (s && +s.getAttribute('data-v') >= mbuTipV()) return;
    if (!s) { s = document.createElement('style'); s.id = 'mbu-tip-css'; (document.head || document.documentElement).appendChild(s); }
    s.setAttribute('data-v', String(mbuTipV()));
    s.textContent = mbuTipCssText();
}
function mbuTipEl() {
    var t = document.getElementById('mbu-tip');
    if (!t) {
        t = document.createElement('div');
        t.id = 'mbu-tip';
        t.setAttribute('role', 'tooltip');
        (document.body || document.documentElement).appendChild(t);
    }
    // Falcon's panel, Group Therapy's menus and others sit at the top z-index too; at an equal one
    // the later element is drawn over, so the tip moves to the end of the page when it is not there
    // (majkinetor, with a screenshot: Falcon's panel over a tip)
    var host = t.parentNode;
    if (host && host.lastElementChild !== t) host.appendChild(t);
    return t;
}
function mbuTipFind(node) {
    var _mbuTip = mbuTipS();
    var tip = document.getElementById('mbu-tip');
    for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        if (el === tip) return null;
        var reg = _mbuTip.els && _mbuTip.els.get(el);
        if (reg) return { el: el, fn: reg.fn, opts: reg.opts };
        for (var i = 0; i < _mbuTip.prov.length; i++) {
            var p = _mbuTip.prov[i];
            try { if (el.matches(p.sel)) return { el: el, fn: p.fn, opts: p.opts }; } catch (e) { /* a bad selector matches nothing */ }
        }
        if (!_mbuTip.lead) continue;
        if (el.hasAttribute('data-mbu-tip-own')) return null;   // another copy's rich tip
        if (el.hasAttribute('data-tip')) return { el: el, opts: { place: el.getAttribute('data-tip-place'), wide: el.hasAttribute('data-tip-wide') } };
        // an <option> keeps its title: the browser draws a dropdown's list, where no page tooltip reaches
        if (el.hasAttribute('title') && el.getAttribute('title') && el.namespaceURI === 'http://www.w3.org/1999/xhtml' && !/^(OPTION|OPTGROUP)$/.test(el.tagName)) {
            var root = null;
            try { root = el.closest(mbuTipRoots()); } catch (e) { /* no roots */ }
            if (root) {
                el.setAttribute('data-tip', el.getAttribute('title'));
                el.removeAttribute('title');
                return { el: el, opts: {} };
            }
        }
    }
    return null;
}
function mbuTipRender() {
    var _mbuTip = mbuTipS();
    var a = _mbuTip.cur, o = _mbuTip.curOpts || {}, t = mbuTipEl(), c;
    if (!a) return false;
    if (o.fn) {
        try { c = o.fn(a); } catch (e) { c = null; }
        if (c == null || c === '') return false;
        if (typeof c === 'string') t.innerHTML = mbuTipHtml(c);
        else { t.textContent = ''; t.appendChild(c); }
    } else {
        var s = a.getAttribute('data-tip');
        if (!s) return false;
        var h = mbuTipText(s);
        t.innerHTML = mbuTipHtml(h);
        // an element with nothing to read of its own is named by its tip
        if (!a.getAttribute('aria-label') && !/[\p{L}\p{N}]/u.test(a.textContent || '') && !a.querySelector('img[alt]:not([alt=""])')) {
            a.setAttribute('aria-label', s.split('\n')[0]);
        }
    }
    t.className = 'mbu-ui' + (o.card ? ' mbu-tip-card' : '') + (o.interactive ? ' mbu-tip-act' : '') + (o.wide ? ' mbu-tip-wide' : '');
    t.setAttribute('data-owner', _mbuTip.me);
    mbuTipPlace(t, a, o.place);
    return true;
}
function mbuTipPlace(t, a, place) {
    var _mbuTip = mbuTipS();
    var r = a.getBoundingClientRect();
    if (!r.width && !r.height && a.firstElementChild) r = a.firstElementChild.getBoundingClientRect();
    t.style.left = '0px'; t.style.top = '0px';
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, gap = 8, m = 6;
    var below = place !== 'above';
    if (below && r.bottom + gap + h > vh - m && r.top - gap - h >= m) below = false;
    else if (!below && r.top - gap - h < m && r.bottom + gap + h <= vh - m) below = true;
    var top = below ? r.bottom + gap : r.top - gap - h;
    // a wide element (a row, a long field): the arrow points where the pointer is
    var cx = r.left + r.width / 2;
    if (r.width > 220 && _mbuTip.mx >= r.left && _mbuTip.mx <= r.right) cx = _mbuTip.mx;
    var left = Math.max(m, Math.min(vw - w - m, Math.round(cx - w / 2)));
    t.style.left = left + 'px';
    t.style.top = Math.max(m, Math.round(top)) + 'px';
    t.style.setProperty('--mbu-tip-ax', Math.max(12, Math.min(w - 12, Math.round(cx - left))) + 'px');
    t.classList.toggle('mbu-tip-up', !below);
}
function mbuTipShow(found) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.hideT); clearTimeout(_mbuTip.showT);
    if (_mbuTip.cur && _mbuTip.cur !== found.el) mbuTipHide(true);
    mbuTipCss();
    _mbuTip.cur = found.el;
    _mbuTip.curOpts = { fn: found.fn, interactive: !!found.opts.interactive, card: !!found.opts.card, wide: !!found.opts.wide, place: found.opts.place };
    if (!mbuTipRender()) { _mbuTip.cur = null; return; }
    var t = mbuTipEl();
    found.el.setAttribute('aria-describedby', 'mbu-tip');
    // next frame, so the transition runs from the hidden state
    requestAnimationFrame(function () { if (_mbuTip.cur === found.el) t.classList.add('mbu-tip-on'); });
    // the element can go (a re-render) or change its text while the tip is up
    clearInterval(_mbuTip.liveT);
    _mbuTip.liveT = setInterval(function () { if (!_mbuTip.cur || !_mbuTip.cur.isConnected) mbuTipHide(true); }, 300);
    try {
        if (!_mbuTip.obs) _mbuTip.obs = new MutationObserver(function () { if (_mbuTip.cur && !mbuTipRender()) mbuTipHide(true); });
        _mbuTip.obs.disconnect();
        if (!found.fn) _mbuTip.obs.observe(found.el, { attributes: true, attributeFilter: ['data-tip'] });
    } catch (e) { /* no observer: the text is read again on the next hover */ }
}
function mbuTipHide(now) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.showT); clearTimeout(_mbuTip.hideT);
    _mbuTip.pend = null;
    var hide = function () {
        var a = _mbuTip.cur;
        if (!a) return;
        _mbuTip.cur = null;
        clearInterval(_mbuTip.liveT);
        try { if (_mbuTip.obs) _mbuTip.obs.disconnect(); } catch (e) { /* gone */ }
        if (a.getAttribute('aria-describedby') === 'mbu-tip') a.removeAttribute('aria-describedby');
        var t = document.getElementById('mbu-tip');
        if (t && t.getAttribute('data-owner') === _mbuTip.me) t.classList.remove('mbu-tip-on');
        _mbuTip.warm = Date.now();
    };
    if (now) hide();
    else _mbuTip.hideT = setTimeout(hide, _mbuTip.curOpts && _mbuTip.curOpts.interactive ? 220 : 70);
}
function mbuTipStart() {
    if (mbuTipStart.done || typeof document === 'undefined') return;
    var _mbuTip = mbuTipS();
    var root = document.documentElement;
    if (!root) { document.addEventListener('DOMContentLoaded', mbuTipStart, { once: true }); return; }
    mbuTipStart.done = true;
    if (!root.hasAttribute('data-mbu-tip')) { root.setAttribute('data-mbu-tip', _mbuTip.me); _mbuTip.lead = true; }
    var inTip = function (n) { var t = document.getElementById('mbu-tip'); return !!(t && n && t.contains(n)); };
    window.addEventListener('mousemove', function (e) { _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; }, { passive: true, capture: true });
    window.addEventListener('mouseover', function (e) {
        _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; _mbuTip.over = e.target;   // :hover can read false in a page that has not seen a real move
        if (inTip(e.target)) { if (_mbuTip.cur) clearTimeout(_mbuTip.hideT); return; }
        var f = mbuTipFind(e.target);
        if (!f) { if (_mbuTip.cur && !_mbuTip.cur.contains(e.target)) mbuTipHide(); return; }
        if (f.el === _mbuTip.cur) { clearTimeout(_mbuTip.hideT); return; }
        if (f.el === _mbuTip.quiet || (_mbuTip.pend && _mbuTip.pend.el === f.el)) return;
        clearTimeout(_mbuTip.showT);
        _mbuTip.pend = f;
        var warm = _mbuTip.cur || Date.now() - _mbuTip.warm < 450;
        _mbuTip.showT = setTimeout(function () {
            _mbuTip.pend = null;
            if (f.el.isConnected && f.el.contains(_mbuTip.over)) mbuTipShow(f);
        }, warm ? 40 : (f.opts.delay != null ? f.opts.delay : 350));
    }, true);
    window.addEventListener('mouseout', function (e) {
        var to = e.relatedTarget;
        var q = _mbuTip.quiet;
        if (q && q.contains(e.target) && !(to && q.contains(to))) _mbuTip.quiet = null;
        var p = _mbuTip.pend;
        if (p && p.el.contains(e.target) && !(to && p.el.contains(to))) { clearTimeout(_mbuTip.showT); _mbuTip.pend = null; }
        var a = _mbuTip.cur;
        if (!a) return;
        if (to && (a.contains(to) || (_mbuTip.curOpts.interactive && inTip(to)))) return;
        if (a.contains(e.target) || inTip(e.target)) mbuTipHide();
    }, true);
    window.addEventListener('mousedown', function (e) {
        if (inTip(e.target)) return;
        clearTimeout(_mbuTip.showT); _mbuTip.pend = null;
        var f = mbuTipFind(e.target);
        _mbuTip.quiet = f ? f.el : null;   // no tip again on the element just clicked until the pointer leaves it
        _mbuTip.tab = false;
        if (_mbuTip.cur) mbuTipHide(true);
    }, true);
    document.addEventListener('keydown', function (e) {
        if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) _mbuTip.tab = e.key === 'Tab';
        if (!_mbuTip.cur) return;
        var interactive = _mbuTip.curOpts && _mbuTip.curOpts.interactive;
        // typing closes a plain tip, as it does the browser's; modifiers alone don't
        if (e.key !== 'Escape') { if (!interactive && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) mbuTipHide(true); return; }
        mbuTipHide(true);
        if (interactive) e.stopPropagation();   // a card is a popover: Esc closes it and nothing else
    }, true);
    window.addEventListener('scroll', function (e) { if (_mbuTip.cur && !inTip(e.target)) mbuTipHide(true); }, true);
    window.addEventListener('blur', function () { if (_mbuTip.cur) mbuTipHide(true); });
    document.addEventListener('focusin', function (e) {
        var el = e.target, vis = false;
        try { vis = el.matches(':focus-visible'); } catch (x) { /* old browser */ }
        // a text box is :focus-visible even when a script focuses it (a picker opening), so only Tab's focus shows the tip
        if (!vis || !_mbuTip.tab) return;
        var f = mbuTipFind(el);
        if (f && f.el === el) { clearTimeout(_mbuTip.showT); _mbuTip.showT = setTimeout(function () { if (document.activeElement === el) mbuTipShow(f); }, 150); }
    }, true);
    document.addEventListener('focusout', function (e) {
        if (_mbuTip.cur && _mbuTip.cur === e.target && !(e.relatedTarget && inTip(e.relatedTarget))) mbuTipHide();
    }, true);
}
mbuTipStart();
// </ST-UI>

function fsStyle() {
    if (document.getElementById('fs-style')) return;
    const s = el('style'); s.id = 'fs-style';
    s.textContent = MBU_TOKENS + MBU_UI_CSS
        // majkinetor: "Make fusion icon be without text so it naturaly stack
        // over other icons" … "make it more like Falcon icon in appearance".
        // A wide labelled pill sat awkwardly beside the round icon-only
        // launchers the other scripts put in the same corner. Same circle,
        // same size, same resting opacity as Falcon's — only the glyph and its
        // colour differ, so the stack is uniform but each is still identifiable.
        + '.fs-launch{position:fixed;z-index:2147483000;width:40px;height:40px;border-radius:50%;border:none;padding:0;'
          + 'display:flex;align-items:center;justify-content:center;cursor:pointer;'
          + 'background:transparent;box-shadow:none;'
          + 'opacity:.85;transition:background .15s,transform .1s,opacity .15s}'
        + '.fs-launch img{width:34px;height:34px;display:block;pointer-events:none}'
        + '.fs-launch:hover{opacity:1;transform:scale(1.08)}'
        + '.fs-overlay{position:fixed;inset:0;background:rgba(15,12,28,.45);z-index:var(--mbu-z-modal);display:flex;align-items:center;justify-content:center}'
        // Light palette (#529: "make UI white") — every colour in the window is
        // driven from these tokens, so the theme is this one line plus the log
        // panel below. #562: those tokens are now aliases onto the repo-wide set
        // in dev/tokens/design-tokens.mjs, which is what makes "this one line" the same
        // one line for every script. Fusion's own names are kept so the ~250
        // var(--fs-*) call sites don't have to churn. The values shift slightly
        // (its purple was #6d3ff0, the shared accent is #5f3ec0, and the greys
        // move a shade) — that is the consolidation #562 asks for, not a bug.
        + '.fs-cons,.fs-embed{--fs-bg:var(--mbu-bg-sunken);--fs-panel:var(--mbu-bg);--fs-panel2:var(--mbu-bg-raised);--fs-border:var(--mbu-border-soft);--fs-text:var(--mbu-text);--fs-muted:var(--mbu-text-dim);--fs-purple:var(--mbu-accent);--fs-purple-d:var(--mbu-accent-hover);--fs-green:var(--mbu-ok);--fs-amber:var(--mbu-warn);--fs-red:var(--mbu-error);--fs-blue:var(--mbu-info)}'
        // #790: the group card in Mission Control's slot, outside Fusion's window
        + '.fs-embed{font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:var(--fs-text);text-align:left}'
        + '.fs-embed .fs-ghdr{cursor:default}.fs-embed .fs-grow{cursor:default}'
        + '.fs-mcopen{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border-radius:5px;cursor:pointer;background:transparent;border:1px solid transparent;flex-shrink:0}.fs-mcopen:hover,.fs-mcopen:focus-visible{background:var(--fs-panel2);border-color:var(--fs-purple)}.fs-mcopen img{width:16px;height:16px;display:block}'
        + '.fs-mstate{font-size:11px;padding:3px 9px;border-radius:5px;border:1px solid var(--fs-border);color:var(--fs-muted);white-space:nowrap}.fs-mstate.fs-done{color:var(--fs-green);border-color:var(--fs-green)}.fs-mstate.fs-err{color:var(--fs-red);border-color:var(--fs-red)}'
        + '.fs-cons{width:min(1560px,calc(100% - 24px));height:min(760px,92vh);max-width:calc(100% - 16px);max-height:96vh;min-width:640px;min-height:400px;resize:both;'
        + 'background:var(--fs-panel);color:var(--fs-text);border:1px solid var(--fs-border);border-radius:var(--mbu-radius-lg);box-shadow:0 8px 30px rgba(0,0,0,.5);'
        + 'font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden}'
        + '.fs-cons.fs-maximized{position:fixed !important;left:8px !important;top:8px !important;right:8px !important;bottom:8px !important;width:auto !important;height:auto !important;max-width:none !important;max-height:none !important;margin:0 !important}'
        + '.fs-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--fs-panel2);border-bottom:1px solid var(--fs-border);cursor:move}'
        + '.fs-title{font-weight:700;font-size:14px}'
        + '.fs-scope{color:var(--fs-muted);font-size:12px}'
        + '.fs-busy{color:var(--mbu-accent-deep-text);font-size:12px;font-weight:600;animation:fs-pulse 1.1s ease-in-out infinite;white-space:nowrap}'
        + '@keyframes fs-pulse{0%,100%{opacity:1}50%{opacity:.25}}'
        + '.fs-sp{flex:1}'
        + '.fs-cons-x{background:none;border:none;font-size:16px;color:var(--mbu-text-weak);cursor:pointer;padding:2px 8px;border-radius:5px;line-height:1}'
        + '.fs-cons-x:hover{background:rgba(0,0,0,.06);color:var(--fs-text)}'
        + '.fs-cfgbtn,.fs-x{color:var(--fs-muted);cursor:pointer;font-size:15px;padding:2px 6px}'
        + '.fs-cfgbtn:hover,.fs-x:hover{color:var(--fs-text)}'
        + '.fs-ctrl{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--fs-panel);border-bottom:1px solid var(--fs-border);flex-wrap:wrap}'
        + '.fs-ctrl select,.fs-ctrl input[type=text]{background:var(--fs-panel2);border:1px solid var(--fs-border);color:var(--fs-text);border-radius:var(--mbu-radius);padding:5px 8px;font-size:12px}'
        + '#fs-rg-editions{max-width:420px}'
        + '#fs-rg-editions:disabled{opacity:.7;font-style:italic;cursor:default}'
        + '.fs-ctrl input[type=text]{width:220px}'
        + '.fs-btn{border:1px solid var(--fs-border);background:var(--fs-panel2);color:var(--fs-text);border-radius:var(--mbu-radius);padding:5px 10px;font-size:12px;cursor:pointer}'
        // Match and its caret are one split button: shared edge, a thin divider between the halves
        + '.fs-split{display:inline-flex;align-items:stretch}.fs-split>.fs-btn{margin:0!important}'
        + '.fs-split>.fs-btn:first-child{border-top-right-radius:0!important;border-bottom-right-radius:0!important}'
        + '.fs-split>.fs-btn:last-child{border-top-left-radius:0!important;border-bottom-left-radius:0!important;border-left:1px solid rgba(255,255,255,.35)!important;padding-left:10px;padding-right:10px}'
        + '.fs-btn.fs-primary{background:linear-gradient(180deg,var(--fs-purple),var(--fs-purple-d));border-color:var(--fs-purple-d);color:var(--mbu-text-on-accent);font-weight:600}'
        + '.fs-btn:disabled{opacity:.5;cursor:default}'
        + '.fs-netbanner{display:inline-flex;align-items:center;box-sizing:border-box;height:18px;padding:0 8px;border-radius:4px;font-size:11px;line-height:1;font-weight:600;white-space:nowrap;cursor:pointer;background:rgba(168,112,42,.14);color:var(--mbu-warn);border:1px solid rgba(168,112,42,.4)}'
        + '.fs-netbanner.fs-netbanner-err{background:rgba(200,56,79,.12);color:var(--fs-red);border-color:rgba(200,56,79,.45)}'
        + '.fs-legend{display:flex;gap:10px;color:var(--fs-muted);font-size:11px;align-items:center}'
        + '.fs-body{display:flex;flex:1;min-height:0}'
        + '.fs-col{display:flex;flex-direction:column;min-width:0;min-height:0}'
        + '.fs-pool{width:360px;border-right:1px solid var(--fs-border);background:var(--fs-bg)}'
        + '.fs-body.fs-poolhidden .fs-pool{display:none}'
        + '.fs-poolrail{display:none;flex-direction:column;align-items:center;gap:10px;width:28px;flex-shrink:0;padding:10px 0;cursor:pointer;border-right:1px solid var(--fs-border);background:var(--fs-panel2);color:var(--fs-muted)}'
        + '.fs-body.fs-poolhidden .fs-poolrail{display:flex}'
        + '.fs-poolrail:hover{background:rgba(109,63,240,.06);color:var(--mbu-accent-text)}'
        + '.fs-railarrow{font-size:14px;line-height:1}'
        + '.fs-raillabel{writing-mode:vertical-rl;font-size:10px;font-weight:700;letter-spacing:.12em}'
        + '.fs-pooltog{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:2px 5px;border-radius:3px;cursor:pointer;color:var(--mbu-info);font-size:12px;line-height:1;flex-shrink:0}'
        + '.fs-pooltog:hover{background:rgba(0,0,0,.05);color:var(--fs-muted)}'
        + '.fs-groups{flex:1;background:var(--fs-panel)}'
        + '.fs-colhdr{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--fs-border);font-weight:700;font-size:12px;letter-spacing:.3px;color:var(--fs-muted);text-transform:uppercase;background:var(--fs-panel2)}'
        + '.fs-cnt{background:var(--fs-panel);border:1px solid var(--fs-border);border-radius:var(--mbu-radius-lg);padding:1px 7px;color:var(--fs-text);font-weight:600}'
        + '.fs-hint{text-transform:none;font-weight:400;color:var(--fs-muted)}'
        + '.fs-poolfilter{flex:1;min-width:0;max-width:210px;box-sizing:border-box;background:var(--fs-panel);border:1px solid var(--fs-border);color:var(--fs-text);border-radius:var(--mbu-radius);padding:3px 8px;font:400 11.5px -apple-system,Segoe UI,Arial,sans-serif;text-transform:none;letter-spacing:0}'
        + '.fs-poolfilter:focus{outline:none;border-color:var(--fs-purple)}'
        + '.fs-poolsort{display:flex;align-items:center;gap:8px;padding:6px 14px;border-bottom:1px solid var(--fs-border);background:var(--fs-panel2);color:var(--fs-muted);font-size:11.5px}'
        + '.fs-seg{display:inline-flex;border:1px solid var(--fs-border);border-radius:var(--mbu-radius);overflow:hidden}'
        + '.fs-seg button{border:0;border-left:1px solid var(--fs-border);background:var(--fs-panel);color:var(--fs-text);padding:4px 11px;font:400 12px -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer}'
        + '.fs-seg button:first-child{border-left:0}'
        + '.fs-seg button:hover{background:var(--fs-panel2)}'
        + '.fs-seg button.fs-on{background:var(--fs-purple);color:var(--mbu-text-on-accent)}'
        + '.fs-pcard.fs-run0{border-left:3px solid var(--fs-purple);background:color-mix(in srgb,var(--fs-purple) 8%,var(--fs-panel))}'
        + '.fs-pcard.fs-run1{border-left:3px solid var(--fs-green);background:color-mix(in srgb,var(--fs-green) 8%,var(--fs-panel))}'
        + '.fs-cnt.fs-cnt-filtered{color:var(--mbu-accent-deep-text);border-color:var(--fs-purple)}'
        // #529 follow-up (majkinetor, screenshot): "I can't see individual
        // recordings here (have to zoom out)" — classic flexbox trap: a flex
        // item's default min-height:auto refuses to shrink below its natural
        // content height, so with many groups this box grew past .fs-cons's
        // own fixed height instead of scrolling — the overflow got clipped by
        // .fs-cons's overflow:hidden rather than showing a scrollbar in here.
        + '.fs-colbody{flex:1;min-height:0;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px}'
        + '.fs-empty{color:var(--fs-muted);font-size:12px;padding:14px;text-align:center}'
        + '.fs-pcard{background:var(--fs-panel);border:1px solid var(--fs-border);border-radius:7px;padding:7px 9px;display:flex;align-items:center;gap:8px;cursor:grab;flex-shrink:0}'
        + '.fs-pcard.fs-selected{border-color:var(--fs-purple)}'
        + '.fs-grip{color:var(--mbu-text-weak);font-size:12px;letter-spacing:-1px}'
        + '.fs-info{flex:1;min-width:0}'
        + '.fs-t{font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        // #529 follow-up (majkinetor, screenshot): "you can see merged item no
        // link" — the <a> was always there and functional (verified: real href,
        // pointer-events:auto even after a merge), but color:inherit +
        // text-decoration:none until hover made every link visually identical
        // to plain text at rest, so it genuinely read as "no link" on sight.
        + '.fs-t a{color:var(--mbu-accent-text);text-decoration:underline;text-decoration-color:rgba(109,63,240,.4)}'
        + '.fs-t a:hover{color:var(--mbu-accent-text);text-decoration-color:var(--fs-purple)}'
        + '.fs-artist{font-weight:400;color:var(--fs-muted);font-size:11.5px}.fs-dis{font-weight:400;color:var(--fs-muted)}'
        + '.fs-artist a{color:var(--fs-muted);text-decoration:underline;text-decoration-color:rgba(154,155,176,.35)}'
        + '.fs-artist a:hover{text-decoration-color:var(--fs-text);color:var(--fs-text)}'
        + '.fs-m{color:var(--fs-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}'
        + '.fs-ids{display:flex;gap:5px;margin-top:2px}'
        + '.fs-idtag{font-size:9.5px;color:var(--fs-muted);font-family:ui-monospace,Consolas,monospace;background:rgba(0,0,0,.05);padding:1px 5px;border-radius:3px}'
        // Presence dots: does this recording have an ISRC / an AcoustID. The
        // legend that used to explain them is gone (#529: "I don't see how it is
        // used"), so the dots carry their own meaning — each keeps a distinct
        // colour and a tooltip that names the identifier and says present/absent.
        + '.fs-badges{display:flex;gap:3px;flex-shrink:0}'
        + '.fs-b{width:6px;height:6px;border-radius:50%;background:var(--mbu-bg-sunken)}'
        + '.fs-b-isrc.fs-b-on{background:var(--fs-green)} .fs-b-acid.fs-b-on{background:var(--fs-blue)}'
        + '.fs-b-unknown{background:transparent;box-shadow:inset 0 0 0 1px #ccccd8}'
        + '.fs-b-unconfirmed{background:var(--mbu-info-bg);box-shadow:inset 0 0 0 1px #b9b9c8}'
        + '.fs-rm{color:var(--fs-muted);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0}'
        + '.fs-rm:hover{color:var(--fs-red)}'
        // flex-shrink:0 is the actual fix for the missing-rows bug: .fs-gcard
        // has overflow:hidden, and per spec that makes its automatic min-height
        // resolve to 0 instead of content-based — so without flex-shrink:0,
        // flexbox happily squashed every card to fit .fs-colbody's available
        // space (clipping the rows inside via that same overflow:hidden)
        // instead of letting .fs-colbody's own overflow-y:auto scroll.
        + '.fs-gcard{background:var(--fs-panel);border:1px solid var(--fs-border);border-left:3px solid var(--fs-green);border-radius:7px;overflow:hidden;flex-shrink:0}'
        + '.fs-gcard-med{border-left-color:var(--fs-amber)}'
        + '.fs-gcard-manual{border-left-color:var(--fs-blue);border-left-style:dashed}'
        + '.fs-gcard.fs-active{outline:2px solid var(--fs-purple);outline-offset:-1px}'
        + '.fs-ghdr{position:relative;display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,0,0,.025);border-bottom:1px solid var(--fs-border);cursor:pointer}'   // relative: anchors the #619 length badge
        // Collapse/expand toggles. Full-size glyph AND a generous hit area (#419,
        // #467, #529 — third recurrence of the same rule). ▶/▼ are the full-size
        // triangles; ▸/▾ are Unicode's *small* ones and read as shrunken however
        // much padding is wrapped around them.
        // Full-size glyph, but LIGHT: a solid 14px triangle in the muted text
        // colour reads as heavy as the titles it sits next to (#529 — "too dark
        // and intrusive"). Size is the accessibility requirement, weight is not,
        // so the contrast lives in the hover instead of the resting state.
        + '.fs-ctog,.fs-exp{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:2px 5px;border-radius:3px;cursor:pointer;color:var(--mbu-info);font-size:14px;line-height:1;flex-shrink:0;transition:color .12s,background .12s}'
        + '.fs-ctog:hover,.fs-exp:hover{background:rgba(0,0,0,.05);color:var(--fs-muted)}'
        + '.fs-exp-on,.fs-gcard-collapsed .fs-ctog{color:var(--mbu-text-weak)}'
        + '.fs-gcard-collapsed .fs-ghdr{border-bottom:none}'
        + '.fs-cnt{font-size:10.5px;color:var(--fs-muted);white-space:nowrap}'
        // The release table must scroll INSIDE the card — it has far more columns
        // than the card is wide, and letting it stretch would blow out the layout.
        + '.fs-reltbl{overflow-x:auto;margin:0 0 6px 30px;border:1px solid var(--fs-border);border-radius:4px;background:var(--mbu-bg);scrollbar-width:thin;scrollbar-color:#d3d3e0 transparent}'
        + '.fs-reltbl::-webkit-scrollbar{height:7px}'
        + '.fs-reltbl::-webkit-scrollbar-track{background:transparent}'
        + '.fs-reltbl::-webkit-scrollbar-thumb{background:var(--mbu-bg-sunken);border-radius:4px}'
        + '.fs-reltbl:hover::-webkit-scrollbar-thumb{background:var(--mbu-bg-sunken)}'
        + '.fs-reltbl table{border-collapse:collapse;font-size:10.5px;width:100%;table-layout:fixed;min-width:720px}'
        + '.fs-reltbl col.c-num{width:3.5%} .fs-reltbl col.c-title{width:14%} .fs-reltbl col.c-len{width:4.5%}'
        + '.fs-reltbl col.c-tart{width:11%} .fs-reltbl col.c-rel{width:17%} .fs-reltbl col.c-rart{width:10.5%}'
        + '.fs-reltbl col.c-rgt{width:13%} .fs-reltbl col.c-cd{width:8.5%} .fs-reltbl col.c-label{width:10.5%} .fs-reltbl col.c-cat{width:7%}'
        + '.fs-reltbl th{text-align:left;font-weight:600;padding:4px 7px;border-bottom:1px solid var(--fs-border);white-space:nowrap;background:rgba(0,0,0,.03)}'
        + '.fs-reltbl td{padding:3px 7px;border-bottom:1px solid rgba(0,0,0,.05);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-reltbl tr:last-child td{border-bottom:none}'
        + '.fs-relband td{font-weight:600;background:rgba(0,0,0,.05);color:var(--fs-text)}'
        + '.fs-relload,.fs-relerr,.fs-relempty{padding:6px 9px;font-size:10.5px;color:var(--fs-muted)}'
        + '.fs-relerr{color:var(--fs-red)}'
        + '.fs-gt{font-weight:700;font-size:12.5px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-ghdr-grid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}'
        + '.fs-ghl{display:flex;align-items:center;gap:8px;min-width:0}'
        + '.fs-ghr{display:flex;align-items:center;gap:8px;justify-self:end}'
        + '.fs-gnum{width:20px;flex-shrink:0;text-align:right;font-weight:800;font-size:12px;color:var(--fs-muted);cursor:help}'
        + '.fs-sig span{box-sizing:border-box;width:64px;text-align:center}'
        + '.fs-tier-strict{border-left-color:var(--mbu-ok);background:rgba(28,155,99,.045)}'
        + '.fs-tier-normal{border-left-color:var(--mbu-info);background:rgba(47,127,191,.045)}'
        + '.fs-tier-loose{border-left-color:var(--mbu-warn);background:rgba(168,112,42,.05)}'
        + '.fs-tier-manual{border-left-color:var(--mbu-border);background:rgba(154,154,171,.05)}'
        + '.fs-gcard.fs-dragover{outline:2px dashed var(--fs-purple);outline-offset:-3px}'
        + '.fs-gt a{color:var(--mbu-accent-text);text-decoration:underline;text-decoration-color:rgba(109,63,240,.4)}'
        + '.fs-gt a:hover{color:var(--mbu-accent-text);text-decoration-color:var(--fs-purple)}'
        + '.fs-conf{font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700;letter-spacing:.2px}'
        + '.fs-conf-high{background:rgba(28,155,99,.12);color:var(--fs-green)}'
        + '.fs-conf-med{background:rgba(168,112,42,.13);color:var(--fs-amber)}'
        + '.fs-conf-manual{background:rgba(47,127,191,.13);color:var(--fs-blue)}'
        + '.fs-sig{display:flex;gap:3px}'
        // A matched signal has to READ as lit (#529: "chips are still not
        // highlighted, although it says HIGH"). The .hit class was applied all
        // along, but green-text-on-white against grey-text-on-white is nearly
        // invisible at 9.5px — so matched chips now carry a filled tint, a solid
        // border and bold text, and unmatched ones are deliberately faded back.
        // #564 (majkinetor): "Fusion chips all look the same on dark theme (i
        // can't see for example if isrc is matched or not)". The old pair was a
        // fixed rgba(28,155,99,.16) tint against a light panel plus opacity:.55
        // on the miss — on a dark background that tint is nearly the panel
        // colour, and dimming an already-dim chip leaves two faint outlines that
        // differ only in hue at 9.5px. So the difference is structural now: a hit
        // is FILLED with a tint mixed from the theme's own green and its text is
        // pulled most of the way to the foreground colour; a miss carries no fill
        // at all and stays a bare outline. A first attempt at 22% fill was still
        // too quiet to read at 9.5px on dark — the screenshots showed two nearly
        // identical outlines — so the fill is 42% and the text near-white.
        + '.fs-sig span{font-size:9.5px;padding:1px 5px;border-radius:4px;background:transparent;border:1px solid var(--mbu-border);color:var(--mbu-text-weak);font-weight:500}'
        + '.fs-sig span.warn{background:color-mix(in srgb, var(--mbu-warn) 22%, transparent);border-color:var(--mbu-warn);color:var(--mbu-warn);font-weight:700}'   // #619 lengths past the tolerance
        // #619 follow-up (majkinetor): "Highlighted length is not aligned vertically with
        // normal length". The tint was a centred 44px box, so its digits sat several px right
        // of the plain lengths above and below. The tint now reaches 4px LEFT into the gap
        // instead (margin -4 / padding +4 / width +4): same 44px footprint, digits start
        // exactly where the unhighlighted ones do.
        + '.fs-grow .fs-len.fs-len-off{color:var(--mbu-warn);font-weight:700;background:color-mix(in srgb, var(--mbu-warn) 16%, transparent);border-radius:3px;margin-left:-4px;padding-left:4px;width:48px}'
        + '.fs-lenwarn{flex:0 0 auto;margin-left:6px;padding:0 6px;border:1px solid var(--mbu-warn);border-radius:9px;color:var(--mbu-warn);background:color-mix(in srgb, var(--mbu-warn) 14%, transparent);font-size:10.5px;font-weight:700;line-height:1.5;white-space:nowrap;cursor:help}'
        // #619 follow-up: "it should be in len column" — placeLenBadges() lifts it out of
        // the title track and over the rows' length column (left edge = the amber cells').
        + '.fs-setwarn{flex:0 0 auto;margin-left:6px;padding:0 6px;border:1px solid var(--mbu-warn);border-radius:9px;color:var(--mbu-warn);background:color-mix(in srgb, var(--mbu-warn) 14%, transparent);font-size:10.5px;font-weight:700;line-height:1.5;white-space:nowrap;cursor:help}'
        + '.fs-live{background:color-mix(in srgb, var(--fs-red) 12%, transparent);color:var(--fs-red);border:1px solid color-mix(in srgb, var(--fs-red) 40%, transparent);border-radius:3px;padding:0 4px;font-size:9.5px;font-weight:700;text-transform:uppercase;white-space:nowrap}'
        + '.fs-reldis{font-weight:400;color:var(--fs-muted);font-style:italic}'
        + '.fs-reltag{font-style:normal;font-size:8.5px;font-weight:700;text-transform:uppercase;border:1px solid var(--fs-border);border-radius:3px;padding:0 3px;margin-right:3px;vertical-align:1px}'
        + '.fs-place{font-weight:400;color:var(--fs-muted);font-size:11.5px;white-space:nowrap}'
        + '.fs-lenwarn.fs-lenwarn-col{position:absolute;top:50%;transform:translateY(-50%);margin-left:0}'
        + '.fs-sig span.hit{background:color-mix(in srgb, var(--mbu-ok) 42%, transparent);border-color:var(--mbu-ok);color:color-mix(in srgb, var(--mbu-ok) 18%, var(--mbu-text));font-weight:700}'
        + '.fs-sig span.partial{background:color-mix(in srgb, var(--mbu-ok) 16%, transparent);border-style:dashed;border-color:color-mix(in srgb, var(--mbu-ok) 60%, transparent);color:color-mix(in srgb, var(--mbu-ok) 45%, var(--mbu-text))}'
        + '.fs-mergeicon{vertical-align:-2px;margin-right:2px}'
        + '.fs-mbtn{font-size:11px;padding:3px 9px;border-radius:5px;border:1px solid var(--fs-purple-d);background:rgba(109,63,240,.1);color:var(--mbu-accent-deep-text);cursor:pointer;font-weight:600;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:5px}'
        + '.fs-mbtn.fs-done{background:rgba(28,155,99,.12);border-color:var(--fs-green);color:var(--fs-green);cursor:default}'
        + '.fs-mbtn.fs-err{background:rgba(200,56,79,.1);border-color:var(--fs-red);color:var(--fs-red)}'
        // shared-identifier tints (#529) — one colour per distinct value shared
        // by 2+ members of a card, so agreeing rows are obvious at a glance.
        + '.fs-idc0,.fs-idc1,.fs-idc2,.fs-idc3,.fs-idc4,.fs-idc5{border-radius:3px;padding:1px 4px;font-weight:600}'
        + '.fs-idc0{background:rgba(28,155,99,.16);color:var(--mbu-ok) !important}'
        + '.fs-idc1{background:rgba(47,127,191,.16);color:var(--mbu-info) !important}'
        + '.fs-idc2{background:rgba(168,112,42,.18);color:var(--mbu-warn) !important}'
        + '.fs-idc3{background:rgba(109,63,240,.14);color:var(--mbu-accent-text) !important}'
        + '.fs-idc4{background:rgba(200,56,79,.14);color:var(--mbu-error) !important}'
        + '.fs-idc5{background:rgba(20,140,150,.16);color:var(--mbu-info) !important}'
        + '.fs-rec-video{display:inline-flex;vertical-align:-2px;color:var(--mbu-accent-text);margin-left:1px}'
        + '.fs-rec-video svg{display:block}'
        + '.fs-pending{background:rgba(168,112,42,.15);color:var(--mbu-warn);border:1px solid rgba(168,112,42,.4);border-radius:3px;padding:0 4px;font-size:9.5px;font-weight:700;white-space:nowrap}'
        + '.fs-gcard.fs-has-pending{border-left-color:var(--fs-amber) !important;border-left-style:dashed !important}'
        + '.fs-note-btn{cursor:pointer;font-size:12px;padding:1px 6px;border-radius:4px;border:1px solid var(--fs-border);color:var(--fs-muted);background:var(--fs-panel2);flex-shrink:0}'
        + '.fs-acref{cursor:pointer;font-size:13px;line-height:1;padding:2px 7px;border-radius:4px;border:1px solid var(--fs-border);color:var(--fs-muted);background:var(--fs-panel2);flex-shrink:0}'
        + '.fs-acref:hover{color:var(--fs-text);border-color:var(--fs-muted)}'
        + '.fs-acref-busy{cursor:progress;opacity:.55}'
        + '.fs-note-btn:hover{color:var(--fs-text);border-color:var(--fs-muted)}'
        + '.fs-note-btn.fs-has-note{background:rgba(109,63,240,.12);border-color:var(--fs-purple);color:var(--mbu-accent-deep-text);font-weight:700}'
        + '.fs-note-wrap{padding:8px 10px 10px}'
        + '.fs-note-ta{width:100%;box-sizing:border-box;min-height:110px;resize:vertical;font:12px ui-monospace,Consolas,monospace;color:var(--fs-text);background:var(--fs-panel2);border:1px solid var(--fs-border);border-radius:var(--mbu-radius);padding:7px 9px}'
        + '.fs-note-ta:focus{outline:none;border-color:var(--fs-purple)}'
        + '.fs-note-hint{color:var(--fs-muted);font-size:10.5px;margin-top:5px}'
        + '.fs-gcard.fs-editing{border-left-color:var(--fs-purple);border-left-style:solid}'
        + '.fs-note-save,.fs-note-cancel,.fs-note-clear{padding:2px 10px;font-size:11px}'
        + '.fs-note-save{background:linear-gradient(180deg,var(--fs-purple),var(--fs-purple-d));border-color:var(--fs-purple-d);color:var(--mbu-text-on-accent);font-weight:600}'
        + '.fs-kill{cursor:pointer;font-size:13px;padding:2px 4px;opacity:.6}'
        + '.fs-kill:hover{opacity:1}'
        + '.fs-clearboard-btn{padding:2px 8px;font-size:11px;text-transform:none;font-weight:400;letter-spacing:0}'
        + '.fs-grows{padding:4px 6px}'
        + '.fs-grow{display:flex;align-items:flex-start;gap:8px;padding:5px 7px;border-radius:5px}'
        + '.fs-grow:hover{background:rgba(0,0,0,.035)}'
        // no target-row wash: the ★ and the row's position at the top of the card already say which recording is kept (#529).
        + '.fs-star{width:16px;flex-shrink:0;text-align:center;font-size:13px;color:var(--mbu-text-weak);cursor:pointer;opacity:0;transition:opacity .1s}'
        + '.fs-grow:hover .fs-star{opacity:1}'
        + '.fs-star-on{color:var(--fs-amber) !important;opacity:1 !important;cursor:default}'
        + '.fs-star-disabled{cursor:default}'
        // box-sizing matters on these fixed-width flex cells (#529): the
        // shared-identifier tint adds horizontal padding, and under content-box that
        // padding ADDED to the width (96px→104px), so tinted rows sat 8px left of
        // untinted ones — the artist/length columns visibly failed to line up.
        + '.fs-grow .fs-t{flex:1;min-width:0}'
        + '.fs-artistcol{box-sizing:border-box;color:var(--fs-muted);font-size:11px;width:120px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-artistcol a{color:var(--fs-muted);text-decoration:underline;text-decoration-color:rgba(154,155,176,.35)}'
        + '.fs-artistcol a:hover{text-decoration-color:var(--fs-text);color:var(--fs-text)}'
        + '.fs-grow .fs-rel{box-sizing:border-box;color:var(--fs-muted);font-size:11px;width:190px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-grow .fs-len{box-sizing:border-box;color:var(--fs-muted);font-size:11px;width:44px;flex-shrink:0}'
        + '.fs-grow .fs-isrc{box-sizing:border-box;color:var(--fs-muted);font-size:10px;width:96px;flex-shrink:0;font-family:ui-monospace,Consolas,monospace;display:flex;flex-direction:column;gap:2px;align-items:flex-start}'
        + '.fs-idv{border-radius:3px;padding:1px 4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.45}'
        + 'a.fs-idv,a.fs-idtag{color:inherit;text-decoration:none}a.fs-idv:hover,a.fs-idtag:hover{text-decoration:underline}'
        + '.fs-idnone{padding:1px 0;line-height:1.45}'
        + '.fs-idmore{padding:1px 4px;line-height:1.45;cursor:pointer;color:var(--mbu-info);font-family:system-ui,sans-serif}.fs-idmore:hover{text-decoration:underline}'
        + '.fs-idunk{color:var(--mbu-info);cursor:help;font-weight:700}'
        + '.fs-grow .fs-t,.fs-grow .fs-artistcol,.fs-grow .fs-rel,.fs-grow .fs-len,.fs-grow .fs-star,.fs-grow .fs-acts,.fs-grow .fs-exp{line-height:1.45;padding-top:1px}'
        + '.fs-acts{display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity .1s}'
        + '.fs-grow:hover .fs-acts{opacity:1}'
        + '.fs-acts span{color:var(--fs-muted);cursor:pointer;font-size:12px;padding:1px 3px}'
        + '.fs-acts span:hover{color:var(--fs-text)}'
        + '.fs-rm-x:hover{color:var(--fs-red) !important}'
        + '.fs-gerr{margin:0 8px 6px;padding:5px 8px;background:rgba(200,56,79,.09);border:1px solid rgba(200,56,79,.35);border-radius:5px;color:var(--fs-red);font-size:11px}'
        + '.fs-newgroup{border:1px dashed var(--fs-border);border-radius:7px;padding:9px;text-align:center;color:var(--fs-muted);font-size:12px;cursor:pointer}'
        + '.fs-ftr{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--fs-panel2);border-top:1px solid var(--fs-border)}'
        + '.fs-idmore{color:var(--fs-muted);font-size:9px}'
        + '.fs-bgtask{font-size:11px;color:var(--fs-muted);white-space:nowrap}'
        + '.fs-bgstop{margin-left:6px;padding:0 4px;border-radius:3px;font-weight:700;color:var(--fs-muted);background:rgba(0,0,0,.06)}'
        + '.fs-bgstop:hover{background:rgba(200,56,79,.15);color:var(--fs-red)}'
        + '.fs-clearset{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--fs-muted);white-space:nowrap}'
        + '.fs-subcnt{font-size:10.5px;font-weight:600;color:var(--fs-muted);text-transform:none;letter-spacing:0;white-space:nowrap}'
        + '.fs-runsum{position:relative;margin:8px 10px 0;border:1px solid rgba(28,155,99,.4);background:rgba(28,155,99,.07);border-radius:var(--mbu-radius);font-size:11.5px}'
        + '.fs-runsum-d>summary{cursor:pointer;padding:7px 26px 7px 10px;font-weight:600;color:var(--mbu-ok);list-style:revert}'
        + '.fs-runlist{margin:0;padding:2px 10px 8px 26px;max-height:220px;overflow:auto}'
        + '.fs-runlist li{padding:1px 0;color:var(--fs-text)}'
        + '.fs-runbad{color:var(--fs-red)}'
        + '.fs-runn{color:var(--fs-muted);font-size:10px}'
        + '.fs-runerr{color:var(--fs-red);font-size:10.5px}'
        + '.fs-runclose{position:absolute;top:5px;right:7px;cursor:pointer;color:var(--fs-muted);font-size:12px;padding:2px 4px}'
        + '.fs-runclose:hover{color:var(--fs-text)}'
        + '.fs-matchmsg{font-size:10.5px;font-weight:600;text-transform:none;letter-spacing:0;white-space:nowrap;padding:2px 8px;border-radius:9px;cursor:help}'
        + '.fs-matchmsg-none{background:rgba(168,112,42,.13);color:var(--mbu-warn)}'
        + '.fs-matchmsg-ok{background:rgba(28,155,99,.13);color:var(--mbu-ok)}'
        + '.fs-cutwrap{display:inline-flex;align-items:center;gap:6px;color:var(--mbu-text);font-size:12px}'
        + '.fs-cutoff{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--mbu-border);border-radius:14px;padding:2px 9px;cursor:pointer;font:12px Arial;background:var(--mbu-bg);color:var(--mbu-text);user-select:none}'
        + '.fs-cutoff-dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.18);flex:none}'
        + '.fs-cutoff-caret{color:var(--mbu-text-weak);font-size:10px}'
        + '.fs-cutoff-menu{position:fixed;z-index:2147483646;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:7px;box-shadow:0 8px 24px rgba(40,20,80,.22);padding:4px;font:13px Arial}'
        + '.fs-cutoff-menu .mi{display:flex;align-items:center;gap:9px;padding:5px 11px 5px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;color:var(--mbu-text)}'
        + '.fs-cutoff-menu .mi:hover,.fs-cutoff-menu .mi.sel{background:var(--mbu-bg-hover)}'
        + '.fs-toLog{cursor:pointer} .fs-toLog:hover{text-decoration:underline}'
        + '.fs-clearset .fs-btn{padding:2px 8px}'
        + '.fs-detbtn{font-size:12px;line-height:1;color:var(--fs-muted);border:1px solid var(--fs-border);border-radius:4px;padding:3px 6px;cursor:pointer;white-space:nowrap;background:var(--mbu-bg);flex-shrink:0}'
        + '.fs-detbtn:hover{border-color:var(--fs-purple);color:var(--mbu-accent-text)}'
        + '.fs-detbtn-on{background:rgba(109,63,240,.09);border-color:var(--fs-purple);color:var(--mbu-accent-text)}'
        + '.fs-idstat{white-space:nowrap;cursor:help}'
        + '.fs-idstat-none{color:var(--fs-muted)}'
        + '.fs-sum{color:var(--fs-muted);font-size:12px}'
        + '.fs-sum b{color:var(--fs-text)}'
        + '.fs-note{color:var(--fs-muted);font-size:11px}'
        + '.fs-settings{position:fixed;z-index:2147483001;background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:8px;padding:10px 14px;width:max-content;min-width:300px;max-width:min(460px,calc(100vw - 28px));box-sizing:border-box;box-shadow:0 8px 26px rgba(0,0,0,.25);font:13px -apple-system,Segoe UI,Arial,sans-serif}'
        + '.fs-settings .fs-ver{font-size:11px;color:var(--mbu-text-weak);font-weight:normal}'
        + '.fs-opt{display:block;margin:8px 0;font-size:12px}'
        + '.fs-opt textarea{width:100%;box-sizing:border-box;margin-top:4px;font-size:12px;font-family:inherit}'
        // log viewer — ported from apollo_editor's #283 window (wider, centred,
        // minimize/restore, badge, per-severity colouring), in Fusion's light palette.
    document.head.appendChild(s);
}

// #529 follow-up: "make recordings names in the cards links that open
// recording MB page" — every place a recording's title is shown.
function recLink(gid, text) {
    return '<a href="' + location.origin + '/recording/' + gid + '" target="_blank" rel="noopener">' + escapeHtml(text) + '</a>';
}
// #764 (chaban-mb): "These recordings are not the same but this is not very obvious due to
// disambiguations not being shown": a recording's disambiguation after its title, as MB shows it
function recDis(rec) {
    return rec.disambiguation ? ' <span class="fs-dis">(' + escapeHtml(rec.disambiguation) + ')</span>' : '';
}
// #789 (phw): a live recording and where it was recorded, read from its relationships
const recordedAt = rec => rec.places && rec.places.length ? 'recorded ' + rec.places.map(p => (p.kind === 'area' ? 'in ' : 'at ') + placeText(p)).join(', ') : '';
function liveBadge(rec) { return rec.live ? '<span class="fs-live" data-tip="Live recording: its performance of the work is marked live">live</span> ' : ''; }
function recPlace(rec) {
    return rec.places && rec.places.length ? ' <span class="fs-place" data-tip="' + escapeHtml(recordedAt(rec)) + '">@ ' + escapeHtml(rec.places.map(p => p.name).join(', ')) + '</span>' : '';
}
const recTip = rec => escapeHtml(rec.title + (rec.disambiguation ? ' (' + rec.disambiguation + ')' : '') + (rec.live ? ' — live' : '') + (recordedAt(rec) ? ' — ' + recordedAt(rec) : ''));
/* #789 (majkinetor): "I remove disamb. on tracks sometimes and put it on album" — so a recording
   without one goes by its release's, but only against a recording whose release is in the same
   release group: albums of different groups are disambiguated for unrelated reasons. */
function memberDis(m, members) {
    if (m.disambiguation) return { text: m.disambiguation, from: 'recording' };
    const rel = m.releases && m.releases[0];
    if (rel && rel.disambiguation && rel.rgGid && members.some(o => o !== m && o.releases && o.releases[0] && o.releases[0].rgGid === rel.rgGid)) return { text: rel.disambiguation, from: 'album', release: rel };
    return { text: '', from: '' };
}
function albumDisHtml(m, members) {
    const d = memberDis(m, members);
    if (d.from !== 'album') return '';
    const tip = "No disambiguation on the recording; this is its release's: " + relTitle(d.release) + ', in the same release group as another recording here';
    return ' <span class="fs-reldis" data-tip="' + escapeHtml(tip) + '">(<span class="fs-reltag">album</span>' + escapeHtml(d.text) + ')</span>';
}
// #789: what a group's members disagree on that says they may be different recordings, strongest first
function settingWarning(members) {
    const live = members.filter(m => m.live === true), studio = members.filter(m => m.live === false);
    if (live.length && studio.length) return { label: 'live + studio', title: 'Live and studio recordings in one group\nThey are never the same recording.\nLive: '
        + live.map(m => m.title + (recordedAt(m) ? ' (' + recordedAt(m) + ')' : '')).join('; ') };
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
        const c = placeConflict(members[i], members[j]);
        if (c) return { label: uniq(members.flatMap(m => (m.places || []).map(placeText))).length + ' places', title: 'Recorded at different places or on different dates\n' + c + '\n⚠ Check they are the same recording before merging' };
    }
    const dis = members.map(m => memberDis(m, members));
    if (uniq(dis.map(d => d.text)).length > 1) return { label: 'disamb.', title: 'The disambiguations differ\n'
        + members.map((m, i) => '- ' + m.title + ' — ' + (dis[i].from ? dis[i].from + ': ' + dis[i].text : 'none')).join('\n') + '\n⚠ Check they are the same recording before merging' };
    return null;
}
function artistLink(rec) {
    if (!rec.artistCredit) return '';
    return rec.artistGid ? '<a href="' + location.origin + '/artist/' + rec.artistGid + '" target="_blank" rel="noopener">' + escapeHtml(rec.artistCredit) + '</a>' : escapeHtml(rec.artistCredit);
}
// #529 follow-up (majkinetor, with a screenshot of the reference script's
// "Releases (including from other release groups)" column): summarize every
// release a recording appears on, deduped by release id — not just the one
// it happened to be seeded from. Full list is in the tooltip (one per line);
// the visible text stays short so rows don't blow out.
// #789 (majkinetor): a disambiguation is sometimes moved from the tracks to the release, so it shows there too
const relTitle = r => r.title + (r.disambiguation ? ' (' + r.disambiguation + ')' : '');
function releasesSummary(rec) {
    const primary = rec.releases[0];
    const full = rec.allReleases;
    // #529 (majkinetor): "We have 'no release' on some rows although expanding
    // them shows releases" — and the tooltip claimed a load was in progress when
    // nothing was. Browse seeding cannot ask for releases, and the search pass
    // that fills them in does not cover every recording, so an empty list here
    // usually means "never fetched" rather than "on no release". Claiming the
    // latter states a fact we do not have — the same mistake the AcoustID and
    // ISRC displays used to make.
    if (!primary && full == null) return { text: '—', tooltip: 'Release list not loaded for this recording yet — expand it to fetch' };
    const primaryText = primary ? (relTitle(primary) + (primary.trackNumber ? ' · track ' + primary.trackNumber : '')) : '(no release)';
    if (full == null) return { text: primaryText + ' …', tooltip: primaryText + '\n(more releases may exist — not loaded yet)' };
    const seen = new Set(); const lines = [];
    for (const r of full) { const key = r.gid || r.title; if (key && !seen.has(key)) { seen.add(key); lines.push(relTitle(r) + (r.date ? ' (' + r.date + ')' : '')); } }
    if (lines.length <= 1) return { text: primaryText, tooltip: lines[0] || primaryText };
    return { text: primaryText + ' +' + (lines.length - 1) + ' more', tooltip: lines.join('\n') };
}
// #529 follow-up: "Show video marker" — a visible badge, not just a
// behind-the-scenes exclusion rule, so it's obvious before you even try to group one.
// #529 (majkinetor): "use the same image for video recording as Apollo" —
// apollo_editor's #303 VIDEO_MARK, which itself mirrors MB's native recordings-table marker.
const MERGE_MARK = '<svg class="fs-mergeicon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v6a5 5 0 0 0 5 5h7"/><path d="M18 3v6a5 5 0 0 1-5 5h-2"/><polyline points="15 11 19 14 15 17"/></svg>';
const VIDEO_MARK = '<span class="fs-rec-video" data-tip="This recording is a video"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></span>';
// #761 (chaban-mb): "It would be useful to have the AcoustIDs linked to more easily fix the
// linked recordings when erroneous": an AcoustID opens its page on acoustid.org
const acidUrl = id => 'https://acoustid.org/track/' + encodeURIComponent(id);
function videoBadge(rec) { return rec.video === true ? VIDEO_MARK + ' ' : ''; }
function pendingBadge(rec) { return rec.editsPending ? '<span class="fs-pending" data-tip="This recording has open edits in MusicBrainz\nLeft out of Match, and not merged until they are applied.">⏳ pending</span> ' : ''; }
// #529 follow-up: "we should see isrc and accousticid in the card too" — the
// pool card only showed presence dots; show the actual values (AcoustID
// truncated, it's a 36-char UUID — full value is in the tooltip).
function idsLine(rec) {
    const isrc = (rec.isrcs && rec.isrcs[0]) || null;
    const acid = (rec.acoustids && rec.acoustids[0]) || null;
    if (!isrc && !acid) return '';
    let out = '<div class="fs-ids">';
    if (isrc) out += '<span class="fs-idtag" data-tip="' + escapeHtml((rec.isrcs || []).join(', ')) + '">' + escapeHtml(isrc) + '</span>';
    if (acid) out += '<a class="fs-idtag" href="' + acidUrl(acid) + '" target="_blank" rel="noopener" data-tip="AcoustID ' + escapeHtml(acid) + '\nClick: open it on acoustid.org">' + escapeHtml(acid.slice(0, 8)) + '…</a>';
    return out + '</div>';
}
// A dot per identifier. "not looked up yet" is deliberately a THIRD state, not
// folded into "absent": with acoustids left null (lookup skipped or still
// running) an unlit dot would otherwise claim the recording has no AcoustID
// when nobody ever asked. Same reason isrcsKnown exists on the fetch side.
function presenceDots(rec) {
    const dot = (cls, label, list, known, unconfirmed, why) => {
        const n = list ? list.length : 0;
        // "absent" is only claimed when something authoritative actually said so.
        // An empty list from the SEARCH INDEX is not that: the index lags, so it
        // reports none for recordings MusicBrainz does have (#529).
        const state = !known ? 'unknown' : n ? 'on' : (unconfirmed ? 'unconfirmed' : 'off');
        const title = state === 'unknown' ? label + ' not looked up yet'
            : state === 'on' ? n + ' ' + label + (n > 1 ? 's' : '') + ': ' + list.join(', ')
                : state === 'unconfirmed' ? 'no ' + label + ' found — ' + why
                    : 'no ' + label + ' on this recording';
        return '<span class="fs-b fs-b-' + cls + ' fs-b-' + state + '" data-tip="' + escapeHtml(title) + '"></span>';
    };
    return '<div class="fs-badges">'
        + dot('isrc', 'ISRC', rec.isrcs, rec.isrcsKnown, rec.isrcSource === 'index',
              'this comes from the search index, which lags; not confirmed against the recording itself')
        + dot('acid', 'AcoustID', rec.acoustids, rec.acoustids != null, false, '')
        + '</div>';
}
function poolCardHtml(rec, run) {
    const rs = releasesSummary(rec);
    return '<div class="fs-pcard' + (run == null ? '' : ' fs-run' + run) + '" draggable="true" data-gid="' + rec.gid + '">'
        + '<span class="fs-grip">⠿</span>'
        + '<div class="fs-info"><div class="fs-t" data-tip="' + recTip(rec) + '">' + pendingBadge(rec) + videoBadge(rec) + liveBadge(rec) + recLink(rec.gid, rec.title) + recPlace(rec) + recDis(rec) + (rec.artistCredit ? ' <span class="fs-artist">— ' + artistLink(rec) + '</span>' : '') + '</div>'
        + '<div class="fs-m" data-tip="' + escapeHtml(rs.tooltip) + '">' + escapeHtml(rs.text) + ' · ' + dur(rec.length) + '</div>' + idsLine(rec) + '</div>'
        + presenceDots(rec)
        + '<span class="fs-rm" data-act="pool-remove" data-tip="Remove from the pool">✕</span></div>';
}
// The expanded per-recording release table (#529). Columns follow MB's own
// merge-page table so the two can be read side by side, with a status band
// ("Official" / "Promotion" / …) heading each run exactly as MB does it.
// #529: "add collapse all toggle above (should toggle collapsing on all cards)".
// One button, and what it does next is decided by the majority: if anything is
// still expanded it collapses everything, otherwise it expands everything —
// so a half-collapsed board always has an obvious next move.
// #529: "make pool collapsable itself to the left side". Collapsing hands the
// pool's 360px to the groups column, which is what actually relieves the
// release table's horizontal scrolling. A thin rail stays behind so the pool is
// one click away and its count is still visible — collapsed, not hidden.
function setPoolCollapsed(on) {
    const body = document.getElementById('fs-body'); if (!body) return;
    body.classList.toggle('fs-poolhidden', !!on);
    const tog = document.getElementById('fs-pooltog');
    if (tog) tog.dataset.tip = on ? 'Show the pool' : 'Fold the pool away\nThe groups get the full width.';
    if (SETTINGS.poolCollapsed !== !!on) { SETTINGS.poolCollapsed = !!on; saveSettings(); }
    renderPoolCount();
}
// Only the rail's copy: renderPool owns fs-pool-cnt, including its filtered
// "shown / total" form, and two writers would fight over it.
function renderPoolCount() {
    const b = document.getElementById('fs-rail-cnt'); if (b) b.textContent = String(STATE.poolOrder.length);
}
function allGroupsCollapsed() {
    return STATE.groups.length > 0 && STATE.groups.every(g => STATE.collapsedGroups.has(g.id));
}
function toggleCollapseAll() {
    if (allGroupsCollapsed()) STATE.collapsedGroups.clear();
    else STATE.groups.forEach(g => STATE.collapsedGroups.add(g.id));
    renderGroups();
}
// #529 (majkinetor): "In the header add recursive expand (both cards and
// recordings)". Collapse all only ever touched the cards; opening every release
// table underneath still meant clicking each card's own control. This does
// both, and fetches whatever those rows still need.
function everythingExpanded() {
    return STATE.groups.length > 0
        && STATE.groups.every(g => !STATE.collapsedGroups.has(g.id) && g.memberGids.every(m => STATE.expandedReleases.has(m)));
}
async function toggleExpandAllDeep() {
    resumeBackground('you used Expand all details');
    if (everythingExpanded()) {
        STATE.groups.forEach(g => g.memberGids.forEach(m => STATE.expandedReleases.delete(m)));
        STATE.groups.forEach(g => STATE.collapsedGroups.add(g.id));
        renderGroups(); return;
    }
    STATE.collapsedGroups.clear();
    STATE.groups.forEach(g => g.memberGids.forEach(m => STATE.expandedReleases.add(m)));
    renderGroups();
    const missing = [];
    for (const g of STATE.groups) for (const m of g.memberGids) if (!STATE.releaseDetails.has(m) && !missing.includes(m)) missing.push(m);
    if (!missing.length) return;
    Log.info('Expand all details: loading release tables for ' + missing.length + ' recording(s)');
    let done = 0;
    const epoch = _bgEpoch;
    for (const gid of missing) {
        if (!bgAlive(epoch)) { Log.warn('Stopped loading release tables after ' + done + ' of ' + missing.length); break; }
        setBgTask('Loading recording releases ' + (done + 1) + '/' + missing.length + '…');
        try { storeReleaseDetails(gid, await fetchReleaseDetails(gid)); }
        catch (e) { STATE.releaseDetails.set(gid, null); Log.warn('Release lookup failed for ' + gid + ': ' + e.message); }
        done++;
        renderGroups();
    }
    setBgTask('');
}
function renderDeepBtn() {
    const b = document.getElementById('fs-expandall-deep'); if (!b) return;
    const on = everythingExpanded();
    b.textContent = (on ? '⇱' : '⇲') + ' All details';
    b.dataset.tip = on ? 'Collapse every group and every release table' : "Expand every group, and every recording's release table";
    b.disabled = STATE.groups.length === 0;
}
function renderCollapseAllBtn() {
    const b = document.getElementById('fs-collapseall'); if (!b) return;
    const collapsed = allGroupsCollapsed();
    b.textContent = collapsed ? '▶ Expand all' : '▼ Collapse all';
    b.dataset.tip = collapsed ? 'Expand every group card' : 'Collapse every group card';
    b.disabled = STATE.groups.length === 0;
}
// #529: "add an option to load releases in the background for created groups …
// but should not block from working". Only recordings that are actually IN a
// group are prefetched — that is the set you are about to merge, and it is far
// smaller than the pool. Sequential and gated, so it queues behind (and yields
// to) anything the user does; nothing here calls busyStart.
let _prefetchRunning = false, _prefetchCapWarned = 0;
async function prefetchGroupReleases() {
    if (!SETTINGS.prefetchGroupReleases || _prefetchRunning || _bgStopped) return;
    const wanted = [];
    for (const g of STATE.groups) {
        for (const gid of g.memberGids) {
            if (!STATE.releaseDetails.has(gid) && !wanted.includes(gid)) wanted.push(gid);
        }
    }
    if (!wanted.length) return;
    const cap = SETTINGS.releasePrefetchCap || 200;
    if (wanted.length > cap) {
        // renderGroups calls this on EVERY render, so warn once per board size
        // rather than replaying the same line into the log on every repaint.
        if (_prefetchCapWarned !== wanted.length) {
            _prefetchCapWarned = wanted.length;
            Log.warn('Background release prefetch: ' + wanted.length + ' recording(s) exceeds the cap (' + cap + ') — expand a row to load its releases on demand instead');
        }
        return;
    }
    _prefetchCapWarned = 0;
    _prefetchRunning = true;
    const epoch = _bgEpoch;
    Log.info('Background release prefetch: ' + wanted.length + ' recording(s) in ' + STATE.groups.length + ' group(s)');
    let done = 0;
    try {
        for (const gid of wanted) {
            if (!bgAlive(epoch)) { Log.warn('Release prefetch stopped after ' + done + ' of ' + wanted.length); break; }
            // Groups can be dissolved or merged while this runs — skip anything
            // that has left the board rather than fetching data nobody wants.
            if (!STATE.groups.some(g => g.memberGids.includes(gid))) { done++; continue; }
            if (STATE.releaseDetails.has(gid)) { done++; continue; }
            setBgTask('Loading recording releases ' + (done + 1) + '/' + wanted.length + '…');
            try { storeReleaseDetails(gid, await fetchReleaseDetails(gid)); }
            catch (e) { STATE.releaseDetails.set(gid, null); Log.warn('Release prefetch failed for ' + gid + ': ' + e.message); }
            done++;
            // only repaint if the row is actually open; the rest is cache warming
            if (STATE.expandedReleases.has(gid)) renderGroups();
        }
        Log.info('Background release prefetch: finished ' + done + ' of ' + wanted.length);
    } finally {
        _prefetchRunning = false;
        setBgTask('');
        // a group created while this was running still needs its turn
        if (STATE.groups.some(g => g.memberGids.some(m => !STATE.releaseDetails.has(m)))) setTimeout(prefetchGroupReleases, 0);
    }
}
// #529: "add uncollapse/all details toggle in the card itself" — one control per
// card that opens (or closes) the release table for EVERY recording in it,
// rather than clicking each row's caret in turn. Same all-or-nothing rule as
// the board-level Collapse all: if anything is still closed, open everything.
function groupAllExpanded(group) {
    return group.memberGids.length > 0 && group.memberGids.every(g => STATE.expandedReleases.has(g));
}
async function toggleAllDetails(groupId) {
    const g = findGroup(groupId); if (!g) return;
    resumeBackground('you opened a card’s details');
    if (groupAllExpanded(g)) {
        g.memberGids.forEach(gid => STATE.expandedReleases.delete(gid));
        renderGroups();
        return;
    }
    g.memberGids.forEach(gid => STATE.expandedReleases.add(gid));
    renderGroups();                                   // loading stubs appear at once
    const missing = g.memberGids.filter(gid => !STATE.releaseDetails.has(gid));
    if (!missing.length) return;
    let done = 0;
    const epoch = _bgEpoch;
    for (const gid of missing) {
        if (!bgAlive(epoch)) { Log.warn('Stopped loading release tables after ' + done + ' of ' + missing.length); break; }
        setBgTask('Loading recording releases ' + (done + 1) + '/' + missing.length + '…');
        try { storeReleaseDetails(gid, await fetchReleaseDetails(gid)); }
        catch (e) { STATE.releaseDetails.set(gid, null); Log.warn('Release lookup failed for ' + gid + ': ' + e.message); }
        done++;
        renderGroups();                               // these rows ARE open, so repaint
    }
    setBgTask('');
    Log.info('Loaded release details for ' + done + ' recording(s) in the group');
}
// The expanded table and the row summary were reading different sources: the
// table used the freshly fetched detail, the summary used whatever the seed
// happened to carry. Store in one place and backfill the recording, so a row
// can never say "no release" while its own table lists them (#529).
function storeReleaseDetails(gid, rows) {
    STATE.releaseDetails.set(gid, rows);
    const rec = STATE.recordings.get(gid);
    if (!rec || !rows) return;
    const seen = new Set(); const list = [];
    for (const r of rows) {
        if (!r.gid || seen.has(r.gid)) continue;
        seen.add(r.gid);
        list.push({ gid: r.gid, title: r.title, disambiguation: r.disambiguation || '', rgGid: r.rgGid || null, trackNumber: r.trackNumber, trackCount: null, date: r.date || null });
    }
    rec.allReleases = list;
    if (!rec.releases || !rec.releases.length) rec.releases = list;
}
function toggleIdList(gid, kind) {
    const key = gid + ':' + kind;
    if (!STATE.expandedIds.delete(key)) STATE.expandedIds.add(key);
    renderGroups();
}
async function toggleReleaseDetails(gid) {
    resumeBackground('you expanded a recording');
    if (STATE.expandedReleases.has(gid)) { STATE.expandedReleases.delete(gid); renderGroups(); return; }
    STATE.expandedReleases.add(gid);
    renderGroups();                                  // show "loading…" straight away
    if (STATE.releaseDetails.has(gid)) return;       // cached (including a cached failure)
    const rec = STATE.recordings.get(gid);
    Log.info('Fetching full release details for ' + (rec ? describeRecordingForLog(rec) : gid));
    busyStart();
    try {
        const rows = await fetchReleaseDetails(gid);
        storeReleaseDetails(gid, rows);
        Log.info(rows ? 'Release details: ' + rows.length + ' release(s) for ' + (rec ? rec.title : gid) : 'Release details lookup failed for ' + gid);
    } catch (e) {
        STATE.releaseDetails.set(gid, null);
        Log.error('Release details lookup error: ' + e.message);
    } finally { busyEnd(); renderGroups(); }
}
function releaseTableHtml(rec) {
    const rows = STATE.releaseDetails.get(rec.gid);
    if (rows === undefined) return '<div class="fs-reltbl fs-relload">loading releases…</div>';
    if (rows === null) return '<div class="fs-reltbl fs-relerr">could not load releases for this recording</div>';
    if (!rows.length) return '<div class="fs-reltbl fs-relempty">this recording is not on any release</div>';
    const cell = v => escapeHtml(v == null || v === '' ? '—' : String(v));
    const td = (v, extra) => { const t = v == null || v === '' ? '—' : String(v);
        return '<td data-tip="' + escapeHtml(t) + '"' + (extra || '') + '>' + escapeHtml(t) + '</td>'; };
    let out = '<div class="fs-reltbl"><table>'
        + '<colgroup><col class="c-num"><col class="c-title"><col class="c-len"><col class="c-tart"><col class="c-rel">'
        + '<col class="c-rart"><col class="c-rgt"><col class="c-cd"><col class="c-label"><col class="c-cat"></colgroup>'
        + '<thead><tr>'
        + '<th>#</th><th>Title</th><th>Length</th><th>Track artist</th><th>Release title</th>'
        + '<th>Release artist</th><th>Release group type</th><th>Country/Date</th><th>Label</th><th>Catalog#</th>'
        + '</tr></thead><tbody>';
    let band = undefined;
    for (const r of rows) {
        if (r.status !== band) {
            band = r.status;
            out += '<tr class="fs-relband"><td colspan="10">' + escapeHtml(band || 'No status') + '</td></tr>';
        }
        const num = (r.discNumber ? r.discNumber + '.' : '') + (r.trackNumber == null ? '—' : r.trackNumber);
        const cd = [r.country, r.date].filter(Boolean).join(' ') || '—';
        out += '<tr>'
            + '<td>' + escapeHtml(num) + '</td>'
            + td(r.trackTitle)
            + '<td>' + (r.trackLength ? dur(r.trackLength) : '—') + '</td>'
            + td(r.trackArtist)
            + '<td data-tip="' + escapeHtml(relTitle(r)) + '"><a href="/release/' + r.gid + '" target="_blank" rel="noopener">' + cell(r.title) + '</a>' + (r.disambiguation ? ' <span class="fs-dis">(' + escapeHtml(r.disambiguation) + ')</span>' : '') + '</td>'
            + td(r.artist)
            + td([r.rgType, r.format].filter(Boolean).join(' · '))
            + '<td>' + escapeHtml(cd) + '</td>'
            + td(r.label)
            + td(r.catalog)
            + '</tr>';
    }
    return out + '</tbody></table></div>';
}
// embed (#790): the card in Mission Control's slot. MC's Execute merges and its tick takes the group in or
// out, so the board's own actions go (Merge, delete, collapse, return to pool, drag); Open in Fusion comes in.
function groupCardHtml(group, embed) {
    const members = group.memberGids.map(g => STATE.recordings.get(g)).filter(Boolean);
    // #529 follow-up: "remove radios, make hover action that one is merge
    // target. It should also go to the top of the card" — the target member
    // sorts first, an always-visible star marks it, and a hover-only star on
    // the other rows sets a new target.
    const ordered = members.slice().sort((a, b) => (a.gid === group.target ? -1 : 0) - (b.gid === group.target ? -1 : 0));
    const confClass = group.confidence === 'high' ? 'high' : group.confidence === 'medium' ? 'med' : 'manual';
    // #619 (chaban-mb): a group held together by AcoustID/title/artist can still have lengths
    // well past the tolerance (4:53 vs 4:38) — the card was all green and only a faded Length
    // chip said so. Flag it: amber Length chip, a "⚠ Ns" badge by the title, the off rows'
    // length cells, and the card tooltip. Grouping itself is unchanged (the gross-length guard
    // still decides that); this is the warning MBS-10966 asks for at merge time.
    const lenTol = SETTINGS.lengthToleranceMs != null ? SETTINGS.lengthToleranceMs : 5000;
    const lenSpread = lengthSpread(members);
    const lenOff = lenSpread != null && lenSpread > lenTol;
    const lenRefRec = members.find(m => m.gid === group.target && typeof m.length === 'number' && m.length > 0) || null;
    const lenOffBy = m => (lenRefRec && m !== lenRefRec && typeof m.length === 'number' && m.length > 0 && Math.abs(m.length - lenRefRec.length) > lenTol) ? m.length - lenRefRec.length : null;
    const secs = ms => Math.round(Math.abs(ms) / 1000);
    const setWarn = settingWarning(members);   // #789
    const lenWarnTitle = lenOff ? lengthDiffLabel(members) + ' ' + secs(lenSpread) + 's — more than the ' + secs(lenTol) + 's length tolerance. Check it is really the same take before merging.' : '';
    const sigNames = { isrc: 'ISRC', acoustid: 'AcoustID', length: 'Length', title: 'Title', artist: 'Artist' };
    const sigAll = group.signalsAll || [];
    const sigChips = Object.keys(sigNames).map(k => {
        const lit = sigAll.includes(k);
        const partial = !lit && (group.signals || []).includes(k);
        if (k === 'length' && lenOff) return '<span class="warn" data-tip="' + escapeHtml(lenWarnTitle) + '">' + sigNames[k] + '</span>';   // #619
        const title = lit ? sigNames[k] + ' matches across every recording in this group'
            : partial ? sigNames[k] + ' matches only some of these recordings, not all'
            : 'no ' + sigNames[k] + ' match';
        return '<span class="' + (lit ? 'hit' : partial ? 'partial' : '') + '" data-tip="' + title + '">' + sigNames[k] + '</span>';
    }).join('');
    const busy = group.state === 'busy', done = group.state === 'done';
    const tooFew = members.length < 2;
    const stateLabel = busy ? '⏳ Merging…' : done ? '✓ Merged' : group.state === 'error' ? '⚠ Retry merge' : tooFew ? MERGE_MARK + ' Merge (needs 2+)' : MERGE_MARK + ' Merge';
    const stateCls = done ? 'fs-done' : group.state === 'error' ? 'fs-err' : '';
    // #529 (majkinetor): "we should color the same isrc/acousticid within card …
    // If there are multiple groups, each should have its own color" — any
    // identifier shared by 2+ members gets a tint, and each DISTINCT shared value
    // gets its own colour, so which rows actually agree is visible at a glance.
    // Values appearing only once stay plain, since they prove nothing.
    // Count how many MEMBERS carry each value, not how many times it occurs:
    // a value listed twice on one recording proves nothing about agreement.
    const idCounts = new Map();
    ordered.forEach(m => {
        uniq([...(m.isrcs || []), ...(m.acoustids || [])]).forEach(v => idCounts.set(v, (idCounts.get(v) || 0) + 1));
    });
    const idColor = new Map();
    ordered.forEach(m => {
        uniq([...(m.isrcs || []), ...(m.acoustids || [])]).forEach(v => {
            if (idCounts.get(v) > 1 && !idColor.has(v)) idColor.set(v, 'fs-idc' + (idColor.size % 6));
        });
    });
    // #529 (majkinetor, "This accousticId isn't matching"): a recording can carry
    // SEVERAL AcoustIDs, and showing list[0] displayed a non-shared one next to
    // another row's shared one — so a correctly-matched group looked mismatched.
    // Show the value that actually links this row to the rest, and say how many
    // more there are rather than hiding them.
    // #529 (majkinetor, option B): show EVERY identifier, stacked one per line,
    // for ISRCs as well as AcoustIDs. Showing a single value could never express
    // the truth once a recording carries more than one — two rows can be linked
    // by different ids, so whichever one the cell picked, some real relationship
    // stayed invisible and the colours read as a contradiction.
    // #529 (majkinetor): "sort id's … so we don't have them moving places across
    // rows (9e is first on pos 1 then at pos 2)". The order has to come from the
    // GROUP, not from each recording's own array, or the same value lands on a
    // different line in each row. Most-shared first (that is the line that
    // explains why the group exists), ties broken alphabetically so it is total
    // and stable.
    const idRank = (v) => (-(idCounts.get(v) || 0));
    const sortIds = (vals) => vals.slice().sort((a, b) => idRank(a) - idRank(b) || (a < b ? -1 : a > b ? 1 : 0));
    const idCell = (rec, kind) => {
        const isAcoustid = kind === 'acoustid';
        const list = isAcoustid ? rec.acoustids : rec.isrcs;
        const vals = sortIds(uniq(list || []));
        const label = isAcoustid ? 'AcoustID' : 'ISRC';
        if (!vals.length) {
            // An em dash asserts "none". Only say that when something
            // authoritative did; otherwise say we do not know (#529).
            const known = isAcoustid ? rec.acoustids != null : !!rec.isrcsKnown;
            const unconfirmed = !isAcoustid && rec.isrcSource === 'index';
            const mark = !known ? '?' : unconfirmed ? '·' : '—';
            const tip = !known ? label + ' not looked up yet'
                : unconfirmed ? 'no ' + label + ' found, but this comes from the search index, which lags — not confirmed against the recording itself'
                    : 'no ' + label + ' on this recording';
            return '<span class="fs-isrc"><span class="fs-idnone' + (known && !unconfirmed ? '' : ' fs-idunk') + '" data-tip="' + escapeHtml(tip) + '">' + mark + '</span></span>';
        }
        const tags = vals.map(v => {
            const cls = idColor.get(v) || '';
            const shown = isAcoustid ? escapeHtml(v.slice(0, 8)) + '…' : escapeHtml(v);
            const title = label + ' ' + escapeHtml(v) + (cls ? ' — shared with another recording in this group' : ' — only on this recording') + (isAcoustid ? ' · open on acoustid.org' : '');
            return isAcoustid ? '<a class="fs-idv fs-idlink ' + cls + '" href="' + acidUrl(v) + '" target="_blank" rel="noopener" data-tip="' + title + '">' + shown + '</a>'
                : '<span class="fs-idv ' + cls + '" data-tip="' + title + '">' + shown + '</span>';
        });
        // majkinetor: a recording with dozens of AcoustIDs stretched its row to a
        // screen of unshared ids. The shared ones (sorted first) always show; the
        // unshared rest folds behind "+N more" past ID_FOLD lines, per row and kind.
        const keep = Math.max(ID_FOLD, vals.filter(v => idColor.has(v)).length);
        if (tags.length <= keep + 1) return '<span class="fs-isrc">' + tags.join('') + '</span>';
        const key = rec.gid + ':' + kind, open = STATE.expandedIds.has(key);
        const more = tags.length - keep;
        const toggle = '<span class="fs-idmore" data-act="toggle-ids" data-kind="' + kind + '" data-tip="' + (open ? 'Show only the first ' + keep : 'Show ' + more + ' more ' + label + 's, none shared with this group') + '">' + (open ? 'less' : '+' + more + ' more') + '</span>';
        return '<span class="fs-isrc">' + (open ? tags : tags.slice(0, keep)).join('') + toggle + '</span>';
    };
    const rows = ordered.map(m => {
        const rs = releasesSummary(m);
        const isTarget = group.target === m.gid;
        const canPick = !busy && !done;
        const star = isTarget
            ? '<span class="fs-star fs-star-on" data-tip="The merge target\nThis one is kept.">★</span>'
            : '<span class="fs-star' + (canPick ? '' : ' fs-star-disabled') + '" data-act="' + (canPick ? 'set-target' : '') + '" data-tip="' + (canPick ? 'Make this the merge target' : '') + '">☆</span>';
        const expanded = STATE.expandedReleases.has(m.gid);
        return '<div class="fs-growwrap">'
            + '<div class="fs-grow' + (isTarget ? ' fs-target-row' : '') + '"' + (embed ? '' : ' draggable="true"') + ' data-gid="' + m.gid + '">'
            + '<span class="fs-exp' + (expanded ? ' fs-exp-on' : '') + '" data-act="toggle-releases" data-tip="' + (expanded ? 'Hide' : 'Show') + ' every release this recording is on">' + (expanded ? '▼' : '▶') + '</span>'
            + star
            + '<span class="fs-t" data-tip="' + recTip(m) + '">' + pendingBadge(m) + videoBadge(m) + liveBadge(m) + recLink(m.gid, m.title) + recPlace(m) + recDis(m) + albumDisHtml(m, members) + '</span>'
            + '<span class="fs-artistcol" data-tip="' + escapeHtml(m.artistCredit || '') + '">' + artistLink(m) + '</span>'
            + '<span class="fs-rel" data-tip="' + escapeHtml(rs.tooltip) + '">' + escapeHtml(rs.text) + '</span>'
            + (() => { const d = lenOffBy(m); return d == null ? '<span class="fs-len">' + dur(m.length) + '</span>'
                : '<span class="fs-len fs-len-off" data-tip="' + (d > 0 ? '+' : '−') + secs(d) + 's against the merge target (' + dur(lenRefRec.length) + ')\nThe tolerance is ' + secs(lenTol) + 's">' + dur(m.length) + '</span>'; })()   // #619
            + idCell(m, 'isrc')
            + idCell(m, 'acoustid')
            + (embed ? '' : '<span class="fs-acts"><span data-act="return" data-tip="Back to the pool">↩</span><span class="fs-rm-x" data-act="remove-both" data-tip="Remove from the group and the pool">✕</span></span>') + '</div>'
            + (expanded ? releaseTableHtml(m) : '')
            + '</div>';
    }).join('');
    const errMsg = group.state === 'error' ? '<div class="fs-gerr">' + escapeHtml(group.error || 'merge failed') + '</div>' : '';
    const activeCls = (!embed && STATE.activeGroupId === group.id ? ' fs-active' : '') + (members.some(m => m.editsPending) ? ' fs-has-pending' : '');
    const head = ordered[0];
    const hasNote = !!(group.editNote && group.editNote.trim());
    // #529 (majkinetor): "add in each card edit button in the title - clicking it
    // should transform entire card into textbox for edit note … If there is edit
    // note, button should be different color."
    const noteBtn = '<span class="fs-note-btn' + (hasNote ? ' fs-has-note' : '') + '" data-act="edit-note" data-tip="'
        + (hasNote ? 'A custom edit note is set\nClick: edit it' : 'Add a custom edit note for this merge') + '">✎</span>';
    if (group.editing) {
        const draft = group.editNote != null ? group.editNote : autoEditNote(group);
        return '<div class="fs-gcard fs-gcard-' + confClass + activeCls + ' fs-editing" data-gid="' + group.id + '">'
            + '<div class="fs-ghdr"><span class="fs-gt">✎ Edit note — ' + escapeHtml(head ? head.title : 'group') + '</span><div class="fs-sp"></div>'
            + '<button class="fs-btn fs-note-save" type="button" data-act="note-save">Save</button>'
            + '<button class="fs-btn fs-note-cancel" type="button" data-act="note-cancel">Cancel</button>'
            + (hasNote ? '<button class="fs-btn fs-note-clear" type="button" data-act="note-clear" data-tip="Back to the generated note">Reset</button>' : '')
            + '</div>'
            + '<div class="fs-note-wrap"><textarea class="fs-note-ta" spellcheck="false" placeholder="Edit note submitted with this merge…">' + escapeHtml(draft) + '</textarea>'
            + '<div class="fs-note-hint">Replaces the auto-generated reason line. Fusion\'s attribution footer is always appended.</div></div></div>';
    }
    // #529: "We should also be able to collapse entire card." Collapsed keeps the
    // header — confidence, chips and Merge stay usable — and hides only the rows,
    // so a long board can be skimmed without losing the ability to act on it.
    const collapsed = !embed && STATE.collapsedGroups.has(group.id);
    // #529 (majkinetor): "Keep matrix at the middle (A), remove '2 recordings' as
    // it is redundant … remove STRICT/NORMAL etc. and use colors (C), with non
    // intrusive background row color for each variant."
    //   · the leading count already says how many recordings, so the words go
    //   · the title cell is FIXED width, which is what puts every chip at the
    //     same x across cards — the matrix only aligns if the thing before it
    //     cannot vary
    //   · the tier is carried by the row tint and left rail, not a text pill
    const tier = group.tier || 'manual';
    const tierWhy = (tier === 'manual'
        ? 'Grouped by hand — no cutoff level would have formed this group automatically'
        : 'Holds together at the "' + tier + '" cutoff' + (tier === 'loose' ? ' — it would not form at a stricter setting' : ''))
        + (lenOff ? ' — but its lengths differ by up to ' + secs(lenSpread) + 's (tolerance ' + secs(lenTol) + 's)' : '')
        + (setWarn ? '\n' + setWarn.title : '');   // #619: auto or by hand; #789
    return '<div class="fs-gcard fs-gcard-' + confClass + ' fs-tier-' + tier + activeCls + (collapsed ? ' fs-gcard-collapsed' : '') + '" data-gid="' + group.id + '" data-tip="' + escapeHtml(tierWhy) + '">'
        // Three tracks — 1fr | auto | 1fr — so the chip matrix is centred on the
        // CARD, not merely at a fixed offset after the title (#529: "matrix is
        // not in the middle"). Equal side tracks also mean the centre column
        // lands at the same x on every card without the title needing a fixed
        // width, so long titles no longer have to be truncated to keep the
        // matrix aligned.
        + '<div class="fs-ghdr fs-ghdr-grid">'
        + '<div class="fs-ghl">'
        + '<span class="fs-gnum" data-tip="' + members.length + ' recording' + (members.length === 1 ? '' : 's') + ' in this group">' + members.length + '</span>'
        + (embed ? '' : '<span class="fs-ctog" data-act="toggle-card" data-tip="' + (collapsed ? 'Expand this group' : 'Collapse this group') + '">' + (collapsed ? '▶' : '▼') + '</span>')
        + '<span class="fs-gt" data-tip="' + escapeHtml(head ? head.title : '') + '">' + (head ? recLink(head.gid, head.title) : 'New group') + '</span>'
        + (lenOff ? '<span class="fs-lenwarn" data-tip="' + escapeHtml(lenWarnTitle) + '">⚠ ' + secs(lenSpread) + 's</span>' : '')   // #619
        + (setWarn ? '<span class="fs-setwarn" data-tip="' + escapeHtml(setWarn.title) + '">⚠ ' + escapeHtml(setWarn.label) + '</span>' : '')   // #789
        + '</div>'
        + '<div class="fs-sig">' + sigChips + '</div>'
        + '<div class="fs-ghr">'
        + (collapsed ? '' : '<span class="fs-detbtn' + (groupAllExpanded(group) ? ' fs-detbtn-on' : '') + '" data-act="toggle-all-details" data-tip="'
            + (groupAllExpanded(group) ? 'Hide the release tables of every recording in this group' : 'Show the release tables of every recording in this group') + '">'
            + '▤' + '</span>')
        // #762: ask acoustid.org again, after fixing a wrong link there
        + '<span class="fs-acref' + (group.acRefreshing || group.mcChecking ? ' fs-acref-busy' : '') + '" data-act="refresh-acoustid" data-tip="'
            + (group.mcChecking ? 'Checking ISRCs and AcoustIDs…' : group.acRefreshing ? 'Checking AcoustIDs…' : 'Check this group’s AcoustIDs again on acoustid.org\nAfter fixing a wrong link there') + '">↻</span>'
        + noteBtn
        + (embed ? (busy || done || group.state === 'error' ? '<span class="fs-mstate ' + stateCls + '"' + (group.error ? ' data-tip="' + escapeHtml(group.error) + '"' : '') + '>' + (group.state === 'error' ? '⚠ Merge failed' : stateLabel) + '</span>' : '')
            + '<button class="fs-mcopen" type="button" data-act="mc-open" data-tip="Open in Fusion\nFusion\'s window, with this group on the board" aria-label="Open in Fusion"><img alt="" src="' + ICON_URL + '"></button>'
            : '<button class="fs-mbtn ' + stateCls + '" type="button" data-act="merge-group" ' + (busy || done || tooFew ? 'disabled' : '') + '>' + stateLabel + '</button>'
            + '<span class="fs-kill" data-act="delete-group" data-tip="Delete this group\nIts recordings go back to the pool." ' + (busy ? 'style="display:none"' : '') + '>🗑</span>')
        + '</div></div>'
        + (collapsed ? '' : '<div class="fs-grows">' + rows + '</div>' + errMsg) + '</div>';
}

// #529 (majkinetor): "add pool filtering as one types in the header instead" —
// the header hint was static text; it is now a filter box. Purely a VIEW
// filter: Auto-match, merges and counts still operate on the whole pool, so a
// filter left in the box can never silently narrow what actually gets matched.
function poolMatches(rec, q) {
    if (!q) return true;
    const hay = [rec.title, rec.artistCredit, ...(rec.isrcs || []), ...(rec.acoustids || []), ...(rec.releases || []).map(r => r.title)]
        .filter(Boolean).join(' ');
    return normName(hay).includes(normName(q));
}
// The pool's sort (majkinetor): Added keeps the order recordings came in; Title puts
// the versions of one song together (a bracketed part such as "(remastered)" is
// ignored), Artist sorts by artist, then title. Only the view: poolOrder and Match
// don't change. A title that repeats (the same artist too, under Artist) is a run, and
// its cards are tinted, alternating two colours so neighbouring runs stay apart; a
// title on its own stays plain, so a pool of all-different titles shows no tint.
const POOL_SORTS = ['added', 'title', 'artist'];
function sortTitle(t) { return normName(String(t || '').replace(/\s*[([][^)\]]*[)\]]/g, ' ')) || normName(t); }
// [{ rec, run }]: run is 0 or 1 (the colour) for a card in a run of two or more, else null
function sortPool(recs, mode) {
    if (mode !== 'title' && mode !== 'artist') return recs.map(r => ({ rec: r, run: null }));
    const cmp = (a, b) => a.localeCompare(b);
    const rows = recs.map((r, i) => ({ rec: r, t: sortTitle(r.title), a: normName(r.artistCredit), i }))
        .sort((x, y) => (mode === 'title' ? cmp(x.t, y.t) || cmp(x.a, y.a) : cmp(x.a, y.a) || cmp(x.t, y.t)) || x.i - y.i);
    const key = x => mode === 'title' ? x.t : x.a + '\u0001' + x.t;
    let n = 0;
    for (let i = 0; i < rows.length;) {
        let j = i + 1; while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
        const run = j - i > 1 ? n++ % 2 : null;
        for (let k = i; k < j; k++) rows[k].run = run;
        i = j;
    }
    return rows.map(x => ({ rec: x.rec, run: x.run }));
}
function renderPoolSort() {
    const mode = POOL_SORTS.includes(SETTINGS.poolSort) ? SETTINGS.poolSort : 'added';
    document.querySelectorAll('#fs-pool-sort [data-sort]').forEach(b => b.classList.toggle('fs-on', b.dataset.sort === mode));
}
function setPoolSort(mode) {
    if (!POOL_SORTS.includes(mode)) return;
    if (SETTINGS.poolSort !== mode) { SETTINGS.poolSort = mode; saveSettings(); }
    renderPoolSort(); renderPool();
}
function renderPool() {
    const body = document.getElementById('fs-pool-body'); if (!body) return;
    const q = STATE.poolFilter || '';
    const all = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
    const recs = q ? all.filter(r => poolMatches(r, q)) : all;
    const cnt = document.getElementById('fs-pool-cnt');
    if (cnt) { cnt.textContent = q ? recs.length + ' / ' + all.length : String(all.length); cnt.classList.toggle('fs-cnt-filtered', !!q); }
    body.innerHTML = recs.length
        ? sortPool(recs, SETTINGS.poolSort).map(({ rec, run }) => poolCardHtml(rec, run)).join('')
        : '<div class="fs-empty">' + (q ? 'No pool recording matches “' + escapeHtml(q) + '”.' : 'Pool is empty — add a recording by MBID/URL above.') + '</div>';
    if (STATE.selected) { const c = body.querySelector('[data-gid="' + STATE.selected + '"]'); if (c) c.classList.add('fs-selected'); }
    renderPoolCount();
}
let renderEmbeds = () => {};   // #790: Mission Control's adapter sets it
function renderGroups() {
    renderEmbeds();
    const body = document.getElementById('fs-groups-body'); if (!body) return;
    document.getElementById('fs-groups-cnt').textContent = String(STATE.groups.length);
    // #529 (majkinetor): "add number of recordings in the groups too … It shows
    // 16 groups but no number of total recordings" — the group count alone says
    // nothing about how much of the pool is actually staged for merging.
    const recs = document.getElementById('fs-groups-recs');
    if (recs) {
        const n = STATE.groups.reduce((a, g) => a + g.memberGids.length, 0);
        recs.textContent = n ? n + ' recording' + (n === 1 ? '' : 's') : '';
        recs.dataset.tip = n ? n + ' recording' + (n === 1 ? '' : 's') + ' staged in ' + STATE.groups.length + ' group' + (STATE.groups.length === 1 ? '' : 's') : '';
    }
    body.innerHTML = STATE.groups.map(groupCardHtml).join('') + '<div class="fs-newgroup" id="fs-newgroup">+ New group — drag a pool recording here, or select one and click here</div>';
    placeLenBadges(body);
    // the rows' length column moves whenever the window is resized or maximized
    if (!body._fsLenObs && typeof ResizeObserver !== 'undefined') {
        let raf = 0;
        body._fsLenObs = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => placeLenBadges(body)); });
        body._fsLenObs.observe(body);
    }
    renderCollapseAllBtn();
    renderDeepBtn();
    // Groups just changed, so there may be new members to warm the cache for.
    // Fire-and-forget: it must never make rendering wait on the network.
    prefetchGroupReleases();
}
// #619 follow-up (majkinetor): "Move ⚠ 31s to the right, it should be in 'len column'".
// The header is its own grid (title | chips | buttons) and shares no columns with the
// member rows, so the badge is placed by measurement: its left edge goes to the rows'
// length column (the edge the amber length cells start at). It stays beside the title
// when there are no rows to line up with (a collapsed card) or when that column would
// run into the title, the chips or the buttons (a narrow window).
function placeLenBadges(root) {
    (root || document).querySelectorAll('.fs-gcard').forEach(card => {
        const badge = card.querySelector('.fs-lenwarn'); if (!badge) return;
        badge.classList.remove('fs-lenwarn-col'); badge.style.left = '';
        const hdr = card.querySelector('.fs-ghdr');
        const cell = card.querySelector('.fs-grows .fs-grow .fs-len');
        if (!hdr || !cell || !cell.offsetParent) return;
        const h = hdr.getBoundingClientRect(), c = cell.getBoundingClientRect();
        // an amber cell already reaches 4px left (see .fs-len-off); a plain one doesn't
        const edge = c.left - (cell.classList.contains('fs-len-off') ? 0 : 4);
        badge.classList.add('fs-lenwarn-col');
        badge.style.left = Math.round(edge - h.left - hdr.clientLeft) + 'px';
        const b = badge.getBoundingClientRect();
        const clash = ['.fs-gt', '.fs-sig', '.fs-ghr'].some(sel => {
            const el = card.querySelector(sel); if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && b.left < r.right + 4 && b.right > r.left - 4;
        });
        if (clash) { badge.classList.remove('fs-lenwarn-col'); badge.style.left = ''; }
    });
}
function renderFooter() {
    const ready = STATE.groups.filter(g => g.state === 'pending' || g.state === 'error').length;
    const done = STATE.groups.filter(g => g.state === 'done').length;
    const sum = document.getElementById('fs-summary');
    // #529: "Add AcoustID/ISRC counts in the statusbar (footer) that are shown in
    // log". Counted over everything on the board — pool AND grouped — so the
    // number doesn't drop as recordings move into groups. Recordings never
    // looked up are excluded from the denominator rather than counted as zero,
    // matching the pool dots' unknown/absent distinction.
    const all = [...STATE.recordings.values()];
    const isrcUnconfirmed = all.filter(r => r.isrcsKnown && r.isrcSource === 'index' && !(r.isrcs && r.isrcs.length)).length;
    const isrcKnown = all.filter(r => r.isrcsKnown);
    const withIsrc = isrcKnown.filter(r => r.isrcs && r.isrcs.length).length;
    const acidKnown = all.filter(r => r.acoustids != null);
    const withAcid = acidKnown.filter(r => r.acoustids.length).length;
    const idPart = (label, n, known, total) => {
        if (!known) return '<span class="fs-idstat fs-idstat-none" data-tip="' + label + 's not looked up yet">' + label + ' —</span>';
        const pending = total - known;
        const unconf = label === 'ISRC' ? isrcUnconfirmed : 0;
        return '<span class="fs-idstat" data-tip="' + n + ' of ' + known + ' checked recording' + (known === 1 ? ' has' : 's have') + ' an ' + label
            + (pending ? '\n- ' + pending + ' not looked up yet' : '')
            + (unconf ? '\n- ' + unconf + ' with none in the search index only, which lags: not checked against the recording' : '')
            + '"><b>' + n + '</b>/' + known + ' ' + label + (pending || unconf ? '*' : '') + '</span>';
    };
    if (sum) sum.innerHTML = '<b>' + STATE.groups.length + '</b> group' + (STATE.groups.length === 1 ? '' : 's') + ' · <b>' + ready + '</b> ready' + (done ? ' · <b>' + done + '</b> merged' : '') + ' · <b>' + STATE.poolOrder.length + '</b> in pool'
        + ' · ' + idPart('ISRC', withIsrc, isrcKnown.length, all.length)
        + ' · ' + idPart('AcoustID', withAcid, acidKnown.length, all.length);
    const btn = document.getElementById('fs-mergeall');
    // #529: the lightning bolt belongs to Auto-match alone; this is a merge.
    if (btn) { btn.disabled = ready === 0; btn.innerHTML = MERGE_MARK + ' Merge All (' + ready + ') →'; }
}
function renderAll() { renderPool(); renderGroups(); renderFooter(); }

// _scopeBaseLabel remembers the scope text on its own, so later additions (the
// RG-edition count) can't compound by re-reading and re-appending the DOM text.
// #529 (majkinetor): "it's not clear loading is happening - make it flashing in
// the title" — a pulsing indicator next to the title for as long as ANY async
// operation is in flight. Ref-counted, so overlapping operations (seeding while
// the RG lookup runs) don't clear it early.
let _busyCount = 0, _busyLabel = '';
function renderBusy() {
    const e = document.getElementById('fs-busy'); if (!e) return;
    if (_busyCount > 0) { e.textContent = '⏳ ' + (_busyLabel || 'working…'); e.style.display = ''; }
    else { e.style.display = 'none'; e.textContent = ''; }
}
// A SEPARATE indicator from the _busyCount one on purpose. Background work must
// not participate in that counter: maybeAutoMatchOnOpen waits for it to drain,
// so counting a long prefetch there would stall auto-match — and #529 asked for
// this explicitly ("should not block from working").
let _bgLabel = '';
function setBgTask(text) {
    _bgLabel = text || '';
    const e = document.getElementById('fs-bgtask'); if (!e) return;
    if (_bgLabel) {
        e.innerHTML = '<span class="fs-bgtext">' + escapeHtml(_bgLabel) + '</span>'
            + '<span class="fs-bgstop" data-tip="Stop loading">✕</span>';
        e.style.display = '';
    } else { e.style.display = 'none'; e.innerHTML = ''; }
}
// #529 (majkinetor): "Provide a way to stop ongoing fetching". Background work
// runs in loops that can span hundreds of requests; there was no way out but
// closing the page. Every such loop captures the epoch it started in and stops
// as soon as it changes, so cancelling takes effect at the next request rather
// than needing an abortable transport.
// Cancelling has to STICK. renderGroups kicks the prefetch on every render, and
// the prefetch re-queues itself while anything is still missing, so a plain
// "stop this loop" was undone by the very next repaint (#529: "after hitting
// [x] button it keeps coming back"). Automatic background work stays off until
// the user asks for something explicitly.
let _bgEpoch = 0, _bgStopped = false;
function bgAlive(epoch) { return epoch === _bgEpoch && !_bgStopped; }
function resumeBackground(why) {
    if (!_bgStopped) return;
    _bgStopped = false;
    Log.info('Background loading re-enabled (' + why + ')');
}
function cancelBackground() {
    _bgEpoch++;
    _bgStopped = true;
    setBgTask('');
    clearNetTrouble();
    Log.warn('Background loading stopped — what already arrived is kept; it will not restart by itself');
}
function busyStart(label) { _busyCount++; if (label) _busyLabel = label; renderBusy(); }
function busyEnd() { _busyCount = Math.max(0, _busyCount - 1); if (_busyCount === 0) _busyLabel = ''; renderBusy(); }

// #529 (majkinetor): "acoustic id still not fully fetched … no dot in the pool
// is lighted". AcoustIDs used to be looked up ONLY inside Auto-match, so a
// freshly seeded pool always showed them as unknown even though the data was
// one batched request away. Seeding now kicks this off in the background —
// batched (50 MBIDs/request), non-blocking, re-rendering as results land.
// Background enrichment re-renders as results land, which REPLACES pool card
// nodes. A native dblclick only fires when both clicks hit the same element, so
// a render landing between a user's two clicks silently swallows the gesture —
// the same failure mode that made Merge All look dead (#529). Coalesce
// background renders and hold them off briefly after any pool click.
let _bgRenderTimer = null, _lastPoolClick = 0;
const POOL_CLICK_GRACE = 700;   // ms after a pool click during which we never re-render
function scheduleBackgroundRender() {
    if (!FUSION_OPEN) return;
    clearTimeout(_bgRenderTimer);
    // Re-check the grace window at FIRE time, not just when scheduling: a timer
    // armed before the user clicked would otherwise still fire mid-gesture and
    // swallow their double-click. Keep pushing it out while clicks keep coming.
    const fire = () => {
        const since = Date.now() - _lastPoolClick;
        if (since < POOL_CLICK_GRACE) { _bgRenderTimer = setTimeout(fire, POOL_CLICK_GRACE - since); return; }
        if (FUSION_OPEN) renderAll();
    };
    _bgRenderTimer = setTimeout(fire, 250);
}
function enrichPoolInBackground(recordings) {
    if (!recordings.length) return;
    if (SETTINGS.acoustidEnrich === false) { Log.info('AcoustID lookup disabled in options — skipping background lookup'); return; }
    if (recordings.length > SETTINGS.acoustidPoolCap) { Log.warn('Skipping AcoustID lookup — ' + recordings.length + ' recordings exceeds the safety cap (' + SETTINGS.acoustidPoolCap + ')'); return; }
    Log.info('Fetching AcoustIDs for ' + recordings.length + ' recording(s) in batches of ' + ACOUSTID_BATCH + ' (~' + Math.ceil(recordings.length / ACOUSTID_BATCH) + ' request(s))');
    busyStart('fetching AcoustIDs…');
    // AcoustIDs are batched (50 MBIDs per request) so they are cheap to do up
    // front. Pending edits are one request per recording, so they wait until
    // something is actually grouped — see onAutoMatch and mergeGroup.
    enrichAcoustIds(recordings, 4, scheduleBackgroundRender)
        .catch(e => Log.error('Background AcoustID lookup failed: ' + e.message))
        .finally(() => { busyEnd(); scheduleBackgroundRender(); });
}

let _scopeBaseLabel = '';
function setScopeLabel(text) { _scopeBaseLabel = text; const e = document.getElementById('fs-scope'); if (e) e.textContent = text; }
// append to the REMEMBERED base, never to whatever is currently rendered —
// otherwise re-running this would keep tacking the suffix on again and again.
// #529: "it would be cool to have some progress in 'Loading ..' (page 1, 2...)"
// The total is unknown until the first page comes back, so page 1 reports bare
// and every later page can say how many there are in total.
function seedPageProgress(page, totalPages, loaded, total) {
    const of = totalPages ? ' of ' + totalPages : '';
    const got = total ? ' — ' + loaded + ' of ' + total + ' recordings so far' : '';
    setScopeLabel('Loading… page ' + page + of + got);
}
function setScopeSuffix(suffix) { const e = document.getElementById('fs-scope'); if (e) e.textContent = _scopeBaseLabel + suffix; }

async function onAutoMatch(byPosition) {
    byPosition = byPosition === true;
    const btn = document.getElementById('fs-automatch'); if (!btn) return;
    const cutoff = byPosition ? 'position' : SETTINGS.matchCutoff;
    const how = byPosition ? 'by position' : 'at the "' + SETTINGS.matchCutoff + '" cutoff';
    btn.disabled = true; const orig = btn.textContent;
    btn.textContent = 'Matching…';
    busyStart('matching…');
    try {
        const poolRecs = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
        Log.info('Match starting on ' + poolRecs.length + ' pool recording(s), ' + (byPosition ? 'by position' : 'cutoff=' + SETTINGS.matchCutoff));
        poolRecs.forEach(r => Log.info('  pool: ' + describeRecordingForLog(r)));
        // Enrich EVERY known recording, not just ungrouped ones (#529): members
        // already sitting in a group were previously never looked up, so two rows
        // sharing an AcoustID could show one value and one blank.
        const allRecs = [...STATE.recordings.values()];
        btn.textContent = 'Matching… (ISRCs)';
        await enrichIsrcs(allRecs, 2, (done, total) => { btn.textContent = 'Matching… (ISRC ' + done + '/' + total + ')'; });
        if (SETTINGS.acoustidEnrich) {
            if (allRecs.length <= SETTINGS.acoustidPoolCap) {
                Log.info('Looking up AcoustIDs for ' + allRecs.length + ' recording(s) (batched, api.acoustid.org)…');
                await enrichAcoustIds(allRecs, 4, (done, total) => { btn.textContent = 'Matching… (AcoustID ' + done + '/' + total + ')'; });
            } else Log.warn('Skipping AcoustID lookup — ' + allRecs.length + ' recordings exceeds the cap (' + SETTINGS.acoustidPoolCap + ')');
        }
        btn.textContent = 'Matching… (comparing)';
        let groupings = autoMatch(poolRecs, SETTINGS.lengthToleranceMs, cutoff);
        // Only now, for the few recordings actually grouped, is a pending-edit
        // lookup worth a request each. A group containing one is dissolved: its
        // members go back to the pool rather than being silently merged.
        const grouped = [...new Set(groupings.flatMap(g => g.memberGids))].map(g => STATE.recordings.get(g)).filter(Boolean);
        if (grouped.length) {
            btn.textContent = 'Matching… (pending edits)';
            await enrichPendingEdits(grouped, 2, (done, total) => { btn.textContent = 'Matching… (pending ' + done + '/' + total + ')'; });
            const before = groupings.length;
            groupings = groupings.filter(g => {
                const bad = g.memberGids.map(x => STATE.recordings.get(x)).filter(r => r && r.editsPending);
                if (bad.length) Log.warn('Dropped a proposed group — pending edit(s) on: ' + bad.map(r => r.title).join(', '));
                return !bad.length;
            });
            if (before !== groupings.length) Log.warn((before - groupings.length) + ' proposed group(s) dropped because a member has pending edits');
        }
        Log.info('Match formed ' + groupings.length + ' group(s) from ' + poolRecs.length + ' pool recording(s)');
        groupings.forEach(g => {
            Log.info('  formed group ' + g.id + ' — confidence=' + g.confidence + ' signals=[' + g.signals.join(',') + ']');
            g.memberGids.forEach(gid => Log.info('    ' + gid + (gid === g.target ? ' (target)' : '') + ': ' + describeRecordingForLog(STATE.recordings.get(gid))));
        });
        for (const g of groupings) {
            g.memberGids.forEach(gid => { const i = STATE.poolOrder.indexOf(gid); if (i !== -1) STATE.poolOrder.splice(i, 1); });
            STATE.groups.push(g);
        }
        // Short in the header (it is one line), full sentence in the tooltip.
        if (!groupings.length) {
            showNotice('none',
                'Match found nothing to group in ' + poolRecs.length + ' pool recording(s) ' + how + '.'
                + (byPosition ? ' Lengths and artists must agree too.' : ' Try a looser cutoff, or group by hand.'),
                'match: nothing matched ' + (byPosition ? 'by position' : 'at "' + SETTINGS.matchCutoff + '"'));
        } else {
            const recs = groupings.reduce((a, g) => a + g.memberGids.length, 0);
            showNotice('ok',
                'Match formed ' + groupings.length + ' group' + (groupings.length === 1 ? '' : 's')
                + ' from ' + recs + ' recording' + (recs === 1 ? '' : 's') + ' ' + how + '.',
                'match: +' + groupings.length + ' group' + (groupings.length === 1 ? '' : 's'));
        }
        renderAll();
    } finally { busyEnd(); btn.disabled = false; btn.textContent = orig; }
}
// #529 follow-up (majkinetor, live): "I should be able to add release URL and
// release group URL to get all recordings from them" — detect the entity type
// from the pasted URL's path and bulk-add every recording it resolves to,
// rather than always assuming a bare recording.
function parseAddInput(s) {
    s = String(s || '').trim();
    const mbid = parseMbidFromInput(s);
    if (!mbid) return null;
    let type = 'recording';
    if (/\/release-group\//.test(s)) type = 'release-group';
    else if (/\/release\//.test(s)) type = 'release';
    else if (/\/artist\//.test(s)) type = 'artist';
    return { type, mbid };
}
async function onAddByMbid() {
    const input = document.getElementById('fs-add-input'); if (!input) return;
    const parsed = parseAddInput(input.value);
    if (!parsed) { Log.warn('Add: no MBID found in "' + input.value + '"'); return; }
    const { type, mbid } = parsed;
    if (type === 'recording') {
        if (STATE.recordings.has(mbid)) { Log.warn('Add: ' + mbid + ' is already in the pool or a group'); input.value = ''; return; }
        Log.info('Adding recording ' + mbid + '…');
        busyStart('adding recording…');
        const rec = await fetchRecordingByGid(mbid).finally(() => busyEnd());
        if (!rec) { Log.error('Add: could not fetch recording ' + mbid + ' (is it a recording MBID?)'); return; }
        addToPool(rec); input.value = ''; renderAll(); enrichPoolInBackground([rec]);
        return;
    }
    if (type === 'artist') { Log.warn('Add: pasting an artist URL/MBID isn\'t supported — open Fusion from that artist\'s Recordings tab instead'); return; }
    Log.info('Adding all recordings from ' + type + ' ' + mbid + '…');
    busyStart('adding ' + type + '…');
    try {
    const { recordings } = type === 'release' ? await fetchReleaseRecordings(mbid) : await fetchRGRecordings(mbid);
    let added = 0;
    const fresh = recordings.filter(r => addToPool(r)); added = fresh.length;
    Log.info('Added ' + added + ' new recording(s) from that ' + type);
    enrichPoolInBackground(fresh);
    input.value = '';
    } finally { busyEnd(); }
    renderAll();
}
// #529 (majkinetor): "include all details on the release in RG (year, format
// etc.)" — a bare title+date made near-identical reissues impossible to tell
// apart. inc=releases+media carries format/track-count/country/status too, at
// no extra request cost.
function mediaSummary(rel) {
    const media = rel.media || [];
    if (!media.length) return '';
    const counts = new Map();
    media.forEach(m => { const f = m.format || 'unknown'; counts.set(f, (counts.get(f) || 0) + 1); });
    return [...counts].map(([f, n]) => (n > 1 ? n + '×' : '') + f).join(' + ');
}
function describeEdition(rel) {
    const bits = [];
    if (rel.date) bits.push(rel.date);
    const fmt = mediaSummary(rel); if (fmt) bits.push(fmt);
    const tracks = (rel.media || []).reduce((n, m) => n + (m['track-count'] || 0), 0) || rel['track-count'];
    if (tracks) bits.push(tracks + ' track' + (tracks === 1 ? '' : 's'));
    if (rel.country) bits.push(rel.country);
    if (rel.status && rel.status !== 'Official') bits.push(rel.status);
    return rel.title + (bits.length ? ' — ' + bits.join(' · ') : '');
}
// #529 (majkinetor): "RG button on release doesn't show immediately so it's not
// obvious that there is anything there" — this takes two sequential WS2 calls,
// so show the control up front in a disabled "checking…" state rather than
// having it pop into existence seconds later (or never).
async function maybeShowRGDropdown(releaseMbid) {
    const sel = document.getElementById('fs-rg-editions'); if (!sel) return;
    const setPlaceholder = (text, show) => {
        sel.innerHTML = '<option value="">' + escapeHtml(text) + '</option>';
        sel.disabled = true;
        sel.style.display = show ? '' : 'none';
    };
    setPlaceholder('⏳ Checking release group for other editions…', true);
    Log.info('Checking release group for sibling editions…');
    busyStart('checking release group…');
    try {
    const j = await wsGet('/ws/2/release/' + releaseMbid + '?inc=release-groups&fmt=json');
    const rgId = j && j['release-group'] && j['release-group'].id;
    if (!rgId) { Log.warn('Could not resolve this release\'s release group — edition loader unavailable'); setPlaceholder('', false); return; }
    const rgRels = await wsGet('/ws/2/release-group/' + rgId + '?inc=releases+media&fmt=json');
    if (!rgRels) { setPlaceholder('⚠ Could not load release group editions', true); sel.disabled = true; return; }
    const siblings = ((rgRels.releases) || []).filter(r => r.id !== releaseMbid);
    if (!siblings.length) {
        Log.info('Release group has no other editions');
        setPlaceholder('No other editions in this release group', true);
        return;
    }
    siblings.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    sel.innerHTML = '<option value="">+ Load recordings from RG edition (' + siblings.length + ') ▾</option>'
        + siblings.map(r => '<option value="' + r.id + '">' + escapeHtml(describeEdition(r)) + '</option>').join('');
    sel.disabled = false;
    sel.style.display = '';
    Log.info('Release group has ' + siblings.length + ' other edition(s): ' + siblings.map(r => describeEdition(r)).join(' | '));
    setScopeSuffix(' — release group has ' + siblings.length + ' other edition' + (siblings.length === 1 ? '' : 's'));
    } finally { busyEnd(); }
}
async function onLoadRgEdition(e) {
    const relMbid = e.target.value; if (!relMbid) return;
    Log.info('Loading recordings from edition ' + relMbid + '…');
    busyStart('loading edition…');
    try {
    const { recordings } = await fetchReleaseRecordings(relMbid);
    let added = 0;
    const freshEd = recordings.filter(r => addToPool(r)); added = freshEd.length;
    Log.info('Added ' + added + ' new recording(s) from that edition');
    enrichPoolInBackground(freshEd);
    e.target.value = '';
    } finally { busyEnd(); }
    renderAll();
}

// #529 follow-up (majkinetor, live): a recording needs to move pool→group,
// group→pool, AND group→group by drag, and dropping anywhere in the target
// column (not just on a narrow strip) should work. STATE._dragSrc tracks
// where the dragged recording came FROM (null groupId = the pool) so drop
// handlers can move it out of there before placing it wherever it landed.
function moveDraggedTo(targetGroupId) {
    const src = STATE._dragSrc; if (!src) return;
    if (src.groupId === targetGroupId) { STATE._dragSrc = null; return; }
    let ok = true;
    if (src.groupId == null) { ok = addToGroup(src.gid, targetGroupId); }
    else {
        const rec = STATE.recordings.get(src.gid);
        const ng = findGroup(targetGroupId);
        if (ng && videoConflict(ng, rec)) {
            Log.warn('Refused to move ' + src.gid + ' into group ' + targetGroupId + ' — video/audio mismatch');
            ok = false;
        } else {
            const g = findGroup(src.groupId);
            if (g) { const i = g.memberGids.indexOf(src.gid); if (i !== -1) g.memberGids.splice(i, 1); dissolveOrRefresh(g); }
            if (ng) { ng.memberGids.push(src.gid); refreshGroupMeta(ng); Log.info('Moved ' + src.gid + ' into group ' + targetGroupId); }
        }
    }
    STATE.selected = null; STATE._dragSrc = null;
    if (ok) STATE.activeGroupId = targetGroupId;
}
function moveDraggedToPool() {
    const src = STATE._dragSrc; if (!src || src.groupId == null) return;
    returnToPool(src.gid, src.groupId);
    STATE._dragSrc = null;
}
function moveDraggedToNewGroup() {
    const src = STATE._dragSrc; if (!src) return;
    let g;
    if (src.groupId == null) g = createGroupWithMember(src.gid);
    else {
        const old = findGroup(src.groupId);
        if (old) { const i = old.memberGids.indexOf(src.gid); if (i !== -1) old.memberGids.splice(i, 1); dissolveOrRefresh(old); }
        g = { id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: [src.gid], confidence: 'manual', signals: [], signalsAll: [], target: src.gid, state: 'pending', error: null, editNote: null, editing: false };
        STATE.groups.push(g);
    }
    STATE.selected = null; STATE._dragSrc = null; if (g) STATE.activeGroupId = g.id;
}
function targetGroupForQuickAdd() {
    if (STATE.activeGroupId && findGroup(STATE.activeGroupId)) return STATE.activeGroupId;
    return STATE.groups.length ? STATE.groups[STATE.groups.length - 1].id : null;
}
function wireDelegatedEvents() {
    const poolBody = document.getElementById('fs-pool-body');
    const groupsBody = document.getElementById('fs-groups-body');
    const poolCol = document.querySelector('.fs-pool');
    const groupsCol = document.querySelector('.fs-groups');

    poolBody.addEventListener('click', e => {
        const card = e.target.closest('.fs-pcard'); if (!card) return;
        const gid = card.dataset.gid;
        _lastPoolClick = Date.now();
        if (e.target.dataset.act === 'pool-remove') { removeFromPoolPermanently(gid); renderAll(); return; }
        STATE.selected = STATE.selected === gid ? null : gid;
        // Real bug (majkinetor: "Merge all is unclickable"): a full renderPool()
        // here replaces every card's DOM node, including the one just clicked —
        // and a native dblclick event only fires when BOTH clicks land on the
        // SAME element. Replacing it after the first click silently killed every
        // double-click, so no group was ever created and Merge All stayed
        // permanently disabled. A plain class toggle keeps the node identity.
        poolBody.querySelectorAll('.fs-pcard.fs-selected').forEach(el => el.classList.remove('fs-selected'));
        if (STATE.selected) card.classList.add('fs-selected');
    });
    // #529 follow-up: "Let double click on recording in a pool make it added
    // to the current group. Group is selectable. If none is selected last
    // group is used or new one is created if there isn't any."
    poolBody.addEventListener('dblclick', e => {
        const card = e.target.closest('.fs-pcard'); if (!card) return;
        const gid = card.dataset.gid;
        const targetId = targetGroupForQuickAdd();
        if (targetId) { if (addToGroup(gid, targetId)) STATE.activeGroupId = targetId; }
        else { const g = createGroupWithMember(gid); if (g) STATE.activeGroupId = g.id; }
        renderAll();
    });
    poolBody.addEventListener('dragstart', e => {
        const card = e.target.closest('.fs-pcard'); if (!card) return;
        STATE._dragSrc = { gid: card.dataset.gid, groupId: null };
        try { e.dataTransfer.setData('text/plain', card.dataset.gid); e.dataTransfer.effectAllowed = 'move'; } catch (ex) {}
    });
    // whole pool column accepts a drop (from a group) to return a recording —
    // one listener on the outer column; events from its children bubble up.
    poolCol.addEventListener('dragover', e => { if (STATE._dragSrc && STATE._dragSrc.groupId != null) e.preventDefault(); });
    poolCol.addEventListener('drop', e => { if (!STATE._dragSrc || STATE._dragSrc.groupId == null) return; e.preventDefault(); moveDraggedToPool(); renderAll(); });

    groupsBody.addEventListener('dragstart', e => {
        const row = e.target.closest('.fs-grow'); if (!row) return;
        const card = e.target.closest('.fs-gcard'); if (!card) return;
        STATE._dragSrc = { gid: row.dataset.gid, groupId: card.dataset.gid };
        try { e.dataTransfer.setData('text/plain', row.dataset.gid); e.dataTransfer.effectAllowed = 'move'; } catch (ex) {}
    });
    groupsBody.addEventListener('click', e => {
        if (e.target.closest('#fs-newgroup')) {
            if (STATE.selected && STATE.poolOrder.includes(STATE.selected)) { const g = createGroupWithMember(STATE.selected); if (g) STATE.activeGroupId = g.id; STATE.selected = null; renderAll(); }
            return;
        }
        const act = e.target.dataset.act;
        const row = e.target.closest('.fs-grow');
        const card = e.target.closest('.fs-gcard');
        if (!card) return;
        // click the card's header (but not its Merge button) to make it the
        // "current" group for double-click-to-add and empty-zone drops.
        if (!act && e.target.closest('.fs-ghdr') && !e.target.closest('.fs-mbtn')) {
            // The standing "drop from pool…" line is gone (#529: spammy), so the
            // click-to-add it carried moves here: with a pool recording selected,
            // clicking a group adds it; otherwise the click just makes the group
            // current, as before.
            if (STATE.selected && STATE.poolOrder.includes(STATE.selected)) {
                if (addToGroup(STATE.selected, card.dataset.gid)) STATE.activeGroupId = card.dataset.gid;
                STATE.selected = null; renderAll(); return;
            }
            STATE.activeGroupId = STATE.activeGroupId === card.dataset.gid ? null : card.dataset.gid;
            renderGroups(); return;
        }
        if (act === 'toggle-releases' && row) { toggleReleaseDetails(row.dataset.gid); return; }
        if (act === 'toggle-ids' && row) { toggleIdList(row.dataset.gid, e.target.dataset.kind); return; }
        if (act === 'toggle-all-details') { toggleAllDetails(card.dataset.gid); return; }
        if (act === 'toggle-card') {
            const id = card.dataset.gid;
            if (STATE.collapsedGroups.has(id)) STATE.collapsedGroups.delete(id); else STATE.collapsedGroups.add(id);
            renderGroups(); return;
        }
        if (act === 'set-target' && row) { const g = findGroup(card.dataset.gid); if (g) { g.target = row.dataset.gid; renderGroups(); } return; }
        if (act === 'return' && row) { returnToPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'remove-both' && row) { removeFromGroupAndPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'merge-group') { mergeGroup(findGroup(card.dataset.gid)); return; }
        if (act === 'refresh-acoustid') { refreshGroupAcoustIds(findGroup(card.dataset.gid)); return; }
        if (act === 'delete-group') { deleteGroup(card.dataset.gid); renderAll(); return; }
        if (act === 'edit-note') { const g = findGroup(card.dataset.gid); if (g) { g.editing = true; renderGroups(); const ta = groupsBody.querySelector('.fs-gcard[data-gid="' + g.id + '"] .fs-note-ta'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } } return; }
        if (act === 'note-save') {
            const g = findGroup(card.dataset.gid); if (!g) return;
            const ta = card.querySelector('.fs-note-ta');
            const val = ta ? ta.value.trim() : '';
            // storing the auto note verbatim would falsely read as "custom"
            g.editNote = (!val || val === autoEditNote(g)) ? null : val;
            g.editing = false;
            Log.info('Edit note for group ' + g.id + (g.editNote ? ' set: ' + g.editNote.replace(/\n/g, ' ¶ ') : ' reset to auto'));
            renderGroups(); return;
        }
        if (act === 'note-cancel') { const g = findGroup(card.dataset.gid); if (g) { g.editing = false; renderGroups(); } return; }
        if (act === 'note-clear') { const g = findGroup(card.dataset.gid); if (g) { g.editNote = null; g.editing = false; Log.info('Edit note for group ' + g.id + ' reset to auto'); renderGroups(); } return; }
    });
    // "entire zone" drag&drop (#529 follow-up): dropping anywhere over a group
    // card adds to THAT group; dropping on #fs-newgroup OR on empty background
    // (not over any card) creates a new group — not just a narrow strip. One
    // listener on the outer column; children's events bubble up to it.
    groupsCol.addEventListener('dragover', e => { if (STATE._dragSrc) e.preventDefault(); });
    groupsCol.addEventListener('dragover', e => {
        const card = e.target.closest && e.target.closest('.fs-gcard');
        groupsCol.querySelectorAll('.fs-dragover').forEach(x => { if (x !== card) x.classList.remove('fs-dragover'); });
        if (card) card.classList.add('fs-dragover');
    });
    groupsCol.addEventListener('dragleave', e => {
        const card = e.target.closest && e.target.closest('.fs-gcard');
        if (card && !card.contains(e.relatedTarget)) card.classList.remove('fs-dragover');
    });
    groupsCol.addEventListener('drop', e => {
        groupsCol.querySelectorAll('.fs-dragover').forEach(x => x.classList.remove('fs-dragover'));
        if (!STATE._dragSrc) return;
        e.preventDefault();
        const card = e.target.closest('.fs-gcard');
        if (card) moveDraggedTo(card.dataset.gid);
        else moveDraggedToNewGroup();
        renderAll();
    });
}

function openSettings(anchor) {
    document.getElementById('fs-settings')?.remove();
    const s = el('div', 'fs-settings'); s.id = 'fs-settings';
    s.innerHTML = mbuCfgHeader({ script: 'fusion', name: 'Fusion', version: VERSION, icon: ICON, log: true })
        + '<label class="fs-opt"><input type="checkbox" id="fs-opt-acoustid"> Look up AcoustIDs (acoustid.org, batched)</label>'
        + '<label class="fs-opt" data-tip="Run Match once the pool has loaded\nInstead of waiting for you to press it"><input type="checkbox" id="fs-opt-automatch"> Match on open</label>'
        + '<label class="fs-opt" data-tip="Read the releases of every grouped recording at once\nAs soon as a group forms, so opening a row is instant. It runs in the background, and the stop button in the header halts it.\n⚠ One request per grouped recording: off by default, as seeding already makes many"><input type="checkbox" id="fs-opt-prefetch"> Preload group release details in the background</label>'
        + '<label class="fs-opt">Length tolerance <input type="number" id="fs-opt-tol" min="0" max="60"> s</label>'
        + '<label class="fs-opt" data-tip="Match never groups two recordings whose known lengths differ more than this\nWhatever else matches. Grouping by hand is not affected.">Match never groups if lengths differ by more than <input type="number" id="fs-opt-gross" min="5" max="600"> s</label>';
    document.body.appendChild(s);
    mbuControls(s);   // the shared − n + steppers
    const r = anchor.getBoundingClientRect();
    s.style.top = (r.bottom + 6) + 'px'; s.style.right = '14px';
    if (r.bottom + 6 + s.offsetHeight > window.innerHeight - 8) { s.style.top = 'auto'; s.style.bottom = (window.innerHeight - r.top + 6) + 'px'; }   // #695: from the corner launcher, open upward
    s.querySelector('#fs-opt-acoustid').checked = SETTINGS.acoustidEnrich !== false;
    s.querySelector('#fs-opt-automatch').checked = !!SETTINGS.autoMatchOnOpen;
    s.querySelector('#fs-opt-tol').value = Math.round(SETTINGS.lengthToleranceMs / 1000);
    s.querySelector('#fs-opt-gross').value = Math.round((SETTINGS.grossLengthMs != null ? SETTINGS.grossLengthMs : 30000) / 1000);
    s.querySelector('#fs-opt-prefetch').checked = !!SETTINGS.prefetchGroupReleases;
    s.querySelector('#fs-opt-acoustid').onchange = e => { SETTINGS.acoustidEnrich = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-automatch').onchange = e => { SETTINGS.autoMatchOnOpen = e.target.checked; saveSettings(); Log.info('Match on open: ' + (SETTINGS.autoMatchOnOpen ? 'on' : 'off')); };
    s.querySelector('#fs-opt-prefetch').onchange = e => { SETTINGS.prefetchGroupReleases = e.target.checked; saveSettings(); Log.info('Background release prefetch: ' + (SETTINGS.prefetchGroupReleases ? 'on' : 'off')); if (SETTINGS.prefetchGroupReleases) prefetchGroupReleases(); };
    s.querySelector('#fs-opt-tol').onchange = e => { SETTINGS.lengthToleranceMs = Math.max(0, Number(e.target.value) || 0) * 1000; saveSettings(); };
    s.querySelector('#fs-opt-gross').onchange = e => { SETTINGS.grossLengthMs = Math.max(5, Number(e.target.value) || 30) * 1000; saveSettings(); Log.info('Gross-length guard set to ' + Math.round(SETTINGS.grossLengthMs / 1000) + 's'); };
    s.querySelector('.mbu-cfg-log').onclick = () => { s.remove(); openLog(); };
    const off = e => { if (!s.contains(e.target) && !anchor.contains(e.target)) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    // Escape closes the popup only (capture, so the main window's own Escape doesn't also fire)
    const esc = e => {
        if (!s.isConnected) { document.removeEventListener('keydown', esc, true); return; }
        if (e.key !== 'Escape') return;
        e.stopPropagation(); s.remove();
        document.removeEventListener('keydown', esc, true); document.removeEventListener('mousedown', off);
    };
    document.addEventListener('keydown', esc, true);
}

// #529 follow-up: "Window should be movable and maximizable" — remembered
// across opens the same way apollo_editor's log popup remembers its position.
const WINSTATE_KEY = 'fusion.winstate';
function loadWinState() { try { return JSON.parse(GM_getValue(WINSTATE_KEY, '{}')); } catch (e) { return {}; } }
function saveWinState(patch) { try { GM_setValue(WINSTATE_KEY, JSON.stringify(Object.assign(loadWinState(), patch))); } catch (e) {} }
function applyWinState(cons) {
    const st = loadWinState();
    if (st.maximized) { cons.classList.add('fs-maximized'); const mb = document.getElementById('fs-max'); if (mb) { mb.textContent = '❐'; mb.dataset.tip = 'Restore'; } return; }
    if (st.left != null && st.top != null) { cons.style.position = 'fixed'; cons.style.left = st.left + 'px'; cons.style.top = st.top + 'px'; cons.style.margin = '0'; }
    if (st.width != null) cons.style.width = st.width + 'px';
    if (st.height != null) cons.style.height = st.height + 'px';
}
// glyphs/behaviour match group_therapy's maximize control (⛶ / ❐, gt-cons-x style)
function toggleMaximize(cons, btn) {
    const nowMax = !cons.classList.contains('fs-maximized');
    cons.classList.toggle('fs-maximized', nowMax);
    if (nowMax) { cons._savedW = cons.style.width; cons._savedH = cons.style.height; cons.style.width = ''; cons.style.height = ''; }
    else { cons.style.width = cons._savedW || ''; cons.style.height = cons._savedH || ''; }
    if (btn) { btn.textContent = nowMax ? '❐' : '⛶'; btn.dataset.tip = nowMax ? 'Restore' : 'Maximize'; }
    saveWinState({ maximized: nowMax });
}
function wireWindowChrome(cons, hdr, maxBtn) {
    applyWinState(cons);
    maxBtn.onclick = () => toggleMaximize(cons, maxBtn);
    hdr.addEventListener('mousedown', e => {
        if (e.target.closest('button, .fs-cfgbtn, .fs-x, select, input')) return;
        if (cons.classList.contains('fs-maximized')) return;
        const rect = cons.getBoundingClientRect();
        cons.style.position = 'fixed'; cons.style.left = rect.left + 'px'; cons.style.top = rect.top + 'px'; cons.style.margin = '0';
        const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
        const mv = ev => {
            const nl = Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox));
            const nt = Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy));
            cons.style.left = nl + 'px'; cons.style.top = nt + 'px';
        };
        const up = () => {
            document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
            const r2 = cons.getBoundingClientRect();
            saveWinState({ left: r2.left, top: r2.top, width: r2.width, height: r2.height, maximized: false });
        };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    // resize:both is native CSS (see fsStyle) — just persist the size afterward
    new ResizeObserver(() => { if (!cons.classList.contains('fs-maximized')) saveWinState({ width: cons.offsetWidth, height: cons.offsetHeight }); }).observe(cons);
}

let FUSION_OPEN = false;
// Escape closes the TOP-MOST thing only: if the log window (or the settings
// popup) is open it handles its own Escape, and the main window stays put —
// otherwise one keypress tore down everything at once.
function _fsEscHandler(e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('mbu-logpop') || document.getElementById('fs-settings')) return;
    closeFusion();
}
function buildShell() {
    document.getElementById('fs-overlay')?.remove();
    const overlay = el('div', 'fs-overlay'); overlay.id = 'fs-overlay';
    // the cutoff's tip is the levels' table, the chosen one marked and the looser ones dimmed
    // (majkinetor: "add cutoff table with meanings")
    const CUTOFF_MEANS = { strict: 'a shared ISRC or AcoustID', normal: 'or the title and the artist, with a close length', loose: 'or the title, with a close length or the same artist' };
    const cutoffTip = () => {
        const cur = MATCH_CUTOFFS.indexOf(SETTINGS.matchCutoff);
        return 'How strict Match is: it groups recordings on\n'
            + MATCH_CUTOFFS.map((c, i) => '{' + TIER_COLORS[c] + (i === cur ? ' on' : i > cur ? ' off' : '') + '} ' + c[0].toUpperCase() + c.slice(1) + ': ' + CUTOFF_MEANS[c]).join('\n');
    };
    overlay.innerHTML = '<div class="fs-cons" id="fs-cons">'
        + '<div class="fs-hdr" id="fs-hdr"><div class="fs-title">' + ICON + ' Fusion — Merge Recordings</div><span class="fs-busy" id="fs-busy" style="display:none" data-tip="Open the activity log"></span><span class="fs-bgtask" id="fs-bgtask" style="display:none" data-tip="Open the activity log"></span><span class="fs-netbanner" id="fs-netbanner" style="display:none"></span><div class="fs-scope" id="fs-scope" data-tip="Open the activity log">…</div><div class="fs-sp"></div>'
        + '<button class="fs-cons-x" id="fs-max" type="button" data-tip="Maximize or restore">⛶</button><button class="fs-cons-x" id="fs-cfg" type="button" data-tip="Fusion\nOptions, the log, help">' + MBU_CFG_ICON + '</button><button class="fs-cons-x" id="fs-close" type="button" data-tip="Close">✕</button></div>'
        + '<div class="fs-ctrl"><select id="fs-rg-editions" style="display:none;"><option value="">+ Load recordings from RG edition ▾</option></select>'
        + '<input type="text" id="fs-add-input" placeholder="paste a recording, release, or release-group MBID|URL…" data-tip="Add recordings to the pool\nPaste: a recording’s, release’s or release group’s MBID, or its MusicBrainz URL, adds its recordings at once">'
        + '<div class="fs-sp"></div><div class="fs-legend">'
        // the cutoff as Apollo's: a chip with the level's dot, a menu of the levels, their table in the tip; the
        // colour legend beside it went (majkinetor: "make fusion cutoff resemble the apollo's and remove [ ] strict …")
        + '<label class="fs-cutwrap" id="fs-cutwrap"><b>Cutoff</b><span class="fs-cutoff" id="fs-cutoff" tabindex="0" role="button">'
        + '<span class="fs-cutoff-dot"></span><span class="fs-cutoff-lbl"></span><span class="fs-cutoff-caret">▾</span></span></label></div>'
        + '<span class="fs-split"><button type="button" id="fs-automatch" class="fs-btn fs-primary">⚡ Match</button><button type="button" id="fs-matchmore" class="fs-btn fs-primary" data-tip="More ways to match">▾</button></span></div>'

        + '<div class="fs-body" id="fs-body"><div class="fs-col fs-pool"><div class="fs-colhdr">Pool <span class="fs-cnt" id="fs-pool-cnt">0</span><span class="fs-sp"></span><input type="text" id="fs-pool-filter" class="fs-poolfilter" placeholder="filter the pool…" data-tip="Filter by title, artist, release, ISRC or AcoustID\nMatch still looks at the whole pool."><span class="fs-pooltog" id="fs-pooltog" data-tip="Fold the pool away\nThe groups get the full width.">◀</span></div>'
        + '<div class="fs-poolsort">Sort <span class="fs-seg" id="fs-pool-sort"><button type="button" data-sort="added" data-tip="In the order they were added">Added</button><button type="button" data-sort="title" data-tip="By title, so the versions of one song sit together">Title</button><button type="button" data-sort="artist" data-tip="By artist, then title">Artist</button></span></div>'
        + '<div class="fs-colbody" id="fs-pool-body"></div></div>'
        + '<div class="fs-poolrail" id="fs-poolrail" data-tip="Show the pool again"><span class="fs-railarrow">▶</span><span class="fs-raillabel">POOL <span id="fs-rail-cnt">0</span></span></div>'
        + '<div class="fs-col fs-groups"><div class="fs-colhdr">Groups <span class="fs-cnt" id="fs-groups-cnt">0</span><span class="fs-subcnt" id="fs-groups-recs"></span><button type="button" id="fs-expandall-deep" class="fs-btn" data-tip="Expand every group and every release table\nAgain: collapse it all">⇲ All details</button><button type="button" id="fs-collapseall" class="fs-btn" data-tip="Collapse or expand every group card">▼ Collapse all</button><span class="fs-matchmsg" id="fs-matchmsg" style="display:none"></span><span class="fs-sp"></span><span class="fs-clearset">Clear: <button type="button" id="fs-clearboard" class="fs-btn fs-clearboard-btn" data-tip="Dissolve every group\nAll the recordings go back to the pool.">all</button><button type="button" id="fs-clearmerged" class="fs-btn fs-clearboard-btn" data-tip="Remove the groups already merged\nTheir recordings leave the board; the merged-away ones no longer exist in MusicBrainz.">merged</button></span></div>'
        + '<div class="fs-runsum" id="fs-runsum" style="display:none"></div><div class="fs-colbody" id="fs-groups-body"></div></div></div>'
        + '<div class="fs-ftr"><div class="fs-sum" id="fs-summary"></div><div class="fs-sp"></div>'
        + '<div class="fs-note">Merges submit directly in the background — no MB merge page involved</div>'
        + '<button type="button" id="fs-mergeall" class="fs-btn fs-primary">Merge All →</button></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeFusion(); });
    document.addEventListener('keydown', _fsEscHandler);
    document.getElementById('fs-close').onclick = closeFusion;
    document.getElementById('fs-cfg').onclick = () => openSettings(document.getElementById('fs-cfg'));
    // #529 (majkinetor): "remove Add button on MBID edit, it should be added on
    // paste" — pasting is the only realistic way to enter a 36-char MBID, so the
    // paste itself is the action. Deferred a tick because on paste the input's
    // value is still the OLD text; it updates after the event completes.
    // Enter still works for anything typed or edited by hand.
    const addInput = document.getElementById('fs-add-input');
    addInput.addEventListener('paste', () => setTimeout(() => onAddByMbid(), 0));
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAddByMbid(); });
    document.getElementById('fs-automatch').onclick = () => onAutoMatch();
    // #823: the Match submenu; Match by position runs only from here
    {
        const more = document.getElementById('fs-matchmore');
        more.onclick = () => {
            if (document.querySelector('.fs-match-menu')) { document.querySelectorAll('.fs-match-menu').forEach(m => m.remove()); return; }
            const m = document.createElement('div'); m.className = 'fs-cutoff-menu fs-match-menu';
            m.innerHTML = '<div class="mi" data-v="position" data-tip="Match by position\nGroups tracks at the same track number on different releases, whatever their titles.\nMeant for localised or translated titles. Artists and lengths must still agree,\nand the video, live, pending-edit and ISRC checks still apply.">Match by position</div>';
            document.body.appendChild(m);
            const r = more.getBoundingClientRect(); m.style.left = Math.max(4, r.right - 160) + 'px'; m.style.top = (r.bottom + 3) + 'px';
            const off = e => { if (!m.contains(e.target) && !more.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off, true); } };
            m.querySelector('.mi').onmousedown = e => { e.preventDefault(); m.remove(); document.removeEventListener('mousedown', off, true); onAutoMatch(true); };
            setTimeout(() => document.addEventListener('mousedown', off, true), 0);
        };
    }
    // NOT `onclick = mergeAll` — the click Event would land in mergeAll's first
    // parameter (concurrency), and being truthy it survives `|| 3`, making
    // Math.min(Event, n) → NaN → Array.from({length:NaN}) → zero workers → the
    // whole Merge All silently no-ops. Bit us live; see the guard in mergeAll too.
    document.getElementById('fs-mergeall').onclick = () => mergeAll();
    document.getElementById('fs-clearboard').onclick = () => { clearBoard(); renderAll(); };
    // wrapper, not a bare reference: onclick hands the click Event to the first
    // parameter, which has bitten this script before (#503, mergeAll's NaN)
    document.getElementById('fs-collapseall').onclick = () => toggleCollapseAll();
    document.getElementById('fs-expandall-deep').onclick = () => toggleExpandAllDeep();
    document.getElementById('fs-pooltog').onclick = () => setPoolCollapsed(true);
    document.getElementById('fs-poolrail').onclick = () => setPoolCollapsed(false);
    setPoolCollapsed(SETTINGS.poolCollapsed === true);
    document.getElementById('fs-pool-sort').addEventListener('click', e => { const b = e.target.closest('[data-sort]'); if (b) setPoolSort(b.dataset.sort); });
    renderPoolSort();
    document.getElementById('fs-clearmerged').onclick = () => { clearMerged(); renderAll(); };
    document.getElementById('fs-runsum').addEventListener('click', e => {
        if (e.target.classList.contains('fs-runclose')) { _lastRun = null; renderRunSummary(); }
    });
    // The header status texts all describe work whose detail is in the log, so
    // clicking any of them opens it — including the network pill, whose tooltip
    // already said "see Log for detail" without offering a way to get there.
    for (const id of ['fs-scope', 'fs-busy', 'fs-bgtask', 'fs-netbanner']) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('fs-toLog');
            el.onclick = (e) => { if (e.target.classList.contains('fs-bgstop')) cancelBackground(); else openLog(); };
        }
    }
    document.getElementById('fs-rg-editions').addEventListener('change', onLoadRgEdition);
    const poolFilter = document.getElementById('fs-pool-filter');
    poolFilter.addEventListener('input', () => { STATE.poolFilter = poolFilter.value.trim(); renderPool(); });
    poolFilter.addEventListener('keydown', e => { if (e.key === 'Escape' && poolFilter.value) { e.stopPropagation(); poolFilter.value = ''; STATE.poolFilter = ''; renderPool(); } });
    {
        const chip = document.getElementById('fs-cutoff'), wrap = document.getElementById('fs-cutwrap');
        const paint = () => {
            const c = SETTINGS.matchCutoff;
            chip.querySelector('.fs-cutoff-dot').style.background = TIER_COLORS[c] || '';
            chip.querySelector('.fs-cutoff-lbl').textContent = c;
            wrap.dataset.tip = cutoffTip();
        };
        paint();
        const open = () => {
            document.querySelectorAll('.fs-cutoff-menu').forEach(m => m.remove());
            const m = document.createElement('div'); m.className = 'fs-cutoff-menu';
            m.innerHTML = MATCH_CUTOFFS.map(c => '<div class="mi' + (c === SETTINGS.matchCutoff ? ' sel' : '') + '" data-v="' + c + '"><span class="fs-cutoff-dot" style="background:' + TIER_COLORS[c] + '"></span>' + c + '</div>').join('');
            document.body.appendChild(m);
            const r = chip.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 3) + 'px';
            const off = e => { if (!m.contains(e.target) && !chip.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off, true); } };
            m.querySelectorAll('.mi').forEach(it => it.onmousedown = e => {
                e.preventDefault(); m.remove(); document.removeEventListener('mousedown', off, true);
                if (SETTINGS.matchCutoff === it.dataset.v) return;
                SETTINGS.matchCutoff = it.dataset.v; saveSettings(); paint(); Log.info('Match cutoff set to ' + SETTINGS.matchCutoff);
            });
            setTimeout(() => document.addEventListener('mousedown', off, true), 0);
        };
        chip.onclick = () => (document.querySelector('.fs-cutoff-menu') ? document.querySelectorAll('.fs-cutoff-menu').forEach(m => m.remove()) : open());
        chip.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.onclick(); } };
    }
    wireWindowChrome(document.getElementById('fs-cons'), document.getElementById('fs-hdr'), document.getElementById('fs-max'));
    wireDelegatedEvents();
}
function closeFusion() {
    FUSION_OPEN = false;
    document.getElementById('fs-overlay')?.remove();
    document.removeEventListener('keydown', _fsEscHandler);
}
async function seedFromScope() {
    setScopeLabel('Loading…');
    busyStart('loading recordings…');
    try {
    if (SCOPE.type === 'release') {
        const { release, recordings } = await fetchReleaseRecordings(SCOPE.mbid);
        STATE.releaseInfo = release;
        recordings.forEach(r => addToPool(r));
        setScopeLabel(release ? ('Release: "' + release.title + '" · ' + release.artistCredit) : 'Release');
        renderAll();
        await maybeShowRGDropdown(SCOPE.mbid);
        enrichAllReleases(recordings, 3, scheduleBackgroundRender).catch(() => {});
        enrichPoolInBackground(recordings);
    } else if (SCOPE.type === 'release-group') {
        const { rg, recordings } = await fetchRGRecordings(SCOPE.mbid, seedPageProgress);
        STATE.rgInfo = rg;
        recordings.forEach(r => addToPool(r));
        setScopeLabel(rg ? ('Release group: "' + rg.title + '" · ' + rg.artistCredit) : 'Release group');
        enrichPoolInBackground(recordings);
    } else if (SCOPE.type === 'recording') {
        const rec = await fetchRecordingByGid(SCOPE.mbid);
        if (rec) addToPool(rec);
        setScopeLabel(rec ? ('Recording: "' + rec.title + '"') : 'Recording');
        if (rec) enrichPoolInBackground([rec]);
    } else if (SCOPE.type === 'artist-recordings') {
        harvestInternalIdsFromPage();   // free ids from the visible page, independent of seeding
        const { artist, recordings, total } = await fetchArtistRecordings(SCOPE.mbid, seedPageProgress);
        recordings.forEach(r => addToPool(r));
        setScopeLabel('Artist: ' + (artist ? '"' + artist.name + '"' : SCOPE.mbid)
            + ' — ' + recordings.length + (Number.isFinite(total) && total > recordings.length ? ' of ' + total : '') + ' recording(s)'
            + (recordings.length === 0 ? ' — nothing loaded' : ''));
        enrichPoolInBackground(recordings);
    }
    } finally { busyEnd(); }
    renderAll();
}
// #529 (majkinetor): "Lets also have an option to run match automatically."
// Deliberately waits for the AcoustID pass to finish first — matching before
// the identifiers land would just produce weaker groups.
async function maybeAutoMatchOnOpen() {
    if (!SETTINGS.autoMatchOnOpen) return;
    if (!STATE.poolOrder.length) { Log.info('Match on open: nothing in the pool'); return; }
    // eslint-disable-next-line no-unmodified-loop-condition -- busyEnd() lowers it while this awaits
    for (let i = 0; i < 120 && _busyCount > 0; i++) await new Promise(r => setTimeout(r, 250));
    if (!FUSION_OPEN) return;
    Log.info('Match on open: starting');
    await onAutoMatch();
}
async function openFusion() {
    if (FUSION_OPEN) return;
    FUSION_OPEN = true;
    fsStyle();
    buildShell();
    renderAll();
    if (STATE.recordings.size === 0) { await seedFromScope(); maybeAutoMatchOnOpen().catch(e => Log.error('Match on open failed: ' + e.message)); }
}

function ensureLauncher() {
    if (document.getElementById('fs-launch')) return;
    fsStyle();
    const btn = el('button', 'fs-launch'); btn.id = 'fs-launch'; btn.type = 'button';
    const img = document.createElement('img'); img.src = ICON_URL; img.alt = ''; btn.appendChild(img);
    btn.dataset.tip = 'Fusion — merge recordings\nRight-click: settings';   // icon-only: the tooltip carries the name
    btn.dataset.mbCorner = 'br'; btn.dataset.mbCornerOrder = '30';
    btn.onclick = () => openFusion();
    btn.oncontextmenu = e => { e.preventDefault(); if (document.getElementById('fs-settings')) document.getElementById('fs-settings').remove(); else openSettings(btn); };   // #695: right-click on every corner launcher opens its settings
    document.body.appendChild(btn);
    mbRestackCorner('br');
}
function boot() {
    Log.info('Fusion v' + VERSION + ' — startup on ' + SCOPE.type + ' ' + SCOPE.mbid);
    ensureLauncher();
    // reopen the log window if it was left open (same as apollo_editor #283)
    setTimeout(() => { try { Log.reopen(); } catch (e) {} }, 800);   // #283 reopen the log if it was left open
}
boot();

/* ── Mission Control adapter (#680) ──────────────────────────────────────────
   Mission Control asks over document events with JSON-string details (see
   userscripts/mission_control/DEVELOP.md). On a release page a probe loads the
   release group's recordings (the slow fetch MC's Auto/Ask switch exists for),
   auto-matches them with Fusion's own settings (ISRCs and AcoustIDs are not
   enriched here: that is minutes more, the Fusion window does it), and reports
   per track of THIS release the group it falls in, with what Fusion's group
   shows: each member's artist, release and track, length, ISRCs, AcoustIDs and
   open edits, and the signals. As in the window, a group with an open edit on a
   member is dropped (#529: never proposed) and its recordings stay ungrouped; a
   track whose own recording has one says so (`pending`), like the window's pool
   badge. MC can then ask to check one group's ISRCs and
   AcoustIDs (a few requests, not the release group's), or to open it in Fusion's
   window. Apply merges the ticked tracks' groups through mergeGroup, one at a
   time (MB's merge queue is one per session). Only Open puts a group on Fusion's
   board. */
if (SCOPE.type === 'release') {
    const mcSend = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
    const mcHello = () => mcSend('mc:provider', { id: 'fusion', name: 'Fusion', version: VERSION, release: SCOPE.mbid, capabilities: ['probe', 'apply', 'check', 'open', 'embed'] });
    let mcGroups = new Map();   // recording gid of this release's track -> { g, byGid }
    let mcOwn = [];             // this release's recordings, from the last probe
    let mcByGid = new Map();    // the release group's recordings, from the last probe
    const rgOfPage = () => { const a = document.querySelector('.releaseheader a[href*="/release-group/"]'); return a ? (a.getAttribute('href').match(/[0-9a-f-]{36}/) || [])[0] : null; };
    const parse = (e, what) => { try { return JSON.parse(e.detail) || {}; } catch (x) { Log.warn('Mission Control ' + what + ' with unreadable detail: ' + x.message); return null; } };
    // the recordings the window knows are the ones its card, merge and AcoustID refresh read (STATE.recordings)
    const membersOf = hit => hit.g.memberGids.map(x => STATE.recordings.get(x) || hit.byGid.get(x)).filter(Boolean);
    const mcKnow = hit => hit.g.memberGids.forEach(gid => { if (!STATE.recordings.has(gid) && hit.byGid.has(gid)) STATE.recordings.set(gid, hit.byGid.get(gid)); });
    // one recording as MC's comparison shows it; rel is the release to name (this one, for our own track)
    const recInfo = (o, rel) => {
        rel = rel || o.releases[0] || {};
        return {
            gid: o.gid, title: o.title, artist: o.artistCredit || '', release: rel.title || '', pos: rel.trackNumber || null, of: rel.trackCount || null,
            more: Math.max(0, o.releases.length - 1), len: dur(o.length), ms: o.length, isrcs: o.isrcs || [], acoustids: o.acoustids, pending: !!o.editsPending,
        };
    };
    const mcFinding = r => {
        const hit = mcGroups.get(r.gid);
        const base = { key: r.gid, track: r.gid, name: r.title };
        if (!hit) return Object.assign(base, { state: 'none', matches: [], pending: !!(mcByGid.get(r.gid) || {}).editsPending });
        const members = membersOf(hit);
        return Object.assign(base, {
            state: 'new', confidence: hit.g.confidence, tier: hit.g.tier, cutoff: SETTINGS.matchCutoff,
            signals: hit.g.signalsAll, any: hit.g.signals,
            checked: { isrc: members.every(m => m.isrcsKnown), acoustid: members.every(m => m.acoustids != null) },
            why: hit.g.signals.join(', '),
            self: recInfo(hit.byGid.get(r.gid) || r, r.releases[0]),
            matches: members.filter(o => o.gid !== r.gid).map(o => recInfo(o)),
        });
    };
    document.addEventListener('mc:discover', () => { Log.info('Mission Control asked — answering as provider fusion'); mcHello(); });
    document.addEventListener('mc:probe', async e => {
        const d = parse(e, 'probe'); if (!d) return;
        if ((d.release && d.release !== SCOPE.mbid) || (d.only && !d.only.includes('fusion'))) return;
        const progress = note => mcSend('mc:progress', { id: 'fusion', run: d.run, state: 'busy', note });
        const done = (findings, note) => mcSend('mc:findings', { id: 'fusion', run: d.run, release: SCOPE.mbid, findings, note });
        try {
            progress('loading the release');
            const own = await fetchReleaseRecordings(SCOPE.mbid);
            const rg = rgOfPage();
            if (!rg) { Log.warn('Mission Control probe: no release group link on the page'); done([], 'no release group'); return; }
            progress('loading the release group');
            const { recordings } = await fetchRGRecordings(rg, (p, n, got) => progress('release group page ' + p + (n ? '/' + n : '') + ' · ' + got + ' recordings'));
            Log.info('Mission Control probe: ' + recordings.length + ' recording(s) in the release group, matching at "' + SETTINGS.matchCutoff + '"');
            progress('matching ' + recordings.length + ' recordings');
            const byGid = new Map(recordings.map(r => [r.gid, r]));
            const groups = autoMatch(recordings, SETTINGS.lengthToleranceMs, SETTINGS.matchCutoff);
            // as the window does: a group with a pending edit on a member is never
            // proposed (#529), and its recordings stay ungrouped
            const grouped = groups.flatMap(g => g.memberGids).map(x => byGid.get(x)).filter(Boolean);
            if (grouped.length) { progress('checking ' + grouped.length + ' grouped recordings for pending edits'); await enrichPendingEdits(grouped, 2); }
            mcGroups = new Map();
            let dropped = 0;
            for (const g of groups) {
                const bad = g.memberGids.map(x => byGid.get(x)).filter(r => r && r.editsPending);
                if (bad.length) { dropped++; Log.warn('Dropped a proposed group — pending edit(s) on: ' + bad.map(r => r.title).join(', ')); continue; }
                for (const gid of g.memberGids) mcGroups.set(gid, { g, byGid });
            }
            mcOwn = own.recordings;
            mcByGid = byGid;
            mcCards.clear();
            const findings = mcOwn.map(mcFinding);
            Log.info('Mission Control probe answered: ' + (groups.length - dropped) + ' group(s), ' + findings.filter(f => f.state === 'new').length + ' track(s) with duplicates' + (dropped ? ', ' + dropped + ' group(s) dropped for a pending edit' : ''));
            done(findings);
        } catch (x) {
            Log.error('Mission Control probe failed: ' + (x && x.message));
            done([], 'failed: ' + (x && x.message));
        }
    });
    // check one group's ISRCs and AcoustIDs, then send its tracks' findings again
    document.addEventListener('mc:check', async e => {
        const d = parse(e, 'check'); if (!d) return;
        if (d.id !== 'fusion' || (d.release && d.release !== SCOPE.mbid)) return;
        const hit = mcGroups.get(d.key);
        const update = o => mcSend('mc:update', Object.assign({ id: 'fusion', run: d.run, release: SCOPE.mbid, keys: [d.key] }, o));
        if (!hit) { update({ findings: [], error: 'that group is gone: fetch the release group again' }); return; }
        mcKnow(hit);
        const members = membersOf(hit);
        hit.g.mcChecking = true; renderEmbeds();
        try {
            Log.info('Mission Control: checking ISRCs and AcoustIDs of ' + members.length + ' recording(s) in the group of ' + d.key);
            await enrichIsrcs(members, 2);
            await enrichAcoustIds(members, 4);
            Object.assign(hit.g, computeGroupConfidence(members));
            Log.info('Mission Control check: tier ' + hit.g.tier + ', signals on every pair [' + hit.g.signalsAll.join(', ') + ']');
            update({ findings: mcOwn.filter(r => hit.g.memberGids.includes(r.gid)).map(mcFinding) });
        } catch (x) {
            Log.error('Mission Control check failed: ' + (x && x.message));
            update({ findings: [], error: 'the check failed: ' + (x && x.message) });
        } finally { hit.g.mcChecking = false; renderEmbeds(); }
    });
    // open Fusion's window with this group on the board
    async function mcOpen(key) {
        const hit = mcGroups.get(key);
        if (!hit) { Log.warn('Mission Control open: no group for ' + key); return; }
        await openFusion();
        const members = membersOf(hit);
        // each member into the pool first: out of any group it sits in, or added if the window never loaded it
        members.forEach(m => {
            const was = STATE.groups.find(g => g.memberGids.includes(m.gid));
            if (was) returnToPool(m.gid, was.id);
            else if (!STATE.recordings.has(m.gid)) addToPool(m);
            else if (!STATE.poolOrder.includes(m.gid)) STATE.poolOrder.push(m.gid);
        });
        const target = members.some(m => m.gid === hit.g.target) ? hit.g.target : members[0].gid;
        const g = createGroupWithMember(target);
        if (!g) return;
        members.forEach(m => { if (m.gid !== target) addToGroup(m.gid, g.id); });
        g.target = target;
        STATE.activeGroupId = g.id;
        Log.info('Mission Control opened the group of ' + key + ' in Fusion (' + g.memberGids.length + ' recordings)');
        renderAll();
    }
    document.addEventListener('mc:open', e => {
        const d = parse(e, 'open'); if (!d) return;
        if (d.id !== 'fusion' || (d.release && d.release !== SCOPE.mbid)) return;
        mcOpen(d.key);
    });
    // #790: Fusion's own group card in the slot Mission Control leaves under a track ([data-mc-slot="fusion"],
    // data-key the track's recording). MC asks with mc:mount after each paint; a card is kept per track and
    // moved into the slot again (a node keeps its state and listeners), and repainted whenever the board is.
    const mcCards = new Map();   // track recording gid -> the card's element
    const paintCard = (wrap, hit) => { wrap.innerHTML = groupCardHtml(hit.g, true); placeLenBadges(wrap); };
    function mcCard(key, hit) {
        const wrap = el('div', 'fs-embed'); wrap.dataset.key = key;
        wrap.addEventListener('keydown', e => e.stopPropagation());   // the edit note is typed here, not into MC's keys
        wrap.addEventListener('click', e => {
            const t = e.target.closest('[data-act]'), act = t && t.dataset.act;
            const h = mcGroups.get(key), g = h && h.g;
            if (!act || !g) return;
            const row = t.closest('.fs-grow');
            if (act === 'mc-open') { mcOpen(key); return; }
            if (act === 'toggle-releases' && row) { toggleReleaseDetails(row.dataset.gid); return; }
            if (act === 'toggle-ids' && row) { toggleIdList(row.dataset.gid, t.dataset.kind); return; }
            if (act === 'toggle-all-details') {   // the group isn't on the board (toggleAllDetails finds it there): one recording at a time
                const all = groupAllExpanded(g);
                g.memberGids.filter(gid => all || !STATE.expandedReleases.has(gid)).forEach(gid => toggleReleaseDetails(gid));
                return;
            }
            if (act === 'refresh-acoustid') { mcKnow(h); refreshGroupAcoustIds(g); return; }
            if (act === 'set-target' && row) { g.target = row.dataset.gid; Log.info('Mission Control: merge target of the group of ' + key + ' is ' + g.target); renderEmbeds(); return; }
            if (act === 'edit-note') { mcKnow(h); g.editing = true; renderEmbeds(); const ta = wrap.querySelector('.fs-note-ta'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
            if (act === 'note-save') {
                const ta = wrap.querySelector('.fs-note-ta'), val = ta ? ta.value.trim() : '';
                g.editNote = (!val || val === autoEditNote(g)) ? null : val;
                g.editing = false;
                Log.info('Edit note for the group of ' + key + (g.editNote ? ' set: ' + g.editNote.replace(/\n/g, ' ¶ ') : ' reset to auto'));
                renderEmbeds(); return;
            }
            if (act === 'note-cancel') { g.editing = false; renderEmbeds(); return; }
            if (act === 'note-clear') { g.editNote = null; g.editing = false; renderEmbeds(); return; }
        });
        mcKnow(hit);
        paintCard(wrap, hit);
        mcCards.set(key, wrap);
        return wrap;
    }
    renderEmbeds = () => mcCards.forEach((wrap, key) => { const hit = mcGroups.get(key); if (hit && wrap.isConnected && !(hit.g.editing && wrap.contains(document.activeElement) && document.activeElement.classList.contains('fs-note-ta'))) paintCard(wrap, hit); });
    document.addEventListener('mc:mount', e => {
        const d = parse(e, 'mount'); if (!d) return;
        if (d.id !== 'fusion' || (d.release && d.release !== SCOPE.mbid)) return;
        document.querySelectorAll('[data-mc-slot="fusion"]').forEach(slot => {
            const key = slot.dataset.key, hit = mcGroups.get(key);
            if (!hit) { slot.textContent = 'Fusion has no group for this track: fetch the release group again'; return; }
            const wrap = mcCards.get(key) || mcCard(key, hit);
            if (wrap.parentNode !== slot) { slot.replaceChildren(wrap); placeLenBadges(wrap); }
        });
    });
    document.addEventListener('mc:apply', async e => {
        const d = parse(e, 'apply'); if (!d) return;
        if (d.id !== 'fusion' || (d.release && d.release !== SCOPE.mbid)) return;
        const reply = o => mcSend('mc:applied', Object.assign({ id: 'fusion', run: d.run, release: SCOPE.mbid }, o));
        const seen = new Set(), groups = [];
        for (const k of d.keys || []) { const h = mcGroups.get(k); if (h && !seen.has(h.g)) { seen.add(h.g); groups.push(h); } }
        if (!groups.length) { reply({ ok: true, sent: 0, note: 'nothing to merge' }); return; }
        if (d.dry) { reply({ ok: true, sent: 0, note: 'dry run: ' + groups.length + ' merge' + (groups.length === 1 ? '' : 's') + ' would be submitted' }); return; }
        let ok = 0; const errs = [];
        for (const { g, byGid } of groups) {
            g.via = 'Via ' + (d.mcName || 'Mission Control') + (d.mc ? ' v' + d.mc : '') + ': ' + location.origin + '/release/' + SCOPE.mbid;   // the note's last line (buildEditNote)
            g.memberGids.forEach(gid => { if (!STATE.recordings.has(gid)) STATE.recordings.set(gid, byGid.get(gid)); });   // mergeGroup reads its members from here
            await mergeGroup(g);
            if (g.state === 'done') ok++; else errs.push(g.error || 'failed');
        }
        // #822: retry, so Mission Control offers its Retry button (the card's state is only a label)
        reply(errs.length ? { ok: false, retry: true, sent: ok, note: ok + ' merged, ' + errs.length + ' failed: ' + errs[0] } : { ok: true, sent: ok, note: ok + ' merge' + (ok === 1 ? '' : 's') + ' submitted' });
    });
    mcHello();
}

try {
    W.__fusion = {
        VERSION, SCOPE, STATE, SETTINGS_DEFAULTS, MATCH_CUTOFFS,
        get SETTINGS() { return SETTINGS; },
        recordingSetting, placeConflict, settingWarning, memberDis,
        normName, tokenMatch, titleSimilar, titleAlike, titleDistinctWords, isrcConflict, artistSimilar, lengthClose, fuzzyRatio, levenshtein, acName, acPrimaryGid, acGids, dur, parseMbidFromInput, parseAddInput,
        mkRecording, fetchRecordingsByBrowse, enrichReleasesFromSearch, fetchReleaseRecordings, fetchRGRecordings, fetchRecordingByGid, fetchAllReleases, resolveInternalId, fetchAcoustIds, fetchAcoustIdsBatch, refreshGroupAcoustIds, enrichIsrcs, fetchRecordingDetail, fetchEntityMeta, enrichPendingEdits, fetchRecordingsBySearch, fetchArtistRecordings, harvestInternalIdsFromPage,
        pairSignals, poolMatches, computeGroupConfidence, groupTier, gatedUnionFind, TIER_COLORS, SIGNAL_KEYS, ACOUSTID_BATCH, shouldUnion, autoMatch, enrichAcoustIds, enrichAllReleases,
        presenceDots,   // SETTINGS_DEFAULTS is listed above
        fetchReleaseDetails, releaseTableHtml, toggleReleaseDetails, storeReleaseDetails, releasesSummary, renderFooter, seedPageProgress, lengthSpread,
        renderRunSummary, getLastRun: () => _lastRun, showNotice, renderNotice, cancelBackground, bgAlive, resumeBackground, isBgStopped: () => _bgStopped,
        lengthDiffLabel,
        toggleCollapseAll, allGroupsCollapsed, placeLenBadges, toggleExpandAllDeep, everythingExpanded, setPoolCollapsed, renderPoolCount, sortPool, setPoolSort, backfillMissingReleases, prefetchGroupReleases, setBgTask, renderCollapseAllBtn, toggleAllDetails, groupAllExpanded, clearMerged,
        addToPool, createGroupWithMember, addToGroup, returnToPool, removeFromGroupAndPool, removeFromPoolPermanently, findGroup, deleteGroup, clearBoard, videoConflict,
        buildEditNote, autoEditNote, evidenceLines, ensureInternalIds, mergeGroup, mergeAll, describeRecordingForLog,
        openFusion, closeFusion, onAutoMatch, seedFromScope, maybeAutoMatchOnOpen, renderAll, renderPool, renderGroups, busyStart, busyEnd,
        gmGet, gmPost, wsGet, setNetTrouble, clearNetTrouble,
        getLogLines: () => Log.messages(),
        getBusyCount: () => _busyCount,
    };
} catch (e) {}

})();
