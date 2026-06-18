// ==UserScript==
// @name         Art Station
// @namespace    https://musicbrainz.org/
// @version      2026.6.18.143000
// @description  Cover-art editor for MusicBrainz — one gallery to view, group, sort, reorder, retype, comment, remove, download and source (MH Covers) a release's cover art, staged and applied on Enter edit. PoC (discussion #230).
// @author       majkinetor
// @match        *://*.musicbrainz.org/release/*/cover-art
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

  const M = location.pathname.match(/\/release\/([0-9a-f-]{36})\/cover-art/i);
  if (!M) return;
  const MBID = M[1];

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

  // Proper edit-note attribution, like the other scripts: "Name vX by author - url".
  // GM_info is exposed even under @grant none on the common managers; fall back to
  // the hard-coded repo URL so the note never reads "v undefined".
  const _gm = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script : null;
  const SCRIPT_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/art_station';
  const ATTRIBUTION = _gm
    ? `${_gm.name} v${_gm.version} by ${_gm.author} - ${_gm.homepageURL || _gm.homepage || SCRIPT_URL}`
    : `Art Station by majkinetor - ${SCRIPT_URL}`;

  const CAA = `https://coverartarchive.org/release/${MBID}`;
  const imgUrl  = id => `${CAA}/${id}.jpg`;          // original
  const thumb   = (id, n) => `${CAA}/${id}-${n}.jpg`; // 250 / 500 / 1200

  // canonical MB cover-art types, in a sensible display order; "(none)" is virtual
  const TYPE_ORDER = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Matrix/Runout', 'Top', 'Bottom', 'Spine', 'Other'];
  const ALL_TYPES  = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Raw/Unedited', 'Matrix/Runout', 'Top', 'Bottom', 'Panel', 'Other'];
  const NO_TYPE = '(no type)';

  let MODEL = [];       // [{ id, types:[], comment, order, w, h, bytes, _del, _new, _file }]
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
  function refreshDim(it) {
    const el = document.querySelector(`.as-card[data-id="${CSS.escape(String(it.id))}"] .as-dim`);
    if (el) el.textContent = dimText(it);
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
    } catch (e) { /* size is a nicety — never block the gallery */ }
  }
  let SETTINGS = load();
  function load() { try { return Object.assign({ tile: 200, group: false, sort: 'type', detailed: false }, JSON.parse(localStorage.getItem('artstation:settings') || '{}')); } catch (e) { return { tile: 200, group: false, sort: 'type', detailed: false }; } }
  function save() { try { localStorage.setItem('artstation:settings', JSON.stringify(SETTINGS)); } catch (e) {} }

  // ── data ───────────────────────────────────────────────────────────────────
  // MB's page (its DB) is the source of truth for the cover list — it includes images
  // that aren't on the Cover Art Archive yet (just added). CAA only enriches comments.
  function parsePageArt() {
    const blocks = [...document.querySelectorAll('.artwork-cont')];
    if (!blocks.length) return null;
    return blocks.map((b, i) => {
      const ed = b.querySelector('a[href*="/edit-cover-art/"]');
      const m = ed && ed.getAttribute('href').match(/\/edit-cover-art\/(\d+)/);
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
    const pageArt = parsePageArt();
    let caa = [];
    try { const j = await fetch(CAA, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null); if (j) caa = j.images || []; }
    catch (e) { /* not propagated / none yet */ }
    const byId = new Map(caa.map(im => [String(im.id), im]));
    const source = (pageArt && pageArt.length)
      ? pageArt.map(p => ({ id: p.id, types: p.types, comment: p.comment || (byId.get(String(p.id)) || {}).comment || '', pending: p.pending, img: p.img || (byId.get(String(p.id)) || {}).image || imgUrl(p.id), pdf: p.pdf }))
      : caa.map(im => ({ id: im.id, types: (im.types || []).slice(), comment: im.comment || '', pending: false, img: im.image || imgUrl(im.id), pdf: /\.pdf(\?|$)/i.test(im.image || '') }));
    MODEL = source.map((s, i) => ({
      id: s.id, types: s.types.slice(), comment: s.comment,
      order: i, w: 0, h: 0, _del: false, _new: false, _pending: !!s.pending, _pdf: !!s.pdf || /\.pdf(\?|$)/i.test(s.img || ''), _img: s.img,
      _origTypes: s.types.slice(), _origComment: s.comment, _origOrder: i,
    }));
    render();
    MODEL.forEach(measure);   // lazy-fill dimensions
    loadSizes();              // lazy-fill file sizes (single archive.org request)
  }
  function measure(it) {
    if (it.w || (it._new && it._pdf)) return;          // measured already, or a PDF (no pixel dims)
    const src = it._new ? it._file : imgUrl(it.id);     // new covers measure from the local object URL
    if (!src) return;
    const img = new Image();
    img.onload = () => { it.w = img.naturalWidth; it.h = img.naturalHeight; refreshDim(it); };
    img.src = src;
  }

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
  let _showOrig = false;       // "Show original" (View) — reveal MB's native UI, keep only our toolbar
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
    [...anchor.children].forEach(ch => {
      if (ch === root || ch === afterTabs || ch === afterH1) return;
      if (ch.tagName === 'H2' || ch.tagName === 'P') hide(ch);
      else if (ch.querySelector && ch.querySelector('.artwork-cont')) hide(ch);
      else if (ch.classList && ch.classList.contains('artwork-cont')) hide(ch);
    });
    document.querySelectorAll('.artwork-cont').forEach(hide);
  }
  // "Show original" (View): un-hide MB's native cover-art UI and collapse our
  // gallery to just the toolbar — like Apollo's native/script switcher. #234
  function applyOriginal() {
    earlyHide.disabled = _showOrig;                                  // the document-start hiding style
    _native.forEach(el => { el.style.display = _showOrig ? '' : 'none'; });
    root.classList.toggle('as-orig', _showOrig);                     // hides the whole Art Station UI
    ensureSwitch();
  }
  // #234: an Apollo-style fixed switcher (bottom-right) toggling Original ⇄ Art
  // Station — always visible; the only control left when the native UI is shown.
  function ensureSwitch() {
    let sw = document.getElementById('as-switch');
    if (!sw) {
      sw = document.createElement('button'); sw.id = 'as-switch';
      document.body.appendChild(sw);
      sw.onclick = () => { _showOrig = !_showOrig; render(); };
    }
    sw.textContent = _showOrig ? 'Art Station' : 'Original';
    sw.title = _showOrig ? 'Switch back to the Art Station gallery' : 'Show the original MusicBrainz cover-art page';
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
    applyOriginal();   // keep the native/script view state across re-renders
    applyZoomClass();
    fitTypePills();    // show as many types as the pill width allows
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
    if (SETTINGS.sort === 'bytype') return typeRank(a.types[0] || '') - typeRank(b.types[0] || '') || a.order - b.order;
    if (SETTINGS.sort === 'dim') return (b.w * b.h) - (a.w * a.h) || a.order - b.order;
    if (SETTINGS.sort === 'newest') return b.id - a.id;   // CAA id desc ≈ upload recency (no real date in CAA)
    return a.order - b.order;   // position (committed order)
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function bar(n) {
    return `<div class="as-bar">
      <button class="as-btn as-add" title="Add cover art — file drop zone (goes first)"><span class="as-bi">＋</span><span class="as-bt">Add image</span></button>
      <button class="as-btn as-mh" title="MH Covers — source a cover from covers.musichoarders.xyz (#235)"><img class="as-mh-ic" src="https://covers.musichoarders.xyz/favicon.svg" alt="MH" width="18" height="18"></button>
      <span class="as-ctl"><span class="as-bt">Size</span> <input class="as-size" type="range" min="120" max="340" value="${SETTINGS.tile}" title="Thumbnail size"></span>
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
      <button class="as-ic as-selall" title="Select all covers">✳</button>
      <button class="as-ic as-selclr" title="Clear selection"${sel.length ? '' : ' disabled'}>✕</button>
      ${sel.length ? `<button class="as-btn as-bk-type" title="Set type on the selection">Type ▾</button>
      <button class="as-btn as-bk-cmt" title="Set a comment on the selection"><span class="as-bi">✎</span><span class="as-bt">Comment ▾</span></button>
      <button class="as-btn as-bk-dl" title="Download the selected covers"><span class="as-bi">⬇</span><span class="as-bt">Download</span></button>
      <button class="as-btn as-bk-report" title="Postable Markdown / HTML report of the selection"><span class="as-bi">📋</span><span class="as-bt">Report</span></button>
      <button class="as-btn as-bk-rm" title="Mark the selected covers for removal"><span class="as-bi">🗑️</span><span class="as-bt">Delete</span></button>` : ''}`;
  }
  function section(type, items) {
    const label = type === null ? 'All covers' : type;
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
      <div class="as-dz-in">⬇ Drop cover images here<span>or click to browse · new covers go first</span></div></div>`;
  }
  function newSection() {
    if (!SETTINGS.group) return '';   // Position view shows new uploads inline, positioned among covers
    const news = MODEL.filter(it => it._new && !it._del).sort((a, b) => a.order - b.order);
    if (!news.length) return '';
    return `<div class="as-sec as-sec-new"><h3>New uploads</h3><span class="as-cnt">${news.length}</span><span class="as-line"></span></div>
      <div class="as-grid">${news.map(card).join('')}</div>`;
  }
  function deletedSection() {
    const dels = MODEL.filter(it => it._del);
    if (!dels.length) return '';
    return `<div class="as-sec as-sec-del"><h3>Marked for removal</h3><span class="as-cnt">${dels.length}</span><span class="as-line"></span></div>
      <div class="as-grid">${dels.map(card).join('')}</div>`;
  }
  function card(it) {
    const src = it._new ? it._file : thumb(it.id, SETTINGS.tile > 260 ? 500 : 250);
    return `<div class="as-card${it._del?' del':''}${it._new?' new':''}${it._sel?' sel':''}${it._pending?' pending':''}" data-id="${esc(it.id)}" ${(!it._del && canReorder())?'draggable="true"':''}>
      <div class="as-thumb"><img loading="lazy" draggable="false" src="${esc(src)}" alt="">
        ${it._new ? '<span class="as-newban">NEW</span>' : ''}
        ${it._pdf ? '<span class="as-pdfban" title="PDF — opens in a new tab">PDF</span>' : ''}
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
    const dim = `<span class="as-dim">${esc(dimText(it))}</span>`;
    if (it._del) return `<div class="as-foot"><div class="as-foot-row"><span class="as-foot-cmt"></span>${dim}</div>${typeRow}</div>`;
    const cmt = it._editcmt
      ? `<input class="as-cmt" value="${esc(it.comment)}" placeholder="comment…" list="as-cmt-presets">`
      : (it.comment
          ? `<span class="as-cmt-text" title="edit comment">${esc(it.comment)}</span>`
          : `<button class="as-pencil" title="add a comment">✎</button>`);
    return `<div class="as-foot">
      <div class="as-foot-row"><span class="as-foot-cmt">${cmt}</span>${dim}</div>
      ${typeRow}
    </div>`;
  }
  // #238 Detailed view row: image + id on the left, all type checkboxes and the
  // full comment field beside it. No per-row toolbar actions (selection / delete
  // live on the main toolbar).
  function detailRow(it) {
    const src = it._new ? it._file : thumb(it.id, 250);
    const types = ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"${it.types.includes(t) ? ' checked' : ''}> ${esc(t)}</label>`).join('');
    return `<div class="as-drow${it._new ? ' new' : ''}${it._pending ? ' pending' : ''}${it._sel ? ' sel' : ''}" data-id="${esc(it.id)}">
      <input type="checkbox" class="as-dsel" title="select"${it._sel ? ' checked' : ''}>
      <div class="as-dleft">
        <div class="as-dthumb">${it._new ? '<span class="as-newban">NEW</span>' : ''}<img loading="lazy" draggable="false" src="${esc(src)}" alt="">${it._pdf ? '<span class="as-pdfban" title="PDF — opens in a new tab">PDF</span>' : ''}</div>
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
  function cardId(el) { const c = el.closest('.as-card'); return c ? c.dataset.id : null; }

  // Wire the comment controls. #234 split the footer (pencil on row 1, comment
  // on row 2 which only exists when there's a comment), so entering/leaving edit
  // re-renders — render() keeps the viewport put, so the page still doesn't jump.
  function wireComments() {
    root.querySelectorAll('.as-pencil, .as-cmt-text').forEach(el => el.onclick = e => {
      e.stopPropagation(); const it = byId(cardId(el)); if (!it) return;
      it._editcmt = true; render();
      root.querySelector(`.as-card[data-id="${CSS.escape(String(it.id))}"] .as-cmt`)?.focus();
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
        if (nextIt) root.querySelector(`.as-card[data-id="${CSS.escape(String(nextIt.id))}"] .as-cmt`)?.focus();
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
        const img = th.querySelector('img');
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
      if (cmt) cmt.oninput = () => { it.comment = cmt.value; refreshStaged(); };
      // selection: the checkbox is the certain indicator; right-click also paints
      const sel = row.querySelector('.as-dsel');
      if (sel) sel.onchange = () => { it._sel = sel.checked; row.classList.toggle('sel', it._sel); syncSel(); };
      row.onmousedown = e => { if (e.button !== 2) return; e.preventDefault(); _paint = { value: !it._sel }; paintCard(row); };
    });
  }

  function wire() {
    root.querySelector('.as-size').oninput = e => { SETTINGS.tile = +e.target.value; document.documentElement.style.setProperty('--as-tile', SETTINGS.tile + 'px'); applyZoomClass(); fitTypePills(); };
    root.querySelector('.as-size').onchange = () => { save(); render(); };
    const view = root.querySelector('.as-view'); if (view) view.onclick = e => { e.stopPropagation(); openViewPop(view); };
    const dw = root.querySelector('.as-dragwarn'); if (dw) dw.onclick = () => { SETTINGS.detailed = false; SETTINGS.group = false; SETTINGS.sort = 'type'; save(); render(); };
    root.querySelector('.as-add').onclick = toggleDropZone;
    const mh = root.querySelector('.as-mh'); if (mh) mh.onclick = openMHCovers;
    const mhIc = root.querySelector('.as-mh-ic'); if (mhIc) mhIc.onerror = () => mhIc.replaceWith(document.createTextNode('🔍'));
    const commit = root.querySelector('.as-commit'); if (commit && !commit.disabled) commit.onclick = enterEdit;

    root.querySelectorAll('.as-undo').forEach(b => b.onclick = e => { e.stopPropagation(); const it = byId(cardId(e.target)); if (it) { it._del = false; render(); } });
    wireComments();
    wireDetail();

    const dz = root.querySelector('.as-dropzone');
    if (dz) {
      dz.onclick = pickFiles;
      dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); addFiles(e.dataTransfer.files); };
    }

    // type pill → popover
    root.querySelectorAll('.as-type').forEach(ch => ch.onclick = e => { e.stopPropagation(); openTypePop(ch); });
    // click the THUMB (not just the <img>, which is display:none on a not-yet-propagated
    // cover) → lightbox; PDFs open in a new tab. right-click card → toggle selection
    root.querySelectorAll('.as-thumb').forEach(th => {
      th.onclick = e => { if (e.target.closest('button')) return; const it = byId(cardId(e.target)); if (!it) return; if (it._pdf) window.open(it._img, '_blank', 'noopener'); else openLightbox(it.id); };
      const img = th.querySelector('img'); if (!img) return;
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
        _paint = { value: !it._sel }; paintCard(c);
      };
    });
    wireSel();
    wireDrag();
    markCursor();
  }
  function wireSel() {
    const q = s => root.querySelector(s);
    q('.as-selall') && (q('.as-selall').onclick = () => { selectable().forEach(it => it._sel = true); root.querySelectorAll('.as-card:not(.del), .as-drow').forEach(c => c.classList.add('sel')); root.querySelectorAll('.as-dsel').forEach(cb => cb.checked = true); syncSel(); });
    q('.as-selclr') && (q('.as-selclr').onclick = () => { MODEL.forEach(it => it._sel = false); root.querySelectorAll('.as-card.sel, .as-drow.sel').forEach(c => c.classList.remove('sel')); root.querySelectorAll('.as-dsel').forEach(cb => cb.checked = false); syncSel(); });
    q('.as-bk-rm')  && (q('.as-bk-rm').onclick  = () => { MODEL.forEach(it => { if (it._sel) { it._del = true; it._sel = false; } }); render(); });
    q('.as-bk-dl')  && (q('.as-bk-dl').onclick  = async e => {
      const sel = MODEL.filter(it => it._sel && !it._new); if (!sel.length) return;
      if (sel.length === 1) return dlOne(sel[0]);           // single → save the image directly
      const b = e.currentTarget, lbl = b.querySelector('.as-bt'), old = lbl ? lbl.textContent : '';
      b.disabled = true; if (lbl) lbl.style.display = 'inline';   // show progress even in compact mode
      const prog = (d, t) => { if (lbl) lbl.textContent = `Zipping ${d}/${t}…`; };
      prog(0, sel.length);
      try { await dlZip(sel, prog); } finally { b.disabled = false; if (lbl) { lbl.textContent = old; lbl.style.display = ''; } }   // multiple → one .zip (#240)
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
    syncSel();
  }
  document.addEventListener('mousemove', e => {
    if (!_paint || !e.buttons) return;   // e.buttons falls to 0 if the button was released off-window
    const c = e.target.closest && e.target.closest('.as-card, .as-drow');
    if (c && root.contains(c)) paintCard(c);
  });
  document.addEventListener('mouseup', () => { _paint = null; });
  window.addEventListener('resize', () => { if (root.isConnected) fitToolbar(); });
  // right-click is our selection gesture across the gallery — suppress the native menu there
  document.addEventListener('contextmenu', e => { if (root.contains(e.target)) e.preventDefault(); });

  // refresh just the toolbar's selection cluster in place — no grid reflow, so
  // right-click paint-select never makes the page jump.
  function syncSel() {
    const box = root.querySelector('.as-selbox');
    if (box) { box.innerHTML = selBox(); wireSel(); fitToolbar(); }
  }
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
    const label = it => it.types[0] || (it._new ? 'new image' : 'cover');
    const ops = [];
    MODEL.filter(it => it._new && !it._del).forEach(it => ops.push(`➕ Add ${label(it)}${it.types.length ? ` — ${it.types.join(', ')}` : ''}${it.comment ? ` “${it.comment}”` : ''}`));
    MODEL.filter(it => it._del && !it._new).forEach(it => ops.push(`🗑 Remove ${label(it)}`));
    MODEL.filter(it => !it._del && !it._new).forEach(it => {
      if (it.types.join('|') !== it._origTypes.join('|')) ops.push(`🏷 Set type on ${it._origTypes[0] || 'cover'} → ${it.types.join(', ') || '(none)'}`);
      if (it.comment !== it._origComment) ops.push(`✎ Comment on ${label(it)} → ${it.comment ? `“${it.comment}”` : '(cleared)'}`);
    });
    // reorder = the EXISTING covers' relative order changed. Inserting new covers
    // shifts indices but is positioned by the add op itself (not a separate reorder).
    const ex = MODEL.filter(it => !it._del && !it._new);
    const now = ex.slice().sort((a, b) => a.order - b.order).map(it => it.id).join(',');
    const orig = ex.slice().sort((a, b) => a._origOrder - b._origOrder).map(it => it.id).join(',');
    if (now !== orig) ops.push('↕ Reorder covers');
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
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const it = byId(cardId(chip)); if (!it) return;
    const pop = document.createElement('div'); pop.className = 'as-pop';
    pop.innerHTML = `<div class="as-type-grid">${ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"${it.types.includes(t)?' checked':''}> ${esc(t)}</label>`).join('')}</div>`;
    document.body.appendChild(pop);
    placePop(pop, chip.getBoundingClientRect());
    pop.querySelectorAll('input').forEach(cb => cb.onchange = () => {
      it.types = ALL_TYPES.filter(t => pop.querySelector(`input[value="${CSS.escape(t)}"]`).checked);
      render();
    });
    const off = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

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
  async function dlOne(it) {
    const url = it._img || imgUrl(it.id);
    const ext = (url.match(/\.(jpg|jpeg|png|gif|pdf|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase();
    const name = `${MBID}-${it.id}.${ext}`;
    try {
      // cross-origin <a download> is ignored by browsers — fetch the blob (CAA
      // sends CORS) and download via a same-origin object URL so it actually saves
      const blob = await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); });
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = obj; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 8000);
    } catch (e) { window.open(url, '_blank'); }   // fallback: just open it
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
    return sel.map(it => {
      const url = it._img || imgUrl(it.id);
      const ext = (url.match(/\.(jpg|jpeg|png|gif|pdf|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase();
      let base = (it.types[0] || 'cover'), name = `${base}.${ext}`, n = 2;
      while (used.has(name.toLowerCase())) name = `${base}-${n++}.${ext}`;
      used.add(name.toLowerCase());
      return { url, name };
    });
  }
  const fetchBytes = async url => new Uint8Array(await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
  async function dlZip(sel, onProgress) {
    const items = zipNames(sel), enc = new TextEncoder();
    // #240: stream the zip straight to disk when the browser supports it — the
    // download starts immediately (first cover written as soon as it arrives) and
    // the whole archive is never buffered in memory.
    if (window.showSaveFilePicker) {
      let handle;
      try { handle = await window.showSaveFilePicker({ suggestedName: `${MBID}-covers.zip`, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] }); }
      catch (e) { return; }   // user cancelled the save dialog
      const w = await handle.createWritable();
      const central = []; let offset = 0, done = 0;
      for (const o of items) {
        let data; try { data = await fetchBytes(o.url); } catch (e) { onProgress && onProgress(++done, items.length); continue; }
        const name = enc.encode(o.name), crc = crc32(data);
        await w.write(zipLocal(crc, data.length, name.length)); await w.write(name); await w.write(data);
        central.push({ crc, size: data.length, name, offset });
        offset += 30 + name.length + data.length;
        onProgress && onProgress(++done, items.length);
      }
      let cdSize = 0;
      for (const c of central) { await w.write(zipCentral(c.crc, c.size, c.name.length, c.offset)); await w.write(c.name); cdSize += 46 + c.name.length; }
      await w.write(zipEOCD(central.length, cdSize, offset));
      await w.close();
      return;
    }
    // fallback: fetch all in PARALLEL (fast), then one blob download
    let done = 0;
    const results = await Promise.all(items.map(async o => {
      try { const data = await fetchBytes(o.url); onProgress && onProgress(++done, items.length); return { name: o.name, data }; }
      catch (e) { onProgress && onProgress(++done, items.length); return null; }
    }));
    const entries = results.filter(Boolean);
    if (!entries.length) return;
    const obj = URL.createObjectURL(makeZip(entries));
    const a = document.createElement('a'); a.href = obj; a.download = `${MBID}-covers.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 8000);
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
  let _toastT;
  function toast(msg, ms = 2800) {
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
  async function addCoverFromMH(o) {
    const url = o.bigCoverUrl || o.smallCoverUrl; if (!url) return;
    toast('Fetching cover from MH…', 120000);
    try {
      const blob = await gmFetch(url, (l, t) => toast(`Fetching cover from MH… ${Math.round(l / t * 100)}%`, 120000));
      const ext = (String(url).match(/\.(jpe?g|png|gif|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
      const type = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/jpeg';
      const file = new File([blob], `mh-${Date.now()}.${ext}`, { type });
      addFiles([file]);
      toast('Added cover from MH Covers ✓');
    } catch (e) { toast('Could not fetch the cover — ' + e.message, 5000); }
  }

  let _dropZone = false;
  function toggleDropZone() { _dropZone = !_dropZone; render(); if (_dropZone) root.querySelector('.as-dropzone')?.scrollIntoView({ block: 'nearest' }); }
  function newItem(f) {
    return { id: 'new-' + Math.random().toString(36).slice(2, 8), types: [], comment: '', order: 0, w: 0, h: 0,
      bytes: f.size, _del: false, _new: true, _pdf: f.type === 'application/pdf', _file: URL.createObjectURL(f), _fileObj: f, _origTypes: [], _origComment: '', _origOrder: -1 };
  }
  function addFiles(files) {
    const news = [...files].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf').map(newItem);
    if (!news.length) return;
    // new covers go FIRST (majkinetor: they were landing last), then existing in order
    const rest = MODEL.slice().sort((a, b) => a.order - b.order);
    MODEL = [...news, ...rest];
    MODEL.forEach((it, i) => it.order = i);
    news.forEach(measure);   // fill in each new cover's resolution from its local file
    _dropZone = false; render();
  }
  function pickFiles() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.pdf'; inp.multiple = true;
    inp.onchange = () => addFiles(inp.files);
    inp.click();
  }
  // ── Phase 2a: apply staged changes as real MB edits (form-replay) ─────────────
  const R = `/release/${MBID}`;
  // credit the tool in every edit note (user's note first, then the attribution)
  const editNote = m => [m.note && m.note.trim(), ATTRIBUTION].filter(Boolean).join('\n\n');
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
    const form = await getPostForm(`${R}/edit-cover-art/${it.id}`);
    const p = new URLSearchParams(); copyHidden(form, p);
    const tm = typeMapOf(form, 'edit-cover-art');
    it.types.forEach(t => { if (tm[t]) p.append('edit-cover-art.type_id', tm[t]); });
    p.append('edit-cover-art.comment', it.comment);
    p.append('edit-cover-art.edit_note', editNote(meta));
    if (meta.votable) p.append('edit-cover-art.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  async function buildRemove(it, meta) {
    const form = await getPostForm(`${R}/remove-cover-art/${it.id}`);
    const p = new URLSearchParams(); copyHidden(form, p);
    p.append('confirm.edit_note', editNote(meta));
    if (meta.votable) p.append('confirm.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  // Phase 2b: upload a new image. (1) sign via MB, (2) POST file to archive.org, (3) register.
  async function signUpload(mime, ctl) {
    const r = await fetch(`/ws/js/cover-art-upload/${MBID}?mime_type=${encodeURIComponent(mime || 'image/jpeg')}`, { credentials: 'same-origin', signal: ctl && ctl.ac.signal });
    if (!r.ok) throw new Error('sign ' + r.status);
    return r.json();   // { action, image_id, formdata, nonce }
  }
  let _addForm = null;
  const addForm = () => (_addForm = _addForm || getPostForm(`${R}/add-cover-art`));
  // step 1 (parallel-safe): sign + PUT the file to archive.org. Stores the signed
  // upload on the item; the slow network part — like Turbo, run these concurrently.
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
    const tm = typeMapOf(form, 'add-cover-art');
    const typeIds = it.types.map(t => tm[t]).filter(Boolean);
    const mime = (it._fileObj && it._fileObj.type) || 'image/jpeg';
    const p = new URLSearchParams(); copyHidden(form, p, /\.(nonce|position|id|type_id|comment|mime_type)$/);
    p.append('add-cover-art.id', it._signed.image_id);
    p.append('add-cover-art.position', String(it.order + 1));
    p.append('add-cover-art.nonce', it._signed.nonce);
    p.append('add-cover-art.mime_type', mime);   // required Select (MB Form::Role::AddArt)
    typeIds.forEach(id => p.append('add-cover-art.type_id', id));
    p.append('add-cover-art.comment', it.comment);
    p.append('add-cover-art.edit_note', editNote(meta));
    if (meta.votable) p.append('add-cover-art.make_votable', '1');
    const add = await fetch(`${R}/add-cover-art`, { method: 'POST', body: p, credentials: 'same-origin', signal: ctl && ctl.ac.signal });
    if (!add.ok) throw new Error('add ' + add.status);
  }
  async function runAdd(it, meta, dry, report) {   // dry-run summary only (live uses runAdds)
    const mime = (it._fileObj && it._fileObj.type) || 'image/jpeg';
    const form = await addForm();
    const typeIds = it.types.map(t => typeMapOf(form, 'add-cover-art')[t]).filter(Boolean);
    report(`1. GET /ws/js/cover-art-upload/${MBID}?mime_type=${mime}  → {action,image_id,formdata,nonce}\n`
      + `2. POST ‹signed archive.org action›  multipart: ‹policy,signature,key,AWSAccessKeyId…› + file (${(it._fileObj && it._fileObj.name) || 'file'}, ${(it._fileObj && it._fileObj.size) || '?'}b)\n`
      + `3. POST ${R}/add-cover-art\n   add-cover-art.id=‹image_id›\n   add-cover-art.position=${it.order + 1}\n   add-cover-art.nonce=‹nonce›\n   add-cover-art.mime_type=${mime}\n`
      + `   add-cover-art.type_id=${typeIds.join(',') || '(none)'}\n   add-cover-art.comment=${it.comment}\n   add-cover-art.edit_note=${editNote(meta).replace(/\n+/g, ' / ')}`
      + (meta.votable ? `\n   add-cover-art.make_votable=1` : ''));
  }
  async function buildReorder(meta) {     // single edit: full ordered artwork list
    const form = await getPostForm(`${R}/reorder-cover-art`);
    const p = new URLSearchParams(); copyHidden(form, p, /\.artwork\./);
    const seq = MODEL.filter(it => !it._del && !it._new).sort((a, b) => a.order - b.order);
    seq.forEach((it, i) => { p.append(`reorder-cover-art.artwork.${i}.id`, it.id); p.append(`reorder-cover-art.artwork.${i}.position`, String(i + 1)); });
    p.append('reorder-cover-art.edit_note', editNote(meta));
    if (meta.votable) p.append('reorder-cover-art.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  // ordered work list (uploads are Phase 2b): remove → retype/comment → reorder
  function buildPlan() {
    const plan = [];
    MODEL.filter(it => it._new && !it._del).forEach(it => plan.push({ label: `Add ${it.types[0] || 'new image'}${it.comment ? ` “${it.comment}”` : ''} (upload)`, kind: 'add', it, run: (m, dry, report) => runAdd(it, m, dry, report) }));
    MODEL.filter(it => it._del && !it._new).forEach(it => plan.push({ label: `Remove ${it.types[0] || 'cover'}`, id: it.id, kind: 'remove', build: m => buildRemove(it, m) }));
    MODEL.filter(it => !it._del && !it._new && (it.comment !== it._origComment || it.types.join('|') !== it._origTypes.join('|')))
      .forEach(it => {
        // readable description of what changed on this cover (the panel list now
        // doubles as the "pending operations" view — #234)
        const ch = [];
        if (it.types.join('|') !== it._origTypes.join('|')) ch.push(`type → ${it.types.join(', ') || '(none)'}`);
        if (it.comment !== it._origComment) ch.push(`comment → ${it.comment ? `“${it.comment}”` : '(cleared)'}`);
        plan.push({ label: `Edit ${it._origTypes[0] || 'cover'}: ${ch.join(', ')}`, id: it.id, kind: 'edit', build: m => buildEdit(it, m) });
      });
    const ex = MODEL.filter(it => !it._del && !it._new);
    const now = ex.slice().sort((a, b) => a.order - b.order).map(it => it.id).join(',');
    const orig = ex.slice().sort((a, b) => a._origOrder - b._origOrder).map(it => it.id).join(',');
    if (now !== orig) plan.push({ label: 'Reorder covers', kind: 'reorder', build: m => buildReorder(m) });
    return plan;
  }

  function enterEdit() {
    document.getElementById('as-commit')?.remove();
    const plan = buildPlan();
    const ov = document.createElement('div'); ov.id = 'as-commit';
    ov.innerHTML = `<div class="as-cm-box">
      <div class="as-cm-h">Apply ${plan.length} change${plan.length===1?'':'s'} as MusicBrainz edits</div>
      <textarea class="as-cm-note" rows="2" placeholder="optional edit note shown on each edit"></textarea>
      <div class="as-cm-list">${plan.map((o, i) => `<div class="as-cm-op" data-i="${i}"><span class="as-cm-st">○</span> <span class="as-cm-lb">${esc(o.label)}</span>${o.id ? ` <span class="as-cm-id">#${esc(o.id)}</span>` : ''}${o.skip ? `<span class="as-cm-skip">${esc(o.skip)}</span>` : ''}<div class="as-cm-payload"></div></div>`).join('')}</div>
      <div class="as-cm-f"><label class="as-cm-dry"><input type="checkbox" class="as-cm-dryrun"> Dry run</label><label class="as-cm-chk"><input type="checkbox" class="as-cm-vote"> Make votable</label><span class="as-sp"></span><button class="as-btn as-cm-cancel">Cancel</button><button class="as-btn as-cm-go">Run</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelector('.as-cm-cancel').onclick = () => ov.remove();
    const dryEl = ov.querySelector('.as-cm-dryrun');
    const goBtn = ov.querySelector('.as-cm-go');
    const setGoLabel = () => goBtn.textContent = dryEl.checked ? 'Dry run' : 'Submit edits';
    dryEl.onchange = setGoLabel; setGoLabel();
    goBtn.onclick = () => runPlan(ov, plan, { note: ov.querySelector('.as-cm-note').value, votable: ov.querySelector('.as-cm-vote').checked, dry: dryEl.checked });
  }
  async function runOp(ov, op, meta, ctl) {
    const row = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`);
    const st = row.querySelector('.as-cm-st'), pay = row.querySelector('.as-cm-payload');
    if (op.skip) { st.textContent = '⏭'; return; }
    if (ctl && ctl.aborted) { st.textContent = '⛔'; return; }
    st.textContent = '⏳';
    try {
      if (op.run) {                         // multi-step op (uploads) reports its own payload
        await op.run(meta, meta.dry, txt => { pay.textContent = txt; });
        st.textContent = meta.dry ? '👁' : '✅'; if (meta.dry) row.classList.add('dry');
      } else {
        const req = await op.build(meta);
        if (meta.dry) {
          st.textContent = '👁'; row.classList.add('dry');
          pay.textContent = `${req.method} ${req.url}\n${decodeURIComponent(req.body.toString()).replace(/\+/g, ' ').replace(/&/g, '\n  ')}`;
        } else {
          const r = await fetch(req.url, { method: 'POST', body: req.body, credentials: 'same-origin', signal: ctl && ctl.ac.signal });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          st.textContent = '✅';
        }
      }
    } catch (e) {
      const cancelled = ctl && ctl.aborted;
      st.textContent = cancelled ? '⛔' : '❌'; pay.textContent = String(e && e.message || e);
      if (!cancelled) row.classList.add('err');
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
    const setSt = (op, s) => { ov.querySelector(`.as-cm-op[data-i="${op._i}"] .as-cm-st`).textContent = s; };
    const fail = (op, e) => { const row = ov.querySelector(`.as-cm-op[data-i="${op._i}"]`); row.querySelector('.as-cm-st').textContent = '❌'; row.querySelector('.as-cm-payload').textContent = String(e && e.message || e); row.classList.add('err'); op._err = true; };
    const stop = (op) => { setSt(op, '⛔'); op._err = true; };
    addOps.forEach(op => setSt(op, '⏳'));
    await pool(addOps, 4, async op => {
      if (ctl && ctl.aborted) return stop(op);
      try { await uploadStep(op.it, (l, t) => setSt(op, `⏫${Math.round(l / t * 100)}%`), ctl); setSt(op, '⏫'); }
      catch (e) { (ctl && ctl.aborted) ? stop(op) : fail(op, e); }
    });  // parallel upload w/ progress (abortable via ctl)
    for (const op of addOps) {                                   // ordered register
      if (op._err) continue;
      if (ctl && ctl.aborted) { stop(op); continue; }
      try { await registerStep(op.it, meta, ctl); setSt(op, '✅'); }
      catch (e) { (ctl && ctl.aborted) ? stop(op) : fail(op, e); }
    }
  }
  async function runPlan(ov, plan, meta) {
    const goBtn = ov.querySelector('.as-cm-go'), cancelBtn = ov.querySelector('.as-cm-cancel');
    goBtn.disabled = true;
    plan.forEach((op, i) => { op._i = i; });
    // ctl carries the abort flag + the live xhrs/fetch-signal so Cancel works mid-run
    const ctl = { aborted: false, xhrs: new Set(), ac: new AbortController() };
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
    // uploads run in parallel (register stays ordered); edits/removes parallel; reorder last.
    await runAdds(ov, plan.filter(o => o.kind === 'add'), meta, ctl);
    if (!ctl.aborted) await runPool(plan.filter(o => o.kind === 'edit' || o.kind === 'remove'), CONC, ov, meta, ctl);
    if (!ctl.aborted) await runPool(plan.filter(o => o.kind === 'reorder'), 1, ov, meta, ctl);
    cancelBtn.disabled = false;
    cancelBtn.textContent = 'Close';
    cancelBtn.onclick = () => ov.remove();
    if (ctl.aborted) {   // mark any not-yet-started ops as cancelled, leave the modal up
      ov.querySelectorAll('.as-cm-op .as-cm-st').forEach(s => { if (s.textContent === '○' || s.textContent === '⏳') s.textContent = '⛔'; });
      goBtn.textContent = 'Cancelled'; goBtn.disabled = true;
      return;
    }
    if (!meta.dry) {
      const b = ov.querySelector('.as-cm-go');
      const errs = ov.querySelectorAll('.as-cm-op.err').length;
      if (!errs) {
        // #234: clean run → reload automatically so the gallery shows the new
        // state (brief pause so the ✅s are visible first).
        b.textContent = 'Done — reloading…'; b.disabled = true;
        setTimeout(() => location.reload(), 900);
      } else {
        // something failed — leave it up so the user can read the ❌ rows.
        b.textContent = `Reload (${errs} failed)`; b.disabled = false; b.onclick = () => location.reload();
      }
    }
    else ov.querySelector('.as-cm-go').disabled = false;
  }

  // ── lightbox (#230: click image → popup, ←→↑↓ navigate) ───────────────────────
  let _lb = null;          // current lightbox image id
  let _z = { s: 1, x: 0, y: 0 };   // wheel-zoom state (scale + translate)
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
      ov.innerHTML = `<div class="as-lb-top"><button class="as-lb-play" title="slideshow (P)">▶ Play</button><button class="as-lb-x" title="close (Esc)">✕</button></div>
        <button class="as-lb-nav as-lb-prev" title="previous (←)">‹</button>
        <img class="as-lb-img" alt="">
        <button class="as-lb-nav as-lb-next" title="next (→)">›</button>
        <div class="as-lb-bar"><div class="as-lb-cap"></div>
          <div class="as-lb-cmtarea"></div></div>`;
      document.body.appendChild(ov);
      ov.querySelector('.as-lb-x').onclick = closeLightbox;
      ov.querySelector('.as-lb-play').onclick = e => { e.stopPropagation(); togglePlay(); };
      ov.querySelector('.as-lb-prev').onclick = e => { e.stopPropagation(); lbNav(-1); };
      ov.querySelector('.as-lb-next').onclick = e => { e.stopPropagation(); lbNav(1); };
      ov.onclick = e => { if (e.target === ov) closeLightbox(); };
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
    }
    resetZoom();   // a fresh open starts un-zoomed; ←/→ navigation keeps the zoom
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
    const bits = [it.types.length ? it.types.join(', ') : 'no type', it.w && it.h ? `${it.w} × ${it.h}` : null].filter(Boolean);
    ov.querySelector('.as-lb-cap').textContent = bits.join('  ·  ');
    paintCmtArea(ov, it);
  }
  let _lbEditCmt = false;
  function paintCmtArea(ov, it) {
    const area = ov.querySelector('.as-lb-cmtarea'); if (!area) return;
    if (_lbEditCmt) {
      area.innerHTML = `<input class="as-lb-cmt" placeholder="comment…" spellcheck="false" list="as-cmt-presets">`;
      const inp = area.querySelector('.as-lb-cmt'); inp.value = it.comment || '';
      inp.oninput = () => { const cur = byId(_lb); if (cur) { cur.comment = inp.value; _lbDirty = true; } };
      inp.onblur = () => { _lbEditCmt = false; paintCmtArea(ov, byId(_lb)); };
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
    if (_lbDirty) { _lbDirty = false; render(); }   // reflect comment edits in the grid
  }
  let _play = null;
  function updatePlayBtn() { const b = document.querySelector('.as-lb-play'); if (b) b.textContent = _play ? '⏸ Pause' : '▶ Play'; }
  function stopPlay() { if (_play) { clearInterval(_play); _play = null; updatePlayBtn(); } }
  function togglePlay() { if (_play) stopPlay(); else { _play = setInterval(() => lbNav(1), 3000); updatePlayBtn(); } }
  function lbNav(d, keepEdit) {
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
    toast(`“${(it.types && it.types[0]) || 'cover'}” marked for removal — undo in the grid`);
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
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (_lb) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); lbNav(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lbNav(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); zoomKey(1); }     // ↑ zoom in
      else if (e.key === 'ArrowDown') { e.preventDefault(); zoomKey(-1); }  // ↓ zoom out
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteLbCover(); }
      return;
    }
    if (!root.isConnected || !root.querySelector('.as-card')) return;
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (map[e.key]) { e.preventDefault(); moveCursor(map[e.key][0], map[e.key][1]); }
    else if (e.key === 'Enter' && _cursorId) { e.preventDefault(); openLightbox(_cursorId); }
    else if (e.key === ' ' && _cursorId) { e.preventDefault(); const it = byId(_cursorId); if (it && !it._del) { it._sel = !it._sel; render(); } }
  });

  function openBulkTypePop(btn) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const sel = MODEL.filter(it => it._sel && !it._del); if (!sel.length) return;
    const pop = document.createElement('div'); pop.className = 'as-pop';
    pop.innerHTML = `<div class="as-pop-h">Set type on ${sel.length} cover${sel.length===1?'':'s'}</div>`
      + `<div class="as-type-grid">${ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"> ${esc(t)}</label>`).join('')}</div>`
      + `<div class="as-pop-f"><button class="as-btn as-pop-apply">Apply (replace)</button><button class="as-btn as-pop-add">Add</button></div>`;
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    const picked = () => ALL_TYPES.filter(t => pop.querySelector(`input[value="${CSS.escape(t)}"]`).checked);
    pop.querySelector('.as-pop-apply').onclick = () => { const ts = picked(); sel.forEach(it => it.types = ts.slice()); pop.remove(); render(); };
    pop.querySelector('.as-pop-add').onclick = () => { const ts = picked(); sel.forEach(it => it.types = [...new Set([...it.types, ...ts])]); pop.remove(); render(); };
    const off = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  // #236: set one comment on every selected cover at once. Pre-fills the shared
  // comment if they already agree; Apply writes it, Clear blanks them all.
  function openBulkCommentPop(btn) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const sel = MODEL.filter(it => it._sel && !it._del); if (!sel.length) return;
    const common = sel.every(it => it.comment === sel[0].comment) ? sel[0].comment : '';
    const pop = document.createElement('div'); pop.className = 'as-pop as-cmt-pop';
    pop.innerHTML = `<div class="as-pop-h">Comment on ${sel.length} cover${sel.length===1?'':'s'}</div>`
      + `<input class="as-bulk-cmt" placeholder="comment…" spellcheck="false" list="as-cmt-presets" value="${esc(common)}">`
      + `<div class="as-pop-f"><button class="as-btn as-pop-apply">Apply</button><button class="as-btn as-bulk-cmt-clr">Clear</button></div>`;
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    const inp = pop.querySelector('.as-bulk-cmt'); inp.focus(); inp.select();
    const apply = v => { sel.forEach(it => it.comment = v); pop.remove(); render(); };
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
    return { title, url: `https://musicbrainz.org/release/${MBID}`, artists };
  }
  function buildReport(opts) {
    const info = releaseInfo();
    const sel = MODEL.filter(it => it._sel && !it._del && !it._new).slice().sort(sortFn);
    const sz = opts.size, W = sz === 'original' ? null : sz;
    const url = it => `https://coverartarchive.org/release/${MBID}/${it.id}${sz === 'original' ? '' : '-' + sz}.jpg`;
    const alt = it => (it.types[0] || 'cover').toLowerCase();
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
    const omitted = MODEL.filter(it => it._sel && it._new && !it._del).length;
    document.getElementById('as-report')?.remove();
    const ov = document.createElement('div'); ov.id = 'as-report';
    ov.innerHTML = `<div class="as-cm-box as-rp-box">
      <div class="as-cm-h">Report — ${sel.length} cover${sel.length===1?'':'s'}</div>
      <div class="as-rp-opts">
        <label>Format <select class="as-rp-fmt"><option value="markdown">Markdown</option><option value="html">HTML</option></select></label>
        <label>Image size <select class="as-rp-size"><option>250</option><option>500</option><option>1200</option><option value="original">original</option></select></label>
        <label>Layout <select class="as-rp-layout"><option value="inline">Inline images</option><option value="captioned">With types &amp; comments</option></select></label>
      </div>
      <textarea class="as-rp-out" rows="9" spellcheck="false" readonly></textarea>
      <div class="as-cm-f"><span class="as-rp-note">${omitted ? `${omitted} unsaved upload${omitted===1?'':'s'} omitted (no CAA URL yet)` : ''}</span><span class="as-sp"></span><button class="as-btn as-rp-copy">📋 Copy</button><button class="as-btn as-cm-cancel">Close</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelector('.as-cm-cancel').onclick = () => ov.remove();
    const ta = ov.querySelector('.as-rp-out');
    const regen = () => { ta.value = buildReport({ format: ov.querySelector('.as-rp-fmt').value, size: ov.querySelector('.as-rp-size').value, layout: ov.querySelector('.as-rp-layout').value }); };
    ov.querySelectorAll('select').forEach(s => s.onchange = regen);
    ov.querySelector('.as-rp-copy').onclick = async () => {
      ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
      const b = ov.querySelector('.as-rp-copy'); b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '📋 Copy'; }, 1200);
    };
    regen();
  }

  // ── styles ───────────────────────────────────────────────────────────────────
  const css = `
  :root{ --as-tile:${SETTINGS.tile}px; --as-acc:#5f3ec0; --as-warn:#c0392b; }
  #as-root{font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222;margin:0 0 18px}
  .as-bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:8px 11px;padding:8px 12px;background:#fff;border:1px solid #e2dcef;border-radius:9px;box-shadow:0 1px 5px rgba(60,40,110,.07);flex-wrap:wrap;margin-bottom:6px}
  .as-bar>*{flex:0 0 auto}
  /* "Original" (Apollo-style switch): hide the whole Art Station UI, MB's native page shows through */
  #as-root.as-orig{display:none}
  #as-switch{position:fixed;bottom:14px;right:14px;z-index:99998;background:var(--as-acc);color:#fff;border:none;border-radius:20px;font:bold 13px Arial;padding:9px 16px;cursor:pointer;box-shadow:0 3px 12px rgba(40,20,80,.3)}
  #as-switch:hover{background:#4e329f}
  .as-ctl{display:flex;align-items:center;gap:6px;font-size:13px;color:#555;white-space:nowrap}
  .as-size{accent-color:var(--as-acc);flex:0 1 130px;min-width:54px}
  #as-root select,.as-btn{font:13px inherit;border:1px solid #cfc6e6;background:#fff;border-radius:6px;padding:4px 9px;color:#333;cursor:pointer;white-space:nowrap}
  .as-btn{display:inline-flex;align-items:center;gap:5px}
  /* #234: compact toolbar — hide button labels (keep icons + tooltips) when it would otherwise wrap */
  .as-bar.as-compact .as-bt{display:none}
  .as-btn:hover{background:#f6f3fd}
  /* accent (white-on-purple) buttons must darken on hover, not lighten — else the white text vanishes */
  .as-commit:hover:not(:disabled),.as-pop-apply:hover:not(:disabled),.as-cm-go:hover:not(:disabled){background:#4e329f;color:#fff;border-color:#4e329f}
  .as-add{font-weight:600;color:var(--as-acc)}
  .as-mh{padding:4px 7px}
  .as-mh-ic{display:block;background:#80a32b;padding:3px;border-radius:5px}   /* green chip so the white MH icon shows */
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
  .as-dcap{font-size:11px;font-weight:600;color:#6b5fa0;margin-top:5px;white-space:nowrap}
  .as-did{font-size:11px;color:#a99fc4;font-variant-numeric:tabular-nums;word-break:break-all;line-height:1.3;margin-top:1px}
  .as-dmeta{flex:1 1 auto;min-width:0}
  .as-dlbl{font-weight:700;color:#6a5b95;font-size:12px;margin:0 0 4px}
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
  .as-pdfban{position:absolute;right:6px;top:6px;z-index:4;background:#7a3a8f;color:#fff;font:700 10px/1 Arial;letter-spacing:.5px;padding:3px 7px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.25);pointer-events:none}
  .as-newban{position:absolute;top:8px;right:-26px;transform:rotate(45deg);background:#1f9d6b;color:#fff;font:700 10px Arial;letter-spacing:1px;padding:2px 26px;z-index:5;box-shadow:0 1px 3px rgba(0,0,0,.3);pointer-events:none}
  .as-thumb{position:relative;display:block;width:100%;aspect-ratio:1;background:#f4f2f9;cursor:zoom-in;border-radius:9px 9px 0 0;overflow:hidden}
  .as-thumb img{width:100%;height:100%;object-fit:contain;display:block}
  .as-thumb.na{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#faf8ff,#efeafb)}
  .as-thumb.na img{display:none}
  .as-thumb.na::after{content:'Not on the Cover Art Archive yet';text-align:center;color:#9a8ccb;font-size:12px;font-weight:600;line-height:1.45;padding:0 16px}
  .as-dim{font-size:12px;font-weight:600;color:#6b5fa0;white-space:nowrap;flex:0 0 auto}
  .as-tbtn{position:absolute;top:6px;right:6px;border:none;border-radius:6px;background:rgba(255,255,255,.92);cursor:pointer;font-size:14px;line-height:1;padding:4px 7px;color:#555;box-shadow:0 1px 3px rgba(0,0,0,.2);opacity:0;transition:.1s}
  .as-card:hover .as-tbtn{opacity:1}
  .as-rm:hover{background:var(--as-warn);color:#fff}
  .as-undo{opacity:1;background:#fff;color:var(--as-acc);font-size:12px;font-weight:600}
  /* #234: footer (mockup) — row 1: comment (left) · dimensions+size (right); row 2: centered type pill on a divider */
  .as-foot{padding:5px 8px 0;display:flex;flex-direction:column;gap:6px;border-top:1px solid #efeaf8}
  .as-foot-row{display:flex;align-items:center;gap:6px;min-height:17px}
  .as-foot-cmt{flex:1 1 auto;min-width:0;display:flex;align-items:center;overflow:hidden}
  .as-cmt-text{font:11px inherit;color:#5a5470;line-height:1.3;cursor:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .as-cmt-text:hover{color:var(--as-acc)}
  .as-foot-type{display:flex;align-items:center;gap:7px;transform:translateY(50%);position:relative;z-index:1}
  .as-card.sel .as-foot-type{padding-right:20px}
  .as-tline{flex:1;height:1px;background:#e7e1f2}
  .as-type{font-size:11px;font-weight:700;color:#3b2c70;background:#f1ecff;border:1px solid #d8ccf5;border-radius:20px;padding:2px 13px;cursor:pointer;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .as-type:hover{background:#e7dffb}
  .as-type-add{color:#8a7fb8;background:#fff;border-style:dashed;font-weight:600;opacity:.5}
  .as-card:hover .as-type-add{opacity:1}
  .as-cmt{font:11px inherit;border:1px solid #e2dcef;border-radius:6px;padding:2px 6px;color:#444;background:#faf9fe;width:100%}
  .as-pencil{font:11px inherit;border:1px dashed #d8ccf5;background:#fff;color:#8a7fb8;border-radius:6px;padding:0 7px;cursor:pointer;opacity:0;transition:.1s}
  .as-card:hover .as-pencil{opacity:1}
  .as-pencil:hover{background:#f6f3fd;color:var(--as-acc)}
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
  .as-pop{position:absolute;z-index:200;background:#fff;border:1px solid #cbbdf0;border-radius:8px;box-shadow:0 6px 22px rgba(60,40,110,.22);padding:6px;min-width:150px;max-height:340px;overflow:auto;font-size:13px}
  .as-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  .as-pop label{display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:5px;cursor:pointer}
  .as-pop label:hover{background:#f3eefe}.as-pop input{accent-color:var(--as-acc)}
  .as-pop-h{font-weight:600;color:#6a5b95;padding:3px 6px 6px;border-bottom:1px solid #eee;margin-bottom:4px}
  .as-pop-f{display:flex;gap:6px;padding:6px 4px 2px;border-top:1px solid #eee;margin-top:4px;position:sticky;bottom:0;background:#fff}
  .as-pop-apply{background:var(--as-acc);color:#fff;border-color:var(--as-acc)}
  .as-cmt-pop{min-width:220px}
  .as-bulk-cmt{width:100%;box-sizing:border-box;font:13px inherit;border:1px solid #d8ccf5;border-radius:6px;padding:5px 8px;margin:2px 0 2px;background:#faf9fe;color:#333}
  /* lightbox */
  #as-lb{display:none;position:fixed;inset:0;z-index:9999;background:rgba(15,12,28,.92);align-items:center;justify-content:center;flex-direction:column;padding:30px}
  .as-lb-img{max-width:92vw;max-height:84vh;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.6);border-radius:4px;background:#fff}
  .as-lb-img.loading{visibility:hidden}
  #as-lb.na .as-lb-img{display:none}
  #as-lb.na::after{content:'Image not available, please try again later';color:#f0c4da;font-style:italic;font-size:16px}
  .as-lb-nav{position:fixed;top:50%;transform:translateY(-50%);font-size:42px;line-height:1;color:#fff;background:rgba(255,255,255,.12);border:none;border-radius:50%;width:54px;height:54px;cursor:pointer}
  .as-lb-nav:hover{background:rgba(255,255,255,.25)}
  .as-lb-prev{left:18px}.as-lb-next{right:18px}
  .as-lb-top{position:fixed;top:16px;right:20px;display:flex;gap:10px;align-items:center}
  .as-lb-x,.as-lb-play{font-size:15px;color:#fff;background:rgba(255,255,255,.12);border:none;border-radius:8px;height:42px;cursor:pointer;font-weight:600}
  .as-lb-x{width:42px;font-size:24px}.as-lb-play{padding:0 14px}
  .as-lb-x:hover,.as-lb-play:hover{background:rgba(255,255,255,.25)}
  .as-lb-bar{margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:8px;width:min(560px,84vw)}
  .as-lb-cap{color:#eee;font-size:13px;text-align:center}
  .as-lb-cmtarea{width:100%;display:flex;justify-content:center}
  .as-lb-cmt{width:100%;font:13px inherit;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:7px;padding:7px 11px;text-align:center}
  .as-lb-cmt-text{font:14px inherit;color:#fff;text-align:center;line-height:1.4;padding:4px 8px;cursor:text;max-width:100%;word-break:break-word}
  .as-lb-cmt-text:hover{color:#e7dffb}
  .as-lb-cmt::placeholder{color:rgba(255,255,255,.45)}
  .as-lb-cmt:focus{outline:none;border-color:rgba(255,255,255,.55);background:rgba(255,255,255,.14)}
  .as-lb-cmtadd{font:12px inherit;color:rgba(255,255,255,.6);background:transparent;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:4px 13px;cursor:pointer}
  .as-lb-cmtadd:hover{color:#fff;border-color:rgba(255,255,255,.5);background:rgba(255,255,255,.1)}
  /* commit panel */
  #as-commit,#as-report{position:fixed;inset:0;z-index:9998;background:rgba(15,12,28,.55);display:flex;align-items:center;justify-content:center;padding:24px}
  .as-rp-opts{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:10px}
  .as-rp-opts label{display:flex;align-items:center;gap:6px;font-size:13px;color:#555}
  .as-rp-out{font:12px/1.45 ui-monospace,Consolas,monospace;border:1px solid #cfc6e6;border-radius:7px;padding:9px 11px;resize:vertical;background:#faf9fe;color:#333;white-space:pre;overflow:auto}
  .as-rp-note{font-size:12px;color:#a05a00}
  .as-rp-copy{font-weight:600;color:var(--as-acc)}
  .as-cm-box{background:#fff;border-radius:12px;box-shadow:0 12px 50px rgba(0,0,0,.4);width:min(680px,94vw);max-height:88vh;display:flex;flex-direction:column;padding:18px 20px;font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222}
  .as-cm-h{font-size:16px;font-weight:700;color:#3b2c70;margin-bottom:12px}
  .as-cm-row{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:13px;color:#555}
  .as-cm-hint{font-size:11px;color:#9a8ccb;font-weight:400}
  .as-cm-note{font:13px inherit;border:1px solid #cfc6e6;border-radius:7px;padding:6px 9px;resize:vertical;width:100%;box-sizing:border-box;display:block;margin-bottom:12px}
  .as-cm-chk{display:flex;align-items:center;gap:6px;cursor:pointer;color:#555}
  .as-cm-opts{flex-direction:row;gap:18px;flex-wrap:wrap}
  .as-cm-opts label{display:flex;align-items:center;gap:6px;cursor:pointer;color:#444}
  .as-cm-dry{color:#a05a00;display:flex;align-items:center;gap:6px;cursor:pointer}
  .as-cm-list{overflow:auto;border:1px solid #eee;border-radius:8px;padding:6px;margin:4px 0 12px;background:#fafafa}
  .as-cm-op{padding:5px 6px;border-radius:6px;font-size:13px}
  .as-cm-op.dry{background:#f3eefe}.as-cm-op.err{background:#fdecea}
  .as-cm-st{display:inline-block;min-width:18px;white-space:nowrap;text-align:center}
  .as-cm-skip{font-size:11px;color:#999;margin-left:6px;background:#eee;border-radius:10px;padding:1px 7px}
  .as-cm-payload{white-space:pre-wrap;font:11px/1.4 ui-monospace,Consolas,monospace;color:#555;margin:4px 0 2px 18px;display:none}
  .as-cm-op.dry .as-cm-payload,.as-cm-op.err .as-cm-payload{display:block}
  .as-cm-f{display:flex;align-items:center;gap:8px}
  .as-cm-id{color:#a99fc4;font-size:12px;font-variant-numeric:tabular-nums}
  .as-cm-go{background:var(--as-acc);color:#fff;border-color:var(--as-acc);font-weight:600}
  .as-cm-go:disabled{opacity:.5}
  .as-cm-note2{font-size:11px;color:#9a8ccb;margin-top:8px;text-align:center}
  `;
  const st = document.createElement('style'); st.textContent = css; appendEl(st);

  // we run at document-start; wait for #content before mounting the gallery
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadArt, { once: true });
  else loadArt();
})();
