// ==UserScript==
// @name         Falcon — bulk MusicBrainz link editor
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.24.182416
// @description  Add external links to a BATCH of MusicBrainz artists/labels at once — no popup-per-entity, no tab churn. A small pool of persistent worker iframes churns through a queue, each submitting its own edit and moving straight to the next entity. Paste a list, or hand it a queue via a `?falcon=` URL param (e.g. from Harmony).
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHBhdGggZD0iTTY0IDEwIEM4MiAyOCA5MCA1NiA5MCA4MCBMMzggODAgQzM4IDU2IDQ2IDI4IDY0IDEwIFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFiMmE0YSIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNMzggODAgTDIwIDExMCBMNDAgOTYgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWIyYTRhIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik05MCA4MCBMMTA4IDExMCBMODggOTYgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWIyYTRhIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjY0IiBjeT0iNDQiIHI9IjEwIiBmaWxsPSIjMWIyYTRhIi8+CiAgPHBhdGggZD0iTTUwIDgwIEw0NSAxMDggTDY0IDEyMiBMODMgMTA4IEw3OCA4MCBaIiBmaWxsPSIjZmY2YTAwIiBzdHJva2U9IiMxYjJhNGEiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/falcon/README.md
// @match        https://*.musicbrainz.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @noframes
// ==/UserScript==
(function () {
  'use strict';
  const VERSION = '2026.7.24.182416';
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  const NAME = 'Falcon';
  const MB_ORIGIN = location.origin;
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/falcon/README.md';
  // simple rocket glyph — reused at both launcher and panel-header size (currentColor)
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 2 C15 5 16 9.5 16 13.5 L8 13.5 C8 9.5 9 5 12 2 Z"/>' +
    '<path d="M8 13.5 L5 19 L8.6 16.6 Z"/><path d="M16 13.5 L19 19 L15.4 16.6 Z"/>' +
    '<circle cx="12" cy="8.2" r="1.5" fill="currentColor" stroke="none"/>' +
    '<path d="M9.6 13.5 L9 19 L12 22 L15 19 L14.4 13.5 Z"/></svg>';

  /* ── shared corner-slot convention (#468) ───────────────────────────────
     Every floating launcher across these scripts (Apollo Editor, Art
     Station, Scribe, Falcon) tags its element with data-mb-corner (which
     screen corner) + data-mb-corner-order (priority — lower sits closest to
     the actual corner) and calls mbRestackCorner() right after it shows /
     hides / creates / removes its own element. No MutationObserver needed:
     whichever script's state just changed triggers a full recompute that
     repositions every element sharing that corner, regardless of load
     order — so two independent scripts' buttons never land on the same
     pixel. Duplicated per-script on purpose (no shared file to import). */
  function mbRestackCorner(corner) {
    const bottom = corner[0] === 'b', right = corner[1] === 'r';
    const els = [...document.querySelectorAll('[data-mb-corner="' + corner + '"]')]
      .filter(el => getComputedStyle(el).display !== 'none')   // offsetParent is always null for position:fixed — not a usable visibility check here
      .sort((a, b) => (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0));
    let pos = 14;
    els.forEach(el => {
      el.style[bottom ? 'bottom' : 'top'] = pos + 'px';
      el.style[right ? 'right' : 'left'] = '14px';
      pos += el.getBoundingClientRect().height + 8;
    });
  }

  /* ── settings ────────────────────────────────────────────────────────── */
  const cfg = {
    get workers() { const n = Number(GM_getValue('falcon:workers', 3)); return Math.max(1, Math.min(6, isFinite(n) ? n : 3)); },
    set workers(n) { GM_setValue('falcon:workers', Math.max(1, Math.min(6, Number(n) || 3))); },
  };

  /* ── tiny logger — kept in-memory + console, surfaced in the panel's log tab ── */
  const LOG = [];
  function log(level, msg) {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase().padEnd(5)} ${msg}`;
    LOG.push(line); if (LOG.length > 500) LOG.shift();
    try { (console[level] || console.log).call(console, '[Falcon]', msg); } catch (e) {}
    renderLog();
  }

  /* ── queue item shape: {id, entityType, mbid, url, status, error} ─────── */
  let queue = [];
  let running = false;
  const ENTITY_RE = /^(artist|label)$/;
  const MBID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function normalizeEntityType(raw) {
    const t = String(raw || 'artist').trim().toLowerCase();
    return ENTITY_RE.test(t) ? t : 'artist';
  }
  // accepts: "<mbid>,<url>" · "<mbid> <url>" · "<entityType>:<mbid>,<url>" ·
  // or a full MB artist/label URL in place of the bare mbid.
  function parseLine(line) {
    const s = line.trim();
    if (!s || s.startsWith('#')) return null;
    let entityType = 'artist';
    let rest = s;
    const etm = rest.match(/^(artist|label)\s*:\s*(.+)$/i);
    if (etm) { entityType = normalizeEntityType(etm[1]); rest = etm[2]; }
    const parts = rest.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) return null;
    let [entityPart, ...urlParts] = parts;
    const url = urlParts.join(' ');
    const um = entityPart.match(/musicbrainz\.org\/(artist|label)\/([0-9a-f-]{36})/i);
    let mbid = entityPart;
    if (um) { entityType = normalizeEntityType(um[1]); mbid = um[2]; }
    if (!MBID_RE.test(mbid) || !/^https?:\/\//i.test(url)) return null;
    return { entityType, mbid: mbid.toLowerCase(), url };
  }
  function parsePaste(text) {
    return String(text || '').split('\n').map(parseLine).filter(Boolean);
  }
  function toQueueItems(parsed) {
    return parsed.map((p, i) => ({ id: `${p.entityType}:${p.mbid}:${i}`, entityType: p.entityType, mbid: p.mbid, url: p.url, status: 'queued', error: '' }));
  }
  // `?falcon=<base64(JSON array of {entityType?,mbid,url}) or plain JSON>` — the Harmony handoff.
  function parseUrlParam() {
    const raw = new URLSearchParams(location.search).get('falcon');
    if (!raw) return null;
    let json = null;
    try { json = decodeURIComponent(escape(atob(raw))); } catch (e) { json = raw; }
    try {
      const arr = JSON.parse(json);
      if (!Array.isArray(arr)) return null;
      return arr.map(it => ({ entityType: normalizeEntityType(it.entityType), mbid: String(it.mbid || '').toLowerCase(), url: String(it.url || '') }))
        .filter(it => MBID_RE.test(it.mbid) && /^https?:\/\//i.test(it.url));
    } catch (e) { log('warn', 'falcon= param present but not valid JSON: ' + e.message); return null; }
  }

  /* ── waiters (mirrors Platform Check's pcWait/pcWaitFor, retargeted at a frame doc) ── */
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function waitFor(predicate, timeoutMs) {
    timeoutMs = timeoutMs || 10000;
    return new Promise(resolve => {
      const start = Date.now();
      const tick = () => {
        let v; try { v = predicate(); } catch (e) { v = null; }
        if (v) return resolve(v);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, 150);
      };
      tick();
    });
  }
  function frameDoc(iframe) { try { return iframe.contentDocument; } catch (e) { return null; } }
  function frameWin(iframe) { try { return iframe.contentWindow; } catch (e) { return null; } }

  function findAddLinkInput(doc) {
    const all = [...doc.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    return all.find(i => RE.test((i.placeholder || '').trim()) && !i.value)
      || all.find(i => RE.test((i.placeholder || '').trim())) || null;
  }
  function findSubmitButton(doc) {
    return doc.querySelector('button.submit.positive')
      || [...doc.querySelectorAll('button')].find(b => /enter edit/i.test(b.textContent || ''));
  }
  function setEditNote(doc, win, text) {
    const ta = doc.querySelector('textarea.edit-note, textarea[name="edit-note"], textarea[name="edit_note"], #id-edit-note, .edit-note textarea');
    if (!ta) return false;
    try {
      const setVal = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
      const existing = (ta.value || '').trim();
      setVal.call(ta, existing ? existing + '\n' + text : text);
      ta.dispatchEvent(new win.Event('input', { bubbles: true }));
      ta.dispatchEvent(new win.Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  const editNoteText = () => `${NAME} v${scriptVersion()} by majkinetor - ${HELP_URL}\n\nBulk-added via the Falcon queue.`;

  // fill the "Add another link" field + submit, all directly against the iframe's OWN
  // document/window (same-origin — no postMessage needed, see #467). Throws on failure
  // with a message that becomes the queue row's error text.
  async function fillAndSubmit(iframe, item) {
    const doc = frameDoc(iframe); if (!doc) throw new Error('cross-origin / no document');
    const input = await waitFor(() => frameDoc(iframe) && findAddLinkInput(frameDoc(iframe)), 12000);
    if (!input) throw new Error('no "Add another link" input ever appeared');
    const d2 = frameDoc(iframe), w2 = frameWin(iframe);
    const setVal = Object.getOwnPropertyDescriptor(w2.HTMLInputElement.prototype, 'value').set;
    input.focus();
    setVal.call(input, item.url);
    input.dispatchEvent(new w2.Event('input', { bubbles: true }));
    input.dispatchEvent(new w2.Event('change', { bubbles: true }));
    input.dispatchEvent(new w2.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.dispatchEvent(new w2.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.blur();
    const row = await waitFor(() => {
      const dd = frameDoc(iframe); if (!dd) return null;
      const r = [...dd.querySelectorAll('tr.external-link-item')].find(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === item.url);
      return r || null;
    }, 8000);
    if (!row) throw new Error('URL row never appeared after Enter — MB may already have this exact link');
    setEditNote(d2, w2, editNoteText());
    await wait(150);
    const btn = findSubmitButton(frameDoc(iframe));
    if (!btn) throw new Error('no submit button found');
    if (btn.disabled) throw new Error('submit button disabled (form invalid?)');
    btn.click();
    const left = await waitFor(() => {
      const w = frameWin(iframe); if (!w) return null;
      try { return /\/edit(?:[?#]|$)/.test(w.location.pathname) ? null : true; } catch (e) { return null; }
    }, 15000);
    if (!left) throw new Error('never redirected off /edit after submit — did it actually commit?');
  }

  function nextQueued() { return queue.find(i => i.status === 'queued'); }
  function editUrl(item) { return `${MB_ORIGIN}/${item.entityType}/${item.mbid}/edit`; }

  async function workerLoop(iframe) {
    while (running) {
      const item = nextQueued();
      if (!item) break;
      item.status = 'active'; renderQueue();
      log('info', `${item.entityType} ${item.mbid} — loading edit page`);
      iframe.src = editUrl(item);
      const loaded = await waitFor(() => { const w = frameWin(iframe); return w && frameDoc(iframe) && frameDoc(iframe).readyState !== 'loading' ? true : null; }, 15000);
      if (!loaded) { item.status = 'failed'; item.error = 'edit page never loaded'; log('error', `${item.mbid}: edit page never loaded`); renderQueue(); continue; }
      try {
        await fillAndSubmit(iframe, item);
        item.status = 'done';
        log('info', `${item.entityType} ${item.mbid} — committed ${item.url}`);
      } catch (e) {
        item.status = 'failed'; item.error = e.message || String(e);
        log('error', `${item.mbid}: ${item.error}`);
      }
      renderQueue();
    }
  }

  let workerIframes = [];
  function ensureWorkerIframes(n) {
    const strip = document.getElementById('falcon-workers'); if (!strip) return;
    while (workerIframes.length < n) {
      const f = document.createElement('iframe');
      f.className = 'falcon-worker'; f.style.cssText = 'width:220px;height:160px;border:1px solid #ccc;border-radius:4px;background:#fff;';
      strip.appendChild(f); workerIframes.push(f);
    }
    while (workerIframes.length > n) { const f = workerIframes.pop(); f.remove(); }
  }
  function start() {
    if (running) return;
    if (!queue.some(i => i.status === 'queued')) { log('warn', 'nothing queued'); return; }
    running = true;
    const need = Math.min(cfg.workers, queue.filter(i => i.status === 'queued').length);
    ensureWorkerIframes(need);
    log('info', `starting ${need} worker(s) for ${queue.filter(i => i.status === 'queued').length} queued item(s)`);
    workerIframes.forEach(f => workerLoop(f));
    updateRunBtn();
  }
  function stop() { running = false; log('info', 'stopping — in-flight items finish, no new ones start'); updateRunBtn(); }

  /* ════════════════════════ UI ════════════════════════ */
  let launcher = null;
  function ensureLauncher() {
    if (launcher) return;
    launcher = document.createElement('button');
    launcher.type = 'button'; launcher.id = 'falcon-launcher';
    launcher.title = `${NAME} — bulk link editor (Ctrl+Alt+F)`;
    launcher.dataset.mbCorner = 'br'; launcher.dataset.mbCornerOrder = '10';
    launcher.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.55);color:#1b2a4a;box-shadow:0 2px 8px rgba(0,0,0,.18);transition:background .15s,transform .1s;opacity:.55';
    launcher.innerHTML = ICON;
    launcher.onmouseenter = () => { launcher.style.transform = 'scale(1.08)'; launcher.style.opacity = '1'; };
    launcher.onmouseleave = () => { launcher.style.transform = 'scale(1)'; launcher.style.opacity = '.55'; };
    launcher.onclick = () => togglePanel();
    document.body.appendChild(launcher);
    mbRestackCorner('br');
  }

  let panel = null, tab = 'queue';
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div'); panel.id = 'falcon-panel';
    panel.style.cssText = 'display:none;flex-direction:column;position:fixed;z-index:2147483647;right:14px;bottom:64px;width:460px;max-width:90vw;max-height:70vh;background:#fff;color:#222;border-radius:8px;font:12px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28);border:1px solid #ddd;overflow:hidden';
    panel.innerHTML = `
      <div id="falcon-hdr" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b2a4a;color:#fff;cursor:move;user-select:none">
        <span style="display:flex;color:#ff9d5c">${ICON}</span>
        <span style="flex:1;font-weight:700">${NAME} <span style="opacity:.7;font-weight:400">v${scriptVersion()}</span></span>
        <button type="button" id="falcon-tab-queue" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Queue</button>
        <button type="button" id="falcon-tab-log" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Log</button>
        <a href="${HELP_URL}" target="_blank" rel="noopener" style="color:#fff;opacity:.7;text-decoration:none;font-weight:700">?</a>
        <button type="button" id="falcon-close" style="background:none;border:none;color:#fff;cursor:pointer;font:inherit;font-size:14px">✕</button>
      </div>
      <div id="falcon-body-queue" style="padding:8px 10px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:6px">
        <textarea id="falcon-paste" placeholder="One entity per line: <artist-mbid>,<url>  (or  artist:<mbid>,<url>  /  label:<mbid>,<url>)" style="width:100%;height:64px;box-sizing:border-box;font:11px monospace;resize:vertical"></textarea>
        <div style="display:flex;gap:6px;align-items:center">
          <button type="button" id="falcon-add" style="padding:4px 10px;cursor:pointer">+ Add to queue</button>
          <span style="margin-left:auto;color:#666">workers</span>
          <input type="number" id="falcon-workers" min="1" max="6" style="width:40px" />
          <button type="button" id="falcon-run" style="padding:4px 12px;font-weight:700;cursor:pointer;background:#1b2a4a;color:#fff;border:none;border-radius:4px">▶ Start</button>
        </div>
        <div id="falcon-queue-list" style="border-top:1px solid #eee;padding-top:4px;overflow:auto;max-height:220px"></div>
        <div id="falcon-workers" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
      <div id="falcon-body-log" style="display:none;padding:8px 10px;overflow:auto;flex:1;font:10px monospace;white-space:pre-wrap"></div>`;
    document.body.appendChild(panel);
    document.getElementById('falcon-close').onclick = () => { panel.style.display = 'none'; };
    const wIn = document.getElementById('falcon-workers'); wIn.value = cfg.workers;
    wIn.onchange = () => { cfg.workers = wIn.value; wIn.value = cfg.workers; };
    document.getElementById('falcon-add').onclick = () => {
      const ta = document.getElementById('falcon-paste');
      const items = toQueueItems(parsePaste(ta.value));
      if (!items.length) { log('warn', 'nothing parseable in the paste box'); return; }
      queue.push(...items); ta.value = ''; renderQueue();
      log('info', `queued ${items.length} item(s)`);
    };
    document.getElementById('falcon-run').onclick = () => { if (running) stop(); else start(); };
    document.getElementById('falcon-tab-queue').onclick = () => setTab('queue');
    document.getElementById('falcon-tab-log').onclick = () => setTab('log');
    // drag by header
    const hdr = document.getElementById('falcon-hdr');
    let dragging = false, dx = 0, dy = 0;
    hdr.addEventListener('mousedown', e => { if (e.target.closest('button, a')) return; dragging = true; const r = panel.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (!dragging) return; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + 'px'; panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px'; });
    window.addEventListener('mouseup', () => { dragging = false; });
  }
  function setTab(t) {
    tab = t;
    document.getElementById('falcon-body-queue').style.display = t === 'queue' ? 'flex' : 'none';
    document.getElementById('falcon-body-log').style.display = t === 'log' ? 'block' : 'none';
    if (t === 'log') renderLog();
  }
  function showPanel() { ensurePanel(); panel.style.display = 'flex'; renderQueue(); }
  function togglePanel() { ensurePanel(); if (panel.style.display === 'none') showPanel(); else panel.style.display = 'none'; }

  const DOT = { queued: '#999', active: '#e08a1e', done: '#2e9e5b', failed: '#c0392b' };
  function renderQueue() {
    const list = document.getElementById('falcon-queue-list'); if (!list) return;
    list.innerHTML = queue.map(it => `
      <div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid #f3f3f3" title="${it.error ? esc(it.error) : ''}">
        <span style="width:8px;height:8px;border-radius:50%;background:${DOT[it.status] || '#999'};flex:0 0 auto"></span>
        <a href="${MB_ORIGIN}/${it.entityType}/${it.mbid}" target="_blank" rel="noopener" style="color:#1b2a4a;text-decoration:none;font-weight:600">${it.entityType}/${it.mbid.slice(0, 8)}</a>
        <span style="color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(it.url)}</span>
        <span style="color:#999;text-transform:uppercase;font-size:9px">${it.status}</span>
      </div>`).join('') || '<div style="color:#999;padding:8px 0">Queue is empty — paste some lines above.</div>';
  }
  function renderLog() {
    const el = document.getElementById('falcon-body-log'); if (!el || tab !== 'log') return;
    el.textContent = LOG.join('\n');
    el.scrollTop = el.scrollHeight;
  }
  function updateRunBtn() {
    const b = document.getElementById('falcon-run'); if (!b) return;
    b.textContent = running ? '■ Stop' : '▶ Start';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ── boot ────────────────────────────────────────────────────────────── */
  const seeded = parseUrlParam();
  ensureLauncher();
  if (seeded && seeded.length) {
    queue = toQueueItems(seeded);
    log('info', `seeded ${seeded.length} item(s) from the falcon= URL param`);
    showPanel();
  }
  window.addEventListener('keydown', e => {
    if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
    if ((e.key || '').toLowerCase() !== 'f') return;
    e.preventDefault(); e.stopPropagation();
    togglePanel();
  });

  // Test hook only (#467) — no behavior change.
  window.__falconTest = { parseLine, parsePaste, parseUrlParam, toQueueItems, getQueue: () => queue, setQueue: q => { queue = q; renderQueue(); }, start, stop, cfg, fillAndSubmit, findAddLinkInput, findSubmitButton, editUrl };
})();
