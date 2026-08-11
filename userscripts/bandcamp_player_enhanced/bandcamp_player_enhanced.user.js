// ==UserScript==
// @name         Bandcamp Player Enhanced
// @description  Custom sticky 2-row player. Space=play/pause, Shift+Space=scroll, Up/Down=prev/next, Shift+Up/Down=volume, Left/Right=seek 5s (Shift=30s). P=preview mode.
// @version      2026.01.01
// @author       majkinetor
// @namespace    http://violentmonkey.net/
// @match        https://*.bandcamp.com/album/*
// @grant        none
// @license      MIT
// @author       majkinetor
// @downloadURL  https://update.greasyfork.org/scripts/571566/Bandcamp%20Player%20Enhanced.user.js
// @updateURL    https://update.greasyfork.org/scripts/571566/Bandcamp%20Player%20Enhanced.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const SEEK_SMALL    = 5;
    const SEEK_LARGE    = 30;
    const VOL_STEP      = 0.05;
    const VOL_KEY       = 'bcp_volume';
    const MUTE_KEY      = 'bcp_muted';
    const BAR_H         = 72;
    const PREVIEW_SECS  = 30; // seconds to play per track in preview mode

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    function getAudio()        { return document.querySelector('audio'); }
    function getNativeBtn(sel) { return document.querySelector(sel); }

    function fmt(s) {
        if (!isFinite(s) || isNaN(s)) return '0:00';
        s = Math.floor(s);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function seekRelative(sec) {
        const a = getAudio(); if (!a) return;
        a.currentTime = Math.max(0, Math.min(a.duration || Infinity, a.currentTime + sec));
    }

    // ─── Volume persistence ────────────────────────────────────────────────────────
    // Use sessionStorage for cross-page persistence within the tab;
    // also write to localStorage so new tabs inherit the value.

    function saveVol(v, muted) {
        try {
            localStorage.setItem(VOL_KEY,  v);
            localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
            sessionStorage.setItem(VOL_KEY,  v);
            sessionStorage.setItem(MUTE_KEY, muted ? '1' : '0');
        } catch(e) {}
    }
    function loadVol() {
        try {
            // prefer sessionStorage (same tab, most recent)
            const v = parseFloat(sessionStorage.getItem(VOL_KEY) ?? localStorage.getItem(VOL_KEY));
            return isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
        } catch(e) { return 1; }
    }
    function loadMuted() {
        try {
            const s = sessionStorage.getItem(MUTE_KEY) ?? localStorage.getItem(MUTE_KEY);
            return s === '1';
        } catch(e) { return false; }
    }

    // ─── Artist / album info ───────────────────────────────────────────────────────

    function getAlbumInfo() {
        let artist = '', album = '';
        if (window.TralbumData) {
            artist = window.TralbumData.artist || '';
            album  = window.TralbumData.current?.title || '';
        }
        if (!artist) {
            const el = document.querySelector('#band-name-location .title, .albumTitle ~ .artist, span[itemprop="byArtist"] span, #name-section p span');
            if (el) artist = el.textContent.trim();
        }
        if (!artist) {
            const el = document.querySelector('p.artist-name, .artist span, .band-name');
            if (el) artist = el.textContent.trim();
        }
        if (!album) {
            const el = document.querySelector('h2.trackTitle, .albumTitle, [itemprop="name"]');
            if (el) album = el.textContent.trim();
        }
        return { artist, album };
    }

    // ─── Track info ────────────────────────────────────────────────────────────────

    function getAllTracks() {
        if (window.TralbumData?.trackinfo?.length)
            return window.TralbumData.trackinfo.map(t => t.title || '');
        const rows = document.querySelectorAll('.track_row_view');
        if (rows.length)
            return Array.from(rows).map(r => { const t = r.querySelector('.track-title, .title'); return t ? t.textContent.trim() : ''; });
        const h2 = document.querySelector('#name-section h2.trackTitle, h2.trackTitle');
        return h2 ? [h2.textContent.trim()] : [];
    }

    function getCurrentIndex() {
        const audio = getAudio();
        if (audio?.src && window.TralbumData?.trackinfo?.length) {
            const src = audio.src;
            const idx = window.TralbumData.trackinfo.findIndex(t =>
                t.file && Object.values(t.file).some(url => {
                    const key = url.split('?')[0].split('/').pop().split('.')[0];
                    return key && src.includes(key);
                })
            );
            if (idx !== -1) return idx;
        }
        const rows = document.querySelectorAll('.track_row_view');
        let found = -1;
        rows.forEach((r, i) => { if (r.classList.contains('current_track') || r.classList.contains('playing')) found = i; });
        return found;
    }

    function jumpToTrack(index) {
        const rows = document.querySelectorAll('.track_row_view');
        if (rows[index]) {
            const btn = rows[index].querySelector('.play_status, .play_col, .track_play_hilite, a.play_row_for');
            if (btn) { btn.click(); return; }
            const link = rows[index].querySelector('.title-col a, .track-title a');
            if (link) { link.click(); return; }
            rows[index].click();
            return;
        }
        const cur = getCurrentIndex();
        if (cur === -1) return;
        const diff = index - cur;
        if (diff === 0) return;
        const btn = diff > 0 ? getNativeBtn('.nextbutton') : getNativeBtn('.prevbutton');
        let steps = Math.abs(diff);
        (function step() { if (steps-- <= 0) return; if (btn) btn.click(); if (steps > 0) setTimeout(step, 80); })();
    }

    // ─── Preload first track without audible playback ────────────────────────────
    // We click the FIRST TRACK ROW directly (not .playbutton which loads whatever
    // Bandcamp had last selected). Then mute → wait for buffer → pause + unmute.

    let preloadDone  = false;
    let preloadReady = false;

    function preloadFirstTrack() {
        if (preloadDone) return;
        if (!window.TralbumData?.trackinfo?.length) return;

        // Find the clickable element inside the first track row
        const firstRow = document.querySelector('.track_row_view');
        if (!firstRow) return;
        const trigger =
            firstRow.querySelector('.play_status') ||
            firstRow.querySelector('.play_col') ||
            firstRow.querySelector('.track_play_hilite') ||
            firstRow.querySelector('a.play_row_for') ||
            firstRow.querySelector('.title-col .linked-title a') ||
            firstRow.querySelector('.title-col a') ||
            firstRow;
        if (!trigger) return;

        preloadDone = true;
        const savedVol = loadVol();

        function muteAndClick() {
            // Pre-mute any existing audio element
            const a = getAudio();
            if (a) { a.volume = 0; a.muted = true; }

            // Click the first track row to load it into Bandcamp's player
            trigger.click();
            waitForBuffer(80); // up to 4s
        }

        function waitForBuffer(attempts) {
            if (attempts <= 0) {
                const a = getAudio();
                if (a) { a.pause(); a.muted = false; a.volume = loadMuted() ? 0 : savedVol; a.currentTime = 0; }
                preloadReady = true;
                syncVolSlider(savedVol);
                return;
            }
            const a = getAudio();
            if (!a) { setTimeout(() => waitForBuffer(attempts - 1), 50); return; }

            // Keep muted every poll in case Bandcamp resets it
            a.volume = 0;
            a.muted  = true;

            if (a.readyState >= 2 || (isFinite(a.duration) && a.duration > 0)) {
                a.pause();
                a.currentTime = 0;
                a.muted  = false;
                a.volume = loadMuted() ? 0 : savedVol;
                a._bcpInited = true; // mark as already initialised so tick doesn't re-apply
                preloadReady = true;
                syncVolSlider(savedVol);
                return;
            }
            setTimeout(() => waitForBuffer(attempts - 1), 50);
        }

        function syncVolSlider(v) {
            const volEl = document.getElementById('bcp-vol');
            if (volEl) volEl.value = String(v);
        }

        setTimeout(muteAndClick, 400);
    }

    // ─── Preview mode ─────────────────────────────────────────────────────────────

    let previewActive   = false;
    let previewIndex    = 0;
    let previewTimer    = null;
    let previewStarted  = false; // has audio started for this track yet

    function startPreview() {
        previewActive  = true;
        previewIndex   = Math.max(0, getCurrentIndex());
        previewStarted = false;
        updatePreviewBtn();
        playPreviewTrack();
    }

    function stopPreview() {
        previewActive = false;
        if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
        updatePreviewBtn();
        // pause playback
        const a = getAudio(); if (a) a.pause();
    }

    function togglePreview() {
        if (previewActive) stopPreview(); else startPreview();
    }

    function updatePreviewBtn() {
        const btn = document.getElementById('bcp-preview');
        if (!btn) return;
        btn.classList.toggle('active', previewActive);
        btn.title = previewActive ? 'Stop preview (P)' : `Preview 30s per track (P)`;
    }

    function playPreviewTrack() {
        if (!previewActive) return;
        const tracks = getAllTracks();
        if (previewIndex >= tracks.length) { stopPreview(); return; }

        jumpToTrack(previewIndex);
        previewStarted = false;

        // Wait for audio to actually start playing, then seek to middle and schedule next
        function waitForPlay(attempts) {
            if (!previewActive) return;
            if (attempts <= 0) { previewIndex++; playPreviewTrack(); return; }
            const a = getAudio();
            if (a && !a.paused && a.readyState >= 2) {
                previewStarted = true;
                // Seek to middle of track for the most interesting part
                if (isFinite(a.duration) && a.duration > PREVIEW_SECS) {
                    const mid = Math.max(0, a.duration / 2 - PREVIEW_SECS / 2);
                    a.currentTime = mid;
                }
                if (previewTimer) clearTimeout(previewTimer);
                previewTimer = setTimeout(() => {
                    if (!previewActive) return;
                    previewIndex++;
                    playPreviewTrack();
                }, PREVIEW_SECS * 1000);
                return;
            }
            setTimeout(() => waitForPlay(attempts - 1), 100);
        }
        waitForPlay(30); // up to 3s of waiting
    }

    // Watch for track changes during preview to keep index in sync
    function previewTickCheck() {
        if (!previewActive || !previewStarted) return;
        const cur = getCurrentIndex();
        if (cur !== -1 && cur !== previewIndex) {
            // User manually changed track; update index and reschedule
            previewIndex = cur;
            if (previewTimer) clearTimeout(previewTimer);
            previewTimer = setTimeout(() => { if (!previewActive) return; previewIndex++; playPreviewTrack(); }, PREVIEW_SECS * 1000);
        }
    }

    // ─── Tags ──────────────────────────────────────────────────────────────────────

    function getTags() {
        return Array.from(document.querySelectorAll('a.tag, .tags a, [class*="tag"] a'))
            .map(a => a.textContent.trim())
            .filter(t => t.length > 0 && t.length < 40);
    }

    // ─── Hide page elements ────────────────────────────────────────────────────────

    function hidePageElements() {
        const s = document.createElement('style');
        s.id = 'bcp-hide-native';
        s.textContent = `
            .inline_player, #player, .html5-player,
            div[id="player"], div.player-section    { display: none !important; }
            .track_list, ol.track_list,
            table.track_list                        { display: none !important; }
            .tralbumData.tralbum-tags, .tags,
            .tag-list, div.tralbum-tags,
            p.tags-inner                            { display: none !important; }
        `;
        document.head.appendChild(s);
    }

    // ─── SVG icons ────────────────────────────────────────────────────────────────

    const SVG_VOL  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="1,4 5,4 9,1 9,13 5,10 1,10" fill="currentColor"/><path d="M10.5 4.5 Q12.5 7 10.5 9.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M11.8 2.8 Q14.5 7 11.8 11.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`;
    const SVG_MUTE = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="1,4 5,4 9,1 9,13 5,10 1,10" fill="currentColor"/><path d="M10.5 4.5 Q12.5 7 10.5 9.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M11.8 2.8 Q14.5 7 11.8 11.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/><line x1="1" y1="13" x2="13" y2="1" stroke="#e05" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    const SVG_PLAY  = `<svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 12,6.5 0,13"/></svg>`;
    const SVG_PAUSE = `<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="4" height="13"/><rect x="7" y="0" width="4" height="13"/></svg>`;

    // ─── Build player ──────────────────────────────────────────────────────────────

    function buildPlayer() {
        if (document.getElementById('bc-sticky-player')) return null;

        hidePageElements();

        const savedVol   = loadVol();
        const savedMuted = loadMuted();

        const bar = document.createElement('div');
        bar.id = 'bc-sticky-player';
        bar.innerHTML = `
<style>
#bc-sticky-player {
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 999999;
    font-family: 'Courier New', monospace;
    background: #141414;
    border-bottom: 2px solid #1da0c3;
    color: #e8e8e8;
    display: flex; flex-direction: column;
    box-shadow: 0 2px 20px rgba(29,160,195,0.15);
    user-select: none;
}
#bc-sticky-player * { box-sizing: border-box; }

/* row 1 */
#bcp-row1 {
    display: flex; align-items: center; gap: 10px;
    padding: 0 12px; height: 50px;
}

/* row 2 */
#bcp-row2 {
    height: 22px;
    display: flex; align-items: center;
    padding: 0 10px 2px;
    border-top: 1px solid #1e1e1e;
    overflow: hidden;
    gap: 0;
}
#bcp-album-info {
    font-size: 10px;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
    max-width: 40%;
    letter-spacing: 0.02em;
}
#bcp-album-info .bcp-artist { color: #aaa; }
#bcp-album-info .bcp-sep    { color: #444; margin: 0 4px; }
#bcp-album-info .bcp-album  { color: #666; }
#bcp-row2-spacer { flex: 1; }
#bcp-tags-label {
    font-size: 8px; color: #333;
    text-transform: uppercase; letter-spacing: 0.1em;
    flex-shrink: 0; margin-right: 5px;
}
#bcp-tags-list {
    display: flex; gap: 5px;
    overflow: hidden; flex-wrap: nowrap;
    flex-direction: row-reverse;
}
.bcp-tag {
    font-size: 11px; color: #ccc;
    background: transparent; border: none;
    padding: 0 2px;
    white-space: nowrap;
    letter-spacing: 0.03em;
    font-family: 'Courier New', monospace;
}
.bcp-tag::before { content: '#'; color: #555; }

/* transport buttons — fixed identical size */
.bcp-btn {
    background: none; border: 1px solid #2e2e2e; color: #888;
    border-radius: 3px;
    width: 34px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    font-family: inherit; font-size: 13px; cursor: pointer;
    transition: border-color .12s, color .12s, background .12s;
    flex-shrink: 0; padding: 0;
}
.bcp-btn:hover { border-color: #1da0c3; color: #1da0c3; background: rgba(29,160,195,0.08); }
#bcp-play { border-color: #1da0c3; color: #1da0c3; width: 36px; }
#bcp-play:hover { background: rgba(29,160,195,0.18); }

/* preview button */
#bcp-preview {
    font-size: 10px; letter-spacing: 0.04em; width: auto; padding: 0 8px;
    color: #666; border-color: #2a2a2a;
}
#bcp-preview.active { color: #f90; border-color: #f90; background: rgba(255,153,0,0.08); }
#bcp-preview:hover  { color: #f90; border-color: #f90; background: rgba(255,153,0,0.1); }

/* info area */
#bcp-info {
    flex: 1; min-width: 0;
    display: flex; align-items: baseline; gap: 8px;
    cursor: pointer; overflow: hidden;
    padding: 4px 6px; border-radius: 3px;
    transition: background .12s;
}
#bcp-info:hover { background: rgba(255,255,255,0.04); }
#bcp-meta  { font-size: 11px; color: #1da0c3; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.03em; }
#bcp-title { font-size: 13px; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#bcp-info-hint { font-size: 10px; color: #383838; white-space: nowrap; flex-shrink: 0; margin-left: auto; padding-left: 6px; }

/* time */
#bcp-time { font-size: 12px; color: #888; flex-shrink: 0; min-width: 90px; text-align: center; letter-spacing: 0.04em; }

/* seek */
.bcp-seek { flex: 0 1 180px; min-width: 80px; display: flex; align-items: center; }
.bcp-range {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 3px; border-radius: 2px;
    background: #2a2a2a; outline: none; cursor: pointer; accent-color: #1da0c3;
}
.bcp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 11px; height: 11px; border-radius: 50%; background: #1da0c3; cursor: pointer; }

/* volume */
.bcp-vol-wrap { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
#bcp-vol-icon {
    color: #666; cursor: pointer;
    display: inline-flex; align-items: center;
    padding: 2px; border-radius: 2px;
    transition: color .12s; line-height: 0;
}
#bcp-vol-icon:hover { color: #1da0c3; }
#bcp-vol-icon.muted { color: #444; }
.bcp-vol {
    -webkit-appearance: none; appearance: none;
    width: 70px; height: 3px; border-radius: 2px;
    background: #2a2a2a; outline: none; cursor: pointer; accent-color: #1da0c3;
}
.bcp-vol::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #1da0c3; cursor: pointer; }

/* dropdown */
#bcp-dropdown {
    position: fixed; top: ${BAR_H + 2}px; left: 0; right: 0;
    z-index: 999998; background: #181818;
    border-bottom: 2px solid #1da0c3;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    max-height: 320px; overflow-y: auto;
    display: none; font-family: 'Courier New', monospace;
}
#bcp-dropdown.open { display: block; }
#bcp-dropdown::-webkit-scrollbar { width: 6px; }
#bcp-dropdown::-webkit-scrollbar-track { background: #111; }
#bcp-dropdown::-webkit-scrollbar-thumb { background: #2e2e2e; border-radius: 3px; }
.bcp-track-item {
    padding: 8px 16px; font-size: 12px; color: #777; cursor: pointer;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid #1c1c1c;
    transition: background .1s, color .1s;
}
.bcp-track-item:hover { background: rgba(29,160,195,0.08); color: #eee; }
.bcp-track-item.active { color: #1da0c3; font-weight: bold; background: rgba(29,160,195,0.06); }
.bcp-track-num { min-width: 28px; color: #383838; font-size: 11px; text-align: right; flex-shrink: 0; }
.bcp-track-item.active .bcp-track-num { color: #1da0c3; }
</style>

<div id="bcp-row1">
    <button class="bcp-btn" id="bcp-prev"    title="Prev (↑)">&#9664;&#9664;</button>
    <button class="bcp-btn" id="bcp-play"    title="Play/Pause (Space)">${SVG_PLAY}</button>
    <button class="bcp-btn" id="bcp-next"    title="Next (↓)">&#9654;&#9654;</button>
    <button class="bcp-btn" id="bcp-preview" title="Preview 30s per track (P)">PREVIEW</button>

    <div id="bcp-info" title="Click to browse tracks">
        <span id="bcp-meta">— / —</span>
        <span id="bcp-title">—</span>
        <span id="bcp-info-hint">&#9662; tracks</span>
    </div>

    <span id="bcp-time">0:00 / 0:00</span>

    <div class="bcp-seek">
        <input type="range" class="bcp-range" id="bcp-seek" min="0" max="100" value="0" step="0.1">
    </div>

    <div class="bcp-vol-wrap">
        <span id="bcp-vol-icon" title="Mute/unmute (click)">${SVG_VOL}</span>
        <input type="range" class="bcp-vol" id="bcp-vol" min="0" max="1" step="0.02" value="${savedVol}">
    </div>
</div>

<div id="bcp-row2">
    <span id="bcp-album-info">
        <span class="bcp-artist"></span><span class="bcp-sep"></span><span class="bcp-album"></span>
    </span>
    <span id="bcp-row2-spacer"></span>
    <span id="bcp-tags-label">tags</span>
    <div id="bcp-tags-list"></div>
</div>

<div id="bcp-dropdown"></div>`;

        document.body.insertBefore(bar, document.body.firstChild);
        document.body.style.paddingTop = BAR_H + 'px';

        // ── transport ────────────────────────────────────────────────────────────
        document.getElementById('bcp-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            if (previewActive) { previewIndex = Math.max(0, previewIndex - 1); if (previewTimer) clearTimeout(previewTimer); playPreviewTrack(); return; }
            const b = getNativeBtn('.prevbutton'); if (b) b.click();
        });
        document.getElementById('bcp-play').addEventListener('click', (e) => {
            e.stopPropagation();
            if (previewActive) stopPreview();
            const b = getNativeBtn('.playbutton'); if (b) b.click();
        });
        document.getElementById('bcp-next').addEventListener('click', (e) => {
            e.stopPropagation();
            if (previewActive) { previewIndex++; if (previewTimer) clearTimeout(previewTimer); playPreviewTrack(); return; }
            const b = getNativeBtn('.nextbutton'); if (b) b.click();
        });
        document.getElementById('bcp-preview').addEventListener('click', (e) => {
            e.stopPropagation(); togglePreview();
        });

        // ── seek ─────────────────────────────────────────────────────────────────
        const seekEl = document.getElementById('bcp-seek');
        let seekDragging = false;
        seekEl.addEventListener('mousedown', () => { seekDragging = true; });
        window.addEventListener('mouseup',   () => { seekDragging = false; });
        seekEl.addEventListener('input', () => {
            const a = getAudio(); if (a && isFinite(a.duration)) a.currentTime = (seekEl.value / 100) * a.duration;
        });

        // ── wheel seek (anywhere inside the bar) ─────────────────────────────────
        // Scrolling up = forward 5s, scrolling down = rewind 5s.
        // Shift+wheel = 30s jumps. Page scroll is suppressed while over the bar.
        bar.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const amount = e.shiftKey ? SEEK_LARGE : SEEK_SMALL;
            // deltaY > 0 = scroll down = rewind; deltaY < 0 = scroll up = forward
            seekRelative(e.deltaY < 0 ? amount : -amount);
        }, { passive: false });

        // ── volume ───────────────────────────────────────────────────────────────
        const volEl   = document.getElementById('bcp-vol');
        const volIcon = document.getElementById('bcp-vol-icon');
        let isMuted   = savedMuted;

        function updateVolIcon() {
            volIcon.innerHTML = isMuted ? SVG_MUTE : SVG_VOL;
            volIcon.classList.toggle('muted', isMuted);
        }

        function applyVol(newVal, newMuted) {
            if (newVal   !== undefined) volEl.value = String(Math.max(0, Math.min(1, newVal)));
            if (newMuted !== undefined) isMuted = newMuted;
            const a = getAudio();
            if (a) a.volume = isMuted ? 0 : parseFloat(volEl.value);
            updateVolIcon();
            saveVol(parseFloat(volEl.value), isMuted);
        }

        // Apply saved values immediately
        volEl.value = String(savedVol);
        updateVolIcon();
        const initAudio = getAudio();
        if (initAudio) initAudio.volume = savedMuted ? 0 : savedVol;

        volEl.addEventListener('input', () => applyVol(parseFloat(volEl.value), false));
        volIcon.addEventListener('click', (e) => { e.stopPropagation(); applyVol(undefined, !isMuted); });

        // ── dropdown ─────────────────────────────────────────────────────────────
        const dropdown = document.getElementById('bcp-dropdown');
        const infoEl   = document.getElementById('bcp-info');

        function openDropdown() {
            const tracks = getAllTracks(), cur = getCurrentIndex();
            dropdown.innerHTML = tracks.map((name, i) => `
                <div class="bcp-track-item${i === cur ? ' active' : ''}" data-index="${i}">
                    <span class="bcp-track-num">${i + 1}.</span>
                    <span>${name || '(untitled)'}</span>
                </div>`).join('');
            dropdown.classList.add('open');
            const active = dropdown.querySelector('.active');
            if (active) active.scrollIntoView({ block: 'nearest' });
            dropdown.querySelectorAll('.bcp-track-item').forEach(item =>
                item.addEventListener('click', () => { jumpToTrack(parseInt(item.dataset.index)); dropdown.classList.remove('open'); })
            );
        }

        infoEl.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.contains('open') ? dropdown.classList.remove('open') : openDropdown();
        });
        document.addEventListener('click', (e) => { if (!bar.contains(e.target)) dropdown.classList.remove('open'); });

        return {
            seekEl, volEl,
            isMuted:      () => isMuted,
            seekDragging: () => seekDragging,
            applyVol
        };
    }

    // ─── Tags & album info update ──────────────────────────────────────────────────

    let lastTagStr = '', lastAlbumStr = '';

    function updateRow2() {
        // tags
        const tags = getTags();
        const tStr = tags.join('|');
        if (tStr !== lastTagStr) {
            lastTagStr = tStr;
            const el = document.getElementById('bcp-tags-list');
            if (el) el.innerHTML = tags.map(t => `<span class="bcp-tag">${t}</span>`).join('');
        }
        // artist / album
        const { artist, album } = getAlbumInfo();
        const aStr = artist + '|' + album;
        if (aStr !== lastAlbumStr) {
            lastAlbumStr = aStr;
            const artistEl = document.querySelector('#bcp-album-info .bcp-artist');
            const sepEl    = document.querySelector('#bcp-album-info .bcp-sep');
            const albumEl  = document.querySelector('#bcp-album-info .bcp-album');
            if (artistEl) artistEl.textContent = artist;
            if (albumEl)  albumEl.textContent  = album;
            if (sepEl)    sepEl.textContent    = (artist && album) ? '·' : '';
        }
    }

    // ─── Tick ──────────────────────────────────────────────────────────────────────

    let controls = null;

    function tick() {
        if (!controls) { controls = buildPlayer(); if (!controls) return; }

        preloadFirstTrack();
        previewTickCheck();

        const audio   = getAudio();
        const playBtn = document.getElementById('bcp-play');
        const timeEl  = document.getElementById('bcp-time');
        const titleEl = document.getElementById('bcp-title');
        const metaEl  = document.getElementById('bcp-meta');
        const { seekEl, volEl, isMuted, seekDragging, applyVol } = controls;

        if (!audio) { playBtn.innerHTML = SVG_PLAY; return; }

        // Restore volume every time a new <audio> element appears (track change).
        // Skip while preload is in progress — it manages mute/volume itself.
        if (!audio._bcpInited && preloadReady) {
            audio._bcpInited = true;
            applyVol(loadVol(), loadMuted());
        }

        playBtn.innerHTML = audio.paused ? SVG_PLAY : SVG_PAUSE;
        timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;

        if (!seekDragging() && isFinite(audio.duration) && audio.duration > 0)
            seekEl.value = (audio.currentTime / audio.duration) * 100;

        if (!volEl.matches(':active') && !isMuted())
            volEl.value = String(audio.volume);

        const tracks = getAllTracks(), cur = getCurrentIndex();
        metaEl.textContent  = `${cur >= 0 ? cur + 1 : '?'} / ${tracks.length || '?'}`;
        titleEl.textContent = (cur >= 0 && tracks[cur]) ? tracks[cur] : '—';

        updateRow2();
    }

    // ─── Keyboard ─────────────────────────────────────────────────────────────────

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        const dropdown = document.getElementById('bcp-dropdown');

        // Shift+Space → scroll down
        if (e.key === ' ' && e.shiftKey) {
            e.preventDefault(); e.stopPropagation();
            window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
            return;
        }

        // Shift+Up/Down → volume
        if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault(); e.stopPropagation();
            if (!controls) return;
            const { volEl, isMuted, applyVol } = controls;
            const cur  = parseFloat(volEl.value);
            const next = e.key === 'ArrowUp' ? Math.min(1, cur + VOL_STEP) : Math.max(0, cur - VOL_STEP);
            applyVol(next, isMuted() && next > 0 ? false : isMuted());
            return;
        }

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault(); e.stopPropagation();
                seekRelative(e.shiftKey ? -SEEK_LARGE : -SEEK_SMALL); break;
            case 'ArrowRight':
                e.preventDefault(); e.stopPropagation();
                seekRelative(e.shiftKey ? SEEK_LARGE : SEEK_SMALL); break;
            case 'ArrowUp':
                e.preventDefault(); e.stopPropagation();
                if (dropdown) dropdown.classList.remove('open');
                if (previewActive) { previewIndex = Math.max(0, previewIndex - 1); if (previewTimer) clearTimeout(previewTimer); playPreviewTrack(); break; }
                { const b = getNativeBtn('.prevbutton'); if (b) b.click(); }
                break;
            case 'ArrowDown':
                e.preventDefault(); e.stopPropagation();
                if (dropdown) dropdown.classList.remove('open');
                if (previewActive) { previewIndex++; if (previewTimer) clearTimeout(previewTimer); playPreviewTrack(); break; }
                { const b = getNativeBtn('.nextbutton'); if (b) b.click(); }
                break;
            case ' ':
            case 'Spacebar':
                e.preventDefault(); e.stopPropagation();
                if (previewActive) { stopPreview(); }
                { const b = getNativeBtn('.playbutton'); if (b) b.click(); }
                break;
            case 'p':
            case 'P':
                e.preventDefault(); e.stopPropagation();
                togglePreview(); break;
            case 'Escape':
                if (previewActive) { stopPreview(); break; }
                if (dropdown) dropdown.classList.remove('open'); break;
        }
    }, true);

    // ─── Init ─────────────────────────────────────────────────────────────────────

    function init() { setInterval(tick, 500); tick(); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();