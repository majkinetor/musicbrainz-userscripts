// ==UserScript==
// @name         Mammoth
// @namespace    https://musicbrainz.org/
// @version      2026.7.10.182128
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
  const DEFAULTS = { historySize: 10, hideHelp: false, defaultInsert: 'replace', visibleRows: 6, sideWidth: 300, appendNewline: true, minimized: false, showBabies: true, noteSort: 'manual', btnChars: 24, scopePerResource: false, customFields: [] };   // defaultInsert: 'replace' | 'append'; noteSort: 'manual' | 'uses' | 'recent'; btnChars: pinned-button label length; scopePerResource: per-type note pools (#309); customFields: user-defined baby fields [{match,label,key,dx,entity}]
  const VERSION = '2026.6.29';   // keep in sync with @version (fallback when GM_info is unavailable)
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mammoth/README.md';
  const SYNTAX_URL = 'https://musicbrainz.org/doc/Edit_Note';
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  // #308: the 🦣 emoji (U+1F9A3) renders as a tofu box in Chrome on systems whose
  // emoji font lacks it (Firefox bundles its own, hence the inconsistency). Use a
  // self-contained vector mammoth everywhere the icon shows, so it's font-independent.
  const MAMMOTH_SVG = '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" style="display:block"><g fill="#7a4a1f"><path d="M21 19C21 12.5 17.5 8.5 11.5 8.5C7 8.5 4.2 11.2 4.2 15L4.2 19Z"/><circle cx="7.6" cy="10.6" r="5"/><rect x="7" y="16.5" width="2.8" height="5.2" rx="1.3"/><rect x="15" y="16.5" width="2.8" height="5.2" rx="1.3"/></g><path d="M3.1 11.2C1.6 13.6 2 16.6 3.7 18.1C4.6 18.9 5.9 18.6 6.1 17.5C6.3 16.5 5.7 15.8 5.3 15.3" fill="none" stroke="#7a4a1f" stroke-width="2.7" stroke-linecap="round"/><path d="M5.2 15.2C4.1 16.6 4.3 18.2 5.6 18.9" fill="none" stroke="#efe7d2" stroke-width="1.4" stroke-linecap="round"/></svg>';

  // #309: optionally keep notes SEPARATE per edit-note entity type (release /
  // artist / recording / …), derived from the page URL — opt-in via the
  // "Scope per resource" setting. Off (default) = one shared pool ('all').
  const ENTITY_TYPES = ['area', 'artist', 'event', 'genre', 'instrument', 'label', 'place', 'recording', 'release', 'release-group', 'series', 'work'];
  const GLOBAL_SCOPE = 'all';
  function noteScope() {
    const seg = (location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
    return ENTITY_TYPES.includes(seg) ? seg : 'other';
  }
  const SCOPE = noteScope();
  const scopeLabel = s => s === 'other' ? 'other' : s.replace(/-/g, ' ');
  // Multi-scope store: { [scope]: { saved, history } }. Migrate the old flat
  // { saved, history } into the shared 'all' pool (scoping is off by default).
  function loadStore() {
    let raw; try { raw = JSON.parse(GM_getValue(KEY, '{}') || '{}'); } catch (e) { raw = {}; }
    if (!raw || typeof raw !== 'object') raw = {};
    if (Array.isArray(raw.saved) || Array.isArray(raw.history)) raw = { [GLOBAL_SCOPE]: { saved: raw.saved || [], history: raw.history || [] } };
    return raw;
  }
  const loadSet = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(GM_getValue(SKEY, '{}') || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const persistSet = () => { try { GM_setValue(SKEY, JSON.stringify(SET)); } catch (e) {} };           // quiet save (no re-render)
  const saveSet = () => { persistSet(); applyHelp(); render(); };

  let SET = loadSet();
  let STORE = loadStore();
  const dataKey = () => SET.scopePerResource ? SCOPE : GLOBAL_SCOPE;
  let DATA;
  function useScope() {   // (re)point DATA at the current pool (called on load + when the setting toggles)
    const k = dataKey();
    DATA = STORE[k] || (STORE[k] = { saved: [], history: [] });
    if (!Array.isArray(DATA.saved)) DATA.saved = [];
    if (!Array.isArray(DATA.history)) DATA.history = [];
  }
  useScope();
  const saveData = () => { try { GM_setValue(KEY, JSON.stringify(STORE)); } catch (e) {} render(); };
  const updateScopeChips = () => document.querySelectorAll('.mmth-scope').forEach(c => { c.style.display = SET.scopePerResource ? '' : 'none'; });
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
  // #304: parse pasted notes — each line a note, or (byBlock) blank-line-separated
  // blocks so multi-line notes survive. Blank lines are dropped either way, so a
  // readable (blank-line) export round-trips fine in "1 note per line" mode too.
  function parseNotes(text, byBlock) {
    const parts = byBlock ? String(text || '').split(/\r?\n[ \t]*\r?\n/) : String(text || '').split(/\r?\n/);
    return parts.map(s => s.replace(/^\s+|\s+$/g, '')).filter(Boolean);
  }
  // add parsed notes to the edit-note saved list (dedup). Returns the added count.
  function addSavedNotes(notes) {
    let added = 0; const have = new Set(DATA.saved.map(s => s.text));
    for (const t of notes) { if (have.has(t)) continue; have.add(t); DATA.saved.push({ id: uid(), text: t, ts: Date.now() }); added++; }
    if (added) saveData();
    return added;
  }

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
  // #304: set when Ctrl/⌘+, un-minimized the panel just to reach search — so we
  // re-minimize once a note is applied (or the search is cancelled).
  let restoredFromMin = false;
  const reMinIfRestored = () => { if (restoredFromMin) { restoredFromMin = false; setMinimized(true); } };
  function applyNote(ta, text, replace) {
    const cur = ta.value || '';
    if (!replace && cur.trim()) {
      // #212: don't append a note already in the field — match whole-field, a
      // blank-line-separated block, or a single line (handles multi-line notes).
      const norm = s => s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n').trim();
      const tN = norm(text);
      const cands = [cur, ...cur.split(/\n{2,}/), ...cur.split('\n')].map(norm);
      if (tN && cands.includes(tN)) { toast('Already in the note'); reMinIfRestored(); return; }
    }
    setValue(ta, (replace || !cur.trim()) ? text : cur.replace(/\s+$/, '') + (SET.appendNewline ? '\n\n' : '\n') + text);
    ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
    reMinIfRestored();
  }
  // Toggle `marker` around the selection (GitHub-style): if the text is already
  // wrapped, strip the markers; otherwise add them. With no selection, act on the
  // word the caret is in (or just insert/remove an empty pair).
  function wrapSel(ta, marker) {
    const v = ta.value;
    const m = marker, ml = m.length;
    let s = ta.selectionStart ?? v.length, e = ta.selectionEnd ?? s;
    if (s === e) { let a = s, b = e; while (a > 0 && /\S/.test(v[a - 1])) a--; while (b < v.length && /\S/.test(v[b])) b++; if (b > a) { s = a; e = b; } }
    const sel = v.slice(s, e);
    const reselect = (from, len) => { ta.focus(); try { ta.setSelectionRange(from, from + len); } catch (x) {} };
    // #326: already wrapped — markers INSIDE the selection → unwrap
    if (sel.length >= 2 * ml && sel.startsWith(m) && sel.endsWith(m)) {
      const inner = sel.slice(ml, sel.length - ml);
      setValue(ta, v.slice(0, s) + inner + v.slice(e));
      reselect(s, inner.length);
      return;
    }
    // #326: already wrapped — markers just OUTSIDE the selection → unwrap
    if (v.slice(s - ml, s) === m && v.slice(e, e + ml) === m) {
      setValue(ta, v.slice(0, s - ml) + sel + v.slice(e + ml));
      reselect(s - ml, sel.length);
      return;
    }
    // otherwise wrap
    setValue(ta, v.slice(0, s) + m + sel + m + v.slice(e));
    if (sel) reselect(s + ml, sel.length);
    else { const caret = s + ml; ta.focus(); try { ta.setSelectionRange(caret, caret); } catch (x) {} }
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
  /* #304: field column = textarea + pinned-quick-buttons bar, stacked */
  .mmth-fieldcol { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; }
  .mmth-fieldcol > textarea.edit-note { width:100% !important; min-width:0; box-sizing:border-box; }
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
  .mmth-vsep { flex:none; width:9px; align-self:flex-start; cursor:col-resize; position:relative; }   /* #304: height synced to the field (not the field+pinbar column) */
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
  /* #309: per-type scope indicator (release / artist / recording / …) */
  .mmth-scope { align-self:center; flex:none; font-size:10px; color:#6f7d75; background:#eef3f0; border:1px solid #dde7e1; border-radius:9px; padding:1px 7px; margin-right:4px; white-space:nowrap; max-width:72px; overflow:hidden; text-overflow:ellipsis; }
  .mmth-ft { flex-wrap:wrap; }   /* #304: never clip toolbar buttons — wrap as a last resort below the min width */
  /* #304: opt-in search row (search box + count) between the toolbar and the list */
  .mmth-filterrow { display:flex; align-items:center; gap:5px; padding:3px 5px; border-bottom:1px solid #e7eee9; background:#f7faf8; }
  /* width:auto !important defends against MB's form CSS (#content input), which
     otherwise forces a fixed width and squashes the flex layout (#304) */
  /* display:block !important beats MB's ".add-edit-note input { display:none }" (which
     otherwise hides our search box on /edit and /edits pages); width:auto !important beats
     MB's fixed input width. #304 */
  .mmth-filter { display:block !important; flex:1 1 auto; min-width:0; width:auto !important; box-sizing:border-box; border:1px solid #d7e0db; border-radius:5px; padding:2px 6px; font:12px -apple-system,Segoe UI,Arial,sans-serif; }
  .mmth-filter:focus { outline:none; border-color:#5aa67e; }
  .mmth-count { flex:none; font-size:11px; color:#8a978f; white-space:nowrap; }
  /* #304: pinned saved notes as quick-insert buttons BELOW the field (like baby-field bars) */
  .mmth-pinbar { display:flex; flex-wrap:wrap; gap:5px; margin:5px 0 2px; }
  .mmth-segb { border:1px solid #cfd9d3 !important; background:#fbfdfc; border-radius:7px; padding:3px 10px !important; font:12px/1.2 -apple-system,Segoe UI,Arial,sans-serif !important; color:#27483a; cursor:pointer; max-width:200px; height:auto !important; min-height:0 !important; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,.06); }
  .mmth-segb:hover { background:#eaf5ee; border-color:#5aa67e; }
  .mmth-row.mmth-pinned .mmth-txt::before { content:'★'; color:#c2a93e; margin-right:4px; font-size:10px; vertical-align:1px; }
  /* #304: tabbed config window (Settings / Import-Export) */
  .mmth-cfgtabs { display:flex; gap:4px; margin:0 0 8px; border-bottom:1px solid #e7eee9; }
  .mmth-cfgtab { border:none; background:none; padding:4px 9px; font-size:12px; color:#566; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
  .mmth-cfgtab:hover { color:#1f5c3d; }
  .mmth-cfgtab.on { color:#1f5c3d; border-bottom-color:#5aa67e; font-weight:600; }
  .mmth-cfgsec { font-weight:600; font-size:11px; color:#6f7d75; text-transform:uppercase; letter-spacing:.04em; margin:10px 0 4px; padding-bottom:2px; border-bottom:1px solid #eef3f0; }
  .mmth-cfgpane > .mmth-cfgsec:first-child { margin-top:2px; }
  /* custom baby fields (config) */
  .mmth-cf-list { display:flex; flex-direction:column; gap:5px; margin:4px 0 8px; }
  .mmth-cf-row { display:flex; align-items:center; gap:4px; flex-wrap:nowrap; }
  .mmth-cf-in { border:1px solid #d7e0db; border-radius:5px; padding:3px 6px; font:12px -apple-system,Segoe UI,Arial,sans-serif; box-sizing:border-box; min-width:0; }
  .mmth-cf-in:focus { outline:none; border-color:#5aa67e; }
  .mmth-cf-match { flex:1 1 auto; min-width:90px; }
  .mmth-cf-cnt { font-size:11px; color:#8a968f; min-width:52px; text-align:right; white-space:nowrap; }
  .mmth-cf-cnt.mmth-cf-bad { color:#c0392b; }
  .mmth-cf-del { border:none; background:none; cursor:pointer; font-size:13px; padding:2px 4px; border-radius:4px; }
  .mmth-cf-del:hover { background:#f0d9d9; }
  .mmth-cf-add { border:1px dashed #b9c6be; background:#f7faf8; border-radius:6px; padding:5px 10px; cursor:pointer; color:#2e6b4a; font:12px inherit; }
  .mmth-cf-add:hover { background:#eef5f0; }
  .mmth-cf-empty { color:#9aa6a0; font-style:italic; font-size:12px; padding:2px 0; }
  .mmth-cf-mode { float:right; border:1px solid #cfd9d3; background:#f7faf8; border-radius:5px; padding:1px 8px; font:11px -apple-system,Segoe UI,Arial,sans-serif; color:#2e6b4a; cursor:pointer; text-transform:none; letter-spacing:normal; }
  .mmth-cf-mode:hover { background:#eef5f0; border-color:#5aa67e; }
  .mmth-cf-json { width:100%; box-sizing:border-box; min-height:150px; font:12px/1.4 ui-monospace,Consolas,monospace; border:1px solid #d7e0db; border-radius:6px; padding:7px; resize:vertical; }
  .mmth-cf-json:focus { outline:none; border-color:#5aa67e; }
  .mmth-cf-jsonrow { display:flex; align-items:center; gap:9px; margin-top:6px; }
  .mmth-cf-jsonapply { border:1px dashed #b9c6be; background:#f7faf8; border-radius:6px; padding:5px 12px; cursor:pointer; color:#2e6b4a; font:12px inherit; }
  .mmth-cf-jsonapply:hover { background:#eef5f0; }
  .mmth-cf-jsonmsg { font-size:11px; color:#8a968f; }
  .mmth-cf-jsonmsg.mmth-cf-bad { color:#c0392b; }
  /* #304: import/export pane (the pane IS the flex column — no inner .mmth-io wrapper) */
  .mmth-cfgpane[data-pane="io"] { display:flex; flex-direction:column; gap:8px; }
  .mmth-io-modes { display:flex; flex-flow:row wrap; gap:6px 18px; font-size:12px; align-items:center; }
  .mmth-io-modes label { margin:0; display:inline-flex; align-items:center; gap:6px; }
  /* width/height !important to beat MB's #content textarea form CSS (#304) */
  .mmth-io-ta { width:100% !important; box-sizing:border-box; height:160px !important; min-height:120px; resize:vertical; border:1px solid #d7e0db; border-radius:5px; padding:6px 8px; font:13px/1.55 -apple-system,Segoe UI,Arial,sans-serif; }
  .mmth-io-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .mmth-io-btn { cursor:pointer; border:1px solid #cfd9d3; background:#fff; border-radius:5px; padding:2px 8px; font-size:12px; color:#27483a; }
  .mmth-io-btn:hover { background:#eaf5ee; border-color:#5aa67e; }
  .mmth-io-msg { font-size:11px; color:#8a978f; }
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
  .mmth-cfg { width:360px; }   /* #304: wider config window so the Import/Export radios sit on one row + a roomier textarea */
  .mmth-cfg.mmth-cfg-wide { width:min(660px,94vw); }   /* Fields tab: roomier so each custom-field row fits one line */
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
  /* While an MB dialog/popover is open, hide Mammoth's panel (incl. the minimized
     badge) and its popovers — MB's dialogs carry no z-index, so our UI would float
     on top of them. visibility keeps the docked panel's layout (no jump). #313 */
  html.mmthf-dialog .mmth-side, html.mmthf-dialog .mmth-badge, html.mmthf-dialog .mmth-pop { visibility:hidden !important; pointer-events:none !important; }
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

  // #305: dismiss our popovers on the outside *click* (capture), NOT mousedown.
  // Tearing the popover down on mousedown removed what was under the cursor, so the
  // trailing mouseup/click fell through to whatever sat beneath it (e.g. Apollo's
  // cover-art thumbnail under the field) and activated it — "cover art opened when
  // selecting a label". Handling the click lets us swallow that exact event so the
  // dismiss can never double as activating something below.
  // ── popovers (settings + syntax help) ────────────────────────────────────────
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('click', onPopDown, true); document.removeEventListener('keydown', onPopKey, true); } }
  function onPopDown(e) { if (pop && !pop.contains(e.target) && !e.target.closest('.mmth-pop-anchor')) { e.preventDefault(); e.stopPropagation(); closePop(); } }
  function onPopKey(e) { if (pop && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); } }   // #347: ESC closes the settings / syntax popup
  function placePop(p, anchor) {
    const W = p.offsetWidth, H = p.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const r = anchor && anchor.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) {
      // anchor gone/hidden (e.g. a baby pin that re-hid) — sensible centred fallback
      p.style.left = Math.max(6, Math.round((vw - W) / 2)) + 'px'; p.style.top = '70px';
    } else {
      // #304: open just BELOW the trigger and clamp into the viewport, so the popover
      // stays next to what opened it instead of jumping above (which clamped to the
      // top-left corner when opened from a baby pin low on a tall page).
      const left = Math.max(6, Math.min(vw - W - 6, r.left));
      let top = r.bottom + 4;                              // below the trigger
      if (top + H > vh - 6) {                              // would overflow the bottom
        const above = r.top - H - 6;                       // try above if it fits, else clamp
        top = above >= 6 ? above : (vh - H - 6);
      }
      p.style.left = left + 'px'; p.style.top = Math.max(6, top) + 'px';
    }
    setTimeout(() => { document.addEventListener('click', onPopDown, true); document.addEventListener('keydown', onPopKey, true); }, 0);
  }
  // #304: drag the popover by its header (so it can be moved out of the way).
  function makeDraggable(popEl, handle) {
    handle.classList.add('mmth-draghandle');
    let sx = 0, sy = 0, sl = 0, st = 0, on = false;
    const move = e => {
      if (!on) return;
      let l = sl + (e.clientX - sx), t = st + (e.clientY - sy);
      l = Math.max(6, Math.min(window.innerWidth - popEl.offsetWidth - 6, l));
      t = Math.max(6, Math.min(window.innerHeight - popEl.offsetHeight - 6, t));
      popEl.style.left = l + 'px'; popEl.style.top = t + 'px';
    };
    const up = () => { on = false; document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true); };
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('a, button, input, select, textarea')) return;   // don't hijack the Help link etc.
      on = true; popEl.dataset.moved = '1'; const r = popEl.getBoundingClientRect(); sl = r.left; st = r.top; sx = e.clientX; sy = e.clientY;
      e.preventDefault(); document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
    });
  }
  // #304/#309: tabbed config window — Settings + Import / Export. `io` lets the
  // caller scope import/export to a specific field (e.g. a baby field's values).
  function openSettings(anchor, tab, io) {
    closePop();
    const p = document.createElement('div'); p.className = 'mmth-pop mmth-cfg';
    p.innerHTML = `
      <h4><span class="mmth-h4ic">${MAMMOTH_SVG}</span> Mammoth <span class="mmth-ver">v${scriptVersion()}</span><a href="${HELP_URL}" target="_blank" rel="noopener" title="Open the README">? Help</a></h4>
      <div class="mmth-cfgtabs">
        <button type="button" class="mmth-cfgtab" data-tab="settings">Settings</button>
        <button type="button" class="mmth-cfgtab" data-tab="fields">Fields</button>
        <button type="button" class="mmth-cfgtab" data-tab="io">Import / Export</button>
      </div>
      <div class="mmth-cfgpane" data-pane="settings">
        <div class="mmth-cfgsec">Edit note settings</div>
        <label title="Keep saved notes &amp; history separate per edit-note type (release / artist / recording / …)"><input type="checkbox" class="mmth-s-scope"> Scope per resource</label>
        <label><input type="checkbox" class="mmth-s-help"> Hide help text</label>
        <label>Sort saved notes
          <select class="mmth-s-sort"><option value="manual">Manual</option><option value="uses">Most used</option><option value="recent">Recent</option></select>
        </label>
        <label title="Right-click does the other action">Default click action
          <select class="mmth-s-ins"><option value="replace">replace</option><option value="append">append</option></select>
        </label>
        <label><input type="checkbox" class="mmth-s-nl"> Insert empty line when appending</label>
        <label>Items shown <input type="number" class="mmth-s-rows" min="1" max="30"></label>
        <label>History size <input type="number" class="mmth-s-hist" min="1" max="50"></label>
        <div class="mmth-cfgsec">General</div>
        <label><input type="checkbox" class="mmth-s-babies"> Show mammoth babies</label>
        <label>Button label length <input type="number" class="mmth-s-btnchars" min="4" max="80"></label>
      </div>
      <div class="mmth-cfgpane" data-pane="fields" style="display:none">
        <div class="mmth-cfgsec">Custom baby fields <button type="button" class="mmth-cf-mode">{ } JSON</button></div>
        <div class="mmth-tip" style="margin:0 0 6px">Add Mammoth field-memory to any control by its CSS selector (Inspect the element → Copy selector). <b>Comma-separate</b> several selectors to cover more than one field with one row. <b>Key</b> shares a saved list between fields (defaults to the label). <b>nudge</b> shifts the 🦣 pin by N px. <b>↵ ms</b> presses Enter that many ms after a value is set (0 = off) to accept an autocomplete's match — instruments need ~150, artists more; it only fires while the dropdown is open, so it can't leak.</div>
        <div class="mmth-cf-list"></div>
        <button type="button" class="mmth-cf-add">＋ Add field</button>
        <textarea class="mmth-cf-json" spellcheck="false" style="display:none" placeholder='[{ "selector": "div.instrument input", "label": "Instrument", "deltax": 16, "enterDelay": 150 }]'></textarea>
        <div class="mmth-cf-jsonrow" style="display:none"><button type="button" class="mmth-cf-jsonapply">Apply</button><span class="mmth-cf-jsonmsg"></span></div>
      </div>
      <div class="mmth-cfgpane" data-pane="io" style="display:none">
        <div class="mmth-io-modes">
          <label><input type="radio" name="mmth-iomode" value="line" checked> 1 note per line</label>
          <label><input type="radio" name="mmth-iomode" value="block"> empty line separates notes</label>
        </div>
        <textarea class="mmth-io-ta" placeholder="Paste notes to import, or press Export to fill this box."></textarea>
        <div class="mmth-io-row">
          <button type="button" class="mmth-io-btn mmth-io-import">Import</button>
          <button type="button" class="mmth-io-btn mmth-io-export">Export all</button>
          <span class="mmth-io-msg"></span>
        </div>
        <div class="mmth-tip mmth-io-help" style="margin-left:0"></div>
      </div>`;
    document.body.appendChild(p); pop = p;
    makeDraggable(p, p.querySelector('h4'));   // #304: movable config window
    // tab switching — only toggles the pane; position stays put (re-placing here made
    // the window jump because the two tabs differ in height). #304
    const tabs = [...p.querySelectorAll('.mmth-cfgtab')], panes = [...p.querySelectorAll('.mmth-cfgpane')];
    // Fields needs more horizontal room (one row per field) → widen the window on that tab. Re-place only
    // when the wide state actually flips, so plain Settings↔IO switches don't jump (#304).
    const showTab = name => {
      const wasWide = p.classList.contains('mmth-cfg-wide');
      tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === name)); panes.forEach(pn => { pn.style.display = pn.dataset.pane === name ? '' : 'none'; });
      const wide = name === 'fields'; p.classList.toggle('mmth-cfg-wide', wide);
      if (wide !== wasWide) placePop(p, anchor);
    };
    tabs.forEach(t => t.onclick = () => showTab(t.dataset.tab));
    // ── Settings pane ──
    const scope = p.querySelector('.mmth-s-scope'); scope.checked = SET.scopePerResource === true;
    scope.onchange = () => { SET.scopePerResource = scope.checked; persistSet(); useScope(); updateScopeChips(); render(); };
    const help = p.querySelector('.mmth-s-help'); help.checked = !!SET.hideHelp;
    const ins = p.querySelector('.mmth-s-ins'); ins.value = SET.defaultInsert;
    const nl = p.querySelector('.mmth-s-nl'); nl.checked = SET.appendNewline !== false;
    const sort = p.querySelector('.mmth-s-sort'); sort.value = SET.noteSort || 'manual';
    const btnc = p.querySelector('.mmth-s-btnchars'); btnc.value = SET.btnChars || 24;
    const rows = p.querySelector('.mmth-s-rows'); rows.value = SET.visibleRows;
    const hist = p.querySelector('.mmth-s-hist'); hist.value = SET.historySize;
    help.onchange = () => { SET.hideHelp = help.checked; saveSet(); };
    ins.onchange = () => { SET.defaultInsert = ins.value; saveSet(); };
    nl.onchange = () => { SET.appendNewline = nl.checked; saveSet(); };
    sort.onchange = () => { SET.noteSort = sort.value; persistSet(); render(); };
    btnc.onchange = () => { SET.btnChars = Math.max(4, Math.min(80, parseInt(btnc.value, 10) || 24)); btnc.value = SET.btnChars; saveSet(); babyMammoths.relabel(); };
    rows.onchange = () => { SET.visibleRows = Math.max(1, Math.min(30, parseInt(rows.value, 10) || 6)); rows.value = SET.visibleRows; saveSet(); };
    hist.onchange = () => { SET.historySize = Math.max(1, Math.min(50, parseInt(hist.value, 10) || 10)); hist.value = SET.historySize; saveSet(); recordHistory(''); };
    const babies = p.querySelector('.mmth-s-babies'); babies.checked = SET.showBabies !== false;
    babies.onchange = () => { SET.showBabies = babies.checked; persistSet(); babyMammoths.toggle(babies.checked); };
    // ── Fields pane ── custom baby fields: a user-editable list of {match,label,key,dx,entity}. Persisted in
    // SET; each edit re-scans the page (debounced) so pins appear/disappear live. Bad/empty selectors show a
    // "bad selector" / match count so a typo is caught before it litters pins.
    const cfList = p.querySelector('.mmth-cf-list');
    const cfCount = sel => { try { return document.querySelectorAll(sel).length; } catch (e) { return -1; } };
    let cfRefreshT = 0;
    const cfApply = () => { persistSet(); clearTimeout(cfRefreshT); cfRefreshT = setTimeout(() => { try { babyMammoths.refresh(); } catch (e) {} }, 400); };
    function renderFields() {
      SET.customFields = SET.customFields || [];
      cfList.textContent = '';
      if (!SET.customFields.length) { const e = document.createElement('div'); e.className = 'mmth-cf-empty'; e.textContent = 'No custom fields yet.'; cfList.appendChild(e); }
      SET.customFields.forEach((cf, i) => {
        const row = document.createElement('div'); row.className = 'mmth-cf-row';
        const cnt = document.createElement('span'); cnt.className = 'mmth-cf-cnt';
        const paint = () => { if (!cf.match) { cnt.textContent = ''; cnt.classList.remove('mmth-cf-bad'); return; } const n = cfCount(cf.match); cnt.textContent = n < 0 ? 'bad selector' : `matches ${n}`; cnt.classList.toggle('mmth-cf-bad', n < 0); };
        const mk = (ph, key, w, type) => {
          const inp = document.createElement('input'); inp.type = type || 'text'; inp.placeholder = ph; inp.className = 'mmth-cf-in mmth-cf-' + key;
          inp.value = cf[key] != null ? cf[key] : ''; if (w) inp.style.width = w;
          inp.oninput = () => { cf[key] = type === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value; if (key === 'match') paint(); cfApply(); };
          return inp;
        };
        const dly = document.createElement('input'); dly.type = 'number'; dly.className = 'mmth-cf-in mmth-cf-dly'; dly.min = '0'; dly.max = '10000'; dly.step = '50'; dly.style.width = '58px'; dly.placeholder = '↵ ms';
        dly.title = 'Press Enter this many ms after the value is set (0 / blank = off; ~150 for instruments, more for artists). Fires only while the autocomplete dropdown is open, so it can’t leak to another control.';
        dly.value = cf.enterDelay ? cf.enterDelay : '';
        dly.oninput = () => { cf.enterDelay = dly.value === '' ? 0 : Math.max(0, +dly.value || 0); cfApply(); };
        const del = document.createElement('button'); del.type = 'button'; del.className = 'mmth-cf-del'; del.textContent = '🗑'; del.title = 'Remove this field';
        del.onclick = () => { SET.customFields.splice(i, 1); renderFields(); cfApply(); };
        row.append(mk('CSS selector — comma-separate for several', 'match', '', 'text'), mk('Label', 'label', '84px'), mk('Key ⇐ label', 'key', '84px'), mk('px', 'dx', '44px', 'number'), dly, cnt, del);
        cfList.appendChild(row); paint();
      });
    }
    p.querySelector('.mmth-cf-add').onclick = () => { SET.customFields = SET.customFields || []; SET.customFields.push({ match: '', label: '', key: '', dx: '', enterDelay: 0 }); renderFields(); };
    renderFields();
    // JSON text mode — the same list as an editable/copy-pasteable JSON blob (friendly keys: selector /
    // label / key / deltax / enterDelay). Doubles as export (copy the box) and import (paste + Apply).
    const jsonTa = p.querySelector('.mmth-cf-json'), jsonMsg = p.querySelector('.mmth-cf-jsonmsg'), jsonRow = p.querySelector('.mmth-cf-jsonrow'), modeBtn = p.querySelector('.mmth-cf-mode'), addBtn = p.querySelector('.mmth-cf-add');
    const cfOut = cf => { const o = { selector: cf.match || '' }; if (cf.label) o.label = cf.label; if (cf.key) o.key = cf.key; if (cf.dx != null && cf.dx !== '') o.deltax = +cf.dx; if (cf.enterDelay) o.enterDelay = +cf.enterDelay; return o; };
    const cfToJson = () => JSON.stringify((SET.customFields || []).map(cfOut), null, 2);
    const cfFromJson = txt => {
      const arr = JSON.parse(txt.replace(/,(\s*[}\]])/g, '$1'));   // tolerate trailing commas
      if (!Array.isArray(arr)) throw new Error('expected a JSON array');
      return arr.filter(o => o && typeof o === 'object').map(o => ({
        match: String(o.selector != null ? o.selector : (o.match || '')).trim(),
        label: o.label ? String(o.label) : '', key: o.key ? String(o.key) : '',
        dx: (o.deltax != null && o.deltax !== '') ? +o.deltax : ((o.dx != null && o.dx !== '') ? +o.dx : ''),
        enterDelay: (o.enterDelay != null && o.enterDelay !== '') ? (+o.enterDelay || 0) : 0,
      })).filter(c => c.match);
    };
    const applyJson = () => {
      try { SET.customFields = cfFromJson(jsonTa.value); jsonMsg.textContent = `${SET.customFields.length} field(s) applied`; jsonMsg.classList.remove('mmth-cf-bad'); renderFields(); cfApply(); return true; }
      catch (e) { jsonMsg.textContent = 'Invalid JSON: ' + (e.message || e); jsonMsg.classList.add('mmth-cf-bad'); return false; }
    };
    const setJsonMode = on => {
      cfList.style.display = addBtn.style.display = on ? 'none' : '';
      jsonTa.style.display = jsonRow.style.display = on ? '' : 'none';
      modeBtn.textContent = on ? '▤ Visual' : '{ } JSON';
      if (on) { jsonTa.value = cfToJson(); jsonMsg.textContent = ''; jsonMsg.classList.remove('mmth-cf-bad'); }
    };
    modeBtn.onclick = () => { const toJson = modeBtn.textContent.indexOf('JSON') >= 0; if (toJson) setJsonMode(true); else if (applyJson()) setJsonMode(false); };
    p.querySelector('.mmth-cf-jsonapply').onclick = applyJson;
    // ── Import / Export pane ── (#304/#309: scoped to `io` — edit-note notes by
    // default, or a specific field's values when opened from a baby field)
    const ctx = io || { items: () => DATA.saved.map(s => s.text), add: notes => addSavedNotes(notes), help: 'Import adds to your saved notes; Export copies them all to the clipboard.' };
    const ioTa = p.querySelector('.mmth-io-ta'), ioMsg = p.querySelector('.mmth-io-msg');
    const ioBlock = () => p.querySelector('input[name="mmth-iomode"]:checked').value === 'block';
    p.querySelector('.mmth-io-help').textContent = ctx.help || '';
    p.querySelector('.mmth-io-import').onclick = () => {
      const notes = parseNotes(ioTa.value, ioBlock());
      if (!notes.length) { ioMsg.textContent = 'Paste some notes first'; return; }
      const added = ctx.add(notes);
      ioMsg.textContent = `Added ${added} of ${notes.length}` + (added < notes.length ? ' (rest were duplicates)' : '');
      if (added) ioTa.value = '';
    };
    p.querySelector('.mmth-io-export').onclick = async () => {
      const items = ctx.items(); const text = items.join(ioBlock() ? '\n\n' : '\n'); ioTa.value = text; ioTa.focus(); ioTa.select();
      let copied = false; try { await navigator.clipboard.writeText(text); copied = true; } catch (e) { try { copied = document.execCommand('copy'); } catch (x) {} }
      ioMsg.textContent = `${items.length} item(s)` + (copied ? ' — copied to clipboard' : ' — select & copy');
    };
    showTab(tab === 'io' ? 'io' : 'settings');
    placePop(p, anchor);   // position once; tab switches no longer move it
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

  const MIN_PANEL = 300;   // #304: keep the toolbar (incl. ⚙) from clipping when narrow
  function setSideWidth(side, w) { w = Math.max(MIN_PANEL, Math.min(640, Math.round(w))); side.style.flex = '0 0 ' + w + 'px'; side.style.maxWidth = w + 'px'; return w; }

  // #263: never let the panel be wider than the field — cap it to half the row so
  // the ratio is at most 1:1 (was up to ~1:10 in a narrow Art Station modal). The
  // cap reads ONLY the wrap's width, which the container fixes and setting the
  // panel never changes, so this can't oscillate (unlike a field-width-based cap,
  // which would: shrinking the panel grows the field, re-raising the cap…).
  function capPanel(wrap, vsep, side) {
    if (SET.minimized) return;   // panel is out of flow when minimized
    const row = wrap.clientWidth - (vsep ? vsep.offsetWidth : 0); if (!(row > 0)) return;
    const max = Math.floor(row / 2);
    const want = Math.max(MIN_PANEL, Math.min(SET.sideWidth || 300, max));
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
    const filterRow = document.createElement('div'); filterRow.className = 'mmth-filterrow';   // #304 search (opt-in)
    const list = document.createElement('div'); list.className = 'mmth-list';
    const pinbar = document.createElement('div'); pinbar.className = 'mmth-pinbar';   // #304 pinned quick-buttons — placed BELOW the field (in injectAll)
    side.appendChild(ft); side.appendChild(filterRow); side.appendChild(list);

    const inst = { ta, list, side, pinbar, filterRow, view: 'saved', cycId: null, filter: '', viewItems: [] };
    instances.push(inst);

    // search box + N/total count (always shown)
    const fInput = document.createElement('input'); fInput.type = 'text'; fInput.className = 'mmth-filter'; fInput.placeholder = 'Search notes…';
    fInput.addEventListener('input', () => { inst.filter = fInput.value; inst.cycId = null; renderInst(inst); });
    fInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { fInput.value = ''; inst.filter = ''; inst.cycId = null; renderInst(inst); ta.focus(); reMinIfRestored(); return; }   // #304: backing out re-minimizes if we'd auto-restored
      // #304: ↑/↓ move the highlighted match; Enter uses the highlighted one (or the first)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = inst.viewItems || []; if (!items.length) return;
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        let i = items.findIndex(x => x.id === inst.cycId);
        if (i < 0) i = dir > 0 ? -1 : 0;
        i = (i + dir + items.length) % items.length;
        inst.cycId = items[i].id;
        renderInst(inst);
        const cur = inst.list.querySelector('.mmth-cyc');   // keep the selection visible within the list
        if (cur) { const lr = inst.list.getBoundingClientRect(), cr = cur.getBoundingClientRect();
          if (cr.top < lr.top) inst.list.scrollTop -= (lr.top - cr.top);
          else if (cr.bottom > lr.bottom) inst.list.scrollTop += (cr.bottom - lr.bottom); }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const items = inst.viewItems || [];
        const it = items.find(x => x.id === inst.cycId) || items[0];
        if (it) { applyNote(ta, it.text, SET.defaultInsert === 'replace'); if (inst.view === 'saved') bumpUse(it.id); }
      }
    });
    const fCount = document.createElement('span'); fCount.className = 'mmth-count'; inst.countEl = fCount;
    filterRow.appendChild(fInput); filterRow.appendChild(fCount); inst.filterInput = fInput;

    const fb = (glyph, title, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-fb' + (cls ? ' ' + cls : ''); b.textContent = glyph; b.title = title; b.onclick = fn; return b; };
    ft.appendChild(fb('＋', 'Save current edit note', '', () => { const v = (ta.value || '').trim(); if (!v) return toast('Edit note is empty'); toast(addSaved(v) ? 'Saved' : 'Already saved'); }));
    const bSaved = fb('★', 'Saved notes', 'mmth-grp', () => { inst.view = 'saved'; renderInst(inst); });
    const bHist = fb('🕘', 'History (last used)', '', () => { inst.view = 'history'; renderInst(inst); });
    ft.appendChild(bSaved); ft.appendChild(bHist);
    ft.appendChild(fb('✕', 'Clear the edit note', 'mmth-grp', () => { setValue(ta, ''); ta.focus(); }));
    const sp = document.createElement('span'); sp.className = 'mmth-fb mmth-spacer'; ft.appendChild(sp);
    // #309: which edit-note type these notes belong to (notes are kept separate per type)
    const scopeChip = document.createElement('span'); scopeChip.className = 'mmth-scope'; scopeChip.textContent = scopeLabel(SCOPE);
    scopeChip.title = 'Saved notes & history are kept separate per edit-note type — these are your "' + scopeLabel(SCOPE) + '" notes (#309)';
    scopeChip.style.display = SET.scopePerResource ? '' : 'none';   // only shown when scoping is on
    ft.appendChild(scopeChip);
    inst.minBtn = fb('–', 'Minimize to corner', 'mmth-min-btn', () => { restoredFromMin = false; setMinimized(!SET.minimized); });   // #265: left of the ? button
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

  // #304: pinned saved notes shown as one-click quick-insert buttons BELOW the
  // edit-note field (like baby-field bars) — always available, independent of view.
  function renderPinbar(inst) {
    const bar = inst.pinbar; bar.innerHTML = '';
    const pinned = DATA.saved.filter(s => s.pinned);
    if (!pinned.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const n = Math.max(4, Math.min(80, SET.btnChars | 0 || 24));
    const cap = t => { t = t.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
    const dflt = SET.defaultInsert;
    pinned.forEach(it => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-segb'; b.textContent = cap(it.text); b.style.maxWidth = (n + 1) + 'ch';
      b.title = it.text + `\n\n(click: ${dflt} · right-click: ${dflt === 'replace' ? 'append' : 'replace'} · Ctrl/⌘-click: replace + submit)`;
      b.onclick = e => {
        e.preventDefault();
        // #328: Ctrl/⌘-click = replace the note and submit the edit (parity with Ctrl/⌘+Enter;
        // shift was prone to text selection). Same as a list row.
        if (e.ctrlKey || e.metaKey) { applyNote(inst.ta, it.text, true); bumpUse(it.id); const sb = findSubmitBtn(inst.ta); if (sb) sb.click(); return; }
        applyNote(inst.ta, it.text, dflt === 'replace'); bumpUse(it.id);
      };
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
    renderPinbar(inst);
    // the search box is always shown
    inst.filterRow.style.display = 'flex';
    // sort (Saved, from config) then search-filter on the full note text; show N/total
    const all = saved ? sortedSaved() : DATA.history;
    const q = (inst.filter || '').trim().toLowerCase();
    const items = q ? all.filter(it => it.text.toLowerCase().includes(q)) : all;
    inst.viewItems = items;   // Ctrl+↑/↓ and Enter-in-search use exactly what's shown
    if (inst.countEl) inst.countEl.textContent = q ? (items.length + ' / ' + all.length) : (all.length ? String(all.length) : '');
    // drag-reorder only makes sense in the unfiltered manual order
    const manual = saved && (SET.noteSort || 'manual') === 'manual' && !q;
    if (!items.length) { const e = document.createElement('div'); e.className = 'mmth-empty'; e.textContent = all.length ? 'No notes match the search' : (saved ? 'No saved notes — ＋ saves the current one' : 'No history yet'); list.appendChild(e); return; }

    items.forEach((it) => {
      const row = document.createElement('div'); row.className = 'mmth-row';
      if (saved && it.pinned) row.classList.add('mmth-pinned');
      if (it.id === inst.cycId) row.classList.add('mmth-cyc');   // arrow-key / cycle selection (both views) #304
      const dflt = SET.defaultInsert;
      row.title = it.text + `\n\n(click: ${dflt} · right-click: ${dflt === 'replace' ? 'append' : 'replace'} · Ctrl/⌘-click: set + submit)`;

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
        // #289/#328: Ctrl/⌘-click sets the note (replace) AND submits the edit — parity
        // with Ctrl/⌘+Enter (reuses findSubmitBtn); shift was prone to text selection.
        if (e.ctrlKey || e.metaKey) { applyNote(ta, it.text, true); if (saved) bumpUse(it.id); const b = findSubmitBtn(ta); if (b) b.click(); return; }
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
      // #304: the textarea and its pinned-quick-buttons bar share one column, so the
      // bar always sits directly below the field and tracks its left edge / width,
      // whatever the surrounding form layout does.
      const fieldCol = document.createElement('div'); fieldCol.className = 'mmth-fieldcol';
      wrap.appendChild(fieldCol); fieldCol.appendChild(ta);
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
      fieldCol.appendChild(inst.pinbar);   // #304: pinned quick-buttons directly below the field, in its column
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
      // #304: the textarea now lives in .mmth-fieldcol, so MB inserts those <p>s into
      // fieldCol (not wrap) — observe both, and treat fieldCol/ta/pinbar as ours.
      const isOurs = el => el === ta || el === inst.pinbar || (el.classList && (el.classList.contains('mmth-fieldcol') || el.classList.contains('mmth-vsep') || el.classList.contains('mmth-side') || el.classList.contains('mmth-badge')));
      const relocateForeign = node => {
        if (!node || node.nodeType !== 1 || isOurs(node) || !wrap.parentNode) return;
        const above = node.classList && node.classList.contains('error') && !node.classList.contains('invalid');
        wrap.parentNode.insertBefore(node, above ? wrap : wrap.nextSibling);
      };
      [...wrap.children, ...fieldCol.children].forEach(relocateForeign);
      const fObs = muts => muts.forEach(m => m.addedNodes.forEach(relocateForeign));
      new MutationObserver(fObs).observe(wrap, { childList: true });
      new MutationObserver(fObs).observe(fieldCol, { childList: true });
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
        vsep.style.height = ta.offsetHeight + 'px';   // #304: separator spans only the field, not the field+pinbar column
      } catch (x) {} };
      syncFloor();
      requestAnimationFrame(syncFloor); setTimeout(syncFloor, 150); setTimeout(syncFloor, 600);   // catch the sidebar's final layout
      try { new ResizeObserver(syncFloor).observe(side); new ResizeObserver(syncFloor).observe(ta); } catch (x) {}
    });
  }
  // Toggle the "an MB dialog is open" flag so Mammoth's floating UI (main panel
  // badge/pop + babies) hides under it — MB's dialogs/popovers carry no z-index
  // and no backdrop, so they can't otherwise win the stack. Global (runs even
  // when babies are off). #313
  // #333/#397/#config: a dialog (.dialog.popover / .relationship-dialog) whose fields we pin must NOT be
  // treated as blocking, or we'd hide the very baby it hosts. That was a hardcoded allowlist (artist-credit
  // rows, then the "Task" field) — generalise it: a dialog blocks only if it contains NONE of our baby
  // fields (`[data-mmthf]`, set by scan() on every pinned field, custom ones included). This is what let
  // instrument-type relationship dialogs — bass/guitar/… have no Task field — wrongly hide a custom
  // "Credited as" baby while producer/mixer (which DO have Task) worked. Fields BEHIND a dialog are already
  // hidden per-pin by fieldOnTop (elementFromPoint), so keeping non-blocking here can't float them over it.
  const syncDialog = () => {
    const dlgs = [...document.querySelectorAll('.dialog.popover, .relationship-dialog')];
    const blocking = dlgs.some(d => !d.querySelector('[data-mmthf]'));
    document.documentElement.classList.toggle('mmthf-dialog', blocking);
  };
  new MutationObserver(() => { injectAll(); syncDialog(); }).observe(document.documentElement, { childList: true, subtree: true });
  syncDialog();

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

  // #304: Ctrl/Cmd+, focuses the note search box (the panel nearest the focused
  // field, else the first visible one). When the panel is minimized, restore it
  // first so the box is reachable. No-op when search is off.
  document.addEventListener('keydown', e => {
    if (e.key !== ',' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const onScreen = () => [...document.querySelectorAll('.mmth-filter')].filter(i => i.offsetParent !== null);
    let visible = onScreen();
    if (!visible.length) {
      // search box is hidden because the panel is minimized — restore and retry
      if (SET.minimized) { setMinimized(false); restoredFromMin = true; visible = onScreen(); }
      if (!visible.length) return;
    }
    const wrap = e.target && e.target.closest && e.target.closest('.mmth-wrap');
    const near = wrap && wrap.querySelector('.mmth-filter');
    const target = (near && near.offsetParent !== null) ? near : visible[0];
    e.preventDefault(); target.focus(); target.select();
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
      // #397 the free-text "Task" attribute in the Add/Edit relationship dialog (`.attribute-container.text.task`).
      // The dialog is a transient popover, but the field-scan MutationObserver picks it up when it opens. One
      // shared key across every rel type — the point is reusing your standardized task names anywhere.
      { match: '.attribute-container.text.task input[type="text"]', key: 'rel.task', label: 'Task' },
    ];

    // #config user-defined baby fields (SET.customFields) merged into the scan alongside PREDEF. A custom
    // def mirrors PREDEF's shape; a user key is namespaced 'cf:' so it can't collide with a built-in key.
    // Key defaults to the label when not given (fields with the same label then share one saved list).
    const customDefs = () => (SET.customFields || []).filter(c => c && c.match).map(c => {
      const k = String(c.key || c.label || '').trim();
      return { match: c.match, key: k ? 'cf:' + k : null, label: c.label || '',
        dx: (c.dx != null && c.dx !== '') ? +c.dx : undefined, enterDelay: c.enterDelay | 0 };
    });
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
    // #304: caption = the full label, truncated with an ellipsis at the configured
    // length (⚙ "Button label length") — no longer just the first word.
    const btnChars = () => Math.max(4, Math.min(80, SET.btnChars | 0 || 24));
    const captionOf = it => { if (it.cap) return it.cap; const n = btnChars(); const t = (it.label || it.v || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

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
    const pressEnter = el => { for (const type of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 })); };
    // Is the field's autocomplete dropdown actually open right now? We only fire Enter when it is, so a
    // mistimed Enter can never LEAK to a form/dialog that would submit or close on it — an open autocomplete
    // consumes (and stops) the Enter. Covers MB's autocomplete2 (aria-expanded / its listbox) + legacy jQuery UI.
    function acOpen(el) {
      // MB autocomplete2 auto-highlights the first result and sets aria-activedescendant → the safest "an
      // option is ready to accept" signal (a bare visible-but-empty listbox appears earlier and must NOT
      // count, or Enter would fire with nothing to accept and leak).
      if (el.getAttribute('aria-activedescendant')) return true;
      if (el.getAttribute('aria-expanded') === 'true') return true;
      const id = el.getAttribute('aria-owns') || el.getAttribute('aria-controls');
      if (id) { const m = document.getElementById(id); if (m && m.offsetParent && m.querySelector('li,[role="option"]')) return true; }
      const box = el.closest('.autocomplete2');
      if (box && [...box.querySelectorAll('[role="option"], li.option')].some(n => n.offsetParent)) return true;
      return [...document.querySelectorAll('ul.ui-autocomplete')].some(u => u.offsetParent && u.querySelector('li'));   // legacy jQuery UI
    }
    // p.enterDelay (ms): 0 = never; N>0 = press Enter N ms after the value is set, but ONLY if the field's
    // autocomplete dropdown is open by then — so it accepts the highlighted match and can't leak elsewhere.
    // Tune per field: instruments resolve fast (~150ms), artists search slower and need more.
    function recallInto(p, rec) {
      const ok = writeField(p.el, rec);
      const ms = Math.max(0, Math.min(10000, p.enterDelay | 0));
      if (ok && ms > 0) { try { p.el.focus(); } catch (e) {} setTimeout(() => { try { if (p.el.isConnected && acOpen(p.el)) { p.el.focus(); pressEnter(p.el); } } catch (e) {} }, ms); }
      return ok;
    }
    function clearField(el) {
      if (isSelect(el)) { const o = [...el.options].find(o => o.value === ''); if (!o) return; setNative(el, ''); el.dispatchEvent(new Event('change', { bubbles: true })); }
      else { setNative(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
      try { el.focus(); } catch (e) {}
    }
    // return focus to the field after an interactive apply (caret at end for text inputs)
    const focusField = el => { try { el.focus(); if (!isSelect(el) && el.setSelectionRange) { const n = (el.value || '').length; el.setSelectionRange(n, n); } } catch (e) {} };
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
      /* MB's dialogs/popovers (Add/Edit relationship, …) carry no z-index, so our
         high-z babies would float on top of them and their dropdowns. Hide the
         babies while any MB dialog is open. */
      html.mmthf-dialog .mmthf-pin, html.mmthf-dialog .mmthf-bar, html.mmthf-dialog .mmthf-pop { opacity:0 !important; pointer-events:none !important; }
      .mmthf-hl { outline:2px solid #5aa67e !important; outline-offset:1px; }
      .mmthf-bar { position:absolute; z-index:9996; display:none; }
      /* #304: individual rounded "tag" buttons that wrap to new rows — matches the main edit-note pins */
      .mmthf-seg { display:flex; flex-wrap:wrap; gap:5px; max-width:100%; }
      .mmthf-segb { border:1px solid #cfd9d3 !important; background:#fbfdfc !important; border-radius:7px !important; padding:3px 10px !important; font:12px/1.2 -apple-system,Segoe UI,Arial,sans-serif !important; color:#27483a !important; cursor:pointer; max-width:200px; height:auto !important; min-height:0 !important; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,.06); }
      .mmthf-segb:hover { background:#eaf5ee; border-color:#5aa67e; }
      .mmthf-pop { position:fixed; z-index:9999; background:#fff; border:1px solid #c7d3cc; border-radius:8px; box-shadow:0 8px 26px rgba(20,50,35,.2); font:12px/1.35 -apple-system,Segoe UI,Arial,sans-serif; color:#222; width:260px; overflow:hidden; }
      .mmthf-ft { display:flex; align-items:center; gap:1px; padding:3px 5px; background:#f1f6f3; border-bottom:1px solid #e7eee9; }
      .mmthf-fb { cursor:pointer; border:none; background:none; font-size:14px; line-height:1; padding:3px 7px; border-radius:5px; color:#566; }
      .mmthf-fb:hover { background:#dcefe2; }
      .mmthf-fb[aria-disabled="true"] { color:#b7c2bb; cursor:default; background:none; }
      .mmthf-ft-title { flex:1 1 auto; min-width:0; text-align:center; font-weight:700; font-size:13px; color:#293330; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 4px; }
      .mmthf-filterrow { padding:5px 6px; border-bottom:1px solid #e7eee9; background:#f7faf8; }
      .mmthf-filter { display:block; width:100%; box-sizing:border-box; border:1px solid #d7e0db; border-radius:5px; padding:3px 7px; font:12px -apple-system,Segoe UI,Arial,sans-serif; }
      .mmthf-filter:focus { outline:none; border-color:#5aa67e; }
      .mmthf-row.mmthf-sel { background:#e7f2ea; }
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
      for (const d of customDefs()) { try { document.querySelectorAll(d.match).forEach(el => add(el, d)); } catch (e) {} }   // #config user-defined fields (invalid selectors ignored)
      document.querySelectorAll('.mmth-pin').forEach(el => add(el, { key: el.dataset.mmthKey ? 'k:' + el.dataset.mmthKey : null, label: el.dataset.mmthLabel || '', enterDelay: +el.dataset.mmthEnter || 0 }));
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
        const p = { el, key: keyFor(el, def), label: def.label || fLabelText(el) || 'Field', btn, bar, sel, dx, gid: def.gid || null, enterDelay: def.enterDelay | 0 };
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
          p._rbase = parseFloat(getComputedStyle(host)[prop]) || 0;   // base padding to add the strip onto
          if (tr && tr.children.length > 1) { p._rtr = tr; tr.classList.add('mmthf-rrow'); }
        }
      } else if (p._rh) {
        p._rh.style[p._rp] = p._ro; p._rh = null;
        if (p._rtr) { p._rtr.classList.remove('mmthf-rrow'); p._rtr = null; }
      }
    }
    // #304: size the reserved strip to the bar's ACTUAL height, so a bar that wraps to
    // several rows pushes content down by the right amount (not a fixed one-row guess).
    function sizeReserve(p) {
      if (!p._rh) return;
      const h = (p.bar.style.display !== 'none') ? p.bar.offsetHeight : 0;
      p._rh.style[p._rp] = (p._rbase + (h ? h + 6 : 0)) + 'px';
    }
    function renderBar(p) {
      const items = listFor(p.key).filter(x => x.pinned);
      p.bar.innerHTML = '';
      setReserve(p, items.length > 0);
      if (!items.length) { p.bar.style.display = 'none'; return; }
      const seg = document.createElement('div'); seg.className = 'mmthf-seg';
      items.forEach(it => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmthf-segb'; b.textContent = captionOf(it); b.style.maxWidth = (btnChars() + 1) + 'ch'; b.title = `${it.label} → click to set`; b.addEventListener('click', e => { e.preventDefault(); recallInto(p, it); }); seg.appendChild(b); });
      p.bar.appendChild(seg);
    }
    function applyDefault(p) { const d = defaultOf(p.key); if (d && !readField(p.el).v) recallInto(p, d); }

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
        sizeReserve(p);   // #304: match the field's reserved strip to the (possibly multi-row) bar height
      }
      if (pins.some(p => p.dead)) pins = pins.filter(p => !p.dead);
    }

    function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('click', onDown, true); document.removeEventListener('keydown', onKey, true); } }
    function onDown(e) { if (pop && !pop.contains(e.target) && !e.target.classList.contains('mmthf-pin')) { e.preventDefault(); e.stopPropagation(); closePop(); } }   // #305: swallow the outside click (see closePop note above)
    function onKey(e) { if (pop && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const f = pop._field; closePop(); if (f) focusField(f); } }   // #346: ESC kills the popover (no leak to MB) and returns focus to the field
    function place(el, anchor) { const r = anchor.getBoundingClientRect(); el.style.left = Math.max(6, Math.min(innerWidth - el.offsetWidth - 6, r.left)) + 'px'; el.style.top = Math.min(innerHeight - el.offsetHeight - 6, r.bottom + 4) + 'px'; }
    function togglePop(p, atField) { const open = pop && pop._key === p.key && pop._anchor === p.btn; closePop(); if (open) return; openPop(p, atField); }
    function openPop(p, atField) {
      const cur = captureField(p);   // entity fields capture the selected MBID (#296)
      const items = listFor(p.key);   // raw order — drag (⠿) reorders it freely, like the edit-note panel
      const el = document.createElement('div'); el.className = 'mmthf-pop'; el._key = p.key; el._anchor = p.btn; el._field = p.el;
      const rowHtml = (it, i) => {
        const star = `<button class="mmthf-ra mmthf-star" title="${it.pinned ? 'Unpin from buttons' : 'Pin as a button'}">${it.pinned ? '★' : '☆'}</button>`;
        const def = `<button class="mmthf-ra mmthf-def" title="${it.default ? 'Default — auto-fills an empty field (click to unset)' : 'Make default (auto-fills an empty field)'}">${it.default ? '◉' : '◯'}</button>`;
        const acts = `<div class="mmthf-acts">${star}${def}<button class="mmthf-ra mmthf-del" title="Forget">🗑</button><span class="mmthf-grab" title="Drag to reorder" draggable="true">⠿</span></div>`;
        const ind = `<span class="mmthf-ind">${it.default ? '<span>◉</span>' : ''}${it.pinned ? '<span>★</span>' : ''}</span>`;
        return `<div class="mmthf-row" data-i="${i}"><span class="mmthf-rtxt">${esc(it.label)}</span>${ind}${acts}</div>`;
      };
      // the filter box is always shown (whenever there's a saved value to filter)
      const searchOn = items.length > 0;
      el.innerHTML =
        `<div class="mmthf-ft">
           <button class="mmthf-fb mmthf-save" ${cur.v ? '' : 'aria-disabled="true"'} title="${cur.v ? 'Save current value: ' + esc(cur.label) : 'Field is empty'}">＋</button>
           <button class="mmthf-fb mmthf-clear" title="Clear the field">✕</button>
           <span class="mmthf-ft-title"></span>
           <button class="mmthf-fb mmthf-cfg" title="Mammoth settings">⚙︎</button>
         </div>
         ${searchOn ? '<div class="mmthf-filterrow"><input class="mmthf-filter" type="text" placeholder="Filter…" spellcheck="false"></div>' : ''}
         <div class="mmthf-list">${items.map(rowHtml).join('') || '<div class="mmthf-empty">No saved values yet</div>'}</div>`;
      document.body.appendChild(el); pop = el;
      const list = el.querySelector('.mmthf-list');
      if (searchOn) {
        const fin = el.querySelector('.mmthf-filter');
        let hl = -1;   // highlighted row among the currently-visible ones
        const vis = () => [...el.querySelectorAll('.mmthf-row')].filter(r => r.style.display !== 'none');
        const paint = () => { const rows = vis(); rows.forEach((r, i) => r.classList.toggle('mmthf-sel', i === hl)); if (rows[hl]) rows[hl].scrollIntoView({ block: 'nearest' }); };
        const applyFilter = () => { const q = (fin.value || '').trim().toLowerCase(); el.querySelectorAll('.mmthf-row').forEach(r => { const t = (r.querySelector('.mmthf-rtxt') || {}).textContent || ''; r.style.display = (!q || t.toLowerCase().includes(q)) ? '' : 'none'; }); hl = vis().length ? 0 : -1; paint(); };
        fin.addEventListener('input', applyFilter);
        fin.addEventListener('keydown', e => {
          const rows = vis();
          if (e.key === 'Escape') { e.stopPropagation(); if (fin.value) { fin.value = ''; applyFilter(); } else closePop(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) { hl = (hl + 1) % rows.length; paint(); } return; }
          if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { hl = (hl - 1 + rows.length) % rows.length; paint(); } return; }
          if (e.key === 'Enter') { e.preventDefault(); const r = rows[hl] || rows[0]; if (r) { recallInto(p, items[+r.dataset.i]); closePop(); focusField(p.el); } return; }   // keyboard apply → refocus the field
        });
        applyFilter();   // highlight the first item so Enter works immediately
        setTimeout(() => { try { fin.focus(); } catch (e) {} }, 0);
      }
      el.querySelector('.mmthf-save').addEventListener('click', () => { if (!cur.v) return; rememberValue(p.key, cur); refreshState(p); reopen(p); });
      el.querySelector('.mmthf-clear').addEventListener('click', () => { clearField(p.el); reopen(p); });
      // #309: open the config with Import/Export scoped to THIS field's values
      el.querySelector('.mmthf-cfg').addEventListener('click', () => {
        const a = p.btn;
        // #309: entity fields (Artist/Label) store v=MBID, label=name. Export both as
        // "name<TAB>MBID" so a re-import resolves the real entity (text fields stay plain).
        const io = {
          items: () => listFor(p.key).map(x => (x.v && x.label && x.v !== x.label) ? (x.label + '\t' + x.v) : (x.label || x.v)),
          add: notes => {
            const arr = listFor(p.key); let added = 0; const have = new Set(arr.map(x => x.v));
            for (const line of notes) { const i = line.indexOf('\t'); const label = (i >= 0 ? line.slice(0, i) : line).trim(); const v = (i >= 0 ? line.slice(i + 1) : line).trim(); if (!v || have.has(v)) continue; have.add(v); arr.unshift({ v, label: label || v, ts: Date.now() }); added++; }
            FDATA[p.key] = arr.slice(0, MAX_PER_FIELD); if (added) { saveF(); refreshState(p); } return added;
          },
          help: 'Import / export the “' + p.label + '” values (entity fields keep their MBID).',
        };
        closePop(); openSettings(a, 'io', io);
      });
      el.querySelectorAll('.mmthf-row').forEach(row => {
        const it = items[+row.dataset.i];
        row.addEventListener('click', e => {
          if (e.target.closest('.mmthf-grab')) return;
          if (e.target.closest('.mmthf-star')) { togglePin(p.key, it.v); refreshState(p); reopen(p); return; }
          if (e.target.closest('.mmthf-def')) { setDefault(p.key, it.v); applyDefault(p); reopen(p); return; }
          if (e.target.closest('.mmthf-del')) { forgetValue(p.key, it.v); refreshState(p); reopen(p); return; }
          recallInto(p, it); closePop();   // don't refocus the field on apply — it re-triggers autocomplete
        });
        const grab = row.querySelector('.mmthf-grab');
        grab.addEventListener('dragstart', e => { _fdrag = { v: it.v }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'row'); } catch (x) {} row.classList.add('mmthf-dragging'); });
        grab.addEventListener('dragend', () => { row.classList.remove('mmthf-dragging'); clearMarks(list); _fdrag = null; });
        row.addEventListener('dragover', e => { if (!_fdrag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; clearMarks(list); row.classList.add(after(e, row) ? 'mmthf-drop-after' : 'mmthf-drop-before'); });
        row.addEventListener('dragleave', () => row.classList.remove('mmthf-drop-before', 'mmthf-drop-after'));
        row.addEventListener('drop', e => { if (!_fdrag) return; e.preventDefault(); reorder(p.key, _fdrag.v, it.v, !after(e, row)); clearMarks(list); _fdrag = null; refreshState(p); reopen(p); });
      });
      el._atField = atField; place(el, atField ? p.el : p.btn);   // #345: hotkey opens at the field's left edge; a pin CLICK opens at the pin, by the cursor
      setTimeout(() => { document.addEventListener('click', onDown, true); document.addEventListener('keydown', onKey, true); }, 0);
    }
    const reopen = p => { const af = pop ? pop._atField : false; closePop(); openPop(p, af); };   // keep the same anchor across a reopen

    const relayout = () => { syncDialog(); if (running && !raf) raf = requestAnimationFrame(() => { raf = 0; layout(); }); };
    function start() {
      if (running) return; running = true;
      injectCss();
      const on = (t, ev, fn, cap) => { t.addEventListener(ev, fn, cap); listeners.push([t, ev, fn, cap]); };
      on(window, 'scroll', relayout, true); on(window, 'resize', relayout, false);
      ['focusin', 'focusout', 'click', 'input', 'keyup'].forEach(ev => on(document, ev, relayout, true));
      // Ctrl/Cmd+, — if a baby popover is open, focus its filter; else if a baby field is focused, open
      // its popover at the field's left edge (which auto-focuses the filter).
      on(document, 'keydown', e => {
        if (e.key !== ',' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
        // #397: when this handler acts on a baby field, swallow the event so the global edit-note
        // Ctrl+, handler (bubble phase) doesn't ALSO fire and steal focus to the note panel.
        if (pop) { const f = pop.querySelector('.mmthf-filter'); if (f) { e.preventDefault(); e.stopPropagation(); f.focus(); if (f.select) f.select(); return; } }
        const el = document.activeElement;
        const p = el && pins.find(pp => pp.el === el);
        if (p) { e.preventDefault(); e.stopPropagation(); openPop(p, true); }   // hotkey → anchor to the field's left edge
      }, true);
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
      let st = 0; mo = new MutationObserver(() => { syncDialog(); clearTimeout(st); st = setTimeout(scan, 150); bump(); }); mo.observe(document.documentElement, { childList: true, subtree: true });
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
    return { start, stop, toggle(on) { on ? start() : stop(); }, relabel() { pins.forEach(p => renderBar(p)); }, refresh() { if (running) { stop(); start(); } } };   // refresh: re-scan after custom fields change
  }
})();
