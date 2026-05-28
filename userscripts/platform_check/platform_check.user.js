// ==UserScript==
// @name         MB Platform Check
// @namespace    http://tampermonkey.net/
// @version      2026.5.28.215044
// @description  Find a MusicBrainz release on Spotify, Discogs and Bandcamp. Uses existing URL relationships when present, otherwise searches via DuckDuckGo's HTML interface and the Discogs public API. No tokens required.
// @match        https://musicbrainz.org/release/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      musicbrainz.org
// @connect      query.wikidata.org
// @connect      search.brave.com
// @connect      html.duckduckgo.com
// @connect      duckduckgo.com
// @connect      api.discogs.com
// @connect      www.discogs.com
// @connect      open.spotify.com
// @connect      bandcamp.com
// @connect      *
// ==/UserScript==
(function () {
'use strict';

// ─── UI ────────────────────────────────────────────────────────────────────
const sidebar = document.querySelector('#sidebar');
if (!sidebar) return;

const container = document.createElement('div');
container.className = 'online-search-box';
container.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #FAF9F6; border: 1px solid #D8D8D8; border-radius: 6px; font-size: 13px; font-family: sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
// MB's site CSS adds an external-link icon to every `target="_blank"` anchor
// (`a[rel~="external"]::after` / similar). On the dark-themed sidebar it
// renders as a missing-image red square next to each platform name. Suppress
// it on our anchors via inline ::after override scoped to the panel.
const iconBtn = 'cursor: pointer; user-select: none; color: #666; padding: 2px 6px; border-radius: 4px; line-height: 1; font-size: 14px;';
container.innerHTML = `
<style>
  /* MB's site CSS marks any outbound link with a red external-link ::after icon
   * via selectors that beat our specificity unless we anchor on #sidebar. The
   * ID-prefixed selector (specificity 1,2,2) beats anything class-only. */
  #sidebar .online-search-box a::before,
  #sidebar .online-search-box a::after { content: none !important; display: none !important; background: none !important; background-image: none !important; }
  #sidebar .online-search-box a img.external,
  #sidebar .online-search-box a img[src*="external"] { display: none !important; }
  .online-search-box .pc-icon-btn:hover { background: #ECECEC; color: #222; }
</style>
<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #EEE; padding-bottom: 4px; margin-bottom: 8px;">
  <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #666;">Platform Check</h3>
  <span id="mb-refresh-btn" class="pc-icon-btn" title="Refresh — clear cache and re-scan" style="${iconBtn}">↻</span>
</div>
<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
  ${['spotify', 'discogs', 'bandcamp'].map(p => `
  <div id="row-${p}" style="display: flex; flex-direction: column; gap: 2px;">
    <div style="display: flex; align-items: center;">
      <span id="ico-${p}" style="margin-right: 6px; color: #888; font-size: 11px; min-width: 14px;">⚪</span>
      <a id="mb-online-${p}" href="#" target="_blank" rel="noopener" style="color: ${p === 'spotify' ? '#1DB954' : p === 'bandcamp' ? '#629AA9' : '#222'}; text-decoration: none; font-weight: 600; flex-grow: 1;">${p[0].toUpperCase() + p.slice(1)}</a>
      <span id="val-${p}" style="font-size: 11px; color: #777; font-family: monospace;">(-- tracks)</span>
    </div>
    <div id="meta-${p}" style="font-size: 11px; color: #999; padding-left: 20px; font-family: sans-serif;"></div>
  </div>`).join('')}
</div>
<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #EEE;">
  <span id="mb-log-open-btn"    class="pc-icon-btn" title="Diagnostic log"  style="${iconBtn}">ⓘ</span>
  <span id="mb-token-setup-btn" class="pc-icon-btn" title="Provider toggles" style="${iconBtn}">⚙</span>
</div>
`;

// Diagnostic log modal
const logModal = document.createElement('div');
logModal.id = 'mb-log-modal-overlay';
logModal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 99999; font-family: monospace; padding: 30px; box-sizing: border-box;';
// Provider filter chips — one per source that produces log lines. Default all
// active (toggled = filter ON = entries hidden). State is per-session only;
// not persisted because the natural workflow is "open log to investigate
// one provider's behavior on this page".
const LOG_SOURCES = ['System', 'MusicBrainz', 'Wikidata', 'Spotify', 'Discogs', 'Bandcamp'];
const LOG_SOURCE_COLORS = {
    System: '#999', MusicBrainz: '#BA68C8', Wikidata: '#FFD54F',
    Spotify: '#1DB954', Discogs: '#E0E0E0', Bandcamp: '#629AA9',
};
logModal.innerHTML = `
<style>
  .pc-log-chip { display: inline-block; padding: 3px 9px; margin-right: 4px; border-radius: 12px; font-size: 11px; font-weight: bold; cursor: pointer; user-select: none; border: 1px solid #444; }
  .pc-log-chip.off { opacity: 0.35; background: transparent !important; color: #AAA !important; }
  ${LOG_SOURCES.map(s => `#mb-finder-log-panel.pc-hide-${s.toLowerCase()} [data-platform="${s.toLowerCase()}"] { display: none; }`).join('\n  ')}
</style>
<div id="mb-log-modal-card" style="max-width: 900px; height: 85vh; margin: 0 auto; background: #1E1E1E; color: #FFF; border-radius: 8px; border: 1px solid #444; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
  <div style="padding: 10px 12px; background: #2D2D2D; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
    <span style="font-weight: bold; color: #A3BE8C; font-size: 14px; white-space: nowrap;">Platform Check log</span>
    <div id="mb-log-filters" style="flex-grow: 1; text-align: left;">
      ${LOG_SOURCES.map(s => `<span class="pc-log-chip" data-source="${s.toLowerCase()}" style="background:${LOG_SOURCE_COLORS[s]}33; color:${LOG_SOURCE_COLORS[s]};">${s}</span>`).join('')}
    </div>
    <button id="mb-modal-copy-btn" style="padding: 6px 12px; background: #434C5E; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">Copy</button>
  </div>
  <div id="mb-finder-log-panel" style="flex-grow: 1; overflow-y: auto; padding: 15px; font-size: 12px; line-height: 1.5em; white-space: pre-wrap; background: #151515;"></div>
</div>`;

// Provider toggles
const providerModal = document.createElement('div');
providerModal.id = 'mb-provider-modal-overlay';
providerModal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); z-index: 100000; font-family: sans-serif;';
providerModal.innerHTML = `
<div id="mb-provider-modal-card" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 420px; background: #FFF; padding: 24px; border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid #DDD;">
  <h2 style="margin: 0 0 12px 0; font-size: 18px;">Enable providers</h2>
  <p style="font-size: 13px; color: #555; margin: 0 0 16px 0;">Toggle which services to query. All results come from public endpoints — no API keys required.</p>
  ${['spotify', 'discogs', 'bandcamp'].map(p => `
    <label style="display: flex; align-items: center; margin-bottom: 10px; font-size: 13px; cursor: pointer;">
      <input type="checkbox" id="mb-toggle-${p}" checked style="margin-right: 10px; width: 16px; height: 16px;">
      <span style="font-weight: 500;">${p[0].toUpperCase() + p.slice(1)}</span>
    </label>`).join('')}
  <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
    <button id="mb-provider-cancel-btn" style="padding: 8px 16px; background: #E0E0E0; border: none; border-radius: 4px; font-size: 13px; cursor: pointer;">Cancel</button>
    <button id="mb-provider-save-btn" style="padding: 8px 16px; background: #1DB954; border: none; border-radius: 4px; font-size: 13px; color: #FFF; cursor: pointer;">Save</button>
  </div>
</div>`;

document.body.appendChild(logModal);
document.body.appendChild(providerModal);
const coverArt = sidebar.querySelector('.cover-art');
if (coverArt) sidebar.insertBefore(container, coverArt);
else sidebar.prepend(container);

const logPanel = document.getElementById('mb-finder-log-panel');
const providerRows = Object.fromEntries(['spotify', 'discogs', 'bandcamp'].map(p => [p, document.getElementById(`row-${p}`)]));

['spotify', 'discogs', 'bandcamp'].forEach(p => {
    const enabled = GM_getValue(`prov_${p}`, true);
    providerRows[p].style.display = enabled ? 'flex' : 'none';
});

const closeAllModals = () => { logModal.style.display = 'none'; providerModal.style.display = 'none'; };
logModal.addEventListener('click', e => { if (!document.getElementById('mb-log-modal-card').contains(e.target)) closeAllModals(); });
providerModal.addEventListener('click', e => { if (!document.getElementById('mb-provider-modal-card').contains(e.target)) closeAllModals(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

document.getElementById('mb-log-open-btn').addEventListener('click', () => { logModal.style.display = 'block'; });

// Provider-filter chips: exclusive selection. Click a chip → only that
// source's entries remain visible (every other chip dims to .off). Click
// the same chip again → back to "all sources visible". CSS-driven via the
// `pc-hide-<source>` classes on the log panel; no per-entry DOM walk.
let activeFilter = null;     // null = show everything
for (const chip of logModal.querySelectorAll('.pc-log-chip')) {
    chip.addEventListener('click', () => {
        const src = chip.dataset.source;
        activeFilter = (activeFilter === src) ? null : src;   // click again = clear
        // Refresh chip dimming.
        for (const c of logModal.querySelectorAll('.pc-log-chip')) {
            const isActive = activeFilter === null || c.dataset.source === activeFilter;
            c.classList.toggle('off', !isActive);
        }
        // Refresh panel hide-classes: hide every source except the active one.
        for (const s of LOG_SOURCES) {
            const sLower = s.toLowerCase();
            logPanel.classList.toggle(`pc-hide-${sLower}`, activeFilter !== null && sLower !== activeFilter);
        }
    });
}
document.getElementById('mb-token-setup-btn').addEventListener('click', () => {
    ['spotify', 'discogs', 'bandcamp'].forEach(p => { document.getElementById(`mb-toggle-${p}`).checked = GM_getValue(`prov_${p}`, true); });
    providerModal.style.display = 'block';
});
document.getElementById('mb-provider-cancel-btn').addEventListener('click', closeAllModals);
document.getElementById('mb-provider-save-btn').addEventListener('click', () => {
    ['spotify', 'discogs', 'bandcamp'].forEach(p => {
        const checked = document.getElementById(`mb-toggle-${p}`).checked;
        GM_setValue(`prov_${p}`, checked);
        providerRows[p].style.display = checked ? 'flex' : 'none';
    });
    providerModal.style.display = 'none';
});
document.getElementById('mb-modal-copy-btn').addEventListener('click', function () {
    navigator.clipboard.writeText(logPanel.innerText || '').then(() => {
        this.textContent = 'Copied!'; setTimeout(() => { this.textContent = 'Copy'; }, 1500);
    });
});

function appendLog(platform, msg, kind = 'info') {
    const color = kind === 'error' ? '#FF6B6B' : kind === 'warn' ? '#EBCB8B' : kind === 'ok' ? '#A3BE8C' : '#88C0D0';
    const ts = new Date().toLocaleTimeString();
    // data-platform lets the modal's per-provider filter chips toggle entries
    // via CSS (`#mb-finder-log-panel.pc-hide-<platform> [data-platform=…]`).
    logPanel.insertAdjacentHTML('beforeend', `<div data-platform="${platform.toLowerCase()}" style="margin-bottom: 3px; border-left: 3px solid ${color}; padding-left: 6px;"><span style="color: #666;">[${ts}]</span> <span style="color: ${color}; font-weight: bold;">[${platform}]</span> <span style="color: #DDD;">${msg}</span></div>`);
    logPanel.scrollTop = logPanel.scrollHeight;
}
appendLog('System', `Platform Check v${(typeof GM_info !== 'undefined' && GM_info.script?.version) || '?'} — startup`);

// ─── GM_xmlhttpRequest wrapper that returns a Promise ──────────────────────
function gmGet(url, { responseType, headers, timeout = 15000 } = {}) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const opts = {
            method: 'GET',
            url,
            headers: {
                // MB's API rejects bare "Mozilla/5.0" with 403; it expects an app
                // string. DDG's anti-bot meanwhile rejects detailed Chrome UAs —
                // searchWeb() overrides to "Mozilla/5.0" for its calls only.
                'User-Agent': 'PlatformCheck/12 (https://github.com/majkinetor/mb-userscripts)',
                'Accept-Language': 'en-US,en;q=0.9',
                ...headers,
            },
            timeout,
            onload(res) {
                const ms = Date.now() - t0;
                resolve({ ok: res.status >= 200 && res.status < 400, status: res.status, finalUrl: res.finalUrl || url, responseText: res.responseText || '', ms });
            },
            onerror(err)  { resolve({ ok: false, status: 0, finalUrl: url, responseText: '', error: String(err?.error || err?.statusText || err), ms: Date.now() - t0 }); },
            ontimeout()   { resolve({ ok: false, status: 0, finalUrl: url, responseText: '', error: 'timeout', ms: Date.now() - t0 }); },
        };
        if (responseType) opts.responseType = responseType;
        GM_xmlhttpRequest(opts);
    });
}

