// ==UserScript==
// @name         Apollo Editor
// @namespace    https://musicbrainz.org/
// @version      2026.6.5.033000
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Same table whether floating or replacing the integrated tracklist.
// @author       majkinetor
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M13 22 L19 22 L16 30 Z' fill='%23ff8c3b'/%3E%3Cpath d='M14.4 22 L17.6 22 L16 27 Z' fill='%23ffd24a'/%3E%3Cpath d='M12 18 L8 23.5 L12 22 Z' fill='%233d2470'/%3E%3Cpath d='M20 18 L24 23.5 L20 22 Z' fill='%233d2470'/%3E%3Cpath d='M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z' fill='%235f3ec0'/%3E%3Ccircle cx='16' cy='12.5' r='3' fill='%23cfe8ff' stroke='%232a1a52' stroke-width='1'/%3E%3C/svg%3E
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
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
  function loadSettings() { const d = { colWidths: {}, applyMode: 'all', altRows: false, grid: false, autoMatch: true, autoMatchRec: false, recLenTol: 5, recIgnoreCase: true, lastTool: '', layout: 'normal', lastView: 'canon' }; try { return Object.assign(d, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return d; } }
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
  const VERSION = '2026.6.5.033000';   // keep in sync with @version (fallback when GM_info is unavailable under @grant none)
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
  const COLS = [{ k: 'mv', w: 32, label: '' }, { k: 'num', w: 38, label: '#' }, { k: 'title', w: 360, label: 'Title' }, { k: 'art', w: 380, label: 'Artist' }, { k: 'len', w: 52, label: 'Length' }, { k: 'badge', w: 56, label: '' }];
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
    .tc-mirror td{border-bottom:1px solid #eee;padding:4px 7px;vertical-align:middle;overflow:hidden;background:#fff}
    .tc-mirror td.c-art{vertical-align:top;padding-top:0;padding-bottom:0}   /* green matched boxes touch row-to-row (no white gap) */
    .tc-mirror td.c-badge{vertical-align:top}
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
    .tc-mirror.grid td{border-right:1px solid #ededed}.tc-mirror.grid td:last-child{border-right:none}
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
    .tc-search{flex:1 1 0;min-width:0;align-self:stretch;display:flex;align-items:center;gap:4px;border:1px solid #bbb;border-radius:4px;background:#fff;padding:0 6px;overflow:hidden}
    .tc-search.matched{background:#e3f4e7;border-color:#bcdcc6}
    @keyframes tcflash{0%{box-shadow:0 0 0 3px #e0a800}70%{box-shadow:0 0 0 3px #e0a800}100%{box-shadow:0 0 0 0 rgba(224,168,0,0)}}
    .tc-search.tc-flash{animation:tcflash 1.5s ease-out}
    .tc-search.tc-marked{border:2px solid #e0a800}   /* persists when a pick changed several tracks */
    .tc-search .nm{flex:1 1 0;min-width:0;border:none;background:transparent;font:13px Arial;padding:3px 0;outline:none}
    .tc-search .tc-bar-aka{flex:none;max-width:45%;color:#3a9d6a;font-size:11px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    .tc-search .mk{flex:none;cursor:pointer;border:none;background:none;color:#1f8a4c;font-weight:bold;font-size:15px;line-height:1;padding:0 2px}.tc-search .mk:hover{color:#136b39}
    .tc-joinwrap{flex:none;display:flex;align-items:center;gap:0}
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
    .tc-acrow .tc-aka{color:#5a7;font-size:11px;font-style:italic}
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
    .tc-globalstat.tc-unres{font-style:normal;font-weight:bold;color:#fff;background:#d6342c;padding:1px 8px;border-radius:9px}
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
    #tc-settings label{display:flex;gap:8px;align-items:flex-start;margin:7px 0;color:#333}
    #tc-settings .hint{color:#777;font-size:11px;margin:0 0 4px 24px}
    #tc-settings .tc-s-sec{font-weight:bold;color:#333;margin:12px 0 5px}
    #tc-settings .tc-s-group{padding-left:8px}
    #tc-settings .tc-s-row{display:flex;align-items:center;gap:12px;margin:7px 0;color:#333}
    #tc-settings .tc-s-rad{display:inline-flex;align-items:center;gap:4px;margin:0;font-weight:normal;cursor:pointer}
    #tc-settings .tc-s-row input[type=radio]{margin:0}
    #tc-settings #tc-s-lentol{width:48px;font:13px Arial;padding:2px 5px;border:1px solid #bbb;border-radius:3px}
    #tc-settings .tc-s-row.lentol{gap:7px}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;background:#5f3ec0;color:#fff;border:none;border-radius:20px;padding:8px 14px;font:bold 13px Arial;cursor:pointer;box-shadow:0 3px 12px rgba(40,20,80,.3)}
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
      t.classList.toggle('alt', !!SETTINGS.altRows); t.classList.toggle('grid', !!SETTINGS.grid);
      t.classList.remove('compact', 'cozy', 'normal'); t.classList.add(layout);
    });
  }
  function openSettings(anchor) {
    style(); let s = document.getElementById('tc-settings'); if (s) { s.remove(); return; }
    s = document.createElement('div'); s.id = 'tc-settings';
    s.innerHTML = `<h4>${ICON} Apollo Editor <span class="tc-ver" title="installed script version">v${scriptVersion()}</span><a class="tc-help" href="${HELP_URL}" target="_blank" rel="noopener" title="open the README in a new tab">? Help</a></h4>
      <div class="tc-s-sec">Auto-match on load</div>
      <div class="tc-s-group">
        <label title="Tracklist tab: match track artists to MusicBrainz on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatch"> <span>Tracklist</span></label>
        <label title="Recordings tab: auto-match unset recordings to MusicBrainz suggestions on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatchrec"> <span>Recordings</span></label>
      </div>
      <div class="tc-s-sec">Recording match</div>
      <div class="tc-s-group">
        <div class="tc-s-row lentol" title="A length difference up to this many seconds counts as a match (not a length mismatch)."><span>Length tolerance</span><input type="number" id="tc-s-lentol" min="0" max="60" step="1"> <span>seconds</span></div>
        <label title="Treat a case / accent / spacing-only difference in title or artist as a match (recommended)."><input type="checkbox" id="tc-s-ignorecase"> <span>Ignore casing</span></label>
      </div>
      <div class="tc-s-sec">Appearance</div>
      <div class="tc-s-group">
        <div class="tc-s-row"><span>Row layout</span><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="compact"> compact</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="normal"> normal</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="cozy"> cozy</label></div>
        <label><input type="checkbox" id="tc-s-alt"> <span>Alternate row colors</span></label>
        <label><input type="checkbox" id="tc-s-grid"> <span>Show grid</span></label>
      </div>`;
    document.body.appendChild(s);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 60, bottom: 80 };
    // keep it fully on-screen — right-align to the gear if it would overflow (uses the real width)
    s.style.left = Math.max(8, Math.min(r.right - s.offsetWidth, window.innerWidth - s.offsetWidth - 10)) + 'px'; s.style.top = (r.bottom + 6) + 'px';
    const am = s.querySelector('#tc-s-automatch'), amRec = s.querySelector('#tc-s-automatchrec'), alt = s.querySelector('#tc-s-alt'), grid = s.querySelector('#tc-s-grid');
    am.checked = SETTINGS.autoMatch !== false; amRec.checked = !!SETTINGS.autoMatchRec; alt.checked = !!SETTINGS.altRows; grid.checked = !!SETTINGS.grid;
    const curLayout = SETTINGS.layout || 'normal';
    s.querySelectorAll('input[name="tc-s-layout"]').forEach(rb => { rb.checked = rb.value === curLayout; rb.onchange = () => { if (rb.checked) { SETTINGS.layout = rb.value; saveSettings(); applyViewClasses(); } }; });
    am.onchange = () => { SETTINGS.autoMatch = am.checked; saveSettings(); };
    amRec.onchange = () => { SETTINGS.autoMatchRec = amRec.checked; saveSettings(); };
    const lentol = s.querySelector('#tc-s-lentol'), igc = s.querySelector('#tc-s-ignorecase');
    lentol.value = SETTINGS.recLenTol != null ? SETTINGS.recLenTol : 5; igc.checked = SETTINGS.recIgnoreCase !== false;
    const refreshRec = () => { try { if (document.getElementById('tc-recwrap')) rerenderRec(); } catch (e) {} };   // live-update the table
    lentol.onchange = () => { const v = Math.max(0, Math.min(60, parseInt(lentol.value, 10) || 0)); SETTINGS.recLenTol = v; lentol.value = v; saveSettings(); refreshRec(); };
    igc.onchange = () => { SETTINGS.recIgnoreCase = igc.checked; saveSettings(); refreshRec(); };
    alt.onchange = () => { SETTINGS.altRows = alt.checked; saveSettings(); applyViewClasses(); };
    grid.onchange = () => { SETTINGS.grid = grid.checked; saveSettings(); applyViewClasses(); };
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  /* ── the one shared table ── */
  let MODEL = null;
  let ACTIVE = {};   // { mode, tbody, statusEl }
  // transient message (e.g. "matching d/n") shown in every table's Artist header
  const updateStatus = t => { document.querySelectorAll('.tc-medsec .tc-hstatus, #tc-panel .tc-hstatus, .tc-globalstat').forEach(e => { e.textContent = t; e.classList.remove('tc-unres'); }); };
  // the always-visible total in the toolbar (left of Match) — shows the release-wide unresolved count / progress
  const setGlobalStat = n => { document.querySelectorAll('.tc-globalstat').forEach(e => { e.textContent = n ? statusText(n) : ''; e.classList.toggle('tc-unres', n > 0); }); };
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
    const t = document.createElement('table'); t.className = 'tc-mirror' + (SETTINGS.altRows ? ' alt' : '') + (SETTINGS.grid ? ' grid' : '') + ' ' + (SETTINGS.layout || 'normal');
    // the Artist column is the flexible filler (no fixed width) — it absorbs the slack so every OTHER
    // column keeps its EXACT width (table-layout:fixed) and resizes 1:1 with the mouse (no jump)
    t.innerHTML = `<colgroup>${COLS.map(c => c.k === 'art' ? '<col>' : `<col style="width:${colW(c.k, c.w)}px">`).join('')}</colgroup>` +
      `<thead><tr>${COLS.map(c => `<th>${c.label}${c.k === 'art' ? '<span class="tc-hstatus"></span>' + AM_SELECT : ''}${c.k === 'art' ? '' : '<span class="tc-resizer"></span>'}</th>`).join('')}</tr></thead><tbody></tbody>`;
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
    const borderIdx = clientX => { const ths = table.querySelectorAll('thead th'); for (let i = 0; i < ths.length - 1; i++) { if (COLS[i] && COLS[i].k === 'art') continue; if (Math.abs(ths[i].getBoundingClientRect().right - clientX) <= TOL) return i; } return -1; };
    let dragging = false;
    table.addEventListener('mousemove', e => { if (!dragging) table.style.cursor = borderIdx(e.clientX) >= 0 ? 'col-resize' : ''; });
    table.addEventListener('mousedown', e => {
      const i = borderIdx(e.clientX); if (i < 0) return;
      e.preventDefault(); dragging = true;
      // data columns have exact fixed widths (the spacer column absorbs slack), so the style width IS the
      // rendered width — start from it and resize is 1:1 with no jump
      const ths = [...table.querySelectorAll('thead th')];
      const col = cols[i], startX = e.clientX, startW = parseInt(col.style.width) || (ths[i] && ths[i].offsetWidth) || 100;
      const mm = ev => { col.style.width = Math.max(36, startW + ev.clientX - startX) + 'px'; };
      const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); dragging = false; SETTINGS.colWidths = SETTINGS.colWidths || {}; SETTINGS.colWidths[COLS[i].k] = parseInt(col.style.width); saveSettings(); };
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
    if (aka) { const al = document.createElement('span'); al.className = 'tc-bar-aka'; al.textContent = '“' + aka + '”'; al.title = aka; search.insertBefore(al, ref); }
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
    const akaHtml = c => { const a = aliasStr(c); return a ? `<span class="tc-aka">“${esc(a)}”</span>` : ''; };
    // a full page of results probably means there are more — offer "Show more…" (like MB's native popup)
    const loadMore = () => { curLimit = curLimit >= 50 ? 100 : curLimit >= 25 ? 50 : 25; const my = ++seq; const more = pop && pop.querySelector('.tc-acmore'); if (more) more.textContent = 'Loading…'; searchArtist(curQuery, curLimit).then(res => { if (my === seq && document.activeElement === inp) showResults(res, curQuery); }); };
    const draw = arr => {
      ensure(); list = arr; const q = inp.value.trim() || slot.creditedAs;
      pop.innerHTML = arr.length ? arr.map((c, i) => `<div class="tc-acrow${sameName(c.name, q) ? ' exact' : ''}" data-i="${i}"><span class="tic">${typeSvg(c)}</span><span class="nm">${esc(c.name)}</span>${akaHtml(c)}${c.comment ? `<span class="cmt">${esc(c.comment)}</span>` : ''}</div>`).join('') : `<div class="tc-acrow none">no matches — use ＋ to create</div>`;
      [...pop.querySelectorAll('.tc-acrow[data-i]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); choose(arr[+row.dataset.i]); }; });
      if (curQuery && arr.length >= curLimit && curLimit < 100) {   // likely more available → a clickable "Show more…" footer
        const more = document.createElement('div'); more.className = 'tc-acrow tc-acmore'; more.textContent = 'Show more…';
        more.onmousedown = e => { e.preventDefault(); loadMore(); };
        pop.appendChild(more);
      }
      position();
    };
    // patch in the full aliases (one WS2 search) without a full redraw, so it doesn't reset the keyboard highlight
    const patchAliases = arr => { if (!pop) return; arr.forEach((c, i) => { const a = aliasStr(c); if (!a) return; const row = pop.querySelector(`.tc-acrow[data-i="${i}"]`); if (!row) return; let sp = row.querySelector('.tc-aka'); if (!sp) { sp = document.createElement('span'); sp.className = 'tc-aka'; const nm = row.querySelector('.nm'); nm.parentNode.insertBefore(sp, nm.nextSibling); } sp.textContent = '“' + a + '”'; }); };
    const showResults = (arr, q) => { draw(arr); fetchAliases(q).then(map => { if (document.activeElement !== inp || !pop) return; arr.forEach(c => { if (map[c.gid] && map[c.gid].length) c.aliases = map[c.gid]; }); patchAliases(arr); }); };
    const runSearch = q => { curQuery = q; curLimit = 8; const my = ++seq; searching(); searchArtist(q).then(res => { if (my === seq && document.activeElement === inp) showResults(res, q); }); };
    // paste an MBID or a MusicBrainz /artist/<mbid> URL → resolve it straight to that artist. Gate on the
    // field value (not focus): a commit-rerender can steal focus before the fetch returns.
    const resolveByGid = async gid => { ensure(); list = []; pop.innerHTML = `<div class="tc-acrow none">Resolving…</div>`; position(); const ent = await fetchEntity(gid); if (mbidFrom(inp.value) !== gid) return; if (ent && ent.id) { close(); pickArtist(slot, ent); } else { pop.innerHTML = `<div class="tc-acrow none">MBID not found</div>`; } };
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
    inp.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); inp.focus(); }   // close the popup but keep the field focused, so the next ↓ navigates rows
      else if (e.key === 'ArrowDown') { if (browsing()) { hi = Math.min(list.length - 1, hi + 1); [...pop.querySelectorAll('[data-i]')].forEach((r, i) => r.classList.toggle('hi', i === hi)); e.preventDefault(); } else { close(); if (focusSameField(inp, 1)) e.preventDefault(); } }
      else if (e.key === 'ArrowUp') { if (browsing()) { hi = Math.max(0, hi - 1); [...pop.querySelectorAll('[data-i]')].forEach((r, i) => r.classList.toggle('hi', i === hi)); e.preventDefault(); } else { close(); if (focusSameField(inp, -1)) e.preventDefault(); } }
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
      lenIn.onchange = e => { setLength(t, e.target.value); refreshBadges(); }; wireRowNav(lenIn);
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
      b.onclick = () => { if (a === 'menu') openToolsMenu(b); else if (a === 'tool') runActiveTool(); else if (a === 'gear') openSettings(b); else if (a === 'close') { host.remove(); ACTIVE = {}; } else runAction(a); };
    });
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
    + `<span class="sp"></span><span class="tc-toast"></span><span class="sp"></span><span class="tc-globalstat"></span><span class="tc-tbsep"></span><button class="tc-btn primary" data-act="match" title="search MusicBrainz for the unmatched artists">⚡ Match</button>`
    + `<button class="tc-btn" data-act="revert">Revert all</button><button class="tc-btn" data-act="gear" title="settings">⚙</button>`;

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
    bindActions(p); initTools();
    loadAndRender((d, n) => updateStatus(`matching ${d}/${n}…`));
  }

  /* ── in-page replacement (the only mode) ── */
  let _showOriginal = false;
  function nativeTrackTables(root) { return [...(root || document).querySelectorAll('table')].filter(t => t.querySelector('tr.track')); }
  // the native tracklist = track tables + the #tracklist-tools row + the Guess-case fieldset; hide/show
  // together (the format header is lifted out, not hidden). MB's medium WARNINGS are NOT hidden — every
  // one (capitalization, Digital-Media/packaging, …) stays visible above the Canon table.
  function nativeBits() {
    // SCOPE to the Tracklist tab only — the Recordings tab has its own track table (recording associations)
    // that we must NOT hide (issue #114). every medium has its own tools row (MB reuses id "tracklist-tools").
    const tl = document.getElementById('tracklist'); if (!tl) return [];
    return [...nativeTrackTables(tl), ...tl.querySelectorAll('table.medium, [id="tracklist-tools"], fieldset.guesscase, .guesscase')];
  }
  function setNativeHidden(hidden) {
    nativeBits().forEach(el => { el.style.display = hidden ? 'none' : ''; });
    // keep ALL real medium warnings visible even in Canon (force them back on in case a prior version or MB left one hidden)
    document.querySelectorAll('fieldset.advanced-medium .warning').forEach(w => { w.style.display = ''; });
  }
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

  /* ── entry points: ONE Original/Apollo toggle, applied to whichever editor tab you're on (#119) ── */
  function apolloOn() { return SETTINGS.lastView !== 'original'; }
  function relabelLauncher() { const b = document.getElementById('tc-launch'); if (b) b.textContent = apolloOn() ? 'Original' : 'Apollo Editor'; }
  // apply the current view to whichever managed tab is visible (Tracklist and/or Recordings)
  function applyView() {
    recStyle();   // make sure the recordings CSS (incl. the native-table hide rule) exists up front
    document.body.classList.toggle('tc-rec-on', apolloOn());   // hide the native recordings table whenever Apollo is on, so switching to that tab never flashes it (#119)
    if (tracklistVisible()) { if (apolloOn()) { if (!document.getElementById('tc-mirror-wrap')) showMirror(); } else hideMirror(); }
    if (recordingsVisible()) { if (apolloOn()) showRecMirror(); else hideRecMirror(); }
    relabelLauncher();
  }
  function ensureLauncher() {
    if (document.getElementById('tc-launch')) { relabelLauncher(); return; }
    style(); const b = document.createElement('button'); b.id = 'tc-launch'; b.title = 'toggle Apollo / original editor (this tab)';
    b.onclick = () => { SETTINGS.lastView = apolloOn() ? 'original' : 'canon'; saveSettings(); applyView(); };
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
        // apply the CURRENT toggle state — a toggle on another tab must take effect here too
        if (apolloOn()) { if (!document.getElementById('tc-mirror-wrap')) showMirror(); else if (!_tlRefreshed) { _tlRefreshed = true; loadAndRender(); } } else hideMirror(); }
      else if (!tl && _tlPrev) { _tlPrev = false; }
      if (rec && !_recPrev) { _recPrev = true; Log.info('entered Recordings tab'); if (apolloOn()) showRecMirror(); else hideRecMirror(); }
      else if (!rec && _recPrev) { _recPrev = false; }
      if (tl || rec) ensureLauncher(); else { const l = document.getElementById('tc-launch'); if (l) l.remove(); }
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
  // title/artist equality used for matching. With "ignore casing" on (default), a case/accent/spacing-only
  // difference counts as equal (fold); off = exact text. #119
  function recNameEq(a, b) { return SETTINGS.recIgnoreCase !== false ? fold(a) === fold(b) : String(a || '') === String(b || ''); }
  // per-field diff between a track and its recording: title/artist via MB's own flags, length in ms
  function recFieldDiffs(track, rec) {
    let title = false, artist = false;
    try { if (typeof track.titleDiffersFromRecording === 'function') title = !!track.titleDiffersFromRecording(); } catch (e) {}
    try { if (typeof track.artistDiffersFromRecording === 'function') artist = !!track.artistDiffersFromRecording(); } catch (e) {}
    // a "credited as" (same artist entity, different credit name) is NOT a real artist mismatch — don't
    // let it drag the match confidence down; it's still the right recording. #119
    if (artist && sameArtistEntities(track, rec)) artist = false;
    // a casing-only (cosmetic) difference is not a real mismatch when "ignore casing" is on
    if (title && recNameEq(u(track.name), rec ? u(rec.name) : '')) title = false;
    if (artist && recNameEq(acText(u(track.artistCredit)), acText(rec ? u(rec.artistCredit) : null))) artist = false;
    const lenDiff = recLenGap(u(track.length), rec ? u(rec.length) : null);
    return { title, artist, lenDiff, len: lenDiff > 0 };
  }
  // Confidence ported from "Quick Recording Match": null = perfect (green), else low / vlow / xlow
  // (yellow / orange / red), graded by how many fields differ and by how far the length is off.
  const REC_CONF = {
    low:  { c: '#fff176', label: 'low confidence' },
    vlow: { c: '#ffb74d', label: 'very low confidence' },
    xlow: { c: '#d32f2f', label: 'extremely low confidence' },
  };
  function recConfidence(track, rec, d) {
    if (!rec || !u(rec.gid)) return null;
    d = d || recFieldDiffs(track, rec);
    const diffs = [];
    if (d.title) diffs.push('title');
    if (d.artist) diffs.push('artist');
    if (d.lenDiff > 0) diffs.push('length ' + Math.round(d.lenDiff / 1000) + 's');
    let level = null;
    if (diffs.length >= 3 && d.lenDiff > 10000) level = 'xlow';
    else if (d.lenDiff > 15000) level = 'vlow';
    else if (diffs.length >= 2 && d.lenDiff <= 15000) level = 'vlow';
    else if (diffs.length === 1 || d.lenDiff > 3000) level = 'low';
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
      out.push({
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
      '#tc-recwrap .tc-recwarn{color:#b00;font-weight:600}',
      // consistent with the Tracklist tab toolbar (#tc-bar / .tc-btn): same bar spacing, button look, inputs.
      // sticky at the top while the table scrolls (mirrors #tc-mirror-wrap) so it stays reachable on big releases.
      '#tc-recwrap .tc-rec-tb{display:flex;align-items:center;gap:8px;padding:6px 4px;flex-wrap:wrap;position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e3dcf2;box-shadow:0 3px 8px rgba(40,20,80,.07)}',
      '#tc-recwrap .tc-rec-tb .sp{flex:1}',   // flex spacer: Clear hugs the left, the Match cluster hugs the right (mirrors #tc-bar)
      // flat buttons that match the Tracklist tab's .tc-btn (transparent until hover); Match keeps the bold-purple primary look
      '#tc-recwrap .tc-rec-tb button{padding:4px 11px;border:1px solid transparent;border-radius:3px;background:transparent;cursor:pointer;font:13px Arial;color:#444}#tc-recwrap .tc-rec-tb button:hover{background:linear-gradient(#fff,#eee);border-color:#bbb}',
      '#tc-recwrap .tc-rec-tb button.primary{color:#5f3ec0;font-weight:bold}#tc-recwrap .tc-rec-tb button.primary:hover{background:linear-gradient(#7a52df,#5f3ec0);color:#fff;border-color:#4f33a3}',
      '#tc-recwrap .tc-rec-tbl{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#555}',
      '#tc-recwrap .tc-rec-ignore{font:12px Arial;padding:1px;width:auto;max-width:150px}',
      '#tc-recwrap .tc-rec-amstatus{color:#6f42c1;font-size:12px;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;padding-right:4px}',
      '.tc-rectbl .tc-recname{position:relative}',
      '.tc-rectbl .tc-rec-rev{position:absolute;right:3px;top:50%;transform:translateY(-50%);border:none;background:#fff;cursor:pointer;color:#7d6bc0;font-size:15px;line-height:1;visibility:hidden;padding:1px 4px;border-radius:3px}',
      '.tc-rectbl tr.tc-recrow:hover .tc-rec-rev{visibility:visible}.tc-rectbl .tc-rec-rev:hover{color:#5f3ec0;background:#ede9f6}',
      'table.tc-rectbl{border-collapse:collapse;width:100%;background:#fff;table-layout:fixed}',
      '.tc-rectbl td{overflow-wrap:anywhere}',
      '.tc-rectbl th{text-align:left;font-size:11px;color:#777;border-bottom:1px solid #ccc;padding:4px 7px;white-space:nowrap}',
      '.tc-rectbl td{padding:4px 7px;border-bottom:1px solid #eee;vertical-align:top}',
      // density layouts (same names as the Tracklist tab): compact tighter, cozy airier, normal = default
      '.tc-rectbl.compact th{padding:2px 7px}.tc-rectbl.compact td{padding:1px 7px}',
      '.tc-rectbl.cozy th{padding:7px 7px}.tc-rectbl.cozy td{padding:8px 7px}',
      // grid option: column separators on both tables
      '.tc-rectbl.grid td,.tc-rectbl.grid th{border-right:1px solid #ededed}.tc-rectbl.grid td:last-child,.tc-rectbl.grid th:last-child{border-right:none}',
      '.tc-rectbl.alt tbody tr.tc-recrow:nth-of-type(even) td{background:#f6f4fb}',
      '.tc-rectbl tr.tc-recmed td{background:#f3f0fa;font-weight:600;color:#4b2e83}',
      '.tc-rectbl tr.tc-recchanged td:first-child{box-shadow:inset 3px 0 0 #5f3ec0}',   // changed-row marker, like the Tracklist tab',
      '.tc-rectbl .c-n{color:#999;text-align:right;width:26px}',
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
      '.tc-recpop .tc-rpk-row.tc-conf-match{border-left-color:#86c686}',
      '.tc-recpop .tc-rpk-row.tc-conf-low{border-left-color:#fff176}',
      '.tc-recpop .tc-rpk-row.tc-conf-vlow{border-left-color:#ffb74d}',
      '.tc-recpop .tc-rpk-row.tc-conf-xlow{border-left-color:#d32f2f}',
      '.tc-rectbl .tc-dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.15)}',
      '.tc-rectbl tr.tc-recrow:hover td{background:#fafaff}',
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
      '.tc-recpop .tc-rpk-q{width:calc(100% - 16px);margin:8px;padding:5px 7px;border:1px solid #c9c2dd;border-radius:4px;font:12px Arial;box-sizing:border-box}',
      '.tc-recpop .tc-rpk-sec{display:flex;align-items:center;justify-content:space-between;padding:3px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#999;background:#faf8ff}',
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
        '<button class="tc-rec-clear" type="button" title="set every track to a new recording">Clear</button>' +
        '<span class="tc-rec-amstatus"></span>' +   // flexible filler: its text changes absorb here, never reflowing the bar
        '<label class="tc-rec-tbl">ignore at <select class="tc-rec-ignore"><option value="low">🟡 low</option><option value="vlow">🟠 very low</option><option value="xlow">🔴 extremely low</option><option value="nothing">⚪ nothing</option></select></label>' +
        '<span class="tc-recwarn"></span>' +
        '<span class="tc-tbsep"></span>' +
        '<button class="tc-rec-am tc-btn primary" type="button" title="auto-match unset recordings to MusicBrainz suggestions">⚡ Match</button>' +
        '<button class="tc-rec-revall" type="button" title="revert every recording to its page-load state">Revert all</button>' +
        '<button class="tc-rec-gear" type="button" title="settings">⚙</button>' +
      '</div>' +
      '<table class="tc-rectbl ' + (SETTINGS.layout || 'normal') + (SETTINGS.altRows ? ' alt' : '') + (SETTINGS.grid ? ' grid' : '') + '">' +
        '<colgroup><col style="width:2.5%"><col style="width:25.5%"><col style="width:18%"><col style="width:4%"><col style="width:2%"><col style="width:26%"><col style="width:18%"><col style="width:4%"></colgroup>' +
        '<thead>' +
        '<tr class="tc-grouphd"><th colspan="4" class="tc-grp tc-grp-l">Track</th><th class="c-sep"></th><th colspan="3" class="tc-grp tc-grp-r">Recording</th></tr>' +
        '<tr><th class="c-n">#</th><th>Title</th><th>Artist</th><th class="c-len">Len</th>' +
        '<th class="c-sep"></th><th>Title</th><th>Artist</th><th class="c-len">Len</th></tr></thead><tbody></tbody></table>';
    // wire the toolbar (once)
    const sel = wrap.querySelector('.tc-rec-ignore'); if (sel) { sel.value = SETTINGS.recIgnore || 'vlow'; sel.onchange = () => { SETTINGS.recIgnore = sel.value; saveSettings(); }; }
    const amBtn = wrap.querySelector('.tc-rec-am'); if (amBtn) amBtn.onclick = () => autoMatchRecordings();
    const clrBtn = wrap.querySelector('.tc-rec-clear'); if (clrBtn) clrBtn.onclick = () => clearAllRecordings();
    const revBtn = wrap.querySelector('.tc-rec-revall'); if (revBtn) revBtn.onclick = () => revertAllRecordings();
    const gearBtn = wrap.querySelector('.tc-rec-gear'); if (gearBtn) gearBtn.onclick = () => openSettings(gearBtn);   // same settings dialog as the Tracklist tab
    renderRecBody(wrap);
  }
  // (re)render just the rows + the unset-count — leaves the toolbar (status/inputs) untouched
  function renderRecBody(wrap) {
    wrap = wrap || document.getElementById('tc-recwrap'); if (!wrap) return;
    const tb = wrap.querySelector('tbody'); if (!tb) return;
    const rows = readRecordings();
    const multi = mediums().length > 1;
    const unset = rows.filter(r => !r.recGid && !r.isNew).length;
    const warn = wrap.querySelector('.tc-recwarn'); if (warn) warn.textContent = unset ? '⚠ ' + unset + ' without a recording' : '';
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
      const tCls = r.copyTitle ? 'tc-copy' : (d.title ? 'tc-diff' : '');
      const aCls = r.copyArtist ? 'tc-copy' : (d.artist ? 'tc-diff' : '');
      const changed = recChangedFromOrig(r.mi, r.ti);   // differs from the page-load recording
      const tr = document.createElement('tr'); tr.className = 'tc-recrow' + (changed ? ' tc-recchanged' : '');
      tr.innerHTML =
        '<td class="c-n">' + esc(String(r.number == null ? '' : r.number)) + '</td>' +
        '<td class="tc-tkt">' + esc(r.title || '') + '</td>' +
        '<td>' + (r.trackArtistHtml || '') + '</td>' +
        '<td class="c-len">' + fmtMs(r.trackLen) + '</td>' +
        '<td class="c-sep"><span class="tc-dot"></span></td>' +
        '<td class="tc-recname ' + tCls + '">' + titleCell + '</td>' +
        '<td class="' + aCls + '">' + artistCell + '</td>' +
        '<td class="c-len ' + (d.len ? 'tc-diff' : '') + '">' + fmtMs(r.recLen) + '</td>';
      const dot = tr.querySelector('.tc-dot');
      if (r.conf) { dot.style.background = r.conf.color; dot.title = r.conf.label + ' — differs: ' + r.conf.diffs.join(', '); }
      else if (r.recGid) { dot.style.background = '#86c686'; dot.title = 'matches the track'; }
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
  }
  // confidence level of a candidate vs the track: 0 match · 1 low · 2 very low · 3 extremely low
  const REC_IGNORE = { nothing: 3, xlow: 2, vlow: 1, low: 0 };   // value = the worst level still auto-linked
  function recConfLevel(data, ctx) {
    if (!ctx) return 0;
    let n = 0; const lenDiff = recLenGap(data.length, ctx.length);
    if (data.name && ctx.title && !recNameEq(data.name, ctx.title)) n++;
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
    const maxLevel = REC_IGNORE[SETTINGS.recIgnore || 'vlow'];
    let linked = 0, considered = 0;
    try {
      const todo = readRecordings().filter(r => !r.recGid);
      for (let i = 0; i < todo.length; i++) {
        const r = todo[i]; considered++;
        setStatus('auto-matching ' + (i + 1) + '/' + todo.length + '…');
        const ko = koTrack(r.mi, r.ti);
        const ctx = { title: r.title, artist: r.trackArtist, length: r.trackLen };
        let sugg = (typeof ko.suggestedRecordings === 'function' ? (u(ko.suggestedRecordings) || []) : []);
        if (!sugg.length) {
          try { getEditor().recordingAssociation.findRecordingSuggestions(ko); } catch (e) {}
          for (let t = 0; t < 28; t++) { await new Promise(z => setTimeout(z, 250)); const loading = typeof ko.loadingSuggestedRecordings === 'function' ? u(ko.loadingSuggestedRecordings) : false; sugg = u(ko.suggestedRecordings) || []; if (!loading && sugg.length) break; if (!loading && t >= 3) break; }
        }
        if (!sugg.length) continue;
        // rank ALL suggestions by confidence and take the best (lowest level) — MB's ordering sometimes
        // puts a worse match (wrong artist / off length) on top. Ties keep MB's order (first wins). #119
        let best = null, bestLevel = Infinity;
        for (let s = 0; s < sugg.length; s++) { const d = suggData(sugg[s]); const lvl = recConfLevel(d, ctx); if (lvl < bestLevel) { bestLevel = lvl; best = d; if (lvl === 0) break; } }
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
  async function searchRecordings(q) {
    q = (q || '').trim(); if (!q) return [];
    try {
      const j = await fetch(`${ORIGIN}/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=15&inc=artist-credits+releases+isrcs`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      return (j.recordings || []).map(r => ({
        gid: r.id, name: r.title, length: r.length || null,
        artist: (r['artist-credit'] || []).map(a => (a.name || (a.artist && a.artist.name) || '') + (a.joinphrase || '')).join(''),
        ac: r['artist-credit'] || [],   // raw credit, so the linked recording keeps its artist on screen
        releases: (() => { const seen = new Set(), out = []; (r.releases || []).forEach(rl => { const k = rl.id || rl.title; if (rl.title && !seen.has(k)) { seen.add(k); out.push({ name: rl.title, gid: rl.id }); } }); return out; })(),
        isrcs: r.isrcs || [],
        comment: r.disambiguation || '',
      }));
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
    if (ap && ap.results) ap.results.forEach(r => { const name = u(r.name) || r.name, gid = u(r.gid) || r.gid; const k = gid || name; if (name && !seen.has(k)) { seen.add(k); rels.push({ name, gid }); } });
    const isrcs = (u(e.isrcs) || []).map(x => typeof x === 'string' ? x : (x && (x.isrc || u(x.isrc)))).filter(Boolean);
    return { entity: e, gid: u(e.gid), name: u(e.name), length: u(e.length), artist: acText(u(e.artistCredit)), releases: rels, isrcs };
  }
  // confidence of a picker result vs the track that opened the picker (same scheme as the table dot)
  function resultConfClass(data, ctx) {
    if (!ctx) return '';
    return ' tc-conf-' + ['match', 'low', 'vlow', 'xlow'][recConfLevel(data, ctx)];
  }
  // render "appears on" releases as links (each {name,gid}); plain strings tolerated for safety.
  // cap = max links shown before a "+N more" tail (0 = show all). #119
  function relLinksHtml(relsArr, cap) {
    const arr = relsArr || []; const shown = cap ? arr.slice(0, cap) : arr;
    const html = shown.map(rl => {
      const o = rl && typeof rl === 'object' ? rl : { name: rl };
      return o.gid ? '<a href="' + ORIGIN + '/release/' + esc(o.gid) + '" target="_blank" rel="noopener">' + esc(o.name) + '</a>' : esc(o.name);
    }).join(', ');
    const extra = arr.length - shown.length;
    return html + (extra > 0 ? ' <span class="tc-rpk-more">+' + extra + ' more</span>' : '');
  }
  // a picker result row — mirrors the native list: title + length, by artist, appears on, ISRCs;
  // left-border colour = confidence vs the track
  function recRowHtml(data, ctx) {
    const rels = relLinksHtml(data.releases, 6);
    const isrcs = (data.isrcs || []).slice(0, 4).join(', ');
    // highlight the fields that differ from the track, like the table does
    const dT = ctx && data.name && ctx.title && !recNameEq(data.name, ctx.title);
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
        (trackArtist ? '<span class="tc-rpk-hdby"> · ' + esc(trackArtist) + '</span>' : '') +
        (trackLen ? '<span class="tc-rpk-hdlen"> · ' + fmtMs(trackLen) + '</span>' : '') + '</div>' +
      '<div class="tc-rpk-curwrap">' +
        '<div class="tc-rpk-cur">' + curHtml + '</div>' +
        (curGid ? '<div class="tc-rpk-curon">appears on: <span class="tc-rpk-curon-list">…</span></div>' : '') +
        (isNew ? '' : '<div class="tc-rpk-curactions"><button class="tc-rpk-newbtn" title="create a brand-new recording for this track instead of reusing one">＋ new recording</button></div>') +
      '</div>' +
      (showCopyT || showCopyA ? '<div class="tc-rpk-copy">' +
        (showCopyT ? '<label><input type="checkbox" class="tc-rpk-ct"' + (entry.copyTitle ? ' checked' : '') + '> copy track <b>title</b> to the recording (on submit)</label>' : '') +
        (showCopyA ? '<label><input type="checkbox" class="tc-rpk-ca"' + (entry.copyArtist ? ' checked' : '') + '> copy track <b>artist</b> to the recording (on submit)</label>' : '') + '</div>' : '') +
      '<input class="tc-rpk-q" type="text" placeholder="search recordings by name…">' +
      '<div class="tc-rpk-sec tc-rpk-suggsec">suggestions</div><div class="tc-rpk-list tc-rpk-sugg"><div class="tc-rpk-empty">finding suggestions…</div></div>' +
      '<div class="tc-rpk-sec">search results<button class="tc-rpk-relax" type="button" title="relaxed search — show all recordings with this title, ignoring artist &amp; length">show all</button></div><div class="tc-rpk-list tc-rpk-res"><div class="tc-rpk-empty">type to search…</div></div>';
    const newBtn = pop.querySelector('.tc-rpk-newbtn'); if (newBtn) newBtn.onclick = () => pickNewRecording(entry);
    const ctEl = pop.querySelector('.tc-rpk-ct'); if (ctEl) ctEl.onchange = () => { setCopy('title', entry, ctEl.checked); rerenderRec(); };
    const caEl = pop.querySelector('.tc-rpk-ca'); if (caEl) caEl.onchange = () => { setCopy('artist', entry, caEl.checked); rerenderRec(); };
    // fill the current recording's full "appears on" (all releases, linkable) — not in the page model, so fetch it
    if (curGid) {
      fetch(ORIGIN + '/ws/2/recording/' + curGid + '?fmt=json&inc=releases', { headers: { Accept: 'application/json' } })
        .then(r => r.json()).then(j => {
          if (!_recPop) return; const el = pop.querySelector('.tc-rpk-curon-list'); if (!el) return;
          const seen = new Set(), rels = [];
          (j.releases || []).forEach(rl => { const k = rl.id || rl.title; if (rl.title && !seen.has(k)) { seen.add(k); rels.push({ name: rl.title, gid: rl.id }); } });
          el.innerHTML = rels.length ? relLinksHtml(rels, 0) : '—';
        }).catch(() => {});
    }
    _recPopDrag(pop.querySelector('.tc-rpk-hd'));   // header is the drag handle
    _recPopReposition();   // dock it right + tall now the content (and height) exist
    const q = pop.querySelector('.tc-rpk-q'), suggBox = pop.querySelector('.tc-rpk-sugg'), resBox = pop.querySelector('.tc-rpk-res');
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

  W.__trackCannon = { readTracklist, buildModel, commitTrack, resetTrack, revertTrack, trackChanged, removeTrack, moveTrack, addTracks, searchArtist, fetchEntity, createArtist, openPanel, showMirror, hideMirror, revertAll, revertSlot, pickArtist, addSlot, removeSlot, splitSlot, matchSlot, snapshotOriginals, readRecordings, showRecMirror, hideRecMirror, recordingsVisible, recConfidence, applyView, get apolloOn() { return apolloOn(); }, get model() { return MODEL; }, get settings() { return SETTINGS; } };

  (async function main() {
    if (handleArtistPageCallback()) { Log.info('artist-create callback — posting MBID back and closing'); return; }
    if (!/^\/release\/(add|.+\/edit)/.test(location.pathname)) return;   // /artist/* (non-callback) just loads the channel listener
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    Log.info('editor ready');
    snapshotOriginals();
    const tl = readTracklist();
    Log.info('tracklist:', tl.length, 'tracks ·', tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0), 'unresolved slots');
    if (apolloOn()) showMirror();   // pre-build the tracklist takeover inside the (possibly hidden) #tracklist panel
    applyView();                    // apply the chosen view to whichever tab is initially visible (tracklist and/or recordings)
    if (tracklistVisible() || recordingsVisible()) ensureLauncher();   // one toggle, present on both managed tabs
    watchTabs();                    // #119 — single watcher drives the tracklist + recordings takeovers + the shared toggle
  })();
})();
