// ==UserScript==
// @name         MusicBrainz ISRC Import
// @namespace    https://musicbrainz.org/
// @version      1.0.0
// @description  Self-contained ISRC editor for MusicBrainz release pages. Reads existing ISRCs, imports from SoundExchange / Deezer / Spotify, bulk paste & import/export, submits directly to MB (one-time OAuth, never depends on MagicISRC).
// @author       majkinetor
// @match        https://musicbrainz.org/release/*
// @match        https://beta.musicbrainz.org/release/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      musicbrainz.org
// @connect      isrc-api.soundexchange.com
// @connect      isrc.soundexchange.com
// @connect      api.deezer.com
// @connect      open.spotify.com
// @connect      api.spotify.com
// @connect      accounts.spotify.com
// @run-at       document-idle
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
 *  1. Register an application (once):
 *       https://musicbrainz.org/account/applications/register
 *       - Type:         Installed application
 *       - Redirect URI: urn:ietf:wg:oauth:2.0:oob
 *     Copy the OAuth Client ID and Client Secret it gives you.
 *
 *  2. Open the editor (the "ISRC" button on any release page) → ⚙ Setup →
 *     paste Client ID + Secret → click "Authorize". A MusicBrainz tab opens;
 *     approve, copy the code it shows, paste it back. Done forever.
 *
 *  Everything except the final "Submit" runs without any credentials.
 * ─────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════════════════════════════════ */
  const MB_ROOT  = location.origin;                 // musicbrainz.org or beta
  const MB_WS2   = MB_ROOT + '/ws/2/';
  const CLIENT   = 'isrc_import-1.0.0';
  const UA       = 'MB-ISRC-Import/1.0';
  const SX_API   = 'https://isrc-api.soundexchange.com/api/ext/recordings';
  const SX_HOME  = 'https://isrc.soundexchange.com/';
  const BATCH_DELAY = 650;
  const ISRC_RE  = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;

  const OAUTH = {
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
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest(Object.assign({
        timeout: 20000,
        onload:    r => resolve(r),
        onerror:   () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout')),
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
    const aw = norm(aTitle).split(' ').filter(Boolean);
    const bw = norm(bTitle).split(' ').filter(Boolean);
    if (!aw.length || !bw.length) return false;
    const shorter = aw.length <= bw.length ? aw : bw;
    const longer  = aw.length <= bw.length ? bw : aw;
    if (!shorter.every(w => longer.includes(w))) return false;
    const extra = longer.length - shorter.length;
    const titleOk = extra === 0 || extra === 1 ||
      (extra <= 2 && shorter.every((w, i) => longer[i] === w));
    const artistOk = !bArtist || wordsMatch(bArtist, aArtist) || wordsMatch(aArtist, bArtist);
    return titleOk && artistOk;
  }
  function normalizeIsrc(raw) {
    return String(raw || '').toUpperCase().replace(/[\s\-]/g, '');
  }
  function isValidIsrc(s) { return ISRC_RE.test(normalizeIsrc(s)); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function toast(msg, kind) {
    let t = document.getElementById('ii-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ii-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'ii-toast-show ' + (kind || '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = ''; }, 4200);
  }

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
    #ii-hdr .ii-sub { font-size: 11px; color: #6c757d; font-weight: 400; margin-left: 6px; }
    #ii-close { background: none; border: none; font-size: 20px; color: #6c757d; cursor: pointer; line-height: 1; }
    #ii-close:hover { color: #212529; }

    /* toolbar */
    #ii-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
      padding: 8px 16px; border-bottom: 1px solid #eee; flex-shrink: 0; background: #fbfbfd; }
    .ii-tbtn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px;
      font-size: 12px; font-weight: 600; border-radius: 5px; cursor: pointer;
      border: 1px solid #dee2e6; background: #fff; color: #343a40; white-space: nowrap; }
    .ii-tbtn:hover { background: #f1f3f5; }
    .ii-tbtn:disabled { opacity: .5; cursor: default; }
    .ii-tbtn.sx  { color: #6f42c1; border-color: #d6c7ee; }
    .ii-tbtn.dz  { color: #ef5466; border-color: #f5c2c8; }
    .ii-tbtn.sp  { color: #1db954; border-color: #b6e5c6; }
    .ii-tbtn.primary { background: #198754; color: #fff; border-color: #198754; }
    .ii-tbtn.primary:hover { background: #157347; }
    .ii-tbtn.ghost { border-color: transparent; }
    .ii-tspacer { flex: 1; }
    .ii-prog { font-size: 11px; color: #6c757d; min-width: 0; }

    /* table */
    #ii-body { flex: 1; overflow: auto; padding: 0; }
    #ii-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    #ii-table thead th { position: sticky; top: 0; z-index: 2; background: #f1f3f5;
      text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .3px; color: #6c757d; padding: 7px 10px; border-bottom: 1px solid #dee2e6; }
    .ii-medrow td { background: #eef0f3; font-weight: 700; font-size: 11.5px; color: #495057;
      padding: 5px 10px; border-top: 1px solid #dee2e6; }
    #ii-table td { padding: 6px 10px; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
    .ii-pos { color: #adb5bd; font-variant-numeric: tabular-nums; width: 34px; white-space: nowrap; }
    .ii-track-title { font-weight: 600; }
    .ii-track-artist { color: #6c757d; font-size: 11.5px; }
    .ii-track-dur { color: #adb5bd; font-size: 11px; font-family: 'Courier New', monospace; }
    .ii-existing { width: 150px; }
    .ii-existing samp { display: block; font-size: 11px; color: #198754; font-family: 'Courier New', monospace; }
    .ii-existing .none { color: #ced4da; font-style: italic; font-size: 11px; }
    .ii-inwrap { display: flex; align-items: center; gap: 5px; }
    .ii-input { width: 150px; padding: 4px 7px; border: 1px solid #ced4da; border-radius: 4px;
      font-family: 'Courier New', monospace; font-size: 12.5px; letter-spacing: .5px; text-transform: uppercase; }
    .ii-input:focus { outline: none; border-color: #6f42c1; }
    .ii-input.bad   { border-color: #dc3545; background: #fff0f1; }
    .ii-input.dup   { border-color: #fd7e14; background: #fff6ed; }
    .ii-input.ok    { border-color: #198754; }
    .ii-plus { font-size: 11px; font-weight: 700; padding: 3px 7px; border: 1px solid #dee2e6;
      border-radius: 4px; background: #f8f9fa; cursor: pointer; color: #6c757d; font-family: monospace; }
    .ii-plus:hover { background: #e9ecef; color: #212529; }
    .ii-cands { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; width: 360px; }
    .ii-cand { display: flex; align-items: center; gap: 7px; padding: 3px 7px; border: 1px solid #dee2e6;
      border-radius: 4px; cursor: pointer; font-size: 11px; background: #fff; }
    .ii-cand:hover { background: #f0f6ff; border-color: #9ec5fe; }
    .ii-cand.best { border-color: #6ea8fe; background: #e7f1ff; }
    .ii-cand.warn { background: #fff3cd; }
    .ii-cand-isrc { font-family: 'Courier New', monospace; font-weight: 700; color: #084298; flex-shrink: 0; }
    .ii-cand-meta { color: #495057; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ii-cand-src { margin-left: auto; font-size: 9px; text-transform: uppercase; color: #adb5bd; flex-shrink: 0; }
    .ii-cand-note { font-size: 11px; color: #adb5bd; font-style: italic; padding: 2px 7px; }
    .ii-row-fill { animation: ii-flash 1s ease-out; }
    @keyframes ii-flash { 0%{background:rgba(25,135,84,.18)} 100%{background:transparent} }

    /* footer */
    #ii-foot { display: flex; align-items: center; gap: 10px; padding: 9px 16px;
      border-top: 1px solid #dee2e6; background: #f8f9fa; flex-shrink: 0; }
    #ii-foot .ii-summary { font-size: 12px; color: #495057; flex: 1; }
    #ii-foot .ii-summary b { color: #212529; }

    /* sub-panels (setup / bulk) */
    .ii-pane { display: none; padding: 14px 16px; border-bottom: 1px solid #eee; background: #fcfcfe; flex-shrink: 0; }
    .ii-pane.open { display: block; }
    .ii-pane h3 { margin: 0 0 8px; font-size: 13px; }
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
      font-family: system-ui, sans-serif; z-index: 1000000; opacity: 0; transition: all .25s; pointer-events: none; max-width: 80vw; }
    #ii-toast.ii-toast-show { transform: translateX(-50%) translateY(0); opacity: 1; }
    #ii-toast.err { background: #b02a37; }
    #ii-toast.ok  { background: #198754; }
  `;
  document.head.appendChild(style);

  /* ═══════════════════════════════════════════════════════════════════════
     RELEASE MODEL (single WS2 fetch → everything)
  ═══════════════════════════════════════════════════════════════════════ */
  let RELEASE = null; // { title, tracks:[{recId, title, artist, dur, mediumPos, trackPos, existing:[], pending:''}], deezerId, spotifyId }

  function fetchRelease() {
    return gmGet(
      MB_WS2 + 'release/' + mbid + '?inc=recordings+artist-credits+isrcs+url-rels&fmt=json',
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
      RELEASE = { title: data.title || '', tracks, deezerId, spotifyId };
      return RELEASE;
    });
  }
  function acName(ac) {
    if (!Array.isArray(ac)) return '';
    return ac.map(c => (c.name || (c.artist && c.artist.name) || '') + (c.joinphrase || '')).join('');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     OAUTH (one-time authorize, offline refresh token)
  ═══════════════════════════════════════════════════════════════════════ */
  const Auth = {
    clientId()     { return store.get('oauth_client_id', ''); },
    clientSecret() { return store.get('oauth_client_secret', ''); },
    refreshTok()   { return store.get('oauth_refresh_token', ''); },
    isAuthorized() { return !!this.refreshTok(); },
    isConfigured() { return !!this.clientId() && !!this.clientSecret(); },

    setCreds(id, secret) {
      store.set('oauth_client_id', id.trim());
      store.set('oauth_client_secret', secret.trim());
    },

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
  function buildIsrcXml(map) {
    let x = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">\n<recording-list>\n';
    for (const [rid, isrcs] of Object.entries(map)) {
      x += '  <recording id="' + rid + '"><isrc-list>';
      isrcs.forEach(i => { x += '<isrc id="' + i + '"/>'; });
      x += '</isrc-list></recording>\n';
    }
    x += '</recording-list>\n</metadata>';
    return x;
  }

  async function submitIsrcs(map) {
    const token = await Auth.accessToken();
    const xml = buildIsrcXml(map);
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
    function classify(f, mbTitle, mbArtist, mbDurStr) {
      if (!isGoodMatch(f.title, f.artist, mbTitle, mbArtist)) return 'other';
      const a = durToSec(mbDurStr), b = durToSec(f.dur);
      if (a !== null && b !== null && Math.abs(a - b) > 10) return 'warn';
      return 'best';
    }

    function apiSearch(title, artist, start, count) {
      const body = JSON.stringify({
        searchFields: {
          recordingArtistName: { value: artist || '' },
          recordingTitle:      { value: title || '' },
        },
        start: start || 0, number: count || 20, showReleases: true,
      });
      const doReq = (token) => gmPost(SX_API, body, {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'Authorization': 'Token ' + token, 'Origin': SX_HOME, 'Referer': SX_HOME,
      }).then(r => {
        if (r.status === 0) throw new Error('blocked');
        if (r.status === 401 || r.status === 403) return refreshToken().then(t => doReq(t));
        let p; try { p = JSON.parse(r.responseText); } catch (e) { throw new Error('parse'); }
        const raw = p.recordings || p.results || p.data || (Array.isArray(p) ? p : []);
        // dedupe by ISRC, keep earliest release
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
      });
      return doReq(_token);
    }

    return { refreshToken, apiSearch, fields, classify };
  })();

  /* ═══════════════════════════════════════════════════════════════════════
     DEEZER  (free public API, no auth)
  ═══════════════════════════════════════════════════════════════════════ */
  async function fetchDeezer(albumId, onProgress) {
    const r = await gmGet('https://api.deezer.com/album/' + albumId, { 'Accept': 'application/json' });
    const data = JSON.parse(r.responseText || '{}');
    if (data.error) throw new Error('Deezer: ' + (data.error.message || 'error'));
    const list = (data.tracks && data.tracks.data) || [];
    const out = [];
    let done = 0;
    for (const t of list) {
      // album tracklist lacks isrc → fetch the track for its isrc
      try {
        const tr = await gmGet('https://api.deezer.com/track/' + t.id, { 'Accept': 'application/json' });
        const td = JSON.parse(tr.responseText || '{}');
        out.push({
          isrc:   normalizeIsrc(td.isrc || ''),
          title:  td.title || t.title || '',
          artist: (td.artist && td.artist.name) || '',
          disc:   td.disk_number || t.disk_number || 1,
          pos:    td.track_position || t.track_position || (out.length + 1),
          dur:    td.duration ? msToMmSs(td.duration * 1000) : '',
        });
      } catch (e) {}
      done++;
      if (onProgress) onProgress(done, list.length);
      await sleep(120);
    }
    return out.filter(t => isValidIsrc(t.isrc));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SPOTIFY  (anonymous web token, no user OAuth)
  ═══════════════════════════════════════════════════════════════════════ */
  // Preferred: official client-credentials token from a free Spotify app (what isrchunt
  // uses server-side; not bot-blocked). Falls back to the anonymous web token if no app
  // credentials are configured. Cached in GM storage until it expires.
  async function spotifyClientCredsToken() {
    const id = store.get('spotify_client_id', ''), secret = store.get('spotify_client_secret', '');
    if (!id || !secret) return null;
    const cached = store.get('spotify_cc_token', ''), exp = store.get('spotify_cc_expiry', 0);
    if (cached && Date.now() < exp - 60000) return cached;
    const r = await gmPost('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(id + ':' + secret),
    });
    const j = JSON.parse(r.responseText || '{}');
    if (!j.access_token) throw new Error('client-credentials failed: ' + (j.error_description || j.error || r.status));
    store.set('spotify_cc_token', j.access_token);
    store.set('spotify_cc_expiry', Date.now() + ((j.expires_in || 3600) * 1000));
    return j.access_token;
  }
  async function spotifyAnonToken() {
    const r = await gmGet('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      'Accept': 'application/json', 'App-Platform': 'WebPlayer', 'Referer': 'https://open.spotify.com/',
    });
    if (r.status === 403) throw new Error('anonymous token blocked (403). Add a Spotify app in ⚙ Setup for a reliable token.');
    let j; try { j = JSON.parse(r.responseText || '{}'); } catch (e) { throw new Error('unexpected token response (' + r.status + ')'); }
    if (!j.accessToken) throw new Error('token unavailable (' + r.status + ')');
    return j.accessToken;
  }
  async function spotifyToken() {
    return (await spotifyClientCredsToken()) || spotifyAnonToken();
  }
  async function fetchSpotify(albumId, onProgress) {
    const tok = await spotifyToken();
    const auth = { 'Authorization': 'Bearer ' + tok, 'Accept': 'application/json' };
    // 1) album tracklist (paginated) — simplified tracks have no ISRC
    const ids = [];
    let url = 'https://api.spotify.com/v1/albums/' + albumId + '/tracks?limit=50';
    while (url) {
      const r = await gmGet(url, auth);
      const j = JSON.parse(r.responseText || '{}');
      if (j.error) throw new Error((j.error.message || j.error.status));
      (j.items || []).forEach(it => ids.push({ id: it.id, disc: it.disc_number || 1, pos: it.track_number, title: it.name }));
      url = j.next;
    }
    // 2) per-track fetch for external_ids.isrc — the bulk /v1/tracks endpoint was
    //    removed in Feb 2026, so we fetch one at a time (like Deezer).
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const meta = ids[i];
      try {
        const r = await gmGet('https://api.spotify.com/v1/tracks/' + meta.id, auth);
        const t = JSON.parse(r.responseText || '{}');
        out.push({
          isrc:   normalizeIsrc((t.external_ids && t.external_ids.isrc) || ''),
          title:  t.name || meta.title || '',
          artist: (t.artists || []).map(a => a.name).join(', '),
          disc:   meta.disc, pos: meta.pos,
          dur:    t.duration_ms ? msToMmSs(t.duration_ms) : '',
        });
      } catch (e) {}
      if (onProgress) onProgress(i + 1, ids.length);
      await sleep(130);
    }
    return out.filter(t => isValidIsrc(t.isrc));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EDITOR MODAL — DOM
  ═══════════════════════════════════════════════════════════════════════ */
  let overlay, modal, tbody, summaryEl, progEl, submitBtn;
  let built = false;

  function buildModal() {
    if (built) return;
    built = true;

    overlay = document.createElement('div');
    overlay.id = 'ii-overlay';
    overlay.addEventListener('click', closeModal);

    modal = document.createElement('div');
    modal.id = 'ii-modal';
    modal.addEventListener('click', e => e.stopPropagation());
    modal.innerHTML = `
      <div id="ii-hdr">
        <h2>🎵 <em>ISRC Import</em><span class="ii-sub" id="ii-rel-sub"></span></h2>
        <button class="ii-tbtn ghost" id="ii-setup-toggle" title="OAuth setup">⚙ Setup</button>
        <button id="ii-close" title="Close (Esc)">✕</button>
      </div>

      <div class="ii-pane" id="ii-setup-pane">
        <h3>One-time MusicBrainz authorization</h3>
        <div class="ii-authstate" id="ii-auth-state"></div>
        <div class="row">
          <div><label>OAuth Client ID</label><input type="text" id="ii-cid" autocomplete="off"></div>
          <div><label>OAuth Client Secret</label><input type="text" id="ii-csec" autocomplete="off"></div>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="ii-tbtn primary" id="ii-authorize">Authorize</button>
          <button class="ii-tbtn" id="ii-paste-code">Paste code…</button>
          <button class="ii-tbtn ghost" id="ii-signout">Sign out</button>
        </div>
        <div class="ii-help">
          Register an app once at
          <a href="${MB_ROOT}/account/applications/register" target="_blank" rel="noopener">account → applications → register</a>
          — type <b>Installed application</b>, redirect URI <code>urn:ietf:wg:oauth:2.0:oob</code>.
          Paste its Client ID + Secret above, click <b>Authorize</b>, approve in the MB tab, then paste the code it shows.
          You only ever do this once.
        </div>

        <h3 style="margin-top:14px">Spotify app (optional, for reliable Spotify import)</h3>
        <div class="row">
          <div><label>Spotify Client ID</label><input type="text" id="ii-sp-cid" autocomplete="off"></div>
          <div><label>Spotify Client Secret</label><input type="text" id="ii-sp-csec" autocomplete="off"></div>
        </div>
        <div class="row" style="margin-top:8px"><button class="ii-tbtn" id="ii-sp-save">Save Spotify app</button></div>
        <div class="ii-help">
          Free to create at
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a>
          (any redirect URI). Without this, Spotify uses an anonymous token that Spotify frequently bot-blocks.
          Note: Spotify keeps removing API endpoints, so Spotify import may break independently of this setup.
        </div>
      </div>

      <div class="ii-pane" id="ii-bulk-pane">
        <h3>Bulk paste / import / export</h3>
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

      <div id="ii-tools">
        <button class="ii-tbtn sx"  id="ii-sx-all"  title="Search every track on SoundExchange">⟳ SoundExchange</button>
        <button class="ii-tbtn dz"  id="ii-dz-all"  title="Import ISRCs from the linked Deezer album">Deezer</button>
        <button class="ii-tbtn sp"  id="ii-sp-all"  title="Import ISRCs from the linked Spotify album">Spotify</button>
        <button class="ii-tbtn"     id="ii-bulk-toggle">⇪ Bulk / Export</button>
        <span class="ii-prog" id="ii-prog"></span>
        <span class="ii-tspacer"></span>
        <button class="ii-tbtn ghost" id="ii-clear-pending" title="Clear all entered ISRCs">Clear entered</button>
      </div>

      <div id="ii-body">
        <table id="ii-table">
          <thead><tr>
            <th>#</th><th>Track</th><th></th><th>Existing</th><th>New ISRC</th>
          </tr></thead>
          <tbody id="ii-tbody"></tbody>
        </table>
      </div>

      <div id="ii-foot">
        <span class="ii-summary" id="ii-summary"></span>
        <button class="ii-tbtn primary" id="ii-submit">Submit to MusicBrainz</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    tbody     = modal.querySelector('#ii-tbody');
    summaryEl = modal.querySelector('#ii-summary');
    progEl    = modal.querySelector('#ii-prog');
    submitBtn = modal.querySelector('#ii-submit');

    modal.querySelector('#ii-close').addEventListener('click', closeModal);
    modal.querySelector('#ii-setup-toggle').addEventListener('click', () => togglePane('ii-setup-pane'));
    modal.querySelector('#ii-bulk-toggle').addEventListener('click', () => togglePane('ii-bulk-pane'));
    modal.querySelector('#ii-clear-pending').addEventListener('click', clearPending);
    modal.querySelector('#ii-sx-all').addEventListener('click', runSxAll);
    modal.querySelector('#ii-dz-all').addEventListener('click', runDeezer);
    modal.querySelector('#ii-sp-all').addEventListener('click', runSpotify);
    submitBtn.addEventListener('click', doSubmit);

    // setup pane wiring
    modal.querySelector('#ii-cid').value  = Auth.clientId();
    modal.querySelector('#ii-csec').value = Auth.clientSecret();
    modal.querySelector('#ii-authorize').addEventListener('click', onAuthorize);
    modal.querySelector('#ii-paste-code').addEventListener('click', onPasteCode);
    modal.querySelector('#ii-signout').addEventListener('click', () => { Auth.signOut(); refreshAuthState(); toast('Signed out'); });

    // optional Spotify app credentials
    modal.querySelector('#ii-sp-cid').value  = store.get('spotify_client_id', '');
    modal.querySelector('#ii-sp-csec').value = store.get('spotify_client_secret', '');
    modal.querySelector('#ii-sp-save').addEventListener('click', () => {
      store.set('spotify_client_id',     modal.querySelector('#ii-sp-cid').value.trim());
      store.set('spotify_client_secret', modal.querySelector('#ii-sp-csec').value.trim());
      store.del('spotify_cc_token'); store.del('spotify_cc_expiry');
      toast('Saved Spotify app — Spotify import will use it', 'ok');
    });

    // bulk pane wiring
    modal.querySelector('#ii-bulk-apply').addEventListener('click', () => applyBulk(false));
    modal.querySelector('#ii-bulk-apply-all').addEventListener('click', () => applyBulk(true));
    modal.querySelector('#ii-export-text').addEventListener('click', exportText);
    modal.querySelector('#ii-export-json').addEventListener('click', exportJson);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
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
    if (Auth.isAuthorized()) {
      el.className = 'ii-authstate ok';
      el.textContent = '✓ Authorized — submit is ready.';
    } else if (Auth.isConfigured()) {
      el.className = 'ii-authstate no';
      el.textContent = '• Credentials saved. Click Authorize to finish (one time).';
    } else {
      el.className = 'ii-authstate no';
      el.textContent = '• Not set up. Enter Client ID + Secret, then Authorize.';
      pane.classList.add('open'); // nudge first-time users
    }
  }

  /* ── render the track table ── */
  function renderTracks() {
    modal.querySelector('#ii-rel-sub').textContent = RELEASE.title ? '· ' + RELEASE.title : '';
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
        '<td><div class="ii-track-title">' + esc(t.title) + '</div>' +
          '<div class="ii-track-artist">' + esc(t.artist) + '</div></td>' +
        '<td class="ii-track-dur">' + esc(t.dur) + '</td>' +
        '<td class="ii-existing">' + existingHtml(t.existing) + '</td>' +
        '<td><div class="ii-inwrap">' +
          '<input class="ii-input" type="text" maxlength="15" placeholder="—" value="' + esc(t.pending) + '">' +
          '<button class="ii-plus" title="Previous ISRC + 1">+1</button>' +
          '</div><div class="ii-cands"></div></td>';
      const input = tr.querySelector('.ii-input');
      input.addEventListener('input', () => {
        t.pending = normalizeIsrc(input.value);
        if (input.value !== t.pending) {
          const p = input.selectionStart;
          input.value = t.pending; input.setSelectionRange(p, p);
        }
        validateInput(input, t);
        updateSummary();
      });
      tr.querySelector('.ii-plus').addEventListener('click', () => plusOne(idx));
      tbody.appendChild(tr);
      validateInput(input, t);
    });
    updateSummary();
  }
  function existingHtml(arr) {
    if (!arr || !arr.length) return '<span class="none">none</span>';
    return arr.map(i => '<samp>' + esc(i) + '</samp>').join('');
  }
  function rowInput(idx) {
    const tr = tbody.querySelector('tr[data-idx="' + idx + '"]');
    return tr ? tr.querySelector('.ii-input') : null;
  }
  function rowCands(idx) {
    const tr = tbody.querySelector('tr[data-idx="' + idx + '"]');
    return tr ? tr.querySelector('.ii-cands') : null;
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

  function setPending(idx, isrc, flash) {
    const t = RELEASE.tracks[idx];
    const input = rowInput(idx);
    if (!t || !input) return;
    t.pending = normalizeIsrc(isrc);
    input.value = t.pending;
    validateInput(input, t);
    if (flash) {
      const tr = input.closest('tr');
      tr.classList.remove('ii-row-fill'); void tr.offsetWidth; tr.classList.add('ii-row-fill');
    }
  }

  function clearPending() {
    RELEASE.tracks.forEach((t, i) => { t.pending = ''; const inp = rowInput(i); if (inp) { inp.value = ''; validateInput(inp, t); } });
    tbody.querySelectorAll('.ii-cands').forEach(c => c.innerHTML = '');
    updateSummary();
    toast('Cleared entered ISRCs');
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

  function updateSummary() {
    let filled = 0, valid = 0, bad = 0, dup = 0, missing = 0;
    RELEASE.tracks.forEach(t => {
      if (!t.existing.length && !t.pending) missing++;
      if (!t.pending) return;
      filled++;
      const v = normalizeIsrc(t.pending);
      if (!isValidIsrc(v)) bad++;
      else if (t.existing.includes(v)) dup++;
      else valid++;
    });
    summaryEl.innerHTML =
      '<b>' + RELEASE.tracks.length + '</b> tracks · ' +
      '<b>' + valid + '</b> to submit' +
      (bad ? ' · <span style="color:#dc3545">' + bad + ' invalid</span>' : '') +
      (dup ? ' · <span style="color:#fd7e14">' + dup + ' duplicate</span>' : '') +
      (missing ? ' · ' + missing + ' still missing' : '');
    submitBtn.disabled = valid === 0;
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
      setPending(idx, v, true); applied++;
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
      setPending(idx, v, true); applied++;
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
  function renderCands(idx, rows) {
    const box = rowCands(idx);
    const t = RELEASE.tracks[idx];
    if (!box) return;
    box.innerHTML = '';
    if (!rows || !rows.length) {
      box.innerHTML = '<span class="ii-cand-note">no SoundExchange match</span>';
      return;
    }
    rows.slice(0, 5).forEach(item => {
      const f = SX.fields(item);
      const cls = SX.classify(f, t.title, t.artist, t.dur);
      const c = document.createElement('div');
      c.className = 'ii-cand' + (cls === 'best' ? ' best' : cls === 'warn' ? ' warn' : '');
      c.innerHTML =
        '<span class="ii-cand-isrc">' + esc(f.isrc) + '</span>' +
        '<span class="ii-cand-meta">' + esc([f.title, f.artist, f.year, f.dur].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="ii-cand-src">SX</span>';
      c.addEventListener('click', () => { setPending(idx, f.isrc, true); updateSummary(); });
      box.appendChild(c);
    });
  }

  async function runSxAll() {
    const btn = modal.querySelector('#ii-sx-all');
    btn.disabled = true;
    SX.refreshToken().catch(() => {});
    const tracks = RELEASE.tracks;
    let done = 0, filled = 0;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      progEl.textContent = 'SoundExchange ' + (done + 1) + '/' + tracks.length;
      try {
        const rows = await SX.apiSearch(t.title, t.artist, 0, 10);
        renderCands(i, rows);
        // auto-fill best match into empty fields
        if (!t.pending && !t.existing.length) {
          const best = rows.find(r => SX.classify(SX.fields(r), t.title, t.artist, t.dur) === 'best');
          if (best) { setPending(i, SX.fields(best).isrc, true); filled++; }
        }
      } catch (e) {
        renderCands(i, []);
      }
      done++;
      updateSummary();
      if (i < tracks.length - 1) await sleep(BATCH_DELAY);
    }
    progEl.textContent = 'SoundExchange done — auto-filled ' + filled;
    btn.disabled = false;
  }

  /* ── streaming-source import (Deezer / Spotify) ── */
  function mapSourceToTracks(found, label) {
    // match by (disc,pos) first, then by normalized title; fill empty fields only
    let filled = 0;
    found.forEach(s => {
      let idx = RELEASE.tracks.findIndex(t =>
        (+t.trackPos === +s.pos) && ((+t.mediumPos === +s.disc) || RELEASE.tracks.filter(x => +x.mediumPos === +s.disc).length === 0));
      if (idx < 0) idx = RELEASE.tracks.findIndex(t => t.title && isGoodMatch(s.title, s.artist, t.title, t.artist));
      if (idx < 0) return;
      const t = RELEASE.tracks[idx];
      if (t.pending || t.existing.includes(s.isrc)) return;
      setPending(idx, s.isrc, true);
      filled++;
    });
    updateSummary();
    toast(label + ': filled ' + filled + ' track' + (filled === 1 ? '' : 's') +
      (filled < found.length ? ' (' + (found.length - filled) + ' unmatched/skipped)' : ''), filled ? 'ok' : '');
  }

  async function runDeezer() {
    if (!RELEASE.deezerId) return;
    const btn = modal.querySelector('#ii-dz-all'); btn.disabled = true;
    try {
      progEl.textContent = 'Deezer…';
      const found = await fetchDeezer(RELEASE.deezerId, (d, n) => progEl.textContent = 'Deezer ' + d + '/' + n);
      mapSourceToTracks(found, 'Deezer');
      progEl.textContent = 'Deezer done (' + found.length + ' ISRCs)';
    } catch (e) {
      toast('Deezer failed: ' + e.message, 'err');
      progEl.textContent = '';
    }
    btn.disabled = false;
  }
  async function runSpotify() {
    if (!RELEASE.spotifyId) return;
    const btn = modal.querySelector('#ii-sp-all'); btn.disabled = true;
    try {
      progEl.textContent = 'Spotify…';
      const found = await fetchSpotify(RELEASE.spotifyId, (d, n) => progEl.textContent = 'Spotify ' + d + '/' + n);
      mapSourceToTracks(found, 'Spotify');
      progEl.textContent = 'Spotify done (' + found.length + ' ISRCs)';
    } catch (e) {
      toast('Spotify failed: ' + e.message + ' (token endpoint can be flaky)', 'err');
      progEl.textContent = '';
    }
    btn.disabled = false;
  }

  /* ── OAuth UI handlers ── */
  function onAuthorize() {
    const id = modal.querySelector('#ii-cid').value.trim();
    const sec = modal.querySelector('#ii-csec').value.trim();
    if (!id || !sec) { toast('Enter Client ID and Secret first', 'err'); return; }
    Auth.setCreds(id, sec);
    window.open(Auth.authorizeUrl(), '_blank', 'noopener');
    setTimeout(onPasteCode, 600);
  }
  async function onPasteCode() {
    const code = prompt('Paste the authorization code MusicBrainz showed you:');
    if (!code) return;
    try {
      await Auth.exchangeCode(code);
      refreshAuthState();
      toast('Authorized — you never need to do this again', 'ok');
    } catch (e) {
      toast('Authorization failed: ' + e.message, 'err');
    }
  }

  /* ── submit ── */
  async function doSubmit() {
    const map = {};
    let count = 0;
    RELEASE.tracks.forEach(t => {
      const v = normalizeIsrc(t.pending);
      if (!v || !isValidIsrc(v) || !t.recId) return;
      if (t.existing.includes(v)) return;
      (map[t.recId] = map[t.recId] || []).push(v);
      count++;
    });
    if (!count) { toast('Nothing valid to submit', 'err'); return; }
    if (!Auth.isAuthorized()) {
      togglePane('ii-setup-pane');
      toast('Authorize first (⚙ Setup)', 'err');
      return;
    }
    if (!confirm('Submit ' + count + ' ISRC' + (count === 1 ? '' : 's') + ' to MusicBrainz?')) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    try {
      await submitIsrcs(map);
      toast('Submitted ' + count + ' ISRC' + (count === 1 ? '' : 's') + ' ✓', 'ok');
      // move submitted into "existing", clear pending
      RELEASE.tracks.forEach(t => {
        const v = normalizeIsrc(t.pending);
        if (v && map[t.recId] && map[t.recId].includes(v)) { t.existing.push(v); t.pending = ''; }
      });
      renderTracks();
      updateBtnStatus();
    } catch (e) {
      toast('Submit failed: ' + e.message, 'err');
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit to MusicBrainz';
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
    return true;
  }
  if (!injectButton()) {
    const obs = new MutationObserver(() => { if (injectButton()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }

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
