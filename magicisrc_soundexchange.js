// ==UserScript==
// @name         MagicISRC → SoundExchange Quick Search
// @namespace    https://magicisrc.kepstin.ca/
// @version      3.5
// @description  Adds MB release list and SoundExchange ISRC search to MagicISRC. Shows MB/SX durations, highlights mismatches, batch search button.
// @author       majkinetor
// @match        https://magicisrc.kepstin.ca/*
// @match        https://magicisrc-beta.kepstin.ca/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      isrc-api.soundexchange.com
// @connect      isrc.soundexchange.com
// @connect      musicbrainz.org
// @connect      *
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/577713/MagicISRC%20%E2%86%92%20SoundExchange%20Quick%20Search.user.js
// @updateURL https://update.greasyfork.org/scripts/577713/MagicISRC%20%E2%86%92%20SoundExchange%20Quick%20Search.meta.js
// ==/UserScript==

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════════ */
  const SX_API   = 'https://isrc-api.soundexchange.com/api/ext/recordings';
  const SX_HOME  = 'https://isrc.soundexchange.com/';
  const MB_WS2   = 'https://musicbrainz.org/ws/2/';
  const BATCH_DELAY = 650;

  /* ═══════════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════════ */
  const style = document.createElement('style');
  style.textContent = `
    /* MB releases list */
    .sx-mb-rels { margin-top: 4px; margin-bottom: 2px; overflow: visible; }
    .sx-mb-rel  { display: flex; align-items: baseline; gap: 6px; font-size: 11px; color: #495057; line-height: 1.5; }
    .sx-mb-rel-len  { font-family: 'Courier New', monospace; font-size: 10.5px; color: #6c757d; flex-shrink: 0; min-width: 30px; }
    .sx-mb-rel-year { font-size: 10.5px; color: #6c757d; flex-shrink: 0; min-width: 32px; }
    .sx-mb-rel-title { font-size: 11px; color: #212529; white-space: normal; word-break: break-word; }
    .sx-mb-rel-label { font-size: 10px; color: #6c757d; white-space: nowrap; flex-shrink: 0; font-style: italic; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    .sx-mb-rel-more  { font-size: 10.5px; color: #6c757d; font-style: italic; cursor: pointer; }
    .sx-mb-rel-more:hover { color: #0d6efd; text-decoration: underline; }
    .sx-mb-spin { font-size: 10.5px; color: #6c757d; margin-top: 3px; display: block; cursor: default; }
    .sx-mb-spin.retry { cursor: pointer; color: #dc3545; }
    .sx-mb-spin.retry:hover { text-decoration: underline; }

    /* wrap containing badges + chip */
    .sx-wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 5px; overflow: visible; }
    td:has(.sx-wrap) { overflow: visible !important; position: relative; z-index: 10; }

    /* duration badges */
    .sx-dur { display: inline-flex; align-items: center; gap: 3px; font-family: 'Courier New', monospace;
      font-size: 11px; padding: 1px 6px; border-radius: 4px; white-space: nowrap; border: 1px solid; }
    .sx-dur-mb { color: #495057; background: #f8f9fa; border-color: #ced4da; }
    .sx-dur-sx { color: #0a58ca; background: #dce8ff; border-color: #9ec5fe; }
    .sx-dur-label { font-size: 9px; font-weight: 700; letter-spacing: .4px; opacity: .65;
      text-transform: uppercase; font-family: system-ui, sans-serif; }

    /* inline chip */
    .sx-chip { display: inline-flex; align-items: center; gap: 7px; padding: 3px 9px 3px 8px;
      border: 1px solid #9ec5fe; border-radius: 5px; background: #dce8ff; cursor: pointer;
      width: max-content; max-width: min(640px, 88vw); box-sizing: border-box;
      transition: background .12s, border-color .12s; }
    .sx-chip:hover { background: #bdd5fc; border-color: #0d6efd; }
    .sx-chip-isrc { font-family: 'Courier New', monospace; font-size: 11.5px; font-weight: 700;
      color: #084298; white-space: nowrap; flex-shrink: 0; }
    .sx-chip-meta { font-size: 11px; color: #495057; white-space: nowrap;
      min-width: 120px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
    .sx-chip-rel  { font-size: 10.5px; color: #374151; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; max-width: min(500px, 88vw);
      display: block; margin-top: 1px; opacity: .85; }
    .sx-chip-more { font-size: 10px; color: #6c757d; white-space: nowrap; flex-shrink: 0;
      border-left: 1px solid #9ec5fe; padding-left: 7px; margin-left: 1px; }
    .sx-chip:hover .sx-chip-more { color: #0d6efd; }
    .sx-chip-none  { font-size: 11px; color: #6c757d; font-style: italic; }
    .sx-chip-err   { font-size: 11px; color: #dc3545; }
    .sx-chip-spin  { font-size: 11px; color: #6c757d; }
    .sx-field-bad  { background: #ff9966 !important; border-radius: 3px; padding: 0 3px; color: #5c1a00 !important; font-weight: 700; }
    .sx-next-isrc { display: inline-flex; align-items: center; padding: 3px 10px;
      font-size: 11.5px; font-weight: 600; font-family: 'Courier New', monospace;
      color: #6c757d; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;
      cursor: pointer; white-space: nowrap; flex-shrink: 0; }
    .sx-next-isrc:hover { background: #e9ecef; color: #212529; border-color: #adb5bd; }
    .sx-open-btn { display: inline-flex; align-items: center; padding: 2px 8px;
      font-size: 11px; color: #0d6efd; background: #fff; border: 1px solid #9ec5fe;
      border-radius: 4px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
    .sx-open-btn:hover { background: #dce8ff; border-color: #0d6efd; }
    .sx-isrc-info { display: inline-flex; align-items: center; font-size: 11px; white-space: nowrap; }
    .sx-isrc-info-ok   { color: #198754; }
    .sx-isrc-info-warn { color: #856404; }
    .sx-isrc-info-err  { color: #dc3545; font-size: 10.5px; }

    /* row highlights */
    .sx-no-isrc       { background-color: #e8eaf6 !important; }
    .sx-no-isrc:hover { background-color: #d1d5eb !important; }
    .sx-mismatch       { background-color: #fff3cd !important; }
    .sx-mismatch:hover { background-color: #ffe69c !important; }
    .sx-songmismatch       { background-color: #ffe5d0 !important; }
    .sx-songmismatch:hover { background-color: #ffc9a0 !important; }

    /* Search on SoundExchange bar */
    .sx-all-bar { display: flex; align-items: center; gap: 10px;
      padding: 5px 10px; background: #f8f9fa; border: 1px solid #dee2e6;
      border-bottom: 1px solid #dee2e6; font-size: 11.5px; flex-wrap: wrap;
      border-radius: 0; margin: 0; position: sticky; top: 0; z-index: 9998;
      box-shadow: 0 2px 4px rgba(0,0,0,.1); }
    .sx-exact-wrap { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #495057; cursor: pointer; }
    .sx-exact-wrap input[type=checkbox] { cursor: pointer; }
    .sx-exact-label { user-select: none; }
    /* Panel exact toggles */
    .sx-pexact-item { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #6c757d; cursor: pointer; }
    .sx-pexact-item input { cursor: pointer; }
    .sx-all-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 13px;
      font-size: 11.5px; font-weight: 600; color: #fff; background: #6f42c1;
      border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; transition: background .15s; }
    .sx-all-btn:hover    { background: #5a32a3; }
    .sx-all-btn:disabled { background: #adb5bd; cursor: default; }
    .sx-all-prog { font-size: 11px; color: #6c757d; }

    /* flash on fill */
    @keyframes sx-flash { 0% { background-color: rgba(25,135,84,.18); } 100% { background-color: transparent; } }
    .sx-flashed { animation: sx-flash .9s ease-out forwards; }

    /* floating panel */
    #sx-panel { position: fixed; top: 60px; right: 16px; width: 560px; max-width: 95vw; max-height: 82vh;
      background: #fff; border: 1px solid #dee2e6; border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18); z-index: 999999; display: none;
      flex-direction: column; font-family: system-ui, sans-serif; color: #212529;
      overflow: hidden; resize: both; min-width: 300px; min-height: 160px; }
    #sx-panel.open { display: flex; }
    #sx-phdr { display: flex; align-items: flex-start; justify-content: space-between;
      padding: 11px 15px 9px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;
      cursor: move; user-select: none; flex-shrink: 0; gap: 8px; }
    #sx-phdr-left { min-width: 0; flex: 1; }
    #sx-phdr-title { font-size: 13.5px; font-weight: 700; }
    #sx-phdr-title em { color: #0d6efd; font-style: normal; }
    #sx-phdr-sub { font-size: 11px; color: #6c757d; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #sx-pclose { background: none; border: none; color: #6c757d; font-size: 17px; cursor: pointer; padding: 0; line-height: 1; flex-shrink: 0; }
    #sx-pclose:hover { color: #212529; }
    #sx-pqbar { display: grid; grid-template-columns: 1fr 1fr auto; grid-template-rows: auto auto auto auto;
      gap: 4px 6px; padding: 9px 15px 6px; flex-shrink: 0; }
    /* release row */
    .sx-pinp-wrap { position: relative; display: flex; align-items: center; }
    .sx-pinp-wrap input, .sx-pinp-wrap select { width: 100%; }
    .sx-pinp-clear { position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: #adb5bd; font-size: 14px; cursor: pointer;
      line-height: 1; padding: 0 2px; display: none; }
    .sx-pinp-clear:hover { color: #495057; }
    .sx-pinp-wrap:focus-within .sx-pinp-clear,
    .sx-pinp-wrap input:not(:placeholder-shown) ~ .sx-pinp-clear,
    .sx-pinp-wrap.has-val .sx-pinp-clear { display: block; }
    #sx-pr-wrap { grid-column: 1 / 3; grid-row: 2; }
    #sx-pr-inp  { width: 100%; padding: 5px 26px 5px 9px; border: 1px solid #dee2e6;
      border-radius: 5px; font-size: 12px; color: #212529; background: #fff; outline: none; }
    #sx-pr-inp:focus { border-color: #0d6efd; }
    #sx-pr-list { }
    #sx-pt-wrap { grid-column: 1; grid-row: 3; }
    #sx-pa-wrap { grid-column: 2; grid-row: 3; }
    #sx-pt-inp  { width: 100%; padding: 5px 26px 5px 9px; border: 1px solid #dee2e6;
      border-radius: 5px; font-size: 12px; color: #212529; background: #fff; outline: none; }
    #sx-pa-inp  { width: 100%; padding: 5px 26px 5px 9px; border: 1px solid #dee2e6;
      border-radius: 5px; font-size: 12px; color: #212529; background: #fff; outline: none; }
    #sx-pt-inp:focus, #sx-pa-inp:focus { border-color: #0d6efd; }
    #sx-pgo { grid-column: 3; grid-row: 2 / 5; align-self: center; padding: 5px 16px;
      background: #0d6efd; border: none; border-radius: 5px; color: #fff;
      font-size: 12px; font-weight: 600; cursor: pointer; }
    #sx-pgo:hover { background: #0b5ed7; }
    #sx-pgo:disabled { background: #adb5bd; cursor: default; }
    #sx-exact-title-wrap   { grid-column: 1; grid-row: 4; }
    #sx-exact-artist-wrap  { grid-column: 2; grid-row: 4; }
    #sx-exact-release-wrap { grid-column: 1 / 3; grid-row: 1; }
    #sx-pstatus { padding: 2px 15px; font-size: 11px; color: #6c757d; min-height: 15px; flex-shrink: 0; }
    #sx-pstatus.err { color: #dc3545; }
    #sx-presults { flex: 1; overflow-y: auto; padding: 4px 15px 4px; }
    .sx-prow { display: flex; align-items: center; gap: 8px; padding: 7px 9px;
      border-radius: 6px; cursor: pointer; border: 1px solid transparent;
      margin-bottom: 3px; transition: background .1s, border-color .1s; }
    .sx-prow:hover            { background: #f0f6ff; border-color: #9ec5fe; }
    .sx-prow.sx-prow-selected { border-color: #198754; background: #d1e7dd; }
    .sx-prow.sx-prow-selected:hover { background: #badbcc; }
    .sx-prow.sx-prow-selected .sx-prow-title { color: #0a3622; font-weight: 700; }
    .sx-prow.sx-prow-selected .sx-prow-meta  { color: #0a3622; }
    .sx-prow.sx-prow-selected .sx-prow-isrc  { background: #198754; border-color: #198754; color: #fff; font-weight: 700; }
    .sx-prow.sx-prow-best { border-color: #6ea8fe; background: #0d47a1; }
    .sx-prow.sx-prow-best:hover { background: #1565c0; }
    .sx-prow.sx-prow-best .sx-prow-title { color: #fff; }
    .sx-prow.sx-prow-best .sx-prow-meta  { color: #bbdefb; }
    .sx-prow.sx-prow-best .sx-prow-isrc  { background: #fff; border-color: #90caf9; color: #0d47a1; font-weight: 700; }
    .sx-prow.sx-prow-warn { background: #fff3cd; }
    .sx-prow.sx-prow-warn:hover { background: #ffe69c; border-color: #ffc107; }
    .sx-prow-info { flex: 1; min-width: 0; }
    .sx-prow-title { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sx-prow-meta  { font-size: 11px; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sx-prow-isrc  { font-size: 11px; font-family: 'Courier New', monospace; background: #dce8ff;
      padding: 2px 7px; border: 1px solid #9ec5fe; border-radius: 4px; color: #084298;
      white-space: nowrap; flex-shrink: 0; }
    #sx-pempty { text-align: center; padding: 22px 15px; color: #adb5bd; font-size: 12px; }
    #sx-pfoot { padding: 6px 15px 9px; font-size: 11px; border-top: 1px solid #f0f0f0; flex-shrink: 0; }
    #sx-pfoot a { color: #0d6efd; text-decoration: none; }
    #sx-pfoot a:hover { text-decoration: underline; }
    .sx-loadmore { display: block; width: 100%; padding: 5px 0; margin-bottom: 6px;
      background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px;
      font-size: 11px; color: #495057; cursor: pointer; text-align: center; }
    .sx-loadmore:hover    { background: #e9ecef; }
    .sx-loadmore:disabled { color: #adb5bd; cursor: default; }
  `;
  document.head.appendChild(style);

  /* ═══════════════════════════════════════════════
     FLOATING PANEL
  ═══════════════════════════════════════════════ */
  const panel = document.createElement('div');
  panel.id = 'sx-panel';
  panel.innerHTML = `
    <div id="sx-phdr">
      <div id="sx-phdr-left">
        <div id="sx-phdr-title">🔍 <em>SoundExchange</em> ISRC Search</div>
        <div id="sx-phdr-sub"></div>
      </div>
      <button id="sx-pclose">✕</button>
    </div>
    <div id="sx-pqbar">
      <div id="sx-pr-wrap" class="sx-pinp-wrap">
        <input id="sx-pr-inp" placeholder="Release (optional)" autocomplete="off" list="sx-pr-list"/>
        <datalist id="sx-pr-list"></datalist>
        <button class="sx-pinp-clear" id="sx-pr-clear" tabindex="-1" type="button">✕</button>
        <button class="sx-pinp-clear" id="sx-pr-drop" tabindex="-1" type="button" style="right:22px;display:block;font-size:10px;color:#adb5bd">▾</button>
      </div>
      <div id="sx-pt-wrap" class="sx-pinp-wrap">
        <input id="sx-pt-inp" placeholder="Track title" autocomplete="off"/>
        <button class="sx-pinp-clear" id="sx-pt-clear" tabindex="-1" type="button">✕</button>
      </div>
      <div id="sx-pa-wrap" class="sx-pinp-wrap">
        <input id="sx-pa-inp" placeholder="Artist" autocomplete="off"/>
        <button class="sx-pinp-clear" id="sx-pa-clear" tabindex="-1" type="button">✕</button>
      </div>
      <button id="sx-pgo">Search</button>
      <label id="sx-exact-release-wrap" class="sx-pexact-item"><input type="checkbox" id="sx-exact-release"> exact release</label>
      <label id="sx-exact-title-wrap" class="sx-pexact-item"><input type="checkbox" id="sx-exact-title"> exact title</label>
      <label id="sx-exact-artist-wrap" class="sx-pexact-item"><input type="checkbox" id="sx-exact-artist"> exact artist</label>
    </div>
    <div id="sx-pstatus"></div>
    <div id="sx-presults"></div>
    <div id="sx-pfoot"></div>
  `;
  document.body.appendChild(panel);

  // drag
  let _drag=false, _ox=0, _oy=0;
  panel.querySelector('#sx-phdr').addEventListener('mousedown', e => {
    if (e.target.id==='sx-pclose') return;
    _drag=true;
    if (!panel.style.left) { panel.style.left=panel.getBoundingClientRect().left+'px'; panel.style.right='auto'; }
    _ox=e.clientX-panel.offsetLeft; _oy=e.clientY-panel.offsetTop; e.preventDefault();
  });
  document.addEventListener('mousemove', e => { if (!_drag) return; panel.style.left=(e.clientX-_ox)+'px'; panel.style.top=(e.clientY-_oy)+'px'; panel.style.right='auto'; });
  document.addEventListener('mouseup', () => { _drag=false; });
  panel.querySelector('#sx-pclose').onclick = () => { panel.classList.remove('open'); _panelTarget=null; };
  document.addEventListener('keydown', e => { if (e.key==='Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); _panelTarget=null; } });
  document.addEventListener('mousedown', e => {
    if (panel.classList.contains('open') && !panel.contains(e.target)) {
      panel.classList.remove('open'); _panelTarget=null;
    }
  });
  // Clear buttons
  function setupClear(inputId, clearId) {
    const inp = panel.querySelector('#'+inputId);
    const btn = panel.querySelector('#'+clearId);
    if (!inp || !btn) return;
    const update = () => { inp.parentElement.classList.toggle('has-val', !!inp.value); };
    inp.addEventListener('input', update);
    btn.addEventListener('click', () => { inp.value=''; update(); inp.focus(); });
    update();
  }
  setupClear('sx-pr-inp','sx-pr-clear');
  // Dropdown arrow: temporarily clear input to show all datalist options, then restore
  const prDrop = panel.querySelector('#sx-pr-drop');
  const prInp  = panel.querySelector('#sx-pr-inp');
  if (prDrop && prInp) {
    prDrop.addEventListener('mousedown', e => {
      e.preventDefault(); // don't blur input
      const prev = prInp.value;
      prInp.value = '';
      prInp.focus();
      // Dispatch input event to show datalist
      prInp.dispatchEvent(new Event('input', {bubbles:true}));
      // Restore value if user doesn't select (on blur)
      const restore = () => { if (!prInp.value) prInp.value = prev; prInp.removeEventListener('blur', restore); };
      prInp.addEventListener('blur', restore);
    });
  }
  setupClear('sx-pt-inp','sx-pt-clear');
  setupClear('sx-pa-inp','sx-pa-clear');

  // Populate release datalist from MB releases fetched for this recording
  // Collect unique release titles across all MB release rows on the page
  function getAllPageReleases() {
    const seen = new Set();
    document.querySelectorAll('.sx-mb-rel').forEach(row => {
      const titleEl = row.querySelector('.sx-mb-rel-title');
      if (!titleEl) return;
      const t = titleEl.textContent.trim();
      if (t) seen.add(t);
    });
    return [...seen].sort();
  }

  function populateReleaseDatelist() {
    const datalist = panel.querySelector('#sx-pr-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    getAllPageReleases().forEach(title => {
      const opt = document.createElement('option');
      opt.value = title;
      datalist.appendChild(opt);
    });
  }

  panel.querySelector('#sx-pgo').addEventListener('click', () => {
    const t=panel.querySelector('#sx-pt-inp').value.trim();
    const a=panel.querySelector('#sx-pa-inp').value.trim();
    const r=panel.querySelector('#sx-pr-inp').value.trim();
    if (t||a||r) panelSearch(t, a, r, true);
  });
  ['#sx-pt-inp','#sx-pa-inp','#sx-pr-inp'].forEach(id => {
    panel.querySelector(id).addEventListener('keydown', e => { if (e.key==='Enter') panel.querySelector('#sx-pgo').click(); });
  });

  /* ═══════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════ */
  let _panelTarget = null;
  let _batchAbort  = false;
  let _sxToken     = 'ff5284e764c4a90c1a2c2940f6a9aa593c63b8e8';
  let _tokenFetch  = null;
  const _mbYearCache = {}; // mbid -> earliest year
  // MB request queue — enforces max 1 req/s to avoid IP bans
  const _mbQueue = [];
  let _mbQueueRunning = false;
  let _mbLastReq = 0;
  let _mbInterval = 300; // ms between requests, increases on rate limit

  function mbEnqueue(fn) {
    _mbQueue.push(fn);
    if (!_mbQueueRunning) _mbDrain();
  }

  function _mbDrain() {
    if (!_mbQueue.length) { _mbQueueRunning=false; _mbLastReq=0; return; }
    _mbQueueRunning=true;
    const now=Date.now();
    // First item fires immediately if queue was idle; subsequent items respect interval
    const wait=_mbLastReq===0 ? 0 : Math.max(0, _mbLastReq+_mbInterval-now);
    setTimeout(()=>{
      _mbLastReq=Date.now();
      const fn=_mbQueue.shift();
      try { fn(); } catch(e){}
      _mbDrain();
    }, wait);
  }

  function mbOnRateLimit() {
    _mbInterval=Math.min(2000, _mbInterval*1.5);
    console.warn('[MB] Rate limited, slowing to', _mbInterval, 'ms');
    setTimeout(()=>{ _mbInterval=Math.max(300, _mbInterval*0.9); }, 30000);
  }

  // Legacy retry queue — now uses mbEnqueue
  function queueMbRetry(fn) { mbEnqueue(fn); }
  let _cachedRelease = null; // cached once found by whenReleaseReady
  let _exactTitle   = false;
  let _exactArtist  = false;
  let _exactRelease = false;
  let _autoFill     = false;
  let _suppressFocus = false;
  let _panelSearchGen = 0; // incremented on each new panel search to cancel stale results

  // Load saved options from localStorage
  (function loadOptions() {
    try {
      const s = localStorage.getItem('sx-options');
      if (!s) return;
      const o = JSON.parse(s);
      if (o.exactTitle   !== undefined) _exactTitle   = !!o.exactTitle;
      if (o.exactArtist  !== undefined) _exactArtist  = !!o.exactArtist;
      if (o.exactRelease !== undefined) _exactRelease = !!o.exactRelease;
      if (o.autoFill     !== undefined) _autoFill     = !!o.autoFill;
    } catch(e) {}
  })();

  function saveOptions() {
    try { localStorage.setItem('sx-options', JSON.stringify({exactTitle:_exactTitle, exactArtist:_exactArtist, exactRelease:_exactRelease, autoFill:_autoFill})); } catch(e) {}
  }

  function applyExact(val, exact) {
    if (!val) return val;
    return exact ? '"' + val.replace(/"/g,'') + '"' : val;
  }

  /* ═══════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════ */
  function esc(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function msToMmSs(ms) {
    if (!ms) return null;
    const s=Math.round(ms/1000);
    return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  }
  function normCI(s) { return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
  function durToSec(str) {
    if (!str) return null;
    const m=String(str).match(/^(\d+):(\d{2})$/);
    return m ? parseInt(m[1])*60+parseInt(m[2]) : null;
  }
  function norm(s) {
    return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }
  function wordsMatch(needle, haystack) {
    const nw=norm(needle).split(' ').filter(Boolean), hw=norm(haystack);
    return nw.length>0 && nw.every(w=>hw.includes(w));
  }
  function isGoodMatch(sxTitle, sxArtist, mbTitle, mbArtist) {
    const aw=norm(sxTitle).split(' ').filter(Boolean);
    const bw=norm(mbTitle).split(' ').filter(Boolean);
    if (!aw.length||!bw.length) return false;
    const shorter=aw.length<=bw.length?aw:bw, longer=aw.length<=bw.length?bw:aw;
    if (!shorter.every(w=>longer.includes(w))) return false;
    const extra=longer.length-shorter.length;
    const titleOk = extra===0 || extra===1 ||
      (extra<=2 && shorter.every((w,i)=>longer[i]===w)); // prefix match with <=2 extras
    const artistOk=!mbArtist||wordsMatch(mbArtist,sxArtist)||wordsMatch(sxArtist,mbArtist);
    return titleOk && artistOk;
  }
  function classifyResult(sxTitle,sxArtist,sxDurStr,sxYear,mbTitle,mbArtist,mbDurStr,mbEarliestYear) {
    if (!isGoodMatch(sxTitle,sxArtist,mbTitle,mbArtist)) return 'other';
    if (mbEarliestYear && sxYear && parseInt(sxYear)>mbEarliestYear+1) return 'other';
    const a=durToSec(mbDurStr), b=durToSec(sxDurStr);
    if (a!==null&&b!==null&&Math.abs(a-b)>10) return 'warn';
    return 'best';
  }
  function bestIdx(rows, mbSec, mbTitle, mbArtist, mbDurStr, mbEarliestYear) {
    if (!rows.length) return 0;
    let bestGood=-1, bestGoodDiff=Infinity, bestAny=0, bestAnyDiff=Infinity;
    rows.forEach((item,i) => {
      const f=fields(item), s=durToSec(f.dur);
      const diff=(s!==null&&mbSec!==null)?Math.abs(s-mbSec):9999;
      if (diff<bestAnyDiff) { bestAnyDiff=diff; bestAny=i; }
      const cls=classifyResult(f.title,f.artist,f.dur,f.year,mbTitle,mbArtist,mbDurStr,mbEarliestYear);
      if (cls!=='other'&&diff<bestGoodDiff) { bestGoodDiff=diff; bestGood=i; }
    });
    return bestGood>=0?bestGood:bestAny;
  }
  function fields(item) {
    // SX response fields (flat, not nested): releaseName, releaseLabel, releaseDate, releaseArtistName, icpn
    return {
      isrc:      item.isrc                ||'',
      title:     item.recordingTitle      ||'',
      artist:    item.recordingArtistName ||'',
      version:   item.recordingVersion    ||'',
      year:      item.recordingYear       ||'',
      dur:       item.duration            ||'',
      relTitle:  item.releaseName         ||'',
      relLabel:  item.releaseLabel        ||'',
      relDate:   (item.releaseDate        ||'').slice(0,7), // YYYY-MM
      relArtist: item.releaseArtistName   ||'',
      upc:       item.icpn                ||'',
    };
  }
  function sxPageUrl(title, artist, release) {
    // SX requires %20 for spaces, not + — build URL manually
    const enc = s => encodeURIComponent('"' + s + '"');
    const parts = ['tab=' + encodeURIComponent('"simple"')];
    if (artist)  parts.push('artistName='  + enc(artist));
    if (title)   parts.push('title=' + enc(title));
    if (release) parts.push('releaseName=' + enc(release));
    return 'https://isrc.soundexchange.com/?' + parts.join('&');
  }
  function getWin() { return (typeof unsafeWindow!=='undefined')?unsafeWindow:window; }

  /* ═══════════════════════════════════════════════
     MB DATA — fetched directly from MB WS2 using
     the MBID from the page URL (no reliance on
     MagicISRC's internal variables)
  ═══════════════════════════════════════════════ */

  let _releaseCache = null;  // { mbid, data }
  let _releaseFetch = null;  // Promise in flight

  function getPageMbid() {
    return new URLSearchParams(window.location.search).get('mbid')||null;
  }

  function fetchRelease() {
    const mbid=getPageMbid();
    if (!mbid) return Promise.resolve(null);
    if (_releaseCache?.mbid===mbid) return Promise.resolve(_releaseCache.data);
    if (_releaseFetch) return _releaseFetch;
    _releaseFetch=new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET',
        url: MB_WS2+'release/'+mbid+'?inc=recordings&fmt=json',
        headers:{'Accept':'application/json','User-Agent':'MagicISRC-SX-Helper/1.0'},
        onload(r) {
          _releaseFetch=null;
          if (r.status!==200) { reject(new Error('MB '+r.status)); return; }
          try {
            const data=JSON.parse(r.responseText);
            _releaseCache={mbid, data};
            resolve(data);
          } catch(e) { reject(new Error('MB parse')); }
        },
        onerror()   { _releaseFetch=null; reject(new Error('MB network')); },
        ontimeout() { _releaseFetch=null; reject(new Error('MB timeout')); }
      });
    });
    return _releaseFetch;
  }

  // Invalidate cache on URL change (SPA navigation)
  let _lastHref='';
  setInterval(()=>{
    if (window.location.href!==_lastHref) {
      _lastHref=window.location.href; _releaseCache=null; _releaseFetch=null;
    }
  }, 300);

  function getMbDur(medium, track) {
    if (!_releaseCache?.data?.media) return null;
    const med=_releaseCache.data.media.find(m=>String(m.position)===String(medium));
    if (!med) return null;
    if (String(track)==='0') return msToMmSs(med.pregap?.length||0)||null;
    const trk=med.tracks?.find(t=>String(t.position)===String(track));
    return trk?.length ? msToMmSs(trk.length) : null;
  }

    function getMbRecordingId(medium, track) {
    if (!_releaseCache?.data?.media) return null;
    const med=_releaseCache.data.media.find(m=>String(m.position)===String(medium));
    if (!med) return null;
    if (String(track)==='0') return med.pregap?.recording?.id||null;
    const trk=med.tracks?.find(t=>String(t.position)===String(track));
    return trk?.recording?.id||null;
  }

  function getEarliestYear(medium, track) {
    const recId=getMbRecordingId(medium, track);
    return (recId&&_mbYearCache[recId]!==undefined)?_mbYearCache[recId]:null;
  }

  function whenReleaseReady(cb) {
    if (_releaseCache?.data) { cb(); return; }
    fetchRelease().then(d=>{ if (d) cb(); }).catch(e=>console.warn('[SX] release fetch:',e.message));
  }

    function fetchMbReleases(mbid) {
    return new Promise((resolve,reject) => {
      mbEnqueue(()=>GM_xmlhttpRequest({
        method:'GET',
        url: MB_WS2+'recording/'+mbid+'?inc=releases+media&fmt=json',
        headers:{'Accept':'application/json','User-Agent':'MagicISRC-SX-Helper/1.0'},
        onload(r) {
          if (r.status===503||r.status===429) { mbOnRateLimit(); reject(new Error('rate-limited')); return; }
          if (r.status!==200) { reject(new Error('MB '+r.status)); return; }
          try {
            const data=JSON.parse(r.responseText);
            const rels=(data.releases||[]).map(rel=>{
              let len=null;
              if (rel.media) for (const med of rel.media) if (med.tracks) for (const trk of med.tracks) if (trk.length&&!len) len=trk.length;
              return {
                id:     rel.id||'',
                title:  rel.title||'',
                date:   (rel.date||'').slice(0,4),
                len:    len?msToMmSs(len):null,
              };
            });
            rels.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
            if (rels.length&&rels[0].date) _mbYearCache[mbid]=parseInt(rels[0].date)||null;
            else _mbYearCache[mbid]=null;
            resolve(rels);
          } catch(e) { reject(new Error('MB parse')); }
        },
        onerror()   { reject(new Error('MB network')); },
        ontimeout() { reject(new Error('MB timeout')); }
      }));
    });
  }
  function renderMbRels(container, rels) {
    container.innerHTML='';
    const show=rels.slice(0,5);
    show.forEach(r=>{
      const row=document.createElement('div'); row.className='sx-mb-rel';
      const le=document.createElement('span'); le.className='sx-mb-rel-len'; le.textContent=r.len||'–';
      const yr=document.createElement('span'); yr.className='sx-mb-rel-year'; yr.textContent=r.date||'–';
      const ti=document.createElement('span'); ti.className='sx-mb-rel-title'; ti.textContent=r.title; ti.title=r.title;
      row.append(le,yr,ti);
      container.appendChild(row);
    });
    if (rels.length>5) {
      const more=document.createElement('span'); more.className='sx-mb-rel-more';
      more.textContent=`+${rels.length-5} more releases`;
      more.onclick=()=>{ container.innerHTML=''; rels.forEach(r=>{ const row=document.createElement('div'); row.className='sx-mb-rel'; const le=document.createElement('span'); le.className='sx-mb-rel-len'; le.textContent=r.len||'–'; const yr=document.createElement('span'); yr.className='sx-mb-rel-year'; yr.textContent=r.date||'–'; const ti=document.createElement('span'); ti.className='sx-mb-rel-title'; ti.textContent=r.title; row.append(le,yr,ti); container.appendChild(row); }); };
      container.appendChild(more);
    }
  }
  function fetchMbReleasesForCell(inputEl, cell, medium, track, title, artist) {
    if (cell.dataset.sxRelsDone) return;
    cell.dataset.sxRelsDone='1';
    const wrap=getWrap(cell);
    const relsContainer=document.createElement('div'); relsContainer.className='sx-mb-rels';
    const spinner=document.createElement('span'); spinner.className='sx-mb-spin'; spinner.textContent='⏳ loading releases…';
    relsContainer.appendChild(spinner);
    cell.insertBefore(relsContainer, wrap);

    function doFetch() {
      // Ensure release data is loaded, then get the recording ID
      fetchRelease().then(()=>{
        // Set MB duration badge now that release data is available
        const mbDurNow=getMbDur(medium, track);
        if (mbDurNow) setBadge(wrap, 'sx-dur-mb', 'MB', mbDurNow);

        const rid=getMbRecordingId(medium, track);
        if (rid) startFetch(rid);
        else relsContainer.innerHTML='';
      }).catch(err=>{
        relsContainer.innerHTML='';
        if (err.message.includes('rate')||err.message.includes('503')) {
          const e=document.createElement('span'); e.className='sx-mb-spin retry';
          e.textContent='⚠ Rate limited — queued for retry';
          relsContainer.appendChild(e);
          queueMbRetry(()=>{ relsContainer.innerHTML=''; delete cell.dataset.sxRelsDone; fetchMbReleasesForCell(inputEl,cell,medium,track,title,artist); });
        } else {
          const e=document.createElement('span'); e.className='sx-mb-spin retry';
          e.textContent='⚠ '+err.message+' — click to retry';
          e.onclick=()=>{ e.remove(); delete cell.dataset.sxRelsDone; fetchMbReleasesForCell(inputEl,cell,medium,track,title,artist); };
          relsContainer.appendChild(e);
        }
      });
    }
    function startFetch(recId) {
      fetchMbReleases(recId)
        .then(rels=>{
          renderMbRels(relsContainer, rels);
          // Re-evaluate chip only if not already filled by user
          const chip=wrap.querySelector('.sx-chip');
          if (chip?._sxRows && !chip.dataset?.sxUserPicked && !inputEl.value.trim() && !inputEl.dataset.sxCleared && !inputEl.dataset.sxAutoSet) {
            const chosen=setChip(wrap, chip._sxRows, inputEl, title, artist, medium, track);
            if (chosen) applyIsrc(chosen, inputEl);
          }
        })
        .catch(err=>{
          relsContainer.innerHTML='';
          if (err.message==='rate-limited') {
            // Auto-retry via queue instead of requiring a click
            const errEl=document.createElement('span');
            errEl.className='sx-mb-spin retry';
            errEl.textContent='⚠ Rate limited — queued for retry';
            relsContainer.appendChild(errEl);
            queueMbRetry(()=>{
              relsContainer.innerHTML='';
              delete cell.dataset.sxRelsDone;
              fetchMbReleasesForCell(inputEl,cell,medium,track,title,artist);
            });
          } else {
            const errEl=document.createElement('span');
            errEl.className='sx-mb-spin retry';
            errEl.textContent='⚠ '+err.message+' — click to retry';
            errEl.onclick=()=>{
              errEl.remove();
              delete cell.dataset.sxRelsDone;
              fetchMbReleasesForCell(inputEl,cell,medium,track,title,artist);
            };
            relsContainer.appendChild(errEl);
          }
        });
    }
    doFetch();
  }

  /* ═══════════════════════════════════════════════
     SX TOKEN REFRESH
  ═══════════════════════════════════════════════ */
  function extractToken(text) {
    const pats=[/[Tt]oken ([a-f0-9]{40})/, /["'](Token [a-f0-9]{40})["']/, /([a-f0-9]{40})/];
    for (const p of pats) { const m=text.match(p); if (m) { const h=(m[1]||m[0]).match(/[a-f0-9]{40}/); if (h) return h[0]; } }
    return null;
  }
  function refreshToken() {
    if (_tokenFetch) return _tokenFetch;
    _tokenFetch=new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET', url:SX_HOME,
        headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0'},
        onload(r1) {
          _tokenFetch=null;
          if (r1.status!==200) { reject(new Error('SX home '+r1.status)); return; }
          const inlineTok=extractToken(r1.responseText);
          if (inlineTok) { _sxToken=inlineTok; resolve(_sxToken); return; }
          // Collect script URLs
          const urls=[];
          const re=/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi;
          let m;
          while ((m=re.exec(r1.responseText))!==null) {
            const u=m[1].startsWith('http')?m[1]:SX_HOME.replace(/\/$/,'')+m[1];
            urls.push(u);
          }
          urls.sort((a,b)=>(/entry|main/i.test(b)?1:0)-(/entry|main/i.test(a)?1:0));
          console.log('[SX] Token scripts found:', urls.length, urls.slice(0,3));
          let idx=0;
          function tryNext() {
            if (idx>=urls.length||idx>=15) { reject(new Error('token not found in any script')); return; }
            const url=urls[idx++];
            GM_xmlhttpRequest({
              method:'GET', url,
              headers:{'Accept':'*/*','Referer':SX_HOME},
              onload(r2) {
                if (r2.status!==200) { tryNext(); return; }
                const tok=extractToken(r2.responseText);
                if (!tok) { tryNext(); return; }
                _sxToken=tok;
                console.log('[SX] Refreshed token from',url);
                resolve(_sxToken);
              },
              onerror: tryNext
            });
          }
          // Also try Nuxt manifest
          GM_xmlhttpRequest({
            method:'GET', url:SX_HOME+'_nuxt/manifest.json',
            headers:{'Accept':'application/json','Referer':SX_HOME},
            onload(rm) {
              if (rm.status===200) {
                try {
                  const mf=JSON.parse(rm.responseText);
                  Object.values(mf.files||mf).forEach(u=>{
                    if (typeof u==='string'&&u.endsWith('.js')) {
                      const full=u.startsWith('http')?u:SX_HOME.replace(/\/$/,'')+u;
                      if (!urls.includes(full)) urls.push(full);
                    }
                  });
                  console.log('[SX] After manifest:', urls.length, 'scripts');
                } catch(e) {}
              }
              tryNext();
            },
            onerror: tryNext
          });
        },
        onerror() { _tokenFetch=null; reject(new Error('SX home network error')); }
      });
    });
    return _tokenFetch;
  }

  /* ═══════════════════════════════════════════════
     SX API
  ═══════════════════════════════════════════════ */
  function apiSearchByIsrc(isrc) {
    return new Promise((resolve,reject)=>{
      const body=JSON.stringify({
        searchFields:{isrc:isrc},
        start:0, number:10, showReleases:true
      });
      const doReq=(token)=>GM_xmlhttpRequest({
        method:'POST', url:SX_API,
        headers:{'Content-Type':'application/json','Accept':'application/json',
                 'Authorization':'Token '+token,'Origin':SX_HOME,'Referer':SX_HOME},
        data:body,
        onload(r) {
          if (r.status===0) { reject(new Error('blocked')); return; }
          if (r.status===401||r.status===403) { refreshToken().then(t=>doReq(t)).catch(e=>reject(e)); return; }
          let p; try { p=JSON.parse(r.responseText); } catch(e){ reject(new Error('parse')); return; }
          const raw=p.recordings||p.results||p.data||(Array.isArray(p)?p:[]);
          resolve({rows:raw, total:raw.length});
        },
        onerror()   { reject(new Error('network')); },
        ontimeout() { reject(new Error('timeout')); }
      });
      doReq(_sxToken);
    });
  }

  function apiSearch(title, artist, start=0, count=20, release='') {
    return new Promise((resolve,reject)=>{
      const body=JSON.stringify({
        searchFields:{recordingArtistName:{value:applyExact(artist,_exactArtist)},recordingTitle:{value:applyExact(title,_exactTitle)},releaseName:{value:applyExact(release||'',_exactRelease)}},
        start, number:count, showReleases:true
      });
      const doReq=(token)=>GM_xmlhttpRequest({
        method:'POST', url:SX_API,
        headers:{'Content-Type':'application/json','Accept':'application/json',
                 'Authorization':'Token '+token,'Origin':SX_HOME,'Referer':SX_HOME},
        data:body,
        onload(r) {
          if (r.status===0) { reject(new Error('blocked')); return; }
          if (r.status===401||r.status===403) {
            refreshToken().then(t=>doReq(t)).catch(e=>reject(new Error('auth refresh failed: '+e.message)));
            return;
          }
          let p; try { p=JSON.parse(r.responseText); } catch(e){ reject(new Error('parse')); return; }
          const raw=p.recordings||p.results||p.data||(Array.isArray(p)?p:[]);
          // Deduplicate by ISRC — group releases under each unique ISRC
          const seen=new Map();
          raw.forEach(item=>{
            const key=item.isrc||item.id;
            if (!seen.has(key)) {
              seen.set(key, Object.assign({},item,{_releases:[]}));
            }
            const entry=seen.get(key);
            // Collect release info into _releases array
            if (item.releaseName) {
              entry._releases.push({
                releaseName:    item.releaseName,
                releaseLabel:   item.releaseLabel||'',
                releaseDate:    item.releaseDate||'',
                releaseArtistName: item.releaseArtistName||'',
                icpn:           item.icpn||'',
              });
            }
          });
          const rows=[...seen.values()];
          // Sort _releases by date ascending, keep earliest on the item itself
          rows.forEach(item=>{
            if (item._releases.length>1) {
              item._releases.sort((a,b)=>(a.releaseDate||'9999').localeCompare(b.releaseDate||'9999'));
            }
            // Copy earliest release fields back to item
            const r=item._releases[0];
            if (r) { item.releaseName=r.releaseName; item.releaseLabel=r.releaseLabel; item.releaseDate=r.releaseDate; item.releaseArtistName=r.releaseArtistName; item.icpn=r.icpn; }
          });
          resolve({rows, total:rows.length});
        },
        onerror()   { reject(new Error('network')); },
        ontimeout() { reject(new Error('timeout')); }
      });
      doReq(_sxToken);
    });
  }

  /* ═══════════════════════════════════════════════
     DOM HELPERS
  ═══════════════════════════════════════════════ */
  function getWrap(cell) {
    let w=cell.querySelector('.sx-wrap');
    if (!w) { w=document.createElement('div'); w.className='sx-wrap'; cell.appendChild(w); }
    return w;
  }
  function setBadge(wrap, cls, label, value) {
    let b=wrap.querySelector('.'+cls);
    if (!b) {
      b=document.createElement('span'); b.className='sx-dur '+cls;
      b.title=cls==='sx-dur-mb'?'MusicBrainz duration':'SoundExchange duration';
      const mb=wrap.querySelector('.sx-dur-mb');
      if (cls==='sx-dur-sx'&&mb) mb.after(b); else wrap.insertBefore(b,wrap.firstChild);
    }
    b.innerHTML=`<span class="sx-dur-label">${label}</span>${esc(value)}`;
  }
  function setStatus(wrap, cls, text) {
    wrap.querySelectorAll('.sx-chip,.sx-chip-none,.sx-chip-err,.sx-chip-spin,.sx-chip-placeholder').forEach(e=>e.remove());
    const el=document.createElement('span'); el.className=cls; el.textContent=text; wrap.appendChild(el);
  }
  function getRowEl(inp) { return inp.closest('tr')||null; }
  function applyIsrc(isrc, inputEl, noFocus) {
    if (!isrc||!inputEl) return;
    inputEl.dataset.sxAutoFilled='1';
    inputEl.dataset.sxAutoSet='1';
    inputEl.value=isrc;
    inputEl.dispatchEvent(new Event('input',{bubbles:true}));
    inputEl.dispatchEvent(new Event('change',{bubbles:true}));
    delete inputEl.dataset.sxAutoFilled;
    if (!noFocus && !_suppressFocus) inputEl.focus();
    const tr=getRowEl(inputEl);
    if (tr) { tr.classList.remove('sx-flashed'); void tr.offsetWidth; tr.classList.add('sx-flashed'); }
  }
  function lookupIsrc(isrc, inp) {
    // Query SX for a specific ISRC using the dedicated ISRC field
    const lookupWrap = getWrap(inp.closest('td') || inp.parentElement);
    let infoEl = lookupWrap.querySelector('.sx-isrc-info');
    if (!infoEl) {
      infoEl = document.createElement('span');
      lookupWrap.appendChild(infoEl);
    }
    infoEl.className = 'sx-isrc-info';
    infoEl.textContent = '⏳';
    // Use the isrc search field directly
    apiSearchByIsrc(isrc).then(({rows}) => {
      if (!rows.length) {
        infoEl.className = 'sx-isrc-info sx-isrc-info-err';
        infoEl.textContent = '✗ not found in SoundExchange';
        return;
      }
      const f = fields(rows[0]);
      const mbTitle3  = (inp.closest('td')||inp.parentElement)?.dataset.sxTitle  || '';
      const mbArtist3 = (inp.closest('td')||inp.parentElement)?.dataset.sxArtist || '';
      const ciEq3 = (a,b) => normCI(a) === normCI(b);
      const tOk3 = !mbTitle3  || ciEq3(f.title,  mbTitle3);
      const aOk3 = !mbArtist3 || ciEq3(f.artist, mbArtist3);
      const tH3 = tOk3 ? esc(f.title)  : '<span class="sx-field-bad">' + esc(f.title)  + '</span>';
      const aH3 = f.artist ? (aOk3 ? ' — ' + esc(f.artist) : ' — <span class="sx-field-bad">' + esc(f.artist) + '</span>') : '';
      const relParts = [f.relTitle, f.relLabel, f.relDate].filter(Boolean).join(' · ');
      const relH3 = relParts ? '  |  ' + esc(relParts) : '';
      infoEl.className = 'sx-isrc-info sx-isrc-info-ok';
      infoEl.title = relParts;
      infoEl.innerHTML = '✓ ' + tH3 + aH3 + (f.year ? ' — ' + esc(f.year) : '') + relH3;
      // Highlight row only if this ISRC differs from what the SX chip already chose
      const cell2 = inp.closest('td') || inp.parentElement;
      const tr2   = inp.closest('tr');
      const mbTitle2  = cell2?.dataset.sxTitle  || '';
      const mbArtist2 = cell2?.dataset.sxArtist || '';
      const chipIsrc  = cell2?.querySelector('.sx-chip-isrc')?.textContent || '';
      // Skip mismatch if the chip already has this ISRC selected (chip takes precedence)
      if (tr2 && rows.length && isrc !== chipIsrc) {
        const f2 = fields(rows[0]);
        const ok2 = isGoodMatch(f2.title, f2.artist, mbTitle2, mbArtist2);
        tr2.classList.toggle('sx-songmismatch', !ok2);
      }
    }).catch(() => {
      infoEl.className = 'sx-isrc-info sx-isrc-info-err';
      infoEl.textContent = '✗ lookup failed';
    });
  }

  function watchForUserClear(inp) {
    if (inp.dataset.sxWatched) return;
    inp.dataset.sxWatched='1';
    inp.addEventListener('input', ()=>{
      if (inp.dataset.sxAutoFilled) return;
      if (!inp.value.trim()) {
        inp.dataset.sxCleared='1'; delete inp.dataset.sxAutoSet;
        // Clear ISRC info on empty
        const lookupWrap2 = getWrap(inp.closest('td') || inp.parentElement);
        const info = lookupWrap2.querySelector('.sx-isrc-info');
        if (info) info.remove();
      } else { delete inp.dataset.sxCleared; delete inp.dataset.sxAutoSet; }
    });
    inp.addEventListener('blur', ()=>{
      const v=inp.value.trim();
      // Skip blur lookup if field was auto-set (chip will handle it) or being auto-filled
      if (inp.dataset.sxAutoFilled || inp.dataset.sxAutoSet) return;
      // Only lookup if value looks like a valid ISRC (12 alphanumeric chars)
      if (v && /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/i.test(v)) lookupIsrc(v, inp);
    });
  }
  function extractArtist(tr) {
    if (!tr) return '';
    const bdi=tr.querySelector('.col-lg-5 bdi');
    if (bdi) return bdi.textContent.trim();
    const div=tr.querySelector('.col-lg-5');
    return div ? div.textContent.replace(/^[\s~]*track\s+by\s*/i,'').trim() : '';
  }

  /* ═══════════════════════════════════════════════
     CHIP
  ═══════════════════════════════════════════════ */
  function setChip(wrap, rows, inputEl, title, artist, medium, track) {
    console.log("[setChip] rows=",rows?.length,"title=",title,"wrap=",wrap?.className);
    wrap.querySelectorAll('.sx-chip,.sx-chip-none,.sx-chip-err,.sx-chip-spin,.sx-chip-placeholder').forEach(e=>e.remove());
    if (!rows||!rows.length) {
      wrap.querySelectorAll('.sx-chip,.sx-chip-none,.sx-chip-err,.sx-chip-spin,.sx-chip-placeholder').forEach(e=>e.remove());
      const noneEl=document.createElement('span'); noneEl.className='sx-chip-none';
      noneEl.textContent='No results ';
      const searchBtn=document.createElement('button'); searchBtn.type='button';
      searchBtn.style.cssText='font-size:10.5px;padding:1px 7px;border:1px solid #dee2e6;border-radius:3px;background:#f8f9fa;cursor:pointer;color:#0d6efd;';
      searchBtn.textContent='Search manually…';
      searchBtn.addEventListener('click',()=>openPanel(title,artist,inputEl,[],getMbDur(medium,track)));
      noneEl.appendChild(searchBtn);
      wrap.appendChild(noneEl);
      return null;
    }

    const mbDurStr=getMbDur(medium,track);
    if (mbDurStr) setBadge(wrap,'sx-dur-mb','MB',mbDurStr);
    const mbSec=durToSec(mbDurStr);
    const mbEY=getEarliestYear(medium,track);
    const bi=bestIdx(rows,mbSec,title,artist,mbDurStr,mbEY);
    const f=fields(rows[bi]);
    const reordered=[rows[bi],...rows.slice(0,bi),...rows.slice(bi+1)];

    if (f.dur) setBadge(wrap,'sx-dur-sx','SX',f.dur);
    else { const old=wrap.querySelector('.sx-dur-sx'); if(old) old.remove(); }

    // Row highlights
    const tr=getRowEl(inputEl);
    const songOk=isGoodMatch(f.title,f.artist,title,artist);
    if (tr) {
      tr.classList.toggle('sx-songmismatch', rows.length>0&&!songOk);
      tr.classList.toggle('sx-mismatch', songOk&&durToSec(mbDurStr)!==null&&durToSec(f.dur)!==null&&Math.abs(durToSec(mbDurStr)-durToSec(f.dur))>10);
    }

    const releaseStr=[f.year,f.version].filter(Boolean).join(' · ');
    // Visual highlight: compare case-insensitive but keep punctuation/spacing differences
    const ciEq = (a,b) => normCI(a) === normCI(b);
    const titleOk  = !title  || ciEq(f.title,  title);
    const artistOk = !artist || ciEq(f.artist, artist);
    const titleHtml=titleOk?esc(f.title):`<span class="sx-field-bad">${esc(f.title)}</span>`;
    const artistHtml=f.artist?(artistOk?` — ${esc(f.artist)}`:` — <span class="sx-field-bad">${esc(f.artist)}</span>`):'';
    const relHtml=releaseStr?`  ·  ${esc(releaseStr)}`:'';

    // Release line: "Release Title · Label · Date"
    const relLineParts=[f.relTitle, f.relLabel, f.relDate].filter(Boolean);
    const relLineStr=relLineParts.join(' · ');

    const chip=document.createElement('div'); chip.className='sx-chip';
    chip.style.flexDirection='column'; chip.style.alignItems='flex-start'; chip.style.gap='2px';
    const chipRow=document.createElement('div'); chipRow.style.cssText='display:flex;align-items:center;gap:7px;width:100%';
    const isrcSpan=document.createElement('span'); isrcSpan.className='sx-chip-isrc'; isrcSpan.textContent=f.isrc;
    const metaSpan=document.createElement('span'); metaSpan.className='sx-chip-meta';
    metaSpan.title=f.title+(f.artist?' — '+f.artist:'')+(releaseStr?'  ·  '+releaseStr:'');
    metaSpan.innerHTML=titleHtml+artistHtml+relHtml;
    const moreSpan=document.createElement('span'); moreSpan.className='sx-chip-more';
    moreSpan.textContent=rows.length>1?`+${rows.length-1} more`:'more';
    chipRow.append(isrcSpan,metaSpan,moreSpan);
    chip.appendChild(chipRow);
    if (relLineStr) {
      const relSpan=document.createElement('span'); relSpan.className='sx-chip-rel';
      relSpan.textContent=relLineStr; relSpan.title=relLineStr;
      chip.appendChild(relSpan);
    }
    chip._sxRows=rows;
    chip.addEventListener('click', e=>{
      if (e.target===moreSpan) { e.stopPropagation(); openPanel(title,artist,inputEl,null,mbDurStr); return; }
      // Read ISRC from the chip DOM directly (may have been updated by panel pick)
      const currentIsrc = chip.querySelector('.sx-chip-isrc')?.textContent || f.isrc;
      applyIsrc(currentIsrc,inputEl);
      // Clear stale ISRC lookup info line
      const infoEl2=wrap.querySelector('.sx-isrc-info');
      if (infoEl2) infoEl2.remove();
    });
    wrap.appendChild(chip);

    const fillCls=classifyResult(f.title,f.artist,f.dur,f.year,title,artist,mbDurStr,mbEY);
    return fillCls==='best'?f.isrc:null;
  }

  /* ═══════════════════════════════════════════════
     PANEL
  ═══════════════════════════════════════════════ */
  function openPanel(title, artist, inputEl, preloaded, mbDurStr) {
    _panelTarget={inputEl,medium:inputEl.dataset.medium,track:inputEl.dataset.track,
                  mbDurStr:mbDurStr||getMbDur(inputEl.dataset.medium,inputEl.dataset.track),
                  mbTitle:title,mbArtist:artist,currentIsrc:inputEl.value.trim()};
    panel.querySelector('#sx-pt-inp').value=title;
    panel.querySelector('#sx-pa-inp').value=artist;
        panel.querySelector('#sx-phdr-sub').textContent = [title ? '"'+title+'"' : '', artist].filter(Boolean).join(' — ');
    panel.querySelector('#sx-pstatus').textContent=''; panel.querySelector('#sx-pstatus').className='';
    panel.querySelector('#sx-presults').innerHTML=''; panel.querySelector('#sx-pfoot').innerHTML='';
    panel.classList.add('open');
    // Populate release datalist from MB releases in this row
    populateReleaseDatelist();
    // Keep release field value between tracks (user may have set it deliberately)
    // Sync exact toggles with current state
    const pct=panel.querySelector('#sx-exact-title');   if(pct) { pct.checked=_exactTitle;   pct.onchange=()=>{ _exactTitle=pct.checked;   saveOptions(); }; }
    const pca=panel.querySelector('#sx-exact-artist');  if(pca) { pca.checked=_exactArtist;  pca.onchange=()=>{ _exactArtist=pca.checked;  saveOptions(); }; }
    const pcr=panel.querySelector('#sx-exact-release'); if(pcr) { pcr.checked=_exactRelease; pcr.onchange=()=>{ _exactRelease=pcr.checked; saveOptions(); }; }
    if (preloaded&&preloaded.length) renderPanel(preloaded,title,artist,preloaded.length,preloaded.length,true);
    if (!preloaded||!preloaded.length) { const r0=panel.querySelector('#sx-pr-inp')?.value.trim()||''; panelSearch(title,artist,r0,true); }
  }
  function panelSearch(title, artist, release, clear) {
    const stEl=panel.querySelector('#sx-pstatus'), rEl=panel.querySelector('#sx-presults'),
          fEl=panel.querySelector('#sx-pfoot'), gBtn=panel.querySelector('#sx-pgo');
    if (clear) { stEl.className=''; stEl.textContent='Searching…'; rEl.innerHTML=''; fEl.innerHTML=''; }
    gBtn.disabled=true;
    const _myGen = ++_panelSearchGen;
    apiSearch(title,artist,0,20,release)
      .then(({rows,total})=>{
        if (_myGen!==_panelSearchGen) return; // stale result, newer search started
        gBtn.disabled=false; if(_panelTarget) _panelTarget._allRows=rows;
        renderPanel(rows,title,artist,release,20,total,true);
      })
      .catch(err=>{ gBtn.disabled=false; stEl.className='err'; stEl.textContent='⚠ '+err.message;
        (function(url){ const a2=document.createElement('a'); a2.href=url; a2.target='_blank'; a2.rel='noopener noreferrer'; a2.textContent='Open on SoundExchange ↗'; a2.addEventListener('click',function(e){e.preventDefault();window.open(url,'_blank');}); fEl.innerHTML=''; fEl.appendChild(a2); })(sxPageUrl(title,artist,release||'')); });
  }
  function renderPanel(rows, title, artist, release, loadedSoFar, total, clearFirst) {
    if (_panelTarget && clearFirst) _panelTarget._allRows=rows; // store fresh results
    const stEl=panel.querySelector('#sx-pstatus'), rEl=panel.querySelector('#sx-presults'), fEl=panel.querySelector('#sx-pfoot');
    if (clearFirst) { rEl.innerHTML=''; stEl.textContent=total?`${total} result${total>1?'s':''}`:'' ; }
    const mbDurStr=_panelTarget?.mbDurStr||null;
    const mbEY=_panelTarget?getEarliestYear(_panelTarget.medium,_panelTarget.track):null;
    if (!rows.length&&clearFirst) { rEl.innerHTML='<div id="sx-pempty">No results — try adjusting the search.</div>'; }
    else rows.forEach((item,idx)=>{
      const f=fields(item);
      const meta=[f.artist,f.version,f.year,f.dur].filter(Boolean).join(' · ');
      const relMeta=[f.relTitle,f.relLabel,f.relDate].filter(Boolean).join(' · ');
      const cls=classifyResult(f.title,f.artist,f.dur,f.year,_panelTarget?.mbTitle||'',_panelTarget?.mbArtist||'',mbDurStr,mbEY);
      const isSelected=_panelTarget&&f.isrc&&f.isrc===_panelTarget.currentIsrc;
      const isBest=!isSelected&&cls==='best';
      const isWarn=!isSelected&&cls==='warn';
      const row=document.createElement('div');
      row.className='sx-prow'+(isSelected?' sx-prow-selected':isBest?' sx-prow-best':isWarn?' sx-prow-warn':'');
      const info=document.createElement('div'); info.className='sx-prow-info';
      const titleDiv=document.createElement('div'); titleDiv.className='sx-prow-title'; titleDiv.textContent=f.title||'(untitled)';
      const metaDiv=document.createElement('div'); metaDiv.className='sx-prow-meta'; metaDiv.textContent=meta||'—';
      const relDiv=document.createElement('div'); relDiv.className='sx-prow-meta'; relDiv.style.cssText='color:#6c757d;font-size:10.5px'; relDiv.textContent=relMeta||'';
      info.append(titleDiv,metaDiv); if(relMeta) info.appendChild(relDiv);
      const isrcDiv=document.createElement('div'); isrcDiv.className='sx-prow-isrc'; isrcDiv.textContent=f.isrc;
      row.append(info,isrcDiv);
      row.addEventListener('click',()=>{
        if (!_panelTarget?.inputEl) return;
        const inp=_panelTarget.inputEl;
        _panelTarget.currentIsrc=f.isrc;
        applyIsrc(f.isrc,inp);
        const cell=inp.closest('td')||inp.parentElement;
        const wrap=getWrap(cell);

        // Remove placeholder, then rebuild chip with all rows (picked first)
        wrap.querySelectorAll('.sx-chip-placeholder').forEach(e=>e.remove());
        const allRows=_panelTarget._allRows||[item];
        const reordered=[item,...allRows.filter(r=>fields(r).isrc!==f.isrc)];
        // Directly update chip display with selected item — don't call setChip (it re-picks bestIdx)
        wrap.querySelectorAll('.sx-chip-placeholder').forEach(e=>e.remove());
        let chip2=wrap.querySelector('.sx-chip');
        if (!chip2) {
          // No chip yet — create minimal chip shell
          chip2=document.createElement('div'); chip2.className='sx-chip';
          chip2.style.cssText='flex-direction:column;align-items:flex-start;gap:2px';
          const cr=document.createElement('div'); cr.style.cssText='display:flex;align-items:center;gap:7px;width:100%';
          const ci=document.createElement('span'); ci.className='sx-chip-isrc';
          const cm=document.createElement('span'); cm.className='sx-chip-meta';
          const cmore=document.createElement('span'); cmore.className='sx-chip-more'; cmore.textContent='+more';
          cmore.addEventListener('click',e=>{e.stopPropagation();openPanel(_panelTarget.mbTitle||'',_panelTarget.mbArtist||'',inp,null,getMbDur(_panelTarget.medium,_panelTarget.track));});
          cr.append(ci,cm,cmore); chip2.appendChild(cr);
          chip2.addEventListener('click',()=>applyIsrc(chip2.querySelector('.sx-chip-isrc').textContent,inp));
          wrap.appendChild(chip2);
        }
        // Update chip content with selected item
        const mbT2=_panelTarget.mbTitle||'', mbA2=_panelTarget.mbArtist||'';
        const ciEqP=(a,b)=>normCI(a)===normCI(b);
        const tOkP=!mbT2||ciEqP(f.title,mbT2); const aOkP=!mbA2||ciEqP(f.artist,mbA2);
        const ci2=chip2.querySelector('.sx-chip-isrc'); if(ci2) ci2.textContent=f.isrc;
        const cm2=chip2.querySelector('.sx-chip-meta');
        if (cm2) {
          const rStr=[f.version,f.year].filter(Boolean).join(' · ');
          const tH=tOkP?esc(f.title):'<span class="sx-field-bad">'+esc(f.title)+'</span>';
          const aH=f.artist?(aOkP?' — '+esc(f.artist):' — <span class="sx-field-bad">'+esc(f.artist)+'</span>'):'';
          cm2.innerHTML=tH+aH+(rStr?'  ·  '+esc(rStr):'');
          cm2.title=f.title+(f.artist?' — '+f.artist:'');
        }
        let rel2=chip2.querySelector('.sx-chip-rel');
        const relLine2=[f.relTitle,f.relLabel,f.relDate].filter(Boolean).join(' · ');
        if (relLine2) { if(!rel2){rel2=document.createElement('span');rel2.className='sx-chip-rel';chip2.appendChild(rel2);} rel2.textContent=relLine2; } else if(rel2) rel2.remove();
        // Update SX duration badge
        if (f.dur) setBadge(wrap,'sx-dur-sx','SX',f.dur);
        else { const old=wrap.querySelector('.sx-dur-sx'); if(old) old.remove(); }
        // Update row highlight
        const tr3=getRowEl(inp);
        if (tr3) {
          const sOk3=isGoodMatch(f.title,f.artist,mbT2,mbA2);
          tr3.classList.toggle('sx-songmismatch',!sOk3);
          tr3.classList.toggle('sx-mismatch',sOk3&&cls==='warn');
        }
        chip2.dataset.sxUserPicked='1';
        panel.classList.remove('open');
      });
      rEl.appendChild(row);
    });
    fEl.innerHTML='';
    if (loadedSoFar<total) {
      const lb=document.createElement('button'); lb.className='sx-loadmore';
      lb.textContent=`Load more (${loadedSoFar} of ${total} loaded)`;
      lb.onclick=()=>{ lb.disabled=true; lb.textContent='Loading…';
        apiSearch(title,artist,loadedSoFar,20,release).then(({rows:r,total:t})=>renderPanel(r,title,artist,release,loadedSoFar+r.length,t,false))
          .catch(err=>{ lb.disabled=false; lb.textContent='Retry — '+err.message; }); };
      fEl.appendChild(lb);
    }
    const a=document.createElement('a');
    a.target='_blank'; a.rel='noopener noreferrer';
    a.textContent='Open full search on SoundExchange ↗';
    function updateSxLink() {
      const t2=panel.querySelector('#sx-pt-inp')?.value.trim()||title;
      const ar=panel.querySelector('#sx-pa-inp')?.value.trim()||artist;
      const rl=panel.querySelector('#sx-pr-inp')?.value.trim()||release||'';
      a.href=sxPageUrl(t2,ar,rl);
    }
    updateSxLink();
    ['#sx-pt-inp','#sx-pa-inp','#sx-pr-inp'].forEach(id=>{
      panel.querySelector(id)?.addEventListener('input', updateSxLink);
    });
    a.addEventListener('click', function(e) {
      e.preventDefault();
      // Open SX home first, then navigate — works around Nuxt SPA param-reading bug
      const url=this.href;
      const w=window.open('https://isrc.soundexchange.com/','_blank');
      if (w) setTimeout(()=>{ w.location.replace(url); }, 1200);
      else window.open(url,'_blank');
    });
    fEl.appendChild(a);
  }

  /* ═══════════════════════════════════════════════
     SEARCH ALL
  ═══════════════════════════════════════════════ */
  function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
  const SX_BATCH_LIMIT = 30;

  async function searchAll(items, progEl, btn) {
    _batchAbort=false; _suppressFocus=true;
    btn.textContent='⏹ Stop';
    btn.onclick=()=>{ _batchAbort=true; };
    progEl.textContent=`0/${items.length}`;
    let done=0;
    for (const item of items) {
      if (_batchAbort) break;
      // Pause after every 30 searches and wait for explicit continuation
      if (done>0 && done%SX_BATCH_LIMIT===0) {
        _suppressFocus=false;
        btn.textContent='▶ Continue ('+( items.length-done)+' remaining)';
        progEl.textContent=`paused at ${done}/${items.length}`;
        await new Promise(resolve=>{
          btn.onclick=()=>{
            _batchAbort=false;
            btn.textContent='⏹ Stop';
            btn.onclick=()=>{ _batchAbort=true; };
            resolve();
          };
        });
        if (_batchAbort) break;
        _suppressFocus=true;
      }
      const wrap=getWrap(item.cell);
      const mbNow=getMbDur(item.inputEl.dataset.medium,item.inputEl.dataset.track);
      if (mbNow) setBadge(wrap,'sx-dur-mb','MB',mbNow);
      setStatus(wrap,'sx-chip-spin','⏳ searching…');
      try {
        const {rows}=await apiSearch(item.title,item.artist,0,20);
        const chosen=setChip(wrap,rows,item.inputEl,item.title,item.artist,item.inputEl.dataset.medium,item.inputEl.dataset.track);
        if (_autoFill&&chosen&&!item.inputEl.value.trim()&&!item.inputEl.dataset.sxCleared) applyIsrc(chosen,item.inputEl,true);
      } catch(err) { setStatus(wrap,'sx-chip-err','⚠ '+err.message); }
      done++;
      progEl.textContent=`${done}/${items.length}`;
      if (done<items.length && done%SX_BATCH_LIMIT!==0) await sleep(BATCH_DELAY);
    }
    _suppressFocus=false;
    progEl.textContent=_batchAbort?`stopped at ${done}/${items.length}`:`✓ ${done}/${items.length}`;
    // Append attribution to MagicISRC's edit note textarea when search was used
    if (!_batchAbort && done > 0) {
      const note = document.querySelector(
        'textarea[name=edit-note]'
      );
      if (note) {
        const credit = 'Powered by: MagicISRC → SoundExchange Quick Search: https://greasyfork.org/en/scripts/577713-magicisrc-soundexchange-quick-search';
        if (!note.value.includes(credit)) {
          note.value = (note.value.trim() ? note.value.trim() + '\n' : '') + credit;
          note.dispatchEvent(new Event('input', {bubbles:true}));
        }
      }
    }
    btn.textContent='Search on SoundExchange';
    btn.onclick=null;
    btn.dispatchEvent(new CustomEvent('sx-rebind'));
  }

  /* ═══════════════════════════════════════════════
     INJECT
  ═══════════════════════════════════════════════ */

  function injectAll() {
    // Per-row — limit MB release fetches to first 30 tracks
    const allNewInputs = Array.from(document.querySelectorAll('input[data-medium][data-track]:not([data-sx-done])'));
    const alreadyDone  = document.querySelectorAll('input[data-medium][data-track][data-sx-done]').length;
    const MB_FETCH_LIMIT = 30;
    const canFetchMb = alreadyDone < MB_FETCH_LIMIT;
    let mbFetchCount = alreadyDone;


    allNewInputs.forEach(inp=>{
      inp.dataset.sxDone='1';
      const tr=inp.closest('tr');
      if (!tr) return;
      const titleEl=tr.querySelector('.col-lg-7 bdi')||tr.querySelector('.col-lg-7');
      const title=titleEl?titleEl.textContent.trim():'';
      const artist=extractArtist(tr);
      const cell=inp.closest('td')||inp.parentElement;
      const medium=inp.dataset.medium, track=inp.dataset.track;
      watchForUserClear(inp);
      cell.dataset.sxTitle=title; cell.dataset.sxArtist=artist;

      // Highlight rows with no ISRC — check after short delay for MagicISRC to populate
      (function() {
        var tr1 = inp.closest('tr');
        if (!tr1) return;
        function checkIsrc() {
          var ul = cell.querySelector('ul.list-unstyled');
          var hasExisting = ul && ul.querySelector('samp') && ul.querySelector('samp').textContent.trim().length > 0;
          tr1.classList.toggle('sx-no-isrc', !hasExisting);
        }
        checkIsrc();
        setTimeout(checkIsrc, 800);
        setTimeout(checkIsrc, 2000);
      })();


      // "+1" button: fills this input with prev ISRC incremented by 1
      (function() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sx-next-isrc';
        btn.title = 'Fill with previous ISRC + 1';
        btn.textContent = '+1';
        btn.addEventListener('click', () => {
          const allInputs = Array.from(document.querySelectorAll('input[data-medium][data-track]'));
          const myIdx = allInputs.indexOf(inp);
          if (myIdx <= 0) return;
          const prevInp = allInputs[myIdx - 1];
          // Use input value, or fall back to ISRC shown above the input in the <ul><li><samp>
          let prevVal = prevInp.value.trim();
          if (!prevVal) {
            const prevCell = prevInp.closest('td') || prevInp.parentElement;
            const prevSamp = prevCell && prevCell.querySelector('ul.list-unstyled samp');
            prevVal = prevSamp ? prevSamp.textContent.trim() : '';
          }
          if (!prevVal) return;
          const incremented = prevVal.replace(/(\d+)(?!.*\d)/, (m) => {
            const n = parseInt(m, 10) + 1;
            return String(n).padStart(m.length, '0');
          });
          applyIsrc(incremented, inp);
          // Immediately look up the new ISRC on SoundExchange
          if (/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/i.test(incremented)) lookupIsrc(incremented, inp);
        });
        // Flex wrapper so +1 appears to the right of the input
        const bw=document.createElement('div');
        bw.style.cssText='display:flex;align-items:center;gap:5px;';
        inp.parentNode.insertBefore(bw, inp);
        bw.appendChild(inp); bw.appendChild(btn);
        inp.style.flex='1 1 auto';
      })();
      const mbNow=getMbDur(medium,track);
      if (mbNow) setBadge(getWrap(cell),'sx-dur-mb','MB',mbNow);
      if (mbFetchCount < MB_FETCH_LIMIT) {
        mbFetchCount++;
        inp.dataset.sxMbDone='1';
        fetchMbReleasesForCell(inp,cell,medium,track,title,artist);
      } else {
        // Show inline "Load releases" button in the cell
        const wrap0b=getWrap(cell);
        if (!cell.querySelector('.sx-mb-rels')) {
          const rc=document.createElement('div'); rc.className='sx-mb-rels';
          const loadBtn2=document.createElement('button');
          loadBtn2.type='button';
          loadBtn2.className='sx-mb-spin';
          loadBtn2.style.cssText='cursor:pointer;color:#0d6efd;background:none;border:none;padding:0;font-size:10.5px;';
          loadBtn2.textContent='⏬ Load MB releases';
          loadBtn2.addEventListener('click', ()=>{
            // Load next 30 unloaded tracks from this point
            let loaded=0;
            document.querySelectorAll('input[data-medium][data-track]:not([data-sx-mb-done])').forEach(inp2=>{
              if (loaded>=30) return;
              loaded++;
              inp2.dataset.sxMbDone='1';
              const cell2=inp2.closest('td')||inp2.parentElement;
              const medium2=inp2.dataset.medium, track2=inp2.dataset.track;
              const title2=cell2.dataset.sxTitle||'', artist2=cell2.dataset.sxArtist||'';
              // Clear any existing placeholder
              const rc2=cell2.querySelector('.sx-mb-rels');
              if (rc2) rc2.innerHTML='';
              delete cell2.dataset.sxRelsDone;
              fetchMbReleasesForCell(inp2,cell2,medium2,track2,title2,artist2);
            });
          });
          rc.appendChild(loadBtn2);
          cell.insertBefore(rc, wrap0b);
        }
      }
      // Show a "Search SX" placeholder chip immediately (before batch search)
      var wrap0=getWrap(cell);
      if (!wrap0.querySelector('.sx-chip,.sx-chip-none,.sx-chip-err,.sx-chip-spin,.sx-chip-placeholder')) {
        var ph=document.createElement('span');
        ph.className='sx-chip-placeholder sx-chip-none';
        ph.style.cursor='pointer';
        ph.innerHTML='<span style="color:#6f42c1;text-decoration:underline dotted">Search on SoundExchange</span>';
        ph.title='Click to search SoundExchange for this track';
        ph.addEventListener('click',function(){ openPanel(title,artist,inp,null,getMbDur(medium,track)); });
        wrap0.appendChild(ph);
      }

    });

    // Global search bar (re-inject on SPA navigation)
    if (!document.getElementById('sx-global-bar')) {
      const firstInp=document.querySelector('input[data-medium][data-track]');
      if (!firstInp) return;
      const bar=document.createElement('div'); bar.id='sx-global-bar'; bar.className='sx-all-bar';
      const btn=document.createElement('button'); btn.type='button'; btn.className='sx-all-btn';
      btn.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search on SoundExchange';
      const progEl=document.createElement('span'); progEl.className='sx-all-prog';
      function bindBtn() {
        btn.onclick=()=>{
          const items=[];
          document.querySelectorAll('input[data-medium][data-track]').forEach(inp=>{
            const cell=inp.closest('td')||inp.parentElement;
            const tr=inp.closest('tr');
            const tEl=tr?(tr.querySelector('.col-lg-7 bdi')||tr.querySelector('.col-lg-7')):null;
            items.push({inputEl:inp,cell,
              title:(tEl?tEl.textContent.trim():'')||cell.dataset.sxTitle||'',
              artist:extractArtist(tr)||cell.dataset.sxArtist||''});
          });
          searchAll(items,progEl,btn).then(bindBtn);
        };
      }
      bindBtn();
      btn.addEventListener('sx-rebind', bindBtn);
      // Option toggles (saved to localStorage)
      function makeOpt(label, getVal, setVal) {
        const wrap=document.createElement('label'); wrap.className='sx-exact-wrap';
        const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=getVal();
        cb.addEventListener('change',()=>{ setVal(cb.checked); saveOptions(); });
        const lbl=document.createElement('span'); lbl.className='sx-exact-label'; lbl.textContent=label;
        wrap.append(cb,lbl); return wrap;
      }
      bar.append(btn, progEl,
        makeOpt('auto-fill',   ()=>_autoFill,    v=>{ _autoFill=v;    }),
        makeOpt('exact title', ()=>_exactTitle,  v=>{ _exactTitle=v;  }),
        makeOpt('exact artist',()=>_exactArtist, v=>{ _exactArtist=v; })
      );
      // Inject right after MagicISRC's sticky navbar so our bar sticks below it
      const nav=document.querySelector('nav.navbar,.navbar,header');
      if (nav && nav.nextElementSibling) {
        nav.after(bar);
      } else {
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
  }


  refreshToken().catch(e=>console.warn('[SX] Token pre-fetch failed:',e.message));
  function tryInject() { if (document.querySelector('input[data-medium][data-track]')) injectAll(); }
  let _injectTimer=null;
  function debouncedInject() { clearTimeout(_injectTimer); _injectTimer=setTimeout(tryInject,150); }
  setTimeout(tryInject, 400);
  new MutationObserver(debouncedInject).observe(document.body,{childList:true,subtree:true});

})();