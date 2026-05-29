// ==UserScript==
// @name         MB Platform Check
// @namespace    http://tampermonkey.net/
// @version      2026.5.29.131408
// @description  Find a MusicBrainz release on Spotify, Discogs and Bandcamp. Uses existing URL relationships when present, otherwise searches via DuckDuckGo's HTML interface and the Discogs public API. No tokens required.
// @match        https://musicbrainz.org/release/*
// @match        https://musicbrainz.org/release-group/*
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
// @connect      api.deezer.com
// @connect      itunes.apple.com
// @connect      *
// ==/UserScript==
(function () {
'use strict';

// ─── Release editor sub-pages (/edit and /edit-relationships) ──────────────
// When the user clicks + on the release page, we stash the OK URLs in
// `pc:pending:<mbid>` and open the release editor in a new tab. Detect both
// /edit and /edit-relationships (former is the multi-tab editor where URL
// relationships live under "External Links"; latter is the dedicated rel
// editor) and short-circuit to the inject helper — the sidebar UI / scans
// below only make sense on the canonical release page.
if (/\/release\/[0-9a-f-]{36}\/(edit|edit-relationships)(?:[?#]|$)/.test(window.location.pathname)) {
    runInjectHelper('release');
    return;
}
if (/\/release-group\/[0-9a-f-]{36}\/(edit|edit-relationships)(?:[?#]|$)/.test(window.location.pathname)) {
    runInjectHelper('release-group');
    return;
}

function runInjectHelper(entityType) {
    // entityType: 'release' or 'release-group'. Both pages use the same
    // External Links form, so the injection logic is identical — only the
    // pending-storage key differs.
    const re   = new RegExp(`/${entityType}/([0-9a-f-]{36})`);
    const mbid = (window.location.pathname.match(re) || [])[1];
    if (!mbid) return;
    const key  = entityType === 'release-group' ? `pc:pending:rg:${mbid}` : `pc:pending:${mbid}`;
    const raw  = GM_getValue(key, null);
    if (!raw) return;
    let pending;
    try { pending = JSON.parse(raw); } catch { return; }
    const urls = Object.values(pending || {}).filter(Boolean);
    if (urls.length === 0) return;

    // The External Links form may not be ready at document-end. Poll briefly.
    const start = Date.now();
    const tick = () => {
        const input = findAddLinkInput();
        if (input) { injectInto(urls, key); return; }
        if (Date.now() - start > 15000) {
            const inputs = [...document.querySelectorAll('input')];
            const placeholders = [...new Set(inputs.map(i => i.placeholder).filter(Boolean))];
            console.warn(`[platform_check] inject helper: never found "Add another link" input on ${window.location.pathname}. ${inputs.length} input(s) on page. Placeholders seen:`, placeholders);
            showInjectFailureBanner(urls, entityType, placeholders);
            return;
        }
        setTimeout(tick, 200);
    };
    tick();
}

// Visible fallback when the helper can't find the "Add another link" input —
// happens if MB's edit form structure differs from what we expect. Drop a
// banner at the top of #content listing the URLs we'd have injected, plus
// the placeholders we DID see so we can fix the selector.
function showInjectFailureBanner(urls, entityType, placeholdersSeen) {
    const target = document.querySelector('#content') || document.body;
    if (!target) return;
    const div = document.createElement('div');
    div.style.cssText = 'margin:12px 0;padding:10px 12px;background:#FFF3CD;border:1px solid #FFC107;border-radius:4px;font-family:sans-serif;font-size:12px;color:#7B5E00;';
    div.innerHTML = `
        <strong>Platform Check:</strong> couldn't auto-inject on this ${entityType} editor.
        <br>URLs to add manually:
        <ul style="margin:4px 0 0 18px;padding:0;">${urls.map(u => `<li><code style="background:#FFF;padding:1px 4px;border-radius:2px;">${u}</code></li>`).join('')}</ul>
        <br><small>Inputs seen with placeholders: ${placeholdersSeen.map(p => `<code>${p}</code>`).join(', ') || '(none)'}</small>
    `;
    target.insertBefore(div, target.firstChild);
}

// MB's /edit page renders one bottom-most "Add another link" text input under
// the External Links section. It re-renders (new node) after each filled URL.
// Find it by placeholder text so we don't depend on class names that MB churns.
function findAddLinkInput() {
    const all = [...document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
    return all.find(i => /add another (?:link|url)/i.test(i.placeholder || ''))
        || all.find(i => /add another (?:link|url)/i.test(i.getAttribute('aria-label') || ''))
        || null;
}

async function injectInto(urls, storageKey) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // React/Backbone-compatible native value setter so MB's framework sees
    // the change, not just the raw DOM property.
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    let injected = 0;
    for (const url of urls) {
        // Re-query each iteration — MB replaces the input after each fill.
        const input = findAddLinkInput();
        if (!input) break;
        input.focus();
        nativeSetter.call(input, url);
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', bubbles: true }));
        input.blur();
        injected++;
        // MB does URL-pattern auto-detection (Discogs / free streaming / etc.)
        // and renders a fresh row + a fresh "Add another link" input. Give it
        // room to land before the next fill.
        await wait(700);
    }
    if (injected > 0) GM_setValue(storageKey, null);
    flashStatusOnExternalLinks(`Platform Check: injected ${injected}/${urls.length} URL${urls.length === 1 ? '' : 's'}`);
}

// Small discreet inline status next to the External Links heading — no
// top-of-page banner.
function flashStatusOnExternalLinks(text) {
    const heading = [...document.querySelectorAll('h2, h3, legend, fieldset > legend')]
        .find(h => /external\s+links/i.test(h.textContent));
    if (!heading) return;
    document.getElementById('pc-inject-status')?.remove();
    const status = document.createElement('span');
    status.id = 'pc-inject-status';
    status.style.cssText = 'margin-left:12px;font-size:11px;padding:2px 8px;background:#E8F5E9;border:1px solid #81C784;border-radius:3px;color:#1B5E20;font-family:sans-serif;font-weight:normal;';
    status.textContent = text;
    heading.appendChild(status);
}

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

// Provider order is user-configurable from the providers modal. Stored as a
// JSON array under `pc:provider-order`. getProviderOrder() always returns
// every known platform — unknown stored values are dropped, missing ones
// are appended — so adding a new platform (like Apple Music) doesn't break
// stored preferences.
// Default visual order — Discogs first since it's the most reliable rich
// metadata source, then the streaming services, with Deezer last because it
// has the worst catalogue coverage of the four. Users can override via the
// providers panel (drag-and-drop) and the choice persists in pc:provider-order.
const ALL_PROVIDERS = ['discogs', 'bandcamp', 'spotify', 'apple', 'deezer'];
function getProviderOrder() {
    const raw = GM_getValue('pc:provider-order', null);
    if (!raw) return ALL_PROVIDERS.slice();
    try {
        const arr = JSON.parse(raw);
        const out = [];
        for (const p of arr) if (ALL_PROVIDERS.includes(p) && !out.includes(p)) out.push(p);
        for (const p of ALL_PROVIDERS) if (!out.includes(p)) out.push(p);
        return out;
    } catch { return ALL_PROVIDERS.slice(); }
}
const PROVIDER_ORDER = getProviderOrder();
const PROVIDER_NAME  = { spotify:'Spotify', discogs:'Discogs', bandcamp:'Bandcamp', deezer:'Deezer', apple:'Apple Music' };
const PROVIDER_COLOR = { spotify:'#1DB954', discogs:'#222',    bandcamp:'#629AA9', deezer:'#A238FF', apple:'#FA243C' };
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
  /* Circled ✓ — applied when the platform URL came from an MB url-relationship
   * (existing rel), as distinct from a found-via-Wikidata/search result. Layered
   * on top of the colour-tint (green = fresh, steel-blue = cache hit). */
  .online-search-box .pc-ico-circled {
    border: 1.5px solid currentColor;
    border-radius: 50%;
    width: 13px;
    height: 13px;
    line-height: 11px;
    text-align: center;
    font-size: 9px;
    box-sizing: border-box;
    display: inline-block;
  }
</style>
<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #EEE; padding-bottom: 4px; margin-bottom: 6px;">
  <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #666;">
    Platform Check
    <span id="mb-mb-info" style="font-weight: normal; font-size: 10px; color: #999; margin-left: 6px; text-transform: none; letter-spacing: 0;"></span>
  </h3>
  <span id="mb-refresh-btn" class="pc-icon-btn" title="Refresh — clear cache and re-scan" style="${iconBtn}">↻</span>
</div>
<div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 6px;">
  ${PROVIDER_ORDER.map(p => `
  <div id="row-${p}" style="display: flex; flex-direction: column;">
    <div style="display: flex; align-items: center; gap: 2px;">
      <span id="master-${p}" class="pc-master-slot" style="font-size: 11px; min-width: 14px; text-align: center; cursor: default;"></span>
      <span id="ico-${p}"    class="pc-ico-slot"    style="font-size: 11px; min-width: 14px; text-align: center; color: #888;">⚪</span>
      <a id="mb-online-${p}" href="#" target="_blank" rel="noopener" style="color: ${PROVIDER_COLOR[p] || '#222'}; text-decoration: none; font-weight: 600; flex-grow: 1; margin-left: 4px;">${PROVIDER_NAME[p]}</a>
      <span id="val-${p}" style="font-size: 12px; font-weight: bold; font-family: monospace; color: #777;">—</span>
    </div>
    <div id="meta-${p}" style="font-size: 10px; color: #999; padding-left: 36px; font-family: sans-serif; line-height: 1.2; margin-top: -1px;"></div>
  </div>`).join('')}
</div>
<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #EEE;">
  <span id="mb-inject-btn"      class="pc-icon-btn" title="Open the release editor and queue OK URLs to add" style="${iconBtn}">+</span>
  <span id="mb-token-setup-btn" class="pc-icon-btn" title="Provider toggles"                                  style="${iconBtn}">⚙</span>
  <span id="mb-log-open-btn"    class="pc-icon-btn" title="Diagnostic log"                                    style="${iconBtn}">ⓘ</span>
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
const LOG_SOURCES = ['System', 'MusicBrainz', 'Wikidata', 'Spotify', 'Discogs', 'Bandcamp', 'Deezer', 'Apple'];
const LOG_SOURCE_COLORS = {
    System: '#999', MusicBrainz: '#BA68C8', Wikidata: '#FFD54F',
    Spotify: '#1DB954', Discogs: '#E0E0E0', Bandcamp: '#629AA9', Deezer: '#A238FF', Apple: '#FA243C',
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
  <div id="mb-provider-list" style="margin-bottom: 14px;">
  ${PROVIDER_ORDER.map(p => `
    <div class="pc-prov-row" data-provider="${p}" draggable="true" style="display: flex; align-items: center; margin-bottom: 4px; font-size: 13px; padding: 6px 8px; border-radius: 4px; background: #FAFAFA; border: 1px solid transparent; cursor: grab; user-select: none;">
      <span class="pc-prov-grip" style="color: #BBB; font-size: 14px; margin-right: 8px; letter-spacing: -2px;" title="Drag to reorder">⋮⋮</span>
      <input type="checkbox" id="mb-toggle-${p}" checked style="margin: 0 10px 0 0; width: 16px; height: 16px;">
      <span style="font-weight: 500; flex-grow: 1;">${PROVIDER_NAME[p]}</span>
    </div>`).join('')}
  </div>
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
const providerRows = Object.fromEntries(PROVIDER_ORDER.map(p => [p, document.getElementById(`row-${p}`)]));

PROVIDER_ORDER.forEach(p => {
    const enabled = GM_getValue(`prov_${p}`, true);
    if (providerRows[p]) providerRows[p].style.display = enabled ? 'flex' : 'none';
});

// Provider-reorder controls in the providers modal — drag-and-drop. Each row
// is draggable; dragover on a sibling reorders via the cursor's Y-midpoint
// (above-mid = insert before, below-mid = insert after). Save reads the
// resulting DOM order, persists to pc:provider-order, and reloads so the
// sidebar re-renders rows in the new sequence.
{
    let dragged = null;
    const list = providerModal.querySelector('#mb-provider-list');
    for (const row of list.querySelectorAll('.pc-prov-row')) {
        row.addEventListener('dragstart', e => {
            dragged = row;
            row.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
            // Some browsers require setData() for drag to start.
            try { e.dataTransfer.setData('text/plain', row.dataset.provider); } catch (_) {}
        });
        row.addEventListener('dragend', () => {
            row.style.opacity = '';
            for (const r of list.querySelectorAll('.pc-prov-row')) r.style.borderColor = 'transparent';
            dragged = null;
        });
        row.addEventListener('dragover', e => {
            if (!dragged || dragged === row) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = row.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            // Visual hint: highlight which edge will receive the drop.
            row.style.borderColor = '#1DB954';
            row.style.borderTopColor    = after ? 'transparent' : '#1DB954';
            row.style.borderBottomColor = after ? '#1DB954'     : 'transparent';
            row.style.borderLeftColor   = 'transparent';
            row.style.borderRightColor  = 'transparent';
        });
        row.addEventListener('dragleave', () => { row.style.borderColor = 'transparent'; });
        row.addEventListener('drop', e => {
            e.preventDefault();
            if (!dragged || dragged === row) return;
            const rect = row.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            list.insertBefore(dragged, after ? row.nextSibling : row);
        });
    }
}

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
    PROVIDER_ORDER.forEach(p => { document.getElementById(`mb-toggle-${p}`).checked = GM_getValue(`prov_${p}`, true); });
    providerModal.style.display = 'block';
});
document.getElementById('mb-provider-cancel-btn').addEventListener('click', closeAllModals);
document.getElementById('mb-provider-save-btn').addEventListener('click', () => {
    PROVIDER_ORDER.forEach(p => {
        const checked = document.getElementById(`mb-toggle-${p}`).checked;
        GM_setValue(`prov_${p}`, checked);
        if (providerRows[p]) providerRows[p].style.display = checked ? 'flex' : 'none';
    });
    // Persist provider order from the modal's current row sequence. If the
    // order changed, reload — the sidebar's row container was rendered at
    // script init with the old order, and re-ordering in place would need
    // careful DOM surgery for not much gain.
    const newOrder = [...providerModal.querySelectorAll('.pc-prov-row')].map(r => r.dataset.provider);
    const sameOrder = newOrder.length === PROVIDER_ORDER.length && newOrder.every((v, i) => v === PROVIDER_ORDER[i]);
    if (!sameOrder) {
        GM_setValue('pc:provider-order', JSON.stringify(newOrder));
        location.reload();
        return;
    }
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
// `source` is the original origin of the URL ('MB rels' / 'Wikidata' / 'search' /
// 'native' / 'API search'). `fromCache` is independent — true when this row was
// resolved from the local cache, regardless of which path originally found it.
// Two visual signals get layered:
//   colour tint    — green when fromCache=false, steel-blue when fromCache=true
//   circled icon   — when source includes 'MB rels' (the URL was put there by
//                    an MB editor, not discovered by us)
function updateRow(p, { url, mbTracks, remoteTracks, year, label, source, fromCache, format, masterState }) {
    const a    = document.getElementById(`mb-online-${p}`);
    const ico  = document.getElementById(`ico-${p}`);
    const val  = document.getElementById(`val-${p}`);
    const meta = document.getElementById(`meta-${p}`);
    if (url) a.href = url;

    const fromMbRels = source === 'MB rels';

    // Source-on-hover: tooltip on the provider name. "via MB rels", "via
    // Wikidata", "via API search · cached", etc. Replaces the visible badge
    // that used to live next to the track count.
    if (url) {
        const parts = [];
        if (source) parts.push(`via ${source}`);
        if (fromCache) parts.push('cached');
        a.title = parts.length ? `${PROVIDER_NAME[p]} URL — ${parts.join(' · ')}` : '';
    } else {
        a.title = `No ${PROVIDER_NAME[p]} URL found`;
    }

    // val is the platform's track count as a bare number, coloured by match
    // against the MB-side number (shown in the header). No more "(N/M trks)".
    if (remoteTracks != null) {
        val.textContent = String(remoteTracks);
        if (parseInt(remoteTracks, 10) === parseInt(mbTracks, 10)) {
            ico.textContent = '✓';
            const tone = fromCache ? '#5B82B0' : '#008000';
            ico.style.color = tone;
            val.style.color = tone;
        } else {
            ico.textContent = '~'; ico.style.color = '#FF8C00';
            val.style.color = '#FF8C00';
        }
    } else if (url) {
        ico.textContent = '?'; ico.style.color = '#999';
        val.textContent = '?'; val.style.color = '#999';
    } else {
        ico.textContent = '×'; ico.style.color = '#BF616A';
        val.textContent = '—'; val.style.color = '#BF616A';
    }

    // Circle MB-rels rows regardless of glyph — circle says "URL is in MB".
    ico.classList.toggle('pc-ico-circled', fromMbRels);

    // Click-to-add on the main icon for verified ✓ + not-already-in-MB.
    const canAdd = url && ico.textContent === '✓' && !fromMbRels;
    ico.style.cursor = canAdd ? 'pointer' : '';
    ico.title = canAdd ? `Click to add ${PROVIDER_NAME[p]} URL to MB` : '';
    ico.onclick = canAdd ? () => addSingleUrl(p) : null;

    // Discogs gets a master state in the left slot. Other platforms have an
    // empty slot of the same width so the rows still align vertically.
    const masterEl = document.getElementById(`master-${p}`);
    if (masterEl) {
        if (p === 'discogs' && masterState) {
            applyMasterIcon(masterEl, masterState);
        } else {
            masterEl.innerHTML  = '';
            masterEl.onclick    = null;
            masterEl.style.cursor = 'default';
            masterEl.title      = '';
            masterEl.classList.remove('pc-ico-circled');
        }
    }

    // Meta line: year · label · format. Source/cache state is implicit in
    // the main icon's colour (green = fresh, steel-blue = cache) so no more
    // "via X" text.
    const bits = [];
    if (year)   bits.push(year);
    if (label)  bits.push(label);
    if (format) bits.push(format);
    meta.innerHTML = bits.join(' · ');
}

// Apply Discogs master-state to the master slot. State shape:
// { glyph: '✓'|'~'|'×', circled: bool, clickable: bool, title: str, addMasterUrl?: str }
function applyMasterIcon(el, state) {
    el.textContent = state.glyph;
    el.style.color = state.circled ? '#5B82B0' : '#5B82B0';
    el.title       = state.title;
    el.classList.toggle('pc-ico-circled', !!state.circled);
    if (state.clickable && state.addMasterUrl) {
        el.style.cursor = 'pointer';
        el.onclick = () => addMasterUrl(state.addMasterUrl);
    } else {
        el.style.cursor = 'default';
        el.onclick = null;
    }
}

// Build the Discogs master-state object given the URL Discogs found + the
// URL MB has on the release-group already. Drives applyMasterIcon().
function discogsMasterState(cachedMasterUrl, existingDiscogsMaster) {
    if (!cachedMasterUrl) return null;
    if (existingDiscogsMaster === cachedMasterUrl) {
        return { glyph: '✓', circled: true,  clickable: false, title: 'Discogs master URL is on the release-group' };
    }
    if (existingDiscogsMaster) {
        return { glyph: '~', circled: true,  clickable: false, title: `MB has a different Discogs master on the release-group: ${existingDiscogsMaster}` };
    }
    return     { glyph: '✓', circled: false, clickable: true,  title: 'Click to add this Discogs master URL to the release-group', addMasterUrl: cachedMasterUrl };
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
    for (const p of ['spotify', 'discogs', 'bandcamp', 'deezer', 'apple']) GM_setValue(cacheKey(mbid, p), null);
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

// Apply a cached row to the UI and log the hit. Preserves the cache entry's
// original source (e.g. 'MB rels', 'Wikidata', 'search') so updateRow can
// still decide whether to circle the ✓; cache-state is conveyed separately
// via the `fromCache: true` flag (which drives the steel-blue tint).
function applyCachedRow(platform, label, cached, mbTracks, masterState) {
    appendLog(label, `Cache hit: url=${cached.url || '(no match)'}  tracks=${cached.tracks ?? '?'}  year=${cached.year || '?'}  label=${cached.label || '?'}  src=${cached.source || '?'}`, 'ok');
    updateRow(platform, {
        url:          cached.url,
        mbTracks,
        remoteTracks: cached.tracks ?? null,
        year:         cached.year   ?? null,
        label:        cached.label  ?? null,
        format:       cached.format  ?? null,
        source:       cached.source || null,
        fromCache:    true,
        masterState:  masterState   ?? null,
    });
}

// (Old discogsMasterExtra pill replaced by the master-slot state object —
// see discogsMasterState() / applyMasterIcon() above.)

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

// MB's media[].format strings → Discogs API's `format` query value. Other
// formats (DVD/Blu-ray/SACD/etc.) we just leave unfiltered — those are rare
// enough on Discogs that adding a filter hurts more than it helps.
function mbFormatToDiscogs(mbFormat) {
    if (!mbFormat) return null;
    const f = String(mbFormat).toLowerCase();
    if (f.includes('vinyl'))    return 'Vinyl';
    if (f.includes('cassette')) return 'Cassette';
    if (f.includes('digital') || f === 'file') return 'File';
    if (f === 'cd' || f.includes('cd'))        return 'CD';
    return null;
}

async function scanDiscogs({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, format, existingDiscogsMaster }) {
    const label = 'Discogs';

    // Positive cache hit short-circuits before any API call. Cached "no
    // match" only short-circuits when there's no MB rel either — we still
    // want a freshly-added MB rel to replace a stale no-match.
    const cached = cacheGet(mbid, 'discogs');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('discogs', label, cached, mbTracks, discogsMasterState(cached.masterUrl, existingDiscogsMaster));
        return;
    }
    if (cached && !cached.url && !existingUrl) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('discogs', label, cached, mbTracks, discogsMasterState(cached.masterUrl, existingDiscogsMaster));
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
        // For VA compilations drop the artist term — Discogs doesn't credit
        // compilations to a literal "Various Artists" string, so including
        // it in the query produces 0 results.
        const apiQ = isVariousArtists ? album : `${artist} ${album}`;
        const discogsFmt = mbFormatToDiscogs(format);
        // Format-aware first try: a CD release shouldn't pick a vinyl Discogs
        // entry when a CD edition exists. If the format-filtered search
        // returns 0 results, retry without the format filter and accept
        // whatever's available.
        const trySearch = async withFormat => {
            const u = `https://api.discogs.com/database/search?q=${encodeURIComponent(apiQ)}&type=release&per_page=5${withFormat ? `&format=${encodeURIComponent(discogsFmt)}` : ''}`;
            appendLog(label, `API search${withFormat ? ` (format=${discogsFmt})` : ''}: ${u}`);
            const r = await gmGet(u);
            appendLog(label, `API search: status=${r.status} ${r.responseText.length}b in ${r.ms}ms`);
            return r;
        };
        let sr = await trySearch(!!discogsFmt);
        if (sr.ok) {
            try {
                let data = JSON.parse(sr.responseText);
                if ((data.results || []).length === 0 && discogsFmt) {
                    appendLog(label, `0 results with format=${discogsFmt} — retrying without format filter`, 'warn');
                    sr   = await trySearch(false);
                    data = sr.ok ? JSON.parse(sr.responseText) : { results: [] };
                }
                const first = data.results?.[0];
                if (first) {
                    releaseId  = String(first.id);
                    releaseUrl = `https://www.discogs.com/release/${releaseId}`;
                    source     = discogsFmt && data.results.every(r => (r.format || []).some(f => mbFormatToDiscogs(f) === discogsFmt))
                        ? `API search (format=${discogsFmt})`
                        : 'API search';
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

    let tracks = null, year = null, lbl = null, fmt = null, masterUrl = null;
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
                // Discogs `formats` is an array of {name, qty, descriptions}.
                fmt = (data.formats || []).map(f => {
                    const head = (f.qty && f.qty !== '1' ? `${f.qty}×` : '') + (f.name || '');
                    return head + (f.descriptions?.length ? ` (${f.descriptions.join(', ')})` : '');
                }).join(', ') || null;
                // Master URL — points at the release-group equivalent on Discogs.
                // Stored so the + flow can offer to add it to MB's release-group
                // url-rels (a separate edit page from the release).
                if (data.master_id) masterUrl = `https://www.discogs.com/master/${data.master_id}`;
                appendLog(label, `API detail parsed: tracks=${tracks} year=${year || '?'} label=${lbl || '?'} format=${fmt || '?'} master=${masterUrl || '-'}`, 'ok');
            } catch (e) { appendLog(label, `API detail parse error: ${e.message}`, 'error'); }
        } else { appendLog(label, `API detail failed`, 'error'); }
    }

    cacheSet(mbid, 'discogs', { url: releaseUrl, tracks, year, label: lbl, format: fmt, masterUrl, source });
    updateRow('discogs', {
        url: releaseUrl, mbTracks, remoteTracks: tracks, year, label: lbl, format: fmt, source,
        masterState: discogsMasterState(masterUrl, existingDiscogsMaster),
    });
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
    // Bandcamp's JSON-LD includes one albumRelease entry per available format
    // (DigitalFormat / VinylFormat / CDFormat / CassetteFormat / …). Strip
    // the "Format" suffix and dedupe to a short tag list.
    const formats = [...new Set(
        [...html.matchAll(/"musicReleaseFormat"\s*:\s*"(\w+)"/g)]
            .map(m => m[1].replace(/Format$/, ''))
    )];
    return {
        tracks: numTracksMatch ? parseInt(numTracksMatch[1], 10) : null,
        title:  titleMatch?.[1] || null,
        year:   yMatch?.[1]     || null,
        label:  lMatch?.[1]     || null,
        format: formats.length ? formats.join(', ') : null,
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
        appendLog(label, `Album parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'} format=${meta.format || '?'}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Album page failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    const fmt    = meta?.format ?? null;
    cacheSet(mbid, 'bandcamp', { url: albumUrl, tracks, year, label: lbl, format: fmt, source });
    updateRow('bandcamp', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, format: fmt, source });
}

// ─── Deezer ─────────────────────────────────────────────────────────────────
// Deezer's public API (api.deezer.com) is unauthenticated and structured —
// search returns album id + title + artist + nb_tracks; detail adds release_date
// + label. No CAPTCHA, no anti-bot, ~50 req / 5 sec / IP. Use it for both
// the search step and the detail step; no need for any HTML scraping.
async function fetchDeezerMeta(albumUrl) {
    const m = albumUrl.match(/deezer\.com\/(?:[a-z]+\/)?album\/(\d+)/i);
    if (!m) return null;
    const r = await gmGet(`https://api.deezer.com/album/${m[1]}`);
    if (!r.ok) return null;
    try {
        const d = JSON.parse(r.responseText);
        return {
            tracks: d.nb_tracks ?? null,
            title:  d.title || null,
            year:   d.release_date ? d.release_date.slice(0, 4) : null,
            label:  d.label || null,
        };
    } catch { return null; }
}

async function scanDeezer({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists }) {
    const label = 'Deezer';

    const cached = cacheGet(mbid, 'deezer');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('deezer', label, cached, mbTracks);
        return;
    }
    if (cached && !cached.url && !existingUrl) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('deezer', label, cached, mbTracks);
        return;
    }

    let albumUrl = existingUrl;
    let source   = null;

    if (albumUrl) {
        appendLog(label, `Using existing MB URL: ${albumUrl}`, 'ok');
        source = 'MB rels';
    } else {
        // Deezer search-query syntax supports field-prefix matching, so we can
        // narrow exactly to artist + album. VA compilations: query by album only
        // (Deezer credits compilations to the label/aggregator, not to a
        // literal "Various Artists" string).
        const q = isVariousArtists ? `album:"${album}"` : `artist:"${artist}" album:"${album}"`;
        const searchUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=10`;
        appendLog(label, `API search: ${searchUrl}`);
        const sr = await gmGet(searchUrl);
        appendLog(label, `API search: status=${sr.status} ${sr.responseText.length}b in ${sr.ms}ms`);
        if (!sr.ok) {
            appendLog(label, `API search failed`, 'error');
            cacheSet(mbid, 'deezer', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('deezer', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        let results = [];
        try {
            const data = JSON.parse(sr.responseText);
            results = data.data || [];
        } catch (e) {
            appendLog(label, `API JSON parse error: ${e.message}`, 'error');
            updateRow('deezer', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        appendLog(label, `API search: ${results.length} candidate(s)`);
        if (!results.length) {
            cacheSet(mbid, 'deezer', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('deezer', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        // Pick the best candidate by track count + title (reuse scoreCandidate).
        // Search results already carry nb_tracks + title so no per-candidate
        // detail fetch needed at this stage.
        let best = null;
        for (const it of results) {
            const sc = scoreCandidate({ tracks: it.nb_tracks, title: it.title }, mbTracks, album);
            appendLog(label, `  cand score=${sc}  tracks=${it.nb_tracks ?? '?'}  title="${it.title}"  url=${it.link}`);
            if (!best || sc > best.score) best = { score: sc, item: it };
            if (sc >= 100) break;
        }
        if (!best || best.score === 0) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'deezer', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('deezer', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.item.link;
        source = 'API search';
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 100 ? 'ok' : 'warn');
    }

    const meta = await fetchDeezerMeta(albumUrl);
    if (meta) {
        appendLog(label, `Album parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Detail fetch failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    cacheSet(mbid, 'deezer', { url: albumUrl, tracks, year, label: lbl, source });
    updateRow('deezer', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source });
}

// ─── Apple Music ────────────────────────────────────────────────────────────
// iTunes Search API (itunes.apple.com/{search,lookup}) is unauthenticated and
// returns structured JSON — same shape as Deezer. trackCount, releaseDate, and
// `copyright` (label name on most releases) are exposed directly. URL field is
// `collectionViewUrl` which points at music.apple.com/<country>/album/<slug>/<id>.
async function fetchAppleMeta(albumUrl) {
    const m = albumUrl.match(/\/album\/(?:[^/]+\/)?(\d+)/);
    if (!m) return null;
    const r = await gmGet(`https://itunes.apple.com/lookup?id=${m[1]}&entity=album`);
    if (!r.ok) return null;
    try {
        const d = JSON.parse(r.responseText);
        const a = d.results?.[0];
        if (!a) return null;
        return {
            tracks: a.trackCount ?? null,
            title:  a.collectionName || null,
            year:   a.releaseDate ? a.releaseDate.slice(0, 4) : null,
            // copyright field is the label on most albums (e.g. "℗ 2021 Daptone Records"); strip the ℗/© and year prefix.
            label:  a.copyright ? a.copyright.replace(/^[℗©]\s*\d{4}\s*/, '').trim() || null : null,
        };
    } catch { return null; }
}

async function scanApple({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, wikidataAppleId }) {
    const label = 'Apple';

    const cached = cacheGet(mbid, 'apple');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('apple', label, cached, mbTracks);
        return;
    }
    if (cached && !cached.url && !existingUrl) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('apple', label, cached, mbTracks);
        return;
    }

    let albumUrl = existingUrl;
    let source   = null;

    if (albumUrl) {
        appendLog(label, `Using existing MB URL: ${albumUrl}`, 'ok');
        source = 'MB rels';
    } else if (wikidataAppleId) {
        // P5121 stores the bare numeric Apple Music album ID. Construct the
        // canonical /us/album/<id> URL (no slug needed for resolution).
        albumUrl = `https://music.apple.com/us/album/${wikidataAppleId}`;
        appendLog(label, `Wikidata answer: ${albumUrl}`, 'ok');
        source = 'Wikidata';
    } else {
        // iTunes Search API. VA compilations: query album-only (the API
        // doesn't credit compilations to a literal "Various Artists" string).
        const term = isVariousArtists ? album : `${artist} ${album}`;
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=10`;
        appendLog(label, `API search: ${searchUrl}`);
        const sr = await gmGet(searchUrl);
        appendLog(label, `API search: status=${sr.status} ${sr.responseText.length}b in ${sr.ms}ms`);
        let results = [];
        if (sr.ok) {
            try { results = (JSON.parse(sr.responseText).results) || []; }
            catch (e) { appendLog(label, `API JSON parse error: ${e.message}`, 'error'); }
        }
        appendLog(label, `API search: ${results.length} candidate(s)`);
        if (!results.length) {
            cacheSet(mbid, 'apple', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('apple', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        let best = null;
        for (const it of results) {
            const sc = scoreCandidate({ tracks: it.trackCount, title: it.collectionName }, mbTracks, album);
            appendLog(label, `  cand score=${sc}  tracks=${it.trackCount ?? '?'}  title="${it.collectionName}"  url=${it.collectionViewUrl}`);
            if (!best || sc > best.score) best = { score: sc, item: it };
            if (sc >= 100) break;
        }
        if (!best || best.score === 0) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'apple', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('apple', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        // Strip the `?uo=4` affiliate tail that iTunes Search returns on
        // collectionViewUrl — MB normalises to the clean form.
        albumUrl = best.item.collectionViewUrl.split('?')[0];
        source = 'API search';
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 100 ? 'ok' : 'warn');
    }

    const meta = await fetchAppleMeta(albumUrl);
    if (meta) {
        appendLog(label, `Album parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Detail fetch failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    cacheSet(mbid, 'apple', { url: albumUrl, tracks, year, label: lbl, source });
    updateRow('apple', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source });
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
    for (const p of ['spotify', 'discogs', 'bandcamp', 'deezer', 'apple']) {
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

        // Track count. Current MB markup renders each track as a bare <tr>
        // inside `table.tbl.medium tbody`, the first row being `<tr class="subh">`
        // (header). Tracks have a `<td class="pos">` cell — counting those
        // skips the header automatically and works for multi-disc releases
        // (one table per medium, all summed). The older `tr.track` selector
        // is kept as a fallback for any legacy renderer.
        const mbTracks = document.querySelectorAll('table.tbl.medium tbody tr > td.pos').length
                       || document.querySelectorAll('tr.track').length;

        // Release-group MBID — usually present as a /release-group/<mbid>
        // anchor in the release-information sidebar block. Some skins or
        // partially-rendered pages have it only in an inline data attribute
        // or a meta tag; cast a wider net.
        const rgFromHref = [...document.querySelectorAll('a[href*="/release-group/"]')]
            .map(a => a.getAttribute('href').match(/release-group\/([0-9a-f-]{36})/)?.[1])
            .find(Boolean);
        const rgFromText = document.body.innerHTML.match(/release-group\/([0-9a-f-]{36})/)?.[1];
        const releaseGroupMbid = rgFromHref || rgFromText || null;

        // Existing URL rels. MB renders the release's URL relationships in
        // different places depending on layout state — sometimes under
        // "External links" in #sidebar, sometimes inline in the main #content
        // under a "Credits" / "External links" section (verified on the
        // "Mambo loco" release where Discogs / Spotify / Bandcamp all appear
        // in the main content's credits table). Search both. The platform
        // URL patterns below are specific enough that we won't false-positive
        // on unrelated outbound links.
        //
        // Some MB anchors use protocol-relative `href="//host/path"` so we
        // query every `a[href]` and filter on the *resolved* `.href` property
        // (always absolute) rather than the attribute selector.
        const scope = document.querySelector('#content, #wrap, body') || document;
        const sidebar = document.querySelector('#sidebar');
        const allAnchors = [
            ...(sidebar ? sidebar.querySelectorAll('a[href]') : []),
            ...scope.querySelectorAll('a[href]'),
        ];
        const externalHrefs = allAnchors.map(a => a.href).filter(u => /^https?:\/\//.test(u));
        const existing = {
            spotify:  externalHrefs.find(u => /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\//i.test(u)) || null,
            discogs:  externalHrefs.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i.test(u)) || null,
            bandcamp:      externalHrefs.find(u => /^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u)) || null,
            deezer:        externalHrefs.find(u => /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]+\/)?album\/\d+/i.test(u)) || null,
            apple:         externalHrefs.find(u => /^https?:\/\/music\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/]+\/)?\d+/i.test(u)) || null,
            discogsMaster: externalHrefs.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?master\/\d+/i.test(u)) || null,
        };

        const isVariousArtists = artistIds.includes(VA_MBID) || artistNames.some(n => VA_NAME_RE.test(n));

        // Release format (CD / Vinyl / Cassette / Digital Media / …). MB renders
        // it in the medium header above each tracklist. Used by the Discogs
        // scanner to filter `&format=` so a CD release doesn't pick a vinyl
        // Discogs entry when a CD is available. Best-effort — null is fine.
        let format = null;
        for (const t of document.querySelectorAll('table.tbl.medium')) {
            const head = (t.previousElementSibling?.textContent || t.querySelector('caption, thead')?.textContent || '').trim();
            const m = head.match(/\b(CD|Vinyl|Cassette|Digital\s*Media|File|SACD|DVD|Blu-?ray|Flexi-?disc|Minidisc)\b/i);
            if (m) { format = m[1]; break; }
        }

        // Year + label for the header subtitle. Scrape from the sidebar's
        // release-information dl. Best-effort — both can be null.
        let year = null, releaseLabel = null;
        for (const dt of document.querySelectorAll('dl.properties dt, dl dt')) {
            const txt = (dt.textContent || '').trim().replace(/:$/, '').toLowerCase();
            const dd = dt.nextElementSibling;
            if (!dd || dd.tagName !== 'DD') continue;
            if (txt === 'date' || txt === 'release date') {
                const m = dd.textContent.match(/(\d{4})/);
                if (m && !year) year = m[1];
            }
            if (txt === 'label' || txt === 'labels') {
                const aLabels = [...dd.querySelectorAll('a[href*="/label/"]')].map(a => a.textContent.trim()).filter(Boolean);
                if (aLabels.length) releaseLabel = [...new Set(aLabels)].join(', ');
            }
        }

        // Sanity gate: we need artist + album + at least one track row. Anything
        // less is an unrendered or unfamiliar layout — bail to API.
        if (!artist || !album || mbTracks < 1) return null;
        return { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing, format, year, releaseLabel };
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
        bandcamp:      relUrls.find(u => /^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u)) || null,
        deezer:        relUrls.find(u => /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]+\/)?album\/\d+/i.test(u)) || null,
        apple:         relUrls.find(u => /^https?:\/\/music\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/]+\/)?\d+/i.test(u)) || null,
        discogsMaster: relUrls.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?master\/\d+/i.test(u)) || null,
    };
    const format = data.media?.[0]?.format || null;
    const year   = data.date ? String(data.date).slice(0, 4) : null;
    const releaseLabel = (data['label-info'] || [])
        .map(li => li.label?.name)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ') || null;
    return { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing, format, year, releaseLabel };
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
        const mb = await gmGet(`https://musicbrainz.org/ws/2/release/${mbid}?inc=artists+media+url-rels+release-groups+labels&fmt=json`);
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

    const { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing, format, year, releaseLabel } = mbData;
    // Header subtitle — small grey text after the title, e.g. "2013 · Civil
    // Music · Digital". Track count rendered separately on the right.
    const infoEl = document.getElementById('mb-mb-info');
    if (infoEl) {
        const parts = [];
        if (year)         parts.push(year);
        if (releaseLabel) parts.push(releaseLabel);
        if (format)       parts.push(format);
        infoEl.innerHTML = parts.join(' · ') + (parts.length ? ` · <span style="color:#FF8C00;font-weight:bold;">${mbTracks}</span>` : `<span style="color:#FF8C00;font-weight:bold;">${mbTracks} trk</span>`);
    }
    appendLog('MusicBrainz', `Artist: "${artist}"${isVariousArtists ? ' (Various Artists — search by album only)' : ''}  Album: "${album}"  Tracks: ${mbTracks}  rg=${releaseGroupMbid || '(none)'}`);
    appendLog('MusicBrainz', `Existing rels — spotify=${existing.spotify ? 'YES' : 'no'}  discogs=${existing.discogs ? 'YES' : 'no'}  bandcamp=${existing.bandcamp ? 'YES' : 'no'}  deezer=${existing.deezer ? 'YES' : 'no'}  apple=${existing.apple ? 'YES' : 'no'}`);

    // Cache upgrade: if MB has acquired a URL rel matching a cached URL (the
    // user just added the URL via + and came back), promote the cached row's
    // source from search/Wikidata to "MB rels" so the circled icon shows
    // immediately on the cache short-circuit — without it the user has to
    // hit ↻ to see the circle, even though MB now considers it an
    // editor-added rel.
    for (const p of ['spotify', 'discogs', 'bandcamp', 'deezer', 'apple']) {
        const cached = cacheGet(mbid, p);
        if (cached?.url && existing[p] === cached.url && cached.source !== 'MB rels') {
            cacheSet(mbid, p, { ...cached, source: 'MB rels' });
            appendLog('MusicBrainz', `Cache upgrade: ${p} URL now in MB rels — source bumped to "MB rels"`, 'ok');
        }
    }

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
    document.getElementById('mb-online-deezer')  .href = `https://www.deezer.com/search/${encodeURIComponent(`${artist} ${album}`)}`;
    document.getElementById('mb-online-apple')   .href = `https://music.apple.com/us/search?term=${encodeURIComponent(`${artist} ${album}`)}`;

    const ctx = { artist, album, mbTracks, mbid, isVariousArtists, format, existingDiscogsMaster: existing.discogsMaster || null };
    const tasks = [];
    if (GM_getValue('prov_spotify',  true)) tasks.push(scanSpotify ({ ...ctx, existingUrl: existing.spotify,  wikidataSpotifyId: wd?.spotifyId || null }));
    if (GM_getValue('prov_discogs',  true)) tasks.push(scanDiscogs ({ ...ctx, existingUrl: existing.discogs  }));
    if (GM_getValue('prov_bandcamp', true)) tasks.push(scanBandcamp({ ...ctx, existingUrl: existing.bandcamp }));
    if (GM_getValue('prov_deezer',   true)) tasks.push(scanDeezer  ({ ...ctx, existingUrl: existing.deezer   }));
    if (GM_getValue('prov_apple',    true)) tasks.push(scanApple   ({ ...ctx, existingUrl: existing.apple,    wikidataAppleId: wd?.appleId || null }));
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

