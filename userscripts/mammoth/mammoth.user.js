// ==UserScript==
// @name         Mammoth
// @namespace    https://musicbrainz.org/
// @version      2026.6.14.190000
// @description  Edit-note memory for MusicBrainz: auto-remembers your last edit notes and lets you save reusable ones, recalling them from a compact panel beside the edit-note field on every edit form. A nicer replacement for Elephant Editor.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij4KICA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI4IiBmaWxsPSIjZjJlY2UyIi8+CiAgPCEtLSBzaGFnZ3kgYm9keSArIGRvbWVkIGhlYWQgLS0+CiAgPHBhdGggZD0iTTI4IDgyYzAtMTAgNC0xNyAxMS0yMSAzLTE1IDE1LTI1IDMxLTI1czI3IDEwIDMwIDI0YzcgMyAxMCA5IDEwIDE3djEwYzAgNC0zIDctNyA3aC03di05aC04djlINjZ2LTloLTh2OWgtOWMtNSAwLTktNC05LTl2LTNjLTQtMi03LTYtNy0xMVoiIGZpbGw9IiM4ZDY0NDIiLz4KICA8IS0tIGVhciAtLT4KICA8cGF0aCBkPSJNNzQgNDZjMTEtNyAyMi0zIDIyIDgtOS01LTE2LTMtMjAgM1oiIGZpbGw9IiM3YTU0MzYiLz4KICA8IS0tIHRydW5rIC0tPgogIDxwYXRoIGQ9Ik00MiA2NGMtOSA2LTEzIDE5LTcgMzEgMyA2IDExIDMgOS0zLTItOCAwLTE1IDctMTlaIiBmaWxsPSIjOGQ2NDQyIi8+CiAgPCEtLSB0dXNrIC0tPgogIDxwYXRoIGQ9Ik00NiA4NmMtOSA1LTE4IDItMjItNyA3IDcgMTUgNiAyMC0xWiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjNmY0YTJlIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDwhLS0gZXllIC0tPgogIDxjaXJjbGUgY3g9IjU0IiBjeT0iNTYiIHI9IjQiIGZpbGw9IiMyYTIwMTciLz4KPC9zdmc+Cg==
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

