// ==UserScript==
// @name         Fuzzy Logic
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.11.08.104441
// @description  Collects genres and tags from an entity's linked pages (Bandcamp, Discogs, Deezer, Apple Music, AllMusic, Beatport, Wikidata, SoundCloud, VocaDB, Last.fm), maps them to MusicBrainz genres and votes the ones you pick in one batch, optionally on the release group and recordings too. Replaces Taggregator.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNmbDAiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxMmQ0ZjciLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM0OWI2ZjgiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0idmZsMCIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzc2NjVmYSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2VjNDFjOSIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJhZmwwIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZkNTZiIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmY4MzIwIi8+PC9saW5lYXJHcmFkaWVudD48ZmlsdGVyIGlkPSJnZmwwIiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIzIi8+PC9maWx0ZXI+PC9kZWZzPjxnIGZpbGwtb3BhY2l0eT0iLjI4Ij48Y2lyY2xlIGN4PSIxMjgiIGN5PSI4NCIgcj0iNTQiIGZpbGw9IiMxNmNjZjgiLz48Y2lyY2xlIGN4PSI4OSIgY3k9IjE1MCIgcj0iNTQiIGZpbGw9IiNiYTU2ZTkiLz48Y2lyY2xlIGN4PSIxNjciIGN5PSIxNTAiIHI9IjU0IiBmaWxsPSIjZmZhZTM4Ii8+PC9nPjxnIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iNyIgb3BhY2l0eT0iLjI4IiBmaWx0ZXI9InVybCgjZ2ZsMCkiPjxjaXJjbGUgY3g9IjEyOCIgY3k9Ijg0IiByPSI1NCIgc3Ryb2tlPSIjMTZjY2Y4Ii8+PGNpcmNsZSBjeD0iODkiIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9IiNiYTU2ZTkiLz48Y2lyY2xlIGN4PSIxNjciIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9IiNmZmFlMzgiLz48L2c+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSI2LjUiPjxjaXJjbGUgY3g9IjEyOCIgY3k9Ijg0IiByPSI1NCIgc3Ryb2tlPSJ1cmwoI2NmbDApIi8+PGNpcmNsZSBjeD0iODkiIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9InVybCgjdmZsMCkiLz48Y2lyY2xlIGN4PSIxNjciIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9InVybCgjYWZsMCkiLz48L2c+PC9zdmc+
// @match        *://*.musicbrainz.org/release/*
// @match        *://*.musicbrainz.org/release-group/*
// @match        *://*.musicbrainz.org/artist/*
// @match        *://*.musicbrainz.org/label/*
// @match        *://*.musicbrainz.org/recording/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      bandcamp.com
// @connect      api.discogs.com
// @connect      api.deezer.com
// @connect      itunes.apple.com
// @connect      www.allmusic.com
// @connect      www.beatport.com
// @connect      query.wikidata.org
// @connect      soundcloud.com
// @connect      vocadb.net
// @connect      www.last.fm
// @connect      *
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (!mbuClaim('fuzzy_logic', 'Fuzzy Logic')) return;

  const NAME = 'Fuzzy Logic';
  const VER = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '0';
  // its own gradient ids each time, so two copies on a page don't share them
  let flIc = 0;
  const flSvg = (px) => { const id = "fl" + (++flIc); return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\"><defs><linearGradient id=\"c" + id + "\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#12d4f7\"/><stop offset=\"1\" stop-color=\"#49b6f8\"/></linearGradient><linearGradient id=\"v" + id + "\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#7665fa\"/><stop offset=\"1\" stop-color=\"#ec41c9\"/></linearGradient><linearGradient id=\"a" + id + "\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffd56b\"/><stop offset=\"1\" stop-color=\"#ff8320\"/></linearGradient><filter id=\"g" + id + "\" x=\"-30%\" y=\"-30%\" width=\"160%\" height=\"160%\"><feGaussianBlur stdDeviation=\"3\"/></filter></defs><g fill-opacity=\".28\"><circle cx=\"128\" cy=\"84\" r=\"54\" fill=\"#16ccf8\"/><circle cx=\"89\" cy=\"150\" r=\"54\" fill=\"#ba56e9\"/><circle cx=\"167\" cy=\"150\" r=\"54\" fill=\"#ffae38\"/></g><g fill=\"none\" stroke-width=\"7\" opacity=\".28\" filter=\"url(#g" + id + ")\"><circle cx=\"128\" cy=\"84\" r=\"54\" stroke=\"#16ccf8\"/><circle cx=\"89\" cy=\"150\" r=\"54\" stroke=\"#ba56e9\"/><circle cx=\"167\" cy=\"150\" r=\"54\" stroke=\"#ffae38\"/></g><g fill=\"none\" stroke-width=\"6.5\"><circle cx=\"128\" cy=\"84\" r=\"54\" stroke=\"url(#c" + id + ")\"/><circle cx=\"89\" cy=\"150\" r=\"54\" stroke=\"url(#v" + id + ")\"/><circle cx=\"167\" cy=\"150\" r=\"54\" stroke=\"url(#a" + id + ")\"/></g></svg>".replace('<svg ', '<svg width="' + px + '" height="' + px + '" aria-hidden="true" '); };
  const ICON = flSvg(20), ICON_SM = flSvg(16);
  const ICON_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNmbDAiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxMmQ0ZjciLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM0OWI2ZjgiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0idmZsMCIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzc2NjVmYSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2VjNDFjOSIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJhZmwwIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZkNTZiIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmY4MzIwIi8+PC9saW5lYXJHcmFkaWVudD48ZmlsdGVyIGlkPSJnZmwwIiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIzIi8+PC9maWx0ZXI+PC9kZWZzPjxnIGZpbGwtb3BhY2l0eT0iLjI4Ij48Y2lyY2xlIGN4PSIxMjgiIGN5PSI4NCIgcj0iNTQiIGZpbGw9IiMxNmNjZjgiLz48Y2lyY2xlIGN4PSI4OSIgY3k9IjE1MCIgcj0iNTQiIGZpbGw9IiNiYTU2ZTkiLz48Y2lyY2xlIGN4PSIxNjciIGN5PSIxNTAiIHI9IjU0IiBmaWxsPSIjZmZhZTM4Ii8+PC9nPjxnIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iNyIgb3BhY2l0eT0iLjI4IiBmaWx0ZXI9InVybCgjZ2ZsMCkiPjxjaXJjbGUgY3g9IjEyOCIgY3k9Ijg0IiByPSI1NCIgc3Ryb2tlPSIjMTZjY2Y4Ii8+PGNpcmNsZSBjeD0iODkiIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9IiNiYTU2ZTkiLz48Y2lyY2xlIGN4PSIxNjciIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9IiNmZmFlMzgiLz48L2c+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSI2LjUiPjxjaXJjbGUgY3g9IjEyOCIgY3k9Ijg0IiByPSI1NCIgc3Ryb2tlPSJ1cmwoI2NmbDApIi8+PGNpcmNsZSBjeD0iODkiIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9InVybCgjdmZsMCkiLz48Y2lyY2xlIGN4PSIxNjciIGN5PSIxNTAiIHI9IjU0IiBzdHJva2U9InVybCgjYWZsMCkiLz48L2c+PC9zdmc+';
  const BUSY_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNmbDAiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxMmQ0ZjciLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM0OWI2ZjgiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0idmZsMCIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzc2NjVmYSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2VjNDFjOSIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJhZmwwIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZkNTZiIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmY4MzIwIi8+PC9saW5lYXJHcmFkaWVudD48ZmlsdGVyIGlkPSJnZmwwIiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIzIi8+PC9maWx0ZXI+PC9kZWZzPjxzdHlsZT5jaXJjbGV7YW5pbWF0aW9uOmMwIDEuNnMgY3ViaWMtYmV6aWVyKC40LDAsLjIsMSkgaW5maW5pdGV9LnIxe2FuaW1hdGlvbi1uYW1lOmMxfS5yMnthbmltYXRpb24tbmFtZTpjMn1Aa2V5ZnJhbWVzIGMwezUwJXt0cmFuc2Zvcm06dHJhbnNsYXRlKDAsMjQuMnB4KX19QGtleWZyYW1lcyBjMXs1MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZSgyMS41cHgsLTEyLjFweCl9fUBrZXlmcmFtZXMgYzJ7NTAle3RyYW5zZm9ybTp0cmFuc2xhdGUoLTIxLjVweCwtMTIuMXB4KX19QG1lZGlhIChwcmVmZXJzLXJlZHVjZWQtbW90aW9uOnJlZHVjZSl7Y2lyY2xle2FuaW1hdGlvbi1kdXJhdGlvbjo0c319PC9zdHlsZT48ZyBmaWxsLW9wYWNpdHk9Ii4yOCI+PGNpcmNsZSBjbGFzcz0icjAiIGN4PSIxMjgiIGN5PSI4NCIgcj0iNTQiIGZpbGw9IiMxNmNjZjgiLz48Y2lyY2xlIGNsYXNzPSJyMSIgY3g9Ijg5IiBjeT0iMTUwIiByPSI1NCIgZmlsbD0iI2JhNTZlOSIvPjxjaXJjbGUgY2xhc3M9InIyIiBjeD0iMTY3IiBjeT0iMTUwIiByPSI1NCIgZmlsbD0iI2ZmYWUzOCIvPjwvZz48ZyBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjciIG9wYWNpdHk9Ii4yOCIgZmlsdGVyPSJ1cmwoI2dmbDApIj48Y2lyY2xlIGNsYXNzPSJyMCIgY3g9IjEyOCIgY3k9Ijg0IiByPSI1NCIgc3Ryb2tlPSIjMTZjY2Y4Ii8+PGNpcmNsZSBjbGFzcz0icjEiIGN4PSI4OSIgY3k9IjE1MCIgcj0iNTQiIHN0cm9rZT0iI2JhNTZlOSIvPjxjaXJjbGUgY2xhc3M9InIyIiBjeD0iMTY3IiBjeT0iMTUwIiByPSI1NCIgc3Ryb2tlPSIjZmZhZTM4Ii8+PC9nPjxnIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iNi41Ij48Y2lyY2xlIGNsYXNzPSJyMCIgY3g9IjEyOCIgY3k9Ijg0IiByPSI1NCIgc3Ryb2tlPSJ1cmwoI2NmbDApIi8+PGNpcmNsZSBjbGFzcz0icjEiIGN4PSI4OSIgY3k9IjE1MCIgcj0iNTQiIHN0cm9rZT0idXJsKCN2ZmwwKSIvPjxjaXJjbGUgY2xhc3M9InIyIiBjeD0iMTY3IiBjeT0iMTUwIiByPSI1NCIgc3Ryb2tlPSJ1cmwoI2FmbDApIi8+PC9nPjwvc3ZnPg==';   // the dock's icon while it works: the rings slide together and part

  // <ST-NET> — generated by dev/net/sync-gate.mjs from dev/net/mb-gate.mjs — DO NOT EDIT
  const MBN_GAP = 1000;
  const MBN_BURST = 3;
  const MBN_KEY = "mbu:mb-gate";
  const MBN_LOCK = "mbu-mb-gate";
  const MBN_MAX_HOLD = 60000;
  const MBN_MAX_LEAD = 10000;
  function mbnGated(url) {
      const s = String(url || '');
      return /^\/ws\/2\//.test(s) || /^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org\/ws\/2\//i.test(s);
  }
  async function mbnState(fn) {
      const rw = () => {
          let s = null, stored = true;
          try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { stored = false; }
          const g = globalThis.__mbnGate || (globalThis.__mbnGate = { tat: 0, cool: 0, hot: 0 });
          if (!stored) s = g;                                                        // no storage: this page's copy only
          else if (!s || typeof s !== 'object') s = { tat: 0, cool: 0, hot: 0 };   // none yet (or cleared): a fresh schedule
          const out = fn(s);
          Object.assign(g, s);
          try { localStorage.setItem(MBN_KEY, JSON.stringify({ tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0, lead: s.lead || '', leadUntil: s.leadUntil || 0 })); } catch (e) {}
          return out;
      };
      // The lock is held only for rw()'s synchronous moment, so a wait of seconds means it is
      // stuck (a frozen or sandboxed holder): give up on it and go unlocked rather than hang
      // every request behind it.
      let timer = 0;
      try {
          if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
              const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
              if (ctrl) timer = setTimeout(() => ctrl.abort(), 3000);
              return await navigator.locks.request(MBN_LOCK, ctrl ? { signal: ctrl.signal } : {}, rw);
          }
      } catch (e) { /* no Web Locks here (an insecure or sandboxed context), or stuck: unlocked, like a lone script */ } finally { clearTimeout(timer); }
      return rw();
  }
  async function mbnSlot(o) {
      o = o || {};
      const t0 = Date.now(), background = o.background !== false;
      // someone else's lead: a background request books its slot only once it ends or lapses
      for (let told = false; background;) {
          let s = null;
          try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { s = globalThis.__mbnGate; }
          const left = s && s.lead && s.lead !== o.lead ? Math.min((s.leadUntil || 0) - Date.now(), MBN_MAX_LEAD) : 0;
          if (left <= 0) break;
          if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
          if (!told && o.log) { told = true; o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + ' waits for a page being drawn'); }
          await new Promise(r => setTimeout(r, Math.min(left, 250)));
      }
      const booked = await mbnState(s => {
          const now = Date.now(), cool = s.cool || 0, tat = s.tat || 0;
          let at = background ? Math.max(now, tat - (MBN_BURST - 1) * MBN_GAP) : now;
          at = Math.max(at, cool);
          s.tat = Math.max(tat, at) + MBN_GAP;
          return { at, why: cool > now && cool >= at ? 'MusicBrainz asked everyone to wait' : 'pacing, one request a second' };
      });
      let told = false;
      for (;;) {
          if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
          let cool = 0;
          try { cool = (JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}).cool || 0; } catch (e) { cool = (globalThis.__mbnGate || {}).cool || 0; }
          const until = Math.max(booked.at, cool), left = until - Date.now();   // a hold that appeared while we queued
          if (left <= 0) break;
          if (!told && until - t0 > 1000 && o.log) { told = true; o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + ' waits ' + Math.round((until - t0) / 100) / 10 + 's (' + (cool > booked.at ? 'MusicBrainz asked everyone to wait' : booked.why) + ')'); }
          await new Promise(r => setTimeout(r, Math.min(left, 250)));   // in slices, so a cancel lands promptly
      }
      return { ok: true, waited: Date.now() - t0 };
  }
  async function mbnLead(token, ms) {
      return mbnState(s => {
          if (ms > 0) { s.lead = token; s.leadUntil = Date.now() + Math.min(ms, MBN_MAX_LEAD); }
          else if (s.lead === token) { s.lead = ''; s.leadUntil = 0; }
      });
  }
  async function mbnAnswer(status, header, o) {
      o = o || {};
      if (status === 429 || status === 503) {
          const raw = header ? header('Retry-After') : null;
          const secs = Number(raw), date = raw ? Date.parse(raw) : NaN;
          const ra = Number.isFinite(secs) ? secs * 1000 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
          const hold = await mbnState(s => {
              const now = Date.now();
              // One throttle, one step: the requests already in flight when it began all answer
              // 503 too, and each must not stretch the hold again. A throttle long gone doesn't
              // count at all: `hot` is shared and persists, and would otherwise slow every later
              // page for good.
              if (now > (s.cool || 0) + 30000) s.hot = 0;
              if (now >= (s.cool || 0)) s.hot = Math.min((s.hot || 0) + 1, 6);
              const ms = Math.min(Math.max(1000, ra) * Math.max(1, s.hot), MBN_MAX_HOLD);
              s.cool = Math.max(s.cool || 0, Date.now() + ms);
              return s.cool - Date.now();
          });
          if (o.log) o.log('warn', 'MusicBrainz gate: HTTP ' + status + (raw != null ? ' (Retry-After: ' + raw + ')' : '') + ' — every script holds ' + Math.round(hold / 100) / 10 + 's');
          return { throttled: true, hold };
      }
      if (status >= 200 && status < 500) await mbnState(s => { if (s.hot) s.hot = Date.now() > (s.cool || 0) + 30000 ? 0 : s.hot - 1; });
      return { throttled: false, hold: 0 };
  }
  async function mbnFetch(url, init, o) {
      o = o || {};
      if (!mbnGated(url)) {
          const r = await fetch(url, init);
          if (!mbnWebsite(url) || !(await mbnIsCheck(r))) return r;
          // #733: MusicBrainz's browser check answered instead: nothing was done (a POST is safe
          // to repeat), so pass the check and ask again
          return (await mbnReverify(url, init, o)) ? fetch(url, init) : r;
      }
      const tries = o.tries || 4;
      for (let attempt = 1; ; attempt++) {
          const slot = await mbnSlot(o);
          if (!slot.ok) return null;
          const r = await mbnWsFetch(url, init);
          const a = await mbnAnswer(r.status, n => r.headers.get(n), o);
          if (!a.throttled || attempt >= tries) return r;
      }
  }
  function mbnHot() {
      let s;
      try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}; } catch (e) { s = globalThis.__mbnGate || {}; }
      return Date.now() > (s.cool || 0) + 30000 ? 0 : (s.hot || 0);   // a throttle long gone is over
  }
  function mbnUA() {
      let n = 'mb-userscripts', v = '';
      try { const i = GM_info.script; n = String(i.name || n).replace(/\s+/g, ''); v = i.version || ''; } catch (e) {}
      return n + (v ? '/' + v : '') + ' ( https://github.com/majkinetor/musicbrainz-userscripts )';
  }
  function mbnWsFetch(url, init) {
      init = init || {};
      const gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest
          : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);
      if (!gm) return fetch(url, init);
      const abs = new URL(String(url), typeof location !== 'undefined' ? location.href : 'https://musicbrainz.org/').href;
      const headers = {};
      try { new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v; }); } catch (e) {}
      headers['User-Agent'] = mbnUA();
      return new Promise((resolve, reject) => {
          const sig = init.signal;
          if (sig && sig.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
          let req = null, done = false;
          const onAbort = () => { if (done) return; done = true; try { req && req.abort && req.abort(); } catch (e) {} reject(new DOMException('Aborted', 'AbortError')); };
          const fail = m => () => { if (done) return; done = true; if (sig) sig.removeEventListener('abort', onAbort); reject(new TypeError(m)); };
          if (sig) sig.addEventListener('abort', onAbort);
          const res = gm({
              method: String(init.method || 'GET').toUpperCase(), url: abs, headers, data: init.body,
              timeout: 60000,
              onload: x => {
                  if (done) return; done = true; if (sig) sig.removeEventListener('abort', onAbort);
                  const h = new Headers();
                  for (const line of String(x.responseHeaders || '').split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) try { h.append(line.slice(0, i).trim(), line.slice(i + 1).trim()); } catch (e) {} }
                  const st = x.status || 0;
                  if (st < 200 || st > 599) { reject(new TypeError('network error (status ' + st + ')')); return; }
                  const r = new Response(st === 204 || st === 304 ? null : (x.responseText != null ? x.responseText : ''), { status: st, statusText: x.statusText || '', headers: h });
                  try { Object.defineProperty(r, 'url', { value: x.finalUrl || abs }); } catch (e) {}
                  resolve(r);
              },
              onerror: fail('network error'), ontimeout: fail('timed out'), onabort: fail('aborted'),
          });
          req = res && typeof res.then === 'function' ? null : res;   // GM.xmlHttpRequest returns a promise in some managers
      });
  }
  function mbnRawHeader(raw, name) {
      const want = String(name).toLowerCase();
      for (const line of String(raw || '').split(/\r?\n/)) {
          const i = line.indexOf(':');
          if (i > 0 && line.slice(0, i).trim().toLowerCase() === want) return line.slice(i + 1).trim();
      }
      return null;
  }
  function mbnWebsite(url) {
      const s = String(url || '');
      if (mbnGated(s)) return false;
      if (/^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org(\/|$)/i.test(s)) return true;
      return /^\/(?!\/)/.test(s) && typeof location !== 'undefined' && /(^|\.)musicbrainz\.org$/i.test(location.hostname);
  }
  async function mbnIsCheck(r) {
      try {
          if (!r || !/text\/html/i.test((r.headers && r.headers.get('content-type')) || '')) return false;
          const head = (await r.clone().text()).slice(0, 3000);
          return /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(head);
      } catch (e) { return false; }
  }
  function mbnReverify(url, init, o) {
      o = o || {};
      const log = (lvl, m) => { try { if (o.log) o.log(lvl, m); else (lvl === 'warn' ? console.warn : console.info)('[MusicBrainz gate] ' + m); } catch (e) {} };
      const g = globalThis.__mbnCheck || (globalThis.__mbnCheck = { busy: null, failedAt: 0 });
      if (g.busy) return g.busy;
      let target;
      try { target = new URL(String(url), location.href); } catch (e) { return Promise.resolve(false); }
      if (target.host !== location.host || typeof document === 'undefined') { log('warn', 'MusicBrainz asked to verify the browser — open any MusicBrainz page, then retry'); return Promise.resolve(false); }
      if (Date.now() - g.failedAt < 60000) return Promise.resolve(false);   // just failed: don't loop
      // a POST's URL can't be loaded: the check is per browser, so any light GET passes it
      const method = String((init && init.method) || 'GET').toUpperCase();
      const src = method === 'GET' ? target.href : location.origin + '/ws/js/entity/89ad4ac3-39f7-470e-963a-56509c546377';
      const t0 = Date.now();
      log('warn', 'MusicBrainz asked to verify the browser again ("Verifying your browser") — passing it in a hidden frame');
      g.busy = new Promise(resolve => {
          const fr = document.createElement('iframe');   // fresh each time, never re-navigated
          fr.setAttribute('aria-hidden', 'true'); fr.setAttribute('data-mbn-check', ''); fr.tabIndex = -1;
          fr.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;pointer-events:none';
          let loads = 0, done = false, timer = 0;
          const finish = ok => {
              if (done) return; done = true; clearTimeout(timer); fr.remove(); g.busy = null;
              if (ok) log('info', 'browser check passed in ' + (Date.now() - t0) + ' ms — retrying');
              else {
                  g.failedAt = Date.now();
                  const m = 'MusicBrainz wants to verify your browser — open any MusicBrainz page in another tab, then retry';
                  log('warn', m + ' (the hidden frame did not clear it in 20 s)');
                  try { if (o.notify) o.notify(m); } catch (e) {}
              }
              resolve(ok);
          };
          // the first load is the check; it posts its answer and is redirected to the real URL
          fr.onload = () => {
              loads++;
              let still;
              try { const d = fr.contentDocument; still = !d || /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(d.documentElement ? d.documentElement.outerHTML.slice(0, 3000) : ''); }
              catch (e) { still = loads < 2; }
              if (!still) finish(true);
          };
          timer = setTimeout(() => finish(false), 20000);
          fr.src = src;
          (document.body || document.documentElement).appendChild(fr);
      });
      return g.busy;
  }
  // </ST-NET>

  // <ST-TOKENS> — generated by dev/tokens/sync-tokens.mjs from dev/tokens/design-tokens.mjs — DO NOT EDIT
  const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-soft:color-mix(in srgb, var(--mbu-border) 60%, var(--mbu-bg));--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-row-mark:#ece4ff;--mbu-row-mark:var(--row-mark, color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent)));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001;--mbu-z-tip:2147483647}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
  // </ST-TOKENS>

  // <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
  const MBU_UI_CSS = '.mbu-help{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--mbu-text-weak);text-decoration:none;line-height:1}.mbu-help svg{width:18px;height:18px;display:block}.mbu-help:hover{color:var(--mbu-accent-text,var(--mbu-accent));background:none;text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-tip);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{width:auto;margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-drag .mbu-cfg-h{cursor:move;user-select:none}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-h>.mbu-cfg-x{margin-left:2px;padding:0}.mbu-cfg-x svg{width:18px;height:18px;display:block}.mbu-cfg-log{flex:0 0 auto;width:auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(860px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-hclear,.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min,.mbu-logpop-full{width:auto;font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-hclear:hover,.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover,.mbu-logpop-full:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-log-f,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x,#mbu-logpop.min .mbu-logpop-full{display:none}#mbu-logpop.min{max-height:none;width:auto!important;height:auto!important}#mbu-logpop.sized{max-height:none}.mbu-logpop-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;opacity:.6;background:linear-gradient(135deg,transparent 55%,var(--mbu-border-strong) 55%,var(--mbu-border-strong) 62%,transparent 62%,transparent 75%,var(--mbu-border-strong) 75%,var(--mbu-border-strong) 82%,transparent 82%)}.mbu-logpop-grip:hover{opacity:1}#mbu-logpop.min .mbu-logpop-grip,#mbu-logpop.full .mbu-logpop-grip{display:none}#mbu-logpop.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;width:auto!important;height:auto!important;max-height:none;transform:none!important}#mbu-logpop.full .mbu-logpop-h{cursor:default}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-logemb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--mbu-bg);font:13px var(--mbu-font);color:var(--mbu-text)}.mbu-logemb .mbu-logpop-h{cursor:default;padding:7px 10px}.mbu-logemb .mbu-logpop-h>.mbu-log-q{flex-basis:160px;margin-left:0}.mbu-logemb .mbu-logpop-h>.mbu-log-ses{flex-basis:240px}.mbu-logpop-h{flex-wrap:nowrap}.mbu-logpop-h>*{flex-shrink:0;white-space:nowrap}.mbu-logpop-h>.mbu-log-q{flex-shrink:1;min-width:60px}.mbu-logpop-h>.mbu-log-ses{flex-shrink:1;min-width:90px}.mbu-logpop-h>.mbu-logpop-sp{flex:1 1 0;min-width:0}.mbu-logpop .mbu-log-ses{flex:0 1 260px;min-width:120px;max-width:100%}.mbu-logpop-hclear:disabled{opacity:.5;cursor:default}.mbu-log-dbg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--mbu-text);cursor:pointer;white-space:nowrap}.mbu-log-dbg input{margin:0}#mbu-logpop.min .mbu-log-dbg{display:none}.mbu-log-past .mbu-logpop-clear{display:none}#mbu-logpop.min .mbu-log-ses,#mbu-logpop.min .mbu-logpop-hclear{display:none}.mbu-logpop .mbu-log-q{flex:0 1 200px;min-width:80px;margin-left:6px;font:12px var(--mbu-font);padding:2px 8px;border:1px solid var(--mbu-border);border-radius:5px;cursor:text}#mbu-logpop.min .mbu-log-q{display:none}.mbu-logpop .mbu-log-li.mbu-log-nq{display:none}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-pre .mbu-log-m{white-space:pre;font:12px/1.35 ui-monospace,Consolas,monospace;word-break:normal}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-c{color:var(--mbu-text-weak);flex:0 0 auto}.mbu-log-list:not(.mbu-log-cats) .mbu-log-c{display:none}.mbu-log-list.mbu-log-cats{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:3px 9px;align-content:start}.mbu-log-cats .mbu-log-li{display:contents}.mbu-log-cats .mbu-log-empty{grid-column:1/-1}.mbu-log-f{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;padding:5px 13px;border-bottom:1px solid var(--mbu-border-soft);font-size:11px}.mbu-log-f[hidden]{display:none}.mbu-log-fg{display:contents}.mbu-log-fs{width:1px;height:12px;background:var(--mbu-border);margin:0 6px}.mbu-logpop .mbu-log-fb{width:auto;font:inherit;color:var(--mbu-text-weak);background:none;border:1px solid transparent;border-radius:5px;padding:0 6px;line-height:1.6;cursor:pointer}.mbu-logpop .mbu-log-fb:hover{color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb.on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb[data-sev=error]{color:var(--mbu-error)}.mbu-logpop .mbu-log-fb[data-sev=warn]{color:var(--mbu-warn)}.mbu-logpop .mbu-log-fb[data-sev=info]{color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-fb[data-sev].on{background:var(--mbu-bg-hover);border-color:currentColor;font-weight:600}.mbu-logpop .mbu-log-fb[data-cat]{border-color:var(--mbu-border-soft);background:var(--mbu-bg-raised);border-radius:999px;padding:0 8px}.mbu-logpop .mbu-log-fb[data-cat].on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-accent)}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug>*{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;scrollbar-gutter:stable;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(*){scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}select.mbu-select:not(#mbu-0):not(#mbu-1){-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box;height:22px;max-width:100%;margin:0 2px;padding:0 26px 0 12px;border:1px solid var(--mbu-border);border-radius:20px;outline-offset:1px;background-color:transparent;background-image:linear-gradient(45deg,transparent 50%,var(--mbu-text-weak) 50%),linear-gradient(135deg,var(--mbu-text-weak) 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat;color:var(--mbu-text);font:600 12px var(--mbu-font);line-height:20px;cursor:pointer;vertical-align:middle}select.mbu-select:not(#mbu-0):not(#mbu-1):hover{border-color:var(--mbu-accent)}select.mbu-select:not(#mbu-0):not(#mbu-1):disabled{opacity:.45;cursor:default;border-color:var(--mbu-border)}select.mbu-select:not(#mbu-0):not(#mbu-1) option{background:var(--mbu-bg);color:var(--mbu-text);font-weight:400}.mbu-step:not(#mbu-0):not(#mbu-1){display:inline-flex;align-items:center;box-sizing:border-box;height:22px;margin:0 2px;padding:0;border:1px solid var(--mbu-border);border-radius:20px;background:transparent;vertical-align:middle;white-space:nowrap;flex:0 0 auto}.mbu-step:not(#mbu-0):not(#mbu-1):hover,.mbu-step:not(#mbu-0):not(#mbu-1):focus-within{border-color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>button{all:unset;box-sizing:border-box;width:20px;height:20px;text-align:center;font:600 13px/20px var(--mbu-font);color:var(--mbu-text-weak);cursor:pointer;user-select:none}.mbu-step:not(#mbu-0):not(#mbu-1)>button:hover{color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>input{all:unset;box-sizing:content-box;min-width:2ch;height:20px;padding:0 1px;font:600 12px/20px var(--mbu-font);color:var(--mbu-text);text-align:center;-moz-appearance:textfield;appearance:textfield;cursor:text}.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-inner-spin-button,.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled){opacity:.45;border-color:var(--mbu-border)}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled)>button{cursor:default;color:var(--mbu-text-weak)}';
  // Help link markup. Every script's help link is this, pointing at its own README.
  // `name` is the userscript folder, e.g. mbuHelpHref('art_station').
  function mbuHelpHref(name) {
      return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
  }
  var MBU_HELP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/></svg>';
  // the sort-name guess, A over Z with a down arrow, for every button that guesses a sort name
  var MBU_SORT_ICON = '<svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18M1 17l4 4 4-4"/><path d="M13 11l3-8 3 8M14.1 8h3.8M13 14h6l-6 7h6"/></svg>';
  // the edit pencil, for every button that opens an editor (#849)
  // one icon per entity type, for every script: the inside of a 24×24 stroked <svg>, keyed by MB's entity name
  var MBU_ENT_ICONS = {
      'release': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      'release-group': '<path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
      'artist': '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
      'label': '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
      'recording': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>',
      'work': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      'area': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.5 3 14.5 0 18"/><path d="M12 3c-3 3.5-3 14.5 0 18"/>',
      'instrument': '<path d="M9 3v7a3 3 0 0 0 6 0V3"/><path d="M12 13v8"/><path d="M5 6l-1.5-1M5 9H3M19 6l1.5-1M19 9h2"/>',
      'place': '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
      'series': '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
      'event': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      'collection': '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M6 5h12M8 2h8"/>',
  };
  var MBU_EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  function mbuHelpHtml(name, label) {
      return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener" aria-label="Help"'
          + ' data-tip="Help: open the README in a new tab">' + (label || MBU_HELP_ICON) + '</a>';
  }
  function mbuHelpEl(name, label) {
      var a = document.createElement('a');
      a.className = 'mbu-help';
      a.href = mbuHelpHref(name);
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('aria-label', 'Help');
      a.dataset.tip = 'Help: open the README in a new tab';
      if (label) a.textContent = label; else a.innerHTML = MBU_HELP_ICON;
      return a;
  }

  // The config (settings) icon every script's settings button shows: the gear in text
  // presentation (U+FE0E), so it takes the button's colour instead of an emoji's. #650
  var MBU_CFG_ICON = '\u2699\uFE0E';

  // HTML for an innerHTML on a page that enforces Trusted Types (YouTube Music, #650): there a
  // plain string is refused ("This document requires 'TrustedHTML' assignment"). The policy
  // passes the string through; the markup is the script's own. Elsewhere it is the string.
  var _mbuTT;
  function mbuHtml(s) {
      if (_mbuTT === undefined) {
          _mbuTT = null;
          try {
              var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
              if (tt && tt.createPolicy) _mbuTT = tt.createPolicy('mbu-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
          } catch (e) { /* the page allows no new policy: plain strings, as before */ }
      }
      return _mbuTT ? _mbuTT.createHTML(String(s)) : String(s);
  }

  // The first line of every script's log: the script, its version, and what runs it, so a
  // pasted log says which manager and browser it came from (#282 started it in Art Station):
  //   Log.info(mbuStartupInfo('Fusion'));
  //   -> Fusion v2026.10.1 · Violentmonkey 2.31.0 · firefox 143.0 (win)
  // Inside String Theory GM_info describes the bundle, so the line names it:
  //   -> Fusion (String Theory v2026.10.1) · Tampermonkey 5.3.3 · chrome 140.0 (win)
  // On MusicBrainz it ends with the interface language, which changes what a script reads
  // off the page: "· MusicBrainz in de".
  function mbuStartupInfo(name) {
      var g = null;
      try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
      var s = (g && g.script) || {}, p = (g && g.platform) || {};
      var host = String(s.name || '').replace(/\*$/, ''), ver = s.version || '?';
      var line = !name ? (host || 'Script') + ' v' + ver
          : (host && host !== name) ? name + ' (' + host + ' v' + ver + ')'
          : name + ' v' + ver;
      if (g) line += ' · ' + (g.scriptHandler || 'unknown manager') + (g.version ? ' ' + g.version : '');
      if (p.browserName) line += ' · ' + p.browserName + (p.browserVersion ? ' ' + p.browserVersion : '') + (p.os ? ' (' + p.os + ')' : '');
      else { try { line += ' · ' + navigator.userAgent; } catch (e) { /* no navigator */ } }
      try {
          if (/(^|\.)musicbrainz\.(org|eu)$/i.test(location.hostname)) {
              // <html lang>, or MB's lang cookie when the page isn't parsed yet (document-start)
              var lang = (document.documentElement && document.documentElement.lang) || ((document.cookie.match(/(?:^|;\s*)lang=([^;]+)/) || [])[1]) || 'en';
              line += ' · MusicBrainz in ' + lang;
          }
      } catch (e) { /* no document */ }
      return line;
  }

  // Automated mode (#936): true when another script drives this page and nobody watches it,
  // so a script does only what it is asked: no auto-match, no detection, no defaults, no
  // searches whose result nobody sees, no archiving. Two signals:
  //   - a Falcon worker: a same-origin iframe with the class falcon-worker;
  //   - any other orchestrator: mbu-auto=0 in the query or the hash (#mbu-auto=0 where
  //     MusicBrainz rejects an unknown parameter).
  //   if (mbuAutomated()) { ...skip what runs on its own... }
  function mbuAutomated() {
      if (mbuAutomated._v !== undefined) return mbuAutomated._v;
      var v = false;
      try { var fe = window.frameElement; v = !!(fe && fe.classList && fe.classList.contains('falcon-worker')); } catch (e) { /* cross-origin parent */ }
      try { if (!v) v = /(?:[?&#])mbu-auto=0(?:[&#]|$)/.test(location.search + location.hash); } catch (e) { /* no location */ }
      return (mbuAutomated._v = v);
  }

  // One copy per page (#653). With String Theory and a standalone install of the same script
  // both on, two copies build the same element ids and fight over them: each settings window
  // fills in the other's checkboxes, rows flip between two rule sets. So one copy runs, the
  // one with the higher version, and the other stays off without a word; only the running
  // copy notes it in its log (majkinetor: "disable copy that has lower version without any
  // info (except in log of active copy)"):
  //   if (!mbuClaim('platform_check', 'Platform Check')) return;   // first line of the script
  // The claim is a data- attribute on <html>, which every copy sees whatever its sandbox.
  // It is decided at once, so no script starts late. The copy that starts first takes the
  // page. When it is the older one, the newer copy stays off for this page and leaves a note
  // in localStorage, and from the next page load the older copy finds the note and steps
  // aside. A note whose copy has gone (uninstalled) is cleared by the older copy after the
  // page loads, so it runs again from the load after.
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

  // Toast. mbuToast(msg) or mbuToast(msg, { ms, kind, at:{x,y}, action:{ label, onClick } }).
  //
  // An action adds one button to the toast (e.g. "Copy log"): the toast is then clickable,
  // stays up longer (12 s unless ms says otherwise), and closes when the button is used.
  //
  // Severity is inferred from a leading warning/tick glyph when not given — Art
  // Station already did that and it is why its toasts reached its log with the
  // right level. Set mbuToast.log = function (level, message) {...} once at
  // startup and every toast mirrors into that script's own log; leave it unset
  // and the toast still shows.
  var _mbuToastT = null;
  function mbuToast(msg, opts) {
      opts = opts || {};
      var s = String(msg);
      var kind = opts.kind || (/^\s*[⚠✗×]/.test(s) ? 'warn' : /[✓✅]/.test(s) ? 'ok' : 'info');
      try {
          if (typeof mbuToast.log === 'function') mbuToast.log(kind, s.replace(/^\s*[⚠✗×✓✅]\s*/, ''));
      } catch (e) { /* a broken log sink must never swallow the toast */ }
      var el = document.getElementById('mbu-toast');
      if (!el) {
          el = document.createElement('div');
          el.id = 'mbu-toast';
          (document.body || document.documentElement).appendChild(el);
      }
      el.className = 'mbu-toast-on' + (kind !== 'info' ? ' mbu-toast-' + kind : '') + (opts.action ? ' mbu-toast-act' : '');
      el.textContent = s;
      if (opts.action) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'mbu-toast-btn'; b.textContent = opts.action.label || 'OK';
          b.onclick = function () {
              try { if (opts.action.onClick) opts.action.onClick(b); } catch (e) { /* the toast still closes */ }
              clearTimeout(_mbuToastT); _mbuToastT = setTimeout(function () { el.className = ''; }, 900);
          };
          el.appendChild(b);
      }
      // Anchor above a click point when asked, clamped into the viewport; otherwise
      // fall back to the centred default by clearing the inline placement.
      if (opts.at) {
          var w = el.offsetWidth, h = el.offsetHeight;
          el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, opts.at.x - w / 2)) + 'px';
          el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, opts.at.y - h - 10)) + 'px';
          el.style.bottom = 'auto';
          el.style.transform = 'none';
      } else {
          el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
      }
      clearTimeout(_mbuToastT);
      _mbuToastT = setTimeout(function () { el.className = ''; }, opts.ms || (opts.action ? 12000 : 2600));
      return el;
  }

  // Config-window title bar.
  //
  //   mbuCfgHeader({ script:'art_station', name:'Art Station', version:'2026.9.2',
  //                  icon:'<svg…>' | '<img…>', log:true, logClass:'as-setup-logbtn' })
  //
  // Returns the markup for the whole bar. 'log' adds the Log button; a script with
  // no log window leaves it out rather than shipping a dead control. logClass /
  // logId are carried through IN ADDITION to the shared class so a script's
  // existing click handler keeps working — adopting the component must not mean
  // rewiring every listener at the same time.
  // A settings window moves by its .mbu-cfg-h header (#847). Wherever the window
  // sits (fixed, absolute in a script's modal, or static in an overlay's flex), the
  // first drag pins it where it is, then follows the pointer, kept on screen.
  //   mbuCfgDrag(panel)
  function mbuCfgDrag(el) {
      el.classList.add('mbu-cfg-drag');
      mbuCfgPhoneFit(el);
      el.addEventListener('pointerdown', function (e) {
          var h = e.target.closest('.mbu-cfg-h');
          if (el.classList.contains('mbu-cfg-phone')) return;
          if (e.button || !h || !el.contains(h) || e.target.closest('button,a,input,select,label')) return;
          var b = el.getBoundingClientRect();
          if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
          el.style.transform = 'none'; el.style.right = 'auto'; el.style.bottom = 'auto';
          var cs = getComputedStyle(el), a = el.getBoundingClientRect();
          var l0 = (parseFloat(cs.left) || 0) + b.left - a.left, t0 = (parseFloat(cs.top) || 0) + b.top - a.top;
          el.style.left = l0 + 'px'; el.style.top = t0 + 'px';
          var x0 = e.clientX, y0 = e.clientY;
          var mv = function (ev) {
              var dx = Math.max(-b.left, Math.min(window.innerWidth - 80 - b.left, ev.clientX - x0));
              var dy = Math.max(-b.top, Math.min(window.innerHeight - 40 - b.top, ev.clientY - y0));
              el.style.left = (l0 + dx) + 'px'; el.style.top = (t0 + dy) + 'px';
          };
          var up = function () { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); e.preventDefault();
      });
  }

  // On a phone a settings window fills the screen: MusicBrainz's page is wider than the phone, so
  // vw and 50% measure the page; the visual viewport is what the person sees.
  function mbuCfgPhoneFit(el) {
      var fit = function () {
          var vv = window.visualViewport;
          if (!vv || vv.width >= 700 || !el.isConnected) return;
          el.classList.add('mbu-cfg-phone');
          Object.assign(el.style, { position: 'fixed', left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', right: 'auto', bottom: 'auto',
              transform: 'none', margin: '0', width: vv.width + 'px', height: vv.height + 'px', minWidth: '0', maxWidth: 'none', maxHeight: 'none',
              borderRadius: '0', boxSizing: 'border-box', textSizeAdjust: '100%', webkitTextSizeAdjust: '100%' });
          if (getComputedStyle(el).overflowY !== 'hidden') el.style.overflowY = 'auto';
      };
      requestAnimationFrame(fit); setTimeout(fit, 120);
  }

  function mbuCfgHeader(o) {
      o = o || {};
      var esc = function (s) {
          return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
      };
      var html = '<div class="mbu-cfg-h">';
      if (o.icon) html += '<span class="mbu-cfg-ic">' + o.icon + '</span>';
      html += '<span class="mbu-cfg-name">' + esc(o.name) + '</span>';
      if (o.version) html += '<span class="mbu-cfg-ver" data-tip="The installed version">v' + esc(o.version) + '</span>';
      html += '<span class="mbu-cfg-sp"></span>';
      if (o.log) {
          html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
              + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
              + ' data-tip="Open the activity log">Log</button>';
      }
      html += mbuHelpHtml(o.script);
      // every settings window closes from its title bar; close:false leaves the button out
      if (o.close !== false) {
          html += '<button type="button" class="mbu-ov-x mbu-cfg-x" aria-label="Close" data-tip="Close">'
              + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>';
          mbuCfgCloseWire();
      }
      return html + '</div>';
  }
  // The title bar's close, for every script at once: it presses Escape on the window, which each
  // settings window already closes on; a script with its own close sets the button's onclick.
  // Captured, since some windows stop clicks inside them from bubbling.
  // If the window is still showing after that, it is hidden (or its overlay removed).
  function mbuCfgCloseWire() {
      if (document.__mbuCfgX) return;
      document.__mbuCfgX = true;
      document.addEventListener('click', function (e) {
          var x = e.target.closest && e.target.closest('.mbu-cfg-x');
          if (!x || x.onclick) return;
          var h = x.closest('.mbu-cfg-h');
          var win = h.closest('[role=dialog],.mbu-ov-panel') || h.parentElement;
          x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
          setTimeout(function () {
              if (!h.isConnected || !h.getClientRects().length) return;
              var ov = win.closest('.mbu-ov');
              if (ov) ov.remove(); else win.style.display = 'none';
          }, 60);
      }, true);
  }

  // Settings controls: in root, every <select> becomes the pill drop-down and every number field the
  // − n + stepper. The field stays the script's own (its value, min, max, step and listeners): − and +
  // step it within them and fire input and change, as typing would. Call it once a window's markup is in;
  // again after a re-render does no harm. Returns root.
  function mbuControls(root) {
      if (!root || !root.querySelectorAll) return root;
      Array.prototype.forEach.call(root.querySelectorAll('select'), function (s) { s.classList.add('mbu-select'); });
      Array.prototype.forEach.call(root.querySelectorAll('input[type=number]'), function (inp) {
          var p = inp.parentNode;
          if (!p || (p.classList && p.classList.contains('mbu-step'))) return;
          var wrap = document.createElement('span');
          wrap.className = 'mbu-step';
          p.insertBefore(wrap, inp);
          var btn = function (down) {
              var b = document.createElement('button');
              b.type = 'button';
              b.tabIndex = -1;
              b.textContent = down ? '−' : '+';
              b.setAttribute('aria-label', down ? 'Less' : 'More');
              b.addEventListener('click', function (e) {
                  e.preventDefault();
                  if (inp.disabled || inp.readOnly) return;
                  var was = inp.value;
                  try { if (down) inp.stepDown(); else inp.stepUp(); } catch (x) { return; }
                  if (inp.value === was) return;
                  inp.dispatchEvent(new Event('input', { bubbles: true }));
                  inp.dispatchEvent(new Event('change', { bubbles: true }));
              });
              return b;
          };
          wrap.appendChild(btn(true));
          wrap.appendChild(inp);
          wrap.appendChild(btn(false));
          // as wide as its longest value; a width the script set for the old field would cut it
          inp.style.width = Math.max(2, String(inp.max || inp.value || '').length) + 0.5 + 'ch';
      });
      return root;
  }

  // Test hooks. A script puts its test hook on window only when the test harness has
  // marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
  //   if (mbuTestHooks()) window.__fooTest = { … };
  // On a user's page the hooks are never built. (#623)
  function mbuTestHooks() {
      try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
  }

  // Shared settings: the few that belong to all the scripts at once, not to one (the corner
  // launchers' layout). GM storage is private to each script, so these live in the page's
  // localStorage on MusicBrainz's origin, as JSON under 'mbu.<key>'; every script, bundled or
  // standalone, reads the same value. One argument reads (undefined when unset or blocked), two
  // write, and null removes. Per-origin: musicbrainz.org, beta and test each keep their own.
  // Every key is listed in DEVELOP.md → Shared storage.
  function mbuShared(key, value) {
      var k = 'mbu.' + key;
      try {
          if (arguments.length < 2) { var v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); }
          if (value == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value));
      } catch (e) { /* storage blocked */ }
      return value;
  }

  // Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
  // Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
  // 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
  // calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
  // That recomputes every element in the corner, whichever script owns it and
  // whatever order they loaded in, so two launchers never land on the same pixel.
  // Orders in use, all bottom-right: Apollo and Art Station 10 (never on the same page), Scribe 15
  // (above Apollo on the edit page), Falcon 20, Fusion 30, Mission Control 40. Scribe is not on the shared block and keeps a copy of this.
  // The stack is a column; the shared setting cornerFlow = 'row' (mbuShared, set in String
  // Theory's settings) lines it up along the bottom/top edge instead, the lowest order still nearest the corner.
  // The shared setting cornerSide = 'left' (also from there) mirrors every corner across the screen: a
  // launcher tagged 'br' sits bottom-left. Its other side is set to auto, so a CSS left/right can't stretch it.
  // On a phone MusicBrainz's page is wider than the screen, so the browser widens the layout
  // viewport, which position:fixed measures from, to the page: the corner was off screen, a scroll
  // right and down away. Each edge is offset by the gap between it and the visual viewport (what is
  // on screen), kept up as that scrolls and resizes; on a desktop the gap is 0.
  //
  // The dock (#847): while the page sets data-mbu-dock on <html> (Event Horizon, while it shows),
  // the bottom-right launchers fold behind one String Theory button. A click unrolls them, each
  // with its name (data-mb-corner-label) beside it. data-mb-corner-dock="no" keeps a launcher out
  // of the dock (Event Horizon's own switch); "hide" hides it while docked (Art Station and Apollo,
  // whose pages Event Horizon replaces). data-mb-corner-paths, a regular expression, names the paths a
  // launcher belongs on: Event Horizon moves to another page without loading it, and the dock hides
  // a launcher that came along to a page its script doesn't run on.
  //
  // String Theory (#851) marks the page with data-mbu-st (its version) on MusicBrainz, and the dock is
  // on there too, the same with Event Horizon or without: folded until a click unrolls it (dockOpen).
  // Outside Event Horizon "hide" launchers stay in it: their pages are MusicBrainz's own. A right-click
  // on the dock's button opens String Theory's settings (the mbu-st-settings event on document).
  // The shared cornerSize (0.6–1.6) scales every launcher in a corner. The bottom-right launchers are
  // keyed by their name (data-mb-corner-label): the dock records each one it sees in dockKnown
  // ({name: icon HTML}, for String Theory's settings to list), and dockOrder, a list of names from
  // String Theory's settings, orders them, the first nearest the corner; a name not in it follows,
  // by data-mb-corner-order. Scribe keeps its own copy of the restack and knows neither.
  var MBU_DOCK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M64 10 L66.4 10.2 L68.7 10.6 L70.9 11.4 L73.1 12.4 L75.2 13.7 L77.1 15.2 L78.8 17 L80.4 18.9 L81.8 21 L83.1 23.1 L84.1 25.4 L85 27.6 L85.7 29.9 L86.3 32.1 L86.8 34.3 L87.1 36.4 L87.4 38.4 L87.7 40.3 L87.9 42.1 L88.2 43.7 L88.5 45.2 L88.9 46.6 L89.4 47.8 L90 49 L90.7 50.1 L91.6 51.1 L92.6 52.2 L93.7 53.2 L95 54.2 L96.4 55.3 L97.9 56.5 L99.5 57.7 L101.1 59.1 L102.7 60.6 L104.4 62.2 L106 64 L107.5 65.9 L108.9 67.9 L110.2 70.1 L111.3 72.3 L112.1 74.7 L112.8 77.1 L113.1 79.5 L113.2 81.9 L113 84.3 L112.6 86.6 L111.8 88.9 L110.8 91 L109.5 93 L107.9 94.7 L106.1 96.3 L104.1 97.7 L102 98.8 L99.7 99.7 L97.3 100.4 L94.9 100.8 L92.4 101 L89.9 100.9 L87.4 100.7 L85 100.4 L82.7 99.9 L80.4 99.3 L78.3 98.6 L76.3 97.8 L74.4 97.1 L72.7 96.4 L71 95.7 L69.5 95.1 L68 94.6 L66.7 94.3 L65.3 94.1 L64 94 L62.7 94.1 L61.3 94.3 L60 94.6 L58.5 95.1 L57 95.7 L55.3 96.4 L53.6 97.1 L51.7 97.8 L49.7 98.6 L47.6 99.3 L45.3 99.9 L43 100.4 L40.6 100.7 L38.1 100.9 L35.6 101 L33.1 100.8 L30.7 100.4 L28.3 99.7 L26 98.8 L23.9 97.7 L21.9 96.3 L20.1 94.7 L18.5 93 L17.2 91 L16.2 88.9 L15.4 86.6 L15 84.3 L14.8 81.9 L14.9 79.5 L15.2 77.1 L15.9 74.7 L16.7 72.3 L17.8 70.1 L19.1 67.9 L20.5 65.9 L22 64 L23.6 62.2 L25.3 60.6 L26.9 59.1 L28.5 57.7 L30.1 56.5 L31.6 55.3 L33 54.2 L34.3 53.2 L35.4 52.2 L36.4 51.1 L37.3 50.1 L38 49 L38.6 47.8 L39.1 46.6 L39.5 45.2 L39.8 43.7 L40.1 42.1 L40.3 40.3 L40.6 38.4 L40.9 36.4 L41.2 34.3 L41.7 32.1 L42.3 29.9 L43 27.6 L43.9 25.4 L44.9 23.1 L46.2 21 L47.6 18.9 L49.2 17 L50.9 15.2 L52.8 13.7 L54.9 12.4 L57.1 11.4 L59.3 10.6 L61.6 10.2Z" fill="none" stroke="#9c86ea" stroke-width="10" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#6c47e0" stroke-width="13" stroke-linejoin="round"/> <path class="mbu-dock-run" pathLength="100" d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#ff4f9a" stroke-width="13" stroke-linecap="round"/> </svg>';   // String Theory's icon.svg
  var mbuDockBusyT, mbuDockFadeT;   // the dock's busy-off delay and its fade-out, below
  function mbuDock() {
      var root = document.documentElement, eh = root.hasAttribute('data-mbu-dock');
      var on = eh || root.hasAttribute('data-mbu-st');
      var btn = document.getElementById('mbu-dock');
      var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="br"]'))
          .filter(function (el) { return el.id !== 'mbu-dock' && el.dataset.mbCornerDock !== 'no'; });
      if (!document.getElementById('mbu-dock-css')) {
          var css = document.createElement('style'); css.id = 'mbu-dock-css';
          css.textContent = '[data-mbu-docked]{z-index:2147482990!important}[data-mbu-docked=hide],[data-mbu-docked=off],:root:not([data-mbu-dock]) [data-mb-corner-dock=only]{display:none!important}'
              // No transform on an entry, ever: its count badge is drawn inside it, and Chrome cut seams through the
              // badge's border under a fractional scale (a peek's .8, a hover's 1.08). The hover grows the icon only, a
              // folded entry is laid out smaller in whole pixels, and a bigger icon (mbuDockItem's scale) is its size
              // (--mbu-di, --mbu-di-p when folded)
              + '.mbu-dock-item{position:fixed;z-index:2147482990;width:40px;height:40px;box-sizing:border-box;border:0;border-radius:50%;padding:3px;background:none;box-shadow:none;cursor:pointer}'
              + '.mbu-dock-item img{width:var(--mbu-di,34px);height:var(--mbu-di,34px);max-width:none;margin:calc((34px - var(--mbu-di,34px))/2);display:block;pointer-events:none;opacity:.85;transition:opacity .12s,transform .12s}.mbu-dock-item:hover img{opacity:1;transform:scale(1.08)}'
              + '.mbu-dock-item[data-mbu-docked=peek]{width:32px;height:32px;padding:2px}.mbu-dock-item[data-mbu-docked=peek] img{width:var(--mbu-di-p,28px);height:var(--mbu-di-p,28px);margin:calc((28px - var(--mbu-di-p,28px))/2)}.mbu-dock-item[data-mbu-docked=peek]:hover img{transform:scale(1.125)}'
              // beside the dock's button, wherever the corner's size (--mbu-cs, set by the restack) puts it
              // under the dock's entries (2147482989-91): the dock, when it shows, is above every floating panel; windows still cover it
              + '.mbu-dock-win{position:fixed;z-index:2147482985;--mbu-dw-x:calc(22px + 40px*var(--mbu-cs,1));--mbu-dw-y:6px;right:var(--mbu-dw-x);bottom:var(--mbu-dw-y);width:max-content;max-width:calc(100vw - 90px);max-height:min(75vh,calc(100vh - 20px));overflow:auto;box-sizing:border-box;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}'
              + '.mbu-dock-win>*{margin:0!important}:root[data-mbu-flow=row] .mbu-dock-win{--mbu-dw-x:6px;--mbu-dw-y:calc(20px + 40px*var(--mbu-cs,1));max-height:min(75vh,calc(100vh - 80px))}:root[data-mbu-side=left] .mbu-dock-win{right:auto;left:var(--mbu-dw-x)}'
              + '#mbu-dock{position:fixed;z-index:2147482991;width:40px;height:40px;border-radius:50%;border:0;padding:0;cursor:pointer;background:none;box-shadow:none}'
              + '#mbu-dock svg{width:34px;height:34px;display:block;margin:auto;pointer-events:none;opacity:.85;transition:opacity .12s,transform .12s}'
              + '#mbu-dock:hover svg{transform:scale(1.08)}:is(#mbu-dock:hover,:root[data-mbu-dock-open] #mbu-dock) svg{opacity:1}'
              + '#mbu-dock:focus-visible{outline:2px solid #ba478f;outline-offset:2px}'
              + '#mbu-dock b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center}'
              // no names, only a short state (a count) as a badge on the entry's top-right corner
              // No background, and no dark userstyle's inverting filter on it (kellnerd's inverts every button)
              + '.mbu-dock-item,#mbu-dock,#mbu-dock-shelf,[data-mbu-docked=show],[data-mbu-docked=peek]{filter:none!important}'
              // The resting fade is on the icon, never the entry: the entry's opacity would fade its badge too, and the page showed through it
              // a launcher's own resting fade (Fusion's .85) is overruled; a peek's fade runs through --mbu-peek-o, which an
              // animation can move under the !important (it can't move opacity itself)
              + '@property --mbu-peek-o{syntax:"<number>";inherits:false;initial-value:1}'
              + '[data-mbu-docked=show],[data-mbu-docked=peek]{opacity:var(--mbu-peek-o,1)!important}'
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek])>:not(.mbu-dock-dots,.mbu-dock-n){opacity:.85;transition:opacity .12s,transform .12s}:is(:root[data-mbu-dock-over] [data-mbu-docked=show],[data-mbu-docked=show]:hover,[data-mbu-docked=peek]:hover)>*{opacity:1}'
              // while the pointer is over the dock, a frosted shelf behind its icons, so they read on any page
              + '#mbu-dock-shelf{position:fixed;z-index:2147482989;box-sizing:border-box;background:transparent;opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s}'   // catches the pointer between icons, so the page behind the dock's gaps doesn't react
              + ':root[data-mbu-dock-frost] #mbu-dock-shelf{background:rgba(255,255,255,.6);box-shadow:0 2px 10px rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.1);-webkit-backdrop-filter:blur(12px) saturate(1.6);backdrop-filter:blur(12px) saturate(1.6)}'   // String Theory's Hover: Shelf
              + ':root[data-mbu-dock-frost] #mbu-dock-shelf[data-dark]{background:rgba(40,42,47,.6);box-shadow:0 2px 10px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.12)}'
              + ':root[data-mbu-dock-over] #mbu-dock-shelf{opacity:1;visibility:visible}'
              // folded, an entry with something to do peeks beside the button, smaller
              // (a script's own launcher still shrinks by a transform: its insides are its own; a dock entry is sized above)
              + '[data-mbu-docked=peek]:not(.mbu-dock-item){transform:scale(.8)}[data-mbu-docked=peek]:not(.mbu-dock-item):hover{transform:scale(.9)}[data-mbu-peek-out]{pointer-events:none}'
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))[data-mb-corner-status]::after{content:attr(data-mb-corner-status);position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center;white-space:nowrap;text-shadow:none;-webkit-font-smoothing:antialiased;pointer-events:none}'
              + '.mbu-dock-item[data-mbu-docked=peek][data-mb-corner-status]::after{top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;font:700 10px/13px system-ui,sans-serif}'   // a folded entry's, smaller in whole pixels
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked])):hover::after{opacity:1}'
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))[data-mb-corner-status^="✓"]::after{content:"";top:0;right:0;min-width:0;width:10px;height:10px;padding:0;border:2px solid #fff;border-radius:50%;background:#4cbf7a}'   // all done: a quiet dot, so a count beside it stands out
              + '.mbu-dock-item[data-mbu-docked=peek][data-mb-corner-status^="✓"]::after{width:8px;height:8px}'
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))[data-mb-corner-status^="0,"]:not([data-mb-corner-status*="/"])::after{border:1.5px dashed #999;background:#f0f0f0;color:#888}'   // "0,3": nothing to do, only held back
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))[data-mbu-busy]::after{background:#f3eff7;border-color:#d6cde2;color:#9a8fae;letter-spacing:1px;animation:mbu-dock-fade 1.2s ease-in-out infinite}'
              + '@keyframes mbu-dock-fade{50%{opacity:.25}}'
              // nothing counted yet: three small dots lighting in turn, no badge
              + ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))[data-mbu-busy][data-mb-corner-status="···"]::after{content:none}'
              + '.mbu-dock-dots{display:none;position:absolute;top:0;right:-6px;gap:3px;pointer-events:none}:is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))[data-mbu-busy][data-mb-corner-status="···"] .mbu-dock-dots{display:flex}'
              + '#mbu-dock .mbu-dock-run{visibility:hidden;opacity:0;stroke-dasharray:40 60;animation:mbu-dock-run 6s linear infinite paused;transition:opacity .8s,visibility 0s .8s}#mbu-dock[data-mbu-busy] .mbu-dock-run{visibility:visible;opacity:1;transition:opacity .8s}#mbu-dock:is([data-mbu-busy],[data-mbu-busy-out]) .mbu-dock-run{animation-play-state:running}@keyframes mbu-dock-run{to{stroke-dashoffset:-100}}'   // while a member works, a faint long dash traces the string slowly, fading in and out; idle it pauses (after the fade-out, data-mbu-busy-out), never display:none, so it resumes where it stopped instead of restarting
              + '.mbu-dock-dots i{width:5px;height:5px;border-radius:50%;background:#e05aa5;animation:mbu-dock-dot 1.2s ease-in-out infinite}.mbu-dock-dots i:nth-child(2){animation-delay:.2s}.mbu-dock-dots i:nth-child(3){animation-delay:.4s}'
              + '@keyframes mbu-dock-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}'
              + '@media (prefers-reduced-motion:reduce){[data-mbu-busy]::after,.mbu-dock-dots i{animation:none!important}#mbu-dock .mbu-dock-run{animation-duration:12s!important}}';
          root.appendChild(css);
      }
      if (!on) {
          els.forEach(function (el) { el.removeAttribute('data-mbu-docked'); });
          if (btn) btn.remove();
          return;
      }
      if (!btn) {
          btn = document.createElement('button'); btn.type = 'button'; btn.id = 'mbu-dock';
          btn.setAttribute('aria-label', 'String Theory');
          btn.dataset.mbCorner = 'br'; btn.dataset.mbCornerOrder = '-1';   // nearest the corner
          btn.onclick = function () {
              // unrolled by hovering: the click keeps it open
              var open = root.hasAttribute('data-mbu-dock-hover') || !root.hasAttribute('data-mbu-dock-open');
              root.removeAttribute('data-mbu-dock-hover');
              root.toggleAttribute('data-mbu-dock-open', open);
              mbuShared('dockOpen', open || null);   // remembered for the next page
              mbRestackCorner('br');
          };
          // with String Theory, a right-click opens its settings (#851)
          btn.addEventListener('contextmenu', function (e) {
              if (!root.hasAttribute('data-mbu-st')) return;
              e.preventDefault();
              document.dispatchEvent(new CustomEvent('mbu-st-settings'));
          });
          // hovering the folded button unrolls the dock until the pointer leaves it, not remembered
          var leaveT = 0;
          var dockBox = function () {
              var boxes = Array.prototype.slice.call(document.querySelectorAll('#mbu-dock,[data-mbu-docked=show],[data-mbu-docked=peek]'))
                  .map(function (el) { return el.getBoundingClientRect(); }).filter(function (r) { return r.width && r.height; });
              if (!boxes.length) return null;
              return { left: Math.min.apply(null, boxes.map(function (r) { return r.left; })), right: Math.max.apply(null, boxes.map(function (r) { return r.right; })),
                  top: Math.min.apply(null, boxes.map(function (r) { return r.top; })), bottom: Math.max.apply(null, boxes.map(function (r) { return r.bottom; })) };
          };
          var inBox = function (e, b, pad) { return !!b && e.clientX >= b.left - pad && e.clientX <= b.right + pad && e.clientY >= b.top - pad && e.clientY <= b.bottom + pad; };
          var inDock = function (e) {
              if (e.target && e.target.closest && e.target.closest('#mbu-dock,[data-mbu-docked=show],.mbu-dock-win,#mbu-tip')) return true;
              return inBox(e, dockBox(), 0);
          };
          // the shelf: shown while the pointer is over the dock, dark on a dark page (a dark userstyle)
          var shelf = document.createElement('div'); shelf.id = 'mbu-dock-shelf'; (document.body || root).appendChild(shelf);
          var pageDark = function () {
              // the dock block can ship without mbuThemeOf, so read the luminance here
              var lum = function (bg) {
                  var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || '');
                  if (!m || (m[4] !== undefined && +m[4] < 0.5)) return null;
                  return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
              };
              var l = lum(document.body && getComputedStyle(document.body).backgroundColor);
              if (l === null) l = lum(getComputedStyle(root).backgroundColor);
              return l !== null && l < 0.5;
          };
          var shelfOver = function (e) {
              var b = dockBox(), over = inBox(e, b, 6);
              if (over) {
                  if (document.body && shelf.parentNode !== document.body) document.body.appendChild(shelf);
                  var pad = 4, w = b.right - b.left + 2 * pad, h = b.bottom - b.top + 2 * pad;
                  shelf.style.left = (b.left - pad) + 'px'; shelf.style.top = (b.top - pad) + 'px';
                  shelf.style.width = w + 'px'; shelf.style.height = h + 'px';
                  shelf.style.borderRadius = (Math.min(w, h) / 2) + 'px';
                  if (!root.hasAttribute('data-mbu-dock-over')) shelf.toggleAttribute('data-dark', pageDark());
                  // The shelf shares the body's stacking layer with its launchers, while launchers on <html>
                  // remain above it. Only launchers inside another stacking layer need a cutout.
                  var stacks = function (cs) {
                      return (cs.zIndex !== 'auto' && cs.position !== 'static') || cs.isolation === 'isolate' || +cs.opacity < 1
                          || cs.transform !== 'none' || cs.filter !== 'none' || cs.mixBlendMode !== 'normal' || /paint|layout|strict|content/.test(cs.contain || '');
                  };
                  var rr = function (x, y, rw, rh, r) {
                      r = Math.max(0, Math.min(r, rw / 2, rh / 2));
                      var a = function (dx, dy) { return 'a' + r + ' ' + r + ' 0 0 1 ' + dx + ' ' + dy; };
                      return 'M' + (x + r) + ' ' + y + 'h' + (rw - 2 * r) + a(r, r) + 'v' + (rh - 2 * r) + a(-r, r)
                          + 'h' + (2 * r - rw) + a(-r, -r) + 'v' + (2 * r - rh) + a(r, -r) + 'z';
                  };
                  var ox = b.left - pad, oy = b.top - pad, d = rr(0, 0, w, h, Math.min(w, h) / 2);
                  Array.prototype.forEach.call(document.querySelectorAll('[data-mbu-docked=show],[data-mbu-docked=peek]'), function (el) {
                      var under = false;
                      for (var p = el.parentElement; p && p !== document.body && p !== root; p = p.parentElement) if (stacks(getComputedStyle(p))) { under = true; break; }
                      if (!under) return;
                      var r = el.getBoundingClientRect();
                      if (r.width && r.height) d += rr(r.left - ox, r.top - oy, r.width, r.height, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
                  });
                  shelf.style.clipPath = 'path(evenodd, "' + d + '")';
              }
              root.toggleAttribute('data-mbu-dock-over', over);
          };
          document.addEventListener('mousemove', shelfOver, true);
          root.addEventListener('mouseleave', function () { root.removeAttribute('data-mbu-dock-over'); });
          btn.addEventListener('mouseenter', function () {
              clearTimeout(leaveT);
              if (root.hasAttribute('data-mbu-dock-open')) return;
              root.setAttribute('data-mbu-dock-hover', ''); root.setAttribute('data-mbu-dock-open', '');
              mbRestackCorner('br');
          });
          document.addEventListener('mousemove', function (e) {
              if (!root.hasAttribute('data-mbu-dock-hover')) return;
              clearTimeout(leaveT);
              if (inDock(e)) return;
              leaveT = setTimeout(function () {
                  if (!root.hasAttribute('data-mbu-dock-hover')) return;
                  root.removeAttribute('data-mbu-dock-hover'); root.removeAttribute('data-mbu-dock-open');
                  mbRestackCorner('br');
              }, 400);
          }, true);
          root.appendChild(btn);   // outside the body, which Event Horizon swaps
          root.toggleAttribute('data-mbu-dock-open', !!mbuShared('dockOpen'));
          if (mbuShared('cornerOffset') !== undefined) mbuShared('cornerOffset', null);   // dragging the launchers is gone (#851)
      }
      var open = root.hasAttribute('data-mbu-dock-open'), n = 0, busy = false;
      if (mbuShared('cornerFlow') === 'row') root.setAttribute('data-mbu-flow', 'row'); else root.removeAttribute('data-mbu-flow');
      if (mbuShared('cornerSide') === 'left') root.setAttribute('data-mbu-side', 'left'); else root.removeAttribute('data-mbu-side');
      root.toggleAttribute('data-mbu-dock-frost', mbuShared('dockHover') === 'shelf');
      mbuDockCount(root);
      els.forEach(function (el) {
          if ((eh && el.dataset.mbCornerDock === 'hide') || (el.dataset.mbCornerPaths && !new RegExp(el.dataset.mbCornerPaths).test(location.pathname))) { el.setAttribute('data-mbu-docked', 'off'); return; }
          var was = el.getAttribute('data-mbu-docked');
          el.removeAttribute('data-mbu-docked');   // measured as its script left it
          var shown = getComputedStyle(el).display !== 'none';
          if (shown) { n++; if (el.hasAttribute('data-mbu-busy')) busy = true; }
          var now = !shown ? 'hide' : open ? 'show' : /^[+]?[1-9]/.test(el.dataset.mbCornerStatus || '') || el.hasAttribute('data-mbu-actionable') ? 'peek' : 'hide';
          var out = el.hasAttribute('data-mbu-peek-out');
          // A peek that ends slides back into the dock button, so it stays drawn until it is there
          // (mbRestackCorner runs the slide, which knows the distance). This runs on every restack,
          // hence the attributes: a CSS animation would replay, and another script's copy can't see a property.
          if (now === 'hide' && shown && (was === 'peek' || out) && el.animate && !mbuStill()) {
              el.setAttribute('data-mbu-docked', 'peek');
              el.setAttribute('data-mbu-peek-out', '');
              return;
          }
          if (out) { el.removeAttribute('data-mbu-peek-out'); mbuPeekStop(el); }
          el.setAttribute('data-mbu-docked', now);
          if (now === 'peek' && (was !== 'peek' || out)) el.setAttribute('data-mbu-peek-in', '');
      });
      mbuDockKnow(els);
      // Busy ends a moment late: members hand work on with short gaps, and each would blink the dash out.
      clearTimeout(mbuDockBusyT);
      if (busy) { clearTimeout(mbuDockFadeT); btn.removeAttribute('data-mbu-busy-out'); btn.setAttribute('data-mbu-busy', ''); }
      else if (btn.hasAttribute('data-mbu-busy')) mbuDockBusyT = setTimeout(function () {
          btn.removeAttribute('data-mbu-busy');
          btn.setAttribute('data-mbu-busy-out', '');   // the dash keeps moving while it fades out
          mbuDockFadeT = setTimeout(function () { btn.removeAttribute('data-mbu-busy-out'); }, 800);
      }, 600);
      // The icon is written once and only the count changes: a rewrite restarts the running dash. Read from
      // the DOM, not a property, which scripts in other sandboxes can't see.
      if (!btn.querySelector('svg .mbu-dock-run')) btn.innerHTML = MBU_DOCK_ICON;
      var cnt = btn.querySelector(':scope>b');
      if (!n) { if (cnt) cnt.remove(); }
      else if (!cnt) btn.insertAdjacentHTML('beforeend', '<b>' + n + '</b>');
      else if (cnt.textContent !== String(n)) cnt.textContent = n;
  }
  // String Theory's Counter: dockCount (seg | bare, null the pill) draws a count ("3", "0,8", "2,4/44")
  // as coloured cells or bare digits, pink to do, grey held back, violet after the slash, a zero
  // left out; dockCountPos (side, null on the icon) moves it beside the icon, away from the dock's
  // edge: left of a right column, right of a left one, above a row. Cells are a child span, kept in
  // step with data-mb-corner-status by one observer for every script's copy. Its CSS is its own
  // sheet, so a copy of the block older than this one that injected the dock's CSS first still
  // gets it.
  function mbuDockCount(root) {
      var style = mbuShared('dockCount');
      style = style === 'seg' || style === 'bare' ? style : null;
      if (style) root.setAttribute('data-mbu-count', style); else root.removeAttribute('data-mbu-count');
      root.toggleAttribute('data-mbu-count-side', mbuShared('dockCountPos') === 'side');
      if (!document.getElementById('mbu-dock-count-css')) {
          var S = ':is([data-mbu-docked=show],[data-mbu-docked=peek],.mbu-dock-item:not([data-mbu-docked]))';
          var col = ':root[data-mbu-count-side]:not([data-mbu-flow=row])', row = ':root[data-mbu-count-side][data-mbu-flow=row]';
          var at = function (sel) { return [S + '[data-mb-corner-status]:not([data-mb-corner-status^="✓"])::after', S + '>.mbu-dock-n', '#mbu-dock>b'].map(function (x) { return sel + ' ' + x; }).join(','); };
          var css = document.createElement('style'); css.id = 'mbu-dock-count-css';
          css.textContent = '.mbu-dock-n{display:none}.mbu-dock-n s{text-decoration:none}'
              + ':root[data-mbu-count] ' + S + '[data-mbu-count-cells]::after{content:none}'
              + ':root[data-mbu-count] ' + S + '[data-mbu-count-cells]>.mbu-dock-n{display:flex;position:absolute;top:-4px;right:-4px;font:700 11px/1 system-ui,sans-serif;white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:none;-webkit-font-smoothing:antialiased;pointer-events:none;opacity:1}'
              + ':root[data-mbu-count] ' + S + '[data-mbu-busy]>.mbu-dock-n,:root[data-mbu-count] #mbu-dock[data-mbu-busy]>b{animation:mbu-dock-fade 1.2s ease-in-out infinite}'
              // Segmented: one pill of solid cells, ringed in the page's colour
              + ':root[data-mbu-count=seg] .mbu-dock-n{height:18px;border-radius:9px;overflow:hidden;box-shadow:0 0 0 1.5px var(--mbu-count-halo,#fff)}'
              + ':root[data-mbu-count=seg] .mbu-dock-n s{min-width:18px;padding:0 5px;box-sizing:border-box;display:grid;place-items:center}'
              + ':root[data-mbu-count=seg] .mbu-dock-n s+s{box-shadow:inset 1px 0 0 rgba(255,255,255,.55)}'
              + ':root[data-mbu-count=seg] .mbu-dock-n-t{background:#e05aa5;color:#fff}:root[data-mbu-count=seg] .mbu-dock-n-h{background:#e6e3ea;color:#6d6777}:root[data-mbu-count=seg] .mbu-dock-n-a{background:#6f42c1;color:#fff}'
              + ':root[data-mbu-count=seg] #mbu-dock>b{border:0;padding:0 5px;background:#e05aa5;color:#fff;line-height:18px;box-shadow:0 0 0 1.5px var(--mbu-count-halo,#fff)}'
              // Bare: digits haloed in the page's colour, to do large
              + ':root[data-mbu-count=bare] .mbu-dock-n{top:-7px;right:-8px;align-items:baseline;gap:0}'
              + ':root[data-mbu-count=bare] :is(.mbu-dock-n,#mbu-dock>b){font-size:14px;paint-order:stroke;-webkit-text-stroke:4px var(--mbu-count-halo,#fff)}'
              + ':root[data-mbu-count=bare] .mbu-dock-n-t{color:#e05aa5}:root[data-mbu-count=bare] .mbu-dock-n-h{color:#8a8494}:root[data-mbu-count=bare] .mbu-dock-n-a{color:#6f42c1}'
              + ':root[data-mbu-count=bare][data-mbu-count-dark] .mbu-dock-n-h{color:#9a94a3}:root[data-mbu-count=bare][data-mbu-count-dark] .mbu-dock-n-a{color:#9d7ae0}'
              + ':root[data-mbu-count=bare] #mbu-dock>b{top:-7px;right:-6px;min-width:0;height:auto;padding:0;border:0;background:none;color:#e05aa5;font-weight:700;line-height:1}'
              // Beside: centred on the icon's side away from the edge, or above it in a row
              + at(col + ':not([data-mbu-side=left])') + '{top:50%;right:calc(100% + 3px);left:auto;bottom:auto;transform:translateY(-50%)}'
              + at(col + '[data-mbu-side=left]') + '{top:50%;left:calc(100% + 3px);right:auto;bottom:auto;transform:translateY(-50%)}'
              + at(row) + '{top:auto;bottom:calc(100% + 3px);right:50%;left:auto;transform:translateX(50%)}';
          root.appendChild(css);
      }
      if (style) mbuDockHalo(root);
      Array.prototype.forEach.call(document.querySelectorAll('[data-mb-corner-status],[data-mbu-count-cells]'), mbuDockCells);
      if (!root.hasAttribute('data-mbu-count-obs') && window.MutationObserver) {
          root.setAttribute('data-mbu-count-obs', '');
          new MutationObserver(function (ms) { ms.forEach(function (r) { mbuDockCells(r.target); }); })
              .observe(root, { subtree: true, attributes: true, attributeFilter: ['data-mb-corner-status'] });
      }
  }
  // The count's halo: the page's own background, a dark userstyle's included. Read again by
  // mbuTheme whenever the page may have changed theme, so switching themes doesn't leave the
  // old background's halo around the digits; written only when it changes, since the root's
  // style attribute is what wakes mbuTheme.
  function mbuDockHalo(root) {
      var bg = function (el) { var c = el && getComputedStyle(el).backgroundColor, m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); return m && !(m[4] !== undefined && +m[4] < 0.5) ? m : null; };
      var m = bg(document.body) || bg(root);
      var halo = m ? 'rgb(' + m[1] + ', ' + m[2] + ', ' + m[3] + ')' : '#fff';
      if (root.style.getPropertyValue('--mbu-count-halo') !== halo) root.style.setProperty('--mbu-count-halo', halo);
      var dark = !!m && (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.5;
      if (root.hasAttribute('data-mbu-count-dark') !== dark) root.toggleAttribute('data-mbu-count-dark', dark);
  }
  function mbuDockCells(el) {
      var m = document.documentElement.hasAttribute('data-mbu-count') && /^(\d+)(?:,(\d+))?(?:\/(\d+))?$/.exec(el.getAttribute('data-mb-corner-status') || '');
      var html = '', span = el.querySelector(':scope>.mbu-dock-n');
      if (m && document.documentElement.getAttribute('data-mbu-count') === 'bare') {
          // Bare lists the status as the pill does, zeros and separators included, each part in its colour
          [['t', '', m[1]], ['h', ',', m[2]], ['a', '/', m[3]]].forEach(function (c) {
              if (c[2] != null) html += '<s class="mbu-dock-n-' + (c[0] === 't' && !+c[2] ? 'h' : c[0]) + '">' + c[1] + c[2] + '</s>';
          });
      } else if (m) {
          [['t', m[1]], ['h', m[2]], ['a', m[3]]].forEach(function (c) { if (+c[1]) html += '<s class="mbu-dock-n-' + c[0] + '">' + +c[1] + '</s>'; });
          if (!html) html = '<s class="mbu-dock-n-h">0</s>';
      }
      if (!html) { if (span) span.remove(); el.removeAttribute('data-mbu-count-cells'); return; }
      if (!span) { span = document.createElement('span'); span.className = 'mbu-dock-n'; el.appendChild(span); }
      if (span.innerHTML !== html) span.innerHTML = html;
      el.setAttribute('data-mbu-count-cells', '');
  }
  // Records each named bottom-right launcher's icon in dockKnown, for String Theory's settings to list
  // the ones not on this page too; written only when something changed.
  function mbuDockKnow(els) {
      var known = mbuShared('dockKnown') || {}, changed = false, seen = {};
      els.forEach(function (el) {
          var name = el.dataset.mbCornerLabel, ic = name && !seen[name] && el.querySelector('img,svg');
          if (!ic) return;
          seen[name] = true;   // one icon a name: Art Station has two launchers
          var icon = ic.tagName.toLowerCase() === 'img' ? '<img src="' + String(ic.getAttribute('src') || '').replace(/"/g, '&quot;') + '" alt="">' : ic.outerHTML;
          if (icon.length > 40000 || known[name] === icon) return;
          known[name] = icon; changed = true;
      });
      if (changed) mbuShared('dockKnown', known);
  }
  // A launcher's place in the bottom-right corner: the dock's button first, then dockOrder's names, then
  // the rest by data-mb-corner-order
  function mbuCornerRank(el, order) {
      if (el.id === 'mbu-dock') return -1e6;
      var i = order ? order.indexOf(el.dataset.mbCornerLabel) : -1;
      return i >= 0 ? i - 1e5 : Number(el.dataset.mbCornerOrder) || 0;
  }
  // A script's entry that lives in the dock only (#847): for a script whose own controls sit in
  // MusicBrainz's page, which Event Horizon replaces. o: id, label, icon (an image URL), order,
  // paths (as data-mb-corner-paths), click. Outside the dock it is never shown, unless the script clears its
  // data-mb-corner-dock (the Interface setting's Dock icon, #851): then it is a launcher of its own. Returns the button,
  // with .status(text) to show a short state (a count) beside it. o.busyIcon: an animated image shown in place of
  // the icon while busy with nothing counted yet, instead of the "···" dots. o.busySpin: seconds a turn, for a busy icon
  // that turns round its centre (a radar sweep): the dock turns the image itself, so when the work ends it eases to rest
  // upright before the icon comes back, where an SVG's own animation can only snap
  function mbuDockItem(o) {
      var b = document.getElementById(o.id);
      if (!b) {
          b = document.createElement('button'); b.type = 'button'; b.id = o.id; b.className = 'mbu-dock-item';
          b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = String(o.order || 60); b.dataset.mbCornerDock = 'only';
          if (o.paths) b.dataset.mbCornerPaths = o.paths;
          var img = document.createElement('img'); img.src = o.icon; img.alt = ''; b.appendChild(img);
          var dots = document.createElement('span'); dots.className = 'mbu-dock-dots'; dots.innerHTML = '<i></i><i></i><i></i>'; b.appendChild(dots);   // while nothing is counted yet
          b.onclick = o.click;
          document.documentElement.appendChild(b);   // outside the body, which Event Horizon swaps
      }
      b.dataset.mbCornerLabel = o.label; b.mbuIcon = o.icon; b.mbuBusyIcon = o.busyIcon || ''; b.mbuSpin = o.busySpin || 0;
      // .status(t): the count beside it; .busy(on): while it works, a faint "···" where the count goes,
      // or the count so far, fading; .card(fn): a hover card, fn() → its HTML (mbuTipCard)
      var show = function () { var busy = b.hasAttribute('data-mbu-busy'), t = b.mbuSt || (busy && !b.mbuBusyIcon ? '···' : '');
          var im = b.querySelector('img'), src = busy && !b.mbuSt && b.mbuBusyIcon || b.mbuIcon; if (im && src) spin(im, src);
          if (t) b.dataset.mbCornerStatus = t; else delete b.dataset.mbCornerStatus;
          var r = document.documentElement; if (r.hasAttribute('data-mbu-dock') && b.isConnected) mbRestackCorner('br'); };   // update the dock's loading state and any peek
      // The busy icon turns by its rotate (never transform, which the hover's scale has), and on its way out it finishes
      // the turn decelerating evenly from full speed, a whole extra turn when it is nearly up, so it never stops short
      var spin = function (im, src) {
          var on = src === b.mbuBusyIcon, deg = function () { return (parseFloat(getComputedStyle(im).rotate) || 0) % 360; };
          if (!b.mbuSpin || !im.animate) { if (im.getAttribute('src') !== src) im.src = src; return; }
          if (on) {
              if (b.mbuSpinA) return;
              var a = deg(); if (b.mbuSettleA) { b.mbuSettleA.cancel(); b.mbuSettleA = null; }   // back at work mid-settle: on from there
              if (im.getAttribute('src') !== src) im.src = src;
              b.mbuSpinA = im.animate([{ rotate: a + 'deg' }, { rotate: a + 360 + 'deg' }], { duration: b.mbuSpin * 1000, iterations: Infinity });
              return;
          }
          if (b.mbuSettleA) return;
          if (!b.mbuSpinA) { if (im.getAttribute('src') !== src) im.src = src; return; }
          var from = deg(), left = 360 - from; if (left < 90) left += 360;
          b.mbuSpinA.cancel(); b.mbuSpinA = null;
          // even deceleration from full speed covers the rest in twice the time it would take at that speed
          b.mbuSettleA = im.animate([{ rotate: from + 'deg' }, { rotate: from + left + 'deg' }], { duration: 2 * left / 360 * b.mbuSpin * 1000, easing: 'cubic-bezier(.333,.667,.667,1)' });
          b.mbuSettleA.onfinish = function () { b.mbuSettleA = null; show(); };
      };
      b.status = function (t) { b.mbuSt = t || ''; show(); };
      b.busy = function (on) { if (on) b.dataset.mbuBusy = ''; else delete b.dataset.mbuBusy; show(); };
      b.card = function (fn) { if (typeof mbuTip === 'function') mbuTip(b, fn || null, { card: true }); };
      // a bigger icon gets its size, even whole pixels, never a transform (the dock's CSS has why), folded too
      if (o.scale) { b.style.setProperty('--mbu-di', Math.round(17 * o.scale) * 2 + 'px'); b.style.setProperty('--mbu-di-p', Math.round(14 * o.scale) * 2 + 'px'); }
      b.status('');
      mbRestackCorner('br');
      return b;
  }
  // The folded dock's peeks move out of its button and back into it: fast at first, slowing to a stop
  // at the end. Reduced motion keeps only a fade in.
  function mbuStill() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function mbuPeekStop(el) {
      if (el.getAnimations) el.getAnimations().forEach(function (a) { if (/^mbu-peek/.test(a.id)) a.cancel(); });
  }
  function mbuPeekMove(el, dx, dy) {
      var away = dx + 'px ' + dy + 'px', ease = 'cubic-bezier(.16,1,.3,1)';
      if (el.hasAttribute('data-mbu-peek-in')) {
          el.removeAttribute('data-mbu-peek-in');
          if (!el.animate) return;
          mbuPeekStop(el);
          var a = mbuStill() ? el.animate([{ '--mbu-peek-o': 0 }, { '--mbu-peek-o': 1 }], { duration: 250, easing: 'ease-out' })
              : el.animate([{ translate: away, '--mbu-peek-o': 0 }, { translate: '0px 0px', '--mbu-peek-o': 1 }], { duration: 450, easing: ease });
          a.id = 'mbu-peek-in';
      }
      if (el.hasAttribute('data-mbu-peek-out') && el.getAnimations && !el.getAnimations().some(function (a) { return a.id === 'mbu-peek-out'; })) {
          mbuPeekStop(el);
          var b = el.animate([{ translate: '0px 0px', '--mbu-peek-o': 1 }, { translate: away, '--mbu-peek-o': 0 }], { duration: 350, easing: ease, fill: 'forwards' });
          b.id = 'mbu-peek-out';
          b.onfinish = function () {
              if (!el.hasAttribute('data-mbu-peek-out')) return;
              el.removeAttribute('data-mbu-peek-out');
              el.setAttribute('data-mbu-docked', 'hide');
              b.cancel();
              mbRestackCorner('br');   // the peeks after it close up
          };
      }
  }
  function mbRestackCorner(corner) {
      if (corner === 'br') mbuDock();
      var bottom = corner[0] === 'b', right = (corner[1] === 'r') !== (mbuShared('cornerSide') === 'left');
      var row = mbuShared('cornerFlow') === 'row';
      var vv = window.visualViewport, gapX = 0, gapY = 0, html = document.documentElement;
      // a launcher, not a panel: only those scale (First Contact's open card isn't one)
      var small = function (el) { return el.offsetHeight <= 64 && el.offsetWidth <= 240; };
      var size = Math.min(1.6, Math.max(0.6, Number(mbuShared('cornerSize')) || 1));
      if (corner === 'br') html.style.setProperty('--mbu-cs', String(size));
      var peek = function (el) { return el.getAttribute('data-mbu-docked') === 'peek'; };
      var fit = function (el) {
          var on = size !== 1 && small(el);
          if (on) { el.style.scale = String(size); el.setAttribute('data-mb-corner-scaled', ''); }
          else if (el.hasAttribute('data-mb-corner-scaled')) { el.style.scale = ''; el.removeAttribute('data-mb-corner-scaled'); }
          // a launcher's peek scale(.8) shrinks it toward the corner too, so the stack below can centre what is drawn
          el.style.transformOrigin = on || peek(el) ? (bottom ? 'bottom ' : 'top ') + (right ? 'right' : 'left') : '';
      };
      if (vv) {
          // what a fixed element is placed against, measured: clientWidth leaves out a scrollbar but is the screen's width on a phone, where the page is wider (360 of 780), and innerWidth is the reverse
          var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;right:0;height:0;visibility:hidden;pointer-events:none';
          document.documentElement.appendChild(box); var fixedW = box.offsetWidth; box.remove();
          gapX = Math.max(0, right ? fixedW - vv.offsetLeft - vv.width : vv.offsetLeft);
          gapY = Math.max(0, bottom ? window.innerHeight - vv.offsetTop - vv.height : vv.offsetTop);
          var root = document.documentElement;
          if (!root.hasAttribute('data-mb-corner-vv')) {   // one listener for every script's copy
              root.setAttribute('data-mb-corner-vv', '');
              var queued = false;
              var again = function () {
                  if (queued) return;
                  queued = true;
                  requestAnimationFrame(function () { queued = false; ['br', 'bl', 'tr', 'tl'].forEach(function (c) { if (document.querySelector('[data-mb-corner="' + c + '"]')) mbRestackCorner(c); }); });
              };
              vv.addEventListener('resize', again);
              vv.addEventListener('scroll', again);
              // the layout viewport can change alone, with no event: a full-screen view pins the page's body
              // (780px → the screen's width); the body's size is what moves then
              window.addEventListener('resize', again);
              if (window.ResizeObserver && document.body) new window.ResizeObserver(again).observe(document.body);
          }
      }
      var edge = document.documentElement.hasAttribute('data-mbu-dock') ? 6 : 14;   // docked (Event Horizon), nearer the edge: the page keeps a column clear for them
      var peeks = [], order = corner === 'br' && mbuShared('dockOrder');
      order = Array.isArray(order) ? order : null;
      var byRank = function (a, b) { return mbuCornerRank(a, order) - mbuCornerRank(b, order); };
      var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
          // offsetParent is always null for position:fixed, so it can't tell visibility here
          .filter(function (el) { return !el.hidden && getComputedStyle(el).display !== 'none'; })
          .filter(function (el) { if (el.getAttribute('data-mbu-docked') !== 'peek') return true; peeks.push(el); return false; })
          .sort(byRank);
      // launchers share one centre line across the flow: a 34px one beside the 40px dock button sat
      // flush to the edge instead, off centre by half the difference, times the corner's size
      // what is drawn across: the corner's size, and a peeking launcher's scale(.8) as well (a dock entry is laid out smaller)
      var across = function (el) { return (row ? el.offsetHeight : el.offsetWidth) * (el.hasAttribute('data-mb-corner-scaled') ? size : 1) * (peek(el) && !el.classList.contains('mbu-dock-item') ? 0.8 : 1); };
      els.concat(peeks).forEach(fit);
      var lane = 0;
      els.concat(peeks).forEach(function (el) { if (small(el)) lane = Math.max(lane, across(el)); });
      var inset = function (el) { return small(el) ? Math.round((lane - across(el)) / 2) : 0; };
      var pos = edge;
      els.forEach(function (el) {
          el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? edge + inset(el) : pos)) + 'px';
          el.style[right ? 'right' : 'left'] = (gapX + (row ? pos : edge + inset(el))) + 'px';
          el.style[right ? 'left' : 'right'] = 'auto';
          pos += (row ? el.offsetWidth : el.offsetHeight) * (el.hasAttribute('data-mb-corner-scaled') ? size : 1) + 8;
      });
      // the folded dock's peeking entries: in a line from its button, along the stack's flow
      var side = edge + 44 * size;
      peeks.sort(byRank).forEach(function (el) {
          el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? edge + inset(el) : side)) + 'px';
          el.style[right ? 'right' : 'left'] = (gapX + (row ? side : edge + inset(el))) + 'px';
          el.style[right ? 'left' : 'right'] = 'auto';
          var d = Math.round(side - edge);   // its way to the dock button, along the flow
          mbuPeekMove(el, row ? (right ? d : -d) : 0, row ? 0 : (bottom ? d : -d));
          side += 36 * size;
      });
  }

  // Activity log: the session's log lines plus the viewers that show them
  // (#283's viewer, shared since X12 of #623). A script makes its log once:
  //
  //   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
  //   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
  //   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
  //   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
  //   LOG.cat('Spotify').info(…)        // the same calls, each line tagged with a category
  //   LOG.pre(text)                     // a block kept as written: line breaks, spacing, monospace (#705)
  //   LOG.mount(el, { tools })          // the viewer inside the script's own panel (#705)
  //
  // Categories (#697) are optional. A tagged line shows its category before the
  // message and in the Markdown ("WARN [Spotify] …"). The viewer grows a row of
  // filters only when there is a choice: the levels once two of them have lines
  // (ok counts as info), the categories once there are two. Click one to see only
  // those lines, click it again to see all; Copy always takes everything.
  //
  // The floating window (open) and a mounted viewer (mount) are the same viewer;
  // mount draws it into an element of the script's, without the title bar's
  // window buttons, and o.tools (an element) sits in its toolbar before Clear.
  // Every viewer has a debug switch: off, LOG.debug() lines are not recorded at all
  // (remembered per script under o.key; LOG.debugOn(), LOG.setDebug(v)).
  //
  // o.name / o.version  the Markdown summary's title (version may be a function)
  // o.subtitle          optional function; its text follows the title (e.g. the release)
  // o.header            the window's title (default 'Activity log')
  // o.key               storage key for the window's open/minimised/position state
  // o.load / o.save     that storage (default GM_getValue / GM_setValue)
  // o.before            called before the window opens (e.g. to inject the script's CSS)
  // o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
  // o.history           opt-in history of past sessions (#705), below; history.auto (#890) also keeps a
  //                     session at its first warning or error, and names a kept one after the page
  //
  // A long run keeps only the last o.max lines, and the Markdown says how many went
  // before them; the copies this replaced grew for the whole session. An open
  // viewer appends each new line and drops the oldest row past the cap; the copies
  // rebuilt the whole list with innerHTML on every line, which is quadratic over a
  // long matching run.
  //
  // History (#705, Falcon's run logs of #512 made shared). Off unless o.history is given:
  //
  //   o.history = { prefix: 'falcon:session:', lines: 400, head: 140,
  //                 parse: s => entry, nameOf: entries => name, store }
  //
  // A session starts with the page, or with LOG.session(reason) (Falcon: each run).
  // Only a session the script marks with LOG.keep() is stored, so a page that did
  // nothing worth reading back leaves nothing behind; LOG.name(text) names it (the
  // first name stays). It is stored in the page's localStorage under prefix + id,
  // within 100 ms of each line and at once on LOG.flush(), so a crashed tab keeps
  // its log; a session longer than `lines` keeps its first `head` lines and its
  // end, and says how many went between. The newest 10 sessions are kept, not configurable
  // (#811); each script's prefix is its own, and Clear history clears only that script's.
  // Leaving the page (a script's reload after its operation, #811) flushes at once.
  // prefix + 'current' holds the last kept session's id (LOG.last()), so LOG.resume(id)
  // can carry on a session across a navigation. The viewer gets a session list and Clear history.
  //   LOG.sessionId(); LOG.last(); LOG.isKept(); LOG.refresh(); LOG.sessions(); LOG.load(id); LOG.forget(id); LOG.clearHistory(); LOG.flush()
  // parse reads a stored line that is a string (an older format); nameOf names a
  // session stored without a name; store ({ get, set, del, keys }) replaces localStorage.
  function mbuLog(o) {
      o = o || {};
      var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, views = [], bound = {};
      var LEVELS = ['error', 'warn', 'info', 'debug'];
      var group = function (sev) { return sev === 'ok' ? 'info' : sev; };
      var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
      var ts = function (d) { return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3) : '--:--:--.---'; };
      var str = function (v) {
          if (typeof v === 'string') return v;
          if (v instanceof Error) return v.message || String(v);
          if (v && v.nodeType) return '<' + (v.tagName || 'node').toLowerCase() + '>';
          try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
      };
      var esc = function (s) {
          return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
      };
      // escape, then make http(s) URLs clickable, keeping trailing punctuation out of them
      var linkify = function (s) {
          return esc(s).replace(/(https?:\/\/[^\s<]+)/g, function (m) {
              var t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];
              var url = m.slice(0, m.length - t.length);
              return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + t;
          });
      };
      var load = o.load || function (k) { try { return GM_getValue(k, undefined); } catch (e) { return undefined; } };
      var save = o.save || function (k, v) { try { GM_setValue(k, v); } catch (e) { /* no storage: the window just forgets */ } };
      var state = function () { try { return JSON.parse(load(o.key) || '{}') || {}; } catch (e) { return {}; } };
      var remember = function (patch) { try { save(o.key, JSON.stringify(Object.assign(state(), patch))); } catch (e) { /* see save */ } };
      // debug lines are recorded only while the viewer's debug switch is on (default off: majkinetor, #705), per script
      var dbgOn = null;
      var debugOn = function () { if (dbgOn === null) dbgOn = state().debug === true; return dbgOn; };
      var setDebug = function (v) { dbgOn = !!v; remember({ debug: dbgOn }); views.forEach(function (w) { if (w.dbg) w.dbg.checked = dbgOn; }); };
      var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
      var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
      var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + (e.cat ? '[' + e.cat + '] ' : '') + (e.pre ? '\n' : '') + e.msg; };
      var countOf = function (list) {
          var c = { warn: 0, error: 0 };
          list.forEach(function (e) { if (e.sev === 'warn') c.warn++; else if (e.sev === 'error') c.error++; });
          return c;
      };

      // ── history (#705) ──
      var H = o.history || null, hp = H && (H.prefix || ((o.key || 'mbu') + ':session:'));
      var ID_RE = /^\d{14}-\d+$/, sid = '', kept = false, sname = '', savedName = '', seq = 0, pTimer = 0, lastSaved = '';
      var store = H && (H.store || {
          get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
          set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* full or blocked: the session just isn't kept */ } },
          del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
          // one call for all the keys: a userscript reaches localStorage through Firefox's
          // Xray wrapper, where each call costs, and the page may hold hundreds of keys
          keys: function () {
              try { var all = Object.keys(localStorage); if (all.length === localStorage.length) return all; } catch (e) { /* the loop below */ }
              var out = []; try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { /* none */ } return out;
          },
      });
      var keepN = function () { return 10; };   // #811: the last 10 sessions, not configurable
      var newId = function () { return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + (++seq); };
      // the id is the session's start in UTC: YYYYMMDDHHMMSS-n
      var idDate = function (id) {
          var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/.exec(id || '');
          return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
      };
      function ids() {
          if (!H) return [];
          return store.keys().filter(function (k) { return k && k.indexOf(hp) === 0 && ID_RE.test(k.slice(hp.length)); })
              .map(function (k) { return k.slice(hp.length); }).sort();   // the id's own timestamp sorts as a string
      }
      // a stored line: [time ms | null, sev, cat | 0, msg, pre 1/0]; a string is an older format, read by H.parse
      function fromStored(x, id) {
          if (typeof x === 'string') {
              var p = null;
              try { p = H.parse ? H.parse(x, idDate(id)) : null; } catch (e) { /* unreadable: kept as text */ }
              return p ? { t: p.t || null, sev: p.sev || 'info', cat: p.cat || '', msg: String(p.msg == null ? x : p.msg), pre: !!p.pre } : { t: null, sev: 'info', msg: x };
          }
          if (!Array.isArray(x)) return null;
          var e = { t: x[0] != null ? new Date(x[0]) : null, sev: x[1] || 'info', msg: String(x[3] == null ? '' : x[3]) };
          if (x[2]) e.cat = String(x[2]);
          if (x[4]) e.pre = true;
          return e;
      }
      function loadSession(id) {
          if (!H || !id) return null;
          var raw = store.get(hp + id);
          if (raw == null) return null;
          try { return (JSON.parse(raw) || []).map(function (x) { return fromStored(x, id); }).filter(Boolean); } catch (e) { return null; }
      }
      // a past session's name doesn't change, so it is read (or mined from its lines) once
      var names = {};
      function nameOf(id, entries) {
          if (id in names) return names[id];
          var n = store.get(hp + id + ':name');
          if (!n) { try { n = H.nameOf ? H.nameOf(entries || loadSession(id) || []) || '' : ''; } catch (e) { n = ''; } }
          return (names[id] = n || '');
      }
      // the first `head` lines and the end, and a line saying how many went between
      function storedWindow() {
          var cap = H.lines || 400, head = Math.min(H.head || 140, cap - 2);
          var pack = function (e) { return [e.t ? e.t.getTime() : null, e.sev, e.cat || 0, e.msg, e.pre ? 1 : 0]; };
          if (buf.length <= cap) return buf.map(pack);
          var tail = cap - head - 1, cut = buf.length - head - tail;
          return buf.slice(0, head).map(pack)
              .concat([[null, 'info', 0, '——— ' + cut + ' line(s) from the middle of this session were dropped to fit the stored-log budget; its start and end are kept in full ———', 0]])
              .concat(buf.slice(-tail).map(pack));
      }
      function flush() {
          clearTimeout(pTimer); pTimer = 0;
          if (!H || !sid || !kept) return;
          try {
              var payload = JSON.stringify(storedWindow());
              if (payload === lastSaved) return;
              lastSaved = payload;
              store.set(hp + sid, payload);
              if (sname && savedName !== sname) { store.set(hp + sid + ':name', sname); savedName = sname; }
          } catch (e) { /* not stored */ }
      }
      var persist = function () { if (H && kept && !pTimer) pTimer = setTimeout(flush, 100); };
      function keepNow() {
          if (!H || !sid || kept) return;
          kept = true;
          // H.auto (#890): a kept session the script didn't name is named after the page
          if (H.auto && !sname) { try { var t = String(document.title || '').split(' - MusicBrainz')[0].trim(); if (t) sname = t; } catch (e) { /* no title */ } }
          store.set(hp + 'current', sid); flush(); prune(); views.forEach(function (v) { v.sessions(); });
      }
      function forget(id) { if (H && id) { store.del(hp + id); store.del(hp + id + ':name'); delete names[id]; } }
      function prune() {
          var all = ids().filter(function (id) { return id !== sid; });
          var excess = all.length + (kept ? 1 : 0) - keepN();
          if (excess > 0) all.slice(0, excess).forEach(forget);
      }
      // past sessions, newest first, without the current one
      function sessions() {
          return ids().filter(function (id) { return id !== sid; }).reverse()
              .map(function (id) { return { id: id, date: idDate(id), name: nameOf(id) }; });
      }
      var sessionLabel = function (s) {
          var d = s.date, when = d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : s.id;
          return when + (s.name ? ' — ' + s.name : '');
      };
      function startSession() {
          flush();
          sid = newId(); kept = false; sname = ''; savedName = ''; lastSaved = '';
          reset();
      }
      function resume(id) {
          var entries = loadSession(id);
          if (!entries) return false;
          flush();
          reset();
          sid = id; kept = true; sname = savedName = store.get(hp + id + ':name') || '';
          lastSaved = store.get(hp + id) || '';
          store.set(hp + 'current', sid);
          entries.forEach(function (e) { push(e); });
          return true;
      }

      // ── the live lines ──
      function reset() {
          buf = []; dropped = 0; warn = 0; error = 0;
          views.forEach(function (v) { if (!v.past) v.show(null); v.sessions(); });
      }
      function push(e) {
          buf.push(e); tally(e, 1);
          // trim in chunks, not one shift per line
          if (buf.length > max + Math.ceil(max / 10)) {
              var gone = buf.splice(0, buf.length - max);
              gone.forEach(function (g) { tally(g, -1); });
              dropped += gone.length;
          }
          views = views.filter(function (v) { return v.el.isConnected; });
          views.forEach(function (v) { if (!v.past) v.append(e); });
      }
      function add(sev, args, cat, pre) {
          var msg = Array.prototype.map.call(args, str).join(' ');
          msg = pre ? msg.replace(/\s+$/, '') : msg.replace(/\s+/g, ' ').trim();
          if (!msg) return;
          var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
          if (e.sev === 'debug' && !debugOn()) return;
          if (cat) e.cat = String(cat);
          if (pre) e.pre = true;
          push(e);
          persist();
          if (H && H.auto && !kept && (e.sev === 'warn' || e.sev === 'error')) keepNow();   // H.auto: a session with a problem is kept
      }
      function title(bare) {
          var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
          var t = (o.name || 'Log') + (v ? ' v' + v : '');
          try { var s = !bare && o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
          return t;
      }
      // past: { id, entries } to copy a stored session instead of this one
      function markdown(past) {
          var list = past ? past.entries : buf, c = past ? countOf(list) : { warn: warn, error: error };
          var body = list.length ? list.map(line).join('\n') : '(no activity logged)';
          if (!past && dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
          var n = (c.warn || c.error) ? ' (' + c.warn + ' warning' + (c.warn === 1 ? '' : 's') + ', ' + c.error + ' error' + (c.error === 1 ? '' : 's') + ')' : '';
          var what = past ? 'log of ' + sessionLabel({ id: past.id, date: idDate(past.id), name: nameOf(past.id, list) }) : 'session log';
          var fence = String.fromCharCode(96, 96, 96);
          return '<details><summary>' + title(!!past) + ' — ' + what + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
      }
      function copy(btn, past) {
          var md = markdown(past);
          var done = function (ok) {
              if (!btn) return;
              var was = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = was;
              btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
              setTimeout(function () { btn.textContent = was; }, 1500);
          };
          var fallback = function () {
              var ok = false;
              try {
                  var ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
                  document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
              } catch (x) { /* nothing left to try */ }
              done(ok);
          };
          try { navigator.clipboard.writeText(md).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
      }

      // ── a viewer: the floating window or one mounted in the script's panel ──
      var vseq = 0;
      function view(root, floating, tools) {
          var vid = String(++vseq);
          root.classList.add('mbu-logpop');
          root.dataset.mbuLv = vid;
          root.innerHTML = mbuHtml('<div class="mbu-logpop-h">' + (floating ? '<b>' + esc(o.header || 'Activity log') + '</b> ' : '') + '<span class="mbu-log-badge"></span>'
              + '<input class="mbu-log-q" type="search" placeholder="Filter" data-tip="Show only the lines with this text\nEsc: empty the box" autocomplete="off">'
              + (H ? '<select class="mbu-log-ses mbu-select" data-tip="The session shown\nThis one, or a past one kept in this browser"></select>' : '')
              + '<span class="mbu-logpop-sp"></span>'
              + (H ? '<button class="mbu-logpop-hclear" type="button" data-tip="Delete every past session\nThis one stays">Clear history</button>' : '')
              + '<label class="mbu-log-dbg" data-tip="Record each step in detail\nLeave it on when reporting a problem"><input type="checkbox"> debug</label>'
              + '<button class="mbu-logpop-clear" type="button" data-tip="Clear the log\nThe lines so far are gone">Clear</button>'
              + '<button class="mbu-logpop-copy" type="button" data-tip="Copy the whole log as Markdown\nReady to paste into a GitHub issue">⧉ Copy</button>'
              + (floating ? '<button class="mbu-logpop-full" type="button" data-tip="Full screen\nDouble-click: the title bar does the same">⛶</button>'
                  + '<button class="mbu-logpop-min" type="button" data-tip="Minimize">–</button>'
                  + '<button class="mbu-logpop-x" type="button" data-tip="Close">✕</button>' : '') + '</div>'
              + '<div class="mbu-log-f" hidden></div><style class="mbu-log-fcss"></style>'
              + '<div class="mbu-log-list"></div>' + (floating ? '<div class="mbu-logpop-grip" data-tip="Resize"></div>' : ''));
          if (tools) root.querySelector('.mbu-logpop-clear').before(tools);
          var list = root.querySelector('.mbu-log-list'), badge = root.querySelector('.mbu-log-badge');
          var qEl = root.querySelector('.mbu-log-q'), q = '', sel = root.querySelector('.mbu-log-ses');
          var fRow = root.querySelector('.mbu-log-f'), fCss = root.querySelector('.mbu-log-fcss');
          // what this viewer shows: the live lines, or a past session (read-only)
          var past = null, src = buf, cats = [], catIx = {}, sevs = {}, fSev = null, fCat = null;
          var scope = '.mbu-logpop[data-mbu-lv="' + vid + '"] ';
          var miss = function (e) { return !!q && ((e.cat || '') + ' ' + e.msg).toLowerCase().indexOf(q) < 0; };
          // note a line's level and category; true when the filter row must change
          var note = function (e) {
              var grew = false;
              if (e.cat && !(e.cat in catIx)) { catIx[e.cat] = cats.length; cats.push(e.cat); grew = true; }
              if (!sevs[group(e.sev)]) { sevs[group(e.sev)] = true; grew = true; }
              return grew;
          };
          var row = function (e) {
              var d = document.createElement('div');
              d._e = e;
              d.className = 'mbu-log-li mbu-log-' + e.sev + (e.pre ? ' mbu-log-pre' : '');
              if (miss(e)) d.classList.add('mbu-log-nq');
              d.dataset.s = group(e.sev);
              if (e.cat) d.dataset.c = catIx[e.cat];
              d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span>'
                  + '<span class="mbu-log-c">' + esc(e.cat || '') + '</span>'
                  + '<span class="mbu-log-m">' + linkify(e.msg) + '</span>');
              return d;
          };
          // the filter row, redrawn when a level or category first appears; hiding is one
          // rule in the viewer's own <style>, not a walk over the rows
          var filters = function () {
              var lv = LEVELS.filter(function (l) { return sevs[l]; });
              var showL = lv.length > 1, showC = cats.length > 1;
              if (fSev && !sevs[fSev]) fSev = null;
              if (fCat != null && !(fCat in catIx)) fCat = null;
              var b = function (kind, v, on) {
                  return '<button type="button" class="mbu-log-fb' + (on ? ' on' : '') + '" data-' + kind + '="' + esc(v) + '">' + esc(v) + '</button>';
              };
              fRow.innerHTML = mbuHtml((showL ? '<span class="mbu-log-fg">' + lv.map(function (l) { return b('sev', l, fSev === l); }).join('') + '</span>' : '')
                  + (showL && showC ? '<span class="mbu-log-fs"></span>' : '')
                  + (showC ? '<span class="mbu-log-fg">' + cats.map(function (c) { return b('cat', c, fCat === c); }).join('') + '</span>' : ''));
              fRow.hidden = !showL && !showC;
              list.classList.toggle('mbu-log-cats', cats.length > 0);
              fCss.textContent = (fSev ? scope + '.mbu-log-li:not([data-s="' + fSev + '"]){display:none}' : '')
                  + (fCat != null ? scope + '.mbu-log-li:not([data-c="' + catIx[fCat] + '"]){display:none}' : '');
          };
          var showBadge = function () {
              var c = past ? countOf(src) : { warn: warn, error: error };
              badge.textContent = '(' + src.length + ')' + (c.warn || c.error ? ' · ' + c.warn + '⚠ ' + c.error + '✖' : '');
          };
          var empty = function () { return '<div class="mbu-log-empty">' + (past ? 'Nothing was kept of this session.' : 'No activity yet.') + '</div>'; };
          var queued = false, follow = true;
          var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
          // all rows at once: on opening, and when the session shown changes
          var draw = function () {
              cats = []; catIx = {}; sevs = {};
              src.forEach(note);
              var frag = document.createDocumentFragment();
              src.forEach(function (e) { frag.appendChild(row(e)); });
              list.innerHTML = mbuHtml(src.length ? '' : empty());
              if (src.length) list.appendChild(frag);
              filters(); showBadge();
              follow = true; list.scrollTop = list.scrollHeight;
              root.classList.toggle('mbu-log-past', !!past);
          };
          list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
          var qTimer = 0;
          var refilter = function () {
              q = qEl.value.trim().toLowerCase();
              for (var d = list.firstElementChild; d; d = d.nextElementSibling) if (d._e) d.classList.toggle('mbu-log-nq', miss(d._e));
              follow = true; list.scrollTop = list.scrollHeight;
          };
          qEl.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(refilter, 120); });
          fRow.addEventListener('click', function (ev) {
              var t = ev.target.closest('.mbu-log-fb'); if (!t) return;
              if (t.dataset.sev) fSev = fSev === t.dataset.sev ? null : t.dataset.sev;
              else fCat = fCat === t.dataset.cat ? null : t.dataset.cat;
              filters();
              follow = true; list.scrollTop = list.scrollHeight;
          });
          var v = {
              el: root, floating: floating, past: null, q: qEl,
              append: function (e) {
                  var em = list.querySelector('.mbu-log-empty'); if (em) em.remove();
                  if (note(e)) filters();
                  list.appendChild(row(e));
                  while (list.childElementCount > buf.length) list.firstElementChild.remove();
                  if (!queued) { queued = true; requestAnimationFrame(paint); }
              },
              // null: the live lines; an id: that past session
              show: function (id) {
                  var entries = id ? loadSession(id) : null;
                  if (id && !entries) entries = [{ t: null, sev: 'warn', msg: 'This session could not be read (it may have been deleted in another tab).' }];
                  past = id && entries ? id : null; v.past = past;
                  src = past ? entries : buf;
                  if (sel && sel.value !== (past || '')) sel.value = past || '';
                  draw();
              },
              // the session list, refreshed when it is opened and when a session starts
              sessions: function () {
                  if (!sel) return;
                  var all = sessions(), sig = all.map(function (x) { return x.id + '=' + x.name; }).join('|');
                  if (sig === v.sig && !(past && !all.some(function (x) { return x.id === past; }))) return;
                  v.sig = sig;
                  if (past && !all.some(function (s) { return s.id === past; })) { past = null; v.past = null; src = buf; draw(); }
                  sel.innerHTML = mbuHtml('<option value="">Current session</option>' + all.map(function (s) {
                      return '<option value="' + esc(s.id) + '">' + esc(sessionLabel(s)) + '</option>';
                  }).join(''));
                  sel.value = past || '';
                  var hc = root.querySelector('.mbu-logpop-hclear'); if (hc) hc.disabled = !all.length;
              },
              filters: filters,
          };
          if (sel) {
              sel.addEventListener('change', function () { v.show(sel.value || null); });
              root.querySelector('.mbu-logpop-hclear').onclick = function () { clearHistory(); };
          }
          root.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
          v.dbg = root.querySelector('.mbu-log-dbg input');
          v.dbg.checked = debugOn();
          v.dbg.onchange = function () { setDebug(v.dbg.checked); };
          root.querySelector('.mbu-logpop-copy').onclick = function () {
              copy(root.querySelector('.mbu-logpop-copy'), past ? { id: past, entries: src } : null);
          };
          v.sessions();
          draw();
          views.push(v);
          return v;
      }

      var win = null;
      function open() {
          close(true);
          if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
          remember({ open: true });
          var st = state();
          var pop = document.createElement('div'); pop.id = 'mbu-logpop';
          document.body.appendChild(pop);
          var v = view(pop, true);
          if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
          var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
          // Escape in a filled filter empties it; anywhere else it closes the window. Only the log:
          // it listens first (capture, on window) and keeps the key, so the script's own window under
          // it (ISRC Scout's closes on Escape too) stays open
          var onKey = function (e) {
              if (e.key !== 'Escape') return;
              e.stopPropagation();
              if (e.target === v.q && v.q.value) { v.q.value = ''; v.q.dispatchEvent(new Event('input')); return; }
              close();
          };
          win = { el: pop, v: v, off: function () { window.removeEventListener('keydown', onKey, true); } };
          var minBtn = pop.querySelector('.mbu-logpop-min');
          var setMin = function (m) {
              minBtn.textContent = m ? '▢' : '–'; minBtn.dataset.tip = m ? 'Restore' : 'Minimize';
              if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
              else Object.assign(pop.style, restore);
          };
          var fullBtn = pop.querySelector('.mbu-logpop-full');
          var setFull = function (f) {
              pop.classList.toggle('full', f);
              fullBtn.textContent = f ? '❐' : '⛶'; fullBtn.dataset.tip = (f ? 'Restore the size' : 'Full screen') + '\nDouble-click: the title bar does the same';
          };
          minBtn.onclick = function () {
              var m = pop.classList.toggle('min');
              if (m && pop.classList.contains('full')) { setFull(false); remember({ full: false }); }   // minimising leaves full screen
              setMin(m); remember({ min: m });
          };
          fullBtn.onclick = function () { var f = !pop.classList.contains('full'); setFull(f); remember({ full: f }); };
          pop.querySelector('.mbu-logpop-h').addEventListener('dblclick', function (e) {
              if (!e.target.closest('button, input, select') && !pop.classList.contains('min')) fullBtn.click();
          });
          // a size the user gave it, from the corner grip
          if (st.w && st.h) { pop.style.width = st.w; pop.style.height = st.h; pop.classList.add('sized'); }
          if (st.min) { pop.classList.add('min'); setMin(true); }
          else if (st.full) setFull(true);
          pop.querySelector('.mbu-logpop-grip').addEventListener('mousedown', function (e) {
              e.preventDefault(); e.stopPropagation();
              var r = pop.getBoundingClientRect();
              // pin the top-left corner, so only the right and bottom edges move
              pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.bottom = ''; pop.style.transform = 'none';
              pop.classList.add('sized');
              var x0 = e.clientX, y0 = e.clientY;
              var mv = function (ev) {
                  pop.style.width = Math.max(320, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + 'px';
                  pop.style.height = Math.max(120, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + 'px';
              };
              var up = function () {
                  document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                  restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                  remember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
              };
              document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
          });
          pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
          // floating and non-modal: dragged by its header
          pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
              if (e.target.closest('button, input, select') || pop.classList.contains('full')) return;
              e.preventDefault();
              var r = pop.getBoundingClientRect();
              pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
              var ox = e.clientX - r.left, oy = e.clientY - r.top;
              var mv = function (ev) {
                  pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
                  pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + 'px';
              };
              var up = function () {
                  document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                  if (!pop.classList.contains('min')) {
                      restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                      remember({ left: pop.style.left, top: pop.style.top });
                  }
              };
              document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
          });
          window.addEventListener('keydown', onKey, true);
          return pop;
      }
      // the viewer inside an element of the script's; a second mount there replaces the first
      function mount(host, opts) {
          if (!host) return null;
          views = views.filter(function (v) { if (v.el.parentNode === host) { v.el.remove(); return false; } return true; });
          var el = document.createElement('div'); el.className = 'mbu-logemb';
          host.appendChild(el);
          return view(el, false, opts && opts.tools).el;
      }
      // empty the live log: the lines, the counts and the "earlier lines not kept" note
      function clear() {
          buf = []; dropped = 0; warn = 0; error = 0;
          if (H && sid) { store.del(hp + sid); lastSaved = ''; }
          views.forEach(function (v) { if (!v.past) v.show(null); });
      }
      function clearHistory() {
          if (!H) return;
          ids().forEach(function (id) { if (id !== sid) forget(id); });
          views.forEach(function (v) { v.sessions(); });
      }
      // quiet: closing to reopen, so the remembered "open" stays as it is
      function close(quiet) {
          var stray = document.getElementById('mbu-logpop');
          if (win) {
              win.off(); win.el.remove();
              views = views.filter(function (v) { return v !== win.v; });
              win = null; if (!quiet) remember({ open: false });
          }
          if (stray) stray.remove();   // another script's window: one log window at a time
      }
      var api = {
          info: function () { add('info', arguments); },
          warn: function () { add('warn', arguments); },
          err: function () { add('error', arguments); },
          error: function () { add('error', arguments); },
          ok: function () { add('ok', arguments); },
          debug: function () { add('debug', arguments); },
          add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1)); },
          // the debug switch: are debug lines recorded?
          debugOn: function () { return debugOn(); },
          setDebug: setDebug,
          pre: function () { add('info', arguments, null, true); },
          // a logger whose lines carry this category; the same object for the same name
          cat: function (name) {
              if (!name) return api;
              if (!bound[name]) bound[name] = {
                  info: function () { add('info', arguments, name); },
                  warn: function () { add('warn', arguments, name); },
                  err: function () { add('error', arguments, name); },
                  error: function () { add('error', arguments, name); },
                  ok: function () { add('ok', arguments, name); },
                  debug: function () { add('debug', arguments, name); },
                  add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1), name); },
                  pre: function () { add('info', arguments, name, true); },
              };
              return bound[name];
          },
          open: open,
          mount: mount,
          close: function () { close(); },
          reopen: function () { if (state().open) open(); },
          isOpen: function () { return !!win; },
          markdown: function () { return markdown(); },
          // a stored session as Markdown, as its Copy gives it ('' when there is none)
          markdownOf: function (id) { var e = loadSession(id); return e && e.length ? markdown({ id: id, entries: e }) : ''; },
          copy: function (btn) { copy(btn); },
          clear: clear,
          lines: function () { return buf.map(line); },
          entries: function () { return buf.slice(); },
          messages: function () { return buf.map(function (e) { return e.msg; }); },
          counts: function () { return { warn: warn, error: error }; },
          // history (#705); harmless without o.history
          session: function () { if (H) startSession(); return sid; },
          resume: function (id) { return H ? resume(id) : false; },
          keep: keepNow,
          name: function (text) { if (H && text && !sname) { sname = String(text); if (kept) store.set(hp + sid + ':name', sname); } },
          sessionId: function () { return sid; },
          last: function () { return H ? store.get(hp + 'current') : null; },
          isKept: function () { return kept; },
          sessions: function () { return H ? sessions() : []; },
          load: function (id) { return loadSession(id); },
          forget: function (id) { forget(id); views.forEach(function (v) { v.sessions(); }); },
          clearHistory: clearHistory,
          // redraw the session lists (a script showing its mounted viewer again); only a changed list is redrawn
          refresh: function () { views.forEach(function (v) { v.sessions(); }); },
          flush: flush,
      };
      if (H && !o.reader) {
          sid = newId();
          // #811: a script reloads the page right after its operation; write the kept session
          // now rather than trusting the 100 ms timer to beat the unload
          try { window.addEventListener('pagehide', flush); } catch (e) { /* no window */ }
      }
      // o.reader: only reads a history's stored sessions (mbuLogHistory), so it leaves no trace
      if (o.reader) return api;
      mbuLog.active = api;   // the script's own log, for helpers that note things in it (mbuClaim)
      // For String Theory's New issue with log (#890). Every log on the page, by its script's name, gives this
      // page's session as Markdown; scripts in one userscript (the bundle) share window, a standalone copy
      // fills its own. A log with a history also names its store in the shared 'logHistory' ({ name: prefix }),
      // so its kept sessions can be read on any page, whether or not the script runs there.
      try {
          var me = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.name) || o.name || o.header || 'script';
          var reg = window.__mbuLogs = window.__mbuLogs || {};
          reg[me] = { markdown: function () { return buf.length ? markdown() : ''; } };
      } catch (e) { /* no window */ }
      if (H && !H.store && o.name) {
          try {
              var known = mbuShared('logHistory') || {};
              if (known[o.name] !== hp) { known[o.name] = hp; mbuShared('logHistory', known); }
          } catch (e) { /* storage blocked */ }
      }
      return api;
  }

  // The kept sessions of every log with a history (#890), from the shared 'logHistory', on any page:
  //   mbuLogHistory() → [{ name, id, date, label, markdown() }], newest first
  function mbuLogHistory() {
      var known = {}, out = [];
      try { known = mbuShared('logHistory') || {}; } catch (e) { /* storage blocked */ }
      Object.keys(known).forEach(function (name) {
          var L = mbuLog({ name: name, reader: true, history: { prefix: known[name] } });
          L.sessions().forEach(function (s) {
              var d = s.date, two = function (n) { return String(n).padStart(2, '0'); };
              var when = d ? d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) : s.id;
              out.push({ name: name, id: s.id, date: d, label: when + (s.name ? ' — ' + s.name : ''), markdown: function () { return L.markdownOf(s.id); } });
          });
      });
      return out.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  }

  // Dismiss-on-outside-click, with the trailing click SWALLOWED.
  //
  //   var off = mbuDismissOn(popoverEl, close);   // off() to detach early
  //
  // #305: a popover torn down on mousedown removes what was under the cursor, so
  // the click that follows lands on whatever the page reflowed into that spot and
  // activates it. Tearing down on click instead just moves the problem. So: close
  // on outside mousedown, then eat exactly one click in the capture phase. This is
  // the single most repeated interaction bug in these scripts and it belongs in
  // one place — it is why #563 says interaction is part of the contract.
  //
  // Esc closes too, innermost first: the handler is registered in capture and stops
  // propagation, so a popover inside a modal does not close the modal as well.
  function mbuDismissOn(el, close, opts) {
      opts = opts || {};
      var closed = false;
      var onDown = function (e) {
          if (closed || !el || el.contains(e.target)) return;
          if (opts.ignore && e.target.closest && e.target.closest(opts.ignore)) return;
          finish();
          // swallow the click this mousedown will produce, once
          var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', eat, true); };
          document.addEventListener('click', eat, true);
          setTimeout(function () { document.removeEventListener('click', eat, true); }, 400);
      };
      var onKey = function (e) {
          if (closed || e.key !== 'Escape') return;
          e.stopPropagation();
          finish();
      };
      function finish() {
          if (closed) return;
          closed = true;
          document.removeEventListener('mousedown', onDown, true);
          document.removeEventListener('keydown', onKey, true);
          try { close(); } catch (err) { /* a throwing closer must not leave listeners behind */ }
      }
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onKey, true);
      return finish;
  }

  // Collapse a toolbar to icon-only when its buttons would wrap.
  //
  //   mbuFitToolbar(barEl)            // call on build, and on resize
  //
  // Measured by SUMMING child widths rather than reading scrollWidth or comparing
  // offsetTop: a bar with flex:1 spacers never overflows its own scroll box, so
  // both of those report "fits" right up until it visibly wraps. Art Station
  // learned that the hard way (#234) and it is the only reason this is a helper
  // rather than one CSS rule.
  //
  // opts.gap    inter-item gap in px (default 11)
  // opts.pad    horizontal padding to leave (default 24)
  // opts.spacer selector for flexible spacers, which must not count (default .mbu-sp)
  function mbuFitToolbar(bar, opts) {
      if (!bar) return false;
      opts = opts || {};
      var gap = opts.gap == null ? 11 : opts.gap;
      var pad = opts.pad == null ? 24 : opts.pad;
      var spacer = opts.spacer || '.mbu-sp';
      bar.classList.remove('mbu-compact');            // measure at full labels
      var kids = [].slice.call(bar.children);
      var need = gap * Math.max(0, kids.length - 1);
      for (var i = 0; i < kids.length; i++) {
          if (kids[i].matches && kids[i].matches(spacer)) continue;
          need += kids[i].offsetWidth;
      }
      var compact = need > bar.clientWidth - pad;
      bar.classList.toggle('mbu-compact', compact);
      return compact;
  }

  // Publish the components on a shared namespace. Three reasons, in order:
  //
  //  1. it is the cross-userscript contract #563 is about — another script (or a
  //     future one) gets the standard widgets without copying them, the same way
  //     Mammoth already exposes its field-memory through a documented convention;
  //  2. it makes the components testable from outside, which is the only way to
  //     assert the *behaviour* half of the contract rather than just the markup;
  //  3. it costs nothing when several scripts do it — the definitions are
  //     byte-identical, so first writer wins and the rest are no-ops.
  //
  // Guarded per key, never clobbering: a script that loaded first keeps its copy,
  // and a page that defines an unrelated window.MBU is left alone.
  // Theme recognition. #564: "we don't have to conform to Stylus vars, we could
  // probably use them as a recognition signal to enable our own dark theme."
  //
  // That is the right way round. Reading --background/--text and hoping every
  // derived colour lands somewhere readable is guesswork that fails one token at a
  // time; knowing WHICH theme we are in lets the token set say so outright, and
  // lets us hand the browser the one thing CSS variables cannot express —
  // color-scheme, which is what actually paints a checkbox dark instead of leaving
  // a white (Firefox: black) box on a dark panel.
  //
  // The signal is the rendered page, not a particular userstyle's variable names:
  // whatever painted the body, we measure its luminance. So this works for Stylus,
  // for a browser extension, for MusicBrainz shipping its own dark mode one day,
  // and for a user who just set --background by hand.
  //
  //   · an explicit --mbu-theme (light|dark) always wins — the escape hatch;
  //   · otherwise the page background decides;
  //   · re-checked when stylesheets arrive, because Stylus often lands after us.
  function mbuThemeOf(bg) {
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || '');
      if (!m) return null;
      if (m[4] !== undefined && +m[4] < 0.5) return null;      // transparent tells us nothing
      var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      var L = 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
      return L < 0.35 ? 'dark' : 'light';
  }
  // #569 (chaban-mb) — write only when the value actually changes.
  //
  // The DOM does not do this for you. classList.add of a token already present,
  // classList.toggle to the state it is already in, setAttribute with the value it
  // already has: each one re-sets the attribute and dispatches a mutation record.
  // Harmless once; these run from 2Hz heartbeats and from observers that react to
  // each other, and the measured idle cost on the release editor was 66 records a
  // second, of which 93% came from writes that changed nothing (see
  // dev/ui/measure-569-idle-mutations.mjs).
  //
  // Semantically these are exact no-ops: they skip a write ONLY when the value is
  // already the one being written, so nothing that reads the DOM afterwards can
  // tell the difference. That is the whole reason they are safe to sprinkle around
  // a 2Hz loop.
  function mbuCls(el, token, on) {
      if (!el || !el.classList) return;
      if (el.classList.contains(token) !== !!on) el.classList.toggle(token, !!on);
  }
  function mbuAttr(el, name, value) {
      if (!el) return;
      if (value === null || value === undefined || value === false) {
          if (el.hasAttribute(name)) el.removeAttribute(name);
      } else if (el.getAttribute(name) !== String(value)) {
          el.setAttribute(name, String(value));
      }
  }
  // For IDL properties (disabled, title, textContent, style.display …). Reading
  // them is cheap; writing them is not, and textContent in particular replaces
  // every child node.
  //
  // ⚠ textContent is the one to think twice about: its getter concatenates the
  // text of ALL descendants, so on an element with child ELEMENTS the comparison
  // can match while the DOM shape is wrong, and the guard then skips a write that
  // would have flattened it. Only use it where the target holds text and nothing
  // else.
  function mbuProp(obj, prop, value) {
      if (!obj) return;
      if (obj[prop] !== value) obj[prop] = value;
  }

  // #569: the one element mbuTheme resolves --background through. Looked up by id
  // rather than kept in a variable, so the seven scripts of a bundle share ONE
  // probe instead of adding seven, and so it heals itself if anything removes it.
  // It lives in <body>: a permanent stray node under <html>, outside head and
  // body, is the sort of thing another script's document scan trips over.
  function mbuProbe() {
      var p = document.getElementById('mbu-theme-probe');
      if (p) return p;
      if (!document.body) return null;
      p = document.createElement('span');
      p.id = 'mbu-theme-probe';
      p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background:var(--background)';
      document.body.appendChild(p);
      return p;
  }
  function mbuTheme() {
      var root = document.documentElement;
      try {
          var cs = getComputedStyle(root);
          var forced = (cs.getPropertyValue('--mbu-theme') || '').trim();
          var t = (forced === 'dark' || forced === 'light') ? forced
              : (mbuThemeOf(getComputedStyle(document.body).backgroundColor)
                  || mbuThemeOf(cs.backgroundColor)
                  || mbuThemeOf(cs.getPropertyValue('--mbu-bg'))
                  || 'light');
          if (root.getAttribute('data-mbu-theme') !== t) root.setAttribute('data-mbu-theme', t);
          if (root.hasAttribute('data-mbu-count') && typeof mbuDockHalo === 'function') mbuDockHalo(root);

          // Should we adopt the userstyle's OWN shades, or use our own palette?
          // Only if its --background actually agrees with the theme we detected.
          // A userstyle can paint the page dark with ordinary rules and still leave
          // --background at a light value for its own purposes; taking that on
          // trust hands us a light surface under a correct dark theme, which is
          // indistinguishable from the bug it looks like. Measured, not assumed.
          var seed = null;
          var raw = (cs.getPropertyValue('--background') || '').trim();
          if (raw) {
              // Resolved through a real element, because --background may itself be
              // a var(), a named colour, or anything else CSS accepts.
              //
              // #569 (chaban-mb): this used to CREATE and REMOVE that element on
              // every call, as a direct child of <html>. mbuTheme re-runs whenever
              // the root or body class changes, Mammoth watches the whole document
              // for childList changes and reacts by toggling classes on <html>, and
              // those class changes wake mbuTheme again — a self-feeding loop,
              // measured at 12 root-node mutations a second on an idle page, which
              // is what makes DevTools blink.
              //
              // One element, created once and left in place, breaks it: the value
              // is still resolved LIVE on every call (a cached reading would freeze
              // the theme at whatever it was before Stylus injected, which is the
              // bug this whole function exists to avoid) but nothing is added to or
              // removed from the DOM to read it.
              var probe = mbuProbe();
              var got = null;
              if (probe) {
                  got = mbuThemeOf(getComputedStyle(probe).backgroundColor);
              } else {
                  // No <body> yet — document-start. Fall back to the transient
                  // element for these first one or two calls; the idle loop this
                  // avoids cannot exist before the page has a body anyway.
                  var tmp = document.createElement('span');
                  tmp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--background)';
                  document.documentElement.appendChild(tmp);
                  got = mbuThemeOf(getComputedStyle(tmp).backgroundColor);
                  tmp.remove();
              }
              if (got === t) seed = 'theme';
          }
          // guarded: setAttribute dispatches a mutation record even when the value
          // is unchanged, and this runs several times a second
          if (seed) { if (root.getAttribute('data-mbu-seed') !== seed) root.setAttribute('data-mbu-seed', seed); }
          else if (root.hasAttribute('data-mbu-seed')) root.removeAttribute('data-mbu-seed');
          return t;
      } catch (e) { return 'light'; }
  }
  // A document-start script runs before the document is parsed: documentElement can
  // still be null, and <head> and <body> don't exist. Observing a null root threw, the
  // catch below swallowed it, and nothing (the watches, the re-checks) was ever set up,
  // so such a script never read the theme at all (#625). It starts on the parsed page.
  function mbuThemeStart() { try {
      mbuTheme();
      // Stylus and friends inject after us often enough that a one-shot read is
      // wrong about half the time. Watch for stylesheets ARRIVING — head childList
      // plus the root's own attributes — and never the whole subtree: this runs on
      // the release editor, where a subtree observer calling getComputedStyle is a
      // layout thrash on every keystroke.
      var _mbuThemeT = 0;
      var _mbuThemeSoon = function () {
          clearTimeout(_mbuThemeT);
          _mbuThemeT = setTimeout(mbuTheme, 150);
      };
      var _mbuThemeObs = new MutationObserver(_mbuThemeSoon);
      _mbuThemeObs.observe(document.documentElement, { attributeFilter: ['style', 'class'] });
      // ⚠ #569: characterData, not just childList. Until the idle thrash was fixed
      // this function ran several times a second whether or not anything had
      // changed — Apollo re-added a body class at 2Hz, which woke this observer,
      // which is how a theme change was ever noticed. That accidental polling was
      // LOAD-BEARING: with the thrash gone and only head-childList watched, a
      // userstyle that REWRITES ITSELF (Stylus editing it live, or one switching
      // palette) adds and removes no nodes, so nothing woke us and the theme went
      // stale. Caught by verify-569-theme-still-tracks.mjs, which passes on the
      // pre-fix build and failed on the first version of this one.
      if (document.head) _mbuThemeObs.observe(document.head, { childList: true, subtree: true, characterData: true });
      if (document.body) _mbuThemeObs.observe(document.body, { attributeFilter: ['style', 'class'] });
      // …and the case that produces no DOM mutation at all: the OS flipping to dark
      // under a userstyle with a prefers-color-scheme query. Nothing above can see
      // that, and nothing did before either — it was simply never noticed while the
      // page was re-checking itself several times a second.
      try {
          var _mbuMq = matchMedia('(prefers-color-scheme: dark)');
          if (_mbuMq.addEventListener) _mbuMq.addEventListener('change', _mbuThemeSoon);
          else if (_mbuMq.addListener) _mbuMq.addListener(_mbuThemeSoon);
      } catch (e) {}
      setTimeout(mbuTheme, 400);
      setTimeout(mbuTheme, 2000);
  } catch (e) { /* no observer, no theme switching — the light defaults still apply */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbuThemeStart, { once: true });
  else mbuThemeStart();

  try {
      var _mbuNs = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
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
  } catch (e) { /* a locked-down page must not stop the script loading */ }

  // Tooltips: our own, never the browser's title (dev/ui/tooltip.mjs, STANDARDS → Standard 14).
  function mbuTipV() { return 13; }
  function mbuTipCssText() { return "#mbu-tip{position:fixed;left:0;top:0;z-index:var(--mbu-z-tip,2147483647);box-sizing:border-box;max-width:min(330px,calc(100vw - 16px));padding:7px 11px 8px;background:var(--mbu-bg,#fff);color:var(--mbu-text,#222);border:1px solid var(--mbu-border,#cfc6e6);border-radius:9px;box-shadow:0 6px 24px rgba(40,20,80,.2),0 1px 3px rgba(40,20,80,.12);font:12.5px/1.45 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);text-align:left;white-space:normal;overflow-wrap:break-word;letter-spacing:normal;text-transform:none;pointer-events:none;visibility:hidden;opacity:0;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}#mbu-tip.mbu-tip-up{transform:translateY(3px)}#mbu-tip.mbu-tip-on{visibility:visible;opacity:1;transform:none;transition:opacity .12s ease,transform .12s ease}#mbu-tip.mbu-tip-act.mbu-tip-on{pointer-events:auto}#mbu-tip.mbu-tip-wide{max-width:min(460px,calc(100vw - 16px))}#mbu-tip:has(.mbu-tip-dl){max-width:min(480px,calc(100vw - 16px))}#mbu-tip::before{content:\"\";position:absolute;left:calc(var(--mbu-tip-ax,50%) - 5px);top:-5px;width:8px;height:8px;background:inherit;border:1px solid var(--mbu-border,#cfc6e6);border-right:0;border-bottom:0;transform:rotate(45deg)}#mbu-tip.mbu-tip-up::before{top:auto;bottom:-5px;border:1px solid var(--mbu-border,#cfc6e6);border-left:0;border-top:0}#mbu-tip.mbu-tip-card:not(.mbu-tip-up)::before{background:var(--mbu-bg-raised,#faf9fe)}#mbu-tip .mbu-tip-lead{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-p{margin:0;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-lead+*,#mbu-tip .mbu-tip-p+*,#mbu-tip .mbu-tip-ul+*,#mbu-tip .mbu-tip-rows+*{margin-top:5px}#mbu-tip>.mbu-tip-p:first-child:last-child{color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-warn{color:var(--mbu-warn,#a05a00)}#mbu-tip .mbu-tip-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:start;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-rows>.mbu-tip-kk,#mbu-tip .mbu-tip-rows>.mbu-tip-dl{min-height:18px}#mbu-tip .mbu-tip-rows>.mbu-tip-k{line-height:18px}#mbu-tip .mbu-tip-rows>:nth-child(odd){justify-self:start}#mbu-tip .mbu-tip-rows>.mbu-tip-span{grid-column:2;justify-self:stretch;margin:-2px 0 0}#mbu-tip .mbu-tip-k{display:inline-block;padding:0;border:0;background:none;color:var(--mbu-text-weak,#888);font:600 11.5px/1.5 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-kk{display:inline-flex;align-items:center;gap:3px;color:var(--mbu-accent-text,#5f3ec0);white-space:nowrap}#mbu-tip .mbu-tip-dl{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--mbu-text,#222);white-space:nowrap}#mbu-tip .mbu-tip-dl i{flex:none;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}#mbu-tip .mbu-tip-on{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip .mbu-tip-dl.mbu-tip-on::after{content:\"◂\";margin-left:-2px;font-size:11px}#mbu-tip .mbu-tip-off{opacity:.45}#mbu-tip .mbu-tip-sym{letter-spacing:.2px}#mbu-tip .mbu-tip-mouse{display:block;flex:none;position:relative}#mbu-tip .mbu-tip-mouse rect[fill=none],#mbu-tip .mbu-tip-mouse path[stroke]{stroke:var(--mbu-text-weak,#888);stroke-width:1}#mbu-tip .mbu-tip-kx{font:600 10px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}#mbu-tip .mbu-tip-kq{font:600 11.5px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}#mbu-tip .mbu-tip-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}#mbu-tip .mbu-tip-o{display:inline-block;padding:0 7px;border-radius:999px;background:var(--mbu-accent-soft,#ece4ff);color:var(--mbu-accent-text,#5f3ec0);font:600 11px/1.6 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-ul{margin:0;padding:0 0 0 15px;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-ul li{margin:1px 0;padding:0}#mbu-tip code{font:11.5px var(--mbu-font-mono,ui-monospace,Consolas,monospace);padding:0 4px;border-radius:4px;background:var(--mbu-bg-sunken,#f4f2f9)}#mbu-tip b{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip a{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip.mbu-tip-card{padding:0;width:380px;max-width:min(380px,calc(100vw - 16px));overflow:visible}#mbu-tip .mbu-tip-ch{display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid var(--mbu-border-soft,#e2dcef);background:var(--mbu-bg-raised,#faf9fe);border-radius:9px 9px 0 0}#mbu-tip .mbu-tip-ca{margin-left:auto;font-size:11px;color:var(--mbu-text-weak,#999);white-space:nowrap}#mbu-tip .mbu-tip-cb{padding:8px 11px;display:flex;flex-direction:column;gap:6px}#mbu-tip .mbu-tip-cf{display:flex;gap:10px;padding:6px 11px;border-top:1px solid var(--mbu-border-soft,#e2dcef);font-size:11px;color:var(--mbu-text-weak,#999)}#mbu-tip .mbu-tip-cf>:last-child:not(:first-child){margin-left:auto}@media (prefers-reduced-motion:reduce){#mbu-tip,#mbu-tip.mbu-tip-on{transition:none;transform:none}}"; }
  function mbuTipRoots() { return ".mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu"; }
  function mbuTipEsc(s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
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
      return mbuTipEsc(s)
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
          .replace(/\(((?:(?:Ctrl|Alt|Shift|Cmd|Meta)\+)+[^\s()]+)\)/g, function (m, k) { return mbuTipKbd(k); })
          .replace(/\s\((Esc|Enter|Space|Tab|[A-Z0-9]|[↑↓←→])\)(?=$|[\s.,;])/g, ' <kbd class="mbu-tip-k">$1</kbd>');
  }
  function mbuTipCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function mbuTipMod(k) { return { ctrl: 'C', alt: 'A', shift: '⇧', cmd: '⌘', meta: '⌘' }[String(k).toLowerCase()] || k; }
  function mbuTipKbd(combo) {
      var parts = String(combo).split(/\s*\+\s*/);
      var key = parts.pop();
      return '<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">' + mbuTipEsc(combo) + '</span><span aria-hidden="true">'
          + parts.concat('').map(mbuTipMod).join('+') + mbuTipEsc(key.length === 1 ? key.toUpperCase() : mbuTipCap(key)) + '</span></kbd>';
  }
  function mbuTipKey(label) {
      // two ways to do the same, "Middle-click / Alt+click" or "Click or hover": each drawn, a grey slash between
      var alts = String(label).split(/\s+(?:\/|or)\s+/i);
      if (alts.length > 1) return '<span class="mbu-tip-kk">' + alts.map(mbuTipKey).join('<span class="mbu-tip-kx">/</span>') + '</span>';
      // a mouse action with where or how it goes, "Click the status", "Click again": the mouse, then the words
      var q = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*(?:left|right|middle|double)?[- ]?(?:click|drag|wheel|scroll))\s+([^+/]+)$/i.exec(String(label).trim());
      if (q) return '<span class="mbu-tip-kk">' + mbuTipKey(q[1]) + '<span class="mbu-tip-kq">' + mbuTipEsc(q[2]) + '</span></span>';
      // two mouse actions at once, "Right-click + wheel": each drawn, a grey plus between
      var both = /^(.*?(?:click|drag|wheel|scroll))\s+\+\s+(.+)$/i.exec(String(label).trim());
      if (both) return '<span class="mbu-tip-kk">' + mbuTipKey(both[1]) + '<span class="mbu-tip-kx">+</span>' + mbuTipKey(both[2]) + '</span>';
      var m = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*)(left|right|middle|double)?[- ]?(click|drag|wheel|scroll)$/i.exec(String(label).trim());
      if (!m) return /^(?:(?:ctrl|alt|shift|cmd|meta)\s*\+\s*)+\S/i.test(label) ? mbuTipKbd(label) : '<span class="mbu-tip-k">' + mbuTipEsc(mbuTipCap(label)) + '</span>';
      var mods = m[1] ? m[1].split(/\s*[+-]\s*/).filter(Boolean) : [];
      var btn = (m[2] || '').toLowerCase(), act = m[3].toLowerCase();
      var wheel = btn === 'middle' || act === 'wheel' || act === 'scroll';
      // the wheel a filled strip down the middle, as bold as a filled button (a thin wheel vanished at 10px)
      var fill = wheel ? 'M4 1.4h4V7H4z' : btn === 'right' ? 'M6 1C8.8 1 11 3.2 11 6v1H6z' : 'M6 1C3.2 1 1 3.2 1 6v1h5z';
      var svg = '<svg class="mbu-tip-mouse" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">'
          + '<path d="' + fill + '" fill="currentColor"/>'
          + '<rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/>'
          + '<path d="M1 7h10' + (wheel ? '' : 'M6 1v6') + '" stroke="currentColor" stroke-width="1.1"/>'        + '</svg>';
      var extra = btn === 'double' ? '×2' : act === 'drag' ? 'drag' : (act === 'wheel' || act === 'scroll') ? '↕' : '';
      return '<span class="mbu-tip-kk"><span class="mbu-tip-sr">' + mbuTipEsc(mbuTipCap(label)) + '</span>'
          + (mods.length ? '<kbd class="mbu-tip-k mbu-tip-sym" aria-hidden="true">' + mods.map(mbuTipMod).join('+') + '</kbd>' : '')
          + svg + (extra ? '<span class="mbu-tip-kx" aria-hidden="true">' + extra + '</span>' : '') + '</span>';
  }
  function mbuTipText(src) {
      var raw = String(src == null ? '' : src).replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
      if (!raw) return '';
      var lines = [];
      // the shapes the old title texts took, read as the rows they mean:
      //   "… — click to open it"              → "…" + "Click: open it"
      //   "… (right-click: guess case all)"   → "…" + "Right-click: guess case all"
      //   "Ctrl-click", "Alt-click"           → "Ctrl+click", "Alt+click"
      raw = raw.replace(/\b(Ctrl|Alt|Shift|Cmd)-(click|drag)/gi, '$1+$2')
          .replace(/\s*\(((?:(?:right|middle|double|ctrl|alt|shift|cmd)[-+ ]?)+click|(?:ctrl|alt|shift|cmd)\+\w+):\s*([^()\n]+)\)(?=\s*(?:$|\n))/gim, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
          .replace(/\s+[—–-]\s+((?:(?:right|middle|double|ctrl|alt|shift)[-+ ]?)?click) to ([^\n·]+)/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
          .replace(/[.;]\s+((?:right|middle|double|ctrl|alt|shift)[-+ ]?click|click) to ([^\n·.]+)\.?(?=\s*(?:$|\n))/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; });
      raw.split('\n').forEach(function (line) {
          line = line.replace(/\s+$/, '');
          // ' · Label: ' starts a new line; so does '. Label: ' once the line itself opened with a label
          var parts = line.split(/\s+·\s+/), out = [parts[0]];
          for (var i = 1; i < parts.length; i++) {
              if (mbuTipLabel(parts[i])) out.push(parts[i]); else out[out.length - 1] += ' · ' + parts[i];
          }
          out.forEach(function (seg) {
              if (!mbuTipLabel(seg)) { lines.push(seg); return; }
              var bits = seg.split(/(?<=\.)\s+(?=[A-Z][\w+-]*(?:\s[\w+-]+)?:\s)/);
              bits.forEach(function (b) { lines.push(b); });
          });
      });
      // blocks: lead / paragraph / rows / bullets
      var blocks = [], rowRun = [];
      var flushRows = function () {
          if (!rowRun.length) return;
          var keyed = rowRun.filter(function (r) { return r.key; }).length;
          if (rowRun.length >= 2 || keyed || rowRun[0].dot) blocks.push({ t: 'rows', rows: rowRun });
          else blocks.push({ t: 'p', s: rowRun[0].line });
          rowRun = [];
      };
      lines.forEach(function (line, n) {
          if (!line.trim()) { flushRows(); return; }
          var b = /^\s*[-•]\s+(.*)$/.exec(line);
          if (b) {
              flushRows();
              var last = blocks[blocks.length - 1];
              if (last && last.t === 'ul') last.items.push(b[1]); else blocks.push({ t: 'ul', items: [b[1]] });
              return;
          }
          // a level row, "{#2f6fd6} Exact: …": a dot in the colour before the label; "{#… on}" marks the
          // chosen level, "{#… off}" dims one past it (a cutoff's table)
          var lv = /^\{(#[0-9a-f]{3,8})(?: (on|off))?\}\s*(\S[\s\S]*)$/i.exec(line);
          if (lv) {
              var ll = mbuTipLabel(lv[3]) || { label: lv[3], text: '' };
              rowRun.push({ label: ll.label, text: ll.text, dot: lv[1], st: lv[2] ? lv[2].toLowerCase() : '', line: line });
              return;
          }
          var l = mbuTipLabel(line);
          // the first line is a row only as a key or when a label follows: alone, "Release group: when…" is a sentence
          if (l && (l.key || blocks.length || rowRun.length || (lines[n + 1] && mbuTipLabel(lines[n + 1])))) { l.line = line; rowRun.push(l); return; }
          flushRows();
          blocks.push({ t: 'p', s: line });
      });
      flushRows();
      // one long paragraph: its first sentence becomes the lead
      if (blocks.length === 1 && blocks[0].t === 'p' && blocks[0].s.length > 110) {
          var m = /^(.{12,110}?[.!?])\s+(?=[A-Z(“"'])([\s\S]+)$/.exec(blocks[0].s);
          if (m) blocks = [{ t: 'p', s: m[1].replace(/\.$/, '') }, { t: 'p', s: m[2] }];
      }
      var lead = blocks.length > 1 && blocks[0].t === 'p';
      var rowsHtml = function (bl) {
          return bl.rows.map(function (r) {
              if (r.dot) {
                  var c = r.st ? ' mbu-tip-' + r.st : '';
                  return '<span class="mbu-tip-dl' + c + '"><i style="background:' + r.dot + '"></i>' + mbuTipEsc(mbuTipCap(r.label)) + '</span>'
                      + '<span class="mbu-tip-dt' + c + '">' + mbuTipInline(r.text) + '</span>';
              }
              return (r.key ? mbuTipKey(r.label) : '<span class="mbu-tip-o">' + mbuTipEsc(mbuTipCap(r.label)) + '</span>') + '<span>' + mbuTipInline(r.text) + '</span>';
          }).join('');
      };
      var html = function (bl, i, span) {
          var sp = span ? ' mbu-tip-span' : '';
          if (bl.t === 'ul') return '<ul class="mbu-tip-ul' + sp + '">' + bl.items.map(function (x) { return '<li>' + mbuTipInline(x) + '</li>'; }).join('') + '</ul>';
          if (bl.t === 'rows') return span ? rowsHtml(bl) : '<div class="mbu-tip-rows">' + rowsHtml(bl) + '</div>';
          var warn = /^⚠/.test(bl.s);
          return '<div class="' + (lead && i === 0 ? 'mbu-tip-lead' : 'mbu-tip-p') + (warn ? ' mbu-tip-warn' : '') + sp + '">' + mbuTipInline(bl.s) + '</div>';
      };
      // rows with a note between them stay one grid, the note under the row before it, so their labels line up
      var first = -1, last = -1;
      blocks.forEach(function (bl, i) { if (bl.t === 'rows') { if (first < 0) first = i; last = i; } });
      var out = '';
      for (var i = 0; i < blocks.length; i++) {
          if (i === first && last > first) {
              out += '<div class="mbu-tip-rows">';
              for (; i <= last; i++) out += html(blocks[i], i, true);
              out += '</div>';
              i = last;
          } else out += html(blocks[i], i, false);
      }
      return out;
  }
  function mbuTipCard(o) {
      o = o || {};
      var h = '';
      if (o.head || o.title || o.aside) {
          h += '<div class="mbu-tip-ch">' + (o.head || '') + (o.title ? '<b>' + mbuTipEsc(o.title) + '</b>' : '')
              + (o.aside ? '<span class="mbu-tip-ca">' + mbuTipEsc(o.aside) + '</span>' : '') + '</div>';
      }
      if (o.body) h += '<div class="mbu-tip-cb">' + o.body + '</div>';
      if (o.foot || o.footAside) h += '<div class="mbu-tip-cf"><span>' + (o.foot || '') + '</span>' + (o.footAside ? '<span>' + o.footAside + '</span>' : '') + '</div>';
      return h;
  }
  function mbuTipS() {
      return mbuTipS.s || (mbuTipS.s = {
          me: Math.random().toString(36).slice(2, 10), lead: false, els: typeof WeakMap === 'function' ? new WeakMap() : null, prov: [],
          cur: null, curOpts: null, pend: null, showT: 0, hideT: 0, liveT: 0, warm: 0, quiet: null, tab: false, mx: -1, my: -1, obs: null,
      });
  }
  function mbuTip(el, content, opts) {
      if (!el) return el;
      var _mbuTip = mbuTipS();
      mbuTipStart();
      opts = opts || {};
      if (typeof content === 'function') {
          if (_mbuTip.els) _mbuTip.els.set(el, { fn: content, opts: opts });
          el.setAttribute('data-mbu-tip-own', '');
          el.removeAttribute('title');
          return el;
      }
      if (content == null || content === '') el.removeAttribute('data-tip'); else el.setAttribute('data-tip', String(content));
      if (opts.place) el.setAttribute('data-tip-place', opts.place);
      if (opts.wide) el.setAttribute('data-tip-wide', '');
      el.removeAttribute('title');
      if (_mbuTip.cur === el) mbuTipRender();
      return el;
  }
  function mbuTipOn(selector, fn, opts) {
      mbuTipS().prov.push({ sel: selector, fn: fn, opts: opts || {} });
      mbuTipStart();
  }
  function mbuTipShowFor(el, content, opts) {
      if (!el || content == null || content === '') { mbuTipHide(true); return; }
      mbuTipStart();
      var o = opts || {};
      var fn = typeof content === 'function' ? content : function () { return content; };
      var S = mbuTipS();
      if (S.cur === el) { S.curOpts.fn = fn; if (!mbuTipRender()) mbuTipHide(true); return; }
      mbuTipShow({ el: el, fn: fn, opts: o });
  }
  function mbuTipHtml(s) {
      if (mbuTipHtml.tt === undefined) {
          mbuTipHtml.tt = null;
          try {
              var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
              if (tt && tt.createPolicy) mbuTipHtml.tt = tt.createPolicy('mbu-tip-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
          } catch (e) { /* the page allows no new policy: plain strings */ }
      }
      return mbuTipHtml.tt ? mbuTipHtml.tt.createHTML(String(s)) : String(s);
  }
  function mbuTipCss() {
      var s = document.getElementById('mbu-tip-css');
      if (s && +s.getAttribute('data-v') >= mbuTipV()) return;
      if (!s) { s = document.createElement('style'); s.id = 'mbu-tip-css'; (document.head || document.documentElement).appendChild(s); }
      s.setAttribute('data-v', String(mbuTipV()));
      s.textContent = mbuTipCssText();
  }
  function mbuTipEl() {
      var t = document.getElementById('mbu-tip');
      if (!t) {
          t = document.createElement('div');
          t.id = 'mbu-tip';
          t.setAttribute('role', 'tooltip');
      }
      // Falcon's panel, Group Therapy's menus and others sit at the top z-index too; at an equal one
      // the later element is drawn over, so the tip moves to the end of the page when it is not there
      // (majkinetor, with a screenshot: Falcon's panel over a tip). It hangs on <html>, not <body>:
      // Event Horizon isolates <body>, which kept a tip there under the dock's icons (#847)
      var host = document.documentElement;
      if (t.parentNode !== host || host.lastElementChild !== t) host.appendChild(t);
      return t;
  }
  function mbuTipFind(node) {
      var _mbuTip = mbuTipS();
      var tip = document.getElementById('mbu-tip');
      for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
          if (el === tip) return null;
          var reg = _mbuTip.els && _mbuTip.els.get(el);
          if (reg) return { el: el, fn: reg.fn, opts: reg.opts };
          for (var i = 0; i < _mbuTip.prov.length; i++) {
              var p = _mbuTip.prov[i];
              try { if (el.matches(p.sel)) return { el: el, fn: p.fn, opts: p.opts }; } catch (e) { /* a bad selector matches nothing */ }
          }
          if (!_mbuTip.lead) continue;
          if (el.hasAttribute('data-mbu-tip-own')) return null;   // another copy's rich tip
          if (el.hasAttribute('data-tip')) return { el: el, opts: { place: el.getAttribute('data-tip-place'), wide: el.hasAttribute('data-tip-wide') } };
          // an <option> keeps its title: the browser draws a dropdown's list, where no page tooltip reaches
          if (el.hasAttribute('title') && el.getAttribute('title') && el.namespaceURI === 'http://www.w3.org/1999/xhtml' && !/^(OPTION|OPTGROUP)$/.test(el.tagName)) {
              var root = null;
              try { root = el.closest(mbuTipRoots()); } catch (e) { /* no roots */ }
              if (root) {
                  el.setAttribute('data-tip', el.getAttribute('title'));
                  el.removeAttribute('title');
                  return { el: el, opts: {} };
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
          try { c = o.fn(a); } catch (e) { c = null; }
          if (c == null || c === '') return false;
          if (typeof c === 'string') t.innerHTML = mbuTipHtml(c);
          else { t.textContent = ''; t.appendChild(c); }
      } else {
          var s = a.getAttribute('data-tip');
          if (!s) return false;
          var h = mbuTipText(s);
          t.innerHTML = mbuTipHtml(h);
          // an element with nothing to read of its own is named by its tip
          if (!a.getAttribute('aria-label') && !/[\p{L}\p{N}]/u.test(a.textContent || '') && !a.querySelector('img[alt]:not([alt=""])')) {
              a.setAttribute('aria-label', s.split('\n')[0]);
          }
      }
      // a render of the open tip (its text changed) keeps it shown
      var on = t.classList.contains('mbu-tip-on') && t.getAttribute('data-owner') === _mbuTip.me;
      t.className = 'mbu-ui' + (o.card ? ' mbu-tip-card' : '') + (o.interactive ? ' mbu-tip-act' : '') + (o.wide ? ' mbu-tip-wide' : '') + (on ? ' mbu-tip-on' : '');
      t.setAttribute('data-owner', _mbuTip.me);
      mbuTipPlace(t, a, o.place);
      return true;
  }
  function mbuTipPlace(t, a, place) {
      var _mbuTip = mbuTipS();
      var r = a.getBoundingClientRect();
      if (!r.width && !r.height && a.firstElementChild) r = a.firstElementChild.getBoundingClientRect();
      t.style.left = '0px'; t.style.top = '0px';
      var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, gap = 8, m = 6;
      var below = place !== 'above';
      if (below && r.bottom + gap + h > vh - m && r.top - gap - h >= m) below = false;
      else if (!below && r.top - gap - h < m && r.bottom + gap + h <= vh - m) below = true;
      var top = below ? r.bottom + gap : r.top - gap - h;
      // a wide element (a row, a long field): the arrow points where the pointer is
      var cx = r.left + r.width / 2;
      if (r.width > 220 && _mbuTip.mx >= r.left && _mbuTip.mx <= r.right) cx = _mbuTip.mx;
      var left = Math.max(m, Math.min(vw - w - m, Math.round(cx - w / 2)));
      t.style.left = left + 'px';
      t.style.top = Math.max(m, Math.round(top)) + 'px';
      t.style.setProperty('--mbu-tip-ax', Math.max(12, Math.min(w - 12, Math.round(cx - left))) + 'px');
      t.classList.toggle('mbu-tip-up', !below);
  }
  function mbuTipShow(found) {
      var _mbuTip = mbuTipS();
      clearTimeout(_mbuTip.hideT); clearTimeout(_mbuTip.showT);
      if (_mbuTip.cur && _mbuTip.cur !== found.el) mbuTipHide(true);
      mbuTipCss();
      _mbuTip.cur = found.el;
      _mbuTip.curOpts = { fn: found.fn, interactive: !!found.opts.interactive, card: !!found.opts.card, wide: !!found.opts.wide, place: found.opts.place };
      if (!mbuTipRender()) { _mbuTip.cur = null; return; }
      var t = mbuTipEl();
      found.el.setAttribute('aria-describedby', 'mbu-tip');
      // next frame, so the transition runs from the hidden state
      requestAnimationFrame(function () { if (_mbuTip.cur === found.el) t.classList.add('mbu-tip-on'); });
      // the element can go (a re-render) or change its text while the tip is up
      clearInterval(_mbuTip.liveT);
      _mbuTip.liveT = setInterval(function () { if (!_mbuTip.cur || !_mbuTip.cur.isConnected) mbuTipHide(true); }, 300);
      try {
          if (!_mbuTip.obs) _mbuTip.obs = new MutationObserver(function (ms) {
              // a repaint that sets the same text again changes nothing
              if (!_mbuTip.cur || ms.every(function (m) { return m.oldValue === _mbuTip.cur.getAttribute('data-tip'); })) return;
              if (!mbuTipRender()) mbuTipHide(true);
          });
          _mbuTip.obs.disconnect();
          if (!found.fn) _mbuTip.obs.observe(found.el, { attributes: true, attributeOldValue: true, attributeFilter: ['data-tip'] });
      } catch (e) { /* no observer: the text is read again on the next hover */ }
  }
  function mbuTipHide(now) {
      var _mbuTip = mbuTipS();
      clearTimeout(_mbuTip.showT); clearTimeout(_mbuTip.hideT);
      _mbuTip.pend = null;
      var hide = function () {
          var a = _mbuTip.cur;
          if (!a) return;
          _mbuTip.cur = null;
          clearInterval(_mbuTip.liveT);
          try { if (_mbuTip.obs) _mbuTip.obs.disconnect(); } catch (e) { /* gone */ }
          if (a.getAttribute('aria-describedby') === 'mbu-tip') a.removeAttribute('aria-describedby');
          var t = document.getElementById('mbu-tip');
          if (t && t.getAttribute('data-owner') === _mbuTip.me) t.classList.remove('mbu-tip-on');
          _mbuTip.warm = Date.now();
      };
      if (now) hide();
      else _mbuTip.hideT = setTimeout(hide, _mbuTip.curOpts && _mbuTip.curOpts.interactive ? 220 : 70);
  }
  function mbuTipStart() {
      if (mbuTipStart.done || typeof document === 'undefined') return;
      var _mbuTip = mbuTipS();
      var root = document.documentElement;
      if (!root) { document.addEventListener('DOMContentLoaded', mbuTipStart, { once: true }); return; }
      mbuTipStart.done = true;
      if (!root.hasAttribute('data-mbu-tip')) { root.setAttribute('data-mbu-tip', _mbuTip.me); _mbuTip.lead = true; }
      var inTip = function (n) { var t = document.getElementById('mbu-tip'); return !!(t && n && t.contains(n)); };
      window.addEventListener('mousemove', function (e) { _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; }, { passive: true, capture: true });
      window.addEventListener('mouseover', function (e) {
          _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; _mbuTip.over = e.target;   // :hover can read false in a page that has not seen a real move
          if (inTip(e.target)) { if (_mbuTip.cur) clearTimeout(_mbuTip.hideT); return; }
          var f = mbuTipFind(e.target);
          if (!f) { if (_mbuTip.cur && !_mbuTip.cur.contains(e.target)) mbuTipHide(); return; }
          if (f.el === _mbuTip.cur) { clearTimeout(_mbuTip.hideT); return; }
          if (f.el === _mbuTip.quiet || (_mbuTip.pend && _mbuTip.pend.el === f.el)) return;
          clearTimeout(_mbuTip.showT);
          _mbuTip.pend = f;
          var warm = _mbuTip.cur || Date.now() - _mbuTip.warm < 450;
          _mbuTip.showT = setTimeout(function () {
              _mbuTip.pend = null;
              if (f.el.isConnected && f.el.contains(_mbuTip.over)) mbuTipShow(f);
          }, warm ? 40 : (f.opts.delay != null ? f.opts.delay : 350));
      }, true);
      window.addEventListener('mouseout', function (e) {
          var to = e.relatedTarget;
          var q = _mbuTip.quiet;
          if (q && q.contains(e.target) && !(to && q.contains(to))) _mbuTip.quiet = null;
          var p = _mbuTip.pend;
          if (p && p.el.contains(e.target) && !(to && p.el.contains(to))) { clearTimeout(_mbuTip.showT); _mbuTip.pend = null; }
          var a = _mbuTip.cur;
          if (!a) return;
          if (to && (a.contains(to) || (_mbuTip.curOpts.interactive && inTip(to)))) return;
          if (a.contains(e.target) || inTip(e.target)) mbuTipHide();
      }, true);
      window.addEventListener('mousedown', function (e) {
          if (inTip(e.target)) return;
          clearTimeout(_mbuTip.showT); _mbuTip.pend = null;
          var f = mbuTipFind(e.target);
          _mbuTip.quiet = f ? f.el : null;   // no tip again on the element just clicked until the pointer leaves it
          _mbuTip.tab = false;
          if (_mbuTip.cur) mbuTipHide(true);
      }, true);
      document.addEventListener('keydown', function (e) {
          if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) _mbuTip.tab = e.key === 'Tab';
          if (!_mbuTip.cur) return;
          var interactive = _mbuTip.curOpts && _mbuTip.curOpts.interactive;
          // typing closes a plain tip, as it does the browser's; modifiers alone don't
          if (e.key !== 'Escape') { if (!interactive && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) mbuTipHide(true); return; }
          mbuTipHide(true);
          if (interactive) e.stopPropagation();   // a card is a popover: Esc closes it and nothing else
      }, true);
      // only a scroll that moves the element: a panel repainting elsewhere leaves the tip where it is
      window.addEventListener('scroll', function (e) { if (_mbuTip.cur && !inTip(e.target) && e.target.contains(_mbuTip.cur)) mbuTipHide(true); }, true);
      window.addEventListener('blur', function () { if (_mbuTip.cur) mbuTipHide(true); });
      document.addEventListener('focusin', function (e) {
          var el = e.target, vis = false;
          try { vis = el.matches(':focus-visible'); } catch (x) { /* old browser */ }
          // a text box is :focus-visible even when a script focuses it (a picker opening), so only Tab's focus shows the tip
          if (!vis || !_mbuTip.tab) return;
          var f = mbuTipFind(el);
          if (f && f.el === el) { clearTimeout(_mbuTip.showT); _mbuTip.showT = setTimeout(function () { if (document.activeElement === el) mbuTipShow(f); }, 150); }
      }, true);
      document.addEventListener('focusout', function (e) {
          if (_mbuTip.cur && _mbuTip.cur === e.target && !(e.relatedTarget && inTip(e.relatedTarget))) mbuTipHide();
      }, true);
  }
  mbuTipStart();
  // </ST-UI>

  // <ST-ICONS> — generated by dev/ui/sync-icons.mjs from dev/ui/platform-icons.mjs — DO NOT EDIT
  const ST_ICONS = {"musicbrainz":{"color":"#eb743b","svg":"<svg viewBox=\"0.75 0.75 28.5 28.5\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(1.5)\"><path d=\"m13 1-12 7v14l12 7z\" fill=\"#ba478f\"/><path d=\"m14 1 12 7v14l-12 7z\" fill=\"#eb743b\"/></g></svg>"},"discogs":{"color":"#333333","svg":"<svg viewBox=\"71 71 882 882\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(512 512) scale(0.86) translate(-512 -512)\"><circle cx=\"512\" cy=\"512\" r=\"496\" fill=\"#333\" stroke=\"#9a9a9a\" stroke-width=\"32\"/><path fill=\"#fff\" d=\"M439.84 511.58A72.58 72.58 0 0 1 512.41 439 72.54 72.54 0 0 1 585 511.58a72.56 72.56 0 0 1-72.57 72.56 72.56 72.56 0 0 1-72.57-72.56zm3.18 0A69.48 69.48 0 0 0 512.41 581a69.4 69.4 0 0 0 69.4-69.38 69.49 69.49 0 0 0-69.4-69.43A69.44 69.44 0 0 0 443 511.58zm69.42-11.44a11.43 11.43 0 1 0 11.47 11.45 11.45 11.45 0 0 0-11.48-11.45zm-131.08 11.43a130.68 130.68 0 0 0 40.3 94.43l24.68-26.69.33.3a94.59 94.59 0 0 1 113.08-149.95l17.51-31.95a130.23 130.23 0 0 0-64.82-17.22c-72.27.01-131.08 58.81-131.08 131.08zm225.73 0a94.6 94.6 0 0 1-138.64 83.79l-17.83 31.74a130.26 130.26 0 0 0 61.82 15.53c72.28 0 131.08-58.8 131.08-131.08a130.63 130.63 0 0 0-37.73-91.9L581 446.39a94.3 94.3 0 0 1 26.1 65.2zm-267.34 0a172.17 172.17 0 0 0 53.68 125l25-27.07a135.38 135.38 0 0 1-41.82-97.89c0-74.88 60.92-135.8 135.8-135.8a134.92 134.92 0 0 1 67.08 17.8l17.73-32.34a171.57 171.57 0 0 0-84.81-22.35c-95.19-.03-172.66 77.43-172.66 172.65zm308.49 0c0 74.88-60.92 135.8-135.8 135.8a135 135 0 0 1-64.14-16.14l-18.07 32.17a171.62 171.62 0 0 0 82.21 20.86c95.22 0 172.69-77.47 172.69-172.69a172.15 172.15 0 0 0-51-122.4l-25.12 27a135.35 135.35 0 0 1 39.23 95.4zm41.61 0c0 97.83-79.58 177.43-177.41 177.43a176.32 176.32 0 0 1-84.52-21.46l-18.18 32.36a213.21 213.21 0 0 0 102.7 26.23C630.74 726.11 727 629.87 727 511.57a213.87 213.87 0 0 0-64.38-153l-25.26 27.18a176.85 176.85 0 0 1 52.49 125.82zm-392 0A213.9 213.9 0 0 0 365 667.24L390.23 640A176.88 176.88 0 0 1 335 511.57c0-97.82 79.59-177.41 177.41-177.41a176.26 176.26 0 0 1 87.08 22.93l17.84-32.55A213.14 213.14 0 0 0 512.44 297c-118.3 0-214.54 96.28-214.54 214.57zm392.55-183-24.64 26.49a218.57 218.57 0 0 1 65.94 156.51c0 120.9-98.36 219.26-219.26 219.26a217.9 217.9 0 0 1-105-26.84l-18.24 32.47A255.43 255.43 0 0 0 512 768c141.39 0 256-114.64 256-256a255.23 255.23 0 0 0-77.55-183.41zm-397.27 183c0-120.9 98.36-219.26 219.26-219.26a217.84 217.84 0 0 1 107.19 28.09L637 288.65A254.46 254.46 0 0 0 516.12 256H512c-140.54.22-254.42 113.26-256 253.5v2.5a255.69 255.69 0 0 0 80.51 186.08l25.31-27.36a218.61 218.61 0 0 1-68.64-159.15z\"/></g></svg>"},"spotify":{"color":"#1DB954","svg":"<svg viewBox=\"1.25 1.375 21.25 21.25\" fill=\"#1DB954\"><path transform=\"translate(12 12) scale(.875) translate(-12 -12)\" d=\"M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z\"/></svg>"},"apple":{"color":"#FA243C","svg":"<svg viewBox=\"1.625 1.25 20 20\" fill=\"#FA243C\"><path d=\"M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.73 3.01-.44 7.47 1.24 9.92.82 1.2 1.8 2.54 3.08 2.49 1.24-.05 1.71-.8 3.21-.8 1.5 0 1.92.8 3.23.77 1.33-.02 2.18-1.22 3-2.42.94-1.39 1.33-2.73 1.35-2.8-.03-.01-2.59-.99-2.62-3.93zM14.6 4.59c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38z\"/></svg>"},"deezer":{"color":"#A238FF","svg":"<svg viewBox=\"3 3 18 18\"><path transform=\"translate(12 12) scale(.74) translate(-12 -12)\" d=\"M4 2h6v2h-6zM14 2h6v2h-6zM2 4h20v2h-20zM0 6h24v2h-24zM0 8h24v2h-24zM0 10h24v2h-24zM2 12h20v2h-20zM4 14h16v2h-16zM6 16h12v2h-12zM8 18h8v2h-8zM10 20h4v2h-4z\" fill=\"#A238FF\"/></svg>"},"tidal":{"color":"#000000","svg":"<svg viewBox=\"3 3 18 18\"><path d=\"M6 6l3 3-3 3-3-3zM12 6l3 3-3 3-3-3zM18 6l3 3-3 3-3-3zM12 12l3 3-3 3-3-3z\" style=\"fill:var(--mbu-text,currentColor)\"/></svg>"},"qobuz":{"color":"#0070ef","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#0070ef\"/><circle cx=\"12\" cy=\"12\" r=\"5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.2\"/><path d=\"M14.5 14.5 19 19\" stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>"},"beatport":{"color":"#01FF95","svg":"<svg viewBox=\"0.75 0.75 22.5 22.5\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"#000\"/><g transform=\"translate(12 12) scale(0.84) translate(-12 -12)\" fill=\"none\" stroke=\"#01FF95\" stroke-width=\"2.5\"><path d=\"M10.9 3V8.3c0 1.2-.4 1.9-1.1 2.6L5.6 15.1\"/><circle cx=\"13.9\" cy=\"15.8\" r=\"4.05\" stroke-width=\"2.35\"/></g></svg>"},"bandcamp":{"color":"#629AA9","svg":"<svg viewBox=\"2.25 2.25 19.5 19.5\" fill=\"#629AA9\"><path transform=\"translate(12 12) scale(.8) translate(-12 -12)\" d=\"M0 18.75l7.437-13.5H24l-7.438 13.5z\"/></svg>"},"volumo":{"color":"#7c4dff","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#7c4dff\"/><path d=\"M7 8h2.2l2.8 6 2.8-6H17l-4 9h-2z\" fill=\"#fff\"/></svg>"},"presto":{"color":"#1f3a5f","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#1f3a5f\"/><path d=\"M8.5 6.5h4.1c2.2 0 3.7 1.4 3.7 3.4s-1.5 3.4-3.7 3.4h-2.2v4.2H8.5zm1.9 1.7v3.4h2c1.1 0 1.9-.7 1.9-1.7s-.8-1.7-1.9-1.7z\" fill=\"#fff\"/></svg>"},"hdtracks":{"color":"#e63329","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#e63329\"/><path d=\"M5 7.5h1.7v3.1h2.6V7.5H11v8H9.3v-3.2H6.7v3.2H5zm7.2 0h2.9c2 0 3.4 1.6 3.4 4s-1.4 4-3.4 4h-2.9zm1.7 1.5v5h1.1c1.1 0 1.8-1 1.8-2.5s-.7-2.5-1.8-2.5z\" fill=\"#fff\"/></svg>"},"soundcloud":{"color":"#FF5500","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FF5500\" d=\"M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z\"/></svg>"},"audiomack":{"color":"#FFA200","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FFA200\" d=\"M.331 11.378s.5418-.089.765.1439c.2234.2332.077.7156-.2195.7237-.2965.01-.5705.063-.765-.1439-.1946-.2066-.1424-.6218.2195-.7237m5.881 3.2925c-.0522.01-.1075-.018-.164-.059-.3884-.5413-.5287-2.3923-.707-2.5025-.185-.1144-.8545 1.0255-2.1862.903-.5569-.051-1.1236-.4121-1.4573-.662.031-.4206.0364-1.4027.8659-1.0833.5038.1939 1.3667.7266 2.1245-.23.8378-1.0579 1.2999-.7506 1.577-.5206.2771.23.0925 1.4259.5058 1.0916.4133-.3343 2.082-2.4103 2.082-2.4103s1.292-1.303 1.4898.067c.1979 1.3698 1.0403 2.8877 1.2635 2.8445.2234-.043 2.8223-5.3253 3.1945-5.666.3722-.3409 1.6252-.2961 1.5657.5781-.0596.8742-.1871 6.308-.1871 6.308s-.147 1.5311.0924.7128c.0992-.3392.206-.6453.3392-1.0024.6414-2.0534 1.734-5.5613 2.2784-7.3688.1252-.4325.233-.8037.3166-1.0891l.0001-.0008a3.5925 3.5925 0 0 1 .0973-.3305c.0455-.1532.0763-.2546.0858-.2813.0243-.068.0925-.1192.1884-.157.0962-.061.1995-.064.3165-.067.3021-.027.6907.012 1.0401.1119.1018 0 .2125.037.3172.1118v.0001s.0063 0 .0151.01c.0023 0 .0048 0 .0073.01.0219.015.0573.045.0983.095.0012 0 .0025 0 .004.01.017.021.0341.045.0515.073.1952.2863.315.814.1948 1.7498-.2996 2.3354-.5316 7.1397-.5316 7.1397s-.0461.2298.4353-.782c.0167-.035.0383-.066.058-.098.026-.017.0552-.042.0913-.085.2974-.3546 1.0968-.5629 1.6512-.5586.2336.028.4293.087.5462.1609.2188.333.0897 1.562.0897 1.562-.4612.043-1.3403.2908-1.6519.3366-.3118.046-.7852 2.0699-1.4433 1.8629-.6581-.2069-2.1246-1.1268-2.1246-1.2533 0-.1102.1152-1.4546.1453-1.8016.0022-.024.004-.046.0058-.068a.152.152 0 0 1 .0014-.014l-.0002.0003c.0213-.2733.0023-.3927-.1239-.1199-.1086.2346-.581 1.7359-1.1078 3.3709-.0556.1429-1.0511 3.1558-1.1818 3.5231-.156.4261-.287.7523-.3776.921-.1378.1867-.3234.3036-.5826.2252-.6465-.1954-1.4654-1.0889-1.473-1.3106-.0155-1.2503.0608-7.973-.2423-7.4127-.311.5744-2.73 4.5608-2.73 4.5608-.0405.01-.0705.01-.1062.01-.1712-.019-.4366-.074-.51-.2384-.004-.01-.0094-.018-.0129-.028-.0035-.01-.0075-.022-.0135-.04-.0329-.1097-.0463-.2289-.0753-.3265-.1082-.3652-.2813-.8886-.463-1.421-.2784-.9079-.5654-1.8366-.6127-1.9391-.0923-.2007-.2268-.116-.3475-.0002-.54.458-1.6868 2.4793-2.7225 2.5898\"/></svg>"},"sevendigital":{"color":"#07606E","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#07606E\"/><path d=\"M7.8 6.8h8.4v1.9l-4.5 8.9H9.4l4.4-8.7h-6z\" fill=\"#fff\"/></svg>"},"melon":{"color":"#00CD3C","svg":"<svg viewBox=\"63 52 175 175\"><circle cx=\"138\" cy=\"162\" r=\"46.5\" fill=\"none\" stroke=\"#00CD3C\" stroke-width=\"37\"/><circle cx=\"202\" cy=\"78\" r=\"26\" fill=\"#00CD3C\"/></svg>"},"bugs":{"color":"#FF3D2E","svg":"<svg viewBox=\"0 0 256 256\"><defs><linearGradient id=\"bugs-g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#C2009E\"/><stop offset=\".45\" stop-color=\"#FF3A48\"/><stop offset=\".75\" stop-color=\"#FFAA00\"/><stop offset=\"1\" stop-color=\"#FFC94A\"/></linearGradient></defs><rect width=\"256\" height=\"256\" rx=\"30\" fill=\"url(#bugs-g)\"/><path fill=\"#fff\" fill-rule=\"evenodd\" d=\"M77 54H118C152 54 170 72 170 100C170 114 163 124 152 128C170 134 180 148 180 168C180 190 165 199 140 200L113 202L91 106C89 94 84 70 77 54ZM118 87L124 115H132C140 115 144 110 143 101C142 92 136 88 128 87ZM128 141L136 177H145C153 177 157 171 156 162C155 150 148 141 138 141Z\"/></svg>"},"allmusic":{"color":"#27aae1","svg":"<svg viewBox=\"-52.87 0 482.77 482.77\"><g transform=\"translate(-118.18 -150.37)\"><path d=\"M432.47,627.54,310.78,352.16a14.57,14.57,0,1,0-7.81.09L178.83,633.14h67.38l14-40.1h92.41l14.32,40.1h67.65ZM276.91,543.85l30-82,29.31,82Z\" style=\"fill:var(--mbu-text,#131313)\"/><path d=\"M403.28,338.88a96.59,96.59,0,1,0-159.89,72.86l11.51-26.33A69.71,69.71,0,1,1,358.83,385l11.61,26.35A96.55,96.55,0,0,0,403.28,338.88Z\" fill=\"#27aae1\"/><path d=\"M466,439.64a187.71,187.71,0,0,0,29.24-100.76c0-103.95-84.57-188.51-188.52-188.51S118.18,234.93,118.18,338.88a187.67,187.67,0,0,0,29.7,101.48A189.56,189.56,0,0,0,205.69,498l13.08-29.92c-42.16-28.9-68.42-77.44-68.42-129.170c0-86.21,70.13-156.34,156.34-156.34s156.36,70.13,156.36,156.34a155.39,155.39,0,0,1-67.8,128.8l13.13,29.83A189.6,189.6,0,0,0,466,439.64Z\" fill=\"#27aae1\"/></g></svg>"},"mora":{"color":"#0a7fd3","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#0a7fd3\"/><path d=\"M6.8 16V10.2M6.8 11.6c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6V16M10.4 11.6c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6V16\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.6\" stroke-linecap=\"round\" transform=\"translate(1.6 0)\"/></svg>"},"ytmusic":{"color":"#FF0000","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FF0000\" d=\"M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z\"/></svg>"},"amazonmusic":{"color":"#25D1DA","svg":"<svg viewBox=\"2 2 20 20\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#25D1DA\"/><path d=\"M5.8 11.2c3.5 3.2 8.9 3.5 12.4.9\" fill=\"none\" stroke=\"#0F1111\" stroke-width=\"1.9\" stroke-linecap=\"round\"/><path d=\"M15.5 10.7l3 1.3-.9 3.1\" fill=\"none\" stroke=\"#0F1111\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},"amazon":{"color":"#FF6600","svg":"<svg viewBox=\"2 2 20 20\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4.5\" fill=\"#FF6600\"/><path d=\"M5.6 11.6c3.9 2.6 9 2.7 12.4.4\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><path d=\"M15.6 10.9l2.6 1-.6 2.6\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},"soundexchange":{"color":"#6f42c1","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#6f42c1\"/><path d=\"M6.5 12h1.3l1-3 1.6 6 1.6-9 1.6 12 1.4-6h1.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/></svg>"},"wikidata":{"color":"#339966","svg":"<svg viewBox=\"120 -110 810 810\"><path d=\"M120 45h30v500h-30zM180 45h90v500h-90zM300 45h90v500h-90z\" fill=\"#990000\"/><path d=\"M420 45h30v500h-30zM480 45h30v500h-30zM840 45h30v500h-30zM900 45h30v500h-30z\" fill=\"#339966\"/><path d=\"M540 45h90v500h-90zM660 45h30v500h-30zM720 45h90v500h-90z\" fill=\"#006699\"/></svg>"},"wikipedia":{"color":"#000000","svg":"<svg viewBox=\"0 0 24 24\"><g fill=\"none\" stroke-linecap=\"butt\" style=\"stroke:var(--mbu-text,currentColor)\"><path d=\"M2.6 5.5 7 18.8M10.3 5.5 14.7 18.8\" stroke-width=\"2.1\"/><path d=\"M7 18.8 11.4 7.2M14.7 18.8 21.2 5.5\" stroke-width=\"1\"/><path d=\"M.8 5.5h4.4M8.6 5.5h3.8M18.9 5.5h4.3\" stroke-width=\"1\"/></g></svg>"},"rateyourmusic":{"color":"#2383C6","svg":"<svg viewBox=\"0 0 143 143\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M85.7921 43.0106C96.6509 47.3959 115.863 46.7695 127.766 45.7254C117.951 24.2165 96.2333 9.18123 71.1744 9.18123C59.0627 9.18123 47.995 12.5224 38.3892 18.5783C59.2715 8.76358 69.295 36.1195 85.7921 43.0106Z\" fill=\"#E6E4E5\"/><path d=\"M142.174 71.4106C142.174 110.669 110.433 142.411 71.1738 142.411C31.915 142.411 0.173828 110.669 0.173828 71.4106C0.173828 32.1518 31.915 0.410645 71.1738 0.410645C110.433 0.410645 142.174 32.3606 142.174 71.4106Z\" fill=\"#E6E4E5\"/><path d=\"M107.717 67.8609C117.323 68.4874 126.093 65.9815 132.776 63.058C131.94 56.7933 130.27 50.9463 127.764 45.5169C115.861 46.561 96.6492 47.1874 85.7904 42.8021C69.2934 35.911 58.4346 8.13754 38.3875 18.3699C20.6375 29.4375 8.94341 48.858 8.94341 71.4109C8.94341 77.258 9.77868 82.8962 11.2404 88.1168C21.0551 79.3462 41.7287 62.8492 60.314 57.8374C85.3728 51.1551 87.0434 66.608 107.717 67.8609Z\" fill=\"url(#rym-g0)\"/><path d=\"M132.777 63.2667C126.095 66.1902 117.324 68.4872 107.718 68.0696C87.0447 66.8167 85.3742 51.1549 60.1065 58.0461C41.73 63.0579 21.0565 79.7637 11.033 88.3255C13.1212 95.4255 16.2536 102.108 20.6389 108.164C27.3212 102.525 35.4653 97.3049 44.4447 95.4255C70.13 89.996 70.13 108.372 91.8477 105.867C103.751 104.405 120.039 92.9196 132.359 82.8961C132.986 79.3461 133.404 75.5873 133.404 71.8284C133.404 68.6961 133.195 65.9814 132.777 63.2667Z\" fill=\"url(#rym-g1)\"/><path d=\"M44.4443 95.2164C35.4649 97.0958 27.3208 102.316 20.6384 107.955C31.9149 123.616 50.2913 133.849 71.1737 133.849C101.871 133.849 127.138 111.713 132.359 82.687C120.038 92.7106 103.75 104.196 91.8472 105.658C70.1296 108.163 70.1296 89.5782 44.4443 95.2164Z\" fill=\"url(#rym-g2)\"/><path d=\"M97.2771 83.1047C99.783 89.3694 97.4859 96.2606 91.6389 98.7665C86.0007 101.064 79.3184 97.9311 76.6037 91.8752C74.0978 85.6105 76.3948 78.7194 82.2419 76.2135C88.0889 73.7076 94.7712 76.84 97.2771 83.1047Z\" fill=\"url(#rym-g3)\"/><defs><linearGradient id=\"rym-g0\" x1=\"70.8335\" y1=\"57.9435\" x2=\"70.8335\" y2=\"17.9123\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#88C6EB\"/><stop offset=\"1\" stop-color=\"#2392CC\"/></linearGradient><linearGradient id=\"rym-g1\" x1=\"76.8285\" y1=\"109.069\" x2=\"70.589\" y2=\"66.1666\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#2383C6\"/><stop offset=\"1\" stop-color=\"#33519F\"/></linearGradient><linearGradient id=\"rym-g2\" x1=\"76.5127\" y1=\"128.007\" x2=\"76.5127\" y2=\"94.94\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#1E4999\"/><stop offset=\"1\" stop-color=\"#1B3B6C\"/></linearGradient><linearGradient id=\"rym-g3\" x1=\"88.7722\" y1=\"102.59\" x2=\"85.7469\" y2=\"75.5277\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#1E4999\"/><stop offset=\"1\" stop-color=\"#1B3B6C\"/></linearGradient></defs></svg>"},"review":{"color":"#555555","svg":"<svg viewBox=\"1 1 22 22\"><path d=\"M3 3h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H10l-5 5v-5H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z\" style=\"fill:var(--mbu-text,currentColor)\"/><path d=\"M6 7.5h12M6 10.5h12M6 13.5h8\" stroke=\"var(--mbu-bg,#fff)\" stroke-width=\"1.5\" stroke-linecap=\"round\" style=\"stroke:var(--mbu-bg,#fff)\"/></svg>"},"twitter":{"color":"#000000","svg":"<svg viewBox=\"458.78 184.6 852 852\"><path transform=\"translate(52.39 -25.06)\" d=\"M485.39 356.79l230.07 307.62L483.94 914.52h52.11l202.7-218.98 163.77 218.98h177.32L836.82 589.6l215.5-232.81h-52.11L813.54 558.46 662.71 356.79zM562.02 395.17h81.46l359.72 480.97h-81.46z\" fill-rule=\"evenodd\" style=\"fill:var(--mbu-text,currentColor)\"/></svg>"},"facebook":{"color":"#0866FF","svg":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#0866FF\"/><path d=\"M15.12 7.6h-1.7c-.9 0-1.12.43-1.12 1.1V10h2.8l-.4 2.85h-2.4v11.1a12 12 0 0 1-3 0v-11.1H7.2V10h2.1V8.3c0-2.45 1.5-3.8 3.7-3.8.9 0 1.7.07 2.12.12z\" fill=\"#fff\"/></svg>"},"lastfm":{"color":"#D51007","svg":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#D51007\"/><path transform=\"translate(4.2 4.2) scale(.65)\" fill=\"#fff\" d=\"M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.630-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.930-1.457-4.590-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.890 0 12.233c0 4.180 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z\"/></svg>"},"secondhandsongs":{"color":"#0F9DAB","svg":"<svg viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"4\" fill=\"#0F9DAB\"/><path d=\"M12.4 4.6L6.6 9.3C9 11.2 10.5 11.5 12.3 11.9C14.5 12.4 16 12.6 18.4 13.9L12.6 18.2\" fill=\"none\" stroke=\"#fff\" stroke-width=\"5.4\" stroke-linejoin=\"round\"/><path d=\"M11.4 5.4L6.6 9.3C9 11.2 10.5 11.5 12.3 11.9C14.5 12.4 16 12.6 18.4 13.9L13.6 17.4\" fill=\"none\" stroke=\"#0F9DAB\" stroke-width=\"2.6\" stroke-linejoin=\"miter\"/><ellipse cx=\"14.9\" cy=\"4.8\" rx=\"3.4\" ry=\"2.6\" transform=\"rotate(-28 14.9 4.8)\" fill=\"#fff\"/><ellipse cx=\"10.3\" cy=\"18.6\" rx=\"3.7\" ry=\"2.8\" transform=\"rotate(-28 10.3 18.6)\" fill=\"#fff\"/></svg>"},"genius":{"color":"#CC2229","svg":"<svg viewBox=\"1085 490 820 870\"><path fill=\"#CC2229\" d=\"M1840 625C1855 618 1870 620 1865 640C1850 720 1700 950 1670 1005C1630 1075 1550 1180 1515 1225C1450 1305 1380 1360 1375 1345C1380 1335 1392 1325 1395 1315C1400 1295 1430 1270 1430 1255C1425 1240 1410 1270 1398 1275C1395 1265 1420 1225 1422 1210C1425 1195 1450 1140 1470 1060C1480 1010 1490 975 1488 960C1485 920 1450 915 1410 907C1365 898 1350 888 1330 883C1270 868 1180 850 1135 820C1112 805 1120 795 1155 790C1290 772 1430 760 1530 740C1640 718 1740 680 1840 625Z\"/><path style=\"fill:var(--mbu-text,currentColor)\" d=\"M1810 510C1830 505 1855 520 1855 550C1855 570 1848 572 1848 580C1852 595 1830 630 1810 645C1795 657 1775 663 1760 660C1730 654 1720 630 1720 605C1722 560 1765 515 1810 510Z\"/></svg>"},"viaf":{"color":"#2a6ebb","svg":"<svg viewBox=\"0 0 24 24\" fill=\"none\"><circle cx=\"8.6\" cy=\"8.6\" r=\"6.6\" stroke=\"#2a6ebb\" stroke-width=\"2.6\"/><circle cx=\"14\" cy=\"13.4\" r=\"5\" stroke=\"#5a9a2e\" stroke-width=\"2.3\"/><circle cx=\"12.6\" cy=\"18.6\" r=\"3.6\" stroke=\"#e8792b\" stroke-width=\"2\"/></svg>"},"youtube":{"color":"#FF0000","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FF0000\" d=\"M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z\"/></svg>"},"instagram":{"color":"#FF0069","svg":"<svg viewBox=\"0 0 24 24\"><defs><radialGradient id=\"ig-g\" cx=\".3\" cy=\"1.07\" r=\"1.2\"><stop offset=\"0\" stop-color=\"#FFDD55\"/><stop offset=\".1\" stop-color=\"#FFDD55\"/><stop offset=\".5\" stop-color=\"#FF543E\"/><stop offset=\"1\" stop-color=\"#C837AB\"/></radialGradient></defs><path fill=\"url(#ig-g)\" d=\"M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077\"/></svg>"},"imdb":{"color":"#F5C518","svg":"<svg viewBox=\"0 0 24 24\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" fill=\"#000\"/><path fill=\"#F5C518\" d=\"M22.3781 0H1.6218C.7411.0583.0587.7437.0018 1.5953l-.001 20.783c.0585.8761.7125 1.543 1.5559 1.6191A.337.337 0 0 0 1.6016 24h20.7971a.4579.4579 0 0 0 .0437-.002c.8727-.0768 1.5568-.8271 1.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294 0 0 0 22.3781 0zm0 .496a1.2144 1.2144 0 0 1 1.1252 1.2139v20.5797c0 .6377-.4875 1.1602-1.1045 1.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371 1.0185 1.0184.5364 1.6217.496h20.7564zM4.7954 8.2603v7.3636H2.8899V8.2603h1.9055zm6.5367 0v7.3636H9.6707v-4.9704l-.6711 4.9704H7.813l-.6986-4.8618-.0066 4.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307 1.5734l.2712 1.8713.4407-3.4447h2.4817zm2.9772 1.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0 .4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204 0 .3457.0205.4211.0681zm-.0211 6.0347c.4543 0 .8006-.0265 1.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0 .3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086 0-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153 0 .2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047 0 .5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172 0-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z\"/></svg>"},"songkick":{"color":"#F80046","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#F80046\" d=\"M6.55 18.779c-1.855 0-3.372-.339-4.598-1.602l1.92-1.908c.63.631 1.74.853 2.715.853 1.186 0 1.739-.391 1.739-1.089 0-.291-.06-.529-.239-.717-.15-.154-.404-.273-.795-.324l-1.455-.205c-1.064-.152-1.891-.51-2.43-1.072-.555-.578-.84-1.395-.84-2.434C2.536 8.066 4.2 6.45 6.96 6.45c1.74 0 3.048.407 4.086 1.448L9.171 9.77c-.765-.766-1.77-.715-2.295-.715-1.039 0-1.465.597-1.465 1.125 0 .152.051.375.24.561.15.153.404.307.832.359l1.467.203c1.09.153 1.875.495 2.385 1.005.645.63.9 1.53.9 2.655 0 2.47-2.127 3.819-4.68 3.819l-.005-.003zM20.813 2.651C19.178 1.432 17.37.612 15.089.237v10.875l3.261-4.539h3.565l-4.095 5.72s.944 1.51 1.515 2.405c.586.899 1.139 1.14 1.965 1.14h.57v2.806h-.872c-1.812 0-2.9-.33-3.72-1.575-.504-.811-2.175-3.436-2.175-3.436v4.995H12.12V-.001H12c-3.852 0-6.509.931-8.811 2.652C-.132 5.137.001 8.451.001 11.997c0 3.547-.133 6.867 3.188 9.352C5.491 23.074 8.148 24 12 24s6.51-.927 8.812-2.651C24.131 18.865 24 15.544 24 11.997c0-3.546.132-6.859-3.188-9.346h.001z\"/></svg>"},"bandsintown":{"color":"#00CEC8","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#00CEC8\" d=\"M6.399 12.8v4.8H19.2v1.6H4.799V0H0v24h24V12.8H6.399Zm4.801-8H6.399v6.4H11.2V4.8Zm6.4 0h-4.8v6.4h4.8V4.8ZM24 0h-4.8v11.2H24V0Z\"/></svg>"},"napster":{"color":"#2259FF","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#2259FF\" d=\"M20.495 4.543c-.22 0-.438 0-.657.03h-.031l-.032-.03C17.93 2.21 15.02.798 12.015.798c-3.004 0-5.945 1.412-7.76 3.775l-.031.03h-.031c-.22-.03-.439-.03-.658-.03H2.16v2.394l-.032.03A3.628 3.628 0 0 0 0 10.282c0 1.412.844 2.701 2.127 3.284h.063v.062c.031 5.278 4.443 9.575 9.825 9.575s9.794-4.297 9.825-9.575v-.062l.032-.03C23.155 12.92 24 11.632 24 10.25c0-1.412-.845-2.7-2.128-3.284l-.032-.03V4.542zM6.821 5.34a7.443 7.443 0 0 1 5.194-2.117c1.94 0 3.818.767 5.195 2.117l.062.062-.094.061c-.375.215-.72.43-1.064.675l-.03.031-.032-.03c-.908-.461-2.347-.983-4.005-.983s-3.098.522-4.006.982l-.03.031-.032-.03a10.22 10.22 0 0 0-1.064-.676l-.188-.061zm12.329 8.195c0 3.866-3.223 7.027-7.166 7.027-3.942 0-7.134-3.16-7.134-7.027V7.458l.094.03c1.252.308 2.44 1.658 2.722 1.996.313-.338 1.784-1.658 4.35-1.658 2.565 0 4.036 1.35 4.35 1.658.28-.338 1.438-1.688 2.721-1.995l.094-.031v6.077z\"/></svg>"},"myspace":{"color":"#030303","svg":"<svg viewBox=\"0 0 24 24\"><path style=\"fill:var(--mbu-text,currentColor)\" d=\"M19.802 12.274A3.811 3.811 0 0023.62 8.47c0-2.101-1.71-3.795-3.818-3.795a3.816 3.816 0 00-3.818 3.81 3.817 3.817 0 003.818 3.811zm-8.602.705a3.43 3.43 0 003.435-3.424A3.43 3.43 0 0011.2 6.13a3.44 3.44 0 00-3.436 3.436A3.436 3.436 0 0011.2 13zm-7.8.635c1.71 0 3.093-1.38 3.093-3.081 0-1.704-1.395-3.084-3.105-3.084A3.086 3.086 0 00.3 10.539c0 1.7 1.387 3.078 3.095 3.078zm0 .705c-1.96 0-3.4 1.717-3.4 3.495v1.196c0 .17.138.31.31.31h6.18a.31.31 0 00.309-.31v-1.196c0-1.779-1.437-3.5-3.398-3.5zm7.8-.56c-2.18 0-3.78 1.915-3.78 3.891v1.331c0 .188.156.344.345.344h6.87a.344.344 0 00.342-.344V17.65c0-1.976-1.598-3.891-3.777-3.891zm8.602-.617c-2.422 0-4.197 2.126-4.197 4.323v1.477c0 .21.172.381.382.381h7.63c.21 0 .383-.171.383-.381v-1.477c-.001-2.197-1.776-4.323-4.198-4.323z\"/></svg>"},"vk":{"color":"#0077FF","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#0077FF\" d=\"m9.489.004.729-.003h3.564l.73.003.914.01.433.007.418.011.403.014.388.016.374.021.36.025.345.03.333.033c1.74.196 2.933.616 3.833 1.516.9.9 1.32 2.092 1.516 3.833l.034.333.029.346.025.36.02.373.025.588.012.41.013.644.009.915.004.98-.001 3.313-.003.73-.01.914-.007.433-.011.418-.014.403-.016.388-.021.374-.025.36-.03.345-.033.333c-.196 1.74-.616 2.933-1.516 3.833-.9.9-2.092 1.32-3.833 1.516l-.333.034-.346.029-.36.025-.373.02-.588.025-.41.012-.644.013-.915.009-.98.004-3.313-.001-.73-.003-.914-.01-.433-.007-.418-.011-.403-.014-.388-.016-.374-.021-.36-.025-.345-.03-.333-.033c-1.74-.196-2.933-.616-3.833-1.516-.9-.9-1.32-2.092-1.516-3.833l-.034-.333-.029-.346-.025-.36-.02-.373-.025-.588-.012-.41-.013-.644-.009-.915-.004-.98.001-3.313.003-.73.01-.914.007-.433.011-.418.014-.403.016-.388.021-.374.025-.36.03-.345.033-.333c.196-1.74.616-2.933 1.516-3.833.9-.9 2.092-1.32 3.833-1.516l.333-.034.346-.029.36-.025.373-.02.588-.025.41-.012.644-.013.915-.009ZM6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z\"/></svg>"},"weibo":{"color":"#E6162D","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#E6162D\" d=\"M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z\"/></svg>"},"pandora":{"color":"#224099","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#224099\" d=\"M1.882 0v24H8.32a1.085 1.085 0 001.085-1.085v-4.61h1.612c7.88 0 11.103-4.442 11.103-9.636C22.119 2.257 17.247 0 12.662 0H1.882Z\"/></svg>"},"ebay":{"color":"#E53238","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#E53238\" d=\"M6.056 12.132v-4.92h1.2v3.026c.59-.703 1.402-.906 2.202-.906 1.34 0 2.828.904 2.828 2.855 0 .233-.015.457-.06.668.24-.953 1.274-1.305 2.896-1.344.51-.018 1.095-.018 1.56-.018v-.135c0-.885-.556-1.244-1.53-1.244-.72 0-1.245.3-1.305.81h-1.275c.136-1.29 1.5-1.62 2.686-1.62 1.064 0 1.995.27 2.415 1.02l-.436-.84h1.41l2.055 4.125 2.055-4.126H24l-3.72 7.305h-1.346l1.07-2.04-2.33-4.38c.13.255.2.555.2.93v2.46c0 .346.01.69.04 1.005H16.8a6.543 6.543 0 01-.046-.765c-.603.734-1.32.96-2.32.96-1.48 0-2.272-.78-2.272-1.695 0-.15.015-.284.037-.405-.3 1.246-1.36 2.086-2.767 2.086-.87 0-1.694-.315-2.2-.93 0 .24-.015.494-.04.734h-1.18c.02-.39.04-.855.04-1.245v-1.05h-4.83c.065 1.095.818 1.74 1.853 1.74.718 0 1.355-.3 1.568-.93h1.24c-.24 1.29-1.61 1.725-2.79 1.725C.95 15.009 0 13.822 0 12.232c0-1.754.982-2.91 3.116-2.91 1.688 0 2.93.886 2.94 2.806v.005zm9.137.183c-1.095.034-1.77.233-1.77.95 0 .465.36.97 1.305.97 1.26 0 1.935-.69 1.935-1.814v-.13c-.45 0-.99.006-1.484.022h.012zm-6.06 1.875c1.11 0 1.876-.806 1.876-2.02s-.768-2.02-1.893-2.02c-1.11 0-1.89.806-1.89 2.02s.765 2.02 1.875 2.02h.03zm-4.35-2.514c-.044-1.125-.854-1.546-1.725-1.546-.944 0-1.694.474-1.815 1.546z\"/></svg>"},"creativecommons":{"color":"#000000","svg":"<svg viewBox=\"0 0 24 24\"><path style=\"fill:var(--mbu-text,currentColor)\" d=\"M11.983 0c-3.292 0-6.19 1.217-8.428 3.485C1.25 5.819 0 8.844 0 12c0 3.189 1.217 6.148 3.522 8.45C5.827 22.75 8.822 24 11.983 24c3.16 0 6.222-1.25 8.593-3.583C22.815 18.214 24 15.287 24 12c0-3.255-1.186-6.214-3.458-8.483C18.238 1.217 15.275 0 11.983 0zm.033 2.17c2.7 0 5.103 1.02 6.98 2.893 1.843 1.841 2.83 4.274 2.83 6.937 0 2.696-.954 5.063-2.798 6.872-1.943 1.906-4.444 2.926-7.012 2.926-2.601 0-5.038-1.019-6.914-2.893-1.877-1.875-2.93-4.34-2.93-6.905 0-2.597 1.053-5.063 2.93-6.97 1.844-1.874 4.214-2.86 6.914-2.86zM8.68 8.278C6.723 8.278 5.165 9.66 5.165 12c0 2.38 1.465 3.722 3.581 3.722 1.358 0 2.516-.744 3.155-1.874l-1.491-.758c-.333.798-.839 1.037-1.478 1.037-1.105 0-1.61-.917-1.61-2.126 0-1.21.426-2.127 1.61-2.127.32 0 .96.173 1.332.97l1.597-.838c-.68-1.236-1.837-1.728-3.181-1.728zm6.932 0c-1.957 0-3.514 1.382-3.514 3.722 0 2.38 1.464 3.722 3.58 3.722 1.359 0 2.516-.744 3.155-1.874l-1.49-.758c-.333.798-.84 1.037-1.478 1.037-1.105 0-1.611-.917-1.611-2.126 0-1.21.426-2.127 1.61-2.127.32 0 .96.173 1.332.97l1.597-.838c-.68-1.236-1.837-1.728-3.181-1.728z\"/></svg>"},"commons":{"color":"#006699","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#006699\" d=\"M9.048 15.203a2.952 2.952 0 1 1 5.904 0 2.952 2.952 0 0 1-5.904 0zm11.749.064v-.388h-.006a8.726 8.726 0 0 0-.639-2.985 8.745 8.745 0 0 0-1.706-2.677l.004-.004-.186-.185-.044-.045-.026-.026-.204-.204-.006.007c-.848-.756-1.775-1.129-2.603-1.461-1.294-.519-2.138-.857-2.534-2.467.443.033.839.174 1.13.481C15.571 6.996 11.321 0 11.321 0s-1.063 3.985-2.362 5.461c-.654.744.22.273 1.453-.161.279 1.19.77 2.119 1.49 2.821.791.771 1.729 1.148 2.556 1.48.672.27 1.265.508 1.767.916l-.593.594-.668-.668-.668 2.463 2.463-.668-.668-.668.6-.599a6.285 6.285 0 0 1 1.614 3.906h-.844v-.944l-2.214 1.27 2.214 1.269v-.944h.844a6.283 6.283 0 0 1-1.614 3.906l-.6-.599.668-.668-2.463-.668.668 2.463.668-.668.6.6a6.263 6.263 0 0 1-3.907 1.618v-.848h.945L12 18.45l-1.27 2.214h.944v.848a6.266 6.266 0 0 1-3.906-1.618l.599-.6.668.668.668-2.463-2.463.668.668.668-.6.599a6.29 6.29 0 0 1-1.615-3.906h.844v.944l2.214-1.269-2.214-1.27v.944h-.843a6.292 6.292 0 0 1 1.615-3.906l.6.599-.668.668 2.463.668-.668-2.463-.668.668-2.359-2.358-.23.229-.044.045-.185.185.004.004a8.749 8.749 0 0 0-2.345 5.662h-.006v.649h.006a8.749 8.749 0 0 0 2.345 5.662l-.004.004.185.185.045.045.045.045.185.185.004-.004a8.73 8.73 0 0 0 2.677 1.707 8.75 8.75 0 0 0 2.985.639V24h.649v-.006a8.75 8.75 0 0 0 2.985-.639 8.717 8.717 0 0 0 2.677-1.707l.004.004.187-.187.044-.043.043-.044.187-.186-.004-.004a8.733 8.733 0 0 0 1.706-2.677 8.726 8.726 0 0 0 .639-2.985h.006v-.259z\"/></svg>"},"googleplay":{"color":"#414141","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#01875F\" d=\"M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z\"/></svg>"},"globe":{"color":"#6f7d75","svg":"<svg viewBox=\"2 2 20 20\" fill=\"none\" stroke=\"#6f7d75\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18\"/></svg>"}};
  function stIcon(name, size) { var i = ST_ICONS[name]; if (!i) return ''; size = size || 16; return i.svg.replace(/<svg\b([^>]*)>/, function (m, a) { a = a.replace(/\s(?:width|height)="[^"]*"/g, ''); var ns = /\bxmlns=/.test(a) ? '' : ' xmlns="http://www.w3.org/2000/svg"'; return '<svg' + a + ns + ' width="' + size + '" height="' + size + '">'; }); }
  function stColor(name) { return (ST_ICONS[name] && ST_ICONS[name].color) || ''; }
  // </ST-ICONS>

  const LOG = mbuLog({ name: NAME, version: VER, key: 'fuzzy_logic:logwin', history: { prefix: 'fl:session:', auto: true } });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const xesc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // ── settings ──────────────────────────────────────────────────────────────
  const SOURCES = {
    bandcamp: 'Bandcamp', discogs: 'Discogs', deezer: 'Deezer', apple: 'Apple Music', allmusic: 'AllMusic',
    beatport: 'Beatport', wikidata: 'Wikidata', soundcloud: 'SoundCloud', vocadb: 'VocaDB', lastfm: 'Last.fm',
  };
  const DOMAIN = {
    bandcamp: 'bandcamp.com', discogs: 'discogs.com', deezer: 'deezer.com', apple: 'music.apple.com', allmusic: 'allmusic.com',
    beatport: 'beatport.com', wikidata: 'wikidata.org', soundcloud: 'soundcloud.com', vocadb: 'vocadb.net', lastfm: 'last.fm',
  };
  // one rule per line, `left → a; b`; /re/ on the left is a regex ($1 works on the right). The right side is never
  // empty: dropping a tag is what the ignore list is for
  const DEFAULT_MAPPER = [
    'Folk, World, & Country → folk; world; country',
    'Funk / Soul → funk; soul',
    'Stage & Screen → soundtrack',
    'Brass & Military → brass band; military',
    "Children's → children's music",
  ].join('\n');
  const DEFAULTS = {
    sources: Object.fromEntries(Object.keys(SOURCES).map(k => [k, true])),
    mapper: DEFAULT_MAPPER,
    ignore: 'seen live\nfavorites\nnon-music\n/^\\d+$/',
    favourites: '',
    genresOnly: true,
    background: false,
    propRG: false,
    propRec: false,
  };
  const loadCfg = () => {
    let c = {};
    try { c = JSON.parse(GM_getValue('fuzzy_logic:cfg', '{}')) || {}; } catch (e) { /* default */ }
    return Object.assign({}, DEFAULTS, c, { sources: Object.assign({}, DEFAULTS.sources, c.sources || {}) });
  };
  let CFG = loadCfg();
  const saveCfg = () => GM_setValue('fuzzy_logic:cfg', JSON.stringify(CFG));
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

  // ── mapper ────────────────────────────────────────────────────────────────
  function parseRules(text) {
    const out = [];
    for (const line of lines(text)) {
      if (line.startsWith('#')) continue;
      const m = line.match(/^(.*?)\s*(?:→|->)\s*(.*)$/);
      if (!m) continue;
      const left = m[1].trim(), right = m[2].split(';').map(s => s.trim()).filter(Boolean);
      if (!left || !right.length) continue;   // nothing on the right is the ignore list's job
      const re = left.match(/^\/(.+)\/([a-z]*)$/);
      let rx = null;
      if (re) { try { rx = new RegExp(re[1], re[2].includes('i') ? re[2] : re[2] + 'i'); } catch (e) { LOG.warn('Bad mapper regex: ' + left); continue; } }
      out.push({ src: left, left: left.toLowerCase(), rx, right });
    }
    return out;
  }
  const rulesText = rows => rows.filter(r => r.src.trim() && r.right.length).map(r => r.src.trim() + ' → ' + r.right.join('; ')).join('\n');
  function parseIgnore(text) {
    return lines(text).map(s => {
      const re = s.match(/^\/(.+)\/([a-z]*)$/);
      if (re) { try { return new RegExp(re[1], re[2].includes('i') ? re[2] : re[2] + 'i'); } catch (e) { return null; } }
      return s.toLowerCase();
    }).filter(Boolean);
  }
  function mapTag(tag, rules) {
    const t = tag.trim();
    for (const r of rules) {
      if (r.rx) {
        const m = t.match(r.rx);
        if (m && m[0].length === t.length) return r.right.map(x => x.replace(/\$(\d)/g, (_, i) => m[+i] || ''));
      } else if (r.left === t.toLowerCase()) return r.right.slice();
    }
    return [t];
  }
  const ignored = (t, ign) => ign.some(i => typeof i === 'string' ? i === t : i.test(t));
  const keyOf = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const favs = () => CFG.favourites.split(/[\n;]/).map(s => s.trim().toLowerCase()).filter(Boolean);

  // ── genre list (7-day cache) ──────────────────────────────────────────────
  async function genres() {
    let c = null;
    try { c = JSON.parse(GM_getValue('fuzzy_logic:genres', 'null')); } catch (e) { /* none */ }
    if (c && Date.now() - c.t < 7 * 864e5 && c.list && c.list.length) return new Set(c.list);
    const r = await mbnFetch(location.origin + '/ws/2/genre/all?fmt=txt');
    if (!r || !r.ok) { LOG.warn('Genre list failed: ' + (r && r.status)); return new Set(c ? c.list : []); }
    const list = (await r.text()).split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
    GM_setValue('fuzzy_logic:genres', JSON.stringify({ t: Date.now(), list }));
    LOG.info('Genre list loaded: ' + list.length);
    return new Set(list);
  }

  // ── favicons (fetched once, kept as data URLs) ────────────────────────────
  const FAV = {};
  try { Object.assign(FAV, JSON.parse(GM_getValue('fuzzy_logic:favicons', '{}')) || {}); } catch (e) { /* none */ }
  const favPend = {};
  function favicon(src) {
    if (FAV[src] || favPend[src]) return;
    favPend[src] = true;
    GM_xmlhttpRequest({
      method: 'GET', url: 'https://www.google.com/s2/favicons?sz=32&domain=' + DOMAIN[src], responseType: 'blob', timeout: 15000,
      onload: r => {
        if (r.status !== 200 || !r.response) return;
        const fr = new FileReader();
        fr.onload = () => {
          FAV[src] = fr.result; GM_setValue('fuzzy_logic:favicons', JSON.stringify(FAV));
          document.querySelectorAll('.fl-fav[data-src="' + src + '"]').forEach(i => { i.outerHTML = fav(src, i.getAttribute('data-cls') || ''); });
        };
        fr.readAsDataURL(r.response);
      },
    });
  }
  // the icon, or its initial while it loads
  function fav(src, cls) {
    const c = 'fl-fav' + (cls ? ' ' + cls : '');
    // the suite's own platform icon (Platform Check's) where there is one, else the site's favicon
    const st = stIcon(src, 24);
    if (st) return '<span class="' + c + ' fl-st" data-src="' + src + '">' + st + '</span>';
    favicon(src);
    return FAV[src] ? '<img class="' + c + '" data-src="' + src + '" data-cls="' + esc(cls || '') + '" src="' + FAV[src] + '" alt="">'
      : '<span class="' + c + ' fl-fav-l" data-src="' + src + '" data-cls="' + esc(cls || '') + '">' + SOURCES[src][0] + '</span>';
  }

  // ── entity and its links ──────────────────────────────────────────────────
  const ENT_RE = /^\/(release|release-group|artist|label|recording)\/([0-9a-f-]{36})\/?$/;
  const em = location.pathname.match(ENT_RE);
  // Event Horizon's tag editor, and its in-page navigation, switch them (below)
  let TYPE = em ? em[1] : null, MBID = em ? em[2] : null, PATH = location.pathname;

  async function ws(path) {
    const r = await mbnFetch(location.origin + '/ws/2/' + path + (path.includes('?') ? '&' : '?') + 'fmt=json');
    if (!r || !r.ok) throw new Error('ws/2 ' + path + ': ' + (r ? r.status : 'gate'));
    return r.json();
  }
  const urlsOf = o => (o.relations || []).filter(x => x.url && x.url.resource).map(x => x.url.resource);

  async function links() {
    const own = await ws(TYPE + '/' + MBID + '?inc=url-rels+tags');
    S.ent = new Set((own.tags || []).map(t => t.name.toLowerCase()));
    const set = new Set(urlsOf(own));
    if (TYPE === 'release-group') {
      // the maintainer: "RG could use all links from releases"
      const rs = await ws('release?release-group=' + MBID + '&inc=url-rels&limit=100');
      for (const rel of rs.releases || []) urlsOf(rel).forEach(u => set.add(u));
    }
    return [...set];
  }

  // ── fetchers ──────────────────────────────────────────────────────────────
  function gm(url, type) {
    return new Promise((res, rej) => GM_xmlhttpRequest({
      method: 'GET', url, timeout: 20000, headers: { Accept: type === 'json' ? 'application/json' : 'text/html,*/*' },
      onload: r => (r.status >= 200 && r.status < 300) ? res(type === 'json' ? JSON.parse(r.responseText) : r.responseText) : rej(new Error('HTTP ' + r.status)),
      onerror: () => rej(new Error('network')), ontimeout: () => rej(new Error('timeout')),
    }));
  }
  const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value.trim(); };
  const all = (text, re) => [...text.matchAll(re)].map(m => decode(m[1]));
  const lastSeg = u => u.replace(/[?#].*$/, '').replace(/\/+$/, '');

  const FETCHERS = [
    { src: 'bandcamp', test: u => /bandcamp\.com\//.test(u) && /\/(album|track)\//.test(u),
      run: async u => { const h = await gm(u); const t = all(h, /<a class="tag"[^>]*>([^<]+)<\/a>/g); if (t.length) return t; const k = h.match(/"keywords":(\[[^\]]*\])/); try { return k ? JSON.parse(k[1]) : []; } catch { return []; } } },
    { src: 'discogs', test: u => /discogs\.com\/(?:[a-z]{2}\/)?(release|master)\/\d+/.test(u),
      run: async u => { const m = u.match(/(release|master)\/(\d+)/); const j = await gm('https://api.discogs.com/' + m[1] + 's/' + m[2], 'json'); return [...(j.genres || []), ...(j.styles || [])]; } },
    { src: 'deezer', test: u => /deezer\.com\/(?:[a-z]{2}\/)?album\/\d+/.test(u),
      run: async u => { const j = await gm('https://api.deezer.com/album/' + u.match(/album\/(\d+)/)[1], 'json'); return ((j.genres && j.genres.data) || []).map(g => g.name); } },
    { src: 'apple', test: u => /(music|itunes)\.apple\.com\/.*\/(album|artist)\/.*?(?:id)?\d+/.test(u),
      run: async u => { const id = lastSeg(u).match(/(?:id)?(\d+)$/)[1]; const j = await gm('https://itunes.apple.com/lookup?id=' + id, 'json'); return (j.results || []).map(r => r.primaryGenreName).filter(g => g && g !== 'Music'); } },
    { src: 'allmusic', test: u => /allmusic\.com\/(album|artist|song)\//.test(u),
      run: async u => all(await gm(u), /href="[^"]*allmusic\.com\/(?:genre|style)\/[^"]*"[^>]*>([^<]+)</g) },
    { src: 'beatport', test: u => /beatport\.com\/(release|track)\//.test(u),
      run: async u => all(await gm(u), /"(?:sub_)?genre":\{[^{}]*?"name":"([^"]+)"/g) },
    { src: 'wikidata', test: u => /wikidata\.org\/wiki\/Q\d+/.test(u),
      run: async u => {
        const q = u.match(/(Q\d+)/)[1];
        const sparql = 'SELECT ?l WHERE { wd:' + q + ' wdt:P136 ?g. ?g rdfs:label ?l FILTER(lang(?l)="en") }';
        const j = await gm('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), 'json');
        return j.results.bindings.map(b => b.l.value);
      } },
    { src: 'soundcloud', test: u => /soundcloud\.com\/[^/]+\/./.test(u),
      run: async u => all(await gm(u), /"genre":"([^"]+)"/g).slice(0, 1) },
    { src: 'vocadb', test: u => /vocadb\.net\/(Al|Ar|S)\/\d+/.test(u),
      run: async u => { const m = u.match(/\/(Al|Ar|S)\/(\d+)/); const k = { Al: 'albums', Ar: 'artists', S: 'songs' }[m[1]]; const j = await gm('https://vocadb.net/api/' + k + '/' + m[2] + '?fields=Tags', 'json'); return (j.tags || []).map(t => t.tag.name); } },
    { src: 'lastfm', test: u => /last\.fm\/(?:[a-z]{2}\/)?music\//.test(u),
      run: async u => all(await gm(lastSeg(u) + '/+tags'), /<a[^>]+href="\/(?:[a-z]{2}\/)?tag\/[^"]+"[^>]*class="link-block-target"[^>]*>([^<]+)<\/a>/g) },
  ];

  // ── voting via ws/2 (one batched POST per 200 entities) ───────────────────
  async function vote(entities, tags, kind) {
    const byType = {};
    for (const e of entities) (byType[e.type] = byType[e.type] || []).push(e.mbid);
    const tagXml = tags.map(t => '<user-tag vote="' + kind + '"><name>' + xesc(t) + '</name></user-tag>').join('');
    let done = 0;
    for (const [type, ids] of Object.entries(byType)) {
      for (let i = 0; i < ids.length; i += 200) {
        const body = '<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#"><' + type + '-list>'
          + ids.slice(i, i + 200).map(id => '<' + type + ' id="' + id + '"><user-tag-list>' + tagXml + '</user-tag-list></' + type + '>').join('')
          + '</' + type + '-list></metadata>';
        const r = await mbnFetch(location.origin + '/ws/2/tag?client=FuzzyLogic-' + VER, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/xml; charset=utf-8' }, body,
        });
        const txt = r ? await r.text() : '';
        if (!r || !r.ok || !/<text>OK<\/text>/.test(txt)) throw new Error(type + ': HTTP ' + (r && r.status) + ' ' + txt.replace(/<[^>]+>/g, ' ').trim().slice(0, 160));
        done += ids.slice(i, i + 200).length;
      }
    }
    LOG.ok(kind + ' ' + tags.join(', ') + ' on ' + done + ' entit' + (done === 1 ? 'y' : 'ies'));
    return done;
  }

  async function targets() {
    const list = [{ type: TYPE, mbid: MBID }];
    if (TYPE !== 'release' || !S.prop) return list;
    const j = await ws('release/' + MBID + '?inc=release-groups+recordings');
    if (j['release-group']) list.push({ type: 'release-group', mbid: j['release-group'].id });
    const seen = new Set();
    for (const m of j.media || []) for (const t of m.tracks || []) {
      if (t.recording && !seen.has(t.recording.id)) { seen.add(t.recording.id); list.push({ type: 'recording', mbid: t.recording.id }); }
    }
    return list;
  }

  // ── state ─────────────────────────────────────────────────────────────────
  const loggedIn = !!document.querySelector('#tag-form, a[href*="/logout"]');
  const S = { status: {}, raw: [], tags: new Map(), genres: new Set(), sel: new Set(), suggest: [], showAll: !CFG.genresOnly,
    busy: false, ran: false, gen: 0, ent: new Set(), have: new Set(), eh: null, prop: CFG.propRG || CFG.propRec };
  const sidebarTags = () => new Set([...document.querySelectorAll('#sidebar a[href*="/tag/"]')].map(a => a.textContent.trim().toLowerCase()));
  const ehTags = () => new Set([...(S.eh ? S.eh.querySelectorAll('.tgi') : [])].map(c => (c.firstChild && c.firstChild.textContent || '').trim().toLowerCase()));
  // the entity's tags as MusicBrainz has them (read with the links), plus what the page shows since (votes made here)
  const haveNow = () => new Set([...S.ent, ...(S.eh ? ehTags() : sidebarTags())]);

  function rebuild() {
    const rules = parseRules(CFG.mapper), ign = parseIgnore(CFG.ignore);
    const m = new Map(), sug = new Map();
    for (const { src, tag, url } of S.raw) {
      for (let t of mapTag(tag, rules)) {
        t = t.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!t || ignored(t, ign)) continue;
        const e = m.get(t) || { name: t, srcs: new Map(), genre: S.genres.has(t), orig: new Set() };
        if (!e.srcs.has(src)) e.srcs.set(src, new Set());
        e.srcs.get(src).add(url); e.orig.add(tag);
        m.set(t, e);
        if (!e.genre && S.genres.size) {
          const k = keyOf(t);
          for (const g of S.genres) if (keyOf(g) === k) { sug.set(t, g); break; }
        }
      }
    }
    for (const f of favs()) if (!m.has(f) && !ignored(f, ign)) m.set(f, { name: f, srcs: new Map(), genre: S.genres.has(f), orig: new Set(), fav: true });
    S.tags = m;
    S.suggest = [...sug].map(([from, to]) => ({ from, to }));
    S.have = haveNow();
    if (!S.ran) for (const e of m.values()) if (e.genre && e.srcs.size && !S.have.has(e.name) && !e.name.includes(',')) S.sel.add(e.name);
    for (const n of [...S.sel]) if (!m.has(n)) S.sel.delete(n);
    badge();
  }
  // what the badge counts: genres offered and not on the entity yet
  const fresh = () => [...S.tags.values()].filter(e => e.genre && e.srcs.size && !S.have.has(e.name)).length;

  async function collect() {
    if (!TYPE || S.busy) return;
    const gen = ++S.gen, raw = S.raw = [], status = S.status = {};   // a navigation mid-run orphans these
    S.busy = true; dockBusy(true); draw();
    // a run is worth reading back: keep the session in the log's history, named after the entity
    LOG.keep(); LOG.name(TYPE + ': ' + (document.title.replace(/s+[-–]s+MusicBrainz.*$/, '') || MBID));
    try {
      const [g, ls] = await Promise.all([genres(), links()]);
      S.genres = g;
      const queues = {};
      for (const u of ls) {
        const f = FETCHERS.find(x => x.test(u));
        if (!f || !CFG.sources[f.src]) continue;
        (queues[f.src] = queues[f.src] || { f, urls: [] }).urls.push(u);
      }
      const MAX = 10;
      const jobs = Object.values(queues).map(async ({ f, urls }) => {
        if (gen !== S.gen) return;
        const st = status[f.src] = { state: 'run', n: 0, urls: urls.slice(0, MAX), ok: 0 };
        if (urls.length > MAX) LOG.info(SOURCES[f.src] + ': ' + urls.length + ' links, reading the first ' + MAX);
        for (const u of st.urls) {
          if (gen !== S.gen) return;
          try {
            const tags = [...new Set((await f.run(u)).map(t => String(t).trim()).filter(Boolean))];
            tags.forEach(tag => raw.push({ src: f.src, tag, url: u }));
            st.n += tags.length; st.ok++;
            LOG.info(SOURCES[f.src] + ' ' + u + ': ' + (tags.join(', ') || 'none'));
          } catch (err) {
            st.err = err.message;
            LOG.warn(SOURCES[f.src] + ' ' + u + ': ' + err.message);
            if (/\b429\b/.test(err.message)) break;
          }
          if (gen !== S.gen) return;
          rebuild(); draw();
        }
        st.state = st.ok ? 'ok' : 'err';
      });
      if (!jobs.length) LOG.info('No supported links on this ' + TYPE);
      await Promise.all(jobs);
    } catch (e) {
      LOG.error('Collect failed: ' + e.message);
      mbuToast('⚠ ' + NAME + ': ' + e.message, { kind: 'warn' });
    }
    if (gen !== S.gen) return;
    S.busy = false; rebuild(); S.ran = true; dockBusy(false); draw();
  }
  const reset = () => { S.gen++; if (S.busy) dockBusy(false); Object.assign(S, { status: {}, raw: [], tags: new Map(), sel: new Set(), suggest: [], ran: false, busy: false, ent: new Set() }); };

  // ── styles and icons ──────────────────────────────────────────────────────
  const SB = 'scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent';
  const CSS = `
.mbu-ov.fl-pop{background:none;pointer-events:none}.fl-pop .mbu-ov-panel{width:min(440px,94vw);box-sizing:border-box;pointer-events:auto;border:1px solid var(--mbu-border);background:color-mix(in srgb,var(--mbu-bg) 88%,transparent);backdrop-filter:blur(6px)}
.fl-pop .mbu-ov-panel{width:min(440px,94vw)!important;max-width:94vw!important;max-height:86vh;display:flex;flex-direction:column}
.fl-pop .mbu-ov-body{padding:0;display:flex;flex-direction:column;min-height:0}
.fl-ui{font:var(--mbu-fs-sm)/1.4 var(--mbu-font);color:var(--mbu-text)}
.fl-srcs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 10px;padding:0 8px}
.fl-src.fl-src{display:inline-grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid transparent;border-radius:var(--mbu-radius);background:none;cursor:pointer}
.fl-src.fl-src:hover{border-color:var(--mbu-border)}
.fl-src .fl-fav{width:24px;height:24px;border-radius:4px}
.fl-src.out .fl-fav{filter:grayscale(1);opacity:.3}
.fl-gear{font-size:18px;line-height:1;width:28px;height:28px;justify-content:center;align-items:center}
.fl-fav{width:16px;height:16px;border-radius:3px;flex:0 0 auto;vertical-align:middle}
.fl-fav.fl-st{display:inline-block;border-radius:0}
.fl-fav.fl-st svg{width:100%!important;height:100%!important;display:block}
.fl-fav-l{display:inline-grid;place-items:center;font-size:10px;font-weight:600;background:var(--mbu-bg-hover);color:var(--mbu-text-dim)}
.fl-fav.off{filter:grayscale(1);opacity:.35}
.fl-fav.run{animation:fl-p 1s infinite alternate}
@keyframes fl-p{to{opacity:.3}}
.fl-ic{background:none;border:0;padding:4px;cursor:pointer;color:var(--mbu-text-weak);border-radius:var(--mbu-radius);display:inline-flex}
.fl-ic:hover{color:var(--mbu-accent-text);background:var(--mbu-bg-hover)}
.fl-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--mbu-border)}
.fl-sw{display:inline-flex;border:1px solid var(--mbu-border);border-radius:999px;overflow:hidden}
.fl-sw button{font:inherit;border:0;background:none;color:var(--mbu-text-dim);padding:2px 10px;cursor:pointer}
.fl-sw button.on{background:var(--mbu-accent-soft);color:var(--mbu-accent-deep-text)}
.fl-chk{display:inline-flex;align-items:center;gap:4px;color:var(--mbu-text-dim);cursor:pointer}
.fl-chk-ic{display:none}
@media (max-width:700px){.fl-chk-ic{display:block}.fl-chk-t{display:none}}
.fl-sp{flex:1 1 auto}
.fl-list{overflow:auto;${SB};height:min(420px,50vh)}
.fl-t{width:100%;border-collapse:collapse}
.fl-t td{padding:4px 8px;border-bottom:1px solid var(--mbu-border-soft,var(--mbu-border));vertical-align:middle}
.fl-t tr:last-child td{border-bottom:0}
.fl-t tr.fl-row{cursor:pointer}
.fl-t tr.fl-row:hover td{background:var(--mbu-bg-hover)}
.fl-t td.fl-c0{width:22px;padding-left:14px}
.fl-t td.fl-cs{white-space:nowrap;width:1%}
.fl-t td.fl-cs .fl-fav{width:20px;height:20px;min-width:20px;max-width:none;object-fit:contain;margin-right:6px;border-radius:4px}
.fl-t td.fl-cn{width:1%;text-align:right;color:var(--mbu-text-weak)}
.fl-t td.fl-cm{width:1%;padding-right:10px}
.fl-tag.genre{font-weight:600}
.fl-tag.genre::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--mbu-accent);margin-right:6px;vertical-align:middle}
.fl-row.have .fl-tag{text-decoration:line-through;color:var(--mbu-text-weak)}
.fl-row.bad .fl-tag{color:var(--mbu-warn)}
.fl-orig{color:var(--mbu-text-weak);font-size:var(--mbu-fs-xs);margin-left:6px}
.fl-sec td{color:var(--mbu-text-weak);font-size:var(--mbu-fs-xs);text-transform:uppercase;letter-spacing:.04em;padding-top:10px}
.fl-sug td{color:var(--mbu-text-dim)}
.fl-empty{padding:18px 14px;color:var(--mbu-text-weak)}
.fl-foot{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid var(--mbu-border)}
.fl-btn{font:inherit;padding:3px 12px;border-radius:var(--mbu-radius);border:1px solid var(--mbu-border);background:var(--mbu-bg);color:var(--mbu-text);cursor:pointer}
.fl-btn:hover{background:var(--mbu-bg-hover)}
.fl-btn.pri{background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-accent-fg)}
.fl-btn.pri:hover{background:var(--mbu-accent-hover)}
.fl-btn:disabled{opacity:.5;cursor:default}
.fl-link{background:none;border:0;padding:0;font:inherit;color:var(--mbu-accent-text);cursor:pointer}
.fl-link:hover{text-decoration:underline}
.fl-menu{position:fixed;z-index:var(--mbu-z-pop,2147483600);min-width:170px;padding:4px 0;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);box-shadow:0 6px 20px rgba(0,0,0,.18);max-height:60vh;overflow:auto;${SB}}
.fl-menu button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;font:inherit;border:0;background:none;color:var(--mbu-text);padding:5px 12px;cursor:pointer}
.fl-menu button:hover{background:var(--mbu-bg-hover)}
.fl-menu hr{border:0;border-top:1px solid var(--mbu-border);margin:4px 0}
.fl-menu .fl-mapin{display:flex;gap:4px;padding:4px 8px}
.fl-in{font:inherit;padding:3px 6px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg);color:var(--mbu-text);min-width:0;flex:1 1 auto;box-sizing:border-box}
.fl-in.err{border-color:var(--mbu-error)}
.fl-ehb.fl-ehb{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px!important;height:28px!important;min-width:0!important;margin-left:2px;padding:0;border:0;border-radius:6px;background:none;cursor:pointer;vertical-align:middle;box-sizing:border-box}
.fl-ehb.fl-ehb:hover{background:color-mix(in srgb,var(--mbu-accent) 14%,transparent)}
.fl-ehb svg{width:22px!important;height:22px!important;flex:none;display:block}
.fl-ehb b{position:absolute;top:-4px;right:-6px;min-width:14px;padding:0 3px;border-radius:7px;background:var(--mbu-accent);color:var(--mbu-text-on-accent);font:700 10px/14px var(--mbu-font);text-align:center;box-sizing:border-box}
.mbu-ov.fl-cfg{background:none}
.fl-cfg .mbu-ov-panel{width:min(680px,94vw);max-height:90vh;box-sizing:border-box;border:1px solid var(--mbu-border);border-radius:10px;background:color-mix(in srgb,var(--mbu-bg) 88%,transparent);backdrop-filter:blur(6px);box-shadow:0 10px 32px rgba(0,0,0,.35);display:flex;flex-direction:column}
.fl-cfg .mbu-ov-body{${SB};flex:1 1 auto;overflow:auto}
.fl-cfg .mbu-cfg-h,.fl-pop .mbu-cfg-h{margin:0;padding:10px 12px 9px 14px}
.fl-tabs{display:flex;gap:2px;padding:0 14px;border-bottom:1px solid var(--mbu-border)}
.fl-tabs button{font:inherit;border:0;border-bottom:2px solid transparent;background:none;color:var(--mbu-text-dim);padding:7px 12px;cursor:pointer;margin-bottom:-1px}
.fl-tabs button:hover{color:var(--mbu-text)}
.fl-tabs button.on{color:var(--mbu-accent-text);border-bottom-color:var(--mbu-accent)}
.fl-cfg h3{margin:14px 0 6px;font-size:var(--mbu-fs);color:var(--mbu-text)}
.fl-cfg h3:first-child{margin-top:0}
.fl-hint{color:var(--mbu-text-weak);font-size:var(--mbu-fs-xs);margin:2px 0 6px}
.fl-opt{display:flex;align-items:center;gap:6px;margin:6px 0;cursor:pointer}
.fl-srcg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.fl-srcg label{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);cursor:pointer}
.fl-srcg label.off{color:var(--mbu-text-weak)}
.fl-srcg label.off .fl-fav{filter:grayscale(1);opacity:.4}
.fl-mt{width:100%;border-collapse:collapse}
.fl-mt th{text-align:left;font-weight:normal;color:var(--mbu-text-weak);font-size:var(--mbu-fs-xs);padding:2px 4px}
.fl-mt td{padding:3px 4px;vertical-align:top}
.fl-mt td.fl-arrow{color:var(--mbu-text-weak);padding-top:6px;width:1%}
.fl-mt td:first-child{width:38%}
.fl-mt td:last-child{width:1%}
.fl-chips{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:2px 4px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);min-height:26px;box-sizing:border-box;background:var(--mbu-bg)}
.fl-chips.err{border-color:var(--mbu-error)}
.fl-chips input{border:0;outline:0;background:none;font:inherit;color:var(--mbu-text);flex:1 1 60px;min-width:60px;padding:2px}
.fl-chip{display:inline-flex;align-items:center;gap:3px;padding:0 4px 0 8px;border-radius:999px;background:var(--mbu-accent-soft);color:var(--mbu-accent-deep-text)}
.fl-chip button{border:0;background:none;color:inherit;cursor:pointer;padding:0 2px;font:inherit;opacity:.6}
.fl-chip button:hover{opacity:1}
.fl-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0}
.fl-pop .mbu-cfg-h{min-width:0}.fl-pop .mbu-cfg-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fl-pop .mbu-cfg-ver{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fl-sw button,.fl-chk{white-space:nowrap}
.fl-phone .mbu-ov-panel{position:fixed!important;border:0!important;border-radius:0!important;margin:0!important;background:var(--mbu-bg)!important}.fl-phone .mbu-cfg-ver{display:none}.fl-phone .mbu-ov-body{flex:1}.fl-phone .fl-list{flex:1 1 0;height:auto}
`;
  const st = document.createElement('style');
  st.textContent = MBU_TOKENS + MBU_UI_CSS + CSS;
  document.head.appendChild(st);

  const DOTS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  const XS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ── the popup ─────────────────────────────────────────────────────────────
  let pop = null;
  const srcIcons = (e, max) => [...e.srcs.keys()].slice(0, max || 10).map(s => fav(s)).join('');
  function tagTip(e) {
    const have = S.have.has(e.name);
    const rows = [...e.srcs].map(([s, urls]) => '<div style="display:flex;align-items:center;gap:6px;margin:2px 0">' + fav(s) + esc(SOURCES[s]) + (urls.size > 1 ? ' · ' + urls.size : '') + '</div>').join('');
    const as = [...e.orig].filter(o => o.toLowerCase() !== e.name);
    return mbuTipCard({
      title: e.name, aside: e.genre ? 'genre' : 'tag',
      body: (rows || '<div>' + (e.fav ? 'A favourite' : '') + '</div>') + (as.length ? '<div style="opacity:.7;margin-top:4px">As ' + esc(as.join(', ')) + '</div>' : ''),
      foot: e.name.includes(',') ? 'Has a comma, which MusicBrainz splits: map it first' : have ? 'Already tagged here' : '',
    });
  }

  function sorted() {
    // a source switched off in the first row drops out of every tag; a tag only it gave goes
    const off = S.off || new Set();
    const list = !off.size ? [...S.tags.values()] : [...S.tags.values()].map(e => {
      const srcs = new Map([...e.srcs].filter(([k]) => !off.has(k)));
      return srcs.size || !e.srcs.size ? Object.assign({}, e, { srcs }) : null;
    }).filter(Boolean);
    return list.sort((a, b) => (b.genre - a.genre) || (b.srcs.size - a.srcs.size) || a.name.localeCompare(b.name));
  }
  function header() {
    // no Log here (the settings window has it); the gear sits left of Help
    const help = mbuHelpHtml('fuzzy_logic');
    return mbuCfgHeader({ icon: ICON, name: NAME, version: VER, script: 'fuzzy_logic' })
      .replace(help, '<button type="button" class="fl-ic fl-gear" data-a="cfg" data-tip="Settings">' + MBU_CFG_ICON + '</button>' + help);
  }
  // the sources read, one button each: a click leaves its tags out, another brings them back
  function srcRow() {
    const off = S.off || new Set();
    const b = Object.entries(S.status).map(([k, v]) => {
      const out = off.has(k), why = v.state === 'err' ? ': ' + v.err : v.state === 'run' ? ': reading…' : ': ' + plural(v.n, 'tag');
      return '<button type="button" class="fl-src' + (out ? ' out' : '') + '" data-a="src" data-s="' + k + '" aria-pressed="' + !out + '" data-tip="' + esc(SOURCES[k] + why + (v.state === 'err' ? '' : out ? ' · left out, click to use' : ' · click to leave out')) + '">'
        + fav(k, v.state === 'err' ? 'off' : v.state === 'run' ? 'run' : '') + '</button>';
    }).join('');
    return b ? '<div class="fl-srcs">' + b + '</div>' : '';
  }
  function body() {
    const list = sorted(), nG = list.filter(e => e.genre).length;
    const shown = S.showAll ? list : list.filter(e => e.genre || e.fav);
    let h = srcRow() + '<div class="fl-bar"><span class="fl-sw">'
      + '<button type="button" data-a="genres" class="' + (S.showAll ? '' : 'on') + '" data-tip="Only MusicBrainz genres">Genres ' + nG + '</button>'
      + '<button type="button" data-a="alltags" class="' + (S.showAll ? 'on' : '') + '" data-tip="Every collected tag">All ' + list.length + '</button></span><span class="fl-sp"></span>';
    if (TYPE === 'release') h += '<label class="fl-chk" data-tip="Vote on its release group and every recording too"><input type="checkbox" data-a="prop"' + (S.prop ? ' checked' : '') + '><svg class="fl-chk-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/><path d="m2 18 10 5 10-5"/></svg><span class="fl-chk-t">Release group + recordings</span></label>';
    h += '</div><div class="fl-list">';
    if (!shown.length) {
      h += '<div class="fl-empty">' + (S.busy ? 'Collecting tags…' : !S.ran ? '' : list.length ? 'No genres among ' + plural(list.length, 'tag') + '.' : 'No tags in this ' + TYPE.replace('-', ' ') + "'s links.") + '</div>';
    } else {
      const vis = shown.filter(e => !e.name.includes(','));
      const allSel = vis.length && vis.every(e => S.sel.has(e.name));
      h += '<table class="fl-t"><tr class="fl-sec"><td class="fl-c0"><input type="checkbox" data-a="selall"' + (allSel ? ' checked' : '') + ' data-tip="Select all"></td><td colspan="2">' + plural(shown.length, S.showAll ? 'tag' : 'genre') + (S.busy ? ' · collecting…' : '') + '</td></tr>';
      for (const e of shown) {
        const bad = e.name.includes(','), have = S.have.has(e.name);
        const as = [...e.orig].filter(o => o.toLowerCase() !== e.name);
        h += '<tr class="fl-row' + (have ? ' have' : '') + (bad ? ' bad' : '') + '" data-t="' + esc(e.name) + '">'
          + '<td class="fl-c0"><input type="checkbox"' + (S.sel.has(e.name) ? ' checked' : '') + (bad ? ' disabled' : '') + '></td>'
          + '<td><span class="fl-tag' + (e.genre ? ' genre' : '') + '">' + esc(e.name) + '</span>' + (as.length ? '<span class="fl-orig">' + esc(as.join(', ')) + '</span>' : '') + '</td>'
          + '<td class="fl-cs">' + srcIcons(e, 6) + '</td></tr>';
      }
      if (S.suggest.length) {
        h += '<tr class="fl-sec"><td></td><td colspan="2">Mapping suggestions</td></tr>' + S.suggest.map((s, i) =>
          '<tr class="fl-sug"><td></td><td>' + esc(s.from) + ' → ' + esc(s.to) + '</td><td class="fl-cm"><button type="button" class="fl-link" data-a="rule" data-i="' + i + '" data-tip="Add this rule to the mapping">Add</button></td></tr>').join('');
      }
      h += '</table>';
    }
    const n = [...S.sel].filter(t => !t.includes(',')).length, off = !n || !loggedIn || S.busy;
    h += '</div><div class="fl-foot"><span class="fl-sp"></span>'
      + '<button type="button" class="fl-btn" data-a="withdraw"' + (off ? ' disabled' : '') + ' data-tip="Withdraw your votes for the selected tags">Withdraw</button>'
      + '<button type="button" class="fl-btn pri" data-a="vote"' + (off ? ' disabled' : '') + ' data-tip="' + (loggedIn ? 'Upvote the selected tags' : 'Log in to vote') + '">Vote ' + n + '</button></div>';
    return h;
  }
  function draw() {
    badge(); drawEhBtn();
    if (!pop) return;
    const sc = pop.querySelector('.fl-list'), top = sc ? sc.scrollTop : 0;
    pop.querySelector('.mbu-cfg-h').outerHTML = header();
    pop.querySelector('.mbu-ov-body').innerHTML = body();
    const sc2 = pop.querySelector('.fl-list'); if (sc2) sc2.scrollTop = top;
    const lg = pop.querySelector('.mbu-cfg-log'); if (lg) lg.onclick = () => LOG.open();
  }
  // on a phone the window fills the screen: MB's page is wider than it, so pin to the visual viewport
  function pinPop() {
    const vv = window.visualViewport, p = pop && pop.querySelector('.mbu-ov-panel');
    if (!p) return;
    const props = ['left', 'top', 'width', 'height', 'max-width', 'max-height', 'transform', 'inset', 'right', 'bottom'];
    if (!vv || vv.width > 600) { props.forEach(k => p.style.removeProperty(k)); pop.classList.remove('fl-phone'); return; }
    pop.classList.add('fl-phone');
    const set = { left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', right: 'auto', bottom: 'auto', inset: 'auto', width: vv.width + 'px', height: vv.height + 'px', 'max-width': 'none', 'max-height': 'none', transform: 'none' };
    p.style.removeProperty('inset');
    for (const k in set) if (k !== 'inset') p.style.setProperty(k, set[k], 'important');
  }
  function closePop() {
    if (!pop) return;
    if (window.visualViewport) { visualViewport.removeEventListener('resize', pinPop); visualViewport.removeEventListener('scroll', pinPop); }
    closeMenu(); pop.remove(); pop = null; document.removeEventListener('keydown', popKey, true);
  }
  const popKey = e => { if (e.key === 'Escape' && !document.querySelector('.fl-menu') && !document.querySelector('.fl-cfg')) { e.stopPropagation(); closePop(); } };
  function openPop() {
    if (!TYPE) return;
    if (pop) { closePop(); return; }
    pop = document.createElement('div');
    pop.className = 'mbu-ov fl-pop fl-ui mbu-ui';
    pop.innerHTML = '<div class="mbu-ov-panel" role="dialog" aria-label="' + NAME + '"><div class="mbu-cfg-h"></div><div class="mbu-ov-body"></div></div>';
    document.body.appendChild(pop);
    mbuCfgDrag(pop.querySelector('.mbu-ov-panel'));
    pinPop(); requestAnimationFrame(() => requestAnimationFrame(pinPop)); [150, 400, 1000].forEach(t => setTimeout(pinPop, t));
    if (window.visualViewport) { visualViewport.addEventListener('resize', pinPop); visualViewport.addEventListener('scroll', pinPop); }
    document.addEventListener('keydown', popKey, true);
    pop.addEventListener('mousedown', e => { if (e.target === pop) closePop(); });
    pop.addEventListener('click', onPopClick);
    pop.addEventListener('contextmenu', e => { const r = e.target.closest('tr.fl-row'); if (!r) return; e.preventDefault(); openMenu(r, r.dataset.t); });
    pop.addEventListener('change', e => { if (e.target.dataset.a === 'prop') { S.prop = CFG.propRG = CFG.propRec = e.target.checked; saveCfg(); } });
    S.have = haveNow();
    draw();
    if (!S.ran && !S.busy) collect();
    LOG.info('Opened' + (S.eh ? ' from Event Horizon' : ''));
  }
  function onPopClick(e) {
    if (e.target.closest('.mbu-cfg-x')) { e.preventDefault(); closePop(); return; }
    const a = e.target.closest('[data-a]');
    const row = e.target.closest('.fl-row');
    if (a) {
      const act = a.dataset.a;
      if (act === 'src') {
        const k = a.dataset.s; S.off = S.off || new Set();
        if (S.off.has(k)) S.off.delete(k); else S.off.add(k);
        const keep = new Set(sorted().map(e => e.name));
        for (const t of [...S.sel]) if (!keep.has(t)) S.sel.delete(t);
        LOG.info(SOURCES[k] + (S.off.has(k) ? ' left out' : ' used again'));
        draw();
      }
      else if (act === 'cfg') openCfg();
      else if (act === 'genres' || act === 'alltags') { S.showAll = act === 'alltags'; CFG.genresOnly = !S.showAll; saveCfg(); draw(); }
      else if (act === 'selall') {
        const list = sorted().filter(x => (S.showAll || x.genre || x.fav) && !x.name.includes(','));
        list.forEach(x => a.checked ? S.sel.add(x.name) : S.sel.delete(x.name)); draw();
      }
      else if (act === 'vote') doVote('upvote');
      else if (act === 'withdraw') doVote('withdraw');
      else if (act === 'menu') { e.stopPropagation(); openMenu(a, row.dataset.t); }
      else if (act === 'rule') { const s = S.suggest[+a.dataset.i]; addRule(s.from, [s.to]); S.sel.add(s.to); }
      return;
    }
    if (row) {
      const t = row.dataset.t;
      if (t.includes(',')) { mbuToast('⚠ "' + t + '" has a comma, which MusicBrainz splits; map it first', { kind: 'warn' }); return; }
      S.sel.has(t) ? S.sel.delete(t) : S.sel.add(t); draw();
    }
  }
  function addRule(from, to) {
    CFG.mapper = (CFG.mapper.trim() + '\n' + from + ' → ' + to.join('; ')).trim(); saveCfg();
    LOG.info('Mapping added: ' + from + ' → ' + to.join('; '));
    rebuild(); draw();
  }

  // the ⋯ menu of a tag: map it, ignore it, make it a favourite, open where it came from
  let menu = null, menuOff = null;
  function closeMenu() { if (menuOff) menuOff(); menuOff = null; if (menu) menu.remove(); menu = null; }
  function openMenu(btn, name) {
    closeMenu();
    const e = S.tags.get(name); if (!e) return;
    const isFav = favs().includes(name);
    menu = document.createElement('div');
    menu.className = 'fl-menu fl-ui mbu-ui';
    const from = e.orig.size === 1 ? [...e.orig][0] : name;
    let h = '<div class="fl-mapin"><input class="fl-in" data-m="to" placeholder="Map ' + esc(from) + ' to…" spellcheck="false"><button type="button" class="fl-btn" data-m="map">Map</button></div><hr>'
      + '<button type="button" data-m="ignore">Ignore ' + esc(name) + '</button>'
      + '<button type="button" data-m="fav">' + (isFav ? 'No longer a favourite' : 'Favourite') + '</button>';
    const urls = [...e.srcs].flatMap(([s, us]) => [...us].map(u => [s, u]));
    if (urls.length) h += '<hr>' + urls.map(([s, u]) => '<button type="button" data-m="open" data-u="' + esc(u) + '" data-tip="' + esc(u) + '">' + fav(s) + 'Open on ' + esc(SOURCES[s]) + '</button>').join('');
    menu.innerHTML = h;
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8)) + 'px';
    menu.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
    const inp = menu.querySelector('[data-m=to]');
    const doMap = () => {
      const to = inp.value.split(';').map(s => s.trim()).filter(Boolean);
      if (!to.length) { inp.classList.add('err'); inp.focus(); return; }   // nothing on the right is Ignore
      closeMenu(); S.sel.delete(name); to.forEach(t => S.sel.add(t.toLowerCase()));
      addRule(from, to);
    };
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doMap(); } else if (ev.key === 'Escape') { ev.stopPropagation(); closeMenu(); } });
    menu.addEventListener('click', ev => {
      const b = ev.target.closest('[data-m]'); if (!b || b === inp) return;
      const m = b.dataset.m;
      if (m === 'map') { doMap(); return; }
      closeMenu();
      if (m === 'ignore') { CFG.ignore = (CFG.ignore.trim() + '\n' + name).trim(); saveCfg(); LOG.info('Ignored: ' + name); }
      else if (m === 'fav') {
        const f = favs(); CFG.favourites = (isFav ? f.filter(x => x !== name) : f.concat(name)).join('\n'); saveCfg();
        LOG.info((isFav ? 'Unfavourited: ' : 'Favourite: ') + name);
      }
      else if (m === 'open') { window.open(b.dataset.u, '_blank', 'noopener'); return; }
      rebuild(); draw();
    });
    menuOff = mbuDismissOn(menu, closeMenu, { ignore: '[data-a=menu]' }) || null;
    if (typeof menuOff !== 'function') menuOff = null;
    inp.focus();
  }

  async function doVote(kind) {
    const tags = [...S.sel].filter(t => !t.includes(','));
    if (!tags.length) return;
    if (S.eh && !S.prop) {
      // from Event Horizon's editor: it votes and redraws its own chips
      LOG.info((kind === 'upvote' ? 'Adding' : 'Withdrawing') + ' through Event Horizon: ' + tags.join(', '));
      document.dispatchEvent(new CustomEvent(kind === 'upvote' ? 'mbu-tags-add' : 'mbu-tags-remove', { detail: { names: tags } }));
      if (kind === 'upvote') tags.forEach(t => { S.have.add(t); S.ent.add(t); }); else tags.forEach(t => { S.have.delete(t); S.ent.delete(t); });
      if (kind !== 'upvote') {
        // EH has no bulk remove yet: vote ourselves too
        try { await vote([{ type: TYPE, mbid: MBID }], tags, kind); } catch (e) { LOG.warn('Withdraw failed: ' + e.message); }
      }
      S.sel.clear(); draw(); if (kind === 'upvote') closePop(); return;
    }
    S.busy = true; draw();
    try {
      const n = await vote(await targets(), tags, kind);
      if (kind === 'upvote') tags.forEach(t => { S.have.add(t); S.ent.add(t); }); else tags.forEach(t => { S.have.delete(t); S.ent.delete(t); });
      // Event Horizon's header shows them at once (mbu-tags-voted), no reload
      const ehOn = !!document.querySelector('button.eh-edit[data-tgin]');
      if (kind === 'upvote' && ehOn) document.dispatchEvent(new CustomEvent('mbu-tags-voted', { detail: { path: '/' + TYPE + '/' + MBID, genres: tags.filter(t => (S.tags.get(t) || {}).genre), tags: tags.filter(t => !(S.tags.get(t) || {}).genre) } }));
      S.sel.clear(); if (kind === 'upvote') closePop();
      mbuToast('✓ ' + (kind === 'upvote' ? 'Voted ' : 'Withdrew ') + plural(tags.length, 'tag') + ' on ' + n + ' entit' + (n === 1 ? 'y' : 'ies') + (kind === 'upvote' && !ehOn ? '; reload to see them' : ''), { kind: 'ok' });
    } catch (e) {
      LOG.error('Vote failed: ' + e.message);
      mbuToast('⚠ Vote failed: ' + e.message, { kind: 'warn' });
    }
    S.busy = false; draw();
  }

  // ── settings window ───────────────────────────────────────────────────────
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  let cfgTab = 'general';
  function openCfg() {
    if (document.querySelector('.fl-cfg')) return;
    const ov = document.createElement('div');
    ov.className = 'mbu-ov fl-cfg fl-ui mbu-ui';
    // the mapping table works on rows; the text in CFG.mapper is what is kept, exported and imported
    let rows = lines(CFG.mapper).filter(l => !l.startsWith('#')).map(l => {
      const m = l.match(/^(.*?)\s*(?:→|->)\s*(.*)$/);
      return m ? { src: m[1].trim(), right: m[2].split(';').map(s => s.trim()).filter(Boolean) } : null;
    }).filter(Boolean);
    let filter = '';
    const chipsBox = (list, key, ph) => '<div class="fl-chips' + (key.startsWith('r') && !list.length ? ' err' : '') + '" data-c="' + key + '">'
      + list.map((t, i) => '<span class="fl-chip">' + esc(t) + '<button type="button" data-cx="' + i + '" aria-label="Remove">×</button></span>').join('')
      + '<input placeholder="' + esc(ph) + '" spellcheck="false"></div>';
    const tabs = { general: 'General', sources: 'Sources', mapping: 'Mapping', lists: 'Lists' };
    function tabBody() {
      if (cfgTab === 'general') {
        return ''
          + '<h3>Background</h3><label class="fl-opt"><input type="checkbox" data-k="background"' + (CFG.background ? ' checked' : '') + '>Collect tags when a page opens</label>'
          + '<div class="fl-hint">The launcher then shows how many genres are new here. Off, collecting starts when you open the window.</div>'
          ;
      }
      if (cfgTab === 'sources') {
        return '<div class="fl-hint">Where tags are read from, through the entity\'s links.</div><div class="fl-srcg">' + Object.entries(SOURCES).map(([k, v]) =>
          '<label class="' + (CFG.sources[k] ? '' : 'off') + '"><input type="checkbox" data-src="' + k + '"' + (CFG.sources[k] ? ' checked' : '') + '>' + fav(k) + esc(v) + '</label>').join('') + '</div>';
      }
      if (cfgTab === 'mapping') {
        const f = filter.toLowerCase();
        return '<div class="fl-hint">A collected tag on the left becomes the tags on the right. <code>/regex/</code> on the left, <code>$1</code> on the right. The first match wins. To drop a tag, ignore it (Lists).</div>'
          + '<div class="fl-tools"><input class="fl-in" data-x="filter" placeholder="Filter" value="' + esc(filter) + '" style="max-width:200px">'
          + '<span class="fl-sp"></span><button type="button" class="fl-btn" data-x="add">+ Rule</button><button type="button" class="fl-btn" data-x="import">Import</button>'
          + '<button type="button" class="fl-btn" data-x="export">Export</button><button type="button" class="fl-btn" data-x="reset">Defaults</button></div>'
          + '<table class="fl-mt"><tr><th>Collected</th><th></th><th>Becomes</th><th></th></tr>'
          + rows.map((r, i) => (f && !(r.src + ' ' + r.right.join(' ')).toLowerCase().includes(f)) ? '' :
            '<tr data-r="' + i + '"><td><input class="fl-in' + (r.src.trim() ? '' : ' err') + '" data-l="' + i + '" value="' + esc(r.src) + '" spellcheck="false" style="width:100%"></td><td class="fl-arrow">→</td>'
            + '<td>' + chipsBox(r.right, 'r' + i, r.right.length ? '' : 'a tag, Enter') + '</td>'
            + '<td><button type="button" class="fl-ic" data-x="del" data-i="' + i + '" data-tip="Delete the rule">' + XS + '</button></td></tr>').join('')
          + '</table>' + (rows.length ? '' : '<div class="fl-hint">No rules.</div>');
      }
      return '<h3>Ignore</h3><div class="fl-hint">Never shown. <code>/regex/</code> works.</div>' + chipsBox(lines(CFG.ignore), 'ignore', 'a tag, Enter')
        + '<h3>Favourites</h3><div class="fl-hint">Always offered, collected or not.</div>' + chipsBox(favs(), 'favourites', 'a tag, Enter');
    }
    function paint(focus) {
      ov.querySelector('.fl-tabs').innerHTML = Object.entries(tabs).map(([k, v]) => '<button type="button" data-tab="' + k + '" class="' + (k === cfgTab ? 'on' : '') + '">' + v + '</button>').join('');
      ov.querySelector('.mbu-ov-body').innerHTML = tabBody();
      if (focus) { const el = ov.querySelector(focus); if (el) { el.focus(); if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); } }
    }
    const saveRows = () => { CFG.mapper = rulesText(rows); saveCfg(); };
    const listSet = (key, list) => { CFG[key] = list.join('\n'); saveCfg(); };
    const chipList = key => key[0] === 'r' ? rows[+key.slice(1)].right : key === 'ignore' ? lines(CFG.ignore) : favs();
    const chipAdd = (key, val) => {
      const v = val.trim(); if (!v) return;
      if (key[0] === 'r') { rows[+key.slice(1)].right.push(...v.split(';').map(s => s.trim()).filter(Boolean)); saveRows(); }
      else { const l = chipList(key); if (!l.includes(v)) listSet(key, l.concat(key === 'favourites' ? v.toLowerCase() : v)); }
      paint('[data-c="' + key + '"] input');
    };
    ov.innerHTML = '<div class="mbu-ov-panel" role="dialog" aria-label="' + NAME + ' settings">'
      + mbuCfgHeader({ icon: ICON, name: NAME, version: VER, log: true, script: 'fuzzy_logic' })
      + '<div class="fl-tabs"></div><div class="mbu-ov-body"></div></div>';
    document.body.appendChild(ov);
    paint();
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); rebuild(); draw(); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.querySelector('.mbu-cfg-x').onclick = close;
    const lg = ov.querySelector('.mbu-cfg-log'); if (lg) lg.onclick = () => LOG.open();
    ov.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.src) { CFG.sources[t.dataset.src] = t.checked; saveCfg(); paint(); }
      else if (t.dataset.k === 'background') { CFG.background = t.checked; saveCfg(); if (t.checked && !S.ran) collect(); }
    });
    ov.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.x === 'filter') { filter = t.value; paint('[data-x=filter]'); }
      else if (t.dataset.l !== undefined) { rows[+t.dataset.l].src = t.value; t.classList.toggle('err', !t.value.trim()); saveRows(); }
    });
    ov.addEventListener('keydown', e => {
      const box = e.target.closest('.fl-chips'); if (!box || e.target.tagName !== 'INPUT') return;
      if (e.key === 'Enter' || e.key === ';') { e.preventDefault(); chipAdd(box.dataset.c, e.target.value); }
      else if (e.key === 'Backspace' && !e.target.value) {
        const k = box.dataset.c, l = chipList(k); if (!l.length) return;
        if (k[0] === 'r') { l.pop(); saveRows(); } else listSet(k, l.slice(0, -1));
        paint('[data-c="' + k + '"] input');
      }
    });
    ov.addEventListener('focusout', e => { const box = e.target.closest && e.target.closest('.fl-chips'); if (box && e.target.value && e.target.value.trim()) chipAdd(box.dataset.c, e.target.value); });
    ov.addEventListener('click', e => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { cfgTab = tb.dataset.tab; paint(); return; }
      const cx = e.target.closest('[data-cx]');
      if (cx) {
        const k = cx.closest('.fl-chips').dataset.c, l = chipList(k); l.splice(+cx.dataset.cx, 1);
        if (k[0] === 'r') saveRows(); else listSet(k, l);
        paint(); return;
      }
      const x = e.target.closest('[data-x]');
      if (!x || x.tagName === 'INPUT') { const cb = e.target.closest('.fl-chips'); if (cb && e.target === cb) cb.querySelector('input').focus(); return; }
      const act = x.dataset.x;
      if (act === 'add') { rows.unshift({ src: '', right: [] }); filter = ''; paint('[data-l="0"]'); }
      else if (act === 'del') { rows.splice(+x.dataset.i, 1); saveRows(); paint(); }
      else if (act === 'export') download('fuzzy-logic-mapping.txt', CFG.mapper + '\n');
      else if (act === 'reset') { CFG.mapper = DEFAULT_MAPPER; saveCfg(); ov.remove(); document.removeEventListener('keydown', onKey, true); openCfg(); }
      else if (act === 'import') {
        const f = document.createElement('input'); f.type = 'file'; f.accept = '.txt,text/plain';
        f.onchange = async () => {
          if (!f.files[0]) return;
          const txt = (await f.files[0].text()).replace(/\r/g, '').trim();
          const rules = parseRules(txt);
          CFG.mapper = rules.map(r => r.src + ' → ' + r.right.join('; ')).join('\n'); saveCfg();
          rows = rules.map(r => ({ src: r.src, right: r.right.slice() })); paint();
          mbuToast('✓ Imported ' + plural(rules.length, 'mapping rule'), { kind: 'ok' });
        };
        f.click();
      }
    });
  }
  GM_registerMenuCommand(NAME + ' settings', openCfg);

  // ── the launcher (String Theory's dock) ───────────────────────────────────
  let dock = null;
  function badge() { if (dock && !busyAt) {   // a count would swap the busy icon out mid-round; it waits for the round to end
    const n = fresh(); dock.status(S.ran || n ? String(n || '') : ''); } }
  // Off waits for the round to finish, when the rings are back in place, so the animation never snaps
  let busyAt = 0, busyOff = 0;
  function dockBusy(on) {
    if (!dock) return;
    clearTimeout(busyOff);
    if (on) { if (!busyAt) { busyAt = Date.now(); dock.busy(true); } return; }
    if (!busyAt) return;
    busyOff = setTimeout(() => { busyAt = 0; dock.busy(false); badge(); }, 1600 - (Date.now() - busyAt) % 1600);
  }
  function mkDock() {
    if (dock || !TYPE) return;
    dock = mbuDockItem({
      id: 'mb-fl-dock', label: NAME, icon: ICON_URI, busyIcon: BUSY_URI, order: 63,
      paths: '^/(release|release-group|artist|label|recording)/[0-9a-fA-F-]{36}/?$',
      click: () => openPop(),
    });
    dock.addEventListener('contextmenu', e => { e.preventDefault(); openCfg(); });
    dock.card(() => mbuTipCard({ title: NAME, body: mbuTipText((S.ran ? plural(fresh(), 'new genre') + ' from ' + plural(Object.keys(S.status).length, 'source') : 'Tags from this entity\'s links') + '\nRight-click: settings') }));
  }

  // ── Event Horizon ─────────────────────────────────────────────────────────
  // An icon beside the ✓ of EH's tag editor while it is open (none beside the pencil). EH's editor tells which entity it
  // edits and where its box is (mbu-tags-edit); the window's votes then go through EH (mbu-tags-add), which votes and
  // redraws. A click before the editor is open opens it first, so the votes always go through EH.
  const ehBtn = document.createElement('button');
  ehBtn.type = 'button'; ehBtn.className = 'fl-ehb mbu-ui';
  ehBtn.addEventListener('mousedown', e => e.preventDefault());   // keeps the focus in EH's input
  ehBtn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    openPop();
  });
  // EH can name its box while the editor is shut: the pencil then
  const ehAnchor = () => S.eh && S.eh.querySelector('button[data-tgin="close"]');
  function drawEhBtn() {
    const a = ehAnchor();
    if (!a) { ehBtn.remove(); return; }
    if (a.nextElementSibling !== ehBtn) a.after(ehBtn);
    const n = fresh();
    ehBtn.innerHTML = ICON_SM + (S.ran && n ? '<b>' + n + '</b>' : '');
    ehBtn.setAttribute('aria-label', NAME);
    mbuTip(ehBtn, NAME + (S.busy ? ': collecting…' : S.ran ? ': ' + plural(n, 'genre') + ' from the links, not tagged yet' : ': tags from the links'));
  }
  document.addEventListener('mbu-tags-edit', e => {
    const d = e.detail || {}, m = d.path && d.path.match(/^\/(release|release-group|artist|label|recording)\/([0-9a-f-]{36})$/);
    S.eh = d.box && m ? d.box : null;
    if (S.eh && (m[1] !== TYPE || m[2] !== MBID)) {
      TYPE = m[1]; MBID = m[2]; reset();
      LOG.info('Event Horizon edits ' + TYPE + ' ' + MBID);
    }
    if (!S.eh && pop) closePop();
    S.have = haveNow();
    if (S.eh && !S.ran && !S.busy) collect(); else draw();
  });
  // EH redraws its header (and the editor) whenever it likes: put the icon back beside the pencil each time
  let ehQ = 0;
  new MutationObserver(() => { if (!ehQ) ehQ = requestAnimationFrame(() => { ehQ = 0; const a = ehAnchor(); if (a && a.nextElementSibling !== ehBtn) drawEhBtn(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });   // EH swaps the body

  // Event Horizon moves between pages without a load (pushState, a new body): start over on another entity
  function navCheck() {
    if (location.pathname === PATH) return;
    PATH = location.pathname;
    const m = PATH.match(ENT_RE);
    if (m && m[1] === TYPE && m[2] === MBID) return;
    closePop(); reset(); S.eh = null; S.have = haveNow();
    TYPE = m ? m[1] : null; MBID = m ? m[2] : null;
    LOG.session();   // each entity its own session in the history
    LOG.info(TYPE ? 'Navigated to ' + TYPE + ' ' + MBID : 'Navigated off an entity');
    mkDock(); draw();
    if (TYPE && CFG.background) collect();
  }
  addEventListener('popstate', () => setTimeout(navCheck));
  new MutationObserver(() => navCheck()).observe(document.documentElement, { childList: true, subtree: true });

  window.__fuzzyLogic = S;   // for the specs
  mkDock();
  if (TYPE && CFG.background) collect();
})();
