// ==UserScript==
// @name         Group Therapy — MusicBrainz relationship helper
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.1
// @description  Subtle relationship-editor helpers: batch-delete rel groups from a right-click menu, page-wide hover highlight, and (soon) copy/move credits between recordings & clone release credits. Chrome-light — context menus + hover, no toolbar.
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
  const VERSION = '2026.7.1';
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
      row.appendChild(el('span', 'gt-mi-l', it.label));
      if (it.sub != null) row.appendChild(el('span', 'gt-mi-s', it.sub));
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
  function onContextMenu(ev) {
    const btn = ev.target.closest && ev.target.closest(REMOVE_SEL);
    if (!btn) return;   // not a rel × — let the browser menu through
    ev.preventDefault();
    const seedRow = btn.closest('tr'), seedItem = btn.closest('.relationship-item');
    const roleLabel = pickRoleLabel(seedRow), tgt = targetLabel(seedItem);
    const roleItems = collect(btn, 'role'), tgtItems = collect(btn, 'target'), bothItems = collect(btn, 'role-and-target');
    const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const items = [
      { label: `Remove this one`, run: () => { try { btn.click(); } catch (e) {} } },
      'sep',
      { label: `Remove “${trunc(roleLabel, 26)}” — all tracks`, sub: String(roleItems.length), danger: true, run: () => runRemoval(roleItems) },
      { label: `Remove “${trunc(tgt, 26)}” — everywhere`, sub: String(tgtItems.length), danger: true, run: () => runRemoval(tgtItems) },
      { label: `Remove “${trunc(roleLabel, 16)}” + “${trunc(tgt, 16)}”`, sub: String(bothItems.length), danger: true, run: () => runRemoval(bothItems) },
    ];
    openMenu(ev.clientX, ev.clientY, items);
  }

  // ── styles ────────────────────────────────────────────────────────────────
  function injectStyle() {
    const s = el('style');
    s.textContent = `
      .gt-menu{position:fixed;z-index:2147483647;min-width:210px;background:#fff;border:1px solid #cfd4da;border-radius:7px;
        box-shadow:0 8px 26px rgba(0,0,0,.18);padding:4px;font:13px -apple-system,Segoe UI,Arial,sans-serif;color:#222;user-select:none}
      .gt-menu .gt-sep{height:1px;background:#e7e9ee;margin:4px 2px}
      .gt-mi{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;background:none;border:none;text-align:left;
        padding:6px 9px;border-radius:5px;cursor:pointer;color:inherit;font:inherit}
      .gt-mi:hover{background:#eef1f6}
      .gt-mi .gt-mi-l{flex:1;white-space:nowrap}
      .gt-mi .gt-mi-s{flex:none;min-width:20px;text-align:center;font-weight:700;font-size:11px;color:#556;background:#eef1f6;border-radius:9px;padding:1px 7px}
      .gt-mi.gt-danger:hover{background:#fbe3e0}
      .gt-mi.gt-danger .gt-mi-s{color:#fff;background:#c0392b}
    `;
    document.head.appendChild(s);
  }

  // ── boot ────────────────────────────────────────────────────────────────
  function boot() {
    injectStyle();
    document.body.addEventListener('contextmenu', onContextMenu, true);
    try { GM_registerMenuCommand(`Group Therapy v${VERSION}`, () => {}); } catch (e) {}
    try { W.__groupTherapy = { VERSION, collect, removeButtons }; } catch (e) {}
    console.log(`[Group Therapy] v${VERSION} ready — right-click a relationship's × for group delete.`);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
