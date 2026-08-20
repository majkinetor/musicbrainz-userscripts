// ==UserScript==
// @name         Fusion
// @namespace    https://musicbrainz.org/
// @version      2026.8.21
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
// ==/UserScript==

(function () {
'use strict';

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '2026.8.21';
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
function logMarkdown() {
    const body = _logBuf.map(r => '[' + new Date(r.t).toLocaleTimeString() + '] [' + r.kind + '] ' + r.line).join('\n') || '(empty)';
    return '<details><summary>Fusion — session log</summary>\n\n```log\n' + body + '\n```\n\n</details>';
}
async function copyLog(btn) {
    const md = logMarkdown(); let ok = false;
    try { await navigator.clipboard.writeText(md); ok = true; } catch (e) {}
    if (btn) { btn.textContent = ok ? 'Copied!' : 'Copy failed'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); }
}
function openLog() {
    document.getElementById('fs-logpop')?.remove();
    fsStyle();
    const pop = el('div'); pop.id = 'fs-logpop';
    pop.innerHTML = '<div class="fs-logpop-h"><b>Fusion — activity log</b><span class="fs-sp"></span><button class="fs-logpop-copy" type="button">Copy</button><button class="fs-logpop-x" type="button">✕</button></div><div class="fs-logpop-body"></div>';
    document.body.appendChild(pop);
    const body = pop.querySelector('.fs-logpop-body');
    const render = () => { body.innerHTML = _logBuf.map(r => '<div class="fs-logln fs-logln-' + r.kind + '"><span class="fs-logts">' + new Date(r.t).toLocaleTimeString() + '</span> ' + escapeHtml(r.line) + '</div>').join(''); body.scrollTop = body.scrollHeight; };
    render();
    _logListeners.add(render);
    const close = () => { _logListeners.delete(render); pop.remove(); };
    pop.querySelector('.fs-logpop-x').onclick = close;
    pop.querySelector('.fs-logpop-copy').onclick = () => copyLog(pop.querySelector('.fs-logpop-copy'));
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
async function wsGet(path, retries) {
    retries = retries == null ? 3 : retries;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const t0 = Date.now();
        try {
            Log.info('GET ' + path + (attempt ? ' (retry ' + attempt + '/' + retries + ')' : ''));
            const r = await fetch(path, { headers: { Accept: 'application/json' } });
            const ms = Date.now() - t0;
            if (r.status === 503 || r.status === 429) {
                Log.warn('GET ' + path + ' → ' + r.status + ' (' + ms + 'ms) — MB busy/rate-limited');
                if (attempt < retries) { await new Promise(res => setTimeout(res, 800 * Math.pow(2, attempt))); continue; }
                Log.error('GET ' + path + ' gave up after ' + (retries + 1) + ' attempts (still ' + r.status + ')');
                return null;
            }
            if (!r.ok) { Log.warn('GET ' + path + ' → ' + r.status + ' (' + ms + 'ms)'); return null; }
            Log.info('← ' + r.status + ' ' + path + ' (' + ms + 'ms)');
            return await r.json();
        } catch (e) {
            Log.error('GET ' + path + ' failed: ' + e.message + (attempt < retries ? ' — retrying' : ' — giving up'));
            if (attempt < retries) { await new Promise(res => setTimeout(res, 800 * Math.pow(2, attempt))); continue; }
            return null;
        }
    }
    return null;
}

// ── settings (GM-persisted) ──────────────────────────────────────────────
const SETTINGS_KEY = 'fusion.settings';
const SETTINGS_DEFAULTS = { lengthToleranceMs: 5000, acoustidEnrich: true, acoustidPoolCap: 60, makeVotable: false, matchCutoff: 'normal' };
function loadSettings() {
    try { return Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(GM_getValue(SETTINGS_KEY, '{}'))); }
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
    return Object.assign({ gid, title: '', length: null, isrcs: [], artistCredit: '', artistGid: null, releases: [], allReleases: null, acoustids: null, video: null }, opts || {});
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
                artistCredit: acName(ac), artistGid: acPrimaryGid(ac), video: !!r.video,
                releases: [{ gid: j.id, title: j.title, trackNumber: t.number || null, trackCount: m['track-count'] || null }],
            }));
        }
    }
    Log.info('Release seed: ' + recs.length + ' recording(s) from "' + j.title + '"');
    return { release: { gid: j.id, title: j.title, artistCredit: acName(j['artist-credit']) }, recordings: recs };
}

async function fetchRGRecordings(rgMbid) {
    const rgMeta = await wsGet('/ws/2/release-group/' + rgMbid + '?inc=artist-credits&fmt=json');
    const rg = rgMeta ? { gid: rgMeta.id, title: rgMeta.title, artistCredit: acName(rgMeta['artist-credit']) } : null;
    const recordings = [];
    let offset = 0; const limit = 100; let total = Infinity; let guard = 0;
    while (offset < total && guard < 10) {
        const j = await wsGet('/ws/2/recording?query=rgid:' + rgMbid + '&fmt=json&limit=' + limit + '&offset=' + offset);
        if (!j) break;
        total = j.count || 0;
        for (const r of j.recordings || []) {
            const releases = (r.releases || []).map(rel => {
                let trackNumber = null;
                for (const med of rel.media || []) { if (med.track && med.track[0]) { trackNumber = med.track[0].number || null; break; } }
                return { gid: rel.id, title: rel.title, trackNumber, trackCount: rel['track-count'] || null, date: rel.date || null };
            });
            const ac = r['artist-credit'];
            // the rgid: search already returns every release this recording appears
            // on, across every release group — not just the one queried — so it
            // doubles as the deduped "all releases" list majkinetor asked for,
            // no extra per-recording fetch needed for this scope.
            recordings.push(mkRecording(r.id, { title: r.title, length: r.length, isrcs: r.isrcs || [], artistCredit: acName(ac), artistGid: acPrimaryGid(ac), video: !!r.video, releases, allReleases: releases }));
        }
        offset += limit; guard++;
    }
    Log.info('RG seed: ' + recordings.length + ' recording(s) of ' + total + ' total (rgid:' + rgMbid + ')');
    return { rg, recordings };
}

