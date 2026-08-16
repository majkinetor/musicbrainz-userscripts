// ==UserScript==
// @name         Apollo Editor
// @namespace    https://musicbrainz.org/
// @version      2026.8.16
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the release group first, then search), one-click apply, multi-artist aware, create-on-the-fly. Same table whether floating or replacing the integrated tracklist.
// @author       majkinetor
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M13 22 L19 22 L16 30 Z' fill='%23ff8c3b'/%3E%3Cpath d='M14.4 22 L17.6 22 L16 27 Z' fill='%23ffd24a'/%3E%3Cpath d='M12 18 L8 23.5 L12 22 Z' fill='%233d2470'/%3E%3Cpath d='M20 18 L24 23.5 L20 22 Z' fill='%233d2470'/%3E%3Cpath d='M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z' fill='%235f3ec0'/%3E%3Ccircle cx='16' cy='12.5' r='3' fill='%23cfe8ff' stroke='%232a1a52' stroke-width='1'/%3E%3C/svg%3E
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
// @match        https://*.musicbrainz.org/release/add*
// @match        https://*.musicbrainz.org/release/*/edit
// @match        https://*.musicbrainz.org/*/edit_annotation
// @match        https://*.musicbrainz.org/artist/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
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
  // #501: settings persistence lives in GM storage (backed up/synced by the script
  // manager) instead of localStorage (browser-profile-only — invisible to a script
  // manager backup/restore or a move to another browser). One-time migration: if GM
  // storage is empty but an old localStorage value exists, adopt it once and write
  // through to GM storage from then on; the old localStorage key is left in place,
  // unused, so nothing is destructively deleted.
  const gmLoad = (key) => {
    try { const v = GM_getValue(key, undefined); if (v !== undefined) return v; } catch (e) {}
    try { const raw = localStorage.getItem(key); if (raw != null) { GM_setValue(key, raw); return raw; } } catch (e) {}
    return undefined;
  };
  const gmSave = (key, raw) => { try { GM_setValue(key, raw); } catch (e) {} };
  // #283 remember the log window across sessions: open?/minimized?/position
  const LOGWIN_KEY = 'apolloEditor.logwin';
  const loadLogWin = () => { try { return JSON.parse(gmLoad(LOGWIN_KEY) || '{}'); } catch (e) { return {}; } };
  const saveLogWin = (patch) => { try { gmSave(LOGWIN_KEY, JSON.stringify(Object.assign(loadLogWin(), patch))); } catch (e) {} };
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
  // #445 case-preserving fold (diacritics/dashes/whitespace normalized, CASE kept) — so casing is
  // the only discriminator when breaking a tie between several case-insensitive name/alias matches.
  const foldKeepCase = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[‐‑‒–—―−]/g, '-').replace(/\s+/g, ' ').trim();
  const sameNameCase = (a, b) => foldKeepCase(a) === foldKeepCase(b);
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
  function loadSettings() { const d = { apolloEnabled: true, colWidths: {}, applyMode: 'all', altRows: false, gridCols: false, gridRows: true, replaceReleaseInfo: true, replaceTracklist: true, replaceRecordings: true, modifyAnnotation: true, modifyDuplicates: true, autoMatch: false, autoMatchRec: false, autoMatchLabel: true, autoMatchArtist: true, discogsUrlMatch: true, recLenTol: 5, recIgnoreCase: true, recIgnorePunct: true, recTitleTol: 1, recCutoff: 'near', recDetailedHl: true, recPunctSize: 3, recHlColor: '#e53935', lastTool: '', layout: 'normal', lastView: 'apollo', zenMode: true, autoConfirmSeed: true, keepCaretColumn: true, hoverHighlight: false, srRegex: false, srTemplates: [], srSeedV: 0, srHistory: [], srDefault: '', srHistoryOpen: false }; try { const stored = JSON.parse(gmLoad(SKEY) || '{}'); const s = Object.assign(d, stored); if (stored.gridCols === undefined && stored.grid !== undefined) s.gridCols = stored.grid; return s; } catch (e) { return d; } }
  function saveSettings() { try { gmSave(SKEY, JSON.stringify(SETTINGS)); } catch (e) {} }
  let SETTINGS = loadSettings();
  try { srSeedTemplates(); } catch (e) {}   // #375 seed the default S&R templates once
  let _cfgTab = 'general';   // remembered settings tab (#294), per session
  // measure a name's pixel width so an artist input can shrink-wrap to its text (so the
  // clear × hugs the name instead of sitting at the box's far right). #284 follow-up.
  const _nmMeasCtx = (() => { try { return document.createElement('canvas').getContext('2d'); } catch (e) { return null; } })();
  const fitNmWidth = inp => {
    if (!_nmMeasCtx) return;
    const v = inp.value;
    if (!v) { inp.style.width = ''; return; }   // empty → let flex give it the full width
    _nmMeasCtx.font = '13px Arial';   // matches .tc-search .nm
    inp.style.width = (Math.ceil(_nmMeasCtx.measureText(v).width) + 5) + 'px';
  };

  // #394 any entity's standalone Edit-annotation page — /<type>/<gid>/edit_annotation (artist, recording,
  // work, event, label, release, …), not just release. The annotation editor is generic (it wraps the
  // textarea[name="edit-annotation.text"] every entity's page has).
  const ANNO_PAGE_RE = /^\/[a-z][a-z-]*\/[0-9a-f-]{36}\/edit_annotation/i;
  // FOUC guard (we run at document-start): on the standalone Edit annotation page, hide the native form until our
  // editor mounts (and removes #tc-anno-fouc), so the original interface never flashes. Skipped when off.
  if (ANNO_PAGE_RE.test(location.pathname)
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
  // #376 pending-edit state for a track's recording: {rec} if the recording itself has open edits,
  // {art} if any artist in its credit does — MB marks each with span.mp (gold).
  function recPendingState(mi, ti) {
    try {
      const ko = koTrack(mi, ti), rec = u(ko.recording);
      // #376 check the CURRENTLY-shown artist credit (the track's), not the recording's — so picking a
      // different (non-pending) artist clears the highlight. Title pending stays recording-level.
      // Only a SELECTED artist (has a gid) counts — a free-text credit with no linked entity gets no
      // highlight (majkinetor: "remove highlight when no artist is selected — it's for a previously
      // selected artist"). artGids drives the per-SLOT gold so a free-text slot beside a pending one stays clean.
      const artGids = new Set(); const ac = u(ko.artistCredit), names = ac && u(ac.names);
      if (names) for (const n of names) { const a = u(n.artist); if (a && u(a.editsPending)) { const g = u(a.gid); if (g) artGids.add(g); } }
      return { rec: rec ? !!u(rec.editsPending) : false, art: artGids.size > 0, artGids };
    } catch (e) { return null; }
  }
  // #376 a slot golds only when it's a SELECTED artist (committed, with a gid) whose entity is pending —
  // so editing a field to free text (which unselects the mbid) drops the gold on the next re-adorn.
  const slotIsPending = (artGids, slot) => !!(slot && slot.committed && slot.gid && artGids && artGids.has(slot.gid));
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
  // #442/#445: the UNIFIED exact-identity resolver — the single source of truth for a
  // confident exact match in matchSlot. Resolves a credited name to the unique MB artist
  // that carries it as an exact NAME or ALIAS (an alias is just an alternative name), and
  // accepts it ONLY when EXACTLY ONE artist across name+alias space has it. That makes the
  // check alias-AWARE like MB's own duplicate/dedup logic: a name that is ALSO another
  // artist's alias is ambiguous → declined (a candidate, not an auto-link) — the #445 fix.
  // The fast /ws/js search matchSlot uses is alias-blind, so this one /ws/2 lookup (which
  // carries aliases + matches the alias field) both catches an alias-only credit ("Don Abi"
  // → "Abiodun", #442) and enforces the unified unambiguity. Returns { entity, via } where
  // via is 'name' or 'alias' (label only), else null (ambiguous OR none). Cached per name.
  const _aliasMatchCache = new Map();
  async function resolveByExactAlias(name) {
    const key = fold(name); if (!key) return null;
    if (_aliasMatchCache.has(key)) return _aliasMatchCache.get(key);
    const q = String(name).replace(/["\\]/g, ' ').trim(); if (!q) return null;
    let arr = null;
    try { arr = await fetch(`${ORIGIN}/ws/2/artist?query=${encodeURIComponent(`alias:"${q}" OR artist:"${q}"`)}&fmt=json&limit=25`, { headers: { Accept: 'application/json' } }).then(r => r.json()); }
    catch (e) { Log.warn('alias search failed:', name, e.message); return null; }   // transient → don't cache, let a later pass retry
    const arts = (arr && arr.artists) || [];
    let exact = arts.filter(a => sameName(a.name, name) || (a.aliases || []).some(al => sameName(al.name || al, name)));
    // #445: several case-insensitive matches, but exactly ONE matches WITH case → prefer it
    // (e.g. credit "Kasane Teto" → the artist whose alias is exactly "Kasane Teto", not the one
    // merely named "kasane teto"). Case-exact beats case-fold; if it's still not unique, stay ambiguous.
    if (exact.length > 1) {
      const caseExact = exact.filter(a => sameNameCase(a.name, name) || (a.aliases || []).some(al => sameNameCase(al.name || al, name)));
      if (caseExact.length === 1) exact = caseExact;
    }
    let out = null;   // unambiguous only
    if (exact.length === 1) {
      const a = exact[0];
      // #445: distinguish a real NAME hit (the /ws/js search just under-ranked it below a
      // fuzzy look-alike) from a true ALIAS hit — so the log/badge doesn't call a name
      // match "via exact alias" (which confused, since the artist had no aliases).
      const via = sameName(a.name, name) ? 'name' : 'alias';
      const ent = await fetchEntity(a.id);
      if (ent && ent.gid) out = { entity: ent, via };
    }
    _aliasMatchCache.set(key, out);
    return out;
  }

  /* ── label auto-match (#407) ──────────────────────────────────────────────
   * The release-info Label field is seeded (from Discogs, or typed) as plain text
   * with no MBID — the single most common thing majkinetor forgets to resolve. When
   * the name has exactly ONE exact MB label, select it automatically; when it's
   * ambiguous (e.g. "Columbia" → several) or has no exact hit, leave it for a human.
   * Labels live in the KO release model — `release().labels()[i].label` is an
   * observable holding the label entity, so we set it directly (verified: this also
   * fills the #label-N input and is picked up on submit). */
  async function searchLabel(name, limit) {
    limit = limit || 8;
    const k = 'label:' + fold(name) + '|' + limit; if (!fold(name)) return [];
    if (_cache.has(k)) return _cache.get(k);
    let list = [];
    try { const j = await fetch(`${ORIGIN}/ws/js/label?q=${encodeURIComponent(name)}&limit=${limit}&direct=false`, { headers: { Accept: 'application/json' } }).then(r => r.json()); list = Array.isArray(j) ? j : (j.results || []); }
    catch (e) { Log.warn('label search failed:', name, e.message); }
    list = list.filter(c => c && (c.name || '').trim());
    _cache.set(k, list); return list;
  }
  let _labelsAutoMatchedOnce = false;
  // Resolve every still-unset release label whose name has a unique exact MB hit.
  async function matchReleaseLabels() {
    if (SETTINGS.autoMatchLabel === false) return;
    const rel = release(); if (!rel) return;
    const labels = u(rel.labels) || [];
    if (!labels.length) return;
    let linked = 0, lastName = '';
    for (const lf of labels) {
      if (!lf || typeof lf.label !== 'function') continue;
      const cur = lf.label();
      const name = cur && cur.name;
      if (!name || (cur && cur.gid)) continue;   // empty slot, or already resolved → leave it
      let hits = [];
      try { hits = await searchLabel(name); } catch (e) { Log.warn('label search failed', name, e.message); continue; }
      const exact = hits.filter(c => sameName(c.name, name));
      if (exact.length !== 1) { Log.info('Label:', name, exact.length ? ('— ' + exact.length + ' exact matches (ambiguous) — left unset') : '— no exact MB match — left unset'); continue; }
      const hit = exact[0];
      try {
        let ent = hit;
        try { if (window.MB && typeof MB.entity === 'function') ent = MB.entity(hit, 'label'); } catch (e) {}
        lf.label(ent);
        linked++; lastName = hit.name;
        Log.info('Label match:', name, '→', hit.name, '(' + hit.gid + ')');
      } catch (e) { Log.warn('label set failed', name, e.message); }
    }
    if (linked) toast(linked === 1 ? ('✓ Label matched: ' + lastName) : ('✓ Auto-matched ' + linked + ' labels'));
  }
  /* ── release-artist auto-match (#407) ─────────────────────────────────────
   * The release-info Artist field is seeded/typed as plain text with no MBID, exactly
   * like the Label field. Resolve any unset name in the release artist credit whose name
   * has a UNIQUE exact MB hit; ambiguous or no-hit names are left for a human. The full
   * entity is fetched (`/ws/js/entity/<gid>`) before writing — a lean search stub gets
   * dropped by MB on re-derive (#348). The credit lives in the KO release model, so we
   * rewrite `release().artistCredit({names})` preserving credited-as + join phrases. */
  let _artistAutoMatchedOnce = false;
  async function matchReleaseArtist() {
    if (SETTINGS.autoMatchArtist === false) return;
    const rel = release(); if (!rel || typeof rel.artistCredit !== 'function') return;
    const ac = u(rel.artistCredit); if (!ac) return;
    const names = u(ac.names) || [];
    if (!names.length) return;
    let linked = 0, lastName = '', changed = false;
    const out = [];
    for (const n of names) {
      const cur = u(n.artist);                             // artist entity {name,gid,id} or stub
      const creditedAs = u(n.name) || '';
      const joinPhrase = u(n.joinPhrase) || '';
      const nm = (cur && u(cur.name)) || creditedAs;
      let outArtist = cur;
      if (nm && !(cur && u(cur.gid))) {                    // unset (no MBID) → try to resolve
        let hits = [];
        try { hits = await searchArtist(nm); } catch (e) { Log.warn('artist search failed', nm, e.message); }
        const exact = (hits || []).filter(c => sameName(c.name, nm));
        if (exact.length === 1) {
          const ent = await fetchEntity(exact[0].gid);
          if (ent && ent.id) { outArtist = ent; linked++; lastName = ent.name; changed = true; Log.info('Artist match:', nm, '→', ent.name, '(' + ent.gid + ')'); }
          else Log.warn('artist entity fetch failed', nm);
        } else {
          Log.info('Artist:', nm, exact.length ? ('— ' + exact.length + ' exact matches (ambiguous) — left unset') : '— no exact MB match — left unset');
        }
      }
      out.push({ artist: outArtist, name: creditedAs, joinPhrase });
    }
    if (changed) { try { rel.artistCredit({ names: out }); } catch (e) { Log.warn('artist set failed', e.message); } }
    if (linked) toast(linked === 1 ? ('✓ Artist matched: ' + lastName) : ('✓ Auto-matched ' + linked + ' artists'));
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
    MODEL.tracks.forEach(t => { const row = rowEl(t.mi, t.ti); if (!row) return; const ps = recPendingState(t.mi, t.ti); const pg = ps && ps.artGids; const searches = row.querySelectorAll('.tc-search'); t.slots.forEach((s, i) => { const search = searches[i]; if (search) { adorn(search, s, search.querySelector('.nm')); search.classList.toggle('tc-slot-pending', slotIsPending(pg, s)); } }); });
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
  // NB (#428): the same list lives in credit_hoarder/src/data/special-purpose.js and
  // discogs_credits/src/data/special-purpose.js — single-file scripts can't import,
  // so keep the three copies in sync by hand.
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
      // #442: Discogs models a "feat." credit as an extraartist with a Featuring role,
      // NOT a main track artist (`t.artists`), so it never reached the by-title/by-pos
      // maps above — a feat slot split from the MB title (e.g. "Don Abi") then had no
      // Discogs URL to match on, even though the artist IS credited on Discogs and its
      // MB entry links that Discogs artist (often the split name is only an ALIAS of the
      // MB artist, making the link the only reliable bridge). Keep the featured artists
      // separately, keyed by folded title and by position, as [{ name, url }].
      map.featByPos = [];
      map.featByTitle = new Map();
      // #447: a track's performing credit on Discogs is a "Featuring" extra-artist on some
      // releases and a "Vocals" / "Backing Vocals" / "Rap" / "MC" one on others (e.g. a
      // "feat. X" in the MB title where Discogs credits X as Vocals). Capture ANY performing
      // role — vocals, rap, voice, performer, narration, choir — so those artists' Discogs
      // links are available to match a feat slot. Non-performing roles (producer, remix,
      // written-by, mixed/engineer, instruments) stay out; and matching is name-gated anyway,
      // so a captured artist only links when the slot's credited name matches it.
      const CREDIT_ROLE_RE = /feat|vocal|voice|\brap\b|\bmc\b|\bemcee\b|narrat|spoken|perform|sung|choir|chorus|chant/i;
      if (json && Array.isArray(json.tracklist)) {
        json.tracklist.filter(t => (t.type_ || 'track') === 'track').forEach(t => {
          const urls = (t.artists || []).map(a => (a && a.id) ? `https://www.discogs.com/artist/${a.id}` : null);
          map.byPos.push(urls);
          const feats = (t.extraartists || []).filter(a => a && a.id && CREDIT_ROLE_RE.test(a.role || '')).map(a => ({ name: a.name || '', url: `https://www.discogs.com/artist/${a.id}` }));
          map.featByPos.push(feats);
          const key = fold(t.title || '');
          if (key && !map.featByTitle.has(key)) map.featByTitle.set(key, feats);
          if (!key || map.has(key)) return;
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
  // #442: the Discogs "Featuring" artist URL for a feat slot split out of the title,
  // matched to the slot's credited name (Discogs credits e.g. "Don Abi", which may be
  // an ALIAS of the MB artist named "Abiodun", so the shared Discogs link is the only
  // reliable bridge — a name search alone can't confidently pick it). By folded title,
  // falling back to POSITION when titles differ but the two tracklists are equal length.
  function discogsFeatUrlFor(dmap, title, index, total, creditedAs) {
    if (!dmap || !creditedAs) return null;
    let feats = dmap.featByTitle && dmap.featByTitle.get(fold(title));
    if (!feats && dmap.featByPos && dmap.featByPos.length === total && total > 0) feats = dmap.featByPos[index];
    if (!feats || !feats.length) return null;
    const want = fold(creditedAs);
    const hit = feats.find(f => fold(f.name) === want)
             || feats.find(f => { const fn = fold(f.name); return fn && want && (fn.includes(want) || want.includes(fn)); });
    return hit ? hit.url : null;
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
  const slotStatusOf = m => !m.entity ? 'none' : (m.source === 'rg' ? 'rg' : m.source === 'cred' ? 'cred' : m.source === 'alias' ? 'alias' : (m.source === 'discogs' && m.confidence === 'high') ? 'disc' : m.confidence);

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

  async function artistDiscogsUrls(gid, force) {
    if (!gid) return [];
    if (!force && _artistRelsCache.has(gid)) return _artistRelsCache.get(gid);
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
    // #306 — special-purpose artists ([no artist], Various Artists, [Disney], …) must
    // never carry a Discogs link (some can't even be edited), so never offer to add one.
    if (SPECIAL_PURPOSE_ARTISTS.has(slot.gid)) { slot._discogsAddable = false; return; }
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
          // release-level artist POSITIONALLY (#283/#287). Strictly relArtists[i]: a
          // single release artist only fills slot 0, NOT a track's feat. guests —
          // assigning the release artist to a guest slot caused false mismatches (#287).
          const durl = durls[i] || discogsFeatUrlFor(dmap, t.title, ti, total, s.creditedAs) || (!hasTrackArtists ? (relArtists[i] || null) : null);   // #442 feat credit
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
  // #—: a distinct glyph for a Discogs "mismatch" (artist links a different page) — a circle-! so it
  // reads apart from the "conflict" triangle at a glance (and not by colour alone).
  const DISCOGS_MISMATCH_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  // after the artist's Discogs link changes (foreground return or background
  // postback): drop the stale caches and re-tag every slot crediting that artist.
  //
  // #479 (majkinetor: "it does change them, although probably due to rate limit
  // it fails to always do so"): a single artistDiscogsUrls() call right after the
  // edit landed can genuinely come back empty — not from a 429 (this hits MB's
  // internal /ws/js/entity endpoint, which the request itself already retries on
  // rate-limit), but from read-after-write lag: the edit was JUST committed, and
  // the internal endpoint's data can take a beat to catch up. artistDiscogsUrls
  // caches ANY successful response, including that stale empty one, so it and
  // every slot that reuses the cache (the tagDiscogsForAll() call right below)
  // then stay wrong until something else happens to drop the cache — the button
  // never flips to normal. Retry with force=true (bypassing the cache each time)
  // for a few seconds, since — unlike the general "does this artist have a
  // Discogs link at all" check elsewhere — we know FOR CERTAIN a write just
  // happened, so it's worth waiting for it to show up rather than accepting the
  // first answer.
  async function reTagAfterDiscogsLink(gid, url, name) {
    _discogsResolveCache.delete(url); _ddrop('resolve', url);
    const wantId = discogsIdOf(url);
    let own = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      own = await artistDiscogsUrls(gid, true);
      if (own && own.some(u => discogsIdOf(u) === wantId)) break;
      if (attempt < 5) await _sleep(800 * (attempt + 1));
    }
    if (own && own.some(u => discogsIdOf(u) === wantId)) { MODEL && MODEL.tracks.forEach(t => t.slots.forEach(s => { if (s.gid === gid) s._flash = true; })); discMsg(`added Discogs link to ${name}`); }
    else Log.warn('Discogs link for', name || gid, 'still not visible via /ws/js/entity after retrying — will keep showing as addable until the next check');
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

  // #437 — the gids of artists already known on THIS release: a slot's own split
  // co-artists (strongest) + the release artist(s). These seed the credit-based
  // disambiguation below. Capped so a wide "Various Artists" release can't fan out.
  function releaseArtistGids() {
    try { return acArtistGids(u(release().artistCredit)); } catch (e) { return []; }
  }
  function slotContextGids(entry, idx) {
    const gids = [];
    if (entry && entry.slots) entry.slots.forEach((s, j) => { if (j !== idx && s && s.gid) gids.push(s.gid); });
    releaseArtistGids().forEach(g => gids.push(g));
    return [...new Set(gids)].filter(Boolean).slice(0, 6);
  }

  // #437 — disambiguate a common name ("Joni") by CO-OCCURRENCE. A bare name search
  // is hopeless for a non-unique name, but if the release already credits a known
  // artist A (a split co-artist, or the release artist), one indexed search asks MB
  // for a recording that credits A *alongside* an artist credited as <name> — that
  // co-credited artist is a far more confident hit than a name search (majkinetor:
  // rank above 'search'). ONLY an exact credited-as / name hit counts; fuzz would
  // just reintroduce the ambiguity. Ranked by how many distinct context artists
  // produce each candidate; a lone / clear winner auto-matches, a tie is surfaced.
  const _credCache = new Map();   // `${arid}\n${fold(name)}` → [{gid,name}]
  const _lucenePhrase = s => '"' + String(s).replace(/(["\\])/g, '\\$1') + '"';
  async function resolveByCredit(creditedAs, contextGids) {
    const name = (creditedAs || '').trim();
    if (!name || !contextGids || !contextGids.length) return { entity: null, candidates: [] };
    const tally = new Map();   // candidate gid → { count, name }
    for (const ctx of contextGids) {
      const ck = ctx + '\n' + fold(name);
      let hits = _credCache.get(ck);
      if (!hits) {
        hits = [];
        try {
          const q = `arid:${ctx} AND artistname:${_lucenePhrase(name)}`;
          const r = await wsGet(`${ORIGIN}/ws/2/recording?query=${encodeURIComponent(q)}&inc=artist-credits&limit=25&fmt=json`);
          if (r && r.ok) {
            const j = await r.json();
            for (const rec of (j.recordings || [])) {
              for (const c of (rec['artist-credit'] || [])) {
                const a = c.artist; if (!a || !a.id || a.id === ctx) continue;   // the co-credited artist, not the context one
                if (sameName(c.name, name) || sameName(a.name, name)) hits.push({ gid: a.id, name: a.name });
              }
            }
          }
        } catch (e) { Log.debug('cred lookup failed', e && e.message); }
        _credCache.set(ck, hits);
      }
      // one vote per distinct context artist (dedupe repeats within its own hits)
      new Set(hits.map(h => h.gid)).forEach(gid => {
        const nm = (hits.find(h => h.gid === gid) || {}).name;
        const t = tally.get(gid) || { count: 0, name: nm }; t.count++; tally.set(gid, t);
      });
    }
    if (!tally.size) return { entity: null, candidates: [] };
    const ranked = [...tally.entries()].sort((a, b) => b[1].count - a[1].count);
    const unique = ranked.length === 1 || ranked[0][1].count > ranked[1][1].count;   // clear winner?
    const candidates = [];
    for (const [gid] of ranked) { const e = await fetchEntity(gid); if (e && e.gid) candidates.push(e); }
    return { entity: unique ? candidates[0] : null, candidates };
  }

  // #441 — pick the RG-sibling artist for a slot by NAME, not blind index. Editions
  // differ in how many artists they credit (a title that omits a co-feature — "feat.
  // Nile Rodgers" where the full credit is "feat. John Newman & Nile Rodgers" — has
  // fewer slots), so sib[i] by position grabbed the wrong artist. Prefer the positional
  // one only when its name/credited-as actually agrees; else find the sibling artist
  // whose name/credited-as matches this slot's credited name; else none (fall through).
  function pickSibArtist(sibArr, creditedAs, idx) {
    if (!Array.isArray(sibArr) || !sibArr.length) return null;
    const agrees = s => s && s.gid && (sameName(s.creditedAs, creditedAs) || sameName(s.name, creditedAs));
    const at = sibArr[idx];
    if (agrees(at)) return at;
    return sibArr.find(agrees) || null;
  }

  async function matchSlot(creditedAs, sib, discogsUrl, contextGids) {
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
      let top = candidates[0] || null;
      // #445: UNIFIED exact-identity match. An alias is just an alternative name, so name and
      // alias resolve together with ONE unambiguity check — confident (auto-committed) only
      // when EXACTLY ONE MB artist carries the credited string as its name OR an alias. This
      // is alias-AWARE (mirroring MB's own duplicate/dedup check): a name that is ALSO another
      // artist's alias is now ambiguous → a candidate, not a confident auto-link (that was the
      // old alias-BLIND name check's error surface). Only the label differs — 'via name (exact)'
      // vs 'via exact alias'. It also resolves an exact name the fast /ws/js search under-ranked
      // below a look-alike (e.g. "Tee Vee" below "Tee-vee", #445) and an alias-only credit
      // (e.g. "Don Abi" → the artist named "Abiodun", #442), neither of which /ws/js can.
      const idHit = await resolveByExactAlias(creditedAs);   // {entity, via} — unique name-or-alias, else null (ambiguous OR none)
      if (idHit && idHit.entity && idHit.entity.gid) {
        const e = idHit.entity, rest = candidates.filter(c => (c.gid || c.id) !== e.gid);
        Log.info('Match:', who, '→', e.name, idHit.via === 'alias' ? '— via exact alias' : '— via name (exact)');
        return { entity: e, source: idHit.via === 'alias' ? 'alias' : 'search', confidence: 'high', candidates: [e, ...rest] };
      }
      // #437: no unique exact identity → try credit co-occurrence against the release's known
      // artists (the common-name case). A clear winner is confident; a tie seeds the picker.
      if (contextGids && contextGids.length) {
        const cred = await resolveByCredit(creditedAs, contextGids);
        if (cred.entity) {
          Log.info('Match:', who, '→', cred.entity.name, '— via existing artist credits');
          return { entity: cred.entity, source: 'cred', confidence: 'high', candidates: [cred.entity, ...candidates.filter(c => (c.gid || c.id) !== cred.entity.gid)] };
        }
        if (cred.candidates.length) { candidates = [...cred.candidates, ...candidates.filter(c => !cred.candidates.some(e => e.gid === (c.gid || c.id)))]; top = candidates[0]; }
      }
      if (!top) return { entity: null, source: 'none', confidence: 'none', candidates: [] };
      entity = top;
      confidence = 'low';   // no unique exact identity and no co-occurrence winner → user picks
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
          const ctxGids = [...new Set(slots.map(s => s.gid).filter(Boolean).concat(releaseArtistGids()))].slice(0, 6);   // #437 co-artists so far + release artist(s)
          const dUrl = (durls && durls[i]) || discogsFeatUrlFor(dmap, t.title, ti, tl.length, n.creditedAs);   // #442 fall back to the Discogs "Featuring" credit for a feat slot
          const m = await matchSlot(n.creditedAs, sib && pickSibArtist(sib, n.creditedAs, i), dUrl, ctxGids);
          const status = slotStatusOf(m);
          const slot = { creditedAs: n.creditedAs, joinPhrase: n.joinPhrase, status, entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, committed: false };
          await tagDiscogsAddable(slot, dUrl);   // #227
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
  // #483: guarded — #472 started watching track.artistCredit individually, so
  // every ordinary commit (matching, auto-commit, a picked artist) tripped the
  // "external change" watcher too, without this.
  function commitTrack(entry) {
    const track = koTrack(entry.mi, entry.ti), live = liveNames(track);
    // #366 map each already-set slot to the live full entity by GID, NOT by position. Positional lookup
    // (live[i]) broke after a slot was removed/reordered: every later slot picked up the previous artist's
    // entity — resurrecting a just-removed artist under the next slot's credited-as and dropping the last.
    const liveByGid = new Map();
    live.forEach(n => { const a = u(n.artist); const g = a && u(a.gid); if (g && !liveByGid.has(g)) liveByGid.set(g, a); });
    _selfEdit = true;
    try {
      track.artistCredit({
        names: entry.slots.map(s => {
          if (s.status === 'set') { const a = (s.gid && liveByGid.get(s.gid)) || s.entity || { name: s.name || s.creditedAs }; return { artist: a, name: s.creditedAs, joinPhrase: s.joinPhrase }; }
          if (s.committed && s.entity) return { artist: s.entity, name: s.creditedAs, joinPhrase: s.joinPhrase };
          return { artist: { name: s.creditedAs }, name: s.creditedAs, joinPhrase: s.joinPhrase };
        })
      });
    } finally { _selfEdit = false; }
  }
  // on load, immediately write the confident matches (RG/HIGH) — that's the "no apply phase" behaviour
  function autoCommit() { MODEL.tracks.forEach(t => { let any = false; t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high' || s.status === 'disc' || s.status === 'cred' || s.status === 'alias') { s.committed = true; any = true; } }); if (any || t.slots.some(s => s.status === 'set')) commitTrack(t); }); }
  function autoCommitTrack(t) { let any = false; t.slots.forEach(s => { if (s.status === 'rg' || s.status === 'high' || s.status === 'disc' || s.status === 'cred' || s.status === 'alias') { s.committed = true; any = true; } }); if (any) commitTrack(t); }
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
          const dUrl = (durls && durls[i]) || discogsFeatUrlFor(dmap, t.title, ti, total, s.creditedAs);   // #442 fall back to the Discogs "Featuring" credit for a feat slot
          const m = await matchSlot(s.creditedAs, sib && pickSibArtist(sib, s.creditedAs, i), dUrl, slotContextGids(t, i));   // #437
          Object.assign(s, { status: slotStatusOf(m), entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates }); delete s._pending;
          await tagDiscogsAddable(s, dUrl);   // #227
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
    _selfEdit = true;
    try {
      t.artistCredit({ names: orig.names.map(o => ({ artist: o.artist, name: o.creditedAs, joinPhrase: o.joinPhrase })) });
      try { t.name(orig.title); } catch (e) {}
      try { t.number(orig.number); } catch (e) {}
      try { if (typeof t.formattedLength === 'function') t.formattedLength(orig.length); } catch (e) {}
    } finally { _selfEdit = false; }
    Log.info('reset track', entry.number, 'to original (all cells)');
  }
  let _selfEdit = false;   // true while WE mutate the tracklist, so the change-watcher ignores it
  // a medium with a CD disc ID (TOC) has a fixed track count — native MB locks adding/removing/
  // reordering its tracks. Mirror that so Apollo never silently corrupts the disc-ID association. #125
  function mediumLocked(mi) { try { const m = mediums()[mi]; return !!(m && typeof m.hasToc === 'function' && m.hasToc()); } catch (e) { return false; } }
  // #329/#330: classify a track. Pregap = position 0; data track = isDataTrack(); else audio.
  function trackKind(entry) {
    try {
      const ko = koTrack(entry.mi, entry.ti);
      if (typeof ko.position === 'function' && ko.position() === 0) return 'pregap';
      if (typeof ko.isDataTrack === 'function' && !!ko.isDataTrack()) return 'data';
    } catch (e) {}
    return 'audio';
  }
  // #329: on a disc-ID (TOC) medium the audio tracks' lengths are fixed by the TOC, so
  // native MB makes them read-only. Pregap + data tracks aren't covered by the audio TOC
  // and stay editable — mirror that for Apollo's length cells.
  function trackLenLocked(entry) { return mediumLocked(entry.mi) && trackKind(entry) === 'audio'; }
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
    // MB seeds each new track with the *previous* track's artist credit — clear it so new tracks are blank.
    // #483: this ran AFTER the _selfEdit guard above already reset to false — its own guard now.
    if (med) {
      const tks = u(med.tracks) || [];
      _selfEdit = true;
      try { for (let i = before; i < tks.length; i++) try { tks[i].artistCredit({ names: [{ artist: null, name: '', joinPhrase: '' }] }); } catch (e) {} }
      finally { _selfEdit = false; }
    }
    Log.info('added', n, 'track(s) to medium', mi + 1);
    // refresh immediately (blank tracks need no matching) instead of the 400ms watcher + match pass
    MODEL = buildShell(); if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); } rerender();
  }
  // #483: was unguarded — since #472 started watching track.name individually
  // (to catch bookmarklets editing tracks in place), every normal title edit
  // through Apollo's own mirror input ALSO tripped that watcher, scheduling a
  // full mirror rebuild ~400ms later that yanked focus wherever the user had
  // since moved it (tab/click to the next field). _selfEdit tells the watcher
  // this write is ours, same guard already used for remove/move/reset/etc.
  function setTitle(entry, v) { _selfEdit = true; try { koTrack(entry.mi, entry.ti).name(v); } finally { _selfEdit = false; } }
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
  /* ── shared corner-slot convention (#468) ───────────────────────────────
     Every floating launcher across these scripts (Apollo Editor, Art
     Station, Scribe, Falcon) tags its element with data-mb-corner (which
     screen corner) + data-mb-corner-order (priority — lower sits closest to
     the actual corner) and calls mbRestackCorner() right after it shows /
     hides / creates / removes its own element. No MutationObserver needed:
     whichever script's state just changed triggers a full recompute that
     repositions every element sharing that corner, regardless of load
     order — so two independent scripts' buttons never land on the same
     pixel. Duplicated per-script on purpose (no shared file to import).
     Apollo and Art Station share the same order (never both mount at once —
     different page types) and keep their historical closest-to-the-corner spot
     (order 10); Falcon stacks above them (order 20). */
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
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md';
  const VERSION = '2026.8.14';   // keep in sync with @version (fallback when GM_info is unavailable)
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
  const badgeText = s => ({ rg: 'rg', disc: 'disc', cred: 'cred', alias: 'alias', high: 'name', user: 'user', set: 'set', low: 'low' })[s.status] || '';
  const colW = (k, d) => (SETTINGS.colWidths && SETTINGS.colWidths[k]) || d;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  // Enter in our inputs must not bubble to MB's form (it switches tabs); commit by blurring instead
  const enterBlurs = el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); el.blur(); } });
  function rowConfidence(t) { const live = t.slots.filter(s => s.status !== 'set'); if (!live.length) return 'set'; const order = ['none', 'low', 'user', 'high', 'alias', 'cred', 'disc', 'rg']; return live.map(s => s.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]; }
  const badge = s => `<span class="tc-badge ${s}">${s === 'rg' ? 'RG' : s === 'disc' ? 'DISC' : s.toUpperCase()}</span>`;

  const css = `
    .tc-badge{font-size:10px;font-weight:bold;border-radius:9px;padding:1px 7px;color:#fff;white-space:nowrap}
    .tc-badge.rg{background:#1f8a4c}.tc-badge.set{background:#6c757d}.tc-badge.high{background:#2f6fd6}.tc-badge.disc{background:#0a7a8c}
    .tc-badge.low{background:#e0a800}.tc-badge.user{background:#6f42c1}.tc-badge.none{background:#c0392b}.tc-badge.cred{background:#b5179e}.tc-badge.alias{background:#1f8a7a}
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
    .tc-mirror input.t-len[readonly]{color:#b3b3b3;cursor:default}   /* #329: TOC-fixed length — not editable */
    .tc-mirror input.t-len[readonly]:hover,.tc-mirror input.t-len[readonly]:focus{border-color:transparent;background:transparent}
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
    .tc-mirror .t-title-disp{flex:1;min-width:0;min-height:1.55em;box-sizing:border-box;border:1px solid transparent;border-radius:3px;background:transparent;font:13px Arial;padding:3px 2px;white-space:pre;overflow:hidden;cursor:text;display:flex;align-items:center}
    .tc-mirror .t-title-ph{color:#b7b7b7;font-style:italic}   /* #357: empty-title placeholder in the rich display */
    .tc-mirror .t-title-disp:hover{border-color:#bbb;background:#fff}
    .tc-mirror .t-title-disp.diff{background:#fff6da;border-color:#e7ce8a}
    .tc-mirror .t-title-disp.gcpreview{background:#e3f6e3;border-color:#86c686}
    .tc-mirror .t-title-disp.hasfeat{background:#eaf1fb;border-color:#9bbbe0}
    .tc-mirror .t-title-disp.tc-hidden{display:none}
    /* #376 mirror MB's native gold "modification pending" mark — color ONLY the pending field
       (the title for a recording edit, the artist for an artist edit), not the whole row */
    .tc-mirror tr.tc-rec-pending td.c-title .t-title-disp,.tc-mirror tr.tc-rec-pending td.c-title input.t-title{background:#ffdd99;border-color:#e5b544}
    .tc-mirror td.c-art .tc-search.tc-slot-pending{background:#ffdd99!important;border-color:#e5b544}   /* #376 per-slot: only a selected artist with pending edits golds, never a free-text slot */
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
    .tc-cred{flex:none;width:130px;text-align:right;box-sizing:border-box;font:11px Arial;color:#1c1c1c;border:1px solid transparent;background:transparent;padding:1px 4px 1px 15px;transition:color .12s}
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
    .tc-tic.discogs-conflict{color:#c0392b;cursor:pointer;background:#fbe3e0;border-radius:4px}.tc-tic.discogs-conflict:hover{color:#96271c;background:#f6cfc9}
    .tc-tic.discogs-mismatch{color:#b26a00;cursor:pointer;background:#fdecc8;border-radius:4px}.tc-tic.discogs-mismatch:hover{color:#915700;background:#fbe0a8}
    /* one fixed-width search box per artist (so all lines align); name fills it, ＋ + join sit at the right */
    .tc-search{flex:1 1 0;min-width:0;align-self:stretch;display:flex;align-items:center;gap:4px;border:none;border-radius:4px;background:#fff;padding:0 6px;overflow:hidden;transition:box-shadow .12s}   /* unmatched = plain white; the green fill marks a match. transition: fade the #284 hover-highlight ring in/out */
    .tc-nm-clr{flex:none;display:none;align-items:center;border:none;background:none;color:#bbb;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;visibility:hidden}   /* a little bigger */
    .tc-search.tc-has-nm .tc-nm-clr{display:inline-flex}              /* a filled slot always reserves the × slot (invisible) → hover doesn't shift the text */
    .tc-search.tc-has-nm:hover .tc-nm-clr{visibility:visible}
    .tc-search.tc-has-nm .nm:not(:focus){flex:0 1 auto}              /* when not editing, size the input to the name (its size attr) so the × sits right after it. Focused stays full-width for comfortable typing */
    .tc-nm-clr:hover{color:#c0392b}
    .tc-search:focus-within{box-shadow:inset 0 0 0 1px #b9a4e0}
    .tc-search.matched{background:#e3f4e7}
    /* #284: hover-highlight every instance of the same artist (ring keeps the underlying matched/unmatched colour) */
    /* #284 hover-highlight: a soft 1px ring + faint inset wash (box-shadow, so it doesn't
       disturb the matched-green BACKGROUND), and no bold (which reflowed → the "jump").
       The base .tc-search/.tc-cred carry a short transition so it fades in AND out. */
    .tc-aslot.tc-arthl .tc-search{box-shadow:inset 0 0 0 1px #b79ee8, inset 0 0 0 100px rgba(123,79,208,.06)}
    .tc-aslot.tc-arthl .tc-cred{color:#6a4fb0}
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
    /* push ＋ to the right edge only when there's NO join-phrase; with a join, .tc-joinwrap's margin-left:auto already pushes the right-group and ＋ (order:9) follows it (two auto-margins would split the gap). #298 follow-up */
    .tc-search:not(:has(.tc-joinwrap)) .mk{margin-left:auto}
    .tc-joinwrap{flex:none;margin-left:auto;display:flex;align-items:center;gap:0}
    .tc-join{width:auto;text-align:right;border:1px solid transparent;background:transparent;color:#777;font:italic 900 12px Arial;padding:1px 2px;border-radius:3px}
    .tc-join:hover,.tc-join:focus{border-color:#bcdcc6;background:#fff;color:#444}
    /* #419: the caret needs a REAL hit target (padding-grown), not a bare 10px glyph */
    .tc-joinarrow{cursor:pointer;border:none;background:none;color:#9a8fc0;font-size:12px;padding:3px 5px;margin:-3px 0;line-height:1;border-radius:3px}
    .tc-joinarrow:hover{color:#5f3ec0;background:#ede9f6}
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
    /* #412: MusicBrainz can take a while to save a big edit — pulse the pinned Apollo bar the user
       actually presses Enter-edit on (the compact nav bar), so it's obvious the save is in flight.
       inset box-shadow tints without disturbing the bar's own background. Also covers the tracklist /
       recordings toolbars when the compact nav is off. */
    @keyframes tc-saving-pulse{0%,100%{box-shadow:inset 0 0 0 9999px rgba(28,111,214,0)}50%{box-shadow:inset 0 0 0 9999px rgba(28,111,214,.18)}}
    body.tc-saving #tc-nav-bar,body.tc-saving #tc-bar,body.tc-saving #tc-recwrap .tc-recbar{animation:tc-saving-pulse 1.1s ease-in-out infinite;border-radius:5px}
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
    /* #330: pregap/data-track toggles + row markers */
    .tc-medopts{display:inline-flex;align-items:center;gap:12px;margin-left:14px}
    .tc-medopt{display:inline-flex;align-items:center;gap:3px;font-size:12px;color:#666;cursor:pointer;white-space:nowrap}
    .tc-medopt:has(input:disabled){color:#b0b0b0;cursor:default}   /* #330: disc-ID medium — toggle shown but locked */
    .tc-trkkind{flex:none;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#5a7a45;background:#eef6e8;border:1px solid #cfe3bf;border-radius:8px;padding:0 5px;margin-right:5px}
    .tc-mirror tr.tc-row-pregap td,.tc-mirror tr.tc-row-data td{background:#f7f5fb}
    .tc-mirror tr.tc-datadiv td{background:#efeaf9;color:#5b4a86;font-size:11px;font-weight:600;letter-spacing:.04em;padding:3px 8px}
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
    .tc-icimg{height:14px;width:auto;vertical-align:-2px;display:inline-block}   /* image-based tool icon (bridged tools can ship their own) */
    .tc-mi-ic .tc-icimg{height:15px}
    .tc-tc-ic .tc-icimg{height:16px}
    .tc-tc-seg.cb-icon .tc-icimg{height:13px}
    .tc-toolbtn.instant .tc-tbic{color:#2e9b57}
    .tc-toolbtn.active .tc-tbic{color:#fff}
    .tc-toolbtn.tc-more{font-weight:bold;color:#7a68b8;border-style:dashed}
    .tc-toolopts{display:flex;align-items:center;gap:6px;min-width:0}
    .tc-gco,.tc-sro,.tc-colso,.tc-medo{display:flex;align-items:center;gap:8px}
    .tc-colso{gap:4px}
    .tc-colbtn{font:12px Arial;padding:2px 9px;border:1px solid #bbb;border-radius:4px;background:#fff;cursor:pointer;color:#333}
    /* #455 track length parser panel — centred, draggable, textarea+chooser | list */
    .tc-lppop{position:fixed;z-index:100003;background:#fff;border:1px solid #b9a4e0;border-radius:7px;box-shadow:0 8px 26px rgba(40,20,80,.28);font:12px Arial;color:#1c1c1c;width:832px;height:64vh;min-width:520px;min-height:300px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;resize:both;overflow:hidden}
    .tc-lp-hd{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #ece7f6;cursor:move;user-select:none}
    .tc-lp-back{cursor:pointer;border:1px solid #cbb9ec;background:#faf8fe;color:#5f3ec0;font:600 11px Arial;border-radius:5px;padding:3px 9px;white-space:nowrap}.tc-lp-back:hover{background:#f1ebfb;border-color:#a98fe0}
    .tc-lp-t{font:700 11px Arial;letter-spacing:.05em;text-transform:uppercase;color:#5f3ec0;flex:1}
    .tc-lp-err{font:bold 11px Arial;color:#fff;background:#e53935;border-radius:10px;padding:2px 9px;white-space:nowrap;box-shadow:0 1px 3px rgba(197,48,48,.4)}   /* #455.3 header invalid badge */
    .tc-lp-med,.tc-lp-med1{font:12px Arial;color:#444;cursor:default}
    .tc-lp-x{border:none;background:none;cursor:pointer;font-size:14px;color:#888;padding:0 2px}.tc-lp-x:hover{color:#333}
    /* body: left (textarea + chooser overlay) | list */
    .tc-lp-body{flex:1;min-height:0;display:flex;gap:8px;padding:8px 10px}
    .tc-lp-left{flex:0 0 45%;position:relative;display:flex}
    .tc-lp-ta{flex:1;resize:none;font:12px ui-monospace,Consolas,monospace;border:1px solid #cbb9ec;border-radius:5px;padding:6px 8px}
    /* chooser — overlaid on the empty textarea (#455 round 3) */
    .tc-lp-choose{position:absolute;inset:0;background:#faf8fe;border:1px solid #cbb9ec;border-radius:5px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;padding:16px}
    .tc-lp-crow{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
    .tc-lp-cbtn{cursor:pointer;border:1px solid #c3aef0;background:#fff;color:#3d2a70;font:600 13px Arial;border-radius:7px;padding:11px 16px}.tc-lp-cbtn:hover{background:#f1ebfb;border-color:#a98fe0}
    .tc-lp-clbl{font:600 12px Arial;color:#8a7fae;margin-top:6px}
    .tc-lp-favs{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;min-height:34px}
    .tc-lp-fav{width:32px;height:32px;cursor:pointer;border:1px solid #d8cdf0;border-radius:7px;padding:4px;background:#fff}.tc-lp-fav:hover{border-color:#a98fe0;background:#f1ebfb;transform:scale(1.08)}
    .tc-lp-favtxt{cursor:pointer;border:1px solid #d8cdf0;border-radius:7px;padding:6px 9px;background:#fff;font:600 11px Arial;color:#3d2a70;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tc-lp-favtxt:hover{border-color:#a98fe0;background:#f1ebfb}
    .tc-lp-favload,.tc-lp-nofav{font:12px Arial;color:#aaa;font-style:italic}
    .tc-lp-list{flex:1;min-width:0;overflow:auto;border:1px solid #eee;border-radius:5px;padding:3px}
    .tc-lp-row{display:flex;align-items:center;gap:6px;padding:2px 3px;border-radius:3px}.tc-lp-row:hover{background:#faf8fe}
    .tc-lp-tk{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;font-size:12px}
    .tc-lp-tk.none{color:#aaa;font-style:italic}
    .tc-lp-val{width:80px;font:12px ui-monospace,Consolas,monospace;text-align:right;border:1px solid #ccc;border-radius:4px;padding:2px 5px}
    .tc-lp-val.bad{border-color:#e53935;background:#fff2f2;color:#c62828}
    .tc-lp-add,.tc-lp-del{border:1px solid transparent;background:none;cursor:pointer;font-size:13px;line-height:1;border-radius:4px;padding:2px 5px}
    .tc-lp-add{color:#2e7d32}.tc-lp-add:hover{background:#eef8ee;border-color:#cdeccd}
    .tc-lp-del{color:#c0392b}.tc-lp-del:hover{background:#fdecea;border-color:#f3c6c1}
    .tc-lp-addend{display:block;width:calc(100% - 6px);margin:4px 3px 2px;border:1px dashed #cdbff0;background:#faf8fe;color:#5f3ec0;cursor:pointer;font:12px Arial;border-radius:5px;padding:5px}.tc-lp-addend:hover{background:#f1ebfb}
    .tc-lp-ft{display:flex;align-items:center;gap:10px;padding:7px 12px;border-top:1px solid #ece7f6}
    .tc-lp-cnt{flex:1;font:11px Arial;color:#777}
    .tc-lp-cnt.ok{color:#2e7d32}.tc-lp-cnt.warn{color:#b26a00}.tc-lp-cnt.bad{color:#c62828;font-weight:bold}
    .tc-lp-acts{display:flex;gap:8px}
    .tc-lp-cancel{cursor:pointer;border:1px solid #ccc;background:#fff;font:12px Arial;border-radius:4px;padding:4px 12px}
    .tc-lp-ok{cursor:pointer;border:1px solid #a9dca9;background:#f2fbf2;color:#2e7d32;font:bold 12px Arial;border-radius:4px;padding:4px 12px}.tc-lp-ok:hover:not(:disabled){background:#e6f6e6}.tc-lp-ok:disabled{opacity:.5;cursor:not-allowed}
    /* #456 pattern Track parser */
    .tc-tpppop{position:fixed;top:9vh;left:50%;transform:translateX(-50%);z-index:100003;background:#fff;border:1px solid #b9a4e0;border-radius:7px;box-shadow:0 8px 26px rgba(40,20,80,.28);font:12px Arial;color:#1c1c1c;width:920px;height:70vh;min-width:640px;min-height:340px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column;resize:both;overflow:hidden}
    .tc-tpp-hd{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #ece7f6;cursor:move;user-select:none}
    .tc-tpp-t{font:700 11px Arial;letter-spacing:.05em;text-transform:uppercase;color:#5f3ec0;flex:1}
    .tc-tpp-med,.tc-tpp-med1{font:12px Arial;color:#444}
    .tc-tpp-max{border:none;background:none;cursor:pointer;font-size:13px;color:#888;padding:0 2px}.tc-tpp-max:hover{color:#5f3ec0}
    .tc-tpp-x{border:none;background:none;cursor:pointer;font-size:14px;color:#888;padding:0 2px}.tc-tpp-x:hover{color:#333}
    .tc-tpp-pat{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #f0ebfa;flex-wrap:wrap}
    .tc-tpp-plbl{font:700 11px Arial;color:#8a7fae}
    .tc-tpp-piwrap{flex:1;min-width:160px;position:relative;display:flex}
    .tc-tpp-pi{flex:1;min-width:0;font:13px ui-monospace,Consolas,monospace;border:1px solid #cbb9ec;border-radius:5px;padding:5px 24px 5px 8px;color:#3d2a70}
    .tc-tpp-piclr{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:none;border:none;background:none;cursor:pointer;color:#b3a6d6;font-size:12px;line-height:1;padding:2px}.tc-tpp-piclr:hover{color:#c0392b}
    .tc-tpp-piwrap.has .tc-tpp-piclr{display:block}
    .tc-tpp-presets{display:flex;gap:5px;flex-wrap:wrap}
    .tc-tpp-chip{cursor:pointer;border:1px solid #d6cdec;background:#faf8fe;color:#5f3ec0;font:12px ui-monospace,Consolas,monospace;border-radius:4px;padding:3px 7px}.tc-tpp-chip:hover{background:#f1ebfb;border-color:#a98fe0}
    .tc-tpp-split{cursor:pointer;border:1px solid #d6cdec;background:#faf8fe;color:#8a7fae;font:11px Arial;border-radius:4px;padding:3px 8px;white-space:nowrap}.tc-tpp-split:hover{background:#f1ebfb;border-color:#a98fe0}.tc-tpp-split b{color:#5f3ec0}
    .tc-tpp-freeze{cursor:pointer;border:1px solid #d6cdec;background:#faf8fe;color:#5f3ec0;font:11px Arial;border-radius:4px;padding:3px 8px;white-space:nowrap}.tc-tpp-freeze:hover{background:#f1ebfb;border-color:#a98fe0}
    .tc-tpp-chipbar{position:fixed;z-index:100005;display:flex;gap:2px;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 4px 16px rgba(40,20,80,.32);padding:3px}
    .tc-tpp-chipbar button{cursor:pointer;border:1px solid #d6cdec;background:#faf8fe;color:#5f3ec0;font:bold 12px ui-monospace,Consolas,monospace;border-radius:4px;padding:3px 8px;min-width:22px}.tc-tpp-chipbar button:hover{background:#5f3ec0;color:#fff;border-color:#5f3ec0}
    .tc-tpp-chipbar button[data-clr]{color:#c0392b}.tc-tpp-chipbar button[data-clr]:hover{background:#c0392b;color:#fff;border-color:#c0392b}
    .tc-tpp-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:8px 10px}
    .tc-tpp-src{flex:0 0 auto;display:flex;flex-direction:column;gap:4px}
    .tc-tpp-srctgl{align-self:flex-start;cursor:pointer;border:none;background:none;color:#5f3ec0;font:600 11px Arial;padding:2px}.tc-tpp-srctgl:hover{color:#3d2a70;text-decoration:underline}
    .tc-tpp-src.tc-collapsed .tc-tpp-ta{display:none}
    .tc-tpp-ta{height:15vh;min-height:44px;resize:vertical;font:12px ui-monospace,Consolas,monospace;border:1px solid #cbb9ec;border-radius:5px;padding:6px 8px}
    .tc-tpp-tblwrap{flex:1;min-height:0;overflow:auto;border:1px solid #eee;border-radius:5px}
    .tc-tpp-tbl{width:100%;border-collapse:collapse;font-size:12px}
    .tc-tpp-tbl th{position:sticky;top:0;background:#f7f4fc;text-align:left;font:600 10px Arial;letter-spacing:.03em;text-transform:uppercase;color:#8a7fae;padding:4px 6px;border-bottom:1px solid #e6ddf6}
    .tc-tpp-tbl td{padding:2px 6px;border-bottom:1px solid #f3f0fa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
    .tc-tpp-tr.notrk{opacity:.5}
    .tc-tpp-dot{width:14px;padding-left:8px!important}.tc-tpp-dot span{display:inline-block;width:8px;height:8px;border-radius:50%}
    .tc-tpp-pcell{width:120px}
    .tc-tpp-ovwrap{position:relative;display:inline-flex;width:112px}
    .tc-tpp-ov{width:100%;font:11px ui-monospace,Consolas,monospace;border:1px solid #e0d8f0;border-radius:4px;padding:2px 16px 2px 5px;color:#5f3ec0;background:#fdfcff}.tc-tpp-ov:placeholder-shown{color:#bbb;border-style:dashed}
    .tc-tpp-ovclr{position:absolute;right:2px;top:50%;transform:translateY(-50%);display:none;border:none;background:none;cursor:pointer;color:#c9bde6;font-size:10px;line-height:1;padding:1px}.tc-tpp-ovclr:hover{color:#c0392b}
    .tc-tpp-ovwrap.has .tc-tpp-ovclr{display:block}
    /* #456: raw stays fully visible/selectable — no ellipsis clipping (you select spans here to bind fields).
       The td.tc-tpp-raw specificity beats the generic .tc-tpp-tbl td ellipsis rule above. */
    .tc-tpp-tbl td.tc-tpp-raw{color:#666;font:11px ui-monospace,Consolas,monospace;max-width:320px;cursor:text;user-select:text;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
    .tc-tpp-empty{color:#ccc;font-style:italic}
    .tc-tpp-c{color:#222}
    .tc-tpp-ft{display:flex;align-items:center;gap:10px;padding:7px 12px;border-top:1px solid #ece7f6}
    .tc-tpp-cnt{flex:1;font:11px Arial;color:#777}.tc-tpp-cnt.ok{color:#2e7d32}.tc-tpp-cnt.warn{color:#b26a00}
    .tc-tpp-acts{display:flex;gap:0;position:relative}
    .tc-tpp-ok{cursor:pointer;border:1px solid #a9dca9;background:#f2fbf2;color:#2e7d32;font:bold 12px Arial;border-radius:4px 0 0 4px;padding:4px 12px}.tc-tpp-ok:hover:not(:disabled){background:#e6f6e6}.tc-tpp-ok:disabled{opacity:.5;cursor:not-allowed}
    .tc-tpp-menu{cursor:pointer;border:1px solid #a9dca9;border-left:none;background:#f2fbf2;color:#2e7d32;font:bold 12px Arial;border-radius:0 4px 4px 0;padding:4px 7px}.tc-tpp-menu:hover:not(:disabled){background:#e6f6e6}.tc-tpp-menu:disabled{opacity:.5;cursor:not-allowed}
    .tc-tpp-mpop{position:absolute;bottom:calc(100% + 4px);right:0;background:#fff;border:1px solid #b9a4e0;border-radius:6px;box-shadow:0 6px 22px rgba(40,20,80,.3);padding:4px 0;min-width:200px;z-index:5}
    .tc-tpp-mi{display:block;width:100%;text-align:left;border:none;background:none;cursor:pointer;font:12px Arial;color:#333;padding:6px 12px}.tc-tpp-mi:hover{background:#f1ebfb;color:#5f3ec0}
    .tc-tpp-mhr{height:1px;background:#eee;margin:4px 0}
    .tc-colbtn:hover{background:#f0ecfa;border-color:#a98fe0}
    /* #152/#375: Search & Replace — RE toggle, search caret, invalid-regex flag, Saved & History popup */
    .tc-srbtn{cursor:pointer;border:1px solid #d6cdec;background:#fff;color:#6f42c1;font:bold 11px Arial;border-radius:4px;padding:3px 8px;white-space:nowrap}
    .tc-srbtn:hover{background:#efeaf9;border-color:#bcaae6}
    .tc-srbtn.on{background:#6f42c1;color:#fff;border-color:#5f3ec0}
    .tc-sr-find.tc-sr-bad{border-color:#d6342c!important;background:#fff1f0}
    /* #409 chain mode — the read-only chain chip replaces the search/replace inputs */
    .tc-sro-chain .tc-sr-find,.tc-sro-chain .tc-sr-rep,.tc-sro-chain .tc-sr-re{display:none}
    .tc-sr-chainchip{display:none;align-items:center;gap:6px;border:1px solid #c9b8ee;background:#f6f2fe;border-radius:4px;padding:3px 6px 3px 9px;color:#5f3ec0;font:bold 12px Arial;white-space:nowrap}
    .tc-sro-chain .tc-sr-chainchip{display:inline-flex}
    .tc-sr-chainx{border:none;background:none;color:#9a7fd0;cursor:pointer;font-size:12px;line-height:1;padding:0 2px}
    .tc-sr-chainx:hover{color:#c0392b}
    .tc-sr-star{color:#e0a800;font-size:13px;line-height:1;padding:3px 8px}   /* #375 fav-star button opens Saved & History */
    .tc-sr-star:hover{color:#c69500;background:#fff8e6;border-color:#e6cf8a}
    .tc-srtpl{position:fixed;z-index:100003;background:#fff;border:1px solid #b9a4e0;border-radius:7px;box-shadow:0 8px 26px rgba(40,20,80,.28);font:12px Arial;color:#1c1c1c;min-width:460px;max-width:680px;max-height:70vh;overflow:auto}
    .tc-srtpl-hd{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #ece7f6;position:sticky;top:0;background:#fff;z-index:1}
    .tc-srtpl-hdt{font:700 11px Arial;letter-spacing:.05em;text-transform:uppercase;color:#5f3ec0}
    .tc-srtpl-savebtn{cursor:pointer;border:1px solid #cdeccd;background:#f2fbf2;color:#2e7d32;font:bold 11px Arial;border-radius:4px;padding:3px 9px;white-space:nowrap}
    .tc-srtpl-savebtn:hover{background:#e6f6e6;border-color:#a9dca9}
    .tc-srtpl-savewrap{display:flex;align-items:center;gap:6px;flex:1}
    .tc-srtpl-saveok{cursor:pointer;border:1px solid #cdeccd;background:#f2fbf2;color:#2e7d32;font:bold 12px Arial;border-radius:4px;padding:2px 8px}
    .tc-srtpl-saveok:hover{background:#e6f6e6}
    /* #409 redesign: Import/Export button pinned right; JSON textarea; section headers right-aligned */
    .tc-srtpl-iobtn{margin-left:auto;cursor:pointer;border:1px solid #d6cdec;background:#fff;color:#5f3ec0;font:600 11px Arial;border-radius:4px;padding:3px 10px;white-space:nowrap}
    .tc-srtpl-iobtn:hover{background:#f0ebfb;border-color:#bcaae6}
    .tc-srtpl-impok{margin-left:auto}
    .tc-srtpl-io{width:calc(100% - 24px);margin:10px 12px;min-height:260px;box-sizing:border-box;border:1px solid #d6cdec;border-radius:4px;padding:8px;font:12px ui-monospace,Consolas,Menlo,monospace;color:#333;resize:vertical}
    .tc-srtpl-io:focus{outline:none;border-color:#8a72c8}
    .tc-srtpl-empty{padding:12px;color:#999;font-style:italic}
    .tc-srtpl-sec{font:700 10px Arial;letter-spacing:.05em;text-transform:uppercase;color:#9a8fb5;background:#faf8ff;padding:5px 12px;border-top:1px solid #ece7f6;border-bottom:1px solid #f0ebfa;text-align:right}
    .tc-srtpl-sectog:hover{color:#6f42c1;background:#f3eefb}
    .tc-srtpl-caret{display:inline-block;color:#b9a4e0;font-size:9px}
    .tc-srtpl-row{display:grid;grid-template-columns:1.1fr 1.4fr 1.4fr 24px 82px;align-items:center;gap:8px;padding:5px 12px;cursor:pointer;border-bottom:1px solid #f4f0fc}
    .tc-srtpl-defrow{background:#fffaef}
    .tc-srtpl-def{visibility:hidden;border:none;background:none;color:#c9bde6;cursor:pointer;font-size:12px;padding:0;line-height:1}
    .tc-srtpl-row:hover .tc-srtpl-def,.tc-srtpl-row.tc-srtpl-sel .tc-srtpl-def{visibility:visible}.tc-srtpl-def:hover{color:#e8a800}
    .tc-srtpl-def.on{visibility:visible;color:#e8a800}
    .tc-srtpl-row:hover,.tc-srtpl-row.tc-srtpl-sel{background:#f0ebfb}
    .tc-srtpl-nm{font-weight:600;color:#4b3a82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tc-srtpl-f,.tc-srtpl-r{font-family:ui-monospace,Consolas,'Liberation Mono',Menlo,monospace;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}   /* #375: curly quotes render cleanly (Courier New mangled them) */
    .tc-srtpl-re{font:bold 10px Arial;color:#6f42c1;text-align:center}
    .tc-srtpl-tail{display:inline-flex;gap:5px;align-items:center;justify-content:flex-end}
    .tc-srtpl-x{visibility:hidden;border:none;background:none;color:#cc6699;cursor:pointer;font-size:12px;padding:0;line-height:1}
    .tc-srtpl-row:hover .tc-srtpl-x,.tc-srtpl-row.tc-srtpl-sel .tc-srtpl-x{visibility:visible}.tc-srtpl-x:hover{color:#c0392b}
    /* #409 chains */
    .tc-srtpl-chainadd{visibility:hidden;border:none;background:none;color:#7d4fd0;cursor:pointer;font-size:12px;padding:0;line-height:1}
    .tc-srtpl-row:hover .tc-srtpl-chainadd,.tc-srtpl-row.tc-srtpl-sel .tc-srtpl-chainadd{visibility:visible}.tc-srtpl-chainadd:hover{color:#5f3ec0}
    .tc-srtpl-rename{visibility:hidden;border:none;background:none;color:#7d4fd0;cursor:pointer;font-size:12px;padding:0;line-height:1}
    .tc-srtpl-row:hover .tc-srtpl-rename,.tc-srtpl-row.tc-srtpl-sel .tc-srtpl-rename{visibility:visible}.tc-srtpl-rename:hover{color:#5f3ec0}
    .tc-srtpl-renameinp{width:100%;box-sizing:border-box;border:1px solid #8a72c8;border-radius:3px;padding:1px 5px;font:600 12px Arial;color:#4b3a82}
    .tc-srtpl-renameinp:focus{outline:none;border-color:#6f42c1}
    .tc-srtpl-chnm{color:#5f3ec0}
    .tc-srtpl-chm{font-family:Arial !important;color:#8a7bb0 !important;font-style:italic}
    .tc-srtpl-cpick{position:absolute;z-index:5;background:#fff;border:1px solid #c9b8ee;border-radius:6px;box-shadow:0 6px 18px rgba(40,20,80,.22);padding:4px;min-width:130px}
    .tc-srtpl-cpick-row{padding:4px 9px;cursor:pointer;border-radius:4px;color:#4b3a82;white-space:nowrap}
    .tc-srtpl-cpick-row:hover{background:#f0ebfb}
    .tc-srtpl-cpick-empty{padding:6px 9px;color:#999;font-style:italic;white-space:nowrap}
    .tc-srtpl-name{flex:1;min-width:120px;box-sizing:border-box;border:1px solid #d6cdec;border-radius:4px;padding:3px 7px;font:13px Arial}
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
    .tc-tc-grab{color:#b3a3dd;cursor:grab;font-size:15px;line-height:1;flex:none;user-select:none}   /* same ⠿ grip as the tracklist drag handle (.tc-drag) */
    .tc-tc-grab:hover{color:#5f3ec0}.tc-tc-grab:active{cursor:grabbing}
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
    /* #294 tabbed config: one short pane at a time instead of one tall column */
    #tc-settings .tc-tabs{display:flex;gap:2px;margin:0 0 8px;border-bottom:1px solid #e3dcf2}
    #tc-settings .tc-tab-btn{flex:1;font:600 12px Arial;color:#888;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;padding:5px 4px 7px;cursor:pointer}
    #tc-settings .tc-tab-btn:hover{color:#5f3ec0}
    #tc-settings .tc-tab-btn.active{color:#563b8f;border-bottom-color:#7d4fd0}
    #tc-settings .tc-tab-pane{display:flow-root}   /* #407: contain child margins so the pinned height captures the full box (constant dialog height across tabs) */
    #tc-settings .tc-tab-pane[hidden]{display:none}
    #tc-settings .tc-tab-pane .tc-s-top{margin-top:0}
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
      <div class="tc-tabs" role="tablist">
        <button type="button" class="tc-tab-btn" data-tab="general">General</button>
        <button type="button" class="tc-tab-btn" data-tab="matching">Matching</button>
        <button type="button" class="tc-tab-btn" data-tab="appearance">Appearance</button>
      </div>
      <div class="tc-tab-pane" data-pane="general">
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
      </div>
      <div class="tc-tab-pane" data-pane="matching" hidden>
        <div class="tc-s-group">
          <div class="tc-s-sub">Auto-match on start</div>
          <div class="tc-s-group">
            <div class="tc-s-row" style="gap:14px"><label class="tc-s-rad" title="Tracklist tab: match track artists to MusicBrainz on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatch"> Tracklist</label><label class="tc-s-rad" title="Recordings tab: auto-match unset recordings on load. Off: use the Match button."><input type="checkbox" id="tc-s-automatchrec"> Recordings</label><label class="tc-s-rad" title="Release-info Label field: when the seeded/typed label name has exactly one exact MusicBrainz match, select it automatically on load. Ambiguous names (e.g. Columbia) are left for you to pick."><input type="checkbox" id="tc-s-automatchlabel"> Label</label><label class="tc-s-rad" title="Release-info Artist field: when the seeded/typed release artist has exactly one exact MusicBrainz match, select it automatically on load. Ambiguous names are left for you to pick."><input type="checkbox" id="tc-s-automatchartist"> Artist</label></div>
            <label title="When the release has a Discogs link, match each track artist by its Discogs URL (a strong, human-verified signal) before the name search. A single linked MusicBrainz artist is used directly; several are offered as candidates."><input type="checkbox" id="tc-s-discogsmatch"> <span>Discogs artist link matching</span></label>
          </div>
          <div class="tc-s-sub">Recording</div>
          <div class="tc-s-group">
            <div class="tc-s-row lentol" title="A length difference up to this many seconds counts as a match (not a length mismatch)."><span>Length tolerance</span><input type="number" id="tc-s-lentol" min="0" max="60" step="1"> <span>seconds</span></div>
            <div class="tc-s-row lentol" title="Allow up to this many differing characters in the title (edit distance) and still count it as a match. 0 = exact."><span>Title tolerance</span><input type="number" id="tc-s-titletol" min="0" max="20" step="1"> <span>characters</span></div>
            <label title="Treat a case / accent / spacing-only difference in title or artist as a match (recommended)."><input type="checkbox" id="tc-s-ignorecase"> <span>Ignore casing</span></label>
            <label title="Ignore punctuation &amp; symbols in titles/artists (&amp; → and, brackets, quotes, dashes, dots…)."><input type="checkbox" id="tc-s-ignorepunct"> <span>Ignore punctuation</span></label>
            <div class="tc-s-row" style="gap:8px"><label title="Highlight the exact differing characters in a mismatching title (instead of the whole field), and shade a length mismatch by how large the gap is."><input type="checkbox" id="tc-s-detailhl"> <span>Enable detailed highlighting</span></label><input type="color" id="tc-s-hlcolor" title="Highlight colour — the differing characters and the length-mismatch shading"></div>
          </div>
        </div>
      </div>
      <div class="tc-tab-pane" data-pane="appearance" hidden>
        <div class="tc-s-group">
          <div class="tc-s-row"><span>Row layout</span><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="compact"> compact</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="normal"> normal</label><label class="tc-s-rad"><input type="radio" name="tc-s-layout" value="cozy"> cozy</label></div>
          <label><input type="checkbox" id="tc-s-alt"> <span>Alternate row colors</span></label>
          <div class="tc-s-row"><span>Show grid</span><label class="tc-s-rad" title="vertical column separators"><input type="checkbox" id="tc-s-gridcols"> columns</label><label class="tc-s-rad" title="horizontal lines between tracks"><input type="checkbox" id="tc-s-gridrows"> rows</label></div>
          <div class="tc-s-row" title="In the detailed-highlight diff, enlarge a differing punctuation / confusable / invisible character (straight vs curly quote, hyphen vs dash, no-break space…) by this many pixels so look-alikes are obvious. 0 = no enlargement (hover tooltip still names the character)."><span>Enlarge punctuation by</span><input type="number" id="tc-s-punctsize" min="0" max="12" step="1"> <span>px (0 = no enlargement)</span></div>
          <label title="Moving between tracklist cells with ↑ / ↓ / Enter keeps the text caret at the same column (clamped to the field's length) so you can fix casing or edit in place. Off: select the whole field on arrival (so the next keystroke overwrites it)."><input type="checkbox" id="tc-s-keepcaret"> <span>Keep caret position on row navigation</span></label>
          <label title="When you hover an artist in the tracklist, highlight every other slot where that same artist appears (#284). Off by default."><input type="checkbox" id="tc-s-hoverhl"> <span>Highlight all instances of an artist on hover</span></label>
        </div>
      </div>`;
    document.body.appendChild(s);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 60, right: 60, bottom: 80 };
    // keep it fully on-screen — right-align to the gear if it would overflow (uses the real width), and
    // clamp/scroll vertically so a tall dialog never runs off the bottom (#119). Re-run on each tab
    // switch since panes differ in height.
    const maxH = window.innerHeight - 16; s.style.maxHeight = maxH + 'px'; s.style.overflowY = 'auto';
    const place = () => {
      s.style.left = Math.max(8, Math.min(r.right - s.offsetWidth, window.innerWidth - s.offsetWidth - 10)) + 'px';
      const h = Math.min(s.offsetHeight, maxH); let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
      s.style.top = top + 'px';
    };
    // tabs: show one pane at a time so the panel stays short (#294)
    const tabBtns = s.querySelectorAll('.tc-tab-btn'), panes = s.querySelectorAll('.tc-tab-pane');
    // #407: pin every pane to the TALLEST pane's height so the dialog keeps a constant
    // height as you switch tabs (it used to grow/shrink, which was jumpy). Show all panes
    // at once and take the max — run in a rAF so the read happens after layout has settled
    // (a synchronous read right after append under-measured the tallest pane by a few px).
    const pinPaneHeight = () => {
      const prev = [...panes].map(p => p.hidden);
      panes.forEach(p => { p.style.minHeight = ''; p.hidden = false; });   // reveal all, unpinned
      let max = 0;
      panes.forEach(p => { if (p.offsetHeight > max) max = p.offsetHeight; });
      panes.forEach((p, i) => { p.hidden = prev[i]; p.style.minHeight = max + 'px'; });
      place();   // re-anchor now the constant height is known
    };
    const showTab = name => { _cfgTab = name; tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name)); panes.forEach(p => { p.hidden = p.dataset.pane !== name; }); place(); };
    tabBtns.forEach(b => b.onclick = () => showTab(b.dataset.tab));
    showTab(_cfgTab);
    requestAnimationFrame(pinPaneHeight);
    const am = s.querySelector('#tc-s-automatch'), amRec = s.querySelector('#tc-s-automatchrec'), amLbl = s.querySelector('#tc-s-automatchlabel'), amArt = s.querySelector('#tc-s-automatchartist'), alt = s.querySelector('#tc-s-alt'), gridcols = s.querySelector('#tc-s-gridcols'), gridrows = s.querySelector('#tc-s-gridrows');
    am.checked = SETTINGS.autoMatch !== false; amRec.checked = !!SETTINGS.autoMatchRec; amLbl.checked = SETTINGS.autoMatchLabel !== false; amArt.checked = SETTINGS.autoMatchArtist !== false; alt.checked = !!SETTINGS.altRows; gridcols.checked = !!SETTINGS.gridCols; gridrows.checked = SETTINGS.gridRows !== false;
    const curLayout = SETTINGS.layout || 'normal';
    s.querySelectorAll('input[name="tc-s-layout"]').forEach(rb => { rb.checked = rb.value === curLayout; rb.onchange = () => { if (rb.checked) { SETTINGS.layout = rb.value; saveSettings(); applyViewClasses(); } }; });
    am.onchange = () => { SETTINGS.autoMatch = am.checked; saveSettings(); };
    amRec.onchange = () => { SETTINGS.autoMatchRec = amRec.checked; saveSettings(); };
    amLbl.onchange = () => { SETTINGS.autoMatchLabel = amLbl.checked; saveSettings(); };
    amArt.onchange = () => { SETTINGS.autoMatchArtist = amArt.checked; saveSettings(); };
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
    const hoverhl = s.querySelector('#tc-s-hoverhl');
    if (hoverhl) { hoverhl.checked = !!SETTINGS.hoverHighlight; hoverhl.onchange = () => { SETTINGS.hoverHighlight = hoverhl.checked; saveSettings(); if (!hoverhl.checked) { _hlCur = null; document.querySelectorAll('.tc-aslot.tc-arthl').forEach(e => e.classList.remove('tc-arthl')); } }; }
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
  const rerender = () => { _hlCur = null; if (ACTIVE.sections) ACTIVE.sections.forEach(s => fillRows(s.tbody, s.mi)); else if (ACTIVE.tbody) fillRows(ACTIVE.tbody); refreshStatus(); };
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
  // #330: per-medium "Pregap" / "Data track" checkboxes that drive MB's writable medium
  // observables hasPregap()/hasDataTracks() (the same thing native MB's buttons do), then
  // rebuild so the new/removed track shows. Returns a <span> or null (locked / no medium).
  // Deep data-section editing (its own Add-track, bounded reorder) intentionally stays native.
  function mediumOpts(target) {
    if (target == null) return null;
    const med = mediums()[target]; if (!med) return null;
    // #330: show the toggles on EVERY medium and keep them ENABLED even on a disc-ID medium.
    // Pregap/data tracks live outside the audio TOC (the same reason their lengths stay editable,
    // #329), and native MB leaves these controls enabled there too.
    const opts = document.createElement('span'); opts.className = 'tc-medopts';
    const mkOpt = (label, prop, help) => {
      const lbl = document.createElement('label'); lbl.className = 'tc-medopt'; lbl.title = help;
      const cb = document.createElement('input'); cb.type = 'checkbox';
      try { cb.checked = typeof med[prop] === 'function' && !!med[prop](); } catch (e) {}
      cb.onchange = () => {
        _selfEdit = true;
        try { med[prop](cb.checked); } catch (e) { Log.warn(`${label} toggle failed`, e.message); }
        finally { _selfEdit = false; }
        Log.info(`medium ${target + 1}: ${label} ${cb.checked ? 'added' : 'removed'}`);
        MODEL = buildShell(); if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); } rerender();
      };
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode(' ' + label));
      return lbl;
    };
    opts.appendChild(mkOpt('Pregap', 'hasPregap', 'Add / remove a hidden pregap track (position 0)'));
    opts.appendChild(mkOpt('Data track', 'hasDataTracks', 'Add / remove a trailing data track (for several, use the native editor)'));
    return opts;
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
    // Footer per medium: "Add N track(s)" (only when the medium can take new tracks —
    // a disc-ID medium has a fixed track count, #125) PLUS the pregap/data toggles. The
    // toggles render even on a locked medium (disabled, #330), so every medium shows them.
    // In the combined multi-medium view the toggles live on each medium header instead
    // (see fillRows), so only attach them to this footer for a per-medium section or a
    // single-medium release.
    const target = (mi == null) ? Math.max(0, mediums().length - 1) : mi;
    const canAdd = !mediumLocked(target);
    const opts = (mi != null || mediums().length <= 1) ? mediumOpts(target) : null;
    if (canAdd || opts) {
      const addrow = document.createElement('div'); addrow.className = 'tc-addrow';
      if (canAdd) {
        addrow.innerHTML = `Add <input type="number" class="tc-addn" min="1" value="1"> track(s) <button class="tc-addbtn" title="add blank tracks">＋</button>`;
        const addn = addrow.querySelector('.tc-addn'), addbtn = addrow.querySelector('.tc-addbtn');
        addbtn.onclick = () => addTracks(target, Math.max(1, parseInt(addn.value, 10) || 1));
      }
      if (opts) addrow.appendChild(opts);
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
    noteDisamb(c.gid, c.comment);   // #450: cache the disambiguation — a created / pasted-MBID pick never went through search (where it's cached), so the table showed no comment
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
    else { const sib = (await loadSiblingMap()).get(fold(entry.title)); const durls = (await loadDiscogsMap())?.get(fold(entry.title)); const m = await matchSlot(on.creditedAs, sib && pickSibArtist(sib, on.creditedAs, i), durls && durls[i], slotContextGids(slot._entry, i)); Object.assign(slot, { status: slotStatusOf(m), entity: m.entity, gid: m.entity ? m.entity.gid : null, name: m.entity ? m.entity.name : '', candidates: m.candidates, committed: false }); await tagDiscogsAddable(slot, durls && durls[i]); }
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
    const dis = slot.committed ? (getDisamb(slot.gid) || (slot.entity && slot.entity.comment) || '') : '';   // #450 entity fallback (created/pasted picks)
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
      if (!dhMark()) return;   // #443: gated by detailed highlighting, not the px size
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
    const commit = () => { editCredit(entry, () => { slot.joinPhrase = inp.value; }, 'join phrase', false); markJoin(); if (refreshBadges) refreshBadges(); };
    inp.oninput = () => { fit(); markJoin(); if (inp.value.trim()) open(inp.value); else close(); };   // #419: typing filters the presets live
    inp.onchange = () => { commit(); };
    const arrow = document.createElement('button'); arrow.className = 'tc-joinarrow'; arrow.textContent = '▾'; arrow.title = 'common join phrases (type to filter · ↑↓ + Enter)';
    // #419: keyboard-first presets — typing filters ("fe" → feat. / featuring), ArrowDown
    // opens/moves, Enter picks the highlighted row, Esc closes; same keys on the ▾ button.
    let pop = null, items = [], hi = -1;
    const close = () => { if (pop) { pop.remove(); pop = null; hi = -1; } };
    const pick = v => { inp.value = v; fit(); commit(); close(); };
    const paint = () => {
      pop.innerHTML = items.map((o, i) => `<div class="tc-acrow${i === hi ? ' hi' : ''}" data-i="${i}"><span class="nm">${esc(o.label)}</span><span class="cmt">"${esc(o.value)}"</span></div>`).join('');
      [...pop.querySelectorAll('[data-i]')].forEach(row => { row.onmousedown = e => { e.preventDefault(); pick(items[+row.dataset.i].value); }; });
    };
    const open = q => {
      const needle = String(q || '').trim().toLowerCase();
      items = needle ? JOIN_OPTIONS.filter(o => o.label.toLowerCase().includes(needle) || o.value.trim().toLowerCase().includes(needle)) : JOIN_OPTIONS.slice();
      if (!items.length) { close(); return; }
      if (!pop) {
        pop = document.createElement('div'); pop.className = 'tc-acpop tc-joinpop';
        document.body.appendChild(pop);
        const r = inp.getBoundingClientRect(); pop.style.left = Math.max(4, r.right - 150) + 'px'; pop.style.top = (r.bottom + 4) + 'px'; pop.style.minWidth = '150px';
        const off = e => { if (!pop) { document.removeEventListener('mousedown', off); return; } if (!pop.contains(e.target) && e.target !== arrow && e.target !== inp) { close(); document.removeEventListener('mousedown', off); } };
        setTimeout(() => document.addEventListener('mousedown', off), 0);
      }
      hi = needle ? 0 : -1;   // typing pre-highlights the top hit so Enter picks it straight away
      paint();
    };
    const keys = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); if (!pop) open(inp.value); else { hi = (hi + 1) % items.length; paint(); } }
      else if (e.key === 'ArrowUp') { if (!pop) return; e.preventDefault(); e.stopPropagation(); hi = (hi - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Enter') {
        if (!pop && e.currentTarget === arrow) return;             // let the button's native click open the menu
        // Enter must never reach MB's form (it switches tabs) — same contract enterBlurs had
        e.preventDefault(); e.stopPropagation();
        if (pop && hi >= 0 && items[hi]) pick(items[hi].value); else { close(); inp.blur(); }
      }
      else if (e.key === 'Escape') { if (pop) { e.preventDefault(); e.stopPropagation(); close(); } }
    };
    inp.addEventListener('keydown', keys);
    arrow.addEventListener('keydown', keys);
    inp.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== arrow) close(); }, 120));   // Tab away closes (row picks keep focus via preventDefault)
    arrow.onclick = () => { if (pop) close(); else open(''); };
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

  // #284: hovering an artist highlights every OTHER instance of that same artist in
  // the tracklist (matched by gid when resolved, else by the typed/credited name) —
  // the same idea as the green "matched" bars, but live on hover. STICKY: the last
  // highlighted artist stays lit even when the mouse isn't over it; moving onto a
  // DIFFERENT real artist clears the previous highlight (and lights the new one up if
  // it appears more than once). Only empty slots / gaps keep the previous highlight —
  // so moving the mouse across rows/gaps never flickers, but landing on another artist
  // (even a one-off) drops the stale highlight.
  function hlArtist(id) {
    if (!SETTINGS.hoverHighlight) return;   // #284: opt-in (Appearance setting, off by default)
    if (!id || id === 'n:' || id === 'g:' || id === _hlCur) return;   // empty slot or already current → keep current
    _hlCur = id;
    document.querySelectorAll('.tc-aslot.tc-arthl').forEach(e => e.classList.remove('tc-arthl'));
    const matches = [...document.querySelectorAll('.tc-aslot')].filter(e => e.dataset.art === id);
    if (matches.length > 1) matches.forEach(e => e.classList.add('tc-arthl'));   // single instance → nothing to show
  }
  let _hlCur = null;
  const slotArtId = s => (s.committed && s.gid) ? 'g:' + s.gid : 'n:' + fold(s.creditedAs || s.name || s.query || '');
  // one artist = one aligned line: [credited-as][icon][green/white search bar][join][↵ hover][✕ hover]
  function slotEl(entry, s, idx, refreshBadges) {
    const line = document.createElement('div'); line.className = 'tc-aslot';
    line.dataset.art = slotArtId(s);
    line.addEventListener('mouseenter', () => hlArtist(line.dataset.art));
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
      // conflict (URL belongs to a different MB artist) → red triangle; mismatch (artist links a
      // different Discogs page) → amber circle-! ; conflict wins the icon when both are flagged.
      const warnCls = conf ? 'discogs-conflict' : 'discogs-mismatch', warnSvg = conf ? DISCOGS_WARN_SVG : DISCOGS_MISMATCH_SVG;
      ic = document.createElement('a'); ic.className = 'tc-tic ' + ((conf || mism) ? warnCls : 'discogs-add'); ic.href = '#'; ic.innerHTML = (conf || mism) ? warnSvg : DISCOGS_LINK_SVG;
      ic.title = discAddTooltip(s);
      ic.title += '  ·  right-click: do it silently in a background tab';
      ic.onmousedown = e => e.preventDefault();
      ic.onclick = e => { e.preventDefault(); addOrCreateDiscogsLink(s); };
      ic.oncontextmenu = e => { e.preventDefault(); addOrCreateDiscogsLink(s, true); };   // #273 background
    } else if (s._discogsConflict) {
      // unresolved slot whose Discogs URL already belongs to an MB artist — info only (pick that artist)
      ic = document.createElement('a'); ic.className = 'tc-tic discogs-conflict'; ic.innerHTML = DISCOGS_WARN_SVG;
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
    // size the input to its text (so the clear × hugs the name when not editing — #284 follow-up);
    // `size` is in characters, close enough. Min 2 keeps a clicked-but-empty field usable.
    const updNmClr = () => { const v = inp.value.trim(); search.classList.toggle('tc-has-nm', !!v); fitNmWidth(inp); };
    nmClr.onmousedown = e => e.preventDefault();
    nmClr.onclick = () => { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); updNmClr(); };
    inp.addEventListener('input', updNmClr);
    search.appendChild(nmClr); updNmClr();
    if (idx < entry.slots.length - 1) search.appendChild(joinControl(entry, s, refreshBadges));   // join lives inside the box, right side
    // #376 keep the pending gold in sync with the slot's selected/committed state on every re-adorn —
    // editing the field to free text (unselecting the mbid) must drop the gold, not just the green.
    const applyPend = () => { const ps = recPendingState(entry.mi, entry.ti); search.classList.toggle('tc-slot-pending', slotIsPending(ps && ps.artGids, s)); };
    adorn(search, s, inp); applyPend(); if (s._marked) search.classList.add('tc-marked'); if (s._flash) { search.classList.add('tc-flash'); delete s._flash; } line.appendChild(search);
    wireAutocomplete(inp, s, () => { adorn(search, s, inp); applyPend(); refreshBadges(); refreshStatus(); });
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
    tbody.innerHTML = ''; let lastMi = -1, lastDataMi = -1; const multi = mediums().length > 1 && mi == null;
    const tracks = (mi == null) ? MODEL.tracks : MODEL.tracks.filter(t => t.mi === mi);
    tracks.forEach(t => {
      if (multi && t.mi !== lastMi) { const r = document.createElement('tr'); const td = document.createElement('td'); td.className = 'tc-medhdr'; td.colSpan = COLS.length; td.textContent = `Medium ${t.mi + 1}`; const o = mediumOpts(t.mi); if (o) td.appendChild(o); r.appendChild(td); tbody.appendChild(r); lastMi = t.mi; }   // #330: per-medium pregap/data toggles in the combined view
      const kind = trackKind(t);   // #330: pregap / data / audio
      if (kind === 'data' && t.mi !== lastDataMi) { const dr = document.createElement('tr'); dr.className = 'tc-datadiv'; dr.innerHTML = `<td colspan="${COLS.length}">⤓ Data tracks</td>`; tbody.appendChild(dr); lastDataMi = t.mi; }
      const tr = document.createElement('tr'); tr.dataset.tk = t.mi + ':' + t.ti; tr.dataset.mi = t.mi; tr.dataset.ti = t.ti;
      if (kind !== 'audio') tr.classList.add(kind === 'pregap' ? 'tc-row-pregap' : 'tc-row-data');
      // #376 mirror MB's native "modification pending" mark (span.mp): flag recordings that have open edits
      const ps = recPendingState(t.mi, t.ti);
      if (ps && (ps.rec || ps.art)) { if (ps.rec) tr.classList.add('tc-rec-pending'); if (ps.art) tr.classList.add('tc-art-pending'); tr.title = ps.rec && ps.art ? 'Recording and artist have pending edits' : ps.rec ? 'This recording has pending edits' : 'This recording’s artist has pending edits'; }
      const locked = mediumLocked(t.mi);   // disc-ID medium: no reorder handle (#125)
      const lenLocked = trackLenLocked(t); // disc-ID medium: audio-track length fixed by the TOC (#329)
      const canDrag = !locked && kind === 'audio';   // #330: pregap is pinned at 0, data tracks aren't reordered here
      tr.innerHTML = `<td class="c-mv">${canDrag ? '<span class="tc-drag" draggable="true" title="drag to reorder within this medium">⠿</span>' : ''}</td>
        <td class="c-num"><input class="t-num" value="${esc(t.number)}" title="track number"></td>
        <td class="c-title"><div class="t-wrap">${kind === 'pregap' ? '<span class="tc-trkkind" title="Hidden pregap track (position 0)">pregap</span>' : ''}<input class="t-title" value="${esc(t.title)}" placeholder="title…"></div></td>
        <td class="c-art"></td>
        <td class="c-len"><input class="t-len" value="${esc(t.length)}"${lenLocked ? ' readonly tabindex="-1" title="Length is fixed by this medium’s Disc ID"' : ''}></td>
        <td class="c-badge"></td>`;
      const badgeCell = tr.querySelector('.c-badge'); const refreshBadges = () => renderBadgeCell(badgeCell, t);
      const art = tr.querySelector('.c-art'); const pgids = ps && ps.artGids;   // #376 gold ONLY the slot(s) whose SELECTED artist has pending edits — not free-text neighbours, and not a field edited to free text
      t.slots.forEach((s, si) => { const se = slotEl(t, s, si, refreshBadges); const sr = se.querySelector('.tc-search'); if (sr) sr.classList.toggle('tc-slot-pending', slotIsPending(pgids, s)); art.appendChild(se); });
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
          const v = val != null ? val : tin.value;
          // empty title → a faint "title…" placeholder so there's a visible, full-height
          // click target (an empty disp collapses to a hard-to-hit thin line). #357
          disp.innerHTML = v ? dhRun(v) : '<span class="t-title-ph">title…</span>';
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
      if (!lenLocked) lenIn.onchange = e => {
        let v = e.target.value.trim();
        if (v) { const ed = getEditor(); const ms = ed && ed.utils && ed.utils.unformatTrackLength ? ed.utils.unformatTrackLength(v) : NaN; if (ms == null || isNaN(ms)) v = ''; }   // invalid (letters/garbage) → delete; valid shorthand like "111" is kept (MB normalizes it to 1:11)
        setLength(t, v);
        try { const ko = koTrack(t.mi, t.ti); const norm = typeof ko.formattedLength === 'function' ? (u(ko.formattedLength()) || '') : v; e.target.value = norm; t.length = norm; } catch (err) { e.target.value = v; t.length = v; }   // reflect MB's normalized value back into the cell immediately
        refreshBadges();
      }; wireRowNav(lenIn);
      if (canDrag) wireDragReorder(tr, t);   // #330: don't make pregap/data rows drag sources or drop targets
      tbody.appendChild(tr);
    });
  }
  async function loadAndRender(onProgress) {
    MODEL = buildShell();
    if (ACTIVE.mode === 'mirror') { mountMediums(); syncNative(); }   // (re)build per-medium tables + hide/tidy native
    rerender();   // show the tables instantly
    if (SETTINGS.autoMatch !== false) await matchModel(onProgress); else { updateStatus('auto-match off — click Match'); tagDiscogsForAll(); }   // #227: tag 'set' artists even when not matching
    enrichResolvedAliases();   // batch-fetch aliases for resolved artists (existing releases too)
    // #407: resolve an unset release label to its unique exact MB hit — once, independent of the
    // tracklist auto-match toggle (the label lives in the release-info model, not the tracklist).
    if (!_labelsAutoMatchedOnce) { _labelsAutoMatchedOnce = true; matchReleaseLabels().catch(e => Log.warn('label auto-match failed', e.message)); }
    if (!_artistAutoMatchedOnce) { _artistAutoMatchedOnce = true; matchReleaseArtist().catch(e => Log.warn('artist auto-match failed', e.message)); }
    srApplyDefaultOnStart();   // #410: run the marked default S&R once, now the tracklist is rendered
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
  /* ── #456 pattern Track parser ─────────────────────────────────────────────
   * MB's native parser is rigid, so we roll our own. A one-line PATTERN describes
   * a tracklist line; we compile it to a regex and run every pasted line through
   * it, filling only the fields the pattern declares. Tokens: # T A L M (+ _ skip),
   * $X explicit, X[slice] positional (1-based; ~ = from end); separators match any
   * of a list (- – — / :); literals are literal; whitespace is elastic; text fields
   * are lazy (split-on-first) except the last which is greedy. Engine is unit-tested
   * in test/pattern-engine.test.mjs — keep the two in sync. */
  const TP_FIELDS = { '#': 'pos', 'T': 'title', 'A': 'artist', 'L': 'length', 'M': 'medium' };
  const TP_DUR = '\\d{1,2}:\\d{2}(?::\\d{2})?';
  // #520 (majkinetor, live): "The pattern that worked is `#. A ‐ T - _ (L)`,
  // however, using `-` as separator doesn't work." His source used U+2010
  // HYPHEN (‐) between artist and title — visually a hyphen, but a different
  // codepoint from plain ASCII `-` (U+002D). Typing the literal ‐ in the
  // pattern happened to match by coincidence; the natural, easiest-to-type
  // `-` didn't, because U+2010 wasn't in the separator class it expands to.
  // Adding it here means any of these separator KINDS in the pattern now
  // matches any of them in the source, same as en/em dash already do.
  const TP_SEPS = ['-', '‐', '–', '—', '/', ':'];
  const TP_PRESETS = ['#. T', '#. T - A (L)', '# T L', '# A - T', '# A - T (L)', 'T L'];   // #. T - A (L) = the native parser's format
  let _tpPattern = '#. T';   // remembered across opens this session
  const tpEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tpUsable = out => !!out && Object.values(out).some(v => v && String(v).trim());
  function tpTokenize(pattern, seps) {
    const segs = [], sepSet = new Set(seps);
    const isFieldLetter = c => c === '#' || c === 'M' || c === 'T' || c === 'A' || c === 'L';
    const readSlice = (str, i) => {
      if (str[i] !== '[') return null;
      const close = str.indexOf(']', i); if (close < 0) return null;
      const inner = str.slice(i + 1, close); let m;
      // colon form [FROM:TO] — FROM is a numeric position (~ = from end) OR a literal char to start
      // AFTER; TO is a literal char to stop BEFORE (empty = to end). e.g. #[1:.] (pos 1 → first dot),
      // L[(:)] (first "(" → first ")"), both excluding the delimiters. A leading ~ on a CHAR (not a
      // position) means the LAST occurrence of that char, not the first — e.g. L[~(:)] for a title
      // that has its own "(...)" before the real "(length)" (#456).
      const colon = inner.indexOf(':');
      if (colon >= 0) {
        let left = inner.slice(0, colon); const hadTilde = left[0] === '~'; if (hadTilde) left = left.slice(1);
        let toDelim = inner.slice(colon + 1); const toLast = toDelim[0] === '~'; if (toLast) toDelim = toDelim.slice(1);
        const slice = /^\d*$/.test(left)
          ? { a: left === '' ? null : parseInt(left, 10), fromEnd: hadTilde, toDelim, toLast }   // numeric position (~ = from end)
          : { fromDelim: left, fromLast: hadTilde, toDelim, toLast };                             // literal char (~ = last occurrence)
        return { slice, next: close + 1 };
      }
      // dash form [a-b] / [a] — numeric char range (1-based inclusive; ~ = from the end)
      if ((m = /^(~?)(\d*)(-?)(\d*)$/.exec(inner))) { const a = m[2] === '' ? null : parseInt(m[2], 10), b = m[4] === '' ? null : parseInt(m[4], 10); return { slice: m[3] === '-' ? { a, b, fromEnd: m[1] === '~' } : { a, b: a, fromEnd: m[1] === '~' }, next: close + 1 }; }
      return null;
    };
    for (let i = 0; i < pattern.length;) {
      const c = pattern[i];
      if (c === '$') {
        const letter = pattern[i + 1];
        if (isFieldLetter(letter)) { const sl = readSlice(pattern, i + 2); segs.push({ kind: 'field', field: TP_FIELDS[letter], slice: sl ? sl.slice : null }); i = sl ? sl.next : i + 2; continue; }
        segs.push({ kind: 'lit', text: '$' }); i++; continue;
      }
      if (c === '_') { segs.push({ kind: 'skip' }); i++; continue; }
      if (isFieldLetter(c)) {
        const letterish = ch => ch && /[A-Za-z]/.test(ch);
        if (!(letterish(pattern[i - 1]) || (c !== '#' && letterish(pattern[i + 1])))) {
          const sl = readSlice(pattern, i + 1); segs.push({ kind: 'field', field: TP_FIELDS[c], slice: sl ? sl.slice : null }); i = sl ? sl.next : i + 1; continue;
        }
      }
      if (sepSet.has(c)) { segs.push({ kind: 'sep' }); i++; continue; }
      if (/\s/.test(c)) { let j = i; while (j < pattern.length && /\s/.test(pattern[j])) j++; segs.push({ kind: 'ws' }); i = j; continue; }
      segs.push({ kind: 'lit', text: c }); i++;
    }
    return segs;
  }
  function tpCompile(pattern, opts = {}) {
    const seps = opts.separators || TP_SEPS;
    const segs = tpTokenize(pattern, seps);
    const fieldSegs = segs.filter(s => s.kind === 'field');
    const fields = new Set(fieldSegs.map(s => s.field));
    const sliced = fieldSegs.filter(s => s.slice);
    const sepClass = '(?:' + seps.map(tpEsc).join('|') + ')';
    if (fieldSegs.length > 0 && sliced.length === fieldSegs.length) {   // slice-mode (all fields positional)
      return { fields, exec(line) {
        const s = String(line), out = {};
        for (const seg of fieldSegs) {
          const { a, b, fromEnd, fromDelim, fromLast, toDelim, toLast } = seg.slice; let start, end;
          if (fromDelim != null) { const fi = fromDelim === '' ? 0 : (fromLast ? s.lastIndexOf(fromDelim) : s.indexOf(fromDelim)); if (fi < 0) { out[seg.field] = ''; continue; } start = fi + fromDelim.length; }
          else if (fromEnd) start = a == null ? 0 : s.length - a;
          else start = (a == null ? 1 : a) - 1;
          start = Math.max(0, start);
          if (toDelim != null) { let ti; if (toDelim === '') ti = -1; else if (toLast) { ti = s.lastIndexOf(toDelim); if (ti < start) ti = -1; } else ti = s.indexOf(toDelim, start); end = ti < 0 ? s.length : ti; }
          else if (fromEnd) end = b == null ? s.length : s.length - b + 1;
          else end = b == null ? s.length : b;
          out[seg.field] = s.slice(start, Math.max(start, end)).trim();
        }
        return tpUsable(out) ? out : null;
      } };
    }
    // one text field is greedy so the split lands on the FIRST separator (default) — or the LAST
    // one when splitLast is on (#456 v2 ‹first|last› toggle): then the FIRST text field is greedy.
    const textSegs = fieldSegs.filter(s => s.field === 'title' || s.field === 'artist');
    const greedyText = opts.splitLast ? textSegs[0] : textSegs[textSegs.length - 1];
    let re = '^\\s*';
    for (const seg of segs) {
      if (seg.kind === 'ws') re += '\\s+';
      else if (seg.kind === 'lit') re += /\s/.test(seg.text) ? '\\s+' : tpEsc(seg.text);
      else if (seg.kind === 'sep') re += '\\s*' + sepClass + '\\s*';
      else if (seg.kind === 'skip') re += '.*?';
      else if (seg.kind === 'field') {
        const f = seg.field;
        if (seg.slice && (seg.slice.toDelim != null || seg.slice.fromDelim != null)) {
          const sl = seg.slice;
          // skip to fromDelim: lazy .*? = first occurrence, greedy .* = last (~) — mirrors slice-mode's indexOf/lastIndexOf
          re += (sl.fromDelim ? (sl.fromLast ? '.*' : '.*?') + tpEsc(sl.fromDelim) : '') + (sl.toDelim ? (sl.toLast ? '(.+)' : '(.+?)') + tpEsc(sl.toDelim) : '(.+)');
        }   // X[from:to] in flow: skip-to-fromDelim, capture, toDelim
        else if (f === 'pos') re += '([A-Za-z]?\\d+(?:[-.]\\d+)?)';
        else if (f === 'medium') re += '(\\d+)';
        else if (f === 'length') re += '(' + TP_DUR + ')';
        else re += seg === greedyText ? '(.+)' : '(.+?)';
      }
    }
    re += '\\s*$';
    const rx = new RegExp(re), order = fieldSegs.map(s => s.field);
    return { fields, exec(line) {
      const m = rx.exec(String(line).trim()); if (!m) return null;
      const out = {}; order.forEach((f, i) => { out[f] = (m[i + 1] || '').trim(); });
      return tpUsable(out) ? out : null;
    } };
  }

  function openParser(mi) { const ed = getEditor(), m = mediums()[mi]; if (!m) return; try { ed.openTrackParser(m); } catch (e) { Log.warn('open parser failed', e.message); } }

  function openTrackPatternParser(mi) {
    document.getElementById('tc-tpppop')?.remove();
    let curMi = (mi != null ? mi : toolMedium());
    _tpPattern = '#. T - A (L)';   // #456: open like the native parser — prefilled current tracklist in this format
    let rows = [];         // [{ raw, override }]
    let _splitLast = false;   // #456 v2 ‹first|last›: which separator instance a text field splits on
    const tracks = () => u(mediums()[curMi].tracks) || [];
    const trackTitle = i => { const t = tracks()[i]; return t ? (u(t.name) || '') : ''; };
    // the current medium's tracklist rendered in the #. T - A (L) format, to seed the paste box
    const acStr = t => (liveNames(t) || []).map(n => (u(n.name) || (u(n.artist) && u(u(n.artist).name)) || '') + (u(n.joinPhrase) || '')).join('').trim();
    const currentText = () => tracks().map((t, i) => { const num = u(t.number) || (i + 1); const title = u(t.name) || ''; const artist = acStr(t); const len = u(t.formattedLength) || ''; return `${num}. ${title}` + (artist ? ` - ${artist}` : '') + (len ? ` (${len})` : ''); }).join('\n');
    const compiled = new Map();   // pattern+mode → compiled (cached)
    const compileFor = ov => { const key = (_splitLast ? 'L\x01' : 'F\x01') + (ov || _tpPattern); if (!compiled.has(key)) { try { compiled.set(key, tpCompile(ov || _tpPattern, { separators: TP_SEPS, splitLast: _splitLast })); } catch (e) { compiled.set(key, null); } } return compiled.get(key); };
    const parseRow = r => { const c = compileFor(r.override && r.override.trim()); try { return c ? c.exec(r.raw) : null; } catch (e) { return null; } };

    const p = document.createElement('div'); p.id = 'tc-tpppop'; p.className = 'tc-tpppop';
    const medSel = mediums().length > 1
      ? `<select class="tc-tpp-med">${mediums().map((m, i) => `<option value="${i}"${i === curMi ? ' selected' : ''}>Medium ${i + 1}</option>`).join('')}</select>`
      : `<span class="tc-tpp-med1">Medium ${curMi + 1}</span>`;
    p.innerHTML = `
      <div class="tc-tpp-hd"><span class="tc-tpp-t">Pattern parser</span>${medSel}<button type="button" class="tc-tpp-max" title="Maximize / restore">⛶</button><button type="button" class="tc-tpp-x" title="Close (Esc)">✕</button></div>
      <div class="tc-tpp-pat">
        <span class="tc-tpp-plbl">Pattern</span>
        <span class="tc-tpp-piwrap"><input type="text" class="tc-tpp-pi" spellcheck="false" value="${esc(_tpPattern)}" title="# pos · T title · A artist · L length · M medium · _ skip · \$X explicit · X[a-b] slice · X[a:.] up to a char · X[~a:.] from the LAST occurrence"><button type="button" class="tc-tpp-piclr" title="Clear pattern" tabindex="-1">✕</button></span>
        <button type="button" class="tc-tpp-freeze" title="Lock this pattern onto every still-«default» row that already matches it, so a later pattern change won't affect them — then try a new pattern on what's left">🔒 Freeze matched</button>
        <span class="tc-tpp-presets">${TP_PRESETS.map(x => `<button type="button" class="tc-tpp-chip" data-p="${esc(x)}">${esc(x)}</button>`).join('')}</span>
        <button type="button" class="tc-tpp-split" title="Which separator a text field splits on when it repeats (A - T on 'a - b - c')">split: <b>first</b></button>
      </div>
      <div class="tc-tpp-body">
        <div class="tc-tpp-src">
          <button type="button" class="tc-tpp-srctgl" title="Show / hide the paste box">▾ Paste tracklist</button>
          <textarea class="tc-tpp-ta" spellcheck="false" placeholder="Paste the tracklist — one track per line"></textarea>
        </div>
        <div class="tc-tpp-tblwrap"><table class="tc-tpp-tbl"><thead><tr><th></th><th>pattern</th><th>raw</th><th>#</th><th>artist</th><th>title</th><th>length</th></tr></thead><tbody></tbody></table></div>
      </div>
      <div class="tc-tpp-ft"><span class="tc-tpp-cnt"></span><span class="tc-tpp-acts"><button type="button" class="tc-tpp-ok" disabled>Apply</button><button type="button" class="tc-tpp-menu" title="Apply options" disabled>▾</button></span></div>`;
    document.body.appendChild(p);
    const $ = s => p.querySelector(s);
    const ta = $('.tc-tpp-ta'), tbody = $('.tc-tpp-tbl tbody'), patIn = $('.tc-tpp-pi');
    const src = $('.tc-tpp-src'), srctgl = $('.tc-tpp-srctgl');
    // #456: the paste box only seeds the rows, so fold it away once there's content (the raw
    // column keeps the source visible); the caret toggles it back to re-paste/edit.
    const setSrc = collapsed => { src.classList.toggle('tc-collapsed', collapsed); const n = rows.length; srctgl.textContent = (collapsed ? '▸ ' : '▾ ') + (collapsed && n ? `Paste tracklist (${n} line${n !== 1 ? 's' : ''})` : 'Paste tracklist'); };
    const close = () => { p.remove(); chipBar.remove(); document.removeEventListener('mousedown', outsideHide, true); };

    function syncRows() {
      const lines = ta.value.split('\n');
      // keep overrides aligned to line index across edits
      rows = lines.map((raw, i) => ({ raw, override: (rows[i] && rows[i].override) || '' }))
        .filter((r, i) => !(i === lines.length - 1 && r.raw.trim() === '' && lines.length > 1));
    }
    const DOT = { exact: '#2e7d32', over: '#b26a00', none: '#c62828' };
    function render() {
      const nT = tracks().length;
      tbody.innerHTML = '';
      rows.forEach((r, i) => {
        const parsed = parseRow(r);
        const state = !parsed ? 'none' : (r.override && r.override.trim() ? 'over' : 'exact');
        const tr = document.createElement('tr'); tr.className = 'tc-tpp-tr' + (i >= nT ? ' notrk' : '');
        const cell = v => `<td class="tc-tpp-c" title="${esc(v || '')}">${esc(v || '')}</td>`;
        tr.innerHTML = `<td class="tc-tpp-dot"><span style="background:${DOT[state]}" title="${state === 'none' ? 'no match — adjust the pattern' : state === 'over' ? 'matched via a per-row pattern' : 'matched'}"></span></td>`
          + `<td class="tc-tpp-pcell"><span class="tc-tpp-ovwrap${r.override ? ' has' : ''}"><input class="tc-tpp-ov" spellcheck="false" placeholder="«default»" value="${esc(r.override || '')}"><button type="button" class="tc-tpp-ovclr" title="Clear this row’s pattern" tabindex="-1">✕</button></span></td>`
          + `<td class="tc-tpp-raw" title="${esc(r.raw)}">${esc(r.raw) || '<span class="tc-tpp-empty">(empty)</span>'}</td>`
          + cell(parsed && parsed.pos) + cell(parsed && parsed.artist) + cell(parsed && parsed.title) + cell(parsed && parsed.length);
        const ov = tr.querySelector('.tc-tpp-ov'), ovwrap = tr.querySelector('.tc-tpp-ovwrap');
        ov.oninput = () => { r.override = ov.value; ovwrap.classList.toggle('has', !!ov.value); const pr = parseRow(r); const st = !pr ? 'none' : (r.override.trim() ? 'over' : 'exact'); tr.querySelector('.tc-tpp-dot span').style.background = DOT[st]; const cells = tr.querySelectorAll('.tc-tpp-c'); [pr && pr.pos, pr && pr.artist, pr && pr.title, pr && pr.length].forEach((v, k) => { cells[k].textContent = v || ''; cells[k].title = v || ''; }); refreshFoot(); };
        tr.querySelector('.tc-tpp-ovclr').onclick = () => { r.override = ''; render(); };
        tbody.appendChild(tr);
      });
      refreshFoot();
    }
    function stats() {
      const nT = tracks().length; let matched = 0, unmatched = 0;
      rows.forEach(r => { if (r.raw.trim() === '') return; parseRow(r) ? matched++ : unmatched++; });
      return { nT, matched, unmatched, n: matched + unmatched };
    }
    function refreshFoot() {
      const s = stats(), cnt = $('.tc-tpp-cnt'), ok = $('.tc-tpp-ok'), menu = $('.tc-tpp-menu');
      cnt.className = 'tc-tpp-cnt' + (s.unmatched ? ' warn' : s.matched ? ' ok' : '');
      cnt.textContent = !s.n ? `${s.nT} track${s.nT !== 1 ? 's' : ''} in Medium ${curMi + 1} — paste a tracklist`
        : `${s.matched} matched · ${s.unmatched} unmatched  →  ${s.nT} track${s.nT !== 1 ? 's' : ''}` + (s.n > s.nT ? ` (+${s.n - s.nT} would need new tracks)` : '');
      ok.disabled = menu.disabled = !s.matched;
      ok.textContent = `Apply ${Math.min(s.matched, s.nT)} → Medium ${curMi + 1}`;
    }
    // Apply captured fields (only the ones each row's pattern produced) to tracks in row order.
    function apply(which, addMissing) {
      const s = stats();
      if (addMissing && s.n > s.nT) addTracks(curMi, s.n - s.nT);
      const nT = tracks().length; let wrote = 0;
      _selfEdit = true;   // #483: bulk-apply is our own write, and rebuild(true) below already does the one resync it needs
      try {
        rows.forEach((r, i) => {
          if (i >= nT) return; const pr = parseRow(r); if (!pr) return;
          const entry = { mi: curMi, ti: i };
          if ((which === 'all' || which === 'title') && pr.title != null && pr.title !== '') setTitle(entry, pr.title);
          if ((which === 'all' || which === 'artist') && pr.artist != null && pr.artist !== '') { try { koTrack(curMi, i).artistCredit({ names: [{ artist: null, name: pr.artist, joinPhrase: '' }] }); } catch (e) { Log.warn('set artist failed', e.message); } }
          if ((which === 'all' || which === 'length') && pr.length && lpValid(pr.length)) setLength(entry, pr.length);
          if ((which === 'all' || which === 'pos') && pr.pos != null && pr.pos !== '') setNumber(entry, pr.pos);
          wrote++;
        });
      } finally { _selfEdit = false; }
      rebuild(true);
      Log.info('track parser: applied', which, 'from pattern', JSON.stringify(_tpPattern), 'to', wrote, 'row(s) on medium', curMi + 1);
      toast(`Applied ${wrote} row${wrote !== 1 ? 's' : ''} to Medium ${curMi + 1}`);
      close();
    }
    function openMenu() {
      p.querySelector('.tc-tpp-mpop')?.remove();
      const s = stats(); const m = document.createElement('div'); m.className = 'tc-tpp-mpop';
      const item = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-tpp-mi'; b.textContent = label; b.onclick = () => { m.remove(); fn(); }; return b; };
      m.append(item('Only titles', () => apply('title', false)), item('Only artists', () => apply('artist', false)), item('Only lengths', () => apply('length', false)), item('Only track #s', () => apply('pos', false)));
      if (s.n > s.nT) { const hr = document.createElement('div'); hr.className = 'tc-tpp-mhr'; m.append(hr, item(`Add ${s.n - s.nT} track${s.n - s.nT !== 1 ? 's' : ''}, then apply all`, () => apply('all', true))); }
      $('.tc-tpp-acts').appendChild(m);
      const off = e => { if (!m.contains(e.target) && !e.target.closest('.tc-tpp-menu')) { m.remove(); document.removeEventListener('mousedown', off, true); } };
      setTimeout(() => document.addEventListener('mousedown', off, true), 0);
    }

    ta.oninput = () => { syncRows(); render(); };
    ta.onblur = () => { if (ta.value.trim()) setSrc(true); };   // fold away once seeded
    srctgl.onclick = () => { const collapse = !src.classList.contains('tc-collapsed'); setSrc(collapse); if (!collapse) ta.focus(); };
    const piwrap = $('.tc-tpp-piwrap');
    const syncClr = () => piwrap.classList.toggle('has', !!patIn.value);   // #456 show the clear-✕ only when there's a pattern to clear
    patIn.oninput = () => { _tpPattern = patIn.value; compiled.clear(); syncClr(); render(); };
    $('.tc-tpp-piclr').onclick = () => { patIn.value = ''; _tpPattern = ''; compiled.clear(); syncClr(); render(); patIn.focus(); };
    syncClr();
    p.querySelectorAll('.tc-tpp-chip').forEach(c => c.onclick = () => { patIn.value = c.dataset.p; _tpPattern = c.dataset.p; compiled.clear(); syncClr(); render(); patIn.focus(); });
    $('.tc-tpp-split').onclick = () => { _splitLast = !_splitLast; $('.tc-tpp-split').innerHTML = 'split: <b>' + (_splitLast ? 'last' : 'first') + '</b>'; render(); };
    // #456 round 5 — iterative refinement: lock the CURRENT pattern onto every row that's still on
    // «default» and already matches, so trying a new pattern afterward only affects what's left.
    // Repeat with a different pattern until every row is solved.
    $('.tc-tpp-freeze').onclick = () => {
      let n = 0;
      rows.forEach(r => { if (r.override && r.override.trim()) return; if (parseRow(r)) { r.override = _tpPattern; n++; } });
      render();
      toast(n ? `Froze ${n} matched row${n !== 1 ? 's' : ''} to this pattern` : 'No still-default rows match this pattern');
    };

    /* #456 v2 — interactive fix: select a span in a raw cell → a chip bar pops above it to bind
     * that span to a field for THAT row, writing a slice into its pattern cell (T[a-b], …). */
    const FIELD_CHIPS = [['#', 'pos'], ['A', 'artist'], ['T', 'title'], ['L', 'length']];
    const chipBar = document.createElement('div'); chipBar.className = 'tc-tpp-chipbar'; chipBar.style.display = 'none';
    chipBar.innerHTML = FIELD_CHIPS.map(([g, f]) => `<button type="button" data-f="${f}" data-g="${g}" title="Bind the selection to ${f}">${g}</button>`).join('') + '<button type="button" data-clr="1" title="Clear this row’s pattern">✕</button>';
    document.body.appendChild(chipBar);   // on body, not the modal — the modal's transform would otherwise re-base position:fixed (#456)
    let _selCtx = null;   // { rowIdx, a, b } — 1-based inclusive char range in the raw text
    const hideChips = () => { chipBar.style.display = 'none'; _selCtx = null; };
    // char offsets of the current selection within a raw cell (the cell text == the row's raw)
    function rawSelection() {
      const sel = window.getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
      const range = sel.getRangeAt(0);
      const cell = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('.tc-tpp-raw');
      if (!cell || !cell.contains(range.endContainer)) return null;
      const tr = cell.closest('tr'); const rowIdx = tr ? [...tbody.children].indexOf(tr) : -1;
      if (rowIdx < 0) return null;
      const pre = document.createRange(); pre.selectNodeContents(cell); pre.setEnd(range.startContainer, range.startOffset);
      const start = pre.toString().length, len = range.toString().length;
      if (!len) return null;
      return { rowIdx, a: start + 1, b: start + len, rect: range.getBoundingClientRect() };   // 1-based inclusive
    }
    tbody.addEventListener('mouseup', () => setTimeout(() => {
      const s = rawSelection();
      if (!s) { hideChips(); return; }
      _selCtx = s;
      chipBar.style.display = 'flex';
      const bw = chipBar.offsetWidth || 160;
      chipBar.style.left = Math.max(6, Math.min(s.rect.left + s.rect.width / 2 - bw / 2, innerWidth - bw - 6)) + 'px';
      chipBar.style.top = Math.max(6, s.rect.top - chipBar.offsetHeight - 6) + 'px';
    }, 0));
    // set/replace a field's slice in a row's override (overrides built this way are pure slice-mode)
    function bindSlice(row, letter, a, b) {
      const esc2 = letter === '#' ? '\\#' : letter;
      let ov = (row.override || '').replace(new RegExp('\\$?' + esc2 + '\\[[^\\]]*\\]\\s*', 'g'), '').replace(/\s+/g, ' ').trim();
      row.override = (ov ? ov + ' ' : '') + letter + '[' + a + '-' + b + ']';
    }
    chipBar.addEventListener('mousedown', e => e.preventDefault());   // keep the text selection alive through the click
    chipBar.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (!_selCtx) return; const row = rows[_selCtx.rowIdx]; if (!row) return;
      if (b.dataset.clr) row.override = '';
      else bindSlice(row, b.dataset.g, _selCtx.a, _selCtx.b);
      hideChips(); window.getSelection()?.removeAllRanges(); render();
    });
    const outsideHide = e => { if (!chipBar.contains(e.target) && !e.target.closest('.tc-tpp-raw')) hideChips(); };
    document.addEventListener('mousedown', outsideHide, true);   // removed in close()

    $('.tc-tpp-ok').onclick = () => apply('all', false);
    $('.tc-tpp-menu').onclick = openMenu;
    $('.tc-tpp-x').onclick = close;
    let _maxed = false, _prevBox = null;   // maximize toggle: fill the viewport, restore to the prior box
    $('.tc-tpp-max').onclick = () => {
      const btn = $('.tc-tpp-max');
      if (!_maxed) { _prevBox = { left: p.style.left, top: p.style.top, width: p.style.width, height: p.style.height, transform: p.style.transform };
        p.style.transform = 'none'; p.style.left = '2vw'; p.style.top = '2vh'; p.style.width = '96vw'; p.style.height = '94vh'; _maxed = true; btn.textContent = '❐'; btn.title = 'Restore'; }
      else { Object.assign(p.style, _prevBox); _maxed = false; btn.textContent = '⛶'; btn.title = 'Maximize / restore'; }
    };
    const medEl = $('.tc-tpp-med'); if (medEl) medEl.onchange = () => { curMi = parseInt(medEl.value, 10) || 0; render(); };
    p.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!$('.tc-tpp-ok').disabled) apply('all', false); } };
    $('.tc-tpp-hd').onmousedown = e => {
      if (e.target.closest('button, select')) return; e.preventDefault();
      const r = p.getBoundingClientRect();
      p.style.transform = 'none'; p.style.left = r.left + 'px'; p.style.top = r.top + 'px';   // #456: detach from the centering transform so the drag math is absolute (else it clamps early)
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = ev => { p.style.left = Math.max(0, Math.min(ev.clientX - ox, innerWidth - p.offsetWidth)) + 'px'; p.style.top = Math.max(0, Math.min(ev.clientY - oy, innerHeight - p.offsetHeight)) + 'px'; };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    };
    // #456: seed the paste box with the current tracklist (like the native parser), so it opens showing what's there.
    // Don't auto-focus when prefilled — focusing then clicking elsewhere would blur→auto-collapse the box.
    const seed = currentText();
    if (seed) { ta.value = seed; syncRows(); render(); }
    else { render(); ta.focus(); }
  }

  /* ── Track length parser (#455) ────────────────────────────────────────────
   * MB's native track parser wants a specific format; lengths copied off a site
   * (Bandcamp, foobar, …) rarely fit. This greps every DURATION out of arbitrary
   * pasted text — jesus2099's battle-tested regex, which only matches things
   * shaped like a time so track numbers / titles / years are ignored — into a
   * REVIEWABLE, editable list (add / delete / edit rows, invalid times blocked),
   * then writes them to the medium's tracks in order. Nothing is written until
   * you commit. */
  const LP_DUR_RE = /(?:(?:(\b\d\b)[°h])?(\b\d{1,3}\b)[′’'m])?(\b\d{2}\b)[″”"s]|(?:(?:(\b\d\b):)?(\b\d{1,3}\b):)(\b\d{2}\b)/g;
  // Extract durations (in reading order) → [{ value, raw }]. value is m:ss, or
  // h:mm:ss when hours are present (hours 0 collapse back to m:ss).
  function lpParse(text) {
    if (!text) return [];
    const item = new RegExp(LP_DUR_RE.source);
    return (String(text).match(LP_DUR_RE) || []).map(raw => {
      const m = raw.match(item);
      const h = +(m[1] || m[4] || 0), mn = +(m[2] || m[5] || 0), s = +(m[3] || m[6] || 0);
      const value = h > 0 ? `${h}:${String(mn).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${mn}:${String(s).padStart(2, '0')}`;
      return { value, raw };
    });
  }
  // A valid MB length: m:ss (ss<60; minutes unbounded) or h:mm:ss (mm<60, ss<60).
  const lpValid = v => /^\d+:[0-5]\d$/.test(String(v).trim()) || /^\d+:[0-5]\d:[0-5]\d$/.test(String(v).trim());
  // #455.1 fetch an external page's HTML (any host — @connect *) via GM.
  function lpFetchHtml(url) {
    return new Promise((resolve, reject) => {
      const gmx = (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest) || (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest);
      if (!gmx) { reject(new Error('no GM_xmlhttpRequest')); return; }
      try { gmx({ method: 'GET', url, timeout: 20000,
        onload: r => (r.status >= 200 && r.status < 400) ? resolve(r.responseText || '') : reject(new Error('HTTP ' + r.status)),
        onerror: () => reject(new Error('fetch failed')), ontimeout: () => reject(new Error('timeout')) }); }
      catch (e) { reject(e); }
    });
  }
  // #455.1 pull the tracklist text out of fetched HTML: the SMALLEST element whose text
  // still holds at least `want` durations (trims nav/footer noise), else the whole body.
  function lpExtractFromHtml(html, want) {
    let doc; try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { return ''; }
    if (!doc || !doc.body) return '';
    doc.querySelectorAll('script,style,noscript,svg').forEach(e => e.remove());
    // textContent glues adjacent cells/rows ("12Song 1213:55") — durations lose their word
    // boundary and stop matching. Insert separators: table cells → space, block/rows → newline.
    doc.querySelectorAll('td,th').forEach(e => e.append(document.createTextNode(' ')));
    doc.querySelectorAll('tr,li,p,div,br,h1,h2,h3,h4,h5,h6,section,article').forEach(e => e.append(document.createTextNode('\n')));
    const count = t => (String(t).match(LP_DUR_RE) || []).length;
    let best = doc.body, bestLen = (doc.body.textContent || '').length + 1;
    if (want > 0) for (const el of doc.body.querySelectorAll('*')) {
      const t = el.textContent || ''; if (t.length > bestLen) continue;
      if (count(t) >= want) { best = el; bestLen = t.length; }
    }
    return (best.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n');
  }
  // #455.1 external links to offer: the release's link rows (Release-Info / relationships
  // tab), else — for a saved release — its url relationships from the web service.
  async function lpExternalLinks() {
    const dom = (typeof linkRows === 'function' ? linkRows() : []).map(l => l.url).filter(Boolean);
    if (dom.length) return [...new Set(dom)];
    const gid = (location.pathname.match(/release\/([0-9a-f-]{36})/i) || [])[1];
    if (!gid) return [];
    try { const j = await fetch(`${ORIGIN}/ws/2/release/${gid}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.json()); return [...new Set((j.relations || []).map(r => r.url && r.url.resource).filter(Boolean))]; }
    catch (e) { return []; }
  }
  // #455.2 append the source URL to the release edit note (React-safe native setter).
  function lpNoteSource(url) {
    const ta = document.getElementById('edit-note-text'); if (!ta || !url) return;
    const line = 'Track lengths from ' + url;
    const cur = ta.value || ''; if (cur.includes(line)) return;
    const kept = cur.replace(/\s+$/, '');
    const val = kept ? kept + '\n' + line : line;
    try { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, val); } catch (e) { ta.value = val; }
    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function openLengthParser(mi) {
    document.getElementById('tc-lppop')?.remove();
    let curMi = (mi != null ? mi : toolMedium());
    let items = [];        // [{ value, raw }] — the editable list (item i → track i)
    let sourceUrl = null;  // set when the lengths came from an external link → stamped in the edit note

    const p = document.createElement('div'); p.id = 'tc-lppop'; p.className = 'tc-lppop';
    const medSel = mediums().length > 1
      ? `<select class="tc-lp-med">${mediums().map((m, i) => `<option value="${i}"${i === curMi ? ' selected' : ''}>Medium ${i + 1}</option>`).join('')}</select>`
      : `<span class="tc-lp-med1">Medium ${curMi + 1}</span>`;
    p.innerHTML = `
      <div class="tc-lp-hd"><button type="button" class="tc-lp-back" title="Back to the source chooser" style="display:none">‹ Sources</button><span class="tc-lp-t">Length parser</span><span class="tc-lp-err" style="display:none"></span>${medSel}<button type="button" class="tc-lp-x" title="Close (Esc)">✕</button></div>
      <div class="tc-lp-body">
        <div class="tc-lp-left">
          <textarea class="tc-lp-ta" placeholder="Paste a tracklist here — any text with durations (5:50, 1′23″, 1:02:03). Track numbers, titles and other noise are ignored."></textarea>
          <div class="tc-lp-choose">
            <div class="tc-lp-crow"><button type="button" class="tc-lp-cbtn" data-o="text">Enter text</button><button type="button" class="tc-lp-cbtn" data-o="clip">Paste from clipboard</button></div>
            <div class="tc-lp-clbl">Parse from external link</div>
            <div class="tc-lp-favs"><span class="tc-lp-favload">…</span></div>
          </div>
        </div>
        <div class="tc-lp-list"></div>
      </div>
      <div class="tc-lp-ft"><span class="tc-lp-cnt"></span><span class="tc-lp-acts"><button type="button" class="tc-lp-ok" disabled>Apply</button></span></div>`;
    document.body.appendChild(p);
    const cw = p.offsetWidth || 832, ch = p.offsetHeight || 460;
    p.style.left = Math.max(8, Math.round((innerWidth - cw) / 2)) + 'px';
    p.style.top = Math.max(8, Math.round((innerHeight - ch) / 2)) + 'px';

    const $ = s => p.querySelector(s);
    const ta = $('.tc-lp-ta'), listEl = $('.tc-lp-list'), chooser = $('.tc-lp-choose'), errBadge = $('.tc-lp-err'), backBtn = $('.tc-lp-back');
    const tracks = () => u(mediums()[curMi].tracks) || [];
    const trackTitle = i => { const t = tracks()[i]; return t ? (u(t.name) || '') : ''; };
    const close = () => p.remove();
    // the chooser overlays the empty box; the header "‹ Sources" button appears once a
    // source is picked so you can go back and try another (#455: some links, e.g. Spotify,
    // have no parsable text). setChooser(true) forces it back even over fetched content.
    const setChooser = show => { chooser.style.display = show ? '' : 'none'; backBtn.style.display = show ? 'none' : ''; };
    const showChooser = () => setChooser(!ta.value && !items.length);
    backBtn.onclick = () => { setChooser(true); };

    // ── source chooser (overlaid on the empty textarea, beside the list) ──
    chooser.querySelector('[data-o="text"]').onclick = () => { setChooser(false); ta.focus(); };
    chooser.querySelector('[data-o="clip"]').onclick = () => {
      if (navigator.clipboard && navigator.clipboard.readText)
        navigator.clipboard.readText().then(t => { ta.value = t; sourceUrl = null; items = lpParse(t); render(); showChooser(); ta.focus(); }).catch(() => { setChooser(false); ta.focus(); toast('Clipboard blocked — paste into the box'); });
      else { setChooser(false); ta.focus(); toast('Clipboard unavailable — paste into the box'); }
    };
    // external links → one favicon each; clicking fetches + parses immediately
    lpExternalLinks().then(urls => {
      const favs = chooser.querySelector('.tc-lp-favs');
      if (!urls.length) { favs.innerHTML = `<span class="tc-lp-nofav">no external links on this release</span>`; return; }
      favs.innerHTML = urls.map(x => { let h = ''; try { h = new URL(x).hostname.replace(/^www\./, ''); } catch (e) {} return `<img class="tc-lp-fav" src="https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(h)}" title="Read track lengths from ${esc(x)}" data-u="${esc(x)}" data-h="${esc(h)}" alt="${esc(h)}" referrerpolicy="no-referrer">`; }).join('');
      favs.querySelectorAll('.tc-lp-fav').forEach(im => {
        im.onclick = () => fetchLink(im.dataset.u);
        im.onerror = () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-lp-favtxt'; b.textContent = im.dataset.h || 'link'; b.title = im.title; b.onclick = () => fetchLink(im.dataset.u); im.replaceWith(b); };   // favicon blocked/offline → clickable hostname chip
      });
    });
    async function fetchLink(url) {
      setChooser(false); ta.disabled = true; ta.value = 'Fetching the page…\n' + url;
      let html; try { html = await lpFetchHtml(url); }
      catch (e) { ta.disabled = false; ta.value = ''; items = []; render(); showChooser(); toast(`Couldn't fetch that page (${e.message}) — try another link or paste`); return; }
      ta.disabled = false;
      const text = lpExtractFromHtml(html, tracks().length);
      ta.value = text; sourceUrl = url; items = lpParse(text); render(); showChooser();
      if (!items.length) toast('No durations found on that page — try another link or paste the text');
    }

    ta.oninput = () => { sourceUrl = null; items = lpParse(ta.value); render(); showChooser(); };   // typing overrides an external source

    function render() {
      const nT = tracks().length; listEl.innerHTML = '';
      items.forEach((it, i) => {
        const row = document.createElement('div'); row.className = 'tc-lp-row';
        row.innerHTML = `<span class="tc-lp-tk${i < nT ? '' : ' none'}" title="${esc(i < nT ? (trackTitle(i) || '') : 'no track — ignored')}">${i < nT ? (i + 1) + '. ' + esc(trackTitle(i) || '—') : '— (no track)'}</span>`;
        const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'tc-lp-val' + (lpValid(it.value) ? '' : ' bad'); inp.value = it.value; inp.title = it.raw ? ('detected: ' + it.raw) : '';
        inp.oninput = () => { it.value = inp.value; inp.classList.toggle('bad', !lpValid(inp.value)); refreshFoot(); };   // clears the red the moment it's valid
        const add = document.createElement('button'); add.type = 'button'; add.className = 'tc-lp-add'; add.textContent = '+'; add.title = 'insert a length below (rows shift down)';
        add.onclick = () => { items.splice(i + 1, 0, { value: '', raw: '' }); render(); listEl.querySelectorAll('.tc-lp-val')[i + 1]?.focus(); };
        const del = document.createElement('button'); del.type = 'button'; del.className = 'tc-lp-del'; del.textContent = '✕'; del.title = 'delete (rows below shift up)';
        del.onclick = () => { items.splice(i, 1); render(); };
        row.append(inp, add, del);
        listEl.appendChild(row);
      });
      const end = document.createElement('button'); end.type = 'button'; end.className = 'tc-lp-addend';
      end.textContent = items.length ? '+ add length' : '+ add a length (or paste into the box on the left)';
      end.onclick = () => { items.push({ value: '', raw: '' }); render(); const all = listEl.querySelectorAll('.tc-lp-val'); all[all.length - 1]?.focus(); };
      listEl.appendChild(end);
      refreshFoot();
    }
    function refreshFoot() {
      const cntEl = $('.tc-lp-cnt'), okBtn = $('.tc-lp-ok');
      const nT = tracks().length, n = items.length, bad = items.filter(it => !lpValid(it.value)).length;
      cntEl.className = 'tc-lp-cnt' + (bad ? ' bad' : n === nT ? ' ok' : n ? ' warn' : '');
      cntEl.textContent = (!n ? `${nT} track${nT !== 1 ? 's' : ''} in Medium ${curMi + 1}`
        : `${n} length${n !== 1 ? 's' : ''} ↔ ${nT} track${nT !== 1 ? 's' : ''}` + (bad ? ` · ${bad} invalid — fix or delete` : n !== nT ? ' · count mismatch' : ''))
        + (sourceUrl ? ' · from external link' : '');
      okBtn.disabled = !n || bad > 0;
      okBtn.textContent = `Apply ${Math.min(n, nT)} to Medium ${curMi + 1}`;
      if (bad > 0) { errBadge.style.display = ''; errBadge.textContent = `⚠ ${bad} invalid — fix or delete`; }   // #455.3 prominent badge in the header
      else errBadge.style.display = 'none';
    }
    function commit() {
      const nT = tracks().length, n = Math.min(items.length, nT);
      if (!items.length || items.some(it => !lpValid(it.value))) return;
      for (let i = 0; i < n; i++) setLength({ mi: curMi, ti: i }, items[i].value);
      if (sourceUrl) lpNoteSource(sourceUrl);   // #455.2 credit the source in the edit note
      rebuild(true);
      Log.info('length parser: applied', n, 'track length(s) on medium', curMi + 1, sourceUrl ? ('from ' + sourceUrl) : '');
      toast(`Applied ${n} track length${n !== 1 ? 's' : ''}`);
      close();
    }
    // static header/footer wiring
    $('.tc-lp-ok').onclick = commit;
    $('.tc-lp-x').onclick = close;
    const medEl = $('.tc-lp-med'); if (medEl) medEl.onchange = () => { curMi = parseInt(medEl.value, 10) || 0; render(); };
    // Esc / Ctrl+Enter only — never dismisses on an outside click (#455.6)
    p.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); commit(); } };
    // draggable by the header
    $('.tc-lp-hd').onmousedown = e => {
      if (e.target.closest('button, select')) return;
      e.preventDefault();
      const r = p.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = ev => { p.style.left = Math.max(0, Math.min(ev.clientX - ox, innerWidth - p.offsetWidth)) + 'px'; p.style.top = Math.max(0, Math.min(ev.clientY - oy, innerHeight - p.offsetHeight)) + 'px'; };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    };
    render(); showChooser();
  }
  function runMediumTool(act, mi) { if (act === 'parser') openParser(mi); else if (act === 'patternparser') openTrackPatternParser(mi); else if (act === 'lengthparser') openLengthParser(mi); else if (act === 'resetnum') resetNumbers(mi); else if (act === 'swap') swapMedium(mi); }
  function runAction(a) {
    // #378 a bridged external tool (x:…). The PINNED toolbar button reaches us via bindActions (which
    // rebinds every [data-act] to runAction, overriding pickTool), so re-sync the bridge map HERE too —
    // otherwise a stale map (a prior sync while the external button was hidden) means nothing fires, while
    // the Tools menu (which goes through pickTool/getToolCfg) still works.
    if (String(a).startsWith('x:')) { syncBridges(); const b = _bridgeMap[a]; if (b) fireBridge(b); else Log.warn('Apollo bridge not present:', a); return; }
    if (a === 'match') matchAll();
    else if (a === 'revert') revertAll();
    else if (a === 'guesscase') guessCaseAll();
    else if (a === 'guessfeat') guessFeatAll();
    else if (a === 'cols') colsFit();   // the Columns button's default action is Fit
    else if (MEDIUM_TOOLS.has(a)) runMediumTool(a, 0);
    else if (_bridgeMap[a]) fireBridge(_bridgeMap[a]);
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
    _selfEdit = true;   // #483: bulk write across every track — rebuild(true) below is the one resync it needs
    try {
      MODEL.tracks.forEach(t => {
        try {
          const ko = koTrack(t.mi, t.ti); const names = u(u(ko.artistCredit).names) || [];
          // keep each credit's display text (the credited-as name, or the artist's name if none) but drop the
          // selected entity — turning a matched artist back into unmatched text (artist: bare {name}), ready
          // to re-match. Mirrors how commitTrack writes an unresolved slot.
          ko.artistCredit({ names: names.map(n => { const text = u(n.name) || (n.artist && u(u(n.artist).name)) || ''; return { artist: { name: text }, name: text, joinPhrase: u(n.joinPhrase) || '' }; }) });
        } catch (e) {}
      });
    } finally { _selfEdit = false; }
    Log.info('cleared all track artist selections (kept credited-as text)'); rebuild(true);   // no re-match, or it would instantly re-link the kept text
  }

  /* ── Configurable Tools bar (#280) ───────────────────────────────────────────
     A row of tool buttons you choose (the rest live behind ⋯). The ACTIVE tool's
     params render inline, right after the buttons; tools you "pin" keep their
     params on a 2nd row. Click the "Tools" label to customise (visibility, order,
     per-tool icon/text, pinning). ── */
  const MENU = [
    { act: 'parser',    label: 'Track parser',       icon: '☰' },           // ☰ native MB parser
    { act: 'patternparser', label: 'Pattern parser',  icon: '▦' },           // ▦ #456 our pattern-based parser
    { act: 'lengthparser', label: 'Length parser',     icon: '⏱' },         // ⏱ #455
    { act: 'swap',      label: 'Swap',               icon: '⇅' },           // ⇅
    { act: 'resetnum',  label: 'Reset #',            icon: '#' },
    { act: 'guessfeat', label: 'Guess feat.',        icon: 'ft', instant: true },
    { act: 'guesscase', label: 'Guess case',         icon: 'Aa', params: true },
    { act: 'sr',        label: 'Search and Replace', icon: 'S&R', params: true },
    { act: 'cols',      label: 'Resize columns',     icon: '↔', params: true }, // ↔
  ];
  const TOOL = Object.fromEntries(MENU.map(m => [m.act, m]));
  const LABELS = Object.fromEntries(MENU.map(m => [m.act, m.label]));
  const MEDIUM_TOOLS = new Set(['parser', 'patternparser', 'lengthparser', 'resetnum', 'swap']);   // act on ONE medium (inline medium combo when >1)
  const OPTLESS = new Set(['guessfeat']);   // global, no options — fires on pick (non-sticky)
  const hasParams = act => !!(TOOL[act] && TOOL[act].params);

  /* ── Tier-0 tool bridges (#322) ───────────────────────────────────────────
     Surface a button that some OTHER (user)script drops on the page as a
     fire-and-forget Apollo Tool, but ONLY when it's actually present. Two ways:

       (a) Built-in registry — for known buttons we want to adopt UNMODIFIED
           (e.g. kellnerd's "Guess punctuation"), matched by visible text.
           Add another by appending one { label, icon, find } entry; `find()`
           returns the live element or null.

       (b) Convention — any element tagged `class="apollo-tool"` (optional
           `data-apollo-label` / `data-apollo-icon`) is surfaced too, so a
           cooperating script self-registers with NO Apollo change.

     Either kind is param-less: activating clicks the element, then Apollo
     re-reads (the external code writes the native fields / KO model, which
     Apollo doesn't watch per-value), so its grid reflects the change. ── */
  const bridgeBtn = re => [...document.querySelectorAll('button, input[type="button"], input[type="submit"]')]
    // #378 must NOT match Apollo's OWN surfaced copy of the tool (the pinned bar button / Tools-menu item
    // carry the same label) — otherwise the pinned button fires itself and nothing happens. Skip our UI.
    .find(b => b.offsetParent !== null && !b.closest('.tc-tools, .tc-toolbtns, .tc-menu, #tc-panel, .tc-mirror') && re.test((b.textContent || b.value || '').trim())) || null;
  // built-in registry: known external buttons, each with a STABLE `act` so its
  // bar/menu placement persists. Add one entry { act, label, icon, find } to bridge another.
  const BRIDGE = [
    { act: 'x:gpunct', label: 'Guess punctuation', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAHYgAAB2IBOHqZ2wAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFpSURBVDiNpZOxjwFBGMV/e5FspZeoFETlL9Bug0RDL5FolVpRUqxCr1iNUelUEhmFZqlEVAolFRuxsswVl9uzWVfceeX73nvzfTPzaUIIxRuIAJTL5X+ZR6MRH++cDrwOOBwOdLtdbrdbqDafzxmPx78H2LZNtVplt9txPp993vM8TNOk1WoFeIQQ6htSSmUYhur3++rxePi853mq0WioUqmkttutzwshVOS57U6nQy6Xo1KpBLoaDAYsl0t6vR6pVOr1HViWheM4IfPlcmE4HJLNZkPmQMBqtSIajbJYLFiv175gs9lwvV653+/MZjOOx2MgwB/BdV1OpxPtdhuAYrFIvV73X0JKiZQSXdcxTZN0Oh3sIBaLBZInkwlKqRDvui7T6TQ8gmEYAWE8HkfTNBKJBMlkMlQLjVAoFHAcB9u20XWdWq3mi5rNJpZlsd/vyWQy5PP5n7Tnf/BXCCHU27sQga+t+i8+AYUS9lO02Bg3AAAAAElFTkSuQmCC', find: () => bridgeBtn(/^guess\s+punctuation$/i) },
  ];
  let _bridges = [], _bridgeMap = {}, _lastBridgeSig = null;   // #441 dedupe the sync-diagnostics log
  // refresh the tools available right now: built-in matches that resolve + elements
  // tagged class="apollo-tool" (self-registering). Each carries a stable act so the
  // normal tool-config (bar / menu / Customize, persisted) treats it like a native tool.
  function syncBridges() {
    const out = [];
    for (const b of BRIDGE) { let el = null; try { el = b.find(); } catch (e) {} if (el) out.push({ act: b.act, label: b.label, icon: b.icon, el }); }
    document.querySelectorAll('.apollo-tool').forEach(el => {
      const label = el.dataset.apolloLabel || (el.textContent || '').trim() || 'Tool';
      const act = 'x:' + (el.dataset.apolloId || el.id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      if (!out.some(o => o.act === act)) out.push({ act, label, icon: el.dataset.apolloIcon || '🔧', el });
    });
    _bridges = out; _bridgeMap = Object.fromEntries(out.map(b => [b.act, b]));
    // #441 — only log when the set actually CHANGES; syncBridges runs on every tick and
    // was spamming the same line ~2×/s. Dedupe against the last signature.
    const sig = out.length ? out.map(b => b.act + (b.el ? '' : '(no-el)')).join(', ') : '(none)';
    if (sig !== _lastBridgeSig) { _lastBridgeSig = sig; Log.debug('Apollo bridges synced:', sig); }   // #378 diagnostics
    return out;
  }
  // tool-def accessor: native tools + present bridges, so render/customize treat them alike
  const TD = act => TOOL[act] || _bridgeMap[act] || { act, icon: '?', label: act };
  // a tool icon is normally a short text glyph (Aa, S&R, ↔); a data:/http(s) URL
  // renders as a small <img> instead, so a bridged tool can ship its own icon.
  const isImgIcon = v => typeof v === 'string' && /^(?:data:|https?:\/\/)/.test(v);
  const iconHtml = v => isImgIcon(v) ? `<img class="tc-icimg" src="${esc(v)}" alt="">` : esc(v == null ? '' : v);
  async function fireBridge(it) {
    if (!it) { Log.warn('Apollo bridge: nothing to fire (no tool)'); return; }
    // #378 re-resolve the LIVE element at fire time: the cached one can be stale, and a fresh find() also
    // avoids firing Apollo's own surfaced copy of the tool. Fall back to the cached element.
    let el = it.el;
    const reg = BRIDGE.find(b => b.act === it.act);
    try { if (reg && reg.find) { const fresh = reg.find(); if (fresh) el = fresh; } } catch (e) { Log.warn('Apollo bridge: find() threw', e.message); }
    Log.info('Apollo bridge:', it.label, '· cached el', it.el ? 'yes' : 'null', '· resolved', !el ? 'null' : (el === it.el ? 'cached' : 'fresh'), '· ourUI', !!(el && el.closest && el.closest('.tc-tools,.tc-toolbtns,.tc-menu,#tc-panel')));
    if (!el) { Log.warn('Apollo bridge: element gone —', it.label); return; }
    Log.info('Apollo bridge: clicking', it.label, '→', el.tagName + '.' + ((el.className || '').toString().split(' ')[0] || ''));
    el.click();
    try { await rebuild(true); } catch (e) { Log.warn('Apollo bridge: re-render failed', e.message); }   // re-read (no re-match)
  }
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
    syncBridges();   // #322: present bridges become first-class tools (cfg/bar/menu/customize)
    const known = act => !!(TOOL[act] || _bridgeMap[act]);   // drop saved entries for tools/bridges no longer present
    const saved = Array.isArray(SETTINGS.toolCfg) ? SETTINGS.toolCfg.filter(t => t && known(t.act)) : [];
    const order = saved.map(t => t.act);
    // fresh install: the default on-bar tools lead (in their order), then the rest
    TOOL_DEFAULTS.forEach(d => { if (!order.includes(d.act)) order.push(d.act); });
    MENU.forEach(m => { if (!order.includes(m.act)) order.push(m.act); });
    _bridges.forEach(b => { if (!order.includes(b.act)) order.push(b.act); });   // present bridges default to the Tools menu
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
    const m = TD(t.act);
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'tc-toolbtn' + (m.instant ? ' instant' : '');
    b.dataset.act = t.act;
    b.innerHTML = (t.icon ? `<span class="tc-tbic">${iconHtml(m.icon)}</span>` : '') + (t.text ? `<span class="tc-tblab">${esc(m.label)}</span>` : '');
    if (!t.text) b.title = m.label;
    b.onclick = () => pickTool(t.act);
    return b;
  }
  function pickTool(act) {
    if (String(act).startsWith('x:')) Log.info('Apollo: external tool activated —', act, '· in map:', !!_bridgeMap[act]);   // #378 diagnostics (bar button or Tools-menu item)
    if (_bridgeMap[act]) return runAction(act);                  // bridged external tool — fire-and-forget
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
    if (act === 'sr') { _srChain = null; const box = document.querySelector('.tc-sro'); if (box) { box.classList.remove('tc-sro-chain'); } const f = document.querySelector('.tc-sr-find'), r = document.querySelector('.tc-sr-rep'); if (f) f.value = ''; if (r) r.value = ''; srActivate(); MODEL && MODEL.tracks.forEach(t => { delete t._srFlash; }); rerender(); if (f) f.focus(); return; }
    if (MEDIUM_TOOLS.has(act)) return runMediumTool(act, toolMedium());
    runAction(act);   // guesscase → guess-case all · cols → Fit
  }
  // the "Tools" label menu: the tools NOT on the bar, then Customize…
  function openToolsMenu(anchor) {
    let m = document.getElementById('tc-menu'); if (m) { m.remove(); return; }
    const off = getToolCfg().filter(t => !t.onBar && !TEMP_BAR.has(t.act));   // includes off-bar bridges (#322)
    m = document.createElement('div'); m.id = 'tc-menu'; m.className = 'tc-menu';
    m.innerHTML = off.map(t => `<div class="tc-mi" data-act="${t.act}"><span class="tc-mi-ic">${iconHtml(TD(t.act).icon)}</span>${esc(TD(t.act).label)}</div>`).join('')
      + (off.length ? '<div class="tc-sep"></div>' : '')
      + '<div class="tc-mi tc-mi-cfg" data-act="__cfg"><span class="tc-mi-ic">⚙︎</span>Customize…</div>';
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
      // #375 open Saved & History via ↓ in either field, or a ★ button after RE (the in-field caret was hard to hit)
      const find = document.createElement('input'); find.type = 'text'; find.className = 'tc-sr-find'; find.placeholder = srRegexOn() ? 'search (regex)' : 'search';
      const rep = document.createElement('input'); rep.type = 'text'; rep.className = 'tc-sr-rep'; rep.placeholder = 'replace';
      const run = () => srLive(find.value, rep.value, true);
      find.oninput = rep.oninput = run;
      const openOnDown = e => { if (e.key === 'ArrowDown' && !_srPop) { e.preventDefault(); openSrTemplates(find, find, rep, re); } };   // popup anchors to the search field (left-aligned)
      find.addEventListener('keydown', openOnDown); rep.addEventListener('keydown', openOnDown);
      const re = document.createElement('button'); re.type = 'button'; re.className = 'tc-srbtn tc-sr-re' + (srRegexOn() ? ' on' : ''); re.textContent = 'RE';
      re.title = 'Use regular expressions (search is a regex; $1, $<name> work in replace)';
      re.onclick = () => { SETTINGS.srRegex = !srRegexOn(); saveSettings(); re.classList.toggle('on', srRegexOn()); find.placeholder = srRegexOn() ? 'search (regex)' : 'search'; run(); };
      const star = document.createElement('button'); star.type = 'button'; star.className = 'tc-srbtn tc-sr-star'; star.textContent = '★'; star.title = 'Saved patterns, chains & recent (or press ↓ in the search field)';
      // #409: in chain mode `find` is hidden (display:none → a 0,0 rect that flung the popup to the
      // corner). Anchor to whatever's actually visible — the chain chip, else the ★ button.
      star.onclick = () => { const b = star.closest('.tc-sro'); const anchor = (find.offsetParent !== null) ? find : ((b && b.querySelector('.tc-sr-chainchip')) || star); openSrTemplates(anchor, find, rep, re); };
      box.append(find, rep, re, star); host.appendChild(box);
      if (_srChain) srShowChain(_srChain);   // #409: restore the chain chip if a chain was active
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
    name.innerHTML = (t.icon ? `<span class="tc-tbic">${iconHtml(TD(act).icon)}</span>` : '') + (t.text ? `<span class="tc-tblab">${esc(TD(act).label)}</span>` : '');
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
  let _bridgeKey = '', _bridgeT = 0, _bridgeObs = null;
  const bridgeKeyNow = () => _bridges.map(b => b.act).sort().join('|');
  function refreshBridgesIfChanged() {
    if (!document.querySelector('.tc-toolbtns')) return;   // toolbar not mounted
    syncBridges();
    const key = bridgeKeyNow();
    if (key !== _bridgeKey) { _bridgeKey = key; renderToolbar(); }
  }
  // #322: an external tool button (e.g. Guess punctuation) may be injected AFTER
  // Apollo first builds its toolbar, so a pinned bridge wouldn't show until a
  // re-render. Watch for the present-bridge set changing and re-render the bar.
  function watchBridges() {
    if (_bridgeObs) return;
    _bridgeObs = new MutationObserver(() => { clearTimeout(_bridgeT); _bridgeT = setTimeout(refreshBridgesIfChanged, 300); });
    _bridgeObs.observe(document.body, { childList: true, subtree: true });
  }
  function initTools() { renderToolbar(); _bridgeKey = bridgeKeyNow(); watchBridges(); }

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
        + '<div class="tc-tc-hint">Drag ⠿ to reorder · ☑ shows it on the bar (else under the Tools menu) · tools with settings show them inline</div>';
      const list = p.querySelector('.tc-tc-list');
      getToolCfg().forEach(t => {
        const m = TD(t.act);
        const row = document.createElement('div'); row.className = 'tc-tc-row' + (t.onBar ? '' : ' off'); row.dataset.act = t.act; row.draggable = true;
        row.innerHTML =
          '<span class="tc-tc-grab" title="drag to reorder">⠿</span>'
          + `<label class="tc-tc-onbar" title="show on the toolbar"><input type="checkbox" class="cb-onbar"${t.onBar ? ' checked' : ''}></label>`
          + `<span class="tc-tc-ic">${iconHtml(m.icon)}</span><span class="tc-tc-lab">${esc(m.label)}</span>`
          + `<span class="tc-tc-dens" title="what shows on the button — icon and/or text"><button type="button" class="tc-tc-seg cb-icon${t.icon ? ' on' : ''}" title="show the icon">${iconHtml(m.icon)}</button><button type="button" class="tc-tc-seg cb-text${t.text ? ' on' : ''}" title="show the text">T</button></span>`;
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

  // ── #409 S&R chains ───────────────────────────────────────────────────────
  // A "chain" is a named template whose `members` array lists other (non-chain) template
  // names, applied in order as one action — so "All Quotes" runs Quotes then Single quote
  // in a single click. Chains live in the same srTemplates list; `members` marks a chain.
  // Each member carries its OWN `re` flag (regex or literal), independent of the global RE
  // toggle, so a chain mixing a regex and a literal pattern behaves as saved.
  function srIsChain(t) { return !!(t && Array.isArray(t.members)); }   // hoisted: used by srSeedTemplates() at init
  const srReFor = (find, re, ci, g) => { const flags = (g ? 'g' : '') + (ci ? 'i' : ''); try { return new RegExp(re ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); } catch (e) { return null; } };
  const srReplFor = (replace, re) => re ? String(replace) : String(replace).replace(/\$/g, '$$$$');
  // resolve a chain's member names to their (non-chain) pattern entries, in order
  function srChainPatterns(chain) {
    const byName = new Map(srTemplates().filter(t => !srIsChain(t)).map(t => [t.name, t]));
    return (chain.members || []).map(n => byName.get(n)).filter(Boolean);
  }
  let _srSnap = null;
  function srActivate() { _srSnap = MODEL ? MODEL.tracks.map(t => t.title) : []; if (MODEL) MODEL.tracks.forEach(t => { delete t._srLastResult; }); }
  function srLive(find, replace, ci) {
    if (!MODEL) return; if (!_srSnap || _srSnap.length !== MODEL.tracks.length) srActivate();
    const re = find ? srRe(find, ci, true) : null;
    const bad = !!(find && srRegexOn() && !re);   // invalid user regex — flag the field, change nothing
    const findEl = document.querySelector('.tc-sr-find'); if (findEl) findEl.classList.toggle('tc-sr-bad', bad);
    if (bad) { srRememberLast(find, replace); return; }
    const repl = srRepl(replace); let changed = 0;
    MODEL.tracks.forEach((t, i) => {
      // #375: if the title changed since our last replace (a manual edit, Guess Case, etc.), re-base the
      // snapshot to it — otherwise we'd replace from the stale original and clobber the manual change.
      if (t._srLastResult == null || t.title !== t._srLastResult) _srSnap[i] = t.title;   // #409: re-base to the CURRENT title on a manual edit — incl. before the first replace (was stale until re-activation)
      const base = _srSnap[i] != null ? _srSnap[i] : t.title;
      const nt = re ? base.replace(re, repl) : base;
      if (nt !== base) changed++;
      if (nt !== t.title) { setTitle(t, nt); t.title = nt; t.guessTitle = guessTitleStr(t); }
      t._srLastResult = t.title;   // remember what we left it as, to detect the next manual edit
      t._srFlash = !!(find && nt !== base);
    });
    rerender(); toast(changed ? `${changed} title${changed !== 1 ? 's' : ''} replaced` : '');
    srRememberLast(find, replace);
  }
  // #409: apply every member pattern of a chain, in order, CUMULATIVELY (each pattern sees the
  // previous one's output) — recomputed from the snapshot like srLive, so it stays non-compounding
  // across re-applies. Members use their own per-pattern `re` flag.
  function srApplyChain(chain) {
    if (!MODEL) return;
    if (!_srSnap || _srSnap.length !== MODEL.tracks.length) srActivate();
    const pats = srChainPatterns(chain); let changed = 0;
    MODEL.tracks.forEach((t, i) => {
      if (t._srLastResult == null || t.title !== t._srLastResult) _srSnap[i] = t.title;   // #409: re-base to the CURRENT title on a manual edit — incl. before the first replace (was stale until re-activation)
      const base = _srSnap[i] != null ? _srSnap[i] : t.title;
      let text = base;
      for (const p of pats) { const re = p.find ? srReFor(p.find, p.re, true, true) : null; if (re) text = text.replace(re, srReplFor(p.replace, p.re)); }
      if (text !== base) changed++;
      if (text !== t.title) { setTitle(t, text); t.title = text; t.guessTitle = guessTitleStr(t); }
      t._srLastResult = t.title;
      t._srFlash = !!(pats.length && text !== base);
    });
    rerender(); toast(changed ? `${changed} title${changed !== 1 ? 's' : ''} replaced (${chain.name})` : `${chain.name}: no matches`);
  }
  // create an empty chain; returns false on a bad/duplicate name
  function srAddChain(name) {
    name = (name || '').trim(); if (!name) return false;
    const list = srTemplates(); if (list.some(t => t.name === name)) return false;   // no name clash with a pattern or chain
    list.push({ name, members: [] }); saveSettings(); return true;
  }
  // toggle a (non-chain) template's membership in a chain
  function srChainToggle(chainName, itemName) {
    const c = srTemplates().find(t => srIsChain(t) && t.name === chainName); if (!c) return;
    c.members = c.members || [];
    const i = c.members.indexOf(itemName);
    if (i >= 0) c.members.splice(i, 1); else c.members.push(itemName);
    saveSettings();
  }
  // #410: the "default" S&R — one pattern OR chain marked default (name in SETTINGS.srDefault),
  // applied automatically the first time the Tracklist opens this session. Setting a new default
  // toggles the old one off (only one).
  const srDefaultName = () => SETTINGS.srDefault || '';
  function srSetDefault(name) { SETTINGS.srDefault = (SETTINGS.srDefault === name) ? '' : name; saveSettings(); }
  // Apply a default item (called on Tracklist open + when the user clicks it). A chain runs all its
  // members + enters chain mode; a pattern fills the fields, sets RE to its own flag, and replaces.
  function srApplyDefaultItem(item) {
    if (srIsChain(item)) { srApplyChain(item); srShowChain(item.name); return; }
    SETTINGS.srRegex = !!item.re; saveSettings();
    const f = document.querySelector('.tc-sr-find'), r = document.querySelector('.tc-sr-rep'), reBtn = document.querySelector('.tc-sr-re');
    if (f) { f.value = item.find; f.placeholder = srRegexOn() ? 'search (regex)' : 'search'; }
    if (r) r.value = item.replace;
    if (reBtn) reBtn.classList.toggle('on', !!item.re);
    srLive(item.find, item.replace, true);
  }
  let _srDefaultAppliedOnce = false;
  // Apply the marked default once per session, when the Tracklist first renders.
  function srApplyDefaultOnStart() {
    if (_srDefaultAppliedOnce) return;
    const name = srDefaultName(); if (!name) { _srDefaultAppliedOnce = true; return; }
    const item = srTemplates().find(t => t.name === name); if (!item) { _srDefaultAppliedOnce = true; return; }
    // Don't consume the one-shot until the tracklist is actually loaded — a first render with an
    // empty/lazy model would "apply" to nothing and then never retry. Try again on the next render.
    if (!MODEL || !MODEL.tracks || !MODEL.tracks.length) return;
    _srDefaultAppliedOnce = true;
    // Force a FRESH snapshot of the real titles: the S&R tool is on the bar by default, so its
    // buildToolParams already called srActivate() BEFORE the model existed — leaving a stale/empty
    // snapshot that srApplyChain/srLive would then reuse (→ "no match", or a no-op for a pattern).
    srActivate();
    try { srApplyDefaultItem(item); Log.info('Applied default S&R:', name); } catch (e) { Log.warn('default S&R failed', e.message); }
  }
  // #409: chain "mode" — a chain isn't editable (it's several patterns), so when one is applied the
  // search/replace inputs are swapped for a read-only chip showing the chain name (✕ exits back to S&R).
  let _srChain = null;
  function srShowChain(name) {
    _srChain = name;
    const box = document.querySelector('.tc-sro'); if (!box) return;
    box.classList.add('tc-sro-chain');
    let chip = box.querySelector('.tc-sr-chainchip');
    if (!chip) {
      chip = document.createElement('span'); chip.className = 'tc-sr-chainchip';
      const lbl = document.createElement('span'); lbl.className = 'tc-sr-chainlbl';
      const x = document.createElement('button'); x.type = 'button'; x.className = 'tc-sr-chainx'; x.textContent = '✕'; x.title = 'Exit chain — back to search / replace'; x.onclick = srExitChain;
      chip.append(lbl, x); box.insertBefore(chip, box.firstChild);
    }
    chip.querySelector('.tc-sr-chainlbl').textContent = '⛓ ' + name;
    chip.title = 'S&R chain "' + name + '" (read-only — several patterns)';
  }
  function srExitChain() {
    _srChain = null;
    const box = document.querySelector('.tc-sro'); if (!box) return;
    box.classList.remove('tc-sro-chain');
    const f = box.querySelector('.tc-sr-find'), r = box.querySelector('.tc-sr-rep');
    if (f) f.value = ''; if (r) r.value = '';
    srActivate(); if (MODEL) MODEL.tracks.forEach(t => { delete t._srFlash; }); rerender();
    if (f) f.focus();
  }
  // #152 — named search/replace templates, persisted in settings. "_Last" is a special auto-kept entry
  // (the most recent pattern) that sorts first because "_" precedes letters.
  function srTemplates() { if (!Array.isArray(SETTINGS.srTemplates)) SETTINGS.srTemplates = []; return SETTINGS.srTemplates; }
  // #375: seed two handy defaults on first run only — never re-add once seeded, so we don't fight an
  // editor who cleared them or already has their own set.
  function srSeedTemplates() {
    // migrate the legacy "_Last" entry out of Saved (history lives in srHistory now)
    if (srTemplates().some(t => t.name === '_Last')) SETTINGS.srTemplates = srTemplates().filter(t => t.name !== '_Last');
    // v1 — seed the two quote patterns (once)
    if ((SETTINGS.srSeedV || 0) < 1) {
      // seed only when there are no USER (non-"_") templates — an existing `_Last` no longer blocks it
      if (!srTemplates().some(t => t.name && t.name[0] !== '_')) {
        srTemplates().push({ name: 'Quotes', find: '"(.+?)"', replace: '“$1”', re: true });
        srTemplates().push({ name: 'Single quote', find: "'", replace: '’', re: false });
      }
      SETTINGS.srSeedV = 1;
    }
    // v2 (#409) — seed the "All Quotes" chain that runs both quote patterns, once, and only if
    // both members exist and no chain named "All Quotes" is already present.
    if ((SETTINGS.srSeedV || 0) < 2) {
      const names = new Set(srTemplates().map(t => t.name));
      if (names.has('Quotes') && names.has('Single quote') && !srTemplates().some(t => srIsChain(t) && t.name === 'All Quotes')) {
        srTemplates().push({ name: 'All Quotes', members: ['Quotes', 'Single quote'] });
      }
      SETTINGS.srSeedV = 2;
    }
    saveSettings();
  }
  let _srLastTimer = null;
  // #375: History — the 5 most-recent (distinct) patterns, most-recent first. Separate from the named
  // Saved templates. (Supersedes the old single "_Last" entry that used to live inside srTemplates.)
  function srHistoryList() { if (!Array.isArray(SETTINGS.srHistory)) SETTINGS.srHistory = []; return SETTINGS.srHistory; }
  function srRememberLast(find, replace) {
    if (!find) return;
    const re = srRegexOn();
    // #375 debounce the ENTRY itself — record only after typing settles (~1.4s), so one search isn't
    // logged character-by-character (h, he, hel, …). The latest pattern wins.
    clearTimeout(_srLastTimer);
    _srLastTimer = setTimeout(() => {
      const hist = srHistoryList();
      const i = hist.findIndex(h => h.find === find && h.replace === replace && !!h.re === re);
      if (i === 0) return;                     // already the most-recent
      if (i > 0) hist.splice(i, 1);            // seen before → move to front
      hist.unshift({ find, replace, re });
      if (hist.length > 5) hist.length = 5;
      saveSettings();
    }, 1400);
  }
  function srSaveTemplate(name, find, replace) {
    name = (name || '').trim(); if (!name || !find) return false;
    const list = srTemplates(); const ex = list.find(t => t.name === name);
    const ent = { name, find, replace, re: srRegexOn() };
    if (ex) Object.assign(ex, ent); else list.push(ent);
    saveSettings(); return true;
  }
  function srRemoveTemplate(name) { SETTINGS.srTemplates = srTemplates().filter(t => t.name !== name); saveSettings(); }
  // #409: rename a pattern or chain in place. Keeps chain memberships pointing at the renamed
  // pattern. Rejects an empty name or a clash with an existing pattern/chain.
  function srRenameTemplate(oldName, newName) {
    newName = (newName || '').trim(); if (!newName) return false;
    if (newName === oldName) return true;
    const list = srTemplates();
    if (list.some(t => t.name === newName)) return false;
    const t = list.find(x => x.name === oldName); if (!t) return false;
    t.name = newName;
    list.filter(srIsChain).forEach(c => { if (Array.isArray(c.members)) c.members = c.members.map(m => (m === oldName ? newName : m)); });
    saveSettings(); return true;
  }
  // the Templates popup — sorted list (｢_Last｣ first), click a row to load+apply, ✕ to remove,
  // and a "new template" section (shown only when the search field is non-empty). #152
  let _srPop = null, _srPopOff = null;
  let _srPopKey = null;
  function closeSrTemplates() { if (_srPop) { _srPop.remove(); _srPop = null; } if (_srPopOff) { document.removeEventListener('mousedown', _srPopOff, true); _srPopOff = null; } if (_srPopKey) { document.removeEventListener('keydown', _srPopKey, true); _srPopKey = null; } }
  // #375 the Saved & History popup — Saved (named) templates on top with an inline "Save current",
  // then a History section of the 5 most-recent patterns. Opens off the search field (caret or ↓);
  // ↑/↓ move the selection, Enter loads. Left-aligned to the search field.
  function openSrTemplates(anchor, findEl, repEl, reBtn) {
    if (_srPop) { closeSrTemplates(); return; }
    const pop = document.createElement('div'); pop.className = 'tc-srtpl'; _srPop = pop;
    let navRows = [], sel = -1;
    const highlight = () => navRows.forEach((r, i) => { r.classList.toggle('tc-srtpl-sel', i === sel); if (i === sel) r.scrollIntoView({ block: 'nearest' }); });
    const applyEntry = (find, replace, re) => {
      findEl.value = find; repEl.value = replace; SETTINGS.srRegex = !!re; saveSettings();
      if (reBtn) { reBtn.classList.toggle('on', !!re); findEl.placeholder = srRegexOn() ? 'search (regex)' : 'search'; }
      srLive(findEl.value, repEl.value, true); closeSrTemplates(); findEl.focus();
    };
    // #409 redesign: Import / Export — a JSON view of the saved patterns + chains + the default
    // marker (NOT history). Export = read the textarea; Import = paste + ✓ Import (replaces the set).
    const showImportExport = () => {
      pop.innerHTML = ''; navRows = []; sel = -1;
      const hd = document.createElement('div'); hd.className = 'tc-srtpl-hd';
      const back = document.createElement('button'); back.type = 'button'; back.className = 'tc-srtpl-savebtn'; back.textContent = '‹ Back'; back.onclick = () => render();
      const ttl = document.createElement('span'); ttl.className = 'tc-srtpl-hdt'; ttl.textContent = 'Import / Export';
      const imp = document.createElement('button'); imp.type = 'button'; imp.className = 'tc-srtpl-saveok tc-srtpl-impok'; imp.textContent = '✓ Import'; imp.title = 'Replace your saved patterns & chains with the JSON below';
      hd.append(back, ttl, imp); pop.appendChild(hd);
      const ta = document.createElement('textarea'); ta.className = 'tc-srtpl-io'; ta.spellcheck = false;
      ta.value = JSON.stringify({ templates: srTemplates().filter(t => t.name && t.name[0] !== '_'), default: srDefaultName() }, null, 2);
      ta.onclick = e => e.stopPropagation(); ta.onkeydown = e => e.stopPropagation();
      pop.appendChild(ta);
      imp.onclick = () => {
        let data; try { data = JSON.parse(ta.value); } catch (e) { toast('Invalid JSON: ' + e.message); return; }
        const raw = Array.isArray(data) ? data : (data.templates || []);
        if (!Array.isArray(raw)) { toast('JSON needs a "templates" array'); return; }
        const clean = raw.filter(t => t && t.name).map(t => Array.isArray(t.members)
          ? { name: String(t.name), members: t.members.map(String) }
          : { name: String(t.name), find: String(t.find || ''), replace: String(t.replace || ''), re: !!t.re });
        SETTINGS.srTemplates = clean;
        const def = !Array.isArray(data) ? data.default : '';
        SETTINGS.srDefault = (def && clean.some(t => t.name === def)) ? String(def) : '';
        saveSettings();
        toast('Imported ' + clean.length + ' pattern' + (clean.length === 1 ? '' : 's') + ' / chain(s)');
        render();
      };
    };
    const mkRow = (cells, onClick, extras) => {
      const row = document.createElement('div'); row.className = 'tc-srtpl-row' + (extras && extras.isDefault ? ' tc-srtpl-defrow' : '');
      cells.forEach(c => { const s = document.createElement('span'); s.className = c.cls; s.textContent = c.txt; s.title = c.txt; row.appendChild(s); });
      const rec = document.createElement('span'); rec.className = 'tc-srtpl-re'; rec.textContent = extras && extras.re ? 'RE' : ''; row.appendChild(rec);
      const tail = document.createElement('span'); tail.className = 'tc-srtpl-tail';
      // #410: mark this pattern/chain as the default (runs on Tracklist open). Filled ◉ + always
      // visible when it IS the default; a faint ○ on hover otherwise.
      if (extras && extras.onDefault) { const d = document.createElement('button'); d.type = 'button'; d.className = 'tc-srtpl-def' + (extras.isDefault ? ' on' : ''); d.textContent = extras.isDefault ? '◉' : '○'; d.title = extras.isDefault ? 'Default — runs on Tracklist open · click to unset' : 'Set as default — runs on Tracklist open'; d.onclick = e => { e.stopPropagation(); extras.onDefault(); }; tail.appendChild(d); }
      // #409: hover action — add this (non-chain) pattern to a chain
      if (extras && extras.onAddChain) { const c = document.createElement('button'); c.type = 'button'; c.className = 'tc-srtpl-chainadd'; c.textContent = '⛓'; c.title = 'Add / remove this pattern in a chain'; c.onclick = e => { e.stopPropagation(); extras.onAddChain(c); }; tail.appendChild(c); }
      // #409: hover action — rename this pattern / chain in place
      if (extras && extras.onRename) { const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'tc-srtpl-rename'; ed.textContent = '✎'; ed.title = 'Rename'; ed.onclick = e => { e.stopPropagation(); startRename(row, extras.renameValue, extras.onRename); }; tail.appendChild(ed); }
      if (extras && extras.onRemove) { const x = document.createElement('button'); x.type = 'button'; x.className = 'tc-srtpl-x'; x.textContent = '✕'; x.title = 'Remove'; x.onclick = e => { e.stopPropagation(); extras.onRemove(); }; tail.appendChild(x); }
      row.appendChild(tail);
      row.onclick = onClick; row.onmousemove = () => { sel = navRows.indexOf(row); highlight(); };
      navRows.push(row); return row;
    };
    // #409: inline rename — turn the row's name cell into a text field; Enter/blur commits.
    const startRename = (row, curName, cb) => {
      const nmCell = row.querySelector('.tc-srtpl-nm'); if (!nmCell) return;
      const prev = nmCell.textContent;
      const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'tc-srtpl-renameinp'; inp.value = curName || '';
      nmCell.textContent = ''; nmCell.appendChild(inp); inp.focus(); inp.select();
      let done = false;
      const finish = (commit) => {
        if (done) return; done = true;
        if (commit && cb(inp.value)) { render(); return; }
        if (commit) toast('Name is empty or already used');
        nmCell.textContent = prev;
      };
      inp.onclick = e => e.stopPropagation();
      inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
      inp.onblur = () => finish(true);
    };
    // #409: a small inline picker (child of the popup, so it doesn't trigger the outside-close)
    // listing every chain with a ✓/○ membership toggle for the given pattern.
    const openChainPicker = (btn, itemName) => {
      const ex = pop.querySelector('.tc-srtpl-cpick'); if (ex) { ex.remove(); if (ex._for === itemName) return; }
      const chains = srTemplates().filter(srIsChain).sort((a, b) => a.name.localeCompare(b.name));
      const menu = document.createElement('div'); menu.className = 'tc-srtpl-cpick'; menu._for = itemName;
      if (!chains.length) { const e = document.createElement('div'); e.className = 'tc-srtpl-cpick-empty'; e.textContent = 'No chains yet — use ＋ Add chain'; menu.appendChild(e); }
      else chains.forEach(c => { const isM = (c.members || []).includes(itemName); const row = document.createElement('div'); row.className = 'tc-srtpl-cpick-row'; row.textContent = (isM ? '✓ ' : '○ ') + c.name; row.onclick = e => { e.stopPropagation(); srChainToggle(c.name, itemName); render(); }; menu.appendChild(row); });
      pop.appendChild(menu);
      const br = btn.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      menu.style.left = Math.max(4, br.right - pr.left - menu.offsetWidth) + 'px';
      menu.style.top = (br.bottom - pr.top + 2) + 'px';
    };
    const render = () => {
      pop.innerHTML = ''; navRows = []; sel = -1;
      // header: "Saved" + inline "Save current" that unrolls a name field
      const hd = document.createElement('div'); hd.className = 'tc-srtpl-hd';
      // #409 redesign: no "Patterns" label; action buttons on the LEFT, Import/Export on the RIGHT.
      const saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'tc-srtpl-savebtn'; saveBtn.textContent = '＋ Save current';
      const wrap = document.createElement('span'); wrap.className = 'tc-srtpl-savewrap'; wrap.style.display = 'none';
      const nm = document.createElement('input'); nm.type = 'text'; nm.className = 'tc-srtpl-name'; nm.placeholder = 'name this pattern';
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'tc-srtpl-saveok'; ok.textContent = '✓'; ok.title = 'Save';
      // #409: "Add chain" button next to "Save current", each unrolling its own name field
      const chainBtn = document.createElement('button'); chainBtn.type = 'button'; chainBtn.className = 'tc-srtpl-savebtn tc-srtpl-chainbtn'; chainBtn.textContent = '＋ Add chain'; chainBtn.title = 'Create a chain that runs several saved patterns in one click';
      const cwrap = document.createElement('span'); cwrap.className = 'tc-srtpl-savewrap'; cwrap.style.display = 'none';
      const cnm = document.createElement('input'); cnm.type = 'text'; cnm.className = 'tc-srtpl-name'; cnm.placeholder = 'name this chain';
      const cok = document.createElement('button'); cok.type = 'button'; cok.className = 'tc-srtpl-saveok'; cok.textContent = '✓'; cok.title = 'Create chain';
      const resetHd = () => { saveBtn.style.display = ''; chainBtn.style.display = ''; wrap.style.display = 'none'; cwrap.style.display = 'none'; };
      const doSave = () => { if (srSaveTemplate(nm.value, findEl.value, repEl.value)) render(); };
      const doAddChain = () => { if (srAddChain(cnm.value)) render(); else toast('Name is empty or already used'); };
      ok.onclick = doSave; cok.onclick = doAddChain;
      nm.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doSave(); } else if (e.key === 'Escape') { e.preventDefault(); resetHd(); } };
      cnm.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doAddChain(); } else if (e.key === 'Escape') { e.preventDefault(); resetHd(); } };
      saveBtn.onclick = () => { if (!findEl.value.trim()) { toast('Type a search first, then save it'); return; } saveBtn.style.display = 'none'; chainBtn.style.display = 'none'; wrap.style.display = ''; nm.value = ''; setTimeout(() => nm.focus(), 0); };
      chainBtn.onclick = () => { saveBtn.style.display = 'none'; chainBtn.style.display = 'none'; cwrap.style.display = ''; cnm.value = ''; setTimeout(() => cnm.focus(), 0); };
      // #409 redesign: Import/Export button, pushed to the right edge of the header.
      const ioBtn = document.createElement('button'); ioBtn.type = 'button'; ioBtn.className = 'tc-srtpl-iobtn'; ioBtn.textContent = 'Import/Export'; ioBtn.title = 'Import or export your saved patterns & chains as JSON (history is not included)';
      ioBtn.onclick = () => showImportExport();
      wrap.append(nm, ok); cwrap.append(cnm, cok); hd.append(saveBtn, chainBtn, wrap, cwrap, ioBtn); pop.appendChild(hd);
      // #409: Chains first — click to run all their member patterns in order; ✕ removes the chain
      const chains = srTemplates().filter(srIsChain).sort((a, b) => a.name.localeCompare(b.name));
      if (chains.length) {
        const sec = document.createElement('div'); sec.className = 'tc-srtpl-sec'; sec.textContent = 'Chains'; pop.appendChild(sec);
        chains.forEach(c => { const mem = (c.members || []); const summary = mem.length ? mem.join(' → ') : '(empty — add patterns with ⛓)';
          pop.appendChild(mkRow(
            [{ cls: 'tc-srtpl-nm tc-srtpl-chnm', txt: '⛓ ' + c.name }, { cls: 'tc-srtpl-f tc-srtpl-chm', txt: summary }, { cls: 'tc-srtpl-r', txt: '' }],
            () => { if (!mem.length) { toast('Empty chain — add patterns to it first (⛓ on a saved row)'); return; } srApplyChain(c); srShowChain(c.name); closeSrTemplates(); },
            { isDefault: srDefaultName() === c.name, onDefault: () => { srSetDefault(c.name); render(); }, onRename: (v) => srRenameTemplate(c.name, v), renameValue: c.name, onRemove: () => { srRemoveTemplate(c.name); render(); } })); });
      }
      // saved (named, non-chain) templates — internal "_"-prefixed names never show here
      const saved = srTemplates().filter(t => !srIsChain(t) && t.name && t.name[0] !== '_').sort((a, b) => a.name.localeCompare(b.name));
      if (saved.length) { const sec = document.createElement('div'); sec.className = 'tc-srtpl-sec'; sec.textContent = 'Saved'; pop.appendChild(sec);
        saved.forEach(t => pop.appendChild(mkRow(
          [{ cls: 'tc-srtpl-nm', txt: t.name }, { cls: 'tc-srtpl-f', txt: t.find }, { cls: 'tc-srtpl-r', txt: t.replace }],
          () => applyEntry(t.find, t.replace, t.re), { re: t.re, isDefault: srDefaultName() === t.name, onDefault: () => { srSetDefault(t.name); render(); }, onAddChain: (btn) => openChainPicker(btn, t.name), onRename: (v) => srRenameTemplate(t.name, v), renameValue: t.name, onRemove: () => { srRemoveTemplate(t.name); render(); } }))); }
      else if (!chains.length) { const e = document.createElement('div'); e.className = 'tc-srtpl-empty'; e.textContent = 'No saved patterns yet — use ＋ Save current.'; pop.appendChild(e); }
      // history — the 5 most-recent, COLLAPSED by default (#409): the header is a toggle; rows render
      // only when expanded (so they stay out of keyboard nav while collapsed).
      const hist = srHistoryList();
      if (hist.length) {
        const open = SETTINGS.srHistoryOpen === true;
        const div = document.createElement('div'); div.className = 'tc-srtpl-sec tc-srtpl-sectog'; div.style.cursor = 'pointer';
        div.innerHTML = `<span class="tc-srtpl-caret">${open ? '▾' : '▸'}</span> History`;
        div.onclick = () => { SETTINGS.srHistoryOpen = !open; saveSettings(); render(); };
        pop.appendChild(div);
        if (open) hist.slice(0, 5).forEach(h => pop.appendChild(mkRow(
          [{ cls: 'tc-srtpl-nm tc-srtpl-hnm', txt: '' }, { cls: 'tc-srtpl-f', txt: h.find }, { cls: 'tc-srtpl-r', txt: h.replace }],
          () => applyEntry(h.find, h.replace, h.re), { re: h.re })));
      }
    };
    render();
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    _srPopOff = e => { if (!pop.contains(e.target) && e.target !== anchor) closeSrTemplates(); };
    setTimeout(() => document.addEventListener('mousedown', _srPopOff, true), 0);
    _srPopKey = e => {   // ↑/↓ navigate, Enter loads, Esc closes — unless typing in the name field
      if (document.activeElement && document.activeElement.className === 'tc-srtpl-name') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (navRows.length) { sel = Math.min(navRows.length - 1, sel + 1); highlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (navRows.length) { sel = Math.max(0, sel - 1); highlight(); } }
      else if (e.key === 'Enter') { if (sel >= 0 && navRows[sel]) { e.preventDefault(); navRows[sel].click(); } }
      else if (e.key === 'Escape') { e.preventDefault(); closeSrTemplates(); findEl.focus(); }
    };
    document.addEventListener('keydown', _srPopKey, true);
  }

  const BAR = `<div class="tc-tools"><span class="tc-toolslabel" data-act="toolsmenu" title="more tools &amp; customize">Tools ▾</span><span class="tc-toolbtns"></span></div>`
    + `<span class="tc-toast"></span><span class="tc-disc-msg"></span><span class="tc-discstat"></span><span class="tc-globalstat"></span><label class="tc-am-lbl"><b>Change</b> ${AM_SELECT}</label><span class="tc-tbsep"></span><button class="tc-btn primary" data-act="match" title="search MusicBrainz for the unmatched artists">⚡ Match</button>`
    + `<button class="tc-btn tc-caret" data-act="revertmenu" title="revert / clear all">▾</button>`;   // gear moved to the Apollo launcher

  /* ── floating window (kept for tests; the in-page table is the real UI) ── */
  function openPanel() {
    style(); const ex = document.getElementById('tc-panel'); if (ex) ex.remove(); const l = document.getElementById('tc-launch'); if (l) { l.remove(); mbRestackCorner('br'); }
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
  // #472: med.tracks.subscribe below only fires on STRUCTURAL changes to that
  // array (added/removed/reordered) — a track edited IN PLACE (a bookmarklet
  // calling tr.name(newName) or tr.artistCredit({...}) directly, or driving
  // MB's own inputs which round-trip to those same setters) never touches the
  // array itself, so it went unnoticed until a full off/on toggle forced a
  // reload. Subscribe each track's own name/artistCredit observables too.
  const subTrack = tr => {
    if (!tr || tr._tcTrackSub) return;
    if (tr.name && tr.name.subscribe) tr.name.subscribe(() => { if (!_selfEdit) scheduleSync(); });
    if (tr.artistCredit && tr.artistCredit.subscribe) tr.artistCredit.subscribe(() => { if (!_selfEdit) scheduleSync(); });
    tr._tcTrackSub = true;
  };
  function subscribeTracks() {
    const rel = release(); if (!rel) return;
    const subMed = med => {
      if (!med || med._tcSub) return;
      if (med.tracks && med.tracks.subscribe) {
        med.tracks.subscribe(() => { if (!_selfEdit) { (u(med.tracks) || []).forEach(subTrack); scheduleSync(); } });
        med._tcSub = true;
      }
      (u(med.tracks) || []).forEach(subTrack);
    };
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
    b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = '10';
    const lbl = document.createElement('span'); lbl.className = 'tc-launch-lbl'; lbl.title = 'Toggle Apollo / the original editor for ALL tabs — stays this way (across pages) until you switch back';
    lbl.onclick = () => {   // GLOBAL toggle — flips Apollo for every tab/feature and persists across pages
      SETTINGS.apolloEnabled = !apolloEnabled(); saveSettings();
      applyView(); applyNav(); applyAnnotationPage();
    };
    const gear = document.createElement('span'); gear.className = 'tc-launch-gear'; gear.textContent = '⚙︎'; gear.title = 'Apollo Editor settings';
    gear.onclick = () => openSettings(gear);   // the one settings entry point — gear removed from the toolbars
    b.append(lbl, gear);
    document.body.appendChild(b); relabelLauncher();
    mbRestackCorner('br');
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
      if (editorEl()) { ensureLauncher(); wireTabFlush(); } else { const l = document.getElementById('tc-launch'); if (l) { l.remove(); mbRestackCorner('br'); } }   // #135: the switch shows on every tab; #145: flush the takeover on tab clicks
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
  // #187/#298: similarity = how many tracks line up AT THE SAME POSITION between the
  // candidate release and the one being entered, over the larger tracklist — the very
  // pairing the comparison view (buildDupDetail) reds row by row. Greedy any-position
  // matching read 100% for a release with the SAME songs in a DIFFERENT order, while
  // the position-by-position comparison showed those rows red (#298). A position
  // matches when its TITLE matches (fold-equal or fuzzy ≥0.85) AND its ARTIST agrees
  // (folded; empty on either side — single-artist releases — falls back to title).
  // Release-level metadata (name/count) is still deliberately ignored.
  const _simRatio = (a, b) => a === b ? 1 : 1 - recLev(a, b) / Math.max(a.length, b.length, 1);
  const _titleOk = (a, b) => a === b || _simRatio(a, b) >= 0.85;
  // #332: artist is a soft FACTOR, not an exact gate. A fuller credit ("Roy Ayers" vs
  // "Roy Ayers Ubiquity", "Horace Tapscott" vs "Horace Tapscott with …") or a near-variant
  // ("Phil"/"Philip", "&"/"and") is the SAME track — exact-only matching scored those as misses
  // and tanked an otherwise-identical release (62% when it should read ~90%).
  const _artistPrefix = (a, b) => { const s = a.length <= b.length ? a : b, l = a.length <= b.length ? b : a; return s.length >= 3 && l.startsWith(s) && (l.length === s.length || l[s.length] === ' '); };
  const _artistFactor = (a, b) => (!a || !b || a === b) ? 1 : (_artistPrefix(a, b) || _simRatio(a, b) >= 0.7) ? 0.85 : 0.5;
  function dupTrackScore(media, entered) {
    const cand = [];
    (media || []).forEach(m => (m.tracks || []).forEach(t => cand.push({ t: fold(t.title || ''), a: fold(t.artist || '') })));
    const ent = (entered || []).map(t => ({ t: fold(t.title || ''), a: fold(t.artist || '') }));   // keep positions
    if (!ent.some(x => x.t) || !cand.length) return null;   // can't judge overlap → no confident score
    let matched = 0;
    const n = Math.min(ent.length, cand.length);
    for (let i = 0; i < n; i++) { const e = ent[i], c = cand[i]; if (e.t && c.t && _titleOk(e.t, c.t)) matched += _artistFactor(e.a, c.a); }   // title gates; artist scales
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
      const candTracks = media ? media.reduce((n, m) => n + ((m.tracks || []).length || 0), 0) : NaN;   // #187: candidate's actual track count
      paintDupCell(td, tr, gid, media ? dupTrackScore(media, enteredTracklist()) : null, candTracks);
      await new Promise(z => setTimeout(z, 1100));
    }
    _dupBusy = false;
  }
  function paintDupCell(td, tr, gid, sim, candTracks) {
    if (sim == null) {
      td.textContent = '?'; td.style.cssText = 'text-align:center;color:#999' + (gid ? ';cursor:pointer' : '');
      td.title = 'no track overlap could be computed (tracklist unavailable, or no tracks entered yet)';
      if (gid) td.onclick = () => toggleDupDetail(tr, gid, td);
      return;
    }
    const pct = Math.round(sim * 100);
    // #187: flag a track-count mismatch (still scored — the % is useful when a
    // platform just has a few extra/fewer tracks) so the number isn't read as a
    // full match. Only when we actually have a tracklist entered to compare.
    const myTracks = mediums().reduce((n, m) => n + ((u(m.tracks) || []).length || 0), 0);
    const trackMiss = myTracks > 0 && !isNaN(candTracks) && candTracks !== myTracks;
    td.innerHTML = pct + '%' + (trackMiss ? ' <span class="tc-dup-tm">⚠ tracks</span>' : '');
    td.style.cssText = 'background:' + dupColor(pct) + ';color:#fff;font-weight:700;text-align:center;border-radius:3px;padding:1px 6px' + (gid ? ';cursor:pointer' : '');
    td.title = 'track-overlap similarity to the release you are entering' + (gid ? ' — click for a track-by-track comparison' : '');
    if (trackMiss) td.title += ` — track count differs: you entered ${myTracks}, this release has ${candTracks}`;
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
  // #358: render a WS2 artist credit as per-artist links (each credited name → /artist/<gid>),
  // keeping the join phrases as plain text. Used for the existing release's artists in the
  // Duplicates comparison so you can click through to each artist.
  function acLinksJson(ac) {
    return (ac || []).map(n => {
      const gid = n.artist && n.artist.id, nm = n.name || (n.artist && n.artist.name) || '';
      const cell = gid ? `<a href="${ORIGIN}/artist/${gid}" target="_blank" rel="noopener">${esc(nm)}</a>` : esc(nm);
      return cell + esc(n.joinphrase || '');
    }).join('');
  }
  async function fetchDupTracklist(gid) {
    try {
      const j = await fetch(`${ORIGIN}/ws/2/release/${gid}?inc=artist-credits+recordings&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      return (j.media || []).map((m, mi) => ({
        position: m.position || mi + 1, format: m.format || '',
        tracks: (m.tracks || []).map(t => {
          const ac = t['artist-credit'] || (t.recording && t.recording['artist-credit']) || [];
          return {
            pos: t.number || t.position || '',
            title: t.title || (t.recording && t.recording.title) || '',
            artist: acJoinJson(ac),
            artistAc: ac,   // #358: raw credit → per-artist links on the existing (left) side
            recGid: (t.recording && t.recording.id) || '',   // existing (left) title → link to the MB recording
            len: t.length || (t.recording && t.recording.length) || null,
          };
        }),
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
  // Char-diff with a cutoff (#187): when the two strings share too little, a
  // scattered per-character highlight reads as "almost the same" — misleading
  // when the titles are nothing alike. Below the cutoff we mark the WHOLE side
  // instead (like the original MB Release Seeding Helper), so a real mismatch is
  // obvious and clearly outweighs a small length gap. `want` = -1 left/existing, 1 right/seeded.
  const DUP_DIFF_CUTOFF = 0.4;
  function dupDiffOrWhole(a, b, want) {
    a = a || ''; b = b || '';
    const self = want === -1 ? a : b;
    if (!self) return '';
    const segs = dupCharDiff(a, b);
    if (!segs) return esc(self);
    const common = segs.reduce((n, s) => n + (s.t === 0 ? s.s.length : 0), 0);
    if (common / Math.max(a.length, b.length, 1) < DUP_DIFF_CUTOFF)
      return '<span class="tc-dh">' + esc(self) + '</span>';   // too different → whole line
    return dupDiffSide(segs, want);
  }
  // #358: do two strings differ "wholly" (below the char-diff cutoff)? Used to decide
  // whether the linked left-artist cell gets a whole-cell mismatch highlight.
  function dupWholeDiff(a, b) {
    a = a || ''; b = b || ''; if (a === b) return false;
    const segs = dupCharDiff(a, b); if (!segs) return true;
    const common = segs.reduce((n, s) => n + (s.t === 0 ? s.s.length : 0), 0);
    return common / Math.max(a.length, b.length, 1) < DUP_DIFF_CUTOFF;
  }
  // #480 (majkinetor): "we don't need subsecond comparison as that is not a
  // thing. Up to 3s difference should be very mild color and should go darker
  // from there" — then, on the ramp's span: "change it so it ramps up from 3
  // to 30s". Shared alpha curve for both the recordings detailed-highlight
  // shade (lenShade) and this duplicates-panel one (dupLenShade) — they're
  // deliberately kept as mirrors of each other (#186). Under 1s: no shade at
  // all. 1-3s: a flat, mild tint — a gap this small is common and not worth
  // alarming over. 3-30s: ramps up toward full strength. 30s+: solid/full.
  function lenShadeAlpha(gapMs) {
    const g = Math.abs(gapMs || 0);
    if (g < 1000) return null;
    if (g >= 30000) return 1;
    if (g < 3000) return 0.12;
    return 0.12 + 0.88 * ((g - 3000) / 27000);
  }
  // graded length-gap shade — same as the recordings detailed highlight (#186). null under 1s.
  function dupLenShade(gapMs) {
    const a = lenShadeAlpha(gapMs); if (a === null) return null;
    if (a >= 1) return { bg: '#d32f2f', fg: '#fff' };
    return { bg: 'rgba(211,47,47,' + a.toFixed(2) + ')', fg: a >= 0.55 ? '#fff' : '#7a0000' };
  }
  function buildDupDetail(media, entered) {
    let gi = 0, rows = '';
    media.forEach((med, mi) => {
      rows += `<tr class="tc-dd-medhdr"><td colspan="7">#${med.position || mi + 1}${med.format ? ' ' + esc(med.format) : ''}</td></tr>`;
      med.tracks.forEach(t => {
        const s = entered[gi]; gi++; const has = !!s;   // a seeded counterpart at this position?
        // title + artist: per-character diff with a cutoff (#187 — a wholly
        // different title is marked whole, not as scattered characters).
        const titleExInner = has ? dupDiffOrWhole(t.title || '', s.title || '', -1) : esc(t.title || '');
        // link the existing (left) title to its MB recording, keeping the char-diff highlight inside
        const titleEx = t.recGid ? `<a href="${ORIGIN}/recording/${t.recGid}" target="_blank" rel="noopener">${titleExInner}</a>` : titleExInner;
        const titleSe = has ? dupDiffOrWhole(t.title || '', s.title || '', 1)  : '';
        // #358: existing (left) artists as per-artist links; keep the whole-cell "differs"
        // cue when they diverge below the cutoff (partial diffs just show the links).
        const artExLinks = acLinksJson(t.artistAc);
        const artEx   = has && dupWholeDiff(t.artist || '', s.artist || '') ? `<span class="tc-dh">${artExLinks}</span>` : artExLinks;
        const artSe   = has ? dupDiffOrWhole(t.artist || '', s.artist || '', 1)  : '';
        // length: graded shade on both Len cells when the gap is real (#186)
        const sh = (has && t.len && s.len) ? dupLenShade(t.len - s.len) : null;
        const lenSt = sh ? ` style="background:${sh.bg};color:${sh.fg}"` : '';
        // title-then-artist column order, to match the rest of the UI (#187)
        rows += `<tr class="tc-dd-row"><td class="tc-dd-pos">${esc(String(t.pos || gi))}</td>`
          + `<td>${titleEx}</td><td>${artEx}</td><td class="tc-dd-len"${lenSt}>${dupFmtLen(t.len)}</td>`
          + `<td>${titleSe}</td><td>${artSe}</td><td class="tc-dd-len"${lenSt}>${has ? dupFmtLen(s.len) : ''}</td></tr>`;
      });
    });
    return `<table class="tc-dd-tbl"><thead><tr><th>Pos</th><th>Release title</th><th>Release artist</th><th>Len</th><th>Seeded title</th><th>Seeded artist</th><th>Len</th></tr></thead><tbody>${rows}</tbody></table>`;
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
      .tc-dd-tbl a { color: inherit; text-decoration: underline; text-decoration-color: rgba(0,0,0,.28); text-underline-offset: 2px; }   /* #358: left-artist links, readable on normal + mismatch cells */
      .tc-dd-tbl a:hover { text-decoration-color: currentColor; }
      .tc-dd-tbl .tc-cf { display: inline-block; padding: 0 .5px; }
      #duplicates-tab .tc-dup-sim .tc-dup-tm { display: inline-block; margin-left: 4px; font-weight: 600; font-size: 10px; opacity: 0.92; white-space: nowrap; }`;
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
    const otherArr = other || [];
    const otherSet = new Set(otherArr.map(key));
    // key → the other side's credited-as text, so a SAME-entity credit whose *text*
    // differs (a credited-as change — same artist, different phrasing) still gets the
    // per-character highlight (#444). It doesn't affect matching (credited-as never
    // does), it just makes the difference visible like a title diff does.
    const otherName = new Map(); otherArr.forEach(a => { const k = key(a); if (!otherName.has(k)) otherName.set(k, a.name || ''); });
    return (self || []).map((a, i) => {
      const sameEntity = otherSet.has(key(a));
      let nm;
      if (sameEntity) {
        const on = otherName.get(key(a));
        const segs = (on != null && (a.name || '') !== on) ? charDiff(a.name || '', on) : null;   // #444 credited-as text diff
        nm = segs ? diffSide(segs, -1) : dhRun(a.name);   // -1 = this side's unique chars (self is always "this" column)
      } else {
        nm = dhRun(a.name);
      }
      const inner = a.gid ? '<a href="' + ORIGIN + '/artist/' + esc(a.gid) + '" target="_blank" rel="noopener">' + nm + '</a>' : nm;
      const boxed = sameEntity ? inner : '<span class="tc-dh">' + inner + '</span>';   // a DIFFERENT entity is boxed whole; a same-entity credited-as is char-diffed above
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
    // #369 NOT U+002D hyphen-minus — it's the correct, standard hyphen in MB titles ("Cat-O-Nine",
    // "Afro-Jamaican"), so enlarging+bolding every one of them just mangled normal text. Its LOOK-ALIKES
    // (real hyphen, non-breaking hyphen, dashes, minus) stay flagged so an odd one still stands out.
    [0x2010, 'hyphen'], [0x2011, 'non-breaking hyphen'], [0x2012, 'figure dash'],
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
  // "punctuation size" setting (px). Straight ' " are marked too (MB style prefers curly), but a plain
  // hyphen-minus is NOT — it's the correct char (#369). px = 0 disables it (master switch).
  // #443: the confusable / invisible marking (and the missing-space markers) belong to
  // **detailed highlighting** — they must show whenever it's on, so an invisible char (a
  // no-break space, a missing space) can never hide. "Enlarge punctuation" (px) is only
  // the enlargement amount, NOT a master switch: at 0px the markers are still drawn
  // (invisibles as their glyph, all named on hover), just not enlarged. Before, 0px
  // silently disabled everything — which surprised (a missing space vanished, #443).
  const dhMark = () => (SETTINGS.recPunctSize | 0) > 0 || !!SETTINGS.recDetailedHl;
  function dhRun(str) {
    if (!dhMark()) return esc(String(str));
    const px = SETTINGS.recPunctSize | 0;
    const st = px > 0 ? ' style="font-size:calc(1em + ' + px + 'px);font-weight:700;line-height:1"' : '';   // px enlarges only
    let out = '';
    for (const ch of String(str)) {
      const cf = CONFUSABLE[ch];
      if (!cf) { out += esc(ch); continue; }
      // invisibles carry a persistent highlight (like the join ␣) so they're obvious at any size
      const cls = 'tc-cf' + (cf.vis ? ' tc-cf-inv' : '');
      out += '<span class="' + cls + '"' + st + ' title="' + esc(cf.n + ' (U+' + cf.c + ')') + '">' + esc(cf.vis || ch) + '</span>';
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
    if (!dhMark()) return esc(j);                // #443: gated by detailed highlighting, not the px size
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
    const a = lenShadeAlpha(gapMs); if (a === null) return null;   // #480: shared curve with dupLenShade
    const { r, g: gg, b } = hlRgb();
    if (a >= 1) return { bg: `rgb(${r},${gg},${b})`, fg: '#fff' };
    return { bg: `rgba(${r},${gg},${b},${a.toFixed(2)})`, fg: a >= 0.55 ? '#fff' : `rgb(${Math.round(r * 0.42)},${Math.round(gg * 0.42)},${Math.round(b * 0.42)})` };
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
        recVideo: rec ? !!u(rec.video) : false,   // #303 — native recordings table shows a video marker; mirror it here
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
      '#tc-recwrap{margin:4px 0 12px;font:13px/1.4 Arial}',   // #369 match the Tracklist font (was system-ui) so curly quotes/apostrophes render the same in both tables, not as system-ui prime-like glyphs
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
      // #376 pending-edit recordings — gold tint + gold title (!important to beat the higher-specificity zebra)
      '.tc-rectbl tr.tc-recrow.tc-rec-pending td:nth-child(2){background:#ffdd99!important;border-radius:3px}',   // #376 title pending
      '.tc-rectbl tr.tc-recrow.tc-art-pending td:nth-child(3){background:#ffdd99!important;border-radius:3px}',   // #376 artist pending
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
      '.tc-cf-inv{background:var(--tc-hl,#e53935);color:#fff;border-radius:2px;padding:0 1px}',   // #443 invisible/whitespace char — always visible (glyph + wash), even at 0px enlargement
      '.tc-jp{display:inline-block;background:var(--tc-hl,#e53935);color:#fff;border-radius:2px;padding:0 1px;font-weight:700}',   // #208 missing space (␣) / missing join phrase (␣?␣) around a join phrase',
      '.tc-rectbl td.tc-dh-len{font-weight:600;border-radius:2px}',   // #186 graded length-gap shade (inline bg)',
      '.tc-rectbl td.tc-copy{background:#e3f4e7;color:#1f7a44;font-style:italic}',   // flagged to copy the track value on submit
      '.tc-rectbl .tc-rec-orig{text-decoration:line-through;opacity:.55;font-style:normal;font-weight:400}',   // recording original kept beside the → preview #146
      '.tc-rectbl .tc-rec-disamb{color:#999;font-weight:400}',   // recording disambiguation, grey like native #144
      '.tc-rec-video{display:inline-flex;vertical-align:-2px;color:#6f42c1;margin-left:1px}',   // recording video marker (table + picker) #303
      '.tc-rec-video svg{display:block}',
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
  //   Ctrl+Alt   → both fields on every row = the whole side of the table (#443). The two
  //                sides copy in opposite directions, so the full table is two gestures.
  function wireRecCellContextMenu(wrap) {
    const tbl = wrap.querySelector('.tc-rectbl'); if (!tbl) return;
    const copyOn = (t, f) => f === 'title' ? !!u(t.updateRecordingTitle) : !!u(t.updateRecordingArtist);
    const eligible = (t, f) => !!t && (nativeDiffFlag(t, f) || copyOn(t, f));
    tbl.addEventListener('contextmenu', e => {
      const tr = e.target.closest('tr.tc-recrow'); if (!tr) return;
      const recRows = () => wrap.querySelectorAll('tbody tr.tc-recrow');
      const wholeSide = e.ctrlKey && e.altKey;   // #443: both fields, every row = the whole side
      // #443 whole-side sweep for the track side (recording -> track): copy a recording's
      // title AND artist onto its track for one row, reused across every row in the gesture.
      // Mirrors the per-field setters below; the shared cache fetches each artist entity once.
      const _sideEntCache = new Map();
      const copyRecToTrack = async (m, i) => {
        const t = koTrack(m, i); if (!t) return;
        const rec = u(t.recording);
        const rn = rec ? u(rec.name) : null;
        if (rn != null && rn !== '' && u(t.name) !== rn) { _selfEdit = true; try { t.name(rn); } catch (x) {} finally { _selfEdit = false; } }
        if (u(t.updateRecordingTitle)) setCopy('title', { mi: m, ti: i }, false);   // now equal -> clear the moot flag
        const recAc = rec && u(rec.artistCredit), recNames = recAc && (u(recAc.names) || []);
        if (recNames && recNames.length) {
          const nk = n => (n.artist ? (u(u(n.artist).gid) || '') : '') + '|' + (u(n.name) || '') + '|' + (u(n.joinPhrase) || '');
          const tNames = u(u(t.artistCredit).names) || [];
          const same = tNames.length === recNames.length && tNames.every((n, k) => nk(n) === nk(recNames[k]));
          if (!same) {
            const names = [];
            for (const n of recNames) {
              const a = u(n.artist), gid = a && u(a.gid);
              let full = null; if (gid) { if (!_sideEntCache.has(gid)) _sideEntCache.set(gid, await fetchEntity(gid)); full = _sideEntCache.get(gid); }
              names.push({ artist: full || a, name: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '' });   // full entity persists the match (#348)
            }
            _selfEdit = true; try { t.artistCredit({ names }); } catch (x) { Log.warn(`#443 side copy: track ${m}.${i} artistCredit setter threw: ${x && x.message}`); } finally { _selfEdit = false; }
          }
          if (u(t.updateRecordingArtist)) setCopy('artist', { mi: m, ti: i }, false);
        }
      };
      // #348: right-click a TRACK title cell → set the track NAME to its recording's name, IMMEDIATELY
      // (the mirror of copying track→recording). It's a real title edit, so the Tracklist tab shows the
      // row changed and its ↺ reverts it. Alt = do the whole column.
      if (e.target.closest('td.tc-tkt')) {
        e.preventDefault();
        if (wholeSide) { (async () => { for (const row of recRows()) await copyRecToTrack(+row.dataset.mi, +row.dataset.ti); _tlRefreshed = false; scheduleSync(); rerenderRec(); })(); return; }   // #443 whole track side
        const setFromRec = (m, i) => {
          const t = koTrack(m, i); const rec = t && u(t.recording); const rn = rec ? u(rec.name) : null;
          if (rn != null && rn !== '' && u(t.name) !== rn) { _selfEdit = true; try { t.name(rn); } catch (x) {} finally { _selfEdit = false; } }
          // #420: the track title now equals the recording's, so a pending "rename recording"
          // flag is a no-op — clear it (and its green indicator) instead of leaving it stale.
          if (t && u(t.updateRecordingTitle)) { setCopy('title', { mi: m, ti: i }, false); Log.info(`#420 track ${m}.${i}: title copied from recording — cleared the now-moot rename-recording flag`); }
        };
        if (e.altKey) wrap.querySelectorAll('tbody tr.tc-recrow').forEach(row => setFromRec(+row.dataset.mi, +row.dataset.ti));
        else setFromRec(+tr.dataset.mi, +tr.dataset.ti);
        _tlRefreshed = false; scheduleSync();   // #348: title changed here (a self-edit the watcher ignores) — re-sync the Tracklist mirror so the new title + changed-row marker show reliably, not on a racy tab-switch
        rerenderRec();
        return;
      }
      // #348: right-click a TRACK artist cell → set the track's ARTIST CREDIT to its recording's, immediately. Alt = whole column.
      if (e.target.closest('td.tc-tka')) {
        e.preventDefault();
        if (wholeSide) { (async () => { for (const row of recRows()) await copyRecToTrack(+row.dataset.mi, +row.dataset.ti); _tlRefreshed = false; scheduleSync(); rerenderRec(); })(); return; }   // #443 whole track side
        // entity-aware equality: same artist GID + credited-as + join phrase per name. NOT acText — two
        // different artists sharing a credited name ("Mariz" ≠ "Mariz") must still copy the recording's entity.
        const nameKey = n => (n.artist ? (u(u(n.artist).gid) || '') : '') + '' + (u(n.name) || '') + '' + (u(n.joinPhrase) || '');
        const _entCache = new Map();   // gid → full entity, so a whole-column copy fetches each artist once
        const fullEntity = async gid => { if (!_entCache.has(gid)) _entCache.set(gid, await fetchEntity(gid)); return _entCache.get(gid); };
        const setArtistFromRec = async (m, i) => {
          const t = koTrack(m, i), rec = t && u(t.recording), recAc = rec && u(rec.artistCredit);
          const recNames = recAc && (u(recAc.names) || []);
          if (!recNames || !recNames.length) { Log.warn(`#348 artist copy: track ${m}.${i} — recording has no artist credit (recording ${rec ? 'present' : 'null'}) — nothing to copy`); return; }
          // #420 (artist twin): once track and recording agree, a pending "update recording
          // artist" flag is a no-op — clear it so its indicator doesn't linger.
          const clearMootArtistFlag = () => { if (u(t.updateRecordingArtist)) { setCopy('artist', { mi: m, ti: i }, false); Log.info(`#420 track ${m}.${i}: artist copied from recording — cleared the now-moot update-recording-artist flag`); } };
          const tNames = u(u(t.artistCredit).names) || [];
          if (tNames.length === recNames.length && tNames.every((n, k) => nameKey(n) === nameKey(recNames[k]))) { Log.info(`#348 artist copy: track ${m}.${i} — track artist already identical to the recording's — skipped`); clearMootArtistFlag(); return; }
          const gids = recNames.map(n => (n.artist ? (u(u(n.artist).gid) || '∅') : '∅')).join(', ');
          // Fetch the FULL artist entity for each credit (same as the paste-MBID resolve → pickArtist
          // path). Verified live: writing the recording's own LEAN artist — or W.MB.entity(gid,name) —
          // gets DROPPED by MB on its next re-derive; only the full entity, with its integer id, persists
          // the match. Keep the recording's credited-as + join phrase. #348
          const names = [];
          for (const n of recNames) {
            const a = u(n.artist), gid = a && u(a.gid);
            const full = gid ? await fullEntity(gid) : null;
            names.push({ artist: full || a, name: u(n.name) || '', joinPhrase: u(n.joinPhrase) || '' });
          }
          try {
            _selfEdit = true; try { t.artistCredit({ names }); } finally { _selfEdit = false; }
            // read back the WRITTEN track credit — ∅ here (vs a real gid in the recording) means
            // the entity link was dropped and only the credited text stuck (the "set without match" bug).
            const wrote = (u(u(t.artistCredit).names) || []).map(n => (n.artist ? (u(u(n.artist).gid) || '∅') : '∅')).join(', ');
            Log.info(`#348 artist copy: track ${m}.${i} ← recording "${acText(u(t.artistCredit))}" (recording gid(s): ${gids} · written track gid(s): ${wrote})`);
            clearMootArtistFlag();
          } catch (x) { Log.warn(`#348 artist copy: track ${m}.${i} — artistCredit setter threw: ${x && x.message}`); }
        };
        (async () => {
        if (e.altKey) { for (const row of wrap.querySelectorAll('tbody tr.tc-recrow')) await setArtistFromRec(+row.dataset.mi, +row.dataset.ti); }
        else await setArtistFromRec(+tr.dataset.mi, +tr.dataset.ti);
        // #348: the copy is a SELF-edit, which the tracklist change-watcher ignores — so the
        // Tracklist mirror only refreshes via the lazy _tlRefreshed flag on the next tab-switch,
        // and that races (the copy lands in the model but the tab paints the stale unmatched slot).
        // Re-sync the mirror ourselves so the resolved artist shows immediately/reliably.
        _tlRefreshed = false; scheduleSync();
        rerenderRec();
        })();
        return;
      }
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
      if (wholeSide)          recRows().forEach(row => ['title', 'artist'].forEach(f => apply(+row.dataset.mi, +row.dataset.ti, f)));   // #443 whole recording side (both fields, every row)
      else if (e.ctrlKey)     ['title', 'artist'].forEach(f => apply(mi, ti, f));   // whole row
      else if (e.altKey)      recRows().forEach(row => apply(+row.dataset.mi, +row.dataset.ti, field));   // whole column
      else                    apply(mi, ti, field);
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
  // #303 — recording video marker (mirrors the native recordings table's <span class="video">)
  const VIDEO_MARK = '<span class="tc-rec-video" title="This recording is a video"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></span>';
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
      { const ps = recPendingState(r.mi, r.ti); if (ps && (ps.rec || ps.art)) { if (ps.rec) tr.classList.add('tc-rec-pending'); if (ps.art) tr.classList.add('tc-art-pending'); tr.title = ps.rec && ps.art ? 'Recording and artist have pending edits' : ps.rec ? 'This recording has pending edits' : 'This recording’s artist has pending edits'; } }   // #376
      tr.innerHTML =
        '<td class="c-n">' + esc(String(r.number == null ? '' : r.number)) + '</td>' +
        '<td class="tc-tkt">' + trackTitleHtml + '</td>' +
        '<td class="tc-tka">' + trackArtistHtml2 + '</td>' +
        '<td class="c-len">' + fmtMs(r.trackLen) + '</td>' +
        '<td class="c-sep"><span class="tc-dot"></span></td>' +
        '<td class="tc-recname ' + tCls + '">' + recTitleHtml + (r.recVideo ? ' ' + VIDEO_MARK : '') + '</td>' +
        '<td class="tc-recartist ' + aCls + '">' + recArtistCell + '</td>' +
        '<td class="c-len ' + recLenCls + '"' + recLenStyle + '>' + fmtMs(r.recLen) + '</td>';
      const dot = tr.querySelector('.tc-dot');
      if (r.conf) { dot.style.background = r.conf.color; dot.title = r.conf.label + ' — differs: ' + r.conf.diffs.join(', '); }
      else if (r.recGid) { dot.style.background = r.exact ? CONF_COLOR.exact : CONF_COLOR.tolerance; dot.title = r.exact ? 'Exact match' : 'Tolerance match' + (r.tolDiffs && r.tolDiffs.length ? ' (' + r.tolDiffs.join(', ') + ')' : ''); }
      else dot.style.visibility = 'hidden';
      const nameCell = tr.querySelector('.tc-recname');
      nameCell.classList.add('tc-clickable');
      nameCell.title = 'change recording — suggestions / search' + (tElig ? '  ·  right-click: copy track title to recording (Ctrl: row · Alt: column · Ctrl+Alt: whole recording side)' : '');
      nameCell.onclick = () => openRecPicker(r, nameCell);
      if (aElig) { const artCell = tr.querySelector('.tc-recartist'); if (artCell) artCell.title = 'right-click: copy track artist to recording (Ctrl: row · Alt: column · Ctrl+Alt: whole recording side)'; }
      if (changed) {   // per-row revert ↺ (single), shown on hover when changed
        const rev = document.createElement('button'); rev.className = 'tc-rec-rev'; rev.textContent = '↺'; rev.title = 'revert to the original recording';
        rev.onclick = e => { e.stopPropagation(); revertRecording(r); };
        nameCell.appendChild(rev);
      }
      // #348: hint the track-title / track-artist cells' right-click when the recording's value differs
      const tkt = tr.querySelector('.tc-tkt');
      if (tkt && !r.isNew && r.recName != null && r.recName !== '' && (r.title || '') !== r.recName) {
        tkt.title = 'right-click: set track title to the recording title “' + r.recName + '” (Alt: whole column · Ctrl+Alt: whole track side)';
      }
      const tka = tr.querySelector('.tc-tka');
      if (tka && !r.isNew && r.recArtist != null && r.recArtist !== '' && (r.trackArtist || '') !== r.recArtist) {
        tka.title = 'right-click: set track artist to the recording artist “' + r.recArtist + '” (Alt: whole column · Ctrl+Alt: whole track side)';
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
      let posIndex = new Map(), rgGidForDup = null, relTitleForDup = '', relArtistGidForDup = null, dupFetched = false;   // #440
      try {
        const rel = release(); const rg = rel && u(rel.releaseGroup); const rgGid = rg && u(rg.gid);
        rgGidForDup = rgGid || null; relTitleForDup = rel ? (u(rel.name) || '') : ''; relArtistGidForDup = (acArtistGids(u(rel && rel.artistCredit)) || [])[0] || null;
        if (rgGid) {
          setStatus('loading release-group recordings…');
          pool = await fetchRgRecordings(rgGid); pool.forEach(p => { const k = recFold(p.name); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(p); });
          posIndex = await fetchRgPositionIndex(rgGid);   // #440 position index from the RG's editions
        }
      } catch (e) { Log.warn('RG pool load failed', e.message); }
      Log.debug('rec-match: rg=' + (rgGidForDup || 'none') + ' pool=' + pool.length + ' posIndex=' + posIndex.size + ' relTitle="' + relTitleForDup + '" relArtist=' + (relArtistGidForDup || 'none') + ' cutoff=' + (SETTINGS.recCutoff || 'near') + '(' + maxLevel + ')');   // #440 diag
      // #440 — the edit track's "<medium>.<track>" position, to look up sibling/duplicate recordings placed there.
      const posKeyOf = (r, ko) => { try { return (u(mediums()[r.mi].position) || (r.mi + 1)) + '.' + (u(ko.position) || r.number || (r.ti + 1)); } catch (e) { return null; } };
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
        // #440 — a POSITION candidate that passed the similarity gate AND matches on LENGTH is
        // strong evidence it's the same recording, even when the recording's canonical title or
        // artist differ from the imported track (punctuation "Part"/"Pt.", or an extra backing
        // act like "… & Orchestre Afrisa"). Those diffs otherwise drag recComboLevel to 'low' and
        // it never links. Floor such a candidate to 'near' so it clears the default cutoff; a
        // DIFFERING length keeps its (worse) computed level, so this can't over-link.
        const considerPos = d => { let lvl = recComboLevel(d, ctx); if (d.length && ctx.length && recLenGap(d.length, ctx.length) === 0) lvl = Math.min(lvl, CUTOFF.near); if (lvl < bestLevel) { bestLevel = lvl; best = d; } };
        let cands = byTitle.get(recFold(r.title)) || [];
        if (!cands.length && (SETTINGS.recTitleTol || 0) > 0 && pool.length) cands = pool.filter(p => recTitleEq(p.name, r.title));
        cands.forEach(consider);
        const _pkDiag = posKeyOf(r, ko);   // #440 diag
        Log.debug('rec-match #' + (r.number || (r.ti + 1)) + ' "' + r.title + '" pos=' + _pkDiag + ' len=' + (r.trackLen || '?') + ' → titleCands=' + cands.length + ' bestLevel=' + (best ? bestLevel : '∞'));
        // #440 — position + similarity from the RG's editions (and possible duplicates
        // outside the RG), when the title match didn't already clear the cutoff. The
        // same slot in a duplicate holds the right recording even when its title is
        // worded differently ("Salongo Part 1" ↔ "Salongo, Pt. 1"); the similarity gate
        // keeps a divergent edition from mislinking an unrelated song at that position.
        if (!best || bestLevel > maxLevel) {
          const pk = posKeyOf(r, ko);
          const tryPos = (tag) => { const at = (posIndex.get(pk) || []); const sim = at.filter(c => c.gid && recSimilar(c.name, r.title)); Log.debug('rec-match #' + (r.number || (r.ti + 1)) + ' posTier[' + tag + '] pos=' + pk + ' atSlot=' + at.length + ' similar=' + sim.length + (at.length ? ' [' + at.slice(0, 4).map(c => '"' + c.name + '"' + (recSimilar(c.name, r.title) ? '✓' : '✗') + (c.length && r.trackLen && recLenGap(c.length, r.trackLen) === 0 ? '=len' : '')).join(', ') + ']' : '')); sim.forEach(considerPos); };   // #440 diag
          if (pk) {
            tryPos('rg');
            if ((!best || bestLevel > maxLevel) && !dupFetched && relTitleForDup) {   // widen to possible duplicates once (works even on a fresh import with no RG yet, #440)
              dupFetched = true; setStatus('scanning duplicates…');
              const before = posIndex.size;
              await fetchDuplicatePositionIndex(relTitleForDup, relArtistGidForDup, rgGidForDup, posIndex);
              Log.debug('rec-match: duplicate search for "' + relTitleForDup + '" (artist=' + (relArtistGidForDup || 'none') + ') → posIndex ' + before + '→' + posIndex.size);
              tryPos('dup');
            }
          }
        }
        // only fall back to MB's per-track lookup (network) when the pool had nothing good enough
        if (!best || bestLevel > maxLevel) {
          let sugg = (typeof ko.suggestedRecordings === 'function' ? (u(ko.suggestedRecordings) || []) : []);
          if (!sugg.length) {
            try { getEditor().recordingAssociation.findRecordingSuggestions(ko); } catch (e) {}
            for (let t = 0; t < 28; t++) { await new Promise(z => setTimeout(z, 250)); const loading = typeof ko.loadingSuggestedRecordings === 'function' ? u(ko.loadingSuggestedRecordings) : false; sugg = u(ko.suggestedRecordings) || []; if (!loading && sugg.length) break; if (!loading && t >= 3) break; }
          }
          for (let s = 0; s < sugg.length; s++) { consider(suggData(sugg[s])); if (bestLevel === 0) break; }   // 0 = exact, can't do better
        }
        if (best && bestLevel <= maxLevel) { Log.debug('rec-match #' + (r.number || (r.ti + 1)) + ' LINK → "' + best.name + '" [' + (best.gid || '').slice(0, 8) + '] level=' + bestLevel + ' (≤' + maxLevel + ')'); try { ko.setRecordingValue(recEntityFrom(best)); linked++; renderRecBody(); } catch (e) { Log.warn('auto-match set failed', e.message); } }
        else Log.debug('rec-match #' + (r.number || (r.ti + 1)) + ' NO LINK — best=' + (best ? '"' + best.name + '" level=' + bestLevel + ' > cutoff ' + maxLevel : 'none'));   // #440 diag
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
      video: !!r.video,   // #303 — surface the video flag in the picker results
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
  // #440 — POSITION index from a release's editions / duplicates. Keyed by
  // "<medium>.<track>" position → the recordings other releases place there
  // (with title/length/artist, so the caller can confirm by similarity). This is
  // what makes "Salongo Part 1" ↔ "Salongo, Pt. 1" resolvable: the title differs
  // too much for the title matcher, but the same position in a duplicate holds
  // the right recording, and the titles are *similar enough* to trust it.
  function addReleaseToPosIndex(rel, idx, rgGidOfEdit) {
    (rel.media || []).forEach(med => (med.tracks || []).forEach(t => {
      const rec = t.recording; if (!rec || !rec.id) return;
      const key = (med.position || 1) + '.' + (t.position || 0);
      const ac = (t['artist-credit'] && t['artist-credit'].length) ? t['artist-credit'] : (rec['artist-credit'] || []);
      const cand = {
        gid: rec.id, name: rec.title || t.title || '', length: rec.length || t.length || null,
        artist: ac.map(a => (a.name || (a.artist && a.artist.name) || '') + (a.joinphrase || '')).join(''),
        artistGids: ac.map(a => a.artist && a.artist.id).filter(Boolean),
        ac, isrcs: rec.isrcs || [], comment: rec.disambiguation || '', video: !!rec.video,
        relTitle: rel.title || '', sameRg: !rgGidOfEdit || (rel['release-group'] && rel['release-group'].id === rgGidOfEdit),
      };
      if (!idx.has(key)) idx.set(key, []);
      const arr = idx.get(key);
      if (!arr.some(c => c.gid === cand.gid)) arr.push(cand);
    }));
  }
  // RG editions: one request, every edition's tracklist by position.
  async function fetchRgPositionIndex(rgGid) {
    const idx = new Map();
    try {
      const r = await fetch(`${ORIGIN}/ws/2/release?release-group=${rgGid}&inc=recordings+artist-credits&fmt=json&limit=100`, { headers: { Accept: 'application/json' } });
      if (r.ok) { const j = await r.json(); (j.releases || []).forEach(rel => addReleaseToPosIndex(rel, idx, rgGid)); }
    } catch (e) { Log.warn('RG position index failed', e.message); }
    return idx;
  }
  // Cross-RG duplicates (#440, majkinetor: "go outside RG too, but consider Similarity").
  // Find releases that share this release's title + artist but sit in a DIFFERENT RG,
  // and fold their tracklists into the position index. Gated later by per-track title
  // similarity, so a same-named-but-different album can't silently mislink. Bounded to
  // a handful of releases; only worth running when the RG editions came up short.
  async function fetchDuplicatePositionIndex(title, artistGid, rgGid, into) {
    if (!title) return into;
    const titleQ = `release:"${String(title).replace(/["\\]/g, '\\$&')}"`;
    const runQuery = async (q) => {
      try { const r = await fetch(`${ORIGIN}/ws/2/release?query=${encodeURIComponent(q)}&fmt=json&limit=12`, { headers: { Accept: 'application/json' } }); return r.ok ? ((await r.json()).releases || []) : []; }
      catch (e) { return []; }
    };
    try {
      // Try title + release artist first, but fall back to TITLE-ONLY when that's empty:
      // a Various-Artists compilation credits the release to the VA placeholder, and
      // `arid:<VA>` matches nothing in the search index — so `title AND arid:VA` = 0 hits
      // and the editions were never found. The per-track similarity + length gate is the
      // real guard against a same-titled different album, so title-only is safe. #440
      let releases = artistGid ? await runQuery(`${titleQ} AND arid:${artistGid}`) : [];
      if (!releases.length) releases = await runQuery(titleQ);
      const others = releases.filter(rl => !rl['release-group'] || rl['release-group'].id !== rgGid).slice(0, 6);
      for (const rl of others) {
        try { const full = await fetch(`${ORIGIN}/ws/2/release/${rl.id}?inc=recordings+artist-credits+release-groups&fmt=json`, { headers: { Accept: 'application/json' } }).then(x => x.json()); addReleaseToPosIndex(full, into, rgGid); }
        catch (e) {}
      }
    } catch (e) { Log.warn('duplicate position index failed', e.message); }
    return into;
  }
  // similarity gate for a position candidate: titles must be close (≥60% by edit
  // distance) or one contained in the other — enough to bridge "Pt 1"/"Part 1" but
  // not to link an unrelated song that merely shares a slot in a divergent edition.
  function recSimilar(a, b) {
    const x = recFold(a), y = recFold(b);
    if (!x || !y) return false;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    const d = recLev(x, y), m = Math.max(x.length, y.length);
    return m > 0 && (1 - d / m) >= 0.6;
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
    return { entity: e, gid: u(e.gid), name: u(e.name), length: u(e.length), artist: acText(u(e.artistCredit)), artistGids: acArtistGids(u(e.artistCredit)), releases: rels, isrcs, video: !!u(e.video) };   // #303 video flag
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
        (data.video ? ' ' + VIDEO_MARK : '') +
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
            + (u(curRec.video) ? ' ' + VIDEO_MARK : '')   // #303 video flag on the linked recording
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
    #tc-nav-title .tc-nav-title-album{font:600 14px Arial;color:#5a3e94;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    /* #290: mirror MB's native "modification pending" mark (span.mp, #ffdd99) on the
       release name — the native header that carries it is hidden by zen. Inline span
       so it hugs the text; same gold as native. */
    #tc-nav-title .tc-nav-title-name{border-radius:3px;padding:0 1px}
    #tc-nav-title.tc-nav-title-pending .tc-nav-title-name{background:#ffdd99;padding:0 5px}
    #tc-nav-title.tc-nav-title-pending .tc-nav-title-name a{color:#33291a}
    #tc-nav-title .tc-nav-title-artist{font:12px Arial;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
    el.innerHTML = '<div class="tc-nav-title-album"><span class="tc-nav-title-name">' + album + '</span></div>'
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
    // #290: MIRROR MB's native "modification pending" mark. MB wraps the release
    // title in <span class="mp"> (gold #ffdd99) when the entity has open edits —
    // it's there on entrance. Zen hides the native header, so reflect that exact
    // state onto the release name in our toolbar — read straight from the DOM, no
    // logic of our own. The .mp node stays in the DOM even while the header is hidden.
    const navTitle = document.getElementById('tc-nav-title');
    if (navTitle) navTitle.classList.toggle('tc-nav-title-pending', !!document.querySelector('.releaseheader h1 .mp'));
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

  // #412: pulse the pinned compact-nav bar while MB is submitting the edit — a big edit can take a
  // while. Drive it purely off MB's OWN indicator: the release editor inserts a
  // `Submitting edits…` node (a Knockout `if`-bound `.loading-message`) the moment submission
  // starts, and removes it if the submit fails. So we don't watch clicks at all — we watch for that
  // node appearing (→ pulse) and disappearing (→ stop). It can't fire while editing because the node
  // simply isn't in the DOM until MB actually submits; a successful submit navigates away.
  const _isSubmitNode = n => n && n.nodeType === 1 && /submitting edits/i.test(n.textContent || '');
  function watchSubmitFlash() {
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes)   if (_isSubmitNode(n)) document.body.classList.add('tc-saving');
        for (const n of m.removedNodes) if (_isSubmitNode(n)) document.body.classList.remove('tc-saving');
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
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
    /* #461: "add a new artist/label/…" opens an iframe inside a .modal-backdrop that makes its
       OWN stacking context at z-index:auto(0) — so the iframe's internal z-index can't escape to
       clear the artist-credit bubble we lift to 50 above. Elevate the whole backdrop context so
       the creation form sits on top of the credit editor, not trapped underneath it. */
    body.tc-ri-on .modal-backdrop{z-index:210}

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
    /* #297: front cover thumbnail under the external-links section (display only) */
    #tc-ri-cover{margin:14px 0 0}
    #tc-ri-cover .tc-ri-cover-h{font:600 11px Arial;letter-spacing:.06em;text-transform:uppercase;color:#8a7bb8;padding:0 0 5px;margin:0 0 6px;border-bottom:1px solid #ece7f6}
    #tc-ri-cover a{display:inline-block;line-height:0}   /* shrink-wrap the image so only the cover itself is the link, not the empty space beside it */
    #tc-ri-cover img{display:block;width:180px;max-width:100%;height:auto;border:1px solid #e0d9f0;border-radius:6px;box-shadow:0 1px 5px rgba(40,20,80,.14)}

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
      riCover(col);   // #297: front cover thumbnail below the external-links section
    } else if (fs._tcHome && fs.parentElement !== fs._tcHome.parent) {
      // the Check-links toolbar is appended *inside* the fieldset, so it would travel home with it and orphan
      // onto the native Release-information tab (#160) — drop it before moving the fieldset back
      fs.querySelector(':scope > #tc-ri-toolbar')?.remove();
      fs._tcHome.parent.insertBefore(fs, fs._tcHome.next && fs._tcHome.next.isConnected ? fs._tcHome.next : null);
      const col = panel.querySelector(':scope > #tc-ri-rightcol');
      col?.querySelector(':scope > #tc-ri-cover')?.remove();
      if (col && !col.children.length) col.remove();
    }
  }
  // #297: the current release MBID (live editor gid, else from the URL); '' on /release/add
  function currentMbid() {
    try { const r = u(getEditor().rootField.release); const g = r && u(r.gid); if (g) return g; } catch (e) {}
    return (location.pathname.match(MBID_RE) || [''])[0];
  }
  // Append/refresh a front-cover thumbnail (Cover Art Archive) at the bottom of the
  // right column, below external links. Display only; hides itself when there's no art.
  function riCover(col) {
    const mbid = currentMbid();
    let box = col.querySelector(':scope > #tc-ri-cover');
    if (!mbid) { box?.remove(); return; }
    if (box && box.dataset.mbid === mbid) { col.appendChild(box); return; }   // keep, just ensure it's last
    box?.remove();
    box = document.createElement('div'); box.id = 'tc-ri-cover'; box.dataset.mbid = mbid;
    box.style.display = 'none';   // hidden until the cover actually loads — no "FRONT COVER" flash on coverless releases
    box.innerHTML = '<div class="tc-ri-cover-h">Front cover</div>';
    const a = document.createElement('a');
    a.href = ORIGIN + '/release/' + mbid + '/cover-art'; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Cover art (Cover Art Archive)';
    const img = document.createElement('img');
    img.alt = 'Front cover'; img.referrerPolicy = 'no-referrer';   // not lazy: a hidden (display:none) box would never load a lazy image
    // reveal only once the image loads. On error the box stays hidden — but is KEPT
    // (marked for this mbid) so riCover doesn't rebuild + re-request it every relayout
    // tick (#297: front-250 request loop / OpaqueResponseBlocking on coverless releases).
    img.onload = () => { box.style.display = ''; };
    img.src = 'https://coverartarchive.org/release/' + mbid + '/front-250';
    a.appendChild(img); box.appendChild(a); col.appendChild(box);
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
    // reflect EXTERNAL changes to the annotation (Scribe, scripts, revert) in the Markdown surface.
    // ko's `value` binding sets the textarea WITHOUT firing input, so a DOM listener can't see it —
    // subscribe to the observable. Our own md→field writes round-trip equal, so they're ignored (no loop).
    try {
      const annoObs = getEditor().rootField.release().annotation;
      if (annoObs && typeof annoObs.subscribe === 'function' && !ta._tcAnnoSub) {
        ta._tcAnnoSub = annoObs.subscribe(v => {
          const nv = v || '';
          if (mdToAnno(md.value) === nv) return;   // our own write / already in sync
          md.value = annoToMd(nv);
          // render the preview from nv directly — ta.value may not be updated yet (ko subscriber
          // order isn't guaranteed), which would leave the split preview showing the OLD annotation.
          if (previewing && view === 'edit') prev.innerHTML = annoToHtml(nv);
        });
      }
    } catch (e) {}
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
    if (!ANNO_PAGE_RE.test(location.pathname)) return;
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
  // #391 right-click a release-event or label ✕ → a GT-style "Remove all but this one" batch cleanup.
  // Keeps the row you right-clicked and removes every OTHER entry straight off the KO observableArray.
  let _riBatchWired = false;
  function wireReleaseInfoBatch() {
    if (_riBatchWired) return; _riBatchWired = true;
    document.addEventListener('contextmenu', e => {
      const btn = e.target.closest('button.remove-item.remove-release-event, button.remove-item.remove-release-label');
      if (!btn) return;
      const isEvent = btn.classList.contains('remove-release-event');
      const rel = release(); if (!rel) return;
      const arr = isEvent ? rel.events : rel.labels;
      if (typeof arr !== 'function' || typeof arr.remove !== 'function') return;
      const list = arr() || [];
      const n = list.length - 1;               // everything except the clicked row
      if (n < 1) return;                       // 0–1 rows → nothing to batch-remove; let the native menu through
      e.preventDefault();
      const sel = isEvent ? 'button.remove-item.remove-release-event' : 'button.remove-item.remove-release-label';
      const idx = [...document.querySelectorAll(sel)].indexOf(btn);   // the clicked row's position = its array index
      const keep = idx >= 0 ? list[idx] : list[0];
      const noun = isEvent ? 'release event' : 'label';
      openMiniMenu(btn, [{ label: `Remove all but this one (${n})`, title: `Remove the other ${n} ${noun}${n > 1 ? 's' : ''}, keeping this row`, onClick: () => {
        for (const it of (arr() || []).slice()) { if (it !== keep) { try { arr.remove(it); } catch (x) {} } }
      } }]);
    }, true);
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
    wireReleaseInfoBatch();
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

  W.__apolloEditor = { readTracklist, buildModel, commitTrack, resetTrack, revertTrack, trackChanged, removeTrack, moveTrack, addTracks, searchArtist, fetchEntity, createArtist, openPanel, showMirror, hideMirror, revertAll, revertSlot, pickArtist, addSlot, removeSlot, splitSlot, matchSlot, snapshotOriginals, readRecordings, showRecMirror, hideRecMirror, recordingsVisible, recConfidence, applyView, applyNav, applyReleaseInfo, releaseInfoVisible, ensureApolloEditNote, checkAllLinks, checkUrl, linkRows, discogsReleaseUrlFromPage, loadDiscogsMap, resolveByDiscogsUrl, discogsFeatUrlFor, tagDiscogsAddable, tagDiscogsForAll, addOrCreateDiscogsLink, reTagAfterDiscogsLink, artistDiscogsUrls, dhRun, acLinksDiff, fetchRgPositionIndex, fetchDuplicatePositionIndex, recSimilar, recComboLevel, pickSibArtist, loadSiblingMap, autoMatchRecordings, logMarkdown, openLengthParser, lpParse, lpValid, lpExtractFromHtml, lpNoteSource, openTrackPatternParser, tpCompile, resolveByExactAlias, lenShadeAlpha, lenShade, dupLenShade, get apolloOn() { return apolloOn(); }, get model() { return MODEL; }, get settings() { return SETTINGS; } };

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
    if (ANNO_PAGE_RE.test(location.pathname)) {   // #394 standalone Edit annotation page for ANY entity (no releaseEditor)
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
    watchSubmitFlash();             // #412 — pulse the toolbar while MB is saving the edit
    watchTabs();                    // #119 — single watcher drives the tracklist + recordings takeovers + the shared toggle
  })();
})();
