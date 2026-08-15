// ==UserScript==
// @name         Falcon — bulk MusicBrainz link editor
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.8.15.162629
// @description  Add external links to a BATCH of MusicBrainz artists/labels/recordings at once — no popup-per-entity, no tab churn. A small pool of persistent worker iframes churns through a queue, each submitting its own edit and moving straight to the next entity. Paste a list, hand it a queue via a `?falcon=` URL param, or click "Send to Falcon" on a Harmony actions page to import its suggested links directly.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHBhdGggZD0iTTY0IDEwIEM4MiAyOCA5MCA1NiA5MCA4MCBMMzggODAgQzM4IDU2IDQ2IDI4IDY0IDEwIFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFiMmE0YSIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNMzggODAgTDIwIDExMCBMNDAgOTYgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWIyYTRhIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik05MCA4MCBMMTA4IDExMCBMODggOTYgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWIyYTRhIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjY0IiBjeT0iNDQiIHI9IjEwIiBmaWxsPSIjMWIyYTRhIi8+CiAgPHBhdGggZD0iTTUwIDgwIEw0NSAxMDggTDY0IDEyMiBMODMgMTA4IEw3OCA4MCBaIiBmaWxsPSIjZmY2YTAwIiBzdHJva2U9IiMxYjJhNGEiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/falcon/README.md
// @match        https://*.musicbrainz.org/*
// @match        https://harmony.pulsewidth.org.uk/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @noframes
// ==/UserScript==
(function () {
  'use strict';
  const VERSION = '2026.8.15.162629';
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  const NAME = 'Falcon';
  const MB_ORIGIN = location.origin;
  // the ACTUAL MusicBrainz origin — used to build the outbound url when this script
  // is running ON Harmony (there, MB_ORIGIN above is Harmony's own origin, not MB's).
  //
  // ⚠ This must follow whichever MusicBrainz server the panel is open on, not be
  // pinned to production. @match covers *.musicbrainz.org, which includes
  // test.musicbrainz.org and beta — and a hardcoded production target meant a
  // batch queued while testing on the SANDBOX would build its edit urls against
  // the LIVE site and quietly edit real data. Workers are same-origin iframes, so
  // a cross-origin target could not work anyway. Only fall back to production for
  // the one case the comment above describes: running on Harmony, where the
  // current origin genuinely isn't MusicBrainz.
  const MB_TARGET = /(^|\.)musicbrainz\.org$/i.test(location.hostname) ? location.origin : 'https://musicbrainz.org';
  const ON_HARMONY = /(^|\.)harmony\.pulsewidth\.org\.uk$/i.test(location.hostname);
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
    // Default 5, from majkinetor measuring a real batch: 1.8s/item at 5 workers
    // vs 2.3s at 3. Above that the gain flattens and MB gets a rougher ride, so
    // the cap stays at 6.
    get workers() { const n = Number(GM_getValue('falcon:workers', 5)); return Math.max(1, Math.min(6, isFinite(n) ? n : 5)); },
    set workers(n) { GM_setValue('falcon:workers', Math.max(1, Math.min(6, Number(n) || 5))); },
    // #467 (majkinetor): "Add worker window size so I can see better what is
    // wrong [with] multiple windows" — the default thumbnail is too small to
    // read a validation message, so make it adjustable and remember it. Card
    // height tracks width at 4:5.
    get workerSize() { const n = Number(GM_getValue('falcon:workerSize', 260)); return Math.max(200, Math.min(900, isFinite(n) ? n : 260)); },
    set workerSize(n) { GM_setValue('falcon:workerSize', Math.max(200, Math.min(900, Number(n) || 260))); },
    // #508 (majkinetor): "Options" screen additions.
    get hideLauncher() { return GM_getValue('falcon:hideLauncher', false) === true; },
    set hideLauncher(v) { GM_setValue('falcon:hideLauncher', !!v); },
    get coverOnlyIfNone() { return GM_getValue('falcon:coverOnlyIfNone', false) === true; },
    set coverOnlyIfNone(v) { GM_setValue('falcon:coverOnlyIfNone', !!v); },
    // #508 follow-up (majkinetor): "Auto start Harmony import (off by default)".
    get autoStartHarmonyImport() { return GM_getValue('falcon:autoStartHarmonyImport', false) === true; },
    set autoStartHarmonyImport(v) { GM_setValue('falcon:autoStartHarmonyImport', !!v); },
    // #512 (majkinetor): "keep configurable number of last runs in local
    // storage so those can be selected and loaded by datetime".
    get logHistoryCount() { const n = Number(GM_getValue('falcon:logHistoryCount', 20)); return Math.max(1, Math.min(100, isFinite(n) ? n : 20)); },
    set logHistoryCount(n) { GM_setValue('falcon:logHistoryCount', Math.max(1, Math.min(100, Number(n) || 20))); },
  };

  /* ── tiny logger — kept in-memory + console, surfaced in the panel's log tab ── */
  // #467 (majkinetor: "It closed the window so I couldnt take a log (fix it)").
  // The log lived only in memory, so a tab that closed — or crashed, which is
  // exactly when the log matters most — took the evidence with it. It's now
  // mirrored into GM storage as it's written and restored on load, so the
  // previous session's log is still there to copy afterwards.
  // majkinetor, #467, emphatically: "logs do not work correctly, as I can't get
  // previous logs when it closes... I DON'T WANT LOGS FROM OTHER RUNS. I WANT
  // YOU TO KEEP THE WINDOW OPEN AND HAVE A SINGLE LOG OF THAT SESSION."
  //
  // Two separate bugs were behind that, both fixed here.
  //
  // 1. NOTHING WAS EVER WRITTEN. The persist was debounced by 10s, and a run of
  //    8 recordings takes about 10s — so on a short run the first write hadn't
  //    fired yet when the tab went away, and `pagehide` + GM_setValue is not
  //    reliably flushed by a real userscript manager on the way out. Net effect:
  //    the one situation the log exists for was the one situation it was empty.
  //
  //    So the live mirror is now localStorage, not GM storage. It is synchronous,
  //    same-origin, costs nothing next to an extension-storage round trip, and —
  //    the point — survives the tab navigating within musicbrainz.org, which is
  //    exactly the failure being chased.
  //
  // 2. SESSIONS WERE MERGED. The restore did `LOG.push(...previous)`, so every
  //    log opened with the last run's lines above the current ones. Each run now
  //    gets its own id and its own key; the panel shows THIS session only, and an
  //    earlier session is reachable deliberately rather than pasted on top.
  const LOG_PERSIST_MAX = 400;
  const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const LS_PREFIX = 'falcon:session:';
  // A session id has to be stable across a navigation (so a tab that gets
  // navigated mid-run keeps appending to the same session rather than orphaning
  // it) but must not collide between runs. Time-based, recorded in storage.
  let SESSION_ID = '';
  let _sessionSeq = 0;
  const LOG = [];
  // #512: which session the Log tab is currently SHOWING — null means the
  // live, still-appending one; any other value is a historical session id
  // picked from #falcon-log-history, rendered read-only from its persisted
  // snapshot instead of the in-memory LOG array.
  let _viewingSession = null;
  // #512 (majkinetor): "Fix Log that it doesn't show anything from previous
  // runs anymore. ... it can keep configurable number of last runs in local
  // storage so those can be selected and loaded by datetime." — every
  // session WAS already persisted individually (the per-run isolation above
  // was deliberate), just with no way back to an older one. listSessionKeys
  // enumerates them oldest-to-newest by the id's own leading timestamp;
  // pruneOldSessions caps how many stick around.
  function listSessionKeys() {
    if (!LS) return [];
    const out = [];
    try {
      for (let i = 0; i < LS.length; i++) {
        const k = LS.key(i);
        if (k && k.startsWith(LS_PREFIX) && k !== 'falcon:session:current') out.push(k.slice(LS_PREFIX.length));
      }
    } catch (e) {}
    return out.sort();   // the id's own YYYYMMDDHHMMSS-N prefix sorts chronologically as a string
  }
  function pruneOldSessions() {
    if (!LS) return;
    const ids = listSessionKeys();
    const excess = ids.length - cfg.logHistoryCount;
    if (excess <= 0) return;
    ids.slice(0, excess).forEach(id => { try { LS.removeItem(LS_PREFIX + id); } catch (e) {} });
  }
  function newSession(reason) {
    // second-resolution alone collides when two runs start in the same second
    // (which a test does, and an impatient re-Start does too), silently merging
    // them back into one log — the exact thing this is meant to stop.
    SESSION_ID = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + (++_sessionSeq);
    LOG.length = 0;
    try { if (LS) LS.setItem('falcon:session:current', SESSION_ID); } catch (e) {}
    pruneOldSessions();
    log('info', `=== session ${SESSION_ID} started (${reason}) ===`);
  }
  // reattach to an in-flight session after a navigation, so its log is continuous
  try {
    const cur = LS && LS.getItem('falcon:session:current');
    const prev = cur && LS.getItem(LS_PREFIX + cur);
    if (cur && prev) { SESSION_ID = cur; LOG.push(...JSON.parse(prev)); }
  } catch (e) {}
  let _persistTimer = null, _lastPersisted = '';
  function writeLogNow() {
    if (!SESSION_ID) return;
    try {
      const payload = JSON.stringify(LOG.slice(-LOG_PERSIST_MAX));
      if (payload === _lastPersisted) return;
      _lastPersisted = payload;
      if (LS) LS.setItem(LS_PREFIX + SESSION_ID, payload);
    } catch (e) {}
  }
  // Very short debounce. 500ms was still enough to lose the end of a run:
  // majkinetor's log stopped MID-LINE with no unload marker, meaning the content
  // process died outright rather than navigating, so nothing got the chance to
  // flush. At 100ms a hard crash costs at most the last line or two, and
  // localStorage is cheap enough to absorb the extra writes.
  function persistLog() {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => { _persistTimer = null; writeLogNow(); }, 100);
  }
  // Forensics for the bug he's reporting: the panel vanishing mid-run. If the
  // top-level page unloads while work is in flight, something navigated the tab
  // out from under us — record that fact synchronously, with where it went, so
  // the next page load can say so instead of presenting a mysteriously short log.
  function noteUnload(ev) {
    try {
      // ⚠ Log EVERY unload, not only mid-run ones. This used to fire its marker
      // only while items were still active or queued — so when the tab went away
      // right AFTER a run completed, the queue was empty, nothing was written,
      // and the silence read as "the tab was fine". A blind spot sitting exactly
      // where the bug lives.
      const busy = typeof queue !== 'undefined' && queue.some(i => i.status === 'active' || i.status === 'queued');
      LOG.push(`[${new Date().toISOString().slice(11, 19)}] ERROR *** THIS TAB IS BEING UNLOADED (${busy ? 'MID-RUN' : 'after the run finished'}) *** from ${location.href} via ${(ev && ev.type) || '?'} — the panel and its workers are being destroyed by the page going away, NOT by Falcon closing them. Report this line.`);
      writeLogNow();
    } catch (e) {}
  }
  try {
    window.addEventListener('pagehide', noteUnload);
    window.addEventListener('beforeunload', noteUnload);
  } catch (e) {}

  function log(level, msg) {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase().padEnd(5)} ${msg}`;
    LOG.push(line); if (LOG.length > 1500) LOG.shift();
    persistLog();
    try { (console[level] || console.log).call(console, '[Falcon]', msg); } catch (e) {}
    scheduleRender('log');
  }
  // #467 (majkinetor: "it was slow and UI was frozen after some time"): every
  // log line used to re-render the whole log pane synchronously (join of up to
  // 1500 lines + textContent + scroll), and every queue mutation re-rendered
  // the entire queue list. Under 3 concurrent workers that's a lot of layout
  // thrash on the SAME main thread the worker iframes are competing for.
  // Coalesce instead: mark what's dirty and repaint once per animation frame.
  let _dirty = {}, _rafPending = false;
  function scheduleRender(what) {
    _dirty[what] = true;
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      const d = _dirty; _dirty = {};
      if (d.queue) renderQueue();
      if (d.log) renderLog();
      if (d.workers) renderWorkerLayout();
    });
  }
  // #467 (majkinetor, discussion #459): "some workers still randomly do not
  // submit stuff for the unknown reason" — intermittent and not reproducible
  // locally, so every step of a worker's run is traced at debug level, tagged
  // with WHICH worker (they run concurrently, so untagged lines interleave into
  // an unreadable mess). The goal is that a single real run's log says exactly
  // where a worker stopped short, without needing a live repro.
  const debugOn = () => GM_getValue('falcon:debug', true);
  function dbg(tag, msg) { if (debugOn()) log('debug', `${tag} ${msg}`); }

  /* ── queue item shape: {id, entityType, mbid, urls: [{url,linkTypeId}], note,
     disambiguation, isrcs, cover: [{url, comment, type, candidates:
     [{provider,url,width?,height?,size?}]}], coverExistingCount, urlResults,
     status, error} ── entityType is one of artist/label/recording/release/
     release_group. Field usage by type (#496 — the rest are always present on
     the item internally for simplicity, but only these are ever read/rendered):
       - urls[]: all types (release_group and release included, #495)
       - isrcs[]: recording only
       - disambiguation: recording only (MB's own form field for this is
         internally called `comment`, but Falcon's own field is named for what
         it actually is — #496: "don't use `comment` for two unrelated things")
       - cover[]: release only — an ARRAY (a release can carry more than one
         cover image; Falcon today only ever populates one entry from Harmony,
         but the shape supports more so a future batch/JSON import can add
         several at once, #496). Each entry's own `comment` is THAT image's
         upload comment (e.g. "page 1"), unrelated to `disambiguation`. `type`
         is the MB cover-art type (front/back/booklet/…), default 'front'.
         `url` is auto-picked by pickBestCover, always user-editable.
         coverExistingCount (item-level, not per-cover-entry — it's a fact
         about the RELEASE, not about any one image being added) is set by
         checkExistingCoverArt. A release item can have urls[] AND cover[] at
         once (independent MB edits on the same entity — see workerLoop's
         `needsCover` handling and runCoverItem's `priorLinks` merge) or
         either alone.
     A release_group/release/artist/label/recording item with urls[] goes
     through the normal iframe/form worker path; a release's cover goes
     through runCoverItem's upload-API path instead — never both through the
     same mechanism. #467 (majkinetor): the same entity can carry
     several URLs — group those into ONE item/one edit-page visit rather than
     revisiting the same mbid N times (both unsafe — two workers must never load
     the same entity's /edit at once — and wasteful). Grouping happens at add-time
     (see addToQueue); nextQueued() additionally refuses to hand out a queued item
     whose entity is already 'active' in another worker, so a later-added item for
     the same entity can never race the one already in flight.
     `linkTypeId` is optional — when present (e.g. from Harmony, which already
     knows exactly which relationship type it wants) it's used to set the type
     select if MB renders one instead of auto-classifying; when absent MB's own
     classifier decides, same as before. The SAME url can legitimately appear
     twice with two different linkTypeId values (Harmony does this for e.g. a
     Bandcamp track that's both "stream for free" and "purchase for download") —
     handled by fillAndSubmit via MB's own "Add another relationship" row rather
     than re-typing the url, so dedup below is keyed on (url, linkTypeId), not url
     alone. */
  let queue = [];
  let _idSeq = 0;
  let running = false;
  // review-UX state (#467): which rows are checked (for bulk remove) / expanded
  // (showing their full url list) — kept outside `queue` itself since it's pure
  // display state, survives across renderQueue() calls (a full innerHTML replace).
  let _selectedIds = new Set();
  let _expandedIds = new Set();
  // #497 (majkinetor): per-entity-type processing toggle, shown as chips in
  // the queue toolbar ("artist 5", "release 7", ...). All ON by default —
  // turning one off excludes every QUEUED item of that type from the run
  // (nextQueued skips them) without removing them from the queue; an
  // already-active/done/failed item is untouched by toggling since this only
  // gates what a worker picks up NEXT, not history.
  let _disabledTypes = new Set();
  // #513 (majkinetor): "Its still not easily seeable that there were issues.
  // Lets add some chip with results in appropriate color if there are
  // issues... Make the chip clickable to filter in just those results." —
  // null shows everything; a status string shows only rows in that status.
  let _statusFilter = null;
  // #494: 'release' can carry BOTH a urls[] link (via the normal iframe/form
  // pipeline, like every other type — #495) AND a cover (via the upload API,
  // never the form; see runCoverItem) — a release item's worker turn runs
  // whichever of those it actually has. 'release_group' (#495) is a plain
  // urls[]-only type, same pipeline as artist/label/recording, no special
  // casing — MB's URL path for it is 'release-group' (hyphen) even though the
  // internal entityType value and seed-param prefix use 'release_group'
  // (underscore, matching MB's own `edit-release_group.` seed params); see
  // entityUrlSegment.
  const ENTITY_RE = /^(artist|label|recording|release|release_group)$/;
  const MBID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // #496: MB's own cover-art type vocabulary — same list as Art Station's
  // COVER_TYPES (art_station.user.js), kept identical so a type picked here
  // maps onto the exact same label MB's own add-cover-art form shows.
  const COVER_TYPES = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Raw/Unedited', 'Matrix/Runout', 'Top', 'Bottom', 'Panel', 'Other'];
  const newCoverEntry = (url, candidates) => ({ url: url || '', comment: '', type: 'Front', candidates: candidates || [] });
  // #496: accepts the current array shape, the pre-#496 single-object shape
  // ({url, candidates}), and the even older bare top-level `coverCandidates`
  // — so a JSON file exported before this change still imports cleanly.
  function normalizeCoverForImport(r) {
    if (Array.isArray(r.cover)) return r.cover.filter(c => c && typeof c === 'object').map(c => ({
      url: String(c.url || ''), comment: String(c.comment || ''), type: String(c.type || 'Front'),
      candidates: Array.isArray(c.candidates) ? c.candidates : [],
    }));
    if (r.cover && typeof r.cover === 'object') return [{
      url: String(r.cover.url || ''), comment: String(r.comment || ''), type: 'Front',
      candidates: Array.isArray(r.cover.candidates) ? r.cover.candidates : [],
    }];
    if (Array.isArray(r.coverCandidates) && r.coverCandidates.length) return [newCoverEntry('', r.coverCandidates)];
    return [];
  }

  function normalizeEntityType(raw) {
    const t = String(raw || 'artist').trim().toLowerCase().replace(/-/g, '_');
    return ENTITY_RE.test(t) ? t : 'artist';
  }
  // MB's own URL path segment for an entity type — every type matches its
  // entityType verbatim except release_group, whose real path is
  // 'release-group' (hyphen) while the internal value/seed-param prefix stays
  // 'release_group' (underscore, MB's own inconsistency — verified live).
  function entityUrlSegment(entityType) { return entityType === 'release_group' ? 'release-group' : entityType; }
  // accepts: "<mbid>,<url>" · "<mbid> <url>" · "<entityType>:<mbid>,<url>" ·
  // or a full MB entity URL in place of the bare mbid.
  function parseLine(line) {
    const s = line.trim();
    if (!s || s.startsWith('#')) return null;
    let entityType = 'artist';
    let rest = s;
    const etm = rest.match(/^(artist|label|recording|release|release[_-]group)\s*:\s*(.+)$/i);
    if (etm) { entityType = normalizeEntityType(etm[1]); rest = etm[2]; }
    const parts = rest.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) return null;
    let [entityPart, ...urlParts] = parts;
    const url = urlParts.join(' ');
    const um = entityPart.match(/musicbrainz\.org\/(artist|label|recording|release|release-group)\/([0-9a-f-]{36})/i);
    let mbid = entityPart;
    if (um) { entityType = normalizeEntityType(um[1]); mbid = um[2]; }
    if (!MBID_RE.test(mbid) || !/^https?:\/\//i.test(url)) return null;
    return { entityType, mbid: mbid.toLowerCase(), url, linkTypeId: null };
  }
  function parsePaste(text) {
    return String(text || '').split('\n').map(parseLine).filter(Boolean);
  }
  // Shared MB API throttle for name lookups (majkinetor, #467: "fetch them in
  // paralel with rate limit protection as usual (retry after etc, see how CH
  // does it") — mirrors Credit Hoarder's api-mb.js pattern: up to MAX_CONCURRENT
  // requests in flight with NO artificial per-request gap (a strict serial
  // 1.1s-apart queue was tried first and was simply too slow for a big batch),
  // and on an actual 429/503 every in-flight request cooperatively backs off
  // until a shared `pauseUntil` timestamp elapses (from the Retry-After header,
  // or exponential backoff if MB didn't send one) — so the throttle only ever
  // slows down in response to MB actually signalling overload, not preemptively.
  const mbThrottle = (() => {
    const MAX_CONCURRENT = 4;
    let running = 0, pauseUntil = 0;
    const queue = [];
    async function waitForPause() {
      let w = pauseUntil - Date.now();
      while (w > 0) { await wait(w); w = pauseUntil - Date.now(); }
    }
    function drain() {
      while (running < MAX_CONCURRENT && queue.length) {
        running++;
        const item = queue.shift();
        run(item).finally(() => { running--; drain(); });
      }
    }
    async function run(item) {
      for (let attempt = 0; attempt <= item.retries; attempt++) {
        await waitForPause();
        try {
          const res = await fetch(item.url, { headers: { Accept: 'application/json' } });
          if (res.status === 429 || res.status === 503) {
            const ra = parseInt(res.headers.get('Retry-After'), 10);
            const waitMs = ra > 0 ? ra * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);
            pauseUntil = Math.max(pauseUntil, Date.now() + waitMs);   // push forward only
            continue;
          }
          if (!res.ok) { item.resolve(null); return; }
          item.resolve(await res.json());
          return;
        } catch (e) {
          if (attempt === item.retries) { item.resolve(null); return; }
          await wait(500);
        }
      }
      item.resolve(null);
    }
    return {
      // #494 follow-up (majkinetor, live: a duplicate-cover-art warning took
      // ~20s to appear on a batch with a full recording list ahead of it —
      // "It should be prioritized"): `priority` jumps the FRONT of this
      // FIFO queue rather than the back, for the (rare) callers whose result
      // is actionable, not cosmetic like a name lookup.
      fetchJson: (url, retries, priority) => new Promise(resolve => { const entry = { url, retries: retries == null ? 3 : retries, resolve }; priority ? queue.unshift(entry) : queue.push(entry); drain(); }),
      // Drop everything not yet started, resolving each caller with null. Used
      // when a run begins: a backlog of cosmetic name lookups must not spend the
      // rate-limit budget the workers need. In-flight requests are left to
      // finish — there are at most MAX_CONCURRENT of them and aborting mid-flight
      // buys nothing.
      cancelPending() { const n = queue.length; queue.splice(0).forEach(item => item.resolve(null)); return n; },
      pendingCount: () => queue.length,
    };
  })();
  // resolves an entity's real name/title for display, instead of a truncated mbid —
  // same-origin fetch to MB's own public API (no GM_xmlhttpRequest needed; Falcon's
  // panel only ever renders on musicbrainz.org itself), through the throttle above.
  // Cached per entity since the same mbid can appear across several queue items.
  const _nameCache = new Map();
  // ⚠ Name lookups YIELD to a run (majkinetor: "any ongoing scanning for names
  // should probably be stopped on starting the queue so not to slow it down or
  // induce rate limit that would influence workers").
  //
  // They are cosmetic — a row shows `recording/2aa5e6cc` until its title lands —
  // but they are not free: a big paste queues one /ws/2 call per entity, and
  // MusicBrainz rate-limits per IP, so a backlog still in flight when Start is
  // pressed competes with the workers' own edit-page loads for the same budget.
  // A 503 there is not cosmetic at all; it fails the item.
  //
  // So a run suspends them: new lookups return immediately, and the throttle's
  // whole pending backlog is dropped rather than deferred (those requests would
  // otherwise still fire, just later, which is the same problem moved). Rows
  // keep whatever label they already have.
  let _namesSuspended = false;
  function suspendNameLookups() {
    _namesSuspended = true;
    const dropped = mbThrottle.cancelPending();
    if (dropped) dbg('[names]', `dropped ${dropped} pending name lookup(s) so they don't compete with the workers`);
  }
  function resumeNameLookups() { _namesSuspended = false; }
  // #509 follow-up (majkinetor): "I don't think its working, although not
  // sure. Lets add debug log for track fetching - list entity mbid and if
  // name is fetched or passed." — every entity's name resolution logs which
  // path it took (Harmony-scraped and passed straight through, vs. an MB API
  // fetch) so it's actually verifiable from the Log tab instead of assumed.
  async function fetchEntityName(entityType, mbid) {
    const key = entityType + ':' + mbid;
    if (_nameCache.has(key)) { dbg('[names]', `${key} — cached: "${_nameCache.get(key)}"`); return _nameCache.get(key); }
    if (_namesSuspended) { dbg('[names]', `${key} — fetch skipped, lookups suspended (a run is active)`); return null; }
    dbg('[names]', `${key} — fetching from MB (no name passed from source)`);
    const j = await mbThrottle.fetchJson(`${MB_ORIGIN}/ws/2/${entityUrlSegment(entityType)}/${mbid}?fmt=json`);
    const name = j ? (j.title || j.name || null) : null;   // recordings/releases/RGs: title; artist/label: name
    if (name) _nameCache.set(key, name);
    dbg('[names]', `${key} — fetched: ${name ? `"${name}"` : 'null (MB lookup failed or returned no name)'}`);
    return name;
  }
  function entityLabel(item) { return item.name || `${item.entityType}/${item.mbid.slice(0, 8)}`; }
  // #509 follow-up (majkinetor, live: several items stayed nameless
  // permanently — "when name is null, it blocks from fetching it"). Root
  // cause: suspendNameLookups()'s cancelPending() resolves every not-yet-
  // STARTED cosmetic name lookup with null so it doesn't compete with the
  // workers' rate-limit budget — correct while a run is active, but nothing
  // ever gave a cancelled item a second try afterwards, so a lookup that
  // lost that race stayed null forever even once the budget was free again.
  // Sweep every still-nameless item once the suspension actually lifts
  // (run finishes or is stopped) — same shape as importQueueJson's own
  // post-import sweep, just re-triggerable instead of one-shot.
  function resolveMissingNames() {
    queue.filter(i => !i.name && i.status === 'queued').forEach(i => {
      fetchEntityName(i.entityType, i.mbid).then(n => { if (n) { i.name = n; scheduleRender('queue'); } });
    });
  }
  // merges each parsed {entityType,mbid,url,linkTypeId,note?} into an existing
  // STILL-QUEUED item for the same entity (never merges into an active/done/failed
  // one — that item has already been claimed or finished), else creates a new item.
  function addToQueue(parsed) {
    let merged = 0, added = 0;
    parsed.forEach(p => {
      // #494/#495: a cover-shaped tuple (coverCandidates, no url — only ever
      // 'release', from Harmony's cover scraper) merges into/creates a release
      // item's `cover`, entirely separately from urls[] — a release item can
      // have BOTH a cover AND urls (added via the generic path just below,
      // same as any other type), landing in the same item since both paths
      // dedup on (entityType, mbid) identically.
      if (p.entityType === 'release' && p.coverCandidates) {
        const existingRel = queue.find(i => i.status === 'queued' && i.entityType === 'release' && i.mbid === p.mbid);
        if (existingRel) {
          if (!existingRel.cover.length) existingRel.cover.push(newCoverEntry());
          const entry = existingRel.cover[0];
          const before = entry.candidates.length;
          p.coverCandidates.forEach(c => { if (!entry.candidates.some(x => x.url === c.url)) entry.candidates.push(c); });
          if (entry.candidates.length > before) pickBestCover(existingRel);
          if (existingRel.coverExistingCount == null) checkExistingCoverArt(existingRel);
          merged++;
          return;
        }
        const relItem = { id: 'f' + (++_idSeq), entityType: 'release', mbid: p.mbid, urls: [], note: p.note || '', disambiguation: '', isrcs: [], cover: [newCoverEntry('', p.coverCandidates)], coverExistingCount: null, name: null, urlResults: null, status: 'queued', error: '' };
        queue.push(relItem);
        fetchEntityName('release', p.mbid).then(name => { if (name) { relItem.name = name; renderQueue(); } });
        pickBestCover(relItem);
        checkExistingCoverArt(relItem);
        added++;
        return;
      }
      // #500 (majkinetor): a release whose recordings have NO external links
      // at all (only a cover + ISRCs) left scrapeHarmonyActions with zero
      // recording tuples to zip isrcs onto — dropped silently, since Falcon
      // had no independent view of the tracklist to place them on otherwise.
      // This tuple carries no mbid/url of its own yet — resolveIsrcFallback
      // fetches the release's actual tracklist and re-enters addToQueue with
      // real per-recording isrc tuples once it has one, same
      // queue-first-resolve-after shape as #494's cover candidates.
      if (p.entityType === 'recording' && p.pendingIsrcs) {
        resolveIsrcFallback(p.pendingIsrcs.mbid, p.pendingIsrcs.isrcs, p.pendingIsrcs.note);
        return;
      }
      const existing = queue.find(i => i.status === 'queued' && i.entityType === p.entityType && i.mbid === p.mbid);
      const linkTypeId = p.linkTypeId || null;
      if (existing) {
        // #500: a url-less tuple (isrc-only fallback resolution) has nothing
        // to add to urls[] — only #474's comment/isrc fields.
        if (p.url && !existing.urls.some(u => u.url === p.url && u.linkTypeId === linkTypeId)) { existing.urls.push({ url: p.url, linkTypeId }); merged++; }
        if (p.note && !existing.note) existing.note = p.note;
        // #474: disambiguation + ISRC — recording-only, additive (a later tuple
        // for the same mbid shouldn't clobber a disambiguation/isrc it already has).
        if (p.disambiguation && !existing.disambiguation) existing.disambiguation = p.disambiguation;
        if (p.isrc && !(existing.isrcs || []).includes(p.isrc)) (existing.isrcs = existing.isrcs || []).push(p.isrc);
        // #509: a name Harmony already resolved beats a later async MB lookup.
        if (p.name && !existing.name) existing.name = p.name;
        return;
      }
      const item = { id: 'f' + (++_idSeq), entityType: p.entityType, mbid: p.mbid, urls: p.url ? [{ url: p.url, linkTypeId }] : [], note: p.note || '', disambiguation: p.disambiguation || '', isrcs: p.isrc ? [p.isrc] : [], cover: [], coverExistingCount: null, name: p.name || null, urlResults: null, status: 'queued', error: '' };
      queue.push(item);
      // #509 (majkinetor): "Since Harmony already resolves names, we could
      // just fetch and use them instead of bombing MB." scrapeHarmonyActions
      // already scraped the name straight off Harmony's own page — only
      // fall back to Falcon's own MB lookup when a tuple didn't carry one
      // (paste, `?falcon=` URL, JSON import without a name field).
      if (p.name) dbg('[names]', `${p.entityType}:${p.mbid} — passed from source: "${p.name}"`);
      else fetchEntityName(p.entityType, p.mbid).then(name => { if (name) { item.name = name; renderQueue(); } });
      added++;
    });
    return { merged, added };
  }
  // #500: fetches the release's real tracklist (recording mbids in track
  // order) and places each Nth ISRC onto the Nth recording — the same
  // positional convention scrapeHarmonyActions already uses when it DOES
  // have link-tuples to zip onto, just resolved from MB's own API instead of
  // scraped anchors when there are none.
  async function resolveIsrcFallback(releaseMbid, isrcs, note) {
    const j = await mbThrottle.fetchJson(`${MB_ORIGIN}/ws/2/release/${releaseMbid}?inc=recordings&fmt=json`, undefined, true);
    if (!j || !Array.isArray(j.media)) { dbg('[isrc]', `${releaseMbid}: tracklist fetch failed, cannot place ${isrcs.length} ISRC(s)`); return; }
    const recMbids = [];
    for (const m of j.media) for (const t of (m.tracks || [])) recMbids.push(t.recording && t.recording.id);
    const tuples = [];
    isrcs.forEach((isrc, i) => { if (isrc && recMbids[i]) tuples.push({ entityType: 'recording', mbid: recMbids[i], note, isrc }); });
    if (!tuples.length) { dbg('[isrc]', `${releaseMbid}: no ISRC could be matched to a track position`); return; }
    const res = addToQueue(tuples);
    log('info', `resolved ${res.added + res.merged} ISRC-only recording(s) from ${releaseMbid}'s tracklist (Harmony had no external links to zip them onto)`);
  }
  // Reads what the Export button writes, and is deliberately forgiving about the
  // shape: the wrapper object `{items:[...]}`, or a bare array of items, or a
  // bare array of the flat `{mbid,url,linkTypeId}` rows that `?falcon=` and
  // Harmony use — someone hand-writing a queue shouldn't have to guess which.
  //
  // An imported item keeps its STATUS. Re-importing a finished run therefore
  // shows what already happened rather than silently re-queueing committed
  // edits; only rows that are still `queued` will be picked up by a worker. That
  // makes "export a failed run, fix the bad urls, import, Start" work without
  // duplicating everything that already succeeded.
  function importQueueJson(text, sourceName) {
    let data;
    try { data = JSON.parse(text); } catch (e) { log('error', `${sourceName || 'import'}: not valid JSON — ${e.message}`); return { added: 0, merged: 0 }; }
    const rows = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : null);
    if (!rows) { log('error', `${sourceName || 'import'}: no items found (expected {"items":[…]} or an array)`); return { added: 0, merged: 0 }; }

    let added = 0, merged = 0, skipped = 0;
    const flat = [];
    rows.forEach(r => {
      if (!r || typeof r !== 'object' || !MBID_RE.test(String(r.mbid || ''))) { skipped++; return; }
      const type = normalizeEntityType(r.entityType);
      // #494: a release row has no urls[] at all — its payload is r.cover.
      const coverArr = type === 'release' ? normalizeCoverForImport(r) : [];
      const hasCover = coverArr.some(c => c.url || (c.candidates && c.candidates.length));
      if (Array.isArray(r.urls) || hasCover) {
        // full item: reinstate it whole, status and all
        const urls = Array.isArray(r.urls) ? r.urls.filter(u => u && u.url).map(u => ({ url: String(u.url), linkTypeId: u.linkTypeId || null })) : [];
        // #474: a recording carrying only a disambiguation/isrc (no urls at
        // all) is a legitimate item now that fillAndSubmit knows to look for
        // one — only reject empty-urls rows that have nothing else to offer.
        // (r.comment accepted too — pre-#496 exports used that field name.)
        const hasMeta = type === 'recording' && (r.disambiguation || r.comment || (Array.isArray(r.isrcs) && r.isrcs.some(Boolean)));
        if (!urls.length && !hasMeta && !hasCover) { skipped++; return; }
        const reItem = {
          id: 'f' + (++_idSeq), entityType: type, mbid: r.mbid, urls,
          note: r.note || '', disambiguation: r.disambiguation || r.comment || '', isrcs: Array.isArray(r.isrcs) ? r.isrcs.filter(Boolean).map(String) : [],
          cover: coverArr, coverExistingCount: null,
          name: r.name || null, urlResults: r.urlResults || null,
          status: ['done', 'failed', 'partial', 'skipped', 'manual'].includes(r.status) ? r.status : 'queued',
          error: r.error || '',
        };
        queue.push(reItem);
        if (hasCover && reItem.status === 'queued') checkExistingCoverArt(reItem);
        added++;
      } else if (r.url) {
        flat.push({ entityType: type, mbid: r.mbid, url: String(r.url), linkTypeId: r.linkTypeId || null, note: r.note || '', disambiguation: r.disambiguation || r.comment || '', isrc: r.isrc || (Array.isArray(r.isrcs) ? r.isrcs[0] : null) || null });
      } else skipped++;
    });
    if (flat.length) { const res = addToQueue(flat); added += res.added; merged += res.merged; }

    renderQueue();
    // names for anything that arrived without one — unless a run is under way,
    // in which case these would compete with the workers for MB's rate limit
    // (fetchEntityName's own _namesSuspended check still applies here).
    resolveMissingNames();
    log('info', `${sourceName || 'import'}: added ${added} item(s)`
      + (merged ? `, merged ${merged} url(s)` : '')
      + (skipped ? `, skipped ${skipped} unusable row(s)` : ''));
    return { added, merged, skipped };
  }

  // `?falcon=` accepts TWO schemes:
  //   1. base64(JSON array of {entityType?,mbid,url,linkTypeId?,note?}) directly in
  //      the URL — the documented contract for any external script to hand Falcon a
  //      queue with one link.
  //   2. a short random TOKEN keyed into GM storage (`falcon:pending:<token>`) — used
  //      by the Harmony bridge itself (see ensureHarmonyButton below), since GM
  //      storage is shared across every tab this SAME script runs in regardless of
  //      domain. This is what lets a batch include recordings again: no JSON ever
  //      has to fit in a URL, so there's no length ceiling to hit (#467's
  //      PR_END_OF_FILE_ERROR was hitting exactly that ceiling on the base64 scheme).
  //      A different script can't use this scheme — GM storage isn't shared BETWEEN
  //      different userscripts, only within one script's own tabs — hence keeping
  //      scheme 1 as the general contract.
  function tryDecodeBase64Json(raw) {
    let text; try { text = decodeURIComponent(escape(atob(raw))); } catch (e) { return null; }
    try { JSON.parse(text); return text; } catch (e) { return null; }
  }
  function parseUrlParam() {
    const raw = new URLSearchParams(location.search).get('falcon');
    if (!raw) return null;
    let json = tryDecodeBase64Json(raw);
    // #508 (majkinetor): "Auto start Harmony import" needs to tell a Harmony-
    // sourced seed (the GM-storage token scheme — see the comment above) apart
    // from the general `?falcon=` contract any other script/user can construct
    // (base64 JSON directly in the URL) — auto-starting on an arbitrary
    // external payload isn't what was asked for.
    let fromHarmony = false;
    if (json == null) {
      const stored = GM_getValue('falcon:pending:' + raw, null);
      if (stored != null) { json = stored; fromHarmony = true; try { GM_deleteValue('falcon:pending:' + raw); } catch (e) {} }
    }
    if (json == null) { log('warn', 'falcon= param present but neither valid base64 JSON nor a known pending token'); return null; }
    try {
      const arr = JSON.parse(json);
      if (!Array.isArray(arr)) return null;
      const out = arr.map(it => {
        // #494/#495: a cover-shaped tuple (coverCandidates, no url — only
        // ever 'release') is kept separate from a normal url tuple, which
        // works the same for 'release'/'release_group' as every other type.
        if (normalizeEntityType(it.entityType) === 'release' && Array.isArray(it.coverCandidates)) {
          return {
            entityType: 'release', mbid: String(it.mbid || '').toLowerCase(),
            coverCandidates: it.coverCandidates.filter(c => c && c.url).map(c => ({ provider: String(c.provider || ''), url: String(c.url), width: Number(c.width) || undefined, height: Number(c.height) || undefined, size: Number(c.size) || undefined })),
          };
        }
        // #500: an isrc-only fallback tuple carries no url/mbid of its own —
        // just the release it needs to resolve a tracklist from.
        if (it.pendingIsrcs && it.pendingIsrcs.mbid) {
          return {
            entityType: 'recording',
            pendingIsrcs: {
              mbid: String(it.pendingIsrcs.mbid).toLowerCase(),
              isrcs: Array.isArray(it.pendingIsrcs.isrcs) ? it.pendingIsrcs.isrcs.map(x => String(x || '')) : [],
              note: it.pendingIsrcs.note ? String(it.pendingIsrcs.note) : '',
            },
          };
        }
        return { entityType: normalizeEntityType(it.entityType), mbid: String(it.mbid || '').toLowerCase(), url: String(it.url || ''), linkTypeId: it.linkTypeId ? String(it.linkTypeId) : null, note: it.note ? String(it.note) : '', isrc: it.isrc ? String(it.isrc) : null };
      }).filter(it => it.coverCandidates ? (MBID_RE.test(it.mbid) && it.coverCandidates.length)
        : it.pendingIsrcs ? (MBID_RE.test(it.pendingIsrcs.mbid) && it.pendingIsrcs.isrcs.some(Boolean))
        : (MBID_RE.test(it.mbid) && /^https?:\/\//i.test(it.url)));
      out.fromHarmony = fromHarmony;
      return out;
    } catch (e) { log('warn', 'falcon= payload not valid JSON: ' + e.message); return null; }
  }
  // Parses one Harmony "Link external IDs" href — a standard MB seed URL:
  // https://musicbrainz.org/<artist|label|recording|release|release-group>/<mbid>/edit
  //   ?edit-<type>.url.0.text=<url>&edit-<type>.url.0.link_type_id=<id>
  //   &edit-<type>.url.1.text=...&edit-<type>.url.1.link_type_id=...
  //   &edit-<type>.edit_note=<text>
  // Returns a FLAT array of {entityType,mbid,url,linkTypeId,note} tuples (one per
  // url.N) ready for addToQueue, or [] if href isn't a recognized seed URL.
  // Harmony itself doesn't offer release/release-group "Link external IDs"
  // actions yet (#495) — this just keeps the parser consistent/ready for when
  // it does; release/RG links are queued via paste or `?falcon=` JSON for now.
  function parseHarmonySeedUrl(href) {
    let u; try { u = new URL(href, MB_ORIGIN); } catch (e) { return []; }
    const m = u.pathname.match(/^\/(artist|label|recording|release|release-group)\/([0-9a-f-]{36})\/edit\/?$/i);
    if (!m) return [];
    const entityType = normalizeEntityType(m[1]);   // 'release-group' -> 'release_group'
    const mbid = m[2].toLowerCase();
    const prefix = `edit-${entityType}.`;
    const note = u.searchParams.get(prefix + 'edit_note') || '';
    const byIndex = {};
    for (const [key, val] of u.searchParams) {
      if (!key.startsWith(prefix + 'url.')) continue;
      const km = key.slice((prefix + 'url.').length).match(/^(\d+)\.(text|link_type_id)$/);
      if (!km) continue;
      (byIndex[km[1]] || (byIndex[km[1]] = {}))[km[2]] = val;
    }
    return Object.values(byIndex).filter(e => e.text).map(e => ({ entityType, mbid, url: e.text, linkTypeId: e.link_type_id || null, note }));
  }
  function encodeFalconPayload(tuples) {
    const json = JSON.stringify(tuples.map(t => ({ entityType: t.entityType, mbid: t.mbid, url: t.url, linkTypeId: t.linkTypeId || undefined, note: t.note || undefined, isrc: t.isrc || undefined })));
    return btoa(unescape(encodeURIComponent(json)));
  }

  /* ── Harmony bridge (#467, #459) ─────────────────────────────────────────
     Running ON a Harmony actions page: every "Link external IDs" action IS
     already a standard MB seed url (parseHarmonySeedUrl handles it) — scrape
     them all, combine into one queue, and open MB with it in a new tab
     instead of Harmony's own tab-per-entity popups. Harmony's actions render
     asynchronously (client-rendered), so the button's count is kept live by
     a short polling loop that settles once the count stops changing.
     Recordings ARE included again (majkinetor, #467) — a real release's
     recording actions vastly outnumber its artist/label ones (86 total, 80
     recordings, measured live), and packing all of them into a base64
     query-string payload blew past ~32,000 characters, past what MB's
     front-end accepts (Firefox surfaced that as a bare PR_END_OF_FILE_ERROR
     instead of a clean "414 URI Too Long"). The GM-storage-token scheme (see
     parseUrlParam) sidesteps that entirely — nothing goes in the URL but a
     short random token. */
  // #474 (majkinetor): "ISRC should be fetched on Harmony side too when
  // present." Checked a real Harmony actions page live — ISRCs are NOT in the
  // recording "Link external IDs" hrefs at all; they live in one separate
  // "Open with MagicISRC" action per release, handing off to a third-party
  // tool: `?isrc1=...&isrc2=...&musicbrainzid=<release>`, positional to track
  // order. Falcon has no independent view of the release's tracklist (it only
  // knows what scrapeHarmonyActions finds), so the match is positional: the
  // Nth distinct recording mbid to appear among the "Link external IDs"
  // anchors gets isrcN. This assumes every track has at least one link action
  // — true of every real Harmony page seen so far, but a track with zero
  // links would shift every isrc after it. majkinetor is testing this by hand.
  function harmonyMagicIsrcHref() {
    const a = [...document.querySelectorAll('a')].find(x => /open with magicisrc/i.test(x.textContent || ''));
    return a && a.getAttribute('href');
  }
  function scrapeHarmonyIsrcs() {
    const href = harmonyMagicIsrcHref();
    if (!href) return [];
    let u; try { u = new URL(href, location.href); } catch (e) { return []; }
    const out = [];
    for (const [k, v] of u.searchParams) {
      const m = k.match(/^isrc(\d+)$/i);
      if (m && v) out[+m[1] - 1] = v;
    }
    return out;
  }
  // #500 (majkinetor): "Harmony ISRC sending does not work when there are no
  // links" — a release whose recordings have zero "Link external IDs"
  // actions (only a cover + ISRCs) leaves scrapeHarmonyActions with nothing
  // to zip isrcs onto at all, so they were dropped entirely rather than
  // shifted. The SAME MagicISRC href already carries the release's own mbid
  // (`musicbrainzid`) and a ready-made edit note (`edit-note`) — enough to
  // resolve the real tracklist later (see resolveIsrcFallback) instead of
  // relying on scraped anchors that don't exist here.
  function harmonyIsrcFallback() {
    const href = harmonyMagicIsrcHref();
    if (!href) return null;
    let u; try { u = new URL(href, location.href); } catch (e) { return null; }
    const mbid = u.searchParams.get('musicbrainzid');
    if (!mbid || !MBID_RE.test(mbid)) return null;
    const isrcs = scrapeHarmonyIsrcs();
    if (!isrcs.some(Boolean)) return null;
    return { mbid: mbid.toLowerCase(), isrcs, note: u.searchParams.get('edit-note') || '' };
  }
  // #509 (majkinetor): "Since Harmony already resolves names, we could just
  // fetch and use them instead of bombing MB." Each action row already shows
  // the resolved entity as one more icon+name pill alongside the provider
  // icons — <a href="https://musicbrainz.org/<type>/<mbid>"><span
  // class="musicbrainz">…</span>Dusk</a>, the plain entity page (no query
  // string), distinct from the "Link external IDs" anchor's own seed-edit
  // href. Scraping that name here means addToQueue can skip its own
  // fetchEntityName() MB round-trip entirely for Harmony-sourced items.
  function harmonyRowName(actionAnchor) {
    const row = actionAnchor.closest('.action') || actionAnchor.parentElement;
    if (!row) return null;
    const mbLink = [...row.querySelectorAll('a[href]')].find(a => new RegExp(`^${MB_TARGET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(artist|label|recording|release|release-group)/[0-9a-f-]{36}$`, 'i').test(a.getAttribute('href') || ''));
    const name = mbLink && (mbLink.textContent || '').trim();
    return name || null;
  }
  function scrapeHarmonyActions() {
    const anchors = [...document.querySelectorAll('a')].filter(a => /link external ids/i.test(a.textContent || ''));
    const tuples = [];
    anchors.forEach(a => {
      const href = a.getAttribute('href'); if (!href) return;
      const name = harmonyRowName(a);
      parseHarmonySeedUrl(href).forEach(t => { if (name) t.name = name; tuples.push(t); });
    });
    const isrcs = scrapeHarmonyIsrcs();
    if (isrcs.length) {
      const recOrder = [];
      tuples.forEach(t => { if (t.entityType === 'recording' && !recOrder.includes(t.mbid)) recOrder.push(t.mbid); });
      recOrder.forEach((mbid, i) => { if (isrcs[i]) tuples.forEach(t => { if (t.mbid === mbid) t.isrc = isrcs[i]; }); });
    }
    return tuples;
  }
  // #494: Harmony sometimes annotates a cover figure's caption with a plain
  // "WxH, SIZE unit, FORMAT" label (e.g. "1200×1200, 703.99 kB, JPEG" — seen
  // verbatim in the issue's own example HTML) alongside "Type: front Source:
  // X". Parsing it lets pickBestCover skip a network fetch entirely for that
  // candidate. It is NOT reliably present (live testing this session — both a
  // clean fetch and majkinetor's own logged-out browser — only ever showed
  // "Type: front Source: X", no size caption), so this is an optimization,
  // never a requirement: candidates missing it fall back to fetch+measure.
  function parseCoverCaptionMeta(figure) {
    const labels = [...figure.querySelectorAll('figcaption .label')].map(el => (el.textContent || '').trim());
    for (const t of labels) {
      const m = t.match(/^(\d+)\s*[×x]\s*(\d+)\s*,\s*([\d.]+)\s*(B|kB|MB)\b/i);
      if (!m) continue;
      const unit = m[4].toLowerCase();
      const mult = unit === 'mb' ? 1000 * 1000 : unit === 'kb' ? 1000 : 1;
      return { width: +m[1], height: +m[2], size: Math.round(parseFloat(m[3]) * mult) };
    }
    return null;
  }
  // Collects one candidate per non-Discogs cover figure — the direct <a href>
  // (Harmony's own best copy per provider), not the smaller thumbnail <img
  // src>. Best-across-providers is picked later by pickBestCover.
  function scrapeHarmonyCover() {
    const mbLink = [...document.querySelectorAll('a')].find(a => /^open in musicbrainz$/i.test((a.textContent || '').trim()));
    const href = mbLink && mbLink.getAttribute('href');
    const m = href && href.match(/musicbrainz\.org\/release\/([0-9a-f-]{36})/i);
    if (!m) return null;
    const mbid = m[1].toLowerCase();
    const candidates = [...document.querySelectorAll('figure.cover-image[data-provider]')]
      .filter(f => (f.getAttribute('data-provider') || '').toLowerCase() !== 'discogs')
      .map(f => {
        const a = f.querySelector('a[href]');
        if (!a) return null;
        return { provider: f.getAttribute('data-provider') || '', url: a.getAttribute('href'), ...(parseCoverCaptionMeta(f) || {}) };
      })
      .filter(Boolean);
    return candidates.length ? { mbid, coverCandidates: candidates } : null;
  }
  // Cross-origin image fetch as a Blob. Cover candidates live on arbitrary
  // provider CDNs (Deezer, Spotify, Qobuz, Apple, Tidal, ...), not
  // musicbrainz.org/harmony.pulsewidth.org.uk, so a plain fetch() would hit
  // page CORS — GM_xmlhttpRequest bypasses it. Same helper (and same need) as
  // Art Station's gmFetch (art_station.user.js).
  function gmFetch(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType: 'blob', timeout: 30000,
        onload: r => { (r.status >= 200 && r.status < 300 && r.response) ? resolve(r.response) : reject(new Error('fetch ' + r.status)); },
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timed out')),
      });
    });
  }
  async function measureCandidate(url) {
    const blob = await gmFetch(url);
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    if (bitmap.close) bitmap.close();
    return { width, height, size: blob.size, blob };
  }
  // #494: picks the release's best cover — highest resolution, then lowest
  // size. Runs AFTER the item is already queued (fire-and-forget, mirroring
  // fetchEntityName's post-add enrichment at addToQueue) rather than before
  // Harmony's window.open(), since an await there risks the popup being
  // blocked. Candidates that already carry caption metadata (see
  // parseCoverCaptionMeta) cost no fetch at all; the rest are measured live.
  async function pickBestCover(item) {
    // #496: cover[] is an array, but Falcon only ever auto-picks for the
    // first entry — the one entry Harmony's candidates land in today.
    const entry = item.cover && item.cover[0];
    const candidates = (entry && entry.candidates) || [];
    if (!candidates.length) return;
    let best = null;
    const consider = (c, width, height, size) => {
      const area = width * height;
      if (!best || area > best.area || (area === best.area && size < best.size)) best = { url: c.url, provider: c.provider, area, size, width, height };
    };
    for (const c of candidates) {
      if (c.width && c.height && c.size) { consider(c, c.width, c.height, c.size); continue; }
      try { const m = await measureCandidate(c.url); consider(c, m.width, m.height, m.size); }
      catch (e) { dbg('[cover]', `${item.mbid}: ${c.provider} candidate failed to measure — ${e.message}`); }
    }
    if (!best) return;
    entry.url = best.url;
    dbg('[cover]', `${item.mbid}: picked ${best.provider} (${best.width}x${best.height}, ${best.size}b) of ${candidates.length} candidate(s)`);
    scheduleRender('queue');
  }
  // #494 follow-up (majkinetor): "Harmony always presents cover art even if
  // it is already present on MB... adding cover is not idempotent. We could
  // at minimum show if release has any covers as a warning." Originally
  // called the Cover Art Archive's own API directly, but that's a genuine
  // cross-origin request and it started failing outright live ("Failed to
  // fetch" — a real userscript-manager sandbox is more restrictive here than
  // a plain devtools fetch, unlike Falcon's other cross-origin need which
  // goes through GM_xmlhttpRequest for exactly this reason). MB's own WS2
  // release endpoint already reports the same information same-origin —
  // `cover-art-archive.count` — so use that instead: no cross-origin call at
  // all, through the same throttle every other MB lookup here uses. Same
  // fire-and-forget-after-queuing shape as pickBestCover; sets
  // item.coverExistingCount (null while unknown, 0 once confirmed there's
  // nothing there) for renderRowDetail to warn on — item-level, not per-cover-
  // entry, since it's a fact about the RELEASE, not about any one image
  // being added (#496).
  async function checkExistingCoverArt(item) {
    // priority: this is actionable safety info, not cosmetic like a name
    // lookup — it shouldn't sit behind a whole batch's worth of those.
    const j = await mbThrottle.fetchJson(`${MB_ORIGIN}/ws/2/release/${item.mbid}?fmt=json`, undefined, true);
    if (!j) { dbg('[cover]', `${item.mbid}: existing-cover-art check failed (no response)`); return; }   // transient — leave unknown rather than assert "none"
    item.coverExistingCount = (j['cover-art-archive'] && j['cover-art-archive'].count) || 0;
    dbg('[cover]', `${item.mbid}: ${item.coverExistingCount} existing cover image(s) per MB's own cover-art-archive field`);
    scheduleRender('queue');
  }
  function makePendingToken() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  // #498 (chaban-mb via majkinetor): after a release is added to MB FROM
  // Harmony, Harmony's own actions page carries that release's mbid right in
  // its query string (`?...&release_mbid=<mbid>`) — landing Falcon's panel on
  // that release's own page instead of MB's bare homepage skips a manual
  // navigation. The target is the plain release page, NOT its relationship
  // editor (chaban-mb's own correction: provider links Harmony doesn't cover,
  // tagging, and adding to a collection all happen from there, none of it
  // from inside the relationship editor — matching what MB's native
  // post-creation redirect already does without Harmony's "Redirect to
  // Release Actions" setting turned on).
  function harmonyReleaseMbid() {
    const v = new URLSearchParams(location.search).get('release_mbid');
    return v && MBID_RE.test(v) ? v.toLowerCase() : null;
  }
  let harmonyBtn = null;
  function ensureHarmonyButton() {
    const items = scrapeHarmonyActions();
    const cover = scrapeHarmonyCover();
    // #500: the isrc fallback only matters when there are no recording
    // tuples for scrapeHarmonyActions to have already zipped isrcs onto.
    const isrcFallback = items.some(t => t.entityType === 'recording') ? null : harmonyIsrcFallback();
    const total = items.length + (cover ? 1 : 0) + (isrcFallback ? isrcFallback.isrcs.filter(Boolean).length : 0);
    if (!harmonyBtn) {
      harmonyBtn = document.createElement('button');
      harmonyBtn.type = 'button'; harmonyBtn.id = 'falcon-harmony-btn';
      harmonyBtn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;padding:10px 16px;border-radius:20px;border:none;cursor:pointer;background:#1b2a4a;color:#fff;font:bold 13px Arial;box-shadow:0 3px 12px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;transition:opacity .15s';
      harmonyBtn.innerHTML = `<span style="display:flex;color:#ff9d5c">${ICON}</span><span id="falcon-harmony-lbl"></span>`;
      harmonyBtn.onclick = () => {
        const found = scrapeHarmonyActions();
        const foundCover = scrapeHarmonyCover();
        const foundIsrcFallback = found.some(t => t.entityType === 'recording') ? null : harmonyIsrcFallback();
        if (!found.length && !foundCover && !foundIsrcFallback) { alert(`${NAME}: no "Link external IDs" actions, cover art, or ISRCs found on this page.`); return; }
        const token = makePendingToken();
        const payload = found.map(t => ({ entityType: t.entityType, mbid: t.mbid, url: t.url, linkTypeId: t.linkTypeId || undefined, note: t.note || undefined, isrc: t.isrc || undefined }));
        if (foundCover) payload.push({ entityType: 'release', mbid: foundCover.mbid, coverCandidates: foundCover.coverCandidates });
        if (foundIsrcFallback) payload.push({ entityType: 'recording', pendingIsrcs: foundIsrcFallback });
        GM_setValue('falcon:pending:' + token, JSON.stringify(payload));
        const relMbid = harmonyReleaseMbid();
        const target = relMbid ? `${MB_TARGET}/release/${relMbid}?falcon=${token}` : `${MB_TARGET}/?falcon=${token}`;
        window.open(target, '_blank');
      };
      document.body.appendChild(harmonyBtn);
    }
    const lbl = document.getElementById('falcon-harmony-lbl');
    lbl.textContent = total ? `Send ${total} to Falcon` : 'No Falcon actions found yet…';
    harmonyBtn.style.opacity = total ? '1' : '.6';
    harmonyBtn.title = total ? `Opens MusicBrainz with ${total} item(s) queued in Falcon` : 'Waiting for Harmony to render its actions…';
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
  // accepts EITHER a worker <iframe> element OR a plain window handle (from
  // window.open — used by the "open in a real tab" manual-review path, #467) —
  // same-origin either way, so fillAndSubmit's own logic never needs to know which.
  function frameDoc(target) { try { return ('contentDocument' in target) ? target.contentDocument : (target.document || null); } catch (e) { return null; } }
  // ⚠ NEVER NAVIGATE THROUGH THE WINDOW THIS RETURNS.
  // It is deliberately allowed to be the current window — fillAndSubmit is also
  // driven directly against the page you're on (the "open in a real tab" path,
  // and several tests). That makes it fine for reading and for filling, and
  // categorically unsafe for navigating: under a userscript manager's Xray
  // wrappers these handles are not always what they look like, and a navigation
  // meant for a worker frame taking the whole tab — panel, workers and queue
  // with it — is exactly how #467 lost a run. Navigate iframes via `.src`, which
  // can only ever move the element it belongs to.
  function frameWin(target) { try { return ('contentWindow' in target) ? target.contentWindow : target; } catch (e) { return null; } }

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
  // #467 (majkinetor): when a url is rejected, MB almost always renders the REAL reason
  // right on the page (e.g. "This URL is not allowed for artists.", "This relationship
  // already exists.") — scrape it instead of guessing. Falls back to a generic message
  // only when MB genuinely didn't show one.
  function findFieldError(doc) {
    const texts = [...doc.querySelectorAll('.error, .field-error')].map(el => (el.textContent || '').trim()).filter(Boolean);
    return texts.length ? [...new Set(texts)].join(' / ') : null;
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
  // #495: the release editor's own "Enter edit" button lives inside its
  // jQuery-UI-tabs "Edit note" panel (display:none until that tab is
  // active) — a bare element.click() on the tab link does nothing (jQuery UI
  // binds its handler expecting a real event), so dispatch a genuine
  // MouseEvent instead, exactly as a real click would arrive. No-op (returns
  // false) on any page that isn't actually tabbed this way.
  function activateReleaseEditNoteTab(doc) {
    const nav = doc.querySelector('#release-editor .ui-tabs-nav, #release-editor ul.ui-tabs-nav');
    const a = nav && [...nav.querySelectorAll('a')].find(x => (x.getAttribute('href') || '') === '#edit-note');
    if (!a) return false;
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: doc.defaultView }));
    return true;
  }
  // harmonyNote is deliberately NOT re-inserted here: buildSeedEditUrl already
  // put it in the page's edit_note query param, so MB's own rendering has
  // already seeded it into the textarea by the time this runs — pushing it
  // again duplicated the line (#475: "the edit notes repeat the line
  // 'Matched recording while importing ... with Harmony'").
  const FALCON_SIGNATURE = () => `${NAME} v${scriptVersion()} by majkinetor - ${HELP_URL}`;
  const editNoteText = (results) => {
    const added = results.filter(r => r.ok).map(r => r.url);
    const lines = [FALCON_SIGNATURE(), '', 'Bulk-added via the Falcon queue:', ...added];
    return lines.join('\n');
  };

  // MB shows the relationship type as a plain read-only label when there's only one
  // valid type for that url (nothing to set), or a <select class="link-type"> when
  // ambiguous (e.g. Bandcamp: streaming vs purchase). When Harmony hands us an
  // explicit linkTypeId, honor it whenever a select is actually present.
  async function setRowLinkType(iframe, row, linkTypeId) {
    if (!linkTypeId) return null;
    const typeRow = row.nextElementSibling;
    const select = typeRow?.classList?.contains('relationship-item') ? typeRow.querySelector('select.link-type') : null;
    if (!select) return null;   // unambiguous — MB already resolved it, nothing to override
    if (![...select.options].some(o => o.value === String(linkTypeId))) return false;
    const w = frameWin(iframe);
    const setSel = Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set;
    setSel.call(select, String(linkTypeId));
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    return true;
  }
  // Harmony sometimes wants TWO relationship types on the IDENTICAL url (e.g. a
  // Bandcamp track as both "stream for free" and "purchase for download") — MB
  // supports this via the row's own "Add another relationship" control, not by
  // re-typing the url again (that wouldn't create a second row at all).
  async function addSecondRelationshipType(iframe, row, linkTypeId) {
    if (!linkTypeId) return false;
    const typeRow = row.nextElementSibling;
    if (!typeRow || !typeRow.classList?.contains('relationship-item')) return false;
    const addRow = typeRow.nextElementSibling;
    const addBtn = addRow?.classList?.contains('add-relationship') ? addRow.querySelector('button.add-item') : null;
    if (!addBtn) return false;
    addBtn.click();
    const newSelect = await waitFor(() => {
      const s = typeRow.nextElementSibling;
      if (!s || !s.classList?.contains('relationship-item')) return null;
      const sel = s.querySelector('select.link-type');
      return (sel && !sel.value) ? sel : null;
    }, 3000);
    if (!newSelect || ![...newSelect.options].some(o => o.value === String(linkTypeId))) return false;
    const w = frameWin(iframe);
    const setSel = Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set;
    setSel.call(newSelect, String(linkTypeId));
    newSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
    return true;
  }

  // fill every URL in item.urls (one "Add another link" round-trip each, or a second
  // relationship type on an already-present url) then submit ONCE for the whole
  // group, all directly against the iframe's OWN document/window (same-origin — no
  // postMessage needed, see #467). A url that MB rejects (e.g. already present)
  // doesn't abort the rest — it's recorded in the returned per-url results and the
  // others still go in. Only truly infra-level failures (no submit button, never
  // redirected) throw; "nothing to submit" is signalled via `committed: false`, not
  // a throw, since it isn't necessarily an error (every url in the group may simply
  // already be on the entity).
  // #467 (majkinetor): after a url row exists (whether just typed, or already
  // pre-filled by MB's own seed-url params — see buildSeedEditUrl/workerLoop),
  // this is the shared "is it actually usable" check: a genuinely-duplicate url
  // MB rejected (real .error/.field-error text) or a REQUIRED relationship-type
  // <select> still sitting blank because Falcon had no linkTypeId to give it —
  // either one, left in place, invalidates the WHOLE form's submit button, not
  // just this row. Removes the row and returns a clear, actionable reason;
  // returns null when the row is fine as-is.
  // Finds the row for a url, in EITHER state MB can leave it in:
  //  - resolved: an <a href> link row (typed-and-classified, or seeded and
  //    successfully auto-classified)
  //  - unresolved: still an editable <input> holding the url text, which is
  //    what a SEEDED url MB couldn't classify looks like (confirmed live: a
  //    bandcamp track seeded onto a recording renders as an input row with a
  //    blank required select and NO href). Matching only on `a[href]` missed
  //    these entirely — the blank select then silently disabled submit for the
  //    whole group while Falcon re-typed a duplicate of the same url.
  function findRowForUrl(doc, url) {
    if (!doc) return null;
    const rows = [...doc.querySelectorAll('tr.external-link-item')];
    return rows.find(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === url)
      || rows.find(tr => (tr.querySelector('input')?.value || '') === url)
      || null;
  }
  // Both states at once, for a url that can legitimately have TWO rows: when a
  // url is ALREADY on the entity and we also seed it, MB keeps the existing
  // resolved row AND adds our seeded copy as a separate unresolved input row.
  // That extra row's blank required select disables submit for the whole group,
  // so it has to be found and dropped even though the "real" row looks fine.
  function findRowsForUrl(doc, url) {
    const rows = doc ? [...doc.querySelectorAll('tr.external-link-item')] : [];
    const match = rows.filter(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === url || (tr.querySelector('input')?.value || '') === url);
    return {
      resolved: match.find(tr => !!tr.querySelector('a[href]')) || null,
      unresolved: match.filter(tr => !tr.querySelector('a[href]') && !!tr.querySelector('input')),
    };
  }
  // Every relationship-type row hanging off `url`'s row(s) — MB renders one
  // `tr.relationship-item` per type directly after the `tr.external-link-item`
  // it belongs to. Used to tell whether a type Falcon wants is ALREADY on the
  // page (seeded by MB itself) before reaching for the DOM-poking fallback.
  function typeRowsForUrl(doc, url) {
    const rows = doc ? [...doc.querySelectorAll('tr.external-link-item')] : [];
    const owners = rows.filter(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === url || (tr.querySelector('input')?.value || '') === url);
    const out = [];
    owners.forEach(owner => {
      let n = owner.nextElementSibling;
      while (n && n.classList?.contains('relationship-item')) { out.push(n); n = n.nextElementSibling; }
    });
    return out;
  }
  const hasTypeForUrl = (doc, url, linkTypeId) => typeRowsForUrl(doc, url)
    .some(tr => tr.querySelector('select.link-type')?.value === String(linkTypeId));
  // Final safety net before submit. Seeding a url that's ALREADY on the entity
  // makes MB attach a SECOND, blank relationship row under that url's existing
  // row (its own dual-relationship mechanism) rather than adding a new url row
  // — confirmed live. That blank required select disables submit for the WHOLE
  // form, and it isn't reachable by url lookup (the row carries no href of its
  // own), so per-url checks can't see it. Sweeps every still-blank type select,
  // removes its relationship row, and reports which url it belonged to (found
  // by walking back to the owning external-link-item).
  function sweepBlankTypeRows(doc) {
    if (!doc) return [];
    const dropped = [];
    [...doc.querySelectorAll('select.link-type')].filter(s => !s.value).forEach(sel => {
      const relRow = sel.closest('tr');
      if (!relRow) return;
      let owner = relRow.previousElementSibling;
      while (owner && !owner.classList.contains('external-link-item')) owner = owner.previousElementSibling;
      const url = owner?.querySelector('a[href]')?.getAttribute('href') || owner?.querySelector('input')?.value || null;
      const removeBtn = relRow.querySelector('button.remove-item') || relRow.querySelector('button.remove-button');
      if (removeBtn) { removeBtn.click(); dropped.push(url); }
    });
    return dropped;
  }
  // ⚠ NEVER remove a row that represents a PRE-EXISTING relationship.
  // #467: checkRowUsable used to click "remove" on any row MB complained about
  // — but when the complaint is "This relationship already exists", that row is
  // REAL EXISTING DATA, and removing it stages a DELETION. Caught live on
  // majkinetor's failing recording: a re-run over an already-imported entity had
  // three `.rel-remove` markers staged against its qobuz relationship. It never
  // reached the server (those runs all timed out), but a submit would have
  // destroyed existing links. MB marks rows WE added with `rel-add`, so only
  // those are ours to take back; anything unmarked pre-dates us — report the
  // url as failed and leave the row strictly alone.
  function isOurs(row) {
    if (!row) return false;
    if (row.querySelector('.rel-add') || /\brel-add\b/.test(row.className)) return true;
    const next = row.nextElementSibling;
    return !!(next && next.classList?.contains('relationship-item') && next.querySelector('.rel-add'));
  }
  function removeIfOurs(row) {
    if (!isOurs(row)) return false;
    row.querySelector('button.remove-item')?.click();
    return true;
  }
  function checkRowUsable(doc, row, linkTypeId) {
    const typeRow = row.nextElementSibling;
    // scoped to just THIS row + its own type-row sibling — a real entity can
    // easily carry OTHER, unrelated .error/.field-error text elsewhere on the
    // page (e.g. from a genuinely pre-existing relationship that has nothing
    // to do with what was just seeded); a page-wide findFieldError() scrape
    // here misattributed those to whichever url happened to be checked next.
    const scope = [row, typeRow].filter(Boolean);
    const errAlready = scope.map(el => [...el.querySelectorAll('.error, .field-error')].map(e => (e.textContent || '').trim()).filter(Boolean).join(' / ')).filter(Boolean).join(' / ');
    // a blank REQUIRED type select is checked FIRST: MB's own text for it
    // ("Please select a link type...") says what's wrong but not what to do
    // about it, so this reports the actionable version instead. Any OTHER MB
    // error (duplicate link, url not allowed for this entity type...) is
    // reported verbatim below — MB says it better than a guess would.
    const ambiguousSelect = typeRow?.classList?.contains('relationship-item') ? typeRow.querySelector('select.link-type') : null;
    if (!linkTypeId && ambiguousSelect && !ambiguousSelect.value) {
      removeIfOurs(row);
      return 'ambiguous relationship type — MusicBrainz needs you to pick one; use ⇗ "open in tab" to add this url manually';
    }
    if (errAlready) { removeIfOurs(row); return errAlready; }
    return null;
  }
  // Every external link present BEFORE Falcon touches the form. Falcon only
  // ever adds, so every one of these must still be there at submit time. This
  // is checked structurally — by url — independently of MB's rel-* classes, so
  // the protection can't be silently defeated by a markup change on MB's side.
  function snapshotExistingUrls(doc) {
    if (!doc) return [];
    return [...doc.querySelectorAll('tr.external-link-item')]
      .map(tr => tr.querySelector('a[href]')?.getAttribute('href'))
      .filter(Boolean);
  }
  async function fillAndSubmit(iframe, item, opts) {
    const skipSubmit = !!(opts && opts.skipSubmit);
    const tag = (opts && opts.tag) || '[w?]';
    const baseline = (opts && opts.baseline) || snapshotExistingUrls(frameDoc(iframe));
    const results = [];
    dbg(tag, `fillAndSubmit start — ${item.urls.length} url(s), skipSubmit=${skipSubmit}, ${baseline.length} pre-existing link(s) to preserve`);
    const tFillStart = Date.now();
    // workerLoop navigates straight to buildSeedEditUrl(item) — MB's own seed-url
    // params (the same ones Harmony uses) pre-fill the FIRST occurrence of each
    // distinct url as the page renders, no typing needed at all (majkinetor,
    // #467: "why you didn't use URL params... it should basically be instant").
    // MB collapses a REPEAT occurrence of the identical url text into that same
    // one row, though, so a dual-relationship-type group (the same url twice
    // with two different linkTypeIds) still needs its second occurrence added
    // by hand via "Add another relationship" — occurrence-tracked below.
    const seen = new Map();
    for (const { url, linkTypeId } of item.urls) {
      const occurrence = seen.get(url) || 0;
      seen.set(url, occurrence + 1);
      try {
        const doc0 = frameDoc(iframe);
        const existingRow = findRowForUrl(doc0, url);
        dbg(tag, `url[${occurrence}] ${url} (type=${linkTypeId || 'auto'}) — preexisting row: ${existingRow ? (existingRow.querySelector('a[href]') ? 'resolved' : 'unresolved-input') : 'none'}`);
        if (existingRow && occurrence > 0) {
          // Normal (seeded) path: buildSeedEditUrl gave this url+type its own
          // slot, so MB has already rendered the second type and there is
          // nothing to do. Only a non-seeded caller (fillAndSubmit driven
          // directly, as the tests do) still needs the click-and-poke fallback.
          if (linkTypeId && hasTypeForUrl(doc0, url, linkTypeId)) {
            dbg(tag, `  repeat occurrence -> type ${linkTypeId} already seeded by MB, nothing to do`);
            results.push({ url, ok: true });
            continue;
          }
          const added = await addSecondRelationshipType(iframe, existingRow, linkTypeId);
          dbg(tag, `  repeat occurrence -> addSecondRelationshipType = ${added}`);
          results.push({ url, ok: added, error: added ? undefined : (linkTypeId ? 'could not add a second relationship type — this url is already present' : 'this url is already present') });
          continue;
        }
        if (existingRow) {
          // First occurrence, row(s) already present — seeded by us, or
          // genuinely already on the entity before Falcon touched it, or BOTH
          // (in which case MB keeps the pre-existing resolved row and adds our
          // seeded copy as a separate unresolved one).
          const { resolved, unresolved } = findRowsForUrl(doc0, url);
          dbg(tag, `  rows: resolved=${!!resolved} unresolved=${unresolved.length}`);
          if (resolved && unresolved.length) {
            // the url was already on this entity — our seeded duplicate is just
            // dead weight whose blank select would block the whole submit.
            unresolved.forEach(removeIfOurs);
            await wait(150);
            dbg(tag, `  already on entity -> dropped ${unresolved.length} seeded duplicate row(s)`);
            results.push({ url, ok: false, error: 'this url is already present on the entity' });
            continue;
          }
          const target = resolved || unresolved[0] || existingRow;
          // applying a known linkTypeId also RESOLVES a row MB left unclassified;
          // without one, checkRowUsable decides whether the row is committable
          // as-is and removes+reports it when it isn't, so one bad row can't
          // silently disable submit for the entire group.
          // Only type a row WE added. Re-typing a PRE-EXISTING relationship
          // would rewrite curated data — caught live: a re-run was staging a
          // rel-edit that changed an existing qobuz 'license' relationship to
          // the type Harmony suggested. Falcon adds links; it doesn't
          // reinterpret ones an editor already classified.
          if (linkTypeId && isOurs(target)) {
            const set = await setRowLinkType(iframe, target, linkTypeId);
            dbg(tag, `  setRowLinkType(${linkTypeId}) = ${set}`);
          } else if (linkTypeId) {
            dbg(tag, `  leaving type alone — this relationship already existed before Falcon touched it`);
          }
          const reason = checkRowUsable(doc0, target, linkTypeId);
          dbg(tag, `  checkRowUsable -> ${reason ? 'REJECT: ' + reason : 'ok'}`);
          if (reason) { results.push({ url, ok: false, error: reason }); continue; }
          results.push({ url, ok: true });
          continue;
        }
        // not pre-filled at all — type it, which runs MB's own url classifier.
        dbg(tag, '  not seeded — falling back to typing it');
        const input = await waitFor(() => frameDoc(iframe) && findAddLinkInput(frameDoc(iframe)), 12000);
        if (!input) { dbg(tag, '  no "Add another link" input appeared within 12s'); results.push({ url, ok: false, error: 'no "Add another link" input ever appeared' }); continue; }
        const d2 = frameDoc(iframe), w2 = frameWin(iframe);
        const setVal = Object.getOwnPropertyDescriptor(w2.HTMLInputElement.prototype, 'value').set;
        input.focus();
        setVal.call(input, url);
        input.dispatchEvent(new w2.Event('input', { bubbles: true }));
        input.dispatchEvent(new w2.Event('change', { bubbles: true }));
        input.dispatchEvent(new w2.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new w2.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.blur();
        const row = await waitFor(() => {
          const dd = frameDoc(iframe); if (!dd) return null;
          const r = [...dd.querySelectorAll('tr.external-link-item')].find(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === url);
          return r || null;
        }, 8000);
        if (!row) {
          const mbError = findFieldError(frameDoc(iframe));
          dbg(tag, `  typed row never appeared within 8s — MB said: ${mbError || '(nothing)'}`);
          results.push({ url, ok: false, error: mbError || 'URL row never appeared after Enter (MB gave no specific reason)' });
          continue;
        }
        if (linkTypeId) await setRowLinkType(iframe, row, linkTypeId);
        const reason = checkRowUsable(frameDoc(iframe), row, linkTypeId);
        dbg(tag, `  typed ok, checkRowUsable -> ${reason ? 'REJECT: ' + reason : 'ok'}`);
        if (reason) { results.push({ url, ok: false, error: reason }); continue; }
        results.push({ url, ok: true });
      } catch (e) { dbg(tag, `  threw: ${e.message || e}`); results.push({ url, ok: false, error: e.message || String(e) }); }
    }
    // any type select still blank at this point would silently disable submit
    // for the whole form — drop those rows and demote the urls they belonged to
    // (see sweepBlankTypeRows) so the rest of the group can still commit.
    const swept = sweepBlankTypeRows(frameDoc(iframe));
    if (swept.length) {
      await wait(200);
      dbg(tag, `blank-select sweep removed ${swept.length} row(s): ${JSON.stringify(swept)}`);
      swept.forEach(sweptUrl => {
        const hit = results.find(r => r.ok && (sweptUrl === null || r.url === sweptUrl));
        if (hit) { hit.ok = false; hit.error = 'this url is already present on the entity (MusicBrainz wanted a second relationship type for it, and none was given)'; }
      });
    }
    dbg(tag, `per-url outcome: ${JSON.stringify(results.map(r => ({ u: r.url.slice(-40), ok: r.ok, e: r.error })))}`);
    // #474: a recording queued with a comment/isrc (with or without urls) has
    // something to submit even when no url in this group committed — MB's
    // comment field and its ISRC list are plain fields with no .rel-add-style
    // "this changed" marker at all (checked MB's own source: comment is a bare
    // <input>, ISRC is a React FormRowTextList whose rows look identical
    // whether seeded or pre-existing), so there's no reliable way to tell
    // "genuinely new" from "already there" without an extra fetch per item.
    // Trusting the sender here matches majkinetor's own scoping for this
    // feature ("sender is responsible for filling it") — Falcon doesn't try
    // to be clever about it, same as it doesn't verify a url is really new
    // before offering to add it.
    // #495 (majkinetor, live: a release item whose url got rejected still
    // attempted to submit — "worker now has to set links for the submit
    // button to appear" turned out to be the actual signal: MB's release
    // editor gets stuck showing fabricated new-release validation errors
    // specifically when asked to submit a form with NOTHING genuinely
    // changed on it). `comment`/`isrcs` are only ever seeded into the form
    // for entityType 'recording' (see buildSeedEditUrl) — a release item's
    // `comment` means its cover-art image comment (#494), never submitted
    // here at all, so it must not count as "something to submit" for THIS
    // form.
    const hasFieldChange = item.entityType === 'recording' && !!(item.disambiguation || (item.isrcs && item.isrcs.length));
    if (!results.some(r => r.ok) && !hasFieldChange) { dbg(tag, 'NOT SUBMITTING — no url in this group ended up committable, and no disambiguation/isrc queued'); return { committed: false, results, fillMs: Date.now() - tFillStart }; }
    // #467 (majkinetor, "still fails if not shown" — actually nothing to do with
    // visibility): when every url is ALREADY on the entity with the right type,
    // nothing changed and MB has no edit to create. It leaves "Enter edit"
    // enabled regardless, so clicking it silently does nothing and Falcon sat
    // out the full 50s before reporting "never redirected" — on a batch that was
    // in fact already up to date. MB marks pending changes on the rows
    // themselves, so ask it directly rather than submitting into the void.
    // Verified live on his exact failing recording: 0 markers, submit enabled,
    // click does nothing.
    // ⚠ Falcon only ever ADDS links. A staged removal means something went
    // wrong on our side (see isOurs/removeIfOurs) and submitting would destroy
    // existing data, so refuse outright rather than risk it — a failed item is
    // recoverable, a deleted relationship is not.
    // Two independent checks, because this is the one failure mode that
    // destroys data rather than merely failing:
    //   1. MB's own marker for a staged removal.
    //   2. Structural — did any link that existed before we started disappear?
    //      Survives MB renaming its CSS classes, which check 1 would not.
    const doomed = (frameDoc(iframe)?.querySelectorAll('.rel-remove') || []).length;
    const nowUrls = new Set(snapshotExistingUrls(frameDoc(iframe)));
    const vanished = baseline.filter(u => !nowUrls.has(u));
    if (doomed || vanished.length) {
      const why = doomed
        ? `${doomed} relationship removal(s) staged`
        : `${vanished.length} pre-existing link(s) vanished from the form: ${vanished.slice(0, 3).join(', ')}`;
      dbg(tag, `REFUSING TO SUBMIT — ${why}. Falcon only ever adds links, so this form is not safe to commit.`);
      return {
        committed: false,
        results: results.map(r => r.ok ? { ...r, ok: false, error: `not submitted — ${why}; Falcon never removes links, so it refused to commit this form` } : r),
        fillMs: Date.now() - tFillStart,
      };
    }
    const pending = (frameDoc(iframe)?.querySelectorAll('.rel-add, .rel-edit') || []).length;
    if (!pending && !hasFieldChange) {
      dbg(tag, 'NOT SUBMITTING — MB shows no pending change; every url is already on the entity with this type');
      return { committed: false, results, noop: true, fillMs: Date.now() - tFillStart };
    }
    dbg(tag, `${pending} pending relationship change(s) staged` + (hasFieldChange ? ' + disambiguation/isrc queued' : ''));
    const d2 = frameDoc(iframe), w2 = frameWin(iframe);
    const noteSet = setEditNote(d2, w2, editNoteText(results));
    dbg(tag, `edit note set = ${noteSet}`);
    // #495: unlike artist/label/recording's single-purpose edit page, the
    // release editor is tabbed (Release information / Tracklist / Recordings
    // / Edit note) and keeps its own "Enter edit" button (#enter-edit) inside
    // the Edit note tab panel, display:none until that tab is genuinely
    // activated — verified live: a bare .click() doesn't trigger jQuery UI's
    // tab handler, but dispatching a real MouseEvent on the tab's own <a
    // href="#edit-note"> does. Filling the External Links section above
    // happens on the default-active Information tab regardless, so this only
    // needs to run once, right before we go looking for the submit button.
    if (item.entityType === 'release') activateReleaseEditNoteTab(d2);
    await wait(150);
    // manual-review path (openInTab, #467): fill the form and stop here — a human
    // reviews and clicks "Enter edit" themselves, exactly like a Harmony tab.
    if (skipSubmit) return { committed: false, results, manual: true, fillMs: Date.now() - tFillStart };
    const btn = findSubmitButton(frameDoc(iframe));
    if (!btn) { dbg(tag, 'NOT SUBMITTING — no submit button found on the page'); throw new Error('no submit button found'); }
    if (btn.disabled) {
      const reason = findFieldError(frameDoc(iframe));
      const blanks = [...(frameDoc(iframe)?.querySelectorAll('select.link-type') || [])].filter(s => !s.value).length;
      dbg(tag, `NOT SUBMITTING — submit disabled; page errors: ${reason || '(none)'}; still-blank type selects: ${blanks}`);
      // #495 (majkinetor, live on both test.musicbrainz.org and production): a
      // known MusicBrainz client bug — the release editor's own validation
      // can report "a release title is required" etc. on an EXISTING release
      // that plainly has one (checked live: window.MB.releaseEditor's actual
      // data model has the real title/tracklist at the same moment the
      // validator claims none of it exists — a genuine MB-side state
      // disconnect, not bad data). Not something Falcon can route around
      // reliably (no interaction reproducibly clears it), so just name it
      // plainly instead of leaving a wall of "add a medium"/"track titles
      // required" text that reads like this release is actually broken.
      const knownBug = item.entityType === 'release' && /a release title is required/i.test(reason || '');
      const note = knownBug ? ' (this looks like a known MusicBrainz client bug on an otherwise-fine release, not bad data — retry, or use ⇗ to finish it by hand)' : '';
      throw new Error((reason ? `submit button disabled — ${reason}` : 'submit button disabled (form invalid?)') + note);
    }
    // #467 (majkinetor): "One didn't pass, there was nothing in worker that was
    // regarded as error and Enter button was enabled, with all links and types
    // set." A valid form with an enabled button that still never submits points
    // at the CLICK, not validation — and MB's editor is React: setting the edit
    // note just above re-renders, which can DETACH the button node found
    // earlier. Clicking a detached node silently does nothing, and the only
    // symptom is the 25s "never redirected" timeout on a form that looks
    // perfectly fine. So: re-query the button immediately before every click,
    // never reuse a stale reference, and if the page hasn't moved shortly after
    // a click, re-query and try again (falling back to submitting the form
    // directly) rather than waiting out the whole timeout on one lost click.
    // ⚠ Retry timing is load-bearing. A real submit on a busy MB routinely takes
    // 2-7s (measured on majkinetor's own runs: 2366 / 2390 / 3872 / 6392 /
    // 6557ms). An earlier version gave the FIRST attempt only a 4s window and
    // then clicked again — which fired a second submit while the first was
    // still in flight, and double-submitting this form leaves it wedged on
    // /edit. That made things strictly worse: entire batches of 3 failed
    // together, every time, until the queue thinned out. So the first click now
    // gets the FULL patient wait, exactly as it did before retries existed;
    // re-clicking only happens after the page has demonstrably gone nowhere for
    // that whole time, when nothing can still be in flight to disturb.
    const tSubmit = Date.now();
    const fillMs = tSubmit - tFillStart;
    const MAX_CLICKS = 2;
    const pageLeft = () => {
      const w = frameWin(iframe); if (!w) return null;
      try { return /\/edit(?:[?#]|$)/.test(w.location.pathname) ? null : true; } catch (e) { return null; }
    };
    let left = null;
    for (let attempt = 1; attempt <= MAX_CLICKS && !left; attempt++) {
      const doc = frameDoc(iframe);
      const fresh = findSubmitButton(doc);
      if (!fresh) { dbg(tag, `submit attempt ${attempt}: button vanished from the page`); break; }
      if (fresh.disabled) { dbg(tag, `submit attempt ${attempt}: button went disabled — ${findFieldError(doc) || '(no message)'}`); break; }
      dbg(tag, `submit attempt ${attempt}: clicking${fresh !== btn ? ' (button node was replaced since it was first found)' : ''}`);
      fresh.click();
      left = await waitFor(pageLeft, 25000);
      if (!left) dbg(tag, `submit attempt ${attempt}: page still on /edit after 25s`);
    }
    if (!left) {
      let where = '(unreadable)', pageErrs = '(unreadable)', btnState = '(unreadable)';
      try {
        const w = frameWin(iframe), d = frameDoc(iframe);
        where = w.location.href;
        pageErrs = findFieldError(d) || '(none)';
        const b = findSubmitButton(d);
        btnState = b ? `found, disabled=${b.disabled}` : 'gone';
      } catch (e) {}
      dbg(tag, `SUBMIT DID NOT LAND — ${Date.now() - tSubmit}ms, ${MAX_CLICKS} attempt(s); button: ${btnState}; MB errors: ${pageErrs}; frame url: ${where}`);
      throw new Error(`never redirected off /edit after submit${pageErrs && pageErrs !== '(none)' ? ' — MB says: ' + pageErrs : ''}`);
    }
    dbg(tag, `submit landed in ${Date.now() - tSubmit}ms`);
    return { committed: true, results, fillMs, submitMs: Date.now() - tSubmit };
  }

  // never hand out a queued item for an entity that's ALREADY being worked on by
  // another iframe — closes the race a later-added item for the same mbid would
  // otherwise open (grouping at add-time only covers items still queued at that
  // moment; this covers the rest).
  function nextQueued() {
    const activeKeys = new Set(queue.filter(i => i.status === 'active').map(i => i.entityType + ':' + i.mbid));
    // #497: a toggled-off type's queued items sit out this run entirely —
    // still in the queue, just never handed to a worker while off.
    return queue.find(i => i.status === 'queued' && !_disabledTypes.has(i.entityType) && !activeKeys.has(i.entityType + ':' + i.mbid));
  }
  function editUrl(item) { return `${MB_ORIGIN}/${entityUrlSegment(item.entityType)}/${item.mbid}/edit`; }
  // Same seed-url format Harmony itself uses (parseHarmonySeedUrl above decodes
  // exactly this) — MB's OWN edit-page JS reads these query params and pre-fills
  // the form NATIVELY as it renders, including auto-resolving an ambiguous
  // relationship-type <select> to the seeded linkTypeId. majkinetor, #467: "why
  // you didn't use URL params as usual so MB will set it immediately... it
  // should basically be instant, just like when opened from Harmony" — measured
  // live: ~2-3s (page load only) vs 10+s for typing simulation. One real
  // limitation, also confirmed live: MB collapses a DUPLICATE url TEXT into a
  // single row, so the same url seeded twice with two different linkTypeIds
  // (Harmony's dual-relationship case) only keeps the first — deduped here,
  // rare enough for a manual-review tab that the human can add the second by
  // hand if they need it (they're already there reviewing).
  function buildSeedEditUrl(item) {
    const prefix = `edit-${item.entityType}.`;
    const params = new URLSearchParams();
    // ⚠ Dedupe on url + link type, NOT on url alone. The same url under two
    // different link types is a legitimate pair (a Bandcamp track that is both
    // "stream for free" and "purchase for download"), and MB seeds it natively:
    // two indexed slots with the same text and different link_type_id produce
    // two relationships as the page renders. Collapsing them to one slot here
    // was what forced the old "click MB's Add-another-relationship button and
    // poke the new select" path — and THAT is what froze Firefox for 30-46s at
    // a stretch (#467), because a same-origin iframe shares the parent's main
    // thread, so MB's re-render storm on an already-rendered row blocked the
    // whole tab. Seeded up front, the identical batch runs ~4s/item, no stalls.
    const seen = new Set();
    let idx = 0;
    item.urls.forEach(u => {
      const key = `${u.url} ${u.linkTypeId || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      params.set(`${prefix}url.${idx}.text`, u.url);
      if (u.linkTypeId) params.set(`${prefix}url.${idx}.link_type_id`, u.linkTypeId);
      idx++;
    });
    // #474: disambiguation + ISRC — recording-only fields, seeded the exact
    // same way as everything else here (checked MB's own Form/Recording.pm:
    // MB's own field is internally called `comment` — Falcon's own field is
    // named `disambiguation` instead, #496, but the wire param name below is
    // MB's, not ours — and `isrcs` is a repeatable field keyed by index, same
    // pattern as url.N above).
    if (item.entityType === 'recording') {
      if (item.disambiguation) params.set(`${prefix}comment`, item.disambiguation);
      (item.isrcs || []).forEach((code, i) => params.set(`${prefix}isrcs.${i}.value`, code));
    }
    if (item.note) params.set(`${prefix}edit_note`, item.note);
    return `${MB_TARGET}/${entityUrlSegment(item.entityType)}/${item.mbid}/edit?${params.toString()}`;
  }

  // "open in a real tab" (majkinetor, #467): same reason Harmony itself opens a
  // tab per entity — a human can inspect, fix, and commit by hand. Navigates
  // straight to the seed url above rather than opening a blank edit page and
  // simulating typing — MB fills+resolves everything on its own as the page
  // renders, so there's nothing left for Falcon to do once the tab is open.
  // window.open must be the very first thing that runs (no preceding await) or
  // popup blockers treat it as not user-triggered.
  function openInTab(item) {
    // #494: release items have no edit-relationships form to seed — the
    // closest manual fallback is MB's own add-cover-art page (no seeding
    // possible there either, it's a plain upload form).
    if (item.entityType === 'release') {
      const tab = window.open(`${MB_ORIGIN}/release/${item.mbid}/add-cover-art`, '_blank');
      if (!tab) { log('error', `${item.mbid}: popup blocked — allow popups for this site to use "open in tab"`); return; }
      item.status = 'manual'; item.error = ''; renderQueue();
      log('info', `${entityLabel(item)} — opened MusicBrainz's add-cover-art page in a new tab for manual completion`);
      return;
    }
    const seedUrl = buildSeedEditUrl(item);
    const tab = window.open(seedUrl, '_blank');
    if (!tab) { log('error', `${item.mbid}: popup blocked — allow popups for this site to use "open in tab"`); return; }
    item.status = 'manual'; item.error = ''; renderQueue();
    const uniqueUrls = new Set(item.urls.map(u => u.url)).size;
    const dropped = item.urls.length - uniqueUrls;
    const droppedNote = dropped ? ` (${dropped} duplicate-url/second-type entr${dropped === 1 ? 'y' : 'ies'} couldn't be seeded — add by hand if needed)` : '';
    log('info', `${entityLabel(item)} — opened in a new tab, pre-filled instantly via MB's own seed-url params (${item.urls.length} link(s))${droppedNote}`);
  }

  // #467 (majkinetor, production hang): a MB edit form with typed-but-unsubmitted
  // changes registers a STICKY "unsaved changes" flag (addEventListener('beforeunload'))
  // — even removing the offending row afterward doesn't clear it (verified live).
  // Reassigning .src on that SAME iframe then triggers a native "leave site?" confirm
  // dialog, which — being a real modal — freezes the WHOLE TAB until a human dismisses
  // it. That's why every item now gets a genuinely FRESH iframe (see workerLoop) —
  // removing the old element outright, rather than reassigning .src, sidesteps the
  // dialog regardless of whether the previous page was dirty.
  // #467 follow-up (majkinetor: "the UI was unresponsive... full session"): a run
  // with NO failures at all still went unresponsive over several minutes — pointing
  // at leftover background activity (MB's own client JS: polling/retry timers) from
  // EACH earlier document not being fully torn down by a plain .src reassignment,
  // compounding across a long session. Always creating a fresh iframe per item (see
  // workerLoop) is the fix for that — a run no longer reassigns .src on one iframe
  // across many sequential items, so nothing compounds. A single RETIRED card's one
  // remaining iframe is bounded (that card processes nothing further), so — per
  // majkinetor: "I want to have worker visible there, in its active state" — it's
  // kept alive and inspectable rather than discarded. The error also gets its own
  // banner right in the card (not just a hover tooltip), so it's visible once zoomed.
  function retireCard(card, reason) {
    card.dataset.retired = '1';
    card.style.opacity = '.55';
    const lbl = card.querySelector('.falcon-worker-lbl');
    if (lbl) lbl.textContent = (lbl.textContent || '') + ' — stopped';
    card.title = 'This worker hit an issue and was retired — kept visible for inspection. ' + (reason || '');
    const banner = card.querySelector('.falcon-worker-errbanner');
    if (banner && reason) { banner.textContent = reason; banner.style.display = 'block'; }
  }
  function spawnWorkerCard() {
    const strip = document.getElementById('falcon-workers'); if (!strip) return null;
    const idx = workerCards.length;
    const card = document.createElement('div');
    card.className = 'falcon-worker-card';
    card.dataset.idle = '1';
    card.style.cssText = `border:1px solid #ccc;border-radius:4px;overflow:hidden;display:flex;flex-direction:column;flex:0 0 auto;width:${cfg.workerSize}px;height:${Math.round(cfg.workerSize * 0.8)}px;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:#f3f3f3;border-bottom:1px solid #ddd;font-size:10px">
        <span class="falcon-worker-lbl" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#555">idle</span>
        <button type="button" class="falcon-worker-zoom" title="Maximize this worker" style="border:none;background:none;cursor:pointer;font-size:12px;padding:0 2px">⛶</button>
      </div>
      <div class="falcon-worker-errbanner" style="display:none;padding:4px 6px;background:#fdecea;color:#a33;font-size:10px;white-space:pre-wrap;border-bottom:1px solid #f3c8c3"></div>
      <div class="falcon-worker-body" style="flex:1;position:relative;"></div>`;
    card.querySelector('.falcon-worker-zoom').onclick = () => { _zoomedWorker = _zoomedWorker === idx ? null : idx; renderWorkerLayout(); };
    strip.appendChild(card);
    workerCards.push(card);
    renderWorkerLayout();
    return card;
  }
  // MB's own pages aren't responsive down to a worker card's small width — loaded
  // at 260px wide, real content renders far outside that narrow viewport and
  // never becomes visible at all, showing as a blank white box (majkinetor,
  // #467, confirmed live: DOM had real, visible content, it was just laid out
  // off-screen). Fix: render the iframe at MB's normal desktop width, then
  // CSS-scale the whole thing down to exactly fill the card — MB always lays
  // out the page the way it was actually designed to, and the card just shows a
  // shrunk, still-legible thumbnail of it.
  const IFRAME_NATIVE_W = 980;
  // low-level: given a target visible area (w x h), render the iframe at MB's
  // natural desktop width and CSS-scale it down/up to exactly fill that area.
  // Shared by worker cards AND the item popup (which reparents a card's LIVE
  // iframe into itself, majkinetor: "I want to have worker visible there, in
  // its active state" — a fresh reload would lose the exact failure state).
  function sizeIframeFor(iframe, w, h) {
    if (!iframe || !w || h <= 0) return;
    const scale = w / IFRAME_NATIVE_W;
    iframe.style.width = IFRAME_NATIVE_W + 'px';
    iframe.style.height = Math.round(h / scale) + 'px';
    iframe.style.transform = `scale(${scale})`;
  }
  function applyIframeScale(card) {
    const body = card.querySelector('.falcon-worker-body');
    const iframe = body?.querySelector('iframe');
    if (!body || !iframe) return;
    // body.clientHeight is unreliable here — observed reading 0 even once the
    // card itself was fully laid out (flex:1 child of a column flex container
    // whose own height came from a plain inline style; some engines don't
    // settle its cross-size on the first pass). card's OWN clientWidth/Height
    // are solid, so derive the body's actual area from those instead of
    // trusting the (buggy) computed height on the flex child itself.
    const header = card.children[0];
    const banner = card.querySelector('.falcon-worker-errbanner');
    const bannerH = (banner && getComputedStyle(banner).display !== 'none') ? banner.clientHeight : 0;
    const w = card.clientWidth;
    const h = card.clientHeight - (header ? header.clientHeight : 0) - bannerH;
    sizeIframeFor(iframe, w, h);
  }
  function newIframeIn(card) {
    const body = card.querySelector('.falcon-worker-body');
    const old = body.querySelector('iframe');
    if (old) old.remove();
    const f = document.createElement('iframe');
    f.className = 'falcon-worker'; f.style.cssText = 'position:absolute;top:0;left:0;border:none;background:#fff;transform-origin:0 0;';
    body.appendChild(f);
    applyIframeScale(card);
    return f;
  }

  // #494: release cover art has no MB edit-relationships form to seed, so it
  // never goes through the iframe/form pipeline — ported from Art Station's
  // proven sign -> upload -> register cover-art API flow
  // (art_station.user.js): GET /ws/js/cover-art-upload/<mbid> reserves an
  // image_id/nonce + an archive.org presigned upload target, POST the file
  // bytes there, then POST the release's own add-cover-art form with that
  // id/nonce (scraped fresh for its CSRF/type_id fields, same as Art
  // Station's getPostForm/copyHidden/typeMapOf).
  //
  // #495: a release item can ALSO carry urls[] now (added through the normal
  // iframe/form path, same as any other type) — two unrelated MB edits on the
  // same entity. `priorLinks` ({status,error}) is passed when that path
  // already ran on this SAME item; omitted entirely for the cover-only case
  // (#494's original shape), so existing callers/tests are unaffected.
  // A registered image mime type from its URL extension — used when
  // blob.type doesn't look trustworthy (see below).
  function mimeFromUrl(url) {
    const ext = (String(url).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1];
    return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[(ext || '').toLowerCase()] || null;
  }
  // #496: uploads ONE cover[] entry (sign -> upload -> register). `position`
  // is this entry's 1-based slot within THIS run (entries submit as separate
  // add-cover-art POSTs — MB has no batch-upload endpoint — so each needs its
  // own position; existing gallery art isn't touched either way).
  async function uploadOneCover(item, entry, tag, position) {
    if (!entry.url) throw new Error('no cover image URL yet (still resolving, or none found on this release)');
    // majkinetor (#494 follow-up, live failure — "sign 400", "since we have
    // candidates, maybe we should go with the next one"): try the picked
    // candidate first, then fall through the rest (original scrape order)
    // on any fetch/sign failure, instead of failing the whole item outright
    // over one bad candidate.
    const order = [entry.url, ...((entry.candidates || []).map(c => c.url))]
      .filter((u, i, arr) => u && arr.indexOf(u) === i);
    let blob, mime, signed, lastErr = null;
    for (const url of order) {
      try {
        log('info', `${tag} release ${item.mbid} — fetching cover image${url === entry.url ? '' : ' (fallback candidate)'}`);
        blob = await gmFetch(url);
        // GM_xmlhttpRequest doesn't always populate blob.type reliably from
        // the response's real Content-Type (seen live: a 400 from the sign
        // endpoint, which rejects an unrecognized mime_type) — trust it
        // only when it actually looks like an image mime, else sniff from
        // the URL's own extension.
        mime = /^image\//.test(blob.type) ? blob.type : (mimeFromUrl(url) || 'image/jpeg');
        log('info', `${tag} release ${item.mbid} — signing upload (${mime})`);
        const signRes = await fetch(`${MB_ORIGIN}/ws/js/cover-art-upload/${item.mbid}?mime_type=${encodeURIComponent(mime)}`, { credentials: 'same-origin' });
        if (!signRes.ok) throw new Error('sign ' + signRes.status);
        signed = await signRes.json();   // {action, image_id, formdata, nonce}
        if (url !== entry.url) { entry.url = url; dbg(tag, `release ${item.mbid}: fell back to a working candidate (${url})`); }
        break;
      } catch (e) {
        lastErr = e;
        dbg(tag, `release ${item.mbid}: candidate ${url} failed — ${e.message || e}`);
      }
    }
    if (!signed) throw lastErr || new Error('no cover candidate could be fetched/signed');

    log('info', `${tag} release ${item.mbid} — uploading (${(blob.size / 1024).toFixed(0)} KB)`);
    const fd = new FormData();
    Object.entries(signed.formdata).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', blob, 'cover.' + (mime.split('/')[1] || 'jpg'));
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', signed.action);
      xhr.timeout = 300000;
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('upload ' + xhr.status));
      xhr.onerror = () => reject(new Error('upload network error'));
      xhr.ontimeout = () => reject(new Error('upload timed out'));
      xhr.send(fd);
    });

    log('info', `${tag} release ${item.mbid} — registering (${entry.type})`);
    const addUrl = `${MB_ORIGIN}/release/${item.mbid}/add-cover-art`;
    const formHtml = await fetch(addUrl, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error('GET add-cover-art ' + r.status); return r.text(); });
    const formDoc = new DOMParser().parseFromString(formHtml, 'text/html');
    const form = [...formDoc.querySelectorAll('form')].find(f => (f.getAttribute('method') || '').toUpperCase() === 'POST');
    if (!form) throw new Error('add-cover-art form not found');
    const p = new URLSearchParams();
    form.querySelectorAll('input[type=hidden]').forEach(h => { if (h.name && !/\.(id|position|nonce|mime_type|comment|type_id)$/.test(h.name)) p.append(h.name, h.value); });
    // #496: match the entry's own `type` (default 'Front') to MB's own
    // type_id checkbox by its visible label — was hardcoded to always find
    // "front" regardless of what the row asked for.
    let typeId = null;
    const wantType = (entry.type || 'Front').trim().toLowerCase();
    form.querySelectorAll('input[name="add-cover-art.type_id"]').forEach(cb => { const l = cb.closest('label'); if (l && (l.textContent || '').trim().toLowerCase() === wantType) typeId = cb.value; });
    if (!typeId) form.querySelectorAll('input[name="add-cover-art.type_id"]').forEach(cb => { const l = cb.closest('label'); if (!typeId && l && /front/i.test(l.textContent || '')) typeId = cb.value; });   // fall back to Front if the exact label wasn't found on MB's form
    p.append('add-cover-art.id', signed.image_id);
    p.append('add-cover-art.position', String(position));
    p.append('add-cover-art.nonce', signed.nonce);
    p.append('add-cover-art.mime_type', mime);
    if (typeId) p.append('add-cover-art.type_id', typeId);
    p.append('add-cover-art.comment', entry.comment || '');
    // Every other Falcon edit carries the "Falcon vX.Y.Z by majkinetor - <help
    // url>" signature (see editNoteText) — cover art gets it too (majkinetor,
    // #494 follow-up: "add falcon edit message as usual"), appended after
    // whatever note the item already carries (e.g. from Harmony) rather than
    // replacing it.
    p.append('add-cover-art.edit_note', [item.note, FALCON_SIGNATURE()].filter(Boolean).join('\n\n'));
    const addRes = await fetch(addUrl, { method: 'POST', body: p, credentials: 'same-origin' });
    if (!addRes.ok) throw new Error('add-cover-art submit ' + addRes.status);
    log('info', `${tag} release ${item.mbid} — cover art added (${entry.type})`);
  }
  async function runCoverItem(item, tag, card, priorLinks) {
    updateWorkerLabel(card, item);
    const tStart = Date.now();
    // #508 (majkinetor): "Add covers only when there aren't any" — an opt-in
    // safety toggle. checkExistingCoverArt() already resolves
    // item.coverExistingCount fire-and-forget right after the item is
    // queued (same assumption the duplicate-cover warning banner already
    // relies on) — by the time a worker gets here it's normally settled.
    // Skipped, not failed: the item still counts as handled, just untouched.
    const skipCover = cfg.coverOnlyIfNone && !!item.coverExistingCount;
    if (skipCover) log('info', `${tag} release ${item.mbid} — cover art skipped (already has ${item.coverExistingCount}, "add only when there aren't any" is on)`);
    // #496: cover[] can carry more than one entry — upload each independently;
    // one failing doesn't stop the rest. Overall coverOk only if ALL succeed.
    const errs = [];
    if (!skipCover) for (let i = 0; i < item.cover.length; i++) {
      try { await uploadOneCover(item, item.cover[i], tag, i + 1); }
      catch (e) {
        const msg = e.message || String(e);
        errs.push(item.cover.length > 1 ? `${item.cover[i].type || 'Front'}: ${msg}` : msg);
        log('error', `${tag} release ${item.mbid}: cover art (${item.cover[i].type || 'Front'}) — ${msg}`);
      }
    }
    const coverError = errs.join(' | ');
    const coverOk = !coverError;
    if (priorLinks) {
      const linksOk = priorLinks.status === 'done' || priorLinks.status === 'skipped';
      if (linksOk && coverOk) { item.status = priorLinks.status; item.error = ''; }
      else if (linksOk && !coverOk) { item.status = 'partial'; item.error = `cover art: ${coverError}`; }
      else if (!linksOk && coverOk) { item.status = priorLinks.status === 'failed' ? 'partial' : priorLinks.status; item.error = priorLinks.error ? `links: ${priorLinks.error}` : ''; }
      else { item.status = 'failed'; item.error = [priorLinks.error && `links: ${priorLinks.error}`, `cover art: ${coverError}`].filter(Boolean).join(' | '); }
      dbg(tag, `release ${item.mbid} — combined outcome: links=${priorLinks.status} cover=${coverOk ? 'ok' : 'failed'} -> ${item.status}`);
    } else if (skipCover) {
      item.status = 'skipped';
      item.error = '';
    } else {
      item.status = coverOk ? 'done' : 'failed';
      item.error = coverOk ? '' : coverError;
    }
    item.timing = { worker: tag, totalMs: Date.now() - tStart };
    updateWorkerLabel(card, null);
    scheduleRender('queue');
  }
  async function workerLoop(card) {
    const tag = `[w${workerCards.indexOf(card) + 1}]`;
    while (running) {
      const item = nextQueued();
      if (!item) { dbg(tag, 'nothing left queued — going idle'); break; }
      item.status = 'active'; scheduleRender('queue');
      // #494/#495: a release item with a cover but NO urls is cover-only —
      // skip the iframe/form pipeline entirely (nothing to seed a form with).
      // One WITH urls falls through to the normal pipeline below like any
      // other type, and picks up the cover step afterward at each exit (see
      // needsCover below) since the two are independent MB edits.
      if (item.entityType === 'release' && !item.urls.length) {
        await runCoverItem(item, tag, card);
        continue;
      }
      const needsCover = item.entityType === 'release' && item.cover.some(c => c.url);
      log('info', `${tag} ${item.entityType} ${item.mbid} — loading edit page (${item.urls.length} link(s))`);
      // ⚠ A GENUINELY FRESH IFRAME PER ITEM. Never re-navigate one that has
      // already been used.
      //
      // Reusing it was a speed fix of mine, and it is what has been killing
      // majkinetor's tab (#467). His logs isolate it precisely: an item that
      // FAILS retires its card and the next item gets a brand-new iframe —
      // fine, every time. An item that COMMITS keeps the same card, and the
      // next navigation of that already-used iframe takes the whole tab down,
      // panel and remaining queue with it. Reproduced across two builds, once
      // via contentWindow.location.replace() and again via plain .src, so it is
      // the reuse itself and not the navigation method.
      //
      // The measurement that justified reuse (2 items: 256s -> 4.9s) was taken
      // while the dual-type SEEDING bug was still present — back then every
      // later item was also doing post-render DOM poking on MB's React tree,
      // which is what actually cost the time. With seeding fixed, a fresh iframe
      // per item measures the same as reuse, so the optimisation buys nothing
      // and costs him runs.
      const iframe = newIframeIn(card);
      card.dataset.itemId = item.id;   // lets showItemPopup find "the worker that ran this item"
      updateWorkerLabel(card, item);
      // #467 (majkinetor): navigate straight to the seed url — MB pre-fills
      // every url as the page renders, so fillAndSubmit has little or nothing
      // left to type. Measured live: ~2-3s vs 10+s for typing simulation.
      const tNav = Date.now();
      // ⚠ NAVIGATE THE IFRAME BY ASSIGNING .src, AND BY NOTHING ELSE.
      //
      // This briefly used `frameWin(iframe).location.replace(seedUrl)` to keep
      // the frame's session history at depth 1. It cost majkinetor a run: his
      // tab went away one second into item 2 — the first navigation of a REUSED
      // iframe — taking the panel, the workers and the rest of the queue with it
      // (#467: "the Falcon popup closes abruptly in the middle of the process").
      //
      // It never reproduced here, because these tests inject into the page's own
      // realm while he runs inside a userscript manager's sandbox, where
      // `contentWindow` comes back as an Xray wrapper and `w.location` cannot be
      // relied on to still mean the FRAME's location. Assigning `.src` has no
      // such ambiguity: it is a property of the element, it can only ever
      // navigate that element, and it cannot reach the top window however the
      // script is wrapped.
      //
      // The history argument was speculative anyway — the measured freeze fix
      // was seeding both link types up front, and replace() was verified NOT to
      // fix the 6-item freeze on its own. Reusing the iframe DOES stay: that one
      // is measured (2 items, 256s -> 4.9s).
      const seedUrl = buildSeedEditUrl(item);
      iframe.src = seedUrl;
      // A FRESH iframe starts on about:blank, whose readyState is already
      // 'complete' — so a bare "readyState !== 'loading'" check passes
      // INSTANTLY, against the blank document, before MB's page has loaded at
      // all. Everything downstream then races a document that's about to be
      // replaced. Require the frame to actually be ON this entity's edit page
      // (and to have rendered the links section) before believing it's loaded.
      // #495 (majkinetor, live on test.musicbrainz.org: "worker goes too fast
      // over it... didn't add link"): a bare `input` fallback (meant to catch
      // "no links yet, but the add-link input is ready") is satisfied by ANY
      // input on the page — fine on artist/recording's small single-purpose
      // form, but a release edit page has many unrelated inputs (title,
      // barcode, tracklist...) that render well before the External Links
      // section itself mounts, so this used to pass instantly and let the
      // worker start filling before there was anything to fill. Matching
      // findAddLinkInput's specific placeholder text instead of a bare
      // `input` fixes it for every type, not just release.
      const loaded = await waitFor(() => {
        const w = frameWin(iframe), doc = frameDoc(iframe);
        if (!w || !doc || doc.readyState === 'loading') return null;
        let path = ''; try { path = w.location.pathname; } catch (e) { return null; }
        if (!path.includes(item.mbid)) return null;   // still about:blank / previous doc
        return (doc.querySelector('tr.external-link-item') || findAddLinkInput(doc)) ? true : null;
      }, 15000);
      if (!loaded) {
        item.status = 'failed'; item.error = 'edit page never loaded';
        log('error', `${tag} ${item.mbid}: edit page never loaded (waited 15s)`);
        // #495: the cover upload is a plain API call, independent of this
        // iframe — still worth attempting even though the link form never
        // loaded.
        if (needsCover) await runCoverItem(item, tag, card, { status: item.status, error: item.error });
        retireCard(card, item.error); scheduleRender('queue');
        const replacement = spawnWorkerCard();
        if (replacement) workerLoop(replacement);
        return;
      }
      const loadMs = Date.now() - tNav;
      dbg(tag, `edit page loaded in ${loadMs}ms`);
      // MB's client JS turns the seed params into rows a moment after load.
      // A seeded url can land in EITHER shape (see findRowsForUrl): a resolved
      // <a href> row, or — when MB couldn't classify it — an editable input
      // row holding the url text. Matching only the href shape here meant every
      // unclassifiable url burned the full 8s timeout for nothing.
      const settled = await waitFor(() => {
        const doc = frameDoc(iframe); if (!doc) return null;
        const uniqueUrls = [...new Set(item.urls.map(u => u.url))];
        return uniqueUrls.every(u => !!findRowForUrl(doc, u)) ? true : null;
      }, 8000);
      const settleMs = Date.now() - tNav - loadMs;
      // snapshot the entity's links BEFORE we touch anything — the submit gate
      // compares against this to prove nothing pre-existing was lost (#467).
      const baseline = snapshotExistingUrls(frameDoc(iframe));
      dbg(tag, `seeded rows settled=${!!settled} after ${Date.now() - tNav}ms total`);
      let r = null;
      try {
        r = await fillAndSubmit(iframe, item, { tag, baseline });
        item.urlResults = r.results;
        // per-stage timings, kept on the item so the end-of-run summary table
        // can show where the time actually went (majkinetor, #467).
        item.timing = { worker: tag, loadMs, settleMs, fillMs: r.fillMs || 0, submitMs: r.submitMs || 0, totalMs: Date.now() - tNav };
        const failedUrls = r.results.filter(x => !x.ok);
        if (r.noop) {
          // everything was already there — the desired state holds, so this is
          // a success with nothing to do, NOT a failure.
          item.status = 'skipped';
          item.error = '';
          log('info', `${tag} ${entityLabel(item)} — already up to date, nothing to submit (${r.results.length} link(s) already present)`);
        } else if (!r.committed) {
          item.status = 'failed';
          item.error = failedUrls.map(x => `${x.url}: ${x.error}`).join('; ');
          log('error', `${tag} ${item.mbid}: nothing added — ${item.error}`);
        } else if (failedUrls.length) {
          item.status = 'partial';
          item.error = failedUrls.map(x => `${x.url}: ${x.error}`).join('; ');
          log('warn', `${tag} ${item.entityType} ${item.mbid} — committed ${r.results.length - failedUrls.length}/${r.results.length} link(s)`);
        } else {
          item.status = 'done';
          log('info', `${tag} ${item.entityType} ${item.mbid} — committed ${r.results.length} link(s)`);
        }
      } catch (e) {
        item.status = 'failed'; item.error = e.message || String(e);
        item.timing = { worker: tag, loadMs, settleMs, fillMs: 0, submitMs: 0, totalMs: Date.now() - tNav };
        log('error', `${tag} ${item.mbid}: ${item.error}`);
      }
      // #495: the cover upload is independent of how the link submission went
      // (or whether it ran at all) — run it and fold its outcome into
      // item.status/error before deciding whether this card can keep going.
      if (needsCover) await runCoverItem(item, tag, card, { status: item.status, error: item.error });
      renderQueue();
      if (r && (r.committed || r.noop)) {
        // a real submit happened — or there was genuinely nothing to submit, in
        // which case the form was never dirtied either. Both leave this card
        // safe to keep going (a fresh iframe loads the NEXT item next
        // iteration, see above) rather than retiring, so you can watch one
        // worker flow through a whole run instead of every item spawning a card.
        updateWorkerLabel(card, null);
        continue;
      }
      // anything else: this card's form may still be dirty — retire it in place
      // (stays visible with its last state, per majkinetor) and hand off to a fresh
      // replacement card rather than risk the beforeunload freeze.
      retireCard(card, item.error);
      const next = spawnWorkerCard();
      if (next) workerLoop(next);
      return;
    }
    updateWorkerLabel(card, null);   // triggers its own re-render since this flips the card to idle (see above)
    // last worker out turns the jank heartbeat off — no point measuring thread
    // blocking once nothing of ours is running.
    // Last worker out. `running` used to stay true forever here, so once a run
    // drained: the button still read "■ Stop", and clicking Start again did
    // nothing at all (start() bails on `if (running) return`) — the only way to
    // run a second batch was to reload the page. Clear the flag so the panel
    // returns to a usable idle state instead of looking wedged.
    if (!queue.some(i => i.status === 'active')) {
      stopHeartbeat();
      logRunSummary();
      // #497: a queued item whose type is toggled off will never be picked up
      // (see nextQueued) — don't count it as "still to do," or a run whose
      // only leftovers are excluded types would sit forever looking active
      // with every worker actually idle.
      if (!queue.some(i => i.status === 'queued' && !_disabledTypes.has(i.entityType))) {
        running = false;
        resumeNameLookups();   // the rate-limit budget is ours again
        resolveMissingNames();   // give any cancelled-mid-run lookups a second try
        updateRunBtn();
        log('info', '=== run finished — the tab and panel stay open; the log above is this session only ===');
        writeLogNow();
      }
    }
  }

  // #467 (majkinetor): each worker gets its own card — a small label (which entity
  // it's on right now) plus a ⛶ toggle to view just that one large, so a failure can
  // actually be read instead of squinting at a 220x160 thumbnail. Zooming one worker
  // hides the others rather than trying to fit everything in a responsive grid.
  // Cards accumulate as a visible history (retired ones dim + freeze in place, see
  // above) rather than being torn down — only ever appended, never removed/reused
  // across a Start click, so old state stays inspectable until the panel closes.
  let workerCards = [];
  let _zoomedWorker = null;   // index into workerCards, or null
  function updateWorkerLabel(card, item) {
    if (card.dataset.retired) return;   // don't overwrite a retired card's frozen label
    const lbl = card.querySelector('.falcon-worker-lbl');
    if (lbl) lbl.textContent = item ? `${entityLabel(item)} — ${item.entityType === 'release' ? 'cover art' : item.urls.length + ' link(s)'}` : 'idle';
    // a freshly-spawned card starts hidden (marked idle at creation, #467's
    // hide-idle-workers), so it must re-render the moment it actually GETS an
    // item too, not just when it goes idle again — re-rendering only on the
    // rare transition (not every label update) keeps this cheap.
    const wasIdle = card.dataset.idle === '1';
    const isIdleNow = !item;
    card.dataset.idle = isIdleNow ? '1' : '';
    if (wasIdle !== isIdleNow) renderWorkerLayout();
  }
  function renderWorkerLayout() {
    let anyVisible = false;
    workerCards.forEach((card, i) => {
      const zoomBtn = card.querySelector('.falcon-worker-zoom');
      // #467 (majkinetor): "hide idle workers on Workers tab" — an idle card
      // (nothing currently loaded, or the whole run finished) has nothing worth
      // looking at in the default thumbnail strip; only applies there — a
      // specifically zoomed card stays visible even if it happens to go idle.
      const isIdle = card.dataset.idle === '1';
      // Hiding a card that's mid-item is the same trap as hiding the whole pane
      // (see setTab): display:none stops its iframe rendering and its submit
      // never lands. An idle card is safe to drop out of the DOM flow; a busy
      // one gets parked off-screen instead so it keeps working while out of view.
      const hide = () => {
        if (isIdle) { card.style.display = 'none'; return; }
        card.style.cssText = card.style.cssText.replace(/position:absolute;left:-100000px;top:0;/, '');
        card.style.position = 'absolute'; card.style.left = '-100000px'; card.style.top = '0';
        card.style.display = '';
      };
      const show = (w, h) => {
        card.style.position = ''; card.style.left = ''; card.style.top = '';
        card.style.display = ''; card.style.width = w; card.style.height = h;
      };
      if (_zoomedWorker === null) {
        if (isIdle) { card.style.display = 'none'; return; }
        show(cfg.workerSize + 'px', Math.round(cfg.workerSize * 0.8) + 'px');
        if (zoomBtn) { zoomBtn.textContent = '⛶'; zoomBtn.title = 'Maximize this worker'; }
      } else if (_zoomedWorker === i) {
        show('100%', '560px');
        if (zoomBtn) { zoomBtn.textContent = '❐'; zoomBtn.title = 'Restore'; }
      } else {
        hide();
      }
      // a retired card normally dims to signal "done, nothing to act on" — but
      // zooming it in specifically to inspect its failure (from the queue tab's
      // status-label click, #467) should show it at full readable opacity.
      card.style.opacity = (card.dataset.retired === '1' && _zoomedWorker !== i) ? '.55' : '1';
      // only count as "visible" (for the empty-state message) when it's actually
      // on screen — an off-screen parked card is live but not something you see.
      const onScreen = card.style.display !== 'none' && card.style.position !== 'absolute';
      if (card.style.display !== 'none') applyIframeScale(card);   // card size just changed — rescale its iframe to match
      if (onScreen) anyVisible = true;
    });
    const emptyMsg = document.getElementById('falcon-workers-empty');
    if (emptyMsg) emptyMsg.style.display = anyVisible ? 'none' : 'block';
  }
  // #467 (majkinetor: "UI was frozen after some time... Notice the 30s silence
  // in log at the end"). That silence is itself the evidence: waitFor checks
  // its predicate BEFORE its deadline, so a 25s timeout that returned at 37s
  // means the main thread simply wasn't running our timers for most of that
  // stretch — i.e. a genuine freeze, not a slow server. Whether it's MB's own
  // page JS in the worker iframes or something Falcon does is the open
  // question, so measure it: a heartbeat that reports how long the thread was
  // actually blocked, right in the same log as everything else.
  let _heartbeat = null;
  function startHeartbeat() {
    if (_heartbeat) return;
    let last = Date.now();
    _heartbeat = setInterval(() => {
      const now = Date.now(), late = now - last - 500;
      last = now;
      if (late > 1500) log('warn', `UI thread was blocked for ~${(late / 1000).toFixed(1)}s (nothing could render or respond during that time)`);
    }, 500);
  }
  function stopHeartbeat() { if (_heartbeat) { clearInterval(_heartbeat); _heartbeat = null; } }

  // #467 (majkinetor): "add to falcon log table with timing data as a summary".
  // Printed once when the last worker goes idle. The point is to make WHERE the
  // time goes obvious at a glance — the run that prompted this had ~30s submits
  // purely because five workers were submitting at once (MB serialises edit
  // submissions per user), which is invisible in a stream of interleaved lines
  // but jumps out of a sorted table. Columns are the real stages: load = MB's
  // edit page arriving, settle = MB turning seed params into rows, fill = our
  // own DOM work, submit = click → redirect.
  let _summaryPending = false, _runStartedAt = 0;
  function logRunSummary() {
    const rows = queue.filter(i => i.timing);
    if (!rows.length || _summaryPending) return;
    _summaryPending = true;
    // let any last status writes land before snapshotting
    setTimeout(() => {
      _summaryPending = false;
      const pad = (v, n, right) => { const s = String(v); return right ? s.padStart(n) : s.padEnd(n); };
      const ms = v => (v == null ? '-' : String(Math.round(v)));
      const nameW = Math.min(28, Math.max(6, ...rows.map(i => entityLabel(i).length)));
      const head = `${pad('w', 4)} ${pad('entity', nameW)} ${pad('status', 8)} ${pad('load', 7, 1)} ${pad('settle', 7, 1)} ${pad('fill', 7, 1)} ${pad('submit', 8, 1)} ${pad('total', 8, 1)}`;
      const lines = [head, '-'.repeat(head.length)];
      // #512 follow-up (majkinetor, live: "add on each worker what was done
      // in this log table like I shown on w1 and w2") — same categories the
      // collapsed queue row and the aggregate "worked on" line already use,
      // per item this time so a failed batch shows what each one actually had.
      const rowBreakdown = i => [
        i.urls && i.urls.length ? `${i.urls.length} link${i.urls.length === 1 ? '' : 's'}` : '',
        i.disambiguation ? 'disambiguation' : '',
        (i.isrcs || []).length ? 'isrc' : '',
        i.cover && i.cover.some(c => c.url) ? 'cover' : '',
      ].filter(Boolean).join(', ');
      rows.forEach(i => {
        const t = i.timing;
        const what = rowBreakdown(i);
        lines.push(`${pad(t.worker || '', 4)} ${pad(entityLabel(i).slice(0, nameW), nameW)} ${pad(i.status, 8)} ${pad(ms(t.loadMs), 7, 1)} ${pad(ms(t.settleMs), 7, 1)} ${pad(ms(t.fillMs), 7, 1)} ${pad(ms(t.submitMs), 8, 1)} ${pad(ms(t.totalMs), 8, 1)}` + (what ? `  ; ${what}` : ''));
      });
      const sum = k => rows.reduce((a, i) => a + (i.timing[k] || 0), 0);
      const avg = k => Math.round(sum(k) / rows.length);
      const maxSubmit = Math.max(...rows.map(i => i.timing.submitMs || 0));
      lines.push('-'.repeat(head.length));
      lines.push(`${pad('', 4)} ${pad(`${rows.length} item(s)`, nameW)} ${pad('avg', 8)} ${pad(avg('loadMs'), 7, 1)} ${pad(avg('settleMs'), 7, 1)} ${pad(avg('fillMs'), 7, 1)} ${pad(avg('submitMs'), 8, 1)} ${pad(avg('totalMs'), 8, 1)}`);
      const byStatus = rows.reduce((m, i) => { m[i.status] = (m[i.status] || 0) + 1; return m; }, {});
      // wall clock is NOT the sum of the item totals — workers overlap — so show
      // both: the sum is how much work happened, the wall clock is how long you
      // actually waited, and the gap between them is what concurrency bought.
      const wallMs = _runStartedAt ? Date.now() - _runStartedAt : 0;
      const fmt = m => (m >= 1000 ? (m / 1000).toFixed(1) + 's' : m + 'ms');
      // #512 (majkinetor): "in work summary at the end of the log, add what
      // was done the same as shown in collapsed queue (e.g. 2 link, isrc)" —
      // same categories the row itself shows (links / ISRC / disambiguation
      // / cover), aggregated across the whole run instead of per row.
      const totalLinks = rows.reduce((n, i) => n + (i.urls ? i.urls.length : 0), 0);
      const withIsrc = rows.filter(i => (i.isrcs || []).length).length;
      const withDisambiguation = rows.filter(i => i.disambiguation).length;
      const withCover = rows.filter(i => i.cover && i.cover.some(c => c.url)).length;
      const worked = [
        totalLinks ? `${totalLinks} link${totalLinks === 1 ? '' : 's'}` : '',
        withIsrc ? `isrc on ${withIsrc}` : '',
        withDisambiguation ? `disambiguation on ${withDisambiguation}` : '',
        withCover ? `cover on ${withCover}` : '',
      ].filter(Boolean).join(', ') || '—';
      log('info', `run summary (all times ms)\n${lines.join('\n')}\n` +
        `total run time: ${fmt(wallMs)} wall clock` +
        (rows.length > 1 ? ` · ${fmt(sum('totalMs'))} of item work · avg ${fmt(Math.round(wallMs / rows.length))} per item` : '') + '\n' +
        `totals: ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')}; slowest submit ${maxSubmit}ms; ${cfg.workers} worker(s)\n` +
        `worked on: ${worked}` +
        (maxSubmit > 10000 ? `\nnote: submits this slow usually mean several workers submitted at once — MusicBrainz serialises edit submissions per user, so they queue behind each other. Fewer workers is often no slower overall.` : ''));
    }, 300);
  }
  // #476: with no authenticated session, every worker's /edit navigation gets
  // redirected to MB's login page — which, unlike the edit page itself, DOES
  // refuse to be framed, so the iframe shows browser chrome ("Firefox Can't
  // Open This Page") and each item just times out 15s later as "edit page
  // never loaded". That's true of every item in the queue at once, so check
  // once, up front, instead of letting the whole batch burn through it.
  // The panel's own tab is a normal top-level MB page (never framed), so this
  // reads the SAME login link MB's header always shows when logged out —
  // confirmed absent once logged in.
  function isLoggedIn() { return !document.querySelector('a[href^="/login?"], a[href="/login"]'); }
  function start() {
    if (running) return;
    if (!isLoggedIn()) {
      alert(`${NAME}: you're not logged into MusicBrainz on this tab. Log in, then reload this page and Start again — an unauthenticated run can't submit any edits.`);
      log('warn', 'refused to start — not logged into MusicBrainz');
      return;
    }
    if (!queue.some(i => i.status === 'queued')) { log('warn', 'nothing queued'); return; }
    // #497: everything queued is a toggled-off type — nothing would actually run.
    if (!queue.some(i => i.status === 'queued' && !_disabledTypes.has(i.entityType))) { log('warn', 'nothing queued that isn\'t excluded by a toggled-off type chip'); return; }
    running = true;
    _runStartedAt = Date.now();
    // one log per run — majkinetor: "I DON'T WANT LOGS FROM OTHER RUNS"
    newSession(`${queue.filter(i => i.status === 'queued').length} queued, ${cfg.workers} worker(s), ${location.href}`);
    suspendNameLookups();   // cosmetic lookups must not eat the workers' rate-limit budget
    startHeartbeat();
    const need = Math.min(cfg.workers, queue.filter(i => i.status === 'queued').length);
    log('info', `starting ${need} worker(s) for ${queue.filter(i => i.status === 'queued').length} queued item(s)`);
    for (let i = 0; i < need; i++) { const card = spawnWorkerCard(); if (card) workerLoop(card); }
    updateRunBtn();
  }
  function stop() { running = false; stopHeartbeat(); resumeNameLookups(); resolveMissingNames(); log('info', 'stopping — in-flight items finish, no new ones start'); updateRunBtn(); }

  /* ════════════════════════ UI ════════════════════════ */
  let launcher = null;
  // #508 (majkinetor): "Hide MB icon" — the floating corner launcher is
  // optional; the panel is still reachable via Ctrl+Alt+F either way (that
  // shortcut listener is independent of this button existing at all).
  function removeLauncher() { if (launcher) { launcher.remove(); launcher = null; } }
  function ensureLauncher() {
    if (cfg.hideLauncher) { removeLauncher(); return; }
    if (launcher) return;
    launcher = document.createElement('button');
    launcher.type = 'button'; launcher.id = 'falcon-launcher';
    launcher.title = `${NAME} — bulk link editor (Ctrl+Alt+F)`;
    launcher.dataset.mbCorner = 'br'; launcher.dataset.mbCornerOrder = '20';
    launcher.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.55);color:#1b2a4a;box-shadow:0 2px 8px rgba(0,0,0,.18);transition:background .15s,transform .1s;opacity:.55';
    launcher.innerHTML = ICON;
    launcher.onmouseenter = () => { launcher.style.transform = 'scale(1.08)'; launcher.style.opacity = '1'; };
    launcher.onmouseleave = () => { launcher.style.transform = 'scale(1)'; launcher.style.opacity = '.55'; };
    launcher.onclick = () => togglePanel();
    document.body.appendChild(launcher);
    mbRestackCorner('br');
  }

  let panel = null, tab = 'queue';
  // Standing rule across every script here (Art Station is the reference): a
  // toolbar's labelled buttons collapse to icon-only rather than wrapping, with
  // the tooltips carrying the meaning. Falcon needs it more than most — the
  // panel is a 460px box the user can drag-resize and maximize, so its three
  // bars go from roomy to cramped constantly.
  //
  // Widths are summed rather than read off scrollWidth: these bars use flex:1
  // spacers (the progress bar, `margin-left:auto`), which absorb the overflow
  // and make scrollWidth/offsetTop-based detection report a comfortable fit
  // right up until it wraps.
  function fitBar(bar) {
    if (!bar) return;
    bar.classList.remove('falcon-compact');            // measure with full labels
    const kids = [...bar.children];
    const gap = parseFloat(getComputedStyle(bar).gap) || 8;
    let need = gap * Math.max(0, kids.length - 1);
    kids.forEach(el => { if (!el.id || el.id !== 'falcon-progress-wrap') need += el.offsetWidth; });
    bar.classList.toggle('falcon-compact', need > bar.clientWidth - 20);   // minus h-padding
  }
  function fitBars() {
    if (!panel) return;
    panel.querySelectorAll('.falcon-bar').forEach(fitBar);
  }

  function ensurePanel() {
    if (panel) return;
    const style = document.createElement('style');
    style.textContent = [
      '.falcon-bar.falcon-compact .falcon-bt{display:none}',
      '.falcon-bar button{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
      // Borderless (majkinetor: "its too intrusive"). A row of boxed native
      // buttons competes with the queue list, which is the actual content. The
      // affordance moves to hover, so a button still reads as a button when you
      // go for it without drawing a frame around itself the rest of the time.
      // #falcon-run keeps its solid fill — it sets background inline, which wins
      // over this, and the primary action should stay the loud one.
      // min-height matters: the native border was quietly providing 4px of the
      // hit area, so dropping it shrank these to 16px tall. Targets stay
      // generous whether or not there's a box drawn around them (#419).
      '.falcon-bar button{background:none;border:none;border-radius:4px;color:inherit;padding:3px 8px;min-height:22px}',
      '.falcon-bar button:hover:not(:disabled){background:rgba(0,0,0,.08)}',
      '.falcon-bar button:active:not(:disabled){background:rgba(0,0,0,.14)}',
      // disabled used to read as a greyed box; with no box it has to fade instead
      '.falcon-bar button:disabled{opacity:.4;cursor:default}',
      '.falcon-bar .falcon-bi{display:inline-flex;line-height:1}',
      // with the label gone the button would shrink to a sliver of glyph, so
      // give the icon-only state a real hit area (no tiny targets — #419).
      '.falcon-bar.falcon-compact button{min-width:26px;justify-content:center}',
    ].join('\n');
    document.head.appendChild(style);
    panel = document.createElement('div'); panel.id = 'falcon-panel';
    // #495 (majkinetor, live: "if I first maximize the page, it doesn't go
    // empty... in unmaximized state it is simply moved off window" —
    // reproduced: the panel's own box was rendering as short as ~170px,
    // squeezing every row onto one sliver instead of showing normally).
    // Root cause: `max-height` alone doesn't give a `display:flex` column an
    // actual height to distribute — without a real `height`, #falcon-queue-list's
    // `flex:1` has no space to grow into and the whole panel just shrinks to
    // its non-flexible children's content size, which collapses hard on a
    // smaller viewport/queue. A real `height` alongside the existing
    // `max-height` cap fixes it (viewport-capped either way, just no longer
    // degenerate on the way there).
    // #508 (majkinetor): "make window resizable" — native CSS resize (a drag
    // grip in the bottom-right corner); needs overflow != visible, which the
    // panel already has. min-width/min-height keep it from collapsing into
    // the flex column laid out below.
    // #513 (majkinetor): "Make window wider if needed to fit the chips" — the
    // header can now carry up to 3 status chips (failed/partial/manual)
    // alongside the name and tab buttons; even 520px still clipped the 3rd
    // chip against the tab buttons (measured live).
    panel.style.cssText = 'display:none;flex-direction:column;position:fixed;z-index:2147483647;left:50%;top:50%;transform:translate(-50%,-50%);width:600px;max-width:90vw;height:70vh;max-height:70vh;min-width:340px;min-height:320px;resize:both;background:#fff;color:#222;border-radius:8px;font:12px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28);border:1px solid #ddd;overflow:hidden';
    panel.innerHTML = `
      <div id="falcon-hdr" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b2a4a;color:#fff;cursor:move;user-select:none">
        <span style="display:flex;color:#ff9d5c">${ICON}</span>
        <span style="flex:0 0 auto;font-weight:700">${NAME}</span>
        <div id="falcon-status-chips" style="display:flex;gap:5px;flex:1;overflow-x:auto;overflow-y:hidden;min-width:0"></div>
        <button type="button" id="falcon-tab-queue" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Queue</button>
        <button type="button" id="falcon-tab-workers" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Workers</button>
        <button type="button" id="falcon-tab-log" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Log</button>
        <button type="button" id="falcon-tab-options" title="Options" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit;font-size:14px">⚙</button>
        <button type="button" id="falcon-maximize" title="Maximize" style="background:none;border:none;color:#fff;cursor:pointer;font:inherit;font-size:14px">⛶</button>
        <button type="button" id="falcon-close" style="background:none;border:none;color:#fff;cursor:pointer;font:inherit;font-size:14px">✕</button>
      </div>
      <div id="falcon-body-queue" style="padding:0;overflow:hidden;flex:1;display:flex;flex-direction:column">
        <div id="falcon-queue-toolbar" class="falcon-bar" style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#666;flex:0 0 auto">
          <input type="checkbox" id="falcon-select-all" title="Select all" style="flex:0 0 auto" />
          <button type="button" id="falcon-expand-all" style="padding:2px 8px;cursor:pointer" title="Expand every row's url detail"><span class="falcon-bi">▾</span><span class="falcon-bt">Expand all</span></button>
          <button type="button" id="falcon-import" title="Load a queue from a JSON file" style="padding:2px 8px;cursor:pointer"><span class="falcon-bi">↓</span><span class="falcon-bt">Import</span></button>
          <button type="button" id="falcon-export" title="Save the queue — and each item's outcome — to a JSON file" style="padding:2px 8px;cursor:pointer"><span class="falcon-bi">↑</span><span class="falcon-bt">Export</span></button>
          <input type="file" id="falcon-import-file" accept="application/json,.json" style="display:none" />
          <span id="falcon-select-count"></span>
          <button type="button" id="falcon-remove-selected" disabled title="Remove the selected rows from the queue" style="margin-left:auto;padding:2px 8px;cursor:pointer"><span class="falcon-bi">🗑</span><span class="falcon-bt">Remove selected</span></button>
        </div>
        <div id="falcon-type-chips" style="display:none;gap:6px;flex-wrap:wrap;padding:6px 10px;border-bottom:1px solid #eee"></div>
        <div id="falcon-queue-list" style="overflow:auto;flex:1;padding:0 10px"></div>
        <div id="falcon-queue-bottom" class="falcon-bar" style="display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid #eee;flex:0 0 auto">
          <div id="falcon-progress-wrap" style="flex:1;display:flex;align-items:center;gap:6px;min-width:0">
            <div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;min-width:40px">
              <div id="falcon-progress-bar" style="height:100%;width:0%;background:#2e9e5b;transition:width .2s"></div>
            </div>
            <span id="falcon-progress-text" style="color:#666;font-size:10px;white-space:nowrap;flex:0 0 auto"></span>
          </div>
          <button type="button" id="falcon-run" title="Start processing the queue" style="flex:0 0 auto;padding:4px 12px;font-weight:700;cursor:pointer;background:#1b2a4a;color:#fff;border:none;border-radius:4px"><span class="falcon-bi">▶</span><span class="falcon-bt">Start</span></button>
        </div>
        <div id="falcon-cover-warning" style="display:none;padding:5px 10px;background:#fdf3e3;color:#8a5a00;font-size:10.5px;border-top:1px solid #f0e0bb;flex:0 0 auto"></div>
      </div>
      <div id="falcon-body-workers" style="position:absolute;left:-100000px;top:0;width:1200px;height:800px;overflow:auto;display:block;padding:8px 10px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#888">
          <span style="flex:1">Live worker iframes — each one loads an entity's edit page, fills it, submits, then moves to the next queued item.</span>
          <label style="display:flex;align-items:center;gap:5px;flex:0 0 auto" title="How large each worker card is drawn — bigger cards make it easier to read what a worker is actually showing">
            <span>size</span>
            <input type="range" id="falcon-worker-size" min="200" max="900" step="20" style="width:110px" />
            <span id="falcon-worker-size-val" style="width:34px;text-align:right"></span>
          </label>
        </div>
        <div id="falcon-workers" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        <div id="falcon-workers-empty" style="display:none;color:#999;padding:8px 0">No active workers right now — idle ones are hidden here. Click ▶ Start to begin.</div>
      </div>
      <div id="falcon-body-log" style="display:none;padding:0;overflow:hidden;flex:1;flex-direction:column">
        <div class="falcon-bar" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#666;flex:0 0 auto">
          <button type="button" id="falcon-log-copy" title="Copy the log as Markdown, ready to paste into an issue" style="padding:2px 8px;cursor:pointer"><span class="falcon-bi">⧉</span><span class="falcon-bt">Copy log</span></button>
          <button type="button" id="falcon-log-clear" title="Clear the log" style="padding:2px 8px;cursor:pointer"><span class="falcon-bi">🧹</span><span class="falcon-bt">Clear</span></button>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer" title="Detailed per-worker step tracing — leave on when reporting a problem">
            <input type="checkbox" id="falcon-log-debug" /> <span class="falcon-bt">debug</span>
          </label>
          <select id="falcon-log-history" title="Load an earlier run's log — each run gets its own, kept for a while" style="margin-left:auto;max-width:180px;font:inherit">
            <option value="">Current session</option>
          </select>
          <span id="falcon-log-copied" style="color:#2e9e5b"></span>
        </div>
        <div id="falcon-log-text" style="overflow:auto;flex:1;padding:8px 10px;font:10px monospace;white-space:pre-wrap"></div>
      </div>
      <div id="falcon-body-options" style="display:none;overflow:auto;flex:1;padding:10px;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:baseline;gap:8px;padding-bottom:8px;border-bottom:1px solid #eee">
          <span style="flex:1;font-weight:700;color:#1b2a4a">${NAME} <span style="opacity:.6;font-weight:400">v${scriptVersion()}</span></span>
          <a href="${HELP_URL}" target="_blank" rel="noopener" style="color:#1b6ec2;text-decoration:none;font-weight:600">? Help</a>
        </div>
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer" title="The floating corner icon is optional — the panel is always reachable via Ctrl+Alt+F either way">
          <input type="checkbox" id="falcon-opt-hide-launcher" /> <span>Hide ${NAME} icon</span>
        </label>
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer" title="If a release already has cover art, skip adding another instead of uploading blind — Harmony offers cover art whether or not the release already has some">
          <input type="checkbox" id="falcon-opt-cover-only-if-none" /> <span>Add covers only when there aren't any</span>
        </label>
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer" title="Start processing the queue immediately after 'Send to Falcon' from Harmony, instead of waiting for you to click Start">
          <input type="checkbox" id="falcon-opt-auto-start-harmony" /> <span>Auto start Harmony import</span>
        </label>
        <label style="display:flex;align-items:center;gap:7px" title="How many entities are processed at once — each worker is its own iframe submitting independently">
          <span>Workers</span> <input type="number" id="falcon-worker-count" min="1" max="6" style="width:40px" />
        </label>
        <label style="display:flex;align-items:center;gap:7px" title="Each run keeps its own log, selectable later from the Log tab's history dropdown — older ones beyond this count are dropped">
          <span>Keep last</span> <input type="number" id="falcon-opt-log-history-count" min="1" max="100" style="width:48px" /> <span>run logs</span>
        </label>
      </div>`;
    document.body.appendChild(panel);
    // the panel is drag-resizable as well as maximizable, so the bars have to
    // re-fit continuously, not just on the events we happen to hook.
    try { new ResizeObserver(() => fitBars()).observe(panel); } catch (e) {}
    document.getElementById('falcon-close').onclick = () => { panel.style.display = 'none'; };
    document.getElementById('falcon-maximize').onclick = toggleMaximize;
    const wIn = document.getElementById('falcon-worker-count'); wIn.value = cfg.workers;
    wIn.onchange = () => { cfg.workers = wIn.value; wIn.value = cfg.workers; };
    // ── JSON import / export ────────────────────────────────────────────────
    // (majkinetor: "lets remove + and add json import/export instead")
    //
    // The paste box this replaces only understood Falcon's own `mbid,url` line
    // format, which nothing else produces. A queue is far more useful as a file:
    // it outlives the tab, it can be prepared elsewhere, and — because the
    // export carries each item's STATUS and per-url outcome — a partly-finished
    // run can be handed to someone else, kept as a record, or re-imported to
    // retry just the parts that failed.
    //
    // parsePaste stays: the `?falcon=` url and the Harmony button still use it.
    document.getElementById('falcon-export').onclick = () => {
      if (!queue.length) { log('warn', 'nothing to export — the queue is empty'); return; }
      const payload = {
        falcon: scriptVersion(),
        exported: new Date().toISOString(),
        items: queue.map(i => {
          const item = {
            entityType: i.entityType, mbid: i.mbid, name: i.name || null, note: i.note || '',
            urls: i.urls.map(u => ({ url: u.url, linkTypeId: u.linkTypeId || null })),
            status: i.status, error: i.error || '', urlResults: i.urlResults || null,
          };
          // #496: disambiguation (recording) and cover[] (release) are
          // type-specific — only including them where the type actually uses
          // them, same reasoning as isrcs[] just below.
          if (i.entityType === 'recording') { item.disambiguation = i.disambiguation || ''; item.isrcs = i.isrcs || []; }
          // #494/#496: cover art is a release item's whole payload — an
          // array of {url, comment, type, candidates}, one entry per image.
          if (i.entityType === 'release') item.cover = (i.cover || []).map(c => ({ url: c.url || '', comment: c.comment || '', type: c.type || 'Front', candidates: c.candidates || [] }));
          return item;
        }),
      };
      const name = `falcon-queue-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 10000);
      log('info', `exported ${queue.length} item(s) to ${name}`);
    };
    document.getElementById('falcon-import').onclick = () => document.getElementById('falcon-import-file').click();
    document.getElementById('falcon-import-file').onchange = function () {
      const file = this.files && this.files[0];
      this.value = '';                    // so re-picking the same file still fires
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importQueueJson(String(reader.result || ''), file.name);
      reader.onerror = () => log('error', `could not read ${file.name}`);
      reader.readAsText(file);
    };
    // #467 (majkinetor): "Do not switch to worker tab on start" — the queue list
    // (with its progress bar) is the more useful view during a run; the Workers
    // tab is for when you actually want to look inside one.
    document.getElementById('falcon-run').onclick = () => { if (running) stop(); else start(); };
    document.getElementById('falcon-select-all').onchange = function () {
      const selectable = queue.filter(i => i.status !== 'active');
      if (this.checked) selectable.forEach(i => _selectedIds.add(i.id));
      else selectable.forEach(i => _selectedIds.delete(i.id));
      renderQueue();
    };
    document.getElementById('falcon-remove-selected').onclick = () => {
      const removable = [..._selectedIds].filter(id => { const it = queue.find(q => q.id === id); return it && it.status !== 'active'; });
      if (!removable.length) return;
      queue = queue.filter(i => !removable.includes(i.id));
      removable.forEach(id => _selectedIds.delete(id));
      log('info', `removed ${removable.length} item(s) from the queue`);
      renderQueue();
    };
    // #467 (majkinetor): toggles between expanding every row's url detail at
    // once and collapsing them all — its own label reflects which action is
    // next, kept in sync from renderQueue() since expanding/collapsing an
    // individual row can also change whether "all" are currently expanded.
    document.getElementById('falcon-expand-all').onclick = () => {
      const allExpanded = queue.length > 0 && queue.every(i => _expandedIds.has(i.id));
      if (allExpanded) _expandedIds.clear();
      else queue.forEach(i => _expandedIds.add(i.id));
      renderQueue();
    };
    // #497: same delegated-listener reasoning — the chip strip is fully
    // rebuilt by renderTypeChips() on every renderQueue().
    document.getElementById('falcon-type-chips').addEventListener('click', e => {
      const chip = e.target.closest('.falcon-type-chip'); if (!chip) return;
      const t = chip.dataset.type;
      _disabledTypes.has(t) ? _disabledTypes.delete(t) : _disabledTypes.add(t);
      renderQueue();
    });
    // #513: same delegated-listener reasoning — rebuilt by renderStatusChips()
    // on every renderQueue(). Clicking the already-active chip clears the
    // filter; clicking a different one switches to it (only one at a time —
    // "just those results" reads as one status, not a multi-select).
    document.getElementById('falcon-status-chips').addEventListener('click', e => {
      const chip = e.target.closest('.falcon-status-chip'); if (!chip) return;
      const s = chip.dataset.status;
      _statusFilter = _statusFilter === s ? null : s;
      setTab('queue');
      renderQueue();
    });
    // one delegated listener for every row action — rows are fully re-rendered on
    // every renderQueue(), so per-element handlers would just leak; look the
    // clicked/changed item up by its data-id instead.
    const list = document.getElementById('falcon-queue-list');
    list.addEventListener('click', e => {
      if (e.target.closest('#falcon-status-filter-clear')) { _statusFilter = null; renderQueue(); return; }
      const expandBtn = e.target.closest('.falcon-row-expand');
      if (expandBtn) { const id = expandBtn.dataset.id; _expandedIds.has(id) ? _expandedIds.delete(id) : _expandedIds.add(id); renderQueue(); return; }
      const removeBtn = e.target.closest('.falcon-row-remove');
      if (removeBtn) { const id = removeBtn.dataset.id; queue = queue.filter(i => i.id !== id); _selectedIds.delete(id); _expandedIds.delete(id); renderQueue(); return; }
      const tabBtn = e.target.closest('.falcon-row-opentab');
      if (tabBtn) { const it = queue.find(i => i.id === tabBtn.dataset.id); if (it) openInTab(it); return; }
      const statusBtn = e.target.closest('.falcon-row-status');
      if (statusBtn) {
        const it = queue.find(i => i.id === statusBtn.dataset.id);
        if (it && (it.status === 'failed' || it.status === 'partial')) focusItemWorker(it);
        return;
      }
      // #494/#496: swap the picked cover to a different candidate provider,
      // for the specific cover[] entry the button belongs to.
      const pickBtn = e.target.closest('.falcon-cover-pick');
      if (pickBtn) {
        const it = queue.find(i => i.id === pickBtn.dataset.id);
        const entry = it && it.cover[+pickBtn.dataset.idx];
        if (entry && it.status !== 'active') { entry.url = pickBtn.dataset.url; renderQueue(); }
        return;
      }
    });
    // #467 (majkinetor): right-clicking the entity-type cell selects every
    // queued/finished item of that SAME type at once — a quick way to bulk-act
    // on (e.g. remove) just the recordings, or just the artists, in a mixed batch.
    list.addEventListener('contextmenu', e => {
      const typeCell = e.target.closest('.falcon-row-type');
      if (!typeCell) return;
      e.preventDefault();
      const type = typeCell.dataset.type;
      queue.filter(i => i.entityType === type && i.status !== 'active').forEach(i => _selectedIds.add(i.id));
      renderQueue();
    });
    list.addEventListener('change', e => {
      const chk = e.target.closest('.falcon-row-check');
      if (chk) { chk.checked ? _selectedIds.add(chk.dataset.id) : _selectedIds.delete(chk.dataset.id); renderQueue(); return; }
      // #474: disambiguation + ISRC — plain text fields, no validation here;
      // MB's own edit form is what actually validates an ISRC on submit.
      const disambigInp = e.target.closest('.falcon-disambiguation-input');
      if (disambigInp) { const it = queue.find(i => i.id === disambigInp.dataset.id); if (it) it.disambiguation = disambigInp.value.trim(); return; }
      const isrcInp = e.target.closest('.falcon-isrc-input');
      if (isrcInp) {
        const it = queue.find(i => i.id === isrcInp.dataset.id);
        if (it) it.isrcs = isrcInp.value.split(',').map(s => s.trim().toUpperCase().replace(/[\s-]/g, '')).filter(Boolean);
        return;
      }
      // #494/#496: "Falcon side — accept URL for the image" — the auto-picked
      // candidate is always user-editable/overridable, same spirit as the
      // disambiguation/ISRC fields above. Each targets its own cover[] entry.
      const coverInp = e.target.closest('.falcon-cover-input');
      if (coverInp) { const it = queue.find(i => i.id === coverInp.dataset.id); const entry = it && it.cover[+coverInp.dataset.idx]; if (entry) entry.url = coverInp.value.trim(); return; }
      const coverTypeSel = e.target.closest('.falcon-cover-type');
      if (coverTypeSel) { const it = queue.find(i => i.id === coverTypeSel.dataset.id); const entry = it && it.cover[+coverTypeSel.dataset.idx]; if (entry) entry.type = coverTypeSel.value; return; }
      const coverCommentInp = e.target.closest('.falcon-cover-comment-input');
      if (coverCommentInp) { const it = queue.find(i => i.id === coverCommentInp.dataset.id); const entry = it && it.cover[+coverCommentInp.dataset.idx]; if (entry) entry.comment = coverCommentInp.value.trim(); return; }
    });
    document.getElementById('falcon-tab-queue').onclick = () => setTab('queue');
    document.getElementById('falcon-tab-workers').onclick = () => setTab('workers');
    document.getElementById('falcon-tab-log').onclick = () => setTab('log');
    document.getElementById('falcon-tab-options').onclick = () => setTab('options');
    // #508: options — hiding the launcher takes effect immediately (no need
    // to close/reopen the panel to see it disappear/reappear).
    const hideLauncherCb = document.getElementById('falcon-opt-hide-launcher');
    hideLauncherCb.checked = cfg.hideLauncher;
    hideLauncherCb.onchange = () => { cfg.hideLauncher = hideLauncherCb.checked; if (cfg.hideLauncher) removeLauncher(); else ensureLauncher(); };
    const coverOnlyCb = document.getElementById('falcon-opt-cover-only-if-none');
    coverOnlyCb.checked = cfg.coverOnlyIfNone;
    coverOnlyCb.onchange = () => { cfg.coverOnlyIfNone = coverOnlyCb.checked; };
    const autoStartCb = document.getElementById('falcon-opt-auto-start-harmony');
    autoStartCb.checked = cfg.autoStartHarmonyImport;
    autoStartCb.onchange = () => { cfg.autoStartHarmonyImport = autoStartCb.checked; };
    const logHistoryIn = document.getElementById('falcon-opt-log-history-count');
    logHistoryIn.value = cfg.logHistoryCount;
    logHistoryIn.onchange = () => { cfg.logHistoryCount = logHistoryIn.value; logHistoryIn.value = cfg.logHistoryCount; };
    // #512: pick an earlier run's log to review/copy instead of the live one.
    document.getElementById('falcon-log-history').onchange = (e) => {
      _viewingSession = e.target.value || null;
      renderLog();
    };
    // #467: the intermittent failures only show up on majkinetor's real runs,
    // so the log has to be trivially shareable — one click to the clipboard,
    // already wrapped in the collapsed <details> + fenced block he otherwise
    // has to add by hand every time before pasting it into an issue. The blank
    // lines around the fence are required for GitHub to render markdown inside
    // an HTML block. #512: copies whichever session is currently being
    // VIEWED (live or historical), labeled accordingly.
    document.getElementById('falcon-log-copy').onclick = async () => {
      const note = document.getElementById('falcon-log-copied');
      const lines = currentLogLines();
      const label = _viewingSession ? `session ${formatSessionLabel(_viewingSession)}` : 'current session';
      const text = `<details><summary>Falcon log (v${scriptVersion()}, ${label}, ${lines.length} lines)</summary>\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n\n</details>`;
      try {
        await navigator.clipboard.writeText(text);
        note.textContent = `copied ${lines.length} line(s)`;
      } catch (e) { note.textContent = 'copy failed — select the text manually'; }
      setTimeout(() => { note.textContent = ''; }, 4000);
    };
    const dbgBox = document.getElementById('falcon-log-debug');
    document.getElementById('falcon-log-clear').onclick = () => {
      LOG.length = 0;
      _lastPersisted = '';
      try { if (LS && SESSION_ID) LS.removeItem(LS_PREFIX + SESSION_ID); } catch (e) {}
      renderLog();
    };
    dbgBox.checked = debugOn();
    dbgBox.onchange = () => GM_setValue('falcon:debug', dbgBox.checked);
    const sizeSlider = document.getElementById('falcon-worker-size');
    const sizeVal = document.getElementById('falcon-worker-size-val');
    sizeSlider.value = cfg.workerSize;
    sizeVal.textContent = cfg.workerSize;
    sizeSlider.oninput = () => {
      cfg.workerSize = sizeSlider.value;
      sizeVal.textContent = cfg.workerSize;
      renderWorkerLayout();   // resizes every visible card AND rescales its iframe
    };
    // drag by header
    const hdr = document.getElementById('falcon-hdr');
    let dragging = false, dx = 0, dy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target.closest('button, a')) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      // detach from the centering transform BEFORE reading dx/dy — otherwise the
      // first drag move jumps (translate(-50%,-50%) would double-apply against the
      // new left/top). getBoundingClientRect() already reflects the transformed
      // (visual) position, so this keeps the panel exactly where it looked like it was.
      panel.style.transform = 'none'; panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => { if (!dragging) return; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + 'px'; panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px'; });
    window.addEventListener('mouseup', () => { dragging = false; });
    // Normalise tab visibility through the same code path the tab buttons use,
    // so the panes can never start in a state setTab() wouldn't produce. The
    // Workers pane in particular must not be display:none (see setTab) — it was
    // shipped that way in the initial markup, so workers only ran once you'd
    // clicked the Workers tab at least once (majkinetor: "workers still not
    // starting without watching them").
    setTab(tab);
  }
  // ⚠ The Workers pane must NEVER be display:none while workers are running.
  // #467 (majkinetor: "when worker tab is not open, it doesnt work"): a worker
  // iframe inside a display:none container loads and fills fine, but its submit
  // click goes nowhere — his log shows the button found and enabled, MB
  // reporting no error, and the page simply never navigating for the full 50s;
  // opening the tab made the same 3 items finish in 5s. Browsers don't run a
  // display:none subtree's rendering, and the form submission dies with it.
  // So hide it the way that keeps it fully live: parked off-screen, still laid
  // out, still rendering. (Idle cards can still be display:none — they have no
  // work in flight to lose. See renderWorkerLayout.)
  const OFFSCREEN = 'position:absolute;left:-100000px;top:0;width:1200px;height:800px;overflow:auto;';
  function setTab(t) {
    tab = t;
    document.getElementById('falcon-body-queue').style.display = t === 'queue' ? 'flex' : 'none';
    const w = document.getElementById('falcon-body-workers');
    if (t === 'workers') w.style.cssText = 'display:block;padding:8px 10px;overflow:auto;flex:1';
    else w.style.cssText = OFFSCREEN + 'display:block;padding:8px 10px;';
    document.getElementById('falcon-body-log').style.display = t === 'log' ? 'flex' : 'none';
    document.getElementById('falcon-body-options').style.display = t === 'options' ? 'flex' : 'none';
    if (t === 'log') { populateLogHistory(); renderLog(); }
    if (t === 'workers') renderWorkerLayout();   // sizes were computed while off-screen; recompute for the real viewport
    fitBars();   // a bar that was hidden measured 0-wide; re-fit now it's laid out
  }
  function showPanel() { ensurePanel(); panel.style.display = 'flex'; renderQueue(); fitBars(); }
  function togglePanel() { ensurePanel(); if (panel.style.display === 'none') showPanel(); else panel.style.display = 'none'; }

  // #467 (majkinetor): "maximize" — grows the whole panel (and, on the Workers tab,
  // gives each worker card more natural room) so log/queue/worker content isn't
  // squinted at in a 460px-wide box. Detaches from whatever corner it's anchored to
  // (or wherever it's been dragged) and restores the exact prior box on toggle-back.
  let _maxed = false, _prevBox = null;
  function toggleMaximize() {
    const btn = document.getElementById('falcon-maximize');
    if (!_maxed) {
      _prevBox = { left: panel.style.left, top: panel.style.top, right: panel.style.right, bottom: panel.style.bottom, width: panel.style.width, height: panel.style.height, maxWidth: panel.style.maxWidth, maxHeight: panel.style.maxHeight, transform: panel.style.transform };
      panel.style.left = '3vw'; panel.style.top = '3vh'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.transform = 'none';
      panel.style.width = '94vw'; panel.style.maxWidth = '94vw'; panel.style.height = '94vh'; panel.style.maxHeight = '94vh';
      _maxed = true; if (btn) { btn.textContent = '❐'; btn.title = 'Restore'; }
    } else {
      if (_prevBox) Object.assign(panel.style, _prevBox);
      _maxed = false; if (btn) { btn.textContent = '⛶'; btn.title = 'Maximize'; }
    }
    fitBars();
  }

  const DOT = { queued: '#999999', active: '#e08a1e', done: '#2e9e5b', partial: '#d68910', failed: '#c0392b', manual: '#6b5bce', skipped: '#5b8fa8' };
  // #506 (majkinetor): "queue processing status fields should have color which
  // should be used for row background in unintrusive way" — same palette as the
  // status dot, just a faint tint (~7% alpha) so it reads at a glance without
  // fighting the row's text for attention.
  const ROW_BG = Object.fromEntries(Object.entries(DOT).map(([k, v]) => [k, v + '12']));
  // #495: a bare slice(0,3) collides — 'release' and 'release_group' both give
  // 'rel'. Everything else still just takes its natural first 3 letters.
  const TYPE_BADGE = { release_group: 'rg' };
  function renderRowDetail(it) {
    const results = it.urlResults || [];
    const urlRows = it.urls.map(u => {
      const res = results.find(r => r.url === u.url);
      const icon = res ? (res.ok ? '✓' : '✗') : '·';
      const color = res ? (res.ok ? '#2e9e5b' : '#c0392b') : '#aaa';
      return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 30px;font-size:10.5px;overflow:hidden" title="${res && res.error ? esc(res.error) : ''}">
        <span style="color:${color};width:10px;flex:0 0 auto;text-align:center">${icon}</span>
        <a href="${esc(u.url)}" target="_blank" rel="noopener" style="color:#1b6ec2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto">${esc(u.url)}</a>
        ${u.linkTypeId ? `<span style="color:#999;flex:0 0 auto">type ${esc(u.linkTypeId)}</span>` : ''}
      </div>`;
    }).join('');
    // #474 (majkinetor: "make it addable via our interface, sender is responsible
    // for filling it") — disambiguation + ISRC are recording-only MB fields
    // (see buildSeedEditUrl), so only offered here for entityType 'recording'.
    // No auto-computation: whatever's typed here is seeded verbatim.
    const meta = it.entityType === 'recording' ? `
      <div style="display:flex;align-items:center;gap:6px;padding:3px 0 3px 30px;font-size:10.5px">
        <input type="text" class="falcon-disambiguation-input" data-id="${it.id}" placeholder="disambiguation comment" value="${esc(it.disambiguation || '')}" ${it.status === 'active' ? 'disabled' : ''}
          style="flex:1 1 auto;min-width:0;font-size:10.5px;padding:2px 6px;border:1px solid #ddd;border-radius:3px" />
        <input type="text" class="falcon-isrc-input" data-id="${it.id}" placeholder="ISRC(s), comma-separated" value="${esc((it.isrcs || []).join(', '))}" ${it.status === 'active' ? 'disabled' : ''}
          style="flex:1 1 auto;min-width:0;font-size:10.5px;padding:2px 6px;border:1px solid #ddd;border-radius:3px;font-family:'Courier New',monospace" />
      </div>`
      // #494/#496: cover art has no urls[] row to show — the image URL IS the
      // payload, so it gets the same input treatment (auto-picked from
      // Harmony's candidates but always user-editable/overridable), plus a
      // type picker and a provider picker when more than one candidate was
      // found. cover[] is an array — one row per entry (Falcon only ever
      // populates one today, but a JSON import can carry more).
      : it.entityType === 'release' ? `
      <div style="display:flex;flex-direction:column;gap:6px;padding:3px 0 3px 30px;font-size:10.5px">
        ${it.cover.map((c, idx) => `
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;align-items:center;gap:6px">
            <input type="text" class="falcon-cover-input" data-id="${it.id}" data-idx="${idx}" placeholder="${c.candidates.length && !c.url ? 'resolving best cover…' : 'cover image URL'}" value="${esc(c.url || '')}" ${it.status === 'active' ? 'disabled' : ''}
              style="flex:1 1 auto;min-width:0;font-size:10.5px;padding:2px 6px;border:1px solid #ddd;border-radius:3px" />
            <select class="falcon-cover-type" data-id="${it.id}" data-idx="${idx}" ${it.status === 'active' ? 'disabled' : ''} title="Cover art type"
              style="font-size:10.5px;padding:2px 4px;border:1px solid #ddd;border-radius:3px">${COVER_TYPES.map(t => `<option value="${esc(t)}"${(c.type || 'Front') === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
            <input type="text" class="falcon-cover-comment-input" data-id="${it.id}" data-idx="${idx}" placeholder="image comment (optional)" value="${esc(c.comment || '')}" ${it.status === 'active' ? 'disabled' : ''}
              style="flex:1 1 auto;min-width:0;font-size:10.5px;padding:2px 6px;border:1px solid #ddd;border-radius:3px" />
          </div>
          ${c.candidates.length > 1 ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${c.candidates.map(cand => `<button type="button" class="falcon-cover-pick" data-id="${it.id}" data-idx="${idx}" data-url="${esc(cand.url)}" title="${esc(cand.url)}" ${it.status === 'active' ? 'disabled' : ''} style="border:1px solid ${cand.url === c.url ? '#1b2a4a' : '#ddd'};background:${cand.url === c.url ? '#eef1fa' : '#fff'};border-radius:10px;padding:1px 8px;font-size:9.5px;cursor:pointer;color:#444">${esc(cand.provider)}${cand.width ? ` ${cand.width}×${cand.height}` : ''}</button>`).join('')}</div>` : ''}
        </div>`).join('')}
        ${it.coverExistingCount ? `<div style="color:#a35b00;font-size:10px">⚠ this release already has ${it.coverExistingCount} cover image${it.coverExistingCount === 1 ? '' : 's'} — Harmony doesn't check before suggesting one, so adding this may create a duplicate</div>` : ''}
      </div>` : '';
    return urlRows + meta;
  }
  // #497: one chip per distinct entity type currently in the queue, showing
  // its count — click to toggle whether that type's still-queued items get
  // picked up by the next run. Rebuilt on every renderQueue() so it always
  // reflects the current queue contents (types can appear/disappear as items
  // are added/removed).
  function renderTypeChips() {
    const wrap = document.getElementById('falcon-type-chips'); if (!wrap) return;
    const counts = {};
    queue.forEach(i => { counts[i.entityType] = (counts[i.entityType] || 0) + 1; });
    const types = Object.keys(counts).sort();
    if (!types.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = types.map(t => {
      const on = !_disabledTypes.has(t);
      const label = TYPE_BADGE[t] || t.slice(0, 3);
      return `<button type="button" class="falcon-type-chip" data-type="${esc(t)}" title="${on ? `Click to exclude every ${esc(t)} item from the next run` : `Click to include every ${esc(t)} item in the next run`}"
        style="border:1px solid ${on ? '#1b2a4a' : '#ddd'};background:${on ? '#1b2a4a' : '#f5f5f5'};color:${on ? '#fff' : '#999'};border-radius:12px;padding:2px 10px;font-size:10.5px;cursor:pointer;text-transform:uppercase">${esc(label)} ${counts[t]}</button>`;
    }).join('');
  }
  // #513 (majkinetor): "Its still not easily seeable that there were issues.
  // Lets add some chip with results in appropriate color if there are
  // issues." One chip per PROBLEM status (failed/partial/manual — 'skipped'
  // is a success, not a problem, same reasoning renderProgress already
  // applies), colored from the same DOT palette the row dots already use.
  // Clicking toggles _statusFilter, so it doubles as "show me just those."
  const PROBLEM_STATUSES = ['failed', 'partial', 'manual'];
  function renderStatusChips() {
    const wrap = document.getElementById('falcon-status-chips'); if (!wrap) return;
    const counts = {};
    queue.forEach(i => { if (PROBLEM_STATUSES.includes(i.status)) counts[i.status] = (counts[i.status] || 0) + 1; });
    const present = PROBLEM_STATUSES.filter(s => counts[s]);
    if (_statusFilter && !counts[_statusFilter]) _statusFilter = null;   // the last item in that state was removed/re-run
    wrap.innerHTML = present.map(s => {
      const on = _statusFilter === s;
      const color = DOT[s];
      return `<button type="button" class="falcon-status-chip" data-status="${esc(s)}" title="${on ? 'Click to show every item again' : `Click to show only ${esc(s)} items`}"
        style="border:1.5px solid ${color};background:${on ? color : 'transparent'};color:${on ? '#fff' : color};border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;cursor:pointer;text-transform:uppercase;white-space:nowrap;flex:0 0 auto">${esc(s)} ${counts[s]}</button>`;
    }).join('');
  }
  function renderQueue() {
    renderTypeChips();
    renderStatusChips();
    const list = document.getElementById('falcon-queue-list'); if (!list) return;
    const visible = _statusFilter ? queue.filter(i => i.status === _statusFilter) : queue;
    list.innerHTML = visible.map(it => {
      const expanded = _expandedIds.has(it.id);
      const checked = _selectedIds.has(it.id);
      const isActive = it.status === 'active';
      // #497: still queued, but its type is toggled off — won't be picked up
      // by the next run. Dimmed + a distinct label, but the underlying
      // item.status stays 'queued' (this is a queue-level filter, not an
      // outcome — an already active/done/failed item is never affected).
      const excluded = it.status === 'queued' && _disabledTypes.has(it.entityType);
      return `
      <div class="falcon-row" data-id="${it.id}" style="border-bottom:1px solid #f3f3f3;background:${ROW_BG[it.status] || ''};${excluded ? 'opacity:.45' : ''}">
        <div style="display:flex;align-items:center;gap:6px;padding:2px 0" title="${it.error ? esc(it.error) : excluded ? 'This type is toggled off above — won\'t be processed until turned back on' : ''}">
          <input type="checkbox" class="falcon-row-check" data-id="${it.id}" ${checked ? 'checked' : ''} ${isActive ? 'disabled' : ''} style="flex:0 0 auto" />
          <button type="button" class="falcon-row-expand" data-id="${it.id}" title="${it.urls.length > 1 ? 'Show/hide urls' : it.entityType === 'recording' ? 'Show detail / edit disambiguation & ISRC' : it.entityType === 'release' ? 'Show/edit cover art image' : 'Show url detail'}" style="border:none;background:none;cursor:pointer;color:#777;flex:0 0 auto;font-size:15px;line-height:1;width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center">${expanded ? '▾' : '▸'}</button>
          <span style="width:8px;height:8px;border-radius:50%;background:${DOT[it.status] || '#999'};flex:0 0 auto"></span>
          <span class="falcon-row-type" data-id="${it.id}" data-type="${esc(it.entityType)}" title="Right-click to select every ${esc(it.entityType)} in the queue" style="width:32px;flex:0 0 auto;font-size:9px;text-transform:uppercase;color:#888;text-align:center;cursor:context-menu">${esc(TYPE_BADGE[it.entityType] || it.entityType.slice(0, 3))}</span>
          <a href="${MB_ORIGIN}/${entityUrlSegment(it.entityType)}/${it.mbid}" target="_blank" rel="noopener" title="${esc(it.entityType)}/${esc(it.mbid)}" style="color:#1b2a4a;text-decoration:none;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto">${esc(entityLabel(it))}</a>
          ${it.urls.length > 1
            ? `<span style="color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${it.urls.length} links</span>`
            : it.urls.length === 1
              ? `<a href="${esc(it.urls[0].url)}" target="_blank" rel="noopener" style="color:#1b6ec2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(it.urls[0].url)}</a>`
              // #494/#496: release rows never carry a urls[] entry — cover art
              // is their whole payload — so they always land here; show it
              // alongside disambiguation/ISRC, each only when actually non-empty.
              : `<span style="color:#999;font-style:italic;flex:1" title="${it.coverExistingCount ? esc(`already has ${it.coverExistingCount} cover image${it.coverExistingCount === 1 ? '' : 's'} — this may duplicate it`) : ''}">no links — ${[it.disambiguation ? 'disambiguation' : '', (it.isrcs || []).length ? 'ISRC' : '', it.cover.some(c => c.url) ? (it.coverExistingCount ? 'cover ⚠' : 'cover') : ''].filter(Boolean).join(' + ') || '—'}</span>`}
          <span class="falcon-row-status" data-id="${it.id}" title="${it.status === 'failed' || it.status === 'partial' ? 'Click to inspect this failure' : ''}" style="text-transform:uppercase;font-size:9px;flex:0 0 auto;${it.status === 'failed' || it.status === 'partial' ? 'color:#c0392b;cursor:pointer;text-decoration:underline' : 'color:#999'}">${excluded ? 'excluded' : it.status}</span>
          <button type="button" class="falcon-row-opentab" data-id="${it.id}" title="Open this entity's edit page in a real tab, pre-filled, to inspect/complete manually" style="border:none;background:none;cursor:pointer;color:#666;flex:0 0 auto">⇗</button>
          <button type="button" class="falcon-row-remove" data-id="${it.id}" ${isActive ? 'disabled' : ''} title="Remove from queue" style="border:none;background:none;cursor:pointer;color:#999;flex:0 0 auto">✕</button>
        </div>
        ${expanded ? renderRowDetail(it) : ''}
      </div>`;
    }).join('') || (_statusFilter
      ? `<div style="color:#999;padding:8px 0">No ${esc(_statusFilter)} items right now — <button type="button" id="falcon-status-filter-clear" style="border:none;background:none;color:#1b6ec2;cursor:pointer;padding:0;font:inherit;text-decoration:underline">show everything</button>.</div>`
      : '<div style="color:#999;padding:8px 0">Queue is empty — click + above to paste some entities.</div>');
    const selCount = document.getElementById('falcon-select-count');
    if (selCount) selCount.textContent = _selectedIds.size ? `${_selectedIds.size} selected` : '';
    const removeBtn = document.getElementById('falcon-remove-selected');
    if (removeBtn) removeBtn.disabled = _selectedIds.size === 0;
    const selectAll = document.getElementById('falcon-select-all');
    if (selectAll) { const selectable = queue.filter(i => i.status !== 'active'); selectAll.checked = selectable.length > 0 && selectable.every(i => _selectedIds.has(i.id)); }
    const expandAllBtn = document.getElementById('falcon-expand-all');
    if (expandAllBtn) {
      const allExpanded = queue.length > 0 && queue.every(i => _expandedIds.has(i.id));
      // write only the LABEL span — replacing the button's textContent would
      // throw away the icon and the collapse markup along with it.
      const bt = expandAllBtn.querySelector('.falcon-bt');
      const bi = expandAllBtn.querySelector('.falcon-bi');
      if (bt) bt.textContent = allExpanded ? 'Collapse all' : 'Expand all';
      if (bi) bi.textContent = allExpanded ? '▴' : '▾';
      expandAllBtn.title = allExpanded ? "Collapse every row's url detail" : "Expand every row's url detail";
    }
    renderProgress();
    renderCoverWarning();
    fitBars();
  }
  // #467 (majkinetor): "Lets have a progress bar". Counts anything that has
  // reached a terminal state as finished — done/partial/failed/manual all mean
  // "this one is no longer waiting on us" — so the bar tracks the run, not just
  // the successes. Bar turns amber if anything failed, so a run that completed
  // but left casualties doesn't read as a clean green sweep.
  function renderProgress() {
    const bar = document.getElementById('falcon-progress-bar');
    const txt = document.getElementById('falcon-progress-text');
    if (!bar || !txt) return;
    // #497 (majkinetor, live: "progress bar max items remains old"): a
    // toggled-off type's still-queued items will never settle (nextQueued
    // skips them), so counting them in the denominator meant the bar could
    // never reach 100% while any type was excluded. An item that already
    // reached a terminal state BEFORE being excluded still counts — this
    // only drops the ones currently sitting out.
    const total = queue.filter(i => !(i.status === 'queued' && _disabledTypes.has(i.entityType))).length;
    if (!total) { bar.style.width = '0%'; txt.textContent = ''; return; }
    const settled = queue.filter(i => i.status !== 'queued' && i.status !== 'active').length;
    const bad = queue.filter(i => i.status === 'failed' || i.status === 'partial').length;   // 'skipped' is a success (already up to date), not a problem
    const active = queue.filter(i => i.status === 'active').length;
    bar.style.width = Math.round((settled / total) * 100) + '%';
    bar.style.background = bad ? '#d68910' : '#2e9e5b';
    txt.textContent = `${settled}/${total}` + (active ? ` · ${active} running` : '') + (bad ? ` · ${bad} problem${bad > 1 ? 's' : ''}` : '');
  }
  // #494 follow-up (majkinetor: "that requires row to be in view. Lets put the
  // warning bellow the progress bar so its visible all the time") — a
  // standing summary of every release in the queue whose existingCount check
  // (see checkExistingCoverArt) came back positive, always visible instead of
  // needing that row expanded/scrolled into view.
  function renderCoverWarning() {
    const el = document.getElementById('falcon-cover-warning'); if (!el) return;
    const dupes = queue.filter(i => i.entityType === 'release' && i.coverExistingCount);
    if (!dupes.length) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block';
    const names = dupes.map(i => `${entityLabel(i)} (${i.coverExistingCount})`).join(', ');
    el.textContent = `⚠ ${dupes.length} release${dupes.length > 1 ? 's' : ''} already ${dupes.length > 1 ? 'have' : 'has'} cover art — ${names}`;
  }

  // #467 (majkinetor): "click the failed label, open its worker alone in a
  // popup... show error in header" — then, after seeing a text-only version:
  // "I didn't envision item details like this. I want to have worker visible
  // there, in its active state." Tried REPARENTING the real iframe into a
  // popup next — moving an iframe element to a new parent turned out to reset
  // it to about:blank in Chromium (confirmed live), destroying the exact state
  // we were trying to preserve. The iframe must never move, so instead: jump to
  // the Workers tab and zoom the SAME card the retire/queue mechanism already
  // keeps alive in place (see retireCard) — the real, untouched iframe, just
  // shown larger, with its error now in a banner right on the card (not just a
  // hover tooltip) so it's visible once zoomed. Falls back to a plain text
  // popup (url list + error) only if the item was never picked up by any
  // worker at all (so there's no card/iframe to jump to).
  function focusItemWorker(item) {
    const idx = workerCards.findIndex(c => c.dataset.itemId === item.id);
    if (idx === -1) { showItemPopup(item); return; }
    _zoomedWorker = idx;
    setTab('workers');
    renderWorkerLayout();
  }
  let _itemPopupId = null;
  function ensureItemPopup() {
    if (document.getElementById('falcon-item-popup')) return;
    const el = document.createElement('div');
    el.id = 'falcon-item-popup';
    el.style.cssText = 'display:none;position:fixed;z-index:2147483647;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-width:92vw;max-height:70vh;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.3);border:1px solid #ddd;overflow:hidden;flex-direction:column;font:12px -apple-system,Segoe UI,Arial,sans-serif';
    el.innerHTML = `
      <div id="falcon-item-popup-hdr" style="padding:8px 10px;background:#7a2020;color:#fff;display:flex;align-items:center;gap:8px">
        <span id="falcon-item-popup-title" style="flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
        <button type="button" id="falcon-item-popup-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="falcon-item-popup-error" style="padding:8px 10px;background:#fdecea;color:#a33;font-size:11px;white-space:pre-wrap;border-bottom:1px solid #f3c8c3"></div>
      <div id="falcon-item-popup-body" style="padding:8px 10px;overflow:auto;flex:1"></div>
      <div style="padding:8px 10px;border-top:1px solid #eee;display:flex;justify-content:flex-end">
        <button type="button" id="falcon-item-popup-opentab" style="padding:4px 10px;cursor:pointer">⇗ Open in tab</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('falcon-item-popup-close').onclick = () => { el.style.display = 'none'; _itemPopupId = null; };
    document.getElementById('falcon-item-popup-opentab').onclick = () => {
      const it = queue.find(i => i.id === _itemPopupId);
      if (it) openInTab(it);
    };
  }
  function showItemPopup(item) {
    ensureItemPopup();
    _itemPopupId = item.id;
    const el = document.getElementById('falcon-item-popup');
    document.getElementById('falcon-item-popup-title').textContent = `${entityLabel(item)} — ${item.status.toUpperCase()}`;
    document.getElementById('falcon-item-popup-error').textContent = item.error || '(no error message recorded)';
    document.getElementById('falcon-item-popup-body').innerHTML = renderRowDetail(item) || '<div style="color:#999">No url detail available — this item was never picked up by a worker.</div>';
    el.style.display = 'flex';
  }
  // #512: "YYYYMMDDHHMMSS-N" -> "YYYY-MM-DD HH:MM:SS" for the history dropdown.
  function formatSessionLabel(id) {
    const m = id.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (!m) return id;
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  }
  function loadSessionLines(id) {
    if (!LS) return null;
    try { const raw = LS.getItem(LS_PREFIX + id); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  // What's currently shown in the Log tab: the live session, or a historical
  // one picked from #falcon-log-history — Copy Log uses this too, so copying
  // always matches what's on screen.
  function currentLogLines() {
    if (_viewingSession) return loadSessionLines(_viewingSession) || [`(session ${_viewingSession} not found — it may have aged out)`];
    return LOG;
  }
  function populateLogHistory() {
    const sel = document.getElementById('falcon-log-history'); if (!sel) return;
    const ids = listSessionKeys().filter(id => id !== SESSION_ID).reverse();   // newest first
    const prevValue = sel.value;
    sel.innerHTML = '<option value="">Current session</option>' +
      ids.map(id => `<option value="${esc(id)}">${esc(formatSessionLabel(id))}</option>`).join('');
    sel.value = ids.includes(prevValue) ? prevValue : '';
  }
  function renderLog() {
    const el = document.getElementById('falcon-log-text'); if (!el || tab !== 'log') return;
    el.textContent = currentLogLines().join('\n');
    el.scrollTop = el.scrollHeight;
  }
  function updateRunBtn() {
    const b = document.getElementById('falcon-run'); if (!b) return;
    // label/icon spans only — see the expand-all note; textContent would wipe
    // out the collapse markup and leave the button stuck at full width.
    const bt = b.querySelector('.falcon-bt'), bi = b.querySelector('.falcon-bi');
    if (bt) bt.textContent = running ? 'Stop' : 'Start';
    if (bi) bi.textContent = running ? '■' : '▶';
    b.title = running ? 'Stop after the running workers finish their current item' : 'Start processing the queue';
    fitBar(b.closest('.falcon-bar'));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ── boot ────────────────────────────────────────────────────────────── */
  if (ON_HARMONY) {
    ensureHarmonyButton();
    // Harmony's actions render client-side after load — rescan until the count
    // settles (3 unchanged reads), then stop polling.
    let stableCount = 0, lastN = -1;
    const iv = setInterval(() => {
      const n = scrapeHarmonyActions().length;
      ensureHarmonyButton();
      if (n === lastN) { if (++stableCount >= 3) clearInterval(iv); } else { stableCount = 0; lastN = n; }
    }, 1000);
  } else {
    const seeded = parseUrlParam();
    ensureLauncher();
    if (seeded && seeded.length) {
      // #512 (majkinetor, live: "See the log before starting queue - it
      // still contains older logs from 13:54") — falcon:session:current
      // lives in localStorage, which is shared across EVERY tab on
      // musicbrainz.org, not scoped to this one. A brand new tab opened by
      // "Send to Falcon" (or any fresh `?falcon=` seed) was reattaching to
      // whatever session the LAST tab's LAST run left behind, instead of
      // starting clean. A genuine new seed always means a new session.
      newSession(`seeded ${seeded.length} item(s) from the falcon= URL param`);
      addToQueue(seeded);
      showPanel();
      // #508 follow-up (majkinetor): "Auto start Harmony import (off by
      // default)" — only for a genuine Harmony-sourced seed (the GM-storage
      // token scheme), not an arbitrary `?falcon=` base64 payload some other
      // script/user constructed by hand.
      if (seeded.fromHarmony && cfg.autoStartHarmonyImport) start();
    }
    // (An interrupted run used to force the panel open here on the Log tab. It
    // was scaffolding for chasing the tab-closing bug, and it had a nasty edge:
    // with the panel already open at boot, the launcher's first click TOGGLED IT
    // SHUT. The previous session's log is still restored and still one click
    // away on the Log tab — it just doesn't hijack the panel any more.)
    window.addEventListener('keydown', e => {
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
      if ((e.key || '').toLowerCase() !== 'f') return;
      e.preventDefault(); e.stopPropagation();
      togglePanel();
    });
  }

  // Test hook only (#467) — no behavior change.
  window.__falconTest = { parseLine, parsePaste, parseUrlParam, parseHarmonySeedUrl, encodeFalconPayload, scrapeHarmonyActions, makePendingToken, addToQueue, getQueue: () => queue, setQueue: q => { queue = q; renderQueue(); }, start, stop, cfg, fillAndSubmit, findAddLinkInput, findSubmitButton, findFieldError, setRowLinkType, addSecondRelationshipType, editUrl, buildSeedEditUrl, nextQueued, fetchEntityName, entityLabel, openInTab, getSelectedIds: () => _selectedIds, getExpandedIds: () => _expandedIds, mbThrottle, showItemPopup, focusItemWorker, importQueueJson, suspendNameLookups, resumeNameLookups, getLog: () => LOG.slice(), getSessionId: () => SESSION_ID, noteUnload, editNoteText, setEditNote, isLoggedIn, scrapeHarmonyIsrcs,
    // #494
    scrapeHarmonyCover, parseCoverCaptionMeta, pickBestCover, gmFetch, runCoverItem, mimeFromUrl, checkExistingCoverArt,
    // #495
    entityUrlSegment, activateReleaseEditNoteTab,
    // #497
    getDisabledTypes: () => _disabledTypes, setDisabledTypes: s => { _disabledTypes = s; renderQueue(); },
    // #500
    harmonyIsrcFallback, resolveIsrcFallback,
    // #509 follow-up
    resolveMissingNames,
    // #512
    listSessionKeys, pruneOldSessions, formatSessionLabel, loadSessionLines, currentLogLines, populateLogHistory,
    logRunSummary,
    setViewingSession: id => { _viewingSession = id; renderLog(); },
    getViewingSession: () => _viewingSession,
    // #513
    getStatusFilter: () => _statusFilter, setStatusFilter: s => { _statusFilter = s; renderQueue(); } };
})();