async function fetchRecordingByGid(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=releases+isrcs+artist-credits&fmt=json');
    if (!j) return null;
    const releases = (j.releases || []).map(rel => ({ gid: rel.id, title: rel.title, trackNumber: null, trackCount: null, date: rel.date || null }));
    const ac = j['artist-credit'];
    return mkRecording(j.id, { title: j.title, length: j.length, isrcs: j.isrcs || [], artistCredit: acName(ac), artistGid: acPrimaryGid(ac), video: !!j.video, releases, allReleases: releases });
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
async function fetchAcoustIds(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=url-rels&fmt=json');
    if (!j) return [];
    const out = [];
    for (const rel of j.relations || []) {
        const url = rel.url && rel.url.resource;
        const m = url && url.match(/acoustid\.org\/track\/([0-9a-fA-F-]{36})/);
        if (m) out.push(m[1].toLowerCase());
    }
    return out;
}

// ── pool / groups state ──────────────────────────────────────────────────
const STATE = { recordings: new Map(), poolOrder: [], groups: [], selected: null, activeGroupId: null, _dragSrc: null, releaseInfo: null, rgInfo: null };

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
function computeGroupConfidence(members) {
    let confidence = null; const signals = new Set();
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
        const sig = pairSignals(members[i], members[j], SETTINGS.lengthToleranceMs);
        if (sig.isrc) { signals.add('isrc'); confidence = 'high'; }
        if (sig.acoustid) { signals.add('acoustid'); confidence = 'high'; }
        if (sig.length) signals.add('length');
        if (sig.title) signals.add('title');
        if (sig.artist) signals.add('artist');
        if (!confidence && shouldUnion(sig, SETTINGS.matchCutoff)) confidence = 'medium';
    }
    return { confidence: confidence || 'manual', signals: [...signals] };
}
function refreshGroupMeta(g) {
    const members = g.memberGids.map(x => STATE.recordings.get(x)).filter(Boolean);
    const meta = computeGroupConfidence(members);
    g.confidence = meta.confidence; g.signals = meta.signals;
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
}
function createGroupWithMember(gid) {
    const i = STATE.poolOrder.indexOf(gid); if (i === -1) return null;
    STATE.poolOrder.splice(i, 1);
    const g = { id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: [gid], confidence: 'manual', signals: [], target: gid, state: 'pending', error: null };
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
    const sig = { isrc: false, acoustid: false, length: false, title: false, artist: false, videoMismatch: false };
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
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const sig = pairSignals(pool[i], pool[j], tolMs);
            if (shouldUnion(sig, cutoff)) union(pool[i].gid, pool[j].gid);
        }
    }
    const byRoot = new Map();
    for (const r of pool) { const root = find(r.gid); if (!byRoot.has(root)) byRoot.set(root, []); byRoot.get(root).push(r); }
    const groups = [];
    for (const members of byRoot.values()) {
        if (members.length < 2) continue;
        const meta = computeGroupConfidence(members);
        const target = members.slice().sort((a, b) => b.releases.length - a.releases.length)[0].gid;
        groups.push({ id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: members.map(m => m.gid), confidence: meta.confidence, signals: meta.signals, target, state: 'pending', error: null });
    }
    return groups;
}
// #529 follow-up (majkinetor, live): "Match should show some progress (not
// sure why it took so long in my test)" — AcoustID enrichment is one network
// round-trip per pool recording; on anything bigger than a handful of tracks
// that dominates Auto-match's wall time with nothing visible happening. Report
// live N/M counts back to the caller so the button (and the log) can show it.
async function enrichAcoustIds(recs, concurrency, onProgress) {
    concurrency = concurrency || 4;
    let i = 0, done = 0;
    async function worker() {
        while (i < recs.length) {
            const rec = recs[i++];
            if (rec.acoustids == null) rec.acoustids = await fetchAcoustIds(rec.gid);
            done++; if (onProgress) onProgress(done, recs.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, recs.length) }, worker));
}

// ── merge submission (verified live against test.musicbrainz.org — GET
// /recording/merge_queue?add-to-merge=<id>×N redirects to /recording/merge, whose
// self-posting form has merge.merging.N / merge.target / merge.edit_note /
// merge.make_votable and no CSRF token, session cookie authorises) ──────────
function buildEditNote(group) {
    const sigLabel = { isrc: 'same ISRC', acoustid: 'same AcoustID', length: 'length within ' + Math.round(SETTINGS.lengthToleranceMs / 1000) + 's', title: 'similar title', artist: 'similar artist' };
    const reasons = (group.signals || []).map(s => sigLabel[s] || s).join(', ') || 'manually grouped';
    let note = 'Merged via Fusion — ' + reasons + '.';
    note += '\n\nFusion v' + VERSION + ' by majkinetor - ' + HELP_URL;
    return note;
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
    Log.info('▶ Merge group ' + group.id + ' — confidence=' + group.confidence + ' signals=[' + group.signals.join(',') + ']');
    group.memberGids.forEach(gid => Log.info('  member ' + gid + (gid === group.target ? ' (TARGET/kept)' : '') + ': ' + describeRecordingForLog(STATE.recordings.get(gid))));
    group.state = 'busy'; group.error = null; renderGroups();
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
    renderGroups(); renderFooter();
}
// #529 follow-up (majkinetor): "Merge all should be parallel if possible" —
// each merge is its own GET+POST pair, independent of every other group's, so
// a small worker pool runs several at once instead of one strictly after
// another. Capped (not unbounded) to stay reasonable towards MB's server.
async function mergeAll(concurrency) {
    concurrency = concurrency || 3;
    const pending = STATE.groups.filter(g => g.state === 'pending' || g.state === 'error');
    Log.info('══ Merge All: ' + pending.length + ' group(s) queued, up to ' + Math.min(concurrency, pending.length) + ' in parallel ══');
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
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
    Log.info('══ Merge All finished: ' + doneCount + ' merged, ' + failCount + ' failed (of ' + pending.length + ') ══');
}

