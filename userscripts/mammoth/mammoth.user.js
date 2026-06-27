// ==UserScript==
// @name         Mammoth
// @namespace    https://musicbrainz.org/
// @version      2026.6.27
// @description  Edit-note memory for MusicBrainz: auto-remembers your last edit notes and lets you save reusable ones, recalling them from a compact panel beside the edit-note field on every edit form. A nicer replacement for Elephant Editor.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48dGV4dCB4PSI2NCIgeT0iNjgiIGZvbnQtc2l6ZT0iMTA0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCI+8J+mozwvdGV4dD48L3N2Zz4=
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mammoth/README.md
// @match        https://*.musicbrainz.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
//
// Mammoth puts a compact saved-notes panel to the RIGHT of MusicBrainz's native
// Edit note field (textarea.edit-note), which appears on every edit form, and
// widens that (centered) field to make room.
//
//   - AUTO-HISTORY: remembers the last N edit notes you submit (default 10, deduped).
//   - SAVED notes: ★ favourite (sorts to top), drag (⠿) to reorder, 🗑 delete.
//     One line each (full text on hover).
//   - INSERT: a click applies your default action (append or replace, see ⚙);
//     right-click does the other. Ctrl/⌘ + ↑/↓ cycles saved notes, replacing the
//     field. Append skips a line already present. Never auto-overwrites blindly,
//     so it won't clobber notes Apollo / Credit Hoarder / Platform Check write.
//   - BABY MAMMOTHS (⚙ "Show mammoth babies"): the same save/reuse idea on other
//     controls — catalog number, label, artist, status, language… A small 🦣 pin
//     on each field recalls values you've saved for it; ★ pins one as an always-
//     visible button under the field; one entry can be the default (auto-fills an
//     empty field). Targets: a built-in release-editor set + any element another
//     script tags class="mmth-pin". Stored separately (mammoth-fields:data).