// + INJECT button: collect every confirmed (✓) URL that ISN'T already in MB's
// url-rels, stash it under `pc:pending:<mbid>` in GM storage, and open the
// edit-relationships page in a new tab. The companion handler that runs on
// that page (same script, @match'd against /edit-relationships) reads the
// pending entry and dispatches each URL into MB's relationship editor.
// Small floating toast near a target element, auto-fades after ~1.5 s.
// Reused as inline feedback for the + button when there's nothing to do.
function flashInfo(targetEl, text, bg = '#5B82B0') {
    document.getElementById('pc-flash-info')?.remove();
    const rect = targetEl.getBoundingClientRect();
    const tip = document.createElement('div');
    tip.id = 'pc-flash-info';
    tip.textContent = text;
    tip.style.cssText = `position:absolute;left:${rect.left + window.scrollX}px;top:${rect.bottom + window.scrollY + 4}px;background:${bg};color:#FFF;padding:4px 8px;border-radius:3px;font-size:11px;font-family:sans-serif;white-space:nowrap;z-index:99999;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.2);transition:opacity .3s;`;
    document.body.appendChild(tip);
    setTimeout(() => { tip.style.opacity = '0'; }, 1500);
    setTimeout(() => { tip.remove(); }, 1850);
}

// Single-row click-to-add (icon click) — queues just one platform's URL and
// opens /release/<mbid>/edit. The bulk + button at the bottom still queues
// every ✓ row at once.
function addSingleUrl(platform) {
    const cached = cacheGet(mbid, platform);
    if (!cached?.url) return;
    GM_setValue(`pc:pending:${mbid}`, JSON.stringify({ [platform]: cached.url }));
    appendLog('System', `Inject (click): queued ${platform} URL — opening release editor`, 'ok');
    window.open(`https://musicbrainz.org/release/${mbid}/edit`, '_blank');
}

