// ==UserScript==
// @name         Group Therapy — MusicBrainz relationship helper
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.1.21
// @description  Subtle relationship-editor helpers: batch-delete rel groups from a right-click menu, page-wide hover highlight with a count tooltip, and (soon) copy/move credits between recordings & clone release credits. Chrome-light — context menus + hover, no toolbar.
// @author       majkinetor
// @icon         https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/group_therapy/icon.svg
// @match        *://*.musicbrainz.org/release/*/edit-relationships
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// @noframes
// ==/UserScript==

/* eslint-disable no-undef */
(function () {
  'use strict';
  const VERSION = '2026.7.1.21';
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

  // collect peer relationship-items matching a scope relative to a seed × button
  function collect(seedBtn, scope) {
    const seedItem = seedBtn.closest('.relationship-item'), seedRow = seedBtn.closest('tr');
    if (!seedItem || !seedRow) return [];
    const roleClass = pickRoleClass(seedRow), href = targetHref(seedItem);
    const all = [...document.querySelectorAll('.relationship-item')];
    return all.filter(item => {
      if (scope === 'role') return rowHasClass(item.closest('tr'), roleClass);
      if (scope === 'target') return itemHasHref(item, href);
      return rowHasClass(item.closest('tr'), roleClass) && itemHasHref(item, href);   // role+target
    });
  }
  const removeButtons = items => items.map(it => it.querySelector(REMOVE_SEL)).filter(Boolean);

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
  function runRemoval(items) {
    const btns = removeButtons(items);
    for (const b of btns) { try { b.click(); } catch (e) {} }
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
    const opt = (label, its, scope) => ({ label, sub: String(its.length), lines: breakdown(its, scope), danger: true, run: () => runRemoval(its) });
    const items = [
      { label: `Remove this one`, run: () => { try { btn.click(); } catch (e) {} } },
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
      .gt-menu{position:fixed;z-index:2147483647;min-width:230px;max-width:480px;max-height:74vh;overflow-y:auto;background:#fff;border:1px solid #cfd4da;border-radius:7px;
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
      .gt-pop{position:fixed;z-index:2147483647;min-width:300px;max-width:460px;background:#fff;border:1px solid #cfd4da;border-radius:8px;
        box-shadow:0 10px 30px rgba(0,0,0,.2);padding:6px;font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222}
      .gt-pop .gt-pop-hdr{padding:4px 8px 6px;font-size:11px;font-weight:700;letter-spacing:.02em;color:#6a7482;text-transform:uppercase}
      .gt-pop .gt-pop-list{max-height:44vh;overflow-y:auto}
      .gt-pop .gt-pop-note{padding:8px;color:#8892a0;font-size:12px}
      .gt-pop .gt-pop-rel{display:block;width:100%;box-sizing:border-box;text-align:left;background:none;border:none;border-radius:5px;padding:6px 9px;cursor:pointer;color:inherit;font:inherit}
      .gt-pop .gt-pop-rel:hover{background:#eef1f6}
      .gt-pop .gt-pop-rel-t{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .gt-pop .gt-pop-rel-m{display:block;font-size:11px;color:#8892a0;margin-top:1px}
      .gt-pop .gt-pop-row{display:flex;gap:6px;padding:6px 6px 4px}
      .gt-pop .gt-pop-tf{flex:1;min-width:0;padding:5px 8px;border:1px solid #cfd4da;border-radius:5px;font:inherit}
      .gt-pop .gt-pop-go{flex:none;background:#2e9e5b;color:#fff;border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font:600 13px inherit}
      .gt-pop .gt-pop-go:hover{background:#28864d}
      /* subtle discoverability: the controls Group Therapy adds a right-click menu to (recording/work
         checkboxes → copy/move; the × → group delete) get a faint green accent, and a clearer ring on hover */
      tr.track input.recording, tr.track input.work { accent-color:#2e9e5b; }
      tr.track input.recording:hover, tr.track input.work:hover, button.icon.remove-item:hover {
        outline:2px solid rgba(46,158,91,.55); outline-offset:1px; border-radius:3px; }
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
  // clone another release's release-level credits (artists + labels) onto this release
  async function cloneFromRelease(sourceGid) {
    const re = RE(); if (!re) return 0;
    const j = await (await fetch('/ws/js/entity/' + sourceGid + '?inc=rels', { credentials: 'include', headers: { Accept: 'application/json' } })).json();
    const rels = (j.relationships || []).filter(r => (r.target_type === 'artist' || r.target_type === 'label') && r.target && r.target.id != null);
    const here = re.state.entity;
    let n = 0;
    for (const r of rels) {
      const target = { entityType: r.target_type, id: r.target.id, gid: r.target.gid, name: r.target.name };
      // artist/label sort before "release", so the target is entity0 and carries entity0_credit
      dispatchRelationship(re, here, target, r.linkTypeID, r.entity0_credit || '', buildAttrTree(r.attributes), { begin_date: r.begin_date, end_date: r.end_date, ended: r.ended });
      n++;
    }
    return n;
  }
  const GID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  // popover: pick a sibling release from this release group, or paste any release URL/MBID
  let popEl = null;
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
  async function doCopyFrom(gid) {
    if (!gid) return;
    const here = ((RE() && RE().state.entity.gid) || '').toLowerCase();
    if (gid.toLowerCase() === here) { toast('That’s this release'); return; }
    closePopover(); toast('Fetching…');
    try { const n = await cloneFromRelease(gid); toast(n ? `Copied ${n} release credit${n > 1 ? 's' : ''} — review & save` : 'No artist/label credits on that release'); }
    catch (e) { toast('Copy failed: ' + (e && e.message || e)); }
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
        const b = el('button', 'gt-pop-rel');
        b.appendChild(el('span', 'gt-pop-rel-t', r.title + (r.disambiguation ? ` (${r.disambiguation})` : '')));
        const fmt = [...new Set((r.media || []).map(m => m.format).filter(Boolean))].join(' + ');
        const tracks = (r.media || []).reduce((s, m) => s + (m['track-count'] || 0), 0);
        const meta = [r.date, r.country, fmt, tracks ? tracks + ' tracks' : ''].filter(Boolean).join(' · ');
        if (meta) b.appendChild(el('span', 'gt-pop-rel-m', meta));
        b.onclick = () => doCopyFrom(r.id);
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
    const row = el('div', 'gt-pop-row');
    const inp = el('input', 'gt-pop-tf'); inp.type = 'text'; inp.placeholder = 'or paste a release URL / MBID';
    const go = el('button', 'gt-pop-go', 'Copy');
    const fromInput = () => { const m = (inp.value || '').match(GID_RE); if (!m) { toast('No release MBID in that text'); return; } doCopyFrom(m[0]); };
    go.onclick = fromInput; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fromInput(); } });
    row.appendChild(inp); row.appendChild(go); popEl.appendChild(row);
    document.body.appendChild(popEl);
    const a = anchor.getBoundingClientRect(), r = popEl.getBoundingClientRect();
    popEl.style.left = Math.max(8, Math.min(a.left, window.innerWidth - r.width - 8)) + 'px';
    popEl.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onPopDown, true); document.addEventListener('keydown', onPopKey, true); try { inp.focus(); } catch (e) {} }, 0);
    loadRgReleases(list);
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
    return true;
  }

  const ltName = id => (W.MB && W.MB.linkedEntities && W.MB.linkedEntities.link_type[id] || {}).name || String(id);
  const trackPosOfRow = tr => posLabel(tr);

  // ── format-aware cleansing (#338) ─────────────────────────────────────────
  // When copying credits onto a destination of a given FORMAT, credits whose ROLE is listed for that
  // format start UNTICKED in the copy checklist (re-tick to override) — e.g. don't carry a vinyl-only
  // production credit onto a digital edition. Keys = format-name substrings (case-insensitive),
  // values = role-name substrings. Replace the whole map via GM value 'gt-format-exclude' (JSON object).
  const FORMAT_EXCLUDE_DEFAULT = { digital: ['lacquer', 'vinyl'] };
  function formatExcludeMap() { try { const raw = (typeof GM_getValue === 'function') && GM_getValue('gt-format-exclude', ''); if (raw) return JSON.parse(raw); } catch (e) {} return FORMAT_EXCLUDE_DEFAULT; }
  function formatExcludeRolesFor(fmt) {
    fmt = (fmt || '').toLowerCase(); if (!fmt) return [];
    const map = formatExcludeMap(), out = [];
    for (const k in map) if (fmt.includes(String(k).toLowerCase())) out.push(...(map[k] || []));
    return out.map(s => String(s).toLowerCase());
  }
  // recording checkbox → copy every recording rel except work/url/recording-samples
  // (so artists, ℗/© labels, recorded-at places, …) onto the ticked recordings
  function openCopyMenu(sourceTr, x, y) {
    const srcRels = recordingRels(sourceTr).filter(r => !r.removed && r.other && !['work', 'url', 'recording'].includes(r.other.entityType));
    const entries = srcRels.map(s => ({ rel: s, role: s.linkTypeID, pos: ltName(s.linkTypeID), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : '') }));
    const chosen = () => entries.filter(e => !e.cb || e.cb.checked).map(e => e.rel);
    // destination rows = ticked recording checkboxes (other than the source) → entities + track positions
    const destRows = [...document.querySelectorAll('tr.track')].filter(tr => { if (tr === sourceTr) return false; const cb = tr.querySelector('input.recording'); return cb && cb.checked; });
    const dests = destRows.map(recordingEntity).filter(Boolean);
    const destPos = new Set(destRows.map(trackPosOfRow).filter(p => p != null));
    // format-aware cleansing: when all destinations share one format, pre-untick credits whose role
    // doesn't fit it (kept in the list, overridable).
    const destFmts = [...new Set(destRows.map(mediumFormatOf).filter(Boolean).map(f => f.toLowerCase()))];
    const destFmt = destFmts.length === 1 ? destFmts[0] : '';
    const exRoles = formatExcludeRolesFor(destFmt); let excluded = 0;
    if (exRoles.length) entries.forEach(e => { const rn = ltName(e.rel.linkTypeID).toLowerCase(); if (exRoles.some(k => rn.includes(k))) { e.checked = false; e.text += ` — off (not typical for ${destFmt})`; excluded++; } });
    const nR = srcRels.length, nD = dests.length;
    const where = destPos.size ? `track${destPos.size > 1 ? 's' : ''} ${ranges(destPos)}` : `${nD} recording${nD > 1 ? 's' : ''}`;
    const items = [];
    if (!nR) { items.push({ header: 'No credits here' }); }
    else if (!nD) { items.push({ header: 'Tick destination recordings first' }, { checklist: entries }); }
    else {
      const copyItem = { label: 'Copy', sub: String(chosen().length), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } copyCredits(c, dests); toast(`Copied ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} recording${nD > 1 ? 's' : ''} — review & save`); } };
      const moveItem = { label: 'Move (remove here)', danger: true, run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } const srcGid = (recordingEntity(sourceTr) || {}).gid; copyCredits(c, dests); removeSourceRels(srcGid, c); toast(`Moved ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} recording${nD > 1 ? 's' : ''} — review & save`); } };
      items.push({ header: `Copy to ${where}` });
      if (excluded) items.push({ note: `${excluded} credit${excluded > 1 ? 's' : ''} pre-unticked for format “${destFmt}”` });
      items.push({ checklist: entries, onToggle: () => { const n = chosen().length; copyItem._setSub && copyItem._setSub(String(n)); } },
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
    const entries = srcRels.map(s => ({ rel: s, role: s.linkTypeID, pos: ltName(s.linkTypeID), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : '') }));
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
    else if (!nD) items.push({ header: 'Tick destination works first' }, { checklist: entries });
    else {
      const copyItem = { label: 'Copy', sub: String(nR), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } copyCredits(c, destWorks); toast(`Copied ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} work${nD > 1 ? 's' : ''} — review & save`); } };
      const moveItem = { label: 'Move (remove here)', danger: true, run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } copyCredits(c, destWorks); removeWorkRels(srcWork, c); toast(`Moved ${c.length} credit${c.length > 1 ? 's' : ''} to ${nD} work${nD > 1 ? 's' : ''} — review & save`); } };
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
    try { GM_registerMenuCommand(`Group Therapy v${VERSION}`, () => {}); } catch (e) {}
    try { W.__groupTherapy = { VERSION, collect, removeButtons, highlightPage, recordingRels, recordingEntity, copyCredits, checkedDestinations, openCopyMenu, removeSourceRels, rowForRecording, cloneFromRelease, injectCloneButton, openCopyFromPopover, workEntity, workCreditRels, openWorkMenu, mediumFormatOf, formatExcludeRolesFor, RE }; } catch (e) {}
    console.log(`[Group Therapy] v${VERSION} ready — right-click a relationship's × for group delete; hover a name/role to highlight.`);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
