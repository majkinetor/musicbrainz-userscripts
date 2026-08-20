// ==UserScript==
// @name         Fusion
// @namespace    https://musicbrainz.org/
// @version      2026.8.20
// @description  Merge-recordings assistant for MusicBrainz: gather a pool of candidate recordings from a release / release group / recording page (or paste any MBID/URL), auto-match them into merge groups by ISRC / AcoustID / length / title+artist, review and adjust the groups, then submit the merges directly in the background — no MB merge page involved.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPkZ1c2lvbjwvdGl0bGU+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOGE1Y2Y2IiBzdHJva2Utd2lkdGg9IjciPgogICAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iNjQiIHJ4PSI1MiIgcnk9IjIyIi8+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiIHRyYW5zZm9ybT0icm90YXRlKDYwIDY0IDY0KSIvPgogICAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iNjQiIHJ4PSI1MiIgcnk9IjIyIiB0cmFuc2Zvcm09InJvdGF0ZSgxMjAgNjQgNjQpIi8+CiAgPC9nPgogIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjE0IiBmaWxsPSIjNmQzZmYwIi8+Cjwvc3ZnPgo=
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/fusion/README.md
// @match        https://*.musicbrainz.org/release/*
// @match        https://*.musicbrainz.org/release-group/*
// @match        https://*.musicbrainz.org/recording/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// ==/UserScript==

