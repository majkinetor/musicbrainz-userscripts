// ==UserScript==
// @name         Apollo Editor
// @namespace    https://musicbrainz.org/
// @version      2026.6.6.045000
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Same table whether floating or replacing the integrated tracklist.
// @author       majkinetor
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M13 22 L19 22 L16 30 Z' fill='%23ff8c3b'/%3E%3Cpath d='M14.4 22 L17.6 22 L16 27 Z' fill='%23ffd24a'/%3E%3Cpath d='M12 18 L8 23.5 L12 22 Z' fill='%233d2470'/%3E%3Cpath d='M20 18 L24 23.5 L20 22 Z' fill='%233d2470'/%3E%3Cpath d='M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z' fill='%235f3ec0'/%3E%3Ccircle cx='16' cy='12.5' r='3' fill='%23cfe8ff' stroke='%232a1a52' stroke-width='1'/%3E%3C/svg%3E
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
// @match        https://*.musicbrainz.org/release/add*
// @match        https://*.musicbrainz.org/release/*/edit
// @match        https://*.musicbrainz.org/artist/*
// @grant        GM_xmlhttpRequest
// @connect      *
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
  const TAG = '[ApolloEditor]';
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
  const ART_CHANNEL = ('BroadcastChannel' in W) ? new W.BroadcastChannel('apollo-editor-artist') : null;
  const PENDING_KEY = 'apolloEditor.pendingArtist';
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
  const SKEY = 'apolloEditor.settings.v1';
  function loadSettings() { const d = { apolloEnabled: true, colWidths: {}, applyMode: 'all', altRows: false, gridCols: false, gridRows: true, replaceReleaseInfo: true, replaceTracklist: true, replaceRecordings: true, autoMatch: false, autoMatchRec: false, recLenTol: 5, recIgnoreCase: true, recIgnorePunct: true, recTitleTol: 1, recCutoff: 'near', lastTool: '', layout: 'normal', lastView: 'apollo' }; try { const stored = JSON.parse(localStorage.getItem(SKEY) || '{}'); const s = Object.assign(d, stored); if (stored.gridCols === undefined && stored.grid !== undefined) s.gridCols = stored.grid; return s; } catch (e) { return d; } }
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
  const snapTrack = t => ({
    title: u(t.name) || '', number: u(t.number), length: u(t.formattedLength) || '',
    names: liveNames(t).map(n => ({ artist: u(n.artist) || { name: u(n.name) || '' }, creditedAs: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '' })),
  });
  function snapshotOriginals() {
    ORIGINALS.clear();
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => ORIGINALS.set(mi + ':' + ti, snapTrack(t))));
    Log.info('snapshot of', ORIGINALS.size, 'original tracks');
  }
  // MB lazy-loads each medium's tracks asynchronously, so the startup snapshot misses mediums that
  // hadn't loaded yet. Capture the page-load state of any track that appears later — before matching
  // writes to it — so change-tracking (the ↺ button + the changed-row border) works on every medium.
  function snapshotMissing() {
    let added = 0;
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => { const k = mi + ':' + ti; if (!ORIGINALS.has(k)) { ORIGINALS.set(k, snapTrack(t)); added++; } }));
    if (added) Log.info('snapshot +', added, 'newly loaded original track(s) →', ORIGINALS.size, 'total');
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
      // return the WHOLE entity (like a search hit) so the credit write-back has every field it needs
      if (j && j.gid) { if (!j.entityType) j.entityType = 'artist'; return j; } }
    catch (e) { Log.warn('fetch entity failed', gid, e.message); }
    return null;
  }
  async function searchArtist(name, limit) {
    limit = limit || 8;
    const k = fold(name) + '|' + limit; if (!fold(name)) return [];
    if (_cache.has(k)) return _cache.get(k);
    let list = [];
    try { const j = await fetch(`${ORIGIN}/ws/js/artist?q=${encodeURIComponent(name)}&limit=${limit}&direct=false`, { headers: { Accept: 'application/json' } }).then(r => r.json()); list = Array.isArray(j) ? j : (j.results || []); }
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
  // re-run adorn for every rendered slot (adds/updates the alias span) WITHOUT rebuilding rows — so it
  // can't steal focus or detach the slot an in-flight edit is using
  function refreshAdorns() {
    if (!MODEL) return;
    MODEL.tracks.forEach(t => { const row = rowEl(t.mi, t.ti); if (!row) return; const searches = row.querySelectorAll('.tc-search'); t.slots.forEach((s, i) => { const search = searches[i]; if (search) adorn(search, s, search.querySelector('.nm')); }); });
  }
  // batch-fetch aliases for every committed artist we don't have yet, then refresh the bars in place
  async function enrichResolvedAliases() {
    if (!MODEL) return;
    const need = []; MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s.committed && s.gid && !_gidAliases.has(s.gid)) need.push(s.gid); }));
    if (!need.length) return;
    await fetchAliasesByGids(need);
    refreshAdorns();
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
      // the sibling release names the EXACT artist (gid) — use it. Prefer a search hit (richer data), but
      // if the gid isn't in the results (ambiguous/duplicate name like "Eva", or a case-only difference
      // vs the recording artist), resolve the gid directly so the RG match never gets lost.
      let hit = candidates.find(c => c.gid === sib.gid) || (await fetchEntity(sib.gid));
      if (hit && hit.gid) { entity = hit; source = 'rg'; confidence = 'high'; }
    }
    if (!entity) {
      const top = candidates[0] || null;
      if (!top) return { entity: null, source: 'none', confidence: 'none', candidates: [] };
      entity = top;
      // an exact name match is only high-confidence (and auto-committed) when it's UNAMBIGUOUS — when
      // several artists share that exact name (e.g. three "Dansu"), there's no way to know which is
      // right, so leave it 'low' for the user to pick rather than confidently linking the first.
      const exact = candidates.filter(c => sameName(c.name, creditedAs));
      confidence = (sameName(top.name, creditedAs) && exact.length === 1) ? 'high' : 'low';
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
    snapshotMissing();   // capture page-load state for any lazily-loaded medium before matching touches it
    // a rebuild re-reads the live model, where every linked artist looks identical — so without this we'd
    // collapse all match badges (rg / name / user) back to "set". Carry the match source forward by gid.
    const prevStatus = new Map();
    if (MODEL && MODEL.tracks) MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s.gid && s.committed && s.status && s.status !== 'set') prevStatus.set(s.gid, { status: s.status, entity: s.entity, candidates: s.candidates }); }));
    const tracks = readTracklist().map(t => {
      const slots = t.names.map(n => {
        if (!n.artistGid) return { creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'none', entity: null, gid: null, name: '', candidates: [], committed: false, _pending: true };
        const carry = prevStatus.get(n.artistGid);   // preserve rg / name / user across the rebuild; genuine page-load links stay "set"
        return { creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: carry ? carry.status : 'set', entity: carry ? carry.entity : null, gid: n.artistGid, name: n.artistName, candidates: carry ? (carry.candidates || []) : [], committed: true };
      });
      const te = { mi: t.mi, ti: t.ti, number: t.number, title: t.title, length: t.length, slots };
      te.slots.forEach(s => { s._entry = te; }); te.guessTitle = guessTitleStr(te);
      return te;
    });
    return { tracks };
  }
  // match the _pending slots, updating the table row-by-row as results come in
  async function matchModel(onProgress) {
    const isEditing = isEditingNow;   // don't rebuild rows (and orphan the search popup) while the user is in a field
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
  // has this track changed from its page-load state (title/#/length or any artist credit)?
  function trackChanged(entry) {
    const orig = ORIGINALS.get(entry.mi + ':' + entry.ti); if (!orig) return false;
    const t = koTrack(entry.mi, entry.ti);
    if ((u(t.name) || '') !== orig.title || String(u(t.number)) !== String(orig.number) || (u(t.formattedLength) || '') !== orig.length) return true;
    if (entry.slots.length !== orig.names.length) return true;
    for (let i = 0; i < entry.slots.length; i++) {
      const s = entry.slots[i], o = orig.names[i];
      const curGid = (s.committed && s.gid) ? s.gid : '';
      const origGid = (o.artist && u(o.artist.gid)) || '';
      if (curGid !== origGid || (s.creditedAs || '') !== (o.creditedAs || '') || (s.joinPhrase || '') !== (o.joinPhrase || '')) return true;
    }
    return false;
  }
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
  // a medium with a CD disc ID (TOC) has a fixed track count — native MB locks adding/removing/
  // reordering its tracks. Mirror that so Apollo never silently corrupts the disc-ID association. #125
  function mediumLocked(mi) { try { const m = mediums()[mi]; return !!(m && typeof m.hasToc === 'function' && m.hasToc()); } catch (e) { return false; } }
  function removeTrack(entry) { if (mediumLocked(entry.mi)) { Log.info('medium', entry.mi + 1, 'disc-ID locked — remove blocked'); return; } _selfEdit = true; try { getEditor().removeTrack(koTrack(entry.mi, entry.ti)); } finally { _selfEdit = false; } Log.info('removed track', entry.number); }
  function moveTrack(entry, dir) { if (mediumLocked(entry.mi)) { Log.info('medium', entry.mi + 1, 'disc-ID locked — move blocked'); return; } const ed = getEditor(); const t = koTrack(entry.mi, entry.ti); _selfEdit = true; try { (dir < 0 ? ed.moveTrackUp : ed.moveTrackDown).call(ed, t); } finally { _selfEdit = false; } }
  // move a track to a target index WITHIN its medium by stepping MB's own up/down ops — never touches the
  // model array directly, so the editor can't diverge (drag-to-reorder rides on this)
  function moveTrackToIndex(entry, destTi) {
    if (mediumLocked(entry.mi)) { Log.info('medium', entry.mi + 1, 'disc-ID locked — reorder blocked'); return false; }
    const ed = getEditor(), t = koTrack(entry.mi, entry.ti); const n = (u(mediums()[entry.mi].tracks) || []).length;
    destTi = Math.max(0, Math.min(n - 1, destTi)); let cur = entry.ti;
    if (cur === destTi) return false;
    _selfEdit = true;
    try { while (cur > destTi) { ed.moveTrackUp.call(ed, t); cur--; } while (cur < destTi) { ed.moveTrackDown.call(ed, t); cur++; } }
    catch (e) { Log.warn('move-to-index failed', e.message); }
    finally { _selfEdit = false; }
    Log.info('moved track', entry.number, 'from', entry.ti, '→', destTi, 'in medium', entry.mi + 1);
    return true;
  }
  // add N blank tracks to a medium by driving MB's own "Add tracks" control (the green ＋)
  function addTracks(mi, n) {
    if (mediumLocked(mi)) { Log.info('medium', mi + 1, 'disc-ID locked — add blocked'); return; }
    const btns = [...document.querySelectorAll('button[data-click="addNewTracks"]')];
    const inputs = [...document.querySelectorAll('input[data-bind*="addTrackCount"]')];
    const btn = btns[mi] || btns[btns.length - 1]; const inp = inputs[mi] || inputs[inputs.length - 1];
    if (!btn) { Log.warn('no native add-tracks button found'); return; }
    const med = mediums()[mi]; const before = med ? (u(med.tracks) || []).length : 0;
    _selfEdit = true;
    try { if (inp) { inp.value = String(n); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } btn.click(); }
    finally { _selfEdit = false; }
    // MB seeds each new track with the *previous* track's artist credit — clear it so new tracks are blank
    if (med) { const tks = u(med.tracks) || []; for (let i = before; i < tks.length; i++) try { tks[i].artistCredit({ names: [{ artist: null, name: '', joinPhrase: '' }] }); } catch (e) {} }
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
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md';
  const VERSION = '2026.6.6.045000';   // keep in sync with @version (fallback when GM_info is unavailable under @grant none)
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  // Apollo Editor — a launching rocket in the theme purple (recreated from the requested clipart)
  const ICON = '<svg class="tc-ico" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" style="vertical-align:-5px">' +
    '<path d="M13 22 L19 22 L16 30 Z" fill="#ff8c3b"/>' +                                   // flame (outer)
    '<path d="M14.4 22 L17.6 22 L16 27 Z" fill="#ffd24a"/>' +                               // flame (inner)
    '<path d="M12 18 L8 23.5 L12 22 Z" fill="#3d2470"/><path d="M20 18 L24 23.5 L20 22 Z" fill="#3d2470"/>' +   // fins
    '<path d="M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z" fill="#5f3ec0"/>' +          // body + nose
    '<circle cx="16" cy="12.5" r="3" fill="#cfe8ff" stroke="#2a1a52" stroke-width="1"/></svg>';                // window

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
  const COLS = [{ k: 'mv', w: 32, label: '' }, { k: 'num', w: 38, label: '#' }, { k: 'title', w: 360, label: 'Title' }, { k: 'art', w: 380, label: 'Artist' }, { k: 'len', w: 52, label: 'Length' }, { k: 'badge', w: 56, label: 'Match' }];
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
    .tc-tbsep{width:1px;height:18px;background:#ddd;flex:none;margin:0 2px}   /* vertical divider before the Match cluster, shared by both toolbars */
    .tc-btn:disabled,.tc-btn:disabled:hover{color:#aaa;background:transparent;border-color:transparent;cursor:default;font-weight:normal}
    .tc-btn.mini{padding:1px 6px;font-size:11px}
    .tc-icon{cursor:pointer;border:none;background:none;font-size:13px;padding:0 2px;color:#666}
    #tc-panel a,#tc-mirror-wrap a{color:#4800a0;text-decoration:none}#tc-panel a:hover,#tc-mirror-wrap a:hover{text-decoration:underline}

    .tc-mirror{table-layout:fixed;width:100%;border-collapse:collapse;font:13px Arial,Helvetica,sans-serif;background:#fff}
    /* clean "normal" look, shared with the Recordings table: light header, no column fill/borders, soft row rule */
    .tc-mirror th{position:relative;background:transparent;border-bottom:1px solid #ccc;text-align:left;padding:4px 7px;font-size:11px;font-weight:bold;color:#777;overflow:hidden}
    .tc-mirror th:last-child{border-right:none}
    .tc-mirror td{padding:4px 7px;vertical-align:middle;overflow:hidden;background:#fff}
    .tc-mirror.gridrows td{border-bottom:1px solid #e0e0e0}   /* row line BETWEEN tracks (a track is one row, never between its artists) */
    .tc-mirror td.c-art{vertical-align:top;padding-top:0;padding-bottom:0}   /* green matched boxes touch row-to-row (no white gap) */
    .tc-mirror td.c-badge{vertical-align:top}
    .tc-mirror td.c-badge{position:relative;padding:0;text-align:center}
    .tc-mirror .tc-resizer{position:absolute;right:-1px;top:0;height:100%;width:9px;cursor:col-resize;border-right:2px solid transparent}
    .tc-mirror th:hover .tc-resizer,.tc-mirror .tc-resizer:hover{border-right-color:#5f3ec0}
    .tc-mirror .c-num{color:#888;font-variant-numeric:tabular-nums;text-align:center}
    .tc-mirror th.c-len{text-align:right}
    .tc-mirror .c-mv{white-space:nowrap;text-align:center}
    .tc-mirror input.t-title,.tc-mirror input.t-len,.tc-mirror input.t-num{width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;font:13px Arial;padding:3px 2px}
    .tc-mirror input.t-len,.tc-mirror input.t-num{text-align:right;color:#666}
    .tc-mirror input.t-num{text-align:center}
    .tc-mirror input.t-title:hover,.tc-mirror input.t-title:focus,.tc-mirror input.t-len:hover,.tc-mirror input.t-len:focus,.tc-mirror input.t-num:hover,.tc-mirror input.t-num:focus{border-color:#bbb;background:#fff}
    .tc-mirror .t-wrap{display:flex;align-items:center;gap:3px}.tc-mirror .t-wrap input.t-title{flex:1;min-width:0;width:auto}
    .tc-mirror input.t-title.diff{background:#fff6da;border-color:#e7ce8a;border-radius:3px}
    .tc-mirror input.t-title.gcpreview{background:#e3f6e3;border-color:#86c686;border-radius:3px}
    /* MB medium-format select made to read as plain text — click still opens the native dropdown */
    select.tc-fmt-flat{-webkit-appearance:none;-moz-appearance:none;appearance:none;border:1px solid transparent;background:transparent;font:bold 15px Arial;color:#222;padding:2px 5px;cursor:pointer}
    select.tc-fmt-flat:hover{background:#efeaf9;border-color:#d7ccef;border-radius:3px}
    .tc-mirror .t-gc{flex:none;cursor:pointer;border:1px solid #e7ce8a;background:#fff6da;color:#8a6d00;font:bold 10px Arial;border-radius:3px;padding:1px 4px;visibility:hidden}.tc-mirror .t-gc:hover{background:#ffefb8}
    .tc-mirror tr:hover .t-gc{visibility:visible}
    .tc-mirror input.t-title.hasfeat{background:#eaf1fb;border-color:#9bbbe0;border-radius:3px}
    .tc-mirror .t-feat{flex:none;cursor:pointer;border:1px solid #9bbbe0;background:#eaf1fb;color:#2c5d9b;font:bold 12px Arial;border-radius:3px;padding:0 4px;line-height:16px;visibility:hidden}.tc-mirror .t-feat:hover{background:#d6e4f7}
    .tc-mirror tr:hover .t-feat{visibility:visible}
    .tc-mirror .mv{cursor:pointer;color:#6f54c0;font-size:12px;padding:0 1px}
    /* drag-to-reorder: ⠿ handle + drop indicators (a purple line at the row edge you'll drop against) */
    .tc-mirror .tc-drag{cursor:grab;color:#b3a3dd;font-size:15px;line-height:1;padding:0 3px;user-select:none}
    .tc-mirror .tc-drag:hover{color:#5f3ec0}.tc-mirror .tc-drag:active{cursor:grabbing}
    .tc-mirror tr.tc-dragging td{opacity:.45}
    .tc-mirror tr.tc-drop-before td{box-shadow:inset 0 2px 0 #5f3ec0}
    .tc-mirror tr.tc-drop-after td{box-shadow:inset 0 -2px 0 #5f3ec0}
    /* alternate row colors / grid (toggled in ⚙) */
    .tc-mirror.alt tbody tr:nth-child(even) td{background:#f6f4fb}
    .tc-mirror.gridcols td{border-right:1px solid #ededed}.tc-mirror.gridcols td:last-child{border-right:none}
    /* density layouts: compact (tight) · normal (default, shared with Recordings) · cozy (airy) */
    .tc-mirror.cozy th{padding:7px 7px}.tc-mirror.cozy td{padding:8px 7px}
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
    .tc-mirror tr.tc-changed td:first-child{box-shadow:inset 3px 0 0 #5f3ec0}   /* a track that differs from its page-load state */
    /* one artist = one aligned fixed-height line: credited-as · icon · search box · acts (no line between artists) */
    .tc-aslot{display:flex;align-items:center;gap:5px;height:28px;box-sizing:border-box}
    .tc-cred{flex:none;width:130px;text-align:right;box-sizing:border-box;font:11px Arial;color:#1c1c1c;border:1px solid transparent;background:transparent;padding:1px 4px}
    .tc-cred::placeholder{color:#cfcfcf}
    .tc-cred:hover,.tc-cred:focus{border-color:#cdbff0;background:#fff;color:#333}
    .tc-aslot.tc-can-split .tc-cred{background:#fff3cf;border-color:#e7ce8a;border-radius:3px;color:#8a6d00}
    .tc-aslot.tc-can-split .tc-cred::placeholder{color:#caa64e}
    .tc-tic{flex:none;width:18px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:#6f54c0;text-decoration:none}
    .tc-tic.link{cursor:pointer}.tc-tic.link:hover{color:#4f2bab}.tc-tic.dim{color:#c6bbe6}
    /* one fixed-width search box per artist (so all lines align); name fills it, ＋ + join sit at the right */
    .tc-search{flex:1 1 0;min-width:0;align-self:stretch;display:flex;align-items:center;gap:4px;border:none;border-radius:4px;background:#fff;padding:0 6px;overflow:hidden}   /* unmatched = plain white; the green fill marks a match */
    .tc-search:focus-within{box-shadow:inset 0 0 0 1px #b9a4e0}
    .tc-search.matched{background:#e3f4e7}
    /* "Alternate row colors": tint the matched box a touch deeper on every other track (per row, so a
       multi-artist group stays one shade) — the only way the banding shows through the green fill */
    .tc-mirror.alt tbody tr:nth-child(even) .tc-search.matched{background:#d6ecdd}
    /* group ALL of a track's artist boxes under ONE border: collapse adjacent boxes, round only the outer
       corners; the inner borders become subtle dividers between the individual artists. #119 */
    .tc-mirror td.c-art .tc-aslot .tc-search{border-radius:0}
    .tc-mirror td.c-art .tc-aslot:first-child .tc-search{border-top-left-radius:4px;border-top-right-radius:4px}
    .tc-mirror td.c-art .tc-aslot:last-child .tc-search{border-bottom-left-radius:4px;border-bottom-right-radius:4px}
    .tc-mirror td.c-art .tc-aslot:not(:first-child) .tc-search{border-top:none}
    .tc-mirror td.c-art .tc-aslot:not(:last-child) .tc-search{border-bottom:none}   /* no horizontal line between a track's artists — one seamless box */
    /* split/multi-artist cue: a faint purple left stripe on tracks that have 2+ artists */
    .tc-mirror td.c-art:has(.tc-aslot ~ .tc-aslot){box-shadow:inset 2px 0 0 #d8cbf0}
    @keyframes tcflash{0%{box-shadow:0 0 0 3px #e0a800}70%{box-shadow:0 0 0 3px #e0a800}100%{box-shadow:0 0 0 0 rgba(224,168,0,0)}}
    .tc-search.tc-flash{animation:tcflash 1.5s ease-out}
    .tc-search.tc-marked{border:2px solid #e0a800}   /* persists when a pick changed several tracks */
    .tc-search .nm{flex:1 1 0;min-width:0;border:none;background:transparent;font:13px Arial;padding:3px 0;outline:none}
    .tc-search .tc-bar-aka{flex:0 1 auto;min-width:0;max-width:55%;margin-left:2px;color:#9bb8a8;font-size:11px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    .tc-search .mk{flex:none;order:9;cursor:pointer;border:none;background:none;color:#1f8a4c;font-weight:bold;font-size:15px;line-height:1;padding:0 2px}.tc-search .mk:hover{color:#136b39}   /* order:9 keeps ＋ pinned at the far right, past the join-phrase */
    .tc-joinwrap{flex:none;margin-left:auto;display:flex;align-items:center;gap:0}
    .tc-join{width:auto;text-align:right;border:1px solid transparent;background:transparent;color:#777;font:italic 900 12px Arial;padding:1px 2px;border-radius:3px}
    .tc-join:hover,.tc-join:focus{border-color:#bcdcc6;background:#fff;color:#444}
    .tc-joinarrow{cursor:pointer;border:none;background:none;color:#9a8fc0;font-size:10px;padding:0 1px;line-height:1}.tc-joinarrow:hover{color:#5f3ec0}
    .tc-joinpop .tc-acrow{justify-content:space-between;gap:14px}.tc-joinpop .cmt{color:#999}
    .tc-acts{flex:none;width:60px;display:flex;align-items:center;justify-content:flex-start;gap:4px;padding-left:4px}
    .tc-enter,.tc-slotx,.tc-splitb{cursor:pointer;border:none;background:none;padding:0 1px;visibility:hidden;line-height:1}
    .tc-enter{color:#7d6bc0;font-size:19px}.tc-enter:hover{color:#5f3ec0}
    .tc-splitb{color:#7d6bc0;font-size:16px;font-weight:bold}.tc-splitb:hover{color:#5f3ec0}
    .tc-aslot:not(.tc-can-split) .tc-splitb{display:none}
    .tc-slotx{color:#cc6699;font-size:13px}.tc-slotx:hover{color:#c0392b}
    .tc-mirror tr:hover .tc-enter,.tc-mirror tr:hover .tc-slotx,.tc-mirror tr:hover .tc-splitb{visibility:visible}
    .tc-acpop{position:fixed;z-index:100002;background:#fff;border:1px solid #b9a4e0;border-radius:4px;box-shadow:0 6px 22px rgba(40,20,80,.3);max-height:300px;overflow:auto;font:12px Arial;min-width:210px}
    .tc-acrow{display:flex;align-items:center;gap:7px;padding:4px 9px;cursor:pointer}
    .tc-acrow:hover,.tc-acrow.hi{background:#ede9f6}
    .tc-acrow .tic{flex:none;width:17px;display:inline-flex;align-items:center;justify-content:center;color:#6f54c0}
    .tc-acrow .nm{font-weight:600;color:#222}.tc-acrow .cmt{color:#888;font-size:11px}
    .tc-acrow .tc-aka{color:#9bb8a8;font-size:11px;font-style:italic}
    .tc-acrow.none{color:#888;font-style:italic;cursor:default}
    .tc-acmore{justify-content:center;font-style:italic;color:#6f54c0;border-top:1px solid #e3dcf2;position:sticky;bottom:0;background:#faf8ff}
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
    .tc-globalstat{flex:none;font-size:12px;color:#999;font-style:italic;white-space:nowrap}
    .tc-am-lbl{flex:none;display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#555;white-space:nowrap}.tc-am-lbl select{font:12px Arial;padding:1px 3px}
    .tc-globalstat.tc-unres{font-style:normal;font-weight:bold;color:#fff;background:#d6342c;padding:1px 8px;border-radius:9px}
    .tc-tablewrap{overflow-x:auto}
    .tc-addrow{padding:8px 4px;font-size:13px;color:#555;display:flex;align-items:center;gap:6px}
    .tc-addrow input.tc-addn{width:54px;font:13px Arial;padding:2px 4px;border:1px solid #bbb;border-radius:3px}
    .tc-addbtn{width:22px;height:22px;border-radius:50%;border:1px solid #d6cdec;background:transparent;color:#9a8fc0;font:bold 15px/1 Arial;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
    .tc-addbtn:hover{background:#f0ecfa;color:#6f42c1;border-color:#b9a4e0}
    .tc-mirror th .tc-hstatus{font-weight:normal;font-style:italic;color:#999;margin-left:12px;font-size:11px}
    .tc-mirror th .tc-hstatus.tc-unres{font-style:normal;font-weight:bold;color:#fff;background:#d6342c;padding:1px 7px;border-radius:9px;font-size:11px}
    .tc-mirror th .tc-hdr-am{float:right;font-weight:normal;font-style:normal;font-size:11px;color:#444;margin-right:14px;max-width:140px}
    .tc-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .tc-toolopts{display:flex;align-items:center;gap:6px}
    .tc-toolopts .tc-gco,.tc-toolopts .tc-sro,.tc-toolopts .tc-colso{display:flex;align-items:center;gap:8px}
    .tc-colso{gap:4px}
    .tc-colbtn{font:12px Arial;padding:2px 9px;border:1px solid #bbb;border-radius:4px;background:#fff;cursor:pointer;color:#333}
    .tc-colbtn:hover{background:#f0ecfa;border-color:#a98fe0}
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
    .tc-menu.tc-mini{width:max-content;max-width:260px}.tc-menu.tc-mini .tc-mi{white-space:nowrap}
    .tc-menu .tc-mi{padding:6px 15px;cursor:pointer;color:#333;font-weight:bold}.tc-menu .tc-mi:hover{background:#ede9f6;color:#4b2e83}
    .tc-menu .tc-sep{border-top:1px solid #e6e0f2;margin:4px 0}
    .tc-settings label{display:flex;gap:8px;align-items:center;margin:7px 0;color:#333}.tc-settings label.opt{font-size:12px}
    .tc-settings input[type=text],.tc-settings #tc-sr-find,.tc-settings #tc-sr-rep{font:13px Arial;padding:3px 5px;border:1px solid #bbb;border-radius:3px}
    .tc-settings .srrow{display:flex;align-items:center;gap:8px;margin-top:8px}.tc-settings .srrow span{flex:1;color:#777;font-size:12px}
    @keyframes tctitleflash{0%{background:#fff3b0}100%{background:transparent}}
    .tc-mirror input.t-title.srflash{animation:tctitleflash 1.8s ease-out}

    #tc-settings{position:fixed;z-index:100001;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 24px rgba(40,20,80,.3);padding:11px 13px;font:13px Arial;color:#222;width:340px}
    #tc-settings h4{display:flex;align-items:center;gap:6px;margin:0 0 9px;padding-bottom:8px;border-bottom:1px solid #e3dcf2;color:#563b8f;font-size:13px}
    #tc-settings h4 .tc-ver{font-size:11px;font-weight:normal;color:#999}
    #tc-settings h4{flex-wrap:wrap}
    #tc-settings h4 .tc-help{margin-left:auto;flex:none;white-space:nowrap;font-size:12px;font-weight:normal;text-decoration:none;color:#5f3ec0;border:1px solid #c9b8ee;border-radius:4px;padding:1px 8px}
    #tc-settings h4 .tc-help:hover{background:#f0ecfa}
    #tc-settings label{display:flex;gap:8px;align-items:center;margin:7px 0;color:#333}
    #tc-settings label input[type=checkbox]{margin:0;flex:none}
    #tc-settings .hint{color:#777;font-size:11px;margin:0 0 4px 24px}
    #tc-settings .tc-s-sec{font-weight:bold;color:#333;margin:12px 0 5px}
    #tc-settings .tc-s-group{padding-left:8px}
    #tc-settings .tc-s-top{padding-left:0;margin-top:2px}
    #tc-settings .tc-s-sub{font-weight:bold;color:#444;margin:0}
    #tc-settings div.tc-s-sub{margin:8px 0 3px}
    #tc-settings .tc-s-row{display:flex;align-items:center;gap:12px;margin:7px 0;color:#333}
    #tc-settings .tc-s-rad{display:inline-flex;align-items:center;gap:4px;margin:0;font-weight:normal;cursor:pointer}
    #tc-settings .tc-s-row input[type=radio]{margin:0}
    #tc-settings #tc-s-lentol{width:48px;font:13px Arial;padding:2px 5px;border:1px solid #bbb;border-radius:3px}
    #tc-settings .tc-s-row.lentol{gap:7px}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;display:inline-flex;align-items:stretch;background:#5f3ec0;color:#fff;border-radius:20px;font:bold 13px Arial;box-shadow:0 3px 12px rgba(40,20,80,.3);overflow:hidden}
    #tc-launch .tc-launch-lbl{padding:8px 13px;cursor:pointer}
    #tc-launch .tc-launch-lbl:hover{background:rgba(255,255,255,.13)}
    #tc-launch .tc-launch-gear{padding:8px 11px;cursor:pointer;font-size:14px;display:flex;align-items:center;border-left:1px solid rgba(255,255,255,.28)}
    #tc-launch .tc-launch-gear:hover{background:rgba(255,255,255,.13)}
    #tc-btn,#tc-gear-btn{vertical-align:middle}
  `;
  function style() {
    if (document.getElementById('tc-css')) return;
    const s = document.createElement('style'); s.id = 'tc-css'; s.textContent = css; document.head.appendChild(s);
  }

  /* ── settings popover (view options) ── */
  function applyViewClasses() {
    const layout = SETTINGS.layout || 'normal';
    document.querySelectorAll('.tc-mirror, .tc-rectbl').forEach(t => {   // both tables share the layout/alt/grid options
      t.classList.toggle('alt', !!SETTINGS.altRows); t.classList.toggle('gridcols', !!SETTINGS.gridCols); t.classList.toggle('gridrows', SETTINGS.gridRows !== false);
      t.classList.remove('compact', 'cozy', 'normal'); t.classList.add(layout);
    });
  }
  function openSettings(anchor) {
    style(); let s = document.getElementById('tc-settings'); if (s) { s.remove(); return; }
    s = document.createElement('div'); s.id = 'tc-settings';
    s.innerHTML = `<h4>${ICON} Apollo Editor <span class="tc-ver" title="installed script version">v${scriptVersion()}</span><a class="tc-help" href="${HELP_URL}" target="_blank" rel="noopener" title="open the README in a new tab">? Help</a></h4>
      <div class="tc-s-group tc-s-top">
        <label title="Tidy the Release information tab: remove the help bubble, clean up the external links and use the right column. The Original/Apollo button still toggles it anytime."><input type="checkbox" id="tc-s-replri"> <span>Modify Release information</span></label>
        <label title="Replace the native Tracklist editor with the Apollo table on page load. The Original/Apollo button still toggles it anytime."><input type="checkbox" id="tc-s-repltl"> <span>Modify Tracklist</span></label>
        <label title="Replace the native Recordings editor with the Apollo table on page load. The Original/Apollo button still toggles it anytime."><input type="checkbox" id="tc-s-replrec"> <span>Modify Recordings</span></label>
        <label title="Hide the native step-tab row and footer; show a compact step switcher, wizard buttons by the title, and Add medium at the table's right."><input type="checkbox" id="tc-s-compactnav"> <span>Modify header and footer</span></label>
      </div>
      <div class="tc-s-sec">Matching</div>
      <div class="tc-s-group">
        <div class="tc-s-row"><b class="tc-s-sub">Auto-match on start</b><label class="tc-s-rad" title="Tracklist tab: match track artists to MusicBrainz on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatch"> Tracklist</label><label class="tc-s-rad" title="Recordings tab: auto-match unset recordings on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatchrec"> Recordings</label></div>
        <div class="tc-s-sub">Recording</div>
        <div class="tc-s-group">
          <div class="tc-s-row lentol" title="A length difference up to this many seconds counts as a match (not a length mismatch)."><span>Length tolerance</span><input type="number" id="tc-s-lentol" min="0" max="60" step="1"> <span>seconds</span></div>
          <div class="tc-s-row lentol" title="Allow up to this many differing characters in the title (edit distance) and still count it as a match. 0 = exact."><span>Title tolerance</span><input type="number" id="tc-s-titletol" min="0" max="20" step="1"> <span>characters</span></div>
          <label title="Treat a case / accent / spacing-only difference in title or artist as a match (recommended)."><input type="checkbox" id="tc-s-ignorecase"> <span>Ignore casing</span></label>
          <label title="Ignore punctuation &amp; symbols in titles/artists (&amp; → and, brackets, quotes, dashes, dots…)."><input type="checkbox" id="tc-s-ignorepunct"> <span>Ignore punctuation</span></label>
        </div>
      </div>
      <div class="tc-s-sec">Appearance</div>
      <div class="tc-s-group">
        <div class="tc-s-row"><span>Row layout</span><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="compact"> compact</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="normal"> normal</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="cozy"> cozy</label></div>
        <label><input type="checkbox" id="tc-s-alt"> <span>Alternate row colors</span></label>
        <div class="tc-s-row"><span>Show grid</span><label class="tc-s-rad" title="vertical column separators"><input type="checkbox" id="tc-s-gridcols"> columns</label><label class="tc-s-rad" title="horizontal lines between tracks"><input type="checkbox" id="tc-s-gridrows"> rows</label></div>
      </div>`;
    document.body.appendChild(s);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 60, bottom: 80 };
    // keep it fully on-screen — right-align to the gear if it would overflow (uses the real width), and
    // clamp/scroll vertically so a tall dialog never runs off the bottom (#119)
    s.style.left = Math.max(8, Math.min(r.right - s.offsetWidth, window.innerWidth - s.offsetWidth - 10)) + 'px';
    const maxH = window.innerHeight - 16; s.style.maxHeight = maxH + 'px'; s.style.overflowY = 'auto';
    const h = Math.min(s.offsetHeight, maxH); let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    s.style.top = top + 'px';
    const am = s.querySelector('#tc-s-automatch'), amRec = s.querySelector('#tc-s-automatchrec'), alt = s.querySelector('#tc-s-alt'), gridcols = s.querySelector('#tc-s-gridcols'), gridrows = s.querySelector('#tc-s-gridrows');
    am.checked = SETTINGS.autoMatch !== false; amRec.checked = !!SETTINGS.autoMatchRec; alt.checked = !!SETTINGS.altRows; gridcols.checked = !!SETTINGS.gridCols; gridrows.checked = SETTINGS.gridRows !== false;
    const curLayout = SETTINGS.layout || 'normal';
    s.querySelectorAll('input[name="tc-s-layout"]').forEach(rb => { rb.checked = rb.value === curLayout; rb.onchange = () => { if (rb.checked) { SETTINGS.layout = rb.value; saveSettings(); applyViewClasses(); } }; });
    am.onchange = () => { SETTINGS.autoMatch = am.checked; saveSettings(); };
    amRec.onchange = () => { SETTINGS.autoMatchRec = amRec.checked; saveSettings(); };
    const lentol = s.querySelector('#tc-s-lentol'), titletol = s.querySelector('#tc-s-titletol'), igc = s.querySelector('#tc-s-ignorecase'), igp = s.querySelector('#tc-s-ignorepunct');
    lentol.value = SETTINGS.recLenTol != null ? SETTINGS.recLenTol : 5; titletol.value = SETTINGS.recTitleTol || 0; igc.checked = SETTINGS.recIgnoreCase !== false; igp.checked = !!SETTINGS.recIgnorePunct;
    const refreshRec = () => { try { if (document.getElementById('tc-recwrap')) rerenderRec(); } catch (e) {} };   // live-update the table
    lentol.onchange = () => { const v = Math.max(0, Math.min(60, parseInt(lentol.value, 10) || 0)); SETTINGS.recLenTol = v; lentol.value = v; saveSettings(); refreshRec(); };
    titletol.onchange = () => { const v = Math.max(0, Math.min(20, parseInt(titletol.value, 10) || 0)); SETTINGS.recTitleTol = v; titletol.value = v; saveSettings(); refreshRec(); };
    igc.onchange = () => { SETTINGS.recIgnoreCase = igc.checked; saveSettings(); refreshRec(); };
    igp.onchange = () => { SETTINGS.recIgnorePunct = igp.checked; saveSettings(); refreshRec(); };
    alt.onchange = () => { SETTINGS.altRows = alt.checked; saveSettings(); applyViewClasses(); };
    gridcols.onchange = () => { SETTINGS.gridCols = gridcols.checked; saveSettings(); applyViewClasses(); };
    gridrows.onchange = () => { SETTINGS.gridRows = gridrows.checked; saveSettings(); applyViewClasses(); };
    const replri = s.querySelector('#tc-s-replri'), repltl = s.querySelector('#tc-s-repltl'), replrec = s.querySelector('#tc-s-replrec'), cnav = s.querySelector('#tc-s-compactnav');
    replri.checked = SETTINGS.replaceReleaseInfo !== false; repltl.checked = SETTINGS.replaceTracklist !== false; replrec.checked = SETTINGS.replaceRecordings !== false; cnav.checked = SETTINGS.compactNav !== false;
    replri.onchange = () => { SETTINGS.replaceReleaseInfo = replri.checked; saveSettings(); applyView(); };
    repltl.onchange = () => { SETTINGS.replaceTracklist = repltl.checked; saveSettings(); applyView(); };
    replrec.onchange = () => { SETTINGS.replaceRecordings = replrec.checked; saveSettings(); applyView(); };
    cnav.onchange = () => { SETTINGS.compactNav = cnav.checked; saveSettings(); applyNav(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  /* ── the one shared table ── */
  let MODEL = null;
  let ACTIVE = {};   // { mode, tbody, statusEl }
  // transient message (e.g. "matching d/n") shown in every table's Artist header
  const updateStatus = t => { document.querySelectorAll('.tc-medsec .tc-hstatus, #tc-panel .tc-hstatus, .tc-globalstat').forEach(e => { e.textContent = t; e.classList.remove('tc-unres'); }); };
  // scroll to + focus the first unresolved artist search box (the white, non-matched one)
  function focusFirstUnresolved() {
    const box = document.querySelector('.tc-mirror .tc-search:not(.matched)'); if (!box) return;
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (box.querySelector('input.nm') || box).focus();
  }
  // the always-visible total in the toolbar (left of Match) — shows the release-wide unresolved count / progress;
  // when there are unresolved artists the badge is clickable and jumps to the first one
  const setGlobalStat = n => { document.querySelectorAll('.tc-globalstat').forEach(e => { e.textContent = n ? statusText(n) : ''; e.classList.toggle('tc-unres', n > 0); e.onclick = n > 0 ? focusFirstUnresolved : null; e.style.cursor = n > 0 ? 'pointer' : ''; e.title = n > 0 ? 'jump to the first unresolved artist' : ''; }); };
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
  // ↑/↓ : move to the same field in the prev/next ROW — but for the per-artist fields (search box,
  // credited-as) walk EVERY line in document order, so multi-artist tracks and media boundaries are
  // all included. Returns true if it moved.
  function focusSameField(inp, dir) {
    const sel = inp.classList.contains('t-num') ? '.t-num' : inp.classList.contains('t-title') ? '.t-title' : inp.classList.contains('t-len') ? '.t-len' : inp.classList.contains('tc-cred') ? '.tc-cred' : inp.classList.contains('nm') ? '.tc-search input.nm' : null;
    if (!sel) return false;
    const scope = inp.closest('#tc-panel') ? '#tc-panel' : '.tc-medsec';
    const all = [...document.querySelectorAll(`${scope} ${sel}`)];   // flat list across all rows/sections/artist lines
    const cur = all.indexOf(inp); if (cur < 0) return false;
    const dest = all[cur + dir]; if (!dest) return false;
    // remember the destination by row + its slot index within that row (survives a commit-rebuild)
    const destRow = dest.closest('tr[data-tk]'); const destTk = destRow ? destRow.dataset.tk : null;
    const destIdx = destRow ? [...destRow.querySelectorAll(sel)].indexOf(dest) : 0; const destPos = cur + dir;
    inp.blur();   // committing the current field on blur can rebuild the rows — focus AFTER, from the fresh DOM
    const go = () => {
      let t = null;
      if (destTk) { const d = document.querySelector(`${scope} tr[data-tk="${destTk}"]`); if (d) { const xs = [...d.querySelectorAll(sel)]; t = xs[Math.min(destIdx, xs.length - 1)]; } }
      if (!t) t = [...document.querySelectorAll(`${scope} ${sel}`)][destPos];
      if (t && document.activeElement !== t) { t.focus(); if (t.select && !t.classList.contains('nm')) t.select(); }
    };
    go(); setTimeout(go, 0);
    return true;
  }
  // ↓/Enter → next field, ↑/Shift+Enter → prev. NOT wired on the artist search box (Enter picks there).
  function wireRowNav(inp) {
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { if (focusSameField(inp, 1)) e.preventDefault(); }
      else if (e.key === 'ArrowUp') { if (focusSameField(inp, -1)) e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!focusSameField(inp, e.shiftKey ? -1 : 1)) inp.blur(); }   // move on; blur (commit) if at the edge
    });
  }
  // show each medium's OWN unresolved count in its header (or the global count for the floating panel)
  function refreshStatus() {
    if (!MODEL || _matching) return;   // while a pass runs the headers show "matching d/n" — don't flicker the badge
    if (ACTIVE.sections) ACTIVE.sections.forEach(s => setStatusSpan(s.sec.querySelector('.tc-hstatus'), unresolvedIn(s.mi)));
    else document.querySelectorAll('#tc-panel .tc-hstatus').forEach(span => setStatusSpan(span, unresolvedIn(null)));
    setGlobalStat(unresolvedIn(null));   // release-wide total in the toolbar
  }

  function buildTable() {
    const t = document.createElement('table'); t.className = 'tc-mirror' + (SETTINGS.altRows ? ' alt' : '') + (SETTINGS.gridCols ? ' gridcols' : '') + (SETTINGS.gridRows !== false ? ' gridrows' : '') + ' ' + (SETTINGS.layout || 'normal');
    // the Artist column is the flexible filler (no fixed width) — it absorbs the slack so every OTHER
    // column keeps its EXACT width (table-layout:fixed) and resizes 1:1 with the mouse (no jump)
    t.innerHTML = `<colgroup>${COLS.map(c => c.k === 'art' ? '<col>' : `<col style="width:${colW(c.k, c.w)}px">`).join('')}</colgroup>` +
      `<thead><tr>${COLS.map(c => `<th class="c-${c.k}">${c.label}${c.k === 'art' ? '' : '<span class="tc-resizer"></span>'}</th>`).join('')}</tr></thead><tbody></tbody>`;
    return t;
  }
  // the artist-selection-mode dropdown now lives in the Artist column header (right-aligned)
  const AM_SELECT = `<select class="tc-applymode" title="when you pick an artist, apply it to…"><option value="all">all matching tracks</option><option value="single">single track</option></select>`;
  // wire the apply-mode combo (now lives in the toolbar, was in the Artist header)
  function wireApplyMode(root) {
    const am = (root || document).querySelector('.tc-applymode'); if (!am) return;
    am.value = SETTINGS.applyMode || 'all';
    am.onchange = () => { SETTINGS.applyMode = am.value; saveSettings(); document.querySelectorAll('.tc-applymode').forEach(s => { s.value = am.value; }); Log.info('applyMode =', am.value); };
  }
  // one Apollo table for a single medium (its own header row + Add footer); returns the tbody.
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
    // "Add N track(s)" footer — adds to THIS medium (or the last medium for the combined panel).
    // Mirror native MB: a medium locked by a CD disc ID has a fixed track count and offers no
    // add-tracks control, so only show the footer when the target medium can actually take new
    // tracks — i.e. "if add tracks exists in the original, it exists in Apollo". #125
    const target = (mi == null) ? Math.max(0, mediums().length - 1) : mi;
    if (!mediumLocked(target)) {
      const addrow = document.createElement('div'); addrow.className = 'tc-addrow';
      addrow.innerHTML = `Add <input type="number" class="tc-addn" min="1" value="1"> track(s) <button class="tc-addbtn" title="add blank tracks">＋</button>`;
      const addn = addrow.querySelector('.tc-addn'), addbtn = addrow.querySelector('.tc-addbtn');
      addbtn.onclick = () => addTracks(target, Math.max(1, parseInt(addn.value, 10) || 1));
      container.appendChild(addrow);
    }
    return table.querySelector('tbody');
  }
  // resize a column by dragging near its right border from ANY row (or the header)
  function wireResizers(table) {
    const cols = [...table.querySelectorAll('col')];
    const TOL = 5;
    const artIdx = COLS.findIndex(c => c.k === 'art');   // the flexible filler column
    // detect a column boundary near the cursor (each th's right edge), including Artist's right edge. #119
    const borderIdx = clientX => { const ths = table.querySelectorAll('thead th'); for (let i = 0; i < ths.length - 1; i++) { if (Math.abs(ths[i].getBoundingClientRect().right - clientX) <= TOL) return i; } return -1; };
    let dragging = false;
    table.addEventListener('mousemove', e => { if (!dragging) table.style.cursor = borderIdx(e.clientX) >= 0 ? 'col-resize' : ''; });
    table.addEventListener('mousedown', e => {
      const i = borderIdx(e.clientX); if (i < 0) return;
      e.preventDefault(); dragging = true;
      // data columns have exact fixed widths (the spacer column absorbs slack), so the style width IS the
      // rendered width — resize is 1:1, no jump. Columns LEFT of the Artist filler resize from their own
      // right edge; columns AT/AFTER it (Length, badge) have no room to their right, so each boundary
      // resizes the column to its RIGHT, inversely (drag right = that column shrinks, Artist absorbs). #119
      const ths = [...table.querySelectorAll('thead th')];
      const inverse = i >= artIdx;
      const ci = inverse ? i + 1 : i;
      const col = cols[ci], startX = e.clientX, startW = parseInt(col.style.width) || (ths[ci] && ths[ci].offsetWidth) || 100;
      const mm = ev => { col.style.width = Math.max(36, startW + (ev.clientX - startX) * (inverse ? -1 : 1)) + 'px'; };
      const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); dragging = false; SETTINGS.colWidths = SETTINGS.colWidths || {}; SETTINGS.colWidths[COLS[ci].k] = parseInt(col.style.width); saveSettings(); };
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
  }
  // ── column sizing (the "Resize columns" tool) ── Artist stays the flexible filler; the rest get
  // explicit widths in SETTINGS.colWidths and are pushed to every live table in place (no rebuild).
  function applyColWidths() {
    SETTINGS.colWidths = SETTINGS.colWidths || {};
    document.querySelectorAll('.tc-mirror').forEach(table => {
      const cols = [...table.querySelectorAll('colgroup col')];
      COLS.forEach((c, i) => { if (!cols[i]) return; cols[i].style.width = c.k === 'art' ? '' : colW(c.k, c.w) + 'px'; });
    });
  }
  function colsDefault() { SETTINGS.colWidths = {}; saveSettings(); applyColWidths(); Log.info('columns → default widths'); }
  // fit each text column (#, Title, Length) to its widest content; Artist absorbs the slack
  function colsFit() {
    const tables = [...document.querySelectorAll('.tc-mirror')]; if (!tables.length) return;
    SETTINGS.colWidths = SETTINGS.colWidths || {};
    const probe = tables[0].querySelector('tbody input') || tables[0];
    const cx = (colsFit._cv || (colsFit._cv = document.createElement('canvas'))).getContext('2d');
    cx.font = getComputedStyle(probe).font || '13px sans-serif';
    const PAD = { num: 22, title: 32, len: 22 }, CAP = { num: 90, title: 720, len: 90 };
    ['num', 'title', 'len'].forEach(k => {
      const def = COLS.find(c => c.k === k); let max = cx.measureText(def.label || '').width;
      tables.forEach(t => t.querySelectorAll(`tbody td.c-${k} input`).forEach(inp => { max = Math.max(max, cx.measureText(inp.value || '').width); }));
      SETTINGS.colWidths[k] = Math.min(CAP[k], Math.max(36, Math.round(max) + PAD[k]));
    });
    saveSettings(); applyColWidths(); Log.info('columns → fit content', JSON.stringify(SETTINGS.colWidths));
  }
  // "centered" / balanced: give Title and Artist an equal share of the row (Artist flexes to the other half)
  function colsBalanced() {
    const table = document.querySelector('.tc-mirror'); if (!table) return;
    SETTINGS.colWidths = SETTINGS.colWidths || {};
    const total = table.clientWidth || table.offsetWidth || 900;
    const fixed = colW('mv', 32) + colW('num', 38) + colW('len', 52) + colW('badge', 56);
    SETTINGS.colWidths.title = Math.max(160, Math.round((total - fixed) / 2));
    saveSettings(); applyColWidths(); Log.info('columns → balanced (Title = Artist)', SETTINGS.colWidths.title);
  }

  // picking an artist writes through immediately; in "all" mode it also copies to every other
  // track credited to the same text, committing each.
  function pickArtist(slot, c) {
    if (!c || !c.gid) return;
    if (c.aliases) cacheAliases(c.gid, c.aliases);   // keep the chosen artist's aliases for the bar
    else if (!_gidAliases.has(c.gid)) fetchAliasesByGids([c.gid]).then(() => refreshAdorns());   // alias not loaded yet (fast pick / "Show more" result) — fetch + show it without re-searching #128
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
  // Ctrl/Cmd-click a search result → set that artist on EVERY still-unresolved slot (bulk-fill, e.g. a
  // various-artists comp that's actually one artist). Resolved (green) slots are left untouched.
  function pickArtistAllUnresolved(c) {
    if (!c || !c.gid || !MODEL) return;
    if (c.aliases) cacheAliases(c.gid, c.aliases); else if (!_gidAliases.has(c.gid)) fetchAliasesByGids([c.gid]).then(() => refreshAdorns());
    MODEL.tracks.forEach(t => t.slots.forEach(s => { delete s._marked; }));
    const touched = new Set(); let n = 0;
    MODEL.tracks.forEach(t => t.slots.forEach(s => {
      if (s.committed) return;   // skip already-resolved slots
      Object.assign(s, { entity: c, gid: c.gid, name: c.name, status: 'user', committed: true, query: null, _flash: true, _marked: true });
      if (!(s.creditedAs || '').trim()) s.creditedAs = c.name;
      touched.add(s._entry); n++;
    }));
    touched.forEach(commitTrack);
    rerender();
    toast(n ? `linked “${c.name}” on ${n} unresolved track${n > 1 ? 's' : ''}` : 'no unresolved tracks');
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
  function revertTrack(entry) { resetTrack(entry); rebuild(true); }

  // parse a combined credit ("A feat. B & C") into [{name, sep}] — sep is the separator AFTER each name
  const SEP_RE = /\s*(\bfeat\.?|\bft\.?|\bfeaturing|&|\band\b|\bvs\.?|\bwith\b|×|・|,|;)\s*/gi;
  function splitArtistText(text) {
    const parts = (text || '').split(SEP_RE); const out = [];
    for (let i = 0; i < parts.length; i += 2) { const name = (parts[i] || '').trim(); if (name) out.push({ name, sep: parts[i + 1] || '' }); }
    return out;
  }
  function normJoin(sep) {
    const s = (sep || '').trim().toLowerCase(); if (!s) return ' & ';
    if (s === '&') return ' & '; if (/^feat|^ft/.test(s)) return ' feat. '; if (s === 'and') return ' and ';
    if (s === ',') return ', '; if (s === ';') return '; '; if (/^vs/.test(s)) return ' vs. ';
    if (s === 'with') return ' with '; if (s === '×' || s === 'x') return ' × '; return ' ' + sep.trim() + ' ';
  }
  // ⋔ : split this slot's combined credit into one slot per artist, auto-match (if on), drop the credited-as override
  async function splitSlot(entry, idx) {
    const slot = entry.slots[idx];
    const parts = splitArtistText(slot.creditedAs || slot.name || slot.query || '');
    if (parts.length < 2) return;
    const fresh = parts.map((p, i) => { const s = blankSlot(entry); s.creditedAs = p.name; s.joinPhrase = i < parts.length - 1 ? normJoin(p.sep) : ''; s._pending = true; return s; });
    entry.slots.splice(idx, 1, ...fresh); entry.slots.forEach(s => { s._entry = entry; });
    commitTrack(entry); rerender();
    Log.info('split', JSON.stringify(slot.creditedAs || slot.name), '→', parts.map(p => p.name).join(' · '));
    if (SETTINGS.autoMatch !== false) await matchModel();
    else fresh.forEach(s => { delete s._pending; });
    // remove the credited-as override on the matched parts (the artist name is the credit)
    entry.slots.forEach(s => { if (s.committed && s.gid) s.creditedAs = ''; });
    commitTrack(entry); rerender();
  }

  // ＋ create-button at the right end of the box (before the join), only when the slot is unmatched;
  // and the alias on the resolved bar — only while the slot stays committed (gone the moment you edit)
  function adorn(search, slot, inp) {
    [...search.querySelectorAll('.mk, .tc-bar-aka')].forEach(e => e.remove());
    search.classList.toggle('matched', !!slot.committed);
    const ref = search.querySelector('.tc-joinwrap');
    const aks = _gidAliases.get(slot.gid);
    const aka = slot.committed ? aliasStr({ name: slot.name, aliases: aks || (slot.entity && slot.entity.aliases) || [], primaryAlias: slot.entity && slot.entity.primaryAlias }) : null;
    // when matched, size the name field to its content so the alias sits right after it on the LEFT
    // (instead of being pushed to the far right by a full-width field); reset when unmatched. #128
    if (slot.committed) { inp.style.flex = '0 1 auto'; inp.size = Math.max(3, String(slot.name || inp.value || '').length + 1); }
    else { inp.style.flex = ''; inp.removeAttribute('size'); }
    // content-sizing the matched field leaves a short name with almost no click target, so clicking
    // anywhere in the rest of the bar (the empty space / alias) focuses it to open the search. #128
    search.onmousedown = e => { if (e.target === inp || e.target.closest('.tc-joinwrap, .mk')) return; e.preventDefault(); inp.focus(); };
    if (aka) { const al = document.createElement('span'); al.className = 'tc-bar-aka'; al.textContent = aka; al.title = aka; search.insertBefore(al, ref); }
    if (!slot.committed) { const mk = document.createElement('button'); mk.className = 'mk'; mk.textContent = '＋'; mk.title = 'create this artist on MusicBrainz'; mk.onmousedown = e => { e.preventDefault(); createArtist(inp.value.trim() || slot.creditedAs, slot); }; search.insertBefore(mk, ref); }
  }
  // the badge column: a pill per artist line, plus a hover overlay with the track ↺/✕ actions
  function renderBadgeCell(cell, track) {
    const changed = trackChanged(track);   // ↺ only makes sense (and only shows) when there's something to revert
    const locked = mediumLocked(track.mi);   // disc-ID medium: no remove button (#125)
    cell.innerHTML = track.slots.map(s => `<div class="tc-bl">${s.committed ? `<span class="tc-badge ${s.status}">${badgeText(s)}</span>` : ''}</div>`).join('')
      + `<div class="tc-trackacts">${changed ? '<button class="trev" title="revert this track">↺</button>' : ''}${locked ? '' : '<button class="rm" title="remove track">✕</button>'}</div>`;
    const trev = cell.querySelector('.trev'); if (trev) trev.onclick = () => revertTrack(track);
    const rm = cell.querySelector('.rm'); if (rm) rm.onclick = () => { removeTrack(track); rebuild(); };
    const row = cell.closest('tr'); if (row) row.classList.toggle('tc-changed', changed);   // mark the row (left border)
  }
  // join phrase: editable text that grows right-to-left, plus a ▾ that opens the presets list
  function joinControl(entry, slot, refreshBadges) {
    const wrap = document.createElement('span'); wrap.className = 'tc-joinwrap';
    const inp = document.createElement('input'); inp.className = 'tc-join'; inp.value = slot.joinPhrase || ''; inp.title = 'join phrase to the next artist (editable; ▾ for presets)';
    const fit = () => { inp.size = Math.max(2, inp.value.length || 2); }; fit();
    inp.oninput = fit; inp.onchange = () => { slot.joinPhrase = inp.value; commitTrack(entry); if (refreshBadges) refreshBadges(); }; enterBlurs(inp);
    const arrow = document.createElement('button'); arrow.className = 'tc-joinarrow'; arrow.textContent = '▾'; arrow.title = 'common join phrases';
    let pop = null; const close = () => { if (pop) { pop.remove(); pop = null; } };
    arrow.onclick = () => {
      if (pop) { close(); return; }
      pop = document.createElement('div'); pop.className = 'tc-acpop tc-joinpop';
      pop.innerHTML = JOIN_OPTIONS.map(o => `<div class="tc-acrow" data-v="${esc(o.value)}"><span class="nm">${esc(o.label)}</span><span class="cmt">"${esc(o.value)}"</span></div>`).join('');
      document.body.appendChild(pop); const r = inp.getBoundingClientRect(); pop.style.left = Math.max(4, r.right - 150) + 'px'; pop.style.top = (r.bottom + 4) + 'px'; pop.style.minWidth = '150px';
      [...pop.querySelectorAll('[data-v]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); inp.value = row.dataset.v; fit(); slot.joinPhrase = inp.value; commitTrack(entry); if (refreshBadges) refreshBadges(); close(); }; });
      const off = e => { if (pop && !pop.contains(e.target) && e.target !== arrow) { close(); document.removeEventListener('mousedown', off); } }; setTimeout(() => document.addEventListener('mousedown', off), 0);
    };
    wrap.appendChild(inp); wrap.appendChild(arrow);
    return wrap;
  }
  // attach the type-to-search autocomplete to an existing <input>
  function wireAutocomplete(inp, slot, refresh) {
    let pop = null, list = [], hi = -1, seq = 0, onScroll = null;
    let curQuery = '', curLimit = 8;   // "Show more…" pagination: bump the limit and re-search
    const position = () => { if (!pop) return; const r = inp.getBoundingClientRect(); pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 2) + 'px'; pop.style.minWidth = Math.max(210, r.width) + 'px'; };
    const ensure = () => { if (pop) return; pop = document.createElement('div'); pop.className = 'tc-acpop'; document.body.appendChild(pop); onScroll = () => { if (!pop || !pop.isConnected) { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); pop = null; } else position(); }; window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll); position(); };
    const close = () => { if (pop) pop.remove(); pop = null; hi = -1; if (onScroll) { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); onScroll = null; } };
    const choose = c => { close(); pickArtist(slot, c); };
    const searching = () => { ensure(); list = []; pop.innerHTML = `<div class="tc-acrow none">Searching…</div>`; position(); };
    const akaHtml = c => { const a = aliasStr(c); return a ? `<span class="tc-aka">${esc(a)}</span>` : ''; };
    // a full page of results probably means there are more — offer "Show more…" (like MB's native popup)
    const loadMore = () => { curLimit = curLimit >= 50 ? 100 : curLimit >= 25 ? 50 : 25; const my = ++seq; const more = pop && pop.querySelector('.tc-acmore'); if (more) more.textContent = 'Loading…'; searchArtist(curQuery, curLimit).then(res => { if (my === seq && document.activeElement === inp) showResults(res, curQuery); }); };
    const draw = arr => {
      ensure(); list = arr; const q = inp.value.trim() || slot.creditedAs;
      pop.innerHTML = arr.length ? arr.map((c, i) => `<div class="tc-acrow${sameName(c.name, q) ? ' exact' : ''}" data-i="${i}"><span class="tic">${typeSvg(c)}</span><span class="nm">${esc(c.name)}</span>${akaHtml(c)}${c.comment ? `<span class="cmt">${esc(c.comment)}</span>` : ''}</div>`).join('') : `<div class="tc-acrow none">no matches — use ＋ to create</div>`;
      [...pop.querySelectorAll('.tc-acrow[data-i]')].forEach(row => { row.title = 'click to set · Ctrl-click to set on all unresolved tracks'; row.onmousedown = e => { e.preventDefault(); const c = arr[+row.dataset.i]; if (e.ctrlKey || e.metaKey) { close(); pickArtistAllUnresolved(c); } else choose(c); }; });
      if (curQuery && arr.length >= curLimit && curLimit < 100) {   // likely more available → a clickable "Show more…" footer
        const more = document.createElement('div'); more.className = 'tc-acrow tc-acmore'; more.textContent = 'Show more…';
        more.onmousedown = e => { e.preventDefault(); loadMore(); };
        pop.appendChild(more);
      }
      position();
    };
    // patch in the full aliases (one WS2 search) without a full redraw, so it doesn't reset the keyboard highlight
    const patchAliases = arr => { if (!pop) return; arr.forEach((c, i) => { const a = aliasStr(c); if (!a) return; const row = pop.querySelector(`.tc-acrow[data-i="${i}"]`); if (!row) return; let sp = row.querySelector('.tc-aka'); if (!sp) { sp = document.createElement('span'); sp.className = 'tc-aka'; const nm = row.querySelector('.nm'); nm.parentNode.insertBefore(sp, nm.nextSibling); } sp.textContent = a; }); };
    const showResults = (arr, q) => {
      draw(arr);
      // Fetch aliases for the EXACT result gids (batched, limit 100) — not the old by-name query
      // capped at 12, which left every "Show more" result past the 12th with no alias. Caches into
      // _gidAliases so a pick (and the resolved bar) get the alias too. #128
      fetchAliasesByGids(arr.map(c => c.gid)).then(() => {
        if (document.activeElement !== inp || !pop) return;
        arr.forEach(c => { const a = _gidAliases.get(c.gid); if (a && a.length) c.aliases = a; });
        patchAliases(arr);
      });
    };
    const runSearch = q => { curQuery = q; curLimit = 8; const my = ++seq; searching(); searchArtist(q).then(res => { if (my === seq && document.activeElement === inp) showResults(res, q); }); };
    // paste an MBID or a MusicBrainz /artist/<mbid> URL → resolve it straight to that artist. Gate on the
    // field value (not focus): a commit-rerender can steal focus before the fetch returns.
    const resolveByGid = async gid => { ensure(); list = []; pop.innerHTML = `<div class="tc-acrow none">Resolving…</div>`; position(); const ent = await fetchEntity(gid); if (mbidFrom(inp.value) !== gid) return; if (ent && ent.id) { const entry = slot._entry, i = entry.slots.indexOf(slot); close(); pickArtist(slot, ent); focusSlotInput(entry, i); } else { pop.innerHTML = `<div class="tc-acrow none">MBID not found</div>`; } };   // refocus the (re-rendered) field so keyboard nav keeps working after a paste
    inp.onfocus = () => {
      if (slot.committed && slot.candidates && slot.candidates.length) { curQuery = inp.value.trim() || slot.creditedAs || slot.name; curLimit = 8; showResults(slot.candidates, curQuery); return; }
      const q = inp.value.trim() || (slot.creditedAs || '').trim(); if (q) runSearch(q); else close();   // empty → no dropdown
    };
    let tmr; inp.oninput = () => {
      slot.query = inp.value;
      clearTimeout(tmr);
      const gid = mbidFrom(inp.value); if (gid) { resolveByGid(gid); return; }   // pasted an MBID / artist URL → resolve directly (pickArtist replaces whatever was there; no un-link needed)
      // editing away from the matched artist un-links it: bar goes white, ＋ creates the typed name
      if (slot.committed && !sameName(inp.value, slot.name)) { slot.committed = false; slot.status = 'none'; slot.entity = null; slot.gid = null; commitTrack(slot._entry); if (refresh) refresh(); }
      if (!inp.value.trim()) { close(); return; }   // nothing typed → don't search
      searching(); const my = ++seq; tmr = setTimeout(async () => { curQuery = inp.value; curLimit = 8; const res = await searchArtist(inp.value); if (my === seq && document.activeElement === inp) showResults(res, inp.value); }, 250);
    };
    // arrows browse the results popup WHILE searching; once the slot is resolved they move row-to-row instead
    const browsing = () => pop && !slot.committed && list.length;
    // highlight the row at index `hi` and keep it on screen (the popup scrolls, so a selection past the
    // last visible row was going off-screen) — #128-adjacent nav fix
    const hiliteRow = () => { const rows = [...pop.querySelectorAll('[data-i]')]; rows.forEach((r, i) => r.classList.toggle('hi', i === hi)); const cur = rows[hi]; if (cur) cur.scrollIntoView({ block: 'nearest' }); };
    inp.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); inp.focus(); }   // close the popup but keep the field focused, so the next ↓ navigates rows
      else if (e.key === 'ArrowDown') { if (browsing()) { hi = Math.min(list.length - 1, hi + 1); hiliteRow(); e.preventDefault(); } else { close(); if (focusSameField(inp, 1)) e.preventDefault(); } }
      else if (e.key === 'ArrowUp') { if (browsing()) { hi = Math.max(0, hi - 1); hiliteRow(); e.preventDefault(); } else { close(); if (focusSameField(inp, -1)) e.preventDefault(); } }
      else if (e.key === 'Enter') { e.preventDefault(); const c = list[hi >= 0 ? hi : 0]; if (c) { const entry = slot._entry, i = entry.slots.indexOf(slot); choose(c); focusSlotInput(entry, i); } }   // keep focus on the field after picking (so ↓ moves on)
    };
    inp.onblur = () => setTimeout(close, 160);   // keep whatever the user typed (no reset)
  }

  // one artist = one aligned line: [credited-as][icon][green/white search bar][join][↵ hover][✕ hover]
  function slotEl(entry, s, idx, refreshBadges) {
    const line = document.createElement('div'); line.className = 'tc-aslot';
    // "splittable" (several artists) drives both the credited-as highlight and the ⋔ button, via a line
    // class that updates live as you edit
    if (splitArtistText(s.creditedAs || s.name || s.query || '').length > 1) line.classList.add('tc-can-split');
    // credited-as: shown empty when it's exactly the artist name (the name is the placeholder); only a real override shows
    const same = s.name && s.creditedAs === s.name;
    const cred = document.createElement('input'); cred.className = 'tc-cred'; cred.value = (s.creditedAs && !same) ? s.creditedAs : ''; cred.placeholder = s.name || 'credit…'; cred.title = 'credited-as override (blank = same as the artist name)';
    cred.oninput = () => line.classList.toggle('tc-can-split', splitArtistText(cred.value || s.name || '').length > 1);   // re-evaluate the highlight / ⋔ as you type
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
      refreshBadges();   // a credited-as edit changes the track → update the ↺ button + changed-row border now
    }; wireRowNav(cred); line.appendChild(cred);
    const ic = document.createElement(s.gid ? 'a' : 'span'); ic.className = 'tc-tic ' + (s.gid ? 'link' : 'dim'); ic.innerHTML = typeSvg(s.entity);
    if (s.gid) { ic.href = `${ORIGIN}/artist/${s.gid}`; ic.target = '_blank'; ic.rel = 'noopener'; ic.title = 'open artist page'; } else ic.title = 'no artist linked yet';
    line.appendChild(ic);
    const search = document.createElement('span'); search.className = 'tc-search';
    const inp = document.createElement('input'); inp.className = 'nm'; inp.value = s.committed ? (s.name || s.creditedAs) : (s.query || s.creditedAs || ''); inp.placeholder = 'search artist…'; inp.title = inp.value;
    search.appendChild(inp);
    if (idx < entry.slots.length - 1) search.appendChild(joinControl(entry, s, refreshBadges));   // join lives inside the box, right side
    adorn(search, s, inp); if (s._marked) search.classList.add('tc-marked'); if (s._flash) { search.classList.add('tc-flash'); delete s._flash; } line.appendChild(search);
    wireAutocomplete(inp, s, () => { adorn(search, s, inp); refreshBadges(); refreshStatus(); });
    // fixed-width actions area (keeps all search boxes the same width); both reveal on row hover
    const acts = document.createElement('span'); acts.className = 'tc-acts';
    const add = document.createElement('button'); add.className = 'tc-enter'; add.textContent = '↵'; add.title = 'add another artist to this credit'; add.onclick = () => addSlotAfter(entry, idx); acts.appendChild(add);
    // ⋔ split: only when this credit looks like several artists (& / feat. / , …)
    { const sp = document.createElement('button'); sp.className = 'tc-splitb'; sp.textContent = '⋔'; sp.title = 'split into separate artists (& / feat. …) and match'; sp.onclick = () => splitSlot(entry, idx); acts.appendChild(sp); }
    if (entry.slots.length > 1) { const x = document.createElement('button'); x.className = 'tc-slotx'; x.textContent = '✕'; x.title = 'remove this artist'; x.onclick = () => removeSlot(entry, idx); acts.appendChild(x); }
    line.appendChild(acts);
    return line;
  }
  // drag-to-reorder WITHIN a medium: grab the ⠿ handle and drop a track anywhere in its medium. The actual
  // move rides on MB's own up/down ops (moveTrackToIndex), so the editor never diverges. Cross-medium drops
  // are ignored (same-medium only). Replaces the old ▲▼ buttons.
  let _drag = null;   // { mi, ti } of the row being dragged
  const clearDropMarks = tb => tb && tb.querySelectorAll('.tc-drop-before,.tc-drop-after').forEach(r => r.classList.remove('tc-drop-before', 'tc-drop-after'));
  const dropAfter = (tr, clientY) => { const r = tr.getBoundingClientRect(); return (clientY - r.top) > r.height / 2; };
  function wireDragReorder(tr, t) {
    const handle = tr.querySelector('.tc-drag');
    if (handle) {
      handle.addEventListener('dragstart', e => {
        _drag = { mi: t.mi, ti: t.ti }; e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', t.mi + ':' + t.ti); } catch (x) {}
        try { e.dataTransfer.setDragImage(tr, 18, 12); } catch (x) {}
        tr.classList.add('tc-dragging');
      });
      handle.addEventListener('dragend', () => { tr.classList.remove('tc-dragging'); clearDropMarks(tr.parentElement); _drag = null; });
    }
    tr.addEventListener('dragover', e => {
      if (!_drag || _drag.mi !== t.mi) return;   // same medium only
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      clearDropMarks(tr.parentElement); tr.classList.add(dropAfter(tr, e.clientY) ? 'tc-drop-after' : 'tc-drop-before');
    });
    tr.addEventListener('dragleave', () => tr.classList.remove('tc-drop-before', 'tc-drop-after'));
    tr.addEventListener('drop', e => {
      if (!_drag || _drag.mi !== t.mi) return;
      e.preventDefault();
      const fromTi = _drag.ti, gap = t.ti + (dropAfter(tr, e.clientY) ? 1 : 0), dest = gap > fromTi ? gap - 1 : gap;
      clearDropMarks(tr.parentElement); _drag = null;
      if (moveTrackToIndex({ mi: t.mi, ti: fromTi, number: fromTi + 1 }, dest)) rebuild();
    });
  }
  function fillRows(tbody, mi) {
    document.querySelectorAll('.tc-acpop').forEach(p => p.remove());   // rebuilding rows detaches inputs — drop any open search/join popups so they can't orphan
    tbody.innerHTML = ''; let lastMi = -1; const multi = mediums().length > 1 && mi == null;
    const tracks = (mi == null) ? MODEL.tracks : MODEL.tracks.filter(t => t.mi === mi);
    tracks.forEach(t => {
      if (multi && t.mi !== lastMi) { const r = document.createElement('tr'); r.innerHTML = `<td class="tc-medhdr" colspan="${COLS.length}">Medium ${t.mi + 1}</td>`; tbody.appendChild(r); lastMi = t.mi; }
      const tr = document.createElement('tr'); tr.dataset.tk = t.mi + ':' + t.ti; tr.dataset.mi = t.mi; tr.dataset.ti = t.ti;
      const locked = mediumLocked(t.mi);   // disc-ID medium: no reorder handle (#125)
      tr.innerHTML = `<td class="c-mv">${locked ? '' : '<span class="tc-drag" draggable="true" title="drag to reorder within this medium">⠿</span>'}</td>
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
        const gb = document.createElement('button'); gb.className = 't-gc'; gb.textContent = 'Aa'; gb.title = 'Guess case → ' + t.guessTitle + '\n(right-click: guess case all tracks)';
        const wrap = tr.querySelector('.t-wrap');
        // like MB's integrated guess case: hovering the title cell previews the guessed name
        // (highlighted), leaving restores it, clicking Aa applies it. Never preview while editing.
        const preview = () => { if (document.activeElement !== tin) { tin.value = t.guessTitle; tin.classList.add('gcpreview'); } };
        const restore = () => { tin.value = t.title; tin.classList.remove('gcpreview'); };
        wrap.onmouseenter = preview; wrap.onmouseleave = () => { if (document.activeElement !== tin) restore(); };
        tin.addEventListener('focus', restore);   // clicking in to edit shows the real title, not the preview
        gb.onclick = () => { restore(); applyGuessTitle(t); t.title = u(koTrack(t.mi, t.ti).name); t.guessTitle = guessTitleStr(t); rerender(); };
        // right-click the [Aa] runs guess case on every track (same as the Tools-menu action) — #123
        gb.oncontextmenu = e => { e.preventDefault(); restore(); guessCaseAll(); };
        wrap.appendChild(gb);
      }
      // featured-artist split: flag titles carrying "feat./ft./featuring" and offer the split inline,
      // mirroring [Aa] — click ⋔ splits this track, right-click splits all (#124)
      if (FEAT_RE.test(t.title)) {
        tin.classList.add('hasfeat'); if (!tin.title) tin.title = 'Title has a featured artist';
        const fb = document.createElement('button'); fb.className = 't-feat'; fb.textContent = '⋔';
        fb.title = 'Split featured artist out of the title into the artist credit\n(right-click: split all tracks)';
        fb.onclick = () => guessFeatTrack(t);
        fb.oncontextmenu = e => { e.preventDefault(); guessFeatAll(); };
        tr.querySelector('.t-wrap').appendChild(fb);
      }
      tin.onchange = e => { setTitle(t, e.target.value); t.title = e.target.value; t.guessTitle = guessTitleStr(t); rerender(); }; wireRowNav(tin);
      const numIn = tr.querySelector('.t-num'), lenIn = tr.querySelector('.t-len');
      numIn.onchange = e => { setNumber(t, e.target.value); refreshBadges(); }; wireRowNav(numIn);
      lenIn.onchange = e => {
        let v = e.target.value.trim();
        if (v) { const ed = getEditor(); const ms = ed && ed.utils && ed.utils.unformatTrackLength ? ed.utils.unformatTrackLength(v) : NaN; if (ms == null || isNaN(ms)) v = ''; }   // invalid (letters/garbage) → delete; valid shorthand like "111" is kept (MB normalizes it to 1:11)
        setLength(t, v);
        try { const ko = koTrack(t.mi, t.ti); const norm = typeof ko.formattedLength === 'function' ? (u(ko.formattedLength()) || '') : v; e.target.value = norm; t.length = norm; } catch (err) { e.target.value = v; t.length = v; }   // reflect MB's normalized value back into the cell immediately
        refreshBadges();
      }; wireRowNav(lenIn);
      wireDragReorder(tr, t);
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
  async function rebuild(noMatch) {
    MODEL = buildShell();
    if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); }
    rerender();
    if (!noMatch && SETTINGS.autoMatch !== false) await matchModel();
    enrichResolvedAliases();
  }
  // revert to the page-load state, but DON'T auto-match (that only runs on startup) — Match is manual here
  function revertAll() { if (!MODEL) return; if (!W.confirm("Revert every track to what it was when the page loaded?")) return; MODEL.tracks.forEach(resetTrack); rebuild(true); }
  function guessCaseAll() { if (!MODEL) return; MODEL.tracks.forEach(t => { applyGuessTitle(t); t.title = u(koTrack(t.mi, t.ti).name); t.guessTitle = guessTitleStr(t); }); rerender(); Log.info('guess case → all titles'); }
  // titles carrying a featured-artist credit ("Foo feat. X", "ft.", "featuring") — detect so the
  // row can flag them and offer the split inline (#124). Needs a space/bracket/start before the
  // marker and whitespace/bracket/end after, so words like "soft"/"feats"/"drift" don't trip it.
  const FEAT_RE = /(?:^|[\s([])(?:feat|ft|featuring)\.?(?=[\s)\]]|$)/i;
  // integrated MB feature: pull "feat. X" out of titles into artist credits, then re-read + re-match
  async function guessFeatAll() {
    const ed = getEditor();
    mediums().forEach(med => (u(med.tracks) || []).forEach(t => { try { ed.guessTrackFeatArtists(t); } catch (e) { try { ed.guessTrackFeatArtists(t, { type: 'click' }); } catch (e2) { Log.warn('guess feat failed', e2.message); } } }));
    await loadAndRender(); Log.info('guessed feat artists from titles');
  }
  // single-track variant — fired by the per-track ⋔ split button (#124)
  async function guessFeatTrack(entry) {
    const ed = getEditor(), t = koTrack(entry.mi, entry.ti);
    try { ed.guessTrackFeatArtists(t); } catch (e) { try { ed.guessTrackFeatArtists(t, { type: 'click' }); } catch (e2) { Log.warn('guess feat failed', e2.message); } }
    await loadAndRender(); Log.info('guessed feat artists for track', entry.number);
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
    else if (a === 'cols') colsFit();   // the Columns button's default action is Fit
    else if (MEDIUM_TOOLS.has(a)) runMediumTool(a, 0);
  }
  function bindActions(host) {
    host.querySelectorAll('[data-act]').forEach(b => {
      const a = b.dataset.act;
      b.onclick = () => { if (a === 'menu') openToolsMenu(b); else if (a === 'tool') runActiveTool(); else if (a === 'gear') openSettings(b); else if (a === 'revertmenu') openMiniMenu(b, [{ label: '↺ Revert all', title: 'revert every track to its page-load state', onClick: revertAll }, { label: '✕ Clear all', title: 'unselect every track artist, keeping the credited-as text (titles and lengths kept)', onClick: clearAllTracks }]); else if (a === 'close') { host.remove(); ACTIVE = {}; } else runAction(a); };
    });
  }
  // a small one-off dropdown (e.g. the ▾ next to "Revert all"); items: {label, title?, onClick}
  function openMiniMenu(anchor, items) {
    document.querySelectorAll('.tc-menu.tc-mini').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'tc-menu tc-mini';
    m.innerHTML = items.map((it, i) => `<div class="tc-mi" data-i="${i}"${it.title ? ` title="${esc(it.title)}"` : ''}>${esc(it.label)}</div>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); const w = m.offsetWidth, h = m.offsetHeight;
    // right-align the menu to the anchor (opens leftward) and clamp on-screen, so it never runs off the edge
    m.style.left = Math.round(Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))) + 'px';
    m.style.top = Math.round(Math.max(8, Math.min(r.bottom + 4, window.innerHeight - h - 8))) + 'px';
    m.querySelectorAll('.tc-mi').forEach(el => el.onclick = () => { const it = items[+el.dataset.i]; m.remove(); it.onClick(); });
    const off = e => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off, true); } };
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  }
  // Tracklist "Clear all": empty the title, artist credit and length of every track (with confirm)
  function clearAllTracks() {
    if (!MODEL) return;
    if (!W.confirm('Unselect the artist of EVERY track? (the credited-as text, titles and lengths are kept; does not submit)')) return;
    MODEL.tracks.forEach(t => {
      try {
        const ko = koTrack(t.mi, t.ti); const names = u(u(ko.artistCredit).names) || [];
        // keep each credit's display text (the credited-as name, or the artist's name if none) but drop the
        // selected entity — turning a matched artist back into unmatched text (artist: bare {name}), ready
        // to re-match. Mirrors how commitTrack writes an unresolved slot.
        ko.artistCredit({ names: names.map(n => { const text = u(n.name) || (n.artist && u(u(n.artist).name)) || ''; return { artist: { name: text }, name: text, joinPhrase: u(n.joinPhrase) || '' }; }) });
      } catch (e) {}
    });
    Log.info('cleared all track artist selections (kept credited-as text)'); rebuild(true);   // no re-match, or it would instantly re-link the kept text
  }

  /* ── the Tools split-button: last-used tool is the button's label + default action; ▾ picks another ── */
  const MENU = [{ act: 'parser', label: 'Track parser' }, { act: 'swap', label: 'Swap' }, { act: 'resetnum', label: 'Reset #' }, { sep: 1 }, { act: 'guessfeat', label: 'Guess feat.' }, { act: 'guesscase', label: 'Guess case' }, { act: 'sr', label: 'Search and Replace' }, { sep: 1 }, { act: 'cols', label: 'Resize columns' }];
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
    } else if (act === 'cols') {
      const box = document.createElement('span'); box.className = 'tc-colso';
      const mk = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-colbtn'; b.textContent = label; b.title = title; b.onclick = fn; return b; };
      box.append(
        mk('Fit', 'size #, Title and Length to their content (Artist absorbs the slack)', colsFit),
        mk('Centered', 'balance Title and Artist to equal width', colsBalanced),
        mk('Default', 'reset every column to its default width', colsDefault),
      );
      host.appendChild(box);
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
    + `<span class="sp"></span><span class="tc-toast"></span><span class="sp"></span><span class="tc-globalstat"></span><label class="tc-am-lbl"><b>Change</b> ${AM_SELECT}</label><span class="tc-tbsep"></span><button class="tc-btn primary" data-act="match" title="search MusicBrainz for the unmatched artists">⚡ Match</button>`
    + `<button class="tc-btn tc-caret" data-act="revertmenu" title="revert / clear all">▾</button>`;   // gear moved to the Apollo launcher

  /* ── floating window (kept for tests; the in-page table is the real UI) ── */
  function openPanel() {
    style(); const ex = document.getElementById('tc-panel'); if (ex) ex.remove(); const l = document.getElementById('tc-launch'); if (l) l.remove();
    const p = document.createElement('div'); p.id = 'tc-panel';
    p.innerHTML = `<div id="tc-hdr">${ICON}<b>Apollo Editor</b><span class="sp"></span>${BAR}<button class="tc-icon" data-act="close" title="close">✕</button></div>
      <div id="tc-body"></div>`;
    document.body.appendChild(p);
    const tbody = mountTable(p.querySelector('#tc-body'));
    ACTIVE = { mode: 'float', tbody, statusEl: p.querySelector('.tc-hstatus') };
    const hdr = p.querySelector('#tc-hdr');
    hdr.onmousedown = e => { if (e.target.closest('button')) return; const r = p.getBoundingClientRect(); const ox = e.clientX - r.left, oy = e.clientY - r.top; p.style.right = 'auto'; const mm = ev => { p.style.left = Math.max(0, ev.clientX - ox) + 'px'; p.style.top = Math.max(0, ev.clientY - oy) + 'px'; }; const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); };
    bindActions(p); initTools(); wireApplyMode(p);
    loadAndRender((d, n) => updateStatus(`matching ${d}/${n}…`));
  }

  /* ── in-page replacement (the only mode) ── */
  let _showOriginal = false;
  function nativeTrackTables(root) { return [...(root || document).querySelectorAll('table')].filter(t => t.querySelector('tr.track')); }
  // the native tracklist = track tables + the #tracklist-tools row + the Guess-case fieldset; hide/show
  // together (the format header is lifted out, not hidden). MB's medium WARNINGS are NOT hidden — every
  // one (capitalization, Digital-Media/packaging, …) stays visible above the Apollo table.
  function nativeBits() {
    // SCOPE to the Tracklist tab only — the Recordings tab has its own track table (recording associations)
    // that we must NOT hide (issue #114). every medium has its own tools row (MB reuses id "tracklist-tools").
    const tl = document.getElementById('tracklist'); if (!tl) return [];
    return [...nativeTrackTables(tl), ...tl.querySelectorAll('table.medium, [id="tracklist-tools"], fieldset.guesscase, .guesscase')];
  }
  function setNativeHidden(hidden) {
    nativeBits().forEach(el => { el.style.display = hidden ? 'none' : ''; });
    // keep ALL real medium warnings visible even in Apollo (force them back on in case a prior version or MB left one hidden)
    document.querySelectorAll('fieldset.advanced-medium .warning').forEach(w => { w.style.display = ''; });
  }
  // mount one Apollo section (its own table header + Add footer) per medium, placed right before that
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
    _apolloUsed = true;
    style(); let wrap = document.getElementById('tc-mirror-wrap');
    if (wrap) { syncNative(); return; }
    // the global toolbar sits once at the very top of the Tracklist panel; per-medium tables mount below
    wrap = document.createElement('div'); wrap.id = 'tc-mirror-wrap';
    const firstFs = document.querySelector('fieldset.advanced-medium');
    if (firstFs && firstFs.parentElement) firstFs.parentElement.insertBefore(wrap, firstFs);
    else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(wrap);
    wrap.innerHTML = `<div id="tc-bar">${BAR}</div>`;
    ACTIVE = { mode: 'mirror', sections: [] };
    bindActions(wrap); initTools(); wireApplyMode(wrap); subscribeTracks();
    await loadAndRender((d, n) => updateStatus(`matching ${d}/${n}…`));
  }
  function hideMirror() { untidyMediums(); document.querySelectorAll('.tc-medsec').forEach(s => s.remove()); const w = document.getElementById('tc-mirror-wrap'); if (w) w.remove(); setNativeHidden(false); if (ACTIVE.mode === 'mirror') ACTIVE = {}; }

  /* ── entry points: ONE Original/Apollo toggle, applied to whichever editor tab you're on (#119) ── */
  // each managed tab tracks whether its Apollo mirror is shown. It INITIALISES from the persisted
  // "Replace … on start" setting; the Original/Apollo launcher then toggles it transiently, per tab —
  // so the launcher always works even when a "replace on start" option is off. #119
  // #135: the Apollo/Original switch is GLOBAL — one persisted flag toggles every feature on all tabs and stays
  // until switched back. Each replace* setting still chooses which features Apollo takes over when it's enabled.
  function apolloEnabled() { return SETTINGS.apolloEnabled !== false; }
  function tlWant() { return apolloEnabled() && SETTINGS.replaceTracklist !== false; }
  function recWant() { return apolloEnabled() && SETTINGS.replaceRecordings !== false; }
  function riWant() { return apolloEnabled() && SETTINGS.replaceReleaseInfo !== false; }
  function releaseInfoVisible() { const p = document.getElementById('information'); return !!(p && p.offsetParent !== null); }
  function curWant() { return apolloEnabled(); }
  function apolloOn() { return apolloEnabled(); }
  function relabelLauncher() { const lbl = document.querySelector('#tc-launch .tc-launch-lbl'); if (lbl) lbl.textContent = apolloEnabled() ? 'Original' : 'Apollo Editor'; }
  // show/hide each visible managed tab's mirror per its want
  function applyView() {
    recStyle();   // make sure the recordings CSS (incl. the native-table hide rule) exists up front
    if (tracklistVisible()) { if (tlWant()) { if (!document.getElementById('tc-mirror-wrap')) showMirror(); } else hideMirror(); }
    if (recordingsVisible()) { if (recWant()) showRecMirror(); else hideRecMirror(); }
    if (releaseInfoVisible()) applyReleaseInfo();
    relabelLauncher();
  }
  function ensureLauncher() {
    if (document.getElementById('tc-launch')) { relabelLauncher(); return; }
    style(); const b = document.createElement('div'); b.id = 'tc-launch';
    const lbl = document.createElement('span'); lbl.className = 'tc-launch-lbl'; lbl.title = 'Toggle Apollo / the original editor for ALL tabs — stays this way (across pages) until you switch back';
    lbl.onclick = () => {   // GLOBAL toggle — flips Apollo for every tab/feature and persists across pages
      SETTINGS.apolloEnabled = !apolloEnabled(); saveSettings();
      applyView(); applyNav();
    };
    const gear = document.createElement('span'); gear.className = 'tc-launch-gear'; gear.textContent = '⚙'; gear.title = 'Apollo Editor settings';
    gear.onclick = () => openSettings(gear);   // the one settings entry point — gear removed from the toolbars
    b.append(lbl, gear);
    document.body.appendChild(b); relabelLauncher();
  }
  function tracklistVisible() { const p = document.getElementById('tracklist'); return !!(p && p.offsetParent !== null); }   // the Tracklist tab panel is shown
  let _tlPrev = false, _recPrev = false, _tlRefreshed = false;
  // single watcher for both managed tabs; the one launcher persists across them and is removed elsewhere
  function watchTabs() {
    const tick = () => {
      const tl = tracklistVisible(), rec = recordingsVisible();
      if (document.getElementById('tc-mirror-wrap')) syncNative();   // keep native tracklist bits in their chosen state if MB re-renders
      if (tl && !_tlPrev) { _tlPrev = true; Log.info('entered Tracklist tab');
        if (tlWant()) { if (!document.getElementById('tc-mirror-wrap')) showMirror(); else if (!_tlRefreshed) { _tlRefreshed = true; loadAndRender(); } } else hideMirror(); }
      else if (!tl && _tlPrev) { _tlPrev = false; }
      if (rec && !_recPrev) { _recPrev = true; Log.info('entered Recordings tab'); }
      else if (!rec && _recPrev) { _recPrev = false; }
      // mount as soon as the (lazily-built) native table exists — retry each tick so there's no native flash
      if (rec) { if (recWant()) { if (!document.getElementById('tc-recwrap')) showRecMirror(); else if (recSig() !== _lastRecSig) rerenderRec(); } else hideRecMirror(); }   // re-render when MB mutates a recording externally (e.g. cleared on a title edit)
      if (releaseInfoVisible()) applyReleaseInfo();
      if (editorEl()) ensureLauncher(); else { const l = document.getElementById('tc-launch'); if (l) l.remove(); }   // #135: the switch shows on every tab
      if (navOn() && editorEl()) { if (!document.getElementById('tc-nav-steps')) applyNav(); else syncNav(); relocateAddMedium(); }   // keep compact nav alive + synced
    };
    tick(); setInterval(tick, 500);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RECORDING MATCHER (#119) — Recordings tab.  WIP — Phase 1: in-page comparison view.
     Takes over the native recording-assignment table (toggle via the shared Original/Apollo
     button) and shows track vs recording (title / artist / length) with a confidence colour and
     per-field diff highlight. Drives MB's recording association (setRecordingValue /
     suggestedRecordings / updateRecordingTitle|Artist); row actions land in P2.
  ═══════════════════════════════════════════════════════════════════════ */
  // artist-credit display text (the recording AC has no .text() helper, so build it from names)
  function acText(ac) {
    if (!ac) return '';
    try { if (typeof ac.text === 'function') { const t = ac.text(); if (t) return t; } } catch (e) {}
    const names = u(ac.names) || [];
    return names.map(n => (u(n.name) || (n.artist && u(u(n.artist).name)) || '') + (u(n.joinPhrase) || '')).join('');
  }
  // the ordered artist-entity gids behind an artist credit (ignores the credited-as display names)
  function acArtistGids(ac) {
    const names = u(ac && ac.names) || [];
    return names.map(n => n.artist && u(u(n.artist).gid)).filter(Boolean);
  }
  // true when a track and recording credit the SAME artist entities (same gids, same order) — i.e. any
  // text difference between them is only a "credited as" name, not a real different artist. #119
  function sameArtistEntities(track, rec) {
    const a = acArtistGids(u(track.artistCredit)), b = acArtistGids(rec ? u(rec.artistCredit) : null);
    return a.length > 0 && a.length === b.length && a.every((g, i) => g === b[i]);
  }
  // a length gap up to SETTINGS.recLenTol seconds (default 5) is treated as identical (MB lengths jitter).
  // Measured in WHOLE on-screen seconds so rows that LOOK the same get the same verdict. #119
  function recLenTolMs() { return (SETTINGS.recLenTol != null ? SETTINGS.recLenTol : 5) * 1000; }
  function recLenGap(a, b) {
    if (!a || !b) return 0;
    const gap = Math.abs(Math.round(a / 1000) - Math.round(b / 1000)) * 1000;   // gap in whole displayed seconds
    return gap <= recLenTolMs() ? 0 : gap;
  }
  // shared text normalisation for matching: case/accents (Ignore casing) + punctuation/symbols (Ignore punctuation)
  function recFold(s) {
    let t = SETTINGS.recIgnoreCase !== false ? fold(s) : String(s || '');
    if (SETTINGS.recIgnorePunct) t = t.replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
    return t;
  }
  function recNameEq(a, b) { return recFold(a) === recFold(b); }   // exact after normalisation (used for artist)
  // Levenshtein edit distance — backs the "Title tolerance" (allow up to N differing characters)
  function recLev(a, b) {
    if (a === b) return 0; if (!a) return b.length; if (!b) return a.length;
    const n = b.length; let prev = []; for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  // title equality: normalised, then within the "Title tolerance" edit distance (0 = exact)
  function recTitleEq(a, b) { const x = recFold(a), y = recFold(b); if (x === y) return true; const tol = SETTINGS.recTitleTol || 0; return tol > 0 && recLev(x, y) <= tol; }
  // an IDEAL match: title/length/artist match WITHOUT any relaxation option (ignore-punctuation, title or
  // length tolerance) — only case/accent folding. Preferred by auto-match and shown distinctly. #119
  function recExactMatch(data, ctx) {
    if (!ctx) return false;
    const titleEq = !data.name || !ctx.title || fold(data.name) === fold(ctx.title);
    const artistEq = !data.artist || !ctx.artist || fold(data.artist) === fold(ctx.artist);
    const lenEq = !data.length || !ctx.length || Math.round(data.length / 1000) === Math.round(ctx.length / 1000);
    return titleEq && artistEq && lenEq;
  }
  // per-field diff between a track and its recording: title/artist via MB's own flags, length in ms
  function recFieldDiffs(track, rec) {
    let title = false, artist = false;
    try { if (typeof track.titleDiffersFromRecording === 'function') title = !!track.titleDiffersFromRecording(); } catch (e) {}
    try { if (typeof track.artistDiffersFromRecording === 'function') artist = !!track.artistDiffersFromRecording(); } catch (e) {}
    // a "credited as" (same artist entity, different credit name) is NOT a real artist mismatch — don't
    // let it drag the match confidence down; it's still the right recording. #119
    if (artist && sameArtistEntities(track, rec)) artist = false;
    // a casing-only (cosmetic) difference is not a real mismatch when "ignore casing" is on
    if (title && recTitleEq(u(track.name), rec ? u(rec.name) : '')) title = false;
    if (artist && recNameEq(acText(u(track.artistCredit)), acText(rec ? u(rec.artistCredit) : null))) artist = false;
    const lenDiff = recLenGap(u(track.length), rec ? u(rec.length) : null);
    return { title, artist, lenDiff, len: lenDiff > 0 };
  }
  // Confidence ported from "Quick Recording Match": null = perfect (green), else low / vlow / xlow
  // (yellow / orange / red), graded by how many fields differ and by how far the length is off.
  // single source of truth for the confidence colors — used by the row dots AND the Cutoff picker
  const CONF_COLOR = { exact: '#2f6fd6', tolerance: '#86c686', near: '#fff176', low: '#ffb74d', vlow: '#d32f2f' };
  const REC_CONF = {   // the colored bands below exact/tolerance (keys = display names)
    near: { c: CONF_COLOR.near, label: 'near' },
    low:  { c: CONF_COLOR.low, label: 'low' },
    vlow: { c: CONF_COLOR.vlow, label: 'very low' },
  };
  function recConfidence(track, rec, d) {
    if (!rec || !u(rec.gid)) return null;
    d = d || recFieldDiffs(track, rec);
    const diffs = [];
    if (d.title) diffs.push('title');
    if (d.artist) diffs.push('artist');
    if (d.lenDiff > 0) diffs.push('length ' + Math.round(d.lenDiff / 1000) + 's');
    let level = null;
    if (diffs.length >= 3 && d.lenDiff > 10000) level = 'vlow';
    else if (d.lenDiff > 15000) level = 'low';
    else if (diffs.length >= 2 && d.lenDiff <= 15000) level = 'low';
    else if (diffs.length === 1 || d.lenDiff > 3000) level = 'near';
    if (!level) return null;
    return { level, color: REC_CONF[level].c, label: REC_CONF[level].label, diffs };
  }
  const fmtMs = ms => (ms || ms === 0) ? (Math.floor(Math.round(ms / 1000) / 60) + ':' + String(Math.round(ms / 1000) % 60).padStart(2, '0')) : '';
  // artist-credit rendered as links to each artist's page (joined by their join phrases)
  function acLinks(ac) {
    const names = u(ac && ac.names) || [];
    if (!names.length) return '';
    return names.map(n => {
      const nm = u(n.name) || (n.artist && u(u(n.artist).name)) || '';
      const gid = n.artist && u(u(n.artist).gid);
      return (gid ? '<a href="' + ORIGIN + '/artist/' + esc(gid) + '" target="_blank" rel="noopener">' + esc(nm) + '</a>' : esc(nm)) + esc(u(n.joinPhrase) || '');
    }).join('');
  }
  // read each track's recording association + the data needed to compare them side by side
  function readRecordings() {
    const out = [];
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const rec = u(t.recording);
      const sugg = (typeof t.suggestedRecordings === 'function' ? (u(t.suggestedRecordings) || []) : []);
      const diffs = rec ? recFieldDiffs(t, rec) : null;
      // ideal/exact match: title + length match with NO relaxation option used (fold only, no punctuation/
      // edit-distance/length tolerance). A credited-as artist (same entity) still counts as exact. #119
      const exact = !!(rec && fold(u(t.name)) === fold(u(rec.name))
        && (!u(t.length) || !u(rec.length) || Math.round(u(t.length) / 1000) === Math.round(u(rec.length) / 1000))
        && (sameArtistEntities(t, rec) || fold(acText(u(t.artistCredit))) === fold(acText(u(rec.artistCredit)))));
      // which fields a green (within-tolerance) match still differs on — for the dot tooltip
      const tolDiffs = [];
      if (rec) {
        if (fold(u(t.name)) !== fold(u(rec.name))) tolDiffs.push('title');
        if (u(t.length) && u(rec.length) && Math.round(u(t.length) / 1000) !== Math.round(u(rec.length) / 1000)) tolDiffs.push('length ' + Math.round(Math.abs(u(t.length) - u(rec.length)) / 1000) + 's');
        if (!(sameArtistEntities(t, rec) || fold(acText(u(t.artistCredit))) === fold(acText(u(rec.artistCredit))))) tolDiffs.push('artist');
      }
      out.push({
        exact, tolDiffs,
        mi, ti, number: u(t.number), title: u(t.name), trackArtist: acText(u(t.artistCredit)), trackArtistHtml: acLinks(u(t.artistCredit)), trackLen: u(t.length),
        isNew: typeof t.hasNewRecording === 'function' ? !!u(t.hasNewRecording) : false,
        recGid: rec ? u(rec.gid) : null, recName: rec ? u(rec.name) : null, recArtist: rec ? acText(u(rec.artistCredit)) : null, recArtistHtml: rec ? acLinks(u(rec.artistCredit)) : '', recLen: rec ? u(rec.length) : null,
        // submit-flags: when on, the recording's title/artist will be overwritten with the track's on submit
        copyTitle: typeof t.updateRecordingTitle === 'function' ? !!u(t.updateRecordingTitle) : false,
        copyArtist: typeof t.updateRecordingArtist === 'function' ? !!u(t.updateRecordingArtist) : false,
        suggCount: sugg.length, diffs, conf: rec ? recConfidence(t, rec, diffs) : null,
      });
    }));
    return out;
  }
  let _recStyled = false;
  function recStyle() {
    if (_recStyled) return; _recStyled = true;
    const s = document.createElement('style');
    s.textContent = [
      '#tc-recwrap{margin:4px 0 12px;font:13px/1.4 system-ui,Arial}',
      '#tc-recwrap .tc-recbar{display:flex;align-items:center;gap:8px;padding:2px 2px 8px;font-weight:600}',
      '#tc-recwrap .tc-recbar .tc-ico{vertical-align:-5px}',
      '#tc-recwrap .tc-recwarn{color:#b00;font-weight:600}#tc-recwrap .tc-recwarn:hover{text-decoration:underline;cursor:pointer}',
      // consistent with the Tracklist tab toolbar (#tc-bar / .tc-btn): same bar spacing, button look, inputs.
      // sticky at the top while the table scrolls (mirrors #tc-mirror-wrap) so it stays reachable on big releases.
      '#tc-recwrap .tc-rec-tb{display:flex;align-items:center;gap:8px;padding:6px 4px;flex-wrap:wrap;position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e3dcf2;box-shadow:0 3px 8px rgba(40,20,80,.07)}',
      '#tc-recwrap .tc-rec-tb .sp{flex:1}',   // flex spacer: Clear hugs the left, the Match cluster hugs the right (mirrors #tc-bar)
      // flat buttons that match the Tracklist tab's .tc-btn (transparent until hover); Match keeps the bold-purple primary look
      '#tc-recwrap .tc-rec-tb button{padding:4px 11px;border:1px solid transparent;border-radius:3px;background:transparent;cursor:pointer;font:13px Arial;color:#444}#tc-recwrap .tc-rec-tb button:hover{background:linear-gradient(#fff,#eee);border-color:#bbb}',
      '#tc-recwrap .tc-rec-split{display:inline-flex}#tc-recwrap .tc-rec-revcaret{padding:4px 6px;color:#7d6bc0}',
      '#tc-recwrap .tc-rec-tb button.primary{color:#5f3ec0;font-weight:bold}#tc-recwrap .tc-rec-tb button.primary:hover{background:linear-gradient(#7a52df,#5f3ec0);color:#fff;border-color:#4f33a3}',
      '#tc-recwrap .tc-rec-tbl{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#555;font-family:"Bitstream Vera Sans",Verdana,Arial,sans-serif}',
      '#tc-recwrap .tc-rec-tbl b{color:#563b8f}',   // bold label word in MB purple, matching #tc-bar b on the Tracklist toolbar
      '#tc-recwrap .tc-cutoff{display:inline-flex;align-items:center;gap:6px;border:1px solid #cfcfcf;border-radius:14px;padding:2px 9px;cursor:pointer;font:12px Arial;background:#fff;user-select:none}',
      '#tc-recwrap .tc-cutoff:hover{border-color:#b3b3b3}',
      '.tc-cutoff-dot,.tc-cutoff-menu .dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.18);flex:none}',
      '#tc-recwrap .tc-cutoff-caret{color:#999;font-size:10px}',
      '.tc-cutoff-menu{position:fixed;z-index:100002;background:#fff;border:1px solid #ccc;border-radius:7px;box-shadow:0 8px 24px rgba(40,20,80,.22);padding:4px;font:13px Arial}',
      '.tc-cutoff-menu .mi{display:flex;align-items:center;gap:9px;padding:5px 11px 5px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;color:#333}',
      '.tc-cutoff-menu .mi:hover,.tc-cutoff-menu .mi.sel{background:#f0ecfa}',
      '#tc-recwrap .tc-rec-amstatus{color:#6f42c1;font-size:12px;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;padding-right:4px}',
      '.tc-rectbl .tc-recname{position:relative}',
      '.tc-rectbl .tc-rec-rev{position:absolute;right:3px;top:50%;transform:translateY(-50%);border:none;background:#fff;cursor:pointer;color:#7d6bc0;font-size:15px;line-height:1;visibility:hidden;padding:1px 4px;border-radius:3px}',
      '.tc-rectbl tr.tc-recrow:hover .tc-rec-rev{visibility:visible}.tc-rectbl .tc-rec-rev:hover{color:#5f3ec0;background:#ede9f6}',
      'table.tc-rectbl{border-collapse:collapse;width:100%;background:#fff;table-layout:fixed}',
      '.tc-rectbl td{overflow-wrap:anywhere}',
      '.tc-rectbl th{text-align:left;font-size:11px;color:#777;border-bottom:1px solid #ccc;padding:4px 7px;white-space:nowrap}',
      '.tc-rectbl td{padding:4px 7px;vertical-align:top}',
      '.tc-rectbl.gridrows td{border-bottom:1px solid #e0e0e0}',
      // density layouts (same names as the Tracklist tab): compact tighter, cozy airier, normal = default
      '.tc-rectbl.compact th{padding:2px 7px}.tc-rectbl.compact td{padding:1px 7px}',
      '.tc-rectbl.cozy th{padding:7px 7px}.tc-rectbl.cozy td{padding:8px 7px}',
      // grid option: column separators on both tables
      '.tc-rectbl.gridcols td,.tc-rectbl.gridcols th{border-right:1px solid #ededed}.tc-rectbl.gridcols td:last-child,.tc-rectbl.gridcols th:last-child{border-right:none}',
      '.tc-rectbl.alt tbody tr.tc-recrow:nth-of-type(even) td:not(.tc-diff):not(.tc-copy){background:#f6f4fb}',   // zebra skips highlighted cells so their colour always shows',
      '.tc-rectbl tr.tc-recmed td{background:#f3f0fa;font-weight:600;color:#4b2e83}',
      '.tc-rectbl tr.tc-recchanged td:first-child{box-shadow:inset 3px 0 0 #5f3ec0}',   // changed-row marker, like the Tracklist tab',
      '.tc-rectbl .c-n{color:#999;text-align:right;width:34px;min-width:34px;white-space:nowrap}',
      '.tc-rectbl .c-sep{width:20px;text-align:center}',
      // group header (Track | Recording) + a vertical divider down the middle so the two halves read clearly
      '.tc-rectbl .tc-grouphd th{padding:5px 7px 3px;border-bottom:none;font-size:11px;font-weight:700;letter-spacing:.04em}',
      '.tc-rectbl .tc-grp{text-align:center;border-radius:5px 5px 0 0}',
      '.tc-rectbl .tc-grp-l{background:#eef3fb;color:#2c5d9b}',
      '.tc-rectbl .tc-grp-r{background:#f1ecf9;color:#5b3fa0}',
      '.tc-rectbl th.c-sep,.tc-rectbl td.c-sep{border-left:1px solid #e6e0f2;border-right:1px solid #e6e0f2}',
      '.tc-rectbl .c-len{color:#555;white-space:nowrap;font-variant-numeric:tabular-nums;text-align:right;width:48px}',
      '.tc-rectbl .c-sugg{color:#6f42c1;text-align:center;width:34px}',
      '.tc-rectbl .tc-tkt{font-weight:600}',
      '.tc-rectbl .tc-rec-none{color:#c0392b}.tc-rectbl .tc-rec-new{color:#2c7a51}',
      '.tc-rectbl td.tc-diff{background:#ffecec;color:#b00}',
      '.tc-rectbl td.tc-copy{background:#e3f4e7;color:#1f7a44;font-style:italic}',   // flagged to copy the track value on submit
      '.tc-rectbl td.tc-clickable{cursor:pointer}',
      '.tc-rectbl td.tc-clickable:hover{outline:1px solid #9cc6ab;outline-offset:-1px}',
      '.tc-rectbl td a{color:#2c5d9b;text-decoration:none}.tc-rectbl td a:hover{text-decoration:underline}',
      '.tc-rectbl .tc-recname{font-weight:600}',
      '.tc-recpop .tc-rpk-copy{padding:5px 10px;border-bottom:1px solid #eee;display:flex;flex-direction:column;gap:3px;background:#fbfaff}',
      '.tc-recpop .tc-rpk-copy label{cursor:pointer;color:#444;font-size:11px;display:flex;align-items:center;gap:5px}',
      '.tc-recpop .tc-rpk-row{border-left:3px solid transparent}',
      '.tc-recpop .tc-rpk-row.tc-conf-exact{border-left-color:#2f6fd6}',
      '.tc-recpop .tc-rpk-row.tc-conf-tolerance{border-left-color:#86c686}',
      '.tc-recpop .tc-rpk-row.tc-conf-near{border-left-color:#fff176}',
      '.tc-recpop .tc-rpk-row.tc-conf-low{border-left-color:#ffb74d}',
      '.tc-recpop .tc-rpk-row.tc-conf-vlow{border-left-color:#d32f2f}',
      '.tc-rectbl .tc-dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.15)}',
      '.tc-rectbl tr.tc-recrow:hover td:not(.tc-diff):not(.tc-copy){background:#fafaff}',
      '.tc-rectbl .tc-recpick{cursor:pointer;border:1px solid #d6cdec;background:#f6f3fc;color:#6f42c1;border-radius:4px;padding:1px 6px;font:11px Arial;white-space:nowrap}',
      '.tc-rectbl .tc-recpick:hover{background:#ece5f8}',
      '.tc-recpop{position:fixed;z-index:100003;width:410px;overflow:auto;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 8px 28px rgba(40,20,80,.28);font:12px Arial}',
      '.tc-recpop .tc-rpk-hd{position:sticky;top:0;z-index:1}',
      '.tc-recpop .tc-rpk-hd{padding:7px 10px;background:#f3f0fa;border-bottom:1px solid #e3def2;border-radius:6px 6px 0 0}',
      '.tc-recpop .tc-rpk-curwrap{border-bottom:1px solid #eee}',   // one separator under the whole current-recording group
      '.tc-recpop .tc-rpk-cur{padding:6px 10px 3px;color:#444;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.tc-recpop .tc-rpk-curactions{display:flex;padding:2px 10px 7px}',   // "+ new recording" sits below appears-on, right-aligned
      '.tc-recpop .tc-rpk-curlbl{color:#999;font-size:11px}.tc-recpop .tc-rpk-curlen{color:#888;font-variant-numeric:tabular-nums}',
      '.tc-recpop .tc-rpk-curnone{color:#c0392b}.tc-recpop .tc-rpk-newcur{color:#2c7a51}',
      '.tc-recpop .tc-rpk-newbtn{margin-left:auto;cursor:pointer;border:1px solid #bcdcc6;background:#eef7f0;color:#1f7a44;border-radius:4px;padding:2px 7px;font:11px Arial}.tc-recpop .tc-rpk-newbtn:hover{background:#e0f0e6}',
      '.tc-recpop .tc-rpk-qwrap{display:flex;align-items:stretch;gap:6px;margin:8px}',
      '.tc-recpop .tc-rpk-q{flex:1;min-width:0;padding:5px 7px;border:1px solid #c9c2dd;border-radius:4px;font:12px Arial;box-sizing:border-box}',
      '.tc-recpop .tc-rpk-qnew{flex:none;cursor:pointer;border:1px solid #bcdcc6;background:#eef7f0;color:#1f7a44;border-radius:4px;font:bold 16px Arial;line-height:1;padding:0 10px}.tc-recpop .tc-rpk-qnew:hover{background:#e0f0e6}',
      '.tc-recpop .tc-rpk-hdby a{color:#2c5d9b;text-decoration:none}.tc-recpop .tc-rpk-hdby a:hover{text-decoration:underline}',
      '.tc-recpop .tc-rpk-sec{display:flex;align-items:center;justify-content:space-between;padding:3px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#999;background:#faf8ff}',
      '.tc-recpop .tc-rpk-suggsec{cursor:pointer;user-select:none}.tc-recpop .tc-rpk-suggsec:hover{color:#6f42c1}',
      '.tc-recpop .tc-rpk-caret{display:inline-block;font-size:9px;transition:transform .1s}',
      '.tc-recpop.tc-sugg-collapsed .tc-rpk-sugg{display:none}.tc-recpop.tc-sugg-collapsed .tc-rpk-caret{transform:rotate(-90deg)}',
      '.tc-recpop .tc-rpk-relax{text-transform:none;letter-spacing:0;border:1px solid #cfc6e6;background:#fff;color:#6f42c1;border-radius:4px;padding:1px 7px;font:10px Arial;cursor:pointer}',
      '.tc-recpop .tc-rpk-relax:hover{background:#f1ecfa}.tc-recpop .tc-rpk-relax.on{background:#6f42c1;color:#fff;border-color:#6f42c1}',
      '.tc-recpop .tc-rpk-row{padding:5px 10px;cursor:pointer;border-bottom:1px solid #f1edf9}',
      '.tc-recpop .tc-rpk-row:hover{background:#ede9f6}',
      '.tc-recpop .tc-rpk-main{display:flex;align-items:baseline;gap:6px}',
      '.tc-recpop .tc-rpk-name{font-weight:600;color:#222}',
      '.tc-recpop .tc-rpk-cmt{color:#888;font-size:11px}',
      '.tc-recpop .tc-rpk-len{margin-left:auto;color:#666;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.tc-recpop .tc-rpk-by{color:#555;font-size:11px}',
      '.tc-recpop .tc-rpk-on{color:#777;font-size:11px}',
      '.tc-recpop .tc-rpk-on a,.tc-recpop .tc-rpk-curon a{color:#2c5d9b;text-decoration:none}.tc-recpop .tc-rpk-on a:hover,.tc-recpop .tc-rpk-curon a:hover{text-decoration:underline}',
      '.tc-recpop .tc-rpk-more{color:#999;font-style:italic}',
      '.tc-recpop .tc-rpk-rgx{color:#888;font-size:10px;font-weight:600}',
      // header subtitle = the song (track) artist + length; current-recording artist + its full appears-on
      '.tc-recpop .tc-rpk-hdby{color:#6a6a6a;font-weight:normal}.tc-recpop .tc-rpk-hdlen{color:#888;font-weight:normal;font-variant-numeric:tabular-nums}',
      '.tc-recpop .tc-rpk-curby{color:#555;font-size:12px}',
      '.tc-recpop .tc-rpk-curon{padding:0 10px 4px;color:#777;font-size:11px}',
      '.tc-recpop .tc-rpk-isrc{color:#9a8fb5;font-size:11px;font-family:Consolas,monospace}',
      '.tc-recpop .tc-rpk-fdiff{background:#ffecec;color:#b00;border-radius:2px;padding:0 2px}',
      '.tc-recpop .tc-rpk-empty{padding:8px 10px;color:#999;font-style:italic}',
      // hide the native recording table from the first paint (no flash) and let our table use the
      // full width instead of MB's .half-width column (#119)
      'body.tc-rec-on #track-recording-assignation{display:none!important}',
      'body.tc-rec-on #recordings .half-width{max-width:none!important;width:auto!important}',
      // the recordings tab has one native <fieldset> per medium (legend "Medium N" + its own assignation
      // table) plus an Options fieldset. Our Apollo table is inserted INTO the first medium's fieldset, so
      // we can't hide that one wholesale: hide every OTHER native fieldset (other mediums' tables + Options),
      // and in the host fieldset strip the box + hide the native legend and table. Leaves only our table. #119
      'body.tc-rec-on #recordings fieldset:not(:has(#tc-recwrap)){display:none!important}',
      'body.tc-rec-on #recordings fieldset:has(#tc-recwrap){border:none!important;margin:0!important;padding:0!important}',
      'body.tc-rec-on #recordings fieldset:has(#tc-recwrap) > legend{display:none!important}',
      'body.tc-rec-on #recordings fieldset:has(#tc-recwrap) > table{display:none!important}',
    ].join('\n');
    document.head.appendChild(s);
  }
  // build the toolbar + table shell once; the body is (re)rendered separately so a re-render during
  // auto-match updates rows live without rebuilding/resetting the toolbar. #119
  function renderRecMirror(wrap) {
    wrap.innerHTML =
      '<div class="tc-rec-tb">' +
        '<span class="tc-rec-amstatus"></span>' +   // flexible filler: its text changes absorb here, never reflowing the bar
        '<label class="tc-rec-tbl" title="Auto-match only links a recording when its confidence is at or above this level; anything lower is left unmatched."><b>Cutoff</b> <span class="tc-cutoff" tabindex="0"><span class="tc-cutoff-dot"></span><span class="tc-cutoff-lbl"></span><span class="tc-cutoff-caret">▾</span></span></label>' +
        '<span class="tc-recwarn"></span>' +
        '<span class="tc-tbsep"></span>' +
        '<button class="tc-rec-am tc-btn primary" type="button" title="auto-match unset recordings to MusicBrainz suggestions">⚡ Match</button>' +
        '<button class="tc-rec-revcaret" type="button" title="revert / clear all">▾</button>' +
        '' +   /* gear moved to the Apollo launcher */
      '</div>' +
      '<table class="tc-rectbl ' + (SETTINGS.layout || 'normal') + (SETTINGS.altRows ? ' alt' : '') + (SETTINGS.gridCols ? ' gridcols' : '') + (SETTINGS.gridRows !== false ? ' gridrows' : '') + '">' +
        '<colgroup><col style="width:2.5%"><col style="width:25.5%"><col style="width:18%"><col style="width:4%"><col style="width:2%"><col style="width:26%"><col style="width:18%"><col style="width:4%"></colgroup>' +
        '<thead>' +
        '<tr class="tc-grouphd"><th colspan="4" class="tc-grp tc-grp-l">Track</th><th class="c-sep"></th><th colspan="3" class="tc-grp tc-grp-r">Recording</th></tr>' +
        '<tr><th class="c-n">#</th><th>Title</th><th>Artist</th><th class="c-len">Length</th>' +
        '<th class="c-sep"></th><th>Title</th><th>Artist</th><th class="c-len">Length</th></tr></thead><tbody></tbody></table>';
    // wire the toolbar (once)
    wireCutoff(wrap);
    const amBtn = wrap.querySelector('.tc-rec-am'); if (amBtn) amBtn.onclick = () => autoMatchRecordings();
    const revCaret = wrap.querySelector('.tc-rec-revcaret'); if (revCaret) revCaret.onclick = () => openMiniMenu(revCaret, [{ label: '↺ Revert all', title: 'revert every recording to its page-load state', onClick: revertAllRecordings }, { label: '✕ Clear all', title: 'set every track to a new recording', onClick: clearAllRecordings }]);
    renderRecBody(wrap);
  }
  // custom Cutoff picker — a colored-dot dropdown that uses the SAME hex palette as the row dots
  // (a native <select> can't show the exact colors, only emoji approximations)
  function wireCutoff(wrap) {
    const host = wrap.querySelector('.tc-cutoff'); if (!host) return;
    const dotEl = host.querySelector('.tc-cutoff-dot'), lblEl = host.querySelector('.tc-cutoff-lbl');
    const OPTS = [['exact', 'exact'], ['tolerance', 'tolerance'], ['near', 'near'], ['low', 'low'], ['vlow', 'very low']];
    const paint = () => { const v = SETTINGS.recCutoff || 'near'; const o = OPTS.find(x => x[0] === v) || OPTS[2]; dotEl.style.background = CONF_COLOR[v]; lblEl.textContent = o[1]; };
    paint();
    host.onclick = () => {
      document.querySelectorAll('.tc-cutoff-menu').forEach(m => m.remove());
      const cur = SETTINGS.recCutoff || 'near';
      const m = document.createElement('div'); m.className = 'tc-cutoff-menu';
      m.innerHTML = OPTS.map(([v, l]) => `<div class="mi${v === cur ? ' sel' : ''}" data-v="${v}"><span class="dot" style="background:${CONF_COLOR[v]}"></span>${l}</div>`).join('');
      document.body.appendChild(m);
      const r = host.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 3) + 'px';
      m.querySelectorAll('.mi').forEach(it => it.onmousedown = e => { e.preventDefault(); SETTINGS.recCutoff = it.dataset.v; saveSettings(); paint(); m.remove(); });
      const off = e => { if (!m.contains(e.target) && !host.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } };
      setTimeout(() => document.addEventListener('mousedown', off), 0);
    };
  }
  // lightweight fingerprint of the live recording state. The tab watcher compares
  // it each tick so the mirror re-renders when MB changes a recording externally —
  // e.g. it clears a track's recording after the track title is edited — instead of
  // only updating on our own picker actions (stale-row bug).
  let _lastRecSig = '';
  function recSig() {
    let s = '';
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const rec = u(t.recording); const gid = rec ? (u(rec.gid) || '') : '';
      const isNew = (typeof t.hasNewRecording === 'function' && u(t.hasNewRecording)) ? 'N' : '';
      s += mi + ':' + ti + ':' + gid + ':' + isNew + ':' + (u(t.name) || '') + '|';
    }));
    return s;
  }
  // jump from the toolbar "N without a recording" to the first such track's picker
  function openFirstUnsetPicker(row) {
    const wrap = document.getElementById('tc-recwrap'); if (!wrap || !row) return;
    const tr = wrap.querySelector('tbody tr.tc-recrow[data-mi="' + row.mi + '"][data-ti="' + row.ti + '"]');
    if (tr) tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    openRecPicker(row, (tr && tr.querySelector('.tc-recname')) || wrap.querySelector('.tc-recwarn'));
  }
  // (re)render just the rows + the unset-count — leaves the toolbar (status/inputs) untouched
  function renderRecBody(wrap) {
    wrap = wrap || document.getElementById('tc-recwrap'); if (!wrap) return;
    const tb = wrap.querySelector('tbody'); if (!tb) return;
    const rows = readRecordings();
    const multi = mediums().length > 1;
    const unset = rows.filter(r => !r.recGid && !r.isNew).length;
    const firstUnset = rows.find(r => !r.recGid && !r.isNew);
    const warn = wrap.querySelector('.tc-recwarn');
    if (warn) {
      warn.textContent = unset ? '⚠ ' + unset + ' without a recording' : '';
      warn.onclick = (unset && firstUnset) ? () => openFirstUnsetPicker(firstUnset) : null;   // #139 follow-up: jump to the first unset track's picker
      warn.title = unset ? 'jump to the first track without a recording' : '';
    }
    tb.innerHTML = '';
    let lastMi = -1;
    rows.forEach(r => {
      if (multi && r.mi !== lastMi) { lastMi = r.mi; const mr = document.createElement('tr'); mr.className = 'tc-recmed'; mr.innerHTML = '<td colspan="8">Medium ' + (r.mi + 1) + '</td>'; tb.appendChild(mr); }
      const d = r.diffs || {};
      // recording name: click to open the picker. Artists are links. When a copy-to-match flag is set
      // (from the picker), the cell previews the track value the recording will become (green). #119
      const titleCell = r.copyTitle ? '→ ' + esc(r.title || '')
        : r.isNew ? '<span class="tc-rec-new">＋ new recording</span>' : r.recName ? esc(r.recName) : '<span class="tc-rec-none">— none —</span>';
      const artistCell = r.copyArtist ? '→ ' + esc(r.trackArtist || '') : (r.recArtistHtml || '');
      const tolHas = f => (r.tolDiffs || []).some(x => x === f || x.startsWith(f));   // within-tolerance diffs highlight the cells too
      const tCls = r.copyTitle ? 'tc-copy' : (d.title || tolHas('title') ? 'tc-diff' : '');
      const aCls = r.copyArtist ? 'tc-copy' : (d.artist || tolHas('artist') ? 'tc-diff' : '');
      const changed = recChangedFromOrig(r.mi, r.ti);   // differs from the page-load recording
      const tr = document.createElement('tr'); tr.className = 'tc-recrow' + (changed ? ' tc-recchanged' : ''); tr.dataset.mi = r.mi; tr.dataset.ti = r.ti;
      tr.innerHTML =
        '<td class="c-n">' + esc(String(r.number == null ? '' : r.number)) + '</td>' +
        '<td class="tc-tkt">' + esc(r.title || '') + '</td>' +
        '<td>' + (r.trackArtistHtml || '') + '</td>' +
        '<td class="c-len">' + fmtMs(r.trackLen) + '</td>' +
        '<td class="c-sep"><span class="tc-dot"></span></td>' +
        '<td class="tc-recname ' + tCls + '">' + titleCell + '</td>' +
        '<td class="' + aCls + '">' + artistCell + '</td>' +
        '<td class="c-len ' + (d.len || tolHas('length') ? 'tc-diff' : '') + '">' + fmtMs(r.recLen) + '</td>';
      const dot = tr.querySelector('.tc-dot');
      if (r.conf) { dot.style.background = r.conf.color; dot.title = r.conf.label + ' — differs: ' + r.conf.diffs.join(', '); }
      else if (r.recGid) { dot.style.background = r.exact ? CONF_COLOR.exact : CONF_COLOR.tolerance; dot.title = r.exact ? 'Exact match' : 'Tolerance match' + (r.tolDiffs && r.tolDiffs.length ? ' (' + r.tolDiffs.join(', ') + ')' : ''); }
      else dot.style.visibility = 'hidden';
      const nameCell = tr.querySelector('.tc-recname');
      nameCell.classList.add('tc-clickable'); nameCell.title = 'change recording — suggestions / search';
      nameCell.onclick = () => openRecPicker(r, nameCell);
      if (changed) {   // per-row revert ↺ (single), shown on hover when changed
        const rev = document.createElement('button'); rev.className = 'tc-rec-rev'; rev.textContent = '↺'; rev.title = 'revert to the original recording';
        rev.onclick = e => { e.stopPropagation(); revertRecording(r); };
        nameCell.appendChild(rev);
      }
      tb.appendChild(tr);
    });
    _lastRecSig = recSig();   // mark the state this render reflects, so the tick only re-renders on real changes
  }
  // confidence level of a candidate vs the track: 0 tolerance(green) · 1 near · 2 low · 3 very low
  // "Cutoff" = the LOWEST confidence still auto-linked; anything below it is left unmatched. Levels run
  // best→worst: exact(blue) 0 · tolerance(green) 1 · near 2 · low 3 · very low 4. A candidate links
  // when its combined level ≤ the chosen cutoff. #119
  const CUTOFF = { exact: 0, tolerance: 1, near: 2, low: 3, vlow: 4 };
  function recComboLevel(d, ctx) { return recExactMatch(d, ctx) ? 0 : recConfLevel(d, ctx) + 1; }   // fold exact/green into one ladder with the lower bands
  function recConfLevel(data, ctx) {
    if (!ctx) return 0;
    let n = 0; const lenDiff = recLenGap(data.length, ctx.length);
    if (data.name && ctx.title && !recTitleEq(data.name, ctx.title)) n++;
    if (data.artist && ctx.artist && !recNameEq(data.artist, ctx.artist)) n++;
    if (lenDiff > 0) n++;
    if (n >= 3 && lenDiff > 10000) return 3;
    if (lenDiff > 15000) return 2;
    if (n >= 2 && lenDiff <= 15000) return 2;
    if (n === 1 || lenDiff > 3000) return 1;
    return 0;
  }
  // Auto-match: for each UNSET track, load MB's suggestions and link the BEST-confidence one (not just
  // MB's first) when it clears the "ignore below" threshold. Already-linked tracks are left untouched. #119
  let _autoMatching = false;
  async function autoMatchRecordings() {
    if (_autoMatching) return; _autoMatching = true;
    const wrap = document.getElementById('tc-recwrap');
    const setStatus = t => { const e = wrap && wrap.querySelector('.tc-rec-amstatus'); if (e) e.textContent = t; };
    const maxLevel = CUTOFF[SETTINGS.recCutoff || 'near'];
    let linked = 0, considered = 0;
    try {
      // ONE request: pull the whole release group's recordings, index by normalised title, match locally
      let byTitle = new Map(), pool = [];
      try {
        const rel = release(); const rg = rel && u(rel.releaseGroup); const rgGid = rg && u(rg.gid);
        if (rgGid) { setStatus('loading release-group recordings…'); pool = await fetchRgRecordings(rgGid); pool.forEach(p => { const k = recFold(p.name); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(p); }); }
      } catch (e) { Log.warn('RG pool load failed', e.message); }
      const todo = readRecordings().filter(r => !r.recGid);
      for (let i = 0; i < todo.length; i++) {
        const r = todo[i]; considered++;
        setStatus('auto-matching ' + (i + 1) + '/' + todo.length + '…');
        const ko = koTrack(r.mi, r.ti);
        const ctx = { title: r.title, artist: r.trackArtist, length: r.trackLen };
        // best candidate from the local RG pool (normalised-title match; fuzzy scan if a Title tolerance is set).
        // lower confidence level wins; within the same level, an EXACT (no-tolerance) match is preferred. #119
        let best = null, bestLevel = Infinity;
        const consider = d => { const lvl = recComboLevel(d, ctx); if (lvl < bestLevel) { bestLevel = lvl; best = d; } };   // lower combined level (exact < tolerance < near < …) wins
        let cands = byTitle.get(recFold(r.title)) || [];
        if (!cands.length && (SETTINGS.recTitleTol || 0) > 0 && pool.length) cands = pool.filter(p => recTitleEq(p.name, r.title));
        cands.forEach(consider);
        // only fall back to MB's per-track lookup (network) when the pool had nothing good enough
        if (!best || bestLevel > maxLevel) {
          let sugg = (typeof ko.suggestedRecordings === 'function' ? (u(ko.suggestedRecordings) || []) : []);
          if (!sugg.length) {
            try { getEditor().recordingAssociation.findRecordingSuggestions(ko); } catch (e) {}
            for (let t = 0; t < 28; t++) { await new Promise(z => setTimeout(z, 250)); const loading = typeof ko.loadingSuggestedRecordings === 'function' ? u(ko.loadingSuggestedRecordings) : false; sugg = u(ko.suggestedRecordings) || []; if (!loading && sugg.length) break; if (!loading && t >= 3) break; }
          }
          for (let s = 0; s < sugg.length; s++) { consider(suggData(sugg[s])); if (bestLevel === 0) break; }   // 0 = exact, can't do better
        }
        if (best && bestLevel <= maxLevel) { try { ko.setRecordingValue(recEntityFrom(best)); linked++; renderRecBody(); } catch (e) { Log.warn('auto-match set failed', e.message); } }
      }
    } finally {
      _autoMatching = false;
      rerenderRec();
      const w = document.getElementById('tc-recwrap'); const e = w && w.querySelector('.tc-rec-amstatus'); if (e) e.textContent = 'linked ' + linked + ' of ' + considered + ' unset track' + (considered === 1 ? '' : 's');
      Log.info('auto-match: linked', linked, 'of', considered, 'unset tracks');
    }
  }
  // submit-flag setters (per track / all tracks) + a light re-render of the recordings table
  function setCopy(field, entry, on) {
    try { const t = koTrack(entry.mi, entry.ti); if (field === 'title') t.updateRecordingTitle(on); else t.updateRecordingArtist(on); }
    catch (e) { Log.warn('set copy ' + field + ' failed', e.message); }
  }
  function setCopyAll(field) {
    const flag = field === 'title' ? 'copyTitle' : 'copyArtist';
    // only the rows where this field actually differs (or is already flagged) — copying a matching value is a no-op
    const rows = readRecordings().filter(r => r.recGid && ((r.diffs && r.diffs[field]) || r[flag]));
    const allOn = rows.length && rows.every(r => r[flag]);   // toggle: if every eligible row is on, turn all off
    rows.forEach(r => setCopy(field, r, !allOn));
    Log.info((allOn ? 'cleared' : 'set') + ' copy-' + field + ' on all ' + rows.length + ' recording(s)');
  }
  function rerenderRec() { renderRecBody(); }   // body only — keeps the toolbar (status / inputs) intact

  /* ── original-recording snapshot for revert + clear-all (#119) ── */
  const _recOrig = new Map(); let _recSnapped = false;
  function snapshotRecOriginals() {
    if (_recSnapped) return; _recSnapped = true;
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const r = u(t.recording);
      _recOrig.set(mi + ':' + ti, { entity: r, gid: r ? u(r.gid) : null, isNew: typeof t.hasNewRecording === 'function' ? !!u(t.hasNewRecording) : false });
    }));
  }
  function _restoreRec(entry, o) {
    const ko = koTrack(entry.mi, entry.ti);
    try { if (o.isNew) ko.hasNewRecording(true); else if (o.entity) ko.setRecordingValue(o.entity); } catch (e) { Log.warn('revert recording failed', e.message); }
  }
  function recChangedFromOrig(mi, ti) {
    const o = _recOrig.get(mi + ':' + ti); if (!o) return false;
    const ko = koTrack(mi, ti), r = u(ko.recording);
    const curGid = r ? u(r.gid) : null, curNew = typeof ko.hasNewRecording === 'function' ? !!u(ko.hasNewRecording) : false;
    return curGid !== o.gid || curNew !== o.isNew;
  }
  function revertRecording(entry) { const o = _recOrig.get(entry.mi + ':' + entry.ti); if (o) { _restoreRec(entry, o); rerenderRec(); Log.info('reverted recording for track', entry.ti + 1); } }
  function revertAllRecordings() { _recOrig.forEach((o, key) => { const p = key.split(':'); _restoreRec({ mi: +p[0], ti: +p[1] }, o); }); rerenderRec(); Log.info('reverted all recordings to the page-load state'); }
  function clearAllRecordings() {
    if (!W.confirm('Set every track to a NEW recording (clear all existing recording links)?')) return;
    mediums().forEach(med => (u(med.tracks) || []).forEach(t => { try { t.hasNewRecording(true); } catch (e) {} }));
    rerenderRec(); Log.info('cleared all recording links → new recordings');
  }

  /* ── recording picker (#119 P2.2): suggestions + search-by-name → setRecordingValue ── */
  let _recPop = null, _recPopAnchor = null, _recPopPos = null;   // _recPopPos persists a dragged location across reopens
  function closeRecPop() {
    if (!_recPop) return;
    _recPop.remove(); _recPop = null; _recPopAnchor = null;   // keep _recPopPos — a moved panel stays put on the next row click
    document.removeEventListener('mousedown', _recPopOutside, true); document.removeEventListener('keydown', _recPopKey, true);
    window.removeEventListener('scroll', _recPopReposition, true); window.removeEventListener('resize', _recPopReposition);
  }
  function _recPopOutside(e) { if (_recPop && !_recPop.contains(e.target)) closeRecPop(); }
  function _recPopKey(e) { if (e.key === 'Escape') closeRecPop(); }
  // dock the picker as a tall panel whose RIGHT edge aligns with the status-circle column (so it sits
  // over the Track half, not far off to the side), using the full viewport height.
  // once the user drags it (header), leave its position alone. #119
  function _recPopReposition() {
    if (!_recPop) return;
    const M = 10, W = _recPop.offsetWidth || 410;
    if (_recPopPos) {   // user dragged it once — keep that spot (clamped into view), only refresh the height
      const left = Math.round(Math.max(M, Math.min(_recPopPos.left, window.innerWidth - W - M)));
      const top = Math.round(Math.max(M, Math.min(_recPopPos.top, window.innerHeight - 60)));
      _recPop.style.left = left + 'px'; _recPop.style.top = top + 'px';
      _recPop.style.maxHeight = (window.innerHeight - top - M) + 'px';
      return;
    }
    const wrap = document.getElementById('tc-recwrap'); const wr = wrap ? wrap.getBoundingClientRect() : null;
    const sep = wrap && wrap.querySelector('td.c-sep, th.c-sep');   // the status-circle column
    // align the popup's right edge with the status circles; fall back to the wrap's left edge
    let left = sep ? sep.getBoundingClientRect().left - W : (wr ? wr.left : M);
    _recPop.style.left = Math.round(Math.max(M, Math.min(left, window.innerWidth - W - M))) + 'px';
    const top = Math.round(Math.max(M, Math.min(wr ? wr.top : 60, window.innerHeight - 240)));
    _recPop.style.top = top + 'px';
    _recPop.style.maxHeight = (window.innerHeight - top - M) + 'px';
  }
  // drag the picker by its header
  function _recPopDrag(hd) {
    hd.style.cursor = 'move';
    hd.addEventListener('mousedown', e => {
      if (e.target.closest('button, a, input')) return;
      e.preventDefault();
      const r = _recPop.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mm = ev => { const left = Math.max(0, Math.min(ev.clientX - ox, window.innerWidth - 40)), top = Math.max(0, Math.min(ev.clientY - oy, window.innerHeight - 40)); _recPopPos = { left, top }; _recPop.style.left = left + 'px'; _recPop.style.top = top + 'px'; };
      const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
  }
  // a WS2 recording → the flat shape used by the picker / matcher (gid, name, length, artist text + raw ac, …)
  function mapWsRec(r) {
    return {
      gid: r.id, name: r.title, length: r.length || null,
      artist: (r['artist-credit'] || []).map(a => (a.name || (a.artist && a.artist.name) || '') + (a.joinphrase || '')).join(''),
      ac: r['artist-credit'] || [],   // raw credit, so the linked recording keeps its artist on screen
      releases: (() => { const seen = new Set(), out = []; (r.releases || []).forEach(rl => { const k = rl.id || rl.title; if (rl.title && !seen.has(k)) { seen.add(k); const rg = rl['release-group']; out.push({ name: rl.title, gid: rl.id, rgGid: rg ? rg.id : null, rgName: rg ? rg.title : null }); } }); return out; })(),
      isrcs: r.isrcs || [],
      comment: r.disambiguation || '',
    };
  }
  // every recording in a release group, fetched ONCE (paginated) — the pool auto-match matches against
  // locally, so a full release matches with ~one request instead of a per-track lookup each. #119
  async function fetchRgRecordings(rgGid) {
    const out = []; let offset = 0;
    for (let page = 0; page < 12; page++) {
      let j; try { j = await fetch(`${ORIGIN}/ws/2/recording?query=rgid:${encodeURIComponent(rgGid)}&fmt=json&limit=100&offset=${offset}&inc=artist-credits+releases+release-groups+isrcs`, { headers: { Accept: 'application/json' } }).then(r => r.json()); } catch (e) { Log.warn('RG recordings fetch failed', e.message); break; }
      (j.recordings || []).forEach(r => out.push(mapWsRec(r)));
      offset += 100; if (!(j.recordings || []).length || offset >= (j.count || 0)) break;
    }
    return out;
  }
  async function searchRecordings(q) {
    q = (q || '').trim(); if (!q) return [];
    try {
      const j = await fetch(`${ORIGIN}/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=15&inc=artist-credits+releases+release-groups+isrcs`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      return (j.recordings || []).map(mapWsRec);
    } catch (e) { Log.warn('recording search failed', e.message); return []; }
  }
  function recEntityFrom(data) {
    if (data.entity) return data.entity;   // suggestions are already full MB entities
    try {
      const spec = { entityType: 'recording', gid: data.gid, name: data.name, length: data.length || null };
      // build the artist credit from the WS2 result so the recording shows its artist (not blank). #119
      if (data.ac && data.ac.length) {
        spec.artistCredit = { names: data.ac.map(a => ({
          name: a.name || (a.artist && a.artist.name) || '', joinPhrase: a.joinphrase || '',
          artist: W.MB.entity({ entityType: 'artist', gid: a.artist && a.artist.id, name: a.artist && a.artist.name }, 'artist'),
        })) };
      }
      return W.MB.entity(spec, 'recording');
    } catch (e) { Log.warn('build recording entity failed', e.message); return null; }
  }
  function pickRecording(entry, data) {
    if (!data) return;
    const ent = recEntityFrom(data); if (!ent) return;
    try { koTrack(entry.mi, entry.ti).setRecordingValue(ent); Log.info('linked recording', JSON.stringify(data.name), '→ track', entry.number); }
    catch (e) { Log.warn('setRecordingValue failed', e.message); }
    closeRecPop(); rerenderRec();
  }
  // "Add a new recording" — native binds this to the per-track hasNewRecording observable (#119)
  function pickNewRecording(entry) {
    try { koTrack(entry.mi, entry.ti).hasNewRecording(true); Log.info('new recording for track', entry.number); }
    catch (e) { Log.warn('hasNewRecording failed', e.message); }
    closeRecPop(); rerenderRec();
  }
  // pull display data off a suggestion entity (releases live in appearsOn.results; isrcs may be objects)
  function suggData(s) {
    const e = u(s); const ap = u(e.appearsOn);
    const rels = []; const seen = new Set();
    if (ap && ap.results) ap.results.forEach(r => { const rr = u(r); const name = u(rr.name), gid = u(rr.gid); const rg = u(rr.releaseGroup); const k = gid || name; if (name && !seen.has(k)) { seen.add(k); rels.push({ name, gid, rgGid: rg ? u(rg.gid) : null, rgName: rg ? u(rg.name) : null }); } });
    const isrcs = (u(e.isrcs) || []).map(x => typeof x === 'string' ? x : (x && (x.isrc || u(x.isrc)))).filter(Boolean);
    return { entity: e, gid: u(e.gid), name: u(e.name), length: u(e.length), artist: acText(u(e.artistCredit)), releases: rels, isrcs };
  }
  // confidence of a picker result vs the track that opened the picker (same scheme as the table dot)
  function resultConfClass(data, ctx) {
    if (!ctx) return '';
    const lvl = recConfLevel(data, ctx);
    if (lvl === 0 && recExactMatch(data, ctx)) return ' tc-conf-exact';   // ideal: blue left border
    return ' tc-conf-' + ['tolerance', 'near', 'low', 'vlow'][lvl];
  }
  // render "appears on" releases as links (each {name,gid,rgGid?,rgName?}); plain strings tolerated for safety.
  // Releases of the SAME release group collapse to a single "RG ×N" link, like MB's own suggestions (#136).
  // cap = max entries shown before a "+N more" tail (0 = show all). #119
  function relLinksHtml(relsArr, cap) {
    const arr = relsArr || [];
    // group by release group; releases with no RG info each stay their own entry (graceful fallback)
    const groups = [], byRg = new Map();
    arr.forEach(rl => {
      const o = rl && typeof rl === 'object' ? rl : { name: rl };
      const rgKey = o.rgGid || (o.rgName ? 'n:' + o.rgName : null);
      if (rgKey && byRg.has(rgKey)) { byRg.get(rgKey).count++; return; }
      const g = { rgGid: o.rgGid, rgName: o.rgName, name: o.name, gid: o.gid, count: 1 };
      if (rgKey) byRg.set(rgKey, g);
      groups.push(g);
    });
    const shown = cap ? groups.slice(0, cap) : groups;
    const html = shown.map(g => {
      if (g.count > 1) {   // multiple releases in this RG → link the RG title with a count
        const label = esc(g.rgName || g.name);
        const a = g.rgGid ? '<a href="' + ORIGIN + '/release-group/' + esc(g.rgGid) + '" target="_blank" rel="noopener">' + label + '</a>' : label;
        return a + ' <span class="tc-rpk-rgx" title="' + g.count + ' releases in this release group">×' + g.count + '</span>';
      }
      return g.gid ? '<a href="' + ORIGIN + '/release/' + esc(g.gid) + '" target="_blank" rel="noopener">' + esc(g.name) + '</a>' : esc(g.name);
    }).join(', ');
    const extra = groups.length - shown.length;
    return html + (extra > 0 ? ' <span class="tc-rpk-more">+' + extra + ' more</span>' : '');
  }
  // a picker result row — mirrors the native list: title + length, by artist, appears on, ISRCs;
  // left-border colour = confidence vs the track
  function recRowHtml(data, ctx) {
    const rels = relLinksHtml(data.releases, 6);
    const isrcs = (data.isrcs || []).slice(0, 4).join(', ');
    // highlight the fields that differ from the track, like the table does
    const dT = ctx && data.name && ctx.title && !recTitleEq(data.name, ctx.title);
    const dA = ctx && data.artist && ctx.artist && !recNameEq(data.artist, ctx.artist);
    const dL = !!(ctx && recLenGap(data.length, ctx.length) > 0);
    return '<div class="tc-rpk-row' + resultConfClass(data, ctx) + '" data-gid="' + esc(data.gid) + '">' +
      '<div class="tc-rpk-main"><span class="tc-rpk-name' + (dT ? ' tc-rpk-fdiff' : '') + '">' + esc(data.name || '') + '</span>' +
        (data.comment ? ' <span class="tc-rpk-cmt">(' + esc(data.comment) + ')</span>' : '') +
        '<span class="tc-rpk-len' + (dL ? ' tc-rpk-fdiff' : '') + '">' + (data.length ? fmtMs(data.length) : '') + '</span></div>' +
      (data.artist ? '<div class="tc-rpk-by' + (dA ? ' tc-rpk-fdiff' : '') + '">by ' + esc(data.artist) + '</div>' : '') +
      (rels ? '<div class="tc-rpk-on">appears on: ' + rels + '</div>' : '') +
      (isrcs ? '<div class="tc-rpk-isrc">ISRCs: ' + esc(isrcs) + '</div>' : '') +
      '</div>';
  }
  function openRecPicker(entry, anchor) {
    recStyle(); closeRecPop();
    const pop = document.createElement('div'); pop.className = 'tc-recpop'; _recPop = pop; _recPopAnchor = anchor; document.body.appendChild(pop);
    const ko = koTrack(entry.mi, entry.ti);
    const data = {};
    const ctx = { title: u(ko.name), artist: acText(u(ko.artistCredit)), length: u(ko.length) };   // for result confidence colouring
    // the currently-linked recording (or "new recording" if that's flagged)
    const curRec = u(ko.recording);
    const isNew = typeof ko.hasNewRecording === 'function' && !!u(ko.hasNewRecording);
    const curGid = !isNew && curRec ? u(curRec.gid) : null;
    const curArtist = curRec ? acText(u(curRec.artistCredit)) : '';
    const curHtml = isNew
      ? '<span class="tc-rpk-newcur">＋ new recording (created on submit)</span>'
      : curGid
        ? '<a href="' + ORIGIN + '/recording/' + esc(curGid) + '" target="_blank" rel="noopener">' + esc(u(curRec.name) || '') + '</a>'
          + (u(curRec.length) ? ' <span class="tc-rpk-curlen">' + fmtMs(u(curRec.length)) + '</span>' : '')
          + (curArtist ? ' <span class="tc-rpk-curby">by ' + esc(curArtist) + '</span>' : '')
        : '<span class="tc-rpk-curnone">— none —</span>';
    const trackArtist = ctx.artist, trackLen = u(ko.length);
    const dd = entry.diffs || {};
    const showCopyT = !isNew && (dd.title || entry.copyTitle), showCopyA = !isNew && (dd.artist || entry.copyArtist);
    pop.innerHTML =
      '<div class="tc-rpk-hd"><b>' + esc(u(ko.name) || '') + '</b>' +
        (trackArtist ? '<span class="tc-rpk-hdby"> · ' + acLinks(u(ko.artistCredit)) + '</span>' : '') +
        (trackLen ? '<span class="tc-rpk-hdlen"> · ' + fmtMs(trackLen) + '</span>' : '') + '</div>' +
      '<div class="tc-rpk-curwrap">' +
        '<div class="tc-rpk-cur">' + curHtml + '</div>' +
        (curGid ? '<div class="tc-rpk-curon">appears on: <span class="tc-rpk-curon-list">…</span></div>' : '') +
      '</div>' +
      (showCopyT || showCopyA ? '<div class="tc-rpk-copy">' +
        (showCopyT ? '<label><input type="checkbox" class="tc-rpk-ct"' + (entry.copyTitle ? ' checked' : '') + '> copy track <b>title</b> to the recording (on submit)</label>' : '') +
        (showCopyA ? '<label><input type="checkbox" class="tc-rpk-ca"' + (entry.copyArtist ? ' checked' : '') + '> copy track <b>artist</b> to the recording (on submit)</label>' : '') + '</div>' : '') +
      '<div class="tc-rpk-qwrap"><input class="tc-rpk-q" type="text" placeholder="search recordings by name…"><button class="tc-rpk-qnew" type="button" title="＋ new recording — create a brand-new recording for this track">＋</button></div>' +
      '<div class="tc-rpk-sec tc-rpk-suggsec" title="click to collapse / expand"><span>suggestions <span class="tc-rpk-caret">▾</span></span></div><div class="tc-rpk-list tc-rpk-sugg"><div class="tc-rpk-empty">finding suggestions…</div></div>' +
      '<div class="tc-rpk-sec">search results<button class="tc-rpk-relax" type="button" title="relaxed search — show all recordings with this title, ignoring artist &amp; length">show all</button></div><div class="tc-rpk-list tc-rpk-res"><div class="tc-rpk-empty">type to search…</div></div>';
    const newBtn = pop.querySelector('.tc-rpk-qnew'); if (newBtn) newBtn.onclick = () => pickNewRecording(entry);
    const ctEl = pop.querySelector('.tc-rpk-ct'); if (ctEl) ctEl.onchange = () => { setCopy('title', entry, ctEl.checked); rerenderRec(); };
    const caEl = pop.querySelector('.tc-rpk-ca'); if (caEl) caEl.onchange = () => { setCopy('artist', entry, caEl.checked); rerenderRec(); };
    // fill the current recording's full "appears on" (all releases, linkable) — not in the page model, so fetch it
    if (curGid) {
      fetch(ORIGIN + '/ws/2/recording/' + curGid + '?fmt=json&inc=releases+release-groups', { headers: { Accept: 'application/json' } })
        .then(r => r.json()).then(j => {
          if (!_recPop) return; const el = pop.querySelector('.tc-rpk-curon-list'); if (!el) return;
          const seen = new Set(), rels = [];
          (j.releases || []).forEach(rl => { const k = rl.id || rl.title; if (rl.title && !seen.has(k)) { seen.add(k); const rg = rl['release-group']; rels.push({ name: rl.title, gid: rl.id, rgGid: rg ? rg.id : null, rgName: rg ? rg.title : null }); } });
          el.innerHTML = rels.length ? relLinksHtml(rels, 0) : '—';
        }).catch(() => {});
    }
    _recPopDrag(pop.querySelector('.tc-rpk-hd'));   // header is the drag handle
    _recPopReposition();   // dock it right + tall now the content (and height) exist
    const q = pop.querySelector('.tc-rpk-q'), suggBox = pop.querySelector('.tc-rpk-sugg'), resBox = pop.querySelector('.tc-rpk-res');
    // collapsible suggestions — click the header to fold it away and see search results immediately (remembered)
    const suggSec = pop.querySelector('.tc-rpk-suggsec');
    const applySuggCollapse = () => pop.classList.toggle('tc-sugg-collapsed', !!SETTINGS.recSuggCollapsed);
    if (suggSec) { applySuggCollapse(); suggSec.onclick = () => { SETTINGS.recSuggCollapsed = !SETTINGS.recSuggCollapsed; saveSettings(); applySuggCollapse(); _recPopReposition(); }; }
    // click a row to pick it — but a click on a link (release / artist) inside the row just follows the
    // link (new tab) and leaves the picker open; it must NOT pick + close the window. #119
    const wire = box => box.querySelectorAll('.tc-rpk-row').forEach(row => { row.onclick = e => { if (e.target.closest('a')) return; pickRecording(entry, data[row.dataset.gid]); }; });
    // de-dupe: a recording already shown under SUGGESTIONS is not repeated in SEARCH RESULTS below (#119)
    const suggGids = new Set();
    let lastResults = [];
    const paintResults = () => {
      const filtered = lastResults.filter(r => !suggGids.has(r.gid));
      resBox.innerHTML = filtered.length ? filtered.map(d => recRowHtml(d, ctx)).join('')
        : '<div class="tc-rpk-empty">' + (lastResults.length ? 'all matches are shown in suggestions' : 'no matches') + '</div>';
      wire(resBox);
    };
    // suggestions are lazy in MB — render what's there, else trigger findRecordingSuggestions and poll
    const renderSugg = () => {
      const list = (typeof ko.suggestedRecordings === 'function' ? (u(ko.suggestedRecordings) || []) : []).map(suggData);
      list.forEach(s => { data[s.gid] = s; });
      if (!list.length) return false;
      suggGids.clear(); list.forEach(s => suggGids.add(s.gid));
      suggBox.innerHTML = list.map(d => recRowHtml(d, ctx)).join(''); wire(suggBox);
      if (lastResults.length) paintResults();   // suggestions arrived after a search → drop any now-duplicate rows
      return true;
    };
    if (!renderSugg()) {
      try { getEditor().recordingAssociation.findRecordingSuggestions(ko); } catch (e) { Log.warn('findRecordingSuggestions failed', e.message); }
      let tries = 0;
      const poll = () => {
        if (!_recPop) return;
        const loading = typeof ko.loadingSuggestedRecordings === 'function' ? u(ko.loadingSuggestedRecordings) : false;
        if (!loading && renderSugg()) { rerenderRec(); return; }   // also refresh the ⊕ count on the row
        if (!loading && tries > 3) { suggBox.innerHTML = '<div class="tc-rpk-empty">no suggestions</div>'; return; }
        if (++tries < 40) setTimeout(poll, 250);
      };
      setTimeout(poll, 250);
    }
    q.value = u(ko.name) || '';
    q.title = 'free-form — raw MB query, e.g. isrc:USXXX… or artist:"…"';
    // auto-query for THIS track. Narrow = title + artist + a ±10s length window (precise). Relaxed
    // ("show all") = title only, ignoring artist & length — for classical, covers, re-recordings. #119
    // the relaxed/narrow choice is remembered (SETTINGS) so it carries across picker opens and reloads.
    let relax = !!SETTINGS.recRelax;
    const esq = s => String(s || '').replace(/(["\\])/g, '\\$1');
    const autoQuery = () => {
      const title = u(ko.name), artist = acText(u(ko.artistCredit)), len = u(ko.length);
      if (relax) return title;   // broad title search (covers / loose matches), identical to typing the title — NOT an exact phrase
      let qy = 'recording:"' + esq(title) + '"';
      if (artist) qy += ' AND artist:"' + esq(artist) + '"';
      if (len) qy += ' AND dur:[' + Math.max(0, len - 10000) + ' TO ' + (len + 10000) + ']';
      return qy;
    };
    let seq = 0, tmr = null;
    const runSearch = async (query, fallbackTitle) => {
      const my = ++seq;
      resBox.innerHTML = '<div class="tc-rpk-empty">searching…</div>';
      let results = await searchRecordings(query);
      if (fallbackTitle && !results.length) results = await searchRecordings(u(ko.name) || '');   // smart query too tight → broaden
      if (my !== seq || !_recPop) return;
      results.forEach(rr => { data[rr.gid] = rr; });
      lastResults = results; paintResults();   // paintResults hides any recording already listed under suggestions
    };
    // "show all" toggles relaxed mode and re-runs the track-derived search (independent of any manual edit).
    // the button is painted from the remembered state on open, and the toggle persists it. #119
    const relaxBtn = pop.querySelector('.tc-rpk-relax');
    const paintRelax = () => {
      if (!relaxBtn) return;
      relaxBtn.classList.toggle('on', relax); relaxBtn.textContent = relax ? 'narrow' : 'show all';
      relaxBtn.title = relax ? 'back to a precise search (title + artist + ±10s length)' : 'relaxed search — show all recordings with this title, ignoring artist & length';
    };
    paintRelax();
    if (relaxBtn) relaxBtn.onclick = () => {
      relax = !relax; SETTINGS.recRelax = relax; saveSettings(); paintRelax();
      runSearch(autoQuery(), !relax);
    };
    // once the user edits the box, search their raw text (free Lucene); the initial run is the auto query
    q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => runSearch(q.value, false), 300); };
    q.focus(); q.select(); runSearch(autoQuery(), !relax);
    _recPopReposition();
    setTimeout(() => { document.addEventListener('mousedown', _recPopOutside, true); document.addEventListener('keydown', _recPopKey, true); window.addEventListener('scroll', _recPopReposition, true); window.addEventListener('resize', _recPopReposition); }, 0);
  }
  // the Recordings tab panel (#recordings) — check the PANEL not the inner table (we hide the table)
  function recordingsVisible() { const p = document.getElementById('recordings'); return !!(p && p.offsetParent !== null); }
  // hide the native recording-assignment table and render the Apollo comparison table in its place.
  // Both read/write the same MB model, so toggling Original/Apollo lets you work in either view (#119).
  function showRecMirror() {
    _apolloUsed = true;
    recStyle(); snapshotRecOriginals();   // capture the page-load recording associations once, for revert
    const tbl = document.getElementById('track-recording-assignation'); if (!tbl) return;
    let wrap = document.getElementById('tc-recwrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'tc-recwrap'; tbl.parentElement.insertBefore(wrap, tbl); }
    document.body.classList.add('tc-rec-on');   // CSS hides the native table + widens the column (no flash)
    renderRecMirror(wrap);
    // optional: auto-match the Recordings tab on load (settings), once per page session
    if (SETTINGS.autoMatchRec && !_recAutoMatchedOnce) { _recAutoMatchedOnce = true; setTimeout(() => autoMatchRecordings(), 0); }
  }
  let _recAutoMatchedOnce = false;
  function hideRecMirror() {
    document.body.classList.remove('tc-rec-on');
    closeRecPop(); _recPopPos = null;   // drop any dragged location so the next visit docks fresh
    const w = document.getElementById('tc-recwrap'); if (w) w.remove();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COMPACT NAVIGATION — hide the native editor's step-tab row + footer and
     relocate them compactly: a segmented step switcher (Release | Tracklist |
     Recordings | ⊟ Edit note) on the right of the entity-tab row, the wizard
     buttons (Cancel / Prev / Next / Finish) top-right by the title, and
     "Add medium" at the right of the tracklist table. Everything is a proxy to
     the still-present (visually-hidden) native control, so MB's wizard is
     untouched and the feature reverts cleanly when toggled off.
  ═══════════════════════════════════════════════════════════════════════ */
  function navOn() { return SETTINGS.apolloEnabled !== false && SETTINGS.compactNav !== false; }   // compact nav is part of Apollo — off with the global switch
  const DIFF_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.1"/><line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.1"/><line x1="5" y1="8.6" x2="11" y2="8.6" stroke="currentColor" stroke-width="1.1"/><line x1="5" y1="11.2" x2="8.5" y2="11.2" stroke="currentColor" stroke-width="1.1"/></svg>';
  const STEP_DEFS = [
    { key: 'information', label: 'Release', title: 'Release information' },
    { key: 'duplicates-tab', label: 'Duplicates', title: 'Release duplicates' },   // Add-release only; hidden when its native tab is absent
    { key: 'tracklist', label: 'Tracklist', title: 'Tracklist' },
    { key: 'recordings', label: 'Recordings', title: 'Recordings' },
    { key: 'edit-note', diff: true, title: 'Edit note — review changes & add an edit note' }
  ];
  // only the submit button is kept (Cancel/Prev/Next are reachable via the entity tabs / step switcher);
  // it shows ONLY when there are pending changes. Both forms are mirrored — whichever MB renders.
  const WIZ_DEFS = [
    { id: 'enter', label: '✓ Enter edit', cls: 'tc-wiz-enter', find: f => f.querySelector('#enter-edit') || [...f.querySelectorAll('button')].find(b => /enter edit/i.test(b.textContent)) },
    { id: 'finish', label: '✓ Finish', cls: 'tc-wiz-finish', find: f => [...f.querySelectorAll('button')].find(b => /^\s*finish\s*$/i.test(b.textContent)) }
  ];
  // Right-side paginators (#140) — proxy MB's native footer Cancel / Previous / Next.
  // MB data-binds their visibility (Prev hidden on the first step, Next on the last),
  // mirrored in syncNav via `vis(nat)`. Cancel carries the native `.negative` class.
  const PAGE_DEFS = [
    { id: 'cancel', label: '✕ Cancel', cls: 'tc-wiz-cancel', find: f => f.querySelector('button.negative') || [...f.querySelectorAll('button')].find(b => /^\s*cancel\s*$/i.test(b.textContent)) },
    { id: 'prev',   label: '‹ Prev',   cls: 'tc-wiz-prev',   find: f => [...f.querySelectorAll('button')].find(b => /previous/i.test(b.textContent)) },
    { id: 'next',   label: 'Next ›',   cls: 'tc-wiz-next',   find: f => [...f.querySelectorAll('button')].find(b => /^\s*next\s*»?\s*$/i.test(b.textContent)) }
  ];
  function hasChanges() { try { const re = W.MB && W.MB.releaseEditor; return !!(re && typeof re.allowsSubmission === 'function' && re.allowsSubmission()); } catch (e) { return false; } }
  function editorEl() { return document.getElementById('release-editor'); }
  function stepNavEl() { const e = editorEl(); return e && e.querySelector(':scope > ul.ui-tabs-nav'); }
  function navFooterEl() { const e = editorEl(); return e && e.querySelector(':scope > div.buttons'); }
  function stepLink(key) { const n = stepNavEl(); return n && n.querySelector('a[href="#' + key + '"]'); }
  function activeStepKey() { const n = stepNavEl(); const a = n && n.querySelector('li.ui-tabs-active a'); return a ? (a.getAttribute('href') || '').slice(1) : ''; }
  function vis(el) { return !!(el && el.style.display !== 'none' && !el.disabled); }   // native inline display reflects MB's per-step show/hide

  let _navStyled = false;
  function navStyle() {
    if (_navStyled) return; _navStyled = true;
    const css = `
    .tc-nav-vh{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0!important}
    .tc-nav-steps{display:inline-flex;align-items:stretch;border:1px solid #c9bce0;border-radius:7px;overflow:hidden;background:#fff;font-family:Arial,Helvetica,sans-serif}
    .tc-nav-step{font:600 13px Arial;padding:5px 14px;border:none;border-right:1px solid #e6def5;background:#fff;color:#5a3e94;cursor:pointer;line-height:1.5;white-space:nowrap}
    .tc-nav-step:last-child{border-right:none}
    .tc-nav-step:hover{background:#f3f0fb}
    .tc-nav-step.active{background:#6a4d9a;color:#fff}
    .tc-nav-step.tc-nav-diff{display:flex;align-items:center;padding:5px 10px}
    .tc-nav-step.tc-nav-diff svg{width:15px;height:15px;display:block}
    /* mirror MB's native tab states: disabled (e.g. Recordings until the tracklist is complete) + error-tab (validation warnings) */
    .tc-nav-step:disabled,.tc-nav-step.tc-nav-disabled{opacity:.45;cursor:not-allowed;color:#9a8fb5;background:#fff}
    .tc-nav-step.tc-nav-warn{background:#fde3e3;color:#c0392b}
    .tc-nav-step.tc-nav-warn.active{background:#f3c4c4;color:#992318}
    .tc-nav-step.tc-nav-warn::before{content:"⚠";margin-right:5px}
    .tabs.tc-nav-sticky{position:sticky;top:0;background:#fff;z-index:20}   /* freeze the nav row when scrolling */
    /* MB's green TAGGER badge (Picard) sits at the header's top-right and collides with the frozen nav — lift it
       clear above the nav row, and keep the sticky nav above it so it's never covered */
    body:has(.tabs.tc-nav-sticky) .releaseheader span.tagger-icon{position:relative;z-index:1;transform:translateY(-16px)}
    /* with the step-tab row hidden, strip the editor's jQuery-UI frame + the panel's top padding so no empty box is left */
    #release-editor.tc-nav-on{margin-top:0;padding:0;border:none;background:none;box-shadow:none}
    #release-editor.tc-nav-on > .ui-tabs-panel{padding-top:0;border:none}
    #tc-nav-steps-wrap{position:absolute;right:0;bottom:6px;z-index:5}
    #tc-nav-right{display:flex;align-items:center;gap:10px}
    #tc-nav-wiz{display:inline-flex;align-items:center;gap:2px}
    .tc-nav-wbtn{font:13px Arial;padding:3px 9px;border:1px solid transparent;background:none;border-radius:5px;cursor:pointer;color:#555;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    .tc-nav-wbtn:not(:disabled):hover{background:#f4f4f4;border-color:#d2d2d2}
    .tc-nav-wbtn:disabled{opacity:.4;cursor:default;font-weight:normal;color:#999;background:none;border-color:transparent}
    .tc-nav-wbtn.tc-wiz-finish,.tc-nav-wbtn.tc-wiz-enter{color:#2f7a45;font-weight:600}
    .tc-nav-wbtn.tc-wiz-finish:hover,.tc-nav-wbtn.tc-wiz-enter:hover{background:#e6f3ea;border-color:#a9d2b6}
    .tc-addmed{font:13px Arial;padding:4px 12px;border:1px solid #d6cdec;background:#fff;color:#6a4d9a;border-radius:5px;cursor:pointer;margin-left:auto}
    .tc-addmed:hover{background:#f3f0fb}
    /* #140 — full-width nav bar: step switcher + Finish on the left, Cancel/Prev/Next paginators on the right */
    #tc-nav-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:20;background:#fff;padding:5px 2px 6px;border-bottom:1px solid #e6def5;margin-bottom:6px}
    #tc-nav-left{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
    #tc-nav-pager{display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
    .tc-nav-wbtn.tc-wiz-cancel{color:#c0392b}
    .tc-nav-wbtn.tc-wiz-cancel:not(:disabled):hover{background:#fdecec;border-color:#e6b3b3}
    .tc-nav-wbtn.tc-wiz-prev,.tc-nav-wbtn.tc-wiz-next{color:#5a3e94;font-weight:600;border-color:#d6cdec;background:#f6f3fc}
    .tc-nav-wbtn.tc-wiz-prev:not(:disabled):hover,.tc-nav-wbtn.tc-wiz-next:not(:disabled):hover{background:#ece5f8;border-color:#b9a4e0}`;
    const s = document.createElement('style'); s.id = 'tc-nav-style'; s.textContent = css; document.head.appendChild(s);
  }
  // build (once) the full-width nav bar at the top of the editor (#140):
  //   left  → step switcher (Release | Tracklist | Recordings | ⊟) + Finish/Enter
  //   right → Cancel / Prev / Next paginators
  // Everything proxies the still-present (visually-hidden) native control.
  function buildNav() {
    navStyle();
    if (document.getElementById('tc-nav-bar')) return;   // already built
    const ed = editorEl(); if (!ed) return;
    // step switcher
    const steps = document.createElement('div'); steps.className = 'tc-nav-steps'; steps.id = 'tc-nav-steps';
    STEP_DEFS.forEach(d => {
      const b = document.createElement('button'); b.className = 'tc-nav-step' + (d.diff ? ' tc-nav-diff' : ''); b.dataset.step = d.key; b.dataset.baseTitle = d.title;
      b.innerHTML = d.diff ? DIFF_ICON : d.label; b.title = d.title;
      b.onclick = () => { const l = stepLink(d.key); if (l) l.click(); setTimeout(syncNav, 40); };
      steps.appendChild(b);
    });
    // submit button (Finish / Enter edit) — sits to the right of the switcher
    const wiz = document.createElement('div'); wiz.id = 'tc-nav-wiz';
    WIZ_DEFS.forEach(d => {
      const b = document.createElement('button'); b.className = 'tc-nav-wbtn ' + d.cls; b.dataset.wiz = d.id; b.textContent = d.label;
      b.onclick = () => { ensureApolloEditNote(); const f = navFooterEl(); const nat = f && d.find(f); if (nat) nat.click(); setTimeout(syncNav, 40); };   // #130: set the edit note on the compact-nav submit path too
      wiz.appendChild(b);
    });
    // right-side paginators (Cancel / Prev / Next)
    const pager = document.createElement('div'); pager.id = 'tc-nav-pager';
    PAGE_DEFS.forEach(d => {
      const b = document.createElement('button'); b.className = 'tc-nav-wbtn ' + d.cls; b.dataset.page = d.id; b.textContent = d.label;
      b.onclick = () => { const f = navFooterEl(); const nat = f && d.find(f); if (nat) nat.click(); setTimeout(syncNav, 40); };
      pager.appendChild(b);
    });
    const left = document.createElement('div'); left.id = 'tc-nav-left'; left.append(steps, wiz);
    const bar = document.createElement('div'); bar.id = 'tc-nav-bar'; bar.append(left, pager);
    ed.insertBefore(bar, ed.firstChild);   // a dedicated full-width row at the top of the editor (frozen on scroll)
  }
  // keep the proxies in sync with the native state each tick
  function syncNav() {
    if (!navOn()) return;
    const active = activeStepKey();
    document.querySelectorAll('#tc-nav-steps .tc-nav-step').forEach(b => {
      b.classList.toggle('active', b.dataset.step === active);
      const link = stepLink(b.dataset.step), li = link && link.closest('li');   // mirror MB's native tab state
      if (!link) { b.style.display = 'none'; return; }   // step's native tab not present on this page (e.g. Duplicates exists only on Add)
      b.style.display = '';
      const dis = !!(li && li.classList.contains('ui-state-disabled'));
      const panel = document.getElementById(b.dataset.step);   // MB sets error-tab for some errors but not link errors — also scan the panel for a visible field-error
      const err = !!((li && li.classList.contains('error-tab')) || (panel && panel.querySelector('.field-error[data-visible="1"]')));
      b.disabled = dis; b.classList.toggle('tc-nav-disabled', dis); b.classList.toggle('tc-nav-warn', err);
      b.title = (dis && link && link.title) ? link.title : (b.dataset.baseTitle || b.title);   // disabled → MB's "enter all track info…" hint
    });
    const f = navFooterEl();
    const changed = hasChanges();   // the submit button appears only when there are pending changes
    WIZ_DEFS.forEach(d => { const proxy = document.querySelector('#tc-nav-wiz [data-wiz="' + d.id + '"]'); if (!proxy) return; const nat = f && d.find(f); proxy.style.display = (vis(nat) && changed) ? '' : 'none'; });
    // paginators stay in a fixed position — Prev/Next are never hidden, just disabled
    // when MB's native button isn't applicable (Prev on the first step, Next on the last) (#140)
    PAGE_DEFS.forEach(d => { const proxy = document.querySelector('#tc-nav-pager [data-page="' + d.id + '"]'); if (!proxy) return; const nat = f && d.find(f); proxy.disabled = !vis(nat); });
    updateStickyOffsets();
  }
  // stack the sticky Apollo toolbars BELOW the frozen entity-tab row (both default to top:0 and would
  // otherwise overlap, hiding the pinned tab row). The row height is dynamic, so measure it each sync.
  function updateStickyOffsets() {
    const tabs = document.getElementById('tc-nav-bar');   // #140: the full-width nav bar is the frozen header now
    const h = (navOn() && tabs) ? tabs.offsetHeight : 0;
    const w = document.getElementById('tc-mirror-wrap'); if (w) w.style.top = h ? h + 'px' : '';
    const r = document.querySelector('#tc-recwrap .tc-rec-tb'); if (r) r.style.top = h ? h + 'px' : '';
  }
  // the native "Add medium" OPENER — it lives in the editor footer (present on the Tracklist step) and
  // opens MB's add-medium parser dialog. (NB: the button inside #add-medium-dialog is the dialog's commit
  // button, disabled until tracks are parsed — proxying that one does nothing.)
  function nativeAddMediumBtn() {
    const f = navFooterEl(); let b = f && [...f.querySelectorAll('button')].find(x => /add medium/i.test(x.textContent));
    if (b) return b;
    const tl = document.getElementById('tracklist'); return tl ? [...tl.querySelectorAll('button')].find(x => /add medium/i.test(x.textContent) && !x.closest('#add-medium-dialog')) : null;
  }
  // move "Add medium" to the right end of the Apollo tracklist (opposite "Add tracks"), proxying the native opener
  function relocateAddMedium() {
    const nat = nativeAddMediumBtn();
    const want = navOn() && document.getElementById('tc-mirror-wrap') && nat;
    if (!want) { const p = document.getElementById('tc-addmed'); if (p) p.remove(); return; }
    if (document.getElementById('tc-addmed')) return;          // proxy already placed (the add-row may rebuild → re-add then)
    const btn = document.createElement('button'); btn.id = 'tc-addmed'; btn.className = 'tc-addmed'; btn.title = 'add a new medium'; btn.textContent = '＋ Add medium';
    btn.onclick = () => { const n = nativeAddMediumBtn(); if (n) n.click(); };
    const rows = document.querySelectorAll('.tc-medsec .tc-addrow'); const host = rows[rows.length - 1];
    if (host) host.appendChild(btn);                            // far right of the last medium's add-tracks row
    else { const secs = document.querySelectorAll('.tc-medsec'); const last = secs[secs.length - 1]; if (last) { const row = document.createElement('div'); row.className = 'tc-addrow'; row.appendChild(btn); last.appendChild(row); } }   // locked last medium → own right-aligned row
  }
  function applyNav() {
    if (!editorEl()) return;
    if (navOn()) {
      buildNav();
      editorEl().classList.add('tc-nav-on');
      const sn = stepNavEl(); if (sn) sn.classList.add('tc-nav-vh');
      const f = navFooterEl(); if (f) f.classList.add('tc-nav-vh');
      syncNav();
    } else {
      editorEl().classList.remove('tc-nav-on');
      const sn = stepNavEl(); if (sn) sn.classList.remove('tc-nav-vh');
      const f = navFooterEl(); if (f) f.classList.remove('tc-nav-vh');
      const tabs = document.querySelector('#page > .tabs, .tabs'); if (tabs) tabs.classList.remove('tc-nav-sticky');
      ['tc-nav-bar', 'tc-nav-steps-wrap', 'tc-nav-addbar'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    }
    relocateAddMedium();
    updateStickyOffsets();
  }

  /* ── edit note: credit Apollo when it's used, appended to the bottom (keep import-script notes) ── */
  let _apolloUsed = false;   // set true once a tracklist/recordings mirror is shown — i.e. Apollo is in use
  function ensureApolloEditNote() {
    if (!_apolloUsed) return;
    const ta = document.getElementById('edit-note-text'); if (!ta) return;   // MB's plain edit-note textarea (name=edit_note)
    const cur = ta.value || '';
    if (/Apollo Editor/i.test(cur)) return;   // already credited — don't duplicate
    const s = (typeof GM_info !== 'undefined' && GM_info.script) || {};   // same shape as the other scripts' edit notes
    const note = (s.name || 'Apollo Editor') + ' v' + scriptVersion() + ' by ' + (s.author || 'majkinetor') + ' - ' + (s.homepageURL || s.homepage || HELP_URL);
    const kept = cur.replace(/\s+$/, '');     // keep any existing note (import scripts etc.), append below
    const val = kept ? kept + '\n\n' + note : note;
    // use the native setter so a React-controlled textarea actually picks up the change (plain .value can be ignored — #130)
    try { const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; set.call(ta, val); } catch (e) { ta.value = val; }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // append the note the moment the user submits — by then any import-script note is already present
  function watchSubmit() {
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('button'); if (!b) return;
      const f = navFooterEl(); if (f && f.contains(b) && /^\s*(finish|enter edit)\s*$/i.test(b.textContent || '')) ensureApolloEditNote();
    }, true);   // capture phase: runs before MB reads the textarea for submission
  }

  /* ── Release information takeover (#129): tidy the first tab — hide the help bubble, clean the
        external links, and add an Apollo gear. Toggled by the shared Original/Apollo button. ── */
  let _riStyled = false;
  let _riExtFs = null;          // the External-links <fieldset>, remembered so we can move it back
  function riStyle() {
    if (_riStyled) return; _riStyled = true;
    const css = `
    body.tc-ri-on .tc-ri-helphidden{display:none!important}
    /* hide the inline "?" help / info icons + guidance across the whole Release-information panel */
    body.tc-ri-on #information .tooltip-wrapper,
    body.tc-ri-on #information .icon.help,
    body.tc-ri-on #information span.img.help,
    body.tc-ri-on #information .inline-help,
    body.tc-ri-on #information a.help,
    body.tc-ri-on #information .guidance,
    body.tc-ri-on #information .guidance-popover,
    /* hide help bubbles only — never a functional editor bubble (URL cleanup, add/edit link) */
    body.tc-ri-on #information .bubble:not(:has(input,button,select,textarea)){display:none!important}
    /* MB's link-editor popups must clear our sticky compact-nav (z-index 20), else the first link's
       popup opens under the nav bar and looks cut off */
    body.tc-ri-on .dialog.popover,
    body.tc-ri-on .bubble:has(input,button,select,textarea){z-index:50}

    /* ---- two-column layout: form on the left, external links lifted into the (now-used) right column ---- */
    body.tc-ri-on #information{display:flex;flex-wrap:wrap;gap:14px 30px;align-items:flex-start;max-width:100%;box-sizing:border-box}   /* wrap → links stack below the form on a narrow window instead of overlapping it */
    body.tc-ri-on #information > div.half-width{flex:0 1 620px;min-width:0;width:auto}   /* form keeps its natural width */
    body.tc-ri-on #information > div.documentation{display:none}   /* the contextual help text — replaced by the links column */
    body.tc-ri-on #tc-ri-rightcol{flex:1 1 340px;min-width:300px;max-width:100%;box-sizing:border-box}  /* links take the remaining width, but wrap below the form when there isn't room for both; never wider than the row */
    body.tc-ri-on #tc-ri-rightcol > fieldset{margin-top:0;max-width:100%;min-width:0;box-sizing:border-box}   /* min-width:0 overrides a fieldset's intrinsic min-content width, else a long URL overflows the column (and the page) */
    body.tc-ri-on #tc-ri-rightcol #external-links-editor{max-width:100%;box-sizing:border-box}

    /* ---- external links as a grid: the URL row spans every column, the link's type combos flow into aligned
       columns beneath it, and "Add another relationship" (the [+]) lands in the last cell. ---- */
    body.tc-ri-on #external-links-editor{display:block}
    body.tc-ri-on #external-links-editor > tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(185px,100%),1fr));column-gap:14px;row-gap:2px;padding-left:45px;align-items:center;box-sizing:border-box}
    /* URL line spans all columns; pulled back so the favicon sits at the column's left edge */
    body.tc-ri-on #external-links-editor tr.external-link-item{grid-column:1 / -1;display:flex;align-items:center;gap:9px;padding:7px 6px 1px;margin-left:-45px;border-radius:6px;position:relative}
    body.tc-ri-on #external-links-editor tr.external-link-item:hover{background:#f6f4fb}
    body.tc-ri-on #external-links-editor tr.external-link-item > td{padding:0;border:none}
    body.tc-ri-on #external-links-editor tr.external-link-item > td:first-child{flex:none;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:context-menu;position:relative;top:4px}   /* larger favicon → right-click to edit URL */
    body.tc-ri-on #external-links-editor .favicon{transform:scale(1.45);transform-origin:center}
    body.tc-ri-on #external-links-editor tr.external-link-item > td:last-child{flex:1;min-width:0}
    body.tc-ri-on #external-links-editor a.url{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
    /* hover edit/remove icons removed. link-actions -> display:contents; the edit pencils are kept in the DOM
       (positioned, invisible) so our JS proxy clicks still anchor MB's editor popup near the link instead of 0,0 */
    body.tc-ri-on #external-links-editor td.link-actions{display:contents}
    body.tc-ri-on #external-links-editor td.link-actions > button.edit-item{position:absolute;left:6px;top:8px;width:18px;height:18px;opacity:0;pointer-events:none;margin:0;padding:0}
    /* whole-link remove ("Remove link") — revealed on URL-row hover at the right end (no layout shift) */
    body.tc-ri-on #external-links-editor tr.external-link-item td.link-actions > button.remove-item{display:inline-flex;align-items:center;order:9;margin:0 2px 0 8px;transform:scale(.85);opacity:0;transition:opacity .12s}
    body.tc-ri-on #external-links-editor tr.external-link-item:hover td.link-actions > button.remove-item{opacity:.5}
    body.tc-ri-on #external-links-editor tr.external-link-item td.link-actions > button.remove-item:hover{opacity:1}
    /* each type combo is one grid cell: [x] [type fills the cell] [video] [!]. A fixed left slot is reserved for
       the per-type [x] so the type text lines up whether or not a remove button is present (single vs multi type) */
    body.tc-ri-on #external-links-editor tr.relationship-item{display:flex;align-items:center;gap:5px;min-width:0;padding:0 0 1px 22px;position:relative}
    body.tc-ri-on #external-links-editor tr.relationship-item > td{padding:0;border:none}
    body.tc-ri-on #external-links-editor tr.relationship-item > td:first-child{display:none}
    /* the cell content is a 3-track grid [ type (1fr) | video | ! ] so the select always ends at the same x
       and the carets line up across rows, whether or not a video checkbox / error badge is present */
    body.tc-ri-on #external-links-editor tr.relationship-item > td:last-child{display:grid;grid-template-columns:minmax(0,1fr) 16px 18px;align-items:center;column-gap:2px;flex:1;min-width:0}
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-content{grid-column:1;display:flex;align-items:center;min-width:0}
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-content > label:first-child{display:none}   /* the "Type:" caption */
    /* per-type remove [x] sits in the reserved left slot (absolute), so the type text starts at the same x with or without it */
    body.tc-ri-on #external-links-editor tr.relationship-item td.link-actions > button[class*="remove"]{display:inline-flex;align-items:center;position:absolute;left:0;top:50%;transform:translateY(-50%) scale(.85);margin:0;opacity:.6;transition:opacity .12s}
    body.tc-ri-on #external-links-editor tr.relationship-item td.link-actions > button[class*="remove"]:hover{opacity:1}
    /* type text (committed) / select (editable) fills the cell */
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-name{display:flex;align-items:center;flex:1;min-width:0;font-size:12px;color:#5a3e94;background:transparent;border:none;border-radius:0;padding:0;font-weight:normal;cursor:context-menu}
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-name:hover{color:#3a2d5c}
    /* editable type dropdowns — appearance:none so the text starts flush at the cell edge; a custom caret keeps the affordance */
    body.tc-ri-on #external-links-editor select{-webkit-appearance:none;-moz-appearance:none;appearance:none;font-size:12px;color:#5a3e94;background-color:transparent;background-image:url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='10'%20height='7'%20viewBox='0%200%2010%207'%3E%3Cpath%20d='M1%201l4%204%204-4'%20fill='none'%20stroke='%235a3e94'%20stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right center;border:none;border-radius:0;box-shadow:none;padding:0 15px 0 0;height:auto;margin:0;flex:1;min-width:0;width:100%;cursor:pointer}
    body.tc-ri-on #external-links-editor select:hover{color:#3a2d5c}
    /* video attribute → a compact checkbox (no "video" caption) */
    body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container{grid-column:2;justify-self:start;display:inline-flex;align-items:center;margin:0}
    body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container label{font-size:0;display:inline-flex;align-items:center;cursor:pointer}
    body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input{margin:0}
    /* error → a compact "!" badge (full text on hover via title) so it doesn't reflow the combos when it appears */
    body.tc-ri-on #external-links-editor tr.relationship-item .error.field-error{grid-column:3;justify-self:start;font-size:0;display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#fdecec;border:1px solid #f0c4c4;margin:0;cursor:help}
    body.tc-ri-on #external-links-editor tr.relationship-item .error.field-error::before{content:"!";font:bold 11px/1 Arial;color:#d33}
    /* "Add another relationship" (the [+]) — flows into the last grid cell; padding-left matches the per-type [x] inset so they line up */
    body.tc-ri-on #external-links-editor tr.add-relationship{display:flex;align-items:center;margin:0;padding:0 0 0 6px}
    body.tc-ri-on #external-links-editor tr.add-relationship > td{padding:0;border:none}
    body.tc-ri-on #external-links-editor tr.add-relationship > td:empty{display:none}
    body.tc-ri-on #external-links-editor tr.add-relationship td.add-item{display:inline-grid}   /* size the cell to the [+] button */
    /* the [+] is a touch smaller than the per-type [x] remove */
    body.tc-ri-on #external-links-editor tr.add-relationship button.add-item{font-size:0;width:13px;height:13px;border-radius:50%;border:1px solid #d6cdec;background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;line-height:1}
    body.tc-ri-on #external-links-editor tr.add-relationship button.add-item::before{content:"＋";font:bold 9px/1 Arial;color:#9a8fc0}
    body.tc-ri-on #external-links-editor tr.add-relationship button.add-item:hover{background:#f0ecfa;border-color:#b9a4e0}
    body.tc-ri-on #external-links-editor tr.add-relationship button.add-item:hover::before{color:#6f42c1}
    /* the "add another link" input row */
    body.tc-ri-on #external-links-editor tr.external-link-item .value.with-button input{width:100%}
    /* collapse the "Add another link" field into a [+] button that expands to a full input on click/focus */
    body.tc-ri-on #external-links-editor input[placeholder^="Add"]{box-sizing:border-box;width:22px;min-width:0;height:22px;padding:0;margin:2px 0;border:1px solid #d6cdec;border-radius:50%;background-color:transparent;color:transparent;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='11'%20height='11'%20viewBox='0%200%2011%2011'%3E%3Cpath%20d='M5.5%201v9M1%205.5h9'%20stroke='%239a8fc0'%20stroke-width='1.6'%20stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;transition:width .12s ease}
    body.tc-ri-on #external-links-editor input[placeholder^="Add"]:hover{background-color:#f0ecfa;border-color:#b9a4e0}
    body.tc-ri-on #external-links-editor input[placeholder^="Add"]::placeholder{color:transparent}   /* hide "Add another link" text inside the collapsed [+] */
    body.tc-ri-on #external-links-editor input[placeholder^="Add"]:focus{width:100%;height:auto;padding:4px 7px;border:1px solid #999;border-radius:4px;background-color:#fff;background-image:none;color:#333;cursor:text}
    body.tc-ri-on #external-links-editor input[placeholder^="Add"]:focus::placeholder{color:#999}
    /* ---- dead-link checker ---- */
    #tc-ri-toolbar{position:absolute;right:10px;bottom:8px;display:flex;align-items:center;gap:8px;z-index:3}
    /* the add-link field expands to full width on focus and would sit under the Check-links button — hide it while editing */
    body.tc-ri-on #tc-ri-rightcol > fieldset:has(#external-links-editor input[placeholder^="Add"]:focus) > #tc-ri-toolbar{display:none}
    #tc-ri-check{font:12px Arial;display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid #d6cdec;border-radius:6px;background:#f6f3fc;color:#5a3e94;cursor:pointer}
    #tc-ri-check:hover{background:#ece5f8;border-color:#b9a4e0}
    #tc-ri-check:disabled{opacity:.6;cursor:default}
    #tc-ri-check .tc-spin{width:12px;height:12px;border:2px solid #cdb8ec;border-top-color:#6f42c1;border-radius:50%;animation:tc-spin .7s linear infinite;display:none}
    #tc-ri-check.busy .tc-spin{display:inline-block}
    @keyframes tc-spin{to{transform:rotate(360deg)}}
    #tc-ri-check-status{font:12px Arial;color:#777}
    /* a dead link (4xx/5xx/unreachable): faded favicon + struck URL, like Platform Check's not-found state */
    body.tc-ri-on #external-links-editor tr.external-link-item.tc-link-dead .favicon{filter:grayscale(1);opacity:.45}
    body.tc-ri-on #external-links-editor tr.external-link-item.tc-link-dead a.url{text-decoration:line-through;opacity:.55}
    body.tc-ri-on #external-links-editor tr.external-link-item.tc-link-dead a.url::after{content:" ✖ " attr(data-tc-deadcode);color:#c0392b;font-size:11px;text-decoration:none;opacity:.9}
    body.tc-ri-on #external-links-editor tr.external-link-item.tc-link-ok a.url::after{content:" ✓";color:#2c7a45;font-size:11px;opacity:.7}`;
    const s = document.createElement('style'); s.id = 'tc-ri-style'; s.textContent = css; document.head.appendChild(s);
  }
  // move the External-links fieldset into a dedicated right column (or back home when Apollo is off).
  // Only the server-rendered <fieldset> wrapper is moved — React's editor root inside it is untouched.
  function relocateLinks(on) {
    const panel = document.getElementById('information'); if (!panel) return;
    const half = panel.querySelector(':scope > div.half-width'); if (!half) return;
    if (!_riExtFs || !_riExtFs.isConnected) {
      // find the External-links fieldset by its editor table, or — while that's still loading — by its legend,
      // so the section moves to the right column immediately instead of showing "Loading…" at the bottom
      const ext = document.getElementById('external-links-editor');
      _riExtFs = ext ? ext.closest('fieldset')
        : [...half.querySelectorAll('fieldset')].find(f => /external links/i.test(f.querySelector('legend')?.textContent || ''));
    }
    const fs = _riExtFs; if (!fs) return;
    if (on) {
      let col = panel.querySelector(':scope > #tc-ri-rightcol');
      if (!col) { col = document.createElement('div'); col.id = 'tc-ri-rightcol'; panel.appendChild(col); }
      if (fs.parentElement !== col) { if (!fs._tcHome) fs._tcHome = { parent: fs.parentElement, next: fs.nextElementSibling }; col.appendChild(fs); }
      ensureCheckToolbar(col);
    } else if (fs._tcHome && fs.parentElement !== fs._tcHome.parent) {
      fs._tcHome.parent.insertBefore(fs, fs._tcHome.next && fs._tcHome.next.isConnected ? fs._tcHome.next : null);
      const col = panel.querySelector(':scope > #tc-ri-rightcol'); if (col && !col.children.length) col.remove();
    }
  }
  // ---- dead-link checker (#138): check each external link's HTTP status, fade the dead ones, and turn on
  //      "This relationship has ended" for each of a dead link's relationship types ----
  const _deadLinks = new Map();   // url -> { dead, code } — kept so marks survive React re-renders of the editor
  const GMX = (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest) || (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest) || null;
  // HEAD (then GET on 405/403/0) → { status, dead }. dead = 4xx/5xx or unreachable.
  function checkUrl(url) {
    return new Promise(resolve => {
      if (!GMX) { resolve({ status: null, dead: null }); return; }   // no GM (e.g. page-context) → unknown
      let done = false; const fin = r => { if (!done) { done = true; resolve(r); } };
      const req = method => { try { GMX({ method, url, timeout: 15000,
        onload: r => { const s = r.status; if (method === 'HEAD' && (s === 405 || s === 501 || s === 403 || s === 0)) return req('GET'); fin({ status: s, dead: !s || s >= 400 }); },
        onerror: () => method === 'HEAD' ? req('GET') : fin({ status: 0, dead: true }),
        ontimeout: () => fin({ status: 0, dead: true }) }); } catch (e) { fin({ status: -1, dead: true }); } };
      req('HEAD');
    });
  }
  // each external-link row with a real URL, paired with its <a> and the relationship-item rows beneath it
  function linkRows() {
    const ext = document.getElementById('external-links-editor'); if (!ext) return [];
    const rows = [...ext.querySelectorAll('tr')]; const out = [];
    rows.forEach((r, i) => {
      if (!r.classList.contains('external-link-item')) return;
      const a = r.querySelector('a.url'); if (!a) return;   // skip the "add another link" input row
      const rels = []; for (let k = i + 1; k < rows.length; k++) { const n = rows[k]; if (n.classList.contains('external-link-item')) break; if (n.classList.contains('relationship-item')) rels.push(n); }
      out.push({ row: r, url: a.href, rels });
    });
    return out;
  }
  function markLinkRow(row, dead, code) {
    row.classList.toggle('tc-link-dead', dead === true);
    row.classList.toggle('tc-link-ok', dead === false);
    const a = row.querySelector('a.url'); if (a) { if (dead && code) a.setAttribute('data-tc-deadcode', code); else a.removeAttribute('data-tc-deadcode'); }
  }
  function remarkDeadLinks() {   // re-apply marks after the React editor re-renders (called from the observer)
    if (!_deadLinks.size) return;
    linkRows().forEach(({ row, url }) => { const v = _deadLinks.get(url); if (v) markLinkRow(row, v.dead, v.code); });
  }
  // open a relationship's edit dialog, tick "This relationship has ended", click Done
  function setRelEnded(relRow) {
    return new Promise(resolve => {
      const edit = relRow.querySelector('button.edit-item'); if (!edit) { resolve(false); return; }
      edit.click();
      setTimeout(() => {
        const dlg = [...document.querySelectorAll('.dialog.popover,[role="dialog"],.bubble')].find(d => d.offsetParent !== null && /relationship has ended|has ended/i.test(d.textContent));
        if (!dlg) { resolve(false); return; }
        const cb = [...dlg.querySelectorAll('input[type=checkbox]')].find(c => /ended/i.test((c.closest('label') || c.parentElement || {}).textContent || ''));
        if (cb && !cb.checked) cb.click();
        const done = [...dlg.querySelectorAll('button')].find(b => /^\s*done\s*$/i.test(b.textContent));
        setTimeout(() => { if (done) done.click(); resolve(!!cb); }, 70);
      }, 240);
    });
  }
  let _checking = false;
  async function checkAllLinks(setEnded) {
    if (_checking) return; _checking = true;
    const btn = document.getElementById('tc-ri-check'), stat = document.getElementById('tc-ri-check-status');
    const links = linkRows();
    if (btn) { btn.classList.add('busy'); btn.disabled = true; }
    if (stat) stat.textContent = 'checking ' + links.length + ' link(s)…';
    let dead = 0, done = 0;
    const queue = links.slice();
    const worker = async () => { while (queue.length) {
      const L = queue.shift();
      const r = await checkUrl(L.url);
      _deadLinks.set(L.url, { dead: r.dead, code: r.status });
      markLinkRow(L.row, r.dead, r.status);
      if (r.dead && setEnded) { for (const rel of L.rels) await setRelEnded(rel); }
      if (r.dead) dead++;
      done++; if (stat) stat.textContent = 'checked ' + done + '/' + links.length + (dead ? ' · ' + dead + ' dead' : '');
    } };
    await Promise.all([worker(), worker(), worker()]);
    if (btn) { btn.classList.remove('busy'); btn.disabled = false; }
    if (stat) stat.textContent = links.length ? (dead ? dead + ' dead link(s)' + (setEnded ? ' — marked “ended”' : '') : 'all ' + links.length + ' OK') : 'no links';
    _checking = false;
  }
  // the "Check links" button + status, pinned at the bottom-right of the External-links box (across from the
  // add-link [+]). Hidden when the release has no links yet. Lives in the fieldset wrapper, not the React editor.
  function ensureCheckToolbar(col) {
    const fs = _riExtFs && _riExtFs.isConnected ? _riExtFs : (col && col.querySelector('fieldset'));
    if (!fs) return;
    let bar = fs.querySelector(':scope > #tc-ri-toolbar');
    if (!bar) {
      fs.style.position = fs.style.position || 'relative';
      bar = document.createElement('div'); bar.id = 'tc-ri-toolbar';
      bar.innerHTML = '<span id="tc-ri-check-status"></span><button id="tc-ri-check" type="button" title="Check every external link for a dead/404 status. Dead links are faded and each of their relationship types is marked “This relationship has ended”."><span class="tc-spin"></span>⟳ Check links</button>';
      bar.querySelector('#tc-ri-check').onclick = () => checkAllLinks(true);
      fs.appendChild(bar);
    }
    bar.style.display = linkRows().length ? '' : 'none';   // no links → no button
  }
  // MB's contextual guidance box(es) — anything outside #information that's just the style-guidelines help
  // (the in-panel ones are hidden by CSS via #information .bubble/.guidance)
  function nativeHelpBubbles() {
    const out = new Set();
    const isHelp = e => !e.querySelector('input,button,select,textarea');   // a functional editor bubble (URL cleanup, add/edit link) has controls — never hide it
    document.querySelectorAll('#release-editor .bubble, #release-editor .guidance, #release-editor .guidance-popover, #page .bubble').forEach(e => { if (isHelp(e)) out.add(e); });
    [...document.querySelectorAll('#page div')].forEach(e => {
      if (e.offsetParent === null || document.getElementById('information')?.contains(e)) return;
      if (e.querySelector('a[href*="style"]') && (e.textContent || '').length < 400 && !e.querySelector('input,button,select,textarea,table,fieldset,h2')) out.add(e);
    });
    return [...out];
  }
  // clicking the favicon edits the URL (edit1); clicking the type chip edits the relationship type (edit2).
  // Both proxy to MB's own (hover-hidden) pencil buttons so the native editor bubble does the actual work.
  let _riClicksWired = false;
  function wireLinkClicks() {
    if (_riClicksWired) return; _riClicksWired = true;
    // right-click the favicon → edit URL; right-click a type → edit type. Both proxy to MB's own pencil button.
    document.addEventListener('contextmenu', e => {
      if (!document.body.classList.contains('tc-ri-on')) return;
      const ext = document.getElementById('external-links-editor');
      if (!ext || !ext.contains(e.target)) return;
      const type = e.target.closest('.relationship-name, .relationship-content, select.link-type');
      if (type) {
        const btn = type.closest('tr.relationship-item')?.querySelector('button.edit-item');
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }
      const linkRow = e.target.closest('tr.external-link-item');
      if (linkRow && e.target.closest('td:first-child')) {              // the favicon cell
        const btn = linkRow.querySelector('button.edit-item');
        if (btn) { e.preventDefault(); btn.click(); }
      }
    });
  }
  // Tell the user the favicon + type are right-click-editable (the affordance isn't obvious).
  // Re-applied each tick via applyReleaseInfo, so React re-renders that drop the title get it back.
  function annotateLinkEditHints() {
    const ext = document.getElementById('external-links-editor'); if (!ext) return;
    const URL_HINT = 'Right-click to edit the URL', TYPE_HINT = 'Right-click to edit the relationship type';
    ext.querySelectorAll('tr.external-link-item > td:first-child').forEach(td => { if (td.title !== URL_HINT) td.title = URL_HINT; });
    ext.querySelectorAll('tr.relationship-item .relationship-name, tr.relationship-item select.link-type').forEach(el => { if (el.title !== TYPE_HINT) el.title = TYPE_HINT; });
  }
  // MB indents hierarchical link-type options with leading spaces ("  purchase for download"); the <select>
  // shows the selected option *with* that indent, pushing the text right of the URL. Trim it (display only —
  // MB keys on option.value, not text). A self-guarded observer re-trims when MB re-renders the options.
  let _riOptObs = null;
  function tidyLinkTypeOptions() {
    const ext = document.getElementById('external-links-editor'); if (!ext) return;
    const apply = () => {
      // trim the leading-space indent MB puts on hierarchical link-type options so combos align with the URL
      ext.querySelectorAll('select.link-type option').forEach(o => {
        const t = o.textContent, tr = t.replace(/^\s+/, '').replace(/\s+$/, ''); if (tr !== t) o.textContent = tr;
      });
      // the attribute checkbox (e.g. "video") shows compactly with its caption hidden — surface the caption as a tooltip
      ext.querySelectorAll('tr.relationship-item .attribute-container label').forEach(l => {
        const cap = (l.textContent || '').trim(); if (!cap) return;
        if (l.title !== cap) l.title = cap;
        const cb = l.querySelector('input'); if (cb && cb.title !== cap) cb.title = cap;
      });
      // the error text is collapsed to a "!" badge — surface the full message as its tooltip
      ext.querySelectorAll('tr.relationship-item .error.field-error').forEach(e => {
        const t = (e.textContent || '').trim(); if (t && e.title !== t) e.title = t;
      });
      remarkDeadLinks();   // re-apply dead-link fading after a re-render
      ensureCheckToolbar();   // keep the Check-links button present + hidden when there are no links
    };
    _riOptObs?.disconnect(); apply();
    if (!_riOptObs) _riOptObs = new MutationObserver(() => { _riOptObs.disconnect(); apply(); _riOptObs.observe(ext, { childList: true, subtree: true }); });
    _riOptObs.observe(ext, { childList: true, subtree: true });
  }
  function applyReleaseInfo() {
    riStyle();
    wireLinkClicks();
    if (riWant()) {
      _apolloUsed = true;
      document.body.classList.add('tc-ri-on');
      relocateLinks(true);
      tidyLinkTypeOptions();
      annotateLinkEditHints();
      nativeHelpBubbles().forEach(b => b.classList.add('tc-ri-helphidden'));
    } else {
      relocateLinks(false);
      document.body.classList.remove('tc-ri-on');
      document.querySelectorAll('.tc-ri-helphidden').forEach(e => e.classList.remove('tc-ri-helphidden'));
      watchDocBubbles();
    }
  }
  // MB sizes its contextual help bubble to the documentation column's width once, and caches it. While Apollo
  // hid that column (display:none → width 0) it caches width:0, so in the Original view the bubble renders ~24px
  // wide and the text wraps one word per line ("scrambled"). Override the stale width to the real column width.
  let _docBubObs = null;
  function watchDocBubbles() {
    const doc = document.querySelector('#information > div.documentation'); if (!doc) return;
    const fix = () => {
      if (document.body.classList.contains('tc-ri-on')) return;   // only the Original view is affected
      const w = doc.clientWidth; if (w < 80) return;
      doc.querySelectorAll('.bubble').forEach(b => {
        if (b.offsetParent === null) return;
        const cur = parseFloat(b.style.width) || b.getBoundingClientRect().width;
        if (cur < w - 24) b.style.width = w + 'px';   // self-guarded: once set to w, no further change
      });
    };
    if (!_docBubObs) { _docBubObs = new MutationObserver(fix); _docBubObs.observe(doc, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true }); }
    fix();
  }

  W.__apolloEditor = { readTracklist, buildModel, commitTrack, resetTrack, revertTrack, trackChanged, removeTrack, moveTrack, addTracks, searchArtist, fetchEntity, createArtist, openPanel, showMirror, hideMirror, revertAll, revertSlot, pickArtist, addSlot, removeSlot, splitSlot, matchSlot, snapshotOriginals, readRecordings, showRecMirror, hideRecMirror, recordingsVisible, recConfidence, applyView, applyNav, applyReleaseInfo, releaseInfoVisible, ensureApolloEditNote, checkAllLinks, checkUrl, linkRows, get apolloOn() { return apolloOn(); }, get model() { return MODEL; }, get settings() { return SETTINGS; } };

  (async function main() {
    if (handleArtistPageCallback()) { Log.info('artist-create callback — posting MBID back and closing'); return; }
    if (!/^\/release\/(add|.+\/edit)/.test(location.pathname)) return;   // /artist/* (non-callback) just loads the channel listener
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready');
    snapshotOriginals();
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    if (tlWant()) showMirror();   // pre-build the tracklist takeover inside the (possibly hidden) #tracklist panel
    // pre-hide the native recordings table right after edit is entered (recStyle's `body.tc-rec-on` rule
    // applies even before MB lazily builds the table), and pre-mount the Apollo table if it already exists —
    // so switching to Recordings shows the Apollo view with no flash of the native assignment table. #119
    if (recWant()) { recStyle(); document.body.classList.add('tc-rec-on'); showRecMirror(); }
    applyView();                    // apply the chosen view to whichever tab is initially visible (tracklist and/or recordings)
    if (tracklistVisible() || recordingsVisible()) ensureLauncher();   // one toggle, present on both managed tabs
    applyNav();                     // compact navigation — hide native step-tabs + footer, relocate compactly
    watchSubmit();                  // append an Apollo credit to the edit note on submit (keeps existing notes)
    watchTabs();                    // #119 — single watcher drives the tracklist + recordings takeovers + the shared toggle
  })();
})();
