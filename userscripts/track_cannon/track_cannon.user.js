// ==UserScript==
// @name         Track Cannon
// @namespace    https://musicbrainz.org/
// @version      2026.6.1.225321
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Same table whether floating or replacing the integrated tracklist.
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
  function loadSettings() { try { return Object.assign({ replace: false, autoRun: false, colWidths: {}, applyMode: 'all' }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { replace: false, autoRun: false, colWidths: {}, applyMode: 'all' }; } }
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
    for (let i = 0; i < 3 && !map.size; i++) { if (i) await new Promise(r => setTimeout(r, 1100)); map = await fetchSiblings(rgGid); }
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
  function refreshEntry(entry) {
    const live = liveNames(koTrack(entry.mi, entry.ti));
    entry.slots.forEach((s, i) => { const a = live[i] && u(live[i].artist); const gid = a ? u(a.gid) : null; if (gid) { s.status = 'set'; s.gid = gid; s.name = u(a.name); } });
  }
  function resetTrack(entry) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti);
    if (orig) koTrack(entry.mi, entry.ti).artistCredit({ names: orig.map(o => ({ artist: o.artist, name: o.creditedAs, joinPhrase: o.joinPhrase })) });
    Log.info('reset track', entry.number, 'to original');
  }
  function removeTrack(entry) { getEditor().removeTrack(koTrack(entry.mi, entry.ti)); Log.info('removed track', entry.number); }
  function moveTrack(entry, dir) { const ed = getEditor(); const t = koTrack(entry.mi, entry.ti); (dir < 0 ? ed.moveTrackUp : ed.moveTrackDown).call(ed, t); }
  function setTitle(entry, v) { koTrack(entry.mi, entry.ti).name(v); }
  function setLength(entry, v) { const ed = getEditor(); try { const ms = ed.utils && ed.utils.unformatTrackLength ? ed.utils.unformatTrackLength(v) : null; if (ms != null && !isNaN(ms)) koTrack(entry.mi, entry.ti).length(ms); } catch (e) { Log.warn('length parse failed', v, e.message); } }

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

  /* ════════════════════════ UI ════════════════════════ */
  const ICON = '<svg class="tc-ico" viewBox="0 0 34 28" width="24" height="20" aria-hidden="true" style="vertical-align:-5px">' +
    '<path d="M17 16 L19.6 19.6 L21.8 19.6" fill="none" stroke="#3d2470" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="17.5" cy="13" r="3.5" fill="#5f3ec0"/><circle cx="21.4" cy="14" r="1.5" fill="#3d2470"/>' +
    '<polygon points="6.99,4.01 19.43,11.34 16.57,15.66 5.01,6.99" fill="#5f3ec0"/>' +
    '<line x1="5.01" y1="6.99" x2="6.99" y2="4.01" stroke="#2a1a52" stroke-width="1.7"/>' +
    '<circle cx="12.5" cy="18.5" r="5.4" fill="#3d2470"/><circle cx="12.5" cy="18.5" r="4.3" fill="none" stroke="#fff" stroke-width="0.9"/>' +
    '<g stroke="#fff" stroke-width="0.8"><line x1="7.3" y1="18.5" x2="17.7" y2="18.5"/><line x1="12.5" y1="13.3" x2="12.5" y2="23.7"/><line x1="9.53" y1="15.53" x2="15.47" y2="21.47"/><line x1="9.53" y1="21.47" x2="15.47" y2="15.53"/></g>' +
    '<circle cx="12.5" cy="18.5" r="1.5" fill="#fff"/>' +
    '<g fill="#e0a800"><circle cx="4.4" cy="4.6" r="1.4"/><circle cx="2.2" cy="2.6" r="0.8"/></g>' +
    '<text x="0" y="6" font-size="10" font-weight="bold" fill="#1f8a4c" font-family="Arial">♪</text></svg>';

  const COLORS = { set: '#d6f0d8', rg: '#d6f0d8', high: '#d8e6ff', low: '#fdf3d0', user: '#e9dcfb', none: '#fbdcdf' };
  const COLS = [{ k: 'mv', w: 34, label: '' }, { k: 'num', w: 26, label: '#' }, { k: 'title', w: 200, label: 'Title' }, { k: 'art', w: 340, label: 'Artist' }, { k: 'len', w: 56, label: 'Length' }, { k: 'x', w: 26, label: '' }];
  const TYPE_ICON = { person: '👤', group: '👥', orchestra: '🎻', choir: '🎶', character: '🎭', other: '🎤' };
  const typeIcon = c => TYPE_ICON[(c.typeName || '').toLowerCase()] || (c.typeName ? '🎤' : '·');
  const colW = (k, d) => (SETTINGS.colWidths && SETTINGS.colWidths[k]) || d;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const artistLink = (gid, label) => gid ? `<a href="${ORIGIN}/artist/${gid}" target="_blank" rel="noopener" title="open artist page">${esc(label)} ↗</a>` : esc(label);
  function rowConfidence(t) { const live = t.slots.filter(s => s.status !== 'set'); if (!live.length) return 'set'; const order = ['none', 'low', 'user', 'high', 'rg']; return live.map(s => s.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]; }
  const badge = s => `<span class="tc-badge ${s}">${s === 'rg' ? 'RG' : s.toUpperCase()}</span>`;

  const css = `
    .tc-badge{font-size:10px;font-weight:bold;border-radius:9px;padding:1px 7px;color:#fff;white-space:nowrap}
    .tc-badge.rg{background:#1f8a4c}.tc-badge.set{background:#6c757d}.tc-badge.high{background:#2f6fd6}
    .tc-badge.low{background:#e0a800}.tc-badge.user{background:#6f42c1}.tc-badge.none{background:#c0392b}
    .tc-btn{padding:4px 11px;border:1px solid #bbb;border-radius:3px;background:linear-gradient(#fff,#eee);cursor:pointer;font:13px Arial;color:#333}
    .tc-btn:hover{background:linear-gradient(#fff,#e4e4e4)}
    .tc-btn.primary{background:#5f3ec0;color:#fff;border-color:#4f33a3}.tc-btn.primary:hover{background:#553597}
    .tc-btn.mini{padding:1px 6px;font-size:11px}
    .tc-icon{cursor:pointer;border:none;background:none;font-size:13px;padding:0 2px;color:#666}
    #tc-panel a,#tc-mirror-wrap a{color:#4800a0;text-decoration:none}#tc-panel a:hover,#tc-mirror-wrap a:hover{text-decoration:underline}

    .tc-mirror{table-layout:fixed;border-collapse:collapse;font:13px Arial,Helvetica,sans-serif;background:#fff}
    .tc-mirror th{position:relative;background:#e8e8e8;border-bottom:2px solid #ccc;text-align:left;padding:4px 6px;font-size:12px;color:#333;overflow:hidden}
    .tc-mirror td{border-bottom:1px solid #e2e2e2;padding:3px 6px;vertical-align:top;overflow:hidden}
    .tc-mirror .tc-resizer{position:absolute;right:0;top:0;height:100%;width:7px;cursor:col-resize}
    .tc-mirror .c-num{text-align:right;color:#888;font-variant-numeric:tabular-nums}
    .tc-mirror .c-mv{white-space:nowrap}
    .tc-mirror input.t-title,.tc-mirror input.t-len{width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;font:13px Arial;padding:2px}
    .tc-mirror input.t-len{text-align:right}
    .tc-mirror input.t-title:hover,.tc-mirror input.t-title:focus,.tc-mirror input.t-len:hover,.tc-mirror input.t-len:focus{border-color:#bbb;background:#fff}
    .tc-mirror .mv{cursor:pointer;color:#6f54c0;font-size:13px;padding:0 1px}.tc-mirror .mv.rv{color:#888}
    .tc-mirror .rm{cursor:pointer;color:#c0392b;font-weight:bold;border:none;background:none;font-size:15px}
    .tc-aslot{display:flex;align-items:center;gap:3px;margin:2px 0;min-width:0}
    .tc-aslot .join{color:#999;font-style:italic;font-size:11px;flex:none}
    .tc-aslot .cred{color:#888;font-size:11px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
    .tc-aslot .slotrev{cursor:pointer;color:#aaa;border:none;background:none;font-size:12px;padding:0 1px}.tc-aslot .slotrev:hover{color:#6f42c1}
    .tc-combo{display:flex;align-items:center;gap:2px;flex:1;min-width:46px}
    .tc-combo .tic{flex:none;font-size:12px;width:15px;text-align:center}
    .tc-acinput{flex:1;min-width:40px;font:12px Arial;padding:2px 4px;border:1px solid #bbb;border-radius:3px;background:#fff}
    .tc-acinput.empty{color:#a33;font-style:italic}
    .tc-acpop{position:fixed;z-index:100002;background:#fff;border:1px solid #b9a4e0;border-radius:4px;box-shadow:0 6px 22px rgba(40,20,80,.3);max-height:280px;overflow:auto;font:12px Arial;min-width:200px}
    .tc-acrow{display:flex;align-items:center;gap:7px;padding:4px 9px;cursor:pointer}
    .tc-acrow:hover,.tc-acrow.hi{background:#ede9f6}
    .tc-acrow .tic{flex:none;width:16px;text-align:center;font-size:13px}
    .tc-acrow .nm{font-weight:600;color:#222}.tc-acrow .cmt{color:#888;font-size:11px}
    .tc-acrow .none{color:#888;font-style:italic}
    .tc-toolbar{padding:5px 4px;font-size:12px;color:#555;display:flex;align-items:center;gap:6px}
    .tc-toolbar select{font:12px Arial;padding:1px}
    .tc-medhdr{background:#dfd7f0;font-weight:bold;color:#4b3a82;padding:4px 8px}

    #tc-panel{position:fixed;top:90px;right:18px;width:720px;max-width:96vw;max-height:84vh;background:#fff;
      border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 8px 34px rgba(40,20,80,.32);z-index:99999;
      display:flex;flex-direction:column;font:13px/1.4 Arial,Helvetica,sans-serif;color:#1c1c1c}
    #tc-hdr{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#ede9f6;border-bottom:1px solid #d7ccef;border-radius:6px 6px 0 0;cursor:move;user-select:none}
    #tc-hdr b{flex:1;color:#563b8f;font-size:14px}#tc-hdr .meta{font-size:12px;color:#6b6b6b}
    #tc-body{flex:1;overflow:auto}
    #tc-foot{display:flex;align-items:center;gap:8px;padding:8px 11px;border-top:1px solid #d7ccef;background:#f6f4fb;border-radius:0 0 6px 6px}
    #tc-foot .sp{flex:1}

    #tc-mirror-wrap{margin:4px 0 10px}
    #tc-bar{display:flex;align-items:center;gap:8px;padding:6px 2px}
    #tc-bar b{color:#563b8f}#tc-bar .tc-status{flex:1;font-size:12px;color:#666}
    .tc-tablewrap{overflow-x:auto}

    #tc-settings{position:fixed;z-index:100001;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 24px rgba(40,20,80,.3);padding:11px 13px;font:13px Arial;color:#222;width:340px}
    #tc-settings h4{margin:0 0 8px;color:#563b8f;font-size:13px}
    #tc-settings label{display:flex;gap:8px;align-items:flex-start;margin:7px 0;color:#333}
    #tc-settings .hint{color:#777;font-size:11px;margin:0 0 4px 24px}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;background:#5f3ec0;color:#fff;border:none;border-radius:20px;padding:8px 14px;font:bold 13px Arial;cursor:pointer;box-shadow:0 3px 12px rgba(40,20,80,.3)}
    #tc-btn,#tc-gear-btn{vertical-align:middle}
  `;
  function style() { if (document.getElementById('tc-css')) return; const s = document.createElement('style'); s.id = 'tc-css'; s.textContent = css; document.head.appendChild(s); }

  /* ── settings popover (one place; reachable from the Canon interface) ── */
  function openSettings(anchor) {
    style(); let s = document.getElementById('tc-settings'); if (s) { s.remove(); return; }
    s = document.createElement('div'); s.id = 'tc-settings';
    s.innerHTML = `<h4>${ICON} Track Cannon — settings</h4>
      <label><input type="checkbox" id="tc-s-replace"> <span>Replace MB track list</span></label>
      <div class="hint">On: the Track Cannon table takes the place of the integrated tracklist. Off: the same table in a floating window.</div>
      <label><input type="checkbox" id="tc-s-auto"> <span>Run automatically on the Tracklist tab</span></label>
      <div class="hint">Matches as soon as you open the Tracklist tab (not before — the release group may not be set yet). Nothing is applied until you click.</div>`;
    document.body.appendChild(s);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 60, bottom: 80 };
    s.style.left = Math.min(r.left, window.innerWidth - 360) + 'px'; s.style.top = (r.bottom + 6) + 'px';
    const rep = s.querySelector('#tc-s-replace'), au = s.querySelector('#tc-s-auto');
    rep.checked = !!SETTINGS.replace; au.checked = !!SETTINGS.autoRun;
    rep.onchange = () => { SETTINGS.replace = rep.checked; saveSettings(); Log.info('replace =', SETTINGS.replace); applyMode(); };
    au.onchange = () => { SETTINGS.autoRun = au.checked; saveSettings(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  /* ── the one shared table ── */
  let MODEL = null;
  let ACTIVE = {};   // { mode, tbody, statusEl }
  const updateStatus = t => { if (ACTIVE.statusEl) ACTIVE.statusEl.textContent = t; };
  const rerender = () => { if (ACTIVE.tbody) fillRows(ACTIVE.tbody); };

  function buildTable() {
    const t = document.createElement('table'); t.className = 'tc-mirror';
    t.innerHTML = `<colgroup>${COLS.map(c => `<col style="width:${colW(c.k, c.w)}px">`).join('')}</colgroup>` +
      `<thead><tr>${COLS.map(c => `<th>${c.label}<span class="tc-resizer"></span></th>`).join('')}</tr></thead><tbody></tbody>`;
    return t;
  }
  // toolbar (above the table) + table; returns the tbody. Shared by both modes.
  function mountTable(container) {
    container.innerHTML = '';
    const bar = document.createElement('div'); bar.className = 'tc-toolbar';
    bar.innerHTML = `<span>When I pick an artist → apply to</span><select class="tc-applymode"><option value="all">all matching tracks</option><option value="single">this track only</option></select>`;
    const am = bar.querySelector('.tc-applymode'); am.value = SETTINGS.applyMode || 'all';
    am.onchange = () => { SETTINGS.applyMode = am.value; saveSettings(); Log.info('applyMode =', am.value); };
    container.appendChild(bar);
    const wrap = document.createElement('div'); wrap.className = 'tc-tablewrap'; container.appendChild(wrap);
    const table = buildTable(); wrap.appendChild(table); wireResizers(table);
    return table.querySelector('tbody');
  }
  function wireResizers(table) {
    const cols = [...table.querySelectorAll('col')];
    [...table.querySelectorAll('th .tc-resizer')].forEach((rz, i) => {
      rz.onmousedown = e => {
        e.preventDefault(); e.stopPropagation();
        const col = cols[i], startX = e.clientX, startW = col.offsetWidth || parseInt(col.style.width) || 100;
        const mm = ev => { col.style.width = Math.max(36, startW + ev.clientX - startX) + 'px'; };
        const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); SETTINGS.colWidths = SETTINGS.colWidths || {}; SETTINGS.colWidths[COLS[i].k] = parseInt(col.style.width); saveSettings(); };
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
      };
    });
  }
  // when the user picks an artist for a credit, optionally copy it to every other track
  // that has the same credited text (the "all" mode above the table)
  function propagate(srcSlot, c) {
    if ((SETTINGS.applyMode || 'all') !== 'all') return;
    const key = fold(srcSlot.creditedAs); let n = 0;
    MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s === srcSlot || s.status === 'set' || fold(s.creditedAs) !== key) return; s.entity = c; s.gid = c.gid; s.name = c.name; s.status = 'user'; s.accept = true; n++; }));
    if (n) Log.info('propagated', c.name, '→', n, 'slot(s) credited', JSON.stringify(srcSlot.creditedAs));
  }
  function pickArtist(slot, c) { slot.entity = c; slot.gid = c.gid; slot.name = c.name; slot.status = 'user'; slot.accept = true; propagate(slot, c); rerender(); }

  async function revertSlot(entry, i) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti); if (!orig || !orig[i]) return;
    const track = koTrack(entry.mi, entry.ti), live = liveNames(track);
    track.artistCredit({ names: entry.slots.map((s, j) => j === i ? { artist: orig[i].artist, name: orig[i].creditedAs, joinPhrase: orig[i].joinPhrase } : (live[j] || { artist: s.entity, name: s.creditedAs, joinPhrase: s.joinPhrase })) });
    const slot = entry.slots[i]; slot.creditedAs = orig[i].creditedAs; slot.joinPhrase = orig[i].joinPhrase;
    const a = u(orig[i].artist) || {}, gid = u(a.gid);
    if (gid) Object.assign(slot, { status: 'set', gid, name: u(a.name), entity: null, candidates: [], accept: false });
    else { const sib = (await loadSiblingMap()).get(fold(entry.title)); const m = await matchSlot(orig[i].creditedAs, sib && sib[i]); Object.assign(slot, { status: m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none', entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, accept: m.source === 'rg' || m.confidence === 'high' }); }
    Log.info('reverted slot', i, 'of track', entry.number); rerender();
  }

  // editable autocomplete — type to search MB like the integrated field
  function combo(entry, slot) {
    const wrap = document.createElement('span'); wrap.className = 'tc-combo';
    const tic = document.createElement('span'); tic.className = 'tic'; tic.textContent = slot.entity ? typeIcon(slot.entity) : (slot.status === 'set' ? '🎤' : '·'); wrap.appendChild(tic);
    const inp = document.createElement('input'); inp.className = 'tc-acinput' + (slot.gid ? '' : ' empty'); inp.value = slot.name || slot.creditedAs || ''; inp.title = inp.value; inp.placeholder = 'search artist…'; wrap.appendChild(inp);
    let pop = null, list = [], hi = -1, seq = 0;
    const close = () => { if (pop) { pop.remove(); pop = null; hi = -1; } };
    const choose = c => { close(); pickArtist(slot, c); };
    const draw = arr => {
      close(); list = arr; pop = document.createElement('div'); pop.className = 'tc-acpop';
      pop.innerHTML = arr.length ? arr.map((c, i) => `<div class="tc-acrow" data-i="${i}"><span class="tic">${typeIcon(c)}</span><span class="nm">${esc(c.name)}</span>${c.comment ? `<span class="cmt">${esc(c.comment)}</span>` : ''}</div>`).join('')
        : `<div class="tc-acrow none">no matches — type to search, or + to create</div>`;
      document.body.appendChild(pop); const r = inp.getBoundingClientRect(); pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 2) + 'px'; pop.style.minWidth = Math.max(200, r.width) + 'px';
      [...pop.querySelectorAll('.tc-acrow[data-i]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); choose(arr[+row.dataset.i]); }; });
    };
    inp.onfocus = () => { inp.select(); draw(slot.candidates && slot.candidates.length ? slot.candidates : []); };
    let tmr; inp.oninput = () => { clearTimeout(tmr); const q = inp.value; const my = ++seq; tmr = setTimeout(async () => { const res = await searchArtist(q); if (my === seq) draw(res); }, 250); };
    inp.onkeydown = e => {
      if (e.key === 'Escape') { close(); inp.blur(); }
      else if (e.key === 'ArrowDown' && pop) { hi = Math.min(list.length - 1, hi + 1); [...pop.children].forEach((r, i) => r.classList.toggle('hi', i === hi)); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && pop) { hi = Math.max(0, hi - 1); [...pop.children].forEach((r, i) => r.classList.toggle('hi', i === hi)); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); const c = list[hi >= 0 ? hi : 0]; if (c) choose(c); }
    };
    inp.onblur = () => setTimeout(close, 160);
    return wrap;
  }

  function slotEl(entry, s, idx) {
    const slot = document.createElement('div'); slot.className = 'tc-aslot';
    if (entry.slots.length > 1) slot.insertAdjacentHTML('beforeend', `<span class="join">${esc((s.joinPhrase || '').trim() || '·')}</span>`);
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!s.accept; cb.title = 'apply this slot'; cb.style.flex = 'none';
    cb.onchange = () => { s.accept = cb.checked; }; slot.appendChild(cb);
    if (s.creditedAs && !sameName(s.creditedAs, s.name)) slot.insertAdjacentHTML('beforeend', `<span class="cred" title="credited as “${esc(s.creditedAs)}”">${esc(s.creditedAs)}</span>`);
    slot.appendChild(combo(entry, s));
    if (s.gid) slot.insertAdjacentHTML('beforeend', `<a class="tc-icon" href="${ORIGIN}/artist/${s.gid}" target="_blank" rel="noopener" title="open artist page">↗</a>`);
    const create = document.createElement('button'); create.className = 'tc-btn mini'; create.textContent = '+'; create.title = 'create “' + s.creditedAs + '” on MusicBrainz';
    create.onclick = () => createArtist(s.creditedAs); slot.appendChild(create);
    const rev = document.createElement('button'); rev.className = 'slotrev'; rev.textContent = '↺'; rev.title = 'revert this artist to the original';
    rev.onclick = () => revertSlot(entry, idx); slot.appendChild(rev);
    slot.insertAdjacentHTML('beforeend', badge(s.status));
    return slot;
  }
  function fillRows(tbody) {
    tbody.innerHTML = ''; let confident = 0, unresolved = 0, lastMi = -1; const multi = mediums().length > 1;
    MODEL.tracks.forEach(t => {
      if (multi && t.mi !== lastMi) { const r = document.createElement('tr'); r.innerHTML = `<td class="tc-medhdr" colspan="${COLS.length}">Medium ${t.mi + 1}</td>`; tbody.appendChild(r); lastMi = t.mi; }
      t.slots.forEach(s => { if (s.status !== 'set') { unresolved++; if (s.status === 'rg' || s.status === 'high') confident++; } });
      const tr = document.createElement('tr'); tr.style.background = COLORS[rowConfidence(t)] || '#fff';
      tr.innerHTML = `<td class="c-mv"><span class="mv up" title="move up">▲</span><span class="mv dn" title="move down">▼</span></td>
        <td class="c-num">${t.number}</td>
        <td class="c-title"><input class="t-title" value="${esc(t.title)}"></td>
        <td class="c-art"></td>
        <td class="c-len"><input class="t-len" value="${esc(t.length)}"></td>
        <td class="c-x"><button class="rm" title="remove track">✕</button></td>`;
      const art = tr.querySelector('.c-art'); t.slots.forEach((s, si) => art.appendChild(slotEl(t, s, si)));
      tr.querySelector('.t-title').onchange = e => setTitle(t, e.target.value);
      tr.querySelector('.t-len').onchange = e => setLength(t, e.target.value);
      tr.querySelector('.up').onclick = () => { moveTrack(t, -1); rebuild(); };
      tr.querySelector('.dn').onclick = () => { moveTrack(t, +1); rebuild(); };
      tr.querySelector('.rm').onclick = () => { removeTrack(t); rebuild(); };
      tbody.appendChild(tr);
    });
    updateStatus(`${MODEL.tracks.length} tracks · ${unresolved} to resolve · ${confident} confident`);
  }
  async function rebuild() { MODEL = await buildModel(); rerender(); if (ACTIVE.mode === 'mirror') hideNative(true); }
  function doApply(mode) { if (!MODEL) return; MODEL.tracks.forEach(t => { applyTrack(t, mode); refreshEntry(t); }); rerender(); Log.info('apply', mode); }
  function revertAll() { if (!MODEL) return; if (!W.confirm("Revert every track's artist to what it was when the page loaded?")) return; MODEL.tracks.forEach(resetTrack); rebuild(); }
  function bindActions(host) {
    host.querySelectorAll('[data-act]').forEach(b => {
      const a = b.dataset.act;
      b.onclick = () => { if (a === 'gear') openSettings(b); else if (a === 'close') { host.remove(); ACTIVE = {}; } else if (a === 'conf') doApply('confident'); else if (a === 'apply') doApply('checked'); else if (a === 'revert') revertAll(); };
    });
  }
  const FOOTER = `<button class="tc-btn" data-act="conf">Apply confident</button><button class="tc-btn" data-act="revert">Revert all</button><button class="tc-btn primary" data-act="apply">Apply checked</button>`;

  /* ── floating window (movable) ── */
  function openPanel() {
    style(); const ex = document.getElementById('tc-panel'); if (ex) ex.remove(); const l = document.getElementById('tc-launch'); if (l) l.remove();
    const p = document.createElement('div'); p.id = 'tc-panel';
    p.innerHTML = `<div id="tc-hdr">${ICON}<b>Track Cannon</b><span class="tc-status meta">matching…</span>
        <button class="tc-icon" data-act="gear" title="settings">⚙</button><button class="tc-icon" data-act="close" title="close">✕</button></div>
      <div id="tc-body"></div>
      <div id="tc-foot"><span class="sp"></span>${FOOTER}</div>`;
    document.body.appendChild(p);
    const tbody = mountTable(p.querySelector('#tc-body'));
    ACTIVE = { mode: 'float', tbody, statusEl: p.querySelector('.tc-status') };
    const hdr = p.querySelector('#tc-hdr');
    hdr.onmousedown = e => { if (e.target.closest('button')) return; const r = p.getBoundingClientRect(); const ox = e.clientX - r.left, oy = e.clientY - r.top; p.style.right = 'auto'; const mm = ev => { p.style.left = Math.max(0, ev.clientX - ox) + 'px'; p.style.top = Math.max(0, ev.clientY - oy) + 'px'; }; const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); };
    bindActions(p);
    buildModel((d, n) => updateStatus(`matching ${d}/${n}…`)).then(m => { MODEL = m; fillRows(ACTIVE.tbody); });
  }

  /* ── in-page replacement ── */
  function nativeTrackTables() { return [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track')); }
  function hideNative(hide) { nativeTrackTables().forEach(t => { t.style.display = hide ? 'none' : ''; }); }
  async function showMirror() {
    style(); let wrap = document.getElementById('tc-mirror-wrap');
    if (wrap) { hideNative(true); return; }
    wrap = document.createElement('div'); wrap.id = 'tc-mirror-wrap';
    const tbl = nativeTrackTables()[0];
    if (tbl && tbl.parentElement) tbl.parentElement.insertBefore(wrap, tbl);
    else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(wrap);
    wrap.innerHTML = `<div id="tc-bar">${ICON}<b>Track Cannon</b><span class="tc-status">matching…</span>${FOOTER}</div><div class="tc-mount"></div>`;
    hideNative(true);
    const tbody = mountTable(wrap.querySelector('.tc-mount'));
    ACTIVE = { mode: 'mirror', tbody, statusEl: wrap.querySelector('.tc-status') };
    bindActions(wrap);
    MODEL = await buildModel((d, n) => updateStatus(`matching ${d}/${n}…`));
    fillRows(ACTIVE.tbody); hideNative(true);
  }
  function hideMirror() { const w = document.getElementById('tc-mirror-wrap'); if (w) w.remove(); hideNative(false); if (ACTIVE.mode === 'mirror') ACTIVE = {}; }
  function applyMode() { if (SETTINGS.replace) { const p = document.getElementById('tc-panel'); if (p) { p.remove(); ACTIVE = {}; } showMirror(); } else hideMirror(); }

  /* ── entry points + tab-aware auto-run ── */
  function injectButton() {
    if (document.getElementById('tc-btn')) return true;
    const anchor = [...document.querySelectorAll('button, input[type=button]')].find(b => /guess feat\. artists|guess case|reset track numbers/i.test(b.textContent || b.value || ''));
    if (!anchor || !anchor.parentElement) return false;
    style();
    const btn = document.createElement('button'); btn.id = 'tc-btn'; btn.type = 'button'; btn.innerHTML = ICON + ' Track Cannon'; btn.style.cssText = 'margin-left:8px;font-weight:bold';
    btn.onclick = () => { if (SETTINGS.replace) (document.getElementById('tc-mirror-wrap') ? hideMirror() : showMirror()); else openPanel(); };
    const gear = document.createElement('button'); gear.id = 'tc-gear-btn'; gear.type = 'button'; gear.textContent = '⚙'; gear.title = 'Track Cannon settings'; gear.style.marginLeft = '4px';
    gear.onclick = e => openSettings(e.currentTarget);
    anchor.parentElement.appendChild(btn); anchor.parentElement.appendChild(gear);
    Log.info('button injected next to tracklist tools');
    return true;
  }
  function ensureLauncher() {
    if (document.getElementById('tc-btn') || document.getElementById('tc-launch') || SETTINGS.replace) return;
    style(); const b = document.createElement('button'); b.id = 'tc-launch'; b.innerHTML = ICON + ' Track Cannon';
    b.onclick = () => SETTINGS.replace ? showMirror() : openPanel(); document.body.appendChild(b);
  }
  function tracklistVisible() { const b = [...document.querySelectorAll('button')].find(x => /guess feat\. artists/i.test(x.textContent || '')); return !!(b && b.offsetParent !== null); }
  let _tlPrev = false, _autoFloatDone = false;
  function onEnterTracklist() {
    injectButton();
    if (SETTINGS.replace) showMirror();
    else if (SETTINGS.autoRun && !_autoFloatDone) { _autoFloatDone = true; openPanel(); }
  }
  function watchTracklist() {
    const tick = () => { const vis = tracklistVisible(); if (vis) injectButton(); if (vis && !_tlPrev) { _tlPrev = true; Log.info('entered Tracklist tab'); onEnterTracklist(); } else if (!vis && _tlPrev) _tlPrev = false; };
    tick(); setInterval(tick, 700);
  }

  W.__trackCannon = { readTracklist, buildModel, applyTrack, resetTrack, removeTrack, moveTrack, searchArtist, openPanel, showMirror, hideMirror, revertAll, revertSlot, pickArtist, snapshotOriginals, get model() { return MODEL; }, get settings() { return SETTINGS; } };

  (async function main() {
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready · replace =', SETTINGS.replace, '· autoRun =', SETTINGS.autoRun);
    snapshotOriginals();
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    ensureLauncher();
    watchTracklist();   // auto-run waits until the Tracklist tab is actually shown
  })();
})();
