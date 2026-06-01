// ==UserScript==
// @name         Track Cannon
// @namespace    https://musicbrainz.org/
// @version      2026.6.1.214111
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly.
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
 * Discovered via the spike harness (see test/):
 *   read   MB.releaseEditor.rootField.release().mediums()[m].tracks()[t]
 *          .artistCredit() → { names:[{ artist:{name,gid,id}, name(creditedAs), joinPhrase }] }
 *          artist.gid present ⇒ that slot is resolved.
 *   search GET /ws/js/artist?q=<name>&direct=false → full entities (incl. numeric id, which
 *          MB's React autocomplete needs to render a selection).
 *   sibling GET /ws/2/release?release-group=<rg>&inc=recordings+artist-credits → other versions'
 *          per-track credits with gids; disambiguates search hits by title.
 *   write  track.artistCredit({ names:[{ artist: fullEntity, name: creditedAs, joinPhrase }] })
 *          updates the model AND the React field (turns green).
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
  const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // diacritic-folded compare so "Thành Mái" == "Thanh Mai" (but "Phương" != "Costello")
  const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  const sameName = (a, b) => fold(a) === fold(b);

  /* ── settings (localStorage; @grant none) ── */
  const SKEY = 'trackCannon.settings.v1';
  function loadSettings() { try { return Object.assign({ autoRun: false }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { autoRun: false }; } }
  function saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  let SETTINGS = loadSettings();

  function waitFor(check, { tries = 120, every = 500 } = {}) {
    return new Promise(res => { let n = 0; const t = () => { let v; try { v = check(); } catch (e) {} if (v) return res(v); if (++n >= tries) return res(null); setTimeout(t, every); }; t(); });
  }

  /* ── model access ── */
  function release() { return u(getEditor().rootField.release); }
  function koTrack(mi, ti) { const med = u(release().mediums)[mi]; return u(med.tracks)[ti]; }
  function liveNames(track) { const ac = u(track.artistCredit) || {}; return u(ac.names) || []; }

  // original artist credits captured at load, for the [Original] reset
  const ORIGINALS = new Map();
  function snapshotOriginals() {
    ORIGINALS.clear();
    (u(release().mediums) || []).forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const names = liveNames(t).map(n => ({ artist: u(n.artist) || { name: u(n.name) || '' }, creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '' }));
      ORIGINALS.set(mi + ':' + ti, names);
    }));
    Log.info('snapshot of', ORIGINALS.size, 'original track credits');
  }

  function readTracklist() {
    const out = [];
    (u(release().mediums) || []).forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const names = liveNames(t).map(n => { const a = u(n.artist) || null; return { creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '', artistGid: a ? u(a.gid) : null, artistName: a ? u(a.name) : '' }; });
      out.push({ mi, ti, number: u(t.number), title: u(t.name) || '', names, resolved: names.length > 0 && names.every(n => n.artistGid) });
    }));
    return out;
  }

  /* ── MB internal artist search → full entities (with numeric id) ── */
  const _cache = new Map();
  async function searchArtist(name) {
    const k = fold(name);
    if (!k) return [];
    if (_cache.has(k)) return _cache.get(k);
    let list = [];
    try {
      const r = await fetch(`${ORIGIN}/ws/js/artist?q=${encodeURIComponent(name)}&limit=8&direct=false`, { headers: { Accept: 'application/json' } });
      const j = await r.json();
      list = Array.isArray(j) ? j : (j.results || []);
    } catch (e) { Log.warn('search failed:', name, e.message); }
    _cache.set(k, list);
    return list;
  }

  /* ── sibling-release credits in the same release group: title → [{gid,name,creditedAs,joinPhrase}] ── */
  async function loadSiblingMap() {
    const map = new Map();
    const rg = u(release().releaseGroup);
    const rgGid = rg ? u(rg.gid) : null;
    if (!rgGid) { Log.info('no release group linked → search-only (no sibling matching)'); return map; }
    try {
      const url = `${ORIGIN}/ws/2/release?release-group=${rgGid}&inc=recordings+artist-credits&fmt=json&limit=100`;
      const j = await fetch(url, { headers: { Accept: 'application/json' } }).then(r => r.json());
      (j.releases || []).forEach(rel => (rel.media || []).forEach(med => (med.tracks || []).forEach(t => {
        const title = fold(t.title || (t.recording && t.recording.title));
        const ac = (t['artist-credit'] && t['artist-credit'].length) ? t['artist-credit'] : ((t.recording && t.recording['artist-credit']) || []);
        if (!title || map.has(title) || !ac.length || !ac.every(x => x.artist && x.artist.id)) return;
        map.set(title, ac.map(x => ({ gid: x.artist.id, name: x.artist.name, creditedAs: x.name || x.artist.name, joinPhrase: x.joinphrase || '' })));
      })));
      Log.info('sibling map:', map.size, 'titles from RG', rgGid);
    } catch (e) { Log.warn('sibling load failed:', e.message); }
    return map;
  }

  /* ── match one unresolved slot. Always returns the chosen entity first in candidates,
        so the dropdown shows exactly what will be applied. ── */
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
    const merged = [entity, ...candidates.filter(c => c.gid !== entity.gid)];
    return { entity, source, confidence, candidates: merged };
  }

  /* ── build the full panel model: every track, resolved and not ── */
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
        if (n.artistGid) {
          slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'set', entity: null, gid: n.artistGid, name: n.artistName, candidates: [], accept: false });
        } else {
          const m = await matchSlot(n.creditedAs, sib && sib[i]);
          const status = m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none';
          slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status, entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, accept: status === 'rg' || status === 'high' });
        }
      }
      tracks.push({ mi: t.mi, ti: t.ti, number: t.number, title: t.title, slots });
      if (t.names.some(n => !n.artistGid)) { done++; if (onProgress) onProgress(done, todo.length); }
    }
    return { tracks };
  }

  /* ── apply / reset ── */
  function applyTrack(entry, which) {            // which: 'confident' | 'checked'
    const track = koTrack(entry.mi, entry.ti);
    const live = liveNames(track);
    let changed = false;
    const names = entry.slots.map((s, i) => {
      if (s.status === 'set') return live[i];
      const take = which === 'confident' ? (s.status === 'rg' || s.status === 'high' || s.status === 'user') && s.accept : s.accept;
      if (take && s.entity) { changed = true; return { artist: s.entity, name: s.creditedAs, joinPhrase: s.joinPhrase }; }
      return live[i];
    });
    if (changed) { track.artistCredit({ names }); entry.slots.forEach(s => { if (s.status !== 'set' && s.accept && s.entity) s.applied = true; }); }
    return changed;
  }
  function resetTrack(entry) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti);
    if (!orig) return;
    koTrack(entry.mi, entry.ti).artistCredit({ names: orig.map(o => ({ artist: o.artist, name: o.creditedAs, joinPhrase: o.joinPhrase })) });
    // reflect in the panel: mark slots back to their search match (un-applied)
    entry.slots.forEach((s, i) => { s.applied = false; if (s.status === 'set' && orig[i] && !(u(orig[i].artist) || {}).gid) { /* was originally text */ } });
    Log.info('reset track', entry.number, 'to original');
  }

  /* ── create artist via MB's native prefilled form (new tab) ── */
  function guessSortName(name) {
    const n = (name || '').trim();
    if (!/^[\x00-\x7F]+$/.test(n)) return n;           // non-ASCII (e.g. Vietnamese) → sort = name
    const p = n.split(/\s+/); if (p.length < 2) return n;
    const last = p.pop(); return last + ', ' + p.join(' ');
  }
  function createArtist(name) {
    const url = `${ORIGIN}/artist/create?edit-artist.name=${encodeURIComponent(name)}&edit-artist.sort_name=${encodeURIComponent(guessSortName(name))}`;
    Log.info('open MB create-artist for', JSON.stringify(name));
    W.open(url, '_blank', 'noopener');
  }

  /* ── UI ── */
  const COLORS = { set: '#d6f0d8', rg: '#d6f0d8', high: '#d8e6ff', low: '#fdf3d0', user: '#e9dcfb', none: '#fbdcdf' };
  const css = `
    #tc-panel{position:fixed;top:90px;right:18px;width:600px;max-width:96vw;max-height:84vh;background:#fff;
      border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 30px rgba(40,20,80,.28);z-index:99999;
      display:flex;flex-direction:column;font:13px/1.4 Arial,Helvetica,sans-serif;color:#1c1c1c}
    #tc-panel a{color:#4800a0;text-decoration:none}
    #tc-panel a:hover{text-decoration:underline}
    #tc-hdr{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#ede9f6;border-bottom:1px solid #d7ccef;border-radius:6px 6px 0 0}
    #tc-hdr b{flex:1;color:#563b8f;font-size:14px}
    #tc-hdr .meta{font-size:12px;color:#6b6b6b}
    #tc-body{flex:1;overflow:auto;padding:0}
    #tc-foot{display:flex;align-items:center;gap:8px;padding:8px 11px;border-top:1px solid #d7ccef;background:#f6f4fb;border-radius:0 0 6px 6px}
    #tc-foot .sp{flex:1;font-size:12px;color:#555}
    .tc-btn{padding:4px 11px;border:1px solid #bbb;border-radius:3px;background:linear-gradient(#fff,#eee);cursor:pointer;font:13px Arial;color:#333}
    .tc-btn:hover{background:linear-gradient(#fff,#e4e4e4)}
    .tc-btn.primary{background:#5f3ec0;color:#fff;border-color:#4f33a3}
    .tc-btn.primary:hover{background:#553597}
    .tc-btn.mini{padding:1px 6px;font-size:11px;border-radius:3px}
    .tc-icon{cursor:pointer;border:none;background:none;font-size:13px;padding:0 2px;color:#666}
    .tc-row{border-bottom:1px solid #eaeaea;padding:5px 10px}
    .tc-rowhead{display:flex;align-items:center;gap:7px}
    .tc-rowhead .num{color:#999;font-variant-numeric:tabular-nums;min-width:20px;text-align:right}
    .tc-rowhead .ttl{flex:1;font-weight:bold;color:#222}
    .tc-slot{display:flex;align-items:center;gap:6px;margin:4px 0 0 27px}
    .tc-slot .cred{min-width:115px;max-width:115px;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tc-slot select{flex:1;min-width:0;font:12px Arial;padding:2px;border:1px solid #bbb;border-radius:3px;background:#fff}
    .tc-slot .setname{flex:1}
    .tc-badge{font-size:10px;font-weight:bold;border-radius:9px;padding:1px 7px;letter-spacing:.3px}
    .tc-badge.rg{background:#1f8a4c;color:#fff}
    .tc-badge.set{background:#6c757d;color:#fff}
    .tc-badge.high{background:#2f6fd6;color:#fff}
    .tc-badge.low{background:#e0a800;color:#fff}
    .tc-badge.user{background:#6f42c1;color:#fff}
    .tc-badge.none{background:#c0392b;color:#fff}
    #tc-set{display:flex;flex-direction:column;gap:7px;padding:9px 12px;background:#faf9fe;border-bottom:1px solid #e6dff5}
    #tc-set label{display:flex;gap:7px;align-items:flex-start;font-size:12px;color:#444}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;background:#5f3ec0;color:#fff;border:none;border-radius:20px;padding:8px 14px;font:bold 13px Arial;cursor:pointer;box-shadow:0 3px 12px rgba(40,20,80,.3)}
  `;
  function style() { if (document.getElementById('tc-css')) return; const s = document.createElement('style'); s.id = 'tc-css'; s.textContent = css; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const artistLink = (gid, label) => gid ? `<a href="${ORIGIN}/artist/${gid}" target="_blank" rel="noopener" title="open artist page">${esc(label)} ↗</a>` : esc(label);

  let MODEL = null;
  function rowConfidence(t) {
    const live = t.slots.filter(s => s.status !== 'set');
    if (!live.length) return 'set';
    const order = ['none', 'low', 'user', 'high', 'rg'];
    return live.map(s => s.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  }

  async function openPanel() {
    style();
    let p = document.getElementById('tc-panel'); if (p) p.remove();
    const lp = document.getElementById('tc-launch'); if (lp) lp.remove();
    p = document.createElement('div'); p.id = 'tc-panel';
    p.innerHTML = `<div id="tc-hdr"><b>🎯 Track Cannon</b><span class="meta" id="tc-status">matching…</span>
        <button class="tc-icon" id="tc-gear" title="settings">⚙</button><button class="tc-icon" id="tc-close" title="close">✕</button></div>
      <div id="tc-set" style="display:none"><label><input type="checkbox" id="tc-auto"> <span>Run automatically when a release add/edit page opens (matches on load and opens this panel; nothing is applied until you click).</span></label></div>
      <div id="tc-body"></div>
      <div id="tc-foot"><span class="sp" id="tc-sum"></span>
        <button class="tc-btn" id="tc-apply-conf">Apply confident</button>
        <button class="tc-btn primary" id="tc-apply">Apply checked</button></div>`;
    document.body.appendChild(p);
    p.querySelector('#tc-close').onclick = () => p.remove();
    const setbox = p.querySelector('#tc-set'), auto = p.querySelector('#tc-auto');
    auto.checked = !!SETTINGS.autoRun;
    p.querySelector('#tc-gear').onclick = () => { setbox.style.display = setbox.style.display === 'none' ? 'block' : 'none'; };
    auto.onchange = () => { SETTINGS.autoRun = auto.checked; saveSettings(SETTINGS); Log.info('autoRun =', SETTINGS.autoRun); };

    MODEL = await buildModel((d, n) => { p.querySelector('#tc-status').textContent = `matching ${d}/${n}…`; });
    renderRows();
    p.querySelector('#tc-apply-conf').onclick = () => doApply('confident');
    p.querySelector('#tc-apply').onclick = () => doApply('checked');
  }

  function renderRows() {
    const body = document.getElementById('tc-body'); if (!body) return;
    body.innerHTML = '';
    let confident = 0, unresolved = 0;
    MODEL.tracks.forEach((t, ti) => {
      t.slots.forEach(s => { if (s.status !== 'set') { unresolved++; if (s.status === 'rg' || s.status === 'high') confident++; } });
      const row = document.createElement('div'); row.className = 'tc-row';
      row.style.background = COLORS[rowConfidence(t)] || '#fff';
      const head = document.createElement('div'); head.className = 'tc-rowhead';
      head.innerHTML = `<span class="num">${t.number}</span><span class="ttl">${esc(t.title)}</span>`;
      const orig = document.createElement('button'); orig.className = 'tc-btn mini'; orig.textContent = 'Original';
      orig.title = 'restore this track’s artist to what it was when the page loaded';
      orig.onclick = () => { resetTrack(t); markOriginal(t); renderRows(); };
      head.appendChild(orig); row.appendChild(head);

      t.slots.forEach((s, si) => {
        const slot = document.createElement('div'); slot.className = 'tc-slot';
        if (s.status === 'set') {
          slot.innerHTML = `<span class="cred" title="${esc(s.creditedAs)}">${esc(s.creditedAs)}</span>` +
            `<span class="setname">${artistLink(s.gid, s.name || s.creditedAs)}</span><span class="tc-badge set">SET</span>`;
          row.appendChild(slot); return;
        }
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!s.accept;
        cb.onchange = () => { s.accept = cb.checked; };
        slot.appendChild(cb);
        slot.insertAdjacentHTML('beforeend', `<span class="cred" title="${esc(s.creditedAs)}">${esc(s.creditedAs)}</span>`);
        if (s.candidates && s.candidates.length) {
          const sel = document.createElement('select');
          sel.innerHTML = s.candidates.map((c, ci) => `<option value="${ci}"${c.gid === s.gid ? ' selected' : ''}>${esc(c.name)}${c.comment ? ' (' + esc(c.comment) + ')' : ''}${c.typeName ? ' · ' + c.typeName : ''}</option>`).join('');
          sel.onchange = () => { s.entity = s.candidates[+sel.value]; s.gid = s.entity.gid; s.name = s.entity.name; s.status = 'user'; s.accept = true; renderRows(); };
          slot.appendChild(sel);
          slot.insertAdjacentHTML('beforeend', `<a class="tc-icon" href="${ORIGIN}/artist/${s.gid}" target="_blank" rel="noopener" title="open artist page">↗</a>`);
        } else {
          slot.insertAdjacentHTML('beforeend', `<em style="flex:1;color:#a33">no match</em>`);
        }
        const create = document.createElement('button'); create.className = 'tc-btn mini'; create.textContent = '+ Create';
        create.title = 'open MusicBrainz’s add-artist form, prefilled';
        create.onclick = () => createArtist(s.creditedAs);
        slot.appendChild(create);
        slot.insertAdjacentHTML('beforeend', `<span class="tc-badge ${s.status}">${s.status === 'rg' ? 'RG' : s.status.toUpperCase()}</span>`);
        row.appendChild(slot);
      });
      body.appendChild(row);
    });
    const st = document.getElementById('tc-status'); if (st) st.textContent = `${unresolved} to resolve`;
    const sum = document.getElementById('tc-sum'); if (sum) sum.textContent = `${MODEL.tracks.length} tracks · ${confident} confident`;
  }

  // after an Original reset, flip that track's slots back to "set" if they became resolved text again
  function markOriginal(t) {
    const live = liveNames(koTrack(t.mi, t.ti));
    t.slots.forEach((s, i) => { const a = live[i] && u(live[i].artist); const gid = a ? u(a.gid) : null; if (gid) { s.status = 'set'; s.gid = gid; s.name = u(a.name); } });
  }

  function doApply(mode) {
    let tracks = 0, slots = 0;
    MODEL.tracks.forEach(t => {
      if (mode === 'confident') t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high') s.accept = true; });
      if (applyTrack(t, mode)) { tracks++; slots += t.slots.filter(s => s.status !== 'set' && s.accept && s.entity).length; }
    });
    Log.info(`applied ${slots} artist(s) across ${tracks} track(s) [${mode}]`);
    const st = document.getElementById('tc-status'); if (st) st.textContent = `applied ${slots} artist(s)`;
  }

  /* ── entry points ── */
  function injectButton() {
    if (document.getElementById('tc-btn')) return true;
    const anchor = [...document.querySelectorAll('button, input[type=button]')].find(b => /guess feat\. artists|guess case|reset track numbers/i.test(b.textContent || b.value || ''));
    if (!anchor || !anchor.parentElement) return false;
    const btn = document.createElement('button'); btn.id = 'tc-btn'; btn.type = 'button'; btn.textContent = '🎯 Track Cannon';
    btn.style.cssText = 'margin-left:8px;font-weight:bold'; btn.onclick = openPanel;
    anchor.parentElement.appendChild(btn);
    Log.info('button injected next to tracklist tools');
    return true;
  }
  function ensureLauncher() {            // always-available fallback so it works off the Tracklist tab
    if (document.getElementById('tc-btn') || document.getElementById('tc-launch')) return;
    style();
    const b = document.createElement('button'); b.id = 'tc-launch'; b.textContent = '🎯 Track Cannon'; b.onclick = openPanel;
    document.body.appendChild(b);
  }

  W.__trackCannon = { readTracklist, buildModel, applyTrack, resetTrack, searchArtist, openPanel, snapshotOriginals, get model() { return MODEL; } };

  (async function main() {
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready');
    snapshotOriginals();
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    // keep trying to place the toolbar button as the user switches tabs; always offer the launcher
    injectButton(); ensureLauncher();
    const mo = new MutationObserver(() => { if (injectButton()) { const l = document.getElementById('tc-launch'); if (l) l.remove(); } });
    mo.observe(document.body, { childList: true, subtree: true });
    if (SETTINGS.autoRun) { Log.info('autoRun enabled → matching on load'); openPanel(); }
  })();
})();
