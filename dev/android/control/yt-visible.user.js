// ==UserScript==
// @name         EH test: YouTube embed sees a visible page
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts/dev/android
// @version      3
// @description  Test for #1104: the YouTube embed pauses when the page is hidden. This hides that from the embed.
// @match        https://www.youtube-nocookie.com/embed/*
// @match        https://www.youtube.com/embed/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==
(() => {
  const P = Document.prototype;
  Object.defineProperty(P, 'hidden', { get: () => false, configurable: true });
  Object.defineProperty(P, 'visibilityState', { get: () => 'visible', configurable: true });
  Object.defineProperty(P, 'webkitHidden', { get: () => false, configurable: true });
  Object.defineProperty(P, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
  const stop = e => e.stopImmediatePropagation();
  for (const t of ['visibilitychange', 'webkitvisibilitychange']) { window.addEventListener(t, stop, true); document.addEventListener(t, stop, true); }
  // the video's events go to server.mjs, so a background run shows what the embed did and when
  // YouTube's security policy blocks a request to the server, so the line goes to the page, which sends it on
  const log = (...a) => { try { parent.postMessage({ ehTestLog: 'yt ' + location.pathname.split('/').pop() + ' ' + a.join(' ') }, '*'); } catch (e) {} };
  let last = 0;
  for (const t of ['play', 'playing', 'pause', 'ended', 'waiting', 'stalled', 'error', 'emptied'])
    document.addEventListener(t, e => { if (e.target instanceof HTMLMediaElement) log(t, e.target.currentTime.toFixed(1)); }, true);
  document.addEventListener('timeupdate', e => { if (Date.now() - last > 5000) { last = Date.now(); log('time', e.target.currentTime.toFixed(1)); } }, true);
  log('loaded');
})();
