// ==UserScript==
// @name         Group Therapy — MusicBrainz relationship helper
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.1.4
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
  const VERSION = '2026.7.1.4';
  const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

  // ── tiny DOM helpers ──────────────────────────────────────────────────────
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // MB renders each rel as <tr class="<role-kebab>"> … <div class="relationship-item"> <button class="icon remove-item">×</button> <a href="/artist|work|…/<mbid>">name</a> …
  const REMOVE_SEL = 'button.icon.remove-item';
  const ROLE_STOP = new Set(['odd', 'even', 'highlighted', 'selected', 'subrow', 'rel-add', 'rel-edit', 'rel-remove']);
  const pickRoleClass = tr => { if (!tr) return null; for (const c of tr.classList) if (!ROLE_STOP.has(c) && /^[a-z][a-z0-9-]*$/.test(c)) return c; return null; };
  const pickRoleLabel = tr => { const l = tr && tr.querySelector('th.link-phrase label'); return l ? (l.textContent || '').replace(/:\s*$/, '').trim() : 'role'; };
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
      const row = el('button', 'gt-mi' + (it.danger ? ' gt-danger' : ''));
      const top = el('div', 'gt-mi-top');
      top.appendChild(el('span', 'gt-mi-l', it.label));
      if (it.sub != null) top.appendChild(el('span', 'gt-mi-s', it.sub));
      row.appendChild(top);
      if (it.detail) row.appendChild(el('div', 'gt-mi-d', it.detail));   // #338: blast-radius detail (which tracks / release)
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
  // blast radius of a removal group: which tracks (positions) + whether the release itself is hit
  function scopeOf(items) {
    const tracks = new Set(); let release = false;
    for (const it of items) { const tr = it.closest && it.closest('tr.track'); if (tr) { const m = (tr.textContent || '').match(/^\s*(\d+)\b/); if (m) { tracks.add(+m[1]); continue; } } release = true; }
    return { tracks, release };
  }
  function scopeText(items) {
    const s = scopeOf(items), parts = [];
    if (s.tracks.size) parts.push(`track${s.tracks.size > 1 ? 's' : ''} ${ranges(s.tracks)}`);
    if (s.release) parts.push('release');
    return parts.join(' · ');
  }
  function onContextMenu(ev) {
    const btn = ev.target.closest && ev.target.closest(REMOVE_SEL);
    if (!btn) return;   // not a rel × — let the browser menu through
    ev.preventDefault();
    const seedRow = btn.closest('tr'), seedItem = btn.closest('.relationship-item');
    const roleLabel = pickRoleLabel(seedRow), tgt = targetLabel(seedItem);
    const roleItems = collect(btn, 'role'), tgtItems = collect(btn, 'target'), bothItems = collect(btn, 'role-and-target');
    const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const opt = (label, its) => ({ label, sub: String(its.length), detail: scopeText(its), danger: true, run: () => runRemoval(its) });
    const items = [
      { label: `Remove this one`, detail: scopeText([seedItem]), run: () => { try { btn.click(); } catch (e) {} } },
      'sep',
      opt(`Remove “${trunc(roleLabel, 26)}” — all tracks`, roleItems),
      opt(`Remove “${trunc(tgt, 26)}” — everywhere`, tgtItems),
      opt(`Remove “${trunc(roleLabel, 16)}” + “${trunc(tgt, 16)}”`, bothItems),
    ];
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
  const trackPosOf = node => { const tr = node.parentNode && node.parentNode.closest ? node.parentNode.closest('tr.track') : null; if (!tr) return null; const m = (tr.textContent || '').match(/^\s*(\d+)\b/); return m ? +m[1] : null; };
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
  // compress [1,2,3,5] → "1–3, 5"
  function ranges(nums) {
    const a = [...nums].sort((x, y) => x - y), out = []; let s = null, p = null;
    for (const v of a) { if (s == null) { s = p = v; } else if (v === p + 1) { p = v; } else { out.push(s === p ? `${s}` : `${s}–${p}`); s = p = v; } }
    if (s != null) out.push(s === p ? `${s}` : `${s}–${p}`);
    return out.join(', ');
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
      .gt-menu{position:fixed;z-index:2147483647;min-width:210px;background:#fff;border:1px solid #cfd4da;border-radius:7px;
        box-shadow:0 8px 26px rgba(0,0,0,.18);padding:4px;font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222;user-select:none}
      .gt-menu .gt-sep{height:1px;background:#e7e9ee;margin:4px 2px}
      .gt-mi{display:block;width:100%;box-sizing:border-box;background:none;border:none;text-align:left;
        padding:6px 9px;border-radius:5px;cursor:pointer;color:inherit;font:inherit}
      .gt-mi:hover{background:#eef1f6}
      .gt-mi .gt-mi-top{display:flex;align-items:center;gap:10px}
      .gt-mi .gt-mi-l{flex:1;white-space:nowrap}
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
    `;
    document.head.appendChild(s);
  }

  // ── boot ────────────────────────────────────────────────────────────────
  function boot() {
    injectStyle();
    document.body.addEventListener('contextmenu', onContextMenu, true);
    document.body.addEventListener('mouseover', onOver);
    document.body.addEventListener('mousemove', onMove);
    document.body.addEventListener('mouseout', onOut);
    try { GM_registerMenuCommand(`Group Therapy v${VERSION}`, () => {}); } catch (e) {}
    try { W.__groupTherapy = { VERSION, collect, removeButtons, highlightPage }; } catch (e) {}
    console.log(`[Group Therapy] v${VERSION} ready — right-click a relationship's × for group delete; hover a name/role to highlight.`);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