// ─── UI updater ────────────────────────────────────────────────────────────
function updateRow(p, { url, mbTracks, remoteTracks, year, label, source }) {
    const a   = document.getElementById(`mb-online-${p}`);
    const ico = document.getElementById(`ico-${p}`);
    const val = document.getElementById(`val-${p}`);
    const meta = document.getElementById(`meta-${p}`);
    if (url) a.href = url;

    if (remoteTracks != null) {
        val.textContent = `(${remoteTracks}/${mbTracks} trks)`;
        if (parseInt(remoteTracks, 10) === parseInt(mbTracks, 10)) {
            // Same ✓ glyph for fresh + cache hits, distinguished by color:
            // bright green (#008000) = freshly verified this session;
            // muted steel-blue (#5B82B0) = remembered from a previous run.
            // The ↻ button re-fetches if a cached entry might be stale.
            const cacheTone = source === 'cache' ? '#5B82B0' : '#008000';
            ico.textContent = '✓';
            ico.style.color = cacheTone;
            val.style.color = cacheTone;
        } else {
            ico.textContent = '~'; ico.style.color = '#FF8C00';
            val.style.color = '#FF8C00';
        }
    } else if (url) {
        ico.textContent = '?'; ico.style.color = '#999';
        val.textContent = `(?/${mbTracks} trks)`;
    } else {
        ico.textContent = '×'; ico.style.color = '#BF616A';
        val.textContent = `(no match)`;
    }

    const bits = [];
    if (year)   bits.push(year);
    if (label)  bits.push(label);
    // Don't repeat "via cache" — the ☑ icon already conveys that.
    if (source && source !== 'cache') bits.push(`<span style="color:#BBB;">via ${source}</span>`);
    meta.innerHTML = bits.join(' · ');
}