(function () {
  'use strict';

  const KEY = 'mammoth:data';
  const SKEY = 'mammoth:settings';
  const DEFAULTS = { historySize: 10, hideHelp: false, defaultInsert: 'replace', visibleRows: 6, sideWidth: 300 };   // defaultInsert: 'replace' | 'append'
  const VERSION = '2026.6.14.190000';   // keep in sync with @version (fallback when GM_info is unavailable)
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mammoth/README.md';
  const SYNTAX_URL = 'https://musicbrainz.org/doc/Edit_Note';
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };

  const loadData = () => { try { return Object.assign({ saved: [], history: [] }, JSON.parse(GM_getValue(KEY, '{}') || '{}')); } catch (e) { return { saved: [], history: [] }; } };
  const saveData = () => { try { GM_setValue(KEY, JSON.stringify(DATA)); } catch (e) {} render(); };
  const loadSet = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(GM_getValue(SKEY, '{}') || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const persistSet = () => { try { GM_setValue(SKEY, JSON.stringify(SET)); } catch (e) {} };           // quiet save (no re-render)
  const saveSet = () => { persistSet(); applyHelp(); render(); };

  let DATA = loadData();
  let SET = loadSet();
  const uid = () => 'n' + Math.random().toString(36).slice(2, 9);

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

  // ── insert (React-safe) ──────────────────────────────────────────────────────
  const NATIVE_SET = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  function setValue(ta, val) { NATIVE_SET.call(ta, val); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); }
  function applyNote(ta, text, replace) {
    const cur = ta.value || '';
    if (!replace && cur.trim()) {
      if (cur.split('\n').some(l => l.trim() === text.trim())) { toast('Already in the note'); return; }   // #212: don't append a duplicate line
    }
    setValue(ta, (replace || !cur.trim()) ? text : cur.replace(/\s+$/, '') + '\n' + text);
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
  /* On the release editor the edit note sits in a 540px .half-width column (its
     only sibling is the changes warning, not a guidelines column), so give that
     column the full form width when Mammoth is active. The :has() selector
     scopes it to our column only. min-width:0 lets the editnote fieldset
     (min-content by default) take that width so margin:auto can center it. */
  .half-width:has(> .editnote.mmth-on), .col:has(> .editnote.mmth-on) { width:100% !important; max-width:100% !important; }
  .editnote.mmth-on { width:100% !important; max-width:100% !important; min-width:0 !important; box-sizing:border-box; }
  .editnote.mmth-on > .row { width:100% !important; box-sizing:border-box; }
  .editnote.mmth-on > legend, .editnote.mmth-on > .row > label[for] { display:none !important; }
  .mmth-wrap { display:flex; gap:0; align-items:stretch; width:100%; max-width:1040px; margin:6px auto; box-sizing:border-box; }
  .mmth-wrap > textarea.edit-note { flex:1 1 auto; width:auto !important; min-width:0; }
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
  .mmth-pop label { display:flex; align-items:center; gap:6px; margin:5px 0; cursor:pointer; }
  .mmth-pop input[type="number"] { width:46px; border:1px solid #d7e0db; border-radius:4px; padding:1px 4px; }
  .mmth-pop select { border:1px solid #d7e0db; border-radius:4px; padding:1px 4px; }
  .mmth-pop code { background:#f1f4f2; border-radius:3px; padding:0 3px; font-size:12px; }
  .mmth-pop .mmth-syn { display:grid; grid-template-columns:auto 1fr; gap:3px 10px; margin:4px 0; }
  .mmth-pop .mmth-sub { font-weight:600; font-size:12px; margin:8px 0 2px; }
  .mmth-toast { position:fixed; z-index:100000; background:#2c3a33; color:#fff; padding:6px 12px; border-radius:6px; font:13px sans-serif; box-shadow:0 4px 14px rgba(0,0,0,.25); left:50%; top:14px; transform:translateX(-50%); }
  `;
  (function () { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); })();

  function toast(msg) { const t = document.createElement('div'); t.className = 'mmth-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 1500); }

  // ── popovers (settings + syntax help) ────────────────────────────────────────
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', onPopDown, true); } }
  function onPopDown(e) { if (pop && !pop.contains(e.target) && !e.target.closest('.mmth-pop-anchor')) closePop(); }
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
      <h4>🦣 Mammoth <span class="mmth-ver">v${scriptVersion()}</span><a href="${HELP_URL}" target="_blank" rel="noopener" title="Open the README">? Help</a></h4>
      <label><input type="checkbox" class="mmth-s-help"> Hide edit-note help text</label>
      <label>Default click action
        <select class="mmth-s-ins"><option value="replace">replace</option><option value="append">append</option></select>
      </label>
      <div class="mmth-tip">Right-click does the other action.</div>
      <label>Items shown <input type="number" class="mmth-s-rows" min="1" max="30"></label>
      <label>History size <input type="number" class="mmth-s-hist" min="1" max="50"></label>`;
    document.body.appendChild(p); pop = p;
    const help = p.querySelector('.mmth-s-help'); help.checked = !!SET.hideHelp;
    const ins = p.querySelector('.mmth-s-ins'); ins.value = SET.defaultInsert;
    const rows = p.querySelector('.mmth-s-rows'); rows.value = SET.visibleRows;
    const hist = p.querySelector('.mmth-s-hist'); hist.value = SET.historySize;
    help.onchange = () => { SET.hideHelp = help.checked; saveSet(); };
    ins.onchange = () => { SET.defaultInsert = ins.value; saveSet(); };
    rows.onchange = () => { SET.visibleRows = Math.max(1, Math.min(30, parseInt(rows.value, 10) || 6)); rows.value = SET.visibleRows; saveSet(); };
    hist.onchange = () => { SET.historySize = Math.max(1, Math.min(50, parseInt(hist.value, 10) || 10)); hist.value = SET.historySize; saveSet(); recordHistory(''); };
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

  // drag the separator to resize the panel vs. the field (persisted)
  function wireResize(vsep, side) {
    let startX = 0, startW = 0, on = false;
    vsep.addEventListener('pointerdown', e => { on = true; startX = e.clientX; startW = side.getBoundingClientRect().width; try { vsep.setPointerCapture(e.pointerId); } catch (x) {} vsep.classList.add('mmth-dragv'); document.body.style.userSelect = 'none'; e.preventDefault(); });
    vsep.addEventListener('pointermove', e => { if (on) setSideWidth(side, startW - (e.clientX - startX)); });   // panel is on the right → drag left widens it
    const end = e => { if (!on) return; on = false; vsep.classList.remove('mmth-dragv'); document.body.style.userSelect = ''; SET.sideWidth = setSideWidth(side, side.getBoundingClientRect().width); saveSet(); try { vsep.releasePointerCapture(e.pointerId); } catch (x) {} };
    vsep.addEventListener('pointerup', end); vsep.addEventListener('pointercancel', end);
  }

  function buildSide(ta) {
    const side = document.createElement('div'); side.className = 'mmth-side';
    setSideWidth(side, SET.sideWidth || 300);
    const ft = document.createElement('div'); ft.className = 'mmth-ft';            // toolbar ON TOP (#212)
    const list = document.createElement('div'); list.className = 'mmth-list';
    side.appendChild(ft); side.appendChild(list);

    const inst = { ta, list, view: 'saved', cyc: -1 };
    instances.push(inst);

    const fb = (glyph, title, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-fb' + (cls ? ' ' + cls : ''); b.textContent = glyph; b.title = title; b.onclick = fn; return b; };
    ft.appendChild(fb('＋', 'Save current edit note', '', () => { const v = (ta.value || '').trim(); if (!v) return toast('Edit note is empty'); toast(addSaved(v) ? 'Saved' : 'Already saved'); }));
    const bSaved = fb('★', 'Saved notes', 'mmth-grp', () => { inst.view = 'saved'; renderInst(inst); });
    const bHist = fb('🕘', 'History (last used)', '', () => { inst.view = 'history'; renderInst(inst); });
    ft.appendChild(bSaved); ft.appendChild(bHist);
    ft.appendChild(fb('✕', 'Clear the edit note', 'mmth-grp', () => { setValue(ta, ''); ta.focus(); }));
    const sp = document.createElement('span'); sp.className = 'mmth-fb mmth-spacer'; ft.appendChild(sp);
    ft.appendChild(fb('?', 'Edit-note syntax', 'mmth-pop-anchor', e => openSyntax(e.currentTarget)));
    ft.appendChild(fb('⚙', 'Settings', 'mmth-pop-anchor', e => openSettings(e.currentTarget)));
    inst.tabs = { saved: bSaved, history: bHist };

    ta.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      // Ctrl/⌘+B / +I wrap the selection in MB edit-note bold / italic markup
      if (k === 'b' || k === 'i') { e.preventDefault(); wrapSel(ta, k === 'b' ? "'''" : "''"); return; }
      // Ctrl/⌘+↑/↓ cycle through saved notes, replacing the field (focus stays here)
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const items = DATA.saved; if (!items.length) return;
      e.preventDefault();
      inst.cyc = (inst.cyc + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      setValue(ta, items[inst.cyc].text);
      if (inst.view !== 'saved') { inst.view = 'saved'; inst.tabs && inst.tabs.saved.classList.add('on'); inst.tabs && inst.tabs.history.classList.remove('on'); }
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
    return side;
  }

  function renderInst(inst) {
    const { ta, list } = inst;
    list.style.maxHeight = (Math.max(1, Math.min(30, SET.visibleRows | 0 || 6)) * 26) + 'px';   // show N items, then scroll (#212)
    list.innerHTML = '';
    if (inst.tabs) { inst.tabs.saved.classList.toggle('on', inst.view === 'saved'); inst.tabs.history.classList.toggle('on', inst.view === 'history'); }
    const saved = inst.view === 'saved';
    const items = saved ? DATA.saved : DATA.history;
    if (!items.length) { const e = document.createElement('div'); e.className = 'mmth-empty'; e.textContent = saved ? 'No saved notes — ＋ saves the current one' : 'No history yet'; list.appendChild(e); return; }

    items.forEach((it, idx) => {
      const row = document.createElement('div'); row.className = 'mmth-row';
      if (saved && idx === inst.cyc) row.classList.add('mmth-cyc');
      const dflt = SET.defaultInsert;
      row.title = it.text + `\n\n(click: ${dflt} · right-click: ${dflt === 'replace' ? 'append' : 'replace'})`;

      const txt = document.createElement('span'); txt.className = 'mmth-txt'; txt.textContent = it.text.replace(/\s+/g, ' ').trim();
      row.appendChild(txt);

      // right-side hover actions (delete / pin), then the drag handle (saved only)
      const acts = document.createElement('div'); acts.className = 'mmth-rowacts';
      const ra = (glyph, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-ra'; b.textContent = glyph; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); }; acts.appendChild(b); };
      if (saved) ra('🗑', 'Delete', () => removeSaved(it.id));
      else { ra('★', 'Save (pin to Saved)', () => { if (addSaved(it.text)) toast('Saved'); }); ra('🗑', 'Remove', () => removeHistory(it.text)); }
      row.appendChild(acts);

      if (saved) {
        const grab = document.createElement('span'); grab.className = 'mmth-grab'; grab.textContent = '⠿'; grab.title = 'Drag to reorder'; grab.draggable = true;
        grab.addEventListener('dragstart', e => { _drag = { id: it.id }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'row'); } catch (x) {} row.classList.add('mmth-dragging'); });
        grab.addEventListener('dragend', () => { row.classList.remove('mmth-dragging'); clearMarks(list); _drag = null; });
        row.appendChild(grab);
      }

      row.onclick = () => applyNote(ta, it.text, SET.defaultInsert === 'replace');
      row.oncontextmenu = e => { e.preventDefault(); applyNote(ta, it.text, SET.defaultInsert !== 'replace'); };
      if (saved) {
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
      const en = ta.closest('.editnote'); if (en) en.classList.add('mmth-on');   // hides the redundant legend + "Edit note:" label (#212)
      const wrap = document.createElement('div'); wrap.className = 'mmth-wrap';
      ta.parentNode.insertBefore(wrap, ta);
      wrap.appendChild(ta);
      // remember the textarea height the user sets with the native resize grip (vertical);
      // the splitter (below) remembers the field/panel split (horizontal).
      if (SET.taHeight) ta.style.height = SET.taHeight + 'px';
      let hT; try { new ResizeObserver(() => { clearTimeout(hT); hT = setTimeout(() => { const h = ta.clientHeight; if (h > 40 && h !== SET.taHeight) { SET.taHeight = h; persistSet(); } }, 400); }).observe(ta); } catch (x) {}
      const vsep = document.createElement('div'); vsep.className = 'mmth-vsep'; vsep.title = 'Drag to resize'; wrap.appendChild(vsep);   // resizable separator between field & panel (#212)
      const side = buildSide(ta); wrap.appendChild(side);
      wireResize(vsep, side);
    });
  }
  new MutationObserver(() => injectAll()).observe(document.documentElement, { childList: true, subtree: true });
  injectAll();
})();
