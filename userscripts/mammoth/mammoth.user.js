// ==UserScript==
// @name         Mammoth
// @namespace    https://musicbrainz.org/
// @version      2026.6.14.180000
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
// widens that field to the full page width to make room.
//
//   - AUTO-HISTORY: remembers the last N edit notes you submit (default 10,
//     deduped). No "remember this" checkbox.
//   - SAVED notes: keep reusable ones handy; ★ marks a favourite, drag-free ↑↓
//     reordering, delete. One line each (full text on hover).
//   - INSERT: left-click appends a note, right-click replaces the field. No
//     modifier keys. Ctrl/⌘ + ↑/↓ cycles through saved notes, replacing the field.
//   - Never auto-overwrites, so it won't clobber notes Apollo / Credit Hoarder /
//     Platform Check write for their own submissions.

(function () {
  'use strict';

  const KEY = 'mammoth:data';
  const SKEY = 'mammoth:settings';
  const DEFAULTS = { historySize: 10, hideHelp: false };

  const loadData = () => { try { return Object.assign({ saved: [], history: [] }, JSON.parse(GM_getValue(KEY, '{}') || '{}')); } catch (e) { return { saved: [], history: [] }; } };
  const saveData = () => { try { GM_setValue(KEY, JSON.stringify(DATA)); } catch (e) {} render(); };
  const loadSet = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(GM_getValue(SKEY, '{}') || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const saveSet = () => { try { GM_setValue(SKEY, JSON.stringify(SET)); } catch (e) {} applyHelp(); render(); };

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
    DATA.saved.push({ id: uid(), text, fav: false, ts: Date.now() });
    saveData(); return true;
  }
  const removeSaved = id => { DATA.saved = DATA.saved.filter(s => s.id !== id); saveData(); };
  const toggleFav = id => { const s = DATA.saved.find(x => x.id === id); if (s) { s.fav = !s.fav; saveData(); } };
  const removeHistory = text => { DATA.history = DATA.history.filter(h => h.text !== text); saveData(); };
  function moveSaved(id, dir) {
    const i = DATA.saved.findIndex(s => s.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= DATA.saved.length) return;
    const a = DATA.saved; [a[i], a[j]] = [a[j], a[i]]; saveData();
  }
  // saved in display order: favourites first, each group keeps array order
  const orderedSaved = () => [...DATA.saved.filter(s => s.fav), ...DATA.saved.filter(s => !s.fav)];

  // ── insert (React-safe) ──────────────────────────────────────────────────────
  const NATIVE_SET = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  function setValue(ta, val) { NATIVE_SET.call(ta, val); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); }
  function applyNote(ta, text, replace) {
    const cur = ta.value || '';
    setValue(ta, (replace || !cur.trim()) ? text : cur.replace(/\s+$/, '') + '\n' + text);
    ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
  }

  // ── capture on submit ────────────────────────────────────────────────────────
  const captureNote = () => document.querySelectorAll('textarea.edit-note').forEach(ta => recordHistory(ta.value));
  document.addEventListener('submit', captureNote, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, input[type="submit"]'); if (!b) return;
    const t = (b.textContent || b.value || '').trim().toLowerCase();
    if (b.id === 'enter-edit' || /^(enter edit|submit|add edit|save)/.test(t) || (b.classList && b.classList.contains('submit'))) captureNote();
  }, true);

  // ── styles ───────────────────────────────────────────────────────────────────
  const css = `
  fieldset.editnote, .editnote { max-width:100% !important; }
  .mmth-wrap { display:flex; gap:10px; align-items:stretch; width:100%; box-sizing:border-box; }
  .mmth-wrap > textarea.edit-note { flex:1 1 auto; width:auto !important; min-width:0; }
  .mmth-hidehelp > p { display:none !important; }
  .mmth-side { flex:0 0 300px; max-width:300px; display:flex; flex-direction:column; border:1px solid #cfd9d3;
               border-radius:8px; background:#fbfdfc; font:12px/1.35 -apple-system,Segoe UI,Arial,sans-serif; overflow:hidden; }
  .mmth-side-hd { padding:4px 8px; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:#7d8a82; background:#f1f6f3; border-bottom:1px solid #e7eee9; }
  .mmth-list { flex:1 1 auto; overflow:auto; min-height:96px; max-height:150px; }
  .mmth-row { display:flex; align-items:center; gap:4px; padding:4px 7px; border-top:1px solid #f0f4f2; cursor:pointer; }
  .mmth-row:first-child { border-top:none; }
  .mmth-row:hover { background:#eaf5ee; }
  .mmth-row.mmth-cyc { background:#d9efe1; }
  .mmth-txt { flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#293330; }
  .mmth-star { flex:none; cursor:pointer; color:#cdd6d1; font-size:12px; }
  .mmth-star.on { color:#e8a93a; }
  .mmth-rowacts { flex:none; display:flex; gap:1px; opacity:0; }
  .mmth-row:hover .mmth-rowacts { opacity:1; }
  .mmth-ra { cursor:pointer; border:none; background:none; color:#7d8a82; font-size:11px; line-height:1; padding:1px 2px; border-radius:3px; }
  .mmth-ra:hover { background:#cfe9d8; color:#1f5c3d; }
  .mmth-empty { padding:12px 8px; color:#9aa6a0; font-style:italic; text-align:center; }
  .mmth-ft { display:flex; align-items:center; gap:2px; padding:3px 5px; border-top:1px solid #e7eee9; background:#f1f6f3; }
  .mmth-fb { cursor:pointer; border:none; background:none; font-size:13px; line-height:1; padding:3px 6px; border-radius:5px; color:#566; }
  .mmth-fb:hover { background:#dcefe2; }
  .mmth-fb.on { background:#cfe9d8; color:#1f5c3d; }
  .mmth-fb.mmth-spacer { flex:1; pointer-events:none; }
  .mmth-setpop { position:fixed; z-index:99999; background:#fff; border:1px solid #c7d3cc; border-radius:8px; box-shadow:0 8px 26px rgba(20,50,35,.2);
                 padding:10px 12px; font:13px/1.4 -apple-system,Segoe UI,Arial,sans-serif; color:#222; width:230px; }
  .mmth-setpop label { display:flex; align-items:center; gap:6px; margin:5px 0; cursor:pointer; }
  .mmth-setpop input[type="number"] { width:46px; border:1px solid #d7e0db; border-radius:4px; padding:1px 4px; }
  .mmth-toast { position:fixed; z-index:100000; background:#2c3a33; color:#fff; padding:6px 12px; border-radius:6px; font:13px sans-serif; box-shadow:0 4px 14px rgba(0,0,0,.25); left:50%; top:14px; transform:translateX(-50%); }
  `;
  (function () { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); })();

  function toast(msg) { const t = document.createElement('div'); t.className = 'mmth-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 1500); }

  // ── settings popover ─────────────────────────────────────────────────────────
  let setPop = null;
  function closeSet() { if (setPop) { setPop.remove(); setPop = null; document.removeEventListener('mousedown', onSetDown, true); } }
  function onSetDown(e) { if (setPop && !setPop.contains(e.target) && !e.target.closest('.mmth-fb-set')) closeSet(); }
  function openSet(anchor) {
    closeSet();
    const p = document.createElement('div'); p.className = 'mmth-setpop';
    p.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">Mammoth settings</div>
      <label><input type="checkbox" class="mmth-s-help"> Hide edit-note help text</label>
      <label>History size <input type="number" class="mmth-s-hist" min="1" max="50"></label>`;
    document.body.appendChild(p); setPop = p;
    const help = p.querySelector('.mmth-s-help'); help.checked = !!SET.hideHelp;
    const hist = p.querySelector('.mmth-s-hist'); hist.value = SET.historySize;
    help.onchange = () => { SET.hideHelp = help.checked; saveSet(); };
    hist.onchange = () => { SET.historySize = Math.max(1, Math.min(50, parseInt(hist.value, 10) || 10)); hist.value = SET.historySize; saveSet(); recordHistory(''); };
    const r = anchor.getBoundingClientRect();
    p.style.top = Math.max(6, r.top - p.offsetHeight - 6) + 'px';
    p.style.left = Math.max(6, Math.min(window.innerWidth - p.offsetWidth - 6, r.left - 100)) + 'px';
    setTimeout(() => document.addEventListener('mousedown', onSetDown, true), 0);
  }

  // ── sidebars (one per edit-note textarea) ────────────────────────────────────
  const instances = [];   // { ta, listEl, view, render }
  function applyHelp() { document.querySelectorAll('.editnote').forEach(en => en.classList.toggle('mmth-hidehelp', !!SET.hideHelp)); }

  function buildSide(ta) {
    const side = document.createElement('div'); side.className = 'mmth-side';
    const hd = document.createElement('div'); hd.className = 'mmth-side-hd'; hd.textContent = 'Saved notes';
    const list = document.createElement('div'); list.className = 'mmth-list';
    const ft = document.createElement('div'); ft.className = 'mmth-ft';
    side.appendChild(hd); side.appendChild(list); side.appendChild(ft);

    const inst = { ta, list, hd, view: 'saved', cyc: -1 };
    instances.push(inst);

    const fb = (glyph, title, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-fb' + (cls ? ' ' + cls : ''); b.textContent = glyph; b.title = title; b.onclick = fn; return b; };
    const bAdd  = fb('＋', 'Save current edit note', '', () => { const v = (ta.value || '').trim(); if (!v) return toast('Edit note is empty'); toast(addSaved(v) ? 'Saved' : 'Already saved'); });
    const bSaved = fb('📌', 'Saved notes', '', () => { inst.view = 'saved'; renderInst(inst); });
    const bHist = fb('🕘', 'History (last used)', '', () => { inst.view = 'history'; renderInst(inst); });
    const bSet  = fb('⚙', 'Settings', 'mmth-fb-set', () => openSet(bSet));
    bSet.classList.add('mmth-fb-set');
    ft.appendChild(bAdd); ft.appendChild(bSaved); ft.appendChild(bHist);
    const sp = document.createElement('span'); sp.className = 'mmth-fb mmth-spacer'; ft.appendChild(sp);
    ft.appendChild(bSet);
    inst.tabs = { saved: bSaved, history: bHist };

    // Ctrl/⌘ + ↑/↓ cycles saved notes, replacing the field
    ta.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const items = orderedSaved(); if (!items.length) return;
      e.preventDefault();
      inst.cyc = (inst.cyc + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      setValue(ta, items[inst.cyc].text);
      if (inst.view === 'saved') renderInst(inst);
    });

    renderInst(inst);
    return side;
  }

  function renderInst(inst) {
    const { ta, list, hd } = inst;
    list.innerHTML = '';
    hd.textContent = inst.view === 'saved' ? 'Saved notes' : 'Recent (last used)';
    if (inst.tabs) { inst.tabs.saved.classList.toggle('on', inst.view === 'saved'); inst.tabs.history.classList.toggle('on', inst.view === 'history'); }

    const items = inst.view === 'saved' ? orderedSaved() : DATA.history;
    if (!items.length) { const e = document.createElement('div'); e.className = 'mmth-empty'; e.textContent = inst.view === 'saved' ? 'No saved notes — ＋ saves the current one' : 'No history yet'; list.appendChild(e); return; }

    items.forEach((it, idx) => {
      const row = document.createElement('div'); row.className = 'mmth-row';
      if (inst.view === 'saved' && idx === inst.cyc) row.classList.add('mmth-cyc');
      row.title = it.text + '\n\n(click: append · right-click: replace)';

      if (inst.view === 'saved') {
        const star = document.createElement('span'); star.className = 'mmth-star' + (it.fav ? ' on' : ''); star.textContent = '★'; star.title = it.fav ? 'Unfavourite' : 'Favourite (sorts to top)';
        star.onclick = e => { e.stopPropagation(); toggleFav(it.id); };
        row.appendChild(star);
      }
      const txt = document.createElement('span'); txt.className = 'mmth-txt'; txt.textContent = it.text.replace(/\s+/g, ' ').trim();
      row.appendChild(txt);

      const acts = document.createElement('div'); acts.className = 'mmth-rowacts';
      const ra = (glyph, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mmth-ra'; b.textContent = glyph; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); }; acts.appendChild(b); };
      if (inst.view === 'saved') {
        ra('↑', 'Move up', () => moveSaved(it.id, -1));
        ra('↓', 'Move down', () => moveSaved(it.id, 1));
        ra('🗑', 'Delete', () => removeSaved(it.id));
      } else {
        ra('★', 'Save (pin to Saved)', () => { if (addSaved(it.text)) toast('Saved'); });
        ra('🗑', 'Remove', () => removeHistory(it.text));
      }
      row.appendChild(acts);

      row.onclick = () => applyNote(ta, it.text, false);
      row.oncontextmenu = e => { e.preventDefault(); applyNote(ta, it.text, true); };
      list.appendChild(row);
    });
  }

  // re-render every live sidebar (called after any data/setting change)
  function render() { instances.forEach(i => { if (i.list.isConnected) renderInst(i); }); }

  // ── attach ───────────────────────────────────────────────────────────────────
  function injectAll() {
    applyHelp();
    document.querySelectorAll('textarea.edit-note').forEach(ta => {
      if (ta.dataset.mmth) return;
      ta.dataset.mmth = '1';
      const wrap = document.createElement('div'); wrap.className = 'mmth-wrap';
      ta.parentNode.insertBefore(wrap, ta);
      wrap.appendChild(ta);
      wrap.appendChild(buildSide(ta));
    });
  }
  new MutationObserver(() => injectAll()).observe(document.documentElement, { childList: true, subtree: true });
  injectAll();
})();
