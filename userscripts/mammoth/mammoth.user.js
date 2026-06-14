// ==UserScript==
// @name         Mammoth
// @namespace    https://musicbrainz.org/
// @version      2026.6.14.170000
// @description  Edit-note memory for MusicBrainz: auto-remembers your last edit notes and lets you save reusable ones, recalling them by their full text from a clean panel on every edit form. A nicer replacement for Elephant Editor.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI4IiBmaWxsPSIjZWZmNmYxIi8+PHBhdGggZD0iTTMyIDM0aDQ4bDE2IDE2djQ0YTYgNiAwIDAgMS02IDZIMzJhNiA2IDAgMCAxLTYtNlY0MGE2IDYgMCAwIDEgNi02WiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMmM3YTUxIiBzdHJva2Utd2lkdGg9IjUiLz48cGF0aCBkPSJNNDIgNTZoMzZNNDIgNzBoMzZNNDIgODRoMjAiIHN0cm9rZT0iIzJjN2E1MSIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNODggOTBjMTAgMCAxNiA2IDE2IDE0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2ZjQyYzEiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mammoth/README.md
// @match        https://*.musicbrainz.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
//
// Mammoth attaches a small "Notes" control to MusicBrainz's native Edit note
// field (textarea.edit-note), which appears on every edit form — release/RG/
// artist/label/work/recording/area/place/series/event/genre/URL add & edit,
// the relationship editor, merges, removals, set-values, batch edits.
//
//   - It AUTOMATICALLY remembers the last N edit notes you submit (default 10,
//     deduped, most-recent first). No "remember this" checkbox to get stuck on.
//   - It lets you SAVE reusable notes and recall any of them by their FULL text
//     (not a 6-char button) from a clean, searchable panel.
//   - Clicking a note inserts it; into an empty field it sets, into a non-empty
//     field it appends on a new line (modifier-click does the opposite). It
//     NEVER auto-overwrites — so it won't clobber notes other scripts (Apollo,
//     Credit Hoarder, Platform Check) write for their own submissions.

