// ==UserScript==
// @name         Art Station
// @namespace    https://musicbrainz.org/
// @version      2026.6.27
// @description  Cover/event-art editor for MusicBrainz — one gallery to view, group, sort, reorder, retype, comment, remove, download and source (MH Covers) a release's cover art (or an event's event art), staged and applied on Enter edit. PoC (discussion #230).
// @author       majkinetor
// @icon         https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/art_station/icon.png
// @match        *://*.musicbrainz.org/release/*/cover-art
// @match        *://*.musicbrainz.org/release/*/add-cover-art
// @match        *://*.musicbrainz.org/event/*/event-art
// @match        *://*.musicbrainz.org/event/*/add-event-art
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-start
// ==/UserScript==
//
// Phase-1 PoC. Principle: "you get what you see" — the gallery is the staged
// state; Enter edit makes MB match it. Reads live cover art (CAA JSON + the
// page), no uploads yet (Add/Enter-edit submission land next).
(function () {
  'use strict';

  // Works on BOTH a release's cover art and an event's event art — same gallery,
  // same flow, only the entity differs (archive host, the */-art endpoint suffix,
  // and the type vocabulary). Everything downstream goes through ENT. (#241)
  const M = location.pathname.match(/\/(release|event)\/([0-9a-f-]{36})\/(add-)?(?:cover|event)-art/i);
  if (!M) return;
  const IS_EVENT = M[1].toLowerCase() === 'event';
  const MBID = M[2];
  // #248 the native "add cover art" uploader page (also where integrations like
  // Harmony land, sometimes pre-seeded with images). Art Station fully takes it
  // over: same gallery, plus it harvests any seeded images as staged new covers.
  const IS_ADD = !!M[3];
  const ENT = IS_EVENT
    ? { kind: 'event',   base: `/event/${MBID}`,   art: 'event-art', archive: `https://eventartarchive.org/event/${MBID}`, noun: 'event art', Noun: 'Event art' }
    : { kind: 'release', base: `/release/${MBID}`, art: 'cover-art', archive: `https://coverartarchive.org/release/${MBID}`, noun: 'cover art', Noun: 'Cover art' };

  // Deep-link to the current user's Cover/Event Art edit history — the MB edit
  // search pre-filtered to the cover-art + event-art edit types, scoped to "me".
  // Shown as a button in the Enter-edit dialog header. location.origin so it
  // follows to beta.musicbrainz.org too.
  const ART_EDITS_URL = location.origin + '/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=314&conditions.0.args=158&conditions.0.args=316&conditions.0.args=1510&conditions.0.args=315&conditions.0.args=159&conditions.0.args=317&conditions.0.args=1511&conditions.1.field=editor&conditions.1.operator=me&conditions.1.name=&conditions.1.args.0=';

  // append a node to <head>/<html>, deferring if neither exists yet (document-start)
  function appendEl(el) {
    const t = document.head || document.documentElement;
    if (t) { t.appendChild(el); return; }
    new MutationObserver((_, obs) => { const t2 = document.head || document.documentElement; if (t2) { obs.disconnect(); t2.appendChild(el); } }).observe(document, { childList: true });
  }

  // Hide the native cover-art UI BEFORE it paints (we run at document-start), so the
  // tab never flashes MB's gallery before ours mounts. Our gallery uses .as-* only.
  const earlyHide = document.createElement('style');
  earlyHide.textContent = '.artwork-cont,#content>h2,#content>p{display:none!important}';
  appendEl(earlyHide);
  // Hide the native button row (Add / Reorder / Import…) before paint too — a JS hide
  // at render time flashes them on entry AND misses ECAU's async-added Import buttons;
  // a document-start !important style avoids both. Toggled by the setting + Original.
  const footerStyle = document.createElement('style');
  footerStyle.textContent = '#content div.buttons.ui-helper-clearfix{display:none!important}';
  appendEl(footerStyle);
  // saved prefs read directly here (the SETTINGS object is built later) so the initial
  // Original/footer state is applied flash-free, before first paint.
  let _savedPrefs = {}; try { _savedPrefs = JSON.parse(localStorage.getItem('artstation:settings') || '{}'); } catch (e) {}
  earlyHide.disabled = !!_savedPrefs.showOrig;
  footerStyle.disabled = !!_savedPrefs.showOrig || _savedPrefs.hideMbFooter === false;
  // #248 the add page: take the whole thing over. Move the native uploader form
  // OFF-SCREEN (not display:none) so it stays functional — integrations (ECAU /
  // Harmony) still seed it and we harvest the resulting preview rows — while every
  // bit of its UI (and any plugin UI inside it) is invisible. mount() hides the
  // rest of #content. Disabled in "Show original".
  let addHide = null;
  if (IS_ADD) {
    addHide = document.createElement('style');
    addHide.textContent = 'form#add-cover-art,form#add-event-art{position:fixed!important;left:-99999px!important;top:0!important;width:1000px!important;opacity:0!important;pointer-events:none!important}';
    appendEl(addHide);
    addHide.disabled = !!_savedPrefs.showOrig;
  }

  // Proper edit-note attribution, like the other scripts: "Name vX by author - url".
  // GM_info is exposed even under @grant none on the common managers; fall back to
  // the hard-coded repo URL so the note never reads "v undefined".
  const _gm = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script : null;
  // which userscript manager is running us (Violentmonkey / Tampermonkey / Greasemonkey / …)
  // + its version — surfaced in the session log to help diagnose manager-specific issues (#282)
  const _mgr = (typeof GM_info !== 'undefined' && GM_info)
    ? ((GM_info.scriptHandler || 'unknown manager') + (GM_info.version ? ' ' + GM_info.version : ''))
    : '';
  const SCRIPT_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/art_station';
  const ICON_URL = 'https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/art_station/icon.png';
  const ATTRIBUTION = _gm
    ? `${_gm.name} v${_gm.version} by ${_gm.author} - ${_gm.homepageURL || _gm.homepage || SCRIPT_URL}`
    : `Art Station by majkinetor - ${SCRIPT_URL}`;

  const CAA = ENT.archive;                            // CAA for releases, EAA for events
  const imgUrl  = id => `${CAA}/${id}.jpg`;          // original
  // the public image URL we can hand to a reverse-image engine: CAA for a published
  // cover, or — for a sourced new cover — its provider direct-image URL (_provImageUrl,
  // e.g. i.discogs.com) or its source URL when that itself points at an image file (a
  // picker round-trip / pasted image URL, e.g. an Apple mzstatic .jpg). A purely local
  // (dropped) file, or one sourced only via a provider *page*, has no image URL to search.
  const isImgUrl = u => /^https?:\/\/\S+\.(jpe?g|png|gif|webp|bmp|tiff?)(\?|#|$)/i.test(u || '');
  const searchUrlFor = it => it._del ? '' : (it._new
    ? (it._provImageUrl || (isImgUrl(it._provUrl) ? it._provUrl : ''))
    : imgUrl(it.id));
  const thumb   = (id, n) => `${CAA}/${id}-${n}.jpg`; // 250 / 500 / 1200

  // reverse-image-search engines (find a higher-resolution copy of a cover) — each
  // opens pre-loaded with the cover's public URL, so there's no download + drop.
  const IMG_SEARCH_ENGINES = [
    { name: 'Yandex',      u: url => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(url)}` },
    { name: 'Google Lens', u: url => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}` },
    { name: 'TinEye',      u: url => `https://tineye.com/search?url=${encodeURIComponent(url)}&sort=size&order=desc` },   // biggest copy first
    { name: 'Bing',        u: url => `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encodeURIComponent(url)}` },
  ];

  // canonical MB art types per entity, in a sensible display order; "(none)" is virtual.
  // Event art has its own vocabulary (Poster/Flyer/Setlist/…) — wholly distinct from cover art.
  const COVER_ORDER = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Matrix/Runout', 'Top', 'Bottom', 'Other'];
  const COVER_TYPES = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Raw/Unedited', 'Matrix/Runout', 'Top', 'Bottom', 'Panel', 'Other'];
  const EVENT_TYPES = ['Poster', 'Flyer', 'Banner', 'Program', 'Setlist', 'Schedule', 'Ticket', 'Map', 'Logo', 'Merchandise', 'Raw/Unedited', 'Watermark'];
  const TYPE_ORDER = IS_EVENT ? EVENT_TYPES : COVER_ORDER;
  const ALL_TYPES  = IS_EVENT ? EVENT_TYPES : COVER_TYPES;
  const NO_TYPE = '(no type)';
  // neutral noun for a single artwork piece in UI labels: "cover" for releases,
  // "image" for events (an untyped event piece isn't a "cover").
  const ITEM = IS_EVENT ? 'image' : 'cover';
  const ITEMS = ITEM + 's';

  // #243 guess a cover type from the file name — "Folder"/"Cover" are the de-facto names
  // for the front; otherwise the type word appears in the name (back, booklet, obi, …).
  // First match wins, so order specific → general. Only types valid for this entity are used.
  const TYPE_FROM_NAME = [
    [/\b(front|folder|frontal|recto)\b|cover art|albumart/, 'Front'],
    [/\b(back|rear|verso|trasera)\b/, 'Back'],
    [/\b(booklet|inlay|libretto|insert)\b/, 'Booklet'],
    [/\btray\b/, 'Tray'], [/\bobi\b/, 'Obi'], [/\bspine\b/, 'Spine'], [/\bsticker\b/, 'Sticker'],
    [/\b(matrix|runout)\b/, 'Matrix/Runout'], [/\bliner\b/, 'Liner'], [/\bposter\b/, 'Poster'],
    [/\bcd\d*\b|\bdiscs?\b|\bdisk\b|\bvinyl\b|\bmedium\b|\blabel\b|\bside\s*[a-d0-9]/, 'Medium'],
    [/\btrack\b/, 'Track'], [/\btop\b/, 'Top'], [/\bbottom\b/, 'Bottom'], [/\b(raw|unedited)\b/, 'Raw/Unedited'], [/\bwatermark\b/, 'Watermark'],
    [/\bflyer\b/, 'Flyer'], [/\bticket\b/, 'Ticket'], [/\bsetlist\b/, 'Setlist'], [/\bbanner\b/, 'Banner'],
    [/\bprogram\b/, 'Program'], [/\bschedule\b/, 'Schedule'], [/\bmap\b/, 'Map'], [/\blogo\b/, 'Logo'], [/\bmerch/, 'Merchandise'],
    [/\bcover\b/, 'Front'],   // generic fallback (after Back etc.) so "cover.jpg" → Front but "back cover" → Back
  ];
  // exact download tokens → canonical type ("front"→Front, "raw_unedited"→Raw/Unedited), for round-tripping #244 names
  const TYPE_BY_TOKEN = {};
  [...COVER_TYPES, ...EVENT_TYPES].forEach(t => { TYPE_BY_TOKEN[t.toLowerCase().replace(/[\\/]/g, '_')] = t; });
  // #243/#244 parse a file name into { types[], comment }:
  //   "02 front,sticker some comment.jpg" → [Front,Sticker], "some comment"   (our download format)
  //   "booklet page 12" → [Booklet], "page 12"   ·   "page 12 booklet" → [Booklet], ""   (keyword + after)
  function parseName(name) {
    let base = String(name || '').replace(/\.[a-z0-9]+$/i, '').trim();
    base = base.replace(/^\s*\d+\s*[-_.)]*\s*/, '');   // strip a leading position number
    if (!base) return { types: [], comment: '' };
    // case A — leading comma-joined exact type tokens (no spaces), then the comment
    const sp = base.search(/\s/);
    const head = (sp < 0 ? base : base.slice(0, sp)).trim(), tail = sp < 0 ? '' : base.slice(sp + 1).trim();
    const tokens = head.split(',').map(t => t.trim()).filter(Boolean);
    const headTypes = tokens.map(t => TYPE_BY_TOKEN[t.toLowerCase()]);
    if (tokens.length && headTypes.every(Boolean)) return { types: headTypes.filter(t => ALL_TYPES.includes(t)), comment: tail };
    // case B — a fuzzy type keyword anywhere; the comment is whatever follows it
    const spaced = base.replace(/[^a-z0-9,]+/gi, ' ').replace(/\s+/g, ' ').trim(), lower = spaced.toLowerCase();
    for (const [re, t] of TYPE_FROM_NAME) {
      if (!ALL_TYPES.includes(t)) continue;
      const m = lower.match(re);
      if (m) return { types: [t], comment: spaced.slice(m.index + m[0].length).replace(/^[\s,]+/, '').trim() };
    }
    return { types: [], comment: '' };
  }

  let MODEL = [];       // [{ id, types:[], comment, order, w, h, bytes, _del, _new, _file }]
  let _booted = false;  // #283 emit the name+version / release log lines once
  const SIZES = new Map(); // CAA image id -> original file size in bytes (from archive.org metadata)
  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + 'Mb' : Math.max(1, Math.round(b / 1024)) + 'Kb';
  // footer line under the image: "1.2Mb   600 × 600" — size first, then resolution,
  // each half shown once known, separated by a wide gap (em-space).
  function dimText(it) {
    const parts = [];
    if (it.bytes) parts.push(fmtSize(it.bytes));
    if (it.w && it.h) parts.push(`${it.w} × ${it.h}`);
    return parts.length ? parts.join(' ') : '…';
  }
  // card-foot version: size + resolution as separate spans so they WRAP (stack) on a
  // narrow card instead of overflowing the tile.
  function dimHtml(it) {
    const parts = [];
    if (it.bytes) parts.push(`<span class="as-dim-sz">${fmtSize(it.bytes)}</span>`);
    if (it.w && it.h) parts.push(`<span class="as-dim-px">${it.w} × ${it.h}</span>`);
    return parts.join('') || '<span class="as-dim-sz">…</span>';
  }
  function refreshDim(it) {
    const el = document.querySelector(`.as-card[data-id="${CSS.escape(String(it.id))}"] .as-dim`);
    if (el) el.innerHTML = dimHtml(it);
  }
  // one request per release: archive.org item metadata carries every original's byte size
  async function loadSizes() {
    try {
      const j = await fetch(`https://archive.org/metadata/mbid-${MBID}`, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null);
      if (!j || !j.files) return;
      for (const f of j.files) {
        if (f.source !== 'original' || !f.size) continue;
        const m = String(f.name).match(/-(\d+)\.[a-z0-9]+$/i);
        if (m) SIZES.set(m[1], +f.size);
      }
      MODEL.forEach(it => { const b = SIZES.get(String(it.id)); if (b) { it.bytes = b; refreshDim(it); } });
      asLog.debug(`archive.org: loaded original file sizes (${SIZES.size})`);
    } catch (e) { asLog.debug('archive.org: metadata unavailable — ' + ((e && e.message) || e)); }   // size is a nicety — never block the gallery
  }
  let SETTINGS = load();
  function load() { const d = { tile: 200, group: false, sort: 'type', detailed: false, hideMbFooter: true, showOrig: false, autoType: true, autoComment: true, autoFront: true, autoFrontMode: 'whenNone', clearSelAfterOp: true }; try { return Object.assign(d, JSON.parse(localStorage.getItem('artstation:settings') || '{}')); } catch (e) { return d; } }
  function save() { try { localStorage.setItem('artstation:settings', JSON.stringify(SETTINGS)); } catch (e) {} }

  // ── data ───────────────────────────────────────────────────────────────────
  // MB's page (its DB) is the source of truth for the cover list — it includes images
  // that aren't on the Cover Art Archive yet (just added). CAA only enriches comments.
  function parsePageArt() {
    if (IS_ADD) return null;   // #248 the add page has no native gallery to parse — use CAA only
    const blocks = [...document.querySelectorAll('.artwork-cont')];
    if (!blocks.length) return null;
    return blocks.map((b, i) => {
      const ed = b.querySelector(`a[href*="/edit-${ART}/"]`);
      const m = ed && ed.getAttribute('href').match(new RegExp(`/edit-${ART}/(\\d+)`));
      if (!m) return null;
      // each piece is its own <p> — parse types from the "Types:" <p> ONLY (the comment
      // is a separate <p>, so reading the whole block grabbed it, e.g. "Types: -test")
      const ps = [...b.querySelectorAll('p')];
      const typeP = ps.find(p => /^\s*Types:/.test(p.textContent));
      const raw = typeP ? typeP.textContent.replace(/^\s*Types:\s*/, '').trim() : '';
      const types = (raw && raw !== '-') ? raw.split(',').map(s => s.trim()).filter(s => s && s !== '-') : [];
      const cmtP = ps.find(p => p !== typeP && p.textContent.trim() && !/All sizes:/i.test(p.textContent) && !/Dimensions:/i.test(p.textContent));
      const comment = cmtP ? cmtP.textContent.trim() : '';
      const orig = [...b.querySelectorAll('a')].find(a => a.textContent.trim().toLowerCase() === 'original');
      const img = orig ? new URL(orig.getAttribute('href'), location.href).href : '';
      const pdf = /\.pdf(\?|$)/i.test(img);
      return { id: m[1], types, comment, pending: b.classList.contains('mp'), pdf, img, order: i };
    }).filter(Boolean);
  }
  async function loadArt() {
    if (!_booted) {   // first two log lines: the script + version, then the MB entity
      _booted = true;
      asLog.info('Art Station' + ((_gm && _gm.version) ? ' v' + _gm.version : '') + (_mgr ? ' · ' + _mgr : ''));
      try { const ri = releaseInfo(); const t = (ri.title || '').trim(); asLog.info('Release: ' + (t ? t + ' — ' : '') + (ri.url || ('https://musicbrainz.org/' + ENT.kind + '/' + MBID))); } catch (e) { asLog.info('Release: https://musicbrainz.org/release/' + MBID); }
      if (loadLogWin().open) setTimeout(() => { try { openLog(); } catch (e) {} }, 600);   // #283 reopen the log if it was left open
    }
    const pageArt = parsePageArt();
    let caa = [];
    try { const j = await fetch(CAA, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null); if (j) caa = j.images || []; }
    catch (e) { asLog.debug('CAA: cover-art metadata fetch failed — ' + ((e && e.message) || e)); }   // not propagated / none yet
    const byId = new Map(caa.map(im => [String(im.id), im]));
    const source = (pageArt && pageArt.length)
      ? pageArt.map(p => ({ id: p.id, types: p.types, comment: p.comment || (byId.get(String(p.id)) || {}).comment || '', pending: p.pending, img: p.img || (byId.get(String(p.id)) || {}).image || imgUrl(p.id), pdf: p.pdf }))
      : caa.map(im => ({ id: im.id, types: (im.types || []).slice(), comment: im.comment || '', pending: false, img: im.image || imgUrl(im.id), pdf: /\.pdf(\?|$)/i.test(im.image || '') }));
    // a partial page parse (e.g. a block without an edit link) must not DROP a cover the
    // CAA knows about — append a CAA image missing from the parsed list. BUT only if the
    // page actually references that id somewhere (a block we failed to parse): a CAA image
    // absent from the page ENTIRELY is a stale CAA entry for a just-removed cover (MB's DB
    // drops it immediately while coverartarchive.org lags), and resurrecting it shows a
    // phantom that 404s when removed again. MB's page is authoritative for what exists. #264
    if (pageArt && pageArt.length && caa.length) {
      const have = new Set(source.map(s => String(s.id)));
      const pageRefs = (document.getElementById('content') || document.body).innerHTML;
      for (const im of caa) if (!have.has(String(im.id)) && pageRefs.includes(String(im.id))) source.push({ id: im.id, types: (im.types || []).slice(), comment: im.comment || '', pending: false, img: im.image || imgUrl(im.id), pdf: /\.pdf(\?|$)/i.test(im.image || '') });
    }
    MODEL = source.map((s, i) => ({
      id: s.id, types: s.types.slice(), comment: s.comment,
      order: i, w: 0, h: 0, _del: false, _new: false, _pending: !!s.pending, _pdf: !!s.pdf || /\.pdf(\?|$)/i.test(s.img || ''), _img: s.img,
      _origTypes: s.types.slice(), _origComment: s.comment, _origOrder: i,
    }));
    render();
    asLog.info(`Loaded ${MODEL.length} ${MODEL.length === 1 ? ITEM : ITEMS}`);
    MODEL.forEach(measure);   // lazy-fill dimensions
    loadSizes();              // lazy-fill file sizes (single archive.org request)
  }
  function measure(it) {
    if (it.w || (it._new && it._pdf)) return;          // measured already, or a PDF (no pixel dims)
    const src = it._new ? it._file : imgUrl(it.id);     // new covers measure from the local object URL
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      it.w = img.naturalWidth; it.h = img.naturalHeight; refreshDim(it);
      // dimension sort can't place a cover until its size is known — re-sort once it is
      if (SETTINGS.sort === 'dim') scheduleResort();
    };
    img.src = src;
  }
  // debounce: several new covers measure near-simultaneously; re-render the grid once
  let _resortT = null;
  function scheduleResort() { if (_resortT) return; _resortT = setTimeout(() => { _resortT = null; render(); }, 120); }

  const changed = it => it._del || it._new || it.comment !== it._origComment || it.order !== it._origOrder || it.types.join('|') !== it._origTypes.join('|');
  const stagedCount = () => MODEL.filter(changed).length;
  const selectable = () => MODEL.filter(it => !it._del);
  const allSelected = () => { const s = selectable(); return s.length > 0 && s.every(it => it._sel); };
  // reorder (drag) only in the canonical Position view — ungrouped + sorted by position.
  // Grouping is view-only; other sorts don't map to the committed order.
  const canReorder = () => !SETTINGS.group && !SETTINGS.detailed && SETTINGS.sort === 'type';

  // ── render ───────────────────────────────────────────────────────────────────
  const root = document.createElement('div'); root.id = 'as-root';
  let _mounted = false;
  let _showOrig = SETTINGS.showOrig;   // "Show original" — reveal MB's native UI; remembered across loads
  const _native = [];          // the native cover-art elements mount() hid, so we can show them again
  function mount() {
    if (_mounted) return; _mounted = true;
    const anchor = document.querySelector('#content') || document.body;
    // #230: sit BELOW the MB header + the entity tabs. ul.tabs is nested in a
    // div.tabs child of #content, so climb to that #content-level ancestor.
    const childOf = (el) => { if (!el) return null; let n = el; while (n.parentElement && n.parentElement !== anchor) n = n.parentElement; return n.parentElement === anchor ? n : null; };
    const afterTabs = childOf(anchor.querySelector('ul.tabs'));
    const afterH1 = childOf(anchor.querySelector('h1'));
    if (afterTabs) afterTabs.insertAdjacentElement('afterend', root);
    else if (afterH1) afterH1.insertAdjacentElement('afterend', root);
    else anchor.insertBefore(root, anchor.firstChild);
    // hide the native cover-art UI between the tabs and the page footer: the type
    // <h2>s, the .artwork-cont blocks and the trailing "These images…" note.
    const hide = el => { el.style.display = 'none'; _native.push(el); };
    if (IS_ADD) {
      // #248 full takeover: hide every #content child except the header, the tabs,
      // the title and our gallery. The uploader form is left alone — it's already
      // off-screen (addHide) and must stay live so seeds populate it for harvest.
      [...anchor.children].forEach(ch => {
        if (ch === root || ch === afterTabs || ch === afterH1) return;
        if (/^(SCRIPT|NOSCRIPT|STYLE|LINK)$/.test(ch.tagName)) return;
        if (ch.id === 'add-cover-art' || ch.id === 'add-event-art') return;   // the off-screen uploader (harvest source)
        if (ch.classList && ch.classList.contains('releaseheader')) return;
        hide(ch);
      });
    } else {
      [...anchor.children].forEach(ch => {
        if (ch === root || ch === afterTabs || ch === afterH1) return;
        if (ch.tagName === 'H2' || ch.tagName === 'P') hide(ch);
        else if (ch.querySelector && ch.querySelector('.artwork-cont')) hide(ch);
        else if (ch.classList && ch.classList.contains('artwork-cont')) hide(ch);
      });
      document.querySelectorAll('.artwork-cont').forEach(hide);
    }
  }
  // "Show original" (View): un-hide MB's native cover-art UI and collapse our
  // gallery to just the toolbar — like Apollo's native/script switcher. #234
  function applyOriginal() {
    earlyHide.disabled = _showOrig;                                  // the document-start hiding style
    if (addHide) addHide.disabled = _showOrig;                       // #248 reveal the native uploader in Original
    _native.forEach(el => { el.style.display = _showOrig ? '' : 'none'; });
    root.classList.toggle('as-orig', _showOrig);                     // hides the whole Art Station UI
    ensureSwitch();
    applyHideFooter();
  }
  // optional (setup): hide MB's native button row (Add / Reorder / Import from …)
  // under the gallery — redundant with Art Station's own toolbar. Revealed in Original.
  function applyHideFooter() {
    footerStyle.disabled = !(SETTINGS.hideMbFooter && !_showOrig);
  }
  // #234: an Apollo-style fixed switcher (bottom-right) toggling Original ⇄ Art
  // Station, plus a ⚙ setup button — always visible.
  function ensureSwitch() {
    let wrap = document.getElementById('as-switch-wrap');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'as-switch-wrap';
      const sw = document.createElement('button'); sw.id = 'as-switch';
      sw.onclick = () => { _showOrig = !_showOrig; SETTINGS.showOrig = _showOrig; save(); render(); };
      const gear = document.createElement('button'); gear.id = 'as-setup-btn'; gear.textContent = '⚙︎'; gear.title = 'Art Station setup';
      gear.onclick = openSetup;
      wrap.append(sw, gear); document.body.appendChild(wrap);   // label left, gear right — one pill
    }
    const sw = document.getElementById('as-switch');
    sw.textContent = _showOrig ? 'Art Station' : 'Original';
    sw.title = _showOrig ? 'Switch back to the Art Station gallery' : 'Show the original MusicBrainz cover-art page';
  }
  // setup panel (Apollo-style): script info + help + toggles
  function openSetup() {
    document.getElementById('as-setup')?.remove();
    const ver = (_gm && _gm.version) || '';
    const help = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/art_station/README.md';
    const panel = document.createElement('div'); panel.id = 'as-setup';
    panel.innerHTML = `<div class="as-setup-h"><img class="as-setup-ic" src="${ICON_URL}" alt=""><b>Art Station</b> <span class="as-setup-ver">v${esc(ver)}</span>`
      + `<button class="as-setup-logbtn" type="button" title="Open the activity log">Log</button>`
      + `<a class="as-setup-help" href="${help}" target="_blank" rel="noopener">Help ↗</a></div>`
      + `<div class="as-setup-body">`
      + `<label class="as-setup-opt"><input type="checkbox" class="as-setup-hidefoot"${SETTINGS.hideMbFooter ? ' checked' : ''}> Hide MB native buttons (Add / Reorder / Import…)</label>`
      + `<label class="as-setup-opt"><input type="checkbox" class="as-setup-autotype"${SETTINGS.autoType ? ' checked' : ''}> Set ${ITEM} type from the file name (Front, Back, Booklet…)</label>`
      + `<label class="as-setup-opt"><input type="checkbox" class="as-setup-autocomment"${SETTINGS.autoComment ? ' checked' : ''}> Set comment from the file name (text after the type)</label>`
      + `<div class="as-setup-opt"><label class="as-setup-optlbl"><input type="checkbox" class="as-setup-autofront"${SETTINGS.autoFront ? ' checked' : ''}> Set type to “Front” on first import</label>`
      + ` <select class="as-setup-autofront-mode"><option value="whenNone"${SETTINGS.autoFrontMode !== 'always' ? ' selected' : ''}>when none exists</option><option value="always"${SETTINGS.autoFrontMode === 'always' ? ' selected' : ''}>always</option></select></div>`
      + `<label class="as-setup-opt"><input type="checkbox" class="as-setup-clearsel"${SETTINGS.clearSelAfterOp ? ' checked' : ''}> Clear the selection after a batch action (type, comment, download, report)</label>`
      + `</div>`;
    document.body.appendChild(panel);
    panel.querySelector('.as-setup-hidefoot').onchange = e => { SETTINGS.hideMbFooter = e.target.checked; save(); applyHideFooter(); };
    panel.querySelector('.as-setup-autotype').onchange = e => { SETTINGS.autoType = e.target.checked; save(); };
    panel.querySelector('.as-setup-autocomment').onchange = e => { SETTINGS.autoComment = e.target.checked; save(); };
    panel.querySelector('.as-setup-autofront').onchange = e => { SETTINGS.autoFront = e.target.checked; save(); };
    panel.querySelector('.as-setup-autofront-mode').onchange = e => { SETTINGS.autoFrontMode = e.target.value; save(); };
    panel.querySelector('.as-setup-clearsel').onchange = e => { SETTINGS.clearSelAfterOp = e.target.checked; save(); };
    const off = e => { if (!panel.contains(e.target) && e.target.id !== 'as-setup-btn') { panel.remove(); document.removeEventListener('mousedown', off); } };
    panel.querySelector('.as-setup-logbtn').onclick = () => { panel.remove(); document.removeEventListener('mousedown', off); openLog(); };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }
  // #283 remember the log window across sessions: open?/minimized?/position
  const LOGWIN_KEY = 'artstation:logwin';
  const loadLogWin = () => { try { return JSON.parse(localStorage.getItem(LOGWIN_KEY) || '{}'); } catch (e) { return {}; } };
  const saveLogWin = (patch) => { try { localStorage.setItem(LOGWIN_KEY, JSON.stringify(Object.assign(loadLogWin(), patch))); } catch (e) {} };
  // #283 the Log button opens this popup: the full session log + a Copy control.
  function openLog() {
    document.getElementById('as-logpop')?.remove();
    saveLogWin({ open: true });
    const st = loadLogWin();
    const pop = document.createElement('div'); pop.id = 'as-logpop';
    pop.innerHTML = `<div class="as-logpop-h"><b>Activity log</b> <span class="as-log-badge"></span><span class="as-logpop-sp"></span>`
      + `<button class="as-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>`
      + `<button class="as-logpop-min" type="button" title="Minimize">–</button>`
      + `<button class="as-logpop-x" type="button" title="Close">✕</button></div>`
      + `<div class="as-log-list"></div>`;
    document.body.appendChild(pop);
    if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
    pop._restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
    const renderList = () => {
      const list = pop.querySelector('.as-log-list');
      list.innerHTML = LOG.length
        ? LOG.map(e => `<div class="as-log-li as-log-${e.sev}"><span class="as-log-t">${_ts(e.t)}</span><span class="as-log-m">${_logLinkify(e.msg)}</span></div>`).join('')
        : '<div class="as-log-empty">No activity yet.</div>';
      const c = logCounts();
      pop.querySelector('.as-log-badge').textContent = `(${LOG.length})` + (c.warn || c.error ? ` · ${c.warn}⚠ ${c.error}✖` : '');
      list.scrollTop = list.scrollHeight;
    };
    renderList();
    _logListeners.add(renderList);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { saveLogWin({ open: false }); _logListeners.delete(renderList); pop.remove(); document.removeEventListener('keydown', onKey); };
    pop.querySelector('.as-logpop-copy').onclick = () => copyLog(pop.querySelector('.as-logpop-copy'));
    const minBtn = pop.querySelector('.as-logpop-min');
    const setMin = (m) => {
      minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
      if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to bottom
      else if (pop._restore) { Object.assign(pop.style, pop._restore); }
    };
    minBtn.onclick = () => { const m = pop.classList.toggle('min'); setMin(m); saveLogWin({ min: m }); };
    if (st.min) { pop.classList.add('min'); setMin(true); }   // restore minimized state
    pop.querySelector('.as-logpop-x').onclick = close;
    // floating, non-modal window — draggable by its header
    pop.querySelector('.as-logpop-h').addEventListener('mousedown', (e) => {
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
  // at big tile sizes the selection outline alone is plenty obvious, so drop the
  // per-card ✓ badge — keeps large artwork uncluttered. #234
  function applyZoomClass() { root.classList.toggle('as-zoomed', SETTINGS.tile >= 280); }

  function render() {
    mount();
    const y = window.scrollY;            // keep the viewport put — rebuilding innerHTML must not jump the page
    const n = opsCount();
    const groups = grouped();
    // #238 Detailed view: a flat list, image left + all type checkboxes & the full
    // comment beside it (read long comments / see every type without the popover).
    const body = SETTINGS.detailed
      ? `<div class="as-dlist">${MODEL.filter(it => !it._del).slice().sort(sortFn).map(detailRow).join('')}</div>`
      : SETTINGS.group
        ? groups.map(g => groupRow(g.type, g.items)).join('')   // compact: label column + cards beside it
        : groups.map(g => section(g.type, g.items)).join('');
    root.innerHTML = bar(n) + commentPresets() + dropZone() + newSection() + body + deletedSection();
    wire();
    hydrateImgs();     // re-attach cached <img> for new/pending covers so they don't reload
    applyOriginal();   // keep the native/script view state across re-renders
    applyZoomClass();
    fitTypePills();    // show as many types as the pill width allows
    fitFooters();      // hide a comment that can't fit even a few chars (no ugly sliver)
    fitToolbar();      // icon-only buttons if the toolbar would otherwise wrap
    if (window.scrollY !== y) window.scrollTo(0, y);
  }
  // #234: a grid card's type pill shows as many of its types as fit on one line;
  // a trailing "+" appears only when some types are hidden for lack of space.
  function fitTypePills() {
    root.querySelectorAll('.as-foot-type .as-type').forEach(pill => {
      if (pill.classList.contains('as-type-add')) return;   // untyped placeholder
      const it = byId(cardId(pill)); if (!it || !it.types.length) return;
      const types = it.types;
      pill.textContent = types.join(', ');
      let n = types.length;
      while (n > 1 && pill.scrollWidth > pill.clientWidth) { n--; pill.textContent = types.slice(0, n).join(', ') + ' +'; }
    });
  }
  // the comment shares the footer row with the dimensions; on a narrow card the
  // dimensions win and the comment can be squeezed to a 1-2px sliver of a glyph.
  // Hide it entirely below a readable width rather than show that sliver.
  function fitFooters() {
    root.querySelectorAll('.as-card .as-foot-cmt').forEach(cmt => {
      cmt.classList.remove('as-cmt-collapsed');
      const txt = cmt.querySelector('.as-cmt-text'); if (!txt) return;   // empty comment (hover pencil)
      // hide ONLY a comment clipped to an unreadable sliver — a SHORT comment that fully
      // fits (e.g. "A") keeps a narrow column but must still show (and stay clickable).
      if (txt.scrollWidth > txt.clientWidth + 1 && cmt.clientWidth < 24) cmt.classList.add('as-cmt-collapsed');
    });
  }
  // shared autocomplete of the comments already used on this release (#238 presets)
  function commentPresets() {
    const seen = [...new Set(MODEL.map(it => (it.comment || '').trim()).filter(Boolean))];
    return `<datalist id="as-cmt-presets">${seen.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>`;
  }

  function grouped() {
    if (!SETTINGS.group) {
      // Position view (committed order): new uploads sit INLINE, positioned among covers
      const items = MODEL.filter(it => !it._del).slice().sort(sortFn);
      return [{ type: null, items }];
    }
    // group mode is view-only; new uploads get their own section on top (see newSection)
    let items = MODEL.filter(it => !it._del && !it._new);
    // group by primary type; untyped → NO_TYPE; order groups by TYPE_ORDER then alpha
    const map = new Map();
    for (const it of items) { const t = (it.types[0] || NO_TYPE); if (!map.has(t)) map.set(t, []); map.get(t).push(it); }
    const keys = [...map.keys()].sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
      if (a === NO_TYPE) return 1; if (b === NO_TYPE) return -1;
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    for (const k of keys) map.get(k).sort(sortFn);
    return keys.map(k => ({ type: k, items: map.get(k) }));
  }
  const typeRank = t => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? 99 : i; };
  function sortFn(a, b) {
    // the still-sourcing placeholder (no image/dims yet) always leads so its progress
    // shows; everything else — INCLUDING real new covers — takes part in the chosen sort.
    if (!!a._sourcing !== !!b._sourcing) return a._sourcing ? -1 : 1;
    if (SETTINGS.sort === 'newest') {
      // staged new covers ARE the newest → they lead (insertion order); existing by CAA id desc
      if (!!a._new !== !!b._new) return a._new ? -1 : 1;
      if (a._new) return a.order - b.order;
      return b.id - a.id;
    }
    if (SETTINGS.sort === 'bytype') return typeRank(a.types[0] || '') - typeRank(b.types[0] || '') || a.order - b.order;
    if (SETTINGS.sort === 'dim') return (b.w * b.h) - (a.w * a.h) || a.order - b.order;
    return a.order - b.order;   // position (committed order) — new covers have low order, so still lead
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function bar(n) {
    return `<div class="as-bar">
      <button class="as-btn as-add" title="Add ${ENT.noun} — file drop zone (goes first)"><span class="as-bi">＋</span><span class="as-bt">Add image</span></button>
      ${IS_EVENT ? '' : `<button class="as-btn as-mh" title="MH Covers — source a cover from covers.musichoarders.xyz (#235)"><img class="as-mh-ic" src="https://covers.musichoarders.xyz/favicon.svg" alt="MH" width="18" height="18"></button>`}
      <button class="as-btn as-src" title="Source ${ENT.noun} from a linked platform, a registered provider, or any URL"><span class="as-bi">🔗</span><span class="as-bt">URL</span><span class="as-src-n"></span></button>
      <span class="as-ctl"><span class="as-bt">Size</span> <input class="as-size" type="range" min="120" max="340" value="${SETTINGS.tile}" title="Thumbnail size — scroll the wheel over the slider, or hold right-click and scroll the wheel anywhere in the gallery"></span>
      <button class="as-btn as-view" title="Sort & grouping">View ▾</button>
      ${!canReorder() ? '<span class="as-dragwarn" title="Drag-to-reorder is off — it works only with Sort = Position and Grid view. Click to set view.">⚠</span>' : ''}
      <span class="as-selbox">${selBox()}</span>
      <button class="as-btn as-commit" title="Review &amp; apply staged changes as MusicBrainz edits"${n?'':' disabled'}>${commitInner(n)}</button>
    </div>`;
  }
  const commitInner = n => `<span class="as-bi">✓</span><span class="as-bt">Enter edit</span>${n ? ` <span class="as-cnt2">(${n})</span>` : ''}`;
  // #234: the selection cluster lives in the center of the main toolbar (the old
  // bottom bulk bar is gone). syncSel() rebuilds just this span in place so
  // right-click paint-select never reflows the grid.
  function selBox() {
    const sel = MODEL.filter(it => it._sel && !it._del);
    return `${sel.length ? `<b class="as-selcnt">${sel.length} selected</b>` : '<span class="as-selcnt none">none selected</span>'}
      <button class="as-ic as-selall" title="Select all ${ITEMS}">✳</button>
      <button class="as-ic as-selclr" title="Clear selection"${sel.length ? '' : ' disabled'}>✕</button>
      ${sel.length ? `<button class="as-btn as-bk-type" title="Set type on the selection">Type ▾</button>
      <button class="as-btn as-bk-cmt" title="Set a comment on the selection"><span class="as-bi">✎</span><span class="as-bt">Comment ▾</span></button>
      <button class="as-btn as-bk-dl" title="Download the selected ${ITEMS}"><span class="as-bi">⬇</span><span class="as-bt">Download</span></button>
      <button class="as-btn as-bk-report" title="Postable Markdown / HTML report of the selection"><span class="as-bi">📋</span><span class="as-bt">Report</span></button>
      <button class="as-btn as-bk-rm" title="Mark the selected ${ITEMS} for removal"><span class="as-bi">🗑️</span><span class="as-bt">Delete</span></button>` : ''}`;
  }
  function section(type, items) {
    const label = type === null ? ('All ' + ITEMS) : type;
    return `<div class="as-sec"><h3>${esc(label)}</h3><span class="as-cnt">${items.length}</span><span class="as-line"></span></div>
      <div class="as-grid" data-group="${esc(type||'')}">${items.map(card).join('')}</div>`;
  }
  // compact group: type label in a left column, cards flow beside it (no full-width waste)
  function groupRow(type, items) {
    const label = type === NO_TYPE ? 'No type' : type;
    return `<div class="as-grow"><div class="as-glabel"><span class="as-gl-name">${esc(label)}</span><span class="as-gl-cnt">${items.length}</span></div>
      <div class="as-grid" data-group="${esc(type||'')}">${items.map(card).join('')}</div></div>`;
  }
  function dropZone() {
    if (!_dropZone) return '';
    return `<div class="as-dropzone" tabindex="0" title="drop image / PDF files, or click to browse">
      <div class="as-dz-in">⬇ Drop ${ENT.noun} files here<span>or click to browse · new ${ITEMS} go first</span></div></div>`;
  }
  function newSection() {
    if (!SETTINGS.group) return '';   // Position view shows new uploads inline, positioned among covers
    // group view excludes _new covers from the type groups, so the New uploads section
    // is the ONLY place they show — include in-progress sourcing placeholders too, or
    // a URL/ECAU/MH import would add nothing visible while it works.
    const news = MODEL.filter(it => it._new && !it._del).sort((a, b) => a.order - b.order);
    if (!news.length) return '';
    return `<div class="as-sec as-sec-new"><h3>New uploads</h3><span class="as-cnt">${news.length}</span><span class="as-line"></span></div>
      <div class="as-grid">${news.map(card).join('')}</div>`;
  }
  function deletedSection() {
    const dels = MODEL.filter(it => it._del);
    if (!dels.length) return '';
    const body = SETTINGS.detailed   // match the current view — detail rows, not grid cards
      ? `<div class="as-dlist">${dels.map(detailRow).join('')}</div>`
      : `<div class="as-grid">${dels.map(card).join('')}</div>`;
    return `<div class="as-sec as-sec-del"><h3>Marked for removal</h3><span class="as-cnt">${dels.length}</span><span class="as-line"></span></div>${body}`;
  }
  // Stable CAA thumbnails are HTTP-cached, so recreating their <img> on each
  // render is cheap and flicker-free. NEW (blob) and PENDING (no CAA thumb yet →
  // the thumb 404s and we fall back to the full original) covers, though, visibly
  // RELOAD on every render — type change, resize, anything. So we keep ONE live
  // <img> per such cover in _imgCache and re-attach the already-decoded node into
  // a host slot after each render instead of building a fresh one. (covers "reload
  // in place" — #235)
  const _imgCache = new Map();
  function thumbImg(it, size) {
    if (it._new || it._pending) return `<span class="as-imghost" data-host="${esc(it.id)}" data-size="${size}"></span>`;
    return `<img loading="lazy" draggable="false" src="${esc(thumb(it.id, size))}" alt="">`;
  }
  function hydrateImgs() {
    root.querySelectorAll('.as-imghost[data-host]').forEach(host => {
      const id = host.dataset.host, size = +host.dataset.size, it = byId(id);
      if (!it) return;
      let img = _imgCache.get(String(id));
      if (!img) {                                  // first sighting — build + load it once
        img = new Image(); img.loading = 'lazy'; img.draggable = false; img.alt = '';
        img.onerror = () => {                      // pending thumb not ready → show the original
          if (it._new) { img.closest('.as-thumb, .as-dthumb')?.classList.add('na', 'as-na-new'); return; }   // #250 a staged blob that won't decode — no CAA fallback exists
          const orig = !it._pdf ? (it._img || imgUrl(it.id)) : null;
          if (orig && img.getAttribute('src') !== orig) img.src = orig;
          else img.closest('.as-thumb, .as-dthumb')?.classList.add('na');
        };
        img.src = it._new ? it._file : thumb(it.id, size);
        _imgCache.set(String(id), img);
      }
      host.replaceWith(img);                       // re-attach the cached (decoded) node — no reload
    });
  }
  // #249 a small favicon chip in the cover's bottom-left corner naming where a
  // newly-sourced image came from (ECAU provider / MH Covers), shown until commit.
  function provBadge(it) {
    if (!(it._new && it._provIcon)) return '';
    const tip = `Sourced from ${it._provider || 'provider'}` + (it._provUrl ? `\n${it._provUrl}` : '');   // #249 URL on a second line
    return `<span class="as-prov" title="${esc(tip)}"><img src="${esc(it._provIcon)}" alt=""></span>`;
  }
  // #248 (vzell) tooltip for a locally-uploaded cover — its original file name.
  const uploadTip = it => (it._new && it._uploadName) ? ` title="${esc(it._uploadName)}"` : '';
  function card(it) {
    if (it._sourcing) return `<div class="as-card new as-sourcing" data-id="${esc(it.id)}" title="${esc(it._srcLabel || 'Sourcing…')}">`
      + `<div class="as-srcing-thumb"><div class="as-spinner"></div><div class="as-srcing-lbl">${esc(it._srcLabel || 'Sourcing…')}</div></div></div>`;
    return `<div class="as-card${it._del?' del':''}${it._new?' new':''}${it._sel?' sel':''}${it._pending?' pending':''}" data-id="${esc(it.id)}" ${(!it._del && canReorder())?'draggable="true"':''}>
      <div class="as-thumb"${uploadTip(it)}>${thumbImg(it, SETTINGS.tile > 260 ? 500 : 250)}
        ${it._new ? '<span class="as-newban">NEW</span>' : ''}
        ${it._pdf ? '<span class="as-pdfban" title="PDF — opens in a new tab">PDF</span>' : ''}
        ${provBadge(it)}
        ${it._del ? '<button class="as-tbtn as-undo" title="keep this image">↺ keep</button>' : ''}
      </div>
      ${foot(it)}
      <span class="as-selmark">✓</span>
    </div>`;
  }
  // #234: footer below the image (mockup-driven). Row 1 = the comment on the
  // left + "dimensions · size" on the right — sharing one row means an empty
  // comment costs no extra height. Row 2 = the type as a centered pill on a
  // divider line at the card's bottom (first type only, "+" when there are
  // more). Empty comment → a hover-only ✎; untyped → a faint ＋ pill.
  function foot(it) {
    const firstType = it.types[0] || '';
    // seed with the full list; fitTypePills() trims to what fits and adds "+" if needed
    const typePill = firstType
      ? `<span class="as-type" title="${esc(it.types.join(', '))}">${esc(it.types.join(', '))}</span>`
      : `<span class="as-type as-type-add" title="set type">＋ type</span>`;
    const typeRow = `<div class="as-foot-type"><span class="as-tline"></span>${typePill}<span class="as-tline"></span></div>`;
    const dim = `<span class="as-dim">${dimHtml(it)}</span>`;
    if (it._del) return `<div class="as-foot"><div class="as-foot-row"><span class="as-foot-cmt"></span>${dim}</div>${typeRow}</div>`;
    const cmt = it._editcmt
      ? `<input class="as-cmt" value="${esc(it.comment)}" placeholder="comment…" list="as-cmt-presets">`
      : (it.comment
          ? `<span class="as-cmt-text" title="edit comment">${esc(it.comment)}</span>`
          : `<button class="as-pencil" title="add a comment">✎</button>`);
    // reverse-image search this cover — flat magnifier, hover-revealed, in the comment
    // row. Shown for any cover with a public URL: a published cover, or a new cover
    // sourced from a URL (a purely local dropped file has no URL to search by).
    const search = searchUrlFor(it)
      ? `<button class="as-fsearch" title="Search the web for a higher-resolution copy of this image"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg></button>` : '';
    return `<div class="as-foot">
      <div class="as-foot-row"><span class="as-foot-cmt">${cmt}</span>${search}${dim}</div>
      ${typeRow}
    </div>`;
  }
  // #238 Detailed view row: image + id on the left, all type checkboxes and the
  // full comment field beside it. No per-row toolbar actions (selection / delete
  // live on the main toolbar).
  function detailRow(it) {
    if (it._sourcing) return `<div class="as-drow new as-sourcing" data-id="${esc(it.id)}" title="${esc(it._srcLabel || 'Sourcing…')}">
      <div class="as-dthumb as-srcing-thumb"><div class="as-spinner"></div></div>
      <div class="as-dmeta"><div class="as-srcing-lbl">${esc(it._srcLabel || 'Sourcing…')}</div></div></div>`;
    if (it._del) return `<div class="as-drow del" data-id="${esc(it.id)}">
      <span class="as-dsel-x">✕</span>
      <div class="as-dleft">
        <div class="as-dthumb">${it._new ? '<span class="as-newban">NEW</span>' : ''}${thumbImg(it, 250)}${it._pdf ? '<span class="as-pdfban">PDF</span>' : ''}</div>
        <div class="as-dcap"><span class="as-dim">${esc(dimText(it))}</span></div>
        ${it._new ? '' : `<div class="as-did">#${esc(it.id)}</div>`}
      </div>
      <div class="as-dmeta as-dmeta-del">
        <div class="as-ddel-lbl">${esc(it.types.join(', ') || 'no type')}${it.comment ? ` — “${esc(it.comment)}”` : ''}</div>
        <button class="as-tbtn as-undo" title="keep this image">↺ keep</button>
      </div>
    </div>`;
    const types = ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"${it.types.includes(t) ? ' checked' : ''}> ${esc(t)}</label>`).join('');
    return `<div class="as-drow${it._new ? ' new' : ''}${it._pending ? ' pending' : ''}${it._sel ? ' sel' : ''}" data-id="${esc(it.id)}">
      <input type="checkbox" class="as-dsel" title="select"${it._sel ? ' checked' : ''}>
      <div class="as-dleft">
        <div class="as-dthumb"${uploadTip(it)}>${it._new ? '<span class="as-newban">NEW</span>' : ''}${thumbImg(it, 250)}${provBadge(it)}${it._pdf ? '<span class="as-pdfban" title="PDF — opens in a new tab">PDF</span>' : ''}</div>
        <div class="as-dcap"><span class="as-dim">${esc(dimText(it))}</span></div>
        ${it._new ? '' : `<div class="as-did">#${esc(it.id)}</div>`}
      </div>
      <div class="as-dmeta">
        <div class="as-dlbl">Types</div>
        <div class="as-dtypes">${types}</div>
        <input class="as-dcmt" value="${esc(it.comment)}" placeholder="comment…" list="as-cmt-presets" spellcheck="false">
      </div>
    </div>`;
  }

  // ── interaction ───────────────────────────────────────────────────────────────
  function byId(id) { return MODEL.find(it => String(it.id) === String(id)); }
  function cardId(el) { const c = el.closest('.as-card, .as-drow'); return c ? c.dataset.id : null; }

  // Wire the comment controls. #234 split the footer (pencil on row 1, comment
  // on row 2 which only exists when there's a comment), so entering/leaving edit
  // re-renders — render() keeps the viewport put, so the page still doesn't jump.
  // focus a comment input with the caret at the END — re-rendering then plain .focus()
  // drops the cursor at position 0, which is jarring when editing an existing comment.
  const focusCmtEnd = inp => { if (!inp) return; inp.focus(); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} };
  function wireComments() {
    root.querySelectorAll('.as-fsearch').forEach(b => b.onclick = e => { e.stopPropagation(); openImageSearchPop(b, byId(cardId(b))); });
    root.querySelectorAll('.as-pencil, .as-cmt-text').forEach(el => el.onclick = e => {
      e.stopPropagation(); const it = byId(cardId(el)); if (!it) return;
      it._editcmt = true; render();
      focusCmtEnd(root.querySelector(`.as-card[data-id="${CSS.escape(String(it.id))}"] .as-cmt`));
    });
    root.querySelectorAll('.as-cmt').forEach(inp => {
      inp.oninput = () => { const it = byId(cardId(inp)); if (it) { it.comment = inp.value; refreshStaged(); } };
      inp.onblur = () => { const it = byId(cardId(inp)); if (it) { it._editcmt = false; render(); } };
      // Enter saves and jumps to the NEXT card's comment (Escape just bails out).
      inp.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); inp.blur(); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const it = byId(cardId(inp)); if (!it) return;
        it.comment = inp.value; it._editcmt = false;
        inp.onblur = null;   // we drive the transition — don't let the stale blur double-render
        const cards = [...root.querySelectorAll('.as-card:not(.del)')];
        const idx = cards.findIndex(c => c.dataset.id === String(it.id));
        const nextIt = (idx >= 0 && cards[idx + 1]) ? byId(cards[idx + 1].dataset.id) : null;
        if (nextIt) nextIt._editcmt = true;
        refreshStaged(); render();
        if (nextIt) focusCmtEnd(root.querySelector(`.as-card[data-id="${CSS.escape(String(nextIt.id))}"] .as-cmt`));
      };
    });
  }

  // #238 wire the detailed-view rows: thumbnail → lightbox, inline type checkboxes,
  // and the comment field — all editing the model in place (no re-render, no jump).
  function wireDetail() {
    root.querySelectorAll('.as-drow').forEach(row => {
      const it = byId(row.dataset.id); if (!it) return;
      const th = row.querySelector('.as-dthumb');
      if (th) {
        th.onclick = e => { if (e.target.closest('button')) return; if (it._pdf) window.open(it._img, '_blank', 'noopener'); else openLightbox(it.id); };
        const img = th.querySelector(':scope > img');   // #250 gallery img only — never the .as-prov favicon (see wire())
        if (img) {
          img.onerror = () => { const orig = !it._pdf ? (it._img || imgUrl(it.id)) : null; if (orig && img.getAttribute('src') !== orig) img.src = orig; else th.classList.add('na'); };
          if (img.complete && !img.naturalWidth && img.getAttribute('src')) img.onerror();
        }
      }
      row.querySelectorAll('.as-dtypes input').forEach(cb => cb.onchange = () => {
        it.types = ALL_TYPES.filter(t => row.querySelector(`.as-dtypes input[value="${CSS.escape(t)}"]`).checked);
        refreshStaged();
      });
      const cmt = row.querySelector('.as-dcmt');
      if (cmt) {
        cmt.oninput = () => { it.comment = cmt.value; refreshStaged(); };
        // Enter jumps to the NEXT row's comment (Escape bails) — matches the grid.
        // Detailed view edits in place, so just move focus (no re-render).
        cmt.onkeydown = e => {
          if (e.key === 'Escape') { e.preventDefault(); cmt.blur(); return; }
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const rows = [...root.querySelectorAll('.as-drow:not(.del)')];
          const idx = rows.findIndex(r => r.dataset.id === String(it.id));
          const nc = (idx >= 0 && rows[idx + 1]) ? rows[idx + 1].querySelector('.as-dcmt') : null;
          if (nc) { nc.focus(); nc.select(); } else cmt.blur();
        };
      }
      // selection: the checkbox is the certain indicator; right-click also paints
      const sel = row.querySelector('.as-dsel');
      if (sel) sel.onchange = () => { it._sel = sel.checked; row.classList.toggle('sel', it._sel); syncSel(); };
      row.onmousedown = e => { if (e.button !== 2) return; e.preventDefault(); _paint = { value: !it._sel, cards: [] }; paintCard(row); };
    });
  }

  // bump the thumbnail size by one notch (dir +1 bigger / -1 smaller), update the live
  // CSS var + slider, and persist/re-fit once changes settle. Shared by the size slider's
  // wheel and the right-click+wheel gallery shortcut (#259).
  let _szT = null;
  function resizeTile(dir) {
    SETTINGS.tile = Math.max(120, Math.min(340, SETTINGS.tile + (dir > 0 ? 25 : -25)));   // #259 bigger step → less scrolling
    const sizeEl = root.querySelector('.as-size'); if (sizeEl) sizeEl.value = SETTINGS.tile;
    document.documentElement.style.setProperty('--as-tile', SETTINGS.tile + 'px'); applyZoomClass(); fitTypePills(); fitFooters();
    clearTimeout(_szT); _szT = setTimeout(() => { save(); render(); }, 250);   // persist + re-fit once scrolling settles
  }
  function wire() {
    const sizeEl = root.querySelector('.as-size');
    sizeEl.oninput = e => { SETTINGS.tile = +e.target.value; document.documentElement.style.setProperty('--as-tile', SETTINGS.tile + 'px'); applyZoomClass(); fitTypePills(); };
    sizeEl.onchange = () => { save(); render(); };
    // scroll the wheel over the slider to resize (no need to drag it)
    sizeEl.onwheel = e => { e.preventDefault(); e.stopPropagation(); resizeTile(e.deltaY < 0 ? 1 : -1); };   // stopProp: don't also trigger the RMB+wheel root handler (#259)
    const view = root.querySelector('.as-view'); if (view) view.onclick = e => { e.stopPropagation(); openViewPop(view); };
    const dw = root.querySelector('.as-dragwarn'); if (dw) dw.onclick = () => { SETTINGS.detailed = false; SETTINGS.group = false; SETTINGS.sort = 'type'; save(); render(); };
    root.querySelector('.as-add').onclick = toggleDropZone;
    const mh = root.querySelector('.as-mh'); if (mh) mh.onclick = openMHCovers;
    const src = root.querySelector('.as-src');
    if (src) {
      src.onclick = e => { e.stopPropagation(); openSourcePop(src); };
      refreshSrcCount();   // show how many import sources are available on the button: "URL (3)"
    }
    const mhIc = root.querySelector('.as-mh-ic'); if (mhIc) mhIc.onerror = () => mhIc.replaceWith(document.createTextNode('🔍'));
    root.querySelectorAll('.as-prov img').forEach(img => img.onerror = () => { const s = img.closest('.as-prov'); if (s) s.style.display = 'none'; });   // #249 hide a missing provider favicon
    const commit = root.querySelector('.as-commit'); if (commit && !commit.disabled) commit.onclick = enterEdit;

    root.querySelectorAll('.as-undo').forEach(b => b.onclick = e => { e.stopPropagation(); const it = byId(cardId(e.target)); if (it) { it._del = false; render(); } });
    wireComments();
    wireDetail();

    const dz = root.querySelector('.as-dropzone');
    if (dz) {
      dz.onclick = pickFiles;
      dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = async e => { e.preventDefault(); dz.classList.remove('over'); addFiles(await filesFromDrop(e.dataTransfer)); };
    }

    // type pill → popover
    root.querySelectorAll('.as-type').forEach(ch => ch.onclick = e => { e.stopPropagation(); openTypePop(ch); });
    // click the THUMB (not just the <img>, which is display:none on a not-yet-propagated
    // cover) → lightbox; PDFs open in a new tab. right-click card → toggle selection
    root.querySelectorAll('.as-thumb').forEach(th => {
      th.onclick = e => { if (e.target.closest('button') || _lpSwallow) return; const it = byId(cardId(e.target)); if (!it) return; if (it._pdf) window.open(it._img, '_blank', 'noopener'); else openLightbox(it.id); };
      // #250 (vzell) only wire the GALLERY image, which is a direct child of the thumb.
      // A new cover's gallery <img> isn't here yet (it's an .as-imghost placeholder until
      // hydrateImgs runs), and the only <img> present is the provider-badge favicon nested
      // in .as-prov — a plain querySelector('img') grabbed THAT, so a 404 favicon fired
      // this onerror and added .na, whose CSS hid the real JPEG. `:scope > img` never
      // matches the badge; new covers are left to hydrateImgs, which owns their onerror.
      const img = th.querySelector(':scope > img'); if (!img) return;
      // A freshly-added cover has its original uploaded but the CAA thumbnails
      // (250/500) aren't generated yet — so the thumb URL 404s and native MB
      // shows a placeholder. We can do better: fall back to the full original
      // (the same URL the lightbox uses), so the image shows in the gallery.
      // Only show the "not on CAA" placeholder if the original 404s too. PDFs
      // can't render as <img>, so they keep the placeholder.
      img.onerror = () => {
        const it = byId(cardId(img));
        const orig = it && !it._pdf ? (it._img || imgUrl(it.id)) : null;
        if (orig && img.getAttribute('src') !== orig) img.src = orig;
        else th.classList.add('na');
      };
      if (img.complete && !img.naturalWidth && img.getAttribute('src')) img.onerror();
    });
    // right-button paint-select IN PLACE — no render(), so the page never jumps.
    // down toggles the start card; holding right + moving paints the same state on hovered cards.
    root.querySelectorAll('.as-card').forEach(c => {
      c.onmousedown = e => {
        if (e.button !== 2 || c.classList.contains('del')) return;
        e.preventDefault(); const it = byId(c.dataset.id); if (!it) return;
        _paint = { value: !it._sel, cards: [] }; paintCard(c);
      };
      wireCardTouch(c);   // #251 long-press to select, drag-handle to reorder (mobile)
    });
    wireSel();
    wireDrag();
    markCursor();
  }
  function wireSel() {
    const q = s => root.querySelector(s);
    q('.as-selall') && (q('.as-selall').onclick = () => { selectable().forEach(it => it._sel = true); root.querySelectorAll('.as-card:not(.del), .as-drow').forEach(c => c.classList.add('sel')); root.querySelectorAll('.as-dsel').forEach(cb => cb.checked = true); syncSel(); });
    q('.as-selclr') && (q('.as-selclr').onclick = () => clearSel());
    q('.as-bk-rm')  && (q('.as-bk-rm').onclick  = () => { let n = 0; MODEL.forEach(it => { if (it._sel) { it._del = true; it._sel = false; n++; } }); asLog.info(`Batch: marked ${n} ${n === 1 ? ITEM : ITEMS} for removal`); render(); });
    q('.as-bk-dl')  && (q('.as-bk-dl').onclick  = async e => {
      const sel = MODEL.filter(it => it._sel && !it._del && !it._sourcing); if (!sel.length) return;   // include NEW covers (download their local blob)
      if (sel.length === 1) { dlOne(sel[0]); maybeClearSel(); return; }   // single → save the image directly
      const b = e.currentTarget, lbl = b.querySelector('.as-bt'), old = lbl ? lbl.textContent : '';
      b.disabled = true; if (lbl) lbl.style.display = 'inline';   // show progress even in compact mode
      const prog = (d, t) => { if (lbl) lbl.textContent = `Zipping ${d}/${t}…`; };
      prog(0, sel.length);
      try { await dlZip(sel, prog); } finally { b.disabled = false; if (lbl) { lbl.textContent = old; lbl.style.display = ''; } }   // multiple → one .zip (#240)
      maybeClearSel();   // #277
    });
    q('.as-bk-type') && (q('.as-bk-type').onclick = e => { e.stopPropagation(); openBulkTypePop(q('.as-bk-type')); });
    q('.as-bk-cmt') && (q('.as-bk-cmt').onclick = e => { e.stopPropagation(); openBulkCommentPop(q('.as-bk-cmt')); });
    q('.as-bk-report') && (q('.as-bk-report').onclick = e => { e.stopPropagation(); openReport(); });
  }
  // right-button paint selection (held + move)
  let _paint = null;
  function paintCard(c) {
    if (!c || !_paint || c.classList.contains('del')) return;
    const it = byId(c.dataset.id); if (!it || it._sel === _paint.value) return;
    it._sel = _paint.value; c.classList.toggle('sel', it._sel);
    const cb = c.querySelector('.as-dsel'); if (cb) cb.checked = it._sel;   // keep the row checkbox in sync
    _paint.cards.push(c);
    syncSel();
  }
  // #259 the right-click+wheel resize shares the RMB-down with paint-select; if the user
  // wheels, the gesture was a resize, so undo any cards toggled on the way in.
  function cancelPaint() {
    if (!_paint) return;
    const prev = !_paint.value;
    for (const c of _paint.cards) { const it = byId(c.dataset.id); if (!it) continue; it._sel = prev; c.classList.toggle('sel', it._sel); const cb = c.querySelector('.as-dsel'); if (cb) cb.checked = it._sel; }
    _paint = null; syncSel();
  }
  document.addEventListener('mousemove', e => {
    if (!_paint || !e.buttons) return;   // e.buttons falls to 0 if the button was released off-window
    const c = e.target.closest && e.target.closest('.as-card, .as-drow');
    if (c && root.contains(c)) paintCard(c);
  });
  document.addEventListener('mouseup', e => { _paint = null; if (e.button === 2) _rmb = false; });
  // #259 hold the right mouse button and scroll the wheel anywhere in the gallery to set
  // thumbnail size. RMB is also paint-select, so a wheel cancels the in-flight select.
  let _rmb = false;
  root.addEventListener('mousedown', e => { if (e.button === 2) _rmb = true; });
  window.addEventListener('blur', () => { _rmb = false; });
  root.addEventListener('wheel', e => {
    if (!_rmb) return;
    e.preventDefault();              // don't scroll the page while resizing
    cancelPaint();                   // the RMB-down was the start of a resize, not a select
    resizeTile(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  // ── #251 touch support: long-press to select, long-press-then-drag to reorder ───
  // A tap opens the viewer; _lpSwallow eats the click synthesised after a long-press
  // so it doesn't ALSO open the viewer.
  let _lpSwallow = false;
  const swallowTap = () => { _lpSwallow = true; setTimeout(() => { _lpSwallow = false; }, 450); };
  function toggleSel(c) {
    const it = byId(c.dataset.id); if (!it || it._del) return;
    it._sel = !it._sel; c.classList.toggle('sel', it._sel);
    const cb = c.querySelector('.as-dsel'); if (cb) cb.checked = it._sel;
    syncSel();
  }
  let _tdrag = null;   // active touch reorder: { block, ghost, tgt }
  function wireCardTouch(c) {
    if (c.classList.contains('del')) return;
    let timer = null, start = null, engaged = false, moved = false;
    c.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]; start = { x: t.clientX, y: t.clientY }; engaged = false; moved = false;
      timer = setTimeout(() => {
        engaged = true; try { navigator.vibrate && navigator.vibrate(15); } catch (x) {}
        const it = byId(c.dataset.id);
        if (canReorder() && it && !it._del) startTouchDrag(c, it, start);   // pick up to reorder
        else toggleSel(c);                                                  // otherwise select
      }, 420);
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (!start) return;
      const t = e.touches[0], far = Math.hypot(t.clientX - start.x, t.clientY - start.y) > 12;
      if (!engaged) { if (far) { clearTimeout(timer); timer = null; start = null; } return; }   // pre-engage move = page scroll
      e.preventDefault(); moved = true;
      if (_tdrag) moveTouchDrag(t);
    }, { passive: false });
    c.addEventListener('touchend', e => {
      clearTimeout(timer); timer = null;
      if (_tdrag) { e.preventDefault(); const dropped = endTouchDrag(); if (!dropped && !moved) toggleSel(c); swallowTap(); start = null; return; }
      if (engaged) { e.preventDefault(); swallowTap(); }   // long-press select already done
      start = null;
    }, { passive: false });
    c.addEventListener('touchcancel', () => { clearTimeout(timer); timer = null; if (_tdrag) endTouchDrag(); start = null; });
  }
  function startTouchDrag(c, it, start) {
    _drag = it; const block = dragBlock(); block.forEach(g => cardEl(g)?.classList.add('as-dragging'));
    const r = c.getBoundingClientRect();
    const ghost = c.cloneNode(true); ghost.className = 'as-card as-ghost';
    ghost.style.cssText = `position:fixed;left:0;top:0;width:${r.width}px;z-index:100050;pointer-events:none;opacity:.92;transform:translate(${r.left}px,${r.top}px) scale(1.04);box-shadow:0 10px 30px rgba(0,0,0,.4)`;
    document.body.appendChild(ghost);
    _tdrag = { block, ghost, off: { x: start.x - r.left, y: start.y - r.top }, tgt: null };
  }
  function moveTouchDrag(t) {
    const g = _tdrag.ghost; g.style.transform = `translate(${t.clientX - _tdrag.off.x}px,${t.clientY - _tdrag.off.y}px) scale(1.04)`;
    g.style.visibility = 'hidden'; const under = document.elementFromPoint(t.clientX, t.clientY); g.style.visibility = '';
    const card = under && under.closest && under.closest('.as-card[draggable="true"]');
    root.querySelectorAll('.as-drop').forEach(c => c.classList.remove('as-drop'));
    const tgt = card && byId(card.dataset.id);
    _tdrag.tgt = (tgt && !_tdrag.block.includes(tgt)) ? tgt : null;
    if (_tdrag.tgt) card.classList.add('as-drop');
  }
  function endTouchDrag() {
    const { block, ghost, tgt } = _tdrag; _tdrag = null;
    ghost.remove();
    root.querySelectorAll('.as-dragging').forEach(c => c.classList.remove('as-dragging'));
    root.querySelectorAll('.as-drop').forEach(c => c.classList.remove('as-drop'));
    _drag = null;
    if (tgt) { reorder(block, tgt); render(); return true; }
    return false;
  }
  window.addEventListener('resize', () => { if (root.isConnected) fitToolbar(); });
  // right-click is our selection gesture across the gallery — suppress the native menu there
  document.addEventListener('contextmenu', e => { if (root.contains(e.target)) e.preventDefault(); });

  // refresh just the toolbar's selection cluster in place — no grid reflow, so
  // right-click paint-select never makes the page jump.
  function syncSel() {
    const box = root.querySelector('.as-selbox');
    if (box) { box.innerHTML = selBox(); wireSel(); fitToolbar(); }
  }
  // drop the whole selection (model flags + on-screen cards/checkboxes + toolbar).
  function clearSel() {
    MODEL.forEach(it => it._sel = false);
    root.querySelectorAll('.as-card.sel, .as-drow.sel').forEach(c => c.classList.remove('sel'));
    root.querySelectorAll('.as-dsel').forEach(cb => cb.checked = false);
    syncSel();
  }
  // #277: after a batch op (type / comment / download / report), drop the
  // selection — on by default, opt-out in the gear panel.
  const maybeClearSel = () => { if (SETTINGS.clearSelAfterOp) clearSel(); };
  function refreshStaged() {
    const n = opsCount(); const c = root.querySelector('.as-commit');
    if (c) { c.innerHTML = commitInner(n); c.disabled = !n; if (!c.disabled) c.onclick = enterEdit; fitToolbar(); }
  }
  // #234: when the toolbar's real items + gaps can't fit one row (the flex
  // spacers would have to collapse and it'd wrap), collapse the labelled buttons
  // to icon-only — the icons + tooltips carry the meaning. Measured by summing
  // widths (the flex:1 spacers defeat scrollWidth/offsetTop-based detection).
  function fitToolbar() {
    const bar = root.querySelector('.as-bar'); if (!bar) return;
    bar.classList.remove('as-compact');           // measure at full labels
    const kids = [...bar.children];
    let need = 11 * Math.max(0, kids.length - 1); // inter-item gaps
    kids.forEach(el => { if (!el.classList.contains('as-sp')) need += el.offsetWidth; });
    bar.classList.toggle('as-compact', need > bar.clientWidth - 24);   // minus h-padding
  }
  // the list of pending MB operations behind "N staged changes"
  function pendingOps() {
    const label = it => it.types[0] || (it._new ? 'new image' : ITEM);
    const ops = [];
    MODEL.filter(it => it._new && !it._del && !it._sourcing).forEach(it => ops.push(`➕ Add ${label(it)}${it.types.length ? ` — ${it.types.join(', ')}` : ''}${it.comment ? ` “${it.comment}”` : ''}`));
    MODEL.filter(it => it._del && !it._new).forEach(it => ops.push(`🗑 Remove ${label(it)}`));
    MODEL.filter(it => !it._del && !it._new).forEach(it => {
      if (it.types.join('|') !== it._origTypes.join('|')) ops.push(`🏷 Set type on ${it._origTypes[0] || ITEM} → ${it.types.join(', ') || '(none)'}`);
      if (it.comment !== it._origComment) ops.push(`✎ Comment on ${label(it)} → ${it.comment ? `“${it.comment}”` : '(cleared)'}`);
    });
    // reorder = the EXISTING covers' relative order changed. Inserting new covers
    // shifts indices but is positioned by the add op itself (not a separate reorder).
    const ex = MODEL.filter(it => !it._del && !it._new);
    const now = ex.slice().sort((a, b) => a.order - b.order).map(it => it.id).join(',');
    const orig = ex.slice().sort((a, b) => a._origOrder - b._origOrder).map(it => it.id).join(',');
    if (now !== orig) ops.push('↕ Reorder ' + ITEMS);
    return ops;
  }
  // the count shown on "Enter edit (N)" = the number of real MB edits we'll submit
  // (buildPlan merges a cover's type+comment change into one edit), so it matches
  // the panel's operation list exactly. #234
  const opsCount = () => buildPlan().length;
  // #234: the "View ▾" dropdown — Sort options + Group toggle, moved off the
  // main toolbar to free its center for the selection controls.
  function openViewPop(btn) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const pop = document.createElement('div'); pop.className = 'as-pop as-view-pop';
    const sorts = [['type', 'Position'], ['bytype', 'Type'], ['dim', 'Dimensions'], ['newest', 'Newest']];
    const vmode = SETTINGS.detailed ? 'detailed' : SETTINGS.group ? 'group' : 'grid';
    pop.innerHTML = `<div class="as-pop-h">Sort</div>`
      + sorts.map(([v, l]) => `<label><input type="radio" name="as-vsort" value="${v}"${SETTINGS.sort === v ? ' checked' : ''}> ${l}${v === 'type' ? ' <span class="as-pop-note">(needed to drag-reorder)</span>' : ''}</label>`).join('')
      + `<div class="as-pop-h">View</div>`
      + [['grid', 'Grid', ''], ['detailed', 'Detailed view', '(list + all types &amp; comment)'], ['group', 'Group by type', '(view-only)']]
          .map(([v, l, note]) => `<label><input type="radio" name="as-vmode" value="${v}"${vmode === v ? ' checked' : ''}> ${l}${note ? ` <span class="as-pop-note">${note}</span>` : ''}</label>`).join('');
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    pop.querySelectorAll('input[name="as-vsort"]').forEach(r => r.onchange = () => { SETTINGS.sort = r.value; save(); render(); });
    // #234: the view modes are mutually exclusive — Grid / Detailed / Group.
    pop.querySelectorAll('input[name="as-vmode"]').forEach(r => r.onchange = () => {
      SETTINGS.detailed = r.value === 'detailed'; SETTINGS.group = r.value === 'group';
      save(); render();
    });
    const off = e => { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  // position a popover next to an anchor, flipping up / clamping so it stays on-screen
  function placePop(pop, r) {
    const ph = pop.offsetHeight, pw = pop.offsetWidth, vh = innerHeight, vw = innerWidth, M = 8;
    let top = r.bottom + 3;
    if (top + ph > vh - M && r.top - ph - 3 >= M) top = r.top - ph - 3;   // flip above the anchor
    top = Math.max(M, Math.min(top, vh - ph - M));
    let left = Math.max(M, Math.min(r.left, vw - pw - M));
    pop.style.top = (top + scrollY) + 'px';
    pop.style.left = (left + scrollX) + 'px';
  }

  function openTypePop(chip) {
    const it = byId(cardId(chip)); if (!it) return;
    openTypePopFor(it, chip, () => render());
  }
  // shared single-cover type picker — anchored to `anchor`, mutating `it.types`,
  // calling `onChange` after each toggle. Used by the grid pills AND the lightbox.
  function openTypePopFor(it, anchor, onChange) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const pop = document.createElement('div'); pop.className = 'as-pop';
    pop.innerHTML = `<div class="as-type-grid">${ALL_TYPES.map(t => `<label title="Right-click: set only this type"><input type="checkbox" value="${esc(t)}"${it.types.includes(t)?' checked':''}> ${esc(t)}</label>`).join('')}</div>`;
    document.body.appendChild(pop);
    placePop(pop, anchor.getBoundingClientRect());
    const close = () => { pop.remove(); document.removeEventListener('mousedown', off); _popJustClosed = true; setTimeout(() => { _popJustClosed = false; }, 0); };
    pop.querySelectorAll('input').forEach(cb => cb.onchange = () => {
      it.types = ALL_TYPES.filter(t => pop.querySelector(`input[value="${CSS.escape(t)}"]`).checked);
      onChange && onChange();
    });
    // right-click a type → set ONLY that type and close (quick single-type set)
    pop.querySelectorAll('.as-type-grid label').forEach(lab => lab.oncontextmenu = e => {
      e.preventDefault(); e.stopPropagation();
      it.types = [lab.querySelector('input').value];
      onChange && onChange(); close();
    });
    const off = e => { if (!pop.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    return pop;
  }
  let _popJustClosed = false;   // bridges the mousedown-dismiss → click gap so a pop dismissal doesn't also close the lightbox

  let _drag = null;
  // the block being dragged: the whole selection if the grabbed card is selected, else just it
  const dragBlock = () => (_drag && _drag._sel) ? MODEL.filter(it => it._sel && !it._del).sort((a, b) => a.order - b.order) : (_drag ? [_drag] : []);
  function wireDrag() {
    root.querySelectorAll('.as-card[draggable="true"]').forEach(card => {
      card.ondragstart = e => { _drag = byId(card.dataset.id); dragBlock().forEach(g => cardEl(g)?.classList.add('as-dragging')); e.dataTransfer.effectAllowed = 'move'; };
      card.ondragend = () => { root.querySelectorAll('.as-dragging').forEach(c => c.classList.remove('as-dragging')); _drag = null; root.querySelectorAll('.as-drop').forEach(c => c.classList.remove('as-drop')); };
      card.ondragover = e => {
        const tgt = byId(card.dataset.id);
        if (!_drag || dragBlock().includes(tgt)) return;   // not onto a member of the moving block
        e.preventDefault(); root.querySelectorAll('.as-drop').forEach(c => c.classList.remove('as-drop')); card.classList.add('as-drop');
      };
      card.ondrop = e => {
        e.preventDefault(); const tgt = byId(card.dataset.id); const block = dragBlock();
        if (!_drag || !tgt || block.includes(tgt)) return;
        reorder(block, tgt); render();
      };
    });
  }
  const cardEl = it => root.querySelector(`.as-card[data-id="${CSS.escape(String(it.id))}"]`);
  function reorder(block, tgt) {
    // move the block (one card, or the whole selection) next to tgt, preserving the
    // block's relative order. Drop on the side you came from: forward → after tgt.
    const seq = MODEL.filter(it => !it._del).slice().sort((a, b) => a.order - b.order);
    const set = new Set(block);
    const fromFirst = Math.min(...block.map(b => seq.indexOf(b)));
    const forward = fromFirst < seq.indexOf(tgt);
    const rest = seq.filter(it => !set.has(it));
    const to = rest.indexOf(tgt) + (forward ? 1 : 0);
    rest.splice(to, 0, ...block);
    rest.forEach((it, i) => it.order = i);
  }

  // ── actions ───────────────────────────────────────────────────────────────────
  // #244 a download name that round-trips the type back via #243:
  //   "<NN> <type1>,<type2> <comment>.<ext>"  — types lowercased, "/" → "_",
  //   no type → "none". e.g. "09 front,sticker Front cover with the sticker.jpg"
  function downloadName(it, pos, ext, pad = 2) {
    const nn = String(pos).padStart(pad, '0');
    const types = (it.types && it.types.length) ? it.types.map(t => t.toLowerCase().replace(/[\\/]/g, '_')).join(',') : 'none';
    const comment = (it.comment || '').trim().slice(0, 100);
    const base = (nn + ' ' + types + (comment ? ' ' + comment : '')).replace(/[<>:"|?*]/g, '_').replace(/[\\/]/g, '_').replace(/\s+/g, ' ').trim();
    return `${base}.${ext}`;
  }
  // download URL + extension for a cover — NEW covers use their local blob, not a CAA URL
  const dlUrl = it => it._new ? it._file : (it._img || imgUrl(it.id));
  function dlExt(it) {
    if (it._new) { const n = (it._fileObj && it._fileObj.name) || ''; const m = n.match(/\.([a-z0-9]+)$/i); return (m ? m[1] : ((it._fileObj && it._fileObj.type || '').split('/')[1] || 'jpg')).toLowerCase().replace('jpeg', 'jpg'); }
    return ((it._img || imgUrl(it.id)).match(/\.(jpg|jpeg|png|gif|pdf|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase();
  }
  async function dlOne(it, size) {
    const orig = !size || size === 'original' || it._new;   // new covers only have their local blob
    const url = orig ? dlUrl(it) : thumb(it.id, size), ext = dlExt(it);
    let name = downloadName(it, it.order + 1, ext);
    if (!orig) name = name.replace(/\.(\w+)$/, ` ${size}.$1`);   // note the thumbnail size
    try {
      // cross-origin <a download> is ignored by browsers — fetch the blob (CAA
      // sends CORS) and download via a same-origin object URL so it actually saves
      const blob = await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); });
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = obj; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 8000);
      asLog.ok(`Download: saved ${name}`);
    } catch (e) { logErr(`Download: ${name} (opened in a tab instead)`, e); window.open(url, '_blank'); }   // fallback: just open it
  }
  // #240: multiple selected covers → one ZIP. Triggering N separate downloads
  // from timeouts trips the browser's "downloading multiple files" block (only the
  // first saves); a single zip download sidesteps it entirely.
  function crc32(bytes) {
    let t = crc32._t;
    if (!t) { t = crc32._t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ t[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  // store-only ZIP record builders (no compression — covers are already JPEG/PNG)
  const _zdv = (len, fill) => { const a = new Uint8Array(len); fill(new DataView(a.buffer)); return a; };
  const zipLocal   = (crc, size, nameLen) => _zdv(30, v => { v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint32(14, crc, true); v.setUint32(18, size, true); v.setUint32(22, size, true); v.setUint16(26, nameLen, true); });
  const zipCentral = (crc, size, nameLen, off) => _zdv(46, v => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint32(16, crc, true); v.setUint32(20, size, true); v.setUint32(24, size, true); v.setUint16(28, nameLen, true); v.setUint32(42, off, true); });
  const zipEOCD    = (count, cdSize, cdOff) => _zdv(22, v => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, count, true); v.setUint16(10, count, true); v.setUint32(12, cdSize, true); v.setUint32(16, cdOff, true); });
  function makeZip(files) {
    const enc = new TextEncoder(); const parts = [], central = []; let offset = 0;
    for (const f of files) { const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      parts.push(zipLocal(crc, size, name.length), name, f.data);
      central.push(zipCentral(crc, size, name.length, offset), name); offset += 30 + name.length + size; }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    return new Blob([...parts, ...central, zipEOCD(files.length, cdSize, offset)], { type: 'application/zip' });
  }
  // member names, disambiguating same-type covers (front.jpg, booklet.jpg, booklet-2.jpg …)
  function zipNames(sel) {
    const used = new Set();
    const pad = Math.max(2, String(Math.max(0, ...sel.map(it => it.order + 1))).length);
    return sel.map(it => {
      const url = dlUrl(it), ext = dlExt(it);
      let name = downloadName(it, it.order + 1, ext, pad);   // #244 "NN types comment.ext"
      const b = name.replace(/\.[^.]+$/, ''); let n = 2;
      while (used.has(name.toLowerCase())) name = `${b} (${n++}).${ext}`;
      used.add(name.toLowerCase());
      return { url, name, it };
    });
  }
  // #274: covers (esp. big ones from coverartarchive.org → archive.org) fail
  // intermittently — a transient 5xx / network hiccup / slow large transfer.
  // Without a retry those covers were silently dropped from the archive. Retry
  // with backoff, and abort a stalled attempt so it retries instead of hanging.
  async function fetchBytes(url, attempts = 4) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120000);   // 2 min per attempt
      try {
        const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return new Uint8Array(await r.arrayBuffer());
      } catch (e) { clearTimeout(timer); lastErr = e; }
      // #274: plain fetch() is CORS-bound — a PDF booklet on archive.org carries
      // no Access-Control-Allow-Origin, so fetch() ALWAYS fails it even though the
      // browser views it fine. GM_xmlhttpRequest is not CORS-bound; use it as the
      // fallback (it also recovers transient image failures).
      try {
        const blob = await gmFetch(url);
        if (blob) return new Uint8Array(await blob.arrayBuffer());
      } catch (e) { lastErr = e; }
      if (i < attempts - 1) await new Promise(res => setTimeout(res, 800 * (i + 1)));
    }
    throw lastErr;
  }
  // #274: warn the user (clearly, and in the archive's own README) when covers
  // couldn't be downloaded, instead of silently shipping an incomplete zip.
  function warnDropped(failed, total) {
    const n = failed.length;
    const list = failed.slice(0, 4).join(', ') + (n > 4 ? `, +${n - 4} more` : '');
    toast(`⚠ ${n}/${total} file${n === 1 ? '' : 's'} failed to download — missing from the archive: ${list}. See README.md inside.`, 14000);
  }
  // capture the original's resolution from its bytes (no extra request) so the manifest table has it
  async function measureBytes(it, data) {
    if (it.w || it._pdf || !data) return;
    try { const bmp = await createImageBitmap(new Blob([data])); it.w = bmp.width; it.h = bmp.height; bmp.close && bmp.close(); } catch (e) {}
  }
  async function dlZip(sel, onProgress) {
    const items = zipNames(sel), enc = new TextEncoder();
    // unique, sortable archive name: "<MBID> <YYYY-MM-DDThh-mm-ss> <N> <covers>.zip" — the
    // export timestamp + file count make every download distinct (no overwrite / same-name reuse).
    const _p = n => String(n).padStart(2, '0'), _d = new Date();
    const zipName = `${MBID} ${_d.getFullYear()}-${_p(_d.getMonth() + 1)}-${_p(_d.getDate())}T${_p(_d.getHours())}-${_p(_d.getMinutes())}-${_p(_d.getSeconds())} ${items.length} ${ITEMS}.zip`;
    asLog.info(`Download: zipping ${items.length} ${items.length === 1 ? ITEM : ITEMS}`);
    // #240: stream the zip straight to disk when the browser supports it — the
    // download starts immediately (first cover written as soon as it arrives) and
    // the whole archive is never buffered in memory.
    // Grab the save handle FIRST, while we still hold the user gesture.
    // showSaveFilePicker needs transient user activation; awaiting loadSizes (an
    // archive.org fetch) before it lets that activation expire, so the picker threw
    // SecurityError. We also used to swallow EVERY failure as "cancelled" → the zip
    // download silently did nothing. Now: pick the file first, and on any non-cancel
    // failure (gesture lost, blocked by the userscript manager, API unavailable) log
    // the reason and fall through to the blob download so the zip still saves.
    let handle = null;
    // Call showSaveFilePicker on the REAL window (unsafeWindow): on the userscript-sandboxed
    // `window` proxy some managers (e.g. Tampermonkey) throw TypeError "illegal invocation",
    // which forced the blob fallback — and Chromium then silently blocks the 2nd+ of those
    // repeat downloads. The native Save dialog isn't subject to that gate. #282
    const _win = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
    if (_win.showSaveFilePicker) {
      try { handle = await _win.showSaveFilePicker({ suggestedName: zipName, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] }); }
      catch (e) {
        if (e && e.name === 'AbortError') return;   // genuine user cancel — respect it
        asLog.warn(`Save dialog unavailable (${(e && e.name) || e}) — saving via direct download instead`);
        handle = null;   // fall through to the blob fallback below
      }
    }
    await loadSizes();   // byte sizes for the manifest; resolutions are captured during the fetch below
    if (handle) {
      const w = await handle.createWritable();
      const central = []; let offset = 0, done = 0; const failed = [];
      const writeEntry = async (nameStr, data) => {
        const name = enc.encode(nameStr), crc = crc32(data);
        await w.write(zipLocal(crc, data.length, name.length)); await w.write(name); await w.write(data);
        central.push({ crc, size: data.length, name, offset });
        offset += 30 + name.length + data.length;
      };
      for (const o of items) {
        asLog.debug(`Zip: fetching ${o.name} ← ${o.url}`);
        let data; try { data = await fetchBytes(o.url); } catch (e) { failed.push(o.name); logErr(`Zip: ${o.name}`, e); onProgress && onProgress(++done, items.length); continue; }   // #274: record, don't silently drop
        await measureBytes(o.it, data);
        await writeEntry(o.name, data);
        asLog.info(`Zip + ${o.name} — ${fmtBytes(data.length)}${o.it && o.it.w ? `, ${o.it.w}×${o.it.h}` : ''}${o.it && o.it._pdf ? ', PDF' : ''}`);
        onProgress && onProgress(++done, items.length);
      }
      await writeEntry('README.md', enc.encode(manifestMd(sel, failed)));   // manifest last — now has resolutions + any drops
      asLog.debug('Zip + README.md (manifest)');
      let cdSize = 0;
      for (const c of central) { await w.write(zipCentral(c.crc, c.size, c.name.length, c.offset)); await w.write(c.name); cdSize += 46 + c.name.length; }
      await w.write(zipEOCD(central.length, cdSize, offset));
      await w.close();
      asLog.ok(`Download: saved ${zipName} — ${central.length} file${central.length === 1 ? '' : 's'} · ${fmtBytes(offset)} (streamed)${failed.length ? `, ${failed.length} dropped` : ''}`);
      if (failed.length) warnDropped(failed, items.length);
      return;
    }
    // fallback: fetch with a small concurrency pool (NOT all at once — flooding
    // the network with many big covers is what made them fail/drop, #274), keep
    // original order, then one blob download.
    let done = 0; const out = new Array(items.length).fill(null); const failed = []; let idx = 0;
    const worker = async () => {
      while (true) {
        const i = idx++; if (i >= items.length) break;
        const o = items[i];
        asLog.debug(`Zip: fetching ${o.name} ← ${o.url}`);
        try { const data = await fetchBytes(o.url); await measureBytes(o.it, data); out[i] = { name: o.name, data }; asLog.info(`Zip + ${o.name} — ${fmtBytes(data.length)}${o.it && o.it.w ? `, ${o.it.w}×${o.it.h}` : ''}${o.it && o.it._pdf ? ', PDF' : ''}`); }
        catch (e) { failed.push(o.name); logErr(`Zip: ${o.name}`, e); }
        onProgress && onProgress(++done, items.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
    const covers = out.filter(Boolean);
    if (!covers.length) { toast('⚠ Download failed — could not fetch any cover. Try again.', 10000); return; }
    const entries = [...covers, { name: 'README.md', data: enc.encode(manifestMd(sel, failed)) }];   // manifest last — now has resolutions
    const total = entries.reduce((s, e) => s + e.data.length, 0);
    const obj = URL.createObjectURL(makeZip(entries));
    const a = document.createElement('a'); a.href = obj; a.download = zipName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 8000);
    asLog.ok(`Download: saved ${zipName} — ${covers.length} file${covers.length === 1 ? '' : 's'} · ${fmtBytes(total)}${failed.length ? `, ${failed.length} dropped` : ''}`);
    if (failed.length) warnDropped(failed, items.length);
  }
  // ── #235 source covers from covers.musichoarders.xyz (the sanctioned MH Covers
  //    integration — same window.open + postMessage protocol the "Ame" script uses;
  //    no internal MH API). A chosen cover is fetched and dropped into the gallery
  //    as a staged NEW cover, so it rides the normal Enter-edit upload flow. ─────
  const MH_ORIGIN = 'https://covers.musichoarders.xyz';
  // cross-origin GET → Blob (covers can be on any provider host → needs GM xhr)
  function gmFetch(url, onProgress) {
    return new Promise((resolve, reject) => {
      const gx = (typeof GM !== 'undefined' && GM.xmlHttpRequest && GM.xmlHttpRequest.bind(GM))
              || (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest) || null;
      if (!gx) { fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status))).then(resolve, reject); return; }
      gx({ method: 'GET', url, responseType: 'blob', timeout: 180000,
        onprogress: e => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); },
        onload: r => (r.status >= 200 && r.status < 300) ? resolve(r.response) : reject(new Error('HTTP ' + r.status)),
        onerror: () => reject(new Error('network error')), ontimeout: () => reject(new Error('timed out')) });
    });
  }
  // ── session log (#283) ────────────────────────────────────────────────────
  // A troubleshooting log of everything the script does this session — downloads,
  // zipping, provider/MH-Covers integrations, archive.org sign/upload, MB edits,
  // reorders, and every warning/error (incl. the ones that used to die silently
  // in a catch). Reviewable + copy/pastable as a Markdown <details> block for a
  // GitHub issue, mirroring Credit Hoarder. `toast()` feeds it; operations log
  // explicitly, and verbose diagnostics go in at `debug`.
  const LOG = [];
  const _logListeners = new Set();
  function asLog(sev, msg) {
    const text = String(msg == null ? '' : msg).replace(/\s+/g, ' ').trim();
    if (!text) return;
    LOG.push({ t: new Date(), sev, msg: text });
    _logListeners.forEach(f => { try { f(); } catch (e) {} });
  }
  asLog.info  = m => asLog('info', m);
  asLog.ok    = m => asLog('ok', m);
  asLog.warn  = m => asLog('warn', m);
  asLog.error = m => asLog('error', m);
  asLog.debug = m => asLog('debug', m);
  // standard shape for a caught error: "<context> — <message>"
  const logErr = (ctx, e) => asLog('error', ctx + ' — ' + ((e && e.message) || e || 'unknown error'));
  const logCounts = () => LOG.reduce((a, e) => { if (e.sev === 'warn') a.warn++; else if (e.sev === 'error') a.error++; return a; }, { warn: 0, error: 0 });
  // escape, then turn http(s) URLs into clickable links for the log viewer
  const _logLinkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (m) => {
    const t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];   // keep trailing punctuation out of the URL
    const url = m.slice(0, m.length - t.length);
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>${t}`;
  });
  const _ts = d => { const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`; };
  const fmtBytes = n => (n == null) ? '?' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  // Build the copy/pastable Markdown: a collapsed <details> wrapping a fenced log
  // block (same shape as the other scripts — paste straight into a GitHub issue).
  function logMarkdown() {
    const PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    const body = LOG.length ? LOG.map(e => `${_ts(e.t)}  ${PRE[e.sev] || ''}${e.msg}`).join('\n') : '(no activity logged)';
    const c = logCounts();
    let title = 'Art Station' + ((_gm && _gm.version) ? ' v' + _gm.version : '');   // version next to the script name
    try { const t = (releaseInfo().title || '').trim(); if (t) title += ' — ' + t; } catch (e) {}
    const tally = (c.warn || c.error) ? ` (${c.warn} warning${c.warn === 1 ? '' : 's'}, ${c.error} error${c.error === 1 ? '' : 's'})` : '';
    return `<details><summary>${title} — session log${tally}</summary>\n\n` + '```log\n' + body + '\n```' + `\n\n</details>`;
  }
  async function copyLog(btn) {
    const md = logMarkdown();
    let okCopy = false;
    try { await navigator.clipboard.writeText(md); okCopy = true; }
    catch (e) {
      try { const ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); okCopy = document.execCommand('copy'); ta.remove(); } catch (x) {}
    }
    if (btn) { const o = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = o; btn.textContent = okCopy ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); }
  }

  let _toastT;
  function toast(msg, ms = 2800) {
    const s = String(msg);
    // mirror every toast into the log (warn if it leads with ⚠, ok if it has ✓/✅)
    asLog(/^\s*⚠/.test(s) ? 'warn' : /[✓✅]/.test(s) ? 'ok' : 'info', s.replace(/^\s*[⚠✓✅]\s*/, ''));
    let el = document.getElementById('as-toast');
    if (!el) { el = document.createElement('div'); el.id = 'as-toast'; document.body.appendChild(el); }
    el.textContent = msg; el.style.opacity = '1';
    clearTimeout(_toastT); _toastT = setTimeout(() => { el.style.opacity = '0'; }, ms);
  }
  function openMHCovers() {
    const info = releaseInfo();
    const artist = info.artists.map(a => a.name).join(' ').trim();
    const album = (info.title || '').trim();
    if (!album) { toast('Could not read the release title'); return; }
    const p = new URLSearchParams();
    // remote.* puts MH Covers into integration ("pick") mode — picking a cover posts
    // it back over the browser channel instead of just opening the image. #235
    p.set('remote.port', 'browser');
    p.set('remote.agent', 'Art Station - MusicBrainz');
    p.set('remote.text', 'Pick a cover for this MusicBrainz release.');
    if (artist) p.set('artist', artist); p.set('album', album);
    const win = window.open(`${MH_ORIGIN}?${p}`, '_blank');
    if (!win) { toast('Pop-up blocked — allow pop-ups for MH Covers'); return; }
    toast('Pick a cover in the MH Covers tab…', 6000);
    const onMsg = async e => {
      if (e.source !== win) return;
      let host = ''; try { host = new URL(e.origin).hostname; } catch (err) {}
      if (!/(^|\.)musichoarders\.xyz$/.test(host)) return;
      let o; try { o = JSON.parse(e.data); } catch (err) { return; }
      if (o.action !== 'primary' && o.action !== 'secondary') return;
      cleanup(); try { win.close(); } catch (err) {}
      await addCoverFromMH(o);
    };
    const onUnload = () => { try { win.close(); } catch (err) {} };
    const cleanup = () => { window.removeEventListener('message', onMsg); window.removeEventListener('beforeunload', onUnload); };
    window.addEventListener('message', onMsg);
    window.addEventListener('beforeunload', onUnload);
  }
  // MH reports the cover's underlying source (e.g. "itunes", "bandcamp") — map the
  // known ones to a recognisable name + favicon so the staged cover shows where it
  // came from, the same as ECAU sources do (#249). Unknown → labelled as MH Covers.
  const MH_SOURCE = {
    itunes: ['Apple Music', 'music.apple.com'], applemusic: ['Apple Music', 'music.apple.com'],
    deezer: ['Deezer', 'deezer.com'], spotify: ['Spotify', 'spotify.com'], tidal: ['Tidal', 'tidal.com'],
    qobuz: ['Qobuz', 'qobuz.com'], bandcamp: ['Bandcamp', 'bandcamp.com'], discogs: ['Discogs', 'discogs.com'],
    amazonmusic: ['Amazon', 'amazon.com'], amazon: ['Amazon', 'amazon.com'], vgmdb: ['VGMdb', 'vgmdb.net'],
    junodownload: ['Juno', 'junodownload.com'], beatport: ['Beatport', 'beatport.com'], sevendigital: ['7digital', '7digital.com'],
  };
  function mhProvider(o) {
    const key = String(o.source || o.sourceName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const m = MH_SOURCE[key];
    if (m) return { name: `${m[0]} (via MH)`, icon: provIconUrl(m[1]) };
    return { name: 'MH Covers', icon: `${MH_ORIGIN}/favicon.svg` };
  }
  async function addCoverFromMH(o) {
    const url = o.bigCoverUrl || o.smallCoverUrl; if (!url) return;
    const prov = mhProvider(o);
    const slot = addSourcingSlot(`Sourcing ${prov.name}…`);   // show the in-grid spinner placeholder, same as URL/provider sourcing
    try {
      const blob = await gmFetch(url, (l, t) => setSourcingLabel(slot, `Fetching ${prov.name}… ${Math.round(l / t * 100)}%`));
      const ext = (String(url).match(/\.(jpe?g|png|gif|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
      const type = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/jpeg';
      const file = new File([blob], `mh-${Date.now()}.${ext}`, { type });
      dropSourcingSlot(slot);
      const added = await addFilesDeduped([file], [{ provider: prov.name, provIcon: prov.icon, provUrl: url }]);   // #253
      if (added) toast('Added cover from MH Covers ✓'); else { render(); toast('That cover is already added'); }
    } catch (e) { dropSourcingSlot(slot); render(); toast('Could not fetch the cover — ' + e.message, 5000); }
  }

  // ── #242 Source from any provider via ECAU (ROpdebee's Enhanced Cover Art Uploads). ──
  // We don't reimplement providers — that scraping/maximization is the high-churn part
  // ECAU owns. Instead we seed ECAU's public x_seed interface in a HIDDEN add-cover-art
  // iframe (so no native/ECAU UI is ever shown), let it fetch + maximize, then harvest
  // the File(s) from MB's native uploader preview rows (the blob: <img> previews + each
  // image's checked type checkboxes / comment) and stage them as NEW covers — riding the
  // normal "you get what you see" Enter-edit flow. Requires ECAU installed (it's what the
  // manager injects into the iframe). #242
  const ECAU_TIMEOUT = 45000;
  // Some providers (notably Amazon) hand ECAU their site logo / "smile" favicon
  // alongside the real covers. Those are tiny; real cover art is never this small.
  // Drop anything whose longest side is under this so the brand glyph isn't staged. #242
  const MIN_ART_PX = 200;
  // ECAU writes progress/errors into #ROpdebee_log_container (an ID, not a class —
  // the old `.`-selector matched nothing, so failures spun to the timeout). Each
  // message is a .msg.<level> span; a real failure is .msg.error / .msg.warning.
  // Return that exact text so we can show ECAU's own message (#286). #242
  function ecauError(doc) {
    const cont = doc.querySelector('#ROpdebee_log_container'); if (!cont) return null;
    const msgs = [...cont.querySelectorAll('.msg.error, .msg.warning')];
    if (msgs.length) return (msgs[msgs.length - 1].textContent || '').replace(/\s+/g, ' ').trim() || null;
    const txt = (cont.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt && /failed to (fetch|enqueue|load)|invalid url|could ?n.?t|no (valid )?image|not a? ?support|unable to|refusing to/i.test(txt)) return txt.slice(-220);
    return null;
  }
  // ECAU injects its own UI into the add page (the paste-URL box, the "Import from …"
  // buttons, the supported-providers link). Its presence is how we tell the manager
  // actually loaded it — used to warn in the source popover and to fail a sourcing
  // attempt fast (instead of spinning to ECAU_TIMEOUT) when it isn't there. #242
  const ecauUI = doc => !!(doc && doc.querySelector('#ROpdebee_paste_url, .ROpdebee_import_url_buttons, #ROpdebee_ecau_providers_link'));
  const NO_ECAU = 'Enhanced Cover Art Uploads isn’t installed or is disabled — it powers provider / URL sourcing.';
  let _ecauProbe = null;   // cached: load the add page once in a hidden frame and see if ECAU injects its UI
  function ecauInstalled() {
    return _ecauProbe || (_ecauProbe = new Promise(resolve => {
      const ifr = document.createElement('iframe');
      ifr.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:700px;border:0;opacity:0;pointer-events:none';
      let done = false;
      const finish = v => { if (done) return; done = true; clearInterval(poll); clearTimeout(killer); try { ifr.remove(); } catch (e) {} resolve(v); };
      const poll = setInterval(() => { let d; try { d = ifr.contentDocument; } catch (e) { return; } if (ecauUI(d)) finish(true); }, 300);
      const killer = setTimeout(() => finish(false), 9000);
      ifr.src = `${R}/add-${ART}`;
      document.body.appendChild(ifr);
    }));
  }
  // a placeholder card (spinner + label) shown at the front of the gallery while ECAU
  // works, so the (sometimes slow) provider fetch has visible in-grid progress. It's
  // replaced by the real cover on success, removed on failure.
  function addSourcingSlot(label) {
    const ph = { id: 'srcing-' + Math.random().toString(36).slice(2, 7), types: [], comment: '', order: -1, w: 0, h: 0, _new: true, _sourcing: true, _srcLabel: label, _origTypes: [], _origComment: '', _origOrder: -1 };
    const rest = MODEL.slice().sort((a, b) => a.order - b.order);
    MODEL = [ph, ...rest]; MODEL.forEach((it, i) => it.order = i);
    render();
    return ph.id;
  }
  function setSourcingLabel(id, text) {
    const it = MODEL.find(x => x.id === id); if (it) it._srcLabel = text;
    const el = document.querySelector(`.as-card[data-id="${CSS.escape(id)}"] .as-srcing-lbl`); if (el) el.textContent = text;
  }
  function dropSourcingSlot(id) { MODEL = MODEL.filter(it => it.id !== id); MODEL.forEach((it, i) => it.order = i); }

  // ── #250 Plugin API ─────────────────────────────────────────────────────────
  // Third-party userscripts register a custom cover provider — it shows as its own
  // "Import from <name>" button in the Source popover. The provider's run(ctx)
  // returns the images it fetched ITSELF (a Blob — so the provider's own
  // authenticated, e.g. CloudFlare-cleared, session does the fetch) OR plain URLs
  // (Art Station fetches those via GM xhr). Each cover keeps the provider's badge.
  const _customProviders = [];
  let _srcBtn = null;   // the button that opened the Source popover (to re-open on late registration)
  const hostIcon = u => { try { return provIconUrl(new URL(u).hostname.replace(/^www\./, '')); } catch (e) { return ''; } };
  // #250 (vzell) a provider may declare `match` — host string / array / RegExp / predicate —
  // so its "Import from …" button only appears when the release actually links that site,
  // and the matched external link(s) are handed to run() (ctx.link / ctx.links). Normalise
  // any of those forms to a (url)=>bool. No match → button always shows (legacy).
  function normMatch(m) {
    if (!m) return null;
    if (typeof m === 'function') return m;
    if (m instanceof RegExp) return u => { try { return m.test(u); } catch (e) { return false; } };
    const needles = (Array.isArray(m) ? m : [m]).map(s => String(s).toLowerCase()).filter(Boolean);
    return u => {
      const lu = String(u || '').toLowerCase();
      let h = ''; try { h = new URL(u).hostname.toLowerCase(); } catch (e) {}
      return needles.some(s => h === s || h.endsWith('.' + s) || lu.includes(s));
    };
  }
  function registerProvider(p) {
    if (!p || typeof p.run !== 'function' || !p.name) return false;
    const id = p.id || p.name;
    if (_customProviders.some(x => x.id === id)) return false;   // de-dupe
    _customProviders.push({ id, name: String(p.name), icon: p.icon || '', run: p.run, match: normMatch(p.match) });
    refreshSrcCount();   // #270 keep the button count right when a provider registers after the toolbar built
    if (document.querySelector('.as-src-pop') && _srcBtn) openSourcePop(_srcBtn);   // reflect in an open popover
    return true;
  }
  // does a blob decode as a real image in OUR realm? (the true test of a usable cover)
  async function decodesImg(blob) {
    try { const bmp = await createImageBitmap(blob); bmp.close && bmp.close(); return true; } catch (e) { return false; }
  }
  async function providerBlob(it) {            // one provider result → a Blob in OUR realm
    if (it == null) return null;
    if (it.dataUrl) { try { return await fetch(it.dataUrl).then(r => r.blob()); } catch (e) {} }
    // A provider fetches images in ITS OWN userscript sandbox, so the Blob/File it hands back
    // belongs to a different realm. On some managers (notably Firefox's Xray wrappers) those
    // bytes don't survive the boundary — the blob reports the right size but never decodes or
    // renders (#250, vzell's Jungleland). So whenever the provider also gave us a URL, we fetch
    // the image OURSELVES, in our own realm, and never touch the foreign object at all. This is
    // the robust default; the raw Blob is only used when no URL is available (e.g. a session-
    // locked image the provider could fetch but we can't).
    const directUrl = it.url || it.source || '';
    if (directUrl) {
      try { const b = await gmFetch(directUrl); if (b && (b.type === 'application/pdf' || await decodesImg(b))) return b; } catch (e) {}
    }
    // No usable URL — launder the provider's own bytes into a fresh same-realm Blob, and verify
    // it actually decodes (a cross-realm copy can have the right length but unreadable content).
    const raw = it.blob || it.file;
    if (raw && typeof raw.arrayBuffer === 'function') {
      try {
        const buf = await raw.arrayBuffer();
        const u8 = new Uint8Array(buf), copy = new Uint8Array(u8.length); copy.set(u8);   // explicit same-realm byte copy
        const b = new Blob([copy], { type: raw.type || 'image/jpeg' });
        if ((raw.type === 'application/pdf') || await decodesImg(b)) return b;   // PDFs can't be decode-checked; trust them
      } catch (e) {}
    }
    return null;
  }
  function sourceFromProvider(prov, links) {
    const slot = addSourcingSlot(`Sourcing ${prov.name}…`);
    asLog.info(`Integration: sourcing covers from ${prov.name}`);
    const info = releaseInfo();
    // #250 (vzell) ctx.link/links = the release's external link(s) this provider matched,
    // so run() can key off them instead of guessing the source page. ctx.url stays the MB page.
    const ctx = { mbid: MBID, entity: ENT.kind, artist: info.artists.map(a => a.name).join(', '), title: info.title, url: info.url, link: (links && links[0]) || '', links: links || [] };
    let done = false;
    const finish = () => { done = true; dropSourcingSlot(slot); };
    const killer = setTimeout(() => { if (done) return; finish(); render(); asLog.warn(`Integration: ${prov.name} timed out`); toast(`${prov.name} timed out`, 6000); }, 90000);
    Promise.resolve().then(() => prov.run(ctx)).then(async list => {
      if (done) return; clearTimeout(killer);
      const items = Array.isArray(list) ? list : (list ? [list] : []);
      const files = [], metas = [];
      for (const it of items) {
        let blob; try { blob = await providerBlob(it); } catch (e) { blob = null; asLog.debug(`Integration: ${prov.name} image fetch failed — ${(e && e.message) || e}`); }
        if (!blob) continue;
        const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/jpeg';
        const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const types = Array.isArray(it.types) ? it.types.filter(t => ALL_TYPES.includes(t)) : [];
        const srcUrl = it.source || it.url || '';
        files.push(new File([blob], `prov-${Date.now()}-${files.length}.${ext}`, { type: mime }));
        metas.push({ types, comment: it.comment || '', provider: prov.name, provIcon: prov.icon || hostIcon(srcUrl), provUrl: srcUrl });
      }
      finish();
      if (files.length) { addFiles(files, metas); toast(`Added ${files.length} image${files.length > 1 ? 's' : ''} from ${prov.name} ✓`); }
      else { render(); toast(`${prov.name} returned no image`, 5000); }
    }).catch(e => { if (done) return; clearTimeout(killer); finish(); render(); toast(`${prov.name} failed — ${(e && e.message) || e}`, 8000); });
  }
  // expose the registry on the page (and a CustomEvent fallback for managers that
  // isolate `window` from other userscripts). Either way is fine to call repeatedly.
  (function exposeApi() {
    // addImageUrl: bring an image in by URL — the bridge the reverse-image-search
    // picker companion (as_picker.user.js) calls when it lands on the MB page with
    // images the user picked elsewhere. Returns true so the companion knows AS is here.
    const api = { apiVersion: 1, registerProvider, addImageUrl: (url, prov) => { sourceFromUrl(url, prov); return true; } };   // no prov → sourceFromUrl derives name+favicon from the host
    try { (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).ArtStation = api; } catch (e) { try { window.ArtStation = api; } catch (x) {} }
    try { document.addEventListener('artstation:register-provider', e => { try { registerProvider(e.detail); } catch (x) {} }); } catch (e) {}
    // also accept picks via a DOM event (the companion may prefer this over the API object)
    try { document.addEventListener('artstation:add-image', e => { try { if (e.detail && e.detail.url) api.addImageUrl(e.detail.url, e.detail.prov); } catch (x) {} }); } catch (e) {}
  })();
  // prov (optional) = { name, icon } the cover is being sourced from — passed by the
  // "Import from <provider>" buttons, else derived from the URL. Stamped on each new
  // cover so the gallery shows where it came from until commit (#249).
  function sourceFromUrl(rawUrl, prov) {
    const url = (rawUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) { toast('Enter a provider or image URL (https://…)', 4000); return; }
    // known provider → its name+icon; otherwise fall back to the URL's host so a
    // pasted link from anywhere (e.g. nugs.net) still gets a favicon badge. #249
    if (!prov) {
      const pf = providerOf(url);
      if (pf) prov = { name: pf.name, icon: provIconUrl(pf.domain) };
      else { try { const h = new URL(url).hostname.replace(/^www\./, ''); if (h) prov = { name: h, icon: provIconUrl(h) }; } catch (e) {} }
    }
    const p = new URLSearchParams();
    p.set('x_seed.origin', releaseInfo().url);
    p.set('x_seed.image.0.url', url);
    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1100px;height:900px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(ifr);
    ifr.src = `${R}/add-${ART}?${p}`;
    asLog.info(`Source: ${(prov && prov.name) || 'URL'} — ${url}`);   // name the source attempted (mirrors tooltip)
    const slot = addSourcingSlot(prov ? `Sourcing ${prov.name}…` : 'Sourcing…');
    let done = false, lastN = 0, settleAt = 0, noUiSince = 0;
    const stop = () => { clearInterval(poll); clearTimeout(killer); try { ifr.remove(); } catch (e) {} };
    // a preview is the uploader's rendered image — usually a blob:, but in some browsers
    // ECAU leaves it as the remote provider URL (e.g. i.discogs.com). Fetch blobs in-frame;
    // fetch remote URLs via GM xhr so the page CSP can't block them (the FF-vs-Chromium
    // difference vzell hit). #242
    const previewSel = '.uploader-preview-image, img[src^="blob:"]';
    async function harvest(doc, win) {
      const files = [], metas = [];
      const seen = new Set();
      for (const img of [...doc.querySelectorAll(previewSel)]) {
        const src = img.src || img.getAttribute('src'); if (!src || seen.has(src)) continue; seen.add(src);
        let blob; try { blob = /^blob:/i.test(src) ? await win.fetch(src).then(r => r.blob()) : await gmFetch(src); } catch (e) { continue; }
        // skip a provider's logo/favicon (e.g. Amazon's smile) — decode the actual blob,
        // not the preview <img> (MB may downscale that), and drop sub-cover-sized art. #242
        try { const bmp = await (win.createImageBitmap || createImageBitmap)(blob); const big = Math.max(bmp.width, bmp.height); bmp.close && bmp.close(); if (big && big < MIN_ART_PX) continue; } catch (e) {}
        const { types, comment } = readArtMeta(img);   // #253 THIS image's own type/comment block (never doc-wide)
        const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/jpeg';
        const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        files.push(new File([blob], `ecau-${Date.now()}-${files.length}.${ext}`, { type: mime }));
        // #260 if ECAU left the preview as a remote image URL (it does for some providers,
        // e.g. Discogs → i.discogs.com), keep that DIRECT image URL alongside the page URL.
        const directUrl = /^https?:/i.test(src) ? src : '';
        metas.push({ types, comment, provider: prov && prov.name, provIcon: prov && prov.icon, provUrl: url, provImageUrl: directUrl });
      }
      return { files, metas };
    }
    const poll = setInterval(async () => {
      if (done) return;
      let doc, win; try { doc = ifr.contentDocument; win = ifr.contentWindow; } catch (e) { return; }
      if (!doc || !win) return;
      const n = doc.querySelectorAll(previewSel).length;
      if (!n) {   // nothing yet — but if ECAU has reported a failure, stop now (don't spin)
        const err = ecauError(doc);
        if (err) { done = true; stop(); dropSourcingSlot(slot); render(); toast('⚠ ' + (prov && prov.name ? prov.name + ': ' : '') + err, 13000); return; }   // #286 surface ECAU's own message (mirrors to the log)
        // ECAU absent: the add page has fully loaded but ECAU never injected its UI →
        // fail fast (~6s) with a clear message instead of spinning to the 45s timeout.
        if (doc.readyState === 'complete' && !ecauUI(doc)) {
          if (!noUiSince) noUiSince = performance.now();
          else if (performance.now() - noUiSince > 6000) { done = true; stop(); dropSourcingSlot(slot); render(); toast(NO_ECAU, 9000); }
        } else noUiSince = 0;
        return;
      }
      if (n !== lastN) { lastN = n; settleAt = performance.now() + 1500; setSourcingLabel(slot, 'Adding…'); return; }  // still arriving → wait
      if (performance.now() < settleAt) return;
      done = true;
      const { files, metas } = await harvest(doc, win);
      stop(); dropSourcingSlot(slot);
      const added = files.length ? await addFilesDeduped(files, metas) : 0;   // #253 skip an image already staged
      if (added) toast(`Added ${added} image${added > 1 ? 's' : ''} from ${(prov && prov.name) || 'provider'} ✓`);   // name the source in the log/toast
      else { render(); toast(files.length ? 'That image is already added' : `${(prov && prov.name) || 'Provider'} returned no image`, 5000); }
    }, 400);
    const killer = setTimeout(() => {
      if (done) return; done = true; stop();
      let edoc; try { edoc = ifr.contentDocument; } catch (e) {}
      const err = edoc && ecauError(edoc);   // #286 even at timeout, prefer ECAU's own failure message
      dropSourcingSlot(slot); render();
      toast(err ? ('⚠ ' + (prov && prov.name ? prov.name + ': ' : '') + err)
                : 'No image returned — is “Enhanced Cover Art Uploads” installed? It powers provider sourcing.', err ? 13000 : 9000);
    }, ECAU_TIMEOUT);
  }
  // ECAU-supported art providers we recognise on a release's external links, so the
  // popover can offer "Import from <provider>" the way the native add page does.
  // domain = the provider's CANONICAL site (not the linked subdomain, e.g.
  // analogafrica.bandcamp.com → bandcamp.com) — favicons come from there.
  const ART_PROVIDERS = [
    { re: /(^|\.)discogs\.com$/i, name: 'Discogs', domain: 'discogs.com' },
    { re: /(^|\.)bandcamp\.com$/i, name: 'Bandcamp', domain: 'bandcamp.com' },
    { re: /(^|\.)music\.apple\.com$|(^|\.)itunes\.apple\.com$/i, name: 'Apple Music', domain: 'music.apple.com' },
    { re: /(^|\.)open\.spotify\.com$|(^|\.)spotify\.com$/i, name: 'Spotify', domain: 'spotify.com' },
    { re: /(^|\.)amazon\./i, name: 'Amazon', domain: 'amazon.com' },
    { re: /(^|\.)deezer\.com$/i, name: 'Deezer', domain: 'deezer.com' },
    { re: /(^|\.)tidal\.com$/i, name: 'Tidal', domain: 'tidal.com' },
    { re: /(^|\.)qobuz\.com$/i, name: 'Qobuz', domain: 'qobuz.com' },
    { re: /(^|\.)vgmdb\.net$/i, name: 'VGMdb', domain: 'vgmdb.net' },
    { re: /7digital\./i, name: '7digital', domain: '7digital.com' },
    { re: /(^|\.)beatport\.com$/i, name: 'Beatport', domain: 'beatport.com' },
    { re: /(^|\.)junodownload\.com$|(^|\.)juno\.co\.uk$/i, name: 'Juno', domain: 'junodownload.com' },
  ];
  // Google's favicon service returns a real icon for every provider domain — more
  // reliable than guessing /favicon.ico (artist subdomains 404) or DuckDuckGo (which
  // serves a blank placeholder for some, e.g. Spotify).
  const provIconUrl = d => `https://www.google.com/s2/favicons?sz=64&domain=${d}`;
  function providerOf(url) { let h = ''; try { h = new URL(url).hostname; } catch (e) { return null; } return ART_PROVIDERS.find(x => x.re.test(h)) || null; }
  // ALL of the release/event's external link URLs (one WS2 fetch, cached) — used both by
  // the recognised-provider list and by #250 custom-provider link matching.
  let _urlRels = null;
  async function releaseUrls() {
    if (_urlRels) return _urlRels;
    try {
      const j = await fetch(`https://musicbrainz.org/ws/2/${ENT.kind}/${MBID}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null);
      _urlRels = [...new Set(((j && j.relations) || []).map(rel => rel.url && rel.url.resource).filter(Boolean))];
    } catch (e) { _urlRels = []; }
    return _urlRels;
  }
  // the release/event's external links → the recognised art providers, deduped
  async function artProviderLinks() {
    const seen = new Set(), out = [];
    for (const u of await releaseUrls()) {
      const prov = providerOf(u); if (!prov) continue;
      const key = prov.name + '|' + u; if (seen.has(key)) continue; seen.add(key);
      out.push({ name: prov.name, url: u, icon: provIconUrl(prov.domain) });
    }
    return out;
  }
  // #250 (vzell) custom providers whose declared `match` hits a link on THIS release,
  // each with the matched URL(s). A provider that declared no match is always offered.
  async function matchedCustomProviders() {
    const links = await releaseUrls();
    return _customProviders
      .map(p => ({ p, urls: p.match ? links.filter(u => { try { return p.match(u); } catch (e) { return false; } }) : [] }))
      .filter(x => !x.p.match || x.urls.length);
  }
  let _provLinks = null;   // fetched once per page; reused by the button count + the popover
  function getProvLinks() { return _provLinks ? Promise.resolve(_provLinks) : artProviderLinks().then(l => (_provLinks = l)); }
  // the count on the Source button = built-in linked platforms + matched custom providers
  // (#270 — it was only counting the platforms, so "URL (1)" showed beside a 3-button popover).
  // Re-run on render and whenever a provider registers (which may happen after the toolbar built).
  function refreshSrcCount() {
    const src = document.querySelector('.as-src'); const n = src && src.querySelector('.as-src-n'); if (!n) return;
    Promise.all([getProvLinks(), matchedCustomProviders()]).then(([l, m]) => {
      const total = l.length + m.length;
      n.textContent = total ? ` (${total})` : '';
      src.title = total
        ? `Source ${ENT.noun} — ${total} source${total > 1 ? 's' : ''} (linked platform${l.length === 1 && !m.length ? '' : 's'}, registered providers, or any URL)`
        : `Source ${ENT.noun} from a linked platform, a registered provider, or any URL`;
    }).catch(() => {});
  }
  function openSourcePop(btn) {
    _srcBtn = btn;   // #250 remembered so a late provider registration can re-open this popover
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const pop = document.createElement('div'); pop.className = 'as-pop as-src-pop';
    pop.innerHTML = `<div class="as-pop-h">Source ${ENT.noun}</div>`
      + `<div class="as-src-prov as-pop-note">Looking for linked platforms…</div>`
      + `<div class="as-src-custom"></div>`
      + `<div class="as-src-or">or paste any URL</div>`
      + `<input class="as-src-inp" placeholder="https://… provider page or image URL" spellcheck="false">`
      + `<div class="as-pop-f"><button class="as-btn as-src-go">Fetch</button></div>`
      + `<div class="as-pop-note">Powered by ROpdebee's <a href="https://github.com/ROpdebee/mb-userscripts#mb-enhanced-cover-art-uploads" target="_blank" rel="noopener">Enhanced Cover Art Uploads</a> (must be installed).</div>`;
    document.body.appendChild(pop); placePop(pop, btn.getBoundingClientRect());
    // #250 custom providers registered by other userscripts — one stacked "Import from …"
    // button each, but only for providers whose declared `match` hits a link on this release.
    const cbox = pop.querySelector('.as-src-custom');
    if (cbox && _customProviders.length) {
      matchedCustomProviders().then(matched => {
        if (!cbox.isConnected || !matched.length) return;
        cbox.innerHTML = matched.map((x, i) => `<button class="as-btn as-src-prov-b" data-ci="${i}">${x.p.icon ? `<img class="as-src-ic" src="${esc(x.p.icon)}" alt="">` : '🧩 '}⬇ Import from ${esc(x.p.name)}</button>`).join('');
        cbox.querySelectorAll('.as-src-prov-b').forEach(b => b.onclick = () => { const x = matched[+b.dataset.ci]; pop.remove(); sourceFromProvider(x.p, x.urls); });
        cbox.querySelectorAll('.as-src-ic').forEach(img => img.onerror = () => { img.style.visibility = 'hidden'; });
        placePop(pop, btn.getBoundingClientRect());
      });
    }
    const inp = pop.querySelector('.as-src-inp'); inp.focus();
    const go = () => { const v = inp.value; pop.remove(); sourceFromUrl(v); };
    pop.querySelector('.as-src-go').onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { e.preventDefault(); pop.remove(); } };
    // paste a URL → fetch immediately (no need to click Fetch). Read after the paste
    // lands; only auto-go when the whole field is a URL (typing-then-pasting won't fire).
    inp.onpaste = () => setTimeout(() => { if (/^https?:\/\//i.test(inp.value.trim())) go(); }, 0);
    // populate "Import from <provider>" buttons from the release's linked platforms
    getProvLinks().then(provs => {
      const box = pop.querySelector('.as-src-prov'); if (!box) return;
      if (!provs.length) { box.textContent = `No supported platforms linked on this ${ENT.kind}.`; placePop(pop, btn.getBoundingClientRect()); return; }
      box.classList.remove('as-pop-note');
      box.innerHTML = provs.map((p, i) => `<button class="as-btn as-src-prov-b" data-i="${i}"><img class="as-src-ic" src="${esc(p.icon)}" alt="">⬇ Import from ${esc(p.name)}</button>`).join('')
        + (provs.length > 1 ? `<button class="as-btn as-src-all">⬇ Import all ${provs.length} sources</button>` : '');
      box.querySelectorAll('.as-src-prov-b').forEach(b => b.onclick = () => { const p = provs[+b.dataset.i]; pop.remove(); sourceFromUrl(p.url, { name: p.name, icon: p.icon }); });
      const allBtn = box.querySelector('.as-src-all');
      if (allBtn) allBtn.onclick = () => { pop.remove(); provs.forEach(p => sourceFromUrl(p.url, { name: p.name, icon: p.icon })); };   // one sourcing slot per provider
      box.querySelectorAll('.as-src-ic').forEach(img => img.onerror = () => { img.style.visibility = 'hidden'; });   // hide a missing favicon (no inline handler — CSP)
      placePop(pop, btn.getBoundingClientRect());
    });
    // detect a missing/disabled ECAU and turn the footer note into a clear warning,
    // so the user knows BEFORE fetching (sourcing also fails fast if they try anyway).
    ecauInstalled().then(ok => {
      if (ok || !pop.isConnected) return;
      const note = pop.querySelector('.as-pop-note:last-child');
      if (!note) return;
      note.classList.add('as-src-warn');
      note.innerHTML = `⚠ ${esc(NO_ECAU)} <a href="https://github.com/ROpdebee/mb-userscripts#mb-enhanced-cover-art-uploads" target="_blank" rel="noopener">Install / enable →</a>`;
      placePop(pop, btn.getBoundingClientRect());
    });
    const off = e => { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  let _dropZone = false;
  function toggleDropZone() { _dropZone = !_dropZone; render(); if (_dropZone) root.querySelector('.as-dropzone')?.scrollIntoView({ block: 'nearest' }); }
  // Reveal the drop zone automatically when files are dragged onto the page, so you don't
  // have to click "Add image" first; the whole gallery then accepts the drop (the browser
  // won't navigate to the file). Internal reorder drags carry no Files, so they're ignored;
  // the zone auto-hides after a drop or when the drag leaves the window.
  let _autoDz = false;
  const isFileDrag = e => { try { return [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files'); } catch (x) { return false; } };
  window.addEventListener('dragover', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    if (!_dropZone) { _dropZone = true; _autoDz = true; render(); root.querySelector('.as-dropzone')?.scrollIntoView({ block: 'nearest' }); }
  });
  window.addEventListener('drop', async e => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); e.stopPropagation();   // stage every file drop here (a near-miss outside the zone still works); also stops the zone's own ondrop double-adding
    _autoDz = false;
    root.querySelector('.as-dropzone')?.classList.remove('over');
    const files = await filesFromDrop(e.dataTransfer);
    if (files && files.length) addFiles(files); else { _dropZone = false; render(); }
  }, true);
  window.addEventListener('dragleave', e => { if (_autoDz && !e.relatedTarget) { _dropZone = false; _autoDz = false; render(); } });
  function newItem(f, meta) {
    let types = (meta && meta.types && meta.types.length) ? meta.types.slice() : [];
    let comment = (meta && meta.comment) || '';
    if (!types.length && (SETTINGS.autoType || SETTINGS.autoComment)) {   // #243/#244 guess type + comment from the file name
      const p = parseName(f.name);
      if (SETTINGS.autoType) types = p.types;
      if (SETTINGS.autoComment && !comment && p.comment) comment = p.comment;
    }
    return { id: 'new-' + Math.random().toString(36).slice(2, 8), types, comment, order: 0, w: 0, h: 0,
      bytes: f.size, _del: false, _new: true, _pdf: f.type === 'application/pdf', _file: URL.createObjectURL(f), _fileObj: f,
      _provider: (meta && meta.provider) || '', _provIcon: (meta && meta.provIcon) || '', _provUrl: (meta && meta.provUrl) || '',   // #249 where this image was sourced (shown until committed)
      _provImageUrl: (meta && meta.provImageUrl) || '',   // #260 direct image URL when the provider exposes one (e.g. Discogs)
      _seedSrc: (meta && meta.seedSrc) || '', _seedTypes: (meta && meta.seedTypes) ? meta.seedTypes.slice() : null,   // #248 native-uploader row + last types synced from it
      _seedBlobSrc: (meta && meta.seedBlobSrc) || '',   // #253 the row's current blob URL (changes when ECAU maximises)
      _contentKey: (meta && meta.contentKey) || '',     // #253 image-content fingerprint, to drop duplicate sourced/seeded covers
      // #248 (vzell) original file name for a locally-picked/dropped upload — shown in the
      // thumb tooltip. Sourced/seeded covers carry a synthetic File name, so skip those
      // (they show their provider/source via provBadge instead). Disk path isn't recoverable.
      _uploadName: (meta && (meta.provider || meta.seedSrc)) ? '' : ((f && f.name) || ''),
      _origTypes: [], _origComment: '', _origOrder: -1 };
  }
  // #262 AS doesn't import a source's per-cover types (dropped as unreliable, #253), so
  // imports arrive untyped. Front is by far the most common, so optionally type the FIRST
  // imported cover Front. Only touches a cover with no type yet (a file-name type wins), and
  // in "when none exists" mode only when no Front is already present (existing or staged) —
  // which is the safe default: it can't create a duplicate Front. "always" can (see #262).
  function maybeAutoFront(news) {
    if (!SETTINGS.autoFront || !news.length) return;
    const first = news.find(it => !it.types.length);   // first untyped cover of this import
    if (!first) return;
    if (SETTINGS.autoFrontMode !== 'always' && MODEL.some(it => !it._del && it.types.includes('Front'))) return;   // a Front already exists
    first.types = ['Front'];
  }
  // metas (optional) carries per-file { types, comment } — used when sourcing covers
  // that already know their type/comment (e.g. ECAU provider import, #242)
  function addFiles(files, metas) {
    const news = [...files].map((f, i) => ({ f, meta: metas && metas[i] }))
      .filter(x => x.f.type.startsWith('image/') || x.f.type === 'application/pdf').map(x => newItem(x.f, x.meta));
    if (!news.length) return;
    maybeAutoFront(news);   // #262 type the first untyped imported cover Front (per setting), before they're inserted
    // new covers go FIRST (majkinetor: they were landing last), then existing in order
    const rest = MODEL.slice().sort((a, b) => a.order - b.order);
    MODEL = [...news, ...rest];
    MODEL.forEach((it, i) => it.order = i);
    news.forEach(measure);   // fill in each new cover's resolution from its local file
    _dropZone = false; render();
  }
  // #253 a content fingerprint so the same image isn't staged twice. Sourcing
  // (ECAU/MH/providers) and the add-page harvest can surface the SAME cover more
  // than once — ECAU re-fires as it maximises, a provider may return dups, etc.
  async function fileKey(file) {
    try {
      const buf = await file.arrayBuffer();
      const h = await crypto.subtle.digest('SHA-1', buf);
      return file.size + ':' + [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return 'sz' + file.size; }   // fallback: byte length only
  }
  // stage files, skipping any whose content already exists as a staged NEW cover
  // (or repeats within this batch). Returns how many were actually added.
  async function addFilesDeduped(files, metas) {
    const have = new Set(MODEL.filter(m => m._new && !m._del && m._contentKey).map(m => m._contentKey));
    const outF = [], outM = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) continue;
      const k = await fileKey(f);
      if (have.has(k)) continue;
      have.add(k);
      outF.push(f); outM.push(Object.assign({}, metas && metas[i], { contentKey: k }));
    }
    if (outF.length) addFiles(outF, outM);
    return outF.length;
  }
  // #243 a drop can include whole FOLDERS — recurse the directory entries to collect every
  // file. webkitGetAsEntry() must be read synchronously while the drop event is live.
  function filesFromDrop(dt) {
    const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (!entries.some(e => e.isDirectory)) return Promise.resolve([...(dt.files || [])]);
    const out = [];
    const walk = entry => new Promise(res => {
      if (entry.isFile) { entry.file(f => { out.push(f); res(); }, () => res()); return; }
      if (!entry.isDirectory) return res();
      const rd = entry.createReader();
      const readBatch = () => rd.readEntries(async ents => { if (!ents.length) return res(); await Promise.all(ents.map(walk)); readBatch(); }, () => res());
      readBatch();
    });
    return Promise.all(entries.map(walk)).then(() => out);
  }
  function pickFiles() {
    // Only the types MusicBrainz / the Cover Art Archive accept — `image/*` was too
    // broad (it offered webp, bmp, … which CAA rejects). JPEG · PNG · GIF · PDF.
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/gif,application/pdf'; inp.multiple = true;
    inp.onchange = () => addFiles(inp.files);
    inp.click();
  }
  // ── Phase 2a: apply staged changes as real MB edits (form-replay) ─────────────
  const R = ENT.base;          // /release/<mbid> | /event/<gid>
  const ART = ENT.art;         // cover-art | event-art — the MB endpoint + form-field suffix
  // credit the tool in every edit note (user's note first, then the attribution)
  const editNote = m => [m.note && m.note.trim(), ATTRIBUTION].filter(Boolean).join('\n\n');
  // #260 a sourced cover records where it came from in ITS OWN add edit note. The commit
  // note is shared across all ops, so this per-cover provenance is appended only to that
  // upload (sourced covers carry _provider/_provUrl; local uploads have neither → nothing added).
  const sourceLine = it => {
    if (!it) return '';
    const who = (it._provider && String(it._provider).trim()) || '';
    const page = (it._provUrl && String(it._provUrl).trim()) || '';
    const img = (it._provImageUrl && String(it._provImageUrl).trim()) || '';
    const main = page || img;
    if (!who && !main) return '';
    let s = `Cover art sourced from ${who || 'an external provider'}`;
    if (main) s += ` — ${main}`;
    if (img && img !== main) s += `\nImage: ${img}`;   // #260 the direct image URL, when distinct from the page
    return s;
  };
  const editNoteFor = (m, it) => [m.note && m.note.trim(), sourceLine(it), ATTRIBUTION].filter(Boolean).join('\n\n');
  async function getPostForm(url) {
    const html = await fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error('GET ' + r.status); return r.text(); });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const form = [...doc.querySelectorAll('form')].find(f => (f.getAttribute('method') || '').toUpperCase() === 'POST');
    if (!form) throw new Error('no POST form at ' + url);
    form._action = new URL(form.getAttribute('action') || url, location.origin + url).href;
    return form;
  }
  // carry every hidden field (csrf/nonce/etc.) verbatim — that's the point of form-replay
  function copyHidden(form, params, skip) {
    form.querySelectorAll('input[type=hidden]').forEach(h => { if (h.name && !(skip && skip.test(h.name))) params.append(h.name, h.value); });
  }
  function typeMapOf(form, prefix) {
    const m = {};
    form.querySelectorAll(`input[name="${prefix}.type_id"]`).forEach(cb => { const l = cb.closest('label'); const n = (l ? l.textContent : '').trim(); if (n) m[n] = cb.value; });
    return m;
  }
  async function buildEdit(it, meta) {   // retype / comment on an existing cover
    const form = await getPostForm(`${R}/edit-${ART}/${it.id}`);
    const p = new URLSearchParams(); copyHidden(form, p);
    const tm = typeMapOf(form, `edit-${ART}`);
    it.types.forEach(t => { if (tm[t]) p.append(`edit-${ART}.type_id`, tm[t]); });
    p.append(`edit-${ART}.comment`, it.comment);
    p.append(`edit-${ART}.edit_note`, editNote(meta));
    if (meta.votable) p.append(`edit-${ART}.make_votable`, '1');
    return { method: 'POST', url: form._action, body: p };
  }
  async function buildRemove(it, meta) {
    // #264 if the cover is already gone (e.g. removed in a prior edit but lingering in a
    // stale CAA listing), the remove form 404s — treat that as "already removed", not an error.
    let form;
    try { form = await getPostForm(`${R}/remove-${ART}/${it.id}`); }
    catch (e) { if (/\b404\b/.test(String((e && e.message) || e))) return { noop: true, note: 'already removed (not on the release)' }; throw e; }
    const p = new URLSearchParams(); copyHidden(form, p);
    p.append('confirm.edit_note', editNote(meta));
    if (meta.votable) p.append('confirm.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  // Phase 2b: upload a new image. (1) sign via MB, (2) POST file to archive.org, (3) register.
  // The sign endpoint reserves an image_id/nonce per call and fetches an S3 policy from the
  // Internet Archive, so concurrent calls for the same release RACE and 500 — committing 6
  // covers, only the 1st succeeded and the rest failed "sign 500". So serialise signing
  // through a gate (the slow S3 PUT still overlaps) and retry transient 5xx/429 (IA flakes).
  let _signGate = Promise.resolve();
  async function signUploadRaw(mime, ctl) {
    for (let attempt = 1; ; attempt++) {
      if (ctl && ctl.aborted) throw new Error('cancelled');
      const r = await fetch(`/ws/js/${ART}-upload/${MBID}?mime_type=${encodeURIComponent(mime || 'image/jpeg')}`, { credentials: 'same-origin', signal: ctl && ctl.ac.signal });
      if (r.ok) return r.json();   // { action, image_id, formdata, nonce }
      if (attempt >= 4 || ![429, 500, 502, 503, 504].includes(r.status)) throw new Error('sign ' + r.status);
      asLog.debug(`Upload: sign got ${r.status}, retrying (${attempt}/3)`);
      await new Promise(res => setTimeout(res, 500 * attempt + Math.floor(Math.random() * 400)));   // backoff + jitter
    }
  }
  function signUpload(mime, ctl) {
    const run = () => signUploadRaw(mime, ctl);
    const p = _signGate.then(run, run);   // one sign at a time, regardless of prior failures
    _signGate = p.catch(() => {});
    return p;
  }
  let _addForm = null;
  const addForm = () => (_addForm = _addForm || getPostForm(`${R}/add-${ART}`));
  // step 1: sign (serialised by the gate above) then PUT the file to archive.org. Stores
  // the signed upload on the item; the slow PUT is the part that overlaps across items.
  async function uploadStep(it, onProgress, ctl) {
    if (ctl && ctl.aborted) throw new Error('cancelled');
    const mime = (it._fileObj && it._fileObj.type) || 'image/jpeg';
    const signed = await signUpload(mime, ctl);
    if (ctl && ctl.aborted) throw new Error('cancelled');
    const fd = new FormData();
    Object.entries(signed.formdata).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', it._fileObj, (it._fileObj && it._fileObj.name) || String(signed.image_id));
    // XHR (not fetch) so we get upload progress + a timeout — a big cover used to
    // sit silently with no feedback, and a stalled POST would hang forever. #240/#235
    // The live xhr is registered on ctl so Cancel can abort an in-flight upload.
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', signed.action);
      xhr.timeout = 300000;   // 5 min ceiling for large covers
      if (ctl) ctl.xhrs.add(xhr);
      const done = () => { if (ctl) ctl.xhrs.delete(xhr); };
      xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); };
      xhr.onload = () => { done(); (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('IA upload ' + xhr.status)); };
      xhr.onerror = () => { done(); reject(new Error('IA upload network error')); };
      xhr.ontimeout = () => { done(); reject(new Error('IA upload timed out')); };
      xhr.onabort = () => { done(); reject(new Error('cancelled')); };
      xhr.send(fd);
    });
    it._signed = signed;
  }
  // step 2 (SEQUENTIAL): register on MB. Submitted in order so positions stay correct.
  async function registerStep(it, meta, ctl) {
    const form = await addForm();
    const tm = typeMapOf(form, `add-${ART}`);
    const typeIds = it.types.map(t => tm[t]).filter(Boolean);
    const mime = (it._fileObj && it._fileObj.type) || 'image/jpeg';
    const p = new URLSearchParams(); copyHidden(form, p, /\.(nonce|position|id|type_id|comment|mime_type)$/);
    p.append(`add-${ART}.id`, it._signed.image_id);
    p.append(`add-${ART}.position`, String(it.order + 1));
    p.append(`add-${ART}.nonce`, it._signed.nonce);
    p.append(`add-${ART}.mime_type`, mime);   // required Select (MB Form::Role::AddArt)
    typeIds.forEach(id => p.append(`add-${ART}.type_id`, id));
    p.append(`add-${ART}.comment`, it.comment);
    p.append(`add-${ART}.edit_note`, editNoteFor(meta, it));   // #260 include this cover's source, if any
    if (meta.votable) p.append(`add-${ART}.make_votable`, '1');
    const add = await fetch(`${R}/add-${ART}`, { method: 'POST', body: p, credentials: 'same-origin', signal: ctl && ctl.ac.signal });
    if (!add.ok) throw new Error('add ' + add.status);
  }
  async function runAdd(it, meta, dry, report) {   // dry-run summary only (live uses runAdds)
    const mime = (it._fileObj && it._fileObj.type) || 'image/jpeg';
    const form = await addForm();
    const typeIds = it.types.map(t => typeMapOf(form, `add-${ART}`)[t]).filter(Boolean);
    report(`1. GET /ws/js/${ART}-upload/${MBID}?mime_type=${mime}  → {action,image_id,formdata,nonce}\n`
      + `2. POST ‹signed archive.org action›  multipart: ‹policy,signature,key,AWSAccessKeyId…› + file (${(it._fileObj && it._fileObj.name) || 'file'}, ${(it._fileObj && it._fileObj.size) || '?'}b)\n`
      + `3. POST ${R}/add-${ART}\n   add-${ART}.id=‹image_id›\n   add-${ART}.position=${it.order + 1}\n   add-${ART}.nonce=‹nonce›\n   add-${ART}.mime_type=${mime}\n`
      + `   add-${ART}.type_id=${typeIds.join(',') || '(none)'}\n   add-${ART}.comment=${it.comment}\n   add-${ART}.edit_note=${editNoteFor(meta, it).replace(/\n+/g, ' / ')}`
      + (meta.votable ? `\n   add-${ART}.make_votable=1` : ''));
  }
  async function buildReorder(meta) {     // single edit: full ordered artwork list
    const form = await getPostForm(`${R}/reorder-${ART}`);
    const p = new URLSearchParams(); copyHidden(form, p, /\.artwork\./);
    // #261 the full final order — NEW covers included by their post-upload image_id (runs
    // after the uploads register). MB's add `position` only places the whole upload as a
    // group, so without this the relative order of multiple new covers (or a new cover
    // slotted among existing ones) isn't preserved.
    const seq = MODEL.filter(it => !it._del && !it._sourcing).sort((a, b) => a.order - b.order);
    let n = 0;
    for (const it of seq) {
      const id = it._new ? (it._signed && it._signed.image_id) : it.id;
      if (!id) continue;   // a new cover whose upload failed — leave it out of the ordering
      p.append(`reorder-${ART}.artwork.${n}.id`, id);
      p.append(`reorder-${ART}.artwork.${n}.position`, String(n + 1));
      n++;
    }
    p.append(`reorder-${ART}.edit_note`, editNote(meta));
    if (meta.votable) p.append(`reorder-${ART}.make_votable`, '1');
    return { method: 'POST', url: form._action, body: p };
  }
  // ordered work list (uploads are Phase 2b): remove → retype/comment → reorder
  function buildPlan() {
    const plan = [];
    MODEL.filter(it => it._new && !it._del && !it._sourcing).forEach(it => plan.push({ label: `Add ${it.types[0] || 'new image'}${it.comment ? ` “${it.comment}”` : ''} (upload)`, kind: 'add', it, run: (m, dry, report) => runAdd(it, m, dry, report) }));
    MODEL.filter(it => it._del && !it._new).forEach(it => plan.push({ label: `Remove ${it.types[0] || ITEM}`, id: it.id, kind: 'remove', build: m => buildRemove(it, m) }));
    MODEL.filter(it => !it._del && !it._new && (it.comment !== it._origComment || it.types.join('|') !== it._origTypes.join('|')))
      .forEach(it => {
        // readable description of what changed on this cover (the panel list now
        // doubles as the "pending operations" view — #234)
        const ch = [];
        if (it.types.join('|') !== it._origTypes.join('|')) ch.push(`type → ${it.types.join(', ') || '(none)'}`);
        if (it.comment !== it._origComment) ch.push(`comment → ${it.comment ? `“${it.comment}”` : '(cleared)'}`);
        plan.push({ label: `Edit ${it._origTypes[0] || ITEM}: ${ch.join(', ')}`, id: it.id, kind: 'edit', build: m => buildEdit(it, m) });
      });
    const ex = MODEL.filter(it => !it._del && !it._new);
    const now = ex.slice().sort((a, b) => a.order - b.order).map(it => it.id).join(',');
    const orig = ex.slice().sort((a, b) => a._origOrder - b._origOrder).map(it => it.id).join(',');
    // #261 reorder when the existing order changed OR new covers were uploaded among
    // others (their order isn't honoured by the per-upload position alone). Needs ≥2 covers.
    const all = MODEL.filter(it => !it._del && !it._sourcing);
    const reorderNeeded = all.length >= 2 && (now !== orig || all.some(it => it._new));
    if (reorderNeeded) plan.push({ label: 'Reorder ' + ITEMS, kind: 'reorder', build: m => buildReorder(m) });
    return plan;
  }

  function enterEdit() {
    document.getElementById('as-commit')?.remove();
    const plan = buildPlan();
    const ov = document.createElement('div'); ov.id = 'as-commit';
    ov.innerHTML = `<div class="as-cm-box">
      <div class="as-cm-h"><span class="as-cm-h-t">Apply ${plan.length} change${plan.length===1?'':'s'} as MusicBrainz edits</span><a class="as-cm-hist" href="${ART_EDITS_URL}" target="_blank" rel="noopener noreferrer" title="Your ${ENT.noun} edits on MusicBrainz">🕓 My ${ENT.Noun} edits</a></div>
      <div class="as-cm-prog" hidden><div class="as-cm-prog-track"><div class="as-cm-prog-fill"></div></div><span class="as-cm-prog-txt"></span></div>
      <div class="as-cm-list">${plan.map((o, i) => `<div class="as-cm-op" data-i="${i}"><div class="as-cm-line"><span class="as-cm-st">○</span> <span class="as-cm-lb">${esc(o.label)}</span>${o.id ? ` <span class="as-cm-id">#${esc(o.id)}</span>` : ''}${o.skip ? `<span class="as-cm-skip">${esc(o.skip)}</span>` : ''}<span class="as-cm-bar"><span class="as-cm-bfill"></span></span></div><div class="as-cm-payload"></div></div>`).join('')}</div>
      <textarea class="as-cm-note edit-note" rows="2" placeholder="optional edit note shown on each edit"></textarea>
      <div class="as-cm-f"><label class="as-cm-dry"><input type="checkbox" class="as-cm-dryrun"> Dry run</label><label class="as-cm-chk"><input type="checkbox" class="as-cm-vote"> Make votable</label><span class="as-sp"></span><button class="as-btn as-cm-cancel">Cancel</button><button class="as-btn as-cm-go">Run</button></div>
    </div>`;
    document.body.appendChild(ov);
    if (IS_ADD && _seedNote) ov.querySelector('.as-cm-note').value = _seedNote;   // #248 carry over the add page's edit note
    // backdrop click closes — but NOT while a live run is in flight (#269): that
    // path bypassed the abort, orphaning the in-flight edits. During a run the only
    // exits are Cancel (aborts) or Close (after it finishes).
    ov.onclick = e => { if (e.target === ov && !ov._running) ov.remove(); };
    ov.querySelector('.as-cm-cancel').onclick = () => ov.remove();
    const dryEl = ov.querySelector('.as-cm-dryrun');
    const goBtn = ov.querySelector('.as-cm-go');
    const setGoLabel = () => goBtn.textContent = dryEl.checked ? 'Dry run' : 'Submit edits';
    dryEl.onchange = setGoLabel; setGoLabel();
    goBtn.onclick = () => runPlan(ov, plan, { note: ov.querySelector('.as-cm-note').value, votable: ov.querySelector('.as-cm-vote').checked, dry: dryEl.checked });
  }
  // #278: per-row progress bar pinned on the right of each op row. `pct` null →
  // leave the width; `state` colours it (busy=indeterminate sweep, ''=in-progress
  // accent, done=green, dry=muted, err=red, cancel=grey).
  function setRowBar(row, pct, state) {
    if (!row) return;
    const bar = row.querySelector('.as-cm-bar'); if (!bar) return;
    bar.classList.add('on');
    bar.classList.remove('busy', 'done', 'dry', 'err', 'cancel');
    if (state) bar.classList.add(state);
    if (pct != null) { const f = bar.querySelector('.as-cm-bfill'); if (f) f.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  }
  async function runOp(ov, op, meta, ctl) {
    const row = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`);
    const st = row.querySelector('.as-cm-st'), pay = row.querySelector('.as-cm-payload');
    if (op.skip) { st.textContent = '⏭'; return; }
    if (ctl && ctl.aborted) { st.textContent = '⛔'; setRowBar(row, 100, 'cancel'); return; }
    st.textContent = '⏳'; setRowBar(row, null, 'busy');
    if (!meta.dry && !op.run) asLog.info(`${op.label} — applying…`);   // make each commit operation visible as it runs
    try {
      if (op.run) {                         // multi-step op (uploads) reports its own payload
        await op.run(meta, meta.dry, txt => { pay.textContent = txt; });
        st.textContent = meta.dry ? '👁' : '✅'; if (meta.dry) row.classList.add('dry');
        setRowBar(row, 100, meta.dry ? 'dry' : 'done');
      } else {
        const req = await op.build(meta);
        if (req && req.noop) { st.textContent = '✅'; pay.textContent = req.note || 'nothing to do'; setRowBar(row, 100, 'done'); return; }   // #264 already-done op (e.g. removing a cover that's already gone)
        if (meta.dry) {
          st.textContent = '👁'; row.classList.add('dry');
          pay.textContent = `${req.method} ${req.url}\n${decodeURIComponent(req.body.toString()).replace(/\+/g, ' ').replace(/&/g, '\n  ')}`;
          setRowBar(row, 100, 'dry');
        } else {
          const r = await fetch(req.url, { method: 'POST', body: req.body, credentials: 'same-origin', signal: ctl && ctl.ac.signal });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          st.textContent = '✅'; setRowBar(row, 100, 'done');
          asLog.ok(`Edit: ${op.label}`);
        }
      }
    } catch (e) {
      const cancelled = ctl && ctl.aborted;
      st.textContent = cancelled ? '⛔' : '❌'; pay.textContent = String(e && e.message || e);
      setRowBar(row, 100, cancelled ? 'cancel' : 'err');
      if (!cancelled) { row.classList.add('err'); op._err = true; logErr(`Edit: ${op.label}`, e); }   // #275: flag for the Repeat retry
    }
  }
  // bounded-concurrency map
  async function pool(items, conc, fn) {
    let i = 0;
    const worker = async () => { while (i < items.length) { const k = i++; await fn(items[k]); } };
    await Promise.all(Array.from({ length: Math.min(conc, items.length || 1) }, worker));
  }
  const runPool = (ops, conc, ov, meta, ctl) => pool(ops, conc, op => runOp(ov, op, meta, ctl));
  // adds: parallel UPLOAD to archive.org, then SEQUENTIAL register (positions stay correct) — like Turbo
  async function runAdds(ov, addOps, meta, ctl) {
    if (meta.dry || !addOps.length) return runPool(addOps, meta.dry ? 8 : 1, ov, meta, ctl);
    const rowOf = op => ov.querySelector(`.as-cm-op[data-i="${op._i}"]`);
    const setSt = (op, s) => { rowOf(op).querySelector('.as-cm-st').textContent = s; };
    const fail = (op, e) => { const row = rowOf(op); row.querySelector('.as-cm-st').textContent = '❌'; row.querySelector('.as-cm-payload').textContent = String(e && e.message || e); row.classList.add('err'); op._err = true; setRowBar(row, 100, 'err'); logErr(`Upload: ${op.label}`, e); };
    const stop = (op) => { setSt(op, '⛔'); op._err = true; setRowBar(rowOf(op), 100, 'cancel'); };
    addOps.forEach(op => { setSt(op, '⏳'); setRowBar(rowOf(op), null, 'busy'); });
    await pool(addOps, 4, async op => {
      if (ctl && ctl.aborted) return stop(op);
      // #278: the live upload % drives the per-row bar (was a cramped inline "⏫94%")
      const sz = (op.it && op.it._fileObj && op.it._fileObj.size) ? ` (${fmtBytes(op.it._fileObj.size)})` : '';
      asLog.info(`Upload: ${op.label}${sz} — uploading to archive.org…`);
      try { await uploadStep(op.it, (l, t) => { setSt(op, '⏫'); setRowBar(rowOf(op), l / t * 100, ''); }, ctl); setSt(op, '⏫'); setRowBar(rowOf(op), 100, ''); asLog.debug(`Upload: ${op.label} — uploaded, awaiting register`); }
      catch (e) { (ctl && ctl.aborted) ? stop(op) : fail(op, e); }
    });  // parallel upload w/ progress (abortable via ctl)
    for (const op of addOps) {                                   // ordered register
      if (op._err) continue;
      if (ctl && ctl.aborted) { stop(op); continue; }
      try { await registerStep(op.it, meta, ctl); setSt(op, '✅'); setRowBar(rowOf(op), 100, 'done'); asLog.ok(`Upload: ${op.label} — registered on MusicBrainz ✓`); }
      catch (e) { (ctl && ctl.aborted) ? stop(op) : fail(op, e); }
    }
  }
  async function runPlan(ov, plan, meta, opsToRun) {
    const goBtn = ov.querySelector('.as-cm-go'), cancelBtn = ov.querySelector('.as-cm-cancel');
    goBtn.disabled = true;
    // #275: `opsToRun` set → Repeat run (just the failed ops). Keep the original
    // `_i` row mapping; reset each retried row's ❌/error back to pending first.
    const isRepeat = !!opsToRun;
    const ops = opsToRun || plan;
    if (!isRepeat) plan.forEach((op, i) => { op._i = i; });
    else ops.forEach(op => {
      op._err = false;
      const row = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`);
      if (row) { row.classList.remove('err'); const st = row.querySelector('.as-cm-st'); if (st) st.textContent = '○'; const pl = row.querySelector('.as-cm-payload'); if (pl) pl.textContent = ''; }
    });
    // ctl carries the abort flag + the live xhrs/fetch-signal so Cancel works mid-run
    const ctl = { aborted: false, xhrs: new Set(), ac: new AbortController() };
    // #269 while a live run is in flight: block accidental backdrop dismissal (see
    // enterEdit) AND warn before the page is unloaded, so edits can't be silently
    // orphaned by clicking out or navigating away. Both are cleared the moment the
    // run finishes — the unload guard BEFORE the clean-run auto-reload below, or it
    // would block its own reload.
    let unloadGuard = null;
    if (!meta.dry) {
      ov._running = true;
      unloadGuard = e => { e.preventDefault(); e.returnValue = ''; return ''; };
      window.addEventListener('beforeunload', unloadGuard);
    }
    const endRun = () => { ov._running = false; if (unloadGuard) { window.removeEventListener('beforeunload', unloadGuard); unloadGuard = null; } };
    if (meta.dry) { cancelBtn.disabled = true; }
    else {
      cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => {                 // abort in-flight uploads + skip the rest
        if (ctl.aborted) { ov.remove(); return; }
        ctl.aborted = true;
        try { ctl.ac.abort(); } catch (e) {}
        ctl.xhrs.forEach(x => { try { x.abort(); } catch (e) {} });
        cancelBtn.textContent = 'Cancelling…'; cancelBtn.disabled = true;
      };
    }
    const CONC = meta.dry ? 8 : 4;   // modest concurrency live to stay friendly to MB
    // #278: overall progress — a big batch buries "how much is left" in a long scroll,
    // so show a header bar + "done / total" that ticks as each op reaches a terminal
    // state. Polled (not threaded through every status-set site) so the count is robust.
    const prog = ov.querySelector('.as-cm-prog');
    const progFill = prog.querySelector('.as-cm-prog-fill'), progTxt = prog.querySelector('.as-cm-prog-txt');
    const tickOverall = () => {
      let done = 0;
      for (const op of ops) { const r = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`); const s = r ? r.querySelector('.as-cm-st').textContent : ''; if ('✅👁❌⛔⏭'.includes(s)) done++; }
      const total = ops.length, pct = total ? Math.round(done / total * 100) : 100;
      progFill.style.width = pct + '%';
      progTxt.textContent = `${done} / ${total} · ${pct}%`;
    };
    prog.hidden = false; tickOverall();
    const progTimer = setInterval(tickOverall, 150);
    if (!meta.dry) asLog.info(`Commit: ${isRepeat ? 'retrying' : 'applying'} ${ops.length} edit${ops.length === 1 ? '' : 's'}${meta.votable ? ' (votable)' : ''}`);
    // uploads run in parallel (register stays ordered); edits/removes parallel; reorder last.
    try {
      await runAdds(ov, ops.filter(o => o.kind === 'add'), meta, ctl);
      if (!ctl.aborted) await runPool(ops.filter(o => o.kind === 'edit' || o.kind === 'remove'), CONC, ov, meta, ctl);
      if (!ctl.aborted) await runPool(ops.filter(o => o.kind === 'reorder'), 1, ov, meta, ctl);
    } finally {
      clearInterval(progTimer); tickOverall();   // settle the overall bar on the final tally
      endRun();   // run finished/failed — re-allow backdrop close and drop the unload guard (before any auto-reload)
    }
    cancelBtn.disabled = false;
    cancelBtn.textContent = 'Close';
    cancelBtn.onclick = () => ov.remove();
    if (ctl.aborted) {   // mark any not-yet-started ops as cancelled, leave the modal up
      ov.querySelectorAll('.as-cm-op').forEach(r => { const s = r.querySelector('.as-cm-st'); if (s.textContent === '○' || s.textContent === '⏳') { s.textContent = '⛔'; setRowBar(r, 100, 'cancel'); } });
      tickOverall();
      asLog.warn('Commit: cancelled by user');
      goBtn.textContent = 'Cancelled'; goBtn.disabled = true;
      return;
    }
    if (!meta.dry) {
      const b = ov.querySelector('.as-cm-go');
      const errs = ov.querySelectorAll('.as-cm-op.err').length;
      asLog[errs ? 'warn' : 'ok'](`Commit: finished — ${errs ? `${errs} failed of ${ops.length}` : `all ${ops.length} succeeded`}`);
      if (!errs) {
        // #234: clean run → reload automatically so the gallery shows the new
        // state (brief pause so the ✅s are visible first).
        // #248 on the add page there's nothing to reload INTO — land on the cover-art
        // tab so the freshly-uploaded covers show in the normal gallery.
        b.textContent = IS_ADD ? 'Done — opening cover art…' : 'Done — reloading…'; b.disabled = true;
        b.classList.remove('as-cm-repeat');   // clear the error styling if a repeat just went clean
        setTimeout(() => { if (IS_ADD) location.href = `${ENT.base}/${ENT.art}`; else location.reload(); }, 900);
      } else {
        // #275: something failed — offer to RE-RUN just the failed ops in place
        // (uploads / comment / type changes are expensive to redo by hand, so
        // don't force a full reload that throws the staged work away). Reddish to
        // signal the error state.
        b.textContent = `Repeat (${errs} failed)`; b.disabled = false;
        b.classList.add('as-cm-repeat');
        b.onclick = () => runPlan(ov, plan, meta, plan.filter(o => o._err));
      }
    }
    else ov.querySelector('.as-cm-go').disabled = false;
  }

  // ── lightbox (#230: click image → popup, ←→↑↓ navigate) ───────────────────────
  let _lb = null;          // current lightbox image id
  let _z = { s: 1, x: 0, y: 0 };   // wheel-zoom state (scale + translate)
  let _pinch = null, _pan = null;  // #251 active touch pinch-zoom / one-finger pan
  function applyZoom(img) { img.style.transform = `translate(${_z.x}px,${_z.y}px) scale(${_z.s})`; img.style.cursor = _z.s > 1 ? 'grab' : ''; }
  function resetZoom() { _z = { s: 1, x: 0, y: 0 }; const img = document.querySelector('.as-lb-img'); if (img) applyZoom(img); }
  // keyboard zoom (↑/↓ in the lightbox) — anchored on the image centre, same step as the wheel
  function zoomKey(dir) {
    const img = document.querySelector('.as-lb-img'); if (!img) return;
    const ns = Math.min(8, Math.max(1, _z.s * (dir > 0 ? 1.2 : 1 / 1.2)));
    if (ns === _z.s) return;
    const r = ns / _z.s; _z.x *= r; _z.y *= r; _z.s = ns;
    if (ns === 1) { _z.x = 0; _z.y = 0; }
    applyZoom(img);
  }
  const visible = () => grouped().flatMap(g => g.items);   // flat, in displayed order
  function openLightbox(id) {
    const it0 = byId(id);
    if (it0 && it0._pdf) { window.open(it0._img, '_blank', 'noopener'); return; }   // PDFs render in a new tab
    _lb = id; _cursorId = id; _lbEditCmt = false;
    let ov = document.getElementById('as-lb');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'as-lb';
      ov.innerHTML = `<button class="as-lb-del" title="Mark for removal (Del)">🗑️</button>
        <div class="as-lb-top"><button class="as-lb-play" title="slideshow (P)">▶ Play</button><button class="as-lb-x" title="close (Esc)">✕</button></div>
        <button class="as-lb-nav as-lb-prev" title="previous (←)">‹</button>
        <img class="as-lb-img" alt="">
        <button class="as-lb-nav as-lb-next" title="next (→)">›</button>
        <div class="as-lb-bar"><div class="as-lb-caprow"><div class="as-lb-cap"></div>
          <div class="as-lb-dlwrap"><button class="as-lb-dl" title="Download original">⬇ Download</button><button class="as-lb-dlcaret" title="Other sizes">▾</button>
            <div class="as-lb-dlmenu"><button data-sz="original">Original</button><button data-sz="1200">1200 px</button><button data-sz="500">500 px</button><button data-sz="250">250 px</button></div></div></div>
          <div class="as-lb-cmtarea"></div></div>`;
      document.body.appendChild(ov);
      ov.querySelector('.as-lb-x').onclick = closeLightbox;
      ov.querySelector('.as-lb-del').onclick = e => { e.stopPropagation(); deleteLbCover(); };
      const dlMenu = ov.querySelector('.as-lb-dlmenu');
      let _dlJustClosed = false;
      ov.querySelector('.as-lb-dl').onclick = e => { e.stopPropagation(); dlMenu.classList.remove('open'); const it = byId(_lb); if (it) dlOne(it); };
      ov.querySelector('.as-lb-dlcaret').onclick = e => { e.stopPropagation(); dlMenu.classList.toggle('open'); };
      dlMenu.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); dlMenu.classList.remove('open'); const it = byId(_lb); if (it) dlOne(it, b.dataset.sz); });
      // click anywhere outside the Download control closes its size menu (capture so it
      // fires regardless of stopPropagation). _dlJustClosed bridges the mousedown→click
      // gap so a backdrop click that dismisses the menu doesn't also close the viewer.
      document.addEventListener('mousedown', e => {
        if (dlMenu.classList.contains('open') && !(e.target.closest && e.target.closest('.as-lb-dlwrap'))) {
          dlMenu.classList.remove('open'); _dlJustClosed = true; setTimeout(() => { _dlJustClosed = false; }, 0);
        }
      }, true);
      ov.querySelector('.as-lb-play').onclick = e => { e.stopPropagation(); togglePlay(); };
      ov.querySelector('.as-lb-prev').onclick = e => { e.stopPropagation(); lbNav(-1); };
      ov.querySelector('.as-lb-next').onclick = e => { e.stopPropagation(); lbNav(1); };
      // a backdrop click while a type popover is open OR the comment is focused
      // should dismiss THAT (handled by their own outside-click/blur), not close
      // the whole viewer — _popJustClosed / _lbJustBlurred bridge the mousedown→click gap
      ov.onclick = e => { if (e.target === ov && !_popJustClosed && !_lbJustBlurred && !_dlJustClosed && !document.querySelector('.as-pop')) closeLightbox(); };
      // wheel zooms the image toward the cursor (instead of scrolling the page behind)
      ov.addEventListener('wheel', e => {
        e.preventDefault();
        const img = ov.querySelector('.as-lb-img'); const r = img.getBoundingClientRect();
        const cx = r.left + r.width / 2 - _z.x, cy = r.top + r.height / 2 - _z.y;   // untransformed centre
        const relx = e.clientX - cx, rely = e.clientY - cy;
        const ns = Math.min(8, Math.max(1, _z.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        if (ns === _z.s) return;
        _z.x = relx - ns * (relx - _z.x) / _z.s; _z.y = rely - ns * (rely - _z.y) / _z.s; _z.s = ns;
        if (ns === 1) { _z.x = 0; _z.y = 0; }
        applyZoom(img);
      }, { passive: false });
      // drag to pan when zoomed
      ov.querySelector('.as-lb-img').addEventListener('mousedown', e => {
        if (_z.s <= 1) return; e.preventDefault();
        const sx = e.clientX, sy = e.clientY, ox = _z.x, oy = _z.y, img = e.currentTarget;
        const mv = ev => { _z.x = ox + (ev.clientX - sx); _z.y = oy + (ev.clientY - sy); applyZoom(img); };
        const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      });
      // #251 mobile: just the full image — swipe left/right to navigate, swipe down
      // to close, tap toggles the controls; pinch to zoom, one finger to pan, tap to
      // reset. (hidden chrome by default on a touch screen.)
      ov.classList.toggle('as-lb-touch', matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
      let tsx = 0, tsy = 0, tmoved = false, tmulti = false;
      ov.addEventListener('touchstart', e => { tmulti = e.touches.length > 1; if (tmulti) return; tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; tmoved = false; }, { passive: true });
      ov.addEventListener('touchmove', e => { if (tmulti || e.touches.length > 1) { tmulti = true; return; } if (Math.hypot(e.touches[0].clientX - tsx, e.touches[0].clientY - tsy) > 8) tmoved = true; }, { passive: true });
      ov.addEventListener('touchend', e => {
        if (tmulti) return;                               // a pinch/2-finger gesture, not a swipe
        if (_z.s > 1) { if (!tmoved && !_pinch) resetZoom(); return; }   // zoomed: tap → fit, else pan handled it
        const t = e.changedTouches[0], dx = t.clientX - tsx, dy = t.clientY - tsy;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { lbNav(dx < 0 ? 1 : -1); return; }
        if (dy > 80 && dy > Math.abs(dx) * 1.3) { closeLightbox(); return; }
        if (!tmoved) ov.classList.toggle('as-lb-chrome');   // tap toggles the controls
      }, { passive: true });
      // pinch-zoom toward the pinch midpoint (mirrors the wheel zoom), one-finger pan when zoomed
      const limg = ov.querySelector('.as-lb-img');
      const tdist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      limg.addEventListener('touchstart', e => {
        if (e.touches.length === 2) { e.preventDefault(); const m = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }; _pinch = { d0: tdist(e.touches[0], e.touches[1]), s0: _z.s, x0: _z.x, y0: _z.y, m }; _pan = null; }
        else if (e.touches.length === 1 && _z.s > 1) { _pan = { x: e.touches[0].clientX, y: e.touches[0].clientY, x0: _z.x, y0: _z.y }; }
      }, { passive: false });
      limg.addEventListener('touchmove', e => {
        if (_pinch && e.touches.length === 2) {
          e.preventDefault();
          const ns = Math.min(8, Math.max(1, _pinch.s0 * tdist(e.touches[0], e.touches[1]) / _pinch.d0));
          const r = limg.getBoundingClientRect(), cx = r.left + r.width / 2 - _z.x, cy = r.top + r.height / 2 - _z.y;
          const relx = _pinch.m.x - cx, rely = _pinch.m.y - cy;
          _z.x = relx - ns * (relx - _pinch.x0) / _pinch.s0; _z.y = rely - ns * (rely - _pinch.y0) / _pinch.s0; _z.s = ns;
          if (ns === 1) { _z.x = 0; _z.y = 0; }
          applyZoom(limg);
        } else if (_pan && e.touches.length === 1 && _z.s > 1) {
          e.preventDefault();
          _z.x = _pan.x0 + (e.touches[0].clientX - _pan.x); _z.y = _pan.y0 + (e.touches[0].clientY - _pan.y); applyZoom(limg);
        }
      }, { passive: false });
      limg.addEventListener('touchend', e => { if (e.touches.length < 2) _pinch = null; if (e.touches.length === 0) _pan = null; }, { passive: false });
    }
    resetZoom();   // a fresh open starts un-zoomed; ←/→ navigation keeps the zoom
    ov.classList.remove('as-lb-chrome');   // #251 touch: start as just-the-image, tap to reveal controls
    paintLightbox();
    preloadNeighbors();
    ov.style.display = 'flex';
  }
  // prefetch the adjacent covers' 1200px so arrow-nav is instant
  const _preloaded = new Set();
  function preloadNeighbors() {
    const seq = visible().filter(it => !it._pdf);
    const i = seq.findIndex(it => String(it.id) === String(_lb));
    if (i < 0 || !seq.length) return;
    [1, 2, -1, -2].forEach(d => {        // prefetch 2 covers each way so nav stays instant
      const it = seq[(i + d + seq.length) % seq.length];
      if (it && !it._new && !_preloaded.has(it.id)) { _preloaded.add(it.id); const im = new Image(); im.src = thumb(it.id, 1200); }
    });
  }
  function paintLightbox() {
    const ov = document.getElementById('as-lb'); if (!ov) return;
    const it = byId(_lb); if (!it) return;
    const img = ov.querySelector('.as-lb-img');
    const src = it._new ? it._file : thumb(it.id, 1200);
    // NOTE: no resetZoom here — the zoom level is kept while navigating ←/→ (#234);
    // it's reset only on a fresh open (openLightbox) and on close.
    ov.classList.remove('na');
    // hide until the NEW src has decoded — otherwise the previous image lingers
    // visibly while the 1200px loads ("original shows shortly")
    img.classList.add('loading');
    img.onload = () => { img.classList.remove('loading'); ov.classList.remove('na'); };
    img.onerror = () => {
      // thumbnails aren't generated yet (pending / just uploaded) — show the original,
      // which MB serves before the thumbs exist (its "original" link). #230
      if (!it._new && it._img && img.src !== it._img) { img.src = it._img; return; }
      img.classList.remove('loading'); ov.classList.add('na');
    };
    img.src = src;
    if (img.complete && img.naturalWidth) img.classList.remove('loading');
    const dims = it.w && it.h ? `${it.w} × ${it.h}` : '';
    const cap = ov.querySelector('.as-lb-cap');
    // type is a clickable chip (same picker as the grid pills) so it can be set full-screen
    cap.innerHTML = `<button class="as-lb-type${it.types.length ? '' : ' as-type-add'}" title="set ${ITEM} type">${it.types.length ? esc(it.types.join(', ')) : '＋ type'}</button>${dims ? `<span class="as-lb-dim">${esc(dims)}</span>` : ''}`;
    cap.querySelector('.as-lb-type').onclick = e => {
      e.stopPropagation();
      openTypePopFor(byId(_lb), e.currentTarget, () => { _lbDirty = true; paintLightbox(); });
    };
    paintCmtArea(ov, it);
  }
  let _lbEditCmt = false;
  let _lbJustBlurred = false;   // bridges the mousedown-blur → click gap so defocusing the comment doesn't also close the viewer
  function paintCmtArea(ov, it) {
    const area = ov.querySelector('.as-lb-cmtarea'); if (!area) return;
    if (_lbEditCmt) {
      area.innerHTML = `<input class="as-lb-cmt" placeholder="comment…" spellcheck="false" list="as-cmt-presets">`;
      const inp = area.querySelector('.as-lb-cmt'); inp.value = it.comment || '';
      inp.oninput = () => { const cur = byId(_lb); if (cur) { cur.comment = inp.value; _lbDirty = true; } };
      inp.onblur = () => { _lbEditCmt = false; _lbJustBlurred = true; setTimeout(() => { _lbJustBlurred = false; }, 0); paintCmtArea(ov, byId(_lb)); };
      // Enter saves and advances to the next image, keeping its comment open for editing.
      inp.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); inp.blur(); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const cur = byId(_lb); if (cur) { cur.comment = inp.value; _lbDirty = true; }
        inp.onblur = null;   // we drive the transition — don't let the stale blur cancel edit mode
        lbNav(1, true);
      };
      inp.focus();
    } else if (it.comment) {
      // not editing: show the comment as plain centered text (no input box), like the gallery
      area.innerHTML = `<div class="as-lb-cmt-text" title="edit comment">${esc(it.comment)}</div>`;
      area.querySelector('.as-lb-cmt-text').onclick = () => { _lbEditCmt = true; paintCmtArea(ov, byId(_lb)); };
    } else {
      area.innerHTML = `<button class="as-lb-cmtadd" title="add a comment">✎ comment</button>`;
      area.querySelector('.as-lb-cmtadd').onclick = () => { _lbEditCmt = true; paintCmtArea(ov, byId(_lb)); };
    }
  }
  let _lbDirty = false;
  function closeLightbox() {
    stopPlay(); resetZoom(); _lb = null;
    const ov = document.getElementById('as-lb'); if (ov) ov.style.display = 'none';
    const dm = ov && ov.querySelector('.as-lb-dlmenu'); if (dm) dm.classList.remove('open');   // don't reopen with the menu still showing
    if (_lbDirty) { _lbDirty = false; render(); }   // reflect comment edits in the grid
  }
  let _play = null;
  function updatePlayBtn() { const b = document.querySelector('.as-lb-play'); if (b) b.textContent = _play ? '⏸ Pause' : '▶ Play'; }
  function stopPlay() { if (_play) { clearInterval(_play); _play = null; updatePlayBtn(); } }
  function togglePlay() { if (_play) stopPlay(); else { _play = setInterval(() => lbNav(1), 3000); updatePlayBtn(); } }
  function lbNav(d, keepEdit) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());   // a dangling type pop must not survive a cover change (incl. slideshow)
    const seq = visible().filter(it => !it._pdf);   // PDFs open in a tab, not the lightbox
    if (!seq.length) return;
    let i = seq.findIndex(it => String(it.id) === String(_lb));
    if (i < 0) i = 0;
    i = (i + d + seq.length) % seq.length;
    // keepEdit (Enter in the comment field) carries edit-mode to the next image
    _lb = seq[i].id; _cursorId = _lb; _lbEditCmt = !!keepEdit; paintLightbox(); markCursor(true); preloadNeighbors();
  }
  // Del in full-screen view → mark the current cover for removal (same as the grid's
  // delete: _del moves it to "Marked for removal", undoable there), then advance to
  // the next cover — or close the lightbox if that was the last one.
  function deleteLbCover() {
    const it = byId(_lb); if (!it) return;
    const seq = visible().filter(x => !x._pdf);
    const i = seq.findIndex(x => String(x.id) === String(_lb));
    it._del = true; it._sel = false; _lbDirty = true;
    toast(`“${(it.types && it.types[0]) || ITEM}” marked for removal — undo in the grid`);
    const rest = visible().filter(x => !x._pdf);   // recomputed without the just-deleted cover
    if (!rest.length) { closeLightbox(); return; }
    const nx = rest[Math.min(i, rest.length - 1)];
    resetZoom();
    _lb = nx.id; _cursorId = nx.id; _lbEditCmt = false; paintLightbox(); markCursor(true); preloadNeighbors();
  }

  // ── keyboard cursor (arrows select / move; Enter opens lightbox) ──────────────
  let _cursorId = null;
  function markCursor(scroll) {
    root.querySelectorAll('.as-card.as-cursor').forEach(c => c.classList.remove('as-cursor'));
    if (!_cursorId) return;
    const c = root.querySelector(`.as-card[data-id="${CSS.escape(String(_cursorId))}"]`);
    if (c) { c.classList.add('as-cursor'); if (scroll) c.scrollIntoView({ block: 'nearest' }); }
  }
  function moveCursor(dx, dy) {
    const cards = [...root.querySelectorAll('.as-card:not(.del)')];
    if (!cards.length) return;
    let cur = cards.find(c => c.dataset.id === String(_cursorId)) || cards[0];
    if (!_cursorId) { _cursorId = cur.dataset.id; markCursor(true); return; }
    const r0 = cur.getBoundingClientRect();
    let best = null, bestD = Infinity;
    for (const c of cards) {
      if (c === cur) continue;
      const r = c.getBoundingClientRect();
      const ddx = (r.left + r.width / 2) - (r0.left + r0.width / 2);
      const ddy = (r.top + r.height / 2) - (r0.top + r0.height / 2);
      if (dx > 0 && ddx <= 4) continue; if (dx < 0 && ddx >= -4) continue;
      if (dy > 0 && ddy <= 4) continue; if (dy < 0 && ddy >= -4) continue;
      // penalise off-axis drift so motion stays mostly in the requested direction
      const d = (dx ? Math.abs(ddx) + Math.abs(ddy) * 3 : Math.abs(ddy) + Math.abs(ddx) * 3);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { _cursorId = best.dataset.id; markCursor(true); }
  }
  document.addEventListener('keydown', e => {
    const t = e.target;
    // a popover (type picker / bulk pop) is open → Escape dismisses IT first
    // (wherever focus is), and other keys are swallowed so navigation/zoom/delete
    // don't act behind it. Mirrors the backdrop-click behaviour.
    if (document.querySelector('.as-pop')) {
      if (e.key === 'Escape') { e.preventDefault(); document.querySelectorAll('.as-pop').forEach(p => p.remove()); }
      else if (!(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) e.preventDefault();
      return;
    }
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (_lb) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); lbNav(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lbNav(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); zoomKey(1); }     // ↑ zoom in
      else if (e.key === 'ArrowDown') { e.preventDefault(); zoomKey(-1); }  // ↓ zoom out
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteLbCover(); }
      else if (e.key === 'Enter') { e.preventDefault(); _lbEditCmt = true; paintCmtArea(document.getElementById('as-lb'), byId(_lb)); }   // start editing the comment
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); const it = byId(_lb); if (it) dlOne(it); }   // download original
      return;
    }
    if (!root.isConnected || !root.querySelector('.as-card')) return;
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (map[e.key]) { e.preventDefault(); moveCursor(map[e.key][0], map[e.key][1]); }
    else if (e.key === 'Enter' && _cursorId) { e.preventDefault(); openLightbox(_cursorId); }
    else if (e.key === ' ' && _cursorId) { e.preventDefault(); const it = byId(_cursorId); if (it && !it._del) { it._sel = !it._sel; render(); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && _cursorId) {   // mark the focused cover for removal (mirrors the viewer's Del)
      e.preventDefault();
      const it = byId(_cursorId); if (!it || it._del) return;
      const cards = [...root.querySelectorAll('.as-card:not(.del)')];
      const i = cards.findIndex(c => c.dataset.id === String(_cursorId));
      it._del = true; it._sel = false;
      // advance the cursor to the next remaining cover so Del can be pressed repeatedly
      const rest = cards.filter(c => c.dataset.id !== String(_cursorId));
      _cursorId = rest.length ? rest[Math.min(i, rest.length - 1)].dataset.id : null;
      render();
    }
  });

  function openBulkTypePop(btn) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const sel = MODEL.filter(it => it._sel && !it._del); if (!sel.length) return;
    const pop = document.createElement('div'); pop.className = 'as-pop';
    pop.innerHTML = `<div class="as-pop-h">Set type on ${sel.length} ${ITEM}${sel.length===1?'':'s'}</div>`
      + `<div class="as-type-grid">${ALL_TYPES.map(t => `<label title="Right-click: replace with only this type"><input type="checkbox" value="${esc(t)}"> ${esc(t)}</label>`).join('')}</div>`
      + `<div class="as-pop-f"><button class="as-btn as-pop-apply">Apply (replace)</button><button class="as-btn as-pop-add">Add</button></div>`;
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    const picked = () => ALL_TYPES.filter(t => pop.querySelector(`input[value="${CSS.escape(t)}"]`).checked);
    const lbl = n => `${n} ${n === 1 ? ITEM : ITEMS}`;
    const replace = ts => { sel.forEach(it => it.types = ts.slice()); asLog.info(`Batch: set type [${ts.join(', ') || 'none'}] on ${lbl(sel.length)}`); if (SETTINGS.clearSelAfterOp) sel.forEach(it => it._sel = false); pop.remove(); render(); };   // #277
    pop.querySelector('.as-pop-apply').onclick = () => replace(picked());
    pop.querySelector('.as-pop-add').onclick = () => { const ts = picked(); sel.forEach(it => it.types = [...new Set([...it.types, ...ts])]); asLog.info(`Batch: added type [${ts.join(', ') || 'none'}] to ${lbl(sel.length)}`); if (SETTINGS.clearSelAfterOp) sel.forEach(it => it._sel = false); pop.remove(); render(); };   // #277
    // right-click a type → replace all selected with ONLY that type and close
    pop.querySelectorAll('.as-type-grid label').forEach(lab => lab.oncontextmenu = e => {
      e.preventDefault(); e.stopPropagation(); document.removeEventListener('mousedown', off); replace([lab.querySelector('input').value]);
    });
    const off = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  // #236: set one comment on every selected cover at once. Pre-fills the shared
  // comment if they already agree; Apply writes it, Clear blanks them all.
  // Reverse-image search one cover for a higher-res copy. Per-card (the 🔍 on each
  // tile) so it's unambiguously one image; a still-local NEW file has no public URL
  // to search by. Each engine opens pre-loaded with that URL — no download + drop.
  function openImageSearchPop(btn, it) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const url = it && searchUrlFor(it);   // CAA original, or a sourced new cover's provider URL
    if (!url) { toast(it && it._new ? 'Reverse search needs a public image URL — this one is a local file (source it from a URL instead)' : 'Reverse search needs a published image'); return; }
    const pop = document.createElement('div'); pop.className = 'as-pop as-search-pop';
    // latest (main-branch) install link for the companion — never a feature branch
    const COMPANION_URL = 'https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/art_station/as_picker/as_picker.user.js';
    pop.innerHTML = `<div class="as-pop-h">Search for a higher-res copy<button class="as-search-all" type="button" title="Open every engine in its own tab">Open all</button></div>`
      + IMG_SEARCH_ENGINES.map((e, i) => `<button class="as-btn as-search-eng" data-i="${i}">${esc(e.name)}</button>`).join('')
      + `<div class="as-search-foot">Requires the <a href="${COMPANION_URL}" target="_blank" rel="noopener">Art Station Picker</a> script for click-capture.</div>`;
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    // mb_as_pick=<MBID> activates the picker companion (as_picker.user.js, if installed): it
    // lets you click the higher-res image anywhere and sends it back here. The value is THIS
    // release's MBID so the companion tags each pick with it — a pick stays destined for this
    // release even if this tab is closed, so it can't leak onto some other release's cover-art
    // page. Harmless if the companion isn't installed (engines ignore the unknown query param).
    // NB: a *query* param, not a #hash — Yandex's SPA blanks on an unexpected hash, not a param.
    const openEng = eng => {
      asLog.info(`Search: ${eng.name} ← ${it.types && it.types.length ? it.types.join('/') : ITEM} ${it.id}`);
      window.open(eng.u(url) + '&mb_as_pick=' + MBID, '_blank', 'noopener,noreferrer');
    };
    pop.querySelectorAll('.as-search-eng').forEach(b => b.onclick = () => { openEng(IMG_SEARCH_ENGINES[+b.dataset.i]); pop.remove(); });
    const allBtn = pop.querySelector('.as-search-all');
    if (allBtn) allBtn.onclick = () => { IMG_SEARCH_ENGINES.forEach(openEng); pop.remove(); };   // each in its own tab (the browser may ask to allow multiple popups the first time)
    const off = e => { if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  function openBulkCommentPop(btn) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const sel = MODEL.filter(it => it._sel && !it._del); if (!sel.length) return;
    const common = sel.every(it => it.comment === sel[0].comment) ? sel[0].comment : '';
    const pop = document.createElement('div'); pop.className = 'as-pop as-cmt-pop';
    pop.innerHTML = `<div class="as-pop-h">Comment on ${sel.length} ${ITEM}${sel.length===1?'':'s'}</div>`
      + `<input class="as-bulk-cmt" placeholder="comment…" spellcheck="false" list="as-cmt-presets" value="${esc(common)}">`
      + `<div class="as-pop-f"><button class="as-btn as-pop-apply">Apply</button><button class="as-btn as-bulk-cmt-clr">Clear</button></div>`;
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    const inp = pop.querySelector('.as-bulk-cmt'); inp.focus(); inp.select();
    const apply = v => { sel.forEach(it => it.comment = v); asLog.info(`Batch: ${v ? `set comment “${v}”` : 'cleared comment'} on ${sel.length} ${sel.length === 1 ? ITEM : ITEMS}`); if (SETTINGS.clearSelAfterOp) sel.forEach(it => it._sel = false); pop.remove(); render(); };   // #277
    pop.querySelector('.as-pop-apply').onclick = () => apply(inp.value);
    pop.querySelector('.as-bulk-cmt-clr').onclick = () => apply('');
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); apply(inp.value); } else if (e.key === 'Escape') { e.preventDefault(); pop.remove(); } };
    const off = e => { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  // ── #239 postable report (Markdown / HTML) of the selected covers ─────────────
  // release artist(s) + title, linked, parsed from the page header
  function releaseInfo() {
    const title = (document.querySelector('h1 bdi') || document.querySelector('h1'))?.textContent?.trim() || 'release';
    const sub = document.querySelector('p.subheader') || document.querySelector('.subheader');
    const artists = sub ? [...sub.querySelectorAll('a[href*="/artist/"]')]
      .filter(a => !/\/create(\?|$)/.test(a.getAttribute('href')))
      .map(a => ({ name: a.textContent.trim(), url: 'https://musicbrainz.org' + a.getAttribute('href').split(/[?#]/)[0] })) : [];
    return { title, url: `https://musicbrainz.org${ENT.base}`, artists };
  }
  const pad2 = n => String(n).padStart(2, '0');
  // the logged-in MB user, for the export manifest ("Exported by"). Read the name from
  // the /user/<name> href — the link text may be a label like "Profile".
  function mbUser() {
    for (const a of document.querySelectorAll('a[href^="/user/"]')) {
      const m = (a.getAttribute('href') || '').match(/^\/user\/([^/?#]+)\/?$/);
      if (m) return decodeURIComponent(m[1]);
    }
    return '';
  }
  // #244 a README.md / manifest for the download archive (and a Report type): release
  // header, export metadata, and the artwork list linking each type-named file to its original.
  // shared rows for the "Detailed table" layout / archive manifest
  function manifestRows(sel) {
    const ord = sel.slice().sort((a, b) => a.order - b.order);
    const pad = Math.max(2, String(Math.max(0, ...ord.map(it => it.order + 1))).length);
    return ord.map(it => ({
      pos: pad2(it.order + 1),
      name: downloadName(it, it.order + 1, dlExt(it), pad).replace(/^\d+\s+/, ''),   // drop the position — the Position column already has it
      orig: dlUrl(it), res: (it.w && it.h) ? `${it.w} × ${it.h}` : '', size: it.bytes ? fmtSize(it.bytes) : '',
    }));
  }
  function manifestHead() {
    const info = releaseInfo();
    const d = new Date(), date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return { info, date, by: mbUser() };
  }
  // #244 markdown manifest (README.md in the archive + the Markdown "Detailed table" report)
  function manifestMd(sel, failed) {
    const { info, date, by } = manifestHead();
    const artists = info.artists.length ? info.artists.map(a => `[${a.name}](${a.url})`).join(', ') : 'Unknown artist';
    const out = [`# ${artists} - [${info.title}](${info.url})`, '', `- **Export date:** ${date}`];
    if (by) out.push(`- **Exported by:** ${by}`);
    // #274: if any cover couldn't be downloaded, flag it loudly at the top of the
    // manifest so an incomplete archive is never mistaken for a complete one.
    if (failed && failed.length) {
      out.push('', `> ⚠ **${failed.length} file${failed.length === 1 ? '' : 's'} could not be downloaded** and ${failed.length === 1 ? 'is' : 'are'} **missing** from this archive — re-download to get ${failed.length === 1 ? 'it' : 'them'}:`, '', ...failed.map(f => `> - ${f}`));
    }
    out.push('', '## Artwork', '', '| Position | Cover | Resolution | Size |', '| --- | --- | --- | --- |');
    manifestRows(sel).forEach(r => out.push(`| ${r.pos} | [${r.name}](${r.orig}) | ${r.res} | ${r.size} |`));
    out.push('', `*Report created with [Art Station](${SCRIPT_URL})${_gm ? ' v' + _gm.version : ''}*`);
    return out.join('\n') + '\n';
  }
  function manifestHtml(sel) {
    const { info, date, by } = manifestHead();
    const artists = info.artists.length ? info.artists.map(a => `<a href="${a.url}">${esc(a.name)}</a>`).join(', ') : 'Unknown artist';
    const out = [`<h3>${artists} - <a href="${info.url}">${esc(info.title)}</a></h3>`,
      `<p><strong>Export date:</strong> ${date}${by ? `<br><strong>Exported by:</strong> ${esc(by)}` : ''}</p>`,
      '<table><thead><tr><th>Position</th><th>Cover</th><th>Resolution</th><th>Size</th></tr></thead><tbody>'];
    manifestRows(sel).forEach(r => out.push(`<tr><td>${r.pos}</td><td><a href="${r.orig}">${esc(r.name)}</a></td><td>${esc(r.res)}</td><td>${esc(r.size)}</td></tr>`));
    out.push('</tbody></table>', `<p><em>Report created with <a href="${SCRIPT_URL}">Art Station</a>${_gm ? ' v' + esc(_gm.version) : ''}</em></p>`);
    return out.join('\n');
  }
  // ensure resolution (loads originals) + byte sizes are known before a manifest is built
  async function ensureMeasured(sel) {
    await loadSizes();
    await pool(sel.filter(it => !it.w && !it._pdf), 4, it => new Promise(res => {
      const src = it._new ? it._file : imgUrl(it.id); if (!src) return res();
      const img = new Image(); img.onload = () => { it.w = img.naturalWidth; it.h = img.naturalHeight; res(); }; img.onerror = () => res(); img.src = src;
    }));
  }
  function buildReport(opts) {
    const info = releaseInfo();
    const sel = MODEL.filter(it => it._sel && !it._del && !it._new).slice().sort(sortFn);
    if (opts.layout === 'detailed') return opts.format === 'html' ? manifestHtml(sel) : manifestMd(sel);   // #244 table w/ position, type-name, resolution, size
    const sz = opts.size, W = sz === 'original' ? null : sz;
    const url = it => `${CAA}/${it.id}${sz === 'original' ? '' : '-' + sz}.jpg`;
    const alt = it => (it.types[0] || (IS_EVENT ? 'event art' : ITEM)).toLowerCase();
    const cap = it => [it.types.join(', ') || 'no type', it.comment].filter(Boolean).join(' — ');
    const out = [];
    if (opts.format === 'html') {
      const artists = info.artists.length ? info.artists.map(a => `<a href="${a.url}">${esc(a.name)}</a>`).join(', ') : 'Unknown artist';
      out.push(`<h3>${artists} - <a href="${info.url}">${esc(info.title)}</a></h3>`, '');
      if (opts.layout === 'captioned') sel.forEach(it => out.push(`<p><img src="${url(it)}" alt="${esc(alt(it))}"${W ? ` width="${W}"` : ''}><br><em>${esc(cap(it))}</em></p>`));
      else out.push(sel.map(it => `<img src="${url(it)}" alt="${esc(alt(it))}"${W ? ` width="${W}"` : ''}>`).join(' '));
    } else {
      const artists = info.artists.length ? info.artists.map(a => `[${a.name}](${a.url})`).join(', ') : 'Unknown artist';
      out.push(`### ${artists} - [${info.title}](${info.url})`, '');
      if (opts.layout === 'captioned') sel.forEach(it => out.push(`**${cap(it)}**  `, `![${alt(it)}](${url(it)})`, ''));
      else out.push(sel.map(it => `![${alt(it)}](${url(it)})`).join(' '));
    }
    return out.join('\n');
  }
  function openReport() {
    const sel = MODEL.filter(it => it._sel && !it._del && !it._new);
    const omitted = MODEL.filter(it => it._sel && it._new && !it._del && !it._sourcing).length;
    document.getElementById('as-report')?.remove();
    const ov = document.createElement('div'); ov.id = 'as-report';
    ov.innerHTML = `<div class="as-cm-box as-rp-box">
      <div class="as-cm-h">Report — ${sel.length} ${ITEM}${sel.length===1?'':'s'}</div>
      <div class="as-rp-opts">
        <label>Format <select class="as-rp-fmt"><option value="markdown">Markdown</option><option value="html">HTML</option></select></label>
        <label>Image size <select class="as-rp-size"><option>250</option><option>500</option><option>1200</option><option value="original">original</option></select></label>
        <label>Layout <select class="as-rp-layout"><option value="inline">Inline images</option><option value="captioned">With types &amp; comments</option><option value="detailed">Detailed table</option></select></label>
      </div>
      <textarea class="as-rp-out" rows="9" spellcheck="false" readonly></textarea>
      <div class="as-cm-f"><span class="as-rp-note">${omitted ? `${omitted} unsaved upload${omitted===1?'':'s'} omitted (no CAA URL yet)` : ''}</span><span class="as-sp"></span><button class="as-btn as-rp-copy">📋 Copy</button><button class="as-btn as-cm-cancel">Close</button></div>
    </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); maybeClearSel(); };   // #277: report counts as "using" the selection → clear on close
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelector('.as-cm-cancel').onclick = close;
    const ta = ov.querySelector('.as-rp-out');
    const regen = async () => {
      const opts = { format: ov.querySelector('.as-rp-fmt').value, size: ov.querySelector('.as-rp-size').value, layout: ov.querySelector('.as-rp-layout').value };
      if (opts.layout === 'detailed') { ta.value = 'Measuring resolutions…'; await ensureMeasured(sel); }   // load dimensions for the table
      ta.value = buildReport(opts);
    };
    ov.querySelectorAll('select').forEach(s => s.onchange = regen);
    ov.querySelector('.as-rp-copy').onclick = async () => {
      ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
      asLog.info(`Batch: copied ${ov.querySelector('.as-rp-fmt').value} report — ${sel.length} ${sel.length === 1 ? ITEM : ITEMS} (${ov.querySelector('.as-rp-layout').value})`);
      const b = ov.querySelector('.as-rp-copy'); b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '📋 Copy'; }, 1200);
    };
    regen();
  }

  // ── styles ───────────────────────────────────────────────────────────────────
  const css = `
  :root{ --as-tile:${SETTINGS.tile}px; --as-acc:#5f3ec0; --as-warn:#c0392b; }
  /* the sticky toolbar grows a line when a selection adds the bulk-action buttons;
     scroll-anchoring would then nudge the page on every right-click select. Disable
     anchoring so the scrollbar stays put (Art Station owns this page's scroll). */
  html{overflow-anchor:none}
  #as-root{font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222;margin:0 0 18px}
  .as-bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:8px 11px;padding:8px 12px;background:#fff;border:1px solid #e2dcef;border-radius:9px;box-shadow:0 1px 5px rgba(60,40,110,.07);flex-wrap:wrap;margin-bottom:6px}
  .as-setup-ic{width:30px;height:30px;object-fit:contain;flex:0 0 auto}
  .as-bar>*{flex:0 0 auto}
  /* "Original" (Apollo-style switch): hide the whole Art Station UI, MB's native page shows through */
  #as-root.as-orig{display:none}
  /* one unified pill like Apollo's launcher: label segment + a divider + the gear */
  #as-switch-wrap{position:fixed;bottom:14px;right:14px;z-index:99998;display:inline-flex;align-items:stretch;background:var(--as-acc);color:#fff;border-radius:20px;font:bold 13px Arial;box-shadow:0 3px 12px rgba(40,20,80,.3);overflow:hidden}
  #as-switch{padding:8px 14px;cursor:pointer;background:none;border:none;color:inherit;font:inherit}
  #as-switch:hover{background:rgba(255,255,255,.13)}
  #as-setup-btn{padding:8px 12px;cursor:pointer;font-size:14px;display:flex;align-items:center;background:none;border:none;border-left:1px solid rgba(255,255,255,.28);color:inherit}
  #as-setup-btn:hover{background:rgba(255,255,255,.13)}
  #as-setup{position:fixed;bottom:58px;right:14px;z-index:99999;width:max-content;min-width:320px;max-width:92vw;background:#fff;border:1px solid #cbbdf0;border-radius:10px;box-shadow:0 8px 28px rgba(40,20,80,.32);font:13px Arial;color:#222}
  .as-setup-h{display:flex;align-items:center;gap:7px;padding:10px 12px;border-bottom:1px solid #ece6f8;color:#563b8f}
  .as-setup-ver{font-size:11px;font-weight:normal;color:#999}
  .as-setup-help{font-size:12px;text-decoration:none;color:#5f3ec0;border:1px solid #c9b8ee;border-radius:4px;padding:1px 8px}
  .as-setup-help:hover{background:#f0ecfa}
  .as-setup-logbtn{margin-left:auto;font-size:12px;color:#5f3ec0;background:none;border:1px solid transparent;border-radius:4px;padding:1px 8px;cursor:pointer;font-family:inherit}
  .as-setup-logbtn:hover{background:#f3eefb;border-color:#c9b8ee}
  /* #283 activity-log popup */
  /* floating, movable, NON-modal window (no backdrop) */
  #as-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:100020;display:flex;flex-direction:column;width:min(720px,94vw);max-height:72vh;background:#fff;border:1px solid #cbbdf0;border-radius:11px;box-shadow:0 12px 40px rgba(40,20,80,.4);font:13px Arial;color:#222;overflow:hidden}
  .as-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid #ece6f8;color:#563b8f;cursor:move;user-select:none}
  #as-logpop .as-log-m a{color:#5f3ec0}
  .as-logpop-sp{margin-left:auto}
  .as-logpop-copy,.as-logpop-x,.as-logpop-min{font-size:12px;color:#5f3ec0;background:#f3eefb;border:1px solid #c9b8ee;border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}
  .as-logpop-copy:hover,.as-logpop-x:hover,.as-logpop-min:hover{background:#e9e0f8}
  #as-logpop.min .as-log-list,#as-logpop.min .as-logpop-copy,#as-logpop.min .as-logpop-x{display:none}
  #as-logpop.min{max-height:none;width:auto}
  #as-logpop.min .as-logpop-sp{display:none}
  .as-log-badge{color:#9a8cba;font-size:11px}
  .as-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;background:#faf8fe;padding:8px 11px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55}
  .as-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}
  .as-log-t{color:#a99fc2;flex:0 0 auto}
  .as-log-m{flex:1 1 auto;color:#444}
  .as-log-ok .as-log-m{color:#2e7d4f}
  .as-log-warn .as-log-m{color:#b06a00}
  .as-log-error .as-log-m{color:#c0344d}
  .as-log-debug{opacity:.72}
  .as-log-debug .as-log-m{color:#7a7a7a}
  .as-log-empty{color:#9a8cba}
  .as-setup-x{border:none;background:none;color:#999;font-size:14px;cursor:pointer;padding:0 2px}
  .as-setup-x:hover{color:#555}
  .as-setup-body{padding:11px 12px;display:flex;flex-direction:column;gap:11px}   /* #262 a bit more breathing room between options */
  .as-setup-info{margin:0 0 10px;color:#666;font-size:12px;line-height:1.45}
  .as-setup-opt{display:flex;gap:8px;align-items:center;cursor:pointer;white-space:nowrap;line-height:1.4}
  .as-setup-opt input{margin:0}
  .as-setup-optlbl{display:inline-flex;gap:8px;align-items:center;cursor:pointer}   /* #262 label wraps only checkbox+text so the mode select stays independent */
  .as-setup-autofront-mode{font-size:12px;padding:1px 3px}
  .as-ctl{display:flex;align-items:center;gap:6px;font-size:13px;color:#555;white-space:nowrap}
  .as-size{accent-color:var(--as-acc);flex:0 1 130px;min-width:54px}
  #as-root select,.as-btn{font:13px inherit;border:1px solid #cfc6e6;background:#fff;border-radius:6px;padding:4px 9px;color:#333;cursor:pointer;white-space:nowrap}
  .as-btn{display:inline-flex;align-items:center;gap:5px}
  /* #234: compact toolbar — hide button labels (keep icons + tooltips) when it would otherwise wrap */
  .as-bar.as-compact .as-bt{display:none}
  .as-btn:hover{background:#f6f3fd}
  /* accent (white-on-purple) buttons must darken on hover, not lighten — else the white text vanishes */
  .as-commit:hover:not(:disabled),.as-pop-apply:hover:not(:disabled),.as-cm-go:hover:not(:disabled){background:#4e329f;color:#fff;border-color:#4e329f}
  /* #275: the Repeat (failed) button is red to signal the error state */
  .as-cm-go.as-cm-repeat{background:#d9463f;border-color:#b53a34;color:#fff}
  .as-cm-go.as-cm-repeat:hover:not(:disabled){background:#c43c36;border-color:#a5342f}
  .as-add{font-weight:600;color:var(--as-acc)}
  .as-mh{padding:3px 7px}
  .as-mh-ic{display:block;background:#80a32b;padding:2px;border-radius:5px;width:14px;height:14px}   /* green chip so the white MH icon shows; sized so it doesn't out-tall the text buttons */
  #as-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;background:#3b2c70;color:#fff;padding:10px 16px;border-radius:9px;font:13px/1.35 -apple-system,Segoe UI,Roboto,Arial,sans-serif;box-shadow:0 6px 22px rgba(40,20,80,.35);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center}
  .as-asback{font-weight:700;color:var(--as-acc);background:#f3eefe;border-color:#cdbff2}
  .as-dl{border-color:#bcd;color:#2a6}
  .as-sp{flex:1 1 auto}
  .as-commit{margin-left:auto}   /* push Enter edit to the far right of the toolbar */
  .as-staged{font-size:12px;color:#a05a00;background:#fff3d6;border-color:#ecd9a0;white-space:nowrap}
  .as-staged:hover{background:#ffeec0}
  .as-op{padding:4px 8px;border-radius:5px;font-size:12.5px;color:#333;white-space:nowrap}
  .as-op:hover{background:#f3eefe}
  .as-staged-pop{min-width:230px;max-width:420px}
  .as-dropzone{border:2px dashed #b7a4ee;border-radius:11px;background:#f7f4ff;padding:24px;text-align:center;cursor:pointer;margin-bottom:12px;transition:.1s}
  .as-dropzone.over{background:#ece4ff;border-color:var(--as-acc)}
  .as-dz-in{font-weight:600;font-size:15px;color:#6a5b95;display:flex;flex-direction:column;gap:4px}
  .as-dz-in span{font-weight:400;font-size:12px;color:#9a8ccb}
  .as-commit{background:var(--as-acc);color:#fff;border-color:var(--as-acc);font-weight:600}
  .as-commit:disabled{opacity:.45;cursor:default}
  .as-sec{margin:14px 0 4px;display:flex;align-items:center;gap:8px}
  .as-sec h3{margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6a5b95}
  .as-sec-del h3{color:var(--as-warn)}
  .as-cnt{font-size:12px;color:#9b8fc0}
  .as-line{flex:1;height:1px;background:#e2dcef}
  .as-grid{display:flex;flex-wrap:wrap;gap:24px 14px}
  /* #238 Detailed view: list rows — image + id on the left, all types & full comment on the right */
  .as-dlist{display:flex;flex-direction:column;gap:10px}
  .as-drow{display:flex;gap:16px;align-items:flex-start;border:1px solid #e2dcef;border-radius:9px;padding:10px 12px;background:#fff;position:relative}
  .as-drow.new{background:repeating-linear-gradient(45deg,#eef7f1,#eef7f1 11px,#e2f0e8 11px,#e2f0e8 22px);border-color:#9bd3b6;border-style:dashed}
  .as-drow.pending{background:#fdf3d0;border-color:#e6cf86}
  .as-drow.sel{outline:2px solid var(--as-acc);outline-offset:-1px;background:#f1ecff;box-shadow:inset 4px 0 0 var(--as-acc)}
  .as-dsel{flex:0 0 auto;width:18px;height:18px;margin:4px 2px 0 2px;accent-color:var(--as-acc);cursor:pointer}
  .as-dleft{flex:0 0 auto;width:128px;text-align:center}
  .as-dthumb{position:relative;width:128px;height:128px;border-radius:7px;overflow:hidden;background:#f4f2f9;cursor:zoom-in;display:block}
  .as-dthumb img{width:100%;height:100%;object-fit:contain;display:block}
  .as-dthumb.na img{display:none}
  .as-dthumb.na::after{content:'not on CAA yet';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9a8ccb;font-size:11px;font-weight:600;text-align:center;padding:0 8px}
  .as-dthumb.na.as-na-new::after{content:'preview unavailable'}
  .as-dcap{font-size:11px;font-weight:600;color:#6b5fa0;margin-top:5px;white-space:nowrap}
  .as-did{font-size:11px;color:#a99fc4;font-variant-numeric:tabular-nums;word-break:break-all;line-height:1.3;margin-top:1px}
  .as-dmeta{flex:1 1 auto;min-width:0}
  .as-dlbl{font-weight:700;color:#6a5b95;font-size:12px;margin:0 0 4px}
  /* a marked-for-removal detail row: greyed image + a "keep" (undo) button, no editing */
  .as-drow.del{opacity:.75;background:#fdf6f5;border-color:#eccfca}
  .as-drow.del .as-dthumb img{filter:grayscale(1) brightness(.85)}
  .as-dsel-x{flex:0 0 auto;width:18px;text-align:center;color:#c0392b;font-weight:700;margin-top:2px}
  .as-dmeta-del{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .as-ddel-lbl{color:#8a5a52;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .as-dtypes{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:3px 12px;margin:0 0 10px}
  .as-dtypes label{display:flex;align-items:center;gap:6px;font-size:13px;color:#333;cursor:pointer}
  .as-dtypes input{accent-color:var(--as-acc)}
  .as-dcmt{width:100%;box-sizing:border-box;font:13px inherit;border:1px solid #cfc6e6;border-radius:6px;padding:6px 9px;background:#faf9fe;color:#333}
  .as-dcmt:focus{outline:2px solid var(--as-acc);outline-offset:-1px;background:#fff}
  /* compact group rows: label column + cards beside it */
  .as-grow{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-top:1px solid #ece7f6}
  .as-grow:first-of-type{border-top:none}
  .as-glabel{flex:0 0 104px;position:sticky;top:58px;padding-top:2px}
  .as-gl-name{display:block;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6a5b95;word-break:break-word}
  .as-gl-cnt{font-size:11px;color:#9b8fc0}
  .as-grow .as-grid{flex:1}
  .as-card{width:var(--as-tile);background:#fff;border:1px solid #e2dcef;border-radius:9px;overflow:visible;position:relative;transition:.1s}
  .as-card[draggable=true]{cursor:grab}
  .as-card:hover{box-shadow:0 3px 12px rgba(60,40,110,.15);border-color:#cbbdf0}
  .as-card.as-dragging{opacity:.4}
  .as-card.as-drop{outline:2px dashed var(--as-acc);outline-offset:-2px}
  .as-card.del .as-thumb img{filter:grayscale(1) brightness(.82)}
  .as-card.del{opacity:.7}
  .as-sec-new h3{color:#1f9d6b}
  .as-card.new{background:repeating-linear-gradient(45deg,#eef7f1,#eef7f1 11px,#e2f0e8 11px,#e2f0e8 22px);border-color:#9bd3b6;border-style:dashed}
  .as-card.pending{background:#fdf3d0;border-color:#e6cf86}
  .as-card.as-sourcing{border-style:dashed}
  .as-srcing-thumb{width:100%;aspect-ratio:1;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;color:#3b8f6b}
  .as-spinner{width:30px;height:30px;border:3px solid #c7e7d6;border-top-color:#1f9d6b;border-radius:50%;animation:as-spin .8s linear infinite}
  @keyframes as-spin{to{transform:rotate(360deg)}}
  .as-srcing-lbl{font:600 12px Arial;color:#2c7a59}
  .as-pdfban{position:absolute;right:6px;top:6px;z-index:4;background:#7a3a8f;color:#fff;font:700 10px/1 Arial;letter-spacing:.5px;padding:3px 7px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.25);pointer-events:none}
  .as-newban{position:absolute;top:8px;right:-26px;transform:rotate(45deg);background:#1f9d6b;color:#fff;font:700 10px Arial;letter-spacing:1px;padding:2px 26px;z-index:5;box-shadow:0 1px 3px rgba(0,0,0,.3);pointer-events:none}
  /* #249 provider favicon chip, bottom-left of a newly-sourced cover */
  .as-prov{position:absolute;left:6px;bottom:6px;z-index:5;width:25px;height:25px;border-radius:6px;background:rgba(255,255,255,.93);box-shadow:0 1px 3px rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in}
  .as-prov img{width:18px;height:18px;display:block;object-fit:contain}
  .as-dthumb .as-prov{left:4px;bottom:4px;width:22px;height:22px}
  .as-dthumb .as-prov img{width:16px;height:16px}
  .as-thumb{position:relative;display:block;width:100%;aspect-ratio:1;background:#f4f2f9;cursor:zoom-in;border-radius:9px 9px 0 0;overflow:hidden}
  .as-thumb img{width:100%;height:100%;object-fit:contain;display:block}
  .as-thumb.na{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#faf8ff,#efeafb)}
  .as-thumb.na img{display:none}
  .as-thumb.na::after{content:'Not on the Cover Art Archive yet';text-align:center;color:#9a8ccb;font-size:12px;font-weight:600;line-height:1.45;padding:0 16px}
  .as-thumb.na.as-na-new::after{content:'Preview unavailable — the image couldn’t be decoded'}   /* #250 a staged blob that won't render (no CAA fallback) */
  .as-dim{font-size:12px;font-weight:600;color:#6b5fa0;flex:0 0 auto;margin-left:auto;display:flex;flex-wrap:nowrap;justify-content:flex-end;gap:0 7px;white-space:nowrap}   /* nowrap: the size + resolution must never wrap to a 2nd (clipped) line when the hover 🔍 narrows the row */
  .as-dim-sz,.as-dim-px{white-space:nowrap}
  .as-tbtn{position:absolute;top:6px;right:6px;border:none;border-radius:6px;background:rgba(255,255,255,.92);cursor:pointer;font-size:14px;line-height:1;padding:4px 7px;color:#555;box-shadow:0 1px 3px rgba(0,0,0,.2);opacity:0;transition:.1s}
  .as-card:hover .as-tbtn{opacity:1}
  .as-rm:hover{background:var(--as-warn);color:#fff}
  .as-undo{opacity:1;background:#fff;color:var(--as-acc);font-size:12px;font-weight:600}
  /* #234: footer (mockup) — row 1: comment (left) · dimensions+size (right); row 2: centered type pill on a divider */
  .as-foot{padding:5px 8px 0;display:flex;flex-direction:column;gap:6px;border-top:1px solid #efeaf8}
  .as-foot-row{display:flex;align-items:center;gap:6px;min-height:17px}
  .as-foot-cmt{flex:0 1 auto;min-width:0;display:flex;align-items:center;overflow:hidden}
  .as-foot-cmt.as-cmt-collapsed{display:none}
  .as-cmt-text{font:11px inherit;color:#5a5470;line-height:1.3;cursor:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .as-cmt-text:hover{color:var(--as-acc)}
  .as-foot-type{display:flex;align-items:center;gap:7px;transform:translateY(50%);position:relative;z-index:1}
  .as-card.sel .as-foot-type{padding-right:20px}
  .as-tline{flex:1;height:1px;background:#e7e1f2}
  .as-type{font-size:11px;font-weight:700;color:#3b2c70;background:#f2f2f2;border:1px solid #d8ccf5;border-radius:20px;padding:2px 13px;cursor:pointer;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .as-type:hover{background:#e7dffb}
  .as-type-add{color:#8a7fb8;background:#fff;border-style:dashed;font-weight:600;opacity:.5}
  .as-card:hover .as-type-add{opacity:1}
  .as-cmt{font:11px inherit;border:1px solid #e2dcef;border-radius:6px;padding:2px 6px;color:#444;background:#faf9fe;width:100%}
  .as-pencil{font:11px inherit;border:1px dashed #d8ccf5;background:#fff;color:#8a7fb8;border-radius:6px;padding:0 7px;cursor:pointer;opacity:0;transition:.1s}
  .as-card:hover .as-pencil{opacity:1}
  .as-pencil:hover{background:#f6f3fd;color:var(--as-acc)}
  /* flat reverse-image-search magnifier — in the comment row, after the comment/pencil,
     revealed on card hover. The dim's nowrap (above) keeps the resolution from wrapping. */
  .as-fsearch{display:inline-flex;align-items:center;color:#8a7fb8;background:none;border:none;cursor:pointer;padding:0 2px;flex:none;line-height:0;opacity:0;transition:opacity .1s}
  .as-card:hover .as-fsearch{opacity:.85}
  .as-fsearch:hover{opacity:1;color:var(--as-acc)}
  /* selection + keyboard cursor */
  .as-card.sel{outline:3px solid var(--as-acc);outline-offset:-1px;box-shadow:0 3px 14px rgba(95,62,192,.3)}
  .as-selmark{position:absolute;right:7px;bottom:7px;width:21px;height:21px;line-height:21px;text-align:center;background:var(--as-acc);color:#fff;border-radius:50%;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:6;display:none}
  .as-card.sel .as-selmark{display:block}
  #as-root.as-zoomed .as-card.sel .as-selmark{display:none}   /* big tiles: outline alone shows selection */
  .as-card.sel .as-cmt{padding-right:28px}
  .as-card.as-cursor{box-shadow:0 0 0 2px #2a6,0 3px 14px rgba(40,160,100,.28)}
  /* bulk bar */
  /* #234: center selection cluster in the main toolbar */
  .as-selbox{display:flex;align-items:center;gap:8px;flex:0 1 auto;justify-content:center}
  .as-selcnt{font-size:13px;font-weight:700;color:var(--as-acc);white-space:nowrap}
  .as-selcnt.none{font-weight:400;color:#b3a9cc}
  .as-ic{font:14px/1 inherit;border:1px solid #cfc6e6;background:#fff;border-radius:6px;padding:3px 9px;color:#5a4b8a;cursor:pointer}
  .as-ic:hover{background:#f1ecff}
  .as-ic:disabled{opacity:.4;cursor:default}
  .as-selall{color:#2a7d50}
  .as-bk-rm{border-color:#e6b8b2;color:var(--as-warn)}
  .as-view{font-weight:600}
  .as-dragwarn{font-size:13px;color:#b06a00;background:#fff3d6;border:1px solid #ecd9a0;border-radius:6px;padding:3px 7px;line-height:1;cursor:help}
  .as-pop-note{color:#9a8ccb;font-size:11px}
  .as-pop{position:absolute;z-index:10001;background:#fff;border:1px solid #cbbdf0;border-radius:8px;box-shadow:0 6px 22px rgba(60,40,110,.22);padding:6px;min-width:150px;max-height:340px;overflow:auto;font-size:13px}   /* z above the lightbox (9999) so the type picker shows over it */
  .as-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  .as-pop label{display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:5px;cursor:pointer}
  .as-pop label:hover{background:#f3eefe}.as-pop input{accent-color:var(--as-acc)}
  .as-pop-h{font-weight:600;color:#6a5b95;padding:3px 6px 6px;border-bottom:1px solid #eee;margin-bottom:4px}
  .as-pop-f{display:flex;gap:6px;padding:6px 4px 2px;border-top:1px solid #eee;margin-top:4px;position:sticky;bottom:0;background:#fff}
  .as-pop-apply{background:var(--as-acc);color:#fff;border-color:var(--as-acc)}
  .as-cmt-pop{min-width:220px}
  .as-search-pop{display:flex;flex-direction:column;gap:2px;min-width:160px}
  .as-search-pop .as-search-eng{display:block;width:100%;text-align:left;border:1px solid transparent;background:none}   /* borderless until hover (transparent border keeps it from shifting) */
  .as-search-pop .as-search-eng:hover{border-color:#cfc6e6}
  .as-search-pop .as-pop-h{display:flex;align-items:baseline;justify-content:space-between;gap:14px}   /* title left, "Open all" right (#open-all-in-title) */
  .as-search-pop .as-search-all{flex:none;font:600 13px inherit;color:var(--as-acc);background:none;border:none;cursor:pointer;padding:0}
  .as-search-pop .as-search-all:hover{text-decoration:underline}
  .as-search-pop .as-search-foot{margin-top:6px;padding:7px 6px 2px;border-top:1px solid #eee;font-size:11px;line-height:1.45;color:#9a8ccb}
  .as-search-pop .as-search-foot a{color:var(--as-acc);font-weight:600;text-decoration:none}
  .as-search-pop .as-search-foot a:hover{text-decoration:underline}
  /* grow to fit all providers when the screen allows; no horizontal bar, and hide the
     vertical scrollbar chrome (still wheel-scrollable on a very short screen) */
  .as-src-pop{min-width:340px;max-width:90vw;width:max-content;max-height:calc(100vh - 20px);overflow-x:hidden;scrollbar-width:none}
  .as-src-pop::-webkit-scrollbar{display:none}
  .as-src-prov{display:flex;flex-direction:column;gap:5px;margin:6px 0 2px}
  .as-src-custom{display:flex;flex-direction:column;gap:5px}   /* #250 stacked custom-provider buttons */
  .as-src-custom:not(:empty){margin:6px 0 2px}
  .as-src-prov-b{justify-content:flex-start;font-weight:600;color:#3b2c70;gap:8px}
  .as-src-all{justify-content:center;font-weight:700;color:#fff;background:var(--as-acc);border-color:var(--as-acc);margin-top:3px}
  .as-src-all:hover{background:#4e329f;border-color:#4e329f}
  .as-src-ic{width:16px;height:16px;object-fit:contain;flex:0 0 auto}
  .as-src-n{opacity:.85}
  .as-src-or{margin:9px 0 0;color:#9a8ccb;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .as-src-inp{width:100%;box-sizing:border-box;margin:4px 0 2px;padding:6px 8px;border:1px solid #cfc6e6;border-radius:6px;font:13px inherit}
  .as-src-pop > .as-pop-note:last-child{padding:6px 4px 2px;line-height:1.4;white-space:nowrap}
  .as-src-pop > .as-pop-note.as-src-warn{white-space:normal;color:#a85a00;font-weight:600}
  .as-src-pop > .as-pop-note.as-src-warn a{color:#a85a00;text-decoration:underline}
  .as-bulk-cmt{width:100%;box-sizing:border-box;font:13px inherit;border:1px solid #d8ccf5;border-radius:6px;padding:5px 8px;margin:2px 0 2px;background:#faf9fe;color:#333}
  /* lightbox */
  #as-lb{display:none;position:fixed;inset:0;z-index:9999;background:rgba(15,12,28,.92);align-items:center;justify-content:center;flex-direction:column;padding:30px}
  .as-lb-img{max-width:92vw;max-height:84vh;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.6);border-radius:4px;background:#fff}
  .as-lb-img.loading{visibility:hidden}
  #as-lb.na .as-lb-img{display:none}
  #as-lb.na::after{content:'Image not available, please try again later';color:#f0c4da;font-style:italic;font-size:16px}
  /* z-index keeps BOTH arrows above the image: applyZoom always sets a transform
     on .as-lb-img (a stacking context), so without this the prev arrow — a DOM
     sibling BEFORE the image — gets painted over while next (after it) stays on top. */
  .as-lb-nav{position:fixed;top:50%;transform:translateY(-50%);z-index:2;font-size:42px;line-height:1;color:#fff;background:transparent;border:none;border-radius:50%;width:54px;height:54px;cursor:pointer}
  .as-lb-nav:hover{background:rgba(255,255,255,.25)}
  .as-lb-prev{left:18px}.as-lb-next{right:18px}
  .as-lb-top{position:fixed;top:16px;right:20px;display:flex;gap:10px;align-items:center}
  .as-lb-x,.as-lb-play{font-size:15px;color:#fff;background:transparent;border:none;border-radius:8px;height:42px;cursor:pointer;font-weight:600}
  .as-lb-x{width:42px;font-size:24px}.as-lb-play{padding:0 14px}
  .as-lb-x:hover,.as-lb-play:hover{background:rgba(255,255,255,.25)}
  /* lightbox actions: Delete top-left, Download (size menu) top-centre. No z-index, so a
     ZOOMED image paints over them — same as Play/✕. The download wrapper lifts only while
     its menu is open so the menu stays usable. */
  .as-lb-del{position:fixed;top:16px;left:20px;font-size:18px;line-height:1;color:#fff;background:transparent;border:none;border-radius:8px;height:42px;width:46px;cursor:pointer}
  .as-lb-del:hover{background:var(--as-warn)}
  /* Download moved into the bottom bar (right of the resolution): at the top it
     was painted over by the image even at 0 zoom. In-flow now; its size menu
     opens UPWARD so it doesn't fall off the bottom edge. */
  .as-lb-dlwrap{position:relative;display:inline-flex;align-items:center}
  .as-lb-dlwrap:has(.as-lb-dlmenu.open){z-index:3}
  .as-lb-dl,.as-lb-dlcaret{font:600 13px Arial;color:#fff;background:rgba(255,255,255,.08);border:1px solid transparent;height:34px;cursor:pointer}
  .as-lb-dl{padding:0 14px;border-radius:8px 0 0 8px;border-right:none}
  .as-lb-dlcaret{padding:0 11px;border-radius:0 8px 8px 0;font-size:12px}
  .as-lb-dl:hover,.as-lb-dlcaret:hover{background:rgba(255,255,255,.25)}
  .as-lb-dlwrap:hover .as-lb-dl,.as-lb-dlwrap:hover .as-lb-dlcaret{border-color:rgba(255,255,255,.28)}   /* border only while hovering the Download control */
  .as-lb-dlmenu{position:absolute;bottom:40px;left:0;min-width:130px;background:#fff;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.4);padding:5px;display:none;flex-direction:column}
  .as-lb-dlmenu.open{display:flex}
  .as-lb-dlmenu button{text-align:left;background:none;border:none;color:#333;font:13px Arial;padding:7px 10px;border-radius:6px;cursor:pointer}
  .as-lb-dlmenu button:hover{background:#f0ecfa;color:var(--as-acc)}
  /* z-index:2 keeps the footer above a ZOOMED image — the image's transform makes a
     stacking context that would otherwise paint over the bar (it sits below in flow). */
  .as-lb-bar{margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:8px;width:min(560px,84vw);position:relative;z-index:2}
  /* while editing (focused), give the bar a readable dark backdrop — otherwise the comment
     field / type chip are invisible over a light image */
  .as-lb-bar:focus-within{background:rgba(15,12,28,.88);padding:11px 16px;border-radius:13px;box-shadow:0 6px 24px rgba(0,0,0,.5)}
  .as-lb-bar:focus-within .as-lb-cmt{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.5)}
  .as-lb-caprow{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
  .as-lb-cap{color:#eee;font-size:13px;text-align:center;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
  .as-lb-type{font:700 12px inherit;color:#e7dffb;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.28);border-radius:20px;padding:3px 14px;cursor:pointer}
  .as-lb-type:hover{background:rgba(255,255,255,.2);color:#fff}
  .as-lb-type.as-type-add{font-weight:600;border-style:dashed;color:rgba(255,255,255,.6)}
  .as-lb-dim{color:#bbb}
  .as-lb-cmtarea{width:100%;display:flex;justify-content:center}
  .as-lb-cmt{width:100%;font:13px inherit;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:7px;padding:7px 11px;text-align:center}
  .as-lb-cmt-text{font:14px inherit;color:#fff;text-align:center;line-height:1.4;padding:4px 8px;cursor:text;max-width:100%;word-break:break-word}
  .as-lb-cmt-text:hover{color:#e7dffb}
  .as-lb-cmt::placeholder{color:rgba(255,255,255,.45)}
  .as-lb-cmt:focus{outline:none;border-color:rgba(255,255,255,.55);background:rgba(255,255,255,.14)}
  .as-lb-cmtadd{font:12px inherit;color:rgba(255,255,255,.6);background:transparent;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:4px 13px;cursor:pointer}
  .as-lb-cmtadd:hover{color:#fff;border-color:rgba(255,255,255,.5);background:rgba(255,255,255,.1)}
  /* #251 touch viewer: show only the full image; tap reveals the controls, swipe navigates */
  #as-lb.as-lb-touch .as-lb-img{max-width:100vw;max-height:100vh;border-radius:0}
  #as-lb.as-lb-touch .as-lb-nav{display:none}
  #as-lb.as-lb-touch .as-lb-del,#as-lb.as-lb-touch .as-lb-dlwrap,#as-lb.as-lb-touch .as-lb-top,#as-lb.as-lb-touch .as-lb-bar{opacity:0;pointer-events:none;transition:opacity .15s}
  #as-lb.as-lb-touch.as-lb-chrome .as-lb-del,#as-lb.as-lb-touch.as-lb-chrome .as-lb-dlwrap,#as-lb.as-lb-touch.as-lb-chrome .as-lb-top,#as-lb.as-lb-touch.as-lb-chrome .as-lb-bar{opacity:1;pointer-events:auto}
  .as-ghost{border-radius:9px;background:#fff}
  /* #251 bigger tap targets on a touch screen (≈44px), incl. the full-screen controls */
  @media (pointer: coarse) {
    #as-root .as-btn,#as-root .as-ic,#as-root select{min-height:40px;padding-top:8px;padding-bottom:8px}
    #as-root .as-type,#as-root .as-type-add{padding-top:7px;padding-bottom:7px}
    #as-root .as-pencil{min-height:34px;padding:0 12px}
    #as-root .as-tbtn{opacity:1;padding:8px 11px}
    .as-lb-x,.as-lb-play,.as-lb-del,.as-lb-dl,.as-lb-dlcaret{min-width:46px;min-height:46px;font-size:18px}
    .as-lb-cmtadd,.as-lb-type{min-height:40px;padding:9px 16px}
    .as-lb-dlmenu button{padding:12px 14px}
  }
  /* commit panel */
  #as-commit,#as-report{position:fixed;inset:0;z-index:9998;background:rgba(15,12,28,.55);display:flex;align-items:center;justify-content:center;padding:24px}
  .as-rp-opts{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:10px}
  .as-rp-opts label{display:flex;align-items:center;gap:6px;font-size:13px;color:#555}
  .as-rp-out{font:12px/1.45 ui-monospace,Consolas,monospace;border:1px solid #cfc6e6;border-radius:7px;padding:9px 11px;resize:vertical;background:#faf9fe;color:#333;white-space:pre;overflow:auto}
  .as-rp-note{font-size:12px;color:#a05a00}
  .as-rp-copy{font-weight:600;color:var(--as-acc)}
  .as-cm-box{background:#fff;border-radius:12px;box-shadow:0 12px 50px rgba(0,0,0,.4);width:min(680px,94vw);max-height:88vh;display:flex;flex-direction:column;padding:18px 20px;font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222}
  .as-cm-h{font-size:16px;font-weight:700;color:#3b2c70;margin-bottom:12px;display:flex;align-items:center;gap:12px}
  .as-cm-h-t{flex:1;min-width:0}
  .as-cm-hist{flex:none;font-size:13px;font-weight:600;color:#6f42c1;text-decoration:none;white-space:nowrap;padding:4px 12px;border:1px solid #d9d2ee;border-radius:8px;background:#fff}
  .as-cm-hist:hover{background:#f4f1fb;border-color:#c3b6e6}
  .as-cm-row{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:13px;color:#555}
  .as-cm-hint{font-size:11px;color:#9a8ccb;font-weight:400}
  .as-cm-note{font:13px inherit;border:1px solid #cfc6e6;border-radius:7px;padding:6px 9px;resize:vertical;width:100%;box-sizing:border-box;display:block;margin-bottom:12px}
  /* #263 if Mammoth is installed it auto-enhances the .edit-note field (saved notes / history
     panel), which sits below the operations list. It wraps the textarea in .mmth-wrap + a
     300px side panel; the 680px modal fits that — give the wrap the note's bottom margin and
     full width. Hide Mammoth's WIDTH splitter in the modal: it overhangs a shorter panel, and
     stretching the panel to size-match the field feeds Mammoth's height observer into a
     runaway (infinite growth, #245). The field stays HEIGHT-resizable via its own corner grip. */
  #as-commit .mmth-wrap{margin:0 0 12px;max-width:none}
  #as-commit .mmth-vsep{display:none}
  .as-cm-chk{display:flex;align-items:center;gap:6px;cursor:pointer;color:#555}
  .as-cm-opts{flex-direction:row;gap:18px;flex-wrap:wrap}
  .as-cm-opts label{display:flex;align-items:center;gap:6px;cursor:pointer;color:#444}
  .as-cm-dry{color:#a05a00;display:flex;align-items:center;gap:6px;cursor:pointer}
  .as-cm-list{overflow:auto;border:1px solid #eee;border-radius:8px;padding:6px;margin:4px 0 12px;background:#fafafa;flex:1 1 auto;min-height:0}   /* #263 flex so the note + buttons below stay pinned and the list scrolls */
  .as-cm-op{padding:5px 6px;border-radius:6px;font-size:13px}
  .as-cm-op.dry{background:#f3eefe}.as-cm-op.err{background:#fdecea}
  .as-cm-line{display:flex;align-items:center;gap:6px}   /* #278: keep the row on one flex line so the bar can pin right */
  .as-cm-st{display:inline-block;min-width:18px;white-space:nowrap;text-align:center;flex:none}
  .as-cm-lb{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .as-cm-skip{font-size:11px;color:#999;margin-left:6px;background:#eee;border-radius:10px;padding:1px 7px;flex:none}
  .as-cm-payload{white-space:pre-wrap;font:11px/1.4 ui-monospace,Consolas,monospace;color:#555;margin:4px 0 2px 18px;display:none}
  .as-cm-op.dry .as-cm-payload,.as-cm-op.err .as-cm-payload{display:block}
  /* #278 per-row progress bar (right side, was empty) */
  .as-cm-bar{flex:0 0 110px;margin-left:auto;height:7px;border-radius:5px;background:#e9e4f3;overflow:hidden;position:relative;display:none}
  .as-cm-bar.on{display:block}
  .as-cm-bfill{display:block;height:100%;width:0;background:var(--as-acc);border-radius:5px;transition:width .15s linear}
  .as-cm-bar.done .as-cm-bfill{background:#2e9b57}
  .as-cm-bar.dry .as-cm-bfill{background:#b9a4e0}
  .as-cm-bar.err .as-cm-bfill{background:var(--as-warn)}
  .as-cm-bar.cancel .as-cm-bfill{background:#bbb}
  .as-cm-bar.busy .as-cm-bfill{position:absolute;width:40%;left:0;animation:as-cm-ind 1.1s ease-in-out infinite}
  @keyframes as-cm-ind{0%{left:-40%}100%{left:100%}}
  /* #278 overall progress (header) */
  .as-cm-prog{display:flex;align-items:center;gap:10px;margin:-2px 0 12px}
  .as-cm-prog-track{flex:1 1 auto;height:8px;border-radius:6px;background:#e9e4f3;overflow:hidden}
  .as-cm-prog-fill{height:100%;width:0;background:var(--as-acc);border-radius:6px;transition:width .2s linear}
  .as-cm-prog-txt{flex:none;font-size:12px;font-weight:600;color:#5f3ec0;font-variant-numeric:tabular-nums;white-space:nowrap}
  .as-cm-f{display:flex;align-items:center;gap:8px}
  .as-cm-id{color:#a99fc4;font-size:12px;font-variant-numeric:tabular-nums;flex:none}
  .as-cm-go{background:var(--as-acc);color:#fff;border-color:var(--as-acc);font-weight:600}
  .as-cm-go:disabled{opacity:.5}
  .as-cm-note2{font-size:11px;color:#9a8ccb;margin-top:8px;text-align:center}
  `;
  const st = document.createElement('style'); st.textContent = css; appendEl(st);

  // ── #248 add page: harvest images seeded into the native uploader ───────────────
  // Integrations (ECAU / Harmony) drop images into MB's add-cover-art uploader. We
  // read each preview row's blob and stage it as a NEW cover. Runs on load and via an
  // observer because the seed is async (ECAU fetches + maximises after the page settles).
  // NOTE: we deliberately do NOT scrape the row's type/comment checkboxes — ECAU sets
  // them via Knockout and re-renders rows when maximising, so the checked state is only
  // momentarily readable and racing it was unreliable (#253). Types are set instead from
  // the file-name option or in AS itself.
  // #253 read each preview image's OWN type + comment — NEVER doc-wide (that smears
  // every image's types onto every cover). The native uploader nests an image's
  // checkbox grid in an ancestor it shares with nothing else (imageScope finds it);
  // ECAU lays the preview out apart from the grid, so as a fallback the Nth preview
  // image is matched to the Nth visible type group by render order.
  function imageScope(img) {
    let n = img.parentElement, scope = null;
    while (n) {
      if (n.querySelectorAll('img.uploader-preview-image, img[src^="blob:"]').length > 1) break;   // climbed past this image
      if (n.querySelector('.cover-art-types input[type=checkbox], input[name*="type_id"]')) scope = n;   // widest single-image block holding this image's grid
      if (n.tagName === 'FORM' || !n.parentElement) break;
      n = n.parentElement;
    }
    return scope;
  }
  function readTypeGroup(group, block) {
    const types = [...group.querySelectorAll('input[type=checkbox]:checked, input[name*="type_id"]:checked')]
      .map(cb => { const l = cb.closest('label'); return l ? l.textContent.trim() : ''; })
      .filter(t => ALL_TYPES.includes(t));
    const sel = 'input[name*="comment"], textarea[name*="comment"], input.comment, textarea.comment';
    let ci = group.querySelector(sel);                                          // the group's own comment, if nested
    if (!ci && block && block !== group) { const cs = block.querySelectorAll(sel); if (cs.length === 1) ci = cs[0]; }   // else a single-image block's lone comment (never a shared one)
    return { types, comment: ci ? (ci.value || '') : '' };
  }
  const visibleTypeGroups = root => [...root.querySelectorAll('.cover-art-types')]
    .filter(g => g.querySelector('input[type=checkbox]') && g.offsetParent !== null);   // skip the hidden knockout template
  function readArtMeta(img) {
    const scope = imageScope(img);
    if (scope) return readTypeGroup(scope.querySelector('.cover-art-types') || scope, scope);
    // ECAU/other restructured uploader → match the Nth image to the Nth type group
    const root = img.closest('form') || img.getRootNode();
    const imgs = [...root.querySelectorAll('img.uploader-preview-image, img[src^="blob:"]')];
    const groups = visibleTypeGroups(root);
    const i = imgs.indexOf(img);
    if (i >= 0 && groups.length === imgs.length && groups[i]) return readTypeGroup(groups[i], groups[i].closest('td, li, tr') || groups[i].parentElement);
    return { types: [], comment: '' };
  }
  // harvest is idempotent + re-runnable: a NEW row is staged; a row we've already
  // staged has its type/comment SYNCED if the integration set them after the image
  // appeared (common with ECAU) — but only while the user hasn't edited that cover.
  let _seedNote = '';   // #248 an edit note an integration pre-filled on the native add page → moved to our commit panel
  // #253 harvest keys on the uploader ROW (tagged once), NOT the blob URL: ECAU
  // maximises the preview in place — the blob URL changes — so blob-keying re-staged
  // the SAME image on every pass (multiple identical covers from one seed). Reentrancy
  // is guarded with a trailing re-run so overlapping passes can't double-add either.
  let _harvesting = false, _harvestPending = false, _rowSeq = 0;
  async function harvestSeeds() {
    if (_harvesting) { _harvestPending = true; return; }
    _harvesting = true; _harvestPending = false;
    try {
      const form = document.getElementById('add-' + ART); if (!form) return;
      const en = form.querySelector('textarea.edit-note, textarea[name*="edit_note"]');   // capture a seeded edit note
      if (en && en.value && en.value.trim()) _seedNote = en.value.trim();
      const rows = [...form.querySelectorAll('tr')].filter(tr => tr.querySelector('img.uploader-preview-image, img[src^="blob:"]'));
      const files = [], metas = []; let dirty = false;
      for (const tr of rows) {
        const img = tr.querySelector('img.uploader-preview-image, img[src^="blob:"]');
        const src = img && (img.src || img.getAttribute('src'));
        if (!src || !/^blob:/i.test(src)) continue;
        const rowId = tr.dataset.asRow;
        if (rowId) {   // this row is already staged — swap in a maximised image, never re-add
          const existing = MODEL.find(m => m._seedSrc === rowId);
          if (!existing || existing._del) continue;
          if (src !== existing._seedBlobSrc) {   // ECAU maximised → replace the staged blob with the bigger one
            let blob; try { blob = await fetch(src).then(r => r.ok ? r.blob() : null); } catch (e) { blob = null; }
            if (blob) {
              try { URL.revokeObjectURL(existing._file); } catch (e) {}
              const m = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/jpeg';
              existing._file = URL.createObjectURL(blob);
              existing._fileObj = new File([blob], (existing._fileObj && existing._fileObj.name) || 'seed.jpg', { type: m });
              existing._seedBlobSrc = src; existing.bytes = blob.size; existing.w = 0; existing.h = 0; existing._contentKey = await fileKey(existing._fileObj);
              _imgCache.delete(String(existing.id)); measure(existing); dirty = true;
            }
          }
          continue;
        }
        let blob; try { blob = await fetch(src).then(r => r.ok ? r.blob() : null); } catch (e) { blob = null; }
        if (!blob) continue;   // not decodable yet — a later pass will pick it up
        const id = 'srow' + (++_rowSeq);
        tr.dataset.asRow = id;   // tag BEFORE staging so a racing pass sees it taken
        const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/jpeg';
        const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        files.push(new File([blob], `seed-${Date.now()}-${files.length}.${ext}`, { type: mime }));
        metas.push({ seedSrc: id, seedBlobSrc: src });   // #253 image only — types are set via the file-name option or in AS, not scraped from ECAU's transient checkboxes
      }
      const added = files.length ? await addFilesDeduped(files, metas) : 0;
      if (added) toast(`Imported ${added} pre-added ${added > 1 ? ITEMS : ITEM} ✓`);
      else if (dirty) { refreshStaged(); render(); }
    } finally {
      _harvesting = false;
      if (_harvestPending) { _harvestPending = false; harvestSeeds(); }
    }
  }
  function initAdd() {
    if (!IS_ADD) return;
    const form = document.getElementById('add-' + ART);
    if (!form) {   // uploader not in the DOM yet — wait for it
      const o = new MutationObserver(() => { if (document.getElementById('add-' + ART)) { o.disconnect(); initAdd(); } });
      o.observe(document.documentElement, { childList: true, subtree: true });
      return;
    }
    let t; const soon = () => { clearTimeout(t); t = setTimeout(harvestSeeds, 250); };
    harvestSeeds();
    // a new row, a maximised image (src swap), or a type/comment change all re-harvest.
    new MutationObserver(soon).observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    form.addEventListener('change', soon);
    form.addEventListener('input', soon);
    // MB applies seeded types/comments by setting the checkbox `checked` PROPERTY (no
    // change event) a beat after the image, so neither the observer nor the listeners
    // fire — poll-resync for a while so the per-row type/comment still gets picked up. #253
    let polls = 0;
    const poll = setInterval(() => { if (++polls > 24 || !document.getElementById('as-root')) { clearInterval(poll); return; } harvestSeeds(); }, 800);
    window.addEventListener('beforeunload', () => clearInterval(poll));
  }

  // we run at document-start; wait for #content before mounting the gallery
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => loadArt().then(initAdd), { once: true });
  else loadArt().then(initAdd);
})();
