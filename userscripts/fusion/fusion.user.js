// ==UserScript==
// @name         Fusion
// @namespace    https://musicbrainz.org/
// @version      2026.8.21.174538
// @description  Merge-recordings assistant for MusicBrainz: gather a pool of candidate recordings from a release / release group / recording page (or paste any MBID/URL), auto-match them into merge groups by ISRC / AcoustID / length / title+artist, review and adjust the groups, then submit the merges directly in the background — no MB merge page involved.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPkZ1c2lvbjwvdGl0bGU+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOGE1Y2Y2IiBzdHJva2Utd2lkdGg9IjciPgogICAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iNjQiIHJ4PSI1MiIgcnk9IjIyIi8+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiIHRyYW5zZm9ybT0icm90YXRlKDYwIDY0IDY0KSIvPgogICAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iNjQiIHJ4PSI1MiIgcnk9IjIyIiB0cmFuc2Zvcm09InJvdGF0ZSgxMjAgNjQgNjQpIi8+CiAgPC9nPgogIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjE0IiBmaWxsPSIjNmQzZmYwIi8+Cjwvc3ZnPgo=
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/fusion/README.md
// @match        https://*.musicbrainz.org/release/*
// @match        https://*.musicbrainz.org/release-group/*
// @match        https://*.musicbrainz.org/recording/*
// @match        https://*.musicbrainz.org/artist/*/recordings
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// @connect      api.acoustid.org
// ==/UserScript==

