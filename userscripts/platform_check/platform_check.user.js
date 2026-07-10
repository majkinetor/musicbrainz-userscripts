// ==UserScript==
// @name         Platform Check
// @namespace    http://tampermonkey.net/
// @version      2026.7.10.132150
// @description  Find a MusicBrainz release on online platforms like Spotify, Discogs, Bandcamp, HDtracks etc.. Uses existing URL relationships when present, otherwise searches for release online using several methods.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+DQogIDx0aXRsZT5NQiBQbGF0Zm9ybSBDaGVjazwvdGl0bGU+CiAgDQogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzJhMWE1MiIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiPg0KICAgIDxwYXRoIGQ9Ik00MCA4OCBBMzQgMzQgMCAwIDEgNDAgNDAiLz4NCiAgICA8cGF0aCBkPSJNMjkgOTkgQTUwIDUwIDAgMCAxIDI5IDI5Ii8+DQogICAgPHBhdGggZD0iTTg4IDg4IEEzNCAzNCAwIDAgMCA4OCA0MCIvPg0KICAgIDxwYXRoIGQ9Ik05OSA5OSBBNTAgNTAgMCAwIDAgOTkgMjkiLz4NCiAgPC9nPg0KICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSIyMCIgZmlsbD0iI2U4MjAxYSIvPg0KPC9zdmc+DQo=
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/platform_check/README.md
// @match        https://*.musicbrainz.org/release/*
// @match        https://*.musicbrainz.org/release-group/*/edit
// @match        https://*.musicbrainz.org/release-group/*/edit-relationships
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
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
// @connect      openapi.tidal.com
// @connect      auth.tidal.com
// @connect      volumo.com
// @connect      www.qobuz.com
// @connect      qobuz.com
// @connect      hdtracks.azurewebsites.net
// @connect      api.beatport.com
// @connect      sambl.lioncat6.com
// @connect      *
// ==/UserScript==
(function () {
'use strict';

// MusicBrainz origin of the current page (musicbrainz.org or beta.musicbrainz.org),
// so the script's own MB API calls + edit-page links stay on the same server.
const MB_ORIGIN = location.origin;

// ─── Release editor sub-pages (/edit, /edit-relationships) ────────────────
// + click on /release stashes OK URLs in `pc:pending:<mbid>` and opens the
// release's /edit page. We fill the "Add another link" input then set the
// type chooser in the next-sibling <tr.relationship-item>'s <select.link-type>.
if (/\/release\/[0-9a-f-]{36}\/edit(?:[?#/]|$)/.test(window.location.pathname)) {
    runInjectHelper('release');
    return;
}
if (/\/release-group\/[0-9a-f-]{36}\/edit(?:[?#/]|$)/.test(window.location.pathname)) {
    runInjectHelper('release-group');
    return;
}

// Safe setTimeout wrapper.  Firefox throws NS_ERROR_NOT_INITIALIZED from
// setTimeout when the script context is being torn down — the Promise
// constructor turns that into an unhandled rejection that aborts everything.
// Catch + fall back to a requestAnimationFrame-driven busy wait so the
// caller still gets a real time delay (not a zero-delay microtask burst
// that would make polling loops exit instantly with "never appeared").
function pcWait(ms) {
    return new Promise(resolve => {
        try { setTimeout(resolve, ms); return; } catch (_) {}
        // Fallback: RAF-based wait. Each frame is ~16ms; loop until elapsed.
        const start = Date.now();
        const tick = () => {
            if (Date.now() - start >= ms) { resolve(); return; }
            try { requestAnimationFrame(tick); }
            catch (_) { resolve(); }
        };
        tick();
    });
}

// MutationObserver-backed waiter — resolves the moment `predicate()`
// returns truthy, falls back to a slow poll if observers aren't usable.
// Safer than fixed-cadence polling because it doesn't rely on setTimeout
// running on time, and it picks up the target as soon as MB inserts it.
function pcWaitFor(predicate, timeoutMs = 10000) {
    return new Promise(resolve => {
        const found = predicate();
        if (found) return resolve(found);
        let done = false;
        const finish = result => { if (done) return; done = true; obs?.disconnect(); resolve(result); };
        let obs = null;
        try {
            obs = new MutationObserver(() => {
                const r = predicate();
                if (r) finish(r);
            });
            obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        } catch (_) { /* observer broken — rely on RAF poll below */ }
        const start = Date.now();
        const poll = () => {
            if (done) return;
            const r = predicate();
            if (r) return finish(r);
            if (Date.now() - start >= timeoutMs) return finish(null);
            try { requestAnimationFrame(poll); }
            catch (_) { try { setTimeout(poll, 100); } catch (_) { finish(null); } }
        };
        poll();
    });
}

async function runInjectHelper(entityType) {
    try {
        const re   = new RegExp(`/${entityType}/([0-9a-f-]{36})`);
        const mbid = (window.location.pathname.match(re) || [])[1];
        if (!mbid) return;
        const key  = entityType === 'release-group' ? `pc:pending:rg:${mbid}` : `pc:pending:${mbid}`;
        const raw  = GM_getValue(key, null);
        // No pending payload means the user navigated to /edit themselves,
        // not via the panel's + button. Stay silent — banner noise on every
        // direct edit-page visit is worse than the diagnostic value (the
        // 2nd-click-doesn't-work bug it was diagnosing has been fixed).
        if (!raw) return;
        let pending;
        try { pending = JSON.parse(raw); }
        catch (e) {
            showInjectBanner(`Platform Check: pending payload not JSON: ${e.message}`, [], { fail: true });
            return;
        }
        const urls = Object.values(pending || {}).filter(Boolean);
        if (urls.length === 0) return;
        const tab = [...document.querySelectorAll('a, button, li')].find(el => /^external\s+links$/i.test(el.textContent?.trim() || ''));
        if (tab) tab.click();
        await pcWait(200);
        await injectInto(urls, key);
    } catch (e) {
        // Last-resort surface so the user sees *something* on the page when
        // a Firefox-specific exception kills the inject path silently.
        try {
            showInjectBanner(`Platform Check: inject helper crashed — ${e.name || 'Error'}: ${e.message || e}`, [], { fail: true });
        } catch (_) { /* nothing else we can do here */ }
    }
}

function findAddLinkInput() {
    // /release/<mbid>/edit uses placeholder "Add another link".
    // /release-group/<rg>/edit uses placeholder "Add link" (no "another").
    const all = [...document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    return all.find(i => RE.test((i.placeholder || '').trim()) && !i.value)
        || all.find(i => RE.test((i.placeholder || '').trim()))
        || null;
}

async function injectInto(urls, storageKey) {
    // Force-type providers: MB's URL auto-classifier leaves the type empty
    // for Apple Music + Bandcamp ("Please select a link type" warning). Map
    // host pattern → ordered list of preferred link_type_ids. We pick the
    // first one whose value actually appears as an <option> in the row's
    // <select.link-type>, because MB's chooser only offers types that are
    // applicable to that URL host (Apple Music offers 980 'streaming page'
    // but not 85; Bandcamp offers 85 'stream for free' but not 980). IDs
    // verified live on MB via probe. Inline-local because the IIFE's
    // early-return path calls injectInto before any module-level const
    // after the return is initialised (temporal dead zone).
    const TYPE_FORCE = [
        { test: u => /music\.apple\.com\/.*\/album\//i.test(u),     ids: ['980', '85'], name: 'streaming page' },
        { test: u => /[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u), ids: ['85', '980'], name: 'stream for free' },
        // HDtracks (MBS-9023) and Volumo have no dedicated MB link type, so MB's
        // classifier leaves both blank on insert. Both are paid download stores →
        // 74 'purchase for download' (verified live: MB auto-types Deezer/Spotify/
        // Tidal/Beatport but leaves hdtracks.com and volumo.com unset).
        { test: u => /hdtracks\.com\//i.test(u),                    ids: ['74'],        name: 'purchase for download' },
        { test: u => /volumo\.com\/album\//i.test(u),               ids: ['74'],        name: 'purchase for download' },
        // Qobuz: MB's URLCleanup recognises it but allows BOTH 'purchase for download'
        // and 'streaming page' (paid) — so MB can't auto-pick one and leaves the type
        // blank ("Please select a link type", chaban-mb #201). Qobuz is a hi-res download
        // store first (like HDtracks/Volumo), so prefer 74; fall back to 980 if that's the
        // only one MB offers for the row.
        { test: u => /qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\//i.test(u), ids: ['74', '980'], name: 'purchase for download' },
    ];
    const wait = pcWait;
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const setSel = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    const reports = [];
    let injected = 0;

    for (const rawUrl of urls) {
        // #353 Qobuz: insert the canonical id-only open.qobuz.com/album/<id> form (what MB/Harmony
        // use) instead of the verbose www.qobuz.com/<locale>/album/<slug>/<id> the scanner resolves.
        const qm = String(rawUrl).match(/qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/?#]+\/)?([a-z0-9]+)/i);
        const url = qm ? `https://open.qobuz.com/album/${qm[1]}` : rawUrl;
        // MutationObserver-backed wait — resolves the moment MB renders an
        // empty "Add another link" input, regardless of how long the page
        // takes to mount the External Links section.
        const input = await pcWaitFor(findAddLinkInput, 10000);
        if (!input) { reports.push({ url, ok: false, miss: 'no "Add another link" input ever appeared' }); break; }

        input.focus();
        setVal.call(input, url);
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', bubbles: true }));
        input.blur();
        injected++;

        // Wait for the URL row + type row to materialise.
        const appleId = url.match(/music\.apple\.com\/[^/]+\/album\/(?:[^/?#]+\/)?(\d+)\b/)?.[1];
        const matchRowByUrl = r => {
            const a = r.querySelector('a[href]');
            const h = a?.getAttribute('href') || '';
            return h === url || (appleId && new RegExp(`/album/(?:[^/]+/)?${appleId}\\b`).test(h));
        };
        const urlRow = await pcWaitFor(() => [...document.querySelectorAll('tr.external-link-item')].find(matchRowByUrl), 5000);
        if (!urlRow) { reports.push({ url, ok: false, miss: 'URL row never appeared after Enter' }); continue; }

        // Type-force if applicable.  The Type chooser lives in the NEXT
        // sibling <tr.relationship-item> (verified live on MB).
        const force = TYPE_FORCE.find(t => t.test(url));
        if (!force) { reports.push({ url, ok: true, note: 'auto-typed' }); continue; }

        const typeRow = await pcWaitFor(() => {
            const s = urlRow.nextElementSibling;
            return (s && s.classList?.contains('relationship-item')) ? s : null;
        }, 3000);
        const select = typeRow?.querySelector('select.link-type');
        if (!select) {
            reports.push({ url, ok: false, miss: `no <select.link-type> in next sibling (got ${typeRow?.tagName}.${typeRow?.className || ''})` });
            continue;
        }
        const opt = force.ids.map(id => [...select.options].find(o => o.value === id)).find(Boolean);
        if (!opt) {
            const optsList = [...select.options].map(o => `${o.value}=${o.textContent.trim()}`).join(', ').slice(0, 400);
            reports.push({ url, ok: false, miss: `none of ids=[${force.ids.join(',')}] in options. Options: ${optsList}` });
            continue;
        }
        setSel.call(select, opt.value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        reports.push({ url, ok: true, type: opt.textContent.trim(), linkTypeId: opt.value });
    }

    if (injected > 0) GM_setValue(storageKey, null);
    // Set the edit note (as the script used to), and report the result quietly
    // inline next to the External links heading instead of a centred popup.
    const okUrls = reports.filter(r => r.ok).map(r => r.url);
    if (okUrls.length) setEditNote(pcEditNote(okUrls));
    showInlineSummary(reports);
}

// Build the edit note: a header line (name/version/author/homepage from GM_info,
// with fallbacks) + the links that were added — same shape as the other scripts.
function pcEditNote(urls) {
    const s = (typeof GM_info !== 'undefined' && GM_info.script) || {};
    const homepage = s.homepageURL || s.homepage ||
        'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/platform_check/README.md';
    const header = (s.name || 'MB Platform Check') + ' v' + (s.version || '?') +
        ' by ' + (s.author || 'majkinetor') + ' - ' + homepage;
    // Record the link-confidence settings that gated which links were added, so a reviewer can see why
    // (e.g. strict barcode/format withholding). Lists each enabled check with its mode; 'off' when none.
    const modeWord = k => GM_getValue(k, 'exists') === 'strict' ? 'strictly' : 'if they exist';
    const conf = [];
    if (GM_getValue('pc:respect-format', true))  conf.push('formats ' + modeWord('pc:format-mode'));
    if (GM_getValue('pc:respect-barcode', true)) conf.push('barcodes ' + modeWord('pc:barcode-mode'));
    const confLine = 'Link confidence: ' + (conf.length ? conf.join(', ') : 'off');
    const lines = [header, confLine, '', 'Added ' + urls.length + ' external link' + (urls.length === 1 ? '' : 's') + ':'];
    urls.forEach(u => lines.push(u));
    return lines.join('\n');
}

// Fill MB's edit-note textarea via the native setter so React picks it up.
// Appends to anything already typed there.
function setEditNote(text) {
    const ta = document.querySelector(
        'textarea.edit-note, textarea[name="edit-note"], textarea[name="edit_note"], #id-edit-note, .edit-note textarea');
    if (!ta) return false;
    try {
        const setVal = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        const existing = (ta.value || '').trim();
        setVal.call(ta, existing ? existing + '\n' + text : text);
        ta.dispatchEvent(new Event('input',  { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    } catch (_) { return false; }
}

// Quiet inline confirmation placed next to the "External links" heading (replaces
// the old intrusive centred banner). Failures still surface here so nothing's lost.
function showInlineSummary(reports) {
    const ok = reports.filter(r => r.ok).length;
    const fail = reports.length - ok;
    let el = document.getElementById('pc-inline-summary');
    if (!el) {
        el = document.createElement('span');
        el.id = 'pc-inline-summary';
        el.style.cssText = 'margin-left: 10px; font-size: 12px; font-weight: 600; font-family: sans-serif; ' +
            'padding: 1px 8px; border-radius: 10px; vertical-align: middle; display: inline-block;';
    }
    el.style.color      = fail ? '#7B5E00' : '#1B5E20';
    el.style.background = fail ? '#FFF3CD' : '#E8F5E9';
    el.style.border     = '1px solid ' + (fail ? '#FFC107' : '#81C784');
    el.title = reports.map(r => ((r.url || '').replace(/^https?:\/\//, '')) + ' — ' + (r.ok ? 'OK' + (r.type ? ' · ' + r.type : '') : 'FAIL · ' + r.miss)).join('\n');
    el.textContent = '✓ Platform Check added ' + ok + (fail ? ', ' + fail + ' failed' : '') + ' — edit note set, review & Enter edit';
    const re = /^\s*external links\s*$/i;
    const heading = [...document.querySelectorAll('h2, h3, legend, label')].find(h => re.test(h.textContent || ''));
    if (heading) { heading.appendChild(el); return; }
    const tab = [...document.querySelectorAll('a, button, li')].find(h => re.test(h.textContent || ''));
    if (tab) tab.after(el); else document.body.appendChild(el);
}

function showInjectBanner(text, reports = [], opts = {}) {
    document.getElementById('pc-inject-status')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'pc-inject-status';
    const fail = !!opts.fail;
    const palette = fail
        ? { bg: '#FFF8E1', border: '#FFB300', accent: '#7B5E00', title: '#5D4400', tagOk: '#1B5E20', tagFail: '#B71C1C' }
        : { bg: '#E8F5E9', border: '#66BB6A', accent: '#1B5E20', title: '#0E4814', tagOk: '#1B5E20', tagFail: '#B71C1C' };
    overlay.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 999999; padding: 12px 36px 12px 14px; border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px; line-height: 1.4; max-width: 520px; min-width: 280px;
        background: ${palette.bg};
        border: 1px solid ${palette.border};
        color: ${palette.accent};
        box-shadow: 0 6px 20px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.08);`;

    const closeBtn = `<button id="pc-inject-close" type="button" aria-label="Close" style="
        position: absolute; top: 6px; right: 6px;
        width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%;
        background: transparent; color: ${palette.accent}; font-size: 16px; line-height: 1;
        cursor: pointer; opacity: 0.6;">×</button>`;
    let body = `<div style="font-weight: 600; color: ${palette.title}; margin-right: 6px;">${text}</div>`;
    if (reports.length) {
        body += '<ul style="margin: 8px 0 0 0; padding: 0; list-style: none; font-size: 12px;">';
        for (const r of reports) {
            const host = (r.url || '').match(/^https?:\/\/([^/]+)/)?.[1] || '';
            const tail = r.ok
                ? `<span style="color: ${palette.tagOk}; font-weight: 600;">OK</span>${r.type ? ` <span style="color:#555;">· ${r.type}</span>` : ''}${r.note ? ` <span style="color:#888;">· ${r.note}</span>` : ''}`
                : `<span style="color: ${palette.tagFail}; font-weight: 600;">FAIL</span> <span style="color:#555;">· ${r.miss}</span>`;
            body += `<li style="padding: 2px 0; display: flex; gap: 6px;"><span style="color:#888; min-width: 0;">${host}</span><span style="color:#555;">·</span><span style="flex: 1;">${tail}</span></li>`;
        }
        body += '</ul>';
        body += `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid ${palette.border}; font-size: 11px; color: #666;">Remember to set an edit note and click <strong style="color: ${palette.accent};">Enter edit</strong> to save.</div>`;
    }
    overlay.innerHTML = body + closeBtn;
    document.body.appendChild(overlay);
    const close = document.getElementById('pc-inject-close');
    close?.addEventListener('mouseenter', () => { close.style.opacity = '1'; close.style.background = 'rgba(0,0,0,0.06)'; });
    close?.addEventListener('mouseleave', () => { close.style.opacity = '0.6'; close.style.background = 'transparent'; });
    close?.addEventListener('click', () => overlay.remove());
}

// ─── UI ────────────────────────────────────────────────────────────────────
// The dashboard is for a /release/<mbid> page ONLY. Standalone the @match scopes it; in the String
// Theory bundle this script runs on every MB page (Mammoth matches /*), so guard the entity type before
// building any UI — `\/release\/` won't match `/release-group/`, so the RG overview no longer mounts it. (#343)
if (!/^\/release\/[0-9a-f-]{36}/i.test(window.location.pathname)) return;
const sidebar = document.querySelector('#sidebar');
if (!sidebar) return;

const container = document.createElement('div');
container.id = 'mb-pc-panel';
container.className = 'online-search-box';
// min-width:0 + max-width + overflow:hidden so a long, no-wrap meta line (e.g. an
// Apple Music licence string) can't stretch the panel — and the whole sidebar — wide.
container.style.cssText = 'margin-bottom: 12px; padding: 8px 6px; background: #FAF9F6; border: 1px solid #D8D8D8; border-radius: 6px; font-size: 13px; font-family: sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-width: 0; max-width: 100%; box-sizing: border-box; overflow: hidden;';
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
const ALL_PROVIDERS = ['discogs', 'bandcamp', 'spotify', 'apple', 'deezer', 'tidal', 'qobuz', 'beatport', 'volumo', 'hdtracks'];
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
// A provider the user has unchecked in Settings is hidden from the dash, but its
// result may still be cached from an earlier enabled run. Anything that consumes the
// cache (inject +, open-all ↗) must skip disabled providers or it queues/opens links
// for a provider the user turned off. (#255)
const providerEnabled = p => GM_getValue(`prov_${p}`, true);
const PROVIDER_NAME  = { spotify:'Spotify', discogs:'Discogs', bandcamp:'Bandcamp', deezer:'Deezer', apple:'Apple', tidal:'Tidal', qobuz:'Qobuz', beatport:'Beatport', volumo:'Volumo', hdtracks:'HDtracks' };
const PROVIDER_COLOR = { spotify:'#1DB954', discogs:'#222',    bandcamp:'#629AA9', deezer:'#A238FF', apple:'#FA243C', tidal:'#111',  qobuz:'#0070ef', beatport:'#0a8754', volumo:'#7c4dff', hdtracks:'#e63329' };
// Small brand glyphs shown next to each provider name (toggle: pc:show-icons). Spotify / Apple Music /
// Bandcamp are the real marks; Deezer (equalizer) is a clean brand-coloured stand-in. Discogs uses the
// real logo image (same as Credit Hoarder).
const PROVIDER_ICON = {
  spotify:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
  apple:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="#FA243C"><path d="M23.997 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0 0 19.7.165a10.5 10.5 0 0 0-1.565-.15c-.04-.003-.083-.01-.124-.013H5.99c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4C2.006.91 1.042 1.83.477 3.16.285 3.61.185 4.085.114 4.568.058 4.96.026 5.353.014 5.748c0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.773-.6-1.943-1.536-.142-.773.227-1.624 1.038-2.022.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.86.86 0 0 0 .02-.193v-5.443a.756.756 0 0 0-.02-.185c-.04-.16-.16-.26-.324-.258-.18.003-.36.033-.54.052l-1.198.135-2.224.25-1.97.222c-.184.02-.36.107-.477.27-.15.213-.213.45-.213.708l-.002 7.91c0 .306-.024.61-.118.905-.323 1.01-1.082 1.57-2.135 1.66-.43.038-.85-.013-1.247-.197-.795-.367-1.262-1.06-1.275-1.94.005-.823.4-1.494 1.1-1.866.355-.187.74-.272 1.135-.345l1.236-.232c.28-.056.444-.227.495-.51a.948.948 0 0 0 .02-.195V5.852c0-.143.012-.288.04-.428.07-.347.295-.575.65-.66.255-.062.51-.097.77-.13l2.34-.26 2.21-.246c.27-.03.54-.06.81-.087.347-.034.69.247.694.682z"/></svg>',
  bandcamp: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#629AA9"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/></svg>',
  deezer:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="#A238FF"><rect x="1" y="14" width="4" height="6" rx=".6"/><rect x="6.7" y="10" width="4" height="10" rx=".6"/><rect x="12.4" y="6" width="4" height="14" rx=".6"/><rect x="18.1" y="11" width="4" height="9" rx=".6"/></svg>',
  discogs:  '<img src="https://volkerzell.de/favicons/discogs.png" alt="Discogs" width="14" height="14" style="vertical-align:middle;object-fit:contain;">',
  // Tidal: its mark is four interlocking diamonds; Beatport: brand-green disc with a play wedge (clean stand-ins).
  tidal:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="#111"><path d="M6 3l3 3-3 3-3-3zM12 3l3 3-3 3-3-3zM18 3l3 3-3 3-3-3zM12 9l3 3-3 3-3-3z"/></svg>',
  beatport: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#0a8754"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>',
  // Qobuz: brand-blue roundel with a "Q" cut (clean stand-in)
  qobuz:    '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#0070ef"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M14.5 14.5 19 19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  // Volumo: brand-violet disc with a "V" wedge (clean stand-in)
  volumo:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="#7c4dff"><circle cx="12" cy="12" r="10"/><path d="M7 8h2.2l2.8 6 2.8-6H17l-4 9h-2z" fill="#fff"/></svg>',
  // HDtracks: brand-red disc with an "HD" monogram (clean stand-in)
  hdtracks: '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#e63329"/><path d="M5 7.5h1.7v3.1h2.6V7.5H11v8H9.3v-3.2H6.7v3.2H5zm7.2 0h2.9c2 0 3.4 1.6 3.4 4s-1.4 4-3.4 4h-2.9zm1.7 1.5v5h1.1c1.1 0 1.8-1 1.8-2.5s-.7-2.5-1.8-2.5z" fill="#fff"/></svg>',
};
// MusicBrainz mark for the reference row (the release we're comparing platforms
// against). Same logo image Apollo Editor uses for its MB/markdown toggle.
const MB_ICON = '<img alt="MB" src="https://images.dwncdn.net/images/t_app-icon-s/p/c5c33b93-7347-46e3-a512-3decccb33d78/1678792153/2170_4-166444-imgingest-4209519771082272608.png" style="width:17px;height:17px;border-radius:3px;">';
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
  /* icons mode (toggle "Show platform icons"): the brand glyph REPLACES the ✓/×/~ text and carries the
   * state via a per-row class (pc-st-*): RING = already in MB (the only thing a ring means) · full colour =
   * clean match · GRAY icon+name = found but track-count mismatch · faint = not found. Match vs mismatch is
   * also on the right via the count colour. */
  /* fixed-size box (keeps names aligned); NO frame by default — only in-MB draws a blue circle */
  .pc-plat-ico { display: none; align-items: center; justify-content: center; flex: none; width: var(--pc-icon-size, 22px); height: var(--pc-icon-size, 22px); border-radius: 50%; box-sizing: border-box; }
  .pc-plat-ico svg { display: block; width: 100%; height: 100%; }
  #mb-pc-panel.pc-icons-mode .pc-plat-ico { display: inline-flex; }
  #mb-pc-panel.pc-icons-mode .pc-ico-slot { display: none; }
  /* in-MB marker (independent of match/mismatch) — Circle or Glow per the "MB marker" option */
  #mb-pc-panel.pc-icons-mode.pc-mark-circle .pc-inmb .pc-plat-ico { border: 1px solid #3b82c4; padding: 1px; }
  #mb-pc-panel.pc-icons-mode.pc-mark-glow   .pc-inmb .pc-plat-ico { background: radial-gradient(circle, rgba(59,130,196,.6), rgba(59,130,196,0) 70%); }
  /* presence — fades/grays the icon + name regardless of in-MB */
  #mb-pc-panel.pc-icons-mode .pc-st-mismatch .pc-plat-ico svg { filter: grayscale(1); opacity: .6; }  /* found but wrong */
  #mb-pc-panel.pc-icons-mode .pc-st-mismatch a[id^="mb-online"] { color: #999 !important; }
  #mb-pc-panel.pc-icons-mode .pc-st-notfound .pc-plat-ico svg { filter: grayscale(1); opacity: .3; }  /* not found */
  /* Compact unmatched providers (#355): when on, every provider starts compact — a
     strip of dimmed brand icons — and rises into its full row when it matches; the
     unmatched ones stay in the strip (except Discogs/Bandcamp, which always keep their
     full rows). Clicking a strip icon runs that provider's search, like clicking its
     row. Full rows are hidden via a class so the per-provider enable/disable (inline
     display) is left untouched. */
  #mb-pc-panel .pc-row.pc-compacted { display: none !important; }
  /* the strip sits under the full rows with a clear gap; its icons are a touch
     smaller than the row icons (they're a secondary, collapsed representation). */
  .pc-compact-strip { display: none; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; gap: 7px; padding: 1rem 0 1px; }
  #mb-pc-panel .pc-compact-strip.pc-has-icons { display: flex; }
  .pc-compact-ico { display: inline-flex; align-items: center; justify-content: center; width: calc(var(--pc-icon-size, 22px) * 0.8); height: calc(var(--pc-icon-size, 22px) * 0.8); cursor: pointer; border-radius: 50%; box-sizing: border-box; filter: grayscale(1); opacity: .38; transition: opacity .12s, filter .12s; }
  .pc-compact-ico svg, .pc-compact-ico img { display: block; width: 100%; height: 100%; }
  .pc-compact-ico:hover { filter: none; opacity: 1; }
  /* a folded MISMATCH (found but wrong barcode/format) keeps an amber ring so the
     "found but a different release" signal survives the collapse. */
  .pc-compact-ico.pc-compact-mismatch { box-shadow: 0 0 0 2px #e0892a; opacity: .55; }
  /* subtle rise as a provider leaves the strip on a match — a small fade + lift so
     the panel doesn't jump/flash as results stream in. */
  @keyframes pcRise { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
  #mb-pc-panel .pc-row.pc-rise { animation: pcRise .28s ease; }
  /* barcode mismatch (#182): a thin amber bar on the row's left edge — the barcode
     itself is never shown in the dash, only in the row tooltip + the log. */
  #mb-pc-panel .pc-row.pc-barcode-diff { box-shadow: inset 3px 0 0 #e0892a; }
  /* format incompatibility (#182): a thin violet bar; only shown while the
     "Use format for link confidence" option is on. Stacks beside the amber
     barcode bar when a row is both. */
  /* setup panel (#188): section headers + nav-button hovers */
  #mb-provider-modal-card .pc-setup-sec { font-weight: 700; color: #444; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; margin: 14px 0 4px; padding-bottom: 3px; border-bottom: 1px solid #EEE; }
  #mb-provider-modal-card .pc-setup-nav:hover { background: #ECECF1; }
  #mb-provider-modal-card .pc-setup-back:hover { text-decoration: underline; }
  #mb-pc-panel .pc-row.pc-format-diff { box-shadow: inset 3px 0 0 #7e57c2; }
  #mb-pc-panel .pc-row.pc-format-diff.pc-barcode-diff { box-shadow: inset 3px 0 0 #e0892a, inset 6px 0 0 #7e57c2; }
  /* withheld by barcode/format confidence (#182): grayed + non-clickable, so it reads
     as "not added" like other mismatches rather than a clickable ✓ that does nothing. */
  #mb-pc-panel .pc-row.pc-blocked .pc-ico-slot,
  #mb-pc-panel .pc-row.pc-blocked a[id^="mb-online"],
  #mb-pc-panel .pc-row.pc-blocked [id^="val-"] { color: #adadad !important; }
  #mb-pc-panel.pc-icons-mode .pc-row.pc-blocked .pc-plat-ico svg { filter: grayscale(1); opacity: .5; }
  #mb-pc-panel.pc-icons-mode .pc-st-notfound a[id^="mb-online"] { color: #9aa !important; opacity: .6; }
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

  /* ── Row layout (issue #173): compact 1-row vs 2-row stacked ───────────────
   * 1-row packs each provider onto one line: full name, then year · format ·
   * label flowing right after it, with the track count pinned to the right
   * edge. Names stay fully visible (they identify the row); the label is the
   * only thing that truncates (full text in its tooltip). 2-row keeps the
   * legacy stacked look (name line + meta line below). */
  .pc-cell-ico  { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 22px; width: 22px; cursor: default; }
  .pc-cell-ico img { display: block; }
  .pc-cell-name { color: inherit; text-decoration: none; font-weight: 600; font-size: var(--pc-name-size, 12px);
                  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-cell-year, .pc-cell-format, .pc-cell-label {
                  font-size: 10px; color: #999; font-family: sans-serif; white-space: nowrap; overflow: hidden; }
  .pc-cell-label { text-overflow: ellipsis; min-width: 0; }
  /* format-family quadrant marker (#350) — vertically centered against the meta text */
  .pc-cell-format .pc-fmt { vertical-align: -2px; }
  #mb-pc-panel.pc-fmt-text .pc-cell-format .pc-fmt { display: none; }
  #mb-pc-panel:not(.pc-fmt-text) .pc-cell-format .pc-fmt-txt { display: none; }
  .pc-cell-val  { font-size: 12px; font-weight: bold; font-family: monospace; color: #777; text-align: right; }
  .pc-cell-master { font-size: 11px; min-width: 14px; }

  /* 1-row — the ENTIRE provider list is ONE grid (rows are display:contents, so
     every cell becomes a grid item of .pc-rows). Columns are content-sized, so
     they're as wide as their widest cell across all rows and line up as a true
     table — an empty format still reserves its column, so labels start at the
     same x whether or not a row has a format. Order: icon name year format label
     master tracks. */
  #mb-pc-panel.pc-layout-1row .pc-rows {
    display: grid; align-items: center; column-gap: var(--pc-col-gap, 5px); row-gap: var(--pc-row-gap, 5px);
    grid-template-columns: 22px max-content max-content max-content minmax(0,1fr) max-content max-content;
  }
  /* each row is a subgrid box spanning all columns: it shares the parent's
     column tracks (so cells still align as a table) AND is a single element,
     so the whole row — gaps and empty cells included — is one click target. */
  #mb-pc-panel.pc-layout-1row .pc-row {
    display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center;
  }
  #mb-pc-panel.pc-layout-1row .pc-meta { display: contents; }
  #mb-pc-panel.pc-layout-1row .pc-cell-ico    { grid-column: 1; }
  #mb-pc-panel.pc-layout-1row .pc-cell-name   { grid-column: 2; }
  #mb-pc-panel.pc-layout-1row .pc-cell-year   { grid-column: 3; }
  #mb-pc-panel.pc-layout-1row .pc-cell-format { grid-column: 4; }
  #mb-pc-panel.pc-layout-1row .pc-cell-label  { grid-column: 5; min-width: 0; }   /* fills + truncates */
  #mb-pc-panel.pc-layout-1row .pc-cell-master { grid-column: 6; text-align: center; }
  #mb-pc-panel.pc-layout-1row .pc-cell-val    { grid-column: 7; }
  #mb-pc-panel.pc-layout-1row .pc-rows-sep    { grid-column: 1 / -1; border-bottom: 1px solid #EEE; }

  /* 2-row — legacy stacked look: name line, then a meta line below */
  #mb-pc-panel.pc-layout-2row .pc-rows { display: flex; flex-direction: column; gap: var(--pc-row-gap, 5px); }
  #mb-pc-panel.pc-layout-2row .pc-rows-sep { border-bottom: 1px solid #EEE; }
  #mb-pc-panel.pc-layout-2row .pc-row {
    display: grid; align-items: center; column-gap: 4px;
    grid-template-columns: 22px minmax(0,1fr) auto 24px;
  }
  #mb-pc-panel.pc-layout-2row .pc-cell-ico    { grid-area: 1 / 1; }
  #mb-pc-panel.pc-layout-2row .pc-cell-name   { grid-area: 1 / 2; }
  #mb-pc-panel.pc-layout-2row .pc-cell-master { grid-area: 1 / 3; text-align: center; }
  #mb-pc-panel.pc-layout-2row .pc-cell-val    { grid-area: 1 / 4; }
  #mb-pc-panel.pc-layout-2row .pc-meta {
    grid-column: 2 / -1; grid-row: 2; line-height: 1.2; padding-top: 0.3rem;
    font-size: 10px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
  }
  #mb-pc-panel.pc-layout-2row .pc-meta .pc-cell-year,
  #mb-pc-panel.pc-layout-2row .pc-meta .pc-cell-format,
  #mb-pc-panel.pc-layout-2row .pc-meta .pc-cell-label { display: inline; }
  #mb-pc-panel.pc-layout-2row .pc-meta .pc-cell-year:not(:empty),
  #mb-pc-panel.pc-layout-2row .pc-meta .pc-cell-format:not(:empty) { margin-right: 4px; }

  /* names toggle (pc:show-names) */
  #mb-pc-panel.pc-no-names .pc-cell-name { display: none; }
  /* MusicBrainz reference row: always visible mark + brand-violet name, no fade */
  #mb-pc-panel .pc-row-mb .pc-plat-ico { display: inline-flex; }
</style>
<div style="margin-bottom: 6px;">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 4px;">
      <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #666;">Platform Check</h3>
      <span id="mb-refresh-btn" class="pc-icon-btn" title="Refresh — clear cache and re-scan" style="${iconBtn}">↻</span>
    </div>
  </div>
</div>
<div class="pc-rows" style="margin-bottom: 6px;">
  <div id="row-mb" class="pc-row pc-row-mb">
    <span class="pc-cell-ico"><span class="pc-plat-ico" title="MusicBrainz">${MB_ICON}</span></span>
    <a id="mb-mb-name" class="pc-cell-name" href="${MB_ORIGIN}/release/" target="_blank" rel="noopener" title="MusicBrainz" style="color: #BA68C8;">MB</a>
    <span class="pc-meta">
      <span id="mb-mb-year"   class="pc-cell-year"></span>
      <span id="mb-mb-format" class="pc-cell-format"></span>
      <span id="mb-mb-label"  class="pc-cell-label"></span>
    </span>
    <span class="pc-cell-master"></span>
    <span id="mb-mb-tracks" class="pc-cell-val" style="color: #FF8C00;"></span>
  </div>
  <div class="pc-rows-sep"></div>
  ${PROVIDER_ORDER.map(p => `
  <div id="row-${p}" class="pc-row pc-st-notfound">
    <span class="pc-cell-ico">
      <span id="ico-${p}" class="pc-ico-slot" style="font-size: 11px; text-align: center; color: #888;">⚪</span>
      <span id="plat-${p}" class="pc-plat-ico" title="${PROVIDER_NAME[p]}">${PROVIDER_ICON[p] || ''}</span>
    </span>
    <a id="mb-online-${p}" class="pc-cell-name" href="#" target="_blank" rel="noopener" style="color: ${PROVIDER_COLOR[p] || '#222'};">${PROVIDER_NAME[p]}</a>
    <span class="pc-meta">
      <span id="year-${p}"   class="pc-cell-year"></span>
      <span id="format-${p}" class="pc-cell-format"></span>
      <span id="label-${p}"  class="pc-cell-label"></span>
    </span>
    <span id="master-${p}" class="pc-master-slot pc-cell-master" style="cursor: default;"></span>
    <span id="val-${p}" class="pc-cell-val">—</span>
  </div>`).join('')}
  <div id="pc-compact-strip" class="pc-compact-strip"></div>
</div>
<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #EEE;">
  <div style="display: flex; align-items: center; gap: 6px;">
    <span id="mb-inject-btn"      class="pc-icon-btn" title="Open the release editor and queue OK URLs to add" style="${iconBtn}">+</span>
    <span id="mb-openall-btn"     class="pc-icon-btn" title="Open found platform pages not yet in MB (non-circled) in new tabs" style="${iconBtn}">↗</span>
  </div>
  <div style="display: flex; align-items: center; gap: 6px;">
    <span id="mb-log-open-btn"    class="pc-icon-btn" title="Diagnostic log" style="${iconBtn} font-size: 11px;">log</span>
    <span id="mb-token-setup-btn" class="pc-icon-btn" title="Settings" style="${iconBtn}">⚙︎</span>
  </div>
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
const LOG_SOURCES = ['System', 'MusicBrainz', 'Wikidata', 'SAMBL', 'Spotify', 'Discogs', 'Bandcamp', 'Deezer', 'Apple', 'Tidal', 'Qobuz', 'Beatport', 'Volumo', 'HDtracks'];
const LOG_SOURCE_COLORS = {
    System: '#999', MusicBrainz: '#BA68C8', Wikidata: '#FFD54F', SAMBL: '#4FC3F7',
    Spotify: '#1DB954', Discogs: '#E0E0E0', Bandcamp: '#629AA9', Deezer: '#A238FF', Apple: '#FA243C',
    Tidal: '#CCC', Qobuz: '#5b9bff', Beatport: '#3AD17A', Volumo: '#b39dff', HDtracks: '#f08a84',
};
logModal.innerHTML = `
<style>
  .pc-log-chip { display: inline-block; padding: 3px 9px; margin-right: 4px; border-radius: 12px; font-size: 11px; font-weight: bold; cursor: pointer; user-select: none; border: 1px solid #444; }
  .pc-log-chip.off { opacity: 0.35; background: transparent !important; color: #AAA !important; }
  ${LOG_SOURCES.map(s => `#mb-finder-log-panel.pc-hide-${s.toLowerCase()} [data-platform="${s.toLowerCase()}"] { display: none; }`).join('\n  ')}
  /* MOBILE / NARROW VIEWPORTS — both Platform Check modals live on <body>, so
     these rules are global. The log modal trims its 30px overlay padding and
     wraps its header (title + Copy on top, source chips below) to use the full
     width; the setup modal drops its fixed 420px width to fit a phone. */
  @media (max-width: 640px) {
    #mb-log-modal-overlay { padding: 8px !important; }
    #mb-log-modal-card { max-width: 100% !important; height: 92vh !important; }
    #mb-log-modal-card > div:first-child { flex-wrap: wrap !important; gap: 8px !important; }
    #mb-log-filters { order: 3; flex-basis: 100% !important; flex-grow: 0 !important; }
    #mb-modal-copy-btn { margin-left: auto; }
    .pc-log-chip { margin-bottom: 4px; }

    #mb-provider-modal-card { width: auto !important; left: 8px !important; right: 8px !important;
      transform: translateY(-50%) !important; max-height: 92vh !important; overflow-y: auto !important;
      padding: 18px !important; box-sizing: border-box !important; }
  }
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
providerModal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: transparent; z-index: 100000; font-family: sans-serif;';
providerModal.innerHTML = `
<div id="mb-provider-modal-card" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 420px; background: #FFF; padding: 20px 22px; border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid #DDD; font-size: 13px; color: #333;">
  <div style="display: flex; align-items: baseline; gap: 8px; border-bottom: 1px solid #EEE; padding-bottom: 10px;">
    <h2 style="margin: 0; font-size: 18px; color: #FF8C00;">Platform Check</h2>
    <span title="installed script version" style="font-size: 11px; color: #999; font-weight: normal;">v${(typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '?'}</span>
    <a href="https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/platform_check#readme" target="_blank" rel="noopener" title="Open the README in a new tab" style="margin-left: auto; font-size: 12px; font-weight: bold; color: #1DB954; text-decoration: none; border: 1px solid #cfe9d6; border-radius: 4px; padding: 1px 8px;">? Help</a>
  </div>

  <!-- ───────── MAIN view ───────── -->
  <div id="mb-setup-main">
    <div style="display: flex; gap: 8px; margin: 14px 0 4px;">
      <button class="pc-setup-nav" id="mb-view-order" type="button" style="flex: 1; text-align: left; padding: 8px 10px; background: #F5F5F7; border: 1px solid #E3E3E8; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px;">⋮⋮ <b>Platforms</b><span style="margin-left: auto; color: #999;">›</span></button>
      <button class="pc-setup-nav" id="mb-view-auth" type="button" style="flex: 1; text-align: left; padding: 8px 10px; background: #F5F5F7; border: 1px solid #E3E3E8; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px;">🔑 <b>Authentication</b><span id="mb-auth-badge" style="margin-left: auto; color: #999;">›</span></button>
    </div>

    <div class="pc-setup-sec">Link confidence</div>
    <div style="padding: 2px 4px;">
      <div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
        <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;" title="When on, found links whose format is incompatible with MB's (e.g. a Digital-only platform on a CD release) are withheld from + / ↗. Digital-only platforms (Spotify, Apple, Tidal…) count as Digital; Bandcamp/Discogs use their actual format. A subtle violet left bar marks mismatches.">
          <input type="checkbox" id="mb-respect-format" style="margin: 0; width: 16px; height: 16px;"> Use <b>formats</b></label>
        <select id="mb-format-mode" style="font-size: 12px; padding: 1px 3px;" title="strictly: also withhold links whose format can't be determined. · if they exist: only withhold links whose format is known and incompatible.">
          <option value="exists">if they exist</option><option value="strict">strictly</option></select>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
        <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;" title="When on, found links whose barcode doesn't match MB's are withheld from + / ↗ (MB treats a different barcode as a different release). A subtle amber left bar marks known mismatches regardless of this setting.">
          <input type="checkbox" id="mb-respect-barcode" style="margin: 0; width: 16px; height: 16px;"> Use <b>barcodes</b></label>
        <select id="mb-barcode-mode" style="font-size: 12px; padding: 1px 3px;" title="strictly: only add barcode-confirmed links (also withholds links whose barcode can't be checked, e.g. Apple/Spotify). · if they exist: only withhold links whose barcode is known and differs.">
          <option value="exists">if they exist</option><option value="strict">strictly</option></select>
      </div>
    </div>

    <div class="pc-setup-sec">Appearance</div>
    <div style="padding: 2px 4px;">
      <div style="font-weight: 600; color: #555; margin: 4px 0 2px;">Platform</div>
      <div style="padding-left: 14px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 4px 0;">
          <input type="checkbox" id="mb-show-icons" style="margin: 0; width: 16px; height: 16px;"><span style="min-width: 44px;">Icon</span>
          <span style="color: #888; font-size: 12px;">Size</span><input type="range" id="mb-icon-size" min="14" max="30" step="1" style="flex: 1; min-width: 0; margin: 0;"><span id="mb-icon-size-val" style="min-width: 18px; text-align: right; color: #666;"></span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 4px 0;">
          <input type="checkbox" id="mb-show-names" style="margin: 0; width: 16px; height: 16px;"><span style="min-width: 44px;">Name</span>
          <span style="color: #888; font-size: 12px;">Size</span><input type="range" id="mb-name-size" min="8" max="14" step="1" style="flex: 1; min-width: 0; margin: 0;"><span id="mb-name-size-val" style="min-width: 18px; text-align: right; color: #666;"></span>
        </label>
      </div>

      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 9px 0 4px;" title="Start every provider compact in a strip of dimmed icons; each rises into a full row when it matches. Discogs and Bandcamp always stay full rows. Click a strip icon to search that platform, just like clicking its row.">
        <input type="checkbox" id="mb-compact-unmatched" style="margin: 0; width: 16px; height: 16px;"> Compact <b>unmatched</b> providers</label>

      <div style="display: flex; align-items: center; gap: 12px; margin: 9px 0 4px;">
        <span style="font-weight: 600; color: #555;">MB marker</span>
        <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;"><input type="radio" name="mb-marker" value="circle" style="margin: 0;"> Circle</label>
        <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;"><input type="radio" name="mb-marker" value="glow" style="margin: 0;"> Glow</label>
      </div>

      <div style="display: flex; align-items: center; gap: 12px; margin: 4px 0;" title="Show each release's format as a compact 4-quadrant circle (Vinyl · Cassette · CD · Digital) or as text.">
        <span style="font-weight: 600; color: #555;">Format marker</span>
        <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;"><input type="radio" name="format-marker" value="circle" style="margin: 0;"> Circle</label>
        <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;"><input type="radio" name="format-marker" value="text" style="margin: 0;"> Text</label>
      </div>

      <div style="font-weight: 600; color: #555; margin: 8px 0 2px;">Layout</div>
      <div style="padding-left: 14px;">
        <div style="display: flex; align-items: center; gap: 12px; margin: 4px 0;">
          <span style="min-width: 44px;">Rows</span>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;"><input type="radio" name="mb-layout" value="1row" style="margin: 0;"> 1 row</label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;"><input type="radio" name="mb-layout" value="2row" style="margin: 0;"> 2 rows</label>
        </div>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 4px 0;">
          <span style="min-width: 44px;">Gap</span><span style="color: #888; font-size: 12px;">row</span>
          <input type="range" id="mb-row-gap" min="0" max="10" step="1" style="flex: 1; min-width: 0; margin: 0;"><span id="mb-row-gap-val" style="min-width: 14px; text-align: right; color: #666;"></span>
          <span style="color: #888; font-size: 12px;" title="Column gap is only used in the 1-row layout">col</span>
          <input type="range" id="mb-col-gap" min="0" max="10" step="1" style="flex: 1; min-width: 0; margin: 0;"><span id="mb-col-gap-val" style="min-width: 14px; text-align: right; color: #666;"></span>
        </label>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
      <button id="mb-provider-close-btn" style="padding: 8px 16px; background: #1DB954; border: none; border-radius: 4px; font-size: 13px; color: #FFF; cursor: pointer;">Close</button>
    </div>
  </div>

  <!-- ───────── ORDER & VISIBILITY sub-view ───────── -->
  <div id="mb-setup-order" style="display: none;">
    <div class="pc-setup-sec" style="margin-top: 14px; display: flex; align-items: center;">Platforms<button class="pc-setup-back" type="button" style="margin-left: auto; padding: 0; background: none; border: none; color: #1DB954; font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0; cursor: pointer;">‹ Back</button></div>
    <p style="font-size: 12px; color: #888; margin: 4px 0 10px;">Drag to reorder; uncheck to skip a service. All results come from public endpoints.</p>
    <div id="mb-provider-list">
    ${PROVIDER_ORDER.map(p => `
      <div class="pc-prov-row" data-provider="${p}" draggable="true" style="display: flex; align-items: center; margin-bottom: 2px; font-size: 13px; padding: 4px 8px; border-radius: 4px; background: #FAFAFA; border: 1px solid transparent; cursor: grab; user-select: none;">
        <span class="pc-prov-grip" style="color: #BBB; font-size: 14px; margin-right: 8px; letter-spacing: -2px;" title="Drag to reorder">⋮⋮</span>
        <input type="checkbox" id="mb-toggle-${p}" checked style="margin: 0 10px 0 0; width: 15px; height: 15px;">
        <span style="font-weight: 500; flex-grow: 1;">${PROVIDER_NAME[p]}</span>
      </div>`).join('')}
    </div>
  </div>

  <!-- ───────── AUTH sub-view ───────── -->
  <div id="mb-setup-auth" style="display: none;">
    <div class="pc-setup-sec" style="margin-top: 14px; display: flex; align-items: center;">Authentication<button class="pc-setup-back" type="button" style="margin-left: auto; padding: 0; background: none; border: none; color: #1DB954; font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0; cursor: pointer;">‹ Back</button></div>
    <div id="mb-bp-acct" style="padding: 4px;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333;">
        <span style="font-weight: 600;">Beatport account</span>
        <span id="mb-bp-status" style="font-size: 11px; color: #999; margin-left: auto;"></span>
      </div>
      <div style="font-size: 11px; color: #999; margin: 3px 0 7px;">Optional — enables <b>verified</b> Beatport matching (and the + insert) and lets ISRC Scout import Beatport ISRCs. Only the login token is stored, never your password.</div>
      <div id="mb-bp-form" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
        <input id="mb-bp-user" type="text" placeholder="email / username" autocomplete="off" style="flex: 1 1 120px; min-width: 0; padding: 6px 8px; border: 1px solid #CCC; border-radius: 4px; font-size: 12px;">
        <input id="mb-bp-pass" type="password" placeholder="password" autocomplete="off" style="flex: 1 1 100px; min-width: 0; padding: 6px 8px; border: 1px solid #CCC; border-radius: 4px; font-size: 12px;">
        <button id="mb-bp-login" style="padding: 6px 12px; background: #0a8754; border: none; border-radius: 4px; color: #FFF; font-size: 12px; cursor: pointer;">Log in</button>
      </div>
      <button id="mb-bp-logout" style="display: none; padding: 5px 12px; background: #E0E0E0; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-top: 6px;">Sign out</button>
    </div>
    <div id="mb-qb-acct" style="padding: 4px; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333;">
        <span style="font-weight: 600;">Qobuz account</span>
        <span id="mb-qb-status" style="font-size: 11px; color: #999; margin-left: auto;"></span>
      </div>
      <div style="font-size: 11px; color: #999; margin: 3px 0 7px;">Optional — unlocks Qobuz's session-gated API: <b>reliable</b> Qobuz matching here (track count + barcode via <code>album/get</code>, no store-page scrape), plus Qobuz ISRC import in ISRC Scout and roled Qobuz credits in Credit Hoarder. Only the login token is stored, never your password.</div>
      <div id="mb-qb-form" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
        <input id="mb-qb-user" type="text" placeholder="email" autocomplete="off" style="flex: 1 1 120px; min-width: 0; padding: 6px 8px; border: 1px solid #CCC; border-radius: 4px; font-size: 12px;">
        <input id="mb-qb-pass" type="password" placeholder="password" autocomplete="off" style="flex: 1 1 100px; min-width: 0; padding: 6px 8px; border: 1px solid #CCC; border-radius: 4px; font-size: 12px;">
        <button id="mb-qb-login" style="padding: 6px 12px; background: #0070ef; border: none; border-radius: 4px; color: #FFF; font-size: 12px; cursor: pointer;">Log in</button>
      </div>
      <button id="mb-qb-logout" style="display: none; padding: 5px 12px; background: #E0E0E0; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-top: 6px;">Sign out</button>
    </div>
  </div>
</div>`;

document.body.appendChild(logModal);
document.body.appendChild(providerModal);
const coverArt = sidebar.querySelector('.cover-art');
if (coverArt) sidebar.insertBefore(container, coverArt);
else sidebar.prepend(container);
// Belt-and-suspenders: pin the panel to the sidebar's natural width *now* — measured
// synchronously, before the async scans fill in long meta lines AND before the cover
// art <img> finishes loading — so a content-sized sidebar can't later be stretched
// wide by either. (Measuring later would risk capturing an already-widened sidebar.)
const naturalW = sidebar.clientWidth;
// #355: pin a STABLE width (not just a max) so the panel doesn't visibly grow/reflow
// as async scan results stream longer meta lines in — the "epileptic" resize. At the
// sidebar's full width the panel starts at its final size; the label column
// (minmax(0,1fr) + ellipsis) absorbs long text instead of widening the box.
if (naturalW > 40) { container.style.maxWidth = naturalW + 'px'; container.style.width = naturalW + 'px'; }

const logPanel = document.getElementById('mb-finder-log-panel');
const providerRows = Object.fromEntries(PROVIDER_ORDER.map(p => [p, document.getElementById(`row-${p}`)]));

PROVIDER_ORDER.forEach(p => {
    const enabled = GM_getValue(`prov_${p}`, true);
    if (providerRows[p]) providerRows[p].style.display = enabled ? '' : 'none';   // '' → CSS grid layout applies
});
// platform brand icons (default on) — class on the panel hides them all via CSS
container.classList.toggle('pc-icons-mode', GM_getValue('pc:show-icons', true));
container.classList.toggle('pc-compact-unmatched', GM_getValue('pc:compact-unmatched', true));   // #355 (on by default)
container.classList.toggle('pc-no-names', !GM_getValue('pc:show-names', false));   // names hidden by default (#173) — the brand icon identifies the row
// row layout — 1-row aligned grid (default) vs 2-row stacked (issue #173)
container.classList.add(GM_getValue('pc:layout', '1row') === '2row' ? 'pc-layout-2row' : 'pc-layout-1row');
container.classList.add(GM_getValue('pc:mb-marker', 'circle') === 'glow' ? 'pc-mark-glow' : 'pc-mark-circle');   // how the in-MB marker is drawn
container.classList.toggle('pc-fmt-text', GM_getValue('pc:format-marker', 'circle') === 'text');   // format as text instead of the quadrant circle
// compact-view spacing + name font size (#178) — applied as CSS variables the
// layout rules read (row/column gap in 1-row, row gap = flex gap in 2-row).
container.style.setProperty('--pc-row-gap',  `${GM_getValue('pc:row-gap', 5)}px`);
container.style.setProperty('--pc-col-gap',  `${GM_getValue('pc:col-gap', 5)}px`);
container.style.setProperty('--pc-name-size', `${GM_getValue('pc:name-size', 12)}px`);
container.style.setProperty('--pc-icon-size', `${GM_getValue('pc:icon-size', 22)}px`);   // #188 platform icon size
refreshCompactStrip();   // #355: start everything compact (rows rise out as they match)

// Provider-reorder controls in the providers modal — drag-and-drop. Each row
// is draggable; dragover on a sibling reorders via the cursor's Y-midpoint
// (above-mid = insert before, below-mid = insert after). Save reads the
// resulting DOM order, persists to pc:provider-order, and reloads so the
// sidebar re-renders rows in the new sequence.
{
    let dragged = null;
    const list = providerModal.querySelector('#mb-provider-list');
    // Persist the modal's current row order and reorder the sidebar rows LIVE —
    // no page reload (#175). Moving the (display:contents) row divs reorders
    // their cells in the grid; row-mb + the separator stay pinned at the top.
    const commitProviderOrder = () => {
        const order = [...list.querySelectorAll('.pc-prov-row')].map(r => r.dataset.provider);
        GM_setValue('pc:provider-order', JSON.stringify(order));
        const rowsContainer = container.querySelector('.pc-rows');
        if (rowsContainer) order.forEach(p => { if (providerRows[p]) rowsContainer.appendChild(providerRows[p]); });
    };
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
            commitProviderOrder();
        });
    }
}

// Pin a modal to the VISUAL viewport on narrow/zoomed screens. On tablets where
// MusicBrainz's desktop layout overflows the browser's layout viewport, the page
// overflows and the browser zooms to fit; a position:fixed modal is then anchored
// to the narrow layout viewport and lands in a corner. window.visualViewport
// reflects what's actually on screen (zoom scale + offset), so we size the overlay
// to it and centre the card within it. No-op on desktop / without VisualViewport.
const logCardEl = () => document.getElementById('mb-log-modal-card');
const provCardEl = () => document.getElementById('mb-provider-modal-card');
let _pcActive = null, _pcVVSync = null;
// The overlay + card keep their base layout (width:100vw, top/left, the card's
// centering + width) in their INLINE cssText. Pinning overrides a subset of those
// with !important, so unpinning must RESTORE the base — not removeProperty(), which
// would also delete the base values that share the inline declaration (that bug
// collapsed the modals to a corner on desktop, where pin no-ops straight through
// unpin on the first open). So snapshot cssText once and restore it verbatim.
function pcSnapshotBase(el) { if (el && el._pcBaseCss == null) el._pcBaseCss = el.style.cssText; }
function pcPinModal(overlay, card, maxW, fill) {
    pcSnapshotBase(overlay); pcSnapshotBase(card);
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia('(max-width: 640px)').matches) { pcUnpinModal(overlay, card); return; }
    const imp = (el, o) => { for (const k in o) el.style.setProperty(k, o[k], 'important'); };
    const w = Math.min(vv.width * 0.96, maxW), h = vv.height * 0.96;
    imp(overlay, { left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', width: vv.width + 'px', height: vv.height + 'px', padding: '0' });
    const c = { position: 'fixed', left: (vv.offsetLeft + vv.width / 2) + 'px', top: (vv.offsetTop + vv.height / 2) + 'px',
        transform: 'translate(-50%, -50%)', margin: '0', 'max-width': 'none', width: w + 'px', 'max-height': h + 'px' };
    if (fill) c.height = h + 'px';
    imp(card, c);
}
function pcUnpinModal(overlay, card) {
    if (overlay && overlay._pcBaseCss != null) overlay.style.cssText = overlay._pcBaseCss;
    if (card && card._pcBaseCss != null) card.style.cssText = card._pcBaseCss;
}
function pcOpenModal(overlay, card, maxW, fill) {
    overlay.style.display = 'block';
    _pcActive = { overlay, card, maxW, fill };
    pcPinModal(overlay, card, maxW, fill);
    if (window.visualViewport && !_pcVVSync) {
        _pcVVSync = () => { if (_pcActive) pcPinModal(_pcActive.overlay, _pcActive.card, _pcActive.maxW, _pcActive.fill); };
        window.visualViewport.addEventListener('resize', _pcVVSync);
        window.visualViewport.addEventListener('scroll', _pcVVSync);
    }
}
const closeAllModals = () => {
    if (_pcVVSync && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', _pcVVSync);
        window.visualViewport.removeEventListener('scroll', _pcVVSync);
        _pcVVSync = null;
    }
    // restore the base cssText FIRST (it carries display:block from the snapshot),
    // then force display:none last so the modal actually ends up hidden
    pcUnpinModal(logModal, logCardEl()); pcUnpinModal(providerModal, provCardEl());
    logModal.style.display = 'none'; providerModal.style.display = 'none';
    _pcActive = null;
};
logModal.addEventListener('click', e => { if (!document.getElementById('mb-log-modal-card').contains(e.target)) closeAllModals(); });
providerModal.addEventListener('click', e => { if (!document.getElementById('mb-provider-modal-card').contains(e.target)) closeAllModals(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

document.getElementById('mb-log-open-btn').addEventListener('click', () => { pcOpenModal(logModal, logCardEl(), 900, true); });

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
// Beatport-account UI state (logged in → show "Sign out"; logged out → show login form)
function bpRefreshSetupUI(msg, isErr) {
    const st = document.getElementById('mb-bp-status'), form = document.getElementById('mb-bp-form'), out = document.getElementById('mb-bp-logout');
    if (!st) return;
    const inOk = bpLoggedIn();
    form.style.display = inOk ? 'none' : 'flex';
    out.style.display = inOk ? 'inline-block' : 'none';
    st.textContent = msg || (inOk ? 'signed in' : 'not signed in');
    st.style.color = isErr ? '#BF616A' : (inOk ? '#0a8754' : '#999');
}
document.getElementById('mb-bp-login').addEventListener('click', async () => {
    const u = document.getElementById('mb-bp-user').value.trim(), p = document.getElementById('mb-bp-pass').value;
    if (!u || !p) { bpRefreshSetupUI('enter email + password', true); return; }
    bpRefreshSetupUI('signing in…');
    const r = await beatportLogin(u, p);
    document.getElementById('mb-bp-pass').value = '';
    bpRefreshSetupUI(r.ok ? 'signed in ✓ — ↻ to re-scan Beatport' : `failed: ${r.error}`, !r.ok);
});
document.getElementById('mb-bp-logout').addEventListener('click', () => { bpWrite(null); document.getElementById('mb-bp-user').value = ''; bpRefreshSetupUI('signed out'); });
// Qobuz-account UI state (mirrors Beatport)
function qbRefreshSetupUI(msg, isErr) {
    const st = document.getElementById('mb-qb-status'), form = document.getElementById('mb-qb-form'), out = document.getElementById('mb-qb-logout');
    if (!st) return;
    const inOk = qbLoggedIn();
    form.style.display = inOk ? 'none' : 'flex';
    out.style.display = inOk ? 'inline-block' : 'none';
    st.textContent = msg || (inOk ? 'signed in' : 'not signed in');
    st.style.color = isErr ? '#BF616A' : (inOk ? '#0a8754' : '#999');
}
document.getElementById('mb-qb-login').addEventListener('click', async () => {
    const u = document.getElementById('mb-qb-user').value.trim(), p = document.getElementById('mb-qb-pass').value;
    if (!u || !p) { qbRefreshSetupUI('enter email + password', true); return; }
    qbRefreshSetupUI('signing in…');
    const r = await qobuzLogin(u, p);
    document.getElementById('mb-qb-pass').value = '';
    qbRefreshSetupUI(r.ok ? 'signed in ✓ — ↻ to re-scan Qobuz here; ISRC Scout & Credit Hoarder can use it too' : `failed: ${r.error}`, !r.ok);
});
document.getElementById('mb-qb-logout').addEventListener('click', () => { qbWrite(null); document.getElementById('mb-qb-user').value = ''; qbRefreshSetupUI('signed out'); });
document.getElementById('mb-token-setup-btn').addEventListener('click', () => {
    PROVIDER_ORDER.forEach(p => { document.getElementById(`mb-toggle-${p}`).checked = GM_getValue(`prov_${p}`, true); });
    document.getElementById('mb-show-icons').checked = GM_getValue('pc:show-icons', true);
    document.getElementById('mb-show-names').checked = GM_getValue('pc:show-names', false);
    document.getElementById('mb-respect-barcode').checked = GM_getValue('pc:respect-barcode', true);
    document.getElementById('mb-barcode-mode').value = GM_getValue('pc:barcode-mode', 'exists');
    document.getElementById('mb-barcode-mode').disabled = !GM_getValue('pc:respect-barcode', true);
    document.getElementById('mb-respect-format').checked = GM_getValue('pc:respect-format', true);
    document.getElementById('mb-format-mode').value = GM_getValue('pc:format-mode', 'exists');
    document.getElementById('mb-format-mode').disabled = !GM_getValue('pc:respect-format', true);
    const layout = GM_getValue('pc:layout', '1row');
    providerModal.querySelectorAll('input[name="mb-layout"]').forEach(r => { r.checked = r.value === layout; });
    document.getElementById('mb-compact-unmatched').checked = GM_getValue('pc:compact-unmatched', true);
    const marker = GM_getValue('pc:mb-marker', 'circle');
    providerModal.querySelectorAll('input[name="mb-marker"]').forEach(r => { r.checked = r.value === marker; });
    const fmtMarkerMode = GM_getValue('pc:format-marker', 'circle');
    providerModal.querySelectorAll('input[name="format-marker"]').forEach(r => { r.checked = r.value === fmtMarkerMode; });
    bpRefreshSetupUI();
    qbRefreshSetupUI();
    showSetupView('main');   // #188 always open on the main view
    pcOpenModal(providerModal, provCardEl(), 440, false);
});
document.getElementById('mb-provider-close-btn').addEventListener('click', closeAllModals);
// #188 setup is split into a compact main view + "Order & visibility" and "Auth"
// sub-views that replace the card content, each with a ‹ Back to the main view.
function showSetupView(name) {
    ['main', 'order', 'auth'].forEach(v => { const el = document.getElementById('mb-setup-' + v); if (el) el.style.display = v === name ? '' : 'none'; });
}
document.getElementById('mb-view-order').addEventListener('click', () => showSetupView('order'));
document.getElementById('mb-view-auth').addEventListener('click', () => showSetupView('auth'));
providerModal.querySelectorAll('.pc-setup-back').forEach(b => b.addEventListener('click', () => showSetupView('main')));
// Real-time config (#175): each control applies + persists the instant it
// changes — no Save button, no reload, and the sidebar updates live behind the
// (now backdrop-free) settings card.
PROVIDER_ORDER.forEach(p => {
    document.getElementById(`mb-toggle-${p}`).addEventListener('change', e => {
        GM_setValue(`prov_${p}`, e.target.checked);
        if (providerRows[p]) providerRows[p].style.display = e.target.checked ? '' : 'none';
    });
});
document.getElementById('mb-show-icons').addEventListener('change', e => {
    GM_setValue('pc:show-icons', e.target.checked);
    container.classList.toggle('pc-icons-mode', e.target.checked);
});
document.getElementById('mb-compact-unmatched').addEventListener('change', e => {
    GM_setValue('pc:compact-unmatched', e.target.checked);   // #355
    container.classList.toggle('pc-compact-unmatched', e.target.checked);
    refreshCompactStrip();
});
document.getElementById('mb-show-names').addEventListener('change', e => {
    GM_setValue('pc:show-names', e.target.checked);
    container.classList.toggle('pc-no-names', !e.target.checked);
});
document.getElementById('mb-respect-barcode').addEventListener('change', e => {
    GM_setValue('pc:respect-barcode', e.target.checked);   // (#182) gate + / ↗ on barcode match
    document.getElementById('mb-barcode-mode').disabled = !e.target.checked;
});
document.getElementById('mb-barcode-mode').addEventListener('change', e => {
    GM_setValue('pc:barcode-mode', e.target.value);        // 'exists' (known mismatch only) | 'strict' (also unconfirmable)
});
document.getElementById('mb-respect-format').addEventListener('change', e => {
    GM_setValue('pc:respect-format', e.target.checked);    // (#182) gate + / ↗ on format compatibility
    document.getElementById('mb-format-mode').disabled = !e.target.checked;
});
document.getElementById('mb-format-mode').addEventListener('change', e => {
    GM_setValue('pc:format-mode', e.target.value);         // 'exists' (known incompatible only) | 'strict' (also undeterminable)
});
providerModal.querySelectorAll('input[name="mb-layout"]').forEach(r => r.addEventListener('change', () => {
    const layout = (providerModal.querySelector('input[name="mb-layout"]:checked') || {}).value || '1row';
    GM_setValue('pc:layout', layout);
    container.classList.toggle('pc-layout-1row', layout !== '2row');
    container.classList.toggle('pc-layout-2row', layout === '2row');
}));
providerModal.querySelectorAll('input[name="mb-marker"]').forEach(r => r.addEventListener('change', () => {
    const marker = (providerModal.querySelector('input[name="mb-marker"]:checked') || {}).value || 'circle';
    GM_setValue('pc:mb-marker', marker);
    container.classList.toggle('pc-mark-glow', marker === 'glow');
    container.classList.toggle('pc-mark-circle', marker !== 'glow');
}));
providerModal.querySelectorAll('input[name="format-marker"]').forEach(r => r.addEventListener('change', () => {
    const mode = (providerModal.querySelector('input[name="format-marker"]:checked') || {}).value || 'circle';
    GM_setValue('pc:format-marker', mode);
    container.classList.toggle('pc-fmt-text', mode === 'text');   // live — both are already in the DOM, CSS just swaps which shows
}));
// Compact-view sliders (#178): set the matching CSS variable live + persist.
[['mb-row-gap', 'pc:row-gap', '--pc-row-gap', 5], ['mb-col-gap', 'pc:col-gap', '--pc-col-gap', 5], ['mb-name-size', 'pc:name-size', '--pc-name-size', 12], ['mb-icon-size', 'pc:icon-size', '--pc-icon-size', 22]].forEach(([id, key, prop, def]) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(`${id}-val`);
    const apply = v => { container.style.setProperty(prop, `${v}px`); if (valEl) valEl.textContent = String(v); };
    el.value = GM_getValue(key, def);
    apply(el.value);
    el.addEventListener('input', () => { GM_setValue(key, Number(el.value)); apply(el.value); });
});
document.getElementById('mb-modal-copy-btn').addEventListener('click', async function () {
    // Firefox throws NS_ERROR_NOT_INITIALIZED from clipboard.writeText when
    // the document isn't focused. Fall back to a textarea + execCommand on
    // failure rather than letting the unhandled rejection surface.
    // Wrap in a collapsed <details> + fenced block so it pastes into a GitHub
    // issue/comment as a tidy, foldable log rather than a wall of text.
    const raw = (logPanel.innerText || '').trim();
    const text = '<details><summary>Platform Check Log</summary>\n\n```\n' + raw + '\n```\n\n</details>\n';
    const flash = msg => { this.textContent = msg; setTimeout(() => { this.textContent = 'Copy'; }, 1500); };
    try {
        await navigator.clipboard.writeText(text);
        flash('Copied!');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;';
        document.body.appendChild(ta); ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) {}
        ta.remove();
        flash(ok ? 'Copied!' : 'Copy failed');
    }
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
function gmGet(url, { responseType, headers, timeout = 15000, anonymous } = {}) {
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
                resolve({ ok: res.status >= 200 && res.status < 400, status: res.status, finalUrl: res.finalUrl || url, responseText: res.responseText || '', responseHeaders: res.responseHeaders || '', ms });
            },
            onerror(err)  { resolve({ ok: false, status: 0, finalUrl: url, responseText: '', error: String(err?.error || err?.statusText || err), ms: Date.now() - t0 }); },
            ontimeout()   { resolve({ ok: false, status: 0, finalUrl: url, responseText: '', error: 'timeout', ms: Date.now() - t0 }); },
        };
        if (responseType) opts.responseType = responseType;
        if (anonymous) opts.anonymous = true;   // omit the browser's ambient cookies
        GM_xmlhttpRequest(opts);
    });
}

// POST counterpart of gmGet, used for the Tidal client-credentials token grant.
function gmPost(url, data, { headers, timeout = 15000, anonymous } = {}) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const opts = {
            method: 'POST', url, data,
            headers: { 'Accept-Language': 'en-US,en;q=0.9', ...headers },
            timeout,
            onload(res)  { resolve({ ok: res.status >= 200 && res.status < 400, status: res.status, finalUrl: res.finalUrl || url, responseText: res.responseText || '', responseHeaders: res.responseHeaders || '', ms: Date.now() - t0 }); },
            onerror(err) { resolve({ ok: false, status: 0, responseText: '', error: String(err?.error || err?.statusText || err), ms: Date.now() - t0 }); },
            ontimeout()  { resolve({ ok: false, status: 0, responseText: '', error: 'timeout', ms: Date.now() - t0 }); },
        };
        if (anonymous) opts.anonymous = true;
        GM_xmlhttpRequest(opts);
    });
}

// ─── Tidal API (client-credentials app token; baked-in shared installed app) ──
const TIDAL = {
    clientId:     'cRhhDJDpYXXBn82U',
    clientSecret: 'K7UX40jDOZ5p4y4JMYZgoiwKi7jymTHWcLMb4gkewKs=',
    tokenUrl: 'https://auth.tidal.com/v1/oauth2/token',
    api:      'https://openapi.tidal.com/v2',
    country:  'US',
};
let _tidalTok = null, _tidalTokExp = 0;
async function tidalToken() {
    if (_tidalTok && Date.now() < _tidalTokExp - 60000) return _tidalTok;
    const basic = btoa(`${TIDAL.clientId}:${TIDAL.clientSecret}`);
    const r = await gmPost(TIDAL.tokenUrl, 'grant_type=client_credentials',
        { headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) { appendLog('Tidal', `token grant failed (${r.status})`, 'error'); return null; }
    try {
        const j = JSON.parse(r.responseText);
        if (!j.access_token) { appendLog('Tidal', `token grant: no access_token`, 'error'); return null; }
        _tidalTok = j.access_token;
        _tidalTokExp = Date.now() + ((j.expires_in || 14400) * 1000);
        return _tidalTok;
    } catch (e) { appendLog('Tidal', `token JSON parse: ${e.message}`, 'error'); return null; }
}

// ── Beatport API auth (PKCE; token shared with ISRC Scout via musicbrainz.org localStorage) ──
// Beatport's catalog API needs an OAuth2 Bearer. No app registration exists, but the web
// app's *public* client_id + the user's own login (PKCE authorization_code) yields a token
// that returns track counts — enabling verified matches and the + insert. We store ONLY the
// tokens (never the password), renew silently via the refresh token, and share them with
// ISRC Scout through a localStorage key on this origin (config/login lives here in PC).
const BEATPORT = {
    clientId: '0GIvkCltVIuPkkwSJHp6NDb3s0potTjLBQr388Dd',          // Beatport web-app client (public, from their docs JS)
    redirect: 'https://api.beatport.com/v4/auth/o/post-message/',
    api:      'https://api.beatport.com/v4',
    origin:   'https://api.beatport.com',
    store:    'mbtools:beatport',
};
// Beatport's API runs Django CSRF protection that engages whenever a valid
// beatport.com session cookie rides along. GM_xmlhttpRequest shares the browser
// cookie jar, so any lingering beatport.com session (from a prior login on this
// browser) makes Django session-authenticate the request and then demand a CSRF
// token it can't supply — failing the login. Rather than read/echo that cookie
// (GM_cookie is domain-restricted to the page origin on some managers and can't
// see beatport.com at all), the login flow runs the requests `anonymous` (no
// ambient cookies) and threads the fresh session it creates itself — so the
// outcome never depends on the browser's existing Beatport state.
// Static origin/referer still need to be the API's OWN origin (Django always
// trusts a request's own origin; www.beatport.com is NOT in its trusted set).
const bpHeaders = () => ({ Referer: BEATPORT.origin + '/', Origin: BEATPORT.origin });

const bpRead     = () => { try { return JSON.parse(localStorage.getItem(BEATPORT.store) || 'null'); } catch { return null; } };
const bpWrite    = t  => { try { t ? localStorage.setItem(BEATPORT.store, JSON.stringify(t)) : localStorage.removeItem(BEATPORT.store); } catch {} };
const bpLoggedIn = () => { const t = bpRead(); return !!(t && t.refresh_token); };
const bpB64url   = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function bpPkce() { const v = bpB64url(crypto.getRandomValues(new Uint8Array(48))); const c = bpB64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))); return { v, c }; }

// Full login → token. Returns { ok } or { ok:false, error }. Used by PC's setup UI.
// Two cases, both ending at a non-anonymous authorize GET that consumes a
// session cookie from the shared jar:
//   • Fresh browser — the normal login POST mints that session in the jar.
//   • Browser already holds a beatport.com session — that ambient cookie makes
//     Django enforce CSRF on the login POST (which we can't satisfy: GM_cookie
//     is domain-restricted and Set-Cookie is hidden on some managers). But the
//     existing session is itself valid and is accepted by the authorize GET, so
//     we just validate the typed credentials out-of-band (anonymous → no
//     session → no CSRF) and reuse that session.
async function beatportLogin(username, password) {
    let lr = await gmPost(`${BEATPORT.api}/auth/login/`, JSON.stringify({ username, password }), { headers: { 'Content-Type': 'application/json', ...bpHeaders() } });
    if (!lr.ok && /csrf/i.test(lr.responseText || '')) {
        appendLog('Beatport', 'login blocked by an existing browser Beatport session — validating credentials and reusing that session…');
        lr = await gmPost(`${BEATPORT.api}/auth/login/`, JSON.stringify({ username, password }), { anonymous: true, headers: { 'Content-Type': 'application/json', ...bpHeaders() } });
    }
    if (!lr.ok) {
        let m = 'incorrect username or password';
        try { const j = JSON.parse(lr.responseText); m = (typeof j === 'string' ? j : j.detail) || m; } catch {}
        appendLog('Beatport', `login rejected — HTTP ${lr.status}: ${m}`, 'error');
        return { ok: false, error: m };
    }

    const { v, c } = await bpPkce();
    const au = `${BEATPORT.api}/auth/o/authorize/?response_type=code&client_id=${BEATPORT.clientId}&redirect_uri=${encodeURIComponent(BEATPORT.redirect)}&code_challenge=${c}&code_challenge_method=S256`;
    const ar = await gmGet(au, { headers: bpHeaders() });   // non-anonymous: uses the jar session (fresh-from-login or existing browser)
    const code = ((ar.finalUrl || '').match(/[?&#]code=([^&]+)/) || [])[1];
    if (!code) {
        appendLog('Beatport', `authorize returned no code — HTTP ${ar.status}; no usable Beatport session in the browser. Log in at beatport.com in this browser, then retry.`, 'error');
        return { ok: false, error: 'no authorization code returned' };
    }
    const tr = await gmPost(`${BEATPORT.api}/auth/o/token/`, new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: BEATPORT.redirect, client_id: BEATPORT.clientId, code_verifier: v }).toString(), { anonymous: true, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...bpHeaders() } });
    let j; try { j = JSON.parse(tr.responseText); } catch { appendLog('Beatport', `token exchange — unparseable response (HTTP ${tr.status})`, 'error'); return { ok: false, error: 'token response parse failed' }; }
    if (!j.access_token) { const e = j.error_description || j.error || 'no access token'; appendLog('Beatport', `token exchange failed — ${e}`, 'error'); return { ok: false, error: e }; }
    bpWrite({ access_token: j.access_token, refresh_token: j.refresh_token, exp: Date.now() + ((j.expires_in || 36000) * 1000) });
    appendLog('Beatport', `logged in (token scope: ${j.scope || '?'})`, 'ok');
    return { ok: true };
}
// Valid access token, renewing via refresh_token when needed; null if not logged in / refresh failed.
async function beatportToken() {
    const t = bpRead();
    if (!t || !t.refresh_token) return null;
    if (t.access_token && Date.now() < t.exp - 60000) return t.access_token;
    const tr = await gmPost(`${BEATPORT.api}/auth/o/token/`, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: BEATPORT.clientId }).toString(), { anonymous: true, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...bpHeaders() } });
    let j; try { j = JSON.parse(tr.responseText); } catch { j = {}; }
    if (!j.access_token) { appendLog('Beatport', 'token refresh failed — log in again in ⚙ setup', 'warn'); return null; }
    bpWrite({ access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token, exp: Date.now() + ((j.expires_in || 36000) * 1000) });
    return j.access_token;
}
// ── Qobuz API auth (email + password login; token shared with ISRC Scout + Credit Hoarder) ──
// Qobuz's per-track data (ISRCs + roled `performers`) lives behind `album/get`, which is
// session-gated — anonymous requests 404/401 regardless of app_id (see #353). A logged-in
// user_auth_token unlocks it. We log in with the user's own credentials, store ONLY the token
// (never the password), and share it — like the Beatport token — via a localStorage key on this
// origin, so ISRC Scout (ISRCs) and Credit Hoarder (roled credits) can read it without re-auth.
const QOBUZ = {
    appId: '712109809',                                  // anonymous web-player app_id (accepted for login + album/get with a token)
    api:   'https://www.qobuz.com/api.json/0.2',
    store: 'mbtools:qobuz',
};
const qbRead     = () => { try { return JSON.parse(localStorage.getItem(QOBUZ.store) || 'null'); } catch { return null; } };
const qbWrite    = t  => { try { t ? localStorage.setItem(QOBUZ.store, JSON.stringify(t)) : localStorage.removeItem(QOBUZ.store); } catch {} };
const qbLoggedIn = () => { const t = qbRead(); return !!(t && t.token); };
// Compact MD5 (public-domain, Joseph Myers) — Qobuz's user/login wants the password as an MD5 hex
// digest, which SubtleCrypto can't produce. Only used to sign the login request; nothing is stored.
function md5(str) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function au(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
    function cmn(q, a, b, x, s, t) { return au(rl(au(au(a, q), au(x, t)), s), b); }
    const ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t);
    const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
    const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
    const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);
    const bytes = unescape(encodeURIComponent(str)), n = bytes.length, x = [];
    for (let i = 0; i < n; i++) x[i >> 2] |= (bytes.charCodeAt(i) & 0xFF) << ((i % 4) * 8);
    x[n >> 2] |= 0x80 << ((n % 4) * 8);
    x[(((n + 8) >> 6) * 16) + 14] = n * 8;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
        const oa = a, ob = b, oc = c, od = d, g = j => x[i + j] | 0;
        a = ff(a,b,c,d,g(0),7,-680876936);  d = ff(d,a,b,c,g(1),12,-389564586); c = ff(c,d,a,b,g(2),17,606105819);  b = ff(b,c,d,a,g(3),22,-1044525330);
        a = ff(a,b,c,d,g(4),7,-176418897);  d = ff(d,a,b,c,g(5),12,1200080426); c = ff(c,d,a,b,g(6),17,-1473231341); b = ff(b,c,d,a,g(7),22,-45705983);
        a = ff(a,b,c,d,g(8),7,1770035416);  d = ff(d,a,b,c,g(9),12,-1958414417); c = ff(c,d,a,b,g(10),17,-42063);    b = ff(b,c,d,a,g(11),22,-1990404162);
        a = ff(a,b,c,d,g(12),7,1804603682); d = ff(d,a,b,c,g(13),12,-40341101); c = ff(c,d,a,b,g(14),17,-1502002290); b = ff(b,c,d,a,g(15),22,1236535329);
        a = gg(a,b,c,d,g(1),5,-165796510);  d = gg(d,a,b,c,g(6),9,-1069501632); c = gg(c,d,a,b,g(11),14,643717713); b = gg(b,c,d,a,g(0),20,-373897302);
        a = gg(a,b,c,d,g(5),5,-701558691);  d = gg(d,a,b,c,g(10),9,38016083);  c = gg(c,d,a,b,g(15),14,-660478335); b = gg(b,c,d,a,g(4),20,-405537848);
        a = gg(a,b,c,d,g(9),5,568446438);   d = gg(d,a,b,c,g(14),9,-1019803690); c = gg(c,d,a,b,g(3),14,-187363961); b = gg(b,c,d,a,g(8),20,1163531501);
        a = gg(a,b,c,d,g(13),5,-1444681467); d = gg(d,a,b,c,g(2),9,-51403784);  c = gg(c,d,a,b,g(7),14,1735328473); b = gg(b,c,d,a,g(12),20,-1926607734);
        a = hh(a,b,c,d,g(5),4,-378558);     d = hh(d,a,b,c,g(8),11,-2022574463); c = hh(c,d,a,b,g(11),16,1839030562); b = hh(b,c,d,a,g(14),23,-35309556);
        a = hh(a,b,c,d,g(1),4,-1530992060); d = hh(d,a,b,c,g(4),11,1272893353); c = hh(c,d,a,b,g(7),16,-155497632); b = hh(b,c,d,a,g(10),23,-1094730640);
        a = hh(a,b,c,d,g(13),4,681279174);  d = hh(d,a,b,c,g(0),11,-358537222); c = hh(c,d,a,b,g(3),16,-722521979); b = hh(b,c,d,a,g(6),23,76029189);
        a = hh(a,b,c,d,g(9),4,-640364487);  d = hh(d,a,b,c,g(12),11,-421815835); c = hh(c,d,a,b,g(15),16,530742520); b = hh(b,c,d,a,g(2),23,-995338651);
        a = ii(a,b,c,d,g(0),6,-198630844);  d = ii(d,a,b,c,g(7),10,1126891415); c = ii(c,d,a,b,g(14),15,-1416354905); b = ii(b,c,d,a,g(5),21,-57434055);
        a = ii(a,b,c,d,g(12),6,1700485571); d = ii(d,a,b,c,g(3),10,-1894986606); c = ii(c,d,a,b,g(10),15,-1051523); b = ii(b,c,d,a,g(1),21,-2054922799);
        a = ii(a,b,c,d,g(8),6,1873313359);  d = ii(d,a,b,c,g(15),10,-30611744); c = ii(c,d,a,b,g(6),15,-1560198380); b = ii(b,c,d,a,g(13),21,1309151649);
        a = ii(a,b,c,d,g(4),6,-145523070);  d = ii(d,a,b,c,g(11),10,-1120210379); c = ii(c,d,a,b,g(2),15,718787259); b = ii(b,c,d,a,g(9),21,-343485551);
        a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od);
    }
    const hex = n => { let s = ''; for (let i = 0; i < 4; i++) s += ((n >> (i * 8 + 4)) & 0xF).toString(16) + ((n >> (i * 8)) & 0xF).toString(16); return s; };
    return hex(a) + hex(b) + hex(c) + hex(d);
}
// Full login → { ok } or { ok:false, error }. Stores only the user_auth_token (+ app_id) on success.
async function qobuzLogin(email, password) {
    const url = `${QOBUZ.api}/user/login?email=${encodeURIComponent(email)}&password=${md5(password)}&app_id=${QOBUZ.appId}`;
    const r = await gmGet(url, { headers: { 'X-App-Id': QOBUZ.appId, Accept: 'application/json' } });
    let j; try { j = JSON.parse(r.responseText || 'null'); } catch { j = null; }
    const tok = j && j.user_auth_token;
    if (!tok) {
        const m = (j && (j.message || j.code)) || (r.status === 401 ? 'invalid email or password' : `HTTP ${r.status}`);
        appendLog('Qobuz', `login rejected — ${m}`, 'error');
        return { ok: false, error: String(m) };
    }
    qbWrite({ token: tok, appId: QOBUZ.appId });
    appendLog('Qobuz', 'logged in — token stored for ISRC Scout + Credit Hoarder', 'ok');
    return { ok: true };
}
async function beatportApi(path) {
    const tok = await beatportToken(); if (!tok) return null;
    const r = await gmGet(`${BEATPORT.api}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) { appendLog('Beatport', `API ${r.status} ${path}`, 'warn'); return null; }
    try { return JSON.parse(r.responseText); } catch { return null; }
}

// ─── UI updater ────────────────────────────────────────────────────────────
// `source` is the original origin of the URL ('MB rels' / 'Wikidata' / 'search' /
// 'native' / 'API search'). `fromCache` is independent — true when this row was
// resolved from the local cache, regardless of which path originally found it.
// Two visual signals get layered:
//   colour tint    — green when fromCache=false, steel-blue when fromCache=true
//   circled icon   — when source includes 'MB rels' (the URL was put there by
//                    an MB editor, not discovered by us)
// The MB release's barcode for the current scan (#182) — set by runScans so
// updateRow can compare a found item's barcode against it.
let MB_BARCODE = null;
// Normalise a barcode for comparison: digits only, leading zeros stripped (a
// 12-digit UPC-A and its 13-digit EAN form "0…" are the same barcode).
function normBarcode(b) { return String(b || '').replace(/\D/g, '').replace(/^0+/, ''); }
// #354: stores index the same GTIN under different zero-paddings — a 12-digit UPC-A,
// a 13-digit EAN with a leading 0, or a 14-digit form — so an exact-UPC lookup can
// miss purely on padding. gtinVariants returns the distinct forms to try (the raw MB
// barcode first, then the stripped core and the 12/13/14 zero-padded forms). Leading
// zeros are insignificant in a GTIN, so these are all the SAME barcode — no wrong-match
// risk. `upcTry` runs a lookup across them and stops at the first hit, so the extra
// requests only happen on the no-match path.
function gtinVariants(barcode) {
    const raw = String(barcode || '').replace(/\D/g, '');
    if (!raw) return [];
    const core = raw.replace(/^0+/, '') || raw;
    const out = [];
    const push = v => { if (v && !out.includes(v)) out.push(v); };
    push(raw);                                   // the exact MB barcode (as stored) first
    push(core);                                  // leading zeros stripped
    if (core.length >= 11 && core.length <= 14) [12, 13, 14].forEach(n => { if (core.length <= n) push(core.padStart(n, '0')); });
    return out;
}
async function upcTry(barcode, fn) {
    for (const v of gtinVariants(barcode)) { const r = await fn(v); if (r) return r; }
    return null;
}

let MB_FORMAT = null;
// Format-confidence (#182). Only Bandcamp and Discogs carry a real parsed
// format string (Digital / CD / Vinyl …); every other provider is a digital-
// only storefront that never exposes a physical edition, so an absent format
// means "Digital" for the check (otherwise strict mode would withhold every
// streaming link). Those two are excluded and judged on their actual format.
const DIGITAL_ONLY_PROVIDERS = new Set(['spotify', 'apple', 'deezer', 'tidal', 'qobuz', 'beatport', 'volumo', 'hdtracks']);
// Bucket a format string into {physical, digital} categories. A multi-format
// string ("Digital, CD") yields both; an unknown/empty string yields neither.
function formatCategories(s) {
    const t = String(s || '').toLowerCase();
    const cats = new Set();
    if (/\b(cd|vinyl|cassette|sacd|dvd|blu-?ray|flexi|minidisc|lp|shm|7"|10"|12")\b/.test(t)) cats.add('physical');
    if (/\b(digital|file|stream|lossless|web|wav|flac|mp3|aac|hi-?res)\b/.test(t)) cats.add('digital');
    return cats;
}
// Remote format categories with the digital-only default applied.
function remoteFormatCategories(platform, fmt) {
    const cats = formatCategories(fmt);
    if (cats.size === 0 && DIGITAL_ONLY_PROVIDERS.has(platform)) cats.add('digital');
    return cats;
}
// A *known* format incompatibility (used for the row marker — shown only when
// the option is on). Unknown remote format is not a known mismatch.
function formatMismatch(platform, fmt) {
    const mbCats = formatCategories(MB_FORMAT);
    if (mbCats.size === 0) return false;
    const remote = remoteFormatCategories(platform, fmt);
    if (remote.size === 0) return false;
    return ![...remote].some(x => mbCats.has(x));
}

function updateRow(p, { url, mbTracks, remoteTracks, year, label, source, fromCache, format, masterState, hiddenTracks, barcode }) {
    const a    = document.getElementById(`mb-online-${p}`);
    const ico  = document.getElementById(`ico-${p}`);
    const val  = document.getElementById(`val-${p}`);
    if (url) a.href = url;

    const fromMbRels = source === 'MB rels';
    // Barcode mismatch (#182): MB has a barcode, the found item exposes one, and
    // they differ → a different release per MB guidelines. Surfaced as a subtle
    // left bar (CSS) + tooltip/log only; the barcode itself is never shown in the
    // dashboard. Providers whose API hides the barcode (Apple, Bandcamp) pass none.
    const bcDiff = !!(url && MB_BARCODE && barcode && normBarcode(barcode) !== normBarcode(MB_BARCODE));
    // Format incompatibility (#182) — only marked when the option is on, since
    // "digital link on a physical release" is common enough to be noise otherwise.
    const fmtDiff = !!(url && GM_getValue('pc:respect-format', true) && formatMismatch(p, format));

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
        // Bandcamp hidden download-only tracks (#183): mark the count with a "ⁿ"
        // superscript + tooltip so the editor knows N of the tracks aren't
        // streamable (the count itself already includes them).
        val.textContent = String(remoteTracks) + (hiddenTracks > 0 ? 'ⁿ' : '');
        val.title = hiddenTracks > 0 ? `${hiddenTracks} download-only track(s) hidden from streaming on Bandcamp` : '';
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

    // Withheld by barcode/format confidence (#182): present it like a mismatch
    // (grayed, not clickable) instead of a ✓ that silently does nothing on click.
    const blocked = !!(url && !fromMbRels && (barcodeBlocks(p) || formatBlocks(p)));
    // Click-to-add on the main icon for verified ✓ + not-already-in-MB (and not withheld).
    const canAdd = url && ico.textContent === '✓' && !fromMbRels && !blocked;
    ico.style.cursor = canAdd ? 'pointer' : '';
    ico.title = canAdd ? `Click to add ${PROVIDER_NAME[p]} URL to MB` : (blocked ? `Withheld from + / ↗ — barcode/format confidence is on (see the coloured bar)` : '');
    ico.onclick = canAdd ? () => addSingleUrl(p) : null;

    // Icons-mode encoding — TWO INDEPENDENT dimensions:
    //   presence (pc-st-*) drives the icon fade + name colour: match = full · mismatch = gray · notfound = faint
    //   in-MB    (pc-inmb) draws the marker (circle/glow) — orthogonal, so an in-MB row still grays on a mismatch
    const row = document.getElementById(`row-${p}`);
    if (row) {
        const g = ico.textContent;   // '✓' match · '~' mismatch · '?' found-no-count · '×' not found
        // a withheld (barcode/format-blocked) link reads as a mismatch, not a clean match (#182)
        const presence = blocked ? 'mismatch' : g === '×' ? 'notfound' : g === '~' ? 'mismatch' : 'match';
        row.classList.remove('pc-st-notfound', 'pc-st-mismatch', 'pc-st-match');
        row.classList.add('pc-st-' + presence);
        row.classList.toggle('pc-blocked', blocked);
        row.classList.toggle('pc-inmb', fromMbRels);
        // subtle left bar when the found release's barcode differs from MB's, or
        // (when the format option is on) its format is incompatible with MB's (#182)
        row.classList.toggle('pc-barcode-diff', bcDiff);
        row.dataset.barcodeDiff = bcDiff ? '1' : '';
        row.classList.toggle('pc-format-diff', fmtDiff);
        const diffTips = [];
        if (bcDiff) diffTips.push(`Different barcode than MB (MB ${MB_BARCODE} · ${PROVIDER_NAME[p]} ${barcode}) — likely a different release`);
        if (fmtDiff) diffTips.push(`Format incompatible with MB release (MB ${MB_FORMAT} · ${PROVIDER_NAME[p]} ${normalizeFormat(format) || 'Digital'}) — likely a different release`);
        // strict-mode withholding with no known mismatch (barcode/format couldn't be confirmed)
        if (blocked && !diffTips.length) diffTips.push(`Withheld from + / ↗ — couldn't confirm barcode/format (strict mode)`);
        if (diffTips.length) row.title = diffTips.join(' · ');
        else if (row.title && /Different barcode|Format incompatible|Withheld from/.test(row.title)) row.title = '';
        // Whole row is clickable (#173): anywhere from after the icon to the
        // track count — empty cells and the gaps included (the row is one
        // subgrid box). LEFT-click opens the found platform page, or the
        // provider's SEARCH page when nothing was found (so even completely
        // empty rows work); RIGHT-click always opens the SEARCH page for a
        // manual check. Icon keeps "add to MB" and the name <a> opens natively
        // (both excluded). searchUrl is read lazily so init order doesn't matter.
        const rowOpen = (e, preferSearch) => {
            if (e.target.closest('.pc-cell-ico') || e.target.closest('a')) return;
            const search = a.dataset.searchUrl || null;
            const dest = preferSearch ? (search || url) : (url || search);
            if (dest) { e.preventDefault(); window.open(dest, '_blank', 'noopener'); }
        };
        row.onclick       = (e) => rowOpen(e, false);
        row.oncontextmenu = (e) => rowOpen(e, true);
        row.style.cursor  = 'pointer';
    }
    const plat = document.getElementById(`plat-${p}`);
    if (plat) {
        plat.style.cursor = canAdd ? 'pointer' : 'default';
        plat.onclick = canAdd ? () => addSingleUrl(p) : null;   // click-to-add works on the brand icon too
        plat.title = canAdd ? `Click to add ${PROVIDER_NAME[p]} URL to MB` : (url ? a.title : `No ${PROVIDER_NAME[p]} URL found`);
    }

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

    // Meta cells: year · format · label, each its own grid cell so the columns
    // align across providers (1-row layout) — see setMetaCells.
    setMetaCells(`year-${p}`, `format-${p}`, `label-${p}`, year, format, label);
    refreshCompactStrip();   // #355
}

// #355: rebuild the "compact unmatched providers" strip from the rows' current state.
// Model: everything starts COMPACT (a strip of dimmed icons) and each provider RISES
// into a full row once it MATCHES — so pending + not-found stay in the strip, only a
// found row is shown in full. Discogs and Bandcamp always keep their full rows;
// disabled providers (prov_<p> off) are skipped. A row that leaves the strip gets a
// subtle rise animation so the panel doesn't jump as results stream in. Cheap enough
// to run after every updateRow.
function refreshCompactStrip() {
    const strip = document.getElementById('pc-compact-strip');
    if (!strip) return;
    const on = container.classList.contains('pc-compact-unmatched');
    strip.textContent = '';
    if (on) PROVIDER_ORDER.forEach(p => {
        if (p === 'discogs' || p === 'bandcamp') return;
        const row = document.getElementById(`row-${p}`);
        if (!row) return;
        // compact unless the row is a CLEAN match — so pending, not-found AND
        // found-but-mismatched (wrong barcode/format) all stay in the strip; only a
        // real match rises into a full row. A link that's already IN MB (pc-inmb) also
        // always stays a full row, even without a clean match — you added it, so show it.
        const compact = !row.classList.contains('pc-st-match') && !row.classList.contains('pc-inmb') && GM_getValue(`prov_${p}`, true);
        const was = row.classList.contains('pc-compacted');
        row.classList.toggle('pc-compacted', compact);
        if (!compact) {
            if (was) { row.classList.remove('pc-rise'); void row.offsetWidth; row.classList.add('pc-rise'); }   // rose out on a match
            return;
        }
        const a = document.getElementById(`mb-online-${p}`);
        // a mismatch (found but wrong release) keeps a subtle amber ring so the
        // "found but wrong" signal isn't lost when it's folded into the strip.
        const mismatch = row.classList.contains('pc-st-mismatch');
        const ico = document.createElement('span');
        ico.className = 'pc-compact-ico' + (mismatch ? ' pc-compact-mismatch' : '');
        ico.title = `${PROVIDER_NAME[p]} — ${mismatch ? 'found but a different release · click to open it' : 'click to search'}`;
        ico.innerHTML = PROVIDER_ICON[p] || '';
        ico.addEventListener('click', () => {
            // behave exactly like clicking the (uncompacted) row: open what was FOUND
            // when there is one (a mismatch has a found URL), else the provider search.
            const href = a && a.getAttribute('href');
            const found = href && /^https?:\/\//.test(href) ? href : null;
            const dest = found || (a && a.dataset.searchUrl) || null;
            if (dest) window.open(dest, '_blank', 'noopener');
            else row.click();   // last-resort fallback (e.g. a pending row)
        });
        strip.appendChild(ico);
    });
    else PROVIDER_ORDER.forEach(p => { const r = document.getElementById(`row-${p}`); if (r) r.classList.remove('pc-compacted'); });
    strip.classList.toggle('pc-has-icons', strip.children.length > 0);
}

// Fill the three meta cells (year / format / label) for a row. The "·"
// separators TRAIL year and format, but only when a later field follows — so
// the same cell content reads correctly in both layouts: aligned columns in
// 1-row ("2026 · | Digital · | Selections Lab"), and a joined line in 2-row
// ("2026 · Digital · Selections Lab"). Format is normalized (Digital Media →
// Digital); the full label is set as a tooltip so a truncated label (CSS
// ellipsis) is still readable on hover.
function setMetaCells(yearId, formatId, labelId, year, format, label) {
    const yEl = document.getElementById(yearId);
    const fEl = document.getElementById(formatId);
    const lEl = document.getElementById(labelId);
    const fmt = format ? normalizeFormat(format) : '';
    const hasY = !!year, hasF = !!fmt, hasL = !!label;
    // 2-digit year to save space in the compact row (#173); full year in tooltip.
    const y2 = hasY ? String(year).slice(-2) : '';
    if (yEl) { yEl.textContent = hasY ? (hasF || hasL ? `${y2} ·` : y2) : ''; yEl.title = hasY ? String(year) : ''; }
    if (fEl) {
        fEl.textContent = ''; fEl.title = hasF ? fmt : '';
        if (hasF) {
            const marker = fmtMarker(fmt); fEl.appendChild(marker);
            // recognized formats render BOTH the circle and a text span; the "Format marker" option toggles
            // which shows via a panel class, so switching needs no re-scan. Unknown formats stay text-only.
            if (marker.nodeType === 1) { const t = document.createElement('span'); t.className = 'pc-fmt-txt'; t.textContent = fmt; fEl.appendChild(t); }
            if (hasL) fEl.appendChild(document.createTextNode(' ·'));
        }
    }
    if (lEl) { lEl.textContent = hasL ? label : ''; lEl.title = hasL ? label : ''; }
}

// MB's "Digital Media" is the spec name, but in a tight sidebar "Digital"
// communicates the same thing. Applied at display time so the cache and
// scan paths can keep MB's canonical value.
function normalizeFormat(s) { return String(s || '').replace(/\bDigital\s*Media\b/i, 'Digital'); }

// Format-family quadrant marker (#350): collapse any format(s) to Digital / Vinyl / CD / Cassette and draw
// them as a single circle split into 4 coloured quadrants (present family = its colour). Compact (1 glyph)
// for multi-format releases where the format text (Discogs/Bandcamp) would otherwise eat horizontal space.
const PC_FMT_COLOR = { Vinyl: '#2b2b2b', Cassette: '#9a6b3f', CD: '#7d8894', Digital: '#4a90d9' };
function pcFormatFamily(f) {
    f = String(f || '').toLowerCase();
    if (/cassette|tape/.test(f)) return 'Cassette';
    if (/vinyl|shellac|flexi|\blp\b|7"|10"|12"/.test(f)) return 'Vinyl';
    if (/cd|sacd|dvd|blu-?ray|hd-?dvd|minidisc|umd|disc/.test(f)) return 'CD';
    if (/digital|file|stream|web|download|lossless|flac|mp3|wav|aac|hi-?res/.test(f)) return 'Digital';
    return '';
}
const pcFormatFamilies = fmt => [...new Set(String(fmt || '').split(/[,+/]|\s+&\s+/).map(pcFormatFamily).filter(Boolean))];
function fmtMarker(fmt) {
    const fams = pcFormatFamilies(fmt);
    if (!fams.length) return document.createTextNode(normalizeFormat(fmt) || '');   // unknown → keep the text
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '13'); svg.setAttribute('height', '13');
    svg.setAttribute('class', 'pc-fmt');
    // quadrants: Vinyl top-right · Cassette top-left · CD bottom-left · Digital bottom-right
    const QUAD = { Vinyl: [-90, 0], Cassette: [180, 270], CD: [90, 180], Digital: [0, 90] };
    const cx = 12, cy = 12, r = 11, rad = d => d * Math.PI / 180;
    for (const fam in QUAD) {
        const [a0, a1] = QUAD[fam];
        const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0)), x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`);
        path.setAttribute('fill', fams.includes(fam) ? PC_FMT_COLOR[fam] : '#e8eaed');
        path.setAttribute('stroke', 'rgba(255,255,255,.85)'); path.setAttribute('stroke-width', '0.8');
        svg.appendChild(path);
    }
    return svg;
}

// Strip leading copyright noise from a label string so the meta line doesn't
// show the year twice (year · label). Handles ℗/© or "(P)/(C)", a BARE leading
// year (Tidal often does "2026 Label" with no symbol), and repeated/stacked
// prefixes ("℗ 2017 © 2017 Label"). Returns null when nothing's left.
function stripCopyright(text) {
    let t = String(text || '').trim(), prev;
    do { prev = t; t = t.replace(/^\s*(?:[℗©]|\([pc]\))?\s*(?:19|20)\d{2}\s*/i, ''); } while (t !== prev);
    return t.trim() || null;
}

// Apply Discogs master-state to the master slot. State shape:
// { glyph: '✓'|'~'|'×', circled: bool, clickable: bool, title: str, addMasterUrl?: str }
function applyMasterIcon(el, state) {
    el.textContent = state.glyph;
    el.style.color = state.muted ? '#BBB' : '#5B82B0';
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
    if (!cachedMasterUrl) {
        // No master from a resolved Discogs release — but if the MB
        // release-group already carries a Discogs master, use it (it's the
        // authoritative RG-level link, same as honouring any existing MB rel).
        if (existingDiscogsMaster) {
            return { glyph: '✓', circled: true, clickable: false, masterUrl: existingDiscogsMaster,
                title: `Discogs master on the release-group: ${existingDiscogsMaster}` };
        }
        // Discogs returns no master_id when the release simply isn't part of a
        // master group (one-off pressings, niche labels). Show a muted "—" so
        // the user can distinguish "release has no master" from "we haven't
        // scanned yet" without the slot looking like a bug.
        return { glyph: '—', circled: false, clickable: false, title: 'Discogs release has no master entry', muted: true };
    }
    if (existingDiscogsMaster === cachedMasterUrl) {
        return { glyph: '✓', circled: true,  clickable: false, masterUrl: cachedMasterUrl, title: 'Discogs master URL is on the release-group' };
    }
    if (existingDiscogsMaster) {
        return { glyph: '~', circled: true,  clickable: false, masterUrl: existingDiscogsMaster, title: `MB has a different Discogs master on the release-group: ${existingDiscogsMaster}` };
    }
    return     { glyph: '✓', circled: false, clickable: true,  masterUrl: cachedMasterUrl, title: 'Click to add this Discogs master URL to the release-group', addMasterUrl: cachedMasterUrl };
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
// Token-set overlap.  `mode` controls strictness:
//   'max' — ratio against the larger side (default). Strict. Right for
//           album/title comparison: rejects "Self (The Remixes)" vs
//           "Jaiye Omo (The Remixes)" (share only "the" + "remixes").
//   'min' — ratio against the smaller side. Lenient. Right for artist
//           comparison: MB credits often shorter than streaming-platform
//           credits (e.g. MB "Hamad Kalkaba" vs Apple "Hamad Kalkaba &
//           The Golden Sounds" — all of MB's tokens are in Apple's, so
//           a min-based 0.8 threshold accepts it).
function tokenMatch(a, b, mode = 'max', threshold = 0.6) {
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
const titleSimilar  = (a, b) => tokenMatch(a, b, 'max', 0.6);
// #324: min-mode leniency is for the intended direction only — the MB credit being
// SHORTER than the platform's (e.g. "Hamad Kalkaba" ⊂ "Hamad Kalkaba & The Golden
// Sounds"). When the *candidate* is the shorter side it has dropped MB tokens — often
// a disambiguator like the "61" in "UFO 61" vs a bare "UFO!" — so be strict (max),
// or a wrong same-prefixed release scores a full artist match. (Root cause of #314.)
const artistTokenCount = s => normName(s).split(' ').filter(t => t.length >= 2).length;
const artistSimilar = (cand, mb) => tokenMatch(cand, mb, artistTokenCount(mb) <= artistTokenCount(cand) ? 'min' : 'max', 0.8);

// Score: tracks +100 / ±2 +30, title +60, artist +80 (non-VA).
//
// Two subtleties:
//
//   - The artist-mismatch penalty (-80) only applies when the title also
//     fails to match. Compilation reissues commonly credit the curator
//     label as `byArtist` on Bandcamp (e.g. "Analog Africa") while MB
//     attributes the recording to the actual artist ("Hamad Kalkaba").
//     If the title matches strongly, accept the mismatch as a likely
//     label/series credit.
//
//   - Pickable threshold (≥120) means a candidate needs at least one
//     non-tracks signal (title OR artist) to be trusted. Tracks alone
//     (100) is not enough — that was the bug behind picking the Jaiye
//     Omo album for Om Unit's "Self (The Remixes)" purely because both
//     happened to be 4-track EPs.
// Two non-empty titles that share ZERO significant tokens = a clearly different
// album (e.g. "Mambo Loco" vs "Para Bailar A Millón"). #324: an artist with many
// same-track-count albums (tracks 100 + artist 80) would otherwise be picked on a
// totally different title; a disjoint title is a strong negative signal.
function titleDisjoint(a, b) {
    const na = normName(a), nb = normName(b);
    if (!na || !nb) return false;
    const T = s => new Set(s.split(' ').filter(t => t.length >= 2));
    const ta = T(na), tb = T(nb);
    if (!ta.size || !tb.size) return false;
    for (const t of ta) if (tb.has(t)) return false;
    return true;
}
function scoreCandidate(meta, mbTracks, mbAlbum, mbArtist, isVA) {
    if (!meta) return -1;
    let s = 0;
    if (meta.tracks != null) {
        if (meta.tracks === mbTracks)                   s += 100;
        else if (Math.abs(meta.tracks - mbTracks) <= 2) s += 30;
    }
    const titleMatch = meta.title && titleSimilar(meta.title, mbAlbum);
    if (titleMatch) s += 60;
    // #324: a clearly different title outweighs tracks+artist (an album the same
    // artist also made, with the same track count, is a common false positive).
    else if (meta.title && mbAlbum && titleDisjoint(meta.title, mbAlbum)) s -= 100;
    if (!isVA && mbArtist && meta.artist) {
        if (artistSimilar(meta.artist, mbArtist)) s += 80;
        else if (!titleMatch) s -= 80;
    }
    return s;
}

// Drive a per-candidate verifier loop. Returns the best { url, meta, score }
// across the candidate list, plus a per-candidate log table for diagnostics.
// `fetchMeta(url)` returns `{ tracks, title, year, label }` (any field may be null).
async function pickBestCandidate(candidates, fetchMeta, mbTracks, mbAlbum, label, mbArtist, isVA) {
    const scored = [];
    for (const url of candidates) {
        const meta = await fetchMeta(url);
        const score = scoreCandidate(meta, mbTracks, mbAlbum, mbArtist, isVA);
        scored.push({ url, meta, score });
        appendLog(label, `  cand score=${score}  tracks=${meta?.tracks ?? '?'}  artist="${meta?.artist || '?'}"  title="${meta?.title || '?'}"  url=${url}`);
        // Short-circuit on a high-confidence match (tracks + (title or artist)).
        if (score >= 150) break;
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
function cacheKey(mbid, platform) { return `pc:cache:v2:${platform}:${mbid}`; }   // v2: entries now carry `barcode` (#182)
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
    for (const p of ALL_PROVIDERS) GM_setValue(cacheKey(mbid, p), null);   // all providers — not a stale hardcoded subset (else ↻ leaves Tidal/Beatport/Volumo cached)
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
        hiddenTracks: cached.hiddenTracks ?? 0,
        barcode:      cached.barcode ?? null,
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
    const sparql = `SELECT ?spotify ?apple ?allmusic ?tidal ?beatport WHERE {
${releaseGroupMbid ? `  { ?item wdt:P436 "${releaseGroupMbid}" }`           : ''}
${releaseGroupMbid && releaseMbid ? '  UNION' : ''}
${releaseMbid      ? `  { ?item wdt:P5813 "${releaseMbid}" }`               : ''}
  OPTIONAL { ?item wdt:P2205 ?spotify }
  OPTIONAL { ?item wdt:P5121 ?apple }
  OPTIONAL { ?item wdt:P1729 ?allmusic }
  OPTIONAL { ?item wdt:P4577 ?tidal }
  OPTIONAL { ?item wdt:P11312 ?beatport }
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
    const b = bindings.find(r => r.spotify || r.apple || r.allmusic || r.tidal || r.beatport) || bindings[0];
    const out = {
        spotifyId:  b.spotify?.value  || null,
        appleId:    b.apple?.value    || null,
        allmusicId: b.allmusic?.value || null,
        tidalId:    b.tidal?.value    || null,
        beatportId: b.beatport?.value || null,
    };
    appendLog('Wikidata', `match: spotify=${out.spotifyId || '-'} apple=${out.appleId || '-'} allmusic=${out.allmusicId || '-'} tidal=${out.tidalId || '-'} beatport=${out.beatportId || '-'}`, 'ok');
    return out;
}

// SAMBL (sambl.lioncat6.com) resolves a barcode → exact-UPC album URLs across
// Spotify / Deezer / Tidal / Apple / Qobuz (#182). Its unique value here is
// Spotify, which has no other unauthenticated UPC route (Tidal/Deezer already
// do barcode-first themselves). No CORS header → must go through
// GM_xmlhttpRequest (@connect sambl.lioncat6.com). Coverage is partial and its
// Apple result isn't barcode-exact, so callers should trust it only for Spotify.
async function lookupSambl(barcode) {
    if (!barcode) return null;
    const url = `https://sambl.lioncat6.com/api/find?query=${encodeURIComponent(barcode)}&type=upc`;
    appendLog('SAMBL', `barcode lookup ${barcode}`);
    const r = await gmGet(url);
    appendLog('SAMBL', `status=${r.status} ${r.responseText.length}b in ${r.ms}ms`);
    if (!r.ok) { appendLog('SAMBL', `lookup failed`, 'warn'); return null; }
    let j; try { j = JSON.parse(r.responseText); } catch (e) { appendLog('SAMBL', `JSON parse: ${e.message}`, 'error'); return null; }
    const out = {};
    for (const x of (j.data || [])) {
        if (!x.url || x.url.urlInfo?.type !== 'album') continue;
        const prov = x.provider === 'applemusic' ? 'apple' : x.provider;   // normalize
        if (!out[prov]) out[prov] = x.url.url;
    }
    const provs = Object.keys(out).filter(k => k !== 'musicbrainz');
    appendLog('SAMBL', `exact-barcode albums: ${provs.length ? provs.join(', ') : '(none)'}`, provs.length ? 'ok' : 'warn');
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
    const titleMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
    const yearMatch  = html.match(/"releaseDate":"(\d{4})-/) || html.match(/"year"\s*:\s*(\d{4})/);
    const labelMatch = html.match(/"label":"([^"]+)"/) || html.match(/"copyrights":\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/);
    // Spotify embed stores the album-level artist credit as the first
    // `"subtitle":"…"` field (subsequent subtitles are per-track artist
    // credits). The bigger Spotify metadata schemas use `"artists":[…]`
    // but the embed compresses them all to `subtitle`.
    const subtitleMatch = html.match(/"subtitle"\s*:\s*"([^"]+)"/);
    const artist = subtitleMatch?.[1] || null;
    return {
        tracks: trackUris.length || null,
        title:  titleMatch?.[1] || null,
        year:   yearMatch?.[1]  || null,
        label:  labelMatch?.[1] || null,
        artist,
    };
}

async function scanSpotify({ artist, album, mbTracks, existingUrl, mbid, wikidataSpotifyId, isVariousArtists, samblUrl }) {
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
    let exactBarcode = false;   // (#182) true when the URL was resolved by exact UPC

    if (albumUrl) {
        appendLog(label, `Using existing MB URL: ${albumUrl}`, 'ok');
        source = 'MB rels';
    } else if (samblUrl) {
        // SAMBL resolved the exact-barcode Spotify album — the only barcode route
        // for Spotify (the embed/API don't expose a UPC without an app token). It
        // beats Wikidata/search, which can point at a different-barcode edition.
        albumUrl = samblUrl; source = 'SAMBL (barcode)'; exactBarcode = true;
        appendLog(label, `SAMBL barcode match → ${albumUrl}`, 'ok');
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
        appendLog(label, `Verifying ${candidates.length} candidate(s) by tracks + title + artist…`);
        const best = await pickBestCandidate(candidates, fetchSpotifyMeta, mbTracks, album, label, artist, isVariousArtists);
        if (!best || best.score < 120) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'spotify', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('spotify', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.url;
        bestMeta = best.meta;
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 150 ? 'ok' : 'warn');
        source = 'search';
    }

    const meta = bestMeta || await fetchSpotifyMeta(albumUrl);
    if (meta) {
        appendLog(label, `Embed parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Embed fetch failed`, 'error');
    }
    // The embed strips year/label entirely. Fetch the public album page once
    // we've settled on a URL to enrich year for display — the JSON-LD blob
    // includes `datePublished`. Label is still unobtainable without OAuth.
    let displayYear = meta?.year ?? null;
    if (!displayYear) {
        try {
            const pr = await gmGet(albumUrl);
            if (pr.ok) {
                const m = pr.responseText.match(/"datePublished"\s*:\s*"(\d{4})/);
                if (m) {
                    displayYear = m[1];
                    appendLog(label, `Album page year: ${displayYear}`);
                }
            }
        } catch (_) { /* enrichment is best-effort */ }
    }
    const tracks = meta?.tracks ?? null;
    const lbl    = meta?.label  ?? null;
    const sbc = exactBarcode ? MB_BARCODE : null;   // exact UPC → MB barcode (no mismatch); else unknown
    cacheSet(mbid, 'spotify', { url: albumUrl, tracks, year: displayYear, label: lbl, source, barcode: sbc });
    updateRow('spotify', { url: albumUrl, mbTracks, remoteTracks: tracks, year: displayYear, label: lbl, source, barcode: sbc });
}

// ─── Qobuz ───────────────────────────────────────────────────────────────────
// Qobuz's catalogue API (api.json/0.2) with app_id `712109809`: `album/search`
// works unauthenticated (barcode-first search + UPC capture, like the other API
// providers), but `album/get` — which also carries `tracks_count` + `upc` for a
// direct verify — is session-gated (404/401 anonymously, #353). So when the user
// has logged in via ⚙ Setup → Auth (token in mbtools:qobuz), we attach it and the
// API path becomes reliable; otherwise Qobuz falls back to scraping the
// server-rendered store page. (#201/#353, shapes per chaban-mb / Harmony.)
const QOBUZ_APP_ID = '712109809';
function qobuzApi(path) {
    const headers = { Accept: 'application/json', 'X-App-Id': QOBUZ_APP_ID };
    const t = qbRead();                                       // #353 the user's stored token unlocks album/get
    if (t && t.token) headers['X-User-Auth-Token'] = t.token;
    return gmGet(`https://www.qobuz.com/api.json/0.2/${path}${path.includes('?') ? '&' : '?'}app_id=${QOBUZ_APP_ID}`, { headers })
        .then(r => { if (!r.ok) return null; try { return JSON.parse(r.responseText); } catch { return null; } });
}
// the album slug-id is the API's album_id (e.g. .../album/<slug>/vft3hpnx5c3lc)
function qobuzAlbumId(url) { const m = String(url || '').match(/qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/?#]+\/)?([a-z0-9]+)/i); return m ? m[1] : null; }
const qobuzMetaFromApi = d => (d && d.id) ? {
    tracks: d.tracks_count ?? null,
    title:  d.title || null,
    year:   String(d.release_date_original || d.release_date_stream || '').slice(0, 4) || null,
    label:  (d.label && d.label.name) || null,
    artist: (d.artist && d.artist.name) || null,
    barcode: d.upc || null,
} : null;
const qzDec = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
// Normalise any Qobuz album URL to the server-rendered www store page. open./play.
// are SPA shells with no credits in the HTML, and an MB rel is often the slug-less
// open form — a wrong-slug www URL 301-redirects to the canonical page, so this
// always lands somewhere scrapeable. (URL shapes per Harmony; #201, chaban-mb)
function qobuzStoreUrl(albumUrl) {
    const m = String(albumUrl || '').match(/qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/?#]+\/)?([a-z0-9]+)/i);
    if (!m) return albumUrl;
    if (/^https?:\/\/www\.qobuz\.com\/[a-z]{2}-[a-z]{2}\/album\/[^/]+\/[a-z0-9]+/i.test(albumUrl)) return albumUrl;   // already a www store page
    return `https://www.qobuz.com/us-en/album/x/${m[1]}`;
}
async function fetchQobuzMeta(albumUrl) {
    // Prefer the API (structured + carries the UPC); fall back to scraping the
    // store page where the API returns nothing (geo) or 429s. #201/#353
    const id = qobuzAlbumId(albumUrl);
    if (id) {
        const signedIn = qbLoggedIn();
        const m = qobuzMetaFromApi(await qobuzApi(`album/get?album_id=${encodeURIComponent(id)}`));
        if (m && m.tracks) { m._via = 'api'; return m; }   // tagged so scanQobuz can log the real source (see below)
        // #353 say WHY we're scraping so a logged-in user isn't left wondering: not signed in on
        // THIS origin → prompt; signed in but the API gave nothing → note it (geo / stale session).
        appendLog('Qobuz', signedIn
            ? `album/get returned no data despite being signed in — scraping instead (Qobuz may be geo-restricting this session)`
            : `not signed in to Qobuz on this site — scraping. Log in via ⚙ Setup → Auth for the reliable album/get path (track count + barcode)`,
            signedIn ? 'warn' : 'info');
    }
    const scraped = await fetchQobuzScrape(albumUrl);
    if (scraped) scraped._via = 'page';
    return scraped;
}
async function fetchQobuzScrape(albumUrl) {
    let r = await gmGet(qobuzStoreUrl(albumUrl));
    // Qobuz rate-limits very aggressively (429 after only a few requests, #201).
    // One polite retry honouring Retry-After; if it persists, report it distinctly
    // so the scanner can leave the row retryable instead of caching a false "no match".
    if (r.status === 429) {
        const ra = parseInt((String(r.responseHeaders || '').match(/retry-after:\s*(\d+)/i) || [])[1], 10);
        await new Promise(z => setTimeout(z, Math.min((ra > 0 ? ra : 3) * 1000, 10000)));
        r = await gmGet(qobuzStoreUrl(albumUrl));
    }
    if (r.status === 429) return { rateLimited: true };
    if (!r.ok || !r.responseText) return null;
    const html = r.responseText;
    // Track count: the page renders an empty duplicate of every track row for
    // its responsive layout, so the `track__info` blocks double-count. Each
    // real track instead carries a unique add-to-cart marker — count those.
    const trackIds = new Set([...html.matchAll(/popinAddToCartBtnPlayerTrack(\d+)/g)].map(m => m[1]));
    // Album name + year from the JSON-LD MusicAlbum block (clean, unlike og:title).
    let title = null, year = null;
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try { const j = JSON.parse(m[1]); if (/MusicAlbum/.test(j['@type'] || '')) { if (j.name) title = qzDec(j.name); if (j.datePublished) year = String(j.datePublished).slice(0, 4); } } catch (e) { /* skip */ }
    }
    // Artist: og:title is "<Album>, <Artist> - Qobuz"; strip the suffix and the
    // album-name prefix to leave the credit (VA pages read "Various Artists").
    const og = qzDec((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || '').replace(/\s*-\s*Qobuz\s*$/i, '');
    let artist = null;
    if (title && og.startsWith(title)) artist = og.slice(title.length).replace(/^[,\s]+/, '').trim() || null;
    else if (og.includes(',')) artist = og.slice(og.lastIndexOf(',') + 1).trim() || null;
    const label = qzDec((html.match(/href="\/[a-z]{2}-[a-z]{2}\/label\/[^"]+"[^>]*>\s*([^<]{1,80})/) || [])[1] || '').trim() || null;
    // `url` = the page we actually landed on after redirects — i.e. Qobuz's REAL
    // canonical /album/<slug>/<id> (the slug includes the artist, so we can't
    // reconstruct it from the title; #201 chaban-mb). The caller uses it as the URL
    // to hand MB instead of the /album/x/<id> placeholder we fetched with.
    return { tracks: trackIds.size || null, title: title || og || null, year, label, artist, barcode: null, url: r.finalUrl || null };
}

async function scanQobuz({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, barcode }) {
    const label = 'Qobuz';
    const cached = cacheGet(mbid, 'qobuz');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) { applyCachedRow('qobuz', label, cached, mbTracks); return; }
    if (cached && !cached.url && !existingUrl && !barcode) { appendLog(label, `No match (cached — ↻ to retry)`, 'warn'); applyCachedRow('qobuz', label, cached, mbTracks); return; }

    // Barcode-first: the API matches an exact UPC with no text-search ambiguity.
    // Qobuz indexes the UPC in its stored form, usually the 13-digit EAN with a
    // leading zero (e.g. MB's 199257198605 is "0199257198605" there), so a query
    // with MB's bare barcode misses — try the other GTIN paddings too (#354 shared
    // gtinVariants: raw · stripped · 12/13/14). Geo-dependent, so it falls through
    // to the normal search on no hit. #201 (chaban-mb)
    if (!existingUrl && barcode) {
        const queries = gtinVariants(barcode);
        let items = [];
        for (const q of queries) {
            const s = await qobuzApi(`album/search?query=${encodeURIComponent(q)}&limit=10`);
            items = s?.albums?.items || [];
            if (items.some(a => normBarcode(a.upc) === normBarcode(barcode))) break;
        }
        const hit = items.find(a => normBarcode(a.upc) === normBarcode(barcode)) || items[0];
        if (hit && hit.id) {
            // Qobuz's slug includes the artist, so it can't be rebuilt from the title
            // (#201 chaban-mb). Use the REAL slug the API returns (`slug` / `relative_url`);
            // if geo-stripped from the response, fall back to fetching /album/x/<id>
            // (Qobuz 301s it to the canonical URL) and keeping that landed URL.
            const fetchUrl = `https://www.qobuz.com/us-en/album/x/${hit.id}`;
            const meta = await fetchQobuzMeta(fetchUrl);
            const apiUrl = hit.slug ? `https://www.qobuz.com/us-en/album/${hit.slug}/${hit.id}`
                : (hit.relative_url ? `https://www.qobuz.com/us-en${hit.relative_url}` : null);
            const albumUrl = apiUrl || meta?.url || fetchUrl;
            appendLog(label, `Barcode ${barcode} → ${albumUrl}`, 'ok');
            const bc = meta?.barcode || hit.upc || barcode;
            cacheSet(mbid, 'qobuz', { url: albumUrl, tracks: meta?.tracks ?? null, year: meta?.year ?? null, label: meta?.label ?? null, source: 'barcode', barcode: bc });
            updateRow('qobuz', { url: albumUrl, mbTracks, remoteTracks: meta?.tracks ?? null, year: meta?.year ?? null, label: meta?.label ?? null, source: 'barcode', barcode: bc });
            return;
        }
        appendLog(label, `Barcode ${barcode}: no API hit — falling back to search`);
    }

    let albumUrl = existingUrl;
    let source   = null;
    let bestMeta = null;
    if (albumUrl) {
        appendLog(label, `Using existing MB URL: ${albumUrl}`, 'ok');
        source = 'MB rels';
    } else if (cached) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('qobuz', label, cached, mbTracks);
        return;
    } else {
        const albumT  = searchTerms(album);
        const artistT = searchTerms(artist);
        // Qobuz album URLs are /<store>/album/<slug>/<id>; the store prefix varies,
        // so we site-restrict to qobuz.com and keep only /album/.../<id> hits.
        const q = isVariousArtists
            ? `site:qobuz.com ${albumT} album`
            : `site:qobuz.com ${artistT} ${albumT}`;
        const candidates = await searchWeb(q, u => /qobuz\.com\/[a-z]{2}-[a-z]{2}\/album\/[^/]+\/[a-z0-9]+/i.test(u), label);
        if (!candidates.length) {
            cacheSet(mbid, 'qobuz', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('qobuz', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        appendLog(label, `Verifying ${candidates.length} candidate(s) by tracks + title + artist…`);
        const best = await pickBestCandidate(candidates, fetchQobuzMeta, mbTracks, album, label, artist, isVariousArtists);
        if (!best || best.score < 120) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'qobuz', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('qobuz', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.url;
        bestMeta = best.meta;
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 150 ? 'ok' : 'warn');
        source = 'search';
    }

    const meta = bestMeta || await fetchQobuzMeta(albumUrl);
    if (meta && meta.rateLimited) {
        // Don't cache — Qobuz throttled us, not a real "no match". ↻ retries. (#201)
        appendLog(label, `Rate-limited by Qobuz (429) — the link is set, track-count unverified; use ↻ to retry`, 'warn');
        updateRow('qobuz', { url: albumUrl, mbTracks, remoteTracks: null, source });
        return;
    }
    if (meta) {
        // #353 name the real source — "API album/get" (signed in; carries the barcode) vs "store page" scrape
        const via = meta._via === 'api' ? 'API album/get' : 'store page';
        appendLog(label, `Verified via ${via}: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}${meta.barcode ? ` barcode=${meta.barcode}` : ''}`, meta.tracks ? 'ok' : 'warn');
    } else {
        appendLog(label, `Album fetch failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    const bc     = meta?.barcode ?? null;   // UPC from the API (null on the scrape fallback) — feeds barcode-confidence #201
    cacheSet(mbid, 'qobuz', { url: albumUrl, tracks, year, label: lbl, source, barcode: bc });
    updateRow('qobuz', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source, barcode: bc });
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

async function scanDiscogs({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, format, barcode, existingDiscogsMaster }) {
    const label = 'Discogs';
    appendLog(label, `Existing RG master: ${existingDiscogsMaster || 'none'}`);

    // Surface the existing release-group Discogs master immediately — it's the
    // authoritative RG-level link (use it, same as any existing MB rel), and it
    // shouldn't depend on whether we manage to resolve a Discogs *release*.
    if (existingDiscogsMaster) {
        const mEl = document.getElementById('master-discogs');
        if (mEl) applyMasterIcon(mEl, discogsMasterState(null, existingDiscogsMaster));
    }

    // Positive cache hit short-circuits before any API call. Cached "no
    // match" only short-circuits when there's no MB rel either — we still
    // want a freshly-added MB rel to replace a stale no-match.
    //
    // Format-mismatch invalidation: if the cached release's format differs
    // from the MB release format (e.g. cache holds a Vinyl pressing but MB
    // says CD — possible when a prior scan ran without format extraction),
    // re-search so format-aware ranking can pick the matching edition.
    const cached = cacheGet(mbid, 'discogs');
    const wantFmt = mbFormatToDiscogs(format);
    const haveFmt = mbFormatToDiscogs(cached?.format);
    const formatMismatch = !!(wantFmt && haveFmt && wantFmt !== haveFmt && cached?.url && !existingUrl);
    if (formatMismatch) {
        appendLog(label, `Cached match is ${haveFmt} but MB format is ${wantFmt} — re-scanning`, 'warn');
    } else if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
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
        // Barcode-first (#182): Discogs' search API supports `barcode=<UPC>` — an exact
        // match, preferred over the text search (which can pick a different pressing of
        // the same title). Falls through to the text search when there's no UPC hit.
        if (barcode) {
            const bu = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(barcode)}&type=release&per_page=5`;
            appendLog(label, `Barcode ${barcode}: ${bu}`);
            const br = await gmGet(bu);
            if (br.ok) {
                try {
                    const bres = JSON.parse(br.responseText).results || [];
                    let bbest = null;
                    for (const r of bres.slice(0, 8)) {
                        const [artistPart, ...albumParts] = (r.title || '').split(' - ');
                        const sc = scoreCandidate({ title: albumParts.join(' - '), artist: artistPart }, mbTracks, album, artist, isVariousArtists);
                        if (!bbest || sc > bbest.score) bbest = { score: sc, item: r };
                    }
                    if (bbest && bbest.score >= 50) {
                        releaseId  = String(bbest.item.id);
                        releaseUrl = `https://www.discogs.com/release/${releaseId}`;
                        source     = 'barcode';
                        appendLog(label, `Barcode ${barcode} → ${releaseUrl}`, 'ok');
                    } else appendLog(label, `Barcode ${barcode}: ${bres.length ? 'no confident match' : 'no result'} — falling back to text search`);
                } catch (e) { appendLog(label, `Barcode search parse error: ${e.message}`, 'error'); }
            } else appendLog(label, `Barcode ${barcode} search failed — falling back to text search`, 'warn');
        }
        if (!releaseUrl) {   // (#182) text search only when barcode-first didn't resolve
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
                // Score every result by parsing its `title` ("Artist - Album")
                // and matching against MB artist + album. Discogs search
                // results don't expose track count, so we score on title +
                // artist only — the detail fetch later will catch a track
                // mismatch separately. Picking the *best* candidate (rather
                // than blindly taking results[0]) fixes the "13-track Mista
                // Savona release picked for a 4-track Om Unit album" bug.
                const candidates = (data.results || []).slice(0, 8);
                let best = null;
                for (const r of candidates) {
                    const [artistPart, ...albumParts] = (r.title || '').split(' - ');
                    const albumPart = albumParts.join(' - ');
                    const sc = scoreCandidate({ title: albumPart, artist: artistPart }, mbTracks, album, artist, isVariousArtists);
                    appendLog(label, `  cand score=${sc}  id=${r.id}  artist="${artistPart}"  album="${albumPart}"  format=${(r.format || []).join(',')}`);
                    if (!best || sc > best.score) best = { score: sc, item: r };
                    if (sc >= 150) break;
                }
                if (best && best.score >= 50) {
                    releaseId  = String(best.item.id);
                    releaseUrl = `https://www.discogs.com/release/${releaseId}`;
                    source     = discogsFmt && (best.item.format || []).some(f => mbFormatToDiscogs(f) === discogsFmt)
                        ? `API search (format=${discogsFmt})`
                        : 'API search';
                    appendLog(label, `Found via API (score=${best.score}): ${releaseUrl}`, 'ok');
                } else if (candidates.length) {
                    appendLog(label, `Top candidate score=${best?.score ?? 'n/a'} below 50 threshold — no confident match`, 'warn');
                } else {
                    appendLog(label, `API search returned 0 results`, 'warn');
                }
            } catch (e) { appendLog(label, `API JSON parse error: ${e.message}`, 'error'); }
        } else {
            appendLog(label, `API search failed`, 'error');
        }
        }   // (#182) end of barcode-first guard around the text search
        if (!releaseUrl) {
            // searchWeb returns an ARRAY of filtered candidate URLs (not a single string). The old code
            // did `if (fallback) { fallback.match(...) }` — but `[]` is truthy, so an empty result threw a
            // TypeError that aborted the whole scan before the not-found render below. Take the first hit.
            const candidates = await searchWeb(`site:discogs.com release ${artist} ${album}`, u => /www\.discogs\.com\/release\/\d+/.test(u) || /www\.discogs\.com\/.*\/release\/\d+/.test(u), label);
            const hit = candidates[0];
            if (hit) {
                releaseUrl = hit;
                const m = hit.match(/\/release\/(\d+)/);
                if (m) releaseId = m[1];
                source = 'web search';
            }
        }
    }

    if (!releaseUrl) {
        cacheSet(mbid, 'discogs', { url: null, tracks: null, year: null, label: null, source: 'search' });
        // Even with no resolved release, surface the existing RG-level Discogs master.
        updateRow('discogs', { url: null, mbTracks, remoteTracks: null,
            masterState: discogsMasterState(null, existingDiscogsMaster) });
        return;
    }

    let tracks = null, year = null, lbl = null, fmt = null, masterUrl = null, foundBarcode = null;
    if (releaseId) {
        const detailUrl = `https://api.discogs.com/releases/${releaseId}`;
        appendLog(label, `API detail: ${detailUrl}`);
        const dr = await gmGet(detailUrl);
        appendLog(label, `API detail: status=${dr.status} ${dr.responseText.length}b in ${dr.ms}ms`);
        if (dr.ok) {
            try {
                const data = JSON.parse(dr.responseText);
                // Discogs tracklist entries have type_ values "track" (normal),
                // "index" (a parent of sub_tracks, used for medleys like the
                // 9a/9b/9c entries on Essiebons Special — a single MB
                // position 9 with 3 songs underneath), and "heading" (section
                // dividers). MB counts the medley parent as one position, so
                // include both "track" and "index" — exclude only "heading".
                const trk = (data.tracklist || []).filter(t => t.type_ === 'track' || t.type_ === 'index' || !t.type_);
                tracks = trk.length || null;
                year   = data.year || null;
                lbl    = (data.labels || []).map(l => l.name).join(', ') || null;
                // Discogs `formats` is an array of {name, qty, descriptions}.
                // We only want the headline — qty + name (e.g. "2×Vinyl") — and
                // skip the pressing-detail descriptions ('12"', '33 ⅓ RPM',
                // 'Mini-Album', etc.) that bloat the meta line without adding
                // useful info for verifying it's the right release.
                fmt = (data.formats || []).map(f => {
                    return (f.qty && f.qty !== '1' ? `${f.qty}×` : '') + (f.name || '');
                }).join(', ') || null;
                // Master URL — points at the release-group equivalent on Discogs.
                // Stored so the + flow can offer to add it to MB's release-group
                // url-rels (a separate edit page from the release).
                if (data.master_id) masterUrl = `https://www.discogs.com/master/${data.master_id}`;
                // Barcode (#182): Discogs publishes it in `identifiers` ([{type:"Barcode", value}]).
                // Capturing it lets the barcode-confidence check compare/confirm Discogs like the
                // other barcode-exposing providers (previously it was treated as unconfirmable).
                foundBarcode = ((data.identifiers || []).find(i => /^barcode$/i.test(i.type || '')) || {}).value || null;
                if (foundBarcode) foundBarcode = String(foundBarcode).replace(/\s+/g, '');
                appendLog(label, `API detail parsed: tracks=${tracks} year=${year || '?'} label=${lbl || '?'} format=${fmt || '?'} barcode=${foundBarcode || '-'} master=${masterUrl || '-'}`, 'ok');
            } catch (e) { appendLog(label, `API detail parse error: ${e.message}`, 'error'); }
        } else { appendLog(label, `API detail failed`, 'error'); }
    }

    cacheSet(mbid, 'discogs', { url: releaseUrl, tracks, year, label: lbl, format: fmt, masterUrl, source, barcode: foundBarcode });
    updateRow('discogs', {
        url: releaseUrl, mbTracks, remoteTracks: tracks, year, label: lbl, format: fmt, source, barcode: foundBarcode,
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
    const titleMatch = html.match(/"@type"\s*:\s*"MusicAlbum"[\s\S]{0,200}?"name"\s*:\s*"([^"]+)"/)
                    || html.match(/<meta\s+name="title"\s+content="([^"|]+)/);
    const yMatch = html.match(/"datePublished"\s*:\s*"[^"]*?(\d{4})\b/);
    const lMatch = html.match(/"recordLabel"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/);
    // Album artist comes from JSON-LD `"byArtist":{"name":"…"}` (the band/
    // label that hosts the page may differ from the album artist on
    // multi-artist labels, so prefer byArtist).
    const artistMatch = html.match(/"byArtist"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/)
                     || html.match(/<meta\s+name="Description"\s+content="from\s+([^"|,]+)/i);
    const formats = [...new Set(
        [...html.matchAll(/"musicReleaseFormat"\s*:\s*"(\w+)"/g)]
            .map(m => m[1].replace(/Format$/, ''))
    )];
    // Hidden download-only tracks (#183): the JSON-LD `numTracks` (and the player's
    // trackinfo) only count STREAMABLE tracks, but the og:description meta tag —
    // "N track album" — carries the REAL total including bonus tracks that are only
    // in the download. So total − streaming = hidden. (Only trust the tag when it
    // matches "N track album"; an artist-set custom description won't, and we just
    // fall back to numTracks.) Same signal Harmony / bandcamp_importer use.
    const streaming = numTracksMatch ? parseInt(numTracksMatch[1], 10) : null;
    const ogTag = html.match(/<meta[^>]+property=["']og:description["'][^>]*>/i)?.[0] || '';
    const ogTotal = (ogTag.match(/content=["']\s*(\d+)\s+track\b/i) || [])[1];
    const total = ogTotal ? parseInt(ogTotal, 10) : null;
    const hiddenTracks = (total != null && streaming != null && total > streaming) ? total - streaming : 0;
    // Barcode (#194): the UPC lives in TralbumData.current.upc — embedded in the
    // page's `data-tralbum` attribute (entity-encoded JSON), not the JSON-LD.
    // Often null (Bandcamp barcodes are hand-entered). Per Harmony (kellnerd/harmony#42)
    // the digital `current.upc` can coincide with a physical package's barcode —
    // when it does, it's the package's, not the digital release's, so we drop it.
    let barcode = null, barcodeIsPackage = false;
    const trm = html.match(/data-tralbum="([^"]*)"/);
    if (trm) {
        try {
            const tr = JSON.parse(trm[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));
            const upc = tr && tr.current && tr.current.upc;
            if (upc) {
                const pkgUpcs = (tr.packages || []).map(pp => normBarcode(pp && pp.upc)).filter(Boolean);
                if (pkgUpcs.includes(normBarcode(upc))) barcodeIsPackage = true;   // physical package's barcode — not the digital release's
                else barcode = String(upc).trim();
            }
        } catch (e) { /* malformed data-tralbum — no barcode */ }
    }
    return {
        // report the true total (incl. hidden) as the track count — that's what the
        // Bandcamp release actually contains, and what MB compares against.
        tracks: total != null ? total : streaming,
        streamingTracks: streaming,
        hiddenTracks,
        title:  titleMatch?.[1] || null,
        year:   yMatch?.[1]     || null,
        label:  lMatch?.[1]     || null,
        format: formats.length ? formats.join(', ') : null,
        artist: artistMatch?.[1]?.trim() || null,
        barcode,
        barcodeIsPackage,
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
        appendLog(label, `Verifying ${candidates.length} candidate(s) by tracks + title + artist…`);
        const best = await pickBestCandidate(candidates, fetchBandcampMeta, mbTracks, album, label, artist, isVariousArtists);
        if (!best || best.score < 120) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'bandcamp', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('bandcamp', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.url;
        bestMeta = best.meta;
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 150 ? 'ok' : 'warn');
        source = candidateSource;
    }

    const meta = bestMeta || await fetchBandcampMeta(albumUrl);
    const hidden = meta?.hiddenTracks || 0;
    if (meta) {
        const trk = hidden > 0 ? `${meta.tracks} (${meta.streamingTracks} streaming + ${hidden} download-only hidden)` : `${meta.tracks}`;
        appendLog(label, `Album parsed: tracks=${trk} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'} format=${meta.format || '?'} barcode=${meta.barcode || (meta.barcodeIsPackage ? 'package-only (ignored)' : '-')}`, meta.tracks ? 'ok' : 'warn');
        if (hidden > 0) appendLog(label, `${hidden} download-only track(s) hidden from streaming — Bandcamp release has ${meta.tracks}, not ${meta.streamingTracks}`, 'warn');
        if (meta.barcodeIsPackage) appendLog(label, `current.upc matches a physical package's barcode — not the digital release's, so ignored (harmony#42)`, 'warn');
    } else {
        appendLog(label, `Album page failed`, 'error');
    }
    const tracks = meta?.tracks ?? null;
    const year   = meta?.year   ?? null;
    const lbl    = meta?.label  ?? null;
    const fmt    = meta?.format ?? null;
    const bc     = meta?.barcode ?? null;   // #194: digital release UPC (null when absent or package-only)
    cacheSet(mbid, 'bandcamp', { url: albumUrl, tracks, year, label: lbl, format: fmt, source, hiddenTracks: hidden, barcode: bc });
    updateRow('bandcamp', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, format: fmt, source, hiddenTracks: hidden, barcode: bc });
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
            artist: d.artist?.name || null,
            barcode: d.upc || null,
        };
    } catch { return null; }
}

async function scanDeezer({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, barcode }) {
    const label = 'Deezer';

    const cached = cacheGet(mbid, 'deezer');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('deezer', label, cached, mbTracks);
        return;
    }
    if (cached && !cached.url && !existingUrl && !barcode) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('deezer', label, cached, mbTracks);
        return;
    }

    // Barcode-first: Deezer's `album/upc:<UPC>`. NOTE it is NOT reliably exact — for a
    // barcode it doesn't have, Deezer sometimes returns an UNRELATED album instead of an
    // error (e.g. upc:827565029525 → "Ayamma", whose real UPC is 885686990360). So trust
    // the hit only when the returned album's OWN upc matches what we asked for; otherwise
    // treat it as no barcode match and fall through to the artist+album search.
    if (!existingUrl && barcode) {
        // #354: try the raw barcode first, then the other GTIN paddings on a miss. Each
        // hit is accepted only when the returned album's OWN upc matches (Deezer's
        // album/upc: can hand back an unrelated album for a barcode it lacks — #356).
        const bd = await upcTry(barcode, async (u) => {
            const br = await gmGet(`https://api.deezer.com/album/upc:${u}`);
            let d = null; try { d = JSON.parse(br.responseText); } catch {}
            if (!(d && d.id && !d.error)) return null;
            if (normBarcode(d.upc) === normBarcode(barcode)) return d;
            appendLog(label, `Barcode ${u}: Deezer returned a different-barcode album (upc ${d.upc || '?'}, "${d.title || ''}") — ignoring`, 'warn');
            return null;
        });
        if (bd) {
            const albumUrl = bd.link || `https://www.deezer.com/album/${bd.id}`;
            appendLog(label, `Barcode ${barcode} → ${albumUrl}`, 'ok');
            const meta = await fetchDeezerMeta(albumUrl);
            const bc = bd.upc || meta?.barcode || barcode;
            cacheSet(mbid, 'deezer', { url: albumUrl, tracks: meta?.tracks ?? null, year: meta?.year ?? null, label: meta?.label ?? null, source: 'barcode', barcode: bc });
            updateRow('deezer', { url: albumUrl, mbTracks, remoteTracks: meta?.tracks ?? null, year: meta?.year ?? null, label: meta?.label ?? null, source: 'barcode', barcode: bc });
            return;
        }
        appendLog(label, `Barcode ${barcode}: no UPC match — falling back to search`);
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
        // Search results already carry nb_tracks + title + artist so no
        // per-candidate detail fetch needed at this stage.
        let best = null;
        for (const it of results) {
            const sc = scoreCandidate({ tracks: it.nb_tracks, title: it.title, artist: it.artist?.name }, mbTracks, album, artist, isVariousArtists);
            appendLog(label, `  cand score=${sc}  tracks=${it.nb_tracks ?? '?'}  artist="${it.artist?.name || '?'}"  title="${it.title}"  url=${it.link}`);
            if (!best || sc > best.score) best = { score: sc, item: it };
            if (sc >= 150) break;
        }
        if (!best || best.score < 120) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'deezer', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('deezer', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        albumUrl = best.item.link;
        source = 'API search';
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 150 ? 'ok' : 'warn');
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
    cacheSet(mbid, 'deezer', { url: albumUrl, tracks, year, label: lbl, source, barcode: meta?.barcode ?? null });
    updateRow('deezer', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source, barcode: meta?.barcode ?? null });
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
            label:  stripCopyright(a.copyright),
            artist: a.artistName || null,
        };
    } catch { return null; }
}

async function scanApple({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, wikidataAppleId, barcode }) {
    const label = 'Apple';

    const cached = cacheGet(mbid, 'apple');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) {
        applyCachedRow('apple', label, cached, mbTracks);
        return;
    }
    if (cached && !cached.url && !existingUrl && !barcode) {
        appendLog(label, `No match (cached from previous scan — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('apple', label, cached, mbTracks);
        return;
    }

    // Barcode-first: iTunes `lookup?upc=<UPC>` is an exact match. Falls through
    // to the term search (and Wikidata) when there's no UPC hit.
    if (!existingUrl && !wikidataAppleId && barcode) {
        // #354: try the raw barcode first, then the other GTIN paddings on a miss.
        const hit = await upcTry(barcode, async (u) => {
            const br = await gmGet(`https://itunes.apple.com/lookup?upc=${u}&entity=album`);
            let d = null; try { d = JSON.parse(br.responseText); } catch {}
            return (d && (d.results || []).find(r => r.collectionViewUrl)) || null;
        });
        if (hit) {
            const albumUrl = hit.collectionViewUrl.split('?')[0];
            appendLog(label, `Barcode ${barcode} → ${albumUrl}`, 'ok');
            const meta = await fetchAppleMeta(albumUrl);
            cacheSet(mbid, 'apple', { url: albumUrl, tracks: meta?.tracks ?? null, year: meta?.year ?? null, label: meta?.label ?? null, source: 'barcode' });
            updateRow('apple', { url: albumUrl, mbTracks, remoteTracks: meta?.tracks ?? null, year: meta?.year ?? null, label: meta?.label ?? null, source: 'barcode' });
            return;
        }
        appendLog(label, `Barcode ${barcode}: no UPC match — falling back to search`);
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
            const sc = scoreCandidate({ tracks: it.trackCount, title: it.collectionName, artist: it.artistName }, mbTracks, album, artist, isVariousArtists);
            appendLog(label, `  cand score=${sc}  tracks=${it.trackCount ?? '?'}  artist="${it.artistName || '?'}"  title="${it.collectionName}"  url=${it.collectionViewUrl}`);
            if (!best || sc > best.score) best = { score: sc, item: it };
            if (sc >= 150) break;
        }
        if (!best || best.score < 120) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'apple', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('apple', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        // Strip the `?uo=4` affiliate tail that iTunes Search returns on
        // collectionViewUrl — MB normalises to the clean form.
        albumUrl = best.item.collectionViewUrl.split('?')[0];
        source = 'API search';
        appendLog(label, `Picked best (score=${best.score}): ${albumUrl}`, best.score >= 150 ? 'ok' : 'warn');
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

// ─── Tidal ──────────────────────────────────────────────────────────────────
// Official API (JSON:API). All calls need an app token (client-credentials), so
// catalog reads are anonymous to the user. Existing MB URL → Wikidata P4577 →
// searchResults API. Each candidate album carries title + numberOfItems inline,
// so scoring needs no per-candidate fetch (like Deezer); the picked album is
// then fetched once for year/label.
async function fetchTidalAlbumMeta(albumId, token) {
    const r = await gmGet(`${TIDAL.api}/albums/${albumId}?countryCode=${TIDAL.country}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' } });
    if (!r.ok) return null;
    try {
        const a = JSON.parse(r.responseText)?.data?.attributes;
        if (!a) return null;
        const lbl = stripCopyright(a.copyright?.text);
        return { tracks: a.numberOfItems ?? null, title: a.title || null, year: a.releaseDate ? a.releaseDate.slice(0, 4) : null, label: lbl, barcode: a.barcodeId || null };
    } catch { return null; }
}
// Barcode-first (#182): Tidal v2 /albums?filter[barcodeId] is an exact match.
async function tidalAlbumByBarcode(barcode, token) {
    const r = await gmGet(`${TIDAL.api}/albums?countryCode=${TIDAL.country}&filter%5BbarcodeId%5D=${encodeURIComponent(barcode)}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' } });
    if (!r.ok) return null;
    try { const a = (JSON.parse(r.responseText).data || [])[0]; return a ? { id: a.id, barcode: a.attributes?.barcodeId || barcode } : null; }
    catch { return null; }
}
async function scanTidal({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, wikidataTidalId, barcode }) {
    const label = 'Tidal';
    const cached = cacheGet(mbid, 'tidal');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) { applyCachedRow('tidal', label, cached, mbTracks); return; }
    if (cached && !cached.url && !existingUrl && !wikidataTidalId) {
        appendLog(label, `No match (cached — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('tidal', label, cached, mbTracks); return;
    }

    const idFromUrl = u => (String(u || '').match(/tidal\.com\/(?:browse\/)?album\/(\d+)/) || [])[1];

    let albumId = null, source = null, foundBarcode = null;
    // Barcode-first (#182): an exact-UPC hit beats Wikidata/search (which may
    // point at a different-barcode edition). Only when there's no MB rel.
    if (!existingUrl && barcode) {
        const tok = await tidalToken();
        if (tok) {
            const hit = await tidalAlbumByBarcode(barcode, tok);
            if (hit) { albumId = hit.id; source = 'barcode'; foundBarcode = hit.barcode || barcode; appendLog(label, `Barcode ${barcode} → album ${albumId}`, 'ok'); }
            else appendLog(label, `Barcode ${barcode}: no Tidal UPC match — falling back`);
        }
    }
    if (!albumId && existingUrl) {
        albumId = idFromUrl(existingUrl); source = 'MB rels';
        appendLog(label, `Using existing MB URL: ${existingUrl}`, 'ok');
    } else if (!albumId && wikidataTidalId) {
        albumId = wikidataTidalId; source = 'Wikidata';
        appendLog(label, `Wikidata answer: album ${albumId}`, 'ok');
    } else if (!albumId) {
        // Only the SEARCH path needs a token — an existing/Wikidata URL is shown
        // (and circled, for MB rels) even if the token grant fails.
        const token = await tidalToken();
        if (!token) { updateRow('tidal', { url: null, mbTracks, remoteTracks: null }); return; }
        const q = isVariousArtists ? album : `${artist} ${album}`;
        const searchUrl = `${TIDAL.api}/searchResults/${encodeURIComponent(q)}?countryCode=${TIDAL.country}&include=albums`;
        appendLog(label, `API search: ${searchUrl}`);
        const sr = await gmGet(searchUrl, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' } });
        appendLog(label, `API search: status=${sr.status} ${sr.responseText.length}b in ${sr.ms}ms`);
        if (!sr.ok) { cacheSet(mbid, 'tidal', { url: null, tracks: null, year: null, label: null, source: 'API search' }); updateRow('tidal', { url: null, mbTracks, remoteTracks: null }); return; }
        let albums = [];
        try {
            const data = JSON.parse(sr.responseText);
            const order = (data.data?.relationships?.albums?.data || []).map(d => d.id);
            const byId = {};
            (data.included || []).forEach(x => { if (x.type === 'albums') byId[x.id] = x.attributes || {}; });
            albums = order.map(id => ({ id, attr: byId[id] })).filter(x => x.attr);
        } catch (e) { appendLog(label, `API JSON parse error: ${e.message}`, 'error'); updateRow('tidal', { url: null, mbTracks, remoteTracks: null }); return; }
        appendLog(label, `API search: ${albums.length} candidate(s)`);
        let best = null;
        for (const it of albums) {
            const sc = scoreCandidate({ tracks: it.attr.numberOfItems, title: it.attr.title, artist: null }, mbTracks, album, artist, isVariousArtists);
            appendLog(label, `  cand score=${sc}  tracks=${it.attr.numberOfItems ?? '?'}  title="${it.attr.title}"  id=${it.id}`);
            if (!best || sc > best.score) best = { score: sc, id: it.id };
            if (sc >= 150) break;
        }
        if (!best || best.score < 120) {
            appendLog(label, `No verifiable match (best score=${best?.score ?? 'n/a'}) — leaving URL unset`, 'warn');
            cacheSet(mbid, 'tidal', { url: null, tracks: null, year: null, label: null, source: 'API search' });
            updateRow('tidal', { url: null, mbTracks, remoteTracks: null }); return;
        }
        albumId = best.id; source = 'API search';
        appendLog(label, `Picked best (score=${best.score}): album ${albumId}`, best.score >= 150 ? 'ok' : 'warn');
    }

    if (!albumId) { updateRow('tidal', { url: null, mbTracks, remoteTracks: null }); return; }
    const albumUrl = `https://tidal.com/album/${albumId}`;
    // Track-count/year/label are best-effort — needs a token, but its absence
    // must NOT drop an existing/Wikidata link (it just stays count-unverified).
    const metaTok = await tidalToken();
    const meta = metaTok ? await fetchTidalAlbumMeta(albumId, metaTok) : null;
    if (meta) appendLog(label, `Album parsed: tracks=${meta.tracks} title="${meta.title}" year=${meta.year || '?'} label=${meta.label || '?'}`, meta.tracks ? 'ok' : 'warn');
    else appendLog(label, `Detail unavailable (no token / fetch failed) — showing URL without track count`, 'warn');
    const tracks = meta?.tracks ?? null, year = meta?.year ?? null, lbl = meta?.label ?? null;
    const bc = foundBarcode || meta?.barcode || null;
    cacheSet(mbid, 'tidal', { url: albumUrl, tracks, year, label: lbl, source, barcode: bc });
    updateRow('tidal', { url: albumUrl, mbTracks, remoteTracks: tracks, year, label: lbl, source, barcode: bc });
}

// ─── Beatport ─────────────────────────────────────────────────────────────────
// Logged in (⚙ setup → Beatport account): the official API gives track counts, so
// matches are VERIFIED (→ the + insert works) — resolved by barcode, then artist+album
// search, and an existing MB-rel/Wikidata id is verified too. Not logged in: Beatport's
// pages are Cloudflare-walled (unfetchable), so we fall back to MB rel → Wikidata (P11312)
// → web search, surfaced UNVERIFIED (no track count).
async function scanBeatport({ artist, album, existingUrl, mbTracks, mbid, isVariousArtists, wikidataBeatportId, barcode }) {
    const label = 'Beatport';
    const cached = cacheGet(mbid, 'beatport');
    const idFromUrl = u => (String(u || '').match(/beatport\.com\/release\/[^/]+\/(\d+)/) || [])[1];
    // A cached hit short-circuits — EXCEPT when we're now logged in and the
    // cached entry was never track-count verified (e.g. a web-search result
    // cached while logged out, tracks=null). In that case fall through to the
    // authed API below to upgrade it to a verified match, reusing the cached
    // URL's release id, instead of leaving it UNVERIFIED forever (#168).
    const cachedUnverified = !!(cached?.url && cached.tracks == null && bpLoggedIn());
    if (cached?.url && (!existingUrl || existingUrl === cached.url) && !cachedUnverified) { applyCachedRow('beatport', label, cached, mbTracks); return; }
    if (cached && !cached.url && !existingUrl && !wikidataBeatportId && !bpLoggedIn()) {
        appendLog(label, `No match (cached — use ↻ to force a re-search)`, 'warn');
        applyCachedRow('beatport', label, cached, mbTracks); return;
    }
    if (cachedUnverified) appendLog(label, `Cached match is unverified — re-checking via API now that you're logged in`);

    let relId  = existingUrl ? idFromUrl(existingUrl) : (wikidataBeatportId || (cachedUnverified ? idFromUrl(cached.url) : null));
    let url    = existingUrl || (cachedUnverified ? cached.url : null);
    let source = existingUrl ? 'MB rels' : (wikidataBeatportId ? 'Wikidata' : (cachedUnverified ? (cached.source || 'cache') : null));

    // ── Authed: official API → verified track count ──
    if (bpLoggedIn()) {
        let rel = null;
        if (!relId) {
            if (barcode) {
                const s = await beatportApi(`/catalog/search/?q=${encodeURIComponent(barcode)}&type=releases&per_page=5`);
                rel = (s && (s.releases || []).find(r => String(r.upc) === String(barcode))) || null;
                if (rel) { source = 'barcode'; appendLog(label, `Barcode ${barcode} → release ${rel.id} "${rel.name}"`, 'ok'); }
            }
            if (!rel) {
                const q = isVariousArtists ? album : `${artist} ${album}`;
                const s = await beatportApi(`/catalog/search/?q=${encodeURIComponent(q)}&type=releases&per_page=10`);
                const cands = (s && s.releases) || [];
                appendLog(label, `API search: ${cands.length} candidate(s)`);
                let best = null;
                for (const it of cands) {
                    const sc = scoreCandidate({ tracks: it.track_count, title: it.name, artist: (it.artists || []).map(a => a.name).join(' ') }, mbTracks, album, artist, isVariousArtists);
                    if (!best || sc > best.score) best = { score: sc, it };
                    if (sc >= 150) break;
                }
                if (best && best.score >= 120) { rel = best.it; source = 'API search'; appendLog(label, `Picked best (score=${best.score}): release ${rel.id}`, best.score >= 150 ? 'ok' : 'warn'); }
            }
        }
        // Verify via detail — covers an MB-rel / Wikidata id, and fills the count for a search hit.
        const detail = rel || (relId ? await beatportApi(`/catalog/releases/${relId}/`) : null);
        if (detail) {
            const slug = detail.slug || (url && (url.match(/\/release\/([^/]+)\//) || [])[1]) || '-';
            url = `https://www.beatport.com/release/${slug}/${detail.id}`;
            const tracks = detail.track_count != null ? detail.track_count : ((detail.tracks || []).length || null);
            const year = String(detail.new_release_date || detail.publish_date || '').slice(0, 4) || null;
            const lbl = detail.label?.name || null;
            const bc = detail.upc || (source === 'barcode' ? barcode : null);   // (#182) Beatport exposes the UPC
            appendLog(label, `Verified: tracks=${tracks} year=${year || '?'} label=${lbl || '?'}${bc ? ` upc=${bc}` : ''}`, tracks ? 'ok' : 'warn');
            cacheSet(mbid, 'beatport', { url, tracks, year, label: lbl, source, barcode: bc });
            updateRow('beatport', { url, mbTracks, remoteTracks: tracks, year, label: lbl, source, barcode: bc });
            return;
        }
        // authed but the API found nothing & no rel id → fall through to the no-auth resolvers
    }

    // ── Not authed (or API miss): MB rel → Wikidata → web search, UNVERIFIED ──
    if (!url && wikidataBeatportId) { url = `https://www.beatport.com/release/-/${wikidataBeatportId}`; source = 'Wikidata'; appendLog(label, `Wikidata answer: release ${wikidataBeatportId}`, 'ok'); }
    if (!url) {
        const q = `site:beatport.com/release/ ${searchTerms(artist)} ${searchTerms(album)}`;
        const hits = await searchWeb(q, u => /^https?:\/\/(?:www\.)?beatport\.com\/release\/[^/]+\/\d+/i.test(u), label, 5);
        if (!hits.length) {
            appendLog(label, `No match — no MB rel, no Wikidata P11312, no search hit`, 'warn');
            cacheSet(mbid, 'beatport', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('beatport', { url: null, mbTracks, remoteTracks: null });
            return;
        }
        // #380 DDG often returns unrelated releases (its fuzzy match), and repeating it trips Beatport's
        // protections — so the hit is untrustworthy. REQUIRE the release slug to actually match the album
        // (don't blindly take hits[0], which was returning e.g. "hard-trance-sessions-vol-1" for an African
        // comp). If none match, report no-match rather than a wrong release.
        const slugOf = u => decodeURIComponent((u.match(/\/release\/([^/]+)\//) || [])[1] || '').replace(/-/g, ' ');
        // min-mode: most of the (short) slug's tokens must appear in the album title — lenient enough for a
        // short official slug vs a long MB title, but rejects an unrelated release that shares ~nothing.
        let pick = null;
        for (const h of hits) { if (tokenMatch(slugOf(h), album, 'min', 0.6)) { pick = h; break; } }
        if (!pick) {
            appendLog(label, `Search hits didn't match “${album}” (top: ${slugOf(hits[0])}) — skipping to avoid a wrong release (#380)`, 'warn');
            cacheSet(mbid, 'beatport', { url: null, tracks: null, year: null, label: null, source: 'search' });
            updateRow('beatport', { url: null, mbTracks, remoteTracks: null, source: 'search' });
            return;
        }
        url = pick.split(/[?#]/)[0]; source = 'search';
        // #380 if we happen to be logged in, verify the search hit against the API before trusting it
        if (bpLoggedIn()) {
            const vid = idFromUrl(url), detail = vid ? await beatportApi(`/catalog/releases/${vid}/`) : null;
            if (detail) {
                const sc = scoreCandidate({ tracks: detail.track_count, title: detail.name, artist: (detail.artists || []).map(a => a.name).join(' ') }, mbTracks, album, artist, isVariousArtists);
                if (sc < 100) {
                    appendLog(label, `Search hit "${detail.name}" failed API verification (score=${sc}) — rejecting (#380)`, 'warn');
                    cacheSet(mbid, 'beatport', { url: null, tracks: null, year: null, label: null, source: 'search' });
                    updateRow('beatport', { url: null, mbTracks, remoteTracks: null, source: 'search' });
                    return;
                }
                const tracks = detail.track_count != null ? detail.track_count : ((detail.tracks || []).length || null);
                const year = String(detail.new_release_date || detail.publish_date || '').slice(0, 4) || null;
                const lbl = detail.label?.name || null, bc = detail.upc || null;
                appendLog(label, `Search hit verified via API (score=${sc}): tracks=${tracks} year=${year || '?'}`, 'ok');
                cacheSet(mbid, 'beatport', { url, tracks, year, label: lbl, source: 'search+api', barcode: bc });
                updateRow('beatport', { url, mbTracks, remoteTracks: tracks, year, label: lbl, source: 'search+api', barcode: bc });
                return;
            }
        }
        appendLog(label, `Found via search (UNVERIFIED — log in via ⚙ for track-count verification): ${url}`, 'warn');
    } else if (source === 'MB rels') {
        appendLog(label, `Using existing MB URL: ${url}`, 'ok');
    }
    cacheSet(mbid, 'beatport', { url, tracks: null, year: null, label: null, source });
    updateRow('beatport', { url, mbTracks, remoteTracks: null, source });
}

// ─── Volumo ─────────────────────────────────────────────────────────────────
// Electronic-music store with a clean, unauthenticated JSON API
// (volumo.com/api/v1) — no Cloudflare, no captcha, no token. A release lookup
// returns the full tracklist (with ISRCs) in one call. We resolve by existing
// MB rel → barcode (ICPN) → artist+album search. Volumo's canonical page is
// /album/{icpn}-{slug}, but the bare /album/{id} form 308-redirects to it.
// #202: MB doesn't normalize Volumo URLs yet (MBS-14369), so we emit the
// clean, slug-less /album/{id} form ourselves — drop the human-readable
// "-{slug}" tail (it's purely cosmetic and only invites duplicate-link noise).
// {id} is the ICPN (barcode) when known, else Volumo's internal album id.
const volumoUrl   = a => a && a.icpn ? `https://volumo.com/album/${a.icpn}` : (a && a.id ? `https://volumo.com/album/${a.id}` : null);
// Normalize any Volumo album URL to that slug-less form so a slugged MB rel and
// our clean URL compare equal (avoids a false "differs" / re-add).
const volumoClean = u => { const m = String(u || '').match(/\/album\/(\d+)/i); return m ? `https://volumo.com/album/${m[1]}` : (u || null); };
async function volumoApi(path) { const r = await gmGet('https://volumo.com/api/v1' + path); if (!r.ok) return null; try { const j = JSON.parse(r.responseText); return Array.isArray(j) ? j[0] : (j.album || j); } catch { return null; } }
async function scanVolumo({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, barcode }) {
    const label = 'Volumo';
    const cached = cacheGet(mbid, 'volumo');
    if (cached?.url && (!existingUrl || volumoClean(existingUrl) === volumoClean(cached.url))) { applyCachedRow('volumo', label, cached, mbTracks); return; }
    if (cached && !cached.url && !existingUrl && !barcode) { appendLog(label, `No match (cached — ↻ to retry)`, 'warn'); applyCachedRow('volumo', label, cached, mbTracks); return; }

    let a = null, source = null;
    if (existingUrl) {
        source = 'MB rels'; appendLog(label, `Using existing MB URL: ${existingUrl}`, 'ok');
        const m = existingUrl.match(/\/album\/(\d{8,14})(?:-|$)/) || existingUrl.match(/\/album\/(\d+)/);
        if (m) a = m[1].length >= 8 ? await volumoApi('/album_by_icpn/' + m[1]) : await volumoApi('/albums/' + m[1]);
    } else if (barcode) {
        a = await volumoApi('/album_by_icpn/' + barcode);
        if (a) { source = 'barcode'; appendLog(label, `Barcode ${barcode} → album ${a.id} "${a.title}"`, 'ok'); }
    }
    if (!a && !existingUrl) {
        const q = isVariousArtists ? album : `${artist} ${album}`;
        const j = await gmGet(`https://volumo.com/api/v1/search?query=${encodeURIComponent(q)}&limit=10`);
        let albums = [];
        // Volumo returns each bucket as an array when populated, but an empty {} when there are no hits — coerce.
        try { const ab = JSON.parse(j.responseText).albums; albums = Array.isArray(ab) ? ab : []; } catch {}
        appendLog(label, `API search: ${albums.length} candidate(s)`);
        let best = null;
        for (const it of albums) {
            const sc = scoreCandidate({ tracks: (it.tracks || []).length || null, title: it.title, artist: (it.artists || []).map(x => x.name).join(' ') }, mbTracks, album, artist, isVariousArtists);
            if (!best || sc > best.score) best = { score: sc, a: it };
            if (sc >= 150) break;
        }
        if (best && best.score >= 120) { a = best.a; source = 'API search'; appendLog(label, `Picked best (score=${best.score}): album ${a.id}`, best.score >= 150 ? 'ok' : 'warn'); }
    }
    if (!a) { cacheSet(mbid, 'volumo', { url: null, tracks: null, year: null, label: null, source: 'search' }); updateRow('volumo', { url: null, mbTracks, remoteTracks: null }); return; }
    // search hits may omit the full tracklist — refetch by ICPN for an accurate count
    if (!(a.tracks && a.tracks.length) && a.icpn) { const full = await volumoApi('/album_by_icpn/' + a.icpn); if (full) a = full; }
    const tracks = (a.tracks || []).length || null;
    const year = String(a.original_release_date || '').slice(0, 4) || null;
    const lbl = a.recordlabel?.name || (typeof a.recordlabel === 'string' ? a.recordlabel : null);   // recordlabel is an object {id,name,…}
    const url = volumoUrl(a);
    const vbc = a.icpn || a.upc || null;
    appendLog(label, `Album: tracks=${tracks} title="${a.title}" year=${year || '?'}`, tracks ? 'ok' : 'warn');
    cacheSet(mbid, 'volumo', { url, tracks, year, label: lbl, source, barcode: vbc });
    updateRow('volumo', { url, mbTracks, remoteTracks: tracks, year, label: lbl, source, barcode: vbc });
}

// ─── HDtracks ────────────────────────────────────────────────────────────────
// High-resolution download store (#176) with a clean, unauthenticated, CORS-open
// JSON API (hdtracks.azurewebsites.net/api/v1) — no Cloudflare, no captcha, no
// token. The album id is a 24-char hex ObjectId; a barcode/UPC is resolved to it
// via the search endpoint. /album/<id> embeds the full tracklist + per-track
// ISRCs in one call. Bad ids / unknown GTINs return HTTP 200 with an empty body,
// so presence is read from the JSON, not the status code. The 5009 legacy MB rels
// use old URL forms (valbum_code=<UPC>, slug-id, artist page); the new canonical
// web URL is https://www.hdtracks.com/#/album/<id>. We resolve by existing MB rel
// → barcode → artist+album search.
const HD_API = 'https://hdtracks.azurewebsites.net/api/v1';
const hdtracksUrl = id => id ? `https://www.hdtracks.com/#/album/${id}` : null;
async function hdtracksAlbum(id) { const r = await gmGet(`${HD_API}/album/${id}`); if (!r.ok) return null; try { const j = JSON.parse(r.responseText); return j && j.id ? j : null; } catch { return null; } }
async function hdtracksSearch(q) { const r = await gmGet(`${HD_API}/albums/search?q=${encodeURIComponent(q)}`); if (!r.ok) return []; try { const j = JSON.parse(r.responseText); return Array.isArray(j.albums) ? j.albums : []; } catch { return []; } }
async function scanHDtracks({ artist, album, mbTracks, existingUrl, mbid, isVariousArtists, barcode }) {
    const label = 'HDtracks';
    const cached = cacheGet(mbid, 'hdtracks');
    if (cached?.url && (!existingUrl || existingUrl === cached.url)) { applyCachedRow('hdtracks', label, cached, mbTracks); return; }
    if (cached && !cached.url && !existingUrl && !barcode) { appendLog(label, `No match (cached — ↻ to retry)`, 'warn'); applyCachedRow('hdtracks', label, cached, mbTracks); return; }

    let a = null, source = null;
    if (existingUrl) {
        source = 'MB rels'; appendLog(label, `Using existing MB URL: ${existingUrl}`, 'ok');
        let m = existingUrl.match(/\/album\/([a-f0-9]{24})/i);
        if (m) a = await hdtracksAlbum(m[1]);
        else if ((m = existingUrl.match(/[?&]valbum_code=(\d{8,})/i))) {   // legacy URL: valbum_code is the UPC
            const hits = await hdtracksSearch(m[1]);
            if (hits[0]?.id) a = await hdtracksAlbum(hits[0].id);
        }
        // legacy slug-id / artist-page rels have no clean id mapping — fall through to barcode/search
    }
    if (!a && barcode) {
        const hits = await hdtracksSearch(barcode);
        if (hits[0]?.id) { a = await hdtracksAlbum(hits[0].id); if (a) { source = 'barcode'; appendLog(label, `Barcode ${barcode} → album ${a.id} "${a.name}"`, 'ok'); } }
    }
    if (!a && !existingUrl) {
        const q = isVariousArtists ? album : `${artist} ${album}`;
        const albums = await hdtracksSearch(q);
        appendLog(label, `API search: ${albums.length} candidate(s)`);
        let best = null;
        for (const it of albums) {
            const sc = scoreCandidate({ tracks: it.tracksCount || null, title: it.name, artist: (it.artists || []).join(' ') || it.mainArtist }, mbTracks, album, artist, isVariousArtists);
            if (!best || sc > best.score) best = { score: sc, a: it };
            if (sc >= 150) break;
        }
        if (best && best.score >= 120) { a = (await hdtracksAlbum(best.a.id)) || best.a; source = 'API search'; appendLog(label, `Picked best (score=${best.score}): album ${best.a.id}`, best.score >= 150 ? 'ok' : 'warn'); }
    }
    if (!a) { cacheSet(mbid, 'hdtracks', { url: null, tracks: null, year: null, label: null, source: 'search' }); updateRow('hdtracks', { url: null, mbTracks, remoteTracks: null }); return; }
    const tracks = (a.tracks && a.tracks.length) || a.tracksCount || null;
    const year = String(a.release || a.originalRelease || '').slice(0, 4) || null;
    const lbl = a.label || null;
    const url = hdtracksUrl(a.id);
    const hbc = a.upc || null;
    appendLog(label, `Album: tracks=${tracks} title="${a.name}" year=${year || '?'}`, tracks ? 'ok' : 'warn');
    cacheSet(mbid, 'hdtracks', { url, tracks, year, label: lbl, source, barcode: hbc });
    updateRow('hdtracks', { url, mbTracks, remoteTracks: tracks, year, label: lbl, source, barcode: hbc });
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
    for (const p of ALL_PROVIDERS) {
        const ico = document.getElementById(`ico-${p}`);
        const val = document.getElementById(`val-${p}`);
        const a    = document.getElementById(`mb-online-${p}`);
        if (ico)  { ico.textContent = '⚪'; ico.style.color = '#888'; ico.style.fontWeight = 'normal'; ico.onclick = null; ico.style.cursor = ''; ico.classList.remove('pc-ico-circled'); }
        const plat = document.getElementById(`plat-${p}`);
        if (plat) { plat.onclick = null; plat.style.cursor = 'default'; }
        const row = document.getElementById(`row-${p}`);
        if (row) { row.classList.remove('pc-inmb', 'pc-st-mismatch', 'pc-st-match', 'pc-rise'); row.classList.add('pc-st-notfound'); row.onclick = null; row.oncontextmenu = null; row.style.cursor = ''; }   // back to "not found" — refreshCompactStrip re-folds it (#355)
        if (val)  { val.textContent = '—'; val.style.color = '#BF616A'; }   // neutral dash while re-scanning
        setMetaCells(`year-${p}`, `format-${p}`, `label-${p}`, null, null, null);
        // Reset the anchor href to its search-fallback so parseMbFromDom on
        // a subsequent refresh doesn't see the previous /album/<id> result
        // as an "existing MB rel" — covered by the #mb-pc-panel exclusion
        // in parseMbFromDom too, but defensive cleanup either way.
        if (a)    { a.href = '#'; a.title = ''; }
    }
    refreshCompactStrip();   // #355: clear the strip while re-scanning
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
        // Exclude our own panel — after the first scan finishes, its provider
        // <a> tags hold the URLs we *found* (e.g. open.spotify.com/album/…)
        // which look identical to real MB rel anchors. Without this filter a
        // subsequent ↻ refresh sees every row's discovered URL as "existing
        // in MB", flips source to 'MB rels', and the entire panel circles
        // even when MB has no rels at all. (Witnessed on the Threads release
        // with zero external links.)
        const pcPanel = document.getElementById('mb-pc-panel');
        const allAnchors = [
            ...(sidebar ? sidebar.querySelectorAll('a[href]') : []),
            ...scope.querySelectorAll('a[href]'),
        ].filter(a => !pcPanel || !pcPanel.contains(a));
        const externalHrefs = allAnchors.map(a => a.href).filter(u => /^https?:\/\//.test(u));
        const existing = {
            spotify:  externalHrefs.find(u => /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\//i.test(u)) || null,
            discogs:  externalHrefs.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i.test(u)) || null,
            bandcamp:      externalHrefs.find(u => /^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\//i.test(u)) || null,
            deezer:        externalHrefs.find(u => /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]+\/)?album\/\d+/i.test(u)) || null,
            apple:         externalHrefs.find(u => /^https?:\/\/music\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/]+\/)?\d+/i.test(u)) || null,
            tidal:         externalHrefs.find(u => /^https?:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?album\/\d+/i.test(u)) || null,
            qobuz:         externalHrefs.find(u => /^https?:\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\//i.test(u)) || null,
            beatport:      externalHrefs.find(u => /^https?:\/\/(?:www\.)?beatport\.com\/release\/[^/]+\/\d+/i.test(u)) || null,
            volumo:        externalHrefs.find(u => /^https?:\/\/(?:www\.)?volumo\.com\/album\//i.test(u)) || null,
            hdtracks:      externalHrefs.find(u => /^https?:\/\/(?:www\.)?hdtracks\.com\//i.test(u)) || null,
            discogsMaster: externalHrefs.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?master\/\d+/i.test(u)) || null,
        };

        const isVariousArtists = artistIds.includes(VA_MBID) || artistNames.some(n => VA_NAME_RE.test(n));

        // Shared key matcher for "Date:" / "Label:" / "Format:" header
        // detection across the various skins MB renders.
        const matchKey = (el, ...wanted) => {
            const txt = (el.textContent || '').trim().replace(/:$/, '').toLowerCase();
            return wanted.includes(txt);
        };
        const FORMAT_RE = /\b(CD|Vinyl|Cassette|Digital\s*Media|File|SACD|DVD|Blu-?ray|Flexi-?disc|Minidisc|12"\s*Vinyl|7"\s*Vinyl|10"\s*Vinyl)\b/i;

        // Release format. MB renders it in several places: a sidebar
        // dl/dt/dd "Format:" row, a table th/td variant, or a medium-table
        // header above each tracklist. Try them all.
        let format = null;
        for (const dt of document.querySelectorAll('dl.properties dt, dl dt')) {
            const dd = dt.nextElementSibling;
            if (!dd || dd.tagName !== 'DD') continue;
            if (matchKey(dt, 'format', 'formats')) {
                const m = dd.textContent.match(FORMAT_RE);
                if (m) { format = m[1]; break; }
            }
        }
        if (!format) {
            for (const th of document.querySelectorAll('table th')) {
                const td = th.nextElementSibling;
                if (!td) continue;
                if (matchKey(th, 'format', 'formats')) {
                    const m = td.textContent.match(FORMAT_RE);
                    if (m) { format = m[1]; break; }
                }
            }
        }
        if (!format) {
            for (const t of document.querySelectorAll('table.tbl.medium, table.medium-list')) {
                const head = (t.previousElementSibling?.textContent || t.querySelector('caption, thead')?.textContent || '').trim();
                const m = head.match(FORMAT_RE);
                if (m) { format = m[1]; break; }
            }
        }
        // Pattern D: sidebar text scan for `Format: <FMT>`. Catches the
        // <strong>Format:</strong> CD layout MB renders inside the
        // "Release information" block on many releases.
        if (!format) {
            const sb = document.querySelector('#sidebar');
            if (sb) {
                const m = (sb.textContent || '').match(/Format:?\s+(CD|Vinyl|Cassette|Digital\s*Media|File|SACD|DVD|Blu-?ray|Flexi-?disc|Minidisc)\b/i);
                if (m) format = m[1];
            }
        }

        // Year + label for the header subtitle. Same multi-pattern approach.
        let year = null, releaseLabel = null;
        // Pattern A: dl/dt/dd.
        for (const dt of document.querySelectorAll('dl.properties dt, dl dt')) {
            const dd = dt.nextElementSibling;
            if (!dd || dd.tagName !== 'DD') continue;
            if (!year && matchKey(dt, 'date', 'release date')) {
                const m = dd.textContent.match(/\b(19\d{2}|20\d{2})\b/);
                if (m) year = m[1];
            }
            if (!releaseLabel && matchKey(dt, 'label', 'labels')) {
                const aLabels = [...dd.querySelectorAll('a[href*="/label/"]')].map(a => a.textContent.trim()).filter(Boolean);
                if (aLabels.length) releaseLabel = [...new Set(aLabels)].join(', ');
            }
        }
        // Pattern B: table th/td (some MB skins use this for release info).
        if (!year || !releaseLabel) {
            for (const th of document.querySelectorAll('table th')) {
                const td = th.nextElementSibling;
                if (!td) continue;
                if (!year && matchKey(th, 'date', 'release date')) {
                    const m = td.textContent.match(/\b(19\d{2}|20\d{2})\b/);
                    if (m) year = m[1];
                }
                if (!releaseLabel && matchKey(th, 'label', 'labels')) {
                    const aLabels = [...td.querySelectorAll('a[href*="/label/"]')].map(a => a.textContent.trim()).filter(Boolean);
                    if (aLabels.length) releaseLabel = [...new Set(aLabels)].join(', ');
                }
            }
        }
        // Fallback: any /label/ anchor in #sidebar; year from the rendered
        // sidebar text (with `<script type="application/json">` embeds and
        // `<style>` content stripped — otherwise the first match is often
        // a country entity's "last_updated" timestamp inside MB's React
        // bootstrap blob, not the release year).
        const sb = document.querySelector('#sidebar');
        if (sb) {
            if (!releaseLabel) {
                const aLabels = [...sb.querySelectorAll('a[href*="/label/"]')].map(a => a.textContent.trim()).filter(Boolean);
                if (aLabels.length) releaseLabel = [...new Set(aLabels)].join(', ');
            }
            // Helper: read element textContent with <script>/<style>/<noscript>
            // stripped. The Release events section embeds a React bootstrap
            // blob whose first year is the country entity's `last_updated`
            // timestamp (e.g. "2013-08-28" for the [Worldwide] entity), not
            // the release date — only the rendered "[Worldwide]2017-06-15"
            // sibling carries the actual year we want.
            const cleanText = el => {
                const c = el.cloneNode(true);
                c.querySelectorAll('script, style, noscript').forEach(n => n.remove());
                return c.textContent || '';
            };
            if (!year) {
                // Prefer the "Release events" section directly when available —
                // it's the canonical home of the release date.
                //
                // Two subtleties learned the hard way:
                //
                // (1) Skip <script> siblings ENTIRELY. The cleanText helper
                //     strips descendant scripts from a cloned subtree, but
                //     if the sibling element itself is a <script>, its own
                //     content is preserved. MB embeds a JSON bootstrap blob
                //     as the first Release-events sibling whose JSON order
                //     varies: sometimes `{"date":{"year":2021},…}` is first
                //     (we'd luckily land on the right year), sometimes the
                //     country entity is first with `"last_updated":"2013-…"`
                //     (we'd extract Germany's last-updated year, not the
                //     release year). Safer to ignore the script outright.
                //
                // (2) Drop the leading \b from the date regex. The rendered
                //     date sits inside text like "Germany2021-12-03" — no
                //     word boundary between the country name and the year.
                //     A trailing \b still rejects the `last_updated`
                //     "2013-05-27T…" case (T is word-class, no boundary).
                const reHeader = [...sb.querySelectorAll('h2, h3')].find(h => /release events?/i.test(h.textContent));
                if (reHeader) {
                    let dateYear = null, anyYear = null;
                    for (let n = reHeader.nextElementSibling; n && !/^h[1-6]$/i.test(n.tagName); n = n.nextElementSibling) {
                        if (/^(script|style|noscript)$/i.test(n.tagName)) continue;
                        const t = cleanText(n);
                        if (!dateYear) {
                            const d = t.match(/(19\d{2}|20\d{2})-(?:0\d|1[0-2])-(?:0\d|[12]\d|3[01])\b/);
                            if (d) dateYear = d[1];
                        }
                        if (!anyYear) {
                            const m = t.match(/(19\d{2}|20\d{2})\b/);
                            if (m) anyYear = m[1];
                        }
                        if (dateYear) break;
                    }
                    year = dateYear || anyYear || null;
                }
            }
            if (!year) {
                const clone = sb.cloneNode(true);
                clone.querySelectorAll('script, style, noscript').forEach(n => n.remove());
                const m = (clone.textContent || '').match(/\b(19\d{2}|20\d{2})\b/);
                if (m) year = m[1];
            }
        }

        // Barcode (UPC/EAN) — MB renders it as a "Barcode:" dt/dd, th/td, or in
        // the sidebar text. Strip to digits. Used to resolve Volumo (and, as an
        // exact match, Deezer/Apple) by UPC. Scraped from the page here; the WS2
        // `data.barcode` is only a fallback (parseMbData).
        let barcode = null;
        for (const dt of document.querySelectorAll('dl.properties dt, dl dt, table th')) {
            const dd = dt.nextElementSibling;
            if (!dd) continue;
            if (matchKey(dt, 'barcode')) { const m = (dd.textContent || '').replace(/\s+/g, '').match(/\d{8,14}/); if (m) { barcode = m[0]; break; } }
        }
        if (!barcode && sidebar) { const m = (sidebar.textContent || '').match(/Barcode:?\s*([\d\s]{8,})/i); if (m) barcode = m[1].replace(/\D/g, '') || null; }

        // Sanity gate: we need artist + album + at least one track row. Anything
        // less is an unrendered or unfamiliar layout — bail to API.
        if (!artist || !album || mbTracks < 1) return null;
        return { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing, format, year, releaseLabel, barcode };
    } catch (e) {
        appendLog('System', `parseMbFromDom threw: ${e.message}`, 'error');
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
        tidal:         relUrls.find(u => /^https?:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?album\/\d+/i.test(u)) || null,
        qobuz:         relUrls.find(u => /^https?:\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\//i.test(u)) || null,
        beatport:      relUrls.find(u => /^https?:\/\/(?:www\.)?beatport\.com\/release\/[^/]+\/\d+/i.test(u)) || null,
        volumo:        relUrls.find(u => /^https?:\/\/(?:www\.)?volumo\.com\/album\//i.test(u)) || null,
        hdtracks:      relUrls.find(u => /^https?:\/\/(?:www\.)?hdtracks\.com\//i.test(u)) || null,
        discogsMaster: relUrls.find(u => /^https?:\/\/www\.discogs\.com\/(?:[a-z-]+\/)?master\/\d+/i.test(u)) || null,
    };
    const format = data.media?.[0]?.format || null;
    const year   = data.date ? String(data.date).slice(0, 4) : null;
    const barcode = String(data.barcode || '').replace(/\D/g, '') || null;   // WS2 fallback (DOM scrape preferred)
    const releaseLabel = (data['label-info'] || [])
        .map(li => li.label?.name)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ') || null;
    return { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing, format, year, releaseLabel, barcode };
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
        const mb = await gmGet(`${MB_ORIGIN}/ws/2/release/${mbid}?inc=artists+media+url-rels+release-groups+labels&fmt=json`);
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

    // 2nd-line under the MusicBrainz source-info log: clickable link straight
    // to the release page. Convenient when the user opens the diagnostic log
    // from a different tab and wants to jump back to MB without re-typing.
    appendLog('MusicBrainz', `Release: <a href="${MB_ORIGIN}/release/${mbid}" target="_blank" rel="noopener" style="color:#BA68C8;text-decoration:underline;">${MB_ORIGIN}/release/${mbid}</a>`);

    const { artist, album, mbTracks, releaseGroupMbid, isVariousArtists, existing, format, year, releaseLabel, barcode } = mbData;
    // Header subtitle: year · label · format (left-aligned), and the MB
    // track count right-aligned so it sits in the same column as the
    // platform vals below.
    setMetaCells('mb-mb-year', 'mb-mb-format', 'mb-mb-label', year, format, releaseLabel);
    const trkEl = document.getElementById('mb-mb-tracks');
    if (trkEl) trkEl.textContent = `${mbTracks}`;
    const nameEl = document.getElementById('mb-mb-name');
    if (nameEl) nameEl.href = `${MB_ORIGIN}/release/${mbid}`;
    appendLog('MusicBrainz', `Artist: "${artist}"${isVariousArtists ? ' (Various Artists — search by album only)' : ''}  Album: "${album}"  Tracks: ${mbTracks}  rg=${releaseGroupMbid || '(none)'}`);
    appendLog('MusicBrainz', `Header meta — year=${year || '?'}  format=${format || '?'}  label=${releaseLabel || '?'}  source=${dataSource}`);
    appendLog('MusicBrainz', `Existing rels — spotify=${existing.spotify ? 'YES' : 'no'}  discogs=${existing.discogs ? 'YES' : 'no'}  bandcamp=${existing.bandcamp ? 'YES' : 'no'}  deezer=${existing.deezer ? 'YES' : 'no'}  apple=${existing.apple ? 'YES' : 'no'}`);

    // Cache upgrade: if MB has acquired a URL rel matching a cached URL (the
    // user just added the URL via + and came back), promote the cached row's
    // source from search/Wikidata to "MB rels" so the circled icon shows
    // immediately on the cache short-circuit — without it the user has to
    // hit ↻ to see the circle, even though MB now considers it an
    // editor-added rel.
    //
    // …and the downgrade counterpart: if a cache entry claims source='MB rels'
    // but MB no longer has that URL relationship (or never did — possible
    // since the panel-self-contamination bug used to write 'MB rels' for
    // every platform whenever the user hit ↻), demote to 'search' so the
    // row uncircles and click-to-add re-enables. Without this, users who
    // hit a buggy build keep seeing every row as circled+unclickable until
    // they manually ↻ refresh.
    for (const p of ALL_PROVIDERS) {
        const cached = cacheGet(mbid, p);
        if (!cached?.url) continue;
        if (existing[p] === cached.url && cached.source !== 'MB rels') {
            cacheSet(mbid, p, { ...cached, source: 'MB rels' });
            appendLog('MusicBrainz', `Cache upgrade: ${p} URL now in MB rels — source bumped to "MB rels"`, 'ok');
        } else if (existing[p] !== cached.url && cached.source === 'MB rels') {
            cacheSet(mbid, p, { ...cached, source: 'search' });
            appendLog('MusicBrainz', `Cache downgrade: ${p} URL no longer in MB rels (stale 'MB rels' tag) — source bumped to "search"`, 'warn');
        }
    }

    // Wikidata lookup — fires whenever we don't already have a positive Spotify
    // URL. A cached "no match" (url:null) doesn't block Wikidata: it's a cheap
    // independent data source curated by humans, and the cache may have been
    // written before Wikidata had this album indexed (or before the user
    // hit ↻ themselves).
    // Wikidata also curates Tidal (P4577) and Beatport (P11312) IDs, so run it
    // unless EVERY Wikidata-backed provider is already resolved. Beatport in
    // particular has no other reliable resolver (it's Cloudflare-walled), so
    // Wikidata is its primary path.
    const spotifyCache = cacheGet(mbid, 'spotify');
    const spotifyKnown = !!(existing.spotify || spotifyCache?.url);
    const tidalKnown    = !!(existing.tidal    || cacheGet(mbid, 'tidal')?.url);
    const beatportKnown = !!(existing.beatport || cacheGet(mbid, 'beatport')?.url);
    const tidalWanted    = GM_getValue('prov_tidal', true)    && !tidalKnown;
    const beatportWanted = GM_getValue('prov_beatport', true) && !beatportKnown;
    let wd = null;
    if (spotifyKnown && !tidalWanted && !beatportWanted) {
        appendLog('Wikidata', `skipped — Spotify/Tidal/Beatport already resolved`);
    } else {
        wd = await lookupWikidata(releaseGroupMbid, mbid);
    }

    // Seed search fallback URLs. Each provider link starts pointed at the
    // provider's native search results — overridden to the resolved album
    // URL once a scan finds a confident match. The original search URL is
    // stashed on the anchor's dataset so right-click can re-open it even
    // after a positive match (convenient for cross-checking).
    const searchUrls = {
        spotify:  `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${album}`)}`,
        discogs:  `https://www.discogs.com/search/?q=${encodeURIComponent(`${artist} ${album}`)}&type=release`,
        bandcamp: `https://bandcamp.com/search?q=${encodeURIComponent(`${artist} ${album}`)}&item_type=a`,
        deezer:   `https://www.deezer.com/search/${encodeURIComponent(`${artist} ${album}`)}`,
        apple:    `https://music.apple.com/us/search?term=${encodeURIComponent(`${artist} ${album}`)}`,
        tidal:    `https://tidal.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`,
        qobuz:    `https://www.qobuz.com/us-en/search/albums/${encodeURIComponent(`${artist} ${album}`)}`,
        beatport: `https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`,
        volumo:   `https://volumo.com/releases?search=${encodeURIComponent(`${artist} ${album}`)}`,
        hdtracks: `https://www.hdtracks.com/#/search?q=${encodeURIComponent(`${artist} ${album}`)}`,
    };
    for (const [p, u] of Object.entries(searchUrls)) {
        const a = document.getElementById(`mb-online-${p}`);
        if (!a) continue;
        a.href = u;
        a.dataset.searchUrl = u;
        // Right-click → open native search. Preserves the browser's own
        // copy-link affordance on middle-click / shift-click; only the
        // bare-right-click is intercepted.
        if (!a.dataset.pcContextMenuWired) {
            a.addEventListener('contextmenu', e => {
                e.preventDefault();
                const search = a.dataset.searchUrl;
                if (search) window.open(search, '_blank', 'noopener');
            });
            a.dataset.pcContextMenuWired = '1';
        }
    }

    MB_BARCODE = barcode || null;   // (#182) for the barcode-mismatch indicator
    MB_FORMAT  = format  || null;   // (#182) for the format-confidence check
    // SAMBL barcode resolver (#182) — its unique contribution is the exact-barcode
    // Spotify album (no other unauthenticated UPC route). Only worth a call when
    // there's a barcode and Spotify isn't already pinned by an MB rel.
    let sambl = null;
    if (barcode && GM_getValue('prov_spotify', true) && !existing.spotify) {
        sambl = await lookupSambl(barcode);
    }
    const ctx = { artist, album, mbTracks, mbid, isVariousArtists, format, barcode, existingDiscogsMaster: existing.discogsMaster || null };
    const tasks = [];
    if (GM_getValue('prov_spotify',  true)) tasks.push(scanSpotify ({ ...ctx, existingUrl: existing.spotify,  wikidataSpotifyId: wd?.spotifyId || null, samblUrl: sambl?.spotify || null }));
    if (GM_getValue('prov_discogs',  true)) tasks.push(scanDiscogs ({ ...ctx, existingUrl: existing.discogs  }));
    if (GM_getValue('prov_bandcamp', true)) tasks.push(scanBandcamp({ ...ctx, existingUrl: existing.bandcamp }));
    if (GM_getValue('prov_deezer',   true)) tasks.push(scanDeezer  ({ ...ctx, existingUrl: existing.deezer   }));
    if (GM_getValue('prov_apple',    true)) tasks.push(scanApple   ({ ...ctx, existingUrl: existing.apple,    wikidataAppleId: wd?.appleId || null }));
    if (GM_getValue('prov_tidal',    true)) tasks.push(scanTidal   ({ ...ctx, existingUrl: existing.tidal,    wikidataTidalId: wd?.tidalId || null }));
    if (GM_getValue('prov_qobuz',    true)) tasks.push(scanQobuz   ({ ...ctx, existingUrl: existing.qobuz    }));
    if (GM_getValue('prov_beatport', true)) tasks.push(scanBeatport({ ...ctx, existingUrl: existing.beatport, wikidataBeatportId: wd?.beatportId || null }));
    if (GM_getValue('prov_volumo',   true)) tasks.push(scanVolumo  ({ ...ctx, existingUrl: existing.volumo   }));
    if (GM_getValue('prov_hdtracks', true)) tasks.push(scanHDtracks({ ...ctx, existingUrl: existing.hdtracks }));
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
// The visible per-row anchor for flashInfo. In icon mode the text glyph (`ico-…`)
// is display:none, so anchoring a tooltip to it lands at the page's top-left corner
// (zero-rect). Use the brand favicon (`plat-…`) when icons are shown. (#182)
function rowAnchor(platform) {
    const panel = document.getElementById('mb-pc-panel');
    const iconMode = panel && panel.classList.contains('pc-icons-mode');
    return (iconMode ? document.getElementById(`plat-${platform}`) : document.getElementById(`ico-${platform}`))
        || document.getElementById(`plat-${platform}`) || document.getElementById(`ico-${platform}`)
        || document.getElementById(`row-${platform}`) || document.body;
}
function flashInfo(targetEl, text, bg = '#5B82B0') {
    document.getElementById('pc-flash-info')?.remove();
    let rect = targetEl.getBoundingClientRect();
    // a hidden anchor reports a zero rect → the tip would jump to the top-left corner;
    // fall back to the panel so it stays in view (#182)
    if (!rect.width && !rect.height) { const panel = document.getElementById('mb-pc-panel'); if (panel) rect = panel.getBoundingClientRect(); }
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
// (#182) "Check barcodes for link confidence" gates the + / ↗ actions. Two modes:
//   'exists' — withhold only links whose barcode is KNOWN and DIFFERS from MB's.
//   'strict' — also withhold links we couldn't barcode-confirm (provider exposes
//              no UPC, e.g. Apple/Spotify) — i.e. only barcode-confirmed links pass.
// On by default in "if they exist" mode; the subtle mismatch bar still shows known mismatches regardless.
function barcodeBlocks(platform) {
    if (!GM_getValue('pc:respect-barcode', true)) return false;
    const c = cacheGet(mbid, platform);
    if (!c || !c.url) return false;                // no found URL → nothing to withhold
    const strict = GM_getValue('pc:barcode-mode', 'exists') === 'strict';
    // MB has no barcode (missing OR [none]) → nothing here can be barcode-confirmed.
    // strict: withhold (only confirmed links pass); if-they-exist: allow. (#206 chaban-mb —
    // previously returned false unconditionally, so strict mode silently ignored the absence.)
    if (!MB_BARCODE) return strict;
    if (c.barcode) return normBarcode(c.barcode) !== normBarcode(MB_BARCODE);   // known → block iff differs
    return strict;                                 // provider exposes no barcode → block only in strict mode
}
// (#182) "Use format for link confidence" gates + / ↗ when the matched edition's
// format is incompatible with the MB release format (a different medium is a
// different MB release). Mirrors the barcode modes:
//   'exists' — withhold only when the remote format is KNOWN and incompatible.
//   'strict' — also withhold links whose format can't be determined.
// Digital-only platforms count as Digital (so streaming links pass on a digital
// release, withheld on a physical one); Bandcamp/Discogs use their parsed
// format. Off by default.
function formatBlocks(platform) {
    if (!GM_getValue('pc:respect-format', true)) return false;
    const mbCats = formatCategories(MB_FORMAT);
    if (mbCats.size === 0) return false;                       // MB format unknown → can't judge
    const c = cacheGet(mbid, platform);
    if (!c || !c.url) return false;
    const remote = remoteFormatCategories(platform, c.format);
    if (remote.size === 0) return GM_getValue('pc:format-mode', 'exists') === 'strict';  // unknown → block only in strict
    return ![...remote].some(x => mbCats.has(x));              // known → block iff no shared category
}
function addSingleUrl(platform) {
    const cached = cacheGet(mbid, platform);
    if (!cached?.url) {
        appendLog('System', `Inject (click): no cached URL for ${platform} — abort`, 'warn');
        return;
    }
    if (barcodeBlocks(platform)) {
        const why = cacheGet(mbid, platform)?.barcode ? 'barcode differs from MB' : 'barcode not confirmed';
        appendLog('System', `Inject (click): ${platform} ${why} — blocked (barcode-confidence is on)`, 'warn');
        flashInfo(rowAnchor(platform), cacheGet(mbid, platform)?.barcode ? 'Different barcode — not added' : 'Barcode not confirmed — not added');
        return;
    }
    if (formatBlocks(platform)) {
        appendLog('System', `Inject (click): ${platform} format incompatible with MB (${MB_FORMAT}) — blocked (format-confidence is on)`, 'warn');
        flashInfo(rowAnchor(platform), 'Format mismatch — not added');
        return;
    }
    GM_setValue(`pc:pending:${mbid}`, JSON.stringify({ [platform]: cached.url }));
    appendLog('System', `Inject (click): queued ${platform} URL — opening release editor`, 'ok');
    const w = window.open(`${MB_ORIGIN}/release/${mbid}/edit`, '_blank');
    if (!w) appendLog('System', `window.open returned null — popup blocked?`, 'error');
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
    window.open(`${MB_ORIGIN}/release-group/${rgMbid}/edit`, '_blank');
}

document.getElementById('mb-inject-btn').addEventListener('click', async (e) => {
    const triggerBtn = e.currentTarget;
    // Bucket 1: URLs going onto the release.
    const pendingRelease = {};
    let barcodeBlocked = 0;
    let formatBlocked = 0;
    for (const p of PROVIDER_ORDER) {
        if (!providerEnabled(p)) continue;   // #255 disabled in Settings — never queue its (possibly stale) cache
        const cached = cacheGet(mbid, p);
        if (!cached?.url) continue;
        if (cached.source === 'MB rels') continue;
        const icoText = document.getElementById(`ico-${p}`)?.textContent?.trim();
        if (icoText !== '✓') continue;
        if (barcodeBlocks(p)) { barcodeBlocked++; appendLog('System', `Inject: ${p} ${cached.barcode ? 'barcode differs from MB' : 'barcode not confirmed'} — skipped (barcode-confidence on)`, 'warn'); continue; }
        if (formatBlocks(p)) { formatBlocked++; appendLog('System', `Inject: ${p} format incompatible with MB (${MB_FORMAT}) — skipped (format-confidence on)`, 'warn'); continue; }
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
    // #255 disabled provider → skip. #256 only queue the master when the Discogs RELEASE
    // is a confirmed match (✓, not barcode/format-blocked): if text/Brave search landed on
    // an unrelated pressing (no release match), its master isn't this release-group's master.
    const discogsConfirmed = providerEnabled('discogs')
        && document.getElementById('ico-discogs')?.textContent?.trim() === '✓'
        && !barcodeBlocks('discogs') && !formatBlocks('discogs');
    if (!discogsConfirmed) {
        if (masterUrl) appendLog('System', `Inject: Discogs release isn't a confirmed match — not queueing master ${masterUrl}`, 'warn');
    } else if (masterUrl && rgMbid && !existingMaster) {
        pendingRG['discogs-master'] = masterUrl;
        appendLog('System', `Inject: queueing Discogs master ${masterUrl} for release-group ${rgMbid}`);
    } else if (masterUrl && existingMaster) {
        appendLog('System', `Inject: Discogs master already in MB rels (${existingMaster}) — skipping`);
    }

    const releaseCount = Object.keys(pendingRelease).length;
    const rgCount      = Object.keys(pendingRG).length;
    if (releaseCount + rgCount === 0) {
        // Explain WHY nothing is queued instead of the misleading "all OK URLs already in MB" (#117):
        //   • unmatched — a link WAS found but isn't a confirmed match (✓); shown as ~ / ? because its
        //     track count / format differs from this release, so it's NOT added (and is NOT in MB)
        //   • inMb      — a confirmed match exists but is already a relationship on the release
        let unmatched = 0, inMb = 0;
        for (const p of PROVIDER_ORDER) {
            if (!providerEnabled(p)) continue;   // #255 disabled providers don't factor into "why nothing queued"
            const c = cacheGet(mbid, p);
            if (!c?.url) continue;
            if (c.source === 'MB rels') inMb++; else unmatched++;   // not in MB but not queued ⇒ not a ✓ match
        }
        const msg = unmatched > 0
            ? `Inject: nothing to add — ${unmatched} found link(s) aren't a confirmed match (✓) for this release (track count / format differs)${inMb ? `; ${inMb} already in MB` : ''}`
            : inMb > 0
                ? `Inject: nothing to add — all confirmed links are already in MB`
                : `Inject: nothing to add — no new links found`;
        const blockedNote = [barcodeBlocked > 0 ? `${barcodeBlocked} blocked by barcode mismatch` : '', formatBlocked > 0 ? `${formatBlocked} blocked by format mismatch` : ''].filter(Boolean).join('; ');
        appendLog('System', blockedNote ? msg + `; ${blockedNote}` : msg, 'warn');
        flashInfo(triggerBtn, barcodeBlocked > 0 ? `${barcodeBlocked} blocked — different barcode` : formatBlocked > 0 ? `${formatBlocked} blocked — format mismatch` : unmatched > 0 ? "Found links don't match" : inMb > 0 ? 'Already in MB' : 'Nothing to add');
        return;
    }

    if (releaseCount > 0) {
        GM_setValue(`pc:pending:${mbid}`, JSON.stringify(pendingRelease));
        appendLog('System', `Inject: queued ${releaseCount} release URL(s) — opening release editor`, 'ok');
        window.open(`${MB_ORIGIN}/release/${mbid}/edit`, '_blank');
    }
    if (rgCount > 0 && rgMbid) {
        GM_setValue(`pc:pending:rg:${rgMbid}`, JSON.stringify(pendingRG));
        appendLog('System', `Inject: queued ${rgCount} release-group URL(s) — opening release-group editor`, 'ok');
        window.open(`${MB_ORIGIN}/release-group/${rgMbid}/edit`, '_blank');
    }
});

// "↗" — open found platform pages that are NOT already in MB (non-circled links,
// source != 'MB rels') in their own new tabs. Circled = already an MB relationship.
document.getElementById('mb-openall-btn').addEventListener('click', (e) => {
    const urls = [];
    for (const p of PROVIDER_ORDER) {
        if (!providerEnabled(p)) continue;   // #255 disabled in Settings — don't open its (possibly stale) cache
        const cached = cacheGet(mbid, p);
        if (!cached?.url) continue;
        if (cached.source === 'MB rels') continue;   // circled — already in MB, skip
        // Only confirmed matches (✓). Skip '~' (track-count mismatch) and '?'
        // (found-but-unverifiable, e.g. Beatport) — same bar as the + inject button.
        if (document.getElementById(`ico-${p}`)?.textContent?.trim() !== '✓') continue;
        if (barcodeBlocks(p)) continue;   // (#182) barcode-confidence on + mismatch
        if (formatBlocks(p)) continue;    // (#182) format-confidence on + incompatible
        urls.push(cached.url);
    }
    // Discogs master: only if found and not already on the release-group (non-circled)
    const masterUrl = cacheGet(mbid, 'discogs')?.masterUrl;
    const existingMaster = mbDataGet(mbid)?.existing?.discogsMaster;
    // #255 skip if disabled; #256 only when the Discogs release is a confirmed match
    const discogsConfirmed = providerEnabled('discogs')
        && document.getElementById('ico-discogs')?.textContent?.trim() === '✓'
        && !barcodeBlocks('discogs') && !formatBlocks('discogs');
    if (discogsConfirmed && masterUrl && !existingMaster) urls.push(masterUrl);
    const uniq = [...new Set(urls)];
    if (!uniq.length) {
        appendLog('System', 'Open all: nothing new — all found links are already in MB', 'warn');
        flashInfo(e.currentTarget, 'Nothing new');
        return;
    }
    appendLog('System', `Open all: opening ${uniq.length} non-circled link(s) in new tabs`, 'ok');
    uniq.forEach(u => window.open(u, '_blank', 'noopener'));
    flashInfo(e.currentTarget, `Opened ${uniq.length}`);
});

runScans();

})();
