// ==UserScript==
// @name         Track Cannon
// @namespace    https://musicbrainz.org/
// @version      2026.6.1.215715
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Optional mirror table that replaces the integrated tracklist.
// @author       majkinetor
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/track_cannon/README.md
// @match        https://musicbrainz.org/release/add
// @match        https://musicbrainz.org/release/*/edit
// @match        https://beta.musicbrainz.org/release/add
// @match        https://beta.musicbrainz.org/release/*/edit
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * Editor model (discovered via test/ spikes):
 *   read    MB.releaseEditor.rootField.release().mediums()[m].tracks()[t]
 *           .artistCredit() → { names:[{ artist:{name,gid,id}, name(creditedAs), joinPhrase }] }
 *   search  GET /ws/js/artist?q=<name>&direct=false → full entities (incl. numeric id).
 *   sibling GET /ws/2/release?release-group=<rg>&inc=recordings+artist-credits → other versions'
 *           per-track credits with gids; disambiguates search hits by title.
 *   write   track.artistCredit({ names:[{ artist: fullEntity, name: creditedAs, joinPhrase }] })
 *   ops     ed.removeTrack(t) · ed.moveTrackUp(t)/moveTrackDown(t) · track.name(s) ·
 *           track.length(ms) · track.formattedLength() · ed.utils.unformatTrackLength('3:53')
 */
