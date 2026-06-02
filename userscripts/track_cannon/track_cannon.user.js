// ==UserScript==
// @name         Track Cannon
// @namespace    https://musicbrainz.org/
// @version      2026.6.2.192656
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Same table whether floating or replacing the integrated tracklist.
// @author       majkinetor
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/track_cannon/README.md
// @match        https://musicbrainz.org/release/add
// @match        https://musicbrainz.org/release/*/edit
// @match        https://beta.musicbrainz.org/release/add
// @match        https://beta.musicbrainz.org/release/*/edit
// @match        https://musicbrainz.org/artist/*
// @match        https://beta.musicbrainz.org/artist/*
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
  const MBID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  // a MusicBrainz /artist/<mbid> URL, a bare MBID, or an MBID pasted anywhere in the text → the gid
  function mbidFrom(v) {
    v = (v || '').trim();
    const url = v.match(new RegExp('musicbrainz\\.org/artist/(' + MBID_RE.source + ')', 'i')); if (url) return url[1].toLowerCase();
    const m = v.match(new RegExp('(?:^|[\\s/])(' + MBID_RE.source + ')(?:[\\s/?#]|$)', 'i')); return m ? m[1].toLowerCase() : null;
  }

  /* ── create-artist-in-a-tab → auto-insert (BroadcastChannel handshake, like the Discogs importer) ── */
  const ART_CHANNEL = ('BroadcastChannel' in W) ? new W.BroadcastChannel('track-cannon-artist') : null;
  const PENDING_KEY = 'trackCannon.pendingArtist';
  const _pendingCreates = new Map(); let _createSeq = 0;
  if (ART_CHANNEL) ART_CHANNEL.addEventListener('message', e => {
    const d = e.data; if (!d || d.type !== 'tc-artist-created') return;
    const pend = _pendingCreates.get(d.token); if (!pend) return;
    _pendingCreates.delete(d.token);
    if (!d.gid) { Log.warn('artist created but no gid came back'); return; }
    pickArtist(pend.slot, { gid: d.gid, name: d.name, id: d.id });
    Log.info('inserted newly-created artist', JSON.stringify(d.name), 'into the table');
  });

  /* ── settings ── */
  const SKEY = 'trackCannon.settings.v1';
  function loadSettings() { const d = { colWidths: {}, applyMode: 'all', altRows: false, grid: false, autoMatch: true, lastTool: '', layout: 'cozy' }; try { return Object.assign(d, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return d; } }
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
      ORIGINALS.set(mi + ':' + ti, {
        title: u(t.name) || '', number: u(t.number), length: u(t.formattedLength) || '',
        names: liveNames(t).map(n => ({ artist: u(n.artist) || { name: u(n.name) || '' }, creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '' })),
      });
    }));
    Log.info('snapshot of', ORIGINALS.size, 'original tracks');
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
  // resolve an MBID to a full entity (incl. the numeric id needed for the credit write-back)
  async function fetchEntity(gid) {
    try { const j = await fetch(`${ORIGIN}/ws/js/entity/${gid}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      if (j && j.gid) return { gid: j.gid, name: j.name, id: j.id, comment: j.comment, sortName: j.sort_name }; }
    catch (e) { Log.warn('fetch entity failed', gid, e.message); }
    return null;
  }
  async function searchArtist(name) {
    const k = fold(name); if (!k) return [];
    if (_cache.has(k)) return _cache.get(k);
    let list = [];
    try { const j = await fetch(`${ORIGIN}/ws/js/artist?q=${encodeURIComponent(name)}&limit=8&direct=false`, { headers: { Accept: 'application/json' } }).then(r => r.json()); list = Array.isArray(j) ? j : (j.results || []); }
    catch (e) { Log.warn('search failed:', name, e.message); }
    list = list.filter(c => c && (c.name || '').trim());   // drop the trailing empty placeholder entry
    _cache.set(k, list); return list;
  }
  // full alias arrays for display (the js search only carries primaryAlias, often empty). One WS2
  // search per query returns every result's aliases with locale — no per-artist fetch. Cached.
  const _aliasCache = new Map();        // query → { gid: aliases }
  const _gidAliases = new Map();        // gid → aliases — survives table rebuilds (so the bar keeps its alias)
  const cacheAliases = (gid, aks) => { if (gid && aks) _gidAliases.set(gid, aks); };
  async function fetchAliases(name) {
    const k = fold(name); if (!k) return {}; if (_aliasCache.has(k)) return _aliasCache.get(k);
    const map = {};
    try { const w = await fetch(`${ORIGIN}/ws/2/artist?query=${encodeURIComponent(name)}&limit=12&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.json()); (w.artists || []).forEach(a => { map[a.id] = a.aliases || []; cacheAliases(a.id, a.aliases || []); }); }
    catch (e) { Log.warn('alias fetch failed', name, e.message); }
    _aliasCache.set(k, map); return map;
  }
  // aliases for already-resolved artists (existing releases / auto-matched) WITHOUT a fetch each —
  // one batched WS2 query per ~90 gids (arid:g1 OR arid:g2 …), cached by gid
  async function fetchAliasesByGids(gids) {
    const uniq = [...new Set((gids || []).filter(g => g && !_gidAliases.has(g)))];
    for (let i = 0; i < uniq.length; i += 90) {
      const q = uniq.slice(i, i + 90).map(g => 'arid:' + g).join(' OR ');
      try { const w = await fetch(`${ORIGIN}/ws/2/artist?query=${encodeURIComponent(q)}&limit=100&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.json()); (w.artists || []).forEach(a => cacheAliases(a.id, a.aliases || [])); }
      catch (e) { Log.warn('batch alias fetch failed', e.message); }
    }
  }
  const isEditingNow = () => { const a = document.activeElement; return a && /^(INPUT|SELECT)$/.test(a.tagName) && (a.closest('.tc-medsec') || a.closest('#tc-panel')); };
  // batch-fetch aliases for every committed artist we don't have yet, then refresh the bars
  async function enrichResolvedAliases() {
    if (!MODEL) return;
    const need = []; MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s.committed && s.gid && !_gidAliases.has(s.gid)) need.push(s.gid); }));
    if (!need.length) return;
    await fetchAliasesByGids(need);
    if (!isEditingNow()) rerender();
  }
  // the alias(es) to show next to a result: the English-locale one(s) if present, otherwise the first
  // alias — joined with ", " and capped so it never gets too long
  function aliasStr(c) {
    const name = c.name || '', aks = c.aliases || [], diff = s => s && fold(s) !== fold(name);
    const en = aks.filter(a => /^en/i.test(a.locale || '') && diff(a.name)).sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0)).map(a => a.name);
    let out = en;
    if (!out.length) { const first = aks.find(a => diff(a.name)); out = first ? [first.name] : (diff(c.primaryAlias) ? [c.primaryAlias] : []); }
    const seen = new Set(); out = out.filter(s => { const f = fold(s); if (!f || seen.has(f)) return false; seen.add(f); return true; });
    if (!out.length) return null;
    let s = out.join(', '); const MAX = 48;
    if (s.length > MAX) { const cut = s.lastIndexOf(', ', MAX); s = (cut > 12 ? s.slice(0, cut) : s.slice(0, MAX - 1)) + '…'; }
    return s;
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
        if (n.artistGid) { slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'set', entity: null, gid: n.artistGid, name: n.artistName, candidates: [], committed: true }); }
        else {
          const m = await matchSlot(n.creditedAs, sib && sib[i]);
          const status = m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none';
          slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status, entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, committed: false });
        }
      }
      const te = { mi: t.mi, ti: t.ti, number: t.number, title: t.title, length: t.length, slots };
      te.slots.forEach(s => { s._entry = te; });
      te.guessTitle = guessTitleStr(te);
      tracks.push(te);
      if (t.names.some(n => !n.artistGid)) { done++; if (onProgress) onProgress(done, todo.length); }
    }
    return { tracks };
  }

  /* ── live commit / reset / structural ops (no apply phase — every change writes through) ── */
  // write a whole track's artist credit from its slots: committed slots use the picked entity,
  // uncommitted ones stay as unresolved credited text.
  function commitTrack(entry) {
    const track = koTrack(entry.mi, entry.ti), live = liveNames(track);
    track.artistCredit({
      names: entry.slots.map((s, i) => {
        if (s.status === 'set') { const a = (live[i] && u(live[i].artist)) || s.entity || { name: s.name || s.creditedAs }; return { artist: a, name: s.creditedAs, joinPhrase: s.joinPhrase }; }
        if (s.committed && s.entity) return { artist: s.entity, name: s.creditedAs, joinPhrase: s.joinPhrase };
        return { artist: { name: s.creditedAs }, name: s.creditedAs, joinPhrase: s.joinPhrase };
      })
    });
  }
  // on load, immediately write the confident matches (RG/HIGH) — that's the "no apply phase" behaviour
  function autoCommit() { MODEL.tracks.forEach(t => { let any = false; t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high') { s.committed = true; any = true; } }); if (any || t.slots.some(s => s.status === 'set')) commitTrack(t); }); }
  function autoCommitTrack(t) { let any = false; t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high') { s.committed = true; any = true; } }); if (any) commitTrack(t); }
  // build the table model WITHOUT matching (instant) — unresolved slots are flagged _pending
  function buildShell() {
    const tracks = readTracklist().map(t => {
      const slots = t.names.map(n => n.artistGid
        ? { creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'set', entity: null, gid: n.artistGid, name: n.artistName, candidates: [], committed: true }
        : { creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'none', entity: null, gid: null, name: '', candidates: [], committed: false, _pending: true });
      const te = { mi: t.mi, ti: t.ti, number: t.number, title: t.title, length: t.length, slots };
      te.slots.forEach(s => { s._entry = te; }); te.guessTitle = guessTitleStr(te);
      return te;
    });
    return { tracks };
  }
  // match the _pending slots, updating the table row-by-row as results come in
  async function matchModel(onProgress) {
    const isEditing = () => { const a = document.activeElement; return a && /^(INPUT|SELECT)$/.test(a.tagName) && (a.closest('#tc-mirror-wrap') || a.closest('#tc-panel')); };
    setMatching(true);
    try {
      const siblings = await loadSiblingMap();
      const todo = MODEL.tracks.filter(t => t.slots.some(s => s._pending)); let done = 0;
      for (const t of MODEL.tracks) {
        if (!t.slots.some(s => s._pending)) continue;
        const sib = siblings.get(fold(t.title)) || null;
        for (let i = 0; i < t.slots.length; i++) {
          const s = t.slots[i]; if (!s._pending) continue;
          const m = await matchSlot(s.creditedAs, sib && sib[i]);
          Object.assign(s, { status: m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none', entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates }); delete s._pending;
        }
        autoCommitTrack(t); if (!isEditing()) rerender();
        done++; if (onProgress) onProgress(done, todo.length);
      }
      if (!isEditing()) rerender();
    } finally { setMatching(false); refreshStatus(); }   // set the final per-medium badges once the pass is done
  }
  // (re-)match every still-unmatched slot — the "Match" button / used when auto-match is off
  async function matchAll() { if (!MODEL) return; MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s.status !== 'set' && !s.committed) s._pending = true; })); await matchModel((d, n) => updateStatus(`matching ${d}/${n}…`)); }
  function resetTrack(entry) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti); if (!orig) return;
    const t = koTrack(entry.mi, entry.ti);
    t.artistCredit({ names: orig.names.map(o => ({ artist: o.artist, name: o.creditedAs, joinPhrase: o.joinPhrase })) });
    try { t.name(orig.title); } catch (e) {}
    try { t.number(orig.number); } catch (e) {}
    try { if (typeof t.formattedLength === 'function') t.formattedLength(orig.length); } catch (e) {}
    Log.info('reset track', entry.number, 'to original (all cells)');
  }
  let _selfEdit = false;   // true while WE mutate the tracklist, so the change-watcher ignores it
  function removeTrack(entry) { _selfEdit = true; try { getEditor().removeTrack(koTrack(entry.mi, entry.ti)); } finally { _selfEdit = false; } Log.info('removed track', entry.number); }
  function moveTrack(entry, dir) { const ed = getEditor(); const t = koTrack(entry.mi, entry.ti); _selfEdit = true; try { (dir < 0 ? ed.moveTrackUp : ed.moveTrackDown).call(ed, t); } finally { _selfEdit = false; } }
  // add N blank tracks to a medium by driving MB's own "Add tracks" control (the green ＋)
  function addTracks(mi, n) {
    const btns = [...document.querySelectorAll('button[data-click="addNewTracks"]')];
    const inputs = [...document.querySelectorAll('input[data-bind*="addTrackCount"]')];
    const btn = btns[mi] || btns[btns.length - 1]; const inp = inputs[mi] || inputs[inputs.length - 1];
    if (!btn) { Log.warn('no native add-tracks button found'); return; }
    _selfEdit = true;
    try { if (inp) { inp.value = String(n); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } btn.click(); }
    finally { _selfEdit = false; }
    Log.info('added', n, 'track(s) to medium', mi + 1);
    // refresh immediately (blank tracks need no matching) instead of the 400ms watcher + match pass
    MODEL = buildShell(); if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); } rerender();
  }
  function setTitle(entry, v) { koTrack(entry.mi, entry.ti).name(v); }
  function setNumber(entry, v) { try { koTrack(entry.mi, entry.ti).number(v); } catch (e) { Log.warn('set number failed', v, e.message); } }
  function setLength(entry, v) { const t = koTrack(entry.mi, entry.ti); try { if (typeof t.formattedLength === 'function') t.formattedLength(v); else { const ed = getEditor(); const ms = ed.utils && ed.utils.unformatTrackLength ? ed.utils.unformatTrackLength(v) : null; if (ms != null && !isNaN(ms)) t.length(ms); } } catch (e) { Log.warn('set length failed', v, e.message); } }
  // MB guess case: preview into track.previewName (no mutation) to detect the diff; click-type to apply
  function guessTitleStr(entry) {
    const ed = getEditor(), t = koTrack(entry.mi, entry.ti);
    try { ed.guessCaseTrackName(t, { type: 'mouseenter', buttons: 0 }); const g = u(t.previewName); ed.guessCaseTrackName(t, { type: 'mouseleave' }); return (g == null) ? u(t.name) : g; }
    catch (e) { return u(t.name); }
  }
  function applyGuessTitle(entry) { try { getEditor().guessCaseTrackName(koTrack(entry.mi, entry.ti), { type: 'click' }); } catch (e) { Log.warn('guess case failed', e.message); } }

  /* ── create artist ── */
  function guessSortName(name) {
    const n = (name || '').trim();
    if (!/^[\x00-\x7F]+$/.test(n)) return n;
    const p = n.split(/\s+/); if (p.length < 2) return n;
    const last = p.pop(); return last + ', ' + p.join(' ');
  }
  // open MB's create-artist form; when it's saved, the new artist page posts the MBID back over the
  // channel (handshake via sessionStorage token) and closes itself, and we drop it into the slot.
  function createArtist(name, slot) {
    const url = `${ORIGIN}/artist/create?edit-artist.name=${encodeURIComponent(name)}&edit-artist.sort_name=${encodeURIComponent(guessSortName(name))}`;
    const tab = W.open(url, '_blank');   // NOT noopener — we set a token on the new tab's sessionStorage
    if (tab && slot && ART_CHANNEL) {
      const token = 'tc-' + Date.now() + '-' + (++_createSeq); _pendingCreates.set(token, { slot });
      const trySet = () => { try { tab.sessionStorage.setItem(PENDING_KEY, token); } catch (e) { setTimeout(trySet, 50); } }; trySet();
      Log.info('create-artist for', JSON.stringify(name), '— will auto-insert on save');
    } else { Log.info('open MB create-artist for', JSON.stringify(name)); }
  }
  // runs on a freshly-saved /artist/<mbid> page opened by createArtist: post the MBID back, then close
  function handleArtistPageCallback() {
    const m = location.pathname.match(new RegExp('^/artist/(' + MBID_RE.source + ')', 'i')); if (!m) return false;
    let token = null; try { token = sessionStorage.getItem(PENDING_KEY); } catch (e) {} if (!token) return false;
    try { sessionStorage.removeItem(PENDING_KEY); } catch (e) {}
    const gid = m[1].toLowerCase();
    fetchEntity(gid).then(ent => { if (ART_CHANNEL) ART_CHANNEL.postMessage({ type: 'tc-artist-created', token, gid, id: ent ? ent.id : null, name: ent ? ent.name : '' }); setTimeout(() => { try { W.close(); } catch (e) {} }, 80); });
    return true;
  }

  /* ════════════════════════ UI ════════════════════════ */
  const ICON = '<svg class="tc-ico" viewBox="0 0 36 30" width="26" height="22" aria-hidden="true" style="vertical-align:-6px">' +
    '<path d="M6 16 C6 11 9 10 13 10 L24 10 L24 18 L13 18 C9 18 6 17 6 16 Z" fill="#5f3ec0"/>' +
    '<polygon points="24,8.5 30,7 30,21 24,19.5" fill="#5f3ec0"/>' +
    '<line x1="30" y1="7" x2="30" y2="21" stroke="#2a1a52" stroke-width="1.8"/>' +
    '<circle cx="13" cy="20.5" r="6" fill="#3d2470"/><circle cx="13" cy="20.5" r="4.7" fill="none" stroke="#fff" stroke-width="1"/>' +
    '<g stroke="#fff" stroke-width="0.9"><line x1="7.2" y1="20.5" x2="18.8" y2="20.5"/><line x1="13" y1="14.7" x2="13" y2="26.3"/><line x1="8.9" y1="16.4" x2="17.1" y2="24.6"/><line x1="8.9" y1="24.6" x2="17.1" y2="16.4"/></g>' +
    '<circle cx="13" cy="20.5" r="1.7" fill="#fff"/>' +
    '<text x="31" y="9" font-size="9" font-weight="bold" fill="#1f8a4c" font-family="Arial">♪</text></svg>';

  // outline person / group type icons (use currentColor so they take the link colour)
  const PERSON_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.4"/><path d="M5 20 C5 14.5 19 14.5 19 20"/></svg>';
  const GROUP_SVG = '<svg viewBox="0 0 24 24" width="17" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="9" r="2.7"/><circle cx="15.5" cy="9" r="2.7"/><path d="M3 19 C3 15 11 15 11 19"/><path d="M13 19 C13 15 21 15 21 19"/></svg>';
  const typeSvg = c => { const t = ((c && c.typeName) || '').toLowerCase(); return (t === 'group' || t === 'orchestra' || t === 'choir') ? GROUP_SVG : PERSON_SVG; };
  const JOIN_OPTIONS = [
    { label: '&', value: ' & ' }, { label: ',', value: ', ' }, { label: 'feat.', value: ' feat. ' },
    { label: 'ft.', value: ' ft. ' }, { label: 'featuring', value: ' featuring ' }, { label: 'and', value: ' and ' },
    { label: 'vs.', value: ' vs. ' }, { label: 'x', value: ' x ' }, { label: 'with', value: ' with ' },
    { label: '/', value: ' / ' }, { label: '·', value: ' · ' }, { label: 'presents', value: ' presents ' },
  ];

  const COLORS = { set: '#d6f0d8', rg: '#d6f0d8', high: '#d8e6ff', low: '#fdf3d0', user: '#e9dcfb', none: '#fbdcdf' };
  const COLS = [{ k: 'mv', w: 32, label: '' }, { k: 'num', w: 38, label: '#' }, { k: 'title', w: 200, label: 'Title' }, { k: 'art', w: 380, label: 'Artist' }, { k: 'len', w: 52, label: 'Length' }, { k: 'badge', w: 56, label: '' }];
  const badgeText = s => ({ rg: 'rg', high: 'name', user: 'user', set: 'set', low: 'low' })[s.status] || '';
  const colW = (k, d) => (SETTINGS.colWidths && SETTINGS.colWidths[k]) || d;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  // Enter in our inputs must not bubble to MB's form (it switches tabs); commit by blurring instead
  const enterBlurs = el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); el.blur(); } });
  function rowConfidence(t) { const live = t.slots.filter(s => s.status !== 'set'); if (!live.length) return 'set'; const order = ['none', 'low', 'user', 'high', 'rg']; return live.map(s => s.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]; }
  const badge = s => `<span class="tc-badge ${s}">${s === 'rg' ? 'RG' : s.toUpperCase()}</span>`;

  const css = `
    .tc-badge{font-size:10px;font-weight:bold;border-radius:9px;padding:1px 7px;color:#fff;white-space:nowrap}
    .tc-badge.rg{background:#1f8a4c}.tc-badge.set{background:#6c757d}.tc-badge.high{background:#2f6fd6}
    .tc-badge.low{background:#e0a800}.tc-badge.user{background:#6f42c1}.tc-badge.none{background:#c0392b}
    .tc-btn{padding:4px 11px;border:1px solid transparent;border-radius:3px;background:transparent;cursor:pointer;font:13px Arial;color:#444}
    .tc-btn:hover{background:linear-gradient(#fff,#eee);border-color:#bbb}
    .tc-btn.primary{color:#5f3ec0;font-weight:bold}.tc-btn.primary:hover{background:linear-gradient(#7a52df,#5f3ec0);color:#fff;border-color:#4f33a3}
    .tc-btn:disabled,.tc-btn:disabled:hover{color:#aaa;background:transparent;border-color:transparent;cursor:default;font-weight:normal}
    .tc-btn.mini{padding:1px 6px;font-size:11px}
    .tc-icon{cursor:pointer;border:none;background:none;font-size:13px;padding:0 2px;color:#666}
    #tc-panel a,#tc-mirror-wrap a{color:#4800a0;text-decoration:none}#tc-panel a:hover,#tc-mirror-wrap a:hover{text-decoration:underline}

    .tc-mirror{table-layout:fixed;border-collapse:collapse;font:13px Arial,Helvetica,sans-serif;background:#fff}
    .tc-mirror th{position:relative;background:#eee;border-bottom:2px solid #ccc;border-right:1px solid #cfcfcf;text-align:left;padding:4px 6px;font-size:12px;color:#333;overflow:hidden}
    .tc-mirror th:last-child{border-right:none}
    .tc-mirror td{border-bottom:1px solid #e2e2e2;padding:3px 6px;vertical-align:middle;overflow:hidden;background:#fff}
    .tc-mirror td.c-art,.tc-mirror td.c-badge{vertical-align:top}
    .tc-mirror td.c-badge{position:relative;padding:0;text-align:center}
    .tc-mirror .tc-resizer{position:absolute;right:-1px;top:0;height:100%;width:9px;cursor:col-resize;border-right:2px solid transparent}
    .tc-mirror th:hover .tc-resizer,.tc-mirror .tc-resizer:hover{border-right-color:#5f3ec0}
    .tc-mirror .c-num{color:#888;font-variant-numeric:tabular-nums}
    .tc-mirror .c-mv{white-space:nowrap;text-align:center}
    .tc-mirror input.t-title,.tc-mirror input.t-len,.tc-mirror input.t-num{width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;font:13px Arial;padding:3px 2px}
    .tc-mirror input.t-len,.tc-mirror input.t-num{text-align:right;color:#666}
    .tc-mirror input.t-title:hover,.tc-mirror input.t-title:focus,.tc-mirror input.t-len:hover,.tc-mirror input.t-len:focus,.tc-mirror input.t-num:hover,.tc-mirror input.t-num:focus{border-color:#bbb;background:#fff}
    .tc-mirror .t-wrap{display:flex;align-items:center;gap:3px}.tc-mirror .t-wrap input.t-title{flex:1;min-width:0;width:auto}
    .tc-mirror input.t-title.diff{background:#fff6da;border-color:#e7ce8a;border-radius:3px}
    .tc-mirror input.t-title.gcpreview{background:#e3f6e3;border-color:#86c686;border-radius:3px}
    /* MB medium-format select made to read as plain text — click still opens the native dropdown */
    select.tc-fmt-flat{-webkit-appearance:none;-moz-appearance:none;appearance:none;border:1px solid transparent;background:transparent;font:bold 15px Arial;color:#222;padding:2px 5px;cursor:pointer}
    select.tc-fmt-flat:hover{background:#efeaf9;border-color:#d7ccef;border-radius:3px}
    .tc-mirror .t-gc{flex:none;cursor:pointer;border:1px solid #e7ce8a;background:#fff6da;color:#8a6d00;font:bold 10px Arial;border-radius:3px;padding:1px 4px;visibility:hidden}.tc-mirror .t-gc:hover{background:#ffefb8}
    .tc-mirror tr:hover .t-gc{visibility:visible}
    .tc-mirror .mv{cursor:pointer;color:#6f54c0;font-size:12px;padding:0 1px}
    /* alternate row colors / grid (toggled in ⚙) */
    .tc-mirror.alt tbody tr:nth-child(even) td{background:#f6f4fb}
    .tc-mirror.grid td{border-right:1px solid #ededed}.tc-mirror.grid td:last-child{border-right:none}
    /* compact layout: pack rows tighter to fit more (closer to MB's native density) */
    .tc-mirror.compact th{padding:2px 6px}
    .tc-mirror.compact td{padding:0 6px}
    .tc-mirror.compact .tc-aslot,.tc-mirror.compact .tc-bl{height:21px}
    .tc-mirror.compact input.t-title,.tc-mirror.compact input.t-len,.tc-mirror.compact input.t-num{padding:0 2px;font-size:12px}
    .tc-mirror.compact .tc-search{padding:0 5px}.tc-mirror.compact .tc-search .nm{padding:1px 0;font-size:12px}
    .tc-mirror.compact .tc-cred{padding:0 4px}
    /* badge column: pills per artist line; on row hover the track ↺/✕ overlay it */
    .tc-bl{height:28px;box-sizing:border-box;display:flex;align-items:center;justify-content:center}
    .tc-trackacts{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.93)}
    .tc-mirror tr:hover .tc-trackacts{display:flex}
    .tc-trackacts button{cursor:pointer;border:none;background:none;font-size:16px;line-height:1}
    .tc-trackacts .trev{color:#9a8fc0}.tc-trackacts .trev:hover{color:#5f3ec0}
    .tc-trackacts .rm{color:#c0392b;font-weight:bold}.tc-trackacts .rm:hover{color:#a02519}
    /* one artist = one aligned fixed-height line: credited-as · icon · search box · acts (no line between artists) */
    .tc-aslot{display:flex;align-items:center;gap:5px;height:28px;box-sizing:border-box}
    .tc-cred{flex:none;width:130px;text-align:right;box-sizing:border-box;font:11px Arial;color:#1c1c1c;border:1px solid transparent;background:transparent;padding:1px 4px}
    .tc-cred::placeholder{color:#cfcfcf}
    .tc-cred:hover,.tc-cred:focus{border-color:#cdbff0;background:#fff;color:#333}
    .tc-tic{flex:none;width:18px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:#6f54c0;text-decoration:none}
    .tc-tic.link{cursor:pointer}.tc-tic.link:hover{color:#4f2bab}.tc-tic.dim{color:#c6bbe6}
    /* one fixed-width search box per artist (so all lines align); name fills it, ＋ + join sit at the right */
    .tc-search{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:4px;border:1px solid #bbb;border-radius:4px;background:#fff;padding:0 6px;overflow:hidden}
    .tc-search.matched{background:#e3f4e7;border-color:#bcdcc6}
    @keyframes tcflash{0%{box-shadow:0 0 0 3px #e0a800}70%{box-shadow:0 0 0 3px #e0a800}100%{box-shadow:0 0 0 0 rgba(224,168,0,0)}}
    .tc-search.tc-flash{animation:tcflash 1.5s ease-out}
    .tc-search.tc-marked{border:2px solid #e0a800}   /* persists when a pick changed several tracks */
    .tc-search .nm{flex:1 1 0;min-width:0;border:none;background:transparent;font:13px Arial;padding:3px 0;outline:none}
    .tc-search .tc-bar-aka{flex:none;max-width:45%;color:#3a9d6a;font-size:11px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    .tc-search .mk{flex:none;cursor:pointer;border:none;background:none;color:#1f8a4c;font-weight:bold;font-size:15px;line-height:1;padding:0 2px}.tc-search .mk:hover{color:#136b39}
    .tc-joinwrap{flex:none;display:flex;align-items:center;gap:0}
    .tc-join{width:auto;text-align:right;border:1px solid transparent;background:transparent;color:#777;font:italic 12px Arial;padding:1px 2px;border-radius:3px}
    .tc-join:hover,.tc-join:focus{border-color:#bcdcc6;background:#fff;color:#444}
    .tc-joinarrow{cursor:pointer;border:none;background:none;color:#9a8fc0;font-size:10px;padding:0 1px;line-height:1}.tc-joinarrow:hover{color:#5f3ec0}
    .tc-joinpop .tc-acrow{justify-content:space-between;gap:14px}.tc-joinpop .cmt{color:#999}
    .tc-acts{flex:none;width:44px;display:flex;align-items:center;justify-content:flex-start;gap:4px;padding-left:4px}
    .tc-enter,.tc-slotx{cursor:pointer;border:none;background:none;padding:0 1px;visibility:hidden;line-height:1}
    .tc-enter{color:#7d6bc0;font-size:19px}.tc-enter:hover{color:#5f3ec0}
    .tc-slotx{color:#cc6699;font-size:13px}.tc-slotx:hover{color:#c0392b}
    .tc-mirror tr:hover .tc-enter,.tc-mirror tr:hover .tc-slotx{visibility:visible}
    .tc-acpop{position:fixed;z-index:100002;background:#fff;border:1px solid #b9a4e0;border-radius:4px;box-shadow:0 6px 22px rgba(40,20,80,.3);max-height:300px;overflow:auto;font:12px Arial;min-width:210px}
    .tc-acrow{display:flex;align-items:center;gap:7px;padding:4px 9px;cursor:pointer}
    .tc-acrow:hover,.tc-acrow.hi{background:#ede9f6}
    .tc-acrow .tic{flex:none;width:17px;display:inline-flex;align-items:center;justify-content:center;color:#6f54c0}
    .tc-acrow .nm{font-weight:600;color:#222}.tc-acrow .cmt{color:#888;font-size:11px}
    .tc-acrow .tc-aka{color:#5a7;font-size:11px;font-style:italic}
    .tc-acrow.none{color:#888;font-style:italic;cursor:default}
    .tc-acrow.exact{background:#dff3e5}.tc-acrow.exact .nm{color:#136b39}.tc-acrow.exact:hover,.tc-acrow.exact.hi{background:#cfeed9}
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

    /* the global toolbar stays pinned at the top while scrolling the tracklist */
    #tc-mirror-wrap{margin:4px 0 6px;position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e3dcf2;box-shadow:0 3px 8px rgba(40,20,80,.07)}
    .tc-medsec{margin:2px 0 14px}
    #tc-bar{display:flex;align-items:center;gap:8px;padding:6px 4px}
    #tc-bar b{color:#563b8f}#tc-bar .sp{flex:1}
    .tc-toast{flex:none;max-width:46%;color:#5f3ec0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
    .tc-tablewrap{overflow-x:auto}
    .tc-addrow{padding:8px 4px;font-size:13px;color:#555;display:flex;align-items:center;gap:6px}
    .tc-addrow input.tc-addn{width:54px;font:13px Arial;padding:2px 4px;border:1px solid #bbb;border-radius:3px}
    .tc-addbtn{width:22px;height:22px;border-radius:50%;border:none;background:#3aaf3a;color:#fff;font:bold 15px/1 Arial;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
    .tc-addbtn:hover{background:#2f9b2f}
    .tc-mirror th .tc-hstatus{font-weight:normal;font-style:italic;color:#999;margin-left:12px;font-size:11px}
    .tc-mirror th .tc-hstatus.tc-unres{font-style:normal;font-weight:bold;color:#fff;background:#d6342c;padding:1px 7px;border-radius:9px;font-size:11px}
    .tc-mirror th .tc-hdr-am{float:right;font-weight:normal;font-style:normal;font-size:11px;color:#444;margin-right:14px;max-width:140px}
    .tc-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .tc-toolopts{display:flex;align-items:center;gap:6px}
    .tc-toolopts .tc-gco,.tc-toolopts .tc-sro{display:flex;align-items:center;gap:8px}
    .tc-toolopts label{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#555}
    .tc-toolopts input[type=text]{font:12px Arial;padding:2px 5px;border:1px solid #bbb;border-radius:3px;width:120px}
    .tc-toolopts input[type=text]::placeholder{color:#c2c2c2}
    .tc-toolopts select{font:12px Arial;padding:1px}
    /* the Tools split-button always keeps the bordered/filled button look (not flat) */
    .tc-split{display:inline-flex}
    .tc-split .tc-btn{border-radius:3px 0 0 3px;border-color:#bbb;background:linear-gradient(#fff,#eee)}
    .tc-split .tc-caret{border-radius:0 3px 3px 0;padding:4px 7px;border-left:1px solid #ccc}
    .tc-split .tc-btn:hover{background:linear-gradient(#fff,#e4e4e4)}
    .tc-menu{position:fixed;z-index:100001;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 22px rgba(40,20,80,.3);padding:4px 0;font:13px Arial;min-width:170px}
    .tc-menu .tc-mi{padding:6px 15px;cursor:pointer;color:#333;font-weight:bold}.tc-menu .tc-mi:hover{background:#ede9f6;color:#4b2e83}
    .tc-menu .tc-sep{border-top:1px solid #e6e0f2;margin:4px 0}
    .tc-settings label{display:flex;gap:8px;align-items:center;margin:7px 0;color:#333}.tc-settings label.opt{font-size:12px}
    .tc-settings input[type=text],.tc-settings #tc-sr-find,.tc-settings #tc-sr-rep{font:13px Arial;padding:3px 5px;border:1px solid #bbb;border-radius:3px}
    .tc-settings .srrow{display:flex;align-items:center;gap:8px;margin-top:8px}.tc-settings .srrow span{flex:1;color:#777;font-size:12px}
    @keyframes tctitleflash{0%{background:#fff3b0}100%{background:transparent}}
    .tc-mirror input.t-title.srflash{animation:tctitleflash 1.8s ease-out}

    #tc-settings{position:fixed;z-index:100001;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 24px rgba(40,20,80,.3);padding:11px 13px;font:13px Arial;color:#222;width:340px}
    #tc-settings h4{margin:0 0 9px;padding-bottom:8px;border-bottom:1px solid #e3dcf2;color:#563b8f;font-size:13px}
    #tc-settings label{display:flex;gap:8px;align-items:flex-start;margin:7px 0;color:#333}
    #tc-settings .hint{color:#777;font-size:11px;margin:0 0 4px 24px}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;background:#5f3ec0;color:#fff;border:none;border-radius:20px;padding:8px 14px;font:bold 13px Arial;cursor:pointer;box-shadow:0 3px 12px rgba(40,20,80,.3)}
    #tc-btn,#tc-gear-btn{vertical-align:middle}
  `;
  function style() {
    if (document.getElementById('tc-css')) return;
    const s = document.createElement('style'); s.id = 'tc-css'; s.textContent = css; document.head.appendChild(s);
  }

  /* ── settings popover (view options) ── */
  function applyViewClasses() { document.querySelectorAll('.tc-mirror').forEach(t => { t.classList.toggle('alt', !!SETTINGS.altRows); t.classList.toggle('grid', !!SETTINGS.grid); t.classList.toggle('compact', SETTINGS.layout === 'compact'); }); }
  function openSettings(anchor) {
    style(); let s = document.getElementById('tc-settings'); if (s) { s.remove(); return; }
    s = document.createElement('div'); s.id = 'tc-settings';
    s.innerHTML = `<h4>${ICON} Track Cannon — settings</h4>
      <label><span>Row layout</span><select id="tc-s-layout" style="margin-left:auto"><option value="cozy">Cozy</option><option value="compact">Compact</option></select></label>
      <label><input type="checkbox" id="tc-s-automatch"> <span>Auto-match artists on load</span></label>
      <div class="hint">Off: the table shows immediately but unmatched — use the <b>Match</b> button or search a field.</div>
      <label><input type="checkbox" id="tc-s-alt"> <span>Alternate row colors</span></label>
      <label><input type="checkbox" id="tc-s-grid"> <span>Show grid</span></label>`;
    document.body.appendChild(s);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 60, bottom: 80 };
    s.style.left = Math.min(r.left, window.innerWidth - 300) + 'px'; s.style.top = (r.bottom + 6) + 'px';
    const am = s.querySelector('#tc-s-automatch'), alt = s.querySelector('#tc-s-alt'), grid = s.querySelector('#tc-s-grid'), lay = s.querySelector('#tc-s-layout');
    am.checked = SETTINGS.autoMatch !== false; alt.checked = !!SETTINGS.altRows; grid.checked = !!SETTINGS.grid; lay.value = SETTINGS.layout || 'cozy';
    am.onchange = () => { SETTINGS.autoMatch = am.checked; saveSettings(); };
    alt.onchange = () => { SETTINGS.altRows = alt.checked; saveSettings(); applyViewClasses(); };
    grid.onchange = () => { SETTINGS.grid = grid.checked; saveSettings(); applyViewClasses(); };
    lay.onchange = () => { SETTINGS.layout = lay.value; saveSettings(); applyViewClasses(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  /* ── the one shared table ── */
  let MODEL = null;
  let ACTIVE = {};   // { mode, tbody, statusEl }
  // transient message (e.g. "matching d/n") shown in every table's Artist header
  const updateStatus = t => { document.querySelectorAll('.tc-medsec .tc-hstatus, #tc-panel .tc-hstatus').forEach(e => { e.textContent = t; e.classList.remove('tc-unres'); }); };
  // transient action feedback (a pick propagated, S&R count, …) — lives in the toolbar so it never
  // overwrites a medium's unresolved badge; auto-clears
  let _toastTimer = null;
  const toast = msg => { document.querySelectorAll('.tc-toast').forEach(e => { e.textContent = msg || ''; }); clearTimeout(_toastTimer); if (msg) _toastTimer = setTimeout(() => toast(''), 5000); };
  const unresolvedIn = mi => { let n = 0; MODEL.tracks.forEach(t => { if (mi != null && t.mi !== mi) return; t.slots.forEach(s => { if (!(s.status === 'set' || s.committed)) n++; }); }); return n; };
  const statusText = n => (n ? `⚠ ${n} unresolved!` : 'all matched');
  const setStatusSpan = (span, n) => { if (!span) return; span.textContent = statusText(n); span.classList.toggle('tc-unres', n > 0); };
  // disable the Match button while a match pass is running
  let _matching = false;
  function setMatching(on) { _matching = on; const b = document.querySelector('#tc-bar [data-act="match"], #tc-hdr [data-act="match"]'); if (b) b.disabled = on; }
  // re-fill every active tbody (per-medium sections in mirror mode, or the single panel table)
  const rerender = () => { if (ACTIVE.sections) ACTIVE.sections.forEach(s => fillRows(s.tbody, s.mi)); else if (ACTIVE.tbody) fillRows(ACTIVE.tbody); refreshStatus(); };
  // our rendered row for a track, wherever it lives (a per-medium section or the floating panel)
  const rowEl = (mi, ti) => document.querySelector(`.tc-medsec tr[data-tk="${mi}:${ti}"], #tc-panel tr[data-tk="${mi}:${ti}"]`);
  // ↑/↓ : move to the same field in the previous/next row (same medium); returns true if it moved
  function focusSameField(inp, dir) {
    const row = inp.closest('tr[data-tk]'); if (!row) return false;
    const rows = [...row.parentElement.querySelectorAll('tr[data-tk]')]; const dest = rows[rows.indexOf(row) + dir]; if (!dest) return false;
    const sel = inp.classList.contains('t-num') ? '.t-num' : inp.classList.contains('t-title') ? '.t-title' : inp.classList.contains('t-len') ? '.t-len' : inp.classList.contains('tc-cred') ? '.tc-cred' : inp.classList.contains('nm') ? '.tc-search input.nm' : null;
    if (!sel) return false;
    const idx = Math.max(0, [...row.querySelectorAll(sel)].indexOf(inp)); const destTk = dest.dataset.tk;
    // committing the current field on blur can rebuild the rows, so blur FIRST, then focus the
    // destination by re-querying the fresh DOM (retry next tick in case the rebuild is deferred)
    inp.blur();
    const go = () => { const d = document.querySelector(`.tc-medsec tr[data-tk="${destTk}"], #tc-panel tr[data-tk="${destTk}"]`); if (!d) return; const tgts = [...d.querySelectorAll(sel)]; const t = tgts[Math.min(idx, tgts.length - 1)]; if (t && document.activeElement !== t) { t.focus(); if (t.select) t.select(); } };
    go(); setTimeout(go, 0);
    return true;
  }
  function wireRowNav(inp) { inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { if (focusSameField(inp, 1)) e.preventDefault(); } else if (e.key === 'ArrowUp') { if (focusSameField(inp, -1)) e.preventDefault(); } }); }
  // show each medium's OWN unresolved count in its header (or the global count for the floating panel)
  function refreshStatus() {
    if (!MODEL || _matching) return;   // while a pass runs the headers show "matching d/n" — don't flicker the badge
    if (ACTIVE.sections) ACTIVE.sections.forEach(s => setStatusSpan(s.sec.querySelector('.tc-hstatus'), unresolvedIn(s.mi)));
    else document.querySelectorAll('#tc-panel .tc-hstatus').forEach(span => setStatusSpan(span, unresolvedIn(null)));
  }

  function buildTable() {
    const t = document.createElement('table'); t.className = 'tc-mirror' + (SETTINGS.altRows ? ' alt' : '') + (SETTINGS.grid ? ' grid' : '') + (SETTINGS.layout === 'compact' ? ' compact' : '');
    t.innerHTML = `<colgroup>${COLS.map(c => `<col style="width:${colW(c.k, c.w)}px">`).join('')}</colgroup>` +
      `<thead><tr>${COLS.map(c => `<th>${c.label}${c.k === 'art' ? '<span class="tc-hstatus"></span>' + AM_SELECT : ''}<span class="tc-resizer"></span></th>`).join('')}</tr></thead><tbody></tbody>`;
    return t;
  }
  // the artist-selection-mode dropdown now lives in the Artist column header (right-aligned)
  const AM_SELECT = `<select class="tc-applymode tc-hdr-am" title="when you pick an artist, apply it to…"><option value="all">all matching tracks</option><option value="single">single track</option></select>`;
  // one Canon table for a single medium (its own header row + Add footer); returns the tbody.
  // mi == null renders the whole release into one table (the floating panel).
  function mountTable(container, mi) {
    container.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'tc-tablewrap'; container.appendChild(wrap);
    const table = buildTable(); wrap.appendChild(table); wireResizers(table);
    const am = table.querySelector('.tc-applymode');
    if (am) {
      am.value = SETTINGS.applyMode || 'all';
      am.onchange = () => { SETTINGS.applyMode = am.value; saveSettings(); document.querySelectorAll('.tc-applymode').forEach(s => { s.value = am.value; }); Log.info('applyMode =', am.value); };
      ['mousedown', 'mousemove', 'click'].forEach(ev => am.addEventListener(ev, e => e.stopPropagation()));   // don't let the column resizer hijack it
    }
    // "Add N track(s)" footer — adds to THIS medium (or the last medium for the combined panel)
    const target = (mi == null) ? Math.max(0, mediums().length - 1) : mi;
    const addrow = document.createElement('div'); addrow.className = 'tc-addrow';
    addrow.innerHTML = `Add <input type="number" class="tc-addn" min="1" value="1"> track(s) <button class="tc-addbtn" title="add blank tracks">＋</button>`;
    const addn = addrow.querySelector('.tc-addn'), addbtn = addrow.querySelector('.tc-addbtn');
    addbtn.onclick = () => addTracks(target, Math.max(1, parseInt(addn.value, 10) || 1));
    container.appendChild(addrow);
    return table.querySelector('tbody');
  }
  // resize a column by dragging near its right border from ANY row (or the header)
  function wireResizers(table) {
    const cols = [...table.querySelectorAll('col')];
    const TOL = 5;
    const borderIdx = clientX => { const ths = table.querySelectorAll('thead th'); for (let i = 0; i < ths.length - 1; i++) { if (Math.abs(ths[i].getBoundingClientRect().right - clientX) <= TOL) return i; } return -1; };
    let dragging = false;
    table.addEventListener('mousemove', e => { if (!dragging) table.style.cursor = borderIdx(e.clientX) >= 0 ? 'col-resize' : ''; });
    table.addEventListener('mousedown', e => {
      const i = borderIdx(e.clientX); if (i < 0) return;
      e.preventDefault(); dragging = true;
      const col = cols[i], startX = e.clientX, startW = col.offsetWidth || parseInt(col.style.width) || 100;
      const mm = ev => { col.style.width = Math.max(36, startW + ev.clientX - startX) + 'px'; };
      const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); dragging = false; SETTINGS.colWidths = SETTINGS.colWidths || {}; SETTINGS.colWidths[COLS[i].k] = parseInt(col.style.width); saveSettings(); };
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
  }
  // picking an artist writes through immediately; in "all" mode it also copies to every other
  // track credited to the same text, committing each.
  function pickArtist(slot, c) {
    if (!c || !c.gid) return;
    if (c.aliases) cacheAliases(c.gid, c.aliases);   // keep the chosen artist's aliases for the bar
    MODEL.tracks.forEach(t => t.slots.forEach(s => { delete s._marked; }));   // clear the previous selection's outlines
    slot.entity = c; slot.gid = c.gid; slot.name = c.name; slot.status = 'user'; slot.committed = true; slot.query = null; slot._flash = true;
    if (!(slot.creditedAs || '').trim()) slot.creditedAs = c.name;   // auto-fill the credited-as when the user hasn't set one
    commitTrack(slot._entry);
    const key = fold(slot.creditedAs); const changed = [slot]; const touched = new Set();
    if ((SETTINGS.applyMode || 'all') === 'all' && key) {   // don't mass-propagate from an empty credit
      MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s === slot || fold(s.creditedAs) !== key) return; s.entity = c; s.gid = c.gid; s.name = c.name; s.status = 'user'; s.committed = true; s._flash = true; if (!(s.creditedAs || '').trim()) s.creditedAs = c.name; touched.add(s._entry); changed.push(s); }));
      touched.forEach(commitTrack);
    }
    const copies = touched.size;
    if (copies) { changed.forEach(s => { s._marked = true; }); Log.info('propagated', c.name, '→', copies, 'other track(s) credited', JSON.stringify(slot.creditedAs)); }   // outline persists when >1 track changed
    rerender();
    if (copies) toast(`linked “${c.name}” — also set on ${copies} other track${copies > 1 ? 's' : ''}`);
  }
  async function revertSlot(entry, i) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti); if (!orig || !orig.names[i]) return;
    const on = orig.names[i], slot = entry.slots[i];
    slot.creditedAs = on.creditedAs; slot.joinPhrase = on.joinPhrase; slot.query = null;
    const a = u(on.artist) || {}, gid = u(a.gid);
    if (gid) Object.assign(slot, { status: 'set', gid, name: u(a.name), entity: { gid, name: u(a.name), id: u(a.id) }, candidates: [], committed: true });
    else { const sib = (await loadSiblingMap()).get(fold(entry.title)); const m = await matchSlot(on.creditedAs, sib && sib[i]); Object.assign(slot, { status: m.entity ? (m.source === 'rg' ? 'rg' : m.confidence) : 'none', entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, committed: false }); }
    commitTrack(entry); Log.info('reverted slot', i, 'of track', entry.number); rerender();
  }

  const blankSlot = entry => ({ creditedAs: '', joinPhrase: '', status: 'none', entity: null, gid: null, name: '', candidates: [], committed: false, _entry: entry });
  function focusSlotInput(entry, idx) { const row = rowEl(entry.mi, entry.ti); if (row) { const ins = row.querySelectorAll('.tc-search input.nm'); if (ins[idx]) ins[idx].focus(); } }
  // split a credit: append an artist slot (the ＋ create-row / API uses this)
  function addSlot(entry) {
    const last = entry.slots[entry.slots.length - 1];
    if (last && !(last.joinPhrase || '').trim()) last.joinPhrase = ' & ';
    entry.slots.push(blankSlot(entry)); commitTrack(entry); rerender(); focusSlotInput(entry, entry.slots.length - 1);
    Log.info('added artist slot to track', entry.number);
  }
  // ↵ : insert an artist slot right after this one
  function addSlotAfter(entry, idx) {
    if (!(entry.slots[idx].joinPhrase || '').trim()) entry.slots[idx].joinPhrase = ' & ';
    const s = blankSlot(entry); s.joinPhrase = idx + 1 < entry.slots.length ? ' & ' : '';
    entry.slots.splice(idx + 1, 0, s); commitTrack(entry); rerender(); focusSlotInput(entry, idx + 1);
    Log.info('inserted artist slot after', idx, 'on track', entry.number);
  }
  // merge: remove an artist slot (clearing the trailing join on the new last slot)
  function removeSlot(entry, idx) {
    if (entry.slots.length <= 1) return;
    entry.slots.splice(idx, 1);
    const last = entry.slots[entry.slots.length - 1]; if (last) last.joinPhrase = '';
    commitTrack(entry); rerender(); Log.info('removed artist slot', idx, 'from track', entry.number);
  }
  function revertTrack(entry) { resetTrack(entry); rebuild(); }

  // ＋ create-button at the right end of the box (before the join), only when the slot is unmatched;
  // and the alias on the resolved bar — only while the slot stays committed (gone the moment you edit)
  function adorn(search, slot, inp) {
    [...search.querySelectorAll('.mk, .tc-bar-aka')].forEach(e => e.remove());
    search.classList.toggle('matched', !!slot.committed);
    const ref = search.querySelector('.tc-joinwrap');
    const aks = _gidAliases.get(slot.gid);
    const aka = slot.committed ? aliasStr({ name: slot.name, aliases: aks || (slot.entity && slot.entity.aliases) || [], primaryAlias: slot.entity && slot.entity.primaryAlias }) : null;
    if (aka) { const al = document.createElement('span'); al.className = 'tc-bar-aka'; al.textContent = '“' + aka + '”'; al.title = aka; search.insertBefore(al, ref); }
    if (!slot.committed) { const mk = document.createElement('button'); mk.className = 'mk'; mk.textContent = '＋'; mk.title = 'create this artist on MusicBrainz'; mk.onmousedown = e => { e.preventDefault(); createArtist(inp.value.trim() || slot.creditedAs, slot); }; search.insertBefore(mk, ref); }
  }
  // the badge column: a pill per artist line, plus a hover overlay with the track ↺/✕ actions
  function renderBadgeCell(cell, track) {
    cell.innerHTML = track.slots.map(s => `<div class="tc-bl">${s.committed ? `<span class="tc-badge ${s.status}">${badgeText(s)}</span>` : ''}</div>`).join('')
      + `<div class="tc-trackacts"><button class="trev" title="revert this track">↺</button><button class="rm" title="remove track">✕</button></div>`;
    cell.querySelector('.trev').onclick = () => revertTrack(track);
    cell.querySelector('.rm').onclick = () => { removeTrack(track); rebuild(); };
  }
  // join phrase: editable text that grows right-to-left, plus a ▾ that opens the presets list
  function joinControl(entry, slot) {
    const wrap = document.createElement('span'); wrap.className = 'tc-joinwrap';
    const inp = document.createElement('input'); inp.className = 'tc-join'; inp.value = slot.joinPhrase || ''; inp.title = 'join phrase to the next artist (editable; ▾ for presets)';
    const fit = () => { inp.size = Math.max(2, inp.value.length || 2); }; fit();
    inp.oninput = fit; inp.onchange = () => { slot.joinPhrase = inp.value; commitTrack(entry); }; enterBlurs(inp);
    const arrow = document.createElement('button'); arrow.className = 'tc-joinarrow'; arrow.textContent = '▾'; arrow.title = 'common join phrases';
    let pop = null; const close = () => { if (pop) { pop.remove(); pop = null; } };
    arrow.onclick = () => {
      if (pop) { close(); return; }
      pop = document.createElement('div'); pop.className = 'tc-acpop tc-joinpop';
      pop.innerHTML = JOIN_OPTIONS.map(o => `<div class="tc-acrow" data-v="${esc(o.value)}"><span class="nm">${esc(o.label)}</span><span class="cmt">"${esc(o.value)}"</span></div>`).join('');
      document.body.appendChild(pop); const r = inp.getBoundingClientRect(); pop.style.left = Math.max(4, r.right - 150) + 'px'; pop.style.top = (r.bottom + 4) + 'px'; pop.style.minWidth = '150px';
      [...pop.querySelectorAll('[data-v]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); inp.value = row.dataset.v; fit(); slot.joinPhrase = inp.value; commitTrack(entry); close(); }; });
      const off = e => { if (pop && !pop.contains(e.target) && e.target !== arrow) { close(); document.removeEventListener('mousedown', off); } }; setTimeout(() => document.addEventListener('mousedown', off), 0);
    };
    wrap.appendChild(inp); wrap.appendChild(arrow);
    return wrap;
  }
  // attach the type-to-search autocomplete to an existing <input>
  function wireAutocomplete(inp, slot, refresh) {
    let pop = null, list = [], hi = -1, seq = 0, onScroll = null;
    const position = () => { if (!pop) return; const r = inp.getBoundingClientRect(); pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 2) + 'px'; pop.style.minWidth = Math.max(210, r.width) + 'px'; };
    const ensure = () => { if (pop) return; pop = document.createElement('div'); pop.className = 'tc-acpop'; document.body.appendChild(pop); onScroll = () => position(); window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll); position(); };
    const close = () => { if (pop) pop.remove(); pop = null; hi = -1; if (onScroll) { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); onScroll = null; } };
    const choose = c => { close(); pickArtist(slot, c); };
    const searching = () => { ensure(); list = []; pop.innerHTML = `<div class="tc-acrow none">Searching…</div>`; position(); };
    const akaHtml = c => { const a = aliasStr(c); return a ? `<span class="tc-aka">“${esc(a)}”</span>` : ''; };
    const draw = arr => {
      ensure(); list = arr; const q = inp.value.trim() || slot.creditedAs;
      pop.innerHTML = arr.length ? arr.map((c, i) => `<div class="tc-acrow${sameName(c.name, q) ? ' exact' : ''}" data-i="${i}"><span class="tic">${typeSvg(c)}</span><span class="nm">${esc(c.name)}</span>${akaHtml(c)}${c.comment ? `<span class="cmt">${esc(c.comment)}</span>` : ''}</div>`).join('') : `<div class="tc-acrow none">no matches — use ＋ to create</div>`;
      [...pop.querySelectorAll('.tc-acrow[data-i]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); choose(arr[+row.dataset.i]); }; });
      position();
    };
    // patch in the full aliases (one WS2 search) without a full redraw, so it doesn't reset the keyboard highlight
    const patchAliases = arr => { if (!pop) return; arr.forEach((c, i) => { const a = aliasStr(c); if (!a) return; const row = pop.querySelector(`.tc-acrow[data-i="${i}"]`); if (!row) return; let sp = row.querySelector('.tc-aka'); if (!sp) { sp = document.createElement('span'); sp.className = 'tc-aka'; const nm = row.querySelector('.nm'); nm.parentNode.insertBefore(sp, nm.nextSibling); } sp.textContent = '“' + a + '”'; }); };
    const showResults = (arr, q) => { draw(arr); fetchAliases(q).then(map => { if (document.activeElement !== inp || !pop) return; arr.forEach(c => { if (map[c.gid] && map[c.gid].length) c.aliases = map[c.gid]; }); patchAliases(arr); }); };
    const runSearch = q => { const my = ++seq; searching(); searchArtist(q).then(res => { if (my === seq && document.activeElement === inp) showResults(res, q); }); };
    // paste an MBID or a MusicBrainz /artist/<mbid> URL → resolve it straight to that artist
    const resolveByGid = async gid => { ++seq; ensure(); list = []; pop.innerHTML = `<div class="tc-acrow none">Resolving…</div>`; position(); const ent = await fetchEntity(gid); if (document.activeElement !== inp) return; if (ent && ent.id) { close(); pickArtist(slot, ent); } else { pop.innerHTML = `<div class="tc-acrow none">MBID not found</div>`; } };
    inp.onfocus = () => {
      inp.select();
      if (slot.committed && slot.candidates && slot.candidates.length) { showResults(slot.candidates, inp.value.trim() || slot.creditedAs || slot.name); return; }
      const q = inp.value.trim() || (slot.creditedAs || '').trim(); if (q) runSearch(q); else close();   // empty → no dropdown
    };
    let tmr; inp.oninput = () => {
      slot.query = inp.value;
      // editing away from the matched artist un-links it: bar goes white, ＋ creates the typed name
      if (slot.committed && !sameName(inp.value, slot.name)) { slot.committed = false; slot.status = 'none'; slot.entity = null; slot.gid = null; commitTrack(slot._entry); if (refresh) refresh(); }
      clearTimeout(tmr);
      const gid = mbidFrom(inp.value); if (gid) { resolveByGid(gid); return; }   // pasted an MBID / artist URL
      if (!inp.value.trim()) { close(); return; }   // nothing typed → don't search
      searching(); const my = ++seq; tmr = setTimeout(async () => { const res = await searchArtist(inp.value); if (my === seq && document.activeElement === inp) showResults(res, inp.value); }, 250);
    };
    // arrows browse the results popup WHILE searching; once the slot is resolved they move row-to-row instead
    const browsing = () => pop && !slot.committed && list.length;
    inp.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); inp.focus(); }   // close the popup but keep the field focused, so the next ↓ navigates rows
      else if (e.key === 'ArrowDown') { if (browsing()) { hi = Math.min(list.length - 1, hi + 1); [...pop.querySelectorAll('[data-i]')].forEach((r, i) => r.classList.toggle('hi', i === hi)); e.preventDefault(); } else { close(); if (focusSameField(inp, 1)) e.preventDefault(); } }
      else if (e.key === 'ArrowUp') { if (browsing()) { hi = Math.max(0, hi - 1); [...pop.querySelectorAll('[data-i]')].forEach((r, i) => r.classList.toggle('hi', i === hi)); e.preventDefault(); } else { close(); if (focusSameField(inp, -1)) e.preventDefault(); } }
      else if (e.key === 'Enter') { e.preventDefault(); const c = list[hi >= 0 ? hi : 0]; if (c) choose(c); }
    };
    inp.onblur = () => setTimeout(close, 160);   // keep whatever the user typed (no reset)
  }

  // one artist = one aligned line: [credited-as][icon][green/white search bar][join][↵ hover][✕ hover]
  function slotEl(entry, s, idx, refreshBadges) {
    const line = document.createElement('div'); line.className = 'tc-aslot';
    // credited-as: shown empty when it's exactly the artist name (the name is the placeholder); only a real override shows
    const same = s.name && s.creditedAs === s.name;
    const cred = document.createElement('input'); cred.className = 'tc-cred'; cred.value = (s.creditedAs && !same) ? s.creditedAs : ''; cred.placeholder = s.name || 'credit…'; cred.title = 'credited-as override (blank = same as the artist name)';
    cred.onchange = () => {
      const v = cred.value.trim(); const newCred = v || (s.name || ''); const oldKey = fold(s.creditedAs);
      s.creditedAs = newCred; if (s.creditedAs === s.name) cred.value = ''; commitTrack(entry);
      // in "all" mode, copy the credited-as change to every other track that shared this credit
      if ((SETTINGS.applyMode || 'all') === 'all' && oldKey) {
        const touched = new Set();
        MODEL.tracks.forEach(t => t.slots.forEach(os => { if (os === s || fold(os.creditedAs) !== oldKey) return; os.creditedAs = newCred; touched.add(os._entry); }));
        touched.forEach(commitTrack);
        if (touched.size) { Log.info('propagated credited-as', JSON.stringify(newCred), '→', touched.size, 'track(s)'); rerender(); toast(`credited-as — also set on ${touched.size} other track${touched.size > 1 ? 's' : ''}`); }
      }
    }; enterBlurs(cred); wireRowNav(cred); line.appendChild(cred);
    const ic = document.createElement(s.gid ? 'a' : 'span'); ic.className = 'tc-tic ' + (s.gid ? 'link' : 'dim'); ic.innerHTML = typeSvg(s.entity);
    if (s.gid) { ic.href = `${ORIGIN}/artist/${s.gid}`; ic.target = '_blank'; ic.rel = 'noopener'; ic.title = 'open artist page'; } else ic.title = 'no artist linked yet';
    line.appendChild(ic);
    const search = document.createElement('span'); search.className = 'tc-search';
    const inp = document.createElement('input'); inp.className = 'nm'; inp.value = s.committed ? (s.name || s.creditedAs) : (s.query || s.creditedAs || ''); inp.placeholder = 'search artist…'; inp.title = inp.value;
    search.appendChild(inp);
    if (idx < entry.slots.length - 1) search.appendChild(joinControl(entry, s));   // join lives inside the box, right side
    adorn(search, s, inp); if (s._marked) search.classList.add('tc-marked'); if (s._flash) { search.classList.add('tc-flash'); delete s._flash; } line.appendChild(search);
    wireAutocomplete(inp, s, () => { adorn(search, s, inp); refreshBadges(); refreshStatus(); });
    // fixed-width actions area (keeps all search boxes the same width); both reveal on row hover
    const acts = document.createElement('span'); acts.className = 'tc-acts';
    const add = document.createElement('button'); add.className = 'tc-enter'; add.textContent = '↵'; add.title = 'add another artist to this credit'; add.onclick = () => addSlotAfter(entry, idx); acts.appendChild(add);
    if (entry.slots.length > 1) { const x = document.createElement('button'); x.className = 'tc-slotx'; x.textContent = '✕'; x.title = 'remove this artist'; x.onclick = () => removeSlot(entry, idx); acts.appendChild(x); }
    line.appendChild(acts);
    return line;
  }
  function fillRows(tbody, mi) {
    tbody.innerHTML = ''; let lastMi = -1; const multi = mediums().length > 1 && mi == null;
    const tracks = (mi == null) ? MODEL.tracks : MODEL.tracks.filter(t => t.mi === mi);
    tracks.forEach(t => {
      if (multi && t.mi !== lastMi) { const r = document.createElement('tr'); r.innerHTML = `<td class="tc-medhdr" colspan="${COLS.length}">Medium ${t.mi + 1}</td>`; tbody.appendChild(r); lastMi = t.mi; }
      const tr = document.createElement('tr'); tr.dataset.tk = t.mi + ':' + t.ti;
      tr.innerHTML = `<td class="c-mv"><span class="mv up" title="move up">▲</span><span class="mv dn" title="move down">▼</span></td>
        <td class="c-num"><input class="t-num" value="${esc(t.number)}" title="track number"></td>
        <td class="c-title"><div class="t-wrap"><input class="t-title" value="${esc(t.title)}"></div></td>
        <td class="c-art"></td>
        <td class="c-len"><input class="t-len" value="${esc(t.length)}"></td>
        <td class="c-badge"></td>`;
      const badgeCell = tr.querySelector('.c-badge'); const refreshBadges = () => renderBadgeCell(badgeCell, t);
      const art = tr.querySelector('.c-art'); t.slots.forEach((s, si) => art.appendChild(slotEl(t, s, si, refreshBadges)));
      refreshBadges();
      // guess-case: highlight when the title differs from its guessed form; a per-title button applies it
      const tin = tr.querySelector('.t-title'); const diff = t.guessTitle && t.guessTitle !== t.title;
      if (t._srFlash) { tin.classList.add('srflash'); delete t._srFlash; }   // flash titles changed by search & replace
      if (diff) {
        tin.classList.add('diff'); tin.title = 'Guess case → ' + t.guessTitle;
        const gb = document.createElement('button'); gb.className = 't-gc'; gb.textContent = 'Aa'; gb.title = 'Guess case → ' + t.guessTitle;
        const wrap = tr.querySelector('.t-wrap');
        // like MB's integrated guess case: hovering the title cell previews the guessed name
        // (highlighted), leaving restores it, clicking Aa applies it. Never preview while editing.
        const preview = () => { if (document.activeElement !== tin) { tin.value = t.guessTitle; tin.classList.add('gcpreview'); } };
        const restore = () => { tin.value = t.title; tin.classList.remove('gcpreview'); };
        wrap.onmouseenter = preview; wrap.onmouseleave = () => { if (document.activeElement !== tin) restore(); };
        tin.addEventListener('focus', restore);   // clicking in to edit shows the real title, not the preview
        gb.onclick = () => { restore(); applyGuessTitle(t); t.title = u(koTrack(t.mi, t.ti).name); t.guessTitle = guessTitleStr(t); rerender(); };
        wrap.appendChild(gb);
      }
      tin.onchange = e => { setTitle(t, e.target.value); t.title = e.target.value; t.guessTitle = guessTitleStr(t); rerender(); }; enterBlurs(tin); wireRowNav(tin);
      const numIn = tr.querySelector('.t-num'), lenIn = tr.querySelector('.t-len');
      numIn.onchange = e => setNumber(t, e.target.value); enterBlurs(numIn); wireRowNav(numIn);
      lenIn.onchange = e => setLength(t, e.target.value); enterBlurs(lenIn); wireRowNav(lenIn);
      tr.querySelector('.up').onclick = () => { moveTrack(t, -1); rebuild(); };
      tr.querySelector('.dn').onclick = () => { moveTrack(t, +1); rebuild(); };
      tbody.appendChild(tr);
    });
  }
  async function loadAndRender(onProgress) {
    MODEL = buildShell();
    if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); }   // (re)build per-medium tables + hide/tidy native
    rerender();   // show the tables instantly
    if (SETTINGS.autoMatch !== false) await matchModel(onProgress); else updateStatus('auto-match off — click Match');
    enrichResolvedAliases();   // batch-fetch aliases for resolved artists (existing releases too)
  }
  async function rebuild() {
    MODEL = buildShell();
    if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); }
    rerender();
    if (SETTINGS.autoMatch !== false) await matchModel();
    enrichResolvedAliases();
  }
  function revertAll() { if (!MODEL) return; if (!W.confirm("Revert every track's artist to what it was when the page loaded?")) return; MODEL.tracks.forEach(resetTrack); rebuild(); }
  function guessCaseAll() { if (!MODEL) return; MODEL.tracks.forEach(t => { applyGuessTitle(t); t.title = u(koTrack(t.mi, t.ti).name); t.guessTitle = guessTitleStr(t); }); rerender(); Log.info('guess case → all titles'); }
  // integrated MB feature: pull "feat. X" out of titles into artist credits, then re-read + re-match
  async function guessFeatAll() {
    const ed = getEditor();
    mediums().forEach(med => (u(med.tracks) || []).forEach(t => { try { ed.guessTrackFeatArtists(t); } catch (e) { try { ed.guessTrackFeatArtists(t, { type: 'click' }); } catch (e2) { Log.warn('guess feat failed', e2.message); } } }));
    await loadAndRender(); Log.info('guessed feat artists from titles');
  }
  // medium-scoped tools — each acts on one medium (chosen via the inline medium combo)
  async function swapMedium(mi) { const ed = getEditor(), m = mediums()[mi]; if (!m) return; _selfEdit = true; try { ed.swapTitlesWithArtists(m); } catch (e) { Log.warn('swap failed', e.message); } finally { _selfEdit = false; } await loadAndRender(); Log.info('swapped titles ↔ artists on medium', mi + 1); }
  function resetNumbers(mi) { const ed = getEditor(), m = mediums()[mi]; if (!m) return; _selfEdit = true; try { ed.resetTrackNumbers(m); } catch (e) { Log.warn('reset numbers failed', e.message); } finally { _selfEdit = false; } rebuild(); }
  function openParser(mi) { const ed = getEditor(), m = mediums()[mi]; if (!m) return; try { ed.openTrackParser(m); } catch (e) { Log.warn('open parser failed', e.message); } }
  function runMediumTool(act, mi) { if (act === 'parser') openParser(mi); else if (act === 'resetnum') resetNumbers(mi); else if (act === 'swap') swapMedium(mi); }
  function runAction(a) {
    if (a === 'match') matchAll();
    else if (a === 'revert') revertAll();
    else if (a === 'guesscase') guessCaseAll();
    else if (a === 'guessfeat') guessFeatAll();
    else if (MEDIUM_TOOLS.has(a)) runMediumTool(a, 0);
  }
  function bindActions(host) {
    host.querySelectorAll('[data-act]').forEach(b => {
      const a = b.dataset.act;
      b.onclick = () => { if (a === 'menu') openToolsMenu(b); else if (a === 'tool') runActiveTool(); else if (a === 'gear') openSettings(b); else if (a === 'close') { host.remove(); ACTIVE = {}; } else runAction(a); };
    });
  }

  /* ── the Tools split-button: last-used tool is the button's label + default action; ▾ picks another ── */
  const MENU = [{ act: 'parser', label: 'Track parser' }, { act: 'swap', label: 'Swap' }, { act: 'resetnum', label: 'Reset #' }, { sep: 1 }, { act: 'guessfeat', label: 'Guess feat.' }, { act: 'guesscase', label: 'Guess case' }, { act: 'sr', label: 'Search and Replace' }];
  const LABELS = Object.fromEntries(MENU.filter(m => !m.sep).map(m => [m.act, m.label]));
  const MEDIUM_TOOLS = new Set(['parser', 'resetnum', 'swap']);   // act on ONE medium (inline medium combo when >1)
  const OPTLESS = new Set(['guessfeat']);   // global, no options — fires on pick
  let _toolMedium = 0;   // the medium chosen in the inline combo — shared across all medium-scoped tools
  const toolMedium = () => Math.min(Math.max(0, _toolMedium), mediums().length - 1);
  function toolBtnEl() { return document.querySelector('#tc-bar [data-act="tool"], #tc-hdr [data-act="tool"]'); }
  function updateToolBtn() { const b = toolBtnEl(); if (b) b.textContent = SETTINGS.lastTool ? (LABELS[SETTINGS.lastTool] || 'Tools') : 'Tools'; }
  // hovering the "Guess case" tool button previews the guessed form on every differing title
  function previewAllGuess(on) {
    if (!MODEL) return;
    MODEL.tracks.forEach(t => {
      if (!(t.guessTitle && t.guessTitle !== t.title)) return;
      const row = rowEl(t.mi, t.ti); if (!row) return;
      const tin = row.querySelector('.t-title'); if (!tin || document.activeElement === tin) return;
      if (on) { tin.value = t.guessTitle; tin.classList.add('gcpreview'); } else { tin.value = t.title; tin.classList.remove('gcpreview'); }
    });
  }
  function wireToolHover() { const b = toolBtnEl(); if (!b) return; b.onmouseenter = b.onmouseleave = null; if (SETTINGS.lastTool === 'guesscase') { b.onmouseenter = () => previewAllGuess(true); b.onmouseleave = () => previewAllGuess(false); } }
  function runActiveTool() {
    const act = SETTINGS.lastTool;
    if (!act) return openToolsMenu(toolBtnEl());
    // clicking "Search and Replace" starts a fresh session: clear the fields and re-snapshot (prior replaces stay applied)
    if (act === 'sr') { const f = document.querySelector('.tc-toolopts .tc-sr-find'), r = document.querySelector('.tc-toolopts .tc-sr-rep'); if (f) f.value = ''; if (r) r.value = ''; srActivate(); MODEL && MODEL.tracks.forEach(t => { delete t._srFlash; }); rerender(); if (f) f.focus(); return; }
    if (MEDIUM_TOOLS.has(act)) return runMediumTool(act, toolMedium());
    runAction(act);
  }
  function pickTool(act) {
    SETTINGS.lastTool = act; saveSettings(); updateToolBtn(); renderToolOpts(); wireToolHover();
    if (MEDIUM_TOOLS.has(act)) { if (mediums().length <= 1) runMediumTool(act, 0); }   // single medium → run now (no combo); multi → choose via the inline medium combo (shared across tools), then the Tools button
    else if (OPTLESS.has(act)) runAction(act);   // global option-less tools fire immediately
    else if (act === 'sr') { const f = document.querySelector('.tc-toolopts .tc-sr-find'); if (f) f.focus(); }
  }
  function openToolsMenu(anchor) {
    let m = document.getElementById('tc-menu'); if (m) { m.remove(); return; }
    m = document.createElement('div'); m.id = 'tc-menu'; m.className = 'tc-menu';
    m.innerHTML = MENU.map(it => it.sep ? '<div class="tc-sep"></div>' : `<div class="tc-mi" data-act="${it.act}">${it.label}</div>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.min(r.left, window.innerWidth - 190) + 'px'; m.style.top = (r.bottom + 4) + 'px';
    m.querySelectorAll('.tc-mi').forEach(el => el.onclick = () => { m.remove(); pickTool(el.dataset.act); });
    const off = e => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off); } }; setTimeout(() => document.addEventListener('mousedown', off), 0);
  }
  // render the active tool's inline options to the right of the Tools button (if it has any)
  function renderToolOpts() {
    const host = document.querySelector('.tc-toolopts'); if (!host) return; host.innerHTML = '';
    const act = SETTINGS.lastTool;
    if (act === 'guesscase') {
      const g = gcNative(); const box = document.createElement('span'); box.className = 'tc-gco';
      if (g && g.lang) { const sel = g.lang.cloneNode(true); sel.className = 'tc-gc-lang'; sel.value = g.lang.value; sel.title = 'Guess Case language'; sel.onchange = () => { setNative(g.lang, sel.value); recomputeGuesses(); }; box.appendChild(sel); }
      const mkChk = (text, el) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = el ? el.checked : false; c.disabled = !el; c.onchange = () => { setNative(el, c.checked); recomputeGuesses(); }; l.append(c, document.createTextNode(' ' + text)); return l; };
      if (g) { box.appendChild(mkChk('Keep uppercased', g.keepUC)); box.appendChild(mkChk('Uppercase Roman numerals', g.roman)); }
      host.appendChild(box);
    } else if (act === 'sr') {
      srActivate(); const box = document.createElement('span'); box.className = 'tc-sro';
      const find = document.createElement('input'); find.type = 'text'; find.className = 'tc-sr-find'; find.placeholder = 'search';
      const rep = document.createElement('input'); rep.type = 'text'; rep.className = 'tc-sr-rep'; rep.placeholder = 'replace';
      const run = () => srLive(find.value, rep.value, true);
      find.oninput = rep.oninput = run;
      box.append(find, rep); host.appendChild(box);
    } else if (MEDIUM_TOOLS.has(act) && mediums().length > 1) {
      // which medium this tool acts on (only shown when there's more than one); the choice is shared
      // across all medium-scoped tools and the Tools button runs it
      const sel = document.createElement('select'); sel.className = 'tc-medsel'; sel.title = 'which medium';
      mediums().forEach((m, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = 'Medium ' + (i + 1); sel.appendChild(o); });
      sel.value = String(toolMedium()); sel.onchange = () => { _toolMedium = parseInt(sel.value, 10) || 0; };
      host.appendChild(sel);
    }
  }
  function initTools() { updateToolBtn(); renderToolOpts(); wireToolHover(); }

  // proxy MusicBrainz's own (hidden) Guess-case options so they actually affect its guessing
  function gcNative() {
    const fs = document.querySelector('fieldset.guesscase, .guesscase'); if (!fs) return null;
    const lang = fs.querySelector('select'); const checks = [...fs.querySelectorAll('input[type=checkbox]')];
    const txt = c => ((c.closest('label') || {}).textContent || '').toLowerCase();
    const keepUC = checks.find(c => txt(c).includes('keep') && txt(c).includes('uppercas')) || checks.find(c => txt(c).includes('keep')) || checks[0] || null;
    const roman = checks.find(c => txt(c).includes('roman')) || checks[1] || null;
    return { lang, keepUC, roman };
  }
  function setNative(el, val) { if (!el) return; if (el.tagName === 'SELECT') el.value = val; else el.checked = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
  function recomputeGuesses() { if (!MODEL) return; MODEL.tracks.forEach(t => { t.guessTitle = guessTitleStr(t); }); rerender(); }

  // search & replace in titles — real-time, recomputed from a snapshot each keystroke (no apply, non-compounding)
  function srRe(find, ci, g) { const e = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(e, (g ? 'g' : '') + (ci ? 'i' : '')); }
  let _srSnap = null;
  function srActivate() { _srSnap = MODEL ? MODEL.tracks.map(t => t.title) : []; }
  function srLive(find, replace, ci) {
    if (!MODEL) return; if (!_srSnap || _srSnap.length !== MODEL.tracks.length) srActivate(); let changed = 0;
    MODEL.tracks.forEach((t, i) => {
      const base = _srSnap[i] != null ? _srSnap[i] : t.title;
      const nt = find ? base.replace(srRe(find, ci, true), replace) : base;
      if (nt !== base) changed++;
      if (nt !== t.title) { setTitle(t, nt); t.title = nt; t.guessTitle = guessTitleStr(t); }
      t._srFlash = !!(find && nt !== base);
    });
    rerender(); toast(changed ? `${changed} title${changed !== 1 ? 's' : ''} replaced` : '');
  }

  const BAR = `<div class="tc-tools"><div class="tc-split"><button class="tc-btn" data-act="tool" title="run the selected tool">Tools</button><button class="tc-btn tc-caret" data-act="menu" title="choose a tool">▾</button></div><span class="tc-toolopts"></span></div>`
    + `<span class="sp"></span><span class="tc-toast"></span><span class="sp"></span><button class="tc-btn primary" data-act="match" title="search MusicBrainz for the unmatched artists">Match</button>`
    + `<button class="tc-btn" data-act="revert">Revert all</button><button class="tc-btn" data-act="gear" title="settings">⚙</button>`;

  /* ── floating window (kept for tests; the in-page table is the real UI) ── */
  function openPanel() {
    style(); const ex = document.getElementById('tc-panel'); if (ex) ex.remove(); const l = document.getElementById('tc-launch'); if (l) l.remove();
    const p = document.createElement('div'); p.id = 'tc-panel';
    p.innerHTML = `<div id="tc-hdr">${ICON}<b>Track Cannon</b><span class="sp"></span>${BAR}<button class="tc-icon" data-act="close" title="close">✕</button></div>
      <div id="tc-body"></div>`;
    document.body.appendChild(p);
    const tbody = mountTable(p.querySelector('#tc-body'));
    ACTIVE = { mode: 'float', tbody, statusEl: p.querySelector('.tc-hstatus') };
    const hdr = p.querySelector('#tc-hdr');
    hdr.onmousedown = e => { if (e.target.closest('button')) return; const r = p.getBoundingClientRect(); const ox = e.clientX - r.left, oy = e.clientY - r.top; p.style.right = 'auto'; const mm = ev => { p.style.left = Math.max(0, ev.clientX - ox) + 'px'; p.style.top = Math.max(0, ev.clientY - oy) + 'px'; }; const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); };
    bindActions(p); initTools();
    loadAndRender((d, n) => updateStatus(`matching ${d}/${n}…`));
  }

  /* ── in-page replacement (the only mode) ── */
  let _showOriginal = false;
  function nativeTrackTables() { return [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track')); }
  // the native tracklist = track tables + the #tracklist-tools row + the Guess-case fieldset + the
  // miscapitalization warnings; hide/show together (the format header is lifted out, not hidden)
  function nativeBits() {
    // every medium has its own tools row (MB reuses the id "tracklist-tools" — querySelectorAll gets them all);
    // hide native track tables by class too so an empty medium's header row doesn't linger
    return [...nativeTrackTables(), ...document.querySelectorAll('table.medium, [id="tracklist-tools"], fieldset.guesscase, .guesscase, fieldset.advanced-medium .warning')];
  }
  function setNativeHidden(hidden) { nativeBits().forEach(el => { el.style.display = hidden ? 'none' : ''; }); }
  // mount one Canon section (its own table header + Add footer) per medium, placed right before that
  // medium's native track table — so MB's own format header stays naturally above it. Reconciled on
  // every render so adding/removing a medium just works. Native collapse toggle hides our section too.
  function mountMediums() {
    document.querySelectorAll('#tc-mirror-wrap-sec, .tc-medsec').forEach(s => s.remove());
    ACTIVE.sections = [];
    const fsList = document.querySelectorAll('fieldset.advanced-medium');
    mediums().forEach((med, mi) => {
      const fs = fsList[mi]; if (!fs) return;
      const trackTbl = nativeTrackTables().find(t => fs.contains(t)) || fs.querySelector('table.medium');
      const sec = document.createElement('div'); sec.className = 'tc-medsec'; sec.dataset.mi = mi;
      const tbody = mountTable(sec, mi);
      if (trackTbl && trackTbl.parentElement) trackTbl.parentElement.insertBefore(sec, trackTbl); else fs.appendChild(sec);
      ACTIVE.sections.push({ mi, tbody, sec });
      // native ▼ collapse hides our section too — subscribe once per medium; the fresh section reads current state
      if (med.collapsed) {
        if (med.collapsed.subscribe && !med._tcColSub) { med._tcColSub = true; med.collapsed.subscribe(() => { const s = document.querySelector(`.tc-medsec[data-mi="${mi}"]`); if (s) s.style.display = u(med.collapsed) ? 'none' : ''; }); }
        sec.style.display = u(med.collapsed) ? 'none' : '';
      }
    });
  }
  // tidy the format header to a minimal look — but ONLY once a format is chosen. With no format the
  // full native header stays (Format: label, real combo, I don't know, help, error) so the user is
  // still prompted to pick one. Move-up/down/remove buttons stay visible either way.
  function setFmtTidy(tbl, on) {
    const fmt = tbl.querySelector('[id^="medium-format"]'); if (!fmt) return;
    fmt.classList.toggle('tc-fmt-flat', on);
    const lbl = tbl.querySelector('td.format > label[for^="medium-format"]'); if (lbl) lbl.style.display = on ? 'none' : '';
    const help = tbl.querySelector('td.format a');
    if (help) {
      help.style.display = on ? 'none' : '';
      [help.previousSibling, help.nextSibling].forEach(n => { if (!n || n.nodeType !== 3) return; if (on) { if (!('_tcv' in n) && /[()]/.test(n.nodeValue)) n._tcv = n.nodeValue; if ('_tcv' in n) n.nodeValue = ''; } else if ('_tcv' in n) { n.nodeValue = n._tcv; delete n._tcv; } });   // the "( )" around (help)
    }
    const idk = tbl.querySelector('td.format input[type=checkbox]'); const idkLbl = idk ? idk.closest('label') : null; if (idkLbl) idkLbl.style.display = on ? 'none' : '';
  }
  function tidyFmt(tbl) {
    const fmt = tbl.querySelector('[id^="medium-format"]'); if (!fmt) return;
    const apply = () => setFmtTidy(tbl, fmt.value !== '');   // minimise only when a format is selected
    if (!fmt._tcApply) { fmt._tcApply = apply; fmt.addEventListener('change', apply); }
    apply();
  }
  function tidyMediums() { document.querySelectorAll('table.advanced-format').forEach(tidyFmt); }
  function untidyMediums() { document.querySelectorAll('table.advanced-format').forEach(t => setFmtTidy(t, false)); }
  function syncNative() { setNativeHidden(!_showOriginal); if (_showOriginal) untidyMediums(); else tidyMediums(); }
  // watch the live tracklist so Track parser (or any native structural change) refreshes our table
  let _subscribed = false, _syncTimer = null;
  function scheduleSync() { clearTimeout(_syncTimer); _syncTimer = setTimeout(() => { if (document.getElementById('tc-mirror-wrap')) loadAndRender(); }, 400); }
  function subscribeTracks() {
    const rel = release(); if (!rel) return;
    const subMed = med => { if (!med || med._tcSub) return; if (med.tracks && med.tracks.subscribe) { med.tracks.subscribe(() => { if (!_selfEdit) scheduleSync(); }); med._tcSub = true; } };
    try {
      (u(rel.mediums) || []).forEach(subMed);
      // watch the mediums list itself so adding/removing a medium re-renders + re-hides the new native bits
      if (!_subscribed && rel.mediums && rel.mediums.subscribe) { rel.mediums.subscribe(() => { if (!_selfEdit) { (u(rel.mediums) || []).forEach(subMed); scheduleSync(); } }); }
      _subscribed = true; Log.info('watching tracklist + mediums for external changes');
    } catch (e) { Log.warn('subscribe failed', e.message); }
  }
  async function showMirror() {
    style(); let wrap = document.getElementById('tc-mirror-wrap');
    if (wrap) { syncNative(); return; }
    // the global toolbar sits once at the very top of the Tracklist panel; per-medium tables mount below
    wrap = document.createElement('div'); wrap.id = 'tc-mirror-wrap';
    const firstFs = document.querySelector('fieldset.advanced-medium');
    if (firstFs && firstFs.parentElement) firstFs.parentElement.insertBefore(wrap, firstFs);
    else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(wrap);
    wrap.innerHTML = `<div id="tc-bar">${BAR}</div>`;
    ACTIVE = { mode: 'mirror', sections: [] };
    bindActions(wrap); initTools(); subscribeTracks();
    await loadAndRender((d, n) => updateStatus(`matching ${d}/${n}…`));
  }
  function hideMirror() { untidyMediums(); document.querySelectorAll('.tc-medsec').forEach(s => s.remove()); const w = document.getElementById('tc-mirror-wrap'); if (w) w.remove(); setNativeHidden(false); if (ACTIVE.mode === 'mirror') ACTIVE = {}; }

  /* ── entry points ── */
  function ensureLauncher() {
    if (document.getElementById('tc-launch')) return;
    style(); const b = document.createElement('button'); b.id = 'tc-launch'; b.title = 'toggle Track Cannon / original editor';
    const relabel = () => { b.textContent = document.getElementById('tc-mirror-wrap') ? 'Original' : 'Track Cannon'; };
    b.onclick = () => { if (document.getElementById('tc-mirror-wrap')) hideMirror(); else showMirror(); relabel(); };
    document.body.appendChild(b); relabel();
  }
  function tracklistVisible() { const p = document.getElementById('tracklist'); return !!(p && p.offsetParent !== null); }   // the Tracklist tab panel is shown
  let _tlPrev = false, _tlRefreshed = false;
  function onEnterTracklist() {
    if (!document.getElementById('tc-mirror-wrap')) showMirror();
    else if (!_tlRefreshed) { _tlRefreshed = true; loadAndRender(); }   // re-match once the tab is up (RG may have been set)
    ensureLauncher();
  }
  function watchTracklist() {
    const tick = () => {
      const vis = tracklistVisible();
      if (document.getElementById('tc-mirror-wrap')) syncNative();   // keep the native bits in their chosen state if MB re-renders
      if (vis && !_tlPrev) { _tlPrev = true; Log.info('entered Tracklist tab'); onEnterTracklist(); } else if (!vis && _tlPrev) { _tlPrev = false; const l = document.getElementById('tc-launch'); if (l) l.remove(); }
    };
    tick(); setInterval(tick, 500);
  }

  W.__trackCannon = { readTracklist, buildModel, commitTrack, resetTrack, removeTrack, moveTrack, addTracks, searchArtist, fetchEntity, createArtist, openPanel, showMirror, hideMirror, revertAll, revertSlot, pickArtist, addSlot, removeSlot, snapshotOriginals, get model() { return MODEL; }, get settings() { return SETTINGS; } };

  (async function main() {
    if (handleArtistPageCallback()) { Log.info('artist-create callback — posting MBID back and closing'); return; }
    if (!/^\/release\/(add|.+\/edit)/.test(location.pathname)) return;   // /artist/* (non-callback) just loads the channel listener
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready');
    snapshotOriginals();
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    showMirror();   // always take over the tracklist immediately (no flash)
    watchTracklist();
  })();
})();
