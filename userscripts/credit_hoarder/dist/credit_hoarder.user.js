// ==UserScript==
// @name         Credit Hoarder
// @namespace    majkinetor
// @version      2026.10.30.132125
// @description  Import per-track release credits from streaming/database providers (Discogs, Tidal, Qobuz, Deezer) into MusicBrainz relationships, with a review phase
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xNS41IC0xLjUgMTM2LjUgMTM2LjUiIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij4KPHRpdGxlPkNyZWRpdCBIb2FyZGVyPC90aXRsZT4KPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJjaGMwNC1nIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZjlhODI2Ii8+PHN0b3Agb2Zmc2V0PSIuNSIgc3RvcC1jb2xvcj0iI2YzNzIyYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2QwMDA3MCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxnIG9wYWNpdHk9Ii43Ij48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2NiA3MCkgcm90YXRlKDApIHNjYWxlKDEuNTUpIHRyYW5zbGF0ZSgtNjYgLTcwKSI+PGcgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEuOTM1NDgzODcwOTY3NzQxOCI+PGVsbGlwc2UgY3g9IjMwIiBjeT0iODAiIHJ4PSIxNCIgcnk9IjEwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3NiIgcj0iOCIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iNzAiIHI9IjEwIi8+PC9nPjxnIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI1LjE2MTI5MDMyMjU4MDY0NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMjYgODYgbC02IDEyIE0zNCA4OCBsMiAxMiBNNDYgODIgbC00IDE2IE01MiA4NCBsOCAxNCIvPjwvZz48L2c+PGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjYuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNzIgNjIgQzc4IDUyIDg2IDQ4IDkyIDQ4IE03MCA2MiBDNzIgNTIgNzAgNDQgNjQgNDAiLz48L2c+PHBhdGggZD0iTTExMy42IDQ1LjAgTDk4LjAgNTQuMCBMODIuNCA0NS4wIEw4Mi40IDI3LjAgTDk4LjAgMTguMCBMMTEzLjYgMjcuMFoiIGZpbGw9IiNmZmYiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTAgOTggMzYpIi8+PC9nPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDY2IDcwKSByb3RhdGUoMCkgc2NhbGUoMS41NSkgdHJhbnNsYXRlKC02NiAtNzApIj48ZyBmaWxsPSIjMjIyMjNiIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMCI+PGVsbGlwc2UgY3g9IjMwIiBjeT0iODAiIHJ4PSIxNCIgcnk9IjEwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3NiIgcj0iOCIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iNzAiIHI9IjEwIi8+PC9nPjxnIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSIzLjIyNTgwNjQ1MTYxMjkwMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMjYgODYgbC02IDEyIE0zNCA4OCBsMiAxMiBNNDYgODIgbC00IDE2IE01MiA4NCBsOCAxNCIvPjwvZz48L2c+PGcgc3Ryb2tlPSIjMjIyMjNiIiBzdHJva2Utd2lkdGg9IjMuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNzIgNjIgQzc4IDUyIDg2IDQ4IDkyIDQ4IE03MCA2MiBDNzIgNTIgNzAgNDQgNjQgNDAiLz48L2c+PHBhdGggZD0iTTExMy42IDQ1LjAgTDk4LjAgNTQuMCBMODIuNCA0NS4wIEw4Mi40IDI3LjAgTDk4LjAgMTguMCBMMTEzLjYgMjcuMFoiIGZpbGw9InVybCgjY2hjMDQtZykiIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTAgOTggMzYpIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOTggMzcpIHNjYWxlKDAuOSkiIGZpbGw9IiNmZmYiPjxjaXJjbGUgY3g9IjAiIGN5PSItNSIgcj0iNSIvPjxwYXRoIGQ9Ik0tOSA5IEMtOSAwIDkgMCA5IDlaIi8+PC9nPgo8L3N2Zz4K
// @match        https://*.musicbrainz.org/release/*
// @match        https://*.musicbrainz.org/release/*/edit-relationships
// @match        https://*.musicbrainz.org/artist/*
// @match        https://*.musicbrainz.org/label/*
// @match        https://*.musicbrainz.org/place/*
// @match        https://tidal.com/album/*
// @match        https://listen.tidal.com/album/*
// @match        https://www.metal-archives.com/albums/*
// @license      MIT
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md
// @supportURL   https://github.com/majkinetor/musicbrainz-userscripts/issues
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      qobuz.com
// @connect      www.qobuz.com
// @connect      deezer.com
// @connect      www.deezer.com
// @connect      mora.jp
// @connect      cf.mora.jp
// @connect      www.melon.com
// @connect      m2.melon.com
// @connect      tivomusicapi-staging-elb.digitalsmiths.net
// @connect      music.apple.com
// @connect      amp-api.music.apple.com
// @connect      www.metal-archives.com
// @connect      music.youtube.com
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==

(() => {
// one copy per page: with String Theory and a standalone install both on, the newer one runs (#653)
function mbuClaimVer(v) {
    return String(v || '').split('.').map(function (n) { return parseInt(n, 10) || 0; });
}
function mbuClaimCmp(a, b) {
    var x = mbuClaimVer(a), y = mbuClaimVer(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}
function mbuClaim(key, label) {
    var info = (typeof GM_info !== 'undefined' && GM_info && GM_info.script) || {};
    var name = String(info.name || label || key), ver = String(info.version || '0');
    var mine = (name.slice(-1) === '*' ? 'String Theory' : 'standalone') + ' v' + ver;
    var root = document.documentElement, attr = 'data-mbu-run-' + key, ev = 'mbu-claim-' + key, noteKey = 'mbu-newer-' + key;
    var log = function (msg) { try { if (typeof mbuLog !== 'undefined' && mbuLog.active) mbuLog.active.info(msg); else if (typeof mbuToast !== 'undefined' && typeof mbuToast.log === 'function') mbuToast.log('info', msg); else console.info('[' + (label || key) + '] ' + msg); } catch (e) { /* no log */ } };
    var note = null;
    try { note = JSON.parse(localStorage.getItem(noteKey) || 'null'); } catch (e) { /* storage blocked */ }
    // A note older than this copy is spent. This copy's own note stays: it is what keeps the
    // older copy aside on every later load, not only the next one (#671).
    var noteCmp = note ? mbuClaimCmp(note.ver, ver) : 1;
    if (noteCmp < 0) { try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ } }
    if (noteCmp <= 0) note = null;
    var held = root && root.getAttribute(attr);
    var off = function (why) {
        // tell the running copy (any sandbox hears a DOM event), or the copy that runs after
        // this one (it reads the attribute), and stay quiet
        try { if (root) root.setAttribute(attr + '-off', JSON.stringify({ mine: mine, why: why })); } catch (e) { /* no attribute */ }
        try { document.dispatchEvent(new CustomEvent(ev, { detail: JSON.stringify({ mine: mine, ver: ver, why: why }) })); } catch (e) { /* no event */ }
        return false;
    };
    if (held) {
        var heldVer = (root.getAttribute(attr + '-ver') || '0');
        if (mbuClaimCmp(ver, heldVer) > 0) {
            try { localStorage.setItem(noteKey, JSON.stringify({ ver: ver, mine: mine, at: Date.now() })); } catch (e) { /* storage blocked */ }
            return off('newer, from the next page load');
        }
        return off('older or the same');
    }
    if (note) {
        // a newer copy said it is installed: leave the page to it, unless it never shows up
        var watch = function () {
            setTimeout(function () {
                if (root.getAttribute(attr)) return;
                try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ }
                try { console.info('[' + (label || key) + '] the newer copy (' + note.mine + ') did not start: this copy runs again from the next page load'); } catch (e) { /* no console */ }
            }, 3000);
        };
        if (document.readyState === 'complete') watch(); else window.addEventListener('load', watch, { once: true });
        return off('older: a newer copy runs');
    }
    if (root) { root.setAttribute(attr, mine); root.setAttribute(attr + '-ver', ver); }
    var told = function (o) {
        log((label || key) + ' is installed twice: ' + mine + ' runs, ' + (o.mine || 'another copy') + ' is switched off'
            + (o.why === 'newer, from the next page load' ? ' for this page (it is newer and runs from the next page load)' : '') + '.');
    };
    document.addEventListener(ev, function (e) { var o = {}; try { o = JSON.parse(e.detail); } catch (x) { /* not ours */ } told(o); });
    // a copy that stepped aside before this one started (it found a note): log it once the script's log is up
    var before = root && root.getAttribute(attr + '-off');
    if (before) setTimeout(function () { var o = {}; try { o = JSON.parse(before); } catch (x) { /* not ours */ } told(o); }, 0);
    return true;
}
if (!mbuClaim('credit_hoarder', 'Credit Hoarder')) return;
  // src/constants.js
  var REL_TEMPLATE = {
    _lineage: [],
    _original: null,
    _status: 1,
    attributes: null,
    begin_date: null,
    editsPending: false,
    end_date: null,
    ended: false,
    entity0_credit: "",
    entity1_credit: "",
    id: null,
    linkOrder: 0,
    linkTypeID: null
  };
  var SELECTORS = {
    MediumsInput: ".multiselect-input",
    MediumsInputOptions: ".multiselect-input + .menu a",
    InstrumentsInput: "#add-relationship-dialog .multiselect.instrument input[aria-autocomplete]",
    VocalsTypeInput: "#add-relationship-dialog .multiselect.vocal input[aria-autocomplete]",
    AddRelationshipsDialogEntityType: "#add-relationship-dialog .entity-type",
    AddRelationshipsDialogRelationshipType: "#add-relationship-dialog input.relationship-type",
    AddRelationshipsDialogRelationshipTarget: "#add-relationship-dialog input.relationship-target",
    AddRelationshipsDialogEntityCredit: "#add-relationship-dialog input.entity-credit",
    AddRelationshipsDialogDoneButton: "#add-relationship-dialog .buttons button.positive",
    AddRelationshipsDialogError: "#add-relationship-dialog .error",
    AddRelationshipsDialogCancelButton: "#add-relationship-dialog .buttons button.negative",
    AddReleaseRelationshipButton: "#release-rels button.add-relationship",
    EditNote: "#edit-note-text",
    TaskInput: "#add-relationship-dialog .attribute-container.task input"
  };
  var EQUIVALENCE_SETS = [
    ["writer", "composer"]
  ];
  var MB = typeof location !== "undefined" && /(^|\.)musicbrainz\.org$/.test(location.hostname) ? "//" + location.hostname : "//musicbrainz.org";
  var DISCOGS_CHANNEL = new BroadcastChannel("discogs-importer-artist");
  DISCOGS_CHANNEL.unref?.();
  var pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : typeof window !== "undefined" ? window : globalThis;
  var MATCH_LEVELS = [
    { key: "exact", label: "Exact", color: "#2f6fd6", hint: "name and URL agree" },
    { key: "strong", label: "Strong", color: "#86c686", hint: "URL, or release context" },
    { key: "unique", label: "Unique name", color: "#fff176", hint: "the only MusicBrainz artist with the name" },
    { key: "weak", label: "Weak", color: "#ffb74d", hint: "co-credit, similar name" }
  ];

  // src/log.js
  var _logs = null;
  var _warn = 0;
  var _err = 0;
  var _countListener = null;
  function onLogCounts(fn) {
    _countListener = fn;
  }
  function resetLogCounts() {
    _warn = 0;
    _err = 0;
    _notifyCounts();
  }
  function _notifyCounts() {
    if (_countListener) {
      try {
        _countListener(_warn, _err);
      } catch (e) {
      }
    }
  }
  function setLogContainer(el) {
    _logs = el;
    const pending = _pending.splice(0, _pending.length);
    pending.forEach((a) => _emit(...a));
  }
  function getLogContainer() {
    return _logs;
  }
  var _review = null;
  function setReviewContainer(el) {
    _review = el;
  }
  function getReviewContainer() {
    return _review || _logs;
  }
  var _pending = [];
  var PENDING_MAX = 200;
  function _console(plainText, sev) {
    try {
      const line = "[credit_hoarder] " + String(plainText).replace(/<[^>]*>/g, "").trim();
      if (sev === "error") console.error(line);
      else if (sev === "warn") console.warn(line);
      else console.log(line);
    } catch (e) {
    }
  }
  function _emit(html, plainText, sev) {
    _console(plainText, sev);
    if (!_logs) {
      if (_pending.length < PENDING_MAX) _pending.push([html, plainText, sev]);
      return;
    }
    const li = document.createElement("li");
    if (sev) li.dataset.sev = sev;
    if (sev === "warn") {
      _warn++;
      _notifyCounts();
    } else if (sev === "error") {
      _err++;
      _notifyCounts();
    }
    const d = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    li.innerHTML = `<span style="color:var(--mbu-text-weak);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.82em;">${stamp}</span> ${html}`;
    _logs.insertAdjacentElement("beforeend", li);
    const bar = document.querySelector(".discogs-bar");
    if (bar?._setProgress) {
      bar._setProgress(null, plainText.replace(/<[^>]*>/g, "").trim().substring(0, 120));
    }
  }
  var log = {
    info: (msg) => _emit(msg, msg),
    warn: (msg) => _emit(`<span style="color:orange">WARN ${msg}</span>`, `WARN ${msg}`, "warn"),
    error: (msg) => _emit(`<span style="color:red">ERR ${msg}</span>`, `ERR ${msg}`, "error"),
    // Entity skipped because it wasn't matched on MB in the review (#118). Kept
    // OUT of the WARN tally — these are surfaced by the separate "N unresolved"
    // badge, and the maintainer asked not to lump them with real warnings. Still
    // rendered (muted amber) so the log shows exactly which roles were dropped.
    skip: (msg) => _emit(`<span style="color:var(--mbu-warn)">SKIP ${msg}</span>`, `SKIP ${msg}`, "skip")
  };
  var _debugUl = null;
  var _debugStartT = null;
  function _ensureDebugUl() {
    if (_debugUl) return _debugUl;
    if (!_logs) return null;
    const details = document.createElement("details");
    details.style.cssText = "margin:0.3rem 0;";
    const summary = document.createElement("summary");
    summary.textContent = "Preflight diagnostics";
    summary.style.cssText = "cursor:pointer;font-size:0.8rem;color:var(--mbu-text-weak);user-select:none;";
    details.appendChild(summary);
    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none;margin:0.3rem 0;padding:0.4rem 0.6rem;background:var(--mbu-bg-raised);border-radius:0.25rem;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.72rem;color:var(--mbu-text);max-height:24rem;overflow-y:auto;";
    details.appendChild(ul);
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.appendChild(details);
    _logs.appendChild(li);
    _debugUl = ul;
    _debugStartT = performance.now();
    return _debugUl;
  }
  function logDebug(line) {
    const ul = _ensureDebugUl();
    if (!ul) return;
    const t = Math.round(performance.now() - _debugStartT);
    const row = document.createElement("div");
    row.textContent = `[+${t}ms] ${line}`;
    ul.appendChild(row);
  }

  // ../../dev/net/mb-gate.mjs
  var MBN_GAP = 1e3;
  var MBN_BURST = 3;
  var MBN_KEY = "mbu:mb-gate";
  var MBN_LOCK = "mbu-mb-gate";
  var MBN_MAX_HOLD = 6e4;
  var MBN_MAX_LEAD = 1e4;
  function mbnGated(url) {
    const s = String(url || "");
    return /^\/ws\/2\//.test(s) || /^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org\/ws\/2\//i.test(s);
  }
  async function mbnState(fn) {
    const rw = () => {
      let s = null, stored = true;
      try {
        s = JSON.parse(localStorage.getItem(MBN_KEY) || "null");
      } catch (e) {
        stored = false;
      }
      const g = globalThis.__mbnGate || (globalThis.__mbnGate = { tat: 0, cool: 0, hot: 0 });
      if (!stored) s = g;
      else if (!s || typeof s !== "object") s = { tat: 0, cool: 0, hot: 0 };
      const out = fn(s);
      Object.assign(g, s);
      try {
        localStorage.setItem(MBN_KEY, JSON.stringify({ tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0, lead: s.lead || "", leadUntil: s.leadUntil || 0 }));
      } catch (e) {
      }
      return out;
    };
    let timer = 0;
    try {
      if (typeof navigator !== "undefined" && navigator.locks && navigator.locks.request) {
        const ctrl = typeof AbortController === "function" ? new AbortController() : null;
        if (ctrl) timer = setTimeout(() => ctrl.abort(), 3e3);
        return await navigator.locks.request(MBN_LOCK, ctrl ? { signal: ctrl.signal } : {}, rw);
      }
    } catch (e) {
    } finally {
      clearTimeout(timer);
    }
    return rw();
  }
  async function mbnSlot(o) {
    o = o || {};
    const t0 = Date.now(), background = o.background !== false;
    for (let told2 = false; background; ) {
      let s = null;
      try {
        s = JSON.parse(localStorage.getItem(MBN_KEY) || "null");
      } catch (e) {
        s = globalThis.__mbnGate;
      }
      const left = s && s.lead && s.lead !== o.lead ? Math.min((s.leadUntil || 0) - Date.now(), MBN_MAX_LEAD) : 0;
      if (left <= 0) break;
      if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
      if (!told2 && o.log) {
        told2 = true;
        o.log("info", "MusicBrainz gate: " + (o.label || "request") + " waits for a page being drawn");
      }
      await new Promise((r) => setTimeout(r, Math.min(left, 250)));
    }
    const booked = await mbnState((s) => {
      const now = Date.now(), cool = s.cool || 0, tat = s.tat || 0;
      let at = background ? Math.max(now, tat - (MBN_BURST - 1) * MBN_GAP) : now;
      at = Math.max(at, cool);
      s.tat = Math.max(tat, at) + MBN_GAP;
      return { at, why: cool > now && cool >= at ? "MusicBrainz asked everyone to wait" : "pacing, one request a second" };
    });
    let told = false;
    for (; ; ) {
      if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
      let cool = 0;
      try {
        cool = (JSON.parse(localStorage.getItem(MBN_KEY) || "null") || {}).cool || 0;
      } catch (e) {
        cool = (globalThis.__mbnGate || {}).cool || 0;
      }
      const until = Math.max(booked.at, cool), left = until - Date.now();
      if (left <= 0) break;
      if (!told && until - t0 > 1e3 && o.log) {
        told = true;
        o.log("info", "MusicBrainz gate: " + (o.label || "request") + " waits " + Math.round((until - t0) / 100) / 10 + "s (" + (cool > booked.at ? "MusicBrainz asked everyone to wait" : booked.why) + ")");
      }
      await new Promise((r) => setTimeout(r, Math.min(left, 250)));
    }
    return { ok: true, waited: Date.now() - t0 };
  }
  async function mbnAnswer(status, header, o) {
    o = o || {};
    if (status === 429 || status === 503) {
      const raw = header ? header("Retry-After") : null;
      const secs = Number(raw), date = raw ? Date.parse(raw) : NaN;
      const ra = Number.isFinite(secs) ? secs * 1e3 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
      const hold = await mbnState((s) => {
        const now = Date.now();
        if (now > (s.cool || 0) + 3e4) s.hot = 0;
        if (now >= (s.cool || 0)) s.hot = Math.min((s.hot || 0) + 1, 6);
        const ms = Math.min(Math.max(1e3, ra) * Math.max(1, s.hot), MBN_MAX_HOLD);
        s.cool = Math.max(s.cool || 0, Date.now() + ms);
        return s.cool - Date.now();
      });
      if (o.log) o.log("warn", "MusicBrainz gate: HTTP " + status + (raw != null ? " (Retry-After: " + raw + ")" : "") + " \u2014 every script holds " + Math.round(hold / 100) / 10 + "s");
      return { throttled: true, hold };
    }
    if (status >= 200 && status < 500) await mbnState((s) => {
      if (s.hot) s.hot = Date.now() > (s.cool || 0) + 3e4 ? 0 : s.hot - 1;
    });
    return { throttled: false, hold: 0 };
  }
  async function mbnFetch(url, init, o) {
    o = o || {};
    if (!mbnGated(url)) {
      const r = await fetch(url, init);
      if (!mbnWebsite(url) || !await mbnIsCheck(r)) return r;
      return await mbnReverify(url, init, o) ? fetch(url, init) : r;
    }
    const tries = o.tries || 4;
    for (let attempt = 1; ; attempt++) {
      const slot = await mbnSlot(o);
      if (!slot.ok) return null;
      const r = await fetch(url, init);
      const a = await mbnAnswer(r.status, (n) => r.headers.get(n), o);
      if (!a.throttled || attempt >= tries) return r;
    }
  }
  function mbnWebsite(url) {
    const s = String(url || "");
    if (mbnGated(s)) return false;
    if (/^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org(\/|$)/i.test(s)) return true;
    return /^\/(?!\/)/.test(s) && typeof location !== "undefined" && /(^|\.)musicbrainz\.org$/i.test(location.hostname);
  }
  async function mbnIsCheck(r) {
    try {
      if (!r || !/text\/html/i.test(r.headers && r.headers.get("content-type") || "")) return false;
      const head = (await r.clone().text()).slice(0, 3e3);
      return /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(head);
    } catch (e) {
      return false;
    }
  }
  function mbnReverify(url, init, o) {
    o = o || {};
    const log2 = (lvl, m) => {
      try {
        if (o.log) o.log(lvl, m);
        else (lvl === "warn" ? console.warn : console.info)("[MusicBrainz gate] " + m);
      } catch (e) {
      }
    };
    const g = globalThis.__mbnCheck || (globalThis.__mbnCheck = { busy: null, failedAt: 0 });
    if (g.busy) return g.busy;
    let target;
    try {
      target = new URL(String(url), location.href);
    } catch (e) {
      return Promise.resolve(false);
    }
    if (target.host !== location.host || typeof document === "undefined") {
      log2("warn", "MusicBrainz asked to verify the browser \u2014 open any MusicBrainz page, then retry");
      return Promise.resolve(false);
    }
    if (Date.now() - g.failedAt < 6e4) return Promise.resolve(false);
    const method = String(init && init.method || "GET").toUpperCase();
    const src = method === "GET" ? target.href : location.origin + "/ws/js/entity/89ad4ac3-39f7-470e-963a-56509c546377";
    const t0 = Date.now();
    log2("warn", 'MusicBrainz asked to verify the browser again ("Verifying your browser") \u2014 passing it in a hidden frame');
    g.busy = new Promise((resolve) => {
      const fr = document.createElement("iframe");
      fr.setAttribute("aria-hidden", "true");
      fr.setAttribute("data-mbn-check", "");
      fr.tabIndex = -1;
      fr.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;pointer-events:none";
      let loads = 0, done = false, timer = 0;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fr.remove();
        g.busy = null;
        if (ok) log2("info", "browser check passed in " + (Date.now() - t0) + " ms \u2014 retrying");
        else {
          g.failedAt = Date.now();
          const m = "MusicBrainz wants to verify your browser \u2014 open any MusicBrainz page in another tab, then retry";
          log2("warn", m + " (the hidden frame did not clear it in 20 s)");
          try {
            if (o.notify) o.notify(m);
          } catch (e) {
          }
        }
        resolve(ok);
      };
      fr.onload = () => {
        loads++;
        let still;
        try {
          const d = fr.contentDocument;
          still = !d || /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(d.documentElement ? d.documentElement.outerHTML.slice(0, 3e3) : "");
        } catch (e) {
          still = loads < 2;
        }
        if (!still) finish(true);
      };
      timer = setTimeout(() => finish(false), 2e4);
      fr.src = src;
      (document.body || document.documentElement).appendChild(fr);
    });
    return g.busy;
  }

  // src/api-mb.js
  async function fetchMBEntity(mbid) {
    const res = await mbnFetch(`/ws/js/entity/${mbid}`);
    if (!res.ok) throw new Error(`/ws/js/entity/${mbid} \u2192 ${res.status}`);
    return res.json();
  }
  var mbThrottle = /* @__PURE__ */ (() => {
    const MAX_CONCURRENT = 4;
    let _running = 0;
    let _pauseUntil = 0;
    const _queue = [];
    let _totalRequests = 0;
    let _rateLimited = 0;
    async function _waitForPause() {
      let wait = _pauseUntil - Date.now();
      if (wait <= 0) return;
      logDebug(`throttle: waiting ${wait}ms for shared pause`);
      while ((wait = _pauseUntil - Date.now()) > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    function _drain() {
      while (_running < MAX_CONCURRENT && _queue.length > 0) {
        _running++;
        const item = _queue.shift();
        _run(item).finally(() => {
          _running--;
          _drain();
        });
      }
    }
    let _diagReqSeq = 0;
    const REQUEST_TIMEOUT_MS = 1e4;
    async function _run(item) {
      const tag = `req#${++_diagReqSeq}`;
      const shortUrl = item.url.replace(MB, "").replace(/^https:/, "");
      const gated = mbnGated(item.url);
      const gateLog = (lv, m) => lv === "warn" ? log.warn(m) : logDebug(m);
      for (let attempt = 0; attempt <= item.retries; attempt++) {
        await _waitForPause();
        if (gated) await mbnSlot({ label: shortUrl, log: gateLog });
        _totalRequests++;
        const attemptTag = attempt === 0 ? "" : ` (retry ${attempt})`;
        logDebug(`${tag} [running=${_running} queued=${_queue.length}] GET ${shortUrl}${attemptTag}`);
        const t0 = Date.now();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = gated ? await fetch(item.url, { signal: ctrl.signal }) : await mbnFetch(item.url, { signal: ctrl.signal }, { log: gateLog });
          const elapsed = Date.now() - t0;
          if (gated) {
            const a = await mbnAnswer(res.status, (n) => res.headers.get(n), { log: gateLog });
            if (a.throttled) {
              _rateLimited++;
              logDebug(`${tag} <- ${res.status} in ${elapsed}ms; the shared gate holds ${a.hold}ms`);
              continue;
            }
          }
          if (res.status === 429 || res.status === 503) {
            _rateLimited++;
            const ra = parseInt(res.headers.get("Retry-After"), 10);
            const waitMs = ra > 0 ? ra * 1e3 : Math.min(1e3 * Math.pow(2, attempt), 3e4);
            _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
            logDebug(`${tag} <- ${res.status} in ${elapsed}ms; shared pause pushed to +${waitMs}ms`);
            continue;
          }
          if (!res.ok) {
            logDebug(`${tag} <- ${res.status} (give up) in ${elapsed}ms`);
            item.resolve(item.nf && res.status === 404 ? { notFound: true } : null);
            return;
          }
          const data = item.wantJson ? await res.json() : res;
          logDebug(`${tag} <- ${res.status} in ${elapsed}ms`);
          item.resolve(data);
          return;
        } catch (e) {
          const elapsed = Date.now() - t0;
          const isTimeout = e?.name === "AbortError";
          const reason = isTimeout ? `timed out after ${REQUEST_TIMEOUT_MS}ms` : `${e?.message || e}`;
          if (isTimeout) {
            _rateLimited++;
            const waitMs = Math.min(1e3 * Math.pow(2, attempt), 8e3);
            _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
            logDebug(`${tag} threw in ${elapsed}ms: ${reason}; shared pause pushed to +${waitMs}ms`);
          } else {
            logDebug(`${tag} threw in ${elapsed}ms: ${reason}`);
          }
          if (attempt === item.retries) {
            item.resolve(null);
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        } finally {
          clearTimeout(timer);
        }
      }
      item.resolve(null);
    }
    function _enqueue(url, retries, wantJson, nf = false) {
      return new Promise((resolve) => {
        _queue.push({ url, retries, wantJson, nf, resolve });
        _drain();
      });
    }
    return {
      fetchJson: (url, retries = 3) => _enqueue(url, retries, true),
      // Like fetchJson, but a 404 resolves `{ notFound: true }` instead of
      // null — so null unambiguously means "lookup FAILED" (#193 chip bug).
      fetchJson404: (url, retries = 3) => _enqueue(url, retries, true, true),
      fetchRaw: (url, retries = 3) => _enqueue(url, retries, false),
      stats: () => ({
        total: _totalRequests,
        rateLimited: _rateLimited,
        inFlight: _running,
        queued: _queue.length
      })
    };
  })();
  async function fetchWithRetry(url, retries = 4) {
    return mbThrottle.fetchJson(url, retries);
  }
  var _relTypeCache = /* @__PURE__ */ new Map();
  async function fetchArtistRelTypes(mbid) {
    if (!mbid) return null;
    if (_relTypeCache.has(mbid)) return _relTypeCache.get(mbid);
    const json = await mbThrottle.fetchJson(
      `${MB}/ws/2/artist/${mbid}?inc=recording-rels+release-rels+release-group-rels+work-rels&fmt=json&limit=100`
    );
    if (!json) return null;
    const types = relRoleLabels(json.relations);
    _relTypeCache.set(mbid, types);
    return types;
  }
  var MODIFIER_ATTRS = /* @__PURE__ */ new Set(["additional", "guest", "solo", "minor", "bonus"]);
  function relRoleLabels(relations) {
    const labels = /* @__PURE__ */ new Set();
    for (const r of relations || []) {
      if (!r.type) continue;
      const attrs = (Array.isArray(r.attributes) ? r.attributes : []).filter((a) => a && !MODIFIER_ATTRS.has(String(a).toLowerCase()));
      if ((r.type === "instrument" || r.type === "vocal") && attrs.length) {
        attrs.forEach((a) => labels.add(a));
      } else {
        labels.add(r.type);
      }
    }
    return [...labels].sort();
  }
  async function getSourceUrlsForRelease(mbid) {
    const url = `/ws/js/release/${mbid}?fmt=json&inc=rels`;
    let json = null;
    for (let attempt = 1; ; attempt++) {
      let res = null;
      try {
        res = await mbnFetch(url, { headers: { Accept: "application/json" } });
      } catch (e) {
        if (attempt >= 4) throw e;
      }
      if (res && res.ok) {
        json = await res.json();
        if (attempt > 1) log.info(`Sources: MusicBrainz answered on attempt ${attempt}`);
        break;
      }
      if (res && res.status === 404) {
        log.warn(`Sources: MusicBrainz says this release does not exist (404)`);
        return {};
      }
      if (attempt >= 4) throw new Error(`MB /ws/js/release returned ${res ? res.status : "no response"} after ${attempt} attempts`);
      const wait = Number(res && res.headers.get("Retry-After")) * 1e3 || 400 * attempt + Math.floor(Math.random() * 300);
      log.warn(`Sources: MusicBrainz returned ${res ? res.status : "no response"} \u2014 retrying (${attempt}/3) in ${Math.round(wait)}ms`);
      await new Promise((r) => setTimeout(r, Math.min(wait, 8e3)));
    }
    {
      const rels = json.relationships || [];
      const urlRels = rels.filter((r) => r.target?.href_url);
      log.info(`Sources: MusicBrainz returned ${rels.length} relationship(s) for this release, ${urlRels.length} of them url(s)`);
      _lastLinkCount = urlRels.length;
      const abs = (u) => u && u.startsWith("//") ? "https:" + u : u;
      const href = (pred) => abs(rels.find(pred)?.target?.href_url || null);
      return {
        discogs: href((rel) => rel.target?.sidebar_name === "Discogs"),
        tidal: href((rel) => /(^|\/\/)(www\.|listen\.)?tidal\.com\/(browse\/)?album\/\d+/i.test(rel.target?.href_url || "")),
        qobuz: href((rel) => /(^|\/\/)(www\.|play\.|open\.)?qobuz\.com\/([a-z]{2}-[a-z]{2}\/)?album\//i.test(rel.target?.href_url || "")),
        deezer: href((rel) => /(^|\/\/)(www\.)?deezer\.com\/([a-z]{2}\/)?album\/\d+/i.test(rel.target?.href_url || "")),
        mora: href((rel) => /(^|\/\/)mora\.jp\/package\/\d+\/[\w-]+/i.test(rel.target?.href_url || "")),
        melon: href((rel) => /(^|\/\/)(www\.|m2\.|m\.app\.)?melon\.com\/album\/detail\.htm\?(?:[^#]*&)?albumId=\d+/i.test(rel.target?.href_url || "")),
        // #815
        allmusic: href((rel) => /(^|\/\/)(www\.)?allmusic\.com\/album\/release\/(?:[^/?#]*-)?mr\d{10}/i.test(rel.target?.href_url || "")),
        // #814
        apple: href((rel) => /(^|\/\/)(?:music|itunes)\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/?#]+\/)?(?:id)?\d+/i.test(rel.target?.href_url || "")),
        // #435; iTunes URLs #436
        metalArchives: href((rel) => /(^|\/\/)(www\.)?metal-archives\.com\/albums\/[^/]+\/[^/]+\/\d+/i.test(rel.target?.href_url || "")),
        // #453
        ytmusic: href((rel) => /(^|\/\/)((music|www|m)\.)?youtube\.com\/(?:playlist\?(?:[^#]*&)?list=OLAK5uy_|browse\/MPREb_)/i.test(rel.target?.href_url || ""))
        // #648; www.youtube.com #679
      };
    }
  }
  var _lastLinkCount = 0;
  function logSourceProbe(sources, urlCount) {
    const found = Object.entries(sources || {}).filter(([, v]) => v);
    const n = urlCount == null ? _lastLinkCount : urlCount;
    log.info(`Sources: ${found.length} import source(s) from ${n} link(s)` + (found.length ? " \u2014 " + found.map(([k]) => k).join(", ") : " \u2014 none of the links is a supported source"));
    found.forEach(([k, v]) => logDebug(`  source ${k}: ${v}`));
  }
  function resolveLinkTypeId(name, type0, type1) {
    const lt = pageWindow.MB?.linkedEntities?.link_type;
    if (!lt) {
      log.error("MB.linkedEntities.link_type not available");
      return null;
    }
    const needle = name.toLowerCase().trim();
    const stripAttrs = (s) => (s || "").toLowerCase().replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    const candidates = Object.values(lt).filter(
      (v) => v.type0 === type0 && v.type1 === type1 && !v.deprecated
    );
    for (const v of candidates) {
      if ((v.name || "").toLowerCase() === needle) return v.id;
    }
    for (const v of candidates) {
      if (stripAttrs(v.link_phrase) === needle) return v.id;
      if (stripAttrs(v.reverse_link_phrase) === needle) return v.id;
    }
    const contains = candidates.filter((v) => {
      const blobs = [v.name, stripAttrs(v.link_phrase), stripAttrs(v.reverse_link_phrase)].filter(Boolean);
      return blobs.some((b) => b.includes(needle) || needle.includes(b));
    });
    if (contains.length > 0) {
      contains.sort((a, b) => ((a.name || "").length || 999) - ((b.name || "").length || 999));
      const best = contains[0];
      if ((best.name || "").toLowerCase() !== needle) {
        log.info(`Fuzzy match: "${name}" \u2192 "${best.name}" (${type0}\u2192${type1})`);
      }
      return best.id;
    }
    const availableNames = candidates.map((v) => v.name).filter(Boolean).sort().join(", ");
    const allByName = Object.values(lt).filter(
      (v) => (v.name || "").toLowerCase() === needle || stripAttrs(v.link_phrase) === needle || stripAttrs(v.reverse_link_phrase) === needle
    );
    const deprecatedHit = allByName.find((v) => v.type0 === type0 && v.type1 === type1 && v.deprecated);
    const wrongPairHits = allByName.filter((v) => !(v.type0 === type0 && v.type1 === type1));
    if (deprecatedHit) {
      const altPairs = [...new Set(allByName.filter((v) => !v.deprecated).map((v) => `${v.type0}\u2192${v.type1}`))].join(", ");
      log.error(`"${name}" (${type0}\u2192${type1}) is deprecated by MB and would block the commit \u2014 skipping${altPairs ? `. Valid alternative(s): ${altPairs}` : ""}.`);
    } else if (wrongPairHits.length > 0) {
      const hitDesc = wrongPairHits.map((v) => `${v.name}(${v.type0}\u2192${v.type1})`).join(", ");
      log.warn(`No "${name}" link type for (${type0}\u2192${type1}) \u2014 exists for other entity pairs: ${hitDesc} \u2014 skipping`);
    } else {
      log.warn(`Unknown link type "${name}" (${type0}\u2192${type1}). Available for this pair: ${availableNames || "none"}`);
    }
    return null;
  }

  // src/storage.js
  var DB_NAME = "mblink";
  var DB_VERSION = 2;
  var STORE = "entity_cache";
  var db = null;
  var _request = indexedDB.open(DB_NAME, DB_VERSION);
  _request.onerror = function() {
    console.error("Why didn't you allow my web app to use IndexedDB?!");
  };
  _request.onsuccess = function(event) {
    db = event.target.result;
  };
  _request.onupgradeneeded = function(event) {
    const upgradeDb = event.target.result;
    if (!upgradeDb.objectStoreNames.contains(STORE)) {
      upgradeDb.createObjectStore(STORE, { keyPath: "discogs_id" });
    }
  };
  function mbUrlOf(entityType, mbid) {
    return `${MB}/${entityType}/${mbid}`;
  }
  function readIdbRecord(key) {
    return new Promise((resolve) => {
      if (!key || !db) return resolve(null);
      try {
        const tx = db.transaction([STORE], "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  function writeIdbRecord(key, partial) {
    return new Promise((resolve) => {
      if (!key || !db) return resolve(null);
      try {
        const tx = db.transaction([STORE], "readwrite");
        const store = tx.objectStore(STORE);
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          const existing = getReq.result || {};
          const merged = { ...existing, ...partial, discogs_id: key, resolvedAt: (/* @__PURE__ */ new Date()).toISOString() };
          if (merged.mbid && merged.entityType && !partial.mbUrl) {
            merged.mbUrl = mbUrlOf(merged.entityType, merged.mbid);
          }
          const putReq = store.put(merged);
          putReq.onsuccess = () => resolve(merged);
          putReq.onerror = () => resolve(null);
        };
        getReq.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  function deleteIdbRecord(key) {
    return new Promise((resolve) => {
      if (!key || !db) return resolve(false);
      try {
        const tx = db.transaction([STORE], "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // src/progress-bar.js
  var _pInterval = null;
  var _pPos = -40;
  function _showBar() {
    const row1 = document.querySelector(".discogs-bar-row1");
    const row2 = document.querySelector(".discogs-bar-row2");
    const r1h = row1 ? row1.getBoundingClientRect().height : 42;
    let pb = document.getElementById("discogs-pb");
    if (!pb) {
      pb = document.createElement("div");
      pb.id = "discogs-pb";
      pb.style.cssText = "position:fixed;left:0;right:0;height:5px;z-index:99999;background:var(--mbu-bg-sunken);overflow:hidden;";
      const fill = document.createElement("div");
      fill.id = "discogs-pb-fill";
      fill.style.cssText = "position:absolute;top:0;height:100%;width:40%;background:var(--mbu-warn);transition:width 0.2s linear;";
      pb.appendChild(fill);
      document.body.appendChild(pb);
    }
    pb.style.top = r1h + "px";
    pb.style.display = "block";
    if (row2) row2.style.marginTop = r1h + 5 + "px";
    _startMarquee();
  }
  function _startMarquee() {
    clearInterval(_pInterval);
    const fill = document.getElementById("discogs-pb-fill");
    if (fill) {
      fill.style.width = "40%";
      fill.style.left = _pPos + "%";
      fill.style.transition = "";
    }
    _pPos = -40;
    _pInterval = setInterval(() => {
      _pPos += 1.5;
      if (_pPos > 100) _pPos = -40;
      const f = document.getElementById("discogs-pb-fill");
      if (f) f.style.left = _pPos + "%";
    }, 16);
  }
  function _setProgressPct(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    clearInterval(_pInterval);
    _pInterval = null;
    const pctEl = document.getElementById("discogs-progress-pct");
    if (pctEl) pctEl.textContent = Math.round(p) + "%";
    const fill = document.getElementById("discogs-pb-fill");
    if (!fill) return;
    fill.style.left = "0";
    fill.style.transition = "width 0.2s linear";
    fill.style.width = p + "%";
  }
  function _hideBar() {
    clearInterval(_pInterval);
    _pInterval = null;
    const pb = document.getElementById("discogs-pb");
    if (pb) pb.style.display = "none";
    const row2 = document.querySelector(".discogs-bar-row2");
    if (row2) row2.style.marginTop = "";
  }

  // src/api-discogs.js
  var DISCOGS_URL_RE = /^https?:\/\/(?:www|api)\.discogs\.com\/(?:(?:(?!sell).+|sell.+)\/)?(master|release|artist|label)s?\/(\d+)(?:[^?#]*)(?:\?noanv=1|\?anv=[^=]+)?$/i;
  function parseDiscogsUrl(url) {
    const m = DISCOGS_URL_RE.exec(url);
    if (!m) return null;
    const type = m[1];
    const id = m[2];
    return {
      type,
      id,
      key: `${type}/${id}`,
      cleanUrl: `https://www.discogs.com/${type}/${id}`
    };
  }
  var _releaseDataCache = /* @__PURE__ */ new Map();
  function stripCompanyNums(json) {
    for (const list of [json.companies, json.labels]) {
      if (!Array.isArray(list)) continue;
      for (const c of list) {
        if (c && typeof c.name === "string") c.name = c.name.replace(/\s+\(\d+\)$/, "");
      }
    }
    return json;
  }
  function getDiscogsReleaseData(url) {
    if (_releaseDataCache.has(url)) return Promise.resolve(_releaseDataCache.get(url));
    return fetch(
      `${url.replace(
        "https://www.discogs.com/release/",
        "https://api.discogs.com/releases/"
      )}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`
    ).then((body) => body.json()).then((json) => {
      _releaseDataCache.set(url, stripCompanyNums(json));
      return json;
    });
  }
  var _entityDataCache = /* @__PURE__ */ new Map();
  function getDiscogsEntityData(resourceUrl) {
    if (!resourceUrl) return Promise.resolve(null);
    if (_entityDataCache.has(resourceUrl)) return Promise.resolve(_entityDataCache.get(resourceUrl));
    return fetch(`${resourceUrl}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`).then((r) => r.ok ? r.json() : r.status === 404 ? null : Promise.reject(new Error("HTTP " + r.status))).then((json) => {
      if (!json) {
        _entityDataCache.set(resourceUrl, null);
        return null;
      }
      const slim = {
        profile: json.profile || "",
        name: json.name || "",
        namevariations: json.namevariations || [],
        realname: json.realname || ""
      };
      _entityDataCache.set(resourceUrl, slim);
      return slim;
    }).catch(() => null);
  }

  // src/data/entity-map.js
  var ENTITY_TYPE_MAP = {
    // Places
    "Arranged At": {
      entityType: "place",
      linkType: "arranged at"
    },
    "Engineered At": {
      entityType: "place",
      linkType: "engineered at"
    },
    "Recorded At": {
      entityType: "place",
      linkType: "recorded at"
    },
    "Mixed At": {
      entityType: "place",
      linkType: "mixed at"
    },
    "Mastered At": {
      entityType: "place",
      linkType: "mastered at"
    },
    "Lacquer Cut At": {
      entityType: "place",
      linkType: "lacquer cut at"
    },
    "edited At": {
      entityType: "place",
      linkType: "edited at"
    },
    "Remixed At": {
      entityType: "place",
      linkType: "remixed at"
    },
    "Produced At": {
      entityType: "place",
      linkType: "produced at"
    },
    "Overdubbed At": null,
    "manufactured At": {
      entityType: "place",
      linkType: "manufactured at"
    },
    "Glass Mastered At": {
      entityType: "place",
      linkType: "glass mastered at"
    },
    "Pressed At": {
      entityType: "place",
      linkType: "pressed at"
    },
    "Designed At": null,
    "Filmed At": null,
    "Exclusive Retailer": null,
    // labels
    "Copyright (c)": {
      entityType: "label",
      linkType: "copyright"
    },
    "Phonographic Copyright (p)": {
      entityType: "label",
      linkType: "phonographic copyright"
    },
    "Copyright \xA9": {
      entityType: "label",
      linkType: "copyright"
    },
    "Phonographic Copyright \u2117": {
      entityType: "label",
      linkType: "phonographic copyright"
    },
    "Licensed From": {
      entityType: "label",
      linkType: "licensor"
    },
    "Licensed To": {
      entityType: "label",
      linkType: "licensee"
    },
    "Licensed Through": null,
    "Distributed By": {
      entityType: "label",
      linkType: "distributed"
    },
    "Made By": {
      entityType: "label",
      linkType: "manufactured"
    },
    "Manufactured By": {
      entityType: "label",
      linkType: "manufactured"
    },
    "Glass Mastered By": {
      entityType: "label",
      linkType: "glass mastered"
    },
    "Pressed By": {
      entityType: "label",
      linkType: "pressed"
    },
    "Marketed By": {
      entityType: "label",
      linkType: "marketed"
    },
    "Printed By": {
      entityType: "label",
      linkType: "printed"
    },
    "Promoted By": {
      entityType: "label",
      linkType: "promoted"
    },
    "Published By": {
      entityType: "label",
      linkType: "published"
    },
    "Rights Society": {
      entityType: "label",
      linkType: "rights society"
    },
    "Arranged For": {
      entityType: "label",
      linkType: "arranged for"
    },
    "Manufactured For": {
      entityType: "label",
      linkType: "manufactured for"
    },
    "Mixed For": {
      entityType: "label",
      linkType: "mixed for"
    },
    "Produced For": {
      entityType: "label",
      linkType: "produced for"
    },
    "Miscellaneous Support": {
      entityType: "label",
      linkType: "misc"
    },
    "Exported By": null,
    // Artists
    Performer: {
      entityType: "artist",
      linkType: "performer"
    },
    // Discogs "Ensemble" — a group/ensemble credited as performing (e.g. a
    // vocal quartet or jazz ensemble). MB has no dedicated "ensemble" link
    // type, so the conventional fit is the generic `performer` relationship
    // (same as Discogs "Performer"). Without this it fell through to the
    // INSTRUMENTS table (`Ensemble: null`) and was dropped as unmapped.
    Ensemble: {
      entityType: "artist",
      linkType: "performer"
    },
    // Discogs role "Accompanied By" → MB has no dedicated link type or
    // attribute for this. Closest semantic fit is `performer` with the
    // `additional` attribute (used elsewhere in MB for non-primary
    // contributions). Previously this fell through to the INSTRUMENTS map
    // and was dispatched as a bare `instrument` rel with the bogus
    // attribute value "accompanied by" — which MB silently drops, leaving
    // a junk instrument rel with no instrument named.
    "Accompanied By": {
      entityType: "artist",
      linkType: "performer",
      attributes: ["additional"]
    },
    Instruments: {
      entityType: "artist",
      linkType: "instrument"
    },
    Vocals: {
      entityType: "artist",
      linkType: "vocal"
    },
    // Discogs "Voice [Humming]" and the like: a vocal (it was dropped, unmapped)
    Voice: {
      entityType: "artist",
      linkType: "vocal"
    },
    "Backing Vocals": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "background vocals" }]
    },
    Choir: {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "choir vocals" }]
    },
    Chorus: {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "choir vocals" }]
    },
    "Choir Vocals": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "choir vocals" }]
    },
    "Lead Vocals": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "lead vocals" }]
    },
    // #427: voice-type vocals — MB carries each of these as a vocal attribute (verified
    // against the live link_attribute_type table). Hyphenated ones get both Discogs
    // casing variants, since the role lookup is exact-case.
    "Soprano Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "soprano vocals" }] },
    "Mezzo-soprano Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "mezzo-soprano vocals" }] },
    "Mezzo-Soprano Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "mezzo-soprano vocals" }] },
    "Alto Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "alto vocals" }] },
    "Contralto Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "contralto vocals" }] },
    "Countertenor Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "countertenor vocals" }] },
    "Tenor Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "tenor vocals" }] },
    "Baritone Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "baritone vocals" }] },
    "Bass-baritone Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "bass-baritone vocals" }] },
    "Bass-Baritone Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "bass-baritone vocals" }] },
    "Bass Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "bass vocals" }] },
    "Treble Vocals": { entityType: "artist", linkType: "vocal", attributes: [{ _type: "vocal", value: "treble vocals" }] },
    Orchestra: {
      entityType: "artist",
      linkType: "orchestra"
    },
    Conductor: {
      entityType: "artist",
      linkType: "conductor"
    },
    "Chorus Master": {
      entityType: "artist",
      linkType: "chorus master"
    },
    Concertmaster: {
      entityType: "artist",
      linkType: "concertmaster"
    },
    Concertmistress: {
      entityType: "artist",
      linkType: "concertmaster"
    },
    "Compiled By": {
      entityType: "artist",
      linkType: "compiler"
    },
    "DJ Mix": {
      entityType: "artist",
      linkType: "DJ-mixer"
    },
    Remix: {
      entityType: "artist",
      linkType: "remixer"
    },
    "contains samples by": {
      entityType: "artist",
      linkType: "contains samples by"
    },
    "Written-By": {
      entityType: "artist",
      linkType: "writer"
    },
    "Written By": {
      entityType: "artist",
      linkType: "writer"
    },
    "Composed By": {
      entityType: "artist",
      linkType: "composer"
    },
    // #233: author of the source text (e.g. the novel a Hörspiel adapts). MB
    // 'writer' is a work-level rel, so this lands on the work CH creates.
    Author: {
      entityType: "artist",
      linkType: "writer"
    },
    // #233: spoken-word performer (audio play / Hörspiel cast). MB convention is
    // the 'vocal' relationship with the 'spoken vocals' attribute; the character
    // in the Discogs bracket becomes the credited-as (handled in mappers.js).
    "Voice Actor": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "spoken vocals" }]
    },
    "Words By": {
      entityType: "artist",
      linkType: "lyricist"
    },
    "Lyrics By": {
      entityType: "artist",
      linkType: "lyricist"
    },
    "Libretto By": {
      entityType: "artist",
      linkType: "librettist"
    },
    "Translated By": {
      entityType: "artist",
      linkType: "translator"
    },
    "Arranged By": {
      entityType: "artist",
      linkType: "arranger"
    },
    "Instrumentation By": {
      entityType: "artist",
      linkType: "instruments arranger"
    },
    "Orchestrated By": {
      entityType: "artist",
      linkType: "orchestrator"
    },
    "vocals arranger": {
      entityType: "artist",
      linkType: "vocals arranger"
    },
    Producer: {
      entityType: "artist",
      linkType: "producer"
    },
    "Co-producer": {
      entityType: "artist",
      linkType: "producer",
      // MB has no `co` attribute. The convention for "Co-X" is `additional`
      // on the base role (issue #3). See also the matching remap in
      // `getArtistRoles` for the regex /Co /.
      attributes: ["additional"]
    },
    "Executive-Producer": {
      entityType: "artist",
      linkType: "producer",
      attributes: ["executive"]
    },
    "Post Production": {
      entityType: "artist",
      linkType: "producer"
    },
    Engineer: {
      entityType: "artist",
      linkType: "engineer"
    },
    "Audio Engineer": {
      entityType: "artist",
      linkType: "audio engineer"
    },
    "Mastered By": {
      entityType: "artist",
      linkType: "mastering"
    },
    "Remastered By": {
      entityType: "artist",
      linkType: "mastering",
      attributes: ["re"]
    },
    "Lacquer Cut By": {
      entityType: "artist",
      linkType: "lacquer cut"
    },
    "sound engineer": {
      entityType: "artist",
      linkType: "sound engineer"
    },
    "Mixed By": {
      entityType: "artist",
      linkType: "mix"
    },
    "Recorded By": {
      entityType: "artist",
      linkType: "recording"
    },
    "Recording Engineer": {
      entityType: "artist",
      linkType: "recording"
    },
    "Programmed By": {
      entityType: "artist",
      linkType: "programming"
    },
    Editor: {
      entityType: "artist",
      linkType: "editor"
    },
    "Edited By": {
      entityType: "artist",
      linkType: "editor"
    },
    "balance engineer": {
      entityType: "artist",
      linkType: "engineer"
    },
    "copyrighted by": {
      entityType: "artist",
      linkType: "copyright"
    },
    "phonographic copyright by": {
      entityType: "artist",
      linkType: "phonographic copyright"
    },
    Legal: {
      entityType: "artist",
      linkType: "legal representation"
    },
    Booking: {
      entityType: "artist",
      linkType: "booking"
    },
    "Art Direction": {
      entityType: "artist",
      linkType: "art direction"
    },
    Artwork: {
      entityType: "artist",
      linkType: "artwork"
    },
    "Artwork By": {
      entityType: "artist",
      linkType: "artwork"
    },
    Cover: {
      entityType: "artist",
      linkType: "artwork"
    },
    Design: {
      entityType: "artist",
      linkType: "design"
    },
    "Graphic Design": {
      entityType: "artist",
      linkType: "graphic design"
    },
    Illustration: {
      entityType: "artist",
      linkType: "illustration"
    },
    "Booklet Editor": {
      entityType: "artist",
      linkType: "booklet editor"
    },
    Photography: {
      entityType: "artist",
      linkType: "photography"
    },
    "Photography By": {
      entityType: "artist",
      linkType: "photography"
    },
    Technician: {
      entityType: "artist",
      // MB's link type is singular ("instrument technician"). The plural
      // form here missed the exact-name match in resolveLinkTypeId, so the
      // fuzzy contains-match collapsed "instruments technician" down to the
      // bare "instrument" performance link type — turning a piano tuner /
      // tech credit into an instrument performer. #155
      linkType: "instrument technician"
    },
    publisher: {
      entityType: "artist",
      linkType: "published"
    },
    "Liner Notes": {
      entityType: "artist",
      linkType: "liner notes"
    },
    "A&R": {
      entityType: "artist",
      linkType: "misc"
    },
    // #291: no dedicated MB rel — the generic "misc" relationship carries the
    // role name as its `task` attribute (mappers.js), so this lands as misc + task "research".
    Research: {
      entityType: "artist",
      linkType: "misc"
    },
    Advisor: {
      entityType: "artist",
      linkType: "misc"
    },
    "Concept By": {
      entityType: "artist",
      linkType: "misc"
    },
    Contractor: {
      entityType: "artist",
      linkType: "misc"
    },
    Coordinator: {
      entityType: "artist",
      linkType: "misc"
    },
    // #800: "Coordinator [Production]" (mappers.js) and any source's own "Production
    // Coordinator". MB has this type for releases only, so on a track it goes in as misc
    // with the same task.
    "Production Coordinator": {
      entityType: "artist",
      linkType: "production coordinator",
      onRecording: { linkType: "misc", attributes: [{ _type: "task", value: "production coordinator" }] }
    },
    Management: {
      entityType: "artist",
      linkType: "misc"
    },
    "Musical Assistance": {
      entityType: "artist",
      linkType: "misc"
    },
    "Tour Manager": {
      entityType: "artist",
      linkType: "misc"
    },
    Other: {
      entityType: "artist",
      linkType: "misc"
    },
    "Public Relations": {
      entityType: "artist",
      linkType: "misc"
    },
    Promotion: {
      entityType: "artist",
      linkType: "misc"
    },
    Crew: {
      entityType: "artist",
      linkType: "misc"
    },
    "Supervised By": {
      entityType: "artist",
      linkType: "misc"
    },
    "Director Of Photography": {
      entityType: "artist",
      linkType: "photography",
      attributes: [{ _type: "task", value: "director of photography" }]
    }
  };

  // src/data/instruments.js
  var INSTRUMENTS = {
    Afox\u00E9: "afox\xE9",
    Agog\u00F4: "agog\xF4",
    Ashiko: "ashiko",
    Atabal: null,
    Bapang: "bhapang",
    "Clarinet": "clarinet",
    "Percussion": "percussion",
    "Congas": "congas",
    "Conga": "congas",
    "Conga Drum": "congas",
    "Bongos": "bongos",
    "Bongo": "bongos",
    "Tambourine": "tambourine",
    "Cuica": "cu\xEDca",
    "Guiro": "g\xFCiro",
    "G\xFCiro": "g\xFCiro",
    "Udu": "udu",
    "La\xFAd": "la\xFAd",
    "Laud": "la\xFAd",
    "Mbira": "mbira",
    "Kalimba": "mbira",
    "Slide Guitar": "slide guitar",
    "Acoustic Guitar": "acoustic guitar",
    "Double Bass": "double bass",
    "Goblet Drum": "goblet drum",
    "Darbouka": "darbuka",
    // #392 goblet drum (Discogs spelling; MB instrument is "darbuka")
    "Darbuka": "darbuka",
    "Maracas": "maracas",
    "Steel Drum": "steelpan",
    "Steelpan": "steelpan",
    "Electronics": "electronics",
    "Electronic": "electronics",
    "Synth Bass": "bass synthesizer",
    "Vocoder": "vocoder",
    "Xylophone": "xylophone",
    "Bells": "bells",
    "Chimes": "chimes",
    // #392 MB has no "wind chimes" instrument; the generic MB name is "chimes"
    "Glockenspiel": "glockenspiel",
    "Shakers": "shaker",
    "Shaker": "shaker",
    "Cowbell": "cowbell",
    "Claves": "claves",
    "Timbales": "timbales",
    "Baritone Guitar": "baritone guitar",
    "Synth": "synthesizer",
    "Synthesizer": "synthesizer",
    "Synths": "synthesizer",
    "Keyboards": "keyboard",
    "Keyboard": "keyboard",
    "Organ": "organ",
    "Harmonium": "harmonium",
    "Piano": "piano",
    "Electric Piano": "electric piano",
    "Harpsichord": "harpsichord",
    "Celesta": "celesta",
    "Strings": "string instruments",
    "Flute": "flute",
    "Saxophone": "saxophone",
    "Vibraphone": "vibraphone",
    "Trumpet": "trumpet",
    "Trombone": "trombone",
    "Violin": "violin",
    "Cello": "cello",
    "Viola": "viola",
    "Harp": "harp",
    "Banjo": "banjo",
    "Mandolin": "mandolin",
    "Ukulele": "ukulele",
    "Harmonica": "harmonica",
    "Accordion": "accordion",
    "Oboe": "oboe",
    "Bassoon": "bassoon",
    "Tuba": "tuba",
    "French Horn": "French horn",
    "Marimba": "marimba",
    "Melodica": "melodica",
    "Sitar": "sitar",
    "Oud": "oud",
    "Kora": "kora",
    "Tabla": "tabla",
    "Didgeridoo": "didgeridoo",
    "Theremin": "theremin",
    "Flugelhorn": "flugelhorn",
    "Cornet": "cornet",
    "Alto Saxophone": "alto saxophone",
    "Tenor Saxophone": "tenor saxophone",
    "Soprano Saxophone": "soprano saxophone",
    "Baritone Saxophone": "baritone saxophone",
    "Bass Clarinet": "bass clarinet",
    "Bass Flute": "bass flute",
    "Piccolo": "piccolo",
    "Bass Drum": "bass drum",
    Bata: "bat\xE1 drum",
    "Bell Tree": "bell tree",
    Bendir: "bendir",
    Bodhr\u00E1n: "bodhr\xE1n",
    "Body Percussion": "body percussion",
    Bombo: null,
    Bones: "bones",
    Buhay: null,
    Buk: "buk",
    Cabasa: "cabasa",
    Caixa: "caixa",
    "Caja Vallenata": null,
    Caj\u00F3n: "caj\xF3n",
    Calabash: "calabash",
    Castanets: "castanets",
    Caxixi: "caxixi",
    "Chak'chas": null,
    Chinch\u00EDn: null,
    Ching: "ching",
    Cymbal: "cymbal",
    Daf: "daf",
    Davul: "davul",
    Dhol: "dhol",
    Dholak: "dholak",
    Djembe: "djembe",
    Doira: null,
    Doli: null,
    Drum: "drum set",
    "Drum Programming": null,
    Drums: "drum set",
    Dunun: "dunun",
    "Electronic Drums": null,
    "Finger Cymbals": "finger cymbals",
    "Finger Snaps": "finger snaps",
    "Frame Drum": "frame drum",
    "Friction Drum": "friction drum",
    Frottoir: "frottoir",
    Ganz\u00E1: "ganz\xE1",
    Ghatam: "ghatam",
    Ghungroo: null,
    Gong: "gong",
    Guacharaca: null,
    Handbell: "handbell",
    Handclaps: "handclaps",
    "Hang Drum": "handpan",
    Hihat: "hi-hat",
    Hosho: null,
    Hyoshigi: "hyoshigi",
    Idiophone: "idiophone",
    Jaggo: null,
    Janggu: "janggu",
    Jing: "jing",
    "K'kwaengwari": null,
    Ka: null,
    "Kagura Suzu": null,
    Kanjira: "kanjira",
    Karkabas: null,
    Khartal: null,
    Khurdak: "duggi",
    Kynggari: null,
    Lagerphone: "monkey stick",
    "Lion's Roar": null,
    Madal: "madal",
    Mallets: null,
    "Monkey stick": "monkey stick",
    Mridangam: "mridangam",
    Pakhavaj: "pakhawaj",
    Pandeiro: null,
    Rainstick: "rainstick",
    Ratchet: "ratchet",
    Rattle: "shaken idiophone",
    "Reco-reco": "reco-reco",
    Repinique: "repinique",
    Rototoms: null,
    Scraper: null,
    Shakubyoshi: null,
    Shekere: "shekere",
    Shuitar: null,
    "Singing Bowls": null,
    Skratjie: null,
    Slapstick: "slapstick",
    "Slit Drum": "slit drum",
    Snare: null,
    Spoons: "spoons",
    "Stomp Box": null,
    Surdo: "surdo",
    Surigane: "atarigane",
    Taiko: "taiko",
    "Talking Drum": "talking drum",
    "Tam-tam": "chau gong",
    Tambora: null,
    Tamboril: "tabor",
    Tamborim: "tamborim",
    "Tan-Tan": null,
    "Tap Dance": "tap dance",
    "Tar (Drum)": null,
    "Temple Bells": null,
    "Temple Block": null,
    Thavil: "thavil",
    Timpani: "timpani",
    "Tom Tom": "tom-tom",
    Triangle: "triangle",
    T\u00FCng\u00FCr: null,
    Vibraslap: "vibraslap",
    Washboard: "washboard",
    Waterphone: "waterphone",
    "Wood Block": "wood block",
    Zabumba: "zabumba",
    Amadinda: "amadinda",
    Angklung: "angklung",
    Balafon: "balafon",
    Boomwhacker: "boomwhacker",
    Carillon: null,
    Crotales: "crotales",
    Guitaret: "guitaret",
    Lamellophone: "lamellaphone",
    Marimbula: "mar\xEDmbula",
    Metallophone: "metallophone",
    "Musical Box": "musical box",
    Prempensua: null,
    Slagbordun: null,
    "Steel Drums": "steelpan",
    "Thumb Piano": "mbira",
    Tubaphone: null,
    "Tubular Bells": "tubular bells",
    Tun: null,
    Txalaparta: "txalaparta",
    "Baby Grand Piano": null,
    Chamberlin: "chamberlin",
    Claviorgan: "claviorganum",
    "Concert Grand Piano": null,
    Dulcitone: "dulcitone",
    "Electric Harmonium": null,
    "Electric Harpsichord": null,
    "Electric Organ": "electronic organ",
    Fortepiano: null,
    "Grand Piano": "grand piano",
    Mellotron: "mellotron",
    Omnichord: "omnichord",
    "Ondes Martenot": "ondes martenot",
    "Parlour Grand Piano": null,
    Pedalboard: null,
    "Player Piano": null,
    Regal: "regal",
    Stylophone: null,
    "Tangent Piano": "tangent piano",
    "Toy Piano": "toy piano",
    "Upright Piano": "upright piano",
    Virginal: "virginal",
    "12-String Acoustic Guitar": null,
    "12-String Bass": null,
    "5-String Banjo": null,
    "6-String Banjo": null,
    "6-String Bass": null,
    "Acoustic Bass": "acoustic bass guitar",
    // #209 — Discogs separates this from "Double Bass", which maps to upright
    "Arco Bass": null,
    Arpa: null,
    Autoharp: "autoharp",
    Baglama: null,
    "Bajo Quinto": null,
    "Bajo Sexto": "bajo sexto",
    Balalaika: "balalaika",
    Bandola: null,
    Bandura: "bandura",
    Bandurria: "bandurria",
    Banhu: "banhu",
    Banjolin: "banjolin",
    "Baroque Guitar": "baroque guitar",
    Baryton: "baryton",
    "Bass Guitar": "bass guitar",
    Berimbau: "berimbau",
    Bhapang: "bhapang",
    Biwa: "biwa",
    "Blaster Beam": "blaster beam",
    Bolon: "bolon",
    Bouzouki: "bouzouki",
    "Bulbul Tarang": "bulbul tarang",
    Byzaanchi: null,
    Cavaquinho: "cavaquinho",
    "Cello Banjo": null,
    Changi: null,
    Chanzy: "chanzy",
    "Chapman Stick": "chapman stick",
    Charango: "charango",
    Chitarrone: null,
    Chonguri: null,
    Chuniri: null,
    Cimbalom: "cimbalom",
    Citole: "citole",
    Cittern: "cittern",
    Cl\u00E0rsach: null,
    "Classical Guitar": "classical guitar",
    Clavichord: "clavichord",
    Clavinet: "clavinet",
    Cobza: null,
    Contrabass: "double bass",
    Cuatro: "cuatro",
    C\u00FCmb\u00FC\u015F: "c\xFCmb\xFC\u015F",
    Cura: null,
    Deaejeng: null,
    "Diddley Bow": "diddley bow",
    Dilruba: "dilruba",
    Dobro: "resonator guitar",
    Dojo: null,
    Dombra: "dombra",
    Domra: "domra",
    Doshpuluur: "doshpuluur",
    Dulcimer: null,
    Dutar: "dutar",
    "\u0110\xE0n b\u1EA7u": "\u0111\xE0n b\u1EA7u",
    Ektare: null,
    "Electric Bass": "bass guitar",
    // MB's "bass guitar" IS the electric bass (was falling through to generic "instrument")
    "Electric Bass Guitar": "electric bass guitar",
    // MB's specific instrument (distinct from generic "bass guitar"); metal default, OP #453
    "Electric Guitar": "electric guitar",
    "Electric Upright Bass": "electric upright bass",
    "Electric Violin": "electric violin",
    "Epinette des Vosges": null,
    Erhu: "erhu",
    Esraj: "esraj",
    Fiddle: "fiddle",
    "Flamenco Guitar": "flamenco guitar",
    "Fretless Bass": "fretless bass",
    "Fretless Guitar": null,
    Gadulka: "gadulka",
    Gaohu: "gaohu",
    Gayageum: "gayageum",
    Geomungo: "geomungo",
    Giga: "\u0123\u012Bga",
    Gittern: "gittern",
    Gottuv\u00E2dyam: null,
    Guimbri: "gumbri",
    Guitalele: "guitalele",
    Guitar: "guitar",
    "Guitar Banjo": "banjitar",
    "Guitar Synthesizer": "guitar synthesizer",
    Guitarr\u00F3n: null,
    GuitarViol: null,
    Guqin: "guqin",
    Gusli: "gusli",
    Guzheng: "guzheng",
    Haegum: "haegeum",
    Halldorophone: null,
    Hardingfele: "hardingfele",
    "Harp Guitar": "harp guitar",
    Hummel: "hummel",
    Huqin: "huqin",
    "Hurdy Gurdy": "hurdy gurdy",
    Igil: "igil",
    Jarana: null,
    Jinghu: "jinghu",
    Jouhikko: "jouhikko",
    Kabosy: null,
    Kamancha: "kamancheh",
    Kankl\u0117s: "kankl\u0117s",
    Kantele: "kantele",
    Kanun: "kanun",
    Kemenche: "kemenche",
    Kirar: null,
    Kobyz: null,
    Kokyu: "kokyu",
    Koto: "koto",
    Krar: "krar",
    Langeleik: "langeleik",
    Laouto: "laouto",
    "Lap Steel Guitar": "lap steel guitar",
    Lavta: "lavta",
    "Lead Guitar": "guitar",
    // #209 — MB has no lead/rhythm-guitar instrument; both are just "guitar"
    Lira: null,
    "Lira da Braccio": "lira da braccio",
    Lirone: "lirone",
    Liuqin: "liuqin",
    Lute: "lute",
    Lyre: "lyre",
    Mandobass: null,
    Mandocello: "mandocello",
    Mandoguitar: "mandoguitar",
    Mandola: "mandola",
    "Mandolin Banjo": null,
    Mandolincello: null,
    Marxophone: "marxophone",
    Masinko: null,
    Monochord: null,
    Morinhoor: null,
    "Mountain Dulcimer": null,
    "Musical Bow": "musical bow",
    Ngoni: "ng\u0254ni",
    Nyckelharpa: "nyckelharpa",
    "Open-Back Banjo": null,
    Outi: "oud",
    Panduri: null,
    "Pedal Steel Guitar": "pedal steel guitar",
    "Piccolo Banjo": null,
    Pipa: "pipa",
    "Plectrum Banjo": null,
    "Portuguese Guitar": "portuguese guitar",
    Psalmodicon: null,
    Psaltery: "psaltery",
    Rabab: "rebab",
    Rabeca: "rebec",
    Rebab: "rebab",
    Rebec: "rebec",
    Reikin: null,
    "Requinto Guitar": null,
    "Resonator Banjo": null,
    "Resonator Guitar": "resonator guitar",
    "Rhythm Guitar": "guitar",
    // #209 — see Lead Guitar
    Ronroco: "ronroco",
    Ruan: "ruan",
    Sanshin: "sanshin",
    Santoor: "santoor",
    Sanxian: "sanxian",
    Sarangi: "sarangi",
    Sarod: "sarod",
    "Selmer-Maccaferri Guitar": null,
    "Semi-Acoustic Guitar": null,
    Seperewa: null,
    "Shahi Baaja": "bulbul tarang",
    Shamisen: "shamisen",
    Sintir: "gumbri",
    Spinet: "spinet",
    "Steel Guitar": "steel guitar",
    "Stroh Violin": "stroh violin",
    Strumstick: null,
    Surbahar: "surbahar",
    "Svara Mandala": null,
    Swarmandel: null,
    Sympitar: null,
    SynthAxe: null,
    Taish\u014Dgoto: "taishogoto",
    Talharpa: "talharpa",
    Tambura: "tambura",
    Tamburitza: null,
    Tapboard: null,
    "Tar (lute)": null,
    "Tenor Banjo": "tenor banjo",
    "Tenor Guitar": "tenor guitar",
    Theorbo: "theorbo",
    Timple: "tiple",
    Tiple: "tiple",
    Tipple: "tiple",
    Tonkori: "tonkori",
    Tres: "tres",
    "Tromba Marina": "tromba marina",
    "Twelve-String Guitar": null,
    Tzouras: "tzoura",
    "Ukulele Banjo": "banjo-ukulele",
    \u00DCt\u0151gardon: "\xFCt\u0151gardon",
    Valiha: "valiha",
    Veena: "saraswati veena",
    Vielle: "vielle",
    Vihuela: "vihuela",
    Viol: "viola da gamba",
    "Viola Caipira": "viola caipira",
    "Viola d'Amore": "viola d'amore",
    "Viola da Gamba": "viola da gamba",
    "Viola de Cocho": null,
    "Viola Kontra": null,
    "Viola Nordestina": null,
    "Violino Piccolo": "violino piccolo",
    Violoncello: "cello",
    Violone: "violone",
    "Washtub Bass": "washtub bass",
    Xalam: "xalam",
    "Yang T'Chin": "yangqin",
    Yanggeum: null,
    Zither: "zither",
    Zongora: null,
    Algoza: "algozey",
    Alphorn: "alphorn",
    "Alto Clarinet": "alto clarinet",
    "Alto Flute": "alto flute",
    "Alto Horn": null,
    "Alto Recorder": "treble recorder / alto recorder",
    Apito: null,
    Bagpipes: "bagpipe",
    Bandoneon: "bandone\xF3n",
    Bansuri: "bansuri",
    "Baritone Horn": "baritone horn",
    "Barrel Organ": "barrel organ",
    "Bass Harmonica": "bass harmonica",
    "Bass Saxophone": "bass saxophone",
    "Bass Trombone": "bass trombone",
    "Bass Trumpet": "bass trumpet",
    "Bass Tuba": null,
    "Basset Horn": "basset horn",
    Bawu: "bawu",
    Bayan: "bayan",
    Bellowphone: null,
    Beresta: null,
    "Blues Harp": "harmonica",
    "Bolivian Flute": null,
    Bombarde: "bombarde",
    Brass: "brass",
    "Brass Bass": null,
    Bucium: null,
    Bugle: null,
    Chalumeau: "chalumeau",
    Chanter: null,
    Charamel: null,
    Chirimia: "chirim\xEDa",
    Clarion: null,
    Claviola: "claviola",
    Comb: null,
    "Concert Flute": "concert flute",
    Concertina: null,
    Conch: "conch",
    "Contra-Alto Clarinet": null,
    "Contrabass Clarinet": "contrabass clarinet",
    "Contrabass Saxophone": "contrabass saxophone",
    Contrabassoon: "contrabassoon",
    "Cor Anglais": "cor anglais",
    Cornett: "cornett",
    Cromorne: "crumhorn",
    Crumhorn: "crumhorn",
    Daegeum: "daegeum",
    Danso: "danso",
    "Dili Tuiduk": null,
    Dizi: "dizi",
    Drone: null,
    Duduk: "duduk",
    Dulcian: "dulcian",
    Dulzaina: "dulzaina",
    "Electronic Valve Instrument": null,
    "Electronic Wind Instrument": "wind synthesizer",
    "English Horn": "cor anglais",
    Euphonium: "euphonium",
    Fife: "fife",
    Flageolet: "flageolet",
    Flugabone: null,
    Fluier: null,
    Flumpet: "flumpet",
    "Flute D'Amour": "fl\xFBte d'amour",
    Friscaletto: null,
    Fujara: "fujara",
    Galoubet: "three-hole pipe",
    Gemshorn: "gemshorn",
    Gudastviri: null,
    Harmet: null,
    Heckelphone: "heckelphone",
    Helicon: "helicon",
    Hichiriki: "hichiriki",
    "Highland Pipes": null,
    Horagai: null,
    Horn: "horn",
    Horns: null,
    Hotchiku: "hotchiku",
    "Hunting Horn": null,
    Jug: "jug",
    Kagurabue: "kagurabue",
    Kaval: "kaval",
    Kazoo: "kazoo",
    Khene: "khene",
    Kortholt: "kortholt",
    Launeddas: "launeddas",
    Limbe: "limbe",
    Liru: null,
    "Low Whistle": "low whistle",
    Lur: null,
    Lyricon: "lyricon",
    M\u00E4nkeri: null,
    Mellophone: "mellophone",
    Melodeon: null,
    Mey: null,
    Mizmar: null,
    Mizwad: "mezwed",
    Moce\u00F1o: null,
    "Mouth Organ": "mouth organ",
    Murli: null,
    Musette: null,
    Nadaswaram: "nadaswaram",
    Ney: "ney",
    "Northumbrian Pipes": "northumbrian pipes",
    "Nose Flute": "nose flute",
    "Oboe d'Amore": "oboe d'amore",
    "Oboe Da Caccia": "oboe da caccia",
    Ocarina: "ocarina",
    Ophicleide: "ophicleide",
    "Overtone Flute": null,
    Panpipes: "pan flute",
    "Piano Accordion": "piano accordion",
    "Piccolo Flute": null,
    "Piccolo Trumpet": "piccolo trumpet",
    Pipe: null,
    Piri: "piri",
    Pito: "three-hole pipe",
    Pixiephone: null,
    Quena: "quena",
    Quenacho: null,
    Quray: null,
    Rauschpfeife: "rauschpfeife",
    Recorder: "recorder",
    Reeds: "reeds",
    Rhaita: null,
    Rondador: "rondador",
    Rozhok: null,
    Ryuteki: "ryuteki",
    Sackbut: "sackbut",
    Salamuri: null,
    Sampona: "siku",
    Sarrusophone: "sarrusophone",
    Saxello: null,
    Saxhorn: null,
    Schwyzer\u00F6rgeli: "schwyzer\xF6rgeli",
    Serpent: "serpent",
    Shakuhachi: "shakuhachi",
    Shanai: "shehnai",
    Shawm: "shawm",
    Shenai: "shehnai",
    Sheng: "sheng",
    Shinobue: "shinobue",
    Sho: "sho",
    "Shruti Box": "shruti box",
    "Slide Whistle": "slide whistle",
    Smallpipes: null,
    Sodina: null,
    Sopilka: "sopilka",
    "Sopranino Saxophone": "sopranino saxophone",
    "Soprano Clarinet": "soprano clarinet",
    "Soprano Cornet": null,
    "Soprano Flute": "soprano flute",
    "Soprano Trombone": null,
    Souna: null,
    Sousaphone: "sousaphone",
    "Subcontrabass Saxophone": null,
    Suling: "suling",
    Suona: "suona",
    Taepyungso: null,
    T\u00E1rogat\u00F3: "taragot",
    "Tenor Horn": null,
    "Tenor Trombone": "tenor trombone",
    "Ti-tse": null,
    "Tin Whistle": "tin whistle",
    Tonette: "tonette",
    Txirula: "three-hole pipe",
    Txistu: "three-hole pipe",
    "Uilleann Pipes": "uilleann pipes",
    "Valve Trombone": "valve trombone",
    "Valve Trumpet": null,
    "Wagner Tuba": "wagner tuba",
    Whistle: "whistle",
    "Whistling Water Jar": "jug",
    Wind: null,
    Woodwind: "woodwind",
    Xiao: "xiao",
    Yorgaphone: null,
    Zhaleika: "zhaleika",
    Zukra: null,
    Zurna: "zurna",
    "Automatic Orchestra": null,
    Computer: null,
    "Drum Machine": "drum machine",
    "Rhythm Box": "drum machine",
    // #223 — Discogs "[Rhythm Box]" preset drum unit
    Effects: "effects",
    Groovebox: null,
    Loops: null,
    "MIDI Controller": null,
    Noises: null,
    Sampler: "sampler",
    Scratches: "turntable",
    Sequencer: null,
    "Software Instrument": null,
    Talkbox: "talkbox",
    // not a Discogs role; a bracket names it ("Soloist [Moog Solo]") and MB has it
    Moog: "Moog",
    Tannerin: null,
    Tape: "tape",
    Turntables: "turntable",
    // 'Accompanied By' deliberately NOT in INSTRUMENTS — it's a meta role,
    // not an instrument. Mapped in ENTITY_TYPE_MAP to performer + additional.
    "Audio Generator": null,
    "Backing Band": null,
    Band: null,
    // Discogs "Bass" is generic (could be bass guitar, double bass, …) but MB
    // has a generic "bass" instrument for exactly that case. Leaving it null
    // dispatched a bare instrument rel with no instrument → "Missing instrument"
    // on commit (#133). Map to MB's generic "bass".
    Bass: "bass",
    "Brass Band": null,
    Bullroarer: "bullroarer",
    "Concert Band": null,
    "E-Bow": "ebow",
    Ensemble: null,
    Gamelan: "gamelan",
    "Glass Harmonica": "glass harmonica",
    Guest: null,
    Homus: null,
    Instruments: null,
    "Jew's Harp": "mouth harp",
    Morchang: null,
    Musician: null,
    Orchestra: null,
    Performer: null,
    "Rhythm Section": null,
    Saw: null,
    Siren: null,
    Soloist: null,
    Sounds: null,
    Toy: null,
    Trautonium: "trautonium",
    "Wind Chimes": null,
    "Wobble Board": null
  };

  // ../../dev/guesscase/guess-case.mjs
  var mbuGuessCase = (() => {
    "use strict";
    const empty = (v) => v === null || v === void 0 || v === "";
    const nonEmpty = (v) => !empty(v);
    const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
    const escapeRegExp = (s) => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
    const capitalize = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
    const trim = (w) => clean(w).replace(/([([])\s+/, "$1").replace(/\s+([)\]])/, "$1");
    const BRACKET_PAIRS = [["(", ")"], ["[", "]"], ["<", ">"], ["\uFF08", "\uFF09"], ["\uFF3B", "\uFF3D"], ["{", "}"], ["\u3010", "\u3011"]];
    const bracketChars = new RegExp("^[" + escapeRegExp(BRACKET_PAIRS.flat().join("")) + "]$");
    const bracketPairs = BRACKET_PAIRS.reduce((r, [o, c]) => {
      r[o] = c;
      r[c] = o;
      return r;
    }, {});
    class Flags {
      constructor() {
        this.context = {};
        this.init();
      }
      resetContext() {
        const c = this.context;
        c.acronym_split = false;
        c.colon = false;
        c.ellipsis = false;
        c.hyphen = false;
        c.openingBracket = false;
        c.singlequote = false;
        c.whitespace = false;
      }
      isInsideBrackets() {
        return this.context.openBrackets.length > 0;
      }
      pushBracket(b) {
        this.context.openBrackets.push(b);
      }
      popBracket() {
        const cb = this.getCurrentCloseBracket();
        this.context.openBrackets.pop();
        return cb;
      }
      getCurrentCloseBracket() {
        const ob = this.context.openBrackets[this.context.openBrackets.length - 1];
        return ob ? bracketChars.test(ob) ? bracketPairs[ob] : "" : null;
      }
      init() {
        const c = this.context;
        c.forceCaps = true;
        c.spaceNextWord = false;
        c.openBrackets = [];
        c.slurpExtraTitleInformation = false;
        this.resetContext();
        c.acronym = false;
        c.number = false;
        c.openedSingleQuote = false;
        c.numberSplitChar = null;
        c.numberSplitExpect = false;
      }
    }
    const preBracketSingleWordsList = ["acoustic", "airplay", "album", "alternate", "alternative", "ambient", "bit", "bonus", "censored", "chillout", "clean", "club", "composition", "cut", "dance", "dialogue", "dirty", "disc", "disco", "dub", "early", "explicit", "extended", "feat", "featuring", "ft", "instrumental", "live", "long", "loop", "main", "megamix", "mix", "official", "original", "piano", "radio", "rap", "rehearsal", "remixed", "remode", "rework", "reworked", "session", "short", "single", "studio", "take", "takes", "techno", "trance", "uncensored", "unknown", "untitled", "version", "video", "vocal", "with", "without"];
    const preBracketSingleWords = new RegExp("^(" + preBracketSingleWordsList.join("|") + ")$", "i");
    const isPrepBracketSingleWord = (w) => preBracketSingleWords.test(w);
    const lowerCaseBracketWordsList = ["a_cappella", "clubmix", "demo", "edit", "excerpt", "interlude", "intro", "karaoke", "maxi", "mono", "orchestral", "outro", "outtake", "outtakes", "quadraphonic", "reedit", "re_edit", "refix", "reinterpreted", "remake", "remaster", "remastered", "remix", "rmx", "reprise", "skit", "stereo", "unplugged", "vs"].concat(preBracketSingleWordsList);
    const lowerCaseBracketWords = new RegExp("^(" + lowerCaseBracketWordsList.join("|") + ")$", "i");
    const isLowerCaseBracketWord = (w) => w != null && lowerCaseBracketWords.test(w);
    const prepBracketWords = /^(?:cd|disk|12["”]|7["”]|a_cappella|re_edit)$/i;
    const isPrepBracketWord = (w) => w != null && (prepBracketWords.test(w) || isLowerCaseBracketWord(w));
    const isSentenceStopChar = (w) => w != null && /^[:.;?!/]$/.test(w);
    const isApostrophe = (w) => w != null && /^['’]$/.test(w);
    const isPunctuationChar = (w) => w != null && /^[:.;?!,]$/.test(w);
    const LOWER_CASE_WORDS = /^(a|an|and|as|at|but|by|da|de|di|fe|fi|for|in|ina|inna|n|nor|o|of|on|or|tha|the|to)$/;
    const LOWER_CASE_WORDS_TURKISH = /^(ve|ile|ya|veya|yahut|ki|mı|mi|mu|mü|mısın|musun|mudur|mıdır|midir|miyim|misin|misiniz|mısınız|müsün|müyüm|müsünüz|mıyım|muyum|musunuz|miyiz|mıyız|muyuz|müyüz|müdür)$/;
    const UPPER_CASE_WORDS = /^(dj|mc|tv|mtv|ep|lp|ymca|nyc|ny|ussr|usa|r&b|bbc|fm|bc|ac|dc|uk|bpm|ok|nba|rza|gza|odb|dmx|2xlc)$/;
    const ROMAN_NUMERALS = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
    const EXCLUDED_ROMAN_NUMERALS = /^(?:mi|mix)$/;
    const PREPROCESS_FIXLIST = [
      [/(^|\s)([({[])\s+($|\b)/i, "$2"],
      // spaces after opening brackets
      [/(\b|^)\s+([)}\]])($|\b)/i, "$2"],
      // spaces before closing brackets
      [/(\s|^|\()(\d+)''(\s|$)/i, '$2"'],
      // 12'' -> 12"
      [/(\s|^|\()(\d+)in(ch)?(\s|$)/i, '$2"'],
      // 12in -> 12"
      // combined words, put back together in post-processing
      [/(\b|^)a\s?c+ap+el+a(\b)/ig, "a_cappella"],
      [/(\b|^)oc\sremix(\b)/ig, "oc_remix"],
      [/(\b|^)re-edit(\b)/ig, "re_edit"],
      [/(\b|^)a\/k\/a(\b)/ig, "a_k_a_"],
      [/(\b|^)a\.k\.a\.(\s)/ig, "a_k_a_"]
    ];
    const POSTPROCESS_FIXLIST = [
      [/(\b|^)a_cappella(\b)/g, "a cappella"],
      [/(\b|^)A_cappella(\b)/g, "A Cappella"],
      [/(\b|^)oc_remix(\b)/ig, "OC ReMix"],
      [/(\b|^)re_edit(\b)/g, "re-edit"],
      [/(\b|^)Re_edit(\b)/g, "Re-Edit"],
      [/(\b|^)a_k_a_(\b|$)/ig, "a.k.a."],
      [/(\b|^)aka(\b|$)/ig, "aka"],
      [/(\b|^)Santa fe(\b|$)/g, "Santa Fe"],
      // "fe" is a lowercase word
      [/(\b|^)R\s*&\s*B(\b)/ig, "R&B"],
      [/(\b|^)\[live\](\b)/i, "(live)"],
      [/(\b|^)Djs(\b)/ig, "DJs"],
      [/(\b|^)imac(\b)/ig, "iMac"],
      [/(\b|^)ipad(\b)/ig, "iPad"],
      [/(\b|^)iphone(\b)/ig, "iPhone"],
      [/(\b|^)ipod(\b)/ig, "iPod"],
      [/(\b|^)itunes(\b)/ig, "iTunes"],
      [/(\b|^)tiktok(\b)/ig, "TikTok"],
      [/(\b|^)youtube(\b)/ig, "YouTube"],
      [/(\s|^)Rock '?n'? Roll(\s|$)/ig, "Rock 'n' Roll"],
      [/(\b)w([/／])o(\b)/i, "w$2o"],
      [/(\b)f([.．/／])(\b)/i, "f$2"]
    ];
    function replaceMatch(matches, inputString, regex, replacement) {
      const a = matches[1] || "";
      const b = matches[matches.length - 1] || "";
      return inputString.replace(regex, [a, replacement, b].join(""));
    }
    function runFixes(inputString, fixes) {
      let output = inputString;
      fixes.forEach(([regex, replacement]) => {
        let matches;
        if (regex.global) {
          let previousOutput;
          while (matches = regex.exec(output)) {
            previousOutput = output;
            output = replaceMatch(matches, output, regex, replacement);
            if (previousOutput === output) break;
          }
        } else {
          const m = output.match(regex);
          if (m !== null) output = replaceMatch(m, output, regex, replacement);
        }
      });
      return output;
    }
    function makeDefaultMode(opts) {
      return {
        doWord() {
          return false;
        },
        fixVinylSizes(s) {
          return s.replace(/(\s+|\()(7|10|12)(?:inch\b|in\b|'|''|")([^s]|$)/ig, '$1$2"$3').replace(/((?:\s+|\()(?:7|10|12)")([^),\s])/, "$1 $2");
        },
        isLowerCaseWord(w) {
          return LOWER_CASE_WORDS.test(w);
        },
        isRomanNumber(w) {
          return !!opts.romanUpper && ROMAN_NUMERALS.test(w) && !EXCLUDED_ROMAN_NUMERALS.test(w);
        },
        isSentenceCaps() {
          return true;
        },
        isUpperCaseWord(w) {
          return UPPER_CASE_WORDS.test(w);
        },
        name: "",
        // My Track Extended Dub remix => My Track (extended dub remix)
        prepExtraTitleInfo(words) {
          let outputWords = words;
          const lastWord = outputWords.length - 1;
          let wordIndex = lastWord;
          let handlePreProcess = false;
          while (wordIndex >= 0 && (outputWords[wordIndex] === " " || outputWords[wordIndex] === '"' && (outputWords[wordIndex - 1] === "7" || outputWords[wordIndex - 1] === "12") || (outputWords[wordIndex + 1] || "") === '"' && (outputWords[wordIndex] === "7" || outputWords[wordIndex] === "12") || isPrepBracketWord(outputWords[wordIndex]))) {
            handlePreProcess = true;
            wordIndex--;
          }
          if (wordIndex < lastWord) {
            wordIndex++;
            while (outputWords[wordIndex] === " " && wordIndex < lastWord) wordIndex++;
            const probe = outputWords[lastWord];
            if (wordIndex === lastWord && isPrepBracketSingleWord(probe)) handlePreProcess = false;
            if (handlePreProcess && wordIndex > 0 && wordIndex <= lastWord) {
              let newWords = outputWords.slice(0, wordIndex);
              if (newWords[wordIndex - 1] === "(") newWords.pop();
              if (newWords[wordIndex - 1] === "-") newWords.pop();
              newWords.push("(");
              newWords = newWords.concat(outputWords.slice(wordIndex, outputWords.length));
              newWords.push(")");
              outputWords = newWords;
            }
          }
          return outputWords;
        },
        preProcessTitles(s) {
          return runFixes(s, PREPROCESS_FIXLIST);
        },
        runPostProcess(s) {
          return runFixes(s, POSTPROCESS_FIXLIST);
        },
        toLowerCase(s) {
          return s.toLowerCase();
        },
        toUpperCase(s) {
          return s.toUpperCase();
        }
      };
    }
    const MODES = {
      English(D) {
        return {
          ...D,
          name: "English",
          isSentenceCaps() {
            return false;
          },
          runPostProcess(s) {
            return D.runPostProcess(s).replace(
              /\bin ([a-g])(?:[\s-]([Ff]lat|[Ss]harp))?\s(dorian|lydian|major|minor|mixolydian)(?:\b|$)/ig,
              (m, p1, p2, p3) => "in " + p1.toUpperCase() + (p2 ? "-" + p2.toLowerCase() : "") + " " + p3.toLowerCase()
            );
          }
        };
      },
      French(D) {
        return {
          ...D,
          name: "French",
          runPostProcess(s) {
            return D.runPostProcess(s).replace(/([!?;:]+)/gi, " $1").replace(/([«]+)/gi, "$1 ").replace(/([»]+)/gi, " $1").replace(/^(Le\s|La\s|Les\s|L[’'])(\S+)$/gi, (_, m1, m2) => m1.replace("'", "\u2019") + capitalize(m2));
          }
        };
      },
      Sentence(D) {
        return { ...D, name: "Sentence" };
      },
      // Ours: sentence case under the language's name. Their own lowercase words would change
      // nothing: sentence case lowercases every word but the forced ones, and a forced word
      // skips the lowercase list.
      Spanish(D) {
        return { ...D, name: "Spanish" };
      },
      Italian(D) {
        return { ...D, name: "Italian" };
      },
      Portuguese(D) {
        return { ...D, name: "Portuguese" };
      },
      // Dutch capitalises the IJ digraph as one letter: IJsland, IJzer
      Dutch(D) {
        return { ...D, name: "Dutch", runPostProcess(s) {
          return D.runPostProcess(s).replace(/(^|[^\p{L}\p{N}])Ij/gu, "$1IJ");
        } };
      },
      Turkish(D) {
        return {
          ...D,
          name: "Turkish",
          isSentenceCaps() {
            return false;
          },
          isLowerCaseWord(w) {
            return LOWER_CASE_WORDS.test(w) || LOWER_CASE_WORDS_TURKISH.test(w);
          },
          toLowerCase(w) {
            return w.replace(/İ/g, "i").replace(/I/g, "\u0131").replace(/İ/g, "i").toLowerCase();
          },
          toUpperCase(w) {
            return w.replace(/i/g, "\u0130").toUpperCase();
          }
        };
      }
    };
    function titleString(input, output, inputString, mode, keepUpper, forceCaps) {
      if (empty(inputString)) return "";
      const flags = input.flags;
      const localForceCaps = forceCaps == null ? flags.context.forceCaps : forceCaps;
      const len = input.getLength();
      let pos = input.getCursorPosition();
      if (pos === len) {
        pos = len - 1;
        input.setCursorPosition(pos);
      }
      let outputString;
      let lowercase = mode.toLowerCase(inputString);
      let uppercase = mode.toUpperCase(inputString);
      if (inputString === uppercase && inputString.length > 1 && keepUpper) {
        outputString = uppercase;
      } else if (lowercase.length === 1 && isApostrophe(input.getPreviousWord())) {
        outputString = lowercase;
      } else if (mode.name === "English" && isApostrophe(input.getPreviousWord()) && lowercase.match(/^(?:all|ve|ll|cha|re|mon)$/i)) {
        outputString = lowercase;
      } else if (mode.name === "English" && isApostrophe(input.getPreviousWord()) && input.getWordAtIndex(pos - 2) === "Ev") {
        outputString = lowercase;
      } else if (mode.name === "English" && lowercase.match(/^[coy]$/i) && isApostrophe(input.getNextWord())) {
        outputString = uppercase;
      } else {
        outputString = titleStringByMode(input, output, mode, lowercase, localForceCaps);
        lowercase = mode.toLowerCase(outputString);
        uppercase = mode.toUpperCase(outputString);
        const nextWord = input.getNextWord();
        const followedByPunctuation = nonEmpty(nextWord) && nextWord.length === 1 && isPunctuationChar(nextWord);
        const followedByApostrophe = nonEmpty(nextWord) && nextWord.length === 1 && isApostrophe(nextWord);
        if (!localForceCaps && mode.isLowerCaseWord(lowercase) && !followedByPunctuation) {
          outputString = lowercase;
        } else if (mode.isRomanNumber(lowercase) && !followedByApostrophe && !(flags.isInsideBrackets() && isLowerCaseBracketWord(lowercase))) {
          outputString = uppercase;
        } else if (mode.isUpperCaseWord(lowercase)) {
          outputString = uppercase;
        } else if (flags.isInsideBrackets() && isLowerCaseBracketWord(lowercase)) {
          outputString = lowercase;
        }
      }
      return outputString;
    }
    function titleStringByMode(input, output, mode, inputString, forceCaps) {
      if (empty(inputString)) return "";
      const flags = input.flags;
      let outputString = mode.toLowerCase(inputString);
      const opos = output.getLength();
      let wordBefore = "";
      if (opos > 1) wordBefore = output.getWordAtIndex(opos - 2);
      const doCaps = forceCaps || !mode.isSentenceCaps() || flags.context.slurpExtraTitleInformation || flags.context.openingBracket || input.isFirstWord() || isSentenceStopChar(wordBefore);
      if (doCaps) {
        const chars = outputString.split("");
        chars[0] = mode.toUpperCase(chars[0]);
        if (inputString.length > 2 && inputString.substring(0, 2) === "mc") chars[2] = mode.toUpperCase(chars[2]);
        outputString = chars.join("");
      }
      return outputString;
    }
    class Input {
      constructor(inputString, mode, keepUpper, regexes, flags) {
        this.keepUpper = keepUpper;
        this.mode = mode;
        this.regexes = regexes;
        this.flags = flags;
        this.source = inputString || "";
        this.wordList = [];
        this.wordIndex = 0;
      }
      init(wordlist, output) {
        this.output = output;
        this.wordList = wordlist || [];
      }
      getLength() {
        return this.wordList.length;
      }
      isEmpty() {
        return this.getLength() === 0;
      }
      getCursorPosition() {
        return this.wordIndex;
      }
      setCursorPosition(i) {
        if (i >= 0 && i < this.getLength()) this.wordIndex = i;
      }
      getWordAtIndex(i) {
        return this.wordList[i] || null;
      }
      getNextWord() {
        return this.getWordAtIndex(this.wordIndex + 1);
      }
      getCurrentWord() {
        return this.getWordAtIndex(this.wordIndex);
      }
      getPreviousWord() {
        return this.getWordAtIndex(this.wordIndex - 1);
      }
      isFirstWord() {
        return this.wordIndex === 0;
      }
      isLastWord() {
        return this.getLength() === this.wordIndex - 1;
      }
      isNextWord(w) {
        return this.hasMoreWords() && this.getNextWord() === w;
      }
      isPreviousWord(w) {
        return !this.isFirstWord() && this.getPreviousWord() === w;
      }
      matchCurrentWord(re) {
        return this.matchWordAtIndex(this.getCursorPosition(), re);
      }
      matchWordAtIndex(i, re) {
        const word = this.getWordAtIndex(i) || "";
        return typeof re === "string" ? re === word : word.match(re) != null;
      }
      hasMoreWords() {
        return this.wordIndex === 0 && this.getLength() > 0 || this.wordIndex - 1 < this.getLength();
      }
      isIndexAtEnd() {
        return this.wordIndex === this.getLength();
      }
      nextIndex() {
        this.wordIndex++;
      }
      dropLastWord() {
        if (this.getLength() > 0) {
          this.wordList.pop();
          if (this.isIndexAtEnd()) this.wordIndex--;
        }
      }
      insertWordsAtIndex(i, newWords) {
        this.wordList = this.wordList.slice(0, i).concat(newWords).concat(this.wordList.slice(i));
      }
      capitalizeCurrentWord() {
        const word = this.getCurrentWord();
        if (word == null) return null;
        const out = titleString(this, this.output, word, this.mode, this.keepUpper);
        if (word !== out) this.updateCurrentWord(out);
        return out;
      }
      updateCurrentWord(w) {
        if (this.wordIndex < this.wordList.length) this.wordList[this.wordIndex] = w;
      }
      // words, punctuation and spaces of the input
      splitWordsAndPunctuation(inputString) {
        const input = inputString.replace(/^\s\s*/, "").replace(/\s\s*$/, "").replace(/\s\s*/g, " ");
        const chars = input.split("");
        const splitwords = [];
        let word = [];
        if (!this.regexes.SPLITWORDSANDPUNCTUATION) this.regexes.SPLITWORDSANDPUNCTUATION = /[^!¿¡"%&'´`‘’‹›“”„“«»()[\]{}*+‐\-,./:;<=>?\s#]/;
        for (let i = 0; i < chars.length; i++) {
          if (chars[i].match(this.regexes.SPLITWORDSANDPUNCTUATION)) {
            word.push(chars[i]);
          } else {
            if (word.length > 0) splitwords.push(word.join(""));
            splitwords.push(chars[i]);
            word = [];
          }
        }
        if (word.length > 0) splitwords.push(word.join(""));
        return splitwords;
      }
    }
    class Output {
      constructor(input, mode, keepUpper, flags) {
        this.keepUpper = keepUpper;
        this.mode = mode;
        this.input = input;
        this.flags = flags;
        this.wordList = [];
      }
      getLength() {
        return this.wordList.length;
      }
      isEmpty() {
        return this.getLength() === 0;
      }
      appendCurrentWord() {
        const w = this.input.getCurrentWord();
        if (w != null) this.appendWord(w);
      }
      appendWord(w) {
        if (w === " ") this.appendSpace();
        else if (w !== "" && w != null) this.wordList.push(w);
      }
      appendSpace() {
        this.wordList.push(" ");
      }
      appendSpaceIfNeeded() {
        if (this.flags.context.spaceNextWord) this.appendSpace();
      }
      getWordAtIndex(i) {
        return this.wordList[i] ? this.wordList[i] : null;
      }
      setWordAtIndex(i, w) {
        if (this.getWordAtIndex(i)) this.wordList[i] = w;
      }
      getLastWord() {
        return this.isEmpty() ? null : this.wordList[this.wordList.length - 1];
      }
      capitalizeWordAtIndex(index, overrideCaps) {
        const flags = this.flags;
        const forceCaps = overrideCaps == null ? flags.context.forceCaps : overrideCaps;
        if ((!this.mode.isSentenceCaps() || forceCaps) && !this.isEmpty()) {
          const word = this.getWordAtIndex(index);
          if (word != null) {
            let output = word;
            if (word.match(/^\w\..*/) == null) {
              const probe = trim(word.toLowerCase());
              if (!forceCaps && flags.isInsideBrackets() && isLowerCaseBracketWord(probe)) {
              } else if (!forceCaps && this.mode.isUpperCaseWord(probe)) {
              } else {
                const originalPosition = this.input.getCursorPosition();
                let position = originalPosition - 1;
                while (position >= 0) {
                  const w = this.input.getWordAtIndex(position);
                  if (w == null || trim(w.toLowerCase()) === probe) break;
                  position--;
                }
                this.input.setCursorPosition(position);
                output = titleString(this.input, this, word, this.mode, this.keepUpper, forceCaps);
                this.input.setCursorPosition(originalPosition);
                if (word !== output) this.setWordAtIndex(index, output);
              }
            }
          }
        }
      }
      capitalizeLastWord(overrideCaps) {
        this.capitalizeWordAtIndex(this.getLength() - 1, overrideCaps);
      }
      getOutput() {
        this.flags.context.forceCaps = !this.mode.isSentenceCaps();
        this.capitalizeLastWord();
        this.closeOpenBrackets();
        return trim(this.wordList.join(""));
      }
      closeOpenBrackets() {
        const parts = [];
        while (this.flags.isInsideBrackets()) parts[parts.length] = this.flags.popBracket();
        this.appendWord(parts.join(""));
      }
      appendWordPreserveWhiteSpace(capitalizeLast) {
        const ws = { after: this.input.isNextWord(" "), before: this.input.isPreviousWord(" ") };
        if (capitalizeLast) this.capitalizeLastWord(!this.mode.isSentenceCaps());
        if (ws.before) this.appendSpace();
        this.appendCurrentWord();
        this.flags.context.spaceNextWord = ws.after;
      }
    }
    const SPECIAL3 = {
      NOT_A_SPECIALCASE: -1,
      SPECIALCASE_CROWD_NOISE: 33,
      SPECIALCASE_DATA_TRACK: 30,
      SPECIALCASE_DIALOGUE: 35,
      SPECIALCASE_GUITAR_SOLO: 34,
      SPECIALCASE_SILENCE: 31,
      SPECIALCASE_UNKNOWN: 10,
      SPECIALCASE_UNTITLED: 32
    };
    class Handler {
      constructor(mode, regexes, input, output, flags) {
        this.mode = mode;
        this.regexes = regexes;
        this.input = input;
        this.output = output;
        this.flags = flags;
        this.specialCaseValues = SPECIAL3;
      }
      checkSpecialCase() {
        return SPECIAL3.NOT_A_SPECIALCASE;
      }
      isSpecialCase(n) {
        return n !== SPECIAL3.NOT_A_SPECIALCASE;
      }
      getSpecialCaseFormatted(inputString, n) {
        switch (n) {
          case SPECIAL3.SPECIALCASE_DATA_TRACK:
            return "[data track]";
          case SPECIAL3.SPECIALCASE_SILENCE:
            return "[silence]";
          case SPECIAL3.SPECIALCASE_UNTITLED:
            return "[untitled]";
          case SPECIAL3.SPECIALCASE_UNKNOWN:
            return "[unknown]";
          case SPECIAL3.SPECIALCASE_CROWD_NOISE:
            return "[crowd noise]";
          case SPECIAL3.SPECIALCASE_GUITAR_SOLO:
            return "[guitar solo]";
          case SPECIAL3.SPECIALCASE_DIALOGUE:
            return "[dialogue]";
          default:
            return inputString;
        }
      }
      getWordsForProcessing(s) {
        return this.input.splitWordsAndPunctuation(s);
      }
      process(s) {
        this.input.init(this.getWordsForProcessing(s), this.output);
        while (!this.input.isIndexAtEnd()) this.processWord();
        return this.mode.runPostProcess(this.output.getOutput());
      }
      processWord() {
        if (!this.doWhiteSpace()) {
          let handled = false;
          if (!this.regexes.SPECIALCASES) this.regexes.SPECIALCASES = /(&|¿|¡|\?|!|;|:|'|‘|’|‹|›|"|“|”|„|“|«|»|-|‐|\+|,|\*|\.|#|%|\/|\(|\)|\{|\}|\[|\])/;
          if (this.input.matchCurrentWord(this.regexes.SPECIALCASES)) {
            handled = this.doDoubleQuote() || this.doSingleQuote() || this.doOpeningBracket() || this.doClosingBracket() || this.doComma() || this.doPeriod() || this.doLineStop() || this.doAmpersand() || this.doSlash() || this.doColon() || this.doHyphen() || this.doInvertedMarks() || this.doPlus() || this.doAsterisk() || this.doDiamond() || this.doPercent();
          }
          handled || this.doDigits() || this.doAcronym() || this.doWord();
        }
        this.input.nextIndex();
      }
      doWord() {
        return true;
      }
      doNormalWord() {
        const c = this.flags.context;
        this.output.appendSpaceIfNeeded();
        this.input.capitalizeCurrentWord();
        this.output.appendCurrentWord();
        this.flags.resetContext();
        c.forceCaps = false;
        c.spaceNextWord = true;
      }
      doWhiteSpace() {
        if (!this.regexes.WHITESPACE) this.regexes.WHITESPACE = /^ $/;
        if (this.input.matchCurrentWord(this.regexes.WHITESPACE)) {
          const c = this.flags.context;
          c.whitespace = true;
          c.spaceNextWord = true;
          if (c.openingBracket) c.spaceNextWord = false;
          return true;
        }
        return false;
      }
      // a sub-title split, also disc/box name splits
      doColon() {
        if (!this.regexes.COLON) this.regexes.COLON = /^:$/;
        if (this.input.matchCurrentWord(this.regexes.COLON)) {
          const c = this.flags.context;
          const featIndex = this.output.getLength() - 3;
          const role = this.output.getLastWord();
          if (c.slurpExtraTitleInformation && featIndex > 0 && this.output.getWordAtIndex(featIndex) === "feat." && nonEmpty(role)) {
            this.output.setWordAtIndex(this.output.getLength() - 1, role.toLowerCase());
          } else {
            this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
          }
          let skip = false;
          const cursorPosition = this.input.getCursorPosition();
          const length = this.input.getLength();
          if (cursorPosition < length - 2) {
            const nextWord = this.input.getWordAtIndex(cursorPosition + 1);
            const afterNextWord = this.input.getWordAtIndex(cursorPosition + 2);
            if (nextWord != null && nextWord.match(this.regexes.OPENBRACKET)) {
              skip = true;
              c.spaceNextWord = true;
            }
            if (this.input.isNextWord(" ") && afterNextWord != null && afterNextWord.match(this.regexes.OPENBRACKET)) {
              c.spaceNextWord = true;
              skip = true;
              this.input.nextIndex();
            }
          }
          if (!skip) {
            this.output.appendCurrentWord();
            this.flags.resetContext();
            c.forceCaps = true;
            c.colon = true;
            c.spaceNextWord = this.input.isNextWord(" ");
          }
          return true;
        }
        return false;
      }
      doPreserving(name, re) {
        if (!this.regexes[name]) this.regexes[name] = re;
        if (this.input.matchCurrentWord(this.regexes[name])) {
          this.output.appendWordPreserveWhiteSpace(true);
          this.flags.resetContext();
          return true;
        }
        return false;
      }
      doAsterisk() {
        return this.doPreserving("ASTERISK", /^\*$/);
      }
      doDiamond() {
        return this.doPreserving("DIAMOND", /^#$/);
      }
      doPercent() {
        return this.doPreserving("PERCENT", /^%$/);
      }
      doPlus() {
        return this.doPreserving("PLUS", /^\+$/);
      }
      doAmpersand() {
        if (!this.regexes.AMPERSAND) this.regexes.AMPERSAND = /^&$/;
        if (this.input.matchCurrentWord(this.regexes.AMPERSAND)) {
          this.flags.resetContext();
          this.flags.context.forceCaps = true;
          this.output.appendSpace();
          this.flags.context.spaceNextWord = true;
          this.output.appendCurrentWord();
          return true;
        }
        return false;
      }
      // ? ! ;
      doLineStop() {
        if (!this.regexes.LINESTOP) this.regexes.LINESTOP = /[?!;]/;
        if (this.input.matchCurrentWord(this.regexes.LINESTOP)) {
          this.flags.resetContext();
          this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
          this.flags.context.forceCaps = true;
          this.flags.context.spaceNextWord = true;
          this.output.appendCurrentWord();
          return true;
        }
        return false;
      }
      // a spaced hyphen is a pause, an unspaced one part of a word
      doHyphen() {
        if (!this.regexes.HYPHEN) this.regexes.HYPHEN = /^[-‐]$/;
        if (this.input.matchCurrentWord(this.regexes.HYPHEN)) {
          this.output.appendWordPreserveWhiteSpace(true);
          this.flags.resetContext();
          this.flags.context.forceCaps = !this.mode.isSentenceCaps();
          this.flags.context.hyphen = true;
          return true;
        }
        return false;
      }
      doInvertedMarks() {
        if (!this.regexes.INVERTEDMARKS) this.regexes.INVERTEDMARKS = /(¿|¡)/;
        if (this.input.matchCurrentWord(this.regexes.INVERTEDMARKS)) {
          this.output.appendWordPreserveWhiteSpace(false);
          this.flags.resetContext();
          this.flags.context.forceCaps = true;
          return true;
        }
        return false;
      }
      doSlash() {
        if (!this.regexes.SLASH) this.regexes.SLASH = /[\\/]/;
        if (this.input.matchCurrentWord(this.regexes.SLASH)) {
          this.output.appendWordPreserveWhiteSpace(true);
          this.flags.resetContext();
          this.flags.context.forceCaps = true;
          return true;
        }
        return false;
      }
      doDoubleQuote() {
        if (!this.regexes.DOUBLEQUOTE) this.regexes.DOUBLEQUOTE = /["“”„“«»]/;
        if (this.input.matchCurrentWord(this.regexes.DOUBLEQUOTE)) {
          this.output.appendWordPreserveWhiteSpace(false);
          this.flags.resetContext();
          this.flags.context.forceCaps = !this.input.isNextWord(" ");
          return true;
        }
        return false;
      }
      doSingleQuote() {
        if (!this.regexes.SINGLEQUOTE) this.regexes.SINGLEQUOTE = /['‘’‹›]/;
        if (this.input.matchCurrentWord(this.regexes.SINGLEQUOTE)) {
          const c = this.flags.context;
          c.forceCaps = false;
          const isPreviousSpace = this.input.isPreviousWord(" ");
          const isNextSpace = this.input.isNextWord(" ");
          const state = c.openedSingleQuote;
          if (isPreviousSpace && !isNextSpace) {
            this.output.appendSpace();
            c.openedSingleQuote = true;
            c.forceCaps = true;
          } else if (!isPreviousSpace && isNextSpace) {
            if (state) {
              c.forceCaps = true;
              c.openedSingleQuote = false;
            }
            this.output.capitalizeLastWord();
          }
          c.spaceNextWord = isNextSpace;
          this.output.appendCurrentWord();
          this.flags.resetContext();
          if (state === c.openedSingleQuote) c.forceCaps = false;
          c.singlequote = true;
          return true;
        }
        return false;
      }
      doOpeningBracket() {
        if (!this.regexes.OPENBRACKET) this.regexes.OPENBRACKET = /[([{<]/;
        const currentWord = this.input.getCurrentWord();
        if (currentWord != null && currentWord.match(this.regexes.OPENBRACKET)) {
          const c = this.flags.context;
          this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
          this.flags.pushBracket(currentWord);
          const closingBracket = this.flags.getCurrentCloseBracket();
          let forcelowercase = false;
          const cursorPosition = this.input.getCursorPosition() + 1;
          for (let i = cursorPosition; i < this.input.getLength(); i++) {
            const word = this.input.getWordAtIndex(i) || "";
            if (word !== " ") {
              if (isLowerCaseBracketWord(word) || word.match(/^featuring$|^ft$|^feat$/i) != null) {
                c.slurpExtraTitleInformation = true;
                if (i === cursorPosition) forcelowercase = true;
              }
              if (word === closingBracket) break;
            }
          }
          this.output.appendSpace();
          this.flags.resetContext();
          c.spaceNextWord = false;
          c.openingBracket = true;
          c.forceCaps = !forcelowercase;
          this.output.appendCurrentWord();
          return true;
        }
        return false;
      }
      doClosingBracket() {
        if (!this.regexes.CLOSEBRACKET) this.regexes.CLOSEBRACKET = /[)\]}>]/;
        if (this.input.matchCurrentWord(this.regexes.CLOSEBRACKET)) {
          const c = this.flags.context;
          this.output.capitalizeLastWord();
          if (this.flags.isInsideBrackets()) {
            this.flags.popBracket();
            c.slurpExtraTitleInformation = false;
          }
          this.flags.resetContext();
          c.forceCaps = !this.mode.isSentenceCaps();
          c.spaceNextWord = true;
          this.output.appendCurrentWord();
          return true;
        }
        return false;
      }
      doComma() {
        if (!this.regexes.COMMA) this.regexes.COMMA = /^,$/;
        if (this.input.matchCurrentWord(this.regexes.COMMA)) {
          if (this.output.getLastWord() !== ",") {
            this.flags.resetContext();
            this.flags.context.spaceNextWord = true;
            this.flags.context.forceCaps = false;
            this.output.appendCurrentWord();
          }
          return true;
        }
        return false;
      }
      // a full stop, a number split, an ellipsis or an acronym
      doPeriod() {
        if (!this.regexes.PERIOD) this.regexes.PERIOD = /^\.$/;
        if (this.input.matchCurrentWord(this.regexes.PERIOD)) {
          const c = this.flags.context;
          if (this.output.getLastWord() === ".") {
            if (!c.ellipsis) {
              this.output.appendWord("..");
              while (this.input.isNextWord(".")) this.input.nextIndex();
              this.flags.resetContext();
              c.ellipsis = true;
            }
            c.forceCaps = true;
            c.spaceNextWord = true;
          } else {
            if (!this.input.hasMoreWords() || this.input.getNextWord() !== ".") this.output.capitalizeLastWord();
            this.output.appendWord(".");
            this.flags.resetContext();
            c.forceCaps = true;
            c.spaceNextWord = this.input.isNextWord(" ");
          }
          return true;
        }
        return false;
      }
      // "A. B. C. I Love You" => "A.B.C. I Love You"
      doAcronym() {
        if (!this.regexes.ACRONYM) this.regexes.ACRONYM = /^\w$/;
        let subIndex = this.input.getCursorPosition() + 1;
        const tmp = [];
        const currentWord = this.input.getCurrentWord();
        if (currentWord != null && currentWord.match(this.regexes.ACRONYM)) {
          tmp.push(currentWord.toUpperCase());
          let expectWord = false;
          let gotPeriod = false;
          for (; subIndex < this.input.getLength(); ) {
            const wordAtIndex = this.input.getWordAtIndex(subIndex);
            if (expectWord && wordAtIndex != null && wordAtIndex.match(this.regexes.ACRONYM)) {
              tmp.push(wordAtIndex.toUpperCase());
              expectWord = false;
              gotPeriod = false;
            } else {
              if (wordAtIndex === "." && !gotPeriod) {
                tmp[tmp.length] = ".";
                gotPeriod = true;
                expectWord = true;
              } else if (gotPeriod && wordAtIndex === " ") {
                expectWord = true;
              } else if (tmp[tmp.length - 1] !== ".") {
                tmp.pop();
                subIndex--;
              }
              break;
            }
            subIndex++;
          }
        }
        if (tmp.length > 2) {
          const string = tmp.join("").replace(/(\.)*$/, ".");
          const c = this.flags.context;
          this.output.appendSpaceIfNeeded();
          this.output.appendWord(string);
          this.flags.resetContext();
          c.acronym = true;
          c.spaceNextWord = true;
          c.forceCaps = false;
          this.input.setCursorPosition(subIndex - 1);
          return true;
        }
        return false;
      }
      doDigits() {
        if (!this.regexes.DIGITS) {
          this.regexes.DIGITS = /^\d+$/;
          this.regexes.DIGITS_NUMBERSPLIT = /[,.]/;
          this.regexes.DIGITS_DUPLE = /^\d\d$/;
          this.regexes.DIGITS_TRIPLE = /^\d\d\d$/;
          this.regexes.DIGITS_NTUPLE = /^\d\d\d\d+$/;
        }
        const c = this.flags.context;
        let subIndex = this.input.getCursorPosition() + 1;
        const tmp = [];
        if (this.input.matchCurrentWord(this.regexes.DIGITS)) {
          tmp.push(this.input.getCurrentWord());
          c.numberSplitExpect = true;
          for (; subIndex < this.input.getLength(); ) {
            if (c.numberSplitExpect) {
              if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_NUMBERSPLIT)) {
                tmp.push(this.input.getWordAtIndex(subIndex));
                c.numberSplitExpect = false;
              } else {
                break;
              }
            } else if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_TRIPLE)) {
              if (c.numberSplitChar == null) c.numberSplitChar = tmp[tmp.length - 1];
              tmp.push(this.input.getWordAtIndex(subIndex));
              c.numberSplitExpect = true;
            } else {
              if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_DUPLE)) {
                if (tmp.length > 2 && c.numberSplitChar !== tmp[tmp.length - 1]) {
                  tmp.push(this.input.getWordAtIndex(subIndex++));
                } else {
                  tmp.pop();
                  subIndex--;
                }
              } else if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_NTUPLE)) {
                tmp.push(this.input.getWordAtIndex(subIndex++));
              } else {
                tmp.pop();
                subIndex--;
              }
              break;
            }
            subIndex++;
          }
          this.input.setCursorPosition(subIndex - 1);
          this.output.appendSpaceIfNeeded();
          this.output.appendWord(tmp.join(""));
          this.flags.resetContext();
          c.forceCaps = false;
          c.number = true;
          return true;
        }
        return false;
      }
      doIgnoreWords() {
        if (this.input.getCurrentWord() === "dB") {
          this.output.appendSpaceIfNeeded();
          this.output.appendCurrentWord();
          return true;
        }
        return false;
      }
      // featuring, f., ft[.], feat[.] → (feat. …)
      doFeaturingArtistStyle() {
        if (!this.regexes.FEAT) {
          this.regexes.FEAT = /^featuring$|^f$|^ft$|^feat$/i;
          this.regexes.FEAT_F = /^f$/i;
          this.regexes.FEAT_FEAT = /^feat$/i;
        }
        const flags = this.flags, c = flags.context;
        const currentWord = this.input.getCurrentWord();
        if (currentWord == null) return false;
        if (currentWord.match(this.regexes.FEAT)) {
          const nextWord = this.input.getNextWord();
          if (currentWord.match(this.regexes.FEAT_F) && nextWord != null && !nextWord.match(/^[/.]$/)) return false;
          if (this.input.getCursorPosition() < this.input.getLength() - 2) {
            const nw = this.input.getNextWord();
            const featWord = currentWord + (nw != null && (nw === "." || nw === "/") ? nw : currentWord.match(this.regexes.FEAT_FEAT) ? "." : "");
            if (!c.openingBracket && !flags.isInsideBrackets()) {
              if (flags.isInsideBrackets()) {
                while (flags.isInsideBrackets()) {
                  const cb = flags.popBracket();
                  this.output.appendWord(cb);
                  if (this.input.getWordAtIndex(this.input.getLength() - 1) === cb) this.input.dropLastWord();
                }
              }
              const cursorPosition = this.input.getCursorPosition();
              const length = this.input.getLength();
              let i = cursorPosition;
              for (; i < length; i++) if (this.input.getWordAtIndex(i) === "(") break;
              if (i !== cursorPosition && i < length - 1) this.input.insertWordsAtIndex(i, [")", " "]);
              this.input.updateCurrentWord("(");
              this.doOpeningBracket();
            } else {
              this.output.appendWord(" ");
            }
            this.output.appendWord(featWord);
            flags.resetContext();
            c.forceCaps = true;
            c.openingBracket = false;
            c.spaceNextWord = true;
            c.slurpExtraTitleInformation = true;
            if (this.input.isNextWord(".") || this.input.isNextWord("/")) this.input.nextIndex();
            return true;
          }
        }
        return false;
      }
      moveArticleToEnd(s) {
        return trim(s).replace(/^(The|Los) (.+)$/, (m, article, name) => name + ", " + article);
      }
      sortCompoundName(s, callback) {
        const t = trim(s);
        let joinPhrase = " and ";
        joinPhrase = t.indexOf(" + ") === -1 ? joinPhrase : " + ";
        joinPhrase = t.indexOf(" & ") === -1 ? joinPhrase : " & ";
        return t.split(joinPhrase).map((x) => callback(x, this.regexes)).join(joinPhrase);
      }
      // the word handling the track, release, work and area handlers share
      doTitleWord(ignoreWords, featuring) {
        ignoreWords && this.doIgnoreWords() || featuring && this.doFeaturingArtistStyle() || this.mode.doWord() || this.doNormalWord();
        this.flags.context.number = false;
        return true;
      }
      doNameWord() {
        const c = this.flags.context;
        this.output.appendSpaceIfNeeded();
        this.input.capitalizeCurrentWord();
        this.output.appendCurrentWord();
        this.flags.resetContext();
        c.number = false;
        c.forceCaps = false;
        c.spaceNextWord = true;
        return true;
      }
    }
    const UNTITLED = /^([([]?\s*untitled\s*[)\]]?)$/i;
    class TrackHandler extends Handler {
      removeBonusInfo(s) {
        return s.replace(/[([]?bonus(\s+track)?s?\s*[)\]]?$/i, "").replace(/[([]?retail(\s+version)?\s*[)\]]?$/i, "");
      }
      process(s) {
        return this.mode.fixVinylSizes(super.process(s));
      }
      getWordsForProcessing(s) {
        return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(this.removeBonusInfo(s))));
      }
      checkSpecialCase(s) {
        if (s != null) {
          if (/^([([]?\s*data(\s+track)?\s*[)\]]?$)/i.test(s)) return SPECIAL3.SPECIALCASE_DATA_TRACK;
          if (/^([([]?\s*(silen(t|ce)|blank)(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL3.SPECIALCASE_SILENCE;
          if (/^([([]?\s*untitled(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL3.SPECIALCASE_UNTITLED;
          if (/^([([]?\s*(unknown|bonus|hidden)(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL3.SPECIALCASE_UNKNOWN;
          if (/^\?+$/i.test(s)) return SPECIAL3.SPECIALCASE_UNKNOWN;
        }
        return SPECIAL3.NOT_A_SPECIALCASE;
      }
      doWord() {
        const c = this.flags.context;
        if (!this.doIgnoreWords() && !this.doFeaturingArtistStyle() && !this.mode.doWord()) {
          if (this.input.matchCurrentWord(/7in/i)) {
            this.output.appendSpaceIfNeeded();
            this.output.appendWord('7"');
            this.flags.resetContext();
            c.spaceNextWord = false;
            c.forceCaps = false;
          } else if (this.input.matchCurrentWord(/12in/i)) {
            this.output.appendSpaceIfNeeded();
            this.output.appendWord('12"');
            this.flags.resetContext();
            c.spaceNextWord = false;
            c.forceCaps = false;
          } else {
            this.output.appendSpaceIfNeeded();
            this.input.capitalizeCurrentWord();
            this.output.appendCurrentWord();
            this.flags.resetContext();
            c.spaceNextWord = true;
            c.forceCaps = false;
          }
        }
        c.number = false;
        return true;
      }
      guessSortName(s) {
        return this.moveArticleToEnd(s);
      }
    }
    class ReleaseHandler extends Handler {
      checkSpecialCase(s) {
        return s != null && UNTITLED.test(s) ? SPECIAL3.SPECIALCASE_UNTITLED : SPECIAL3.NOT_A_SPECIALCASE;
      }
      process(s) {
        return this.mode.fixVinylSizes(super.process(s));
      }
      getWordsForProcessing(s) {
        return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(s)));
      }
      doWord() {
        return this.doTitleWord(false, true);
      }
      guessSortName(s) {
        return this.moveArticleToEnd(s);
      }
    }
    class WorkHandler extends Handler {
      checkSpecialCase(s) {
        return s != null && UNTITLED.test(s) ? SPECIAL3.SPECIALCASE_UNTITLED : SPECIAL3.NOT_A_SPECIALCASE;
      }
      getWordsForProcessing(s) {
        return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(s)));
      }
      doWord() {
        return this.doTitleWord(true, true);
      }
      guessSortName(s) {
        return this.moveArticleToEnd(s);
      }
    }
    function noneCase(s, what) {
      if (s == null) return SPECIAL3.NOT_A_SPECIALCASE;
      const res = [
        /^\s*$/i,
        /^[([]?\s*Unknown\s*[)\]]?$/i,
        /^[([]?\s*none\s*[)\]]?$/i,
        new RegExp("^[([]?\\s*no[\\s-]+" + what + "\\s*[)\\]]?$", "i"),
        /^[([]?\s*not[\s-]+applicable\s*[)\]]?$/i,
        /^[([]?\s*n\s*[\\/]\s*a\s*[)\]]?$/i
      ];
      return res.some((re) => re.test(s)) ? SPECIAL3.SPECIALCASE_UNKNOWN : SPECIAL3.NOT_A_SPECIALCASE;
    }
    class ArtistHandler extends Handler {
      checkSpecialCase(s) {
        return noneCase(s, "artist");
      }
      doWord() {
        return this.doNameWord();
      }
      guessSortName(s, isPerson) {
        return this.sortCompoundName(s, (artistName) => {
          if (!artistName) return "";
          let name = trim(artistName);
          let append = "";
          if (/,\s*Sr\.?$/i.test(name)) {
            name = name.replace(/,\s*Sr\.?$/i, "");
            append = ", Sr.";
          } else if (/,\s*Jr\.?$/i.test(name)) {
            name = name.replace(/,\s*Jr\.?$/i, "");
            append = ", Jr.";
          }
          let names = name.split(" ");
          let reorder = false;
          const firstName = names[0];
          if (/^DJ$/i.test(firstName)) {
            append = ", DJ" + append;
            names.shift();
          } else if (/^The$/i.test(firstName)) {
            append = ", The" + append;
            names.shift();
          } else if (/^Los$/i.test(firstName)) {
            append = ", Los" + append;
            names.shift();
          } else if (/^Dr\.$/i.test(firstName)) {
            append = ", Dr." + append;
            names.shift();
            reorder = true;
          } else reorder = true;
          if (!isPerson) reorder = false;
          if (reorder) {
            const reordered = [];
            if (names.length > 1) {
              for (let i = 0; i < names.length - 1; i++) {
                if (i === names.length - 2 && names[i] === "St.") names[i + 1] = names[i] + " " + names[i + 1];
                else if (names[i]) reordered[i + 1] = names[i];
              }
              reordered[0] = names[names.length - 1];
              if (reordered.length > 1) reordered[0] += ",";
              names = reordered;
            }
          }
          return trim(names.filter(Boolean).join(" ") + (append || ""));
        });
      }
    }
    class LabelHandler extends Handler {
      checkSpecialCase(s) {
        return noneCase(s, "label");
      }
      doWord() {
        return this.doNameWord();
      }
      guessSortName(s) {
        return this.sortCompoundName(s, (x) => this.moveArticleToEnd(x));
      }
    }
    class AreaHandler extends Handler {
      doWord() {
        return this.doTitleWord(true, true);
      }
      guessSortName(s) {
        return trim(s);
      }
    }
    class PlaceHandler extends Handler {
      doWord() {
        return this.doTitleWord(true, false);
      }
      guessSortName(s) {
        return this.sortCompoundName(s, (x) => this.moveArticleToEnd(x));
      }
    }
    const HANDLERS = {
      area: AreaHandler,
      artist: ArtistHandler,
      event: WorkHandler,
      label: LabelHandler,
      place: PlaceHandler,
      recording: TrackHandler,
      release: ReleaseHandler,
      release_group: ReleaseHandler,
      series: WorkHandler,
      track: TrackHandler,
      work: WorkHandler
    };
    const MODE_NAMES = Object.keys(MODES);
    const LANGUAGE_MODES = { eng: "English", fra: "French", tur: "Turkish", spa: "Spanish", ita: "Italian", por: "Portuguese", nld: "Dutch" };
    const LANGUAGE_IDS = { 113: "nld", 120: "eng", 134: "fra", 195: "ita", 340: "por", 393: "spa", 433: "tur" };
    function modeFor(language) {
      if (language == null || language === "") return "English";
      const code = /^\d+$/.test(String(language)) ? LANGUAGE_IDS[language] : String(language).toLowerCase();
      return LANGUAGE_MODES[code] || "Sentence";
    }
    const VERSION_PHRASES = [
      "official lyric video",
      "official music video",
      "official video",
      "official visualizer",
      "official visualiser",
      "official audio",
      "kinetic lyric video",
      "lyric video",
      "lyrics video",
      "music video",
      "backing track",
      "animated",
      "animation",
      "super slowed",
      "extra slowed",
      "ultra slowed",
      "slowed down",
      "slowed",
      "super sped up",
      "sped up",
      "super speed up",
      "speed up",
      "low pitched",
      "reverb",
      "nightcore",
      "bootleg",
      "mashup",
      "flip"
    ];
    const wholeWord = (alternatives, flags) => new RegExp(String.raw`(?<![\p{L}\p{N}])(` + alternatives + String.raw`)(?![\p{L}\p{N}])`, flags);
    const VERSION_RE = wholeWord(VERSION_PHRASES.join("|"), "giu");
    const TITLE_ENTITIES = /* @__PURE__ */ new Set(["track", "recording", "release", "release_group", "work"]);
    function versionWords(out, keepUpper) {
      return out.replace(/([([［（【])([^()[\]［］（）【】]*)([)\]］）】])/g, (m, open, inner, close) => open + inner.replace(VERSION_RE, (w) => keepUpper && w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase() ? w : w.toLowerCase()) + close);
    }
    function camelCase(out, source) {
      const words = source.match(/[\p{L}\p{N}]+/gu) || [];
      for (const w of new Set(words.filter((x) => /\p{Ll}\p{Lu}/u.test(x)))) out = out.replace(wholeWord(escapeRegExp(w), "giu"), w);
      return out;
    }
    function run(method, s, o) {
      o = o || {};
      const entity = o.entity || "track";
      if (entity === "genre" || entity === "instrument") return String(s).toLowerCase();
      const H = HANDLERS[entity];
      if (!H) throw new Error("mbuGuessCase: unknown entity " + entity);
      const modeName = o.mode && MODES[o.mode] ? o.mode : modeFor(o.language);
      const mode = MODES[modeName](makeDefaultMode(o));
      const keepUpper = o.keepUpperCase !== false;
      const flags = new Flags();
      const regexes = { SERIES_NUMBER: /^(\d+|[ivx]+)$/i, SPACES_DOTS: /\s|\./i };
      const input = new Input(s, mode, keepUpper, regexes, flags);
      const output = new Output(input, mode, keepUpper, flags);
      const handler = new H(mode, regexes, input, output, flags);
      const num = handler.checkSpecialCase(s);
      if (handler.isSpecialCase(num)) return handler.getSpecialCaseFormatted(s, num);
      if (method === "guessSortName") return handler.guessSortName(s, !!o.isPerson);
      let out = handler.process(s);
      if (o.extras !== false && TITLE_ENTITIES.has(entity)) {
        out = versionWords(out, keepUpper);
        if (keepUpper) out = camelCase(out, s);
      }
      return out;
    }
    const count = (s, re) => (s.match(re) || []).length;
    const isCasedOther = (s) => count(s, /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}]/gu) > count(s, /\p{Script=Latin}/gu);
    function partMode(p, o) {
      if (isCasedOther(p)) return "Sentence";
      if (typeof o.detect !== "function" || !/\p{Script=Latin}/u.test(p)) return null;
      let lang = null;
      try {
        lang = o.detect(p);
      } catch (e) {
      }
      return lang ? modeFor(lang) : null;
    }
    function byScript(s, o) {
      const sep = o.separator == null ? "/" : String(o.separator);
      const parts = sep.trim() ? s.split(new RegExp(String.raw`(\s*` + escapeRegExp(sep.trim()) + String.raw`\s*)`)) : [s];
      const modes = parts.map((p, i) => i % 2 ? null : partMode(p, o));
      const opts = (m) => m ? Object.assign({}, o, { mode: m }) : o;
      const texts = modes.filter((m, i) => i % 2 === 0);
      if (texts.every((m) => m === texts[0])) return run("process", s, opts(texts[0]));
      return parts.map((p, i) => i % 2 ? p : run("process", p, opts(modes[i]))).join("");
    }
    function guessCase(title, opts) {
      const s = String(title == null ? "" : title), o = opts || {};
      if (!(o.mode && MODES[o.mode]) && o.byScript !== false && o.extras !== false && TITLE_ENTITIES.has(o.entity || "track")) return byScript(s, o);
      return run("process", s, o);
    }
    guessCase.sortName = (name, opts) => run("guessSortName", String(name == null ? "" : name), opts);
    guessCase.modeFor = modeFor;
    guessCase.modes = MODE_NAMES;
    return guessCase;
  })();
  var guess_case_default = mbuGuessCase;

  // src/mappers.js
  var INSTRUMENTS_CI = Object.fromEntries(
    Object.entries(INSTRUMENTS).map(([k, v]) => [k.toLowerCase(), v])
  );
  var BRACKET_REFINES = [
    [/^(electronic organ|organ)$/, /\b(b-?3|hammond)\b/i, "Hammond organ"],
    [/^electric piano$/, /\brhodes\b/i, "Rhodes piano"],
    [/^(guitar|acoustic guitar)$/, /\b(12|twelve)[- ]string\b/i, "12 string guitar"],
    [/^(guitar|acoustic guitar)$/, /\bnylon\b/i, "classical guitar"],
    [/^lute$/, /\b(tanpura|tambura)\b/i, "tambura"],
    [/^synthesizer$/, /\bmoog\b/i, "Moog"]
  ];
  var isBareInstrument = (r) => r.linkType === "instrument" && !(r.attributes || []).some((a) => a && a._type === "instrument");
  var guessSortName = (name) => guess_case_default.sortName(name, { entity: "artist", isPerson: true });
  function flattenTracklist(tracklist) {
    if (!Array.isArray(tracklist)) return [];
    return tracklist.flatMap((t) => {
      if (t?.type_ === "index" && Array.isArray(t.sub_tracks)) {
        const parentExtra = Array.isArray(t.extraartists) ? t.extraartists : [];
        if (!parentExtra.length) return t.sub_tracks;
        return t.sub_tracks.map((st) => Object.assign({}, st, {
          extraartists: [...Array.isArray(st.extraartists) ? st.extraartists : [], ...parentExtra]
        }));
      }
      return [t];
    });
  }
  function getAllArtistTracks(tracklist, artistTracks) {
    tracklist = flattenTracklist(tracklist);
    return artistTracks.split(",").reduce((trackArray, trackNumber) => {
      if (/ to /.test(trackNumber)) {
        const parts = trackNumber.split(" to ");
        const startTrack = parts[0].trim().replace(".", "-");
        const lastTrack = parts[1].trim().replace(".", "-");
        let hasFoundStart = false, hasFoundEnd = false;
        tracklist.forEach((track) => {
          const resolvedTrackPosition = track.position.replace(".", "-");
          if (!hasFoundStart && resolvedTrackPosition === startTrack) {
            hasFoundStart = true;
            trackArray.push(track);
          } else if (hasFoundStart && !hasFoundEnd) {
            if (resolvedTrackPosition === lastTrack) {
              hasFoundEnd = true;
              trackArray.push(track);
            } else if (track.position === "") {
              hasFoundEnd = true;
            } else {
              trackArray.push(track);
            }
          }
        });
      } else {
        const track = tracklist.find((track2) => {
          return track2.position === trackNumber.trim();
        });
        if (track) {
          trackArray.push(track);
        }
      }
      return trackArray;
    }, []);
  }
  function convertPotentialDJMixers(json) {
    const all = flattenTracklist(json.tracklist || []).filter((t) => t.type_ === "track");
    const djmixers = (json.extraartists || []).filter((artist) => artist.role === "DJ Mix" && artist.tracks).map((artist) => {
      const covered = new Set(getAllArtistTracks(json.tracklist, artist.tracks).map((t) => t.position));
      if (!all.length || !all.every((t) => covered.has(t.position))) return null;
      json.extraartists = json.extraartists.filter((a) => a !== artist);
      return Object.assign({}, ENTITY_TYPE_MAP["DJ Mix"], { artist });
    }).filter((role) => role !== null);
    return djmixers;
  }
  var MISC_GENERIC_ROLES = /* @__PURE__ */ new Set(["other", "crew", "miscellaneous support"]);
  function miscTask(role, bracket) {
    const r = role.trim().toLowerCase();
    const b = (bracket || "").replace(/]/g, "").trim().toLowerCase();
    if (!b) return r;
    if (MISC_GENERIC_ROLES.has(r)) return b;
    const stem = r.replace(/\s+by$/, "").slice(0, 5);
    if (b.includes(stem)) return b;
    if (/^(for|at|of|with|on|in|from|to|by)\b/.test(b)) return `${r} ${b}`;
    return `${b} ${r.replace(/\s+by$/, "")}`;
  }
  var withSourceRole = (role, mapped) => mapped ? Object.assign(mapped, { sourceRole: role.trim() }) : mapped;
  function getArtistRoles(artist) {
    const roleStr = artist.role;
    const rawRoles = roleStr.split(",");
    if (/\([0-9]+\)/.test(artist.anv)) {
      artist.anv = artist.anv.replace(/\([0-9]+\)/, "").trim();
    }
    if (/\([0-9]+\)/.test(artist.name)) {
      artist.name = artist.name.replace(/\([0-9]+\)/, "").trim();
    }
    return rawRoles.map((role) => withSourceRole(role, (() => {
      let additionalAttributes = [];
      let creditedAs = null;
      let rolePart = role.trim().split("[");
      const actualRole = rolePart[0].trim();
      if (/Recording Engineer/.test(rolePart[1]) && actualRole === "Engineer") {
        return Object.assign({}, ENTITY_TYPE_MAP["Recording Engineer"], {
          artist
        });
      }
      if (/Mastering Engineer/.test(rolePart[1]) && actualRole === "Engineer") {
        return Object.assign({}, ENTITY_TYPE_MAP["Mastered By"], {
          artist
        });
      }
      if (/Cover Design/.test(rolePart[1]) && actualRole === "Artwork") {
        return Object.assign({}, ENTITY_TYPE_MAP["Design"], {
          artist
        });
      }
      if (/Design/.test(rolePart[1]) && actualRole === "Cover") {
        return Object.assign({}, ENTITY_TYPE_MAP["Design"], {
          artist
        });
      }
      if (/Art/.test(rolePart[1]) && actualRole === "Cover") {
        return Object.assign({}, ENTITY_TYPE_MAP["Artwork"], {
          artist
        });
      }
      if (actualRole === "Coordinator" && /^\s*production(\s+coordinat(or|ion))?\s*\]?\s*$/i.test(rolePart[1] || "")) {
        return Object.assign({}, ENTITY_TYPE_MAP["Production Coordinator"], {
          artist
        });
      }
      if (/Additional/.test(rolePart[1])) {
        additionalAttributes.push("additional");
      }
      if (/Assistant/.test(rolePart[1])) {
        additionalAttributes.push("assistant");
      }
      if (/Co /.test(rolePart[1])) {
        additionalAttributes.push("additional");
      }
      if (/Executive/.test(rolePart[1])) {
        additionalAttributes.push("executive");
      }
      if (/Associate/.test(rolePart[1])) {
        additionalAttributes.push("associate");
      }
      if (/Guest/.test(rolePart[1])) {
        additionalAttributes.push("guest");
      }
      if (/Solo/.test(rolePart[1])) {
        additionalAttributes.push("solo");
      }
      const mapping = ENTITY_TYPE_MAP[actualRole];
      if (mapping && mapping.linkType == "misc") {
        additionalAttributes.push({ _type: "task", value: miscTask(actualRole, rolePart[1]) });
      }
      if (mapping && mapping.linkType == "engineer" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "mix" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "photography" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "artwork" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "vocal" && rolePart[1]) {
        creditedAs = rolePart[1].replace(/]/g, "").trim() || null;
      }
      const actualRoleLc = actualRole.toLowerCase();
      if (!mapping && Object.prototype.hasOwnProperty.call(INSTRUMENTS_CI, actualRoleLc)) {
        let instrumentName = INSTRUMENTS_CI[actualRoleLc];
        let role2 = ENTITY_TYPE_MAP.Instruments;
        if (actualRoleLc === "drum programming") {
          role2 = ENTITY_TYPE_MAP["Programmed By"];
          instrumentName = INSTRUMENTS_CI["drum machine"];
        }
        const bracket = rolePart[1] ? rolePart[1].replace(/]/g, "").trim() : "";
        if (instrumentName && bracket) {
          const ref = BRACKET_REFINES.find(([base, re]) => base.test(instrumentName.toLowerCase()) && re.test(bracket));
          if (ref) instrumentName = ref[2];
        }
        if (!instrumentName && bracket) {
          const noSolo = bracket.replace(/\s*\bsolos?\b\s*/ig, " ").trim();
          for (const candidate of [bracket, bracket.split(",")[0].trim(), noSolo]) {
            const lc = candidate.toLowerCase();
            if (lc && Object.prototype.hasOwnProperty.call(INSTRUMENTS_CI, lc) && INSTRUMENTS_CI[lc]) {
              instrumentName = INSTRUMENTS_CI[lc];
              break;
            }
          }
        }
        const extra = additionalAttributes.filter((a) => a === "solo" || a === "guest" || a === "additional");
        return Object.assign({}, role2, {
          artist,
          attributes: (instrumentName ? [{ _type: "instrument", value: instrumentName.toLowerCase() }] : []).concat(extra)
        });
      }
      if (!mapping) {
        return null;
      }
      if (Array.isArray(mapping.attributes)) {
        let mapped = mapping.attributes;
        if (creditedAs && mapping.linkType === "vocal") {
          mapped = mapped.map((a) => a && a._type === "vocal" ? Object.assign({}, a, { creditedAs }) : a);
        }
        additionalAttributes = additionalAttributes.concat(mapped);
      }
      return Object.assign({}, mapping, {
        artist,
        attributes: additionalAttributes
      });
    })())).filter((resolvedRole) => {
      return !!resolvedRole;
    }).filter((r, i, all) => !isBareInstrument(r) || !all.some((o) => o.linkType === "vocal" || o.linkType === "instrument" && !isBareInstrument(o)));
  }
  var ARTWORK_LINK_TYPES = /* @__PURE__ */ new Set(["artwork", "design", "photography", "illustration", "graphic design"]);
  function hoistFullSpanArtworkRels(artistRoles, tracklistRels, tracklist) {
    const allPos = new Set((tracklist || []).map((t) => String(t && t.position != null ? t.position : "")).filter(Boolean));
    if (!allPos.size) return { artistRoles, tracklistRels, hoisted: [] };
    const keyOf = (r) => [
      r.artist && (r.artist.resource_url || r.artist.name) || "",
      r.linkType,
      JSON.stringify((r.attributes || []).map((a) => a && typeof a === "object" && a._type ? a._type + ":" + a.value : String(a)).sort())
    ].join("|");
    const groups = /* @__PURE__ */ new Map();
    for (const r of tracklistRels) {
      if (!ARTWORK_LINK_TYPES.has(r.linkType) || !r.artist) continue;
      const k = keyOf(r);
      if (!groups.has(k)) groups.set(k, { rels: [], pos: /* @__PURE__ */ new Set() });
      const g = groups.get(k);
      g.rels.push(r);
      if (r.track && r.track.position != null) g.pos.add(String(r.track.position));
    }
    const drop = /* @__PURE__ */ new Set(), hoisted = [];
    for (const g of groups.values()) {
      if (g.pos.size !== allPos.size || ![...allPos].every((p) => g.pos.has(p))) continue;
      g.rels.forEach((r) => drop.add(r));
      const rel = Object.assign({}, g.rels[0]);
      delete rel.track;
      hoisted.push(rel);
    }
    if (!hoisted.length) return { artistRoles, tracklistRels, hoisted };
    return { artistRoles: artistRoles.concat(hoisted), tracklistRels: tracklistRels.filter((r) => !drop.has(r)), hoisted };
  }
  function rolesFromDiscogsArtists(artists) {
    return artists?.reduce((rolesArr, artist) => {
      const roles = getArtistRoles(artist);
      if (Array.isArray(roles) && roles.length > 0) {
        return rolesArr.concat(roles);
      }
      return rolesArr;
    }, []) || [];
  }

  // ../../dev/match/artist-match.mjs
  var MBM_EXACT_LIMIT = 100;
  var MBM_SPECIAL_PURPOSE = [
    "125ec42a-7229-4250-afc5-e057484327fe",
    // [unknown]
    "f731ccc4-e22a-43af-a747-64213329e088",
    // [anonymous]
    "33cf029c-63b0-41a0-9855-be2a3665fb3b",
    // [data]
    "314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc",
    // [dialogue]
    "eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61",
    // [no artist]
    "9be7f096-97ec-4615-8957-8d40b5dcbc41",
    // [traditional]
    "89ad4ac3-39f7-470e-963a-56509c546377",
    // Various Artists
    "7e84f845-ac16-41fe-9ff8-df12eb32af55",
    // MusicBrainz Test Artist
    "66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49",
    // [Disney]
    "a0ef7e1d-44ff-4039-9435-7d5fefdeecc9",
    // [theatre]
    "90068d37-bae7-4292-be4a-704c145bd616",
    // [church chimes]
    "80a8851f-444c-4539-892b-ad2a49292aa9"
    // [language instruction]
  ];
  function mbmFold(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[‐‑‒–—―−]/g, "-").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function mbmFoldKeepCase(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[‐‑‒–—―−]/g, "-").replace(/\s+/g, " ").trim();
  }
  function mbmSameName(a, b) {
    return mbmFold(a) === mbmFold(b) && mbmFold(a) !== "";
  }
  function mbmSameNameCase(a, b) {
    return mbmFoldKeepCase(a) === mbmFoldKeepCase(b) && mbmFoldKeepCase(a) !== "";
  }
  function mbmHolds(entity, name, caseExact) {
    if (!entity) return null;
    const same = caseExact ? mbmSameNameCase : mbmSameName;
    if (same(entity.name, name)) return "name";
    if ((entity.aliases || []).some((al) => same(al && (al.name != null ? al.name : al), name))) return "alias";
    return null;
  }
  function mbmIdentityQuery(name, field) {
    const q = String(name == null ? "" : name).replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
    return q ? 'alias:"' + q + '" OR ' + (field || "artist") + ':"' + q + '"' : "";
  }
  function mbmExactIdentity(json, name, opts) {
    const o = opts || {};
    if (!json || typeof json !== "object") return { status: "failed", exact: [] };
    const list = json.artists || json.labels || json.places || [];
    let exact = list.filter((e) => mbmHolds(e, name));
    if (exact.length > 1) {
      const caseExact = exact.filter((e) => mbmHolds(e, name, true));
      if (caseExact.length === 1) exact = caseExact;
      else if (o.scoreGap) {
        const scored = exact.filter((e) => typeof e.score === "number").sort((a, b) => b.score - a.score);
        if (scored.length >= 2 && scored[0].score - scored[1].score >= o.scoreGap) exact = [scored[0]];
      }
    }
    const offset = typeof json.offset === "number" ? json.offset : 0;
    const complete = typeof json.count === "number" && json.count <= offset + list.length;
    if (exact.length === 1 && complete) return { status: "unique", hit: exact[0], via: mbmHolds(exact[0], name) === "name" ? "name" : "alias", exact, complete };
    if (exact.length > 1) return { status: "ambiguous", exact, complete };
    if (!complete) return { status: "incomplete", exact, complete };
    return { status: "none", exact, complete };
  }
  function mbmRelatedArtists(artistJson) {
    if (!artistJson || !artistJson.id) return [];
    const out = [{ gid: artistJson.id, name: artistJson.name || "", aliases: (artistJson.aliases || []).map((a) => a && a.name).filter(Boolean), rel: "self" }];
    for (const r of artistJson.relations || []) {
      const a = r && r.artist;
      if (!a || !a.id || out.some((x) => x.gid === a.id)) continue;
      out.push({ gid: a.id, name: a.name || "", aliases: [], rel: r.type || "" });
    }
    return out;
  }
  function mbmContextHolders(related, name, candidates) {
    const cand = new Map((candidates || []).map((c) => [c.id || c.gid, c]));
    const out = [];
    for (const r of related || []) {
      let via = mbmSameName(r.name, name) ? "name" : (r.aliases || []).some((a) => mbmSameName(a, name)) ? "alias" : null;
      if (!via) {
        const c = cand.get(r.gid);
        if (c && mbmHolds(c, name)) via = mbmHolds(c, name);
      }
      if (via && !out.some((x) => x.gid === r.gid)) out.push({ gid: r.gid, name: r.name, via, rel: r.rel });
    }
    return out;
  }
  function mbmCoCreditHits(recordingsJson, ctxGid, name) {
    const out = [];
    for (const rec of recordingsJson && recordingsJson.recordings || []) {
      for (const c of rec["artist-credit"] || []) {
        const a = c && c.artist;
        if (!a || !a.id || a.id === ctxGid) continue;
        if ((mbmSameName(c.name, name) || mbmSameName(a.name, name)) && !out.some((x) => x.gid === a.id)) out.push({ gid: a.id, name: a.name });
      }
    }
    return out;
  }

  // src/sources/split-names.js
  function splitCombinedNames(name) {
    if (!name || !/[,&]/.test(name)) return [name];
    const parts = name.split(/\s*,\s*|\s*&\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2 || !parts.every((p) => /\s/.test(p))) return [name];
    return parts;
  }

  // src/util.js
  function assignVolumePositions(items, getNum) {
    const nums = items.map((it) => String(getNum(it) || "").trim());
    const multiVolume = nums.some((n, i) => n && nums.indexOf(n) < i);
    let vol = 1;
    const seenInVol = /* @__PURE__ */ new Set();
    const positions = nums.map((num) => {
      if (multiVolume && num && seenInVol.has(num)) {
        vol++;
        seenInVol.clear();
      }
      if (num) seenInVol.add(num);
      return multiVolume ? `${vol}-${num}` : num;
    });
    return { positions, multiVolume };
  }
  function noPasswordManagers(el) {
    if (!el) return el;
    el.autocomplete = "off";
    el.setAttribute("data-lpignore", "true");
    el.setAttribute("data-1p-ignore", "true");
    el.setAttribute("data-bwignore", "true");
    el.setAttribute("data-form-type", "other");
    if (el.tagName === "INPUT" && (!el.type || el.type === "text")) el.type = "search";
    el.classList.add("ch-nopw");
    return el;
  }
  function hashKey(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // src/sources/tidal.js
  var TIDAL_PERTRACK_BRIDGE = {
    "Vocal": "Vocals",
    "Background Vocal": "Backing Vocals",
    "Performance Arranger": "Arranged By"
  };
  var TIDAL_PERTRACK_SKIP = /* @__PURE__ */ new Set(["Mastering Engineer", "Associated Performer", "Studio Personnel"]);
  var TIDAL_ROLE_MAP = {
    "Producer": { target: "recording", rel: "producer" },
    "Remixer": { target: "recording", rel: "remixer" },
    // #257 artist→recording remixer (was unrecognized → dropped)
    "Mixing Engineer": { target: "recording", rel: "mix" },
    "Recording Engineer": { target: "recording", rel: "recording" },
    "Sound Engineer": { target: "recording", rel: "sound engineer" },
    "Lead Vocalist": { target: "recording", rel: "vocal", attributes: [{ _type: "vocal", value: "lead vocals" }] },
    // #257
    // #266 Tidal's per-track background-vocal roles → recording vocal[background vocals]
    // (same MB attribute as the release-level "Backing Vocals", see entity-map.js).
    "Group Background Vocalists": { target: "recording", rel: "vocal", attributes: [{ _type: "vocal", value: "background vocals" }] },
    "Background Vocalist": { target: "recording", rel: "vocal", attributes: [{ _type: "vocal", value: "background vocals" }] },
    "Background Vocalists": { target: "recording", rel: "vocal", attributes: [{ _type: "vocal", value: "background vocals" }] },
    "Composer": { target: "work", rel: "composer" },
    "Lyricist": { target: "work", rel: "lyricist" },
    "Writer": { target: "work", rel: "writer" },
    "Orchestrator": { target: "work", rel: "orchestrator" },
    "Music Publisher": { target: "work", rel: "publisher" },
    "Publisher": { target: "work", rel: "publisher" }
    // Not mapped (reported, not imported): Mastering Engineer (artist→recording mastering
    // is deprecated in MB — it's release-level), Sound Editor, the Assistant * Engineer
    // variants (need an MB "assistant" attribute), and Studio Personnel (too generic).
  };
  var TIDAL_COPYRIGHT_CONTROL_ID = "15780";
  var isCopyrightControl = (n) => n?.tidalId === TIDAL_COPYRIGHT_CONTROL_ID || /^copyright control$/i.test(n?.name || "");
  var TIDAL_RELEASE_ROLE_MAP = {
    "Mixing": "Mixed By",
    "Mixing Engineer": "Mixed By",
    "Recording": "Recorded By",
    "Recording Engineer": "Recorded By",
    "Sound Engineer": "sound engineer",
    "Mastering": "Mastered By",
    "Mastering Engineer": "Mastered By",
    "Vocals (Background)": "Backing Vocals",
    "Background Vocals": "Backing Vocals",
    "Composer": "Composed By",
    "Lyricist": "Lyrics By",
    "Writer": "Written-By",
    "Orchestrator": "Orchestrated By",
    // #325 instrument-name variants Tidal uses that the INSTRUMENTS table doesn't
    // match verbatim (plurals / qualified forms) → canonical Discogs instrument names.
    "Guitars": "Guitar",
    "Bass Instrument": "Bass",
    "Bass Guitars": "Bass Guitar",
    "Sax (Alto)": "Alto Saxophone",
    "Sax (Tenor)": "Tenor Saxophone",
    "Sax (Baritone)": "Baritone Saxophone",
    "Sax (Soprano)": "Soprano Saxophone",
    "Keyboard": "Keyboards"
  };
  var TIDAL_RELEASE_COMPANY_MAP = {
    "Current Distributor": "Distributed By",
    "Distributor": "Distributed By"
  };
  var TIDAL_RELEASE_ROLE_SKIP = /* @__PURE__ */ new Set([
    "Primary Artist",
    "Featured Artist",
    "Main Artist",
    "Artist",
    "Record Label",
    "Manufacturer",
    "Copyright",
    "Phonographic Copyright"
  ]);
  var TIDAL_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/i;
  function parseTidalAlbumUrl(url) {
    const m = TIDAL_ALBUM_RE.exec(url || "");
    if (!m) return null;
    return { id: m[1], creditsUrl: `https://tidal.com/album/${m[1]}/credits` };
  }
  function extractTidalCreditsDom(doc) {
    const out = [];
    for (const item of doc.querySelectorAll('[data-test="album-info-item"]')) {
      const num = item.querySelector('[class*="_trackNumber"]')?.textContent?.trim() || "";
      const titleEl = item.querySelector('[class*="_title_"]');
      const credits = [];
      for (const cell of item.querySelectorAll('[class*="_creditsCell"]')) {
        const role = cell.querySelector("[data-uppercase]")?.textContent?.trim();
        if (!role) continue;
        const names = [...cell.querySelectorAll('[data-test="grid-item-detail-text-title-artist"]')].map((el) => ({
          name: el.getAttribute("title") || el.textContent.trim(),
          tidalId: (el.getAttribute("href") || "").match(/\/artist\/(\d+)/)?.[1] || null
        })).filter((n) => n.name);
        credits.push({ role, names });
      }
      out.push({
        num,
        title: titleEl?.getAttribute("title") || titleEl?.textContent?.trim() || "",
        tidalTrackId: titleEl?.getAttribute("data-test-id") || null,
        credits
      });
    }
    return out;
  }
  function extractTidalReleaseCreditsDom(doc) {
    const out = [];
    for (const cell of doc.querySelectorAll('[class*="_creditsCell"]')) {
      if (cell.closest('[data-test="album-info-item"]')) continue;
      const role = cell.querySelector("[data-uppercase]")?.textContent?.trim();
      if (!role) continue;
      const names = [];
      const seen = /* @__PURE__ */ new Set();
      const textBox = cell.querySelector('[class*="_creditsCellText"]') || cell;
      for (const el of textBox.querySelectorAll("a, [title]")) {
        const name = (el.getAttribute("title") || el.textContent || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push({ name, tidalId: (el.getAttribute("href") || "").match(/\/artist\/(\d+)/)?.[1] || null });
      }
      if (!names.length) {
        (textBox.textContent || "").split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean).forEach((name) => {
          if (!seen.has(name)) {
            seen.add(name);
            names.push({ name, tidalId: null });
          }
        });
      }
      if (names.length) out.push({ role, names });
    }
    return out;
  }
  var ASSISTANT_RE = /^Assistant\s+(.+)$/i;
  function tidalRoleBase(role) {
    const m = ASSISTANT_RE.exec(role || "");
    return m ? m[1] : role;
  }
  function filterTidalCredits(tracks) {
    return tracks.map((t) => ({
      ...t,
      credits: t.credits.map((c) => ({
        ...c,
        names: c.names.filter((n) => !(/^(?:Music )?Publisher$/.test(c.role) && isCopyrightControl(n)))
      })).filter((c) => c.names.length)
    }));
  }
  var TIDAL_ARTIST_RE = /^(?:https?:)?\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?artist\/(\d+)/i;
  function parseTidalArtistUrl(url) {
    const m = TIDAL_ARTIST_RE.exec(url || "");
    if (!m) return null;
    return { id: m[1], key: `tidal-artist/${m[1]}`, cleanUrl: `https://tidal.com/artist/${m[1]}` };
  }
  function tidalPublisherRole(name, track) {
    const role = {
      linkType: "publishing",
      entityType: "label",
      attributes: [],
      artist: { name, anv: "", entityType: "label", resource_url: "https://tidal.com/_publisher/" + encodeURIComponent(name) }
    };
    if (track) role.track = track;
    return role;
  }
  function tidalCompany(name, entityTypeName) {
    return {
      entity_type_name: entityTypeName,
      name,
      resource_url: "https://tidal.com/_company/" + encodeURIComponent(entityTypeName) + "/" + encodeURIComponent(name)
    };
  }
  function tidalToEngine(tracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const filtered = filterTidalCredits(tracks);
    const { positions, multiVolume } = assignVolumePositions(filtered, (t) => t.num);
    filtered.forEach((t, i) => {
      const track = { position: positions[i], title: t.title || "", type_: "track" };
      tracklist.push(track);
      for (const c of t.credits) {
        const base = tidalRoleBase(c.role);
        const assistant = base !== c.role;
        if (base === "Music Publisher" || base === "Publisher") {
          for (const n of c.names) {
            if (isCopyrightControl(n)) continue;
            tracklistRels.push(tidalPublisherRole(n.name, track));
          }
          continue;
        }
        const names = c.names.flatMap((n) => {
          const parts = splitCombinedNames(n.name);
          return parts.length > 1 ? parts.map((nm) => ({ name: nm, tidalId: null })) : [n];
        });
        const mapping = TIDAL_ROLE_MAP[base];
        if (mapping) {
          for (const n of names) {
            tracklistRels.push({
              linkType: mapping.rel,
              entityType: "artist",
              attributes: [...mapping.attributes || [], ...assistant ? ["assistant"] : []],
              artist: {
                id: n.tidalId ? `tidal-${n.tidalId}` : void 0,
                name: n.name,
                anv: "",
                resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : ""
              },
              track
            });
          }
          continue;
        }
        if (TIDAL_PERTRACK_SKIP.has(base)) {
          for (const n of names) skipped.push(`track ${track.position} "${t.title}": ${c.role} \u2014 ${n.name}`);
          continue;
        }
        const discogsRole = TIDAL_PERTRACK_BRIDGE[base] || base;
        for (const n of names) {
          const artist = {
            id: n.tidalId ? `tidal-${n.tidalId}` : void 0,
            name: n.name,
            anv: "",
            role: discogsRole,
            resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : ""
          };
          const rels = getArtistRoles(artist);
          if (!rels.length) {
            skipped.push(`track ${track.position} "${t.title}": ${c.role} \u2014 ${n.name}`);
            continue;
          }
          for (const r of rels) {
            tracklistRels.push({
              linkType: r.linkType,
              entityType: "artist",
              attributes: [...r.attributes || [], ...assistant ? ["assistant"] : []],
              artist: r.artist,
              track
            });
          }
        }
      }
    });
    return { tracklistRels, tracklist, skipped, multiVolume };
  }
  function tidalReleaseArtists(releaseCredits) {
    const artists = [];
    const publishers = [];
    const companies = [];
    const skipped = [];
    for (const c of releaseCredits || []) {
      const baseRole = tidalRoleBase(c.role);
      if (baseRole === "Music Publisher" || baseRole === "Publisher") {
        for (const n of c.names || []) {
          if (isCopyrightControl(n)) continue;
          publishers.push(tidalPublisherRole(n.name));
        }
        continue;
      }
      if (TIDAL_RELEASE_COMPANY_MAP[c.role]) {
        for (const n of c.names || []) companies.push(tidalCompany(n.name, TIDAL_RELEASE_COMPANY_MAP[c.role]));
        continue;
      }
      if (TIDAL_RELEASE_ROLE_SKIP.has(c.role)) {
        (c.names || []).forEach((n) => skipped.push(`release: ${c.role} \u2014 ${n.name}`));
        continue;
      }
      const base = tidalRoleBase(c.role);
      const assistant = base !== c.role;
      const discogsRole = TIDAL_RELEASE_ROLE_MAP[base] || base;
      const relNames = (c.names || []).flatMap((n) => {
        const parts = splitCombinedNames(n.name);
        return parts.length > 1 ? parts.map((nm) => ({ name: nm, tidalId: null })) : [n];
      });
      for (const n of relNames) {
        artists.push({
          id: n.tidalId ? `tidal-${n.tidalId}` : void 0,
          name: n.name,
          anv: "",
          role: discogsRole,
          assistant,
          tidalRole: c.role,
          // for "not imported" reporting at the call site
          resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : ""
        });
      }
    }
    return { artists, publishers, companies, skipped };
  }
  var HARVEST_KEY = (reqId) => `ch-tidal-result:${reqId}`;
  var HARVEST_TIMEOUT_MS = 45e3;
  function runTidalHarvestPage() {
    const m = location.hash.match(/ch-req=([a-z0-9.-]+)/i);
    if (!m) return;
    const reqId = m[1];
    const albumId = (location.pathname.match(/\/album\/(\d+)/) || [])[1] || null;
    const post = (payload) => {
      try {
        GM_setValue(HARVEST_KEY(reqId), { albumId, ts: Date.now(), ...payload });
      } catch (e) {
      }
    };
    const started = Date.now();
    let lastCount = -1, stableSince = 0;
    const timer = setInterval(() => {
      const items = document.querySelectorAll('[data-test="album-info-item"]');
      if (items.length > 0) {
        if (items.length !== lastCount) {
          lastCount = items.length;
          stableSince = Date.now();
        } else if (Date.now() - stableSince > 1200) {
          clearInterval(timer);
          const tracks = extractTidalCreditsDom(document);
          harvestReleaseThenPost(tracks, post);
          return;
        }
      }
      if (Date.now() - started > HARVEST_TIMEOUT_MS - 5e3) {
        clearInterval(timer);
        post({ ok: false, error: lastCount > 0 ? "render never stabilised" : "credits never rendered (login wall? geo block?)" });
        setTimeout(() => window.close(), 250);
      }
    }, 300);
  }
  function harvestReleaseThenPost(tracks, post) {
    const finish = (releaseCredits) => {
      post({ ok: true, tracks, releaseCredits });
      setTimeout(() => window.close(), 250);
    };
    const infoTab = document.querySelector('[data-test="album-info-tab-info"]');
    if (!infoTab) {
      finish([]);
      return;
    }
    try {
      infoTab.click();
    } catch (e) {
      finish([]);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => {
      const cells = [...document.querySelectorAll('[class*="_creditsCell"]')].filter((c) => !c.closest('[data-test="album-info-item"]'));
      if (cells.length > 0) {
        clearInterval(t);
        setTimeout(() => finish(extractTidalReleaseCreditsDom(document)), 600);
      } else if (Date.now() - start > 6e3) {
        clearInterval(t);
        finish([]);
      }
    }, 250);
  }
  function harvestTidalAlbum(albumUrl) {
    const parsed = parseTidalAlbumUrl(albumUrl);
    if (!parsed) return Promise.reject(new Error(`Not a Tidal album URL: ${albumUrl}`));
    const reqId = `${parsed.id}.${Date.now().toString(36)}`;
    const key = HARVEST_KEY(reqId);
    const harvestUrl = `${parsed.creditsUrl}#ch-req=${reqId}`;
    if (typeof GM_openInTab === "function") {
      GM_openInTab(harvestUrl, { active: false, insert: true, setParent: true });
    } else {
      const tab = window.open(harvestUrl, "_blank");
      if (!tab) return Promise.reject(new Error("Popup blocked \u2014 allow popups for musicbrainz.org and retry"));
    }
    return new Promise((resolve, reject) => {
      let listenerId = null;
      let pollTimer = null;
      const done = (fn, arg) => {
        if (pollTimer) clearInterval(pollTimer);
        clearTimeout(deadline);
        try {
          if (listenerId !== null && typeof GM_removeValueChangeListener === "function") GM_removeValueChangeListener(listenerId);
        } catch (e) {
        }
        try {
          GM_deleteValue(key);
        } catch (e) {
        }
        fn(arg);
      };
      const check = (value) => {
        if (value && typeof value === "object") done(resolve, value);
      };
      if (typeof GM_addValueChangeListener === "function") {
        listenerId = GM_addValueChangeListener(key, (_n, _o, value) => check(value));
      }
      pollTimer = setInterval(() => {
        try {
          check(GM_getValue(key));
        } catch (e) {
        }
      }, 700);
      const deadline = setTimeout(() => done(reject, new Error("Tidal harvest timed out \u2014 is the credits tab open and loading?")), HARVEST_TIMEOUT_MS);
    });
  }

  // src/sources/qobuz.js
  var QOBUZ_ROLE_MAP = {
    "Composer": { target: "work", rel: "composer" },
    "Lyricist": { target: "work", rel: "lyricist" },
    "Author": { target: "work", rel: "lyricist" },
    "ComposerLyricist": { target: "work", rel: "writer" },
    "Writer": { target: "work", rel: "writer" },
    "Arranger": { target: "work", rel: "arranger" },
    "Performance Arranger": { target: "recording", rel: "arranger" },
    "Producer": { target: "recording", rel: "producer" },
    "Co-Producer": { target: "recording", rel: "producer" },
    "Assistant Producer": { target: "recording", rel: "producer", attributes: ["assistant"] },
    "Mixer": { target: "recording", rel: "mix" },
    "MixingEngineer": { target: "recording", rel: "mix" },
    "Mixing Engineer": { target: "recording", rel: "mix" },
    "Engineer": { target: "recording", rel: "engineer" },
    "Assistant Engineer": { target: "recording", rel: "engineer", attributes: ["assistant"] },
    "RecordingEngineer": { target: "recording", rel: "recording" },
    "Recording Engineer": { target: "recording", rel: "recording" },
    "MasteringEngineer": { target: "release", rel: "mastering" },
    "Mastering Engineer": { target: "release", rel: "mastering" },
    "Editor": { target: "recording", rel: "editor" },
    "Remixer": { target: "recording", rel: "remixer" },
    "Conductor": { target: "recording", rel: "conductor" },
    "Vocals": { target: "recording", rel: "vocal" },
    "Vocal": { target: "recording", rel: "vocal" },
    "Background Vocal": { target: "recording", rel: "vocal", attributes: [{ _type: "vocal", value: "background vocals" }] },
    "Background Vocals": { target: "recording", rel: "vocal", attributes: [{ _type: "vocal", value: "background vocals" }] },
    "MusicPublisher": { target: "work", rel: "publisher" },
    "Music Publisher": { target: "work", rel: "publisher" },
    "MainArtist": null,
    "Main Artist": null,
    "FeaturedArtist": null,
    "Featured Artist": null,
    "AssociatedPerformer": null,
    "Associated Performer": null,
    "StudioPersonnel": null,
    "Studio Personnel": null
  };
  var QOBUZ_INSTRUMENTS_CI = new Set(Object.keys(INSTRUMENTS).map((k) => k.toLowerCase()));
  function isQobuzRole(token) {
    return Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, token) || QOBUZ_INSTRUMENTS_CI.has(token.toLowerCase());
  }
  var QOBUZ_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/]+\/)?([a-z0-9]+)\/?(?:[?#]|$)/i;
  function parseQobuzAlbumUrl(url) {
    const m = QOBUZ_ALBUM_RE.exec(url || "");
    if (!m) return null;
    const original = String(url).replace(/^\/\//, "https://");
    const isStore = /^https?:\/\/(www\.)?qobuz\.com\/[a-z]{2}-[a-z]{2}\/album\//i.test(original);
    return { id: m[1], pageUrl: isStore ? original.split(/[?#]/)[0] : `https://www.qobuz.com/us-en/album/x/${m[1]}` };
  }
  function decodeEntities(s) {
    return String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
  }
  var QOBUZ_NOTICE_RE = /^\s*[(℗©]|\bcopyright\b/i;
  function parseQobuzCreditLine(line) {
    const out = [];
    for (const seg of String(line).split(" - ")) {
      const raw = seg.trim();
      if (!raw || QOBUZ_NOTICE_RE.test(raw)) continue;
      const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
      const firstRole = tokens.findIndex(isQobuzRole);
      if (firstRole === -1) {
        out.push({ name: tokens.join(", "), roles: [] });
        continue;
      }
      const name = tokens.slice(0, firstRole).join(", ");
      const roles = tokens.slice(firstRole).filter(isQobuzRole);
      if (name) out.push({ name, roles });
      else if (out.length) out[out.length - 1].roles.push(...roles);
    }
    return out;
  }
  function extractQobuzCredits(html) {
    const out = [];
    const re = /id="popinAddToCartBtnPlayerTrack(\d+)"|<p[^>]*class="[^"]*\btrack__info\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let m, current = 0, capturedFor = null;
    while ((m = re.exec(html)) !== null) {
      if (m[1] !== void 0) {
        current = parseInt(m[1], 10);
        capturedFor = null;
        continue;
      }
      const text = decodeEntities((m[2] || "").replace(/<[^>]+>/g, "").trim());
      if (!text || !current || capturedFor === current) continue;
      out.push({ index: current, credits: parseQobuzCreditLine(text) });
      capturedFor = current;
    }
    return out;
  }
  function extractQobuzAlbumInfo(html) {
    const og = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || "";
    return decodeEntities(og.replace(/ - Qobuz$/, ""));
  }
  function qobuzToEngine(parsedTracks) {
    const tracklistRels = [];
    const artistRoles = [];
    const tracklist = [];
    const skipped = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, (t) => t.index);
    parsedTracks.forEach((t, i) => {
      const track = { position: positions[i], title: "", type_: "track" };
      tracklist.push(track);
      for (const credit of t.credits) {
        if (!credit.roles.length) {
          if (credit.name && !/^copyright control$/i.test(credit.name)) skipped.push(`track ${track.position}: (no role) \u2014 ${credit.name}`);
          continue;
        }
        const names = splitCombinedNames(credit.name);
        for (const role of credit.roles) {
          if (role === "MusicPublisher" || role === "Music Publisher") {
            if (!/^copyright control$/i.test(credit.name)) skipped.push(`track ${track.position}: Music Publisher \u2014 ${credit.name}`);
            continue;
          }
          for (const nm of names) {
            const url = names.length > 1 ? "" : credit.resource_url || "";
            if (Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, role)) {
              const plan = QOBUZ_ROLE_MAP[role];
              if (!plan) continue;
              const rel = {
                linkType: plan.rel,
                entityType: "artist",
                attributes: [...plan.attributes || []],
                artist: { name: nm, anv: "", resource_url: url }
                // #353 Qobuz artist id (composer/performer) → exact link
              };
              if (plan.target === "release") artistRoles.push(rel);
              else tracklistRels.push({ ...rel, track });
              continue;
            }
            const rels = getArtistRoles({ name: nm, anv: "", role, resource_url: url });
            if (!rels.length) {
              skipped.push(`track ${track.position}: ${role} \u2014 ${nm}`);
              continue;
            }
            for (const r of rels) {
              tracklistRels.push({
                linkType: r.linkType,
                entityType: "artist",
                attributes: r.attributes || [],
                artist: r.artist,
                track
              });
            }
          }
        }
      }
    });
    return { tracklistRels, artistRoles, tracklist, skipped, multiVolume };
  }
  function fetchQobuzAlbumPage(pageUrl) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: pageUrl,
        headers: { "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8" },
        timeout: 2e4,
        onload: (r) => r.status >= 200 && r.status < 400 && r.responseText ? resolve(r.responseText) : reject(new Error(`Qobuz page returned ${r.status}`)),
        onerror: () => reject(new Error("Qobuz page fetch failed (network)")),
        ontimeout: () => reject(new Error("Qobuz page fetch timed out"))
      });
    });
  }
  var QOBUZ_API = "https://www.qobuz.com/api.json/0.2";
  var QOBUZ_APP_ID = "712109809";
  var QOBUZ_LS_KEY = "mbtools:qobuz";
  function qobuzToken() {
    try {
      const t = JSON.parse(localStorage.getItem(QOBUZ_LS_KEY) || "null");
      return t && t.token || null;
    } catch (e) {
      return null;
    }
  }
  function qobuzArtistUrl(id) {
    return `https://open.qobuz.com/artist/${id}`;
  }
  var QOBUZ_ARTIST_RE = /(?:https?:)?\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?(?:interpreter\/[^/]+\/|artist\/)(\d+)/i;
  function parseQobuzArtistUrl(url) {
    const m = QOBUZ_ARTIST_RE.exec(url || "");
    return m ? { key: `qobuz-artist/${m[1]}`, cleanUrl: qobuzArtistUrl(m[1]), id: m[1] } : null;
  }
  function parseQobuzApiTracks(json) {
    const items = json && json.tracks && json.tracks.items || [];
    return items.map((t, i) => {
      const credits = t.performers ? parseQobuzCreditLine(decodeEntities(t.performers)) : [];
      const idByName = {};
      if (t.composer && t.composer.id) idByName[t.composer.name] = t.composer.id;
      if (t.performer && t.performer.id) idByName[t.performer.name] = t.performer.id;
      for (const c of credits) {
        const id = idByName[c.name];
        if (id) c.resource_url = qobuzArtistUrl(id);
      }
      return { index: t.track_number || i + 1, credits };
    }).filter((t) => t.credits.length);
  }
  function qobuzApiAlbumInfo(json) {
    if (!json) return "";
    return [json.title, json.artist && json.artist.name].filter(Boolean).join(", ");
  }
  function fetchQobuzApiAlbum(albumId, token) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: `${QOBUZ_API}/album/get?album_id=${encodeURIComponent(albumId)}&app_id=${QOBUZ_APP_ID}`,
        headers: { "X-App-Id": QOBUZ_APP_ID, "X-User-Auth-Token": token, "Accept": "application/json" },
        timeout: 2e4,
        onload: (r) => {
          if (r.status === 401) {
            reject(new Error("Qobuz session expired \u2014 re-login in Platform Check"));
            return;
          }
          if (r.status < 200 || r.status >= 300) {
            reject(new Error(`Qobuz album/get returned ${r.status}`));
            return;
          }
          try {
            resolve(JSON.parse(r.responseText));
          } catch (e) {
            reject(new Error("Qobuz album/get: malformed JSON"));
          }
        },
        onerror: () => reject(new Error("Qobuz album/get failed (network)")),
        ontimeout: () => reject(new Error("Qobuz album/get timed out"))
      });
    });
  }

  // src/sources/metal_archives.js
  var MA_ARTIST_RE = /^https?:\/\/(?:www\.)?metal-archives\.com\/artists\/([^/?#]+)\/(\d+)/i;
  function parseMetalArchivesArtistUrl(url) {
    const m = MA_ARTIST_RE.exec(url || "");
    if (!m) return null;
    return { id: m[2], key: `metal-archives-artist/${m[2]}`, cleanUrl: `https://www.metal-archives.com/artists/${m[1]}/${m[2]}` };
  }
  var MA_ALBUM_RE = /^https?:\/\/(?:www\.)?metal-archives\.com\/albums\/([^/?#]+)\/([^/?#]+)\/(\d+)/i;
  function parseMetalArchivesAlbumUrl(url) {
    const m = MA_ALBUM_RE.exec(url || "");
    if (!m) return null;
    return { id: m[3], albumUrl: `https://www.metal-archives.com/albums/${m[1]}/${m[2]}/${m[3]}` };
  }
  var MA_INSTRUMENT_MAP = {
    // Guitars / Bass are special-cased in bridgeToken (electric by default in metal, #453).
    "Drums": "Drums",
    "Drum programming": "Drum Programming",
    "Drum Programming": "Drum Programming",
    "Keyboards": "Keyboard",
    "Keyboard": "Keyboard",
    "Synthesizers": "Synthesizer",
    "Synthesizer": "Synthesizer",
    "Synth": "Synthesizer",
    "Synths": "Synthesizer",
    "Piano": "Piano",
    "Percussion": "Percussion",
    "Classical Percussion": "Percussion",
    "Bagpipes": "Bagpipe",
    "Bells": "Bell",
    "Round Bells": "Bell",
    "Kettledrums": "Kettledrum",
    "Contrabass": "Double Bass",
    "Citern": "Cittern",
    "Jew's Harp": "Mouth Harp",
    "Oak Stick": "Rhythm Sticks",
    "Western Concert Flute": "Concert Flute",
    "Woodchimes": "Chimes",
    "Wind instruments": "Wind Instruments",
    "Saxophone (alto)": "Alto Saxophone",
    "Saxophone (baritone)": "Baritone Saxophone",
    "Saxophone (tenor)": "Tenor Saxophone"
    // pass-through-friendly names (already in INSTRUMENTS): Accordion, Banjo, Bassoon, Bouzouki, Cello,
    // Clarinet, Concertina, Cowbell, Crumhorn, Domra, Fiddle, Flute, French Horn, Harp, Harpsichord,
    // Hurdy Gurdy, Mandolin, Oboe, Ocarina, Organ, Pan Flute, Saxophone, Shakuhachi, Sopilka, Strings,
    // Tambourine, Timpani, Tin Whistle, Trombone, Trumpet, Viola, Violin, Xylophone, Sitar, Ebow, Samples.
  };
  var MA_VOCAL_SUBTYPE = {
    "lead": "Lead Vocals",
    "backing": "Backing Vocals",
    "back": "Backing Vocals",
    "additional": "Backing Vocals",
    "baritone": "Baritone Vocals",
    "soprano": "Soprano Vocals",
    "tenor": "Tenor Vocals",
    "alto": "Alto Vocals",
    "choirs": "Choir Vocals",
    "choir": "Choir Vocals",
    "spoken": "Spoken Vocals",
    "spoken word": "Spoken Vocals"
  };
  var MA_STAFF_MAP = {
    "Songwriting": "Composed By",
    "Composition": "Composed By",
    "Lyrics": "Lyrics By",
    "Arrangements": "Arranged By",
    "Arrangement": "Arranged By",
    "Recording": "Recording Engineer",
    "Engineering": "Engineer",
    "Mixing": "Mixed By",
    "Remixing": "Remixer",
    "Mastering": "Mastered By",
    "Remastering": "Remastered By",
    "Producer": "Producer",
    "Executive Producer": "Executive-Producer",
    "Co-producer": "Co-producer",
    "Editing": "Edited By",
    "Technician": "Instruments",
    "Conductor": "Conductor",
    "Choirmaster": "Chorus Master",
    "Artwork": "Artwork By",
    "Illustrations": "Illustration",
    "Illustration": "Illustration",
    "Cover Art": "Artwork By",
    "Interior art": "Artwork By",
    "Art Direction": "Art Direction",
    "Photography": "Photography By",
    "Design": "Graphic Design",
    "Liner Notes": "Liner Notes",
    "Director": "Director"
    // design-with-a-task (#453): base rel + a `task` attribute (getArtistRoles doesn't add
    // it for the graphic-design link type, so bridgeToken attaches it explicitly).
  };
  var MA_DESIGN_TASK = { "Layout": "layout", "Logo": "logo", "Photo manipulation": "photo manipulation" };
  var MA_SKIP = /* @__PURE__ */ new Set([
    "All Instruments",
    "Everything",
    "Unknown",
    "Production assistance",
    "Producer (pre-production)",
    "Authoring",
    "Orchestra leader",
    "Menu"
  ]);
  var MA_SPECIAL_SKIP = /* @__PURE__ */ new Set(["Ambience"]);
  function splitTopLevelCommas(str) {
    const out = [];
    let depth = 0, cur = "";
    for (const ch of String(str || "")) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function parseTrackGroup(inner) {
    if (!/^tracks?\b/i.test(inner)) return null;
    const nums = [];
    inner.replace(/^tracks?\s*/i, "").split(",").forEach((part) => {
      const range = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (range) {
        for (let n = +range[1]; n <= +range[2]; n++) nums.push(n);
      } else {
        const one = part.trim().match(/^\d+$/);
        if (one) nums.push(+part.trim());
      }
    });
    return nums.length ? nums : null;
  }
  function parseMaRoleCell(cell) {
    return splitTopLevelCommas(cell).map((token) => {
      const details = [];
      let tracks = null;
      const base = token.replace(/\(([^()]*)\)/g, (_, inner) => {
        const tg = parseTrackGroup(inner.trim());
        if (tg) tracks = (tracks || []).concat(tg);
        else if (inner.trim()) details.push(inner.trim());
        return "";
      }).replace(/\s+/g, " ").trim();
      return { base, details, tracks };
    }).filter((t) => t.base);
  }
  function bridgeToken(tok) {
    const base = tok.base;
    if (MA_SKIP.has(base) || MA_SPECIAL_SKIP.has(base)) return null;
    const detail = tok.details.map((d) => d.toLowerCase()).join(" ");
    if (/^guitars?$/i.test(base)) {
      const role = /\belectric\b/.test(detail) ? "Electric Guitar" : /\bacoustic\b/.test(detail) ? "Acoustic Guitar" : /\b(classical|nylon)\b/.test(detail) ? "Classical Guitar" : "Electric Guitar";
      return { role, attrs: [] };
    }
    if (/^bass(\s*guitar)?$/i.test(base)) {
      const role = /\bacoustic\b/.test(detail) ? "Acoustic Bass" : /\b(double|upright|contrabass)\b/.test(detail) ? "Double Bass" : /\bfretless\b/.test(detail) ? "Fretless Bass" : "Electric Bass Guitar";
      return { role, attrs: [] };
    }
    if (/^vocals?$/i.test(base) || /^voice$/i.test(base) || /^narration$/i.test(base)) {
      if (/^narration$/i.test(base)) return { role: "Spoken Vocals", attrs: [] };
      const sub = tok.details.map((d) => d.toLowerCase()).find((d) => MA_VOCAL_SUBTYPE[d]);
      return { role: sub ? MA_VOCAL_SUBTYPE[sub] : "Vocals", attrs: [] };
    }
    if (MA_DESIGN_TASK[base]) return { role: "Graphic Design", attrs: [{ _type: "task", value: MA_DESIGN_TASK[base] }] };
    return { role: MA_INSTRUMENT_MAP[base] || MA_STAFF_MAP[base] || base, attrs: [] };
  }
  function extractLineupTable(doc, id) {
    const table = doc.getElementById(id);
    const rows = [];
    if (!table) return rows;
    let band = null;
    for (const tr of table.querySelectorAll("tr")) {
      const a = tr.querySelector('a[href*="/artists/"]');
      const tds = [...tr.querySelectorAll("td")];
      if (!a) {
        const label = tds.map((td) => td.textContent.trim()).join(" ").replace(/^\[|\]$/g, "").trim();
        if (label) band = label;
        continue;
      }
      const url = a.href;
      const nameText = a.textContent.trim();
      const roleTd = tds.find((td) => !td.querySelector('a[href*="/artists/"]'));
      const roleCell = roleTd ? roleTd.textContent.trim().replace(/\s+/g, " ") : "";
      rows.push({ name: nameText, url, roleCell, band });
    }
    return rows;
  }
  function extractTracklist(doc) {
    const table = doc.querySelector("#album_tabs_tracklist table.table_lyrics, .album_tabs_tracklist table, table.table_lyrics");
    const tracks = [];
    let disc = 0;
    if (!table) return { tracks, multiDisc: false };
    const multiDisc = /\b(?:Disc|CD)\s*\d/i.test(table.textContent);
    for (const tr of table.querySelectorAll("tr")) {
      const tds = [...tr.querySelectorAll("td")];
      if (/^(disc|cd|side)\s*\w+/i.test(tr.textContent.trim()) && !tr.querySelector("td.wrapWords")) {
        disc++;
        continue;
      }
      const m = tds[0] && tds[0].textContent.trim().match(/^(\d+)\.?$/);
      if (!m) continue;
      const n = +m[1];
      const titleCell = tr.querySelector("td.wrapWords") || tds[1];
      const title = titleCell ? titleCell.textContent.trim().replace(/\s+/g, " ") : "";
      tracks.push({ position: multiDisc ? `${disc || 1}-${n}` : String(n), title, type_: "track" });
    }
    return { tracks, multiDisc };
  }
  function extractMaLineupDom(doc) {
    const typeEl = [...doc.querySelectorAll("#album_info dt, dl.float_left dt")].find((d) => /^type\b/i.test(d.textContent.trim()));
    const type = typeEl && typeEl.nextElementSibling ? typeEl.nextElementSibling.textContent.trim() : "";
    const band = extractLineupTable(doc, "album_members_lineup");
    const guest = extractLineupTable(doc, "album_members_guest");
    const misc = extractLineupTable(doc, "album_members_misc");
    const { tracks, multiDisc } = extractTracklist(doc);
    const multiBand = /split|collaboration/i.test(type) || [...band, ...guest].some((r) => r.band);
    if (/split/i.test(type)) {
      const bandNames = [...new Set([...band, ...guest, ...misc].map((r) => r.band).filter(Boolean))];
      for (const t of tracks) {
        const b = bandNames.find((bn) => new RegExp("^" + bn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[-\u2013]\\s*", "i").test(t.title));
        if (b) {
          t.band = b;
          t.title = t.title.replace(new RegExp("^" + b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[-\u2013]\\s*", "i"), "");
        }
      }
    }
    return { type, multiBand, multiDisc, tracks, band, guest, misc };
  }
  var HARVEST_KEY2 = (reqId) => `ch-ma-result:${reqId}`;
  var HARVEST_TIMEOUT_MS2 = 45e3;
  function runMetalArchivesHarvestPage() {
    const m = location.hash.match(/ch-req=([a-z0-9.-]+)/i);
    if (!m) return;
    const reqId = m[1];
    const albumId = (location.pathname.match(/\/albums\/[^/]+\/[^/]+\/(\d+)/) || [])[1] || null;
    const post = (payload) => {
      try {
        GM_setValue(HARVEST_KEY2(reqId), { albumId, ts: Date.now(), ...payload });
      } catch (e) {
      }
    };
    const started = Date.now();
    const timer = setInterval(() => {
      const challenged = /just a moment|attention required|checking your browser/i.test(document.title);
      const ready = document.querySelector("#album_info, .album_name, #album_tabs_tracklist, table.table_lyrics");
      if (ready && !challenged) {
        clearInterval(timer);
        try {
          post({ ok: true, ...extractMaLineupDom(document) });
        } catch (e) {
          post({ ok: false, error: "extract failed: " + (e && e.message) });
        }
        setTimeout(() => window.close(), 250);
        return;
      }
      if (Date.now() - started > HARVEST_TIMEOUT_MS2 - 3e3) {
        clearInterval(timer);
        post({ ok: false, error: challenged ? "Cloudflare challenge did not clear in the tab" : "album page never rendered" });
        setTimeout(() => window.close(), 250);
      }
    }, 300);
  }
  function harvestMetalArchivesAlbum(albumUrl) {
    const parsed = parseMetalArchivesAlbumUrl(albumUrl);
    if (!parsed) return Promise.reject(new Error(`Not a Metal Archives album URL: ${albumUrl}`));
    const reqId = `${parsed.id}.${Date.now().toString(36)}`;
    const key = HARVEST_KEY2(reqId);
    const harvestUrl = `${parsed.albumUrl}#ch-req=${reqId}`;
    if (typeof GM_openInTab === "function") {
      GM_openInTab(harvestUrl, { active: false, insert: true, setParent: true });
    } else {
      const tab = window.open(harvestUrl, "_blank");
      if (!tab) return Promise.reject(new Error("Popup blocked \u2014 allow popups for musicbrainz.org and retry"));
    }
    return new Promise((resolve, reject) => {
      let listenerId = null, pollTimer = null;
      const done = (fn, arg) => {
        if (pollTimer) clearInterval(pollTimer);
        clearTimeout(deadline);
        try {
          if (listenerId !== null && typeof GM_removeValueChangeListener === "function") GM_removeValueChangeListener(listenerId);
        } catch (e) {
        }
        try {
          GM_deleteValue(key);
        } catch (e) {
        }
        fn(arg);
      };
      const check = (value) => {
        if (value && typeof value === "object") done(resolve, value);
      };
      if (typeof GM_addValueChangeListener === "function") listenerId = GM_addValueChangeListener(key, (_n, _o, value) => check(value));
      pollTimer = setInterval(() => {
        try {
          check(GM_getValue(key));
        } catch (e) {
        }
      }, 700);
      const deadline = setTimeout(() => done(reject, new Error("Metal Archives harvest timed out \u2014 is the album tab open and loading?")), HARVEST_TIMEOUT_MS2);
    });
  }
  function maArtist(row, discogsRole) {
    const parsed = parseMetalArchivesArtistUrl(row.url);
    return {
      id: parsed ? `metal-archives-${parsed.id}` : void 0,
      name: row.name,
      anv: "",
      role: discogsRole,
      resource_url: parsed ? parsed.cleanUrl : ""
    };
  }
  function rowToTrackRels(row, allTracks, byPosition, guest, skipped, sectionLabel, onlyQualified) {
    const rels = [];
    for (const tok of parseMaRoleCell(row.roleCell)) {
      if (onlyQualified && !tok.tracks) continue;
      const bridged = bridgeToken(tok);
      if (!bridged) {
        skipped.push(`${sectionLabel}: ${tok.base} \u2014 ${row.name}`);
        continue;
      }
      let resolved = getArtistRoles(maArtist(row, bridged.role));
      if (!resolved.length && /s$/i.test(bridged.role)) resolved = getArtistRoles(maArtist(row, bridged.role.replace(/s$/i, "")));
      if (!resolved.length) {
        skipped.push(`${sectionLabel}: ${tok.base} \u2014 ${row.name}`);
        continue;
      }
      const targets = tok.tracks ? tok.tracks.map((n) => byPosition.get(String(n))).filter(Boolean) : allTracks;
      for (const track of targets) {
        for (const r of resolved) {
          rels.push({
            linkType: r.linkType,
            entityType: "artist",
            attributes: [...r.attributes || [], ...bridged.attrs, ...guest ? ["guest"] : []],
            artist: r.artist,
            track
          });
        }
      }
    }
    return rels;
  }
  function metalArchivesToEngine(harvest) {
    const tracklist = (harvest.tracks || []).map((t) => ({ position: t.position, title: t.title, type_: "track", band: t.band }));
    const byPosition = new Map(tracklist.map((t) => [String(t.position).replace(/^\d+-/, ""), t]));
    tracklist.forEach((t) => byPosition.set(String(t.position), t));
    const skipped = [];
    const tracklistRels = [];
    const isSplit = /split/i.test(harvest.type || "");
    for (const [rows, guest, label] of [[harvest.band || [], false, "band"], [harvest.guest || [], true, "guest"]]) {
      for (const row of rows) {
        let scope = tracklist;
        if (isSplit && row.band) {
          scope = tracklist.filter((t) => t.band === row.band);
          if (!scope.length) {
            skipped.push(`${label} (split \u2014 no tracks matched band "${row.band}"): ${row.roleCell} \u2014 ${row.name}`);
            continue;
          }
        }
        tracklistRels.push(...rowToTrackRels(row, scope, byPosition, guest, skipped, label));
      }
    }
    for (const row of harvest.misc || []) {
      tracklistRels.push(...rowToTrackRels(row, tracklist, byPosition, false, skipped, "misc", true));
    }
    return { tracklistRels, tracklist, skipped, multiVolume: !!harvest.multiDisc };
  }
  function metalArchivesReleaseArtists(harvest) {
    const artists = [], skipped = [];
    for (const row of harvest.misc || []) {
      for (const tok of parseMaRoleCell(row.roleCell)) {
        if (tok.tracks) continue;
        const bridged = bridgeToken(tok);
        if (!bridged) {
          skipped.push(`release: ${tok.base} \u2014 ${row.name}`);
          continue;
        }
        const a = maArtist(row, bridged.role);
        a.maRole = tok.base;
        a.maAttrs = bridged.attrs;
        artists.push(a);
      }
    }
    return { artists, publishers: [], companies: [], skipped };
  }

  // src/sources/allmusic.js
  var TIVO_API = "https://tivomusicapi-staging-elb.digitalsmiths.net/sd/tivomusicapi/taps/v3";
  var ALLMUSIC_RELEASE_RE = /^(?:https?:)?\/\/(?:www\.)?allmusic\.com\/album\/release\/(?:[^/?#]*-)?(mr\d{10})/i;
  function parseAllMusicReleaseUrl(url) {
    const m = ALLMUSIC_RELEASE_RE.exec(url || "");
    return m ? { id: m[1].toUpperCase(), pageUrl: `https://www.allmusic.com/album/release/${m[1].toLowerCase()}` } : null;
  }
  var allMusicArtistUrl = (id) => /^MN\d+$/i.test(id || "") ? `https://www.allmusic.com/artist/${id.toLowerCase()}` : "";
  function parseAllMusicArtistUrl(url) {
    const m = /allmusic\.com\/artist\/(?:[^/?#]*-)?(mn\d{10})/i.exec(url || "");
    return m ? { key: `allmusic-artist/${m[1].toLowerCase()}`, cleanUrl: `https://www.allmusic.com/artist/${m[1].toLowerCase()}` } : null;
  }
  var ROLE_ALIASES = {
    "Composer": "Composed By",
    "Lyricist": "Lyrics By",
    "Arranger": "Arranged By",
    "Vocals (Background)": "Backing Vocals",
    "Guitar (Bass)": "Bass Guitar",
    "Guitar (Acoustic)": "Acoustic Guitar",
    "Guitar (Electric)": "Electric Guitar",
    "Engineer": "Engineer",
    "Mixing": "Mixed By",
    "Mastering": "Mastered By"
  };
  var SKIP_ROLES = /^(?:primary artist|featured artist|main personnel)$/i;
  function allMusicTracks(json) {
    const hit = json && json.hits && json.hits[0];
    if (!hit) return null;
    const tracks = (hit.tracks || []).map((t, i) => ({
      index: +t.phyTrackNum || i + 1,
      disc: +t.disc || 1,
      title: t.title || "",
      credits: [...t.performers || [], ...t.composers || []].map((p) => ({ name: p.name || "", url: allMusicArtistUrl(p.nameId), role: p.role || (t.composers?.includes(p) ? "Composer" : "") }))
    }));
    return { title: hit.title || "", id: hit.id || "", tracks };
  }
  function allMusicToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, (t) => t.index);
    parsedTracks.forEach((t, i) => {
      const track = { position: positions[i], title: "", type_: "track" };
      tracklist.push(track);
      for (const c of t.credits) {
        if (!c.name || !c.role || SKIP_ROLES.test(c.role)) continue;
        const role = ROLE_ALIASES[c.role] || c.role.replace(/^(.+?) \((.+)\)$/, "$2 $1");
        const rels = getArtistRoles({ name: c.name, anv: "", role, resource_url: c.url });
        if (!rels.length) {
          skipped.push(`track ${track.position}: ${c.role} \u2014 ${c.name}`);
          continue;
        }
        for (const r of rels) tracklistRels.push({ linkType: r.linkType, entityType: "artist", attributes: r.attributes || [], artist: r.artist, track });
      }
    });
    return { tracklistRels, artistRoles: [], tracklist, skipped, multiVolume };
  }
  function tivoGet(path, timeout = 25e3) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: TIVO_API + path,
        timeout,
        onload: (r) => {
          if (r.status < 200 || r.status >= 300) {
            reject(new Error(`AllMusic API returned ${r.status}`));
            return;
          }
          try {
            resolve(JSON.parse(r.responseText));
          } catch {
            reject(new Error("AllMusic API: malformed JSON"));
          }
        },
        onerror: () => reject(new Error("AllMusic API fetch failed (network)")),
        ontimeout: () => reject(new Error("AllMusic API timed out"))
      });
    });
  }
  async function fetchAllMusicCredits({ id, barcode }) {
    const q = id ? `releaseId=${encodeURIComponent(id)}` : `productCode=${encodeURIComponent(barcode)}`;
    return allMusicTracks(await tivoGet(`/lookup/release?${q}`));
  }

  // src/sources/registry.js
  function parseSourceEntityUrl(url) {
    if (!url) return null;
    return parseDiscogsUrl(url) || parseTidalArtistUrl(url) || parseQobuzArtistUrl(url) || parseMetalArchivesArtistUrl(url) || parseAllMusicArtistUrl(url);
  }
  function idbKeyForEntity(entity) {
    if (!entity) return null;
    return parseSourceEntityUrl(entity.resource_url)?.key || entity._cacheKey || null;
  }
  function sourceNameForUrl(url) {
    if (/tidal\.com\//i.test(url || "")) return "Tidal";
    if (/qobuz\.com\//i.test(url || "")) return "Qobuz";
    if (/deezer\.com\//i.test(url || "")) return "Deezer";
    if (/mora\.jp\//i.test(url || "")) return "mora";
    if (/melon\.com\//i.test(url || "")) return "Melon";
    if (/allmusic\.com\//i.test(url || "")) return "AllMusic";
    if (/(?:music|itunes)\.apple\.com\//i.test(url || "")) return "Apple";
    if (/metal-archives\.com\//i.test(url || "")) return "Metal Archives";
    if (/music\.youtube\.com\/|youtube\.com\/playlist\?(?:[^#]*&)?list=OLAK5uy_/i.test(url || "")) return "YouTube Music";
    return "Discogs";
  }
  var isSyntheticProviderUrl = (url) => /tidal\.com\/_(?:publisher|company)\//i.test(String(url || ""));
  function sourceUrlLinkTypeId(url, entityType) {
    if (isSyntheticProviderUrl(url)) return null;
    const src = sourceNameForUrl(url);
    if (src === "Tidal") return entityType === "artist" ? "978" : null;
    if (src === "Qobuz") return entityType === "artist" ? "978" : null;
    if (src === "AllMusic") return entityType === "artist" ? "283" : null;
    if (src === "Metal Archives") return entityType === "artist" ? "188" : null;
    return entityType === "label" ? "217" : entityType === "place" ? "705" : "180";
  }

  // src/preflight.js
  var KIND_TABLE = {
    artist: { searchLimit: 100, resultKey: "artists", incRels: "artist-rels" },
    label: { searchLimit: 8, resultKey: "labels", incRels: "label-rels" },
    // Places also accept label-rels because MB editors often file a
    // facility as a label rather than a place (issue we've worked around
    // since the original company resolver).
    place: { searchLimit: 8, resultKey: "places", incRels: "place-rels+label-rels" }
  };
  var toCandidate = (a) => ({
    id: a.id,
    name: a.name,
    disambiguation: a.disambiguation || a["disambiguation-comment"] || "",
    score: a.score || 0,
    aliases: (a.aliases || []).map((al) => al && al.name).filter(Boolean)
  });
  function contextHit(context, name, candidates) {
    if (!context || !context.related || !context.related.length) return null;
    const holders = mbmContextHolders(context.related, name, (candidates || []).map((c) => ({ id: c.id, name: c.name, aliases: (c.aliases || []).map((n) => ({ name: n })) })));
    if (holders.length === 1) return holders[0];
    if (holders.length > 1) logDebug(`context: "${name}" is carried by ${holders.length} related artists (${holders.map((h) => h.name).join(", ")}) \u2014 left to review`);
    return null;
  }
  async function coCreditHit(context, name) {
    if (!context || !context.coCredit || !context.seeds || !context.seeds.length) return null;
    const tally = /* @__PURE__ */ new Map();
    for (const seed of context.seeds.slice(0, 4)) {
      const q = `arid:${seed} AND artistname:"${String(name).replace(/["\\]/g, " ")}"`;
      const json = await mbThrottle.fetchJson(`${MB}/ws/2/recording?query=${encodeURIComponent(q)}&inc=artist-credits&limit=25&fmt=json`);
      if (!json) continue;
      for (const h of mbmCoCreditHits(json, seed, name)) {
        const t = tally.get(h.gid) || { n: 0, name: h.name };
        t.n++;
        tally.set(h.gid, t);
      }
    }
    const ranked = [...tally.entries()].sort((a, b) => b[1].n - a[1].n);
    if (ranked.length === 1 || ranked.length > 1 && ranked[0][1].n > ranked[1][1].n) return { gid: ranked[0][0], name: ranked[0][1].name };
    if (ranked.length) logDebug(`co-credit: "${name}" \u2192 ${ranked.length} tied candidates \u2014 left to review`);
    return null;
  }
  async function resolveEntity(entity, kind, opts) {
    const { bypassIdb } = opts;
    const context = kind === "artist" ? opts.context || null : null;
    const { searchLimit, resultKey, incRels } = KIND_TABLE[kind];
    const parsed = parseSourceEntityUrl(entity.resource_url);
    const key = parsed?.key || entity._cacheKey || null;
    const searchName = entity.name;
    const displayName = kind === "artist" ? entity.anv && entity.anv.trim() || entity.name : entity.name;
    const discogsHref = entity.resource_url.replace(/https:\/\/api\.discogs\.com\/(\w+?)s\/(\d+)/, "https://www.discogs.com/$1/$2");
    function buildResolved(mbUrl, mbName, mbDisambig, via2, actualKind = kind, fromCache = false, urlLinkedIds2, creditOverride) {
      return {
        type: "resolved",
        entityType: actualKind,
        entity,
        displayName,
        discogsHref,
        mbUrl,
        mbName,
        mbDisambig,
        // User's saved "Credited as" override from a prior session
        // (IDB `creditOverride` field). Review-table reads this in
        // `pickPrefill` to populate the field. Undefined when no
        // prior override exists. #105.
        creditOverride,
        // `urlLinkedIds` — MBIDs that have a relation to this Discogs URL,
        //                  harvested from the URL lookup done during
        //                  preflight. The review-table uses this to render
        //                  the "Add Discogs link" / "already linked" / "linked
        //                  to different MB <type>" badge without issuing
        //                  another `/ws/2/url?…` query per row. `undefined`
        //                  means "preflight didn't ask MB" (IDB hit on a
        //                  legacy record that predates this field), in which
        //                  case review-table falls back to its own per-row
        //                  fetch. `[]` means "asked MB, got no relations" —
        //                  no fallback needed.
        urlLinkedIds: urlLinkedIds2,
        // `via`      — the resolution mechanism (`name` / `url` / `both` / `user`,
        //              or `cache` only when a legacy IDB record predates the
        //              `resolvedVia` field and we genuinely can't recover it).
        // `fromCache`— whether THIS resolution came from IDB rather than a fresh
        //              MB lookup. The two are orthogonal: a name-resolved entity
        //              loaded from cache is `via='name'` + `fromCache=true`, and
        //              the UI surfaces both as `name (cache)`.
        logEntry: { displayName, discogsHref, mbUrl, mbName, mbDisambig, via: via2, fromCache }
      };
    }
    function buildAttention(nameMatches2, nameSearchFailed2, ambiguityReason, urlLinkedIds2, creditOverride) {
      return {
        type: "attention",
        entityType: kind,
        entity,
        displayName,
        discogsHref,
        nameMatches: nameMatches2 || [],
        // Saved "Credited as" override — see buildResolved. #105.
        creditOverride,
        // Same `urlLinkedIds` contract as on the resolved shape — review-table
        // uses it to skip the per-row URL fetch even for attention rows once
        // the user picks an MBID from the candidate list.
        urlLinkedIds: urlLinkedIds2,
        // Only artists track this — used by the review table to badge
        // entries that failed because of a rate-limited name search vs
        // entries that genuinely don't exist in MB.
        rateLimited: kind === "artist" && nameSearchFailed2 && !nameMatches2?.length,
        ambiguityReason: ambiguityReason || null
      };
    }
    async function fetchMbEntityInfo(et, mbid) {
      const json = await mbThrottle.fetchJson(`${MB}/ws/2/${et}/${mbid}?fmt=json`);
      return json ? { name: json.name || null, disambiguation: json.disambiguation || "" } : { name: null, disambiguation: "" };
    }
    if (bypassIdb && key) {
      await deleteIdbRecord(key);
    }
    if (!bypassIdb && key) {
      const cachedRec = await readIdbRecord(key);
      if (cachedRec?.mbid && cachedRec?.entityType) {
        const via2 = cachedRec.resolvedVia || "cache";
        let cachedLinkedIds = cachedRec.urlLinkedIds;
        if (cachedLinkedIds === void 0 && (via2 === "url" || via2 === "both" || via2 === "both-alias")) {
          cachedLinkedIds = [cachedRec.mbid];
        }
        if (Array.isArray(cachedLinkedIds) && cachedLinkedIds.length === 0) cachedLinkedIds = void 0;
        if (cachedRec.name) {
          return buildResolved(
            cachedRec.mbUrl,
            cachedRec.name,
            cachedRec.disambiguation || "",
            via2,
            cachedRec.entityType,
            true,
            cachedLinkedIds,
            cachedRec.creditOverride
          );
        }
        const info = await fetchMbEntityInfo(cachedRec.entityType, cachedRec.mbid);
        if (info.name) {
          await writeIdbRecord(key, {
            name: info.name,
            disambiguation: info.disambiguation
          });
        }
        return buildResolved(
          cachedRec.mbUrl,
          info.name,
          info.disambiguation,
          via2,
          cachedRec.entityType,
          true,
          cachedLinkedIds,
          cachedRec.creditOverride
        );
      }
      if (cachedRec && Array.isArray(cachedRec.nameMatches)) {
        const attnLinkedIds = Array.isArray(cachedRec.urlLinkedIds) && cachedRec.urlLinkedIds.length === 0 ? void 0 : cachedRec.urlLinkedIds;
        const ctx = contextHit(context, searchName, cachedRec.nameMatches);
        if (ctx) {
          log.info(`Match: ${displayName} \u2192 ${ctx.name} \u2014 via release context (${ctx.rel || "related"}, ${ctx.via})`);
          const mbUrl = `${MB}/artist/${ctx.gid}`;
          await writeIdbRecord(key, { mbid: ctx.gid, entityType: "artist", name: ctx.name, disambiguation: "", resolvedVia: "ctx", nameMatches: null, mbUrl });
          return buildResolved(mbUrl, ctx.name, "", "ctx", "artist", false, attnLinkedIds, cachedRec.creditOverride);
        }
        return buildAttention(cachedRec.nameMatches, false, null, attnLinkedIds, cachedRec.creditOverride);
      }
    }
    const [nameJson, urlJson] = await Promise.all([
      mbThrottle.fetchJson(
        `${MB}/ws/2/${kind}?query=${encodeURIComponent(searchName)}&fmt=json&limit=${searchLimit}`
      ),
      parsed ? mbThrottle.fetchJson404(
        `${MB}/ws/2/url?resource=${encodeURIComponent(parsed.cleanUrl)}&inc=${incRels}&fmt=json`
      ) : Promise.resolve({ notFound: true })
    ]);
    const nameSearchFailed = nameJson === null;
    const normalized = searchName.toLowerCase().trim();
    const isArtist = kind === "artist";
    const holdsName = (a) => isArtist ? !!mbmHolds(a, searchName) : a.name.toLowerCase().trim() === normalized;
    const found = nameJson?.[resultKey] || [];
    const nameMatches = [
      ...found.filter((a) => holdsName(a)),
      ...found.filter((a) => !holdsName(a) && a.score != null && a.score >= 70).slice(0, 10)
    ].map(toCandidate);
    const exactNameMatches = nameMatches.filter(holdsName);
    const nameHit = exactNameMatches.length === 1 ? {
      kind,
      mbid: exactNameMatches[0].id,
      name: exactNameMatches[0].name,
      disambiguation: exactNameMatches[0].disambiguation || "",
      via: isArtist && !(exactNameMatches[0].name.toLowerCase().trim() === normalized) ? "alias" : "name"
    } : null;
    let urlHit = null;
    const urlLinkedIds = urlJson === null ? void 0 : (urlJson.relations || []).map((r) => kind === "place" ? r.place?.id || r.label?.id || null : r[kind]?.id || null).filter(Boolean);
    if (urlJson?.relations?.length > 0) {
      const rel = kind === "place" ? urlJson.relations.find((r) => r.place || r.label) : urlJson.relations.find((r) => r[kind]);
      if (rel) {
        const actualKind = rel[kind] ? kind : rel.label ? "label" : "place";
        const a = rel[actualKind];
        urlHit = {
          kind: actualKind,
          mbid: a.id,
          name: a.name || null,
          disambiguation: a.disambiguation || ""
        };
      }
    }
    async function cacheAttention(matches) {
      if (key && !nameSearchFailed) {
        await writeIdbRecord(key, {
          mbid: null,
          entityType: null,
          name: null,
          mbUrl: null,
          disambiguation: "",
          resolvedVia: null,
          nameMatches: matches,
          // Omit when unknown (lookup failed) — never persist a guess.
          ...urlLinkedIds !== void 0 && { urlLinkedIds }
        });
      }
    }
    let resolved = null;
    let via = null;
    const heldBy = (a) => isArtist ? mbmHolds(a, displayName) || mbmHolds(a, searchName) : holdsName(a) ? "name" : null;
    const urlHolder = urlHit && urlHit.kind === kind && !(nameHit && nameHit.mbid === urlHit.mbid) ? (nameJson?.[resultKey] || []).find((a) => a.id === urlHit.mbid && heldBy(a)) : null;
    if (urlHolder) {
      resolved = urlHit;
      via = heldBy(urlHolder) === "alias" ? "both-alias" : "both";
      logDebug(`Match: ${displayName} \u2192 ${urlHolder.name} \u2014 the URL's artist holds the name${via === "both-alias" ? " as an alias" : ""} (${exactNameMatches.length} exact holder(s) in all)`);
    } else if (nameHit && urlHit) {
      if (nameHit.mbid === urlHit.mbid && nameHit.kind === urlHit.kind) {
        resolved = urlHit;
        via = nameHit.via === "alias" ? "both-alias" : "both";
      } else {
        await cacheAttention(nameMatches);
        return buildAttention(
          nameMatches,
          false,
          `name \u2192 ${nameHit.kind}/${nameHit.mbid}, URL \u2192 ${urlHit.kind}/${urlHit.mbid}`,
          urlLinkedIds
        );
      }
    } else if (urlHit) {
      resolved = urlHit;
      via = "url";
    } else if (isArtist) {
      let reviewReason = null;
      const ctx = contextHit(context, searchName, nameMatches);
      if (ctx) {
        resolved = { kind: "artist", mbid: ctx.gid, name: ctx.name, disambiguation: "" };
        via = "ctx";
        log.info(`Match: ${displayName} \u2192 ${ctx.name} \u2014 via release context (${ctx.rel || "related"}, ${ctx.via})`);
      } else if (nameHit) {
        const idJson = await mbThrottle.fetchJson(`${MB}/ws/2/artist?query=${encodeURIComponent(mbmIdentityQuery(searchName, "artist"))}&fmt=json&limit=${MBM_EXACT_LIMIT}`);
        const idn = mbmExactIdentity(idJson, searchName);
        logDebug(`exact identity "${searchName}": ${idn.status} (${idJson ? (idJson.artists || []).length + " of " + idJson.count : "no response"})`);
        if (idn.status === "unique" && idn.hit.id === nameHit.mbid) {
          resolved = nameHit;
          via = idn.via;
        } else if (idn.status === "failed") {
          return buildAttention(nameMatches, true, null, urlLinkedIds);
        } else {
          reviewReason = idn.status === "incomplete" ? `not provably unique (${idJson.count} artists match)` : idn.status === "ambiguous" ? `${idn.exact.length} artists carry the name` : "the exact holder did not verify";
          logDebug(`"${searchName}" not resolved by name \u2014 ${reviewReason}`);
        }
      } else if (exactNameMatches.length > 1) {
        reviewReason = `${exactNameMatches.length} artists carry the name`;
        logDebug(`"${searchName}" not resolved by name \u2014 ${reviewReason}`);
      }
      if (!resolved) {
        const cc = await coCreditHit(context, searchName);
        if (cc) {
          resolved = { kind: "artist", mbid: cc.gid, name: cc.name, disambiguation: "" };
          via = "cred";
          log.info(`Match: ${displayName} \u2192 ${cc.name} \u2014 via existing artist credits (co-credit search)`);
        }
      }
      if (!resolved && reviewReason) {
        logDebug(`"${searchName}" left to review \u2014 ${reviewReason}`);
        await cacheAttention(nameMatches);
        return buildAttention(nameMatches, false, reviewReason, urlLinkedIds);
      }
    } else if (nameHit) {
      resolved = nameHit;
      via = "name";
    }
    if (resolved) {
      const mbUrl = `${MB}/${resolved.kind}/${resolved.mbid}`;
      let finalName = resolved.name;
      let finalDisam = resolved.disambiguation;
      let liveAliases = null;
      if (via === "url" && resolved.kind === "artist" && isArtist) {
        const live = await mbThrottle.fetchJson(`${MB}/ws/2/artist/${resolved.mbid}?inc=aliases&fmt=json`);
        if (live && live.id === resolved.mbid) {
          liveAliases = (live.aliases || []).map((al) => al && al.name).filter(Boolean);
          if (!finalName) {
            finalName = live.name || null;
            finalDisam = live.disambiguation || "";
          }
          const held = heldBy({ name: live.name, aliases: live.aliases || [] });
          if (held) via = held === "alias" ? "both-alias" : "both";
          logDebug(`"${displayName}" \u2192 ${live.name}: found by URL; the artist ${held ? `holds the name as its ${held} \u2192 ${via}` : `doesn't carry the name (${liveAliases.length} alias(es))`}`);
        } else logDebug(`"${displayName}": the URL's artist ${resolved.mbid} couldn't be read \u2014 stays "url"`);
      }
      if (!finalName) {
        const info = await fetchMbEntityInfo(resolved.kind, resolved.mbid);
        finalName = info.name || null;
        finalDisam = info.disambiguation || "";
      }
      if (key) {
        await writeIdbRecord(key, {
          mbid: resolved.mbid,
          entityType: resolved.kind,
          name: finalName,
          disambiguation: finalDisam || "",
          resolvedVia: via,
          // Omit when unknown (lookup failed) — never persist a guess.
          ...urlLinkedIds !== void 0 && { urlLinkedIds }
        });
      }
      const out = buildResolved(mbUrl, finalName, finalDisam || "", via, resolved.kind, false, urlLinkedIds);
      if (resolved.kind === "artist") {
        const cand = nameMatches.find((c) => c.id === resolved.mbid);
        const self = !cand && via === "ctx" && context && context.related ? context.related.find((x) => x.gid === resolved.mbid && x.rel === "self") : null;
        if (cand && Array.isArray(cand.aliases)) out.mbAliases = cand.aliases;
        else if (liveAliases) out.mbAliases = liveAliases;
        else if (self && Array.isArray(self.aliases)) out.mbAliases = self.aliases;
        logDebug(`"${displayName}" \u2192 ${finalName}: aliases ${out.mbAliases ? `known (${out.mbAliases.length})` : "unknown"} for the "+ alias" check`);
      }
      return out;
    }
    await cacheAttention(nameMatches);
    return buildAttention(nameMatches, nameSearchFailed, null, urlLinkedIds);
  }
  async function resolveAll(entities, opts) {
    const { kindOf, progressLi, bypassIdb, progressLabel, context } = opts;
    const CONCURRENCY = 5;
    const MIN_GAP_MS = 50;
    let done = 0;
    const inFlightNames = /* @__PURE__ */ new Set();
    function setProgress() {
      if (entities.length > 0) {
        try {
          _setProgressPct(done / entities.length * 100);
        } catch (_) {
        }
      }
      if (!progressLi) return;
      const remaining = entities.length - done;
      const checking = inFlightNames.size ? ` \u2014 checking <em>${[...inFlightNames].join(", ")}</em>` : "";
      progressLi.innerHTML = `${progressLabel}\u2026 <strong>${done}/${entities.length}</strong> done${checking}` + (remaining === 0 ? " \u2714" : ` (${remaining} remaining)`);
      try {
        const plain = `${progressLabel}\u2026 ${done}/${entities.length} done` + (inFlightNames.size ? ` \u2014 checking ${[...inFlightNames].join(", ")}` : "") + (remaining === 0 ? " \u2714" : ` (${remaining} remaining)`);
        document.querySelector(".discogs-bar")?._setProgress?.(null, plain);
      } catch (_) {
      }
    }
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const queue = entities.map((e, i) => ({ entity: e, index: i }));
    const results = new Array(entities.length);
    setProgress();
    async function worker(slotIndex) {
      const tag = `worker#${slotIndex}`;
      logDebug(`${tag} starting (stagger ${slotIndex * MIN_GAP_MS}ms)`);
      await delay(slotIndex * MIN_GAP_MS);
      let processed = 0;
      while (queue.length > 0) {
        const { entity, index } = queue.shift();
        const kind = kindOf(entity);
        if (!kind) {
          logDebug(`${tag} skip "${entity?.name || "?"}" \u2014 no resolvable kind`);
          done++;
          setProgress();
          continue;
        }
        const displayName = kind === "artist" ? entity.anv && entity.anv.trim() || entity.name : entity.name;
        inFlightNames.add(displayName);
        setProgress();
        const t0 = Date.now();
        logDebug(`${tag} resolving "${displayName}" (${kind})`);
        results[index] = await resolveEntity(entity, kind, { bypassIdb, context });
        const elapsed = Date.now() - t0;
        const r = results[index];
        const outcome = r?.type === "resolved" ? `resolved via ${r.logEntry?.via || "?"}${r.logEntry?.fromCache ? " (cache)" : ""}` : r?.type === "attention" ? `unresolved (${r.nameMatches?.length || 0} candidates)` : "skipped";
        logDebug(`${tag} "${displayName}" -> ${outcome} in ${elapsed}ms`);
        inFlightNames.delete(displayName);
        done++;
        processed++;
        setProgress();
      }
      logDebug(`${tag} finished (${processed} entit${processed === 1 ? "y" : "ies"})`);
    }
    const slots = Math.min(CONCURRENCY, entities.length);
    logDebug(`resolveAll: ${entities.length} entit${entities.length === 1 ? "y" : "ies"}, ${slots} worker slot(s)`);
    if (slots > 0) await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));
    logDebug(`resolveAll: done`);
    return { allResults: results.filter(Boolean) };
  }
  var ARTIST_KIND = () => "artist";
  var ENTITY_KIND = (e) => e?.entityType || "artist";
  var COMPANY_KIND = (c) => ENTITY_TYPE_MAP[c.entity_type_name]?.entityType ?? null;

  // src/derive/remix.js
  var STRONG = /* @__PURE__ */ new Set([
    "extended",
    "original",
    "radio",
    "instrumental",
    "acapella",
    "acappella",
    "acoustic",
    "album",
    "single",
    "main",
    "long",
    "short",
    "full",
    "special",
    "bonus",
    "alternative",
    "alternate",
    "vip",
    "rmx",
    "redux",
    "dancefloor",
    "unplugged",
    "demo",
    "remastered",
    // remix-family words, in case a lead carries a second one
    // ("Extended Remix Edit"): strip them off the trailing edge too.
    "dub",
    "edit",
    "mix",
    "remix",
    "rework",
    "remodel",
    "reshuffle",
    "reprise",
    "version",
    "re-edit",
    "reedit"
  ]);
  var WEAK = /* @__PURE__ */ new Set([
    "club",
    "deep",
    "tech",
    "soulful",
    "disco",
    "electro",
    "house",
    "techno",
    "progressive",
    "tribal",
    "vocal",
    "classic",
    "clean",
    "dirty",
    "censored",
    "uncensored",
    "studio",
    "live",
    "the",
    "a",
    "an"
  ]);
  var SEP_RE = /\s*(?:&|\+|,|\/|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i;
  var isVinyl = (t) => /^\d+(?:"|''|”|inch|in)?$/.test(t);
  var norm = (t) => t.toLowerCase().replace(/[.''`]+$/, "");
  var isStrong = (t) => {
    const l = norm(t);
    return STRONG.has(l) || isVinyl(l);
  };
  var isDecorator = (t) => {
    const l = norm(t);
    return STRONG.has(l) || WEAK.has(l) || isVinyl(l);
  };
  var TRAILING_RE = /^(.+?)\s+((?:re[-_ ]?)?(?:remix|rework|remodel|reshuffle|reprise|edit|dub|mix))(?:es|ed|s|d)?$/i;
  var BY_RE = /^(?:re[-_ ]?)?(?:remix|rework|remodel|reshuffle|rerub)(?:es|ed|s|d)?\s+by\s+(.+)$/i;
  function cleanName(raw) {
    let s = String(raw || "").replace(/\s*[([].*$/, "").replace(/[)\]]+\s*$/, "");
    let tokens = s.trim().split(/\s+/).filter(Boolean);
    const pIdx = tokens.findIndex((t) => /['']s$/i.test(t));
    if (pIdx !== -1) {
      tokens = tokens.slice(0, pIdx + 1);
      tokens[pIdx] = tokens[pIdx].replace(/['']s$/i, "");
    }
    while (tokens.length && isStrong(tokens[tokens.length - 1])) tokens.pop();
    if (!tokens.length) return null;
    if (tokens.every(isDecorator)) return null;
    const name = tokens.join(" ").replace(/['']s$/i, "").trim();
    if (!/[A-Za-z0-9]/.test(name)) return null;
    return name;
  }
  function parseRemixTitle(title) {
    const result = { base: title || "", remixers: [], kind: null };
    if (!title || typeof title !== "string") return result;
    const groups = title.match(/[([][^)\]]*[)\]]/g);
    if (!groups) return result;
    for (const g of groups) {
      const inner = g.slice(1, -1).trim();
      let captured = null, kind = null;
      let m = BY_RE.exec(inner);
      if (m) {
        captured = m[1];
        kind = "remix";
      } else {
        m = TRAILING_RE.exec(inner);
        if (m) {
          captured = m[1];
          kind = /mix$/i.test(m[2]) && !/remix$/i.test(m[2]) ? "mix" : /edit$/i.test(m[2]) ? "edit" : /dub$/i.test(m[2]) ? "dub" : "remix";
        }
      }
      if (!captured) continue;
      const names = captured.split(SEP_RE).map(cleanName).filter(Boolean);
      if (!names.length) continue;
      result.kind = result.kind || kind;
      for (const n of names) if (!result.remixers.includes(n)) result.remixers.push(n);
      result.base = result.base.replace(g, "").replace(/\s{2,}/g, " ").trim();
    }
    return result;
  }
  function deriveRemixRoles(tracklist, releaseMbid) {
    if (!Array.isArray(tracklist)) return [];
    const roles = [];
    for (const track of tracklist) {
      if (!track || track.type_ && track.type_ !== "track") continue;
      if (!track.title) continue;
      const { remixers } = parseRemixTitle(track.title);
      for (const name of remixers) {
        const artist = { name, anv: "", resource_url: "", _derived: true };
        if (releaseMbid) artist._cacheKey = `titles-remix/${releaseMbid}/${name.toLowerCase().trim()}`;
        roles.push({
          linkType: "remixer",
          artist,
          track,
          creditedAs: name,
          attributes: [],
          entityType: "artist"
        });
      }
    }
    return roles;
  }

  // src/data/special-purpose.js
  var SPECIAL_PURPOSE_ARTISTS = /* @__PURE__ */ new Set([
    "125ec42a-7229-4250-afc5-e057484327fe",
    // [unknown]
    "f731ccc4-e22a-43af-a747-64213329e088",
    // [anonymous]
    "33cf029c-63b0-41a0-9855-be2a3665fb3b",
    // [data]
    "314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc",
    // [dialogue]
    "eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61",
    // [no artist]
    "9be7f096-97ec-4615-8957-8d40b5dcbc41",
    // [traditional]
    "89ad4ac3-39f7-470e-963a-56509c546377",
    // Various Artists
    "7e84f845-ac16-41fe-9ff8-df12eb32af55",
    // MusicBrainz Test Artist
    "66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49",
    // [Disney]
    "a0ef7e1d-44ff-4039-9435-7d5fefdeecc9",
    // [theatre]
    "90068d37-bae7-4292-be4a-704c145bd616",
    // [church chimes]
    "80a8851f-444c-4539-892b-ad2a49292aa9"
    // [language instruction]
  ]);

  // src/edit-note.js
  function buildEditNote(sourceUrl, opts, extraLines, sourceLabel) {
    const s = GM_info.script;
    const mbUrl = location.href.split(/[?#]/)[0].replace(/\/edit-relationships$/, "");
    const homepage = s.homepageURL || s.homepage || "https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md";
    const header = s.name + " v" + s.version + " by " + s.author + " - " + homepage;
    const raw = String(sourceUrl || "");
    const sourceName = sourceNameForUrl(raw);
    const cleanSource = sourceName === "YouTube Music" ? raw.split("#")[0] : raw.split(/[?#]/)[0];
    const lines = [
      header,
      "",
      "Release URL: " + mbUrl,
      // #408: a consolidated "Import all" run passes an explicit source label (it has no single
      // URL). Otherwise: the source URL's provider, or the title-derived "Titles" source (#271).
      sourceLabel ? "Source: " + sourceLabel : cleanSource ? sourceName + " URL: " + cleanSource : "Source: track titles"
    ];
    if (opts) lines.push("Options: " + opts);
    if (extraLines) lines.push(...Array.isArray(extraLines) ? extraLines : [extraLines]);
    return lines.join("\n");
  }
  function buildCreateNote(action = "Created the entity") {
    const s = GM_info.script;
    const homepage = s.homepageURL || s.homepage || "https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md";
    const header = s.name + " v" + s.version + " by " + s.author + " - " + homepage;
    const mbUrl = location.href.split(/[?#]/)[0].replace(/\/edit(-relationships)?$/, "");
    return header + "\n\n" + action + " while importing credits onto " + mbUrl;
  }
  function splitOurNote(note) {
    const headerPrefix = GM_info.script.name + " v";
    const lines = String(note || "").split("\n");
    const idx = lines.findIndex((l) => l.startsWith(headerPrefix));
    if (idx === -1) return null;
    const pre = lines.slice(0, idx).join("\n").replace(/\s+$/, "");
    const our = lines.slice(idx);
    const relIdx = our.findIndex((l) => /^Release URL:/i.test(l));
    return {
      pre,
      header: our[0],
      releaseLine: relIdx !== -1 ? our[relIdx] : "",
      body: (relIdx !== -1 ? our.slice(relIdx + 1) : our.slice(1)).join("\n").trim()
    };
  }
  function blockSourceKey(block) {
    const first = (String(block).split("\n")[0] || "").trim();
    const m = first.match(/^([A-Za-z][A-Za-z ]*?)\s+URL:/);
    if (m) return m[1].trim().toLowerCase();
    if (/^Source:\s*track titles/i.test(first)) return "titles";
    return first.toLowerCase();
  }
  function combineEditNote(existingNote, ourNote) {
    const fresh = splitOurNote(ourNote);
    if (!fresh) return ourNote;
    const newKey = blockSourceKey(fresh.body);
    const prev = splitOurNote(existingNote);
    const keptBlocks = prev ? prev.body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean).filter((b) => blockSourceKey(b) !== newKey) : [];
    const stacked = [fresh.body, ...keptBlocks].join("\n\n");
    const ourBlock = `${fresh.header}

${fresh.releaseLine}
${stacked}`;
    const pre = prev ? prev.pre : String(existingNote || "").replace(/\s+$/, "");
    return pre ? `${pre}

${ourBlock}` : ourBlock;
  }

  // src/alias-add.js
  var SPECIAL = new Set(MBM_SPECIAL_PURPOSE);
  function aliasHeldBy(artist, credit) {
    if (!artist || !credit) return true;
    const aliases = (artist.aliases || []).map((a) => typeof a === "string" ? { name: a } : a).filter(Boolean);
    return !!mbmHolds({ name: artist.name, aliases }, credit);
  }
  function wantsAliasButton(entityType, artist, credit) {
    if (entityType !== "artist" || !artist || !artist.id || SPECIAL.has(artist.id)) return false;
    if (!Array.isArray(artist.aliases)) return !aliasHeldBy({ name: artist.name, aliases: [] }, credit);
    return !aliasHeldBy(artist, credit);
  }
  var aliasFormUrl = (mbid) => `${location.origin}/artist/${mbid}/add-alias`;
  async function liveHolds(mbid, name) {
    const t0 = Date.now();
    logDebug(`+ alias: checking ${mbid}'s live aliases for "${name}"`);
    let why = "";
    const live = await Promise.race([
      mbnFetch(`${location.origin}/ws/2/artist/${mbid}?inc=aliases&fmt=json`, { headers: { Accept: "application/json" } }, { background: false }).then((r) => {
        if (!r) {
          why = "cancelled";
          return null;
        }
        if (!r.ok) {
          why = "HTTP " + r.status;
          return null;
        }
        return r.json();
      }).catch((e) => {
        why = e && e.message || String(e);
        return null;
      }),
      new Promise((res) => setTimeout(() => {
        why = `no answer in ${LIVE_TIMEOUT / 1e3}s`;
        res(null);
      }, LIVE_TIMEOUT))
    ]);
    const out = live && live.id ? { held: aliasHeldBy({ name: live.name, aliases: live.aliases || [] }, name), artistName: live.name } : null;
    if (out) logDebug(`+ alias: ${out.artistName} ${out.held ? "already carries" : "doesn't carry"} "${name}" (${Date.now() - t0} ms)`);
    else log.warn(`+ alias: couldn't read ${mbid}'s live aliases (${why || "no artist in the answer"}, ${Date.now() - t0} ms) \u2014 going ahead without the check`);
    return out;
  }
  var LIVE_TIMEOUT = 8e3;
  async function aliasNowHeld(mbid, name) {
    const live = await liveHolds(mbid, name);
    return live ? live.held : null;
  }
  async function openAddAliasForm(mbid, name, note) {
    const q = new URLSearchParams({ "edit-alias.name": name, "edit-alias.sort_name": name });
    if (note) q.set("edit-alias.edit_note", note);
    const url = aliasFormUrl(mbid) + "?" + q.toString();
    const tab = window.open("about:blank", "_blank");
    const live = await liveHolds(mbid, name);
    if (live && live.held) {
      try {
        if (tab) tab.close();
      } catch (e) {
      }
      log.info(`+ alias: "${name}" is already a name/alias of ${live.artistName} \u2014 form not opened`);
      return { already: true };
    }
    log.info(`+ alias: opening MusicBrainz's add-alias form for "${name}" \u2014 ${url.split("?")[0]}`);
    let how = "the blank tab";
    try {
      if (!tab || tab.closed) throw new Error(tab ? "the blank tab was closed" : "no tab handle (popup blocked?)");
      tab.location.href = url;
    } catch (e) {
      how = "a new tab \u2014 " + (e && e.message || e);
      try {
        if (tab) tab.close();
      } catch (e2) {
      }
      window.open(url, "_blank");
    }
    logDebug(`+ alias: form opened in ${how}`);
    return { already: false };
  }
  async function submitAliasBackground(mbid, name, note) {
    const url = aliasFormUrl(mbid);
    const live = await liveHolds(mbid, name);
    if (live && live.held) {
      log.info(`+ alias: "${name}" is already a name/alias of ${live.artistName} \u2014 nothing submitted`);
      return { already: true };
    }
    const html = await fetch(url, { credentials: "same-origin" }).then((r) => {
      if (!r.ok) throw new Error(`GET add-alias HTTP ${r.status}`);
      return r.text();
    });
    const form = new DOMParser().parseFromString(html, "text/html").querySelector("form.edit-alias");
    if (!form) throw new Error("MusicBrainz did not serve an alias form (still logged in?)");
    const p = new URLSearchParams();
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) p.set(el.name, el.value || "1");
        return;
      }
      p.set(el.name, el.value || "");
    });
    p.set("edit-alias.name", name);
    p.set("edit-alias.sort_name", name);
    p.set("edit-alias.type_id", "");
    p.set("edit-alias.locale", "");
    p.delete("edit-alias.primary_for_locale");
    if (note) p.set("edit-alias.edit_note", note);
    log.info(`+ alias: submitting "${name}" as an alias of ${url.split("/artist/")[1].split("/")[0]} in the background (no type)`);
    const res = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: p.toString() });
    if (!res.ok) throw new Error(`add-alias submit HTTP ${res.status}`);
    if (!/\/add-alias\b/.test(res.url)) return res.url;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const msg = [...doc.querySelectorAll(".error, .errors li, p.error")].map((n) => (n.textContent || "").trim()).filter(Boolean)[0];
    throw new Error(msg || "MusicBrainz rejected the alias without saying why");
  }

  // src/split-credit.js
  var SEP_RE2 = /\s*(\bfeat\.?|\bft\.?|\bfeaturing|&|\band\b|\bvs\.?|\bwith\b|×|・|,|;)\s*/gi;
  var stripDiscogsNum = (s) => String(s || "").replace(/\s+\(\d+\)$/, "");
  function splitCreditName(name) {
    const parts = stripDiscogsNum(name).split(SEP_RE2).filter((_, i) => i % 2 === 0).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return [];
    const words = (p) => p.split(/\s+/);
    const last = words(parts[parts.length - 1]);
    if (last.length > 1 && parts.slice(0, -1).every((p) => words(p).length === 1)) {
      const surname = last[last.length - 1];
      return parts.map((p, i) => i === parts.length - 1 ? p : `${p} ${surname}`);
    }
    return parts;
  }
  var splitKey = (origKey, i) => `${origKey}#split${i}`;
  function expandSplitRoles(roles, splits, keyOfEntity) {
    if (!splits || !splits.size || !roles) return roles;
    const out = [];
    for (const role of roles) {
      const parts = role?.artist ? splits.get(keyOfEntity(role.artist)) : null;
      if (!parts) {
        out.push(role);
        continue;
      }
      for (const p of parts) {
        out.push({ ...role, creditedAs: "", artist: { name: p.name, anv: "", _syntheticKey: p.key, _splitOf: keyOfEntity(role.artist) } });
      }
    }
    return out;
  }

  // src/review-table.js
  var _urlCheckSessionCache = /* @__PURE__ */ new Map();
  var VIA_LEVEL = { both: 0, "both-alias": 0, url: 1, ctx: 1, cache: 1, name: 2, alias: 2, cred: 3, typo: 3 };
  var matchLevelOf = (via) => via in VIA_LEVEL ? VIA_LEVEL[via] : null;
  var CUTOFF_KEY = "ch-match-cutoff";
  var CUTOFF_DEFAULT = 1;
  function loadCutoff() {
    try {
      const v = GM_getValue(CUTOFF_KEY, CUTOFF_DEFAULT);
      return Number.isInteger(v) && v >= 0 && v < MATCH_LEVELS.length ? v : CUTOFF_DEFAULT;
    } catch (e) {
      return CUTOFF_DEFAULT;
    }
  }
  function makeLevelDot(level, title) {
    const dot = document.createElement("span");
    dot.className = "ch-level-dot";
    dot.style.cssText = `width:11px;height:11px;border-radius:50%;display:inline-block;flex:0 0 auto;border:1px solid rgba(0,0,0,.2);background:${level == null ? "var(--mbu-border-strong)" : MATCH_LEVELS[level].color};`;
    dot.dataset.tip = title || (level == null ? "Picked by you" : `${MATCH_LEVELS[level].label}: ${MATCH_LEVELS[level].hint}`);
    return dot;
  }
  function ensureCreatingStyle() {
    if (document.getElementById("ch-creating-style")) return;
    const st = document.createElement("style");
    st.id = "ch-creating-style";
    st.textContent = "@keyframes ch-creating-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(st);
  }
  async function showReviewTable(allResults, rolesMap, companiesRolesMap, opts) {
    rolesMap = rolesMap || /* @__PURE__ */ new Map();
    companiesRolesMap = companiesRolesMap || /* @__PURE__ */ new Map();
    const onRefresh = opts?.onRefresh || null;
    const headerSlot = opts?.headerSlot || null;
    const importSourceName = opts?.sourceName || "Discogs";
    const sourceIcon = opts?.sourceIcon || "";
    const entitySources = opts?.entitySources || null;
    const sourceBadgeIcon = opts?.sourceBadgeIcon || (() => "");
    const _preloadedNames = /* @__PURE__ */ new Map();
    const _nullNames = allResults.filter((r) => r.type === "resolved" && r.mbUrl && !r.mbName);
    for (const r of _nullNames) {
      const rUrl = r.entity?.resource_url;
      try {
        const idbKey = idbKeyForEntity(r.entity);
        const rec = await readIdbRecord(idbKey);
        if (rec?.name) {
          _preloadedNames.set(rUrl, { name: rec.name, dis: rec.disambiguation || "" });
          continue;
        }
        const mbid = (r.mbUrl || "").split("/").pop().replace(/[^a-f0-9-]/g, "").substring(0, 36);
        if (!mbid) continue;
        const et = r.entityType || "artist";
        const data = await mbThrottle.fetchJson(`https:${MB}/ws/2/${et}/${mbid}?fmt=json`);
        if (data?.name) {
          _preloadedNames.set(rUrl, { name: data.name, dis: data.disambiguation || "" });
          if (idbKey) {
            await writeIdbRecord(idbKey, {
              mbid,
              entityType: et,
              name: data.name,
              disambiguation: data.disambiguation || ""
              // No resolvedVia change — this is just a name-display
              // populate; whatever set the cached mbid stays the
              // source of truth for `resolvedVia`.
            });
          }
        }
      } catch (e) {
      }
    }
    return new Promise((resolve) => {
      opts?.registerAbort?.(() => resolve(null));
      const rowState = /* @__PURE__ */ new Map();
      let cutoff = loadCutoff();
      function applyCutoff(r) {
        if (!r._auto) {
          if (r.type !== "resolved" || !r.mbUrl) return;
          r._auto = { type: r.type, mbUrl: r.mbUrl, mbName: r.mbName, mbDisambig: r.mbDisambig, logEntry: r.logEntry, nameMatches: r.nameMatches, ambiguityReason: r.ambiguityReason };
        }
        const a = r._auto;
        const via = a.logEntry?.via;
        const level = matchLevelOf(via);
        if (level == null || level <= cutoff) {
          Object.assign(r, { type: a.type, mbUrl: a.mbUrl, mbName: a.mbName, mbDisambig: a.mbDisambig, logEntry: a.logEntry, nameMatches: a.nameMatches, ambiguityReason: a.ambiguityReason });
          delete r._below;
          return;
        }
        const mbid = (a.mbUrl || "").replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
        const name = a.mbName || a.logEntry?.mbName || mbid;
        const cand = { id: mbid, name, disambiguation: a.mbDisambig || a.logEntry?.mbDisambig || "" };
        r.type = "attention";
        r.mbUrl = null;
        r.mbName = null;
        r.mbDisambig = "";
        r.nameMatches = [cand, ...(a.nameMatches || []).filter((c) => c && c.id !== mbid)];
        r.ambiguityReason = `below the cutoff: ${VIA_STYLES[via]?.text || via}`;
        r._below = { via, level, mbid };
        logDebug(`cutoff: "${r.displayName || r.entity?.name}" \u2192 ${name} (${via}, ${MATCH_LEVELS[level].label}) is below ${MATCH_LEVELS[cutoff].label}; offered, not selected`);
      }
      const rowSearchInputs = /* @__PURE__ */ new Map();
      const linkState = /* @__PURE__ */ new Map();
      const rowLinkChips = /* @__PURE__ */ new Map();
      let linksNote = null;
      const splits = /* @__PURE__ */ new Map();
      function updateLinksBadge() {
        if (!linksNote) return;
        const n = [...linkState.values()].filter((v) => v === "none").length;
        linksNote.textContent = n ? `\u{1F517} ${n} link${n === 1 ? "" : "s"}` : "";
        linksNote.style.display = n ? "" : "none";
        linksNote.classList.toggle("clickable", n > 0);
      }
      const keyOf = (r) => r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
      let _linkJumpIdx = -1;
      function jumpNextLink() {
        const n = allResults.length;
        let found = -1;
        for (let step = 1; step <= n; step++) {
          const i = (_linkJumpIdx + step) % n;
          if (linkState.get(keyOf(allResults[i])) === "none") {
            found = i;
            break;
          }
        }
        if (found === -1) return;
        _linkJumpIdx = found;
        const key = keyOf(allResults[found]);
        const chip = rowLinkChips.get(key);
        const target = chip || rowSearchInputs.get(key);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        if (chip) {
          const o = chip.style.boxShadow;
          chip.style.boxShadow = "0 0 0 3px rgba(232,119,29,0.6)";
          setTimeout(() => {
            chip.style.boxShadow = o;
          }, 1200);
        }
      }
      const attentionCount = allResults.filter((r) => r.type === "attention").length;
      const mismatchCount = allResults.filter((r) => {
        if (r.type !== "resolved") return false;
        const e = r.logEntry;
        return e && e.mbName && e.displayName && e.mbName.toLowerCase().trim() !== e.displayName.toLowerCase().trim();
      }).length;
      const URL_CHECK_CONCURRENCY = 5;
      const urlCheckPending = [];
      let urlCheckRunning = 0;
      let urlCheckStarted = false;
      function queuedUrlCheck(fn) {
        return new Promise((resolve2, reject) => {
          urlCheckPending.push({ fn, resolve: resolve2, reject });
          if (urlCheckRunning < URL_CHECK_CONCURRENCY) {
            runUrlCheckWorker();
          }
        });
      }
      async function runUrlCheckWorker() {
        urlCheckRunning++;
        while (urlCheckPending.length > 0) {
          const { fn, resolve: resolve2, reject } = urlCheckPending.shift();
          try {
            resolve2(await fn());
          } catch (e) {
            reject(e);
          }
        }
        urlCheckRunning--;
      }
      const VIA_STYLES = {
        both: { text: "name+url", color: "var(--mbu-ok)" },
        // high confidence
        "both-alias": { text: "alias+url", color: "var(--mbu-ok)" },
        // #613 URL and an exact ALIAS agree
        url: { text: "url", color: "var(--mbu-accent-text)" },
        name: { text: "name", color: "var(--mbu-accent-text)" },
        alias: { text: "alias", color: "var(--mbu-accent-text)" },
        // #613 exact alias of the MB artist (provably unique)
        ctx: { text: "context", color: "var(--mbu-ok)" },
        // #612 a related artist of the release artist
        cred: { text: "co-credit", color: "var(--mbu-accent-text)" },
        // #613 co-credit search
        typo: { text: "similar name", color: "var(--mbu-accent-text)" },
        // #771 ⚛ All: a typo / middle-initial twin of a matched name
        user: { text: "user", color: "var(--mbu-text-dim)" },
        cache: { text: "cache", color: "var(--mbu-text-dim)" }
        // legacy: original mechanism unknown
      };
      function viaCfg(via, fromCache) {
        const base = VIA_STYLES[via];
        if (!base) return null;
        if (fromCache && via !== "cache") {
          return { text: `${base.text} (cache)`, color: base.color };
        }
        return base;
      }
      function makeViaBadge(via, fromCache) {
        const cfg = viaCfg(via, fromCache);
        if (!cfg) return null;
        const span = document.createElement("span");
        span.textContent = cfg.text;
        span.dataset.tip = fromCache && via !== "cache" ? `Resolved via ${via}, served from cache` : `Resolved via ${via}`;
        span.style.cssText = `font-size:0.68rem;background:var(--mbu-bg-raised);color:${cfg.color};padding:0 0.35rem;border-radius:8px;border:1px solid var(--mbu-border);flex-shrink:0;`;
        return span;
      }
      const creditOverrides = /* @__PURE__ */ new Map();
      const existingCreditByMbid = computeExistingCreditByMbid();
      function computeExistingCreditByMbid() {
        const counts = /* @__PURE__ */ new Map();
        const MB2 = pageWindow?.MB;
        const iterate = MB2?.tree?.iterate;
        if (!iterate) return counts;
        const valueOf = (yielded) => Array.isArray(yielded) ? yielded[1] : yielded;
        const isTree = (x) => x && typeof x === "object" && x.size != null && (x.left !== void 0 || x.right !== void 0 || x.value !== void 0);
        function tally(rel) {
          if (!rel || rel._status === 2) return;
          for (const side of [1, 0]) {
            const entity = rel[`entity${side}`];
            const tgt = entity?.gid;
            if (!tgt) continue;
            const credit = rel[`entity${side}_credit`] || entity.name;
            if (!credit) continue;
            if (!counts.has(tgt)) counts.set(tgt, /* @__PURE__ */ new Map());
            const m = counts.get(tgt);
            m.set(credit, (m.get(credit) || 0) + 1);
          }
        }
        function walkRels(rels) {
          if (!isTree(rels)) return;
          for (const e of iterate(rels)) tally(valueOf(e));
        }
        function walkPhraseGroups(phraseGroups) {
          if (!isTree(phraseGroups)) return;
          for (const e of iterate(phraseGroups)) {
            const pg = valueOf(e);
            if (pg?.relationships) walkRels(pg.relationships);
          }
        }
        function walkTypeGroups(byTypeId) {
          if (!isTree(byTypeId)) return;
          for (const e of iterate(byTypeId)) {
            const tg = valueOf(e);
            if (tg?.phraseGroups) walkPhraseGroups(tg.phraseGroups);
          }
        }
        function walkPerSource(perSource) {
          if (!isTree(perSource)) return;
          for (const e of iterate(perSource)) {
            walkTypeGroups(valueOf(e));
          }
        }
        function walkSource(root) {
          if (!isTree(root)) return;
          for (const e of iterate(root)) {
            walkPerSource(valueOf(e));
          }
        }
        try {
          walkSource(MB2.relationshipEditor?.state?.existingRelationshipsBySource);
        } catch (e) {
        }
        try {
          walkSource(MB2.relationshipEditor?.state?.relationshipsBySource);
        } catch (e) {
        }
        const out = /* @__PURE__ */ new Map();
        for (const [mbid, m] of counts) {
          let best = null, bestN = 0;
          for (const [credit, n] of m) {
            if (n > bestN) {
              best = credit;
              bestN = n;
            }
          }
          if (best) out.set(mbid, best);
        }
        return out;
      }
      const panel = document.createElement("div");
      panel.style.cssText = "border:2px solid var(--mbu-warn);border-radius:0.5rem;background:var(--mbu-bg);padding:1rem 1.5rem;margin:0.5rem 0;";
      {
        const _pb = document.getElementById("discogs-progress-bar");
        if (_pb) _pb.style.display = "none";
      }
      const _bar = document.querySelector(".discogs-bar");
      if (_bar) {
        _hideBar();
        const _r2 = _bar.querySelector(".discogs-bar-row2");
        if (_r2) _r2.style.marginTop = "";
      }
      const heading = document.createElement("div");
      heading.style.cssText = "display:flex;align-items:center;gap:0.6rem;margin:0 0 0.5rem;padding:0.4rem 0.6rem;border-radius:0.3rem;background:var(--mbu-warn-bg);border:1px solid var(--mbu-warn);";
      if (onRefresh) {
        const refreshBtn = document.createElement("button");
        refreshBtn.textContent = "\u{1F504} Refresh from MB";
        refreshBtn.dataset.tip = "Resolve every entity again\nFrom MusicBrainz\u2019s API, past the cache in this browser";
        refreshBtn.style.cssText = "font-size:0.8rem;cursor:pointer;padding:0.2rem 0.5rem;border:1px solid var(--mbu-warn);border-radius:3px;background:var(--mbu-bg);color:var(--mbu-warn);flex-shrink:0;";
        refreshBtn.addEventListener("click", () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "\u{1F504} Refreshing\u2026";
          (panelLi || panel).remove();
          if (headerSlot) headerSlot.replaceChildren();
          onRefresh().then((freshResults) => {
            showReviewTable(freshResults, rolesMap, companiesRolesMap, opts).then((confirmedMap) => resolve(confirmedMap));
          });
        });
        heading.appendChild(refreshBtn);
      }
      const headingText = document.createElement("span");
      headingText.style.cssText = "font-weight:bold;font-size:1rem;color:var(--mbu-warn);flex:1;";
      headingText.textContent = `Review \u2014 ${allResults.length} entit${allResults.length === 1 ? "y" : "ies"}`;
      heading.appendChild(headingText);
      heading.appendChild(buildCutoffChip());
      panel.appendChild(heading);
      function buildCutoffChip() {
        const wrap = document.createElement("span");
        wrap.className = "ch-cutoff";
        wrap.style.cssText = "display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--mbu-text);flex-shrink:0;";
        const lbl = document.createElement("b");
        lbl.textContent = "Cutoff";
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ch-cutoff-chip";
        chip.style.cssText = "display:inline-flex;align-items:center;gap:0.35rem;border:1px solid var(--mbu-border);border-radius:14px;padding:2px 10px;background:var(--mbu-bg);color:var(--mbu-text);cursor:pointer;font:inherit;";
        const paint = () => {
          wrap.dataset.tip = "The lowest match confidence picked automatically\n" + MATCH_LEVELS.map((lv, i) => `{${lv.color}${i === cutoff ? " on" : i > cutoff ? " off" : ""}} ${lv.label}: ${lv.hint}`).join("\n") + "\nA match below it is offered first on its row, not picked.";
          chip.replaceChildren(makeLevelDot(cutoff), document.createTextNode(MATCH_LEVELS[cutoff].label));
          const caret = document.createElement("span");
          caret.textContent = "\u25BE";
          caret.style.cssText = "color:var(--mbu-text-weak);font-size:0.7rem;padding-left:0.2rem;";
          chip.appendChild(caret);
        };
        paint();
        let menu = null;
        const close = () => {
          menu?.remove();
          menu = null;
          document.removeEventListener("mousedown", onDown, true);
        };
        const onDown = (ev) => {
          if (menu?.contains(ev.target) || chip.contains(ev.target)) return;
          close();
          document.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
          }, { capture: true, once: true });
        };
        chip.addEventListener("click", () => {
          if (menu) {
            close();
            return;
          }
          menu = document.createElement("div");
          menu.className = "ch-cutoff-menu";
          const rc = chip.getBoundingClientRect();
          menu.style.cssText = `position:fixed;z-index:var(--mbu-z-pop);top:${rc.bottom + 4}px;left:${Math.max(8, rc.right - 360)}px;width:360px;max-width:calc(100vw - 16px);box-sizing:border-box;background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:7px;box-shadow:var(--mbu-shadow-lg);padding:4px;font-size:0.82rem;`;
          MATCH_LEVELS.forEach((lv, i) => {
            const mi = document.createElement("div");
            mi.className = "ch-cutoff-mi";
            mi.dataset.level = lv.key;
            mi.style.cssText = "display:flex;align-items:center;gap:0.55rem;padding:5px 10px 5px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;" + (i === cutoff ? "background:var(--mbu-bg-hover);font-weight:bold;" : "");
            const hint = document.createElement("small");
            hint.textContent = lv.hint;
            hint.style.cssText = "margin-left:auto;padding-left:1rem;color:var(--mbu-text-weak);font-weight:normal;";
            mi.append(makeLevelDot(i), document.createTextNode(lv.label), hint);
            mi.addEventListener("mouseenter", () => {
              if (i !== cutoff) mi.style.background = "var(--mbu-bg-hover)";
            });
            mi.addEventListener("mouseleave", () => {
              if (i !== cutoff) mi.style.background = "";
            });
            mi.addEventListener("click", () => {
              close();
              setCutoff(i);
              paint();
            });
            menu.appendChild(mi);
          });
          document.body.appendChild(menu);
          setTimeout(() => {
            if (menu) document.addEventListener("mousedown", onDown, true);
          }, 0);
        });
        wrap.append(lbl, chip);
        return wrap;
      }
      function setCutoff(i) {
        if (i === cutoff) return;
        const from = cutoff;
        cutoff = i;
        try {
          GM_setValue(CUTOFF_KEY, i);
        } catch (e) {
        }
        let changed = 0, kept = 0;
        for (const r of [...allResults]) {
          if (!r._auto) continue;
          const key = keyOf(r);
          const st = rowState.get(key);
          const untouched = r._below ? !st?.confirmed && !st?.mbUrl : !!st?.mbUrl && st.via !== "user";
          const wasBelow = !!r._below;
          if (!untouched) {
            if (matchLevelOf(r._auto.logEntry?.via) > cutoff !== wasBelow) kept++;
            continue;
          }
          applyCutoff(r);
          if (wasBelow === !!r._below) continue;
          const tr = tbody.querySelector(`tr[data-entity-key="${CSS.escape(key)}"]`);
          if (!tr) continue;
          if (r._credInput?._activeMbUrl) creditOverrides.delete(r._credInput._activeMbUrl);
          buildRow(r, tr);
          tr.remove();
          changed++;
        }
        log.info(`Match cutoff: ${MATCH_LEVELS[from].label} \u2192 ${MATCH_LEVELS[cutoff].label}; ${changed} row${changed === 1 ? "" : "s"} changed` + (kept ? `, ${kept} you already set left as they are` : ""));
        updateLinksBadge();
        updateImportBtn();
      }
      const intro = document.createElement("p");
      intro.style.cssText = "margin:0 0 0.75rem;font-size:0.85rem;color:var(--mbu-text-dim);";
      intro.innerHTML = 'Review all artist matches before importing. <span style="background:var(--mbu-error-bg);color:var(--mbu-text);padding:0 0.3rem;border-radius:2px;">Red rows</span> need attention. <span style="background:var(--mbu-warn-bg);color:var(--mbu-text);padding:0 0.3rem;border-radius:2px;">Yellow rows</span> have a name mismatch \u2014 verify. Green rows are confirmed. Use the search or create buttons to resolve outstanding issues. A dot shows how sure an automatic match is; <b>Cutoff</b> sets the lowest one selected for you.';
      panel.appendChild(intro);
      const table = document.createElement("table");
      table.style.cssText = "border-collapse:collapse;width:100%;font-size:0.85rem;";
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      hr.style.background = "var(--mbu-warn-bg)";
      [...entitySources ? ["Source"] : [], importSourceName + " entity", "MB match / search"].forEach((col) => {
        const th = document.createElement("th");
        th.style.cssText = "text-align:left;padding:0.3rem 0.5rem;border:1px solid var(--mbu-warn);white-space:nowrap;color:var(--mbu-text);";
        th.textContent = col;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      async function splitRow(r, tr, parts, btn) {
        const origKey = keyOf(r);
        if (allResults.indexOf(r) < 0) return;
        btn.disabled = true;
        btn.textContent = "\u2026";
        log.info(`#605 split "${r.displayName}" \u2192 ${parts.join(" \xB7 ")}`);
        const norm2 = (s) => String(s || "").toLowerCase().trim();
        const subs = [];
        for (let i = 0; i < parts.length; i++) {
          const name = parts[i];
          const entity = { name, anv: "", _syntheticKey: splitKey(origKey, i), _splitOf: origKey, _splitFrom: r.displayName };
          let pool = (r.nameMatches || []).filter((a) => norm2(a.name) === norm2(name));
          let via = "candidates";
          if (!pool.length) {
            via = "search";
            try {
              const json = await mbThrottle.fetchJson(`${MB}/ws/2/artist?query=${encodeURIComponent(name)}&fmt=json&limit=8`);
              const all = json?.artists || [];
              const exact2 = all.filter((a) => norm2(a.name) === norm2(name));
              pool = exact2.length ? exact2 : all;
            } catch (e) {
              log.warn(`#605 split: search for "${name}" failed \u2014 ${e.message}`);
              pool = [];
            }
          }
          const exact = pool.filter((a) => norm2(a.name) === norm2(name));
          log.info(`#605 split part "${name}": ${pool.length} candidate(s) via ${via}, ${exact.length} exact`);
          const base = { entityType: "artist", entity, displayName: name, discogsHref: "", _roles: r._roles };
          if (exact.length === 1) {
            const a = exact[0], mbUrl = `${MB}/artist/${a.id}`;
            subs.push({
              ...base,
              type: "resolved",
              mbUrl,
              mbName: a.name,
              mbDisambig: a.disambiguation || "",
              logEntry: { displayName: name, discogsHref: "", mbUrl, mbName: a.name, mbDisambig: a.disambiguation || "", via: "name", fromCache: false }
            });
          } else {
            subs.push({ ...base, type: "attention", nameMatches: pool });
          }
        }
        const idx = allResults.indexOf(r);
        if (idx < 0 || !tr.isConnected) return;
        if (r._credInput?._activeMbUrl) creditOverrides.delete(r._credInput._activeMbUrl);
        rowState.delete(origKey);
        rowSearchInputs.delete(origKey);
        linkState.delete(origKey);
        if (entitySources?.has(origKey)) subs.forEach((s) => entitySources.set(keyOf(s), entitySources.get(origKey)));
        allResults.splice(idx, 1, ...subs);
        subs.forEach(applyCutoff);
        subs.forEach((s) => buildRow(s, tr));
        tr.remove();
        splits.set(origKey, subs.map((s) => ({ key: keyOf(s), name: s.displayName })));
        headingText.textContent = `Review \u2014 ${allResults.length} entit${allResults.length === 1 ? "y" : "ies"}`;
        updateLinksBadge();
        updateImportBtn();
      }
      allResults.forEach(applyCutoff);
      {
        const n = allResults.filter((r) => r._below).length;
        log.info(`Match cutoff: ${MATCH_LEVELS[cutoff].label}${n ? ` \u2014 ${n} automatic match${n === 1 ? "" : "es"} below it left for you` : ""}`);
      }
      allResults.forEach((r) => buildRow(r));
      function buildRow(r, beforeEl) {
        const entityType = r.entityType || "artist";
        const displayName = r.displayName || r.entity?.name || "";
        const discogsHref = r.discogsHref || "";
        const srcName = discogsHref ? sourceNameForUrl(discogsHref) : importSourceName;
        const e = r.logEntry || null;
        const artist = r.entity;
        const isResolved = r.type === "resolved";
        const initMbUrl = isResolved ? r.mbUrl : null;
        const _entityKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
        const _pl = _preloadedNames.get(_entityKey) || _preloadedNames.get(r.entity?.resource_url);
        const initMbName = e && e.mbName ? e.mbName : _pl?.name || (isResolved ? r.mbName : null) || null;
        const initMbDisam = e && e.mbDisambig ? e.mbDisambig : _pl?.dis || r.mbDisambig || "";
        const nameMismatch = isResolved && initMbName && initMbName.toLowerCase().trim() !== displayName.toLowerCase().trim();
        const needsAttention = r.type === "attention";
        const rowBg = needsAttention ? "var(--mbu-error-bg)" : nameMismatch ? "var(--mbu-warn-bg)" : "var(--mbu-bg)";
        const borderColor = needsAttention ? "#cc6666" : "#d4d4d4";
        const tr = document.createElement("tr");
        tr.style.cssText = `vertical-align:top;background:${rowBg};`;
        tr.dataset.entityKey = _entityKey;
        rowState.set(_entityKey, {
          mbUrl: initMbUrl,
          mbName: initMbName,
          mbDisambig: initMbDisam,
          confirmed: isResolved && !needsAttention,
          via: isResolved ? r.logEntry?.via || null : null,
          fromCache: isResolved ? r.logEntry?.fromCache || false : false
        });
        if (entitySources) {
          const tdSrc = document.createElement("td");
          tdSrc.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;text-align:center;`;
          const names = entitySources.get(_entityKey) || [];
          const srcUrls = (r._mergeUrls || (discogsHref ? [discogsHref] : [])).filter((u) => !isSyntheticProviderUrl(u));
          if (!names.length) {
            tdSrc.innerHTML = '<span style="color:var(--mbu-text-weak);">\u2014</span>';
          } else names.forEach((nm) => {
            const url = srcUrls.find((u) => sourceNameForUrl(u) === nm) || null;
            const span = document.createElement("span");
            span.className = "discogs-src-badge";
            span.style.cssText = "display:inline-flex;vertical-align:middle;margin:0 2px;" + (url ? "cursor:pointer;" : "filter:grayscale(1);opacity:0.45;");
            span.dataset.tip = url ? `${nm}
Click: open ${url}` : `${nm}
A credit by name only, with no link`;
            span.innerHTML = sourceBadgeIcon(nm);
            if (url) span.addEventListener("click", () => window.open(url, "_blank", "noopener,noreferrer"));
            tdSrc.appendChild(span);
          });
          tr.appendChild(tdSrc);
        }
        const tdDiscogs = document.createElement("td");
        tdDiscogs.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;`;
        const nameRow = document.createElement("div");
        nameRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:0.6rem;";
        const nameWrap = document.createElement("span");
        nameWrap.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;";
        if (entityType !== "artist") {
          const badge = document.createElement("span");
          badge.textContent = entityType;
          badge.style.cssText = "font-size:0.7rem;background:var(--mbu-bg-sunken);border-radius:3px;padding:0 0.3rem;margin-right:0.3rem;color:var(--mbu-text-dim);vertical-align:middle;";
          nameWrap.appendChild(badge);
        }
        const placeholderUrl = /\/_company\//.test(discogsHref) || /\/_company\//.test(r.entity?.resource_url || "");
        const hasDiscogsUrl = !!r.entity?.resource_url && !placeholderUrl;
        const dlA = document.createElement(hasDiscogsUrl ? "a" : "span");
        dlA.href = discogsHref;
        dlA.target = "_blank";
        dlA.rel = "noopener noreferrer nofollow";
        dlA.textContent = displayName;
        if (!hasDiscogsUrl) {
          dlA.className = "discogs-entity-name";
          dlA.style.color = "var(--mbu-text)";
        }
        const _srcTitles = [...new Set((r._roles || []).map((x) => x.trackTitle).filter(Boolean))];
        if (_srcTitles.length) dlA.dataset.tip = _srcTitles.join("\n");
        nameWrap.appendChild(dlA);
        const splitParts = entityType === "artist" && !r.entity?._splitOf ? splitCreditName(displayName || r.entity?.name) : [];
        if (splitParts.length) {
          const sp = document.createElement("button");
          sp.type = "button";
          sp.className = "discogs-split-btn";
          sp.textContent = "\u22D4";
          sp.dataset.tip = `Split into separate artists
${splitParts.map((p) => "- " + p).join("\n")}
Each gets this row's roles.`;
          sp.style.cssText = "margin-left:0.35rem;padding:0 0.35rem;min-width:1.4rem;cursor:pointer;border:1px solid var(--mbu-accent);border-radius:3px;background:var(--mbu-bg-raised);color:var(--mbu-accent-text);font-size:16px;font-weight:bold;line-height:1.2;vertical-align:middle;";
          sp.addEventListener("click", () => splitRow(r, tr, splitParts, sp));
          nameWrap.appendChild(sp);
        }
        if (r.entity?._splitOf) {
          const sb = document.createElement("span");
          sb.textContent = "split";
          sb.dataset.tip = `Split from \u201C${r.entity._splitFrom}\u201D
It gets that credit's roles.`;
          sb.style.cssText = "display:inline-flex;align-items:center;margin-left:0.35rem;padding:0.05rem 0.4rem;font-size:0.65rem;font-weight:600;border-radius:0.7rem;line-height:1.4;cursor:help;background:var(--mbu-bg-sunken);color:var(--mbu-text-dim);border:1px solid var(--mbu-border);";
          nameWrap.appendChild(sb);
        }
        const BADGE_BASE = "display:inline-flex;align-items:center;margin-left:0.35rem;padding:0.05rem 0.4rem;font-size:0.65rem;font-weight:600;border-radius:0.7rem;letter-spacing:0.01em;cursor:help;text-transform:lowercase;line-height:1.4;";
        if (!hasDiscogsUrl && !placeholderUrl && srcName !== "Titles" && !r.entity?._splitOf) {
          const noUrl = document.createElement("span");
          noUrl.textContent = "no profile";
          noUrl.dataset.tip = `No ${srcName} artist page
No lookup by name: search MusicBrainz yourself.`;
          noUrl.style.cssText = BADGE_BASE + "background:var(--mbu-error-bg);color:var(--mbu-error);border:1px solid var(--mbu-error);";
          nameWrap.appendChild(noUrl);
        }
        if (nameMismatch) {
          const w = document.createElement("span");
          w.textContent = "name differs";
          w.dataset.tip = "The MusicBrainz name differs from Discogs\u2019s\nCheck this is the right match.";
          w.style.cssText = BADGE_BASE + "background:var(--mbu-warn-bg);color:var(--mbu-warn);border:1px solid var(--mbu-warn);";
          nameWrap.appendChild(w);
        }
        nameRow.appendChild(nameWrap);
        const actionsLine = document.createElement("span");
        actionsLine.style.cssText = "display:inline-flex;align-items:center;gap:0.3rem;flex-shrink:0;";
        nameRow.appendChild(actionsLine);
        tdDiscogs.appendChild(nameRow);
        tr.appendChild(tdDiscogs);
        const rolesList = r._roles || [];
        if (rolesList.length > 0) {
          const byRole = /* @__PURE__ */ new Map();
          const sourcesByRole = /* @__PURE__ */ new Map();
          rolesList.forEach(({ displayLabel, linkType, trackPos, sourceRole }) => {
            const key = displayLabel || linkType;
            if (!key) return;
            if (!byRole.has(key)) {
              byRole.set(key, /* @__PURE__ */ new Set());
              sourcesByRole.set(key, /* @__PURE__ */ new Set());
            }
            if (trackPos) byRole.get(key).add(String(trackPos));
            if (sourceRole) sourcesByRole.get(key).add(sourceRole);
          });
          const compressPositions = (posSet) => {
            const all = [...posSet];
            if (!all.length) return "";
            if (!all.every((p) => /^\d+$/.test(p))) return "[" + all.join(",") + "]";
            const nums = all.map(Number).sort((a, b) => a - b);
            const parts = [];
            for (let i = 0; i < nums.length; ) {
              let j = i;
              while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
              parts.push(j > i ? nums[i] + "-" + nums[j] : String(nums[i]));
              i = j + 1;
            }
            return "[" + parts.join(",") + "]";
          };
          const chips = [...byRole.entries()].map(([roleKey, posSet]) => {
            const pos = compressPositions(posSet);
            return { roleKey, displayText: roleKey + (pos ? " " + pos : ""), sources: [...sourcesByRole.get(roleKey)] };
          });
          const rolesLine = document.createElement("div");
          rolesLine.style.cssText = "font-size:0.75rem;color:var(--mbu-text-weak);margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;";
          const tipLines = chips.map((c) => c.displayText + (c.sources.length ? " \u2190 " + c.sources.join(", ") : ""));
          if (chips.some((c) => c.sources.length)) tipLines.unshift("Roles, each with the credit it came from");
          rolesLine.dataset.tip = tipLines.join("\n");
          chips.forEach((chip, i) => {
            if (i > 0) rolesLine.appendChild(document.createTextNode(", "));
            const span = document.createElement("span");
            span.className = "discogs-role-chip";
            span.dataset.roleKey = chip.roleKey;
            span.textContent = chip.displayText;
            rolesLine.appendChild(span);
          });
          tdDiscogs.appendChild(rolesLine);
        }
        const credLine = document.createElement("div");
        credLine.style.cssText = "display:flex;align-items:center;gap:0.3rem;margin-top:1rem;padding-top:0.25rem;max-width:280px;";
        const credLabel = document.createElement("label");
        credLabel.textContent = "Credited as:";
        credLabel.style.cssText = "font-size:0.72rem;color:var(--mbu-text-weak);flex-shrink:0;";
        const credInput = noPasswordManagers(document.createElement("input"));
        const CRED_BG_SAME = "var(--mbu-bg-sunken)";
        const CRED_BG_DIFFERENT = "var(--mbu-warn-bg)";
        credInput.style.cssText = "flex:1;padding:0.15rem 0.35rem;font-size:0.78rem;border:1px solid var(--mbu-border);border-radius:3px;background:" + CRED_BG_SAME + ";";
        credInput.placeholder = displayName;
        credInput.dataset.tip = `The credited name, on every relationship of this entity
Empty: the default, the ${srcName} name, or MusicBrainz\u2019s most frequent credit when known.`;
        function refreshCredBg() {
          const value = (credInput.value || "").trim();
          const same = value === "" || value === displayName;
          credInput.style.background = same ? CRED_BG_SAME : CRED_BG_DIFFERENT;
        }
        function pickPrefill(mbUrl) {
          if (r.creditOverride !== void 0 && r.creditOverride !== null && r.creditOverride !== "") {
            return r.creditOverride;
          }
          if (mbUrl) {
            const mbid = (String(mbUrl).split("/").pop() || "").replace(/[^a-f0-9-]/gi, "").slice(0, 36);
            if (mbid && existingCreditByMbid.has(mbid)) return existingCreditByMbid.get(mbid);
          }
          if (srcName === "Titles") {
            const mbName = rowState.get(_entityKey)?.mbName || r.mbName;
            if (mbName) return mbName;
          }
          return displayName;
        }
        credInput.value = pickPrefill(r.mbUrl);
        credInput._userTouched = false;
        refreshCredBg();
        let _credSaveTimer;
        credInput.addEventListener("input", () => {
          credInput._userTouched = true;
          const url = credInput._activeMbUrl;
          if (url) creditOverrides.set(url, credInput.value);
          refreshCredBg();
          clearTimeout(_credSaveTimer);
          _credSaveTimer = setTimeout(() => {
            const idbKey = idbKeyForEntity(r.entity);
            if (idbKey) writeIdbRecord(idbKey, { creditOverride: credInput.value });
          }, 500);
        });
        credInput._activeMbUrl = r.mbUrl;
        if (r.mbUrl) creditOverrides.set(r.mbUrl, credInput.value);
        const CRED_BTN_STYLE = "flex-shrink:0;padding:0.05rem 0.35rem;font-size:0.7rem;line-height:1;cursor:pointer;border:1px solid var(--mbu-warn);border-radius:3px;background:var(--mbu-bg-raised);color:var(--mbu-warn);";
        const mbBtn = document.createElement("button");
        mbBtn.type = "button";
        mbBtn.textContent = "MB";
        mbBtn.dataset.tip = "Credit it as the MusicBrainz name";
        mbBtn.style.cssText = CRED_BTN_STYLE;
        const dBtn = document.createElement("button");
        dBtn.type = "button";
        dBtn.textContent = srcName.charAt(0);
        dBtn.dataset.tip = `Credit it as the ${srcName} name`;
        dBtn.style.cssText = CRED_BTN_STYLE;
        function currentMbName() {
          return rowState.get(_entityKey)?.mbName || r.mbName || null;
        }
        function refreshCredBtns() {
          const val = credInput.value;
          const mbName = currentMbName();
          mbBtn.style.display = !mbName || val === mbName ? "none" : "";
          dBtn.style.display = val === displayName ? "none" : "";
        }
        function setCredViaButton(value) {
          credInput.value = value;
          credInput._userTouched = true;
          credInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        mbBtn.addEventListener("click", () => {
          const mbName = currentMbName();
          if (mbName) setCredViaButton(mbName);
        });
        dBtn.addEventListener("click", () => setCredViaButton(displayName));
        credInput.addEventListener("input", refreshCredBtns);
        refreshCredBtns();
        credLine.appendChild(credLabel);
        credLine.appendChild(credInput);
        credLine.appendChild(mbBtn);
        credLine.appendChild(dBtn);
        tdDiscogs.appendChild(credLine);
        r._credInput = credInput;
        r._refreshCredBtns = refreshCredBtns;
        const tdMb = document.createElement("td");
        tdMb.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};min-width:240px;`;
        const candidateList = document.createElement("div");
        candidateList.style.cssText = "display:flex;flex-direction:column;gap:0.2rem;margin-bottom:0.3rem;";
        const searchRow = document.createElement("div");
        searchRow.style.cssText = "display:flex;gap:0.3rem;";
        const searchInput = noPasswordManagers(document.createElement("input"));
        searchInput.value = displayName;
        searchInput.dataset.tip = "Search MusicBrainz by name\nPaste: an MBID, or its MusicBrainz URL, picks that entity at once";
        searchInput.style.cssText = "flex:1;padding:0.15rem 0.35rem;font-size:0.82rem;border:1px solid var(--mbu-border);border-radius:3px;";
        rowSearchInputs.set(_entityKey, searchInput);
        const searchBtn = document.createElement("button");
        searchBtn.type = "button";
        searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>';
        searchBtn.dataset.tip = "Search MusicBrainz";
        searchBtn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;padding:0 0.45rem;cursor:pointer;color:var(--mbu-text-dim);background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:3px;";
        searchRow.appendChild(searchBtn);
        searchRow.appendChild(searchInput);
        tdMb.appendChild(candidateList);
        tdMb.appendChild(searchRow);
        tr.appendChild(tdMb);
        const tdAction = actionsLine;
        tbody.insertBefore(tr, beforeEl || null);
        function buildMbRolesEl(explicitMbid) {
          if (entityType !== "artist") return null;
          const wrap = document.createElement("span");
          wrap.style.cssText = "display:inline-flex;align-items:center;gap:0.25rem;margin-left:0.5rem;min-width:0;overflow:hidden;font-size:0.72rem;";
          const trigger = document.createElement("a");
          trigger.href = "#";
          trigger.textContent = "MB roles \u25BE";
          trigger.style.cssText = "color:var(--mbu-info);text-decoration:none;cursor:pointer;white-space:nowrap;";
          trigger.dataset.tip = "This artist's relationship types on MusicBrainz\nRead them, to compare with the Discogs role.";
          trigger.addEventListener("click", async (ev) => {
            ev.preventDefault();
            let mbid = (String(explicitMbid || "").match(/[a-f0-9-]{36}/i) || [])[0];
            if (!mbid) {
              const st = rowState.get(_entityKey);
              const curUrl = st?.mbUrl || r.mbUrl;
              mbid = (String(curUrl || "").split("/").pop() || "").replace(/[^a-f0-9-]/gi, "").slice(0, 36);
            }
            if (!mbid) {
              trigger.textContent = "MB roles: (none selected)";
              return;
            }
            trigger.textContent = "MB roles\u2026";
            const types = await fetchArtistRelTypes(mbid);
            wrap.innerHTML = "";
            const label = document.createElement("span");
            label.style.color = "var(--mbu-text-dim)";
            if (!types) {
              label.textContent = "MB roles: fetch failed";
              label.style.color = "var(--mbu-error)";
              wrap.appendChild(label);
              return;
            }
            if (!types.length) {
              label.textContent = "MB roles: none";
              wrap.appendChild(label);
              return;
            }
            label.textContent = "MB roles: ";
            label.style.whiteSpace = "nowrap";
            label.style.flex = "0 0 auto";
            wrap.style.alignItems = "flex-start";
            wrap.style.overflow = "visible";
            wrap.appendChild(label);
            wrap.dataset.tip = types.join(", ");
            const chipsBox = document.createElement("span");
            chipsBox.style.cssText = "display:flex;flex-wrap:wrap;gap:0.25rem;min-width:0;";
            wrap.appendChild(chipsBox);
            types.forEach((t) => {
              const c = document.createElement("span");
              c.textContent = t;
              c.style.cssText = "background:var(--mbu-info-bg);border:1px solid var(--mbu-border);border-radius:0.7rem;padding:0 0.4rem;color:var(--mbu-info);white-space:nowrap;";
              chipsBox.appendChild(c);
            });
          });
          wrap.appendChild(trigger);
          return wrap;
        }
        let _creatingEl = null;
        let _creatingTimer = null;
        let _creatingCancel = null;
        function setRowCreating(name, onCancel) {
          ensureCreatingStyle();
          if (_creatingTimer) {
            clearTimeout(_creatingTimer);
            _creatingTimer = null;
          }
          if (_creatingEl) _creatingEl.remove();
          _creatingCancel = onCancel || null;
          candidateList.style.display = "none";
          tdAction.innerHTML = "";
          searchInput.disabled = true;
          searchBtn.disabled = true;
          const ph = document.createElement("div");
          ph.className = "ch-creating";
          ph.style.cssText = "padding:0.15rem 0.4rem;border:1px dashed var(--mbu-info);border-radius:3px;background:var(--mbu-bg);display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:var(--mbu-info);font-style:italic;margin-bottom:0.3rem;";
          const spin = document.createElement("span");
          spin.textContent = "\u27F3";
          spin.style.cssText = "display:inline-block;animation:ch-creating-spin 0.9s linear infinite;";
          ph.appendChild(spin);
          const txt = document.createElement("span");
          txt.textContent = `Creating ${name} in the background\u2026`;
          ph.appendChild(txt);
          const x = document.createElement("button");
          x.textContent = "\u2715";
          x.dataset.tip = "Cancel\nStop waiting and restore the row";
          x.style.cssText = "margin-left:auto;font-size:0.75rem;line-height:1;cursor:pointer;border:none;background:none;color:var(--mbu-info);padding:0 0.2rem;";
          x.addEventListener("click", () => cancelCreating());
          ph.appendChild(x);
          tdMb.insertBefore(ph, candidateList);
          _creatingEl = ph;
          tr.style.background = "var(--mbu-info-bg)";
          _creatingTimer = setTimeout(() => {
            _creatingTimer = null;
            cancelCreating();
          }, 9e4);
        }
        function cancelCreating() {
          if (_creatingCancel) {
            try {
              _creatingCancel();
            } catch (e2) {
            }
          }
          clearRowCreating(true);
        }
        function clearRowCreating(restore) {
          if (_creatingTimer) {
            clearTimeout(_creatingTimer);
            _creatingTimer = null;
          }
          _creatingCancel = null;
          if (_creatingEl) {
            _creatingEl.remove();
            _creatingEl = null;
          }
          candidateList.style.display = "";
          if (restore) {
            searchInput.disabled = false;
            searchBtn.disabled = false;
            tr.style.background = "";
            renderActions(null);
          }
        }
        let aliasPick = null;
        let rowViaBadge = null, rowMatchId = null;
        function aliasLanded(a) {
          if (r.logEntry?.via !== "url" || !rowViaBadge || rowMatchId !== a.id) return;
          const nb = makeViaBadge("both-alias", false);
          if (nb) {
            rowViaBadge.replaceWith(nb);
            rowViaBadge = nb;
          }
          r.logEntry.via = "both-alias";
          r.logEntry.fromCache = false;
          const st = rowState.get(_entityKey);
          if (st) {
            st.via = "both-alias";
            st.fromCache = false;
          }
          const k = idbKeyForEntity(r.entity);
          if (k) writeIdbRecord(k, { resolvedVia: "both-alias" });
          log.info(`+ alias: "${displayName}" \u2192 ${a.name} is now an alias+url match (was url)${k ? ", cached" : ""}`);
        }
        function makeAddAliasBtn(a) {
          if (!wantsAliasButton(entityType, a, displayName)) return null;
          const ab = document.createElement("button");
          ab.type = "button";
          ab.className = "discogs-add-alias";
          ab.textContent = "+ alias";
          ab.dataset.tip = `Add \u201C${displayName}\u201D as an alias of ${a.name}
Click: open MusicBrainz's add-alias form, filled in, for you to submit
Right-click: submit it in the background, with no alias type`;
          ab.style.cssText = "font-size:0.72rem;cursor:pointer;padding:0 0.4rem;border:1px solid var(--mbu-accent);border-radius:3px;background:var(--mbu-bg);color:var(--mbu-accent-text);white-space:nowrap;flex:0 0 auto;";
          const note = buildCreateNote(`Added "${displayName}" as an alias \u2014 the ${srcName} credit${discogsHref ? " (" + discogsHref + ")" : ""} \u2014`);
          ab.addEventListener("click", async (ev) => {
            ev.preventDefault();
            logDebug(`+ alias: click on "${displayName}" \u2192 ${a.name} (${a.id})`);
            let res;
            try {
              res = await openAddAliasForm(a.id, displayName, note);
            } catch (e2) {
              log.warn(`+ alias: opening the form for "${displayName}" failed \u2014 ${e2 && e2.message || e2}`);
              return;
            }
            if (res && res.already) {
              ab.textContent = "\u2713 has alias";
              ab.disabled = true;
              ab.dataset.tip = `${a.name} already has \u201C${displayName}\u201D
Nothing to add`;
              ab.style.color = "var(--mbu-ok)";
              ab.style.borderColor = "var(--mbu-ok)";
              aliasLanded(a);
              return;
            }
            if (ab._aliasWatch) return;
            let checking = false;
            const onReturn = async () => {
              if (document.visibilityState !== "visible" || checking || ab.disabled) return;
              checking = true;
              const held = await aliasNowHeld(a.id, displayName);
              checking = false;
              if (held !== true) {
                log.info(`+ alias: "${displayName}" isn't on ${a.name} yet${held === null ? " (lookup failed)" : ""} \u2014 checked on return to this tab`);
                return;
              }
              document.removeEventListener("visibilitychange", onReturn);
              window.removeEventListener("focus", onReturn);
              ab._aliasWatch = null;
              ab.textContent = "\u2713 alias";
              ab.disabled = true;
              ab.dataset.tip = `\u201C${displayName}\u201D is now an alias of ${a.name}`;
              ab.style.color = "var(--mbu-ok)";
              ab.style.borderColor = "var(--mbu-ok)";
              a.aliases = [...a.aliases || [], displayName];
              log.info(`+ alias: "${displayName}" is now an alias of ${a.name} (added through the form)`);
              aliasLanded(a);
            };
            ab._aliasWatch = onReturn;
            setTimeout(() => {
              document.addEventListener("visibilitychange", onReturn);
              window.addEventListener("focus", onReturn);
            }, 600);
          });
          ab.addEventListener("contextmenu", async (ev) => {
            ev.preventDefault();
            logDebug(`+ alias: right-click on "${displayName}" \u2192 ${a.name} (${a.id})${ab.disabled ? " \u2014 ignored, the button is busy or done" : ""}`);
            if (ab.disabled) return;
            ab.disabled = true;
            ab.textContent = "\u23F3 alias";
            try {
              const res = await submitAliasBackground(a.id, displayName, note);
              ab.textContent = res && res.already ? "\u2713 has alias" : "\u2713 alias";
              ab.dataset.tip = res && res.already ? `${a.name} already has \u201C${displayName}\u201D
Nothing submitted` : `\u201C${displayName}\u201D submitted as an alias of ${a.name}`;
              ab.style.color = "var(--mbu-ok)";
              ab.style.borderColor = "var(--mbu-ok)";
              a.aliases = [...a.aliases || [], displayName];
              aliasLanded(a);
              if (!(res && res.already)) log.info(`+ alias: "${displayName}" submitted as an alias of <a href="${location.origin}/artist/${a.id}/aliases" target="_blank" rel="noopener noreferrer nofollow">${a.name}</a>`);
            } catch (e2) {
              ab.disabled = false;
              ab.textContent = "\u2717 alias";
              ab.dataset.tip = `\u26A0 Adding the alias failed: ${e2.message}
Click: open the form
Right-click: try again`;
              ab.style.color = "var(--mbu-error)";
              ab.style.borderColor = "var(--mbu-error)";
              log.warn(`+ alias: "${displayName}" \u2192 ${a.name} failed \u2014 ${e2.message}`);
            }
          });
          return ab;
        }
        function setRowResolved(a) {
          aliasPick = a;
          clearRowCreating();
          const mbUrl = `${MB}/${entityType}/${a.id}`;
          rowState.set(_entityKey, { mbUrl, mbName: a.name, mbDisambig: a.disambiguation || "", confirmed: true, via: "user", fromCache: false });
          if (r._credInput) {
            const oldUrl = r._credInput._activeMbUrl;
            if (oldUrl && oldUrl !== mbUrl) creditOverrides.delete(oldUrl);
            r._credInput._activeMbUrl = mbUrl;
            if (!r._credInput._userTouched) {
              const fresh = pickPrefill(mbUrl);
              r._credInput.value = fresh;
            }
            creditOverrides.set(mbUrl, r._credInput.value);
            refreshCredBg();
            if (r._refreshCredBtns) r._refreshCredBtns();
          }
          const _idbKey = idbKeyForEntity(r.entity);
          if (_idbKey) {
            writeIdbRecord(_idbKey, {
              mbid: a.id,
              entityType,
              name: a.name,
              disambiguation: a.disambiguation || "",
              resolvedVia: "user"
              // user picked this in the review table
            });
          }
          tr.style.background = "var(--mbu-ok-bg)";
          searchInput.disabled = true;
          searchBtn.disabled = true;
          candidateList.innerHTML = "";
          const selRow = document.createElement("div");
          selRow.style.cssText = "padding:0.15rem 0.4rem;border:1px solid var(--mbu-ok);border-radius:3px;background:var(--mbu-ok-bg);display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;font-size:0.85rem;";
          const selA = document.createElement("a");
          selA.href = "https:" + mbUrl;
          selA.target = "_blank";
          selA.rel = "noopener noreferrer nofollow";
          selA.textContent = "\u2713 " + a.name + (a.disambiguation ? ` (${a.disambiguation})` : "");
          selA.style.fontWeight = "bold";
          selA.style.whiteSpace = "nowrap";
          selA.style.flex = "0 0 auto";
          const undoBtn = document.createElement("button");
          undoBtn.textContent = "\u2715";
          undoBtn.dataset.tip = "Clear selection";
          undoBtn.className = "discogs-clear-btn";
          undoBtn.addEventListener("click", () => setRowUnresolved());
          selRow.appendChild(makeLevelDot(null));
          selRow.appendChild(selA);
          const viaBadge = makeViaBadge("user", false);
          if (viaBadge) selRow.appendChild(viaBadge);
          const mbRolesEl = buildMbRolesEl();
          if (mbRolesEl) selRow.appendChild(mbRolesEl);
          selRow.appendChild(undoBtn);
          candidateList.appendChild(selRow);
          renderActions(a);
          updateImportBtn();
        }
        function setRowUnresolved() {
          aliasPick = null;
          clearRowCreating();
          rowState.set(_entityKey, { mbUrl: null, mbName: null, mbDisambig: "", confirmed: false, via: null, fromCache: false });
          if (r._credInput && r._credInput._activeMbUrl) {
            creditOverrides.delete(r._credInput._activeMbUrl);
            r._credInput._activeMbUrl = null;
          }
          tr.style.background = "var(--mbu-error-bg)";
          searchInput.disabled = false;
          searchBtn.disabled = false;
          candidateList.innerHTML = "";
          const none = document.createElement("div");
          none.style.cssText = "font-size:0.82rem;color:var(--mbu-text-weak);";
          none.textContent = "No selection \u2014 search or create";
          candidateList.appendChild(none);
          renderActions(null);
          updateImportBtn();
        }
        const ACTION_CHIP_STYLE = "display:inline-flex;align-items:center;justify-content:center;min-width:1.6rem;height:1.6rem;padding:0 0.35rem;font-size:0.95rem;line-height:1;cursor:pointer;border:1px solid var(--mbu-border);border-radius:0.3rem;background:var(--mbu-bg-raised);";
        function renderActions(selected) {
          tdAction.innerHTML = "";
          if (!selected) {
            linkState.delete(_entityKey);
            rowLinkChips.delete(_entityKey);
            updateLinksBadge();
          }
          const noLinkUi = selected && (isSyntheticProviderUrl(discogsHref) || SPECIAL_PURPOSE_ARTISTS.has(selected.id));
          if (noLinkUi) {
            linkState.delete(_entityKey);
            rowLinkChips.delete(_entityKey);
            updateLinksBadge();
          }
          if (selected && !noLinkUi) {
            let recheckUrlBypassCache = function() {
              _urlCheckSessionCache.delete(urlCheckCacheKey);
              try {
                localStorage.removeItem(urlCheckLsKey);
              } catch (e2) {
              }
              queuedUrlCheck(
                () => fetchWithRetry(`${MB}/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`).then((json) => {
                  const linkedIds = (json.relations || []).filter((r2) => r2[entityType]).map((r2) => r2[entityType].id);
                  const result = linkedIds.includes(selected.id) ? "linked" : linkedIds.length > 0 ? "other" : "none";
                  _urlCheckSessionCache.set(urlCheckCacheKey, result);
                  try {
                    localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
                  } catch (e2) {
                  }
                  const healKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
                  if (healKey) writeIdbRecord(healKey, { urlLinkedIds: linkedIds });
                  applyUrlCheckResult(result);
                }).catch(() => applyUrlCheckResult("none"))
              );
            }, applyUrlCheckResult = function(result) {
              linkState.set(_entityKey, result);
              if (result !== "none") rowLinkChips.delete(_entityKey);
              updateLinksBadge();
              if (result === "linked") {
                linkSlot.textContent = "\u2713";
                linkSlot.dataset.tip = "This MusicBrainz " + entityType + " already links the " + srcName + " URL";
                linkSlot.style.color = "var(--mbu-ok)";
                linkSlot.style.fontWeight = "bold";
              } else if (result === "other") {
                linkSlot.textContent = "\u26A0\uFE0F";
                linkSlot.dataset.tip = `\u26A0 A different MusicBrainz ${entityType} links this ${srcName} URL`;
                linkSlot.style.color = "var(--mbu-warn)";
              } else {
                linkSlot.textContent = "";
                linkSlot.style.color = "";
                const addLinkBtn = document.createElement("button");
                const _addCount = r._mergeUrls && r._mergeUrls.length ? r._mergeUrls.filter((u) => sourceUrlLinkTypeId(u, entityType)).length : 0;
                addLinkBtn.textContent = "\u{1F517}" + (_addCount > 1 ? " " + _addCount : "");
                addLinkBtn.dataset.tip = (_addCount > 1 ? `Add ${_addCount} source links to the MusicBrainz ${entityType}` : `Add the ${srcName} link to the MusicBrainz ${entityType}`) + `
Right-click: add ${_addCount > 1 ? "them" : "it"} silently in the background`;
                addLinkBtn.style.cssText = ACTION_CHIP_STYLE + "color:var(--mbu-warn);";
                const openLinkEdit = (background) => {
                  const urls = r._mergeUrls && r._mergeUrls.length ? r._mergeUrls : [discogsHref];
                  const p = new URLSearchParams();
                  let n = 0;
                  for (const u of urls) {
                    const lt = sourceUrlLinkTypeId(u, entityType);
                    if (!lt) continue;
                    p.set(`edit-${entityType}.url.${n}.text`, u);
                    p.set(`edit-${entityType}.url.${n}.link_type_id`, lt);
                    n++;
                  }
                  if (!n) return;
                  p.set(`edit-${entityType}.edit_note`, buildCreateNote(n > 1 ? `Added ${n} source links` : `Added ${srcName} link`));
                  const mbid = selected.id.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
                  const editUrl = `https:${MB}/${entityType}/${mbid}/edit?${p}`;
                  if (background && typeof GM_openInTab === "function") {
                    const editTab = GM_openInTab(`${editUrl}#ch-autocommit`, { active: false, insert: true });
                    const onCommitted = (evt) => {
                      if (evt.data?.type !== "edit-committed" || evt.data.id !== mbid) return;
                      DISCOGS_CHANNEL.removeEventListener("message", onCommitted);
                      try {
                        if (editTab && typeof editTab.close === "function") editTab.close();
                      } catch (e2) {
                      }
                      recheckUrlBypassCache();
                    };
                    DISCOGS_CHANNEL.addEventListener("message", onCommitted);
                    linkSlot.innerHTML = "";
                    linkSlot.textContent = "\u2026";
                    linkSlot.dataset.tip = `Adding the ${srcName} link in the background\u2026`;
                    linkSlot.style.color = "var(--mbu-text-dim)";
                    linkSlot.style.fontStyle = "italic";
                    return;
                  }
                  const linkTab = window.open(editUrl, "_blank");
                  if (linkTab) {
                    const trySet = () => {
                      try {
                        linkTab.sessionStorage.setItem("discogs-importer-close-after-edit", "1");
                      } catch (e2) {
                        setTimeout(trySet, 50);
                      }
                    };
                    trySet();
                  }
                  linkSlot.innerHTML = "";
                  linkSlot.textContent = "\u2026";
                  linkSlot.dataset.tip = `The ${srcName} link is checked when you come back to this tab\u2026`;
                  linkSlot.style.color = "var(--mbu-text-dim)";
                  linkSlot.style.fontStyle = "italic";
                  const onReturn = () => {
                    if (document.visibilityState !== "visible") return;
                    document.removeEventListener("visibilitychange", onReturn);
                    window.removeEventListener("focus", onReturn);
                    recheckUrlBypassCache();
                  };
                  document.addEventListener("visibilitychange", onReturn);
                  window.addEventListener("focus", onReturn);
                };
                addLinkBtn.addEventListener("click", () => openLinkEdit(false));
                addLinkBtn.addEventListener("contextmenu", (e2) => {
                  e2.preventDefault();
                  openLinkEdit(true);
                });
                linkSlot.appendChild(addLinkBtn);
                rowLinkChips.set(_entityKey, addLinkBtn);
              }
            };
            const linkSlot = document.createElement("span");
            linkSlot.style.cssText = "display:inline-flex;align-items:center;font-size:0.8rem;color:var(--mbu-text-weak);";
            linkSlot.textContent = "\u2026";
            linkSlot.dataset.tip = `Checking whether MusicBrainz already links this ${srcName} URL\u2026`;
            tdAction.appendChild(linkSlot);
            const urlCheckCacheKey = `${selected.id}|${discogsHref}`;
            const urlCheckLsKey = `discogs-urlcheck-${selected.id}-${hashKey(discogsHref)}`;
            const urlCheckToday = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
            const urlCheckExpiry = /* @__PURE__ */ new Date();
            urlCheckExpiry.setDate(urlCheckExpiry.getDate() - 7);
            const urlCheckExpiryStr = urlCheckExpiry.toISOString().slice(0, 10);
            let urlCheckCached = _urlCheckSessionCache.get(urlCheckCacheKey) ?? null;
            if (urlCheckCached === null) {
              try {
                const s = JSON.parse(localStorage.getItem(urlCheckLsKey) || "null");
                if (s?.date >= urlCheckExpiryStr) urlCheckCached = s.result;
              } catch (e2) {
              }
              if (urlCheckCached !== null) _urlCheckSessionCache.set(urlCheckCacheKey, urlCheckCached);
            }
            if (!discogsHref || placeholderUrl) {
              linkState.set(_entityKey, "na");
              rowLinkChips.delete(_entityKey);
              updateLinksBadge();
              if (srcName === "Titles" || placeholderUrl || r.entity?._splitOf) {
                linkSlot.remove();
              } else {
                linkSlot.textContent = `\u26A0 No ${srcName} page`;
                linkSlot.style.color = "var(--mbu-warn)";
              }
            } else if (urlCheckCached !== null) {
              applyUrlCheckResult(urlCheckCached);
            } else if (Array.isArray(r.urlLinkedIds)) {
              const result = r.urlLinkedIds.includes(selected.id) ? "linked" : r.urlLinkedIds.length > 0 ? "other" : "none";
              _urlCheckSessionCache.set(urlCheckCacheKey, result);
              try {
                localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
              } catch (e2) {
              }
              applyUrlCheckResult(result);
            } else {
              queuedUrlCheck(
                () => fetchWithRetry(`${MB}/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`).then((json) => {
                  const linkedIds = (json.relations || []).filter((r2) => r2[entityType]).map((r2) => r2[entityType].id);
                  const result = linkedIds.includes(selected.id) ? "linked" : linkedIds.length > 0 ? "other" : "none";
                  _urlCheckSessionCache.set(urlCheckCacheKey, result);
                  try {
                    localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
                  } catch (e2) {
                  }
                  const healKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
                  if (healKey) writeIdbRecord(healKey, { urlLinkedIds: linkedIds });
                  applyUrlCheckResult(result);
                }).catch(() => applyUrlCheckResult("none"))
              );
            }
          }
          function openCreateTab({ name, disambiguation, background } = {}) {
            const finalName = (name || displayName).trim();
            const seedUrls = (params, et) => {
              const urls = r._mergeUrls && r._mergeUrls.length ? r._mergeUrls : [discogsHref];
              let n = 0;
              for (const u of urls) {
                if (!u) continue;
                const lt = sourceUrlLinkTypeId(u, et);
                if (!lt) continue;
                params[`edit-${et}.url.${n}.text`] = u;
                params[`edit-${et}.url.${n}.link_type_id`] = lt;
                n++;
              }
            };
            let createUrl;
            let createParams;
            if (entityType === "artist") {
              createParams = {
                "edit-artist.name": finalName,
                "edit-artist.sort_name": guessSortName(finalName),
                "edit-artist.type_id": "1"
              };
              seedUrls(createParams, "artist");
              if (disambiguation) createParams["edit-artist.comment"] = disambiguation;
              createParams["edit-artist.edit_note"] = buildCreateNote();
              createUrl = `https:${MB}/artist/create`;
            } else {
              createParams = {
                [`edit-${entityType}.name`]: finalName
              };
              seedUrls(createParams, entityType);
              if (disambiguation) createParams[`edit-${entityType}.comment`] = disambiguation;
              createParams[`edit-${entityType}.edit_note`] = buildCreateNote();
              createUrl = `https:${MB}/${entityType}/create`;
            }
            const p = new URLSearchParams(createParams);
            const pendingKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || displayName}`;
            let bgTab = null;
            if (background && typeof GM_openInTab === "function") {
              const url = `${createUrl}?${p}#ch-autocommit=${encodeURIComponent(pendingKey)}`;
              bgTab = GM_openInTab(url, { active: false, insert: true });
            } else {
              const newTab = window.open(`${createUrl}?${p}`, "_blank");
              if (newTab) {
                const trySet = () => {
                  try {
                    newTab.sessionStorage.setItem("discogs-importer-pending-artist", pendingKey);
                  } catch (e2) {
                    setTimeout(trySet, 50);
                  }
                };
                trySet();
              }
            }
            const onCreated = (evt) => {
              if (evt.data?.type !== "artist-created") return;
              if (evt.data.resourceUrl !== pendingKey) return;
              DISCOGS_CHANNEL.removeEventListener("message", onCreated);
              try {
                if (bgTab && typeof bgTab.close === "function") bgTab.close();
              } catch (e2) {
              }
              _urlCheckSessionCache.set(`${evt.data.id}|${discogsHref}`, "linked");
              if (evt.data.name) {
                setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
              } else {
                setRowResolved({ id: evt.data.id, name: finalName || displayName || "", disambiguation: "" });
                fetchWithRetry(`${MB}/ws/2/${entityType}/${evt.data.id}?fmt=json`).then((json) => {
                  if (json && json.name) setRowResolved({ id: evt.data.id, name: json.name, disambiguation: json.disambiguation || "" });
                }).catch(() => {
                });
              }
            };
            DISCOGS_CHANNEL.addEventListener("message", onCreated);
            if (background && typeof GM_openInTab === "function") {
              setRowCreating(finalName, () => {
                DISCOGS_CHANNEL.removeEventListener("message", onCreated);
                try {
                  if (bgTab && typeof bgTab.close === "function") bgTab.close();
                } catch (e2) {
                }
              });
            }
          }
          const createBtn = document.createElement("button");
          createBtn.textContent = "+";
          createBtn.dataset.tip = (discogsHref ? `Create it on MusicBrainz with the ${srcName} name and URL` : "Create it on MusicBrainz with the credited name") + "\nRight-click: create it silently in a background tab, submitted for you";
          createBtn.style.cssText = ACTION_CHIP_STYLE + "color:var(--mbu-ok);font-size:1.15rem;font-weight:600;";
          createBtn.addEventListener("click", () => openCreateTab());
          createBtn.addEventListener("contextmenu", (e2) => {
            e2.preventDefault();
            openCreateTab({ background: true });
          });
          const createAdvBtn = document.createElement("button");
          createAdvBtn.textContent = "\u25BE";
          createAdvBtn.dataset.tip = "Create it on MusicBrainz, with the name and disambiguation to edit first" + (srcName === "Discogs" && discogsHref ? "\nFilled in from the Discogs profile" : "");
          createAdvBtn.style.cssText = ACTION_CHIP_STYLE + "color:var(--mbu-text-dim);";
          createAdvBtn.addEventListener("click", () => openAdvancedCreatePopup());
          tdAction.appendChild(createBtn);
          tdAction.appendChild(createAdvBtn);
          async function openAdvancedCreatePopup() {
            const distinctRoles = [];
            const seen = /* @__PURE__ */ new Set();
            for (const role of r._roles || []) {
              const label = (role.task || role.displayLabel || role.linkType || "").trim();
              if (!label || seen.has(label)) continue;
              seen.add(label);
              distinctRoles.push(label);
              if (distinctRoles.length === 3) break;
            }
            const defaultDis = distinctRoles.join(", ");
            const overlay = document.createElement("div");
            overlay.className = "mbu-ui";
            overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;";
            const modal = document.createElement("div");
            modal.style.cssText = "background:var(--mbu-bg);border-radius:0.5rem;padding:1.1rem 1.35rem 1rem;max-width:600px;width:92%;max-height:82vh;display:flex;flex-direction:column;gap:0.55rem;box-shadow:0 12px 32px rgba(0,0,0,0.32);font-family:inherit;";
            const heading2 = document.createElement("div");
            heading2.style.cssText = "font-weight:bold;font-size:1.02rem;color:var(--mbu-text);margin-bottom:0.15rem;";
            heading2.textContent = `Create ${entityType} in MusicBrainz`;
            modal.appendChild(heading2);
            const FIELD_LABEL = "font-size:0.78rem;color:var(--mbu-text-dim);font-weight:600;letter-spacing:0.02em;text-transform:uppercase;margin-top:0.25rem;";
            const FIELD_INPUT = "padding:0.45rem 0.55rem;border:1px solid var(--mbu-border);border-radius:0.3rem;font-size:0.93rem;font-family:inherit;";
            const nameLabel = document.createElement("label");
            nameLabel.style.cssText = FIELD_LABEL;
            nameLabel.textContent = "Name";
            modal.appendChild(nameLabel);
            const nameInput = noPasswordManagers(document.createElement("input"));
            nameInput.value = displayName;
            nameInput.style.cssText = FIELD_INPUT;
            modal.appendChild(nameInput);
            let nameUserTouched = false;
            nameInput.addEventListener("input", () => {
              nameUserTouched = true;
            });
            const disLabel = document.createElement("label");
            disLabel.style.cssText = FIELD_LABEL;
            disLabel.textContent = "Disambiguation";
            modal.appendChild(disLabel);
            const disInput = noPasswordManagers(document.createElement("input"));
            disInput.value = defaultDis;
            disInput.style.cssText = FIELD_INPUT;
            modal.appendChild(disInput);
            let disUserTouched = false;
            disInput.addEventListener("input", () => {
              disUserTouched = true;
            });
            const showProfile = srcName === "Discogs" && !!discogsHref;
            let profileBox = null;
            if (showProfile) {
              const profileLabel = document.createElement("div");
              profileLabel.style.cssText = "font-size:0.78rem;color:var(--mbu-text-weak);margin-top:0.55rem;";
              profileLabel.textContent = "Discogs profile \u2014 select text to copy into Disambiguation";
              modal.appendChild(profileLabel);
              profileBox = document.createElement("div");
              profileBox.style.cssText = "border:1px solid var(--mbu-border);border-radius:0.3rem;padding:0.5rem 0.6rem;background:var(--mbu-bg-raised);font-size:0.85rem;line-height:1.5;white-space:pre-wrap;overflow:auto;min-height:5rem;max-height:18rem;flex:1;color:var(--mbu-text);";
              profileBox.textContent = "Loading profile from Discogs\u2026";
              modal.appendChild(profileBox);
              const captureSelection = () => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) return;
                if (!profileBox.contains(sel.anchorNode)) return;
                const text = sel.toString().trim();
                if (!text) return;
                disInput.value = text;
                disUserTouched = true;
              };
              profileBox.addEventListener("mouseup", captureSelection);
              profileBox.addEventListener("keyup", captureSelection);
            }
            const btnRow2 = document.createElement("div");
            btnRow2.style.cssText = "display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.55rem;";
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.style.cssText = "padding:0.4rem 1rem;cursor:pointer;border:1px solid var(--mbu-border);border-radius:0.25rem;background:var(--mbu-bg-raised);color:var(--mbu-text);font-size:0.88rem;";
            const submitBtn = document.createElement("button");
            submitBtn.textContent = "Create \u2197";
            submitBtn.dataset.tip = "Open the create page, for you to review\nRight-click: create it silently in a background tab, submitted for you";
            submitBtn.style.cssText = "padding:0.4rem 1.1rem;cursor:pointer;font-weight:bold;background:var(--mbu-ok);color:var(--mbu-text-on-accent);border:none;border-radius:0.25rem;font-size:0.9rem;";
            btnRow2.appendChild(cancelBtn);
            btnRow2.appendChild(submitBtn);
            modal.appendChild(btnRow2);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const close = () => {
              document.removeEventListener("keydown", onKey);
              overlay.remove();
            };
            const submit = (background) => {
              const name = nameInput.value.trim();
              const dis = disInput.value.trim();
              close();
              openCreateTab({ name: name || displayName, disambiguation: dis || null, background: !!background });
            };
            const onKey = (ev) => {
              if (ev.key === "Escape") {
                close();
              } else if (ev.key === "Enter" && (ev.target === disInput || ev.target === nameInput)) submit(false);
            };
            document.addEventListener("keydown", onKey);
            overlay.addEventListener("click", (ev) => {
              if (ev.target === overlay) close();
            });
            cancelBtn.addEventListener("click", close);
            submitBtn.addEventListener("click", () => submit(false));
            submitBtn.addEventListener("contextmenu", (ev) => {
              ev.preventDefault();
              submit(true);
            });
            disInput.focus();
            disInput.select();
            if (showProfile) try {
              const data = await getDiscogsEntityData(r.entity?.resource_url);
              if (data?.realname && !nameUserTouched && data.realname.trim() !== displayName.trim()) {
                nameInput.value = data.realname.trim();
              }
              const lines = [];
              if (data?.namevariations?.length) lines.push(`Also known as: ${data.namevariations.slice(0, 6).join(", ")}`);
              if (data?.profile) {
                if (lines.length) lines.push("");
                lines.push(data.profile);
              }
              profileBox.textContent = lines.length ? lines.join("\n") : "(no Discogs profile)";
            } catch (e2) {
              profileBox.textContent = "(failed to load Discogs profile)";
            }
          }
          if (selected && aliasPick && aliasPick.id === selected.id) {
            const ab = makeAddAliasBtn(aliasPick);
            if (ab) tdAction.insertBefore(ab, tdAction.firstChild);
          }
        }
        function makeCandidateRow(a) {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;gap:0.35rem;padding:0.2rem 0.35rem;border:1px solid var(--mbu-border);border-radius:3px;background:var(--mbu-bg);font-size:0.82rem;";
          const selBtn = document.createElement("button");
          selBtn.textContent = "\u2713";
          selBtn.dataset.tip = "Pick this candidate as the match";
          selBtn.style.cssText = "font-size:0.95rem;line-height:1;cursor:pointer;padding:0.1rem 0.45rem;white-space:nowrap;border:1px solid var(--mbu-border);border-radius:0.25rem;background:var(--mbu-ok-bg);color:var(--mbu-ok);font-weight:600;flex-shrink:0;";
          selBtn.addEventListener("click", () => setRowResolved(a));
          row.appendChild(selBtn);
          const below = r._below && r._below.mbid === a.id ? r._below : null;
          if (below) row.appendChild(makeLevelDot(below.level));
          const info = document.createElement("span");
          info.style.flex = "0 1 auto";
          const nameA = document.createElement("a");
          nameA.href = `https:${MB}/${entityType}/${a.id}`;
          nameA.target = "_blank";
          nameA.rel = "noopener noreferrer nofollow";
          nameA.style.fontWeight = "bold";
          nameA.textContent = a.name;
          info.appendChild(nameA);
          if (a.disambiguation) {
            const d = document.createElement("span");
            d.style.cssText = "color:var(--mbu-text-dim);margin-left:0.25rem;";
            d.textContent = `(${a.disambiguation})`;
            info.appendChild(d);
          }
          if (below) {
            const pill = document.createElement("span");
            pill.textContent = `below cutoff: ${VIA_STYLES[below.via]?.text || below.via}`;
            pill.dataset.tip = `Matched below the cutoff, so not picked
${MATCH_LEVELS[below.level].label}: ${MATCH_LEVELS[below.level].hint}
The cutoff is ${MATCH_LEVELS[cutoff].label}. \u2713 picks it.`;
            pill.style.cssText = "font-size:0.68rem;color:var(--mbu-warn);background:var(--mbu-warn-bg);border:1px solid var(--mbu-warn);border-radius:8px;padding:0 0.35rem;margin-left:0.35rem;white-space:nowrap;";
            info.appendChild(pill);
          }
          row.appendChild(info);
          const rolesEl = buildMbRolesEl(a.id);
          if (rolesEl) row.appendChild(rolesEl);
          return row;
        }
        function extractMbid(q) {
          const m = q.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
          return m ? m[0] : null;
        }
        function doSearch(q) {
          if (!q) return;
          const mbid = extractMbid(q);
          if (mbid) {
            candidateList.innerHTML = '<div style="font-size:0.82rem;color:var(--mbu-text-weak);">Looking up MBID\u2026</div>';
            mbThrottle.fetchJson(`${MB}/ws/2/${entityType}/${mbid}?inc=aliases&fmt=json`).then((json) => {
              if (!json) return;
              candidateList.innerHTML = "";
              if (json.id) {
                candidateList.appendChild(makeCandidateRow({
                  id: json.id,
                  name: json.name,
                  disambiguation: json.disambiguation || "",
                  aliases: json.aliases || []
                }));
              } else {
                candidateList.innerHTML = '<div style="font-size:0.82rem;color:var(--mbu-text-weak);">Not found</div>';
              }
            }).catch(() => {
              candidateList.innerHTML = `<div style="font-size:0.82rem;color:var(--mbu-error);">MBID not found or wrong entity type</div>`;
            });
            return;
          }
          candidateList.innerHTML = '<div style="font-size:0.82rem;color:var(--mbu-text-weak);font-style:italic;">Searching\u2026</div>';
          mbThrottle.fetchJson(`${MB}/ws/2/${entityType}?query=${encodeURIComponent(q)}&fmt=json&limit=8`).then((json) => {
            if (!json) {
              candidateList.innerHTML = '<div style="font-size:0.82rem;color:var(--mbu-error);">Search failed \u2014 MB unavailable</div>';
              return;
            }
            candidateList.innerHTML = "";
            const resultKey = entityType === "label" ? "labels" : entityType === "place" ? "places" : "artists";
            if (!json[resultKey] || json[resultKey].length === 0) {
              const none = document.createElement("div");
              none.style.cssText = "font-size:0.82rem;color:var(--mbu-text-weak);";
              none.textContent = "No results";
              candidateList.appendChild(none);
            } else {
              json[resultKey].forEach((a) => candidateList.appendChild(makeCandidateRow(a)));
            }
          }).catch(() => {
            candidateList.innerHTML = '<div style="font-size:0.82rem;color:var(--mbu-error);">Search failed</div>';
          });
        }
        let searchTimer;
        searchInput.addEventListener("input", () => {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => doSearch(searchInput.value.trim()), 300);
        });
        searchInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            doSearch(searchInput.value.trim());
          }
        });
        searchBtn.addEventListener("click", () => doSearch(searchInput.value.trim()));
        if (isResolved && initMbUrl) {
          const mbid = initMbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
          const correctedMbUrl = `${MB}/${entityType}/${mbid}`;
          const displayName2 = initMbName || mbid;
          if (!initMbName) {
            rowState.set(_entityKey, { mbUrl: initMbUrl, mbName: null, mbDisambig: "", confirmed: true, via: r.logEntry?.via || null, fromCache: r.logEntry?.fromCache || false });
            tr.style.background = "var(--mbu-warn-bg)";
          }
          const fakeA = { id: mbid, name: displayName2, disambiguation: initMbDisam };
          if (entityType === "artist" && initMbName && Array.isArray(r.mbAliases)) {
            fakeA.aliases = r.mbAliases;
            aliasPick = fakeA;
            if (wantsAliasButton(entityType, fakeA, displayName)) logDebug(`+ alias: offered on the automatic match "${displayName}" \u2192 ${initMbName} (not among its ${r.mbAliases.length} alias(es))`);
          }
          candidateList.innerHTML = "";
          const selRow = document.createElement("div");
          selRow.style.cssText = "padding:0.15rem 0.4rem;border:1px solid var(--mbu-ok);border-radius:3px;background:var(--mbu-ok-bg);display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;font-size:0.85rem;";
          const selA = document.createElement("a");
          selA.href = "https:" + correctedMbUrl;
          selA.target = "_blank";
          selA.rel = "noopener noreferrer nofollow";
          selA.textContent = "\u2713 " + displayName2 + (initMbDisam ? ` (${initMbDisam})` : "") + (!initMbName ? " \u26A0 name unknown" : "");
          selA.style.fontWeight = "bold";
          selA.style.whiteSpace = "nowrap";
          selA.style.flex = "0 0 auto";
          const undoBtn = document.createElement("button");
          undoBtn.textContent = "\u2715";
          undoBtn.dataset.tip = "Clear selection";
          undoBtn.className = "discogs-clear-btn";
          undoBtn.addEventListener("click", () => setRowUnresolved());
          selRow.appendChild(makeLevelDot(matchLevelOf(r.logEntry?.via)));
          selRow.appendChild(selA);
          const viaBadge = makeViaBadge(r.logEntry?.via, r.logEntry?.fromCache);
          if (viaBadge) selRow.appendChild(viaBadge);
          rowViaBadge = viaBadge;
          rowMatchId = mbid;
          const mbRolesEl = buildMbRolesEl();
          if (mbRolesEl) selRow.appendChild(mbRolesEl);
          selRow.appendChild(undoBtn);
          candidateList.appendChild(selRow);
          renderActions(fakeA);
        } else if (r.nameMatches && r.nameMatches.length > 0) {
          r.nameMatches.forEach((a) => candidateList.appendChild(makeCandidateRow(a)));
          renderActions(null);
        } else {
          const none = document.createElement("div");
          none.style.cssText = "font-size:0.82rem;color:var(--mbu-text-weak);";
          none.textContent = needsAttention ? "No suggestions \u2014 search or create" : "";
          if (needsAttention) candidateList.appendChild(none);
          renderActions(null);
        }
      }
      table.appendChild(tbody);
      panel.appendChild(table);
      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:0.75rem;align-items:center;margin-top:0.75rem;flex-wrap:wrap;";
      const importBtn = document.createElement("button");
      importBtn.style.cssText = "border:none;padding:0.4rem 1.1rem;border-radius:0.3rem;cursor:pointer;font-weight:bold;font-size:0.95rem;display:inline-flex;align-items:center;gap:5px;";
      const issueNote = document.createElement("span");
      issueNote.className = "discogs-issue-note";
      issueNote.style.cssText = "font-size:0.85rem;color:var(--mbu-warn);";
      linksNote = document.createElement("span");
      linksNote.className = "discogs-issue-note discogs-links-note";
      linksNote.style.cssText = "font-size:0.85rem;color:var(--mbu-warn);display:none;";
      linksNote.dataset.tip = `Matches whose ${importSourceName} URL MusicBrainz doesn\u2019t link yet
Click: go to the next one
Its \u{1F517} chip adds the link.`;
      linksNote.addEventListener("click", jumpNextLink);
      updateLinksBadge();
      let _jumpIdx = -1;
      function jumpNextUnresolved() {
        const n = allResults.length;
        let found = -1;
        for (let step = 1; step <= n; step++) {
          const i = (_jumpIdx + step) % n;
          if (!rowState.get(keyOf(allResults[i]))?.confirmed) {
            found = i;
            break;
          }
        }
        if (found === -1) return;
        _jumpIdx = found;
        const input = rowSearchInputs.get(keyOf(allResults[found]));
        if (!input) return;
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
        input.select?.();
      }
      issueNote.addEventListener("click", jumpNextUnresolved);
      function recSelectionCounts() {
        try {
          let total = 0, checked = 0;
          for (const tr of document.querySelectorAll("tr")) {
            if (!tr.querySelector('a[href*="/recording/"]')) continue;
            const cb = tr.querySelector('input[type="checkbox"]');
            if (!cb) continue;
            total++;
            if (cb.checked) checked++;
          }
          return total ? { checked, total } : null;
        } catch (e) {
          return null;
        }
      }
      function updateImportBtn() {
        const unresolved = [...rowState.values()].filter((s) => !s.confirmed).length;
        const sel = recSelectionCounts();
        const selLabel = sel && sel.checked > 0 && sel.checked < sel.total ? ` (${sel.checked}/${sel.total})` : "";
        if (unresolved === 0) {
          importBtn.innerHTML = `Start import${selLabel} \u2192`;
          importBtn.style.background = "var(--mbu-ok)";
          importBtn.style.color = "var(--mbu-text-on-accent)";
          issueNote.textContent = "";
          issueNote.classList.remove("clickable");
          issueNote.removeAttribute("data-tip");
        } else {
          importBtn.innerHTML = `Start import anyway${selLabel} \u2192`;
          importBtn.style.background = "var(--mbu-warn)";
          importBtn.style.color = "var(--mbu-text-on-accent)";
          issueNote.textContent = `\u26A0 ${unresolved} unresolved`;
          issueNote.classList.add("clickable");
          issueNote.dataset.tip = "Entities not resolved: skipped on import\nClick: go to the next one (again: the one after)";
        }
      }
      updateImportBtn();
      let _lastSelKey = "";
      const _recSelPoll = setInterval(() => {
        if (!importBtn.isConnected) {
          clearInterval(_recSelPoll);
          return;
        }
        const s = recSelectionCounts();
        const k = s ? `${s.checked}/${s.total}` : "";
        if (k !== _lastSelKey) {
          _lastSelKey = k;
          updateImportBtn();
        }
      }, 1e3);
      function buildStaticTableLi() {
        const tbl = document.createElement("table");
        tbl.style.cssText = "border-collapse:collapse;width:100%;font-size:0.78rem;margin:0.4rem 0;";
        const thRow = document.createElement("tr");
        thRow.style.background = "var(--mbu-bg-raised)";
        [importSourceName + " entity", "Roles / Tracks", "MB match", "MBID", "Resolved via"].forEach((h) => {
          const th = document.createElement("th");
          th.style.cssText = "text-align:left;padding:0.2rem 0.4rem;border:1px solid var(--mbu-border);white-space:nowrap;";
          th.textContent = h;
          thRow.appendChild(th);
        });
        tbl.appendChild(thRow);
        allResults.forEach((r) => {
          const _rKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
          const state = rowState.get(_rKey) || {};
          const tr2 = document.createElement("tr");
          const url = r.entity?.resource_url || r.entity?._syntheticKey || "";
          const rolesList2 = url ? rolesMap.get(url) || companiesRolesMap.get(url) || [] : [];
          const grouped2 = /* @__PURE__ */ new Map();
          rolesList2.forEach(({ displayLabel, linkType, trackPos }) => {
            const key = displayLabel || linkType;
            if (!grouped2.has(key)) grouped2.set(key, /* @__PURE__ */ new Set());
            if (trackPos) grouped2.get(key).add(trackPos);
          });
          const rolesText = [...grouped2.entries()].map(([label, tr]) => label + (tr.size ? " [" + [...tr].join(",") + "]" : "")).join("; ");
          const mbid = state.mbUrl ? state.mbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36) : "";
          const matchText = state.mbName || (state.mbUrl ? mbid : "");
          const vCfg = state.via ? viaCfg(state.via, state.fromCache) : null;
          const viaText = vCfg ? vCfg.text : state.mbUrl ? "\u2014" : "";
          [r.displayName || r.entity?.name, rolesText, matchText, mbid, viaText].forEach((val, ci) => {
            const td = document.createElement("td");
            td.style.cssText = "padding:0.15rem 0.4rem;border:1px solid var(--mbu-border);" + (ci === 2 && !val ? "color:var(--mbu-text-weak);" : ci === 2 ? "color:var(--mbu-ok);" : ci === 4 && vCfg ? `color:${vCfg.color};` : "");
            if (ci === 2 && mbid) {
              const a = document.createElement("a");
              a.href = "https:" + state.mbUrl;
              a.target = "_blank";
              a.rel = "noopener noreferrer nofollow";
              a.textContent = val || mbid;
              td.appendChild(a);
            } else {
              td.textContent = val || (ci === 1 ? "" : ci === 2 ? "\u2014" : "");
            }
            tr2.appendChild(td);
          });
          tbl.appendChild(tr2);
        });
        const tblLi = document.createElement("li");
        tblLi.style.cssText = "list-style:none;margin:0;padding:0;";
        tblLi.appendChild(tbl);
        return tblLi;
      }
      importBtn.addEventListener("click", () => {
        clearInterval(_recSelPoll);
        const confirmedMap = /* @__PURE__ */ new Map();
        rowState.forEach((s, key) => {
          if (s.mbUrl) confirmedMap.set(key, s.mbUrl);
        });
        getLogContainer().appendChild(buildStaticTableLi());
        const unresolvedCount = allResults.filter((r) => {
          const _k = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
          return !rowState.get(_k)?.confirmed;
        }).length;
        if (unresolvedCount > 0) {
          const unresolvedLi = document.createElement("li");
          unresolvedLi.style.cssText = "list-style:none;margin:0.2rem 0;font-size:0.82rem;color:var(--mbu-warn);";
          unresolvedLi.textContent = `\u26A0 ${unresolvedCount} entity/entities unresolved \u2014 will be skipped`;
          getLogContainer().appendChild(unresolvedLi);
        }
        confirmedMap.unresolvedCount = unresolvedCount;
        confirmedMap.totalEntities = allResults.length;
        confirmedMap.creditOverrides = creditOverrides;
        confirmedMap.splits = splits;
        const matchCounts = { levels: MATCH_LEVELS.map(() => 0), user: 0, cutoff: MATCH_LEVELS[cutoff].label };
        rowState.forEach((st) => {
          if (!st.mbUrl) return;
          const lv = st.via === "user" ? null : matchLevelOf(st.via);
          if (lv == null) matchCounts.user++;
          else matchCounts.levels[lv]++;
        });
        confirmedMap.matchCounts = matchCounts;
        (panelLi || panel).remove();
        if (headerSlot) headerSlot.replaceChildren();
        resolve(confirmedMap);
      });
      if (headerSlot) {
        headerSlot.replaceChildren(importBtn, issueNote, linksNote);
      } else {
        btnRow.appendChild(importBtn);
        btnRow.appendChild(issueNote);
        btnRow.appendChild(linksNote);
        panel.appendChild(btnRow);
      }
      updateLinksBadge();
      const panelLi = document.createElement("li");
      panelLi.style.cssText = "list-style:none;margin:0;padding:0;";
      panelLi.classList.add("discogs-review-panel-li");
      panelLi._buildStaticTableLi = buildStaticTableLi;
      panelLi.appendChild(panel);
      getReviewContainer().appendChild(panelLi);
      panelLi.scrollIntoView({ behavior: "smooth", block: "nearest" });
      _hideBar();
    });
  }

  // src/match-context.js
  var SPECIAL2 = new Set(MBM_SPECIAL_PURPOSE);
  var _relatedCache = /* @__PURE__ */ new Map();
  function releaseArtistMbids() {
    try {
      const names = pageWindow.MB?.relationshipEditor?.state?.entity?.artistCredit?.names || [];
      return [...new Set(names.map((n) => n?.artist?.gid).filter(Boolean))];
    } catch (e) {
      return [];
    }
  }
  async function buildReleaseContext({ coCredit = false } = {}) {
    const all = releaseArtistMbids();
    const seeds = all.filter((g) => !SPECIAL2.has(g));
    if (all.length && !seeds.length) log.info("Matching context: the release artist is special-purpose (e.g. Various Artists) \u2014 no context lookup (#612)");
    const related = [];
    for (const gid of seeds.slice(0, 4)) {
      let list = _relatedCache.get(gid);
      if (!list) {
        const json = await mbThrottle.fetchJson(`${MB}/ws/2/artist/${gid}?inc=aliases+artist-rels&fmt=json`);
        if (!json) {
          log.warn(`Matching context: could not load release artist ${gid} \u2014 continuing without it`);
          continue;
        }
        list = mbmRelatedArtists(json);
        _relatedCache.set(gid, list);
      }
      for (const r of list) if (!related.some((x) => x.gid === r.gid)) related.push(r);
    }
    if (seeds.length) {
      const kinds = related.filter((r) => r.rel !== "self").reduce((m, r) => (m[r.rel] = (m[r.rel] || 0) + 1, m), {});
      log.info(`Matching context: ${seeds.length} release artist(s) \u2192 ${related.length - seeds.length} related artist(s)` + (Object.keys(kinds).length ? ` (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")})` : "") + (coCredit ? " \xB7 co-credit search on" : ""));
      logDebug(`context related: ${related.map((r) => `${r.name}[${r.rel}]`).join(", ")}`);
    }
    return { seeds, related, coCredit: !!coCredit };
  }

  // src/editor-state.js
  async function waitForMBEditor(timeoutMs = 15e3) {
    log.info("Waiting for MB relationship editor\u2026");
    let waited = 0;
    while (waited < timeoutMs) {
      const MB2 = pageWindow.MB;
      const re = MB2?.relationshipEditor;
      const st = re?.state;
      if (st?.entity) {
        log.info(`Editor ready (${waited}ms). Release: "${st.entity.name}"`);
        return re;
      }
      if (waited % 2e3 === 0 && waited > 0) {
        const mbKeys = MB2 ? Object.keys(MB2).join(", ") : "undefined";
        const reKeys = re ? Object.keys(re).join(", ") : "undefined";
        const stKeys = st ? Object.keys(st).join(", ") : "undefined";
        log.info(`[${waited}ms] MB={${mbKeys}} re={${reKeys}} state={${stKeys}}`);
      }
      await new Promise((r) => setTimeout(r, 200));
      waited += 200;
    }
    log.error("MB editor not ready after 15s \u2014 aborting");
    return null;
  }
  function dispatchRelationship(re, sourceEntity, targetEntity, linkTypeID, credit, attributes, trackPos) {
    if (credit && credit === (targetEntity.name || "")) credit = "";
    const swapped = sourceEntity.entityType > targetEntity.entityType;
    const e0 = swapped ? targetEntity : sourceEntity;
    const e1 = swapped ? sourceEntity : targetEntity;
    const ltEntry = pageWindow.MB?.linkedEntities?.link_type?.[linkTypeID];
    const ltName = ltEntry ? ltEntry.name : linkTypeID;
    let attrDesc = "";
    if (attributes) {
      try {
        const parts = [];
        for (const a of pageWindow.MB.tree.iterate(attributes)) {
          const n = a.type?.name || a.typeID;
          const v = a.text_value ? `=${a.text_value}` : "";
          if (n) parts.push(n + v);
        }
        if (parts.length) attrDesc = ` [${parts.join(", ")}]`;
      } catch (e) {
      }
    }
    const posLabel = trackPos != null && trackPos !== "" ? ` <span style="color:var(--mbu-text-weak);font-size:0.85em">#${trackPos}</span>` : "";
    log.info(`\u2192 <strong>${ltName}</strong>${attrDesc}${posLabel}: ${sourceEntity.name || sourceEntity.gid} \u2194 ${targetEntity.name || targetEntity.gid}${credit && credit !== (targetEntity.name || targetEntity.gid) ? ` (credited: ${credit})` : ""}`);
    re.dispatch({
      type: "update-relationship-state",
      sourceEntity,
      batchSelectionCount: null,
      creditsToChangeForSource: "",
      creditsToChangeForTarget: "",
      oldRelationshipState: null,
      newRelationshipState: {
        ...REL_TEMPLATE,
        entity0: e0,
        entity0_credit: swapped ? credit || "" : "",
        entity1: e1,
        entity1_credit: swapped ? "" : credit || "",
        id: re.getRelationshipStateId(),
        linkTypeID,
        attributes: attributes || null
      }
    });
  }
  function buildAttributes(rawAttributes, linkTypeID) {
    if (!rawAttributes || rawAttributes.length === 0) return null;
    const MB2 = pageWindow.MB;
    const tree = MB2?.tree;
    const lat = MB2?.linkedEntities?.link_attribute_type;
    if (!tree || !lat) return null;
    const linkType = linkTypeID != null ? MB2?.linkedEntities?.link_type?.[linkTypeID] : null;
    const supportedRoots = linkType && linkType.attributes ? new Set(Object.keys(linkType.attributes)) : null;
    const attrSupported = (found) => {
      if (!supportedRoots) return true;
      const rootId = found.root_id != null ? found.root_id : found.id;
      return supportedRoots.has(String(rootId));
    };
    function findAttrByName(name) {
      const lower = name.toLowerCase().trim();
      for (const v of Object.values(lat)) {
        if (v.name?.toLowerCase() === lower) return v;
      }
      if (lower.length >= 4) {
        for (const v of Object.values(lat)) {
          const vl = v.name?.toLowerCase() || "";
          if (vl.length < 4) continue;
          if (vl.includes(lower) || lower.includes(vl)) return v;
        }
      }
      log.warn(`Attribute "${name}" not found in MB \u2014 dropping attribute but keeping the rel`);
      return null;
    }
    const attrObjs = [];
    const seen = /* @__PURE__ */ new Set();
    for (const attr of rawAttributes) {
      let attrName = null;
      let textValue = "";
      let creditedAs = "";
      if (typeof attr === "string") {
        attrName = attr;
      } else if (attr && typeof attr === "object" && attr._type) {
        if (attr._type === "task") {
          attrName = "task";
          textValue = attr.value;
        } else {
          attrName = attr.value;
        }
        if (attr.creditedAs) creditedAs = attr.creditedAs;
      }
      if (!attrName) continue;
      const found = findAttrByName(attrName);
      if (!found || seen.has(found.id)) continue;
      if (!attrSupported(found)) {
        log.warn(`Attribute "${found.name}" isn't supported by link type "${linkType.name || linkTypeID}" \u2014 dropping it (keeping the rel)`);
        continue;
      }
      seen.add(found.id);
      attrObjs.push({ type: found, typeID: found.id, credited_as: creditedAs, text_value: textValue });
    }
    if (attrObjs.length === 0) return null;
    attrObjs.sort((a, b) => a.typeID - b.typeID);
    try {
      return tree.fromDistinctAscArray(attrObjs);
    } catch (e) {
      log.warn(`Attribute tree build failed (${e.message}) \u2014 importing without attributes`);
      return null;
    }
  }

  // src/data/work-only-rels.js
  var WORK_ONLY_ARTIST_RELS = [
    "writer",
    "composer",
    "lyricist",
    "librettist",
    "revised by",
    // NOT 'translator' — a translator credit (liner notes / lyrics / libretto) is a
    // release-wide credit, so it dispatches at RELEASE level (artist↔release
    // "translator"), not duplicated onto every work. (MB has the artist-release rel.)
    "reconstructed by",
    // 'arranger',
    // 'instruments arranger',
    "orchestrator",
    // 'vocals arranger',
    "previously attributed to",
    "miscellaneous support",
    "dedicated to",
    "premiered by",
    "was commissioned by",
    "publisher",
    // MB's actual link-type name for the music-publisher rel (label→work).
    // Tidal/Qobuz "Music Publisher" credits resolve to a label and attach here.
    "publishing",
    "inspired the name of"
  ];

  // src/dispatch.js
  var stripDiscogsNum2 = (s) => String(s || "").replace(/\s+\(\d+\)$/, "");
  function makeIdentifyingClassifier(lat) {
    const identifyingRoots = /* @__PURE__ */ new Set();
    if (lat) {
      for (const v of Object.values(lat)) {
        const isRoot = v.parent_id == null || v.parent_id === v.id;
        if (isRoot && /^(instrument|vocal)$/i.test(v.name || "")) identifyingRoots.add(v.id);
      }
    }
    const rootCache = /* @__PURE__ */ new Map();
    const rootIdOf = (typeID) => {
      if (rootCache.has(typeID)) return rootCache.get(typeID);
      let node = lat ? lat[typeID] : null;
      let guard = 0;
      while (node && node.parent_id != null && node.parent_id !== node.id && lat[node.parent_id] && guard++ < 64) {
        node = lat[node.parent_id];
      }
      const rootId = node ? node.id : typeID;
      rootCache.set(typeID, rootId);
      return rootId;
    };
    return (typeID) => identifyingRoots.has(rootIdOf(typeID));
  }
  async function dispatchAllRelationships(companies, artistRoles, tracklistRels, applyToTracks, createWorksMode, discogsTracklist, processTracklist, resolvedEntityTypes, confirmedMap, discogsUrl, dedupOpts) {
    resolvedEntityTypes = resolvedEntityTypes || /* @__PURE__ */ new Map();
    confirmedMap = confirmedMap || /* @__PURE__ */ new Map();
    dedupOpts = dedupOpts || {};
    if (confirmedMap.splits?.size) {
      const keyOfEntity = (e) => e.resource_url || e._syntheticKey || `_nourl_${e.name}`;
      const before = (artistRoles?.length || 0) + (tracklistRels?.length || 0);
      artistRoles = expandSplitRoles(artistRoles, confirmedMap.splits, keyOfEntity);
      tracklistRels = expandSplitRoles(tracklistRels, confirmedMap.splits, keyOfEntity);
      const after = (artistRoles?.length || 0) + (tracklistRels?.length || 0);
      confirmedMap.splits.forEach((parts, k) => log.info(`#605 split ${k} \u2192 ${parts.map((p) => `${p.name} [${confirmedMap.get(p.key) || "unresolved"}]`).join(" \xB7 ")}`));
      log.info(`#605 split: ${before} role(s) \u2192 ${after} after fan-out`);
    }
    const dedupeEquivalenceSets = dedupOpts.dedupeEquivalenceSets !== false;
    const dedupeDuplicateRoles = dedupOpts.dedupeDuplicateRoles !== false;
    const creditOverrides = dedupOpts.creditOverrides || /* @__PURE__ */ new Map();
    const re = await waitForMBEditor();
    if (!re) return;
    const MB2 = pageWindow.MB;
    const isIdentifyingAttr = makeIdentifyingClassifier(MB2?.linkedEntities?.link_attribute_type);
    const equivalenceLookup = (() => {
      const m = /* @__PURE__ */ new Map();
      if (!dedupeEquivalenceSets || !MB2?.linkedEntities?.link_type) return m;
      for (const set of EQUIVALENCE_SETS) {
        const byPair = /* @__PURE__ */ new Map();
        for (const [id, lt] of Object.entries(MB2.linkedEntities.link_type)) {
          if (!lt?.name) continue;
          if (!set.includes(String(lt.name).toLowerCase())) continue;
          const key = `${lt.type0}|${lt.type1}`;
          if (!byPair.has(key)) byPair.set(key, []);
          byPair.get(key).push(Number(id));
        }
        for (const ids of byPair.values()) {
          if (ids.length < 2) continue;
          const sibSet = new Set(ids);
          for (const id of ids) m.set(id, sibSet);
        }
      }
      return m;
    })();
    const releaseEntity = re.state.entity;
    let added = 0, existedInMb = 0, existedStaged = 0, dedupedThisSession = 0, skipped = 0, failed = 0;
    const dispatchedThisSession = /* @__PURE__ */ new Set();
    const RECORDING_LINK_TYPES = /* @__PURE__ */ new Set([
      "performer",
      "instrument",
      "vocal",
      "vocals",
      "orchestra",
      "conductor",
      "concertmaster",
      "chorus master",
      "producer",
      "engineer",
      "mix",
      "recording",
      "remixer",
      "DJ-mixer",
      "additional",
      "guest",
      "programming"
      // NOT 'mastering' — MB deprecated artist→recording mastering (link type 136).
    ]);
    const isExecProducer = (role) => role.linkType === "producer" && (role.attributes || []).some((a) => a === "executive" || a && a.value === "executive");
    log.info(`Starting instant fill: ${companies.length} companies, ${artistRoles.length} release artist roles, ${tracklistRels.length} tracklist roles`);
    try {
      _showBar();
    } catch (_) {
    }
    const bar = document.querySelector(".discogs-bar");
    function tickProgress() {
      const done = added + skipped + failed;
      const est = Math.max(done + 1, companies.length + artistRoles.length + tracklistRels.length);
      const pct = Math.min(Math.round(done / est * 99), 99);
      try {
        _setProgressPct(pct);
      } catch (_) {
      }
    }
    const recordingByGid = /* @__PURE__ */ new Map();
    const recordingByPosition = /* @__PURE__ */ new Map();
    const editorWorkByRecGid = /* @__PURE__ */ new Map();
    const positionByGid = /* @__PURE__ */ new Map();
    let trackCount = 0;
    try {
      let mediumIndex = 0;
      for (const [mediumKey, medium] of MB2.tree.iterate(re.state.mediums)) {
        mediumIndex++;
        const tracks = medium?.tracks ?? medium;
        let trackIndex = 0;
        for (const rawTrack of MB2.tree.iterate(tracks)) {
          const trackObj = Array.isArray(rawTrack) ? rawTrack[1] : rawTrack;
          const trackKey = Array.isArray(rawTrack) ? rawTrack[0] : null;
          const rec = trackObj?.recording ?? trackObj;
          if (!rec) continue;
          trackCount++;
          if (rec.gid) {
            recordingByGid.set(rec.gid, rec);
            positionByGid.set(rec.gid, `${mediumIndex}-${trackIndex + 1}`);
            const rw = trackObj?.relatedWorks;
            if (rw && rw.size > 0) {
              try {
                for (const entry of MB2.tree.iterate(rw)) {
                  const raw = Array.isArray(entry) ? entry[1] : entry;
                  const work = raw?.work ?? raw;
                  if (work?.gid || work?.id) {
                    editorWorkByRecGid.set(rec.gid, work);
                    break;
                  }
                }
              } catch (e) {
              }
            }
          }
          const positions = new Set([
            trackObj?.position,
            trackObj?.number,
            rec?.position,
            rec?.number,
            trackKey,
            trackIndex + 1,
            // Compound keys: "mediumIndex-trackPosition"
            `${mediumIndex}-${trackIndex + 1}`,
            trackObj?.position != null ? `${mediumIndex}-${trackObj.position}` : null,
            trackObj?.number != null ? `${mediumIndex}-${trackObj.number}` : null
          ].filter((x) => x != null).map(String));
          for (const p of positions) recordingByPosition.set(p, rec);
          trackIndex++;
        }
      }
      log.info(`Found ${trackCount} track(s) in editor state (${recordingByGid.size} with GID, ${recordingByPosition.size} position entries: ${[...recordingByPosition.keys()].join(",")}). relatedWorks: ${editorWorkByRecGid.size} pre-linked`);
    } catch (e) {
      log.warn(`Iterating MB state: ${e.message}`);
    }
    const checkedRecGids = /* @__PURE__ */ new Set();
    try {
      for (const raw of MB2.tree.iterate(re.state.selectedRecordings)) {
        const rec = Array.isArray(raw) ? raw[1] : raw;
        if (rec?.gid) checkedRecGids.add(rec.gid);
      }
    } catch (e) {
    }
    const recSelectionActive = checkedRecGids.size > 0 && checkedRecGids.size < recordingByGid.size;
    const applyToRec = (gid) => !recSelectionActive || checkedRecGids.has(gid);
    if (recSelectionActive) log.info(`Recording selection: applying only to ${checkedRecGids.size}/${recordingByGid.size} checked recording(s).`);
    const positionToGid = /* @__PURE__ */ new Map();
    try {
      const relMbid = releaseEntity.gid;
      log.info(`WS2: fetching recordings for release ${relMbid}\u2026`);
      const wsJson = await fetchWithRetry(`/ws/2/release/${relMbid}?inc=recordings&fmt=json`);
      log.info(`WS2: response received`);
      if (wsJson) {
        const mediaCount = wsJson.media?.length ?? 0;
        log.info(`WS2: ${mediaCount} medium/media in response`);
        const mediaArr = wsJson.media || [];
        const isMultiMedium2 = mediaArr.length > 1;
        for (const medium of mediaArr) {
          const medPos = medium.position;
          for (const track of medium.tracks || []) {
            const gid = track.recording?.id;
            if (!gid) continue;
            if (medPos != null && track.position != null) {
              positionToGid.set(`${medPos}-${track.position}`, gid);
            }
            if (medPos != null && track.number != null) {
              positionToGid.set(`${medPos}-${track.number}`, gid);
            }
            if (!isMultiMedium2) {
              if (track.position != null) positionToGid.set(String(track.position), gid);
              if (track.number != null) positionToGid.set(String(track.number), gid);
            }
          }
        }
        log.info(`WS2 position map: ${positionToGid.size} entries (${[...positionToGid.keys()].sort().join(", ")})`);
      }
    } catch (e) {
      log.warn(`WS2 recording fetch failed: ${e.message} \u2014 using editor state positions only`);
    }
    const isMultiMedium = positionToGid.size > 0 && [...positionToGid.keys()].some((k) => /^[2-9]-/.test(k));
    function inferDiscFromVinylSide(pos) {
      const m = String(pos || "").match(/^([A-Z])\d+$/i);
      if (!m) return null;
      return Math.floor((m[1].toUpperCase().charCodeAt(0) - 65) / 2) + 1;
    }
    function getRecordingEntity(track) {
      const stripPad = (s) => String(s).replace(/-0+(\d)/g, "-$1");
      const pos = track.position != null ? String(track.position) : "";
      const num = track.number != null ? String(track.number) : "";
      const compounds = /* @__PURE__ */ new Set();
      const plain = /* @__PURE__ */ new Set();
      if (/^\d+-/.test(pos)) {
        compounds.add(pos);
        const unpadded = stripPad(pos);
        if (unpadded !== pos) compounds.add(unpadded);
      } else if (pos) {
        plain.add(pos);
        const inferredDisc = inferDiscFromVinylSide(pos);
        if (inferredDisc != null) compounds.add(`${inferredDisc}-${pos}`);
        for (let m = 1; m <= 10; m++) compounds.add(`${m}-${pos}`);
      }
      if (num && num !== pos) {
        plain.add(num);
        for (let m = 1; m <= 10; m++) compounds.add(`${m}-${num}`);
      }
      const tryKeys = isMultiMedium ? [...compounds] : [...plain, ...compounds];
      for (const c of tryKeys) {
        const gid = positionToGid.get(c);
        if (gid) {
          const rec = recordingByGid.get(gid);
          if (rec) return rec;
          log.warn(`Recording ${gid} for track ${track.position} not in editor state`);
          return null;
        }
      }
      for (const c of tryKeys) {
        const rec = recordingByPosition.get(c);
        if (rec) return rec;
      }
      if (trackCount > 0) {
        const ws2Keys = positionToGid.size ? [...positionToGid.keys()].join(", ") : "(empty)";
        const stateKeys = recordingByPosition.size ? [...recordingByPosition.keys()].join(", ") : "(empty)";
        log.warn(`No recording for track ${track.position} "${track.title}". WS2 keys: ${ws2Keys} | State keys: ${stateKeys}`);
      }
      return null;
    }
    function confirmedMbUrl(entity) {
      if (!entity) return null;
      const direct = confirmedMap.get(entity.resource_url) || confirmedMap.get(entity._syntheticKey) || null;
      if (direct) return direct;
      if (entity.name) {
        return confirmedMap.get(`_nourl_${entity.name}`) || null;
      }
      return null;
    }
    function relAlreadyExists(sourceEntity, linkTypeID, targetGid, attrTree) {
      const rels = sourceEntity?.relationships;
      if (!Array.isArray(rels) || rels.length === 0) return null;
      const acceptableLinkTypes = equivalenceLookup.get(linkTypeID) || /* @__PURE__ */ new Set([linkTypeID]);
      const sigOf = (attrs) => attrs.map((a) => `${a.typeID}:${a.text_value || ""}:${a.credited_as || ""}`).sort().join(",");
      const idSigOf = (attrs) => attrs.filter((a) => isIdentifyingAttr(a.typeID)).map((a) => `${a.typeID}:${a.text_value || ""}:${a.credited_as || ""}`).sort().join(",");
      const candAttrs = (() => {
        if (!attrTree) return [];
        try {
          return [...pageWindow.MB.tree.iterate(attrTree)].map((a) => ({ typeID: a.typeID, text_value: a.text_value || "", credited_as: a.credited_as || "" }));
        } catch (e) {
          return [];
        }
      })();
      const candSig = sigOf(candAttrs);
      const candIdSig = idSigOf(candAttrs);
      const lookupName = (id) => {
        try {
          return pageWindow.MB.linkedEntities.link_type[id]?.name || `#${id}`;
        } catch (e) {
          return `#${id}`;
        }
      };
      let dupMatch = null;
      for (const r of rels) {
        if (!acceptableLinkTypes.has(r.linkTypeID)) continue;
        const tgt = r.target?.gid || r.entity0?.gid || r.entity1?.gid;
        if (tgt !== targetGid) continue;
        const isEquivalent = r.linkTypeID !== linkTypeID;
        const existingAttrs = (r.attributes || []).map((a) => ({ typeID: a.typeID, text_value: a.text_value || "", credited_as: a.credited_as || "" }));
        const exactMatch = sigOf(existingAttrs) === candSig;
        if (exactMatch) {
          return { kind: isEquivalent ? "equivalence" : "exact", existingLinkName: lookupName(r.linkTypeID), status: r._status };
        }
        if (dedupeDuplicateRoles && !dupMatch && idSigOf(existingAttrs) === candIdSig) {
          dupMatch = { kind: isEquivalent ? "equivalence" : "duplicate-role", existingLinkName: lookupName(r.linkTypeID), status: r._status };
        }
      }
      return dupMatch;
    }
    async function processOne(sourceEntity, entityType0, entityType1, linkTypeName, mbUrl, rawAttributes, credit, trackPos) {
      const overrideCredit = creditOverrides.get(mbUrl);
      if (overrideCredit && String(overrideCredit).trim()) {
        credit = String(overrideCredit).trim();
      }
      const mbid = mbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
      if (!mbid) {
        log.error(`Bad MBID URL: ${mbUrl}`);
        failed++;
        return;
      }
      const linkTypeID = resolveLinkTypeId(linkTypeName, entityType0, entityType1);
      if (!linkTypeID) {
        failed++;
        return;
      }
      const attrTree = buildAttributes(rawAttributes, linkTypeID);
      const attrSig = attrTree ? (() => {
        try {
          return [...pageWindow.MB.tree.iterate(attrTree)].map((a) => (a.typeID || "") + (a.credited_as ? "~" + a.credited_as : "")).join(",");
        } catch (e) {
          return "";
        }
      })() : "";
      const sessionKey = `${sourceEntity.gid}|${linkTypeID}|${mbid}|${attrSig}`;
      if (dispatchedThisSession.has(sessionKey)) {
        log.info(`Skipped duplicate dispatch of <strong>${linkTypeName}</strong>: ${sourceEntity.name} \u2194 ${credit || ""} \u2014 already queued earlier this run`);
        dedupedThisSession++;
        return;
      }
      dispatchedThisSession.add(sessionKey);
      let targetEntity;
      try {
        targetEntity = await fetchMBEntity(mbid);
      } catch (e) {
        log.error(`Entity fetch failed for ${mbid}: ${e.message}`);
        failed++;
        return;
      }
      const PLACE_TO_LABEL_LINK = {
        "glass mastered at": "glass mastered",
        "mastered at": "mastering",
        "pressed at": "pressed",
        "manufactured at": "manufactured",
        "recorded at": "engineer",
        "mixed at": "mix"
      };
      const LABEL_TO_PLACE_LINK = Object.fromEntries(
        Object.entries(PLACE_TO_LABEL_LINK).map(([k, v]) => [v, k])
      );
      let resolvedLinkTypeID = linkTypeID;
      if (targetEntity.entityType !== entityType1 && targetEntity.entityType !== entityType0) {
        const at = targetEntity.entityType;
        const [rt0, rt1] = at < sourceEntity.entityType ? [at, sourceEntity.entityType] : [sourceEntity.entityType, at];
        let reResolved = resolveLinkTypeId(linkTypeName, rt0, rt1);
        if (!reResolved) {
          const altName = at === "label" ? PLACE_TO_LABEL_LINK[linkTypeName] : LABEL_TO_PLACE_LINK[linkTypeName];
          if (altName) reResolved = resolveLinkTypeId(altName, rt0, rt1);
        }
        if (reResolved) {
          resolvedLinkTypeID = reResolved;
        } else {
          log.warn(`Entity "${targetEntity.name}" is a ${targetEntity.entityType} but expected ${entityType0}/${entityType1} \u2014 link type "${linkTypeName}" may not apply`);
        }
      }
      const dedupHit = relAlreadyExists(sourceEntity, resolvedLinkTypeID, targetEntity.gid, attrTree);
      if (dedupHit) {
        const pair = `${sourceEntity.name} \u2194 ${targetEntity.name}${credit && credit !== targetEntity.name ? ` (credited: ${credit})` : ""}`;
        const existing = dedupHit.existingLinkName;
        const staged = dedupHit.status === 1;
        const where = staged ? "already added this session" : "already in MB";
        if (dedupHit.kind === "equivalence") {
          log.info(`Deduplication (equivalence sets): <strong>${linkTypeName}</strong> not added \u2014 equivalent <strong>${existing}</strong> ${where} on ${pair}`);
        } else if (dedupHit.kind === "duplicate-role") {
          log.info(`Deduplication (duplicate roles): <strong>${linkTypeName}</strong> not added \u2014 same role ${where} with different attributes on ${pair}`);
        } else {
          log.info(`${staged ? "Already added this session" : "Already in MB"}: <strong>${linkTypeName}</strong>: ${pair}`);
        }
        if (staged) existedStaged++;
        else existedInMb++;
        return;
      }
      dispatchRelationship(re, sourceEntity, targetEntity, resolvedLinkTypeID, credit, attrTree, trackPos);
      added++;
    }
    async function dispatchCompanies() {
      for (const company of companies) {
        const details = ENTITY_TYPE_MAP[company.entity_type_name];
        if (!details) continue;
        const resolvedEt = resolvedEntityTypes.get(company.resource_url) || details.entityType;
        if (resolvedEt !== details.entityType) {
          if (details.entityType === "place" && resolvedEt === "label") {
            log.warn(`Skipped ${company.name}: MB has no "${details.linkType}" relationship for labels (only places). Add manually if needed.`);
            skipped++;
            tickProgress();
            continue;
          }
        }
        const mbUrl = confirmedMbUrl(company);
        if (!mbUrl) {
          log.skip(`Skipped ${company.name} \u2014 not resolved in review`);
          skipped++;
          tickProgress();
          continue;
        }
        const et = resolvedEt;
        const [t0, t1] = et <= "release" ? [et, "release"] : ["release", et];
        await processOne(releaseEntity, t0, t1, details.linkType, mbUrl, [], "");
        tickProgress();
      }
    }
    async function dispatchReleaseArtists() {
      for (const role of artistRoles) {
        if (applyToTracks && RECORDING_LINK_TYPES.has(role.linkType) && !isExecProducer(role)) continue;
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const mbUrl = confirmedMbUrl(role.artist);
        if (!mbUrl) {
          log.skip(`Skipped ${role.artist.name} (${role.linkType}) \u2014 not resolved in review`);
          skipped++;
          tickProgress();
          continue;
        }
        const credit = role.creditedAs || stripDiscogsNum2(role.artist.anv?.trim() || role.artist.name);
        await processOne(releaseEntity, "artist", "release", role.linkType, mbUrl, role.attributes || [], credit);
        tickProgress();
      }
    }
    async function dispatchTracklist() {
      if (applyToTracks && recordingByGid.size > 0) {
        const applicable = artistRoles.filter((role) => RECORDING_LINK_TYPES.has(role.linkType) && !WORK_ONLY_ARTIST_RELS.includes(role.linkType) && !isExecProducer(role));
        if (applicable.length > 0) {
          log.info(`Applying ${applicable.length} release credit(s) to ${recordingByGid.size} recording(s)\u2026`);
          for (const role of applicable) {
            const mbUrl = confirmedMbUrl(role.artist);
            if (!mbUrl) {
              log.skip(`Skipped ${role.artist.name} (${role.linkType}) in applyToTracks \u2014 not resolved in review`);
              continue;
            }
            const credit = role.creditedAs || stripDiscogsNum2(role.artist.anv?.trim() || role.artist.name);
            for (const recEntity of recordingByGid.values()) {
              if (!applyToRec(recEntity.gid)) continue;
              await processOne(recEntity, "artist", "recording", role.linkType, mbUrl, role.attributes || [], credit, positionByGid.get(recEntity.gid) || "*");
            }
          }
        }
      }
    }
    async function dispatchWorks() {
      if (createWorksMode === "off") {
        const workOnly = [...tracklistRels || [], ...artistRoles || []].filter((r) => WORK_ONLY_ARTIST_RELS.includes(r.linkType));
        if (workOnly.length) log.skip(`"Use works" is off \u2014 skipped ${workOnly.length} work-level credit(s) (${[...new Set(workOnly.map((r) => r.linkType))].join(", ")})`);
        return;
      }
      const recordingOfLinkTypeId = resolveLinkTypeId("performance", "recording", "work");
      const includeOnlyResolved = createWorksMode === "when-needed";
      const workOnlyByGid = /* @__PURE__ */ new Map();
      for (const role of tracklistRels) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        if (includeOnlyResolved && !confirmedMbUrl(role.artist)) continue;
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
          log.error(`Work-only rel for track ${role.track.position} "${role.track.title}" \u2014 no recording found, skipped`);
          failed++;
          continue;
        }
        if (!applyToRec(recEntity.gid)) continue;
        if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
        workOnlyByGid.get(recEntity.gid).push({ role, recEntity });
      }
      for (const role of artistRoles) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        if (includeOnlyResolved && !confirmedMbUrl(role.artist)) continue;
        for (const recEntity of recordingByGid.values()) {
          if (!applyToRec(recEntity.gid)) continue;
          const syntheticRole = { ...role, track: { position: "", title: recEntity.name || "" } };
          if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
          workOnlyByGid.get(recEntity.gid).push({ role: syntheticRole, recEntity });
        }
      }
      if (createWorksMode === "when-missing" && recordingOfLinkTypeId) {
        for (const recEntity of recordingByGid.values()) {
          if (!applyToRec(recEntity.gid)) continue;
          if (!workOnlyByGid.has(recEntity.gid)) {
            workOnlyByGid.set(recEntity.gid, []);
          }
        }
      }
      if (workOnlyByGid.size === 0) return;
      if (!recordingOfLinkTypeId) {
        log.error('Could not resolve "performance" link type \u2014 work processing skipped');
        return;
      }
      log.info(`Processing work relationships for ${workOnlyByGid.size} recording(s)\u2026`);
      const existingWorkByRecGid = editorWorkByRecGid;
      log.info(`Editor state: ${existingWorkByRecGid.size} recording(s) already have a linked work`);
      function getWorkFromEditorState(recEntity) {
        try {
          for (const rel of MB2.tree.iterate(recEntity.relationships)) {
            if (rel._status === 1 && rel.linkTypeID === recordingOfLinkTypeId) {
              return rel.entity0?.entityType === "work" ? rel.entity0 : rel.entity1;
            }
          }
        } catch (e) {
        }
        return null;
      }
      const createdWorkRecGids = /* @__PURE__ */ new Set();
      for (const [recGid, entries] of workOnlyByGid) {
        const recEntity = entries[0]?.recEntity ?? recordingByGid.get(recGid);
        const trackTitle = entries[0]?.role.track.title || recEntity?.name || recGid;
        const trackPos = entries[0]?.role.track.position ?? "";
        if (!recEntity) continue;
        const hasExistingWork = editorWorkByRecGid.has(recGid);
        let workEntity = null;
        if (hasExistingWork) {
          workEntity = editorWorkByRecGid.get(recGid);
          const wid = workEntity.gid || workEntity.id;
          log.info(`Track ${trackPos} "${trackTitle}": work already linked (${workEntity.name || wid || "existing"}) \u2014 skipping creation`);
          if (!workEntity.gid && !workEntity.id) continue;
        }
        if (!workEntity) workEntity = getWorkFromEditorState(recEntity);
        if (!workEntity && createWorksMode === "never") {
          for (const { role } of entries) {
            log.error(`Track ${trackPos} "${trackTitle}": no work exists for ${role.linkType} (${role.artist.name}) \u2014 "Create works" is set to "never". Add the work manually or change the mode.`);
            failed++;
          }
          continue;
        }
        if (!workEntity) {
          if (createdWorkRecGids.has(recGid)) {
            log.error(`Track ${trackPos} "${trackTitle}": a work was already created for this recording in this run \u2014 skipping to avoid a duplicate work`);
            failed++;
            continue;
          }
          const newWorkId = re.getRelationshipStateId();
          workEntity = {
            _fromBatchCreateWorksDialog: true,
            attributes: [],
            comment: "",
            editsPending: false,
            entityType: "work",
            gid: null,
            id: newWorkId,
            iswcs: [],
            languages: [],
            name: trackTitle,
            typeID: null
          };
          if (MB2.mergeLinkedEntities) {
            MB2.mergeLinkedEntities({ work: { [newWorkId]: workEntity } });
          }
          re.dispatch({
            type: "update-relationship-state",
            sourceEntity: recEntity,
            batchSelectionCount: null,
            creditsToChangeForSource: "",
            creditsToChangeForTarget: "",
            oldRelationshipState: null,
            newRelationshipState: {
              _lineage: ["batch-created work"],
              _original: null,
              _status: 1,
              attributes: null,
              begin_date: null,
              editsPending: false,
              end_date: null,
              ended: false,
              entity0: recEntity,
              entity0_credit: "",
              entity1: workEntity,
              entity1_credit: "",
              id: re.getRelationshipStateId(),
              linkOrder: 0,
              linkTypeID: recordingOfLinkTypeId
            }
          });
          createdWorkRecGids.add(recGid);
          log.info(`Track ${trackPos} "${trackTitle}": created new work "${trackTitle}"`);
          added++;
          tickProgress();
          workEntity = getWorkFromEditorState(recEntity) || workEntity;
        }
        for (const { role } of entries) {
          const mbUrl = confirmedMbUrl(role.artist);
          if (!mbUrl) {
            log.skip(`Skipped ${role.artist.name} \u2014 not resolved in review (${role.linkType})`);
            continue;
          }
          const credit = role.creditedAs || stripDiscogsNum2(role.artist.anv?.trim() || role.artist.name);
          const srcType = role.entityType || "artist";
          const urlType = (mbUrl.match(/musicbrainz\.org\/(artist|label|place)\//i) || [])[1];
          if (urlType && urlType !== srcType) {
            log.skip(`Skipped ${role.linkType} for "${credit}" \u2014 resolved to an MB ${urlType}, but this relationship needs a ${srcType} (#417)`);
            continue;
          }
          if (workEntity.gid) {
            await processOne(workEntity, srcType, "work", role.linkType, mbUrl, role.attributes || [], credit, trackPos || entries[0]?.role?.track?.position);
          } else {
            const linkTypeID = resolveLinkTypeId(role.linkType, srcType, "work");
            if (linkTypeID) {
              const mbid = mbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
              try {
                const artistEntity = await fetchMBEntity(mbid);
                const ov = String(creditOverrides.get(mbUrl) || "").trim();
                dispatchRelationship(re, workEntity, artistEntity, linkTypeID, ov || credit, buildAttributes(role.attributes || [], linkTypeID));
                added++;
              } catch (e) {
                log.error(`Failed to add ${role.linkType} for new work: ${e.message}`);
              }
            }
          }
        }
      }
    }
    async function dispatchTracklistArtists() {
      const seenTrackRels = /* @__PURE__ */ new Set();
      for (const trackRole of tracklistRels) {
        const role = trackRole.onRecording ? Object.assign({}, trackRole, trackRole.onRecording) : trackRole;
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const mbUrl = confirmedMbUrl(role.artist);
        if (!mbUrl) {
          log.skip(`Skipped ${role.artist.name} on track ${role.track.position} \u2014 not resolved in review`);
          continue;
        }
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
          log.warn(`No recording found for track ${role.track.position} "${role.track.title}" \u2014 skipped`);
          failed++;
          continue;
        }
        if (!applyToRec(recEntity.gid)) continue;
        const credit = role.creditedAs || stripDiscogsNum2(role.artist.anv?.trim() || role.artist.name);
        const attrKey = (role.attributes || []).map((a) => typeof a === "string" ? a : a.value || a._type || "").join(",");
        const trackRelKey = `${role.track.position}|${role.linkType}|${mbUrl}|${attrKey}`;
        if (seenTrackRels.has(trackRelKey)) continue;
        seenTrackRels.add(trackRelKey);
        log.info(`Track ${role.track.position} "${role.track.title}": adding <strong>${role.linkType}</strong> \u2014 ${credit}`);
        await processOne(recEntity, "artist", "recording", role.linkType, mbUrl, role.attributes || [], credit, role.track.position);
        tickProgress();
      }
    }
    await dispatchCompanies();
    await dispatchReleaseArtists();
    await dispatchTracklist();
    await dispatchWorks();
    await dispatchTracklistArtists();
    try {
      const opts = [
        processTracklist !== void 0 ? `per-track:${processTracklist ? "on" : "off"}` : null,
        applyToTracks !== void 0 ? `move-to-tracks:${applyToTracks ? "on" : "off"}` : null,
        createWorksMode !== void 0 ? `create-works:${createWorksMode}` : null
      ].filter(Boolean).join(", ");
      const trackCount2 = Array.isArray(discogsTracklist) ? discogsTracklist.length : 0;
      const inputStats = `Input: ${companies?.length || 0} companies, ${artistRoles?.length || 0} release credits, ${tracklistRels?.length || 0} tracklist credits on ${trackCount2} track${trackCount2 === 1 ? "" : "s"}`;
      const unresolvedCount = confirmedMap?.unresolvedCount || 0;
      const totalEntities = confirmedMap?.totalEntities || 0;
      const unresolvedLine = unresolvedCount > 0 ? `Unresolved: ${unresolvedCount} of ${totalEntities} entit${totalEntities === 1 ? "y" : "ies"} skipped in review` : null;
      const mc = confirmedMap?.matchCounts;
      const matchedParts = mc ? [...MATCH_LEVELS.map((lv, i) => mc.levels[i] ? `${mc.levels[i]} ${lv.label.toLowerCase()}` : null), mc.user ? `${mc.user} user` : null].filter(Boolean) : [];
      const matchedLine = matchedParts.length ? `Matched: ${matchedParts.join(", ")} (cutoff: ${mc.cutoff.toLowerCase()})` : null;
      const editNoteDedupPart = dedupedThisSession > 0 ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? "" : "s"}` : "";
      const editNoteStagedPart = existedStaged > 0 ? `, ${existedStaged} already added this session` : "";
      const resultStats = `Result: ${added} added, ${existedInMb} already in MB${editNoteStagedPart}${editNoteDedupPart}, ${skipped} skipped, ${failed} failed${recSelectionActive ? ` (applied to ${checkedRecGids.size} of ${recordingByGid.size} selected recordings)` : ""}`;
      const ourNote = buildEditNote(discogsUrl, opts, [inputStats, matchedLine, unresolvedLine, resultStats].filter(Boolean), dedupOpts.sourceLabel);
      const existingNote = document.querySelector(SELECTORS.EditNote)?.value || "";
      const note = combineEditNote(existingNote, ourNote);
      re.dispatch({ type: "update-edit-note", editNote: note });
    } catch (e) {
    }
    const dedupPart = dedupedThisSession > 0 ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? "" : "s"}` : "";
    const stagedPart = existedStaged > 0 ? `, ${existedStaged} already added this session` : "";
    const selNote = recSelectionActive ? ` \u2014 applied to ${checkedRecGids.size} of ${recordingByGid.size} selected recording(s)` : "";
    log.info(`<strong>Done: ${added} added, ${existedInMb} already in MB${stagedPart}${dedupPart}, ${skipped} skipped, ${failed} failed${selNote}</strong>`);
  }

  // src/sources/apple.js
  var APPLE_AMP = "https://amp-api.music.apple.com/v1/catalog";
  var APPLE_ALBUM_RE = /(?:music|itunes)\.apple\.com\/(?:([a-z]{2})\/)?album\/(?:[^/?#]+\/)?(?:id)?(\d+)/i;
  function parseAppleAlbumUrl(url) {
    const m = APPLE_ALBUM_RE.exec(url || "");
    return m ? { storefront: (m[1] || "us").toLowerCase(), id: m[2] } : null;
  }
  var APPLE_ROLE_BRIDGE = {
    "Songwriter": "Written-By",
    "Writer": "Written-By",
    "Composer": "Composed By",
    "Lyricist": "Lyrics By",
    "Producer": "Producer",
    "Mixing Engineer": "Mixed By",
    "Mixer": "Mixed By",
    "Recording Engineer": "Recording Engineer",
    "Engineer": "Engineer",
    "Arranger": "Arranged By",
    "Vocalist": "Vocals",
    "Vocal": "Vocals",
    "Background Vocals": "Backing Vocals",
    "Background Vocal": "Backing Vocals"
  };
  var APPLE_SKIP = /* @__PURE__ */ new Set(["Performer", "Mastering Engineer", "Studio Personnel"]);
  function appleToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const tracks = parsedTracks || [];
    const { positions, multiVolume } = assignVolumePositions(tracks, (t) => t.index);
    tracks.forEach((t, i) => {
      const track = { position: positions[i], title: t.title || "", type_: "track" };
      tracklist.push(track);
      for (const c of t.credits || []) {
        const role = String(c.role || "").trim();
        const name = String(c.name || "").trim();
        if (!role || !name) continue;
        if (APPLE_SKIP.has(role)) {
          skipped.push(`track ${track.position}: ${role} \u2014 ${name}`);
          continue;
        }
        const discogsRole = APPLE_ROLE_BRIDGE[role] || role;
        const rels = getArtistRoles({ name, anv: "", role: discogsRole, resource_url: "" });
        if (!rels || !rels.length) {
          skipped.push(`track ${track.position}: ${role} \u2014 ${name} (unmapped)`);
          continue;
        }
        for (const rel of rels) tracklistRels.push({ ...rel, artist: rel.artist || { name, anv: "", resource_url: "" }, track });
      }
    });
    return { tracklistRels, tracklist, skipped, multiVolume };
  }
  function appleGet(url, headers) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: headers || {},
        timeout: 2e4,
        onload: (r) => resolve({ status: r.status, text: r.responseText || "" }),
        onerror: () => reject(new Error("Apple request failed (network)")),
        ontimeout: () => reject(new Error("Apple request timed out"))
      });
    });
  }
  var _appleToken = null;
  var APPLE_TOKEN_LS = "ch:apple-token";
  async function appleToken() {
    if (_appleToken) return _appleToken;
    try {
      const raw = JSON.parse(localStorage.getItem(APPLE_TOKEN_LS) || "null");
      if (raw && raw.t && raw.at && Date.now() - raw.at < 12 * 36e5) {
        _appleToken = raw.t;
        return _appleToken;
      }
    } catch (e) {
    }
    const home = await appleGet("https://music.apple.com/us/browse", { "Accept": "text/html" });
    const asset = (home.text.match(/\/assets\/index-legacy~[a-z0-9]+\.js/i) || home.text.match(/\/assets\/index~[a-z0-9]+\.js/i) || [])[0];
    if (!asset) throw new Error("Apple: could not locate the web-player JS asset");
    const js = await appleGet("https://music.apple.com" + asset, {});
    const tok = (js.text.match(/eyJ[A-Za-z0-9._\-]{80,}/) || [])[0];
    if (!tok) throw new Error("Apple: no bearer token in the web-player JS");
    _appleToken = tok;
    try {
      localStorage.setItem(APPLE_TOKEN_LS, JSON.stringify({ t: tok, at: Date.now() }));
    } catch (e) {
    }
    return tok;
  }
  function ampHeaders(tok) {
    return { Authorization: "Bearer " + tok, Origin: "https://music.apple.com", Accept: "application/json" };
  }
  async function fetchAppleCredits(storefront, albumId, onProgress) {
    const sf = storefront || "us";
    const tok = await appleToken();
    const albRes = await appleGet(`${APPLE_AMP}/${sf}/albums/${encodeURIComponent(albumId)}?l=en-US`, ampHeaders(tok));
    if (albRes.status !== 200) throw new Error(`Apple album ${albumId} \u2192 HTTP ${albRes.status}`);
    let albJson;
    try {
      albJson = JSON.parse(albRes.text);
    } catch (e) {
      throw new Error("Apple: malformed album JSON");
    }
    const album = albJson.data && albJson.data[0];
    const albumName = album && album.attributes && album.attributes.name || "";
    let songs = album && album.relationships && album.relationships.tracks && album.relationships.tracks.data || [];
    let next = album && album.relationships && album.relationships.tracks && album.relationships.tracks.next;
    while (next) {
      const pg = await appleGet("https://amp-api.music.apple.com" + next + (next.includes("?") ? "&" : "?") + "l=en-US", ampHeaders(tok));
      let pj;
      try {
        pj = JSON.parse(pg.text);
      } catch (e) {
        break;
      }
      songs = songs.concat(pj.data || []);
      next = pj.next;
    }
    const tracks = [];
    let done = 0;
    for (const s of songs) {
      const sid = s.id;
      const num = s.attributes && s.attributes.trackNumber || done + 1;
      const title = s.attributes && s.attributes.name || "";
      const credits = [];
      try {
        const cr = await appleGet(`${APPLE_AMP}/${sf}/songs/${encodeURIComponent(sid)}/credits?l=en-US`, ampHeaders(tok));
        if (cr.status === 200) {
          let cj;
          try {
            cj = JSON.parse(cr.text);
          } catch (e) {
            cj = null;
          }
          for (const grp of cj && cj.data || []) {
            const arts = grp.relationships && grp.relationships["credit-artists"] && grp.relationships["credit-artists"].data || [];
            for (const a of arts) {
              const name = a.attributes && a.attributes.name;
              for (const role of a.attributes && a.attributes.roleNames || []) {
                if (name && role) credits.push({ name, role });
              }
            }
          }
        }
      } catch (e) {
      }
      if (credits.length) tracks.push({ index: +num, title, credits });
      done++;
      if (onProgress) {
        try {
          onProgress(done, songs.length);
        } catch (e) {
        }
      }
    }
    return { album: albumName, tracks };
  }

  // src/sources/ytmusic.js
  var YTM_API = "https://music.youtube.com/youtubei/v1/";
  var YTM_CLIENT = { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en", gl: "US" };
  var YTM_ALBUM_RE = /(?:^|\/\/)(?:(?:music|www|m)\.)?youtube\.com\/(?:playlist\?(?:[^#]*&)?list=(OLAK5uy_[\w-]+)|browse\/(MPREb_[\w-]+))/i;
  function parseYtmAlbumUrl(url) {
    const m = YTM_ALBUM_RE.exec(url || "");
    return m ? m[1] ? { list: m[1] } : { album: m[2] } : null;
  }
  var YTM_ROLE_BRIDGE = {
    "Written by": "Written-By",
    "Produced by": "Producer"
  };
  var YTM_SKIP = {
    "Performed by": "the track artist credit",
    "Music metadata provided by": "the label or distributor"
  };
  function ytmPositions(count, mediumSizes) {
    const sizes = (mediumSizes || []).filter((n) => n > 0);
    const plain = Array.from({ length: count }, (_, i) => String(i + 1));
    if (sizes.length <= 1) return { positions: plain, multiMedium: false, mismatch: false };
    const total = sizes.reduce((a, b) => a + b, 0);
    if (total !== count) return { positions: plain, multiMedium: true, mismatch: true };
    const positions = [];
    sizes.forEach((n, m) => {
      for (let t = 1; t <= n; t++) positions.push(`${m + 1}-${t}`);
    });
    return { positions, multiMedium: true, mismatch: false };
  }
  function ytmToEngine(songs, mediumSizes) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const list = songs || [];
    const { positions, multiMedium, mismatch } = ytmPositions(list.length, mediumSizes);
    list.forEach((s, i) => {
      const track = { position: positions[i], title: s.title || "", type_: "track" };
      tracklist.push(track);
      for (const [section, names] of Object.entries(s.sections || {})) {
        const named = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
        if (!named.length) continue;
        if (YTM_SKIP[section]) {
          skipped.push(`track ${track.position}: ${section} \u2014 ${named.join(", ")} (${YTM_SKIP[section]})`);
          continue;
        }
        const role = YTM_ROLE_BRIDGE[section];
        if (!role) {
          skipped.push(`track ${track.position}: ${section} \u2014 ${named.join(", ")} (unmapped section)`);
          continue;
        }
        for (const name of named) {
          const rels = getArtistRoles({ name, anv: "", role, resource_url: "" });
          if (!rels || !rels.length) {
            skipped.push(`track ${track.position}: ${section} \u2014 ${name} (unmapped)`);
            continue;
          }
          for (const rel of rels) tracklistRels.push({ ...rel, artist: rel.artist || { name, anv: "", resource_url: "" }, track });
        }
      }
    });
    return { tracklistRels, tracklist, skipped, multiMedium, mismatch };
  }
  function ytmPost(endpoint, body) {
    const what = body.browseId || endpoint;
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      const t0 = Date.now();
      GM_xmlhttpRequest({
        method: "POST",
        url: `${YTM_API}${endpoint}?prettyPrint=false`,
        anonymous: true,
        timeout: 2e4,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ context: { client: YTM_CLIENT }, ...body }),
        onload: (r) => {
          const text = r.responseText || "";
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {
          }
          logDebug(`YouTube Music: ${endpoint} ${what} \u2192 HTTP ${r.status}, ${text.length}b in ${Date.now() - t0}ms`);
          if (r.status !== 200 || !json) {
            reject(new Error(`YouTube Music ${endpoint} ${what} \u2192 HTTP ${r.status}${r.status === 200 ? ", not JSON" : ""} \u2014 YouTube Music's API may have changed`));
            return;
          }
          resolve(json);
        },
        onerror: () => reject(new Error(`YouTube Music ${endpoint} ${what}: network error`)),
        ontimeout: () => reject(new Error(`YouTube Music ${endpoint} ${what}: timed out`))
      });
    });
  }
  var ytmText = (t) => t && t.runs ? t.runs.map((x) => x.text).join("") : t && t.simpleText || "";
  function ytmWalk(o, fn) {
    if (!o || typeof o !== "object") return;
    fn(o);
    for (const k in o) ytmWalk(o[k], fn);
  }
  var videoType = (w) => w && w.watchEndpointMusicSupportedConfigs && w.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig && w.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType;
  function ytmRows(json) {
    const rows = [];
    ytmWalk(json, (o) => {
      const r = o.musicResponsiveListItemRenderer;
      if (!r) return;
      let w = null;
      ytmWalk(r, (x) => {
        if (!w && x.watchEndpoint && x.watchEndpoint.videoId) w = x.watchEndpoint;
      });
      const id = r.playlistItemData && r.playlistItemData.videoId || w && w.videoId;
      if (!id) return;
      const col = r.flexColumns && r.flexColumns[0] && r.flexColumns[0].musicResponsiveListItemFlexColumnRenderer;
      rows.push({ title: ytmText(col && col.text), videoId: id, type: videoType(w) || null });
    });
    return rows;
  }
  function ytmCreditSections(json) {
    const out = {};
    ytmWalk(json, (o) => {
      const s = o.dismissableDialogContentSectionRenderer;
      if (s) out[ytmText(s.title)] = (s.subtitle && s.subtitle.runs || []).map((r) => r.text.trim()).filter(Boolean);
    });
    return out;
  }
  async function fetchYtmCredits(url, onProgress) {
    const parsed = parseYtmAlbumUrl(url);
    if (!parsed) throw new Error(`Not a YouTube Music album link: ${url}`);
    let list = parsed.list, album = "";
    if (!list) {
      const a = await ytmPost("browse", { browseId: parsed.album });
      const canon = a.microformat && a.microformat.microformatDataRenderer && a.microformat.microformatDataRenderer.urlCanonical || "";
      list = (canon.match(/[?&]list=(OLAK5uy_[\w-]+)/) || JSON.stringify(a).match(/"(OLAK5uy_[\w-]+)"/) || [])[1];
      let h = null;
      ytmWalk(a, (o) => {
        if (!h && o.musicResponsiveHeaderRenderer) h = o.musicResponsiveHeaderRenderer;
      });
      album = h ? ytmText(h.title) : "";
      log.info(`YouTube Music: album ${parsed.album} "${album}" \u2192 playlist ${list || "(none found)"}`);
      if (!list) throw new Error(`YouTube Music: album ${parsed.album} names no playlist \u2014 its page may have changed`);
    }
    const pl = await ytmPost("browse", { browseId: "VL" + list });
    if (!album) {
      let h = null;
      ytmWalk(pl, (o) => {
        if (!h && (o.musicResponsiveHeaderRenderer || o.musicDetailHeaderRenderer)) h = o.musicResponsiveHeaderRenderer || o.musicDetailHeaderRenderer;
      });
      album = h ? ytmText(h.title) : "";
    }
    if (/"continuations?"|"continuationItemRenderer"/.test(JSON.stringify(pl))) log.warn(`YouTube Music: playlist ${list} has more songs than its first page \u2014 only those are read`);
    const rows = ytmRows(pl);
    const types = rows.reduce((m, r) => {
      const k = (r.type || "?").replace("MUSIC_VIDEO_TYPE_", "");
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});
    log.info(`YouTube Music: playlist ${list} "${album}" \u2014 ${rows.length} row(s) (${Object.entries(types).map(([k, n]) => `${n} ${k}`).join(", ") || "none"})`);
    const songs = [];
    let done = 0;
    for (const r of rows) {
      let sections = {};
      if (r.type && r.type !== "MUSIC_VIDEO_TYPE_ATV") logDebug(`YouTube Music: row ${done + 1} "${r.title}" is a ${r.type}, not a song \u2014 it has no credits`);
      else {
        try {
          sections = ytmCreditSections(await ytmPost("browse", { browseId: "MPTC" + r.videoId }));
        } catch (e) {
          log.warn(`YouTube Music: credits of "${r.title}" (${r.videoId}) failed \u2014 ${e.message}`);
        }
      }
      logDebug(`YouTube Music: ${done + 1}. "${r.title}" (${r.videoId}) \u2014 ${Object.keys(sections).map((k) => `${k}: ${sections[k].join(", ")}`).join(" \xB7 ") || "no credits"}`);
      songs.push({ title: r.title, videoId: r.videoId, sections });
      done++;
      if (onProgress) {
        try {
          onProgress(done, rows.length);
        } catch (e) {
        }
      }
    }
    return { album, list, songs };
  }

  // src/sources/deezer.js
  function decodeEntities2(s) {
    return String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#039;/g, "'").replace(/&apos;/g, "'");
  }
  var DEEZER_LABEL_MAP = {
    "Composers": { rel: "composer" },
    "Composer": { rel: "composer" },
    "Authors": { rel: "lyricist" },
    "Author": { rel: "lyricist" },
    "Writers": { rel: "writer" },
    "Writer": { rel: "writer" },
    "Producers": { rel: "producer" },
    "Producer": { rel: "producer" }
  };
  var DEEZER_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/i;
  function parseDeezerAlbumUrl(url) {
    const m = DEEZER_ALBUM_RE.exec(url || "");
    return m ? { id: m[1], pageUrl: `https://www.deezer.com/us/album/${m[1]}` } : null;
  }
  var DEEZER_NO_INFO_RE = /^\s*no\s*info\s*$/i;
  function parseDeezerCreditLine(line) {
    const text = decodeEntities2(String(line)).trim();
    const byName = /* @__PURE__ */ new Map();
    for (const group of text.split(" / ")) {
      const m = /^([^:]+):\s*(.*)$/.exec(group.trim());
      if (!m) continue;
      const plan = DEEZER_LABEL_MAP[m[1].trim()];
      if (!plan) continue;
      for (const raw of m[2].split(/\s*,\s*|\s+-\s+/)) {
        const name = raw.trim();
        if (!name || DEEZER_NO_INFO_RE.test(name)) continue;
        if (!byName.has(name)) byName.set(name, []);
        const roles = byName.get(name);
        if (!roles.includes(plan.rel)) roles.push(plan.rel);
      }
    }
    return [...byName].map(([name, roles]) => ({ name, roles }));
  }
  function extractDeezerCredits(html) {
    const posByTrack = /* @__PURE__ */ new Map();
    const posRe = /itemid="\/[a-z]{2}\/track\/(\d+)"[\s\S]{0,600}?data-target="position">\s*(\d+)/gi;
    let pm;
    while ((pm = posRe.exec(html)) !== null) {
      const id = pm[1];
      if (!posByTrack.has(id)) posByTrack.set(id, parseInt(pm[2], 10));
    }
    const out = [];
    const credRe = /naboo_datagrid_contributors_(\d+)"[\s\S]{0,400}?data-target="contributors">([^<]*)</gi;
    let cm;
    while ((cm = credRe.exec(html)) !== null) {
      const id = cm[1];
      const pos = posByTrack.get(id);
      if (!pos) continue;
      const credits = parseDeezerCreditLine(cm[2]);
      if (credits.length) out.push({ index: pos, credits });
    }
    return out;
  }
  function extractDeezerAlbumInfo(html) {
    const og = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || "";
    return decodeEntities2(og);
  }
  function deezerToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, (t) => t.index);
    parsedTracks.forEach((t, i) => {
      const track = { position: positions[i], title: "", type_: "track" };
      tracklist.push(track);
      for (const credit of t.credits) {
        for (const rel of credit.roles) {
          tracklistRels.push({
            linkType: rel,
            entityType: "artist",
            attributes: [],
            artist: { name: credit.name, anv: "", resource_url: "" },
            track
          });
        }
      }
    });
    return { tracklistRels, tracklist, skipped, multiVolume };
  }
  function fetchDeezerAlbumPage(pageUrl) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: pageUrl,
        headers: { "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8" },
        timeout: 2e4,
        onload: (r) => r.status >= 200 && r.status < 400 && r.responseText ? resolve(r.responseText) : reject(new Error(`Deezer page returned ${r.status}`)),
        onerror: () => reject(new Error("Deezer page fetch failed (network)")),
        ontimeout: () => reject(new Error("Deezer page fetch timed out"))
      });
    });
  }

  // src/sources/mora.js
  var MORA_PACKAGE_RE = /^(?:https?:)?\/\/(?:www\.)?mora\.jp\/package\/(\d+)\/([\w-]+)\/?(?:[?#]|$)/i;
  function parseMoraPackageUrl(url) {
    const m = MORA_PACKAGE_RE.exec(url || "");
    return m ? { id: `${m[1]}/${m[2]}`, pageUrl: `https://mora.jp/package/${m[1]}/${m[2]}/` } : null;
  }
  function moraMetaUrl(html) {
    const raw = /<meta[^>]*name="msApplication-Arguments"[^>]*content="([^"]+)"/i.exec(html || "")?.[1];
    if (!raw) return null;
    let a;
    try {
      a = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    } catch (e) {
      return null;
    }
    if (!a || !a.materialNo || !a.labelId || !a.mountPoint) return null;
    const p = String(a.materialNo).padStart(10, "0");
    return `https://cf.mora.jp/contents/package/${a.mountPoint}/${a.labelId}/${p.slice(0, 4)}/${p.slice(4, 7)}/${p.slice(7)}/packageMeta.json`;
  }
  var MORA_FIELDS = [["composer", "composer"], ["lyrics", "lyricist"], ["arranger", "arranger"], ["producer", "producer"]];
  function splitMoraNames(s) {
    return String(s || "").split(/\s*(?:、|，|／|\/|,\s)\s*/).map((x) => x.trim()).filter((x) => x && x !== "-");
  }
  function extractMoraCredits(json) {
    return (json && json.trackList || []).map((t, i) => {
      const byName = /* @__PURE__ */ new Map();
      for (const [field, rel] of MORA_FIELDS) {
        for (const name of splitMoraNames(t[field])) {
          if (!byName.has(name)) byName.set(name, []);
          const roles = byName.get(name);
          if (!roles.includes(rel)) roles.push(rel);
        }
      }
      return { index: t.trackNo || i + 1, credits: [...byName].map(([name, roles]) => ({ name, roles })) };
    });
  }
  function moraAlbumInfo(json) {
    return json ? [json.title, json.artistName].filter(Boolean).join(", ") : "";
  }
  function moraToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, (t) => t.index);
    parsedTracks.forEach((t, i) => {
      const track = { position: positions[i], title: "", type_: "track" };
      tracklist.push(track);
      for (const credit of t.credits) {
        for (const rel of credit.roles) {
          tracklistRels.push({ linkType: rel, entityType: "artist", attributes: [], artist: { name: credit.name, anv: "", resource_url: "" }, track });
        }
      }
    });
    return { tracklistRels, tracklist, skipped: [], multiVolume };
  }
  function gmGet(url, what) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 2e4,
        onload: (r) => r.status >= 200 && r.status < 400 && r.responseText ? resolve(r.responseText) : reject(new Error(`mora ${what} returned ${r.status}`)),
        onerror: () => reject(new Error(`mora ${what} fetch failed (network)`)),
        ontimeout: () => reject(new Error(`mora ${what} fetch timed out`))
      });
    });
  }
  async function fetchMoraPackage(pageUrl) {
    const metaUrl = moraMetaUrl(await gmGet(pageUrl, "page"));
    if (!metaUrl) throw new Error("mora page has no package arguments (msApplication-Arguments)");
    const text = await gmGet(metaUrl, "packageMeta.json");
    try {
      return { metaUrl, json: JSON.parse(text) };
    } catch (e) {
      throw new Error("mora packageMeta.json: malformed JSON");
    }
  }

  // src/sources/melon.js
  var MELON_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|m2\.|m\.app\.)?melon\.com\/album\/detail\.htm\?(?:[^#]*&)?albumId=(\d+)/i;
  function parseMelonAlbumUrl(url) {
    const m = MELON_ALBUM_RE.exec(url || "");
    return m ? { id: m[1], pageUrl: `https://www.melon.com/album/detail.htm?albumId=${m[1]}` } : null;
  }
  var MELON_ROLES = { "\uC791\uC0AC": "lyricist", "\uC791\uACE1": "composer", "\uD3B8\uACE1": "arranger" };
  var unescape = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  function extractMelonSongCredits(html) {
    const list = /<ul class="list_person[^"]*">([\s\S]*?)<\/ul>/i.exec(html || "")?.[1] || "";
    const byName = /* @__PURE__ */ new Map();
    for (const li of list.split(/<li[\s>]/i).slice(1)) {
      const name = unescape((/class="artist_name"[^>]*>([\s\S]*?)<\/a>/i.exec(li) || /<div class="ellipsis artist">([\s\S]*?)<\/div>/i.exec(li) || [])[1]);
      const type = unescape(/<span class="type">([\s\S]*?)<\/span>/i.exec(li)?.[1]);
      if (!name || !type) continue;
      if (!byName.has(name)) byName.set(name, []);
      const roles = byName.get(name);
      for (const word of type.split(/\s*[,/]\s*/)) {
        const rel = MELON_ROLES[word];
        if (rel && !roles.includes(rel)) roles.push(rel);
      }
    }
    return [...byName].filter(([, roles]) => roles.length).map(([name, roles]) => ({ name, roles }));
  }
  function melonSongs(json) {
    const out = [];
    for (const cd of json && json.response && json.response.CDLIST || []) {
      (cd.SONGLIST || []).forEach((s, i) => out.push({ songId: String(s.SONGID), title: s.SONGNAME || "", disc: +cd.CDNO || 1, index: +s.TRACKNO || i + 1 }));
    }
    return out;
  }
  function melonToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, (t) => t.index);
    parsedTracks.forEach((t, i) => {
      const track = { position: positions[i], title: "", type_: "track" };
      tracklist.push(track);
      for (const credit of t.credits) {
        for (const rel of credit.roles) {
          tracklistRels.push({ linkType: rel, entityType: "artist", attributes: [], artist: { name: credit.name, anv: "", resource_url: "" }, track });
        }
      }
    });
    return { tracklistRels, tracklist, skipped: [], multiVolume };
  }
  function gmGet2(url, what) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 2e4,
        onload: (r) => r.status >= 200 && r.status < 400 && r.responseText ? resolve(r.responseText) : reject(new Error(`Melon ${what} returned ${r.status}`)),
        onerror: () => reject(new Error(`Melon ${what} fetch failed (network)`)),
        ontimeout: () => reject(new Error(`Melon ${what} fetch timed out`))
      });
    });
  }
  async function fetchMelonCredits(id, onProgress) {
    let json;
    try {
      json = JSON.parse(await gmGet2(`https://m2.melon.com/m6/v2/album/song/list.json?albumId=${id}`, "song list"));
    } catch (e) {
      throw e instanceof SyntaxError ? new Error("Melon song list: malformed JSON") : e;
    }
    const songs = melonSongs(json);
    const tracks = songs.map((s) => ({ index: s.index, disc: s.disc, title: s.title, songId: s.songId, credits: [] }));
    let next = 0, done = 0;
    const worker = async () => {
      while (next < tracks.length) {
        const t = tracks[next++];
        try {
          t.credits = extractMelonSongCredits(await gmGet2(`https://www.melon.com/song/detail.htm?songId=${t.songId}`, `song ${t.songId}`));
        } catch (e) {
          t.error = e.message || String(e);
        }
        onProgress && onProgress(++done, tracks.length);
      }
    };
    await Promise.all([0, 1, 2, 3].map(worker));
    return { album: json.response && json.response.ALBUMNAME || "", tracks };
  }

  // src/consolidate.js
  var fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  var entityKeyOf = (a) => a && a.resource_url ? a.resource_url : `_nourl_${a && (a.name || a.id) || ""}`;
  var attrsSig = (rel) => JSON.stringify(
    (rel.attributes || []).map((x) => x && typeof x === "object" && x._type ? `${x._type}:${x.value}` : String(x)).sort()
  );
  var relKeyOf = (rel) => [
    entityKeyOf(rel.artist),
    rel.linkType || "",
    attrsSig(rel),
    rel.track ? String(rel.track.position != null ? rel.track.position : "") : ""
  ].join("\x01");
  function mergeHarvests(harvests) {
    const mkDedup = () => {
      const seen = /* @__PURE__ */ new Map(), order = [];
      return {
        add(rel, source) {
          const k = relKeyOf(rel);
          if (!seen.has(k)) {
            seen.set(k, { rel, sources: /* @__PURE__ */ new Set() });
            order.push(k);
          }
          seen.get(k).sources.add(source);
        },
        drain(relSrc2, entitySrc2) {
          const arr = [];
          for (const k of order) {
            const e = seen.get(k);
            arr.push(e.rel);
            relSrc2.set(k, [...e.sources]);
            const ek = entityKeyOf(e.rel.artist);
            if (!entitySrc2.has(ek)) entitySrc2.set(ek, /* @__PURE__ */ new Set());
            e.sources.forEach((s) => entitySrc2.get(ek).add(s));
          }
          return arr;
        }
      };
    };
    const relSrc = /* @__PURE__ */ new Map(), entitySrc = /* @__PURE__ */ new Map();
    const arD = mkDedup(), trD = mkDedup();
    const companies = [], seenCo = /* @__PURE__ */ new Set();
    const tracklist = [], seenPos = /* @__PURE__ */ new Set();
    let processTracklist = false;
    for (const h of harvests || []) {
      if (!h) continue;
      const src = h.sourceName || "Source";
      if (h.processTracklist) processTracklist = true;
      (h.artistRoles || []).forEach((r) => arD.add(r, src));
      (h.tracklistRels || []).forEach((r) => trD.add(r, src));
      (h.companies || []).forEach((c) => {
        const ck = c.resource_url || `co:${fold(c.entity_type_name)}|${fold(c.name)}`;
        if (ck && !seenCo.has(ck)) {
          seenCo.add(ck);
          companies.push(c);
        }
        const ek = entityKeyOf(c);
        if (!entitySrc.has(ek)) entitySrc.set(ek, /* @__PURE__ */ new Set());
        entitySrc.get(ek).add(src);
      });
      (h.tracklist || []).forEach((t) => {
        const pos = String(t && t.position != null ? t.position : "");
        const key = pos || `#${tracklist.length}`;
        if (!seenPos.has(key)) {
          seenPos.add(key);
          tracklist.push(t);
        }
      });
    }
    const artistRoles = arD.drain(relSrc, entitySrc);
    const tracklistRels = trD.drain(relSrc, entitySrc);
    const entitySources = /* @__PURE__ */ new Map();
    entitySrc.forEach((set, k) => entitySources.set(k, [...set]));
    return { companies, artistRoles, tracklistRels, tracklist, processTracklist, relSrc, entitySources };
  }
  var _resultKey = (r) => r && r.entity && (r.entity.resource_url || r.entity._syntheticKey) || `_nourl_${r && (r.entity && r.entity.name || r.displayName) || ""}`;
  var _resultName = (r) => r && (r.entity && r.entity.name || r.displayName) || "";
  var _resultKind = (r) => r && (r.entityType || r.entity && r.entity.entityType) || "artist";
  var _roleKey = (ro) => [ro.linkType, ro.displayLabel, ro.trackPos, ro.trackTitle].join("");
  var boundedLev = (a, b, max) => {
    if (Math.abs(a.length - b.length) > max) return -1;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
      let prev = dp[0];
      dp[0] = j;
      let rowMin = dp[0];
      for (let i = 1; i <= a.length; i++) {
        const tmp = dp[i];
        dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
        if (dp[i] < rowMin) rowMin = dp[i];
      }
      if (rowMin > max) return -1;
    }
    return dp[a.length] <= max ? dp[a.length] : -1;
  };
  var fuzzyMax = (len) => len <= 6 ? 0 : len <= 12 ? 1 : 2;
  var stripInitials = (fn) => fn.split(" ").filter((t) => !/^[a-z]\.?$/.test(t)).join(" ");
  function mergeResolvedResults(allResults, entitySources) {
    const rows = (allResults || []).filter(Boolean);
    const nameMbids = /* @__PURE__ */ new Map();
    const nameMbidsStripped = /* @__PURE__ */ new Map();
    for (const r of rows) {
      if (r.type !== "resolved" || !r.mbUrl) continue;
      const fn = fold(_resultName(r));
      if (!fn) continue;
      const kn = _resultKind(r) + "|" + fn;
      if (!nameMbids.has(kn)) nameMbids.set(kn, /* @__PURE__ */ new Set());
      nameMbids.get(kn).add(r.mbUrl);
      const sn = _resultKind(r) + "|" + stripInitials(fn);
      if (!nameMbidsStripped.has(sn)) nameMbidsStripped.set(sn, /* @__PURE__ */ new Set());
      nameMbidsStripped.get(sn).add(r.mbUrl);
    }
    const conflictNames = /* @__PURE__ */ new Set();
    nameMbids.forEach((set, kn) => {
      if (set.size > 1) conflictNames.add(kn);
    });
    const uniqResolved = [];
    nameMbids.forEach((set, kn) => {
      if (set.size === 1) uniqResolved.push([kn, [...set][0]]);
    });
    const fuzzyResolvedMatch = (kfn) => {
      const [kind, fn] = [kfn.slice(0, kfn.indexOf("|")), kfn.slice(kfn.indexOf("|") + 1)];
      let hit = null;
      for (const [kn, url] of uniqResolved) {
        if (!kn.startsWith(kind + "|")) continue;
        const nm = kn.slice(kind.length + 1);
        if (boundedLev(fn, nm, fuzzyMax(Math.max(fn.length, nm.length))) < 0) continue;
        if (hit && hit !== url) return null;
        hit = url;
      }
      return hit;
    };
    const keyFor = (r) => {
      const fn = fold(_resultName(r));
      const kn = fn ? _resultKind(r) + "|" + fn : "";
      if (kn && conflictNames.has(kn)) return "cf:" + kn;
      if (r.type === "resolved" && r.mbUrl) return "mb:" + r.mbUrl;
      if (!fn) return null;
      const set = nameMbids.get(kn);
      if (set && set.size === 1) return "mb:" + [...set][0];
      let near = null;
      if (!set) {
        const stripped = nameMbidsStripped.get(_resultKind(r) + "|" + stripInitials(fn));
        if (stripped && stripped.size === 1) near = [...stripped][0];
      }
      if (!near) near = fuzzyResolvedMatch(kn);
      if (near) r._nearTwin = near;
      return "nm:" + kn;
    };
    const byKey = /* @__PURE__ */ new Map(), mergeMap = /* @__PURE__ */ new Map(), out = [];
    for (const r of rows) {
      const gk = keyFor(r), rk = _resultKey(r);
      if (!gk || !byKey.has(gk)) {
        if (gk) {
          byKey.set(gk, r);
          mergeMap.set(rk, [rk]);
          if (gk.startsWith("cf:")) r._conflicts = [r.mbUrl ? { mbUrl: r.mbUrl, mbName: r.mbName, mbDisambig: r.mbDisambig } : null];
        }
        out.push(r);
        continue;
      }
      const rep = byKey.get(gk), repKey = _resultKey(rep);
      if (gk.startsWith("cf:")) {
        if (r.mbUrl) (rep._conflicts = rep._conflicts || []).push({ mbUrl: r.mbUrl, mbName: r.mbName, mbDisambig: r.mbDisambig });
      } else if ((rep.type !== "resolved" || !rep.mbUrl) && r.type === "resolved" && r.mbUrl) {
        rep.type = "resolved";
        rep.mbUrl = r.mbUrl;
        rep.mbName = r.mbName;
        rep.mbDisambig = r.mbDisambig;
        rep.entityType = r.entityType || rep.entityType;
        rep.logEntry = r.logEntry || rep.logEntry;
      }
      const seen = new Set((rep._roles || []).map(_roleKey));
      rep._roles = (rep._roles || []).concat((r._roles || []).filter((ro) => {
        const k = _roleKey(ro);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }));
      if (entitySources) {
        const u = new Set(entitySources.get(repKey) || []);
        (entitySources.get(rk) || []).forEach((s) => u.add(s));
        entitySources.set(repKey, [...u]);
      }
      mergeMap.get(repKey).push(rk);
    }
    const resolvedByUrl = new Map(rows.filter((r) => r.type === "resolved" && r.mbUrl).map((r) => [r.mbUrl, r]));
    for (const rep of out) {
      const twin = rep._nearTwin && rep.type !== "resolved" && resolvedByUrl.get(rep._nearTwin);
      delete rep._nearTwin;
      if (!twin) continue;
      const name = _resultName(rep);
      rep.type = "resolved";
      rep.mbUrl = twin.mbUrl;
      rep.mbName = twin.mbName;
      rep.mbDisambig = twin.mbDisambig;
      rep.entityType = twin.entityType || rep.entityType;
      rep.logEntry = { displayName: rep.displayName || name, discogsHref: rep.discogsHref || "", mbUrl: twin.mbUrl, mbName: twin.mbName, mbDisambig: twin.mbDisambig || "", via: "typo", fromCache: false };
    }
    byKey.forEach((rep, gk) => {
      if (!gk.startsWith("cf:")) return;
      const cands = [], seenIds = /* @__PURE__ */ new Set();
      for (const c of rep._conflicts || []) {
        const m = c && c.mbUrl && c.mbUrl.match(/\/(?:artist|label|place)\/([^/?#]+)/i);
        if (!m || seenIds.has(m[1])) continue;
        seenIds.add(m[1]);
        cands.push({ id: m[1], name: c.mbName || _resultName(rep), disambiguation: c.mbDisambig || "" });
      }
      rep.nameMatches = cands.concat((rep.nameMatches || []).filter((nm) => nm && nm.id && !seenIds.has(nm.id)));
      rep.type = "attention";
      rep.mbUrl = null;
      rep.mbName = null;
      rep.mbDisambig = "";
      rep.ambiguityReason = "sources link this name to different MB artists";
      delete rep._conflicts;
    });
    for (const rep of out) {
      const keys = mergeMap.get(_resultKey(rep));
      rep._mergeUrls = [...new Set((keys || []).filter((k) => /^https?:\/\//i.test(k) && !/tidal\.com\/_(?:publisher|company)\//i.test(k)).map((k) => k.replace(/^https?:\/\/api\.discogs\.com\/(\w+?)s\/(\d+).*$/i, "https://www.discogs.com/$1/$2")))];
    }
    return { results: out, mergeMap };
  }

  // src/ui-bar.js
  var _logs2;
  var _summary;
  var _discogsJson = null;
  var _tidalJson = null;
  var _maJson = null;
  var _qobuzJson = null;
  var _deezerJson = null;
  var _moraJson = null;
  var _melonJson = null;
  var _allmusicJson = null;
  var _appleJson = null;
  var _ytmJson = null;
  var _consolidatedJson = null;
  var ST_ICONS = { "musicbrainz": { "color": "#eb743b", "svg": '<svg viewBox="0.75 0.75 28.5 28.5" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.5)"><path d="m13 1-12 7v14l12 7z" fill="#ba478f"/><path d="m14 1 12 7v14l-12 7z" fill="#eb743b"/></g></svg>' }, "discogs": { "color": "#333333", "svg": '<svg viewBox="71 71 882 882" xmlns="http://www.w3.org/2000/svg"><g transform="translate(512 512) scale(0.86) translate(-512 -512)"><circle cx="512" cy="512" r="496" fill="#333" stroke="#9a9a9a" stroke-width="32"/><path fill="#fff" d="M439.84 511.58A72.58 72.58 0 0 1 512.41 439 72.54 72.54 0 0 1 585 511.58a72.56 72.56 0 0 1-72.57 72.56 72.56 72.56 0 0 1-72.57-72.56zm3.18 0A69.48 69.48 0 0 0 512.41 581a69.4 69.4 0 0 0 69.4-69.38 69.49 69.49 0 0 0-69.4-69.43A69.44 69.44 0 0 0 443 511.58zm69.42-11.44a11.43 11.43 0 1 0 11.47 11.45 11.45 11.45 0 0 0-11.48-11.45zm-131.08 11.43a130.68 130.68 0 0 0 40.3 94.43l24.68-26.69.33.3a94.59 94.59 0 0 1 113.08-149.95l17.51-31.95a130.23 130.23 0 0 0-64.82-17.22c-72.27.01-131.08 58.81-131.08 131.08zm225.73 0a94.6 94.6 0 0 1-138.64 83.79l-17.83 31.74a130.26 130.26 0 0 0 61.82 15.53c72.28 0 131.08-58.8 131.08-131.08a130.63 130.63 0 0 0-37.73-91.9L581 446.39a94.3 94.3 0 0 1 26.1 65.2zm-267.34 0a172.17 172.17 0 0 0 53.68 125l25-27.07a135.38 135.38 0 0 1-41.82-97.89c0-74.88 60.92-135.8 135.8-135.8a134.92 134.92 0 0 1 67.08 17.8l17.73-32.34a171.57 171.57 0 0 0-84.81-22.35c-95.19-.03-172.66 77.43-172.66 172.65zm308.49 0c0 74.88-60.92 135.8-135.8 135.8a135 135 0 0 1-64.14-16.14l-18.07 32.17a171.62 171.62 0 0 0 82.21 20.86c95.22 0 172.69-77.47 172.69-172.69a172.15 172.15 0 0 0-51-122.4l-25.12 27a135.35 135.35 0 0 1 39.23 95.4zm41.61 0c0 97.83-79.58 177.43-177.41 177.43a176.32 176.32 0 0 1-84.52-21.46l-18.18 32.36a213.21 213.21 0 0 0 102.7 26.23C630.74 726.11 727 629.87 727 511.57a213.87 213.87 0 0 0-64.38-153l-25.26 27.18a176.85 176.85 0 0 1 52.49 125.82zm-392 0A213.9 213.9 0 0 0 365 667.24L390.23 640A176.88 176.88 0 0 1 335 511.57c0-97.82 79.59-177.41 177.41-177.41a176.26 176.26 0 0 1 87.08 22.93l17.84-32.55A213.14 213.14 0 0 0 512.44 297c-118.3 0-214.54 96.28-214.54 214.57zm392.55-183-24.64 26.49a218.57 218.57 0 0 1 65.94 156.51c0 120.9-98.36 219.26-219.26 219.26a217.9 217.9 0 0 1-105-26.84l-18.24 32.47A255.43 255.43 0 0 0 512 768c141.39 0 256-114.64 256-256a255.23 255.23 0 0 0-77.55-183.41zm-397.27 183c0-120.9 98.36-219.26 219.26-219.26a217.84 217.84 0 0 1 107.19 28.09L637 288.65A254.46 254.46 0 0 0 516.12 256H512c-140.54.22-254.42 113.26-256 253.5v2.5a255.69 255.69 0 0 0 80.51 186.08l25.31-27.36a218.61 218.61 0 0 1-68.64-159.15z"/></g></svg>' }, "spotify": { "color": "#1DB954", "svg": '<svg viewBox="1.25 1.375 21.25 21.25" fill="#1DB954"><path transform="translate(12 12) scale(.875) translate(-12 -12)" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>' }, "apple": { "color": "#FA243C", "svg": '<svg viewBox="1.625 1.25 20 20" fill="#FA243C"><path d="M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.73 3.01-.44 7.47 1.24 9.92.82 1.2 1.8 2.54 3.08 2.49 1.24-.05 1.71-.8 3.21-.8 1.5 0 1.92.8 3.23.77 1.33-.02 2.18-1.22 3-2.42.94-1.39 1.33-2.73 1.35-2.8-.03-.01-2.59-.99-2.62-3.93zM14.6 4.59c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38z"/></svg>' }, "deezer": { "color": "#A238FF", "svg": '<svg viewBox="3 3 18 18"><path transform="translate(12 12) scale(.74) translate(-12 -12)" d="M4 2h6v2h-6zM14 2h6v2h-6zM2 4h20v2h-20zM0 6h24v2h-24zM0 8h24v2h-24zM0 10h24v2h-24zM2 12h20v2h-20zM4 14h16v2h-16zM6 16h12v2h-12zM8 18h8v2h-8zM10 20h4v2h-4z" fill="#A238FF"/></svg>' }, "tidal": { "color": "#000000", "svg": '<svg viewBox="3 3 18 18"><path d="M6 6l3 3-3 3-3-3zM12 6l3 3-3 3-3-3zM18 6l3 3-3 3-3-3zM12 12l3 3-3 3-3-3z" style="fill:var(--mbu-text,currentColor)"/></svg>' }, "qobuz": { "color": "#0070ef", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#0070ef"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M14.5 14.5 19 19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>' }, "beatport": { "color": "#01FF95", "svg": '<svg viewBox="0.75 0.75 22.5 22.5"><circle cx="12" cy="12" r="11" fill="#000"/><g transform="translate(12 12) scale(0.84) translate(-12 -12)" fill="none" stroke="#01FF95" stroke-width="2.5"><path d="M10.9 3V8.3c0 1.2-.4 1.9-1.1 2.6L5.6 15.1"/><circle cx="13.9" cy="15.8" r="4.05" stroke-width="2.35"/></g></svg>' }, "bandcamp": { "color": "#629AA9", "svg": '<svg viewBox="2.25 2.25 19.5 19.5" fill="#629AA9"><path transform="translate(12 12) scale(.8) translate(-12 -12)" d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/></svg>' }, "volumo": { "color": "#7c4dff", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#7c4dff"/><path d="M7 8h2.2l2.8 6 2.8-6H17l-4 9h-2z" fill="#fff"/></svg>' }, "presto": { "color": "#1f3a5f", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#1f3a5f"/><path d="M8.5 6.5h4.1c2.2 0 3.7 1.4 3.7 3.4s-1.5 3.4-3.7 3.4h-2.2v4.2H8.5zm1.9 1.7v3.4h2c1.1 0 1.9-.7 1.9-1.7s-.8-1.7-1.9-1.7z" fill="#fff"/></svg>' }, "hdtracks": { "color": "#e63329", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#e63329"/><path d="M5 7.5h1.7v3.1h2.6V7.5H11v8H9.3v-3.2H6.7v3.2H5zm7.2 0h2.9c2 0 3.4 1.6 3.4 4s-1.4 4-3.4 4h-2.9zm1.7 1.5v5h1.1c1.1 0 1.8-1 1.8-2.5s-.7-2.5-1.8-2.5z" fill="#fff"/></svg>' }, "soundcloud": { "color": "#FF5500", "svg": '<svg viewBox="0 0 24 24"><path fill="#FF5500" d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z"/></svg>' }, "audiomack": { "color": "#FFA200", "svg": '<svg viewBox="0 0 24 24"><path fill="#FFA200" d="M.331 11.378s.5418-.089.765.1439c.2234.2332.077.7156-.2195.7237-.2965.01-.5705.063-.765-.1439-.1946-.2066-.1424-.6218.2195-.7237m5.881 3.2925c-.0522.01-.1075-.018-.164-.059-.3884-.5413-.5287-2.3923-.707-2.5025-.185-.1144-.8545 1.0255-2.1862.903-.5569-.051-1.1236-.4121-1.4573-.662.031-.4206.0364-1.4027.8659-1.0833.5038.1939 1.3667.7266 2.1245-.23.8378-1.0579 1.2999-.7506 1.577-.5206.2771.23.0925 1.4259.5058 1.0916.4133-.3343 2.082-2.4103 2.082-2.4103s1.292-1.303 1.4898.067c.1979 1.3698 1.0403 2.8877 1.2635 2.8445.2234-.043 2.8223-5.3253 3.1945-5.666.3722-.3409 1.6252-.2961 1.5657.5781-.0596.8742-.1871 6.308-.1871 6.308s-.147 1.5311.0924.7128c.0992-.3392.206-.6453.3392-1.0024.6414-2.0534 1.734-5.5613 2.2784-7.3688.1252-.4325.233-.8037.3166-1.0891l.0001-.0008a3.5925 3.5925 0 0 1 .0973-.3305c.0455-.1532.0763-.2546.0858-.2813.0243-.068.0925-.1192.1884-.157.0962-.061.1995-.064.3165-.067.3021-.027.6907.012 1.0401.1119.1018 0 .2125.037.3172.1118v.0001s.0063 0 .0151.01c.0023 0 .0048 0 .0073.01.0219.015.0573.045.0983.095.0012 0 .0025 0 .004.01.017.021.0341.045.0515.073.1952.2863.315.814.1948 1.7498-.2996 2.3354-.5316 7.1397-.5316 7.1397s-.0461.2298.4353-.782c.0167-.035.0383-.066.058-.098.026-.017.0552-.042.0913-.085.2974-.3546 1.0968-.5629 1.6512-.5586.2336.028.4293.087.5462.1609.2188.333.0897 1.562.0897 1.562-.4612.043-1.3403.2908-1.6519.3366-.3118.046-.7852 2.0699-1.4433 1.8629-.6581-.2069-2.1246-1.1268-2.1246-1.2533 0-.1102.1152-1.4546.1453-1.8016.0022-.024.004-.046.0058-.068a.152.152 0 0 1 .0014-.014l-.0002.0003c.0213-.2733.0023-.3927-.1239-.1199-.1086.2346-.581 1.7359-1.1078 3.3709-.0556.1429-1.0511 3.1558-1.1818 3.5231-.156.4261-.287.7523-.3776.921-.1378.1867-.3234.3036-.5826.2252-.6465-.1954-1.4654-1.0889-1.473-1.3106-.0155-1.2503.0608-7.973-.2423-7.4127-.311.5744-2.73 4.5608-2.73 4.5608-.0405.01-.0705.01-.1062.01-.1712-.019-.4366-.074-.51-.2384-.004-.01-.0094-.018-.0129-.028-.0035-.01-.0075-.022-.0135-.04-.0329-.1097-.0463-.2289-.0753-.3265-.1082-.3652-.2813-.8886-.463-1.421-.2784-.9079-.5654-1.8366-.6127-1.9391-.0923-.2007-.2268-.116-.3475-.0002-.54.458-1.6868 2.4793-2.7225 2.5898"/></svg>' }, "sevendigital": { "color": "#07606E", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#07606E"/><path d="M7.8 6.8h8.4v1.9l-4.5 8.9H9.4l4.4-8.7h-6z" fill="#fff"/></svg>' }, "melon": { "color": "#00CD3C", "svg": '<svg viewBox="63 52 175 175"><circle cx="138" cy="162" r="46.5" fill="none" stroke="#00CD3C" stroke-width="37"/><circle cx="202" cy="78" r="26" fill="#00CD3C"/></svg>' }, "bugs": { "color": "#FF3D2E", "svg": '<svg viewBox="0 0 256 256"><defs><linearGradient id="bugs-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C2009E"/><stop offset=".45" stop-color="#FF3A48"/><stop offset=".75" stop-color="#FFAA00"/><stop offset="1" stop-color="#FFC94A"/></linearGradient></defs><rect width="256" height="256" rx="30" fill="url(#bugs-g)"/><path fill="#fff" fill-rule="evenodd" d="M77 54H118C152 54 170 72 170 100C170 114 163 124 152 128C170 134 180 148 180 168C180 190 165 199 140 200L113 202L91 106C89 94 84 70 77 54ZM118 87L124 115H132C140 115 144 110 143 101C142 92 136 88 128 87ZM128 141L136 177H145C153 177 157 171 156 162C155 150 148 141 138 141Z"/></svg>' }, "allmusic": { "color": "#27aae1", "svg": '<svg viewBox="-52.87 0 482.77 482.77"><g transform="translate(-118.18 -150.37)"><path d="M432.47,627.54,310.78,352.16a14.57,14.57,0,1,0-7.81.09L178.83,633.14h67.38l14-40.1h92.41l14.32,40.1h67.65ZM276.91,543.85l30-82,29.31,82Z" style="fill:var(--mbu-text,#131313)"/><path d="M403.28,338.88a96.59,96.59,0,1,0-159.89,72.86l11.51-26.33A69.71,69.71,0,1,1,358.83,385l11.61,26.35A96.55,96.55,0,0,0,403.28,338.88Z" fill="#27aae1"/><path d="M466,439.64a187.71,187.71,0,0,0,29.24-100.76c0-103.95-84.57-188.51-188.52-188.51S118.18,234.93,118.18,338.88a187.67,187.67,0,0,0,29.7,101.48A189.56,189.56,0,0,0,205.69,498l13.08-29.92c-42.16-28.9-68.42-77.44-68.42-129.170c0-86.21,70.13-156.34,156.34-156.34s156.36,70.13,156.36,156.34a155.39,155.39,0,0,1-67.8,128.8l13.13,29.83A189.6,189.6,0,0,0,466,439.64Z" fill="#27aae1"/></g></svg>' }, "mora": { "color": "#0a7fd3", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#0a7fd3"/><path d="M6.8 16V10.2M6.8 11.6c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6V16M10.4 11.6c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6V16" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" transform="translate(1.6 0)"/></svg>' }, "ytmusic": { "color": "#FF0000", "svg": '<svg viewBox="0 0 24 24"><path fill="#FF0000" d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/></svg>' }, "amazonmusic": { "color": "#25D1DA", "svg": '<svg viewBox="2 2 20 20"><circle cx="12" cy="12" r="10" fill="#25D1DA"/><path d="M5.8 11.2c3.5 3.2 8.9 3.5 12.4.9" fill="none" stroke="#0F1111" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 10.7l3 1.3-.9 3.1" fill="none" stroke="#0F1111" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' }, "amazon": { "color": "#FF6600", "svg": '<svg viewBox="2 2 20 20"><rect x="2" y="2" width="20" height="20" rx="4.5" fill="#FF6600"/><path d="M5.6 11.6c3.9 2.6 9 2.7 12.4.4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><path d="M15.6 10.9l2.6 1-.6 2.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' }, "soundexchange": { "color": "#6f42c1", "svg": '<svg viewBox="1.75 1.75 20.5 20.5"><circle cx="12" cy="12" r="10" fill="#6f42c1"/><path d="M6.5 12h1.3l1-3 1.6 6 1.6-9 1.6 12 1.4-6h1.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>' }, "wikidata": { "color": "#339966", "svg": '<svg viewBox="120 -110 810 810"><path d="M120 45h30v500h-30zM180 45h90v500h-90zM300 45h90v500h-90z" fill="#990000"/><path d="M420 45h30v500h-30zM480 45h30v500h-30zM840 45h30v500h-30zM900 45h30v500h-30z" fill="#339966"/><path d="M540 45h90v500h-90zM660 45h30v500h-30zM720 45h90v500h-90z" fill="#006699"/></svg>' }, "wikipedia": { "color": "#000000", "svg": '<svg viewBox="0 0 24 24"><g fill="none" stroke-linecap="butt" style="stroke:var(--mbu-text,currentColor)"><path d="M2.6 5.5 7 18.8M10.3 5.5 14.7 18.8" stroke-width="2.1"/><path d="M7 18.8 11.4 7.2M14.7 18.8 21.2 5.5" stroke-width="1"/><path d="M.8 5.5h4.4M8.6 5.5h3.8M18.9 5.5h4.3" stroke-width="1"/></g></svg>' }, "rateyourmusic": { "color": "#2383C6", "svg": '<svg viewBox="0 0 143 143" xmlns="http://www.w3.org/2000/svg"><path d="M85.7921 43.0106C96.6509 47.3959 115.863 46.7695 127.766 45.7254C117.951 24.2165 96.2333 9.18123 71.1744 9.18123C59.0627 9.18123 47.995 12.5224 38.3892 18.5783C59.2715 8.76358 69.295 36.1195 85.7921 43.0106Z" fill="#E6E4E5"/><path d="M142.174 71.4106C142.174 110.669 110.433 142.411 71.1738 142.411C31.915 142.411 0.173828 110.669 0.173828 71.4106C0.173828 32.1518 31.915 0.410645 71.1738 0.410645C110.433 0.410645 142.174 32.3606 142.174 71.4106Z" fill="#E6E4E5"/><path d="M107.717 67.8609C117.323 68.4874 126.093 65.9815 132.776 63.058C131.94 56.7933 130.27 50.9463 127.764 45.5169C115.861 46.561 96.6492 47.1874 85.7904 42.8021C69.2934 35.911 58.4346 8.13754 38.3875 18.3699C20.6375 29.4375 8.94341 48.858 8.94341 71.4109C8.94341 77.258 9.77868 82.8962 11.2404 88.1168C21.0551 79.3462 41.7287 62.8492 60.314 57.8374C85.3728 51.1551 87.0434 66.608 107.717 67.8609Z" fill="url(#rym-g0)"/><path d="M132.777 63.2667C126.095 66.1902 117.324 68.4872 107.718 68.0696C87.0447 66.8167 85.3742 51.1549 60.1065 58.0461C41.73 63.0579 21.0565 79.7637 11.033 88.3255C13.1212 95.4255 16.2536 102.108 20.6389 108.164C27.3212 102.525 35.4653 97.3049 44.4447 95.4255C70.13 89.996 70.13 108.372 91.8477 105.867C103.751 104.405 120.039 92.9196 132.359 82.8961C132.986 79.3461 133.404 75.5873 133.404 71.8284C133.404 68.6961 133.195 65.9814 132.777 63.2667Z" fill="url(#rym-g1)"/><path d="M44.4443 95.2164C35.4649 97.0958 27.3208 102.316 20.6384 107.955C31.9149 123.616 50.2913 133.849 71.1737 133.849C101.871 133.849 127.138 111.713 132.359 82.687C120.038 92.7106 103.75 104.196 91.8472 105.658C70.1296 108.163 70.1296 89.5782 44.4443 95.2164Z" fill="url(#rym-g2)"/><path d="M97.2771 83.1047C99.783 89.3694 97.4859 96.2606 91.6389 98.7665C86.0007 101.064 79.3184 97.9311 76.6037 91.8752C74.0978 85.6105 76.3948 78.7194 82.2419 76.2135C88.0889 73.7076 94.7712 76.84 97.2771 83.1047Z" fill="url(#rym-g3)"/><defs><linearGradient id="rym-g0" x1="70.8335" y1="57.9435" x2="70.8335" y2="17.9123" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#88C6EB"/><stop offset="1" stop-color="#2392CC"/></linearGradient><linearGradient id="rym-g1" x1="76.8285" y1="109.069" x2="70.589" y2="66.1666" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2383C6"/><stop offset="1" stop-color="#33519F"/></linearGradient><linearGradient id="rym-g2" x1="76.5127" y1="128.007" x2="76.5127" y2="94.94" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1E4999"/><stop offset="1" stop-color="#1B3B6C"/></linearGradient><linearGradient id="rym-g3" x1="88.7722" y1="102.59" x2="85.7469" y2="75.5277" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1E4999"/><stop offset="1" stop-color="#1B3B6C"/></linearGradient></defs></svg>' }, "review": { "color": "#555555", "svg": '<svg viewBox="1 1 22 22"><path d="M3 3h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H10l-5 5v-5H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" style="fill:var(--mbu-text,currentColor)"/><path d="M6 7.5h12M6 10.5h12M6 13.5h8" stroke="var(--mbu-bg,#fff)" stroke-width="1.5" stroke-linecap="round" style="stroke:var(--mbu-bg,#fff)"/></svg>' }, "twitter": { "color": "#000000", "svg": '<svg viewBox="458.78 184.6 852 852"><path transform="translate(52.39 -25.06)" d="M485.39 356.79l230.07 307.62L483.94 914.52h52.11l202.7-218.98 163.77 218.98h177.32L836.82 589.6l215.5-232.81h-52.11L813.54 558.46 662.71 356.79zM562.02 395.17h81.46l359.72 480.97h-81.46z" fill-rule="evenodd" style="fill:var(--mbu-text,currentColor)"/></svg>' }, "facebook": { "color": "#0866FF", "svg": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#0866FF"/><path d="M15.12 7.6h-1.7c-.9 0-1.12.43-1.12 1.1V10h2.8l-.4 2.85h-2.4v11.1a12 12 0 0 1-3 0v-11.1H7.2V10h2.1V8.3c0-2.45 1.5-3.8 3.7-3.8.9 0 1.7.07 2.12.12z" fill="#fff"/></svg>' }, "lastfm": { "color": "#D51007", "svg": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#D51007"/><path transform="translate(4.2 4.2) scale(.65)" fill="#fff" d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.630-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.930-1.457-4.590-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.890 0 12.233c0 4.180 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/></svg>' }, "secondhandsongs": { "color": "#0F9DAB", "svg": '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0F9DAB"/><path d="M12.4 4.6L6.6 9.3C9 11.2 10.5 11.5 12.3 11.9C14.5 12.4 16 12.6 18.4 13.9L12.6 18.2" fill="none" stroke="#fff" stroke-width="5.4" stroke-linejoin="round"/><path d="M11.4 5.4L6.6 9.3C9 11.2 10.5 11.5 12.3 11.9C14.5 12.4 16 12.6 18.4 13.9L13.6 17.4" fill="none" stroke="#0F9DAB" stroke-width="2.6" stroke-linejoin="miter"/><ellipse cx="14.9" cy="4.8" rx="3.4" ry="2.6" transform="rotate(-28 14.9 4.8)" fill="#fff"/><ellipse cx="10.3" cy="18.6" rx="3.7" ry="2.8" transform="rotate(-28 10.3 18.6)" fill="#fff"/></svg>' }, "genius": { "color": "#CC2229", "svg": '<svg viewBox="1085 490 820 870"><path fill="#CC2229" d="M1840 625C1855 618 1870 620 1865 640C1850 720 1700 950 1670 1005C1630 1075 1550 1180 1515 1225C1450 1305 1380 1360 1375 1345C1380 1335 1392 1325 1395 1315C1400 1295 1430 1270 1430 1255C1425 1240 1410 1270 1398 1275C1395 1265 1420 1225 1422 1210C1425 1195 1450 1140 1470 1060C1480 1010 1490 975 1488 960C1485 920 1450 915 1410 907C1365 898 1350 888 1330 883C1270 868 1180 850 1135 820C1112 805 1120 795 1155 790C1290 772 1430 760 1530 740C1640 718 1740 680 1840 625Z"/><path style="fill:var(--mbu-text,currentColor)" d="M1810 510C1830 505 1855 520 1855 550C1855 570 1848 572 1848 580C1852 595 1830 630 1810 645C1795 657 1775 663 1760 660C1730 654 1720 630 1720 605C1722 560 1765 515 1810 510Z"/></svg>' }, "viaf": { "color": "#2a6ebb", "svg": '<svg viewBox="0 0 24 24" fill="none"><circle cx="8.6" cy="8.6" r="6.6" stroke="#2a6ebb" stroke-width="2.6"/><circle cx="14" cy="13.4" r="5" stroke="#5a9a2e" stroke-width="2.3"/><circle cx="12.6" cy="18.6" r="3.6" stroke="#e8792b" stroke-width="2"/></svg>' }, "youtube": { "color": "#FF0000", "svg": '<svg viewBox="0 0 24 24"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' }, "instagram": { "color": "#FF0069", "svg": '<svg viewBox="0 0 24 24"><defs><radialGradient id="ig-g" cx=".3" cy="1.07" r="1.2"><stop offset="0" stop-color="#FFDD55"/><stop offset=".1" stop-color="#FFDD55"/><stop offset=".5" stop-color="#FF543E"/><stop offset="1" stop-color="#C837AB"/></radialGradient></defs><path fill="url(#ig-g)" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>' }, "imdb": { "color": "#F5C518", "svg": '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" fill="#000"/><path fill="#F5C518" d="M22.3781 0H1.6218C.7411.0583.0587.7437.0018 1.5953l-.001 20.783c.0585.8761.7125 1.543 1.5559 1.6191A.337.337 0 0 0 1.6016 24h20.7971a.4579.4579 0 0 0 .0437-.002c.8727-.0768 1.5568-.8271 1.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294 0 0 0 22.3781 0zm0 .496a1.2144 1.2144 0 0 1 1.1252 1.2139v20.5797c0 .6377-.4875 1.1602-1.1045 1.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371 1.0185 1.0184.5364 1.6217.496h20.7564zM4.7954 8.2603v7.3636H2.8899V8.2603h1.9055zm6.5367 0v7.3636H9.6707v-4.9704l-.6711 4.9704H7.813l-.6986-4.8618-.0066 4.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307 1.5734l.2712 1.8713.4407-3.4447h2.4817zm2.9772 1.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0 .4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204 0 .3457.0205.4211.0681zm-.0211 6.0347c.4543 0 .8006-.0265 1.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0 .3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086 0-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153 0 .2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047 0 .5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172 0-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z"/></svg>' }, "songkick": { "color": "#F80046", "svg": '<svg viewBox="0 0 24 24"><path fill="#F80046" d="M6.55 18.779c-1.855 0-3.372-.339-4.598-1.602l1.92-1.908c.63.631 1.74.853 2.715.853 1.186 0 1.739-.391 1.739-1.089 0-.291-.06-.529-.239-.717-.15-.154-.404-.273-.795-.324l-1.455-.205c-1.064-.152-1.891-.51-2.43-1.072-.555-.578-.84-1.395-.84-2.434C2.536 8.066 4.2 6.45 6.96 6.45c1.74 0 3.048.407 4.086 1.448L9.171 9.77c-.765-.766-1.77-.715-2.295-.715-1.039 0-1.465.597-1.465 1.125 0 .152.051.375.24.561.15.153.404.307.832.359l1.467.203c1.09.153 1.875.495 2.385 1.005.645.63.9 1.53.9 2.655 0 2.47-2.127 3.819-4.68 3.819l-.005-.003zM20.813 2.651C19.178 1.432 17.37.612 15.089.237v10.875l3.261-4.539h3.565l-4.095 5.72s.944 1.51 1.515 2.405c.586.899 1.139 1.14 1.965 1.14h.57v2.806h-.872c-1.812 0-2.9-.33-3.72-1.575-.504-.811-2.175-3.436-2.175-3.436v4.995H12.12V-.001H12c-3.852 0-6.509.931-8.811 2.652C-.132 5.137.001 8.451.001 11.997c0 3.547-.133 6.867 3.188 9.352C5.491 23.074 8.148 24 12 24s6.51-.927 8.812-2.651C24.131 18.865 24 15.544 24 11.997c0-3.546.132-6.859-3.188-9.346h.001z"/></svg>' }, "bandsintown": { "color": "#00CEC8", "svg": '<svg viewBox="0 0 24 24"><path fill="#00CEC8" d="M6.399 12.8v4.8H19.2v1.6H4.799V0H0v24h24V12.8H6.399Zm4.801-8H6.399v6.4H11.2V4.8Zm6.4 0h-4.8v6.4h4.8V4.8ZM24 0h-4.8v11.2H24V0Z"/></svg>' }, "napster": { "color": "#2259FF", "svg": '<svg viewBox="0 0 24 24"><path fill="#2259FF" d="M20.495 4.543c-.22 0-.438 0-.657.03h-.031l-.032-.03C17.93 2.21 15.02.798 12.015.798c-3.004 0-5.945 1.412-7.76 3.775l-.031.03h-.031c-.22-.03-.439-.03-.658-.03H2.16v2.394l-.032.03A3.628 3.628 0 0 0 0 10.282c0 1.412.844 2.701 2.127 3.284h.063v.062c.031 5.278 4.443 9.575 9.825 9.575s9.794-4.297 9.825-9.575v-.062l.032-.03C23.155 12.92 24 11.632 24 10.25c0-1.412-.845-2.7-2.128-3.284l-.032-.03V4.542zM6.821 5.34a7.443 7.443 0 0 1 5.194-2.117c1.94 0 3.818.767 5.195 2.117l.062.062-.094.061c-.375.215-.72.43-1.064.675l-.03.031-.032-.03c-.908-.461-2.347-.983-4.005-.983s-3.098.522-4.006.982l-.03.031-.032-.03a10.22 10.22 0 0 0-1.064-.676l-.188-.061zm12.329 8.195c0 3.866-3.223 7.027-7.166 7.027-3.942 0-7.134-3.16-7.134-7.027V7.458l.094.03c1.252.308 2.44 1.658 2.722 1.996.313-.338 1.784-1.658 4.35-1.658 2.565 0 4.036 1.35 4.35 1.658.28-.338 1.438-1.688 2.721-1.995l.094-.031v6.077z"/></svg>' }, "myspace": { "color": "#030303", "svg": '<svg viewBox="0 0 24 24"><path style="fill:var(--mbu-text,currentColor)" d="M19.802 12.274A3.811 3.811 0 0023.62 8.47c0-2.101-1.71-3.795-3.818-3.795a3.816 3.816 0 00-3.818 3.81 3.817 3.817 0 003.818 3.811zm-8.602.705a3.43 3.43 0 003.435-3.424A3.43 3.43 0 0011.2 6.13a3.44 3.44 0 00-3.436 3.436A3.436 3.436 0 0011.2 13zm-7.8.635c1.71 0 3.093-1.38 3.093-3.081 0-1.704-1.395-3.084-3.105-3.084A3.086 3.086 0 00.3 10.539c0 1.7 1.387 3.078 3.095 3.078zm0 .705c-1.96 0-3.4 1.717-3.4 3.495v1.196c0 .17.138.31.31.31h6.18a.31.31 0 00.309-.31v-1.196c0-1.779-1.437-3.5-3.398-3.5zm7.8-.56c-2.18 0-3.78 1.915-3.78 3.891v1.331c0 .188.156.344.345.344h6.87a.344.344 0 00.342-.344V17.65c0-1.976-1.598-3.891-3.777-3.891zm8.602-.617c-2.422 0-4.197 2.126-4.197 4.323v1.477c0 .21.172.381.382.381h7.63c.21 0 .383-.171.383-.381v-1.477c-.001-2.197-1.776-4.323-4.198-4.323z"/></svg>' }, "vk": { "color": "#0077FF", "svg": '<svg viewBox="0 0 24 24"><path fill="#0077FF" d="m9.489.004.729-.003h3.564l.73.003.914.01.433.007.418.011.403.014.388.016.374.021.36.025.345.03.333.033c1.74.196 2.933.616 3.833 1.516.9.9 1.32 2.092 1.516 3.833l.034.333.029.346.025.36.02.373.025.588.012.41.013.644.009.915.004.98-.001 3.313-.003.73-.01.914-.007.433-.011.418-.014.403-.016.388-.021.374-.025.36-.03.345-.033.333c-.196 1.74-.616 2.933-1.516 3.833-.9.9-2.092 1.32-3.833 1.516l-.333.034-.346.029-.36.025-.373.02-.588.025-.41.012-.644.013-.915.009-.98.004-3.313-.001-.73-.003-.914-.01-.433-.007-.418-.011-.403-.014-.388-.016-.374-.021-.36-.025-.345-.03-.333-.033c-1.74-.196-2.933-.616-3.833-1.516-.9-.9-1.32-2.092-1.516-3.833l-.034-.333-.029-.346-.025-.36-.02-.373-.025-.588-.012-.41-.013-.644-.009-.915-.004-.98.001-3.313.003-.73.01-.914.007-.433.011-.418.014-.403.016-.388.021-.374.025-.36.03-.345.033-.333c.196-1.74.616-2.933 1.516-3.833.9-.9 2.092-1.32 3.833-1.516l.333-.034.346-.029.36-.025.373-.02.588-.025.41-.012.644-.013.915-.009ZM6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z"/></svg>' }, "weibo": { "color": "#E6162D", "svg": '<svg viewBox="0 0 24 24"><path fill="#E6162D" d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z"/></svg>' }, "pandora": { "color": "#224099", "svg": '<svg viewBox="0 0 24 24"><path fill="#224099" d="M1.882 0v24H8.32a1.085 1.085 0 001.085-1.085v-4.61h1.612c7.88 0 11.103-4.442 11.103-9.636C22.119 2.257 17.247 0 12.662 0H1.882Z"/></svg>' }, "ebay": { "color": "#E53238", "svg": '<svg viewBox="0 0 24 24"><path fill="#E53238" d="M6.056 12.132v-4.92h1.2v3.026c.59-.703 1.402-.906 2.202-.906 1.34 0 2.828.904 2.828 2.855 0 .233-.015.457-.06.668.24-.953 1.274-1.305 2.896-1.344.51-.018 1.095-.018 1.56-.018v-.135c0-.885-.556-1.244-1.53-1.244-.72 0-1.245.3-1.305.81h-1.275c.136-1.29 1.5-1.62 2.686-1.62 1.064 0 1.995.27 2.415 1.02l-.436-.84h1.41l2.055 4.125 2.055-4.126H24l-3.72 7.305h-1.346l1.07-2.04-2.33-4.38c.13.255.2.555.2.93v2.46c0 .346.01.69.04 1.005H16.8a6.543 6.543 0 01-.046-.765c-.603.734-1.32.96-2.32.96-1.48 0-2.272-.78-2.272-1.695 0-.15.015-.284.037-.405-.3 1.246-1.36 2.086-2.767 2.086-.87 0-1.694-.315-2.2-.93 0 .24-.015.494-.04.734h-1.18c.02-.39.04-.855.04-1.245v-1.05h-4.83c.065 1.095.818 1.74 1.853 1.74.718 0 1.355-.3 1.568-.93h1.24c-.24 1.29-1.61 1.725-2.79 1.725C.95 15.009 0 13.822 0 12.232c0-1.754.982-2.91 3.116-2.91 1.688 0 2.93.886 2.94 2.806v.005zm9.137.183c-1.095.034-1.77.233-1.77.95 0 .465.36.97 1.305.97 1.26 0 1.935-.69 1.935-1.814v-.13c-.45 0-.99.006-1.484.022h.012zm-6.06 1.875c1.11 0 1.876-.806 1.876-2.02s-.768-2.02-1.893-2.02c-1.11 0-1.89.806-1.89 2.02s.765 2.02 1.875 2.02h.03zm-4.35-2.514c-.044-1.125-.854-1.546-1.725-1.546-.944 0-1.694.474-1.815 1.546z"/></svg>' }, "commons": { "color": "#006699", "svg": '<svg viewBox="0 0 24 24"><path fill="#006699" d="M9.048 15.203a2.952 2.952 0 1 1 5.904 0 2.952 2.952 0 0 1-5.904 0zm11.749.064v-.388h-.006a8.726 8.726 0 0 0-.639-2.985 8.745 8.745 0 0 0-1.706-2.677l.004-.004-.186-.185-.044-.045-.026-.026-.204-.204-.006.007c-.848-.756-1.775-1.129-2.603-1.461-1.294-.519-2.138-.857-2.534-2.467.443.033.839.174 1.13.481C15.571 6.996 11.321 0 11.321 0s-1.063 3.985-2.362 5.461c-.654.744.22.273 1.453-.161.279 1.19.77 2.119 1.49 2.821.791.771 1.729 1.148 2.556 1.48.672.27 1.265.508 1.767.916l-.593.594-.668-.668-.668 2.463 2.463-.668-.668-.668.6-.599a6.285 6.285 0 0 1 1.614 3.906h-.844v-.944l-2.214 1.27 2.214 1.269v-.944h.844a6.283 6.283 0 0 1-1.614 3.906l-.6-.599.668-.668-2.463-.668.668 2.463.668-.668.6.6a6.263 6.263 0 0 1-3.907 1.618v-.848h.945L12 18.45l-1.27 2.214h.944v.848a6.266 6.266 0 0 1-3.906-1.618l.599-.6.668.668.668-2.463-2.463.668.668.668-.6.599a6.29 6.29 0 0 1-1.615-3.906h.844v.944l2.214-1.269-2.214-1.27v.944h-.843a6.292 6.292 0 0 1 1.615-3.906l.6.599-.668.668 2.463.668-.668-2.463-.668.668-2.359-2.358-.23.229-.044.045-.185.185.004.004a8.749 8.749 0 0 0-2.345 5.662h-.006v.649h.006a8.749 8.749 0 0 0 2.345 5.662l-.004.004.185.185.045.045.045.045.185.185.004-.004a8.73 8.73 0 0 0 2.677 1.707 8.75 8.75 0 0 0 2.985.639V24h.649v-.006a8.75 8.75 0 0 0 2.985-.639 8.717 8.717 0 0 0 2.677-1.707l.004.004.187-.187.044-.043.043-.044.187-.186-.004-.004a8.733 8.733 0 0 0 1.706-2.677 8.726 8.726 0 0 0 .639-2.985h.006v-.259z"/></svg>' }, "googleplay": { "color": "#414141", "svg": '<svg viewBox="0 0 24 24"><path fill="#01875F" d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"/></svg>' }, "globe": { "color": "#6f7d75", "svg": '<svg viewBox="2 2 20 20" fill="none" stroke="#6f7d75" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>' } };
  function stIcon(name, size) {
    var i = ST_ICONS[name];
    if (!i) return "";
    size = size || 16;
    return i.svg.replace(/<svg\b([^>]*)>/, function(m, a) {
      a = a.replace(/\s(?:width|height)="[^"]*"/g, "");
      var ns = /\bxmlns=/.test(a) ? "" : ' xmlns="http://www.w3.org/2000/svg"';
      return "<svg" + a + ns + ' width="' + size + '" height="' + size + '">';
    });
  }
  var SRC_ICON = {
    Discogs: stIcon("discogs", 16),
    Tidal: stIcon("tidal", 16),
    Qobuz: stIcon("qobuz", 16),
    Deezer: stIcon("deezer", 16),
    mora: stIcon("mora", 16),
    Melon: stIcon("melon", 16),
    AllMusic: stIcon("allmusic", 16),
    Apple: stIcon("apple", 16),
    "YouTube Music": stIcon("ytmusic", 16),
    // #648 — the All review's per-entity source badge
    "Metal Archives": '<img src="data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw+ODwAAbmwAAGe3AAByzAAAfswQEI+9DAyKeBgYlxUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB2ZgAAeO0AAG3/AAAk/wAAAP8AAAD/AAAk/yUlpP8AADH7AAAA/wAAAP8AAACWAAAAAAAAAAAAAAAAAAB+jQAAaP8AAHH/AABr/wAAAP9wfpf/cH6X/wAAAP8AAHr/AAAA/3B+l/9wfpf/AAAA/wAAAAAAAAAAAAB+ZgAAWP8BAYD/DAyK/wAAev8AAAD/fYyo/32MqP8AAAD/AAAA/wAAAP99jKj/fYyo/wAAAP8AAAAAAQGAEhMTku0AAGz/AABk/wMDgv8AAGv/AAAt/wAAAP+LnLv/i5y7/4ucu/+LnLv/i5y7/4ucu/8AAAD/AAB/JAAAZWkICIf/BgaF/wAAef8AAEz/AABx/wEBgP8EBDj/AAAA/5qt0P8AAAD/AAAA/5qt0P+ardD/AAAA/wAAbocAAHKxAABe/wAAc/8REZD/AABl/wwMiv8VFZT/AABv/wAALf8AAAD/qL3j/wAAAP+oveP/qL3j/wAAAP8AAHHPAAAe7AAAAP8AAAD/AAAy/wAAev8NDUH/AAAA/wAAAP8BATb/AAAh/wAAAP+1y/T/tcv0/7XL9P8AAAD/AQGA+QAAAP9ygJr/coCa/wAAAP8CAoH/AAAA/3KAmv9ygJr/AAAA/wAAfP8GBjr/AAAA/73U//+91P//AAAA/wAAcvYAAAD/gZGu/4GRrv8AAAD/AAAA/wAAAP+Bka7/gZGu/wAAAP8AAHj/AABu/wAAM/8AAAD/AAAA/wEBNv8AAHPYAAAA/5Olxv+Tpcb/AAAA/5Olxv8AAAD/k6XG/5Olxv8AAAD/Dw+O/wAAaP8AAHn/AABe/wAAWv8AAGv/AAB0lgAAAP+kuN3/pLjd/wAAAP+kuN3/AAAA/6S43f+kuN3/AAAA/wAAW/8AAHL/AAB//wICgf8AAHH/AABy/AAAbTAAAAD/s8nx/7PJ8f+zyfH/AAAA/7PJ8f+zyfH/s8nx/wAAAP8AAH7/AAB//wAAe/8AAGv/AAB7/wAAepwAAAAAAAAA/73U//+91P//AAAA/wAAMP8AAAD/vdT//73U//8AAAD/BweG/wkJiP8AAHX/AABt/wAAfMMcHJsGAAAAAAAAAJYAAAD/AAAA/wAAFbsWFpXwAAAs/wAAAP8AAAD/CAg8/xcXlv8AAF7/AAB49gAAZHUREZADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABhGw8PjoQAAGrJAQGA+QkJiP8TE5LMAAB2jQ0NjCcAAAAAAAAAAAAAAAAAAAAA8A8AAOABAADAAQAAgAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAwAA8A8AAA==" width="16" height="16" alt="Metal Archives" style="display:inline-block;vertical-align:middle">',
    // #453 real MA favicon
    Titles: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 11h16M4 16h10"/></svg>'
  };
  var srcIconByUrl = (url) => SRC_ICON[sourceNameForUrl(url)] || "";
  function insertDiscogsBar(discogsUrl, sources = {}, meta = {}) {
    const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001;--mbu-z-tip:2147483647}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
    const MBU_UI_CSS = '.mbu-help{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--mbu-text-weak);text-decoration:none;line-height:1}.mbu-help svg{width:18px;height:18px;display:block}.mbu-help:hover{color:var(--mbu-accent-text,var(--mbu-accent));background:none;text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-tip);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{width:auto;margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-drag .mbu-cfg-h{cursor:move;user-select:none}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;width:auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(860px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-hclear,.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min,.mbu-logpop-full{width:auto;font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-hclear:hover,.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover,.mbu-logpop-full:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-log-f,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x,#mbu-logpop.min .mbu-logpop-full{display:none}#mbu-logpop.min{max-height:none;width:auto!important;height:auto!important}#mbu-logpop.sized{max-height:none}.mbu-logpop-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;opacity:.6;background:linear-gradient(135deg,transparent 55%,var(--mbu-border-strong) 55%,var(--mbu-border-strong) 62%,transparent 62%,transparent 75%,var(--mbu-border-strong) 75%,var(--mbu-border-strong) 82%,transparent 82%)}.mbu-logpop-grip:hover{opacity:1}#mbu-logpop.min .mbu-logpop-grip,#mbu-logpop.full .mbu-logpop-grip{display:none}#mbu-logpop.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;width:auto!important;height:auto!important;max-height:none;transform:none!important}#mbu-logpop.full .mbu-logpop-h{cursor:default}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-logemb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--mbu-bg);font:13px var(--mbu-font);color:var(--mbu-text)}.mbu-logemb .mbu-logpop-h{cursor:default;padding:7px 10px}.mbu-logemb .mbu-logpop-h>.mbu-log-q{flex-basis:160px;margin-left:0}.mbu-logemb .mbu-logpop-h>.mbu-log-ses{flex-basis:240px}.mbu-logpop-h{flex-wrap:nowrap}.mbu-logpop-h>*{flex-shrink:0;white-space:nowrap}.mbu-logpop-h>.mbu-log-q{flex-shrink:1;min-width:60px}.mbu-logpop-h>.mbu-log-ses{flex-shrink:1;min-width:90px}.mbu-logpop-h>.mbu-logpop-sp{flex:1 1 0;min-width:0}.mbu-logpop .mbu-log-ses{flex:0 1 260px;min-width:120px;max-width:100%}.mbu-logpop-hclear:disabled{opacity:.5;cursor:default}.mbu-log-dbg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--mbu-text);cursor:pointer;white-space:nowrap}.mbu-log-dbg input{margin:0}#mbu-logpop.min .mbu-log-dbg{display:none}.mbu-log-past .mbu-logpop-clear{display:none}#mbu-logpop.min .mbu-log-ses,#mbu-logpop.min .mbu-logpop-hclear{display:none}.mbu-logpop .mbu-log-q{flex:0 1 200px;min-width:80px;margin-left:6px;font:12px var(--mbu-font);padding:2px 8px;border:1px solid var(--mbu-border);border-radius:5px;cursor:text}#mbu-logpop.min .mbu-log-q{display:none}.mbu-logpop .mbu-log-li.mbu-log-nq{display:none}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-pre .mbu-log-m{white-space:pre;font:12px/1.35 ui-monospace,Consolas,monospace;word-break:normal}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-c{color:var(--mbu-text-weak);flex:0 0 auto}.mbu-log-list:not(.mbu-log-cats) .mbu-log-c{display:none}.mbu-log-list.mbu-log-cats{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:3px 9px;align-content:start}.mbu-log-cats .mbu-log-li{display:contents}.mbu-log-cats .mbu-log-empty{grid-column:1/-1}.mbu-log-f{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;padding:5px 13px;border-bottom:1px solid var(--mbu-border-soft);font-size:11px}.mbu-log-f[hidden]{display:none}.mbu-log-fg{display:contents}.mbu-log-fs{width:1px;height:12px;background:var(--mbu-border);margin:0 6px}.mbu-logpop .mbu-log-fb{width:auto;font:inherit;color:var(--mbu-text-weak);background:none;border:1px solid transparent;border-radius:5px;padding:0 6px;line-height:1.6;cursor:pointer}.mbu-logpop .mbu-log-fb:hover{color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb.on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb[data-sev=error]{color:var(--mbu-error)}.mbu-logpop .mbu-log-fb[data-sev=warn]{color:var(--mbu-warn)}.mbu-logpop .mbu-log-fb[data-sev=info]{color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-fb[data-sev].on{background:var(--mbu-bg-hover);border-color:currentColor;font-weight:600}.mbu-logpop .mbu-log-fb[data-cat]{border-color:var(--mbu-border-soft);background:var(--mbu-bg-raised);border-radius:999px;padding:0 8px}.mbu-logpop .mbu-log-fb[data-cat].on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-accent)}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug>*{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;scrollbar-gutter:stable;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(*){scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}select.mbu-select:not(#mbu-0):not(#mbu-1){-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box;height:22px;max-width:100%;margin:0 2px;padding:0 26px 0 12px;border:1px solid var(--mbu-border);border-radius:20px;outline-offset:1px;background-color:transparent;background-image:linear-gradient(45deg,transparent 50%,var(--mbu-text-weak) 50%),linear-gradient(135deg,var(--mbu-text-weak) 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat;color:var(--mbu-text);font:600 12px var(--mbu-font);line-height:20px;cursor:pointer;vertical-align:middle}select.mbu-select:not(#mbu-0):not(#mbu-1):hover{border-color:var(--mbu-accent)}select.mbu-select:not(#mbu-0):not(#mbu-1):disabled{opacity:.45;cursor:default;border-color:var(--mbu-border)}select.mbu-select:not(#mbu-0):not(#mbu-1) option{background:var(--mbu-bg);color:var(--mbu-text);font-weight:400}.mbu-step:not(#mbu-0):not(#mbu-1){display:inline-flex;align-items:center;box-sizing:border-box;height:22px;margin:0 2px;padding:0;border:1px solid var(--mbu-border);border-radius:20px;background:transparent;vertical-align:middle;white-space:nowrap;flex:0 0 auto}.mbu-step:not(#mbu-0):not(#mbu-1):hover,.mbu-step:not(#mbu-0):not(#mbu-1):focus-within{border-color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>button{all:unset;box-sizing:border-box;width:20px;height:20px;text-align:center;font:600 13px/20px var(--mbu-font);color:var(--mbu-text-weak);cursor:pointer;user-select:none}.mbu-step:not(#mbu-0):not(#mbu-1)>button:hover{color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>input{all:unset;box-sizing:content-box;min-width:2ch;height:20px;padding:0 1px;font:600 12px/20px var(--mbu-font);color:var(--mbu-text);text-align:center;-moz-appearance:textfield;appearance:textfield;cursor:text}.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-inner-spin-button,.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled){opacity:.45;border-color:var(--mbu-border)}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled)>button{cursor:default;color:var(--mbu-text-weak)}';
    function mbuHelpHref(name) {
      return "https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/" + name + "/README.md";
    }
    var MBU_HELP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/></svg>';
    var MBU_SORT_ICON = '<svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18M1 17l4 4 4-4"/><path d="M13 11l3-8 3 8M14.1 8h3.8M13 14h6l-6 7h6"/></svg>';
    var MBU_EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    function mbuHelpHtml(name, label) {
      return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener" aria-label="Help" data-tip="Help: open the README in a new tab">' + (label || MBU_HELP_ICON) + "</a>";
    }
    function mbuHelpEl(name, label) {
      var a = document.createElement("a");
      a.className = "mbu-help";
      a.href = mbuHelpHref(name);
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", "Help");
      a.dataset.tip = "Help: open the README in a new tab";
      if (label) a.textContent = label;
      else a.innerHTML = MBU_HELP_ICON;
      return a;
    }
    var MBU_CFG_ICON = "\u2699\uFE0E";
    var _mbuTT;
    function mbuHtml(s) {
      if (_mbuTT === void 0) {
        _mbuTT = null;
        try {
          var tt = typeof window !== "undefined" && window.trustedTypes || null;
          if (tt && tt.createPolicy) _mbuTT = tt.createPolicy("mbu-" + Math.random().toString(36).slice(2, 8), { createHTML: function(x) {
            return x;
          } });
        } catch (e) {
        }
      }
      return _mbuTT ? _mbuTT.createHTML(String(s)) : String(s);
    }
    function mbuStartupInfo(name) {
      var g = null;
      try {
        g = typeof GM_info !== "undefined" && GM_info || null;
      } catch (e) {
      }
      var s = g && g.script || {}, p = g && g.platform || {};
      var host = String(s.name || "").replace(/\*$/, ""), ver = s.version || "?";
      var line = !name ? (host || "Script") + " v" + ver : host && host !== name ? name + " (" + host + " v" + ver + ")" : name + " v" + ver;
      if (g) line += " \xB7 " + (g.scriptHandler || "unknown manager") + (g.version ? " " + g.version : "");
      if (p.browserName) line += " \xB7 " + p.browserName + (p.browserVersion ? " " + p.browserVersion : "") + (p.os ? " (" + p.os + ")" : "");
      else {
        try {
          line += " \xB7 " + navigator.userAgent;
        } catch (e) {
        }
      }
      try {
        if (/(^|\.)musicbrainz\.(org|eu)$/i.test(location.hostname)) {
          var lang = document.documentElement && document.documentElement.lang || (document.cookie.match(/(?:^|;\s*)lang=([^;]+)/) || [])[1] || "en";
          line += " \xB7 MusicBrainz in " + lang;
        }
      } catch (e) {
      }
      return line;
    }
    function mbuClaimVer(v) {
      return String(v || "").split(".").map(function(n) {
        return parseInt(n, 10) || 0;
      });
    }
    function mbuClaimCmp(a, b) {
      var x = mbuClaimVer(a), y = mbuClaimVer(b);
      for (var i = 0; i < Math.max(x.length, y.length); i++) {
        var d = (x[i] || 0) - (y[i] || 0);
        if (d) return d < 0 ? -1 : 1;
      }
      return 0;
    }
    function mbuClaim(key, label) {
      var info = typeof GM_info !== "undefined" && GM_info && GM_info.script || {};
      var name = String(info.name || label || key), ver = String(info.version || "0");
      var mine = (name.slice(-1) === "*" ? "String Theory" : "standalone") + " v" + ver;
      var root = document.documentElement, attr = "data-mbu-run-" + key, ev = "mbu-claim-" + key, noteKey = "mbu-newer-" + key;
      var log2 = function(msg) {
        try {
          if (typeof mbuLog !== "undefined" && mbuLog.active) mbuLog.active.info(msg);
          else if (typeof mbuToast !== "undefined" && typeof mbuToast.log === "function") mbuToast.log("info", msg);
          else console.info("[" + (label || key) + "] " + msg);
        } catch (e) {
        }
      };
      var note = null;
      try {
        note = JSON.parse(localStorage.getItem(noteKey) || "null");
      } catch (e) {
      }
      var noteCmp = note ? mbuClaimCmp(note.ver, ver) : 1;
      if (noteCmp < 0) {
        try {
          localStorage.removeItem(noteKey);
        } catch (e) {
        }
      }
      if (noteCmp <= 0) note = null;
      var held = root && root.getAttribute(attr);
      var off = function(why) {
        try {
          if (root) root.setAttribute(attr + "-off", JSON.stringify({ mine, why }));
        } catch (e) {
        }
        try {
          document.dispatchEvent(new CustomEvent(ev, { detail: JSON.stringify({ mine, ver, why }) }));
        } catch (e) {
        }
        return false;
      };
      if (held) {
        var heldVer = root.getAttribute(attr + "-ver") || "0";
        if (mbuClaimCmp(ver, heldVer) > 0) {
          try {
            localStorage.setItem(noteKey, JSON.stringify({ ver, mine, at: Date.now() }));
          } catch (e) {
          }
          return off("newer, from the next page load");
        }
        return off("older or the same");
      }
      if (note) {
        var watch = function() {
          setTimeout(function() {
            if (root.getAttribute(attr)) return;
            try {
              localStorage.removeItem(noteKey);
            } catch (e) {
            }
            try {
              console.info("[" + (label || key) + "] the newer copy (" + note.mine + ") did not start: this copy runs again from the next page load");
            } catch (e) {
            }
          }, 3e3);
        };
        if (document.readyState === "complete") watch();
        else window.addEventListener("load", watch, { once: true });
        return off("older: a newer copy runs");
      }
      if (root) {
        root.setAttribute(attr, mine);
        root.setAttribute(attr + "-ver", ver);
      }
      var told = function(o) {
        log2((label || key) + " is installed twice: " + mine + " runs, " + (o.mine || "another copy") + " is switched off" + (o.why === "newer, from the next page load" ? " for this page (it is newer and runs from the next page load)" : "") + ".");
      };
      document.addEventListener(ev, function(e) {
        var o = {};
        try {
          o = JSON.parse(e.detail);
        } catch (x) {
        }
        told(o);
      });
      var before = root && root.getAttribute(attr + "-off");
      if (before) setTimeout(function() {
        var o = {};
        try {
          o = JSON.parse(before);
        } catch (x) {
        }
        told(o);
      }, 0);
      return true;
    }
    var _mbuToastT = null;
    function mbuToast(msg, opts) {
      opts = opts || {};
      var s = String(msg);
      var kind = opts.kind || (/^\s*[⚠✗×]/.test(s) ? "warn" : /[✓✅]/.test(s) ? "ok" : "info");
      try {
        if (typeof mbuToast.log === "function") mbuToast.log(kind, s.replace(/^\s*[⚠✗×✓✅]\s*/, ""));
      } catch (e) {
      }
      var el = document.getElementById("mbu-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "mbu-toast";
        (document.body || document.documentElement).appendChild(el);
      }
      el.className = "mbu-toast-on" + (kind !== "info" ? " mbu-toast-" + kind : "") + (opts.action ? " mbu-toast-act" : "");
      el.textContent = s;
      if (opts.action) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "mbu-toast-btn";
        b.textContent = opts.action.label || "OK";
        b.onclick = function() {
          try {
            if (opts.action.onClick) opts.action.onClick(b);
          } catch (e) {
          }
          clearTimeout(_mbuToastT);
          _mbuToastT = setTimeout(function() {
            el.className = "";
          }, 900);
        };
        el.appendChild(b);
      }
      if (opts.at) {
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, opts.at.x - w / 2)) + "px";
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, opts.at.y - h - 10)) + "px";
        el.style.bottom = "auto";
        el.style.transform = "none";
      } else {
        el.style.left = "";
        el.style.top = "";
        el.style.bottom = "";
        el.style.transform = "";
      }
      clearTimeout(_mbuToastT);
      _mbuToastT = setTimeout(function() {
        el.className = "";
      }, opts.ms || (opts.action ? 12e3 : 2600));
      return el;
    }
    function mbuCfgDrag(el) {
      el.classList.add("mbu-cfg-drag");
      el.addEventListener("pointerdown", function(e) {
        var h = e.target.closest(".mbu-cfg-h");
        if (e.button || !h || !el.contains(h) || e.target.closest("button,a,input,select,label")) return;
        var b = el.getBoundingClientRect();
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
        el.style.transform = "none";
        el.style.right = "auto";
        el.style.bottom = "auto";
        var cs = getComputedStyle(el), a = el.getBoundingClientRect();
        var l0 = (parseFloat(cs.left) || 0) + b.left - a.left, t0 = (parseFloat(cs.top) || 0) + b.top - a.top;
        el.style.left = l0 + "px";
        el.style.top = t0 + "px";
        var x0 = e.clientX, y0 = e.clientY;
        var mv = function(ev) {
          var dx = Math.max(-b.left, Math.min(window.innerWidth - 80 - b.left, ev.clientX - x0));
          var dy = Math.max(-b.top, Math.min(window.innerHeight - 40 - b.top, ev.clientY - y0));
          el.style.left = l0 + dx + "px";
          el.style.top = t0 + dy + "px";
        };
        var up = function() {
          window.removeEventListener("pointermove", mv);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
        e.preventDefault();
      });
    }
    function mbuCfgHeader(o) {
      o = o || {};
      var esc = function(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function(c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
      };
      var html = '<div class="mbu-cfg-h">';
      if (o.icon) html += '<span class="mbu-cfg-ic">' + o.icon + "</span>";
      html += '<span class="mbu-cfg-name">' + esc(o.name) + "</span>";
      if (o.version) html += '<span class="mbu-cfg-ver" data-tip="The installed version">v' + esc(o.version) + "</span>";
      html += '<span class="mbu-cfg-sp"></span>';
      if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? " " + esc(o.logClass) : "") + '"' + (o.logId ? ' id="' + esc(o.logId) + '"' : "") + ' data-tip="Open the activity log">Log</button>';
      }
      html += mbuHelpHtml(o.script);
      return html + "</div>";
    }
    function mbuControls(root) {
      if (!root || !root.querySelectorAll) return root;
      Array.prototype.forEach.call(root.querySelectorAll("select"), function(s) {
        s.classList.add("mbu-select");
      });
      Array.prototype.forEach.call(root.querySelectorAll("input[type=number]"), function(inp) {
        var p = inp.parentNode;
        if (!p || p.classList && p.classList.contains("mbu-step")) return;
        var wrap = document.createElement("span");
        wrap.className = "mbu-step";
        p.insertBefore(wrap, inp);
        var btn = function(down) {
          var b = document.createElement("button");
          b.type = "button";
          b.tabIndex = -1;
          b.textContent = down ? "\u2212" : "+";
          b.setAttribute("aria-label", down ? "Less" : "More");
          b.addEventListener("click", function(e) {
            e.preventDefault();
            if (inp.disabled || inp.readOnly) return;
            var was = inp.value;
            try {
              if (down) inp.stepDown();
              else inp.stepUp();
            } catch (x) {
              return;
            }
            if (inp.value === was) return;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          });
          return b;
        };
        wrap.appendChild(btn(true));
        wrap.appendChild(inp);
        wrap.appendChild(btn(false));
        inp.style.width = Math.max(2, String(inp.max || inp.value || "").length) + 0.5 + "ch";
      });
      return root;
    }
    function mbuTestHooks() {
      try {
        return typeof window !== "undefined" && window.__mbuTest === true;
      } catch (e) {
        return false;
      }
    }
    function mbuShared(key, value) {
      var k = "mbu." + key;
      try {
        if (arguments.length < 2) {
          var v = localStorage.getItem(k);
          return v == null ? void 0 : JSON.parse(v);
        }
        if (value == null) localStorage.removeItem(k);
        else localStorage.setItem(k, JSON.stringify(value));
      } catch (e) {
      }
      return value;
    }
    var MBU_DOCK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M64 10 L66.4 10.2 L68.7 10.6 L70.9 11.4 L73.1 12.4 L75.2 13.7 L77.1 15.2 L78.8 17 L80.4 18.9 L81.8 21 L83.1 23.1 L84.1 25.4 L85 27.6 L85.7 29.9 L86.3 32.1 L86.8 34.3 L87.1 36.4 L87.4 38.4 L87.7 40.3 L87.9 42.1 L88.2 43.7 L88.5 45.2 L88.9 46.6 L89.4 47.8 L90 49 L90.7 50.1 L91.6 51.1 L92.6 52.2 L93.7 53.2 L95 54.2 L96.4 55.3 L97.9 56.5 L99.5 57.7 L101.1 59.1 L102.7 60.6 L104.4 62.2 L106 64 L107.5 65.9 L108.9 67.9 L110.2 70.1 L111.3 72.3 L112.1 74.7 L112.8 77.1 L113.1 79.5 L113.2 81.9 L113 84.3 L112.6 86.6 L111.8 88.9 L110.8 91 L109.5 93 L107.9 94.7 L106.1 96.3 L104.1 97.7 L102 98.8 L99.7 99.7 L97.3 100.4 L94.9 100.8 L92.4 101 L89.9 100.9 L87.4 100.7 L85 100.4 L82.7 99.9 L80.4 99.3 L78.3 98.6 L76.3 97.8 L74.4 97.1 L72.7 96.4 L71 95.7 L69.5 95.1 L68 94.6 L66.7 94.3 L65.3 94.1 L64 94 L62.7 94.1 L61.3 94.3 L60 94.6 L58.5 95.1 L57 95.7 L55.3 96.4 L53.6 97.1 L51.7 97.8 L49.7 98.6 L47.6 99.3 L45.3 99.9 L43 100.4 L40.6 100.7 L38.1 100.9 L35.6 101 L33.1 100.8 L30.7 100.4 L28.3 99.7 L26 98.8 L23.9 97.7 L21.9 96.3 L20.1 94.7 L18.5 93 L17.2 91 L16.2 88.9 L15.4 86.6 L15 84.3 L14.8 81.9 L14.9 79.5 L15.2 77.1 L15.9 74.7 L16.7 72.3 L17.8 70.1 L19.1 67.9 L20.5 65.9 L22 64 L23.6 62.2 L25.3 60.6 L26.9 59.1 L28.5 57.7 L30.1 56.5 L31.6 55.3 L33 54.2 L34.3 53.2 L35.4 52.2 L36.4 51.1 L37.3 50.1 L38 49 L38.6 47.8 L39.1 46.6 L39.5 45.2 L39.8 43.7 L40.1 42.1 L40.3 40.3 L40.6 38.4 L40.9 36.4 L41.2 34.3 L41.7 32.1 L42.3 29.9 L43 27.6 L43.9 25.4 L44.9 23.1 L46.2 21 L47.6 18.9 L49.2 17 L50.9 15.2 L52.8 13.7 L54.9 12.4 L57.1 11.4 L59.3 10.6 L61.6 10.2Z" fill="none" stroke="#9c86ea" stroke-width="10" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#6c47e0" stroke-width="13" stroke-linejoin="round"/> </svg>';
    function mbuDock() {
      var root = document.documentElement, on = root.hasAttribute("data-mbu-dock");
      var btn = document.getElementById("mbu-dock");
      var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="br"]')).filter(function(el) {
        return el.id !== "mbu-dock" && el.dataset.mbCornerDock !== "no";
      });
      if (!document.getElementById("mbu-dock-css")) {
        var css = document.createElement("style");
        css.id = "mbu-dock-css";
        css.textContent = '[data-mbu-docked]{z-index:2147482990!important}[data-mbu-docked=hide],[data-mbu-docked=off],:root:not([data-mbu-dock]) [data-mb-corner-dock=only]{display:none!important}.mbu-dock-item{position:fixed;z-index:2147482990;width:40px;height:40px;border:0;border-radius:50%;padding:3px;background:none;box-shadow:none;cursor:pointer;opacity:.85;transition:transform .12s,opacity .12s}.mbu-dock-item:hover{opacity:1;transform:scale(1.08)}.mbu-dock-item img{width:34px;height:34px;display:block;pointer-events:none}.mbu-dock-win{position:fixed;z-index:2147483002;right:62px;bottom:6px;width:max-content;max-width:calc(100vw - 90px);max-height:75vh;overflow:auto;box-sizing:border-box;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}.mbu-dock-win>*{margin:0!important}:root[data-mbu-flow=row] .mbu-dock-win{right:6px;bottom:60px}:root[data-mbu-side=left] .mbu-dock-win{right:auto;left:62px}:root[data-mbu-side=left][data-mbu-flow=row] .mbu-dock-win{left:6px}#mbu-dock{position:fixed;z-index:2147482991;width:40px;height:40px;border-radius:50%;border:0;padding:0;cursor:pointer;background:none;box-shadow:none;opacity:.85;transition:transform .12s,opacity .12s}#mbu-dock svg{width:34px;height:34px;display:block;margin:auto;pointer-events:none}#mbu-dock:hover{opacity:1;transform:scale(1.08)}:root[data-mbu-dock-open] #mbu-dock{opacity:1}#mbu-dock:focus-visible{outline:2px solid #ba478f;outline-offset:2px}#mbu-dock b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center}.mbu-dock-item,#mbu-dock{filter:none!important}[data-mbu-docked=peek]{transform:scale(.8)}[data-mbu-docked=peek]:hover{transform:scale(.9)}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status]::after{content:attr(data-mb-corner-status);position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center;white-space:nowrap;text-shadow:none;-webkit-font-smoothing:antialiased;pointer-events:none}:is([data-mbu-docked=show],[data-mbu-docked=peek]):hover::after{opacity:1}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status^="\u2713"]::after{content:"";top:0;right:0;min-width:0;width:10px;height:10px;padding:0;border:2px solid #fff;border-radius:50%;background:#4cbf7a}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status^="0/"]::after{border:1.5px dashed #999;background:#f0f0f0;color:#888}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy]::after{background:#f3eff7;border-color:#d6cde2;color:#9a8fae;letter-spacing:1px;animation:mbu-dock-fade 1.2s ease-in-out infinite}@keyframes mbu-dock-fade{50%{opacity:.25}}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy][data-mb-corner-status="\xB7\xB7\xB7"]::after{content:none}.mbu-dock-dots{display:none;position:absolute;top:0;right:-6px;gap:3px;pointer-events:none}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy][data-mb-corner-status="\xB7\xB7\xB7"] .mbu-dock-dots{display:flex}.mbu-dock-dots i{width:5px;height:5px;border-radius:50%;background:#e05aa5;animation:mbu-dock-dot 1.2s ease-in-out infinite}.mbu-dock-dots i:nth-child(2){animation-delay:.2s}.mbu-dock-dots i:nth-child(3){animation-delay:.4s}@keyframes mbu-dock-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}@media (prefers-reduced-motion:reduce){[data-mbu-busy]::after,.mbu-dock-dots i{animation:none!important}}';
        root.appendChild(css);
      }
      if (!on) {
        els.forEach(function(el) {
          el.removeAttribute("data-mbu-docked");
        });
        if (btn) btn.remove();
        return;
      }
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.id = "mbu-dock";
        btn.setAttribute("aria-label", "String Theory");
        btn.dataset.mbCorner = "br";
        btn.dataset.mbCornerOrder = "-1";
        btn.onclick = function() {
          var open2 = root.hasAttribute("data-mbu-dock-hover") || !root.hasAttribute("data-mbu-dock-open");
          root.removeAttribute("data-mbu-dock-hover");
          root.toggleAttribute("data-mbu-dock-open", open2);
          mbuShared("dockOpen", open2 || null);
          mbRestackCorner("br");
        };
        var leaveT = 0;
        var inDock = function(t) {
          return !!(t && t.closest && t.closest("#mbu-dock,[data-mbu-docked],.mbu-dock-win,#mbu-tip"));
        };
        btn.addEventListener("mouseenter", function() {
          clearTimeout(leaveT);
          if (root.hasAttribute("data-mbu-dock-open")) return;
          root.setAttribute("data-mbu-dock-hover", "");
          root.setAttribute("data-mbu-dock-open", "");
          mbRestackCorner("br");
        });
        document.addEventListener("mouseover", function(e) {
          if (!root.hasAttribute("data-mbu-dock-hover")) return;
          clearTimeout(leaveT);
          if (inDock(e.target)) return;
          leaveT = setTimeout(function() {
            if (!root.hasAttribute("data-mbu-dock-hover")) return;
            root.removeAttribute("data-mbu-dock-hover");
            root.removeAttribute("data-mbu-dock-open");
            mbRestackCorner("br");
          }, 400);
        }, true);
        root.appendChild(btn);
        root.toggleAttribute("data-mbu-dock-open", !!mbuShared("dockOpen"));
      }
      var open = root.hasAttribute("data-mbu-dock-open"), n = 0;
      if (mbuShared("cornerFlow") === "row") root.setAttribute("data-mbu-flow", "row");
      else root.removeAttribute("data-mbu-flow");
      if (mbuShared("cornerSide") === "left") root.setAttribute("data-mbu-side", "left");
      else root.removeAttribute("data-mbu-side");
      els.forEach(function(el) {
        if (el.dataset.mbCornerDock === "hide" || el.dataset.mbCornerPaths && !new RegExp(el.dataset.mbCornerPaths).test(location.pathname)) {
          el.setAttribute("data-mbu-docked", "off");
          return;
        }
        var was = el.getAttribute("data-mbu-docked");
        el.removeAttribute("data-mbu-docked");
        var shown = getComputedStyle(el).display !== "none";
        if (shown) n++;
        el.setAttribute("data-mbu-docked", !shown ? "hide" : open ? "show" : /^[+]?[1-9]/.test(el.dataset.mbCornerStatus || "") ? "peek" : "hide");
        if (was !== "peek" && el.getAttribute("data-mbu-docked") === "peek" && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: "ease-out" });
      });
      btn.innerHTML = MBU_DOCK_ICON + (n ? "<b>" + n + "</b>" : "");
    }
    function mbuDockItem(o) {
      var b = document.getElementById(o.id);
      if (!b) {
        b = document.createElement("button");
        b.type = "button";
        b.id = o.id;
        b.className = "mbu-dock-item";
        b.dataset.mbCorner = "br";
        b.dataset.mbCornerOrder = String(o.order || 60);
        b.dataset.mbCornerDock = "only";
        if (o.paths) b.dataset.mbCornerPaths = o.paths;
        var img = document.createElement("img");
        img.src = o.icon;
        img.alt = "";
        b.appendChild(img);
        var dots = document.createElement("span");
        dots.className = "mbu-dock-dots";
        dots.innerHTML = "<i></i><i></i><i></i>";
        b.appendChild(dots);
        b.onclick = o.click;
        document.documentElement.appendChild(b);
      }
      b.dataset.mbCornerLabel = o.label;
      var show = function() {
        var t = b.mbuSt || (b.hasAttribute("data-mbu-busy") ? "\xB7\xB7\xB7" : "");
        if (t) b.dataset.mbCornerStatus = t;
        else delete b.dataset.mbCornerStatus;
        var r = document.documentElement;
        if (r.hasAttribute("data-mbu-dock") && !r.hasAttribute("data-mbu-dock-open") && b.isConnected) mbRestackCorner("br");
      };
      b.status = function(t) {
        b.mbuSt = t || "";
        show();
      };
      b.busy = function(on) {
        if (on) b.dataset.mbuBusy = "";
        else delete b.dataset.mbuBusy;
        show();
      };
      b.card = function(fn) {
        if (typeof mbuTip === "function") mbuTip(b, fn || null, { card: true });
      };
      if (o.scale) b.querySelector("img").style.transform = "scale(" + o.scale + ")";
      b.status("");
      mbRestackCorner("br");
      return b;
    }
    function mbRestackCorner(corner) {
      if (corner === "br") mbuDock();
      var bottom = corner[0] === "b", right = corner[1] === "r" !== (mbuShared("cornerSide") === "left");
      var row = mbuShared("cornerFlow") === "row";
      var vv = window.visualViewport, gapX = 0, gapY = 0;
      if (vv) {
        gapX = Math.max(0, right ? document.documentElement.clientWidth - vv.offsetLeft - vv.width : vv.offsetLeft);
        gapY = Math.max(0, bottom ? window.innerHeight - vv.offsetTop - vv.height : vv.offsetTop);
        var root = document.documentElement;
        if (!root.hasAttribute("data-mb-corner-vv")) {
          root.setAttribute("data-mb-corner-vv", "");
          var queued = false;
          var again = function() {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function() {
              queued = false;
              ["br", "bl", "tr", "tl"].forEach(function(c) {
                if (document.querySelector('[data-mb-corner="' + c + '"]')) mbRestackCorner(c);
              });
            });
          };
          vv.addEventListener("resize", again);
          vv.addEventListener("scroll", again);
          window.addEventListener("resize", again);
          if (window.ResizeObserver && document.body) new window.ResizeObserver(again).observe(document.body);
        }
      }
      var edge = document.documentElement.hasAttribute("data-mbu-dock") ? 6 : 14;
      var peeks = [];
      var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]')).filter(function(el) {
        return !el.hidden && getComputedStyle(el).display !== "none";
      }).filter(function(el) {
        if (el.getAttribute("data-mbu-docked") !== "peek") return true;
        peeks.push(el);
        return false;
      }).sort(function(a, b) {
        return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0);
      });
      var pos = edge;
      els.forEach(function(el) {
        var r = el.getBoundingClientRect();
        el.style[bottom ? "bottom" : "top"] = gapY + (row ? edge : pos) + "px";
        el.style[right ? "right" : "left"] = gapX + (row ? pos : edge) + "px";
        el.style[right ? "left" : "right"] = "auto";
        pos += (row ? r.width : r.height) + 8;
      });
      var side = edge + 40 + 4;
      peeks.sort(function(a, b) {
        return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0);
      }).forEach(function(el) {
        el.style[bottom ? "bottom" : "top"] = gapY + (row ? edge : side) + "px";
        el.style[right ? "right" : "left"] = gapX + (row ? side : edge) + "px";
        el.style[right ? "left" : "right"] = "auto";
        side += 36;
      });
    }
    function mbuLog(o) {
      o = o || {};
      var max = o.max || 2e4, buf = [], dropped = 0, warn = 0, error = 0, views = [], bound = {};
      var LEVELS = ["error", "warn", "info", "debug"];
      var group = function(sev) {
        return sev === "ok" ? "info" : sev;
      };
      var pad = function(n, w) {
        return String(n).padStart(w || 2, "0");
      };
      var ts = function(d) {
        return d ? pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + "." + pad(d.getMilliseconds(), 3) : "--:--:--.---";
      };
      var str = function(v) {
        if (typeof v === "string") return v;
        if (v instanceof Error) return v.message || String(v);
        if (v && v.nodeType) return "<" + (v.tagName || "node").toLowerCase() + ">";
        try {
          return typeof v === "object" ? JSON.stringify(v) : String(v);
        } catch (e) {
          return String(v);
        }
      };
      var esc = function(s) {
        return String(s).replace(/[&<>"]/g, function(c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
      };
      var linkify = function(s) {
        return esc(s).replace(/(https?:\/\/[^\s<]+)/g, function(m) {
          var t = (m.match(/[.,;:!?)\]]+$/) || [""])[0];
          var url = m.slice(0, m.length - t.length);
          return '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>" + t;
        });
      };
      var load = o.load || function(k) {
        try {
          return GM_getValue(k, void 0);
        } catch (e) {
          return void 0;
        }
      };
      var save = o.save || function(k, v) {
        try {
          GM_setValue(k, v);
        } catch (e) {
        }
      };
      var state = function() {
        try {
          return JSON.parse(load(o.key) || "{}") || {};
        } catch (e) {
          return {};
        }
      };
      var remember = function(patch) {
        try {
          save(o.key, JSON.stringify(Object.assign(state(), patch)));
        } catch (e) {
        }
      };
      var dbgOn = null;
      var debugOn = function() {
        if (dbgOn === null) dbgOn = state().debug === true;
        return dbgOn;
      };
      var setDebug = function(v) {
        dbgOn = !!v;
        remember({ debug: dbgOn });
        views.forEach(function(w) {
          if (w.dbg) w.dbg.checked = dbgOn;
        });
      };
      var tally = function(e, d) {
        if (e.sev === "warn") warn += d;
        else if (e.sev === "error") error += d;
      };
      var PRE = { info: "", ok: "OK   ", warn: "WARN ", error: "ERR  ", debug: "DBG  " };
      var line = function(e) {
        return ts(e.t) + "  " + (PRE[e.sev] || "") + (e.cat ? "[" + e.cat + "] " : "") + (e.pre ? "\n" : "") + e.msg;
      };
      var countOf = function(list) {
        var c = { warn: 0, error: 0 };
        list.forEach(function(e) {
          if (e.sev === "warn") c.warn++;
          else if (e.sev === "error") c.error++;
        });
        return c;
      };
      var H = o.history || null, hp = H && (H.prefix || (o.key || "mbu") + ":session:");
      var ID_RE = /^\d{14}-\d+$/, sid = "", kept = false, sname = "", savedName = "", seq = 0, pTimer = 0, lastSaved = "";
      var store = H && (H.store || {
        get: function(k) {
          try {
            return localStorage.getItem(k);
          } catch (e) {
            return null;
          }
        },
        set: function(k, v) {
          try {
            localStorage.setItem(k, v);
          } catch (e) {
          }
        },
        del: function(k) {
          try {
            localStorage.removeItem(k);
          } catch (e) {
          }
        },
        // one call for all the keys: a userscript reaches localStorage through Firefox's
        // Xray wrapper, where each call costs, and the page may hold hundreds of keys
        keys: function() {
          try {
            var all = Object.keys(localStorage);
            if (all.length === localStorage.length) return all;
          } catch (e) {
          }
          var out = [];
          try {
            for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
          } catch (e) {
          }
          return out;
        }
      });
      var keepN = function() {
        return 10;
      };
      var newId = function() {
        return (/* @__PURE__ */ new Date()).toISOString().replace(/[^0-9]/g, "").slice(0, 14) + "-" + ++seq;
      };
      var idDate = function(id) {
        var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/.exec(id || "");
        return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
      };
      function ids() {
        if (!H) return [];
        return store.keys().filter(function(k) {
          return k && k.indexOf(hp) === 0 && ID_RE.test(k.slice(hp.length));
        }).map(function(k) {
          return k.slice(hp.length);
        }).sort();
      }
      function fromStored(x, id) {
        if (typeof x === "string") {
          var p = null;
          try {
            p = H.parse ? H.parse(x, idDate(id)) : null;
          } catch (e2) {
          }
          return p ? { t: p.t || null, sev: p.sev || "info", cat: p.cat || "", msg: String(p.msg == null ? x : p.msg), pre: !!p.pre } : { t: null, sev: "info", msg: x };
        }
        if (!Array.isArray(x)) return null;
        var e = { t: x[0] != null ? new Date(x[0]) : null, sev: x[1] || "info", msg: String(x[3] == null ? "" : x[3]) };
        if (x[2]) e.cat = String(x[2]);
        if (x[4]) e.pre = true;
        return e;
      }
      function loadSession(id) {
        if (!H || !id) return null;
        var raw = store.get(hp + id);
        if (raw == null) return null;
        try {
          return (JSON.parse(raw) || []).map(function(x) {
            return fromStored(x, id);
          }).filter(Boolean);
        } catch (e) {
          return null;
        }
      }
      var names = {};
      function nameOf(id, entries) {
        if (id in names) return names[id];
        var n = store.get(hp + id + ":name");
        if (!n) {
          try {
            n = H.nameOf ? H.nameOf(entries || loadSession(id) || []) || "" : "";
          } catch (e) {
            n = "";
          }
        }
        return names[id] = n || "";
      }
      function storedWindow() {
        var cap = H.lines || 400, head = Math.min(H.head || 140, cap - 2);
        var pack = function(e) {
          return [e.t ? e.t.getTime() : null, e.sev, e.cat || 0, e.msg, e.pre ? 1 : 0];
        };
        if (buf.length <= cap) return buf.map(pack);
        var tail = cap - head - 1, cut = buf.length - head - tail;
        return buf.slice(0, head).map(pack).concat([[null, "info", 0, "\u2014\u2014\u2014 " + cut + " line(s) from the middle of this session were dropped to fit the stored-log budget; its start and end are kept in full \u2014\u2014\u2014", 0]]).concat(buf.slice(-tail).map(pack));
      }
      function flush() {
        clearTimeout(pTimer);
        pTimer = 0;
        if (!H || !sid || !kept) return;
        try {
          var payload = JSON.stringify(storedWindow());
          if (payload === lastSaved) return;
          lastSaved = payload;
          store.set(hp + sid, payload);
          if (sname && savedName !== sname) {
            store.set(hp + sid + ":name", sname);
            savedName = sname;
          }
        } catch (e) {
        }
      }
      var persist = function() {
        if (H && kept && !pTimer) pTimer = setTimeout(flush, 100);
      };
      function forget(id) {
        if (H && id) {
          store.del(hp + id);
          store.del(hp + id + ":name");
          delete names[id];
        }
      }
      function prune() {
        var all = ids().filter(function(id) {
          return id !== sid;
        });
        var excess = all.length + (kept ? 1 : 0) - keepN();
        if (excess > 0) all.slice(0, excess).forEach(forget);
      }
      function sessions() {
        return ids().filter(function(id) {
          return id !== sid;
        }).reverse().map(function(id) {
          return { id, date: idDate(id), name: nameOf(id) };
        });
      }
      var sessionLabel = function(s) {
        var d = s.date, when = d ? d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) : s.id;
        return when + (s.name ? " \u2014 " + s.name : "");
      };
      function startSession() {
        flush();
        sid = newId();
        kept = false;
        sname = "";
        savedName = "";
        lastSaved = "";
        reset();
      }
      function resume(id) {
        var entries = loadSession(id);
        if (!entries) return false;
        flush();
        reset();
        sid = id;
        kept = true;
        sname = savedName = store.get(hp + id + ":name") || "";
        lastSaved = store.get(hp + id) || "";
        store.set(hp + "current", sid);
        entries.forEach(function(e) {
          push(e);
        });
        return true;
      }
      function reset() {
        buf = [];
        dropped = 0;
        warn = 0;
        error = 0;
        views.forEach(function(v) {
          if (!v.past) v.show(null);
          v.sessions();
        });
      }
      function push(e) {
        buf.push(e);
        tally(e, 1);
        if (buf.length > max + Math.ceil(max / 10)) {
          var gone = buf.splice(0, buf.length - max);
          gone.forEach(function(g) {
            tally(g, -1);
          });
          dropped += gone.length;
        }
        views = views.filter(function(v) {
          return v.el.isConnected;
        });
        views.forEach(function(v) {
          if (!v.past) v.append(e);
        });
      }
      function add(sev, args, cat, pre) {
        var msg = Array.prototype.map.call(args, str).join(" ");
        msg = pre ? msg.replace(/\s+$/, "") : msg.replace(/\s+/g, " ").trim();
        if (!msg) return;
        var e = { t: /* @__PURE__ */ new Date(), sev: sev === "err" ? "error" : sev, msg };
        if (e.sev === "debug" && !debugOn()) return;
        if (cat) e.cat = String(cat);
        if (pre) e.pre = true;
        push(e);
        persist();
      }
      function title(bare) {
        var v = typeof o.version === "function" ? (function() {
          try {
            return o.version();
          } catch (e) {
            return "";
          }
        })() : o.version;
        var t = (o.name || "Log") + (v ? " v" + v : "");
        try {
          var s = !bare && o.subtitle && o.subtitle();
          if (s) t += " \u2014 " + s;
        } catch (e) {
        }
        return t;
      }
      function markdown(past) {
        var list = past ? past.entries : buf, c = past ? countOf(list) : { warn, error };
        var body = list.length ? list.map(line).join("\n") : "(no activity logged)";
        if (!past && dropped) body = "(" + dropped + " earlier line" + (dropped === 1 ? "" : "s") + " not kept)\n" + body;
        var n = c.warn || c.error ? " (" + c.warn + " warning" + (c.warn === 1 ? "" : "s") + ", " + c.error + " error" + (c.error === 1 ? "" : "s") + ")" : "";
        var what = past ? "log of " + sessionLabel({ id: past.id, date: idDate(past.id), name: nameOf(past.id, list) }) : "session log";
        var fence = String.fromCharCode(96, 96, 96);
        return "<details><summary>" + title(!!past) + " \u2014 " + what + n + "</summary>\n\n" + fence + "log\n" + body + "\n" + fence + "\n\n</details>";
      }
      function copy(btn, past) {
        var md = markdown(past);
        var done = function(ok) {
          if (!btn) return;
          var was = btn.dataset.lbl || btn.textContent;
          btn.dataset.lbl = was;
          btn.textContent = ok ? "Copied \u2713" : "Copy failed";
          setTimeout(function() {
            btn.textContent = was;
          }, 1500);
        };
        var fallback = function() {
          var ok = false;
          try {
            var ta = document.createElement("textarea");
            ta.value = md;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand("copy");
            ta.remove();
          } catch (x) {
          }
          done(ok);
        };
        try {
          navigator.clipboard.writeText(md).then(function() {
            done(true);
          }, fallback);
        } catch (e) {
          fallback();
        }
      }
      var vseq = 0;
      function view(root, floating, tools) {
        var vid = String(++vseq);
        root.classList.add("mbu-logpop");
        root.dataset.mbuLv = vid;
        root.innerHTML = mbuHtml('<div class="mbu-logpop-h">' + (floating ? "<b>" + esc(o.header || "Activity log") + "</b> " : "") + '<span class="mbu-log-badge"></span><input class="mbu-log-q" type="search" placeholder="Filter" data-tip="Show only the lines with this text\nEsc: empty the box" autocomplete="off">' + (H ? '<select class="mbu-log-ses mbu-select" data-tip="The session shown\nThis one, or a past one kept in this browser"></select>' : "") + '<span class="mbu-logpop-sp"></span>' + (H ? '<button class="mbu-logpop-hclear" type="button" data-tip="Delete every past session\nThis one stays">Clear history</button>' : "") + '<label class="mbu-log-dbg" data-tip="Record each step in detail\nLeave it on when reporting a problem"><input type="checkbox"> debug</label><button class="mbu-logpop-clear" type="button" data-tip="Clear the log\nThe lines so far are gone">Clear</button><button class="mbu-logpop-copy" type="button" data-tip="Copy the whole log as Markdown\nReady to paste into a GitHub issue">\u29C9 Copy</button>' + (floating ? '<button class="mbu-logpop-full" type="button" data-tip="Full screen\nDouble-click: the title bar does the same">\u26F6</button><button class="mbu-logpop-min" type="button" data-tip="Minimize">\u2013</button><button class="mbu-logpop-x" type="button" data-tip="Close">\u2715</button>' : "") + '</div><div class="mbu-log-f" hidden></div><style class="mbu-log-fcss"></style><div class="mbu-log-list"></div>' + (floating ? '<div class="mbu-logpop-grip" data-tip="Resize"></div>' : ""));
        if (tools) root.querySelector(".mbu-logpop-clear").before(tools);
        var list = root.querySelector(".mbu-log-list"), badge = root.querySelector(".mbu-log-badge");
        var qEl = root.querySelector(".mbu-log-q"), q = "", sel = root.querySelector(".mbu-log-ses");
        var fRow = root.querySelector(".mbu-log-f"), fCss = root.querySelector(".mbu-log-fcss");
        var past = null, src = buf, cats = [], catIx = {}, sevs = {}, fSev = null, fCat = null;
        var scope = '.mbu-logpop[data-mbu-lv="' + vid + '"] ';
        var miss = function(e) {
          return !!q && ((e.cat || "") + " " + e.msg).toLowerCase().indexOf(q) < 0;
        };
        var note = function(e) {
          var grew = false;
          if (e.cat && !(e.cat in catIx)) {
            catIx[e.cat] = cats.length;
            cats.push(e.cat);
            grew = true;
          }
          if (!sevs[group(e.sev)]) {
            sevs[group(e.sev)] = true;
            grew = true;
          }
          return grew;
        };
        var row = function(e) {
          var d = document.createElement("div");
          d._e = e;
          d.className = "mbu-log-li mbu-log-" + e.sev + (e.pre ? " mbu-log-pre" : "");
          if (miss(e)) d.classList.add("mbu-log-nq");
          d.dataset.s = group(e.sev);
          if (e.cat) d.dataset.c = catIx[e.cat];
          d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span><span class="mbu-log-c">' + esc(e.cat || "") + '</span><span class="mbu-log-m">' + linkify(e.msg) + "</span>");
          return d;
        };
        var filters = function() {
          var lv = LEVELS.filter(function(l) {
            return sevs[l];
          });
          var showL = lv.length > 1, showC = cats.length > 1;
          if (fSev && !sevs[fSev]) fSev = null;
          if (fCat != null && !(fCat in catIx)) fCat = null;
          var b = function(kind, v2, on) {
            return '<button type="button" class="mbu-log-fb' + (on ? " on" : "") + '" data-' + kind + '="' + esc(v2) + '">' + esc(v2) + "</button>";
          };
          fRow.innerHTML = mbuHtml((showL ? '<span class="mbu-log-fg">' + lv.map(function(l) {
            return b("sev", l, fSev === l);
          }).join("") + "</span>" : "") + (showL && showC ? '<span class="mbu-log-fs"></span>' : "") + (showC ? '<span class="mbu-log-fg">' + cats.map(function(c) {
            return b("cat", c, fCat === c);
          }).join("") + "</span>" : ""));
          fRow.hidden = !showL && !showC;
          list.classList.toggle("mbu-log-cats", cats.length > 0);
          fCss.textContent = (fSev ? scope + '.mbu-log-li:not([data-s="' + fSev + '"]){display:none}' : "") + (fCat != null ? scope + '.mbu-log-li:not([data-c="' + catIx[fCat] + '"]){display:none}' : "");
        };
        var showBadge = function() {
          var c = past ? countOf(src) : { warn, error };
          badge.textContent = "(" + src.length + ")" + (c.warn || c.error ? " \xB7 " + c.warn + "\u26A0 " + c.error + "\u2716" : "");
        };
        var empty = function() {
          return '<div class="mbu-log-empty">' + (past ? "Nothing was kept of this session." : "No activity yet.") + "</div>";
        };
        var queued = false, follow = true;
        var paint = function() {
          queued = false;
          showBadge();
          if (follow) list.scrollTop = list.scrollHeight;
        };
        var draw = function() {
          cats = [];
          catIx = {};
          sevs = {};
          src.forEach(note);
          var frag = document.createDocumentFragment();
          src.forEach(function(e) {
            frag.appendChild(row(e));
          });
          list.innerHTML = mbuHtml(src.length ? "" : empty());
          if (src.length) list.appendChild(frag);
          filters();
          showBadge();
          follow = true;
          list.scrollTop = list.scrollHeight;
          root.classList.toggle("mbu-log-past", !!past);
        };
        list.addEventListener("scroll", function() {
          follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
        });
        var qTimer = 0;
        var refilter = function() {
          q = qEl.value.trim().toLowerCase();
          for (var d = list.firstElementChild; d; d = d.nextElementSibling) if (d._e) d.classList.toggle("mbu-log-nq", miss(d._e));
          follow = true;
          list.scrollTop = list.scrollHeight;
        };
        qEl.addEventListener("input", function() {
          clearTimeout(qTimer);
          qTimer = setTimeout(refilter, 120);
        });
        fRow.addEventListener("click", function(ev) {
          var t = ev.target.closest(".mbu-log-fb");
          if (!t) return;
          if (t.dataset.sev) fSev = fSev === t.dataset.sev ? null : t.dataset.sev;
          else fCat = fCat === t.dataset.cat ? null : t.dataset.cat;
          filters();
          follow = true;
          list.scrollTop = list.scrollHeight;
        });
        var v = {
          el: root,
          floating,
          past: null,
          q: qEl,
          append: function(e) {
            var em = list.querySelector(".mbu-log-empty");
            if (em) em.remove();
            if (note(e)) filters();
            list.appendChild(row(e));
            while (list.childElementCount > buf.length) list.firstElementChild.remove();
            if (!queued) {
              queued = true;
              requestAnimationFrame(paint);
            }
          },
          // null: the live lines; an id: that past session
          show: function(id) {
            var entries = id ? loadSession(id) : null;
            if (id && !entries) entries = [{ t: null, sev: "warn", msg: "This session could not be read (it may have been deleted in another tab)." }];
            past = id && entries ? id : null;
            v.past = past;
            src = past ? entries : buf;
            if (sel && sel.value !== (past || "")) sel.value = past || "";
            draw();
          },
          // the session list, refreshed when it is opened and when a session starts
          sessions: function() {
            if (!sel) return;
            var all = sessions(), sig = all.map(function(x) {
              return x.id + "=" + x.name;
            }).join("|");
            if (sig === v.sig && !(past && !all.some(function(x) {
              return x.id === past;
            }))) return;
            v.sig = sig;
            if (past && !all.some(function(s) {
              return s.id === past;
            })) {
              past = null;
              v.past = null;
              src = buf;
              draw();
            }
            sel.innerHTML = mbuHtml('<option value="">Current session</option>' + all.map(function(s) {
              return '<option value="' + esc(s.id) + '">' + esc(sessionLabel(s)) + "</option>";
            }).join(""));
            sel.value = past || "";
            var hc = root.querySelector(".mbu-logpop-hclear");
            if (hc) hc.disabled = !all.length;
          },
          filters
        };
        if (sel) {
          sel.addEventListener("change", function() {
            v.show(sel.value || null);
          });
          root.querySelector(".mbu-logpop-hclear").onclick = function() {
            clearHistory();
          };
        }
        root.querySelector(".mbu-logpop-clear").onclick = function() {
          clear();
        };
        v.dbg = root.querySelector(".mbu-log-dbg input");
        v.dbg.checked = debugOn();
        v.dbg.onchange = function() {
          setDebug(v.dbg.checked);
        };
        root.querySelector(".mbu-logpop-copy").onclick = function() {
          copy(root.querySelector(".mbu-logpop-copy"), past ? { id: past, entries: src } : null);
        };
        v.sessions();
        draw();
        views.push(v);
        return v;
      }
      var win = null;
      function open() {
        close(true);
        if (typeof o.before === "function") {
          try {
            o.before();
          } catch (e) {
          }
        }
        remember({ open: true });
        var st = state();
        var pop = document.createElement("div");
        pop.id = "mbu-logpop";
        document.body.appendChild(pop);
        var v = view(pop, true);
        if (st.left != null) {
          pop.style.left = st.left;
          pop.style.top = st.top;
          pop.style.right = "auto";
          pop.style.transform = "none";
        }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        var onKey = function(e) {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          if (e.target === v.q && v.q.value) {
            v.q.value = "";
            v.q.dispatchEvent(new Event("input"));
            return;
          }
          close();
        };
        win = { el: pop, v, off: function() {
          window.removeEventListener("keydown", onKey, true);
        } };
        var minBtn = pop.querySelector(".mbu-logpop-min");
        var setMin = function(m) {
          minBtn.textContent = m ? "\u25A2" : "\u2013";
          minBtn.dataset.tip = m ? "Restore" : "Minimize";
          if (m) {
            pop.style.left = "14px";
            pop.style.bottom = "14px";
            pop.style.top = "auto";
            pop.style.right = "auto";
            pop.style.transform = "none";
          } else Object.assign(pop.style, restore);
        };
        var fullBtn = pop.querySelector(".mbu-logpop-full");
        var setFull = function(f) {
          pop.classList.toggle("full", f);
          fullBtn.textContent = f ? "\u2750" : "\u26F6";
          fullBtn.dataset.tip = (f ? "Restore the size" : "Full screen") + "\nDouble-click: the title bar does the same";
        };
        minBtn.onclick = function() {
          var m = pop.classList.toggle("min");
          if (m && pop.classList.contains("full")) {
            setFull(false);
            remember({ full: false });
          }
          setMin(m);
          remember({ min: m });
        };
        fullBtn.onclick = function() {
          var f = !pop.classList.contains("full");
          setFull(f);
          remember({ full: f });
        };
        pop.querySelector(".mbu-logpop-h").addEventListener("dblclick", function(e) {
          if (!e.target.closest("button, input, select") && !pop.classList.contains("min")) fullBtn.click();
        });
        if (st.w && st.h) {
          pop.style.width = st.w;
          pop.style.height = st.h;
          pop.classList.add("sized");
        }
        if (st.min) {
          pop.classList.add("min");
          setMin(true);
        } else if (st.full) setFull(true);
        pop.querySelector(".mbu-logpop-grip").addEventListener("mousedown", function(e) {
          e.preventDefault();
          e.stopPropagation();
          var r = pop.getBoundingClientRect();
          pop.style.left = r.left + "px";
          pop.style.top = r.top + "px";
          pop.style.right = "auto";
          pop.style.bottom = "";
          pop.style.transform = "none";
          pop.classList.add("sized");
          var x0 = e.clientX, y0 = e.clientY;
          var mv = function(ev) {
            pop.style.width = Math.max(320, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + "px";
            pop.style.height = Math.max(120, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + "px";
          };
          var up = function() {
            document.removeEventListener("mousemove", mv);
            document.removeEventListener("mouseup", up);
            restore = { left: pop.style.left, top: pop.style.top, right: "auto", bottom: "", transform: "none" };
            remember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
          };
          document.addEventListener("mousemove", mv);
          document.addEventListener("mouseup", up);
        });
        pop.querySelector(".mbu-logpop-x").onclick = function() {
          close();
        };
        pop.querySelector(".mbu-logpop-h").addEventListener("mousedown", function(e) {
          if (e.target.closest("button, input, select") || pop.classList.contains("full")) return;
          e.preventDefault();
          var r = pop.getBoundingClientRect();
          pop.style.left = r.left + "px";
          pop.style.top = r.top + "px";
          pop.style.right = "auto";
          pop.style.transform = "none";
          var ox = e.clientX - r.left, oy = e.clientY - r.top;
          var mv = function(ev) {
            pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + "px";
            pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + "px";
          };
          var up = function() {
            document.removeEventListener("mousemove", mv);
            document.removeEventListener("mouseup", up);
            if (!pop.classList.contains("min")) {
              restore = { left: pop.style.left, top: pop.style.top, right: "auto", bottom: "", transform: "none" };
              remember({ left: pop.style.left, top: pop.style.top });
            }
          };
          document.addEventListener("mousemove", mv);
          document.addEventListener("mouseup", up);
        });
        window.addEventListener("keydown", onKey, true);
        return pop;
      }
      function mount(host, opts) {
        if (!host) return null;
        views = views.filter(function(v) {
          if (v.el.parentNode === host) {
            v.el.remove();
            return false;
          }
          return true;
        });
        var el = document.createElement("div");
        el.className = "mbu-logemb";
        host.appendChild(el);
        return view(el, false, opts && opts.tools).el;
      }
      function clear() {
        buf = [];
        dropped = 0;
        warn = 0;
        error = 0;
        if (H && sid) {
          store.del(hp + sid);
          lastSaved = "";
        }
        views.forEach(function(v) {
          if (!v.past) v.show(null);
        });
      }
      function clearHistory() {
        if (!H) return;
        ids().forEach(function(id) {
          if (id !== sid) forget(id);
        });
        views.forEach(function(v) {
          v.sessions();
        });
      }
      function close(quiet) {
        var stray = document.getElementById("mbu-logpop");
        if (win) {
          win.off();
          win.el.remove();
          views = views.filter(function(v) {
            return v !== win.v;
          });
          win = null;
          if (!quiet) remember({ open: false });
        }
        if (stray) stray.remove();
      }
      var api = {
        info: function() {
          add("info", arguments);
        },
        warn: function() {
          add("warn", arguments);
        },
        err: function() {
          add("error", arguments);
        },
        error: function() {
          add("error", arguments);
        },
        ok: function() {
          add("ok", arguments);
        },
        debug: function() {
          add("debug", arguments);
        },
        add: function(sev) {
          add(sev, Array.prototype.slice.call(arguments, 1));
        },
        // the debug switch: are debug lines recorded?
        debugOn: function() {
          return debugOn();
        },
        setDebug,
        pre: function() {
          add("info", arguments, null, true);
        },
        // a logger whose lines carry this category; the same object for the same name
        cat: function(name) {
          if (!name) return api;
          if (!bound[name]) bound[name] = {
            info: function() {
              add("info", arguments, name);
            },
            warn: function() {
              add("warn", arguments, name);
            },
            err: function() {
              add("error", arguments, name);
            },
            error: function() {
              add("error", arguments, name);
            },
            ok: function() {
              add("ok", arguments, name);
            },
            debug: function() {
              add("debug", arguments, name);
            },
            add: function(sev) {
              add(sev, Array.prototype.slice.call(arguments, 1), name);
            },
            pre: function() {
              add("info", arguments, name, true);
            }
          };
          return bound[name];
        },
        open,
        mount,
        close: function() {
          close();
        },
        reopen: function() {
          if (state().open) open();
        },
        isOpen: function() {
          return !!win;
        },
        markdown: function() {
          return markdown();
        },
        copy: function(btn) {
          copy(btn);
        },
        clear,
        lines: function() {
          return buf.map(line);
        },
        entries: function() {
          return buf.slice();
        },
        messages: function() {
          return buf.map(function(e) {
            return e.msg;
          });
        },
        counts: function() {
          return { warn, error };
        },
        // history (#705); harmless without o.history
        session: function() {
          if (H) startSession();
          return sid;
        },
        resume: function(id) {
          return H ? resume(id) : false;
        },
        keep: function() {
          if (H && sid && !kept) {
            kept = true;
            store.set(hp + "current", sid);
            flush();
            prune();
            views.forEach(function(v) {
              v.sessions();
            });
          }
        },
        name: function(text) {
          if (H && text && !sname) {
            sname = String(text);
            if (kept) store.set(hp + sid + ":name", sname);
          }
        },
        sessionId: function() {
          return sid;
        },
        last: function() {
          return H ? store.get(hp + "current") : null;
        },
        isKept: function() {
          return kept;
        },
        sessions: function() {
          return H ? sessions() : [];
        },
        load: function(id) {
          return loadSession(id);
        },
        forget: function(id) {
          forget(id);
          views.forEach(function(v) {
            v.sessions();
          });
        },
        clearHistory,
        // redraw the session lists (a script showing its mounted viewer again); only a changed list is redrawn
        refresh: function() {
          views.forEach(function(v) {
            v.sessions();
          });
        },
        flush
      };
      if (H) {
        sid = newId();
        try {
          window.addEventListener("pagehide", flush);
        } catch (e) {
        }
      }
      mbuLog.active = api;
      return api;
    }
    function mbuDismissOn(el, close, opts) {
      opts = opts || {};
      var closed = false;
      var onDown = function(e) {
        if (closed || !el || el.contains(e.target)) return;
        if (opts.ignore && e.target.closest && e.target.closest(opts.ignore)) return;
        finish();
        var eat = function(ev) {
          ev.stopPropagation();
          ev.preventDefault();
          document.removeEventListener("click", eat, true);
        };
        document.addEventListener("click", eat, true);
        setTimeout(function() {
          document.removeEventListener("click", eat, true);
        }, 400);
      };
      var onKey = function(e) {
        if (closed || e.key !== "Escape") return;
        e.stopPropagation();
        finish();
      };
      function finish() {
        if (closed) return;
        closed = true;
        document.removeEventListener("mousedown", onDown, true);
        document.removeEventListener("keydown", onKey, true);
        try {
          close();
        } catch (err) {
        }
      }
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      return finish;
    }
    function mbuFitToolbar(bar2, opts) {
      if (!bar2) return false;
      opts = opts || {};
      var gap = opts.gap == null ? 11 : opts.gap;
      var pad = opts.pad == null ? 24 : opts.pad;
      var spacer = opts.spacer || ".mbu-sp";
      bar2.classList.remove("mbu-compact");
      var kids = [].slice.call(bar2.children);
      var need = gap * Math.max(0, kids.length - 1);
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].matches && kids[i].matches(spacer)) continue;
        need += kids[i].offsetWidth;
      }
      var compact = need > bar2.clientWidth - pad;
      bar2.classList.toggle("mbu-compact", compact);
      return compact;
    }
    function mbuThemeOf(bg) {
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || "");
      if (!m) return null;
      if (m[4] !== void 0 && +m[4] < 0.5) return null;
      var f = function(v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      var L = 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
      return L < 0.35 ? "dark" : "light";
    }
    function mbuCls(el, token, on) {
      if (!el || !el.classList) return;
      if (el.classList.contains(token) !== !!on) el.classList.toggle(token, !!on);
    }
    function mbuAttr(el, name, value) {
      if (!el) return;
      if (value === null || value === void 0 || value === false) {
        if (el.hasAttribute(name)) el.removeAttribute(name);
      } else if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
      }
    }
    function mbuProp(obj, prop, value) {
      if (!obj) return;
      if (obj[prop] !== value) obj[prop] = value;
    }
    function mbuProbe() {
      var p = document.getElementById("mbu-theme-probe");
      if (p) return p;
      if (!document.body) return null;
      p = document.createElement("span");
      p.id = "mbu-theme-probe";
      p.setAttribute("aria-hidden", "true");
      p.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background:var(--background)";
      document.body.appendChild(p);
      return p;
    }
    function mbuTheme() {
      var root = document.documentElement;
      try {
        var cs = getComputedStyle(root);
        var forced = (cs.getPropertyValue("--mbu-theme") || "").trim();
        var t = forced === "dark" || forced === "light" ? forced : mbuThemeOf(getComputedStyle(document.body).backgroundColor) || mbuThemeOf(cs.backgroundColor) || mbuThemeOf(cs.getPropertyValue("--mbu-bg")) || "light";
        if (root.getAttribute("data-mbu-theme") !== t) root.setAttribute("data-mbu-theme", t);
        var seed = null;
        var raw = (cs.getPropertyValue("--background") || "").trim();
        if (raw) {
          var probe = mbuProbe();
          var got = null;
          if (probe) {
            got = mbuThemeOf(getComputedStyle(probe).backgroundColor);
          } else {
            var tmp = document.createElement("span");
            tmp.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;background:var(--background)";
            document.documentElement.appendChild(tmp);
            got = mbuThemeOf(getComputedStyle(tmp).backgroundColor);
            tmp.remove();
          }
          if (got === t) seed = "theme";
        }
        if (seed) {
          if (root.getAttribute("data-mbu-seed") !== seed) root.setAttribute("data-mbu-seed", seed);
        } else if (root.hasAttribute("data-mbu-seed")) root.removeAttribute("data-mbu-seed");
        return t;
      } catch (e) {
        return "light";
      }
    }
    function mbuThemeStart() {
      try {
        mbuTheme();
        var _mbuThemeT = 0;
        var _mbuThemeSoon = function() {
          clearTimeout(_mbuThemeT);
          _mbuThemeT = setTimeout(mbuTheme, 150);
        };
        var _mbuThemeObs = new MutationObserver(_mbuThemeSoon);
        _mbuThemeObs.observe(document.documentElement, { attributeFilter: ["style", "class"] });
        if (document.head) _mbuThemeObs.observe(document.head, { childList: true, subtree: true, characterData: true });
        if (document.body) _mbuThemeObs.observe(document.body, { attributeFilter: ["style", "class"] });
        try {
          var _mbuMq = matchMedia("(prefers-color-scheme: dark)");
          if (_mbuMq.addEventListener) _mbuMq.addEventListener("change", _mbuThemeSoon);
          else if (_mbuMq.addListener) _mbuMq.addListener(_mbuThemeSoon);
        } catch (e) {
        }
        setTimeout(mbuTheme, 400);
        setTimeout(mbuTheme, 2e3);
      } catch (e) {
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mbuThemeStart, { once: true });
    else mbuThemeStart();
    try {
      var _mbuNs = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
      if (!_mbuNs.MBU) _mbuNs.MBU = {};
      if (!_mbuNs.MBU.theme) _mbuNs.MBU.theme = mbuTheme;
      if (!_mbuNs.MBU.helpHref) _mbuNs.MBU.helpHref = mbuHelpHref;
      if (!_mbuNs.MBU.helpHtml) _mbuNs.MBU.helpHtml = mbuHelpHtml;
      if (!_mbuNs.MBU.helpEl) _mbuNs.MBU.helpEl = mbuHelpEl;
      if (!_mbuNs.MBU.toast) _mbuNs.MBU.toast = mbuToast;
      if (!_mbuNs.MBU.cfgHeader) _mbuNs.MBU.cfgHeader = mbuCfgHeader;
      if (!_mbuNs.MBU.dismissOn) _mbuNs.MBU.dismissOn = mbuDismissOn;
      if (!_mbuNs.MBU.fitToolbar) _mbuNs.MBU.fitToolbar = mbuFitToolbar;
      if (!_mbuNs.MBU.tip) _mbuNs.MBU.tip = mbuTip;
    } catch (e) {
    }
    function mbuTipV() {
      return 13;
    }
    function mbuTipCssText() {
      return '#mbu-tip{position:fixed;left:0;top:0;z-index:var(--mbu-z-tip,2147483647);box-sizing:border-box;max-width:min(330px,calc(100vw - 16px));padding:7px 11px 8px;background:var(--mbu-bg,#fff);color:var(--mbu-text,#222);border:1px solid var(--mbu-border,#cfc6e6);border-radius:9px;box-shadow:0 6px 24px rgba(40,20,80,.2),0 1px 3px rgba(40,20,80,.12);font:12.5px/1.45 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);text-align:left;white-space:normal;overflow-wrap:break-word;letter-spacing:normal;text-transform:none;pointer-events:none;visibility:hidden;opacity:0;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}#mbu-tip.mbu-tip-up{transform:translateY(3px)}#mbu-tip.mbu-tip-on{visibility:visible;opacity:1;transform:none;transition:opacity .12s ease,transform .12s ease}#mbu-tip.mbu-tip-act.mbu-tip-on{pointer-events:auto}#mbu-tip.mbu-tip-wide{max-width:min(460px,calc(100vw - 16px))}#mbu-tip:has(.mbu-tip-dl){max-width:min(480px,calc(100vw - 16px))}#mbu-tip::before{content:"";position:absolute;left:calc(var(--mbu-tip-ax,50%) - 5px);top:-5px;width:8px;height:8px;background:inherit;border:1px solid var(--mbu-border,#cfc6e6);border-right:0;border-bottom:0;transform:rotate(45deg)}#mbu-tip.mbu-tip-up::before{top:auto;bottom:-5px;border:1px solid var(--mbu-border,#cfc6e6);border-left:0;border-top:0}#mbu-tip.mbu-tip-card:not(.mbu-tip-up)::before{background:var(--mbu-bg-raised,#faf9fe)}#mbu-tip .mbu-tip-lead{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-p{margin:0;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-lead+*,#mbu-tip .mbu-tip-p+*,#mbu-tip .mbu-tip-ul+*,#mbu-tip .mbu-tip-rows+*{margin-top:5px}#mbu-tip>.mbu-tip-p:first-child:last-child{color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-warn{color:var(--mbu-warn,#a05a00)}#mbu-tip .mbu-tip-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:start;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-rows>.mbu-tip-kk,#mbu-tip .mbu-tip-rows>.mbu-tip-dl{min-height:18px}#mbu-tip .mbu-tip-rows>.mbu-tip-k{line-height:18px}#mbu-tip .mbu-tip-rows>:nth-child(odd){justify-self:start}#mbu-tip .mbu-tip-rows>.mbu-tip-span{grid-column:2;justify-self:stretch;margin:-2px 0 0}#mbu-tip .mbu-tip-k{display:inline-block;padding:0;border:0;background:none;color:var(--mbu-text-weak,#888);font:600 11.5px/1.5 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-kk{display:inline-flex;align-items:center;gap:3px;color:var(--mbu-accent-text,#5f3ec0);white-space:nowrap}#mbu-tip .mbu-tip-dl{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--mbu-text,#222);white-space:nowrap}#mbu-tip .mbu-tip-dl i{flex:none;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}#mbu-tip .mbu-tip-on{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip .mbu-tip-dl.mbu-tip-on::after{content:"\u25C2";margin-left:-2px;font-size:11px}#mbu-tip .mbu-tip-off{opacity:.45}#mbu-tip .mbu-tip-sym{letter-spacing:.2px}#mbu-tip .mbu-tip-mouse{display:block;flex:none;position:relative}#mbu-tip .mbu-tip-mouse rect[fill=none],#mbu-tip .mbu-tip-mouse path[stroke]{stroke:var(--mbu-text-weak,#888);stroke-width:1}#mbu-tip .mbu-tip-kx{font:600 10px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}#mbu-tip .mbu-tip-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}#mbu-tip .mbu-tip-o{display:inline-block;padding:0 7px;border-radius:999px;background:var(--mbu-accent-soft,#ece4ff);color:var(--mbu-accent-text,#5f3ec0);font:600 11px/1.6 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-ul{margin:0;padding:0 0 0 15px;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-ul li{margin:1px 0;padding:0}#mbu-tip code{font:11.5px var(--mbu-font-mono,ui-monospace,Consolas,monospace);padding:0 4px;border-radius:4px;background:var(--mbu-bg-sunken,#f4f2f9)}#mbu-tip b{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip a{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip.mbu-tip-card{padding:0;width:380px;max-width:min(380px,calc(100vw - 16px));overflow:visible}#mbu-tip .mbu-tip-ch{display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid var(--mbu-border-soft,#e2dcef);background:var(--mbu-bg-raised,#faf9fe);border-radius:9px 9px 0 0}#mbu-tip .mbu-tip-ca{margin-left:auto;font-size:11px;color:var(--mbu-text-weak,#999);white-space:nowrap}#mbu-tip .mbu-tip-cb{padding:8px 11px;display:flex;flex-direction:column;gap:6px}#mbu-tip .mbu-tip-cf{display:flex;gap:10px;padding:6px 11px;border-top:1px solid var(--mbu-border-soft,#e2dcef);font-size:11px;color:var(--mbu-text-weak,#999)}#mbu-tip .mbu-tip-cf>:last-child:not(:first-child){margin-left:auto}@media (prefers-reduced-motion:reduce){#mbu-tip,#mbu-tip.mbu-tip-on{transition:none;transform:none}}';
    }
    function mbuTipRoots() {
      return ".mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu";
    }
    function mbuTipEsc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function(c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
    function mbuTipLabel(line) {
      var m = /^([^\s:.,;!?()][^:.,;!?()]{0,40}?): (\S[\s\S]*)$/.exec(line);
      if (!m || m[1].split(/\s+/).length > 3 || /https?$/i.test(m[1])) return null;
      return { label: m[1], text: m[2], key: mbuTipIsKey(m[1]) };
    }
    function mbuTipIsKey(label) {
      return /click|drag|wheel|scroll|hover|double|press|paste|\bkey\b|^(esc|escape|enter|return|tab|space|ctrl|shift|alt|cmd|meta|del|delete|backspace|f\d{1,2})\b|\+|^[↑↓←→]/i.test(label);
    }
    function mbuTipInline(s) {
      return mbuTipEsc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\(((?:(?:Ctrl|Alt|Shift|Cmd|Meta)\+)+[^\s()]+)\)/g, function(m, k) {
        return mbuTipKbd(k);
      }).replace(/\s\((Esc|Enter|Space|Tab|[A-Z0-9]|[↑↓←→])\)(?=$|[\s.,;])/g, ' <kbd class="mbu-tip-k">$1</kbd>');
    }
    function mbuTipCap(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function mbuTipMod(k) {
      return { ctrl: "C", alt: "A", shift: "\u21E7", cmd: "\u2318", meta: "\u2318" }[String(k).toLowerCase()] || k;
    }
    function mbuTipKbd(combo) {
      var parts = String(combo).split(/\s*\+\s*/);
      var key = parts.pop();
      return '<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">' + mbuTipEsc(combo) + '</span><span aria-hidden="true">' + parts.concat("").map(mbuTipMod).join("+") + mbuTipEsc(key.length === 1 ? key.toUpperCase() : mbuTipCap(key)) + "</span></kbd>";
    }
    function mbuTipKey(label) {
      var alts = String(label).split(/\s+\/\s+/);
      if (alts.length > 1) return '<span class="mbu-tip-kk">' + alts.map(mbuTipKey).join('<span class="mbu-tip-kx">/</span>') + "</span>";
      var both = /^(.*?(?:click|drag|wheel|scroll))\s+\+\s+(.+)$/i.exec(String(label).trim());
      if (both) return '<span class="mbu-tip-kk">' + mbuTipKey(both[1]) + '<span class="mbu-tip-kx">+</span>' + mbuTipKey(both[2]) + "</span>";
      var m = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*)(left|right|middle|double)?[- ]?(click|drag|wheel|scroll)$/i.exec(String(label).trim());
      if (!m) return /^(?:(?:ctrl|alt|shift|cmd|meta)\s*\+\s*)+\S/i.test(label) ? mbuTipKbd(label) : '<span class="mbu-tip-k">' + mbuTipEsc(mbuTipCap(label)) + "</span>";
      var mods = m[1] ? m[1].split(/\s*[+-]\s*/).filter(Boolean) : [];
      var btn = (m[2] || "").toLowerCase(), act = m[3].toLowerCase();
      var wheel = btn === "middle" || act === "wheel" || act === "scroll";
      var fill = wheel ? "M4 1.4h4V7H4z" : btn === "right" ? "M6 1C8.8 1 11 3.2 11 6v1H6z" : "M6 1C3.2 1 1 3.2 1 6v1h5z";
      var svg = '<svg class="mbu-tip-mouse" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true"><path d="' + fill + '" fill="currentColor"/><rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 7h10' + (wheel ? "" : "M6 1v6") + '" stroke="currentColor" stroke-width="1.1"/></svg>';
      var extra = btn === "double" ? "\xD72" : act === "drag" ? "drag" : act === "wheel" || act === "scroll" ? "\u2195" : "";
      return '<span class="mbu-tip-kk"><span class="mbu-tip-sr">' + mbuTipEsc(mbuTipCap(label)) + "</span>" + (mods.length ? '<kbd class="mbu-tip-k mbu-tip-sym" aria-hidden="true">' + mods.map(mbuTipMod).join("+") + "</kbd>" : "") + svg + (extra ? '<span class="mbu-tip-kx" aria-hidden="true">' + extra + "</span>" : "") + "</span>";
    }
    function mbuTipText(src) {
      var raw = String(src == null ? "" : src).replace(/\r/g, "").replace(/^\s+|\s+$/g, "");
      if (!raw) return "";
      var lines = [];
      raw = raw.replace(/\b(Ctrl|Alt|Shift|Cmd)-(click|drag)/gi, "$1+$2").replace(/\s*\(((?:(?:right|middle|double|ctrl|alt|shift|cmd)[-+ ]?)+click|(?:ctrl|alt|shift|cmd)\+\w+):\s*([^()\n]+)\)(?=\s*(?:$|\n))/gim, function(m2, k, t) {
        return "\n" + mbuTipCap(k) + ": " + t;
      }).replace(/\s+[—–-]\s+((?:(?:right|middle|double|ctrl|alt|shift)[-+ ]?)?click) to ([^\n·]+)/gi, function(m2, k, t) {
        return "\n" + mbuTipCap(k) + ": " + t;
      }).replace(/[.;]\s+((?:right|middle|double|ctrl|alt|shift)[-+ ]?click|click) to ([^\n·.]+)\.?(?=\s*(?:$|\n))/gi, function(m2, k, t) {
        return "\n" + mbuTipCap(k) + ": " + t;
      });
      raw.split("\n").forEach(function(line) {
        line = line.replace(/\s+$/, "");
        var parts = line.split(/\s+·\s+/), out2 = [parts[0]];
        for (var i2 = 1; i2 < parts.length; i2++) {
          if (mbuTipLabel(parts[i2])) out2.push(parts[i2]);
          else out2[out2.length - 1] += " \xB7 " + parts[i2];
        }
        out2.forEach(function(seg) {
          if (!mbuTipLabel(seg)) {
            lines.push(seg);
            return;
          }
          var bits = seg.split(/(?<=\.)\s+(?=[A-Z][\w+-]*(?:\s[\w+-]+)?:\s)/);
          bits.forEach(function(b) {
            lines.push(b);
          });
        });
      });
      var blocks = [], rowRun = [];
      var flushRows = function() {
        if (!rowRun.length) return;
        var keyed = rowRun.filter(function(r) {
          return r.key;
        }).length;
        if (rowRun.length >= 2 || keyed || rowRun[0].dot) blocks.push({ t: "rows", rows: rowRun });
        else blocks.push({ t: "p", s: rowRun[0].line });
        rowRun = [];
      };
      lines.forEach(function(line, n) {
        if (!line.trim()) {
          flushRows();
          return;
        }
        var b = /^\s*[-•]\s+(.*)$/.exec(line);
        if (b) {
          flushRows();
          var last2 = blocks[blocks.length - 1];
          if (last2 && last2.t === "ul") last2.items.push(b[1]);
          else blocks.push({ t: "ul", items: [b[1]] });
          return;
        }
        var lv = /^\{(#[0-9a-f]{3,8})(?: (on|off))?\}\s*(\S[\s\S]*)$/i.exec(line);
        if (lv) {
          var ll = mbuTipLabel(lv[3]) || { label: lv[3], text: "" };
          rowRun.push({ label: ll.label, text: ll.text, dot: lv[1], st: lv[2] ? lv[2].toLowerCase() : "", line });
          return;
        }
        var l = mbuTipLabel(line);
        if (l && (l.key || blocks.length || rowRun.length || lines[n + 1] && mbuTipLabel(lines[n + 1]))) {
          l.line = line;
          rowRun.push(l);
          return;
        }
        flushRows();
        blocks.push({ t: "p", s: line });
      });
      flushRows();
      if (blocks.length === 1 && blocks[0].t === "p" && blocks[0].s.length > 110) {
        var m = /^(.{12,110}?[.!?])\s+(?=[A-Z(“"'])([\s\S]+)$/.exec(blocks[0].s);
        if (m) blocks = [{ t: "p", s: m[1].replace(/\.$/, "") }, { t: "p", s: m[2] }];
      }
      var lead = blocks.length > 1 && blocks[0].t === "p";
      var rowsHtml = function(bl) {
        return bl.rows.map(function(r) {
          if (r.dot) {
            var c = r.st ? " mbu-tip-" + r.st : "";
            return '<span class="mbu-tip-dl' + c + '"><i style="background:' + r.dot + '"></i>' + mbuTipEsc(mbuTipCap(r.label)) + '</span><span class="mbu-tip-dt' + c + '">' + mbuTipInline(r.text) + "</span>";
          }
          return (r.key ? mbuTipKey(r.label) : '<span class="mbu-tip-o">' + mbuTipEsc(mbuTipCap(r.label)) + "</span>") + "<span>" + mbuTipInline(r.text) + "</span>";
        }).join("");
      };
      var html = function(bl, i2, span) {
        var sp = span ? " mbu-tip-span" : "";
        if (bl.t === "ul") return '<ul class="mbu-tip-ul' + sp + '">' + bl.items.map(function(x) {
          return "<li>" + mbuTipInline(x) + "</li>";
        }).join("") + "</ul>";
        if (bl.t === "rows") return span ? rowsHtml(bl) : '<div class="mbu-tip-rows">' + rowsHtml(bl) + "</div>";
        var warn = /^⚠/.test(bl.s);
        return '<div class="' + (lead && i2 === 0 ? "mbu-tip-lead" : "mbu-tip-p") + (warn ? " mbu-tip-warn" : "") + sp + '">' + mbuTipInline(bl.s) + "</div>";
      };
      var first = -1, last = -1;
      blocks.forEach(function(bl, i2) {
        if (bl.t === "rows") {
          if (first < 0) first = i2;
          last = i2;
        }
      });
      var out = "";
      for (var i = 0; i < blocks.length; i++) {
        if (i === first && last > first) {
          out += '<div class="mbu-tip-rows">';
          for (; i <= last; i++) out += html(blocks[i], i, true);
          out += "</div>";
          i = last;
        } else out += html(blocks[i], i, false);
      }
      return out;
    }
    function mbuTipCard(o) {
      o = o || {};
      var h = "";
      if (o.head || o.title || o.aside) {
        h += '<div class="mbu-tip-ch">' + (o.head || "") + (o.title ? "<b>" + mbuTipEsc(o.title) + "</b>" : "") + (o.aside ? '<span class="mbu-tip-ca">' + mbuTipEsc(o.aside) + "</span>" : "") + "</div>";
      }
      if (o.body) h += '<div class="mbu-tip-cb">' + o.body + "</div>";
      if (o.foot || o.footAside) h += '<div class="mbu-tip-cf"><span>' + (o.foot || "") + "</span>" + (o.footAside ? "<span>" + o.footAside + "</span>" : "") + "</div>";
      return h;
    }
    function mbuTipS() {
      return mbuTipS.s || (mbuTipS.s = {
        me: Math.random().toString(36).slice(2, 10),
        lead: false,
        els: typeof WeakMap === "function" ? /* @__PURE__ */ new WeakMap() : null,
        prov: [],
        cur: null,
        curOpts: null,
        pend: null,
        showT: 0,
        hideT: 0,
        liveT: 0,
        warm: 0,
        quiet: null,
        tab: false,
        mx: -1,
        my: -1,
        obs: null
      });
    }
    function mbuTip(el, content, opts) {
      if (!el) return el;
      var _mbuTip = mbuTipS();
      mbuTipStart();
      opts = opts || {};
      if (typeof content === "function") {
        if (_mbuTip.els) _mbuTip.els.set(el, { fn: content, opts });
        el.setAttribute("data-mbu-tip-own", "");
        el.removeAttribute("title");
        return el;
      }
      if (content == null || content === "") el.removeAttribute("data-tip");
      else el.setAttribute("data-tip", String(content));
      if (opts.place) el.setAttribute("data-tip-place", opts.place);
      if (opts.wide) el.setAttribute("data-tip-wide", "");
      el.removeAttribute("title");
      if (_mbuTip.cur === el) mbuTipRender();
      return el;
    }
    function mbuTipOn(selector, fn, opts) {
      mbuTipS().prov.push({ sel: selector, fn, opts: opts || {} });
      mbuTipStart();
    }
    function mbuTipShowFor(el, content, opts) {
      if (!el || content == null || content === "") {
        mbuTipHide(true);
        return;
      }
      mbuTipStart();
      var o = opts || {};
      var fn = typeof content === "function" ? content : function() {
        return content;
      };
      var S = mbuTipS();
      if (S.cur === el) {
        S.curOpts.fn = fn;
        if (!mbuTipRender()) mbuTipHide(true);
        return;
      }
      mbuTipShow({ el, fn, opts: o });
    }
    function mbuTipHtml(s) {
      if (mbuTipHtml.tt === void 0) {
        mbuTipHtml.tt = null;
        try {
          var tt = typeof window !== "undefined" && window.trustedTypes || null;
          if (tt && tt.createPolicy) mbuTipHtml.tt = tt.createPolicy("mbu-tip-" + Math.random().toString(36).slice(2, 8), { createHTML: function(x) {
            return x;
          } });
        } catch (e) {
        }
      }
      return mbuTipHtml.tt ? mbuTipHtml.tt.createHTML(String(s)) : String(s);
    }
    function mbuTipCss() {
      var s = document.getElementById("mbu-tip-css");
      if (s && +s.getAttribute("data-v") >= mbuTipV()) return;
      if (!s) {
        s = document.createElement("style");
        s.id = "mbu-tip-css";
        (document.head || document.documentElement).appendChild(s);
      }
      s.setAttribute("data-v", String(mbuTipV()));
      s.textContent = mbuTipCssText();
    }
    function mbuTipEl() {
      var t = document.getElementById("mbu-tip");
      if (!t) {
        t = document.createElement("div");
        t.id = "mbu-tip";
        t.setAttribute("role", "tooltip");
      }
      var host = document.documentElement;
      if (t.parentNode !== host || host.lastElementChild !== t) host.appendChild(t);
      return t;
    }
    function mbuTipFind(node) {
      var _mbuTip = mbuTipS();
      var tip = document.getElementById("mbu-tip");
      for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        if (el === tip) return null;
        var reg = _mbuTip.els && _mbuTip.els.get(el);
        if (reg) return { el, fn: reg.fn, opts: reg.opts };
        for (var i = 0; i < _mbuTip.prov.length; i++) {
          var p = _mbuTip.prov[i];
          try {
            if (el.matches(p.sel)) return { el, fn: p.fn, opts: p.opts };
          } catch (e) {
          }
        }
        if (!_mbuTip.lead) continue;
        if (el.hasAttribute("data-mbu-tip-own")) return null;
        if (el.hasAttribute("data-tip")) return { el, opts: { place: el.getAttribute("data-tip-place"), wide: el.hasAttribute("data-tip-wide") } };
        if (el.hasAttribute("title") && el.getAttribute("title") && el.namespaceURI === "http://www.w3.org/1999/xhtml" && !/^(OPTION|OPTGROUP)$/.test(el.tagName)) {
          var root = null;
          try {
            root = el.closest(mbuTipRoots());
          } catch (e) {
          }
          if (root) {
            el.setAttribute("data-tip", el.getAttribute("title"));
            el.removeAttribute("title");
            return { el, opts: {} };
          }
        }
      }
      return null;
    }
    function mbuTipRender() {
      var _mbuTip = mbuTipS();
      var a = _mbuTip.cur, o = _mbuTip.curOpts || {}, t = mbuTipEl(), c;
      if (!a) return false;
      if (o.fn) {
        try {
          c = o.fn(a);
        } catch (e) {
          c = null;
        }
        if (c == null || c === "") return false;
        if (typeof c === "string") t.innerHTML = mbuTipHtml(c);
        else {
          t.textContent = "";
          t.appendChild(c);
        }
      } else {
        var s = a.getAttribute("data-tip");
        if (!s) return false;
        var h = mbuTipText(s);
        t.innerHTML = mbuTipHtml(h);
        if (!a.getAttribute("aria-label") && !/[\p{L}\p{N}]/u.test(a.textContent || "") && !a.querySelector('img[alt]:not([alt=""])')) {
          a.setAttribute("aria-label", s.split("\n")[0]);
        }
      }
      t.className = "mbu-ui" + (o.card ? " mbu-tip-card" : "") + (o.interactive ? " mbu-tip-act" : "") + (o.wide ? " mbu-tip-wide" : "");
      t.setAttribute("data-owner", _mbuTip.me);
      mbuTipPlace(t, a, o.place);
      return true;
    }
    function mbuTipPlace(t, a, place) {
      var _mbuTip = mbuTipS();
      var r = a.getBoundingClientRect();
      if (!r.width && !r.height && a.firstElementChild) r = a.firstElementChild.getBoundingClientRect();
      t.style.left = "0px";
      t.style.top = "0px";
      var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, gap = 8, m = 6;
      var below = place !== "above";
      if (below && r.bottom + gap + h > vh - m && r.top - gap - h >= m) below = false;
      else if (!below && r.top - gap - h < m && r.bottom + gap + h <= vh - m) below = true;
      var top = below ? r.bottom + gap : r.top - gap - h;
      var cx = r.left + r.width / 2;
      if (r.width > 220 && _mbuTip.mx >= r.left && _mbuTip.mx <= r.right) cx = _mbuTip.mx;
      var left = Math.max(m, Math.min(vw - w - m, Math.round(cx - w / 2)));
      t.style.left = left + "px";
      t.style.top = Math.max(m, Math.round(top)) + "px";
      t.style.setProperty("--mbu-tip-ax", Math.max(12, Math.min(w - 12, Math.round(cx - left))) + "px");
      t.classList.toggle("mbu-tip-up", !below);
    }
    function mbuTipShow(found) {
      var _mbuTip = mbuTipS();
      clearTimeout(_mbuTip.hideT);
      clearTimeout(_mbuTip.showT);
      if (_mbuTip.cur && _mbuTip.cur !== found.el) mbuTipHide(true);
      mbuTipCss();
      _mbuTip.cur = found.el;
      _mbuTip.curOpts = { fn: found.fn, interactive: !!found.opts.interactive, card: !!found.opts.card, wide: !!found.opts.wide, place: found.opts.place };
      if (!mbuTipRender()) {
        _mbuTip.cur = null;
        return;
      }
      var t = mbuTipEl();
      found.el.setAttribute("aria-describedby", "mbu-tip");
      requestAnimationFrame(function() {
        if (_mbuTip.cur === found.el) t.classList.add("mbu-tip-on");
      });
      clearInterval(_mbuTip.liveT);
      _mbuTip.liveT = setInterval(function() {
        if (!_mbuTip.cur || !_mbuTip.cur.isConnected) mbuTipHide(true);
      }, 300);
      try {
        if (!_mbuTip.obs) _mbuTip.obs = new MutationObserver(function() {
          if (_mbuTip.cur && !mbuTipRender()) mbuTipHide(true);
        });
        _mbuTip.obs.disconnect();
        if (!found.fn) _mbuTip.obs.observe(found.el, { attributes: true, attributeFilter: ["data-tip"] });
      } catch (e) {
      }
    }
    function mbuTipHide(now) {
      var _mbuTip = mbuTipS();
      clearTimeout(_mbuTip.showT);
      clearTimeout(_mbuTip.hideT);
      _mbuTip.pend = null;
      var hide = function() {
        var a = _mbuTip.cur;
        if (!a) return;
        _mbuTip.cur = null;
        clearInterval(_mbuTip.liveT);
        try {
          if (_mbuTip.obs) _mbuTip.obs.disconnect();
        } catch (e) {
        }
        if (a.getAttribute("aria-describedby") === "mbu-tip") a.removeAttribute("aria-describedby");
        var t = document.getElementById("mbu-tip");
        if (t && t.getAttribute("data-owner") === _mbuTip.me) t.classList.remove("mbu-tip-on");
        _mbuTip.warm = Date.now();
      };
      if (now) hide();
      else _mbuTip.hideT = setTimeout(hide, _mbuTip.curOpts && _mbuTip.curOpts.interactive ? 220 : 70);
    }
    function mbuTipStart() {
      if (mbuTipStart.done || typeof document === "undefined") return;
      var _mbuTip = mbuTipS();
      var root = document.documentElement;
      if (!root) {
        document.addEventListener("DOMContentLoaded", mbuTipStart, { once: true });
        return;
      }
      mbuTipStart.done = true;
      if (!root.hasAttribute("data-mbu-tip")) {
        root.setAttribute("data-mbu-tip", _mbuTip.me);
        _mbuTip.lead = true;
      }
      var inTip = function(n) {
        var t = document.getElementById("mbu-tip");
        return !!(t && n && t.contains(n));
      };
      window.addEventListener("mousemove", function(e) {
        _mbuTip.mx = e.clientX;
        _mbuTip.my = e.clientY;
      }, { passive: true, capture: true });
      window.addEventListener("mouseover", function(e) {
        _mbuTip.mx = e.clientX;
        _mbuTip.my = e.clientY;
        _mbuTip.over = e.target;
        if (inTip(e.target)) {
          if (_mbuTip.cur) clearTimeout(_mbuTip.hideT);
          return;
        }
        var f = mbuTipFind(e.target);
        if (!f) {
          if (_mbuTip.cur && !_mbuTip.cur.contains(e.target)) mbuTipHide();
          return;
        }
        if (f.el === _mbuTip.cur) {
          clearTimeout(_mbuTip.hideT);
          return;
        }
        if (f.el === _mbuTip.quiet || _mbuTip.pend && _mbuTip.pend.el === f.el) return;
        clearTimeout(_mbuTip.showT);
        _mbuTip.pend = f;
        var warm = _mbuTip.cur || Date.now() - _mbuTip.warm < 450;
        _mbuTip.showT = setTimeout(function() {
          _mbuTip.pend = null;
          if (f.el.isConnected && f.el.contains(_mbuTip.over)) mbuTipShow(f);
        }, warm ? 40 : f.opts.delay != null ? f.opts.delay : 350);
      }, true);
      window.addEventListener("mouseout", function(e) {
        var to = e.relatedTarget;
        var q = _mbuTip.quiet;
        if (q && q.contains(e.target) && !(to && q.contains(to))) _mbuTip.quiet = null;
        var p = _mbuTip.pend;
        if (p && p.el.contains(e.target) && !(to && p.el.contains(to))) {
          clearTimeout(_mbuTip.showT);
          _mbuTip.pend = null;
        }
        var a = _mbuTip.cur;
        if (!a) return;
        if (to && (a.contains(to) || _mbuTip.curOpts.interactive && inTip(to))) return;
        if (a.contains(e.target) || inTip(e.target)) mbuTipHide();
      }, true);
      window.addEventListener("mousedown", function(e) {
        if (inTip(e.target)) return;
        clearTimeout(_mbuTip.showT);
        _mbuTip.pend = null;
        var f = mbuTipFind(e.target);
        _mbuTip.quiet = f ? f.el : null;
        _mbuTip.tab = false;
        if (_mbuTip.cur) mbuTipHide(true);
      }, true);
      document.addEventListener("keydown", function(e) {
        if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) _mbuTip.tab = e.key === "Tab";
        if (!_mbuTip.cur) return;
        var interactive = _mbuTip.curOpts && _mbuTip.curOpts.interactive;
        if (e.key !== "Escape") {
          if (!interactive && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) mbuTipHide(true);
          return;
        }
        mbuTipHide(true);
        if (interactive) e.stopPropagation();
      }, true);
      window.addEventListener("scroll", function(e) {
        if (_mbuTip.cur && !inTip(e.target)) mbuTipHide(true);
      }, true);
      window.addEventListener("blur", function() {
        if (_mbuTip.cur) mbuTipHide(true);
      });
      document.addEventListener("focusin", function(e) {
        var el = e.target, vis = false;
        try {
          vis = el.matches(":focus-visible");
        } catch (x) {
        }
        if (!vis || !_mbuTip.tab) return;
        var f = mbuTipFind(el);
        if (f && f.el === el) {
          clearTimeout(_mbuTip.showT);
          _mbuTip.showT = setTimeout(function() {
            if (document.activeElement === el) mbuTipShow(f);
          }, 150);
        }
      }, true);
      document.addEventListener("focusout", function(e) {
        if (_mbuTip.cur && _mbuTip.cur === e.target && !(e.relatedTarget && inTip(e.relatedTarget))) mbuTipHide();
      }, true);
    }
    mbuTipStart();
    log.info(mbuStartupInfo("Credit Hoarder"));
    const style = document.createElement("style");
    style.innerText = MBU_TOKENS + MBU_UI_CSS + `
        .discogs-bar {
            font-family: inherit;
            background: var(--mbu-bg-raised);
            border: 1px solid var(--mbu-border);
            border-radius: 10px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        .discogs-bar-row1 {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            row-gap: 0.4rem;
            flex-wrap: wrap;
            min-height: 40px;
            box-sizing: border-box;
            padding: 4px 12px;
            background: var(--mbu-bg-raised);
        }
        /* MB's margins on labels, selects and buttons pushed the row's content up, leaving more room below */
        .discogs-bar-row1 > *, .discogs-bar-row1 > * > :is(label, select, button, input, span, img) { margin-top: 0 !important; margin-bottom: 0 !important; }
        .discogs-bar-row2:empty { display: none; }
        /* review table: flat \u2715 that clears a row's MB pick */
        .discogs-clear-btn { margin-left: auto; flex: 0 0 auto; font-size: 0.85rem; line-height: 1; padding: 0.15rem 0.35rem; cursor: pointer; color: var(--mbu-text-weak); background: none !important; border: none; border-radius: var(--mbu-radius); }
        .discogs-clear-btn:hover { color: var(--mbu-error); background: var(--mbu-bg-hover) !important; }
        /* inline options strip in the single bar (#139) */
        .discogs-bar-opts { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-left: 0.9rem; }
        .discogs-bar-opts .discogs-opts-label { font-size: 0.75rem; color: var(--mbu-text-weak); text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .discogs-opts-btn { font-size: 0.8rem; color: var(--mbu-text-dim); background: var(--mbu-bg); border: 1px solid var(--mbu-border); border-radius: 8px; height: 1.9rem; padding: 0 0.65rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; }
        .discogs-opts-btn:hover { border-color: var(--mbu-accent); color: var(--mbu-text); }
        .discogs-opts-caret { color: var(--mbu-text-weak); font-size: 0.7rem; }
        /* "Options \u25BE" popover (Dedup toggles) */
        .discogs-opts-panel { position: fixed; z-index: 100002; display: none; flex-direction: column; gap: 0.4rem; background: var(--mbu-bg); border: 1px solid var(--mbu-warn); border-radius: 0.4rem; box-shadow: 0 6px 22px rgba(40,20,80,0.18); padding: 0.55rem 0.6rem; font-family: inherit; }
        .discogs-opts-panel.open { display: flex; }
        .discogs-opts-panel .discogs-opts-panel-hd { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mbu-text-weak); font-weight: 600; }
        /* "Log" header toggle \u2014 a split button (#142, #217): "Log" toggles, the
           \u25BE half (its own clickable target) opens the copy menu. */
        .discogs-log-split { display: inline-flex; align-items: stretch; }
        .discogs-logtoggle-btn { font-size: 0.78rem; color: var(--mbu-text-dim); background: var(--mbu-bg); border: 1px solid var(--mbu-border); border-radius: 0.25rem 0 0 0.25rem; border-right: none; padding: 0.15rem 0.55rem; cursor: pointer; display: inline-flex; align-items: center; white-space: nowrap; }
        .discogs-log-caret-btn { font-size: 0.78rem; color: var(--mbu-text-dim); background: var(--mbu-bg); border: 1px solid var(--mbu-border); border-radius: 0 0.25rem 0.25rem 0; padding: 0.15rem 0.45rem; cursor: pointer; display: inline-flex; align-items: center; }
        .discogs-logtoggle-btn:hover, .discogs-log-caret-btn:hover { border-color: var(--mbu-border); }
        .discogs-log-caret-btn:hover { background: var(--mbu-bg-raised); }
        .discogs-log-split.active .discogs-logtoggle-btn, .discogs-log-split.active .discogs-log-caret-btn { background: var(--mbu-bg-hover); border-color: var(--mbu-accent); color: var(--mbu-accent-deep-text); }
        /* "Log \u25BE" dropdown menu (#118): show/hide + the three copy actions. */
        .discogs-log-menu { position: fixed; z-index: 100002; display: none; flex-direction: column; min-width: 11rem; background: var(--mbu-bg); border: 1px solid var(--mbu-border); border-radius: 0.4rem; box-shadow: 0 6px 22px rgba(40,20,80,0.18); padding: 0.3rem; font-family: inherit; }
        .discogs-log-menu.open { display: flex; }
        .discogs-log-menu button { text-align: left; font-size: 0.82rem; color: var(--mbu-text); background: none; border: none; border-radius: 0.25rem; padding: 0.3rem 0.5rem; cursor: pointer; white-space: nowrap; }
        .discogs-log-menu button:hover { background: var(--mbu-bg-hover); color: var(--mbu-text); }
        /* log panel toolbar: severity filter + copy buttons */
        .discogs-log-toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.3rem 0 0.45rem; }
        .discogs-log-filter { display: inline-flex; border: 1px solid var(--mbu-border); border-radius: 0.3rem; overflow: hidden; }
        .discogs-log-filterbtn { font-size: 0.75rem; color: var(--mbu-text-dim); background: var(--mbu-bg); border: none; border-right: 1px solid var(--mbu-divider); padding: 0.15rem 0.55rem; cursor: pointer; }
        .discogs-log-filterbtn:last-child { border-right: none; }
        .discogs-log-filterbtn:hover { background: var(--mbu-bg-raised); }
        .discogs-log-filterbtn.active { background: var(--mbu-accent); color: var(--mbu-text-on-accent); }
        .discogs-log-copyslot { display: inline-flex; gap: 0.4rem; margin-left: auto; }
        .discogs-log-copybtn { font-size: 0.78rem; color: var(--mbu-text-dim); background: var(--mbu-bg); border: 1px solid var(--mbu-border); border-radius: 0.25rem; padding: 0.15rem 0.5rem; cursor: pointer; white-space: nowrap; }
        .discogs-log-copybtn:hover { border-color: var(--mbu-border); }
        .discogs-bar img.discogs-logo {
            height: 20px;
            width: auto;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .discogs-bar .discogs-source-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
        .discogs-bar .discogs-source-icon:hover .discogs-logo { opacity: 1; }
        .discogs-bar .discogs-source {
            flex: 0 1 auto;
            max-width: 20rem;
            font-size: 0.82rem;
            color: var(--mbu-text-dim);
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        /* Slot in the always-visible header that hosts the review "Start import"
           button + unresolved message (#139). Content-sized; the right cluster's
           margin-left:auto does the pushing so the link/help stay right even when
           this slot is empty (initial state). */
        .discogs-bar-action {
            flex: 0 1 auto;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 0.6rem;
        }
        .discogs-bar-action:empty { display: none; }
        /* Reserved message area (#118): badge + transient status, right-aligned
           just left of the Discogs/Help/Log cluster. margin-left:auto pushes
           it (and the right cluster after it) to the edge, leaving the gap up to
           the "Options" button free for these messages. Collapses to nothing
           when empty (hidden children don't count as flex items, so the gap
           contributes no width). */
        /* #139: grow to fill the gap between "Options" and the right cluster so the
           status message can use that whole width (right-aligned next to the cluster).
           flex:1 also keeps the right cluster pinned to the edge whether this is empty
           or not \u2014 replacing the old margin-left:auto. Basis 0 (not auto) is essential:
           with an auto basis a very long message's content width is used for row1's
           wrap calculation and bumps the whole slot to a second row; basis 0 keeps it
           on the line and the status just ellipsises inside it. */
        .discogs-bar-msgs {
            flex: 1 1 0;
            justify-content: flex-end;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            min-width: 0;
        }
        /* #139: no fixed cap \u2014 the message takes the available space up to "Options"
           and only ellipsises when it genuinely doesn't fit (flex-shrink + min-width:0). */
        .discogs-bar-status {
            font-size: 0.8rem;
            color: var(--mbu-text-weak);
            flex: 0 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        /* #216: persistent end-of-run message (e.g. "No importable credits found") */
        .discogs-bar-status-final {
            color: var(--mbu-warn);
            font-weight: 600;
        }
        /* Count badges. Buttons so they can focus/open the log; styled as pills.
           Borderless + a touch larger per #139; the (deepened) fill carries them. */
        .discogs-badge {
            flex-shrink: 0;
            font-size: 0.9rem;
            font-weight: 600;
            line-height: 1.2;
            padding: 0.2rem 0.7rem;
            border-radius: 2rem;
            border: none;
            cursor: pointer;
            white-space: nowrap;
        }
        .discogs-badge-warn      { color: var(--mbu-warn); background: var(--mbu-warn-bg); }
        .discogs-badge-warn:hover{ background: var(--mbu-warn-bg); }
        .discogs-badge-err       { color: var(--mbu-error); background: var(--mbu-error-bg); }
        .discogs-badge-err:hover { background: var(--mbu-error-bg); }
        .discogs-badge-unresolved{ color: var(--mbu-accent-deep-text); background: var(--mbu-bg-hover); }
        .discogs-badge-unresolved:hover { background: var(--mbu-bg-hover); }
        /* Discogs logo + Help + Log \u2014 pinned to the right edge (the msgs slot's
           margin-left:auto does the pushing). */
        .discogs-bar-right {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            min-width: 0;
        }
        /* During the review wait the import isn't running, so the "Importing\u2026"
           button + percentage are redundant \u2014 hide them; they reappear while a
           real import phase (preflight / dispatch) is active (#139). */
        .discogs-bar.is-reviewing .discogs-import-btn,
        .discogs-bar.is-reviewing #discogs-progress-pct { display: none !important; }   /* !important: the % span carries an inline display set by JS */
        .discogs-bar-action .discogs-issue-note {
            font-size: 0.85rem;
            color: var(--mbu-warn);
            min-width: 7.5rem;   /* reserve space so the bar doesn't reflow as the count appears / changes (#139) */
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .discogs-bar-action .discogs-issue-note.clickable {
            cursor: pointer;
            text-decoration: underline dotted;
        }
        .discogs-bar-action .discogs-issue-note.clickable:hover { color: var(--mbu-warn); }
        /* "N links" badge \u2014 orange, short, clickable to cycle through the rows
           whose source URL still needs linking. No wide min-width reservation. */
        .discogs-bar-action .discogs-links-note { min-width: 0; color: var(--mbu-warn); }
        .discogs-bar-action .discogs-links-note.clickable:hover { color: var(--mbu-warn); }
        .discogs-bar .discogs-source a {
            color: var(--mbu-warn);
            text-decoration: none;
            font-weight: bold;
        }
        .discogs-bar .discogs-source a:hover { text-decoration: underline; }
        /* #272: "Import credits:" label + a row of clickable source icons */
        .discogs-import-label { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; color: var(--mbu-text-weak); letter-spacing: 0.08em; text-transform: uppercase; padding-right: 0.7rem; border-right: 1px solid var(--mbu-border); }
        .discogs-import-label img { width: 30px; height: 30px; }
        /* #272: drop the "Import credits:" label once a run is underway \u2014 only the
           active source icon + progress/Start-import matter then. */
        .discogs-bar.is-importing .discogs-import-label span,
        .discogs-bar.is-reviewing .discogs-import-label span { display: none; }
        .discogs-src-icons { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.3rem; }
        .discogs-src-ico {
            display: inline-flex; align-items: center; justify-content: center;
            width: 36px; height: 36px; padding: 0; cursor: pointer;
            border: 0; border-radius: 8px; background: none; color: var(--mbu-text-dim);
        }
        .discogs-src-ico:hover { background: none; color: var(--mbu-warn); }
        .discogs-src-ico:disabled { opacity: 0.5; cursor: default; }
        .discogs-src-ico svg { width: 24px; height: 24px; }
        .discogs-src-ico img.discogs-logo { height: 24px; width: auto; opacity: 1; }
        .discogs-src-ico.importing { background: none; color: var(--mbu-warn); animation: discogs-ico-pulse 1s ease-in-out infinite; }
        @keyframes discogs-ico-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,119,29,.5); } 50% { box-shadow: 0 0 0 4px rgba(232,119,29,0); } }
        /* #412: while MusicBrainz is submitting the staged edits (can be slow for hundreds),
           pulse the toolbar blue. Target ROW1 \u2014 that's the strip pinned (position:fixed) at
           the top of the viewport while the page is scrolled down to the submit button, i.e.
           the part actually on screen. The outer container is usually scrolled out of view. */
        .discogs-bar.is-saving { border-left-color: var(--mbu-info); }
        .discogs-bar.is-saving .discogs-bar-row1 { animation: discogs-bar-saving 1.1s ease-in-out infinite; border-bottom-color: var(--mbu-info); }
        @keyframes discogs-bar-saving { 0%,100% { background: var(--mbu-bg-raised); } 50% { background: var(--mbu-info-bg); } }
        .discogs-bar.is-saving .discogs-bar-status-final { color: var(--mbu-info); font-weight: 600; }
        /* #412: a toolbar "Enter edit" that fires MB's native submit, so you don't have to
           scroll to the bottom after an import. Shown once an import finishes, removed on
           return-to-source. Green to read as the positive/submit action (matches MB). */
        .discogs-enter-edit {
            flex-shrink: 0; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
            color: var(--mbu-text-on-accent); background: #4b8f29; border: 1px solid var(--mbu-ok); border-radius: 0.25rem;
            padding: 0.14rem 0.6rem;
        }
        .discogs-enter-edit:hover { background: #57a230; }
        .discogs-bar.is-saving .discogs-enter-edit { opacity: 0.6; pointer-events: none; }
        /* #408 "Import all" \u2014 wider pill with a glyph + label, brand-orange so it reads as the primary action */
        .discogs-src-all { width: auto; gap: 0.3rem; padding: 0 0.6rem; border-color: var(--mbu-warn); color: var(--mbu-warn); font-weight: 600; font-size: 0.85rem; margin-left: 0.35rem; }
        .discogs-src-all:hover { background: #e8771d; color: var(--mbu-text-on-accent); border-color: var(--mbu-warn); }
        .discogs-src-all .discogs-all-glyph { font-size: 1rem; line-height: 1; }
        .discogs-bar-badge, .discogs-src-badge svg { width: 15px; height: 15px; }
        .discogs-log-menu button svg { vertical-align: -2px; margin-right: 4px; }
        .discogs-bar-row2 {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.35rem 0.75rem;
            flex-wrap: wrap;
        }
        .discogs-bar-row2 .discogs-opts-label {
            font-size: 0.75rem;
            color: var(--mbu-text-weak);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-right: 0.2rem;
            flex-shrink: 0;
        }
        /* Borderless toggles (#118): no pill outline/background \u2014 the dot alone
           signals on/off, matching the maintainer's mockup. */
        .discogs-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.4rem 0.15rem 0.2rem;
            border: none;
            border-radius: 2rem;
            background: transparent;
            cursor: pointer;
            font-size: 0.8rem;
            color: var(--mbu-text-dim);
            user-select: none;
            transition: color 0.12s;
        }
        .discogs-toggle:hover { color: var(--mbu-text); }
        .discogs-toggle input[type=checkbox] { display: none; }
        .discogs-toggle .discogs-toggle-dot {
            position: relative;
            width: 28px; height: 16px;
            border-radius: 9px;
            border: 0;
            background: var(--mbu-border);
            flex-shrink: 0;
            transition: background 0.12s;
        }
        .discogs-toggle .discogs-toggle-dot::after {
            content: ''; position: absolute; top: 2px; left: 2px;
            width: 12px; height: 12px; border-radius: 50%;
            background: var(--mbu-text-weak);
            transition: left 0.12s, background 0.12s;
        }
        .discogs-toggle.active .discogs-toggle-dot::after { left: 14px; background: #fff; }
        .discogs-toggle.active {
            color: var(--mbu-text);
        }
        .discogs-toggle.active .discogs-toggle-dot {
            background: #e8771d;
        }
        .discogs-output { padding: 0.5rem 0.75rem 0.25rem; }
        .discogs-output.empty { display: none; }
        /* closed log and no review: its padding alone left a strip under the bar's row */
        .discogs-output:not(.log-open):has(> .discogs-review-slot:empty) { display: none; }   /* no log yet \u2192 hide the whole section (#142) */
        .discogs-output .summary { margin: 0 0 0.25rem; font-size: 0.88rem; color: var(--mbu-text-dim); }
        .discogs-output .logs { margin: 0; padding-left: 1.2rem; font-size: 0.83rem; }
        /* log panel hides behind the header "Log \u25BE" button (#142); the review
           panel sits in .discogs-review-slot OUTSIDE the panel, always visible. */
        .discogs-log-panel { display: none; }
        .discogs-output.log-open .discogs-log-panel { display: block; }
        .discogs-review-slot:not(:empty) { margin: 0.2rem 0; }
        /* severity filter: Warnings shows only warn lines, Errors only error
           lines \u2014 each view matches its header badge count. "skip" lines
           (unresolved-entity skips, #118) and info lines show only under
           "All"; errors are NOT lumped into the Warnings view. */
        .discogs-output[data-logfilter="warn"] .discogs-log-body .logs > li:not([data-sev="warn"]) { display: none; }
        .discogs-output[data-logfilter="error"] .discogs-log-body .logs > li:not([data-sev="error"]) { display: none; }
        /* \u2500\u2500 Progress / sticky bar \u2500\u2500 */
        /* Pinned during import (is-importing) AND kept pinned afterwards
           (is-pinned, #118) so the WARN/ERR badge stays visible on top while the
           user scrolls the staged edits below. overflow:hidden on .discogs-bar
           rules out position:sticky, so we use fixed + an in-flow spacer that
           reserves row1's height (see .discogs-sticky-spacer). */
        .discogs-bar.is-importing .discogs-bar-row1,
        .discogs-bar.is-pinned .discogs-bar-row1 {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9000;
            background: var(--mbu-bg-raised);
            border-bottom: 1px solid var(--mbu-warn);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        /* Occupies row1's height in the flow while row1 is fixed, so the page
           content below the bar doesn't jump up under it. Height set by JS. */
        .discogs-sticky-spacer { display: none; }
        .discogs-import-label.cancels { cursor: pointer; }
        /* With row1 pinned the bar's box would hold only the spacer: the output below carries the box instead */
        .discogs-bar:is(.is-importing, .is-pinned) { border-color: transparent; background: none; overflow: visible; }
        .discogs-bar:is(.is-importing, .is-pinned) > .discogs-output { border: 1px solid var(--mbu-border); border-radius: 10px; background: var(--mbu-bg-raised); overflow: hidden; }
        .discogs-bar.is-importing .discogs-sticky-spacer,
        .discogs-bar.is-pinned .discogs-sticky-spacer { display: block; }
        .discogs-progress-track {
            height: 5px;
            background: var(--mbu-warn-bg);
            border-radius: 3px;
            overflow: hidden;
        }
        .discogs-progress-fill {
            height: 100%;
            width: 0%;
            background: #e8771d;
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .discogs-progress-fill.indeterminate {
            width: 40%;
            animation: discogs-slide 1.4s ease-in-out infinite;
        }
        @keyframes discogs-slide {
            0%   { margin-left: -40%; }
            100% { margin-left: 100%; }
        }
        .discogs-progress-status {
            font-size: 0.8rem;
            color: var(--mbu-warn);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-recent-logs {
            font-size: 0.78rem;
            color: var(--mbu-text-weak);
            max-height: 3.2rem;
            overflow: hidden;
            line-height: 1.4;
        }
        .discogs-recent-logs span {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-toggle { position: relative; }
        /* An input that password managers leave alone is typed "search"; these
           rules put back the look of a plain text box (Chrome draws a clear
           button and its own inner spacing otherwise). See noPasswordManagers.
           No backticks in here: this whole block is a JS template literal. */
        input.ch-nopw { -webkit-appearance: textfield; appearance: textfield; }
        input.ch-nopw::-webkit-search-decoration,
        input.ch-nopw::-webkit-search-cancel-button,
        input.ch-nopw::-webkit-search-results-button,
        input.ch-nopw::-webkit-search-results-decoration { display: none; -webkit-appearance: none; }
    `;
    document.head.appendChild(style);
    const bar = document.createElement("div");
    bar.className = "discogs-bar";
    bar._runToken = 0;
    const row1 = document.createElement("div");
    row1.className = "discogs-bar-row1";
    const importSources = [];
    if (discogsUrl) importSources.push({ name: "Discogs", url: discogsUrl, run: (g, c, collect) => runImport(discogsUrl, g, c, collect) });
    if (sources.tidal) importSources.push({ name: "Tidal", url: sources.tidal, run: (g, c, collect) => runTidalImport(sources.tidal, g, c, collect) });
    if (sources.qobuz) importSources.push({ name: "Qobuz", url: sources.qobuz, run: (g, c, collect) => runQobuzImport(sources.qobuz, g, c, collect) });
    if (sources.deezer) importSources.push({ name: "Deezer", url: sources.deezer, run: (g, c, collect) => runDeezerImport(sources.deezer, g, c, collect) });
    if (sources.mora) importSources.push({ name: "mora", url: sources.mora, run: (g, c, collect) => runMoraImport(sources.mora, g, c, collect) });
    if (sources.melon) importSources.push({ name: "Melon", url: sources.melon, run: (g, c, collect) => runMelonImport(sources.melon, g, c, collect) });
    if (sources.allmusic) importSources.push({ name: "AllMusic", url: sources.allmusic, run: (g, c, collect) => runAllMusicImport(sources.allmusic, g, c, collect) });
    if (sources.apple) importSources.push({ name: "Apple", url: sources.apple, run: (g, c, collect) => runAppleImport(sources.apple, g, c, collect) });
    if (sources.metalArchives) importSources.push({ name: "Metal Archives", url: sources.metalArchives, run: (g, c, collect) => runMetalArchivesImport(sources.metalArchives, g, c, collect) });
    if (sources.ytmusic) importSources.push({ name: "YouTube Music", url: sources.ytmusic, run: (g, c, collect) => runYtmImport(sources.ytmusic, g, c, collect) });
    if ((meta.titlesRemixCount || 0) > 0) {
      importSources.push({ name: "Titles", url: "", run: (g, c, collect) => runTitlesImport(g, c, collect) });
    }
    const importLabel = document.createElement("span");
    importLabel.className = "discogs-import-label";
    importLabel.innerHTML = `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xNS41IC0xLjUgMTM2LjUgMTM2LjUiIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij4KPHRpdGxlPkNyZWRpdCBIb2FyZGVyPC90aXRsZT4KPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJjaGMwNC1nIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZjlhODI2Ii8+PHN0b3Agb2Zmc2V0PSIuNSIgc3RvcC1jb2xvcj0iI2YzNzIyYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2QwMDA3MCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxnIG9wYWNpdHk9Ii43Ij48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2NiA3MCkgcm90YXRlKDApIHNjYWxlKDEuNTUpIHRyYW5zbGF0ZSgtNjYgLTcwKSI+PGcgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEuOTM1NDgzODcwOTY3NzQxOCI+PGVsbGlwc2UgY3g9IjMwIiBjeT0iODAiIHJ4PSIxNCIgcnk9IjEwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3NiIgcj0iOCIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iNzAiIHI9IjEwIi8+PC9nPjxnIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI1LjE2MTI5MDMyMjU4MDY0NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMjYgODYgbC02IDEyIE0zNCA4OCBsMiAxMiBNNDYgODIgbC00IDE2IE01MiA4NCBsOCAxNCIvPjwvZz48L2c+PGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjYuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNzIgNjIgQzc4IDUyIDg2IDQ4IDkyIDQ4IE03MCA2MiBDNzIgNTIgNzAgNDQgNjQgNDAiLz48L2c+PHBhdGggZD0iTTExMy42IDQ1LjAgTDk4LjAgNTQuMCBMODIuNCA0NS4wIEw4Mi40IDI3LjAgTDk4LjAgMTguMCBMMTEzLjYgMjcuMFoiIGZpbGw9IiNmZmYiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTAgOTggMzYpIi8+PC9nPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDY2IDcwKSByb3RhdGUoMCkgc2NhbGUoMS41NSkgdHJhbnNsYXRlKC02NiAtNzApIj48ZyBmaWxsPSIjMjIyMjNiIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMCI+PGVsbGlwc2UgY3g9IjMwIiBjeT0iODAiIHJ4PSIxNCIgcnk9IjEwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3NiIgcj0iOCIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iNzAiIHI9IjEwIi8+PC9nPjxnIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSIzLjIyNTgwNjQ1MTYxMjkwMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMjYgODYgbC02IDEyIE0zNCA4OCBsMiAxMiBNNDYgODIgbC00IDE2IE01MiA4NCBsOCAxNCIvPjwvZz48L2c+PGcgc3Ryb2tlPSIjMjIyMjNiIiBzdHJva2Utd2lkdGg9IjMuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNzIgNjIgQzc4IDUyIDg2IDQ4IDkyIDQ4IE03MCA2MiBDNzIgNTIgNzAgNDQgNjQgNDAiLz48L2c+PHBhdGggZD0iTTExMy42IDQ1LjAgTDk4LjAgNTQuMCBMODIuNCA0NS4wIEw4Mi40IDI3LjAgTDk4LjAgMTguMCBMMTEzLjYgMjcuMFoiIGZpbGw9InVybCgjY2hjMDQtZykiIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTAgOTggMzYpIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOTggMzcpIHNjYWxlKDAuOSkiIGZpbGw9IiNmZmYiPjxjaXJjbGUgY3g9IjAiIGN5PSItNSIgcj0iNSIvPjxwYXRoIGQ9Ik0tOSA5IEMtOSAwIDkgMCA5IDlaIi8+PC9nPgo8L3N2Zz4K" alt="">`;
    const srcIcons = document.createElement("span");
    srcIcons.className = "discogs-src-icons";
    const ORIG_ICON = {
      Discogs: stIcon("discogs", 16),
      Tidal: stIcon("tidal", 16),
      Qobuz: stIcon("qobuz", 16),
      Deezer: stIcon("deezer", 16),
      mora: stIcon("mora", 16),
      Melon: stIcon("melon", 16),
      AllMusic: stIcon("allmusic", 16),
      Apple: stIcon("apple", 16),
      "YouTube Music": stIcon("ytmusic", 16),
      // #648
      Titles: SRC_ICON.Titles
    };
    const srcButtons = [];
    let importing = false;
    const makeSrcButton = (s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "discogs-src-ico";
      b._icon = ORIG_ICON[s.name] || SRC_ICON[s.name] || s.name;
      b.innerHTML = b._icon;
      b.dataset.src = s.name;
      b.dataset.tip = s.url ? `Import the credits from ${s.name}
Right-click: open the ${s.name} page` : "Import remixer credits\nRead from the track titles";
      b.addEventListener("click", () => {
        if (importing) {
          if (s.url) window.open(s.url, "_blank", "noopener,noreferrer");
          return;
        }
        startImport(b, s.url, s.run);
      });
      if (s.url) b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        window.open(s.url, "_blank", "noopener,noreferrer");
      });
      srcButtons.push(b);
      srcIcons.appendChild(b);
      return b;
    };
    importSources.forEach(makeSrcButton);
    if (meta.sourceProbeFailed && !importSources.length) {
      const warn = document.createElement("span");
      warn.className = "discogs-src-probe-failed";
      warn.style.cssText = "font-size:0.8rem;color:var(--mbu-warn);";
      warn.textContent = "could not read this release\u2019s links from MusicBrainz \u2014 reload to retry";
      warn.dataset.tip = "\u26A0 The linked import sources are unknown\nMusicBrainz\u2019s /ws/js/release lookup failed: it was busy or unreachable.";
      srcIcons.appendChild(warn);
    }
    const makeAllButton = () => {
      if (importSources.length <= 1 || srcIcons.querySelector(".discogs-src-all")) return;
      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "discogs-src-ico discogs-src-all";
      allBtn._icon = '<span class="discogs-all-glyph">\u269B</span><span class="discogs-all-lbl">All</span>';
      allBtn.innerHTML = allBtn._icon;
      allBtn.dataset.src = "All";
      allBtn.dataset.tip = `Import from all ${importSources.length} sources at once
Merged, without duplicates, into one review`;
      allBtn.addEventListener("click", () => {
        if (importing) return;
        startImport(allBtn, "", (g, c) => runConsolidatedImport(importSources, g, c), `Import all (${importSources.map((s) => s.name).join(", ")})`);
      });
      srcButtons.push(allBtn);
      srcIcons.appendChild(allBtn);
    };
    makeAllButton();
    const addTitlesSource = (count) => {
      if (!(count > 0)) return "none";
      if (importSources.some((x) => x.name === "Titles")) return "already";
      const src = { name: "Titles", url: "", run: (g, c, collect) => runTitlesImport(g, c, collect) };
      importSources.push(src);
      makeSrcButton(src);
      makeAllButton();
      return "added";
    };
    bar._addTitlesSource = addTitlesSource;
    const progressPct = document.createElement("span");
    progressPct.id = "discogs-progress-pct";
    progressPct.style.cssText = "display:none; margin-left:0.5rem; font-size:0.85rem; color:var(--mbu-warn); font-weight:bold; min-width:3.5rem;";
    try {
      const gs = typeof GM_info !== "undefined" && GM_info && GM_info.script || {}, host = String(gs.name || "").replace(/\*$/, "");
      importLabel.dataset.tip = (host && host !== "Credit Hoarder" ? "Credit Hoarder (" + host + " v" : "Credit Hoarder v") + (gs.version || "?") + (host && host !== "Credit Hoarder" ? ")" : "");
    } catch (e) {
    }
    importLabel.addEventListener("click", () => {
      if (importing) cancelRun();
    });
    row1.appendChild(importLabel);
    row1.appendChild(srcIcons);
    row1.appendChild(progressPct);
    const actionSlot = document.createElement("div");
    actionSlot.className = "discogs-bar-action";
    row1.appendChild(actionSlot);
    const optsWrap = document.createElement("div");
    optsWrap.className = "discogs-bar-opts";
    row1.appendChild(optsWrap);
    let _optsHost = optsWrap;
    const msgSlot = document.createElement("div");
    msgSlot.className = "discogs-bar-msgs";
    const statusEl = document.createElement("span");
    statusEl.className = "discogs-bar-status";
    statusEl.style.display = "none";
    const warnPill = document.createElement("button");
    warnPill.type = "button";
    warnPill.className = "discogs-badge discogs-badge-warn";
    warnPill.style.display = "none";
    warnPill.dataset.tip = "Show warnings in the log";
    const errPill = document.createElement("button");
    errPill.type = "button";
    errPill.className = "discogs-badge discogs-badge-err";
    errPill.style.display = "none";
    errPill.dataset.tip = "Show errors in the log";
    const unresolvedPill = document.createElement("button");
    unresolvedPill.type = "button";
    unresolvedPill.className = "discogs-badge discogs-badge-unresolved";
    unresolvedPill.style.display = "none";
    unresolvedPill.dataset.tip = "Entities not matched on MusicBrainz\nSkipped on import";
    msgSlot.append(statusEl, warnPill, errPill, unresolvedPill);
    row1.appendChild(msgSlot);
    const rightGroup = document.createElement("div");
    rightGroup.className = "discogs-bar-right";
    const logSplit = document.createElement("span");
    logSplit.className = "discogs-log-split";
    logSplit.style.display = "none";
    const logToggleBtn = document.createElement("button");
    logToggleBtn.type = "button";
    logToggleBtn.className = "discogs-logtoggle-btn";
    logToggleBtn.textContent = "Log";
    logToggleBtn.dataset.tip = "Show or hide the import log";
    const logCaretBtn = document.createElement("button");
    logCaretBtn.type = "button";
    logCaretBtn.className = "discogs-log-caret-btn";
    logCaretBtn.textContent = "\u25BE";
    logCaretBtn.dataset.tip = "More for the log: copy it";
    logSplit.append(logToggleBtn, logCaretBtn);
    const docsHref = typeof GM_info !== "undefined" && (GM_info?.script?.homepageURL || GM_info?.script?.homepage) || "https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md";
    const docsLink = mbuHelpEl("credit_hoarder");
    docsLink.href = docsHref;
    const enterEditBtn = document.createElement("button");
    enterEditBtn.type = "button";
    enterEditBtn.className = "discogs-enter-edit";
    enterEditBtn.textContent = "Enter edit";
    enterEditBtn.dataset.tip = "Submit the staged edits to MusicBrainz\nThe same as MusicBrainz\u2019s Enter edit button at the bottom of the page";
    enterEditBtn.style.display = "none";
    const findNativeSubmit = () => document.querySelector("button.submit.positive") || [...document.querySelectorAll('button[type="submit"], button.submit')].find((b) => /enter edit/i.test(b.textContent || ""));
    enterEditBtn.addEventListener("click", () => {
      const submit = findNativeSubmit();
      if (!submit) {
        bar._setStopMessage(`Could not find MusicBrainz's "Enter edit" button \u2014 scroll down and submit manually.`);
        return;
      }
      submit.scrollIntoView({ behavior: "smooth", block: "center" });
      submit.click();
    });
    bar._showEnterEdit = () => {
      if (findNativeSubmit()) enterEditBtn.style.display = "";
    };
    bar._hideEnterEdit = () => {
      enterEditBtn.style.display = "none";
    };
    rightGroup.append(enterEditBtn, logSplit, docsLink);
    row1.appendChild(rightGroup);
    bar.appendChild(row1);
    const stickySpacer = document.createElement("div");
    stickySpacer.className = "discogs-sticky-spacer";
    bar.appendChild(stickySpacer);
    bar._pin = () => {
      const h = row1.getBoundingClientRect().height;
      if (h) stickySpacer.style.height = h + "px";
    };
    window.addEventListener("resize", () => {
      if (bar.classList.contains("is-pinned")) bar._pin();
    });
    function makeCheckbox(labelText, checkedByDefault, tooltipText) {
      const lbl = document.createElement("label");
      lbl.className = "discogs-toggle" + (checkedByDefault ? " active" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checkedByDefault;
      const dot = document.createElement("span");
      dot.className = "discogs-toggle-dot";
      lbl.appendChild(cb);
      lbl.appendChild(dot);
      lbl.appendChild(document.createTextNode(labelText));
      if (tooltipText) lbl.dataset.tip = tooltipText;
      lbl.addEventListener("click", (e) => {
        e.preventDefault();
        cb.checked = !cb.checked;
        lbl.classList.toggle("active", cb.checked);
      });
      _optsHost.appendChild(lbl);
      return cb;
    }
    function makeSelect(labelText, initialValue, options, tooltipText) {
      const wrap = document.createElement("span");
      wrap.className = "discogs-select-wrap";
      wrap.style.cssText = "display:inline-flex;align-items:center;gap:0.3rem;font-size:0.8rem;color:var(--mbu-text-dim);padding:0.15rem 0.2rem;border:none;background:transparent;";
      const lbl = document.createElement("span");
      lbl.textContent = labelText + ":";
      wrap.appendChild(lbl);
      const sel = document.createElement("select");
      sel.style.cssText = "font-size:0.8rem;padding:0.05rem 0.2rem;border:none;background:transparent;cursor:pointer;color:var(--mbu-text);font-weight:600;";
      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === initialValue) o.selected = true;
        sel.appendChild(o);
      });
      if (tooltipText) wrap.dataset.tip = tooltipText;
      wrap.appendChild(sel);
      _optsHost.appendChild(wrap);
      return sel;
    }
    const gmLoad = (key) => {
      try {
        return GM_getValue(key, void 0);
      } catch (e) {
        return void 0;
      }
    };
    const gmSave = (key, raw) => {
      try {
        GM_setValue(key, raw);
      } catch (e) {
      }
    };
    const OPTS_KEY = "discogs-importer-opts";
    let savedOpts = {};
    try {
      savedOpts = JSON.parse(gmLoad(OPTS_KEY) || "{}");
    } catch (e) {
    }
    if (!savedOpts.createWorksReset421) {
      savedOpts.createWorksMode = "never";
      savedOpts.createWorksReset421 = true;
      delete savedOpts.createWorks;
      try {
        gmSave(OPTS_KEY, JSON.stringify(savedOpts));
      } catch (e) {
      }
    }
    const bv = (k, d) => k in savedOpts ? savedOpts[k] : d;
    const tracklistCb = makeCheckbox(
      "Per-track credits",
      bv("tracklist", true),
      "Import per-track artist credits."
    );
    const applyTracksCb = makeCheckbox(
      "Move release credits to tracks",
      bv("applyTracks", false),
      "Move performance credits from the release down to every recording."
    );
    const useWorksCb = makeCheckbox(
      "Use",
      bv("useWorks", true),
      "Import work-level credits (composer / lyricist / writer \u2026). Off: no work relationship is touched at all \u2014 nothing created, nothing attached to existing works."
    );
    const _initialCreateWorksMode = bv("createWorksMode", "never") === "when-needed" ? "when-needed" : "never";
    const createWorksMode = makeSelect("works", _initialCreateWorksMode, [
      { value: "never", label: "create none" },
      { value: "when-needed", label: "create needed" }
    ], "create none: use only existing works \u2014 work-only credits with no work are logged and skipped. create needed: also create a work when a composer/lyricist/writer credit needs one \u2014 match recordings to EXISTING works first (Group Therapy) or you will create duplicates.");
    const syncWorksUi = () => {
      createWorksMode.disabled = !useWorksCb.checked;
      const w = createWorksMode.closest(".discogs-select-wrap");
      if (w) w.style.opacity = useWorksCb.checked ? "" : ".45";
    };
    syncWorksUi();
    useWorksCb.closest("label").style.paddingRight = "0";
    {
      const w = createWorksMode.closest(".discogs-select-wrap");
      if (w) {
        w.style.paddingLeft = "0";
        w.style.marginLeft = "-0.2rem";
      }
    }
    function showCreateWorksWarning() {
      const ov = document.createElement("div");
      ov.className = "discogs-cw-warn-ov mbu-ui";
      ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(20,10,10,.45);display:flex;align-items:center;justify-content:center;";
      const box = document.createElement("div");
      box.style.cssText = "max-width:460px;margin:16px;background:var(--mbu-bg);border-radius:8px;border-top:4px solid var(--mbu-error);padding:16px 20px 14px;box-shadow:0 14px 44px rgba(0,0,0,.4);font-size:13px;line-height:1.55;color:var(--mbu-text);";
      box.innerHTML = '<div style="font-weight:800;color:var(--mbu-error);font-size:15px;margin-bottom:8px;">\u26A0\uFE0F WARNING: Avoid creating work duplicates!</div><p style="margin:0 0 8px;">Make sure that you <strong>matched works</strong> prior to using this option. You are responsible for matching recordings to existing works.</p><p style="margin:0 0 12px;"><a href="https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/group_therapy/README.md" target="_blank" rel="noopener noreferrer">Group Therapy</a> userscript makes work matching faster and can start it as soon as you enter the relationship editor so you don\u2019t forget.</p><div style="text-align:right;"><button type="button" style="padding:5px 18px;font-size:13px;font-weight:600;color:#fff;background:#c0392b;border:none;border-radius:5px;cursor:pointer;">I understand</button></div>';
      const close = () => ov.remove();
      box.querySelector("button").addEventListener("click", close);
      ov.addEventListener("mousedown", (e) => {
        if (e.target === ov) close();
      });
      ov.appendChild(box);
      document.body.appendChild(ov);
      box.querySelector("button").focus();
    }
    createWorksMode.addEventListener("change", () => {
      if (createWorksMode.value === "when-needed") showCreateWorksWarning();
    });
    useWorksCb.closest("label").addEventListener("click", () => setTimeout(() => {
      syncWorksUi();
      if (useWorksCb.checked && createWorksMode.value === "when-needed") showCreateWorksWarning();
    }, 0));
    const optsBtn = document.createElement("button");
    optsBtn.type = "button";
    optsBtn.className = "discogs-opts-btn";
    optsBtn.innerHTML = 'Options <span class="discogs-opts-caret">\u25BE</span>';
    optsBtn.dataset.tip = "Options: credits, duplicates and matching";
    const optsPanel = document.createElement("div");
    optsPanel.className = "discogs-opts-panel mbu-ui";
    const credHd = document.createElement("div");
    credHd.className = "discogs-opts-panel-hd";
    credHd.textContent = "Credits";
    optsPanel.append(credHd, applyTracksCb.closest("label"));
    const dedupHd = document.createElement("div");
    dedupHd.className = "discogs-opts-panel-hd";
    dedupHd.textContent = "Deduplication";
    optsPanel.appendChild(dedupHd);
    _optsHost = optsPanel;
    const dedupeEqCb = makeCheckbox(
      "Equivalence sets",
      bv("dedupeEquivalenceSets", true),
      "Skip a role when an equivalent role already exists on the target (writer \u2261 composer)."
    );
    const dedupeDupCb = makeCheckbox(
      "Duplicate roles",
      bv("dedupeDuplicateRoles", true),
      "Skip adding a role when the target already has the same role (regardless of task / dates / attributes)."
    );
    _optsHost = optsWrap;
    optsWrap.appendChild(optsBtn);
    document.body.appendChild(optsPanel);
    optsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = optsPanel.classList.toggle("open");
      if (!open) return;
      const r = optsBtn.getBoundingClientRect();
      optsPanel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - optsPanel.offsetWidth - 8)) + "px";
      optsPanel.style.top = r.bottom + 4 + "px";
      const off = (ev) => {
        if (!optsPanel.contains(ev.target) && ev.target !== optsBtn && !optsBtn.contains(ev.target)) {
          optsPanel.classList.remove("open");
          document.removeEventListener("mousedown", off);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", off), 0);
    });
    const saveOpts = () => {
      try {
        gmSave(OPTS_KEY, JSON.stringify({
          tracklist: tracklistCb.checked,
          applyTracks: applyTracksCb.checked,
          useWorks: useWorksCb.checked,
          // #424 master toggle
          createWorksMode: createWorksMode.value,
          createWorksReset421: true,
          // #421 one-time reset already applied — must survive every save
          dedupeEquivalenceSets: dedupeEqCb.checked,
          dedupeDuplicateRoles: dedupeDupCb.checked
        }));
      } catch (e) {
      }
    };
    [tracklistCb, applyTracksCb, useWorksCb, dedupeEqCb, dedupeDupCb].forEach((cb) => cb.closest("label").addEventListener("click", () => setTimeout(saveOpts, 0)));
    createWorksMode.addEventListener("change", saveOpts);
    const outputDiv = document.createElement("div");
    outputDiv.className = "discogs-output empty";
    const LOG_OPEN_KEY = "discogs-importer-log-open";
    const reviewSlot = document.createElement("div");
    reviewSlot.className = "discogs-review-slot";
    setReviewContainer(reviewSlot);
    const logPanel = document.createElement("div");
    logPanel.className = "discogs-log-panel";
    const logToolbar = document.createElement("div");
    logToolbar.className = "discogs-log-toolbar";
    const logFilter = document.createElement("div");
    logFilter.className = "discogs-log-filter";
    [["all", "All"], ["warn", "\u26A0 Warnings"], ["error", "\u26D4 Errors"]].forEach(([f, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "discogs-log-filterbtn" + (f === "all" ? " active" : "");
      b.dataset.f = f;
      b.textContent = label;
      b.addEventListener("click", () => {
        outputDiv.dataset.logfilter = f;
        logFilter.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.f === f));
      });
      logFilter.appendChild(b);
    });
    logToolbar.append(logFilter);
    const logBody = document.createElement("div");
    logBody.className = "discogs-log-body";
    logPanel.append(logToolbar, logBody);
    outputDiv.append(reviewSlot, logPanel);
    outputDiv.dataset.logfilter = "all";
    if (!_logs2) {
      _logs2 = document.createElement("ul");
      _logs2.className = "logs";
      logBody.appendChild(_logs2);
      setLogContainer(_logs2);
      if (_logs2.children.length) outputDiv.classList.remove("empty");
    }
    const applyLogOpen = () => {
      const open = gmLoad(LOG_OPEN_KEY) === "1";
      outputDiv.classList.toggle("log-open", open);
      logSplit.classList.toggle("active", open);
    };
    try {
      applyLogOpen();
    } catch (e) {
    }
    const setLogOpen = (open) => {
      outputDiv.classList.toggle("log-open", open);
      logSplit.classList.toggle("active", open);
      try {
        gmSave(LOG_OPEN_KEY, open ? "1" : "0");
      } catch (e) {
      }
    };
    const logMenu = document.createElement("div");
    logMenu.className = "discogs-log-menu mbu-ui";
    const mkMenuItem = (label, title, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.dataset.tip = title;
      b.addEventListener("click", () => fn(b, label));
      return b;
    };
    const copyLogItem = mkMenuItem("Copy log", "Copy the full import log (incl. the raw source data)", (b, l) => bar._copy?.log(b, l));
    const copyNoJsonItem = mkMenuItem("Copy without JSON", "Copy the log without the raw source-data block \u2014 fits in a GitHub issue", (b, l) => bar._copy?.noJson(b, l));
    logMenu.append(copyLogItem, copyNoJsonItem);
    if (discogsUrl) logMenu.appendChild(mkMenuItem("Copy Discogs", "Copy the raw Discogs JSON for this release", (b, l) => bar._copy?.discogs(b, l)));
    if (sources.tidal) logMenu.appendChild(mkMenuItem("Copy Tidal", "Copy the raw Tidal credits harvest for this release", (b, l) => bar._copy?.tidal(b, l)));
    if (sources.qobuz) logMenu.appendChild(mkMenuItem("Copy Qobuz", "Copy the parsed Qobuz credits for this release", (b, l) => bar._copy?.qobuz(b, l)));
    if (sources.deezer) logMenu.appendChild(mkMenuItem("Copy Deezer", "Copy the parsed Deezer credits for this release", (b, l) => bar._copy?.deezer(b, l)));
    if (sources.mora) logMenu.appendChild(mkMenuItem("Copy mora", "Copy the parsed mora credits for this release", (b, l) => bar._copy?.mora(b, l)));
    if (sources.melon) logMenu.appendChild(mkMenuItem("Copy Melon", "Copy the parsed Melon credits for this release", (b, l) => bar._copy?.melon(b, l)));
    if (sources.allmusic) logMenu.appendChild(mkMenuItem("Copy AllMusic", "Copy the parsed AllMusic credits for this release", (b, l) => bar._copy?.allmusic(b, l)));
    if (sources.apple) logMenu.appendChild(mkMenuItem("Copy Apple", "Copy the parsed Apple credits for this release", (b, l) => bar._copy?.apple(b, l)));
    if (sources.ytmusic) logMenu.appendChild(mkMenuItem("Copy YouTube Music", "Copy the fetched YouTube Music credits for this release", (b, l) => bar._copy?.ytmusic(b, l)));
    if (importSources.length > 1) logMenu.appendChild(mkMenuItem("Copy all", 'Copy the combined JSON of an "Import all" run \u2014 every source plus the merged, de-duplicated result (#408)', (b, l) => bar._copy?.all(b, l)));
    document.body.appendChild(logMenu);
    function openLogMenu() {
      const open = logMenu.classList.toggle("open");
      if (!open) return;
      const r = logSplit.getBoundingClientRect();
      logMenu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - logMenu.offsetWidth - 8)) + "px";
      logMenu.style.top = r.bottom + 4 + "px";
      const off = (ev) => {
        if (!logMenu.contains(ev.target) && !logSplit.contains(ev.target)) {
          logMenu.classList.remove("open");
          document.removeEventListener("mousedown", off);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", off), 0);
    }
    logToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      logMenu.classList.remove("open");
      setLogOpen(!outputDiv.classList.contains("log-open"));
    });
    logCaretBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openLogMenu();
    });
    function openLog(filter, scrollSel) {
      const f = filter || "all";
      outputDiv.classList.add("log-open");
      logSplit.classList.add("active");
      outputDiv.dataset.logfilter = f;
      logFilter.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.f === f));
      requestAnimationFrame(() => {
        const target = scrollSel && logBody.querySelector(scrollSel) || logPanel;
        const headerH = bar.classList.contains("is-pinned") ? row1.getBoundingClientRect().height + 6 : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH - 10;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    }
    warnPill.addEventListener("click", () => openLog("warn", 'li[data-sev="warn"]'));
    errPill.addEventListener("click", () => openLog("error", 'li[data-sev="error"]'));
    unresolvedPill.addEventListener("click", () => openLog("all", 'li[data-sev="skip"]'));
    onLogCounts((w, e) => {
      warnPill.textContent = `\u26A0 ${w}`;
      warnPill.style.display = w > 0 ? "" : "none";
      errPill.textContent = `\u26D4 ${e}`;
      errPill.style.display = e > 0 ? "" : "none";
    });
    bar._setUnresolved = (n) => {
      unresolvedPill.textContent = `\u2298 ${n} unresolved`;
      unresolvedPill.style.display = n > 0 ? "" : "none";
    };
    bar._setStopMessage = (msg) => {
      bar._stopActive = !!msg;
      statusEl.textContent = msg || "";
      statusEl.style.display = msg ? "" : "none";
      statusEl.classList.toggle("discogs-bar-status-final", !!msg);
    };
    function cancelRun() {
      bar._runToken++;
      importing = false;
      if (typeof bar._reviewAbort === "function") {
        const abort = bar._reviewAbort;
        bar._reviewAbort = null;
        abort();
      }
      srcButtons.forEach((b) => {
        b.classList.remove("importing");
        b.style.display = "";
        b.dataset.tip = b._restoreTitle || b.dataset.tip;
      });
      importLabel.dataset.tip = importLabel._restoreTitle || importLabel.dataset.tip;
      importLabel.classList.remove("cancels");
      progressPct.style.display = "none";
      progressPct.textContent = "0%";
      bar.classList.remove("is-importing", "is-reviewing", "is-pinned");
      _hideBar();
      reviewSlot.replaceChildren();
      actionSlot.replaceChildren();
      setReviewContainer(reviewSlot);
      bar._hideEnterEdit();
      bar._setStopMessage("Import cancelled \u2014 pick a source to start again.");
      bar._pin();
      delete bar._setProgress;
    }
    function startImport(srcBtn, sourceUrl, runner, sourceLabel) {
      const myToken = ++bar._runToken;
      const cancelled = () => bar._runToken !== myToken;
      importing = true;
      srcButtons.forEach((b) => {
        const active = b === srcBtn;
        b.classList.toggle("importing", active);
        b.style.display = active ? "" : "none";
        if (active) {
          b._restoreTitle = b.dataset.tip;
          b.dataset.tip = `Importing from ${srcBtn.dataset.src}${sourceUrl ? `
Click: open the ${srcBtn.dataset.src} page` : ""}`;
        }
      });
      importLabel._restoreTitle = importLabel.dataset.tip;
      importLabel.dataset.tip = `Cancel this ${srcBtn.dataset.src} import
Back to the sources`;
      importLabel.classList.add("cancels");
      progressPct.style.display = "inline";
      progressPct.textContent = "0%";
      bar._hideEnterEdit();
      bar.classList.add("is-importing", "is-pinned");
      bar._pin();
      _showBar();
      bar.scrollIntoView({ behavior: "smooth", block: "start" });
      bar._showProgress = () => {
        _showBar();
      };
      requestAnimationFrame(bar._showProgress);
      resetLogCounts();
      bar._setUnresolved(0);
      bar._setStopMessage("");
      _logs2 = document.createElement("ul");
      _logs2.className = "logs";
      setLogContainer(_logs2);
      _summary = document.createElement("p");
      _summary.className = "summary";
      logBody.innerHTML = "";
      logBody.appendChild(_summary);
      logBody.appendChild(_logs2);
      outputDiv.classList.remove("empty");
      logSplit.style.display = "";
      try {
        applyLogOpen();
      } catch (e) {
      }
      function buildCopyText({ skipDiscogsJson }) {
        function htmlToMd(el) {
          function nodeToMd(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            const tag = node.tagName?.toLowerCase();
            const inner = [...node.childNodes].map(nodeToMd).join("");
            if (tag === "strong" || tag === "b") return `**${inner}**`;
            if (tag === "em" || tag === "i") return `_${inner}_`;
            if (tag === "a") return `[${inner}](${node.href})`;
            if (tag === "br") return "\n";
            if (tag === "pre") {
              return "\n```json\n" + node.textContent + "\n```\n";
            }
            if (tag === "details") {
              const sum = node.querySelector("summary");
              const sumText = sum ? [...sum.childNodes].map((n) => {
                if (n.nodeType === Node.TEXT_NODE) return n.textContent;
                const t = n.tagName?.toLowerCase();
                if (t === "button" || t === "input") return "";
                return n.textContent;
              }).join("").trim() : "";
              if (skipDiscogsJson && /raw Discogs JSON/i.test(sumText)) {
                return "";
              }
              const body = [...node.childNodes].filter((n) => n !== sum).map(nodeToMd).join("");
              return "\n\n<details><summary>" + sumText + "</summary>\n\n" + body + "\n</details>\n\n";
            }
            if (tag === "summary") return "";
            if (tag === "span") return inner;
            if (tag === "div") return inner + "\n";
            if (tag === "ul") return inner;
            if (tag === "li" && el !== node) return "- " + inner + "\n";
            if (tag === "table") {
              const rows = [...node.querySelectorAll("tr")];
              if (!rows.length) return "";
              const cells = rows.map((r) => [...r.querySelectorAll("th,td")].map((c) => c.innerText.trim().replace(/\|/g, "\\|")));
              const widths = cells[0]?.map((_, i) => Math.max(...cells.map((r) => (r[i] || "").length), 3));
              const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.length));
              const mdRows = cells.map((row) => "| " + row.map((c, i) => pad(c, widths[i])).join(" | ") + " |");
              if (mdRows.length > 1) mdRows.splice(1, 0, "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |");
              return "\n\n" + mdRows.join("\n") + "\n\n";
            }
            return inner;
          }
          const _md = nodeToMd(el);
          return _md.startsWith("\n\n") || _md.endsWith("\n\n") ? _md : _md.replace(/^\n/, "").replace(/\n$/, "");
        }
        const _panel = document.querySelector(".discogs-review-slot .discogs-review-panel-li");
        const lines = [..._panel ? [_panel] : [], ..._logs2.querySelectorAll("li")].map((li) => {
          if (li.classList?.contains("discogs-review-panel-li") && typeof li._buildStaticTableLi === "function") {
            return htmlToMd(li._buildStaticTableLi());
          }
          const md = htmlToMd(li);
          if (!md) return "";
          if (md.startsWith("\n\n|") || md.startsWith("<details>")) return md;
          return md + "  ";
        }).filter(Boolean).join("\n");
        const releaseName = pageWindow?.MB?.relationshipEditor?.state?.entity?.name || document.title.replace(/ - MusicBrainz.*/, "").trim() || "Import log";
        return `<details><summary>${releaseName}</summary>

${lines}

</details>`;
      }
      function copyToClipboard(text, btn, restoreText) {
        const restore = () => {
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = restoreText;
          }, 1500);
        };
        const fallback = () => {
          const ta = Object.assign(document.createElement("textarea"), { value: text });
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          restore();
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(restore, fallback);
        } else {
          fallback();
        }
      }
      bar._copy = {
        log: (item, label) => copyToClipboard(buildCopyText({ skipDiscogsJson: false }), item, label),
        noJson: (item, label) => copyToClipboard(buildCopyText({ skipDiscogsJson: true }), item, label),
        discogs: (item, label) => {
          if (_discogsJson) copyToClipboard(JSON.stringify(_discogsJson, null, 2), item, label);
        },
        tidal: (item, label) => {
          if (_tidalJson) copyToClipboard(JSON.stringify(_tidalJson, null, 2), item, label);
        },
        qobuz: (item, label) => {
          if (_qobuzJson) copyToClipboard(JSON.stringify(_qobuzJson, null, 2), item, label);
        },
        deezer: (item, label) => {
          if (_deezerJson) copyToClipboard(JSON.stringify(_deezerJson, null, 2), item, label);
        },
        mora: (item, label) => {
          if (_moraJson) copyToClipboard(JSON.stringify(_moraJson, null, 2), item, label);
        },
        melon: (item, label) => {
          if (_melonJson) copyToClipboard(JSON.stringify(_melonJson, null, 2), item, label);
        },
        allmusic: (item, label) => {
          if (_allmusicJson) copyToClipboard(JSON.stringify(_allmusicJson, null, 2), item, label);
        },
        apple: (item, label) => {
          if (_appleJson) copyToClipboard(JSON.stringify(_appleJson, null, 2), item, label);
        },
        // #435
        ytmusic: (item, label) => {
          if (_ytmJson) copyToClipboard(JSON.stringify(_ytmJson, null, 2), item, label);
        },
        // #648
        all: (item, label) => {
          if (_consolidatedJson) copyToClipboard(JSON.stringify(_consolidatedJson, null, 2), item, label);
        }
        // #408
      };
      bar._setProgress = (pct, text) => {
        if (pct !== null && pct >= 100) _hideBar();
        if (text && bar.classList.contains("is-importing") && !bar._stopActive) {
          statusEl.textContent = text;
          statusEl.style.display = "";
        }
      };
      requestAnimationFrame(_showBar);
      const getOpts = () => ({
        processTracklist: tracklistCb.checked,
        applyToTracks: applyTracksCb.checked,
        // #424: "Use works" off → dispatch sees mode 'off' and touches no work rels
        createWorksMode: useWorksCb.checked ? createWorksMode.value : "off",
        dedupeEquivalenceSets: dedupeEqCb.checked,
        dedupeDuplicateRoles: dedupeDupCb.checked
      });
      const _click = getOpts();
      const opts = `per-track:${_click.processTracklist ? "on" : "off"}, move-to-tracks:${_click.applyToTracks ? "on" : "off"}, create-works:${_click.createWorksMode}`;
      const editNote = buildEditNote(sourceUrl, opts, void 0, sourceLabel);
      editNote.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const html = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
        log.info(html);
      });
      runner(getOpts, cancelled).finally(() => {
        if (cancelled()) {
          delete bar._setProgress;
          return;
        }
        importing = false;
        srcButtons.forEach((b) => {
          b.classList.remove("importing");
          b.style.display = "";
          b.dataset.tip = b._restoreTitle || b.dataset.tip;
        });
        importLabel.dataset.tip = importLabel._restoreTitle || importLabel.dataset.tip;
        importLabel.classList.remove("cancels");
        progressPct.textContent = "100%";
        setTimeout(() => {
          progressPct.style.display = "none";
        }, 2e3);
        bar.classList.remove("is-reviewing");
        setTimeout(() => {
          bar.classList.remove("is-importing");
          _hideBar();
          bar._showEnterEdit();
          bar._pin();
        }, 2e3);
        delete bar._setProgress;
      });
    }
    bar.appendChild(outputDiv);
    function insertBar() {
      const tabs = document.querySelector("#content > .tabs");
      if (tabs && /\/edit-relationships\b/.test(location.pathname)) {
        const gt = document.querySelector("#content > .gt-toolbar");
        if (gt) gt.before(bar);
        else tabs.after(bar);
        return;
      }
      const hd = document.querySelector("#content .releaseheader");
      if (hd) {
        hd.before(bar);
        return;
      }
      const anchor = document.querySelector(".release-rel-editor") || // MB React wrapper
      document.querySelector("#content > div") || // generic first content div
      document.querySelector("#content");
      if (!anchor) return setTimeout(insertBar, 300);
      anchor.insertBefore(bar, anchor.firstChild);
    }
    insertBar();
    (function watchSubmit() {
      const findMsg = () => [...document.querySelectorAll(".loading-message, .submitting")].find((el) => /submit/i.test(el.textContent || ""));
      const set = (on) => {
        if (!!bar._saving === on) return;
        bar._saving = on;
        bar.classList.toggle("is-saving", on);
        if (on) {
          bar.classList.add("is-pinned");
          bar._pin?.();
          _showBar();
          bar._setStopMessage("\u23F3 Submitting edits to MusicBrainz\u2026");
        } else bar._setStopMessage("");
      };
      const obs = new MutationObserver(() => set(!!findMsg()));
      obs.observe(document.body, { childList: true, subtree: true });
      set(!!findMsg());
    })();
  }
  (function pruneLocalStorage() {
    try {
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (localStorage.getItem("ch:ls-pruned") === today) return;
      localStorage.setItem("ch:ls-pruned", today);
      const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const drop = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("discogs-release-")) drop.push(k);
        else if (k.startsWith("discogs-urlcheck-")) {
          let date = null;
          try {
            date = JSON.parse(localStorage.getItem(k)).date;
          } catch (e) {
          }
          if (!date || date < cutoff) drop.push(k);
        }
      }
      drop.forEach((k) => localStorage.removeItem(k));
      if (drop.length) logDebug(`localStorage prune: removed ${drop.length} expired URL-check entr${drop.length === 1 ? "y" : "ies"}`);
    } catch (e) {
    }
  })();
  function runImport(discogsUrl, getOpts, cancelled, collect) {
    const initial = getOpts();
    const { processTracklist } = initial;
    return getDiscogsReleaseData(discogsUrl).then((json) => {
      _discogsJson = json;
      let artistRoles = rolesFromDiscogsArtists(json.extraartists?.filter((artist) => !artist.tracks));
      if (!_logs2._releaseInfoAdded) {
        _logs2._releaseInfoAdded = true;
        const trackCount = flattenTracklist(json.tracklist).filter((t) => t.type_ === "track").length;
        const summary = `${json.title || ""}${json.year ? " \xB7 " + json.year : ""} \xB7 ${trackCount} tracks`;
        const li = document.createElement("li");
        const pre = document.createElement("pre");
        pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
        pre.textContent = JSON.stringify(json, null, 2);
        li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${summary} \u2014 raw Discogs JSON</strong></summary></details>`;
        li.querySelector("details").appendChild(pre);
        _logs2.appendChild(li);
      }
      log.info(`Found ${json.companies.length + artistRoles.length} release relationships`);
      artistRoles = artistRoles.concat(convertPotentialDJMixers(json));
      let tracklistRels = [];
      if (processTracklist) {
        tracklistRels = flattenTracklist(json.tracklist).filter((track) => track.type_ === "track").reduce((map, track) => {
          if (!track.extraartists || !Array.isArray(track.extraartists)) {
            return map;
          }
          return map.concat(
            rolesFromDiscogsArtists(track.extraartists).map((rel) => {
              return Object.assign({}, rel, {
                track
              });
            })
          );
        }, []);
        const releaseLevelTracklistRels = json.extraartists?.filter((artist) => artist.tracks && artist.tracks !== "") || [];
        if (releaseLevelTracklistRels.length > 0) {
          tracklistRels = tracklistRels.concat(
            releaseLevelTracklistRels.reduce((array, artist) => {
              return array.concat(
                getAllArtistTracks(json.tracklist, artist.tracks).reduce((array2, track) => {
                  return array2.concat(
                    getArtistRoles(artist).map((rel) => {
                      return Object.assign({}, rel, {
                        artist,
                        track
                      });
                    })
                  );
                }, [])
              );
            }, [])
          );
        }
        log.info(`Found ${tracklistRels.length} tracklist relationships`);
      }
      const parts = { companies: json.companies, artistRoles, tracklistRels, tracklist: json.tracklist, sourceUrl: discogsUrl, processTracklist };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    });
  }
  function runTidalImport(tidalUrl, getOpts, cancelled, collect) {
    log.info(`Opening the Tidal credits tab \u2014 it closes itself once harvested (a few seconds)\u2026`);
    return harvestTidalAlbum(tidalUrl).then((harvest) => {
      _tidalJson = harvest;
      if (!harvest.ok) throw new Error(`Tidal harvest failed: ${harvest.error || "unknown error"}`);
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(harvest, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${harvest.tracks.length} tracks \u2014 raw Tidal harvest</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      const processTracklist = !!getOpts().processTracklist;
      const { tracklistRels: ptRels, tracklist, skipped, multiVolume } = tidalToEngine(harvest.tracks);
      const tracklistRels = processTracklist ? ptRels : [];
      const { artists: relArtists, publishers: relPublishers, companies: relCompanies, skipped: relSkipped } = tidalReleaseArtists(harvest.releaseCredits);
      const artistRoles = [...relPublishers];
      for (const a of relArtists) {
        const roles = getArtistRoles(a);
        if (!roles.length) {
          relSkipped.push(`release: ${a.tidalRole} \u2014 ${a.name}`);
          continue;
        }
        if (a.assistant) roles.forEach((r) => {
          r.attributes = (r.attributes || []).concat("assistant");
        });
        artistRoles.push(...roles);
      }
      const companies = relCompanies || [];
      log.info(`Tidal credits: ${tracklistRels.length} per-track + ${artistRoles.length} release-level relationship(s)${companies.length ? ` + ${companies.length} label/company` : ""} across ${tracklist.length} track(s)`);
      if (!processTracklist) log.info(`Per-track credits disabled \u2014 importing release-level credits only${getOpts().applyToTracks ? " (applied to tracks)" : ""}.`);
      (processTracklist ? skipped.concat(relSkipped) : relSkipped).forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn(`Multi-volume Tidal album \u2014 track numbers repeat per volume; positions may not all match this release's mediums. Review carefully.`);
      if (!tracklistRels.length && !artistRoles.length && !companies.length) {
        log.warn("No importable credits found on the Tidal credits page.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies, artistRoles, tracklistRels, tracklist, sourceUrl: tidalUrl, processTracklist };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runMetalArchivesImport(maUrl, getOpts, cancelled, collect) {
    log.info(`Opening the Metal Archives tab \u2014 it closes itself once harvested (a few seconds)\u2026`);
    return harvestMetalArchivesAlbum(maUrl).then((harvest) => {
      _maJson = harvest;
      if (!harvest.ok) throw new Error(`Metal Archives harvest failed: ${harvest.error || "unknown error"}`);
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(harvest, null, 2);
      const nCredited = (harvest.band?.length || 0) + (harvest.guest?.length || 0) + (harvest.misc?.length || 0);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${(harvest.tracks || []).length} tracks, ${nCredited} credited \u2014 raw Metal Archives harvest</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      const processTracklist = !!getOpts().processTracklist;
      const { tracklistRels: ptRels, tracklist, skipped, multiVolume } = metalArchivesToEngine(harvest);
      const tracklistRels = processTracklist ? ptRels : [];
      const { artists: relArtists, skipped: relSkipped } = metalArchivesReleaseArtists(harvest);
      const artistRoles = [];
      for (const a of relArtists) {
        const roles = getArtistRoles(a);
        if (!roles.length) {
          relSkipped.push(`release: ${a.maRole} \u2014 ${a.name}`);
          continue;
        }
        if (a.maAttrs && a.maAttrs.length) roles.forEach((r) => {
          r.attributes = (r.attributes || []).concat(a.maAttrs);
        });
        artistRoles.push(...roles);
      }
      const companies = [];
      log.info(`Metal Archives: ${tracklistRels.length} per-track + ${artistRoles.length} release-level relationship(s) across ${tracklist.length} track(s)`);
      if (!processTracklist) log.info(`Per-track credits disabled \u2014 importing release-level credits only${getOpts().applyToTracks ? " (applied to tracks)" : ""}.`);
      (processTracklist ? skipped.concat(relSkipped) : relSkipped).forEach((s) => log.info(`Not imported: ${s}`));
      if (harvest.multiBand) log.warn(`Multi-artist release (${harvest.type}) \u2014 split/collaboration credits may need per-band track scoping; review carefully.`);
      if (multiVolume) log.warn(`Multi-disc release \u2014 positions are "disc-track"; verify they line up with this release's mediums.`);
      if (!tracklistRels.length && !artistRoles.length) {
        log.warn("No importable credits found on the Metal Archives page.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies, artistRoles, tracklistRels, tracklist, sourceUrl: maUrl, processTracklist };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runQobuzImport(qobuzUrl, getOpts, cancelled, collect) {
    const parsed = parseQobuzAlbumUrl(qobuzUrl);
    if (!parsed) {
      log.error(`Not a Qobuz album URL: ${qobuzUrl}`);
      return Promise.resolve();
    }
    const finish = (via, albumInfo, tracks) => {
      _qobuzJson = { via, source: via === "API" ? `album/get (${parsed.id})` : parsed.pageUrl, album: albumInfo, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_qobuzJson, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${albumInfo || "Qobuz album"} \xB7 ${tracks.length} tracks \u2014 parsed Qobuz credits (${via === "API" ? "API" : "page"})</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      if (!tracks.length) {
        log.warn("No Qobuz credits found \u2014 nothing to import.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const { tracklistRels, artistRoles, tracklist, skipped, multiVolume } = qobuzToEngine(tracks);
      log.info(`Qobuz credits: ${tracklistRels.length} per-track relationship(s)${artistRoles.length ? ` + ${artistRoles.length} release-level relationship(s)` : ""} across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn(`Multi-medium Qobuz album \u2014 track numbers repeat per medium; positions may not all match this release's mediums. Review carefully.`);
      if (!tracklistRels.length && !artistRoles.length) {
        log.warn("No importable Qobuz credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles, tracklistRels, tracklist, sourceUrl: qobuzUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    };
    const scrape = () => {
      log.info(`Fetching Qobuz store page: ${parsed.pageUrl}`);
      return fetchQobuzAlbumPage(parsed.pageUrl).then((html) => finish("page", extractQobuzAlbumInfo(html), extractQobuzCredits(html))).catch((err) => {
        log.error(err.message || String(err));
      });
    };
    const token = qobuzToken();
    if (token) {
      log.info(`Fetching Qobuz credits via album/get (signed in): album ${parsed.id}`);
      return fetchQobuzApiAlbum(parsed.id, token).then((json) => finish("API", qobuzApiAlbumInfo(json), parseQobuzApiTracks(json))).catch((err) => {
        log.warn(`Qobuz API failed (${err.message || err}) \u2014 falling back to the store page`);
        return scrape();
      });
    }
    return scrape();
  }
  function runDeezerImport(deezerUrl, getOpts, cancelled, collect) {
    const parsed = parseDeezerAlbumUrl(deezerUrl);
    if (!parsed) {
      log.error(`Not a Deezer album URL: ${deezerUrl}`);
      return Promise.resolve();
    }
    log.info(`Fetching Deezer album page: ${parsed.pageUrl}`);
    return fetchDeezerAlbumPage(parsed.pageUrl).then((html) => {
      const albumInfo = extractDeezerAlbumInfo(html);
      const tracks = extractDeezerCredits(html);
      _deezerJson = { source: parsed.pageUrl, album: albumInfo, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_deezerJson, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${albumInfo || "Deezer album"} \xB7 ${tracks.length} tracks \u2014 parsed Deezer credits (page)</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      if (!tracks.length) {
        log.warn("No Deezer credits found \u2014 nothing to import.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const { tracklistRels, tracklist, skipped, multiVolume } = deezerToEngine(tracks);
      log.info(`Deezer credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn(`Multi-medium Deezer album \u2014 track numbers repeat per medium; positions may not all match this release's mediums. Review carefully.`);
      if (!tracklistRels.length) {
        log.warn("No importable Deezer credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: deezerUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runMoraImport(moraUrl, getOpts, cancelled, collect) {
    const parsed = parseMoraPackageUrl(moraUrl);
    if (!parsed) {
      log.error(`Not a mora package URL: ${moraUrl}`);
      return Promise.resolve();
    }
    log.info(`Fetching mora package page: ${parsed.pageUrl}`);
    return fetchMoraPackage(parsed.pageUrl).then(({ metaUrl, json }) => {
      logDebug(`mora packageMeta.json: ${metaUrl}`);
      const albumInfo = moraAlbumInfo(json);
      const tracks = extractMoraCredits(json);
      _moraJson = { source: metaUrl, album: albumInfo, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_moraJson, null, 2);
      li.innerHTML = '<details><summary style="cursor:pointer;user-select:none;"><strong></strong></summary></details>';
      li.querySelector("strong").textContent = `${albumInfo || "mora package"} \xB7 ${tracks.length} tracks \u2014 parsed mora credits`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      const { tracklistRels, tracklist, skipped, multiVolume } = moraToEngine(tracks);
      log.info(`mora credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn("Multi-medium mora package \u2014 track numbers repeat per medium; positions may not all match this release's mediums. Review carefully.");
      if (!tracklistRels.length) {
        log.warn("No importable mora credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: moraUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runMelonImport(melonUrl, getOpts, cancelled, collect) {
    const parsed = parseMelonAlbumUrl(melonUrl);
    if (!parsed) {
      log.error(`Not a Melon album URL: ${melonUrl}`);
      return Promise.resolve();
    }
    log.info(`Fetching Melon album ${parsed.id}: song list, then each song page`);
    return fetchMelonCredits(parsed.id).then(({ album, tracks }) => {
      tracks.filter((t) => t.error).forEach((t) => log.warn(`Melon song ${t.songId} (${t.disc}.${t.index} "${t.title}"): ${t.error}`));
      tracks.forEach((t) => logDebug(`Melon ${t.disc}.${t.index} "${t.title}": ${t.credits.map((c) => c.name + " (" + c.roles.join(", ") + ")").join("; ") || "no credits"}`));
      _melonJson = { source: parsed.pageUrl, album, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_melonJson, null, 2);
      li.innerHTML = '<details><summary style="cursor:pointer;user-select:none;"><strong></strong></summary></details>';
      li.querySelector("strong").textContent = `${album || "Melon album"} \xB7 ${tracks.length} tracks \u2014 parsed Melon credits`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      const { tracklistRels, tracklist, skipped, multiVolume } = melonToEngine(tracks);
      log.info(`Melon credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn("Multi-disc Melon album \u2014 track numbers repeat per disc; positions may not all match this release's mediums. Review carefully.");
      if (!tracklistRels.length) {
        log.warn("No importable Melon credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: melonUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runAllMusicImport(amUrl, getOpts, cancelled, collect) {
    const parsed = parseAllMusicReleaseUrl(amUrl);
    if (!parsed) {
      log.error(`Not an AllMusic release URL: ${amUrl}`);
      return Promise.resolve();
    }
    log.info(`Fetching AllMusic release ${parsed.id} from TiVo's API`);
    return fetchAllMusicCredits({ id: parsed.id }).then((res) => {
      if (!res) {
        log.warn(`AllMusic API has no release ${parsed.id}`);
        stopMsg(collect, "Release not found on AllMusic");
        return;
      }
      const { title, tracks } = res;
      tracks.forEach((t) => logDebug(`AllMusic ${t.disc}.${t.index} "${t.title}": ${t.credits.map((c) => c.name + " (" + c.role + ")").join("; ") || "no credits"}`));
      _allmusicJson = { source: parsed.pageUrl, title, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_allmusicJson, null, 2);
      li.innerHTML = '<details><summary style="cursor:pointer;user-select:none;"><strong></strong></summary></details>';
      li.querySelector("strong").textContent = `${title || "AllMusic release"} \xB7 ${tracks.length} tracks \u2014 parsed AllMusic credits`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      const { tracklistRels, tracklist, skipped, multiVolume } = allMusicToEngine(tracks);
      log.info(`AllMusic credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn("Multi-disc AllMusic release \u2014 track numbers repeat per disc; positions may not all match this release's mediums. Review carefully.");
      if (!tracklistRels.length) {
        log.warn("No importable AllMusic credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: amUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runAppleImport(appleUrl, getOpts, cancelled, collect) {
    const parsed = parseAppleAlbumUrl(appleUrl);
    if (!parsed) {
      log.error(`Not an Apple Music album URL: ${appleUrl}`);
      return Promise.resolve();
    }
    log.info(`Fetching Apple Music credits (anonymous): album ${parsed.id} (${parsed.storefront})`);
    return fetchAppleCredits(parsed.storefront, parsed.id, (d, n) => document.querySelector(".discogs-bar")?._setProgress?.(null, `Apple ${d}/${n}`)).then(({ album, tracks }) => {
      _appleJson = { source: appleUrl, album, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_appleJson, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${album || "Apple album"} \xB7 ${tracks.length} tracks \u2014 parsed Apple credits (API)</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      if (!tracks.length) {
        log.warn("No Apple credits found (Apple has no credit data for this album, or none of its tracks list credits) \u2014 nothing to import.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const { tracklistRels, tracklist, skipped, multiVolume } = appleToEngine(tracks);
      log.info(`Apple credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn(`Multi-medium Apple album \u2014 track numbers repeat per medium; positions may not all match this release's mediums. Review carefully.`);
      if (!tracklistRels.length) {
        log.warn("No importable Apple credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: appleUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function editorMediumSizes() {
    try {
      const MB2 = pageWindow.MB, st = MB2?.relationshipEditor?.state;
      if (!st?.mediums || !MB2.tree?.iterate) return [];
      const sizes = [];
      for (const entry of MB2.tree.iterate(st.mediums)) {
        const medium = Array.isArray(entry) ? entry[1] : entry;
        const tracks = medium?.tracks ?? medium;
        let n = 0;
        for (const t of MB2.tree.iterate(tracks)) if (t) n++;
        sizes.push(n);
      }
      return sizes;
    } catch (e) {
      logDebug(`YouTube Music: couldn't read the release's mediums from the editor \u2014 ${e.message}`);
      return [];
    }
  }
  function runYtmImport(ytmUrl, getOpts, cancelled, collect) {
    log.info(`Fetching YouTube Music credits (anonymous): ${ytmUrl}`);
    return fetchYtmCredits(ytmUrl, (d, n) => document.querySelector(".discogs-bar")?._setProgress?.(null, `YouTube Music ${d}/${n}`)).then(({ album, list, songs }) => {
      _ytmJson = { source: ytmUrl, album, list, songs };
      const credited = songs.filter((s) => Object.keys(s.sections || {}).length).length;
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:var(--mbu-bg-raised);padding:0.5rem;border:1px solid var(--mbu-border);border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_ytmJson, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${album || "YouTube Music album"} \xB7 ${songs.length} songs, ${credited} with credits \u2014 YouTube Music credits (API)</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      if (!credited) {
        log.warn("No YouTube Music credits found (the label sent none for this album) \u2014 nothing to import.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const sizes = editorMediumSizes();
      const { tracklistRels, tracklist, skipped, multiMedium, mismatch } = ytmToEngine(songs, sizes);
      log.info(`YouTube Music credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} song(s); release mediums: ${sizes.length ? sizes.join(" + ") : "unknown"}`);
      skipped.forEach((s) => log.info(`Not imported: ${s}`));
      if (mismatch) log.warn(`Multi-medium release: YouTube Music has ${songs.length} songs, the release ${sizes.reduce((a, b) => a + b, 0)} tracks (${sizes.join(" + ")}) \u2014 songs can't be placed on the right mediums. Review carefully.`);
      else if (multiMedium) log.info(`Multi-medium release: YouTube Music's straight-through numbering mapped onto ${sizes.length} mediums (${sizes.join(" + ")}).`);
      if (!tracklistRels.length) {
        log.warn("No importable YouTube Music credits found.");
        stopMsg(collect, "No importable credits found");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: ytmUrl, processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function buildTitlesTracklist(mbid) {
    return fetchWithRetry(`/ws/2/release/${mbid}?inc=recordings&fmt=json`).then((json) => {
      const media = json?.media || [];
      const multiMedium = media.length > 1;
      const tracklist = [];
      for (const medium of media) {
        const medPos = medium.position;
        for (const t of medium.tracks || []) {
          const pos = t.position != null ? t.position : t.number;
          tracklist.push({
            position: multiMedium && medPos != null && pos != null ? `${medPos}-${pos}` : String(pos != null ? pos : ""),
            title: t.title || t.recording?.title || "",
            type_: "track"
          });
        }
      }
      return tracklist;
    });
  }
  function probeTitleRemixes(mbid) {
    if (!mbid) return Promise.resolve({ count: 0, tracklist: [] });
    return buildTitlesTracklist(mbid).then((tracklist) => ({ count: deriveRemixRoles(tracklist).length, tracklist })).catch(() => ({ count: 0, tracklist: [] }));
  }
  function runTitlesImport(getOpts, cancelled, collect) {
    const m = location.pathname.match(/release\/([0-9a-f-]{36})/i);
    if (!m) {
      log.error("Not on a release page \u2014 cannot read track titles.");
      return Promise.resolve();
    }
    log.info("Reading track titles from MusicBrainz to derive remixer credits\u2026");
    return buildTitlesTracklist(m[1]).then((tracklist) => {
      const tracklistRels = deriveRemixRoles(tracklist, m[1]);
      log.info(`Derived <strong>${tracklistRels.length}</strong> remixer credit(s) from ${tracklist.length} track title(s)`);
      if (!tracklistRels.length) {
        log.warn("No named remixes found in the track titles \u2014 nothing to import.");
        stopMsg(collect, "No remixes found in titles");
        return;
      }
      const parts = { companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: "", processTracklist: true };
      return collect ? parts : runSourcePipeline({ ...parts, getOpts, cancelled });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  var stopMsg = (collect, msg) => {
    if (!collect) document.querySelector(".discogs-bar")?._setStopMessage?.(msg);
  };
  async function runConsolidatedImport(importSources, getOpts, cancelled) {
    const isCancelled = () => typeof cancelled === "function" && cancelled();
    log.info(`Import all: harvesting ${importSources.length} sources\u2026`);
    const harvests = [];
    for (const s of importSources) {
      if (isCancelled()) return;
      try {
        const parts = await s.run(getOpts, cancelled, true);
        const n = (parts?.artistRoles?.length || 0) + (parts?.tracklistRels?.length || 0) + (parts?.companies?.length || 0);
        if (parts && n) {
          harvests.push({ ...parts, sourceName: s.name });
          log.info(`${s.name}: ${n} credit(s) collected`);
        } else log.info(`${s.name}: no importable credits`);
      } catch (e) {
        log.warn(`${s.name} failed: ${e.message || e}`);
      }
    }
    if (isCancelled()) return;
    if (!harvests.length) {
      log.warn("Import all: no credits from any source.");
      document.querySelector(".discogs-bar")?._setStopMessage?.("No importable credits found");
      return;
    }
    const merged = mergeHarvests(harvests);
    const total = merged.artistRoles.length + merged.tracklistRels.length;
    log.info(`Import all: <strong>${total}</strong> unique credit(s) from ${harvests.length} source(s) after de-duplication.`);
    _consolidatedJson = {
      via: "consolidated",
      sources: harvests.map((h) => h.sourceName),
      discogs: _discogsJson,
      tidal: _tidalJson,
      qobuz: _qobuzJson,
      deezer: _deezerJson,
      mora: _moraJson,
      melon: _melonJson,
      allmusic: _allmusicJson,
      apple: _appleJson,
      ytmusic: _ytmJson,
      merged: { companies: merged.companies, artistRoles: merged.artistRoles, tracklistRels: merged.tracklistRels }
    };
    return runSourcePipeline({
      companies: merged.companies,
      artistRoles: merged.artistRoles,
      tracklistRels: merged.tracklistRels,
      tracklist: merged.tracklist,
      sourceUrl: "",
      processTracklist: merged.tracklistRels.length > 0 || merged.processTracklist,
      getOpts,
      cancelled,
      entitySources: merged.entitySources,
      sourceLabel: `Import all (${harvests.map((h) => h.sourceName).join(", ")})`
      // #408: edit note names the real sources
    });
  }
  function runSourcePipeline({ companies, artistRoles, tracklistRels, tracklist, sourceUrl, processTracklist, getOpts, cancelled, entitySources, sourceLabel }) {
    const isCancelled = () => typeof cancelled === "function" && cancelled();
    {
      const h = hoistFullSpanArtworkRels(artistRoles, tracklistRels, tracklist);
      if (h.hoisted.length) {
        artistRoles = h.artistRoles;
        tracklistRels = h.tracklistRels;
        h.hoisted.forEach((r) => log.info(`Moved to release level (#433): ${r.linkType} \u2014 ${r.artist.name} (was on every track; artist\u2013recording artwork is for videos)`));
      }
    }
    const allArtistRoles = artistRoles.concat(tracklistRels);
    const uniqueArtists = [];
    const seenResourceUrls = /* @__PURE__ */ new Set();
    const rolesMap = /* @__PURE__ */ new Map();
    allArtistRoles.forEach((role) => {
      const url = role.artist?.resource_url || `_nourl_${role.artist?.name || role.artist?.id}`;
      if (!rolesMap.has(url)) rolesMap.set(url, []);
      let displayLabel = role.linkType;
      if (role.attributes && role.attributes.length > 0) {
        const attr = role.attributes[0];
        if (attr._type === "instrument" && attr.value) displayLabel = attr.value;
        else if (attr._type === "vocal" && attr.value) displayLabel = attr.value;
        else if (typeof attr === "string") displayLabel = `${role.linkType} [${attr}]`;
      }
      const task = (role.attributes || []).find((a) => a && a._type === "task" && a.value)?.value || "";
      if (task) displayLabel = `${role.linkType}: ${task}`;
      rolesMap.get(url).push({
        linkType: role.linkType,
        displayLabel,
        task,
        sourceRole: role.sourceRole || "",
        trackPos: role.track?.position || "",
        trackTitle: role.track?.title || ""
      });
      if (!seenResourceUrls.has(url)) {
        seenResourceUrls.add(url);
        if (!role.artist?.resource_url && role.artist) role.artist._syntheticKey = url;
        uniqueArtists.push(role.artist);
      }
    });
    const _relMbid = (location.pathname.match(/release\/([0-9a-f-]{36})/i) || [])[1];
    if (_relMbid) {
      for (const a of uniqueArtists) {
        if (a && !a.resource_url && !a._cacheKey && a.name) {
          a._cacheKey = `nameonly/${_relMbid}/${a.name.toLowerCase().trim()}`;
        }
      }
    }
    const companiesRolesMap = /* @__PURE__ */ new Map();
    companies.forEach((c) => {
      if (!c.resource_url) return;
      if (!companiesRolesMap.has(c.resource_url)) companiesRolesMap.set(c.resource_url, []);
      companiesRolesMap.get(c.resource_url).push({ linkType: c.entity_type_name || "" });
    });
    const uniqueCompanies = [];
    const seenCompanyUrls = /* @__PURE__ */ new Set();
    companies.forEach((c) => {
      if (c.resource_url && !seenCompanyUrls.has(c.resource_url) && ENTITY_TYPE_MAP[c.entity_type_name]) {
        seenCompanyUrls.add(c.resource_url);
        uniqueCompanies.push(c);
      }
    });
    function runPreflight(bypassIdb = false) {
      log.info(`Starting preflight: ${uniqueArtists.length} artist(s), ${uniqueCompanies.length} label(s)/place(s).`);
      const artistProgressLi = document.createElement("li");
      artistProgressLi.textContent = `Checking ${uniqueArtists.length} artist(s) against MusicBrainz\u2026`;
      _logs2.appendChild(artistProgressLi);
      const companyProgressLi = document.createElement("li");
      companyProgressLi.textContent = `Checking ${uniqueCompanies.length} label(s)/place(s) against MusicBrainz\u2026`;
      _logs2.appendChild(companyProgressLi);
      const t0 = performance.now();
      return (async () => {
        let context = null;
        try {
          context = await buildReleaseContext({ coCredit: true });
        } catch (e) {
          log.warn(`Matching context unavailable: ${e.message}`);
        }
        const artistResults = await resolveAll(uniqueArtists, {
          progressLi: artistProgressLi,
          progressLabel: "Checking artists against MusicBrainz",
          kindOf: ENTITY_KIND,
          bypassIdb,
          context
        });
        const companyResults = await resolveAll(uniqueCompanies, {
          progressLi: companyProgressLi,
          progressLabel: "Checking labels/places against MusicBrainz",
          kindOf: COMPANY_KIND,
          bypassIdb
        });
        const elapsed = (performance.now() - t0) / 1e3;
        log.info(`Preflight done in ${elapsed.toFixed(1)}s.`);
        return [...artistResults.allResults, ...companyResults.allResults].filter(Boolean);
      })();
    }
    function annotateRoles(allResults) {
      allResults.forEach((r) => {
        if (!r) return;
        const url = r.entity?.resource_url || r.entity?._syntheticKey;
        if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
      });
    }
    let capturedResults = null;
    let capturedConfirmedMap = null;
    let _reviewMergeMap = null;
    const mergeForReview = (results) => {
      if (!entitySources) return results;
      const m = mergeResolvedResults(results, entitySources);
      _reviewMergeMap = m.mergeMap;
      return m.results;
    };
    return runPreflight().then((allResults) => {
      if (isCancelled()) return;
      annotateRoles(allResults);
      capturedResults = allResults;
      if (!allResults.length) {
        log.warn("Nothing to import \u2014 no entities to review.");
        document.querySelector(".discogs-bar")?._setStopMessage?.("Nothing to import \u2014 no entities to review");
        return;
      }
      document.querySelector(".discogs-bar")?.classList.add("is-reviewing");
      return showReviewTable(mergeForReview(capturedResults), rolesMap, companiesRolesMap, {
        // Mount the Start-import button + unresolved message in the
        // always-visible header rather than below the table (#139).
        // Resolved via the DOM (there's one bar) — `runImport` is a
        // separate function from the bar builder that owns the slot.
        headerSlot: document.querySelector(".discogs-bar-action"),
        // Label fallback for URL-less credits (#193): a Qobuz row
        // must say "No Qobuz page", not "No Discogs page". The
        // URL-less Titles source (#271) reports as 'Titles' so the
        // review table drops Discogs-specific wording/elements.
        sourceName: entitySources ? "multiple sources" : sourceUrl ? sourceNameForUrl(sourceUrl) : "Titles",
        sourceIcon: sourceUrl ? srcIconByUrl(sourceUrl) : SRC_ICON.Titles || "",
        // #193 — shown on the "Start import" button
        // #408: per-entity source provenance → the review table renders a Source column
        // (brand-icon badges). Present only on an "Import all" run.
        entitySources,
        sourceBadgeIcon: (name) => SRC_ICON[name] || "",
        // "🔄 Refresh from MB" — bypass the IDB cache and re-resolve
        // every entity via MB API. Used when a cached MBID is stale.
        onRefresh: () => runPreflight(true).then((freshResults) => {
          annotateRoles(freshResults);
          capturedResults = freshResults;
          return mergeForReview(freshResults);
        }),
        // Let `cancelRun` unblock this review promise (resolve → null)
        // so the chain unwinds cleanly instead of leaking a pending
        // promise when the user cancels mid-review.
        registerAbort: (fn) => {
          const b = document.querySelector(".discogs-bar");
          if (b) b._reviewAbort = fn;
        }
      });
    }).then((confirmedMap) => {
      const _bar = document.querySelector(".discogs-bar");
      if (_bar) _bar._reviewAbort = null;
      if (isCancelled()) return;
      if (!confirmedMap) return;
      if (_reviewMergeMap) _reviewMergeMap.forEach((members, repKey) => {
        const mb = confirmedMap.get(repKey);
        if (!mb) return;
        members.forEach((k) => {
          if (!confirmedMap.has(k)) confirmedMap.set(k, mb);
        });
      });
      if (_reviewMergeMap && confirmedMap.splits?.size) _reviewMergeMap.forEach((members, repKey) => {
        const parts = confirmedMap.splits.get(repKey);
        if (!parts) return;
        members.forEach((k) => {
          if (!confirmedMap.splits.has(k)) confirmedMap.splits.set(k, parts);
        });
      });
      capturedConfirmedMap = confirmedMap;
      document.querySelector(".discogs-bar")?.classList.remove("is-reviewing");
      document.querySelector(".discogs-bar")?._setUnresolved?.(confirmedMap.unresolvedCount || 0);
      const cachePromises = [];
      confirmedMap.forEach((mbUrl, resourceUrl) => {
        const key = parseSourceEntityUrl(resourceUrl)?.key;
        if (!key) return;
        const m = mbUrl.match(/\/(artist|label|place)\/([a-f0-9-]+)/);
        if (!m) return;
        cachePromises.push(writeIdbRecord(key, {
          mbid: m[2],
          entityType: m[1]
          // No resolvedVia change — the inline write owns it.
        }));
      });
      return Promise.all(cachePromises);
    }).then(() => {
      if (!capturedConfirmedMap) return;
      const resolvedEntityTypes = /* @__PURE__ */ new Map();
      (capturedResults || []).forEach((r) => {
        if (r.entity?.resource_url && r.mbUrl && r.entityType) {
          resolvedEntityTypes.set(r.entity.resource_url, r.entityType);
        }
      });
      const live = getOpts();
      if (live.processTracklist !== processTracklist) {
        log.warn(`"Per-track credits" toggled during review (preflight ran with "${processTracklist ? "on" : "off"}", import will follow preflight). To change, restart the import.`);
      }
      const dedupOpts = {
        dedupeEquivalenceSets: live.dedupeEquivalenceSets,
        dedupeDuplicateRoles: live.dedupeDuplicateRoles,
        creditOverrides: capturedConfirmedMap?.creditOverrides,
        sourceLabel
        // #408: consolidated runs label the edit note "Import all (…)"
      };
      return dispatchAllRelationships(companies, artistRoles, tracklistRels, live.applyToTracks, live.createWorksMode, tracklist, processTracklist, resolvedEntityTypes, capturedConfirmedMap, sourceUrl, dedupOpts);
    });
  }

  // ../../dev/mbpage/mb-page.mjs
  function mbpReleaseLinkList(doc) {
    doc = doc || document;
    const lists = [...doc.querySelectorAll("ul.external_links")].map((ul) => {
      let h = ul.previousElementSibling;
      while (h && !/^H\d$/.test(h.tagName)) h = h.previousElementSibling;
      return { ul, head: h && h.classList.contains("external-links") ? (h.textContent || "").trim() : null };
    }).filter((l) => l.head !== null);
    const lang = doc.documentElement && doc.documentElement.lang || "en";
    const key = "mbu.extLinksHeading." + lang;
    if (lists.length >= 2) {
      const rgHead = lists[lists.length - 1].head;
      const own = lists.find((l) => l.head !== rgHead);
      if (!own) return null;
      if (!/^en\b/i.test(lang)) {
        try {
          localStorage.setItem(key, JSON.stringify(own.head));
        } catch (e) {
        }
      }
      return own.ul;
    }
    if (lists.length !== 1) return null;
    if (/^external links$/i.test(lists[0].head)) return lists[0].ul;
    if (/^en\b/i.test(lang)) return null;
    let learnt = null;
    try {
      learnt = JSON.parse(localStorage.getItem(key));
    } catch (e) {
    }
    return learnt && learnt === lists[0].head ? lists[0].ul : null;
  }
  function mbpReleaseJsonLinks(doc) {
    doc = doc || document;
    const mbid = (doc.location && doc.location.pathname || "").match(/\/release\/([0-9a-f-]{36})/i);
    for (const s of doc.querySelectorAll('script[type="application/json"]')) {
      const t = s.textContent || "";
      if (t.indexOf('"relationships"') < 0) continue;
      let rel = null;
      try {
        rel = JSON.parse(t).release;
      } catch (e) {
        continue;
      }
      if (!rel || rel.entityType !== "release" || !Array.isArray(rel.relationships)) continue;
      if (mbid && rel.gid && rel.gid.toLowerCase() !== mbid[1].toLowerCase()) continue;
      const abs = (h) => {
        try {
          return new URL(h, doc.location && doc.location.href || "https://musicbrainz.org/").href;
        } catch (e) {
          return "";
        }
      };
      return rel.relationships.map((r) => r && r.target).filter((u) => u && u.entityType === "url" && u.href_url).map((u) => abs(u.href_url)).filter((u) => /^https?:/.test(u));
    }
    return null;
  }
  function mbpReleaseLinks(doc) {
    const data = mbpReleaseJsonLinks(doc);
    if (data) return [...new Set(data)];
    const ul = mbpReleaseLinkList(doc);
    return ul ? [...ul.querySelectorAll("a[href]")].map((a) => a.href).filter((u) => /^https?:/.test(u)) : [];
  }

  // src/mc-adapter.js
  var send = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
  var version = () => typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version || "?";
  var releaseLinks = () => mbpReleaseLinks();
  function pageTracks() {
    const out = [];
    let medium = 0;
    document.querySelectorAll("#content table.medium").forEach((tbl) => {
      medium++;
      let pos = 0;
      tbl.querySelectorAll("tbody tr").forEach((tr) => {
        const a = tr.querySelector('a[href*="/recording/"]');
        if (!a) return;
        pos++;
        out.push({ medium, pos, rec: (a.getAttribute("href").match(/[0-9a-f-]{36}/) || [])[0] });
      });
    });
    return out;
  }
  function withMedia(list) {
    let medium = 1, last = 0;
    return list.map((t) => {
      if (t.index <= last) medium++;
      last = t.index;
      return Object.assign({ medium }, t);
    });
  }
  var flatRoles = (c) => (c.roles || [c.role]).filter(Boolean).join(", ");
  var IMPORT_SOURCES = [
    ["Discogs", "discogs", /discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i],
    ["Tidal", "tidal", /(^|\/\/)(www\.|listen\.)?tidal\.com\/(browse\/)?album\/\d+/i],
    ["Qobuz", "qobuz", /(^|\/\/)(www\.|play\.|open\.)?qobuz\.com\/([a-z]{2}-[a-z]{2}\/)?album\//i],
    ["Deezer", "deezer", /(^|\/\/)(www\.)?deezer\.com\/([a-z]{2}\/)?album\/\d+/i],
    ["mora", "mora", /(^|\/\/)mora\.jp\/package\/\d+\/[\w-]+/i],
    ["Melon", "melon", /(^|\/\/)(www\.|m2\.|m\.app\.)?melon\.com\/album\/detail\.htm\?(?:[^#]*&)?albumId=\d+/i],
    ["AllMusic", "allmusic", /(^|\/\/)(www\.)?allmusic\.com\/album\/release\/(?:[^/?#]*-)?mr\d{10}/i],
    ["Apple", "apple", /(^|\/\/)(?:music|itunes)\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/?#]+\/)?(?:id)?\d+/i],
    ["Metal Archives", "globe", /(^|\/\/)(www\.)?metal-archives\.com\/albums\/[^/]+\/[^/]+\/\d+/i],
    ["YouTube Music", "ytmusic", /(^|\/\/)((music|www|m)\.)?youtube\.com\/(?:playlist\?(?:[^#]*&)?list=OLAK5uy_|browse\/MPREb_)/i]
  ];
  function openLinks(rel, links) {
    const names = IMPORT_SOURCES.filter(([, , re]) => links.some((u) => re.test(u)));
    const url = (name) => `/release/${rel}/edit-relationships#ch-import=${encodeURIComponent(name)}`;
    const out = names.map(([name, icon]) => ({ label: name, icon, url: url(name), title: `Import the credits from ${name} in Credit Hoarder` }));
    if (out.length > 1) out.push({ label: "All", icon: "", url: url("All"), title: `Import from all ${out.length} sources at once in Credit Hoarder` });
    return out;
  }
  async function readSources(links) {
    const find = (re) => links.find((u) => re.test(u));
    const jobs = [];
    const discogs = find(/discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i);
    if (discogs) jobs.push(["Discogs", async () => {
      const url = discogs.replace(/^https?:\/\/(www\.)?discogs\.com\/(?:[a-z-]+\/)?release\//i, "https://www.discogs.com/release/").split(/[?#]/)[0];
      const json = await getDiscogsReleaseData(url);
      const tracks = [];
      const walk = (arr) => (arr || []).forEach((t) => {
        if (t.sub_tracks) walk(t.sub_tracks);
        else if (t.type_ === "track" || !t.type_) tracks.push(t);
      });
      walk(json.tracklist);
      const release = (json.extraartists || []).map((a) => ({ name: a.name, role: a.role + (a.tracks ? ` (tracks ${a.tracks})` : "") }));
      return { source: "Discogs", perTrack: tracks.map((t, i) => ({ medium: 0, index: i + 1, credits: (t.extraartists || []).map((a) => ({ name: a.name, role: a.role })) })), flat: true, release };
    }]);
    const qobuz = find(/qobuz\.com\//i) && parseQobuzAlbumUrl(find(/qobuz\.com\//i));
    if (qobuz) jobs.push(["Qobuz", async () => ({ source: "Qobuz", perTrack: withMedia(extractQobuzCredits(await fetchQobuzAlbumPage(qobuz.pageUrl))) })]);
    const deezer = find(/deezer\.com\//i) && parseDeezerAlbumUrl(find(/deezer\.com\//i));
    if (deezer) jobs.push(["Deezer", async () => ({ source: "Deezer", perTrack: withMedia(extractDeezerCredits(await fetchDeezerAlbumPage(deezer.pageUrl))) })]);
    const mora = find(/mora\.jp\//i) && parseMoraPackageUrl(find(/mora\.jp\//i));
    if (mora) jobs.push(["mora", async () => ({ source: "mora", perTrack: withMedia(extractMoraCredits((await fetchMoraPackage(mora.pageUrl)).json)) })]);
    const melon = find(/melon\.com\//i) && parseMelonAlbumUrl(find(/melon\.com\//i));
    if (melon) jobs.push(["Melon", async () => ({ source: "Melon", perTrack: withMedia((await fetchMelonCredits(melon.id)).tracks.map(({ index, credits }) => ({ index, credits }))) })]);
    const am = find(/allmusic\.com\//i) && parseAllMusicReleaseUrl(find(/allmusic\.com\//i));
    if (am) jobs.push(["AllMusic", async () => ({ source: "AllMusic", perTrack: withMedia(((await fetchAllMusicCredits({ id: am.id }))?.tracks || []).map(({ index, credits }) => ({ index, credits }))) })]);
    const apple = find(/(music|itunes)\.apple\.com\//i) && parseAppleAlbumUrl(find(/(music|itunes)\.apple\.com\//i));
    if (apple) jobs.push(["Apple", async () => ({ source: "Apple", perTrack: withMedia((await fetchAppleCredits(apple.storefront, apple.id)).tracks) })]);
    log.info("Mission Control probe: credit sources linked: " + (jobs.map((j) => j[0]).join(", ") || "none"));
    const out = await Promise.all(jobs.map(([name, run]) => run().catch((x) => {
      log.warn(`Mission Control probe: ${name} failed: ${x && x.message || x}`);
      return null;
    })));
    return out.filter(Boolean);
  }
  function startMcAdapter() {
    const m = location.pathname.match(/^\/release\/([0-9a-f-]{36})\/?$/i);
    if (!m) return false;
    const rel = m[1].toLowerCase();
    const hello = () => send("mc:provider", { id: "ch", name: "Credit Hoarder", version: version(), release: rel, capabilities: ["probe"], open: openLinks(rel, releaseLinks()) });
    document.addEventListener("mc:discover", () => {
      log.info("Mission Control asked \u2014 answering as provider ch");
      hello();
    });
    document.addEventListener("mc:probe", async (e) => {
      let d = {};
      try {
        d = JSON.parse(e.detail) || {};
      } catch (x) {
        return;
      }
      if (d.release && d.release !== rel || d.only && !d.only.includes("ch")) return;
      const done = (findings, summary) => send("mc:findings", { id: "ch", run: d.run, release: rel, findings, summary, open: openLinks(rel, releaseLinks()) });
      try {
        send("mc:progress", { id: "ch", run: d.run, state: "busy", note: "reading credits" });
        const all = await readSources(releaseLinks());
        if (!all.length) {
          log.info("Mission Control probe: no credit source linked or readable (Discogs, Qobuz, Deezer, Apple)");
          done([], "No credit source linked (Discogs, Qobuz, Deezer, Apple)");
          return;
        }
        const tracks = pageTracks();
        const names = all.map((g) => g.source);
        const findings = tracks.map((t, i) => {
          const merged = /* @__PURE__ */ new Map();
          for (const got of all) {
            const hit = got.flat ? got.perTrack[i] : got.perTrack.find((x) => x.medium === t.medium && x.index === t.pos);
            (hit ? hit.credits : []).forEach((c) => {
              const role = flatRoles(c), k = String(c.name || "").toLowerCase() + "|" + role.toLowerCase();
              const mm = merged.get(k) || merged.set(k, { name: c.name, role, sources: [] }).get(k);
              if (!mm.sources.includes(got.source)) mm.sources.push(got.source);
            });
          }
          const list = [...merged.values()].map((c) => ({ name: c.name, role: c.role, sources: c.sources }));
          return { key: t.rec, track: t.rec, state: list.length ? "info" : "none", credits: list.length, list, source: names.join(", ") };
        });
        const total = findings.reduce((n, f) => n + f.credits, 0);
        const withCredits = findings.filter((f) => f.track && f.credits).length;
        const relList = all.flatMap((g) => g.release || []);
        if (relList.length) findings.push({ key: "release", state: "info", credits: relList.length, list: relList, source: "Discogs", level: "release" });
        all.forEach((g) => log.info(`Mission Control probe: ${g.source} gave credits for ${g.perTrack.filter((x) => x.credits && x.credits.length).length} track(s)`));
        log.info(`Mission Control probe: ${names.join(" + ")} \u2014 ${total} track credit(s), merged, on ${withCredits} of ${tracks.length} track(s), ${relList.length} release credit(s)`);
        relList.forEach((c) => log.info(`  release credit: ${c.name} \u2014 ${c.role}`));
        done(findings, `${names.join(" + ")}: ${total} credit${total === 1 ? "" : "s"} on ${withCredits} of ${tracks.length} tracks` + (relList.length ? `, ${relList.length} on the release` : ""));
      } catch (x) {
        log.error("Mission Control probe failed: " + (x && x.message || x));
        done([], "failed: " + (x && x.message || x));
      }
    });
    hello();
    return true;
  }

  // src/credit_hoarder.user.js
  try {
    pageWindow.__creditHoarder = { resolveAll, ARTIST_KIND, buildReleaseContext, releaseArtistMbids, wantsAliasButton, submitAliasBackground, openAddAliasForm, showReviewTable, setReviewContainer };
  } catch (e) {
  }
  if (/(^|\.)tidal\.com$/i.test(location.hostname)) {
    runTidalHarvestPage();
  }
  if (/(^|\.)metal-archives\.com$/i.test(location.hostname)) {
    runMetalArchivesHarvestPage();
  }
  (function handleCreatePageAutoCommit() {
    const onCreate = /\/(artist|label|place)\/create\b/i.test(location.pathname);
    const onEdit = /\/(artist|label|place)\/[a-f0-9-]{36}\/edit\b/i.test(location.pathname);
    if (!onCreate && !onEdit) return;
    const m = location.hash.match(/ch-autocommit(?:=([^&]+))?/);
    if (!m) return;
    if (onCreate) {
      let identity = "";
      try {
        identity = decodeURIComponent(m[1] || "");
      } catch (e) {
        identity = m[1] || "";
      }
      try {
        sessionStorage.setItem("discogs-importer-pending-artist", identity);
      } catch (e) {
      }
    } else {
      try {
        sessionStorage.setItem("discogs-importer-close-after-edit", "1");
      } catch (e) {
      }
    }
    const et = (location.pathname.match(/\/(artist|label|place)\//) || [])[1] || "artist";
    const seedUrl = new URLSearchParams(location.search).get(`edit-${et}.url.0.text`) || "";
    const seedKey = seedUrl ? seedUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase() : "";
    let tries = 0;
    const submit = () => {
      const seedReady = !seedKey || document.body.innerHTML.toLowerCase().includes(seedKey);
      const btn = document.querySelector("button.submit.positive") || [...document.querySelectorAll('button[type="submit"]')].find((b) => /enter edit/i.test(b.textContent || ""));
      if (seedReady && btn && !btn.disabled) {
        btn.click();
        return;
      }
      if (tries++ < 100) setTimeout(submit, 200);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", submit);
    else submit();
  })();
  (function handleEntityPageIfNeeded() {
    const entityMatch = location.href.match(
      /musicbrainz\.org\/(artist|label|place)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[^/]|$)/i
    );
    if (!entityMatch) return;
    const entityType = entityMatch[1];
    const mbid = entityMatch[2];
    try {
      if (sessionStorage.getItem("discogs-importer-close-after-edit")) {
        sessionStorage.removeItem("discogs-importer-close-after-edit");
        try {
          DISCOGS_CHANNEL.postMessage({ type: "edit-committed", id: mbid });
        } catch (e) {
        }
        setTimeout(() => window.close(), 50);
        return;
      }
    } catch (e) {
    }
    const pendingKey = "discogs-importer-pending-artist";
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;
    sessionStorage.removeItem(pendingKey);
    const NAME_FETCH_TIMEOUT_MS = 1e3;
    const CLOSE_DELAY_MS = 50;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NAME_FETCH_TIMEOUT_MS);
    mbnFetch(`${MB}/ws/2/${entityType}/${mbid}?fmt=json`, { signal: ctrl.signal }, { background: false }).then((r) => r.json()).then((json) => ({ name: json.name || "", disambiguation: json.disambiguation || "" })).catch(() => ({ name: "", disambiguation: "" })).then(({ name, disambiguation }) => {
      clearTimeout(timer);
      DISCOGS_CHANNEL.postMessage({
        type: "artist-created",
        // keep same message type for compatibility
        id: mbid,
        name,
        disambiguation,
        resourceUrl: pending
      });
      setTimeout(() => window.close(), CLOSE_DELAY_MS);
    });
  })();
  var T0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  var since = () => Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - T0);
  if (/musicbrainz\.org$/i.test(location.hostname)) startMcAdapter();
  if (/musicbrainz\.org$/i.test(location.hostname)) (function() {
    const re = /musicbrainz\.org\/release\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/edit-relationships/i;
    const m = window.location.href.match(re);
    if (!m) return;
    log.info(`Boot: script running (document.readyState=${document.readyState}, ${Math.round(performance.now())}ms into the page)`);
    const tProbe = since();
    const sourceProbe = getSourceUrlsForRelease(m[1]).then((s) => {
      log.info(`Boot: source probe done (+${since() - tProbe}ms)`);
      return { sources: s, failed: false };
    }).catch((e) => {
      log.error(`Sources: could not read this release's links from MusicBrainz \u2014 ${e.message}. Showing the toolbar anyway; reload to retry.`);
      console.warn("[credit_hoarder] could not read release sources:", e);
      return { sources: {}, failed: true };
    });
    const remixProbe = probeTitleRemixes(m[1]).then((r) => {
      log.info(`Boot: title-remix probe done (+${since() - tProbe}ms)`);
      return r;
    }).catch((e) => {
      log.warn(`Titles: remix probe failed \u2014 ${e.message}`);
      return null;
    });
    const domReady = new Promise((resolve) => {
      if (document.readyState === "interactive" || document.readyState === "complete") return resolve();
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    }).then(() => log.info(`Boot: DOM ready (+${since()}ms)`));
    Promise.all([sourceProbe, domReady]).then(([probe]) => {
      const known = !!(probe.sources.discogs || probe.sources.tidal || probe.sources.qobuz || probe.sources.deezer || probe.sources.mora || probe.sources.melon || probe.sources.allmusic || probe.sources.apple || probe.sources.metalArchives || probe.sources.ytmusic);
      if (known || probe.failed) {
        bootstrapBar(probe, null, m[1]);
        remixProbe.then((remix) => {
          const n = remix?.count || 0;
          if (!n) return;
          const bar = document.querySelector(".discogs-bar");
          const outcome = bar?._addTitlesSource ? bar._addTitlesSource(n) : "no bar";
          log.info(`Titles: ${n} remixer(s) derivable from the track titles \u2014 ${outcome} (+${since()}ms)`);
        });
        return;
      }
      log.info("Boot: no linked source \u2014 waiting for the title-remix probe before deciding whether to show anything");
      remixProbe.then((remix) => bootstrapBar(probe, remix, m[1]));
    });
  })();
  function bootstrapBar(probe, remix, releaseMbid) {
    {
      const sources = probe.sources;
      const hasProvider = !!(sources.discogs || sources.tidal || sources.qobuz || sources.deezer || sources.mora || sources.melon || sources.allmusic || sources.apple || sources.metalArchives || sources.ytmusic);
      const remixCount = remix?.count || 0;
      if (!probe.failed) logSourceProbe(sources);
      log.info(`Toolbar: ${probe.failed ? "source probe FAILED" : hasProvider ? "linked source(s) found" : "no linked sources"}, ${remixCount} title-derived remixer(s) \u2014 ${probe.failed || hasProvider || remixCount ? "mounting" : "not mounting (nothing to import)"}`);
      if (!probe.failed && !hasProvider && remixCount === 0) return;
      insertDiscogsBar(sources.discogs, sources, { titlesRemixCount: remixCount, sourceProbeFailed: probe.failed });
      log.info(`Boot: toolbar mounted (+${since()}ms from script start)`);
      pressRequestedSource();
    }
  }
  function pressRequestedSource() {
    const m = location.hash.match(/ch-import=([^&]+)/);
    if (!m) return;
    let name = m[1];
    try {
      name = decodeURIComponent(name);
    } catch (e) {
    }
    window.history.replaceState(null, "", location.pathname + location.search);
    let tries = 0;
    const press = () => {
      const b = [...document.querySelectorAll(".discogs-bar .discogs-src-ico")].find((x) => x.dataset.src === name);
      if (b) {
        log.info(`Mission Control asked to import from ${name}`);
        b.click();
        return;
      }
      if (tries++ < 50) {
        setTimeout(press, 200);
        return;
      }
      log.warn(`Mission Control asked to import from ${name}, but the toolbar has no such source`);
    };
    press();
  }
})();
