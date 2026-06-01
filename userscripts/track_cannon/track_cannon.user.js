// ==UserScript==
// @name         Track Cannon
// @namespace    https://musicbrainz.org/
// @version      2026.6.1.203951
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware.
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
 * How it works (discovered via the spike harness, see test/):
 *   - read:  MB.releaseEditor.rootField.release().mediums()[m].tracks()[t]
 *            .artistCredit() → { names: [{ artist:{name,gid,id}, name(creditedAs), joinPhrase }] }
 *            artist.gid present ⇒ that slot is resolved.
 *   - search: GET /ws/js/artist?q=<name>&direct=false  → full entities (incl. numeric id,
 *            which MB's React autocomplete needs to render a selection).
 *   - siblings: GET /ws/2/release?release-group=<rg>&inc=recordings+artist-credits  → other
 *            versions' per-track credits with gids; used to DISAMBIGUATE search hits by title.
 *   - write:  track.artistCredit({ names:[{ artist: fullEntity, name: creditedAs, joinPhrase }] })
 *            updates both the model and the React field (turns green).
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
  const sameName = (a, b) => norm(a) === norm(b);

  function waitFor(check, { tries = 120, every = 500 } = {}) {
    return new Promise(res => { let n = 0; const t = () => { let v; try { v = check(); } catch (e) {} if (v) return res(v); if (++n >= tries) return res(null); setTimeout(t, every); }; t(); });
  }

  /* ── read the live tracklist (keeps medium/track indices to write back) ── */
  function release() { return u(getEditor().rootField.release); }
  function koTrack(mi, ti) { const med = u(release().mediums)[mi]; return u(med.tracks)[ti]; }
  function liveNames(track) { const ac = u(track.artistCredit) || {}; return u(ac.names) || []; }

  function readTracklist() {
    const out = [];
    const rel = release();
    (u(rel.mediums) || []).forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const names = liveNames(t).map(n => {
        const a = u(n.artist) || null;
        return { creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '', artistGid: a ? u(a.gid) : null, artistName: a ? u(a.name) : '' };
      });
      out.push({ mi, ti, number: u(t.number), title: u(t.name) || '', names, resolved: names.length > 0 && names.every(n => n.artistGid) });
    }));
    return out;
  }

  /* ── MB internal artist search → full entities (with numeric id) ── */
  const _searchCache = new Map();
  async function searchArtist(name) {
    const key = norm(name);
    if (!key) return [];
    if (_searchCache.has(key)) return _searchCache.get(key);
    let list = [];
    try {
      const r = await fetch(`${ORIGIN}/ws/js/artist?q=${encodeURIComponent(name)}&limit=8&direct=false`, { headers: { Accept: 'application/json' } });
      const j = await r.json();
      list = Array.isArray(j) ? j : (j.results || []);
    } catch (e) { Log.warn('search failed:', name, e.message); }
    _searchCache.set(key, list);
    return list;
  }

  /* ── sibling-release credits in the same release group: title → [{gid,name,creditedAs,joinPhrase}] ── */
  async function loadSiblingMap() {
    const map = new Map();
    const rg = u(release().releaseGroup);
    const rgGid = rg ? u(rg.gid) : null;
    if (!rgGid) { Log.info('no release group yet → no sibling matching'); return map; }
    try {
      const url = `${ORIGIN}/ws/2/release?release-group=${rgGid}&inc=recordings+artist-credits&fmt=json&limit=100`;
      const j = await fetch(url, { headers: { Accept: 'application/json' } }).then(r => r.json());
      (j.releases || []).forEach(rel => (rel.media || []).forEach(med => (med.tracks || []).forEach(t => {
        const title = norm(t.title || (t.recording && t.recording.title));
        const ac = (t['artist-credit'] && t['artist-credit'].length) ? t['artist-credit'] : ((t.recording && t.recording['artist-credit']) || []);
        if (!title || map.has(title) || !ac.length || !ac.every(x => x.artist && x.artist.id)) return;
        map.set(title, ac.map(x => ({ gid: x.artist.id, name: x.artist.name, creditedAs: x.name || x.artist.name, joinPhrase: x.joinphrase || '' })));
      })));
      Log.info('sibling map:', map.size, 'titles from RG', rgGid);
    } catch (e) { Log.warn('sibling load failed:', e.message); }
    return map;
  }

  /* ── match one unresolved slot → { entity, source, confidence } ── */
  async function matchSlot(creditedAs, siblingTarget) {
    let candidates = await searchArtist(creditedAs);
    // sibling gave us a target gid for this slot — prefer that exact artist
    if (siblingTarget && siblingTarget.gid) {
      let hit = candidates.find(c => c.gid === siblingTarget.gid);
      if (!hit && !sameName(siblingTarget.name, creditedAs)) {
        // credited name differs from the artist's name — search by the artist name to fetch its full entity
        hit = (await searchArtist(siblingTarget.name)).find(c => c.gid === siblingTarget.gid);
      }
      if (hit) return { entity: hit, source: 'rg', confidence: 'high', candidates };
    }
    const top = candidates[0] || null;
    if (!top) return { entity: null, source: 'none', confidence: 'none', candidates };
    const conf = sameName(top.name, creditedAs) ? 'high' : 'low';
    return { entity: top, source: 'search', confidence: conf, candidates };
  }

  async function matchAll(onProgress) {
    const tl = readTracklist();
    const siblings = await loadSiblingMap();
    let done = 0;
    const todo = tl.filter(t => !t.resolved);
    for (const t of todo) {
      const sib = siblings.get(norm(t.title)) || null;
      t.slots = [];
      for (let i = 0; i < t.names.length; i++) {
        const slot = t.names[i];
        if (slot.artistGid) { t.slots.push({ ...slot, alreadyResolved: true }); continue; }
        const m = await matchSlot(slot.creditedAs, sib && sib[i]);
        t.slots.push({ ...slot, match: m, accept: m.confidence === 'high' });
      }
      done++; if (onProgress) onProgress(done, todo.length);
    }
    return { all: tl, todo };
  }

  /* ── write resolved artists back into the editor ── */
  function applyTrack(t) {
    const track = koTrack(t.mi, t.ti);
    const live = liveNames(track);
    const names = t.slots.map((s, i) => {
      if (s.alreadyResolved) return live[i];
      if (s.accept && s.match && s.match.entity) return { artist: s.match.entity, name: s.creditedAs, joinPhrase: s.joinPhrase };
      return live[i];   // not accepted / no match → leave as typed text
    });
    track.artistCredit({ names });
  }

  /* ── UI ── */
  const css = `
    #tc-panel{position:fixed;top:6vh;right:3vw;width:560px;max-width:94vw;max-height:88vh;background:#fff;
      border:1px solid #c9b8ec;border-radius:10px;box-shadow:0 12px 44px rgba(0,0,0,.3);z-index:99999;
      display:flex;flex-direction:column;font:13px system-ui,sans-serif;color:#222}
    #tc-hdr{display:flex;align-items:center;gap:8px;padding:10px 13px;background:#f3eefc;border-bottom:1px solid #e6dcf7;border-radius:10px 10px 0 0}
    #tc-hdr b{flex:1;color:#4b2e83;font-size:14px}
    #tc-body{flex:1;overflow:auto;padding:6px 10px}
    #tc-foot{display:flex;align-items:center;gap:8px;padding:9px 13px;border-top:1px solid #e6dcf7;background:#fafafa;border-radius:0 0 10px 10px}
    #tc-foot .sp{flex:1;font-size:12px;color:#666}
    .tc-btn{padding:5px 11px;border:1px solid #c9b8ec;border-radius:6px;background:#fff;cursor:pointer;font-weight:600;color:#4b2e83}
    .tc-btn:hover{background:#f3eefc}
    .tc-btn.primary{background:#6f42c1;color:#fff;border-color:#6f42c1}
    .tc-btn.primary:hover{background:#5a32a3}
    .tc-row{padding:6px 4px;border-bottom:1px solid #f0f0f3}
    .tc-row .ttl{font-weight:600}
    .tc-row .num{color:#aaa;margin-right:6px;font-variant-numeric:tabular-nums}
    .tc-slot{display:flex;align-items:center;gap:7px;margin:3px 0 0 18px}
    .tc-slot .cred{min-width:120px;color:#555}
    .tc-slot select{flex:1;min-width:0;font-size:12px;padding:2px}
    .tc-badge{font-size:10px;font-weight:700;border-radius:8px;padding:1px 6px}
    .tc-badge.rg{background:#d1e7dd;color:#0f5132}
    .tc-badge.high{background:#cfe2ff;color:#084298}
    .tc-badge.low{background:#fff3cd;color:#7a5b00}
    .tc-badge.none{background:#f8d7da;color:#842029}
    .tc-slot.done{opacity:.6}
  `;
  function style() { if (document.getElementById('tc-css')) return; const s = document.createElement('style'); s.id = 'tc-css'; s.textContent = css; document.head.appendChild(s); }

  let MODEL = null;
  async function openPanel() {
    style();
    let p = document.getElementById('tc-panel');
    if (p) p.remove();
    p = document.createElement('div'); p.id = 'tc-panel';
    p.innerHTML = `<div id="tc-hdr"><b>🎯 Track Cannon</b><span id="tc-status" style="font-size:12px;color:#666">matching…</span><button class="tc-btn" id="tc-close">✕</button></div>
      <div id="tc-body"></div>
      <div id="tc-foot"><span class="sp" id="tc-sum"></span><button class="tc-btn" id="tc-apply-conf">Apply confident</button><button class="tc-btn primary" id="tc-apply">Apply checked</button></div>`;
    document.body.appendChild(p);
    p.querySelector('#tc-close').onclick = () => p.remove();

    const res = await matchAll((d, n) => { p.querySelector('#tc-status').textContent = 'matching ' + d + '/' + n + '…'; });
    MODEL = res;
    renderRows();
    p.querySelector('#tc-status').textContent = res.todo.length + ' to resolve';
    p.querySelector('#tc-apply-conf').onclick = () => doApply('confident');
    p.querySelector('#tc-apply').onclick = () => doApply('checked');
  }

  function renderRows() {
    const body = document.getElementById('tc-body');
    const high = MODEL.todo.reduce((n, t) => n + t.slots.filter(s => !s.alreadyResolved && s.match && s.match.confidence === 'high').length, 0);
    document.getElementById('tc-sum').textContent = `${MODEL.todo.length} tracks · ${high} confident`;
    body.innerHTML = '';
    MODEL.todo.forEach(t => {
      const row = document.createElement('div'); row.className = 'tc-row';
      row.innerHTML = `<div><span class="num">${t.number}</span><span class="ttl">${esc(t.title)}</span></div>`;
      t.slots.forEach((s, i) => {
        if (s.alreadyResolved) { row.insertAdjacentHTML('beforeend', `<div class="tc-slot done"><span class="cred">${esc(s.creditedAs)}</span>✓ already linked</div>`); return; }
        const m = s.match || {};
        const slot = document.createElement('div'); slot.className = 'tc-slot';
        const opts = (m.candidates || []).map((c, ci) =>
          `<option value="${ci}"${(m.entity && c.gid === m.entity.gid) ? ' selected' : ''}>${esc(c.name)}${c.comment ? ' (' + esc(c.comment) + ')' : ''}${c.typeName ? ' · ' + c.typeName : ''}</option>`).join('');
        slot.innerHTML = `<input type="checkbox" ${s.accept ? 'checked' : ''}>` +
          `<span class="cred">${esc(s.creditedAs)}</span>` +
          (m.candidates && m.candidates.length ? `<select>${opts}</select>` : `<em style="flex:1;color:#a33">no match — search/create on MB</em>`) +
          `<span class="tc-badge ${m.source === 'rg' ? 'rg' : m.confidence}">${m.source === 'rg' ? 'RG' : (m.confidence || 'none').toUpperCase()}</span>`;
        const cb = slot.querySelector('input'); const sel = slot.querySelector('select');
        cb.onchange = () => { s.accept = cb.checked; };
        if (sel) sel.onchange = () => { s.match.entity = s.match.candidates[+sel.value]; };
        row.appendChild(slot);
      });
      body.appendChild(row);
    });
  }

  function doApply(mode) {
    let applied = 0, tracks = 0;
    MODEL.todo.forEach(t => {
      const willSet = t.slots.some(s => !s.alreadyResolved && (mode === 'confident' ? (s.match && s.match.confidence === 'high') : s.accept) && s.match && s.match.entity);
      if (!willSet) return;
      // for 'confident' mode, force-accept high-confidence slots
      if (mode === 'confident') t.slots.forEach(s => { if (!s.alreadyResolved && s.match && s.match.confidence === 'high') s.accept = true; });
      applyTrack(t);
      tracks++;
      applied += t.slots.filter(s => !s.alreadyResolved && s.accept && s.match && s.match.entity).length;
    });
    Log.info('applied', applied, 'artist(s) across', tracks, 'track(s) [' + mode + ']');
    document.getElementById('tc-status').textContent = `applied ${applied} artist(s)`;
    // re-read so re-opening reflects the now-resolved state
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ── button ── */
  function injectButton() {
    if (document.getElementById('tc-btn')) return;
    const anchor = [...document.querySelectorAll('button, input[type=button]')].find(b => /track parser|guess case|reset track numbers/i.test(b.textContent || b.value || ''));
    const btn = document.createElement('button'); btn.id = 'tc-btn'; btn.type = 'button'; btn.textContent = '🎯 Track Cannon';
    btn.style.cssText = 'margin-left:8px;font-weight:600';
    btn.onclick = openPanel;
    if (anchor && anchor.parentElement) anchor.parentElement.appendChild(btn);
    else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(btn);
    Log.info('button injected', anchor ? '(next to tools)' : '(fallback)');
  }

  // tiny API for the Playwright harness
  W.__trackCannon = { readTracklist, matchAll, applyTrack, searchArtist, openPanel };

  (async function main() {
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready');
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    injectButton();
  })();
})();