(function () {
  'use strict';

  const KEY = 'mammoth:data';
  const SKEY = 'mammoth:settings';
  const DEFAULTS = { historySize: 10, insertMode: 'append' };   // insertMode: 'append' | 'replace'

  // ── storage ────────────────────────────────────────────────────────────────
  const loadData = () => { try { return Object.assign({ saved: [], history: [] }, JSON.parse(GM_getValue(KEY, '{}') || '{}')); } catch (e) { return { saved: [], history: [] }; } };
  const saveData = () => { try { GM_setValue(KEY, JSON.stringify(DATA)); } catch (e) {} };
  const loadSet = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(GM_getValue(SKEY, '{}') || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const saveSet = () => { try { GM_setValue(SKEY, JSON.stringify(SET)); } catch (e) {} };

  let DATA = loadData();
  let SET = loadSet();
  const uid = () => 'n' + Math.random().toString(36).slice(2, 9);

  function recordHistory(text) {
    text = (text || '').trim();
    if (!text) return;
    DATA.history = DATA.history.filter(h => h.text !== text);
    DATA.history.unshift({ text, ts: Date.now() });
    const cap = Math.max(1, Math.min(50, SET.historySize | 0 || 10));
    DATA.history = DATA.history.slice(0, cap);
    saveData();
  }
  function addSaved(text) {
    text = (text || '').trim();
    if (!text) return false;
    if (DATA.saved.some(s => s.text === text)) return false;   // already saved
    DATA.saved.unshift({ id: uid(), text, ts: Date.now() });
    saveData();
    return true;
  }
  const removeSaved = id => { DATA.saved = DATA.saved.filter(s => s.id !== id); saveData(); };
  const removeHistory = text => { DATA.history = DATA.history.filter(h => h.text !== text); saveData(); };

  // ── insertion (React-safe) ──────────────────────────────────────────────────
  const NATIVE_SET = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  function setValue(ta, val) {
    NATIVE_SET.call(ta, val);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function insertNote(ta, text, replace) {
    const cur = ta.value || '';
    const val = (replace || !cur.trim()) ? text : (cur.replace(/\s+$/, '') + '\n' + text);
    setValue(ta, val);
    ta.focus();
    try { ta.setSelectionRange(val.length, val.length); } catch (e) {}
  }

  // ── capture on submit (records the note actually used) ────────────────────────
  function captureNote() {
    document.querySelectorAll('textarea.edit-note').forEach(ta => recordHistory(ta.value));
  }
  document.addEventListener('submit', captureNote, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, input[type="submit"]');
    if (!b) return;
    const t = (b.textContent || b.value || '').trim().toLowerCase();
    if (b.id === 'enter-edit' || /^(enter edit|submit|add edit|save)/.test(t) || (b.classList && b.classList.contains('submit'))) captureNote();
  }, true);

  // ── styles ───────────────────────────────────────────────────────────────────
  const css = `
  .mmth-bar { display:flex; gap:8px; align-items:center; margin:4px 0 6px; font:13px/1.3 -apple-system,Segoe UI,Arial,sans-serif; }
  .mmth-btn { display:inline-flex; align-items:center; gap:5px; cursor:pointer; border:1px solid #cfe0d6; background:#f4faf6; color:#1f5c3d;
              border-radius:6px; padding:3px 9px; font-weight:600; font-size:12px; user-select:none; }
  .mmth-btn:hover { background:#e7f4ec; border-color:#9eccb1; }
  .mmth-btn .mmth-caret { font-size:10px; opacity:.7; }
  .mmth-pop { position:fixed; z-index:99999; width:460px; max-width:92vw; background:#fff; border:1px solid #c7d3cc;
              border-radius:10px; box-shadow:0 10px 34px rgba(20,50,35,.22); font:13px/1.4 -apple-system,Segoe UI,Arial,sans-serif;
              color:#222; overflow:hidden; }
  .mmth-pop-hd { display:flex; gap:8px; align-items:center; padding:8px 10px; border-bottom:1px solid #eef2f0; background:#fafdfb; }
  .mmth-search { flex:1; border:1px solid #d7e0db; border-radius:6px; padding:5px 8px; font-size:13px; outline:none; }
  .mmth-search:focus { border-color:#7bbf9a; }
  .mmth-x { cursor:pointer; color:#999; font-size:16px; padding:0 4px; line-height:1; }
  .mmth-x:hover { color:#444; }
  .mmth-list { max-height:48vh; overflow:auto; }
  .mmth-sec { padding:5px 11px 3px; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:#8a978f; background:#fbfdfc; position:sticky; top:0; }
  .mmth-row { display:flex; gap:8px; align-items:flex-start; padding:7px 11px; border-top:1px solid #f1f4f2; cursor:pointer; }
  .mmth-row:hover { background:#f3faf6; }
  .mmth-row.mmth-hi { background:#e7f4ec; }
  .mmth-txt { flex:1; min-width:0; white-space:pre-wrap; word-break:break-word; max-height:3.2em; overflow:hidden; position:relative; }
  .mmth-row:hover .mmth-txt { max-height:none; }
  .mmth-acts { flex:none; display:flex; gap:2px; opacity:0; transition:opacity .1s; }
  .mmth-row:hover .mmth-acts { opacity:1; }
  .mmth-act { cursor:pointer; border:none; background:none; font-size:13px; line-height:1; padding:2px 3px; border-radius:4px; color:#6b7a72; }
  .mmth-act:hover { background:#dcefe2; color:#1f5c3d; }
  .mmth-empty { padding:14px 12px; color:#9aa6a0; font-style:italic; text-align:center; }
  .mmth-ft { display:flex; gap:10px; align-items:center; padding:7px 10px; border-top:1px solid #eef2f0; background:#fafdfb; font-size:12px; color:#5a6760; flex-wrap:wrap; }
  .mmth-ft label { display:inline-flex; gap:4px; align-items:center; cursor:pointer; }
  .mmth-ft input[type="number"] { width:42px; border:1px solid #d7e0db; border-radius:4px; padding:1px 4px; font-size:12px; }
  .mmth-ft .mmth-lnk { cursor:pointer; color:#2c7a51; font-weight:600; }
  .mmth-ft .mmth-lnk:hover { text-decoration:underline; }
  .mmth-toast { position:fixed; z-index:100000; background:#2c3a33; color:#fff; padding:6px 12px; border-radius:6px; font:13px sans-serif; box-shadow:0 4px 14px rgba(0,0,0,.25); }
  `;
  (function injectCss() { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); })();

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'mmth-toast'; t.textContent = msg;
    t.style.left = '50%'; t.style.top = '14px'; t.style.transform = 'translateX(-50%)';
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }

  // ── panel ──────────────────────────────────────────────────────────────────
  let openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; document.removeEventListener('mousedown', onDocDown, true); document.removeEventListener('keydown', onKey, true); } }
  function onDocDown(e) { if (openPop && !openPop.contains(e.target) && !e.target.closest('.mmth-bar')) closePop(); }
  let hiIdx = -1, rowEls = [];
  function onKey(e) {
    if (!openPop) return;
    if (e.key === 'Escape') { closePop(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!rowEls.length) return;
      hiIdx = (hiIdx + (e.key === 'ArrowDown' ? 1 : -1) + rowEls.length) % rowEls.length;
      rowEls.forEach((r, i) => r.classList.toggle('mmth-hi', i === hiIdx));
      rowEls[hiIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && hiIdx >= 0 && rowEls[hiIdx]) {
      e.preventDefault(); rowEls[hiIdx].click();
    }
  }

  function buildPanel(ta, anchor) {
    closePop();
    const pop = document.createElement('div'); pop.className = 'mmth-pop';
    pop.innerHTML = `
      <div class="mmth-pop-hd">
        <input class="mmth-search" type="text" placeholder="Search notes…">
        <span class="mmth-x" title="Close">×</span>
      </div>
      <div class="mmth-list"></div>
      <div class="mmth-ft">
        <label title="On click, into a non-empty field">Insert:
          <select class="mmth-mode"><option value="append">append</option><option value="replace">replace</option></select>
        </label>
        <label title="How many submitted notes to remember">History:
          <input class="mmth-hsize" type="number" min="1" max="50"></label>
        <span style="flex:1"></span>
        <span class="mmth-lnk mmth-export">Export</span>
        <span class="mmth-lnk mmth-import">Import</span>
      </div>`;
    document.body.appendChild(pop);
    openPop = pop;

    const list = pop.querySelector('.mmth-list');
    const search = pop.querySelector('.mmth-search');
    const modeSel = pop.querySelector('.mmth-mode'); modeSel.value = SET.insertMode;
    const hsize = pop.querySelector('.mmth-hsize'); hsize.value = SET.historySize;

    modeSel.onchange = () => { SET.insertMode = modeSel.value; saveSet(); };
    hsize.onchange = () => { SET.historySize = Math.max(1, Math.min(50, parseInt(hsize.value, 10) || 10)); hsize.value = SET.historySize; saveSet(); recordHistory(''); render(); };
    pop.querySelector('.mmth-x').onclick = closePop;
    pop.querySelector('.mmth-export').onclick = () => {
      try { navigator.clipboard.writeText(JSON.stringify(DATA, null, 2)); toast('Notes copied to clipboard (JSON)'); } catch (e) { toast('Copy failed'); }
    };
    pop.querySelector('.mmth-import').onclick = () => {
      const raw = prompt('Paste Mammoth JSON to import (merges Saved notes):');
      if (!raw) return;
      try {
        const inc = JSON.parse(raw);
        (inc.saved || []).forEach(s => { if (s && s.text) addSaved(s.text); });
        DATA = loadData(); render(); toast('Imported');
      } catch (e) { toast('Invalid JSON'); }
    };

    const render = () => {
      const q = (search.value || '').trim().toLowerCase();
      const match = t => !q || t.toLowerCase().includes(q);
      const saved = DATA.saved.filter(s => match(s.text));
      const hist = DATA.history.filter(h => match(h.text));
      list.innerHTML = '';
      rowEls = []; hiIdx = -1;

      const addRow = (text, kind, id) => {
        const row = document.createElement('div'); row.className = 'mmth-row';
        const txt = document.createElement('div'); txt.className = 'mmth-txt'; txt.textContent = text;
        const acts = document.createElement('div'); acts.className = 'mmth-acts';
        const mkAct = (glyph, title, fn) => { const b = document.createElement('button'); b.className = 'mmth-act'; b.textContent = glyph; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); }; acts.appendChild(b); };
        if (kind === 'history') mkAct('★', 'Save (pin to Saved)', () => { if (addSaved(text)) toast('Saved'); render(); });
        mkAct('⧉', 'Copy', () => { try { navigator.clipboard.writeText(text); toast('Copied'); } catch (e) {} });
        mkAct('🗑', 'Delete', () => { kind === 'saved' ? removeSaved(id) : removeHistory(text); render(); });
        row.appendChild(txt); row.appendChild(acts);
        row.onclick = e => { insertNote(ta, text, (SET.insertMode === 'replace') !== (e.ctrlKey || e.metaKey || e.altKey)); closePop(); };
        list.appendChild(row); rowEls.push(row);
      };

      if (saved.length) { const h = document.createElement('div'); h.className = 'mmth-sec'; h.textContent = '📌 Saved'; list.appendChild(h); saved.forEach(s => addRow(s.text, 'saved', s.id)); }
      if (hist.length) { const h = document.createElement('div'); h.className = 'mmth-sec'; h.textContent = '🕘 Recent'; list.appendChild(h); hist.forEach(s => addRow(s.text, 'history')); }
      if (!saved.length && !hist.length) { const e = document.createElement('div'); e.className = 'mmth-empty'; e.textContent = q ? 'No matching notes' : 'No notes yet — submit an edit, or use ★ Save current'; list.appendChild(e); }
    };
    search.oninput = render;
    render();

    // position under the anchor button
    const r = anchor.getBoundingClientRect();
    pop.style.top = Math.min(window.innerHeight - 40, r.bottom + 4) + 'px';
    pop.style.left = Math.max(6, Math.min(window.innerWidth - pop.offsetWidth - 6, r.left)) + 'px';
    setTimeout(() => { document.addEventListener('mousedown', onDocDown, true); document.addEventListener('keydown', onKey, true); search.focus(); }, 0);
  }

  // ── bar (one per edit-note textarea) ─────────────────────────────────────────
  function buildBar(ta) {
    const bar = document.createElement('div'); bar.className = 'mmth-bar';
    const notes = document.createElement('span'); notes.className = 'mmth-btn';
    notes.innerHTML = '🗒 Notes <span class="mmth-caret">▾</span>';
    notes.title = 'Recall a saved or recent edit note';
    notes.onclick = () => { if (openPop) closePop(); else buildPanel(ta, notes); };
    const saveBtn = document.createElement('span'); saveBtn.className = 'mmth-btn';
    saveBtn.textContent = '★ Save current';
    saveBtn.title = 'Save the current edit-note text as a reusable note';
    saveBtn.onclick = () => { const v = (ta.value || '').trim(); if (!v) { toast('Edit note is empty'); return; } toast(addSaved(v) ? 'Saved' : 'Already saved'); };
    bar.appendChild(notes); bar.appendChild(saveBtn);
    return bar;
  }

  function injectAll() {
    document.querySelectorAll('textarea.edit-note').forEach(ta => {
      if (ta.dataset.mmth) return;
      ta.dataset.mmth = '1';
      ta.parentNode.insertBefore(buildBar(ta), ta);
    });
  }

  const obs = new MutationObserver(() => injectAll());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  injectAll();
})();
