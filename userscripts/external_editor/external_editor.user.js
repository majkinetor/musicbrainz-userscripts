// ==UserScript==
// @name         External Editor
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.6.29
// @description  Edit the focused text field in your real editor (VS Code, Vim, Notepad…) on a hotkey. Press it, the field's text opens in your editor; save the file and the field updates. Standalone — needs the bundled `extedit` localhost helper. Cross-browser via GM_xmlhttpRequest.
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

  // ── the round trip ─────────────────────────────────────────────────────────
  let active = null;   // { id, cancelled }
  async function editInExternal(t) {
    if (active) { toast('An external edit is already in progress', 'err'); return; }
    if (!(await ping())) { toast(`extedit helper not reachable on ${base()} — start it (see README)`, 'err'); return; }
    const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    const session = active = { id, cancelled: false };
    try {
      const open = await gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ id, content: readVal(t), ext: extFor(t.el) }) });
      if (open.status !== 200) { toast(`Open failed (HTTP ${open.status})`, 'err'); return; }
      toast('Opened in your editor — save the file to apply (Esc to cancel)', '', true);
      // long-poll until saved (helper holds ~25s, then 204 → we re-poll)
      while (!session.cancelled) {
        let r;
        try { r = await gm({ url: `${base()}/result?id=${encodeURIComponent(id)}`, timeout: 30000 }); }
        catch (e) { if (e.message === 'timeout') continue; throw e; }
        if (session.cancelled) break;
        if (r.status === 204) continue;          // no change yet
        if (r.status !== 200) { toast(`Result failed (HTTP ${r.status})`, 'err'); return; }
        const out = JSON.parse(r.responseText);
        writeVal(t, out.content || '');
        toast('Field updated from your editor ✓', 'ok');
        return;
      }
      hideToast();
    } catch (e) {
      toast('External edit error: ' + e.message, 'err');
    } finally {
      if (active === session) active = null;
    }
  }

  // ── hotkey ──────────────────────────────────────────────────────────────────
  let capturing = false;
  document.addEventListener('keydown', e => {
    if (capturing) return;   // the "set hotkey" capture handles its own keys
    if (active && e.key === 'Escape') { active.cancelled = true; toast('External edit cancelled'); return; }
    const h = cfg.hotkey;
    if (e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift || e.metaKey !== !!h.meta) return;
    if ((e.key || '').toLowerCase() !== (h.key || '').toLowerCase()) return;
    const t = editableOf(document.activeElement);
    if (!t) return;          // not in an editable field — let the key through
    e.preventDefault(); e.stopPropagation();
    editInExternal(t);
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

  console.log(`[External Editor] ready — hotkey ${hotkeyLabel(cfg.hotkey)} in a focused text field; helper ${base()}`);
})();