/* ════════════════════════════════ UI ════════════════════════════════ */
function fsStyle() {
    if (document.getElementById('fs-style')) return;
    const s = el('style'); s.id = 'fs-style';
    s.textContent = ''
        + '.fs-launch{position:fixed;z-index:2147483000;background:linear-gradient(180deg,#8a5cf6,#6d3ff0);color:#fff;border:1px solid #6d3ff0;border-radius:8px;padding:8px 14px;font:600 13px -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}'
        + '.fs-launch:hover{filter:brightness(1.08)}'
        + '.fs-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483000;display:flex;align-items:center;justify-content:center}'
        + '.fs-cons{--fs-bg:#1b1c22;--fs-panel:#232430;--fs-panel2:#2a2b38;--fs-border:#3a3b4a;--fs-text:#e8e8ee;--fs-muted:#9a9bb0;--fs-purple:#8a5cf6;--fs-purple-d:#6d3ff0;--fs-green:#3ecf8e;--fs-amber:#e0a63e;--fs-red:#e0546a;--fs-blue:#4fa3e0;'
        + 'width:min(1180px,96vw);height:min(680px,92vh);max-width:98vw;max-height:96vh;min-width:640px;min-height:400px;resize:both;'
        + 'background:var(--fs-panel);color:var(--fs-text);border:1px solid var(--fs-border);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);'
        + 'font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden}'
        + '.fs-cons.fs-maximized{position:fixed !important;left:8px !important;top:8px !important;width:calc(100vw - 16px) !important;height:calc(100vh - 16px) !important;max-width:none !important;max-height:none !important;margin:0 !important}'
        + '.fs-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--fs-panel2);border-bottom:1px solid var(--fs-border);cursor:move}'
        + '.fs-title{font-weight:700;font-size:14px}'
        + '.fs-scope{color:var(--fs-muted);font-size:12px}'
        + '.fs-sp{flex:1}'
        + '.fs-cfgbtn,.fs-x{color:var(--fs-muted);cursor:pointer;font-size:15px;padding:2px 6px}'
        + '.fs-cfgbtn:hover,.fs-x:hover{color:var(--fs-text)}'
        + '.fs-ctrl{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--fs-panel);border-bottom:1px solid var(--fs-border);flex-wrap:wrap}'
        + '.fs-ctrl select,.fs-ctrl input[type=text]{background:var(--fs-panel2);border:1px solid var(--fs-border);color:var(--fs-text);border-radius:6px;padding:5px 8px;font-size:12px}'
        + '.fs-ctrl input[type=text]{width:220px}'
        + '.fs-btn{border:1px solid var(--fs-border);background:var(--fs-panel2);color:var(--fs-text);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}'
        + '.fs-btn.fs-primary{background:linear-gradient(180deg,var(--fs-purple),var(--fs-purple-d));border-color:var(--fs-purple-d);color:#fff;font-weight:600}'
        + '.fs-btn:disabled{opacity:.5;cursor:default}'
        + '.fs-legend{display:flex;gap:10px;color:var(--fs-muted);font-size:11px;align-items:center}'
        + '.fs-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:3px}'
        + '.fs-body{display:flex;flex:1;min-height:0}'
        + '.fs-col{display:flex;flex-direction:column;min-width:0;min-height:0}'
        + '.fs-pool{width:360px;border-right:1px solid var(--fs-border);background:var(--fs-bg)}'
        + '.fs-groups{flex:1;background:var(--fs-panel)}'
        + '.fs-colhdr{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--fs-border);font-weight:700;font-size:12px;letter-spacing:.3px;color:var(--fs-muted);text-transform:uppercase;background:var(--fs-panel2)}'
        + '.fs-cnt{background:var(--fs-panel);border:1px solid var(--fs-border);border-radius:10px;padding:1px 7px;color:var(--fs-text);font-weight:600}'
        + '.fs-hint{text-transform:none;font-weight:400;color:#65667a}'
        // #529 follow-up (majkinetor, screenshot): "I can't see individual
        // recordings here (have to zoom out)" — classic flexbox trap: a flex
        // item's default min-height:auto refuses to shrink below its natural
        // content height, so with many groups this box grew past .fs-cons's
        // own fixed height instead of scrolling — the overflow got clipped by
        // .fs-cons's overflow:hidden rather than showing a scrollbar in here.
        + '.fs-colbody{flex:1;min-height:0;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px}'
        + '.fs-empty{color:#65667a;font-size:12px;padding:14px;text-align:center}'
        + '.fs-pcard{background:var(--fs-panel2);border:1px solid var(--fs-border);border-radius:7px;padding:7px 9px;display:flex;align-items:center;gap:8px;cursor:grab;flex-shrink:0}'
        + '.fs-pcard.fs-selected{border-color:var(--fs-purple)}'
        + '.fs-grip{color:#565768;font-size:12px;letter-spacing:-1px}'
        + '.fs-info{flex:1;min-width:0}'
        + '.fs-t{font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        // #529 follow-up (majkinetor, screenshot): "you can see merged item no
        // link" — the <a> was always there and functional (verified: real href,
        // pointer-events:auto even after a merge), but color:inherit +
        // text-decoration:none until hover made every link visually identical
        // to plain text at rest, so it genuinely read as "no link" on sight.
        + '.fs-t a{color:#c9b3ff;text-decoration:underline;text-decoration-color:rgba(201,179,255,.35)}'
        + '.fs-t a:hover{color:var(--fs-purple);text-decoration-color:var(--fs-purple)}'
        + '.fs-artist{font-weight:400;color:var(--fs-muted);font-size:11.5px}'
        + '.fs-artist a{color:var(--fs-muted);text-decoration:underline;text-decoration-color:rgba(154,155,176,.35)}'
        + '.fs-artist a:hover{text-decoration-color:var(--fs-text);color:var(--fs-text)}'
        + '.fs-m{color:var(--fs-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}'
        + '.fs-ids{display:flex;gap:5px;margin-top:2px}'
        + '.fs-idtag{font-size:9.5px;color:#9a9bb0;font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.04);padding:1px 5px;border-radius:3px}'
        + '.fs-badges{display:flex;gap:3px;flex-shrink:0}'
        + '.fs-b{width:6px;height:6px;border-radius:50%}'
        + '.fs-b-on{background:var(--fs-green)} .fs-b-off{background:#454657}'
        + '.fs-rm{color:var(--fs-muted);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0}'
        + '.fs-rm:hover{color:var(--fs-red)}'
        // flex-shrink:0 is the actual fix for the missing-rows bug: .fs-gcard
        // has overflow:hidden, and per spec that makes its automatic min-height
        // resolve to 0 instead of content-based — so without flex-shrink:0,
        // flexbox happily squashed every card to fit .fs-colbody's available
        // space (clipping the rows inside via that same overflow:hidden)
        // instead of letting .fs-colbody's own overflow-y:auto scroll.
        + '.fs-gcard{background:var(--fs-panel2);border:1px solid var(--fs-border);border-left:3px solid var(--fs-green);border-radius:7px;overflow:hidden;flex-shrink:0}'
        + '.fs-gcard-med{border-left-color:var(--fs-amber)}'
        + '.fs-gcard-manual{border-left-color:var(--fs-blue);border-left-style:dashed}'
        + '.fs-gcard.fs-active{outline:2px solid var(--fs-purple);outline-offset:-1px}'
        + '.fs-ghdr{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,.02);border-bottom:1px solid var(--fs-border);cursor:pointer}'
        + '.fs-gt{font-weight:700;font-size:12.5px}'
        + '.fs-gt a{color:#c9b3ff;text-decoration:underline;text-decoration-color:rgba(201,179,255,.35)}'
        + '.fs-gt a:hover{color:var(--fs-purple);text-decoration-color:var(--fs-purple)}'
        + '.fs-conf{font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700;letter-spacing:.2px}'
        + '.fs-conf-high{background:rgba(62,207,142,.15);color:var(--fs-green)}'
        + '.fs-conf-med{background:rgba(224,166,62,.15);color:var(--fs-amber)}'
        + '.fs-conf-manual{background:rgba(79,163,224,.15);color:var(--fs-blue)}'
        + '.fs-sig{display:flex;gap:3px}'
        + '.fs-sig span{font-size:9.5px;padding:1px 5px;border-radius:4px;background:var(--fs-panel);border:1px solid var(--fs-border);color:var(--fs-muted)}'
        + '.fs-sig span.hit{color:var(--fs-green);border-color:rgba(62,207,142,.4)}'
        + '.fs-mbtn{font-size:11px;padding:3px 9px;border-radius:5px;border:1px solid var(--fs-purple-d);background:rgba(138,92,246,.15);color:#c9b3ff;cursor:pointer;font-weight:600}'
        + '.fs-mbtn.fs-done{background:rgba(62,207,142,.15);border-color:var(--fs-green);color:var(--fs-green);cursor:default}'
        + '.fs-mbtn.fs-err{background:rgba(224,84,106,.15);border-color:var(--fs-red);color:#ffb3bd}'
        + '.fs-kill{cursor:pointer;font-size:13px;padding:2px 4px;opacity:.6}'
        + '.fs-kill:hover{opacity:1}'
        + '.fs-clearboard-btn{padding:2px 8px;font-size:11px;text-transform:none;font-weight:400;letter-spacing:0}'
        + '.fs-grows{padding:4px 6px}'
        + '.fs-grow{display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:5px}'
        + '.fs-grow:hover{background:rgba(255,255,255,.03)}'
        + '.fs-grow.fs-target-row{background:rgba(138,92,246,.12)}'
        + '.fs-grow.fs-target-row:hover{background:rgba(138,92,246,.18)}'
        + '.fs-star{width:16px;flex-shrink:0;text-align:center;font-size:13px;color:#4a4b5c;cursor:pointer;opacity:0;transition:opacity .1s}'
        + '.fs-grow:hover .fs-star{opacity:1}'
        + '.fs-star-on{color:var(--fs-amber) !important;opacity:1 !important;cursor:default}'
        + '.fs-star-disabled{cursor:default}'
        + '.fs-grow .fs-t{flex:1;min-width:0}'
        + '.fs-artistcol{color:var(--fs-muted);font-size:11px;width:120px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-artistcol a{color:var(--fs-muted);text-decoration:underline;text-decoration-color:rgba(154,155,176,.35)}'
        + '.fs-artistcol a:hover{text-decoration-color:var(--fs-text);color:var(--fs-text)}'
        + '.fs-grow .fs-rel{color:var(--fs-muted);font-size:11px;width:190px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-grow .fs-len{color:var(--fs-muted);font-size:11px;width:44px;flex-shrink:0}'
        + '.fs-grow .fs-isrc{color:#7d7e94;font-size:10px;width:96px;flex-shrink:0;font-family:ui-monospace,Consolas,monospace}'
        + '.fs-acts{display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity .1s}'
        + '.fs-grow:hover .fs-acts{opacity:1}'
        + '.fs-acts span{color:var(--fs-muted);cursor:pointer;font-size:12px;padding:1px 3px}'
        + '.fs-acts span:hover{color:var(--fs-text)}'
        + '.fs-rm-x:hover{color:var(--fs-red) !important}'
        + '.fs-gerr{margin:0 8px 6px;padding:5px 8px;background:rgba(224,84,106,.12);border:1px solid rgba(224,84,106,.4);border-radius:5px;color:#ffb3bd;font-size:11px}'
        + '.fs-gdrop{margin:6px 8px 8px;border:1px dashed var(--fs-border);border-radius:6px;padding:6px;text-align:center;color:#65667a;font-size:10.5px}'
        + '.fs-newgroup{border:1px dashed var(--fs-border);border-radius:7px;padding:9px;text-align:center;color:var(--fs-muted);font-size:12px;cursor:pointer}'
        + '.fs-ftr{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--fs-panel2);border-top:1px solid var(--fs-border)}'
        + '.fs-sum{color:var(--fs-muted);font-size:12px}'
        + '.fs-sum b{color:var(--fs-text)}'
        + '.fs-note{color:#7d7e94;font-size:11px}'
        + '.fs-settings{position:fixed;z-index:2147483001;background:#fff;color:#222;border:1px solid #cfd4da;border-radius:8px;padding:10px 14px;width:280px;box-shadow:0 8px 26px rgba(0,0,0,.25);font:13px -apple-system,Segoe UI,Arial,sans-serif}'
        + '.fs-settings h4{margin:0 0 8px;display:flex;align-items:center;gap:6px;font-size:14px}'
        + '.fs-settings .fs-ver{font-size:11px;color:#999;font-weight:normal}'
        + '.fs-settings .fs-logbtn{margin-left:auto;font-size:11px;padding:2px 8px;border:1px solid #ccc;border-radius:4px;background:#f5f5f7;cursor:pointer}'
        + '.fs-settings .fs-help{font-size:11px;color:#1DB954;text-decoration:none;border:1px solid #cfe9d6;border-radius:4px;padding:2px 8px}'
        + '.fs-opt{display:block;margin:8px 0;font-size:12px}'
        + '.fs-opt textarea{width:100%;box-sizing:border-box;margin-top:4px;font:12px inherit}'
        + '.fs-logpop{position:fixed;top:60px;right:14px;width:420px;max-height:60vh;background:#1b2430;color:#eef2f7;border-radius:8px;box-shadow:0 8px 26px rgba(0,0,0,.4);z-index:2147483002;display:flex;flex-direction:column;overflow:hidden;font:12px -apple-system,Segoe UI,Arial,sans-serif}'
        + '.fs-logpop-h{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#12181f}'
        + '.fs-logpop-h button{background:#2a3542;border:1px solid #3a4757;color:#eef2f7;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer}'
        + '.fs-logpop-body{flex:1;overflow-y:auto;padding:6px 10px}'
        + '.fs-logln{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)}'
        + '.fs-logts{color:#7d8aa0;margin-right:6px}'
        + '.fs-logln-warn{color:#e0a63e} .fs-logln-error{color:#e0546a} .fs-logln-ok{color:#3ecf8e}';
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
function videoBadge(rec) { return rec.video === true ? '<span class="fs-vid" title="video recording">🎬</span> ' : ''; }
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
function poolCardHtml(rec) {
    const rs = releasesSummary(rec);
    const isrcOn = rec.isrcs && rec.isrcs.length ? 'on' : 'off';
    const acOn = rec.acoustids && rec.acoustids.length ? 'on' : 'off';
    return '<div class="fs-pcard" draggable="true" data-gid="' + rec.gid + '">'
        + '<span class="fs-grip">⠿</span>'
        + '<div class="fs-info"><div class="fs-t" title="' + escapeHtml(rec.title) + '">' + videoBadge(rec) + recLink(rec.gid, rec.title) + (rec.artistCredit ? ' <span class="fs-artist">— ' + artistLink(rec) + '</span>' : '') + '</div>'
        + '<div class="fs-m" title="' + escapeHtml(rs.tooltip) + '">' + escapeHtml(rs.text) + ' · ' + dur(rec.length) + '</div>' + idsLine(rec) + '</div>'
        + '<div class="fs-badges"><span class="fs-b fs-b-' + isrcOn + '" title="ISRC"></span><span class="fs-b fs-b-' + acOn + '" title="AcoustID"></span></div>'
        + '<span class="fs-rm" data-act="pool-remove" title="remove from pool">✕</span></div>';
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
    const sigChips = Object.keys(sigNames).map(k => '<span class="' + (group.signals.includes(k) ? 'hit' : '') + '">' + sigNames[k] + '</span>').join('');
    const busy = group.state === 'busy', done = group.state === 'done';
    const tooFew = members.length < 2;
    const stateLabel = busy ? '⏳ Merging…' : done ? '✓ Merged' : group.state === 'error' ? '⚠ Retry merge' : tooFew ? '⚡ Merge ↗ (needs 2+)' : '⚡ Merge ↗';
    const stateCls = done ? 'fs-done' : group.state === 'error' ? 'fs-err' : '';
    const rows = ordered.map(m => {
        const rs = releasesSummary(m);
        const isTarget = group.target === m.gid;
        const canPick = !busy && !done;
        const star = isTarget
            ? '<span class="fs-star fs-star-on" title="merge target — this one is kept">★</span>'
            : '<span class="fs-star' + (canPick ? '' : ' fs-star-disabled') + '" data-act="' + (canPick ? 'set-target' : '') + '" title="' + (canPick ? 'make this the merge target' : '') + '">☆</span>';
        return '<div class="fs-grow' + (isTarget ? ' fs-target-row' : '') + '" draggable="true" data-gid="' + m.gid + '">'
            + star
            + '<span class="fs-t" title="' + escapeHtml(m.title) + '">' + videoBadge(m) + recLink(m.gid, m.title) + '</span>'
            + '<span class="fs-artistcol" title="' + escapeHtml(m.artistCredit || '') + '">' + artistLink(m) + '</span>'
            + '<span class="fs-rel" title="' + escapeHtml(rs.tooltip) + '">' + escapeHtml(rs.text) + '</span>'
            + '<span class="fs-len">' + dur(m.length) + '</span>'
            + '<span class="fs-isrc">' + ((m.isrcs && m.isrcs[0]) || '—') + '</span>'
            + '<span class="fs-isrc" title="' + (m.acoustids && m.acoustids[0] ? 'AcoustID ' + escapeHtml(m.acoustids[0]) : '') + '">' + (m.acoustids && m.acoustids[0] ? escapeHtml(m.acoustids[0].slice(0, 8)) + '…' : '—') + '</span>'
            + '<span class="fs-acts"><span data-act="return" title="return to pool">↩</span><span class="fs-rm-x" data-act="remove-both" title="remove from group + pool">✕</span></span></div>';
    }).join('');
    const errMsg = group.state === 'error' ? '<div class="fs-gerr">' + escapeHtml(group.error || 'merge failed') + '</div>' : '';
    const dropZone = done ? '' : '<div class="fs-gdrop" data-act="drop-zone">drop from pool to add another recording to this group</div>';
    const activeCls = STATE.activeGroupId === group.id ? ' fs-active' : '';
    const head = ordered[0];
    return '<div class="fs-gcard fs-gcard-' + confClass + activeCls + '" data-gid="' + group.id + '">'
        + '<div class="fs-ghdr"><span class="fs-gt" title="' + escapeHtml(head ? head.title : '') + '">' + (head ? recLink(head.gid, head.title) : 'New group') + '</span>'
        + '<span class="fs-conf fs-conf-' + confClass + '">' + confLabel + '</span>'
        + '<div class="fs-sig">' + sigChips + '</div><div class="fs-sp"></div>'
        + '<button class="fs-mbtn ' + stateCls + '" type="button" data-act="merge-group" ' + (busy || done || tooFew ? 'disabled' : '') + '>' + stateLabel + '</button>'
        + '<span class="fs-kill" data-act="delete-group" title="delete this group — members return to the pool" ' + (busy ? 'style="display:none"' : '') + '>🗑</span></div>'
        + '<div class="fs-grows">' + rows + '</div>' + errMsg + dropZone + '</div>';
}

function renderPool() {
    const body = document.getElementById('fs-pool-body'); if (!body) return;
    document.getElementById('fs-pool-cnt').textContent = String(STATE.poolOrder.length);
    const recs = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
    body.innerHTML = recs.length ? recs.map(poolCardHtml).join('') : '<div class="fs-empty">Pool is empty — add a recording by MBID/URL above.</div>';
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
    if (sum) sum.innerHTML = '<b>' + STATE.groups.length + '</b> group' + (STATE.groups.length === 1 ? '' : 's') + ' · <b>' + ready + '</b> ready' + (done ? ' · <b>' + done + '</b> merged' : '') + ' · <b>' + STATE.poolOrder.length + '</b> in pool';
    const btn = document.getElementById('fs-mergeall');
    if (btn) { btn.disabled = ready === 0; btn.textContent = '⚡ Merge All (' + ready + ') →'; }
}
function renderAll() { renderPool(); renderGroups(); renderFooter(); }

function setScopeLabel(text) { const e = document.getElementById('fs-scope'); if (e) e.textContent = text; }

async function onAutoMatch() {
    const btn = document.getElementById('fs-automatch'); if (!btn) return;
    btn.disabled = true; const orig = btn.textContent;
    btn.textContent = 'Matching…';
    try {
        const poolRecs = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
        Log.info('Auto-match starting on ' + poolRecs.length + ' pool recording(s), cutoff=' + SETTINGS.matchCutoff);
        poolRecs.forEach(r => Log.info('  pool: ' + describeRecordingForLog(r)));
        if (SETTINGS.acoustidEnrich) {
            if (poolRecs.length <= SETTINGS.acoustidPoolCap) {
                Log.info('Enriching ' + poolRecs.length + ' pool recording(s) with AcoustID rels…');
                await enrichAcoustIds(poolRecs, 4, (done, total) => { btn.textContent = 'Matching… (AcoustID ' + done + '/' + total + ')'; });
            } else Log.warn('Skipping AcoustID enrichment — pool has ' + poolRecs.length + ' recordings (cap ' + SETTINGS.acoustidPoolCap + ')');
        }
        btn.textContent = 'Matching… (comparing)';
        const groupings = autoMatch(poolRecs, SETTINGS.lengthToleranceMs, SETTINGS.matchCutoff);
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
    } finally { btn.disabled = false; btn.textContent = orig; }
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
        const rec = await fetchRecordingByGid(mbid);
        if (!rec) { Log.error('Add: could not fetch recording ' + mbid + ' (is it a recording MBID?)'); return; }
        addToPool(rec); input.value = ''; renderAll();
        return;
    }
    if (type === 'artist') { Log.warn('Add: pasting an artist URL/MBID isn\'t supported — open Fusion from that artist\'s Recordings tab instead'); return; }
    Log.info('Adding all recordings from ' + type + ' ' + mbid + '…');
    const { recordings } = type === 'release' ? await fetchReleaseRecordings(mbid) : await fetchRGRecordings(mbid);
    let added = 0;
    recordings.forEach(r => { if (addToPool(r)) added++; });
    Log.info('Added ' + added + ' new recording(s) from that ' + type);
    input.value = ''; renderAll();
}
async function maybeShowRGDropdown(releaseMbid) {
    const j = await wsGet('/ws/2/release/' + releaseMbid + '?inc=release-groups&fmt=json');
    const rgId = j && j['release-group'] && j['release-group'].id;
    if (!rgId) return;
    const rgRels = await wsGet('/ws/2/release-group/' + rgId + '?inc=releases&fmt=json');
    const siblings = ((rgRels && rgRels.releases) || []).filter(r => r.id !== releaseMbid);
    if (!siblings.length) return;
    const sel = document.getElementById('fs-rg-editions'); if (!sel) return;
    sel.innerHTML = '<option value="">+ Load recordings from RG edition ▾</option>' + siblings.map(r => '<option value="' + r.id + '">' + escapeHtml(r.title) + (r.date ? ' (' + r.date + ')' : '') + '</option>').join('');
    sel.style.display = '';
    setScopeLabel((document.getElementById('fs-scope').textContent || '') + ' — release group has ' + siblings.length + ' other edition' + (siblings.length === 1 ? '' : 's'));
}
async function onLoadRgEdition(e) {
    const relMbid = e.target.value; if (!relMbid) return;
    Log.info('Loading recordings from edition ' + relMbid + '…');
    const { recordings } = await fetchReleaseRecordings(relMbid);
    let added = 0;
    recordings.forEach(r => { if (addToPool(r)) added++; });
    Log.info('Added ' + added + ' new recording(s) from that edition');
    e.target.value = ''; renderAll();
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
        g = { id: 'g' + Math.random().toString(36).slice(2, 9), memberGids: [src.gid], confidence: 'manual', signals: [], target: src.gid, state: 'pending', error: null };
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
        if (act === 'set-target' && row) { const g = findGroup(card.dataset.gid); if (g) { g.target = row.dataset.gid; renderGroups(); } return; }
        if (act === 'return' && row) { returnToPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'remove-both' && row) { removeFromGroupAndPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'merge-group') { mergeGroup(findGroup(card.dataset.gid)); return; }
        if (act === 'delete-group') { deleteGroup(card.dataset.gid); renderAll(); return; }
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
        + '<label class="fs-opt"><input type="checkbox" id="fs-opt-acoustid"> Enrich matches with AcoustID (recording URL-rels)</label>'
        + '<label class="fs-opt">Length tolerance <input type="number" id="fs-opt-tol" min="0" max="60" style="width:48px"> s</label>';
    document.body.appendChild(s);
    const r = anchor.getBoundingClientRect();
    s.style.top = (r.bottom + 6) + 'px'; s.style.right = '14px';
    s.querySelector('#fs-opt-votable').checked = !!SETTINGS.makeVotable;
    s.querySelector('#fs-opt-acoustid').checked = SETTINGS.acoustidEnrich !== false;
    s.querySelector('#fs-opt-tol').value = Math.round(SETTINGS.lengthToleranceMs / 1000);
    s.querySelector('#fs-opt-votable').onchange = e => { SETTINGS.makeVotable = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-acoustid').onchange = e => { SETTINGS.acoustidEnrich = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-tol').onchange = e => { SETTINGS.lengthToleranceMs = Math.max(0, Number(e.target.value) || 0) * 1000; saveSettings(); };
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
    if (st.maximized) { cons.classList.add('fs-maximized'); return; }
    if (st.left != null && st.top != null) { cons.style.position = 'fixed'; cons.style.left = st.left + 'px'; cons.style.top = st.top + 'px'; cons.style.margin = '0'; }
    if (st.width != null) cons.style.width = st.width + 'px';
    if (st.height != null) cons.style.height = st.height + 'px';
}
function toggleMaximize(cons) {
    const nowMax = !cons.classList.contains('fs-maximized');
    cons.classList.toggle('fs-maximized', nowMax);
    saveWinState({ maximized: nowMax });
}
function wireWindowChrome(cons, hdr, maxBtn) {
    applyWinState(cons);
    maxBtn.onclick = () => toggleMaximize(cons);
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
function _fsEscHandler(e) { if (e.key === 'Escape') closeFusion(); }
function buildShell() {
    document.getElementById('fs-overlay')?.remove();
    const overlay = el('div', 'fs-overlay'); overlay.id = 'fs-overlay';
    const cutoffOpts = MATCH_CUTOFFS.map(c => '<option value="' + c + '"' + (SETTINGS.matchCutoff === c ? ' selected' : '') + '>' + c[0].toUpperCase() + c.slice(1) + '</option>').join('');
    overlay.innerHTML = '<div class="fs-cons" id="fs-cons">'
        + '<div class="fs-hdr" id="fs-hdr"><div class="fs-title">' + ICON + ' Fusion — Merge Recordings</div><div class="fs-scope" id="fs-scope">…</div><div class="fs-sp"></div>'
        + '<span class="fs-cfgbtn" id="fs-max" title="maximize / restore">⤢</span><span class="fs-cfgbtn" id="fs-cfg" title="Fusion — options / log / help">⚙</span><span class="fs-x" id="fs-close" title="close">✕</span></div>'
        + '<div class="fs-ctrl"><select id="fs-rg-editions" style="display:none;"><option value="">+ Load recordings from RG edition ▾</option></select>'
        + '<input type="text" id="fs-add-input" placeholder="add recording, release, or release-group — MBID or URL…"><button type="button" id="fs-add-btn" class="fs-btn">Add</button>'
        + '<div class="fs-sp"></div><div class="fs-legend"><span><span class="fs-dot" style="background:var(--fs-green)"></span>ISRC</span>'
        + '<span><span class="fs-dot" style="background:var(--fs-blue)"></span>AcoustID</span>'
        + '<span><span class="fs-dot" style="background:var(--fs-amber)"></span>Length ±' + Math.round(SETTINGS.lengthToleranceMs / 1000) + 's</span>'
        + '<span>Cutoff <select id="fs-cutoff" title="how strict Auto-match is">' + cutoffOpts + '</select></span></div>'
        + '<button type="button" id="fs-automatch" class="fs-btn fs-primary">⚡ Auto-match</button></div>'
        + '<div class="fs-body"><div class="fs-col fs-pool"><div class="fs-colhdr">Pool <span class="fs-cnt" id="fs-pool-cnt">0</span><span class="fs-sp"></span><span class="fs-hint">drag or double-click to add to a group</span></div>'
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
    document.getElementById('fs-add-btn').onclick = onAddByMbid;
    document.getElementById('fs-add-input').addEventListener('keydown', e => { if (e.key === 'Enter') onAddByMbid(); });
    document.getElementById('fs-automatch').onclick = onAutoMatch;
    document.getElementById('fs-mergeall').onclick = mergeAll;
    document.getElementById('fs-clearboard').onclick = () => { clearBoard(); renderAll(); };
    document.getElementById('fs-rg-editions').addEventListener('change', onLoadRgEdition);
    document.getElementById('fs-cutoff').addEventListener('change', e => { SETTINGS.matchCutoff = e.target.value; saveSettings(); Log.info('Match cutoff set to ' + SETTINGS.matchCutoff); });
    wireWindowChrome(document.getElementById('fs-cons'), document.getElementById('fs-hdr'), document.getElementById('fs-max'));
    wireDelegatedEvents();
}
function closeFusion() {
    FUSION_OPEN = false;
    document.getElementById('fs-overlay')?.remove();
    document.removeEventListener('keydown', _fsEscHandler);
}
// #529 follow-up (majkinetor, live): "There is no Fusion button on artist
// recordings." That page is plain server-rendered HTML (unlike the React
// relationship editor), so this scrapes the visible table — one page's worth
// only; MB paginates it, and there's no single clean API query for "every
// recording by this artist" the way rgid: is for a release group.
function scrapeArtistRecordingsTable() {
    const table = document.querySelector('table.tbl');
    if (!table) return { recordings: [], hasPager: false };
    const recs = [];
    for (const tr of table.querySelectorAll('tbody > tr')) {
        const recA = tr.querySelector('td:nth-child(1) a[href^="/recording/"]');
        if (!recA) continue;
        const gid = (recA.getAttribute('href').match(/[0-9a-fA-F-]{36}/) || [])[0];
        if (!gid) continue;
        const title = (recA.textContent || '').trim();
        const artistA = tr.querySelector('td:nth-child(2) a[href^="/artist/"]');
        const artistCredit = artistA ? (artistA.textContent || '').trim() : '';
        const artistGid = artistA ? (artistA.getAttribute('href').match(/[0-9a-fA-F-]{36}/) || [])[0] || null : null;
        const isrcs = [...tr.querySelectorAll('.isrc-list-container code')].map(c => (c.textContent || '').trim());
        const lenText = (tr.children[4] && tr.children[4].textContent || '').trim();
        const lm = lenText.match(/(\d+):(\d\d)/);
        const length = lm ? (parseInt(lm[1], 10) * 60 + parseInt(lm[2], 10)) * 1000 : null;
        const rgLinks = [...tr.querySelectorAll('td:nth-child(6) a[href^="/release-group/"]')].map(a => ({ gid: null, title: (a.textContent || '').trim(), trackNumber: null, trackCount: null }));
        recs.push(mkRecording(gid, { title, length, isrcs, artistCredit, artistGid, releases: rgLinks }));
    }
    return { recordings: recs, hasPager: !!document.querySelector('.pagination, ul.pager') };
}
async function seedFromScope() {
    setScopeLabel('Loading…');
    if (SCOPE.type === 'release') {
        const { release, recordings } = await fetchReleaseRecordings(SCOPE.mbid);
        STATE.releaseInfo = release;
        recordings.forEach(r => addToPool(r));
        setScopeLabel(release ? ('Release: "' + release.title + '" · ' + release.artistCredit) : 'Release');
        renderAll();
        await maybeShowRGDropdown(SCOPE.mbid);
        enrichAllReleases(recordings, 3, () => { if (FUSION_OPEN) renderAll(); }).catch(() => {});
    } else if (SCOPE.type === 'release-group') {
        const { rg, recordings } = await fetchRGRecordings(SCOPE.mbid);
        STATE.rgInfo = rg;
        recordings.forEach(r => addToPool(r));
        setScopeLabel(rg ? ('Release group: "' + rg.title + '" · ' + rg.artistCredit) : 'Release group');
    } else if (SCOPE.type === 'recording') {
        const rec = await fetchRecordingByGid(SCOPE.mbid);
        if (rec) addToPool(rec);
        setScopeLabel(rec ? ('Recording: "' + rec.title + '"') : 'Recording');
    } else if (SCOPE.type === 'artist-recordings') {
        const { recordings, hasPager } = scrapeArtistRecordingsTable();
        recordings.forEach(r => addToPool(r));
        setScopeLabel('Artist recordings' + (hasPager ? ' — this page only (' + recordings.length + '); use MB\'s own pager + reopen Fusion for more' : ''));
        Log.info('Artist-recordings seed: ' + recordings.length + ' recording(s) scraped from the current page' + (hasPager ? ' (paginated — only this page)' : ''));
        renderAll();
        enrichAllReleases(recordings, 3, () => { if (FUSION_OPEN) renderAll(); }).catch(() => {});
    }
    renderAll();
}
async function openFusion() {
    if (FUSION_OPEN) return;
    FUSION_OPEN = true;
    fsStyle();
    buildShell();
    renderAll();
    if (STATE.recordings.size === 0) await seedFromScope();
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
}
boot();

try {
    W.__fusion = {
        VERSION, SCOPE, STATE, SETTINGS_DEFAULTS, MATCH_CUTOFFS,
        get SETTINGS() { return SETTINGS; },
        normName, tokenMatch, titleSimilar, artistSimilar, lengthClose, fuzzyRatio, levenshtein, acName, acPrimaryGid, dur, parseMbidFromInput, parseAddInput,
        mkRecording, fetchReleaseRecordings, fetchRGRecordings, fetchRecordingByGid, fetchAllReleases, resolveInternalId, fetchAcoustIds,
        pairSignals, computeGroupConfidence, shouldUnion, autoMatch, enrichAcoustIds, enrichAllReleases,
        addToPool, createGroupWithMember, addToGroup, returnToPool, removeFromGroupAndPool, removeFromPoolPermanently, findGroup, deleteGroup, clearBoard, videoConflict,
        buildEditNote, ensureInternalIds, mergeGroup, mergeAll, describeRecordingForLog,
        openFusion, closeFusion, seedFromScope, renderAll, scrapeArtistRecordingsTable,
        gmGet, gmPost, wsGet,
        getLogLines: () => _logBuf.map(r => r.line),
    };
} catch (e) {}

})();
