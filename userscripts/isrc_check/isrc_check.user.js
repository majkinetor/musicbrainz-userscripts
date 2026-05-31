// ==UserScript==
// @name         MusicBrainz → MagicISRC Button
// @namespace    https://musicbrainz.org/
// @version      2026.5.31.155254
// @description  Adds a "ISRC" check button on MusicBrainz release pages. Highlights if any tracks are missing ISRCs. Navigates to MagicISRC.
// @author       You
// @match        https://musicbrainz.org/release/*
// @match        https://beta.musicbrainz.org/release/*
// @grant        GM_xmlhttpRequest
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Extract release MBID from URL
  const mbid = window.location.pathname.match(/\/release\/([a-f0-9-]{36})/)?.[1];
  if (!mbid) return;

  const magicUrl = 'https://magicisrc.kepstin.ca/?mbid=' + mbid;

  // ── Styles ──
  const style = document.createElement('style');
  style.textContent = `
    #mb-magicisrc-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      margin-left: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #fff !important;
      background: #6f42c1;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      vertical-align: middle;
      transition: background .15s;
      white-space: nowrap;
    }
    #mb-magicisrc-btn:hover { background: #5a32a3; color: #fff; text-decoration: none; }
    #mb-magicisrc-btn.has-missing {
      background: #d63384;
      animation: mb-pulse 1.5s ease-in-out infinite;
    }
    #mb-magicisrc-btn.has-missing:hover { background: #a0225e; }
    #mb-magicisrc-btn .mb-isrc-status {
      font-size: 10px;
      font-weight: 600;
      opacity: .85;
    }
    @keyframes mb-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: .75; }
    }
  `;
  document.head.appendChild(style);

  // ── Create button ──
  const btn = document.createElement('a');
  btn.id = 'mb-magicisrc-btn';
  btn.href = magicUrl;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    MagicISRC
    <span class="mb-isrc-status" id="mb-isrc-status">⏳</span>
  `;

  // ── Inject next to release title ──
  // MB release page: h1 contains the release title
  function inject() {
    const h1 = document.querySelector('h1');
    if (!h1) return false;
    // Don't inject twice
    if (document.getElementById('mb-magicisrc-btn')) return true;
    h1.appendChild(btn);
    return true;
  }

  if (!inject()) {
    const obs = new MutationObserver(() => { if (inject()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ── Fetch release data and check for missing ISRCs ──
  GM_xmlhttpRequest({
    method: 'GET',
    url: location.origin + '/ws/2/release/' + mbid + '?inc=recordings+isrcs&fmt=json',
    headers: { 'Accept': 'application/json', 'User-Agent': 'MB-MagicISRC-Helper/1.0' },
    onload(r) {
      const statusEl = document.getElementById('mb-isrc-status');
      if (r.status !== 200) {
        if (statusEl) statusEl.textContent = '?';
        return;
      }
      try {
        const data = JSON.parse(r.responseText);
        let total = 0, missing = 0;
        (data.media || []).forEach(med => {
          (med.tracks || []).forEach(trk => {
            total++;
            const isrcs = trk.recording?.isrcs || [];
            if (!isrcs.length) missing++;
          });
        });
        if (statusEl) {
          if (missing === 0) {
            statusEl.textContent = `✓ ${total}/${total}`;
          } else {
            statusEl.textContent = `⚠ ${total - missing}/${total}`;
            btn.classList.add('has-missing');
            btn.title = `${missing} track${missing > 1 ? 's' : ''} missing ISRC`;
          }
        }
      } catch(e) {
        if (statusEl) statusEl.textContent = '?';
      }
    },
    onerror() {
      const statusEl = document.getElementById('mb-isrc-status');
      if (statusEl) statusEl.textContent = '?';
    }
  });

})();