(function () {
  'use strict';

  const KEY = 'mammoth:data';
  const SKEY = 'mammoth:settings';
  const DEFAULTS = { historySize: 10, hideHelp: false, defaultInsert: 'replace', visibleRows: 6, sideWidth: 300, appendNewline: true, minimized: false, showBabies: true, noteSort: 'manual' };   // defaultInsert: 'replace' | 'append'; noteSort: 'manual' | 'uses' | 'recent'
  const VERSION = '2026.6.27';   // keep in sync with @version (fallback when GM_info is unavailable)
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mammoth/README.md';
  const SYNTAX_URL = 'https://musicbrainz.org/doc/Edit_Note';
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  // #308: the 🦣 emoji (U+1F9A3) renders as a tofu box in Chrome on systems whose
  // emoji font lacks it (Firefox bundles its own, hence the inconsistency). Use a
  // self-contained vector mammoth everywhere the icon shows, so it's font-independent.
  const MAMMOTH_SVG = '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" style="display:block"><g fill="#7a4a1f"><path d="M21 19C21 12.5 17.5 8.5 11.5 8.5C7 8.5 4.2 11.2 4.2 15L4.2 19Z"/><circle cx="7.6" cy="10.6" r="5"/><rect x="7" y="16.5" width="2.8" height="5.2" rx="1.3"/><rect x="15" y="16.5" width="2.8" height="5.2" rx="1.3"/></g><path d="M3.1 11.2C1.6 13.6 2 16.6 3.7 18.1C4.6 18.9 5.9 18.6 6.1 17.5C6.3 16.5 5.7 15.8 5.3 15.3" fill="none" stroke="#7a4a1f" stroke-width="2.7" stroke-linecap="round"/><path d="M5.2 15.2C4.1 16.6 4.3 18.2 5.6 18.9" fill="none" stroke="#efe7d2" stroke-width="1.4" stroke-linecap="round"/></svg>';

  const loadData = () => { try { return Object.assign({ saved: [], history: [] }, JSON.parse(GM_getValue(KEY, '{}') || '{}')); } catch (e) { return { saved: [], history: [] }; } };
  const saveData = () => { try { GM_setValue(KEY, JSON.stringify(DATA)); } catch (e) {} render(); };
  const loadSet = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(GM_getValue(SKEY, '{}') || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const persistSet = () => { try { GM_setValue(SKEY, JSON.stringify(SET)); } catch (e) {} };           // quiet save (no re-render)
  const saveSet = () => { persistSet(); applyHelp(); render(); };

  let DATA = loadData();
  let SET = loadSet();
  const uid = () => 'n' + Math.random().toString(36).slice(2, 9);
  const babyMammoths = createBabyMammoths();   // field-memory module (gated by SET.showBabies)

  // ── data ops ─────────────────────────────────────────────────────────────────
  function recordHistory(text) {
    text = (text || '').trim(); if (!text) return;
    DATA.history = DATA.history.filter(h => h.text !== text);
    DATA.history.unshift({ text, ts: Date.now() });
    DATA.history = DATA.history.slice(0, Math.max(1, Math.min(50, SET.historySize | 0 || 10)));
    saveData();
  }
  function addSaved(text) {
    text = (text || '').trim(); if (!text) return false;
    if (DATA.saved.some(s => s.text === text)) return false;
    DATA.saved.push({ id: uid(), text, ts: Date.now() });
    saveData(); return true;
  }
  const removeSaved = id => { DATA.saved = DATA.saved.filter(s => s.id !== id); saveData(); };
  const removeHistory = text => { DATA.history = DATA.history.filter(h => h.text !== text); saveData(); };
  function reorder(srcId, tgtId, before) {
    if (srcId === tgtId) return;
    const a = DATA.saved, si = a.findIndex(s => s.id === srcId); if (si < 0) return;
    const [it] = a.splice(si, 1);
    let ti = a.findIndex(s => s.id === tgtId); if (ti < 0) { a.splice(si, 0, it); return; }
    a.splice(before ? ti : ti + 1, 0, it); saveData();
  }
  // #304: scaling helpers for big note lists.
  const togglePinNote = id => { const s = DATA.saved.find(x => x.id === id); if (s) { s.pinned = !s.pinned; saveData(); } };
  // record that a saved note was used (drives the "Most used" / "Recent" sort)
  function bumpUse(id) { const s = DATA.saved.find(x => x.id === id); if (!s) return; s.uses = (s.uses | 0) + 1; s.lastUsed = Date.now(); saveData(); }
  // display order for the Saved list — pinned never reorder the list (they get their
  // own quick-button bar); only the chosen sort mode reshuffles. Manual = stored order.
  function sortedSaved() {
    const a = DATA.saved.slice();
    const mode = SET.noteSort || 'manual';
    if (mode === 'uses')   a.sort((x, y) => (y.uses | 0) - (x.uses | 0) || (y.lastUsed || y.ts || 0) - (x.lastUsed || x.ts || 0));
    else if (mode === 'recent') a.sort((x, y) => (y.lastUsed || y.ts || 0) - (x.lastUsed || x.ts || 0));
    return a;
  }
  // bulk import: each line a note, or (byBlock) blank-line-separated blocks so
  // multi-line notes survive. Dedups against existing text. Returns counts.
  function importNotes(text, byBlock) {
    const parts = byBlock ? String(text || '').split(/\r?\n[ \t]*\r?\n/) : String(text || '').split(/\r?\n/);
    const notes = parts.map(s => s.replace(/^\s+|\s+$/g, '')).filter(Boolean);
    let added = 0; const have = new Set(DATA.saved.map(s => s.text));
    for (const t of notes) { if (have.has(t)) continue; have.add(t); DATA.saved.push({ id: uid(), text: t, ts: Date.now() }); added++; }
    if (added) saveData();
    return { added, seen: notes.length };
  }
  const exportNotes = () => DATA.saved.map(s => s.text).join('\n\n');

  // ── insert (React-safe + undoable) ───────────────────────────────────────────
  const NATIVE_SET = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  // Set the whole field value via the native edit pipeline so the change joins
  // the browser's undo stack — ctrl/⌘+Z restores the previous note (#226).
  // `execCommand` also fires a genuine `input` event, so the React-controlled
  // edit-note field (release editor) still updates. Falls back to the native
  // value setter + synthetic events if execCommand is unavailable or no-ops.
  function setValue(ta, val) {
    let ok = false;
    try {
      ta.focus();
      ta.setSelectionRange(0, ta.value.length);   // select all → replace as one undoable step
      ok = val ? document.execCommand('insertText', false, val)
               : document.execCommand('delete', false, null);
      if (ok && ta.value !== val) ok = false;      // some engines return true but no-op
    } catch (e) { ok = false; }
    if (!ok) {
      NATIVE_SET.call(ta, val);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function applyNote(ta, text, replace) {
    const cur = ta.value || '';
    if (!replace && cur.trim()) {
      // #212: don't append a note already in the field — match whole-field, a
      // blank-line-separated block, or a single line (handles multi-line notes).
      const norm = s => s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n').trim();
      const tN = norm(text);
      const cands = [cur, ...cur.split(/\n{2,}/), ...cur.split('\n')].map(norm);
      if (tN && cands.includes(tN)) { toast('Already in the note'); return; }
    }
    setValue(ta, (replace || !cur.trim()) ? text : cur.replace(/\s+$/, '') + (SET.appendNewline ? '\n\n' : '\n') + text);
    ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
  }
  // wrap the selection in `marker`; with no selection, wrap the word the caret
  // is in (or just drop the markers if the caret isn't inside a word).
  function wrapSel(ta, marker) {
    const v = ta.value;
    let s = ta.selectionStart ?? v.length, e = ta.selectionEnd ?? s;
    if (s === e) { let a = s, b = e; while (a > 0 && /\S/.test(v[a - 1])) a--; while (b < v.length && /\S/.test(v[b])) b++; if (b > a) { s = a; e = b; } }
    const sel = v.slice(s, e);
    setValue(ta, v.slice(0, s) + marker + sel + marker + v.slice(e));
    ta.focus();
    const caret = sel ? s + marker.length * 2 + sel.length : s + marker.length;
    try { ta.setSelectionRange(sel ? s + marker.length : caret, sel ? s + marker.length + sel.length : caret); } catch (x) {}
  }

  // ── capture on submit ────────────────────────────────────────────────────────
  const captureNote = () => document.querySelectorAll('textarea.edit-note').forEach(ta => recordHistory(ta.value));
  document.addEventListener('submit', captureNote, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, input[type="submit"]'); if (!b) return;
    if (b.closest('.mmth-side, .mmth-pop')) return;   // our own buttons aren't edit submits
    const t = (b.textContent || b.value || '').trim().toLowerCase();
    if (b.id === 'enter-edit' || /^(enter edit|submit|add edit|save)/.test(t) || (b.classList && b.classList.contains('submit'))) captureNote();
  }, true);

  // ── styles ───────────────────────────────────────────────────────────────────
  const css = `
  fieldset.editnote, .editnote { max-width:100% !important; }
  /* On the release editor the edit note sits in a 540px .half-width column whose
     only sibling is the changes warning (not a guidelines column), so give that
     column the full form width when Mammoth is active. The :has() selector scopes
     it to our column. min-width:0 lets the editnote fieldset (min-content by
     default) take that width so margin:auto can center it.
     SCOPED to the release editor (body.mmth-reledit): on entity-creation/edit
     pages (artist/label/… /create, /edit) the .editnote sits in a genuine
     half-width column beside the guidelines, and widening it to 100% broke that
     two-column layout — visibly so alongside scripts that write into it (#268). */
  .mmth-reledit .half-width:has(> .editnote.mmth-on), .mmth-reledit .col:has(> .editnote.mmth-on) { width:100% !important; max-width:100% !important; }
  .editnote.mmth-on { width:100% !important; max-width:100% !important; min-width:0 !important; box-sizing:border-box; }
  .editnote.mmth-on > .row { width:100% !important; box-sizing:border-box; }
  /* hide only the redundant inline "Edit note:" label next to the field — keep
     the section header (the fieldset's legend) visible (#212). */
  .editnote.mmth-on > .row > label[for] { display:none !important; }
  /* align-items:flex-start (not stretch) so the panel keeps its own bounded
     height. Stretch made the panel grow to match the field, and the #229 floor
     (field min-height = panel height) then fed back through it — each pass added
     the field's padding/border, inflating both without bound (#245). The field is
     still floored to the panel via JS, so it's never shorter. */
  .mmth-wrap { display:flex; gap:0; align-items:flex-start; width:100%; max-width:1040px; margin:6px auto; box-sizing:border-box; position:relative; }
  .mmth-wrap > textarea.edit-note { flex:1 1 auto; width:auto !important; min-width:0; }
  /* #288/#290: foreign edit-note error/warning <p>s that MB (and other scripts)
     insert next to the textarea are RELOCATED out of the flex row by JS (see
     relocateForeign) so they never sit beside the field. No flex-wrap here — that
     made the panel itself wrap below the field in a narrow column (#290). */
  /* Minimized mode (#265): the panel collapses to a small Mammoth badge in the
     field's top-right corner; the field takes the full width and the panel floats
     in only on hover. No width/height coupling, so it can't feed the #245 loop. */
  .mmth-min .mmth-vsep { display:none !important; }
  .mmth-min > .mmth-side { position:absolute; top:30px; right:2px; z-index:60; display:none;
                           box-shadow:0 8px 26px rgba(20,50,35,.22); }
  .mmth-min > .mmth-side.mmth-open { display:flex; }
  .mmth-badge { display:none; position:absolute; top:4px; right:5px; z-index:61; width:25px; height:25px;
                align-items:center; justify-content:center; cursor:pointer; border:1px solid #cfd9d3;
                border-radius:7px; background:#fbfdfc; box-shadow:0 1px 3px rgba(0,0,0,.12);
                font-size:15px; line-height:1; user-select:none; }
  .mmth-badge:hover { background:#eaf5ee; border-color:#5aa67e; }
  .mmth-min > .mmth-badge { display:flex; }
  .mmth-vsep { flex:none; width:9px; align-self:stretch; cursor:col-resize; position:relative; }
  .mmth-vsep::before { content:''; position:absolute; left:4px; top:0; bottom:0; width:1px; background:#d7e0db; }
  .mmth-vsep:hover::before, .mmth-vsep.mmth-dragv::before { background:#5aa67e; width:3px; left:3px; }
  .mmth-hidehelp > p { display:none !important; }
  .mmth-side { flex:0 0 300px; max-width:300px; display:flex; flex-direction:column; border:1px solid #cfd9d3;
               border-radius:8px; background:#fbfdfc; font:12px/1.35 -apple-system,Segoe UI,Arial,sans-serif; overflow:hidden; }
  .mmth-ft { display:flex; align-items:center; gap:2px; padding:3px 5px; border-bottom:1px solid #e7eee9; background:#f1f6f3; }
  .mmth-fb { cursor:pointer; border:none; background:none; font-size:13px; line-height:1; padding:3px 6px; border-radius:5px; color:#566; }
  .mmth-fb:hover { background:#dcefe2; }
  .mmth-fb.on { background:#cfe9d8; color:#1f5c3d; }
  .mmth-fb.mmth-spacer { flex:1; pointer-events:none; }
  .mmth-fb.mmth-grp { margin-left:10px; }
  /* #304: type-ahead filter row + count + sort, between the toolbar and the list */
  .mmth-filterrow { display:flex; align-items:center; gap:5px; padding:3px 5px; border-bottom:1px solid #e7eee9; background:#f7faf8; }
  /* width:auto !important defends against MB's form CSS (#content input/select), which
     otherwise forces a fixed width and squashes the flex layout (#304) */
  .mmth-filter { flex:1 1 auto; min-width:0; width:auto !important; box-sizing:border-box; border:1px solid #d7e0db; border-radius:5px; padding:2px 6px; font:12px -apple-system,Segoe UI,Arial,sans-serif; }
  .mmth-filter:focus { outline:none; border-color:#5aa67e; }
  .mmth-count { flex:none; font-size:11px; color:#8a978f; white-space:nowrap; }
  .mmth-sort { flex:0 0 auto; width:auto !important; min-width:74px; max-width:108px; box-sizing:border-box; border:1px solid #d7e0db; border-radius:5px; padding:1px 3px; font-size:11px; color:#566; background:#fff; }
  /* #304: pinned saved notes as quick-insert buttons — mirrors the baby-field seg bar */
  .mmth-pinbar { display:flex; flex-wrap:wrap; gap:4px; padding:5px; border-bottom:1px solid #e7eee9; background:#fbfdfc; }
  .mmth-segb { border:1px solid #cfd9d3; background:#fff; border-radius:7px; padding:3px 9px; font:12px/1 -apple-system,Segoe UI,Arial,sans-serif; color:#27483a; cursor:pointer; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,.06); }
  .mmth-segb:hover { background:#eaf5ee; border-color:#5aa67e; }
  .mmth-row.mmth-pinned .mmth-txt::before { content:'★'; color:#c2a93e; margin-right:4px; font-size:10px; vertical-align:1px; }
  /* #304: import/export block in Settings */
  .mmth-io { display:flex; flex-direction:column; gap:4px; margin:6px 0 2px; }
  .mmth-io textarea { width:100%; box-sizing:border-box; height:64px; resize:vertical; border:1px solid #d7e0db; border-radius:5px; padding:4px 6px; font:11px/1.35 ui-monospace,Consolas,monospace; }
  .mmth-io-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .mmth-io-btn { cursor:pointer; border:1px solid #cfd9d3; background:#fff; border-radius:5px; padding:2px 8px; font-size:12px; color:#27483a; }
  .mmth-io-btn:hover { background:#eaf5ee; border-color:#5aa67e; }
  .mmth-list { flex:1 1 auto; overflow-y:auto; scrollbar-width:none; }
  .mmth-list::-webkit-scrollbar { width:0; height:0; }
  .mmth-row { display:flex; align-items:center; gap:4px; padding:4px 6px; border-top:1px solid #f0f4f2; cursor:pointer; }
  .mmth-row:first-child { border-top:none; }
  .mmth-row:hover { background:#eaf5ee; }
  .mmth-row.mmth-cyc { background:#d9efe1; }
  .mmth-row.mmth-drop-before { box-shadow:inset 0 2px 0 #2c7a51; }
  .mmth-row.mmth-drop-after { box-shadow:inset 0 -2px 0 #2c7a51; }
  .mmth-row.mmth-dragging { opacity:.45; }
  .mmth-grab { flex:none; cursor:grab; color:#b7c2bb; font-size:12px; user-select:none; opacity:0; }
  .mmth-row:hover .mmth-grab { opacity:1; }
  .mmth-grab:active { cursor:grabbing; }
  .mmth-txt { flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#293330; }
  .mmth-rowacts { flex:none; display:flex; gap:1px; opacity:0; }
  .mmth-row:hover .mmth-rowacts { opacity:1; }
  .mmth-ra { cursor:pointer; border:none; background:none; color:#7d8a82; font-size:11px; line-height:1; padding:1px 2px; border-radius:3px; }
  .mmth-ra:hover { background:#cfe9d8; color:#1f5c3d; }
  .mmth-empty { padding:12px 8px; color:#9aa6a0; font-style:italic; text-align:center; }
  .mmth-pop { position:fixed; z-index:99999; background:#fff; border:1px solid #c7d3cc; border-radius:8px; box-shadow:0 8px 26px rgba(20,50,35,.2);
              padding:10px 12px; font:13px/1.45 -apple-system,Segoe UI,Arial,sans-serif; color:#222; width:280px; }
  .mmth-pop h4 { margin:-10px -12px 8px; padding:6px 10px; font-size:13px; display:flex; align-items:center; gap:6px; background:#f1f6f3; border-bottom:1px solid #e7eee9; border-radius:8px 8px 0 0; }
  .mmth-tip { color:#8a978f; font-size:11px; margin:0 0 4px 22px; }
  .mmth-pop h4 .mmth-ver { color:#8a978f; font-weight:400; font-size:11px; }
  .mmth-pop h4 a { margin-left:auto; font-size:11px; color:#2c7a51; text-decoration:none; font-weight:600; }
  .mmth-pop h4 .mmth-h4ic { display:inline-flex; width:18px; height:18px; flex:none; }   /* #308 vector mammoth */
  .mmth-badge svg { width:19px; height:19px; }                                            /* #308 vector mammoth */
  .mmth-pop label { display:flex; align-items:center; gap:6px; margin:5px 0; cursor:pointer; }
  .mmth-pop input[type="number"] { width:46px; border:1px solid #d7e0db; border-radius:4px; padding:1px 4px; }
  .mmth-pop select { border:1px solid #d7e0db; border-radius:4px; padding:1px 4px; }
  .mmth-pop code { background:#f1f4f2; border-radius:3px; padding:0 3px; font-size:12px; }
  .mmth-pop .mmth-syn { display:grid; grid-template-columns:auto 1fr; gap:3px 10px; margin:4px 0; }
  .mmth-pop .mmth-sub { font-weight:600; font-size:12px; margin:8px 0 2px; }
  .mmth-toast { position:fixed; z-index:100000; background:#2c3a33; color:#fff; padding:6px 12px; border-radius:6px; font:13px sans-serif; box-shadow:0 4px 14px rgba(0,0,0,.25); left:50%; top:14px; transform:translateX(-50%); }
  `;
  (function () { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); })();
  // #268: only the release editor wants its edit-note .half-width column widened to
  // full width. Tag it so the widening rule above is scoped to it and never disturbs
  // the two-column layout of entity create/edit pages (artist, label, work, …).
  if (/^\/release\/(?:add|[0-9a-f-]{36}\/edit)(?:[/?#]|$)/.test(location.pathname)) document.documentElement.classList.add('mmth-reledit');

  // Show a toast near where the user is acting (the Mammoth panel / button they just
  // clicked) instead of pinned to the top of the page, which reads as unrelated (#268
  // follow-up). Falls back to top-centre when there's no recent Mammoth interaction.
  let _toastPt = null;
  document.addEventListener('pointerdown', e => { const t = e.target.closest && e.target.closest('.mmth-side, .mmth-pop, .mmth-wrap, .mmth-badge'); if (t) _toastPt = { x: e.clientX, y: e.clientY }; }, true);
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'mmth-toast'; t.textContent = msg; document.body.appendChild(t);
    if (_toastPt) {   // anchor just above the click point, clamped into the viewport
      const w = t.offsetWidth, h = t.offsetHeight;
      const left = Math.max(6, Math.min(window.innerWidth - w - 6, _toastPt.x - w / 2));
      const top = Math.max(6, Math.min(window.innerHeight - h - 6, _toastPt.y - h - 10));
      t.style.left = left + 'px'; t.style.top = top + 'px'; t.style.transform = 'none';
    }
    setTimeout(() => t.remove(), 1500);
  }

  // #305: our popovers dismiss on an outside *mousedown* (capture). The click that
  // completes that mousedown then lands on whatever was under the popover — and if
  // that's a link/button (e.g. Apollo's cover-art thumbnail, a target=_blank anchor
  // that can sit beneath a field popover before the layout settles), the dismiss
  // click activates it: a stray "cover art opened when selecting a label". Swallow
  // exactly that one click so a dismiss never doubles as activating something below.
  function eatNextClick() {
    const eat = ev => { ev.preventDefault(); ev.stopPropagation(); };
    document.addEventListener('click', eat, true);
    setTimeout(() => document.removeEventListener('click', eat, true), 0);
  }

  // ── popovers (settings + syntax help) ────────────────────────────────────────
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', onPopDown, true); } }
  function onPopDown(e) { if (pop && !pop.contains(e.target) && !e.target.closest('.mmth-pop-anchor')) { closePop(); eatNextClick(); } }
  function placePop(p, anchor) {
    const r = anchor.getBoundingClientRect();
    p.style.top = Math.max(6, r.top - p.offsetHeight - 6) + 'px';
    p.style.left = Math.max(6, Math.min(window.innerWidth - p.offsetWidth - 6, r.right - p.offsetWidth)) + 'px';
    setTimeout(() => document.addEventListener('mousedown', onPopDown, true), 0);
  }
  function openSettings(anchor) {
    closePop();
    const p = document.createElement('div'); p.className = 'mmth-pop';
    p.innerHTML = `
      <h4><span class="mmth-h4ic">${MAMMOTH_SVG}</span> Mammoth <span class="mmth-ver">v${scriptVersion()}</span><a href="${HELP_URL}" target="_blank" rel="noopener" title="Open the README">? Help</a></h4>
      <label><input type="checkbox" class="mmth-s-help"> Hide edit-note help text</label>
      <label>Default click action
        <select class="mmth-s-ins"><option value="replace">replace</option><option value="append">append</option></select>
      </label>
      <div class="mmth-tip">Right-click does the other action.</div>
      <label><input type="checkbox" class="mmth-s-nl"> Insert empty line when appending</label>
      <label>Items shown <input type="number" class="mmth-s-rows" min="1" max="30"></label>
      <label>History size <input type="number" class="mmth-s-hist" min="1" max="50"></label>
      <label><input type="checkbox" class="mmth-s-babies"> Show mammoth babies</label>
      <div class="mmth-tip">Save &amp; reuse values on other fields (catalog №, label, status…).</div>`;
    document.body.appendChild(p); pop = p;
    const help = p.querySelector('.mmth-s-help'); help.checked = !!SET.hideHelp;
    const ins = p.querySelector('.mmth-s-ins'); ins.value = SET.defaultInsert;
    const nl = p.querySelector('.mmth-s-nl'); nl.checked = SET.appendNewline !== false;
    const rows = p.querySelector('.mmth-s-rows'); rows.value = SET.visibleRows;
    const hist = p.querySelector('.mmth-s-hist'); hist.value = SET.historySize;
    help.onchange = () => { SET.hideHelp = help.checked; saveSet(); };
    ins.onchange = () => { SET.defaultInsert = ins.value; saveSet(); };
    nl.onchange = () => { SET.appendNewline = nl.checked; saveSet(); };
    rows.onchange = () => { SET.visibleRows = Math.max(1, Math.min(30, parseInt(rows.value, 10) || 6)); rows.value = SET.visibleRows; saveSet(); };
    hist.onchange = () => { SET.historySize = Math.max(1, Math.min(50, parseInt(hist.value, 10) || 10)); hist.value = SET.historySize; saveSet(); recordHistory(''); };
    const babies = p.querySelector('.mmth-s-babies'); babies.checked = SET.showBabies !== false;
    babies.onchange = () => { SET.showBabies = babies.checked; persistSet(); babyMammoths.toggle(babies.checked); };
    placePop(p, anchor);
  }
  // #304: dedicated Import / Export popover (was buried in Settings — bad UX).
  function openIO(anchor) {
    closePop();
    const p = document.createElement('div'); p.className = 'mmth-pop';
    p.innerHTML = `
      <h4><span class="mmth-h4ic">${MAMMOTH_SVG}</span> Import / export notes</h4>
      <div class="mmth-tip" style="margin-left:0">Import adds to your saved notes; Export copies them all to the clipboard.</div>
      <div class="mmth-io">
        <textarea class="mmth-io-ta" placeholder="Paste notes here to import — one per line."></textarea>
        <label style="margin:2px 0;font-size:11px"><input type="checkbox" class="mmth-io-block"> a blank line separates notes (for multi-line notes)</label>
        <div class="mmth-io-row">
          <button type="button" class="mmth-io-btn mmth-io-import">Import</button>
          <button type="button" class="mmth-io-btn mmth-io-export">Export all</button>
          <span class="mmth-io-msg" style="font-size:11px;color:#8a978f"></span>
        </div>
      </div>`;
    document.body.appendChild(p); pop = p;
    const ioTa = p.querySelector('.mmth-io-ta'), ioBlock = p.querySelector('.mmth-io-block'), ioMsg = p.querySelector('.mmth-io-msg');
    p.querySelector('.mmth-io-import').onclick = () => {
      const v = ioTa.value; if (!v.trim()) { ioMsg.textContent = 'Paste some notes first'; return; }
      const r = importNotes(v, ioBlock.checked);
      ioMsg.textContent = `Added ${r.added} of ${r.seen}` + (r.added < r.seen ? ' (rest were duplicates)' : '');
      if (r.added) ioTa.value = '';
    };
    p.querySelector('.mmth-io-export').onclick = async () => {
      const text = exportNotes(); ioTa.value = text; ioTa.focus(); ioTa.select();
      let copied = false; try { await navigator.clipboard.writeText(text); copied = true; } catch (e) { try { copied = document.execCommand('copy'); } catch (x) {} }
      ioMsg.textContent = `${DATA.saved.length} note(s)` + (copied ? ' — copied to clipboard' : ' — select & copy');
    };
    placePop(p, anchor);
  }
  function openSyntax(anchor) {
    closePop();
    const p = document.createElement('div'); p.className = 'mmth-pop';
    p.innerHTML = `
      <h4>Edit-note syntax<a href="${SYNTAX_URL}" target="_blank" rel="noopener" title="Full documentation">doc ↗</a></h4>
      <div class="mmth-syn">
        <code>''italic''</code><span><i>italic</i></span>
        <code>'''bold'''</code><span><b>bold</b></span>
        <code>edit #123456</code><span>link to an edit</span>
        <code>doc:Page</code><span>or <code>[Page_Name]</code> — wiki doc link</span>
      </div>
      <div style="color:#566">URLs become links automatically. HTML is not supported.</div>
      <div class="mmth-sub">Shortcuts</div>
      <div class="mmth-syn">
        <code>Ctrl/⌘ B</code><span>bold the selection / word</span>
        <code>Ctrl/⌘ I</code><span>italicise the selection / word</span>
        <code>Ctrl/⌘ ↑/↓</code><span>cycle saved notes</span>
      </div>`;
    document.body.appendChild(p); pop = p;
    placePop(p, anchor);
  }

  // ── sidebars (one per edit-note textarea) ────────────────────────────────────
  const instances = [];
  function applyHelp() { document.querySelectorAll('.editnote').forEach(en => en.classList.toggle('mmth-hidehelp', !!SET.hideHelp)); }
  const after = (e, el) => (e.clientY - el.getBoundingClientRect().top) > el.offsetHeight / 2;
  const clearMarks = host => host && host.querySelectorAll('.mmth-drop-before,.mmth-drop-after').forEach(r => r.classList.remove('mmth-drop-before', 'mmth-drop-after'));
  let _drag = null;

  function setSideWidth(side, w) { w = Math.max(160, Math.min(640, Math.round(w))); side.style.flex = '0 0 ' + w + 'px'; side.style.maxWidth = w + 'px'; return w; }

  // #263: never let the panel be wider than the field — cap it to half the row so
  // the ratio is at most 1:1 (was up to ~1:10 in a narrow Art Station modal). The
  // cap reads ONLY the wrap's width, which the container fixes and setting the
  // panel never changes, so this can't oscillate (unlike a field-width-based cap,
  // which would: shrinking the panel grows the field, re-raising the cap…).
  function capPanel(wrap, vsep, side) {
    if (SET.minimized) return;   // panel is out of flow when minimized
    const row = wrap.clientWidth - (vsep ? vsep.offsetWidth : 0); if (!(row > 0)) return;
    const max = Math.floor(row / 2);
    const want = Math.max(160, Math.min(SET.sideWidth || 300, max));
    if (Math.round(side.getBoundingClientRect().width) !== want) { side.style.flex = '0 0 ' + want + 'px'; side.style.maxWidth = want + 'px'; }
  }

  // ── minimized mode (#265) ─────────────────────────────────────────────────────
  // A less-intrusive mode: the panel collapses to a small Mammoth badge in the
  // field's top-right corner and floats back in on hover. Persisted, so it stays
  // minimized across edit pages. WIDTH/position only — never touches the field's
  // height, so it can't reintroduce the #245 growth loop.
  function applyMinState(inst) {
    const wrap = inst.ta && inst.ta.closest('.mmth-wrap'); if (!wrap) return;
    const on = !!SET.minimized;
    wrap.classList.toggle('mmth-min', on);
    if (inst.minBtn) { inst.minBtn.textContent = on ? '⤢' : '–'; inst.minBtn.title = on ? 'Restore the panel' : 'Minimize to corner'; }
    if (on) { try { inst.ta.style.minHeight = ''; } catch (x) {} }       // drop the panel-height floor — panel is out of flow now
    if (!on) { if (inst.unpin) inst.unpin(); if (inst.side) inst.side.classList.remove('mmth-open'); }
  }
  function setMinimized(on) { SET.minimized = !!on; persistSet(); instances.forEach(i => { applyMinState(i); if (i.recap) i.recap(); }); }

  // drag the separator to resize the panel vs. the field (persisted)
  function wireResize(vsep, side) {
    let startX = 0, startW = 0, on = false;
    vsep.addEventListener('pointerdown', e => { on = true; startX = e.clientX; startW = side.getBoundingClientRect().width; try { vsep.setPointerCapture(e.pointerId); } catch (x) {} vsep.classList.add('mmth-dragv'); document.body.style.userSelect = 'none'; e.preventDefault(); });
    vsep.addEventListener('pointermove', e => {   // panel is on the right → drag left widens it; cap at half the row (#263)
      if (!on) return;
      const wrap = side.parentNode, row = (wrap ? wrap.clientWidth : 0) - vsep.offsetWidth;
      const max = row > 0 ? Math.floor(row / 2) : 640;
      setSideWidth(side, Math.min(max, startW - (e.clientX - startX)));
    });
    const end = e => { if (!on) return; on = false; vsep.classList.remove('mmth-dragv'); document.body.style.userSelect = ''; SET.sideWidth = setSideWidth(side, side.getBoundingClientRect().width); saveSet(); try { vsep.releasePointerCapture(e.pointerId); } catch (x) {} };
    vsep.addEventListener('pointerup', end); vsep.addEventListener('pointercancel', end);
  }

  function buildSide(ta) {
    const side = document.createElement('div'); side.className = 'mmth-side';
    setSideWidth(side, SET.sideWidth || 300);
    const ft = document.createElement('div'); ft.className = 'mmth-ft';            // toolbar ON TOP (#212)
    const pinbar = document.createElement('div'); pinbar.className = 'mmth-pinbar';   // #304 pinned quick-buttons
    const filterRow = document.createElement('div'); filterRow.className = 'mmth-filterrow';   // #304 filter + count + sort
    const list = document.createElement('div'); list.className = 'mmth-list';
    side.appendChild(ft); side.appendChild(pinbar); side.appendChild(filterRow); side.appendChild(list);

    const inst = { ta, list, side, pinbar, filterRow, view: 'saved', cycId: null, filter: '', viewItems: [] };
    instances.push(inst);

    // #304: filter input + N/total count + sort selector (Saved view only)
    const fInput = document.createElement('input'); fInput.type = 'text'; fInput.className = 'mmth-filter'; fInput.placeholder = 'Filter notes…';
    fInput.addEventListener('input', () => { inst.filter = fInput.value; renderInst(inst); });
    fInput.addEventListener('keydown', e => { if (e.key === 'Escape') { fInput.value = ''; inst.filter = ''; renderInst(inst); } });
    const fCount = document.createElement('span'); fCount.className = 'mmth-count'; inst.countEl = fCount;
    const fSort = document.createElement('select'); fSort.className = 'mmth-sort'; fSort.title = 'Sort saved notes';
    fSort.innerHTML = '<option value="manual">Manual</option><option value="uses">Most used</option><option value="recent">Recent</option>';
    fSort.value = SET.noteSort || 'manual';
    fSort.addEventListener('change', () => { SET.noteSort = fSort.value; persistSet(); render(); });
    inst.sortEl = fSort;
    filterRow.appendChild(fInput); filterRow.appendChild(fCount); filterRow.appendChild(fSort);

    const fb = (glyph, title, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-fb' + (cls ? ' ' + cls : ''); b.textContent = glyph; b.title = title; b.onclick = fn; return b; };
    ft.appendChild(fb('＋', 'Save current edit note', '', () => { const v = (ta.value || '').trim(); if (!v) return toast('Edit note is empty'); toast(addSaved(v) ? 'Saved' : 'Already saved'); }));
    const bSaved = fb('★', 'Saved notes', 'mmth-grp', () => { inst.view = 'saved'; renderInst(inst); });
    const bHist = fb('🕘', 'History (last used)', '', () => { inst.view = 'history'; renderInst(inst); });
    ft.appendChild(bSaved); ft.appendChild(bHist);
    ft.appendChild(fb('✕', 'Clear the edit note', 'mmth-grp', () => { setValue(ta, ''); ta.focus(); }));
    const sp = document.createElement('span'); sp.className = 'mmth-fb mmth-spacer'; ft.appendChild(sp);
    ft.appendChild(fb('⇅', 'Import / export saved notes', 'mmth-pop-anchor', e => openIO(e.currentTarget)));   // #304: dedicated, not in Settings
    inst.minBtn = fb('–', 'Minimize to corner', 'mmth-min-btn', () => setMinimized(!SET.minimized));   // #265: left of the ? button
    ft.appendChild(inst.minBtn);
    ft.appendChild(fb('?', 'Edit-note syntax', 'mmth-pop-anchor', e => openSyntax(e.currentTarget)));
    ft.appendChild(fb('⚙︎', 'Settings', 'mmth-pop-anchor', e => openSettings(e.currentTarget)));
    inst.tabs = { saved: bSaved, history: bHist };

    ta.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      // Ctrl/⌘+B / +I wrap the selection in MB edit-note bold / italic markup
      if (k === 'b' || k === 'i') { e.preventDefault(); wrapSel(ta, k === 'b' ? "'''" : "''"); return; }
      // Ctrl/⌘+↑/↓ cycle through saved notes, replacing the field (focus stays here)
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (inst.view !== 'saved') { inst.view = 'saved'; inst.tabs && inst.tabs.saved.classList.add('on'); inst.tabs && inst.tabs.history.classList.remove('on'); renderInst(inst); }
      // cycle through exactly what's shown (respects the current sort + filter) #304
      const items = inst.viewItems; if (!items || !items.length) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let i = items.findIndex(x => x.id === inst.cycId);
      if (i < 0) i = dir > 0 ? -1 : 0;
      i = (i + dir + items.length) % items.length;
      inst.cycId = items[i].id;
      setValue(ta, items[i].text);
      renderInst(inst);
      // keep the highlighted item visible — scroll WITHIN the list only (not the page)
      const cur = inst.list.querySelector('.mmth-cyc');
      if (cur) { const lr = inst.list.getBoundingClientRect(), cr = cur.getBoundingClientRect();
        if (cr.top < lr.top) inst.list.scrollTop -= (lr.top - cr.top);
        else if (cr.bottom > lr.bottom) inst.list.scrollTop += (cr.bottom - lr.bottom); }
      // setValue can trigger a React re-render on the release editor that steals
      // focus; re-assert it now AND after the re-render so the editor stays focused.
      const refocus = () => { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (x) {} };
      refocus(); requestAnimationFrame(refocus); setTimeout(refocus, 0);
    });

    renderInst(inst);
    return inst;
  }

  // #304: pinned saved notes shown as one-click quick-insert buttons (Saved view).
  function renderPinbar(inst) {
    const bar = inst.pinbar; bar.innerHTML = '';
    const pinned = inst.view === 'saved' ? DATA.saved.filter(s => s.pinned) : [];
    if (!pinned.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const cap = t => { t = t.replace(/\s+/g, ' ').trim(); return t.length > 24 ? t.slice(0, 24) + '…' : t; };
    const dflt = SET.defaultInsert;
    pinned.forEach(it => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-segb'; b.textContent = cap(it.text);
      b.title = it.text + `\n\n(click: ${dflt} · right-click: ${dflt === 'replace' ? 'append' : 'replace'})`;
      b.onclick = e => { e.preventDefault(); applyNote(inst.ta, it.text, dflt === 'replace'); bumpUse(it.id); };
      b.oncontextmenu = e => { e.preventDefault(); applyNote(inst.ta, it.text, dflt !== 'replace'); bumpUse(it.id); };
      bar.appendChild(b);
    });
  }

  function renderInst(inst) {
    const { ta, list } = inst;
    list.style.maxHeight = (Math.max(1, Math.min(30, SET.visibleRows | 0 || 6)) * 26) + 'px';   // show N items, then scroll (#212)
    list.innerHTML = '';
    if (inst.tabs) { inst.tabs.saved.classList.toggle('on', inst.view === 'saved'); inst.tabs.history.classList.toggle('on', inst.view === 'history'); }
    const saved = inst.view === 'saved';
    if (inst.sortEl) { inst.sortEl.value = SET.noteSort || 'manual'; inst.sortEl.style.display = saved ? '' : 'none'; }
    renderPinbar(inst);
    // #304: sort (Saved) then type-ahead filter on the full note text; show N/total
    const all = saved ? sortedSaved() : DATA.history;
    const q = (inst.filter || '').trim().toLowerCase();
    const items = q ? all.filter(it => it.text.toLowerCase().includes(q)) : all;
    inst.viewItems = items;   // Ctrl+↑/↓ cycles through exactly what's shown
    if (inst.countEl) inst.countEl.textContent = q ? (items.length + ' / ' + all.length) : (all.length ? String(all.length) : '');
    // drag-reorder only makes sense in the unfiltered manual order
    const manual = saved && (SET.noteSort || 'manual') === 'manual' && !q;
    if (!items.length) { const e = document.createElement('div'); e.className = 'mmth-empty'; e.textContent = all.length ? 'No notes match the filter' : (saved ? 'No saved notes — ＋ saves the current one' : 'No history yet'); list.appendChild(e); return; }

    items.forEach((it) => {
      const row = document.createElement('div'); row.className = 'mmth-row';
      if (saved && it.pinned) row.classList.add('mmth-pinned');
      if (saved && it.id === inst.cycId) row.classList.add('mmth-cyc');
      const dflt = SET.defaultInsert;
      row.title = it.text + `\n\n(click: ${dflt} · right-click: ${dflt === 'replace' ? 'append' : 'replace'} · shift-click: set + submit)`;

      const txt = document.createElement('span'); txt.className = 'mmth-txt'; txt.textContent = it.text.replace(/\s+/g, ' ').trim();
      row.appendChild(txt);

      // right-side hover actions: pin/unpin + delete (saved); save + remove (history)
      const acts = document.createElement('div'); acts.className = 'mmth-rowacts';
      const ra = (glyph, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-ra'; b.textContent = glyph; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); }; acts.appendChild(b); };
      if (saved) { ra(it.pinned ? '★' : '☆', it.pinned ? 'Unpin from quick buttons' : 'Pin as a quick button', () => togglePinNote(it.id)); ra('🗑', 'Delete', () => removeSaved(it.id)); }
      else { ra('★', 'Save (pin to Saved)', () => { if (addSaved(it.text)) toast('Saved'); }); ra('🗑', 'Remove', () => removeHistory(it.text)); }
      row.appendChild(acts);

      if (manual) {
        const grab = document.createElement('span'); grab.className = 'mmth-grab'; grab.textContent = '⠿'; grab.title = 'Drag to reorder'; grab.draggable = true;
        grab.addEventListener('dragstart', e => { _drag = { id: it.id }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'row'); } catch (x) {} row.classList.add('mmth-dragging'); });
        grab.addEventListener('dragend', () => { row.classList.remove('mmth-dragging'); clearMarks(list); _drag = null; });
        row.appendChild(grab);
      }

      row.onclick = e => {
        // #289: shift-click sets the note (replace) AND submits the edit — like
        // Ctrl+Enter (reuses findSubmitBtn) — a time-saver for repetitive merges.
        if (e.shiftKey) { applyNote(ta, it.text, true); if (saved) bumpUse(it.id); const b = findSubmitBtn(ta); if (b) b.click(); return; }
        applyNote(ta, it.text, SET.defaultInsert === 'replace'); if (saved) bumpUse(it.id);
      };
      row.oncontextmenu = e => { e.preventDefault(); applyNote(ta, it.text, SET.defaultInsert !== 'replace'); if (saved) bumpUse(it.id); };
      if (manual) {
        row.addEventListener('dragover', e => { if (!_drag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; clearMarks(list); row.classList.add(after(e, row) ? 'mmth-drop-after' : 'mmth-drop-before'); });
        row.addEventListener('dragleave', () => row.classList.remove('mmth-drop-before', 'mmth-drop-after'));
        row.addEventListener('drop', e => { if (!_drag) return; e.preventDefault(); reorder(_drag.id, it.id, !after(e, row)); clearMarks(list); _drag = null; });
      }
      list.appendChild(row);
    });
  }

  function render() { instances.forEach(i => { if (i.list.isConnected) renderInst(i); }); }

  // ── attach ───────────────────────────────────────────────────────────────────
  function injectAll() {
    applyHelp();
    document.querySelectorAll('textarea.edit-note').forEach(ta => {
      if (ta.dataset.mmth) return;
      ta.dataset.mmth = '1';
      const en = ta.closest('.editnote'); if (en) en.classList.add('mmth-on');   // hides the redundant inline "Edit note:" label (#212)
      const wrap = document.createElement('div'); wrap.className = 'mmth-wrap';
      ta.parentNode.insertBefore(wrap, ta);
      wrap.appendChild(ta);
      // remember the textarea height the user sets with the native resize grip (vertical);
      // the splitter (below) remembers the field/panel split (horizontal).
      if (SET.taHeight) ta.style.height = SET.taHeight + 'px';
      // Persist ONLY a deliberate user resize (height changes between mouse down
      // and up on the field). The old ResizeObserver fired on any layout-driven
      // size change too, so visiting a differently-sized edit page (e.g. the
      // full-width release editor) silently overwrote the saved height.
      let _downH = null;
      ta.addEventListener('mousedown', () => { _downH = ta.offsetHeight; });
      window.addEventListener('mouseup', () => {
        if (_downH == null) return;
        const h = ta.offsetHeight; const was = _downH; _downH = null;
        if (h > 40 && h !== was && h !== SET.taHeight) { SET.taHeight = h; ta.style.height = h + 'px'; persistSet(); }
      });
      const vsep = document.createElement('div'); vsep.className = 'mmth-vsep'; vsep.title = 'Drag to resize'; wrap.appendChild(vsep);   // resizable separator between field & panel (#212)
      const inst = buildSide(ta); const side = inst.side; wrap.appendChild(side);
      wireResize(vsep, side);

      // #265 minimized mode: badge in the field's top-right corner; hover (or click
      // to pin) floats the panel back in. mouseleave closes after a short grace.
      const badge = document.createElement('div'); badge.className = 'mmth-badge'; badge.title = 'Mammoth — saved notes (click or hover)';
      badge.innerHTML = MAMMOTH_SVG;   // #308 vector, not the 🦣 emoji
      wrap.appendChild(badge); inst.badge = badge;

      // #288/#290: MB (and other scripts, e.g. jesus2099's MERGE HELPOR) insert
      // edit-note error/warning <p>s as siblings of the textarea — which now lives
      // inside our flex .mmth-wrap, so they'd be laid out BESIDE the field. Keep the
      // wrap a clean row (field | sep | panel | badge) and relocate any foreign child
      // OUT to normal flow: warnings above the wrap, validation/other notices below.
      // (Doing this in JS instead of flex-wrap avoids the panel itself wrapping below
      // the field in a narrow left-column layout — #290.)
      const isOurs = el => el === ta || (el.classList && (el.classList.contains('mmth-vsep') || el.classList.contains('mmth-side') || el.classList.contains('mmth-badge')));
      const relocateForeign = node => {
        if (!node || node.nodeType !== 1 || isOurs(node) || !wrap.parentNode) return;
        const above = node.classList && node.classList.contains('error') && !node.classList.contains('invalid');
        wrap.parentNode.insertBefore(node, above ? wrap : wrap.nextSibling);
      };
      [...wrap.children].forEach(relocateForeign);
      new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(relocateForeign))).observe(wrap, { childList: true });
      let closeT = null, pinned = false;
      const openFloat = () => { clearTimeout(closeT); if (SET.minimized) side.classList.add('mmth-open'); };
      const closeFloat = () => { clearTimeout(closeT); if (pinned) return; closeT = setTimeout(() => side.classList.remove('mmth-open'), 220); };
      badge.addEventListener('mouseenter', openFloat);
      badge.addEventListener('mouseleave', closeFloat);
      side.addEventListener('mouseenter', openFloat);
      side.addEventListener('mouseleave', closeFloat);
      // click the badge to pin the panel open (so it survives mouse-out); click again to unpin
      badge.addEventListener('click', () => { if (!SET.minimized) return; pinned = !pinned; pinned ? openFloat() : side.classList.remove('mmth-open'); });
      inst.unpin = () => { pinned = false; };
      applyMinState(inst);

      // #263: keep the panel ≤ half the row (never wider than the field). Driven by
      // the WRAP's width only — stable, no feedback loop.
      const cap = () => capPanel(wrap, vsep, side);
      cap(); requestAnimationFrame(cap); setTimeout(cap, 200);
      try { new ResizeObserver(cap).observe(wrap); } catch (x) {}
      inst.recap = cap;
      // The saved-notes panel's height (driven by the Items Shown setting) is the
      // field's floor, so it's never shorter than the sidebar. With no user-saved
      // height the field STARTS at exactly that height too — so its initial size
      // tracks Items Shown — until the user drags the grip (which is remembered).
      const syncFloor = () => { try {
        // Minimized: the panel floats out of flow, so the field needs no floor —
        // applying one here while the panel shows on hover would couple field
        // height to panel height (the #245 loop). Clear it and bail.
        if (SET.minimized) { if (ta.style.minHeight) ta.style.minHeight = ''; return; }
        const h = side.offsetHeight; if (!(h > 0)) return;
        if ((parseInt(ta.style.minHeight, 10) || 0) !== h) ta.style.minHeight = h + 'px';
        if (!SET.taHeight && (parseInt(ta.style.height, 10) || 0) !== h) ta.style.height = h + 'px';
      } catch (x) {} };
      syncFloor();
      requestAnimationFrame(syncFloor); setTimeout(syncFloor, 150); setTimeout(syncFloor, 600);   // catch the sidebar's final layout
      try { new ResizeObserver(syncFloor).observe(side); } catch (x) {}
    });
  }
  new MutationObserver(() => injectAll()).observe(document.documentElement, { childList: true, subtree: true });

  // #252 Ctrl/Cmd+Enter submits the edit. The submit control differs per page, so
  // look in order: the release editor's "Enter edit" button, then the edit form's
  // own submit, then a visible button labelled Enter edit / Submit / Finish. Only
  // act when focus is in the edit-note field or Mammoth's panel (or nowhere), so it
  // never hijacks Ctrl+Enter in some unrelated field.
  const isVisible = b => !!(b && b.offsetParent !== null && !b.disabled);
  function findSubmitBtn(ta) {
    const re = document.getElementById('enter-edit');
    if (isVisible(re)) return re;
    const form = ta && ta.closest('form');
    if (form) { const s = form.querySelector('button.submit, button[type="submit"], button.positive'); if (isVisible(s)) return s; }
    return [...document.querySelectorAll('button')].find(b => isVisible(b) && /^\s*(enter edit|submit|finish)\b/i.test(b.textContent || '')) || null;
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const ta = document.querySelector('textarea.edit-note'); if (!ta) return;
    const t = e.target;
    if (t !== ta && !(t && t.closest && t.closest('.mmth-wrap, .mmth-side, .mmth-pop')) && t !== document.body) return;
    const btn = findSubmitBtn(ta);
    if (btn) { e.preventDefault(); btn.click(); }
  });

  injectAll();
  if (SET.showBabies !== false) babyMammoths.start();

  // ════════════════════════════════════════════════════════════════════════════
  //  BABY MAMMOTHS — field memory for arbitrary input controls
  //  Self-contained (own storage key, own CSS, own DOM), gated by SET.showBabies.
  //  start()/stop() let the ⚙ toggle add/remove it cleanly at runtime.
  // ════════════════════════════════════════════════════════════════════════════
  function createBabyMammoths() {
    const FKEY = 'mammoth-fields:data';          // { [fieldKey]: [{ v, label, ts, pinned?, default? }] }
    const MAX_PER_FIELD = 25;
    // #296 follow-up — capture the selected ENTITY's MBID for autocomplete fields,
    // so a saved Label/Artist resolves the real entity on recall (writeField pastes
    // the MBID, which MB resolves) instead of being text-only. The gid comes from
    // the live release editor model; unsafeWindow reaches the page's MB from the
    // userscript sandbox. Falls back to text when nothing is selected / off-editor.
    const PAGEWIN = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
    const relEntity = () => { try { return PAGEWIN.MB.releaseEditor.rootField.release(); } catch (e) { return null; } };
    const labelGid = el => { const i = +((String(el.id).match(/-(\d+)$/) || [])[1] || 0); const r = relEntity(); const labs = r && r.labels && r.labels(); const L = labs && labs[i] && labs[i].label && labs[i].label(); return (L && L.gid) || null; };
    const _unwrap = x => (typeof x === 'function' ? x() : x);
    const artistGid = () => {   // single-artist box only: exactly one real artist (names has a trailing blank)
      const r = relEntity(); const ac = r && r.artistCredit && r.artistCredit();
      let ns = ac && ac.names; ns = _unwrap(ns); if (!ns) return null;
      const real = [...ns].map(n => _unwrap(n.artist)).filter(a => a && a.gid);
      return real.length === 1 ? real[0].gid : null;
    };
    // a specific row of the artist-credit editor bubble (ac-source-artist-<i>)
    const artistRowGid = el => {
      const i = +((String(el.id).match(/-(\d+)$/) || [])[1] || 0);
      const r = relEntity(); const ac = r && r.artistCredit && r.artistCredit();
      const ns = _unwrap(ac && ac.names); const a = ns && ns[i] && _unwrap(ns[i].artist);
      return (a && a.gid) || null;
    };
    // Built-in release add/edit targets. `key` is a STABLE, index-free storage key
    // (catno-0/label-0 are per-medium, but saved values are shared). `gid` (entity
    // fields) resolves the selected entity's MBID for capture.
    const PREDEF = [
      { match: 'input[id^="catno-"]',      key: 'release.catno',        label: 'Catalog number' },
      { match: '#primary-type',            key: 'release.primary_type', label: 'Primary type' },
      { match: '#packaging',               key: 'release.packaging',    label: 'Packaging' },
      { match: '#status',                  key: 'release.status',       label: 'Status' },
      { match: '#language',                key: 'release.language',     label: 'Language' },
      { match: '#script',                  key: 'release.script',       label: 'Script' },
      { match: 'select[id^="country-"]',   key: 'release.country',      label: 'Country' },
      { match: 'input[id^="label-"]',      key: 'release.label',        label: 'Label',  gid: labelGid },
      { match: '#ac-source-single-artist', key: 'release.artist',       label: 'Artist', gid: artistGid },
      { match: 'input[id^="ac-source-artist-"]', key: 'release.artist', label: 'Artist', gid: artistRowGid },   // artist-credit editor bubble rows
    ];

    const loadF = () => { try { return JSON.parse(GM_getValue(FKEY, '{}') || '{}'); } catch (e) { return {}; } };
    const saveF = () => { try { GM_setValue(FKEY, JSON.stringify(FDATA)); } catch (e) {} };
    let FDATA = loadF();

    const listFor = key => (FDATA[key] = FDATA[key] || []);
    function rememberValue(key, rec) {
      if (!rec || !rec.v) return false;
      const a = listFor(key); const e = a.find(x => x.v === rec.v);
      if (e) { e.label = rec.label || e.label; e.ts = Date.now(); }   // already saved → keep it (and its ★ / default / order)
      else { a.unshift({ v: rec.v, label: rec.label || rec.v, ts: Date.now() }); FDATA[key] = a.slice(0, MAX_PER_FIELD); }
      saveF(); return true;
    }
    const forgetValue = (key, v) => { FDATA[key] = listFor(key).filter(x => x.v !== v); saveF(); };
    const togglePin = (key, v) => { const e = listFor(key).find(x => x.v === v); if (e) { e.pinned = !e.pinned; saveF(); } };
    function setDefault(key, v) { const a = listFor(key); const e = a.find(x => x.v === v); if (!e) return; const was = e.default; a.forEach(x => x.default = false); e.default = !was; saveF(); }
    const defaultOf = key => listFor(key).find(x => x.default);
    // drag-reorder a saved value relative to another (like the edit-note panel's ⠿)
    function reorder(key, srcV, tgtV, before) {
      if (srcV === tgtV) return;
      const a = listFor(key); const si = a.findIndex(x => x.v === srcV); if (si < 0) return;
      const [it] = a.splice(si, 1);
      let ti = a.findIndex(x => x.v === tgtV); if (ti < 0) { a.splice(si, 0, it); return; }
      a.splice(before ? ti : ti + 1, 0, it); saveF();
    }
    function firstToken(s) { s = (s || '').trim(); const m = s.match(/^\[[^\]]*\]/); return m ? m[0] : (s.split(/\s+/)[0] || s); }
    const captionOf = it => it.cap || firstToken(it.label || it.v);

    const isSelect = el => el.tagName === 'SELECT';
    const isAuto = el => el.classList.contains('ui-autocomplete-input') || el.classList.contains('lookup-performed');
    function setNative(el, val) {
      const proto = isSelect(el) ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const d = Object.getOwnPropertyDescriptor(proto, 'value'); if (d && d.set) d.set.call(el, val); else el.value = val;
    }
    function readField(el) {
      if (isSelect(el)) { const o = el.options[el.selectedIndex]; return { v: el.value, label: o ? o.textContent.trim() : el.value }; }
      const v = el.value || ''; return { v, label: v.trim() };
    }
    // What to STORE for the current value. Entity fields (p.gid) store the selected
    // MBID as the value with the visible name as the label, so recall resolves the
    // real entity; everything else (and unresolved/empty entity fields) stores text.
    function captureField(p) {
      const t = readField(p.el);
      if (!t.v || !p.gid) return t;
      let g; try { g = p.gid(p.el); } catch (e) {}
      return g ? { v: g, label: t.label || g } : t;
    }
    function writeField(el, rec) {
      if (isSelect(el)) {
        let opt = [...el.options].find(o => o.value === rec.v);
        if (!opt && rec.label) opt = [...el.options].find(o => o.textContent.trim() === rec.label.trim());
        if (!opt) return false;
        setNative(el, opt.value); el.dispatchEvent(new Event('change', { bubbles: true })); return true;
      }
      setNative(el, rec.v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (isAuto(el)) { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' })); el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' })); }
      return true;
    }
    function clearField(el) {
      if (isSelect(el)) { const o = [...el.options].find(o => o.value === ''); if (!o) return; setNative(el, ''); el.dispatchEvent(new Event('change', { bubbles: true })); }
      else { setNative(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
      try { el.focus(); } catch (e) {}
    }
    const fLabelText = el => { const l = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`); return (l && l.textContent.trim().replace(/:$/, '')) || el.getAttribute('aria-label') || el.placeholder || ''; };
    function keyFor(el, def) {
      if (def && def.key) return def.key;
      if (el.dataset.mmthKey) return 'k:' + el.dataset.mmthKey;
      const base = el.id ? el.id.replace(/-\d+$/, '') : (el.name || '');
      return 'auto:' + (base || fLabelText(el).toLowerCase().replace(/\s+/g, '-') || 'field');
    }

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const after = (e, el) => (e.clientY - el.getBoundingClientRect().top) > el.offsetHeight / 2;
    const clearMarks = host => host && host.querySelectorAll('.mmthf-drop-before,.mmthf-drop-after').forEach(r => r.classList.remove('mmthf-drop-before', 'mmthf-drop-after'));
    let pins = [], pop = null, mo = null, raf = 0, running = false, _fdrag = null, settleCap = 0;
    const listeners = [];

    function injectCss() {
      if (document.getElementById('mmthf-css')) return;
      const s = document.createElement('style'); s.id = 'mmthf-css';
      s.textContent = `
      .mmthf-pin { position:absolute; z-index:9998; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer;
                   border:none; background:none; box-shadow:none; padding:0; font-size:13px; line-height:1; user-select:none; opacity:.35; transition:opacity .12s; filter:grayscale(.3); }
      .mmthf-pin:hover { opacity:1; filter:none; }
      .mmthf-pin.has { opacity:.8; filter:none; }
      /* #296: keep the overlays invisible while the release editor is still
         reflowing on load (so they don't visibly jump), then FADE them in once the
         layout goes quiet — instead of bumping into place. */
      html.mmthf-settling .mmthf-pin, html.mmthf-settling .mmthf-bar { opacity:0 !important; pointer-events:none !important; }
      html.mmthf-fadein .mmthf-pin, html.mmthf-fadein .mmthf-bar { transition:opacity .4s ease !important; }
      .mmthf-hl { outline:2px solid #5aa67e !important; outline-offset:1px; }
      .mmthf-bar { position:absolute; z-index:9996; display:none; }
      .mmthf-seg { display:inline-flex; border:1px solid #cfd9d3; border-radius:7px; overflow:hidden; background:#fbfdfc; font:12px/1 -apple-system,Segoe UI,Arial,sans-serif; box-shadow:0 1px 2px rgba(0,0,0,.06); max-width:100%; }
      .mmthf-segb { border:none; background:none; padding:4px 12px; font-size:12px; color:#27483a; cursor:pointer; border-right:1px solid #e7eee9; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; }
      .mmthf-segb:last-child { border-right:none; }
      .mmthf-segb:hover { background:#eaf5ee; }
      .mmthf-pop { position:fixed; z-index:9999; background:#fff; border:1px solid #c7d3cc; border-radius:8px; box-shadow:0 8px 26px rgba(20,50,35,.2); font:12px/1.35 -apple-system,Segoe UI,Arial,sans-serif; color:#222; width:260px; overflow:hidden; }
      .mmthf-ft { display:flex; align-items:center; gap:1px; padding:3px 5px; background:#f1f6f3; border-bottom:1px solid #e7eee9; }
      .mmthf-fb { cursor:pointer; border:none; background:none; font-size:14px; line-height:1; padding:3px 7px; border-radius:5px; color:#566; }
      .mmthf-fb:hover { background:#dcefe2; }
      .mmthf-fb[aria-disabled="true"] { color:#b7c2bb; cursor:default; background:none; }
      .mmthf-ft-title { flex:1 1 auto; min-width:0; text-align:center; font-weight:700; font-size:13px; color:#293330; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 4px; }
      .mmthf-list { max-height:240px; overflow-y:auto; }
      .mmthf-row { position:relative; display:flex; align-items:center; gap:6px; padding:5px 10px; border-top:1px solid #f0f4f2; cursor:pointer; }
      .mmthf-row:first-child { border-top:none; }
      .mmthf-row:hover { background:#eaf5ee; }
      .mmthf-rtxt { flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:42px; }
      /* stationary indicators at the right edge (★ rightmost so it stays aligned; ◉ when default). Non-interactive — no reserved hover slots. */
      .mmthf-ind { position:absolute; right:10px; top:0; height:100%; display:flex; align-items:center; gap:5px; font-size:12px; color:#2c7a51; pointer-events:none; }
      /* the full action toolbar OVERLAYS the right on hover — reserves no space when idle */
      .mmthf-acts { position:absolute; right:5px; top:2px; bottom:2px; display:none; align-items:center; gap:1px; padding:0 3px 0 12px; border-radius:5px; background:#eaf5ee; }
      .mmthf-row:hover .mmthf-acts { display:flex; }
      .mmthf-row:hover .mmthf-ind { display:none; }
      .mmthf-ra { width:18px; box-sizing:border-box; text-align:center; border:none; background:none; color:#7d8a82; cursor:pointer; font-size:11px; padding:1px 0; border-radius:3px; }
      .mmthf-ra:hover { background:#cfe9d8; color:#1f5c3d; }
      .mmthf-grab { width:14px; text-align:center; cursor:grab; color:#b7c2bb; font-size:12px; user-select:none; }
      .mmthf-grab:active { cursor:grabbing; }
      .mmthf-row.mmthf-dragging { opacity:.45; }
      .mmthf-row.mmthf-drop-before { box-shadow:inset 0 2px 0 #2c7a51; }
      .mmthf-row.mmthf-drop-after { box-shadow:inset 0 -2px 0 #2c7a51; }
      .mmthf-empty { padding:10px; color:#9aa6a0; font-style:italic; text-align:center; }
      tr.mmthf-rrow > td { vertical-align:top; }   /* keep sibling cells from dropping when a cell reserves strip space */
      `;
      (document.head || document.documentElement).appendChild(s);
    }

    function scan() {
      const map = new Map();
      const add = (el, def) => { if (el && !map.has(el)) map.set(el, def || {}); };
      for (const d of PREDEF) document.querySelectorAll(d.match).forEach(el => add(el, d));
      document.querySelectorAll('.mmth-pin').forEach(el => add(el, { key: el.dataset.mmthKey ? 'k:' + el.dataset.mmthKey : null, label: el.dataset.mmthLabel || '' }));
      for (const [el, def] of map) {
        if (el.dataset.mmthf || !el.matches('input, select, textarea')) continue;
        el.dataset.mmthf = '1';
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mmthf-pin'; btn.innerHTML = MAMMOTH_SVG;   // #308 vector, not the 🦣 emoji
        const sel = isSelect(el);
        // shift the pin left of a native affordance: the <select> arrow (~22) or an
        // autocomplete magnifier that sits INSIDE the box (~24 — label, release group;
        // class ui-autocomplete-input). The artist field is `lookup-performed` only —
        // its magnifier is OUTSIDE the box — so it needs no shift. `dx` (def.dx /
        // data-mmth-dx) overrides per target.
        const innerIcon = el.classList.contains('ui-autocomplete-input');
        const dxRaw = def.dx != null ? def.dx : (el.dataset.mmthDx != null ? +el.dataset.mmthDx : null);
        const dx = dxRaw != null ? dxRaw : (sel ? 22 : innerIcon ? 24 : 3);
        if (!sel) try { const need = dx + 18; const pr = parseInt(getComputedStyle(el).paddingRight, 10) || 0; if (pr < need) el.style.paddingRight = need + 'px'; } catch (e) {}
        const bar = document.createElement('div'); bar.className = 'mmthf-bar';
        const p = { el, key: keyFor(el, def), label: def.label || fLabelText(el) || 'Field', btn, bar, sel, dx, gid: def.gid || null };
        btn.title = `Mammoth field memory — ${p.label}`;
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); togglePop(p); });
        btn.addEventListener('mouseenter', () => el.classList.add('mmthf-hl'));
        btn.addEventListener('mouseleave', () => el.classList.remove('mmthf-hl'));
        document.body.appendChild(btn); document.body.appendChild(bar);
        pins.push(p); refreshState(p); applyDefault(p);
      }
      layout();
    }

    // refresh every field sharing this key (e.g. the single-artist box + the
    // artist-credit bubble rows all use release.artist), so a pin/default/save in
    // one reflects on the others.
    function refreshState(p) { for (const q of pins) if (q.key === p.key) { q.btn.classList.toggle('has', listFor(q.key).length > 0); renderBar(q); } }
    const BAR_RESERVE = 30;
    function setReserve(p, on) {
      const host = p.el.closest('td') || p.el;
      const prop = host === p.el ? 'marginBottom' : 'paddingBottom';
      // When the host is a <td> in a MULTI-cell row (artist-credit bubble: Artist /
      // as-credited / join-phrase share one <tr>), padding it taller would drop the
      // sibling cells (they're vertically centred). Top-align the row's cells so the
      // padding grows downward into the strip's gap and the siblings stay put.
      const tr = prop === 'paddingBottom' ? host.parentElement : null;
      if (on) {
        if (!p._rh) {
          p._rh = host; p._rp = prop; p._ro = host.style[prop] || '';
          host.style[prop] = ((parseFloat(getComputedStyle(host)[prop]) || 0) + BAR_RESERVE) + 'px';
          if (tr && tr.children.length > 1) { p._rtr = tr; tr.classList.add('mmthf-rrow'); }
        }
      } else if (p._rh) {
        p._rh.style[p._rp] = p._ro; p._rh = null;
        if (p._rtr) { p._rtr.classList.remove('mmthf-rrow'); p._rtr = null; }
      }
    }
    function renderBar(p) {
      const items = listFor(p.key).filter(x => x.pinned);
      p.bar.innerHTML = '';
      setReserve(p, items.length > 0);
      if (!items.length) { p.bar.style.display = 'none'; return; }
      const seg = document.createElement('div'); seg.className = 'mmthf-seg';
      items.forEach(it => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmthf-segb'; b.textContent = captionOf(it); b.title = `${it.label} → click to set`; b.addEventListener('click', e => { e.preventDefault(); writeField(p.el, it); }); seg.appendChild(b); });
      p.bar.appendChild(seg);
    }
    function applyDefault(p) { const d = defaultOf(p.key); if (d && !readField(p.el).v) writeField(p.el, d); }

    function fieldOnTop(el, r) {
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
      const t = document.elementFromPoint(x, y);
      return !!t && (t === el || el.contains(t) || t.contains(el));
    }
    function gapClear(el, bar, r) {
      const x = r.left + Math.min(20, r.width / 2), y = r.bottom + 6;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
      const prev = bar.style.display; bar.style.display = 'none';
      const t = document.elementFromPoint(x, y); bar.style.display = prev;
      if (!t || t.closest('.mmthf-bar,.mmthf-pin,.mmthf-pop')) return true;
      // a positioned overlay over the gap hides the strip — UNLESS it's the field's
      // OWN positioned container (e.g. the artist-credit editor bubble), which isn't
      // covering the field, it holds it. Only flag overlays that don't contain el.
      for (let n = t; n && n !== document.body; n = n.parentElement) {
        const pos = getComputedStyle(n).position;
        if ((pos === 'absolute' || pos === 'fixed' || pos === 'sticky') && !n.contains(el)) return false;
      }
      return true;
    }
    function layout() {
      for (const p of pins) {
        if (!p.el.isConnected) { p.btn.remove(); p.bar.remove(); p.dead = true; continue; }
        const el = p.el, r = el.getBoundingClientRect();
        let vis = r.width > 0 && r.height > 0 && el.offsetParent !== null && !el.disabled;
        if (vis) vis = fieldOnTop(el, r);
        p.btn.style.display = vis ? 'flex' : 'none';
        const hasBar = vis && !!p.bar.firstChild && gapClear(el, p.bar, r);
        p.bar.style.display = hasBar ? 'block' : 'none';
        if (!vis) continue;
        // position in DOCUMENT coords (position:absolute) so the overlays scroll WITH
        // the page natively — no per-frame JS reposition, so no scroll lag. getBounding
        // ClientRect is viewport-relative, so add the scroll offset back.
        const sx = window.scrollX, sy = window.scrollY;
        p.btn.style.top = (r.top + sy + (r.height - 16) / 2) + 'px';
        p.btn.style.left = (r.right + sx - 16 - p.dx) + 'px';
        if (hasBar) { p.bar.style.top = (r.bottom + sy + 3) + 'px'; p.bar.style.left = (r.left + sx) + 'px'; p.bar.style.maxWidth = Math.max(140, r.width) + 'px'; }
      }
      if (pins.some(p => p.dead)) pins = pins.filter(p => !p.dead);
    }

    function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', onDown, true); } }
    function onDown(e) { if (pop && !pop.contains(e.target) && !e.target.classList.contains('mmthf-pin')) { closePop(); eatNextClick(); } }
    function place(el, anchor) { const r = anchor.getBoundingClientRect(); el.style.left = Math.max(6, Math.min(innerWidth - el.offsetWidth - 6, r.left)) + 'px'; el.style.top = Math.min(innerHeight - el.offsetHeight - 6, r.bottom + 4) + 'px'; }
    function togglePop(p) { const open = pop && pop._key === p.key && pop._anchor === p.btn; closePop(); if (open) return; openPop(p); }
    function openPop(p) {
      const cur = captureField(p);   // entity fields capture the selected MBID (#296)
      const items = listFor(p.key);   // raw order — drag (⠿) reorders it freely, like the edit-note panel
      const el = document.createElement('div'); el.className = 'mmthf-pop'; el._key = p.key; el._anchor = p.btn;
      const rowHtml = (it, i) => {
        const star = `<button class="mmthf-ra mmthf-star" title="${it.pinned ? 'Unpin from buttons' : 'Pin as a button'}">${it.pinned ? '★' : '☆'}</button>`;
        const def = `<button class="mmthf-ra mmthf-def" title="${it.default ? 'Default — auto-fills an empty field (click to unset)' : 'Make default (auto-fills an empty field)'}">${it.default ? '◉' : '◯'}</button>`;
        const acts = `<div class="mmthf-acts">${star}${def}<button class="mmthf-ra mmthf-del" title="Forget">🗑</button><span class="mmthf-grab" title="Drag to reorder" draggable="true">⠿</span></div>`;
        const ind = `<span class="mmthf-ind">${it.default ? '<span>◉</span>' : ''}${it.pinned ? '<span>★</span>' : ''}</span>`;
        return `<div class="mmthf-row" data-i="${i}"><span class="mmthf-rtxt">${esc(it.label)}</span>${ind}${acts}</div>`;
      };
      el.innerHTML =
        `<div class="mmthf-ft">
           <button class="mmthf-fb mmthf-save" ${cur.v ? '' : 'aria-disabled="true"'} title="${cur.v ? 'Save current value: ' + esc(cur.label) : 'Field is empty'}">＋</button>
           <button class="mmthf-fb mmthf-clear" title="Clear the field">✕</button>
           <span class="mmthf-ft-title"></span>
           <button class="mmthf-fb mmthf-cfg" title="Mammoth settings">⚙︎</button>
         </div>
         <div class="mmthf-list">${items.map(rowHtml).join('') || '<div class="mmthf-empty">No saved values yet</div>'}</div>`;
      document.body.appendChild(el); pop = el;
      const list = el.querySelector('.mmthf-list');
      el.querySelector('.mmthf-save').addEventListener('click', () => { if (!cur.v) return; rememberValue(p.key, cur); refreshState(p); reopen(p); });
      el.querySelector('.mmthf-clear').addEventListener('click', () => { clearField(p.el); reopen(p); });
      el.querySelector('.mmthf-cfg').addEventListener('click', () => { const a = p.btn; closePop(); openSettings(a); });
      el.querySelectorAll('.mmthf-row').forEach(row => {
        const it = items[+row.dataset.i];
        row.addEventListener('click', e => {
          if (e.target.closest('.mmthf-grab')) return;
          if (e.target.closest('.mmthf-star')) { togglePin(p.key, it.v); refreshState(p); reopen(p); return; }
          if (e.target.closest('.mmthf-def')) { setDefault(p.key, it.v); applyDefault(p); reopen(p); return; }
          if (e.target.closest('.mmthf-del')) { forgetValue(p.key, it.v); refreshState(p); reopen(p); return; }
          writeField(p.el, it); closePop();
        });
        const grab = row.querySelector('.mmthf-grab');
        grab.addEventListener('dragstart', e => { _fdrag = { v: it.v }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'row'); } catch (x) {} row.classList.add('mmthf-dragging'); });
        grab.addEventListener('dragend', () => { row.classList.remove('mmthf-dragging'); clearMarks(list); _fdrag = null; });
        row.addEventListener('dragover', e => { if (!_fdrag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; clearMarks(list); row.classList.add(after(e, row) ? 'mmthf-drop-after' : 'mmthf-drop-before'); });
        row.addEventListener('dragleave', () => row.classList.remove('mmthf-drop-before', 'mmthf-drop-after'));
        row.addEventListener('drop', e => { if (!_fdrag) return; e.preventDefault(); reorder(p.key, _fdrag.v, it.v, !after(e, row)); clearMarks(list); _fdrag = null; refreshState(p); reopen(p); });
      });
      place(el, p.btn);
      setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);
    }
    const reopen = p => { closePop(); openPop(p); };

    const relayout = () => { if (running && !raf) raf = requestAnimationFrame(() => { raf = 0; layout(); }); };
    function start() {
      if (running) return; running = true;
      injectCss();
      const on = (t, ev, fn, cap) => { t.addEventListener(ev, fn, cap); listeners.push([t, ev, fn, cap]); };
      on(window, 'scroll', relayout, true); on(window, 'resize', relayout, false);
      ['focusin', 'focusout', 'click', 'input', 'keyup'].forEach(ev => on(document, ev, relayout, true));
      // #296: the release editor keeps reflowing for a few hundred ms after load, so
      // the absolutely-positioned overlays would chase the moving fields and visibly
      // jump. Keep them hidden until the DOM goes quiet for 300ms (capped at 1.5s),
      // then reveal them already in their final spots.
      const html = document.documentElement;
      html.classList.add('mmthf-settling');
      let revealed = false, quietT = 0;
      const reveal = () => {
        if (revealed) return; revealed = true; clearTimeout(quietT); clearTimeout(settleCap);
        html.classList.remove('mmthf-settling'); html.classList.add('mmthf-fadein'); relayout();
        setTimeout(() => html.classList.remove('mmthf-fadein'), 450);   // drop the slow transition once faded in
      };
      const bump = () => { if (revealed) return; clearTimeout(quietT); quietT = setTimeout(reveal, 300); };
      settleCap = setTimeout(reveal, 1500);
      let st = 0; mo = new MutationObserver(() => { clearTimeout(st); st = setTimeout(scan, 150); bump(); }); mo.observe(document.documentElement, { childList: true, subtree: true });
      bump();
      scan();
    }
    function stop() {
      if (!running) return; running = false;
      if (mo) { mo.disconnect(); mo = null; }
      clearTimeout(settleCap); document.documentElement.classList.remove('mmthf-settling', 'mmthf-fadein');
      listeners.forEach(([t, ev, fn, cap]) => t.removeEventListener(ev, fn, cap)); listeners.length = 0;
      closePop();
      pins.forEach(p => { try { setReserve(p, false); } catch (e) {} p.btn.remove(); p.bar.remove(); delete p.el.dataset.mmthf; });
      pins = [];
    }
    return { start, stop, toggle(on) { on ? start() : stop(); } };
  }
})();