// ─── Helpers ───────────────────────────────────────────────────────────────
// DDG redirects search hits through /l/?uddg=<encoded-url>. Decode it.
function decodeDdgRedirect(href) {
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch { return null; }
}

// Search Brave first (handles concurrent calls cleanly, returns the canonical
// open.spotify.com / *.bandcamp.com URLs verbatim); fall back to DDG HTML if
// Brave is blocked. Returns up to `maxN` unique URLs that pass `urlFilter` —
// callers verify each candidate by fetching its server-side metadata, since
// the first search hit is often a different album by the same artist (e.g.
// MMW returns "20" for the Stone-series query).
//
// Engines are sometimes rate-limited per IP. We try them in order and stop
// at the first one that yields any usable result.
async function searchWeb(query, urlFilter, label, maxN = 5) {
    const engines = [
        {
            name: 'Brave',
            url: `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
            // Brave's anti-bot keys on a detailed Chrome UA being PRESENT, not absent.
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
            extract(html) {
                // Brave embeds raw result URLs directly inside <a href="…"> — easy to
                // pluck. We collect every external link and let `urlFilter` triage.
                return [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
            },
        },
        {
            name: 'DDG',
            url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            // Counter-intuitive: DDG's anti-bot blocks specific Chrome UAs but lets
            // through a bare "Mozilla/5.0". Verified 2026-05-28.
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://duckduckgo.com/' },
            extract(html) {
                const out = [];
                for (const m of html.matchAll(/href="(\/\/duckduckgo\.com\/l\/\?uddg=[^"]+)"/g)) {
                    const decoded = decodeDdgRedirect(m[1]);
                    if (decoded) out.push(decoded);
                }
                // Also fall through to direct URL matches (some result layouts).
                for (const m of html.matchAll(/https?:\/\/[^\s"<>]+/g)) out.push(m[0]);
                return out;
            },
        },
    ];

    for (const eng of engines) {
        appendLog(label, `${eng.name}: ${eng.url}`);
        const res = await queueSearch(() => gmGet(eng.url, { headers: eng.headers }));
        const sizeHint = res.responseText.length;
        appendLog(label, `${eng.name}: status=${res.status} ${sizeHint}b in ${res.ms}ms`);
        // Engines distinguish rate-limit from real success differently:
        //   Brave -> HTTP 429 ("Too Many Requests")
        //   DDG   -> HTTP 202 with a tiny <14 KB anti-bot page
        // Surface both clearly in the log so the user knows when to wait.
        if (res.status === 429 || res.status === 503) {
            appendLog(label, `${eng.name}: rate-limited (HTTP ${res.status}) — try again later`, 'warn');
            continue;
        }
        if (!res.ok || !res.responseText) { appendLog(label, `${eng.name}: HTTP failure (status=${res.status})`, 'warn'); continue; }
        if (sizeHint < 5000 || res.status === 202) {
            appendLog(label, `${eng.name}: response too small (${sizeHint}b) — likely anti-bot block`, 'warn');
            continue;
        }
        const all = eng.extract(res.responseText);
        const matches = [];
        const seen = new Set();
        for (const u of all) {
            if (!urlFilter(u)) continue;
            // Strip query strings and "/intl-xx/" locale segments before dedup —
            // the same album often surfaces 5+ times with different locale prefixes.
            const norm = u.replace(/\/intl-[a-z-]+\//, '/').replace(/\?.*$/, '').replace(/#.*$/, '');
            if (seen.has(norm)) continue;
            seen.add(norm);
            matches.push(norm);
            if (matches.length >= maxN) break;
        }
        appendLog(label, `${eng.name}: ${all.length} total hrefs, ${matches.length} unique candidates after filter`);
        if (matches.length) return matches;
        appendLog(label, `${eng.name}: no candidate matched filter`, 'warn');
    }
    appendLog(label, `All search engines failed to match`, 'error');
    return [];
}

// ─── Candidate scoring ──────────────────────────────────────────────────────
// When the first search hit is wrong (e.g. MMW "20" instead of MMW
// "The Stone: Issue Four"), we need a way to pick the right one from a few
// candidates. Strategy: fetch each candidate's server-side metadata and score
// against the MB release's track count + title.
function normName(s) {
    return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Punctuation-stripped form for use in search-engine queries. Quoting exact
// phrases is too rigid: MB might have "Space Echo: The Mystery…!" while the
// Bandcamp page renders it "Space Echo - The Mystery…" (no colon, no bang).
// Stripping punctuation to spaces lets the engine token-match either form;
// the verifier later picks the right candidate by track count + normName.
function searchTerms(s) {
    return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function titleSimilar(a, b) {
    const na = normName(a), nb = normName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return na.includes(nb) || nb.includes(na);
}
// Score: tracks match strongest (100), close-but-not-exact 50; title bonus 20.
// Threshold of ≥100 means we trust the candidate; <100 means show with a "~"
// icon so the user knows track counts didn't line up.
function scoreCandidate(meta, mbTracks, mbAlbum) {
    if (!meta) return -1;
    let s = 0;
    if (meta.tracks != null) {
        if (meta.tracks === mbTracks)               s += 100;
        else if (Math.abs(meta.tracks - mbTracks) <= 2) s += 50;
    }
    if (meta.title && titleSimilar(meta.title, mbAlbum)) s += 20;
    return s;
}

// Drive a per-candidate verifier loop. Returns the best { url, meta, score }
// across the candidate list, plus a per-candidate log table for diagnostics.
// `fetchMeta(url)` returns `{ tracks, title, year, label }` (any field may be null).
async function pickBestCandidate(candidates, fetchMeta, mbTracks, mbAlbum, label) {
    const scored = [];
    for (const url of candidates) {
        const meta = await fetchMeta(url);
        const score = scoreCandidate(meta, mbTracks, mbAlbum);
        scored.push({ url, meta, score });
        appendLog(label, `  cand score=${score}  tracks=${meta?.tracks ?? '?'}  title="${meta?.title || '?'}"  url=${url}`);
        // Short-circuit on a confident match — saves N-1 fetches on the common case
        // where the first search hit is correct (the Menahan release).
        if (score >= 100) break;
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
}

// Per-platform-per-MBID cache. Stores the full resolved row so a return visit
// to a release page does ZERO network calls: no MB-rels-driven detail fetch,
// no Wikidata SPARQL, no search, no embed/album-page parse. The ↻ button
// clears entries when the user wants to force a re-scan.
//
// Schema (JSON-encoded value): { url, tracks, year, label, source } where
// `url` may be null when we've definitively concluded "no match exists on
// this platform" (so we don't keep re-searching for niche releases that
// genuinely aren't on Spotify/Bandcamp).
function cacheKey(mbid, platform) { return `pc:cache:${platform}:${mbid}`; }
function cacheGet(mbid, platform) {
    const raw = GM_getValue(cacheKey(mbid, platform), null);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}
function cacheSet(mbid, platform, entry) {
    if (!entry) return;
    GM_setValue(cacheKey(mbid, platform), JSON.stringify(entry));
}
function cacheClear(mbid) {
    for (const p of ['spotify', 'discogs', 'bandcamp']) GM_setValue(cacheKey(mbid, p), null);
    GM_setValue(mbDataKey(mbid), null);
}

// MB-level metadata cache (artist, album, mbTracks, etc.) — written once per
// MBID after a successful release fetch. When MB returns 503 (rate-limited)
// or otherwise fails, we fall back to this cache so a tab switch to a
// previously-scanned release still renders its cached rows instead of
// halting on "Halted: API status 503".
function mbDataKey(mbid) { return `pc:mbdata:${mbid}`; }
function mbDataGet(mbid) {
    const raw = GM_getValue(mbDataKey(mbid), null);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}
function mbDataSet(mbid, entry) {
    if (!entry) return;
    GM_setValue(mbDataKey(mbid), JSON.stringify(entry));
}

// Apply a cached row to the UI and log the hit. Centralised so every scanner
// uses the same path on cache-hit (and the ☑ icon convention stays consistent).
function applyCachedRow(platform, label, cached, mbTracks) {
    appendLog(label, `Cache hit: url=${cached.url || '(no match)'}  tracks=${cached.tracks ?? '?'}  year=${cached.year || '?'}  label=${cached.label || '?'}`, 'ok');
    updateRow(platform, {
        url:          cached.url,
        mbTracks,
        remoteTracks: cached.tracks ?? null,
        year:         cached.year   ?? null,
        label:        cached.label  ?? null,
        source:       'cache',
    });
}

// ─── Wikidata fast path ─────────────────────────────────────────────────────
// Wikidata curates external IDs (Spotify P2205, Apple Music P5121, AllMusic
// P1729) against MB release-group IDs (P436) and release IDs (P5813). When a
// release has a Wikidata entity, the data is human-edited and effectively
// 100% precise — much better than ranking 5 search-engine candidates by
// track count. Recall is the trade-off: niche / very-recent releases usually
// have no Wikidata entry, in which case we fall back to web search.
async function lookupWikidata(releaseGroupMbid, releaseMbid) {
    if (!releaseGroupMbid && !releaseMbid) return null;
    // Union of release-group and release lookups in one query — avoids two
    // round-trips when one or the other might be the indexed entity.
    const sparql = `SELECT ?spotify ?apple ?allmusic WHERE {
${releaseGroupMbid ? `  { ?item wdt:P436 "${releaseGroupMbid}" }`           : ''}
${releaseGroupMbid && releaseMbid ? '  UNION' : ''}
${releaseMbid      ? `  { ?item wdt:P5813 "${releaseMbid}" }`               : ''}
  OPTIONAL { ?item wdt:P2205 ?spotify }
  OPTIONAL { ?item wdt:P5121 ?apple }
  OPTIONAL { ?item wdt:P1729 ?allmusic }
} LIMIT 5`;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    appendLog('Wikidata', `SPARQL lookup rg=${releaseGroupMbid || '-'} rel=${releaseMbid || '-'}`);
    const res = await gmGet(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    appendLog('Wikidata', `status=${res.status} ${res.responseText.length}b in ${res.ms}ms`);
    if (!res.ok) { appendLog('Wikidata', `lookup failed`, 'warn'); return null; }
    let data;
    try { data = JSON.parse(res.responseText); } catch (e) { appendLog('Wikidata', `JSON parse: ${e.message}`, 'error'); return null; }
    const bindings = data.results?.bindings || [];
    if (!bindings.length) {
        appendLog('Wikidata', `no entity matches release-group/release MBID — falling back to search`, 'warn');
        return null;
    }
    // Pick first binding that has any populated field; if multiple bindings
    // disagree (rare), trust the first row.
    const b = bindings.find(r => r.spotify || r.apple || r.allmusic) || bindings[0];
    const out = {
        spotifyId:  b.spotify?.value  || null,
        appleId:    b.apple?.value    || null,
        allmusicId: b.allmusic?.value || null,
    };
    appendLog('Wikidata', `match: spotify=${out.spotifyId || '-'} apple=${out.appleId || '-'} allmusic=${out.allmusicId || '-'}`, 'ok');
    return out;
}

// Concurrent search-engine queries from the same IP can trip anti-bot pages.
// Serialize them on one chain so two scanners never hit the same engine at once.
let searchChain = Promise.resolve();
function queueSearch(fn) { const p = searchChain.then(fn, fn); searchChain = p.catch(() => {}); return p; }

// ─── Per-platform scanners ─────────────────────────────────────────────────
// Fetch Spotify album metadata via the server-rendered /embed/album/<id> page.
// The embed ships an inline JSON blob; we extract title + track count + year +
// label by regex (lighter and more tolerant than full-tree parsing).
async function fetchSpotifyMeta(albumUrl) {
    const idMatch = albumUrl.match(/album\/([a-zA-Z0-9]{22})/);
    if (!idMatch) return null;
    const embedUrl = `https://open.spotify.com/embed/album/${idMatch[1]}`;
    const er = await gmGet(embedUrl);
    if (!er.ok) return null;
    const html = er.responseText;
    const trackUris = [...html.matchAll(/"uri":"spotify:track:[a-zA-Z0-9]+"/g)];
    // The album title is the first `"name":"…"` outside of any nested "subtitle"
    // — empirically reliable on the embed JSON. Track titles come after, so
    // "name" wins.
    const titleMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
    const yearMatch  = html.match(/"releaseDate":"(\d{4})-/) || html.match(/"year"\s*:\s*(\d{4})/);
    const labelMatch = html.match(/"label":"([^"]+)"/) || html.match(/"copyrights":\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/);
    return {
        tracks: trackUris.length || null,
        title:  titleMatch?.[1] || null,
        year:   yearMatch?.[1]  || null,
        label:  labelMatch?.[1] || null,
    };
}

async function scanSpotify({ artist, album, mbTracks, existingUrl, mbid, wikidataSpotifyId, isVariousArtists }) {
    const label = 'Spotify';

    // Cache hit WITH URL → use it and skip everything else. A cached "no
    // match" (url:null) is NOT a short-circuit — a fresh Wikidata answer
    // can still override it. Only if Wikidata also has nothing AND no
    // existing rel do we fall back to rendering the cached no-match
    // (without rerunning search engines; ↻ forces full retry).
    const cached = cacheGet(mbid, 'spotify');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('spotify', label, cached, mbTracks);
        return;
    }

    let albumUrl = existingUrl;
    let source   = null;
    let bestMeta = null;

    if (albumUrl) {
        appendLog(label, `Using existing MB URL: ${albumUrl}`, 'ok');
        source = 'MB rels';
    } else if (wikidataSpotifyId) {
        albumUrl = `https://open.spotify.com/album/${wikidataSpotifyId}`;
        appendLog(label, `Wikidata answer: ${albumUrl}`, 'ok');
        source = 'Wikidata';
    } else if (cached) {
        // Cache says "no match", no MB rel, Wikidata had no answer — surface
        // the cached state without re-running web search (the user already
        // saw this; they have ↻ to force a fresh search).
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('spotify', label, cached, mbTracks);
        return;
    } else {
        // Restrict the `site:` filter to the /album/ path so artist pages,
        // playlists, tracks, and shows never enter the candidate list. Use
        // punctuation-stripped tokens (not a quoted exact phrase) so the
        // engine matches "Space Echo - The Mystery..." against MB's
        // "Space Echo: The Mystery...!". For VA compilations drop the artist
        // term because the literal phrase "Various Artists" doesn't appear
        // on streaming pages — labels host compilations under their own name.
        const albumT  = searchTerms(album);
        const artistT = searchTerms(artist);
        const q = isVariousArtists
            ? `site:open.spotify.com/album/ ${albumT}`
            : `site:open.spotify.com/album/ ${artistT} ${albumT}`;
        const candidates = await searchWeb(q, u => /open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/[a-zA-Z0-9]{22}/.test(u), label);
        if (!candidates.length) {
            // Cache "no match" so a refresh-less page re-visit doesn't re-search.
            cacheSet(mbid, 'spotify', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('spotify', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        appendLog(label, `Verifying ${candidates.length} candidate(s) by track count + title…`);
        const best = await pickBestCandidate(candidates, fetchSpotifyMeta, mbTracks, album, label);
        if (!best || best.score === 0) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'spotify', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('spotify', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.url;
        bestMeta = best.meta;
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 100 ? 'ok' : 'warn');
        source = 'search';
    }

    const meta = bestMeta || await fetchSpotifyMeta(albumUrl);
    if (meta) {
        appendLog(label, `Embed parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Embed fetch failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    cacheSet(mbid, 'spotify', { url: albumUrl, tracks, year, label: lbl, source });
    updateRow('spotify', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source });
}

async function scanDiscogs({ artist, album, mbTracks, existingUrl, mbid }) {
    const label = 'Discogs';

    // Positive cache hit short-circuits before any API call. Cached "no
    // match" only short-circuits when there's no MB rel either — we still
    // want a freshly-added MB rel to replace a stale no-match.
    const cached = cacheGet(mbid, 'discogs');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('discogs', label, cached, mbTracks);
        return;
    }
    if (cached && !cached.url && !existingUrl) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('discogs', label, cached, mbTracks);
        return;
    }

    let releaseUrl = existingUrl;
    let releaseId  = null;
    let source     = null;

    if (releaseUrl) {
        appendLog(label, `Using existing MB URL: ${releaseUrl}`, 'ok');
        source = 'MB rels';
        const m = releaseUrl.match(/\/release\/(\d+)/);
        if (m) releaseId = m[1];
    } else {
        // Discogs HTTP UI is Cloudflare-protected (403); the public API works
        // without an auth token for search + detail (~25 req/min unauth'd).
        const apiUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(`${artist} ${album}`)}&type=release&per_page=5`;
        appendLog(label, `API search: ${apiUrl}`);
        const sr = await gmGet(apiUrl);
        appendLog(label, `API search: status=${sr.status} ${sr.responseText.length}b in ${sr.ms}ms`);
        if (sr.ok) {
            try {
                const data = JSON.parse(sr.responseText);
                const first = data.results?.[0];
                if (first) {
                    releaseId  = String(first.id);
                    releaseUrl = `https://www.discogs.com/release/${releaseId}`;
                    source     = 'API search';
                    appendLog(label, `Found via API: ${releaseUrl}`, 'ok');
                } else {
                    appendLog(label, `API search returned 0 results`, 'warn');
                }
            } catch (e) { appendLog(label, `API JSON parse error: ${e.message}`, 'error'); }
        } else {
            appendLog(label, `API search failed`, 'error');
        }
        if (!releaseUrl) {
            const fallback = await searchWeb(`site:discogs.com release ${artist} ${album}`, u => /www\.discogs\.com\/release\/\d+/.test(u) || /www\.discogs\.com\/.*\/release\/\d+/.test(u), label);
            if (fallback) {
                releaseUrl = fallback;
                const m = fallback.match(/\/release\/(\d+)/);
                if (m) releaseId = m[1];
                source = 'web search';
            }
        }
    }

    if (!releaseUrl) {
        cacheSet(mbid, 'discogs', { url: null, tracks: null, year: null, label: null, source: 'search' });
        updateRow('discogs', { url: null, mbTracks, remoteTracks: null });
        return;
    }

    let tracks = null, year = null, lbl = null;
    if (releaseId) {
        const detailUrl = `https://api.discogs.com/releases/${releaseId}`;
        appendLog(label, `API detail: ${detailUrl}`);
        const dr = await gmGet(detailUrl);
        appendLog(label, `API detail: status=${dr.status} ${dr.responseText.length}b in ${dr.ms}ms`);
        if (dr.ok) {
            try {
                const data = JSON.parse(dr.responseText);
                const trk = (data.tracklist || []).filter(t => t.type_ === 'track' || !t.type_);
                tracks = trk.length || null;
                year   = data.year || null;
                lbl    = (data.labels || []).map(l => l.name).join(', ') || null;
                appendLog(label, `API detail parsed: tracks=${tracks} year=${year || '?'} label=${lbl || '?'}`, 'ok');
            } catch (e) { appendLog(label, `API detail parse error: ${e.message}`, 'error'); }
        } else { appendLog(label, `API detail failed`, 'error'); }
    }

    cacheSet(mbid, 'discogs', { url: releaseUrl, tracks, year, label: lbl, source });
    updateRow('discogs', { url: releaseUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source });
}

// Fetch Bandcamp album metadata via the standard album page. Bandcamp ships
// a Schema.org JSON-LD block with numTracks/name/datePublished/recordLabel as
// native JSON (not HTML-escaped) — the cleanest source. The legacy `data-tralbum`
// attribute has the same data but with &quot; entities and requires decoding.
async function fetchBandcampMeta(albumUrl) {
    const ar = await gmGet(albumUrl);
    if (!ar.ok || !ar.responseText) return null;
    const html = ar.responseText;
    const numTracksMatch = html.match(/"numTracks"\s*:\s*(\d+)/);
    // "@type":"MusicAlbum" is followed by the album name in JSON-LD; pick that
    // specifically so we don't capture a track or band name.
    const titleMatch = html.match(/"@type"\s*:\s*"MusicAlbum"[\s\S]{0,200}?"name"\s*:\s*"([^"]+)"/)
                    || html.match(/<meta\s+name="title"\s+content="([^"|]+)/);
    const yMatch = html.match(/"datePublished"\s*:\s*"[^"]*?(\d{4})\b/);
    const lMatch = html.match(/"recordLabel"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/);
    return {
        tracks: numTracksMatch ? parseInt(numTracksMatch[1], 10) : null,
        title:  titleMatch?.[1] || null,
        year:   yMatch?.[1]     || null,
        label:  lMatch?.[1]     || null,
    };
}

// Bandcamp's own search at /search?item_type=a returns a server-rendered HTML
// list of album results — works without any token in a real browser (the
// browser carries Bandcamp's CF clearance cookie). Try this BEFORE the generic
// web-search engines: when both are available it's faster, lower-noise (only
// album results), and not subject to Brave/DDG rate-limits. Falls through to
// `searchWeb` if Cloudflare's bot challenge fires from a cookie-less context.
async function searchBandcampNative(query, label) {
    const url = `https://bandcamp.com/search?q=${encodeURIComponent(query)}&item_type=a`;
    appendLog(label, `Native: ${url}`);
    const res = await gmGet(url, { headers: { 'Accept': 'text/html,application/xhtml+xml' } });
    appendLog(label, `Native: status=${res.status} ${res.responseText.length}b in ${res.ms}ms`);
    if (!res.ok) return [];
    // Cloudflare's interstitial is ~3 KB and titled "Client Challenge". When we
    // see it, log it and let the caller fall through to web search — in a real
    // browser with prior Bandcamp cookies this branch is skipped.
    if (/<title>\s*Just a moment/i.test(res.responseText) || /<title>\s*Client Challenge/i.test(res.responseText) || res.responseText.length < 5000) {
        appendLog(label, `Native: blocked by Cloudflare challenge (cookie-less request) — falling through`, 'warn');
        return [];
    }
    // Bandcamp's search-result anchors point at full *.bandcamp.com/album/<slug>
    // URLs. Strip query strings and dedupe.
    const urls = [...res.responseText.matchAll(/href="(https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[^"?#]+)/gi)].map(m => m[1]);
    const unique = [...new Set(urls)];
    appendLog(label, `Native: ${unique.length} unique album link(s)`, unique.length ? 'ok' : 'warn');
    return unique.slice(0, 5);
}

async function scanBandcamp({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists }) {
    const label = 'Bandcamp';

    const cached = cacheGet(mbid, 'bandcamp');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('bandcamp', label, cached, mbTracks);
        return;
    }
    if (cached && !cached.url && !existingUrl) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('bandcamp', label, cached, mbTracks);
        return;
    }

    let albumUrl = existingUrl;
    let source   = null;
    let bestMeta = null;

    if (albumUrl) {
        appendLog(label, `Using existing MB URL: ${albumUrl}`, 'ok');
        source = 'MB rels';
    } else {
        // Priority 1: Bandcamp's own search (works when the browser has CF
        // clearance — common after any prior Bandcamp visit). Skip when
        // blocked. VA compilations: search by album only — Bandcamp credits
        // them to the label, not "Various Artists".
        const albumT  = searchTerms(album);
        const artistT = searchTerms(artist);
        const nativeQ = isVariousArtists ? albumT : `${artistT} ${albumT}`;
        let candidates = await searchBandcampNative(nativeQ, label);
        let candidateSource = 'native';
        if (!candidates.length) {
            // Priority 2: generic web search. Punctuation-stripped tokens, no
            // exact-phrase quotes — MB's "Foo: Bar!" and Bandcamp's
            // "Foo - Bar" still hit each other this way; the verifier handles
            // the rest. Bandcamp candidate pages are ~300 KB so cap at 3.
            const q = isVariousArtists
                ? `site:bandcamp.com/album/ ${albumT}`
                : `site:bandcamp.com/album/ ${artistT} ${albumT}`;
            candidates = await searchWeb(q, u => /^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u), label, 3);
            candidateSource = 'search';
        }
        if (!candidates.length) {
            cacheSet(mbid, 'bandcamp', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('bandcamp', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        appendLog(label, `Verifying ${candidates.length} candidate(s) by track count + title…`);
        const best = await pickBestCandidate(candidates, fetchBandcampMeta, mbTracks, album, label);
        if (!best || best.score === 0) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'bandcamp', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('bandcamp', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.url;
        bestMeta = best.meta;
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 100 ? 'ok' : 'warn');
        source = candidateSource;
    }

    const meta = bestMeta || await fetchBandcampMeta(albumUrl);
    if (meta) {
        appendLog(label, `Album parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Album page failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    cacheSet(mbid, 'bandcamp', { url: albumUrl, tracks, year, label: lbl, source });
    updateRow('bandcamp', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source });
}

// ─── Main entry ────────────────────────────────────────────────────────────
const mbid = window.location.pathname.split('/')[2];
if (!mbid || mbid.length < 10) {
    appendLog('System', `No valid MBID parsed from URL`, 'error');
    return;
}

// Reset each platform row back to its initial ⚪ / -- state. Used by the
// refresh button before re-running the scans.
function resetRows() {
    for (const p of ['spotify', 'discogs', 'bandcamp']) {
        const ico = document.getElementById(`ico-${p}`);
        const val = document.getElementById(`val-${p}`);
        const meta = document.getElementById(`meta-${p}`);
        if (ico)  { ico.textContent = '⚪'; ico.style.color = '#888'; ico.style.fontWeight = 'normal'; }
        if (val)  { val.textContent = '(-- tracks)'; val.style.color = '#777'; }
        if (meta) { meta.innerHTML = ''; }
    }
}

// VA detection used by both the DOM and API parse paths. Hoisted so both
// can share the regex without duplication.
const VA_MBID = '89ad4ac3-39f7-470e-963a-56509c546377';
const VA_NAME_RE = /^various(\s+artists?)?$/i;

// Scrape the MB release record from the *currently-rendered page DOM* — we're
// already running on /release/<mbid>, so the data is in front of us. This
// avoids the typical 10s /ws/2 round-trip when MB is under load. Returns the
// same shape as parseMbData() or null when the DOM doesn't have what we need
// (in which case the caller falls back to the API). Selectors are defensive:
// MB occasionally shuffles its markup; the API fallback covers regressions.
function parseMbFromDom() {
    try {
        // Album title. MB wraps the title in <bdi> inside the release header's
        // h1. Several layouts exist — use a chain of fallbacks.
        const titleNode = document.querySelector(
            '.releaseheader h1 bdi, .release-information h1 bdi, h1 bdi'
        );
        const album = titleNode?.textContent?.trim()
                   || (document.title.match(/^Release\s+["“]([^"”]+)["”]/) || [])[1]
                   || '';

        // Artist credit. Anchors to /artist/<mbid> appearing in the release
        // header (or its `.subheader` / `.artist-credit` span). VA detection
        // by MBID or by literal name.
        const headerScope = document.querySelector('.releaseheader, .release-information, #content') || document;
        const artistAnchors = headerScope.querySelectorAll(
            '.artist-credit a[href^="/artist/"], .subheader a[href^="/artist/"], h1 ~ p a[href^="/artist/"]'
        );
        const artistNames = [...artistAnchors].map(a => a.textContent.trim()).filter(Boolean);
        const artistIds   = [...artistAnchors].map(a => (a.getAttribute('href') || '').match(/\/artist\/([0-9a-f-]{36})/)?.[1]).filter(Boolean);
        const artist = artistNames[0] || '';

        // Track count. MB tracklist tables use <tr class="track"> or rows
        // whose td.pos count tracks. Cross-table dedup is unnecessary because
        // the release page only shows this release's tracks.
        const mbTracks = document.querySelectorAll('table.tbl tr.track, table.medium-table tr.track, tr.track[id^="t-"]').length;

        // Release-group MBID — present as a /release-group/<mbid> link in the
        // sidebar's release-information block.
        const rgLink = document.querySelector('a[href*="/release-group/"]');
        const releaseGroupMbid = rgLink?.getAttribute('href').match(/release-group\/([0-9a-f-]{36})/)?.[1] || null;

        // Existing URL rels. MB's sidebar has an "External links" section
        // listing platform-specific URLs. Grab every outbound link in the
        // sidebar (or whole doc as fallback) and filter to known platforms.
        const sidebar = document.querySelector('#sidebar') || document;
        const externalHrefs = [...sidebar.querySelectorAll('a[href^="http"]')]
            .map(a => a.href);
        const existing = {
            spotify:  externalHrefs.find(u => /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\//i.test(u)) || null,
            discogs:  externalHrefs.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i.test(u)) || null,
            bandcamp: externalHrefs.find(u => /^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u)) || null,
        };

        const isVariousArtists = artistIds.includes(VA_MBID) || artistNames.some(n => VA_NAME_RE.test(n));

        // Sanity gate: we need artist + album + at least one track row. Anything
        // less is an unrendered or unfamiliar layout — bail to API.
        if (!artist || !album || mbTracks < 1) return null;
        return { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing };
    } catch (e) {
        // Any selector mishap → API fallback.
        return null;
    }
}

// Parse a successful MB release-API payload into the lean record we cache and
// pass to the scanners. Returns null when the payload is missing the artist
// or album (treated as a fatal-for-this-MBID parse error upstream).
function parseMbData(data) {
    const artist = data['artist-credit']?.[0]?.name || data['artist-credit']?.[0]?.artist?.name || '';
    const album  = data.title || '';
    if (!artist || !album) return null;
    const mbTracks = data.media?.reduce((s, m) => s + (m['track-count'] || 0), 0) || 0;
    const releaseGroupMbid = data['release-group']?.id || null;
    // MB's "Various Artists" entity. Compilations on Bandcamp / Spotify
    // typically aren't credited to literally "Various Artists" — they go under
    // the label (e.g. "Analog Africa", "Soul Jazz Records"). Detect via the
    // special MBID OR a literal "Various"/"Various Artists" string match so
    // we can drop the artist term from the search query; the verifier picks
    // the right candidate from the wider net.
    const isVA = c => c.artist?.id === VA_MBID
                   || VA_NAME_RE.test(c.artist?.name || '')
                   || VA_NAME_RE.test(c.name || '');
    const isVariousArtists = !!data['artist-credit']?.some(isVA);
    const relUrls = (data.relations || [])
        .filter(r => r['target-type'] === 'url' && r.url?.resource)
        .map(r => r.url.resource);
    const existing = {
        spotify:  relUrls.find(u => /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\//i.test(u)) || null,
        discogs:  relUrls.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i.test(u)) || null,
        bandcamp: relUrls.find(u => /^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u)) || null,
    };
    return { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing };
}

async function runScans() {
    // Source precedence: DOM (instant, no network) > /ws/2 API (~10s when MB is
    // hot) > mbDataCache (transient MB outage). DOM is identical data to API
    // for our purposes — both give artist/album/tracks/rg/url-rels — and we're
    // already running on the page so it's free.
    let mbData = parseMbFromDom();
    let dataSource = 'dom';

    if (mbData) {
        appendLog('MusicBrainz', `Parsed from page DOM — skipping API call`, 'ok');
    } else {
        appendLog('MusicBrainz', `DOM scrape incomplete — falling back to /ws/2 API`);
        const mb = await gmGet(`https://musicbrainz.org/ws/2/release/${mbid}?inc=artists+media+url-rels+release-groups&fmt=json`);
        appendLog('MusicBrainz', `status=${mb.status} ${mb.responseText.length}b in ${mb.ms}ms`);
        if (mb.ok) {
            try {
                const data = JSON.parse(mb.responseText);
                mbData = parseMbData(data);
                if (mbData) dataSource = 'api';
                else appendLog('MusicBrainz', `Missing artist/album in API payload`, 'error');
            } catch (e) { appendLog('MusicBrainz', `JSON parse failed: ${e.message}`, 'error'); }
        }
        if (!mbData) {
            const cached = mbDataGet(mbid);
            if (cached) {
                appendLog('MusicBrainz', `Falling back to cached release data (no fresh fetch this load)`, 'warn');
                mbData = cached;
                dataSource = 'cache';
            } else {
                appendLog('MusicBrainz', `Halted: no DOM, no API, no cache (status ${mb.status})`, 'error');
                return;
            }
        }
    }
    // Persist DOM- and API-sourced records to the long-term cache so a later
    // MB 503 can still render. Don't re-persist when we're already inside the
    // cache-fallback branch.
    if (dataSource !== 'cache') mbDataSet(mbid, mbData);

    const { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing } = mbData;
    appendLog('MusicBrainz', `Artist: "${artist}"${isVariousArtists ? ' (Various Artists — search by album only)' : ''}  Album: "${album}"  Tracks: ${mbTracks}  rg=${releaseGroupMbid || '(none)'}`);
    appendLog('MusicBrainz', `Existing rels — spotify=${existing.spotify ? 'YES' : 'no'}  discogs=${existing.discogs ? 'YES' : 'no'}  bandcamp=${existing.bandcamp ? 'YES' : 'no'}`);

    // Wikidata lookup — fires whenever we don't already have a positive Spotify
    // URL. A cached "no match" (url:null) doesn't block Wikidata: it's a cheap
    // independent data source curated by humans, and the cache may have been
    // written before Wikidata had this album indexed (or before the user
    // hit ↻ themselves).
    const spotifyCache = cacheGet(mbid, 'spotify');
    let wd = null;
    if (existing.spotify || spotifyCache?.url) {
        appendLog('Wikidata', `skipped — Spotify URL already in ${existing.spotify ? 'MB rels' : 'cache'}`);
    } else {
        wd = await lookupWikidata(releaseGroupMbid, mbid);
    }

    // Seed search fallback URLs.
    document.getElementById('mb-online-spotify') .href = `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${album}`)}`;
    document.getElementById('mb-online-discogs') .href = `https://www.discogs.com/search/?q=${encodeURIComponent(`${artist} ${album}`)}&type=release`;
    document.getElementById('mb-online-bandcamp').href = `https://bandcamp.com/search?q=${encodeURIComponent(`${artist} ${album}`)}&item_type=a`;

    const ctx = { artist, album, mbTracks, mbid, isVariousArtists };
    const tasks = [];
    if (GM_getValue('prov_spotify',  true)) tasks.push(scanSpotify ({ ...ctx, existingUrl: existing.spotify,  wikidataSpotifyId: wd?.spotifyId || null }));
    if (GM_getValue('prov_discogs',  true)) tasks.push(scanDiscogs ({ ...ctx, existingUrl: existing.discogs  }));
    if (GM_getValue('prov_bandcamp', true)) tasks.push(scanBandcamp({ ...ctx, existingUrl: existing.bandcamp }));
    await Promise.allSettled(tasks);
    appendLog('System', 'All scans completed', 'ok');
}

// ↻ REFRESH button: clear cached URLs for this MBID, blank the rows, re-run.
document.getElementById('mb-refresh-btn').addEventListener('click', () => {
    appendLog('System', `Refresh requested — clearing cache for ${mbid}`, 'warn');
    cacheClear(mbid);
    resetRows();
    runScans();
});

runScans();

})();
