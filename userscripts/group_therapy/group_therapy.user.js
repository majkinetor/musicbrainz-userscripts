// ==UserScript==
// @name         Group Therapy
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.7.224924
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
  const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '2026.7.7';   // from the @version header at runtime
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
    // #373 right-click the role-group "+" (add another) → copy scoped to that role's credits; right-click a
    // rel's pencil (edit) → copy scoped to just that one credit. Both reuse the recording copy menu.
    const addBtn = ev.target.closest && ev.target.closest('button.add-item.add-another-entity');
    if (addBtn) {
      const tr = addBtn.closest('tr.track'), grp = addBtn.closest('tr');
      if (grp) { ev.preventDefault(); const items = [...grp.querySelectorAll('.relationship-item')], set = new Set(items), rc = items.length ? relClass(items[0]) : null;
        if (rc && rc.kind === 'work') openWorkMenu(rc.work, ev.clientX, ev.clientY, rel => !!(rel.item && set.has(rel.item)));   // #373 work role group → work copy
        else if (rc && rc.kind === 'rec' && tr) openCopyMenu(tr, ev.clientX, ev.clientY, rel => !!(rel.item && set.has(rel.item)));
      }
      return;
    }
    const editBtn = ev.target.closest && ev.target.closest('button.icon.edit-item');
    if (editBtn) {
      const tr = editBtn.closest('tr.track'), item = editBtn.closest('.relationship-item');
      if (item) { ev.preventDefault(); const rc = relClass(item);
        if (rc && rc.kind === 'work') openWorkMenu(rc.work, ev.clientX, ev.clientY, rel => rel.item === item);   // #373 work credit pencil → work copy, scoped
        else if (rc && rc.kind === 'rec' && tr) openCopyMenu(tr, ev.clientX, ev.clientY, rel => rel.item === item);
        // recof pencil is handled above (#374 openRecOfMenu) where present; otherwise no recording menu
      }
      return;
    }
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
    // only the actual relationship (track + release credits) UI — not GT's own overlays, and not
    // stray entity links elsewhere on the page (release title, sidebar, the work-match dialog, …)
    if (target.closest('.gt-cons-ov, .gt-wm-pop, .gt-pop, .gt-menu, .gt-tip, .gt-toast')) return null;
    const phraseTh = target.closest('th.link-phrase');
    if (phraseTh && !target.closest('button')) { const l = phraseTh.querySelector('label'); if (l) { let t = (l.textContent || '').trim().replace(/:\s*$/, ''); if (t) return t; } }
    const link = target.closest('a[href]');
    if (link && link.closest('.relationship-item') && /\/(artist|work|label|place|recording|series|release-group|event|instrument|area)\/[a-f0-9-]/.test(link.getAttribute('href') || '')) return (link.textContent || '').trim();
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
      /* #372 top toolbar (moved off the "Release relationships" heading to the top of the tab) */
      .gt-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 14px;padding:8px 10px;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:7px}
      .gt-toolbar .gt-clone-btn{margin-left:0}
      /* #365 "Vertical:" section — label + two icon-only up/down buttons */
      .gt-vert{display:inline-flex;align-items:center;gap:5px}
      .gt-vert-lbl{font:600 12px -apple-system,Segoe UI,Arial,sans-serif;color:#66707c}
      .gt-vert-btn{margin-left:0;font-size:14px;line-height:1;padding:2px 8px}
      .gt-vert .gt-vert-btn+.gt-vert-btn{margin-left:0}
      .gt-toolbar .gt-cfg-btn{float:none;margin-left:auto}
      /* #372 config window (⚙): standard header (icon + name + version + Help) + options body */
      .gt-cfg-pop{min-width:270px;padding:0}
      .gt-cfg-hd{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #ecebf3;background:#faf9fe;border-radius:8px 8px 0 0}
      .gt-cfg-ic{flex:none;border-radius:4px}
      .gt-cfg-name{font-weight:700;color:#3a2f66}
      .gt-cfg-ver{color:#9a92ad;font-size:12px}
      .gt-cfg-help{margin-left:auto;font-size:12px;color:#2e6da4;text-decoration:none;border:1px solid #cfe0f0;background:#eef4fb;border-radius:5px;padding:1px 8px}.gt-cfg-help:hover{background:#e2edf8}
      .gt-cfg-body{padding:9px 12px;display:flex;flex-direction:column;gap:8px}
      .gt-cfg-opt{display:flex;align-items:center;gap:8px;font-size:13px;color:#333;cursor:pointer}.gt-cfg-opt input{margin:0}
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
         checkboxes → copy/move; the × → group delete; the +/pencil → scoped copy #373) get a green ring on hover */
      tr.track input.recording, tr.track input.work { accent-color:#2e9e5b; }
      tr.track input.recording:hover, tr.track input.work:hover, button.icon.remove-item:hover,
      tr.track button.add-item.add-another-entity:hover, tr.track button.icon.edit-item:hover {
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
  // #373 classify a rel item so the +/pencil/× route correctly: a recording credit, a WORK credit (carrying
  // the work entity from the rel), a recording-of, or null. Fixes work rels showing the recording's menu.
  function relClass(item) {
    const rel = relFromNode(item); if (!rel) return null;
    const t0 = rel.entity0 && rel.entity0.entityType, t1 = rel.entity1 && rel.entity1.entityType;
    if ((t0 === 'recording' && t1 === 'work') || (t0 === 'work' && t1 === 'recording')) return { kind: 'recof', rel };
    if (t0 === 'work' || t1 === 'work') return { kind: 'work', rel, work: t0 === 'work' ? rel.entity0 : rel.entity1 };
    if (t0 === 'recording' || t1 === 'recording') return { kind: 'rec', rel };
    return null;
  }
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
  // #365 map a link type to the equivalent for a different entity end, by NAME — e.g. artist-recording
  // "producer" (#141) ↔ artist-release "producer" (#30). Returns null when the role has no equivalent for
  // that entity type (e.g. "instrument" is recording-only), so we can skip + report it.
  function ltEquiv(srcLtId, targetType) {
    const lt = W.MB.linkedEntities && W.MB.linkedEntities.link_type, src = lt && lt[srcLtId]; if (!src) return null;
    const otherEnd = [src.type0, src.type1].find(t => t !== 'release' && t !== 'recording'); if (!otherEnd) return null;   // must be a credit (artist/label)
    if (src.type0 === targetType || src.type1 === targetType) return srcLtId;   // already the right pair
    const want = [targetType, otherEnd].sort().join('-');
    const m = Object.values(lt).find(t => t.name === src.name && [t.type0, t.type1].slice().sort().join('-') === want);
    return m ? m.id : null;
  }
  // like copyCredits, but maps each source credit's link type to the destination's entity type (#365
  // release↔recording). Returns { n applied, skipped (no equivalent role for that entity) }.
  function copyCreditsMapped(srcRels, destEntities) {
    const re = RE(); if (!re) return { n: 0, skipped: 0 };
    let n = 0, skipped = 0;
    for (const dest of destEntities) {
      if (!dest || dest.id == null) { skipped += srcRels.length; continue; }
      for (const s of srcRels) {
        const lt = ltEquiv(s.linkTypeID, dest.entityType);
        if (lt == null) { skipped++; continue; }
        try { dispatchRelationship(re, dest, s.other, lt, s.credit, s.attributes, s); n++; } catch (e) { skipped++; }
      }
    }
    return { n, skipped };
  }
  // #365 read the release's OWN credits — the relationship-items in the Release relationships section
  // (i.e. NOT inside a track row). Filtered to artist/label credits, like recordingRels.
  function releaseCreditRels() {
    const out = [];
    [...document.querySelectorAll('.relationship-item')].filter(i => !i.closest('tr.track')).forEach(item => {
      const rel = relFromNode(item); if (!rel || !looksRel(rel)) return;
      const rel0 = rel.entity0 && rel.entity0.entityType === 'release', rel1 = rel.entity1 && rel.entity1.entityType === 'release';
      if (!rel0 && !rel1) return;
      const other = rel0 ? rel.entity1 : rel.entity0;
      if (!other || !['artist', 'label'].includes(other.entityType)) return;   // only copyable credits
      const credit = rel0 ? rel.entity1_credit : rel.entity0_credit;
      out.push({ item, other, credit: val(credit) || '', linkTypeID: rel.linkTypeID, attributes: rel.attributes || null,
        begin_date: rel.begin_date || null, end_date: rel.end_date || null, ended: !!rel.ended, removed: rel._status === 3 });
    });
    return out;
  }
  const releaseEntity = () => { try { const re = RE(); return re && (re.state.entity || re.state.release) || null; } catch (e) { return null; } };
  // #365 (1) copy/move the release's own credits onto its recordings (the ticked ones, or all if none ticked)
  function openRelToRec(anchor) {
    const srcRels = releaseCreditRels().filter(r => !r.removed);
    const selTr = [...document.querySelectorAll('tr.track')].filter(tr => { const cb = tr.querySelector('input.recording'); return cb && cb.checked; });
    const dests = (selTr.length ? selTr : [...document.querySelectorAll('tr.track')]).map(recordingEntity).filter(Boolean);
    const where = selTr.length ? `${dests.length} selected recording${dests.length > 1 ? 's' : ''}` : `all ${dests.length} recordings`;
    // #365 cleansing — release-level / packaging roles that don't belong on a recording start UNTICKED
    // (re-tick to override). Matched as substrings against the role label.
    const CLEANSE = ['liner note', 'compiler', 'mastering', 'remaster', 'artwork', 'art direction', 'design', 'illustration', 'photograph', 'graphic', 'manufactured', 'pressed by', 'printed by', 'booklet', 'translat', 'lacquer', 'publish', 'copyright', 'booking', '℗', '©'];
    const entries = srcRels.map(s => { const lbl = (roleLabelOf(s) || '').toLowerCase(); return { rel: s, role: roleKeyOfSpec(s), pos: roleLabelOf(s), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : ''), checked: !CLEANSE.some(k => lbl.includes(k)) }; });
    const chosen = () => entries.filter(e => e.cb ? e.cb.checked : e.checked !== false).map(e => e.rel);
    const r = anchor.getBoundingClientRect();
    if (!srcRels.length) { openMenu(r.left, r.bottom + 4, [{ header: 'No release-level credits to copy' }]); return; }
    if (!dests.length) { openMenu(r.left, r.bottom + 4, [{ header: 'No recordings on this release' }]); return; }
    const copyItem = { label: 'Copy', sub: String(chosen().length), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } const { n, skipped } = copyCreditsMapped(c, dests); if (n) markUsed(`Copied ${n} release credit${n > 1 ? 's' : ''} to ${where}`); toast(`Copied ${n} to ${where}${skipped ? ` · ${skipped} had no per-recording role` : ''} — review & save`); } };
    const moveItem = { label: 'Move (remove from release)', danger: true, run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } const { n } = copyCreditsMapped(c, dests); c.forEach(s => { try { const rm = s.item.querySelector('button.remove-item, button.icon.remove-item'); rm && rm.click(); } catch (e) {} }); if (n) markUsed(`Moved ${n} release credit${n > 1 ? 's' : ''} to ${where}`); toast(`Moved ${n} to ${where} — review & save`); } };
    openMenu(r.left, r.bottom + 4, [{ header: `Copy release credits → ${where}` }, { checklist: entries, onToggle: () => copyItem._setSub && copyItem._setSub(String(chosen().length)) }, copyItem, moveItem]);
  }
  // #365 (2) collect the recordings' credits onto the release — a UNION across all tracks (dedup by
  // role+artist+credit), each row showing the track range it covers (* = every track).
  function openRecToRel(anchor) {
    const rel = releaseEntity();
    const r = anchor.getBoundingClientRect();
    if (!rel || rel.id == null) { openMenu(r.left, r.bottom + 4, [{ header: 'Release not ready' }]); return; }
    const total = document.querySelectorAll('tr.track').length, byKey = new Map();
    document.querySelectorAll('tr.track').forEach(tr => {
      const pos = trackPosOfRow(tr);
      recordingRels(tr).filter(s => !s.removed && s.other && ['artist', 'label'].includes(s.other.entityType)).forEach(s => {
        const key = roleKeyOfSpec(s) + '|' + (val(s.other.gid) || '') + '|' + (s.credit || '');
        let e = byKey.get(key);
        if (!e) { e = { rel: s, roleLbl: roleLabelOf(s), other: s.other, credit: s.credit, tracks: new Set(), items: [] }; byKey.set(key, e); }
        if (pos != null) e.tracks.add(pos); e.items.push(s.item);
      });
    });
    const trkLbl = set => (set.size && set.size >= total) ? '*' : ranges(set);
    const entries = [...byKey.values()].map(e => ({ _e: e, role: e.rel.linkTypeID + '#' + e.roleLbl, pos: e.roleLbl, text: `${trkLbl(e.tracks)}  ${val(e.other.name)}${e.credit && e.credit !== val(e.other.name) ? ` (${e.credit})` : ''}` }));
    const chosen = () => entries.filter(x => x.cb ? x.cb.checked : true);
    if (!entries.length) { openMenu(r.left, r.bottom + 4, [{ header: 'No recording credits to collect' }]); return; }
    const copyItem = { label: 'Copy', sub: String(chosen().length), run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } const { n, skipped } = copyCreditsMapped(c.map(x => x._e.rel), [rel]); if (n) markUsed(`Collected ${n} credit${n > 1 ? 's' : ''} onto the release`); toast(`Added ${n} to the release${skipped ? ` · ${skipped} had no release role` : ''} — review & save`); } };
    const moveItem = { label: 'Move (remove from recordings)', danger: true, run: () => { const c = chosen(); if (!c.length) { toast('No credits selected'); return; } const { n } = copyCreditsMapped(c.map(x => x._e.rel), [rel]); c.forEach(x => x._e.items.forEach(it => { try { const rm = it.querySelector('button.remove-item, button.icon.remove-item'); rm && rm.click(); } catch (e) {} })); if (n) markUsed(`Moved ${n} credit${n > 1 ? 's' : ''} from recordings onto the release`); toast(`Moved ${n} onto the release — review & save`); } };
    openMenu(r.left, r.bottom + 4, [{ header: 'Collect recording credits → the release (union)' }, { checklist: entries, onToggle: () => copyItem._setSub && copyItem._setSub(String(chosen().length)) }, copyItem, moveItem]);
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
  // #372 standard config window — title bar (icon + name + version + Help) then a body of options,
  // matching the other userscripts' settings dialogs.
  function openAboutPopover(anchor) {
    closePopover();
    popEl = el('div', 'gt-pop gt-cfg-pop');
    const hd = el('div', 'gt-cfg-hd');
    const ic = el('img', 'gt-cfg-ic'); ic.src = 'https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/group_therapy/icon.svg'; ic.width = 20; ic.height = 20; ic.alt = ''; ic.onerror = () => ic.remove();
    hd.append(ic, el('span', 'gt-cfg-name', 'Group Therapy'), el('span', 'gt-cfg-ver', 'v' + VERSION));
    const help = el('a', 'gt-cfg-help', '? Help'); help.href = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/group_therapy'; help.target = '_blank'; help.rel = 'noopener'; hd.appendChild(help);
    popEl.appendChild(hd);
    const body = el('div', 'gt-cfg-body');
    const opt = (label, hint, get, set) => { const l = el('label', 'gt-cfg-opt'); l.title = hint; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = get(); cb.onchange = () => set(cb.checked); l.append(cb, el('span', null, label)); return l; };
    body.appendChild(opt('Hide help text', 'Hide the two MusicBrainz help paragraphs at the top of the edit-relationships page', () => gtHideHelp, v => { gtHideHelp = v; try { GM_setValue('gt-hide-help', v); } catch (e) {} gtApplyHelp(); }));
    body.appendChild(opt('Auto-match on start', 'Open the work matcher and run matching automatically when the page loads', () => gtAutoMatch, v => { gtAutoMatch = v; try { GM_setValue('gt-auto-match', v); } catch (e) {} }));
    popEl.appendChild(body);
    document.body.appendChild(popEl);
    const a = anchor.getBoundingClientRect(), r = popEl.getBoundingClientRect();
    popEl.style.left = Math.max(8, Math.min(a.right - r.width, window.innerWidth - r.width - 8)) + 'px';
    popEl.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onPopDown, true); document.addEventListener('keydown', onPopKey, true); }, 0);
  }
  function injectCloneButton() {
    const content = document.getElementById('content'); if (!content) return false;
    if (content.querySelector('.gt-toolbar')) { gtApplyHelp(); return true; }
    // wait until the relationship editor has rendered (its heading is the readiness signal)
    if (![...document.querySelectorAll('h2')].some(h => /^\s*Release relationships/i.test(h.textContent || ''))) return false;
    const bar = el('div', 'gt-toolbar');
    const b = el('button', 'gt-clone-btn', '⧉ Copy from release…');
    b.title = 'Copy release-level credits (artists, labels) from another release onto this one';
    b.type = 'button'; b.onclick = () => openCopyFromPopover(b); bar.appendChild(b); cloneBtnRef = b;
    const cons = el('button', 'gt-clone-btn', '▦ Consolidate RG…');
    cons.title = 'Spread release-level credits across every release in this group (union minus format-specific)';
    cons.type = 'button'; cons.onclick = () => openConsolidate(); bar.appendChild(cons);
    const wm = el('button', 'gt-clone-btn', '◎ Match works…');
    wm.title = 'Match each recording to an existing MusicBrainz work (via ISRC + title/artist siblings) and stage recording→work “performance” relationships';
    wm.type = 'button'; wm.onclick = () => openWorkMatch(); bar.appendChild(wm);
    // #365 one "Vertical:" section — ⬆ pushes the release's credits DOWN to its recordings, ⬇ pulls the
    // recordings' credits UP to the release (icons per majkinetor: up = release→recordings, down = →release)
    const vwrap = el('span', 'gt-vert');
    vwrap.appendChild(el('span', 'gt-vert-lbl', 'Vertical:'));
    const r2r = el('button', 'gt-clone-btn gt-vert-btn', '⬆');
    r2r.title = 'Release → recordings: copy (or move) the release-level credits onto its recordings — the ticked ones, or all if none ticked';
    r2r.type = 'button'; r2r.onclick = () => openRelToRec(r2r);
    const c2r = el('button', 'gt-clone-btn gt-vert-btn', '⬇');
    c2r.title = 'Recordings → release: collect the recordings’ credits onto the release — a union across all tracks (shows the track range each covers)';
    c2r.type = 'button'; c2r.onclick = () => openRecToRel(c2r);
    vwrap.append(r2r, c2r); bar.appendChild(vwrap);
    const cfg = el('button', 'gt-cfg-btn', '⚙'); cfg.type = 'button'; cfg.title = 'Group Therapy — options, about / help';
    cfg.onclick = () => openAboutPopover(cfg); bar.appendChild(cfg);
    // #372 the toolbar goes at the top of the tab (right after the entity tabs), not on the heading
    const tabs = content.querySelector(':scope > .tabs');
    content.insertBefore(bar, tabs ? tabs.nextSibling : content.firstChild);
    gtApplyHelp();
    // #372 auto-open + match — but skip it when every recording already has a work (nothing to do)
    if (gtAutoMatch) setTimeout(() => { try { if (wmRecordings().some(r => !r.hasWorkOnPage)) openWorkMatch(); } catch (e) {} }, 500);
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
  // #371 the link type alone is generic ("instrument"); the specific instrument (guitar, tuba, drums …)
  // lives in the attributes — resolve their names so every instrument row is distinguishable, matching
  // roleLabelOf. Consolidation rels come from /ws/js (plain array, typeID only), so resolve via linkedEntities.
  const consRole = r => {
    const base = ltName(r.linkTypeID), lat = W.MB.linkedEntities && W.MB.linkedEntities.link_attribute_type;
    const parts = (r.attributes || []).map(a => { const nm = (a.type && a.type.name) || (lat && lat[a.typeID] && lat[a.typeID].name); return nm ? (a.text_value ? `${nm}: ${a.text_value}` : nm) : null; }).filter(Boolean);
    return parts.length ? `${base} (${parts.join(', ')})` : base;
  };
  const consLabel = r => {
    const ent = r.target_type === 'url' ? (r.target.name || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') : (r.target.name || '?');
    const credit = (r.entity0_credit && r.entity0_credit !== r.target.name && r.entity0_credit) || (r.entity1_credit && r.entity1_credit !== r.target.name && r.entity1_credit) || '';
    return { role: consRole(r), ent, credit };
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
    return okEdits;
  }
  // #372 after applying, jump to the Release relationships section so the new release-level credits are in view
  function gtScrollToReleaseRels() {
    const h2 = [...document.querySelectorAll('h2')].find(h => /^\s*Release relationships/i.test(h.textContent || ''));
    if (h2) try { h2.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { h2.scrollIntoView(); }
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
    applyBtn.onclick = async () => { const n = await applyConsolidation(cols, rows, () => renderConsMatrix(ctx)); if (n) { closeConsolidate(); gtScrollToReleaseRels(); } };   // #372 close + focus the release rels
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

  // ══ Work matching (#363) ═══════════════════════════════════════════════════
  // Match each recording to an EXISTING MB work and stage a recording→work "performance" rel.
  // Disambiguation is the whole problem — a bare standard title ("St. Louis Blues") matches many works.
  // Two signals: (1) works of ISRC-sharing recordings — an /isrc LOOKUP returns work-rels (a /recording
  // SEARCH does not), the strongest when ISRCs exist; and (2) a WORK title search ranked by MB's own
  // score — the canonical work (bare title) scores ~100 while arrangements trail and are disambiguated,
  // so the top score + the gap to the runner-up say whether to auto-tick or leave it for a manual pick.
  const PERF_GID = 'a3005666-a872-32c3-ad06-98af558e99b0';   // recording→work "performance" link type
  // colours mirror Apollo's recording matcher (CONF_COLOR)
  const WM_LEVEL = { exact:{ c:'#2f6fd6', t:'ISRC-confirmed' }, tolerance:{ c:'#86c686', t:'the only work with this title' }, near:{ c:'#fff176', t:'dominant — most-recorded work' }, low:{ c:'#e5534b', t:'ambiguous — often wrong, check it' }, none:{ c:'#9aa0a6', t:'no work found' } };
  const WM_RANK = { exact:0, tolerance:1, near:2, low:3, none:4 };
  const WM_LVL_BY_RANK = ['exact', 'tolerance', 'near', 'low'];
  // how far ⚡ Match / the initial pre-tick reaches down the confidence ladder (persisted)
  let wmCutoff = (() => { try { const v = GM_getValue('gt-wm-cutoff', WM_RANK.near); return typeof v === 'number' ? v : WM_RANK.near; } catch (e) { return WM_RANK.near; } })();
  // #372 page options (persisted): hide MB's edit-relationships help text (on by default), and auto-open +
  // run the work matcher on page load (off by default).
  let gtHideHelp = (() => { try { return GM_getValue('gt-hide-help', true) !== false; } catch (e) { return true; } })();
  let gtAutoMatch = (() => { try { return GM_getValue('gt-auto-match', false) === true; } catch (e) { return false; } })();
  // the two help paragraphs are the only direct-child <p> of #content (the batch-tools hint + the guidelines
  // link) — a stable selector even after we insert our toolbar, since that's a <div>.
  const gtApplyHelp = () => { document.querySelectorAll('#content > p').forEach(p => { p.style.display = gtHideHelp ? 'none' : ''; }); };
  // writer/composer relationship types — used to pull authors from a pasted work MBID (the autocomplete
  // already carries authors inline for searched works)
  const WM_WRITER_RE = /composer|writer|lyricist|librettist|translat|revis|arrang|orchestrat/i;
  // create a synthetic NEW work (negative id, no gid) — MB's submit creates it like a natively-added work
  // (verified: the reducer accepts it and renders a pending new-work rel). Same-title new works within a
  // session share one entity, so two unmatched same-title tracks don't spawn duplicate works.
  let wmNewSeq = -1000000;
  const wmNewWorks = new Map();
  // #363 optional params applied to every new work created this session — Type + lyrics language(s), like
  // MB's own "Batch-add new works" dialog. Both catalogues live on the page (MB.linkedEntities), so there's
  // no pagination/fetch: cache them once for the searchable combos. Choices are NOT persisted (per maintainer).
  let _wmTypesCache = null, _wmLangsCache = null;
  const wmWorkTypes = () => (_wmTypesCache || (_wmTypesCache = Object.values((W.MB.linkedEntities && W.MB.linkedEntities.work_type) || {}).slice().sort((a, b) => a.name.localeCompare(b.name))));
  const wmLanguages = () => (_wmLangsCache || (_wmLangsCache = Object.values((W.MB.linkedEntities && W.MB.linkedEntities.language) || {}).filter(l => l.frequency > 0 || l.name).sort((a, b) => (b.frequency - a.frequency) || a.name.localeCompare(b.name))));
  let wmNewType = null;      // work-type id (number) or null
  let wmNewLangs = [];       // array of MB language objects
  const wmLangRels = () => wmNewLangs.map(l => ({ language: l, last_updated: null }));   // MB's work.languages shape
  // #363 attributes + dates that go on the recording→work "recording of" RELATIONSHIP (not the work) —
  // acappella/cover/demo/instrumental/karaoke/live/medley/partial + begin/end date + ended. Eligible
  // attributes are read from the performance link type itself, so we track whatever MB currently allows.
  const wmRelAttrs = new Set();   // selected attribute typeIDs
  let wmBegin = { year: null, month: null, day: null }, wmEnd = { year: null, month: null, day: null }, wmEnded = false;
  let _wmPerfAttrsCache = null;
  const wmPerfAttrs = () => (_wmPerfAttrsCache || (_wmPerfAttrsCache = (() => {
    const le = W.MB.linkedEntities, lat = le && le.link_attribute_type, perf = le && Object.values(le.link_type || {}).find(t => t.gid === PERF_GID);
    if (!perf || !perf.attributes || !lat) return [];
    return Object.keys(perf.attributes).map(k => { const id = perf.attributes[k].type_id || +k; return { typeID: id, name: lat[id] && lat[id].name }; }).filter(a => a.name).sort((a, b) => a.name.localeCompare(b.name));
  })()));
  const wmHasDates = () => !!(wmBegin.year || wmBegin.month || wmBegin.day || wmEnd.year || wmEnd.month || wmEnd.day || wmEnded);
  // the attribute tree + dates object to hand dispatchRelationship for a recording→work rel
  const wmRelExtras = () => ({
    attrs: wmRelAttrs.size ? buildAttrTree([...wmRelAttrs].map(id => ({ typeID: id }))) : null,
    dates: wmHasDates() ? { begin_date: wmBegin, end_date: wmEnd, ended: wmEnded } : null,
  });
  // push the current Type/language choice onto every new work already staged (params can change after some
  // were created — MB reads these off the entity on submit)
  function wmApplyNewParams() { wmNewWorks.forEach(w => { w.typeID = wmNewType; w.languages = wmLangRels(); }); }
  function wmMakeNewWork(title) {
    const key = (title || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (key && wmNewWorks.has(key)) return wmNewWorks.get(key);
    // Mirror EXACTLY the entity MB's own "Batch-add new works" produces (captured from the reducer): a
    // negative id + empty-string gid, every field the editor reads present with an empty default, and the
    // `_fromBatchCreateWorksDialog` flag. That flag is what marks it as a to-be-created work — without it MB
    // rejected the target ("must select … target entity") and threw loading its relationships ("e is null").
    // typeID + languages carry the optional #363 params. MB creates the work for real on submit. (#363)
    const w = {
      entityType: 'work', id: wmNewSeq--, gid: '',
      name: title || '[untitled]', comment: '', typeID: wmNewType,
      languages: wmLangRels(), iswcs: [], attributes: [],
      artists: [], other_artists: [], authors: [], editsPending: false, last_updated: null,
      _fromBatchCreateWorksDialog: true, _gtNew: true,
    };
    if (key) wmNewWorks.set(key, w);
    return w;
  }
  // #363 the "New work options" controls in the matcher toolbar — a Type <select> and a searchable,
  // multi-select Lyrics-language combo (common languages first). Both catalogues are already on the page.
  function wmNewParamsUi() {
    const wrap = el('div', 'gt-wm-nwp');
    const typeSel = el('select', 'gt-wm-nwp-type'); typeSel.title = 'Work type applied to every new work';
    typeSel.appendChild(new Option('— type —', ''));
    wmWorkTypes().forEach(t => { const o = new Option(t.name, String(t.id)); if (t.id === wmNewType) o.selected = true; typeSel.appendChild(o); });
    typeSel.onchange = () => { wmNewType = typeSel.value ? +typeSel.value : null; wmApplyNewParams(); };
    wrap.appendChild(typeSel);
    const lc = el('div', 'gt-wm-nwp-lang'); lc.title = 'Lyrics language(s) applied to every new work';
    const chips = el('span', 'gt-wm-nwp-chips'), inp = el('input', 'gt-wm-nwp-inp');
    inp.placeholder = 'lyrics language…'; inp.spellcheck = false;
    let drop = null;
    const onDown = e => { if (!lc.contains(e.target)) closeDrop(); };
    function closeDrop() { if (drop) { drop.remove(); drop = null; document.removeEventListener('mousedown', onDown, true); } }
    function renderChips() {
      chips.textContent = '';
      wmNewLangs.forEach(l => { const c = el('span', 'gt-wm-nwp-chip', l.name); const x = el('span', 'gt-wm-nwp-x', '×'); x.title = 'remove'; x.onclick = () => { wmNewLangs = wmNewLangs.filter(o => o !== l); wmApplyNewParams(); renderChips(); }; c.appendChild(x); chips.appendChild(c); });
    }
    function showDrop() {
      closeDrop();
      const q = inp.value.trim().toLowerCase(), picked = new Set(wmNewLangs.map(l => l.id));
      const list = wmLanguages().filter(l => !picked.has(l.id) && (!q || l.name.toLowerCase().includes(q)));
      if (!list.length) return;
      drop = el('div', 'gt-wm-nwp-drop');
      list.slice(0, 50).forEach(l => { const it = el('div', 'gt-wm-nwp-opt', l.name); it.onmousedown = e => { e.preventDefault(); wmNewLangs.push(l); wmApplyNewParams(); renderChips(); inp.value = ''; showDrop(); inp.focus(); }; drop.appendChild(it); });
      lc.appendChild(drop); document.addEventListener('mousedown', onDown, true);
    }
    inp.oninput = showDrop; inp.onfocus = showDrop;
    inp.onkeydown = e => { if (e.key === 'Escape' && drop) { closeDrop(); e.stopPropagation(); } };
    lc.append(chips, inp); wrap.appendChild(lc); renderChips();
    const more = el('button', 'gt-wm-nwp-more', '⋯'); more.type = 'button'; more.title = 'recording-of relationship options — attributes (live, cover…) + dates';
    more.onclick = () => wmRelOptsPopover(more); wrap.appendChild(more);
    return wrap;
  }
  // #363 the recording-of relationship options popover (opened by the ⋯ button): the performance
  // attributes as checkboxes + begin/end date + ended. These go on the recording→work rel, not the work.
  let wmRoPop = null;
  function closeRoPop() { if (wmRoPop) { wmRoPop.remove(); wmRoPop = null; document.removeEventListener('mousedown', wmRoDown, true); document.removeEventListener('keydown', wmRoKey, true); } }
  function wmRoDown(e) { if (wmRoPop && !wmRoPop.contains(e.target) && !e.target.classList.contains('gt-wm-nwp-more')) closeRoPop(); }
  function wmRoKey(e) { if (e.key === 'Escape' && wmRoPop) { e.stopPropagation(); closeRoPop(); } }
  function wmRelOptsPopover(anchor) {
    if (wmRoPop) { closeRoPop(); return; }
    const pop = el('div', 'gt-wm-relopts'); wmRoPop = pop;
    pop.appendChild(el('div', 'gt-wm-ro-hd', 'recording of'));
    wmPerfAttrs().forEach(a => {
      const lb = el('label', 'gt-wm-ro-cb'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = wmRelAttrs.has(a.typeID);
      cb.onchange = () => { if (cb.checked) wmRelAttrs.add(a.typeID); else wmRelAttrs.delete(a.typeID); };
      lb.append(cb, el('span', null, a.name)); pop.appendChild(lb);
    });
    const mkDate = (label, obj) => {
      const row = el('div', 'gt-wm-ro-date'); row.appendChild(el('span', 'gt-wm-ro-dl', label));
      const mk = (ph, key, cls) => { const i = el('input', cls); i.type = 'text'; i.placeholder = ph; i.value = obj[key] || ''; i.oninput = () => { const v = parseInt(i.value, 10); obj[key] = Number.isFinite(v) ? v : null; }; return i; };
      row.append(mk('YYYY', 'year', 'gt-wm-ro-y'), el('span', 'gt-wm-ro-sep', '‑'), mk('MM', 'month', 'gt-wm-ro-m'), el('span', 'gt-wm-ro-sep', '‑'), mk('DD', 'day', 'gt-wm-ro-d')); return row;
    };
    pop.appendChild(mkDate('Begin date', wmBegin));
    pop.appendChild(mkDate('End date', wmEnd));
    const endedL = el('label', 'gt-wm-ro-cb'); const endedCb = document.createElement('input'); endedCb.type = 'checkbox'; endedCb.checked = wmEnded;
    endedCb.onchange = () => { wmEnded = endedCb.checked; }; endedL.append(endedCb, el('span', null, 'This relationship has ended.')); pop.appendChild(endedL);
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(r.left, window.innerWidth - pop.offsetWidth - 8) + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', wmRoDown, true); document.addEventListener('keydown', wmRoKey, true); }, 0);
  }
  // proactively space WS2 calls so a long tracklist doesn't burst past the ~1 req/s limit and drop the
  // tail to 503s (which surfaced as false "no match"). Serialised through a single timestamp.
  let _wmNext = 0;
  async function wmGate() { const now = Date.now(); const at = Math.max(now, _wmNext); _wmNext = at + 380; if (at > now) await sleep(at - now); }
  let wmAbort = null, wmRunning = false;   // #372 cancel aborts in-flight matching fetches; wmRunning drives the "matching…" row state
  async function wmJson(url) {
    const sig = wmAbort && wmAbort.signal;
    for (let i = 0; i < 5; i++) {
      if (sig && sig.aborted) return null;   // cancelled — stop retrying / sleeping
      try {
        if (url.startsWith('/ws/2/')) await wmGate();   // only the public API is rate-limited; /ws/js is the editor's own
        const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' }, signal: sig });
        if ((r.status === 429 || r.status === 503) && i < 4) { await sleep(900 * (i + 1)); continue; }   // rate limit — back off harder
        if (!r.ok) return null; return await r.json();
      } catch (e) { if ((sig && sig.aborted) || i === 4) return null; await sleep(500 * (i + 1)); }
    }
    return null;
  }
  // MB's internal work autocomplete — returns authors, artist-popularity (hits), type and disambiguation
  // inline, ranked by relevance, and it's the editor's own endpoint so it isn't on the /ws/2 rate limit.
  async function wmWorkSearch(term) {
    const j = await wmJson('/ws/js/work?q=' + encodeURIComponent(term) + '&direct=false&limit=10');
    const arr = Array.isArray(j) ? j : (j && j.results) || [];
    // authors (writers) + artist popularity live under related_artists.{authors,artists} — the top-level
    // w.authors / w.artists are empty
    return arr.filter(w => w && w.gid).map(w => { const ra = w.related_artists || {}; return { gid: w.gid, id: w.id, title: w.name, disambiguation: w.comment || '', type: w.typeName || '', authors: (ra.authors && ra.authors.results) || [], artists: (ra.artists && ra.artists.results) || [], pop: (ra.artists && ra.artists.hits) || 0 }; });
  }
  const wmNorm = s => (s || '').normalize('NFC').toLowerCase().replace(/[’‘']/g, "'").replace(/[‐‑‒–—―]/g, '-').replace(/…\s*/g, '…').replace(/\s+/g, ' ').trim();
  function performanceLtId() {
    const lt = W.MB && W.MB.linkedEntities && W.MB.linkedEntities.link_type; if (!lt) return null;
    for (const k in lt) if (lt[k] && lt[k].gid === PERF_GID) return lt[k].id != null ? lt[k].id : +k;
    return null;
  }
  // the release's recordings, from the rendered track rows (deduped); flag ones already work-linked on the page
  function wmRecordings() {
    const out = [], seen = new Set();
    document.querySelectorAll('tr.track').forEach(tr => {
      const rec = recordingEntity(tr); if (!rec) return;
      const key = (rec.gid || '') + '|' + rec.id; if (seen.has(key)) return; seen.add(key);
      const hasWork = recordingRels(tr).some(r => !r.removed && r.other && r.other.entityType === 'work');
      out.push({ tr, rec, pos: posLabel(tr) || '', title: val(rec.name) || '', hasWorkOnPage: hasWork });
    });
    return out;
  }
  // The recording entities on the page are lean (no artist credit), so the performer can't come from the
  // fiber. One release lookup fills every row's artist up front — independent of the per-row matching — so
  // the left column is populated immediately instead of trickling in as each match lands.
  async function wmPrefetchArtists(rows, draw) {
    const re = RE(); if (!re || !re.state || !re.state.entity) return;
    const j = await wmJson('/ws/2/release/' + re.state.entity.gid + '?inc=recordings+artist-credits&fmt=json');
    if (!j) return;
    const byGid = new Map();
    (j.media || []).forEach(m => (m.tracks || []).forEach(t => { const r = t.recording; if (r && r.id) byGid.set(r.id, (r['artist-credit'] || []).map(c => (c.name || (c.artist && c.artist.name) || '') + (c.joinphrase || '')).join('').trim()); }));
    let any = false;
    rows.forEach(row => { if (!row.artist) { const a = byGid.get(row.rec.gid); if (a) { row.artist = a; any = true; } } });
    if (any) draw();
  }
  // gather candidate works for one recording: ISRC-sibling works + the internal work autocomplete
  async function wmMatchOne(row) {
    const rec = row.rec;
    const self = await wmJson('/ws/2/recording/' + rec.gid + '?inc=artist-credits+isrcs+work-rels&fmt=json');
    if (self && self['artist-credit']) row.artist = self['artist-credit'].map(c => (c.name || (c.artist && c.artist.name) || '') + (c.joinphrase || '')).join('').trim();
    if (self && (self.relations || []).some(r => r.work)) { row.linked = true; return; }   // already linked
    const isrcs = (self && self.isrcs) || [];
    // compare exactness against both the full title and the title minus a trailing parenthetical, so
    // "Take My Breath Away (love theme…)" counts as an exact match of the work "Take My Breath Away"
    const bare = row.title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const tnorm = wmNorm(row.title), bnorm = wmNorm(bare);
    const isExact = t => { const n = wmNorm(t); return n === tnorm || (!!bnorm && n === bnorm); };
    // does the work's own writer/artist match the track's performer? A strong signal — e.g. the
    // "Overnight Success" work whose artist IS Teri DeSario should beat the generic same-titled ones.
    // split the performer credit into individual names so a duet matches regardless of order/join —
    // recording "Ann Wilson & Mike Reno" vs work artist "Mike Reno & Ann Wilson"
    const perfNames = wmNorm(row.artist || '').split(/\s*(?:&|,|;|\/|\bfeat\.?\b|\bfeaturing\b|\bwith\b|\bvs\.?\b|\band\b|\bx\b)\s*/).map(x => x.trim()).filter(x => x.length > 2);
    const nameHit = names => !!perfNames.length && (names || []).some(n => { const nn = wmNorm(n); return perfNames.some(p => nn.includes(p)); });
    const cands = new Map();   // workGid → { gid, id, title, disambiguation, type, authors, artists, pop, isrc, exact, artistMatch }
    const add = (w, isIsrc) => {
      if (!w || !w.gid) return;
      let e = cands.get(w.gid);
      if (!e) { e = { gid: w.gid, id: w.id != null ? w.id : null, title: w.title, disambiguation: w.disambiguation || '', type: w.type || '', authors: w.authors || [], artists: w.artists || [], pop: w.pop || 0, isrc: 0, exact: isExact(w.title) }; e.artistMatch = nameHit(e.authors) || nameHit(e.artists); cands.set(w.gid, e); }
      if (isIsrc) e.isrc++;
      if (!e.authors.length && w.authors && w.authors.length) e.authors = w.authors;
      if (!e.artists.length && w.artists && w.artists.length) e.artists = w.artists;
      if (!e.artistMatch) e.artistMatch = nameHit(e.authors) || nameHit(e.artists);
    };
    // ISRC-sharing recordings (the /isrc lookup returns work-rels, unlike a /recording search)
    for (const code of isrcs.slice(0, 3)) {
      const j = await wmJson('/ws/2/isrc/' + encodeURIComponent(code) + '?inc=work-rels&fmt=json');
      (j && j.recordings || []).forEach(r => (r.relations || []).forEach(rel => { if (rel.work) add({ gid: rel.work.id, id: null, title: rel.work.title, disambiguation: rel.work.disambiguation || '' }, true); }));
    }
    // work autocomplete — authors + artist-popularity inline, no per-work lookup. A DESCRIPTIVE trailing
    // parenthetical ("Take My Breath Away (love theme from “Top Gun”)") isn't part of the work title, so the
    // full title finds nothing → retry stripped. Titles where it IS part of the work ("You Spin Me Round
    // (Like a Record)") match on the full title and never hit the fallback.
    if (row.title) {
      let ws = await wmWorkSearch(row.title);
      if (!ws.length && bare && bare !== row.title) ws = await wmWorkSearch(bare);
      ws.forEach(w => add(w, false));
    }
    // rank: ISRC-confirmed → performer is on the work → exact-title → most-recorded (popularity)
    const list = [...cands.values()].sort((a, b) => (b.isrc - a.isrc) || ((b.artistMatch ? 1 : 0) - (a.artistMatch ? 1 : 0)) || (b.exact - a.exact) || (b.pop - a.pop));
    row.cands = list;
    if (!list.length) { row.level = 'none'; return; }
    const best = list[0], second = list[1];
    row.best = best; row.writers = best.authors || []; row.workArtists = best.artists || []; row.artistMatched = !!best.artistMatch;
    const exacts = list.filter(c => c.exact).length;
    if (best.isrc > 0) row.level = 'exact';                                            // ISRC-confirmed
    else if (best.exact && (best.artistMatch || exacts === 1)) row.level = 'tolerance';   // exact title + (performer is on the work | only one such work)
    else if (best.artistMatch || (best.exact && (!second || !second.exact || best.pop >= (second.pop || 0) * 2))) row.level = 'near';   // performer on the work, or exact + clearly most-used
    else row.level = 'low';                                                            // several plausible works — the user picks
    if (WM_RANK[row.level] <= wmCutoff) row.chosen = best;
  }
  function wmStyle() {
    if (document.getElementById('gt-wm-style')) return;
    const s = el('style'); s.id = 'gt-wm-style';
    s.textContent =
      // toolbar (clone of Apollo's .tc-rec-tb)
      // #372 sticky toolbar; #376 flush to the header + bled to the panel edges so nothing shows behind the gap
      '.gt-wm .gt-cons-body{padding-top:0}'
      + '.gt-wm-tb{display:flex;align-items:center;gap:8px;padding:9px 14px;flex-wrap:wrap;position:sticky;top:0;z-index:6;background:#fff;border-bottom:1px solid #ecebf3;margin:0 -14px 8px}'
      + '.gt-wm-tb .gt-wm-amstatus{color:#6f42c1;font-size:12px;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;padding-right:4px}'
      + '.gt-wm-tbl2{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#555}.gt-wm-tbl2 b{color:#563b8f}'
      + '.gt-wm-warn{color:#b00;font-weight:600;font-size:12px}.gt-wm-warn.click{cursor:pointer}.gt-wm-warn.click:hover{text-decoration:underline}'
      + '.gt-wm-cancel{font:12px Arial;color:#b00;background:#fff;border:1px solid #e3aeae;border-radius:12px;padding:1px 9px;cursor:pointer;flex:none}.gt-wm-cancel:hover{background:#fdecec}'
      + '.gt-wm-tbsep{width:1px;height:18px;background:#ddd;flex:none;margin:0 2px}'
      + '.gt-wm-btn{padding:4px 11px;border:1px solid transparent;border-radius:3px;background:transparent;cursor:pointer;font:13px Arial;color:#444}.gt-wm-btn:hover{background:linear-gradient(#fff,#eee);border-color:#bbb}'
      + '.gt-wm-btn:disabled,.gt-wm-caret:disabled{opacity:.45;cursor:default;pointer-events:none}'
      + '.gt-wm-btn.primary{color:#5f3ec0;font-weight:bold}.gt-wm-btn.primary:hover{background:linear-gradient(#7a52df,#5f3ec0);color:#fff;border-color:#4f33a3}'
      + '.gt-wm-caret{padding:4px 7px;color:#7d6bc0;border:1px solid transparent;border-radius:3px;background:transparent;cursor:pointer;font:13px Arial}.gt-wm-caret:hover{background:#f0ecfa}'
      // cutoff chip (clone of .tc-cutoff)
      + '.gt-wm-cutoff{display:inline-flex;align-items:center;gap:6px;border:1px solid #cfcfcf;border-radius:14px;padding:2px 9px;cursor:pointer;font:12px Arial;background:#fff;user-select:none}.gt-wm-cutoff:hover{border-color:#b3b3b3}'
      + '.gt-wm-cutoff-dot,.gt-wm-menu .dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.18);flex:none}.gt-wm-cutoff-caret{color:#999;font-size:10px}'
      + '.gt-wm-menu{position:fixed;z-index:2147483647;background:#fff;border:1px solid #ccc;border-radius:7px;box-shadow:0 8px 24px rgba(40,20,80,.22);padding:4px;font:13px Arial}'
      + '.gt-wm-menu .mi{display:flex;align-items:center;gap:9px;padding:5px 11px 5px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;color:#333}.gt-wm-menu .mi:hover,.gt-wm-menu .mi.sel{background:#f0ecfa}'
      // table (clone of .tc-rectbl)
      + '.gt-wm-tbl{border-collapse:collapse;width:100%;background:#fff;table-layout:fixed}'
      + '.gt-wm-tbl th{text-align:left;font-size:11px;color:#777;border-bottom:1px solid #ccc;padding:4px 7px;white-space:nowrap}'
      + '.gt-wm-tbl td{padding:4px 7px;vertical-align:top;font-size:13px}'
      + '.gt-wm-tbl .c-n{color:#999;text-align:right;width:38px;white-space:nowrap}'
      + '.gt-wm-tbl .c-sep{width:20px;text-align:center;border-left:1px solid #e6e0f2;border-right:1px solid #e6e0f2}'
      + '.gt-wm-tbl .tc-grp-l{background:#eef3fb;color:#2c5d9b}.gt-wm-tbl .tc-grp-r{background:#f1ecf9;color:#5b3fa0}'
      + '.gt-wm-dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.15)}'
      + '.gt-wm-tkt{font-weight:600}.gt-wm-tka{color:#555}'
      + '.gt-wm-wk{position:relative}.gt-wm-wa{color:#2c5d9b;font-weight:600;text-decoration:none;cursor:pointer}.gt-wm-wa:hover{text-decoration:underline}'
      + '.gt-wm-none{color:#c0392b;cursor:pointer}.gt-wm-none:hover{text-decoration:underline}.gt-wm-newtag{color:#2c7a51;cursor:pointer}'
      + '.gt-wm-disamb{color:#999;font-weight:400}.gt-wm-authors{color:#777;font-size:12px}.gt-wm-dim{color:#999;font-style:italic}.gt-wm-linked{color:#2c7a51}'
      + '.gt-wm-wwr{color:#777}.gt-wm-wart{display:block;color:#8a8f98;font-size:11px;margin-top:1px}'
      + '.gt-wm-acts{position:absolute;right:2px;top:2px;display:none;gap:2px}.gt-wm-row:hover .gt-wm-acts{display:inline-flex}'
      + '.gt-wm-act{border:none;background:#fff;cursor:pointer;color:#7d6bc0;font-size:13px;line-height:1;padding:1px 5px;border-radius:3px}.gt-wm-act:hover{background:#f0ecfa}'
      // picker (kept)
      + '.gt-wm-pop{position:fixed;z-index:2147483647;background:#fff;color:#222;border:1px solid #d4d9e0;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:8px;min-width:360px;max-width:480px;font:13px -apple-system,Segoe UI,Arial,sans-serif}'
      + '.gt-wm-qrow{display:flex;align-items:stretch;gap:6px;margin:4px 0 6px}'
      + '.gt-wm-q{flex:1 1 auto;min-width:0;box-sizing:border-box;padding:4px 6px}.gt-wm-results{max-height:300px;overflow:auto}'
      + '.gt-wm-newplus{flex:none;width:40px;font-size:17px;line-height:1;color:#2c7a51;background:#eaf6ee;border:1px solid #bfe0c8;border-radius:5px;cursor:pointer}.gt-wm-newplus:hover{background:#daeee1}'
      + '.gt-wm-res{padding:4px 6px;border-radius:5px;cursor:pointer}.gt-wm-res:hover{background:#eef1f6}.gt-wm-rt{font-size:13px}'
      + '.gt-wm-rw{color:#777;font-size:12px;margin-left:4px}.gt-wm-sub{color:#6b7280;font-size:11px;margin:-2px 0 5px 2px}'
      + '.gt-wm-open{margin-left:6px;color:#2c5d9b;text-decoration:none;font-size:12px}.gt-wm-open:hover{text-decoration:underline}'
      + '.gt-wm-cur{margin:2px 0 6px;padding:4px 7px;background:#f6f3fc;border-radius:5px;font-size:12px}.gt-wm-cur-l{color:#777}'
      + '.gt-wm-new{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:5px;border:1px dashed rgba(127,127,127,.5);border-radius:5px;background:transparent;color:inherit;cursor:pointer}.gt-wm-new:hover{background:rgba(127,127,127,.15)}'
      // #363 New-work params (Type + searchable lyrics-language combo) in the footer
      + '.gt-wm-nwp{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#555}'
      + '.gt-wm-nwp-more{padding:2px 6px;border:1px solid #cfcfcf;border-radius:4px;background:#fff;color:#6f42c1;cursor:pointer;font:13px Arial;line-height:1}.gt-wm-nwp-more:hover{background:#f0ecfa}'
      + '.gt-wm-nwp-type{font:12px Arial;padding:2px 4px;border:1px solid #cfcfcf;border-radius:4px;background:#fff;max-width:130px}'
      + '.gt-wm-nwp-lang{position:relative;display:inline-flex;align-items:center;flex-wrap:wrap;gap:3px;min-width:120px;max-width:240px;border:1px solid #cfcfcf;border-radius:4px;background:#fff;padding:2px 4px}'
      + '.gt-wm-nwp-chip{display:inline-flex;align-items:center;gap:3px;background:#efeaf9;color:#5b4a86;border-radius:9px;padding:1px 4px 1px 7px;font-size:11px;white-space:nowrap}'
      + '.gt-wm-nwp-x{cursor:pointer;color:#8a7fb0;font-weight:700;line-height:1}.gt-wm-nwp-x:hover{color:#c0392b}'
      + '.gt-wm-nwp-inp{border:none;outline:none;background:transparent;font:12px Arial;min-width:60px;flex:1 1 60px}'
      + '.gt-wm-nwp-drop{position:absolute;left:0;top:100%;z-index:5;margin-top:2px;max-height:220px;overflow:auto;min-width:160px;background:#fff;border:1px solid #cfcfcf;border-radius:5px;box-shadow:0 4px 14px rgba(0,0,0,.15)}'
      + '.gt-wm-nwp-opt{padding:4px 9px;cursor:pointer;font-size:12px;white-space:nowrap}.gt-wm-nwp-opt:hover{background:#f0ecfa}'
      // #363 recording-of relationship options popover
      + '.gt-wm-relopts{position:fixed;z-index:2147483647;background:#fff;border:1px solid #cbb9ea;border-radius:6px;box-shadow:0 6px 20px rgba(40,20,80,.22);padding:8px 12px;font-size:13px;color:#333;min-width:190px}'
      + '.gt-wm-ro-hd{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#8a8496;margin-bottom:5px}'
      + '.gt-wm-ro-cb{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer}.gt-wm-ro-cb input{margin:0}'
      + '.gt-wm-ro-date{display:flex;align-items:center;gap:3px;margin-top:5px}'
      + '.gt-wm-ro-dl{width:66px;color:#666;font-size:12px;text-align:right;margin-right:4px}'
      + '.gt-wm-ro-y{width:44px}.gt-wm-ro-m,.gt-wm-ro-d{width:30px}.gt-wm-relopts input[type=text]{border:1px solid #cfcfcf;border-radius:3px;padding:2px 3px;font:12px Arial;text-align:center}'
      + '.gt-wm-ro-sep{color:#999}';
    document.head.appendChild(s);
  }
  let wmEl = null;
  function onWmKey(e) { if (e.key === 'Escape') { if (popEl) return; e.stopPropagation(); closeWorkMatch(); } }   // let an open picker take Escape first
  function closeWorkMatch() { closeRoPop(); if (wmAbort) { try { wmAbort.abort(); } catch (e) {} } wmRunning = false; if (wmEl) { wmEl.remove(); wmEl = null; document.removeEventListener('keydown', onWmKey, true); } }
  async function openWorkMatch() {
    closeWorkMatch(); closePopover(); wmStyle();
    const re = RE(); if (!re) { toast('Open the relationship editor first'); return; }
    if (performanceLtId() == null) { toast('Could not resolve the “performance” link type'); return; }
    wmEl = el('div', 'gt-cons-ov'); const panel = el('div', 'gt-cons gt-wm'), hdr = el('div', 'gt-cons-hdr');
    hdr.appendChild(el('span', 'gt-cons-title', 'Match recordings to works'));
    const x = el('button', 'gt-cons-x', '✕'); x.type = 'button'; x.onclick = closeWorkMatch; hdr.appendChild(x);
    const body = el('div', 'gt-cons-body'), foot = el('div', 'gt-cons-foot');
    body.appendChild(el('div', 'gt-pop-note', 'Reading recordings…'));
    panel.append(hdr, body, foot); wmEl.appendChild(panel); document.body.appendChild(wmEl);
    document.addEventListener('keydown', onWmKey, true);
    wmEl.addEventListener('mousedown', e => { if (e.target === wmEl) closeWorkMatch(); });
    const note = m => { const n = body.querySelector('.gt-pop-note'); if (n) n.textContent = m; };
    const rows = wmRecordings();
    if (!rows.length) { note('No recordings found on this release.'); return; }
    const api = renderWorkMatch(body, foot, rows);   // show the whole matrix at once — rows start "matching…"
    wmPrefetchArtists(rows, api.draw);   // fill every performer name from one release lookup, before matching
    api.runMatch();   // #372 the initial pass (and ⚡ Match afterwards) go through the same re-runnable, cancellable path
  }
  // floating menu near an anchor (cutoff options / caret actions), Apollo-style
  function wmFloatMenu(anchor, items) {
    const m = el('div', 'gt-wm-menu');
    const close = () => { m.remove(); document.removeEventListener('mousedown', onDown, true); };
    const onDown = e => { if (!m.contains(e.target)) close(); };
    items.forEach(it => { const mi = el('div', 'mi' + (it.sel ? ' sel' : '')); if (it.dot) { const d = el('span', 'dot'); d.style.background = it.dot; mi.appendChild(d); } mi.appendChild(document.createTextNode(it.label)); mi.onclick = () => { close(); it.run(); }; m.appendChild(mi); });
    document.body.appendChild(m);
    const a = anchor.getBoundingClientRect(), r = m.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(a.left, window.innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 6) + 'px';
    setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);
  }
  // interface mirrors Apollo's Recordings matcher: no checkboxes — a row is resolved (has a work) or not;
  // Apply stages every resolved row; the toolbar carries the cutoff chip, an unresolved count, and ⚡ Match.
  function renderWorkMatch(body, foot, rows) {
    body.textContent = ''; foot.textContent = '';
    const mkAct = (glyph, title, run) => { const b = el('button', 'gt-wm-act', glyph); b.type = 'button'; b.title = title; b.onclick = e => { e.stopPropagation(); run(); }; return b; };
    // ── toolbar ──
    const tb = el('div', 'gt-wm-tb');
    const amstatus = el('span', 'gt-wm-amstatus');
    const cutWrap = el('label', 'gt-wm-tbl2'); cutWrap.appendChild(el('b', null, 'Cutoff'));
    const chip = el('span', 'gt-wm-cutoff'); chip.tabIndex = 0; chip.title = 'lowest confidence that ⚡ Match still resolves';
    const chipDot = el('span', 'gt-wm-cutoff-dot'), chipLbl = el('span', 'gt-wm-cutoff-lbl');
    chip.append(chipDot, chipLbl, el('span', 'gt-wm-cutoff-caret', '▾')); cutWrap.appendChild(chip);
    const paintChip = () => { const lvl = WM_LVL_BY_RANK[wmCutoff] || 'near'; chipDot.style.background = WM_LEVEL[lvl].c; chipLbl.textContent = lvl; };
    paintChip();
    const warn = el('span', 'gt-wm-warn');
    let cancelled = false;   // #372 cancel an ongoing match without closing the matcher
    const cancelBtn = el('button', 'gt-wm-cancel', '✕ cancel'); cancelBtn.type = 'button'; cancelBtn.title = 'stop matching (keeps what has matched so far)'; cancelBtn.style.display = 'none';
    cancelBtn.onclick = () => { cancelled = true; if (wmAbort) { try { wmAbort.abort(); } catch (e) {} } cancelBtn.style.display = 'none'; };   // abort in-flight fetches so it stops immediately
    const matchBtn = el('button', 'gt-wm-btn primary', '⚡ Match'); matchBtn.type = 'button'; matchBtn.title = 'resolve every unresolved track whose best match is at/above the cutoff';
    const matchCaret = el('button', 'gt-wm-caret', '▾'); matchCaret.type = 'button'; matchCaret.title = 'more actions';
    matchCaret.onclick = () => wmFloatMenu(matchCaret, [{ label: 'Clear all', run: () => { rows.forEach(r => { r.chosen = null; }); draw(); updatePlan(); } }]);
    // #363 new-work options on the left; matched status + cutoff + Match (with a caret menu for Clear) on the right
    tb.append(wmNewParamsUi(), amstatus, cancelBtn, cutWrap, warn, el('span', 'gt-wm-tbsep'), matchBtn, matchCaret); body.appendChild(tb);
    const setProgress = (d, n) => { wmRunning = !!n; amstatus.textContent = n ? `matching ${d}/${n}…` : (d ? `matched ${d} track${d > 1 ? 's' : ''}` : ''); matchBtn.disabled = !!n; matchCaret.disabled = !!n; cancelBtn.style.display = n ? '' : 'none'; };   // disable ⚡ Match + offer cancel while matching runs
    // ── table ──
    const tbl = el('table', 'gt-wm-tbl');
    const cg = document.createElement('colgroup'); ['4%', '27%', '19%', '3%', '28%', '19%'].forEach(w => { const c = document.createElement('col'); c.style.width = w; cg.appendChild(c); }); tbl.appendChild(cg);   // fixed widths — the # column was ballooning to an equal 1/6 (blank left column)
    const grp = el('tr'); const gl = el('th', 'tc-grp-l', 'Track'); gl.colSpan = 3; grp.appendChild(gl); grp.appendChild(el('th', 'c-sep', '')); const gr = el('th', 'tc-grp-r', 'Work'); gr.colSpan = 2; grp.appendChild(gr); tbl.appendChild(grp);
    const head = el('tr'); head.append(el('th', 'c-n', '#'), el('th', null, 'Title'), el('th', null, 'Artist'), el('th', 'c-sep', ''), el('th', null, 'Work'), el('th', null, 'Writers')); tbl.appendChild(head);
    const applyBtn = el('button', 'gt-cons-btn gt-cons-apply', 'Apply'); applyBtn.type = 'button';
    const plan = el('span', 'gt-cons-plan');
    let unresCursor = 0;   // #363 cycle through the unresolved on each ⚠ click, not always the first
    const updatePlan = () => {
      const n = rows.filter(r => r.chosen && !r.hasWorkOnPage && !r.linked).length;
      plan.textContent = n ? `${n} work${n > 1 ? 's' : ''} to add` : 'nothing resolved'; applyBtn.disabled = !n;
      const uns = rows.filter(r => r._matched && !r.chosen && !r.hasWorkOnPage && !r.linked);
      warn.textContent = uns.length ? `⚠ ${uns.length} unresolved` : ''; warn.className = 'gt-wm-warn' + (uns.length ? ' click' : '');
      warn.onclick = uns.length ? () => {
        const r0 = uns[unresCursor % uns.length]; unresCursor++;
        if (r0 && r0._wk) { try { r0._wk.scrollIntoView({ block: 'center' }); } catch (e) {} wmPicker(r0, r0._wk, draw, updatePlan); }
      } : null;
    };
    const draw = () => rows.forEach(row => {
      const wkd = row._wk, dot = row._dot, wad = row._wa; if (!wkd) return;
      wkd.textContent = ''; if (wad) wad.textContent = '';
      if (row._artEl) row._artEl.textContent = row.artist || '';
      if (row.hasWorkOnPage || row.linked) { if (dot) dot.style.visibility = 'hidden'; wkd.appendChild(el('span', 'gt-wm-linked', 'already linked ✓')); return; }
      if (!row._matched) { if (dot) dot.style.visibility = 'hidden'; wkd.appendChild(el('span', 'gt-wm-dim', wmRunning ? 'matching…' : '—')); return; }
      const w = row.chosen;
      if (!w) {
        if (dot) dot.style.visibility = 'hidden';
        const none = el('span', 'gt-wm-none', '— none —'); none.title = 'pick a work'; none.onclick = () => wmPicker(row, wkd, draw, updatePlan); wkd.appendChild(none);
        const acts = el('span', 'gt-wm-acts'); acts.appendChild(mkAct('＋', 'set to a new work', () => { row.chosen = wmMakeNewWork(row.title); draw(); updatePlan(); })); wkd.appendChild(acts);
        return;
      }
      if (dot) { dot.style.visibility = 'visible'; if (w._gtNew) { dot.style.background = '#2c7a51'; dot.title = 'new work'; } else { const L = WM_LEVEL[row.level] || WM_LEVEL.near; dot.style.background = L.c; dot.title = L.t; } }
      if (w._gtNew) { const nw = el('span', 'gt-wm-newtag', '＋ new work: ' + (w.name || w.title || '')); nw.title = 'change / pick a work'; nw.onclick = () => wmPicker(row, wkd, draw, updatePlan); wkd.appendChild(nw); }
      else { const a = el('a', 'gt-wm-wa', w.title); a.href = '/work/' + w.gid; a.target = '_blank'; a.rel = 'noopener'; a.title = 'change / pick a work (middle-click to open the work)'; a.onclick = e => { e.preventDefault(); e.stopPropagation(); wmPicker(row, wkd, draw, updatePlan); }; wkd.appendChild(a); if (w.disambiguation) wkd.appendChild(el('span', 'gt-wm-disamb', ` (${w.disambiguation})`)); }
      if (wad) {
        wad.textContent = '';
        if (row.writers && row.writers.length) wad.appendChild(el('span', 'gt-wm-wwr', row.writers.slice(0, 4).join(', ')));
        // when the performer is one of the work's recording artists (why it matched), show them too — the
        // native work dropdown's "Artists:" line, e.g. Phil Collins on "You Can't Hurry Love"
        if (row.artistMatched && row.workArtists && row.workArtists.length) { const ar = el('span', 'gt-wm-wart', '♫ ' + row.workArtists.slice(0, 3).join(', ')); ar.title = 'recording artists of this work — the performer is among them'; wad.appendChild(ar); }
      }
      const acts = el('span', 'gt-wm-acts');
      acts.appendChild(mkAct('↺', 'clear this match', () => { row.chosen = null; draw(); updatePlan(); }));
      if (!w._gtNew) acts.appendChild(mkAct('＋', 'set to a new work', () => { row.chosen = wmMakeNewWork(row.title); draw(); updatePlan(); }));
      wkd.appendChild(acts);
    });
    rows.forEach((row, i) => {
      const tr = el('tr', 'gt-wm-row');
      tr.appendChild(el('td', 'c-n', row.pos ? String(row.pos) : String(i + 1)));
      tr.appendChild(el('td', 'gt-wm-tkt', row.title || '(untitled)'));
      const tka = el('td', 'gt-wm-tka'); row._artEl = tka; tr.appendChild(tka);
      const sepd = el('td', 'c-sep'); const dot = el('span', 'gt-wm-dot'); dot.style.visibility = 'hidden'; sepd.appendChild(dot); row._dot = dot; tr.appendChild(sepd);
      const wkd = el('td', 'gt-wm-wk'); row._wk = wkd; tr.appendChild(wkd);
      const wad = el('td', 'gt-wm-authors'); row._wa = wad; tr.appendChild(wad);
      tbl.appendChild(tr);
    });
    body.appendChild(tbl);
    // resolve every matched row whose best is at/above the cutoff (⚡ Match + cutoff change)
    const applyCutoff = () => { rows.forEach(r => { if (!(r.hasWorkOnPage || r.linked) && r._matched) r.chosen = (r.best && WM_RANK[r.level] <= wmCutoff) ? r.best : null; }); draw(); updatePlan(); };
    // #372 (re-)run matching for any not-yet-matched rows, then apply the cutoff. Re-runnable: this is
    // both the initial pass and what ⚡ Match does — so "Match" after a cancel resumes the leftover rows.
    const runMatch = async () => {
      if (wmRunning) return;
      cancelled = false; if (wmAbort) { try { wmAbort.abort(); } catch (e) {} } wmAbort = new AbortController();
      const total = rows.length;
      let done = rows.filter(r => r._matched || r.hasWorkOnPage || r.linked).length;
      setProgress(done, total); draw();
      for (const row of rows) {
        if (cancelled) break;
        if (row._matched || row.hasWorkOnPage) continue;
        try { await wmMatchOne(row); } catch (e) {}
        if (!wmEl) { wmRunning = false; return; }   // dialog closed mid-run
        if (cancelled) break;
        row._matched = true; done++; setProgress(done, total); draw(); updatePlan();
      }
      setProgress(done, 0);                 // clears wmRunning → leftover rows show "—", ⚡ Match re-enabled
      if (!cancelled) applyCutoff();        // auto-select strong matches after a full pass (not after a cancel)
      draw(); updatePlan();
    };
    matchBtn.onclick = runMatch;
    chip.onclick = () => wmFloatMenu(chip, WM_LVL_BY_RANK.map(lvl => ({ label: lvl, dot: WM_LEVEL[lvl].c, sel: WM_RANK[lvl] === wmCutoff, run: () => { wmCutoff = WM_RANK[lvl]; try { GM_setValue('gt-wm-cutoff', wmCutoff); } catch (e) {} paintChip(); applyCutoff(); } })));
    const newAllBtn = el('button', 'gt-cons-btn', '＋ New work for unresolved'); newAllBtn.type = 'button'; newAllBtn.title = 'Create a new work (named after the track) for every recording still unresolved — same-title tracks share one';
    newAllBtn.onclick = () => { rows.forEach(r => { if (!(r.hasWorkOnPage || r.linked) && r._matched && !r.chosen) r.chosen = wmMakeNewWork(r.title); }); draw(); updatePlan(); };
    applyBtn.onclick = async () => { const n = await wmApply(rows, null); if (n > 0) closeWorkMatch(); };   // close the popup once staged (#363 follow-up)
    foot.append(newAllBtn, plan, applyBtn);   // #363 Clear moved to the Match caret menu; new-work options moved to the toolbar
    draw(); updatePlan();
    return { draw, updatePlan, setProgress, runMatch };
  }
  function wmResRow(work, row, draw, updatePlan) {
    const r = el('div', 'gt-wm-res');
    r.appendChild(el('span', 'gt-wm-rt', work.title + (work.disambiguation ? ` (${work.disambiguation})` : '')));
    if (work.type && work.type !== 'Song') r.appendChild(el('span', 'gt-wm-rw', ' · ' + work.type));
    if (work.authors && work.authors.length) r.appendChild(el('span', 'gt-wm-rw', ' — ' + work.authors.slice(0, 4).join(', ')));
    if (work.artists && work.artists.length) r.appendChild(el('span', 'gt-wm-rw', ' · ♫ ' + work.artists.slice(0, 3).join(', ')));
    if (work.gid) { const open = el('a', 'gt-wm-open', '↗'); open.href = '/work/' + work.gid; open.target = '_blank'; open.rel = 'noopener'; open.title = 'open this work in a new tab'; open.onclick = e => e.stopPropagation(); r.appendChild(open); }
    r.onclick = () => { row.chosen = work; row.best = work; if (!row.level || row.level === 'none') row.level = 'near'; row.writers = work.authors || []; draw && draw(); updatePlan && updatePlan(); closePopover(); };
    return r;
  }
  function wmPicker(row, anchor, draw, updatePlan) {
    closePopover();
    popEl = el('div', 'gt-wm-pop');
    popEl.appendChild(el('div', 'gt-pop-hdr', 'Pick a work for “' + trunc(row.title, 54) + '”'));
    if (row.artist) popEl.appendChild(el('div', 'gt-wm-sub', 'by ' + trunc(row.artist, 60)));
    // current match (mirrors Apollo's picker header) — the work as a link you can open in a new tab, its
    // writers, and a clear button
    const cur = el('div', 'gt-wm-cur');
    const paintCur = () => {
      cur.textContent = ''; cur.appendChild(el('span', 'gt-wm-cur-l', 'Current: '));
      const w = row.chosen;
      if (!w) { cur.appendChild(el('span', 'gt-wm-none', '— none —')); return; }
      if (w._gtNew) { cur.appendChild(el('span', 'gt-wm-newtag', '＋ new work: ' + (w.name || w.title || ''))); return; }
      const a = el('a', 'gt-wm-wa', w.title + (w.disambiguation ? ` (${w.disambiguation})` : '')); a.href = '/work/' + w.gid; a.target = '_blank'; a.rel = 'noopener'; a.title = 'open this work in a new tab'; cur.appendChild(a);
      if (row.writers && row.writers.length) cur.appendChild(el('span', 'gt-wm-rw', ' — ' + row.writers.slice(0, 4).join(', ')));
      const clr = el('button', 'gt-wm-act', '↺'); clr.type = 'button'; clr.title = 'clear this match'; clr.onclick = () => { row.chosen = null; paintCur(); draw && draw(); updatePlan && updatePlan(); }; cur.appendChild(clr);
    };
    paintCur(); popEl.appendChild(cur);
    const qrow = el('div', 'gt-wm-qrow');
    const q = el('input', 'gt-wm-q'); q.type = 'text'; q.placeholder = 'search works, or paste a work MBID / URL…'; qrow.appendChild(q);
    // #363 create-new-work as a + button right of the search (like Apollo's recordings picker), not a footer button
    const newBtn = el('button', 'gt-wm-newplus', '＋'); newBtn.type = 'button'; newBtn.title = 'Create a new work “' + trunc(row.title, 40) + '”';
    newBtn.onclick = () => { const w = wmMakeNewWork(row.title); row.chosen = w; row.best = w; row.level = (!row.level || row.level === 'none') ? 'near' : row.level; row.writers = []; draw && draw(); updatePlan && updatePlan(); closePopover(); };
    qrow.appendChild(newBtn); popEl.appendChild(qrow);
    const list = el('div', 'gt-wm-results'); popEl.appendChild(list);
    const showCands = () => { list.textContent = ''; (row.cands || []).forEach(c => list.appendChild(wmResRow(c, row, draw, updatePlan))); if (!(row.cands || []).length) list.appendChild(el('div', 'gt-pop-note', 'No candidates yet — search or paste a work.')); };
    showCands();
    let t = null;
    const run = async () => {
      const term = (q.value || '').trim(); if (!term) return showCands();
      const gid = (term.match(GID_RE) || [])[0];
      list.textContent = '';
      if (gid) { const j = await wmJson('/ws/2/work/' + gid + '?inc=artist-rels&fmt=json'); if (j && j.id) list.appendChild(wmResRow({ gid: j.id, title: j.title, disambiguation: j.disambiguation || '', authors: (j.relations || []).filter(r => r.artist && WM_WRITER_RE.test(r.type || '')).map(r => r.artist.name) }, row, draw, updatePlan)); else list.appendChild(el('div', 'gt-pop-note', 'No work with that MBID.')); return; }
      const works = await wmWorkSearch(term);
      if (!works.length) { list.appendChild(el('div', 'gt-pop-note', 'No matches.')); return; }
      works.forEach(w => list.appendChild(wmResRow(w, row, draw, updatePlan)));
    };
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 300); });
    q.addEventListener('paste', () => setTimeout(run, 0));
    document.body.appendChild(popEl);
    const a = anchor.getBoundingClientRect(), r = popEl.getBoundingClientRect();
    popEl.style.left = Math.max(8, Math.min(a.left, window.innerWidth - r.width - 8)) + 'px';
    popEl.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onPopDown, true); document.addEventListener('keydown', onPopKey, true); q.focus(); }, 0);
  }
  async function wmApply(rows, refresh) {
    const re = RE(); const ltId = performanceLtId();
    if (!re || ltId == null) { toast('Cannot apply — editor not ready'); return; }
    const todo = rows.filter(r => r.chosen && !r.hasWorkOnPage && !r.linked);
    if (!todo.length) { toast('Nothing resolved to apply'); return; }
    toast(`Linking ${todo.length} work${todo.length > 1 ? 's' : ''}…`);
    let ok = 0, fail = 0;
    const extras = wmRelExtras();   // #363 recording-of attributes + dates, applied to every staged rel
    for (const row of todo) {
      try {
        // existing work: fetch its internal id (the editor needs it). New work: dispatch the synthetic
        // entity as-is — MB creates it on submit, exactly like a natively-added new work.
        const workEnt = row.chosen._gtNew ? row.chosen : await wmJson('/ws/js/entity/' + row.chosen.gid);
        if (!workEnt || workEnt.id == null) { fail++; continue; }
        dispatchRelationship(re, row.rec, workEnt, ltId, '', extras.attrs, extras.dates);
        row.linked = true; row.chosen = null; ok++;
      } catch (e) { fail++; }
    }
    if (ok) markUsed(`Matched ${ok} recording${ok > 1 ? 's' : ''} to works`);
    toast(fail ? `Linked ${ok}, ${fail} failed — see console` : `✓ Linked ${ok} work${ok > 1 ? 's' : ''} — review & save`);
    refresh && refresh();
    return ok;
  }

  // recording checkbox → copy every recording rel except work/url/recording-samples
  // (so artists, ℗/© labels, recorded-at places, …) onto the ticked recordings
  // preselect (optional): a predicate rel→bool for which credits START ticked (#373 — the + / pencil
  // right-clicks scope the copy to one role group / one credit; others start unticked but stay selectable).
  function openCopyMenu(sourceTr, x, y, preselect) {
    const srcRels = recordingRels(sourceTr).filter(r => !r.removed && r.other && !['work', 'url', 'recording'].includes(r.other.entityType));
    const entries = srcRels.map(s => ({ rel: s, role: roleKeyOfSpec(s), pos: roleLabelOf(s), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : ''), checked: preselect ? !!preselect(s) : true }));
    // before the checkboxes render, respect the preselect (e.checked) so the Copy count reflects the ticked subset (#373)
    const chosen = () => entries.filter(e => e.cb ? e.cb.checked : e.checked !== false).map(e => e.rel);
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
  function openWorkMenu(workRef, x, y, preselect) {
    const srcWork = (workRef && workRef.entityType === 'work') ? workRef : workEntity(workRef);   // #373 accept a work entity (from a rel) or a checkbox
    if (!srcWork) { openMenu(x, y, [{ header: 'Could not read this work' }]); return; }
    const srcRels = workCreditRels(srcWork).filter(r => !r.removed);
    const entries = srcRels.map(s => ({ rel: s, role: roleKeyOfSpec(s), pos: roleLabelOf(s), text: val(s.other.name) + (s.credit && s.credit !== val(s.other.name) ? ` (${s.credit})` : ''), checked: preselect ? !!preselect(s) : true }));   // #373 pencil/+ pre-tick a subset
    const chosen = () => entries.filter(e => e.cb ? e.cb.checked : e.checked !== false).map(e => e.rel);
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