// Click-to-add on the Discogs master slot — queues the master URL for the
// release-group's edit page (different target than the release URLs).
function addMasterUrl(masterUrl) {
    const mb = mbDataGet(mbid);
    const rgMbid = mb?.releaseGroupMbid;
    if (!rgMbid) {
        appendLog('System', `Master add: no release-group MBID known for this release`, 'error');
        return;
    }
    GM_setValue(`pc:pending:rg:${rgMbid}`, JSON.stringify({ 'discogs-master': masterUrl }));
    appendLog('System', `Inject (master): queued ${masterUrl} for release-group ${rgMbid}`, 'ok');
    window.open(`https://musicbrainz.org/release-group/${rgMbid}/edit`, '_blank');
}

document.getElementById('mb-inject-btn').addEventListener('click', async (e) => {
    const triggerBtn = e.currentTarget;
    // Bucket 1: URLs going onto the release.
    const pendingRelease = {};
    for (const p of PROVIDER_ORDER) {
        const cached = cacheGet(mbid, p);
        if (!cached?.url) continue;
        if (cached.source === 'MB rels') continue;
        const icoText = document.getElementById(`ico-${p}`)?.textContent?.trim();
        if (icoText !== '✓') continue;
        pendingRelease[p] = cached.url;
    }

    // Bucket 2: Discogs master URL → goes onto the release-group, not the
    // release. Skip if MB already has it: check `existing.discogsMaster`
    // which parseMbFromDom / parseMbData populated from the release page
    // DOM (any /discogs.com/master/<id> anchor visible on the page). No
    // extra /ws/2 round-trip.
    const pendingRG = {};
    const discogsCache = cacheGet(mbid, 'discogs');
    const masterUrl    = discogsCache?.masterUrl;
    const mbCached     = mbDataGet(mbid);
    const rgMbid       = mbCached?.releaseGroupMbid;
    const existingMaster = mbCached?.existing?.discogsMaster;
    if (masterUrl && rgMbid && !existingMaster) {
        pendingRG['discogs-master'] = masterUrl;
        appendLog('System', `Inject: queueing Discogs master ${masterUrl} for release-group ${rgMbid}`);
    } else if (masterUrl && existingMaster) {
        appendLog('System', `Inject: Discogs master already in MB rels (${existingMaster}) — skipping`);
    }

    const releaseCount = Object.keys(pendingRelease).length;
    const rgCount      = Object.keys(pendingRG).length;
    if (releaseCount + rgCount === 0) {
        appendLog('System', `Inject: nothing to add — all OK URLs already in MB`, 'warn');
        flashInfo(triggerBtn, 'Already in MB');
        return;
    }

    if (releaseCount > 0) {
        GM_setValue(`pc:pending:${mbid}`, JSON.stringify(pendingRelease));
        appendLog('System', `Inject: queued ${releaseCount} release URL(s) — opening release editor`, 'ok');
        window.open(`https://musicbrainz.org/release/${mbid}/edit`, '_blank');
    }
    if (rgCount > 0 && rgMbid) {
        GM_setValue(`pc:pending:rg:${rgMbid}`, JSON.stringify(pendingRG));
        appendLog('System', `Inject: queued ${rgCount} release-group URL(s) — opening release-group editor`, 'ok');
        window.open(`https://musicbrainz.org/release-group/${rgMbid}/edit`, '_blank');
    }
});

runScans();

})();