(function () {
  'use strict';

  const T0 = Date.now();
  const TAG = '[TrackCannon]';
  const tss = () => ((Date.now() - T0) / 1000).toFixed(3) + 's';
  const Log = {
    info: (...a) => console.info(TAG, tss(), ...a),
    warn: (...a) => console.warn(TAG, tss(), ...a),
    err:  (...a) => console.error(TAG, tss(), ...a),
  };
  Log.info('boot —', location.href);

  const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
  const ORIGIN = location.origin;
  const u = v => { try { return typeof v === 'function' ? v() : v; } catch (e) { return undefined; } };
  const getEditor = () => { try { return W.MB && W.MB.releaseEditor; } catch (e) { return null; } };
  const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  const sameName = (a, b) => fold(a) === fold(b);

  /* ── settings ── */
  const SKEY = 'trackCannon.settings.v1';
  function loadSettings() { try { return Object.assign({ replace: false, autoRun: false }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { replace: false, autoRun: false }; } }
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(SETTINGS)); } catch (e) {} }
  let SETTINGS = loadSettings();

  function waitFor(check, { tries = 120, every = 500 } = {}) {
    return new Promise(res => { let n = 0; const t = () => { let v; try { v = check(); } catch (e) {} if (v) return res(v); if (++n >= tries) return res(null); setTimeout(t, every); }; t(); });
  }

  /* ── model access ── */
  function release() { return u(getEditor().rootField.release); }
  function mediums() { return u(release().mediums) || []; }
  function koTrack(mi, ti) { return u(mediums()[mi].tracks)[ti]; }
  function liveNames(track) { const ac = u(track.artistCredit) || {}; return u(ac.names) || []; }

  const ORIGINALS = new Map();
  function snapshotOriginals() {
    ORIGINALS.clear();
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      ORIGINALS.set(mi + ':' + ti, liveNames(t).map(n => ({ artist: u(n.artist) || { name: u(n.name) || '' }, creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '' })));
    }));
    Log.info('snapshot of', ORIGINALS.size, 'original track credits');
  }

  function readTracklist() {
    const out = [];
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const names = liveNames(t).map(n => { const a = u(n.artist) || null; return { creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '', artistGid: a ? u(a.gid) : null, artistName: a ? u(a.name) : '' }; });
      out.push({ mi, ti, number: u(t.number), title: u(t.name) || '', length: u(t.formattedLength) || '', names, resolved: names.length > 0 && names.every(n => n.artistGid) });
    }));
    return out;
  }

  /* ── search + siblings ── */
  const _cache = new Map();
  async function searchArtist(name) {
    const k = fold(name); if (!k) return [];
    if (_cache.has(k)) return _cache.get(k);
    let list = [];
    try { const j = await fetch(`${ORIGIN}/ws/js/artist?q=${encodeURIComponent(name)}&limit=8&direct=false`, { headers: { Accept: 'application/json' } }).then(r => r.json()); list = Array.isArray(j) ? j : (j.results || []); }
    catch (e) { Log.warn('search failed:', name, e.message); }
    _cache.set(k, list); return list;
  }
  async function fetchSiblings(rgGid) {
    const map = new Map();
    try {
      const r = await fetch(`${ORIGIN}/ws/2/release?release-group=${rgGid}&inc=recordings+artist-credits&fmt=json&limit=100`, { headers: { Accept: 'application/json' } });
      if (!r.ok) { Log.warn('WS2 sibling fetch', r.status); return map; }
      const j = await r.json();
      (j.releases || []).forEach(rel => (rel.media || []).forEach(med => (med.tracks || []).forEach(t => {
        const title = fold(t.title || (t.recording && t.recording.title));
        const ac = (t['artist-credit'] && t['artist-credit'].length) ? t['artist-credit'] : ((t.recording && t.recording['artist-credit']) || []);
        if (!title || map.has(title) || !ac.length || !ac.every(x => x.artist && x.artist.id)) return;
        map.set(title, ac.map(x => ({ gid: x.artist.id, name: x.artist.name, creditedAs: x.name || x.artist.name, joinPhrase: x.joinphrase || '' })));
      })));
    } catch (e) { Log.warn('sibling load failed:', e.message); }
    return map;
  }
  let _sibCache = { gid: undefined, map: null };
  async function loadSiblingMap(force) {
    const rg = u(release().releaseGroup); const rgGid = rg ? u(rg.gid) : null;
    if (!rgGid) { Log.info('no release group linked → search-only'); return new Map(); }
    if (!force && _sibCache.gid === rgGid && _sibCache.map && _sibCache.map.size) return _sibCache.map;
    let map = new Map();
    for (let i = 0; i < 3 && !map.size; i++) { if (i) await new Promise(r => setTimeout(r, 1100)); map = await fetchSiblings(rgGid); }  // MB WS2 ~1 req/s
    _sibCache = { gid: rgGid, map };
    if (map.size) Log.info('sibling map:', map.size, 'titles from RG', rgGid);
    else Log.warn('sibling map empty (RG', rgGid + ') — search only; retries on rebuild');
    return map;
  }

  async function matchSlot(creditedAs, sib) {
    let candidates = await searchArtist(creditedAs);
    let entity = null, source = 'search', confidence = 'low';
    if (sib && sib.gid) {
      let hit = candidates.find(c => c.gid === sib.gid);
      if (!hit && !sameName(sib.name, creditedAs)) hit = (await searchArtist(sib.name)).find(c => c.gid === sib.gid);
      if (hit) { entity = hit; source = 'rg'; confidence = 'high'; }
    }
    if (!entity) {
      const top = candidates[0] || null;
      if (!top) return { entity: null, source: 'none', confidence: 'none', candidates: [] };
      entity = top; confidence = sameName(top.name, creditedAs) ? 'high' : 'low';
    }
    return { entity, source, confidence, candidates: [entity, ...candidates.filter(c => c.gid !== entity.gid)] };
  }

  async function buildModel(onProgress) {
    const tl = readTracklist();
    const siblings = await loadSiblingMap();
    const tracks = [];
    const todo = tl.filter(t => t.names.some(n => !n.artistGid));
    let done = 0;
    for (const t of tl) {
      const sib = siblings.get(fold(t.title)) || null;
      const slots = [];
      for (let i = 0; i < t.names.length; i++) {
        const n = t.names[i];
        if (n.artistGid) { slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'set', entity: null, gid: n.artistGid, name: n.artistName, candidates: [], accept: false }); }
        else {
          const m = await matchSlot(n.creditedAs, sib && sib[i]);
          const status = m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none';
          slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status, entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, accept: status === 'rg' || status === 'high' });
        }
      }
      tracks.push({ mi: t.mi, ti: t.ti, number: t.number, title: t.title, length: t.length, slots });
      if (t.names.some(n => !n.artistGid)) { done++; if (onProgress) onProgress(done, todo.length); }
    }
    return { tracks };
  }

  /* ── apply / reset / structural ops ── */
  function applyTrack(entry, which) {
    const track = koTrack(entry.mi, entry.ti);
    const live = liveNames(track);
    let changed = false;
    const names = entry.slots.map((s, i) => {
      if (s.status === 'set') return live[i];
      const take = which === 'confident' ? ((s.status === 'rg' || s.status === 'high') && (s.accept = true)) : s.accept;
      if (take && s.entity) { changed = true; return { artist: s.entity, name: s.creditedAs, joinPhrase: s.joinPhrase }; }
      return live[i];
    });
    if (changed) track.artistCredit({ names });
    return changed;
  }
  function resetTrack(entry) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti);
    if (orig) koTrack(entry.mi, entry.ti).artistCredit({ names: orig.map(o => ({ artist: o.artist, name: o.creditedAs, joinPhrase: o.joinPhrase })) });
    Log.info('reset track', entry.number, 'to original');
  }
  function removeTrack(entry) { const ed = getEditor(); ed.removeTrack(koTrack(entry.mi, entry.ti)); Log.info('removed track', entry.number); }
  function moveTrack(entry, dir) { const ed = getEditor(); const t = koTrack(entry.mi, entry.ti); (dir < 0 ? ed.moveTrackUp : ed.moveTrackDown).call(ed, t); Log.info('moved track', entry.number, dir < 0 ? 'up' : 'down'); }
  function setTitle(entry, v) { koTrack(entry.mi, entry.ti).name(v); }
  function setLength(entry, v) {
    const ed = getEditor(); const t = koTrack(entry.mi, entry.ti);
    try { const ms = ed.utils && ed.utils.unformatTrackLength ? ed.utils.unformatTrackLength(v) : null; if (ms != null && !isNaN(ms)) t.length(ms); } catch (e) { Log.warn('length parse failed', v, e.message); }
  }

  /* ── create artist ── */
  function guessSortName(name) {
    const n = (name || '').trim();
    if (!/^[\x00-\x7F]+$/.test(n)) return n;
    const p = n.split(/\s+/); if (p.length < 2) return n;
    const last = p.pop(); return last + ', ' + p.join(' ');
  }
  function createArtist(name) {
    const url = `${ORIGIN}/artist/create?edit-artist.name=${encodeURIComponent(name)}&edit-artist.sort_name=${encodeURIComponent(guessSortName(name))}`;
    Log.info('open MB create-artist for', JSON.stringify(name)); W.open(url, '_blank', 'noopener');
  }

  /* ── shared UI helpers ── */
  const COLORS = { set: '#d6f0d8', rg: '#d6f0d8', high: '#d8e6ff', low: '#fdf3d0', user: '#e9dcfb', none: '#fbdcdf' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const artistLink = (gid, label) => gid ? `<a href="${ORIGIN}/artist/${gid}" target="_blank" rel="noopener" title="open artist page">${esc(label)} ↗</a>` : esc(label);
  function rowConfidence(t) {
    const live = t.slots.filter(s => s.status !== 'set'); if (!live.length) return 'set';
    const order = ['none', 'low', 'user', 'high', 'rg'];
    return live.map(s => s.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  }
  const badge = s => `<span class="tc-badge ${s}">${s === 'rg' ? 'RG' : s.toUpperCase()}</span>`;

  const css = `
    .tc-badge{font-size:10px;font-weight:bold;border-radius:9px;padding:1px 7px;letter-spacing:.3px;color:#fff;white-space:nowrap}
    .tc-badge.rg{background:#1f8a4c}.tc-badge.set{background:#6c757d}.tc-badge.high{background:#2f6fd6}
    .tc-badge.low{background:#e0a800}.tc-badge.user{background:#6f42c1}.tc-badge.none{background:#c0392b}
    .tc-btn{padding:4px 11px;border:1px solid #bbb;border-radius:3px;background:linear-gradient(#fff,#eee);cursor:pointer;font:13px Arial;color:#333}
    .tc-btn:hover{background:linear-gradient(#fff,#e4e4e4)}
    .tc-btn.primary{background:#5f3ec0;color:#fff;border-color:#4f33a3}.tc-btn.primary:hover{background:#553597}
    .tc-btn.mini{padding:1px 6px;font-size:11px}
    .tc-icon{cursor:pointer;border:none;background:none;font-size:13px;padding:0 2px;color:#666}
    .tc-cred{color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tc-sel{font:12px Arial;padding:2px;border:1px solid #bbb;border-radius:3px;background:#fff;max-width:100%}
    #tc-panel a,.tc-mirror a{color:#4800a0;text-decoration:none}
    #tc-panel a:hover,.tc-mirror a:hover{text-decoration:underline}

    /* floating panel */
    #tc-panel{position:fixed;top:90px;right:18px;width:600px;max-width:96vw;max-height:84vh;background:#fff;
      border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 30px rgba(40,20,80,.28);z-index:99999;
      display:flex;flex-direction:column;font:13px/1.4 Arial,Helvetica,sans-serif;color:#1c1c1c}
    #tc-hdr{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#ede9f6;border-bottom:1px solid #d7ccef;border-radius:6px 6px 0 0}
    #tc-hdr b{flex:1;color:#563b8f;font-size:14px}#tc-hdr .meta{font-size:12px;color:#6b6b6b}
    #tc-body{flex:1;overflow:auto}
    #tc-foot{display:flex;align-items:center;gap:8px;padding:8px 11px;border-top:1px solid #d7ccef;background:#f6f4fb;border-radius:0 0 6px 6px}
    #tc-foot .sp{flex:1;font-size:12px;color:#555}
    .tc-row{border-bottom:1px solid #eaeaea;padding:5px 10px}
    .tc-rowhead{display:flex;align-items:center;gap:7px}
    .tc-rowhead .num{color:#999;font-variant-numeric:tabular-nums;min-width:20px;text-align:right}
    .tc-rowhead .ttl{flex:1;font-weight:bold;color:#222}
    .tc-slot{display:flex;align-items:center;gap:6px;margin:4px 0 0 27px}
    .tc-slot .tc-cred{min-width:115px;max-width:115px}
    .tc-slot select{flex:1;min-width:0}

    /* settings popover */
    #tc-settings{position:fixed;z-index:100000;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 24px rgba(40,20,80,.3);padding:11px 13px;font:13px Arial;color:#222;width:330px}
    #tc-settings h4{margin:0 0 8px;color:#563b8f;font-size:13px}
    #tc-settings label{display:flex;gap:8px;align-items:flex-start;margin:7px 0;color:#333}
    #tc-settings .hint{color:#777;font-size:11px;margin:0 0 0 24px}

    /* mirror table */
    .tc-mirror{width:100%;border-collapse:collapse;font:13px Arial,Helvetica,sans-serif;background:#fff;margin:4px 0 8px}
    .tc-mirror th{background:#e8e8e8;border-bottom:2px solid #ccc;text-align:left;padding:4px 6px;font-size:12px;color:#333}
    .tc-mirror td{border-bottom:1px solid #e2e2e2;padding:4px 6px;vertical-align:top}
    .tc-mirror .c-mv{width:30px;white-space:nowrap}
    .tc-mirror .c-num{width:26px;text-align:right;color:#888;font-variant-numeric:tabular-nums}
    .tc-mirror .c-len{width:54px}.tc-mirror .c-act{width:90px;white-space:nowrap}.tc-mirror .c-x{width:22px}
    .tc-mirror input.t-title{width:100%;border:1px solid transparent;background:transparent;font:13px Arial;padding:2px}
    .tc-mirror input.t-title:hover,.tc-mirror input.t-title:focus{border-color:#bbb;background:#fff}
    .tc-mirror input.t-len{width:48px;border:1px solid transparent;background:transparent;font:13px Arial;padding:2px;text-align:right}
    .tc-mirror input.t-len:hover,.tc-mirror input.t-len:focus{border-color:#bbb;background:#fff}
    .tc-mirror .mv{cursor:pointer;color:#6f54c0;font-size:14px;line-height:1}
    .tc-mirror .rm{cursor:pointer;color:#c0392b;font-weight:bold;border:none;background:none;font-size:15px}
    .tc-mirror .look{cursor:pointer;color:#666;border:none;background:none;font-size:14px}
    .tc-aslot{display:flex;align-items:center;gap:5px;margin:2px 0}
    .tc-aslot .join{color:#999;font-style:italic;font-size:11px;min-width:34px}
    .tc-aslot select{flex:1;min-width:60px}
    .tc-medhdr{background:#dfd7f0;font-weight:bold;color:#4b3a82;padding:4px 8px}
    #tc-mirror-bar{display:flex;align-items:center;gap:8px;padding:6px 0}
    #tc-mirror-bar b{color:#563b8f}#tc-mirror-bar .sp{flex:1;font-size:12px;color:#666}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;background:#5f3ec0;color:#fff;border:none;border-radius:20px;padding:8px 14px;font:bold 13px Arial;cursor:pointer;box-shadow:0 3px 12px rgba(40,20,80,.3)}
  `;
  function style() { if (document.getElementById('tc-css')) return; const s = document.createElement('style'); s.id = 'tc-css'; s.textContent = css; document.head.appendChild(s); }

  /* ── settings popover ── */
  function openSettings(anchor) {
    style();
    let s = document.getElementById('tc-settings'); if (s) { s.remove(); return; }
    s = document.createElement('div'); s.id = 'tc-settings';
    s.innerHTML = `<h4>🎯 Track Cannon — settings</h4>
      <label><input type="checkbox" id="tc-s-replace"> <span>Replace MB track list</span></label>
      <div class="hint">On: a Track Cannon table takes over the tracklist (reorder, remove, length and the artist matcher in one). Off: a floating review panel beside the editor.</div>
      <label><input type="checkbox" id="tc-s-auto"> <span>Run automatically when the page opens</span></label>
      <div class="hint">Match on load (floating mode opens the panel itself). Nothing is applied until you click.</div>`;
    document.body.appendChild(s);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 60, bottom: 80 };
    s.style.left = Math.min(r.left, window.innerWidth - 350) + 'px'; s.style.top = (r.bottom + 6) + 'px';
    const rep = s.querySelector('#tc-s-replace'), au = s.querySelector('#tc-s-auto');
    rep.checked = !!SETTINGS.replace; au.checked = !!SETTINGS.autoRun;
    rep.onchange = () => { SETTINGS.replace = rep.checked; saveSettings(); Log.info('replace =', SETTINGS.replace); applyMode(); };
    au.onchange = () => { SETTINGS.autoRun = au.checked; saveSettings(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  /* ════════════════ FLOATING PANEL ════════════════ */
  let MODEL = null;
  async function openPanel() {
    style();
    let p = document.getElementById('tc-panel'); if (p) p.remove();
    const lp = document.getElementById('tc-launch'); if (lp) lp.remove();
    p = document.createElement('div'); p.id = 'tc-panel';
    p.innerHTML = `<div id="tc-hdr"><b>🎯 Track Cannon</b><span class="meta" id="tc-status">matching…</span>
        <button class="tc-icon" id="tc-gear" title="settings">⚙</button><button class="tc-icon" id="tc-close" title="close">✕</button></div>
      <div id="tc-body"></div>
      <div id="tc-foot"><span class="sp" id="tc-sum"></span>
        <button class="tc-btn" id="tc-apply-conf">Apply confident</button>
        <button class="tc-btn primary" id="tc-apply">Apply checked</button></div>`;
    document.body.appendChild(p);
    p.querySelector('#tc-close').onclick = () => p.remove();
    p.querySelector('#tc-gear').onclick = e => openSettings(e.currentTarget);
    MODEL = await buildModel((d, n) => { const st = p.querySelector('#tc-status'); if (st) st.textContent = `matching ${d}/${n}…`; });
    renderPanelRows();
    p.querySelector('#tc-apply-conf').onclick = () => { MODEL.tracks.forEach(t => applyTrack(t, 'confident')); afterApply('confident'); };
    p.querySelector('#tc-apply').onclick = () => { MODEL.tracks.forEach(t => applyTrack(t, 'checked')); afterApply('checked'); };
  }
  function afterApply(mode) { Log.info('apply', mode); const st = document.getElementById('tc-status'); if (st) st.textContent = 'applied'; renderPanelRows(); }

  function renderPanelRows() {
    const body = document.getElementById('tc-body'); if (!body) return;
    body.innerHTML = ''; let confident = 0, unresolved = 0;
    MODEL.tracks.forEach(t => {
      t.slots.forEach(s => { if (s.status !== 'set') { unresolved++; if (s.status === 'rg' || s.status === 'high') confident++; } });
      const row = document.createElement('div'); row.className = 'tc-row'; row.style.background = COLORS[rowConfidence(t)] || '#fff';
      const head = document.createElement('div'); head.className = 'tc-rowhead';
      head.innerHTML = `<span class="num">${t.number}</span><span class="ttl">${esc(t.title)}</span>`;
      const orig = document.createElement('button'); orig.className = 'tc-btn mini'; orig.textContent = 'Original';
      orig.onclick = () => { resetTrack(t); refreshEntry(t); renderPanelRows(); };
      head.appendChild(orig); row.appendChild(head);
      t.slots.forEach(s => row.appendChild(slotEl(t, s, false)));
      body.appendChild(row);
    });
    const st = document.getElementById('tc-status'); if (st) st.textContent = `${unresolved} to resolve`;
    const sum = document.getElementById('tc-sum'); if (sum) sum.textContent = `${MODEL.tracks.length} tracks · ${confident} confident`;
  }

  // one artist slot as a flex line (shared by panel + mirror)
  function slotEl(entry, s, mirror) {
    const slot = document.createElement('div'); slot.className = mirror ? 'tc-aslot' : 'tc-slot';
    if (mirror && s.joinPhrase != null && entry.slots.length > 1) slot.insertAdjacentHTML('beforeend', `<span class="join">${esc((s.joinPhrase || '').trim() || '·')}</span>`);
    if (s.status === 'set') {
      slot.insertAdjacentHTML('beforeend', (mirror ? '' : `<span class="tc-cred" style="min-width:115px;max-width:115px" title="${esc(s.creditedAs)}">${esc(s.creditedAs)}</span>`) +
        `<span style="flex:1">${artistLink(s.gid, s.name || s.creditedAs)}</span>${badge('set')}`);
      return slot;
    }
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!s.accept; cb.title = 'apply this slot';
    cb.onchange = () => { s.accept = cb.checked; };
    slot.appendChild(cb);
    if (!mirror) slot.insertAdjacentHTML('beforeend', `<span class="tc-cred" title="${esc(s.creditedAs)}">${esc(s.creditedAs)}</span>`);
    if (s.candidates && s.candidates.length) {
      const sel = document.createElement('select'); sel.className = 'tc-sel';
      sel.innerHTML = s.candidates.map((c, ci) => `<option value="${ci}"${c.gid === s.gid ? ' selected' : ''}>${esc(c.name)}${c.comment ? ' (' + esc(c.comment) + ')' : ''}${c.typeName ? ' · ' + c.typeName : ''}</option>`).join('');
      sel.onchange = () => { s.entity = s.candidates[+sel.value]; s.gid = s.entity.gid; s.name = s.entity.name; s.status = 'user'; s.accept = true; rerender(); };
      slot.appendChild(sel);
      slot.insertAdjacentHTML('beforeend', `<a class="tc-icon" href="${ORIGIN}/artist/${s.gid}" target="_blank" rel="noopener" title="open artist page">↗</a>`);
    } else slot.insertAdjacentHTML('beforeend', `<em style="flex:1;color:#a33">no match</em>`);
    const create = document.createElement('button'); create.className = 'tc-btn mini'; create.textContent = '+'; create.title = 'create “' + s.creditedAs + '” on MusicBrainz';
    create.onclick = () => createArtist(s.creditedAs); slot.appendChild(create);
    slot.insertAdjacentHTML('beforeend', badge(s.status));
    return slot;
  }
  function rerender() { if (document.getElementById('tc-mirror-wrap')) renderMirror(); else if (document.getElementById('tc-panel')) renderPanelRows(); }
  function refreshEntry(entry) {
    const live = liveNames(koTrack(entry.mi, entry.ti));
    entry.slots.forEach((s, i) => { const a = live[i] && u(live[i].artist); const gid = a ? u(a.gid) : null; if (gid) { s.status = 'set'; s.gid = gid; s.name = u(a.name); } });
  }

  /* ════════════════ MIRROR TABLE ════════════════ */
  function nativeTrackTables() { return [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track')); }
  function hideNative(hide) { nativeTrackTables().forEach(t => { t.style.display = hide ? 'none' : ''; }); }

  async function showMirror() {
    style();
    let wrap = document.getElementById('tc-mirror-wrap');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'tc-mirror-wrap';
      const tbl = nativeTrackTables()[0];
      if (tbl && tbl.parentElement) tbl.parentElement.insertBefore(wrap, tbl);
      else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(wrap);
    }
    wrap.innerHTML = `<div id="tc-mirror-bar"><b>🎯 Track Cannon</b><span class="sp" id="tc-mstatus">matching…</span>
      <button class="tc-btn mini" id="tc-mgear">⚙ settings</button>
      <button class="tc-btn" id="tc-mconf">Apply confident</button></div><div id="tc-mirror-body"></div>`;
    hideNative(true);
    wrap.querySelector('#tc-mgear').onclick = e => openSettings(e.currentTarget);
    wrap.querySelector('#tc-mconf').onclick = () => { MODEL.tracks.forEach(t => applyTrack(t, 'confident')); rebuildMirror(); };
    MODEL = await buildModel((d, n) => { const st = document.getElementById('tc-mstatus'); if (st) st.textContent = `matching ${d}/${n}…`; });
    renderMirror();
  }
  function hideMirror() { const w = document.getElementById('tc-mirror-wrap'); if (w) w.remove(); hideNative(false); }
  async function rebuildMirror() { MODEL = await buildModel(); renderMirror(); }

  function renderMirror() {
    const body = document.getElementById('tc-mirror-body'); if (!body) return;
    let confident = 0, unresolved = 0;
    const rows = [];
    let lastMi = -1;
    MODEL.tracks.forEach((t, idx) => {
      if (t.mi !== lastMi && mediums().length > 1) { rows.push(`<tr><td class="tc-medhdr" colspan="7">Medium ${t.mi + 1}</td></tr>`); lastMi = t.mi; }
      t.slots.forEach(s => { if (s.status !== 'set') { unresolved++; if (s.status === 'rg' || s.status === 'high') confident++; } });
      const tr = document.createElement('tr'); tr.style.background = COLORS[rowConfidence(t)] || '#fff'; tr.dataset.idx = idx;
      tr.innerHTML = `<td class="c-mv"><span class="mv up" title="move up">▲</span><span class="mv dn" title="move down">▼</span></td>
        <td class="c-num">${t.number}</td>
        <td class="c-title"><input class="t-title" value="${esc(t.title)}"></td>
        <td class="c-art"></td>
        <td class="c-look"><button class="look" title="re-match this track">🔍</button></td>
        <td class="c-len"><input class="t-len" value="${esc(t.length)}"></td>
        <td class="c-x"><button class="rm" title="remove track">✕</button></td>`;
      const art = tr.querySelector('.c-art'); t.slots.forEach(s => art.appendChild(slotEl(t, s, true)));
      tr.querySelector('.t-title').onchange = e => setTitle(t, e.target.value);
      tr.querySelector('.t-len').onchange = e => setLength(t, e.target.value);
      tr.querySelector('.up').onclick = async () => { moveTrack(t, -1); await rebuildMirror(); };
      tr.querySelector('.dn').onclick = async () => { moveTrack(t, +1); await rebuildMirror(); };
      tr.querySelector('.rm').onclick = async () => { removeTrack(t); await rebuildMirror(); };
      tr.querySelector('.look').onclick = async () => { await rematchTrack(t); renderMirror(); };
      rows.push(tr);
    });
    body.innerHTML = `<table class="tc-mirror"><thead><tr><th></th><th>#</th><th>Title</th><th>Artist</th><th></th><th>Length</th><th></th></tr></thead><tbody></tbody></table>`;
    const tb = body.querySelector('tbody');
    rows.forEach(r => { if (typeof r === 'string') tb.insertAdjacentHTML('beforeend', r); else tb.appendChild(r); });
    const st = document.getElementById('tc-mstatus'); if (st) st.textContent = `${MODEL.tracks.length} tracks · ${unresolved} to resolve · ${confident} confident`;
    hideNative(true);
  }
  async function rematchTrack(entry) {
    const siblings = await loadSiblingMap();
    const sib = siblings.get(fold(entry.title)) || null;
    for (let i = 0; i < entry.slots.length; i++) {
      const s = entry.slots[i]; if (s.status === 'set') continue;
      const m = await matchSlot(s.creditedAs, sib && sib[i]);
      Object.assign(s, { status: m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none', entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, accept: m.source === 'rg' || m.confidence === 'high' });
    }
  }

  /* ── mode switching ── */
  function applyMode() {
    if (SETTINGS.replace) { const p = document.getElementById('tc-panel'); if (p) p.remove(); showMirror(); }
    else { hideMirror(); }
  }

  /* ── entry points ── */
  function injectButton() {
    if (document.getElementById('tc-btn')) return true;
    const anchor = [...document.querySelectorAll('button, input[type=button]')].find(b => /guess feat\. artists|guess case|reset track numbers/i.test(b.textContent || b.value || ''));
    if (!anchor || !anchor.parentElement) return false;
    style();
    const btn = document.createElement('button'); btn.id = 'tc-btn'; btn.type = 'button'; btn.textContent = '🎯 Track Cannon';
    btn.style.cssText = 'margin-left:8px;font-weight:bold';
    btn.onclick = () => { if (SETTINGS.replace) { document.getElementById('tc-mirror-wrap') ? hideMirror() : showMirror(); } else openPanel(); };
    const gear = document.createElement('button'); gear.id = 'tc-gear-btn'; gear.type = 'button'; gear.textContent = '⚙'; gear.title = 'Track Cannon settings';
    gear.style.cssText = 'margin-left:4px'; gear.onclick = e => openSettings(e.currentTarget);
    anchor.parentElement.appendChild(btn); anchor.parentElement.appendChild(gear);
    Log.info('button injected next to tracklist tools');
    return true;
  }
  function ensureLauncher() {
    if (document.getElementById('tc-btn') || document.getElementById('tc-launch') || SETTINGS.replace) return;
    style(); const b = document.createElement('button'); b.id = 'tc-launch'; b.textContent = '🎯 Track Cannon';
    b.onclick = () => SETTINGS.replace ? showMirror() : openPanel(); document.body.appendChild(b);
  }

  W.__trackCannon = { readTracklist, buildModel, applyTrack, resetTrack, removeTrack, moveTrack, searchArtist, openPanel, showMirror, hideMirror, snapshotOriginals, get model() { return MODEL; }, get settings() { return SETTINGS; } };

  (async function main() {
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready · replace =', SETTINGS.replace, '· autoRun =', SETTINGS.autoRun);
    snapshotOriginals();
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    injectButton(); ensureLauncher();
    const mo = new MutationObserver(() => { if (injectButton()) { const l = document.getElementById('tc-launch'); if (l) l.remove(); } if (SETTINGS.replace && !document.getElementById('tc-mirror-wrap') && nativeTrackTables().length) showMirror(); });
    mo.observe(document.body, { childList: true, subtree: true });
    if (SETTINGS.replace) showMirror();
    else if (SETTINGS.autoRun) openPanel();
  })();
})();
