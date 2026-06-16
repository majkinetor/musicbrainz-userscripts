// ==UserScript==
// @name         Art Station
// @namespace    https://musicbrainz.org/
// @version      2026.6.16.190000
// @description  Cover-art editor for MusicBrainz — one gallery to view, group, sort, reorder, retype, comment, remove and download a release's cover art, staged and applied on Enter edit. PoC (discussion #230).
// @author       majkinetor
// @match        *://*.musicbrainz.org/release/*/cover-art
// @grant        none
// @run-at       document-idle
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
      order: i, w: 0, h: 0, _del: false, _new: false,
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

  // ── render ───────────────────────────────────────────────────────────────────
  const root = document.createElement('div'); root.id = 'as-root';
  let _mounted = false;
  function mount() {
    if (_mounted) return; _mounted = true;
    const anchor = document.querySelector('#content') || document.body;
    anchor.insertBefore(root, anchor.firstChild);
    // hide the native cover-art list (the type <h2>s and the .artwork-cont blocks),
    // leaving the rest of the page (title, sidebar) intact
    [...anchor.children].forEach(ch => {
      if (ch === root) return;
      if (ch.querySelector && ch.querySelector('.artwork-cont')) ch.style.display = 'none';
      else if (ch.tagName === 'H2') ch.style.display = 'none';
      else if (ch.classList && ch.classList.contains('artwork-cont')) ch.style.display = 'none';
    });
    document.querySelectorAll('.artwork-cont').forEach(e => { e.style.display = 'none'; });
  }

  function render() {
    mount();
    const n = stagedCount();
    const groups = grouped();
    root.innerHTML = bar(n) + groups.map(g => section(g.type, g.items)).join('') + deletedSection();
    wire();
  }

  function grouped() {
    let items = MODEL.filter(it => !it._del);
    if (!SETTINGS.group) {
      items = items.slice().sort((a, b) => a.order - b.order);
      return [{ type: null, items }];
    }
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
    if (SETTINGS.sort === 'newest') return b.id - a.id;
    return a.order - b.order;   // position
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function bar(n) {
    return `<div class="as-bar">
      <button class="as-btn as-add" title="Add cover art (file or URL)">＋ Add image</button>
      <span class="as-ctl">Size <input class="as-size" type="range" min="120" max="340" value="${SETTINGS.tile}"></span>
      <span class="as-ctl">Sort <select class="as-sort">
        <option value="type"${SETTINGS.sort==='type'?' selected':''}>Position</option>
        <option value="dim"${SETTINGS.sort==='dim'?' selected':''}>Dimensions ▾</option>
        <option value="newest"${SETTINGS.sort==='newest'?' selected':''}>Newest</option></select></span>
      <label class="as-ctl"><input class="as-group" type="checkbox"${SETTINGS.group?' checked':''}> Group by type</label>
      <button class="as-btn as-dl" title="Download every cover (originals) to your computer">⬇ Download all</button>
      <span class="as-sp"></span>
      <span class="as-staged"${n?'':' style="display:none"'}>${n} staged change${n===1?'':'s'}</span>
      <button class="as-btn as-commit" title="Apply staged changes as MusicBrainz edits"${n?'':' disabled'}>✓ Enter edit</button>
    </div>`;
  }
  function section(type, items) {
    const label = type === null ? 'All covers' : type;
    return `<div class="as-sec"><h3>${esc(label)}</h3><span class="as-cnt">${items.length}</span><span class="as-line"></span></div>
      <div class="as-grid" data-group="${esc(type||'')}">${items.map(card).join('')}</div>`;
  }
  function deletedSection() {
    const dels = MODEL.filter(it => it._del);
    if (!dels.length) return '';
    return `<div class="as-sec as-sec-del"><h3>Marked for removal</h3><span class="as-cnt">${dels.length}</span><span class="as-line"></span></div>
      <div class="as-grid">${dels.map(card).join('')}</div>`;
  }
  function card(it) {
    const dim = it._new ? 'local' : (it.w && it.h ? `${it.w} × ${it.h}` : '…');
    const types = it.types.length ? it.types : (it._del ? [] : [NO_TYPE]);
    const chips = types.map(t => `<span class="as-chip${t===NO_TYPE?' none':''}" data-t="${esc(t)}">${esc(t)}<span class="as-cx">▾</span></span>`).join('')
                + (it._del ? '' : `<span class="as-chip as-addtype" title="add a type">＋</span>`);
    const src = it._new ? it._file : thumb(it.id, SETTINGS.tile > 260 ? 500 : 250);
    return `<div class="as-card${it._del?' del':''}${it._new?' new':''}" data-id="${esc(it.id)}" ${it._del?'':'draggable="true"'}>
      ${it._new ? '<span class="as-newban">NEW</span>' : ''}
      <div class="as-types">${chips}</div>
      <div class="as-thumb"><img loading="lazy" src="${esc(src)}" alt=""><span class="as-dim">${esc(dim)}</span>
        ${it._del
          ? '<button class="as-tbtn as-undo" title="keep this image">↺ keep</button>'
          : '<button class="as-tbtn as-rm" title="remove this cover art">✕</button>'}
      </div>
      ${it._del ? '' : `<div class="as-meta">${it.comment
          ? `<input class="as-cmt" value="${esc(it.comment)}" placeholder="comment…">`
          : `<button class="as-cmtadd" title="add a comment">+ comment</button>`}</div>`}
    </div>`;
  }

  // ── interaction ───────────────────────────────────────────────────────────────
  function byId(id) { return MODEL.find(it => String(it.id) === String(id)); }
  function cardId(el) { const c = el.closest('.as-card'); return c ? c.dataset.id : null; }

  function wire() {
    root.querySelector('.as-size').oninput = e => { SETTINGS.tile = +e.target.value; document.documentElement.style.setProperty('--as-tile', SETTINGS.tile + 'px'); };
    root.querySelector('.as-size').onchange = () => { save(); render(); };
    root.querySelector('.as-sort').onchange = e => { SETTINGS.sort = e.target.value; save(); render(); };
    root.querySelector('.as-group').onchange = e => { SETTINGS.group = e.target.checked; save(); render(); };
    root.querySelector('.as-dl').onclick = downloadAll;
    root.querySelector('.as-add').onclick = addImage;
    const commit = root.querySelector('.as-commit'); if (commit && !commit.disabled) commit.onclick = enterEdit;

    root.querySelectorAll('.as-rm').forEach(b => b.onclick = e => { const it = byId(cardId(e.target)); if (it) { it._del = true; render(); } });
    root.querySelectorAll('.as-undo').forEach(b => b.onclick = e => { const it = byId(cardId(e.target)); if (it) { it._del = false; render(); } });
    root.querySelectorAll('.as-cmt').forEach(inp => inp.oninput = e => { const it = byId(cardId(e.target)); if (it) { it.comment = e.target.value; refreshStaged(); } });
    root.querySelectorAll('.as-cmtadd').forEach(b => b.onclick = e => { const it = byId(cardId(e.target)); if (it) { it.comment = ' '; render(); const i = document.querySelector(`.as-card[data-id="${it.id}"] .as-cmt`); if (i) { i.value = ''; i.focus(); } } });

    // type chips → popover
    root.querySelectorAll('.as-chip').forEach(ch => ch.onclick = e => { e.stopPropagation(); openTypePop(ch); });
    // drag reorder
    wireDrag();
  }
  function refreshStaged() {
    const n = stagedCount(); const s = root.querySelector('.as-staged'); const c = root.querySelector('.as-commit');
    if (s) { s.textContent = `${n} staged change${n===1?'':'s'}`; s.style.display = n ? '' : 'none'; }
    if (c) { c.disabled = !n; if (!c.disabled) c.onclick = enterEdit; }
  }

  function openTypePop(chip) {
    document.querySelectorAll('.as-pop').forEach(p => p.remove());
    const it = byId(cardId(chip)); if (!it) return;
    const pop = document.createElement('div'); pop.className = 'as-pop';
    pop.innerHTML = ALL_TYPES.map(t => `<label><input type="checkbox" value="${esc(t)}"${it.types.includes(t)?' checked':''}> ${esc(t)}</label>`).join('');
    document.body.appendChild(pop);
    const r = chip.getBoundingClientRect(); pop.style.left = (r.left + scrollX) + 'px'; pop.style.top = (r.bottom + scrollY + 3) + 'px';
    pop.querySelectorAll('input').forEach(cb => cb.onchange = () => {
      it.types = ALL_TYPES.filter(t => pop.querySelector(`input[value="${CSS.escape(t)}"]`).checked);
      render();
    });
    const off = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
  }

  let _drag = null;
  function wireDrag() {
    root.querySelectorAll('.as-card[draggable="true"]').forEach(card => {
      card.ondragstart = e => { _drag = byId(card.dataset.id); card.classList.add('as-dragging'); e.dataTransfer.effectAllowed = 'move'; };
      card.ondragend = () => { card.classList.remove('as-dragging'); _drag = null; root.querySelectorAll('.as-drop').forEach(c => c.classList.remove('as-drop')); };
      card.ondragover = e => {
        if (!_drag || _drag === byId(card.dataset.id)) return;
        // reorder only WITHIN the same group when grouping is on (#230 remark 1)
        if (SETTINGS.group && _drag.types[0] !== byId(card.dataset.id).types[0] && (_drag.types[0] || NO_TYPE) !== (byId(card.dataset.id).types[0] || NO_TYPE)) return;
        e.preventDefault(); root.querySelectorAll('.as-drop').forEach(c => c.classList.remove('as-drop')); card.classList.add('as-drop');
      };
      card.ondrop = e => {
        e.preventDefault(); const tgt = byId(card.dataset.id); if (!_drag || !tgt || _drag === tgt) return;
        reorder(_drag, tgt); render();
      };
    });
  }
  function reorder(src, tgt) {
    // splice src to just before tgt in the global order, then renumber
    const seq = MODEL.filter(it => !it._del).slice().sort((a, b) => a.order - b.order);
    const from = seq.indexOf(src); seq.splice(from, 1);
    const to = seq.indexOf(tgt); seq.splice(to, 0, src);
    seq.forEach((it, i) => it.order = i);
  }

  // ── actions ───────────────────────────────────────────────────────────────────
  function downloadAll() {
    MODEL.filter(it => !it._del && !it._new).forEach((it, i) => {
      setTimeout(() => { const a = document.createElement('a'); a.href = imgUrl(it.id); a.download = `${MBID}-${it.id}.jpg`; document.body.appendChild(a); a.click(); a.remove(); }, i * 350);
    });
  }
  function addImage() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.pdf'; inp.multiple = true;
    inp.onchange = () => {
      [...inp.files].forEach(f => { const url = URL.createObjectURL(f); MODEL.push({ id: 'new-' + Math.random().toString(36).slice(2, 8), types: [], comment: '', order: MODEL.length, w: 0, h: 0, _del: false, _new: true, _file: url, _fileObj: f, _origTypes: [], _origComment: '', _origOrder: -1 }); });
      render();
    };
    inp.click();
  }
  function enterEdit() {
    // PoC: summarise what WOULD be submitted. Real form-replay submission (remove /
    // edit-cover-art / reorder, and uploads for NEW) lands in the next iteration.
    const dels = MODEL.filter(it => it._del && !it._new);
    const edits = MODEL.filter(it => !it._del && !it._new && (it.comment !== it._origComment || it.types.join('|') !== it._origTypes.join('|')));
    const moved = MODEL.some(it => !it._del && it.order !== it._origOrder);
    const adds = MODEL.filter(it => it._new && !it._del);
    alert(`Enter edit (PoC summary):\n` +
      `• remove: ${dels.length}\n` +
      `• retype/comment: ${edits.length}\n` +
      `• reorder: ${moved ? 'yes' : 'no'}\n` +
      `• add (upload): ${adds.length}\n\n` +
      `Submission wiring is the next step.`);
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
  .as-staged{font-size:12px;color:#a05a00;background:#fff3d6;border:1px solid #ecd9a0;border-radius:9px;padding:2px 9px;white-space:nowrap}
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
  .as-newban{position:absolute;top:8px;left:-26px;transform:rotate(-45deg);background:var(--as-acc);color:#fff;font:700 10px Arial;letter-spacing:1px;padding:2px 26px;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .as-thumb{position:relative;display:block;width:100%;aspect-ratio:1;background:#f0eef6}
  .as-thumb img{width:100%;height:100%;object-fit:cover;display:block}
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
  .as-cx{color:#9a8ccb;margin-left:3px;font-size:9px}
  .as-cmt{font:12px inherit;border:1px solid #e2dcef;border-radius:6px;padding:3px 7px;color:#444;background:#faf9fe;width:100%}
  .as-cmtadd{font:11px inherit;border:1px dashed #d8ccf5;background:#fff;color:#8a7fb8;border-radius:6px;padding:2px 7px;cursor:pointer;align-self:flex-start;display:none}
  .as-card:hover .as-cmtadd{display:inline-block}
  .as-pop{position:absolute;z-index:40;background:#fff;border:1px solid #cbbdf0;border-radius:8px;box-shadow:0 6px 22px rgba(60,40,110,.22);padding:6px;min-width:150px;max-height:300px;overflow:auto;font-size:13px}
  .as-pop label{display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:5px;cursor:pointer}
  .as-pop label:hover{background:#f3eefe}.as-pop input{accent-color:var(--as-acc)}
  `;
  const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  loadArt();
})();