(function () {
'use strict';

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '2026.8.21.155057';
const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/fusion/README.md';
const ICON = '⚛';
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

/* ── activity log — in-page buffer + popup viewer (ported from apollo_editor's
   Log/openLog, #283-style: every Log.* call is captured and surfaced from a
   Log button next to "? Help", copy/pastable as a Markdown <details> block) ── */
const _logBuf = [];
const _logListeners = new Set();
function _logRecord(kind, args) {
    const line = args.map(a => (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })())).join(' ');
    _logBuf.push({ t: Date.now(), kind, line });
    if (_logBuf.length > 2000) _logBuf.shift();
    _logListeners.forEach(f => { try { f(); } catch (e) {} });
}
const Log = {
    info: (...a) => _logRecord('info', a),
    warn: (...a) => _logRecord('warn', a),
    error: (...a) => _logRecord('error', a),
    ok: (...a) => _logRecord('ok', a),
};
const _lpad = (n, w) => String(n).padStart(w || 2, '0');
const _logTs = d => _lpad(d.getHours()) + ':' + _lpad(d.getMinutes()) + ':' + _lpad(d.getSeconds()) + '.' + _lpad(d.getMilliseconds(), 3);
const _logCounts = () => _logBuf.reduce((a, e) => { if (e.kind === 'warn') a.warn++; else if (e.kind === 'error') a.error++; return a; }, { warn: 0, error: 0 });
// escape, then turn http(s) URLs into clickable links (Apollo's _logLinkify)
const _logLinkify = s => escapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g, m => {
    const t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];   // keep trailing punctuation out of the URL
    const url = m.slice(0, m.length - t.length);
    return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + t;
});
function logMarkdown() {
    const PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ' };
    const body = _logBuf.length ? _logBuf.map(r => _logTs(new Date(r.t)) + '  ' + (PRE[r.kind] || '') + r.line).join('\n') : '(no activity logged)';
    const c = _logCounts();
    const tally = (c.warn || c.error) ? ' (' + c.warn + ' warning' + (c.warn === 1 ? '' : 's') + ', ' + c.error + ' error' + (c.error === 1 ? '' : 's') + ')' : '';
    return '<details><summary>Fusion v' + VERSION + ' — session log' + tally + '</summary>\n\n```log\n' + body + '\n```\n\n</details>';
}
async function copyLog(btn) {
    const md = logMarkdown(); let ok = false;
    try { await navigator.clipboard.writeText(md); ok = true; }
    catch (e) { try { const ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (x) {} }
    if (btn) { const o = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = o; btn.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); }
}
// remembered position of the draggable log window (#529)
const LOGWIN_KEY = 'fusion.logwin';
function loadLogWinState() { try { return JSON.parse(GM_getValue(LOGWIN_KEY, '{}')); } catch (e) { return {}; } }
function saveLogWinState(patch) { try { GM_setValue(LOGWIN_KEY, JSON.stringify(Object.assign(loadLogWinState(), patch))); } catch (e) {} }
// #529 (majkinetor): "Make entire log window as in apollo (it has min/maximize,
// wider etc.)" — ported from apollo_editor's #283 log viewer: wider centred
// window, minimize/restore docking to the bottom-left, an entry-count + warn/err
// badge, clickable URLs, per-severity colouring, Escape to close, and
// open/minimized/position all remembered across sessions.
// NB the container needs BOTH the id and the .fs-logpop class — its CSS is a
// class rule, and setting only the id once left it entirely unstyled (invisible
// behind the modal) while still passing an existence check.
function openLog() {
    document.getElementById('fs-logpop')?.remove();
    fsStyle();
    saveLogWinState({ open: true });
    const st = loadLogWinState();
    const pop = el('div', 'fs-logpop'); pop.id = 'fs-logpop';
    pop.innerHTML = '<div class="fs-logpop-h"><b>Fusion — activity log</b> <span class="fs-log-badge"></span><span class="fs-logpop-sp"></span>'
        + '<button class="fs-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>'
        + '<button class="fs-logpop-min" type="button" title="Minimize">–</button>'
        + '<button class="fs-logpop-x" type="button" title="Close">✕</button></div>'
        + '<div class="fs-log-list"></div>';
    document.body.appendChild(pop);
    if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
    pop._restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
    const list = pop.querySelector('.fs-log-list');
    const render = () => {
        list.innerHTML = _logBuf.length
            ? _logBuf.map(r => '<div class="fs-log-li fs-log-' + r.kind + '"><span class="fs-log-t">' + _logTs(new Date(r.t)) + '</span><span class="fs-log-m">' + _logLinkify(r.line) + '</span></div>').join('')
            : '<div class="fs-log-empty">No activity yet.</div>';
        const c = _logCounts();
        pop.querySelector('.fs-log-badge').textContent = '(' + _logBuf.length + ')' + (c.warn || c.error ? ' · ' + c.warn + '⚠ ' + c.error + '✖' : '');
        list.scrollTop = list.scrollHeight;
    };
    render();
    _logListeners.add(render);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { saveLogWinState({ open: false }); _logListeners.delete(render); pop.remove(); document.removeEventListener('keydown', onKey); };
    pop.querySelector('.fs-logpop-copy').onclick = () => copyLog(pop.querySelector('.fs-logpop-copy'));
    const minBtn = pop.querySelector('.fs-logpop-min');
    const setMin = m => {
        minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
        if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        else if (pop._restore) { Object.assign(pop.style, pop._restore); }
    };
    minBtn.onclick = () => { const m = pop.classList.toggle('min'); setMin(m); saveLogWinState({ min: m }); };
    if (st.min) { pop.classList.add('min'); setMin(true); }
    pop.querySelector('.fs-logpop-x').onclick = close;
    pop.querySelector('.fs-logpop-h').addEventListener('mousedown', e => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        const r = pop.getBoundingClientRect();
        pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
        const ox = e.clientX - r.left, oy = e.clientY - r.top;
        const mv = ev => {
            pop.style.left = Math.max(0, Math.min(innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
            pop.style.top = Math.max(0, Math.min(innerHeight - 36, ev.clientY - oy)) + 'px';
        };
        const up = () => {
            document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
            if (!pop.classList.contains('min')) { pop._restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' }; saveLogWinState({ left: pop.style.left, top: pop.style.top }); }
        };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    document.addEventListener('keydown', onKey);
}

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

// #529 follow-up (majkinetor, live): "Load from release group button almost
// never appears (probably rate limit)." MB's WS2 throttles hard under any
// burst of calls (verified live: 503 "web server is currently busy" mid-session)
// — a single failed GET used to just silently return null. Retry with backoff
// and log every attempt/outcome so a failure is diagnosable from the log alone.
// MusicBrainz answers a throttled request with 503 + "Retry-After: 9" and
// publishes a budget via X-RateLimit-Remaining/Reset. Fusion used to ignore
// both: it retried on its own 0.8/1.6/3.2s backoff, every retry landed inside
// the window the server had asked us to wait out, and recordings silently
// ended up with no ISRC data (#529 - "is retry after followed?"). Now the
// server's own numbers drive the waiting.
//
// The gate is GLOBAL on purpose. Enrichment runs several workers at once, and
// per-request backoff meant each one independently kept knocking while the
// server was asking everybody to stop - which is what turned one 503 into
// dozens. One 503 now parks every MB request until the deadline passes.
let _mbGateUntil = 0;
let _netTrouble = null;   // { kind, detail, at } — surfaced as a banner, not just logged
function setNetTrouble(kind, detail) {
    _netTrouble = { kind, detail, at: Date.now() };
    renderNetBanner();
}
function clearNetTrouble() { if (_netTrouble) { _netTrouble = null; renderNetBanner(); } }
function renderNetBanner() {
    const el = document.getElementById('fs-netbanner'); if (!el) return;
    if (!_netTrouble) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = '';
    el.textContent = (_netTrouble.kind === 'offline'
        ? '⚠ No connection to MusicBrainz — ' + _netTrouble.detail
        : '⚠ MusicBrainz is throttling requests — ' + _netTrouble.detail)
        + '  (see Log for detail)';
    el.className = 'fs-netbanner' + (_netTrouble.kind === 'offline' ? ' fs-netbanner-err' : '');
}
const MB_MAX_WAIT_MS = 60000;   // never park longer than this on one hint
function parseRetryAfter(v) {
    if (!v) return null;
    const secs = Number(v);
    if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
    const when = Date.parse(v);                       // HTTP-date form
    return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
}
function mbGateFor(ms, why) {
    const capped = Math.min(Math.max(0, ms), MB_MAX_WAIT_MS);
    const until = Date.now() + capped;
    if (until > _mbGateUntil) {
        _mbGateUntil = until;
        Log.warn('Pausing MusicBrainz requests for ' + Math.round(capped / 1000) + 's — ' + why);
        setNetTrouble('throttled', 'paused ' + Math.round(capped / 1000) + 's at the server\'s request');
    }
}
async function mbAwaitGate() {
    let waited = 0;
    while (Date.now() < _mbGateUntil) {
        const left = _mbGateUntil - Date.now();
        await new Promise(res => setTimeout(res, Math.min(left, 500)));
        waited += 500;
        if (waited > MB_MAX_WAIT_MS + 5000) break;   // belt and braces
    }
}
async function wsGet(path, retries) {
    retries = retries == null ? 4 : retries;
    for (let attempt = 0; attempt <= retries; attempt++) {
        await mbAwaitGate();                          // respect any server-asked pause
        const t0 = Date.now();
        try {
            Log.info('GET ' + path + (attempt ? ' (retry ' + attempt + '/' + retries + ')' : ''));
            // no-store: MB's WS2 sends NO cache headers, so browsers cache these
            // heuristically and can serve a stale response — which silently fed
            // Fusion out-of-date ISRC data. #529
            const r = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
            const ms = Date.now() - t0;
            if (r.status === 503 || r.status === 429) {
                const ra = parseRetryAfter(r.headers.get('Retry-After'));
                // Retry-After is a FLOOR on the wait, never a replacement for
                // backoff. MB really does answer "Retry-After: 0" (#529), and
                // taking that literally made the header DISABLE the backoff:
                // five attempts fired inside 150ms and gave up before the
                // server had a chance to recover. Whichever is longer wins.
                const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);   // same shape as falcon's mbThrottle
                const wait = Math.max(ra || 0, backoff);
                Log.warn('GET ' + path + ' → ' + r.status + ' (' + ms + 'ms) — MB busy'
                    + (ra != null ? '; Retry-After: ' + Math.round(ra / 1000) + 's' : '; no Retry-After')
                    + ', waiting ' + Math.round(wait / 1000) + 's');
                if (attempt < retries) { mbGateFor(wait, 'server returned ' + r.status + (ra ? ' with Retry-After ' + Math.round(ra / 1000) + 's' : '')); continue; }
                Log.error('GET ' + path + ' gave up after ' + (retries + 1) + ' attempts (still ' + r.status + ')');
                setNetTrouble('throttled', 'gave up on a request after ' + (retries + 1) + ' attempts (HTTP ' + r.status + ')');
                return null;
            }
            if (!r.ok) { Log.warn('GET ' + path + ' → ' + r.status + ' (' + ms + 'ms)'); return null; }
            // Proactively ease off before MB has to throttle us: it publishes the
            // remaining budget and when it resets, so spread the rest over that window.
            const remaining = Number(r.headers.get('X-RateLimit-Remaining'));
            const resetAt = Number(r.headers.get('X-RateLimit-Reset'));
            if (Number.isFinite(remaining) && remaining <= 5 && Number.isFinite(resetAt)) {
                const until = resetAt * 1000 - Date.now();
                if (until > 0) mbGateFor(until, 'rate-limit budget nearly spent (' + remaining + ' left)');
            }
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
const SETTINGS_DEFAULTS = { lengthToleranceMs: 5000, grossLengthMs: 30000, acoustidEnrich: true, acoustidPoolCap: 2000, autoMatchOnOpen: false, makeVotable: false, matchCutoff: 'normal' };
// Stored settings win over defaults, so simply RAISING a default is invisible to
// anyone who ever opened the config window (that saves every key, including the
// ones they never touched). The old 60 cap dated from one-request-per-recording;
// now that list_by_mbid batches 50 at a time it only served to leave big pools
// with no AcoustID data at all. Lift that specific stale value — but only when
// it's still exactly the retired default, so a cap someone deliberately chose
// stays theirs.
const RETIRED_ACOUSTID_CAP = 60;
function migrateSettings(s) {
    if (s.acoustidPoolCap === RETIRED_ACOUSTID_CAP) s.acoustidPoolCap = SETTINGS_DEFAULTS.acoustidPoolCap;
    return s;
}
function loadSettings() {
    try { return migrateSettings(Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(GM_getValue(SETTINGS_KEY, '{}')))); }
    catch (e) { return Object.assign({}, SETTINGS_DEFAULTS); }
}
function saveSettings() { try { GM_setValue(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {} }
let SETTINGS = loadSettings();

/* ── shared corner-slot convention (#468), duplicated per-script on purpose —
   see apollo_editor.user.js for the canonical comment. Fusion stacks above
   Falcon (order 20) since it can share a page with it. ── */
function mbRestackCorner(corner) {
    const bottom = corner[0] === 'b', right = corner[1] === 'r';
    const els = [...document.querySelectorAll('[data-mb-corner="' + corner + '"]')]
        .filter(e => getComputedStyle(e).display !== 'none')
        .sort((a, b) => (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0));
    let pos = 14;
    els.forEach(e => {
        e.style[bottom ? 'bottom' : 'top'] = pos + 'px';
        e.style[right ? 'right' : 'left'] = '14px';
        pos += e.getBoundingClientRect().height + 8;
    });
}

/* ── matching / normalization (ported from platform_check's tokenMatch/scoreCandidate
   normalization stack — same token-overlap approach, reused rather than reinvented) ── */
function normName(s) { return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
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
const titleSimilar = (a, b) => tokenMatch(a, b, 'max', 0.6) || fuzzyRatio(a, b) >= 0.85;
const artistTokenCount = s => normName(s).split(' ').filter(t => t.length >= 2).length;
const artistSimilar = (a, b) => tokenMatch(a, b, artistTokenCount(b) <= artistTokenCount(a) ? 'min' : 'max', 0.8);
function lengthClose(a, b, tolMs) { if (a == null || b == null) return false; return Math.abs(a - b) <= tolMs; }
// #529 follow-up: "We should be able to select confidence level for match" —
// strict = only hard identifiers; normal (default) = identifiers, or
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
    if (sig.isrc || sig.acoustid) return true;
    if (cutoff === 'strict') return false;
    if (cutoff === 'loose') return (sig.title && sig.length) || (sig.title && sig.artist);
    return sig.title && sig.artist && sig.length;   // 'normal'
}

function acName(ac) {
    if (!Array.isArray(ac)) return '';
    return ac.map(x => (x.name || (x.artist && x.artist.name) || '') + (x.joinphrase || '')).join('');
}
function acPrimaryGid(ac) { return (Array.isArray(ac) && ac[0] && ac[0].artist && ac[0].artist.id) || null; }
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
    return Object.assign({ gid, title: '', length: null, isrcs: [], artistCredit: '', artistGid: null, releases: [], allReleases: null, acoustids: null, video: null, editsPending: null, isrcsKnown: false }, opts || {});
}

async function fetchReleaseRecordings(releaseMbid) {
    const j = await wsGet('/ws/2/release/' + releaseMbid + '?inc=recordings+isrcs+artist-credits&fmt=json');
    if (!j) return { release: null, recordings: [] };
    const recs = [];
    for (const m of j.media || []) {
        for (const t of m.tracks || []) {
            const r = t.recording || {};
            const ac = r['artist-credit'] || j['artist-credit'];
            recs.push(mkRecording(r.id, {
                title: r.title || t.title,
                length: r.length != null ? r.length : t.length,
                isrcs: r.isrcs || [],
                artistCredit: acName(ac), artistGid: acPrimaryGid(ac), video: !!r.video, isrcsKnown: true,
                releases: [{ gid: j.id, title: j.title, trackNumber: t.number || null, trackCount: m['track-count'] || null }],
            }));
        }
    }
    Log.info('Release seed: ' + recs.length + ' recording(s) from "' + j.title + '"');
    return { release: { gid: j.id, title: j.title, artistCredit: acName(j['artist-credit']) }, recordings: recs };
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
                return { gid: rel.id, title: rel.title, trackNumber, trackCount: rel['track-count'] || null, date: rel.date || null };
            });
            const ac = r['artist-credit'];
            // the search already returns every release a recording appears on,
            // across every release group — so it doubles as the deduped
            // "all releases" list, with no extra per-recording fetch.
            recordings.push(mkRecording(r.id, { title: r.title, length: r.length, isrcs: r.isrcs || [], artistCredit: acName(ac), artistGid: acPrimaryGid(ac), video: !!r.video, isrcsKnown: true, releases, allReleases: releases }));
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
async function fetchRGRecordings(rgMbid, onPage) {
    const rgMeta = await wsGet('/ws/2/release-group/' + rgMbid + '?inc=artist-credits&fmt=json');
    const rg = rgMeta ? { gid: rgMeta.id, title: rgMeta.title, artistCredit: acName(rgMeta['artist-credit']) } : null;
    const { recordings } = await fetchRecordingsBySearch('rgid:' + rgMbid, 'RG seed', onPage);
    return { rg, recordings };
}
// #529 (majkinetor): "scraping the page is not going to cut it, we need to use
// an API here" — the artist page is paginated at 100 rows and its DOM layout
// shifts with login state, so the whole artist catalogue now comes from the
// indexed search instead (297 vs 100 for the artist that surfaced this).
async function fetchArtistRecordings(artistMbid, onPage) {
    const meta = await wsGet('/ws/2/artist/' + artistMbid + '?fmt=json');
    const artist = meta ? { gid: meta.id, name: meta.name } : null;
    const { recordings, total } = await fetchRecordingsBySearch('arid:' + artistMbid, 'Artist seed', onPage);
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
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=releases+isrcs+artist-credits&fmt=json');
    if (!j) return null;
    const releases = (j.releases || []).map(rel => ({ gid: rel.id, title: rel.title, trackNumber: null, trackCount: null, date: rel.date || null }));
    const ac = j['artist-credit'];
    return mkRecording(j.id, { title: j.title, length: j.length, isrcs: j.isrcs || [], artistCredit: acName(ac), artistGid: acPrimaryGid(ac), video: !!j.video, isrcsKnown: true, releases, allReleases: releases });
}
// #529 follow-up (majkinetor, with a screenshot of jesus2099's reference
// script): "We should have a list of recording releases too (deduped)" — the
// full set of releases a recording appears on, not just the one it was seeded
// from. Release/recording-page seeding only knows about ONE release per
// recording at fetch time, so this backfills the rest lazily.
async function fetchAllReleases(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=releases&fmt=json');
    if (!j) return { releases: [], video: null };
    const seen = new Set(); const out = [];
    for (const rel of j.releases || []) {
        if (seen.has(rel.id)) continue;
        seen.add(rel.id);
        out.push({ gid: rel.id, title: rel.title, trackNumber: null, trackCount: null, date: rel.date || null });
    }
    return { releases: out, video: !!j.video };
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
    async function worker() {
        while (i < recs.length) {
            const rec = recs[i++];
            if (rec.allReleases == null) {
                const r = await fetchAllReleases(rec.gid);
                rec.allReleases = r.releases;
                if (rec.video == null) rec.video = r.video;
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
        const j = await fetch('/ws/js/entity/' + gid, { headers: { Accept: 'application/json' } }).then(r => r.json());
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
    if (flagged) Log.warn(flagged + ' recording(s) have pending edits — excluded from auto-match and blocked from merging');
}
const _idCache = new Map();
async function resolveInternalId(gid) {
    if (_idCache.has(gid)) return _idCache.get(gid);
    let id = null;
    try {
        const j = await fetch('/ws/js/entity/' + gid, { headers: { Accept: 'application/json' } }).then(r => r.json());
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
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=isrcs&fmt=json');
    if (!j) return null;
    return { isrcs: j.isrcs || [], video: !!j.video };
}
// #529 (majkinetor): "I didn't see a single AcoustID, although all should have
// it basically" — correct, and the original approach was simply wrong: MB does
// NOT store AcoustIDs as recording→URL relationships (verified: a recording
// with two AcoustIDs has zero url-rels). They live on AcoustID's own service.
// list_by_mbid needs no API key and supports batching, so one request covers
// up to ACOUSTID_BATCH recordings.
const ACOUSTID_BATCH = 50;
async function fetchAcoustIdsBatch(gids) {
    if (!gids.length) return new Map();
    const qs = gids.map(g => 'mbid=' + encodeURIComponent(g)).join('&');
    const url = 'https://api.acoustid.org/v2/track/list_by_mbid?' + qs + '&batch=1&format=json';
    const out = new Map();
    try {
        const r = await gmGet(url, { Accept: 'application/json' });
        if (r.status < 200 || r.status >= 300) { Log.warn('AcoustID lookup failed: HTTP ' + r.status); return out; }
        const j = JSON.parse(r.responseText || '{}');
        if (j.status !== 'ok') { Log.warn('AcoustID lookup returned status=' + j.status); return out; }
        for (const entry of j.mbids || []) out.set(entry.mbid, (entry.tracks || []).map(t => t.id));
    } catch (e) { Log.error('AcoustID lookup error: ' + e.message); }
    return out;
}
async function fetchAcoustIds(gid) {
    const map = await fetchAcoustIdsBatch([gid]);
    return map.get(gid) || [];
}

// ── pool / groups state ──────────────────────────────────────────────────
const STATE = { recordings: new Map(), poolOrder: [], groups: [], poolFilter: '', selected: null, activeGroupId: null, _dragSrc: null, releaseInfo: null, rgInfo: null,
    // #529: per-recording release tables, expanded on demand. The Map doubles as
    // the cache — a missing key means "never asked" (renders "loading…"), null
    // means the lookup failed, so a failed fetch doesn't retry on every render.
    expandedReleases: new Set(), releaseDetails: new Map(), collapsedGroups: new Set() };

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
        if (!confidence && shouldUnion(sig, SETTINGS.matchCutoff)) confidence = 'medium';
    }
    return { confidence: confidence || 'manual', signals: [...signals], signalsAll: [...all] };
}
function refreshGroupMeta(g) {
    const members = g.memberGids.map(x => STATE.recordings.get(x)).filter(Boolean);
    const meta = computeGroupConfidence(members);
    g.confidence = meta.confidence; g.signals = meta.signals; g.signalsAll = meta.signalsAll;
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
    const g = { id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: [gid], confidence: 'manual', signals: [], signalsAll: [], target: gid, state: 'pending', error: null, editNote: null, editing: false };
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
function clearBoard() {
    const n = STATE.groups.length;
    STATE.groups.slice().forEach(g => deleteGroup(g.id));
    Log.info('Cleared board — ' + n + ' group(s) dissolved, every member returned to the pool');
}

function pairSignals(a, b, tolMs) {
    const sig = { isrc: false, acoustid: false, length: false, title: false, artist: false, videoMismatch: false, pendingEdit: false, lengthConflict: false };
    if (a.editsPending || b.editsPending) sig.pendingEdit = true;
    // both lengths known and far apart — see shouldUnion. Unknown length never
    // counts as a conflict; it just means we can't tell.
    if (a.length != null && b.length != null && Math.abs(a.length - b.length) > (SETTINGS.grossLengthMs || 30000)) sig.lengthConflict = true;
    // null (unknown) video status never blocks — only a KNOWN true vs. false mismatch does.
    if (a.video != null && b.video != null && a.video !== b.video) sig.videoMismatch = true;
    if (a.isrcs.length && b.isrcs.length && a.isrcs.some(x => b.isrcs.includes(x))) sig.isrc = true;
    if (a.acoustids && b.acoustids && a.acoustids.length && b.acoustids.length && a.acoustids.some(x => b.acoustids.includes(x))) sig.acoustid = true;
    if (lengthClose(a.length, b.length, tolMs)) sig.length = true;
    if (a.title && b.title && titleSimilar(a.title, b.title)) sig.title = true;
    if (a.artistCredit && b.artistCredit && artistSimilar(a.artistCredit, b.artistCredit)) sig.artist = true;
    return sig;
}
function autoMatch(pool, tolMs, cutoff) {
    cutoff = cutoff || 'normal';
    if (pool.length < 2) return [];
    const parent = new Map(pool.map(r => [r.gid, r.gid]));
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    let lengthBlocked = 0;
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const sig = pairSignals(pool[i], pool[j], tolMs);
            // a pair that would otherwise have grouped, held back purely by the
            // gross-length guard — worth reporting rather than silently dropping
            if (sig.lengthConflict && (sig.isrc || sig.acoustid || (sig.title && sig.artist) || (sig.title && sig.length))) {
                lengthBlocked++;
                Log.info('  not grouped (length differs by ' + Math.round(Math.abs(pool[i].length - pool[j].length) / 1000) + 's): "'
                    + pool[i].title + '" ' + dur(pool[i].length) + ' vs "' + pool[j].title + '" ' + dur(pool[j].length));
            }
            if (shouldUnion(sig, cutoff)) union(pool[i].gid, pool[j].gid);
        }
    }
    if (lengthBlocked) Log.warn(lengthBlocked + ' pair(s) held back by the gross-length guard (>' + Math.round((SETTINGS.grossLengthMs || 30000) / 1000) + 's apart) — group them by hand if they really are the same take');
    const byRoot = new Map();
    for (const r of pool) { const root = find(r.gid); if (!byRoot.has(root)) byRoot.set(root, []); byRoot.get(root).push(r); }
    const groups = [];
    for (const members of byRoot.values()) {
        if (members.length < 2) continue;
        const meta = computeGroupConfidence(members);
        const target = members.slice().sort((a, b) => b.releases.length - a.releases.length)[0].gid;
        groups.push({ id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: members.map(m => m.gid), confidence: meta.confidence, signals: meta.signals, signalsAll: meta.signalsAll, target, state: 'pending', error: null, editNote: null, editing: false });
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
    for (let i = 0; i < pending.length; i += ACOUSTID_BATCH) {
        const slice = pending.slice(i, i + ACOUSTID_BATCH);
        const map = await fetchAcoustIdsBatch(slice.map(r => r.gid));
        slice.forEach(rec => {
            rec.acoustids = map.get(rec.gid) || [];
            if (rec.acoustids.length) found++;
        });
        done += slice.length;
        if (onProgress) onProgress(done, recs.length);
    }
    Log.info('AcoustID lookup: ' + found + ' of ' + pending.length + ' recording(s) have an AcoustID');
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
                rec.isrcsKnown = true;
            }
            done++; if (onProgress) onProgress(done, pending.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
}

// ── merge submission (verified live against test.musicbrainz.org — GET
// /recording/merge_queue?add-to-merge=<id>×N redirects to /recording/merge, whose
// self-posting form has merge.merging.N / merge.target / merge.edit_note /
// merge.make_votable and no CSRF token, session cookie authorises) ──────────
// #529 (majkinetor): "we should also have more precise log message … says
// similar title while title is the same. Check also how other userscript does
// it." Modelled on jesus2099's MASS MERGE RECORDINGS note: itemised evidence
// carrying the ACTUAL values, and distinguishing an exact match from a close
// one, so a reviewer can judge the merge without opening anything.
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
            : 'Max length difference ' + Math.round((hi - lo) / 1000) + 's (' + dur(lo) + ' – ' + dur(hi) + ')');
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
    const out = ['Merge ' + members.length + ' recordings into ' + (target ? '"' + target.title + '"' : 'one') + (keptUrl ? ': ' + keptUrl : '.')];
    if (lines.length) { out.push(''); lines.forEach(l => out.push('- ' + l)); }
    else out.push('', '- Grouped manually; no automatic signal matched across every recording.');
    // Partial signals are stated as partial rather than silently omitted — and
    // length gets a concrete number instead of a bare "matching only some of
    // them: length", which said nothing about how far apart they actually were.
    const partial = (group.signals || []).filter(x => !(group.signalsAll || []).includes(x));
    const rest = partial.filter(x => x !== 'length');
    if (partial.includes('length')) {
        const spread = lengthSpread(members);
        if (spread != null) out.push('', 'Max length difference: ' + Math.round(spread / 1000) + 's');
        else rest.push('length');
    }
    if (rest.length) out.push('', 'Matching only some of them: ' + rest.join(', ') + '.');
    return out.join('\n');
}
// #529 (majkinetor): a per-group edit note, editable from the card. A custom
// note REPLACES the auto-generated reason line; the attribution footer is
// always appended so the edit stays traceable either way.
function buildEditNote(group) {
    const body = (group.editNote && group.editNote.trim()) ? group.editNote.trim() : autoEditNote(group);
    return body + '\n\nFusion v' + VERSION + ' by majkinetor - ' + HELP_URL;
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
        const gr = await gmGet(location.origin + '/recording/merge_queue?' + addQs, { Accept: 'text/html' });
        if (gr.status < 200 || gr.status >= 400) throw new Error('merge_queue GET failed: HTTP ' + gr.status);
        const mergeUrl = gr.finalUrl || (location.origin + '/recording/merge');
        Log.info('  merge_queue redirected to ' + mergeUrl);
        const body = new URLSearchParams();
        ids.forEach((id, i) => body.append('merge.merging.' + i, String(id)));
        body.append('merge.target', String(targetId));
        const note = buildEditNote(group);
        body.append('merge.edit_note', note);
        if (SETTINGS.makeVotable) body.append('merge.make_votable', '1');
        Log.info('  edit note: ' + note.replace(/\n/g, ' ¶ '));
        const pr = await gmPost(mergeUrl, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Referer: mergeUrl, Origin: location.origin });
        if (pr.status >= 400) throw new Error('merge POST failed: HTTP ' + pr.status);
        const finalUrl = pr.finalUrl || '';
        const reRendered = /\/recording\/merge(\?|$)/.test(finalUrl) || /name="merge\.target"/.test(pr.responseText || '');
        Log.info('  POST landed at ' + finalUrl + (reRendered ? ' (still the merge form — treating as failure)' : ' (redirected away — success)'));
        if (reRendered) throw new Error('merge form returned an error (nothing submitted) — check you are logged in with merge privileges');
        group.state = 'done';
        Log.ok('✓ Merged group ' + group.id + ' → ' + finalUrl);
    } catch (e) {
        group.state = 'error'; group.error = e.message;
        Log.error('✗ Merge failed for group ' + group.id + ': ' + e.message);
    }
    busyEnd();
    renderGroups(); renderFooter();
}
// #529 follow-up (majkinetor): "Merge all should be parallel if possible" —
// each merge is its own GET+POST pair, independent of every other group's, so
// a small worker pool runs several at once instead of one strictly after
// another. Capped (not unbounded) to stay reasonable towards MB's server.
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
    Log.info('══ Merge All: ' + pending.length + ' group(s) queued, up to ' + workers + ' in parallel ══');
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
    Log.info('══ Merge All finished: ' + doneCount + ' merged, ' + failCount + ' failed (of ' + pending.length + ') ══');
    } finally { busyEnd(); }
}

/* ════════════════════════════════ UI ════════════════════════════════ */
function fsStyle() {
    if (document.getElementById('fs-style')) return;
    const s = el('style'); s.id = 'fs-style';
    s.textContent = ''
        + '.fs-launch{position:fixed;z-index:2147483000;background:linear-gradient(180deg,#8a5cf6,#6d3ff0);color:#fff;border:1px solid #6d3ff0;border-radius:8px;padding:8px 14px;font:600 13px -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}'
        + '.fs-launch:hover{filter:brightness(1.08)}'
        + '.fs-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483000;display:flex;align-items:center;justify-content:center}'
        // Light palette (#529: "make UI white") — every colour in the window is
        // driven from these tokens, so the theme is this one line plus the log
        // panel below. Purple/green/amber/red darkened for contrast on white.
        + '.fs-cons{--fs-bg:#f7f8fa;--fs-panel:#fff;--fs-panel2:#fbfbfd;--fs-border:#e3e3ec;--fs-text:#1e1e26;--fs-muted:#6b6b7d;--fs-purple:#6d3ff0;--fs-purple-d:#5a2fd8;--fs-green:#1c9b63;--fs-amber:#a8702a;--fs-red:#c8384f;--fs-blue:#2f7fbf;'
        + 'width:min(1180px,calc(100% - 24px));height:min(680px,92vh);max-width:calc(100% - 16px);max-height:96vh;min-width:640px;min-height:400px;resize:both;'
        + 'background:var(--fs-panel);color:var(--fs-text);border:1px solid var(--fs-border);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);'
        + 'font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden}'
        + '.fs-cons.fs-maximized{position:fixed !important;left:8px !important;top:8px !important;right:8px !important;bottom:8px !important;width:auto !important;height:auto !important;max-width:none !important;max-height:none !important;margin:0 !important}'
        + '.fs-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--fs-panel2);border-bottom:1px solid var(--fs-border);cursor:move}'
        + '.fs-title{font-weight:700;font-size:14px}'
        + '.fs-scope{color:var(--fs-muted);font-size:12px}'
        + '.fs-busy{color:var(--fs-purple-d);font-size:12px;font-weight:600;animation:fs-pulse 1.1s ease-in-out infinite;white-space:nowrap}'
        + '@keyframes fs-pulse{0%,100%{opacity:1}50%{opacity:.25}}'
        + '.fs-sp{flex:1}'
        + '.fs-cons-x{background:none;border:none;font-size:16px;color:#8892a0;cursor:pointer;padding:2px 8px;border-radius:5px;line-height:1}'
        + '.fs-cons-x:hover{background:rgba(0,0,0,.06);color:var(--fs-text)}'
        + '.fs-cfgbtn,.fs-x{color:var(--fs-muted);cursor:pointer;font-size:15px;padding:2px 6px}'
        + '.fs-cfgbtn:hover,.fs-x:hover{color:var(--fs-text)}'
        + '.fs-ctrl{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--fs-panel);border-bottom:1px solid var(--fs-border);flex-wrap:wrap}'
        + '.fs-ctrl select,.fs-ctrl input[type=text]{background:var(--fs-panel2);border:1px solid var(--fs-border);color:var(--fs-text);border-radius:6px;padding:5px 8px;font-size:12px}'
        + '#fs-rg-editions{max-width:420px}'
        + '#fs-rg-editions:disabled{opacity:.7;font-style:italic;cursor:default}'
        + '.fs-ctrl input[type=text]{width:220px}'
        + '.fs-btn{border:1px solid var(--fs-border);background:var(--fs-panel2);color:var(--fs-text);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}'
        + '.fs-btn.fs-primary{background:linear-gradient(180deg,var(--fs-purple),var(--fs-purple-d));border-color:var(--fs-purple-d);color:#fff;font-weight:600}'
        + '.fs-btn:disabled{opacity:.5;cursor:default}'
        + '.fs-netbanner{padding:7px 14px;font-size:12px;font-weight:600;background:rgba(168,112,42,.14);color:#8a5a1f;border-bottom:1px solid rgba(168,112,42,.4)}'
        + '.fs-netbanner.fs-netbanner-err{background:rgba(200,56,79,.12);color:var(--fs-red);border-bottom-color:rgba(200,56,79,.45)}'
        + '.fs-legend{display:flex;gap:10px;color:var(--fs-muted);font-size:11px;align-items:center}'
        + '.fs-body{display:flex;flex:1;min-height:0}'
        + '.fs-col{display:flex;flex-direction:column;min-width:0;min-height:0}'
        + '.fs-pool{width:360px;border-right:1px solid var(--fs-border);background:var(--fs-bg)}'
        + '.fs-groups{flex:1;background:var(--fs-panel)}'
        + '.fs-colhdr{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--fs-border);font-weight:700;font-size:12px;letter-spacing:.3px;color:var(--fs-muted);text-transform:uppercase;background:var(--fs-panel2)}'
        + '.fs-cnt{background:var(--fs-panel);border:1px solid var(--fs-border);border-radius:10px;padding:1px 7px;color:var(--fs-text);font-weight:600}'
        + '.fs-hint{text-transform:none;font-weight:400;color:var(--fs-muted)}'
        + '.fs-poolfilter{flex:1;min-width:0;max-width:210px;box-sizing:border-box;background:var(--fs-panel);border:1px solid var(--fs-border);color:var(--fs-text);border-radius:6px;padding:3px 8px;font:400 11.5px -apple-system,Segoe UI,Arial,sans-serif;text-transform:none;letter-spacing:0}'
        + '.fs-poolfilter:focus{outline:none;border-color:var(--fs-purple)}'
        + '.fs-cnt.fs-cnt-filtered{color:var(--fs-purple-d);border-color:var(--fs-purple)}'
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
        + '.fs-grip{color:#b6b6c4;font-size:12px;letter-spacing:-1px}'
        + '.fs-info{flex:1;min-width:0}'
        + '.fs-t{font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        // #529 follow-up (majkinetor, screenshot): "you can see merged item no
        // link" — the <a> was always there and functional (verified: real href,
        // pointer-events:auto even after a merge), but color:inherit +
        // text-decoration:none until hover made every link visually identical
        // to plain text at rest, so it genuinely read as "no link" on sight.
        + '.fs-t a{color:var(--fs-purple);text-decoration:underline;text-decoration-color:rgba(109,63,240,.4)}'
        + '.fs-t a:hover{color:var(--fs-purple);text-decoration-color:var(--fs-purple)}'
        + '.fs-artist{font-weight:400;color:var(--fs-muted);font-size:11.5px}'
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
        + '.fs-b{width:6px;height:6px;border-radius:50%;background:#ccccd8}'
        + '.fs-b-isrc.fs-b-on{background:var(--fs-green)} .fs-b-acid.fs-b-on{background:var(--fs-blue)}'
        + '.fs-b-unknown{background:transparent;box-shadow:inset 0 0 0 1px #ccccd8}'
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
        + '.fs-ghdr{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,0,0,.025);border-bottom:1px solid var(--fs-border);cursor:pointer}'
        // Collapse/expand toggles. Full-size glyph AND a generous hit area (#419,
        // #467, #529 — third recurrence of the same rule). ▶/▼ are the full-size
        // triangles; ▸/▾ are Unicode's *small* ones and read as shrunken however
        // much padding is wrapped around them.
        + '.fs-ctog,.fs-exp{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:2px 5px;border-radius:3px;cursor:pointer;color:var(--fs-muted);font-size:14px;line-height:1;flex-shrink:0}'
        + '.fs-ctog:hover,.fs-exp:hover{background:rgba(0,0,0,.07);color:var(--fs-text)}'
        + '.fs-gcard-collapsed .fs-ghdr{border-bottom:none}'
        + '.fs-cnt{font-size:10.5px;color:var(--fs-muted);white-space:nowrap}'
        // The release table must scroll INSIDE the card — it has far more columns
        // than the card is wide, and letting it stretch would blow out the layout.
        + '.fs-reltbl{overflow-x:auto;margin:0 0 6px 30px;border:1px solid var(--fs-border);border-radius:4px;background:#fff}'
        + '.fs-reltbl table{border-collapse:collapse;font-size:10.5px;width:100%}'
        + '.fs-reltbl th{text-align:left;font-weight:600;padding:4px 7px;border-bottom:1px solid var(--fs-border);white-space:nowrap;background:rgba(0,0,0,.03)}'
        + '.fs-reltbl td{padding:3px 7px;border-bottom:1px solid rgba(0,0,0,.05);white-space:nowrap}'
        + '.fs-reltbl tr:last-child td{border-bottom:none}'
        + '.fs-relband td{font-weight:600;background:rgba(0,0,0,.05);color:var(--fs-text)}'
        + '.fs-relload,.fs-relerr,.fs-relempty{padding:6px 9px;font-size:10.5px;color:var(--fs-muted)}'
        + '.fs-relerr{color:var(--fs-red)}'
        + '.fs-gt{font-weight:700;font-size:12.5px}'
        + '.fs-gt a{color:var(--fs-purple);text-decoration:underline;text-decoration-color:rgba(109,63,240,.4)}'
        + '.fs-gt a:hover{color:var(--fs-purple);text-decoration-color:var(--fs-purple)}'
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
        + '.fs-sig span{font-size:9.5px;padding:1px 5px;border-radius:4px;background:var(--fs-panel);border:1px solid var(--fs-border);color:var(--fs-muted);opacity:.55}'
        + '.fs-sig span.hit{background:rgba(28,155,99,.16);border-color:rgba(28,155,99,.7);color:#0f6b45;font-weight:700;opacity:1}'
        + '.fs-sig span.partial{border-style:dashed;border-color:rgba(28,155,99,.5);color:#3f8f6b;opacity:.85}'
        + '.fs-mergeicon{vertical-align:-2px;margin-right:2px}'
        + '.fs-mbtn{font-size:11px;padding:3px 9px;border-radius:5px;border:1px solid var(--fs-purple-d);background:rgba(109,63,240,.1);color:var(--fs-purple-d);cursor:pointer;font-weight:600}'
        + '.fs-mbtn.fs-done{background:rgba(28,155,99,.12);border-color:var(--fs-green);color:var(--fs-green);cursor:default}'
        + '.fs-mbtn.fs-err{background:rgba(200,56,79,.1);border-color:var(--fs-red);color:var(--fs-red)}'
        // shared-identifier tints (#529) — one colour per distinct value shared
        // by 2+ members of a card, so agreeing rows are obvious at a glance.
        + '.fs-idc0,.fs-idc1,.fs-idc2,.fs-idc3,.fs-idc4,.fs-idc5{border-radius:3px;padding:1px 4px;font-weight:600}'
        + '.fs-idc0{background:rgba(28,155,99,.16);color:#0f6b45 !important}'
        + '.fs-idc1{background:rgba(47,127,191,.16);color:#1f5f92 !important}'
        + '.fs-idc2{background:rgba(168,112,42,.18);color:#8a5a1f !important}'
        + '.fs-idc3{background:rgba(109,63,240,.14);color:#5a2fd8 !important}'
        + '.fs-idc4{background:rgba(200,56,79,.14);color:#a82c40 !important}'
        + '.fs-idc5{background:rgba(20,140,150,.16);color:#0d6b73 !important}'
        + '.fs-rec-video{display:inline-flex;vertical-align:-2px;color:#6f42c1;margin-left:1px}'
        + '.fs-rec-video svg{display:block}'
        + '.fs-pending{background:rgba(168,112,42,.15);color:#8a5a1f;border:1px solid rgba(168,112,42,.4);border-radius:3px;padding:0 4px;font-size:9.5px;font-weight:700;white-space:nowrap}'
        + '.fs-gcard.fs-has-pending{border-left-color:var(--fs-amber) !important;border-left-style:dashed !important}'
        + '.fs-note-btn{cursor:pointer;font-size:12px;padding:1px 6px;border-radius:4px;border:1px solid var(--fs-border);color:var(--fs-muted);background:var(--fs-panel2);flex-shrink:0}'
        + '.fs-note-btn:hover{color:var(--fs-text);border-color:var(--fs-muted)}'
        + '.fs-note-btn.fs-has-note{background:rgba(109,63,240,.12);border-color:var(--fs-purple);color:var(--fs-purple-d);font-weight:700}'
        + '.fs-note-wrap{padding:8px 10px 10px}'
        + '.fs-note-ta{width:100%;box-sizing:border-box;min-height:110px;resize:vertical;font:12px ui-monospace,Consolas,monospace;color:var(--fs-text);background:var(--fs-panel2);border:1px solid var(--fs-border);border-radius:6px;padding:7px 9px}'
        + '.fs-note-ta:focus{outline:none;border-color:var(--fs-purple)}'
        + '.fs-note-hint{color:var(--fs-muted);font-size:10.5px;margin-top:5px}'
        + '.fs-gcard.fs-editing{border-left-color:var(--fs-purple);border-left-style:solid}'
        + '.fs-note-save,.fs-note-cancel,.fs-note-clear{padding:2px 10px;font-size:11px}'
        + '.fs-note-save{background:linear-gradient(180deg,var(--fs-purple),var(--fs-purple-d));border-color:var(--fs-purple-d);color:#fff;font-weight:600}'
        + '.fs-kill{cursor:pointer;font-size:13px;padding:2px 4px;opacity:.6}'
        + '.fs-kill:hover{opacity:1}'
        + '.fs-clearboard-btn{padding:2px 8px;font-size:11px;text-transform:none;font-weight:400;letter-spacing:0}'
        + '.fs-grows{padding:4px 6px}'
        + '.fs-grow{display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:5px}'
        + '.fs-grow:hover{background:rgba(0,0,0,.035)}'
        // no target-row wash: the ★ and the row's position at the top of the card already say which recording is kept (#529).
        + '.fs-star{width:16px;flex-shrink:0;text-align:center;font-size:13px;color:#b6b6c4;cursor:pointer;opacity:0;transition:opacity .1s}'
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
        + '.fs-grow .fs-isrc{box-sizing:border-box;color:var(--fs-muted);font-size:10px;width:96px;flex-shrink:0;font-family:ui-monospace,Consolas,monospace}'
        + '.fs-acts{display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity .1s}'
        + '.fs-grow:hover .fs-acts{opacity:1}'
        + '.fs-acts span{color:var(--fs-muted);cursor:pointer;font-size:12px;padding:1px 3px}'
        + '.fs-acts span:hover{color:var(--fs-text)}'
        + '.fs-rm-x:hover{color:var(--fs-red) !important}'
        + '.fs-gerr{margin:0 8px 6px;padding:5px 8px;background:rgba(200,56,79,.09);border:1px solid rgba(200,56,79,.35);border-radius:5px;color:var(--fs-red);font-size:11px}'
        + '.fs-gdrop{margin:6px 8px 8px;border:1px dashed var(--fs-border);border-radius:6px;padding:6px;text-align:center;color:var(--fs-muted);font-size:10.5px}'
        + '.fs-newgroup{border:1px dashed var(--fs-border);border-radius:7px;padding:9px;text-align:center;color:var(--fs-muted);font-size:12px;cursor:pointer}'
        + '.fs-ftr{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--fs-panel2);border-top:1px solid var(--fs-border)}'
        + '.fs-idmore{color:var(--fs-muted);font-size:9px}'
        + '.fs-idstat{white-space:nowrap;cursor:help}'
        + '.fs-idstat-none{color:var(--fs-muted)}'
        + '.fs-sum{color:var(--fs-muted);font-size:12px}'
        + '.fs-sum b{color:var(--fs-text)}'
        + '.fs-note{color:var(--fs-muted);font-size:11px}'
        + '.fs-settings{position:fixed;z-index:2147483001;background:#fff;color:#222;border:1px solid #cfd4da;border-radius:8px;padding:10px 14px;width:280px;box-shadow:0 8px 26px rgba(0,0,0,.25);font:13px -apple-system,Segoe UI,Arial,sans-serif}'
        + '.fs-settings h4{margin:0 0 8px;display:flex;align-items:center;gap:6px;font-size:14px}'
        + '.fs-settings .fs-ver{font-size:11px;color:#999;font-weight:normal}'
        + '.fs-settings .fs-logbtn{margin-left:auto;font-size:11px;padding:2px 8px;border:1px solid #ccc;border-radius:4px;background:#f5f5f7;cursor:pointer}'
        + '.fs-settings .fs-help{font-size:11px;color:#1DB954;text-decoration:none;border:1px solid #cfe9d6;border-radius:4px;padding:2px 8px}'
        + '.fs-opt{display:block;margin:8px 0;font-size:12px}'
        + '.fs-opt textarea{width:100%;box-sizing:border-box;margin-top:4px;font:12px inherit}'
        // log viewer — ported from apollo_editor's #283 window (wider, centred,
        // minimize/restore, badge, per-severity colouring), in Fusion's light palette.
        + '.fs-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:2147483002;display:flex;flex-direction:column;width:min(1240px,94vw);max-height:78vh;background:#fff;border:1px solid #cfc4ee;border-radius:11px;box-shadow:0 12px 40px rgba(40,20,80,.28);font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222;overflow:hidden}'
        + '.fs-logpop .fs-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid #e7e1f5;color:#563b8f;cursor:move;user-select:none}'
        + '.fs-logpop .fs-logpop-sp{margin-left:auto}'
        + '.fs-logpop .fs-log-badge{color:#9a8cba;font-size:11px}'
        + '.fs-logpop .fs-logpop-copy,.fs-logpop .fs-logpop-x,.fs-logpop .fs-logpop-min{font:12px Arial;color:#5f3ec0;background:#f5f1fc;border:1px solid #cec0ef;border-radius:5px;padding:2px 9px;cursor:pointer}'
        + '.fs-logpop .fs-logpop-copy:hover,.fs-logpop .fs-logpop-x:hover,.fs-logpop .fs-logpop-min:hover{background:#ebe3f9}'
        + '.fs-logpop.min .fs-log-list,.fs-logpop.min .fs-logpop-copy{display:none}'
        + '.fs-logpop.min{max-height:none;width:auto}'
        + '.fs-logpop.min .fs-logpop-sp{display:none}'
        + '.fs-logpop .fs-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;background:#fbfaff;padding:8px 11px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55}'
        + '.fs-logpop .fs-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}'
        + '.fs-logpop .fs-log-t{color:#a99fc2;flex:0 0 auto}'
        + '.fs-logpop .fs-log-m{flex:1 1 auto;color:#444}'
        + '.fs-logpop .fs-log-m a{color:#5f3ec0}'
        + '.fs-logpop .fs-log-ok .fs-log-m{color:#2e7d4f}'
        + '.fs-logpop .fs-log-warn .fs-log-m{color:#b06a00}'
        + '.fs-logpop .fs-log-error .fs-log-m{color:#c0344d}'
        + '.fs-logpop .fs-log-empty{color:#9a8cba}';
    document.head.appendChild(s);
}

// #529 follow-up: "make recordings names in the cards links that open
// recording MB page" — every place a recording's title is shown.
function recLink(gid, text) {
    return '<a href="' + location.origin + '/recording/' + gid + '" target="_blank" rel="noopener">' + escapeHtml(text) + '</a>';
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
function releasesSummary(rec) {
    const primary = rec.releases[0];
    const primaryText = primary ? (primary.title + (primary.trackNumber ? ' · track ' + primary.trackNumber : '')) : '(no release)';
    const full = rec.allReleases;
    if (full == null) return { text: primaryText + ' …', tooltip: primaryText + '\n(loading full release list…)' };
    const seen = new Set(); const lines = [];
    for (const r of full) { const key = r.gid || r.title; if (key && !seen.has(key)) { seen.add(key); lines.push(r.title + (r.date ? ' (' + r.date + ')' : '')); } }
    if (lines.length <= 1) return { text: primaryText, tooltip: lines[0] || primaryText };
    return { text: primaryText + ' +' + (lines.length - 1) + ' more', tooltip: lines.join('\n') };
}
// #529 follow-up: "Show video marker" — a visible badge, not just a
// behind-the-scenes exclusion rule, so it's obvious before you even try to group one.
// #529 (majkinetor): "use the same image for video recording as Apollo" —
// apollo_editor's #303 VIDEO_MARK, which itself mirrors MB's native recordings-table marker.
const MERGE_MARK = '<svg class="fs-mergeicon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v6a5 5 0 0 0 5 5h7"/><path d="M18 3v6a5 5 0 0 1-5 5h-2"/><polyline points="15 11 19 14 15 17"/></svg>';
const VIDEO_MARK = '<span class="fs-rec-video" title="This recording is a video"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></span>';
function videoBadge(rec) { return rec.video === true ? VIDEO_MARK + ' ' : ''; }
function pendingBadge(rec) { return rec.editsPending ? '<span class="fs-pending" title="This recording has pending edits in MusicBrainz — excluded from auto-match and blocked from merging until they are applied">⏳ pending</span> ' : ''; }
// #529 follow-up: "we should see isrc and accousticid in the card too" — the
// pool card only showed presence dots; show the actual values (AcoustID
// truncated, it's a 36-char UUID — full value is in the tooltip).
function idsLine(rec) {
    const isrc = (rec.isrcs && rec.isrcs[0]) || null;
    const acid = (rec.acoustids && rec.acoustids[0]) || null;
    if (!isrc && !acid) return '';
    let out = '<div class="fs-ids">';
    if (isrc) out += '<span class="fs-idtag" title="' + escapeHtml((rec.isrcs || []).join(', ')) + '">' + escapeHtml(isrc) + '</span>';
    if (acid) out += '<span class="fs-idtag" title="AcoustID ' + escapeHtml(acid) + '">' + escapeHtml(acid.slice(0, 8)) + '…</span>';
    return out + '</div>';
}
// A dot per identifier. "not looked up yet" is deliberately a THIRD state, not
// folded into "absent": with acoustids left null (lookup skipped or still
// running) an unlit dot would otherwise claim the recording has no AcoustID
// when nobody ever asked. Same reason isrcsKnown exists on the fetch side.
function presenceDots(rec) {
    const dot = (cls, label, list, known) => {
        const n = list ? list.length : 0;
        const state = !known ? 'unknown' : n ? 'on' : 'off';
        const title = state === 'unknown' ? label + ' not looked up yet'
            : state === 'on' ? n + ' ' + label + (n > 1 ? 's' : '') + ': ' + list.join(', ')
                : 'no ' + label + ' on this recording';
        return '<span class="fs-b fs-b-' + cls + ' fs-b-' + state + '" title="' + escapeHtml(title) + '"></span>';
    };
    return '<div class="fs-badges">'
        + dot('isrc', 'ISRC', rec.isrcs, rec.isrcsKnown)
        + dot('acid', 'AcoustID', rec.acoustids, rec.acoustids != null)
        + '</div>';
}
function poolCardHtml(rec) {
    const rs = releasesSummary(rec);
    return '<div class="fs-pcard" draggable="true" data-gid="' + rec.gid + '">'
        + '<span class="fs-grip">⠿</span>'
        + '<div class="fs-info"><div class="fs-t" title="' + escapeHtml(rec.title) + '">' + pendingBadge(rec) + videoBadge(rec) + recLink(rec.gid, rec.title) + (rec.artistCredit ? ' <span class="fs-artist">— ' + artistLink(rec) + '</span>' : '') + '</div>'
        + '<div class="fs-m" title="' + escapeHtml(rs.tooltip) + '">' + escapeHtml(rs.text) + ' · ' + dur(rec.length) + '</div>' + idsLine(rec) + '</div>'
        + presenceDots(rec)
        + '<span class="fs-rm" data-act="pool-remove" title="remove from pool">✕</span></div>';
}
// The expanded per-recording release table (#529). Columns follow MB's own
// merge-page table so the two can be read side by side, with a status band
// ("Official" / "Promotion" / …) heading each run exactly as MB does it.
async function toggleReleaseDetails(gid) {
    if (STATE.expandedReleases.has(gid)) { STATE.expandedReleases.delete(gid); renderGroups(); return; }
    STATE.expandedReleases.add(gid);
    renderGroups();                                  // show "loading…" straight away
    if (STATE.releaseDetails.has(gid)) return;       // cached (including a cached failure)
    const rec = STATE.recordings.get(gid);
    Log.info('Fetching full release details for ' + (rec ? describeRecordingForLog(rec) : gid));
    busyStart();
    try {
        const rows = await fetchReleaseDetails(gid);
        STATE.releaseDetails.set(gid, rows);
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
    let out = '<div class="fs-reltbl"><table><thead><tr>'
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
            + '<td>' + cell(r.trackTitle) + '</td>'
            + '<td>' + (r.trackLength ? dur(r.trackLength) : '—') + '</td>'
            + '<td>' + cell(r.trackArtist) + '</td>'
            + '<td><a href="/release/' + r.gid + '" target="_blank" rel="noopener">' + cell(r.title) + '</a></td>'
            + '<td>' + cell(r.artist) + '</td>'
            + '<td>' + cell([r.rgType, r.format].filter(Boolean).join(' · ')) + '</td>'
            + '<td>' + escapeHtml(cd) + '</td>'
            + '<td>' + cell(r.label) + '</td>'
            + '<td>' + cell(r.catalog) + '</td>'
            + '</tr>';
    }
    return out + '</tbody></table></div>';
}
function groupCardHtml(group) {
    const members = group.memberGids.map(g => STATE.recordings.get(g)).filter(Boolean);
    // #529 follow-up: "remove radios, make hover action that one is merge
    // target. It should also go to the top of the card" — the target member
    // sorts first, an always-visible star marks it, and a hover-only star on
    // the other rows sets a new target.
    const ordered = members.slice().sort((a, b) => (a.gid === group.target ? -1 : 0) - (b.gid === group.target ? -1 : 0));
    const confClass = group.confidence === 'high' ? 'high' : group.confidence === 'medium' ? 'med' : 'manual';
    const confLabel = group.confidence === 'high' ? 'HIGH' : group.confidence === 'medium' ? 'MEDIUM' : 'MANUAL';
    const sigNames = { isrc: 'ISRC', acoustid: 'AcoustID', length: 'Length', title: 'Title', artist: 'Artist' };
    const sigAll = group.signalsAll || [];
    const sigChips = Object.keys(sigNames).map(k => {
        const lit = sigAll.includes(k);
        const partial = !lit && (group.signals || []).includes(k);
        const title = lit ? sigNames[k] + ' matches across every recording in this group'
            : partial ? sigNames[k] + ' matches only some of these recordings, not all'
            : 'no ' + sigNames[k] + ' match';
        return '<span class="' + (lit ? 'hit' : partial ? 'partial' : '') + '" title="' + title + '">' + sigNames[k] + '</span>';
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
    const idCell = (list, isAcoustid) => {
        const vals = uniq(list || []);
        if (!vals.length) return '<span class="fs-isrc">—</span>';
        const val = vals.find(v => (idCounts.get(v) || 0) > 1) || vals[0];
        const cls = idColor.get(val) || '';
        const extra = vals.length - 1;
        const shown = (isAcoustid ? escapeHtml(val.slice(0, 8)) + '…' : escapeHtml(val))
            + (extra ? '<span class="fs-idmore"> +' + extra + '</span>' : '');
        const label = isAcoustid ? 'AcoustID' : 'ISRC';
        const title = label + ' ' + escapeHtml(val)
            + (cls ? ' — shared with another recording in this group' : '')
            + (extra ? ' — all ' + vals.length + ': ' + escapeHtml(vals.join(', ')) : '');
        return '<span class="fs-isrc ' + cls + '" title="' + title + '">' + shown + '</span>';
    };
    const rows = ordered.map(m => {
        const rs = releasesSummary(m);
        const isTarget = group.target === m.gid;
        const canPick = !busy && !done;
        const star = isTarget
            ? '<span class="fs-star fs-star-on" title="merge target — this one is kept">★</span>'
            : '<span class="fs-star' + (canPick ? '' : ' fs-star-disabled') + '" data-act="' + (canPick ? 'set-target' : '') + '" title="' + (canPick ? 'make this the merge target' : '') + '">☆</span>';
        const expanded = STATE.expandedReleases.has(m.gid);
        return '<div class="fs-growwrap">'
            + '<div class="fs-grow' + (isTarget ? ' fs-target-row' : '') + '" draggable="true" data-gid="' + m.gid + '">'
            + '<span class="fs-exp' + (expanded ? ' fs-exp-on' : '') + '" data-act="toggle-releases" title="' + (expanded ? 'hide' : 'show') + ' every release this recording appears on">' + (expanded ? '▼' : '▶') + '</span>'
            + star
            + '<span class="fs-t" title="' + escapeHtml(m.title) + '">' + pendingBadge(m) + videoBadge(m) + recLink(m.gid, m.title) + '</span>'
            + '<span class="fs-artistcol" title="' + escapeHtml(m.artistCredit || '') + '">' + artistLink(m) + '</span>'
            + '<span class="fs-rel" title="' + escapeHtml(rs.tooltip) + '">' + escapeHtml(rs.text) + '</span>'
            + '<span class="fs-len">' + dur(m.length) + '</span>'
            + idCell(m.isrcs, false)
            + idCell(m.acoustids, true)
            + '<span class="fs-acts"><span data-act="return" title="return to pool">↩</span><span class="fs-rm-x" data-act="remove-both" title="remove from group + pool">✕</span></span></div>'
            + (expanded ? releaseTableHtml(m) : '')
            + '</div>';
    }).join('');
    const errMsg = group.state === 'error' ? '<div class="fs-gerr">' + escapeHtml(group.error || 'merge failed') + '</div>' : '';
    const dropZone = done ? '' : '<div class="fs-gdrop" data-act="drop-zone">drop from pool to add another recording to this group</div>';
    const activeCls = (STATE.activeGroupId === group.id ? ' fs-active' : '') + (members.some(m => m.editsPending) ? ' fs-has-pending' : '');
    const head = ordered[0];
    const hasNote = !!(group.editNote && group.editNote.trim());
    // #529 (majkinetor): "add in each card edit button in the title - clicking it
    // should transform entire card into textbox for edit note … If there is edit
    // note, button should be different color."
    const noteBtn = '<span class="fs-note-btn' + (hasNote ? ' fs-has-note' : '') + '" data-act="edit-note" title="'
        + (hasNote ? 'Custom edit note set — click to edit' : 'Add a custom edit note for this merge') + '">✎</span>';
    if (group.editing) {
        const draft = group.editNote != null ? group.editNote : autoEditNote(group);
        return '<div class="fs-gcard fs-gcard-' + confClass + activeCls + ' fs-editing" data-gid="' + group.id + '">'
            + '<div class="fs-ghdr"><span class="fs-gt">✎ Edit note — ' + escapeHtml(head ? head.title : 'group') + '</span><div class="fs-sp"></div>'
            + '<button class="fs-btn fs-note-save" type="button" data-act="note-save">Save</button>'
            + '<button class="fs-btn fs-note-cancel" type="button" data-act="note-cancel">Cancel</button>'
            + (hasNote ? '<button class="fs-btn fs-note-clear" type="button" data-act="note-clear" title="revert to the auto-generated note">Reset</button>' : '')
            + '</div>'
            + '<div class="fs-note-wrap"><textarea class="fs-note-ta" spellcheck="false" placeholder="Edit note submitted with this merge…">' + escapeHtml(draft) + '</textarea>'
            + '<div class="fs-note-hint">Replaces the auto-generated reason line. Fusion\'s attribution footer is always appended.</div></div></div>';
    }
    // #529: "We should also be able to collapse entire card." Collapsed keeps the
    // header — confidence, chips and Merge stay usable — and hides only the rows,
    // so a long board can be skimmed without losing the ability to act on it.
    const collapsed = STATE.collapsedGroups.has(group.id);
    return '<div class="fs-gcard fs-gcard-' + confClass + activeCls + (collapsed ? ' fs-gcard-collapsed' : '') + '" data-gid="' + group.id + '">'
        + '<div class="fs-ghdr">'
        + '<span class="fs-ctog" data-act="toggle-card" title="' + (collapsed ? 'expand this group' : 'collapse this group') + '">' + (collapsed ? '▶' : '▼') + '</span>'
        + '<span class="fs-gt" title="' + escapeHtml(head ? head.title : '') + '">' + (head ? recLink(head.gid, head.title) : 'New group') + '</span>'
        + (collapsed ? '<span class="fs-cnt">' + members.length + ' recording' + (members.length === 1 ? '' : 's') + '</span>' : '')
        + noteBtn
        + '<span class="fs-conf fs-conf-' + confClass + '">' + confLabel + '</span>'
        + '<div class="fs-sig">' + sigChips + '</div><div class="fs-sp"></div>'
        + '<button class="fs-mbtn ' + stateCls + '" type="button" data-act="merge-group" ' + (busy || done || tooFew ? 'disabled' : '') + '>' + stateLabel + '</button>'
        + '<span class="fs-kill" data-act="delete-group" title="delete this group — members return to the pool" ' + (busy ? 'style="display:none"' : '') + '>🗑</span></div>'
        + (collapsed ? '' : '<div class="fs-grows">' + rows + '</div>' + errMsg + dropZone) + '</div>';
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
function renderPool() {
    const body = document.getElementById('fs-pool-body'); if (!body) return;
    const q = STATE.poolFilter || '';
    const all = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
    const recs = q ? all.filter(r => poolMatches(r, q)) : all;
    const cnt = document.getElementById('fs-pool-cnt');
    if (cnt) { cnt.textContent = q ? recs.length + ' / ' + all.length : String(all.length); cnt.classList.toggle('fs-cnt-filtered', !!q); }
    body.innerHTML = recs.length
        ? recs.map(poolCardHtml).join('')
        : '<div class="fs-empty">' + (q ? 'No pool recording matches “' + escapeHtml(q) + '”.' : 'Pool is empty — add a recording by MBID/URL above.') + '</div>';
    if (STATE.selected) { const c = body.querySelector('[data-gid="' + STATE.selected + '"]'); if (c) c.classList.add('fs-selected'); }
}
function renderGroups() {
    const body = document.getElementById('fs-groups-body'); if (!body) return;
    document.getElementById('fs-groups-cnt').textContent = String(STATE.groups.length);
    body.innerHTML = STATE.groups.map(groupCardHtml).join('') + '<div class="fs-newgroup" id="fs-newgroup">+ New group — drag a pool recording here, or select one and click here</div>';
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
    const isrcKnown = all.filter(r => r.isrcsKnown);
    const withIsrc = isrcKnown.filter(r => r.isrcs && r.isrcs.length).length;
    const acidKnown = all.filter(r => r.acoustids != null);
    const withAcid = acidKnown.filter(r => r.acoustids.length).length;
    const idPart = (label, n, known, total) => {
        if (!known) return '<span class="fs-idstat fs-idstat-none" title="' + label + 's have not been looked up yet">' + label + ' —</span>';
        const pending = total - known;
        return '<span class="fs-idstat" title="' + n + ' of ' + known + ' checked recording(s) have an ' + label
            + (pending ? '; ' + pending + ' not looked up yet' : '') + '"><b>' + n + '</b>/' + known + ' ' + label + (pending ? '*' : '') + '</span>';
    };
    if (sum) sum.innerHTML = '<b>' + STATE.groups.length + '</b> group' + (STATE.groups.length === 1 ? '' : 's') + ' · <b>' + ready + '</b> ready' + (done ? ' · <b>' + done + '</b> merged' : '') + ' · <b>' + STATE.poolOrder.length + '</b> in pool'
        + ' · ' + idPart('ISRC', withIsrc, isrcKnown.length, all.length)
        + ' · ' + idPart('AcoustID', withAcid, acidKnown.length, all.length);
    const btn = document.getElementById('fs-mergeall');
    if (btn) { btn.disabled = ready === 0; btn.textContent = '⚡ Merge All (' + ready + ') →'; }
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
function busyStart(label) { _busyCount++; if (label) _busyLabel = label; renderBusy(); }
function busyEnd() { _busyCount = Math.max(0, _busyCount - 1); if (_busyCount === 0) _busyLabel = ''; renderBusy(); }
async function withBusy(label, fn) { busyStart(label); try { return await fn(); } finally { busyEnd(); } }

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

async function onAutoMatch() {
    const btn = document.getElementById('fs-automatch'); if (!btn) return;
    btn.disabled = true; const orig = btn.textContent;
    btn.textContent = 'Matching…';
    busyStart('auto-matching…');
    try {
        const poolRecs = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
        Log.info('Auto-match starting on ' + poolRecs.length + ' pool recording(s), cutoff=' + SETTINGS.matchCutoff);
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
        let groupings = autoMatch(poolRecs, SETTINGS.lengthToleranceMs, SETTINGS.matchCutoff);
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
        Log.info('Auto-match formed ' + groupings.length + ' group(s) from ' + poolRecs.length + ' pool recording(s)');
        groupings.forEach(g => {
            Log.info('  formed group ' + g.id + ' — confidence=' + g.confidence + ' signals=[' + g.signals.join(',') + ']');
            g.memberGids.forEach(gid => Log.info('    ' + gid + (gid === g.target ? ' (target)' : '') + ': ' + describeRecordingForLog(STATE.recordings.get(gid))));
        });
        for (const g of groupings) {
            g.memberGids.forEach(gid => { const i = STATE.poolOrder.indexOf(gid); if (i !== -1) STATE.poolOrder.splice(i, 1); });
            STATE.groups.push(g);
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
            STATE.activeGroupId = STATE.activeGroupId === card.dataset.gid ? null : card.dataset.gid;
            renderGroups(); return;
        }
        if (act === 'toggle-releases' && row) { toggleReleaseDetails(row.dataset.gid); return; }
        if (act === 'toggle-card') {
            const id = card.dataset.gid;
            if (STATE.collapsedGroups.has(id)) STATE.collapsedGroups.delete(id); else STATE.collapsedGroups.add(id);
            renderGroups(); return;
        }
        if (act === 'set-target' && row) { const g = findGroup(card.dataset.gid); if (g) { g.target = row.dataset.gid; renderGroups(); } return; }
        if (act === 'return' && row) { returnToPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'remove-both' && row) { removeFromGroupAndPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'merge-group') { mergeGroup(findGroup(card.dataset.gid)); return; }
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
        if (act === 'drop-zone' && STATE.selected && STATE.poolOrder.includes(STATE.selected)) { if (addToGroup(STATE.selected, card.dataset.gid)) STATE.activeGroupId = card.dataset.gid; STATE.selected = null; renderAll(); return; }
    });
    // "entire zone" drag&drop (#529 follow-up): dropping anywhere over a group
    // card adds to THAT group; dropping on #fs-newgroup OR on empty background
    // (not over any card) creates a new group — not just a narrow strip. One
    // listener on the outer column; children's events bubble up to it.
    groupsCol.addEventListener('dragover', e => { if (STATE._dragSrc) e.preventDefault(); });
    groupsCol.addEventListener('drop', e => {
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
    s.innerHTML = '<h4>' + ICON + ' Fusion <span class="fs-ver" title="installed script version">v' + VERSION + '</span><button class="fs-logbtn" type="button" title="Open the activity log">Log</button><a class="fs-help" href="' + HELP_URL + '" target="_blank" rel="noopener" title="open the README in a new tab">? Help</a></h4>'
        + '<label class="fs-opt"><input type="checkbox" id="fs-opt-votable"> Always require a vote (make_votable)</label>'
        + '<label class="fs-opt"><input type="checkbox" id="fs-opt-acoustid"> Look up AcoustIDs (acoustid.org, batched)</label>'
        + '<label class="fs-opt" title="Run Auto-match by itself as soon as the pool has finished loading, instead of waiting for you to press the button."><input type="checkbox" id="fs-opt-automatch"> Auto-match on open</label>'
        + '<label class="fs-opt">Length tolerance <input type="number" id="fs-opt-tol" min="0" max="60" style="width:48px"> s</label>'
        + '<label class="fs-opt" title="Auto-match never groups two recordings whose known lengths differ by more than this, whatever else matches. Manual grouping is unaffected.">Never auto-group if lengths differ by more than <input type="number" id="fs-opt-gross" min="5" max="600" style="width:56px"> s</label>';
    document.body.appendChild(s);
    const r = anchor.getBoundingClientRect();
    s.style.top = (r.bottom + 6) + 'px'; s.style.right = '14px';
    s.querySelector('#fs-opt-votable').checked = !!SETTINGS.makeVotable;
    s.querySelector('#fs-opt-acoustid').checked = SETTINGS.acoustidEnrich !== false;
    s.querySelector('#fs-opt-automatch').checked = !!SETTINGS.autoMatchOnOpen;
    s.querySelector('#fs-opt-tol').value = Math.round(SETTINGS.lengthToleranceMs / 1000);
    s.querySelector('#fs-opt-gross').value = Math.round((SETTINGS.grossLengthMs != null ? SETTINGS.grossLengthMs : 30000) / 1000);
    s.querySelector('#fs-opt-votable').onchange = e => { SETTINGS.makeVotable = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-acoustid').onchange = e => { SETTINGS.acoustidEnrich = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-automatch').onchange = e => { SETTINGS.autoMatchOnOpen = e.target.checked; saveSettings(); Log.info('Auto-match on open: ' + (SETTINGS.autoMatchOnOpen ? 'on' : 'off')); };
    s.querySelector('#fs-opt-tol').onchange = e => { SETTINGS.lengthToleranceMs = Math.max(0, Number(e.target.value) || 0) * 1000; saveSettings(); };
    s.querySelector('#fs-opt-gross').onchange = e => { SETTINGS.grossLengthMs = Math.max(5, Number(e.target.value) || 30) * 1000; saveSettings(); Log.info('Gross-length guard set to ' + Math.round(SETTINGS.grossLengthMs / 1000) + 's'); };
    s.querySelector('.fs-logbtn').onclick = () => { s.remove(); openLog(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
}

// #529 follow-up: "Window should be movable and maximizable" — remembered
// across opens the same way apollo_editor's log popup remembers its position.
const WINSTATE_KEY = 'fusion.winstate';
function loadWinState() { try { return JSON.parse(GM_getValue(WINSTATE_KEY, '{}')); } catch (e) { return {}; } }
function saveWinState(patch) { try { GM_setValue(WINSTATE_KEY, JSON.stringify(Object.assign(loadWinState(), patch))); } catch (e) {} }
function applyWinState(cons) {
    const st = loadWinState();
    if (st.maximized) { cons.classList.add('fs-maximized'); const mb = document.getElementById('fs-max'); if (mb) { mb.textContent = '❐'; mb.title = 'Restore'; } return; }
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
    if (btn) { btn.textContent = nowMax ? '❐' : '⛶'; btn.title = nowMax ? 'Restore' : 'Maximize'; }
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
    if (document.getElementById('fs-logpop') || document.getElementById('fs-settings')) return;
    closeFusion();
}
function buildShell() {
    document.getElementById('fs-overlay')?.remove();
    const overlay = el('div', 'fs-overlay'); overlay.id = 'fs-overlay';
    const CUTOFF_HELP = {
        strict: 'Strict — group only on a shared identifier (ISRC or AcoustID). Fewest, safest matches.',
        normal: 'Normal — a shared identifier, or title AND artist AND a close length together.',
        loose: 'Loose — a shared identifier, or title with either a close length or a matching artist. Most matches, needs the most review.',
    };
    const cutoffOpts = MATCH_CUTOFFS.map(c => '<option value="' + c + '"' + (SETTINGS.matchCutoff === c ? ' selected' : '') + ' title="' + escapeHtml(CUTOFF_HELP[c] || '') + '">' + c[0].toUpperCase() + c.slice(1) + '</option>').join('');
    overlay.innerHTML = '<div class="fs-cons" id="fs-cons">'
        + '<div class="fs-hdr" id="fs-hdr"><div class="fs-title">' + ICON + ' Fusion — Merge Recordings</div><span class="fs-busy" id="fs-busy" style="display:none"></span><div class="fs-scope" id="fs-scope">…</div><div class="fs-sp"></div>'
        + '<button class="fs-cons-x" id="fs-max" type="button" title="Maximize / restore">⛶</button><button class="fs-cons-x" id="fs-cfg" type="button" title="Fusion — options / log / help">⚙</button><button class="fs-cons-x" id="fs-close" type="button" title="Close">✕</button></div>'
        + '<div class="fs-ctrl"><select id="fs-rg-editions" style="display:none;"><option value="">+ Load recordings from RG edition ▾</option></select>'
        + '<input type="text" id="fs-add-input" placeholder="paste a recording, release, or release-group MBID|URL…" title="Paste an MBID or MusicBrainz URL — it is added automatically">'
        + '<div class="fs-sp"></div><div class="fs-legend">'
        + '<span>Cutoff <select id="fs-cutoff" title="How strict Auto-match is. Hover an option for what it means.">' + cutoffOpts + '</select></span></div>'
        + '<button type="button" id="fs-automatch" class="fs-btn fs-primary">⚡ Auto-match</button></div>'
        + '<div class="fs-netbanner" id="fs-netbanner" style="display:none"></div>'
        + '<div class="fs-body"><div class="fs-col fs-pool"><div class="fs-colhdr">Pool <span class="fs-cnt" id="fs-pool-cnt">0</span><span class="fs-sp"></span><input type="text" id="fs-pool-filter" class="fs-poolfilter" placeholder="filter the pool…" title="Filter by title, artist, release, ISRC or AcoustID. Auto-match still considers the whole pool."></div>'
        + '<div class="fs-colbody" id="fs-pool-body"></div></div>'
        + '<div class="fs-col fs-groups"><div class="fs-colhdr">Groups <span class="fs-cnt" id="fs-groups-cnt">0</span><span class="fs-sp"></span><span class="fs-hint">click a group to make it current · ready to merge</span><button type="button" id="fs-clearboard" class="fs-btn fs-clearboard-btn" title="delete every group — all recordings return to the pool">↩ Clear board</button></div>'
        + '<div class="fs-colbody" id="fs-groups-body"></div></div></div>'
        + '<div class="fs-ftr"><div class="fs-sum" id="fs-summary"></div><div class="fs-sp"></div>'
        + '<div class="fs-note">Merges submit directly in the background — no MB merge page involved</div>'
        + '<button type="button" id="fs-mergeall" class="fs-btn fs-primary">⚡ Merge All →</button></div></div>';
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
    document.getElementById('fs-automatch').onclick = onAutoMatch;
    // NOT `onclick = mergeAll` — the click Event would land in mergeAll's first
    // parameter (concurrency), and being truthy it survives `|| 3`, making
    // Math.min(Event, n) → NaN → Array.from({length:NaN}) → zero workers → the
    // whole Merge All silently no-ops. Bit us live; see the guard in mergeAll too.
    document.getElementById('fs-mergeall').onclick = () => mergeAll();
    document.getElementById('fs-clearboard').onclick = () => { clearBoard(); renderAll(); };
    document.getElementById('fs-rg-editions').addEventListener('change', onLoadRgEdition);
    const poolFilter = document.getElementById('fs-pool-filter');
    poolFilter.addEventListener('input', () => { STATE.poolFilter = poolFilter.value.trim(); renderPool(); });
    poolFilter.addEventListener('keydown', e => { if (e.key === 'Escape' && poolFilter.value) { e.stopPropagation(); poolFilter.value = ''; STATE.poolFilter = ''; renderPool(); } });
    document.getElementById('fs-cutoff').addEventListener('change', e => { SETTINGS.matchCutoff = e.target.value; saveSettings(); Log.info('Match cutoff set to ' + SETTINGS.matchCutoff); });
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
    if (!STATE.poolOrder.length) { Log.info('Auto-match on open: nothing in the pool'); return; }
    for (let i = 0; i < 120 && _busyCount > 0; i++) await new Promise(r => setTimeout(r, 250));
    if (!FUSION_OPEN) return;
    Log.info('Auto-match on open: starting');
    await onAutoMatch();
}
async function openFusion() {
    if (FUSION_OPEN) return;
    FUSION_OPEN = true;
    fsStyle();
    buildShell();
    renderAll();
    if (STATE.recordings.size === 0) { await seedFromScope(); maybeAutoMatchOnOpen().catch(e => Log.error('Auto-match on open failed: ' + e.message)); }
}

function ensureLauncher() {
    if (document.getElementById('fs-launch')) return;
    fsStyle();
    const btn = el('button', 'fs-launch', ICON + ' Fusion'); btn.id = 'fs-launch'; btn.type = 'button';
    btn.title = 'Fusion — merge recordings';
    btn.dataset.mbCorner = 'br'; btn.dataset.mbCornerOrder = '30';
    btn.onclick = () => openFusion();
    document.body.appendChild(btn);
    mbRestackCorner('br');
}
function boot() {
    Log.info('Fusion v' + VERSION + ' — startup on ' + SCOPE.type + ' ' + SCOPE.mbid);
    ensureLauncher();
    // reopen the log window if it was left open (same as apollo_editor #283)
    try { if (loadLogWinState().open) setTimeout(() => { try { openLog(); } catch (e) {} }, 800); } catch (e) {}
}
boot();

try {
    W.__fusion = {
        VERSION, SCOPE, STATE, SETTINGS_DEFAULTS, MATCH_CUTOFFS,
        get SETTINGS() { return SETTINGS; },
        normName, tokenMatch, titleSimilar, artistSimilar, lengthClose, fuzzyRatio, levenshtein, acName, acPrimaryGid, dur, parseMbidFromInput, parseAddInput,
        mkRecording, fetchReleaseRecordings, fetchRGRecordings, fetchRecordingByGid, fetchAllReleases, resolveInternalId, fetchAcoustIds, fetchAcoustIdsBatch, enrichIsrcs, fetchRecordingDetail, fetchEntityMeta, enrichPendingEdits, fetchRecordingsBySearch, fetchArtistRecordings, harvestInternalIdsFromPage,
        pairSignals, poolMatches, computeGroupConfidence, SIGNAL_KEYS, ACOUSTID_BATCH, shouldUnion, autoMatch, enrichAcoustIds, enrichAllReleases,
        migrateSettings, presenceDots, SETTINGS_DEFAULTS, RETIRED_ACOUSTID_CAP,
        fetchReleaseDetails, releaseTableHtml, toggleReleaseDetails, renderFooter, seedPageProgress, lengthSpread,
        addToPool, createGroupWithMember, addToGroup, returnToPool, removeFromGroupAndPool, removeFromPoolPermanently, findGroup, deleteGroup, clearBoard, videoConflict,
        buildEditNote, autoEditNote, evidenceLines, ensureInternalIds, mergeGroup, mergeAll, describeRecordingForLog,
        openFusion, closeFusion, seedFromScope, maybeAutoMatchOnOpen, renderAll, renderPool, renderGroups, busyStart, busyEnd,
        gmGet, gmPost, wsGet, parseRetryAfter, setNetTrouble, clearNetTrouble,
        getLogLines: () => _logBuf.map(r => r.line),
    };
} catch (e) {}

})();
