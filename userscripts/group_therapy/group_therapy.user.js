// ==UserScript==
// @name         Group Therapy
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.3
// @description  MusicBrainz relationship helpers: batch-delete rel groups from a right-click menu, page-wide hover highlight with a count tooltip, and copy/move credits between recordings & clone release credits. Chrome-light — context menus + hover, no toolbar.
// @author       majkinetor
// @icon         https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/group_therapy/icon.svg
// @match        *://*.musicbrainz.org/release/*/edit-relationships
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// @noframes
// ==/UserScript==

/* eslint-disable no-undef */
(function () {
  'use strict';
  const VERSION = '2026.7.3.183314';
  const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

  // ── tiny DOM helpers ──────────────────────────────────────────────────────
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  // MB renders each rel as <tr class="<role-kebab>"> … <div class="relationship-item"> <button class="icon remove-item">×</button> <a href="/artist|work|…/<mbid>">name</a> …
  const REMOVE_SEL = 'button.icon.remove-item';
  const ROLE_STOP = new Set(['odd', 'even', 'highlighted', 'selected', 'subrow', 'rel-add', 'rel-edit', 'rel-remove']);
  const pickRoleClass = tr => { if (!tr) return null; for (const c of tr.classList) if (!ROLE_STOP.has(c) && /^[a-z][a-z0-9-]*$/.test(c)) return c; return null; };
  const pickRoleLabel = tr => { const l = tr && tr.querySelector('th.link-phrase label'); return l ? (l.textContent || '').replace(/:\s*$/, '').trim() : 'role'; };
  // medium number a track row belongs to — the nearest preceding `tr.subh` ("1▼CD" → 1). Each medium
  // is its own <tbody>, so we scan the table's rows in document order (not just siblings). Cached per row.
  const _medCache = new WeakMap();
  const mediumNumberOf = tr => {
    if (!tr) return null;
    if (_medCache.has(tr)) return _medCache.get(tr);
    let med = null; const tbl = tr.closest && tr.closest('table');
    if (tbl) { const all = [...tbl.querySelectorAll('tr')], idx = all.indexOf(tr); for (let i = idx - 1; i >= 0; i--) { if (all[i].classList && all[i].classList.contains('subh')) { const m = (all[i].textContent || '').match(/(\d+)/); med = m ? m[1] : null; break; } } }
    _medCache.set(tr, med); return med;
  };
  // medium FORMAT label for a track row (from the nearest preceding tr.subh, e.g. "1▼CD" → "CD", "2▼12″ Vinyl" → "12″ Vinyl")
  const mediumFormatOf = tr => {
    const tbl = tr && tr.closest && tr.closest('table'); if (!tbl) return '';
    const all = [...tbl.querySelectorAll('tr')], idx = all.indexOf(tr);
    for (let i = idx - 1; i >= 0; i--) { if (all[i].classList && all[i].classList.contains('subh')) return (all[i].textContent || '').replace(/^\s*\d+\s*/, '').replace(/^[^A-Za-z0-9]+/, '').trim(); }
    return '';
  };
  // track position label from the row's position cell — handles vinyl/multi-disc numbers ("D5", "A1")
  // as well as plain "5". On multi-medium releases, a plain number is prefixed with the medium so
  // "1" on CD 1 vs CD 2 read as "1.1" / "2.1". Returns a string (or null for non-track rows).
  const posLabel = tr => {
    if (!tr || !tr.querySelector) return null;
    const c = tr.querySelector('td.pos'); let t = c ? (c.textContent || '').trim() : '';
    if (!t) { const m = (tr.textContent || '').match(/^\s*(\d+)\b/); t = m ? m[1] : ''; }
    if (!t) return null;
    if (/^\d+$/.test(t) && document.querySelectorAll('tr.subh').length > 1) { const med = mediumNumberOf(tr); if (med) t = med + '.' + t; }
    return t;
  };
  const targetHref = item => { const a = item && item.querySelector('a[href*="/artist/"], a[href*="/work/"], a[href*="/label/"], a[href*="/place/"], a[href*="/recording/"], a[href*="/url/"], a[href*="/event/"], a[href*="/instrument/"]'); return a ? a.getAttribute('href') : null; };
  const targetLabel = item => { const a = item && item.querySelector('a[href*="/"]'); return a ? (a.textContent || '').trim() : 'target'; };
  const rowHasClass = (tr, cls) => !!(tr && cls && tr.classList.contains(cls));
  const itemHasHref = (item, href) => !!(href && item.querySelector(`a[href="${CSS.escape(href)}"]`));

  // a rel's "role" for grouping = its link type PLUS its attributes — because e.g. every instrument rel
  // shares the one "instrument" link type and the specific instrument (drums, shakers, …) is an
  // attribute; matching on the CSS role class alone would lump drums + shakers + vocals together.
  const _roleKeyCache = new WeakMap();
  function relRoleKey(item) {
    if (_roleKeyCache.has(item)) return _roleKeyCache.get(item);
    const rel = relFromNode(item); let key = null;
    if (rel) { let attrs = ''; try { if (rel.attributes) attrs = [...W.MB.tree.iterate(rel.attributes)].map(a => a.typeID).sort((x, y) => x - y).join(','); } catch (e) {} key = rel.linkTypeID + '#' + attrs; }
    _roleKeyCache.set(item, key); return key;
  }
  // collect peer relationship-items matching a scope relative to a seed × button
  function collect(seedBtn, scope) {
    const seedItem = seedBtn.closest('.relationship-item'); if (!seedItem) return [];
    const seedKey = relRoleKey(seedItem), href = targetHref(seedItem);
    return [...document.querySelectorAll('.relationship-item')].filter(item => {
      if (scope === 'role') return relRoleKey(item) === seedKey;
      if (scope === 'target') return itemHasHref(item, href);
      return relRoleKey(item) === seedKey && itemHasHref(item, href);   // role+target
    });
  }
  const removeButtons = items => items.map(it => it.querySelector(REMOVE_SEL)).filter(Boolean);

  // ── edit-note signature — stamped into MB's edit-note field ONLY when GT actually changes something ──
  const GT_HOMEPAGE = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/group_therapy/README.md';
  function editNoteSig() {
    let s = {}; try { if (typeof GM_info !== 'undefined' && GM_info.script) s = GM_info.script; } catch (e) {}
    const name = (s.name || 'Group Therapy').split(/\s+[—–-]\s+/)[0].trim();   // drop the "— MusicBrainz relationship helper" suffix
    return `${name} by ${s.author || 'majkinetor'} v${s.version || VERSION} - ${s.homepageURL || s.homepage || GT_HOMEPAGE}`;
  }
  // Stamp our signature into MB's edit-note field and, under it, an accumulating list of what GT did
  // ("Copied credits from track 4 to tracks 1–5", "Removed guitar (14)"). Any note that preceded ours
  // (another script's) is preserved ahead of our block. Idempotent per identical action line.
  function stampEditNote(action) {
    const ta = document.querySelector('textarea.edit-note, #edit-note-text'); if (!ta) return;
    const sig = editNoteSig(), cur = ta.value || '';
    let pre = cur.replace(/\s+$/, ''), ourLines = [];
    const idx = cur.indexOf(sig);
    if (idx >= 0) {
      pre = cur.slice(0, idx).replace(/\s+$/, '');
      ourLines = cur.slice(idx + sig.length).split('\n').map(l => l.trim()).filter(Boolean);
    }
    if (action && !ourLines.includes(action)) ourLines.push(action);
    const block = ourLines.length ? `${sig}\n\n${ourLines.join('\n')}` : sig;
    const next = pre ? `${pre}\n\n${block}` : block;
    try { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set; set.call(ta, next); ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function markUsed(action) { try { stampEditNote(action); } catch (e) {} }

  // ── subtle context menu ───────────────────────────────────────────────────
  let menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener('mousedown', onDocDown, true); document.removeEventListener('keydown', onKey, true); } }
  function onDocDown(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
  function onKey(e) { if (e.key === 'Escape') closeMenu(); }
  function openMenu(x, y, items) {   // items: [{label, sub, danger, run} | 'sep']
    closeMenu();
    menuEl = el('div', 'gt-menu');
    for (const it of items) {
      if (it === 'sep') { menuEl.appendChild(el('div', 'gt-sep')); continue; }
      if (it.header != null) { menuEl.appendChild(el('div', 'gt-hdr', it.header)); continue; }
      if (it.note != null) { menuEl.appendChild(el('div', 'gt-note', it.note)); continue; }
      if (it.checklist) {   // per-credit toggles for copy/move — clicking a box toggles, doesn't close the menu
        const box = el('div', 'gt-ck-list');
        it.checklist.forEach(entry => {
          const lab = el('label', 'gt-ck');
          const cb = el('input', 'gt-ck-cb'); cb.type = 'checkbox'; cb.checked = entry.checked !== false; entry.cb = cb;
          cb.addEventListener('change', () => { if (it.onToggle) it.onToggle(); });
          // whole row toggles (it's a <label>); right-click selects only this role (same link type)
          lab.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); it.checklist.forEach(en => { if (en.cb) en.cb.checked = en.role === entry.role; }); if (it.onToggle) it.onToggle(); });
          lab.appendChild(cb); lab.appendChild(el('span', 'gt-ck-pos', `[${entry.pos}]`)); lab.appendChild(el('span', 'gt-ck-tx', entry.text));
          box.appendChild(lab);
        });
        menuEl.appendChild(box);
        continue;
      }
      const row = el('button', 'gt-mi' + (it.danger ? ' gt-danger' : ''));
      const top = el('div', 'gt-mi-top');
      top.appendChild(el('span', 'gt-mi-l', it.label));
      if (it.sub != null) { const badge = el('span', 'gt-mi-s', it.sub); top.appendChild(badge); it._setSub = v => { try { badge.textContent = v; } catch (e) {} }; }
      row.appendChild(top);
      if (it.lines && it.lines.length) {   // #338: fully-detailed per-track blast breakdown
        const box = el('div', 'gt-mi-lines'), MAX = 12;
        it.lines.slice(0, MAX).forEach(ln => { const l = el('div', 'gt-mi-ln'); l.appendChild(el('span', 'gt-mi-pos', `[${ln.pos}]`)); l.appendChild(el('span', 'gt-mi-tx', ln.text)); box.appendChild(l); });
        if (it.lines.length > MAX) box.appendChild(el('div', 'gt-mi-ln gt-mi-more', `… ${it.lines.length - MAX} more`));
        row.appendChild(box);
      }
      row.onclick = () => { closeMenu(); try { it.run(); } catch (e) {} };
      menuEl.appendChild(row);
    }
    document.body.appendChild(menuEl);
    // keep on-screen
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    menuEl.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onDocDown, true); document.addEventListener('keydown', onKey, true); }, 0);
  }

  // ── batch delete: right-click a rel's × → remove a whole group ─────────────
  // We never fabricate a removal — we click MB's own peer × buttons, so React
  // handles each exactly like a manual click (works on existing + new rels).
  function runRemoval(items, desc) {
    const btns = removeButtons(items);
    for (const b of btns) { try { b.click(); } catch (e) {} }
    if (btns.length) markUsed(desc || `Removed ${btns.length} relationship${btns.length > 1 ? 's' : ''}`);
  }
  // per-rel facts: its track position (null = release-level), role label, and target name
  function itemInfo(it) {
    const roleTr = it.closest && it.closest('tr');
    const trackTr = it.closest && it.closest('tr.track');
    const a = it.querySelector('a[href*="/"]');
    return { pos: posLabel(trackTr), role: pickRoleLabel(roleTr), target: a ? (a.textContent || '').trim() : '' };
  }
  // fully-detailed blast breakdown: group the group's rels by track, and per track list the varying
  // dimension — the targets (for a role scope), the roles (for a target scope), the role (for both).
  function breakdown(items, scope) {
    const byPos = new Map();
    for (const it of items) {
      const info = itemInfo(it), key = info.pos == null ? 'R' : info.pos;
      if (!byPos.has(key)) byPos.set(key, { pos: info.pos, vals: [] });
      byPos.get(key).vals.push(scope === 'role' ? info.target : info.role);
    }
    return [...byPos.values()].sort((a, b) => { if (a.pos == null) return 1; if (b.pos == null) return -1; return String(a.pos).localeCompare(String(b.pos), undefined, { numeric: true }); })
      .map(r => ({ pos: r.pos == null ? 'rel' : r.pos, text: [...new Set(r.vals.filter(Boolean))].join(', ') }));
  }
  // keys of the recordings / works MB currently has selected (ticked checkboxes)
  function selectionKeys() {
    const re = RE(), recs = new Set(), works = new Set(); if (!re) return { recs, works };
    const add = (tree, set) => { try { for (const e of W.MB.tree.iterate(tree)) { const w = Array.isArray(e) ? e[1] : e; if (w) set.add((w.gid || '') + '|' + w.id); } } catch (e) {} };
    add(re.state.selectedRecordings, recs); add(re.state.selectedWorks, works);
    return { recs, works };
  }
  // is a rel item on one of the selected recordings/works?
  function itemInSelection(item, sel) {
    const rel = relFromNode(item); if (!rel) return true;   // unreadable → don't exclude
    for (const e of [rel.entity0, rel.entity1]) {
      if (!e) continue; const key = (e.gid || '') + '|' + e.id;
      if (e.entityType === 'recording' && sel.recs.has(key)) return true;
      if (e.entityType === 'work' && sel.works.has(key)) return true;
    }
    return false;
  }
  function onContextMenu(ev) {
    // #338 P2: right-click a recording's checkbox → copy/move its credits to the ticked recordings;
    // right-click a work checkbox → copy/move its work rels the same way
    const recCb = ev.target.closest && ev.target.closest('input.recording');
    if (recCb) { const tr = recCb.closest('tr.track'); if (tr) { ev.preventDefault(); openCopyMenu(tr, ev.clientX, ev.clientY); } return; }
    const workCb = ev.target.closest && ev.target.closest('input.work');
    if (workCb) { ev.preventDefault(); openWorkMenu(workCb, ev.clientX, ev.clientY); return; }
    const btn = ev.target.closest && ev.target.closest(REMOVE_SEL);
    if (!btn) return;   // not a rel × — let the browser menu through
    ev.preventDefault();
    const seedRow = btn.closest('tr'), seedItem = btn.closest('.relationship-item');
    const roleLabel = pickRoleLabel(seedRow), tgt = targetLabel(seedItem);
    let roleItems = collect(btn, 'role'), tgtItems = collect(btn, 'target'), bothItems = collect(btn, 'role-and-target');
    // scope the group removals to the selected recordings/works, if any are ticked (#338)
    const sel = selectionKeys(); let scopeNote = null;
    if (sel.recs.size || sel.works.size) {
      const keep = it => itemInSelection(it, sel);
      roleItems = roleItems.filter(keep); tgtItems = tgtItems.filter(keep); bothItems = bothItems.filter(keep);
      const parts = []; if (sel.recs.size) parts.push(`${sel.recs.size} recording${sel.recs.size > 1 ? 's' : ''}`); if (sel.works.size) parts.push(`${sel.works.size} work${sel.works.size > 1 ? 's' : ''}`);
      scopeNote = `scoped to ${parts.join(' + ')} selected`;
    }
    const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const desc = (label, n) => `${label.replace(/^Remove\s+/, 'Removed ')} (${n})` + (scopeNote ? ` — ${scopeNote}` : '');
    const opt = (label, its, scope) => ({ label, sub: String(its.length), lines: breakdown(its, scope), danger: true, run: () => runRemoval(its, desc(label, its.length)) });
    const items = [
      { label: `Remove this one`, run: () => { try { btn.click(); markUsed(`Removed ${roleLabel}${tgt ? ` — ${tgt}` : ''}`); } catch (e) {} } },
      'sep',
    ];
    if (scopeNote) items.push({ note: scopeNote });
    items.push(
      opt(`Remove ${trunc(roleLabel, 46)}`, roleItems, 'role'),
      opt(`Remove “${trunc(tgt, 46)}”`, tgtItems, 'target'),
      opt(`Remove ${trunc(roleLabel, 24)} + ${trunc(tgt, 24)}`, bothItems, 'role-and-target'),
    );
    openMenu(ev.clientX, ev.clientY, items);
  }

  // ── hover highlight (page-wide) + count tooltip ───────────────────────────
  // Hover an entity name or a role label → light up every matching occurrence on the page (CSS
  // Custom Highlight API), split into "already in MB" vs "newly added this session", and show a
  // tooltip: how many, and which tracks / the release it appears on.
  function needleFor(target) {
    if (!target || !target.closest) return null;
    const phraseTh = target.closest('th.link-phrase');
    if (phraseTh && !target.closest('button')) { const l = phraseTh.querySelector('label'); if (l) { let t = (l.textContent || '').trim().replace(/:\s*$/, ''); if (t) return t; } }
    const link = target.closest('a[href]');
    if (link && /\/(artist|work|label|place|recording|series|release-group|event|instrument|area)\/[a-f0-9-]/.test(link.getAttribute('href') || '')) return (link.textContent || '').trim();
    return null;
  }
  // newly-added rels get negative MB ids on their remove button; persisted ones are positive
  function isNewRow(node) {
    const item = node.parentNode && node.parentNode.closest ? node.parentNode.closest('.relationship-item') : null;
    if (!item) return false;
    const rm = item.querySelector('button.remove-item[id^="remove-relationship-"]');
    if (!rm) return false;
    const segs = rm.id.split('-'), last = segs[segs.length - 1];
    return (segs[segs.length - 2] === '' && /^\d+$/.test(last)) || /^-\d+$/.test(last);
  }
  const trackPosOf = node => { const tr = node.parentNode && node.parentNode.closest ? node.parentNode.closest('tr.track') : null; return posLabel(tr); };
  function highlightPage(needle) {
    if (!needle || !window.CSS?.highlights || typeof Highlight === 'undefined') return { n: 0 };
    const lower = needle.toLowerCase(); if (lower.length < 2) return { n: 0 };
    const exist = [], neu = [], tracks = new Set(); let release = false, n = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode(x) { const p = x.parentNode; if (!p) return NodeFilter.FILTER_REJECT; const t = p.tagName; return (t === 'STYLE' || t === 'SCRIPT' || t === 'NOSCRIPT' || t === 'TEXTAREA' || t === 'INPUT') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    let node;
    while ((node = walker.nextNode())) {
      const lt = node.nodeValue.toLowerCase(); if (lt.length < lower.length) continue;
      let i = 0, hit = false;
      while ((i = lt.indexOf(lower, i)) !== -1) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + lower.length); (isNewRow(node) ? neu : exist).push(r); n++; hit = true; i += lower.length; }
      if (hit) { const p = trackPosOf(node); if (p != null) tracks.add(p); else if (node.parentNode && node.parentNode.closest && node.parentNode.closest('.relationship-item')) release = true; }
    }
    try { window.CSS.highlights.set('gt-hl-existing', new Highlight(...exist)); window.CSS.highlights.set('gt-hl-new', new Highlight(...neu)); } catch (e) {}
    return { n, tracks, release };
  }
  function clearHighlight() { try { window.CSS.highlights?.delete('gt-hl-existing'); window.CSS.highlights?.delete('gt-hl-new'); } catch (e) {} }
  // compress [1,2,3,5] → "1–3, 5"; non-numeric positions (vinyl "D4","D5") are natural-sorted + joined
  function ranges(vals) {
    const a = [...vals];
    if (a.length && a.every(v => /^\d+$/.test(String(v)))) {
      const nums = a.map(Number).sort((x, y) => x - y), out = []; let s = null, p = null;
      for (const v of nums) { if (s == null) { s = p = v; } else if (v === p + 1) { p = v; } else { out.push(s === p ? `${s}` : `${s}–${p}`); s = p = v; } }
      if (s != null) out.push(s === p ? `${s}` : `${s}–${p}`);
      return out.join(', ');
    }
    return a.map(String).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).join(', ');
  }
  let tipEl = null;
  function showTip(x, y, info, name) {
    if (!info || (!info.n && !name)) { hideTip(); return; }
    if (!tipEl) { tipEl = el('div', 'gt-tip'); document.body.appendChild(tipEl); }
    tipEl.innerHTML = '';
    // we hid MB's native title (the entity's real/sort name, shown when Credited As differs) —
    // so surface it here instead so that info isn't lost.
    if (name) tipEl.appendChild(el('div', 'gt-tip-name', name));
    const parts = [];
    if (info.n) { parts.push(`${info.n}×`); if (info.tracks && info.tracks.size) parts.push(`track${info.tracks.size > 1 ? 's' : ''} ${ranges(info.tracks)}`); if (info.release) parts.push('release'); }
    if (parts.length) tipEl.appendChild(el('div', 'gt-tip-stat', parts.join(' · ')));
    tipEl.style.display = '';
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.min(x + 14, window.innerWidth - r.width - 8) + 'px';
    tipEl.style.top = Math.min(y + 16, window.innerHeight - r.height - 8) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
  // MB puts the entity's sort name in the link's `title`, so the browser's native tooltip stacks on
  // top of ours. Temporarily strip it while our count tooltip is up, and restore it on the way out.
  let _hidTitle = null;
  function suppressTitle(target) { const te = target.closest && target.closest('[title]'); if (!te || (_hidTitle && te === _hidTitle.el)) return; restoreTitle(); const v = te.getAttribute('title'); if (v == null) return; _hidTitle = { el: te, val: v }; te.removeAttribute('title'); }
  function restoreTitle() { if (_hidTitle) { try { _hidTitle.el.setAttribute('title', _hidTitle.val); } catch (e) {} _hidTitle = null; } }
  function onOver(ev) { const nd = needleFor(ev.target); if (!nd) return; suppressTitle(ev.target); const nm = (_hidTitle && _hidTitle.val && _hidTitle.val !== nd) ? _hidTitle.val : null; const info = highlightPage(nd); showTip(ev.clientX, ev.clientY, info, nm); }
  function onMove(ev) { if (tipEl && tipEl.style.display !== 'none' && needleFor(ev.target)) { tipEl.style.left = Math.min(ev.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8) + 'px'; tipEl.style.top = Math.min(ev.clientY + 16, window.innerHeight - tipEl.offsetHeight - 8) + 'px'; } }
  function onOut(ev) { if (!needleFor(ev.target)) return; const rt = ev.relatedTarget; if (_hidTitle && rt && _hidTitle.el.contains && _hidTitle.el.contains(rt)) return; clearHighlight(); hideTip(); restoreTitle(); }

  // ── styles ────────────────────────────────────────────────────────────────
  function injectStyle() {
    const s = el('style');
    s.textContent = `
      .gt-menu{position:fixed;z-index:2147483647;min-width:260px;max-width:600px;max-height:74vh;overflow-y:auto;background:#fff;border:1px solid #cfd4da;border-radius:7px;
        box-shadow:0 8px 26px rgba(0,0,0,.18);padding:4px;font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222;user-select:none}
      .gt-mi .gt-mi-lines{margin:3px 0 1px 4px}
      .gt-mi .gt-mi-ln{display:flex;gap:6px;font-size:11px;color:#5a6472;line-height:1.4}
      .gt-mi .gt-mi-pos{flex:none;color:#9aa3b0;min-width:24px}
      .gt-mi .gt-mi-tx{flex:1;white-space:normal;word-break:break-word}
      .gt-mi .gt-mi-more{color:#9aa3b0;font-style:italic}
      .gt-menu .gt-sep{height:1px;background:#e7e9ee;margin:4px 2px}
      .gt-menu .gt-hdr{padding:5px 9px 4px;font-size:11px;font-weight:700;letter-spacing:.02em;color:#6a7482;text-transform:uppercase}
      .gt-menu .gt-note{padding:0 9px 6px;font-size:11px;color:#8892a0;white-space:normal;word-break:break-word}
      .gt-menu .gt-ck-list{margin:2px 0 3px}
      .gt-menu .gt-ck{display:flex;align-items:flex-start;gap:7px;padding:3px 9px;font-size:11px;color:#5a6472;line-height:1.4;cursor:pointer;user-select:none}
      .gt-menu .gt-ck:hover{background:#eef1f6}
      .gt-menu .gt-ck-cb{margin:1px 0 0;flex:none;accent-color:#2e9e5b;cursor:pointer}
      .gt-menu .gt-ck-pos{flex:none;color:#9aa3b0}
      .gt-menu .gt-ck-tx{flex:1;white-space:normal;word-break:break-word}
      .gt-mi{display:block;width:100%;box-sizing:border-box;background:none;border:none;text-align:left;
        padding:6px 9px;border-radius:5px;cursor:pointer;color:inherit;font:inherit}
      .gt-mi:hover{background:#eef1f6}
      .gt-mi .gt-mi-top{display:flex;align-items:center;gap:10px}
      .gt-mi .gt-mi-l{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .gt-mi .gt-mi-d{font-size:11px;color:#8892a0;margin-top:2px}
      .gt-mi .gt-mi-s{flex:none;min-width:20px;text-align:center;font-weight:700;font-size:11px;color:#556;background:#eef1f6;border-radius:9px;padding:1px 7px}
      .gt-mi.gt-danger:hover{background:#fbe3e0}
      .gt-mi.gt-danger .gt-mi-s{color:#fff;background:#c0392b}
      ::highlight(gt-hl-existing){background:#1f6feb;color:#fff}
      ::highlight(gt-hl-new){background:#1f6feb;color:#ffe066}
      .gt-tip{position:fixed;z-index:2147483647;pointer-events:none;background:#1b2430;color:#eef2f7;
        font:12px -apple-system,Segoe UI,Arial,sans-serif;padding:4px 9px;border-radius:5px;box-shadow:0 3px 12px rgba(0,0,0,.28);white-space:nowrap}
      .gt-tip .gt-tip-name{font-weight:600}
      .gt-tip .gt-tip-stat{color:#aeb8c6;font-size:11px;margin-top:1px}
      .gt-toast{position:fixed;z-index:2147483647;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);opacity:0;
        pointer-events:none;transition:opacity .18s,transform .18s;background:#1b2430;color:#eef2f7;
        font:13px -apple-system,Segoe UI,Arial,sans-serif;padding:8px 14px;border-radius:7px;box-shadow:0 6px 22px rgba(0,0,0,.3)}
      .gt-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .gt-clone-btn{margin-left:10px;font:600 12px -apple-system,Segoe UI,Arial,sans-serif;color:#2e6da4;background:#eef4fb;
        border:1px solid #cfe0f0;border-radius:5px;padding:2px 9px;cursor:pointer;vertical-align:middle}
      .gt-clone-btn:hover{background:#e2edf8}
      .gt-cfg-btn{float:right;margin-left:8px;font-size:15px;line-height:1.4;color:#8892a0;background:none;border:none;cursor:pointer;padding:2px 7px;border-radius:5px}
      .gt-cfg-btn:hover{background:#eef1f6;color:#556}
      .gt-about .gt-about-ver{padding:2px 9px 4px;font-size:12px;color:#556}
      .gt-about .gt-about-help{display:block;padding:6px 9px;font-size:13px;color:#2e6da4;text-decoration:none}
      .gt-about .gt-about-help:hover{text-decoration:underline;background:#eef1f6;border-radius:5px}
      .gt-pop{position:fixed;z-index:2147483647;min-width:300px;max-width:460px;background:#fff;border:1px solid #cfd4da;border-radius:8px;
        box-shadow:0 10px 30px rgba(0,0,0,.2);padding:6px;font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222}
      .gt-pop .gt-pop-hdr{padding:4px 8px 6px;font-size:11px;font-weight:700;letter-spacing:.02em;color:#6a7482;text-transform:uppercase}
      .gt-pop .gt-pop-list{max-height:44vh;overflow-y:auto}
      .gt-pop .gt-pop-note{padding:8px;color:#8892a0;font-size:12px}
      .gt-pop .gt-pop-rel{display:flex;align-items:center;gap:4px;border-radius:5px}
      .gt-pop .gt-pop-rel:hover{background:#eef1f6}
      .gt-pop .gt-pop-rel-info{flex:1;min-width:0;box-sizing:border-box;text-align:left;background:none;border:none;border-radius:5px;padding:6px 9px;cursor:pointer;color:inherit;font:inherit}
      .gt-pop .gt-pop-rel-t{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .gt-pop .gt-pop-rel-m{display:block;font-size:11px;color:#8892a0;margin-top:1px}
      .gt-pop .gt-pop-rel-open{flex:none;text-decoration:none;color:#8892a0;font-size:14px;line-height:1;padding:6px 9px;border-radius:5px}
      .gt-pop .gt-pop-rel-open:hover{background:#dfe4ea;color:#2e6da4}
      .gt-pop .gt-pop-add{padding:4px 6px 6px}
      .gt-pop .gt-pop-add-btn{display:block;width:100%;box-sizing:border-box;text-align:left;background:none;border:none;border-radius:5px;padding:6px 9px;cursor:pointer;color:#2e6da4;font:inherit}
      .gt-pop .gt-pop-add-btn:hover{background:#eef1f6}
      .gt-pop .gt-pop-tf{display:block;width:100%;box-sizing:border-box;min-width:0;padding:6px 8px;border:1px solid #4a90d9;border-radius:5px;font:inherit;outline:none}
      .gt-pop .gt-hidden{display:none}
      /* subtle discoverability: the controls Group Therapy adds a right-click menu to (recording/work
         checkboxes → copy/move; the × → group delete) get a faint green accent, and a clearer ring on hover */
      tr.track input.recording, tr.track input.work { accent-color:#2e9e5b; }
      tr.track input.recording:hover, tr.track input.work:hover, button.icon.remove-item:hover {
        outline:2px solid rgba(46,158,91,.55); outline-offset:1px; border-radius:3px; }
      /* Consolidate RG (#349) — the release×role matrix modal */
      .gt-cons-ov{position:fixed;inset:0;z-index:2147483646;background:rgba(20,24,30,.44);display:flex;align-items:center;justify-content:center}
      .gt-cons{background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.35);width:min(920px,94vw);max-height:88vh;display:flex;flex-direction:column;font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222}
      .gt-cons-hdr{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #e7e9ee}
      .gt-cons-title{font-weight:700;font-size:14px;flex:1}
      .gt-cons-x{background:none;border:none;font-size:16px;color:#8892a0;cursor:pointer;padding:2px 8px;border-radius:5px}
      .gt-cons-x:hover{background:#eef1f6;color:#556}
      .gt-cons-body{padding:10px 14px;overflow:auto}
      .gt-cons-leg{display:flex;flex-wrap:wrap;gap:4px 16px;margin-bottom:10px;font-size:12px;color:#556}
      .gt-cons-legi b{display:inline-block;min-width:16px;text-align:center;background:#eef4fb;border:1px solid #cfe0f0;border-radius:4px;color:#2e6da4;margin-right:2px}
      .gt-cons-legi.gt-cur b{background:#2e6da4;color:#fff}
      .gt-cons-legt{color:inherit;text-decoration:none}
      .gt-cons-legt:hover{text-decoration:underline;color:#2e6da4}
      .gt-cons-leglabel{font-size:11px;color:#8892a0;text-transform:uppercase;letter-spacing:.02em;margin-bottom:5px}
      .gt-cons-leg{gap:5px 6px}
      .gt-cons-selitem{cursor:pointer;border:1px solid transparent;border-radius:6px;padding:2px 7px;display:inline-flex;align-items:center}
      .gt-cons-selitem.gt-on{background:#eef4fb;border-color:#cfe0f0}
      .gt-cons-selitem:not(.gt-on){opacity:.5}
      .gt-cons-selitem:not(.gt-on):hover{opacity:.85;background:#f2f4f7}
      .gt-cons-legopen{text-decoration:none;color:#8892a0;margin-left:5px}
      .gt-cons-legopen:hover{color:#2e6da4}
      .gt-cons-legyr{color:#8892a0;margin-left:5px}
      .gt-cons-paste{display:block;width:100%;box-sizing:border-box;margin:9px 0 2px;padding:5px 8px;border:1px solid #cfd4da;border-radius:5px;font:12px inherit;color:#222;outline:none}
      .gt-cons-paste:focus{border-color:#4a90d9}
      .gt-cons-tbl{border-collapse:collapse;width:100%}
      .gt-cons-tbl th{font-size:11px;color:#6a7482;text-transform:uppercase;letter-spacing:.02em;text-align:left;padding:4px 8px;border-bottom:1px solid #ccc}
      .gt-cons-tbl th.gt-cons-col{text-align:center;width:30px}
      .gt-cons-tbl th.gt-cons-colsel{cursor:pointer;color:#2e6da4}
      .gt-cons-tbl th.gt-cons-colsel:hover{background:#eef4fb;border-radius:4px}
      .gt-cons-coll{font-weight:700}
      .gt-fmt{display:inline-flex;gap:2px;vertical-align:middle;margin:0 4px}
      .gt-fmt-b{display:inline-block;min-width:13px;box-sizing:border-box;padding:0 3px;border-radius:3px;font:700 9px/14px -apple-system,Segoe UI,Arial,sans-serif;color:#fff;text-align:center;letter-spacing:.02em}
      .gt-cons-col .gt-fmt{margin:2px 0 0;justify-content:center}
      .gt-cons-tbl td{padding:4px 8px;border-bottom:1px solid #eef0f3;vertical-align:top}
      .gt-cons-role{color:#556;white-space:nowrap}
      .gt-cons-cr{color:#8892a0}
      .gt-cons-cell{text-align:center;font-weight:700;width:30px;user-select:none}
      .gt-cons-cell.gt-has{color:#2e9e5b}
      .gt-cons-cell.gt-prop{color:#2e6da4;outline:1px dashed #9cc2e6;outline-offset:-3px;border-radius:4px}
      .gt-cons-cell.gt-none{color:#cdd3da}
      .gt-cons-foot{display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid #e7e9ee}
      .gt-cons-btn{font:600 13px inherit;padding:5px 14px;border-radius:6px;border:1px solid #cfe0f0;background:#eef4fb;color:#2e6da4;cursor:pointer}
      .gt-cons-btn:hover{background:#e2edf8}
      .gt-cons-apply{margin-left:auto;background:#2e9e5b;border-color:#2e9e5b;color:#fff}
      .gt-cons-apply:hover{background:#278a4f}
      .gt-cons-apply:disabled{background:#c9ced4;border-color:#c9ced4;cursor:default}
      .gt-cons-plan{color:#556;font-size:12px}
    `;
    document.head.appendChild(s);
  }

  // ── copy / move credits (P2, #338) ────────────────────────────────────────
  // Reuse MB's own editing path. We read a source recording's rels straight off the
  // rendered `.relationship-item` nodes — each carries the full rel object on its React
  // fiber (linkTypeID, both entities WITH internal ids, credits, and the attributes tree) —
  // then dispatch copies onto the destination recordings through MB's reducer. No lossy
  // DOM-text parsing, no nested-state traversal.
  const REL_TEMPLATE = { _lineage: [], _original: null, _status: 1, attributes: null, begin_date: null, editsPending: false, end_date: null, ended: false, entity0_credit: '', entity1_credit: '', id: null, linkOrder: 0, linkTypeID: null };
  const RE = () => (W.MB && W.MB.relationshipEditor) || null;
  const val = v => (typeof v === 'function' ? v() : v);

  // walk a DOM node's React fiber to the rel object (or entity) it renders
  function fiberFind(node, looks) {
    const key = node && Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!key) return null;
    const seen = new Set(), q = [node[key]]; let steps = 0;
    while (q.length && steps < 80) {
      steps++; const f = q.shift(); if (!f || seen.has(f)) continue; seen.add(f);
      for (const prop of ['memoizedProps', 'pendingProps', 'memoizedState']) {
        const p = f[prop]; if (p && typeof p === 'object') for (const v of Object.values(p)) {
          if (looks(v)) return v;
          if (v && typeof v === 'object' && looks(v.relationship)) return v.relationship;
          if (v && typeof v === 'object' && looks(v.recording)) return v.recording;
          if (v && typeof v === 'object' && looks(v.work)) return v.work;
        }
      }
      if (f.child) q.push(f.child); if (f.sibling) q.push(f.sibling); if (f.return) q.push(f.return);
    }
    return null;
  }
  const looksRel = o => o && typeof o === 'object' && ('linkTypeID' in o) && ('entity0' in o || 'entity1' in o);
  // gid OR id != null — new (in-session) works/recordings have a NEGATIVE id and no gid yet
  const looksRec = o => o && typeof o === 'object' && o.entityType === 'recording' && (o.gid || o.id != null);
  const looksWork = o => o && typeof o === 'object' && o.entityType === 'work' && (o.gid || o.id != null);
  // same MB entity — MUST compare entityType too: a work id and a recording id can be the SAME number
  // (e.g. "Phuture Jacks" work #6762137 vs recording #6762137), so an id-only match would wrongly pull
  // a recording's producer/mix rels into a work.
  const sameEntity = (e, ref) => !!(e && ref && e.entityType === ref.entityType && ((ref.gid && e.gid === ref.gid) || (ref.id != null && e.id === ref.id)));
  const relFromNode = node => fiberFind(node, looksRel);
  const recordingEntity = tr => fiberFind(tr, looksRec);
  const workEntity = node => fiberFind(node, looksWork);

  // a recording track-row's rels, normalised to {other, credit, linkTypeID, attributes}
  // where `other` is the non-recording entity (the artist/work/…) and `credit` its credited-as
  function recordingRels(tr) {
    const out = [];
    tr.querySelectorAll('.relationship-item').forEach(item => {
      const rel = relFromNode(item); if (!rel || !looksRel(rel)) return;
      const rec0 = rel.entity0 && rel.entity0.entityType === 'recording';
      const rec1 = rel.entity1 && rel.entity1.entityType === 'recording';
      if (!rec0 && !rec1) return;
      const other = rec0 ? rel.entity1 : rel.entity0;
      const credit = rec0 ? rel.entity1_credit : rel.entity0_credit;
      // _status: 0 = existing, 1 = added this session, 3 = marked removed (stays in the DOM struck)
      out.push({ item, other, credit: val(credit) || '', linkTypeID: rel.linkTypeID, attributes: rel.attributes || null,
        begin_date: rel.begin_date || null, end_date: rel.end_date || null, ended: !!rel.ended,   // preserve ℗/© years etc. on copy
        removed: rel._status === 3 });
    });
    return out;
  }

  // dispatch one rel into MB's editor (ported from Credit Hoarder's editor-state — the shared
  // editing lib). MB requires entity0 to be the lower entityType; swap + route credit accordingly.
  function dispatchRelationship(re, sourceEntity, targetEntity, linkTypeID, credit, attributes, dates) {
    if (credit && credit === (val(targetEntity.name) || '')) credit = '';
    const swapped = sourceEntity.entityType > targetEntity.entityType;
    const e0 = swapped ? targetEntity : sourceEntity;
    const e1 = swapped ? sourceEntity : targetEntity;
    re.dispatch({
      type: 'update-relationship-state',
      sourceEntity,
      batchSelectionCount: null,
      creditsToChangeForSource: '',
      creditsToChangeForTarget: '',
      oldRelationshipState: null,
      newRelationshipState: {
        ...REL_TEMPLATE,
        entity0: e0, entity0_credit: swapped ? (credit || '') : '',
        entity1: e1, entity1_credit: swapped ? '' : (credit || ''),
        id: re.getRelationshipStateId(), linkTypeID, attributes: attributes || null,
        begin_date: (dates && dates.begin_date) || null,
        end_date: (dates && dates.end_date) || null,
        ended: !!(dates && dates.ended),
      },
    });
  }

  // copy a set of source rels onto each destination entity (recording or work), preserving credit,
  // attributes and dates. Each dispatch is guarded so one bad target can't abort the whole batch.
  function copyCredits(srcRels, destEntities) {
    const re = RE(); if (!re) return 0;
    let n = 0, failed = 0;
    for (const dest of destEntities) {
      if (!dest || dest.id == null) { failed++; try { console.warn('[Group Therapy] skipping copy to a target with no id (unsaved entity?):', dest && val(dest.name)); } catch (e) {} continue; }
      for (const s of srcRels) {
        try { dispatchRelationship(re, dest, s.other, s.linkTypeID, s.credit, s.attributes, s); n++; }
        catch (e) { failed++; try { console.warn('[Group Therapy] copy failed for one credit:', e); } catch (_) {} }
      }
    }
    if (failed) try { toast(`Copied ${n}, but ${failed} could not be copied (see console)`); } catch (e) {}
    return n;
  }
  // destination recordings = every OTHER track row whose recording checkbox is ticked
  function checkedDestinations(sourceTr) {
    const dests = [];
    document.querySelectorAll('tr.track').forEach(tr => {
      if (tr === sourceTr) return;
      const cb = tr.querySelector('input.recording');
      if (cb && cb.checked) { const rec = recordingEntity(tr); if (rec) dests.push(rec); }
    });
    return dests;
  }
  // for Move: click MB's own × on each source rel (so React removes it like a manual click).
  // Must go ONE AT A TIME with a re-read between clicks — all the rels are on the same row, and
  // each removal re-renders it, so pre-collected × buttons go stale after the first click. We
  // re-query the row each pass and remove the next rel matching (linkType + target gid).
  const rowForRecording = gid => [...document.querySelectorAll('tr.track')].find(tr => { const rec = recordingEntity(tr); return rec && rec.gid === gid; });
  async function removeSourceRels(srcGid, srcRels) {
    const want = new Set(srcRels.map(s => s.linkTypeID + '|' + (s.other && s.other.gid)));
    for (let guard = 0; guard < 300; guard++) {
      const tr = rowForRecording(srcGid); if (!tr) break;   // re-find the row each pass — React replaces it on every removal
      // skip rels already marked removed (_status 3) — × leaves them struck in the DOM, so
      // without this the loop would re-click the same one forever
      const hit = recordingRels(tr).find(r => !r.removed && want.has(r.linkTypeID + '|' + (r.other && r.other.gid)));
      const b = hit && hit.item && hit.item.querySelector(REMOVE_SEL);
      if (!b) break;
      try { b.click(); } catch (e) {}
      await new Promise(r => setTimeout(r, 70));   // let React re-render before re-finding
    }
  }

  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', 'gt-toast'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // build an MB attribute ImmutableTree from a /ws/js rel's attribute array (they carry typeIDs directly)
  function buildAttrTree(wsAttrs) {
    if (!wsAttrs || !wsAttrs.length) return null;
    const MB = W.MB, lat = MB && MB.linkedEntities && MB.linkedEntities.link_attribute_type;
    if (!lat || !MB.tree) return null;
    const objs = wsAttrs.map(a => ({ type: lat[a.typeID], typeID: a.typeID, text_value: a.text_value || '', credited_as: a.credited_as || '' }))
      .filter(o => o.type).sort((a, b) => a.typeID - b.typeID);
    if (!objs.length) return null;
    try { return MB.tree.fromDistinctAscArray(objs); } catch (e) { return null; }
  }
  // fetch another release's release-level credits (artists + labels) as copy specs (not yet dispatched)
  async function fetchReleaseRels(sourceGid) {
    const j = await (await fetch('/ws/js/entity/' + sourceGid + '?inc=rels', { credentials: 'include', headers: { Accept: 'application/json' } })).json();
    return (j.relationships || []).filter(r => (r.target_type === 'artist' || r.target_type === 'label') && r.target && r.target.id != null)
      .map(r => ({
        other: { entityType: r.target_type, id: r.target.id, gid: r.target.gid, name: r.target.name },   // artist/label sort before release → carries entity0_credit
        linkTypeID: r.linkTypeID, credit: r.entity0_credit || '',
        attributes: buildAttrTree(r.attributes), begin_date: r.begin_date || null, end_date: r.end_date || null, ended: !!r.ended,
      }));
  }
  // this release's single medium format (from tr.subh), or '' when mixed/unknown
  const releaseFormat = () => { const f = [...new Set([...document.querySelectorAll('tr.subh')].map(s => (s.textContent || '').replace(/^\s*\d+\s*/, '').replace(/^[^A-Za-z0-9]+/, '').trim().toLowerCase()).filter(Boolean))]; return f.length === 1 ? f[0] : ''; };
  const GID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  // popover: pick a sibling release from this release group, or paste any release URL/MBID
  let popEl = null, cloneBtnRef = null;
  function closePopover() { if (popEl) { popEl.remove(); popEl = null; document.removeEventListener('mousedown', onPopDown, true); document.removeEventListener('keydown', onPopKey, true); } }
  function onPopKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closePopover(); } }
  function onPopDown(e) {
    if (!popEl || popEl.contains(e.target)) return;
    closePopover();
    // swallow the trailing click so dismissing doesn't activate whatever's underneath (#305)
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', swallow, true); };
    document.addEventListener('click', swallow, true);
    setTimeout(() => document.removeEventListener('click', swallow, true), 500);
  }
  async function doCopyFrom(gid, srcLabel) {
    if (!gid) return;
    const here = RE() && RE().state.entity; if (!here) return;
    if (gid.toLowerCase() === (here.gid || '').toLowerCase()) { toast('That’s this release'); return; }
    const a = cloneBtnRef && cloneBtnRef.getBoundingClientRect(); const ax = a ? a.left : 120, ay = a ? a.bottom + 4 : 120;
    closePopover(); toast('Fetching…');
    let specs; try { specs = await fetchReleaseRels(gid); } catch (e) { toast('Copy failed: ' + (e && e.message || e)); return; }
    if (!specs.length) { toast('No artist/label credits on that release'); return; }
    // show a checklist of what will be copied (like the recording/work menus), with format-aware
    // cleansing against THIS release's format (cross-format copy is where cleansing matters)
    const entries = specs.map(s => ({ rel: s, role: roleKeyOfSpec(s), pos: roleLabelOf(s), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : '') }));
    const chosen = () => entries.filter(e => !e.cb || e.cb.checked).map(e => e.rel);
    const fmt = releaseFormat(), exRoles = formatExcludeRolesFor(fmt); let excluded = 0;
    if (exRoles.length) entries.forEach(e => { const rn = ltName(e.rel.linkTypeID).toLowerCase(); if (exRoles.some(k => rn.includes(k))) { e.checked = false; e.text += ` — off (not typical for ${fmt})`; excluded++; } });
    const copyItem = { label: 'Copy', sub: String(chosen().length), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } if (copyCredits(c, [here])) markUsed(`Copied ${c.length} release credit${c.length > 1 ? 's' : ''} from ${srcLabel ? `“${srcLabel}” (${gid})` : gid}`); toast(`Copied ${c.length} release credit${c.length > 1 ? 's' : ''} — review & save`); } };
    const items = [{ header: 'Copy release credits' }];
    if (excluded) items.push({ note: `${excluded} pre-unticked for format “${fmt}”` });
    items.push({ checklist: entries, onToggle: () => { copyItem._setSub && copyItem._setSub(String(chosen().length)); } }, copyItem);
    openMenu(ax, ay, items);
  }
  async function loadRgReleases(list) {
    try {
      const here = RE().state.entity.gid;
      const rg = await (await fetch('/ws/2/release/' + here + '?inc=release-groups&fmt=json', { headers: { Accept: 'application/json' } })).json();
      const rgid = rg['release-group'] && rg['release-group'].id;
      if (!rgid) { list.textContent = ''; list.appendChild(el('div', 'gt-pop-note', 'No release group')); return; }
      const sib = await (await fetch('/ws/2/release?release-group=' + rgid + '&inc=media&limit=100&fmt=json', { headers: { Accept: 'application/json' } })).json();
      const rels = (sib.releases || []).filter(r => r.id !== here);
      list.textContent = '';
      if (!rels.length) { list.appendChild(el('div', 'gt-pop-note', 'No other releases in this group')); return; }
      for (const r of rels) {
        const b = el('div', 'gt-pop-rel');
        const info = el('button', 'gt-pop-rel-info');
        info.appendChild(el('span', 'gt-pop-rel-t', r.title + (r.disambiguation ? ` (${r.disambiguation})` : '')));
        const fmt = [...new Set((r.media || []).map(m => m.format).filter(Boolean))].join(' + ');
        const tracks = (r.media || []).reduce((s, m) => s + (m['track-count'] || 0), 0);
        const meta = [r.date, r.country, fmt, tracks ? tracks + ' tracks' : ''].filter(Boolean).join(' · ');
        if (meta) info.appendChild(el('span', 'gt-pop-rel-m', meta));
        info.title = 'Copy this release’s credits onto this one';
        info.onclick = () => doCopyFrom(r.id, r.title + (r.disambiguation ? ` (${r.disambiguation})` : ''));
        const open = el('a', 'gt-pop-rel-open', '↗');   // ↗ open the release in a new tab to inspect first
        open.href = '/release/' + r.id; open.target = '_blank'; open.rel = 'noopener';
        open.title = 'Open this release in a new tab';
        open.addEventListener('click', ev => ev.stopPropagation());
        b.appendChild(info); b.appendChild(open);
        list.appendChild(b);
      }
    } catch (e) { list.textContent = ''; list.appendChild(el('div', 'gt-pop-note', 'Could not load release group')); }
  }
  function openCopyFromPopover(anchor) {
    closePopover();
    popEl = el('div', 'gt-pop');
    popEl.appendChild(el('div', 'gt-pop-hdr', 'Copy release credits from…'));
    const list = el('div', 'gt-pop-list'); list.appendChild(el('div', 'gt-pop-note', 'Loading release group…')); popEl.appendChild(list);
    popEl.appendChild(el('div', 'gt-sep'));
    // paste-to-copy: a (+) that unrolls into a field and acts immediately on paste — no Copy button
    // (same idiom as Apollo's link/artist add + ISRC Scout). Enter is a fallback for typed input.
    const add = el('div', 'gt-pop-add');
    const plus = el('button', 'gt-pop-add-btn'); plus.type = 'button'; plus.textContent = '＋ from a release URL / MBID';
    const inp = el('input', 'gt-pop-tf gt-hidden'); inp.type = 'text'; inp.placeholder = 'paste a release URL / MBID…';
    const fromInput = () => { const m = (inp.value || '').match(GID_RE); if (m) doCopyFrom(m[0]); };
    plus.onclick = () => { plus.classList.add('gt-hidden'); inp.classList.remove('gt-hidden'); try { inp.focus(); } catch (e) {} };
    inp.addEventListener('paste', () => setTimeout(fromInput, 0));   // wait for the pasted text to land in .value
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fromInput(); } });
    add.appendChild(plus); add.appendChild(inp); popEl.appendChild(add);
    document.body.appendChild(popEl);
    const a = anchor.getBoundingClientRect(), r = popEl.getBoundingClientRect();
    popEl.style.left = Math.max(8, Math.min(a.left, window.innerWidth - r.width - 8)) + 'px';
    popEl.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onPopDown, true); document.addEventListener('keydown', onPopKey, true); }, 0);
    loadRgReleases(list);
  }
  function openAboutPopover(anchor) {
    closePopover();
    popEl = el('div', 'gt-pop gt-about');
    popEl.appendChild(el('div', 'gt-pop-hdr', 'Group Therapy'));
    popEl.appendChild(el('div', 'gt-about-ver', `version ${VERSION}`));
    const help = el('a', 'gt-about-help', '? Help'); help.href = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/group_therapy'; help.target = '_blank'; help.rel = 'noopener';
    popEl.appendChild(help);
    document.body.appendChild(popEl);
    const a = anchor.getBoundingClientRect(), r = popEl.getBoundingClientRect();
    popEl.style.left = Math.max(8, Math.min(a.right - r.width, window.innerWidth - r.width - 8)) + 'px';
    popEl.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onPopDown, true); document.addEventListener('keydown', onPopKey, true); }, 0);
  }
  function injectCloneButton() {
    const h2 = [...document.querySelectorAll('h2')].find(h => /^\s*Release relationships/i.test(h.textContent || ''));
    if (!h2) return false;
    if (h2.querySelector('.gt-clone-btn')) return true;
    const b = el('button', 'gt-clone-btn', '⧉ Copy from release…');
    b.title = 'Copy release-level credits (artists, labels) from another release onto this one';
    b.type = 'button';
    b.onclick = () => openCopyFromPopover(b);
    h2.appendChild(b);
    cloneBtnRef = b;
    const cons = el('button', 'gt-clone-btn', '▦ Consolidate RG…');
    cons.title = 'Spread release-level credits across every release in this group (union minus format-specific)';
    cons.type = 'button';
    cons.onclick = () => openConsolidate();
    h2.appendChild(cons);
    const cfg = el('button', 'gt-cfg-btn', '⚙'); cfg.type = 'button'; cfg.title = 'Group Therapy — about / help';
    cfg.onclick = () => openAboutPopover(cfg);
    h2.appendChild(cfg);
    return true;
  }

  const ltName = id => (W.MB && W.MB.linkedEntities && W.MB.linkedEntities.link_type[id] || {}).name || String(id);
  // grouping key for a copy spec: link type + its attribute typeIDs (so drums ≠ shakers ≠ vocals)
  const roleKeyOfSpec = s => { let a = ''; try { if (s.attributes) a = [...W.MB.tree.iterate(s.attributes)].map(x => x.typeID).sort((p, q) => p - q).join(','); } catch (e) {} return s.linkTypeID + '#' + a; };
  // display label for a copy spec — MB's own rendered role label when the rel is on the page
  // ("drums (drum set)", "background vocals"); else the link type + resolved attribute names.
  function roleLabelOf(s) {
    if (s.item) { const l = pickRoleLabel(s.item.closest && s.item.closest('tr')); if (l && l !== 'role') return l; }
    const base = ltName(s.linkTypeID), parts = [];
    try { if (s.attributes) { const lat = W.MB.linkedEntities && W.MB.linkedEntities.link_attribute_type; for (const a of W.MB.tree.iterate(s.attributes)) { const nm = (a.type && a.type.name) || (lat && lat[a.typeID] && lat[a.typeID].name); if (nm) parts.push(a.text_value ? `${nm}: ${a.text_value}` : nm); } } } catch (e) {}
    return parts.length ? `${base} (${parts.join(', ')})` : base;
  }
  const trackPosOfRow = tr => posLabel(tr);

  // ── format-aware cleansing (#338, #349) ───────────────────────────────────
  // When copying/consolidating credits onto a destination of a given FORMAT, credits whose ROLE is
  // format-inappropriate start UNTICKED (re-tick to override). Two layers:
  //   FORMAT_EXCLUDE — format-substring → role-substrings dropped FOR that format (physical-only roles off
  //     a digital edition). Override via GM value 'gt-format-exclude' (JSON object).
  //   FORMAT_ONLY — role-substring → the ONLY format families it belongs to; dropped from every OTHER
  //     format. Lacquer cutting is vinyl-only; glass mastering is optical-disc-only (CD/DVD/SACD/Blu-ray).
  //     Override via GM value 'gt-format-only' (JSON object).
  const FORMAT_EXCLUDE_DEFAULT = { digital: ['vinyl', 'pressed', 'printed', 'manufactured'] };
  const FORMAT_ONLY_DEFAULT = { lacquer: ['vinyl'], glass: ['cd', 'dvd', 'sacd', 'blu-ray'] };
  const _gmJson = (key, def) => { try { const raw = (typeof GM_getValue === 'function') && GM_getValue(key, ''); if (raw) return JSON.parse(raw); } catch (e) {} return def; };
  function formatExcludeMap() { return _gmJson('gt-format-exclude', FORMAT_EXCLUDE_DEFAULT); }
  function formatOnlyMap() { return _gmJson('gt-format-only', FORMAT_ONLY_DEFAULT); }
  function formatExcludeRolesFor(fmt) {
    fmt = (fmt || '').toLowerCase(); if (!fmt) return [];
    const out = [], excl = formatExcludeMap(), only = formatOnlyMap();
    for (const k in excl) if (fmt.includes(String(k).toLowerCase())) out.push(...(excl[k] || []));
    for (const role in only) if (!(only[role] || []).some(f => fmt.includes(String(f).toLowerCase()))) out.push(role);
    return [...new Set(out.map(s => String(s).toLowerCase()))];
  }

  // ── format-family markers (#350): collapse any MB format to Digital / Vinyl / CD / Cassette, drawn as a
  // compact colored badge (full format in the tooltip). Optical (DVD/SACD/Blu-ray) folds into CD.
  const FMT_FAMILY = { Digital: { label: 'D', color: '#4a90d9' }, Vinyl: { label: 'LP', color: '#3a3f47' }, CD: { label: 'CD', color: '#7d8894' }, Cassette: { label: 'MC', color: '#9a6b3f' } };
  function formatFamily(f) {
    f = (f || '').toLowerCase();
    if (/cassette|tape/.test(f)) return 'Cassette';
    if (/vinyl|shellac|flexi/.test(f)) return 'Vinyl';
    if (/cd|sacd|dvd|blu.?ray|hd.?dvd|minidisc|umd|disc/.test(f)) return 'CD';
    if (/digital|file|download|stream|web/.test(f)) return 'Digital';
    return '';
  }
  const formatFamilies = fmt => [...new Set((fmt || '').split('+').map(formatFamily).filter(Boolean))];
  function fmtBadges(fmt) {
    const wrap = el('span', 'gt-fmt');
    for (const fam of formatFamilies(fmt)) { const b = el('span', 'gt-fmt-b', FMT_FAMILY[fam].label); b.style.background = FMT_FAMILY[fam].color; b.title = fam + (fmt && fmt !== fam ? ` (${fmt})` : ''); wrap.appendChild(b); }
    return wrap;
  }

  // ── Consolidate RG (#349) ──────────────────────────────────────────────────
  // Build a (role, entity) × release matrix of every release's release-level credits — artist/label/place
  // entity credits. URLs are EXCLUDED (edition-specific: each release has its own discogs / streaming /
  // purchase link, so spreading them is wrong); recording/work are excluded too (shared already). Propose
  // the union minus format-specific roles, and let the user
  // toggle cells, whole columns (click a header letter), or the whole matrix (Auto select). Apply POSTs
  // the additions as edit_type:90 relationship-creates to /ws/js/edit/create — the internal endpoint ISRC
  // Scout uses (session-cookie auth, no CSRF). We read via /ws/js for the NUMERIC linkTypeID + entity
  // credits the edit API needs; formats come from the RG enumeration.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // fetch one release's release-level rels, retrying on rate-limit (429/503) and transient errors with backoff
  async function consFetchRels(gid, tries = 4) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch('/ws/js/entity/' + gid + '?inc=rels', { credentials: 'include', headers: { Accept: 'application/json' } });
        if ((res.status === 429 || res.status === 503) && i < tries - 1) { await sleep(700 * (i + 1)); continue; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        return (j.relationships || []).filter(r => r.target && r.target.gid && !['recording', 'work', 'url'].includes(r.target_type));
      } catch (e) { if (i === tries - 1) throw e; await sleep(600 * (i + 1)); }
    }
    return [];
  }
  // run worker over items with a bounded number of concurrent tasks (parallel, but throttled)
  async function throttledMap(items, worker, concurrency = 4) {
    const out = new Array(items.length); let idx = 0;
    const run = async () => { while (idx < items.length) { const i = idx++; try { out[i] = await worker(items[i], i); } catch (e) { out[i] = null; } } };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
    return out;
  }
  const consKey = r => [r.linkTypeID, r.target.gid, (r.attributes || []).map(a => a.typeID).sort((p, q) => p - q).join(','), r.entity0_credit || '', r.entity1_credit || ''].join('|');
  const consLabel = r => {
    const ent = r.target_type === 'url' ? (r.target.name || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') : (r.target.name || '?');
    const credit = (r.entity0_credit && r.entity0_credit !== r.target.name && r.entity0_credit) || (r.entity1_credit && r.entity1_credit !== r.target.name && r.entity1_credit) || '';
    return { role: ltName(r.linkTypeID), ent, credit };
  };
  const consExcluded = (row, rel) => formatExcludeRolesFor(rel.fmt).some(k => row.label.role.toLowerCase().includes(k));
  // ── edit_type:90 relationship-create payload for adding `r` onto release `relGid` ──
  function consAttrs(r) {
    return (r.attributes || []).map(a => {
      const gid = (a.type && a.type.gid) || ((W.MB && W.MB.linkedEntities && W.MB.linkedEntities.link_attribute_type || {})[a.typeID] || {}).gid;
      if (!gid) return null;
      const o = { type: { gid } };
      if (a.credited_as) o.credited_as = a.credited_as;
      if (a.text_value) o.text_value = a.text_value;
      return o;
    }).filter(Boolean);
  }
  function consEdit(r, relGid) {
    const lt = ((W.MB && W.MB.linkedEntities && W.MB.linkedEntities.link_type) || {})[r.linkTypeID] || {};
    const relEnd = { entityType: 'release', gid: relGid }, targetEnd = { entityType: r.target_type, gid: r.target.gid };
    // entities must match the link type's type0/type1 order; release→url has release as entity0
    const relIsE0 = lt.type0 === 'release' || r.target_type === 'url';
    const e = { edit_type: 90, linkTypeID: r.linkTypeID, entities: relIsE0 ? [relEnd, targetEnd] : [targetEnd, relEnd], attributes: consAttrs(r) };
    if (r.entity0_credit) e.entity0_credit = r.entity0_credit;
    if (r.entity1_credit) e.entity1_credit = r.entity1_credit;
    if (r.begin_date) e.begin_date = r.begin_date;
    if (r.end_date) e.end_date = r.end_date;
    if (r.ended) e.ended = true;
    return e;
  }
  let consEl = null;
  function onConsKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeConsolidate(); } }
  function closeConsolidate() { if (consEl) { consEl.remove(); consEl = null; document.removeEventListener('keydown', onConsKey, true); } }
  async function applyConsolidation(releases, rows, refresh) {
    const byRel = new Map();
    for (const row of rows) for (const rel of releases) if (row.propose.has(rel.gid) && !row.present.has(rel.gid)) { if (!byRel.has(rel.gid)) byRel.set(rel.gid, []); byRel.get(rel.gid).push(row); }
    const total = [...byRel.values()].reduce((s, a) => s + a.length, 0);
    if (!total) { toast('Nothing selected to add'); return; }
    toast(`Applying ${total} edit${total > 1 ? 's' : ''} across ${byRel.size} release${byRel.size > 1 ? 's' : ''}…`);
    const sig = editNoteSig();
    let okRel = 0, okEdits = 0; const failed = [];
    for (const [gid, rowsFor] of byRel) {
      const rel = releases.find(r => r.gid === gid);
      const edits = rowsFor.map(row => consEdit(row.sample, gid));
      const lines = rowsFor.map(row => `• ${row.label.role} — ${row.label.ent}${row.label.credit ? ` (${row.label.credit})` : ''}`);
      const note = `Consolidated ${edits.length} release-level credit${edits.length > 1 ? 's' : ''} across the release group onto this release:\n${lines.join('\n')}\n\n${sig}`;
      try {
        const res = await fetch('/ws/js/edit/create', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edits, editNote: note, makeVotable: 0 }) });
        const txt = await res.text().catch(() => ''); let j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (!res.ok || (j && j.error)) throw new Error((((j && (j.error.message || j.error)) || ('HTTP ' + res.status)) + '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160));
        okRel++; okEdits += edits.length;
        // reflect success: drop the proposal and cache the new rel on this release so the render's rebuild shows it present
        rowsFor.forEach(row => { row.propose.delete(gid); if (rel && rel._rels) rel._rels.push(row.sample); });
      } catch (e) { failed.push(`${rel ? rel.letter : gid}: ${(e && e.message) || e}`); }
      refresh && refresh();
      await sleep(1200);   // throttle between releases
    }
    if (failed.length) toast(`Added ${okEdits} across ${okRel} release(s); ${failed.length} failed — ${failed[0]}`);
    else toast(`✓ Added ${okEdits} credit${okEdits > 1 ? 's' : ''} across ${okRel} release${okRel > 1 ? 's' : ''} — check your edits`);
  }
  // The legend doubles as the release selector: columns follow which releases are ticked. Rels are fetched
  // lazily (only for selected releases) and cached; rows are rebuilt from the selected set on every render,
  // while each row's `propose` set persists in `rowsByKey`.
  function renderConsMatrix(ctx) {
    const { body, foot, releases, rowsByKey, recompute } = ctx;
    body.textContent = '';
    body.appendChild(el('div', 'gt-cons-leglabel', 'Releases in this group — click to add/remove a column'));
    const leg = el('div', 'gt-cons-leg');
    releases.forEach(r => {
      const s = el('span', 'gt-cons-legi gt-cons-selitem' + (r.selected ? ' gt-on' : '') + (r.current ? ' gt-cur' : ''));
      s.appendChild(el('b', null, r.letter)); s.appendChild(fmtBadges(r.fmt)); s.appendChild(document.createTextNode(' ' + r.title)); if (r.year) s.appendChild(el('span', 'gt-cons-legyr', ' · ' + r.year));
      const open = el('a', 'gt-cons-legopen', '↗'); open.href = '/release/' + r.gid; open.target = '_blank'; open.rel = 'noopener'; open.title = 'Open this release in a new tab'; open.onclick = ev => ev.stopPropagation();
      s.appendChild(open);
      s.title = (r.selected ? 'In the matrix — click to remove its column' : 'Click to add its column') + (r.current ? ' · the release you’re editing' : '');
      s.onclick = () => { r.selected = !r.selected; recompute(); };
      leg.appendChild(s);
    });
    body.appendChild(leg);
    const paste = el('input', 'gt-cons-paste'); paste.type = 'text'; paste.placeholder = 'paste release URLs / MBIDs to add them to the matrix…';
    paste.addEventListener('paste', () => setTimeout(() => {
      const gids = (paste.value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []);
      let n = 0; gids.forEach(g => { const rel = releases.find(r => r.gid.toLowerCase() === g.toLowerCase()); if (rel && !rel.selected) { rel.selected = true; n++; } });
      paste.value = ''; if (n) recompute(); else toast('No matching releases in this group');
    }, 0));
    body.appendChild(paste);

    const cols = releases.filter(r => r.selected);
    // rebuild rows from the selected releases: present is recomputed, propose persists on the row objects
    for (const row of rowsByKey.values()) row.present = new Set();
    for (const rel of cols) for (const r of (rel._rels || [])) { const k = consKey(r); let row = rowsByKey.get(k); if (!row) { row = { key: k, sample: r, label: consLabel(r), present: new Set(), propose: new Set() }; rowsByKey.set(k, row); } row.present.add(rel.gid); }
    const rows = [...rowsByKey.values()].filter(row => row.present.size > 0).sort((a, b) => (a.label.role + a.label.ent).localeCompare(b.label.role + b.label.ent));

    foot.textContent = '';
    if (!cols.length) { body.appendChild(el('div', 'gt-pop-note', 'Select one or more releases above to build the matrix.')); return; }
    if (!rows.length) { body.appendChild(el('div', 'gt-pop-note', 'No release-level credits on the selected release(s).')); return; }

    const tbl = el('table', 'gt-cons-tbl'), head = el('tr');
    head.append(el('th', 'gt-cons-role', 'Role'), el('th', 'gt-cons-ent', 'Entity'));
    const addableFor = rel => rows.filter(row => !row.present.has(rel.gid) && !consExcluded(row, rel));   // not present + not format-specific
    const planLbl = el('span', 'gt-cons-plan');
    const applyBtn = el('button', 'gt-cons-btn gt-cons-apply', 'Apply'); applyBtn.type = 'button';
    const updatePlan = () => { let e = 0; const rs = new Set(); rows.forEach(row => cols.forEach(rel => { if (row.propose.has(rel.gid) && !row.present.has(rel.gid)) { e++; rs.add(rel.gid); } })); planLbl.textContent = e ? `${e} addition${e > 1 ? 's' : ''} across ${rs.size} release${rs.size > 1 ? 's' : ''}` : 'nothing selected'; applyBtn.disabled = !e; };
    const draw = () => {
      [...tbl.querySelectorAll('tr.gt-cons-row')].forEach(n => n.remove());
      for (const row of rows) {
        const tr = el('tr', 'gt-cons-row');
        tr.appendChild(el('td', 'gt-cons-role', row.label.role));
        const ent = el('td', 'gt-cons-ent'); ent.appendChild(document.createTextNode(row.label.ent)); if (row.label.credit) ent.appendChild(el('span', 'gt-cons-cr', ' “' + row.label.credit + '”')); tr.appendChild(ent);
        for (const rel of cols) {
          const td = el('td', 'gt-cons-cell'), has = row.present.has(rel.gid), prop = row.propose.has(rel.gid);
          td.classList.add(has ? 'gt-has' : prop ? 'gt-prop' : 'gt-none');
          td.textContent = has || prop ? rel.letter : '·';
          if (has) td.title = 'already present';
          else { td.style.cursor = 'pointer'; td.title = prop ? 'will be added — click to skip' : `skipped (format-specific for ${rel.fmt || '?'}) — click to add`; td.onclick = () => { row.propose.has(rel.gid) ? row.propose.delete(rel.gid) : row.propose.add(rel.gid); draw(); updatePlan(); }; }
          tr.appendChild(td);
        }
        tbl.appendChild(tr);
      }
    };
    cols.forEach(r => {
      const th = el('th', 'gt-cons-col gt-cons-colsel'); th.appendChild(el('div', 'gt-cons-coll', r.letter)); th.appendChild(fmtBadges(r.fmt));
      th.title = `${r.title} — click to select / clear every addable credit for this release (skips format-specific)`;
      th.onclick = () => { const p = addableFor(r); const all = p.length && p.every(row => row.propose.has(r.gid)); p.forEach(row => all ? row.propose.delete(r.gid) : row.propose.add(r.gid)); draw(); updatePlan(); };
      head.appendChild(th);
    });
    tbl.appendChild(head); body.appendChild(tbl);
    const autoBtn = el('button', 'gt-cons-btn', 'Auto select'); autoBtn.type = 'button'; autoBtn.title = 'Select every addable credit across the selected releases, except format-specific roles';
    const clearBtn = el('button', 'gt-cons-btn', 'Clear'); clearBtn.type = 'button'; clearBtn.title = 'Deselect every proposed credit';
    autoBtn.onclick = () => { cols.forEach(rel => addableFor(rel).forEach(row => row.propose.add(rel.gid))); draw(); updatePlan(); };
    clearBtn.onclick = () => { rows.forEach(row => row.propose.clear()); draw(); updatePlan(); };
    applyBtn.onclick = () => applyConsolidation(cols, rows, () => renderConsMatrix(ctx));
    foot.append(autoBtn, clearBtn, planLbl, applyBtn);
    draw(); updatePlan();
  }
  async function openConsolidate() {
    closeConsolidate(); closePopover();
    consEl = el('div', 'gt-cons-ov');
    const panel = el('div', 'gt-cons'), hdr = el('div', 'gt-cons-hdr');
    hdr.appendChild(el('span', 'gt-cons-title', 'Consolidate release-level credits across the group'));
    const x = el('button', 'gt-cons-x', '✕'); x.type = 'button'; x.onclick = closeConsolidate; hdr.appendChild(x);
    const body = el('div', 'gt-cons-body'), foot = el('div', 'gt-cons-foot');
    body.appendChild(el('div', 'gt-pop-note', 'Loading release group…'));
    panel.append(hdr, body, foot); consEl.appendChild(panel); document.body.appendChild(consEl);
    document.addEventListener('keydown', onConsKey, true);
    consEl.addEventListener('mousedown', e => { if (e.target === consEl) closeConsolidate(); });
    const note = m => { const n = body.querySelector('.gt-pop-note'); if (n) n.textContent = m; };
    let releases;
    try {
      const here = RE().state.entity.gid;
      const rg = await (await fetch('/ws/2/release/' + here + '?inc=release-groups&fmt=json', { headers: { Accept: 'application/json' } })).json();
      const rgid = rg['release-group'] && rg['release-group'].id;
      if (!rgid) return note('No release group');
      // enumerate every release (WS2 caps at 100/page — paginate)
      const all = []; let offset = 0, total = Infinity;
      while (offset < total) {
        const sib = await (await fetch(`/ws/2/release?release-group=${rgid}&inc=media&limit=100&offset=${offset}&fmt=json`, { headers: { Accept: 'application/json' } })).json();
        total = sib['release-count'] || (all.length + (sib.releases || []).length);
        all.push(...(sib.releases || []));
        if (!(sib.releases || []).length) break;
        offset += 100;
      }
      releases = all.sort((a, b) => (a.date || '~').localeCompare(b.date || '~')).map((r, i) => ({
        gid: r.id, title: r.title + (r.disambiguation ? ` (${r.disambiguation})` : ''), letter: (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26)),
        fmt: [...new Set((r.media || []).map(m => m.format).filter(Boolean))].join('+') || '', year: (r.date || '').slice(0, 4), current: r.id === here, selected: false, _rels: null,
      }));
    } catch (e) { return note('Could not load release group'); }
    if (!releases || releases.length < 2) return note('Need at least 2 releases in the group to consolidate');
    // auto-include all when the group is small; otherwise start with just the release we're editing (the
    // user picks the rest) — a 100+-release group would be an unusable wall of columns otherwise.
    const AUTO_MAX = 10;
    releases.forEach(r => r.selected = releases.length <= AUTO_MAX || r.current);
    const rowsByKey = new Map();
    const ctx = { body, foot, releases, rowsByKey, recompute: null };
    ctx.recompute = async () => {
      const need = releases.filter(r => r.selected && !r._rels);
      if (need.length) { let d = 0; note(`Reading releases… 0/${need.length}`); await throttledMap(need, async r => { try { r._rels = await consFetchRels(r.gid); } catch (e) { r._rels = []; } note(`Reading releases… ${++d}/${need.length}`); }); }
      renderConsMatrix(ctx);
    };
    await ctx.recompute();
  }

  // recording checkbox → copy every recording rel except work/url/recording-samples
  // (so artists, ℗/© labels, recorded-at places, …) onto the ticked recordings
  function openCopyMenu(sourceTr, x, y) {
    const srcRels = recordingRels(sourceTr).filter(r => !r.removed && r.other && !['work', 'url', 'recording'].includes(r.other.entityType));
    const entries = srcRels.map(s => ({ rel: s, role: roleKeyOfSpec(s), pos: roleLabelOf(s), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : '') }));
    const chosen = () => entries.filter(e => !e.cb || e.cb.checked).map(e => e.rel);
    // destination rows = ticked recording checkboxes (other than the source) → entities + track positions
    const destRows = [...document.querySelectorAll('tr.track')].filter(tr => { if (tr === sourceTr) return false; const cb = tr.querySelector('input.recording'); return cb && cb.checked; });
    const dests = destRows.map(recordingEntity).filter(Boolean);
    const destPos = new Set(destRows.map(trackPosOfRow).filter(p => p != null));
    const nR = srcRels.length, nD = dests.length;
    const srcPos = posLabel(sourceTr);
    const where = destPos.size ? `track${destPos.size > 1 ? 's' : ''} ${ranges(destPos)}` : `${nD} recording${nD > 1 ? 's' : ''}`;
    const items = [];
    if (!nR) { items.push({ header: 'No credits here' }); }
    else if (!nD) { items.push({ header: 'Tick destination recordings first' }); }
    else {
      const copyItem = { label: 'Copy', sub: String(chosen().length), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } if (copyCredits(c, dests)) markUsed(`Copied ${c.length} credit${c.length > 1 ? 's' : ''} from track ${srcPos || '?'} to ${where}`); toast(`Copied ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} recording${nD > 1 ? 's' : ''} — review & save`); } };
      const moveItem = { label: 'Move (remove here)', danger: true, run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } const srcGid = (recordingEntity(sourceTr) || {}).gid; if (copyCredits(c, dests)) markUsed(`Moved ${c.length} credit${c.length > 1 ? 's' : ''} from track ${srcPos || '?'} to ${where}`); removeSourceRels(srcGid, c); toast(`Moved ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} recording${nD > 1 ? 's' : ''} — review & save`); } };
      items.push({ header: `Copy to ${where}` },
        { checklist: entries, onToggle: () => { const n = chosen().length; copyItem._setSub && copyItem._setSub(String(n)); } },
        copyItem, moveItem);
    }
    openMenu(x, y, items);
  }

  // ── work credits: right-click a work's checkbox → copy its writer/composer credits to ticked works ─
  // (Per maintainer: we don't copy the work itself, we add the source work's own relationships to the
  //  selected works.) Read the work's artist rels (writer/composer/lyricist/…) via fiber, dedup, dispatch.
  function workCreditRels(work) {
    const out = [], seen = new Set();
    document.querySelectorAll('.relationship-item').forEach(item => {
      const rel = relFromNode(item); if (!rel || !looksRel(rel)) return;
      const w0 = sameEntity(rel.entity0, work), w1 = sameEntity(rel.entity1, work);
      if (!w0 && !w1) return;
      const other = w0 ? rel.entity1 : rel.entity0;
      if (!other || ['recording', 'url', 'work'].includes(other.entityType)) return;   // work credits (writer/composer/lyricist/publisher/…) — skip performance (recording), based-on (work), url
      const k = rel.linkTypeID + '|' + other.gid; if (seen.has(k)) return; seen.add(k);
      const credit = w0 ? rel.entity1_credit : rel.entity0_credit;
      out.push({ item, other, credit: val(credit) || '', linkTypeID: rel.linkTypeID, attributes: rel.attributes || null, begin_date: rel.begin_date || null, end_date: rel.end_date || null, ended: !!rel.ended, removed: rel._status === 3 });
    });
    return out;
  }
  async function removeWorkRels(work, srcRels) {
    const want = new Set(srcRels.map(s => s.linkTypeID + '|' + (s.other && s.other.gid)));
    for (let guard = 0; guard < 300; guard++) {
      let btn = null;
      for (const item of document.querySelectorAll('.relationship-item')) {
        const rel = relFromNode(item); if (!rel || !looksRel(rel) || rel._status === 3) continue;
        const w0 = sameEntity(rel.entity0, work), w1 = sameEntity(rel.entity1, work);
        if (!w0 && !w1) continue;
        const other = w0 ? rel.entity1 : rel.entity0;
        if (other && !['recording', 'url', 'work'].includes(other.entityType) && want.has(rel.linkTypeID + '|' + other.gid)) { btn = item.querySelector(REMOVE_SEL); break; }
      }
      if (!btn) break;
      try { btn.click(); } catch (e) {}
      await new Promise(r => setTimeout(r, 70));
    }
  }
  function openWorkMenu(workCb, x, y) {
    const srcWork = workEntity(workCb);
    if (!srcWork) { openMenu(x, y, [{ header: 'Could not read this work' }]); return; }
    const srcRels = workCreditRels(srcWork).filter(r => !r.removed);
    const entries = srcRels.map(s => ({ rel: s, role: roleKeyOfSpec(s), pos: roleLabelOf(s), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : '') }));
    const chosen = () => entries.filter(e => !e.cb || e.cb.checked).map(e => e.rel);
    // Destinations come from MB's own selection state, not the DOM: a newly-created work's checkbox
    // has no readable React entity (its fiber differs), so a DOM scan misses it — but selectedWorks
    // holds every ticked work. New works carry a NEGATIVE id and may have no gid yet, so identify by
    // gid-or-id (not gid alone, which would drop them).
    const destWorks = [], seenD = new Set(), idOf = w => w.gid || ('#' + w.id);
    try {
      for (const e of W.MB.tree.iterate(RE().state.selectedWorks)) {
        const w = Array.isArray(e) ? e[1] : e; if (!w) continue;
        if (srcWork.gid && w.gid === srcWork.gid) continue;               // skip the source work
        if (srcWork.id != null && w.id === srcWork.id) continue;
        const k = idOf(w); if (seenD.has(k)) continue; seenD.add(k);
        destWorks.push(w);
      }
    } catch (e) {}
    const nR = srcRels.length, nD = destWorks.length, nounN = `${nR} credit${nR > 1 ? 's' : ''}`;
    const destNames = destWorks.map(w => val(w.name));
    const items = [];
    if (!nR) items.push({ header: `“${trunc(val(srcWork.name), 34)}” has no credits` });
    else if (!nD) items.push({ header: 'Tick destination works first' });
    else {
      const copyItem = { label: 'Copy', sub: String(nR), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } if (copyCredits(c, destWorks)) markUsed(`Copied ${c.length} credit${c.length > 1 ? 's' : ''} from work “${val(srcWork.name)}” to ${nD} work${nD > 1 ? 's' : ''}`); toast(`Copied ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} work${nD > 1 ? 's' : ''} — review & save`); } };
      const moveItem = { label: 'Move (remove here)', danger: true, run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } if (copyCredits(c, destWorks)) markUsed(`Moved ${c.length} credit${c.length > 1 ? 's' : ''} from work “${val(srcWork.name)}” to ${nD} work${nD > 1 ? 's' : ''}`); removeWorkRels(srcWork, c); toast(`Moved ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} work${nD > 1 ? 's' : ''} — review & save`); } };
      items.push({ header: `Copy to ${nD} work${nD > 1 ? 's' : ''}` },
        { note: destNames.slice(0, 6).join(' · ') + (destNames.length > 6 ? ` +${destNames.length - 6} more` : '') },
        { checklist: entries, onToggle: () => { const n = chosen().length; copyItem._setSub && copyItem._setSub(String(n)); } },
        copyItem, moveItem);
    }
    openMenu(x, y, items);
  }

  // discoverability tooltips: label the controls GT hooks (set lazily on first hover; React may wipe
  // them on re-render, so we re-set via the data flag). Kept out of `title` when MB already set one.
  function hintControls(ev) {
    const t = ev.target; if (!t || !t.closest) return;
    const cb = t.closest && t.closest('tr.track input.recording, tr.track input.work');
    if (cb && !cb.dataset.gtHint) { cb.dataset.gtHint = '1'; if (!cb.title) cb.title = cb.matches('input.work')
      ? 'Group Therapy: right-click to copy/move this work’s relationships to the ticked works'
      : 'Group Therapy: right-click to copy/move this recording’s credits to the ticked recordings'; return; }
    const x = t.closest('button.icon.remove-item');
    if (x && !x.dataset.gtHint) { x.dataset.gtHint = '1'; if (!x.title) x.title = 'Group Therapy: right-click to remove a whole group (this role / this target / both)'; }
  }

  // ── boot ────────────────────────────────────────────────────────────────
  function boot() {
    injectStyle();
    document.body.addEventListener('contextmenu', onContextMenu, true);
    document.body.addEventListener('mouseover', onOver);
    document.body.addEventListener('mousemove', onMove);
    document.body.addEventListener('mouseout', onOut);
    document.body.addEventListener('mouseover', hintControls, true);
    let tries = 0; (function tryInject() { if (injectCloneButton() || tries++ > 40) return; setTimeout(tryInject, 500); })();
    try { W.__groupTherapy = { VERSION, collect, removeButtons, highlightPage, recordingRels, recordingEntity, copyCredits, checkedDestinations, openCopyMenu, removeSourceRels, rowForRecording, fetchReleaseRels, injectCloneButton, openCopyFromPopover, workEntity, workCreditRels, openWorkMenu, mediumFormatOf, formatExcludeRolesFor, RE }; } catch (e) {}
    console.log(`[Group Therapy] v${VERSION} ready — right-click a relationship's × for group delete; hover a name/role to highlight.`);
  }
  // Self-guard the page: in the String Theory bundle this script runs on EVERY union-matched URL
  // (Apollo's /release/*/edit, /artist/*, …), so its hover-highlight etc. would bleed onto other pages.
  // Standalone the @match restricts it; the bundle doesn't — so only boot on the relationship editor.
  if (/\/release\/[^/]+\/edit-relationships\/?$/i.test(location.pathname)) {
    if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot, { once: true });
  }
})();
