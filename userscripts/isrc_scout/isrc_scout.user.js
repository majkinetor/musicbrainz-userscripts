// ==UserScript==
// @name         ISRC Scout
// @namespace    https://musicbrainz.org/
// @version      2026.7.9.190943
// @description  Scout ISRCs for a MusicBrainz release: reads existing ISRCs, finds missing ones on SoundExchange / Deezer / Spotify / Beatport / Tidal / Volumo / HDtracks, bulk paste & import/export, submits directly to MB (one-time OAuth, never depends on MagicISRC).
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPklTUkMgU2NvdXQ8L3RpdGxlPgogICAgPHBhdGggZD0iTTY0IDY0IEw2NCAyNCBBNDAgNDAgMCAwIDEgOTkgODQgWiIgZmlsbD0iI2UzZDhmNyIvPgogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZmNDJjMSIgc3Ryb2tlLXdpZHRoPSI2Ij4KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjQwIi8+CiAgICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSIyNiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2U9IiNiOWEzZTgiLz4KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjEzIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPgogIDwvZz4KICA8bGluZSB4MT0iNjQiIHkxPSI2NCIgeDI9IjY0IiB5Mj0iMjQiIHN0cm9rZT0iIzZmNDJjMSIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8Y2lyY2xlIGN4PSI4NiIgY3k9IjUwIiByPSI3IiBmaWxsPSIjNGIyZTgzIi8+Cjwvc3ZnPgo=
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/isrc_scout/README.md
// @match        https://*.musicbrainz.org/release/*
// @match        https://*.musicbrainz.org/oauth2/oob*
// @match        https://www.beatport.com/release/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// @connect      isrc-api.soundexchange.com
// @connect      isrc.soundexchange.com
// @connect      api.deezer.com
// @connect      isrchunt.com
// @connect      openapi.tidal.com
// @connect      auth.tidal.com
// @connect      volumo.com
// @connect      hdtracks.azurewebsites.net
// @connect      api.beatport.com
// @connect      bandcamp.com
// @connect      music.apple.com
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
     BEATPORT HARVESTER  (runs ON beatport.com)
     Beatport is Cloudflare-walled, so a cross-origin GM_xmlhttpRequest from
     MusicBrainz is always challenged. Instead, when the editor opens a release
     in a brief background tab, THIS instance (matched on beatport.com) reads
     the ISRCs straight out of the page's embedded __NEXT_DATA__ in real page
     context — where Cloudflare is already satisfied — stashes them in shared
     GM storage for the MB tab to pick up, then closes itself.
  ═══════════════════════════════════════════════════════════════════════ */
  if (/(^|\.)beatport\.com$/i.test(location.hostname)) {
    const bpId = (location.pathname.match(/\/release\/[^/]+\/(\d+)/) || [])[1];
    if (!bpId) return;
    const grab = () => {
      const el = document.getElementById('__NEXT_DATA__');
      if (!el) return false;
      let j; try { j = JSON.parse(el.textContent); } catch (e) { return false; }
      const qs = (((j || {}).props || {}).pageProps || {}).dehydratedState;
      const queries = (qs && qs.queries) || [];
      let results = null;
      for (const q of queries) {
        const r = q && q.state && q.state.data && q.state.data.results;
        if (Array.isArray(r) && r.length && ('isrc' in r[0])) { results = r; break; }
      }
      if (!results) return false;
      const tracks = results.map((t, i) => {
        const mix = t.mix_name && !/^original mix$/i.test(t.mix_name) ? ' (' + t.mix_name + ')' : '';
        return {
          isrc:   String(t.isrc || '').toUpperCase().replace(/[\s-]/g, ''),
          title:  (t.name || '') + mix,
          artist: (t.artists || []).map(a => a && a.name).filter(Boolean).join(', '),
          disc:   1,
          pos:    t.number || (i + 1),
          dur:    t.length || '',
          url:    (t.slug && t.id) ? 'https://www.beatport.com/track/' + t.slug + '/' + t.id : '',   // #387 per-track link
        };
      });
      try { GM_setValue('beatport_harvest_' + bpId, { ts: Date.now(), tracks: tracks }); } catch (e) {}
      return true;
    };
    const t0 = Date.now();
    const tick = () => {
      if (grab()) {
        // Only self-close when the editor's background harvest opened this tab
        // (it sets a per-release close flag first). A tab the USER opened — or
        // one Platform Check's ↗/link opened — must stay put; we still harvest
        // it (populating the cache) but leave it on screen.
        try {
          const flag = GM_getValue('beatport_close_' + bpId, 0);
          if (flag && (Date.now() - flag < 120000)) { GM_deleteValue('beatport_close_' + bpId); window.close(); }
        } catch (e) {}
        return;
      }
      if (Date.now() - t0 > 90000) return;   // Cloudflare never cleared — give up silently
      window.setTimeout(tick, 500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, { once: true });
    else tick();
    return; // never run the MB editor on a Beatport page
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════════════════════════════════ */
  const MB_ROOT  = location.origin;                 // musicbrainz.org or beta
  const MB_WS2   = MB_ROOT + '/ws/2/';
  // Derive from the installed @version so the banner/CLIENT never drift out of
  // sync with the metadata again (the hardcoded constant kept lagging behind).
  const SCRIPT_VERSION = (() => {
    try { return (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '2026.6.27'; } catch (e) { return '2026.6.27'; }
  })();
  const SCRIPT_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/isrc_scout';
  const CLIENT   = 'isrc_scout-' + SCRIPT_VERSION;
  const UA       = 'MB-ISRC-Scout/1.0';
  const SX_API   = 'https://isrc-api.soundexchange.com/api/ext/recordings';
  const SX_HOME  = 'https://isrc.soundexchange.com/';
  const BATCH_DELAY = 650;
  const TIDAL_TRACK_DELAY = 350;   // pace per-track Tidal lookups under its rate limit
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

  // Baked-in Tidal API app. The client-credentials grant yields an app-level
  // token with TIDAL Catalog access (no user login) — same "shared installed
  // app" trust model as the MB OAuth app above.
  const TIDAL = {
    clientId:     'cRhhDJDpYXXBn82U',
    clientSecret: 'K7UX40jDOZ5p4y4JMYZgoiwKi7jymTHWcLMb4gkewKs=',
    tokenUrl: 'https://auth.tidal.com/v1/oauth2/token',
    api:      'https://openapi.tidal.com/v2',
    country:  'US',
  };

  // Brand glyphs for the import-source buttons (fill:currentColor → each inherits
  // its button's brand colour). Toggled against text labels via ⚙ Setup.
  const SRC_ICON = {
    dz: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><rect x="1" y="14" width="4" height="6" rx=".6"/><rect x="6.7" y="10" width="4" height="10" rx=".6"/><rect x="12.4" y="6" width="4" height="14" rx=".6"/><rect x="18.1" y="11" width="4" height="9" rx=".6"/></svg>',
    sp: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
    bp: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 8.2l6 3.8-6 3.8z"/></svg>',
    td: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M6 3l3 3-3 3-3-3zM12 3l3 3-3 3-3-3zM18 3l3 3-3 3-3-3zM12 9l3 3-3 3-3-3z"/></svg>',
    vo: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7.5 8h2l2.5 5.5L14.5 8h2l-3.5 8h-2z"/></svg>',
    // HDtracks: "HD" monogram (clean stand-in — the brand has no public glyph mark)
    hd: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M2 6h2.4v4h4V6h2.4v12H8.4v-5.6h-4V18H2z"/><path d="M12 6h4.2c3 0 5 2.4 5 6s-2 6-5 6H12zm2.4 2.2v7.6h1.6c1.7 0 2.8-1.5 2.8-3.8s-1.1-3.8-2.8-3.8z"/></svg>',
    // Bandcamp: the brand logomark is a parallelogram
    bc: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M2 16.5l5-9h15l-5 9z"/></svg>',
    // Apple Music: the Apple logomark
    am: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.73 3.01-.44 7.47 1.24 9.92.82 1.2 1.8 2.54 3.08 2.49 1.24-.05 1.71-.8 3.21-.8 1.5 0 1.92.8 3.23.77 1.33-.02 2.18-1.22 3-2.42.94-1.39 1.33-2.73 1.35-2.8-.03-.01-2.59-.99-2.62-3.93zM14.6 4.59c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38z"/></svg>',
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
  const _inflight = new Set();   // live GM requests, so batched SoundExchange work can be aborted (#127)
  function http(opts) {
    const t0 = Date.now();
    const tag = (opts.method || 'GET') + ' ' + shortUrl(opts.url);
    Log.net('→ ' + tag);
    return new Promise((resolve, reject) => {
      const entry = { url: opts.url, handle: null };
      const done = () => _inflight.delete(entry);
      entry.handle = GM_xmlhttpRequest(Object.assign({
        timeout: 20000,
        onload: r => {
          done();
          const ms = Date.now() - t0;
          if (r.status >= 200 && r.status < 300) Log.net('← ' + r.status + ' ' + tag + ' (' + ms + 'ms)');
          else Log.warn('← ' + r.status + ' ' + tag + ' (' + ms + 'ms) ' + String(r.responseText || '').replace(/\s+/g, ' ').slice(0, 160));
          resolve(r);
        },
        onerror:   () => { done(); Log.err('✗ network ' + tag); reject(new Error('network error')); },
        ontimeout: () => { done(); Log.err('✗ timeout ' + tag); reject(new Error('timeout')); },
        onabort:   () => { done(); reject(new Error('aborted')); },
      }, opts));
      _inflight.add(entry);
    });
  }
  // Abort in-flight GM requests whose URL contains `urlSubstr` (cancels batched SoundExchange work). #127
  function abortInflight(urlSubstr) {
    [..._inflight].forEach(e => {
      if (!urlSubstr || (e.url && e.url.indexOf(urlSubstr) !== -1)) {
        try { e.handle && e.handle.abort && e.handle.abort(); } catch (x) {}
        _inflight.delete(e);
      }
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
    if (f.year)   parts.push(span(f.year,   yearOk(f.year, RELEASE && RELEASE.releaseYear),
                                  'Recording year ' + f.year + ' is after this release (' + (RELEASE && RELEASE.releaseYear) + ')'));
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
  // Keep the FULL url — scheme + query — in the NET log so an API call's real
  // arguments (album_id, app_id, …) are visible for debugging; only redact
  // token/secret/signature values, and cap length. (#201: the query was being
  // dropped, so a 404 gave no clue which id/app_id was actually sent.)
  const shortUrl = (u) => String(u || '').replace(/([?&](?:[a-z_]*(?:token|secret|sig|password))=)[^&#]*/gi, '$1…').slice(0, 200);
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
      width: 1080px; max-width: 96vw;
      /* a DEFINITE height (not just max-height) so the modal never grows as rows /
         candidates are added — the body scrolls inside a fixed frame and the footer
         stays put. !important so MusicBrainz's page CSS can't un-cap it. */
      height: 92vh !important; max-height: 92vh !important; background: #fff;
      border-radius: 10px; box-shadow: 0 12px 48px rgba(0,0,0,.3); z-index: 999999;
      display: none; flex-direction: column; font-family: system-ui, sans-serif;
      color: #212529; overflow: hidden !important; }
    #ii-modal.open { display: flex; }
    /* header: tabs (left) · centered release (Zen) · bulk + config (right) */
    #ii-hdr { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
      padding: 6px 14px 0; background: #f8f9fa; border-bottom: 1px solid #dee2e6; flex-shrink: 0; }
    .ii-tabs { display: flex; gap: 2px; }
    .ii-tab { background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
      padding: 8px 16px 9px; font: 600 15px system-ui; color: #868e96; display: inline-flex; align-items: center; gap: 8px; }
    .ii-tab:hover { color: #6c757d; }
    .ii-tab.on { color: #6f42c1; border-bottom-color: #6f42c1; }
    .ii-tab-badge { font: 700 10px system-ui; background: #eceff2; color: #6c757d; border-radius: 9px; padding: 1px 6px; }
    .ii-tab-badge:empty { display: none; }
    .ii-tab.on .ii-tab-badge { background: #efe9fb; color: #6f42c1; }
    .ii-zen { text-align: center; padding-bottom: 7px; min-width: 0; }
    .ii-zen-t { font: 600 12px system-ui; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ii-zen-s { font: 10.5px system-ui; color: #c3c8ce; }
    .ii-hicons { display: flex; gap: 6px; justify-self: end; padding-bottom: 5px; }
    .ii-hico { width: 28px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid #e3e3e8; border-radius: 6px; background: #fff; color: #6c757d; font-size: 14px; cursor: pointer; }
    .ii-hico:hover { background: #f1f3f5; color: #6f42c1; border-color: #d6c7ee; }
    .ii-hico.on { background: #efe9fb; color: #6f42c1; border-color: #d6c7ee; }
    /* scope visibility — elements tagged .ii-only-isrc / .ii-only-links show with the active tab */
    #ii-modal.ii-scope-links .ii-only-isrc, #ii-modal.ii-scope-isrc .ii-only-links { display: none !important; }

    /* toolbar */
    #ii-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
      padding: 8px 16px; border-bottom: 1px solid #eee; flex-shrink: 0; background: #fbfbfd;
      position: relative; padding-right: 74px; }   /* reserve room so "Clear" stays pinned top-right and never wraps (#180) */
    #ii-clear-pending { position: absolute; top: 8px; right: 16px; }
    .ii-tbtn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px;
      font-size: 12px; font-weight: 600; border-radius: 5px; cursor: pointer; text-decoration: none;
      border: 1px solid #dee2e6; background: #fff; color: #343a40; white-space: nowrap; }
    a.ii-tbtn:hover { text-decoration: none; }
    .ii-tbtn:hover { background: #f1f3f5; }
    .ii-tbtn:disabled { opacity: .5; cursor: default; }
    .ii-tbtn.sx  { color: #6f42c1; border-color: #d6c7ee; }
    .ii-tbtn.dz  { color: #ef5466; border-color: #f5c2c8; }
    .ii-tbtn.sp  { color: #1db954; border-color: #b6e5c6; }
    .ii-tbtn.bp  { color: #0a8754; border-color: #9fe0c2; }
    .ii-tbtn.td  { color: #1f2d3d; border-color: #b5c2d0; }
    .ii-tbtn.vo  { color: #7c4dff; border-color: #cdbcff; }
    .ii-tbtn.hd  { color: #e63329; border-color: #f4b8b3; }
    /* import-source buttons: independently show icon and/or text (⚙ Setup).
       Default = icons only (toolbar room); both can be on at once. */
    .ii-bico { display: none; line-height: 0; }
    .ii-bico svg { display: block; }
    .ii-blabel { display: none; }
    #ii-tools.ii-show-icons .ii-bico { display: inline-flex; align-items: center; }
    #ii-tools.ii-show-text .ii-blabel { display: inline; }
    .ii-tbtn.primary { background: #198754; color: #fff; border-color: #198754; }
    .ii-tbtn.primary:hover { background: #157347; }
    .ii-tbtn.ghost { border-color: transparent; }
    /* #302: a small purple dot marks a provider whose link was pulled from another
       release in the group (not this release). Same dot on RG-sourced add candidates. */
    .ii-tbtn.ii-rg, .ii-tl.ii-rg { position: relative; }
    .ii-tbtn.ii-rg::after, .ii-tl.ii-rg::after { content: ''; position: absolute; top: -3px; right: -3px;
      width: 7px; height: 7px; border-radius: 50%; background: #6f42c1; border: 1.5px solid #fff; }
    /* In-MB marker (#180): a provider button gets a ring around its icon + a
       brand tint when the release already has that platform's URL in MB; an
       un-tinted/un-ringed button means the link was found by Platform Check. */
    #ii-tools.ii-show-icons .ii-tbtn.ii-mb .ii-bico {
      box-shadow: 0 0 0 1.5px currentColor; border-radius: 50%; padding: 2px; }
    .ii-tbtn.ii-mb { background: currentColor; }
    .ii-tbtn.ii-mb .ii-bico, .ii-tbtn.ii-mb .ii-blabel { filter: none; }
    .ii-tbtn.ii-mb .ii-blabel, #ii-tools.ii-show-icons .ii-tbtn.ii-mb .ii-bico svg { color: #fff; }
    .ii-tbtn.ii-mb .ii-blabel { color: #fff; }
    .ii-tbtn.ii-mb:hover { filter: brightness(1.08); }
    /* Unified "paste a URL" control (#180), apollo "+"-unroll style: a small
       round button that expands to an input on click; auto-detects the platform. */
    .ii-urladd { display: inline-flex; align-items: center; gap: 5px; }
    .ii-urladd.open { flex: 1 1 auto; min-width: 120px; }   /* expanded input fills the row (#180) */
    .ii-urladd-btn { display: inline-flex; align-items: center; justify-content: center;
      flex: 0 0 auto; width: 26px; height: 26px; padding: 0; border: 1px solid #ced4da; border-radius: 50%;
      background: #fff; color: #6c757d; cursor: pointer; font-size: 16px; line-height: 1; }
    .ii-urladd-btn:hover { background: #f1f3f5; border-color: #adb5bd; }
    .ii-urladd-btn svg { display: block; }
    .ii-urladd-input { display: none; padding: 4px 9px;
      border: 1px solid #ced4da; border-radius: 5px; font-size: 12px; }
    .ii-urladd-input:focus { outline: none; border-color: #6f42c1; }
    .ii-urladd.open .ii-urladd-input { display: inline-block; flex: 1 1 auto; width: auto; min-width: 0; }
    .ii-urladd.open .ii-urladd-btn { border-radius: 5px; }
    .ii-prog { font-size: 11px; color: #6c757d; min-width: 0; }
    .ii-prog.err { color: #dc3545; font-weight: 700; }
    .ii-prog.continue { color: #6f42c1; font-weight: 700; cursor: pointer; text-decoration: underline dotted; }
    .ii-prog.continue:hover { color: #5a32a3; }

    /* table */
    /* min-height:0 → the track list scrolls instead of pushing the footer out of
       the modal. !important guards against MusicBrainz's page CSS. */
    #ii-body { flex: 1 1 auto !important; min-height: 0 !important; overflow: auto !important;
      overscroll-behavior: contain;   /* scrolling to either end stays in the modal, never scrolls the page behind */
      padding: 0 0 56px 0; }   /* 56px bottom = room for the absolutely-pinned footer */
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
    /* #219/#301 — provider link icons live in the LINKED / ADD columns. Grey
       monochrome = already linked on MB; brand colour = resolved + addable. */
    .ii-tl-linked, .ii-tl-add { display: flex; align-items: center; gap: 9px; min-height: 18px; flex-wrap: wrap; }
    .ii-tl-add:empty::before, .ii-tl-linked:empty::before { content: '—'; color: #d0d4d9; }
    .ii-tl { display: inline-flex; align-items: center; line-height: 0; text-decoration: none; }
    .ii-tl svg { width: 16px; height: 16px; display: block; }
    .ii-tl.linked  { color: #adb5bd; }                                               /* already on MB → quiet monochrome */
    .ii-tl.linked:hover { color: #6c757d; }
    .ii-tl.linked.ended { opacity: .4; }                                             /* #341: relationship marked ended → faded */
    .ii-tl.linked.ended:hover { opacity: .7; }
    .ii-tl.new     { cursor: pointer; }                                              /* resolved, not linked → click to add (brand colour set inline) */
    .ii-tl.new:hover { filter: brightness(1.12); }
    .ii-tl.cand    { display: none; }                                               /* not resolved yet → hidden until Find links */
    .ii-tl.spin    { color: #ced4da; animation: ii-tl-pulse 1s ease-in-out infinite; }
    .ii-tl.removing { opacity: .35; animation: ii-tl-pulse 1s ease-in-out infinite; }
    .ii-tl.absent  { display: none; }                                                /* track not found on provider */
    @keyframes ii-tl-pulse { 0%,100% { opacity: .35; } 50% { opacity: .9; } }
    .ii-existing { width: 150px; }
    .ii-existing samp { display: block; font-size: 11px; font-weight: 700; color: #198754; font-family: 'Courier New', monospace; }
    .ii-existing samp.dup { color: #d63384; background: #ffe3ef; border-radius: 3px; padding: 0 3px; }
    .ii-existing .none { color: #ced4da; font-style: italic; font-size: 11px; }
    /* #159: highlight rows that still have no ISRC (no existing + nothing entered yet) */
    .ii-row-missing > td { background: #fff7e8; }
    .ii-row-missing > td:first-child { box-shadow: inset 3px 0 0 #f0ad4e; }
    .ii-row-missing .ii-existing .none { color: #d39e00; font-style: normal; font-weight: 600; }
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
    /* explicit per-track SoundExchange trigger (#157), sits next to +1 */
    .ii-sx { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 7px; border: 1px solid #cfd8e3;
      border-radius: 4px; background: #eef3fb; cursor: pointer; color: #2c5d9b; font-family: monospace; }
    .ii-sx:hover { background: #dde8f7; color: #1b3f6e; }
    .ii-sx:disabled { opacity: .4; cursor: default; }
    .ii-sx:disabled:hover { background: #eef3fb; color: #2c5d9b; }
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

    /* footer — pinned ABSOLUTELY to the modal's bottom (out of the flex flow) so it
       can never be pushed off, whatever the body does. The body reserves 56px of
       bottom padding for it. #ii-modal is position:fixed → it's the containing block. */
    #ii-foot { position: absolute !important; left: 0; right: 0; bottom: 0; z-index: 2;
      display: flex; align-items: center; gap: 10px; padding: 9px 16px; height: 56px; box-sizing: border-box;
      border-top: 1px solid #dee2e6; background: #f8f9fa; }
    #ii-foot .ii-summary { font-size: 12px; color: #495057; flex: 1; min-width: 0; }
    #ii-foot .ii-summary b { color: #212529; }
    .ii-seq-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; padding: 2px 9px;
      font-size: 11px; font-weight: 700; font-family: 'Courier New', monospace; color: #0f5132; background: #d1e7dd;
      border: 1px solid #a3cfbb; border-radius: 11px; vertical-align: middle; letter-spacing: .3px; }

    /* sub-panels (setup / bulk) */
    .ii-pane { display: none; padding: 14px 16px; border-bottom: 1px solid #eee; background: #fcfcfe; flex-shrink: 0; }
    /* an open pane scrolls internally past 45vh so it can never push the footer off */
    .ii-pane.open { display: block; max-height: 45vh; overflow-y: auto; overscroll-behavior: contain; }
    .ii-pane h3 { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .ii-pane-x { flex-shrink: 0; width: 19px; height: 19px; line-height: 1; padding: 0; font-size: 13px;
      color: #6c757d; background: #fff; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer; }
    .ii-pane-x:hover { background: #f1f3f5; color: #212529; border-color: #adb5bd; }
    /* #301 standard config-window header: icon · name · version · Log · ? Help */
    .ii-cfg-hdr { margin: -2px 0 4px !important; padding-bottom: 9px; border-bottom: 1px solid #e9ecef; font-size: 14px !important; }
    .ii-cfg-hdr .ii-logo { vertical-align: -4px; }
    .ii-cfg-name { font-weight: 700; color: #6f42c1; }
    .ii-cfg-ver { font: 400 11px system-ui; color: #adb5bd; }
    .ii-cfg-lnk { font: 600 12px system-ui; color: #6f42c1; text-decoration: none; cursor: pointer;
      background: none; border: none; padding: 2px 4px; }
    .ii-cfg-lnk:hover { text-decoration: underline; }
    .ii-cfg-grp { font: 700 10.5px system-ui; text-transform: uppercase; letter-spacing: .3px; color: #adb5bd; margin: 4px 0 6px; }
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
    .ii-sx-group { display: inline-flex; align-items: center; gap: 7px; padding: 3px 8px 3px 4px;
      border: 1px solid #e0d7f2; background: #faf8fe; border-radius: 7px; }
    /* per-track ISRC-provider selector (#181): a split [icon|▾] on each row's button */
    .ii-sxsplit { display: inline-flex; align-items: stretch; flex-shrink: 0; }
    .ii-sxsplit .ii-sx { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .ii-sxprov { display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; margin-left: -1px;
      font-size: 9px; color: #6c757d; background: #eef3fb; border: 1px solid #cfd8e3; border-left-color: #b9c6d8;
      border-top-right-radius: 5px; border-bottom-right-radius: 5px; cursor: pointer; }
    .ii-sxprov:hover { background: #dde8f7; color: #1b3f6e; }
    .ii-prov-menu { display: none; position: absolute; z-index: 60; flex-direction: column; min-width: 178px;
      padding: 4px; background: #fff; border: 1px solid #d6c7ee; border-radius: 7px; box-shadow: 0 6px 22px rgba(40,20,80,.18); }
    .ii-prov-menu.open { display: flex; }
    .ii-prov-item { display: flex; align-items: center; gap: 8px; padding: 6px 9px; font-size: 12px; font-weight: 600;
      color: inherit; background: none; border: 0; border-radius: 5px; cursor: pointer; text-align: left; }
    .ii-prov-item:hover { background: #f3eefc; }
    .ii-prov-item.active { background: #ece4fb; }
    .ii-prov-item.active::after { content: '✓'; margin-left: auto; color: #6f42c1; font-weight: 700; }
    .ii-prov-ico { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; }
    .ii-prov-ico svg { width: 16px; height: 16px; }
    .ii-prov-sx { font-size: 10px; font-weight: 800; color: #6f42c1; }
    .ii-prov-name { color: #343a40; }
    /* per-track button shows the chosen provider's icon */
    .ii-sx svg { width: 13px; height: 13px; display: block; }
    /* collapsible "exact" toggle — collapsed by default so the toolbar stays compact */
    .ii-exact-toggle { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; font-size: 11px;
      font-weight: 600; color: #8a7bb0; background: #fff; border: 1px solid #e0d7f2; border-radius: 5px; cursor: pointer; }
    .ii-exact-toggle:hover { background: #f3eefc; color: #6f42c1; }
    .ii-exact-toggle .ii-exact-car { font-size: 9px; transition: transform .15s; }
    .ii-sx-group:not(.collapsed) .ii-exact-toggle .ii-exact-car { transform: rotate(180deg); }
    /* a filled dot on the toggle when any exact option is active while collapsed */
    .ii-exact-toggle.on { color: #6f42c1; border-color: #c9b6ee; background: #f3eefc; }
    .ii-exact-toggle.on::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #6f42c1; }
    .ii-sx-group.collapsed .ii-exact-set { display: none; }
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
    .ii-sxp-results { flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 4px 13px 12px; display: flex; flex-direction: column; gap: 4px; }
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

    /* ──────────────────────────────────────────────────────────────────
       MOBILE / NARROW VIEWPORTS
       MusicBrainz serves width=device-width, so phones render the modal at
       ~96vw of a small viewport. The desktop header (title + tool buttons on
       ONE flex row) then squeezes the title into a one-word-wide column, and
       the fixed-width table (560px New-ISRC col) overflows horizontally.
       Below ~700px we grow the modal, stack the header, turn every track row
       into a full-width card, and let the toolbar/footer wrap.
       ────────────────────────────────────────────────────────────────── */
    @media (max-width: 700px) {
      /* Keep the modal CENTERED (inherit the base left:50% + translateX). Do
         NOT pin it to 0,0 / 100vw: on tablets where MusicBrainz's desktop
         layout overflows a narrow layout-viewport, a position:fixed 100vw /
         left:0 modal is sized to the layout viewport and lands in the top-left
         corner instead of filling the screen. A centered 96vw × 96vh dialog
         reads correctly everywhere. */
      #ii-modal {
        top: 2vh !important;
        width: 96vw !important; max-width: 96vw !important;
        height: 96vh !important; max-height: 96vh !important; }
      @supports (height: 100dvh) {
        #ii-modal { height: 96dvh !important; max-height: 96dvh !important; } }

      /* header: title gets its own row (subtitle truncates), tool buttons wrap
         below it, close pinned to the top-right corner */
      #ii-hdr { flex-wrap: wrap; position: relative; padding: 10px 12px 8px; gap: 6px; }
      #ii-hdr h2 { flex: 1 1 100%; font-size: 14px; padding-right: 30px; min-width: 0;
        display: flex; align-items: center; }
      #ii-hdr h2 em { white-space: nowrap; flex-shrink: 0; }
      #ii-hdr .ii-sub { flex: 1 1 auto; min-width: 0; margin-left: 6px; font-size: 12px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #ii-hdr .ii-tbtn { font-size: 11px; padding: 4px 9px; }
      #ii-close { position: absolute; top: 5px; right: 9px; font-size: 22px; padding: 2px 6px; }

      /* toolbar: tighten, keep "Clear entered" pushed to the right */
      #ii-tools { padding: 7px 12px; gap: 5px; }
      .ii-exact-set { gap: 7px; }

      /* table → one full-width card per track row (CSS-only, no DOM change) */
      #ii-table { display: block; }
      #ii-table thead, #ii-table colgroup { display: none; }
      #ii-table tbody { display: block; }
      #ii-table tr:not(.ii-medrow) {
        display: grid; grid-template-columns: 24px 1fr auto; align-items: start;
        column-gap: 8px; row-gap: 4px; padding: 9px 12px; border-bottom: 1px solid #e9ecef; }
      #ii-table tr:not(.ii-medrow) > td { display: block; border: none !important; padding: 0; }
      #ii-table .ii-pos { grid-column: 1; grid-row: 1; }
      #ii-table tr > td:nth-child(2) { grid-column: 2; grid-row: 1; }            /* track  */
      #ii-table .ii-track-dur { grid-column: 3; grid-row: 1; text-align: right; }
      #ii-table .ii-existing { grid-column: 2 / 4; grid-row: 2; width: auto; }
      #ii-table tr > td:nth-child(5) { grid-column: 2 / 4; grid-row: 3; }        /* New ISRC */
      #ii-table tr.ii-medrow { display: block; }
      #ii-table tr.ii-medrow td { display: block; }
      /* paint the whole card (not just cells, which would leave striped gaps) */
      #ii-table tr.ii-row-missing { background: #fff7e8; box-shadow: inset 3px 0 0 #f0ad4e; }
      #ii-table tr.ii-row-missing > td { background: transparent; box-shadow: none; }
      /* let the New-ISRC input grow to the card width; candidates span it */
      .ii-input-box { flex: 1 1 auto; width: auto; min-width: 0; }
      .ii-inwrap { flex-wrap: wrap; }
      .ii-cands { width: 100%; }

      /* footer wraps: summary on its own line, action buttons below it */
      #ii-foot { height: auto; min-height: 52px; flex-wrap: wrap; padding: 8px 12px; gap: 6px; }
      #ii-foot .ii-summary { flex: 1 1 100%; font-size: 11.5px; }
      #ii-foot .ii-tbtn { font-size: 11px; padding: 6px 10px; flex: 0 1 auto; }
      #ii-body { padding-bottom: 108px; }   /* clear the taller wrapped footer */

      /* secondary panels: keep them on-screen */
      #ii-sxpanel { top: 2vh !important; left: 2vw !important; right: 2vw !important;
        width: auto !important; max-width: none !important; max-height: 92vh !important; }
    }
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

  // Recognise an album/release provider link → { k: RELEASE field, v: id/url }, or
  // null. One place so the per-release parse and the release-group scan (#302) agree.
  function matchProviderLink(u) {
    let m;
    if ((m = u.match(/^https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[^?#]+/i))) return { k: 'bandcampUrl', v: m[0] };  // #300: per-track URLs by position
    if ((m = u.match(/^(https?:\/\/music\.apple\.com\/[a-z]{2}\/album\/(?:[^/?#]+\/)?\d+)/i))) return { k: 'appleUrl', v: m[1] };  // album page ld+json lists every track URL
    if ((m = u.match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/)))            return { k: 'spotifyId', v: m[1] };
    if ((m = u.match(/deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/)))             return { k: 'deezerId', v: m[1] };
    if ((m = u.match(/beatport\.com\/release\/[^/]+\/(\d+)/)))                 return { k: 'beatportId', v: m[1] };
    if ((m = u.match(/(?:listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/)))   return { k: 'tidalId', v: m[1] };
    if ((m = u.match(/volumo\.com\/album\/(\d+)/)))                            return { k: 'volumoId', v: m[1] };   // id or leading ICPN
    // HDtracks: new #/album/<24-hex ObjectId> resolves directly; legacy 5009 rels carry the
    // UPC in valbum_code (fetchHDtracks resolves it via barcode search). Slug-id / artist-page
    // legacy forms have no clean id mapping and are skipped (Platform Check handles by barcode).
    if ((m = u.match(/hdtracks\.com\/(?:#\/)?album\/([a-f0-9]{24})/i)))        return { k: 'hdtracksId', v: m[1] };
    if ((m = u.match(/hdtracks\.com\/[^?]*[?&]valbum_code=(\d{8,})/i)))        return { k: 'hdtracksId', v: m[1] };
    return null;
  }

  const rgProvidersEnabled = () => !!store.get('rg_providers', false);
  // #314: by default respect Platform Check's link confidence — don't import from a
  // PC link it withheld by a barcode/format mismatch (it can be a wrong release).
  // Opt in to the old #211 behaviour (use it anyway) with this toggle.
  const ignorePcConfidence = () => !!store.get('ignore_pc_confidence', false);

  // #302: releases in a release group are often split by platform (one has Deezer,
  // another Spotify, …). ISRC and track-link edits target recordings, which are
  // shared across the RG — so, when the option is on, fill any provider link the
  // current release lacks from its sibling releases (one browse, fill-if-empty).
  async function augmentProvidersFromRG(rgId) {
    if (!rgId) return;
    try {
      const r = await gmGet(MB_WS2 + 'release?release-group=' + rgId + '&inc=url-rels&limit=100&fmt=json', { 'Accept': 'application/json', 'User-Agent': UA });
      if (r.status !== 200) { Log.warn('Release group: sibling scan gave ' + r.status); return; }
      const j = JSON.parse(r.responseText || '{}');
      const added = [];
      RELEASE.rgFrom = RELEASE.rgFrom || {};   // provider field -> { release, title } it was pulled from (#302)
      (j.releases || []).forEach(rel => {
        if (rel.id === mbid) return;
        (rel.relations || []).forEach(rl => {
          const u = rl.url && rl.url.resource; if (!u) return;
          const hit = matchProviderLink(u);
          if (hit && !RELEASE[hit.k]) { RELEASE[hit.k] = hit.v; RELEASE.rgFrom[hit.k] = { release: rel.id, title: rel.title || '' }; added.push(hit.k.replace(/Id|Url$/, '')); }
        });
      });
      if (added.length) Log.info('Release group: pulled provider links from sibling releases — ' + [...new Set(added)].join(', '));
      else Log.info('Release group: no extra provider links on sibling releases');
    } catch (e) { Log.warn('Release group provider scan failed: ' + errText(e)); }
  }

  function fetchRelease() {
    return gmGet(
      // recording-level-rels folds each recording's URL relationships into this one
      // call (same data the overview's "Display credits inline" shows) — so the
      // #219 track-link icons know what's already linked with no extra request.
      MB_WS2 + 'release/' + mbid + '?inc=recordings+artist-credits+isrcs+url-rels+recording-level-rels+release-groups&fmt=json',
      { 'Accept': 'application/json', 'User-Agent': UA }
    ).then(async r => {
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
            recUrls:   (rec.relations || []).map(rel => rel.url && rel.url.resource).filter(Boolean),   // #219: existing url rels on the recording
            endedUrls: new Set((rec.relations || []).filter(rel => rel.url && rel.url.resource && rel.ended).map(rel => rel.url.resource)),   // #341: url rels already marked ended → render faded
            pending:   '',
          });
        });
      });
      const rels = data.relations || [];
      const prov = { deezerId: null, spotifyId: null, beatportId: null, tidalId: null, volumoId: null, hdtracksId: null, bandcampUrl: null, appleUrl: null };
      rels.forEach(rel => {
        const u = rel.url && rel.url.resource;
        if (!u) return;
        const hit = matchProviderLink(u);
        if (hit && !prov[hit.k]) prov[hit.k] = hit.v;   // first match per provider
      });
      // THIS release's year — what the header shows AND what the SX "recording newer
      // than the release" check uses. Prefer the release's own date; only fall back to
      // the release-group's first-release-date when this release has no date. (Using
      // the RG-earliest here was wrong for reissues: a 2025 reissue of 2002 material
      // would reject legitimate later recordings.)
      const rg = data['release-group'] || {};
      const rgYear = parseInt((String(rg['first-release-date'] || '').match(/^(\d{4})/) || [])[1]) || null;
      const releaseYear = parseInt((String(data.date || '').match(/^(\d{4})/) || [])[1]) || rgYear;
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
      RELEASE = Object.assign({ title: data.title || '', tracks, rgId: rg.id || '', releaseYear, artist }, prov);
      // #302: when enabled, fill missing provider links from sibling releases in the RG.
      if (rgProvidersEnabled() && RELEASE.rgId) await augmentProvidersFromRG(RELEASE.rgId);
      const _pf = { bandcamp: 'bandcampUrl', apple: 'appleUrl' };
      const linkStr = ['deezer', 'spotify', 'beatport', 'tidal', 'volumo', 'hdtracks', 'bandcamp', 'apple']
        .map(k => { const f = _pf[k] || k + 'Id'; return RELEASE[f] ? k[0].toUpperCase() + k.slice(1) + ' ' + RELEASE[f] : null; }).filter(Boolean).join(', ');
      Log.info('Release "' + RELEASE.title + '"' + (releaseYear ? ' (' + releaseYear + ')' : '') + ': ' + tracks.length + ' track(s), ' +
        tracks.filter(t => !t.existing.length).length + ' missing ISRC' + (linkStr ? '; links: ' + linkStr : ''));
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
        // 429 = rate limited. The body isn't JSON, so without this it fell through to the
        // generic "SX parse error" below — masking the real cause. Surface a typed error so
        // callers can stop the batch and show the right message. #126
        if (r.status === 429) { const e = new Error('SoundExchange rate limit (HTTP 429)'); e.rateLimited = true; throw e; }
        let p; try { p = JSON.parse(r.responseText); } catch (e) { throw new Error('SX parse error'); }
        // After too many requests SoundExchange serves a captcha: HTTP 202 with
        // body {"searchCaptcha": true}. It's NOT an empty result — caching it as
        // "not found" left rows permanently stuck. Surface a typed error so
        // callers pause (like a rate limit) and prompt the user to solve it. #157
        if (p && p.searchCaptcha) { const e = new Error('SoundExchange captcha'); e.captcha = true; throw e; }
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

  /* ═══════════════════════════════════════════════════════════════════════
     TRACK ISRC PROVIDER (#181) — each per-track [SX] button is a by-ISRC lookup:
     it takes the row's ISRC (entered or existing) and looks it up on the selected
     provider, showing that track's metadata next to the row. It ONLY searches —
     it never fills the field. The choice is GLOBAL for the release and NOT
     remembered (resets to SoundExchange on each load). The ▾ on each button opens
     the provider menu; the bulk "⟳ SoundExchange" button is left untouched.
       • SoundExchange + Deezer + Tidal: global by-ISRC endpoints — offered on any
         release (no album link needed).
       • Beatport / Volumo / HDtracks: read the release's album ONCE (cached) and
         match by ISRC, so they need the album's link (MB rel or Platform Check).
  ═══════════════════════════════════════════════════════════════════════ */
  // Album-based providers — same fetchers the import buttons use. `idField` is the
  // RELEASE property holding the in-MB album id; availability also honours a
  // Platform-Check-found URL (via providerAlbumId).
  // Spotify is intentionally absent: its only by-ISRC route is the Web API
  // `isrc:` search, which needs an app token (no free anonymous one), so it can't
  // be a per-track ISRC provider. (Spotify stays a bulk import button via ISRC Hunt.)
  const ALBUM_PROVIDERS = {
    deezer:   { source: 'Deezer',   idField: 'deezerId',   fetcher: fetchDeezer,   code: 'dz' },
    beatport: { source: 'Beatport', idField: 'beatportId', fetcher: fetchBeatport, code: 'bp' },
    tidal:    { source: 'Tidal',    idField: 'tidalId',    fetcher: fetchTidal,    code: 'td' },
    volumo:   { source: 'Volumo',   idField: 'volumoId',   fetcher: fetchVolumo,   code: 'vo' },
    hdtracks: { source: 'HDtracks', idField: 'hdtracksId', fetcher: fetchHDtracks, code: 'hd' },
  };
  const _PROV_COLOR = { sx: '#6f42c1', deezer: '#ef5466', spotify: '#1db954', beatport: '#0a8754', tidal: '#1f2d3d', volumo: '#7c4dff', hdtracks: '#e63329', bandcamp: '#1da0c3', apple: '#fc3c44' };
  const TRACK_PROV = { sx: { name: 'SoundExchange', short: 'SX', code: 'sx', color: _PROV_COLOR.sx, kind: 'search' } };
  Object.keys(ALBUM_PROVIDERS).forEach(k => {
    const p = ALBUM_PROVIDERS[k];
    // `global` providers have a by-ISRC endpoint that doesn't need the album link
    // (Deezer: /track/isrc:<isrc>; Tidal: /tracks?filter[isrc]), so they're offered
    // on any release. The rest scan the release's album, so they need its link.
    TRACK_PROV[k] = { name: p.source, short: p.source, code: p.code, color: _PROV_COLOR[k] || '#444', kind: 'album', global: k === 'deezer' || k === 'tidal' };
  });
  const TRACK_PROV_ORDER = ['sx', 'deezer', 'tidal', 'beatport', 'volumo', 'hdtracks'];
  let trackProv = 'sx';                                  // NOT persisted (#181)
  const TPM = () => TRACK_PROV[trackProv];
  // a provider is offered only when it can resolve a source for THIS release
  // (SoundExchange always; an album provider needs an MB link or a PC-found URL).
  function trackProvAvailable(key) {
    if (key === 'sx') return true;
    if (TRACK_PROV[key] && TRACK_PROV[key].global) return true;   // global by-ISRC — no link needed
    const p = ALBUM_PROVIDERS[key];
    return !!(p && RELEASE && providerAlbumId(p.source, RELEASE[p.idField]));
  }
  // The per-track button looks up an ISRC, so it needs one: enabled when the row
  // has a valid entered ISRC or an existing one (uniform across all providers).
  function trackBtnDisabled(t, inputVal) {
    return !(isValidIsrc(normalizeIsrc(inputVal)) || (t && t.existing && t.existing.length));
  }

  // Fetch the selected album provider's whole tracklist ONCE (all batches), keyed
  // per provider for the session. Returns the collected per-track ISRC entries.
  const _provAlbumEntries = {};
  const _provAlbumPromise = {};
  function ensureProvAlbum(key) {
    if (_provAlbumEntries[key]) return Promise.resolve(_provAlbumEntries[key]);
    if (_provAlbumPromise[key]) return _provAlbumPromise[key];
    const p = ALBUM_PROVIDERS[key];
    const id = providerAlbumId(p.source, RELEASE[p.idField]);
    if (!id) return Promise.reject(new Error('no ' + p.source + ' link on this release'));
    const entries = [];
    _provAlbumPromise[key] = (async () => {
      let cursor = 0, guard = 0;
      while (guard++ < 50) {
        const res = await p.fetcher(id, () => {}, s => { if (s && s.isrc) entries.push(s); }, cursor);
        if (!res || res.next == null) break;
        cursor = res.next;
      }
      _provAlbumEntries[key] = entries; delete _provAlbumPromise[key];
      return entries;
    })().catch(e => { delete _provAlbumPromise[key]; throw e; });
    return _provAlbumPromise[key];
  }
  // Single-track by-ISRC lookup on a provider → a fields-shaped object
  // {isrc,title,artist,year,dur,relTitle} carrying all the meta the provider
  // exposes, or null. Deezer has a global by-ISRC endpoint (no album needed); the
  // album-only providers scan the release's album for a track whose ISRC matches
  // (still keyed off the ISRC, never the position). SoundExchange uses lookupIsrc.
  async function providerLookupByIsrc(key, isrc) {
    if (key === 'deezer') {
      const r = await gmGet('https://api.deezer.com/track/isrc:' + encodeURIComponent(isrc), { 'Accept': 'application/json' });
      if (r.status !== 200) return null;
      let j; try { j = JSON.parse(r.responseText || 'null'); } catch (e) { return null; }
      if (!j || j.error || !normalizeIsrc(j.isrc || '')) return null;
      const arts = [(j.artist && j.artist.name)].concat((j.contributors || []).map(c => c && c.name)).filter(Boolean);
      return { isrc: normalizeIsrc(j.isrc), title: j.title_short || j.title || '', artist: [...new Set(arts)].join(', '),
        year: '', dur: j.duration ? msToMmSs(j.duration * 1000) : '', relTitle: (j.album && j.album.title) || '' };
    }
    if (key === 'tidal') return await tidalLookupByIsrc(isrc);
    // album-scoped providers (HDtracks / Volumo / Beatport):
    // fetch the release's album once and match the entry by ISRC.
    const entries = await ensureProvAlbum(key);
    const e = entries.find(s => normalizeIsrc(s.isrc) === isrc);
    return e ? { isrc, title: e.title || '', artist: e.artist || '', year: '', dur: e.dur || '', relTitle: '' } : null;
  }
  // Per-track ISRC lookup on the selected album provider — shows the provider's
  // meta for the clicked track's ISRC, rendered like a SoundExchange result. It
  // looks up ONLY that ISRC and NEVER fills the field.
  async function lookupRowOnProvider(idx, isrc) {
    const t = RELEASE.tracks[idx], m = TPM(), el = rowLookup(idx);
    if (el) { el.onclick = null; el.className = 'ii-lookup spin'; el.textContent = '⏳ ' + m.name + '…'; }
    try {
      const f = await providerLookupByIsrc(trackProv, isrc);
      if (!f) {
        if (el) { el.className = 'ii-lookup err'; el.textContent = '✗ ' + isrc + ' not found on ' + m.name; }
        Log.info(m.name + ' ' + isrc + ' (#' + (t.number || t.trackPos) + '): not found');
        return;
      }
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.releaseYear);
      const good = cls === 'best';
      const rel = [f.relTitle, f.relLabel, f.relDate].filter(Boolean).join(' · ');
      if (el) {
        el.className = 'ii-lookup ' + (good ? 'ok' : 'warn');
        el.innerHTML = (good ? '✓ ' : '⚠ ') + sxMetaHtml(f, t) + (rel ? '<br><span class="ii-lookup-rel">' + esc(rel) + '</span>' : '');
        el.title = [f.title, f.artist, f.year, f.dur].filter(Boolean).join(' · ') + (rel ? '  |  ' + rel : '');
      }
      Log.info(m.name + ' ' + isrc + ' (#' + (t.number || t.trackPos) + '): "' + f.title + '"' + (f.artist ? ' — ' + f.artist : ''));
    } catch (err) {
      if (err && err.rateLimited) {   // 429 that didn't clear after back-off — NOT "not found"
        if (el) { el.className = 'ii-lookup warn'; el.textContent = '⚠ ' + m.name + ' rate-limited — retry'; }
        Log.warn(m.name + ' ' + isrc + ' (#' + (t.number || t.trackPos) + '): rate-limited (HTTP 429)');
      } else {
        if (el) { el.className = 'ii-lookup err'; el.textContent = '✗ ' + m.name + ' failed'; }
        Log.err(m.name + ' lookup failed: ' + errText(err));
      }
    }
  }
  // the ISRC a per-track button acts on: the entered value if valid, else the
  // first existing ISRC on the recording.
  function rowIsrc(idx) {
    const t = RELEASE.tracks[idx], input = rowInput(idx);
    const v = normalizeIsrc(input ? input.value : '');
    return (v && isValidIsrc(v)) ? v : ((t && t.existing && t.existing[0]) || '');
  }
  // The per-track button looks up the clicked track's ISRC on the current
  // provider and shows the result next to the row — it never fills the field.
  function runTrackSingle(idx) {
    const isrc = rowIsrc(idx);
    if (!isrc) return;                       // nothing to look up (button is disabled)
    if (trackProv === 'sx') { lookupIsrc(idx, isrc).catch(e => { if (e && (e.rateLimited || e.captcha)) sxBlocked(e); }); return; }
    lookupRowOnProvider(idx, isrc);
  }
  // Right-click → look up EVERY track's ISRC on the current provider, shown next
  // to each row. SoundExchange routes through its rate-limit/captcha-aware path
  // (serialized + paced); album providers reuse the album fetched on the first.
  async function runTrackAll() {
    const m = TPM();
    const myEpoch = _sxEpoch;   // closing the popup or hitting Clear bumps this (via abortSxWork) → bail the bulk run so it doesn't keep fetching (e.g. Tidal) in the background
    const todo = [];
    RELEASE.tracks.forEach((t, idx) => { const isrc = rowIsrc(idx); if (isrc) todo.push({ idx, isrc }); });
    Log.info(m.name + ': looking up ' + todo.length + ' track(s) with an ISRC');
    for (let k = 0; k < todo.length; k++) {
      if (myEpoch !== _sxEpoch) { Log.info(m.name + ': bulk lookup cancelled'); return; }   // popup closed / Clear → stop issuing requests
      const { idx, isrc } = todo[k];
      if (trackProv === 'sx') {
        const cached = !!_isrcLookupCache[isrc];
        try { await lookupIsrc(idx, isrc); }
        catch (e) { if (e && (e.rateLimited || e.captcha)) { sxBlocked(e); return; } }
        if (!cached && k < todo.length - 1) await sleep(BATCH_DELAY);   // pace only real requests
      } else {
        try { await lookupRowOnProvider(idx, isrc); }
        catch (e) { Log.err(m.name + ': ' + errText(e)); }
        // Tidal makes a real request per track, so pace them (album providers reuse one
        // cached fetch and don't need it). Combined with tidalGet's back-off, this keeps
        // a bulk pass under the rate limit instead of 429-ing the tail. #tidal-429
        if (trackProv === 'tidal' && k < todo.length - 1) await sleep(TIDAL_TRACK_DELAY);
      }
    }
  }

  // Re-skin EVERY per-track button to the chosen provider (global, not persisted).
  // The bulk "⟳ SoundExchange" toolbar button is intentionally left untouched.
  function setTrackProvider(key) {
    if (!TRACK_PROV[key] || !trackProvAvailable(key)) return;
    trackProv = key;
    const m = TPM();
    const provGlyph = (m.code !== 'sx' && SRC_ICON[m.code]) ? SRC_ICON[m.code] : null;
    modal.querySelectorAll('.ii-sx').forEach(b => {
      b.dataset.prov = key;
      b.innerHTML = provGlyph || m.short;
      b.title = (m.kind === 'album'
        ? ('Look up this track’s ISRC on ' + m.name)
        : 'Look up this track’s ISRC on SoundExchange — verify the entered ISRC, or (if empty) search by title/artist')
        + '  ·  right-click: do all tracks';
      b.style.color = m.kind === 'album' ? m.color : '';
    });
    RELEASE.tracks.forEach((t, i) => {
      const b = tbody.querySelector('tr[data-idx="' + i + '"] .ii-sx');
      if (b) { const inp = rowInput(i); b.disabled = trackBtnDisabled(t, inp ? inp.value : ''); }
    });
    Log.info('Track ISRC provider → ' + m.name);
  }
  // Build the provider dropdown (only the providers available for this release).
  function buildProvMenu() {
    const menu = modal.querySelector('#ii-prov-menu');
    if (!menu) return;
    menu.innerHTML = '';
    TRACK_PROV_ORDER.filter(trackProvAvailable).forEach(key => {
      const m = TRACK_PROV[key];
      const glyph = (m.code !== 'sx' && SRC_ICON[m.code]) ? SRC_ICON[m.code] : '<span class="ii-prov-sx">SX</span>';
      const it = document.createElement('button');
      it.type = 'button';
      it.className = 'ii-prov-item' + (key === trackProv ? ' active' : '');
      it.style.color = m.color;
      it.innerHTML = '<span class="ii-prov-ico">' + glyph + '</span><span class="ii-prov-name">' + m.name + '</span>';
      it.addEventListener('click', () => { setTrackProvider(key); closeProvMenu(); });
      menu.appendChild(it);
    });
  }
  // Open the shared menu anchored beneath the clicked per-track ▾ caret.
  function openProvMenu(anchor) {
    buildProvMenu();
    const menu = modal.querySelector('#ii-prov-menu');
    if (!menu) return;
    menu.classList.add('open');
    if (anchor && menu.offsetParent) {
      const a = anchor.getBoundingClientRect();
      const p = menu.offsetParent.getBoundingClientRect();
      let left = a.left - p.left;
      left = Math.min(left, menu.offsetParent.clientWidth - menu.offsetWidth - 8);
      menu.style.left = Math.max(8, left) + 'px';
      menu.style.top = (a.bottom - p.top + 4) + 'px';
    }
  }
  function closeProvMenu() {
    const menu = modal.querySelector('#ii-prov-menu');
    if (menu) menu.classList.remove('open');
  }

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
     BEATPORT  (Cloudflare-walled → harvested in a brief tab; the harvester at
     the top of the script fills GM storage, which we read back here.)
  ═══════════════════════════════════════════════════════════════════════ */
  function readBeatportHarvest(id) {
    try {
      const h = store.get('beatport_harvest_' + id, '');
      const o = h ? (typeof h === 'string' ? JSON.parse(h) : h) : null;
      return (o && Array.isArray(o.tracks)) ? o : null;
    } catch (e) { return null; }
  }

  // Beatport official API — used only when the user has logged in via Platform Check
  // (the token is shared through a musicbrainz.org localStorage key). When present it's
  // a clean one-call fetch with no tab; otherwise we fall back to the tab-harvest below.
  const BEATPORT = { clientId: '0GIvkCltVIuPkkwSJHp6NDb3s0potTjLBQr388Dd', api: 'https://api.beatport.com/v4', lsKey: 'mbtools:beatport' };
  const bpRead  = () => { try { return JSON.parse(localStorage.getItem(BEATPORT.lsKey) || 'null'); } catch (e) { return null; } };
  const bpWrite = t  => { try { t ? localStorage.setItem(BEATPORT.lsKey, JSON.stringify(t)) : localStorage.removeItem(BEATPORT.lsKey); } catch (e) {} };
  async function beatportToken() {
    const t = bpRead();
    if (!t || !t.refresh_token) return null;
    if (t.access_token && Date.now() < t.exp - 60000) return t.access_token;
    const r = await gmPost(BEATPORT.api + '/auth/o/token/',
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: BEATPORT.clientId }).toString(),
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    let j; try { j = JSON.parse(r.responseText || '{}'); } catch (e) { j = {}; }
    if (!j.access_token) { Log.warn('Beatport: token refresh failed — re-login in Platform Check ⚙'); return null; }
    bpWrite({ access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token, exp: Date.now() + ((j.expires_in || 36000) * 1000) });
    return j.access_token;
  }
  // Returns track entries from the API, or null if not logged in / no usable data.
  // ISRCs live on the /tracks/ sub-endpoint — the release-detail's embedded `tracks`
  // array omits them (that's why an earlier build saw 0 ISRCs and fell back to the tab).
  async function fetchBeatportApi(releaseId, onProgress, onIsrc) {
    const tok = await beatportToken();
    if (!tok) return null;
    Log.info('Beatport: logged in — fetching release ' + releaseId + ' via the API (no tab)');
    const headers = { 'Authorization': 'Bearer ' + tok, 'Accept': 'application/json' };
    const list = [];
    let url = BEATPORT.api + '/catalog/releases/' + releaseId + '/tracks/?per_page=100';
    let guard = 0;
    while (url && guard++ < 20) {
      const r = await gmGet(url, headers);
      if (r.status !== 200) { Log.warn('Beatport API ' + r.status + ' for release ' + releaseId + ' — falling back to tab harvest'); return null; }
      let d; try { d = JSON.parse(r.responseText || '{}'); } catch (e) { return null; }
      (d.results || d.tracks || []).forEach(t => list.push(t));
      url = d.next || null;   // DRF pagination returns an absolute next URL
    }
    if (!list.length) { Log.warn('Beatport API: release had no tracks — falling back to tab harvest'); return null; }
    let withIsrc = 0;
    list.forEach((t, i) => {
      const mix = t.mix_name && !/^original mix$/i.test(t.mix_name) ? ' (' + t.mix_name + ')' : '';
      const e = {
        isrc:   normalizeIsrc(t.isrc || ''),
        title:  (t.name || '') + mix,
        artist: (t.artists || []).map(a => a && a.name).filter(Boolean).join(', '),
        disc:   1,
        pos:    t.number || (i + 1),
        dur:    t.length || (t.length_ms ? msToMmSs(t.length_ms) : ''),
        url:    (t.slug && t.id) ? 'https://www.beatport.com/track/' + t.slug + '/' + t.id : '',   // #387 per-track link
      };
      try { if (onIsrc && isValidIsrc(e.isrc)) { onIsrc(e); withIsrc++; } } catch (err) { Log.warn('Beatport map hiccup for ' + e.isrc + ': ' + errText(err)); }
      try { if (onProgress) onProgress(i + 1, list.length); } catch (err) {}
    });
    Log.info('Beatport API: ' + withIsrc + '/' + list.length + ' track(s) carried an ISRC');
    if (!withIsrc) return null;   // nothing usable → let the tab-harvest try
    return { total: list.length, next: null };
  }
  async function fetchBeatport(releaseId, onProgress, onIsrc) {
    if (onProgress) onProgress(0, 0);
    const viaApi = await fetchBeatportApi(releaseId, onProgress, onIsrc);   // logged-in fast path (no tab)
    if (viaApi) return viaApi;
    let h = readBeatportHarvest(releaseId);
    if (h) {
      Log.info('Beatport: using harvested data for release ' + releaseId + ' (' + h.tracks.length + ' track(s))');
    } else {
      Log.info('Beatport: opening release ' + releaseId + ' in a background tab to harvest ISRCs (Cloudflare blocks a direct fetch)');
      store.del('beatport_harvest_' + releaseId);
      // Tell the harvester (running in the tab we're about to open) that THIS
      // tab is ours to close once it's done — so the harvester never closes a
      // Beatport tab the user opened themselves.
      store.set('beatport_close_' + releaseId, Date.now());
      const url = 'https://www.beatport.com/release/-/' + releaseId;
      let tab = null;
      try {
        tab = (typeof GM_openInTab === 'function')
          ? GM_openInTab(url, { active: false, insert: true, setParent: true })
          : window.open(url, '_blank');
      } catch (e) { tab = window.open(url, '_blank'); }
      const t0 = Date.now();
      while (Date.now() - t0 < 60000) {
        await sleep(500);
        h = readBeatportHarvest(releaseId);
        if (h) break;
      }
      try { if (tab && typeof tab.close === 'function') tab.close(); } catch (e) {}
      store.del('beatport_close_' + releaseId);   // clear the flag whether we succeeded or timed out
      if (!h) throw new Error('Beatport harvest timed out — the tab may have hit a Cloudflare check. Open the release on beatport.com once, then retry.');
    }
    const rows = h.tracks;
    rows.forEach((e, i) => {
      try { if (onIsrc && isValidIsrc(e.isrc)) onIsrc(e); } catch (err) { Log.warn('Beatport map hiccup for ' + e.isrc + ': ' + errText(err)); }
      try { if (onProgress) onProgress(i + 1, rows.length); } catch (err) {}
    });
    const withIsrc = rows.filter(e => isValidIsrc(e.isrc)).length;
    Log.info('Beatport: ' + withIsrc + '/' + rows.length + ' track(s) carried an ISRC');
    if (!withIsrc) throw new Error('Beatport release exposed no ISRCs');
    return { total: rows.length, next: null };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TIDAL  (official API; app token via client-credentials — no user login)
  ═══════════════════════════════════════════════════════════════════════ */
  async function tidalToken() {
    const tok = store.get('tidal_token', ''), exp = store.get('tidal_token_exp', 0);
    if (tok && Date.now() < exp - 60000) return tok;
    const basic = btoa(TIDAL.clientId + ':' + TIDAL.clientSecret);
    const r = await gmPost(TIDAL.tokenUrl, 'grant_type=client_credentials',
      { 'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' });
    const j = JSON.parse(r.responseText || '{}');
    if (!j.access_token) throw new Error('Tidal auth failed (' + r.status + ')' + (j.error ? ': ' + j.error : ''));
    store.set('tidal_token', j.access_token);
    store.set('tidal_token_exp', Date.now() + ((j.expires_in || 14400) * 1000));
    return j.access_token;
  }
  function isoDurToMmSs(iso) {
    const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return '';
    const sec = (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
    return sec ? msToMmSs(sec * 1000) : '';
  }
  // Tidal's openapi is aggressively rate-limited (HTTP 429). On a 429, back off —
  // honouring a Retry-After header when present, else exponential — and retry, so a
  // throttled request RECOVERS instead of looking like "not found". Only throws a
  // typed `rateLimited` error when it never clears, so the caller can say so.
  const TIDAL_MAX_RETRY = 4;
  function retryAfterMs(r, fallback) {
    const m = /retry-after:\s*([0-9.]+)/i.exec((r && r.responseHeaders) || '');
    const s = m ? parseFloat(m[1]) : NaN;
    return (s > 0) ? Math.min(s * 1000, 30000) : fallback;
  }
  async function tidalGet(url, headers) {
    for (let attempt = 0; ; attempt++) {
      const r = await gmGet(url, headers);
      if (r.status !== 429) return r;
      if (attempt >= TIDAL_MAX_RETRY) { const e = new Error('Tidal rate limit (HTTP 429)'); e.rateLimited = true; throw e; }
      const wait = retryAfterMs(r, Math.min(800 * Math.pow(2, attempt), 8000));
      Log.warn('Tidal 429 — backing off ' + wait + 'ms (retry ' + (attempt + 1) + '/' + TIDAL_MAX_RETRY + ')');
      await sleep(wait);
    }
  }
  async function fetchTidal(albumId, onProgress, onIsrc) {
    if (onProgress) onProgress(0, 0);
    const token = await tidalToken();
    const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.api+json' };
    let path = '/albums/' + albumId + '/relationships/items?countryCode=' + TIDAL.country + '&include=items';
    const rows = [];
    let guard = 0;
    while (path && guard++ < 50) {
      const r = await tidalGet(TIDAL.api + path, headers);
      if (r.status !== 200) throw new Error('Tidal ' + r.status + ' for album ' + albumId + (r.status === 404 ? ' (not found / region-locked)' : ''));
      const j = JSON.parse(r.responseText || '{}');
      const inc = {};
      (j.included || []).forEach(x => { if (x.type === 'tracks') inc[x.id] = x.attributes || {}; });
      (j.data || []).forEach(ref => {
        const a = inc[ref.id] || {};
        const meta = ref.meta || {};
        const ver = a.version ? ' (' + a.version + ')' : '';
        rows.push({
          isrc:   normalizeIsrc(a.isrc || ''),
          title:  (a.title || '') + ver,
          artist: '',   // track artists need a second include; pos+disc mapping is enough for a full ordered tracklist
          disc:   meta.volumeNumber || 1,
          pos:    meta.trackNumber || (rows.length + 1),
          dur:    isoDurToMmSs(a.duration),
        });
      });
      const next = j.links && j.links.next;
      path = next ? (next.charAt(0) === '/' ? next : '/' + next.replace(/^.*\/v2\//, '')) : null;
    }
    Log.info('Tidal album ' + albumId + ': ' + rows.length + ' track(s)');
    let n = 0;
    rows.forEach(e => {
      try { if (onIsrc && isValidIsrc(e.isrc)) onIsrc(e); } catch (err) { Log.warn('Tidal map hiccup for ' + e.isrc + ': ' + errText(err)); }
      try { if (onProgress) onProgress(++n, rows.length); } catch (err) {}
    });
    const withIsrc = rows.filter(e => isValidIsrc(e.isrc)).length;
    if (!withIsrc) throw new Error('Tidal album exposed no ISRCs');
    return { total: rows.length, next: null };
  }
  // Global by-ISRC lookup (no album link needed) — Tidal v2 /tracks?filter[isrc],
  // pulling the artist names via include=artists. Returns a fields-shaped object.
  async function tidalLookupByIsrc(isrc) {
    const token = await tidalToken();
    const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.api+json' };
    const r = await tidalGet(TIDAL.api + '/tracks?countryCode=' + TIDAL.country + '&filter%5Bisrc%5D=' + encodeURIComponent(isrc) + '&include=artists', headers);
    if (r.status !== 200) return null;
    let j; try { j = JSON.parse(r.responseText || '{}'); } catch (e) { return null; }
    const t = (j.data || [])[0];
    if (!t) return null;
    const a = t.attributes || {};
    const names = {};
    (j.included || []).forEach(x => { if (x.type === 'artists') names[x.id] = (x.attributes || {}).name; });
    const artist = ((((t.relationships || {}).artists || {}).data) || []).map(d => names[d.id]).filter(Boolean).join(', ');
    const ver = a.version ? ' (' + a.version + ')' : '';
    return { isrc: normalizeIsrc(a.isrc || isrc), title: (a.title || '') + ver, artist, year: '', dur: isoDurToMmSs(a.duration), relTitle: '' };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     VOLUMO  (clean unauthenticated JSON API — no Cloudflare/token; one call
     per album returns every track's ISRC. Resolves from a Volumo URL only —
     either an MB rel or the one Platform Check found; Scout never deals with
     barcodes itself, that's Platform Check's job.)
  ═══════════════════════════════════════════════════════════════════════ */
  async function fetchVolumo(albumId, onProgress, onIsrc) {
    if (onProgress) onProgress(0, 0);
    const idStr = String(albumId);
    // a 12–14-digit token is the ICPN (barcode) embedded in the canonical URL; a
    // shorter one is the internal album id. Both endpoints return the same shape.
    const path = idStr.length >= 12 ? '/album_by_icpn/' + idStr : '/albums/' + idStr;
    const r = await gmGet('https://volumo.com/api/v1' + path, { 'Accept': 'application/json' });
    if (r.status !== 200) throw new Error('Volumo ' + r.status + ' for album ' + albumId);
    let j; try { j = JSON.parse(r.responseText || 'null'); } catch (e) { throw new Error('Volumo: malformed JSON'); }
    const a = Array.isArray(j) ? j[0] : (j && (j.album || j));
    const list = (a && a.tracks) || [];
    Log.info('Volumo album "' + ((a && a.title) || albumId) + '": ' + list.length + ' track(s)');
    let n = 0;
    list.forEach((t, i) => {
      const mix = t.version && !/^original mix$/i.test(t.version) ? ' (' + t.version + ')' : '';
      // #387 per-track URL is /track/{id} — the slug is NOT part of MB's canonical form (chaban-mb), so
      // don't append it; the bare id 308-redirects to the slug URL in a browser anyway.
      const e = {
        isrc:   normalizeIsrc(t.isrc || ''),
        title:  (t.title || '') + mix,
        artist: ((t.artists || []).concat(t.featured_artists || [])).map(x => x && x.name).filter(Boolean).join(', '),
        disc:   t.disc_number || 1,
        pos:    t.number || t.track_number || (i + 1),
        dur:    t.duration ? msToMmSs(t.duration) : '',
        url:    t.id ? 'https://volumo.com/track/' + t.id : '',
      };
      try { if (onIsrc && isValidIsrc(e.isrc)) onIsrc(e); } catch (err) { Log.warn('Volumo map hiccup for ' + e.isrc + ': ' + errText(err)); }
      try { if (onProgress) onProgress(++n, list.length); } catch (err) {}
    });
    const withIsrc = list.filter(t => isValidIsrc(normalizeIsrc(t.isrc || ''))).length;
    if (!withIsrc) throw new Error('Volumo album exposed no ISRCs');
    return { total: list.length, next: null };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HDTRACKS  (#176 — clean unauthenticated, CORS-open JSON API; one call per
     album returns every track's ISRC inline, no per-track fan-out. The album id
     is a 24-char hex ObjectId; a numeric token (UPC, from a legacy valbum_code
     rel or from Platform Check) is resolved to that id via the search endpoint
     first. Bad ids / unknown barcodes return HTTP 200, so presence is read from
     the JSON body, never the status code.)
  ═══════════════════════════════════════════════════════════════════════ */
  const HD_API = 'https://hdtracks.azurewebsites.net/api/v1';
  async function fetchHDtracks(albumId, onProgress, onIsrc) {
    if (onProgress) onProgress(0, 0);
    let id = String(albumId).trim();
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      // a barcode/UPC — resolve to the ObjectId via search before fetching tracks
      const sr = await gmGet(HD_API + '/albums/search?q=' + encodeURIComponent(id), { 'Accept': 'application/json' });
      if (sr.status !== 200) throw new Error('HDtracks search ' + sr.status + ' for ' + id);
      let sj; try { sj = JSON.parse(sr.responseText || 'null'); } catch (e) { throw new Error('HDtracks: malformed search JSON'); }
      const hit = (sj && Array.isArray(sj.albums) && sj.albums[0]) || null;
      if (!hit || !hit.id) throw new Error('HDtracks: no album for ' + id);
      id = hit.id;
    }
    const r = await gmGet(HD_API + '/album/' + id, { 'Accept': 'application/json' });
    if (r.status !== 200) throw new Error('HDtracks ' + r.status + ' for album ' + id);
    let j; try { j = JSON.parse(r.responseText || 'null'); } catch (e) { throw new Error('HDtracks: malformed JSON'); }
    if (!j || !j.id) throw new Error('HDtracks: album ' + id + ' not found');
    const list = (j && j.tracks) || [];
    Log.info('HDtracks album "' + (j.name || id) + '": ' + list.length + ' track(s)');
    let n = 0;
    list.forEach((t, i) => {
      const e = {
        isrc:   normalizeIsrc(t.isrc || ''),
        title:  t.name || '',
        artist: t.mainArtist || '',
        // discIndex is present on some albums; album-wide `index` is the only
        // reliable ordering. Disc/position are display-only here — matching is by ISRC.
        disc:   t.discIndex || 1,
        pos:    t.index || (i + 1),
        dur:    t.duration ? msToMmSs(t.duration * 1000) : '',   // duration is seconds (float)
      };
      try { if (onIsrc && isValidIsrc(e.isrc)) onIsrc(e); } catch (err) { Log.warn('HDtracks map hiccup for ' + e.isrc + ': ' + errText(err)); }
      try { if (onProgress) onProgress(++n, list.length); } catch (err) {}
    });
    const withIsrc = list.filter(t => isValidIsrc(normalizeIsrc(t.isrc || ''))).length;
    if (!withIsrc) throw new Error('HDtracks album exposed no ISRCs');
    return { total: list.length, next: null };
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
  // a "Remove ISRC" edit must NOT say "Added 0 ISRCs" — build a deletion-appropriate note
  function defaultRemovalNote(recs, total) {
    const isrcs = recs.flatMap(([, v]) => v.isrcs);
    return [
      noteHeader(),
      '',
      'Release: ' + MB_ROOT + '/release/' + mbid,
      'Removed ' + total + ' ISRC' + (total === 1 ? '' : 's') + ' from ' + recs.length + ' recording' + (recs.length === 1 ? '' : 's') + (isrcs.length ? ': ' + isrcs.join(', ') : ''),
    ].join('\n');
  }
  function getRemovalNote(recs, total) {
    const ta = modal.querySelector('#ii-note-text');
    return (noteEdited && ta.value.trim()) ? ta.value.trim() : defaultRemovalNote(recs, total);   // respect a hand-edited note
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
    // #285: click the backdrop (or Esc) to close — safe now, since closeModal only
    // HIDES the window; everything entered stays in the DOM and is restored on reopen.
    overlay.addEventListener('click', () => closeModal());

    modal = document.createElement('div');
    modal.id = 'ii-modal';
    modal.addEventListener('click', e => e.stopPropagation());   // clicks inside don't reach the backdrop
    modal.innerHTML = `
      <div id="ii-hdr">
        <!-- the two operations on a record: ISRCs and Links -->
        <div class="ii-tabs">
          <button class="ii-tab" data-scope="isrc" type="button">ISRCs <span class="ii-tab-badge" id="ii-badge-isrc"></span></button>
          <button class="ii-tab" data-scope="links" type="button">Links <span class="ii-tab-badge" id="ii-badge-links"></span></button>
        </div>
        <!-- centered release / artist (Apollo Zen style) -->
        <div class="ii-zen"><div class="ii-zen-t" id="ii-rel-title"></div><div class="ii-zen-s" id="ii-rel-sub"></div></div>
        <!-- only Bulk/Export + config in the header; name/version/Log/Help live in the config window -->
        <div class="ii-hicons">
          <button class="ii-hico" id="ii-bulk-toggle" type="button" title="Bulk / Export">▤</button>
          <button class="ii-hico" id="ii-setup-toggle" type="button" title="Settings, log &amp; help">⚙︎</button>
        </div>
      </div>

      <div class="ii-pane" id="ii-setup-pane">
        <!-- #301: standard config-window header — icon · name · version · Log · ? Help (no ✕) -->
        <h3 class="ii-cfg-hdr">
          <svg class="ii-logo" width="18" height="18" viewBox="0 0 128 128" aria-hidden="true"><path d="M64 64 L64 24 A40 40 0 0 1 99 84 Z" fill="#d8c8f2"/><g fill="none" stroke="#6f42c1" stroke-width="7"><circle cx="64" cy="64" r="40"/><circle cx="64" cy="64" r="26" stroke-width="5" stroke="#b9a3e8"/><circle cx="64" cy="64" r="13" stroke-width="5" stroke="#b9a3e8"/></g><line x1="64" y1="64" x2="64" y2="24" stroke="#6f42c1" stroke-width="7" stroke-linecap="round"/><circle cx="86" cy="50" r="8" fill="#4b2e83"/></svg>
          <span class="ii-cfg-name">ISRC Scout</span><span class="ii-cfg-ver">v${SCRIPT_VERSION}</span>
          <span style="margin-left:auto"></span>
          <button class="ii-cfg-lnk" id="ii-log-link" type="button" title="Activity log">Log</button>
          <a class="ii-cfg-lnk" href="${SCRIPT_URL}#readme" target="_blank" rel="noopener" title="Open the ISRC Scout README">? Help</a>
        </h3>
        <div class="ii-cfg-grp">MusicBrainz</div>
        <div class="ii-authstate" id="ii-auth-state"></div>
        <div class="row" style="margin-top:8px; flex-wrap:nowrap">
          <button class="ii-tbtn primary" id="ii-authorize" style="flex-shrink:0">Authorize</button>
          <input type="text" id="ii-oauth-code" placeholder="Auto-fills on success — paste the code here only if the tab fails to close" autocomplete="off" style="flex:1; min-width:180px">
          <button class="ii-tbtn ghost" id="ii-signout" style="flex-shrink:0; display:none">Sign out</button>
        </div>
        <div class="ii-help">
          Click <b>Authorize</b> → approve in the MusicBrainz tab → it captures the code and closes itself.
          If the tab can't close on its own, paste the code it shows into the box above (Enter to submit).
        </div>
        <div class="ii-cfg-grp" style="margin-top:16px">Settings</div>
        <div>
          <label style="display:block; font-size:11.5px; color:#495057; margin-bottom:5px; font-weight:600">Import-source buttons</label>
          <label style="display:inline-flex; align-items:center; gap:5px; font-size:12px; margin-right:16px; cursor:pointer"><input type="checkbox" id="ii-show-icons">Show icons</label>
          <label style="display:inline-flex; align-items:center; gap:5px; font-size:12px; cursor:pointer"><input type="checkbox" id="ii-show-text">Show text</label>
        </div>
        <div style="margin-top:12px">
          <label style="display:inline-flex; align-items:flex-start; gap:6px; font-size:12px; cursor:pointer">
            <input type="checkbox" id="ii-rg-providers" style="margin-top:2px">
            <span>Use providers from the whole release group<br>
              <span style="color:#868e96; font-size:11px">Fill missing Deezer / Tidal / Bandcamp / … album links from sibling releases in the release group — recordings are shared, so a link on any edition resolves here. Costs one extra lookup.</span></span>
          </label>
        </div>
        <div style="margin-top:12px">
          <label style="display:inline-flex; align-items:flex-start; gap:6px; font-size:12px; cursor:pointer">
            <input type="checkbox" id="ii-ignore-pc" style="margin-top:2px">
            <span>Ignore Platform Check link confidence<br>
              <span style="color:#868e96; font-size:11px">Import from a Platform-Check link even when PC withheld it for a barcode/format mismatch. Off by default — a mismatch can mean PC matched the wrong release, so its ISRCs would be wrong (#314).</span></span>
          </label>
        </div>
        <div class="ii-cfg-grp" style="margin-top:16px">More</div>
        <a class="ii-cfg-lnk" id="ii-history" target="_blank" rel="noopener"
           href="${MB_ROOT}/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=76&conditions.0.args=78&conditions.1.field=editor&conditions.1.operator=me&conditions.1.name=&conditions.1.args.0="
           title="Your Add/Remove ISRC edits on MusicBrainz">🕓 My ISRC edits on MusicBrainz</a>
      </div>

      <div class="ii-pane" id="ii-bulk-pane">
        <h3><button class="ii-pane-x" title="Close">✕</button>Bulk / Export</h3>
        <!-- ISRC scope: paste / apply / export ISRCs -->
        <div class="ii-only-isrc">
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
        <!-- Links scope: export the per-track streaming links (#301) -->
        <div class="ii-only-links">
          <div class="ii-help" style="margin-top:0">
            Export this release's recording streaming links — what's already linked plus what <b>🔗 Find links</b> resolved (Deezer / Tidal / Bandcamp / Apple Music). Copied to the clipboard.
          </div>
          <div class="row" style="margin-top:8px">
            <button class="ii-tbtn" id="ii-link-export-csv">Export CSV</button>
            <button class="ii-tbtn" id="ii-link-export-json">Export JSON</button>
            <button class="ii-tbtn" id="ii-link-copy-urls">Copy URLs</button>
          </div>
          <div class="ii-help" id="ii-link-export-note" style="margin-top:8px"></div>
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
        <span class="ii-sx-group ii-only-isrc" id="ii-sx-group">
          <button class="ii-tbtn sx" id="ii-sx-all" title="Search every track on SoundExchange">⟳ SoundExchange</button>
          <button class="ii-exact-toggle" id="ii-exact-toggle" type="button" title="Exact-match options" aria-expanded="false">exact <span class="ii-exact-car">▾</span></button>
          <span class="ii-exact-set" id="ii-exact-set" title="Wrap the SoundExchange query in quotes for an exact match">
            <label><input type="checkbox" id="ii-ex-title">title</label>
            <label><input type="checkbox" id="ii-ex-artist">artist</label>
            <label><input type="checkbox" id="ii-ex-release">release</label>
          </span>
        </span>
        <button class="ii-tbtn dz ii-only-isrc" id="ii-dz-all" title="Import ISRCs from Deezer"><span class="ii-bico">${SRC_ICON.dz}</span><span class="ii-blabel">Deezer</span></button>
        <button class="ii-tbtn sp ii-only-isrc" id="ii-sp-all" title="Import ISRCs from Spotify"><span class="ii-bico">${SRC_ICON.sp}</span><span class="ii-blabel">Spotify</span></button>
        <button class="ii-tbtn bp ii-only-isrc" id="ii-bp-all" title="Import ISRCs from Beatport"><span class="ii-bico">${SRC_ICON.bp}</span><span class="ii-blabel">Beatport</span></button>
        <button class="ii-tbtn td ii-only-isrc" id="ii-td-all" title="Import ISRCs from Tidal"><span class="ii-bico">${SRC_ICON.td}</span><span class="ii-blabel">Tidal</span></button>
        <button class="ii-tbtn vo ii-only-isrc" id="ii-vo-all" title="Import ISRCs from Volumo"><span class="ii-bico">${SRC_ICON.vo}</span><span class="ii-blabel">Volumo</span></button>
        <button class="ii-tbtn hd ii-only-isrc" id="ii-hd-all" title="Import ISRCs from HDtracks"><span class="ii-bico">${SRC_ICON.hd}</span><span class="ii-blabel">HDtracks</span></button>
        <span class="ii-urladd ii-only-isrc" id="ii-urladd">
          <button class="ii-urladd-btn" id="ii-url-btn" type="button" title="Paste a streaming URL (Deezer / Spotify / Beatport / Tidal / Volumo / HDtracks) — auto-detected and imported">+</button>
          <input class="ii-urladd-input" type="text" id="ii-url-input" placeholder="Paste a streaming album URL…" autocomplete="off">
        </span>
        <button class="ii-tbtn sx ii-only-links" id="ii-links-btn" title="Resolve each track on Deezer / Tidal / Bandcamp and show what's linkable — grey = already linked in MB, colour = found and addable">🔗 Find links</button>
        <span class="ii-prog" id="ii-prog"></span>
        <button class="ii-tbtn ghost ii-only-isrc" id="ii-clear-pending" title="Clear all entered ISRCs">Clear</button>
      </div>

      <!-- floating provider menu (#181) — opened from any per-track button's ▾ -->
      <div class="ii-prov-menu" id="ii-prov-menu"></div>

      <div id="ii-body">
        <table id="ii-table">
          <colgroup id="ii-colgroup">
            <col style="width:32px"><col><col style="width:44px"><col style="width:124px"><col style="width:560px">
          </colgroup>
          <thead><tr>
            <th>#</th><th>Track</th><th></th>
            <th><label class="ii-ex-all-lbl ii-only-isrc" title="Select all existing ISRCs for removal"><input type="checkbox" id="ii-ex-all">Existing</label><span class="ii-only-links">Linked</span></th>
            <th><span class="ii-only-isrc">New ISRC</span><span class="ii-only-links">Add</span></th>
          </tr></thead>
          <tbody id="ii-tbody"></tbody>
        </table>
      </div>

      <div id="ii-foot">
        <span class="ii-summary ii-only-isrc" id="ii-summary"></span>
        <span class="ii-summary ii-only-links" id="ii-summary-links"></span>
        <button class="ii-tbtn ii-only-isrc" id="ii-delete" title="Delete the checked existing ISRCs" disabled>🗑 Delete checked</button>
        <button class="ii-tbtn ghost" id="ii-note-toggle" title="Edit note">✎ Edit note</button>
        <button class="ii-tbtn primary ii-only-isrc" id="ii-submit">Submit to MusicBrainz</button>
        <button class="ii-tbtn primary ii-only-links" id="ii-addlinks-btn" style="display:none" title="Add every resolved (coloured) streaming link to MusicBrainz in one background batch">➕ Add links</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    buildSxPanel();

    tbody     = modal.querySelector('#ii-tbody');
    summaryEl = modal.querySelector('#ii-summary');
    progEl    = modal.querySelector('#ii-prog');
    submitBtn = modal.querySelector('#ii-submit');

    // scope tabs (#301): the two operations on a record
    modal.querySelectorAll('.ii-tab').forEach(t => t.addEventListener('click', () => setScope(t.dataset.scope)));
    // #341: right-click a LINKED link toggles its "ended" flag — Ctrl = whole track, Alt = that
    // provider everywhere; right-clicking an already-ended (faded) link reverts it. MIDDLE-click
    // (with the same modifiers) does the actual removal (#301). Left-click just opens the link.
    tbody.addEventListener('contextmenu', e => {
      const a = e.target.closest('.ii-tl-linked .ii-tl.linked'); if (!a) return;
      e.preventDefault();
      const tr = a.closest('tr[data-idx]'); if (!tr) return;
      const idx = +tr.dataset.idx;
      if (e.ctrlKey || e.metaKey) TrackLinks.endTrack(idx, a.dataset.code);
      else if (e.altKey) TrackLinks.endProvider(a.dataset.code, idx);
      else TrackLinks.endOne(idx, a.dataset.code);
    });
    tbody.addEventListener('auxclick', e => {
      if (e.button !== 1) return;   // middle button
      const a = e.target.closest('.ii-tl-linked .ii-tl.linked'); if (!a) return;
      e.preventDefault();
      const tr = a.closest('tr[data-idx]'); if (!tr) return;
      const idx = +tr.dataset.idx;
      if (e.ctrlKey || e.metaKey) TrackLinks.removeTrack(idx);
      else if (e.altKey) TrackLinks.removeProvider(a.dataset.code);
      else TrackLinks.removeOne(idx, a.dataset.code);
    });
    // stop the browser opening the link in a new tab on middle-click (fires on mousedown in some browsers)
    tbody.addEventListener('mousedown', e => { if (e.button === 1 && e.target.closest('.ii-tl-linked .ii-tl.linked')) e.preventDefault(); });
    // Esc closes the modal (no ✕ in the header) — but first let an open pane close,
    // and ignore it while typing in a field.
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !modal.classList.contains('open')) return;
      const openPane = modal.querySelector('.ii-pane.open');
      if (openPane) { openPane.classList.remove('open'); return; }
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
      closeModal();
    });
    modal.querySelector('#ii-setup-toggle').addEventListener('click', () => togglePane('ii-setup-pane'));
    modal.querySelector('#ii-bulk-toggle').addEventListener('click', () => togglePane('ii-bulk-pane'));
    modal.querySelector('#ii-clear-pending').addEventListener('click', clearPending);
    modal.querySelector('#ii-links-btn').addEventListener('click', () => TrackLinks.resolve());        // #219: resolve candidates
    modal.querySelector('#ii-addlinks-btn').addEventListener('click', () => TrackLinks.addAll());      // #219: batch-add (B)
    modal.querySelector('#ii-sx-all').addEventListener('click', runSxAll);   // bulk SoundExchange — unchanged (#181)

    // Track-ISRC-provider menu (#181): the per-track [SX] buttons carry a ▾ that
    // opens this shared menu of providers available for THIS release; picking one
    // re-skins EVERY per-track button (global, not persisted). The bulk
    // SoundExchange button above is intentionally left alone.
    document.addEventListener('mousedown', e => {
      const menu = modal.querySelector('#ii-prov-menu');
      if (!menu || !menu.classList.contains('open')) return;
      if (e.target.closest('#ii-prov-menu') || e.target.closest('.ii-sxprov')) return;
      closeProvMenu();
    });

    // log pane — opened from the config window's "Log" link (#301)
    Log.setPane(modal.querySelector('#ii-log-out'));
    modal.querySelector('#ii-log-link').addEventListener('click', () => togglePane('ii-log-pane'));
    modal.querySelector('#ii-log-copy').addEventListener('click', () => {
      // Wrap in a collapsed <details> + fenced block so it pastes into a GitHub
      // issue/comment as a tidy, foldable log rather than a wall of text.
      try { navigator.clipboard.writeText('<details><summary>ISRC Scout Log</summary>\n\n```\n' + Log.text().trim() + '\n```\n\n</details>\n'); toast('Log copied'); } catch (e) { toast('Copy failed', 'err'); }
    });
    modal.querySelector('#ii-log-clear').addEventListener('click', () => Log.clear());

    // SX exact toggles + their collapsible container (collapsed state persisted)
    const sxGroup = modal.querySelector('#ii-sx-group');
    const exactToggle = modal.querySelector('#ii-exact-toggle');
    // reflect "any exact option active" on the toggle, so it's visible even when collapsed
    const refreshExactToggle = () => {
      const anyOn = sxExact.title || sxExact.artist || sxExact.release;
      exactToggle.classList.toggle('on', !!anyOn);
      exactToggle.title = anyOn
        ? 'Exact-match active: ' + ['title', 'artist', 'release'].filter(k => sxExact[k]).join(', ')
        : 'Exact-match options';
    };
    const applyExactCollapsed = (collapsed) => {
      sxGroup.classList.toggle('collapsed', collapsed);
      exactToggle.setAttribute('aria-expanded', String(!collapsed));
    };
    applyExactCollapsed(store.get('sx_exact_collapsed', true));   // collapsed by default to keep the toolbar compact
    exactToggle.addEventListener('click', () => {
      const collapsed = !sxGroup.classList.contains('collapsed');
      applyExactCollapsed(collapsed);
      store.set('sx_exact_collapsed', collapsed);
    });
    [['ii-ex-title', 'title'], ['ii-ex-artist', 'artist'], ['ii-ex-release', 'release']].forEach(([id, key]) => {
      const cb = modal.querySelector('#' + id);
      cb.checked = sxExact[key];
      cb.addEventListener('change', () => { sxExact[key] = cb.checked; saveSxExact(); refreshExactToggle(); Log.info('SX exact ' + key + ' = ' + cb.checked); });
    });
    refreshExactToggle();

    // Import-source buttons: independently show icons and/or text labels
    // (persisted; default icons-only). Never both off — re-check the last one.
    const tools = modal.querySelector('#ii-tools');
    const cbIcons = modal.querySelector('#ii-show-icons');
    const cbText  = modal.querySelector('#ii-show-text');
    const applySrcDisp = () => {
      tools.classList.toggle('ii-show-icons', cbIcons.checked);
      tools.classList.toggle('ii-show-text',  cbText.checked);
    };
    cbIcons.checked = store.get('src_show_icons', true);
    cbText.checked  = store.get('src_show_text', false);
    applySrcDisp();
    const onSrcDispChange = changed => {
      if (!cbIcons.checked && !cbText.checked) { changed.checked = true; }   // keep at least one visible
      store.set('src_show_icons', cbIcons.checked);
      store.set('src_show_text', cbText.checked);
      applySrcDisp();
      Log.info('Source buttons: icons=' + cbIcons.checked + ' text=' + cbText.checked);
    };
    cbIcons.addEventListener('change', () => onSrcDispChange(cbIcons));
    cbText.addEventListener('change', () => onSrcDispChange(cbText));

    // #302: pull provider links from the whole release group (opt-in)
    const cbRg = modal.querySelector('#ii-rg-providers');
    if (cbRg) {
      cbRg.checked = rgProvidersEnabled();
      cbRg.addEventListener('change', () => {
        store.set('rg_providers', cbRg.checked);
        Log.info('Release-group providers: ' + (cbRg.checked ? 'on' : 'off') + (cbRg.checked ? ' — reopen / reload to rescan' : ''));
      });
    }

    // #314: respect / ignore Platform Check's barcode-mismatch link confidence
    const cbPc = modal.querySelector('#ii-ignore-pc');
    if (cbPc) {
      cbPc.checked = ignorePcConfidence();
      cbPc.addEventListener('change', () => {
        store.set('ignore_pc_confidence', cbPc.checked);
        Log.info('Ignore Platform Check link confidence: ' + (cbPc.checked ? 'on — barcode/format-mismatched PC links will be used' : 'off — PC-withheld links are skipped'));
      });
    }

    modal.querySelector('#ii-dz-all').addEventListener('click', runDeezer);
    modal.querySelector('#ii-sp-all').addEventListener('click', runSpotify);
    modal.querySelector('#ii-bp-all').addEventListener('click', runBeatport);
    modal.querySelector('#ii-td-all').addEventListener('click', runTidal);
    modal.querySelector('#ii-vo-all').addEventListener('click', runVolumo);
    modal.querySelector('#ii-hd-all').addEventListener('click', runHDtracks);
    // Unified "paste a URL" control (#180) — apollo-style unroll. Click the +
    // to reveal the input; paste any streaming album URL; on Enter the platform
    // is auto-detected and imported. Replaces the per-provider ▾ submenus.
    const urlWrap  = modal.querySelector('#ii-urladd');
    const urlBtn   = modal.querySelector('#ii-url-btn');
    const urlInput = modal.querySelector('#ii-url-input');
    const openUrlAdd  = () => { urlWrap.classList.add('open'); _setTimeout(() => urlInput.focus(), 0); };
    const closeUrlAdd = () => { urlWrap.classList.remove('open'); urlInput.value = ''; reflectDetectedSource(''); };
    urlBtn.addEventListener('click', () => urlWrap.classList.contains('open') ? closeUrlAdd() : openUrlAdd());
    urlInput.addEventListener('input', () => reflectDetectedSource(urlInput.value));
    urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { submitUrlAdd(urlInput.value); closeUrlAdd(); }
      else if (e.key === 'Escape') closeUrlAdd();
    });
    // Auto-import on paste — no Enter needed when a recognized album URL is pasted
    // (#300). Unrecognized text pastes normally so it can still be edited + Entered.
    urlInput.addEventListener('paste', e => {
      const v = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim();
      if (v && detectSource(v)) { e.preventDefault(); reflectDetectedSource(v); submitUrlAdd(v); closeUrlAdd(); }
    });
    // collapse on click-outside (only when empty, so a half-typed URL isn't lost)
    document.addEventListener('mousedown', e => {
      if (!urlWrap.classList.contains('open')) return;
      if (urlWrap.contains(e.target)) return;
      if (!urlInput.value.trim()) closeUrlAdd();
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
    // #301: link export (Links scope)
    modal.querySelector('#ii-link-export-csv').addEventListener('click', () => exportLinks('csv'));
    modal.querySelector('#ii-link-export-json').addEventListener('click', () => exportLinks('json'));
    modal.querySelector('#ii-link-copy-urls').addEventListener('click', () => exportLinks('urls'));

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

  // #301: the active scope (ISRCs / Links) — drives column labels, toolbar, footer
  // (via .ii-only-isrc / .ii-only-links visibility) and the table column widths.
  let scope = store.get('scope', 'isrc') === 'links' ? 'links' : 'isrc';
  function setScope(s) {
    scope = (s === 'links') ? 'links' : 'isrc';
    store.set('scope', scope);
    modal.classList.toggle('ii-scope-isrc', scope === 'isrc');
    modal.classList.toggle('ii-scope-links', scope === 'links');
    modal.querySelectorAll('.ii-tab').forEach(t => t.classList.toggle('on', t.dataset.scope === scope));
    const cg = modal.querySelector('#ii-colgroup');
    if (cg) cg.innerHTML = (scope === 'links')
      ? '<col style="width:32px"><col><col style="width:44px"><col style="width:150px"><col style="width:230px">'
      : '<col style="width:32px"><col><col style="width:44px"><col style="width:124px"><col style="width:560px">';
  }

  // Some tablets render MusicBrainz's desktop layout wider than the browser's
  // layout viewport, so the page overflows and the browser zooms-to-fit. A
  // position:fixed modal is then sized/anchored to the (narrow) layout viewport
  // and lands in a corner at ~64% width. Pin the modal + overlay to the VISUAL
  // viewport instead — it reflects what's actually on screen (zoom scale +
  // offset). CSS handles the normal case; this only engages on narrow viewports
  // (where the mobile layout is active) and is a no-op without VisualViewport.
  let _vvSync = null;
  function pinModalToViewport() {
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia('(max-width: 700px)').matches) { clearModalViewportPin(); return; }
    const w = Math.min(vv.width * 0.96, 1080), h = vv.height * 0.96;
    const set = (el, props) => { for (const k in props) el.style.setProperty(k, props[k], 'important'); };
    set(overlay, { left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', width: vv.width + 'px', height: vv.height + 'px' });
    set(modal, {
      left: (vv.offsetLeft + (vv.width - w) / 2) + 'px', top: (vv.offsetTop + (vv.height - h) / 2) + 'px',
      width: w + 'px', 'max-width': 'none', height: h + 'px', 'max-height': 'none', transform: 'none',
    });
  }
  function clearModalViewportPin() {
    ['left', 'top', 'width', 'max-width', 'height', 'max-height', 'transform'].forEach(p => modal.style.removeProperty(p));
    ['left', 'top', 'width', 'height'].forEach(p => overlay.style.removeProperty(p));
  }
  function openModal() {
    buildModal();
    overlay.classList.add('open');
    modal.classList.add('open');
    pinModalToViewport();
    if (window.visualViewport && !_vvSync) {
      _vvSync = () => pinModalToViewport();
      window.visualViewport.addEventListener('resize', _vvSync);
      window.visualViewport.addEventListener('scroll', _vvSync);
    }
    refreshAuthState();
    setScope(scope);   // #301: apply the active-scope classes + column widths before render
    if (!RELEASE) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;color:#adb5bd">Loading release…</td></tr>';
      fetchRelease()
        .then(renderTracks)   // existing track links ride along on the release fetch (recording-level-rels)
        .catch(err => {
          tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;color:#dc3545">Failed to load release: ' + esc(err.message) + '</td></tr>';
        });
    } else {
      renderTracks();
    }
  }
  function closeModal() {
    abortSxWork('window closed');            // don't leave batched SX requests running in the background (#127)
    if (_vvSync && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _vvSync);
      window.visualViewport.removeEventListener('scroll', _vvSync);
      _vvSync = null;
    }
    clearModalViewportPin();
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

  /* ═══════════════════════════════════════════════════════════════════════
     TRACK LINKS (#219 PoC) — per-track provider link icons under the artist
     line. Two streaming providers that expose a stable, public per-track URL
     resolvable by ISRC (and already wired in Scout): Deezer and Tidal.
       • faded monochrome  → the recording already links to that provider in MB
                             (read once from a recording browse with url-rels)
       • full brand colour → the track resolves on the provider by ISRC but
                             isn't linked yet — an "add" candidate
     The actual background add is the next spike: WS2 only submits ISRCs, so
     adding URL relationships needs MB's website edit API, not submitIsrcs().
  ═══════════════════════════════════════════════════════════════════════ */
  const TrackLinks = (function () {
    // linkTypeID: recording↔url relationship type (confirmed live against MB's
    // editor): 268 = "free streaming" (Deezer/Spotify free tier), 979 =
    // "streaming" / streaming page (Tidal, subscription).
    const PROV = [
      { code: 'dz', name: 'Deezer', color: _PROV_COLOR.deezer, icon: SRC_ICON.dz, linkTypeID: 268,
        conc: 3, gap: 60,   // #307: a few in flight; a quota hit RECOVERS below (back off + retry) instead of false-negativing
        test: u => /(?:^|\.)deezer\.com\/(?:[a-z]{2}\/)?track\/\d+/i.test(u),
        async resolve(isrc) {
          // Deezer signals a rate limit as HTTP 429 or an error body with code 4 (quota) / 700 (busy);
          // a genuine miss is code 800 ("no data"). Retry only the rate-limit cases, so throttling
          // never looks like "not found". #307
          for (let attempt = 0; ; attempt++) {
            const r = await gmGet('https://api.deezer.com/track/isrc:' + encodeURIComponent(isrc), { 'Accept': 'application/json' });
            let j = null; try { j = JSON.parse(r.responseText || 'null'); } catch (e) {}
            const throttled = r.status === 429 || (j && j.error && (j.error.code === 4 || j.error.code === 700));
            if (throttled && attempt < 4) { await sleep(Math.min(700 * Math.pow(2, attempt), 6000)); continue; }
            if (r.status !== 200 || !j || j.error || !j.id) return null;
            // Don't offer a DEAD track: Deezer keeps the ISRC mapping after pulling the
            // audio, returning a track that streams in zero countries (readable:false,
            // available_countries:[]). That's a broken link, so treat it as not found.
            if (j.readable === false && Array.isArray(j.available_countries) && j.available_countries.length === 0) return null;
            return j.link || ('https://www.deezer.com/track/' + j.id);
          }
        } },
      { code: 'td', name: 'Tidal', color: _PROV_COLOR.tidal, icon: SRC_ICON.td, linkTypeID: 979,
        conc: 3, gap: 0,   // #307: tidalGet() self-recovers from 429 (backoff+retry), so a burst is safe — it never false-negatives
        test: u => /tidal\.com\/(?:browse\/)?track\/\d+/i.test(u),
        async resolve(isrc) {
          const token = await tidalToken();
          const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.api+json' };
          const r = await tidalGet(TIDAL.api + '/tracks?countryCode=' + TIDAL.country + '&filter%5Bisrc%5D=' + encodeURIComponent(isrc), headers);
          if (r.status !== 200) return null;
          let j; try { j = JSON.parse(r.responseText || '{}'); } catch (e) { return null; }
          const t = (j.data || [])[0];
          return t && t.id ? ('https://tidal.com/browse/track/' + t.id) : null;
        } },
      // Bandcamp (#300): no ISRC — resolve by ALBUM. The release's Bandcamp album
      // page lists every track's URL in order, so we match by position (with a
      // title sanity-check). Only offered when the release has a Bandcamp album link.
      { code: 'bc', name: 'Bandcamp', color: _PROV_COLOR.bandcamp, icon: SRC_ICON.bc, linkTypeID: 268,
        album: true, urlKey: 'bandcampUrl', conc: 99, gap: 0,   // #307: one album fetch (cached), the rest is local
        test: u => /\.bandcamp\.com\/track\//i.test(u),
        resolve: (isrc, t, idx) => bcResolve(t, idx) },
      // Apple Music (#like Bandcamp): the album page's ld+json lists every track URL,
      // matched by position. Subscription streaming → linkType 979.
      { code: 'am', name: 'Apple Music', color: _PROV_COLOR.apple, icon: SRC_ICON.am, linkTypeID: 979,
        album: true, urlKey: 'appleUrl', conc: 99, gap: 0,   // #307: one album fetch (cached), the rest is local
        test: u => /music\.apple\.com\/[a-z]{2}\/(?:song\/|album\/[^"\s]*[?&]i=)/i.test(u),
        resolve: (isrc, t, idx) => amResolve(t, idx) },
      // Volumo (#387): a download store — recording↔url "purchase for download" (254). No global by-ISRC
      // endpoint, but the release's Volumo album JSON (fetched once, cached) carries every track's ISRC and
      // id, so we match by ISRC and hand back the per-track URL. Only offered when the release has a Volumo link.
      { code: 'vo', name: 'Volumo', color: _PROV_COLOR.volumo, icon: SRC_ICON.vo, linkTypeID: 254,
        album: true, urlKey: 'volumoId', conc: 99, gap: 0,
        test: u => /(?:^|[./])volumo\.com\/track\//i.test(u),   // note the char class incl. '/': the URL is https://volumo.com/… (no www)
        resolve: (isrc) => provAlbumUrl('volumo', isrc) },
      // Beatport (#387): same album-scoped, ISRC-matched shape as Volumo. Its tracklist (with track
      // id+slug) comes from the API when logged in via Platform Check, else from the Cloudflare tab harvest.
      { code: 'bp', name: 'Beatport', color: _PROV_COLOR.beatport, icon: SRC_ICON.bp, linkTypeID: 254,
        album: true, urlKey: 'beatportId', conc: 99, gap: 0,
        test: u => /(?:^|[./])beatport\.com\/track\//i.test(u),
        resolve: (isrc) => provAlbumUrl('beatport', isrc) },
    ];

    let resolving = false;

    // Existing url rels come free with fetchRelease (inc=recording-level-rels), so
    // we read what's already linked straight off the track — no extra request.
    const linkedUrl = (t, p) => (t.recUrls || []).find(u => p.test(u)) || null;

    // Bandcamp album page (fetched once): ordered [{title, url}] from data-tralbum.
    let _bcList = null, _bcPromise = null;
    async function bcAlbum() {
      if (_bcList) return _bcList;
      if (_bcPromise) return _bcPromise;
      const url = RELEASE && RELEASE.bandcampUrl;
      if (!url) { _bcList = []; return _bcList; }
      _bcPromise = (async () => {
        const r = await gmGet(url, { 'Accept': 'text/html' });
        if (r.status !== 200) return [];
        const m = (r.responseText || '').match(/data-tralbum="([^"]+)"/);
        if (!m) return [];
        const json = m[1].replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
        let j; try { j = JSON.parse(json); } catch (e) { return []; }
        let origin = ''; try { origin = new URL(j.url).origin; } catch (e) { origin = url.replace(/\/album\/.*$/, ''); }
        return (j.trackinfo || []).map(ti => ({ title: ti.title || '', url: ti.title_link ? origin + ti.title_link : '' })).filter(ti => ti.url);
      })();
      _bcList = await _bcPromise.catch(() => []); _bcPromise = null;
      return _bcList;
    }
    const _nrm = s => [...(s || '').toLowerCase().normalize('NFD')].filter(c => { const x = c.charCodeAt(0); return x < 0x300 || x > 0x36f; }).join('').replace(/[^a-z0-9]+/g, ' ').trim();
    async function bcResolve(t, idx) {
      const list = await bcAlbum();
      const e = list[idx];
      if (!e) return null;
      const a = _nrm(e.title), b = _nrm(t.title);
      // position match must agree on title (else the editions are out of sync) — don't add a likely-wrong link
      return (a && b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0)) ? e.url : null;
    }

    // Apple Music album page (fetched once): ordered [{title, url}] from its ld+json.
    let _amList = null, _amPromise = null;
    async function amAlbum() {
      if (_amList) return _amList;
      if (_amPromise) return _amPromise;
      const url = RELEASE && RELEASE.appleUrl;
      if (!url) { _amList = []; return _amList; }
      _amPromise = (async () => {
        const r = await gmGet(url, { 'Accept': 'text/html' });
        if (r.status !== 200) return [];
        const m = (r.responseText || '').match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
        if (!m) return [];
        let j; try { j = JSON.parse(m[1]); } catch (e) { return []; }
        return (j.tracks || []).map(t => ({ title: t.name || '', url: t.url || '' })).filter(t => t.url);
      })();
      _amList = await _amPromise.catch(() => []); _amPromise = null;
      return _amList;
    }
    async function amResolve(t, idx) {
      const list = await amAlbum();
      const e = list[idx];
      if (!e) return null;
      const a = _nrm(e.title), b = _nrm(t.title);
      return (a && b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0)) ? e.url : null;
    }
    // #387 album-scoped by-ISRC providers (Volumo/Beatport): fetch the release's album tracklist once
    // (cached in ensureProvAlbum), match the track by ISRC — never position — and return its per-track URL.
    async function provAlbumUrl(key, isrc) {
      if (!isrc) return null;
      const entries = await ensureProvAlbum(key);
      const e = entries.find(s => normalizeIsrc(s.isrc) === normalizeIsrc(isrc));
      return (e && e.url) ? e.url : null;
    }

    // Which providers to show for a track: by-ISRC ones always; album ones (Bandcamp)
    // only when the release has that album link (resolvable) or the recording is
    // already linked to it.
    function providersFor(t) {
      return PROV.filter(p => !p.album || linkedUrl(t, p) || (RELEASE && RELEASE[p.urlKey]));
    }

    // #389 Show EVERY linked provider, even ones ISRC Scout can't add per-track. Recognise the common
    // streaming/store hosts for a nice name/colour (Spotify even gets its glyph); anything else falls back
    // to its hostname with a generic globe. These are read-only (open in a tab) — no add/remove actions.
    const _GLOBE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>';
    const KNOWN_LINK = [
      { test: u => /open\.spotify\.com\//i.test(u),                                       name: 'Spotify',      color: _PROV_COLOR.spotify, icon: SRC_ICON.sp },
      { test: u => /(?:^|[./])qobuz\.com\//i.test(u),                                      name: 'Qobuz',        color: '#0e1a44', icon: _GLOBE },
      { test: u => /music\.youtube\.com\/watch|youtu\.be\/|youtube\.com\/watch/i.test(u),  name: 'YouTube',      color: '#ff0000', icon: _GLOBE },
      { test: u => /soundcloud\.com\//i.test(u),                                           name: 'SoundCloud',   color: '#ff5500', icon: _GLOBE },
      { test: u => /music\.amazon\./i.test(u),                                             name: 'Amazon Music', color: '#00a8e1', icon: _GLOBE },
      { test: u => /music\.apple\.com\//i.test(u),                                         name: 'Apple Music',  color: _PROV_COLOR.apple, icon: SRC_ICON.am },
    ];
    // recUrls this track carries that no PROV provider already renders → [{url,name,color,icon}] (deduped).
    function otherLinked(t) {
      const out = [], seen = new Set();
      (t.recUrls || []).forEach(u => {
        if (!u || seen.has(u) || PROV.some(p => p.test(u))) return;   // PROV ones are shown already
        seen.add(u);
        const k = KNOWN_LINK.find(x => x.test(u));
        if (k) { out.push({ url: u, name: k.name, color: k.color, icon: k.icon }); return; }
        let host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) {}
        if (host) out.push({ url: u, name: host, color: '#8a8f98', icon: _GLOBE });
      });
      return out;
    }
    // #301: two columns. LINKED = monochrome icons for providers already linked on
    // MB; ADD = a hidden candidate slot per not-yet-linked provider (Find links fills
    // them, and an added one moves over to the LINKED column).
    function linkedIcon(p, url, ended) {
      const verb = ended ? 'un-ends' : 'marks ended';
      return '<a class="ii-tl linked' + (ended ? ' ended' : '') + '" data-code="' + p.code + '" style="color:' + p.color + '" href="' + esc(url) + '" target="_blank" rel="noopener" ' +
        'title="' + esc(p.name) + ' — linked' + (ended ? ' · ENDED' : '') + ' · left-click opens · right-click ' + verb + ' (Ctrl: whole track · Alt: ' + esc(p.name) + ' everywhere) · middle-click removes (same modifiers)">' + p.icon + '</a>';
    }
    function linkedHtml(t) {
      const cells = providersFor(t).map(p => { const ex = t.recId ? linkedUrl(t, p) : null; return ex ? linkedIcon(p, ex, !!(t.endedUrls && t.endedUrls.has(ex))) : ''; }).filter(Boolean).join('');
      // #389 append every OTHER linked provider (read-only), so the column shows all links, not just addable ones
      const others = t.recId ? otherLinked(t).map(o => '<a class="ii-tl linked ii-tl-other" style="color:' + o.color + '" href="' + esc(o.url) + '" target="_blank" rel="noopener" title="' + esc(o.name) + ' — linked (ISRC Scout doesn’t add this provider) · click to open">' + o.icon + '</a>').join('') : '';
      return '<div class="ii-tl-linked" data-rec="' + esc(t.recId || '') + '">' + cells + others + '</div>';
    }
    function addHtml(t) {
      const cells = providersFor(t).map(p =>
        (!t.recId || linkedUrl(t, p)) ? '' : '<span class="ii-tl cand" data-code="' + p.code + '" title="' + esc(p.name) + '">' + p.icon + '</span>'
      ).filter(Boolean).join('');
      return '<div class="ii-tl-add" data-rec="' + esc(t.recId || '') + '">' + cells + '</div>';
    }

    const addBox = idx => { const tr = tbody.querySelector('tr[data-idx="' + idx + '"]'); return tr ? tr.querySelector('.ii-tl-add') : null; };
    const linkedBox = idx => { const tr = tbody.querySelector('tr[data-idx="' + idx + '"]'); return tr ? tr.querySelector('.ii-tl-linked') : null; };
    function cell(idx, code) { const c = addBox(idx); return c ? c.querySelector('.ii-tl[data-code="' + code + '"]') : null; }

    // Replace a row's ADD-column slot with a coloured "add" candidate: a link to the
    // resolved provider URL. Left-click opens the track; RIGHT-click adds the
    // relationship in the background.
    function makeNew(idx, p, url) {
      const el = cell(idx, p.code);
      if (!el) return;
      const a = document.createElement('a');
      a.className = 'ii-tl new'; a.dataset.code = p.code;
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      a.style.color = p.color;
      // #302: mark candidates resolved via an album link pulled from a sibling release
      const rg = p.urlKey && RELEASE.rgFrom && RELEASE.rgFrom[p.urlKey];
      if (rg) a.classList.add('ii-rg');
      a.title = p.name + ' — left-click opens · right-click adds this · Ctrl+right-click adds all links on this track · Alt+right-click adds ' + p.name + ' on every track' +
        (rg ? '  ·  ' + p.name + ' album link from another release in this group' : '');
      a.innerHTML = p.icon;
      // all add actions on right-click (left-click just opens the track); modifiers
      // scope it: Ctrl/⌘ = whole track, Alt = this provider across every track.
      a.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) addTrack(idx);
        else if (e.altKey) addProvider(p.code);
        else addOne(idx, p, url);
      });
      el.replaceWith(a);
    }

    // On a successful add: drop the candidate from the ADD column and add a
    // monochrome icon to the LINKED column; record the URL on the track.
    function markLinked(idx, p, url) {
      const t = RELEASE.tracks[idx];
      if (t && !(t.recUrls || []).includes(url)) (t.recUrls = t.recUrls || []).push(url);
      const el = cell(idx, p.code); if (el) el.remove();
      const lb = linkedBox(idx);
      if (lb && !lb.querySelector('.ii-tl[data-code="' + p.code + '"]')) {
        const tmp = document.createElement('div'); tmp.innerHTML = linkedIcon(p, url);
        lb.appendChild(tmp.firstChild);
      }
    }

    // Same shape as ISRC Scout's standard edit note (noteHeader + Release line +
    // an "Added …" summary), so link edits read like the script's ISRC edits.
    function noteFor(provs) {
      const counts = {};
      provs.forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; });
      const breakdown = Object.keys(counts).sort().map(n => n + ' (' + counts[n] + ')').join(', ');
      return [
        noteHeader(),
        '',
        'Release: ' + MB_ROOT + '/release/' + mbid,
        'Added ' + provs.length + ' streaming link' + (provs.length === 1 ? '' : 's') + (breakdown ? ': ' + breakdown : ''),
      ].join('\n');
    }

    // Add recording→url relationships in the background via MB's internal edit API
    // (same endpoint the native relationship editor uses). Authenticated by the
    // logged-in session cookie (same-origin) — no OAuth, no CSRF. One POST carries
    // the whole batch (auto-applied for auto-editors, else queued). items:
    // [{ recGid, url, linkTypeID }].
    async function submitRels(items, note) {
      const body = {
        edits: items.map(it => ({
          edit_type: 90, linkTypeID: it.linkTypeID, attributes: [],
          entities: [{ entityType: 'recording', gid: it.recGid }, { entityType: 'url', name: it.url }],
        })),
        editNote: note || '', makeVotable: 0,
      };
      const r = await fetch(MB_ROOT + '/ws/js/edit/create', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const text = await r.text().catch(() => '');
      let j = null; try { j = JSON.parse(text); } catch (e) {}
      if (!r.ok || (j && j.error)) {
        const m = (j && (j.error.message || j.error)) || ('HTTP ' + r.status);
        throw new Error((typeof m === 'string' ? m : JSON.stringify(m)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
      }
      return j;
    }

    // Collect resolved "new" candidates matching a selector into add items.
    function newItems(selector) {
      const items = [];
      modal.querySelectorAll(selector).forEach(a => {
        const p = PROV.find(x => x.code === a.dataset.code);
        const tr = a.closest('tr[data-idx]');
        if (p && tr) items.push({ idx: +tr.dataset.idx, p, url: a.getAttribute('href') });
      });
      return items;
    }
    // Submit a batch of add items in one POST; spin → linked, or restore on failure.
    async function addBatch(items, confirmMsg) {
      if (!items.length) return;
      if (confirmMsg && !confirm(confirmMsg)) return;
      items.forEach(it => { const el = cell(it.idx, it.p.code); if (el) { el.className = 'ii-tl spin'; el.dataset.code = it.p.code; } });
      try {
        await submitRels(items.map(it => ({ recGid: RELEASE.tracks[it.idx].recId, url: it.url, linkTypeID: it.p.linkTypeID })), noteFor(items.map(it => it.p)));
        items.forEach(it => markLinked(it.idx, it.p, it.url));
        Log.info('Linked ' + items.length + ' track-link' + (items.length === 1 ? '' : 's') + ' on MusicBrainz');
      } catch (e) {
        Log.err('Add links failed: ' + errText(e));
        items.forEach(it => makeNew(it.idx, it.p, it.url));   // restore the add affordances
      }
      updateAddBtn();
    }
    // right-click a candidate → add just that one
    const addOne = (idx, p, url) => addBatch([{ idx, p, url }]);
    // ctrl-click → add every resolved link for THIS track
    const addTrack = idx => addBatch(newItems('tr[data-idx="' + idx + '"] .ii-tl-add .ii-tl.new'));
    // alt-click → add every resolved link for THIS provider across all tracks
    const addProvider = code => addBatch(newItems('.ii-tl-add .ii-tl.new[data-code="' + code + '"]'));
    // footer button → add everything resolved (no confirm — auto-applied edits)
    async function addAll() {
      const items = newItems('.ii-tl-add .ii-tl.new');
      if (!items.length) return;
      const btn = modal.querySelector('#ii-addlinks-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
      await addBatch(items);
      if (btn) btn.disabled = false;
    }

    // ── DELETE (symmetric to add). Removing a relationship needs its internal id,
    // which WS2 doesn't expose — fetch it from /ws/js/entity (the rel editor's API)
    // and submit an EDIT_RELATIONSHIP_DELETE (92 — 91 is EDIT, a no-op for removal). ──
    const _relCache = {};
    async function recUrlRels(recGid) {
      if (_relCache[recGid]) return _relCache[recGid];
      const r = await fetch(MB_ROOT + '/ws/js/entity/' + recGid + '?inc=rels', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('rels ' + r.status);
      const j = await r.json();
      return (_relCache[recGid] = (j.relationships || []).filter(x => x.target_type === 'url'));
    }
    function delNote(provs) {
      const counts = {}; provs.forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; });
      const breakdown = Object.keys(counts).sort().map(n => n + ' (' + counts[n] + ')').join(', ');
      return [noteHeader(), '', 'Release: ' + MB_ROOT + '/release/' + mbid,
        'Removed ' + provs.length + ' streaming link' + (provs.length === 1 ? '' : 's') + (breakdown ? ': ' + breakdown : '')].join('\n');
    }
    async function postEdits(edits, note) {
      const r = await fetch(MB_ROOT + '/ws/js/edit/create', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edits, editNote: note || '', makeVotable: 0 }) });
      const text = await r.text().catch(() => ''); let j = null; try { j = JSON.parse(text); } catch (e) {}
      if (!r.ok || (j && j.error)) { const m = (j && (j.error.message || j.error)) || ('HTTP ' + r.status); throw new Error((typeof m === 'string' ? m : JSON.stringify(m)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)); }
      return j;
    }
    function linkedIcons(selector) {
      const out = [];
      modal.querySelectorAll(selector).forEach(a => { const p = PROV.find(x => x.code === a.dataset.code); const tr = a.closest('tr[data-idx]'); if (p && tr) out.push({ idx: +tr.dataset.idx, p, url: a.getAttribute('href'), el: a }); });
      return out;
    }
    async function removeBatch(icons) {
      if (!icons.length) return;
      icons.forEach(ic => ic.el.classList.add('removing'));
      try {
        const edits = [], used = [];
        for (const ic of icons) {
          const t = RELEASE.tracks[ic.idx]; if (!t.recId) continue;
          const rels = await recUrlRels(t.recId);
          const rel = rels.find(r => (r.target && r.target.name) === ic.url) || rels.find(r => ic.p.test((r.target && r.target.name) || '') && r.linkTypeID === ic.p.linkTypeID);
          if (!rel) { Log.warn('No ' + ic.p.name + ' relationship found to remove on "' + (t.title || t.recId) + '"'); continue; }
          edits.push({ edit_type: 92, id: rel.id, linkTypeID: rel.linkTypeID, attributes: [], entities: [{ entityType: 'recording', gid: t.recId }, { entityType: 'url', gid: rel.target.gid, name: rel.target.name }] });
          used.push(ic);
        }
        if (!edits.length) { icons.forEach(ic => ic.el.classList.remove('removing')); return; }
        await postEdits(edits, delNote(used.map(ic => ic.p)));
        used.forEach(ic => {
          const t = RELEASE.tracks[ic.idx]; if (t) { t.recUrls = (t.recUrls || []).filter(u => u !== ic.url); delete _relCache[t.recId]; }
          ic.el.remove();
          const ab = addBox(ic.idx);   // re-offer as a hidden Add candidate so Find links can resolve it again
          if (ab && !ab.querySelector('.ii-tl[data-code="' + ic.p.code + '"]')) { const s = document.createElement('span'); s.className = 'ii-tl cand'; s.dataset.code = ic.p.code; s.title = ic.p.name; s.innerHTML = ic.p.icon; ab.appendChild(s); }
        });
        Log.info('Removed ' + used.length + ' link' + (used.length === 1 ? '' : 's') + ' on MusicBrainz');
      } catch (e) { Log.err('Remove links failed: ' + errText(e)); icons.forEach(ic => ic.el.classList.remove('removing')); }
      updateAddBtn();
    }
    const removeOne = (idx, code) => removeBatch(linkedIcons('tr[data-idx="' + idx + '"] .ii-tl-linked .ii-tl.linked[data-code="' + code + '"]'));
    const removeTrack = idx => removeBatch(linkedIcons('tr[data-idx="' + idx + '"] .ii-tl-linked .ii-tl.linked'));
    const removeProvider = code => removeBatch(linkedIcons('.ii-tl-linked .ii-tl.linked[data-code="' + code + '"]'));

    // #341: toggle the "ended" flag on a link's relationship (EDIT_RELATIONSHIP, edit_type 91) —
    // e.g. a release taken down so its streaming links no longer resolve. Reversible. Verified: MB
    // applies `ended` via edit_type 91 with no end_date required.
    function endNote(provs, ended) {
      const counts = {}; provs.forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; });
      const breakdown = Object.keys(counts).sort().map(n => n + ' (' + counts[n] + ')').join(', ');
      return [noteHeader(), '', 'Release: ' + MB_ROOT + '/release/' + mbid,
        (ended ? 'Marked ' : 'Un-ended ') + provs.length + ' streaming link' + (provs.length === 1 ? '' : 's') + (ended ? ' as ended' : '') + (breakdown ? ': ' + breakdown : '')].join('\n');
    }
    async function endBatch(icons, ended) {
      if (!icons.length) return;
      icons.forEach(ic => ic.el.classList.add('removing'));
      try {
        const edits = [], used = [];
        for (const ic of icons) {
          const t = RELEASE.tracks[ic.idx]; if (!t.recId) continue;
          const rels = await recUrlRels(t.recId);
          const rel = rels.find(r => (r.target && r.target.name) === ic.url) || rels.find(r => ic.p.test((r.target && r.target.name) || '') && r.linkTypeID === ic.p.linkTypeID);
          if (!rel) { Log.warn('No ' + ic.p.name + ' relationship found on "' + (t.title || t.recId) + '"'); ic.el.classList.remove('removing'); continue; }
          if (!!rel.ended === ended) { ic.el.classList.remove('removing'); ic.el.classList.toggle('ended', ended); continue; }   // already in the desired state
          edits.push({ edit_type: 91, id: rel.id, linkTypeID: rel.linkTypeID, attributes: [], ended: ended, entities: [{ entityType: 'recording', gid: t.recId }, { entityType: 'url', gid: rel.target.gid, name: rel.target.name }] });
          used.push(ic);
        }
        if (!edits.length) return;
        await postEdits(edits, endNote(used.map(ic => ic.p), ended));
        used.forEach(ic => {
          const t = RELEASE.tracks[ic.idx];
          if (t) { t.endedUrls = t.endedUrls || new Set(); if (ended) t.endedUrls.add(ic.url); else t.endedUrls.delete(ic.url); delete _relCache[t.recId]; }
          ic.el.classList.remove('removing');
          ic.el.classList.toggle('ended', ended);
        });
        Log.info((ended ? 'Marked ' : 'Un-ended ') + used.length + ' link' + (used.length === 1 ? '' : 's') + (ended ? ' as ended' : '') + ' on MusicBrainz');
      } catch (e) { Log.err('End toggle failed: ' + errText(e)); icons.forEach(ic => ic.el.classList.remove('removing')); }
    }
    const iconEnded = ic => ic.el.classList.contains('ended');
    const endOne = (idx, code) => { const ics = linkedIcons('tr[data-idx="' + idx + '"] .ii-tl-linked .ii-tl.linked[data-code="' + code + '"]'); if (ics.length) endBatch(ics, !iconEnded(ics[0])); };
    const endTrack = (idx, code) => { const c = linkedIcons('tr[data-idx="' + idx + '"] .ii-tl-linked .ii-tl.linked[data-code="' + code + '"]')[0]; endBatch(linkedIcons('tr[data-idx="' + idx + '"] .ii-tl-linked .ii-tl.linked'), c ? !iconEnded(c) : true); };
    const endProvider = (code, idx) => { const c = linkedIcons('tr[data-idx="' + idx + '"] .ii-tl-linked .ii-tl.linked[data-code="' + code + '"]')[0]; endBatch(linkedIcons('.ii-tl-linked .ii-tl.linked[data-code="' + code + '"]'), c ? !iconEnded(c) : true); };

    // Show/label the toolbar "Add N links" button based on resolved candidates.
    // A track is "missing" links when it has none of our providers linked
    // (at least one link → not missing) — parallels the ISRC "N missing" badge.
    function missingCount() {
      let n = 0;
      (RELEASE ? RELEASE.tracks : []).forEach(t => { if (t.recId && !providersFor(t).some(p => linkedUrl(t, p))) n++; });
      return n;
    }
    function updateAddBtn() {
      const m = missingCount();
      const badge = modal.querySelector('#ii-badge-links');   // tab badge = tracks with no link
      if (badge) badge.textContent = m ? (m + ' missing') : '';
      const n = modal.querySelectorAll('.ii-tl-add .ii-tl.new').length;   // resolved + addable now
      const linked = modal.querySelectorAll('.ii-tl-linked .ii-tl.linked').length;
      const total = RELEASE ? RELEASE.tracks.length : 0;
      const sum = modal.querySelector('#ii-summary-links');   // #301: Links-scope status bar
      if (sum) sum.innerHTML = '<b>' + total + '</b> tracks · <b>' + linked + '</b> link' + (linked === 1 ? '' : 's') +
        (m ? ' · <span style="color:#fd7e14">' + m + ' track' + (m === 1 ? '' : 's') + ' with none</span>' : '') +
        (n ? ' · <span style="color:#198754">' + n + ' to add</span>' : '');
      const btn = modal.querySelector('#ii-addlinks-btn');
      if (!btn) return;
      btn.style.display = n ? '' : 'none';
      btn.textContent = '➕ Add ' + n + ' link' + (n === 1 ? '' : 's');
      btn.disabled = !n;
    }

    // Throttled resolve pass: for every track with an ISRC and no existing link on
    // a provider, look the track up by ISRC and, if found, turn the icon into a
    // coloured "add" candidate (resolve only — no edits are made here).
    // #307: resolve one provider across all its candidate tracks, with a bounded
    // pool (p.conc workers) so a provider's own rate limit is respected while its
    // requests still overlap. Album providers fetch once (cached) then resolve
    // locally, so they run effectively instantly.
    async function resolveProvider(p) {
      if (p.album && !(RELEASE && RELEASE[p.urlKey])) return;   // album provider with no album link → nothing to resolve
      const jobs = [];
      for (let idx = 0; idx < RELEASE.tracks.length; idx++) {
        const t = RELEASE.tracks[idx];
        if (!t.recId) continue;
        const isrc = normalizeIsrc(t.pending) || normalizeIsrc((t.existing || [])[0] || '');
        if (!p.album && !isValidIsrc(isrc)) continue;  // by-ISRC providers need an ISRC; album ones don't
        if (linkedUrl(t, p)) continue;                 // already linked → leave monochrome
        const el = cell(idx, p.code);
        if (!el || !el.classList.contains('cand')) continue;
        el.className = 'ii-tl spin'; el.dataset.code = p.code;   // show all candidates spinning up front
        jobs.push({ idx, isrc, t });
      }
      let next = 0;
      const worker = async () => {
        while (next < jobs.length) {
          const j = jobs[next++];
          let url = null;
          try { url = await p.resolve(j.isrc, j.t, j.idx); } catch (e) { /* rate-limited / not found */ }
          const fresh = cell(j.idx, p.code);
          if (fresh) {
            if (url) makeNew(j.idx, p, url);
            else { fresh.className = 'ii-tl absent'; fresh.dataset.code = p.code; }
          }
          if (p.gap && next < jobs.length) await sleep(p.gap);
        }
      };
      await Promise.all(Array.from({ length: Math.min(p.conc || 1, jobs.length) }, worker));
    }

    async function resolve() {
      if (resolving) return;
      resolving = true;
      const btn = modal.querySelector('#ii-links-btn');
      if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
      try {
        await Promise.all(PROV.map(resolveProvider));   // #307: providers run in parallel
      } finally {
        resolving = false;
        if (btn) { btn.disabled = false; delete btn.dataset.busy; }
        updateAddBtn();
      }
    }

    // #301: per-track streaming links for export — what's linked plus what Find
    // links resolved, across our providers.
    function linkRows() {
      const rows = [];
      (RELEASE ? RELEASE.tracks : []).forEach((t, idx) => {
        if (!t.recId) return;
        const seen = new Set();
        (t.recUrls || []).forEach(u => { const p = PROV.find(x => x.test(u)); if (p && !seen.has(u)) { seen.add(u); rows.push({ recording: t.recId, track: t.title || '', provider: p.name, url: u, status: 'linked' }); } });
        const tr = tbody.querySelector('tr[data-idx="' + idx + '"]');
        if (tr) tr.querySelectorAll('.ii-tl-add .ii-tl.new').forEach(a => { const p = PROV.find(x => x.code === a.dataset.code); const u = a.getAttribute('href'); if (p && u && !seen.has(u)) { seen.add(u); rows.push({ recording: t.recId, track: t.title || '', provider: p.name, url: u, status: 'to add' }); } });
      });
      return rows;
    }

    return { linkedHtml, addHtml, resolve, addAll, refresh: updateAddBtn, removeOne, removeTrack, removeProvider, endOne, endTrack, endProvider, linkRows };
  })();

  /* ── render the track table ── */
  function renderTracks() {
    // #301: release title centered (Zen), artist + year on the line below
    modal.querySelector('#ii-rel-title').textContent = RELEASE.title || '';
    modal.querySelector('#ii-rel-sub').textContent = [RELEASE.artist, RELEASE.releaseYear].filter(Boolean).join(' · ');
    // Provider buttons (#180): show a provider only when the release has its
    // link in MB OR Platform Check found one. MB-linked buttons are marked
    // (ring + brand tint via .ii-mb); an unmarked button = a PC-found link.
    [['Deezer', 'ii-dz-all', 'deezerId'],
     ['Spotify', 'ii-sp-all', 'spotifyId'],
     ['Beatport', 'ii-bp-all', 'beatportId'],
     ['Tidal', 'ii-td-all', 'tidalId'],
     ['Volumo', 'ii-vo-all', 'volumoId'],
     ['HDtracks', 'ii-hd-all', 'hdtracksId']].forEach(([source, id, field]) => {
      const btn = modal.querySelector('#' + id);
      const mbId = RELEASE[field];
      // Spotify imports only via its MB-linked album (ISRC Hunt resolves the
      // release FROM the URL), so a PC-only Spotify link is not usable (#180).
      const hasPc = source !== 'Spotify' && !!platformCheckUrl(source);
      const rg = RELEASE.rgFrom && RELEASE.rgFrom[field];   // #302: pulled from a sibling release in the RG
      btn.style.display = (mbId || hasPc) ? '' : 'none';
      btn.classList.toggle('ii-mb', !!mbId);
      btn.classList.toggle('ii-rg', !!rg);
      btn.disabled = false;
      btn.title = rg ? ('Import from ' + source + ' (link from another release in this group' + (rg.title ? ': ' + rg.title : '') + ')')
        : mbId ? ('Import from ' + source + ' (linked in MusicBrainz)')
        : hasPc ? ('Import from ' + source + ' (link found by Platform Check — not yet in MB)')
        : ('No ' + source + ' link');
    });

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
        // col 4 — Existing ISRC (ISRC scope) / Linked providers (Links scope)
        '<td><div class="ii-existing ii-only-isrc">' + existingHtml(t.existing, t.pendingRemoval) + '</div>' +
          '<div class="ii-only-links">' + TrackLinks.linkedHtml(t) + '</div></td>' +
        // col 5 — New ISRC input + SoundExchange candidates (ISRC scope) / Add (Links scope).
        // .ii-cands is a sibling of .ii-inwrap (full-width, under the input), NOT inside it.
        '<td><div class="ii-only-isrc"><div class="ii-inwrap">' +
          '<div class="ii-input-box">' +
            '<input class="ii-input" type="text" maxlength="15" placeholder="—" value="' + esc(t.pending) + '">' +
            '<button class="ii-clear" type="button" tabindex="-1" title="Clear this field">×</button>' +
          '</div>' +
          // first track has no previous ISRC to increment — hide +1 but keep its slot so SX text stays aligned
          '<button class="ii-plus' + (idx === 0 ? ' ii-plus-hidden' : '') + '" title="Previous ISRC + 1  (right-click: fill the +1 sequence down to the last track, overwriting)">+1</button>' +
          '<span class="ii-sxsplit">' +
            '<button class="ii-sx" type="button" title="Look up this track\'s ISRC on SoundExchange — verify the entered ISRC, or (if empty) search by title/artist  ·  right-click: do all tracks">SX</button>' +
            '<button class="ii-sxprov" type="button" tabindex="-1" title="Choose the ISRC provider for all tracks">▾</button>' +
          '</span>' +
          '<span class="ii-lookup"></span>' +
          '</div><div class="ii-cands"></div></div>' +
          '<div class="ii-only-links">' + TrackLinks.addHtml(t) + '</div></td>';
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
        // #157: don't hit SoundExchange on every keystroke (that spammed SX).
        // Clear any stale bullet while editing; the SX check now fires on blur
        // (manual entry) or the row's [SX] button.
        const lk = rowLookup(idx); if (lk) { lk.className = 'ii-lookup'; lk.textContent = ''; lk.onclick = null; }
        const sxb = tr.querySelector('.ii-sx'); if (sxb) sxb.disabled = trackBtnDisabled(t, input.value);   // #157/#181: provider-aware enabled state
      });
      // Manual entry → verify on SoundExchange only when the field loses focus (#157).
      input.addEventListener('blur', () => {
        if (input.dataset.autofill === '1') return;   // filled by a source, not manual typing
        const v = normalizeIsrc(input.value);
        if (v && isValidIsrc(v)) lookupIsrc(idx, v).catch(e => { if (e && (e.rateLimited || e.captcha)) sxBlocked(e); });
      });
      const plusBtn = tr.querySelector('.ii-plus');
      if (plusBtn && idx > 0) {   // first row's +1 is a hidden spacer — don't wire it
        plusBtn.addEventListener('click', () => plusOne(idx));
        plusBtn.addEventListener('contextmenu', e => { e.preventDefault(); plusOneFillDown(idx); });
      }
      // Explicit per-track SoundExchange trigger (#157): the single by-ISRC fetch
      // the auto-call used to do. Verifies the ENTERED ISRC, or — when the field is
      // empty — an EXISTING ISRC already on the recording. Metadata search stays on
      // the separate "⚙ search SoundExchange…" entry. Disabled when there's nothing
      // to verify (no valid entered ISRC AND no existing ISRC).
      const sxBtn = tr.querySelector('.ii-sx');
      if (sxBtn) {
        sxBtn.disabled = trackBtnDisabled(t, input.value);
        sxBtn.addEventListener('click', () => runTrackSingle(idx));
        // right-click → run the current provider for ALL tracks (#181)
        sxBtn.addEventListener('contextmenu', e => { e.preventDefault(); runTrackAll(); });
      }
      // the ▾ next to each per-track button opens the shared provider menu (#181)
      const provBtn = tr.querySelector('.ii-sxprov');
      if (provBtn) provBtn.addEventListener('click', e => {
        e.stopPropagation();
        modal.querySelector('#ii-prov-menu').classList.contains('open') ? closeProvMenu() : openProvMenu(provBtn);
      });
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
    TrackLinks.refresh();   // #301: set the Links tab "N missing" badge
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
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.releaseYear);
      const good = cls === 'best';
      const rel = [f.relTitle, f.relLabel, f.relDate].filter(Boolean).join(' · ');
      el.className = 'ii-lookup ' + (good ? 'ok' : 'warn');
      el.innerHTML = (good ? '✓ ' : '⚠ ') + sxMetaHtml(f, t) +
        (rel ? '<br><span class="ii-lookup-rel">' + esc(rel) + '</span>' : '');
      el.title = [f.title, f.artist, f.year, f.dur].filter(Boolean).join(' · ') + (rel ? '  |  ' + rel : '');
      Log.info('SX lookup ' + isrc + ': ' + (good ? 'match' : cls === 'warn' ? 'length mismatch' : 'MISMATCH') + ' "' + f.title + '" — ' + f.artist);
    }).catch(e => {
      if (e && (e.rateLimited || e.captcha)) { el.className = 'ii-lookup err'; el.textContent = e.captcha ? '⚠ captcha' : '⚠ rate-limited'; throw e; }   // let pumpVerify stop the queue (#126/#157)
      el.className = 'ii-lookup err'; el.textContent = '✗ lookup failed'; Log.err('SX lookup ' + isrc + ' failed: ' + e.message);
    });
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
    const myEpoch = _sxEpoch;   // bumped by abortSxWork / a 429 → this loop bails (#126/#127)
    try {
      while (_vq.items.length) {
        if (myEpoch !== _sxEpoch) return;                                 // cancelled (clear / close / rate-limit)
        if (_vq.done >= SX_BATCH_LIMIT) { showVerifyPauses(); return; }
        const { idx, isrc } = _vq.items.shift();
        const t = RELEASE.tracks[idx];
        // skip if the field no longer holds this value (user changed it meanwhile)
        if (!t || !isValidIsrc(isrc) || normalizeIsrc(t.pending) !== normalizeIsrc(isrc)) continue;
        const cached = !!_isrcLookupCache[isrc];   // primed SX rows → no request, no pacing/cap
        try { await lookupIsrc(idx, isrc); } catch (e) { if (e && (e.rateLimited || e.captcha)) { sxBlocked(e); return; } }
        if (myEpoch !== _sxEpoch) return;                                 // cancelled while the request was in flight
        if (!cached) { _vq.done++; if (_vq.items.length && _vq.done < SX_BATCH_LIMIT) await sleep(BATCH_DELAY); }
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
    { const sxb = input.closest('tr')?.querySelector('.ii-sx'); if (sxb) sxb.disabled = trackBtnDisabled(t, t.pending); }   // #157/#181: keep per-track button enabled-state in sync after a fill
    // #157: do NOT auto-hit SoundExchange on fills. Deezer/Spotify/+1/paste fills
    // used to enqueue a per-track SX verify, which spammed SX (and double-hit it
    // during the bulk SX search). Now we only show the match bullet when the SX
    // data is ALREADY cached — i.e. an SX-sourced pick, whose by-ISRC lookup is
    // served from cache with no request (renderCands / the panel prime the cache).
    // Everything else stays blank; verify it via the row [SX] button, by blurring
    // a manual entry, or the bulk SoundExchange search.
    const lk0 = rowLookup(idx);
    if (isValidIsrc(t.pending) && _isrcLookupCache[t.pending]) {
      enqueueVerify(idx, t.pending);   // cached → free
    } else if (lk0) { lk0.className = 'ii-lookup'; lk0.textContent = ''; lk0.onclick = null; }
    if (flash) {
      const tr = input.closest('tr');
      tr.classList.remove('ii-row-fill'); void tr.offsetWidth; tr.classList.add('ii-row-fill');
    }
  }

  function clearPending() {
    abortSxWork('clear entered');            // cancel queued verifications + the bulk SX search (#127)
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

  // Right-click +1: fill an incrementing ISRC from here all the way to the LAST
  // track, overwriting whatever's in each New-ISRC field.
  function plusOneFillDown(idx) {
    let base = '';
    for (let i = idx - 1; i >= 0; i--) {
      base = RELEASE.tracks[i].pending || RELEASE.tracks[i].existing[0] || '';
      if (base) break;
    }
    if (!base) { toast('No previous ISRC to increment'); return; }
    let count = 0;
    for (let i = idx; i < RELEASE.tracks.length; i++) {
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
    RELEASE.tracks.forEach((t, i) => {
      const rowMissing = !t.existing.length && !t.pending;
      if (rowMissing) missing++;
      const row = tbody && tbody.querySelector('tr[data-idx="' + i + '"]');   // #159: flag still-missing rows
      if (row) row.classList.toggle('ii-row-missing', rowMissing);
      if (!t.pending) return;
      const v = normalizeIsrc(t.pending);
      if (!isValidIsrc(v)) { bad++; return; }
      if (t.existing.includes(v)) { dup++; return; }        // already on this recording
      if (dupSet.has(v)) { crossDup++; return; }            // same ISRC on another recording → blocked
      valid++;
    });
    const isrcBadge = modal.querySelector('#ii-badge-isrc');   // #301: tab count
    if (isrcBadge) isrcBadge.textContent = missing ? (missing + ' missing') : '';
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
  // #340: a recording can carry MORE THAN ONE ISRC — collect them all (existing + the pending one),
  // deduped + validated, so the export never drops the 2nd/3rd ISRC of a track.
  function allIsrcs(t) {
    const out = [];
    for (const raw of [...(t.existing || []), t.pending]) {
      const v = normalizeIsrc(raw);
      if (v && isValidIsrc(v) && !out.includes(v)) out.push(v);
    }
    return out;
  }
  function exportText() {
    const out = RELEASE.tracks.map(t => allIsrcs(t).join(' ')).join('\n');   // one line per track; multiple ISRCs space-separated
    copyToClipboard(out, out.split('\n').length + ' lines copied');
  }
  function exportJson() {
    const obj = {};
    RELEASE.tracks.forEach(t => {
      const arr = allIsrcs(t);
      if (arr.length && t.recId) obj[t.recId] = arr.length === 1 ? arr[0] : arr;   // string for one ISRC (back-compat), array for several
    });
    copyToClipboard(JSON.stringify(obj, null, 2), 'JSON copied');
  }
  // #301: export the per-track streaming links (linked + resolved) as CSV / JSON / URL list
  function exportLinks(fmt) {
    const rows = TrackLinks.linkRows();
    const note = modal.querySelector('#ii-link-export-note');
    if (!rows.length) { if (note) note.textContent = 'No links yet — run 🔗 Find links first (or this release has none of our providers linked).'; toast('No links to export', 'err'); return; }
    let out, msg;
    if (fmt === 'urls') {
      out = [...new Set(rows.map(r => r.url))].join('\n'); msg = out.split('\n').length + ' URLs copied';
    } else if (fmt === 'json') {
      out = JSON.stringify(rows, null, 2); msg = rows.length + ' links copied (JSON)';
    } else {
      const esc = s => /[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : s;
      out = ['recording,track,provider,url,status'].concat(rows.map(r => [r.recording, r.track, r.provider, r.url, r.status].map(esc).join(','))).join('\n');
      msg = rows.length + ' links copied (CSV)';
    }
    copyToClipboard(out, msg);
    if (note) { const linked = rows.filter(r => r.status === 'linked').length; note.textContent = rows.length + ' links · ' + linked + ' linked · ' + (rows.length - linked) + ' to add'; }
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
    // prime the by-ISRC lookup cache from these search rows, so when one is picked
    // the verification bullet renders instantly (no extra SoundExchange request)
    (rows || []).forEach(item => { const iso = normalizeIsrc(SX.fields(item).isrc); if (iso && !_isrcLookupCache[iso]) _isrcLookupCache[iso] = [item]; });
    (rows || []).slice(0, 5).forEach(item => {
      const f = SX.fields(item);
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.releaseYear);
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
    // #285: Esc closes the window (sub-popups consume it first). Data is preserved.
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !modal.classList.contains('open')) return;
      if (sxPanel.classList.contains('open')) return;                                   // handled by its own (capture) listener above
      const pm = modal.querySelector('#ii-prov-menu'); if (pm && pm.classList.contains('open')) { closeProvMenu(); return; }
      const ua = modal.querySelector('#ii-urladd'); if (ua && ua.classList.contains('open')) return;   // the url-add field closes itself
      closeModal();
    });
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
      goBtn.disabled = false; stEl.className = 'ii-sxp-status err'; resEl.innerHTML = '';
      if (e && (e.rateLimited || e.captcha)) { stEl.textContent = e.captcha ? '⚠ captcha — resolve in browser, then retry' : '⚠ rate-limited — wait a minute'; sxBlocked(e); }
      else stEl.textContent = '⚠ ' + e.message;
    });
  }
  function renderSxPanelResults(idx, rows) {
    const t = RELEASE.tracks[idx];
    const resEl = sxPanel.querySelector('.ii-sxp-results');
    resEl.innerHTML = '';
    // prime the by-ISRC cache so picking a result verifies instantly (no extra request)
    rows.forEach(item => { const iso = normalizeIsrc(SX.fields(item).isrc); if (iso && !_isrcLookupCache[iso]) _isrcLookupCache[iso] = [item]; });
    rows.forEach(item => {
      const f = SX.fields(item);
      const cls = SX.classify(f, t.title, t.artist, t.dur, RELEASE.releaseYear);
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
        collapseCandsTo(idx, f.isrc);
        sxPanel.classList.remove('open');   // picked a result → close the search panel
      });
      resEl.appendChild(row);
    });
  }

  // SoundExchange batch state — we search at most SX_BATCH_LIMIT tracks at a time
  // so SX doesn't block us; the rest show a "not loaded" message you click to continue.
  let _sxTodo = [], _sxCursor = 0, _sxMatched = 0, _sxFilled = 0, _sxRunning = false, _sxEpoch = 0;
  // Cancel ALL batched SoundExchange work — queued verifications and the bulk search — and abort any
  // in-flight SX request. Bumping the epoch makes the running loops bail at their next checkpoint. #127
  function abortSxWork(reason) {
    _sxEpoch++;
    _vq.items = []; _vq.done = 0; _vq.running = false;
    _sxTodo = []; _sxCursor = 0; _sxRunning = false;
    _deferredVerify.clear(); _deferVerify = false;
    abortInflight('soundexchange');
    const btn = modal && modal.querySelector('#ii-sx-all'); if (btn) btn.disabled = false;
    if (progEl) { progEl.textContent = ''; progEl.classList.remove('err'); }
    if (reason) Log.info('SoundExchange: cancelled all queued work (' + reason + ')');
  }
  // SoundExchange blocked us — either a rate limit (HTTP 429) or a captcha (HTTP
  // 202 {"searchCaptcha": true}, #157). Either way: stop the bulk run, abort
  // in-flight requests, and surface the cause + how to recover in the toolbar.
  // The captcha needs the user to solve it on SX's site, so we link there. #126/#157
  function sxBlocked(err) {
    _sxEpoch++;                              // stop the running loops — don't issue any more requests
    _sxRunning = false; _vq.running = false;
    abortInflight('soundexchange');
    const btn = modal && modal.querySelector('#ii-sx-all'); if (btn) btn.disabled = false;
    if (err && err.captcha) {
      if (progEl) {
        progEl.classList.add('err');
        progEl.textContent = '⚠ SoundExchange captcha — ';
        const a = document.createElement('a');
        a.href = SX_HOME; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'resolve captcha in browser to unblock ↗';
        progEl.appendChild(a);
        const tail = document.createElement('span'); tail.textContent = ', then retry'; progEl.appendChild(tail);
      }
      toast('SoundExchange captcha — resolve it in the browser, then retry.', 'err');
      Log.warn('SoundExchange captcha (202 searchCaptcha) — bulk search stopped; resolve in browser to unblock');
    } else {
      if (progEl) { progEl.textContent = '⚠ SoundExchange rate-limited (HTTP 429) — paused; wait a minute and retry'; progEl.classList.add('err'); }
      toast('SoundExchange rate-limited (429) — stopped. Wait a minute and retry.', 'err');
      Log.warn('SoundExchange rate-limited (429) — bulk search stopped');
    }
  }

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
    const myEpoch = _sxEpoch;   // a clear / close / 429 bumps this → bail without writing stale results (#126/#127)
    const btn = modal.querySelector('#ii-sx-all');
    btn.disabled = true;
    if (progEl) progEl.classList.remove('err');   // clear any prior rate-limit warning on a fresh run
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
        if (myEpoch !== _sxEpoch) return;                  // cancelled (clear / close) while in flight
        renderCands(i, rows);
        const best = rows.find(r => SX.classify(SX.fields(r), t.title, t.artist, t.dur, RELEASE.releaseYear) === 'best');
        const bestIsrc = best && SX.fields(best).isrc;
        if (bestIsrc) {
          _sxMatched++;
          // autofill the input only when it's empty AND the match is a NEW isrc
          if (!t.pending && !t.existing.includes(bestIsrc)) { setPending(i, bestIsrc, true, 'SoundExchange'); collapseCandsTo(i, bestIsrc); _sxFilled++; }
        }
        Log.info('SX #' + (t.number || t.trackPos) + ' "' + t.title + '": ' + rows.length + ' result(s)' +
          (bestIsrc ? ', best ' + bestIsrc + (t.existing.includes(bestIsrc) ? ' (already in MB)' : '') : ', no confident match'));
      } catch (e) {
        if (myEpoch !== _sxEpoch) return;                  // cancelled while in flight
        if (e && (e.rateLimited || e.captcha)) {
          // SoundExchange 429 (rate limit) or 202 captcha → stop the whole bulk run;
          // leave the unsearched rows (incl. this one) as click-to-retry placeholders,
          // and surface the cause + recovery in the toolbar. #126/#157
          _sxCursor += n;
          const left = _sxTodo.length - _sxCursor;
          if (left > 0) _sxTodo.slice(_sxCursor).forEach(j => sxPlaceholder(j, left));
          sxBlocked(e);
          return;
        }
        renderCands(i, []);
        Log.err('SX #' + (t.number || t.trackPos) + ' "' + t.title + '" failed: ' + e.message);
      }
      n++;
      updateSummary();
      if (n < batch.length) await sleep(BATCH_DELAY);
      if (myEpoch !== _sxEpoch) return;                    // cancelled during the pacing delay
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
    // #285: the provider just used to match all tracks becomes the per-track default
    // (no-op for non-per-track providers like Spotify, and when already selected).
    const _provKey = (label || '').toLowerCase();
    if (trackProv !== _provKey) setTrackProvider(_provKey);
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

  // Run a provider's import using its in-MB album id, falling back to the URL
  // Platform Check found (#180 — a provider button is only shown when one of
  // those exists, so this resolves unless the link vanished mid-session).
  async function runProvider(source, mbId, fetcher, btnSel) {
    const id = providerAlbumId(source, mbId);
    if (!id) { Log.warn(source + ': no ' + source + ' link on this release'); return; }
    const btn = modal.querySelector(btnSel); btn.disabled = true;
    Log.info(source + ': importing album ' + id);
    try { await runStreamingSource(source, id, fetcher); }
    finally { btn.disabled = false; }   // always re-enable, even if something throws
  }
  async function runDeezer()   { return runProvider('Deezer',   RELEASE.deezerId,   fetchDeezer,   '#ii-dz-all'); }
  async function runSpotify()  { return runProvider('Spotify',  RELEASE.spotifyId,  fetchSpotify,  '#ii-sp-all'); }
  async function runBeatport() { return runProvider('Beatport', RELEASE.beatportId, fetchBeatport, '#ii-bp-all'); }
  async function runTidal()    { return runProvider('Tidal',    RELEASE.tidalId,    fetchTidal,    '#ii-td-all'); }
  async function runVolumo()   { return runProvider('Volumo',   RELEASE.volumoId,   fetchVolumo,   '#ii-vo-all'); }
  async function runHDtracks() { return runProvider('HDtracks', RELEASE.hdtracksId, fetchHDtracks, '#ii-hd-all'); }
  // Map a source label to its fetcher (used by the unified URL-paste import).
  function fetcherFor(source) {
    return source === 'Deezer'   ? fetchDeezer
         : source === 'Spotify'  ? fetchSpotify
         : source === 'Beatport' ? fetchBeatport
         : source === 'Tidal'    ? fetchTidal
         : source === 'Volumo'   ? fetchVolumo
         : source === 'HDtracks' ? fetchHDtracks
         : null;
  }

  /* ── source links & the unified "paste a URL" control (#180) ── */
  // Source name → SRC_ICON key / brand colour, for the URL-add detection feedback.
  const SRC_CODE  = { Deezer: 'dz', Spotify: 'sp', Beatport: 'bp', Tidal: 'td', Volumo: 'vo', HDtracks: 'hd' };
  const SRC_COLOR = { dz: '#ef5466', sp: '#1db954', bp: '#0a8754', td: '#1f2d3d', vo: '#7c4dff', hd: '#e63329' };

  // If Platform Check (separate userscript) is on the page, read the URL it found
  // for this source from its sidebar anchor (#mb-online-<source>).
  function platformCheckUrl(source) {
    const key = source.toLowerCase();
    const a = document.getElementById('mb-online-' + key);
    if (!a) return null;                                    // Platform Check not installed
    const href = a.getAttribute('href') || '';
    if (!/^https?:\/\//.test(href)) return null;            // nothing found yet ('#')
    // Skip low-quality matches: PC marks its row pc-st-match (good), pc-st-mismatch
    // (found but wrong — dimmed), or pc-st-notfound. Only trust a confident match (#180).
    const row = document.getElementById('row-' + key);
    if (row && !row.classList.contains('pc-st-match')) {
      // #211: a link PC withheld ONLY by its barcode/format link-confidence CAN still
      // be the right album for ISRC purposes — an ISRC identifies a recording, which is
      // independent of the release's barcode/format. PC demotes such a row to
      // pc-st-mismatch but flags it pc-blocked while leaving the content-match glyph
      // intact (✓ = found+counts, ? = found).
      // #314: but a barcode mismatch can also mean PC simply matched the WRONG release
      // (e.g. a 1-track Beatport single by a same-prefixed artist), so by DEFAULT we now
      // respect PC's confidence and reject these too. Only accept them when the user has
      // opted into "Ignore Platform Check link confidence". A genuine content mismatch (~)
      // or not-found (×) is always rejected.
      const glyph = ((document.getElementById('ico-' + key) || {}).textContent || '').trim();
      const lenient = ignorePcConfidence() && row.classList.contains('pc-blocked') && (glyph === '✓' || glyph === '?');
      if (!lenient) return null;
    }
    return parseStreamingId(source, href) ? href : null;    // only if it parses to an album id
  }
  // Album id for a provider button: prefer the in-MB link, else fall back to the
  // URL Platform Check found (which is why the button is shown at all).
  function providerAlbumId(source, mbId) {
    if (mbId) return mbId;
    const pc = platformCheckUrl(source);
    return pc ? parseStreamingId(source, pc) : null;
  }
  // Detect which streaming platform a pasted URL belongs to (domain-based, so a
  // bare numeric id — ambiguous across platforms — is intentionally not matched).
  function detectSource(input) {
    const s = String(input || '').trim();
    const mk = source => { const id = parseStreamingId(source, s); return id ? { source, code: SRC_CODE[source], id } : null; };
    if (/deezer\.com/i.test(s)) return mk('Deezer');
    if (/beatport\.com/i.test(s)) return mk('Beatport');
    if (/tidal\.com/i.test(s)) return mk('Tidal');
    if (/volumo\.com/i.test(s)) return mk('Volumo');
    if (/hdtracks\.com/i.test(s)) return mk('HDtracks');
    // Spotify intentionally NOT detected here: its import resolves the MB release
    // FROM the Spotify URL (ISRC Hunt), so a non-MB URL can't work (#180). It's
    // offered only as a provider button when the release has a Spotify MB link.
    return null;
  }
  // Live feedback: show the detected platform's icon (in brand colour) on the +
  // button, or reset to a plain + when nothing recognizable is typed.
  function reflectDetectedSource(value) {
    const btn = document.getElementById('ii-url-btn');
    if (!btn) return;
    const d = detectSource(value);
    if (d) {
      btn.innerHTML = SRC_ICON[d.code] || '+';
      btn.style.color = SRC_COLOR[d.code] || '';
      btn.title = d.source + ' detected — press Enter to import its ISRCs';
    } else {
      btn.textContent = '+';
      btn.style.color = '';
      btn.title = 'Paste a streaming URL (Deezer / Spotify / Beatport / Tidal / Volumo / HDtracks) — auto-detected and imported';
    }
  }
  async function submitUrlAdd(value) {
    const v = String(value || '').trim();
    const d = detectSource(v);
    if (!d) {
      if (/open\.spotify\.com|spotify:album:/i.test(v)) {
        toast('Spotify can only be imported from its MusicBrainz-linked album — use the Spotify button', 'err');
      } else if (v) {
        toast('Unrecognized URL — paste a Deezer, Beatport, Tidal, Volumo or HDtracks album link', 'err'); Log.warn('URL import: unrecognized "' + v + '"');
      }
      return;
    }
    Log.info(d.source + ': importing pasted album ' + d.id);
    await runStreamingSource(d.source, d.id, fetcherFor(d.source));
  }
  function parseStreamingId(source, input) {
    const s = String(input || '').trim();
    if (source === 'Deezer') {
      const m = s.match(/deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/);
      return m ? m[1] : (/^\d+$/.test(s) ? s : null);
    }
    if (source === 'Beatport') {
      const m = s.match(/beatport\.com\/release\/[^/]+\/(\d+)/);
      return m ? m[1] : (/^\d+$/.test(s) ? s : null);
    }
    if (source === 'Tidal') {
      const m = s.match(/(?:listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/);
      return m ? m[1] : (/^\d+$/.test(s) ? s : null);
    }
    if (source === 'Volumo') {
      const m = s.match(/volumo\.com\/album\/(\d+)/);   // id or leading ICPN in the canonical /album/{icpn}-{slug}
      return m ? m[1] : (/^\d+$/.test(s) ? s : null);
    }
    if (source === 'HDtracks') {
      // new API form #/album/<24-hex ObjectId>; legacy valbum_code=<UPC> resolves
      // via barcode search. A bare 24-hex id or a bare 8+ digit barcode also work.
      let m = s.match(/hdtracks\.com\/(?:#\/)?album\/([a-f0-9]{24})/i);
      if (m) return m[1];
      m = s.match(/[?&]valbum_code=(\d{8,})/i);
      if (m) return m[1];
      return /^[a-f0-9]{24}$/i.test(s) ? s : (/^\d{8,}$/.test(s) ? s : null);
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
    const note = getRemovalNote(recs, total);
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
    // ISRC Scout's own radar/target logo (monochrome via currentColor so it reads
    // white on the purple/pink button), replacing the generic magnifying glass.
    '<svg width="14" height="14" viewBox="0 0 128 128" fill="none" stroke="currentColor" aria-hidden="true"><path d="M64 64 L64 24 A40 40 0 0 1 99 84 Z" fill="currentColor" opacity=".35" stroke="none"/><g stroke-width="8"><circle cx="64" cy="64" r="40"/><circle cx="64" cy="64" r="26" stroke-width="6"/><circle cx="64" cy="64" r="13" stroke-width="6"/></g><line x1="64" y1="64" x2="64" y2="24" stroke-width="8" stroke-linecap="round"/><circle cx="86" cy="50" r="9" fill="currentColor" stroke="none"/></svg>' +
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
  // Only the release *overview* page (`/release/<mbid>`) — not its subpages
  // (/edit, /edit-relationships, /aliases, /tags, …) which also match `release/*`.
  const IS_OVERVIEW = /^\/release\/[a-f0-9-]{36}\/?$/.test(location.pathname);
  whenDomReady(() => {
    if (!IS_OVERVIEW) return;
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

  // initial status fetch (also primes RELEASE for the modal) — overview page only
  if (IS_OVERVIEW) {
    fetchRelease().then(updateBtnStatus).catch(() => {
      const s = document.getElementById('ii-btn-status'); if (s) s.textContent = '?';
    });
  }

})();
