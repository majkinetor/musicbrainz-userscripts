// ==UserScript==
// @name         Apollo Editor
// @namespace    https://musicbrainz.org/
// @version      2026.6.23.133821
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Same table whether floating or replacing the integrated tracklist.
// @author       majkinetor
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M13 22 L19 22 L16 30 Z' fill='%23ff8c3b'/%3E%3Cpath d='M14.4 22 L17.6 22 L16 27 Z' fill='%23ffd24a'/%3E%3Cpath d='M12 18 L8 23.5 L12 22 Z' fill='%233d2470'/%3E%3Cpath d='M20 18 L24 23.5 L20 22 Z' fill='%233d2470'/%3E%3Cpath d='M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z' fill='%235f3ec0'/%3E%3Ccircle cx='16' cy='12.5' r='3' fill='%23cfe8ff' stroke='%232a1a52' stroke-width='1'/%3E%3C/svg%3E
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
// @match        https://*.musicbrainz.org/release/add*
// @match        https://*.musicbrainz.org/release/*/edit
// @match        https://*.musicbrainz.org/release/*/edit_annotation
// @match        https://*.musicbrainz.org/artist/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      *
// @run-at       document-start
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

  // #283 every Log.* call is captured into an in-page buffer and surfaced in a
  // dedicated log viewer — opened from a Log button next to "? Help" —
  // copy/pastable as a Markdown <details> block, like the other scripts. (The
  // console output was dropped: it just duplicated this buffer.)
  const LOG = [];
  const _logListeners = new Set();
  const _lpad = (n, w = 2) => String(n).padStart(w, '0');
  const _logTs = d => `${_lpad(d.getHours())}:${_lpad(d.getMinutes())}:${_lpad(d.getSeconds())}.${_lpad(d.getMilliseconds(), 3)}`;
  const _logStr = v => {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.message || String(v);
    if (v && v.nodeType) return '<' + (v.tagName || 'node').toLowerCase() + '>';
    try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
  };
  function _logRecord(sev, args) {
    const msg = args.map(_logStr).join(' ').replace(/\s+/g, ' ').trim();
    if (!msg) return;
    LOG.push({ t: new Date(), sev, msg });
    _logListeners.forEach(f => { try { f(); } catch (e) {} });
  }
  const Log = {
    info:  (...a) => _logRecord('info', a),
    warn:  (...a) => _logRecord('warn', a),
    err:   (...a) => _logRecord('error', a),
    ok:    (...a) => _logRecord('ok', a),
    debug: (...a) => _logRecord('debug', a),
  };
  const _logCounts = () => LOG.reduce((acc, e) => { if (e.sev === 'warn') acc.warn++; else if (e.sev === 'error') acc.error++; return acc; }, { warn: 0, error: 0 });
  // escape, then turn http(s) URLs into clickable links for the log viewer
  const _logLinkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (m) => {
    const t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];   // keep trailing punctuation out of the URL
    const url = m.slice(0, m.length - t.length);
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>${t}`;
  });
  // copy/pastable Markdown — collapsed <details> wrapping a fenced log block.
  function logMarkdown() {
    const PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    const body = LOG.length ? LOG.map(e => `${_logTs(e.t)}  ${PRE[e.sev] || ''}${e.msg}`).join('\n') : '(no activity logged)';
    const c = _logCounts();
    let title = 'Apollo Editor';
    try { title += ' v' + scriptVersion(); } catch (e) {}
    const tally = (c.warn || c.error) ? ` (${c.warn} warning${c.warn === 1 ? '' : 's'}, ${c.error} error${c.error === 1 ? '' : 's'})` : '';
    return `<details><summary>${title} — session log${tally}</summary>\n\n` + '```log\n' + body + '\n```' + `\n\n</details>`;
  }
  async function copyLog(btn) {
    const md = logMarkdown(); let ok = false;
    try { await navigator.clipboard.writeText(md); ok = true; }
    catch (e) { try { const ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (x) {} }
    if (btn) { const o = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = o; btn.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); }
  }
  // #283 remember the log window across sessions: open?/minimized?/position
  const LOGWIN_KEY = 'apolloEditor.logwin';
  const loadLogWin = () => { try { return JSON.parse(localStorage.getItem(LOGWIN_KEY) || '{}'); } catch (e) { return {}; } };
  const saveLogWin = (patch) => { try { localStorage.setItem(LOGWIN_KEY, JSON.stringify(Object.assign(loadLogWin(), patch))); } catch (e) {} };
  // the Log button opens this popup: the full session log + a Copy control.
  function openLog() {
    document.getElementById('tc-logpop')?.remove();
    style();   // ensure the popup CSS is injected (e.g. on auto-open before settings is opened)
    saveLogWin({ open: true });
    const st = loadLogWin();
    const pop = document.createElement('div'); pop.id = 'tc-logpop';
    pop.innerHTML = `<div class="tc-logpop-h"><b>Activity log</b> <span class="tc-log-badge"></span><span class="tc-logpop-sp"></span>`
      + `<button class="tc-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>`
      + `<button class="tc-logpop-min" type="button" title="Minimize">–</button>`
      + `<button class="tc-logpop-x" type="button" title="Close">✕</button></div>`
      + `<div class="tc-log-list"></div>`;
    document.body.appendChild(pop);
    // restore saved open position (used when not minimized, and remembered for restore)
    if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
    pop._restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
    const renderList = () => {
      const list = pop.querySelector('.tc-log-list');
      list.innerHTML = LOG.length
        ? LOG.map(e => `<div class="tc-log-li tc-log-${e.sev}"><span class="tc-log-t">${_logTs(e.t)}</span><span class="tc-log-m">${_logLinkify(e.msg)}</span></div>`).join('')
        : '<div class="tc-log-empty">No activity yet.</div>';
      const c = _logCounts();
      pop.querySelector('.tc-log-badge').textContent = `(${LOG.length})` + (c.warn || c.error ? ` · ${c.warn}⚠ ${c.error}✖` : '');
      list.scrollTop = list.scrollHeight;
    };
    renderList();
    _logListeners.add(renderList);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { saveLogWin({ open: false }); _logListeners.delete(renderList); pop.remove(); document.removeEventListener('keydown', onKey); };
    pop.querySelector('.tc-logpop-copy').onclick = () => copyLog(pop.querySelector('.tc-logpop-copy'));
    const minBtn = pop.querySelector('.tc-logpop-min');
    const setMin = (m) => {
      minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
      if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to bottom
      else if (pop._restore) { Object.assign(pop.style, pop._restore); }
    };
    minBtn.onclick = () => { const m = pop.classList.toggle('min'); setMin(m); saveLogWin({ min: m }); };
    if (st.min) { pop.classList.add('min'); setMin(true); }   // restore minimized state
    pop.querySelector('.tc-logpop-x').onclick = close;
    // floating, non-modal window — draggable by its header
    pop.querySelector('.tc-logpop-h').addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const r = pop.getBoundingClientRect();
      pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = ev => { pop.style.left = Math.max(0, Math.min(innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px'; pop.style.top = Math.max(0, Math.min(innerHeight - 36, ev.clientY - oy)) + 'px'; };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (!pop.classList.contains('min')) { pop._restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' }; saveLogWin({ left: pop.style.left, top: pop.style.top }); } };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    document.addEventListener('keydown', onKey);
  }
  // first log line: the script + version. The MB release line is logged once the
  // editor is ready (so it carries the real title) — see init().
  Log.info('Apollo Editor' + (() => { try { return ' v' + GM_info.script.version; } catch (e) { return ''; } })());

  const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
  const ORIGIN = location.origin;
  const u = v => { try { return typeof v === 'function' ? v() : v; } catch (e) { return undefined; } };
  const getEditor = () => { try { return W.MB && W.MB.releaseEditor; } catch (e) { return null; } };
  // normalize hyphen/dash look-alikes (MB uses ‐ U+2010, others use - U+002D, en/em
  // dashes, minus…) to a plain '-' so e.g. "Gol‐e Yakh" folds the same as "Gol-e Yakh"
  const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[‐‑‒–—―−]/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
  const sameName = (a, b) => fold(a) === fold(b);
  // gid → artist disambiguation, harvested from every WS2/js artist-credit the
  // script fetches (search results, recording lookups). The MB page (KO) model
  // doesn't carry disambiguations for freshly-picked entities, so the recordings
  // table falls back to this cache to show them after a pick. #195
  const _disamb = new Map();
  const noteDisamb = (gid, c) => { if (gid && c) _disamb.set(gid, c); };
  const getDisamb = gid => (gid && _disamb.get(gid)) || '';
  const MBID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  // a MusicBrainz /artist/<mbid> URL, a bare MBID, or an MBID pasted anywhere in the text → the gid
  function mbidFrom(v) {
    v = (v || '').trim();
    const url = v.match(new RegExp('musicbrainz\\.org/artist/(' + MBID_RE.source + ')', 'i')); if (url) return url[1].toLowerCase();
    const m = v.match(new RegExp('(?:^|[\\s/])(' + MBID_RE.source + ')(?:[\\s/?#]|$)', 'i')); return m ? m[1].toLowerCase() : null;
  }
  // an ISRC (CC-XXX-YY-NNNNN), with or without separators, found as a standalone
  // token → the normalised 12-char uppercase form. Word-boundaried so it won't
  // fire mid-string; the structure (2 alpha · 3 alphanum · 7 digit) is specific
  // enough not to collide with a bare MBID. #196
  const ISRC_TOKEN = /\b([A-Za-z]{2})-?([A-Za-z0-9]{3})-?([0-9]{2})-?([0-9]{5})\b/;
  function isrcFrom(v) {
    const m = String(v || '').match(ISRC_TOKEN);
    return m ? (m[1] + m[2] + m[3] + m[4]).toUpperCase() : null;
  }

  /* ── create-artist-in-a-tab → auto-insert (BroadcastChannel handshake, like the Discogs importer) ── */
  const ART_CHANNEL = ('BroadcastChannel' in W) ? new W.BroadcastChannel('apollo-editor-artist') : null;
  const PENDING_KEY = 'apolloEditor.pendingArtist';
  const CLOSE_KEY   = 'apolloEditor.closeAfterEdit';   // tab opened just to add a Discogs link → self-close after submit
  const _pendingCreates = new Map(); let _createSeq = 0;
  if (ART_CHANNEL) ART_CHANNEL.addEventListener('message', e => {
    const d = e.data; if (!d || d.type !== 'tc-artist-created') return;
    const pend = _pendingCreates.get(d.token); if (!pend) return;
    _pendingCreates.delete(d.token);
    if (!d.gid) { Log.warn('artist created but no gid came back'); return; }
    // The postMessage can only carry a plain {gid,name,id}, but commitTrack writes
    // `artist: <entity>` into the NATIVE artist credit — and MB only treats it as a
    // real linked artist when it's the WHOLE entity (the same shape fetchEntity / the
    // paste path produce). A plain object renders in the Apollo table but is dropped
    // from the native model on submit. So re-fetch the full entity in THIS tab (the
    // artist is already indexed — the create tab fetched it before posting back). #191
    fetchEntity(d.gid).then(ent => {
      pickArtist(pend.slot, ent || { gid: d.gid, name: d.name, id: d.id });
      // #273: close the background create tab via its handle (a GM-opened tab can't always self-close).
      try { if (pend.bgTab && typeof pend.bgTab.close === 'function') pend.bgTab.close(); } catch (x) {}
      Log.info('inserted newly-created artist', JSON.stringify(d.name), 'into the table' + (ent ? '' : ' (plain fallback — native link may be incomplete)'));
    });
  });

  /* ── settings ── */
  const SKEY = 'apolloEditor.settings.v1';
  function loadSettings() { const d = { apolloEnabled: true, colWidths: {}, applyMode: 'all', altRows: false, gridCols: false, gridRows: true, replaceReleaseInfo: true, replaceTracklist: true, replaceRecordings: true, modifyAnnotation: true, modifyDuplicates: true, autoMatch: false, autoMatchRec: false, discogsUrlMatch: true, recLenTol: 5, recIgnoreCase: true, recIgnorePunct: true, recTitleTol: 1, recCutoff: 'near', recDetailedHl: false, recPunctSize: 3, recHlColor: '#e53935', lastTool: '', layout: 'normal', lastView: 'apollo', zenMode: true, autoConfirmSeed: true, keepCaretColumn: true, srRegex: false, srTemplates: [] }; try { const stored = JSON.parse(localStorage.getItem(SKEY) || '{}'); const s = Object.assign(d, stored); if (stored.gridCols === undefined && stored.grid !== undefined) s.gridCols = stored.grid; return s; } catch (e) { return d; } }
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(SETTINGS)); } catch (e) {} }
  let SETTINGS = loadSettings();

  // FOUC guard (we run at document-start): on the standalone Edit annotation page, hide the native form until our
  // editor mounts (and removes #tc-anno-fouc), so the original interface never flashes. Skipped when off.
  if (/\/release\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/edit_annotation/.test(location.pathname)
      && SETTINGS.apolloEnabled !== false && SETTINGS.modifyAnnotation !== false) {
    const s = document.createElement('style'); s.id = 'tc-anno-fouc'; s.textContent = '#content > form{visibility:hidden}';
    (document.head || document.documentElement).appendChild(s);
    setTimeout(() => document.getElementById('tc-anno-fouc')?.remove(), 6000);   // safety: never hide forever if the editor fails to mount
  }

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
    list.forEach(c => noteDisamb(c.gid || c.id, c.comment));   // cache disambiguations for the table after a pick (#195)
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
      try { const w = await fetch(`${ORIGIN}/ws/2/artist?query=${encodeURIComponent(q)}&limit=100&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.json()); (w.artists || []).forEach(a => { cacheAliases(a.id, a.aliases || []); noteDisamb(a.id, a.disambiguation); }); }
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
  // MusicBrainz special-purpose artists carry hundreds of junk/locale aliases
  // (e.g. [unknown] → '"Gold Diggers of 1937" Chorus'); never surface one as an AKA.
  // Keyed by MBID, not a name pattern — not all are bracketed (Various Artists) and
  // plenty of real artists DO use brackets. (#171, per @chaban-mb)
  const SPECIAL_PURPOSE_ARTISTS = new Set([
    '125ec42a-7229-4250-afc5-e057484327fe', // [unknown]
    'f731ccc4-e22a-43af-a747-64213329e088', // [anonymous]
    '33cf029c-63b0-41a0-9855-be2a3665fb3b', // [data]
    '314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc', // [dialogue]
    'eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61', // [no artist]
    '9be7f096-97ec-4615-8957-8d40b5dcbc41', // [traditional]
    '89ad4ac3-39f7-470e-963a-56509c546377', // Various Artists
    '7e84f845-ac16-41fe-9ff8-df12eb32af55', // MusicBrainz Test Artist
    '66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49', // [Disney]
    'a0ef7e1d-44ff-4039-9435-7d5fefdeecc9', // [theatre]
    '90068d37-bae7-4292-be4a-704c145bd616', // [church chimes]
    '80a8851f-444c-4539-892b-ad2a49292aa9', // [language instruction]
  ]);
  function aliasStr(c) {
    if (c.gid && SPECIAL_PURPOSE_ARTISTS.has(c.gid)) return null;   // #171 — no AKA for special-purpose artists
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

  /* ── Discogs artist-link matching (#224) ──────────────────────────────────────
   * When the release carries a Discogs link, match each track artist by its
   * Discogs URL — a strong, human-verified signal — before the name search.
   * Self-contained: Apollo stays fully independent of Credit Hoarder. Gated by
   * the "Discogs artist link matching" option. Resolves one slot at a time
   * (matchModel is already sequential), waiting + retrying on rate limits. */
  const DISCOGS_TOKEN = 'gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ';
  // Scrape the release's Discogs link from the page — edit-relationships anchors
  // or the release editor's external-link inputs. First match wins (#224).
  let _discogsUrlLogged = false;
  let _discVerifyUrl = null, _lastDiscCheck = null;   // dedupe the per-run "verifying…"/outcome log lines
  function discogsReleaseUrlFromPage() {
    const re = /discogs\.com\/(?:[a-z]{2}\/)?(?:[^/\s"']*\/)?release\/(\d+)/i;
    let url = null;
    for (const a of document.querySelectorAll('a[href*="discogs.com/release/"]')) { const m = re.exec(a.getAttribute('href') || ''); if (m) { url = `https://www.discogs.com/release/${m[1]}`; break; } }
    if (!url) for (const inp of document.querySelectorAll('input')) { const m = re.exec(inp.value || ''); if (m) { url = `https://www.discogs.com/release/${m[1]}`; break; } }
    if (url && !_discogsUrlLogged) { _discogsUrlLogged = true; Log.info('Discogs: release link found —', url); }
    return url;
  }
  // Map folded track title → array of Discogs artist www-URLs (one per credited
  // track artist, in order). Keyed by title like the sibling map, so it's robust
  // to medium/ordering differences. Cached per release link.
  let _discogsMap = { url: undefined, map: null };
  async function loadDiscogsMap(force) {
    if (SETTINGS.discogsUrlMatch === false) return null;
    const url = discogsReleaseUrlFromPage();
    if (!url) { _discogsMap = { url: null, map: null }; return null; }
    if (!force && _discogsMap.url === url && _discogsMap.map) return _discogsMap.map;
    const api = `${url.replace('https://www.discogs.com/release/', 'https://api.discogs.com/releases/')}?token=${DISCOGS_TOKEN}`;
    // #281: the Discogs API (one shared token) is rate-limited — a 429 used to make
    // the fetch return null, which was then CACHED as an empty map, so the whole
    // session showed no links until a full page reload. Retry with backoff, and
    // crucially never cache a FAILED fetch (return null → caller retries / shows a
    // retry affordance). Only a real JSON response is cached (success or genuine
    // empty), keyed by URL.
    for (let attempt = 0; attempt < 4; attempt++) {
      let r;
      try { r = await fetch(api); }
      catch (e) { Log.warn('Discogs match: fetch failed —', e.message); await _sleep(800 * (attempt + 1)); continue; }   // network → retry, don't cache
      if (r.status === 429 || r.status === 503) {                       // rate limited → back off, don't cache
        const ra = parseInt(r.headers.get('retry-after') || '', 10);
        Log.warn('Discogs match: rate limited (HTTP', r.status + ') — backing off');
        await _sleep(Math.max(1000, (ra > 0 ? ra : 2) * 1000));
        continue;
      }
      if (!r.ok) { Log.warn('Discogs match: HTTP', r.status); await _sleep(800 * (attempt + 1)); continue; }   // transient → retry, don't cache
      let json = null;
      try { json = await r.json(); } catch (e) { await _sleep(800); continue; }
      const map = new Map();
      // #283: the release-level artist(s) (194 = Discogs "Various", skip) — used as a
      // fallback for tracks that credit no per-track artist (single-artist releases).
      map.releaseArtists = (json && Array.isArray(json.artists)) ? json.artists.filter(a => a && a.id && a.id !== 194).map(a => `https://www.discogs.com/artist/${a.id}`) : [];
      // #283: also keep the per-track artist URLs in Discogs order, so a track whose
      // TITLE doesn't match (transliteration / punctuation the fold can't catch) can
      // still be matched BY POSITION when the two tracklists are the same length.
      map.byPos = [];
      if (json && Array.isArray(json.tracklist)) {
        json.tracklist.filter(t => (t.type_ || 'track') === 'track').forEach(t => {
          const urls = (t.artists || []).map(a => (a && a.id) ? `https://www.discogs.com/artist/${a.id}` : null);
          map.byPos.push(urls);
          const key = fold(t.title || ''); if (!key || map.has(key)) return;
          map.set(key, urls);
        });
        // this loads the Discogs release for the link CHECK (and for URL-matching unset
        // artists) — not re-matching already-set ones, hence "loaded" not "matched".
        Log.info('Discogs: loaded release —', map.size, 'track title(s)' + (map.releaseArtists.length ? ` + ${map.releaseArtists.length} release artist(s)` : ''), 'from', url);
      } else { Log.warn('Discogs: release JSON had no tracklist'); }
      _discogsMap = { url, map };   // cache ONLY a real response (success or genuine empty)
      return map;
    }
    Log.warn('Discogs match: could not load release JSON after retries (rate-limited?) — leaving uncached');
    return null;   // all retries exhausted → unknown, NOT cached, so the next call retries
  }
  // #283: a track's per-slot Discogs artist URLs — by folded title, falling back to
  // POSITION when the title doesn't match and the two tracklists are the same length
  // (so subtle title differences don't drop the track). { urls, byPos }.
  function discogsUrlsForTrack(dmap, title, index, total) {
    if (!dmap) return { urls: null, byPos: false };
    const byTitle = dmap.get(fold(title));
    if (byTitle) return { urls: byTitle, byPos: false };
    if (dmap.byPos && dmap.byPos.length === total && total > 0) return { urls: dmap.byPos[index] || null, byPos: true };
    return { urls: null, byPos: false };
  }
  // Resolve a Discogs artist URL to MB artist(s) via its URL relationship.
  // Returns [{ gid, name }] (0 / 1 / many) on success, or `null` when the lookup
  // could not complete (rate-limited / network) — callers must treat null as
  // "unknown" and NOT cache it, so a transient 503 never becomes a false
  // negative (#227). Only successful responses are cached.
  const _discogsResolveCache = new Map();
  const _sleep = ms => new Promise(z => setTimeout(z, ms));
  // The public /ws/2 endpoint is rate-limited (~1 req/s). Serialize every call
  // through a gate with a minimum gap so a model full of artists doesn't trip
  // the limiter and get a wall of 503s (#227).
  let _wsGate = Promise.resolve(); let _wsLast = 0; const WS_MIN_GAP = 700;
  function wsGet(url) {
    const run = async () => {
      const gap = WS_MIN_GAP - (Date.now() - _wsLast);
      if (gap > 0) await _sleep(gap);
      try { return await fetch(url, { headers: { Accept: 'application/json' } }); }
      finally { _wsLast = Date.now(); }
    };
    const p = _wsGate.then(run, run);
    _wsGate = p.then(() => {}, () => {});   // keep the chain alive regardless of outcome
    return p;
  }
  async function resolveByDiscogsUrl(discogsUrl, force) {
    if (!discogsUrl) return [];
    if (!force && _discogsResolveCache.has(discogsUrl)) return _discogsResolveCache.get(discogsUrl);
    for (let attempt = 0; attempt < 5; attempt++) {
      let r;
      try { r = await wsGet(`${ORIGIN}/ws/2/url?resource=${encodeURIComponent(discogsUrl)}&inc=artist-rels&fmt=json`); }
      catch (e) { await _sleep(1200); continue; }                 // network error → retry, don't cache
      if (r.status === 404) { _discogsResolveCache.set(discogsUrl, []); _dput('resolve', discogsUrl, []); return []; }   // URL not in MB → 0 owners (cacheable)
      if (r.status === 429 || r.status === 503) {                 // rate limited → back off, don't cache
        const ra = parseInt(r.headers.get('retry-after') || '', 10);
        await _sleep(Math.max(1200, (ra > 0 ? ra : 1) * 1000));
        continue;
      }
      if (!r.ok) { await _sleep(1200); continue; }                // other transient error → retry, don't cache
      let j; try { j = await r.json(); } catch (e) { await _sleep(1200); continue; }
      const seen = new Set();
      const out = (j.relations || []).filter(rel => rel.artist && rel.artist.id).map(rel => ({ gid: rel.artist.id, name: rel.artist.name })).filter(e => !seen.has(e.gid) && seen.add(e.gid));
      _discogsResolveCache.set(discogsUrl, out); _dput('resolve', discogsUrl, out);   // cache ONLY a successful response
      return out;
    }
    return null;   // all retries exhausted — unknown, leave uncached so it's retried later
  }
  // slot status from a match result — 'disc' for a confident Discogs-URL match,
  // 'rg' for a release-group sibling, else the name-search confidence.
  const slotStatusOf = m => !m.entity ? 'none' : (m.source === 'rg' ? 'rg' : (m.source === 'discogs' && m.confidence === 'high') ? 'disc' : m.confidence);

  /* ── add / create the Discogs link for a slot (#227) ──────────────────────────
   * Stash the slot's Discogs artist URL and decide whether a link can be added:
   *   - unresolved slot + known URL → create the artist seeded with the link
   *   - matched slot + URL that has NO MB owner yet → add it to that artist
   *   - URL already owned (by this or another artist) → nothing to add
   * Reuses the cached `resolveByDiscogsUrl` (no extra request during matching). */
  const DISCOGS_ARTIST_LINK_TYPE = '180';   // MB Discogs artist-URL relationship (string, for seeding)
  const DISCOGS_LINK_TYPE_ID = 180;          // numeric, for matching the js entity rels
  const discogsIdOf = u => (String(u).match(/\/artist\/(\d+)/) || [])[1] || null;
  // The Discogs URLs a MB artist links, via the INTERNAL /ws/js entity endpoint
  // (not rate-limited). Returns an array (possibly empty) on success, or null on
  // failure. Cached per gid (#227 speed: linked artists cost no /ws/2 call).
  const _artistRelsCache = new Map();

  // #231: persist the Discogs link caches across reloads/releases so the
  // rate-limited /ws/2/url lookups (and the internal rels reads) aren't repeated
  // on F5 or when revisiting a release. 1-day TTL (links change rarely; a fresh
  // edit still drops the entry immediately via the #227 invalidation). Invisible
  // (no UI), apollo-only. Stored as { resolve: {url:{v,t}}, rels: {gid:{v,t}} }.
  const DCACHE_KEY = 'apollo:discogs-link-cache-v1';
  const DCACHE_TTL = 24 * 60 * 60 * 1000;
  let _dpersist = { resolve: {}, rels: {} };
  let _dsaveTimer = null;
  function _dsave() { if (_dsaveTimer) return; _dsaveTimer = setTimeout(() => { _dsaveTimer = null; try { localStorage.setItem(DCACHE_KEY, JSON.stringify(_dpersist)); } catch (e) {} }, 700); }
  function _dput(kind, key, val) { _dpersist[kind][key] = { v: val, t: Date.now() }; _dsave(); }
  function _ddrop(kind, key) { if (_dpersist[kind] && _dpersist[kind][key]) { delete _dpersist[kind][key]; _dsave(); } }
  (function _dloadPersist() {
    try {
      const o = JSON.parse(localStorage.getItem(DCACHE_KEY) || 'null');
      if (!o || typeof o !== 'object') return;
      const now = Date.now(); let pruned = false;
      for (const [k, e] of Object.entries(o.resolve || {})) { if (e && now - e.t < DCACHE_TTL) { _dpersist.resolve[k] = e; _discogsResolveCache.set(k, e.v); } else pruned = true; }
      for (const [k, e] of Object.entries(o.rels || {})) { if (e && now - e.t < DCACHE_TTL) { _dpersist.rels[k] = e; _artistRelsCache.set(k, e.v); } else pruned = true; }
      if (pruned) _dsave();   // write back without the expired entries
    } catch (e) {}
  })();

  async function artistDiscogsUrls(gid) {
    if (!gid) return [];
    if (_artistRelsCache.has(gid)) return _artistRelsCache.get(gid);
    let out = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await fetch(`${ORIGIN}/ws/js/entity/${gid}?inc=rels`, { headers: { Accept: 'application/json' } });
        if (r.status === 429 || r.status === 503) { await _sleep(800); continue; }   // rate limited → back off, don't cache a miss
        if (!r.ok) { await _sleep(500); continue; }
        const j = await r.json();
        out = (j.relationships || j.relations || [])
          .filter(x => x.linkTypeID === DISCOGS_LINK_TYPE_ID && (x.target_type === 'url' || (x.target && x.target.entityType === 'url')))
          .map(x => (x.target && (x.target.name || x.target.decoded || x.target.pretty_name)) || '');
        break;
      } catch (e) { await _sleep(500); }
    }
    if (out !== null) { _artistRelsCache.set(gid, out); _dput('rels', gid, out); }   // cache only a real response (a rate-limited miss stays uncached → retried)
    return out;
  }
  async function tagDiscogsAddable(slot, durl) {
    slot._discogsUrl = durl || null;
    slot._discogsConflict = null;
    slot._discogsMismatch = null;
    slot._discogsPending = false;
    slot._discogsChecked = false;
    if (!durl || SETTINGS.discogsUrlMatch === false) { slot._discogsAddable = false; return; }
    // #281: only a RESOLVED (committed) artist can meaningfully have/lack a Discogs
    // link — an unresolved slot has no MB artist to link, and on add-release that
    // littered every row with chains/warnings. Skip those (the ＋ create button still
    // seeds slot._discogsUrl, so create-with-link is unaffected). Keep _discogsUrl set.
    if (!slot.committed || !slot.gid) { slot._discogsAddable = false; return; }
    slot._discogsChecked = true;
    if (slot.gid) {
      // FREE check first: this artist's own Discogs links (internal endpoint)
      const own = await artistDiscogsUrls(slot.gid);
      if (own === null) { slot._discogsAddable = false; slot._discogsPending = true; return; }   // unknown
      const want = discogsIdOf(durl);
      if (own.some(u => discogsIdOf(u) === want)) { slot._discogsAddable = false; return; }       // already linked to THIS Discogs page → legit, no badge
      if (own.length) {   // #227: artist links a DIFFERENT Discogs page than the release credits → mismatch.
        slot._discogsAddable = true;   // still offer to add the release's link (majkinetor) — flagged with ⚠
        slot._discogsMismatch = own.find(u => discogsIdOf(u)) || own[0];
        return;
      }
      // /ws/js found no Discogs link — confirm with the AUTHORITATIVE URL→artist
      // lookup before declaring it missing. This also catches a false-empty
      // /ws/js response (the artist actually owns the URL) so we never offer to
      // add a link it already has (#227).
      const hits = await resolveByDiscogsUrl(durl);
      if (hits === null) { slot._discogsAddable = false; slot._discogsPending = true; return; }
      if (hits.some(h => h.gid === slot.gid)) { slot._discogsAddable = false; return; }   // this artist already owns the URL → legit
      slot._discogsAddable = true;
      if (hits.length) slot._discogsConflict = hits[0];     // URL owned by a different artist → add anyway, but warn
      return;
    }
    // unresolved slot — need the URL→artist lookup to decide create vs. pick
    const hits = await resolveByDiscogsUrl(durl);
    if (hits === null) { slot._discogsAddable = false; slot._discogsPending = true; return; }
    slot._discogsAddable = hits.length === 0;
    if (hits.length) slot._discogsConflict = hits[0];
  }
  // Tag every slot in the model — covers page-load 'set' artists, which skip the
  // match pass (#227). Updates each row as it resolves (real-time) and shows
  // progress in the always-visible toolbar status. Cached resolves are instant.
  // The release's Discogs link can land in the DOM a beat after we're invoked —
  // it lives on the Release-Information tab and switching to Tracklist first
  // races its render. Poll briefly (silently — blank badge, not "checking…") so
  // the check still runs on the FIRST visit instead of bailing to nothing. A
  // release that genuinely has no Discogs link just polls out and stays blank.
  async function discogsReleaseUrlSoon(maxMs = 8000) {
    const t0 = Date.now();
    for (;;) {
      const u = discogsReleaseUrlFromPage();
      if (u || Date.now() - t0 >= maxMs) return u || null;
      await _sleep(400);
    }
  }
  let _tagDiscogsRunning = false, _tagDiscogsQueued = false;
  let _discMapFailed = false, _discMapRetried = false;   // #281: Discogs API unreachable → retry affordance
  async function tagDiscogsForAll() {
    if (!MODEL || SETTINGS.discogsUrlMatch === false) return;
    // #281: MB lazy-loads the rest of the tracks a beat after we start, which rebuilds
    // the model (fresh slots) and calls us again mid-run. The old guard DROPPED that
    // call, so the rebuilt model was never checked and the badge went blank until a
    // reload. Queue the call and re-run against the latest model when this run ends.
    if (_tagDiscogsRunning) { _tagDiscogsQueued = true; return; }
    _tagDiscogsRunning = true;
    try {
      // wait for the release Discogs link to exist before deciding there's nothing
      // to do — this is the #1 reason a first visit showed a blank badge.
      const relUrl = await discogsReleaseUrlSoon();
      if (!relUrl) { _discMapFailed = false; setDiscProgress(''); return; }   // genuinely no Discogs link on this release
      setDiscProgress('checking Discogs links…');   // now that we know there's work, show it
      const dmap = await loadDiscogsMap();
      if (dmap === null) {
        // #281: couldn't reach the Discogs API (rate-limited / network) after retries.
        // DON'T show a misleading blank (which looked like "no links, all good") — flag
        // it so the badge offers a one-click retry, and auto-retry once shortly so it
        // usually self-heals without the user having to reload the page.
        _discMapFailed = true;
        if (!_discMapRetried) { _discMapRetried = true; setTimeout(() => { if (_discMapFailed) tagDiscogsForAll(); }, 6000); }
        return;
      }
      _discMapFailed = false; _discMapRetried = false;
      const jobs = [];
      const relArtists = (dmap && dmap.releaseArtists) || [];
      let posUsed = 0;
      const total = MODEL.tracks.length;
      if (dmap) MODEL.tracks.forEach((t, ti) => {
        const { urls, byPos } = discogsUrlsForTrack(dmap, t.title, ti, total);
        const durls = urls || [];
        const hasTrackArtists = durls.some(Boolean);
        if (byPos && hasTrackArtists) posUsed++;
        t.slots.forEach((s, i) => {
          // per-track Discogs artist (by title, else by position), else inherit the
          // release-level artist (#283) — a track with no Discogs artists is the release artist
          const durl = durls[i] || (!hasTrackArtists ? (relArtists[i] || (relArtists.length === 1 ? relArtists[0] : null)) : null);
          if (durl) { s._discByPos = !!(durls[i] && byPos); jobs.push([s, durl]); }
        });
      });
      if (!jobs.length) {
        setDiscProgress('');
        // nothing to check (no per-track and no release-level artist links). Empty
        // model = still loading → stay silent; dedupe so re-runs don't repeat it.
        if (MODEL.tracks && MODEL.tracks.length && _lastDiscCheck !== 'none') { _lastDiscCheck = 'none'; Log.info('Discogs check: no artist links to verify'); }
        return;
      }
      const firstCheck = _discVerifyUrl !== relUrl;
      if (firstCheck) { _discVerifyUrl = relUrl; Log.info('Discogs check: verifying', jobs.length, 'artist link(s) across', total, total === 1 ? 'track' : 'tracks', (posUsed ? `(${posUsed} matched by position)` : '') + '…'); }
      let done = 0, lastRender = 0;
      for (const [s, durl] of jobs) {
        await tagDiscogsAddable(s, durl);
        if (firstCheck) Log.debug('Discogs:', (s.name || s.gid || 'slot'), '—', s._discogsPending ? 'pending (will re-check)' : !s._discogsAddable ? 'already linked' : discAddTooltip(s), s._discByPos ? '(matched by position)' : '');
        done++;
        // update rows + the progress text together, throttled — set the text AFTER
        // rerender so refreshStatus can't blank it
        const now = Date.now();
        if (now - lastRender > 300) { if (!isEditingNow()) rerender(); setDiscProgress(`checking Discogs links ${done}/${jobs.length}…`); lastRender = now; }
      }
      // A slot whose lookup returned null (cold cache / a transient rate-limit) is
      // left "pending" and never shows in the badge — that's why the FIRST visit
      // could read "0 links" while the SECOND (warm persistent cache) suddenly
      // revealed them. Retry the pending slots once now that the per-request gate
      // has paced out and the caches are partly warm, so the count settles on the
      // first visit. Anything still pending is surfaced by the badge (not hidden).
      const pend = jobs.filter(([s]) => s._discogsPending);
      if (pend.length) {
        let r = 0;
        for (const [s, durl] of pend) { setDiscProgress(`re-checking Discogs links ${++r}/${pend.length}…`); await tagDiscogsAddable(s, durl); }
      }
      const addable = jobs.filter(([s]) => s._discogsAddable).length;
      const pendLeft = jobs.filter(([s]) => s._discogsPending).length;
      const outcome = (addable === 0
        ? `all ${jobs.length} artist link(s) already in MusicBrainz ✓`
        : `${addable} of ${jobs.length} link(s) can be added to MusicBrainz`) + (pendLeft ? ` (${pendLeft} pending)` : '');
      if (outcome !== _lastDiscCheck) { _lastDiscCheck = outcome; Log.info('Discogs check:', outcome); }   // dedupe identical re-run results
      if (!isEditingNow()) rerender();
    } finally {
      _tagDiscogsRunning = false;
      // #281: if a rebuild raced us, re-run for the latest model (it repaints the
      // badge); otherwise settle the persistent badge now. (#227)
      if (_tagDiscogsQueued) { _tagDiscogsQueued = false; tagDiscogsForAll(); }
      else setDiscStat();
    }
  }
  // chain glyph shown in place of the artist-type icon when a Discogs link can be added
  const DISCOGS_LINK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  // warning triangle shown when the Discogs URL links a DIFFERENT MB artist (#227)
  const DISCOGS_WARN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  // after the artist's Discogs link changes (foreground return or background
  // postback): drop the stale caches and re-tag every slot crediting that artist.
  async function reTagAfterDiscogsLink(gid, url, name) {
    _artistRelsCache.delete(gid); _ddrop('rels', gid);
    _discogsResolveCache.delete(url); _ddrop('resolve', url);
    const own = await artistDiscogsUrls(gid);
    if (own && own.some(u => discogsIdOf(u) === discogsIdOf(url))) { MODEL && MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s.gid === gid) s._flash = true; })); discMsg(`added Discogs link to ${name}`); }
    await tagDiscogsForAll();
  }
  function addOrCreateDiscogsLink(slot, background) {
    const url = slot._discogsUrl; if (!url) return;
    if (slot.gid) {
      const gid = slot.gid;
      const p = new URLSearchParams({ 'edit-artist.url.0.text': url, 'edit-artist.url.0.link_type_id': DISCOGS_ARTIST_LINK_TYPE, 'edit-artist.edit_note': entityActionNote('Added Discogs link') });
      const editUrl = `${ORIGIN}/artist/${gid}/edit?${p}`;
      // #273: right-click → add the link SILENTLY in a background tab + auto-submit.
      // The edit-page bootstrap clicks "Enter edit"; the saved entity page posts
      // `tc-edit-committed` back, and we re-tag + close the GM tab here (no focus
      // return happens for a background tab).
      if (background && typeof GM_openInTab === 'function' && ART_CHANNEL) {
        const bgTab = GM_openInTab(`${editUrl}#tc-autocommit`, { active: false, insert: true });
        const onCommitted = (e) => {
          if (!e.data || e.data.type !== 'tc-edit-committed' || e.data.gid !== gid) return;
          ART_CHANNEL.removeEventListener('message', onCommitted);
          try { if (bgTab && typeof bgTab.close === 'function') bgTab.close(); } catch (x) {}
          reTagAfterDiscogsLink(gid, url, slot.name);
        };
        ART_CHANNEL.addEventListener('message', onCommitted);
        Log.info('Discogs link (background) for', slot.name || gid, '→', url);
        return;
      }
      // foreground: open the edit form, flag it to auto-close after submit, verify on return
      const tab = W.open(editUrl, '_blank');
      if (tab) { const trySet = () => { try { tab.sessionStorage.setItem(CLOSE_KEY, '1'); } catch (e) { setTimeout(trySet, 50); } }; trySet(); }
      Log.info('Discogs link: opening edit for', slot.name || gid, '→', url);
      const onReturn = async () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onReturn);
        await reTagAfterDiscogsLink(gid, url, slot.name);
      };
      document.addEventListener('visibilitychange', onReturn);
    } else {
      // no MB artist yet — create one seeded with the link (same as ＋)
      createArtist((slot.creditedAs || '').trim() || slot.name || '', slot, url, background);
    }
  }

  async function matchSlot(creditedAs, sib, discogsUrl) {
    const who = creditedAs || '(track artist)';
    // #224: a Discogs artist-link match outranks the name search.
    if (SETTINGS.discogsUrlMatch !== false && discogsUrl) {
      const hits = await resolveByDiscogsUrl(discogsUrl);
      if (hits && hits.length === 1) {
        const e = await fetchEntity(hits[0].gid);
        if (e && e.gid) { Log.info('Match:', who, '→', e.name, '— via Discogs URL'); return { entity: e, source: 'discogs', confidence: 'high', candidates: [e] }; }
      } else if (hits && hits.length > 1) {
        // ambiguous — surface every linked artist plus the name-search hits and let the user pick
        const named = await searchArtist(creditedAs);
        const ents = [];
        for (const h of hits) { const e = await fetchEntity(h.gid); if (e && e.gid) ents.push(e); }
        const merged = [...ents, ...named.filter(c => !ents.some(e => e.gid === (c.gid || c.id)))];
        if (ents.length) { Log.info('Match:', who, '—', ents.length, 'MB artists link that Discogs URL; pick one'); return { entity: ents[0], source: 'discogs', confidence: 'low', candidates: merged }; }
      }
      // couldn't resolve via the URL → fall back to name search. 0 hits = the
      // Discogs URL the release credits isn't linked to any MB artist (e.g. the
      // mismatch case); null = the lookup was rate-limited.
      if (hits && hits.length === 0) Log.debug('Match:', who, '— Discogs URL not linked to any MB artist → name search');
      else if (hits == null) Log.debug('Match:', who, '— Discogs URL lookup unavailable (rate-limited) → name search');
    }
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
    const dmap = await loadDiscogsMap();
    const tracks = [];
    const todo = tl.filter(t => t.names.some(n => !n.artistGid));
    let done = 0;
    for (let ti = 0; ti < tl.length; ti++) {
      const t = tl[ti];
      const sib = siblings.get(fold(t.title)) || null;
      const durls = discogsUrlsForTrack(dmap, t.title, ti, tl.length).urls;   // title, else by position (#283)
      const slots = [];
      for (let i = 0; i < t.names.length; i++) {
        const n = t.names[i];
        if (n.artistGid) { slots.push({ creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status: 'set', entity: null, gid: n.artistGid, name: n.artistName, candidates: [], committed: true }); }
        else {
          const m = await matchSlot(n.creditedAs, sib && sib[i], durls && durls[i]);
          const status = slotStatusOf(m);
          const slot = { creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status, entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, committed: false };
          await tagDiscogsAddable(slot, durls && durls[i]);   // #227
          slots.push(slot);
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
  function autoCommit() { MODEL.tracks.forEach(t => { let any = false; t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high' || s.status === 'disc') { s.committed = true; any = true; } }); if (any || t.slots.some(s => s.status === 'set')) commitTrack(t); }); }
  function autoCommitTrack(t) { let any = false; t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high' || s.status === 'disc') { s.committed = true; any = true; } }); if (any) commitTrack(t); }
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
      const dmap = await loadDiscogsMap();
      const todo = MODEL.tracks.filter(t => t.slots.some(s => s._pending)); let done = 0;
      const total = MODEL.tracks.length;
      for (let ti = 0; ti < MODEL.tracks.length; ti++) {
        const t = MODEL.tracks[ti];
        if (!t.slots.some(s => s._pending)) continue;
        const sib = siblings.get(fold(t.title)) || null;
        const durls = discogsUrlsForTrack(dmap, t.title, ti, total).urls;   // title, else by position (#283)
        for (let i = 0; i < t.slots.length; i++) {
          const s = t.slots[i]; if (!s._pending) continue;
          const m = await matchSlot(s.creditedAs, sib && sib[i], durls && durls[i]);
          Object.assign(s, { status: slotStatusOf(m), entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates }); delete s._pending;
          await tagDiscogsAddable(s, durls && durls[i]);   // #227
        }
        autoCommitTrack(t); if (!isEditing()) rerender();
        done++; if (onProgress) onProgress(done, todo.length);
      }
      if (!isEditing()) rerender();
    } finally { setMatching(false); refreshStatus(); }   // set the final per-medium badges once the pass is done
    // #227: tag/resolve Discogs links AFTER the match finally (so its summary
    // message isn't overwritten by refreshStatus) — covers 'set' artists too.
    // Not awaited: tagDiscogsForAll may now poll a few seconds for the release
    // Discogs link to load, and we don't want that holding up the caller's
    // alias-enrichment. It owns the badge and updates it when it settles.
    tagDiscogsForAll();
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
  // Lazily get the absolute overlay that hosts a title cell's action buttons
  // (Aa / ⋔), so they don't reserve flex width and shrink the input. #153
  function tActions(wrap) {
    let a = wrap.querySelector('.t-actions');
    if (!a) { a = document.createElement('span'); a.className = 't-actions'; wrap.appendChild(a); }
    return a;
  }

  /* ── create artist ── */
  function guessSortName(name) {
    const n = (name || '').trim();
    if (!/^[\x00-\x7F]+$/.test(n)) return n;
    const p = n.split(/\s+/); if (p.length < 2) return n;
    const last = p.pop(); return last + ', ' + p.join(' ');
  }
  // open MB's create-artist form; when it's saved, the new artist page posts the MBID back over the
  // channel (handshake via sessionStorage token) and closes itself, and we drop it into the slot.
  function createArtist(name, slot, discogsUrl, background) {
    let url = `${ORIGIN}/artist/create?edit-artist.name=${encodeURIComponent(name)}&edit-artist.sort_name=${encodeURIComponent(guessSortName(name))}`;
    // #227: seed the Discogs link so the new artist is born already linked
    if (discogsUrl) { url += `&edit-artist.url.0.text=${encodeURIComponent(discogsUrl)}&edit-artist.url.0.link_type_id=${DISCOGS_ARTIST_LINK_TYPE}`; _discogsResolveCache.delete(discogsUrl); }
    url += `&edit-artist.edit_note=${encodeURIComponent(entityActionNote('Created this artist'))}`;   // proper attribution on the created artist
    const token = (slot && ART_CHANNEL) ? ('tc-' + Date.now() + '-' + (++_createSeq)) : null;
    // #273: right-click → create SILENTLY in a background tab and auto-submit.
    // GM_openInTab gives no tab handle to write sessionStorage on, so we carry the
    // postback token in the URL hash; the create-page bootstrap stores it as the
    // pending marker, waits for the seeded form to render, and clicks "Enter edit".
    // The saved /artist/<gid> page posts the MBID back (existing handler) and we
    // close the GM tab here on that postback.
    if (background && token && typeof GM_openInTab === 'function') {
      const bgTab = GM_openInTab(`${url}#tc-autocommit=${encodeURIComponent(token)}`, { active: false, insert: true });
      _pendingCreates.set(token, { slot, bgTab });
      Log.info('create-artist (background) for', JSON.stringify(name), '— will auto-insert on save');
      return;
    }
    const tab = W.open(url, '_blank');   // NOT noopener — we set a token on the new tab's sessionStorage
    if (tab && token) {
      _pendingCreates.set(token, { slot });
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
  // a tab opened just to ADD a Discogs link to an existing artist closes itself
  // once the edit submits and redirects to the clean /artist/<gid> page. Guarded
  // to the clean entity page ($-anchored, so NOT /artist/<gid>/edit) — it never
  // closes before the user submits. The opener re-verifies on focus return.
  function handleEditLinkClose() {
    const m = location.pathname.match(new RegExp('^/artist/(' + MBID_RE.source + ')$', 'i')); if (!m) return false;
    let mark = null; try { mark = sessionStorage.getItem(CLOSE_KEY); } catch (e) {} if (!mark) return false;
    try { sessionStorage.removeItem(CLOSE_KEY); } catch (e) {}
    // #273: tell the opener the link edit committed so a BACKGROUND add-link (which
    // never regains focus) can re-tag the slots + close this GM tab. A foreground
    // add-link has no listener for it — harmless there (it uses focus-return).
    if (ART_CHANNEL) { try { ART_CHANNEL.postMessage({ type: 'tc-edit-committed', gid: m[1].toLowerCase() }); } catch (e) {} }
    setTimeout(() => { try { W.close(); } catch (e) {} }, 80);
    return true;
  }
  // #273: on the MB create/edit form opened in a BACKGROUND tab (hash flag), store
  // the right marker (so the saved entity page posts back / closes), wait for the
  // seeded change to RENDER — the "Enter edit" button shows before MB's React
  // external-links editor applies the seeded URL, so an early click would submit
  // an empty edit — then click it.
  function handleAutoCommit() {
    const onCreate = /\/(artist|label|place)\/create\b/i.test(location.pathname);
    const onEdit   = new RegExp('/(artist|label|place)/' + MBID_RE.source + '/edit\\b', 'i').test(location.pathname);
    if (!onCreate && !onEdit) return false;
    const hm = location.hash.match(/tc-autocommit(?:=([^&]+))?/); if (!hm) return false;
    if (onCreate) { let tok = ''; try { tok = decodeURIComponent(hm[1] || ''); } catch (e) { tok = hm[1] || ''; } try { sessionStorage.setItem(PENDING_KEY, tok); } catch (e) {} }
    else { try { sessionStorage.setItem(CLOSE_KEY, '1'); } catch (e) {} }
    const et = (location.pathname.match(/\/(artist|label|place)\//) || [])[1] || 'artist';
    const seedUrl = new URLSearchParams(location.search).get(`edit-${et}.url.0.text`) || '';
    const seedKey = seedUrl ? seedUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase() : '';
    let tries = 0;
    const submit = () => {
      const seedReady = !seedKey || document.body.innerHTML.toLowerCase().includes(seedKey);
      const btn = document.querySelector('button.submit.positive')
        || [...document.querySelectorAll('button[type="submit"]')].find(b => /enter edit/i.test(b.textContent || ''));
      if (seedReady && btn && !btn.disabled) { btn.click(); return; }
      if (tries++ < 100) setTimeout(submit, 200);   // ~20s grace (background tabs are slower)
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', submit); else submit();
    return true;
  }

  /* ════════════════════════ UI ════════════════════════ */
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md';
  const VERSION = '2026.6.23.133821';   // keep in sync with @version (fallback when GM_info is unavailable under @grant none)
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  // shared attribution header (same shape as the other scripts' edit notes)
  const apolloAttribution = () => { const s = (typeof GM_info !== 'undefined' && GM_info.script) || {}; return (s.name || 'Apollo Editor') + ' v' + scriptVersion() + ' by ' + (s.author || 'majkinetor') + ' - ' + (s.homepageURL || s.homepage || HELP_URL); };
  // edit note for an artist Apollo creates or links from a credit slot —
  // attribution + what was done + which release was being edited
  function entityActionNote(action) {
    const releaseUrl = location.href.split(/[?#]/)[0].replace(/\/edit(-relationships)?$/, '');
    return apolloAttribution() + '\n\n' + action + ' while editing ' + releaseUrl;
  }
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
  const badgeText = s => ({ rg: 'rg', disc: 'disc', high: 'name', user: 'user', set: 'set', low: 'low' })[s.status] || '';
  const colW = (k, d) => (SETTINGS.colWidths && SETTINGS.colWidths[k]) || d;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  // Enter in our inputs must not bubble to MB's form (it switches tabs); commit by blurring instead
  const enterBlurs = el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); el.blur(); } });
  function rowConfidence(t) { const live = t.slots.filter(s => s.status !== 'set'); if (!live.length) return 'set'; const order = ['none', 'low', 'user', 'high', 'disc', 'rg']; return live.map(s => s.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]; }
  const badge = s => `<span class="tc-badge ${s}">${s === 'rg' ? 'RG' : s === 'disc' ? 'DISC' : s.toUpperCase()}</span>`;

  const css = `
    .tc-badge{font-size:10px;font-weight:bold;border-radius:9px;padding:1px 7px;color:#fff;white-space:nowrap}
    .tc-badge.rg{background:#1f8a4c}.tc-badge.set{background:#6c757d}.tc-badge.high{background:#2f6fd6}.tc-badge.disc{background:#0a7a8c}
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
    .tc-mirror .t-wrap{display:flex;align-items:center;gap:3px;position:relative}.tc-mirror .t-wrap input.t-title{flex:1;min-width:0;width:auto}
    /* In-cell action buttons (Aa / ⋔) overlay the input's right edge instead of
       sitting in the flex flow, so they don't reserve width and shrink the input —
       otherwise "Fit" sizes the column to the text but the reserved button space
       clips long titles. #153 */
    .tc-mirror .t-actions{position:absolute;right:2px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:3px;pointer-events:none}
    .tc-mirror .t-actions>*{pointer-events:auto}
    .tc-mirror input.t-title.diff{background:#fff6da;border-color:#e7ce8a;border-radius:3px}
    .tc-mirror input.t-title.gcpreview{background:#e3f6e3;border-color:#86c686;border-radius:3px}
    /* #203: rich title display — read-only styled text (confusable chars enlarged) shown
       when the title isn't being edited; clicking/tabbing into it shows the native input.
       Mirrors the input's diff/gcpreview/hasfeat backgrounds so the cell looks unchanged. */
    .tc-mirror .t-title-disp{flex:1;min-width:0;box-sizing:border-box;border:1px solid transparent;border-radius:3px;background:transparent;font:13px Arial;padding:3px 2px;white-space:pre;overflow:hidden;cursor:text;display:flex;align-items:center}
    .tc-mirror .t-title-disp:hover{border-color:#bbb;background:#fff}
    .tc-mirror .t-title-disp.diff{background:#fff6da;border-color:#e7ce8a}
    .tc-mirror .t-title-disp.gcpreview{background:#e3f6e3;border-color:#86c686}
    .tc-mirror .t-title-disp.hasfeat{background:#eaf1fb;border-color:#9bbbe0}
    .tc-mirror .t-title-disp.tc-hidden{display:none}
    .tc-mirror.compact .t-title-disp{padding:0 2px;font-size:12px}
    .tc-mirror input.t-title.tc-eml:not(.tc-editing){position:absolute;width:1px;height:1px;min-width:0;padding:0;margin:0;border:0;opacity:0;pointer-events:none}
    /* MB medium-format select made to read as plain text — click still opens the native dropdown */
    select.tc-fmt-flat{-webkit-appearance:none;-moz-appearance:none;appearance:none;border:1px solid transparent;background:transparent;font:bold 15px Arial;color:#222;padding:2px 5px;cursor:pointer}
    select.tc-fmt-flat:hover{background:#efeaf9;border-color:#d7ccef;border-radius:3px}
    /* #154: theme the native medium header (legend · collapse · format · "Medium title" · move/remove)
       to match Apollo while the tracklist takeover is on. Scoped to body.tc-tl-on so the original look
       returns the instant you switch back to the native editor — AND every button rule is further scoped to
       fieldset.advanced-medium, because tc-tl-on lives on <body> (stays on while you visit other tabs) and
       remove-item / guesscase-title are generic classes that also exist on the Release-information tab
       (external-link ✕, title Aa). Without the medium scope they leaked their glyphs onto that tab (#160). */
    body.tc-tl-on fieldset.advanced-medium{border:1px solid #e7e0f5;border-radius:8px;background:#fbfaff;margin:0 0 12px;padding:3px 12px 6px}
    body.tc-tl-on fieldset.advanced-medium > legend{font:700 12px Arial;letter-spacing:.05em;text-transform:uppercase;color:#5f3ec0!important;padding:0 6px;margin-left:2px}
    body.tc-tl-on table.advanced-format{width:100%;border-collapse:collapse;margin:0}
    body.tc-tl-on table.advanced-format > tbody > tr > td{padding:3px 5px;vertical-align:middle;border:none}
    body.tc-tl-on table.advanced-format td.format{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    /* the flat ▸ / ▾ icon buttons (collapse, move, remove) — drop MB's sprite, draw a themed glyph */
    body.tc-tl-on fieldset.advanced-medium button.icon.expand-medium,body.tc-tl-on fieldset.advanced-medium button.icon.collapse-medium,
    body.tc-tl-on fieldset.advanced-medium button.icon.medium-up,body.tc-tl-on fieldset.advanced-medium button.icon.medium-down,
    body.tc-tl-on fieldset.advanced-medium button.icon.remove-item{background:none!important;border:none;width:30px;height:28px;padding:0;margin:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:5px;color:#7d6bc0;font-size:18px;line-height:1}
    /* the triangle glyphs render small for their font-size — pump the arrows up so they read clearly (#154) */
    body.tc-tl-on fieldset.advanced-medium button.icon.expand-medium::before,body.tc-tl-on fieldset.advanced-medium button.icon.collapse-medium::before,
    body.tc-tl-on fieldset.advanced-medium button.icon.medium-up::before,body.tc-tl-on fieldset.advanced-medium button.icon.medium-down::before{font-size:21px}
    body.tc-tl-on fieldset.advanced-medium button.icon.expand-medium:hover,body.tc-tl-on fieldset.advanced-medium button.icon.collapse-medium:hover,
    body.tc-tl-on fieldset.advanced-medium button.icon.medium-up:hover,body.tc-tl-on fieldset.advanced-medium button.icon.medium-down:hover{background:#efeaf9;color:#5f3ec0}
    body.tc-tl-on fieldset.advanced-medium button.icon.expand-medium::before{content:'▸'}
    body.tc-tl-on fieldset.advanced-medium button.icon.collapse-medium::before{content:'▾'}
    body.tc-tl-on fieldset.advanced-medium button.icon.medium-up::before{content:'▴'}
    body.tc-tl-on fieldset.advanced-medium button.icon.medium-down::before{content:'▾'}
    body.tc-tl-on fieldset.advanced-medium button.icon.remove-item{color:#cc6699;margin-left:14px!important}
    body.tc-tl-on fieldset.advanced-medium button.icon.remove-item::before{content:'✕';font-weight:bold}
    body.tc-tl-on fieldset.advanced-medium button.icon.remove-item:hover{background:#fbe9f1;color:#c0392b}
    /* "Medium title:" label + input + the Aa guess-case button */
    body.tc-tl-on table.advanced-format td.format > label[for^="medium-title"]{font:12px Arial;color:#8a7bb8;margin-left:6px}
    body.tc-tl-on input[id^="medium-title-"]{flex:1 1 220px;min-width:200px;border:1px solid #d6cdec;border-radius:4px;padding:3px 7px;font:13px Arial;background:#fff;box-shadow:none}
    body.tc-tl-on input[id^="medium-title-"]:focus{border-color:#8a72c8;outline:none}
    body.tc-tl-on fieldset.advanced-medium button.icon.guesscase-title{background:none!important;border:1px solid #d6cdec;border-radius:4px;width:auto;height:auto;min-width:0;padding:2px 7px;margin:0;cursor:pointer;color:#6f42c1;font:bold 11px Arial;line-height:1.4}
    body.tc-tl-on fieldset.advanced-medium button.icon.guesscase-title::before{content:'Aa'}
    body.tc-tl-on fieldset.advanced-medium button.icon.guesscase-title:hover{background:#efeaf9;border-color:#bcaae6;color:#5f3ec0}
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
    .tc-mirror.compact .tc-cred{padding:0 4px 0 15px}
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
    .tc-cred{flex:none;width:130px;text-align:right;box-sizing:border-box;font:11px Arial;color:#1c1c1c;border:1px solid transparent;background:transparent;padding:1px 4px 1px 15px}
    .tc-cred::placeholder{color:#cfcfcf}
    .tc-credwrap{position:relative;flex:none;display:inline-flex;align-items:center}
    .tc-cred-clr{position:absolute;left:2px;top:50%;transform:translateY(-50%);z-index:2;display:none;border:none;background:none;color:#bbb;cursor:pointer;font-size:12px;line-height:1;padding:0}
    .tc-aslot.tc-has-cred:hover .tc-cred-clr{display:block}
    .tc-cred-clr:hover{color:#c0392b}
    .tc-cred:hover,.tc-cred:focus{border-color:#cdbff0;background:#fff;color:#333}
    .tc-aslot.tc-can-split .tc-cred{background:#fff3cf;border-color:#e7ce8a;border-radius:3px;color:#8a6d00}
    .tc-aslot.tc-can-split .tc-cred::placeholder{color:#caa64e}
    .tc-tic{flex:none;width:18px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:#6f54c0;text-decoration:none}
    .tc-tic.link{cursor:pointer}.tc-tic.link:hover{color:#4f2bab}.tc-tic.dim{color:#c6bbe6}
    .tc-tic.discogs-add{color:#0a7a8c;cursor:pointer;background:#d6eff3;border-radius:4px}.tc-tic.discogs-add:hover{color:#075e6b;background:#bfe6ed}
    .tc-tic.discogs-warn{color:#b26a00;cursor:pointer;background:#fdecc8;border-radius:4px}.tc-tic.discogs-warn:hover{color:#915700;background:#fbe0a8}
    /* one fixed-width search box per artist (so all lines align); name fills it, ＋ + join sit at the right */
    .tc-search{flex:1 1 0;min-width:0;align-self:stretch;display:flex;align-items:center;gap:4px;border:none;border-radius:4px;background:#fff;padding:0 6px;overflow:hidden}   /* unmatched = plain white; the green fill marks a match */
    .tc-nm-clr{flex:none;display:none;border:none;background:none;color:#bbb;cursor:pointer;font-size:13px;line-height:1;padding:0 1px}
    .tc-search.tc-has-nm:hover .tc-nm-clr{display:inline-flex}
    .tc-nm-clr:hover{color:#c0392b}
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
    .tc-search .tc-bar-disamb{flex:0 1 auto;min-width:0;max-width:55%;margin-left:4px;color:#999;font-size:11px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}   /* artist disambiguation, grey like native #195 */
    .tc-search .mk{flex:none;order:9;cursor:pointer;border:none;background:none;color:#1f8a4c;font-weight:bold;font-size:15px;line-height:1;padding:0 2px}.tc-search .mk:hover{color:#136b39}   /* order:9 keeps ＋ pinned at the far right, past the join-phrase */
    .tc-joinwrap{flex:none;margin-left:auto;display:flex;align-items:center;gap:0}
    .tc-join{width:auto;text-align:right;border:1px solid transparent;background:transparent;color:#777;font:italic 900 12px Arial;padding:1px 2px;border-radius:3px}
    .tc-join:hover,.tc-join:focus{border-color:#bcdcc6;background:#fff;color:#444}
    .tc-joinarrow{cursor:pointer;border:none;background:none;color:#9a8fc0;font-size:10px;padding:0 1px;line-height:1}.tc-joinarrow:hover{color:#5f3ec0}
    /* #208 join-phrase spacing flags: ␣ where a space is missing, ␣?␣ when the phrase is missing entirely */
    .tc-joinwrap.tc-jp-bad .tc-join{border-color:var(--tc-hl,#e53935);background:#fff0f0;color:#b00}
    .tc-jp-nolead::before,.tc-jp-notrail::after,.tc-jp-nophrase::before{background:var(--tc-hl,#e53935);color:#fff;border-radius:2px;padding:0 1px;font:700 11px Arial;line-height:1}
    .tc-jp-nolead::before{content:'␣'}
    .tc-jp-notrail::after{content:'␣'}
    .tc-jp-nophrase::before{content:'␣?␣'}
    .tc-joinpop .tc-acrow{justify-content:space-between;gap:14px}.tc-joinpop .cmt{color:#999}
    .tc-acts{flex:none;width:76px;display:flex;align-items:center;justify-content:flex-start;gap:4px;padding-left:4px}
    .tc-enter,.tc-slotx,.tc-splitb,.tc-slotgrab{cursor:pointer;border:none;background:none;padding:0 1px;visibility:hidden;line-height:1}
    .tc-enter{color:#7d6bc0;font-size:19px}.tc-enter:hover{color:#5f3ec0}
    .tc-splitb{color:#7d6bc0;font-size:16px;font-weight:bold}.tc-splitb:hover{color:#5f3ec0}
    .tc-aslot:not(.tc-can-split) .tc-splitb{display:none}
    .tc-slotgrab{cursor:grab;color:#9a8fb5;font-size:13px;user-select:none}.tc-slotgrab:hover{color:#5f3ec0}.tc-slotgrab:active{cursor:grabbing}   /* #150: drag to reorder this artist within the credit */
    .tc-aslot.tc-slotdragging{opacity:.45}
    .tc-aslot.tc-slotdrop-before{box-shadow:inset 0 2px 0 #5f3ec0}.tc-aslot.tc-slotdrop-after{box-shadow:inset 0 -2px 0 #5f3ec0}
    .tc-slotx{color:#cc6699;font-size:13px}.tc-slotx:hover{color:#c0392b}
    .tc-mirror tr:hover .tc-enter,.tc-mirror tr:hover .tc-slotx,.tc-mirror tr:hover .tc-splitb,.tc-mirror tr:hover .tc-slotgrab{visibility:visible}
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
    #tc-bar{display:flex;align-items:center;gap:8px;padding:6px 4px;flex-wrap:nowrap;min-width:0}   /* #280: never wrap → toast / "added link" text can't push the toolbar taller */
    #tc-bar b{color:#563b8f}#tc-bar .sp{flex:1 1 0;min-width:0}
    #tc-bar > .tc-btn{flex:none;white-space:nowrap}   /* #280: Match / ▾ never shrink → never wrap to 2 lines when toast text appears */
    .tc-toast{flex:0 1 auto;min-width:0;color:#5f3ec0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}   /* #280: shrink (ellipsis) instead of forcing a wrap */
    .tc-globalstat{flex:none;font-size:12px;color:#999;font-style:italic;white-space:nowrap}
    .tc-am-lbl{flex:none;display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#555;white-space:nowrap}.tc-am-lbl select{font:12px Arial;padding:1px 3px}
    .tc-globalstat.tc-unres{font-style:normal;font-weight:bold;color:#fff;background:#d6342c;padding:1px 8px;border-radius:9px}
    /* #227: persistent "N missing Discogs links" badge (teal, like the DISC match badge) */
    .tc-disc-msg{flex:0 1 auto;min-width:0;font-size:12px;font-weight:600;color:#5f3ec0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:8px}
    .tc-discstat{flex:none;font-size:12px;color:#999;font-style:italic;white-space:nowrap}
    .tc-discstat.tc-disc-badge{font-style:normal;font-weight:bold;color:#fff;background:#0a7a8c;padding:1px 8px;border-radius:9px}
    .tc-discstat.tc-disc-ok{font-style:normal;font-weight:bold;color:#1a7a3c}
    .tc-discstat.tc-disc-pend{font-style:normal;font-weight:bold;color:#fff;background:#c98a00;padding:1px 8px;border-radius:9px}
    .tc-tablewrap{overflow-x:auto}
    .tc-addrow{padding:8px 4px;font-size:13px;color:#555;display:flex;align-items:center;gap:6px}
    .tc-addrow input.tc-addn{width:54px;font:13px Arial;padding:2px 4px;border:1px solid #bbb;border-radius:3px}
    .tc-addbtn{width:22px;height:22px;border-radius:50%;border:1px solid #d6cdec;background:transparent;color:#9a8fc0;font:bold 15px/1 Arial;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
    .tc-addbtn:hover{background:#f0ecfa;color:#6f42c1;border-color:#b9a4e0}
    .tc-mirror th .tc-hstatus{font-weight:normal;font-style:italic;color:#999;margin-left:12px;font-size:11px}
    .tc-mirror th .tc-hstatus.tc-unres{font-style:normal;font-weight:bold;color:#fff;background:#d6342c;padding:1px 7px;border-radius:9px;font-size:11px}
    .tc-mirror th .tc-hdr-am{float:right;font-weight:normal;font-style:normal;font-size:11px;color:#444;margin-right:14px;max-width:140px}
    .tc-tools{display:flex;align-items:center;gap:6px 8px;flex:1 1 auto;min-width:0;flex-wrap:wrap}   /* #280: label + tools wrap together; wrapped rows start at the left (under the label) */
    .tc-toolslabel{flex:none;font:800 11px Arial;letter-spacing:.03em;text-transform:uppercase;color:#6f42c1;cursor:pointer;white-space:nowrap;border-bottom:1px dotted #b9a4e0;line-height:1.5}
    .tc-toolslabel:hover{color:#4b2e83}
    .tc-toolbtns{display:contents}   /* #280: its buttons/groups are direct flex items of .tc-tools so they wrap to the left edge */
    .tc-toolbtn{display:inline-flex;align-items:center;gap:5px;border:1px solid #d8d0ec;background:linear-gradient(#fff,#f4f1fb);border-radius:5px;padding:4px 9px;font:13px Arial;color:#4a4a4a;cursor:pointer;white-space:nowrap;flex:none}
    .tc-toolbtn:hover{border-color:#bcaae6;background:#f3eefe}
    .tc-toolbtn.active{background:#5f3ec0;border-color:#4f33a3;color:#fff;font-weight:600}
    .tc-toolbtn .tc-tbic{font-size:13px;line-height:1}
    .tc-toolbtn.instant .tc-tbic{color:#2e9b57}
    .tc-toolbtn.active .tc-tbic{color:#fff}
    .tc-toolbtn.tc-more{font-weight:bold;color:#7a68b8;border-style:dashed}
    .tc-toolopts{display:flex;align-items:center;gap:6px;min-width:0}
    .tc-gco,.tc-sro,.tc-colso,.tc-medo{display:flex;align-items:center;gap:8px}
    .tc-colso{gap:4px}
    .tc-colbtn{font:12px Arial;padding:2px 9px;border:1px solid #bbb;border-radius:4px;background:#fff;cursor:pointer;color:#333}
    .tc-colbtn:hover{background:#f0ecfa;border-color:#a98fe0}
    /* #152: Search & Replace — RE toggle, Templates button, invalid-regex flag, templates popup */
    .tc-srbtn{cursor:pointer;border:1px solid #d6cdec;background:#fff;color:#6f42c1;font:bold 11px Arial;border-radius:4px;padding:3px 8px;white-space:nowrap}
    .tc-srbtn:hover{background:#efeaf9;border-color:#bcaae6}
    .tc-srbtn.on{background:#6f42c1;color:#fff;border-color:#5f3ec0}
    .tc-sr-find.tc-sr-bad{border-color:#d6342c!important;background:#fff1f0}
    .tc-srtpl{position:fixed;z-index:100003;background:#fff;border:1px solid #b9a4e0;border-radius:7px;box-shadow:0 8px 26px rgba(40,20,80,.28);font:12px Arial;color:#1c1c1c;min-width:460px;max-width:680px;max-height:70vh;overflow:auto}
    .tc-srtpl-hd{font:700 11px Arial;letter-spacing:.05em;text-transform:uppercase;color:#5f3ec0;padding:8px 12px;border-bottom:1px solid #ece7f6;position:sticky;top:0;background:#fff}
    .tc-srtpl-empty{padding:12px;color:#999;font-style:italic}
    .tc-srtpl-row{display:grid;grid-template-columns:1.1fr 1.5fr 1.5fr 26px 18px;align-items:center;gap:8px;padding:5px 12px;cursor:pointer;border-bottom:1px solid #f4f0fc}
    .tc-srtpl-row:hover{background:#f3f0fb}
    .tc-srtpl-cap{cursor:default;font:700 10px Arial;letter-spacing:.04em;text-transform:uppercase;color:#9a8fb5;background:#faf8ff}
    .tc-srtpl-cap:hover{background:#faf8ff}
    .tc-srtpl-nm{font-weight:600;color:#4b3a82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tc-srtpl-f,.tc-srtpl-r{font-family:'Courier New',monospace;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tc-srtpl-re{font:bold 10px Arial;color:#6f42c1;text-align:center}
    .tc-srtpl-x{visibility:hidden;border:none;background:none;color:#cc6699;cursor:pointer;font-size:12px;padding:0;line-height:1}
    .tc-srtpl-row:hover .tc-srtpl-x{visibility:visible}.tc-srtpl-x:hover{color:#c0392b}
    .tc-srtpl-new{padding:9px 12px;border-top:1px solid #ece7f6;background:#faf8ff;position:sticky;bottom:0}
    .tc-srtpl-newlbl{color:#777;margin-bottom:4px}
    .tc-srtpl-name{width:100%;box-sizing:border-box;border:1px solid #d6cdec;border-radius:4px;padding:4px 7px;font:13px Arial}
    .tc-srtpl-name:focus{border-color:#8a72c8;outline:none}
    .tc-toolopts label,.tc-opt label{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#555}
    .tc-toolopts input[type=text],.tc-opt input[type=text]{font:12px Arial;padding:2px 5px;border:1px solid #bbb;border-radius:3px;width:120px}
    .tc-toolopts input[type=text]::placeholder,.tc-opt input[type=text]::placeholder{color:#c2c2c2}
    .tc-toolopts select,.tc-opt select{font:12px Arial;padding:1px}
    /* #280 — pinned tools' params on the 2nd toolbar row (scrolls if they overflow) */
    .tc-bar2{display:flex;align-items:center;gap:10px;padding:2px 4px 7px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}
    .tc-opt{display:inline-flex;align-items:center;gap:7px;background:#faf8fe;border:1px solid #ece5f8;border-radius:7px;padding:3px 9px;flex:none}
    .tc-optname{font:700 12px Arial;color:#5f3ec0;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    .tc-opttrig{cursor:pointer;border-radius:5px;padding:2px 5px;border:1px solid transparent}
    .tc-opttrig:hover{background:#efe7fb;border-color:#dccff5}
    .tc-opt .tc-tbic{font-size:13px}
    /* #280 — right-click a tool name to collapse its params; they flyout on hover/focus */
    .tc-opt.tc-collapsed{position:relative}
    .tc-opt.tc-collapsed > .tc-optname{border-bottom:1px dotted #b6a3e6}
    /* flyout TOUCHES the name (top:100% over the group's padding-bottom) so the hover
       area is contiguous — no dead gap that would drop :hover before you reach it */
    .tc-opt.tc-collapsed > :not(.tc-optname){display:none;position:absolute;top:100%;left:-1px;z-index:100000;background:#fff;border:1px solid #b9a4e0;border-radius:0 7px 7px 7px;box-shadow:0 6px 22px rgba(40,20,80,.3);padding:7px 10px}
    .tc-opt.tc-collapsed:hover > :not(.tc-optname),.tc-opt.tc-collapsed:focus-within > :not(.tc-optname){display:flex}
    /* #280 — Customize tools popover */
    .tc-toolcfg{position:fixed;z-index:100002;background:#fff;border:1px solid #b9a4e0;border-radius:9px;box-shadow:0 10px 30px rgba(40,20,80,.32);padding:8px 0 4px;font:13px Arial;width:340px}
    .tc-tc-h{font-weight:800;color:#4b2e83;padding:3px 14px 8px}
    .tc-tc-list{max-height:62vh;overflow:auto}
    .tc-tc-row{display:flex;align-items:center;gap:8px;padding:5px 12px}
    .tc-tc-row:hover{background:#f6f2fd}
    .tc-tc-row.off{opacity:.6}
    .tc-tc-row.over-bottom{box-shadow:inset 0 -2px 0 #8a72c8}
    .tc-tc-row.over-top{box-shadow:inset 0 2px 0 #8a72c8}
    .tc-tc-row.drag{opacity:.4}
    .tc-tc-grab{color:#c3bbd8;cursor:grab;font-size:13px;flex:none}
    .tc-tc-ic{width:26px;text-align:center;color:#7a68b8;flex:none}
    .tc-tc-lab{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tc-tc-onbar{display:inline-flex;flex:none}.tc-tc-onbar input{accent-color:#6f42c1}
    .tc-tc-dens{display:inline-flex;flex:none;border:1px solid #d6cdec;border-radius:5px;overflow:hidden}
    .tc-tc-seg{flex:none;width:30px;box-sizing:border-box;border:none;border-left:1px solid #e6ddf3;background:#fff;color:#a99fc4;font:bold 12px Arial;height:22px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}   /* #280: fixed width → the [icon|T] groups line up across rows */
    .tc-tc-seg:first-child{border-left:none}
    .tc-tc-seg:hover{background:#f3eefe}
    .tc-tc-seg.on{background:#6f42c1;color:#fff}
    .tc-tc-seg.on:hover{background:#5f3ec0}
    .tc-tc-pin{flex:none;box-sizing:border-box;width:22px;text-align:center;border:none;background:none;cursor:pointer;font-size:13px;line-height:1;filter:grayscale(1);opacity:.35;padding:1px 0;display:inline-flex;align-items:center;justify-content:center}   /* fixed width so the column aligns even when a tool has no pin */
    .tc-tc-pin.on{filter:none;opacity:1}
    .tc-tc-pin.none{visibility:hidden}
    .tc-tc-hint{font-size:11px;color:#999;padding:8px 14px 2px;border-top:1px solid #f0ebfa;margin-top:5px}
    .tc-mi-ic{flex:0 0 auto;display:inline-flex;justify-content:center;min-width:18px;text-align:center;color:#7a68b8;margin-right:8px;white-space:nowrap}
    .tc-menu{position:fixed;z-index:100001;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 22px rgba(40,20,80,.3);padding:4px 0;font:13px Arial;min-width:170px}
    .tc-menu.tc-mini{width:max-content;max-width:260px}.tc-menu.tc-mini .tc-mi{white-space:nowrap}
    .tc-menu .tc-mi{display:flex;align-items:center;padding:6px 15px;cursor:pointer;color:#333;font-weight:bold}.tc-menu .tc-mi:hover{background:#ede9f6;color:#4b2e83}
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
    #tc-settings h4 .tc-help{margin-left:8px;flex:none;white-space:nowrap;font-size:12px;font-weight:normal;text-decoration:none;color:#5f3ec0;border:1px solid #c9b8ee;border-radius:4px;padding:1px 8px}
    #tc-settings h4 .tc-help:hover{background:#f0ecfa}
    #tc-settings h4 .tc-logbtn{margin-left:auto;flex:none;font:normal 12px Arial;color:#5f3ec0;background:none;border:1px solid transparent;border-radius:4px;padding:1px 8px;cursor:pointer}
    #tc-settings h4 .tc-logbtn:hover{background:#f3eefb;border-color:#c9b8ee}
    /* #283 activity-log popup */
    /* floating, movable, NON-modal window (no backdrop) */
    #tc-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:100002;display:flex;flex-direction:column;width:min(720px,94vw);max-height:72vh;background:#fff;border:1px solid #b9a4e0;border-radius:11px;box-shadow:0 12px 40px rgba(40,20,80,.4);font:13px Arial;color:#222;overflow:hidden}
    #tc-logpop .tc-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid #e3dcf2;color:#563b8f;cursor:move;user-select:none}
    #tc-logpop .tc-log-m a{color:#5f3ec0}
    #tc-logpop .tc-logpop-sp{margin-left:auto}
    #tc-logpop .tc-logpop-copy,#tc-logpop .tc-logpop-x,#tc-logpop .tc-logpop-min{font:12px Arial;color:#5f3ec0;background:#f3eefb;border:1px solid #c9b8ee;border-radius:5px;padding:2px 9px;cursor:pointer}
    #tc-logpop .tc-logpop-copy:hover,#tc-logpop .tc-logpop-x:hover,#tc-logpop .tc-logpop-min:hover{background:#e9e0f8}
    #tc-logpop.min .tc-log-list,#tc-logpop.min .tc-logpop-copy,#tc-logpop.min .tc-logpop-x{display:none}
    #tc-logpop.min{max-height:none;width:auto}
    #tc-logpop.min .tc-logpop-sp{display:none}
    #tc-logpop .tc-log-badge{color:#9a8cba;font-size:11px}
    #tc-logpop .tc-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;background:#faf8fe;padding:8px 11px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55}
    #tc-logpop .tc-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}
    #tc-logpop .tc-log-t{color:#a99fc2;flex:0 0 auto}
    #tc-logpop .tc-log-m{flex:1 1 auto;color:#444}
    #tc-logpop .tc-log-ok .tc-log-m{color:#2e7d4f}
    #tc-logpop .tc-log-warn .tc-log-m{color:#b06a00}
    #tc-logpop .tc-log-error .tc-log-m{color:#c0344d}
    #tc-logpop .tc-log-debug{opacity:.72}
    #tc-logpop .tc-log-debug .tc-log-m{color:#7a7a7a}
    #tc-logpop .tc-log-empty{color:#9a8cba}
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
    #tc-settings #tc-s-lentol,#tc-settings #tc-s-titletol,#tc-settings #tc-s-punctsize{width:48px;font:13px Arial;padding:2px 5px;border:1px solid #bbb;border-radius:3px}
    #tc-settings #tc-s-hlcolor{width:34px;height:22px;padding:0;border:1px solid #bbb;border-radius:3px;cursor:pointer;background:none}
    #tc-settings .tc-s-row.lentol{gap:7px}
    #tc-launch{position:fixed;bottom:14px;right:14px;z-index:99998;display:inline-flex;align-items:stretch;background:#5f3ec0;color:#fff;border-radius:20px;font:bold 13px Arial;box-shadow:0 3px 12px rgba(40,20,80,.3);overflow:hidden}
    #tc-launch .tc-launch-lbl{padding:8px 13px;cursor:pointer}
    #tc-launch .tc-launch-lbl:hover{background:rgba(255,255,255,.13)}
    #tc-launch .tc-launch-gear{padding:8px 11px;cursor:pointer;font-size:14px;display:flex;align-items:center;border-left:1px solid rgba(255,255,255,.28)}
    #tc-launch .tc-launch-gear:hover{background:rgba(255,255,255,.13)}
    #tc-btn,#tc-gear-btn{vertical-align:middle}

    /* ──────────────────────────────────────────────────────────────────
       MOBILE / NARROW VIEWPORTS — Tracklist
       MusicBrainz serves width=device-width, so the fixed-layout mirror
       (Title 360px + #/len/badge ≈ 540px of fixed columns) overflows the
       viewport and collapses the flexible Artist column to a few pixels —
       the artist search box becomes unusable. Below ~700px each track
       becomes a full-width card: #/title/length/match on the top line and
       the artist credit(s) spanning the FULL width beneath. Hover-only
       controls are revealed (touch screens have no hover).
       820px covers phones and small tablets (the artist column only gets
       comfortable above ~1000px desktop width).
       ────────────────────────────────────────────────────────────────── */
    @media (max-width: 820px) {
      /* tools bar: wrap so "⚡ Match" never gets pushed off the edge */
      #tc-bar{flex-wrap:wrap;gap:6px 8px}
      #tc-bar > .sp{flex-basis:100%;height:0}   /* the spacer forces the Match cluster onto its own line */
      .tc-am-lbl{white-space:normal}

      .tc-tablewrap{overflow-x:visible}
      .tc-mirror{display:block}
      .tc-mirror > colgroup,.tc-mirror > thead{display:none}
      .tc-mirror > tbody{display:block}
      .tc-mirror > tbody > tr{display:grid;grid-template-columns:20px 34px 1fr 46px 30px;
        align-items:center;column-gap:6px;row-gap:3px;padding:7px 8px;background:transparent}
      .tc-mirror.gridrows > tbody > tr{border-bottom:1px solid #e0e0e0}
      .tc-mirror > tbody > tr > td{display:block;padding:0;border:none!important;background:transparent;overflow:visible}
      .tc-mirror td.c-mv{grid-column:1;grid-row:1}
      .tc-mirror td.c-num{grid-column:2;grid-row:1}
      .tc-mirror td.c-title{grid-column:3;grid-row:1}
      .tc-mirror td.c-len{grid-column:4;grid-row:1}
      .tc-mirror td.c-badge{grid-column:5;grid-row:1}
      .tc-mirror td.c-art{grid-column:1 / -1;grid-row:2;width:auto}
      .tc-mirror input.t-len{width:100%;text-align:right}
      /* the medium header keeps its own full-width line */
      .tc-mirror > tbody > tr:has(.tc-medhdr){display:block;padding:0}
      .tc-mirror td.tc-medhdr{display:block}
      /* zebra + changed-marker move to the row (cells are transparent now) */
      .tc-mirror.alt > tbody > tr:nth-child(even){background:#f6f4fb}
      .tc-mirror > tbody > tr.tc-changed{box-shadow:inset 3px 0 0 #5f3ec0}
      .tc-mirror > tbody > tr.tc-changed td:first-child{box-shadow:none}
      /* trim the fixed credited-as + actions so the search box gets the width */
      .tc-cred{width:84px}
      .tc-acts{width:auto;gap:3px;padding-left:3px}
      /* touch = no hover: reveal the per-row / per-artist controls permanently */
      .tc-mirror tr .t-gc,.tc-mirror tr .t-feat,
      .tc-enter,.tc-splitb,.tc-slotgrab,.tc-slotx{visibility:visible}
      .tc-aslot:not(.tc-can-split) .tc-splitb{display:none}
    }
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
    s.innerHTML = `<h4>${ICON} Apollo Editor <span class="tc-ver" title="installed script version">v${scriptVersion()}</span><button class="tc-logbtn" type="button" title="Open the activity log">Log</button><a class="tc-help" href="${HELP_URL}" target="_blank" rel="noopener" title="open the README in a new tab">? Help</a></h4>
      <div class="tc-s-group tc-s-top">
        <label title="Tidy the Release information tab: remove the help bubble, clean up the external links and use the right column. The Original/Apollo button still toggles it anytime."><input type="checkbox" id="tc-s-replri"> <span>Modify Release information</span></label>
        <label title="Replace the native Tracklist editor with the Apollo table on page load. The Original/Apollo button still toggles it anytime."><input type="checkbox" id="tc-s-repltl"> <span>Modify Tracklist</span></label>
        <label title="Replace the native Recordings editor with the Apollo table on page load. The Original/Apollo button still toggles it anytime."><input type="checkbox" id="tc-s-replrec"> <span>Modify Recordings</span></label>
        <label title="On the Add-release Duplicates tab, add a Similarity column scoring how closely each existing release matches the one you are entering (by track-title overlap), coloured red→green — so you can pick the right release to base yours on."><input type="checkbox" id="tc-s-moddupes"> <span>Modify Duplicates</span></label>
        <label title="Edit the annotation as Markdown with a live preview, in the release editor's Additional information and on the standalone Edit annotation page."><input type="checkbox" id="tc-s-modanno"> <span>Modify annotations with Markdown</span></label>
        <label title="Hide the native step-tab row and footer; show a compact step switcher, wizard buttons by the title, and Add medium at the table's right."><input type="checkbox" id="tc-s-compactnav"> <span>Modify header and footer</span></label>
        <label title="Zen editing: hide everything above the Apollo nav bar (the site header, release title and entity tabs) and the page footer — leaving just the editor. The release title / artist (with version count) move into the nav bar. Needs the compact nav."><input type="checkbox" id="tc-s-zen"> <span>Zen editing</span></label>
        <label title="When another site seeds the Add/Edit-release form, MusicBrainz shows a confirmation page before the editor — automatically click its submit button to skip that step (integrates chaban's auto-confirm script). Add ?skip_confirmation to a seed URL to bypass it once."><input type="checkbox" id="tc-s-autoconfirm"> <span>Auto confirm release submissions</span></label>
      </div>
      <div class="tc-s-sec">Matching</div>
      <div class="tc-s-group">
        <div class="tc-s-row"><b class="tc-s-sub">Auto-match on start</b><label class="tc-s-rad" title="Tracklist tab: match track artists to MusicBrainz on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatch"> Tracklist</label><label class="tc-s-rad" title="Recordings tab: auto-match unset recordings on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatchrec"> Recordings</label></div>
        <label title="When the release has a Discogs link, match each track artist by its Discogs URL (a strong, human-verified signal) before the name search. A single linked MusicBrainz artist is used directly; several are offered as candidates."><input type="checkbox" id="tc-s-discogsmatch"> <span>Discogs artist link matching</span></label>
        <div class="tc-s-sub">Recording</div>
        <div class="tc-s-group">
          <div class="tc-s-row lentol" title="A length difference up to this many seconds counts as a match (not a length mismatch)."><span>Length tolerance</span><input type="number" id="tc-s-lentol" min="0" max="60" step="1"> <span>seconds</span></div>
          <div class="tc-s-row lentol" title="Allow up to this many differing characters in the title (edit distance) and still count it as a match. 0 = exact."><span>Title tolerance</span><input type="number" id="tc-s-titletol" min="0" max="20" step="1"> <span>characters</span></div>
          <label title="Treat a case / accent / spacing-only difference in title or artist as a match (recommended)."><input type="checkbox" id="tc-s-ignorecase"> <span>Ignore casing</span></label>
          <label title="Ignore punctuation &amp; symbols in titles/artists (&amp; → and, brackets, quotes, dashes, dots…)."><input type="checkbox" id="tc-s-ignorepunct"> <span>Ignore punctuation</span></label>
          <div class="tc-s-row" style="gap:8px"><label title="Highlight the exact differing characters in a mismatching title (instead of the whole field), and shade a length mismatch by how large the gap is."><input type="checkbox" id="tc-s-detailhl"> <span>Enable detailed highlighting</span></label><input type="color" id="tc-s-hlcolor" title="Highlight colour — the differing characters and the length-mismatch shading"></div>
        </div>
      </div>
      <div class="tc-s-sec">Appearance</div>
      <div class="tc-s-group">
        <div class="tc-s-row"><span>Row layout</span><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="compact"> compact</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="normal"> normal</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="cozy"> cozy</label></div>
        <label><input type="checkbox" id="tc-s-alt"> <span>Alternate row colors</span></label>
        <div class="tc-s-row"><span>Show grid</span><label class="tc-s-rad" title="vertical column separators"><input type="checkbox" id="tc-s-gridcols"> columns</label><label class="tc-s-rad" title="horizontal lines between tracks"><input type="checkbox" id="tc-s-gridrows"> rows</label></div>
        <div class="tc-s-row" title="In the detailed-highlight diff, enlarge a differing punctuation / confusable / invisible character (straight vs curly quote, hyphen vs dash, no-break space…) by this many pixels so look-alikes are obvious. 0 = no enlargement (hover tooltip still names the character)."><span>Enlarge punctuation by</span><input type="number" id="tc-s-punctsize" min="0" max="12" step="1"> <span>px (0 = off)</span></div>
        <label title="Moving between tracklist cells with ↑ / ↓ / Enter keeps the text caret at the same column (clamped to the field's length) so you can fix casing or edit in place. Off: select the whole field on arrival (so the next keystroke overwrites it)."><input type="checkbox" id="tc-s-keepcaret"> <span>Keep caret position on row navigation</span></label>
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
    const dmatch = s.querySelector('#tc-s-discogsmatch'); if (dmatch) { dmatch.checked = SETTINGS.discogsUrlMatch !== false; dmatch.onchange = () => { SETTINGS.discogsUrlMatch = dmatch.checked; saveSettings(); }; }
    const lentol = s.querySelector('#tc-s-lentol'), titletol = s.querySelector('#tc-s-titletol'), igc = s.querySelector('#tc-s-ignorecase'), igp = s.querySelector('#tc-s-ignorepunct');
    lentol.value = SETTINGS.recLenTol != null ? SETTINGS.recLenTol : 5; titletol.value = SETTINGS.recTitleTol || 0; igc.checked = SETTINGS.recIgnoreCase !== false; igp.checked = !!SETTINGS.recIgnorePunct;
    const refreshRec = () => { try { if (document.getElementById('tc-recwrap')) rerenderRec(); } catch (e) {} };   // live-update the table
    lentol.onchange = () => { const v = Math.max(0, Math.min(60, parseInt(lentol.value, 10) || 0)); SETTINGS.recLenTol = v; lentol.value = v; saveSettings(); refreshRec(); };
    titletol.onchange = () => { const v = Math.max(0, Math.min(20, parseInt(titletol.value, 10) || 0)); SETTINGS.recTitleTol = v; titletol.value = v; saveSettings(); refreshRec(); };
    igc.onchange = () => { SETTINGS.recIgnoreCase = igc.checked; saveSettings(); refreshRec(); };
    igp.onchange = () => { SETTINGS.recIgnorePunct = igp.checked; saveSettings(); refreshRec(); };
    const detailhl = s.querySelector('#tc-s-detailhl'); if (detailhl) { detailhl.checked = !!SETTINGS.recDetailedHl; detailhl.onchange = () => { SETTINGS.recDetailedHl = detailhl.checked; saveSettings(); refreshRec(); }; }
    const hlcol = s.querySelector('#tc-s-hlcolor'); if (hlcol) { hlcol.value = SETTINGS.recHlColor || '#e53935'; hlcol.oninput = () => { SETTINGS.recHlColor = hlcol.value; applyHlColor(); }; hlcol.onchange = () => { SETTINGS.recHlColor = hlcol.value; applyHlColor(); saveSettings(); refreshRec(); }; }
    const punctsz = s.querySelector('#tc-s-punctsize'); if (punctsz) { punctsz.value = SETTINGS.recPunctSize != null ? SETTINGS.recPunctSize : 3; punctsz.onchange = () => { const v = Math.max(0, Math.min(12, parseInt(punctsz.value, 10) || 0)); SETTINGS.recPunctSize = v; punctsz.value = v; saveSettings(); refreshRec(); }; }
    alt.onchange = () => { SETTINGS.altRows = alt.checked; saveSettings(); applyViewClasses(); };
    gridcols.onchange = () => { SETTINGS.gridCols = gridcols.checked; saveSettings(); applyViewClasses(); };
    gridrows.onchange = () => { SETTINGS.gridRows = gridrows.checked; saveSettings(); applyViewClasses(); };
    const replri = s.querySelector('#tc-s-replri'), repltl = s.querySelector('#tc-s-repltl'), replrec = s.querySelector('#tc-s-replrec'), modanno = s.querySelector('#tc-s-modanno'), cnav = s.querySelector('#tc-s-compactnav'), zen = s.querySelector('#tc-s-zen'), moddupes = s.querySelector('#tc-s-moddupes');
    replri.checked = SETTINGS.replaceReleaseInfo !== false; repltl.checked = SETTINGS.replaceTracklist !== false; replrec.checked = SETTINGS.replaceRecordings !== false; modanno.checked = SETTINGS.modifyAnnotation !== false; cnav.checked = SETTINGS.compactNav !== false; zen.checked = !!SETTINGS.zenMode;
    if (moddupes) { moddupes.checked = !!SETTINGS.modifyDuplicates; moddupes.onchange = () => { SETTINGS.modifyDuplicates = moddupes.checked; saveSettings(); applyDuplicates(); }; }
    replri.onchange = () => { SETTINGS.replaceReleaseInfo = replri.checked; saveSettings(); applyView(); };
    repltl.onchange = () => { SETTINGS.replaceTracklist = repltl.checked; saveSettings(); applyView(); };
    replrec.onchange = () => { SETTINGS.replaceRecordings = replrec.checked; saveSettings(); applyView(); };
    modanno.onchange = () => { SETTINGS.modifyAnnotation = modanno.checked; saveSettings(); applyView(); applyAnnotationPage(); };
    cnav.onchange = () => { SETTINGS.compactNav = cnav.checked; saveSettings(); applyNav(); applyZen(); };
    zen.onchange = () => { SETTINGS.zenMode = zen.checked; saveSettings(); applyZen(); };
    const aconf = s.querySelector('#tc-s-autoconfirm'); if (aconf) { aconf.checked = SETTINGS.autoConfirmSeed !== false; aconf.onchange = () => { SETTINGS.autoConfirmSeed = aconf.checked; saveSettings(); }; }
    const kcaret = s.querySelector('#tc-s-keepcaret'); if (kcaret) { kcaret.checked = SETTINGS.keepCaretColumn !== false; kcaret.onchange = () => { SETTINGS.keepCaretColumn = kcaret.checked; saveSettings(); }; }   // #279
    const off = e => { if (!s.contains(e.target) && e.target !== anchor) { s.remove(); document.removeEventListener('mousedown', off); } };
    const lbtn = s.querySelector('.tc-logbtn'); if (lbtn) lbtn.onclick = () => { s.remove(); document.removeEventListener('mousedown', off); openLog(); };
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
  // #227: persistent missing-Discogs-links badge. Stays until every link is
  // added; each click steps to the NEXT track missing one and focuses its credit.
  let _discNavIdx = -1;
  // an artist whose Discogs link needs attention: missing (addable) OR mismatched
  // (links a different Discogs page than the release credits). #227
  const discNeedsAttention = s => !!s._discogsAddable;   // mismatch is now addable too (offer the release's link, flagged ⚠)
  // The tooltip text for an addable slot's link/⚠ icon — shared so the log shows
  // the exact same message (a mismatch/conflict reads differently from a plain add).
  function discAddTooltip(s) {
    const mism = s._discogsMismatch, conf = s._discogsConflict;
    return mism ? `Discogs mismatch: this artist links ${mism}, the release credits ${s._discogsUrl} — click to add the release's link anyway`
         : conf ? `Discogs links a different MB artist: ${conf.name} — click to add it to ${s.name || 'this artist'} anyway`
                : (s.gid ? 'Add the Discogs link to this artist' : 'Create this artist with its Discogs link');
  }
  function focusNextMissingDiscogs() {
    const list = [];
    MODEL.tracks.forEach(t => t.slots.forEach((s, i) => { if (discNeedsAttention(s)) list.push([t, i]); }));
    if (!list.length) { _discNavIdx = -1; return; }
    _discNavIdx = (_discNavIdx + 1) % list.length;
    const [t, i] = list[_discNavIdx];
    const row = rowEl(t.mi, t.ti); if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const creds = row.querySelectorAll('.tc-cred'); (creds[i] || row).focus();
  }
  const missingDiscogsCount = () => { let n = 0; if (MODEL) MODEL.tracks.forEach(t => t.slots.forEach(s => { if (discNeedsAttention(s)) n++; })); return n; };
  const setDiscStat = () => {
    // #281: Discogs API unreachable → an amber, clickable "retry" badge instead of a
    // blank that reads as "nothing to do". (It also auto-retries once on its own.)
    if (_discMapFailed) {
      document.querySelectorAll('.tc-discstat').forEach(e => {
        e.classList.remove('tc-disc-badge', 'tc-disc-ok');
        e.classList.add('tc-disc-pend');
        e.textContent = '🔗 Discogs ⟳';
        e.style.cursor = 'pointer';
        e.title = 'Couldn’t reach Discogs (rate-limited) — click to retry';
        e.onclick = () => tagDiscogsForAll();
      });
      return;
    }
    let miss = 0, mism = 0, pend = 0, checked = false;
    if (MODEL) MODEL.tracks.forEach(t => t.slots.forEach(s => {
      if (s._discogsChecked) checked = true;   // #281: a RESOLVED slot was actually checked (unresolved slots don't count)
      if (s._discogsMismatch) mism++;
      else if (s._discogsAddable) miss++;
      else if (s._discogsPending) pend++;
    }));
    const n = miss + mism;
    document.querySelectorAll('.tc-discstat').forEach(e => {
      e.classList.remove('tc-disc-badge', 'tc-disc-ok', 'tc-disc-pend');
      e.onclick = null; e.style.cursor = ''; e.title = '';
      if (n) {
        // links to add / mismatches → teal action badge, click steps to the next
        e.textContent = `🔗 ${n} link${n === 1 ? '' : 's'}` + (pend ? ` · ${pend}?` : '');
        e.classList.add('tc-disc-badge');
        e.onclick = focusNextMissingDiscogs; e.style.cursor = 'pointer';
        e.title = `${miss} missing, ${mism} mismatched Discogs link${n === 1 ? '' : 's'}` + (pend ? `, ${pend} unchecked` : '') + ' — click to step to the next';
      } else if (pend) {
        // every job ran but some lookups couldn't complete (rate-limited / cold) →
        // say so honestly and let a click retry, rather than reading as "all OK"
        e.textContent = `🔗 ${pend} unchecked`;
        e.classList.add('tc-disc-pend');
        e.onclick = () => tagDiscogsForAll(); e.style.cursor = 'pointer';
        e.title = `${pend} Discogs link${pend === 1 ? '' : 's'} couldn't be checked (rate-limited) — click to retry`;
      } else if (checked) {
        // the check ran and every Discogs artist credit is already linked in MB —
        // a positive confirmation so a blank badge no longer means "did it run?"
        e.textContent = '✓ Discogs links OK';
        e.classList.add('tc-disc-ok');
        e.title = 'every Discogs artist credit on this release is already linked in MusicBrainz';
      } else {
        e.textContent = '';   // no Discogs link on the release / not checked yet
      }
    });
  };
  // transient progress text in the same slot, while the check runs (not a pill)
  const setDiscProgress = (t) => document.querySelectorAll('.tc-discstat').forEach(e => { e.textContent = t || ''; e.classList.remove('tc-disc-badge', 'tc-disc-ok', 'tc-disc-pend'); e.onclick = null; e.style.cursor = ''; e.title = ''; });
  // transient action feedback (a pick propagated, S&R count, …) — lives in the toolbar so it never
  // overwrites a medium's unresolved badge; auto-clears
  let _toastTimer = null;
  const toast = msg => { document.querySelectorAll('.tc-toast').forEach(e => { e.textContent = msg || ''; }); clearTimeout(_toastTimer); if (msg) _toastTimer = setTimeout(() => toast(''), 5000); };
  // #281: "added Discogs link to X" feedback sits right next to the "N links" badge
  // (not in the centre toast), so it reads together with the count it just changed.
  let _discMsgTimer = null;
  const discMsg = msg => { document.querySelectorAll('.tc-disc-msg').forEach(e => { e.textContent = msg || ''; }); clearTimeout(_discMsgTimer); if (msg) _discMsgTimer = setTimeout(() => discMsg(''), 5000); };
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
    // #279: carry the caret COLUMN across the move instead of selecting the whole
    // field (jesus2099's keyboard-select behaviour) — so you keep typing / fix
    // casing at the same spot rather than overwriting. Clamped to the destination's
    // length, so a shorter field just drops the caret at its end.
    const caret = (inp.selectionStart != null) ? inp.selectionStart : (inp.value || '').length;
    inp.blur();   // committing the current field on blur can rebuild the rows — focus AFTER, from the fresh DOM
    const go = () => {
      let t = null;
      if (destTk) { const d = document.querySelector(`${scope} tr[data-tk="${destTk}"]`); if (d) { const xs = [...d.querySelectorAll(sel)]; t = xs[Math.min(destIdx, xs.length - 1)]; } }
      if (!t) t = [...document.querySelectorAll(`${scope} ${sel}`)][destPos];
      if (t && document.activeElement !== t) {
        t.focus();
        // #279: keep the caret column by default; the toggle restores select-all-on-arrive.
        if (SETTINGS.keepCaretColumn !== false) {
          if (typeof t.setSelectionRange === 'function') { const p = Math.min(caret, (t.value || '').length); try { t.setSelectionRange(p, p); } catch (e) {} }
        } else if (t.select && !t.classList.contains('nm')) { t.select(); }
      }
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
    if (!_tagDiscogsRunning) setDiscStat();   // #227: keep the missing-links badge in sync (the check owns it while running)
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
    const entry = slot._entry, beforeKey = creditKey(entry);   // whole-credit snapshot BEFORE the pick (and credited-as auto-fill)
    slot.entity = c; slot.gid = c.gid; slot.name = c.name; slot.status = 'user'; slot.committed = true; slot.query = null; slot._flash = true;
    if (!(slot.creditedAs || '').trim()) slot.creditedAs = c.name;   // auto-fill the credited-as when the user hasn't set one
    commitTrack(entry);
    // whole-credit match, like MB's native "all matching tracks": copy this track's resulting
    // credit (the picked artist included) to every other track that shared its credit string.
    const copies = propagateCredit(entry, beforeKey);
    if (copies) { slot._marked = true; Log.info('propagated', c.name, '→', copies, 'matching track(s)'); }
    rerender();
    if (copies) toast(`linked “${c.name}” — also on ${copies} matching track${copies > 1 ? 's' : ''}`);
    // #227: the new artist may lack the slot's Discogs link — recompute the add affordance
    if (slot._discogsUrl) tagDiscogsAddable(slot, slot._discogsUrl).then(() => rerender());
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
    else { const sib = (await loadSiblingMap()).get(fold(entry.title)); const durls = (await loadDiscogsMap())?.get(fold(entry.title)); const m = await matchSlot(on.creditedAs, sib && sib[i], durls && durls[i]); Object.assign(slot, { status: slotStatusOf(m), entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, committed: false }); await tagDiscogsAddable(slot, durls && durls[i]); }
    commitTrack(entry); Log.info('reverted slot', i, 'of track', entry.number); rerender();
  }

  const blankSlot = entry => ({ creditedAs: '', joinPhrase: '', status: 'none', entity: null, gid: null, name: '', candidates: [], committed: false, _entry: entry });
  function focusSlotInput(entry, idx) { const row = rowEl(entry.mi, entry.ti); if (row) { const ins = row.querySelectorAll('.tc-search input.nm'); if (ins[idx]) ins[idx].focus(); } }
  /* ── "all matching tracks" propagation (mirrors MB's native changeMatchingTrackArtists) ──
     The match key is the WHOLE artist-credit string — each slot's as-credited text (its
     credited-as, or the artist name when there's no override) + its join phrase, in order.
     Linked-artist identity is ignored, exactly like MB's reduceArtistCredit. An empty credit
     never propagates. Peers are re-derived per action; since every artist action propagates,
     a matched group stays in lockstep through a multi-step edit (add slot → type → pick). */
  const creditKey = entry => entry.slots.map(s => (s.creditedAs || s.name || '') + (s.joinPhrase || '')).join('');
  function cloneSlots(src, destEntry) {
    return src.slots.map(s => ({
      creditedAs: s.creditedAs, joinPhrase: s.joinPhrase,
      // committed+linked slots become 'user' so commitTrack writes our entity (not the peer's stale live one)
      status: (s.committed && s.entity && s.status === 'set') ? 'user' : s.status,
      entity: s.entity, gid: s.gid, name: s.name,
      candidates: (s.candidates || []).slice(), committed: s.committed, query: s.query || null,
      _entry: destEntry, _flash: true, _marked: true,
    }));
  }
  // Apply `entry`'s resulting credit to every OTHER track whose credit string still equals
  // `beforeKey` (its string before this edit). Returns how many peer tracks were changed.
  function propagateCredit(entry, beforeKey) {
    if ((SETTINGS.applyMode || 'all') !== 'all' || !beforeKey || !beforeKey.trim()) return 0;
    MODEL.tracks.forEach(t => t.slots.forEach(s => { delete s._marked; }));   // clear the previous action's outline
    let n = 0;
    MODEL.tracks.forEach(t => { if (t === entry || creditKey(t) !== beforeKey) return; t.slots = cloneSlots(entry, t); commitTrack(t); n++; });
    if (n) entry.slots.forEach(s => { s._marked = true; });
    return n;
  }
  // Run a credit mutation on `entry`, commit it, then propagate to matching tracks. `liveRerender`
  // false (text edits) skips the table rebuild when nothing propagated, so the field keeps focus.
  function editCredit(entry, mutate, verb, liveRerender = true) {
    const beforeKey = creditKey(entry);
    mutate();
    commitTrack(entry);
    const n = propagateCredit(entry, beforeKey);
    if (liveRerender || n) rerender();
    Log.info(verb, 'on track', entry.number, n ? ('· +' + n + ' matching') : '');
    if (n) toast(`${verb} — also on ${n} matching track${n > 1 ? 's' : ''}`);
    return n;
  }

  // split a credit: append an artist slot (the ＋ create-row / API uses this)
  function addSlot(entry) {
    editCredit(entry, () => {
      const last = entry.slots[entry.slots.length - 1];
      if (last && !(last.joinPhrase || '').trim()) last.joinPhrase = ' & ';
      entry.slots.push(blankSlot(entry));
    }, 'added artist slot');
    focusSlotInput(entry, entry.slots.length - 1);
  }
  // ↵ : insert an artist slot right after this one
  function addSlotAfter(entry, idx) {
    editCredit(entry, () => {
      if (!(entry.slots[idx].joinPhrase || '').trim()) entry.slots[idx].joinPhrase = ' & ';
      const s = blankSlot(entry); s.joinPhrase = idx + 1 < entry.slots.length ? ' & ' : '';
      entry.slots.splice(idx + 1, 0, s);
    }, 'inserted artist slot');
    focusSlotInput(entry, idx + 1);
  }
  // merge: remove an artist slot (clearing the trailing join on the new last slot)
  function removeSlot(entry, idx) {
    if (entry.slots.length <= 1) return;
    editCredit(entry, () => {
      entry.slots.splice(idx, 1);
      const last = entry.slots[entry.slots.length - 1]; if (last) last.joinPhrase = '';
    }, 'removed artist slot');
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
    const beforeKey = creditKey(entry);   // snapshot before the split, for "all matching tracks"
    const fresh = parts.map((p, i) => { const s = blankSlot(entry); s.creditedAs = p.name; s.joinPhrase = i < parts.length - 1 ? normJoin(p.sep) : ''; s._pending = true; return s; });
    entry.slots.splice(idx, 1, ...fresh); entry.slots.forEach(s => { s._entry = entry; });
    commitTrack(entry); rerender();
    Log.info('split', JSON.stringify(slot.creditedAs || slot.name), '→', parts.map(p => p.name).join(' · '));
    if (SETTINGS.autoMatch !== false) await matchModel();
    else fresh.forEach(s => { delete s._pending; });
    // remove the credited-as override on the matched parts (the artist name is the credit)
    entry.slots.forEach(s => { if (s.committed && s.gid) s.creditedAs = ''; });
    commitTrack(entry);
    const n = propagateCredit(entry, beforeKey);   // apply the finished split to every track that shared the old credit
    rerender();
    if (n) { Log.info('split — also on', n, 'matching track(s)'); toast(`split — also on ${n} matching track${n > 1 ? 's' : ''}`); }
  }

  // ＋ create-button at the right end of the box (before the join), only when the slot is unmatched;
  // and the alias on the resolved bar — only while the slot stays committed (gone the moment you edit)
  function adorn(search, slot, inp) {
    [...search.querySelectorAll('.mk, .tc-bar-aka, .tc-bar-disamb')].forEach(e => e.remove());
    search.classList.toggle('matched', !!slot.committed);
    const ref = search.querySelector('.tc-joinwrap');
    const aks = _gidAliases.get(slot.gid);
    const aka = slot.committed ? aliasStr({ gid: slot.gid, name: slot.name, aliases: aks || (slot.entity && slot.entity.aliases) || [], primaryAlias: slot.entity && slot.entity.primaryAlias }) : null;
    // when matched, size the name field to its content so the alias sits right after it on the LEFT
    // (instead of being pushed to the far right by a full-width field); reset when unmatched. #128
    if (slot.committed) { inp.style.flex = '0 1 auto'; inp.size = Math.max(3, String(slot.name || inp.value || '').length + 1); }
    else { inp.style.flex = ''; inp.removeAttribute('size'); }
    // content-sizing the matched field leaves a short name with almost no click target, so clicking
    // anywhere in the rest of the bar (the empty space / alias) focuses it to open the search. #128
    search.onmousedown = e => { if (e.target === inp || e.target.closest('.tc-joinwrap, .mk')) return; e.preventDefault(); inp.focus(); };
    if (aka) { const al = document.createElement('span'); al.className = 'tc-bar-aka'; al.textContent = aka; al.title = aka; search.insertBefore(al, ref); }
    // artist disambiguation, like native MB's credit editor — grey, after the alias.
    // Sourced from the cache (filled by the same gid alias fetch); shows even for
    // special-purpose artists like [unknown], whose alias is suppressed. #195
    const dis = slot.committed ? getDisamb(slot.gid) : '';
    if (dis) { const ds = document.createElement('span'); ds.className = 'tc-bar-disamb'; ds.textContent = '(' + dis + ')'; ds.title = dis; search.insertBefore(ds, ref); }
    if (!slot.committed) { const mk = document.createElement('button'); mk.className = 'mk'; mk.textContent = '＋'; mk.title = 'create this artist on MusicBrainz  ·  right-click: create silently in a background tab'; mk.onmousedown = e => { if (e.button === 2) return; e.preventDefault(); createArtist(inp.value.trim() || slot.creditedAs, slot, slot._discogsUrl || null); }; mk.oncontextmenu = e => { e.preventDefault(); createArtist(inp.value.trim() || slot.creditedAs, slot, slot._discogsUrl || null, true); }; search.insertBefore(mk, ref); }
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
    // #208: flag a join phrase missing a space on either side (␣) or missing
    // entirely (␣?␣). Every rendered join control sits BETWEEN two artists
    // (the last slot has none), so an empty value here is a genuine gap.
    // Same px>0 master switch as the #203 marking.
    const markJoin = () => {
      wrap.classList.remove('tc-jp-nolead', 'tc-jp-notrail', 'tc-jp-nophrase', 'tc-jp-bad');
      if ((SETTINGS.recPunctSize | 0) <= 0) return;
      const v = inp.value;
      if (v === '') { wrap.classList.add('tc-jp-nophrase', 'tc-jp-bad'); return; }
      // CJK scripts (Japanese と / 、, Chinese, Korean) don't space their joins —
      // skip the space flags when the join or an adjacent name is CJK (#208, chaban)
      const idx = entry.slots.indexOf(slot);
      const nxt = entry.slots[idx + 1];
      const cjk = isCjk(v) || isCjk(slot.creditedAs || slot.name) || (nxt && isCjk(nxt.creditedAs || nxt.name));
      let bad = false;
      // leading space wanted unless the join is a tight ","/";" separator (#208, chaban)
      if (!cjk && !/^\s/.test(v) && !/^\s*[,;]/.test(v)) { wrap.classList.add('tc-jp-nolead'); bad = true; }
      if (!cjk && !/\s$/.test(v)) { wrap.classList.add('tc-jp-notrail'); bad = true; }
      if (bad) wrap.classList.add('tc-jp-bad');
    };
    inp.oninput = () => { fit(); markJoin(); }; inp.onchange = () => { editCredit(entry, () => { slot.joinPhrase = inp.value; }, 'join phrase', false); markJoin(); if (refreshBadges) refreshBadges(); }; enterBlurs(inp);
    const arrow = document.createElement('button'); arrow.className = 'tc-joinarrow'; arrow.textContent = '▾'; arrow.title = 'common join phrases';
    let pop = null; const close = () => { if (pop) { pop.remove(); pop = null; } };
    arrow.onclick = () => {
      if (pop) { close(); return; }
      pop = document.createElement('div'); pop.className = 'tc-acpop tc-joinpop';
      pop.innerHTML = JOIN_OPTIONS.map(o => `<div class="tc-acrow" data-v="${esc(o.value)}"><span class="nm">${esc(o.label)}</span><span class="cmt">"${esc(o.value)}"</span></div>`).join('');
      document.body.appendChild(pop); const r = inp.getBoundingClientRect(); pop.style.left = Math.max(4, r.right - 150) + 'px'; pop.style.top = (r.bottom + 4) + 'px'; pop.style.minWidth = '150px';
      [...pop.querySelectorAll('[data-v]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); inp.value = row.dataset.v; fit(); markJoin(); editCredit(entry, () => { slot.joinPhrase = inp.value; }, 'join phrase', false); if (refreshBadges) refreshBadges(); close(); }; });
      const off = e => { if (pop && !pop.contains(e.target) && e.target !== arrow) { close(); document.removeEventListener('mousedown', off); } }; setTimeout(() => document.addEventListener('mousedown', off), 0);
    };
    wrap.appendChild(inp); wrap.appendChild(arrow); markJoin();
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
    // #228: a hover × on the left of the field clears the credited-as override
    const credClr = document.createElement('button'); credClr.type = 'button'; credClr.className = 'tc-cred-clr'; credClr.textContent = '×'; credClr.title = 'clear the credited-as override';
    const updCredClr = () => line.classList.toggle('tc-has-cred', !!cred.value.trim());
    credClr.onmousedown = e => e.preventDefault();
    credClr.onclick = () => { if (!cred.value) return; cred.value = ''; cred.onchange(); updCredClr(); };
    cred.oninput = () => { line.classList.toggle('tc-can-split', splitArtistText(cred.value || s.name || '').length > 1); updCredClr(); };   // re-evaluate the highlight / ⋔ + clear button as you type
    cred.onchange = () => {
      const v = cred.value.trim(); const newCred = v || (s.name || '');
      // whole-credit "all matching tracks" propagation (liveRerender=false → keep focus when nothing propagates)
      editCredit(entry, () => { s.creditedAs = newCred; if (s.creditedAs === s.name) cred.value = ''; }, 'credited-as', false);
      refreshBadges();   // a credited-as edit changes the track → update the ↺ button + changed-row border now
    }; wireRowNav(cred);
    // wrap so the × can be absolutely positioned over the field's (empty, right-
    // aligned) left edge — it must not take flow space or it shifts the row (#228)
    const credWrap = document.createElement('span'); credWrap.className = 'tc-credwrap';
    credWrap.appendChild(cred); credWrap.appendChild(credClr); line.appendChild(credWrap); updCredClr();
    let ic;
    if (s._discogsAddable) {
      // #227: a Discogs link can be added — swap the artist-type icon for a link icon.
      // Amber warning glyph (still clickable to add) when the URL belongs to a
      // different MB artist (conflict) or the artist already links a different
      // Discogs page (mismatch); plain teal link icon otherwise.
      const conf = s._discogsConflict, mism = s._discogsMismatch;
      ic = document.createElement('a'); ic.className = 'tc-tic ' + ((conf || mism) ? 'discogs-warn' : 'discogs-add'); ic.href = '#'; ic.innerHTML = (conf || mism) ? DISCOGS_WARN_SVG : DISCOGS_LINK_SVG;
      ic.title = discAddTooltip(s);
      ic.title += '  ·  right-click: do it silently in a background tab';
      ic.onmousedown = e => e.preventDefault();
      ic.onclick = e => { e.preventDefault(); addOrCreateDiscogsLink(s); };
      ic.oncontextmenu = e => { e.preventDefault(); addOrCreateDiscogsLink(s, true); };   // #273 background
    } else if (s._discogsConflict) {
      // unresolved slot whose Discogs URL already belongs to an MB artist — info only (pick that artist)
      ic = document.createElement('a'); ic.className = 'tc-tic discogs-warn'; ic.innerHTML = DISCOGS_WARN_SVG;
      ic.href = `${ORIGIN}/artist/${s._discogsConflict.gid}`; ic.target = '_blank'; ic.rel = 'noopener';
      ic.title = `Discogs links this URL to ${s._discogsConflict.name} — pick that artist`;
    } else {
      ic = document.createElement(s.gid ? 'a' : 'span'); ic.className = 'tc-tic ' + (s.gid ? 'link' : 'dim'); ic.innerHTML = typeSvg(s.entity);
      if (s.gid) { ic.href = `${ORIGIN}/artist/${s.gid}`; ic.target = '_blank'; ic.rel = 'noopener'; ic.title = 'open artist page'; } else ic.title = 'no artist linked yet';
    }
    line.appendChild(ic);
    const search = document.createElement('span'); search.className = 'tc-search';
    const inp = document.createElement('input'); inp.className = 'nm'; inp.value = s.committed ? (s.name || s.creditedAs) : (s.query || s.creditedAs || ''); inp.placeholder = 'search artist…'; inp.title = inp.value;
    search.appendChild(inp);
    // #228: hover × right after the name clears the field (and unsets a matched
    // artist — the input handler un-links on an empty value)
    const nmClr = document.createElement('button'); nmClr.type = 'button'; nmClr.className = 'tc-nm-clr'; nmClr.textContent = '×'; nmClr.title = 'clear / unset the artist';
    const updNmClr = () => search.classList.toggle('tc-has-nm', !!inp.value.trim());
    nmClr.onmousedown = e => e.preventDefault();
    nmClr.onclick = () => { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); updNmClr(); };
    inp.addEventListener('input', updNmClr);
    search.appendChild(nmClr); updNmClr();
    if (idx < entry.slots.length - 1) search.appendChild(joinControl(entry, s, refreshBadges));   // join lives inside the box, right side
    adorn(search, s, inp); if (s._marked) search.classList.add('tc-marked'); if (s._flash) { search.classList.add('tc-flash'); delete s._flash; } line.appendChild(search);
    wireAutocomplete(inp, s, () => { adorn(search, s, inp); refreshBadges(); refreshStatus(); });
    // fixed-width actions area (keeps all search boxes the same width); both reveal on row hover
    const acts = document.createElement('span'); acts.className = 'tc-acts';
    const add = document.createElement('button'); add.className = 'tc-enter'; add.textContent = '↵'; add.title = 'add another artist to this credit'; add.onclick = () => addSlotAfter(entry, idx); acts.appendChild(add);
    // ⋔ split: only when this credit looks like several artists (& / feat. / , …)
    { const sp = document.createElement('button'); sp.className = 'tc-splitb'; sp.textContent = '⋔'; sp.title = 'split into separate artists (& / feat. …) and match'; sp.onclick = () => splitSlot(entry, idx); acts.appendChild(sp); }
    if (entry.slots.length > 1) {
      const g = document.createElement('span'); g.className = 'tc-slotgrab'; g.textContent = '⠿'; g.draggable = true; g.title = 'drag to reorder this artist within the credit'; acts.appendChild(g);   // #150
      const x = document.createElement('button'); x.className = 'tc-slotx'; x.textContent = '✕'; x.title = 'remove this artist'; x.onclick = () => removeSlot(entry, idx); acts.appendChild(x);
    }
    line.appendChild(acts);
    if (entry.slots.length > 1) wireSlotDrag(line, entry, idx);   // #150
    return line;
  }
  // #150: reorder an artist within a track's credit by dragging its ⠿ handle onto another slot.
  // Join phrases ("feat." / "&" / …) are positional separators that stay put as artists move through
  // them — so "A feat. B" reordered reads "B feat. A", and the final position is always join-less.
  function moveSlot(entry, from, to) {
    const n0 = entry.slots.length;
    if (from === to || from < 0 || to < 0 || from >= n0 || to >= n0) return;
    editCredit(entry, () => {
      const joins = entry.slots.map(s => s.joinPhrase);
      const [s] = entry.slots.splice(from, 1); entry.slots.splice(to, 0, s);
      entry.slots.forEach((x, i) => { x.joinPhrase = i < n0 - 1 ? (joins[i] || ' & ') : ''; x._entry = entry; });
    }, 'reordered artist');
  }
  let _slotDrag = null;   // { entry, from } of the artist slot being dragged
  function wireSlotDrag(line, entry, idx) {
    const handle = line.querySelector('.tc-slotgrab');
    if (handle) {
      handle.addEventListener('dragstart', e => { _slotDrag = { entry, from: idx }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'slot'); } catch (x) {} try { e.dataTransfer.setDragImage(line, 18, 12); } catch (x) {} line.classList.add('tc-slotdragging'); });
      handle.addEventListener('dragend', () => { line.classList.remove('tc-slotdragging'); clearSlotDropMarks(line.parentElement); _slotDrag = null; });
    }
    const after = e => (e.clientY - line.getBoundingClientRect().top) > line.getBoundingClientRect().height / 2;
    line.addEventListener('dragover', e => { if (!_slotDrag || _slotDrag.entry !== entry) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; clearSlotDropMarks(line.parentElement); line.classList.add(after(e) ? 'tc-slotdrop-after' : 'tc-slotdrop-before'); });
    line.addEventListener('dragleave', () => line.classList.remove('tc-slotdrop-before', 'tc-slotdrop-after'));
    line.addEventListener('drop', e => {
      if (!_slotDrag || _slotDrag.entry !== entry) return;
      e.preventDefault(); const from = _slotDrag.from, gap = idx + (after(e) ? 1 : 0), dest = gap > from ? gap - 1 : gap;
      clearSlotDropMarks(line.parentElement); _slotDrag = null; moveSlot(entry, from, dest);
    });
  }
  const clearSlotDropMarks = host => host && host.querySelectorAll('.tc-slotdrop-before,.tc-slotdrop-after').forEach(l => l.classList.remove('tc-slotdrop-before', 'tc-slotdrop-after'));
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
      // #203: rich title display — show the title as styled read-only text (confusable /
      // invisible chars enlarged + named on hover) when not editing, and drop into the
      // native input on click/tab. Only when enlargement is on (recPunctSize > 0).
      let disp = null, paintDisp = null;
      if ((SETTINGS.recPunctSize | 0) > 0) {
        disp = document.createElement('span'); disp.className = 't-title-disp';
        paintDisp = (val) => {
          disp.innerHTML = dhRun(val != null ? val : tin.value);
          ['diff', 'gcpreview', 'hasfeat', 'srflash'].forEach(c => disp.classList.toggle(c, tin.classList.contains(c)));
        };
        tin.classList.add('tc-eml');
        tin.parentElement.insertBefore(disp, tin);   // sits in the input's flex slot while resting
        disp.addEventListener('mousedown', e => { e.preventDefault(); tin.focus(); });
        tin.addEventListener('focus', () => { tin.classList.add('tc-editing'); disp.classList.add('tc-hidden'); });
        tin.addEventListener('blur', () => { tin.classList.remove('tc-editing'); paintDisp(tin.value); disp.classList.remove('tc-hidden'); });
        paintDisp(t.title);
      }
      if (diff) {
        tin.classList.add('diff'); tin.title = 'Guess case → ' + t.guessTitle;
        const gb = document.createElement('button'); gb.className = 't-gc'; gb.textContent = 'Aa'; gb.title = 'Guess case → ' + t.guessTitle + '\n(right-click: guess case all tracks)';
        const wrap = tr.querySelector('.t-wrap');
        // like MB's integrated guess case: hovering the title cell previews the guessed name
        // (highlighted), leaving restores it, clicking Aa applies it. Never preview while editing.
        const preview = () => { if (document.activeElement !== tin) { tin.value = t.guessTitle; tin.classList.add('gcpreview'); if (paintDisp) paintDisp(t.guessTitle); } };
        const restore = () => { tin.value = t.title; tin.classList.remove('gcpreview'); if (paintDisp) paintDisp(t.title); };
        wrap.onmouseenter = preview; wrap.onmouseleave = () => { if (document.activeElement !== tin) restore(); };
        tin.addEventListener('focus', restore);   // clicking in to edit shows the real title, not the preview
        gb.onclick = () => { restore(); applyGuessTitle(t); t.title = u(koTrack(t.mi, t.ti).name); t.guessTitle = guessTitleStr(t); rerender(); };
        // right-click the [Aa] runs guess case on every track (same as the Tools-menu action) — #123
        gb.oncontextmenu = e => { e.preventDefault(); restore(); guessCaseAll(); };
        tActions(wrap).appendChild(gb);
      }
      // featured-artist split: flag titles carrying "feat./ft./featuring" and offer the split inline,
      // mirroring [Aa] — click ⋔ splits this track, right-click splits all (#124)
      if (FEAT_RE.test(t.title)) {
        tin.classList.add('hasfeat'); if (!tin.title) tin.title = 'Title has a featured artist';
        const fb = document.createElement('button'); fb.className = 't-feat'; fb.textContent = '⋔';
        fb.title = 'Split featured artist out of the title into the artist credit\n(right-click: split all tracks)';
        fb.onclick = () => guessFeatTrack(t);
        fb.oncontextmenu = e => { e.preventDefault(); guessFeatAll(); };
        tActions(tr.querySelector('.t-wrap')).appendChild(fb);
      }
      tin.onchange = e => { setTitle(t, e.target.value); t.title = e.target.value; t.guessTitle = guessTitleStr(t); rerender(); }; wireRowNav(tin);
      if (paintDisp) paintDisp(t.title);   // re-sync after the diff / feat blocks set their state classes
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
    if (SETTINGS.autoMatch !== false) await matchModel(onProgress); else { updateStatus('auto-match off — click Match'); tagDiscogsForAll(); }   // #227: tag 'set' artists even when not matching
    enrichResolvedAliases();   // batch-fetch aliases for resolved artists (existing releases too)
  }
  async function rebuild(noMatch) {
    MODEL = buildShell();
    if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); }
    rerender();
    if (!noMatch && SETTINGS.autoMatch !== false) await matchModel();
    else if (!noMatch) tagDiscogsForAll();   // #227: tag 'set' artists when auto-match is off — but NOT on a clear/revert (it would check zero matched artists); refreshStatus clears the badge instead
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
      b.onclick = () => { if (a === 'menu') openToolsMenu(b); else if (a === 'tool') runActiveTool(); else if (a === 'toolsmenu') openToolsMenu(b); else if (a === 'toolscfg') openToolsConfig(b); else if (a === 'gear') openSettings(b); else if (a === 'revertmenu') openMiniMenu(b, [{ label: '↺ Revert all', title: 'revert every track to its page-load state', onClick: revertAll }, { label: '✕ Clear all', title: 'unselect every track artist, keeping the credited-as text (titles and lengths kept)', onClick: clearAllTracks }]); else if (a === 'close') { host.remove(); ACTIVE = {}; } else runAction(a); };
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

  /* ── Configurable Tools bar (#280) ───────────────────────────────────────────
     A row of tool buttons you choose (the rest live behind ⋯). The ACTIVE tool's
     params render inline, right after the buttons; tools you "pin" keep their
     params on a 2nd row. Click the "Tools" label to customise (visibility, order,
     per-tool icon/text, pinning). ── */
  const MENU = [
    { act: 'parser',    label: 'Track parser',       icon: '☰' },           // ☰
    { act: 'swap',      label: 'Swap',               icon: '⇅' },           // ⇅
    { act: 'resetnum',  label: 'Reset #',            icon: '#' },
    { act: 'guessfeat', label: 'Guess feat.',        icon: 'ft', instant: true },
    { act: 'guesscase', label: 'Guess case',         icon: 'Aa', params: true },
    { act: 'sr',        label: 'Search and Replace', icon: 'S&R', params: true },
    { act: 'cols',      label: 'Resize columns',     icon: '↔', params: true }, // ↔
  ];
  const TOOL = Object.fromEntries(MENU.map(m => [m.act, m]));
  const LABELS = Object.fromEntries(MENU.map(m => [m.act, m.label]));
  const MEDIUM_TOOLS = new Set(['parser', 'resetnum', 'swap']);   // act on ONE medium (inline medium combo when >1)
  const OPTLESS = new Set(['guessfeat']);   // global, no options — fires on pick (non-sticky)
  const hasParams = act => !!(TOOL[act] && TOOL[act].params);
  // default Tools bar (in display order) for a fresh install — every other tool starts
  // in the Tools ▾ menu. Each entry sets the tool's icon/text and whether its params
  // start collapsed (right-click a name toggles that later).
  const TOOL_DEFAULTS = [
    { act: 'guesscase', icon: true,  text: false, hideParams: true  },   // Aa, collapsed
    { act: 'cols',      icon: false, text: true,  hideParams: true  },   // Resize columns, collapsed
    { act: 'sr',        icon: true,  text: false, hideParams: false },   // S&R, params shown
  ];
  const TOOL_DEF = Object.fromEntries(TOOL_DEFAULTS.map(d => [d.act, d]));
  let _toolMedium = 0;   // the medium chosen in the inline combo — shared across all medium-scoped tools
  const toolMedium = () => Math.min(Math.max(0, _toolMedium), mediums().length - 1);

  // per-tool config: { act, onBar, pinned, icon, text } in display order. Saved
  // tools merge over defaults; any tool not yet saved (a future one) is appended
  // and defaults to the ⋯ menu.
  function getToolCfg() {
    const saved = Array.isArray(SETTINGS.toolCfg) ? SETTINGS.toolCfg.filter(t => t && TOOL[t.act]) : [];
    const order = saved.map(t => t.act);
    // fresh install: the default on-bar tools lead (in their order), then the rest
    TOOL_DEFAULTS.forEach(d => { if (!order.includes(d.act)) order.push(d.act); });
    MENU.forEach(m => { if (!order.includes(m.act)) order.push(m.act); });
    const byAct = Object.fromEntries(saved.map(t => [t.act, t]));
    return order.map(act => {
      const s = byAct[act] || {}, d = TOOL_DEF[act];
      let icon = s.icon != null ? !!s.icon : (d ? d.icon : true);
      let text = s.text != null ? !!s.text : (d ? d.text : true);
      if (!icon && !text) text = true;   // at least one of icon/text
      const onBar = s.onBar != null ? !!s.onBar : !!d;
      const hideParams = s.hideParams != null ? !!s.hideParams : (d ? !!d.hideParams : false);
      return { act, onBar, icon, text, hideParams };
    });
  }
  function saveToolCfg(cfg) { SETTINGS.toolCfg = cfg.map(t => ({ act: t.act, onBar: !!t.onBar, icon: t.icon !== false, text: t.text !== false, hideParams: !!t.hideParams })); saveSettings(); }
  const cfgOf = act => getToolCfg().find(t => t.act === act) || { act, onBar: false, icon: true, text: true };
  // tools surfaced on the bar for THIS session only (picked from the Tools menu) —
  // never persisted; they fall back to the menu next session (#280).
  const TEMP_BAR = new Set();

  // hovering the "Guess case" tool button previews the guessed form on every differing title
  function previewAllGuess(on) {
    if (!MODEL) return;
    MODEL.tracks.forEach(t => {
      if (!(t.guessTitle && t.guessTitle !== t.title)) return;
      const row = rowEl(t.mi, t.ti); if (!row) return;
      const tin = row.querySelector('.t-title'); if (!tin || document.activeElement === tin) return;
      const val = on ? t.guessTitle : t.title;
      tin.value = val; tin.classList.toggle('gcpreview', on);
      // #203: when the rich title display is on, the visible text is a .t-title-disp
      // span over the (hidden) input — repaint it too, or the preview is invisible
      const disp = row.querySelector('.t-title-disp');
      if (disp) { disp.innerHTML = dhRun(val); disp.classList.toggle('gcpreview', on); }
    });
  }
  function wireToolHover() {
    document.querySelectorAll('.tc-toolbtn[data-act="guesscase"]').forEach(b => { b.onmouseenter = () => previewAllGuess(true); b.onmouseleave = () => previewAllGuess(false); });
  }

  // #280: render every on-bar tool inline at its position — a plain button when it
  // has no params, or a group (icon/name trigger + its params) when it does. The
  // toolbar grows and WRAPS (flex) when it runs out of room (CSS), never shoving Match.
  function renderToolbar() {
    const host = document.querySelector('.tc-toolbtns'); if (!host) return;
    host.innerHTML = '';
    getToolCfg().filter(t => t.onBar || TEMP_BAR.has(t.act)).forEach(t => host.appendChild(hasInlineParams(t.act) ? makeToolGroup(t) : makeToolButton(t)));
  }
  function makeToolButton(t) {
    const m = TOOL[t.act];
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'tc-toolbtn' + (m.instant ? ' instant' : '');
    b.dataset.act = t.act;
    b.innerHTML = (t.icon ? `<span class="tc-tbic">${esc(m.icon)}</span>` : '') + (t.text ? `<span class="tc-tblab">${esc(m.label)}</span>` : '');
    if (!t.text) b.title = m.label;
    b.onclick = () => pickTool(t.act);
    return b;
  }
  function pickTool(act) {
    if (OPTLESS.has(act)) return runAction(act);                 // instant (Guess feat.)
    // #280: a param tool picked from the Tools menu has nowhere to show its controls
    // unless it's on the bar — so surface it there for THIS session (not persisted;
    // it returns to the menu next session). Customize is where you make it permanent.
    if (hasInlineParams(act)) {
      if (!cfgOf(act).onBar) { TEMP_BAR.add(act); renderToolbar(); }
      return triggerTool(act);
    }
    if (MEDIUM_TOOLS.has(act)) return runMediumTool(act, toolMedium());
    runAction(act);
  }
  function runActiveTool() { const act = SETTINGS.lastTool; if (!act) return; if (MEDIUM_TOOLS.has(act)) return runMediumTool(act, toolMedium()); runAction(act); }
  // #280: a pinned tool's panel icon runs its primary action (what the row-1 button did)
  function triggerTool(act) {
    if (act === 'sr') { const f = document.querySelector('.tc-sr-find'), r = document.querySelector('.tc-sr-rep'); if (f) f.value = ''; if (r) r.value = ''; srActivate(); MODEL && MODEL.tracks.forEach(t => { delete t._srFlash; }); rerender(); if (f) f.focus(); return; }
    if (MEDIUM_TOOLS.has(act)) return runMediumTool(act, toolMedium());
    runAction(act);   // guesscase → guess-case all · cols → Fit
  }
  // the "Tools" label menu: the tools NOT on the bar, then Customize…
  function openToolsMenu(anchor) {
    let m = document.getElementById('tc-menu'); if (m) { m.remove(); return; }
    const off = getToolCfg().filter(t => !t.onBar && !TEMP_BAR.has(t.act));
    m = document.createElement('div'); m.id = 'tc-menu'; m.className = 'tc-menu';
    m.innerHTML = off.map(t => `<div class="tc-mi" data-act="${t.act}"><span class="tc-mi-ic">${esc(TOOL[t.act].icon)}</span>${esc(TOOL[t.act].label)}</div>`).join('')
      + (off.length ? '<div class="tc-sep"></div>' : '')
      + '<div class="tc-mi tc-mi-cfg" data-act="__cfg"><span class="tc-mi-ic">⚙</span>Customize…</div>';
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    const below = r.bottom + 4, above = r.top - 4 - mh;
    let top = (below + mh > window.innerHeight - 8 && above >= 8) ? above : below;
    top = Math.max(8, Math.min(top, window.innerHeight - mh - 8));
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + 'px';
    m.style.top = top + 'px';
    m.querySelectorAll('.tc-mi').forEach(el => el.onclick = () => { m.remove(); if (el.dataset.act === '__cfg') openToolsConfig(anchor); else pickTool(el.dataset.act); });
    const off2 = e => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off2); } }; setTimeout(() => document.addEventListener('mousedown', off2), 0);
  }
  // build a tool's parameter controls into `host` (used both inline on row 1 and on row 2)
  function buildToolParams(act, host) {
    if (act === 'guesscase') {
      const g = gcNative(); const box = document.createElement('span'); box.className = 'tc-gco';
      if (g && g.lang) { const sel = g.lang.cloneNode(true); sel.className = 'tc-gc-lang'; sel.value = g.lang.value; sel.title = 'Guess Case language'; sel.onchange = () => { setNative(g.lang, sel.value); recomputeGuesses(); }; box.appendChild(sel); }
      const mkChk = (text, el) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = el ? el.checked : false; c.disabled = !el; c.onchange = () => { setNative(el, c.checked); recomputeGuesses(); }; l.append(c, document.createTextNode(' ' + text)); return l; };
      if (g) { box.appendChild(mkChk('Keep uppercased', g.keepUC)); box.appendChild(mkChk('Keep Roman', g.roman)); }
      host.appendChild(box);   // #280: no Apply button — clicking the "Aa Guess case" icon/name applies it
    } else if (act === 'sr') {
      srActivate(); const box = document.createElement('span'); box.className = 'tc-sro';
      const find = document.createElement('input'); find.type = 'text'; find.className = 'tc-sr-find'; find.placeholder = srRegexOn() ? 'search (regex)' : 'search';
      const rep = document.createElement('input'); rep.type = 'text'; rep.className = 'tc-sr-rep'; rep.placeholder = 'replace';
      const run = () => srLive(find.value, rep.value, true);
      find.oninput = rep.oninput = run;
      const re = document.createElement('button'); re.type = 'button'; re.className = 'tc-srbtn tc-sr-re' + (srRegexOn() ? ' on' : ''); re.textContent = 'RE';
      re.title = 'Use regular expressions (search is a regex; $1, $<name> work in replace)';
      re.onclick = () => { SETTINGS.srRegex = !srRegexOn(); saveSettings(); re.classList.toggle('on', srRegexOn()); find.placeholder = srRegexOn() ? 'search (regex)' : 'search'; run(); };
      const tpl = document.createElement('button'); tpl.type = 'button'; tpl.className = 'tc-srbtn tc-sr-tpl'; tpl.textContent = 'Templates ▾'; tpl.title = 'Save / load search-and-replace templates';
      tpl.onclick = () => openSrTemplates(tpl, find, rep, re);
      box.append(find, rep, re, tpl); host.appendChild(box);
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
      const box = document.createElement('span'); box.className = 'tc-medo';
      const sel = document.createElement('select'); sel.className = 'tc-medsel'; sel.title = 'which medium';
      mediums().forEach((m, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = 'Medium ' + (i + 1); sel.appendChild(o); });
      sel.value = String(toolMedium()); sel.onchange = () => { _toolMedium = parseInt(sel.value, 10) || 0; };
      // #280: no Run button — pick the medium here, then click the tool's icon/name to run it
      // (matches Guess case / S&R / Resize, which all apply on the icon click).
      box.append(sel); host.appendChild(box);
    }
  }
  const hasInlineParams = act => hasParams(act) || (MEDIUM_TOOLS.has(act) && mediums().length > 1);
  // an inline param tool: a clickable icon/name trigger (obeys icon/text cfg) + its params
  function makeToolGroup(t) {
    const act = t.act;
    const grp = document.createElement('span'); grp.className = 'tc-opt'; grp.dataset.tool = act;
    const name = document.createElement('span'); name.className = 'tc-optname tc-opttrig';
    name.innerHTML = (t.icon ? `<span class="tc-tbic">${esc(TOOL[act].icon)}</span>` : '') + (t.text ? `<span class="tc-tblab">${esc(TOOL[act].label)}</span>` : '');
    name.onclick = () => triggerTool(act);
    // collapsed: drop the title so the native tooltip can't pop up over the flyout
    const setTitle = () => { name.title = grp.classList.contains('tc-collapsed') ? '' : TOOL[act].label + ' — click to run, right-click to collapse parameters'; };
    // #280: right-click the name collapses/expands its params (state remembered);
    // collapsed params fly out on hover/focus. Toggle in place so typed S&R text survives.
    name.oncontextmenu = (e) => {
      e.preventDefault();
      const now = !grp.classList.contains('tc-collapsed');
      grp.classList.toggle('tc-collapsed', now);
      setTitle();
      const cfg = getToolCfg(); const c = cfg.find(x => x.act === act); if (c) { c.hideParams = now; saveToolCfg(cfg); }
    };
    // preview on the whole group (not just the name) so it persists while the cursor
    // moves onto the params/flyout — mouseenter/leave ignore parent↔descendant moves
    if (act === 'guesscase') { grp.onmouseenter = () => previewAllGuess(true); grp.onmouseleave = () => previewAllGuess(false); }
    if (t.hideParams) grp.classList.add('tc-collapsed');
    setTitle();
    grp.appendChild(name);
    buildToolParams(act, grp);
    return grp;
  }
  function initTools() { renderToolbar(); }

  // ── "Customize tools" popover (opens from the Tools label) ──
  function openToolsConfig(anchor) {
    let p = document.getElementById('tc-toolcfg'); if (p) { p.remove(); return; }
    p = document.createElement('div'); p.id = 'tc-toolcfg'; p.className = 'tc-toolcfg';
    let dragAct = null;
    const apply = () => { renderToolbar(); };
    const update = (act, patch) => {
      const cfg = getToolCfg(); const t = cfg.find(x => x.act === act); if (!t) return;
      Object.assign(t, patch);
      if (!t.icon && !t.text) { if ('icon' in patch) t.text = true; else t.icon = true; }   // keep ≥1
      saveToolCfg(cfg); render(); apply();
    };
    const reorder = (fromAct, toAct, after) => {
      const cfg = getToolCfg(); const fi = cfg.findIndex(t => t.act === fromAct); if (fi < 0) return;
      const item = cfg.splice(fi, 1)[0]; let ti = cfg.findIndex(t => t.act === toAct); if (ti < 0) ti = cfg.length - 1; if (after) ti += 1;
      cfg.splice(ti, 0, item); saveToolCfg(cfg); render(); apply();
    };
    const below = (e, row) => { const rc = row.getBoundingClientRect(); return e.clientY > rc.top + rc.height / 2; };   // drop after/before per cursor (#280)
    function render() {
      p.innerHTML = '<div class="tc-tc-h">Customize tools</div><div class="tc-tc-list"></div>'
        + '<div class="tc-tc-hint">Drag ☰ to reorder · ☑ shows it on the bar (else under the Tools menu) · tools with settings show them inline</div>';
      const list = p.querySelector('.tc-tc-list');
      getToolCfg().forEach(t => {
        const m = TOOL[t.act];
        const row = document.createElement('div'); row.className = 'tc-tc-row' + (t.onBar ? '' : ' off'); row.dataset.act = t.act; row.draggable = true;
        row.innerHTML =
          '<span class="tc-tc-grab" title="drag to reorder">☰</span>'
          + `<label class="tc-tc-onbar" title="show on the toolbar"><input type="checkbox" class="cb-onbar"${t.onBar ? ' checked' : ''}></label>`
          + `<span class="tc-tc-ic">${esc(m.icon)}</span><span class="tc-tc-lab">${esc(m.label)}</span>`
          + `<span class="tc-tc-dens" title="what shows on the button — icon and/or text"><button type="button" class="tc-tc-seg cb-icon${t.icon ? ' on' : ''}" title="show the icon">${esc(m.icon)}</button><button type="button" class="tc-tc-seg cb-text${t.text ? ' on' : ''}" title="show the text">T</button></span>`;
        list.appendChild(row);
      });
      list.querySelectorAll('.tc-tc-row').forEach(row => {
        const act = row.dataset.act;
        row.querySelector('.cb-onbar').onchange = e => update(act, { onBar: e.target.checked });
        row.querySelector('.cb-icon').onclick = () => update(act, { icon: !cfgOf(act).icon });
        row.querySelector('.cb-text').onclick = () => update(act, { text: !cfgOf(act).text });
        row.ondragstart = e => { dragAct = act; row.classList.add('drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', act); } catch (x) {} };
        row.ondragend = () => { dragAct = null; p.querySelectorAll('.tc-tc-row').forEach(r => r.classList.remove('drag', 'over-top', 'over-bottom')); };
        row.ondragover = e => { e.preventDefault(); row.classList.toggle('over-bottom', below(e, row)); row.classList.toggle('over-top', !below(e, row)); };   // #280: indicate drop direction
        row.ondragleave = () => row.classList.remove('over-top', 'over-bottom');
        row.ondrop = e => { e.preventDefault(); const dir = below(e, row); row.classList.remove('over-top', 'over-bottom'); const from = dragAct || (e.dataTransfer && e.dataTransfer.getData('text/plain')); if (from && from !== act) reorder(from, act, dir); };
      });
    }
    render();
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    // open BELOW the whole toolbar (it may have wrapped to several rows), not just
    // below the Tools label — so the popover never covers the 2nd row (#280)
    const bar = document.getElementById('tc-bar');
    const barBottom = bar ? bar.getBoundingClientRect().bottom : r.bottom;
    p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - p.offsetWidth - 8)) + 'px';
    p.style.top = Math.max(8, Math.min(barBottom + 6, window.innerHeight - p.offsetHeight - 8)) + 'px';
    const off = e => { if (!p.contains(e.target) && e.target !== anchor) { p.remove(); document.removeEventListener('mousedown', off); } }; setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  // proxy MusicBrainz's own (hidden) Guess-case options so they actually affect its guessing
  function gcNative() {
    const fs = document.querySelector('fieldset.guesscase, .guesscase'); if (!fs) return null;
    const lang = fs.querySelector('select'); const checks = [...fs.querySelectorAll('input[type=checkbox]')];
    const txt = c => ((c.closest('label') || {}).textContent || '').toLowerCase();
    const keepUC = checks.find(c => txt(c).includes('keep') && txt(c).includes('uppercas')) || checks.find(c => txt(c).includes('keep')) || checks[0] || null;
    const roman = checks.find(c => txt(c).includes('roman')) || checks[1] || null;
    return { lang, keepUC, roman };
  }
  // MB's guess-case options are React-controlled: a synthetic `change` is ignored, so setting .checked
  // never writes the option/cookie. A real .click() fires MB's own handler (the mode <select>, by contrast,
  // is read live from .value so a dispatched change is enough). #156
  function setNative(el, val) { if (!el) return; if (el.type === 'checkbox') { if (el.checked !== val) el.click(); return; } el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
  function recomputeGuesses() { if (!MODEL) return; MODEL.tracks.forEach(t => { t.guessTitle = guessTitleStr(t); }); rerender(); }

  // search & replace in titles — real-time, recomputed from a snapshot each keystroke (no apply, non-compounding).
  // #152: an "RE" toggle switches between literal matching and full regular expressions ($1, $<name>, …).
  const srRegexOn = () => SETTINGS.srRegex === true;
  // build the matcher. regex mode → raw pattern; literal mode → escape it. invalid regex returns null (no-op).
  function srRe(find, ci, g) {
    const flags = (g ? 'g' : '') + (ci ? 'i' : '');
    try { return new RegExp(srRegexOn() ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); }
    catch (e) { return null; }
  }
  // in literal mode the replacement is literal too — escape `$` so "$1" inserts "$1", not a backref
  const srRepl = replace => srRegexOn() ? replace : replace.replace(/\$/g, '$$$$');
  let _srSnap = null;
  function srActivate() { _srSnap = MODEL ? MODEL.tracks.map(t => t.title) : []; }
  function srLive(find, replace, ci) {
    if (!MODEL) return; if (!_srSnap || _srSnap.length !== MODEL.tracks.length) srActivate();
    const re = find ? srRe(find, ci, true) : null;
    const bad = !!(find && srRegexOn() && !re);   // invalid user regex — flag the field, change nothing
    const findEl = document.querySelector('.tc-sr-find'); if (findEl) findEl.classList.toggle('tc-sr-bad', bad);
    if (bad) { srRememberLast(find, replace); return; }
    const repl = srRepl(replace); let changed = 0;
    MODEL.tracks.forEach((t, i) => {
      const base = _srSnap[i] != null ? _srSnap[i] : t.title;
      const nt = re ? base.replace(re, repl) : base;
      if (nt !== base) changed++;
      if (nt !== t.title) { setTitle(t, nt); t.title = nt; t.guessTitle = guessTitleStr(t); }
      t._srFlash = !!(find && nt !== base);
    });
    rerender(); toast(changed ? `${changed} title${changed !== 1 ? 's' : ''} replaced` : '');
    srRememberLast(find, replace);
  }
  // #152 — named search/replace templates, persisted in settings. "_Last" is a special auto-kept entry
  // (the most recent pattern) that sorts first because "_" precedes letters.
  function srTemplates() { if (!Array.isArray(SETTINGS.srTemplates)) SETTINGS.srTemplates = []; return SETTINGS.srTemplates; }
  let _srLastTimer = null;
  function srRememberLast(find, replace) {
    if (!find) return;
    const list = srTemplates(); const prev = list.find(t => t.name === '_Last');
    if (prev && prev.find === find && prev.replace === replace && prev.re === srRegexOn()) return;
    const ent = { name: '_Last', find, replace, re: srRegexOn() };
    if (prev) Object.assign(prev, ent); else list.push(ent);
    clearTimeout(_srLastTimer); _srLastTimer = setTimeout(saveSettings, 600);   // debounce the localStorage write across keystrokes
  }
  function srSaveTemplate(name, find, replace) {
    name = (name || '').trim(); if (!name || !find) return false;
    const list = srTemplates(); const ex = list.find(t => t.name === name);
    const ent = { name, find, replace, re: srRegexOn() };
    if (ex) Object.assign(ex, ent); else list.push(ent);
    saveSettings(); return true;
  }
  function srRemoveTemplate(name) { SETTINGS.srTemplates = srTemplates().filter(t => t.name !== name); saveSettings(); }
  // the Templates popup — sorted list (｢_Last｣ first), click a row to load+apply, ✕ to remove,
  // and a "new template" section (shown only when the search field is non-empty). #152
  let _srPop = null, _srPopOff = null;
  function closeSrTemplates() { if (_srPop) { _srPop.remove(); _srPop = null; } if (_srPopOff) { document.removeEventListener('mousedown', _srPopOff, true); _srPopOff = null; } }
  function openSrTemplates(anchor, findEl, repEl, reBtn) {
    if (_srPop) { closeSrTemplates(); return; }
    const pop = document.createElement('div'); pop.className = 'tc-srtpl'; _srPop = pop;
    const loadTpl = t => {
      findEl.value = t.find; repEl.value = t.replace; SETTINGS.srRegex = !!t.re; saveSettings();
      if (reBtn) { reBtn.classList.toggle('on', !!t.re); findEl.placeholder = srRegexOn() ? 'search (regex)' : 'search'; }
      srLive(findEl.value, repEl.value, true); closeSrTemplates(); findEl.focus();
    };
    const render = () => {
      pop.innerHTML = '<div class="tc-srtpl-hd">Templates</div>';
      const list = srTemplates().slice().sort((a, b) => a.name.localeCompare(b.name));
      if (list.length) {
        const cap = document.createElement('div'); cap.className = 'tc-srtpl-row tc-srtpl-cap';
        cap.innerHTML = '<span>Name</span><span>Search</span><span>Replace</span><span>RE</span><span></span>';
        pop.appendChild(cap);
        list.forEach(t => {
          const row = document.createElement('div'); row.className = 'tc-srtpl-row';
          ['tc-srtpl-nm', 'tc-srtpl-f', 'tc-srtpl-r'].forEach((c, i) => { const s = document.createElement('span'); s.className = c; s.textContent = [t.name, t.find, t.replace][i]; s.title = [t.name, t.find, t.replace][i]; row.appendChild(s); });
          const rec = document.createElement('span'); rec.className = 'tc-srtpl-re'; rec.textContent = t.re ? 'RE' : ''; row.appendChild(rec);
          const x = document.createElement('button'); x.type = 'button'; x.className = 'tc-srtpl-x'; x.textContent = '✕'; x.title = 'Remove this template';
          x.onclick = e => { e.stopPropagation(); srRemoveTemplate(t.name); render(); };
          row.appendChild(x);
          row.onclick = () => loadTpl(t);
          pop.appendChild(row);
        });
      } else { const e = document.createElement('div'); e.className = 'tc-srtpl-empty'; e.textContent = 'No saved templates yet.'; pop.appendChild(e); }
      if (findEl.value.trim()) {   // offer to save the current pattern
        const sec = document.createElement('div'); sec.className = 'tc-srtpl-new';
        const lbl = document.createElement('div'); lbl.className = 'tc-srtpl-newlbl'; lbl.textContent = 'Enter name for new template'; sec.appendChild(lbl);
        const nm = document.createElement('input'); nm.type = 'text'; nm.className = 'tc-srtpl-name'; nm.placeholder = 'My new template';
        nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (srSaveTemplate(nm.value, findEl.value, repEl.value)) render(); } };
        sec.appendChild(nm); pop.appendChild(sec); setTimeout(() => nm.focus(), 0);
      }
    };
    render();
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    _srPopOff = e => { if (!pop.contains(e.target) && e.target !== anchor) closeSrTemplates(); };
    setTimeout(() => document.addEventListener('mousedown', _srPopOff, true), 0);
  }

  const BAR = `<div class="tc-tools"><span class="tc-toolslabel" data-act="toolsmenu" title="more tools &amp; customize">Tools ▾</span><span class="tc-toolbtns"></span></div>`
    + `<span class="tc-toast"></span><span class="tc-disc-msg"></span><span class="tc-discstat"></span><span class="tc-globalstat"></span><label class="tc-am-lbl"><b>Change</b> ${AM_SELECT}</label><span class="tc-tbsep"></span><button class="tc-btn primary" data-act="match" title="search MusicBrainz for the unmatched artists">⚡ Match</button>`
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
      // #185: right-click the native expand arrow to expand ALL collapsed media at once.
      // Tooltip says so; the contextmenu listener is guarded so it's added once per button.
      const expBtn = fs.querySelector('button.icon.expand-medium');
      if (expBtn) {
        expBtn.title = 'Left click: expand this medium · Right click: expand all media';
        if (!expBtn._tcExpAll) { expBtn._tcExpAll = true; expBtn.addEventListener('contextmenu', e => { e.preventDefault(); expandAllTracklistMediums(); }); }
      }
    });
    anchorBar();   // #247 a re-render (e.g. Add medium) can have shoved the toolbar to the footer — re-pin it on top
  }
  // #185: expand every collapsed medium on the Tracklist side — click each native
  // per-medium expand arrow (it un-collapses + loads tracks just like a single click).
  function expandAllTracklistMediums() {
    const btns = document.querySelectorAll('fieldset.advanced-medium button.icon.expand-medium');
    if (!btns.length) return;
    Log.info('expand all media (tracklist):', btns.length, 'collapsed');
    btns.forEach(b => { try { b.click(); } catch (e) {} });
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
  // Keep the global toolbar pinned at the TOP of the tracklist (right before the
  // first medium). A native knockout re-render — notably clicking "Add medium" —
  // re-orders the tracklist and pushes our toolbar down to the footer, so re-anchor
  // it on every render and whenever the mirror is (re)shown. #247
  function anchorBar() {
    const wrap = document.getElementById('tc-mirror-wrap'); if (!wrap) return;
    const firstFs = document.querySelector('fieldset.advanced-medium');
    if (firstFs && firstFs.parentElement && firstFs.previousElementSibling !== wrap) firstFs.parentElement.insertBefore(wrap, firstFs);
  }
  async function showMirror() {
    _apolloUsed = true;
    document.body.classList.add('tc-tl-on');   // #154: theme the native medium headers to match Apollo while the takeover is on
    style(); let wrap = document.getElementById('tc-mirror-wrap');
    if (wrap) { anchorBar(); syncNative(); return; }
    // the global toolbar sits once at the very top of the Tracklist panel; per-medium tables mount below
    wrap = document.createElement('div'); wrap.id = 'tc-mirror-wrap';
    const firstFs = document.querySelector('fieldset.advanced-medium');
    if (firstFs && firstFs.parentElement) firstFs.parentElement.insertBefore(wrap, firstFs);
    else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(wrap);
    wrap.innerHTML = `<div id="tc-bar">${BAR}</div>`;
    ACTIVE = { mode: 'mirror', sections: [] };
    syncNative();   // hide the native tracklist NOW (before the async match/render) so a fresh mount shows no native flash #145
    bindActions(wrap); initTools(); wireApplyMode(wrap); subscribeTracks();
    await loadAndRender((d, n) => updateStatus(`matching ${d}/${n}…`));
  }
  function hideMirror() { document.body.classList.remove('tc-tl-on'); untidyMediums(); document.querySelectorAll('.tc-medsec').forEach(s => s.remove()); const w = document.getElementById('tc-mirror-wrap'); if (w) w.remove(); setNativeHidden(false); if (ACTIVE.mode === 'mirror') ACTIVE = {}; }

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
    applyDuplicates();   // #187
    relabelLauncher();
  }
  function ensureLauncher() {
    if (document.getElementById('tc-launch')) { relabelLauncher(); return; }
    style(); const b = document.createElement('div'); b.id = 'tc-launch';
    const lbl = document.createElement('span'); lbl.className = 'tc-launch-lbl'; lbl.title = 'Toggle Apollo / the original editor for ALL tabs — stays this way (across pages) until you switch back';
    lbl.onclick = () => {   // GLOBAL toggle — flips Apollo for every tab/feature and persists across pages
      SETTINGS.apolloEnabled = !apolloEnabled(); saveSettings();
      applyView(); applyNav(); applyAnnotationPage();
    };
    const gear = document.createElement('span'); gear.className = 'tc-launch-gear'; gear.textContent = '⚙'; gear.title = 'Apollo Editor settings';
    gear.onclick = () => openSettings(gear);   // the one settings entry point — gear removed from the toolbars
    b.append(lbl, gear);
    document.body.appendChild(b); relabelLauncher();
  }
  function tracklistVisible() { const p = document.getElementById('tracklist'); return !!(p && p.offsetParent !== null); }   // the Tracklist tab panel is shown
  let _tlPrev = false, _recPrev = false, _tlRefreshed = false;
  // #145: the 500ms watcher means switching tab (or toggling Apollo, then visiting a tab) paints the
  // stale/native table for up to half a second before the takeover is (re)applied. Catch the tab-nav
  // clicks — the compact nav routes through these same links — and re-apply on the next frame: after
  // jQuery-UI has shown the target panel but BEFORE the browser paints, so the switch is flash-free.
  function wireTabFlush() {
    const ed = editorEl(); if (!ed || ed._tcTabFlush) return; ed._tcTabFlush = true;
    ed.addEventListener('click', e => { if (e.target.closest('ul.ui-tabs-nav a')) requestAnimationFrame(() => { applyView(); syncNav(); }); });
  }
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
      applyDuplicates();   // #187: score the Add-release Duplicates tab when "Modify Duplicates" is on
      if (editorEl()) { ensureLauncher(); wireTabFlush(); } else { const l = document.getElementById('tc-launch'); if (l) l.remove(); }   // #135: the switch shows on every tab; #145: flush the takeover on tab clicks
      if (navOn() && editorEl()) { if (!document.getElementById('tc-nav-steps')) applyNav(); else syncNav(); relocateAddMedium(); }   // keep compact nav alive + synced
      applyZen();   // #141: keep zen state applied (and fill the nav title once the release model is ready)
    };
    tick(); setInterval(tick, 500);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DUPLICATES (#187) — Add-release "Duplicates" tab.  Adds a Similarity column
     scoring how closely each existing "similar release" matches the one being
     entered, so the editor can pick the right one to base their release on.
     We proxy the native table (KO `foreach: similarReleases`): read each rendered
     row's cells, insert a score cell, and re-apply via a MutationObserver when KO
     re-renders. Off by default (the "Modify Duplicates" setting).
  ═══════════════════════════════════════════════════════════════════════ */
  function dupWant() { return apolloEnabled() && !!SETTINGS.modifyDuplicates; }
  // similarity of an existing release (name / artist / track count, all we can read
  // from the native row) to the release being entered. Multiplicative penalties,
  // in the spirit of MB Release Seeding Helper: a steep title base, softened by an
  // artist mismatch and a track-count gap (our proxy for its per-track length check).
  // #187: similarity = how many of the ENTERED tracks have a title match in the
  // candidate release (greedy 1:1, exact-fold then fuzzy ≥0.85), over the larger of
  // the two tracklists. Metadata (title/artist/count) is deliberately NOT used —
  // two unrelated "Best of …" VA comps share a title but no tracks, and would read
  // 100% on the old metadata score; on track overlap they read ~0%.
  function dupTrackScore(media, entered) {
    const cand = [];
    (media || []).forEach(m => (m.tracks || []).forEach(t => { const f = fold(t.title || ''); if (f) cand.push(f); }));
    const ent = (entered || []).map(t => fold(t.title || '')).filter(Boolean);
    if (!ent.length || !cand.length) return null;   // can't judge overlap → no confident score
    const pool = cand.slice(); let matched = 0;
    for (const e of ent) {
      let idx = pool.indexOf(e);
      if (idx < 0) {   // fuzzy fallback: best edit-distance ratio that clears 0.85
        let bi = -1, br = 0;
        for (let i = 0; i < pool.length; i++) { const r = 1 - recLev(e, pool[i]) / Math.max(e.length, pool[i].length, 1); if (r > br) { br = r; bi = i; } }
        if (br >= 0.85) idx = bi;
      }
      if (idx >= 0) { matched++; pool.splice(idx, 1); }
    }
    return matched / Math.max(ent.length, cand.length);
  }
  // one WS fetch per existing release, shared between the score and the expand view
  const _dupTlCache = new Map();
  async function dupTracklist(gid) {
    if (_dupTlCache.has(gid)) return _dupTlCache.get(gid);
    const m = await fetchDupTracklist(gid); _dupTlCache.set(gid, m); return m;
  }
  // throttled scorer queue — fetch each candidate's tracklist one at a time (the
  // Duplicates tab lists only a handful), staying under MB's WS rate limit.
  const _dupQ = []; let _dupBusy = false;
  function enqueueDupScore(gid, td, tr) { _dupQ.push({ gid, td, tr }); pumpDupScores(); }
  async function pumpDupScores() {
    if (_dupBusy) return; _dupBusy = true;
    while (_dupQ.length) {
      const { gid, td, tr } = _dupQ.shift();
      if (!td.isConnected) continue;
      const media = await dupTracklist(gid);
      if (!td.isConnected) continue;
      paintDupCell(td, tr, gid, media ? dupTrackScore(media, enteredTracklist()) : null);
      await new Promise(z => setTimeout(z, 1100));
    }
    _dupBusy = false;
  }
  function paintDupCell(td, tr, gid, sim) {
    if (sim == null) {
      td.textContent = '?'; td.style.cssText = 'text-align:center;color:#999' + (gid ? ';cursor:pointer' : '');
      td.title = 'no track overlap could be computed (tracklist unavailable, or no tracks entered yet)';
      if (gid) td.onclick = () => toggleDupDetail(tr, gid, td);
      return;
    }
    const pct = Math.round(sim * 100);
    td.textContent = pct + '%';
    td.style.cssText = 'background:' + dupColor(pct) + ';color:#fff;font-weight:700;text-align:center;border-radius:3px;padding:1px 6px' + (gid ? ';cursor:pointer' : '');
    td.title = 'track-overlap similarity to the release you are entering' + (gid ? ' — click for a track-by-track comparison' : '');
    if (gid) td.onclick = () => toggleDupDetail(tr, gid, td);
  }
  // 0% → Apollo red, 50% → amber, 100% → Apollo's match green (#1f8a4c) — uses the
  // same palette as the confidence dots so the score reads as "our" green. (#187)
  function dupColor(pct) {
    const p = Math.max(0, Math.min(100, pct)) / 100;
    const stops = [[0xd3, 0x2f, 0x2f], [0xff, 0xb7, 0x4d], [0x1f, 0x8a, 0x4c]];   // d32f2f · ffb74d · 1f8a4c
    const seg = p < 0.5 ? 0 : 1, t = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
    const c = stops[seg].map((v, i) => Math.round(v + (stops[seg + 1][i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function augmentDupRows(tbody) {
    tbody.querySelectorAll(':scope > tr').forEach(tr => {
      if (tr.classList.contains('tc-dup-detail')) return;   // our own expanded-detail rows
      if (tr.querySelector('.tc-dup-sim')) return;          // already scored this (KO-rendered) row
      const gid = (tr.querySelector('input[name="base-release"]') || {}).value || null;
      const td = document.createElement('td'); td.className = 'tc-dup-sim';
      td.textContent = '…'; td.style.cssText = 'text-align:center;color:#999'; td.title = 'computing track-by-track similarity…';
      tr.insertBefore(td, tr.children[2] || null);   // place right after the Release column
      if (gid) enqueueDupScore(gid, td, tr); else td.textContent = '—';   // neutral until the tracklist is fetched (never a metadata-only guess)
    });
  }
  // expand/collapse a per-track comparison of the existing release vs the one being
  // entered, beneath the clicked row (mirrors MB Release Seeding Helper). #187
  async function toggleDupDetail(tr, gid, cell) {
    const nxt = tr.nextElementSibling;
    if (nxt && nxt.classList.contains('tc-dup-detail')) { nxt.remove(); cell.classList.remove('tc-dd-open'); return; }
    cell.classList.add('tc-dd-open');
    const dr = document.createElement('tr'); dr.className = 'tc-dup-detail';
    const td = document.createElement('td'); td.colSpan = tr.children.length;
    td.innerHTML = '<div class="tc-dd-wrap">loading track comparison…</div>';
    dr.appendChild(td); tr.parentNode.insertBefore(dr, tr.nextSibling);
    const media = await dupTracklist(gid);
    if (!dr.isConnected) return;   // collapsed again before the fetch returned
    td.querySelector('.tc-dd-wrap').innerHTML = media ? buildDupDetail(media, enteredTracklist()) : '<div class="tc-dd-wrap">could not load the existing release tracklist</div>';
  }
  function enteredTracklist() {
    const out = [];
    mediums().forEach(med => (u(med.tracks) || []).forEach(t => out.push({ title: u(t.name) || '', artist: acText(u(t.artistCredit)), len: u(t.length) || null })));
    return out;
  }
  function acJoinJson(ac) { return (ac || []).map(n => (n.name || (n.artist && n.artist.name) || '') + (n.joinphrase || '')).join(''); }
  async function fetchDupTracklist(gid) {
    try {
      const j = await fetch(`${ORIGIN}/ws/2/release/${gid}?inc=artist-credits+recordings&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      return (j.media || []).map((m, mi) => ({
        position: m.position || mi + 1, format: m.format || '',
        tracks: (m.tracks || []).map(t => ({
          pos: t.number || t.position || '',
          title: t.title || (t.recording && t.recording.title) || '',
          artist: acJoinJson(t['artist-credit'] || (t.recording && t.recording['artist-credit'])),
          len: t.length || (t.recording && t.recording.length) || null,
        })),
      }));
    } catch (e) { Log.warn('dup tracklist fetch failed', e.message); return null; }
  }
  const dupFmtLen = ms => ms ? (Math.floor(ms / 60000) + ':' + String(Math.round(ms / 1000) % 60).padStart(2, '0')) : '';
  // char-level LCS diff (same as the recordings detailed highlight) — only the
  // differing characters of each title light up. #186/#187
  function dupCharDiff(a, b) {
    a = a || ''; b = b || ''; if (a.length > 200 || b.length > 200) return null;
    const n = a.length, m = b.length; const dp = []; for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0; const push = (t, ch) => { const l = out[out.length - 1]; if (l && l.t === t) l.s += ch; else out.push({ t, s: ch }); };
    while (i < n && j < m) { if (a[i] === b[j]) { push(0, b[j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { push(-1, a[i]); i++; } else { push(1, b[j]); j++; } }
    while (i < n) push(-1, a[i++]); while (j < m) push(1, b[j++]); return out;
  }
  function dupDiffSide(segs, want) { return segs.map(s => s.t === 0 ? esc(s.s) : s.t === want ? '<span class="tc-dh">' + dhRun(s.s) + '</span>' : '').join(''); }
  // graded length-gap shade — same as the recordings detailed highlight (#186). null under 1s.
  function dupLenShade(gapMs) {
    const g = Math.abs(gapMs || 0);
    if (g < 1000) return null;
    if (g >= 5000) return { bg: '#d32f2f', fg: '#fff' };
    return { bg: 'rgba(211,47,47,' + (0.2 + 0.6 * (g / 5000)).toFixed(2) + ')', fg: g >= 3500 ? '#fff' : '#7a0000' };
  }
  function buildDupDetail(media, entered) {
    let gi = 0, rows = '';
    media.forEach((med, mi) => {
      rows += `<tr class="tc-dd-medhdr"><td colspan="7">#${med.position || mi + 1}${med.format ? ' ' + esc(med.format) : ''}</td></tr>`;
      med.tracks.forEach(t => {
        const s = entered[gi]; gi++; const has = !!s;   // a seeded counterpart at this position?
        // title + artist: per-character diff (literal, like #186 — casing shows)
        const td = has ? dupCharDiff(t.title || '', s.title || '') : null;
        const titleEx = td ? dupDiffSide(td, -1) : esc(t.title || ''), titleSe = has ? (td ? dupDiffSide(td, 1) : esc(s.title || '')) : '';
        const ad = has ? dupCharDiff(t.artist || '', s.artist || '') : null;
        const artEx = ad ? dupDiffSide(ad, -1) : esc(t.artist || ''), artSe = has ? (ad ? dupDiffSide(ad, 1) : esc(s.artist || '')) : '';
        // length: graded shade on both Len cells when the gap is real (#186)
        const sh = (has && t.len && s.len) ? dupLenShade(t.len - s.len) : null;
        const lenSt = sh ? ` style="background:${sh.bg};color:${sh.fg}"` : '';
        rows += `<tr class="tc-dd-row"><td class="tc-dd-pos">${esc(String(t.pos || gi))}</td>`
          + `<td>${artEx}</td><td>${titleEx}</td><td class="tc-dd-len"${lenSt}>${dupFmtLen(t.len)}</td>`
          + `<td>${artSe}</td><td>${titleSe}</td><td class="tc-dd-len"${lenSt}>${has ? dupFmtLen(s.len) : ''}</td></tr>`;
      });
    });
    return `<table class="tc-dd-tbl"><thead><tr><th>Pos</th><th>Release artist</th><th>Release title</th><th>Len</th><th>Seeded artist</th><th>Seeded title</th><th>Len</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function dupStyle() {
    if (document.getElementById('tc-dup-style')) return;
    const s = document.createElement('style'); s.id = 'tc-dup-style';
    s.textContent = `
      #duplicates-tab .tc-dup-sim.tc-dd-open { outline: 2px solid #2a8f2a; outline-offset: -2px; }
      #duplicates-tab tr.tc-dup-detail > td { padding: 0; background: #f3fbf3; border-bottom: 2px solid #cfe6cf; }
      .tc-dd-tbl { width: 100%; border-collapse: collapse; font: 12px Arial, sans-serif; }
      .tc-dd-tbl th { text-align: left; font-weight: 600; color: #4a6a4a; border-bottom: 1px solid #cfe6cf; padding: 3px 10px; }
      .tc-dd-tbl td { padding: 2px 10px; vertical-align: top; }
      .tc-dd-tbl .tc-dd-medhdr td { font-weight: 700; background: #dff0df; color: #2a5a2a; }
      .tc-dd-tbl .tc-dd-pos { color: #888; text-align: right; width: 34px; }
      .tc-dd-tbl .tc-dd-len { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; width: 48px; }
      .tc-dd-tbl .tc-dd-x { color: #c00; }
      .tc-dd-tbl .tc-dh { background: #ffc9c9; color: #a00000; border-radius: 2px; }
      .tc-dd-tbl .tc-cf { display: inline-block; padding: 0 .5px; }`;
    document.head.appendChild(s);
  }
  function applyDuplicates() {
    const panel = document.getElementById('duplicates-tab');
    if (!panel) return;
    const table = panel.querySelector('table.tbl'); if (!table) return;
    const thead = table.querySelector('thead tr'), tbody = table.querySelector('tbody');
    if (!dupWant()) {   // teardown
      panel.querySelectorAll('.tc-dup-sim, .tc-dup-th, .tc-dup-detail').forEach(e => e.remove());
      if (tbody && tbody._tcDupObs) { tbody._tcDupObs.disconnect(); tbody._tcDupObs = null; }
      return;
    }
    dupStyle();
    if (thead && !thead.querySelector('.tc-dup-th')) {
      const th = document.createElement('th'); th.className = 'tc-dup-th'; th.textContent = 'Similarity';
      th.title = 'How closely each existing release matches the one you are entering — click a score for a track-by-track comparison.';
      thead.insertBefore(th, thead.children[2] || null);
    }
    if (!tbody) return;
    augmentDupRows(tbody);
    if (!tbody._tcDupObs) { const obs = new MutationObserver(() => augmentDupRows(tbody)); obs.observe(tbody, { childList: true }); tbody._tcDupObs = obs; }
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
  // artist-entity equality for the flattened {artistGids} carried on ctx / candidate data:
  // same gids in order means any text difference is only a "credited as" name, not a real
  // artist mismatch — so it must NOT drag the match confidence down (a *Credited as* value
  // doesn't influence matching). This keeps auto-match consistent with the table's exact dot. #190
  function sameAcEntities(a, b) {
    const x = a && a.artistGids, y = b && b.artistGids;
    return !!(x && y && x.length > 0 && x.length === y.length && x.every((g, i) => g === y[i]));
  }
  // EXACT means the displayed strings are identical — only Unicode-normalisation
  // (NFC) is folded, never case/accents/spacing. A casing-only (or accent-only)
  // difference is NOT exact: it's a real visible difference that native offers to
  // copy, so it belongs in the tolerance band, not the blue "exact" one. #197
  const literalEq = (a, b) => String(a == null ? '' : a).normalize('NFC') === String(b == null ? '' : b).normalize('NFC');
  function recExactMatch(data, ctx) {
    if (!ctx) return false;
    const titleEq = !data.name || !ctx.title || literalEq(data.name, ctx.title);
    // a same-entity credited-as is still exact (#190) — only the artist *text*
    // is no longer case/accent-folded into exactness (#197)
    const artistEq = !data.artist || !ctx.artist || sameAcEntities(data, ctx) || literalEq(data.artist, ctx.artist);
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
  // Native MB's raw per-field "differs from recording" flag, UNfiltered by
  // Apollo's tolerance / ignore-casing settings. This is what drives the
  // native update checkboxes, so proxying it (rather than the cosmetically
  // filtered recFieldDiffs) is the only way to be sure the copy is offered
  // exactly when native offers it — e.g. casing-only title diffs. #146
  function nativeDiffFlag(track, which) {
    try {
      const fn = which === 'title' ? track.titleDiffersFromRecording : track.artistDiffersFromRecording;
      return typeof fn === 'function' ? !!fn.call(track) : false;
    } catch (e) { return false; }
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
  // artist-credit rendered as links to each artist's page (joined by their join
  // phrases). `withDisamb` appends each artist's disambiguation (when the page
  // model carries it) — used in the picker header so a wrong artist is obvious. #195
  function acLinks(ac, withDisamb) {
    const names = u(ac && ac.names) || [];
    if (!names.length) return '';
    return names.map((n, i) => {
      const art = n.artist ? u(n.artist) : null;
      const nm = u(n.name) || (art && u(art.name)) || '';
      const gid = art && u(art.gid);
      const cmt = (art && u(art.comment)) || getDisamb(gid);   // KO model lacks it for fresh picks → cache fallback #195
      const dis = withDisamb && cmt ? ' <span class="tc-rpk-adis">(' + esc(cmt) + ')</span>' : '';
      const nx = names[i + 1]; const nxa = nx && (nx.artist ? u(nx.artist) : null); const nxNm = nx ? (u(nx.name) || (nxa && u(nxa.name)) || '') : '';
      return (gid ? '<a href="' + ORIGIN + '/artist/' + esc(gid) + '" target="_blank" rel="noopener">' + dhRun(nm) + '</a>' : dhRun(nm)) + dis + joinMark(u(n.joinPhrase) || '', i === names.length - 1, nm, nxNm);
    }).join('');
  }
  // flat {name, gid, comment, join} per artist of a credit — lets the table diff
  // artists by ENTITY (not raw text) while keeping links + disambiguations. #186 #195
  function acData(ac) {
    return (u(ac && ac.names) || []).map(n => {
      const art = n.artist ? u(n.artist) : null;
      const gid = (art && u(art.gid)) || null;
      return { name: u(n.name) || (art && u(art.name)) || '', gid, comment: (art && u(art.comment)) || getDisamb(gid), join: u(n.joinPhrase) || '' };
    });
  }
  // render one credit as links (+ disambiguations), boxing the artists whose
  // ENTITY isn't present on the other side — the detailed-highlight equivalent
  // for artists that keeps links instead of char-diffing plain text (#186: the
  // original highlighted the differing artist; links used to drop here). A
  // credited-as (same entity, different text) is NOT boxed — it's the same
  // artist, just a different credit.
  function acLinksDiff(self, other, withDisamb) {
    const key = a => a.gid || ('name:' + a.name.toLowerCase().trim());
    const otherSet = new Set((other || []).map(key));
    return (self || []).map((a, i) => {
      const nm = dhRun(a.name);
      const inner = a.gid ? '<a href="' + ORIGIN + '/artist/' + esc(a.gid) + '" target="_blank" rel="noopener">' + nm + '</a>' : nm;
      const boxed = otherSet.has(key(a)) ? inner : '<span class="tc-dh">' + inner + '</span>';
      const dis = withDisamb && a.comment ? ' <span class="tc-rec-disamb">(' + esc(a.comment) + ')</span>' : '';
      return boxed + dis + joinMark(a.join, i === self.length - 1, a.name, self[i + 1] && self[i + 1].name);
    }).join('');
  }
  // #186 detailed highlighting — char-level LCS diff of two short strings.
  // Returns segments [{t,s}] with t: 0 common · -1 only-in-a · 1 only-in-b, or null
  // when either string is too long (caller falls back to the flat highlight).
  function charDiff(a, b) {
    a = a || ''; b = b || '';
    if (a.length > 200 || b.length > 200) return null;
    const n = a.length, m = b.length;
    const dp = []; for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    const push = (t, ch) => { const l = out[out.length - 1]; if (l && l.t === t) l.s += ch; else out.push({ t, s: ch }); };
    while (i < n && j < m) { if (a[i] === b[j]) { push(0, b[j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { push(-1, a[i]); i++; } else { push(1, b[j]); j++; } }
    while (i < n) push(-1, a[i++]); while (j < m) push(1, b[j++]);
    return out;
  }
  // render one side of a diff: common runs stay plain, this side's unique chars
  // (want = -1 track/left, 1 recording/right) are wrapped as .tc-dh.
  // #203: confusable / invisible characters. These are marked with their Unicode
  // name + codepoint (tooltip) and enlarged, with invisibles drawn as a visible
  // glyph — so a curly quote, an en-dash, or a no-break space is obvious wherever a
  // title/artist is shown (not just inside a detailed-highlight diff), not a guess.
  const CONFUSABLE = {};
  // Built from codepoints (NOT literal chars) so invisible keys can't be stripped/
  // normalised in source. vis glyphs: ␣ ␣, ∅ ∅, ⇥ ⇥, · ·.
  [
    [0x0027, 'apostrophe (straight)'], [0x2019, 'right single quote / curly apostrophe'], [0x2018, 'left single quote'],
    [0x0060, 'grave accent / backtick'], [0x00B4, 'acute accent'], [0x02BC, 'modifier letter apostrophe'],
    [0x0022, 'quotation mark (straight)'], [0x201C, 'left double quote'], [0x201D, 'right double quote'],
    [0x2032, 'prime'], [0x2033, 'double prime'],
    [0x002D, 'hyphen-minus'], [0x2010, 'hyphen'], [0x2011, 'non-breaking hyphen'], [0x2012, 'figure dash'],
    [0x2013, 'en dash'], [0x2014, 'em dash'], [0x2015, 'horizontal bar'], [0x2212, 'minus sign'],
    [0x00AD, 'soft hyphen', '·'], [0x2026, 'horizontal ellipsis'],
    [0x00A0, 'no-break space', '␣'], [0x202F, 'narrow no-break space', '␣'], [0x2009, 'thin space', '␣'],
    [0x2002, 'en space', '␣'], [0x2003, 'em space', '␣'], [0x3000, 'ideographic space', '␣'],
    [0x200B, 'zero-width space', '∅'], [0x200C, 'zero-width non-joiner', '∅'], [0x200D, 'zero-width joiner', '∅'],
    [0xFEFF, 'byte-order mark', '∅'], [0x0009, 'tab', '⇥'],
  ].forEach(([cp, n, vis]) => { CONFUSABLE[String.fromCodePoint(cp)] = { n, c: cp.toString(16).toUpperCase().padStart(4, '0'), vis }; });
  // Mark EVERY confusable / invisible character, wherever a title/artist is shown
  // (not just inside a detailed-highlight diff): each gets a tooltip naming it + its
  // codepoint, invisibles draw a visible glyph, and all are enlarged by the Appearance
  // "punctuation size" setting (px). Straight ' " - are marked too — the point is to
  // see the exact character in ANY situation (#203). px = 0 disables it (master switch).
  function dhRun(str) {
    const px = SETTINGS.recPunctSize | 0;
    if (px <= 0) return esc(String(str));   // 0 = disabled everywhere
    const st = ' style="font-size:calc(1em + ' + px + 'px);font-weight:700;line-height:1"';
    let out = '';
    for (const ch of String(str)) {
      const cf = CONFUSABLE[ch];
      out += cf ? '<span class="tc-cf"' + st + ' title="' + esc(cf.n + ' (U+' + cf.c + ')') + '">' + esc(cf.vis || ch) + '</span>' : esc(ch);
    }
    return out;
  }
  // #208 join-phrase spacing visibility (Recording view). A join phrase between
  // two artists should have a space on BOTH sides (" & ", " feat. ", …). Mark
  // where one is MISSING with a highlighted ␣ — so `Gandhabba &Render` reads as
  // `Gandhabba &␣Render`. An empty phrase between two artists (no join at all)
  // becomes `␣?␣`. Uses the same px>0 master switch as the #203 marking. `isLast`
  // = the final artist of a credit, whose empty join is correct (not flagged).
  // A join needs a TRAILING space (the next artist mustn't be glued on) and,
  // for most phrases, a LEADING one too (" & ", " feat. "). The exception:
  // a comma/semicolon attaches to the PREVIOUS name, so ", " is correct with
  // no leading space — don't flag it (chaban, #208).
  function joinNeed(j) {
    return { lead: !/^\s/.test(j) && !/^\s*[,;]/.test(j), trail: !/\s$/.test(j) };
  }
  // CJK scripts (Japanese, Chinese, Korean) don't space their joins — e.g. と /
  // 、 in Japanese — so a no-space join is correct there. Detects Hiragana,
  // Katakana, Kanji, Hangul, CJK punctuation and full-width forms (chaban, #208).
  const CJK_RE = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿︰-﹏＀-￯가-힯]/;
  const isCjk = s => CJK_RE.test(String(s == null ? '' : s));
  function joinMark(join, isLast, prevName, nextName) {
    const j = String(join == null ? '' : join);
    const px = SETTINGS.recPunctSize | 0;
    if (px <= 0) return esc(j);
    if (isLast) return dhRun(j);                 // trailing artist — empty join is fine
    if (j === '') return '<span class="tc-jp" title="missing join phrase — no separator between these artists">␣?␣</span>';
    const mk = side => '<span class="tc-jp" title="missing ' + side + ' space around the join phrase">␣</span>';
    const need = joinNeed(j);
    if (isCjk(j) || isCjk(prevName) || isCjk(nextName)) { need.lead = false; need.trail = false; }   // CJK: no space convention
    return (need.lead ? mk('leading') : '') + dhRun(j) + (need.trail ? mk('trailing') : '');
  }
  function diffSide(segs, want) {
    return segs.map(s => s.t === 0 ? esc(s.s) : s.t === want ? '<span class="tc-dh">' + dhRun(s.s) + '</span>' : '').join('');
  }
  // graded length-gap shade (#186): null under 1s, scaling red 1–5s, solid red ≥5s.
  // the configurable detailed-highlight colour as {r,g,b} (#186 — Matching → highlight colour)
  function hlRgb() {
    const h = String(SETTINGS.recHlColor || '#e53935').replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const v = parseInt(n, 16);
    return (n.length === 6 && Number.isFinite(v)) ? { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 } : { r: 229, g: 57, b: 53 };
  }
  function applyHlColor() { try { document.documentElement.style.setProperty('--tc-hl', SETTINGS.recHlColor || '#e53935'); } catch (e) {} }
  function lenShade(gapMs) {
    const g = Math.abs(gapMs || 0);
    if (g < 1000) return null;
    const { r, g: gg, b } = hlRgb();
    if (g >= 5000) return { bg: `rgb(${r},${gg},${b})`, fg: '#fff' };
    const a = (0.2 + 0.6 * (g / 5000)).toFixed(2);   // graded by gap; faint shades get dark tinted text, strong get white
    return { bg: `rgba(${r},${gg},${b},${a})`, fg: g >= 3500 ? '#fff' : `rgb(${Math.round(r * 0.42)},${Math.round(gg * 0.42)},${Math.round(b * 0.42)})` };
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
      // EXACT = displayed title/artist identical (literal, not case/accent-folded —
      // a casing-only diff is tolerance, #197) and length displays the same. A
      // credited-as artist (same entity) still counts as exact. #119 #190
      const exact = !!(rec && literalEq(u(t.name), u(rec.name))
        && (!u(t.length) || !u(rec.length) || Math.round(u(t.length) / 1000) === Math.round(u(rec.length) / 1000))
        && (sameArtistEntities(t, rec) || literalEq(acText(u(t.artistCredit)), acText(u(rec.artistCredit)))));
      // which fields a green (within-tolerance) match still differs on — for the dot tooltip
      const tolDiffs = [];
      if (rec) {
        if (fold(u(t.name)) !== fold(u(rec.name))) tolDiffs.push('title');
        if (u(t.length) && u(rec.length) && Math.round(u(t.length) / 1000) !== Math.round(u(rec.length) / 1000)) tolDiffs.push('length ' + Math.round(Math.abs(u(t.length) - u(rec.length)) / 1000) + 's');
        if (!(sameArtistEntities(t, rec) || fold(acText(u(t.artistCredit))) === fold(acText(u(rec.artistCredit))))) tolDiffs.push('artist');
      }
      const isNew = typeof t.hasNewRecording === 'function' ? !!u(t.hasNewRecording) : false;
      // raw native diff flags (proxy the native update checkboxes), #146
      const rawTitleDiff  = !!(rec && !isNew && nativeDiffFlag(t, 'title'));
      const rawArtistDiff = !!(rec && !isNew && nativeDiffFlag(t, 'artist'));
      out.push({
        exact, tolDiffs,
        mi, ti, number: u(t.number), title: u(t.name), trackArtist: acText(u(t.artistCredit)), trackArtistHtml: acLinks(u(t.artistCredit), true), trackAc: acData(u(t.artistCredit)), trackLen: u(t.length),
        isNew,
        recGid: rec ? u(rec.gid) : null, recName: rec ? u(rec.name) : null, recComment: rec ? (u(rec.comment) || '') : '', recArtist: rec ? acText(u(rec.artistCredit)) : null, recArtistHtml: rec ? acLinks(u(rec.artistCredit), true) : '', recAc: rec ? acData(u(rec.artistCredit)) : [], recLen: rec ? u(rec.length) : null,
        // submit-flags: when on, the recording's title/artist will be overwritten with the track's on submit
        copyTitle: typeof t.updateRecordingTitle === 'function' ? !!u(t.updateRecordingTitle) : false,
        copyArtist: typeof t.updateRecordingArtist === 'function' ? !!u(t.updateRecordingArtist) : false,
        rawTitleDiff, rawArtistDiff,
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
      // collapsed-medium expand control (#149)
      '.tc-rectbl tr.tc-recmed-coll td{padding:0}',
      '.tc-rectbl .tc-recmed-exp{width:100%;text-align:left;border:none;background:#f3f0fa;color:#4b2e83;font:600 13px Arial;padding:7px 10px;cursor:pointer}',
      '.tc-rectbl .tc-recmed-exp:hover{background:#ece5f7;color:#5f3ec0}',
      '.tc-rectbl .tc-recmed-exp.loading{cursor:default;opacity:.7}',
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
      '.tc-rectbl .tc-dh{background:var(--tc-hl,#e53935);color:#fff;border-radius:2px;padding:0 1px}',   // #186 a differing character run — colour configurable (Matching → highlight colour)
      '.tc-cf{display:inline-block;padding:0 .5px}',   // #203 confusable/invisible changed char — enlarged inline (Appearance) + hover tooltip names the codepoint
      '.tc-jp{display:inline-block;background:var(--tc-hl,#e53935);color:#fff;border-radius:2px;padding:0 1px;font-weight:700}',   // #208 missing space (␣) / missing join phrase (␣?␣) around a join phrase',
      '.tc-rectbl td.tc-dh-len{font-weight:600;border-radius:2px}',   // #186 graded length-gap shade (inline bg)',
      '.tc-rectbl td.tc-copy{background:#e3f4e7;color:#1f7a44;font-style:italic}',   // flagged to copy the track value on submit
      '.tc-rectbl .tc-rec-orig{text-decoration:line-through;opacity:.55;font-style:normal;font-weight:400}',   // recording original kept beside the → preview #146
      '.tc-rectbl .tc-rec-disamb{color:#999;font-weight:400}',   // recording disambiguation, grey like native #144
      '.tc-rectbl .tc-rpk-adis{color:#999;font-weight:400}',     // artist disambiguation in the table — grey like native, not black (tc-rpk-adis base style is picker-scoped) #186
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
      '.tc-recpop .tc-rpk-hd{padding:7px 10px;background:#f3f0fa;border-bottom:1px solid #e3def2;border-radius:6px 6px 0 0;display:flex;align-items:baseline;gap:8px}',   // #144: title - artist … sec (sec right)
      '.tc-recpop .tc-rpk-hdmain{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tc-recpop .tc-rpk-curwrap{border-bottom:1px solid #eee}',   // one separator under the whole current-recording group
      '.tc-recpop .tc-rpk-cur{padding:6px 10px 3px;color:#444;display:flex;align-items:baseline;gap:6px}',
      '.tc-recpop .tc-rpk-curmain{flex:1;min-width:0}',   // #189 title + artist on the left; length pinned right
      '.tc-recpop .tc-rpk-curactions{display:flex;padding:2px 10px 7px}',   // "+ new recording" sits below appears-on, right-aligned
      '.tc-recpop .tc-rpk-curlbl{color:#999;font-size:11px}.tc-recpop .tc-rpk-curlen{color:#888;font-variant-numeric:tabular-nums;margin-left:auto;flex:none}',
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
      '.tc-recpop .tc-rpk-curisrc{padding:0 10px 4px;color:#777;font-size:11px}.tc-recpop .tc-rpk-curisrc-list{font-family:Consolas,monospace;color:#555}',
      '.tc-recpop .tc-rpk-len{margin-left:auto;color:#666;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.tc-recpop .tc-rpk-by{color:#555;font-size:11px}',
      '.tc-recpop .tc-rpk-on{color:#777;font-size:11px}',
      '.tc-recpop .tc-rpk-on a,.tc-recpop .tc-rpk-curon a,.tc-recpop .tc-rpk-name a,.tc-recpop .tc-rpk-by a{color:#2c5d9b;text-decoration:none}.tc-recpop .tc-rpk-on a:hover,.tc-recpop .tc-rpk-curon a:hover,.tc-recpop .tc-rpk-name a:hover,.tc-recpop .tc-rpk-by a:hover{text-decoration:underline}',
      '.tc-recpop .tc-rpk-name a{color:inherit}',   // title link keeps the result's strong colour; underline on hover only
      '.tc-recpop .tc-rpk-adis{color:#9a8fb5;font-size:10px}',   // artist disambiguation in the by-line / header #195',
      '.tc-recpop .tc-rpk-more{color:#999;font-style:italic}',
      '.tc-recpop .tc-rpk-rgx{color:#888;font-size:10px;font-weight:600}',
      // header subtitle = the song (track) artist + length; current-recording artist + its full appears-on
      '.tc-recpop .tc-rpk-hdby{color:#6a6a6a;font-weight:normal}.tc-recpop .tc-rpk-hdlen{color:#888;font-weight:normal;font-variant-numeric:tabular-nums;margin-left:auto;flex:none}',   // #144: push sec to the right edge (aligns with the rows' length column)
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
      // #149: hide every native per-medium "Edit" (load-tracks) button — Apollo
      // renders all mediums collapsed and triggers the load itself on expand.
      'body.tc-rec-on #recordings button[data-click="loadTracks"]{display:none!important}',
      // MOBILE: the side-by-side Track|Recording table (8 fixed-% columns)
      // can't fit a phone — stack each comparison into a card: the track line
      // (#, title, artist, length) on top, then the matched recording line
      // beneath, marked by the confidence dot. #issue
      '@media (max-width:820px){',
      '  #tc-recwrap .tc-rec-tb{gap:5px 8px}',
      '  .tc-rectbl{display:block}',
      '  .tc-rectbl > colgroup,.tc-rectbl > thead{display:none}',
      '  .tc-rectbl > tbody{display:block}',
      '  .tc-rectbl > tbody > tr.tc-recrow{display:grid;grid-template-columns:20px 1fr auto;column-gap:7px;row-gap:1px;padding:8px 8px}',
      '  .tc-rectbl.gridrows > tbody > tr.tc-recrow{border-bottom:1px solid #e0e0e0}',
      '  .tc-rectbl > tbody > tr.tc-recrow > td{display:block;padding:0;border:none!important;background:transparent}',
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(1){grid-column:1;grid-row:1;text-align:left}',   // #
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(2){grid-column:2;grid-row:1;font-weight:600}',   // track title
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(3){grid-column:2;grid-row:2;color:#666;font-size:12px}',   // track artist
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(4){grid-column:3;grid-row:1;width:auto}',   // track length
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(5){grid-column:1;grid-row:3;text-align:center;padding-top:4px!important}',   // dot
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(6){grid-column:2;grid-row:3}',   // recording title
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(7){grid-column:2;grid-row:4;color:#666;font-size:12px}',   // recording artist
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(8){grid-column:3;grid-row:3;width:auto}',   // recording length
      '  .tc-rectbl > tbody > tr.tc-recrow > td:nth-child(5),.tc-rectbl > tbody > tr.tc-recrow > td:nth-child(6),.tc-rectbl > tbody > tr.tc-recrow > td:nth-child(8){margin-top:3px;padding-top:4px;border-top:1px solid #eee!important}',
      '  .tc-rectbl td.c-sep{border-left:none;border-right:none}',
      '  .tc-rectbl tr.tc-recmed td,.tc-rectbl tr.tc-recmed-coll td{display:block}',
      '  .tc-rectbl .tc-rec-rev{visibility:visible}',   // touch: no hover
      '}',
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
    wireRecCellContextMenu(wrap);
    renderRecBody(wrap);
  }
  // Right-click a recording title/artist cell to toggle its "copy track value to
  // the recording (on submit)" flag — the same flag the picker checkbox sets, but
  // without opening the picker. Eligibility proxies the NATIVE update checkbox
  // (nativeDiffFlag), so it works for casing-only diffs too. #146
  //   plain  → just the clicked field on that row
  //   Ctrl   → both fields (that have a diff) on the clicked row
  //   Alt    → the clicked field down the whole column (every diffing row)
  function wireRecCellContextMenu(wrap) {
    const tbl = wrap.querySelector('.tc-rectbl'); if (!tbl) return;
    const copyOn = (t, f) => f === 'title' ? !!u(t.updateRecordingTitle) : !!u(t.updateRecordingArtist);
    const eligible = (t, f) => !!t && (nativeDiffFlag(t, f) || copyOn(t, f));
    tbl.addEventListener('contextmenu', e => {
      const tr = e.target.closest('tr.tc-recrow'); if (!tr) return;
      const inTitle = !!e.target.closest('td.tc-recname');
      const field = inTitle ? 'title' : (e.target.closest('td.tc-recartist') ? 'artist' : null);
      if (!field) return;   // not a recording cell → leave the native menu
      // On a recording title/artist cell ALWAYS suppress the native menu, even
      // when there's no difference — toggling on some cells but popping the OS
      // menu on others was confusing; just do nothing (no native menu) when
      // there's no copy to offer. #146 (maintainer)
      e.preventDefault();
      const mi = +tr.dataset.mi, ti = +tr.dataset.ti, t0 = koTrack(mi, ti);
      if (!eligible(t0, field)) return;   // no copy available here → do nothing
      const target = !copyOn(t0, field);   // toggle based on the clicked cell's current state
      const apply = (m, i, f) => { const t = koTrack(m, i); if (eligible(t, f)) setCopy(f, { mi: m, ti: i }, target); };
      if (e.ctrlKey)      ['title', 'artist'].forEach(f => apply(mi, ti, f));
      else if (e.altKey)  wrap.querySelectorAll('tbody tr.tc-recrow').forEach(row => apply(+row.dataset.mi, +row.dataset.ti, field));
      else                apply(mi, ti, field);
      rerenderRec();
    });
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
    // #149: iterate ALL mediums so collapsed ones still appear (with an expand
    // control) instead of being silently dropped — previously only the medium MB
    // had loaded showed up.
    mediums().forEach((med, mi) => {
      const collapsed = !mediumLoadedRec(med);
      if (multi || collapsed) {
        const mr = document.createElement('tr'); mr.className = 'tc-recmed' + (collapsed ? ' tc-recmed-coll' : ''); mr.dataset.mi = String(mi);
        if (collapsed) {
          const td = document.createElement('td'); td.colSpan = 8;
          const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tc-recmed-exp';
          btn.textContent = '▸ Medium ' + (mi + 1) + ' — left click to expand, right click to expand all';
          btn.title = 'Left click: load this medium · Right click: load all collapsed media';
          btn.onclick = () => expandRecMedium(mi, btn);
          btn.oncontextmenu = (e) => { e.preventDefault(); expandAllRecMediums(btn); };
          td.appendChild(btn); mr.appendChild(td);
        } else {
          mr.innerHTML = '<td colspan="8">Medium ' + (mi + 1) + '</td>';
        }
        tb.appendChild(mr);
      }
      if (collapsed) return;   // no track rows until the user expands it
      rows.forEach(r => { if (r.mi === mi) tb.appendChild(renderRecRow(r)); });
    });
    _lastRecSig = recSig();   // mark the state this render reflects, so the tick only re-renders on real changes
  }
  function mediumLoadedRec(med) { try { return typeof med.loaded === 'function' ? !!u(med.loaded) : true; } catch (e) { return true; } }
  // #149: load a collapsed medium's recordings on demand — the native per-medium
  // "Edit" button's loadTracks action (those buttons are hidden). loadTracks fetches
  // async, so poll the model until the medium reports loaded, then re-render.
  function expandRecMedium(mi, btn) {
    const med = mediums()[mi]; if (!med) return;
    if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ Medium ' + (mi + 1) + ' — loading…'; }
    try { if (typeof med.loadTracks === 'function') { Log.info('loading recordings for medium ' + (mi + 1)); med.loadTracks(); } }
    catch (e) { Log.warn('loadTracks failed', e.message); }
    let n = 0;
    // loadTracks makes MB re-render the recordings panel, which can wipe our
    // mounted table — so re-mount via showRecMirror (re-anchors to the now-loaded
    // medium's table + re-renders) once the medium reports loaded. #149
    const poll = () => { n++; if (mediumLoadedRec(med) || n > 75) { snapshotRecOriginals(); showRecMirror(); } else setTimeout(poll, 200); };
    setTimeout(poll, 200);
  }
  // #185: expand EVERY still-collapsed medium at once (right-click an expand arrow).
  // Fires loadTracks on all collapsed media, then re-renders once they've all loaded
  // (one poll for the whole set, vs one per medium).
  function expandAllRecMediums(btn) {
    const pending = mediums().filter(med => !mediumLoadedRec(med));
    if (!pending.length) return;
    Log.info('expand all media (recordings):', pending.length, 'collapsed');
    if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ expanding all media…'; }
    pending.forEach(med => { try { if (typeof med.loadTracks === 'function') med.loadTracks(); } catch (e) { Log.warn('loadTracks failed', e.message); } });
    let n = 0;
    const poll = () => { n++; if (pending.every(mediumLoadedRec) || n > 100) { snapshotRecOriginals(); showRecMirror(); } else setTimeout(poll, 200); };
    setTimeout(poll, 200);
  }
  function renderRecRow(r) {
      const d = r.diffs || {};
      // recording name: click to open the picker. Artists are links. When a copy-to-match flag is set
      // (from the picker), the cell previews the track value the recording will become (green). #119
      // when a copy flag is on, preview the track value AND keep the recording's
      // original alongside it, struck through: "→ New (O̶r̶i̶g̶i̶n̶a̶l̶)". #146
      // recording disambiguation shown in grey after the name, like the native UI. #144
      const disamb = r.recComment ? ' <span class="tc-rec-disamb">(' + esc(r.recComment) + ')</span>' : '';
      const titleCell = r.copyTitle ? '→ ' + dhRun(r.title || '') + (r.recName ? ' <s class="tc-rec-orig">' + esc(r.recName) + disamb + '</s>' : '')
        : r.isNew ? '<span class="tc-rec-new">＋ new recording</span>' : r.recName ? (dhRun(r.recName) + disamb) : '<span class="tc-rec-none">— none —</span>';
      const artistCell = r.copyArtist ? '→ ' + dhRun(r.trackArtist || '') + (r.recArtist ? ' <s class="tc-rec-orig">' + esc(r.recArtist) + '</s>' : '') : (r.recArtistHtml || '');
      const tolHas = f => (r.tolDiffs || []).some(x => x === f || x.startsWith(f));   // within-tolerance diffs highlight the cells too
      // No more tc-updavail blue underline (#197): a native-offers-copy row is now
      // always tolerance (never exact), so it's already coloured by its tolerance
      // state — the extra blue line was redundant. Right-click copy still works
      // (driven by tElig below), it just isn't drawn as a separate cue.
      const tCls = r.copyTitle ? 'tc-copy' : (d.title || tolHas('title') ? 'tc-diff' : '');
      const aCls = r.copyArtist ? 'tc-copy' : (d.artist || tolHas('artist') ? 'tc-diff' : '');
      const tElig = r.rawTitleDiff || r.copyTitle, aElig = r.rawArtistDiff || r.copyArtist;
      const changed = recChangedFromOrig(r.mi, r.ti);   // differs from the page-load recording
      // #186 detailed highlighting (opt-in): per-character title + artist diff + graded length shade.
      // Falls back to the flat tc-diff highlight when off, in copy-preview, or for long titles.
      // Diffs on the LITERAL strings, so a casing/punctuation-only difference still shows the exact
      // changed characters even though the tolerance/ignore-casing settings treat the row as a match.
      // The cell keeps its base background (the match/mismatch colour, like the length cells);
      // the per-character highlight is drawn on TOP — so the diff classes are left unchanged. #186
      const dh = SETTINGS.recDetailedHl && r.recGid && !r.isNew;
      let trackTitleHtml = dhRun(r.title || ''), recTitleHtml = titleCell;
      if (dh && !r.copyTitle && r.recName != null && (r.title || '') !== (r.recName || '')) {
        const segs = charDiff(r.title || '', r.recName || '');
        if (segs) { trackTitleHtml = diffSide(segs, -1); recTitleHtml = diffSide(segs, 1) + disamb; }
      }
      // artists: ENTITY-level diff that KEEPS the per-artist links + disambiguations
      // (#186: links used to drop here because we char-diffed plain text; #195:
      // disambiguations now show). The artist whose entity isn't on the other side
      // is boxed; a credited-as (same entity) isn't. Trigger on an ENTITY difference,
      // not just text — a track artist swapped to a SAME-NAME different artist reads
      // identically but must still be boxed so it's not missed (#186, chaban).
      const acKeys = ac => (ac || []).map(a => a.gid || ('name:' + (a.name || '').toLowerCase().trim())).join('');
      const artistEntitiesDiffer = acKeys(r.trackAc) !== acKeys(r.recAc);
      let trackArtistHtml2 = r.trackArtistHtml || '', recArtistCell = artistCell;
      if (dh && !r.copyArtist && r.recArtist != null && ((r.trackArtist || '') !== (r.recArtist || '') || artistEntitiesDiffer)) {
        trackArtistHtml2 = acLinksDiff(r.trackAc, r.recAc, true);
        recArtistCell    = acLinksDiff(r.recAc, r.trackAc, true);
      }
      let recLenCls = (d.len || tolHas('length')) ? 'tc-diff' : '', recLenStyle = '';
      if (dh && (d.len || tolHas('length'))) {
        const sh = lenShade((r.recLen || 0) - (r.trackLen || 0));
        if (sh) { recLenCls = 'tc-dh-len'; recLenStyle = ' style="background:' + sh.bg + ';color:' + sh.fg + '"'; }
      }
      const tr = document.createElement('tr'); tr.className = 'tc-recrow' + (changed ? ' tc-recchanged' : ''); tr.dataset.mi = r.mi; tr.dataset.ti = r.ti;
      tr.innerHTML =
        '<td class="c-n">' + esc(String(r.number == null ? '' : r.number)) + '</td>' +
        '<td class="tc-tkt">' + trackTitleHtml + '</td>' +
        '<td>' + trackArtistHtml2 + '</td>' +
        '<td class="c-len">' + fmtMs(r.trackLen) + '</td>' +
        '<td class="c-sep"><span class="tc-dot"></span></td>' +
        '<td class="tc-recname ' + tCls + '">' + recTitleHtml + '</td>' +
        '<td class="tc-recartist ' + aCls + '">' + recArtistCell + '</td>' +
        '<td class="c-len ' + recLenCls + '"' + recLenStyle + '>' + fmtMs(r.recLen) + '</td>';
      const dot = tr.querySelector('.tc-dot');
      if (r.conf) { dot.style.background = r.conf.color; dot.title = r.conf.label + ' — differs: ' + r.conf.diffs.join(', '); }
      else if (r.recGid) { dot.style.background = r.exact ? CONF_COLOR.exact : CONF_COLOR.tolerance; dot.title = r.exact ? 'Exact match' : 'Tolerance match' + (r.tolDiffs && r.tolDiffs.length ? ' (' + r.tolDiffs.join(', ') + ')' : ''); }
      else dot.style.visibility = 'hidden';
      const nameCell = tr.querySelector('.tc-recname');
      nameCell.classList.add('tc-clickable');
      nameCell.title = 'change recording — suggestions / search' + (tElig ? '  ·  right-click: copy track title to recording (Ctrl: row · Alt: column)' : '');
      nameCell.onclick = () => openRecPicker(r, nameCell);
      if (aElig) { const artCell = tr.querySelector('.tc-recartist'); if (artCell) artCell.title = 'right-click: copy track artist to recording (Ctrl: row · Alt: column)'; }
      if (changed) {   // per-row revert ↺ (single), shown on hover when changed
        const rev = document.createElement('button'); rev.className = 'tc-rec-rev'; rev.textContent = '↺'; rev.title = 'revert to the original recording';
        rev.onclick = e => { e.stopPropagation(); revertRecording(r); };
        nameCell.appendChild(rev);
      }
      return tr;
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
    if (data.artist && ctx.artist && !sameAcEntities(data, ctx) && !recNameEq(data.artist, ctx.artist)) n++;   // #190 same entity = credited-as only, not a diff
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
        const ctx = { title: r.title, artist: r.trackArtist, length: r.trackLen, artistGids: acArtistGids(u(ko.artistCredit)) };
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
  const _recOrig = new Map();
  // Additive: snapshots tracks not yet captured, keeping the earliest (page-load)
  // baseline. Re-run safely after a collapsed medium is expanded (#149) so its
  // newly-loaded tracks also get a revert baseline.
  function snapshotRecOriginals() {
    mediums().forEach((med, mi) => (u(med.tracks) || []).forEach((t, ti) => {
      const key = mi + ':' + ti;
      if (_recOrig.has(key)) return;
      const r = u(t.recording);
      _recOrig.set(key, { entity: r, gid: r ? u(r.gid) : null, isNew: typeof t.hasNewRecording === 'function' ? !!u(t.hasNewRecording) : false });
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
    (r['artist-credit'] || []).forEach(a => a.artist && noteDisamb(a.artist.id, a.artist.disambiguation));   // cache disambiguations (#195)
    return {
      gid: r.id, name: r.title, length: r.length || null,
      artist: (r['artist-credit'] || []).map(a => (a.name || (a.artist && a.artist.name) || '') + (a.joinphrase || '')).join(''),
      artistGids: (r['artist-credit'] || []).map(a => a.artist && a.artist.id).filter(Boolean),   // #190 entity-aware artist match
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
  // direct lookup of one recording by MBID — backs pasting a recording MBID / URL
  // into the picker's search field (mirrors the artist picker). #189
  async function fetchRecordingById(gid) {
    try {
      const j = await fetch(`${ORIGIN}/ws/2/recording/${gid}?fmt=json&inc=artist-credits+releases+release-groups+isrcs`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      return j && j.id ? mapWsRec(j) : null;
    } catch (e) { Log.warn('recording lookup failed', e.message); return null; }
  }
  // recordings sharing an ISRC — backs pasting an ISRC into the picker's search
  // field (one ISRC can map to several recordings). #196
  async function fetchRecordingsByIsrc(isrc) {
    try {
      // NB: the `isrc` resource rejects `release-groups` as an inc param (unlike
      // the `recording` resource) — including it returns an error object with no
      // recordings, which is why an existing ISRC came back "not found". #196
      const j = await fetch(`${ORIGIN}/ws/2/isrc/${encodeURIComponent(isrc)}?fmt=json&inc=artist-credits+releases+isrcs`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      return ((j && j.recordings) || []).map(mapWsRec);
    } catch (e) { Log.warn('ISRC lookup failed', e.message); return []; }
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
    return { entity: e, gid: u(e.gid), name: u(e.name), length: u(e.length), artist: acText(u(e.artistCredit)), artistGids: acArtistGids(u(e.artistCredit)), releases: rels, isrcs };
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
  // render a WS2 artist-credit (the raw `artist-credit` array kept on mapped
  // recordings) as links + optional disambiguations. Network-free: the gids and
  // disambiguations come from the search response itself. #199 #195
  function acLinksWs(ac, withDisamb) {
    const names = ac || [];
    if (!names.length) return '';
    return names.map(n => {
      const a = n.artist || {};
      noteDisamb(a.id, a.disambiguation);   // feed the cache so the table shows it after a pick (#195)
      const nm = n.name || a.name || '';
      const dis = withDisamb && a.disambiguation ? ' <span class="tc-rpk-adis">(' + esc(a.disambiguation) + ')</span>' : '';
      const link = a.id ? '<a href="' + ORIGIN + '/artist/' + esc(a.id) + '" target="_blank" rel="noopener">' + esc(nm) + '</a>' : esc(nm);
      return link + dis + esc(n.joinphrase || '');
    }).join('');
  }
  // a picker result row — mirrors the native list: title + length, by artist, appears on, ISRCs;
  // left-border colour = confidence vs the track. Title links to the recording and the
  // artist credit links to each artist (with disambiguations), so an odd-looking result
  // can be inspected without first selecting it (#199 #195). Clicks on these links are
  // ignored by the row's pick handler (it bails on `closest('a')`).
  function recRowHtml(data, ctx) {
    const rels = relLinksHtml(data.releases, 6);
    const isrcs = (data.isrcs || []).slice(0, 4).join(', ');
    // highlight the fields that differ from the track, like the table does
    const dT = ctx && data.name && ctx.title && !recTitleEq(data.name, ctx.title);
    const dA = ctx && data.artist && ctx.artist && !recNameEq(data.artist, ctx.artist);
    const dL = !!(ctx && recLenGap(data.length, ctx.length) > 0);
    const titleHtml = data.gid
      ? '<a href="' + ORIGIN + '/recording/' + esc(data.gid) + '" target="_blank" rel="noopener">' + esc(data.name || '') + '</a>'
      : esc(data.name || '');
    const artistHtml = (data.ac && data.ac.length) ? acLinksWs(data.ac, true) : esc(data.artist || '');
    return '<div class="tc-rpk-row' + resultConfClass(data, ctx) + '" data-gid="' + esc(data.gid) + '">' +
      '<div class="tc-rpk-main"><span class="tc-rpk-name' + (dT ? ' tc-rpk-fdiff' : '') + '">' + titleHtml + '</span>' +
        (data.comment ? ' <span class="tc-rpk-cmt">(' + esc(data.comment) + ')</span>' : '') +
        '<span class="tc-rpk-len' + (dL ? ' tc-rpk-fdiff' : '') + '">' + (data.length ? fmtMs(data.length) : '') + '</span></div>' +
      (artistHtml ? '<div class="tc-rpk-by' + (dA ? ' tc-rpk-fdiff' : '') + '">by ' + artistHtml + '</div>' : '') +
      (rels ? '<div class="tc-rpk-on">appears on: ' + rels + '</div>' : '') +
      (isrcs ? '<div class="tc-rpk-isrc">ISRCs: ' + esc(isrcs) + '</div>' : '') +
      '</div>';
  }
  function openRecPicker(entry, anchor) {
    recStyle(); closeRecPop();
    const pop = document.createElement('div'); pop.className = 'tc-recpop'; _recPop = pop; _recPopAnchor = anchor; document.body.appendChild(pop);
    const ko = koTrack(entry.mi, entry.ti);
    const data = {};
    const ctx = { title: u(ko.name), artist: acText(u(ko.artistCredit)), length: u(ko.length), artistGids: acArtistGids(u(ko.artistCredit)) };   // for result confidence colouring
    // the currently-linked recording (or "new recording" if that's flagged)
    const curRec = u(ko.recording);
    const isNew = typeof ko.hasNewRecording === 'function' && !!u(ko.hasNewRecording);
    const curGid = !isNew && curRec ? u(curRec.gid) : null;
    const curArtist = curRec ? acText(u(curRec.artistCredit)) : '';
    // Title - Artist … Len, same shape as the header (length pushed to the right
    // edge); the artist links to the RECORDING's artist (acLinks), not plain text. #189
    const curHtml = isNew
      ? '<span class="tc-rpk-newcur">＋ new recording (created on submit)</span>'
      : curGid
        ? '<span class="tc-rpk-curmain"><a href="' + ORIGIN + '/recording/' + esc(curGid) + '" target="_blank" rel="noopener">' + esc(u(curRec.name) || '') + '</a>'
            + (u(curRec.comment) ? ' <span class="tc-rpk-cmt">(' + esc(u(curRec.comment)) + ')</span>' : '')   // disambiguation on selection #144
            + (curArtist ? ' <span class="tc-rpk-curby">- <span class="tc-rpk-curby-ac">' + acLinks(u(curRec.artistCredit), true) + '</span></span>' : '') + '</span>'
          + (u(curRec.length) ? '<span class="tc-rpk-curlen">' + fmtMs(u(curRec.length)) + '</span>' : '')
        : '<span class="tc-rpk-curnone">— none —</span>';
    const trackArtist = ctx.artist, trackLen = u(ko.length);
    // Show the copy checkboxes whenever NATIVE MB offers them (rawTitleDiff /
    // rawArtistDiff proxy the native update checkboxes), not just when Apollo's
    // tolerance/casing-filtered diff fires — so casing-only diffs still offer it. #146
    const showCopyT = !isNew && (entry.rawTitleDiff || entry.copyTitle), showCopyA = !isNew && (entry.rawArtistDiff || entry.copyArtist);
    pop.innerHTML =
      '<div class="tc-rpk-hd">' +
        '<span class="tc-rpk-hdmain"><b>' + esc(u(ko.name) || '') + '</b>' +
          (trackArtist ? '<span class="tc-rpk-hdby"> - ' + acLinks(u(ko.artistCredit)) + '</span>' : '') + '</span>' +
        (trackLen ? '<span class="tc-rpk-hdlen">' + fmtMs(trackLen) + '</span>' : '') + '</div>' +
      '<div class="tc-rpk-curwrap">' +
        '<div class="tc-rpk-cur">' + curHtml + '</div>' +
        // ISRC of the linked recording — makes it obvious when an ISRC drove the
        // selection (#196). Hidden until the async fill finds at least one.
        (curGid ? '<div class="tc-rpk-curisrc" style="display:none">ISRC: <span class="tc-rpk-curisrc-list"></span></div>' : '') +
        (curGid ? '<div class="tc-rpk-curon">appears on: <span class="tc-rpk-curon-list">…</span></div>' : '') +
      '</div>' +
      (showCopyT || showCopyA ? '<div class="tc-rpk-copy">' +
        (showCopyT ? '<label><input type="checkbox" class="tc-rpk-ct"' + (entry.copyTitle ? ' checked' : '') + '> copy track <b>title</b> to the recording (on submit)</label>' : '') +
        (showCopyA ? '<label><input type="checkbox" class="tc-rpk-ca"' + (entry.copyArtist ? ' checked' : '') + '> copy track <b>artist</b> to the recording (on submit)</label>' : '') + '</div>' : '') +
      '<div class="tc-rpk-qwrap"><input class="tc-rpk-q" type="text" placeholder="search by name, or paste a recording MBID / URL / ISRC…"><button class="tc-rpk-qnew" type="button" title="＋ new recording — create a brand-new recording for this track">＋</button></div>' +
      '<div class="tc-rpk-sec tc-rpk-suggsec" title="click to collapse / expand"><span>suggestions <span class="tc-rpk-caret">▾</span></span></div><div class="tc-rpk-list tc-rpk-sugg"><div class="tc-rpk-empty">finding suggestions…</div></div>' +
      '<div class="tc-rpk-sec">search results<button class="tc-rpk-relax" type="button" title="relaxed search — show all recordings with this title, ignoring artist &amp; length">show all</button></div><div class="tc-rpk-list tc-rpk-res"><div class="tc-rpk-empty">type to search…</div></div>';
    const newBtn = pop.querySelector('.tc-rpk-qnew'); if (newBtn) newBtn.onclick = () => pickNewRecording(entry);
    const ctEl = pop.querySelector('.tc-rpk-ct'); if (ctEl) ctEl.onchange = () => { setCopy('title', entry, ctEl.checked); rerenderRec(); };
    const caEl = pop.querySelector('.tc-rpk-ca'); if (caEl) caEl.onchange = () => { setCopy('artist', entry, caEl.checked); rerenderRec(); };
    // fill the current recording's full "appears on" (all releases, linkable) — not in the page model, so fetch it
    if (curGid) {
      fetch(ORIGIN + '/ws/2/recording/' + curGid + '?fmt=json&inc=artist-credits+releases+release-groups+isrcs', { headers: { Accept: 'application/json' } })
        .then(r => r.json()).then(j => {
          if (!_recPop) return;
          const el = pop.querySelector('.tc-rpk-curon-list');
          if (el) {
            const seen = new Set(), rels = [];
            (j.releases || []).forEach(rl => { const k = rl.id || rl.title; if (rl.title && !seen.has(k)) { seen.add(k); const rg = rl['release-group']; rels.push({ name: rl.title, gid: rl.id, rgGid: rg ? rg.id : null, rgName: rg ? rg.title : null }); } });
            el.innerHTML = rels.length ? relLinksHtml(rels, 0) : '—';
          }
          // Artist disambiguations in the header: the page (KO) model doesn't carry
          // them, so backfill from the WS2 artist-credit once it arrives (#195).
          const acEl = pop.querySelector('.tc-rpk-curby-ac');
          if (acEl && j['artist-credit']) { const h = acLinksWs(j['artist-credit'], true); if (h) acEl.innerHTML = h; }
          // ISRC line — reveal only when the recording actually has ISRC(s). #196
          const isrcWrap = pop.querySelector('.tc-rpk-curisrc'), isrcEl = pop.querySelector('.tc-rpk-curisrc-list');
          const isrcs = (j.isrcs || []).filter(Boolean);
          if (isrcWrap && isrcEl && isrcs.length) { isrcEl.textContent = isrcs.join(', '); isrcWrap.style.display = ''; }
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
      // paste a recording MBID or a /recording/<mbid> URL → resolve and LINK it
      // immediately (same as pasting an MBID in the artist picker). #189
      const gid = mbidFrom(query);
      if (gid) {
        resBox.innerHTML = '<div class="tc-rpk-empty">resolving recording…</div>';
        const rec = await fetchRecordingById(gid);
        if (my !== seq || !_recPop) return;
        if (rec) pickRecording(entry, rec);   // links the recording + closes the picker
        else resBox.innerHTML = '<div class="tc-rpk-empty">recording MBID not found</div>';
        return;
      }
      // paste an ISRC → resolve to its recording(s). Exactly one → link
      // immediately (same as an MBID); several → list them to choose from. #196
      const isrc = isrcFrom(query);
      if (isrc) {
        resBox.innerHTML = '<div class="tc-rpk-empty">resolving ISRC ' + esc(isrc) + '…</div>';
        const recs = await fetchRecordingsByIsrc(isrc);
        if (my !== seq || !_recPop) return;
        if (recs.length === 1) { pickRecording(entry, recs[0]); return; }   // one hit → link + close
        if (recs.length > 1) { recs.forEach(rr => { data[rr.gid] = rr; }); lastResults = recs; paintResults(); return; }
        resBox.innerHTML = '<div class="tc-rpk-empty">no recording with ISRC ' + esc(isrc) + '</div>';
        return;
      }
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
    recStyle(); applyHlColor(); snapshotRecOriginals();   // capture the page-load recording associations, for revert
    // Anchor on a loaded medium's assignation table when present; otherwise (every
    // medium collapsed, #149) mount into the recordings panel itself so we still
    // render — each collapsed medium then shows an expand control.
    const tbl = document.getElementById('track-recording-assignation');
    const host = tbl ? tbl.parentElement : document.getElementById('recordings');
    if (!host) return;
    let wrap = document.getElementById('tc-recwrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'tc-recwrap'; host.insertBefore(wrap, tbl || host.firstChild); }
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
    .tc-nav-wbtn.tc-wiz-prev:not(:disabled):hover,.tc-nav-wbtn.tc-wiz-next:not(:disabled):hover{background:#ece5f8;border-color:#b9a4e0}
    /* #141 Zen editing — the nav-bar release title (shown only in zen) + hiding the page chrome */
    #tc-nav-title{display:none}
    /* two lines (album / artist + versions), centred, tight so they fit the nav button height (#141) */
    body.tc-zen-on #tc-nav-title{display:flex;flex-direction:column;justify-content:center;flex:1 1 0;min-width:0;text-align:center;line-height:1.15;padding:0 14px}
    #tc-nav-title a{color:inherit;text-decoration:none}#tc-nav-title a:hover{text-decoration:underline}
    #tc-nav-title .tc-nav-title-album{font:600 12px Arial;color:#5a3e94;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #tc-nav-title .tc-nav-title-artist{font:11px Arial;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #tc-nav-title .tc-nav-title-ver{color:#999}
    body.tc-zen-on .header,body.tc-zen-on .releaseheader,body.tc-zen-on #page > .tabs,body.tc-zen-on #footer{display:none!important}
    /* zen: drop the page's top spacing so the sticky nav bar pins flush to the top and doesn't drift on scroll (#141) */
    body.tc-zen-on #page{padding-top:0!important;margin-top:0!important}
    body.tc-zen-on #page.fullwidth{padding-top:0!important;margin-top:0!important}
    /* MOBILE: the top nav bar wraps — step switcher + Finish on line 1, the
       Cancel/Prev/Next paginators stay grouped, and (in zen) the release title
       drops to its own full-width line so nothing gets squeezed or clipped. */
    @media (max-width: 820px){
      #tc-nav-bar{flex-wrap:wrap;gap:5px 8px;padding:5px 2px}
      #tc-nav-left{flex:1 1 auto}
      #tc-nav-pager{order:2}
      .tc-nav-step,.tc-nav-wbtn{padding:3px 8px;font-size:12px}
      body.tc-zen-on #tc-nav-title{order:3;flex:1 1 100%;text-align:left;padding:1px 2px 0}
      body.tc-zen-on #tc-nav-title .tc-nav-title-album,
      body.tc-zen-on #tc-nav-title .tc-nav-title-artist{white-space:normal}
    }`;
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
    const title = document.createElement('div'); title.id = 'tc-nav-title';   // #141 Zen: release title · artist · versions (shown only in zen)
    const bar = document.createElement('div'); bar.id = 'tc-nav-bar'; bar.append(left, title, pager);
    ed.insertBefore(bar, ed.firstChild);   // a dedicated full-width row at the top of the editor (frozen on scroll)
    fillNavTitle();
  }
  // Zen editing (#141): hide the site header, release header, entity tabs + footer,
  // leaving just the Apollo nav bar (which gains the release title) and the editor.
  function applyZen() {
    const on = !!(SETTINGS.zenMode && navOn() && editorEl());
    document.body.classList.toggle('tc-zen-on', on);
    if (on) fillNavTitle();
  }
  // populate the nav-bar title: "<album> by <artist> (N versions)", all links —
  // mirrors the native release header that zen hides. Cheap; only fills once.
  function fillNavTitle() {
    const el = document.getElementById('tc-nav-title'); if (!el) return;
    let rel; try { rel = release(); } catch (e) { return; }
    if (!rel) return;
    const gid = u(rel.gid), name = u(rel.name) || '';
    if (!name) return;
    const artist = acLinks(u(rel.artistCredit)) || '';
    // live-update: rebuild only when the title or artist actually changed (not every tick) (#141)
    const sig = name + '\x01' + artist;
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    const album = gid ? '<a href="' + ORIGIN + '/release/' + esc(gid) + '" target="_blank" rel="noopener">' + esc(name) + '</a>' : esc(name);
    // version count — reuse the native release header's "see all versions" link
    let ver = '';
    const rh = document.querySelector('.releaseheader');
    const va = rh && [...rh.querySelectorAll('a')].find(a => /version/i.test(a.textContent || ''));
    if (va) { const m = (va.textContent.match(/(\d+)/) || [])[1]; ver = ' <a href="' + esc(va.href) + '" target="_blank" rel="noopener" class="tc-nav-title-ver">(' + (m ? m + ' versions' : 'all versions') + ')</a>'; }
    el.innerHTML = '<div class="tc-nav-title-album">' + album + '</div>'
                 + '<div class="tc-nav-title-artist">' + artist + ver + '</div>';
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
    /* ---- #143: compact, low-noise Release-info form, matching Apollo's purple ---- */
    body.tc-ri-on #information > div.half-width fieldset{border:none;margin:0 0 12px;padding:0}        /* drop the boxy fieldset frames */
    body.tc-ri-on #information > div.half-width legend{font:600 11px Arial;letter-spacing:.06em;text-transform:uppercase;color:#8a7bb8;padding:0 0 5px;margin:0 0 4px;border-bottom:1px solid #ece7f6;width:100%;box-sizing:border-box}
    body.tc-ri-on #information table.row-form{border-collapse:collapse;width:100%}
    body.tc-ri-on #information table.row-form > tbody > tr > td{padding:2px 6px;vertical-align:middle}   /* tighter rows */
    body.tc-ri-on #information table.row-form label{font-size:12px;color:#6a6a6a;font-weight:normal}
    /* the original bolds only the Title + Artist labels among all the field captions — match that, keeping the
       rest (and the checkbox labels) light so they aren't intrusive (#143) */
    body.tc-ri-on #information table.row-form label[for="title"],
    body.tc-ri-on #information table.row-form label[for="release-artist"]{font-weight:600;color:#4a4a4a}
    body.tc-ri-on #information input[type=text],
    body.tc-ri-on #information select,
    body.tc-ri-on #information textarea{font-size:12px;padding:2px 6px;border:1px solid #d6cdec;border-radius:4px;box-shadow:none}   /* no background → MB's green auto-fill tint survives */
    body.tc-ri-on #information input[type=text]:focus,
    body.tc-ri-on #information select:focus,
    body.tc-ri-on #information textarea:focus{border-color:#8a72c8;outline:none}
    /* "Additional information": the native annotation textarea renders narrower than the
       disambiguation input, and this fieldset's wider "Disambiguation:" caption pushed both
       fields ~23px right of the fields above. Pin its label column to the same 150px the main
       form uses so the fields left-align with Title/Barcode, and make both fields fill the
       column so they're the same width and right-align with the rest. */
    /* :not(#external-links-editor) — MB's external-links editor is ALSO a
       table.row-form inside the information fieldset; without the exclusion this
       150px label-column width hit its favicon cell (normally 30px) and shoved
       every link URL ~150px to the right, misaligning the icons. */
    body.tc-ri-on #information fieldset.information table.row-form:not(#external-links-editor) > tbody > tr > td:first-child{width:150px}
    body.tc-ri-on #information fieldset.information textarea#annotation,
    body.tc-ri-on #information fieldset.information input#comment{width:100%!important;max-width:none!important;box-sizing:border-box}   /* MB pins the annotation textarea to 354px via an !important rule in its (cross-origin) stylesheet — override it so the field fills the column like the input */
    body.tc-ri-on #information .buttons button,body.tc-ri-on #information button.styled-button{font-size:12px}
    body.tc-ri-on #information .lookup-performed{background-color:#eef8ec!important}   /* soften MB's bright auto-fill green to a pale tint (#143) */
    body.tc-ri-on #information > div.documentation{display:none}   /* the contextual help text — replaced by the links column */
    /* #143: on-demand help popover. The native field bubbles still carry the clickable link to the
       *selected* entity ("You selected <a>…</a>"); we surface that next to the focused field instead of
       the removed help column — without bringing back the verbose style-guide noise. (unscoped: the
       element lives on <body>; visibility is gated by the .on class, only added while Apollo is on.) */
    #tc-ri-help{position:fixed;z-index:9999;display:none;max-width:360px;width:max-content;background:#fff;border:1px solid #d6cdec;border-radius:7px;box-shadow:0 6px 22px rgba(60,40,110,.20);padding:9px 12px;font-size:12px;line-height:1.45;color:#444}
    #tc-ri-help.on{display:block}
    #tc-ri-help p{margin:0 0 5px}
    #tc-ri-help p:last-child{margin-bottom:0}
    #tc-ri-help a{color:#5f3ec0;text-decoration:none}
    #tc-ri-help a:hover{text-decoration:underline}
    #tc-ri-help .comment,#tc-ri-help .name-variation a[title]{color:#8a8a8a}
    body.tc-ri-on #tc-ri-rightcol{flex:1 1 340px;min-width:300px;max-width:100%;box-sizing:border-box}  /* links take the remaining width, but wrap below the form when there isn't room for both; never wider than the row */
    /* External links matches the form sections: no boxy border, same compact purple header (#143) */
    body.tc-ri-on #tc-ri-rightcol > fieldset{margin-top:0;max-width:100%;min-width:0;box-sizing:border-box;border:none;padding:0}
    body.tc-ri-on #tc-ri-rightcol > fieldset > legend{font:600 11px Arial;letter-spacing:.06em;text-transform:uppercase;color:#8a7bb8;padding:0 0 5px;margin:0 0 4px;border-bottom:1px solid #ece7f6;width:100%;box-sizing:border-box}
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
    body.tc-ri-on #external-links-editor .favicon{transform:scale(1.45);transform-origin:center;margin-right:0}   /* master's size; drop MB's 4px margin-right that pushed the scaled icon off-centre and clipped it (#143) */
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
    body.tc-ri-on #external-links-editor tr.relationship-item > td:last-child{display:grid;grid-template-columns:minmax(0,1fr) 15px 16px;align-items:center;column-gap:2px;flex:1;min-width:0}
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-content{grid-column:1;display:flex;align-items:center;min-width:0}
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-content > label:first-child{display:none}   /* the "Type:" caption */
    /* a relationship with a date period ("stream for free (1111-11-11 – 1112-11-11)") needs more room than
       one 185px type cell, but not the whole row — span two cells so several dated types still share a wide
       row. The type stays on one line; only a very long date wraps to a second line *inside* the cell, so it
       never overflows into the neighbouring type (overlapping its remove ✗) (#143). */
    body.tc-ri-on #external-links-editor tr.relationship-item:has(.date-period){grid-column:span 2}
    body.tc-ri-on #external-links-editor tr.relationship-item:has(.date-period) .relationship-name{flex-wrap:wrap;white-space:nowrap;overflow:visible}   /* let a very long date wrap to a 2nd line inside the cell (not clipped) */
    /* per-type remove [x] sits in the reserved left slot (absolute), so the type text starts at the same x with or
       without it. left:6px centres MB's native ✗ sprite (≈13.6px) on the same x as the "add another relationship"
       [+] that wraps directly below it when the types stack — at left:0 the native sprite landed ~6px too far left
       of the [+] (the old #154 flat glyph was wider, so it happened to line up). (#160) */
    body.tc-ri-on #external-links-editor tr.relationship-item td.link-actions > button[class*="remove"]{display:inline-flex;align-items:center;position:absolute;left:6px;top:50%;transform:translateY(-50%) scale(.85);margin:0;opacity:.6;transition:opacity .12s}
    body.tc-ri-on #external-links-editor tr.relationship-item td.link-actions > button[class*="remove"]:hover{opacity:1}
    /* type text (committed) / select (editable) fills the cell */
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-name{display:flex;align-items:center;flex:1;min-width:0;font-size:12px;color:#5a3e94;background:transparent;border:none;border-radius:0;padding:0;font-weight:normal;cursor:context-menu;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}   /* keep the type on one line — never wrap it one-word-per-line as the column resizes (#143) */
    body.tc-ri-on #external-links-editor tr.relationship-item .relationship-name:hover{color:#3a2d5c}
    /* editable type dropdowns — appearance:none so the text starts flush at the cell edge; a custom caret keeps the affordance.
       padding-right reserves room for the 10px caret with a small gap; keep it tight (not 15px) so the type label has a few
       px of slack and never clips its last glyph under sub-pixel rounding at 100% browser zoom on a scaled display (#143). */
    body.tc-ri-on #external-links-editor select{-webkit-appearance:none;-moz-appearance:none;appearance:none;font-size:12px;color:#5a3e94;background-color:transparent;background-image:url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='10'%20height='7'%20viewBox='0%200%2010%207'%3E%3Cpath%20d='M1%201l4%204%204-4'%20fill='none'%20stroke='%235a3e94'%20stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right center;border:none;border-radius:0;box-shadow:none;padding:0 12px 0 0;height:auto;margin:0;flex:1;min-width:0;width:100%;cursor:pointer}
    body.tc-ri-on #external-links-editor select:hover{color:#3a2d5c}
    /* video attribute → a compact checkbox (no "video" caption) */
    body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container{grid-column:2;justify-self:start;display:inline-flex;align-items:center;margin:0}
    body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container label{font-size:0;display:inline-flex;align-items:center;cursor:pointer}
    body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input{margin:0}
    /* error → a compact "!" badge (full text on hover via title) so it doesn't reflow the combos when it appears */
    body.tc-ri-on #external-links-editor tr.relationship-item .error.field-error{grid-column:3;justify-self:start;font-size:0;display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#fdecec;border:1px solid #f0c4c4;margin:0;cursor:help}
    body.tc-ri-on #external-links-editor tr.relationship-item .error.field-error::before{content:"!";font:bold 11px/1 Arial;color:#d33}
    /* #169: MB flags a relationship/URL with pending edits via a small <img class="info"
       alt="This relationship has open edits."> that the compact type cell clips away. Rather
       than re-fit the icon (alignment is fragile here), surface it with COLOUR — an amber type
       label + a left accent bar on the row. Pure :has(), no layout shift (inset box-shadow). */
    body.tc-ri-on #external-links-editor tr.relationship-item:has(img.info[alt*="open edits" i]){box-shadow:inset 2px 0 0 0 #e8920c}
    body.tc-ri-on #external-links-editor tr.relationship-item:has(img.info[alt*="open edits" i]) .relationship-name,
    body.tc-ri-on #external-links-editor tr.relationship-item:has(img.info[alt*="open edits" i]) select{color:#b26a00}
    body.tc-ri-on #external-links-editor tr.relationship-item:has(img.info[alt*="open edits" i]) .relationship-name:hover,
    body.tc-ri-on #external-links-editor tr.relationship-item:has(img.info[alt*="open edits" i]) select:hover{color:#8a5200}
    /* same cue when the open edit is on the URL itself (pending add/remove of the link) */
    body.tc-ri-on #external-links-editor tr.external-link-item:has(img.info[alt*="open edits" i]){box-shadow:inset 2px 0 0 0 #e8920c}
    body.tc-ri-on #external-links-editor tr.external-link-item:has(img.info[alt*="open edits" i]) a.url{color:#b26a00}
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
    body.tc-ri-on #external-links-editor tr.external-link-item.tc-link-ok a.url::after{content:" ✓";color:#2c7a45;font-size:11px;opacity:.7}
    /* annotation editor: a bordered box wrapping the toolbar + (bigger) textarea + in-place preview */
    body.tc-ri-on #tc-anno-wrap{border:1px solid #d6cdec;border-radius:7px;background:#fff;overflow:hidden;box-sizing:border-box}
    #tc-anno-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;background:#f6f3fc;border-bottom:1px solid #e7defa}
    #tc-anno-bar button{font:12px Arial;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border:1px solid #d6cdec;border-radius:6px;background:#fff;color:#5a3e94;cursor:pointer}
    #tc-anno-bar button:hover{background:#ece5f8;border-color:#b9a4e0}
    #tc-anno-bar button:disabled{opacity:.6;cursor:default}
    #tc-anno-bar button.tc-anno-icon{padding:4px 8px;font-size:13px;line-height:1;font-weight:700}
    #tc-anno-bar .tc-mk-ico{width:22px;height:14px;display:block}
    #tc-anno-bar .tc-mk-mb{width:17px;height:17px;border-radius:3px}
    #tc-anno-bar .tc-mk-sq{width:15px;height:15px}
    /* maximize: the editor fills the viewport over a dimmed backdrop (Esc or the button restores it) */
    body.tc-anno-max-open{overflow:hidden}
    body.tc-anno-max-open::before{content:'';position:fixed;inset:0;background:rgba(30,20,55,.42);z-index:10000}
    body.tc-ri-on #tc-anno-wrap.tc-anno-max{position:fixed;inset:14px;z-index:10001;display:flex;flex-direction:column;max-width:none;box-shadow:0 14px 50px rgba(35,20,70,.45)}
    #tc-anno-wrap.tc-anno-max #tc-anno-body{flex:1 1 auto;min-height:0}
    body.tc-ri-on #tc-anno-wrap.tc-anno-max textarea,#tc-anno-wrap.tc-anno-max #tc-anno-preview{min-height:0;height:auto}
    #tc-anno-wrap.tc-anno-max #tc-anno-history{flex:1 1 auto;min-height:0;max-height:none}
    #tc-anno-bar #tc-anno-help{width:25px;justify-content:center;color:#7a5fc0}
    #tc-anno-bar.tc-anno-prev-on #tc-anno-preview-btn{background:#5f3ec0;color:#fff;border-color:#5f3ec0}
    #tc-anno-bar.tc-anno-hist-on #tc-anno-history-btn{background:#5f3ec0;color:#fff;border-color:#5f3ec0}
    #tc-anno-bar.tc-anno-hist-on button:not(#tc-anno-history-btn):not(#tc-anno-max){opacity:.4;pointer-events:none}   /* History active → only History + maximize stay usable */
    #tc-anno-status{font:italic 11px Arial;font-weight:normal;color:#8a7bb8;letter-spacing:0;text-transform:none}   /* shown next to the Annotation: label */
    /* three toolbar groups: [Preview Clear]  [markup ?]      [History] (the 1:3 spacers place markup/? left-of-centre) */
    #tc-anno-bar .tc-anno-sp1{flex:1 1 0;min-width:14px}
    #tc-anno-bar .tc-anno-sp2{flex:3 1 0;min-width:14px}
    /* editor body: the active textarea on the left; the live preview splits in on the right when toggled */
    #tc-anno-body{display:flex;align-items:stretch;min-height:240px}
    #tc-anno-edit{flex:1 1 0;min-width:0;display:flex;flex-direction:column}
    body.tc-ri-on #tc-anno-wrap textarea{display:block;width:100%!important;max-width:none!important;min-height:240px;flex:1 1 auto;border:none!important;border-radius:0;padding:9px 11px;resize:vertical;box-shadow:none;box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:12px;line-height:1.55;tab-size:4}
    /* standalone Edit annotation page: Changelog + Annotation rows stacked full-width with the label above */
    body.tc-anno-page #content > form > .row:not(.no-label){display:block;margin:0 0 16px;max-width:1100px}
    body.tc-anno-page #content > form > .row:not(.no-label) > label{display:block;width:auto;text-align:left;float:none;font:600 12px Arial;letter-spacing:.02em;color:#6a6a6a;margin:0 0 5px}
    body.tc-anno-page #content > form > .row > input[type=text]{width:100%;max-width:680px;box-sizing:border-box;padding:5px 8px;border:1px solid #d6cdec;border-radius:5px}
    body.tc-anno-page #content > form > fieldset.editnote{max-width:1100px}
    /* fill the remaining viewport height (height is set per-resize in JS) */
    body.tc-anno-page #tc-anno-wrap{display:flex;flex-direction:column}
    body.tc-anno-page #tc-anno-wrap > #tc-anno-body,body.tc-anno-page #tc-anno-wrap > #tc-anno-history{flex:1 1 auto;min-height:0;max-height:none}
    body.tc-anno-page #tc-anno-wrap textarea,body.tc-anno-page #tc-anno-wrap #tc-anno-preview{min-height:0}
    /* Changelog row becomes [label above] then [input  +  Enter edit] side by side */
    body.tc-anno-page #content > form > .row.tc-cl-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
    body.tc-anno-page #content > form > .row.tc-cl-row > label{flex:1 1 100%;margin-bottom:4px}
    body.tc-anno-page #content > form > .row.tc-cl-row > input[type=text]{flex:1 1 auto;width:auto;max-width:600px}
    body.tc-anno-page #tc-anno-submit{flex:0 0 auto;font:600 13px Arial;padding:7px 18px;border:1px solid #2c7a45;border-radius:6px;background:#3aa55f;color:#fff;cursor:pointer}
    body.tc-anno-page #tc-anno-submit:hover{background:#2c8a4d}
    #tc-anno-preview{flex:1 1 0;min-width:0;min-height:240px;padding:10px 13px;background:#fff;border-left:1px solid #e7defa;font-size:13px;line-height:1.5;color:#333;overflow:auto;word-break:break-word;box-sizing:border-box}
    #tc-anno-preview .tc-anno-empty{color:#999;font-style:italic}
    #tc-anno-preview p{margin:0 0 8px}
    #tc-anno-preview .tc-anno-h{margin:10px 0 6px;color:#3d2470;font-weight:700;line-height:1.25}
    #tc-anno-preview h1.tc-anno-h{font-size:18px}
    #tc-anno-preview h2.tc-anno-h{font-size:16px}
    #tc-anno-preview h3.tc-anno-h,#tc-anno-preview h4.tc-anno-h,#tc-anno-preview h5.tc-anno-h,#tc-anno-preview h6.tc-anno-h{font-size:14px}
    #tc-anno-preview .tc-anno-ul{margin:0 0 8px;padding-left:22px}
    #tc-anno-preview .tc-anno-pre{margin:0 0 8px;padding:8px 10px;background:#f0ecf8;border-radius:4px;font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap}
    #tc-anno-preview hr{border:none;border-top:1px solid #cdbce8;margin:10px 0}
    #tc-anno-preview a{color:#5f3ec0;text-decoration:none}
    #tc-anno-preview a:hover{text-decoration:underline}
    /* syntax help popover (hover the ? button) */
    #tc-anno-help-pop{position:fixed;z-index:10000;display:none;width:370px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow-y:auto;background:#fff;border:1px solid #d6cdec;border-radius:8px;box-shadow:0 8px 26px rgba(60,40,110,.22);padding:10px 13px;font:12px Arial;color:#444;line-height:1.5}
    #tc-anno-help-pop.on{display:block}
    #tc-anno-help-pop table{border-collapse:collapse;margin:6px 0;width:100%}
    #tc-anno-help-pop td{padding:2px 7px 2px 0;vertical-align:top}
    #tc-anno-help-pop td:last-child{color:#777}
    #tc-anno-help-pop code{background:#f0ecf8;border-radius:3px;padding:0 4px;font-family:Consolas,monospace;color:#5a3e94}
    #tc-anno-help-pop .tc-help-dim{color:#999}
    /* Disambiguation + Annotation span the full column with their label stacked ABOVE (not the 150px label
       column). :has targets exactly those two rows, so the relocated External-links table is untouched. */
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #comment),
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #annotation){display:block;width:100%;margin:0 0 14px}
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #comment) > td,
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #annotation) > td{display:block;width:100%!important;padding:0}
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #comment) > td:first-child,
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #annotation) > td:first-child{text-align:left!important;padding:0 0 4px}
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #comment) > td:first-child label,
    body.tc-ri-on #information fieldset.information table.row-form > tbody > tr:has(> td #annotation) > td:first-child label{display:block;width:auto;float:none;text-align:left!important;font:600 12px Arial;letter-spacing:.02em;color:#6a6a6a}
    body.tc-ri-on #information fieldset.information input#comment{width:100%!important;max-width:none!important;box-sizing:border-box}
    /* annotation History: the selected version rendered on the LEFT, user cards on the RIGHT */
    #tc-anno-history{display:flex;min-height:240px;max-height:520px;overflow:hidden;box-sizing:border-box}
    #tc-anno-history .tc-hist-view{flex:1 1 auto;order:1;overflow:auto;padding:11px 14px;font-size:13px;line-height:1.5;color:#333;word-break:break-word}
    #tc-anno-history .tc-hist-list{flex:0 0 250px;order:2;overflow-y:auto;overflow-x:hidden;background:#faf8ff;border-left:1px solid #e7defa}
    #tc-anno-history .tc-hist-card{display:flex;gap:9px;align-items:flex-start;width:100%;box-sizing:border-box;text-align:left;border:none;border-bottom:1px solid #efeafb;background:none;cursor:pointer;padding:9px 11px}
    #tc-anno-history .tc-hist-card:hover{background:#f0ebfb}
    #tc-anno-history .tc-hist-card.on{background:#ece5f8;box-shadow:inset -3px 0 0 #5f3ec0}
    #tc-anno-history .tc-hist-av{width:30px;height:30px;border-radius:50%;flex:0 0 auto;object-fit:cover;background:#e7defa;border:1px solid #ddd}
    #tc-anno-history .tc-hist-meta{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;font:12px Arial}
    #tc-anno-history .tc-hist-editor{font-weight:600;color:#3d2470}
    #tc-anno-history .tc-hist-date{color:#777;font-size:11px}
    #tc-anno-history .tc-hist-cl{color:#8a8a8a;font-style:italic;font-size:11px;margin-top:2px}
    #tc-anno-history .tc-hist-cur{color:#2c7a45;font-style:normal}
    #tc-anno-history .tc-hist-clmsg{color:#5a4a78;font-style:italic;font-size:11px;margin-top:2px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #tc-anno-history .tc-hist-revert{align-self:center;flex:0 0 auto;width:26px;height:26px;border:1px solid #d6cdec;border-radius:5px;background:#fff;color:#5a3e94;font-size:15px;line-height:1;cursor:pointer;opacity:0;transition:opacity .12s}
    #tc-anno-history .tc-hist-card.on .tc-hist-revert,#tc-anno-history .tc-hist-card:hover .tc-hist-revert{opacity:1}   /* visible on the selected card, or any card on hover */
    #tc-anno-history .tc-hist-revert:hover{background:#ece5f8;border-color:#b9a4e0}
    #tc-anno-history .tc-hist-revert:disabled{opacity:.5;cursor:default}
    #tc-anno-history .tc-hist-msg{color:#999;font-style:italic;font-size:12px;padding:6px 2px}
    #tc-anno-history .tc-hist-bar{display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap}
    #tc-anno-history .tc-hist-use{font:12px Arial;padding:4px 11px;border:1px solid #b9a4e0;border-radius:6px;background:#f6f3fc;color:#5a3e94;cursor:pointer}
    #tc-anno-history .tc-hist-use:hover{background:#ece5f8}
    #tc-anno-history .tc-hist-vmeta{font:11px Arial;color:#888}
    #tc-anno-history .tc-anno-rendered h1{font-size:18px;margin:8px 0 6px;color:#3d2470}
    #tc-anno-history .tc-anno-rendered h2{font-size:16px;margin:8px 0 6px;color:#3d2470}
    #tc-anno-history .tc-anno-rendered h3{font-size:14px;margin:8px 0 6px;color:#3d2470}
    #tc-anno-history .tc-anno-rendered p{margin:0 0 8px}
    #tc-anno-history .tc-anno-rendered ul{margin:0 0 8px;padding-left:22px}
    #tc-anno-history .tc-anno-rendered a{color:#5f3ec0;text-decoration:none}
    #tc-anno-history .tc-anno-rendered a:hover{text-decoration:underline}
    #tc-anno-history .tc-anno-rendered .annotation-details,#tc-anno-history .tc-anno-rendered h2.annotation{display:none}`;
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
      // the Check-links toolbar is appended *inside* the fieldset, so it would travel home with it and orphan
      // onto the native Release-information tab (#160) — drop it before moving the fieldset back
      fs.querySelector(':scope > #tc-ri-toolbar')?.remove();
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

  // ── Annotation editor: a small toolbar above the release annotation textarea, with a live
  //    Preview (MB markup → HTML), Clear, and — inspired by kellnerd's annotationConverter — a
  //    Markdown→MB converter and a WS2 "resolve names" action that labels bare MB entity URLs. ──
  const ANNO_NAME_FIELD = { artist:'name', label:'name', area:'name', place:'name', instrument:'name',
    series:'name', event:'name', genre:'name', 'release-group':'title', release:'title', recording:'title', work:'title' };
  // release-group MUST precede release in the alternation (else "release" matches the prefix of "release-group/…")
  const ANNO_ENTITY_RE = /https?:\/\/(?:beta\.)?musicbrainz\.org\/(artist|label|area|place|instrument|series|event|genre|release-group|release|recording|work)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const _annoName = new Map();   // entity url → resolved display name (shared by Resolve-names + Preview)
  const _annoEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // build nested <ul>/<ol> from a flat list of {level>=1, html, ordered} (MB nests by 4-space indentation;
  // "a." marks an auto-numbered list, "*" a bullet list)
  function bulletsToHtml(items) {
    let out = '', depth = 0, openLi = false; const stack = [];
    const open = ord => { const t = ord ? 'ol' : 'ul', c = ord ? 'tc-anno-ol' : 'tc-anno-ul'; out += `<${t} class="${c}">`; stack.push(t); };
    const close = () => { out += `</${stack.pop()}>`; };
    for (const it of items) {
      const lvl = Math.max(1, it.level);
      if (lvl > depth) { while (depth < lvl) { open(it.ordered); depth++; openLi = false; } }
      else { if (openLi) { out += '</li>'; openLi = false; } while (depth > lvl) { close(); depth--; if (depth > 0) out += '</li>'; } }
      out += '<li>' + it.html; openLi = true;
    }
    if (openLi) out += '</li>';
    while (depth > 0) { close(); depth--; if (depth > 0) out += '</li>'; }
    return out;
  }
  // MB annotation markup → HTML, replicating the documented subset (musicbrainz.org/doc/Annotation):
  // ''italic'' '''bold''', = h1 = .. === h3 ===, [url] / [url|text] / bare-url links, ---- rule,
  // (4n)-space "*" nested bullets, 8-space code, &#91;/&#93; literal brackets. Pure + sync (no network).
  function annoToHtml(src) {
    if (!src || !src.trim()) return '<span class="tc-anno-empty">(nothing to preview)</span>';
    src = String(src).replace(/&#91;/g, '\x01').replace(/&#93;/g, '\x02');   // protect literal brackets
    const inline = txt => {
      let s = _annoEsc(txt);
      const links = [];                                 // pull links out first so '' / ''' never touch a URL
      const stash = html => '\x03' + (links.push(html) - 1) + '\x04';
      // only http(s)/ftp are linkified (as MB does) — anything else (e.g. javascript:) renders as plain text
      const anchor = (url, label) => { url = url.trim(); if (!/^(?:https?|ftp):\/\//i.test(url)) return null; const name = _annoName.get(url); return stash(`<a href="${_annoEsc(url)}" target="_blank" rel="noopener">${label != null ? label : (name ? _annoEsc(name) : _annoEsc(url))}</a>`); };
      s = s.replace(/\[([^\]|]+)\|([^\]]*)\]/g, (_m, url, text) => anchor(url, text ? _annoEsc(text) : null) ?? _annoEsc(_m));
      s = s.replace(/\[([^\]|]+)\]/g, (_m, url) => anchor(url, null) ?? _annoEsc(_m));
      s = s.replace(/(^|[\s(])((?:https?|ftp):\/\/[^\s<>]+[^\s<>.,;:!?)])/g, (_m, pre, url) => pre + (anchor(url, null) ?? _annoEsc(url)));
      s = s.replace(/'''''(.+?)'''''/g, '<b><i>$1</i></b>').replace(/'''(.+?)'''/g, '<b>$1</b>').replace(/''(.+?)''/g, '<i>$1</i>');
      s = s.replace(/\x03(\d+)\x04/g, (_m, i) => links[+i]);   // restore links
      return s;
    };
    const lines = src.split(/\r?\n/), out = []; let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      let m;
      if (/^\s*$/.test(ln)) { i++; continue; }
      if (/^-{4,}\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }
      if ((m = ln.match(/^(={1,6})\s*(.*?)\s*=*\s*$/)) && m[2]) { const n = Math.min(m[1].length, 6); out.push(`<h${n} class="tc-anno-h">${inline(m[2])}</h${n}>`); i++; continue; }
      // lists BEFORE code: a "(4n)-space * " line is a level-n bullet, "(4n)-space a. " an auto-numbered item
      // (MB nests by indentation); only 8-space lines that are NOT a list item are code.
      if (/^ {4,}(?:\*|[a-z]\.)[ \t]+/i.test(ln)) { const items = []; let bm; while (i < lines.length && (bm = lines[i].match(/^( +)(\*|[a-z]\.)[ \t]+(.*)$/i))) { items.push({ level: Math.max(1, Math.floor(bm[1].length / 4)), ordered: bm[2] !== '*', html: inline(bm[3]) }); i++; } out.push(bulletsToHtml(items)); continue; }
      if (/^ {8}/.test(ln)) { const buf = []; while (i < lines.length && /^ {8}/.test(lines[i]) && !/^ {4,}(?:\*|[a-z]\.)[ \t]/i.test(lines[i])) { buf.push(_annoEsc(lines[i].slice(8))); i++; } out.push('<pre class="tc-anno-pre">' + buf.join('\n') + '</pre>'); continue; }
      const buf = [];   // a paragraph: consume the CURRENT line first (do-while → i ALWAYS advances, so an
      do { buf.push(inline(lines[i])); i++; }                              // empty-title "=  =" heading can't spin forever),
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^-{4,}\s*$/.test(lines[i]) && !/^={1,6}\s/.test(lines[i]) && !/^ {4,}(?:\*|[a-z]\.)[ \t]+/i.test(lines[i]) && !/^ {8}/.test(lines[i]));   // then following non-blank, non-block lines
      out.push('<p>' + buf.join('<br>') + '</p>');
    }
    return out.join('').replace(/\x01/g, '[').replace(/\x02/g, ']');
  }

  // Markdown → MB annotation markup (kellnerd-inspired). Pure + sync.
  function mdToAnno(src) {
    if (!src) return src;
    const urls = [], blocks = [];                      // protect URLs (* / _) and code blocks from the inline passes
    const stashU = u => '\x05' + (urls.push(u) - 1) + '\x06';
    const stashB = b => '\x07' + (blocks.push(b) - 1) + '\x08';
    src = src.replace(/^```[^\n]*\n([\s\S]*?)\n```[ \t]*$/gm, (_m, code) => stashB(code.split('\n').map(l => '        ' + l).join('\n')));   // ```fenced``` → MB 8-space block
    src = src.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => `[${stashU(url)}|${text}]`);   // [text](url) → [url|text]
    src = src.replace(/(^|[\s(])((?:https?|ftp):\/\/[^\s<>]+)/g, (_m, pre, url) => pre + stashU(url));  // bare urls
    src = src.replace(/\[([^\[\]]*)\]/g, (m, inner) => inner.includes('\x05') ? m : '&#91;' + inner + '&#93;');   // a non-link [x] → encoded brackets, so MB doesn't read it as a (broken) link
    src = src.replace(/^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/gm, (_m, h, t) => { const n = Math.min(h.length, 3); const e = '='.repeat(n); return `${e} ${t} ${e}`; });
    src = src.replace(/(\*\*|__)(.+?)\1/g, "'''$2'''");        // **bold** / __bold__
    src = src.replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, "''$1''");   // *italic*
    src = src.replace(/(?<![_\w])_(?!\s)(.+?)(?<!\s)_(?![_\w])/g, "''$1''");     // _italic_
    src = src.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '----');   // hr (before list rules, so --- isn't eaten)
    src = src.replace(/^([ \t]*)\d+\.[ \t]+/gm, (_m, ind) => { const sp = ind.replace(/\t/g, '  ').length; return ' '.repeat((Math.floor(sp / 2) + 1) * 4) + 'a. '; });   // markdown numbered list → MB "a." (MB auto-numbers a., not 1.)
    src = src.replace(/^([ \t]*)[-*+][ \t]+/gm, (_m, ind) => { const sp = ind.replace(/\t/g, '  ').length; return ' '.repeat((Math.floor(sp / 2) + 1) * 4) + '* '; });   // markdown bullet (2-space-per-level indent) → MB (4n)-space bullet
    src = src.replace(/\x07(\d+)\x08/g, (_m, i) => blocks[+i]);
    return src.replace(/\x05(\d+)\x06/g, (_m, i) => urls[+i]);
  }

  // MB annotation markup → Markdown (reverse of mdToAnno; powers the Markdown toggle's "back" direction)
  function annoToMd(src) {
    if (!src) return src;
    const blocks = [];                                 // pull MB code blocks out first so '''/'' inside them aren't touched
    const stashB = b => '\x07' + (blocks.push(b) - 1) + '\x08';
    src = src.replace(/(?:^ {8}(?! *(?:\*|[a-z]\.)[ \t]).*(?:\n|$))+/gim, m => { const trail = m.endsWith('\n') ? '\n' : ''; const code = m.replace(/\n$/, '').split('\n').map(l => l.slice(8)).join('\n'); return stashB('```\n' + code + '\n```') + trail; });   // MB 8-space block (not a nested list item) → ```fenced```
    src = src.replace(/\[([^\]|]+)\|([^\]]*)\]/g, (_m, url, text) => text ? `[${text}](${url})` : url);   // [url|text] → [text](url); [url|] (empty label) → bare url
    src = src.replace(/\[((?:https?|ftp):\/\/[^\]|]+)\]/g, (_m, url) => url);                        // [url] → bare url
    src = src.replace(/'''''(.+?)'''''/g, '***$1***').replace(/'''(.+?)'''/g, '**$1**').replace(/''(.+?)''/g, '*$1*');
    src = src.replace(/^(={1,6})[ \t]*(.*?)[ \t]*=*[ \t]*$/gm, (_m, e, t) => '#'.repeat(e.length) + ' ' + t);  // = H = → # H
    src = src.replace(/^( {4,})[a-z]\.[ \t]+/gim, (_m, ind) => '  '.repeat(Math.max(0, Math.floor(ind.length / 4) - 1)) + '1. ');   // MB "a." auto-numbered → markdown "1." numbered list
    src = src.replace(/^( {4,})\*[ \t]+/gm, (_m, ind) => '  '.repeat(Math.max(0, Math.floor(ind.length / 4) - 1)) + '- ');   // MB (4n)-space bullet → markdown (2-space-per-level) bullet
    src = src.replace(/^-{4,}[ \t]*$/gm, '---');                                                      // ---- → ---
    src = src.replace(/&#91;/g, '[').replace(/&#93;/g, ']');                                          // decode literal brackets back to plain [ ] (literal in Markdown)
    return src.replace(/\x07(\d+)\x08/g, (_m, i) => blocks[+i]);
  }

  function annoReplaceAsync(str, re, fn) {   // async String.replace (kellnerd's replaceAsync)
    const parts = []; let last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(str)) !== null) { parts.push(str.slice(last, m.index), fn(...m, m.index, str)); last = m.index + m[0].length; if (!re.global) break; }
    parts.push(str.slice(last));
    return Promise.all(parts).then(p => p.join(''));
  }
  async function annoLookupName(type, mbid, full) {   // WS2 entity name, cached
    type = type.toLowerCase();
    if (_annoName.has(full)) return _annoName.get(full);
    try {
      const r = await fetch(`${location.origin}/ws/2/${type}/${mbid}?fmt=json`, { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const j = await r.json(); const name = j[ANNO_NAME_FIELD[type] || 'name'];
      if (name) { _annoName.set(full, name); return name; }
      return null;
    } catch { return null; }
  }
  // is this URL an MB entity URL? (tolerates a trailing path like /release/<mbid>/annotations) → {type,mbid}
  function annoEntity(url) { const m = ANNO_ENTITY_RE.exec(url); ANNO_ENTITY_RE.lastIndex = 0; return m ? { type: m[1].toLowerCase(), mbid: m[2] } : null; }
  // add the entity name to every MB entity link that doesn't already have one — handles MB [url] / [url|]
  // and Markdown []()/bare URLs, in either editing mode. Links that already carry a label are left alone.
  // Captures the URL first, THEN tests it for an entity, so trailing path segments don't break the match.
  async function annoResolveNames(src, md) {   // md=true → emit Markdown links [Name](url); else MB links [url|Name]
    const lbl = async (url) => { const e = annoEntity(url); return e ? await annoLookupName(e.type, e.mbid, url) : null; };
    if (!md) src = await annoReplaceAsync(src, /\[([^\]|]+)\|?\]/g, async (m, url) => { url = url.trim(); const n = await lbl(url); return n ? `[${url}|${n}]` : m; });   // MB [url] / [url|]
    src = await annoReplaceAsync(src, /\[\]\(([^)\s]+)\)/g, async (m, url) => { const n = await lbl(url); return n ? `[${n}](${url})` : m; });   // Markdown [](url)
    // a bare URL (not already inside a [..] or (..) link) → named, in the active markup
    src = await annoReplaceAsync(src, /(?<![\[(|])((?:https?|ftp):\/\/[^\s<>\]]+)/g, async (m, url) => { const n = await lbl(url); return n ? (md ? `[${n}](${url})` : `[${url}|${n}]`) : m; });
    return src;
  }

  // annotation History: parse the /annotations page into a version list, and pull a single version's
  // rendered annotation HTML from its "View this version" page (musicbrainz.org, same-origin fetch).
  async function annoFetchHistory(mbid) {
    const r = await fetch(`${location.origin}/release/${mbid}/annotations`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('history ' + r.status);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const out = [];
    doc.querySelectorAll('table tr').forEach(tr => {
      const view = [...tr.querySelectorAll('a')].find(a => /this version/i.test(a.textContent || ''));
      if (!view) return;
      const ua = tr.querySelector('a[href^="/user/"]');
      const editor = ua?.textContent.trim() || '';
      const avatar = ua?.querySelector('img')?.getAttribute('src') || '';
      const date = [...tr.querySelectorAll('td')].map(c => c.textContent.trim()).find(t => /\d{4}-\d{2}-\d{2}/.test(t)) || '';
      const cl = (view.parentElement.textContent.match(/\(([^)]*)\)/) || [, ''])[1];
      out.push({ editor, avatar, date, changelog: /no changelog/i.test(cl) ? '' : cl, url: view.getAttribute('href') });
    });
    return out;
  }
  async function annoFetchVersion(url) {
    const r = await fetch(new URL(url, location.origin).href, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('version ' + r.status);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const body = doc.querySelector('.annotation-body');
    return body ? body.innerHTML : '<em>(this version is empty)</em>';
  }
  // reconstruct MB markup from a rendered annotation's HTML (MB exposes no raw text per revision) — used to
  // load a past version back into the editor. Lossy on exotic markup, faithful for the common elements.
  function annoHtmlToMb(html) {
    if (/this annotation is empty/i.test(html)) return '';
    const root = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html').body.firstChild;
    const inline = node => {
      let s = '';
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) s += n.textContent;
        else if (n.nodeType === 1) {
          const t = n.tagName.toLowerCase(), inner = inline(n);
          if (t === 'strong' || t === 'b') s += "'''" + inner + "'''";
          else if (t === 'em' || t === 'i') s += "''" + inner + "''";
          else if (t === 'a') { const href = n.getAttribute('href') || ''; s += href ? `[${/^https?:\/\//i.test(href) ? href : location.origin + href}|${inner}]` : inner; }
          else if (t === 'br') s += '\n';
          else s += inner;
        }
      });
      return s;
    };
    const lines = [];
    const listWalk = (listNode, ordered, level) => {
      [...listNode.children].forEach(li => {
        if (li.tagName.toLowerCase() !== 'li') return;
        const clone = li.cloneNode(true); clone.querySelectorAll(':scope > ul, :scope > ol').forEach(s => s.remove());
        lines.push(' '.repeat(level * 4) + (ordered ? 'a. ' : '* ') + inline(clone).trim());
        [...li.children].forEach(c => { const ct = c.tagName.toLowerCase(); if (ct === 'ul' || ct === 'ol') listWalk(c, ct === 'ol', level + 1); });
      });
    };
    const walk = node => node.childNodes.forEach(n => {
      if (n.nodeType === 3) { if (n.textContent.trim()) lines.push(n.textContent.trim(), ''); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (/^h[1-6]$/.test(t)) { const e = '='.repeat(Math.min(+t[1], 3)); lines.push(`${e} ${inline(n).trim()} ${e}`, ''); }
      else if (t === 'p') lines.push(inline(n).replace(/\n+$/, '').trim(), '');
      else if (t === 'ul' || t === 'ol') { listWalk(n, t === 'ol', 1); lines.push(''); }
      else if (t === 'pre') { inline(n).replace(/\n$/, '').split('\n').forEach(l => lines.push('        ' + l)); lines.push(''); }
      else if (t === 'hr') lines.push('----', '');
      else if (t === 'div' || t === 'blockquote') walk(n);
      else { const x = inline(n).trim(); if (x) lines.push(x, ''); }
    });
    walk(root);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '');
  }

  // write into the annotation textarea so MB's model (knockout 'change' / React 'input') picks it up + dirties
  function annoSet(ta, value) {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Enter on a list line continues it (same indent+marker — bullet "*"/"-" or numbered "a."/"1."); an empty
  // item ends the list. Pure → testable.
  function annoContinueBullet(value, pos) {
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = value.indexOf('\n', pos); if (lineEnd < 0) lineEnd = value.length;
    const m = value.slice(lineStart, lineEnd).match(/^([ \t]*)([*+-]|\d+\.|[a-z]\.)([ \t]+)(.*)$/i);
    if (!m) return null;
    if (m[4].trim() === '') return { value: value.slice(0, lineStart) + value.slice(lineEnd), caret: lineStart };   // empty item → end list
    const prefix = m[1] + m[2] + m[3];
    return { value: value.slice(0, pos) + '\n' + prefix + value.slice(pos), caret: pos + 1 + prefix.length };
  }
  // Ctrl/Cmd+B/I: wrap the selection with `marker`, or — with no selection — surround the word under the cursor. Pure.
  function annoWrap(value, selStart, selEnd, marker) {
    let a = selStart, b = selEnd;
    if (a === b) { while (a > 0 && /\w/.test(value[a - 1])) a--; while (b < value.length && /\w/.test(value[b])) b++; }
    return { value: value.slice(0, a) + marker + value.slice(a, b) + marker + value.slice(b), selStart: a + marker.length, selEnd: b + marker.length };
  }
  // Tab on a selection cycles the lines through plain → bullet → numbered → bullet…; Shift+Tab (strip=true)
  // removes any list marker. Pure → testable.
  function annoListSelection(value, selStart, selEnd, raw, strip) {
    let s = value.lastIndexOf('\n', selStart - 1) + 1;
    let e = selEnd; if (e > s && value[e - 1] === '\n') e--;
    let lineEnd = value.indexOf('\n', e); if (lineEnd < 0) lineEnd = value.length;
    const block = value.slice(s, lineEnd);
    const first = (block.split('\n').find(l => l.trim() !== '') || '').match(/^[ \t]*([-*+]|\d+\.|[a-z]\.)/i);
    const ordered = !!(first && /[-*+]/.test(first[1]));   // currently bullets → switch to numbered; else → bullets
    const repl = block.split('\n').map(ln => {
      if (ln.trim() === '') return ln;
      if (strip) return ln.replace(/^[ \t]*(?:[-*+]|\d+\.|[a-z]\.)[ \t]+/i, '');   // remove the list marker, keep the text
      const txt = ln.replace(/^[ \t]*(?:[-*+]|\d+\.|[a-z]\.)?[ \t]*/i, '');   // drop leading ws + any existing marker
      return raw ? (ordered ? '    a. ' : '    * ') + txt : (ordered ? '1. ' : '- ') + txt;
    }).join('\n');
    return { value: value.slice(0, s) + repl + value.slice(lineEnd), selStart: s, selEnd: s + repl.length };
  }
  // "Join lines": collapse the selected lines — or, with no selection, the paragraph at the caret — into a
  // single line, turning every interior newline into one space so hard-wrapped text (e.g. Bandcamp credits)
  // reflows. Leaves blank-line paragraph boundaries as the natural edge of an empty selection. Pure → testable.
  function annoJoinBlock(value, selStart, selEnd) {
    let a, b;
    if (selStart === selEnd) {   // no selection → expand to the run of non-blank lines around the caret
      a = value.lastIndexOf('\n', selStart - 1) + 1;
      while (a > 0) { const ps = value.lastIndexOf('\n', a - 2) + 1; if (!value.slice(ps, a - 1).trim()) break; a = ps; }
      b = value.indexOf('\n', selEnd); if (b < 0) b = value.length;
      while (b < value.length) { let ne = value.indexOf('\n', b + 1); if (ne < 0) ne = value.length; if (!value.slice(b + 1, ne).trim()) break; b = ne; }
    } else {   // selection → expand to whole lines
      a = value.lastIndexOf('\n', selStart - 1) + 1;
      let e = selEnd; if (e > a && value[e - 1] === '\n') e--;
      b = value.indexOf('\n', e); if (b < 0) b = value.length;
    }
    const joined = value.slice(a, b).replace(/[ \t]*\r?\n[ \t]*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
    return { value: value.slice(0, a) + joined + value.slice(b), selStart: a, selEnd: a + joined.length };
  }

  // Wrap #annotation in a bordered editor box (toolbar + a Markdown editing surface + the raw MB field + an
  // in-place preview). Markdown is the DEFAULT surface; the real #annotation field always holds MB markup (so
  // saving is always correct) — Markdown edits are converted into it live. Mounted ONCE per #annotation node
  // (the 500ms applyReleaseInfo poll must not rebuild it — that was the flicker).
  const ANNO_MD_LOGO = '<svg class="tc-mk-ico" viewBox="0 0 208 128" aria-hidden="true"><rect width="198" height="118" x="5" y="5" rx="10" fill="none" stroke="currentColor" stroke-width="10"/><path fill="currentColor" d="M30 98V30h20l20 25 20-25h20v68H110V59L90 84 70 59v39zm125 0l-30-33h20V30h20v35h20z"/></svg>';
  const ANNO_MAX_ICON = '<svg class="tc-mk-ico tc-mk-sq" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  // Join lines: two lines pulled together toward one (a downward merge between a top and bottom rule).
  const ANNO_JOIN_ICON = '<svg class="tc-mk-ico tc-mk-sq" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16"/><path d="M4 19h16"/><path d="M8 9l4 4 4-4"/></svg>';
  const ANNO_MIN_ICON = '<svg class="tc-mk-ico tc-mk-sq" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  const ANNO_MB_LOGO = '<img class="tc-mk-ico tc-mk-mb" alt="MB" src="https://images.dwncdn.net/images/t_app-icon-s/p/c5c33b93-7347-46e3-a512-3decccb33d78/1678792153/2170_4-166444-imgingest-4209519771082272608.png">';
  const ANNO_HELP_HTML =
    '<b>Markdown</b> <span class="tc-help-dim">(converted to MusicBrainz markup on save)</span>' +
    '<table>' +
    '<tr><td><code>**bold**</code> <code>*italic*</code></td><td>bold / italic</td></tr>' +
    '<tr><td><code># H1</code> <code>## H2</code> <code>### H3</code></td><td>headings</td></tr>' +
    '<tr><td><code>- item</code></td><td>bullet list (indent 2 spaces to nest)</td></tr>' +
    '<tr><td><code>1. item</code></td><td>numbered list (MB auto-numbers)</td></tr>' +
    '<tr><td><code>[text](url)</code> · bare URL</td><td>link</td></tr>' +
    '<tr><td><code>```code```</code></td><td>code block</td></tr>' +
    '<tr><td><code>---</code></td><td>horizontal rule</td></tr>' +
    '<tr><td><code>[x]</code></td><td>shown literally (auto-encoded)</td></tr>' +
    '</table>' +
    '<b>Shortcuts</b>' +
    '<table>' +
    '<tr><td><code>Ctrl/Cmd+B</code> / <code>+I</code></td><td>bold / italic (selection or word)</td></tr>' +
    '<tr><td><code>Enter</code></td><td>continue the current list</td></tr>' +
    '<tr><td><code>Tab</code></td><td>indent · on a selection → bullet list (Tab again → numbered, again → bullet…)</td></tr>' +
    '<tr><td><code>Shift+Tab</code></td><td>on a selection → remove the list marker</td></tr>' +
    '</table>' +
    '<div class="tc-help-dim">A MusicBrainz entity URL (bare or <code>[]()</code>) gets its name added automatically.</div>';

  function ensureAnnotationToolbar(taArg) {
    const ta = taArg || document.getElementById('annotation'); if (!ta) return;   // the MB annotation field — always holds MB markup
    if (ta._tcAnnoMounted && ta._tcAnnoMounted.isConnected) return;

    const mbid = (location.pathname.match(/\/release\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/) || [])[1];   // present on /release/<mbid>/edit, absent on /release/add
    const wrap = document.createElement('div'); wrap.id = 'tc-anno-wrap';
    const bar = document.createElement('div'); bar.id = 'tc-anno-bar';
    bar.innerHTML =
      '<button type="button" id="tc-anno-preview-btn" title="Toggle a live split preview — editor on the left, rendered annotation on the right">👁 Preview</button>' +
      '<button type="button" id="tc-anno-clear" title="Clear the annotation">✕ Clear</button>' +
      '<span class="tc-anno-sp tc-anno-sp1"></span>' +
      '<button type="button" id="tc-anno-join" class="tc-anno-icon" title="Join lines — merge the selected lines into one, dropping the hard line breaks so the text reflows. With nothing selected, joins the paragraph at the cursor." aria-label="Join lines">' + ANNO_JOIN_ICON + '</button>' +
      '<button type="button" id="tc-anno-md" class="tc-anno-icon" title="">' + ANNO_MD_LOGO + '</button>' +
      '<button type="button" id="tc-anno-help" class="tc-anno-icon" title="Annotation syntax help" aria-label="Syntax help">?</button>' +
      '<span class="tc-anno-sp tc-anno-sp2"></span>' +
      '<button type="button" id="tc-anno-max" class="tc-anno-icon" title="Maximize the editor (Esc to restore)" aria-label="Maximize">' + ANNO_MAX_ICON + '</button>' +
      (mbid ? '<button type="button" id="tc-anno-history-btn" title="Browse this annotation\'s previous versions and display any one">🕘 History</button>' : '');
    const body = document.createElement('div'); body.id = 'tc-anno-body';
    const editPane = document.createElement('div'); editPane.id = 'tc-anno-edit';
    const md = document.createElement('textarea'); md.id = 'tc-anno-mdinput'; md.spellcheck = false;   // the Markdown editing surface
    const prev = document.createElement('div'); prev.id = 'tc-anno-preview'; prev.style.display = 'none';
    const hist = document.createElement('div'); hist.id = 'tc-anno-history'; hist.style.display = 'none';
    const helpPop = document.createElement('div'); helpPop.id = 'tc-anno-help-pop'; helpPop.innerHTML = ANNO_HELP_HTML;
    ta.parentNode.insertBefore(wrap, ta);
    editPane.append(md, ta); body.append(editPane, prev); wrap.append(bar, body, hist, helpPop);
    ta._tcAnnoMounted = wrap;

    // the field's row — a <tr> in the release editor, a div.row on the standalone Edit annotation page
    const annoRow = wrap.closest('tr, .row');
    // release editor: put Disambiguation above Annotation (both already span the full column via CSS)
    const commRow = document.getElementById('comment')?.closest('tr');
    if (annoRow && commRow && commRow !== annoRow && annoRow.previousElementSibling !== commRow) annoRow.parentNode.insertBefore(commRow, annoRow);

    // status messages appear next to the "Annotation:" label (not in the toolbar)
    const statusEl = document.createElement('span'); statusEl.id = 'tc-anno-status';
    const labelCell = annoRow?.querySelector('td:first-child label') || annoRow?.querySelector('td:first-child') || annoRow?.querySelector('label');
    if (labelCell) labelCell.appendChild(statusEl);

    const $ = id => bar.querySelector('#' + id);
    const status = (msg, ms) => { statusEl.textContent = msg ? ' — ' + msg : ''; if (ms) setTimeout(() => { if (statusEl.textContent === ' — ' + msg) statusEl.textContent = ''; }, ms); };
    // apply a new value as a minimal range edit via execCommand, so it joins the textarea's NATIVE undo stack
    // (Ctrl+Z undoes Ctrl+B/I, Tab lists, Enter continuation, …). Falls back to the native setter if unsupported.
    const editTa = (el, val, s, e2) => {
      const old = el.value;
      if (old !== val) {
        let p = 0; const lim = Math.min(old.length, val.length);
        while (p < lim && old[p] === val[p]) p++;
        let so = old.length, sn = val.length;
        while (so > p && sn > p && old[so - 1] === val[sn - 1]) { so--; sn--; }
        const ins = val.slice(p, sn);
        el.focus(); el.setSelectionRange(p, so);
        let ok = false;
        try { ok = ins ? document.execCommand('insertText', false, ins) : (so > p ? document.execCommand('delete') : true); } catch { ok = false; }
        if (!ok || el.value !== val) { const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); }   // fallback: no native undo, but correct
      }
      el.setSelectionRange(s, e2 == null ? s : e2);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const syncMdToField = () => annoSet(ta, mdToAnno(md.value));   // Markdown surface → MB field (keeps the model correct)
    const activeEl = () => surface === 'raw' ? ta : md;

    let surface = 'md', previewing = false, view = 'edit';   // surface: md|raw · previewing: split preview · view: edit|history
    const renderPreview = () => { if (previewing && view === 'edit') prev.innerHTML = annoToHtml(ta.value); };
    const apply = () => {
      body.style.display = view === 'edit' ? 'flex' : 'none';
      hist.style.display = view === 'history' ? '' : 'none';
      md.style.display = surface === 'md' ? '' : 'none';
      ta.style.display = surface === 'raw' ? '' : 'none';
      prev.style.display = previewing && view === 'edit' ? '' : 'none';
      bar.classList.toggle('tc-anno-prev-on', previewing);
      bar.classList.toggle('tc-anno-hist-on', view === 'history');
      const mdBtn = $('tc-anno-md');
      mdBtn.innerHTML = surface === 'md' ? ANNO_MD_LOGO : ANNO_MB_LOGO;
      mdBtn.title = surface === 'md' ? 'Editing as Markdown — click to edit the raw MusicBrainz markup' : 'Editing raw MusicBrainz markup — click to edit as Markdown';
      renderPreview();
    };

    let previewT;
    md.addEventListener('input', () => { if (surface === 'md') syncMdToField(); clearTimeout(previewT); previewT = setTimeout(renderPreview, 120); });
    ta.addEventListener('input', () => { if (surface === 'raw') { clearTimeout(previewT); previewT = setTimeout(renderPreview, 120); } });
    const wireKeys = el => el.addEventListener('keydown', e => {
      const raw = el === ta;
      if (e.key === 'Enter' && !e.shiftKey && el.selectionStart === el.selectionEnd) {
        const r = annoContinueBullet(el.value, el.selectionStart);
        if (r) { e.preventDefault(); editTa(el, r.value, r.caret); }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (el.selectionStart !== el.selectionEnd) {   // Tab → bullet → numbered → bullet…; Shift+Tab → remove the list marker
          const r = annoListSelection(el.value, el.selectionStart, el.selectionEnd, raw, e.shiftKey);
          editTa(el, r.value, r.selStart, r.selEnd);
        } else if (!e.shiftKey) { const p = el.selectionStart, v = el.value; editTa(el, v.slice(0, p) + '\t' + v.slice(p), p + 1); }   // plain Tab → insert a tab
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[biBI]$/.test(e.key)) {
        e.preventDefault();
        const bold = e.key.toLowerCase() === 'b';
        const marker = raw ? (bold ? "'''" : "''") : (bold ? '**' : '*');
        const r = annoWrap(el.value, el.selectionStart, el.selectionEnd, marker);
        editTa(el, r.value, r.selStart, r.selEnd);
      }
    });
    wireKeys(md); wireKeys(ta);

    // auto-resolve unnamed MB entity links (no button) — on blur of the editing surface, and once on mount
    let resolving = false;
    const autoResolve = async (el) => {
      if (resolving || !ANNO_ENTITY_RE.test(el.value)) return;
      resolving = true; const before = el.value;
      try { const after = await annoResolveNames(before, el === md); if (after !== before && el.value === before) { editTa(el, after, Math.min(el.selectionStart, after.length)); status('named entity links', 2000); } }
      finally { resolving = false; }
    };
    md.addEventListener('blur', () => autoResolve(md));
    ta.addEventListener('blur', () => autoResolve(ta));

    $('tc-anno-preview-btn').onclick = () => { previewing = !previewing; apply(); };
    $('tc-anno-md').onclick = () => { if (surface === 'md') syncMdToField(); surface = surface === 'md' ? 'raw' : 'md'; if (surface === 'md') md.value = annoToMd(ta.value); apply(); activeEl().focus(); };
    $('tc-anno-clear').onclick = () => { md.value = ''; annoSet(ta, ''); renderPreview(); };
    // Join lines: reflow the selected lines (or the caret's paragraph) into one — works on whichever surface is active
    $('tc-anno-join').onclick = () => { const el = activeEl(); const r = annoJoinBlock(el.value, el.selectionStart, el.selectionEnd); editTa(el, r.value, r.selStart, r.selEnd); el.focus(); };
    // maximize / restore the editor (fills the viewport)
    const setMax = on => { wrap.classList.toggle('tc-anno-max', on); document.body.classList.toggle('tc-anno-max-open', on); if (on) wrap.style.height = ''; else if (wrap._tcFill) wrap._tcFill(); const b = $('tc-anno-max'); b.innerHTML = on ? ANNO_MIN_ICON : ANNO_MAX_ICON; b.title = on ? 'Restore the editor (Esc)' : 'Maximize the editor (Esc to restore)'; renderPreview(); };
    $('tc-anno-max').onclick = () => setMax(!wrap.classList.contains('tc-anno-max'));
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('tc-anno-max')) { setMax(false); activeEl().focus(); } });

    // hover-help popover
    const help = $('tc-anno-help'); let helpHideT;
    const showHelp = () => {
      clearTimeout(helpHideT); helpPop.classList.add('on');
      const r = help.getBoundingClientRect(), ph = helpPop.offsetHeight, pw = helpPop.offsetWidth;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);   // flip above the button if it would overflow the bottom
      if (top < 8) top = 8;
      helpPop.style.left = Math.round(left) + 'px'; helpPop.style.top = Math.round(top) + 'px';
    };
    const hideHelp = () => { helpHideT = setTimeout(() => helpPop.classList.remove('on'), 180); };
    help.addEventListener('mouseenter', showHelp); help.addEventListener('focus', showHelp);
    help.addEventListener('mouseleave', hideHelp); help.addEventListener('blur', hideHelp);
    helpPop.addEventListener('mouseenter', () => clearTimeout(helpHideT)); helpPop.addEventListener('mouseleave', hideHelp);

    // History — version list as user cards on the RIGHT, the selected version rendered on the LEFT
    const renderHistory = async () => {
      hist.innerHTML = '<div class="tc-hist-msg">Loading history…</div>';
      let versions; try { versions = await annoFetchHistory(mbid); } catch { hist.innerHTML = '<div class="tc-hist-msg">Failed to load history.</div>'; return; }
      if (!versions.length) { hist.innerHTML = '<div class="tc-hist-msg">No annotation history yet.</div>'; return; }
      hist.innerHTML = '<div class="tc-hist-view"><div class="tc-hist-msg">Select a version to display it.</div></div><div class="tc-hist-list"></div>';
      const list = hist.querySelector('.tc-hist-list'), vw = hist.querySelector('.tc-hist-view');
      versions.forEach((v, idx) => {
        const card = document.createElement('div'); card.className = 'tc-hist-card'; card.tabIndex = 0;
        card.innerHTML = (v.avatar ? `<img class="tc-hist-av" src="${_annoEsc(v.avatar)}" alt="">` : '<span class="tc-hist-av tc-hist-av0"></span>') +
          `<span class="tc-hist-meta"><span class="tc-hist-editor">${_annoEsc(v.editor)}</span><span class="tc-hist-date">${_annoEsc(v.date)}</span>` +
          (idx === 0 ? '<span class="tc-hist-cl tc-hist-cur">current</span>' : '') +
          (v.changelog ? `<span class="tc-hist-cl tc-hist-clmsg" title="${_annoEsc(v.changelog)}">“${_annoEsc(v.changelog)}”</span>` : '') + '</span>' +
          `<button type="button" class="tc-hist-revert" title="${idx === 0 ? 'Revert the editor to the saved version (discard unsaved changes made this session)' : 'Revert the editor to this version (reconstructed from the rendered version — review before submitting)'}">↶</button>`;
        card.onclick = async (e) => {
          if (e.target.closest('.tc-hist-revert')) return;
          list.querySelectorAll('.tc-hist-card').forEach(c => c.classList.remove('on')); card.classList.add('on');
          vw.innerHTML = '<div class="tc-hist-msg">Loading…</div>';
          try { vw.innerHTML = '<div class="tc-anno-rendered">' + await annoFetchVersion(v.url) + '</div>'; }
          catch { vw.innerHTML = '<div class="tc-hist-msg">Failed to load this version.</div>'; }
        };
        const revert = card.querySelector('.tc-hist-revert');
        if (revert) revert.onclick = async (e) => {
          e.stopPropagation(); revert.disabled = true;
          try { const mb = annoHtmlToMb(await annoFetchVersion(v.url)); annoSet(ta, mb); md.value = annoToMd(ta.value); view = 'edit'; apply(); activeEl().focus(); status('reverted to ' + v.date + ' — review before submitting', 4000); }
          catch { status('failed to load that version', 3000); } finally { revert.disabled = false; }
        };
        list.appendChild(card);
      });
    };
    if ($('tc-anno-history-btn')) $('tc-anno-history-btn').onclick = () => { view = view === 'history' ? 'edit' : 'history'; apply(); if (view === 'history') renderHistory(); };

    md.value = annoToMd(ta.value);   // seed the Markdown surface from existing MB markup (no annoSet → no spurious dirty)
    apply();
    setTimeout(() => autoResolve(activeEl()), 400);   // name any unnamed links already in the annotation
  }

  function annoWant() { return apolloEnabled() && SETTINGS.modifyAnnotation !== false; }   // global Apollo toggle + the "Modify annotations" setting
  // tear the editor down and put the native textarea back (when the setting is turned off)
  function unmountAnnotation(taArg) {
    const ta = taArg || document.getElementById('annotation');
    const wrap = ta && ta._tcAnnoMounted;
    if (!wrap || !wrap.isConnected) { if (ta) ta._tcAnnoMounted = null; return; }
    ta.style.display = ''; wrap.parentNode.insertBefore(ta, wrap); wrap.remove();
    ta._tcAnnoMounted = null; document.getElementById('tc-anno-status')?.remove();
  }
  // standalone /release/<mbid>/edit_annotation page: mount our editor on the annotation field, move the
  // Changelog above it (like Disambiguation in /edit). Gated by the same "Modify annotations" setting.
  function applyAnnotationPage() {
    if (!/\/release\/[0-9a-f-]{36}\/edit_annotation/.test(location.pathname)) return;
    const ta = document.querySelector('textarea[name="edit-annotation.text"]'); if (!ta) return;
    ensureLauncher();   // the floating Original / Apollo switcher + ⚙ settings, same as the release editor
    const form = ta.closest('form'), hide = annoWant();
    if (hide) {
      document.body.classList.add('tc-ri-on', 'tc-anno-page');
      if (!document.getElementById('tc-ri-style')) riStyle();
      ensureAnnotationToolbar(ta);
      const annoRow = (ta._tcAnnoMounted || ta).closest('.row'), clRow = document.querySelector('input[name="edit-annotation.changelog"]')?.closest('.row');
      if (annoRow && clRow && clRow !== annoRow && annoRow.previousElementSibling !== clRow) annoRow.parentNode.insertBefore(clRow, annoRow);
    } else { unmountAnnotation(ta); document.body.classList.remove('tc-anno-page'); }
    // hide everything below the editor — the Edit note (the Change note already serves that role), the "Make all
    // edits votable" row, the native Preview button, and MB's formatting guide — keeping only "Enter edit".
    const annoRowEl = (ta._tcAnnoMounted || ta).closest('.row'), els = new Set();
    const fh = [...document.querySelectorAll('#content h3')].find(h => /annotation formatting/i.test(h.textContent || ''));
    if (fh) { els.add(fh); for (let n = fh.nextElementSibling; n; n = n.nextElementSibling) els.add(n); }   // the guide is the h3 + everything after it (NOT its parent, which is #content!)
    [...document.querySelectorAll('#content h2')].forEach(h => { if (/^\s*edit note\s*$/i.test((h.textContent || '').trim())) { els.add(h); let n = h.nextElementSibling; while (n && n.tagName === 'P') { els.add(n); n = n.nextElementSibling; } } });
    if (form && annoRowEl) { const kids = [...form.children], ai = kids.indexOf(annoRowEl); kids.forEach((ch, i) => { if (i > ai) els.add(ch); }); }   // everything below the editor, incl. the native buttons
    els.forEach(el => { el.style.display = hide ? 'none' : ''; });
    // our own "Enter edit" (the native one is hidden) — placed to the right of the Changelog input; just clicks
    // the native submit so MB's flow runs
    const clInput = document.querySelector('input[name="edit-annotation.changelog"]'), clRow = clInput?.closest('.row');
    let sub = document.getElementById('tc-anno-submit');
    if (hide && !sub && clInput) {
      sub = document.createElement('button'); sub.id = 'tc-anno-submit'; sub.type = 'button'; sub.textContent = '✓ Enter edit';
      sub.onclick = () => { const b = form && [...form.querySelectorAll('button, input[type=submit]')].find(x => x.id !== 'tc-anno-submit' && /enter edit/i.test((x.textContent || x.value || '').trim())); if (b) b.click(); };   // the NATIVE submit (not ourselves)
      clInput.after(sub);
    }
    if (clRow) clRow.classList.toggle('tc-cl-row', hide);
    if (sub) sub.style.display = hide ? '' : 'none';
    document.getElementById('tc-anno-fouc')?.remove();   // reveal the (now transformed) form — no native flash
    // make the editor fill the remaining viewport height (down to just above the footer)
    const w = ta._tcAnnoMounted;
    if (hide && w) {
      if (!w._tcFill) { w._tcFill = () => { if (!w.isConnected || w.classList.contains('tc-anno-max')) { w.style.height = ''; return; } w.style.height = Math.max(300, window.innerHeight - w.getBoundingClientRect().top - 18) + 'px'; }; window.addEventListener('resize', w._tcFill); }
      requestAnimationFrame(w._tcFill);
    } else if (w && w._tcFill) w.style.height = '';
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
  // #143: the help column is hidden, but MB keeps each field's native bubble populated — for the
  // entity fields (release group / label / artist) that bubble holds "You selected <a>…</a>", the
  // clickable link to the chosen entity. MB sets the focused field's bubble to inline display:block
  // even while the column is hidden, so on focus we clone that selection message into a compact,
  // on-theme popover beside the field. Generic style-guide bubbles (no entity link) stay hidden.
  let _riHelpWired = false;
  function wireHelpPopover() {
    if (_riHelpWired) return; _riHelpWired = true;
    let pop = null, hideT = null;
    const ensurePop = () => {
      if (pop && pop.isConnected) return pop;
      pop = document.createElement('div'); pop.id = 'tc-ri-help';
      pop.addEventListener('mouseenter', () => clearTimeout(hideT));   // keep open so the link is clickable
      pop.addEventListener('mouseleave', hide);
      document.body.appendChild(pop);
      return pop;
    };
    function hide() { clearTimeout(hideT); hideT = setTimeout(() => { if (pop) pop.classList.remove('on'); }, 160); }
    const showFor = (field) => {
      const doc = document.querySelector('#information > div.documentation'); if (!doc) { hide(); return; }
      // the focused field's bubble (MB flags it display:block) — only if it carries a selection link
      const bub = [...doc.querySelectorAll('.bubble')].find(b => /display:\s*block/.test(b.getAttribute('style') || '')
        && b.querySelector('a[href^="/release-group/"],a[href^="/label/"],a[href^="/artist/"]'));
      if (!bub) { hide(); return; }
      const p = ensurePop();
      p.innerHTML = bub.innerHTML;   // the rendered "You selected …" message (knockout comment nodes render as nothing)
      p.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
      const r = field.getBoundingClientRect();
      const w = Math.min(360, window.innerWidth - 16);
      // prefer to the right of the field (like MB's native bubble) so it never covers the field's own
      // autocomplete dropdown; drop below, left-aligned, when there isn't room on the right
      let left = r.right + 12, top = r.top;
      if (left + w > window.innerWidth - 8) { left = Math.min(r.left, window.innerWidth - w - 8); top = r.bottom + 6; }
      p.style.left = Math.round(Math.max(8, left)) + 'px';
      p.style.top = Math.round(top) + 'px';
      clearTimeout(hideT); p.classList.add('on');
    };
    document.addEventListener('focusin', e => {
      if (!document.body.classList.contains('tc-ri-on')) return;
      const info = document.getElementById('information'); if (!info || !info.contains(e.target)) return;
      const field = e.target.closest('input,select,textarea'); if (!field) return;
      if (field.closest('#tc-anno-wrap')) { hide(); return; }   // the annotation editor isn't an entity field — no "You selected …" bubble
      setTimeout(() => { if (document.activeElement === field) showFor(field); }, 30);   // let MB pick the bubble first
    });
    document.addEventListener('focusout', e => {
      const info = document.getElementById('information'); if (info && info.contains(e.target)) hide();
    });
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
  let _riPrevOn = false;
  function applyReleaseInfo() {
    riStyle();
    wireLinkClicks();
    wireHelpPopover();
    if (riWant()) {
      _apolloUsed = true;
      document.body.classList.add('tc-ri-on');
      relocateLinks(true);
      tidyLinkTypeOptions();
      annotateLinkEditHints();
      if (annoWant()) ensureAnnotationToolbar(); else unmountAnnotation();
      nativeHelpBubbles().forEach(b => b.classList.add('tc-ri-helphidden'));
      _riPrevOn = true;
    } else {
      relocateLinks(false);
      unmountAnnotation();   // Apollo off → tear the annotation editor down too, so the field reverts to native (the toolbar must not linger)
      document.body.classList.remove('tc-ri-on');
      document.querySelectorAll('.tc-ri-helphidden').forEach(e => e.classList.remove('tc-ri-helphidden'));
      if (_riPrevOn) { _riPrevOn = false; resetDocBubbles(); }   // one-shot on switch → drop Apollo-era bubble geometry
      watchDocBubbles();
    }
  }
  // On switching Apollo→Original, any documentation bubble still flagged display:block carries the position
  // MB computed while the column was hidden (left ~0), so it flashes mispositioned on the left until the user
  // focuses a field. Hide the leftover bubbles inline (MB's own toggle); MB re-shows + repositions on next focus. (#143)
  function resetDocBubbles() {
    const doc = document.querySelector('#information > div.documentation'); if (!doc) return;
    doc.querySelectorAll('.bubble').forEach(b => { if (/display:\s*block/.test(b.getAttribute('style') || '')) b.style.display = 'none'; });
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

  W.__apolloEditor = { readTracklist, buildModel, commitTrack, resetTrack, revertTrack, trackChanged, removeTrack, moveTrack, addTracks, searchArtist, fetchEntity, createArtist, openPanel, showMirror, hideMirror, revertAll, revertSlot, pickArtist, addSlot, removeSlot, splitSlot, matchSlot, snapshotOriginals, readRecordings, showRecMirror, hideRecMirror, recordingsVisible, recConfidence, applyView, applyNav, applyReleaseInfo, releaseInfoVisible, ensureApolloEditNote, checkAllLinks, checkUrl, linkRows, discogsReleaseUrlFromPage, loadDiscogsMap, resolveByDiscogsUrl, tagDiscogsAddable, tagDiscogsForAll, addOrCreateDiscogsLink, get apolloOn() { return apolloOn(); }, get model() { return MODEL; }, get settings() { return SETTINGS; } };

  // #267 auto-confirm a seeded Add/Edit-release submission. When another site seeds the editor,
  // MusicBrainz shows a `.confirm-seed` interstitial with a single submit button; clicking it
  // proceeds into the pre-filled editor. Behind an option (on by default), Apollo clicks it for
  // you — integrating chaban's "Auto click confirm form submission" script (greasyfork 536999).
  // Inert on a normal editor load (no `.confirm-seed`); `?skip_confirmation` bypasses it once.
  const whenDomReady = () => new Promise(r => { if (document.readyState !== 'loading') r(); else document.addEventListener('DOMContentLoaded', () => r(), { once: true }); });
  async function autoConfirmSeed() {
    await whenDomReady();
    const btn = document.querySelector('.confirm-seed button[type="submit"], form.confirm-seed button[type="submit"]');
    if (!btn) return false;                                                        // not the seed interstitial → let the normal flow run
    if (SETTINGS.autoConfirmSeed === false) { Log.info('seed interstitial — auto-confirm off'); return true; }
    if (new URLSearchParams(location.search).has('skip_confirmation')) { Log.info('seed interstitial — skip_confirmation set'); return true; }
    Log.info('auto-confirming seeded submission (#267)');
    btn.click();
    return true;                                                                   // clicked → page navigates into the editor
  }

  (async function main() {
    if (handleAutoCommit()) { Log.info('auto-commit (background create/link) — submitting the seeded form'); return; }
    if (handleArtistPageCallback()) { Log.info('artist-create callback — posting MBID back and closing'); return; }
    if (handleEditLinkClose()) { Log.info('Discogs-link edit committed — closing tab'); return; }
    if (await autoConfirmSeed()) return;   // handled the seed-confirmation interstitial (clicked, or option off) — no editor here
    if (/^\/release\/[0-9a-f-]{36}\/edit_annotation/.test(location.pathname)) {   // standalone Edit annotation page (no releaseEditor)
      const tryMount = () => { if (document.querySelector('textarea[name="edit-annotation.text"]')) { applyAnnotationPage(); return true; } return false; };
      if (!tryMount()) { const t = setInterval(() => { if (tryMount()) clearInterval(t); }, 200); setTimeout(() => clearInterval(t), 8000); }
      return;
    }
    if (!/^\/release\/(add|.+\/edit)/.test(location.pathname)) return;   // /artist/* (non-callback) just loads the channel listener
    const ed = await waitFor(() => { const e = getEditor(); try { return e && u(e.rootField.release) && u(u(e.rootField.release).mediums) ? e : null; } catch (x) { return null; } });
    if (!ed) { Log.err('MB.releaseEditor never became ready'); return; }
    try {   // line 2: the MB release, as a full link (real title now the editor is up)
      const rel = u(ed.rootField.release);
      const nm = rel ? (u(rel.name) || '') : '';
      const gid = rel ? (u(rel.gid) || '') : '';
      const mbid = gid || (location.pathname.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i) || [''])[0];
      Log.info('Release:', (nm ? nm + ' — ' : '') + (mbid ? ORIGIN + '/release/' + mbid : location.href));
    } catch (e) {}
    Log.info('editor ready');
    if (loadLogWin().open) setTimeout(() => { try { openLog(); } catch (e) {} }, 1200);   // #283 reopen the log if it was left open
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
