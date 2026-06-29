// ==UserScript==
// @name         External Editor
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.6.29
// @description  Edit text fields in your real editor (VS Code, Vim, Notepad…) on a hotkey. Press it in a field and its text opens in your editor; save the file and the field updates. Link many fields at once and bounce between them — each stays connected (re-press to refocus its file), with no time limit. Standalone — needs the bundled `extedit` localhost helper. Cross-browser via GM_xmlhttpRequest.
// @author       majkinetor
// @match        *://*.musicbrainz.org/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-end
// @noframes
// ==/UserScript==

/* eslint-disable no-undef */
(function () {
  'use strict';

  // ── settings (GM-persisted) ───────────────────────────────────────────────
  const DEF = { port: 17999, token: 'extedit', hotkey: { ctrl: true, alt: true, shift: false, meta: false, key: 'e' } };
  const cfg = {
    get port()   { return GM_getValue('ee_port', DEF.port); },
    get token()  { return GM_getValue('ee_token', DEF.token); },
    get hotkey() { try { return JSON.parse(GM_getValue('ee_hotkey', '')) || DEF.hotkey; } catch (e) { return DEF.hotkey; } },
  };
  const base = () => `http://127.0.0.1:${cfg.port}`;
  const hotkeyLabel = h => [h.ctrl && 'Ctrl', h.alt && 'Alt', h.shift && 'Shift', h.meta && 'Meta', (h.key || '').toUpperCase()].filter(Boolean).join('+');

  // ── tiny GM request helpers (no CORS / mixed-content wall) ────────────────
  const gm = opts => new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: opts.method || 'GET', url: opts.url, data: opts.data, timeout: opts.timeout || 30000,
      headers: Object.assign({ 'X-ExtEdit-Token': cfg.token }, opts.headers || {}),
      onload: r => resolve(r), onerror: () => reject(new Error('network')), ontimeout: () => reject(new Error('timeout')),
    });
  });
  const ping = async () => { try { const r = await gm({ url: base() + '/ping', timeout: 4000 }); return r.status === 200; } catch (e) { return false; } };

  // ── toast ─────────────────────────────────────────────────────────────────
  let toastEl = null, toastT = 0;
  function toast(msg, kind, sticky) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:14px;transform:translateX(-50%);background:#2c3a33;color:#fff;padding:7px 13px;border-radius:7px;font:13px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:70vw;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.background = kind === 'err' ? '#b3352e' : kind === 'ok' ? '#2e7d44' : '#2c3a33';
    toastEl.style.display = '';
    clearTimeout(toastT);
    if (!sticky) toastT = setTimeout(() => { if (toastEl) toastEl.style.display = 'none'; }, 2600);
  }
  const hideToast = () => { if (toastEl) toastEl.style.display = 'none'; };

  // ── editable field read/write ─────────────────────────────────────────────
  function editableOf(el) {
    if (!el) return null;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return { el, kind: 'value' };
    if (tag === 'INPUT' && /^(text|search|url|email|tel|number|)$/i.test(el.type || 'text')) return { el, kind: 'value' };
    if (el.isContentEditable) return { el, kind: 'ce' };
    return null;
  }
  const readVal = t => t.kind === 'ce' ? t.el.innerText : t.el.value;
  function writeVal(t, text) {
    // editors usually append a trailing newline on save — drop one so single-line
    // inputs aren't left with a stray blank line.
    text = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
    if (t.kind === 'ce') {
      t.el.innerText = text;
      t.el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return;
    }
    // use the native setter so frameworks (React/Knockout) notice the change
    const proto = t.el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    set.call(t.el, text);
    t.el.dispatchEvent(new Event('input', { bubbles: true }));
    t.el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // edit notes / annotations read nicer as markdown in the editor
  const extFor = el => (el.classList && (el.classList.contains('edit-note') || /annotation/i.test(el.name || el.id || ''))) ? 'md' : 'txt';

  // ── per-field sessions (many fields linked at once) ───────────────────────
  // Each editable field gets its OWN session + temp file and stays "linked" until
  // you disconnect it (Esc in the field, the panel ✕, or page unload). So you can
  // bounce between fields freely: hotkey field 1 → edit+save → back to the browser →
  // hotkey field 2 → … → hotkey field 1 again (re-opens the SAME temp file, the
  // editor just refocuses it). Saving a linked file pushes the text back any number
  // of times — there's no time limit on how long you spend in the editor.
  const sessions = new Map();   // field el → session
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function fieldLabel(el) {
    let lbl = '';
    if (el.id) { try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) lbl = l.textContent; } catch (e) {} }
    lbl = (lbl || el.getAttribute('aria-label') || el.placeholder || el.name || el.id || el.tagName.toLowerCase()).replace(/\s+/g, ' ').trim();
    return lbl.slice(0, 32) || 'field';
  }

  function onHotkeyField(t) {
    const s = sessions.get(t.el);
    if (s && s.connected) reopen(s); else connect(t);
  }

  async function connect(t) {
    if (!(await ping())) { toast(`extedit helper not reachable on ${base()} — start it (see README)`, 'err'); return; }
    const id = genId();
    const s = { id, el: t.el, t, connected: true, label: fieldLabel(t.el) };
    sessions.set(t.el, s);
    setLinked(t.el, true); renderPanel();
    try {
      const open = await gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ id, content: readVal(t), ext: extFor(t.el) }) });
      if (open.status !== 200) { toast(`Open failed (HTTP ${open.status})`, 'err'); disconnect(t.el, true); return; }
    } catch (e) { toast('Open error: ' + e.message, 'err'); disconnect(t.el, true); return; }
    toast(`“${s.label}” opened in your editor — save to apply (stays linked; Esc to disconnect)`, 'ok');
    poll(s);
  }

  async function reopen(s) {
    try {
      const r = await gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ id: s.id, reopen: true }) });
      if (r.status === 200) toast(`Re-opened “${s.label}” — switch to your editor`, 'ok');
      else if (r.status === 404 || r.status === 410) { disconnect(s.el, true); connect(s.t); }   // helper restarted — relink
      else toast(`Re-open failed (HTTP ${r.status})`, 'err');
    } catch (e) { toast('Re-open error: ' + e.message, 'err'); }
  }

  async function poll(s) {
    // one long-poll loop per field; runs until the field is disconnected
    while (s.connected) {
      let r;
      try { r = await gm({ url: `${base()}/result?id=${encodeURIComponent(s.id)}`, timeout: 660000 }); }
      catch (e) { if (!s.connected) break; await sleep(1200); continue; }   // timeout / network blip → re-poll
      if (!s.connected) break;
      if (r.status === 204) continue;                                       // still editing
      if (r.status === 404 || r.status === 410) { toast(`“${s.label}” session ended`); disconnect(s.el, true); break; }
      if (r.status !== 200) { await sleep(1200); continue; }
      try { const out = JSON.parse(r.responseText); writeVal(s.t, out.content || ''); flashLinked(s.el); toast(`“${s.label}” updated ✓`, 'ok'); } catch (e) {}
    }
  }

  function disconnect(el, fromServer) {
    const s = sessions.get(el); if (!s) return;
    s.connected = false;
    sessions.delete(el);
    setLinked(el, false); renderPanel();
    if (!fromServer) { gm({ url: `${base()}/close?id=${encodeURIComponent(s.id)}` }).catch(() => {}); toast(`“${s.label}” disconnected`); }
  }
  const disconnectAll = () => { for (const el of [...sessions.keys()]) disconnect(el, false); };
  const sleep = ms => new Promise(z => setTimeout(z, ms));

  // ── "linked" indicator: a glow on the field + a small panel of live links ──
  const _prevShadow = new WeakMap();
  function setLinked(el, on) {
    if (on) { if (!_prevShadow.has(el)) _prevShadow.set(el, el.style.boxShadow || ''); el.style.boxShadow = '0 0 0 2px #2e9e5b'; }
    else { el.style.boxShadow = _prevShadow.get(el) || ''; _prevShadow.delete(el); }
  }
  function flashLinked(el) { el.style.boxShadow = '0 0 0 3px #57d07e'; setTimeout(() => { if (sessions.has(el)) el.style.boxShadow = '0 0 0 2px #2e9e5b'; }, 380); }

  let panel = null;
  const _btn = 'background:#3d5147;color:#fff;border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:12px;line-height:1.4;';
  function renderPanel() {
    if (!sessions.size) { if (panel) panel.style.display = 'none'; return; }
    if (!panel) {
      panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;z-index:2147483646;right:12px;bottom:12px;background:#2c3a33;color:#fff;border-radius:8px;padding:7px 9px;font:12px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:300px;';
      document.body.appendChild(panel);
    }
    panel.style.display = ''; panel.textContent = '';
    const head = document.createElement('div');
    head.textContent = `✎ External Editor — ${sessions.size} linked`;
    head.style.cssText = 'font-weight:600;margin-bottom:5px;opacity:.85;'; panel.appendChild(head);
    for (const s of sessions.values()) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
      const dot = document.createElement('span'); dot.textContent = '●'; dot.style.color = '#57d07e'; row.appendChild(dot);
      const name = document.createElement('span');
      name.textContent = s.label; name.title = 'Scroll to this field';
      name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
      name.onclick = () => { try { s.el.scrollIntoView({ block: 'center' }); s.el.focus(); } catch (e) {} };
      row.appendChild(name);
      const rf = document.createElement('button'); rf.textContent = '⟳'; rf.title = 'Re-open in your editor'; rf.style.cssText = _btn; rf.onclick = () => reopen(s); row.appendChild(rf);
      const x = document.createElement('button'); x.textContent = '✕'; x.title = 'Disconnect'; x.style.cssText = _btn; x.onclick = () => disconnect(s.el, false); row.appendChild(x);
      panel.appendChild(row);
    }
  }

  // best-effort: drop our sessions when the page goes away (helper also self-expires)
  window.addEventListener('pagehide', () => { for (const s of sessions.values()) gm({ url: `${base()}/close?id=${encodeURIComponent(s.id)}` }).catch(() => {}); });

  // ── hotkey ──────────────────────────────────────────────────────────────────
  let capturing = false;
  document.addEventListener('keydown', e => {
    if (capturing) return;   // the "set hotkey" capture handles its own keys
    // Esc in a linked field disconnects it
    if (e.key === 'Escape') { const te = editableOf(document.activeElement); if (te && sessions.has(te.el)) { e.preventDefault(); disconnect(te.el, false); } return; }
    const h = cfg.hotkey;
    if (e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift || e.metaKey !== !!h.meta) return;
    if ((e.key || '').toLowerCase() !== (h.key || '').toLowerCase()) return;
    const t = editableOf(document.activeElement);
    if (!t) return;          // not in an editable field — let the key through
    e.preventDefault(); e.stopPropagation();
    onHotkeyField(t);
  }, true);

  // ── menu commands (config) ───────────────────────────────────────────────
  GM_registerMenuCommand(`Set port (now: ${cfg.port})`, () => {
    const v = prompt('External Editor — helper port', String(cfg.port));
    if (v && /^\d+$/.test(v)) { GM_setValue('ee_port', +v); toast('Port set to ' + v, 'ok'); }
  });
  GM_registerMenuCommand('Set token', () => {
    const v = prompt('External Editor — shared token (must match the helper\'s --token)', cfg.token);
    if (v != null) { GM_setValue('ee_token', v); toast('Token saved', 'ok'); }
  });
  GM_registerMenuCommand(`Set hotkey (now: ${hotkeyLabel(cfg.hotkey)})`, () => {
    capturing = true;
    toast('Press the new hotkey combo…', '', true);
    const cap = e => {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;   // wait for a real key
      e.preventDefault(); e.stopPropagation();
      const h = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, key: e.key.toLowerCase() };
      GM_setValue('ee_hotkey', JSON.stringify(h));
      document.removeEventListener('keydown', cap, true); capturing = false;
      toast('Hotkey set to ' + hotkeyLabel(h), 'ok');
    };
    document.addEventListener('keydown', cap, true);
  });
  GM_registerMenuCommand('Test helper connection', async () => toast(await ping() ? `Helper OK on ${base()} ✓` : `Helper not reachable on ${base()}`, (await ping()) ? 'ok' : 'err'));
  GM_registerMenuCommand('Disconnect all external edits', () => { if (sessions.size) disconnectAll(); else toast('No fields are linked'); });

  console.log(`[External Editor] ready — hotkey ${hotkeyLabel(cfg.hotkey)} in a focused text field; helper ${base()}`);
})();
