// ==UserScript==
// @name         Art Station
// @namespace    https://musicbrainz.org/
// @version      2026.6.16.260000
// @description  Cover-art editor for MusicBrainz — one gallery to view, group, sort, reorder, retype, comment, remove and download a release's cover art, staged and applied on Enter edit. PoC (discussion #230).
// @author       majkinetor
// @match        *://*.musicbrainz.org/release/*/cover-art
// @grant        none
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

  const CAA = `https://coverartarchive.org/release/${MBID}`;
  const imgUrl  = id => `${CAA}/${id}.jpg`;          // original
  const thumb   = (id, n) => `${CAA}/${id}-${n}.jpg`; // 250 / 500 / 1200

  // canonical MB cover-art types, in a sensible display order; "(none)" is virtual
  const TYPE_ORDER = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Matrix/Runout', 'Top', 'Bottom', 'Spine', 'Other'];
  const ALL_TYPES  = ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Raw/Unedited', 'Matrix/Runout', 'Top', 'Bottom', 'Panel', 'Other'];
  const NO_TYPE = '(no type)';

  let MODEL = [];       // [{ id, types:[], comment, order, w, h, _del, _new, _file }]
  let SETTINGS = load();
  function load() { try { return Object.assign({ tile: 200, group: true, sort: 'type' }, JSON.parse(localStorage.getItem('artstation:settings') || '{}')); } catch (e) { return { tile: 200, group: true, sort: 'type' }; } }
  function save() { try { localStorage.setItem('artstation:settings', JSON.stringify(SETTINGS)); } catch (e) {} }

  // ── data ───────────────────────────────────────────────────────────────────
  async function loadArt() {
    let images = [];
    try { const j = await fetch(CAA, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null); if (j) images = j.images || []; }
    catch (e) { /* none yet */ }
    MODEL = images.map((im, i) => ({
      id: im.id, types: (im.types || []).slice(), comment: im.comment || '',
      order: i, w: 0, h: 0, _del: false, _new: false, _img: im.image || imgUrl(im.id),
      _origTypes: (im.types || []).slice(), _origComment: im.comment || '', _origOrder: i,
    }));
    render();
    MODEL.forEach(measure);   // lazy-fill dimensions
  }
  function measure(it) {
    if (it._new || it.w) return;
    const img = new Image();
    img.onload = () => { it.w = img.naturalWidth; it.h = img.naturalHeight; const el = document.querySelector(`.as-card[data-id="${it.id}"] .as-dim`); if (el) el.textContent = it.w && it.h ? `${it.w} × ${it.h}` : ''; };
    img.src = imgUrl(it.id);
  }

  const changed = it => it._del || it._new || it.comment !== it._origComment || it.order !== it._origOrder || it.types.join('|') !== it._origTypes.join('|');
  const stagedCount = () => MODEL.filter(changed).length;
  const selectable = () => MODEL.filter(it => !it._del);
  const allSelected = () => { const s = selectable(); return s.length > 0 && s.every(it => it._sel); };
  // reorder (drag) only in the canonical Position view — ungrouped + sorted by position.
  // Grouping is view-only; other sorts don't map to the committed order.
  const canReorder = () => !SETTINGS.group && SETTINGS.sort === 'type';

  // ── render ───────────────────────────────────────────────────────────────────
  const root = document.createElement('div'); root.id = 'as-root';
  let _mounted = false;
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
    [...anchor.children].forEach(ch => {
      if (ch === root || ch === afterTabs || ch === afterH1) return;
      if (ch.tagName === 'H2' || ch.tagName === 'P') ch.style.display = 'none';
      else if (ch.querySelector && ch.querySelector('.artwork-cont')) ch.style.display = 'none';
      else if (ch.classList && ch.classList.contains('artwork-cont')) ch.style.display = 'none';
    });
    document.querySelectorAll('.artwork-cont').forEach(e => { e.style.display = 'none'; });
  }

  function render() {
    mount();
    const y = window.scrollY;            // keep the viewport put — rebuilding innerHTML must not jump the page
    const n = opsCount();
    const groups = grouped();
    root.innerHTML = bar(n) + bulkBar() + dropZone() + newSection() + groups.map(g => section(g.type, g.items)).join('') + deletedSection();
    wire();
    if (window.scrollY !== y) window.scrollTo(0, y);
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
  function sortFn(a, b) {
    if (SETTINGS.sort === 'dim') return (b.w * b.h) - (a.w * a.h) || a.order - b.order;
    if (SETTINGS.sort === 'newest') return b.id - a.id;   // CAA id desc ≈ upload recency (no real date in CAA)
    return a.order - b.order;   // position (committed order)
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function bar(n) {
    return `<div class="as-bar">
      <button class="as-btn as-add" title="Add cover art — file drop zone (goes first)">＋ Add image</button>
      <span class="as-ctl">Size <input class="as-size" type="range" min="120" max="340" value="${SETTINGS.tile}"></span>
      <span class="as-ctl">Sort <select class="as-sort">
        <option value="type"${SETTINGS.sort==='type'?' selected':''}>Position</option>
        <option value="dim"${SETTINGS.sort==='dim'?' selected':''}>Dimensions ▾</option>
        <option value="newest"${SETTINGS.sort==='newest'?' selected':''}>Newest</option></select></span>
      <label class="as-ctl"><input class="as-group" type="checkbox"${SETTINGS.group?' checked':''}> Group by type</label>
      <button class="as-btn as-selall" title="Select every cover (then Download / Set type / Delete)">${allSelected() ? '☑ Deselect all' : '☐ Select all'}</button>
      <span class="as-sp"></span>
      <button class="as-btn as-staged" title="Show pending operations"${n?'':' style="display:none"'}>${n} staged change${n===1?'':'s'} ▾</button>
      <button class="as-btn as-commit" title="Apply staged changes as MusicBrainz edits"${n?'':' disabled'}>✓ Enter edit</button>
    </div>`;
  }
  function bulkBar() {
    const sel = MODEL.filter(it => it._sel && !it._del);
    if (!sel.length) return '';
    return `<div class="as-bulk"><b>${sel.length} selected</b>
      <button class="as-btn as-bk-type">Set type ▾</button>
      <button class="as-btn as-bk-dl">⬇ Download</button>
      <button class="as-btn as-bk-rm">🗑 Delete</button>
      <span class="as-sp"></span>
      <button class="as-btn as-bk-clr">Clear selection</button>
      <span class="as-hint">right-click to select · drag a selected cover to move the group · click to enlarge</span></div>`;
  }
  function section(type, items) {
    const label = type === null ? 'All covers' : type;
    return `<div class="as-sec"><h3>${esc(label)}</h3><span class="as-cnt">${items.length}</span><span class="as-line"></span></div>
      <div class="as-grid" data-group="${esc(type||'')}">${items.map(card).join('')}</div>`;
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
    const dim = it._new ? 'local' : (it.w && it.h ? `${it.w} × ${it.h}` : '…');
    // #230: untyped shows ONLY the ＋ (set-type) chip — no "(no type)" label
    const chips = it.types.map(t => `<span class="as-chip" data-t="${esc(t)}">${esc(t)}</span>`).join('')
                + (it._del ? '' : `<span class="as-chip as-addtype" title="set type">＋</span>`);
    const src = it._new ? it._file : thumb(it.id, SETTINGS.tile > 260 ? 500 : 250);
    return `<div class="as-card${it._del?' del':''}${it._new?' new':''}${it._sel?' sel':''}" data-id="${esc(it.id)}" ${(!it._del && canReorder())?'draggable="true"':''}>
      ${it._new ? '<span class="as-newban">NEW</span>' : ''}
      <div class="as-types">${chips}</div>
      <div class="as-thumb"><img loading="lazy" src="${esc(src)}" alt=""><span class="as-dim">${esc(dim)}</span>
        <span class="as-selmark">✓</span>
        ${it._del ? '<button class="as-tbtn as-undo" title="keep this image">↺ keep</button>' : ''}
      </div>
      ${it._del ? '' : `<div class="as-meta">${(it.comment || it._editcmt)
          ? `<input class="as-cmt" value="${esc(it.comment)}" placeholder="comment…">`
          : `<button class="as-pencil" title="add a comment">✎</button>`}</div>`}
    </div>`;
  }

  // ── interaction ───────────────────────────────────────────────────────────────
  function byId(id) { return MODEL.find(it => String(it.id) === String(id)); }
  function cardId(el) { const c = el.closest('.as-card'); return c ? c.dataset.id : null; }

  function wirePencil(btn) {
    if (!btn) return;
    btn.onclick = e => {
      e.stopPropagation(); const it = byId(cardId(e.target)); if (!it) return;
      it._editcmt = true;
      // swap just THIS card's comment row in place — a full render() jumps the page
      const meta = btn.closest('.as-meta');
      meta.innerHTML = `<input class="as-cmt" value="${esc(it.comment)}" placeholder="comment…">`;
      const inp = meta.querySelector('.as-cmt');
      inp.oninput = () => { it.comment = inp.value; refreshStaged(); };
      inp.onblur = () => { if (!it.comment.trim()) { it._editcmt = false; meta.innerHTML = `<button class="as-pencil" title="add a comment">✎</button>`; wirePencil(meta.querySelector('.as-pencil')); } };
      inp.focus();
    };
  }

  function wire() {
    root.querySelector('.as-size').oninput = e => { SETTINGS.tile = +e.target.value; document.documentElement.style.setProperty('--as-tile', SETTINGS.tile + 'px'); };
    root.querySelector('.as-size').onchange = () => { save(); render(); };
    root.querySelector('.as-sort').onchange = e => { SETTINGS.sort = e.target.value; save(); render(); };
    root.querySelector('.as-group').onchange = e => { SETTINGS.group = e.target.checked; save(); render(); };
    root.querySelector('.as-selall').onclick = () => { const sel = !allSelected(); selectable().forEach(it => it._sel = sel); render(); };
    root.querySelector('.as-add').onclick = toggleDropZone;
    const staged = root.querySelector('.as-staged'); if (staged) staged.onclick = e => { e.stopPropagation(); openStagedPop(staged); };
    const commit = root.querySelector('.as-commit'); if (commit && !commit.disabled) commit.onclick = enterEdit;

    root.querySelectorAll('.as-undo').forEach(b => b.onclick = e => { e.stopPropagation(); const it = byId(cardId(e.target)); if (it) { it._del = false; render(); } });
    root.querySelectorAll('.as-cmt').forEach(inp => {
      inp.oninput = e => { const it = byId(cardId(e.target)); if (it) { it.comment = e.target.value; refreshStaged(); } };
      inp.onblur = e => { const it = byId(cardId(e.target)); if (it && !it.comment.trim()) { it._editcmt = false; render(); } };
    });
    root.querySelectorAll('.as-pencil').forEach(wirePencil);

    const dz = root.querySelector('.as-dropzone');
    if (dz) {
      dz.onclick = pickFiles;
      dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); addFiles(e.dataTransfer.files); };
    }

    // type chips → popover
    root.querySelectorAll('.as-chip').forEach(ch => ch.onclick = e => { e.stopPropagation(); openTypePop(ch); });
    // click image → lightbox; right-click card → toggle selection
    root.querySelectorAll('.as-thumb img').forEach(img => {
      img.onclick = e => { const it = byId(cardId(e.target)); if (it) openLightbox(it.id); };
      img.onerror = () => { const th = img.closest('.as-thumb'); if (th) th.classList.add('na'); };   // CAA not propagated yet
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
    wireBulk();
    wireDrag();
    markCursor();
  }
  function wireBulk() {
    const q = s => root.querySelector(s);
    q('.as-bk-clr') && (q('.as-bk-clr').onclick = () => { MODEL.forEach(it => it._sel = false); root.querySelectorAll('.as-card.sel').forEach(c => c.classList.remove('sel')); syncBulkBar(); });
    q('.as-bk-rm')  && (q('.as-bk-rm').onclick  = () => { MODEL.forEach(it => { if (it._sel) { it._del = true; it._sel = false; } }); render(); });
    q('.as-bk-dl')  && (q('.as-bk-dl').onclick  = () => MODEL.filter(it => it._sel && !it._new).forEach((it, i) => setTimeout(() => dlOne(it), i * 350)));
    q('.as-bk-type') && (q('.as-bk-type').onclick = e => { e.stopPropagation(); openBulkTypePop(q('.as-bk-type')); });
  }
  // right-button paint selection (held + move)
  let _paint = null;
  function paintCard(c) {
    if (!c || !_paint || c.classList.contains('del')) return;
    const it = byId(c.dataset.id); if (!it || it._sel === _paint.value) return;
    it._sel = _paint.value; c.classList.toggle('sel', it._sel); syncBulkBar();
  }
  document.addEventListener('mousemove', e => {
    if (!_paint || !e.buttons) return;   // e.buttons falls to 0 if the button was released off-window
    const c = e.target.closest && e.target.closest('.as-card');
    if (c && root.contains(c)) paintCard(c);
  });
  document.addEventListener('mouseup', () => { _paint = null; });
  // right-click is our selection gesture across the gallery — suppress the native menu there
  document.addEventListener('contextmenu', e => { if (root.contains(e.target)) e.preventDefault(); });

  // insert / refresh / remove the fixed bulk bar without touching the grid (no reflow → no jump)
  function syncBulkBar() {
    const html = bulkBar();
    let bb = root.querySelector('.as-bulk');
    if (!html) { if (bb) bb.remove(); return; }
    if (bb) bb.outerHTML = html; else root.insertAdjacentHTML('afterbegin', html);
    wireBulk();
  }
  function refreshStaged() {
    const n = opsCount(); const s = root.querySelector('.as-staged'); const c = root.querySelector('.as-commit');
    if (s) { s.textContent = `${n} staged change${n===1?'':'s'} ▾`; s.style.display = n ? '' : 'none'; }
    if (c) { c.disabled = !n; if (!c.disabled) c.onclick = enterEdit; }
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
  const opsCount = () => pendingOps().length;
  function openStagedPop(btn) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const ops = pendingOps(); if (!ops.length) return;
    const pop = document.createElement('div'); pop.className = 'as-pop as-staged-pop';
    pop.innerHTML = `<div class="as-pop-h">Pending operations (${ops.length})</div>`
      + ops.map(o => `<div class="as-op">${esc(o)}</div>`).join('');
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
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
    pop.innerHTML = ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"${it.types.includes(t)?' checked':''}> ${esc(t)}</label>`).join('');
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
  let _dropZone = false;
  function toggleDropZone() { _dropZone = !_dropZone; render(); if (_dropZone) root.querySelector('.as-dropzone')?.scrollIntoView({ block: 'nearest' }); }
  function newItem(f) {
    return { id: 'new-' + Math.random().toString(36).slice(2, 8), types: [], comment: '', order: 0, w: 0, h: 0,
      _del: false, _new: true, _file: URL.createObjectURL(f), _fileObj: f, _origTypes: [], _origComment: '', _origOrder: -1 };
  }
  function addFiles(files) {
    const news = [...files].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf').map(newItem);
    if (!news.length) return;
    // new covers go FIRST (majkinetor: they were landing last), then existing in order
    const rest = MODEL.slice().sort((a, b) => a.order - b.order);
    MODEL = [...news, ...rest];
    MODEL.forEach((it, i) => it.order = i);
    _dropZone = false; render();
  }
  function pickFiles() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.pdf'; inp.multiple = true;
    inp.onchange = () => addFiles(inp.files);
    inp.click();
  }
  // ── Phase 2a: apply staged changes as real MB edits (form-replay) ─────────────
  const R = `/release/${MBID}`;
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
    p.append('edit-cover-art.edit_note', meta.note);
    if (meta.votable) p.append('edit-cover-art.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  async function buildRemove(it, meta) {
    const form = await getPostForm(`${R}/remove-cover-art/${it.id}`);
    const p = new URLSearchParams(); copyHidden(form, p);
    p.append('confirm.edit_note', meta.note);
    if (meta.votable) p.append('confirm.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  async function buildReorder(meta) {     // single edit: full ordered artwork list
    const form = await getPostForm(`${R}/reorder-cover-art`);
    const p = new URLSearchParams(); copyHidden(form, p, /\.artwork\./);
    const seq = MODEL.filter(it => !it._del && !it._new).sort((a, b) => a.order - b.order);
    seq.forEach((it, i) => { p.append(`reorder-cover-art.artwork.${i}.id`, it.id); p.append(`reorder-cover-art.artwork.${i}.position`, String(i + 1)); });
    p.append('reorder-cover-art.edit_note', meta.note);
    if (meta.votable) p.append('reorder-cover-art.make_votable', '1');
    return { method: 'POST', url: form._action, body: p };
  }
  // ordered work list (uploads are Phase 2b): remove → retype/comment → reorder
  function buildPlan() {
    const plan = [];
    MODEL.filter(it => it._new && !it._del).forEach(it => plan.push({ label: `Add ${it.types[0] || 'new image'} (upload)`, kind: 'add', skip: 'Phase 2b', it }));
    MODEL.filter(it => it._del && !it._new).forEach(it => plan.push({ label: `Remove ${it.types[0] || 'cover'} #${it.id}`, kind: 'remove', build: m => buildRemove(it, m) }));
    MODEL.filter(it => !it._del && !it._new && (it.comment !== it._origComment || it.types.join('|') !== it._origTypes.join('|')))
      .forEach(it => plan.push({ label: `Edit ${it._origTypes[0] || 'cover'} #${it.id} → ${it.types.join(', ') || '(none)'}`, kind: 'edit', build: m => buildEdit(it, m) }));
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
      <label class="as-cm-row">Edit note<textarea class="as-cm-note" rows="2" placeholder="optional note shown on each edit"></textarea></label>
      <div class="as-cm-row as-cm-opts">
        <label><input type="checkbox" class="as-cm-vote"> Make all votable</label>
        <label class="as-cm-dry"><input type="checkbox" class="as-cm-dryrun" checked> Dry run — show the requests, don't submit</label>
      </div>
      <div class="as-cm-list">${plan.map((o, i) => `<div class="as-cm-op" data-i="${i}"><span class="as-cm-st">○</span> <span class="as-cm-lb">${esc(o.label)}</span>${o.skip ? `<span class="as-cm-skip">${esc(o.skip)}</span>` : ''}<div class="as-cm-payload"></div></div>`).join('')}</div>
      <div class="as-cm-f"><button class="as-btn as-cm-cancel">Cancel</button><button class="as-btn as-cm-go">Run</button></div>
      <div class="as-cm-note2">New-image uploads (archive.org) are Phase 2b — listed but skipped here.</div>
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
  async function runPlan(ov, plan, meta) {
    ov.querySelector('.as-cm-go').disabled = true;
    ov.querySelector('.as-cm-cancel').disabled = true;
    for (let i = 0; i < plan.length; i++) {
      const op = plan[i], row = ov.querySelector(`.as-cm-op[data-i="${i}"]`);
      const st = row.querySelector('.as-cm-st'), pay = row.querySelector('.as-cm-payload');
      if (op.skip) { st.textContent = '⏭'; continue; }
      st.textContent = '⏳';
      try {
        const req = await op.build(meta);
        if (meta.dry) {
          st.textContent = '👁'; row.classList.add('dry');
          pay.textContent = `${req.method} ${req.url}\n${decodeURIComponent(req.body.toString()).replace(/&/g, '\n  ')}`;
        } else {
          const r = await fetch(req.url, { method: 'POST', body: req.body, credentials: 'same-origin' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          st.textContent = '✅';
        }
      } catch (e) { st.textContent = '❌'; pay.textContent = String(e && e.message || e); row.classList.add('err'); }
      await new Promise(r => setTimeout(r, meta.dry ? 0 : 600));   // be gentle on MB when live
    }
    ov.querySelector('.as-cm-cancel').disabled = false;
    ov.querySelector('.as-cm-cancel').textContent = 'Close';
    if (!meta.dry) { const b = ov.querySelector('.as-cm-go'); b.textContent = 'Done — reload'; b.disabled = false; b.onclick = () => location.reload(); }
    else ov.querySelector('.as-cm-go').disabled = false;
  }

  // ── lightbox (#230: click image → popup, ←→↑↓ navigate) ───────────────────────
  let _lb = null;          // current lightbox image id
  const visible = () => grouped().flatMap(g => g.items);   // flat, in displayed order
  function openLightbox(id) {
    _lb = id; _cursorId = id;
    let ov = document.getElementById('as-lb');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'as-lb';
      ov.innerHTML = `<button class="as-lb-x" title="close (Esc)">✕</button>
        <button class="as-lb-nav as-lb-prev" title="previous (←)">‹</button>
        <img class="as-lb-img" alt="">
        <button class="as-lb-nav as-lb-next" title="next (→)">›</button>
        <div class="as-lb-cap"></div>`;
      document.body.appendChild(ov);
      ov.querySelector('.as-lb-x').onclick = closeLightbox;
      ov.querySelector('.as-lb-prev').onclick = e => { e.stopPropagation(); lbNav(-1); };
      ov.querySelector('.as-lb-next').onclick = e => { e.stopPropagation(); lbNav(1); };
      ov.onclick = e => { if (e.target === ov) closeLightbox(); };
    }
    paintLightbox();
    ov.style.display = 'flex';
  }
  function paintLightbox() {
    const ov = document.getElementById('as-lb'); if (!ov) return;
    const it = byId(_lb); if (!it) return;
    const img = ov.querySelector('.as-lb-img');
    const src = it._new ? it._file : thumb(it.id, 1200);
    ov.classList.remove('na');
    // hide until the NEW src has decoded — otherwise the previous image lingers
    // visibly while the 1200px loads ("original shows shortly")
    img.classList.add('loading');
    img.onload = () => { img.classList.remove('loading'); ov.classList.remove('na'); };
    img.onerror = () => { img.classList.remove('loading'); ov.classList.add('na'); };   // CAA not propagated yet
    img.src = src;
    if (img.complete && img.naturalWidth) img.classList.remove('loading');
    const bits = [it.types.length ? it.types.join(', ') : 'no type', it.w && it.h ? `${it.w} × ${it.h}` : null, it.comment].filter(Boolean);
    ov.querySelector('.as-lb-cap').textContent = bits.join('  ·  ');
  }
  function closeLightbox() { _lb = null; const ov = document.getElementById('as-lb'); if (ov) ov.style.display = 'none'; }
  function lbNav(d) {
    const seq = visible(); if (!seq.length) return;
    let i = seq.findIndex(it => String(it.id) === String(_lb));
    i = (i + d + seq.length) % seq.length;
    _lb = seq[i].id; _cursorId = _lb; paintLightbox(); markCursor(true);
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
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); lbNav(-1); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); lbNav(1); }
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
      + ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"> ${esc(t)}</label>`).join('')
      + `<div class="as-pop-f"><button class="as-btn as-pop-apply">Apply (replace)</button><button class="as-btn as-pop-add">Add</button></div>`;
    document.body.appendChild(pop);
    placePop(pop, btn.getBoundingClientRect());
    const picked = () => ALL_TYPES.filter(t => pop.querySelector(`input[value="${CSS.escape(t)}"]`).checked);
    pop.querySelector('.as-pop-apply').onclick = () => { const ts = picked(); sel.forEach(it => it.types = ts.slice()); pop.remove(); render(); };
    pop.querySelector('.as-pop-add').onclick = () => { const ts = picked(); sel.forEach(it => it.types = [...new Set([...it.types, ...ts])]); pop.remove(); render(); };
    const off = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  // ── styles ───────────────────────────────────────────────────────────────────
  const css = `
  :root{ --as-tile:${SETTINGS.tile}px; --as-acc:#5f3ec0; --as-warn:#c0392b; }
  #as-root{font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222;margin:0 0 18px}
  .as-bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:13px;padding:8px 12px;background:#fff;border:1px solid #e2dcef;border-radius:9px;box-shadow:0 1px 5px rgba(60,40,110,.07);flex-wrap:wrap;margin-bottom:6px}
  .as-ctl{display:flex;align-items:center;gap:6px;font-size:13px;color:#555;white-space:nowrap}
  .as-size{accent-color:var(--as-acc)}
  #as-root select,.as-btn{font:13px inherit;border:1px solid #cfc6e6;background:#fff;border-radius:6px;padding:4px 9px;color:#333;cursor:pointer}
  .as-btn:hover{background:#f6f3fd}
  .as-add{font-weight:600;color:var(--as-acc)}
  .as-dl{border-color:#bcd;color:#2a6}
  .as-sp{flex:1 1 auto}
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
  .as-grid{display:flex;flex-wrap:wrap;gap:14px}
  .as-card{width:var(--as-tile);background:#fff;border:1px solid #e2dcef;border-radius:9px;overflow:hidden;position:relative;transition:.1s}
  .as-card[draggable=true]{cursor:grab}
  .as-card:hover{box-shadow:0 3px 12px rgba(60,40,110,.15);border-color:#cbbdf0}
  .as-card.as-dragging{opacity:.4}
  .as-card.as-drop{outline:2px dashed var(--as-acc);outline-offset:-2px}
  .as-card.del .as-thumb img{filter:grayscale(1) brightness(.82)}
  .as-card.del{opacity:.7}
  .as-sec-new h3{color:#1f9d6b}
  .as-card.new{background:repeating-linear-gradient(45deg,#eef7f1,#eef7f1 11px,#e2f0e8 11px,#e2f0e8 22px);border-color:#9bd3b6;border-style:dashed}
  .as-newban{position:absolute;top:8px;right:-26px;transform:rotate(45deg);background:#1f9d6b;color:#fff;font:700 10px Arial;letter-spacing:1px;padding:2px 26px;z-index:5;box-shadow:0 1px 3px rgba(0,0,0,.3);pointer-events:none}
  .as-thumb{position:relative;display:block;width:100%;aspect-ratio:1;background:#f0eef6}
  .as-thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .as-thumb.na{display:flex;align-items:center;justify-content:center;background:#ededed}
  .as-thumb.na img{visibility:hidden}
  .as-thumb.na::after{content:'Image not available,\\A please try again later';white-space:pre-line;text-align:center;color:#a0306a;font-style:italic;font-size:12px;line-height:1.35;padding:10px}
  .as-dim{position:absolute;left:6px;bottom:6px;background:rgba(20,16,40,.78);color:#fff;font-size:11px;font-weight:600;padding:1px 6px;border-radius:5px}
  .as-tbtn{position:absolute;top:6px;right:6px;border:none;border-radius:6px;background:rgba(255,255,255,.92);cursor:pointer;font-size:14px;line-height:1;padding:4px 7px;color:#555;box-shadow:0 1px 3px rgba(0,0,0,.2);opacity:0;transition:.1s}
  .as-card:hover .as-tbtn{opacity:1}
  .as-rm:hover{background:var(--as-warn);color:#fff}
  .as-undo{opacity:1;background:#fff;color:var(--as-acc);font-size:12px;font-weight:600}
  .as-meta{padding:4px 8px 8px;display:flex;flex-direction:column;gap:6px;min-height:8px}
  .as-types{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 8px 5px}
  .as-chip{font-size:11px;font-weight:600;color:#3b2c70;background:#efeaff;border:1px solid #d8ccf5;border-radius:20px;padding:1px 9px;cursor:pointer}
  .as-chip.none{color:#9a8ccb;background:#f6f4fc;border-style:dashed}
  .as-chip.as-addtype{color:#8a7fb8;background:#fff;border-style:dashed}
  .as-cmt{font:12px inherit;border:1px solid #e2dcef;border-radius:6px;padding:3px 7px;color:#444;background:#faf9fe;width:100%}
  .as-pencil{font:12px inherit;border:1px dashed #d8ccf5;background:#fff;color:#8a7fb8;border-radius:6px;padding:1px 8px;cursor:pointer;align-self:flex-start;opacity:0;transition:.1s}
  .as-card:hover .as-pencil{opacity:1}
  .as-pencil:hover{background:#f6f3fd;color:var(--as-acc)}
  /* selection + keyboard cursor */
  .as-card.sel{outline:3px solid var(--as-acc);outline-offset:-1px;box-shadow:0 3px 14px rgba(95,62,192,.3)}
  .as-selmark{position:absolute;right:6px;bottom:6px;width:22px;height:22px;line-height:22px;text-align:center;background:var(--as-acc);color:#fff;border-radius:50%;font-size:13px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.4);z-index:4;display:none}
  .as-card.sel .as-selmark{display:block}
  .as-card.as-cursor{box-shadow:0 0 0 2px #2a6,0 3px 14px rgba(40,160,100,.28)}
  /* bulk bar */
  .as-bulk{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:120;display:flex;align-items:center;gap:11px;padding:9px 15px;background:#fff;border:1px solid #cbbdf0;border-radius:11px;box-shadow:0 8px 28px rgba(60,40,110,.28);flex-wrap:wrap;max-width:94vw}
  .as-bulk b{color:var(--as-acc)}
  .as-bk-rm{border-color:#e6b8b2;color:var(--as-warn)}
  .as-hint{font-size:11px;color:#8a7fb8;width:100%;text-align:center;margin-top:2px}
  .as-pop{position:absolute;z-index:200;background:#fff;border:1px solid #cbbdf0;border-radius:8px;box-shadow:0 6px 22px rgba(60,40,110,.22);padding:6px;min-width:150px;max-height:340px;overflow:auto;font-size:13px}
  .as-pop label{display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:5px;cursor:pointer}
  .as-pop label:hover{background:#f3eefe}.as-pop input{accent-color:var(--as-acc)}
  .as-pop-h{font-weight:600;color:#6a5b95;padding:3px 6px 6px;border-bottom:1px solid #eee;margin-bottom:4px}
  .as-pop-f{display:flex;gap:6px;padding:6px 4px 2px;border-top:1px solid #eee;margin-top:4px;position:sticky;bottom:0;background:#fff}
  .as-pop-apply{background:var(--as-acc);color:#fff;border-color:var(--as-acc)}
  /* lightbox */
  #as-lb{display:none;position:fixed;inset:0;z-index:9999;background:rgba(15,12,28,.92);align-items:center;justify-content:center;flex-direction:column;padding:30px}
  .as-lb-img{max-width:92vw;max-height:84vh;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.6);border-radius:4px;background:#fff}
  .as-lb-img.loading{visibility:hidden}
  #as-lb.na .as-lb-img{display:none}
  #as-lb.na::after{content:'Image not available, please try again later';color:#f0c4da;font-style:italic;font-size:16px}
  .as-lb-nav{position:fixed;top:50%;transform:translateY(-50%);font-size:42px;line-height:1;color:#fff;background:rgba(255,255,255,.12);border:none;border-radius:50%;width:54px;height:54px;cursor:pointer}
  .as-lb-nav:hover{background:rgba(255,255,255,.25)}
  .as-lb-prev{left:18px}.as-lb-next{right:18px}
  .as-lb-x{position:fixed;top:16px;right:20px;font-size:24px;color:#fff;background:rgba(255,255,255,.12);border:none;border-radius:8px;width:42px;height:42px;cursor:pointer}
  .as-lb-x:hover{background:rgba(255,255,255,.25)}
  .as-lb-cap{margin-top:14px;color:#eee;font-size:13px;text-align:center;max-width:80vw}
  /* commit panel */
  #as-commit{position:fixed;inset:0;z-index:9998;background:rgba(15,12,28,.55);display:flex;align-items:center;justify-content:center;padding:24px}
  .as-cm-box{background:#fff;border-radius:12px;box-shadow:0 12px 50px rgba(0,0,0,.4);width:min(680px,94vw);max-height:88vh;display:flex;flex-direction:column;padding:18px 20px;font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222}
  .as-cm-h{font-size:16px;font-weight:700;color:#3b2c70;margin-bottom:12px}
  .as-cm-row{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:13px;color:#555}
  .as-cm-note{font:13px inherit;border:1px solid #cfc6e6;border-radius:7px;padding:6px 9px;resize:vertical}
  .as-cm-opts{flex-direction:row;gap:18px;flex-wrap:wrap}
  .as-cm-opts label{display:flex;align-items:center;gap:6px;cursor:pointer;color:#444}
  .as-cm-dry{color:#a05a00}
  .as-cm-list{overflow:auto;border:1px solid #eee;border-radius:8px;padding:6px;margin:4px 0 12px;background:#fafafa}
  .as-cm-op{padding:5px 6px;border-radius:6px;font-size:13px}
  .as-cm-op.dry{background:#f3eefe}.as-cm-op.err{background:#fdecea}
  .as-cm-st{display:inline-block;width:18px}
  .as-cm-skip{font-size:11px;color:#999;margin-left:6px;background:#eee;border-radius:10px;padding:1px 7px}
  .as-cm-payload{white-space:pre-wrap;font:11px/1.4 ui-monospace,Consolas,monospace;color:#555;margin:4px 0 2px 18px;display:none}
  .as-cm-op.dry .as-cm-payload,.as-cm-op.err .as-cm-payload{display:block}
  .as-cm-f{display:flex;justify-content:flex-end;gap:8px}
  .as-cm-go{background:var(--as-acc);color:#fff;border-color:var(--as-acc);font-weight:600}
  .as-cm-go:disabled{opacity:.5}
  .as-cm-note2{font-size:11px;color:#9a8ccb;margin-top:8px;text-align:center}
  `;
  const st = document.createElement('style'); st.textContent = css; appendEl(st);

  // we run at document-start; wait for #content before mounting the gallery
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadArt, { once: true });
  else loadArt();
})();
