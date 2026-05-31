// ==UserScript==
// @name         ISRC Scout
// @namespace    https://musicbrainz.org/
// @version      2026.5.31.210449
// @description  Scout ISRCs for a MusicBrainz release: reads existing ISRCs, finds missing ones on SoundExchange / Deezer / Spotify, bulk paste & import/export, submits directly to MB (one-time OAuth, never depends on MagicISRC).
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI4IiBmaWxsPSIjZjNlZWZjIi8+PHBhdGggZD0iTTY0IDY0IEw2NCAyNCBBNDAgNDAgMCAwIDEgOTkgODQgWiIgZmlsbD0iI2UzZDhmNyIvPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZmNDJjMSIgc3Ryb2tlLXdpZHRoPSI2Ij48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI0MCIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjI2IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjEzIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPjwvZz48bGluZSB4MT0iNjQiIHkxPSI2NCIgeDI9IjY0IiB5Mj0iMjQiIHN0cm9rZT0iIzZmNDJjMSIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI4NiIgY3k9IjUwIiByPSI3IiBmaWxsPSIjNGIyZTgzIi8+PC9zdmc+
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/isrc_scout/README.md
// @match        https://musicbrainz.org/release/*
// @match        https://beta.musicbrainz.org/release/*
// @match        https://musicbrainz.org/oauth2/oob*
// @match        https://beta.musicbrainz.org/oauth2/oob*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// @connect      isrc-api.soundexchange.com
// @connect      isrc.soundexchange.com
// @connect      api.deezer.com
// @connect      isrchunt.com
// @run-at       document-start
// ==/UserScript==

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  SETUP (one time, ever)
 * ─────────────────────────────────────────────────────────────────────────
 *  Submitting ISRCs to MusicBrainz requires authentication. This script uses
 *  OAuth with the `submit_isrc` scope and `access_type=offline`, so you
 *  authorize EXACTLY ONCE — the refresh token is stored locally and is used
 *  to silently mint short-lived access tokens forever after.
 *
 *  The OAuth app is baked in, so there's nothing to register:
 *  open the editor (the "ISRC" button on a release page) → ⚙ Setup → Authorize,
 *  approve in the MusicBrainz tab, paste the code it shows back. Done forever.
 *
 *  Everything except the final "Submit" runs without any credentials.
 *  Trouble? Open the editor's "Log" pane — every action is recorded there.
 * ─────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     TIMERS — Firefox + Violentmonkey can throw "called on incompatible object"
     when a native timer is invoked with the wrong `this` (sandbox/Xray quirk).
     Bind them to the window so every call has the right receiver.
  ═══════════════════════════════════════════════════════════════════════ */
  const _timerHost   = (typeof window !== 'undefined' && window) || globalThis;
  const _setTimeout  = _timerHost.setTimeout.bind(_timerHost);
  const _setInterval = _timerHost.setInterval.bind(_timerHost);

  /* ═══════════════════════════════════════════════════════════════════════
     OAUTH OUT-OF-BAND CODE CATCHER
     After you approve, MusicBrainz lands on /oauth2/oob?code=… showing the code.
     Grab it, hand it to the editor tab via GM storage, and close this tab — so
     you never have to copy/paste the code.
  ═══════════════════════════════════════════════════════════════════════ */
  if (/oauth2\/oob$/.test(location.pathname)) {
    const code = new URLSearchParams(location.search).get('code');
    if (code) {
      try { GM_setValue('oauth_oob_code', { code: code, ts: Date.now() }); } catch (e) {}
      const finishOob = () => {
        try { window.close(); } catch (e) {}
        // Browsers block window.close() on a tab that has navigated (authorize → oob);
        // the editor tab also tries to close this popup, but if it's still here, show a
        // clear confirmation so it's obvious it worked.
        _setTimeout(() => {
          try {
            window.close();
            document.title = '✓ Authorized — you can close this tab';
            if (document.body) document.body.innerHTML =
              '<div style="font:16px/1.5 system-ui;padding:3em;text-align:center;color:#212529">' +
              '<h2 style="color:#198754">✓ Authorized</h2><p>ISRC Scout captured the code. You can close this tab.</p></div>';
          } catch (e) {}
        }, 500);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finishOob, { once: true });
      else finishOob();
    }
    return; // never run the editor on the oob page
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════════════════════════════════ */
  const MB_ROOT  = location.origin;                 // musicbrainz.org or beta
  const MB_WS2   = MB_ROOT + '/ws/2/';
  const SCRIPT_VERSION = '2026.5.31.210449';
  const SCRIPT_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/isrc_scout';
  const CLIENT   = 'isrc_scout-' + SCRIPT_VERSION;
  const UA       = 'MB-ISRC-Scout/1.0';
  const SX_API   = 'https://isrc-api.soundexchange.com/api/ext/recordings';
  const SX_HOME  = 'https://isrc.soundexchange.com/';
  const BATCH_DELAY = 650;
  const SX_BATCH_LIMIT = 30;     // max individual SoundExchange searches per batch (avoid being blocked)
  const STREAM_BATCH_LIMIT = 50; // max per-track Deezer fetches per batch (1000-track releases would spam Deezer)
  const ISRC_RE  = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;

  // Shared, pre-registered MusicBrainz OAuth app (type: Installed application,
  // redirect urn:ietf:wg:oauth:2.0:oob, scope submit_isrc). Baked in so users only
  // click "Authorize" once — no per-user app registration. The secret is not truly
  // confidential for an installed app (same model as MagicISRC / isrchunt).
  const OAUTH = {
    clientId:     'axXnet_AiWglKOQEVSiM8xF6EAlKFBzM',
    clientSecret: 'gi-S0GuLeKtOgFs5QRZAEEVATD4Lo6l9',
    authUrl:  MB_ROOT + '/oauth2/authorize',
    tokenUrl: MB_ROOT + '/oauth2/token',
    redirect: 'urn:ietf:wg:oauth:2.0:oob',
    scope:    'submit_isrc',
  };

  const mbid = location.pathname.match(/\/release\/([a-f0-9-]{36})/)?.[1];
  if (!mbid) return;

  /* ═══════════════════════════════════════════════════════════════════════
     GM STORAGE HELPERS
  ═══════════════════════════════════════════════════════════════════════ */
  const store = {
    get:  (k, d) => { try { return GM_getValue(k, d); } catch (e) { return d; } },
    set:  (k, v) => { try { GM_setValue(k, v); } catch (e) {} },
    del:  (k)    => { try { GM_deleteValue(k); } catch (e) {} },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     GENERIC HTTP (GM_xmlhttpRequest promisified)
  ═══════════════════════════════════════════════════════════════════════ */
  function http(opts) {
    const t0 = Date.now();
    const tag = (opts.method || 'GET') + ' ' + shortUrl(opts.url);
    Log.net('→ ' + tag);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest(Object.assign({
        timeout: 20000,
        onload: r => {
          const ms = Date.now() - t0;
          if (r.status >= 200 && r.status < 300) Log.net('← ' + r.status + ' ' + tag + ' (' + ms + 'ms)');
          else Log.warn('← ' + r.status + ' ' + tag + ' (' + ms + 'ms) ' + String(r.responseText || '').replace(/\s+/g, ' ').slice(0, 160));
          resolve(r);
        },
        onerror:   () => { Log.err('✗ network ' + tag); reject(new Error('network error')); },
        ontimeout: () => { Log.err('✗ timeout ' + tag); reject(new Error('timeout')); },
      }, opts));
    });
  }
  const gmGet  = (url, headers) => http({ method: 'GET',  url, headers: headers || {} });
  const gmPost = (url, data, headers) => http({ method: 'POST', url, data, headers: headers || {} });

  /* ═══════════════════════════════════════════════════════════════════════
     SMALL UTILITIES
  ═══════════════════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function msToMmSs(ms) {
    if (!ms) return null;
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function durToSec(str) {
    const m = String(str || '').match(/^(\d+):(\d{2})$/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function normCI(s) { return norm(s); }
  function wordsMatch(needle, haystack) {
    const nw = norm(needle).split(' ').filter(Boolean), hw = norm(haystack);
    return nw.length > 0 && nw.every(w => hw.includes(w));
  }
  function isGoodMatch(aTitle, aArtist, bTitle, bArtist) {
    // shares titleClose/artistClose (below) so the row classification and the
    // per-field highlighting never disagree
    if (titleClose(aTitle, bTitle) !== true) return false;
    return !bArtist || artistClose(aArtist, bArtist) === true;
  }
  // Per-field comparisons between an SoundExchange result and the MB track,
  // used to highlight exactly WHICH attribute disagrees. Each returns
  // true (matches) / false (mismatch) / null (can't compare — no data).
  function titleClose(sx, mb) {
    const aw = norm(sx).split(' ').filter(Boolean);
    const bw = norm(mb).split(' ').filter(Boolean);
    if (!aw.length || !bw.length) return null;
    const shorter = aw.length <= bw.length ? aw : bw;
    const longer  = aw.length <= bw.length ? bw : aw;
    if (!shorter.every(w => longer.includes(w))) return false;
    const extra = longer.length - shorter.length;
    // extra words are only tolerated as a SUFFIX (a version/remaster tag) — a
    // leading extra word ("Sacred Motherhood" vs "Motherhood") is a different song
    return extra === 0 || (extra <= 2 && shorter.every((w, i) => longer[i] === w));
  }
  function artistClose(sx, mb) {
    if (!sx || !mb) return null;
    return wordsMatch(mb, sx) || wordsMatch(sx, mb);
  }
  function durClose(sxDur, mbDur) {
    const a = durToSec(mbDur), b = durToSec(sxDur);
    return (a === null || b === null) ? null : Math.abs(a - b) <= 10;
  }
  function yearOk(sxYear, mbYear) {
    if (!mbYear || !sxYear) return null;
    return parseInt(sxYear) <= mbYear + 1;
  }
  // Build the "Title · Artist · Year · Dur" meta for an SX result `f` vs MB track
  // `t`, wrapping each mismatching field in .ii-bad (with a tooltip explaining
  // it) so problems are obvious in the chip, the candidate list, and the popup.
  function sxMetaHtml(f, t) {
    const span = (txt, ok, tip) =>
      '<span' + (ok === false ? ' class="ii-bad" title="' + esc(tip) + '"' : '') + '>' + esc(txt) + '</span>';
    const parts = [];
    if (f.title)  parts.push(span(f.title,  titleClose(f.title, t.title),   'Title differs from "' + t.title + '"'));
    if (f.artist) parts.push(span(f.artist, artistClose(f.artist, t.artist), 'Artist differs from "' + t.artist + '"'));
    if (f.year)   parts.push(span(f.year,   yearOk(f.year, RELEASE && RELEASE.year),
                                  'Recording year ' + f.year + ' is after this release (' + (RELEASE && RELEASE.year) + ')'));
    if (f.dur) {
      const dOk = durClose(f.dur, t.dur);
      parts.push(span(f.dur, dOk, 'Length differs from MB (' + (t.dur || '?') + ')') +
        (dOk === false && t.dur ? '<span class="ii-mbdur" title="MusicBrainz length"> ↔ ' + esc(t.dur) + '</span>' : ''));
    }
    return parts.join(' · ');
  }
  function normalizeIsrc(raw) {
    return String(raw || '').toUpperCase().replace(/[\s\-]/g, '');
  }
  function isValidIsrc(s) { return ISRC_RE.test(normalizeIsrc(s)); }
  function sleep(ms) {
    return new Promise(resolve => {
      try { _setTimeout(resolve, ms); }
      catch (e) { resolve(); }   // never stall a flow if the env's timer misbehaves
    });
  }

  function toast(msg, kind) {
    let t = document.getElementById('ii-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ii-toast';
      (document.body || document.documentElement).appendChild(t);
    }
    // auto-hide is driven by a CSS animation (forwards) — restart it on every call
    // by removing the class + forcing a reflow, so a toast can never get stuck.
    t.classList.remove('ii-toast-show');
    void t.offsetWidth;
    t.textContent = msg == null ? '' : String(msg);
    t.className = 'ii-toast-show ' + (kind || '');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     LOG — console + in-modal pane, for troubleshooting
  ═══════════════════════════════════════════════════════════════════════ */
  const Log = (function () {
    const buf = [], MAX = 800;
    let paneEl = null;
    const stamp = () => { const d = new Date(); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
    const fmt = (d) => { if (d === undefined) return ''; try { return ' ' + (typeof d === 'string' ? d : JSON.stringify(d)); } catch (e) { return ' ' + String(d); } };
    function render() { if (paneEl) { paneEl.textContent = buf.join('\n'); paneEl.scrollTop = paneEl.scrollHeight; } }
    function add(level, msg, data) {
      const line = '[' + stamp() + '] ' + String(level).toUpperCase().padEnd(5) + ' ' + msg + fmt(data);
      buf.push(line); if (buf.length > MAX) buf.shift();
      render();
    }
    return {
      setPane: el => { paneEl = el; render(); },
      text:    () => buf.join('\n'),
      clear:   () => { buf.length = 0; render(); },
      info: (m, d) => add('info', m, d),
      warn: (m, d) => add('warn', m, d),
      err:  (m, d) => add('error', m, d),
      net:  (m, d) => add('net', m, d),
    };
  })();
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/[?#].*$/, '').slice(0, 90);
  Log.info('ISRC Scout v' + SCRIPT_VERSION + ' — ' + MB_ROOT);

  /* ═══════════════════════════════════════════════════════════════════════
     STYLES
  ═══════════════════════════════════════════════════════════════════════ */
  const style = document.createElement('style');
  style.textContent = `
    /* button on the release page */
    #ii-btn {
      display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
      margin-left: 12px; font-size: 12px; font-weight: 600; color: #fff !important;
      background: #6f42c1; border: none; border-radius: 4px; cursor: pointer;
      vertical-align: middle; white-space: nowrap; transition: background .15s; }
    #ii-btn:hover { background: #5a32a3; }
    #ii-btn.has-missing { background: #d63384; animation: ii-pulse 1.6s ease-in-out infinite; }
    #ii-btn.has-missing:hover { background: #a0225e; }
    #ii-btn .ii-status { font-size: 10px; font-weight: 600; opacity: .9; }
    @keyframes ii-pulse { 0%,100%{opacity:1} 50%{opacity:.72} }

    /* overlay + modal */
    #ii-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.42); z-index: 999998; display: none; }
    #ii-overlay.open { display: block; }
    #ii-modal {
      position: fixed; top: 4vh; left: 50%; transform: translateX(-50%);
      width: 1080px; max-width: 96vw; max-height: 92vh; background: #fff;
      border-radius: 10px; box-shadow: 0 12px 48px rgba(0,0,0,.3); z-index: 999999;
      display: none; flex-direction: column; font-family: system-ui, sans-serif;
      color: #212529; overflow: hidden; }
    #ii-modal.open { display: flex; }
    #ii-hdr { display: flex; align-items: center; gap: 10px; padding: 11px 16px;
      background: #f8f9fa; border-bottom: 1px solid #dee2e6; flex-shrink: 0; }
    #ii-hdr h2 { font-size: 15px; font-weight: 700; margin: 0; flex: 1; }
    #ii-hdr h2 em { color: #6f42c1; font-style: normal; }
    #ii-hdr h2 .ii-logo { vertical-align: -5px; }
    #ii-hdr .ii-sub { font-size: 13.5px; color: #6c757d; font-weight: 700; margin-left: 7px; }
    #ii-close { background: none; border: none; font-size: 20px; color: #6c757d; cursor: pointer; line-height: 1; }
    #ii-close:hover { color: #212529; }

    /* toolbar */
    #ii-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
      padding: 8px 16px; border-bottom: 1px solid #eee; flex-shrink: 0; background: #fbfbfd; }
    .ii-tbtn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px;
      font-size: 12px; font-weight: 600; border-radius: 5px; cursor: pointer; text-decoration: none;
      border: 1px solid #dee2e6; background: #fff; color: #343a40; white-space: nowrap; }
    a.ii-tbtn:hover { text-decoration: none; }
    .ii-tbtn:hover { background: #f1f3f5; }
    .ii-tbtn:disabled { opacity: .5; cursor: default; }
    .ii-tbtn.sx  { color: #6f42c1; border-color: #d6c7ee; }
    .ii-tbtn.dz  { color: #ef5466; border-color: #f5c2c8; }
    .ii-tbtn.sp  { color: #1db954; border-color: #b6e5c6; }
    .ii-tbtn.primary { background: #198754; color: #fff; border-color: #198754; }
    .ii-tbtn.primary:hover { background: #157347; }
    .ii-tbtn.ghost { border-color: transparent; }
    .ii-split { display: inline-flex; }
    .ii-split .ii-tbtn { border-radius: 0; }
    .ii-split .ii-tbtn:first-child { border-top-left-radius: 5px; border-bottom-left-radius: 5px; }
    .ii-split .ii-caret { border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-left: none; padding: 4px 7px; font-size: 9px; }
    .ii-srcmenu { display: none; position: fixed; z-index: 1000001; background: #fff; border: 1px solid #ced4da;
      border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.2); padding: 11px; width: 520px; max-width: 92vw; box-sizing: border-box; }
    .ii-srcmenu.open { display: block; }
    .ii-srcmenu-t { font-size: 11.5px; color: #495057; margin-bottom: 7px; }
    .ii-srcmenu-t b { color: #212529; }
    /* align-items:stretch makes the input match the button's height no matter what
       height MusicBrainz forces on the button — no need to fight its CSS. */
    .ii-srcmenu-pc { display: block; width: 100%; box-sizing: border-box; margin-bottom: 9px; padding: 7px 10px;
      text-align: left; font-size: 12px; color: #0f5132; background: #e8f5ee; border: 1px solid #a3cfbb;
      border-radius: 6px; cursor: pointer; }
    .ii-srcmenu-pc:hover { background: #d5eddf; border-color: #75b798; }
    .ii-srcmenu-pc b { color: #0a3622; }
    .ii-srcmenu-pc-url { display: block; margin-top: 2px; font-size: 10.5px; color: #6c757d;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ii-srcmenu-row { display: flex; gap: 6px; align-items: stretch; }
    .ii-srcmenu-row input {
      flex: 1; min-width: 0; box-sizing: border-box !important; height: auto !important; min-height: 0 !important;
      padding: 6px 10px !important; border: 1px solid #ced4da !important; border-radius: 6px !important;
      font-size: 12px !important; margin: 0 !important; }
    .ii-srcmenu-row input:focus { outline: none; border-color: #6f42c1 !important; }
    .ii-srcmenu-row .ii-tbtn { margin: 0 !important; }
    .ii-tspacer { flex: 1; }
    .ii-prog { font-size: 11px; color: #6c757d; min-width: 0; }
    .ii-prog.err { color: #dc3545; font-weight: 700; }
    .ii-prog.continue { color: #6f42c1; font-weight: 700; cursor: pointer; text-decoration: underline dotted; }
    .ii-prog.continue:hover { color: #5a32a3; }

    /* table */
    #ii-body { flex: 1; overflow: auto; padding: 0; }
    #ii-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
    #ii-table thead th { position: sticky; top: 0; z-index: 2; background: #f1f3f5;
      text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .3px; color: #6c757d; padding: 7px 10px; border-bottom: 1px solid #dee2e6; }
    .ii-medrow td { background: #eef0f3; font-weight: 700; font-size: 11.5px; color: #495057;
      padding: 5px 10px; border-top: 1px solid #dee2e6; }
    #ii-table td { padding: 6px 10px; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
    .ii-pos { color: #adb5bd; font-variant-numeric: tabular-nums; width: 34px; white-space: nowrap; }
    .ii-track-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
    .ii-track-title a { color: inherit; text-decoration: none; }
    .ii-track-title a:hover { color: #6f42c1; text-decoration: underline; }
    .ii-track-artist { color: #6c757d; font-size: 11.5px; }
    .ii-track-dur { color: #adb5bd; font-size: 11px; font-family: 'Courier New', monospace; }
    .ii-existing { width: 150px; }
    .ii-existing samp { display: block; font-size: 11px; font-weight: 700; color: #198754; font-family: 'Courier New', monospace; }
    .ii-existing samp.dup { color: #d63384; background: #ffe3ef; border-radius: 3px; padding: 0 3px; }
    .ii-existing .none { color: #ced4da; font-style: italic; font-size: 11px; }
    .ii-ex-item { display: flex; align-items: center; gap: 5px; cursor: pointer; }
    .ii-ex-item input { cursor: pointer; margin: 0; flex-shrink: 0; }
    .ii-ex-item.del samp { text-decoration: line-through; color: #d63384; }
    /* pending Remove-ISRC edit — highlighted like MusicBrainz marks entities with
       an open edit (orange/peach), with a strike-through to show it's a removal */
    .ii-ex-pending { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #8a5a00;
      background: #fde6c8; border: 1px solid #f1c690; border-radius: 3px; padding: 0 4px; }
    .ii-ex-pending samp { color: #8a5a00; text-decoration: line-through; }
    .ii-inwrap { display: flex; align-items: center; gap: 5px; }
    /* the × lives INSIDE the input box (part of the edit), so it doesn't shift the
       row layout / SX text alignment */
    .ii-input-box { position: relative; flex-shrink: 0; width: 150px; }
    .ii-input { width: 100%; box-sizing: border-box; padding: 4px 22px 4px 7px; border: 1px solid #ced4da; border-radius: 4px;
      font-family: 'Courier New', monospace; font-size: 12.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
    .ii-input:focus { outline: none; border-color: #6f42c1; }
    .ii-input.bad   { border-color: #dc3545; background: #fff0f1; }
    .ii-input.dup   { border-color: #fd7e14; background: #fff6ed; }
    .ii-input.dupother { border-color: #d63384; background: #ffe3ef; }
    .ii-input.ok    { border-color: #198754; }
    .ii-clear { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); width: 17px; height: 17px;
      padding: 0; border: none; border-radius: 3px; background: transparent; color: #adb5bd; font-size: 13px;
      line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .ii-clear:hover { background: #fdeaec; color: #dc3545; }
    .ii-plus { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 7px; border: 1px solid #dee2e6;
      border-radius: 4px; background: #f8f9fa; cursor: pointer; color: #6c757d; font-family: monospace; }
    .ii-plus:hover { background: #e9ecef; color: #212529; }
    .ii-plus-hidden { visibility: hidden; }   /* reserve the slot on the first row so SX text still aligns */
    .ii-cands { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; width: auto; }
    .ii-cand { display: flex; align-items: flex-start; gap: 7px; padding: 3px 7px; border: 1px solid #dee2e6;
      border-radius: 4px; cursor: pointer; font-size: 11px; background: #fff; }
    .ii-cand:hover { background: #f0f6ff; border-color: #9ec5fe; }
    .ii-cands.collapsed .ii-cand:not(.chosen) { display: none; }
    .ii-cand.chosen { box-shadow: inset 3px 0 0 #198754; }
    .ii-cand.best { border-color: #6ea8fe; background: #d4e6ff; }
    .ii-cand.warn { border-color: #ffe08a; background: #fff3cd; }
    .ii-cand.bad  { border-color: #f3c6cb; background: #fdf2f3; }
    .ii-cand-isrc { font-family: 'Courier New', monospace; font-weight: 700; color: #084298; flex-shrink: 0; padding-top: 1px; }
    .ii-cand-meta { flex: 1; min-width: 0; color: #495057; white-space: normal; word-break: break-word; line-height: 1.35; }
    .ii-bad { color: #dc3545; font-weight: 600; text-decoration: underline wavy rgba(220,53,69,.55); text-underline-offset: 2px; }
    .ii-mbdur { color: #198754; font-weight: 600; }
    .ii-cand-src { margin-left: auto; font-size: 9px; text-transform: uppercase; color: #adb5bd; flex-shrink: 0; }
    .ii-cand-note { font-size: 11px; color: #adb5bd; font-style: italic; padding: 2px 7px; }
    .ii-row-fill { animation: ii-flash 1s ease-out; }
    @keyframes ii-flash { 0%{background:rgba(25,135,84,.18)} 100%{background:transparent} }

    /* footer */
    #ii-foot { display: flex; align-items: center; gap: 10px; padding: 9px 16px;
      border-top: 1px solid #dee2e6; background: #f8f9fa; flex-shrink: 0; }
    #ii-foot .ii-summary { font-size: 12px; color: #495057; flex: 1; }
    #ii-foot .ii-summary b { color: #212529; }
    .ii-seq-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; padding: 2px 9px;
      font-size: 11px; font-weight: 700; font-family: 'Courier New', monospace; color: #0f5132; background: #d1e7dd;
      border: 1px solid #a3cfbb; border-radius: 11px; vertical-align: middle; letter-spacing: .3px; }

    /* sub-panels (setup / bulk) */
    .ii-pane { display: none; padding: 14px 16px; border-bottom: 1px solid #eee; background: #fcfcfe; flex-shrink: 0; }
    .ii-pane.open { display: block; }
    .ii-pane h3 { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .ii-pane-x { flex-shrink: 0; width: 19px; height: 19px; line-height: 1; padding: 0; font-size: 13px;
      color: #6c757d; background: #fff; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer; }
    .ii-pane-x:hover { background: #f1f3f5; color: #212529; border-color: #adb5bd; }
    .ii-pane label { display: block; font-size: 11.5px; color: #495057; margin: 6px 0 2px; }
    .ii-pane input[type=text], .ii-pane textarea {
      width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #ced4da;
      border-radius: 4px; font-size: 12px; font-family: 'Courier New', monospace; }
    .ii-pane textarea { min-height: 120px; resize: vertical; }
    .ii-pane .row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
    .ii-pane .row > div { flex: 1; min-width: 200px; }
    .ii-help { font-size: 11px; color: #6c757d; margin-top: 6px; line-height: 1.5; }
    .ii-help a { color: #6f42c1; }
    .ii-authstate { font-size: 11.5px; padding: 4px 0; }
    .ii-authstate.ok  { color: #198754; }
    .ii-authstate.no  { color: #dc3545; }

    /* toast */
    #ii-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(80px);
      background: #212529; color: #fff; padding: 10px 18px; border-radius: 6px; font-size: 13px;
      font-family: system-ui, sans-serif; z-index: 1000000; opacity: 0; pointer-events: none; max-width: 80vw; }
    #ii-toast.ii-toast-show { animation: ii-toast-life 4.4s ease forwards; }
    #ii-toast.err { background: #b02a37; }
    #ii-toast.ok  { background: #198754; }
    @keyframes ii-toast-life {
      0%   { transform: translateX(-50%) translateY(80px); opacity: 0; }
      6%   { transform: translateX(-50%) translateY(0);    opacity: 1; }
      90%  { transform: translateX(-50%) translateY(0);    opacity: 1; }
      100% { transform: translateX(-50%) translateY(80px); opacity: 0; }
    }

    /* log pane */
    #ii-log-out { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.45;
      white-space: pre-wrap; word-break: break-word; background: #0d1117; color: #c9d1d9;
      padding: 8px 10px; border-radius: 5px; max-height: 240px; overflow: auto; margin: 0; }
    #ii-log-pane h3 { display: flex; align-items: center; gap: 8px; }
    .ii-sx-group { display: inline-flex; align-items: center; gap: 10px; padding: 3px 10px 3px 4px;
      border: 1px solid #e0d7f2; background: #faf8fe; border-radius: 7px; }
    .ii-exact-set { display: inline-flex; align-items: center; gap: 9px; font-size: 11px; color: #6c757d; }
    .ii-ex-all-lbl { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
    .ii-ex-all-lbl input { cursor: pointer; }
    .ii-exact-set label { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; margin: 0; }
    .ii-exact-set input { cursor: pointer; }
    .ii-cand.inmb { opacity: .72; }
    .ii-cand-inmb { margin-left: auto; font-size: 9px; font-weight: 700; color: #198754; flex-shrink: 0; }
    .ii-lookup { flex: 1; min-width: 0; font-size: 11px; white-space: normal;
      word-break: break-word; line-height: 1.35; }
    .ii-lookup.ok   { color: #198754; }
    .ii-lookup.warn { color: #b8860b; }
    .ii-lookup.err  { color: #dc3545; }
    .ii-lookup.spin { color: #6c757d; }
    .ii-lookup-rel { color: #6c757d; }
    .ii-lookup.pending { color: #6c757d; cursor: pointer; text-decoration: underline dotted #adb5bd; text-underline-offset: 2px; }
    .ii-lookup.pending:hover { color: #343a40; }
    .ii-cand-refine { font-size: 10.5px; color: #6f42c1; cursor: pointer; padding: 2px 7px;
      border: 1px dashed #d6c7ee; border-radius: 4px; background: #faf8fe; width: max-content; }
    .ii-cand-refine:hover { background: #f0e9fb; text-decoration: underline; }
    .ii-cand-pending { font-size: 10.5px; color: #6c757d; cursor: pointer; padding: 3px 8px;
      border: 1px dashed #ced4da; border-radius: 4px; background: #f8f9fa; width: max-content; }
    .ii-cand-pending:hover { background: #eceef0; color: #343a40; border-color: #adb5bd; }

    /* SoundExchange refine panel */
    #ii-sxpanel { position: fixed; top: 9vh; right: 4vw; width: 560px; max-width: 92vw; max-height: 78vh;
      background: #fff; border: 1px solid #cdb8ee; border-radius: 10px; box-shadow: 0 14px 44px rgba(0,0,0,.32);
      z-index: 1000001; display: none; flex-direction: column; overflow: hidden; font-family: system-ui, sans-serif; }
    #ii-sxpanel.open { display: flex; }
    .ii-sxp-hdr { display: flex; align-items: center; gap: 8px; padding: 9px 13px; background: #f7f3fe;
      border-bottom: 1px solid #e6dcf7; cursor: move; user-select: none; }
    .ii-sxp-hdr .t { flex: 1; font-size: 13px; font-weight: 700; color: #4b2e83; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ii-sxp-hdr .t b { color: #6f42c1; }
    #ii-sxp-close { background: none; border: none; font-size: 17px; color: #6c757d; cursor: pointer; line-height: 1; }
    #ii-sxp-close:hover { color: #212529; }
    .ii-sxp-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; padding: 10px 13px 10px; align-items: start; }
    .ii-sxp-field { position: relative; display: flex; align-items: center; }
    #ii-sxp-f-title { grid-column: 1; } #ii-sxp-f-artist { grid-column: 2; }
    #ii-sxp-f-release { grid-column: 1 / 3; }
    .ii-sxp-inp { width: 100%; padding: 6px 31px; border: 1px solid #ced4da; border-radius: 6px; font-size: 13px; box-sizing: border-box; }
    .ii-sxp-inp:focus { outline: none; border-color: #6f42c1; }
    .ii-sxp-field.off .ii-sxp-inp { color: #adb5bd; background: #f8f9fa; }
    .ii-sxp-en { position: absolute; left: 8px; width: 15px; height: 15px; margin: 0; cursor: pointer; z-index: 1; flex-shrink: 0; }
    .ii-sxp-E { position: absolute; right: 5px; width: 23px; height: 23px; padding: 0; display: inline-flex; align-items: center;
      justify-content: center; font-size: 12px; font-weight: 700; color: #adb5bd; background: #fff; border: 1px solid #e9ecef;
      border-radius: 4px; cursor: pointer; }
    .ii-sxp-E:hover { color: #6f42c1; border-color: #d6c7ee; }
    .ii-sxp-E.on { color: #212529; border-color: #212529; }
    .ii-sxp-field.off .ii-sxp-E { opacity: .4; pointer-events: none; }
    #ii-sxp-search { grid-column: 3; grid-row: 1 / 3; align-self: stretch; padding: 0 18px; border: none;
      border-radius: 6px; background: #6f42c1; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
    #ii-sxp-search:hover { background: #5a32a3; } #ii-sxp-search:disabled { background: #adb5bd; }
    .ii-sxp-status { padding: 2px 13px; font-size: 11px; color: #6c757d; min-height: 14px; }
    .ii-sxp-status.err { color: #dc3545; }
    .ii-sxp-results { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 13px 12px; display: flex; flex-direction: column; gap: 4px; }
    .ii-sxp-row { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border: 1px solid #e9ecef;
      border-radius: 6px; cursor: pointer; overflow: hidden; flex-shrink: 0; }
    .ii-sxp-row:hover { background: #f0f6ff; border-color: #9ec5fe; }
    .ii-sxp-row.best { border-color: #6ea8fe; background: #d4e6ff; }
    .ii-sxp-row.warn { border-color: #ffe08a; background: #fff3cd; }
    .ii-sxp-row.bad  { border-color: #f3c6cb; background: #fdf2f3; }
    .ii-sxp-row.cur  { border-color: #198754; background: #d1e7dd; }
    .ii-sxp-row { align-items: flex-start; }
    .ii-sxp-isrc { font-family: 'Courier New', monospace; font-weight: 700; color: #084298; flex-shrink: 0; font-size: 12px; padding-top: 1px; }
    .ii-sxp-meta { flex: 1; min-width: 0; }
    .ii-sxp-meta .a { display: block; font-size: 12px; color: #212529; white-space: normal; word-break: break-word; line-height: 1.35; }
    .ii-sxp-meta .b { display: block; font-size: 10.5px; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ii-sxp-inmb { font-size: 9px; font-weight: 700; color: #198754; flex-shrink: 0; }
    .ii-sxp-foot { padding: 8px 13px; border-top: 1px solid #eee; background: #fbfbfd; flex-shrink: 0; }
    .ii-sxp-foot a { font-size: 11.5px; font-weight: 600; color: #6f42c1; text-decoration: none; }
    .ii-sxp-foot a:hover { text-decoration: underline; }
  `;
  // @run-at document-start (needed for the Spotify harvester) can fire before
  // <html>/<head> exist; the MB-side editor only needs the DOM, so defer to ready.
  function whenDomReady(fn) {
    if (document.head || document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }
  whenDomReady(() => (document.head || document.documentElement).appendChild(style));

  /* ═══════════════════════════════════════════════════════════════════════
     RELEASE MODEL (single WS2 fetch → everything)
  ═══════════════════════════════════════════════════════════════════════ */
  let RELEASE = null; // { title, tracks:[{recId, title, artist, dur, mediumPos, trackPos, existing:[], pending:''}], deezerId, spotifyId }

  function fetchRelease() {
    return gmGet(
      MB_WS2 + 'release/' + mbid + '?inc=recordings+artist-credits+isrcs+url-rels+release-groups&fmt=json',
      { 'Accept': 'application/json', 'User-Agent': UA }
    ).then(r => {
      if (r.status !== 200) throw new Error('MB ' + r.status);
      const data = JSON.parse(r.responseText);
      const tracks = [];
      (data.media || []).forEach(med => {
        (med.tracks || []).forEach(trk => {
          const rec = trk.recording || {};
          tracks.push({
            recId:     rec.id || '',
            title:     trk.title || rec.title || '',
            artist:    acName(trk['artist-credit'] || rec['artist-credit']),
            dur:       msToMmSs(trk.length || rec.length) || '',
            mediumPos: med.position,
            mediumTitle: med.title || '',
            trackPos:  trk.position,
            number:    trk.number,
            existing:  (rec.isrcs || []).slice(),
            pending:   '',
          });
        });
      });
      const rels = data.relations || [];
      let deezerId = null, spotifyId = null;
      rels.forEach(rel => {
        const u = rel.url && rel.url.resource;
        if (!u) return;
        let m;
        if ((m = u.match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/))) spotifyId = m[1];
        if ((m = u.match(/deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/)))   deezerId  = m[1];
      });
      // earliest release year for the "SX result newer than MB release" check —
      // prefer the release-group's first-release-date, fall back to this release's date
      const rg = data['release-group'] || {};
      const dateStr = rg['first-release-date'] || data.date || '';
      const year = parseInt((String(dateStr).match(/^(\d{4})/) || [])[1]) || null;
      // this release's own date year + artist, for the header (mirrors what MB shows)
      const releaseYear = parseInt((String(data.date || '').match(/^(\d{4})/) || [])[1]) || year;
      const artist = acName(data['artist-credit']);
      // Restore Remove-ISRC edits we previously submitted (still pending in MB's
      // queue, so WS2 still lists the ISRC). Keep only ISRCs still on the recording
      // — a gone one means the edit was applied, so drop it from storage.
      const pend = loadPendingRemovals();
      let pendChanged = false;
      tracks.forEach(t => {
        const stored = pend[t.recId] || [];
        const stillThere = stored.filter(i => t.existing.includes(normalizeIsrc(i)));
        if (stillThere.length) t.pendingRemoval = stillThere;
        if (stillThere.length !== stored.length) { pend[t.recId] = stillThere; pendChanged = true; }
      });
      Object.keys(pend).forEach(rid => { if (!tracks.some(t => t.recId === rid)) { delete pend[rid]; pendChanged = true; } });
      if (pendChanged) savePendingRemovals(pend);
      RELEASE = { title: data.title || '', tracks, deezerId, spotifyId, year, releaseYear, artist };
      Log.info('Release "' + RELEASE.title + '"' + (year ? ' (' + year + ')' : '') + ': ' + tracks.length + ' track(s), ' +
        tracks.filter(t => !t.existing.length).length + ' missing ISRC' +
        '; links: ' + (deezerId ? 'Deezer ' + deezerId : 'no Deezer') + ', ' + (spotifyId ? 'Spotify ' + spotifyId : 'no Spotify'));
      return RELEASE;
    });
  }
  function acName(ac) {
    if (!Array.isArray(ac)) return '';
    return ac.map(c => (c.name || (c.artist && c.artist.name) || '') + (c.joinphrase || '')).join('');
  }
  // Persisted pending Remove-ISRC edits for this release: { recId: [isrcs] }.
  function pendKey() { return 'pending_removals_' + mbid; }
  function loadPendingRemovals() { try { return JSON.parse(store.get(pendKey(), '') || '{}') || {}; } catch (e) { return {}; } }
  function savePendingRemovals(map) {
    const has = map && Object.keys(map).some(k => (map[k] || []).length);
    if (has) store.set(pendKey(), JSON.stringify(map)); else store.del(pendKey());
  }
  function recordPendingRemoval(recId, isrcs) {
    const map = loadPendingRemovals();
    map[recId] = [...new Set((map[recId] || []).concat(isrcs.map(normalizeIsrc)))];
    savePendingRemovals(map);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     OAUTH (one-time authorize, offline refresh token)
  ═══════════════════════════════════════════════════════════════════════ */
  const Auth = {
    // baked-in shared app, with an optional GM-storage override for power users
    clientId()     { return store.get('oauth_client_id', '')     || OAUTH.clientId; },
    clientSecret() { return store.get('oauth_client_secret', '') || OAUTH.clientSecret; },
    refreshTok()   { return store.get('oauth_refresh_token', ''); },
    isAuthorized() { return !!this.refreshTok(); },

    authorizeUrl() {
      const p = new URLSearchParams({
        response_type: 'code',
        client_id:     this.clientId(),
        redirect_uri:  OAUTH.redirect,
        scope:         OAUTH.scope,
        access_type:   'offline',
      });
      return OAUTH.authUrl + '?' + p.toString();
    },

    async exchangeCode(code) {
      const body = new URLSearchParams({
        grant_type:    'authorization_code',
        code:          code.trim(),
        client_id:     this.clientId(),
        client_secret: this.clientSecret(),
        redirect_uri:  OAUTH.redirect,
      }).toString();
      const r = await gmPost(OAUTH.tokenUrl, body, { 'Content-Type': 'application/x-www-form-urlencoded' });
      const j = JSON.parse(r.responseText || '{}');
      if (!j.refresh_token) throw new Error(j.error_description || j.error || ('token exchange failed (' + r.status + ')'));
      store.set('oauth_refresh_token', j.refresh_token);
      store.set('oauth_access_token', j.access_token || '');
      store.set('oauth_access_expiry', Date.now() + ((j.expires_in || 3600) * 1000));
    },

    async accessToken() {
      const tok = store.get('oauth_access_token', '');
      const exp = store.get('oauth_access_expiry', 0);
      if (tok && Date.now() < exp - 60000) return tok;
      const refresh = this.refreshTok();
      if (!refresh) throw new Error('not authorized — open ⚙ Setup');
      const body = new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refresh,
        client_id:     this.clientId(),
        client_secret: this.clientSecret(),
      }).toString();
      const r = await gmPost(OAUTH.tokenUrl, body, { 'Content-Type': 'application/x-www-form-urlencoded' });
      const j = JSON.parse(r.responseText || '{}');
      if (!j.access_token) throw new Error(j.error_description || j.error || ('token refresh failed (' + r.status + ')'));
      store.set('oauth_access_token', j.access_token);
      store.set('oauth_access_expiry', Date.now() + ((j.expires_in || 3600) * 1000));
      return j.access_token;
    },

    signOut() {
      ['oauth_refresh_token', 'oauth_access_token', 'oauth_access_expiry'].forEach(store.del);
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     WS2 ISRC SUBMISSION
  ═══════════════════════════════════════════════════════════════════════ */
  function buildIsrcXml(map, editNote) {
    let x = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">\n';
    if (editNote) x += '  <edit-note>' + esc(editNote) + '</edit-note>\n';
    x += '<recording-list>\n';
    for (const [rid, isrcs] of Object.entries(map)) {
      x += '  <recording id="' + rid + '"><isrc-list>';
      isrcs.forEach(i => { x += '<isrc id="' + i + '"/>'; });
      x += '</isrc-list></recording>\n';
    }
    x += '</recording-list>\n</metadata>';
    return x;
  }

  async function submitIsrcs(map, editNote) {
    const token = await Auth.accessToken();
    const xml = buildIsrcXml(map, editNote);
    const url = MB_WS2 + 'recording/?client=' + CLIENT;
    const r = await gmPost(url, xml, {
      'Content-Type':  'application/xml; charset=utf-8',
      'Authorization': 'Bearer ' + token,
      'Accept':        'application/xml',
    });
    if (r.status === 200) return;
    throw new Error('submit failed (' + r.status + '): ' +
      (r.responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SOUNDEXCHANGE (ported from magicisrc_soundexchange, DOM-independent core)
  ═══════════════════════════════════════════════════════════════════════ */
  const SX = (function () {
    let _token = 'ff5284e764c4a90c1a2c2940f6a9aa593c63b8e8';
    let _tokenFetch = null;

    function extractToken(text) {
      const pats = [/[Tt]oken ([a-f0-9]{40})/, /["'](Token [a-f0-9]{40})["']/, /([a-f0-9]{40})/];
      for (const p of pats) {
        const m = text.match(p);
        if (m) { const h = (m[1] || m[0]).match(/[a-f0-9]{40}/); if (h) return h[0]; }
      }
      return null;
    }
    function refreshToken() {
      if (_tokenFetch) return _tokenFetch;
      _tokenFetch = gmGet(SX_HOME, { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' })
        .then(r1 => {
          _tokenFetch = null;
          if (r1.status !== 200) throw new Error('SX home ' + r1.status);
          const inline = extractToken(r1.responseText);
          if (inline) { _token = inline; return _token; }
          const urls = [];
          const re = /<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi;
          let m;
          while ((m = re.exec(r1.responseText)) !== null) {
            urls.push(m[1].startsWith('http') ? m[1] : SX_HOME.replace(/\/$/, '') + m[1]);
          }
          urls.sort((a, b) => (/entry|main/i.test(b) ? 1 : 0) - (/entry|main/i.test(a) ? 1 : 0));
          return (async () => {
            for (const url of urls.slice(0, 15)) {
              try {
                const r2 = await gmGet(url, { 'Accept': '*/*', 'Referer': SX_HOME });
                if (r2.status !== 200) continue;
                const tok = extractToken(r2.responseText);
                if (tok) { _token = tok; return _token; }
              } catch (e) {}
            }
            throw new Error('SX token not found');
          })();
        }).catch(e => { _tokenFetch = null; throw e; });
      return _tokenFetch;
    }

    function fields(item) {
      return {
        isrc:    item.isrc || '',
        title:   item.recordingTitle || '',
        artist:  item.recordingArtistName || '',
        version: item.recordingVersion || '',
        year:    item.recordingYear || '',
        dur:     item.duration || '',
        relTitle: item.releaseName || '',
        relLabel: item.releaseLabel || '',
        relDate: (item.releaseDate || '').slice(0, 7),
      };
    }
    function classify(f, mbTitle, mbArtist, mbDurStr, mbYear) {
      if (!isGoodMatch(f.title, f.artist, mbTitle, mbArtist)) return 'other';
      // a recording released after MB's release year (with 1y tolerance) can't be
      // the source of this release's ISRC — treat as a non-match
      if (mbYear && f.year && parseInt(f.year) > mbYear + 1) return 'other';
      const a = durToSec(mbDurStr), b = durToSec(f.dur);
      if (a !== null && b !== null && Math.abs(a - b) > 10) return 'warn';
      return 'best';
    }

    const applyExact = (v, exact) => (v && exact) ? '"' + String(v).replace(/"/g, '') + '"' : (v || '');
    function dedupe(raw) {
      const seen = new Map();
      raw.forEach(item => {
        const key = item.isrc || item.id;
        if (!seen.has(key)) seen.set(key, Object.assign({}, item, { _rels: [] }));
        if (item.releaseName) seen.get(key)._rels.push(item);
      });
      const rows = [...seen.values()];
      rows.forEach(it => {
        if (it._rels.length > 1) it._rels.sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));
        const e = it._rels[0];
        if (e) { it.releaseName = e.releaseName; it.releaseLabel = e.releaseLabel; it.releaseDate = e.releaseDate; }
      });
      return rows;
    }
    function post(body) {
      const doReq = (token) => gmPost(SX_API, body, {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'Authorization': 'Token ' + token, 'Origin': SX_HOME, 'Referer': SX_HOME,
      }).then(r => {
        if (r.status === 0) throw new Error('blocked (SX returned 0 — connection refused?)');
        if (r.status === 401 || r.status === 403) { Log.warn('SX ' + r.status + ' — refreshing token'); return refreshToken().then(t => doReq(t)); }
        let p; try { p = JSON.parse(r.responseText); } catch (e) { throw new Error('SX parse error'); }
        return dedupe(p.recordings || p.results || p.data || (Array.isArray(p) ? p : []));
      });
      return doReq(_token);
    }
    // exact = { title, artist, release }; opts release string optional
    function apiSearch(title, artist, start, count, exact, release) {
      exact = exact || {};
      return post(JSON.stringify({
        searchFields: {
          recordingArtistName: { value: applyExact(artist, exact.artist) },
          recordingTitle:      { value: applyExact(title, exact.title) },
          releaseName:         { value: applyExact(release || '', exact.release) },
        },
        start: start || 0, number: count || 20, showReleases: true,
      }));
    }
    function apiSearchByIsrc(isrc) {
      return post(JSON.stringify({ searchFields: { isrc: isrc }, start: 0, number: 10, showReleases: true }));
    }

    return { refreshToken, apiSearch, apiSearchByIsrc, fields, classify };
  })();

  // SX exact-match toggles (persisted)
  const sxExact = {
    title:   !!store.get('sx_exact_title', false),
    artist:  !!store.get('sx_exact_artist', false),
    release: !!store.get('sx_exact_release', false),
  };
  function saveSxExact() {
    store.set('sx_exact_title', sxExact.title);
    store.set('sx_exact_artist', sxExact.artist);
    store.set('sx_exact_release', sxExact.release);
  }
  // Refine-panel "use this term" toggles. title/artist reset to ON every time the
  // panel opens; the release toggle (default OFF) is remembered across invocations.
  let sxRelEnabled = !!store.get('sx_rel_enabled', false);

  /* ═══════════════════════════════════════════════════════════════════════
     DEEZER  (free public API, no auth)
  ═══════════════════════════════════════════════════════════════════════ */
  let _dzListCache = null;   // { albumId, list } — tracklist cached across batches
  // Fetches ONE batch (STREAM_BATCH_LIMIT tracks) starting at `start`. Deezer's
  // album endpoint lacks ISRCs, so each track needs its own request — a 1000-track
  // release would be 1000 calls, hence the batching. Returns { total, next }.
  async function fetchDeezer(albumId, onProgress, onIsrc, start) {
    start = start || 0;
    // (re)fetch the tracklist on a fresh import (start 0) or album change; reuse it on continue
    if (start === 0 || !_dzListCache || _dzListCache.albumId !== albumId) {
      const r = await gmGet('https://api.deezer.com/album/' + albumId, { 'Accept': 'application/json' });
      const data = JSON.parse(r.responseText || '{}');
      if (data.error) throw new Error((data.error.message || data.error.type || 'Deezer error') + ' (album ' + albumId + ')');
      const list = (data.tracks && data.tracks.data) || [];
      Log.info('Deezer album "' + (data.title || albumId) + '": ' + list.length + ' track(s)' +
        (list.length > STREAM_BATCH_LIMIT ? ' — fetching ' + STREAM_BATCH_LIMIT + ' at a time' : ''));
      _dzListCache = { albumId, list };
    }
    const list = _dzListCache.list;
    const end = Math.min(start + STREAM_BATCH_LIMIT, list.length);
    let failed = 0;
    for (let i = start; i < end; i++) {
      const t = list[i];
      try {
        const tr = await gmGet('https://api.deezer.com/track/' + t.id, { 'Accept': 'application/json' });
        const td = JSON.parse(tr.responseText || '{}');
        if (td.error) { failed++; Log.warn('Deezer track ' + t.id + ': ' + (td.error.message || td.error.type)); }
        const entry = {
          isrc:   normalizeIsrc(td.isrc || ''),
          title:  td.title || t.title || '',
          artist: (td.artist && td.artist.name) || '',
          disc:   td.disk_number || t.disk_number || 1,
          pos:    td.track_position || t.track_position || (i + 1),
          dur:    td.duration ? msToMmSs(td.duration * 1000) : '',
        };
        if (onIsrc && isValidIsrc(entry.isrc)) onIsrc(entry);   // fill this track's input now
      } catch (e) { failed++; Log.warn('Deezer track ' + t.id + ' fetch failed: ' + errText(e)); }
      try { if (onProgress) onProgress(i + 1, list.length); } catch (e) { Log.warn('Deezer progress update hiccup: ' + errText(e)); }
      await sleep(120);
    }
    if (failed) Log.warn('Deezer: ' + failed + ' track fetch(es) failed in this batch');
    return { total: list.length, next: end < list.length ? end : null };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SPOTIFY  (via ISRC Hunt)
     Spotify's anti-bot makes a direct userscript token-harvest unreliable, but
     ISRC Hunt does the Spotify lookup server-side and renders the ISRCs into a
     plain HTML table — so we just fetch that and scrape it (no token, no login).
  ═══════════════════════════════════════════════════════════════════════ */
  function parseIsrchunt(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = [...doc.querySelectorAll('table')];
    // results table columns: Track number · Track name · Length · ISRC · …
    const table = tables.find(t => /\bISRC\b/i.test(t.textContent) && /track/i.test(t.textContent)) || tables[0];
    const out = [];
    if (!table) return out;
    [...table.querySelectorAll('tr')].forEach(tr => {
      const td = [...tr.querySelectorAll('td')];
      if (td.length < 4) return;
      const pos = parseInt(td[0].textContent.trim(), 10);
      const lenMs = parseInt(td[2].textContent.trim(), 10);
      const isrc = normalizeIsrc(td[3].textContent.trim());
      if (isValidIsrc(isrc)) out.push({ isrc, title: td[1].textContent.trim(), artist: '', pos: pos || (out.length + 1), disc: 1, dur: lenMs ? msToMmSs(lenMs) : '' });
    });
    return out;
  }
  async function fetchSpotify(albumId, onProgress, onIsrc) {
    if (onProgress) onProgress(0, 0);
    const albumUrl = 'https://open.spotify.com/album/' + albumId;
    const url = 'https://isrchunt.com/spotify/importisrc?releaseId=' + encodeURIComponent(albumUrl);
    Log.info('Spotify via ISRC Hunt: ' + shortUrl(url));
    const r = await gmGet(url, { 'Accept': 'text/html' });
    if (r.status !== 200) throw new Error('ISRC Hunt returned ' + r.status);
    const rows = parseIsrchunt(r.responseText);
    Log.info('ISRC Hunt: ' + rows.length + ' track(s) with an ISRC');
    if (!rows.length) throw new Error('ISRC Hunt found no ISRCs for this album');
    rows.forEach((e, i) => {
      try { if (onIsrc) onIsrc(e); } catch (err) { Log.warn('Spotify map hiccup for ' + e.isrc + ': ' + errText(err)); }
      try { if (onProgress) onProgress(i + 1, rows.length); } catch (err) {}
    });
    return { total: rows.length, next: null };   // ISRC Hunt returns everything in one request — never batched
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EDITOR MODAL — DOM
  ═══════════════════════════════════════════════════════════════════════ */
  let overlay, modal, tbody, summaryEl, progEl, submitBtn;
  let built = false;
  let noteEdited = false;                 // has the user hand-edited the edit note?
  const _isrcLookupCache = {};            // isrc -> SX rows (single-ISRC lookup cache)

  // Header line: script name, version, author, homepage — resolved from GM_info
  // (Violentmonkey/Greasemonkey: homepageURL; Tampermonkey: homepage) with
  // hard-coded fallbacks, so "undefined" never leaks into an edit note.
  function noteHeader() {
    let s = {};
    try { if (typeof GM_info !== 'undefined' && GM_info.script) s = GM_info.script; } catch (e) {}
    const name = s.name || 'ISRC Scout';
    const version = s.version || SCRIPT_VERSION;
    const author = s.author || 'majkinetor';
    const homepage = s.homepageURL || s.homepage || SCRIPT_URL;
    return name + ' v' + version + ' by ' + author + ' - ' + homepage;
  }
  function defaultNote() {
    const subs = RELEASE ? RELEASE.tracks.filter(t => { const v = normalizeIsrc(t.pending); return v && isValidIsrc(v) && !t.existing.includes(v); }) : [];
    // per-source breakdown, e.g. "SoundExchange (2), Spotify (1), manual (1)"
    const counts = {};
    subs.forEach(t => { const src = t.source || 'manual'; counts[src] = (counts[src] || 0) + 1; });
    const breakdown = Object.keys(counts).sort().map(src => src + ' (' + counts[src] + ')').join(', ');
    const lines = [
      noteHeader(),
      '',
      'Release: ' + MB_ROOT + '/release/' + mbid,
      'Added ' + subs.length + ' ISRC' + (subs.length === 1 ? '' : 's') + (breakdown ? ': ' + breakdown : ''),
    ];
    return lines.join('\n');
  }
  function ensureNote(force) {
    const ta = modal.querySelector('#ii-note-text');
    if (force || (!noteEdited && !ta.value.trim())) { ta.value = defaultNote(); noteEdited = false; }
  }
  function getEditNote() {
    const ta = modal.querySelector('#ii-note-text');
    return (noteEdited && ta.value.trim()) ? ta.value.trim() : defaultNote();
  }
  function refreshDeleteBtn() {
    const n = tbody.querySelectorAll('.ii-ex-del:checked').length;
    const btn = modal.querySelector('#ii-delete');
    btn.disabled = n === 0;
    btn.textContent = n ? '🗑 Delete ' + n + ' ISRC' + (n === 1 ? '' : 's') : '🗑 Delete checked';
  }

  function buildModal() {
    if (built) return;
    built = true;

    overlay = document.createElement('div');
    overlay.id = 'ii-overlay';
    // Intentionally NO overlay-click or Esc close — only the ✕ button closes,
    // so a stray click/keypress can't discard entered ISRCs.

    modal = document.createElement('div');
    modal.id = 'ii-modal';
    modal.addEventListener('click', e => e.stopPropagation());
    modal.innerHTML = `
      <div id="ii-hdr">
        <h2><svg class="ii-logo" width="22" height="22" viewBox="0 0 128 128" aria-hidden="true"><path d="M64 64 L64 24 A40 40 0 0 1 99 84 Z" fill="#d8c8f2"/><g fill="none" stroke="#6f42c1" stroke-width="7"><circle cx="64" cy="64" r="40"/><circle cx="64" cy="64" r="26" stroke-width="5" stroke="#b9a3e8"/><circle cx="64" cy="64" r="13" stroke-width="5" stroke="#b9a3e8"/></g><line x1="64" y1="64" x2="64" y2="24" stroke="#6f42c1" stroke-width="7" stroke-linecap="round"/><circle cx="86" cy="50" r="8" fill="#4b2e83"/></svg> <em>ISRC Scout</em><span class="ii-sub" id="ii-rel-sub"></span></h2>
        <a class="ii-tbtn" id="ii-history" target="_blank" rel="noopener"
           href="${MB_ROOT}/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=76&conditions.0.args=78&conditions.1.field=editor&conditions.1.operator=me&conditions.1.name=&conditions.1.args.0="
           title="Your Add/Remove ISRC edits on MusicBrainz">🕓 My ISRC edits</a>
        <button class="ii-tbtn" id="ii-bulk-toggle" title="Bulk paste / import / export">⇪ Bulk / Export</button>
        <button class="ii-tbtn" id="ii-log-toggle" title="Activity log">Log</button>
        <button class="ii-tbtn" id="ii-setup-toggle" title="OAuth setup">⚙ Setup</button>
        <button id="ii-close" title="Close">✕</button>
      </div>

      <div class="ii-pane" id="ii-setup-pane">
        <h3><button class="ii-pane-x" title="Close">✕</button>One-time MusicBrainz authorization</h3>
        <div class="ii-authstate" id="ii-auth-state"></div>
        <div class="row" style="margin-top:8px; flex-wrap:nowrap">
          <button class="ii-tbtn primary" id="ii-authorize" style="flex-shrink:0">Authorize</button>
          <input type="text" id="ii-oauth-code" placeholder="Auto-fills on success — paste the code here only if the tab fails to close" autocomplete="off" style="flex:1; min-width:180px">
          <button class="ii-tbtn ghost" id="ii-signout" style="flex-shrink:0; display:none">Sign out</button>
        </div>
        <div class="ii-help">
          Click <b>Authorize</b> → approve in the MusicBrainz tab → it captures the code and closes itself.
          One time, ever; no app registration. If the tab can't close on its own, paste the code it shows into the box above (Enter to submit).
        </div>
      </div>

      <div class="ii-pane" id="ii-bulk-pane">
        <h3><button class="ii-pane-x" title="Close">✕</button>Bulk paste / import / export</h3>
        <div class="ii-help" style="margin-top:0">
          Paste one ISRC per line, in track order (blank line = skip a track). Lines like <code>3=USABC1234567</code>
          or <code>USABC1234567 | 1.3</code> target a specific track number. Or paste JSON exported below.
        </div>
        <textarea id="ii-bulk-text" placeholder="USABC1234567&#10;USABC1234568&#10;..."></textarea>
        <div class="row" style="margin-top:8px">
          <button class="ii-tbtn primary" id="ii-bulk-apply">Apply to empty fields</button>
          <button class="ii-tbtn" id="ii-bulk-apply-all">Apply (overwrite)</button>
          <button class="ii-tbtn" id="ii-export-text">Export text</button>
          <button class="ii-tbtn" id="ii-export-json">Export JSON</button>
        </div>
      </div>

      <div class="ii-pane" id="ii-note-pane">
        <h3><button class="ii-pane-x" title="Close">✕</button>Edit note
          <button class="ii-tbtn" id="ii-note-reset" style="padding:2px 9px;font-size:11px">Reset to default</button>
        </h3>
        <textarea id="ii-note-text" placeholder="Optional edit note attached to the submission…"></textarea>
        <div class="ii-help" style="margin-top:0">Attached to every ISRC add/remove you submit. Auto-filled with the script name + counts; edit freely (your text is kept until you Reset).</div>
      </div>

      <div class="ii-pane" id="ii-log-pane">
        <h3><button class="ii-pane-x" title="Close">✕</button>Activity log
          <button class="ii-tbtn" id="ii-log-copy" style="padding:2px 9px;font-size:11px">Copy</button>
          <button class="ii-tbtn ghost" id="ii-log-clear" style="padding:2px 9px;font-size:11px">Clear</button>
        </h3>
        <pre id="ii-log-out"></pre>
      </div>

      <div id="ii-tools">
        <span class="ii-sx-group">
          <button class="ii-tbtn sx" id="ii-sx-all" title="Search every track on SoundExchange">⟳ SoundExchange</button>
          <span class="ii-exact-set" title="Wrap the SoundExchange query in quotes for an exact match">
            <label><input type="checkbox" id="ii-ex-title">exact title</label>
            <label><input type="checkbox" id="ii-ex-artist">exact artist</label>
            <label><input type="checkbox" id="ii-ex-release">exact release</label>
          </span>
        </span>
        <span class="ii-split"><button class="ii-tbtn dz" id="ii-dz-all" title="Import ISRCs from the linked Deezer album">Deezer</button><button class="ii-tbtn dz ii-caret" id="ii-dz-menu" title="More — import from a custom Deezer URL">▾</button></span>
        <button class="ii-tbtn sp" id="ii-sp-all" title="Import ISRCs from the linked Spotify album">Spotify</button>
        <span class="ii-prog" id="ii-prog"></span>
        <span class="ii-tspacer"></span>
        <button class="ii-tbtn ghost" id="ii-clear-pending" title="Clear all entered ISRCs">Clear entered</button>
      </div>

      <div id="ii-body">
        <table id="ii-table">
          <colgroup>
            <col style="width:32px"><col><col style="width:44px"><col style="width:124px"><col style="width:560px">
          </colgroup>
          <thead><tr>
            <th>#</th><th>Track</th><th></th>
            <th><label class="ii-ex-all-lbl" title="Select all existing ISRCs for removal"><input type="checkbox" id="ii-ex-all">Existing</label></th>
            <th>New ISRC</th>
          </tr></thead>
          <tbody id="ii-tbody"></tbody>
        </table>
      </div>

      <div id="ii-foot">
        <span class="ii-summary" id="ii-summary"></span>
        <button class="ii-tbtn" id="ii-delete" title="Delete the checked existing ISRCs" disabled>🗑 Delete checked</button>
        <button class="ii-tbtn ghost" id="ii-note-toggle" title="Edit note">✎ Edit note</button>
        <button class="ii-tbtn primary" id="ii-submit">Submit to MusicBrainz</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    // The custom-URL menu lives on <body>, NOT inside #ii-modal: the modal has a
    // transform (centering) which would make a position:fixed child anchor to the
    // modal instead of the viewport, plus overflow:hidden would clip it. On <body>
    // it positions correctly under the caret and dodges MB's container button CSS.
    const srcMenu = document.createElement('div');
    srcMenu.id = 'ii-src-menu';
    srcMenu.className = 'ii-srcmenu';
    srcMenu.innerHTML =
      // shown only when Platform Check (separate userscript) is installed AND found a URL for this source
      '<button class="ii-srcmenu-pc" id="ii-src-pc" type="button" style="display:none">' +
      '⌖ Use the <b id="ii-src-pc-label">Deezer</b> URL Platform Check found<span class="ii-srcmenu-pc-url" id="ii-src-pc-url"></span></button>' +
      '<div class="ii-srcmenu-t">Import from a custom <b id="ii-src-label">Deezer</b> album URL</div>' +
      '<div class="ii-srcmenu-row">' +
      '<input type="text" id="ii-src-url" placeholder="Paste album URL…" autocomplete="off">' +
      '<button class="ii-tbtn primary" id="ii-src-go">Import</button></div>';
    document.body.appendChild(srcMenu);
    buildSxPanel();

    tbody     = modal.querySelector('#ii-tbody');
    summaryEl = modal.querySelector('#ii-summary');
    progEl    = modal.querySelector('#ii-prog');
    submitBtn = modal.querySelector('#ii-submit');

    modal.querySelector('#ii-close').addEventListener('click', closeModal);
    modal.querySelector('#ii-setup-toggle').addEventListener('click', () => togglePane('ii-setup-pane'));
    modal.querySelector('#ii-bulk-toggle').addEventListener('click', () => togglePane('ii-bulk-pane'));
    modal.querySelector('#ii-clear-pending').addEventListener('click', clearPending);
    modal.querySelector('#ii-sx-all').addEventListener('click', runSxAll);

    // log pane
    Log.setPane(modal.querySelector('#ii-log-out'));
    modal.querySelector('#ii-log-toggle').addEventListener('click', () => togglePane('ii-log-pane'));
    modal.querySelector('#ii-log-copy').addEventListener('click', () => {
      try { navigator.clipboard.writeText(Log.text()); toast('Log copied'); } catch (e) { toast('Copy failed', 'err'); }
    });
    modal.querySelector('#ii-log-clear').addEventListener('click', () => Log.clear());

    // SX exact toggles
    [['ii-ex-title', 'title'], ['ii-ex-artist', 'artist'], ['ii-ex-release', 'release']].forEach(([id, key]) => {
      const cb = modal.querySelector('#' + id);
      cb.checked = sxExact[key];
      cb.addEventListener('change', () => { sxExact[key] = cb.checked; saveSxExact(); Log.info('SX exact ' + key + ' = ' + cb.checked); });
    });

    modal.querySelector('#ii-dz-all').addEventListener('click', runDeezer);
    modal.querySelector('#ii-sp-all').addEventListener('click', runSpotify);
    modal.querySelector('#ii-dz-menu').addEventListener('click', e => toggleSrcMenu('Deezer', e.currentTarget));
    // Spotify has no ▾ menu: it imports via ISRC Hunt, which resolves the MB release
    // FROM the Spotify URL — a custom/not-in-MB URL can't work, so there's nothing to offer.
    document.getElementById('ii-src-go').addEventListener('click', submitSrcMenu);
    document.getElementById('ii-src-url').addEventListener('keydown', e => { if (e.key === 'Enter') submitSrcMenu(); });
    document.getElementById('ii-src-pc').addEventListener('click', importFromPlatformCheck);
    // close the custom-URL menu on click-outside
    document.addEventListener('mousedown', e => {
      const menu = document.getElementById('ii-src-menu');
      if (!menu || !menu.classList.contains('open')) return;
      if (menu.contains(e.target) || (e.target.closest && e.target.closest('.ii-caret'))) return;
      menu.classList.remove('open');
    });
    submitBtn.addEventListener('click', doSubmit);

    // delete-existing wiring (checkboxes are delegated)
    modal.querySelector('#ii-delete').addEventListener('click', doDelete);
    tbody.addEventListener('change', e => {
      if (!e.target.classList.contains('ii-ex-del')) return;
      e.target.closest('.ii-ex-item').classList.toggle('del', e.target.checked);
      refreshDeleteBtn();
    });
    modal.querySelector('#ii-ex-all').addEventListener('change', e => {
      const on = e.target.checked;
      tbody.querySelectorAll('.ii-ex-del').forEach(cb => { cb.checked = on; cb.closest('.ii-ex-item').classList.toggle('del', on); });
      refreshDeleteBtn();
    });

    // edit-note pane wiring
    modal.querySelector('#ii-note-toggle').addEventListener('click', () => { ensureNote(); togglePane('ii-note-pane'); });
    modal.querySelector('#ii-note-reset').addEventListener('click', () => { noteEdited = false; ensureNote(true); });
    modal.querySelector('#ii-note-text').addEventListener('input', () => { noteEdited = true; });

    // setup pane wiring
    modal.querySelector('#ii-authorize').addEventListener('click', onAuthorize);
    modal.querySelector('#ii-signout').addEventListener('click', () => { Auth.signOut(); refreshAuthState(); toast('Signed out'); });
    const codeInput = modal.querySelector('#ii-oauth-code');
    const tryCode = () => { const c = codeInput.value.trim(); if (c) { codeInput.value = ''; exchangeAndFinish(c, 'pasted'); } };
    codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryCode(); } });
    codeInput.addEventListener('paste', () => _setTimeout(tryCode, 50));

    // bulk pane wiring
    modal.querySelector('#ii-bulk-apply').addEventListener('click', () => applyBulk(false));
    modal.querySelector('#ii-bulk-apply-all').addEventListener('click', () => applyBulk(true));
    modal.querySelector('#ii-export-text').addEventListener('click', exportText);
    modal.querySelector('#ii-export-json').addEventListener('click', exportJson);

    // each sub-pane closes via its own ✕ (next to the title)
    modal.querySelectorAll('.ii-pane-x').forEach(b =>
      b.addEventListener('click', () => b.closest('.ii-pane').classList.remove('open')));
  }

  function togglePane(id) {
    modal.querySelectorAll('.ii-pane').forEach(p => {
      if (p.id === id) p.classList.toggle('open');
      else p.classList.remove('open');
    });
  }

  function openModal() {
    buildModal();
    overlay.classList.add('open');
    modal.classList.add('open');
    refreshAuthState();
    if (!RELEASE) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;color:#adb5bd">Loading release…</td></tr>';
      fetchRelease().then(renderTracks).catch(err => {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;color:#dc3545">Failed to load release: ' + esc(err.message) + '</td></tr>';
      });
    } else {
      renderTracks();
    }
  }
  function closeModal() {
    overlay.classList.remove('open');
    modal.classList.remove('open');
  }

  function refreshAuthState() {
    const el = modal.querySelector('#ii-auth-state');
    const pane = modal.querySelector('#ii-setup-pane');
    const authed = Auth.isAuthorized();
    // when authorized show Sign out; when not, show the code field in its place
    const code = modal.querySelector('#ii-oauth-code'), out = modal.querySelector('#ii-signout');
    if (code) code.style.display = authed ? 'none' : '';
    if (out)  out.style.display  = authed ? '' : 'none';
    if (authed && code) code.value = '';
    if (authed) {
      el.className = 'ii-authstate ok';
      el.textContent = '✓ Authorized — submit is ready.';
    } else {
      el.className = 'ii-authstate no';
      el.textContent = '• Not authorized yet. Click Authorize (one time).';
      pane.classList.add('open'); // nudge first-time users
    }
  }

  /* ── render the track table ── */
  function renderTracks() {
    modal.querySelector('#ii-rel-sub').textContent =
      RELEASE.title ? '· ' + [RELEASE.title, RELEASE.releaseYear, RELEASE.artist].filter(Boolean).join(' · ') : '';
    modal.querySelector('#ii-dz-all').disabled = !RELEASE.deezerId;
    modal.querySelector('#ii-sp-all').disabled = !RELEASE.spotifyId;
    modal.querySelector('#ii-dz-all').title = RELEASE.deezerId ? 'Import from Deezer' : 'No Deezer link on this release';
    modal.querySelector('#ii-sp-all').title = RELEASE.spotifyId ? 'Import from Spotify' : 'No Spotify link on this release';

    tbody.innerHTML = '';
    let lastMedium = null;
    RELEASE.tracks.forEach((t, idx) => {
      if (t.mediumPos !== lastMedium) {
        lastMedium = t.mediumPos;
        const mr = document.createElement('tr');
        mr.className = 'ii-medrow';
        mr.innerHTML = '<td colspan="5">Medium ' + t.mediumPos + (t.mediumTitle ? ': ' + esc(t.mediumTitle) : '') + '</td>';
        tbody.appendChild(mr);
      }
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      tr.innerHTML =
        '<td class="ii-pos">' + esc(t.number || t.trackPos) + '</td>' +
        '<td><div class="ii-track-title">' +
          (t.recId ? '<a href="' + MB_ROOT + '/recording/' + t.recId + '" target="_blank" rel="noopener" title="' + esc(t.title) + '">' + esc(t.title) + '</a>' : esc(t.title)) +
          '</div><div class="ii-track-artist">' + esc(t.artist) + '</div></td>' +
        '<td class="ii-track-dur">' + esc(t.dur) + '</td>' +
        '<td class="ii-existing">' + existingHtml(t.existing, t.pendingRemoval) + '</td>' +
        '<td><div class="ii-inwrap">' +
          '<div class="ii-input-box">' +
            '<input class="ii-input" type="text" maxlength="15" placeholder="—" value="' + esc(t.pending) + '">' +
            '<button class="ii-clear" type="button" tabindex="-1" title="Clear this field">×</button>' +
          '</div>' +
          // first track has no previous ISRC to increment — hide +1 but keep its slot so SX text stays aligned
          '<button class="ii-plus' + (idx === 0 ? ' ii-plus-hidden' : '') + '" title="Previous ISRC + 1  (right-click: fill down through empty tracks)">+1</button>' +
          '<span class="ii-lookup"></span>' +
          '</div><div class="ii-cands"></div></td>';
      const input = tr.querySelector('.ii-input');
      tr.querySelector('.ii-clear').addEventListener('click', () => clearRow(idx));
      input.addEventListener('input', () => {
        t.pending = normalizeIsrc(input.value);
        t.source = 'manual';
        if (input.value !== t.pending) {
          const p = input.selectionStart;
          input.value = t.pending; input.setSelectionRange(p, p);
        }
        input.dataset.autofill = '';
        validateInput(input, t);
        updateSummary();
        // verify on SoundExchange as soon as a full ISRC is entered (cached)
        const v = normalizeIsrc(input.value);
        if (v && isValidIsrc(v)) lookupIsrc(idx, v);
        else { const lk = rowLookup(idx); if (lk) { lk.className = 'ii-lookup'; lk.textContent = ''; } }
      });
      const plusBtn = tr.querySelector('.ii-plus');
      if (plusBtn && idx > 0) {   // first row's +1 is a hidden spacer — don't wire it
        plusBtn.addEventListener('click', () => plusOne(idx));
        plusBtn.addEventListener('contextmenu', e => { e.preventDefault(); plusOneFillDown(idx); });
      }
      tbody.appendChild(tr);
      validateInput(input, t);
      // initial per-track entry point to the SoundExchange refine panel
      const rf = document.createElement('div');
      rf.className = 'ii-cand-refine';
      rf.textContent = '⚙ search SoundExchange…';
      rf.addEventListener('click', () => openSxPanel(idx));
      tr.querySelector('.ii-cands').appendChild(rf);
    });
    updateSummary();
  }
  function existingHtml(arr, pending) {
    if (!arr || !arr.length) return '<span class="none">none</span>';
    const pend = new Set((pending || []).map(normalizeIsrc));
    return arr.map(i => {
      if (pend.has(normalizeIsrc(i)))
        return '<span class="ii-ex-item ii-ex-pending" title="Remove-ISRC edit submitted — pending in the edit queue">⏳ <samp>' + esc(i) + '</samp></span>';
      return '<label class="ii-ex-item" title="Check to delete this ISRC from the recording">' +
        '<input type="checkbox" class="ii-ex-del" data-isrc="' + esc(i) + '">' +
        '<samp>' + esc(i) + '</samp></label>';
    }).join('');
  }
  function rowInput(idx) {
    const tr = tbody.querySelector('tr[data-idx="' + idx + '"]');
    return tr ? tr.querySelector('.ii-input') : null;
  }
  function rowCands(idx) {
    const tr = tbody.querySelector('tr[data-idx="' + idx + '"]');
    return tr ? tr.querySelector('.ii-cands') : null;
  }
  function rowLookup(idx) {
    const tr = tbody.querySelector('tr[data-idx="' + idx + '"]');
    return tr ? tr.querySelector('.ii-lookup') : null;
  }

  // verify a typed ISRC on SoundExchange and show inline match/mismatch info
  function sxLookupCached(isrc) {
    if (_isrcLookupCache[isrc]) return Promise.resolve(_isrcLookupCache[isrc]);
    return SX.apiSearchByIsrc(isrc).then(rows => { _isrcLookupCache[isrc] = rows; return rows; });
  }
  function lookupIsrc(idx, isrc) {
    const el = rowLookup(idx), t = RELEASE.tracks[idx];
    if (!el) return Promise.resolve();
    el.onclick = null;                       // drop any "click to verify" handler
    const cached = !!_isrcLookupCache[isrc];
    el.className = 'ii-lookup spin';
    el.textContent = cached ? '' : '⏳ checking SoundExchange…';
    if (!cached) Log.info('SX lookup ' + isrc + ' (#' + (t.number || t.trackPos) + ')');
    return sxLookupCached(isrc).then(rows => {
      if (!rows.length) { el.className = 'ii-lookup err'; el.textContent = '✗ not found on SoundExchange'; Log.warn('SX lookup ' + isrc + ': not found'); return; }
      const f = SX.fields(rows[0]);
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.year);
      const good = cls === 'best';
      const rel = [f.relTitle, f.relLabel, f.relDate].filter(Boolean).join(' · ');
      el.className = 'ii-lookup ' + (good ? 'ok' : 'warn');
      el.innerHTML = (good ? '✓ ' : '⚠ ') + sxMetaHtml(f, t) +
        (rel ? '<br><span class="ii-lookup-rel">' + esc(rel) + '</span>' : '');
      el.title = [f.title, f.artist, f.year, f.dur].filter(Boolean).join(' · ') + (rel ? '  |  ' + rel : '');
      Log.info('SX lookup ' + isrc + ': ' + (good ? 'match' : cls === 'warn' ? 'length mismatch' : 'MISMATCH') + ' "' + f.title + '" — ' + f.artist);
    }).catch(e => { el.className = 'ii-lookup err'; el.textContent = '✗ lookup failed'; Log.err('SX lookup ' + isrc + ' failed: ' + e.message); });
  }

  // SoundExchange verification queue — bulk fills (Deezer / Spotify / paste) route
  // their per-ISRC verification through here so it's SERIALIZED (no concurrent SX
  // hits) and CAPPED at SX_BATCH_LIMIT. Past the cap, the rest show a clickable
  // "click to verify" bullet; clicking resumes the next batch. (Manual typing
  // stays immediate — it never goes through the queue.)
  const _vq = { items: [], running: false, done: 0 };
  // During a streaming import (Deezer/Spotify) we DEFER per-fill verification so
  // SoundExchange's requests don't compete with the import's on the GM queue —
  // SX must not slow or influence the import. Filled rows are collected here and
  // verified once the import has finished.
  let _deferVerify = false;
  let _deferredVerify = new Set();
  function enqueueVerify(idx, isrc) {
    if (!_vq.items.length && !_vq.running) _vq.done = 0;   // a fresh burst → reset the allowance
    _vq.items = _vq.items.filter(it => it.idx !== idx);    // one pending verify per row
    _vq.items.push({ idx, isrc });
    pumpVerify();
  }
  function showVerifyPauses() {
    const remaining = _vq.items.length;
    _vq.items.forEach(it => {
      const el = rowLookup(it.idx); if (!el) return;
      el.className = 'ii-lookup pending';
      el.textContent = '⏳ Not verified — click to check the next ' + Math.min(SX_BATCH_LIMIT, remaining) + ' on SoundExchange';
      el.onclick = () => { _vq.done = 0; pumpVerify(); };
    });
  }
  async function pumpVerify() {
    if (_vq.running) return;
    _vq.running = true;
    try {
      while (_vq.items.length) {
        if (_vq.done >= SX_BATCH_LIMIT) { showVerifyPauses(); return; }
        const { idx, isrc } = _vq.items.shift();
        const t = RELEASE.tracks[idx];
        // skip if the field no longer holds this value (user changed it meanwhile)
        if (!t || !isValidIsrc(isrc) || normalizeIsrc(t.pending) !== normalizeIsrc(isrc)) continue;
        try { await lookupIsrc(idx, isrc); } catch (e) {}
        _vq.done++;
        if (_vq.items.length && _vq.done < SX_BATCH_LIMIT) await sleep(BATCH_DELAY);
      }
    } finally {
      // always release the lock — a throw in here previously stalled the whole queue
      _vq.running = false;
    }
  }

  function validateInput(input, t) {
    const v = normalizeIsrc(input.value);
    input.classList.remove('bad', 'dup', 'ok');
    if (!v) return;
    if (!isValidIsrc(v)) { input.classList.add('bad'); return; }
    if (t.existing.includes(v)) { input.classList.add('dup'); input.title = 'Already on this recording'; return; }
    input.title = '';
    input.classList.add('ok');
  }

  function setPending(idx, isrc, flash, source) {
    const t = RELEASE.tracks[idx];
    const input = rowInput(idx);
    if (!t || !input) return;
    t.pending = normalizeIsrc(isrc);
    t.source = source || 'manual';
    input.value = t.pending;
    input.dataset.autofill = '1';            // filled by a source — the on-input handler won't fire
    validateInput(input, t);
    // verify whatever was just set (Deezer, Spotify, +1, bulk paste) against
    // SoundExchange so every filled value gets the same match check (cached).
    // Skip it for SoundExchange-sourced fills — the batch search already classified
    // the candidate, so re-querying would just double our SX load. The check is
    // routed through enqueueVerify so bulk imports stay serialized + capped at 30.
    if (t.source !== 'SoundExchange' && isValidIsrc(t.pending)) {
      if (_deferVerify) { _deferredVerify.add(idx); const lk = rowLookup(idx); if (lk) { lk.className = 'ii-lookup'; lk.textContent = ''; lk.onclick = null; } }
      else enqueueVerify(idx, t.pending);
    } else { const lk = rowLookup(idx); if (lk) { lk.className = 'ii-lookup'; lk.textContent = ''; lk.onclick = null; } }
    if (flash) {
      const tr = input.closest('tr');
      tr.classList.remove('ii-row-fill'); void tr.offsetWidth; tr.classList.add('ii-row-fill');
    }
  }

  function clearPending() {
    _vq.items = []; _vq.done = 0;            // drop any queued SX verifications
    RELEASE.tracks.forEach((t, i) => { t.pending = ''; t.source = ''; const inp = rowInput(i); if (inp) { inp.value = ''; validateInput(inp, t); } });
    tbody.querySelectorAll('.ii-cands').forEach(c => c.innerHTML = '');
    tbody.querySelectorAll('.ii-lookup').forEach(l => { l.className = 'ii-lookup'; l.textContent = ''; l.title = ''; l.onclick = null; });
    updateSummary();
    toast('Cleared entered ISRCs');
  }

  // Clear a single track's New-ISRC field (the row's "×" button).
  function clearRow(idx) {
    const t = RELEASE.tracks[idx], input = rowInput(idx);
    if (!t || !input) return;
    _vq.items = _vq.items.filter(it => it.idx !== idx);   // drop any queued verify for this row
    t.pending = ''; t.source = '';
    input.value = ''; input.dataset.autofill = '';
    validateInput(input, t);
    const lk = rowLookup(idx); if (lk) { lk.className = 'ii-lookup'; lk.textContent = ''; lk.title = ''; lk.onclick = null; }
    // re-expand the candidate list so a different suggestion can be picked
    const box = rowCands(idx);
    if (box) { box.classList.remove('collapsed'); box.querySelectorAll('.ii-cand.chosen').forEach(c => c.classList.remove('chosen')); }
    updateSummary();
    input.focus();
  }

  function plusOne(idx) {
    // find nearest previous value (pending or first existing)
    for (let i = idx - 1; i >= 0; i--) {
      const prev = RELEASE.tracks[i];
      const base = prev.pending || (prev.existing[0] || '');
      if (!base) continue;
      const inc = base.replace(/(\d+)(?!.*\d)/, m => String(parseInt(m, 10) + 1).padStart(m.length, '0'));
      setPending(idx, inc, true);
      updateSummary();
      return;
    }
    toast('No previous ISRC to increment');
  }

  // Right-click +1: fill an incrementing ISRC from here down through every empty
  // track, stopping at the next field that already has a value (or the end).
  function plusOneFillDown(idx) {
    let base = '';
    for (let i = idx - 1; i >= 0; i--) {
      base = RELEASE.tracks[i].pending || RELEASE.tracks[i].existing[0] || '';
      if (base) break;
    }
    if (!base) { toast('No previous ISRC to increment'); return; }
    let count = 0;
    for (let i = idx; i < RELEASE.tracks.length; i++) {
      const t = RELEASE.tracks[i];
      // always fill the starting cell; below it, stop at the first occupied field
      if (i > idx && (t.pending || t.existing.length)) break;
      base = base.replace(/(\d+)(?!.*\d)/, m => String(parseInt(m, 10) + 1).padStart(m.length, '0'));
      setPending(i, base, true);
      count++;
    }
    updateSummary();
    toast('Filled ' + count + ' track' + (count === 1 ? '' : 's') + ' with a +1 sequence');
  }

  function updateSummary() {
    const dupSet = highlightDuplicates();   // ISRCs on >1 recording — not submittable
    let valid = 0, bad = 0, dup = 0, crossDup = 0, missing = 0;
    RELEASE.tracks.forEach(t => {
      if (!t.existing.length && !t.pending) missing++;
      if (!t.pending) return;
      const v = normalizeIsrc(t.pending);
      if (!isValidIsrc(v)) { bad++; return; }
      if (t.existing.includes(v)) { dup++; return; }        // already on this recording
      if (dupSet.has(v)) { crossDup++; return; }            // same ISRC on another recording → blocked
      valid++;
    });
    const seq = iterativeSequence();
    summaryEl.innerHTML =
      '<b>' + RELEASE.tracks.length + '</b> tracks' +
      (bad ? ' · <span style="color:#dc3545">' + bad + ' invalid</span>' : '') +
      (dup ? ' · <span style="color:#fd7e14">' + dup + ' already present</span>' : '') +
      (crossDup ? ' · <span style="color:#d63384">' + crossDup + ' duplicated across tracks (blocked)</span>' : '') +
      (missing ? ' · ' + missing + ' still missing' : '') +
      (seq ? ' <span class="ii-seq-badge" title="Every track\'s ISRC is the previous one + 1: ' +
        esc(seq.from) + ' → ' + esc(seq.to) + '">⛓ sequential ' + esc(seq.from) + ' → ' + esc(seq.to) + '</span>' : '');
    submitBtn.textContent = 'Submit to MusicBrainz' + (valid ? ' (' + valid + ')' : '');
    submitBtn.disabled = valid === 0;
  }

  // If every track has a valid ISRC and they form one perfect +1 run (same first
  // 7 chars, last-5 designation incrementing by 1), return {from,to,count}; else null.
  function iterativeSequence() {
    const isrcs = RELEASE.tracks.map(t => normalizeIsrc(t.pending || t.existing[0] || ''));
    if (isrcs.length < 2 || isrcs.some(s => !isValidIsrc(s))) return null;
    for (let i = 1; i < isrcs.length; i++) {
      if (isrcs[i].slice(0, 7) !== isrcs[i - 1].slice(0, 7)) return null;
      if (parseInt(isrcs[i].slice(7), 10) !== parseInt(isrcs[i - 1].slice(7), 10) + 1) return null;
    }
    return { from: isrcs[0], to: isrcs[isrcs.length - 1], count: isrcs.length };
  }

  // Flag ISRCs that appear on more than one distinct recording (pending or existing) and
  // return the Set of those (normalized) ISRCs. Same-recording repeats don't count.
  function highlightDuplicates() {
    const recsByIsrc = {};
    RELEASE.tracks.forEach((t, i) => {
      const key = t.recId || ('i' + i);
      const add = raw => { const v = normalizeIsrc(raw); if (!v) return; (recsByIsrc[v] = recsByIsrc[v] || new Set()).add(key); };
      const pv = normalizeIsrc(t.pending); if (pv && isValidIsrc(pv)) add(pv);
      t.existing.forEach(add);
    });
    const dupSet = new Set(Object.keys(recsByIsrc).filter(v => recsByIsrc[v].size > 1));
    RELEASE.tracks.forEach((t, i) => {
      const tr = tbody.querySelector('tr[data-idx="' + i + '"]'); if (!tr) return;
      const inp = tr.querySelector('.ii-input');
      const pv = normalizeIsrc(t.pending);
      inp.classList.toggle('dupother', !!(pv && isValidIsrc(pv) && !t.existing.includes(pv) && dupSet.has(pv)));
      tr.querySelectorAll('.ii-existing samp').forEach(s => s.classList.toggle('dup', dupSet.has(normalizeIsrc(s.textContent))));
    });
    return dupSet;
  }

  /* ── bulk paste / export ── */
  function findTrackByNumber(token) {
    // token like "3" or "1.3" (medium.track) or "1-3"
    const mt = token.match(/^(\d+)[.\-:](\d+)$/);
    if (mt) {
      const med = +mt[1], pos = +mt[2];
      return RELEASE.tracks.findIndex(t => t.mediumPos === med && (+t.trackPos === pos));
    }
    const n = token.trim();
    return RELEASE.tracks.findIndex(t => String(t.number) === n || String(t.trackPos) === n);
  }
  function applyBulk(overwrite) {
    const text = modal.querySelector('#ii-bulk-text').value;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) { applyJson(text, overwrite); return; }
    const lines = text.replace(/\r/g, '').split('\n');
    let seq = 0, applied = 0;
    const tryApply = (idx, isrc) => {
      if (idx < 0 || idx >= RELEASE.tracks.length) return;
      const v = normalizeIsrc(isrc);
      if (!isValidIsrc(v)) return;
      if (!overwrite && RELEASE.tracks[idx].pending) return;
      setPending(idx, v, true, 'bulk'); applied++;
    };
    lines.forEach(line => {
      const raw = line.trim();
      // targeted forms (do NOT consume a sequential slot): "3=ISRC" | "ISRC | 1.3" | "1.3 ISRC"
      let m, target = -1, isrc = null;
      if ((m = raw.match(/^(.+?)\s*=\s*([A-Za-z0-9-]+)$/)))         { target = findTrackByNumber(m[1]); isrc = m[2]; }
      else if ((m = raw.match(/^([A-Za-z0-9-]+)\s*[|,]\s*(.+)$/)))   { isrc = m[1]; target = findTrackByNumber(m[2]); }
      else if ((m = raw.match(/^([\d.\-:]+)\s+([A-Za-z0-9-]+)$/)))   { target = findTrackByNumber(m[1]); isrc = m[2]; }
      if (isrc !== null) { tryApply(target, isrc); return; }
      // sequential: a plain ISRC fills the next track; a blank line skips one
      if (raw) tryApply(seq, raw);
      seq++;
    });
    updateSummary();
    toast('Applied ' + applied + ' ISRC' + (applied === 1 ? '' : 's'));
  }
  function applyJson(text, overwrite) {
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('Invalid JSON', 'err'); return; }
    let applied = 0;
    const apply = (idx, isrc) => {
      if (idx < 0 || idx >= RELEASE.tracks.length) return;
      const v = normalizeIsrc(isrc);
      if (!isValidIsrc(v)) return;
      if (!overwrite && RELEASE.tracks[idx].pending) return;
      setPending(idx, v, true, 'bulk'); applied++;
    };
    if (Array.isArray(data)) {
      data.forEach((entry, i) => {
        if (typeof entry === 'string') apply(i, entry);
        else if (entry && entry.isrc) {
          const idx = entry.recording
            ? RELEASE.tracks.findIndex(t => t.recId === entry.recording)
            : (entry.track != null ? findTrackByNumber(String(entry.track)) : i);
          apply(idx, entry.isrc);
        }
      });
    } else if (data && typeof data === 'object') {
      // { recordingMbid: "ISRC" | ["ISRC", ...] }
      Object.entries(data).forEach(([rid, val]) => {
        const idx = RELEASE.tracks.findIndex(t => t.recId === rid);
        const isrc = Array.isArray(val) ? val[0] : val;
        apply(idx, isrc);
      });
    }
    updateSummary();
    toast('Applied ' + applied + ' ISRC' + (applied === 1 ? '' : 's'));
  }
  function exportText() {
    const out = RELEASE.tracks.map(t => t.pending || t.existing[0] || '').join('\n');
    copyToClipboard(out, out.split('\n').length + ' lines copied');
  }
  function exportJson() {
    const obj = {};
    RELEASE.tracks.forEach(t => {
      const v = t.pending || t.existing[0];
      if (v && t.recId) obj[t.recId] = v;
    });
    copyToClipboard(JSON.stringify(obj, null, 2), 'JSON copied');
  }
  function copyToClipboard(text, msg) {
    const ta = modal.querySelector('#ii-bulk-text');
    ta.value = text;
    modal.querySelector('#ii-bulk-pane').classList.add('open');
    ta.focus(); ta.select();
    try { navigator.clipboard.writeText(text); } catch (e) {}
    toast(msg);
  }

  /* ── candidate suggestions (SoundExchange) ── */
  // Collapse a track's candidate list down to just the one matching `isrc`
  // (marked .chosen); the rest are hidden until the next search re-renders them.
  function collapseCandsTo(idx, isrc) {
    const box = rowCands(idx); if (!box) return;
    const norm = normalizeIsrc(isrc);
    let found = false;
    box.querySelectorAll('.ii-cand').forEach(el => {
      const on = el.dataset.isrc === norm;
      el.classList.toggle('chosen', on);
      if (on) found = true;
    });
    box.classList.toggle('collapsed', found);
  }
  function renderCands(idx, rows) {
    const box = rowCands(idx);
    const t = RELEASE.tracks[idx];
    if (!box) return;
    box.innerHTML = '';
    (rows || []).slice(0, 5).forEach(item => {
      const f = SX.fields(item);
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.year);
      const inMb = t.existing.includes(normalizeIsrc(f.isrc));
      const relInfo = [f.relTitle, f.relLabel, f.relDate].filter(Boolean).join(' · ');
      const c = document.createElement('div');
      c.className = 'ii-cand' + (cls === 'best' ? ' best' : cls === 'warn' ? ' warn' : ' bad') + (inMb ? ' inmb' : '');
      c.dataset.isrc = normalizeIsrc(f.isrc);
      c.title = relInfo ? 'Appears on: ' + relInfo : '';
      c.innerHTML =
        '<span class="ii-cand-isrc">' + esc(f.isrc) + '</span>' +
        '<span class="ii-cand-meta">' + sxMetaHtml(f, t) +
          (relInfo ? '  ·  ' + esc(relInfo) : '') + '</span>' +
        (inMb ? '<span class="ii-cand-inmb">✓ IN MB</span>' : '<span class="ii-cand-src">SX</span>');
      c.addEventListener('click', () => {
        setPending(idx, f.isrc, true, 'SoundExchange'); updateSummary();
        collapseCandsTo(idx, f.isrc);   // full list stays one "refine search" click away
      });
      box.appendChild(c);
    });
    box.classList.remove('collapsed');
    // "refine search" entry — opens the panel to tweak title/artist/release + exact
    const refine = document.createElement('div');
    refine.className = 'ii-cand-refine';
    refine.textContent = (rows && rows.length)
      ? '⚙ refine search / more…'
      : '⚙ no match — refine search…';
    refine.addEventListener('click', () => openSxPanel(idx));
    box.appendChild(refine);
  }

  /* ── SoundExchange refine panel ── */
  let sxPanel = null, _sxPanelIdx = -1, _sxPanelGen = 0;
  // Build a URL to the SoundExchange website's own search for the same query,
  // so the user can fall back to searching there directly (quoted = exact field).
  function sxPageUrl(title, artist, release) {
    const enc = s => encodeURIComponent('"' + String(s).replace(/"/g, '') + '"');
    const parts = ['tab=' + encodeURIComponent('"simple"')];
    if (artist)  parts.push('artistName=' + enc(artist));
    if (title)   parts.push('title=' + enc(title));
    if (release) parts.push('releaseName=' + enc(release));
    return SX_HOME + '?' + parts.join('&');
  }
  function buildSxPanel() {
    if (sxPanel) return;
    sxPanel = document.createElement('div');
    sxPanel.id = 'ii-sxpanel';
    sxPanel.innerHTML = `
      <div class="ii-sxp-hdr">
        <span class="t">🔍 <b>SoundExchange</b> — <span id="ii-sxp-track"></span></span>
        <button id="ii-sxp-close" title="Close">✕</button>
      </div>
      <div class="ii-sxp-form">
        <div class="ii-sxp-field" id="ii-sxp-f-title">
          <input type="checkbox" class="ii-sxp-en" id="ii-sxp-en-title" title="Use the title in the search">
          <input type="text" class="ii-sxp-inp" id="ii-sxp-title" placeholder="Title" autocomplete="off">
          <button type="button" class="ii-sxp-E" id="ii-sxp-ex-title" title="Exact title (match the whole field)">E</button>
        </div>
        <div class="ii-sxp-field" id="ii-sxp-f-artist">
          <input type="checkbox" class="ii-sxp-en" id="ii-sxp-en-artist" title="Use the artist in the search">
          <input type="text" class="ii-sxp-inp" id="ii-sxp-artist" placeholder="Artist" autocomplete="off">
          <button type="button" class="ii-sxp-E" id="ii-sxp-ex-artist" title="Exact artist (match the whole field)">E</button>
        </div>
        <div class="ii-sxp-field" id="ii-sxp-f-release">
          <input type="checkbox" class="ii-sxp-en" id="ii-sxp-en-release" title="Use the release in the search">
          <input type="text" class="ii-sxp-inp" id="ii-sxp-release" placeholder="Release" autocomplete="off">
          <button type="button" class="ii-sxp-E" id="ii-sxp-ex-release" title="Exact release (match the whole field)">E</button>
        </div>
        <button id="ii-sxp-search">Search</button>
      </div>
      <div class="ii-sxp-status"></div>
      <div class="ii-sxp-results"></div>
      <div class="ii-sxp-foot"><a id="ii-sxp-web" target="_blank" rel="noopener">🔍 Search on SoundExchange ↗</a></div>
    `;
    document.body.appendChild(sxPanel);
    const closePanel = () => sxPanel.classList.remove('open');
    sxPanel.querySelector('#ii-sxp-close').addEventListener('click', closePanel);
    // Esc / click-outside close — this is a transient search panel (unlike the
    // main editor, which deliberately ignores both to avoid losing entered work).
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sxPanel.classList.contains('open')) { e.stopPropagation(); closePanel(); }
    }, true);
    document.addEventListener('mousedown', e => {
      if (!sxPanel.classList.contains('open')) return;
      // ignore clicks inside the panel, and on a "refine search" entry (which re-opens it)
      if (sxPanel.contains(e.target) || (e.target.closest && e.target.closest('.ii-cand-refine'))) return;
      closePanel();
    });
    sxPanel.querySelector('#ii-sxp-search').addEventListener('click', sxPanelSearch);
    ['#ii-sxp-title', '#ii-sxp-artist', '#ii-sxp-release'].forEach(id =>
      sxPanel.querySelector(id).addEventListener('keydown', e => { if (e.key === 'Enter') sxPanelSearch(); }));
    // per-term "use this" checkbox (greys the field when off; release is remembered)
    // and "E" exact toggle (persisted in sxExact, kept across tracks)
    ['title', 'artist', 'release'].forEach(key => {
      const en = sxPanel.querySelector('#ii-sxp-en-' + key);
      en.addEventListener('change', () => {
        sxPanel.querySelector('#ii-sxp-f-' + key).classList.toggle('off', !en.checked);
        if (key === 'release') { sxRelEnabled = en.checked; store.set('sx_rel_enabled', sxRelEnabled); }
      });
      const ex = sxPanel.querySelector('#ii-sxp-ex-' + key);
      ex.addEventListener('click', () => {
        sxExact[key] = !sxExact[key]; saveSxExact();
        ex.classList.toggle('on', sxExact[key]);
        Log.info('SX exact ' + key + ' = ' + sxExact[key]);
      });
    });
    // drag by header
    const hdr = sxPanel.querySelector('.ii-sxp-hdr');
    let dx = 0, dy = 0, drag = false;
    hdr.addEventListener('mousedown', e => {
      if (e.target.id === 'ii-sxp-close') return;
      drag = true;
      const r = sxPanel.getBoundingClientRect();
      sxPanel.style.left = r.left + 'px'; sxPanel.style.top = r.top + 'px'; sxPanel.style.right = 'auto';
      dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault();
    });
    document.addEventListener('mousemove', e => { if (drag) { sxPanel.style.left = (e.clientX - dx) + 'px'; sxPanel.style.top = (e.clientY - dy) + 'px'; } });
    document.addEventListener('mouseup', () => { drag = false; });
  }
  function openSxPanel(idx) {
    buildSxPanel();
    const t = RELEASE.tracks[idx];
    _sxPanelIdx = idx;
    sxPanel.querySelector('#ii-sxp-track').textContent = t.title + (t.artist ? ' — ' + t.artist : '');
    sxPanel.querySelector('#ii-sxp-title').value = t.title;
    sxPanel.querySelector('#ii-sxp-artist').value = t.artist;
    sxPanel.querySelector('#ii-sxp-release').value = RELEASE.title || '';   // prefilled from MusicBrainz
    const setEnabled = (key, on) => {
      sxPanel.querySelector('#ii-sxp-en-' + key).checked = on;
      sxPanel.querySelector('#ii-sxp-f-' + key).classList.toggle('off', !on);
    };
    const setExact = (key, on) => sxPanel.querySelector('#ii-sxp-ex-' + key).classList.toggle('on', on);
    // title/artist default ON (reset per track); release uses the remembered toggle
    setEnabled('title', true);
    setEnabled('artist', true);
    setEnabled('release', sxRelEnabled);
    // E (exact) reflects the persisted, kept-across-tracks state
    setExact('title', sxExact.title);
    setExact('artist', sxExact.artist);
    setExact('release', sxExact.release);
    sxPanel.classList.add('open');
    sxPanelSearch();
  }
  function sxPanelSearch() {
    const idx = _sxPanelIdx;
    const t = RELEASE.tracks[idx];
    // only enabled terms are used; a disabled term is sent empty (= ignored by SX)
    const use = key => sxPanel.querySelector('#ii-sxp-en-' + key).checked;
    const val = key => sxPanel.querySelector('#ii-sxp-' + key).value.trim();
    const title   = use('title')   ? val('title')   : '';
    const artist  = use('artist')  ? val('artist')  : '';
    const release = use('release') ? val('release') : '';
    const exact = { title: sxExact.title, artist: sxExact.artist, release: sxExact.release };
    const stEl = sxPanel.querySelector('.ii-sxp-status');
    const resEl = sxPanel.querySelector('.ii-sxp-results');
    const goBtn = sxPanel.querySelector('#ii-sxp-search');
    const webLink = sxPanel.querySelector('#ii-sxp-web');
    if (webLink) webLink.href = sxPageUrl(title, artist, release);
    stEl.className = 'ii-sxp-status'; stEl.textContent = 'Searching…'; goBtn.disabled = true;
    const gen = ++_sxPanelGen;
    Log.info('SX refine #' + (t.number || t.trackPos) + ': "' + title + '" / "' + artist + '"' + (release ? ' / rel "' + release + '"' : ''), exact);
    SX.apiSearch(title, artist, 0, 25, exact, release).then(rows => {
      if (gen !== _sxPanelGen) return;
      goBtn.disabled = false;
      stEl.textContent = rows.length ? rows.length + ' result' + (rows.length === 1 ? '' : 's') : 'No results';
      renderSxPanelResults(idx, rows);
    }).catch(e => {
      if (gen !== _sxPanelGen) return;
      goBtn.disabled = false; stEl.className = 'ii-sxp-status err'; stEl.textContent = '⚠ ' + e.message; resEl.innerHTML = '';
    });
  }
  function renderSxPanelResults(idx, rows) {
    const t = RELEASE.tracks[idx];
    const resEl = sxPanel.querySelector('.ii-sxp-results');
    resEl.innerHTML = '';
    rows.forEach(item => {
      const f = SX.fields(item);
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.year);
      const inMb = t.existing.includes(normalizeIsrc(f.isrc));
      const cur = normalizeIsrc(t.pending) === normalizeIsrc(f.isrc);
      const rel = [f.relTitle, f.relLabel, f.relDate].filter(Boolean).join(' · ');
      const row = document.createElement('div');
      row.className = 'ii-sxp-row' + (cur ? ' cur' : cls === 'best' ? ' best' : cls === 'warn' ? ' warn' : ' bad');
      row.innerHTML =
        '<span class="ii-sxp-isrc">' + esc(f.isrc) + '</span>' +
        '<span class="ii-sxp-meta"><span class="a">' + sxMetaHtml(f, t) + '</span>' +
          (rel ? '<span class="b">' + esc(rel) + '</span>' : '') + '</span>' +
        (inMb ? '<span class="ii-sxp-inmb">✓ IN MB</span>' : '');
      row.addEventListener('click', () => {
        setPending(idx, f.isrc, true, 'SoundExchange'); updateSummary();
        renderSxPanelResults(idx, rows);   // refresh "cur" highlight
      });
      resEl.appendChild(row);
    });
  }

  // SoundExchange batch state — we search at most SX_BATCH_LIMIT tracks at a time
  // so SX doesn't block us; the rest show a "not loaded" message you click to continue.
  let _sxTodo = [], _sxCursor = 0, _sxMatched = 0, _sxFilled = 0, _sxRunning = false;

  function runSxAll() {
    const tracks = RELEASE.tracks;
    _sxTodo = tracks.map((t, i) => i).filter(i => !tracks[i].existing.length && !tracks[i].pending);
    _sxCursor = 0; _sxMatched = 0; _sxFilled = 0;
    Log.info('SoundExchange: ' + _sxTodo.length + ' track(s) without an ISRC (skipping ' +
      (tracks.length - _sxTodo.length) + ' that already have one); up to ' + SX_BATCH_LIMIT + ' per batch');
    SX.refreshToken().then(() => Log.info('SX token ready')).catch(e => Log.warn('SX token prefetch failed: ' + e.message));
    processNextSxBatch();
  }

  // Render a clickable "not loaded" message in a track's candidate box. Clicking
  // any of them loads the next batch (in order — like the MagicISRC userscript).
  function sxPlaceholder(idx, remaining) {
    const box = rowCands(idx);
    if (!box) return;
    box.innerHTML = '';
    const m = document.createElement('div');
    m.className = 'ii-cand-pending';
    m.textContent = '⏳ Not searched — click to load the next ' + Math.min(SX_BATCH_LIMIT, remaining) + ' on SoundExchange';
    m.title = 'SoundExchange searches are capped at ' + SX_BATCH_LIMIT + ' at a time to avoid being blocked';
    m.addEventListener('click', () => processNextSxBatch());
    box.appendChild(m);
  }

  async function processNextSxBatch() {
    if (_sxRunning) return;
    _sxRunning = true;
    const btn = modal.querySelector('#ii-sx-all');
    btn.disabled = true;
    const tracks = RELEASE.tracks;
    const batch = _sxTodo.slice(_sxCursor, _sxCursor + SX_BATCH_LIMIT);
    // clear any "not loaded" placeholders on the tracks we're about to search
    batch.forEach(i => { const box = rowCands(i); if (box) box.innerHTML = ''; });
    let n = 0;
    for (const i of batch) {
      const t = tracks[i];
      progEl.textContent = 'SoundExchange ' + (_sxCursor + n + 1) + '/' + _sxTodo.length;
      try {
        const rows = await SX.apiSearch(t.title, t.artist, 0, 10, sxExact);
        renderCands(i, rows);
        const best = rows.find(r => SX.classify(SX.fields(r), t.title, t.artist, t.dur, RELEASE.year) === 'best');
        const bestIsrc = best && SX.fields(best).isrc;
        if (bestIsrc) {
          _sxMatched++;
          // autofill the input only when it's empty AND the match is a NEW isrc
          if (!t.pending && !t.existing.includes(bestIsrc)) { setPending(i, bestIsrc, true, 'SoundExchange'); collapseCandsTo(i, bestIsrc); _sxFilled++; }
        }
        Log.info('SX #' + (t.number || t.trackPos) + ' "' + t.title + '": ' + rows.length + ' result(s)' +
          (bestIsrc ? ', best ' + bestIsrc + (t.existing.includes(bestIsrc) ? ' (already in MB)' : '') : ', no confident match'));
      } catch (e) {
        renderCands(i, []);
        Log.err('SX #' + (t.number || t.trackPos) + ' "' + t.title + '" failed: ' + e.message);
      }
      n++;
      updateSummary();
      if (n < batch.length) await sleep(BATCH_DELAY);
    }
    _sxCursor += batch.length;
    const remaining = _sxTodo.length - _sxCursor;
    if (remaining > 0) {
      _sxTodo.slice(_sxCursor).forEach(i => sxPlaceholder(i, remaining));
      progEl.textContent = 'SoundExchange ' + _sxCursor + '/' + _sxTodo.length + ' — ' +
        remaining + ' not loaded (click a row to search the next ' + Math.min(SX_BATCH_LIMIT, remaining) + ')';
      Log.info('SoundExchange: paused at ' + _sxCursor + '/' + _sxTodo.length + ' — ' + remaining + ' awaiting a click to continue');
    } else {
      progEl.textContent = 'SoundExchange done — ' + _sxMatched + ' matched, ' + _sxFilled + ' filled';
      Log.info('SoundExchange done — ' + _sxMatched + ' matched, ' + _sxFilled + ' newly filled');
    }
    btn.disabled = false;
    _sxRunning = false;
  }

  /* ── streaming-source import (Deezer / Spotify) ── */
  // Map ONE fetched ISRC to a track and fill it immediately (live, as it arrives).
  // Returns 'filled' | 'already' | 'skipped' | 'unmatched'.
  function mapOneToTrack(s, label) {
    let idx = RELEASE.tracks.findIndex(t =>
      (+t.trackPos === +s.pos) && ((+t.mediumPos === +s.disc) || RELEASE.tracks.filter(x => +x.mediumPos === +s.disc).length === 0));
    if (idx < 0) idx = RELEASE.tracks.findIndex(t => t.title && isGoodMatch(s.title, s.artist, t.title, t.artist));
    if (idx < 0) { Log.warn(label + ': no track matched ' + s.isrc + ' "' + s.title + '" (disc ' + s.disc + ' pos ' + s.pos + ')'); return 'unmatched'; }
    const t = RELEASE.tracks[idx];
    if (t.existing.includes(s.isrc)) return 'already';
    if (t.pending) return 'skipped';
    setPending(idx, s.isrc, true, label);   // fills the input box right now
    updateSummary();
    return 'filled';
  }

  const errText = e => (e && (e.message || e.stack)) || String(e) || '(no detail)';
  const setProg = (msg, isErr) => {
    if (!progEl) return;
    progEl.textContent = msg; progEl.classList.toggle('err', !!isErr);
    progEl.classList.remove('continue'); progEl.onclick = null; progEl.style.cursor = '';
  };
  const setProgContinue = (msg, onClick) => {
    if (!progEl) return;
    progEl.textContent = msg; progEl.classList.remove('err'); progEl.classList.add('continue');
    progEl.style.cursor = 'pointer';
    progEl.onclick = () => { onClick(); };
  };
  // flush the SX verifications deferred during a batch (decoupled from the import)
  function flushDeferredVerify() {
    const toVerify = [..._deferredVerify]; _deferredVerify = new Set();
    toVerify.forEach(i => { const t = RELEASE.tracks[i]; if (t && isValidIsrc(t.pending)) enqueueVerify(i, t.pending); });
  }

  let _stream = null;   // current import: { label, albumId, fetcher, cursor, counts }
  async function runStreamingSource(label, albumId, fetcher, resume) {
    if (!resume || !_stream) {
      _stream = { label, albumId, fetcher, cursor: 0, counts: { filled: 0, already: 0, skipped: 0, unmatched: 0 } };
    }
    const st = _stream, counts = st.counts;
    setProg(label + ': starting…');
    // defer SoundExchange verification so its requests don't compete with the import
    _deferVerify = true; _deferredVerify = new Set();
    let res;
    try {
      res = await fetcher(albumId,
        (d, n) => setProg(n ? (label + ' ' + d + '/' + n) : (label + ': starting…')),
        s => { counts[mapOneToTrack(s, label)]++; },   // ← fill each ISRC as it's fetched
        st.cursor);
    } catch (e) {
      Log.err(label + ' failed: ' + errText(e));
      setProg('⚠ ' + label + ' failed — see Log', true);
      _deferVerify = false; _deferredVerify = new Set();
      return;
    } finally {
      _deferVerify = false;
    }
    flushDeferredVerify();   // verify this batch's rows now, decoupled from the import
    const total = (res && res.total != null) ? res.total : st.cursor;
    const next  = (res && res.next  != null) ? res.next  : null;
    const parts = [counts.filled + ' filled'];
    if (counts.already)   parts.push(counts.already + ' already present');
    if (counts.skipped)   parts.push(counts.skipped + ' already entered');
    if (counts.unmatched) parts.push(counts.unmatched + ' unmatched');
    if (next != null) {
      // more tracks remain — pause so we don't spam the source; click to continue
      st.cursor = next;
      const remaining = total - next;
      Log.info(label + ': ' + next + '/' + total + ' so far (' + parts.join(', ') + ') — paused to avoid spamming ' + label);
      setProgContinue(label + ' ' + next + '/' + total + ' — click to fetch the next ' + Math.min(STREAM_BATCH_LIMIT, remaining),
        () => runStreamingSource(label, albumId, fetcher, true));
    } else {
      Log.info(label + ' done — ' + parts.join(', '));
      try { setProg(label + ' done — ' + parts.join(' · ')); }
      catch (e) { Log.warn(label + ': imported OK, but a UI update hiccuped: ' + errText(e)); }
    }
  }

  async function runDeezer() {
    if (!RELEASE.deezerId) { Log.warn('Deezer: no Deezer album link on this release'); return; }
    const btn = modal.querySelector('#ii-dz-all'); btn.disabled = true;
    Log.info('Deezer: importing album ' + RELEASE.deezerId);
    try { await runStreamingSource('Deezer', RELEASE.deezerId, fetchDeezer); }
    finally { btn.disabled = false; }   // always re-enable, even if something throws
  }
  async function runSpotify() {
    if (!RELEASE.spotifyId) { Log.warn('Spotify: no Spotify album link on this release'); return; }
    const btn = modal.querySelector('#ii-sp-all'); btn.disabled = true;
    Log.info('Spotify: importing album ' + RELEASE.spotifyId);
    try { await runStreamingSource('Spotify', RELEASE.spotifyId, fetchSpotify); }
    finally { btn.disabled = false; }
  }

  /* ── custom-URL menu (Deezer / Spotify "▾") — import from a pasted album URL,
        even when the release has no such link ── */
  let _srcMenuSource = null, _srcPcUrl = null;
  // If Platform Check (separate userscript) is on the page, read the URL it found
  // for this source from its sidebar anchor (#mb-online-deezer / #mb-online-spotify).
  function platformCheckUrl(source) {
    const a = document.getElementById('mb-online-' + source.toLowerCase());
    // Spotify import goes through ISRC Hunt, which looks up the MB release BY the
    // Spotify URL — so a found-but-not-yet-in-MB URL just errors ("No matching
    // MusicBrainz release found"). The Platform Check shortcut only helps Deezer.
    if (source !== 'Deezer') return null;
    if (!a) return null;                                    // Platform Check not installed
    const href = a.getAttribute('href') || '';
    if (!/^https?:\/\//.test(href)) return null;            // nothing found yet ('#')
    return parseStreamingId(source, href) ? href : null;    // only if it parses to an album id
  }
  function toggleSrcMenu(source, anchor) {
    const menu = document.getElementById('ii-src-menu');
    if (menu.classList.contains('open') && _srcMenuSource === source) { menu.classList.remove('open'); return; }
    _srcMenuSource = source;
    document.getElementById('ii-src-label').textContent = source;
    // Platform Check option — only when installed and it found a usable URL
    _srcPcUrl = platformCheckUrl(source);
    const pcBtn = document.getElementById('ii-src-pc');
    if (_srcPcUrl) {
      pcBtn.style.display = '';
      document.getElementById('ii-src-pc-label').textContent = source;
      document.getElementById('ii-src-pc-url').textContent = _srcPcUrl.replace(/^https?:\/\//, '');
    } else { pcBtn.style.display = 'none'; }
    const url = document.getElementById('ii-src-url');
    url.value = '';
    url.placeholder = source === 'Deezer'
      ? 'https://www.deezer.com/album/123…  (or an album id)'
      : 'https://open.spotify.com/album/…  (or an album id)';
    // show first so offsetWidth is measurable, then anchor under the caret that
    // opened it (menu is position:fixed on <body>), kept fully on-screen
    menu.classList.add('open');
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 12)) + 'px';
    menu.style.top = (r.bottom + 4) + 'px';
    _setTimeout(() => url.focus(), 0);
  }
  async function submitSrcMenu() {
    const source = _srcMenuSource;
    const input = document.getElementById('ii-src-url').value;
    document.getElementById('ii-src-menu').classList.remove('open');
    if (!source) return;
    const id = parseStreamingId(source, input);
    if (!id) { toast('Couldn\'t find a ' + source + ' album id in that URL', 'err'); Log.warn(source + ': unparseable URL "' + input + '"'); return; }
    Log.info(source + ': importing custom album ' + id);
    await runStreamingSource(source, id, source === 'Deezer' ? fetchDeezer : fetchSpotify);
  }
  async function importFromPlatformCheck() {
    const source = _srcMenuSource, url = _srcPcUrl;
    document.getElementById('ii-src-menu').classList.remove('open');
    if (!source || !url) return;
    const id = parseStreamingId(source, url);
    if (!id) { toast('Couldn\'t parse Platform Check\'s ' + source + ' URL', 'err'); return; }
    Log.info(source + ': importing from Platform Check\'s URL ' + url + ' (album ' + id + ')');
    await runStreamingSource(source, id, source === 'Deezer' ? fetchDeezer : fetchSpotify);
  }
  function parseStreamingId(source, input) {
    const s = String(input || '').trim();
    if (source === 'Deezer') {
      const m = s.match(/deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/);
      return m ? m[1] : (/^\d+$/.test(s) ? s : null);
    }
    let m = s.match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/) || s.match(/spotify:album:([A-Za-z0-9]+)/);
    return m ? m[1] : (/^[A-Za-z0-9]{18,30}$/.test(s) ? s : null);
  }

  /* ── OAuth UI handlers ── */
  async function exchangeAndFinish(code, how) {
    Log.info('OAuth: exchanging authorization code (' + how + ')');
    try {
      await Auth.exchangeCode(code);
      refreshAuthState();
      Log.info('OAuth: authorized (refresh token stored)');
      toast('Authorized — you never need to do this again', 'ok');
    } catch (e) {
      Log.err('OAuth exchange failed: ' + e.message);
      toast('Authorization failed: ' + e.message, 'err');
    }
  }
  function onAuthorize() {
    Log.info('OAuth: opening authorize URL');
    store.del('oauth_oob_code');
    // not 'noopener' so the oob tab can close itself once it captures the code
    const w = window.open(Auth.authorizeUrl(), '_blank');
    const ci = modal.querySelector('#ii-oauth-code');
    if (ci) _setTimeout(() => ci.focus(), 100);   // ready for a manual paste if the tab can't close
    let n = 0;
    const iv = _setInterval(() => {
      const oob = store.get('oauth_oob_code', null);
      if (oob && oob.code) {
        clearInterval(iv); store.del('oauth_oob_code');
        try { w && w.close(); } catch (e) {}
        if (ci) ci.value = oob.code;              // show it auto-filled, then exchange
        exchangeAndFinish(oob.code, 'auto-captured');
        return;
      }
      if (++n > 300) clearInterval(iv);           // stop polling after ~5 min
    }, 1000);
  }

  /* ── submit ── */
  async function doSubmit() {
    const map = {};
    let count = 0;
    const dupSet = highlightDuplicates();   // never submit an ISRC that's on >1 recording
    RELEASE.tracks.forEach(t => {
      const v = normalizeIsrc(t.pending);
      if (!v || !isValidIsrc(v) || !t.recId) return;
      if (t.existing.includes(v) || dupSet.has(v)) return;
      (map[t.recId] = map[t.recId] || []).push(v);
      count++;
    });
    if (!count) { toast('Nothing valid to submit (duplicates are blocked)', 'err'); return; }
    if (!Auth.isAuthorized()) {
      togglePane('ii-setup-pane');
      toast('Authorize first (⚙ Setup)', 'err');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    const note = getEditNote();
    Log.info('Submitting ' + count + ' ISRC(s) across ' + Object.keys(map).length + ' recording(s)', map);
    Log.info('Edit note: ' + note.replace(/\n/g, ' '));
    try {
      await submitIsrcs(map, note);
      Log.info('Submit OK');
      toast('Submitted ' + count + ' ISRC' + (count === 1 ? '' : 's') + ' ✓', 'ok');
      // move submitted into "existing", clear pending
      RELEASE.tracks.forEach(t => {
        const v = normalizeIsrc(t.pending);
        if (v && map[t.recId] && map[t.recId].includes(v)) { t.existing.push(v); t.pending = ''; }
      });
      renderTracks();
      updateBtnStatus();
      // no errors — close the editor (the ✓ toast lives on <body> and stays visible)
      _setTimeout(closeModal, 800);
    } catch (e) {
      Log.err('Submit failed: ' + e.message);
      toast('Submit failed: ' + e.message, 'err');
    }
    updateSummary();   // restores "Submit to MusicBrainz (N)" + disabled state
  }

  /* ── delete existing ISRCs (via the recording-edit website form + session cookie) ── */
  async function doDelete() {
    const byRec = {};   // recId -> { idx, isrcs: [] }
    tbody.querySelectorAll('.ii-ex-del:checked').forEach(cb => {
      const tr = cb.closest('tr[data-idx]'); if (!tr) return;
      const idx = +tr.dataset.idx, t = RELEASE.tracks[idx];
      if (!t.recId) return;
      (byRec[t.recId] = byRec[t.recId] || { idx, isrcs: [] }).isrcs.push(normalizeIsrc(cb.dataset.isrc));
    });
    const recs = Object.entries(byRec);
    const total = recs.reduce((n, [, v]) => n + v.isrcs.length, 0);
    if (!total) return;
    if (!Auth.isAuthorized()) { /* deletion uses the session cookie, not OAuth — no auth needed, but warn if not logged in is handled by the request itself */ }
    if (!confirm('Submit "Remove ISRC" edits for ' + total + ' ISRC' + (total === 1 ? '' : 's') + ' across ' + recs.length + ' recording' + (recs.length === 1 ? '' : 's') + '?\n\nUses your logged-in MusicBrainz session. Unlike additions, ISRC removals are NOT auto-applied — they go to the edit queue for voting, so the ISRCs stay listed (shown ⏳ pending) until the edits pass. Track them under 🕓 My ISRC edits.')) return;
    const note = getEditNote();
    const btn = modal.querySelector('#ii-delete');
    btn.disabled = true;
    Log.info('Submitting Remove-ISRC edits for ' + total + ' ISRC(s) across ' + recs.length + ' recording(s)');
    let ok = 0, fail = 0;
    for (const [recId, info] of recs) {
      progEl.textContent = 'Submitting removal for ' + recId.slice(0, 8) + '…';
      try {
        await removeIsrcsFromRecording(recId, info.isrcs, note);
        // mark pending (the edit is queued; don't drop from `existing` — it's still on the recording)
        const t = RELEASE.tracks[info.idx];
        t.pendingRemoval = (t.pendingRemoval || []).concat(info.isrcs);
        recordPendingRemoval(recId, info.isrcs);   // remember across reloads (still pending in MB)
        ok += info.isrcs.length;
        Log.info('Submitted Remove-ISRC for ' + info.isrcs.join(', ') + ' (recording ' + recId + ') — pending');
      } catch (e) {
        fail += info.isrcs.length;
        Log.err('Remove from recording ' + recId + ' failed: ' + e.message);
      }
      await sleep(700);
    }
    renderTracks(); refreshDeleteBtn();
    progEl.textContent = ok + ' removal edit(s) submitted' + (fail ? ', ' + fail + ' failed' : '');
    toast(ok + ' Remove-ISRC edit' + (ok === 1 ? '' : 's') + ' submitted (pending in the edit queue)' + (fail ? ' · ' + fail + ' failed (see Log)' : ''), fail ? 'err' : 'ok');
  }

  function decodeHtmlEntities(s) {
    return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'");
  }

  // The recording-edit form is React-rendered, so the static HTML only carries a few
  // plain inputs + the field data embedded as JSON for hydration. We reconstruct the
  // full `edit-recording.*` POST from BOTH: the JSON field leaves (artist credit with
  // numeric IDs, name, isrcs.N.value) and the static inputs (comment, length, etc.),
  // marking the target ISRCs `isrcs.N.removed=1` (omission alone does NOT remove —
  // MBS-13969). No CSRF token field is used; the session cookie authorises. WS2-verified.
  async function removeIsrcsFromRecording(recId, isrcsToRemove, note) {
    const editUrl = MB_ROOT + '/recording/' + recId + '/edit';
    const gr = await gmGet(editUrl, { 'Accept': 'text/html' });
    if (gr.status !== 200) throw new Error('GET form ' + gr.status + (gr.status === 401 || gr.status === 403 ? ' (are you logged into MusicBrainz?)' : ''));
    const html = gr.responseText;
    const rm = new Set(isrcsToRemove.map(normalizeIsrc));
    const params = new URLSearchParams();
    const seen = new Set();
    const add = (n, v) => { params.append(n, v); seen.add(n); };

    // 1) JSON-hydrated field leaves (flat objects carrying html_name + value)
    const leaves = new Map();
    for (const m of html.matchAll(/\{[^{}]*"html_name":"(edit-recording\.[^"]+)"[^{}]*\}/g)) {
      const vm = m[0].match(/"value":((?:"(?:[^"\\]|\\.)*")|true|false|null|-?\d+(?:\.\d+)?)/);
      if (vm) { try { leaves.set(m[1], JSON.parse(vm[1])); } catch (e) {} }
    }
    // 2) static plain inputs (comment, length, video, make_votable, …)
    const formM = html.match(/<form[^>]*class="edit-recording"[\s\S]*?<\/form>/i);
    const formHtml = formM ? formM[0] : html;
    const statics = new Map();
    for (const m of formHtml.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
      const a = m[2];
      const nm = (a.match(/name="([^"]*)"/) || [])[1];
      if (!nm || !/^edit-recording\./.test(nm)) continue;
      statics.set(nm, {
        type: (a.match(/type="([^"]*)"/) || [])[1] || (m[1].toLowerCase() === 'textarea' ? 'textarea' : 'text'),
        value: decodeHtmlEntities((a.match(/value="([^"]*)"/) || [])[1] || ''),
        checked: /\bchecked\b/i.test(a),
      });
    }

    // ISRC entries: prefer the .value leaves; fall back to the static isrcs.N aliases
    const isrcEntries = [];
    for (const [n, v] of leaves) { const mi = n.match(/\.isrcs\.(\d+)\.value$/); if (mi) isrcEntries.push({ idx: +mi[1], value: String(v) }); }
    if (!isrcEntries.length) for (const [n, s] of statics) { const mi = n.match(/\.isrcs\.(\d+)$/); if (mi && s.value) isrcEntries.push({ idx: +mi[1], value: s.value }); }
    if (!isrcEntries.length) throw new Error('no ISRC fields in the edit form (already removed?)');

    // name + artist credit (numeric IDs) from the JSON leaves
    for (const [n, v] of leaves) { if (/\.isrcs\./.test(n)) continue; if (v === false) continue; add(n, v === true ? '1' : String(v)); }
    // comment / length / other plain fields from the static inputs (omit unchecked checkboxes + the isrcs alias + edit_note)
    for (const [n, s] of statics) {
      if (seen.has(n) || /\.isrcs\.\d+$/.test(n) || /\.edit_note$/.test(n)) continue;
      if (s.type === 'checkbox') { if (s.checked) add(n, s.value || '1'); continue; }
      add(n, s.value);
    }
    // ISRCs: every existing value, with removed=1 on the targets
    isrcEntries.forEach(e => {
      add('edit-recording.isrcs.' + e.idx + '.value', e.value);
      if (rm.has(normalizeIsrc(e.value))) add('edit-recording.isrcs.' + e.idx + '.removed', '1');
    });
    add('edit-recording.edit_note', note);

    Log.info('POST ' + shortUrl(editUrl) + ' (' + [...params.keys()].length + ' fields, removing ' + [...rm].join(',') + ')');
    const pr = await gmPost(editUrl, params.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html', 'Referer': editUrl, 'Origin': MB_ROOT,
    });
    if (pr.status >= 400) throw new Error('POST ' + pr.status + (pr.status === 401 || pr.status === 403 ? ' (are you logged into MusicBrainz?)' : ''));
    // A created edit redirects away from /edit to the recording page. A validation
    // error re-renders the form (stays on /edit, still has the edit-recording inputs).
    // NOTE: "Remove ISRC" is a normal (non-auto) edit — it enters the edit queue, so the
    // ISRC stays visible in WS2 until the edit is applied. So we can't verify by re-reading.
    const finalUrl = pr.finalUrl || '';
    const reRendered = /\/edit\/?(?:[?#]|$)/.test(finalUrl) || /name="edit-recording\.name"/.test(pr.responseText || '');
    if (reRendered) throw new Error('edit form returned an error (nothing submitted)');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE BUTTON
  ═══════════════════════════════════════════════════════════════════════ */
  const btn = document.createElement('button');
  btn.id = 'ii-btn';
  btn.type = 'button';
  btn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
    'ISRC <span class="ii-status" id="ii-btn-status">⏳</span>';
  btn.addEventListener('click', openModal);

  function injectButton() {
    const h1 = document.querySelector('h1');
    if (!h1) return false;
    if (document.getElementById('ii-btn')) return true;
    h1.appendChild(btn);
    updateBtnStatus();           // in case the release already loaded before the button injected
    return true;
  }
  whenDomReady(() => {
    if (!injectButton()) {
      const obs = new MutationObserver(() => { if (injectButton()) obs.disconnect(); });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  });

  function updateBtnStatus() {
    const statusEl = document.getElementById('ii-btn-status');
    if (!statusEl || !RELEASE) return;
    let total = RELEASE.tracks.length, missing = 0;
    RELEASE.tracks.forEach(t => { if (!t.existing.length) missing++; });
    if (missing === 0) {
      statusEl.textContent = '✓ ' + total + '/' + total;
      btn.classList.remove('has-missing');
    } else {
      statusEl.textContent = '⚠ ' + (total - missing) + '/' + total;
      btn.classList.add('has-missing');
      btn.title = missing + ' track' + (missing > 1 ? 's' : '') + ' missing ISRC';
    }
  }

  // initial status fetch (also primes RELEASE for the modal)
  fetchRelease().then(updateBtnStatus).catch(() => {
    const s = document.getElementById('ii-btn-status'); if (s) s.textContent = '?';
  });

})();