(function () {
'use strict';

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '2026.8.20';
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

async function wsGet(path) {
    try {
        const r = await fetch(path, { headers: { Accept: 'application/json' } });
        if (!r.ok) { Log.warn('GET ' + path + ' → ' + r.status); return null; }
        return await r.json();
    } catch (e) { Log.error('GET ' + path + ' failed: ' + e.message); return null; }
}

// ── settings (GM-persisted) ──────────────────────────────────────────────
const SETTINGS_KEY = 'fusion.settings';
const SETTINGS_DEFAULTS = { lengthToleranceMs: 5000, acoustidEnrich: true, acoustidPoolCap: 60, makeVotable: false, editNoteExtra: '' };
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
const titleSimilar = (a, b) => tokenMatch(a, b, 'max', 0.6);
const artistTokenCount = s => normName(s).split(' ').filter(t => t.length >= 2).length;
const artistSimilar = (a, b) => tokenMatch(a, b, artistTokenCount(b) <= artistTokenCount(a) ? 'min' : 'max', 0.8);
function lengthClose(a, b, tolMs) { if (a == null || b == null) return false; return Math.abs(a - b) <= tolMs; }

function acName(ac) {
    if (!Array.isArray(ac)) return '';
    return ac.map(x => (x.name || (x.artist && x.artist.name) || '') + (x.joinphrase || '')).join('');
}
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
    return Object.assign({ gid, title: '', length: null, isrcs: [], artistCredit: '', releases: [], acoustids: null }, opts || {});
}

async function fetchReleaseRecordings(releaseMbid) {
    const j = await wsGet('/ws/2/release/' + releaseMbid + '?inc=recordings+isrcs+artist-credits&fmt=json');
    if (!j) return { release: null, recordings: [] };
    const recs = [];
    for (const m of j.media || []) {
        for (const t of m.tracks || []) {
            const r = t.recording || {};
            recs.push(mkRecording(r.id, {
                title: r.title || t.title,
                length: r.length != null ? r.length : t.length,
                isrcs: r.isrcs || [],
                artistCredit: acName(r['artist-credit'] || j['artist-credit']),
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
                return { gid: rel.id, title: rel.title, trackNumber, trackCount: rel['track-count'] || null };
            });
            recordings.push(mkRecording(r.id, { title: r.title, length: r.length, isrcs: r.isrcs || [], artistCredit: acName(r['artist-credit']), releases }));
        }
        offset += limit; guard++;
    }
    Log.info('RG seed: ' + recordings.length + ' recording(s) of ' + total + ' total (rgid:' + rgMbid + ')');
    return { rg, recordings };
}

async function fetchRecordingByGid(gid) {
    const j = await wsGet('/ws/2/recording/' + gid + '?inc=releases+isrcs+artist-credits&fmt=json');
    if (!j) return null;
    const releases = (j.releases || []).map(rel => ({ gid: rel.id, title: rel.title, trackNumber: null, trackCount: null }));
    return mkRecording(j.id, { title: j.title, length: j.length, isrcs: j.isrcs || [], artistCredit: acName(j['artist-credit']), releases });
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
const STATE = { recordings: new Map(), poolOrder: [], groups: [], selected: null, _dragGid: null, releaseInfo: null, rgInfo: null };

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
        if (!confidence && sig.title && sig.artist && sig.length) confidence = 'medium';
    }
    return { confidence: confidence || 'manual', signals: [...signals] };
}
function refreshGroupMeta(g) {
    const members = g.memberGids.map(x => STATE.recordings.get(x)).filter(Boolean);
    const meta = computeGroupConfidence(members);
    g.confidence = meta.confidence; g.signals = meta.signals;
    if (!g.memberGids.includes(g.target)) g.target = g.memberGids[0];
}
function dissolveOrRefresh(g) {
    if (g.memberGids.length < 2) {
        g.memberGids.forEach(rem => { if (!STATE.poolOrder.includes(rem)) STATE.poolOrder.push(rem); });
        STATE.groups = STATE.groups.filter(x => x.id !== g.id);
    } else refreshGroupMeta(g);
}
function returnToPool(gid, groupId) {
    const g = findGroup(groupId); if (!g) return;
    const i = g.memberGids.indexOf(gid); if (i === -1) return;
    g.memberGids.splice(i, 1);
    STATE.poolOrder.push(gid);
    dissolveOrRefresh(g);
    Log.info('Returned ' + gid + ' to the pool');
}
function removeFromGroupAndPool(gid, groupId) {
    const g = findGroup(groupId); if (!g) return;
    const i = g.memberGids.indexOf(gid); if (i === -1) return;
    g.memberGids.splice(i, 1);
    STATE.recordings.delete(gid);
    dissolveOrRefresh(g);
    Log.info('Removed ' + gid + ' from group and pool');
}
function addToGroup(gid, groupId) {
    const g = findGroup(groupId); if (!g) return;
    const i = STATE.poolOrder.indexOf(gid); if (i === -1) return;
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

function pairSignals(a, b, tolMs) {
    const sig = { isrc: false, acoustid: false, length: false, title: false, artist: false };
    if (a.isrcs.length && b.isrcs.length && a.isrcs.some(x => b.isrcs.includes(x))) sig.isrc = true;
    if (a.acoustids && b.acoustids && a.acoustids.length && b.acoustids.length && a.acoustids.some(x => b.acoustids.includes(x))) sig.acoustid = true;
    if (lengthClose(a.length, b.length, tolMs)) sig.length = true;
    if (a.title && b.title && titleSimilar(a.title, b.title)) sig.title = true;
    if (a.artistCredit && b.artistCredit && artistSimilar(a.artistCredit, b.artistCredit)) sig.artist = true;
    return sig;
}
function autoMatch(pool, tolMs) {
    if (pool.length < 2) return [];
    const parent = new Map(pool.map(r => [r.gid, r.gid]));
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const sig = pairSignals(pool[i], pool[j], tolMs);
            if (sig.isrc || sig.acoustid || (sig.title && sig.artist && sig.length)) union(pool[i].gid, pool[j].gid);
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
async function enrichAcoustIds(recs, concurrency) {
    concurrency = concurrency || 4;
    let i = 0;
    async function worker() { while (i < recs.length) { const rec = recs[i++]; if (rec.acoustids == null) rec.acoustids = await fetchAcoustIds(rec.gid); } }
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
    if (SETTINGS.editNoteExtra) note += '\n\n' + SETTINGS.editNoteExtra;
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
async function mergeGroup(group) {
    if (!group || group.state === 'busy' || group.state === 'done') return;
    if (group.memberGids.length < 2) { Log.warn('merge skipped: group ' + group.id + ' has fewer than 2 members'); return; }
    group.state = 'busy'; group.error = null; renderGroups();
    try {
        const ids = await ensureInternalIds(group.memberGids);
        const targetIdx = group.memberGids.indexOf(group.target);
        const targetId = ids[targetIdx === -1 ? 0 : targetIdx];
        Log.info('Merging recordings [' + ids.join(', ') + '] → target ' + targetId);
        const addQs = ids.map(id => 'add-to-merge=' + id).join('&');
        const gr = await gmGet(location.origin + '/recording/merge_queue?' + addQs, { Accept: 'text/html' });
        if (gr.status < 200 || gr.status >= 400) throw new Error('merge_queue GET failed: HTTP ' + gr.status);
        const mergeUrl = gr.finalUrl || (location.origin + '/recording/merge');
        const body = new URLSearchParams();
        ids.forEach((id, i) => body.append('merge.merging.' + i, String(id)));
        body.append('merge.target', String(targetId));
        body.append('merge.edit_note', buildEditNote(group));
        if (SETTINGS.makeVotable) body.append('merge.make_votable', '1');
        const pr = await gmPost(mergeUrl, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Referer: mergeUrl, Origin: location.origin });
        if (pr.status >= 400) throw new Error('merge POST failed: HTTP ' + pr.status);
        const finalUrl = pr.finalUrl || '';
        const reRendered = /\/recording\/merge(\?|$)/.test(finalUrl) || /name="merge\.target"/.test(pr.responseText || '');
        if (reRendered) throw new Error('merge form returned an error (nothing submitted) — check you are logged in with merge privileges');
        group.state = 'done';
        Log.ok('Merged group ' + group.id + ' → ' + finalUrl);
    } catch (e) {
        group.state = 'error'; group.error = e.message;
        Log.error('Merge failed for group ' + group.id + ': ' + e.message);
    }
    renderGroups(); renderFooter();
}
async function mergeAll() {
    const pending = STATE.groups.filter(g => g.state === 'pending' || g.state === 'error');
    for (const g of pending) { await mergeGroup(g); await new Promise(res => setTimeout(res, 900)); }
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
        + 'width:min(1180px,96vw);max-height:92vh;background:var(--fs-panel);color:var(--fs-text);border:1px solid var(--fs-border);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);'
        + 'font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden}'
        + '.fs-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--fs-panel2);border-bottom:1px solid var(--fs-border)}'
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
        + '.fs-body{display:flex;height:520px}'
        + '.fs-col{display:flex;flex-direction:column;min-width:0}'
        + '.fs-pool{width:360px;border-right:1px solid var(--fs-border);background:var(--fs-bg)}'
        + '.fs-groups{flex:1;background:var(--fs-panel)}'
        + '.fs-colhdr{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--fs-border);font-weight:700;font-size:12px;letter-spacing:.3px;color:var(--fs-muted);text-transform:uppercase;background:var(--fs-panel2)}'
        + '.fs-cnt{background:var(--fs-panel);border:1px solid var(--fs-border);border-radius:10px;padding:1px 7px;color:var(--fs-text);font-weight:600}'
        + '.fs-hint{text-transform:none;font-weight:400;color:#65667a}'
        + '.fs-colbody{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px}'
        + '.fs-empty{color:#65667a;font-size:12px;padding:14px;text-align:center}'
        + '.fs-pcard{background:var(--fs-panel2);border:1px solid var(--fs-border);border-radius:7px;padding:7px 9px;display:flex;align-items:center;gap:8px;cursor:grab}'
        + '.fs-pcard.fs-selected{border-color:var(--fs-purple)}'
        + '.fs-grip{color:#565768;font-size:12px;letter-spacing:-1px}'
        + '.fs-info{flex:1;min-width:0}'
        + '.fs-t{font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-m{color:var(--fs-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}'
        + '.fs-badges{display:flex;gap:3px;flex-shrink:0}'
        + '.fs-b{width:6px;height:6px;border-radius:50%}'
        + '.fs-b-on{background:var(--fs-green)} .fs-b-off{background:#454657}'
        + '.fs-rm{color:var(--fs-muted);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0}'
        + '.fs-rm:hover{color:var(--fs-red)}'
        + '.fs-gcard{background:var(--fs-panel2);border:1px solid var(--fs-border);border-left:3px solid var(--fs-green);border-radius:7px;overflow:hidden}'
        + '.fs-gcard-med{border-left-color:var(--fs-amber)}'
        + '.fs-gcard-manual{border-left-color:var(--fs-blue);border-left-style:dashed}'
        + '.fs-ghdr{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,.02);border-bottom:1px solid var(--fs-border)}'
        + '.fs-gt{font-weight:700;font-size:12.5px}'
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
        + '.fs-grows{padding:4px 6px}'
        + '.fs-grow{display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:5px}'
        + '.fs-grow:hover{background:rgba(255,255,255,.03)}'
        + '.fs-grow input[type=radio]{accent-color:var(--fs-purple)}'
        + '.fs-grow .fs-t{flex:1;min-width:0}'
        + '.fs-grow .fs-rel{color:var(--fs-muted);font-size:11px;width:190px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fs-grow .fs-len{color:var(--fs-muted);font-size:11px;width:44px;flex-shrink:0}'
        + '.fs-grow .fs-isrc{color:#7d7e94;font-size:10px;width:96px;flex-shrink:0;font-family:ui-monospace,Consolas,monospace}'
        + '.fs-grow .fs-kept{color:var(--fs-green);font-weight:700;font-size:10px;width:44px;flex-shrink:0}'
        + '.fs-acts{display:flex;gap:4px;flex-shrink:0}'
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

function poolCardHtml(rec) {
    const rel = rec.releases[0];
    const relText = rel ? (rel.title + (rel.trackNumber ? ' · track ' + rel.trackNumber : '')) : '(no release)';
    const isrcOn = rec.isrcs && rec.isrcs.length ? 'on' : 'off';
    const acOn = rec.acoustids && rec.acoustids.length ? 'on' : 'off';
    return '<div class="fs-pcard" draggable="true" data-gid="' + rec.gid + '">'
        + '<span class="fs-grip">⠿</span>'
        + '<div class="fs-info"><div class="fs-t" title="' + escapeHtml(rec.title) + '">' + escapeHtml(rec.title) + '</div>'
        + '<div class="fs-m" title="' + escapeHtml(relText) + '">' + escapeHtml(relText) + ' · ' + dur(rec.length) + '</div></div>'
        + '<div class="fs-badges"><span class="fs-b fs-b-' + isrcOn + '" title="ISRC"></span><span class="fs-b fs-b-' + acOn + '" title="AcoustID"></span></div>'
        + '<span class="fs-rm" data-act="pool-remove" title="remove from pool">✕</span></div>';
}
function groupCardHtml(group) {
    const members = group.memberGids.map(g => STATE.recordings.get(g)).filter(Boolean);
    const confClass = group.confidence === 'high' ? 'high' : group.confidence === 'medium' ? 'med' : 'manual';
    const confLabel = group.confidence === 'high' ? 'HIGH' : group.confidence === 'medium' ? 'MEDIUM' : 'MANUAL';
    const sigNames = { isrc: 'ISRC', acoustid: 'AcoustID', length: 'Length', title: 'Title', artist: 'Artist' };
    const sigChips = Object.keys(sigNames).map(k => '<span class="' + (group.signals.includes(k) ? 'hit' : '') + '">' + sigNames[k] + '</span>').join('');
    const busy = group.state === 'busy', done = group.state === 'done';
    const stateLabel = busy ? '⏳ Merging…' : done ? '✓ Merged' : group.state === 'error' ? '⚠ Retry merge' : '⚡ Merge ↗';
    const stateCls = done ? 'fs-done' : group.state === 'error' ? 'fs-err' : '';
    const rows = members.map(m => {
        const rel = m.releases[0];
        const relText = rel ? (rel.title + (rel.trackNumber ? ' · track ' + rel.trackNumber : '')) : '(no release)';
        return '<div class="fs-grow" data-gid="' + m.gid + '">'
            + '<input type="radio" data-act="target" ' + (group.target === m.gid ? 'checked' : '') + ' ' + (busy || done ? 'disabled' : '') + '>'
            + '<span class="fs-t" title="' + escapeHtml(m.title) + '">' + escapeHtml(m.title) + '</span>'
            + '<span class="fs-rel" title="' + escapeHtml(relText) + '">' + escapeHtml(relText) + '</span>'
            + '<span class="fs-len">' + dur(m.length) + '</span>'
            + '<span class="fs-isrc">' + ((m.isrcs && m.isrcs[0]) || '—') + '</span>'
            + '<span class="fs-kept">' + (group.target === m.gid ? 'KEEP' : '') + '</span>'
            + '<span class="fs-acts"><span data-act="return" title="return to pool">↩</span><span class="fs-rm-x" data-act="remove-both" title="remove from group + pool">✕</span></span></div>';
    }).join('');
    const errMsg = group.state === 'error' ? '<div class="fs-gerr">' + escapeHtml(group.error || 'merge failed') + '</div>' : '';
    const dropZone = done ? '' : '<div class="fs-gdrop" data-act="drop-zone">drop from pool to add another recording to this group</div>';
    return '<div class="fs-gcard fs-gcard-' + confClass + '" data-gid="' + group.id + '">'
        + '<div class="fs-ghdr"><span class="fs-gt" title="' + escapeHtml(members[0] ? members[0].title : '') + '">' + escapeHtml(members[0] ? members[0].title : 'New group') + '</span>'
        + '<span class="fs-conf fs-conf-' + confClass + '">' + confLabel + '</span>'
        + '<div class="fs-sig">' + sigChips + '</div><div class="fs-sp"></div>'
        + '<button class="fs-mbtn ' + stateCls + '" type="button" data-act="merge-group" ' + (busy || done ? 'disabled' : '') + '>' + stateLabel + '</button></div>'
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
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Matching…';
    try {
        const poolRecs = STATE.poolOrder.map(g => STATE.recordings.get(g)).filter(Boolean);
        if (SETTINGS.acoustidEnrich) {
            if (poolRecs.length <= SETTINGS.acoustidPoolCap) { Log.info('Enriching ' + poolRecs.length + ' pool recording(s) with AcoustID rels…'); await enrichAcoustIds(poolRecs); }
            else Log.warn('Skipping AcoustID enrichment — pool has ' + poolRecs.length + ' recordings (cap ' + SETTINGS.acoustidPoolCap + ')');
        }
        const groupings = autoMatch(poolRecs, SETTINGS.lengthToleranceMs);
        Log.info('Auto-match formed ' + groupings.length + ' group(s) from ' + poolRecs.length + ' pool recording(s)');
        for (const g of groupings) {
            g.memberGids.forEach(gid => { const i = STATE.poolOrder.indexOf(gid); if (i !== -1) STATE.poolOrder.splice(i, 1); });
            STATE.groups.push(g);
        }
        renderAll();
    } finally { btn.disabled = false; btn.textContent = orig; }
}
async function onAddByMbid() {
    const input = document.getElementById('fs-add-input'); if (!input) return;
    const mbid = parseMbidFromInput(input.value);
    if (!mbid) { Log.warn('Add: no MBID found in "' + input.value + '"'); return; }
    if (STATE.recordings.has(mbid)) { Log.warn('Add: ' + mbid + ' is already in the pool or a group'); input.value = ''; return; }
    Log.info('Adding recording ' + mbid + '…');
    const rec = await fetchRecordingByGid(mbid);
    if (!rec) { Log.error('Add: could not fetch recording ' + mbid + ' (is it a recording MBID?)'); return; }
    addToPool(rec); input.value = ''; renderAll();
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

function wireDelegatedEvents() {
    const poolBody = document.getElementById('fs-pool-body');
    const groupsBody = document.getElementById('fs-groups-body');
    poolBody.addEventListener('click', e => {
        const card = e.target.closest('.fs-pcard'); if (!card) return;
        const gid = card.dataset.gid;
        if (e.target.dataset.act === 'pool-remove') { removeFromPoolPermanently(gid); renderAll(); return; }
        STATE.selected = STATE.selected === gid ? null : gid;
        renderPool();
    });
    poolBody.addEventListener('dragstart', e => {
        const card = e.target.closest('.fs-pcard'); if (!card) return;
        STATE._dragGid = card.dataset.gid;
        try { e.dataTransfer.setData('text/plain', card.dataset.gid); e.dataTransfer.effectAllowed = 'move'; } catch (ex) {}
    });

    groupsBody.addEventListener('click', e => {
        if (e.target.closest('#fs-newgroup')) {
            if (STATE.selected && STATE.poolOrder.includes(STATE.selected)) { createGroupWithMember(STATE.selected); STATE.selected = null; renderAll(); }
            return;
        }
        const act = e.target.dataset.act;
        const row = e.target.closest('.fs-grow');
        const card = e.target.closest('.fs-gcard');
        if (!card) return;
        if (act === 'target' && row) { const g = findGroup(card.dataset.gid); if (g) { g.target = row.dataset.gid; renderGroups(); } return; }
        if (act === 'return' && row) { returnToPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'remove-both' && row) { removeFromGroupAndPool(row.dataset.gid, card.dataset.gid); renderAll(); return; }
        if (act === 'merge-group') { mergeGroup(findGroup(card.dataset.gid)); return; }
        if (act === 'drop-zone' && STATE.selected && STATE.poolOrder.includes(STATE.selected)) { addToGroup(STATE.selected, card.dataset.gid); STATE.selected = null; renderAll(); return; }
    });
    groupsBody.addEventListener('dragover', e => { if (e.target.closest('#fs-newgroup') || e.target.closest('.fs-gcard')) e.preventDefault(); });
    groupsBody.addEventListener('drop', e => {
        const gid = STATE._dragGid || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        if (!gid || !STATE.poolOrder.includes(gid)) return;
        if (e.target.closest('#fs-newgroup')) { e.preventDefault(); createGroupWithMember(gid); STATE.selected = null; renderAll(); return; }
        const card = e.target.closest('.fs-gcard'); if (!card) return;
        e.preventDefault();
        addToGroup(gid, card.dataset.gid); STATE.selected = null; renderAll();
    });
}

function openSettings(anchor) {
    document.getElementById('fs-settings')?.remove();
    const s = el('div', 'fs-settings'); s.id = 'fs-settings';
    s.innerHTML = '<h4>' + ICON + ' Fusion <span class="fs-ver" title="installed script version">v' + VERSION + '</span><button class="fs-logbtn" type="button" title="Open the activity log">Log</button><a class="fs-help" href="' + HELP_URL + '" target="_blank" rel="noopener" title="open the README in a new tab">? Help</a></h4>'
        + '<label class="fs-opt"><input type="checkbox" id="fs-opt-votable"> Always require a vote (make_votable)</label>'
        + '<label class="fs-opt"><input type="checkbox" id="fs-opt-acoustid"> Enrich matches with AcoustID (recording URL-rels)</label>'
        + '<label class="fs-opt">Length tolerance <input type="number" id="fs-opt-tol" min="0" max="60" style="width:48px"> s</label>'
        + '<label class="fs-opt">Extra edit-note text<textarea id="fs-opt-note" rows="2"></textarea></label>';
    document.body.appendChild(s);
    const r = anchor.getBoundingClientRect();
    s.style.top = (r.bottom + 6) + 'px'; s.style.right = '14px';
    s.querySelector('#fs-opt-votable').checked = !!SETTINGS.makeVotable;
    s.querySelector('#fs-opt-acoustid').checked = SETTINGS.acoustidEnrich !== false;
    s.querySelector('#fs-opt-tol').value = Math.round(SETTINGS.lengthToleranceMs / 1000);
    s.querySelector('#fs-opt-note').value = SETTINGS.editNoteExtra || '';
    s.querySelector('#fs-opt-votable').onchange = e => { SETTINGS.makeVotable = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-acoustid').onchange = e => { SETTINGS.acoustidEnrich = e.target.checked; saveSettings(); };
    s.querySelector('#fs-opt-tol').onchange = e => { SETTINGS.lengthToleranceMs = Math.max(0, Number(e.target.value) || 0) * 1000; saveSettings(); };
    s.querySelector('#fs-opt-note').onchange = e => { SETTINGS.editNoteExtra = e.target.value; saveSettings(); };
    s.querySelector('.fs-logbtn').onclick = () => { s.remove(); openLog(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
}

let FUSION_OPEN = false;
function _fsEscHandler(e) { if (e.key === 'Escape') closeFusion(); }
function buildShell() {
    document.getElementById('fs-overlay')?.remove();
    const overlay = el('div', 'fs-overlay'); overlay.id = 'fs-overlay';
    overlay.innerHTML = '<div class="fs-cons" id="fs-cons">'
        + '<div class="fs-hdr"><div class="fs-title">' + ICON + ' Fusion — Merge Recordings</div><div class="fs-scope" id="fs-scope">…</div><div class="fs-sp"></div>'
        + '<span class="fs-cfgbtn" id="fs-cfg" title="Fusion — options / log / help">⚙</span><span class="fs-x" id="fs-close" title="close">✕</span></div>'
        + '<div class="fs-ctrl"><select id="fs-rg-editions" style="display:none;"><option value="">+ Load recordings from RG edition ▾</option></select>'
        + '<input type="text" id="fs-add-input" placeholder="add recording by MBID or URL…"><button type="button" id="fs-add-btn" class="fs-btn">Add</button>'
        + '<div class="fs-sp"></div><div class="fs-legend"><span><span class="fs-dot" style="background:var(--fs-green)"></span>ISRC</span>'
        + '<span><span class="fs-dot" style="background:var(--fs-blue)"></span>AcoustID</span>'
        + '<span><span class="fs-dot" style="background:var(--fs-amber)"></span>Length ±' + Math.round(SETTINGS.lengthToleranceMs / 1000) + 's</span></div>'
        + '<button type="button" id="fs-automatch" class="fs-btn fs-primary">⚡ Auto-match</button></div>'
        + '<div class="fs-body"><div class="fs-col fs-pool"><div class="fs-colhdr">Pool <span class="fs-cnt" id="fs-pool-cnt">0</span><span class="fs-sp"></span><span class="fs-hint">ungrouped — drag, or select + click a group to add</span></div>'
        + '<div class="fs-colbody" id="fs-pool-body"></div></div>'
        + '<div class="fs-col fs-groups"><div class="fs-colhdr">Groups <span class="fs-cnt" id="fs-groups-cnt">0</span><span class="fs-sp"></span><span class="fs-hint">ready to merge</span></div>'
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
    document.getElementById('fs-rg-editions').addEventListener('change', onLoadRgEdition);
    wireDelegatedEvents();
}
function closeFusion() {
    FUSION_OPEN = false;
    document.getElementById('fs-overlay')?.remove();
    document.removeEventListener('keydown', _fsEscHandler);
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
    } else if (SCOPE.type === 'release-group') {
        const { rg, recordings } = await fetchRGRecordings(SCOPE.mbid);
        STATE.rgInfo = rg;
        recordings.forEach(r => addToPool(r));
        setScopeLabel(rg ? ('Release group: "' + rg.title + '" · ' + rg.artistCredit) : 'Release group');
    } else if (SCOPE.type === 'recording') {
        const rec = await fetchRecordingByGid(SCOPE.mbid);
        if (rec) addToPool(rec);
        setScopeLabel(rec ? ('Recording: "' + rec.title + '"') : 'Recording');
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
        VERSION, SCOPE, STATE, SETTINGS_DEFAULTS,
        get SETTINGS() { return SETTINGS; },
        normName, tokenMatch, titleSimilar, artistSimilar, lengthClose, acName, dur, parseMbidFromInput,
        mkRecording, fetchReleaseRecordings, fetchRGRecordings, fetchRecordingByGid, resolveInternalId, fetchAcoustIds,
        pairSignals, computeGroupConfidence, autoMatch, enrichAcoustIds,
        addToPool, createGroupWithMember, addToGroup, returnToPool, removeFromGroupAndPool, removeFromPoolPermanently, findGroup,
        buildEditNote, ensureInternalIds, mergeGroup, mergeAll,
        openFusion, closeFusion, seedFromScope, renderAll,
        gmGet, gmPost, wsGet,
    };
} catch (e) {}

})();
